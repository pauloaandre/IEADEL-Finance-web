-- Migration: 20260926123000_financial_rules_remodel.sql

-- 1. Create fechamento_mensal table
CREATE TABLE public.fechamento_mensal (
  id SERIAL PRIMARY KEY,
  mes INTEGER NOT NULL,
  ano INTEGER NOT NULL,
  id_congregacao INTEGER NOT NULL REFERENCES public.congregacao(id_congregacao),
  status VARCHAR(20) NOT NULL CHECK (status IN ('ABERTO', 'FECHADO')),
  data_fechamento TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  id_usuario_gestor UUID REFERENCES auth.users(id),
  UNIQUE(mes, ano, id_congregacao)
);

ALTER TABLE public.fechamento_mensal ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super Admins and Gestores can do everything on fechamento_mensal"
  ON public.fechamento_mensal FOR ALL
  USING (public.get_current_user_perfil() IN ('SUPER_ADMIN', 'GESTOR'));

CREATE POLICY "Anyone can read fechamento_mensal"
  ON public.fechamento_mensal FOR SELECT
  USING (true);

-- 2. Alter movimentacao table
ALTER TABLE public.movimentacao
  ADD COLUMN id_movimentacao_ref INTEGER REFERENCES public.movimentacao(id_mov),
  ADD COLUMN id_fechamento INTEGER REFERENCES public.fechamento_mensal(id),
  ADD COLUMN gerado_automaticamente BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN categoria_sistema VARCHAR(50);

-- 3. Update GESTOR policies on movimentacao
-- Previously we had a READ-ONLY policy for GESTOR. Let's drop it and recreate.
DROP POLICY IF EXISTS "Gestores can read all movimentacoes" ON public.movimentacao;

CREATE POLICY "Gestores can view all movimentacoes"
  ON public.movimentacao FOR SELECT
  USING (public.get_current_user_perfil() = 'GESTOR');

CREATE POLICY "Gestores can insert HQ movimentacoes"
  ON public.movimentacao FOR INSERT WITH CHECK (
  public.get_current_user_perfil() = 'GESTOR' AND id_congregacao = 1
);

CREATE POLICY "Gestores can update HQ movimentacoes"
  ON public.movimentacao FOR UPDATE USING (
  public.get_current_user_perfil() = 'GESTOR' AND id_congregacao = 1
);

CREATE POLICY "Gestores can delete HQ movimentacoes"
  ON public.movimentacao FOR DELETE USING (
  public.get_current_user_perfil() = 'GESTOR' AND id_congregacao = 1
);

-- 4. Protective restrictive policies for auto generated
CREATE POLICY "Block manual update to auto generated records" ON public.movimentacao AS RESTRICTIVE FOR UPDATE USING (
  gerado_automaticamente = false
);
CREATE POLICY "Block manual delete of auto generated records" ON public.movimentacao AS RESTRICTIVE FOR DELETE USING (
  gerado_automaticamente = false
);

-- 5. Protective restrictive policies for closed months
CREATE POLICY "Block insert on closed months" ON public.movimentacao AS RESTRICTIVE FOR INSERT WITH CHECK (
  NOT EXISTS (
    SELECT 1 FROM public.fechamento_mensal fm
    WHERE fm.id_congregacao = movimentacao.id_congregacao
      AND fm.mes = EXTRACT(MONTH FROM movimentacao.data)::INTEGER
      AND fm.ano = EXTRACT(YEAR FROM movimentacao.data)::INTEGER
      AND fm.status = 'FECHADO'
  )
);
CREATE POLICY "Block update on closed months" ON public.movimentacao AS RESTRICTIVE FOR UPDATE USING (
  NOT EXISTS (
    SELECT 1 FROM public.fechamento_mensal fm
    WHERE fm.id_congregacao = movimentacao.id_congregacao
      AND fm.mes = EXTRACT(MONTH FROM movimentacao.data)::INTEGER
      AND fm.ano = EXTRACT(YEAR FROM movimentacao.data)::INTEGER
      AND fm.status = 'FECHADO'
  )
);
CREATE POLICY "Block delete on closed months" ON public.movimentacao AS RESTRICTIVE FOR DELETE USING (
  NOT EXISTS (
    SELECT 1 FROM public.fechamento_mensal fm
    WHERE fm.id_congregacao = movimentacao.id_congregacao
      AND fm.mes = EXTRACT(MONTH FROM movimentacao.data)::INTEGER
      AND fm.ano = EXTRACT(YEAR FROM movimentacao.data)::INTEGER
      AND fm.status = 'FECHADO'
  )
);

-- 6. RPCs

-- RPC to launch worker tithe
CREATE OR REPLACE FUNCTION public.fn_lancar_dizimo_obreiro(
  p_descricao VARCHAR,
  p_valor NUMERIC,
  p_data DATE,
  p_id_congregacao INTEGER,
  p_id_usuario UUID,
  p_id_congregacao_destino INTEGER
) RETURNS public.movimentacao AS $$
DECLARE
  v_original public.movimentacao;
  v_espelho public.movimentacao;
BEGIN
  -- Insert original
  INSERT INTO public.movimentacao (
    descricao, valor, data, tipo, id_congregacao, id_usuario, id_congregacao_destino, gerado_automaticamente
  ) VALUES (
    p_descricao, p_valor, p_data, 'DIZIMO', p_id_congregacao, p_id_usuario, p_id_congregacao_destino, false
  ) RETURNING * INTO v_original;

  -- Insert espelho
  INSERT INTO public.movimentacao (
    descricao, valor, data, tipo, id_congregacao, id_usuario, id_congregacao_destino,
    id_movimentacao_ref, gerado_automaticamente, categoria_sistema
  ) VALUES (
    p_descricao || ' (Espelho Obreiro)', p_valor, p_data, 'DIZIMO', 1, p_id_usuario, 1,
    v_original.id_mov, true, 'DIZIMO_OBREIRO_ESPELHO'
  ) RETURNING * INTO v_espelho;

  RETURN v_original;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- RPC to delete worker tithe safely
CREATE OR REPLACE FUNCTION public.fn_excluir_dizimo_obreiro(
  p_id_mov INTEGER
) RETURNS void AS $$
BEGIN
  -- Delete mirror first
  DELETE FROM public.movimentacao WHERE id_movimentacao_ref = p_id_mov AND categoria_sistema = 'DIZIMO_OBREIRO_ESPELHO';
  -- Delete original
  DELETE FROM public.movimentacao WHERE id_mov = p_id_mov;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- RPC to close general month
CREATE OR REPLACE FUNCTION public.fn_fechar_competencia_geral(
  p_mes INTEGER,
  p_ano INTEGER,
  p_id_gestor UUID
) RETURNS void AS $$
DECLARE
  v_congregacao RECORD;
  v_total_dizimo NUMERIC;
  v_repasse NUMERIC;
  v_id_fechamento_filial INTEGER;
  v_id_fechamento_sede INTEGER;
  v_id_mov_saida INTEGER;
  v_data_mov DATE;
BEGIN
  v_data_mov := (MAKE_DATE(p_ano, p_mes, 1) + interval '1 month' - interval '1 day')::date;

  -- 1. Create or get Sede closure
  INSERT INTO public.fechamento_mensal (mes, ano, id_congregacao, status, id_usuario_gestor)
  VALUES (p_mes, p_ano, 1, 'FECHADO', p_id_gestor)
  ON CONFLICT (mes, ano, id_congregacao) DO UPDATE SET status = 'FECHADO', id_usuario_gestor = p_id_gestor
  RETURNING id INTO v_id_fechamento_sede;

  -- 2. Iterate all active congregations except Sede
  FOR v_congregacao IN SELECT id_congregacao, nome FROM public.congregacao WHERE id_congregacao != 1 LOOP
    
    -- Check if not already closed
    IF NOT EXISTS (SELECT 1 FROM public.fechamento_mensal WHERE mes = p_mes AND ano = p_ano AND id_congregacao = v_congregacao.id_congregacao AND status = 'FECHADO') THEN
      
      -- Calculate 10% on normal tithes (not obreiro)
      SELECT COALESCE(SUM(valor), 0) INTO v_total_dizimo
      FROM public.movimentacao m
      LEFT JOIN public.usuario u ON m.id_usuario = u.id_usuario
      WHERE m.id_congregacao = v_congregacao.id_congregacao
        AND EXTRACT(MONTH FROM m.data) = p_mes
        AND EXTRACT(YEAR FROM m.data) = p_ano
        AND m.tipo = 'DIZIMO'
        AND (u.tipo_contribuinte IS NULL OR u.tipo_contribuinte != 'OBREIRO');

      v_repasse := v_total_dizimo * 0.10;

      IF v_repasse > 0 THEN
        -- Close the branch
        INSERT INTO public.fechamento_mensal (mes, ano, id_congregacao, status, id_usuario_gestor)
        VALUES (p_mes, p_ano, v_congregacao.id_congregacao, 'FECHADO', p_id_gestor)
        ON CONFLICT (mes, ano, id_congregacao) DO UPDATE SET status = 'FECHADO', id_usuario_gestor = p_id_gestor
        RETURNING id INTO v_id_fechamento_filial;

        -- Create DESPESA on branch
        INSERT INTO public.movimentacao (
          descricao, valor, data, tipo, id_congregacao, id_fechamento, gerado_automaticamente, categoria_sistema
        ) VALUES (
          'Repasse de 10% à Matriz - Competência ' || LPAD(p_mes::text, 2, '0') || '/' || p_ano,
          v_repasse,
          v_data_mov,
          'DESPESA',
          v_congregacao.id_congregacao,
          v_id_fechamento_filial,
          true,
          'REPASSE_10_SAIDA'
        ) RETURNING id_mov INTO v_id_mov_saida;

        -- Create OFERTA on HQ linked to Sede's closure and the exit movement
        INSERT INTO public.movimentacao (
          descricao, valor, data, tipo, id_congregacao, id_fechamento, id_movimentacao_ref, gerado_automaticamente, categoria_sistema
        ) VALUES (
          'Recebimento de 10% - ' || v_congregacao.nome || ' - Competência ' || LPAD(p_mes::text, 2, '0') || '/' || p_ano,
          v_repasse,
          v_data_mov,
          'OFERTA',
          1,
          v_id_fechamento_sede,
          v_id_mov_saida,
          true,
          'REPASSE_10_ENTRADA'
        );
      ELSE
        -- If 0, just close
        INSERT INTO public.fechamento_mensal (mes, ano, id_congregacao, status, id_usuario_gestor)
        VALUES (p_mes, p_ano, v_congregacao.id_congregacao, 'FECHADO', p_id_gestor)
        ON CONFLICT (mes, ano, id_congregacao) DO UPDATE SET status = 'FECHADO', id_usuario_gestor = p_id_gestor;
      END IF;

    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- RPC to reopen a single branch
CREATE OR REPLACE FUNCTION public.fn_reabrir_filial(
  p_mes INTEGER,
  p_ano INTEGER,
  p_id_congregacao INTEGER
) RETURNS void AS $$
DECLARE
  v_id_fechamento_filial INTEGER;
  v_id_mov_saida INTEGER;
BEGIN
  -- Get filial closure id
  SELECT id INTO v_id_fechamento_filial FROM public.fechamento_mensal
  WHERE mes = p_mes AND ano = p_ano AND id_congregacao = p_id_congregacao;

  IF v_id_fechamento_filial IS NOT NULL THEN
    -- Update status to ABERTO
    UPDATE public.fechamento_mensal SET status = 'ABERTO' WHERE id = v_id_fechamento_filial;
    
    -- Also reopen HQ
    UPDATE public.fechamento_mensal SET status = 'ABERTO' 
    WHERE mes = p_mes AND ano = p_ano AND id_congregacao = 1;

    -- Delete the 10% entry on HQ
    -- We find it by id_movimentacao_ref pointing to the branch's exit
    DELETE FROM public.movimentacao 
    WHERE id_congregacao = 1 
      AND categoria_sistema = 'REPASSE_10_ENTRADA'
      AND id_movimentacao_ref IN (
        SELECT id_mov FROM public.movimentacao 
        WHERE id_fechamento = v_id_fechamento_filial AND categoria_sistema = 'REPASSE_10_SAIDA'
      );

    -- Delete the 10% exit on branch
    DELETE FROM public.movimentacao 
    WHERE id_fechamento = v_id_fechamento_filial AND categoria_sistema = 'REPASSE_10_SAIDA';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Migration: 20260926124000_fix_rpc_security.sql
-- Descrição: Corrige vulnerabilidades de segurança nas RPCs SECURITY DEFINER.
--   - Adiciona SET search_path = public em todas as RPCs.
--   - Adiciona validação interna de perfil via auth.uid() em todas as RPCs.
--   - Adiciona verificação de competência fechada nas RPCs de obreiro.
--   - Revoga EXECUTE de PUBLIC e anon, concede apenas a authenticated.

-- =============================================================================
-- 1. fn_lancar_dizimo_obreiro — reescrita com segurança interna
-- =============================================================================
CREATE OR REPLACE FUNCTION public.fn_lancar_dizimo_obreiro(
  p_descricao VARCHAR,
  p_valor NUMERIC,
  p_data DATE,
  p_id_congregacao INTEGER,
  p_id_usuario UUID,
  p_id_congregacao_destino INTEGER
) RETURNS public.movimentacao
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_uid UUID;
  v_caller_perfil public.perfil_usuario;
  v_caller_congregacao INTEGER;
  v_tipo_contribuinte VARCHAR;
  v_original public.movimentacao;
  v_espelho public.movimentacao;
BEGIN
  -- Autenticação
  v_caller_uid := auth.uid();
  IF v_caller_uid IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  -- Perfil e congregação do caller
  SELECT perfil, id_congregacao INTO v_caller_perfil, v_caller_congregacao
  FROM public.usuario WHERE id_usuario = v_caller_uid;

  IF v_caller_perfil IS NULL THEN
    RAISE EXCEPTION 'Usuário não encontrado.';
  END IF;

  -- Autorização: ADMIN da mesma congregação, GESTOR (se Sede), ou SUPER_ADMIN
  IF v_caller_perfil = 'SUPER_ADMIN' THEN
    NULL; -- permitido
  ELSIF v_caller_perfil = 'ADMIN' AND v_caller_congregacao = p_id_congregacao THEN
    NULL; -- permitido
  ELSIF v_caller_perfil = 'GESTOR' AND p_id_congregacao = 1 THEN
    NULL; -- GESTOR é admin da Sede
  ELSE
    RAISE EXCEPTION 'Permissão negada para lançar dízimo de obreiro nesta congregação.';
  END IF;

  -- Validar que o contribuinte é realmente OBREIRO
  SELECT tipo_contribuinte INTO v_tipo_contribuinte
  FROM public.usuario WHERE id_usuario = p_id_usuario;

  IF v_tipo_contribuinte IS NULL OR v_tipo_contribuinte != 'OBREIRO' THEN
    RAISE EXCEPTION 'O contribuinte informado não é um obreiro.';
  END IF;

  -- Verificar competência fechada
  IF EXISTS (
    SELECT 1 FROM public.fechamento_mensal
    WHERE id_congregacao = p_id_congregacao
      AND mes = EXTRACT(MONTH FROM p_data)::INTEGER
      AND ano = EXTRACT(YEAR FROM p_data)::INTEGER
      AND status = 'FECHADO'
  ) THEN
    RAISE EXCEPTION 'A competência está fechada e não permite novos lançamentos.';
  END IF;

  -- Insert original na filial
  INSERT INTO public.movimentacao (
    descricao, valor, data, tipo, id_congregacao, id_usuario,
    id_congregacao_destino, gerado_automaticamente
  ) VALUES (
    p_descricao, p_valor, p_data, 'DIZIMO', p_id_congregacao, p_id_usuario,
    p_id_congregacao_destino, false
  ) RETURNING * INTO v_original;

  -- Insert espelho na Sede
  INSERT INTO public.movimentacao (
    descricao, valor, data, tipo, id_congregacao, id_usuario,
    id_congregacao_destino, id_movimentacao_ref, gerado_automaticamente, categoria_sistema
  ) VALUES (
    p_descricao || ' (Espelho Obreiro)', p_valor, p_data, 'DIZIMO', 1, p_id_usuario,
    1, v_original.id_mov, true, 'DIZIMO_OBREIRO_ESPELHO'
  ) RETURNING * INTO v_espelho;

  RETURN v_original;
END;
$$;


-- =============================================================================
-- 2. fn_excluir_dizimo_obreiro — reescrita com segurança interna
-- =============================================================================
CREATE OR REPLACE FUNCTION public.fn_excluir_dizimo_obreiro(
  p_id_mov INTEGER
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_uid UUID;
  v_caller_perfil public.perfil_usuario;
  v_caller_congregacao INTEGER;
  v_mov_congregacao INTEGER;
  v_mov_data DATE;
BEGIN
  -- Autenticação
  v_caller_uid := auth.uid();
  IF v_caller_uid IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  -- Perfil e congregação do caller
  SELECT perfil, id_congregacao INTO v_caller_perfil, v_caller_congregacao
  FROM public.usuario WHERE id_usuario = v_caller_uid;

  IF v_caller_perfil IS NULL THEN
    RAISE EXCEPTION 'Usuário não encontrado.';
  END IF;

  -- USER comum não pode excluir
  IF v_caller_perfil = 'USER' THEN
    RAISE EXCEPTION 'Usuários comuns não têm permissão para excluir movimentações.';
  END IF;

  -- Buscar congregação e data do lançamento original
  SELECT id_congregacao, data INTO v_mov_congregacao, v_mov_data
  FROM public.movimentacao WHERE id_mov = p_id_mov;

  IF v_mov_congregacao IS NULL THEN
    RAISE EXCEPTION 'Movimentação não encontrada.';
  END IF;

  -- Autorização: ADMIN da mesma congregação, GESTOR (se Sede), ou SUPER_ADMIN
  IF v_caller_perfil = 'SUPER_ADMIN' THEN
    NULL; -- permitido
  ELSIF v_caller_perfil = 'ADMIN' AND v_caller_congregacao = v_mov_congregacao THEN
    NULL; -- permitido
  ELSIF v_caller_perfil = 'GESTOR' AND v_mov_congregacao = 1 THEN
    NULL; -- GESTOR opera na Sede
  ELSE
    RAISE EXCEPTION 'Permissão negada para excluir este dízimo de obreiro.';
  END IF;

  -- Verificar competência fechada
  IF EXISTS (
    SELECT 1 FROM public.fechamento_mensal
    WHERE id_congregacao = v_mov_congregacao
      AND mes = EXTRACT(MONTH FROM v_mov_data)::INTEGER
      AND ano = EXTRACT(YEAR FROM v_mov_data)::INTEGER
      AND status = 'FECHADO'
  ) THEN
    RAISE EXCEPTION 'A competência está fechada e não permite exclusão de lançamentos.';
  END IF;

  -- Excluir espelho primeiro
  DELETE FROM public.movimentacao
  WHERE id_movimentacao_ref = p_id_mov AND categoria_sistema = 'DIZIMO_OBREIRO_ESPELHO';

  -- Excluir original
  DELETE FROM public.movimentacao WHERE id_mov = p_id_mov;
END;
$$;


-- =============================================================================
-- 3. fn_fechar_competencia_geral — reescrita com segurança interna
-- =============================================================================
CREATE OR REPLACE FUNCTION public.fn_fechar_competencia_geral(
  p_mes INTEGER,
  p_ano INTEGER,
  p_id_gestor UUID
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_uid UUID;
  v_caller_perfil public.perfil_usuario;
  v_congregacao RECORD;
  v_total_dizimo NUMERIC;
  v_repasse NUMERIC;
  v_id_fechamento_filial INTEGER;
  v_id_fechamento_sede INTEGER;
  v_id_mov_saida INTEGER;
  v_data_mov DATE;
BEGIN
  -- Autenticação
  v_caller_uid := auth.uid();
  IF v_caller_uid IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  -- Validar que p_id_gestor corresponde ao caller
  IF p_id_gestor IS DISTINCT FROM v_caller_uid THEN
    RAISE EXCEPTION 'O parâmetro p_id_gestor não corresponde ao usuário autenticado.';
  END IF;

  -- Perfil do caller
  SELECT perfil INTO v_caller_perfil
  FROM public.usuario WHERE id_usuario = v_caller_uid;

  IF v_caller_perfil IS NULL THEN
    RAISE EXCEPTION 'Usuário não encontrado.';
  END IF;

  -- Autorização: somente GESTOR ou SUPER_ADMIN
  IF v_caller_perfil NOT IN ('GESTOR', 'SUPER_ADMIN') THEN
    RAISE EXCEPTION 'Apenas GESTOR ou SUPER_ADMIN pode realizar o fechamento geral.';
  END IF;

  v_data_mov := (MAKE_DATE(p_ano, p_mes, 1) + interval '1 month' - interval '1 day')::date;

  -- Criar ou atualizar fechamento da Sede
  INSERT INTO public.fechamento_mensal (mes, ano, id_congregacao, status, id_usuario_gestor)
  VALUES (p_mes, p_ano, 1, 'FECHADO', v_caller_uid)
  ON CONFLICT (mes, ano, id_congregacao) DO UPDATE SET status = 'FECHADO', id_usuario_gestor = v_caller_uid
  RETURNING id INTO v_id_fechamento_sede;

  -- Iterar filiais (exceto Sede)
  FOR v_congregacao IN SELECT id_congregacao, nome FROM public.congregacao WHERE id_congregacao != 1 LOOP

    IF NOT EXISTS (
      SELECT 1 FROM public.fechamento_mensal
      WHERE mes = p_mes AND ano = p_ano
        AND id_congregacao = v_congregacao.id_congregacao
        AND status = 'FECHADO'
    ) THEN

      -- Calcular 10% sobre dízimos normais (não obreiro)
      SELECT COALESCE(SUM(m.valor), 0) INTO v_total_dizimo
      FROM public.movimentacao m
      LEFT JOIN public.usuario u ON m.id_usuario = u.id_usuario
      WHERE m.id_congregacao = v_congregacao.id_congregacao
        AND EXTRACT(MONTH FROM m.data) = p_mes
        AND EXTRACT(YEAR FROM m.data) = p_ano
        AND m.tipo = 'DIZIMO'
        AND (u.tipo_contribuinte IS NULL OR u.tipo_contribuinte != 'OBREIRO');

      v_repasse := v_total_dizimo * 0.10;

      IF v_repasse > 0 THEN
        -- Fechar a filial
        INSERT INTO public.fechamento_mensal (mes, ano, id_congregacao, status, id_usuario_gestor)
        VALUES (p_mes, p_ano, v_congregacao.id_congregacao, 'FECHADO', v_caller_uid)
        ON CONFLICT (mes, ano, id_congregacao) DO UPDATE SET status = 'FECHADO', id_usuario_gestor = v_caller_uid
        RETURNING id INTO v_id_fechamento_filial;

        -- DESPESA na filial (saída de 10%)
        INSERT INTO public.movimentacao (
          descricao, valor, data, tipo, id_congregacao, id_fechamento,
          gerado_automaticamente, categoria_sistema
        ) VALUES (
          'Repasse de 10% à Matriz - Competência ' || LPAD(p_mes::text, 2, '0') || '/' || p_ano,
          v_repasse, v_data_mov, 'DESPESA', v_congregacao.id_congregacao,
          v_id_fechamento_filial, true, 'REPASSE_10_SAIDA'
        ) RETURNING id_mov INTO v_id_mov_saida;

        -- OFERTA na Sede (entrada de 10%)
        INSERT INTO public.movimentacao (
          descricao, valor, data, tipo, id_congregacao, id_fechamento,
          id_movimentacao_ref, gerado_automaticamente, categoria_sistema
        ) VALUES (
          'Recebimento de 10% - ' || v_congregacao.nome || ' - Competência ' || LPAD(p_mes::text, 2, '0') || '/' || p_ano,
          v_repasse, v_data_mov, 'OFERTA', 1,
          v_id_fechamento_sede, v_id_mov_saida, true, 'REPASSE_10_ENTRADA'
        );
      ELSE
        -- Sem repasse, apenas fechar
        INSERT INTO public.fechamento_mensal (mes, ano, id_congregacao, status, id_usuario_gestor)
        VALUES (p_mes, p_ano, v_congregacao.id_congregacao, 'FECHADO', v_caller_uid)
        ON CONFLICT (mes, ano, id_congregacao) DO UPDATE SET status = 'FECHADO', id_usuario_gestor = v_caller_uid;
      END IF;

    END IF;
  END LOOP;
END;
$$;


-- =============================================================================
-- 4. fn_reabrir_filial — reescrita com segurança interna
-- =============================================================================
CREATE OR REPLACE FUNCTION public.fn_reabrir_filial(
  p_mes INTEGER,
  p_ano INTEGER,
  p_id_congregacao INTEGER
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_uid UUID;
  v_caller_perfil public.perfil_usuario;
  v_id_fechamento_filial INTEGER;
BEGIN
  -- Autenticação
  v_caller_uid := auth.uid();
  IF v_caller_uid IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  -- Perfil do caller
  SELECT perfil INTO v_caller_perfil
  FROM public.usuario WHERE id_usuario = v_caller_uid;

  IF v_caller_perfil IS NULL THEN
    RAISE EXCEPTION 'Usuário não encontrado.';
  END IF;

  -- Autorização: somente GESTOR ou SUPER_ADMIN
  IF v_caller_perfil NOT IN ('GESTOR', 'SUPER_ADMIN') THEN
    RAISE EXCEPTION 'Apenas GESTOR ou SUPER_ADMIN pode reabrir uma competência.';
  END IF;

  -- Buscar fechamento da filial
  SELECT id INTO v_id_fechamento_filial FROM public.fechamento_mensal
  WHERE mes = p_mes AND ano = p_ano AND id_congregacao = p_id_congregacao;

  IF v_id_fechamento_filial IS NOT NULL THEN
    -- Reabrir filial
    UPDATE public.fechamento_mensal SET status = 'ABERTO' WHERE id = v_id_fechamento_filial;

    -- Reabrir Sede
    UPDATE public.fechamento_mensal SET status = 'ABERTO'
    WHERE mes = p_mes AND ano = p_ano AND id_congregacao = 1;

    -- Excluir entrada de 10% na Sede (vinculada à saída da filial)
    DELETE FROM public.movimentacao
    WHERE id_congregacao = 1
      AND categoria_sistema = 'REPASSE_10_ENTRADA'
      AND id_movimentacao_ref IN (
        SELECT id_mov FROM public.movimentacao
        WHERE id_fechamento = v_id_fechamento_filial AND categoria_sistema = 'REPASSE_10_SAIDA'
      );

    -- Excluir saída de 10% da filial
    DELETE FROM public.movimentacao
    WHERE id_fechamento = v_id_fechamento_filial AND categoria_sistema = 'REPASSE_10_SAIDA';
  END IF;
END;
$$;


-- =============================================================================
-- 5. REVOKE / GRANT — restringir acesso às RPCs
-- =============================================================================

-- Revogar de PUBLIC (grant padrão do PostgreSQL)
REVOKE EXECUTE ON FUNCTION public.fn_lancar_dizimo_obreiro(VARCHAR, NUMERIC, DATE, INTEGER, UUID, INTEGER) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_excluir_dizimo_obreiro(INTEGER) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_fechar_competencia_geral(INTEGER, INTEGER, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_reabrir_filial(INTEGER, INTEGER, INTEGER) FROM PUBLIC;

-- Revogar de anon (usuários não autenticados)
REVOKE EXECUTE ON FUNCTION public.fn_lancar_dizimo_obreiro(VARCHAR, NUMERIC, DATE, INTEGER, UUID, INTEGER) FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_excluir_dizimo_obreiro(INTEGER) FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_fechar_competencia_geral(INTEGER, INTEGER, UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_reabrir_filial(INTEGER, INTEGER, INTEGER) FROM anon;

-- Conceder apenas a authenticated (validação real é feita internamente)
GRANT EXECUTE ON FUNCTION public.fn_lancar_dizimo_obreiro(VARCHAR, NUMERIC, DATE, INTEGER, UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_excluir_dizimo_obreiro(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_fechar_competencia_geral(INTEGER, INTEGER, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_reabrir_filial(INTEGER, INTEGER, INTEGER) TO authenticated;

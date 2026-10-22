-- Migration: 20260930225500_fix_obreiro_rules.sql
-- Descrição: Ajusta regras de dízimo de obreiro conforme novas diretrizes:
--   - Remove criação de movimentação espelho na Sede (dízimo de obreiro não é receita da Sede)
--   - Restringe lançamento/exclusão de dízimo de obreiro a GESTOR e SUPER_ADMIN (ADMIN não pode mais)
--   - GESTOR pode informar qualquer congregação de origem (não apenas Sede)
--   - Mantém SET search_path, REVOKE/GRANT, validação auth.uid()

-- =============================================================================
-- 1. fn_lancar_dizimo_obreiro — reescrita SEM espelho na Sede
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
  v_tipo_contribuinte VARCHAR;
  v_original public.movimentacao;
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

  -- Autorização: SOMENTE GESTOR ou SUPER_ADMIN podem lançar dízimo de obreiro
  IF v_caller_perfil NOT IN ('GESTOR', 'SUPER_ADMIN') THEN
    RAISE EXCEPTION 'Apenas GESTOR ou SUPER_ADMIN pode registrar dízimo de obreiro.';
  END IF;

  -- Validar que o contribuinte é realmente OBREIRO
  SELECT tipo_contribuinte INTO v_tipo_contribuinte
  FROM public.usuario WHERE id_usuario = p_id_usuario;

  IF v_tipo_contribuinte IS NULL OR v_tipo_contribuinte != 'OBREIRO' THEN
    RAISE EXCEPTION 'O contribuinte informado não é um obreiro.';
  END IF;

  -- Verificar competência fechada na congregação de origem
  IF EXISTS (
    SELECT 1 FROM public.fechamento_mensal
    WHERE id_congregacao = p_id_congregacao
      AND mes = EXTRACT(MONTH FROM p_data)::INTEGER
      AND ano = EXTRACT(YEAR FROM p_data)::INTEGER
      AND status = 'FECHADO'
  ) THEN
    RAISE EXCEPTION 'A competência está fechada e não permite novos lançamentos.';
  END IF;

  -- Insert APENAS na congregação de origem (sem espelho na Sede)
  INSERT INTO public.movimentacao (
    descricao, valor, data, tipo, id_congregacao, id_usuario,
    id_congregacao_destino, gerado_automaticamente
  ) VALUES (
    p_descricao, p_valor, p_data, 'DIZIMO', p_id_congregacao, p_id_usuario,
    p_id_congregacao_destino, false
  ) RETURNING * INTO v_original;

  RETURN v_original;
END;
$$;


-- =============================================================================
-- 2. fn_excluir_dizimo_obreiro — reescrita SEM excluir espelho
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
  v_mov_congregacao INTEGER;
  v_mov_data DATE;
  v_mov_usuario UUID;
  v_tipo_contribuinte VARCHAR;
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

  -- Autorização: SOMENTE GESTOR ou SUPER_ADMIN podem excluir dízimo de obreiro
  IF v_caller_perfil NOT IN ('GESTOR', 'SUPER_ADMIN') THEN
    RAISE EXCEPTION 'Apenas GESTOR ou SUPER_ADMIN pode excluir dízimo de obreiro.';
  END IF;

  -- Buscar dados do lançamento original
  SELECT id_congregacao, data, id_usuario INTO v_mov_congregacao, v_mov_data, v_mov_usuario
  FROM public.movimentacao WHERE id_mov = p_id_mov;

  IF v_mov_congregacao IS NULL THEN
    RAISE EXCEPTION 'Movimentação não encontrada.';
  END IF;

  -- Validar que é realmente um dízimo de obreiro
  SELECT tipo_contribuinte INTO v_tipo_contribuinte
  FROM public.usuario WHERE id_usuario = v_mov_usuario;

  IF v_tipo_contribuinte IS NULL OR v_tipo_contribuinte != 'OBREIRO' THEN
    RAISE EXCEPTION 'Esta movimentação não é um dízimo de obreiro.';
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

  -- Excluir APENAS o registro original (sem espelho para limpar)
  DELETE FROM public.movimentacao WHERE id_mov = p_id_mov;
END;
$$;


-- =============================================================================
-- 3. REVOKE / GRANT — manter restrições
-- =============================================================================
REVOKE EXECUTE ON FUNCTION public.fn_lancar_dizimo_obreiro(VARCHAR, NUMERIC, DATE, INTEGER, UUID, INTEGER) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_excluir_dizimo_obreiro(INTEGER) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.fn_lancar_dizimo_obreiro(VARCHAR, NUMERIC, DATE, INTEGER, UUID, INTEGER) FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_excluir_dizimo_obreiro(INTEGER) FROM anon;

GRANT EXECUTE ON FUNCTION public.fn_lancar_dizimo_obreiro(VARCHAR, NUMERIC, DATE, INTEGER, UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_excluir_dizimo_obreiro(INTEGER) TO authenticated;

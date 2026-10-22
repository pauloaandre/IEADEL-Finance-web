-- Migration: 20260925200001_gestor_policies_and_triggers.sql
-- Descrição: Separa as referências literais a 'GESTOR' para evitar o erro:
--            "unsafe use of new value of enum type" no mesmo transaction block.

-- =============================================================================
-- PARTE 5: Políticas RLS para o perfil GESTOR
-- =============================================================================

-- USUARIO: GESTOR pode visualizar todos os usuários (read-only)
DROP POLICY IF EXISTS "Gestores can view all users" ON public.usuario;
CREATE POLICY "Gestores can view all users"
  ON public.usuario
  FOR SELECT
  USING (public.get_current_user_perfil() = 'GESTOR');

-- MOVIMENTACAO: GESTOR pode visualizar todas as movimentações (read-only)
DROP POLICY IF EXISTS "Gestores can read all movimentacoes" ON public.movimentacao;
CREATE POLICY "Gestores can read all movimentacoes"
  ON public.movimentacao
  FOR SELECT
  USING (public.get_current_user_perfil() = 'GESTOR');

-- CONGREGACAO: já coberta pela policy "Anyone can read congregacao" (USING true)


-- =============================================================================
-- PARTE 6: Atualizar trigger de proteção contra escalonamento de privilégios
-- =============================================================================

CREATE OR REPLACE FUNCTION public.check_user_update_privileges()
RETURNS trigger AS $$
DECLARE
  v_current_role public.perfil_usuario;
BEGIN
  -- Se executado sem sessão de usuário (service_role / migração direta), permite
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  v_current_role := public.get_current_user_perfil();

  -- SUPER_ADMIN tem permissão irrestrita
  IF v_current_role = 'SUPER_ADMIN' THEN
    RETURN NEW;
  END IF;

  -- Regras para perfil USER:
  IF v_current_role = 'USER' THEN
    -- Impede autoescalonamento de perfil
    IF NEW.perfil IS DISTINCT FROM OLD.perfil THEN
      RAISE EXCEPTION 'Usuários não têm permissão para alterar seu perfil.';
    END IF;

    -- Impede alterar o próprio status ativo/inativo
    IF NEW.ativo IS DISTINCT FROM OLD.ativo THEN
      RAISE EXCEPTION 'Usuários não têm permissão para alterar o status ativo.';
    END IF;

    -- Impede trocar de congregação por conta própria
    IF NEW.id_congregacao IS DISTINCT FROM OLD.id_congregacao THEN
      RAISE EXCEPTION 'Usuários não têm permissão para alterar sua congregação.';
    END IF;

    -- Impede alterar tipo_contribuinte por conta própria
    IF NEW.tipo_contribuinte IS DISTINCT FROM OLD.tipo_contribuinte THEN
      RAISE EXCEPTION 'Usuários não têm permissão para alterar seu tipo de contribuinte.';
    END IF;
  END IF;

  -- Regras para perfil GESTOR:
  -- GESTOR é read-only; não pode alterar dados de usuários via RLS,
  -- mas caso consiga chegar aqui (ex: bypass), bloqueamos tudo exceto leitura.
  IF v_current_role = 'GESTOR' THEN
    -- GESTOR não pode alterar perfil de ninguém
    IF NEW.perfil IS DISTINCT FROM OLD.perfil THEN
      RAISE EXCEPTION 'GESTOR não tem permissão para alterar perfis.';
    END IF;

    -- GESTOR não pode alterar status ativo
    IF NEW.ativo IS DISTINCT FROM OLD.ativo THEN
      RAISE EXCEPTION 'GESTOR não tem permissão para alterar o status ativo.';
    END IF;

    -- GESTOR não pode mover usuários entre congregações
    IF NEW.id_congregacao IS DISTINCT FROM OLD.id_congregacao THEN
      RAISE EXCEPTION 'GESTOR não tem permissão para transferir usuários.';
    END IF;

    -- GESTOR não pode alterar tipo_contribuinte
    IF NEW.tipo_contribuinte IS DISTINCT FROM OLD.tipo_contribuinte THEN
      RAISE EXCEPTION 'GESTOR não tem permissão para alterar tipo de contribuinte.';
    END IF;
  END IF;

  -- Regras para perfil ADMIN:
  IF v_current_role = 'ADMIN' THEN
    -- ADMIN não pode promover a si mesmo ou a terceiros para SUPER_ADMIN
    IF NEW.perfil = 'SUPER_ADMIN' AND OLD.perfil IS DISTINCT FROM 'SUPER_ADMIN' THEN
      RAISE EXCEPTION 'Apenas SUPER_ADMIN pode promover usuários a SUPER_ADMIN.';
    END IF;

    -- ADMIN não pode promover para GESTOR
    IF NEW.perfil = 'GESTOR' AND OLD.perfil IS DISTINCT FROM 'GESTOR' THEN
      RAISE EXCEPTION 'Apenas SUPER_ADMIN pode atribuir o perfil GESTOR.';
    END IF;

    -- ADMIN não pode mover usuários para outra congregação
    IF NEW.id_congregacao IS DISTINCT FROM OLD.id_congregacao THEN
      RAISE EXCEPTION 'ADMIN não pode transferir usuários entre congregações.';
    END IF;

    -- ADMIN pode alterar tipo_contribuinte de usuários da mesma congregação
    -- (verificação de congregação já é feita pelo RLS)
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- O trigger já existe (trg_check_user_update_privileges), a função foi substituída via CREATE OR REPLACE.

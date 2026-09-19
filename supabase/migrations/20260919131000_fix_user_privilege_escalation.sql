-- Migration: 20260919131000_fix_user_privilege_escalation.sql
-- Descrição: Impede autoescalonamento de privilégios (perfil), exclusão indevida e alteração de congregação/ativo por perfil USER.

-- 1. Atualizar a função handle_new_user para vincular id_congregacao no cadastro automaticamente via metadados
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.usuario (id_usuario, email, nome, perfil, id_congregacao)
  VALUES (
    new.id, 
    new.email, 
    COALESCE(new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1)), 
    'USER'::public.perfil_usuario,
    NULLIF(new.raw_user_meta_data->>'id_congregacao', '')::INTEGER
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Corrigir políticas RLS da tabela public.usuario
-- Remove a política permissiva anterior (FOR ALL permitia UPDATE irrestrito e DELETE)
DROP POLICY IF EXISTS "Users can view and edit their own profile" ON public.usuario;

-- Usuários comuns podem apenas VISUALIZAR seu próprio registro
CREATE POLICY "Users can view their own profile" ON public.usuario
  FOR SELECT USING (id_usuario = auth.uid());

-- Usuários comuns podem ATUALIZAR apenas seu próprio registro (DELETE não é permitido para USER)
CREATE POLICY "Users can update their own profile" ON public.usuario
  FOR UPDATE 
  USING (id_usuario = auth.uid())
  WITH CHECK (id_usuario = auth.uid());


-- 3. Trigger para proteção a nível de coluna (impede escalonamento de privilégio via SQL direto)
CREATE OR REPLACE FUNCTION public.check_user_update_privileges()
RETURNS trigger AS $$
DECLARE
  current_role public.perfil_usuario;
BEGIN
  -- Se executado sem sessão de usuário (service_role / migração direta), permite
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  current_role := public.get_current_user_perfil();

  -- SUPER_ADMIN tem permissão irrestrita
  IF current_role = 'SUPER_ADMIN' THEN
    RETURN NEW;
  END IF;

  -- Regras para perfil USER:
  IF current_role = 'USER' THEN
    -- Impede autoescalonamento de perfil (ex: tentar virar ADMIN ou SUPER_ADMIN)
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
  END IF;

  -- Regras para perfil ADMIN:
  IF current_role = 'ADMIN' THEN
    -- ADMIN não pode promover a si mesmo ou a terceiros para SUPER_ADMIN
    IF NEW.perfil = 'SUPER_ADMIN' AND OLD.perfil IS DISTINCT FROM 'SUPER_ADMIN' THEN
      RAISE EXCEPTION 'Apenas SUPER_ADMIN pode promover usuários a SUPER_ADMIN.';
    END IF;

    -- ADMIN não pode mover usuários para outra congregação
    IF NEW.id_congregacao IS DISTINCT FROM OLD.id_congregacao THEN
      RAISE EXCEPTION 'ADMIN não pode transferir usuários entre congregações.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cria o trigger na tabela usuario
DROP TRIGGER IF EXISTS trg_check_user_update_privileges ON public.usuario;
CREATE TRIGGER trg_check_user_update_privileges
  BEFORE UPDATE ON public.usuario
  FOR EACH ROW
  EXECUTE PROCEDURE public.check_user_update_privileges();

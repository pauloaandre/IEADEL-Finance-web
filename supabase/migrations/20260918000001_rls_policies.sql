-- Helper functions to get current user's profile and congregation safely (Bypasses RLS to avoid infinite recursion)
CREATE OR REPLACE FUNCTION public.get_current_user_perfil()
RETURNS public.perfil_usuario
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT perfil FROM public.usuario WHERE id_usuario = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_current_user_congregacao()
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT id_congregacao FROM public.usuario WHERE id_usuario = auth.uid();
$$;


-- ==========================================
-- POLICIES FOR CONGREGACAO
-- ==========================================
CREATE POLICY "Super Admins can do everything on congregacao" ON public.congregacao
  FOR ALL USING (public.get_current_user_perfil() = 'SUPER_ADMIN');

CREATE POLICY "Admins and Users can read their own congregacao" ON public.congregacao
  FOR SELECT USING (id_congregacao = public.get_current_user_congregacao());


-- ==========================================
-- POLICIES FOR USUARIO
-- ==========================================
CREATE POLICY "Super Admins can do everything on usuario" ON public.usuario
  FOR ALL USING (public.get_current_user_perfil() = 'SUPER_ADMIN');

CREATE POLICY "Admins can view and edit users in their congregacao" ON public.usuario
  FOR ALL USING (
    public.get_current_user_perfil() = 'ADMIN' AND 
    id_congregacao = public.get_current_user_congregacao()
  );

CREATE POLICY "Users can view and edit their own profile" ON public.usuario
  FOR ALL USING (id_usuario = auth.uid());


-- ==========================================
-- POLICIES FOR MOVIMENTACAO
-- ==========================================
CREATE POLICY "Super Admins can do everything on movimentacao" ON public.movimentacao
  FOR ALL USING (public.get_current_user_perfil() = 'SUPER_ADMIN');

CREATE POLICY "Admins can do everything in their congregacao" ON public.movimentacao
  FOR ALL USING (
    public.get_current_user_perfil() = 'ADMIN' AND 
    id_congregacao = public.get_current_user_congregacao()
  );

CREATE POLICY "Users can read their own movimentacoes" ON public.movimentacao
  FOR SELECT USING (
    id_congregacao = public.get_current_user_congregacao() AND
    id_usuario = auth.uid()
  );

CREATE POLICY "Users can insert movimentacoes in their congregacao" ON public.movimentacao
  FOR INSERT WITH CHECK (
    id_congregacao = public.get_current_user_congregacao() AND
    id_usuario = auth.uid()
  );

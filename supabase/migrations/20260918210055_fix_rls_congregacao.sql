-- Drop the restrictive policy that prevented unauthenticated users from listing congregations
DROP POLICY IF EXISTS "Admins and Users can read their own congregacao" ON public.congregacao;

-- Allow anyone (including anon) to read congregations so the signup page can list them
CREATE POLICY "Anyone can read congregacao" ON public.congregacao
  FOR SELECT USING (true);

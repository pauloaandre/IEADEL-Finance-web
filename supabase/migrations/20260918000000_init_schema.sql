-- Create custom types
CREATE TYPE public.perfil_usuario AS ENUM ('SUPER_ADMIN', 'ADMIN', 'USER');

-- Create congregacao table
CREATE TABLE public.congregacao (
    id_congregacao SERIAL PRIMARY KEY,
    nome VARCHAR(150) NOT NULL,
    endereco VARCHAR(255)
);

-- Create usuario table (linked to auth.users)
CREATE TABLE public.usuario (
    id_usuario UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    id_congregacao INTEGER REFERENCES public.congregacao(id_congregacao) ON DELETE SET NULL,
    nome VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    perfil public.perfil_usuario DEFAULT 'USER'::public.perfil_usuario,
    ativo BOOLEAN DEFAULT true
);

-- Create movimentacao table
CREATE TABLE public.movimentacao (
    id_mov SERIAL PRIMARY KEY,
    id_congregacao INTEGER NOT NULL REFERENCES public.congregacao(id_congregacao) ON DELETE CASCADE,
    id_usuario UUID REFERENCES public.usuario(id_usuario) ON DELETE SET NULL,
    descricao VARCHAR(255) NOT NULL,
    valor DECIMAL(10, 2) NOT NULL,
    data DATE NOT NULL,
    tipo VARCHAR(20) NOT NULL,
    data_registro TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP
);

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.usuario (id_usuario, email, nome, perfil)
  VALUES (
    new.id, 
    new.email, 
    COALESCE(new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1)), 
    'USER'::public.perfil_usuario
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically create a profile for new users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Enable RLS on all tables (Preparation for Phase 3)
ALTER TABLE public.congregacao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimentacao ENABLE ROW LEVEL SECURITY;

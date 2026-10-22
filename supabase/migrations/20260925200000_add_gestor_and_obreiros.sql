-- Migration: 20260925200000_add_gestor_and_obreiros.sql
-- Descrição: Adiciona perfil GESTOR, tipo_contribuinte (obreiro/membro),
--            campo de destino financeiro, e migra coluna tipo para ENUM.

-- =============================================================================
-- PARTE 1: Evolução do ENUM de perfil
-- =============================================================================

-- Adiciona 'GESTOR' ao enum existente.
-- ATENÇÃO: ALTER TYPE ADD VALUE é irreversível no PostgreSQL.
ALTER TYPE public.perfil_usuario ADD VALUE IF NOT EXISTS 'GESTOR';


-- =============================================================================
-- PARTE 2: Migrar coluna 'tipo' de VARCHAR(20) para ENUM
-- =============================================================================

-- Cria o novo ENUM para tipos de movimentação
CREATE TYPE public.tipo_movimentacao AS ENUM ('DIZIMO', 'OFERTA', 'DESPESA');

-- Converte a coluna existente de VARCHAR para o novo ENUM
ALTER TABLE public.movimentacao
  ALTER COLUMN tipo TYPE public.tipo_movimentacao
  USING tipo::public.tipo_movimentacao;


-- =============================================================================
-- PARTE 3: Campo tipo_contribuinte na tabela usuario
-- =============================================================================

-- Distingue membros comuns de obreiros (sem criar um perfil de acesso separado).
-- Valores possíveis: 'MEMBRO' (padrão), 'OBREIRO'.
ALTER TABLE public.usuario
  ADD COLUMN IF NOT EXISTS tipo_contribuinte VARCHAR(20) NOT NULL DEFAULT 'MEMBRO';

-- Constraint para garantir valores válidos
ALTER TABLE public.usuario
  ADD CONSTRAINT chk_tipo_contribuinte
  CHECK (tipo_contribuinte IN ('MEMBRO', 'OBREIRO'));


-- =============================================================================
-- PARTE 4: Campo id_congregacao_destino na tabela movimentacao
-- =============================================================================

-- Quando um obreiro paga dízimo na congregação A, o destino financeiro é a Sede (id=1).
-- Para membros comuns, este campo será igual a id_congregacao (ou NULL = mesmo destino).
ALTER TABLE public.movimentacao
  ADD COLUMN IF NOT EXISTS id_congregacao_destino INTEGER
  REFERENCES public.congregacao(id_congregacao) ON DELETE SET NULL;




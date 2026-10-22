import { createClient } from '@/utils/supabase/server'
import type {
  CreateCongregacaoInput,
  CongregacaoResponse,
} from '@/lib/validations/congregacao'

/**
 * Mapeia uma entidade Congregacao para CongregacaoResponseDTO
 */
function toCongregacaoResponse(
  congregacao: any,
  includeMembers: boolean
): CongregacaoResponse {
  const response: CongregacaoResponse = {
    idCongregacao: congregacao.id_congregacao,
    nome: congregacao.nome,
    endereco: congregacao.endereco,
  }

  if (includeMembers && congregacao.usuario) {
    response.quantidadeMembros = congregacao.usuario.filter(
      (u: any) => u.ativo && !u.nome.startsWith('Visitante')
    ).length
  }

  return response
}

/**
 * Lista todas as congregações.
 */
export async function listarCongregacoes(
  isSuperAdmin: boolean,
  isGestor: boolean = false
): Promise<CongregacaoResponse[]> {
  const supabase = await createClient()
  const hasFullAccess = isSuperAdmin || isGestor

  let query = supabase.from('congregacao').select(
    hasFullAccess ? '*, usuario(nome, ativo)' : '*'
  ).order('id_congregacao', { ascending: true })

  const { data, error } = await query

  if (error) {
    console.error('Erro no Supabase:', error)
    throw new Error('Falha ao listar congregações')
  }

  return (data || []).map((c) => toCongregacaoResponse(c, hasFullAccess))
}

/**
 * Busca uma congregação por ID.
 */
export async function buscarCongregacaoPorId(
  id: number,
  isSuperAdmin: boolean,
  isGestor: boolean = false
): Promise<CongregacaoResponse | null> {
  const supabase = await createClient()
  const hasFullAccess = isSuperAdmin || isGestor

  let query = supabase
    .from('congregacao')
    .select(hasFullAccess ? '*, usuario(nome, ativo)' : '*')
    .eq('id_congregacao', id)
    .single()

  const { data, error } = await query

  if (error) return null

  return toCongregacaoResponse(data, hasFullAccess)
}

/**
 * Cria uma nova congregação e seu usuário visitante correspondente.
 */
export async function criarCongregacao(
  dados: CreateCongregacaoInput
): Promise<CongregacaoResponse> {
  const supabase = await createClient()

  // 1. Cria a congregação
  const { data: novaCongregacao, error: errorCongregacao } = await supabase
    .from('congregacao')
    .insert({
      nome: dados.nome,
      endereco: dados.endereco ?? null,
    })
    .select()
    .single()

  if (errorCongregacao || !novaCongregacao) {
    throw new Error('Falha ao criar congregação')
  }

  // 2. O usuário visitante será criado futuramente usando o Supabase Admin Auth API.
  // Por ora, retornamos apenas a congregação criada.

  return {
    idCongregacao: novaCongregacao.id_congregacao,
    nome: novaCongregacao.nome,
    endereco: novaCongregacao.endereco,
  }
}

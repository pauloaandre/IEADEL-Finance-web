'use server'

import { revalidatePath } from 'next/cache'
import { getSessionUser, requireAuth, requirePerfil } from '@/lib/session'
import {
  CreateCongregacaoSchema,
  type CreateCongregacaoInput,
  type CongregacaoResponse,
} from '@/lib/validations/congregacao'
import {
  criarCongregacao,
  listarCongregacoes,
  buscarCongregacaoPorId,
} from '@/lib/services/congregacao.service'

export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; details?: Record<string, string[]> }

/**
 * Server Action para criar congregação — restrita a SUPER_ADMIN.
 * Pode ser invocada diretamente por Server Components ou Client Components (via formulários / hooks).
 */
export async function criarCongregacaoAction(
  input: CreateCongregacaoInput
): Promise<ActionResult<CongregacaoResponse>> {
  try {
    const { user, error: authError } = await requireAuth()
    if (authError) {
      return { success: false, error: 'Usuário não autenticado.' }
    }

    const perfilError = requirePerfil(user, 'SUPER_ADMIN')
    if (perfilError) {
      return {
        success: false,
        error: 'Acesso negado. Apenas SUPER_ADMIN pode cadastrar congregações.',
      }
    }

    const validation = CreateCongregacaoSchema.safeParse(input)
    if (!validation.success) {
      return {
        success: false,
        error: 'Dados inválidos.',
        details: validation.error.flatten().fieldErrors,
      }
    }

    const novaCongregacao = await criarCongregacao(validation.data)

    revalidatePath('/congregacoes')
    revalidatePath('/api/congregacoes')

    return { success: true, data: novaCongregacao }
  } catch (error) {
    console.error('Erro na action criarCongregacaoAction:', error)
    return {
      success: false,
      error: 'Erro interno ao cadastrar a congregação.',
    }
  }
}

/**
 * Server Action para obter a lista de congregações no contexto do usuário atual.
 */
export async function listarCongregacoesAction(): Promise<
  ActionResult<CongregacaoResponse[]>
> {
  try {
    const user = await getSessionUser()
    const isSuperAdmin = user?.perfil === 'SUPER_ADMIN'

    const lista = await listarCongregacoes(isSuperAdmin)
    return { success: true, data: lista }
  } catch (error) {
    console.error('Erro na action listarCongregacoesAction:', error)
    return {
      success: false,
      error: 'Erro interno ao consultar congregações.',
    }
  }
}

/**
 * Server Action para obter os dados de uma congregação específica.
 */
export async function buscarCongregacaoPorIdAction(
  id: number
): Promise<ActionResult<CongregacaoResponse>> {
  try {
    const { user, error: authError } = await requireAuth()
    if (authError) {
      return { success: false, error: 'Usuário não autenticado.' }
    }

    const isSuperAdmin = user.perfil === 'SUPER_ADMIN'
    const congregacao = await buscarCongregacaoPorId(id, isSuperAdmin)

    if (!congregacao) {
      return { success: false, error: 'Congregação não encontrada.' }
    }

    return { success: true, data: congregacao }
  } catch (error) {
    console.error('Erro na action buscarCongregacaoPorIdAction:', error)
    return {
      success: false,
      error: 'Erro interno ao consultar congregação.',
    }
  }
}

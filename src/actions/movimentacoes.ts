'use server'

import { revalidatePath } from 'next/cache'
import { requireAuth } from '@/lib/session'
import {
  CreateMovimentacaoSchema,
  UpdateMovimentacaoSchema,
  type CreateMovimentacaoInput,
  type MovimentacaoResponse,
  type TipoMovimentacao,
} from '@/lib/validations/movimentacao'
import {
  listarPorMesAno,
  listarPorUsuario,
  buscarPorId,
  criarMovimentacao,
  atualizarMovimentacao,
  excluirMovimentacao,
  calcularTotaisMensais,
  calcularTotalGeral,
  NotFoundError,
  AccessDeniedError,
  BusinessRuleError,
} from '@/lib/services/movimentacao.service'

export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; details?: Record<string, string[]> }

export type TotaisResult = {
  dizimo: string
  oferta: string
  despesa: string
}

export type TotalGeralResult = {
  total: string
}

// ---------------------------------------------------------------------------

export async function listarMovimentacoesAction(
  tipo: TipoMovimentacao,
  mes: string,
  ano: string,
  idCongregacao?: number
): Promise<ActionResult<MovimentacaoResponse[]>> {
  try {
    const { user, error: authError } = await requireAuth()
    if (authError) return { success: false, error: 'Usuário não autenticado.' }

    const data = await listarPorMesAno(tipo, mes, ano, user, idCongregacao)
    return { success: true, data }
  } catch (error) {
    if (error instanceof AccessDeniedError) return { success: false, error: error.message }
    console.error('Erro em listarMovimentacoesAction:', error)
    return { success: false, error: 'Erro interno ao listar movimentações.' }
  }
}

export async function listarMovimentacoesPorUsuarioAction(
  usuarioId: string
): Promise<ActionResult<MovimentacaoResponse[]>> {
  try {
    const { user, error: authError } = await requireAuth()
    if (authError) return { success: false, error: 'Usuário não autenticado.' }

    const data = await listarPorUsuario(usuarioId, user)
    return { success: true, data }
  } catch (error) {
    if (error instanceof AccessDeniedError || error instanceof NotFoundError) {
      return { success: false, error: error.message }
    }
    console.error('Erro em listarMovimentacoesPorUsuarioAction:', error)
    return { success: false, error: 'Erro interno.' }
  }
}

export async function buscarMovimentacaoPorIdAction(
  id: number
): Promise<ActionResult<MovimentacaoResponse>> {
  try {
    const { user, error: authError } = await requireAuth()
    if (authError) return { success: false, error: 'Usuário não autenticado.' }

    const data = await buscarPorId(id, user)
    return { success: true, data }
  } catch (error) {
    if (error instanceof NotFoundError || error instanceof AccessDeniedError) {
      return { success: false, error: error.message }
    }
    console.error('Erro em buscarMovimentacaoPorIdAction:', error)
    return { success: false, error: 'Erro interno.' }
  }
}

export async function criarMovimentacaoAction(
  input: CreateMovimentacaoInput
): Promise<ActionResult<MovimentacaoResponse>> {
  try {
    const { user, error: authError } = await requireAuth()
    if (authError) return { success: false, error: 'Usuário não autenticado.' }

    const validation = CreateMovimentacaoSchema.safeParse(input)
    if (!validation.success) {
      return {
        success: false,
        error: 'Dados inválidos.',
        details: validation.error.flatten().fieldErrors,
      }
    }

    const data = await criarMovimentacao(validation.data, user)

    revalidatePath('/movimentacoes')

    return { success: true, data }
  } catch (error) {
    if (error instanceof AccessDeniedError || error instanceof BusinessRuleError) {
      return { success: false, error: error.message }
    }
    console.error('Erro em criarMovimentacaoAction:', error)
    return { success: false, error: 'Erro interno ao criar movimentação.' }
  }
}

export async function atualizarMovimentacaoAction(
  id: number,
  input: CreateMovimentacaoInput
): Promise<ActionResult<MovimentacaoResponse>> {
  try {
    const { user, error: authError } = await requireAuth()
    if (authError) return { success: false, error: 'Usuário não autenticado.' }

    const validation = UpdateMovimentacaoSchema.safeParse(input)
    if (!validation.success) {
      return {
        success: false,
        error: 'Dados inválidos.',
        details: validation.error.flatten().fieldErrors,
      }
    }

    const data = await atualizarMovimentacao(id, validation.data, user)

    revalidatePath('/movimentacoes')
    revalidatePath(`/movimentacoes/${id}`)

    return { success: true, data }
  } catch (error) {
    if (
      error instanceof NotFoundError ||
      error instanceof AccessDeniedError ||
      error instanceof BusinessRuleError
    ) {
      return { success: false, error: error.message }
    }
    console.error('Erro em atualizarMovimentacaoAction:', error)
    return { success: false, error: 'Erro interno ao atualizar movimentação.' }
  }
}

export async function excluirMovimentacaoAction(
  id: number
): Promise<ActionResult<null>> {
  try {
    const { user, error: authError } = await requireAuth()
    if (authError) return { success: false, error: 'Usuário não autenticado.' }

    await excluirMovimentacao(id, user)

    revalidatePath('/movimentacoes')

    return { success: true, data: null }
  } catch (error) {
    if (error instanceof NotFoundError || error instanceof AccessDeniedError) {
      return { success: false, error: error.message }
    }
    console.error('Erro em excluirMovimentacaoAction:', error)
    return { success: false, error: 'Erro interno ao excluir movimentação.' }
  }
}

export async function calcularTotaisMensaisAction(
  mes: string,
  ano: string,
  idCongregacao?: number
): Promise<ActionResult<TotaisResult>> {
  try {
    const { user, error: authError } = await requireAuth()
    if (authError) return { success: false, error: 'Usuário não autenticado.' }

    const data = await calcularTotaisMensais(mes, ano, user, idCongregacao)
    return { success: true, data }
  } catch (error) {
    if (error instanceof AccessDeniedError) return { success: false, error: error.message }
    console.error('Erro em calcularTotaisMensaisAction:', error)
    return { success: false, error: 'Erro interno ao calcular totais.' }
  }
}

export async function calcularTotalGeralAction(
  idCongregacao?: number
): Promise<ActionResult<TotalGeralResult>> {
  try {
    const { user, error: authError } = await requireAuth()
    if (authError) return { success: false, error: 'Usuário não autenticado.' }

    const data = await calcularTotalGeral(user, idCongregacao)
    return { success: true, data }
  } catch (error) {
    if (error instanceof AccessDeniedError) return { success: false, error: error.message }
    console.error('Erro em calcularTotalGeralAction:', error)
    return { success: false, error: 'Erro interno ao calcular total geral.' }
  }
}

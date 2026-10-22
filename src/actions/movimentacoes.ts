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
  listarDizimosObreirosGestor,
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

export async function listarDizimosObreirosGestorAction(
  mes: string,
  ano: string,
  idCongregacao?: number
): Promise<ActionResult<(MovimentacaoResponse & { nomeCongregacao?: string })[]>> {
  try {
    const { user, error: authError } = await requireAuth()
    if (authError) return { success: false, error: 'Usuário não autenticado.' }

    const data = await listarDizimosObreirosGestor(mes, ano, user, idCongregacao)
    return { success: true, data }
  } catch (error) {
    if (error instanceof AccessDeniedError) return { success: false, error: error.message }
    console.error('Erro em listarDizimosObreirosGestorAction:', error)
    return { success: false, error: 'Erro interno ao listar dízimos de obreiros.' }
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

// ---------------------------------------------------------------------------
// Dados específicos para o relatório da congregação
// ---------------------------------------------------------------------------

import { createClient } from '@/utils/supabase/server'

export interface RelatorioMovItem {
  id: number
  descricao: string
  valor: number
  data: string
  nomeUsuario: string | null
  tipoContribuinte: string | null
  categoriasSistema: string | null
}

export interface RelatorioData {
  dizimosNormais: RelatorioMovItem[]
  dizimosObreiros: RelatorioMovItem[]
  ofertas: RelatorioMovItem[]
  despesas: RelatorioMovItem[]
  competenciaFechada: boolean
  repasse10: number
}

export async function listarDadosRelatorioAction(
  mes: string,
  ano: string,
  idCongregacao: number
): Promise<ActionResult<RelatorioData>> {
  try {
    const { user, error: authError } = await requireAuth()
    if (authError) return { success: false, error: 'Usuário não autenticado.' }

    const supabase = await createClient()
    const mesNorm = mes.padStart(2, '0')
    const dataInicio = `${ano}-${mesNorm}-01`
    const dataFim = parseInt(mes) === 12
      ? `${parseInt(ano) + 1}-01-01`
      : `${ano}-${String(parseInt(mes) + 1).padStart(2, '0')}-01`

    // Fetch all movements for this congregation and period with contributor type
    const { data: movs, error: movError } = await supabase
      .from('movimentacao')
      .select('id_mov, descricao, valor, data, tipo, categoria_sistema, gerado_automaticamente, usuario(id_usuario, nome, tipo_contribuinte)')
      .eq('id_congregacao', idCongregacao)
      .gte('data', dataInicio)
      .lt('data', dataFim)
      .order('data', { ascending: true })

    if (movError) throw new Error('Falha ao listar movimentações do relatório')

    const toItem = (m: any): RelatorioMovItem => ({
      id: m.id_mov,
      descricao: m.descricao,
      valor: Number(m.valor),
      data: m.data,
      nomeUsuario: m.usuario?.nome ?? null,
      tipoContribuinte: m.usuario?.tipo_contribuinte ?? null,
      categoriasSistema: m.categoria_sistema ?? null,
    })

    const allMovs = (movs || []) as any[]

    // Split tithes
    const dizimosNormais = allMovs
      .filter(m => m.tipo === 'DIZIMO' && m.usuario?.tipo_contribuinte !== 'OBREIRO')
      .map(toItem)

    const dizimosObreiros = allMovs
      .filter(m => m.tipo === 'DIZIMO' && m.usuario?.tipo_contribuinte === 'OBREIRO')
      .map(toItem)

    // Ofertas: exclude auto-generated 10% entries
    const ofertas = allMovs
      .filter(m => m.tipo === 'OFERTA' && m.categoria_sistema !== 'REPASSE_10_ENTRADA')
      .map(toItem)

    // Despesas: exclude auto-generated 10% exits
    const despesasNormais = allMovs
      .filter(m => m.tipo === 'DESPESA' && m.categoria_sistema !== 'REPASSE_10_SAIDA')
      .map(toItem)

    // Repasse 10%
    const repasseSaida = allMovs.find(
      m => m.tipo === 'DESPESA' && m.categoria_sistema === 'REPASSE_10_SAIDA'
    )
    const repasse10 = repasseSaida ? Number(repasseSaida.valor) : 0

    // Fechamento status
    const { data: fech } = await supabase
      .from('fechamento_mensal')
      .select('status')
      .eq('id_congregacao', idCongregacao)
      .eq('mes', parseInt(mes))
      .eq('ano', parseInt(ano))
      .maybeSingle()

    const competenciaFechada = fech?.status === 'FECHADO'

    return {
      success: true,
      data: {
        dizimosNormais,
        dizimosObreiros,
        ofertas,
        despesas: despesasNormais,
        competenciaFechada,
        repasse10,
      }
    }
  } catch (error) {
    console.error('Erro em listarDadosRelatorioAction:', error)
    return { success: false, error: 'Erro interno ao gerar dados do relatório.' }
  }
}


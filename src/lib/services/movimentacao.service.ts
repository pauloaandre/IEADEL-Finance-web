import { createClient } from '@/utils/supabase/server'
import type { SessionUser } from '@/lib/session'
import type {
  MovimentacaoResponse,
  CreateMovimentacaoInput,
  TipoMovimentacao,
} from '@/lib/validations/movimentacao'

// =============================================================================
// Erros de domínio
// =============================================================================

export class NotFoundError extends Error {
  constructor(message = 'Movimentação não encontrada.') {
    super(message)
    this.name = 'NotFoundError'
  }
}

export class AccessDeniedError extends Error {
  constructor(message = 'Você não tem permissão para acessar esta movimentação.') {
    super(message)
    this.name = 'AccessDeniedError'
  }
}

export class BusinessRuleError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BusinessRuleError'
  }
}

// =============================================================================
// Conversão de entidade para DTO
// =============================================================================

function toMovimentacaoResponse(m: any): MovimentacaoResponse {
  return {
    id: m.id_mov,
    descricao: m.descricao,
    valor: Number(m.valor).toFixed(2),
    data: m.data, 
    tipo: m.tipo as TipoMovimentacao,
    idUsuario: m.usuario?.id_usuario ?? m.id_usuario ?? null,
    nomeUsuario: m.usuario?.nome ?? null,
    idCongregacao: m.id_congregacao,
    dataRegistro: m.data_registro ?? null,
  }
}

// =============================================================================
// Proteção IDOR: resolve o congregacaoId efetivo
// =============================================================================

export function resolveIdorCongregacao(
  logado: SessionUser,
  idCongregacaoParam?: number
): { congregacaoId: number; error: null } | { congregacaoId: null; error: string } {
  if (logado.perfil === 'SUPER_ADMIN') {
    return { congregacaoId: idCongregacaoParam ?? 0, error: null }
  }

  if (!logado.congregacaoId) {
    return { congregacaoId: null, error: 'Usuário não vinculado a uma congregação.' }
  }

  return { congregacaoId: logado.congregacaoId, error: null }
}

// =============================================================================
// Normaliza mês
// =============================================================================
function normalizeMes(mes: string): string {
  return mes.length === 1 ? `0${mes}` : mes
}

// =============================================================================
// Serviços (Com Supabase RLS)
// =============================================================================

export async function listarPorMesAno(
  tipo: TipoMovimentacao,
  mes: string,
  ano: string,
  logado: SessionUser,
  idCongregacaoParam?: number
): Promise<MovimentacaoResponse[]> {
  const { congregacaoId, error } = resolveIdorCongregacao(logado, idCongregacaoParam)
  if (error) throw new AccessDeniedError(error)

  const mesNorm = normalizeMes(mes)
  const dataInicio = `${ano}-${mesNorm}-01`
  const dataFim = parseInt(mes) === 12
    ? `${parseInt(ano) + 1}-01-01`
    : `${ano}-${String(parseInt(mes) + 1).padStart(2, '0')}-01`

  const supabase = await createClient()
  let query = supabase
    .from('movimentacao')
    .select('*, usuario(id_usuario, nome)')
    .eq('tipo', tipo)
    .gte('data', dataInicio)
    .lt('data', dataFim)
    .order('data', { ascending: true })

  if (congregacaoId !== 0) {
    query = query.eq('id_congregacao', congregacaoId)
  }

  const { data, error: dbError } = await query
  if (dbError) throw new Error('Falha ao listar movimentações')

  return (data || []).map(toMovimentacaoResponse)
}

export async function calcularTotaisMensais(
  mes: string,
  ano: string,
  logado: SessionUser,
  idCongregacaoParam?: number
): Promise<{ dizimo: string; oferta: string; despesa: string }> {
  const { congregacaoId, error } = resolveIdorCongregacao(logado, idCongregacaoParam)
  if (error) throw new AccessDeniedError(error)

  const mesNorm = normalizeMes(mes)
  const dataInicio = `${ano}-${mesNorm}-01`
  const dataFim = parseInt(mes) === 12
    ? `${parseInt(ano) + 1}-01-01`
    : `${ano}-${String(parseInt(mes) + 1).padStart(2, '0')}-01`

  const supabase = await createClient()
  let query = supabase
    .from('movimentacao')
    .select('valor, tipo')
    .gte('data', dataInicio)
    .lt('data', dataFim)

  if (congregacaoId !== 0) {
    query = query.eq('id_congregacao', congregacaoId)
  }

  const { data } = await query
  
  let dizimo = 0, oferta = 0, despesa = 0
  for (const m of data || []) {
    if (m.tipo === 'DIZIMO') dizimo += Number(m.valor)
    if (m.tipo === 'OFERTA') oferta += Number(m.valor)
    if (m.tipo === 'DESPESA') despesa += Number(m.valor)
  }

  return { 
    dizimo: dizimo.toFixed(2), 
    oferta: oferta.toFixed(2), 
    despesa: despesa.toFixed(2) 
  }
}

export async function calcularTotalGeral(
  logado: SessionUser,
  idCongregacaoParam?: number
): Promise<{ total: string }> {
  const { congregacaoId, error } = resolveIdorCongregacao(logado, idCongregacaoParam)
  if (error) throw new AccessDeniedError(error)

  const supabase = await createClient()
  let query = supabase.from('movimentacao').select('valor, tipo')
  
  if (congregacaoId !== 0) {
    query = query.eq('id_congregacao', congregacaoId)
  }

  const { data } = await query
  
  let total = 0
  for (const m of data || []) {
    if (m.tipo === 'DIZIMO') total += Number(m.valor)
    if (m.tipo === 'OFERTA') total += Number(m.valor)
    if (m.tipo === 'DESPESA') total -= Number(m.valor)
  }

  return { total: total.toFixed(2) }
}

export async function buscarPorId(
  id: number,
  logado: SessionUser
): Promise<MovimentacaoResponse> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('movimentacao')
    .select('*, usuario(id_usuario, nome)')
    .eq('id_mov', id)
    .single()

  if (error || !data) throw new NotFoundError()

  // Verificação explícita IDOR na camada de serviço (defesa em profundidade)
  if (logado.perfil !== 'SUPER_ADMIN') {
    if (data.id_congregacao !== logado.congregacaoId) {
      throw new AccessDeniedError('Você não tem permissão para acessar movimentações de outra congregação.')
    }
    if (logado.perfil === 'USER' && data.id_usuario !== logado.id) {
      throw new AccessDeniedError('Você só pode visualizar suas próprias movimentações.')
    }
  }

  return toMovimentacaoResponse(data)
}

export async function listarPorUsuario(
  usuarioId: string,
  logado: SessionUser
): Promise<MovimentacaoResponse[]> {
  // Usuário comum só pode listar suas próprias movimentações
  if (logado.perfil === 'USER' && usuarioId !== logado.id) {
    throw new AccessDeniedError('Você só pode visualizar suas próprias movimentações.')
  }

  const supabase = await createClient()
  let query = supabase
    .from('movimentacao')
    .select('*, usuario(id_usuario, nome)')
    .eq('id_usuario', usuarioId)

  // Se não for SUPER_ADMIN, restringe também à congregação do usuário logado
  if (logado.perfil !== 'SUPER_ADMIN') {
    query = query.eq('id_congregacao', logado.congregacaoId)
  }

  const { data, error } = await query.order('data', { ascending: true })

  if (error) throw new Error('Falha ao listar por usuário')
  return (data || []).map(toMovimentacaoResponse)
}

export async function criarMovimentacao(
  dto: CreateMovimentacaoInput,
  logado: SessionUser
): Promise<MovimentacaoResponse> {
  if (!logado.congregacaoId) {
    throw new BusinessRuleError('Usuário logado sem congregação não pode criar movimentação.')
  }

  const supabase = await createClient()
  let usuarioId: string | null = null

  if (dto.isVisitante) {
    const { data: visitante } = await supabase
      .from('usuario')
      .select('id_usuario')
      .eq('id_congregacao', logado.congregacaoId)
      .eq('ativo', false)
      .ilike('nome', 'Visitante%')
      .limit(1)
      .single()
      
    if (!visitante) throw new BusinessRuleError('Usuário Visitante não encontrado para esta congregação.')
    usuarioId = visitante.id_usuario
  } else if (dto.usuarioId) {
    usuarioId = dto.usuarioId
  }

  const { data: criada, error } = await supabase
    .from('movimentacao')
    .insert({
      descricao: dto.descricao ?? null,
      valor: dto.valor,
      data: dto.data,
      tipo: dto.tipo,
      id_congregacao: logado.congregacaoId,
      id_usuario: usuarioId,
    })
    .select('*, usuario(id_usuario, nome)')
    .single()

  if (error || !criada) throw new Error('Erro ao criar movimentação')
  return toMovimentacaoResponse(criada)
}

export async function atualizarMovimentacao(
  id: number,
  dto: CreateMovimentacaoInput,
  logado: SessionUser
): Promise<MovimentacaoResponse> {
  if (logado.perfil === 'USER') {
    throw new AccessDeniedError('Usuários comuns não têm permissão para editar movimentações.')
  }

  const supabase = await createClient()
  let usuarioId: string | null = null

  if (dto.isVisitante) {
    const { data: visitante } = await supabase
      .from('usuario')
      .select('id_usuario')
      .eq('id_congregacao', logado.congregacaoId)
      .eq('ativo', false)
      .ilike('nome', 'Visitante%')
      .limit(1)
      .single()
      
    if (!visitante) throw new BusinessRuleError('Usuário Visitante não encontrado para esta congregação.')
    usuarioId = visitante.id_usuario
  } else if (dto.usuarioId) {
    usuarioId = dto.usuarioId
  }

  let query = supabase
    .from('movimentacao')
    .update({
      descricao: dto.descricao ?? null,
      valor: dto.valor,
      data: dto.data,
      tipo: dto.tipo,
      id_usuario: usuarioId,
    })
    .eq('id_mov', id)

  // Se for ADMIN, garante que a alteração ocorre estritamente dentro da sua própria congregação
  if (logado.perfil === 'ADMIN') {
    query = query.eq('id_congregacao', logado.congregacaoId)
  }

  const { data: atualizada, error } = await query
    .select('*, usuario(id_usuario, nome)')
    .single()

  if (error || !atualizada) throw new Error('Erro ao atualizar movimentação')
  return toMovimentacaoResponse(atualizada)
}

export async function excluirMovimentacao(
  id: number,
  logado: SessionUser
): Promise<void> {
  if (logado.perfil === 'USER') {
    throw new AccessDeniedError('Usuários comuns não têm permissão para excluir movimentações.')
  }

  const supabase = await createClient()
  let query = supabase.from('movimentacao').delete().eq('id_mov', id)

  // Se for ADMIN, garante que a exclusão ocorre estritamente dentro da sua própria congregação
  if (logado.perfil === 'ADMIN') {
    query = query.eq('id_congregacao', logado.congregacaoId)
  }

  const { error } = await query
  if (error) throw new Error('Falha ao excluir')
}

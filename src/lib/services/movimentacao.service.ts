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
    idCongregacaoDestino: m.id_congregacao_destino ?? null,
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
  if (logado.perfil === 'SUPER_ADMIN' || logado.perfil === 'GESTOR') {
    return { congregacaoId: idCongregacaoParam ?? logado.congregacaoId ?? 0, error: null }
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

export async function listarDizimosObreirosGestor(
  mes: string,
  ano: string,
  logado: SessionUser,
  idCongregacaoParam?: number
): Promise<MovimentacaoResponse[]> {
  if (logado.perfil !== 'GESTOR' && logado.perfil !== 'SUPER_ADMIN') {
    throw new AccessDeniedError('Apenas GESTOR ou SUPER_ADMIN pode visualizar o painel geral de obreiros.')
  }

  const mesNorm = normalizeMes(mes)
  const dataInicio = `${ano}-${mesNorm}-01`
  const dataFim = parseInt(mes) === 12
    ? `${parseInt(ano) + 1}-01-01`
    : `${ano}-${String(parseInt(mes) + 1).padStart(2, '0')}-01`

  const supabase = await createClient()
  
  // We need to fetch tithes where the user's tipo_contribuinte is OBREIRO
  let query = supabase
    .from('movimentacao')
    .select('*, usuario!inner(id_usuario, nome, tipo_contribuinte), congregacao(nome)')
    .eq('tipo', 'DIZIMO')
    .eq('usuario.tipo_contribuinte', 'OBREIRO')
    .gte('data', dataInicio)
    .lt('data', dataFim)
    .order('data', { ascending: true })

  if (idCongregacaoParam && idCongregacaoParam > 0) {
    query = query.eq('id_congregacao', idCongregacaoParam)
  }

  const { data, error: dbError } = await query
  if (dbError) {
    console.error(dbError)
    throw new Error('Falha ao listar dízimos de obreiros')
  }

  return (data || []).map((m: any) => ({
    ...toMovimentacaoResponse(m),
    nomeCongregacao: m.congregacao?.nome // Adiciona o nome da congregação
  }))
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
    .select('valor, tipo, id_congregacao, categoria_sistema, usuario(tipo_contribuinte)')
    .gte('data', dataInicio)
    .lt('data', dataFim)

  if (congregacaoId !== 0) {
    query = query.eq('id_congregacao', congregacaoId)
  }

  const { data, error: qError } = await query
  if (qError) {
    console.error("Erro no calcularTotaisMensais:", qError)
  }
  
  let dizimo = 0, oferta = 0, despesa = 0
  for (const m of (data || []) as any[]) {
    if (m.tipo === 'DIZIMO') {
      // Dízimos de obreiros não compõem o saldo de nenhuma congregação
      const isObreiro = m.usuario?.tipo_contribuinte === 'OBREIRO'
      if (!isObreiro) {
        dizimo += Number(m.valor)
      }
    }
    if (m.tipo === 'OFERTA') oferta += Number(m.valor)
    if (m.tipo === 'DESPESA') despesa += Number(m.valor)
  }

  return { 
    dizimo: dizimo.toFixed(2), 
    oferta: oferta.toFixed(2), 
    despesa: despesa.toFixed(2) 
  }
}

async function checarMesFechado(supabase: any, dataIso: string, idCongregacao: number) {
  const data = new Date(dataIso + 'T12:00:00Z')
  const mes = data.getUTCMonth() + 1
  const ano = data.getUTCFullYear()
  const { data: fechamento } = await supabase
    .from('fechamento_mensal')
    .select('status')
    .eq('mes', mes)
    .eq('ano', ano)
    .eq('id_congregacao', idCongregacao)
    .maybeSingle()

  if (fechamento?.status === 'FECHADO') {
    throw new BusinessRuleError('Esta competência já foi fechada e não pode ser alterada.')
  }
}

export async function calcularTotalGeral(
  logado: SessionUser,
  idCongregacaoParam?: number
): Promise<{ total: string }> {
  const { congregacaoId, error } = resolveIdorCongregacao(logado, idCongregacaoParam)
  if (error) throw new AccessDeniedError(error)

  const supabase = await createClient()
  let query = supabase.from('movimentacao').select('valor, tipo, id_congregacao, categoria_sistema, usuario(tipo_contribuinte)')
  
  if (congregacaoId !== 0) {
    query = query.eq('id_congregacao', congregacaoId)
  }

  const { data, error: qError } = await query
  if (qError) {
    console.error("Erro no calcularTotalGeral:", qError)
  }
  
  let total = 0
  for (const m of (data || []) as any[]) {
    if (m.tipo === 'DIZIMO') {
      // Dízimos de obreiros não compõem o saldo de nenhuma congregação
      const isObreiro = m.usuario?.tipo_contribuinte === 'OBREIRO'
      if (!isObreiro) {
        total += Number(m.valor)
      }
    }
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
  if (logado.perfil === 'GESTOR' && logado.congregacaoId !== 1) {
    throw new AccessDeniedError('GESTOR pode realizar operações financeiras somente na Sede.')
  }

  if (!logado.congregacaoId) {
    throw new BusinessRuleError('Usuário logado sem congregação não pode criar movimentação.')
  }

  const supabase = await createClient()
  let usuarioId: string | null = null
  let idCongregacaoDestino: number | null = null

  if (!dto.isVisitante && dto.usuarioId) {
    usuarioId = dto.usuarioId

    // Regra de obreiro: SOMENTE GESTOR ou SUPER_ADMIN pode lançar dízimo de obreiro
    if (dto.tipo === 'DIZIMO') {
      const { data: contribuinte } = await supabase
        .from('usuario')
        .select('tipo_contribuinte')
        .eq('id_usuario', dto.usuarioId)
        .single()

      if (contribuinte?.tipo_contribuinte === 'OBREIRO') {
        if (logado.perfil !== 'GESTOR' && logado.perfil !== 'SUPER_ADMIN') {
          throw new AccessDeniedError('Apenas GESTOR ou SUPER_ADMIN pode registrar dízimo de obreiro.')
        }
        // ADMIN não pode mais lançar dízimo de obreiro — rejeitar no service
        // GESTOR lança na congregação de origem informada pelo DTO ou na própria congregação
        const idCongOrigem = dto.idCongregacaoDestino ?? logado.congregacaoId

        const { data: rpcData, error: rpcError } = await supabase.rpc('fn_lancar_dizimo_obreiro', {
          p_descricao: dto.descricao ?? null,
          p_valor: dto.valor,
          p_data: dto.data,
          p_id_congregacao: idCongOrigem,
          p_id_usuario: usuarioId,
          p_id_congregacao_destino: idCongOrigem
        })

        if (rpcError || !rpcData) throw new Error('Erro ao criar movimentação de obreiro: ' + (rpcError?.message ?? ''))
        
        const { data: criada, error: fetchError } = await supabase
          .from('movimentacao')
          .select('*, usuario(id_usuario, nome)')
          .eq('id_mov', rpcData.id_mov)
          .single()
          
        if (fetchError || !criada) throw new Error('Erro ao buscar movimentação de obreiro criada')
        return toMovimentacaoResponse(criada)
      }
    }
  }

  // Se não foi definido pelo obreiro logic, destino é a própria congregação
  if (idCongregacaoDestino === null) {
    idCongregacaoDestino = logado.congregacaoId
  }

  // Permite override explícito pelo DTO (SUPER_ADMIN pode forçar destino)
  if (dto.idCongregacaoDestino && logado.perfil === 'SUPER_ADMIN') {
    idCongregacaoDestino = dto.idCongregacaoDestino
  }

  await checarMesFechado(supabase, dto.data, logado.congregacaoId)

  const { data: criada, error } = await supabase
    .from('movimentacao')
    .insert({
      descricao: dto.descricao ?? null,
      valor: dto.valor,
      data: dto.data,
      tipo: dto.tipo,
      id_congregacao: logado.congregacaoId,
      id_usuario: usuarioId,
      id_congregacao_destino: idCongregacaoDestino,
      gerado_automaticamente: false
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
  if (logado.perfil === 'GESTOR' && logado.congregacaoId !== 1) {
    throw new AccessDeniedError('GESTOR pode realizar operações financeiras somente na Sede.')
  }

  const supabase = await createClient()
  let usuarioId: string | null = null

  if (!dto.isVisitante && dto.usuarioId) {
    usuarioId = dto.usuarioId
  }

  const { data: movExistente } = await supabase.from('movimentacao').select('id_congregacao, gerado_automaticamente').eq('id_mov', id).single()
  if (movExistente) {
    if (movExistente.gerado_automaticamente) {
      throw new BusinessRuleError('Lançamentos automáticos não podem ser alterados manualmente.')
    }
    await checarMesFechado(supabase, dto.data, movExistente.id_congregacao)
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
  if (logado.perfil === 'GESTOR' && logado.congregacaoId !== 1) {
    throw new AccessDeniedError('GESTOR pode realizar operações financeiras somente na Sede.')
  }

  const supabase = await createClient()
  const { data: movExistente } = await supabase.from('movimentacao').select('data, tipo, id_congregacao, id_usuario, gerado_automaticamente, categoria_sistema').eq('id_mov', id).single()
  
  if (movExistente) {
    if (movExistente.gerado_automaticamente) {
      throw new BusinessRuleError('Lançamentos automáticos não podem ser excluídos manualmente.')
    }
    await checarMesFechado(supabase, movExistente.data, movExistente.id_congregacao)

    // Se for dízimo de obreiro, somente GESTOR ou SUPER_ADMIN pode excluir
    if (movExistente.tipo === 'DIZIMO' && movExistente.id_usuario) {
      const { data: user } = await supabase.from('usuario').select('tipo_contribuinte').eq('id_usuario', movExistente.id_usuario).single()
      if (user?.tipo_contribuinte === 'OBREIRO') {
        if (logado.perfil !== 'GESTOR' && logado.perfil !== 'SUPER_ADMIN') {
          throw new AccessDeniedError('Apenas GESTOR ou SUPER_ADMIN pode excluir dízimo de obreiro.')
        }
        const { error } = await supabase.rpc('fn_excluir_dizimo_obreiro', { p_id_mov: id })
        if (error) throw new Error('Falha ao excluir dízimo de obreiro: ' + error.message)
        return
      }
    }
  }

  let query = supabase.from('movimentacao').delete().eq('id_mov', id)

  // Se for ADMIN, garante que a exclusão ocorre estritamente dentro da sua própria congregação
  if (logado.perfil === 'ADMIN') {
    query = query.eq('id_congregacao', logado.congregacaoId)
  }

  const { error } = await query
  if (error) throw new Error('Falha ao excluir')
}

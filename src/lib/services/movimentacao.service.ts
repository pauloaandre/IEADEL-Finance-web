import { Decimal } from '@prisma/client/runtime/library'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
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

function toMovimentacaoResponse(m: {
  id: number
  descricao: string | null
  valor: Decimal
  data: Date
  tipo: string
  dataRegistro: Date | null
  congregacaoId: number
  usuario?: { id: number; nome: string } | null
}): MovimentacaoResponse {
  return {
    id: m.id,
    descricao: m.descricao,
    valor: m.valor.toFixed(2),
    data: m.data.toISOString().split('T')[0], // YYYY-MM-DD
    tipo: m.tipo as TipoMovimentacao,
    idUsuario: m.usuario?.id ?? null,
    nomeUsuario: m.usuario?.nome ?? null,
    idCongregacao: m.congregacaoId,
    dataRegistro: m.dataRegistro?.toISOString() ?? null,
  }
}

// =============================================================================
// Proteção IDOR: resolve o congregacaoId efetivo
// Replica exatamente a lógica dos controllers do Spring Boot
// =============================================================================

export function resolveIdorCongregacao(
  logado: SessionUser,
  idCongregacaoParam?: number
): { congregacaoId: number; error: null } | { congregacaoId: null; error: string } {
  if (logado.perfil === 'SUPER_ADMIN') {
    // SUPER_ADMIN pode ver tudo (0) ou uma congregação específica
    return { congregacaoId: idCongregacaoParam ?? 0, error: null }
  }

  // Não é SUPER_ADMIN: ignora o parâmetro e força a congregação do usuário logado
  if (!logado.congregacaoId) {
    return {
      congregacaoId: null,
      error: 'Usuário não vinculado a uma congregação.',
    }
  }

  return { congregacaoId: logado.congregacaoId, error: null }
}

// =============================================================================
// Validação de acesso a uma movimentação específica
// Replica validarAcesso() do MovimentacaoService do Spring Boot
// =============================================================================

function validarAcesso(
  movimentacao: {
    congregacaoId: number
    usuarioId: number | null
  },
  logado: SessionUser
): void {
  if (logado.perfil === 'SUPER_ADMIN') return

  const logadoId = Number(logado.id)

  // Próprio usuário da movimentação
  if (movimentacao.usuarioId !== null && movimentacao.usuarioId === logadoId) return

  // ADMIN da mesma congregação
  if (
    logado.perfil === 'ADMIN' &&
    logado.congregacaoId !== null &&
    movimentacao.congregacaoId === logado.congregacaoId
  ) {
    return
  }

  throw new AccessDeniedError()
}

// =============================================================================
// Normaliza mês: "3" → "03" (mesmo comportamento do Spring Boot)
// =============================================================================
function normalizeMes(mes: string): string {
  return mes.length === 1 ? `0${mes}` : mes
}

// =============================================================================
// Serviços
// =============================================================================

/**
 * Lista movimentações por tipo, mês, ano e congregação.
 * Com proteção IDOR: se não for SUPER_ADMIN, força a congregação do usuário logado.
 */
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

  const dataInicio = new Date(`${ano}-${mesNorm}-01`)
  const dataFim =
    parseInt(mes) === 12
      ? new Date(`${parseInt(ano) + 1}-01-01`)
      : new Date(`${ano}-${String(parseInt(mes) + 1).padStart(2, '0')}-01`)

  const whereMovimentacao: Prisma.MovimentacaoWhereInput = {
    tipo,
    data: { gte: dataInicio, lt: dataFim },
  }
  if (congregacaoId !== 0) {
    whereMovimentacao.congregacaoId = congregacaoId as number
  }

  const movimentacoes = await prisma.movimentacao.findMany({
    where: whereMovimentacao,
    include: {
      usuario: { select: { id: true, nome: true } },
    },
    orderBy: { data: 'asc' },
  })

  return movimentacoes.map(toMovimentacaoResponse)
}

/**
 * Calcula totais mensais por tipo (dizimo, oferta, despesa).
 * Com proteção IDOR.
 */
export async function calcularTotaisMensais(
  mes: string,
  ano: string,
  logado: SessionUser,
  idCongregacaoParam?: number
): Promise<{ dizimo: string; oferta: string; despesa: string }> {
  const { congregacaoId, error } = resolveIdorCongregacao(logado, idCongregacaoParam)
  if (error) throw new AccessDeniedError(error)

  const mesNorm = normalizeMes(mes)
  const dataInicio = new Date(`${ano}-${mesNorm}-01`)
  const dataFim =
    parseInt(mes) === 12
      ? new Date(`${parseInt(ano) + 1}-01-01`)
      : new Date(`${ano}-${String(parseInt(mes) + 1).padStart(2, '0')}-01`)

  const baseWhere = {
    data: { gte: dataInicio, lt: dataFim },
    ...(congregacaoId !== 0 ? { congregacaoId } : {}),
  }

  const calcular = async (tipo: string): Promise<string> => {
    const whereCalc: Prisma.MovimentacaoWhereInput = {
      tipo,
      data: { gte: dataInicio, lt: dataFim },
    }
    if (congregacaoId !== 0) {
      whereCalc.congregacaoId = congregacaoId as number
    }
    const result = await prisma.movimentacao.aggregate({
      _sum: { valor: true },
      where: whereCalc,
    })
    return (result._sum?.valor ?? new Decimal(0)).toFixed(2)
  }

  const [dizimo, oferta, despesa] = await Promise.all([
    calcular('DIZIMO'),
    calcular('OFERTA'),
    calcular('DESPESA'),
  ])

  return { dizimo, oferta, despesa }
}

/**
 * Calcula o total geral (dízimos + ofertas - despesas) por congregação.
 * Replica calcularTotalGeralPorCongregacao() do Spring Boot.
 */
export async function calcularTotalGeral(
  logado: SessionUser,
  idCongregacaoParam?: number
): Promise<{ total: string }> {
  const { congregacaoId, error } = resolveIdorCongregacao(logado, idCongregacaoParam)
  if (error) throw new AccessDeniedError(error)

  const geralWhere = congregacaoId !== 0 ? { congregacaoId } : {}

  const calcular = async (tipo: string): Promise<Decimal> => {
    const whereCalc: Prisma.MovimentacaoWhereInput = { tipo }
    if (congregacaoId !== 0) {
      whereCalc.congregacaoId = congregacaoId as number
    }
    const result = await prisma.movimentacao.aggregate({
      _sum: { valor: true },
      where: whereCalc,
    })
    return result._sum?.valor ?? new Decimal(0)
  }

  const [dizimos, ofertas, despesas] = await Promise.all([
    calcular('DIZIMO'),
    calcular('OFERTA'),
    calcular('DESPESA'),
  ])

  const total = dizimos.plus(ofertas).minus(despesas)
  return { total: total.toFixed(2) }
}

/**
 * Busca uma movimentação por ID com controle de acesso.
 */
export async function buscarPorId(
  id: number,
  logado: SessionUser
): Promise<MovimentacaoResponse> {
  const mov = await prisma.movimentacao.findUnique({
    where: { id },
    include: { usuario: { select: { id: true, nome: true } } },
  })

  if (!mov) throw new NotFoundError()

  validarAcesso(mov, logado)

  return toMovimentacaoResponse(mov)
}

/**
 * Lista movimentações por usuário com controle de acesso.
 * Replica listarPorUsuario() do MovimentacaoService do Spring Boot.
 */
export async function listarPorUsuario(
  usuarioId: number,
  logado: SessionUser
): Promise<MovimentacaoResponse[]> {
  const logadoId = Number(logado.id)

  // Valida acesso: só pode ver movimentações de outro usuário se for SUPER_ADMIN ou ADMIN da mesma congregação
  if (logado.perfil !== 'SUPER_ADMIN' && logadoId !== usuarioId) {
    const solicitado = await prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: { congregacaoId: true },
    })

    if (!solicitado) throw new NotFoundError('Usuário não encontrado.')

    if (
      logado.perfil !== 'ADMIN' ||
      logado.congregacaoId === null ||
      solicitado.congregacaoId === null ||
      logado.congregacaoId !== solicitado.congregacaoId
    ) {
      throw new AccessDeniedError('Você não tem permissão para acessar os dados deste usuário.')
    }
  }

  const movimentacoes = await prisma.movimentacao.findMany({
    where: { usuarioId },
    include: { usuario: { select: { id: true, nome: true } } },
    orderBy: { data: 'asc' },
  })

  return movimentacoes.map(toMovimentacaoResponse)
}

/**
 * Cria nova movimentação — restrito a ADMIN+.
 * Replica criar() do MovimentacaoService do Spring Boot.
 */
export async function criarMovimentacao(
  dto: CreateMovimentacaoInput,
  logado: SessionUser
): Promise<MovimentacaoResponse> {
  if (!logado.congregacaoId) {
    throw new BusinessRuleError('Usuário logado sem congregação não pode criar movimentação.')
  }

  let usuarioId: number | null = null

  if (dto.isVisitante) {
    // Busca o usuário Visitante da congregação do logado
    const visitante = await prisma.usuario.findFirst({
      where: {
        congregacaoId: logado.congregacaoId,
        nome: { startsWith: 'Visitante' },
        ativo: false,
      },
      select: { id: true },
    })
    if (!visitante) {
      throw new BusinessRuleError('Usuário Visitante não encontrado para esta congregação.')
    }
    usuarioId = visitante.id
  } else if (dto.usuarioId) {
    const dizimista = await prisma.usuario.findUnique({
      where: { id: dto.usuarioId },
      select: { id: true, congregacaoId: true },
    })

    if (!dizimista) throw new BusinessRuleError('Usuário dizimista não encontrado.')

    // ADMIN só pode criar movimentação para usuários da sua congregação
    if (logado.perfil !== 'SUPER_ADMIN') {
      if (dizimista.congregacaoId !== logado.congregacaoId) {
        throw new AccessDeniedError(
          'Você só pode registrar movimentações para usuários da sua congregação.'
        )
      }
    }

    usuarioId = dizimista.id
  }

  const criada = await prisma.movimentacao.create({
    data: {
      descricao: dto.descricao ?? null,
      valor: dto.valor,
      data: new Date(dto.data),
      tipo: dto.tipo,
      congregacaoId: logado.congregacaoId,
      usuarioId,
    },
    include: { usuario: { select: { id: true, nome: true } } },
  })

  return toMovimentacaoResponse(criada)
}

/**
 * Atualiza movimentação existente — verifica acesso e regras de negócio.
 * Replica atualizar() do MovimentacaoService do Spring Boot.
 */
export async function atualizarMovimentacao(
  id: number,
  dto: CreateMovimentacaoInput,
  logado: SessionUser
): Promise<MovimentacaoResponse> {
  const existente = await prisma.movimentacao.findUnique({
    where: { id },
    include: { usuario: { select: { id: true, nome: true } } },
  })

  if (!existente) throw new NotFoundError()

  validarAcesso(existente, logado)

  let usuarioId: number | null = null

  if (dto.isVisitante) {
    if (!existente.congregacaoId) {
      throw new BusinessRuleError('Movimentação sem congregação não pode ter visitante.')
    }
    const visitante = await prisma.usuario.findFirst({
      where: {
        congregacaoId: existente.congregacaoId,
        nome: { startsWith: 'Visitante' },
        ativo: false,
      },
      select: { id: true },
    })
    if (!visitante) throw new BusinessRuleError('Usuário Visitante não encontrado para esta congregação.')
    usuarioId = visitante.id
  } else if (dto.usuarioId) {
    const dizimista = await prisma.usuario.findUnique({
      where: { id: dto.usuarioId },
      select: { id: true, congregacaoId: true },
    })
    if (!dizimista) throw new BusinessRuleError('Usuário dizimista não encontrado.')

    if (logado.perfil !== 'SUPER_ADMIN') {
      if (
        dizimista.congregacaoId === null ||
        dizimista.congregacaoId !== existente.congregacaoId
      ) {
        throw new AccessDeniedError(
          'Você só pode atribuir movimentações a usuários da mesma congregação.'
        )
      }
    }
    usuarioId = dizimista.id
  }
  // else: dto.usuarioId === null/undefined → desvincula usuário (usuarioId = null)

  const atualizada = await prisma.movimentacao.update({
    where: { id },
    data: {
      descricao: dto.descricao ?? null,
      valor: dto.valor,
      data: new Date(dto.data),
      tipo: dto.tipo,
      usuarioId,
    },
    include: { usuario: { select: { id: true, nome: true } } },
  })

  return toMovimentacaoResponse(atualizada)
}

/**
 * Exclui movimentação — verifica acesso.
 */
export async function excluirMovimentacao(
  id: number,
  logado: SessionUser
): Promise<void> {
  const existente = await prisma.movimentacao.findUnique({
    where: { id },
    select: { congregacaoId: true, usuarioId: true },
  })

  if (!existente) throw new NotFoundError()

  validarAcesso(existente, logado)

  await prisma.movimentacao.delete({ where: { id } })
}

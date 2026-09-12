import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import type { SessionUser } from '@/lib/session'
import type {
  UsuarioResponse,
  UpdateUsuarioInput,
  PerfilType,
} from '@/lib/validations/usuario'

export class AccessDeniedError extends Error {
  constructor(message = 'Você não tem permissão para acessar os dados deste usuário.') {
    super(message)
    this.name = 'AccessDeniedError'
  }
}

export class NotFoundError extends Error {
  constructor(message = 'Usuário não encontrado.') {
    super(message)
    this.name = 'NotFoundError'
  }
}

export class ConflictError extends Error {
  constructor(message = 'E-mail já cadastrado.') {
    super(message)
    this.name = 'ConflictError'
  }
}

/**
 * Converte entidade Prisma Usuario (com congregacao inclusa) para UsuarioResponse DTO.
 */
function toUsuarioResponse(usuario: {
  id: number
  nome: string
  email: string
  perfil: string | null
  ativo?: boolean | null
  congregacaoId: number | null
  congregacao?: { idCongregacao: number; nome: string } | null
}): UsuarioResponse {
  return {
    id: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    perfil: (usuario.perfil as PerfilType) ?? 'USER',
    idCongregacao: usuario.congregacao?.idCongregacao ?? usuario.congregacaoId ?? null,
    nomeCongregacao: usuario.congregacao?.nome ?? null,
    ativo: usuario.ativo ?? null,
  }
}

/**
 * Valida se o usuário logado tem permissão para acessar ou modificar o usuário solicitado.
 * Replica exatamente a regra de segurança do Spring Boot:
 *  - SUPER_ADMIN acessa tudo
 *  - O próprio usuário acessa a si mesmo
 *  - ADMIN acessa usuários da sua própria congregação
 */
export function validarAcesso(
  solicitado: { id: number; congregacaoId: number | null },
  logado: SessionUser
): void {
  const logadoId = Number(logado.id)

  if (logado.perfil === 'SUPER_ADMIN') {
    return
  }

  if (solicitado.id === logadoId) {
    return
  }

  if (
    logado.perfil === 'ADMIN' &&
    logado.congregacaoId !== null &&
    solicitado.congregacaoId !== null &&
    logado.congregacaoId === solicitado.congregacaoId
  ) {
    return
  }

  throw new AccessDeniedError()
}

/**
 * Lista usuários baseado no perfil do usuário logado:
 *  - SUPER_ADMIN: todos os usuários ativos
 *  - ADMIN: todos os usuários da congregação do admin
 *  - USER: apenas o próprio usuário
 */
export async function listarUsuarios(logado: SessionUser): Promise<UsuarioResponse[]> {
  const logadoId = Number(logado.id)

  if (logado.perfil === 'SUPER_ADMIN') {
    const usuarios = await prisma.usuario.findMany({
      where: { ativo: true },
      include: { congregacao: true },
      orderBy: { nome: 'asc' },
    })
    return usuarios.map(toUsuarioResponse)
  }

  if (logado.perfil === 'ADMIN' && logado.congregacaoId !== null) {
    const usuarios = await prisma.usuario.findMany({
      where: { congregacaoId: logado.congregacaoId },
      include: { congregacao: true },
      orderBy: { nome: 'asc' },
    })
    return usuarios.map(toUsuarioResponse)
  }

  // Usuário comum: apenas a si mesmo
  const usuarioProprio = await prisma.usuario.findUnique({
    where: { id: logadoId },
    include: { congregacao: true },
  })

  if (!usuarioProprio) return []
  return [toUsuarioResponse(usuarioProprio)]
}

/**
 * Busca usuários por nome com filtro case-insensitive:
 *  - SUPER_ADMIN: busca global em todo o sistema
 *  - ADMIN / USER: busca restrita à congregação do usuário logado
 */
export async function buscarUsuariosPorNome(
  nome: string,
  logado: SessionUser
): Promise<UsuarioResponse[]> {
  if (!nome || nome.trim().length === 0) {
    return []
  }

  const termo = nome.trim()

  if (logado.perfil === 'SUPER_ADMIN') {
    const usuarios = await prisma.usuario.findMany({
      where: {
        nome: { contains: termo, mode: 'insensitive' },
      },
      include: { congregacao: true },
      orderBy: { nome: 'asc' },
    })
    return usuarios.map(toUsuarioResponse)
  }

  if (logado.congregacaoId === null) {
    return []
  }

  const usuarios = await prisma.usuario.findMany({
    where: {
      nome: { contains: termo, mode: 'insensitive' },
      congregacaoId: logado.congregacaoId,
    },
    include: { congregacao: true },
    orderBy: { nome: 'asc' },
  })

  return usuarios.map(toUsuarioResponse)
}

/**
 * Busca usuário por ID com validação de acesso.
 */
export async function buscarUsuarioPorId(
  id: number,
  logado: SessionUser
): Promise<UsuarioResponse> {
  const usuario = await prisma.usuario.findUnique({
    where: { id },
    include: { congregacao: true },
  })

  if (!usuario) {
    throw new NotFoundError()
  }

  validarAcesso(usuario, logado)

  return toUsuarioResponse(usuario)
}

/**
 * Atualiza os dados de um usuário:
 *  - Valida acesso
 *  - Trata atualização de nome, email (com verificação de duplicidade), senha (com hash BCrypt)
 *  - Campos perfil, ativo e idCongregacao são restritos a ADMIN / SUPER_ADMIN
 */
export async function atualizarUsuario(
  id: number,
  dados: UpdateUsuarioInput,
  logado: SessionUser
): Promise<UsuarioResponse> {
  const logadoId = Number(logado.id)

  const existente = await prisma.usuario.findUnique({
    where: { id },
    include: { congregacao: true },
  })

  if (!existente) {
    throw new NotFoundError()
  }

  validarAcesso(existente, logado)

  // Usuário comum não pode alterar terceiros
  if (logado.perfil === 'USER' && existente.id !== logadoId) {
    throw new AccessDeniedError('Usuário comum não pode alterar dados de terceiros.')
  }

  // Verificação de e-mail duplicado
  if (dados.email && dados.email !== existente.email) {
    const outro = await prisma.usuario.findUnique({
      where: { email: dados.email },
    })
    if (outro && outro.id !== id) {
      throw new ConflictError('E-mail já está em uso por outro usuário.')
    }
  }

  const updateData: {
    nome?: string
    email?: string
    senha?: string
    perfil?: string
    ativo?: boolean
    congregacaoId?: number | null
  } = {}

  if (dados.nome !== undefined) updateData.nome = dados.nome
  if (dados.email !== undefined) updateData.email = dados.email
  if (dados.senha !== undefined && dados.senha.length > 0) {
    updateData.senha = await bcrypt.hash(dados.senha, 10)
  }

  // Apenas ADMIN ou SUPER_ADMIN podem alterar perfil, ativo e congregação
  if (logado.perfil !== 'USER') {
    if (dados.perfil !== undefined) {
      // ADMIN não pode conceder ou alterar perfil para SUPER_ADMIN
      if (logado.perfil === 'ADMIN' && dados.perfil === 'SUPER_ADMIN') {
        throw new AccessDeniedError('Apenas SUPER_ADMIN pode atribuir o perfil SUPER_ADMIN.')
      }
      updateData.perfil = dados.perfil
    }

    if (dados.ativo !== undefined) {
      updateData.ativo = dados.ativo
    }

    if (dados.idCongregacao !== undefined) {
      // Se for ADMIN, só pode manter na sua própria congregação
      if (logado.perfil === 'ADMIN' && dados.idCongregacao !== logado.congregacaoId) {
        throw new AccessDeniedError('ADMIN só pode vincular usuários à sua própria congregação.')
      }
      updateData.congregacaoId = dados.idCongregacao
    }
  }

  const salvo = await prisma.usuario.update({
    where: { id },
    data: updateData,
    include: { congregacao: true },
  })

  return toUsuarioResponse(salvo)
}

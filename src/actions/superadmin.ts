'use server'

import { revalidatePath } from 'next/cache'
import { requireAuth } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { PerfilEnum, type PerfilType, type UsuarioResponse } from '@/lib/validations/usuario'

export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string }

export class SuperAdminError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SuperAdminError'
  }
}

function checkSuperAdmin(user: { perfil: string }) {
  if (user.perfil !== 'SUPER_ADMIN') {
    throw new SuperAdminError('Acesso negado: Requer privilégios de Super Administrador.')
  }
}

/**
 * Lista usuários ativos exceto SUPER_ADMIN
 */
export async function listarTodosUsuariosAction(): Promise<ActionResult<UsuarioResponse[]>> {
  try {
    const { user, error: authError } = await requireAuth()
    if (authError) return { success: false, error: 'Não autenticado.' }

    checkSuperAdmin(user)

    const usuarios = await prisma.usuario.findMany({
      where: {
        ativo: true,
        perfil: { not: 'SUPER_ADMIN' },
      },
      include: { congregacao: true },
      orderBy: { nome: 'asc' },
    })

    const data: UsuarioResponse[] = usuarios.map(u => ({
      id: u.id,
      nome: u.nome,
      email: u.email,
      perfil: (u.perfil as PerfilType) ?? 'USER',
      idCongregacao: u.congregacao?.idCongregacao ?? u.congregacaoId ?? null,
      nomeCongregacao: u.congregacao?.nome ?? null,
      ativo: u.ativo,
    }))

    return { success: true, data }
  } catch (error) {
    if (error instanceof SuperAdminError) return { success: false, error: error.message }
    console.error('Erro em listarTodosUsuariosAction:', error)
    return { success: false, error: 'Erro interno ao listar usuários.' }
  }
}

/**
 * Muda o perfil de um usuário
 */
export async function mudarPerfilAction(
  id: number,
  perfil: PerfilType
): Promise<ActionResult<UsuarioResponse>> {
  try {
    const { user, error: authError } = await requireAuth()
    if (authError) return { success: false, error: 'Não autenticado.' }

    checkSuperAdmin(user)

    const validPerfil = PerfilEnum.safeParse(perfil)
    if (!validPerfil.success) {
      return { success: false, error: 'Perfil inválido.' }
    }

    if (validPerfil.data === 'SUPER_ADMIN') {
      return { success: false, error: 'Não é possível atribuir o perfil SUPER_ADMIN por esta via.' }
    }

    const usuario = await prisma.usuario.findUnique({ where: { id } })
    if (!usuario) return { success: false, error: 'Usuário não encontrado.' }
    if (usuario.perfil === 'SUPER_ADMIN') {
      return { success: false, error: 'Não é possível alterar o perfil de um SUPER_ADMIN.' }
    }

    const atualizado = await prisma.usuario.update({
      where: { id },
      data: { perfil: validPerfil.data },
      include: { congregacao: true },
    })

    revalidatePath('/admin/usuarios')
    revalidatePath(`/usuarios/${id}`)

    return {
      success: true,
      data: {
        id: atualizado.id,
        nome: atualizado.nome,
        email: atualizado.email,
        perfil: atualizado.perfil as PerfilType,
        idCongregacao: atualizado.congregacao?.idCongregacao ?? atualizado.congregacaoId ?? null,
        nomeCongregacao: atualizado.congregacao?.nome ?? null,
        ativo: atualizado.ativo,
      },
    }
  } catch (error) {
    if (error instanceof SuperAdminError) return { success: false, error: error.message }
    console.error('Erro em mudarPerfilAction:', error)
    return { success: false, error: 'Erro interno ao mudar perfil.' }
  }
}

/**
 * Muda a congregação de um usuário
 */
export async function mudarCongregacaoAction(
  id: number,
  idCongregacao: number
): Promise<ActionResult<UsuarioResponse>> {
  try {
    const { user, error: authError } = await requireAuth()
    if (authError) return { success: false, error: 'Não autenticado.' }

    checkSuperAdmin(user)

    const usuario = await prisma.usuario.findUnique({ where: { id } })
    if (!usuario) return { success: false, error: 'Usuário não encontrado.' }

    const congregacao = await prisma.congregacao.findUnique({ where: { idCongregacao } })
    if (!congregacao) return { success: false, error: 'Congregação não encontrada.' }

    const atualizado = await prisma.usuario.update({
      where: { id },
      data: { congregacaoId: idCongregacao },
      include: { congregacao: true },
    })

    revalidatePath('/admin/usuarios')
    revalidatePath(`/usuarios/${id}`)

    return {
      success: true,
      data: {
        id: atualizado.id,
        nome: atualizado.nome,
        email: atualizado.email,
        perfil: atualizado.perfil as PerfilType,
        idCongregacao: atualizado.congregacao?.idCongregacao ?? atualizado.congregacaoId ?? null,
        nomeCongregacao: atualizado.congregacao?.nome ?? null,
        ativo: atualizado.ativo,
      },
    }
  } catch (error) {
    if (error instanceof SuperAdminError) return { success: false, error: error.message }
    console.error('Erro em mudarCongregacaoAction:', error)
    return { success: false, error: 'Erro interno ao mudar congregação.' }
  }
}

/**
 * Deleta um usuário permanentemente
 */
export async function deletarUsuarioAction(id: number): Promise<ActionResult<null>> {
  try {
    const { user, error: authError } = await requireAuth()
    if (authError) return { success: false, error: 'Não autenticado.' }

    checkSuperAdmin(user)

    const usuario = await prisma.usuario.findUnique({
      where: { id },
      include: { _count: { select: { movimentacoes: true } } },
    })

    if (!usuario) return { success: false, error: 'Usuário não encontrado.' }

    if (usuario.perfil === 'SUPER_ADMIN') {
      return { success: false, error: 'Não é possível deletar um SUPER_ADMIN.' }
    }

    if (usuario._count.movimentacoes > 0) {
      return {
        success: false,
        error: 'Não é possível deletar este usuário pois existem movimentações vinculadas a ele. Considere desativá-lo.',
      }
    }

    await prisma.usuario.delete({ where: { id } })

    revalidatePath('/admin/usuarios')
    revalidatePath('/usuarios')

    return { success: true, data: null }
  } catch (error) {
    if (error instanceof SuperAdminError) return { success: false, error: error.message }
    console.error('Erro em deletarUsuarioAction:', error)
    return { success: false, error: 'Erro interno ao deletar usuário.' }
  }
}

'use server'

import { revalidatePath } from 'next/cache'
import { requireAuth } from '@/lib/session'
import {
  UpdateUsuarioSchema,
  type UpdateUsuarioInput,
  type UsuarioResponse,
} from '@/lib/validations/usuario'
import {
  listarUsuarios,
  buscarUsuariosPorNome,
  buscarUsuarioPorId,
  atualizarUsuario,
  NotFoundError,
  AccessDeniedError,
  ConflictError,
} from '@/lib/services/usuario.service'

export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; details?: Record<string, string[]> }

/**
 * Server Action para listar usuários dentro do escopo permitido.
 */
export async function listarUsuariosAction(): Promise<ActionResult<UsuarioResponse[]>> {
  try {
    const { user, error: authError } = await requireAuth()
    if (authError) {
      return { success: false, error: 'Usuário não autenticado.' }
    }

    const data = await listarUsuarios(user)
    return { success: true, data }
  } catch (error) {
    console.error('Erro em listarUsuariosAction:', error)
    return { success: false, error: 'Erro interno ao consultar usuários.' }
  }
}

/**
 * Server Action para buscar usuários por nome.
 */
export async function buscarUsuariosPorNomeAction(
  nome: string
): Promise<ActionResult<UsuarioResponse[]>> {
  try {
    const { user, error: authError } = await requireAuth()
    if (authError) {
      return { success: false, error: 'Usuário não autenticado.' }
    }

    const data = await buscarUsuariosPorNome(nome, user)
    return { success: true, data }
  } catch (error) {
    console.error('Erro em buscarUsuariosPorNomeAction:', error)
    return { success: false, error: 'Erro interno ao buscar usuários por nome.' }
  }
}

/**
 * Server Action para buscar usuário por ID com controle de acesso.
 */
export async function buscarUsuarioPorIdAction(
  id: string
): Promise<ActionResult<UsuarioResponse>> {
  try {
    const { user, error: authError } = await requireAuth()
    if (authError) {
      return { success: false, error: 'Usuário não autenticado.' }
    }

    const data = await buscarUsuarioPorId(id, user)
    return { success: true, data }
  } catch (error) {
    if (error instanceof NotFoundError || error instanceof AccessDeniedError) {
      return { success: false, error: error.message }
    }
    console.error('Erro em buscarUsuarioPorIdAction:', error)
    return { success: false, error: 'Erro interno ao buscar usuário.' }
  }
}

/**
 * Server Action para atualizar dados de usuário.
 */
export async function atualizarUsuarioAction(
  id: string,
  input: UpdateUsuarioInput
): Promise<ActionResult<UsuarioResponse>> {
  try {
    const { user, error: authError } = await requireAuth()
    if (authError) {
      return { success: false, error: 'Usuário não autenticado.' }
    }

    const validation = UpdateUsuarioSchema.safeParse(input)
    if (!validation.success) {
      return {
        success: false,
        error: 'Dados inválidos.',
        details: validation.error.flatten().fieldErrors,
      }
    }

    const data = await atualizarUsuario(id, validation.data, user)

    revalidatePath('/usuarios')
    revalidatePath(`/usuarios/${id}`)

    return { success: true, data }
  } catch (error) {
    if (
      error instanceof NotFoundError ||
      error instanceof AccessDeniedError ||
      error instanceof ConflictError
    ) {
      return { success: false, error: error.message }
    }
    console.error('Erro em atualizarUsuarioAction:', error)
    return { success: false, error: 'Erro interno ao atualizar usuário.' }
  }
}

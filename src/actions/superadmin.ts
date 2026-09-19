'use server'

import { revalidatePath } from 'next/cache'
import { requireAuth } from '@/lib/session'
import { createClient } from '@/utils/supabase/server'
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

    const supabase = await createClient()
    const { data: usuarios, error } = await supabase
      .from('usuario')
      .select('*, congregacao(id_congregacao, nome)')
      .eq('ativo', true)
      .neq('perfil', 'SUPER_ADMIN')
      .order('nome', { ascending: true })

    if (error) throw new Error('Falha no banco de dados')

    const data: UsuarioResponse[] = (usuarios || []).map(u => ({
      id: u.id_usuario,
      nome: u.nome,
      email: u.email,
      perfil: (u.perfil as PerfilType) ?? 'USER',
      idCongregacao: u.congregacao?.id_congregacao ?? u.id_congregacao ?? null,
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
  id: string,
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

    const supabase = await createClient()

    const { data: usuario } = await supabase.from('usuario').select('perfil').eq('id_usuario', id).single()
    if (!usuario) return { success: false, error: 'Usuário não encontrado.' }
    if (usuario.perfil === 'SUPER_ADMIN') {
      return { success: false, error: 'Não é possível alterar o perfil de um SUPER_ADMIN.' }
    }

    const { data: atualizado, error } = await supabase
      .from('usuario')
      .update({ perfil: validPerfil.data })
      .eq('id_usuario', id)
      .select('*, congregacao(id_congregacao, nome)')
      .single()

    if (error || !atualizado) throw new Error('Erro ao atualizar banco')

    revalidatePath('/admin/usuarios')
    revalidatePath(`/usuarios/${id}`)

    return {
      success: true,
      data: {
        id: atualizado.id_usuario,
        nome: atualizado.nome,
        email: atualizado.email,
        perfil: atualizado.perfil as PerfilType,
        idCongregacao: atualizado.congregacao?.id_congregacao ?? atualizado.id_congregacao ?? null,
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
  id: string,
  idCongregacao: number
): Promise<ActionResult<UsuarioResponse>> {
  try {
    const { user, error: authError } = await requireAuth()
    if (authError) return { success: false, error: 'Não autenticado.' }

    checkSuperAdmin(user)

    const supabase = await createClient()

    const { data: usuario } = await supabase.from('usuario').select('id_usuario').eq('id_usuario', id).single()
    if (!usuario) return { success: false, error: 'Usuário não encontrado.' }

    const { data: congregacao } = await supabase.from('congregacao').select('id_congregacao').eq('id_congregacao', idCongregacao).single()
    if (!congregacao) return { success: false, error: 'Congregação não encontrada.' }

    const { data: atualizado, error } = await supabase
      .from('usuario')
      .update({ id_congregacao: idCongregacao })
      .eq('id_usuario', id)
      .select('*, congregacao(id_congregacao, nome)')
      .single()

    if (error || !atualizado) throw new Error('Erro ao atualizar banco')

    revalidatePath('/admin/usuarios')
    revalidatePath(`/usuarios/${id}`)

    return {
      success: true,
      data: {
        id: atualizado.id_usuario,
        nome: atualizado.nome,
        email: atualizado.email,
        perfil: atualizado.perfil as PerfilType,
        idCongregacao: atualizado.congregacao?.id_congregacao ?? atualizado.id_congregacao ?? null,
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
export async function deletarUsuarioAction(id: string): Promise<ActionResult<null>> {
  try {
    const { user, error: authError } = await requireAuth()
    if (authError) return { success: false, error: 'Não autenticado.' }

    checkSuperAdmin(user)

    const supabase = await createClient()

    // No Supabase, usar count é a forma de verificar relações 1:N no JS nativo
    const { count, error: countError } = await supabase
      .from('movimentacao')
      .select('*', { count: 'exact', head: true })
      .eq('id_usuario', id)

    if (countError) throw new Error('Erro ao verificar movimentações do usuário')

    if ((count ?? 0) > 0) {
      return {
        success: false,
        error: 'Não é possível deletar este usuário pois existem movimentações vinculadas a ele. Considere desativá-lo.',
      }
    }

    const { data: usuario } = await supabase.from('usuario').select('perfil').eq('id_usuario', id).single()
    if (!usuario) return { success: false, error: 'Usuário não encontrado.' }

    if (usuario.perfil === 'SUPER_ADMIN') {
      return { success: false, error: 'Não é possível deletar um SUPER_ADMIN.' }
    }

    // Cria cliente com service_role para bypassar limitações e deletar o usuário no Auth
    const { createClient: createSupabaseAdmin } = await import('@supabase/supabase-js')
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY!
    
    if (!supabaseServiceKey) {
      throw new Error('Chave SUPABASE_SECRET_KEY não configurada no servidor.')
    }
    
    const supabaseAdmin = createSupabaseAdmin(supabaseUrl, supabaseServiceKey)

    // Deleta o usuário diretamente do Auth. 
    // A constraint ON DELETE CASCADE garantirá a deleção em public.usuario
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(id)

    if (deleteError) {
      console.error('Erro ao deletar do Auth:', deleteError)
      throw new Error('Erro ao deletar conta do usuário')
    }

    revalidatePath('/admin/usuarios')
    revalidatePath('/usuarios')

    return { success: true, data: null }
  } catch (error) {
    if (error instanceof SuperAdminError) return { success: false, error: error.message }
    console.error('Erro em deletarUsuarioAction:', error)
    return { success: false, error: 'Erro interno ao deletar usuário.' }
  }
}

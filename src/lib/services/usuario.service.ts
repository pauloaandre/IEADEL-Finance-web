import { createClient } from '@/utils/supabase/server'
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
 * Converte o retorno do Supabase para UsuarioResponse DTO.
 */
function toUsuarioResponse(usuario: any): UsuarioResponse {
  return {
    id: usuario.id_usuario,
    nome: usuario.nome,
    email: usuario.email,
    perfil: (usuario.perfil as PerfilType) ?? 'USER',
    idCongregacao: usuario.congregacao?.id_congregacao ?? usuario.id_congregacao ?? null,
    nomeCongregacao: usuario.congregacao?.nome ?? null,
    ativo: usuario.ativo ?? null,
  }
}

/**
 * Lista usuários utilizando as políticas RLS do Supabase.
 */
export async function listarUsuarios(logado: SessionUser): Promise<UsuarioResponse[]> {
  const supabase = await createClient()

  // O RLS cuidará do isolamento de dados:
  // SUPER_ADMIN vê todos. ADMIN vê os da sua congregação. USER vê apenas a si mesmo.
  let query = supabase.from('usuario').select('*, congregacao(id_congregacao, nome)').order('nome', { ascending: true })

  // Comportamento herdado: SUPER_ADMIN via apenas usuários ativos.
  if (logado.perfil === 'SUPER_ADMIN') {
    query = query.eq('ativo', true)
  }

  const { data, error } = await query

  if (error) {
    console.error('Erro ao listar usuarios no Supabase:', error)
    return []
  }

  return (data || []).map(toUsuarioResponse)
}

/**
 * Busca usuários por nome com filtro case-insensitive e RLS.
 */
export async function buscarUsuariosPorNome(
  nome: string,
  logado: SessionUser
): Promise<UsuarioResponse[]> {
  if (!nome || nome.trim().length === 0) {
    return []
  }

  const termo = nome.trim()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('usuario')
    .select('*, congregacao(id_congregacao, nome)')
    .ilike('nome', `%${termo}%`)
    .order('nome', { ascending: true })

  if (error) {
    console.error('Erro ao buscar usuarios no Supabase:', error)
    return []
  }

  return (data || []).map(toUsuarioResponse)
}

/**
 * Busca usuário por ID (UUID string). RLS garantirá a segurança.
 */
export async function buscarUsuarioPorId(
  id: string,
  logado: SessionUser
): Promise<UsuarioResponse> {
  // Usuário comum só pode acessar seus próprios dados
  if (logado.perfil === 'USER' && id !== logado.id) {
    throw new AccessDeniedError('Você só pode visualizar seu próprio usuário.')
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('usuario')
    .select('*, congregacao(id_congregacao, nome)')
    .eq('id_usuario', id)
    .single()

  if (error || !data) {
    // Se o RLS bloqueou a leitura, também cairá aqui como não encontrado
    throw new NotFoundError()
  }

  // Admin só pode visualizar usuários da sua congregação
  if (logado.perfil === 'ADMIN' && data.id_congregacao !== logado.congregacaoId) {
    throw new AccessDeniedError('Você não tem permissão para visualizar usuários de outra congregação.')
  }

  return toUsuarioResponse(data)
}

/**
 * Atualiza os dados de um usuário:
 * RLS também aplica regras de segurança.
 */
export async function atualizarUsuario(
  id: string,
  dados: UpdateUsuarioInput,
  logado: SessionUser
): Promise<UsuarioResponse> {
  const supabase = await createClient()

  // Verificar existência e restrições
  const { data: existente, error: findError } = await supabase
    .from('usuario')
    .select('id_usuario, email')
    .eq('id_usuario', id)
    .single()

  if (findError || !existente) {
    throw new NotFoundError()
  }

  if (logado.perfil === 'USER' && existente.id_usuario !== logado.id) {
    throw new AccessDeniedError('Usuário comum não pode alterar dados de terceiros.')
  }

  // Verificação de e-mail duplicado
  if (dados.email && dados.email !== existente.email) {
    const { data: outro } = await supabase
      .from('usuario')
      .select('id_usuario')
      .eq('email', dados.email)
      .single()
      
    if (outro && outro.id_usuario !== id) {
      throw new ConflictError('E-mail já está em uso por outro usuário.')
    }
  }

  const updateData: any = {}

  if (dados.nome !== undefined) updateData.nome = dados.nome
  if (dados.email !== undefined) updateData.email = dados.email
  
  // Apenas ADMIN ou SUPER_ADMIN podem alterar perfil, ativo e congregação
  if (logado.perfil !== 'USER') {
    if (dados.perfil !== undefined) {
      if (logado.perfil === 'ADMIN' && dados.perfil === 'SUPER_ADMIN') {
        throw new AccessDeniedError('Apenas SUPER_ADMIN pode atribuir o perfil SUPER_ADMIN.')
      }
      updateData.perfil = dados.perfil
    }

    if (dados.ativo !== undefined) updateData.ativo = dados.ativo

    if (dados.idCongregacao !== undefined) {
      if (logado.perfil === 'ADMIN' && dados.idCongregacao !== logado.congregacaoId) {
        throw new AccessDeniedError('ADMIN só pode vincular usuários à sua própria congregação.')
      }
      updateData.id_congregacao = dados.idCongregacao
    }
  }

  const { data: salvo, error: updateError } = await supabase
    .from('usuario')
    .update(updateData)
    .eq('id_usuario', id)
    .select('*, congregacao(id_congregacao, nome)')
    .single()

  if (updateError || !salvo) {
    throw new Error('Falha ao atualizar o usuário')
  }

  // TODO: Se dados.email ou dados.senha foram alterados, usar supabaseAdmin.auth.admin.updateUserById(id, { email, password })
  
  return toUsuarioResponse(salvo)
}

/**
 * lib/session.ts
 *
 * Helpers para leitura e validação de sessão em Route Handlers e Server Actions.
 * Centraliza a lógica de autenticação, evitando repetição nos endpoints.
 */
import { auth } from '@/auth'
import { NextResponse } from 'next/server'

export type SessionUser = {
  id: string
  nome: string
  email: string
  perfil: 'USER' | 'ADMIN' | 'SUPER_ADMIN'
  congregacaoId: number | null
  ativo: boolean
}

/**
 * Retorna o usuário da sessão ou null se não autenticado.
 * Equivalente ao SecurityContextHolder.getContext().getAuthentication().getPrincipal()
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth()
  if (!session?.user) return null
  return session.user as SessionUser
}

/**
 * Retorna o usuário da sessão ou uma resposta 401 JSON.
 * Uso em Route Handlers para evitar boilerplate.
 *
 * @example
 * const { user, error } = await requireAuth()
 * if (error) return error
 */
export async function requireAuth(): Promise<
  { user: SessionUser; error: null } | { user: null; error: NextResponse }
> {
  const user = await getSessionUser()
  if (!user) {
    return {
      user: null,
      error: NextResponse.json({ error: 'Não autenticado.' }, { status: 401 }),
    }
  }
  return { user, error: null }
}

/**
 * Verifica se o usuário tem pelo menos o perfil mínimo exigido.
 * Replica a hierarquia de roles do Spring Boot:
 *  SUPER_ADMIN > ADMIN > USER
 */
const PERFIL_NIVEL: Record<SessionUser['perfil'], number> = {
  USER: 1,
  ADMIN: 2,
  SUPER_ADMIN: 3,
}

export function temPerfil(
  usuario: SessionUser,
  perfilMinimo: SessionUser['perfil']
): boolean {
  return PERFIL_NIVEL[usuario.perfil] >= PERFIL_NIVEL[perfilMinimo]
}

/**
 * Retorna 403 JSON se o usuário não tiver o perfil mínimo exigido.
 *
 * @example
 * const denied = requirePerfil(user, 'ADMIN')
 * if (denied) return denied
 */
export function requirePerfil(
  usuario: SessionUser,
  perfilMinimo: SessionUser['perfil']
): NextResponse | null {
  if (!temPerfil(usuario, perfilMinimo)) {
    return NextResponse.json(
      { error: `Acesso negado. Requer perfil ${perfilMinimo} ou superior.` },
      { status: 403 }
    )
  }
  return null
}

/**
 * Aplica a proteção IDOR de congregação.
 * Replica exatamente a lógica dos controllers de movimentação do Spring Boot:
 *  - Se for SUPER_ADMIN: usa o idCongregacao passado (ou 0 para todos)
 *  - Se não for SUPER_ADMIN: ignora o idCongregacao e usa o do usuário logado
 *
 * Retorna { congregacaoId, error }
 */
export function resolveIdorCongregacao(
  usuario: SessionUser,
  idCongregacaoParam?: number | null
): { congregacaoId: number; error: null } | { congregacaoId: null; error: NextResponse } {
  if (usuario.perfil === 'SUPER_ADMIN') {
    return { congregacaoId: idCongregacaoParam ?? 0, error: null }
  }

  // Não é SUPER_ADMIN: ignora o parâmetro e força a congregação do usuário
  if (!usuario.congregacaoId) {
    return {
      congregacaoId: null,
      error: NextResponse.json(
        { error: 'Usuário não vinculado a uma congregação.' },
        { status: 403 }
      ),
    }
  }

  return { congregacaoId: usuario.congregacaoId, error: null }
}

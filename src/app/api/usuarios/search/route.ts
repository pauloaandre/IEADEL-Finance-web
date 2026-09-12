import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/session'
import { buscarUsuariosPorNome } from '@/lib/services/usuario.service'

/**
 * GET /api/usuarios/search?nome=...
 *
 * Busca usuários por nome com filtro parcial case-insensitive.
 * - SUPER_ADMIN: busca em toda a base
 * - ADMIN / USER: busca restrita à congregação do usuário logado
 */
export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAuth()
    if (authError) return authError

    const searchParams = request.nextUrl.searchParams
    const nome = searchParams.get('nome') ?? ''

    const usuarios = await buscarUsuariosPorNome(nome, user)
    return NextResponse.json(usuarios, { status: 200 })
  } catch (error) {
    console.error('Erro ao buscar usuários por nome:', error)
    return NextResponse.json(
      { error: 'Erro interno ao buscar usuários por nome.' },
      { status: 500 }
    )
  }
}

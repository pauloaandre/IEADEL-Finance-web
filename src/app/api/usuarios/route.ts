import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/session'
import { listarUsuarios } from '@/lib/services/usuario.service'

/**
 * GET /api/usuarios
 *
 * Lista os usuários de acordo com o escopo do usuário autenticado:
 * - SUPER_ADMIN: todos os usuários ativos do sistema
 * - ADMIN: usuários pertencentes à mesma congregação
 * - USER: apenas seus próprios dados
 */
export async function GET() {
  try {
    const { user, error: authError } = await requireAuth()
    if (authError) return authError

    const usuarios = await listarUsuarios(user)
    return NextResponse.json(usuarios, { status: 200 })
  } catch (error) {
    console.error('Erro ao listar usuários:', error)
    return NextResponse.json(
      { error: 'Erro interno ao listar usuários.' },
      { status: 500 }
    )
  }
}

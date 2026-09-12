import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/session'
import { z } from 'zod'
import { listarPorUsuario, AccessDeniedError, NotFoundError } from '@/lib/services/movimentacao.service'

/**
 * GET /api/movimentacoes/dizimoByUsuario?id_usuario=42
 *
 * Lista dízimos de um usuário específico.
 * Proteção: o usuário logado só pode ver movimentações do próprio usuário,
 * ou de usuários da sua congregação (se for ADMIN). SUPER_ADMIN vê qualquer um.
 */
export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAuth()
    if (authError) return authError

    const { searchParams } = request.nextUrl
    const idParam = searchParams.get('id_usuario')

    const parsed = z.coerce.number().int().positive().safeParse(idParam)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Parâmetro id_usuario inválido ou ausente.' },
        { status: 400 }
      )
    }

    const movimentacoes = await listarPorUsuario(parsed.data, user)
    return NextResponse.json(movimentacoes, { status: 200 })
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
    console.error('Erro ao listar movimentações por usuário:', error)
    return NextResponse.json(
      { error: 'Erro interno ao listar movimentações por usuário.' },
      { status: 500 }
    )
  }
}

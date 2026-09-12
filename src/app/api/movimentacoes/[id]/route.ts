import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, requirePerfil } from '@/lib/session'
import { UpdateMovimentacaoSchema } from '@/lib/validations/movimentacao'
import {
  buscarPorId,
  atualizarMovimentacao,
  excluirMovimentacao,
  NotFoundError,
  AccessDeniedError,
  BusinessRuleError,
} from '@/lib/services/movimentacao.service'

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * GET /api/movimentacoes/[id]
 *
 * Busca uma movimentação por ID com controle de acesso.
 */
export async function GET(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    const { user, error: authError } = await requireAuth()
    if (authError) return authError

    const { id } = await context.params
    const idNumerico = parseInt(id, 10)
    if (isNaN(idNumerico) || idNumerico <= 0) {
      return NextResponse.json({ error: 'ID inválido.' }, { status: 400 })
    }

    const movimentacao = await buscarPorId(idNumerico, user)
    return NextResponse.json(movimentacao, { status: 200 })
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
    if (error instanceof AccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('Erro ao buscar movimentação por ID:', error)
    return NextResponse.json({ error: 'Erro interno ao buscar movimentação.' }, { status: 500 })
  }
}

/**
 * PUT /api/movimentacoes/[id]
 *
 * Atualiza movimentação — restrito a ADMIN+.
 */
export async function PUT(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { user, error: authError } = await requireAuth()
    if (authError) return authError

    const perfilError = requirePerfil(user, 'ADMIN')
    if (perfilError) return perfilError

    const { id } = await context.params
    const idNumerico = parseInt(id, 10)
    if (isNaN(idNumerico) || idNumerico <= 0) {
      return NextResponse.json({ error: 'ID inválido.' }, { status: 400 })
    }

    const body = await request.json().catch(() => null)
    if (!body) {
      return NextResponse.json({ error: 'Corpo da requisição inválido ou ausente.' }, { status: 400 })
    }

    const validation = UpdateMovimentacaoSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dados inválidos.', details: validation.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const resultado = await atualizarMovimentacao(idNumerico, validation.data, user)
    return NextResponse.json(resultado, { status: 200 })
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
    if (error instanceof AccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    if (error instanceof BusinessRuleError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error('Erro ao atualizar movimentação:', error)
    return NextResponse.json({ error: 'Erro interno ao atualizar movimentação.' }, { status: 500 })
  }
}

/**
 * DELETE /api/movimentacoes/[id]
 *
 * Exclui movimentação — verifica acesso.
 */
export async function DELETE(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    const { user, error: authError } = await requireAuth()
    if (authError) return authError

    const perfilError = requirePerfil(user, 'ADMIN')
    if (perfilError) return perfilError

    const { id } = await context.params
    const idNumerico = parseInt(id, 10)
    if (isNaN(idNumerico) || idNumerico <= 0) {
      return NextResponse.json({ error: 'ID inválido.' }, { status: 400 })
    }

    await excluirMovimentacao(idNumerico, user)
    return new Response(null, { status: 204 })
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
    if (error instanceof AccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('Erro ao excluir movimentação:', error)
    return NextResponse.json({ error: 'Erro interno ao excluir movimentação.' }, { status: 500 })
  }
}

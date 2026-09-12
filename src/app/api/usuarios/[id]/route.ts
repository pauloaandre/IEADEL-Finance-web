import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/session'
import { UpdateUsuarioSchema } from '@/lib/validations/usuario'
import {
  buscarUsuarioPorId,
  atualizarUsuario,
  NotFoundError,
  AccessDeniedError,
  ConflictError,
} from '@/lib/services/usuario.service'

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * GET /api/usuarios/[id]
 *
 * Busca um usuário específico por ID:
 * - Valida autenticação
 * - Valida se o usuário logado tem permissão para acessar os dados deste usuário
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
      return NextResponse.json(
        { error: 'ID de usuário inválido.' },
        { status: 400 }
      )
    }

    const usuario = await buscarUsuarioPorId(idNumerico, user)
    return NextResponse.json(usuario, { status: 200 })
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
    if (error instanceof AccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('Erro ao buscar usuário por ID:', error)
    return NextResponse.json(
      { error: 'Erro interno ao buscar usuário.' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/usuarios/[id]
 *
 * Atualiza dados cadastrais de um usuário:
 * - Valida autenticação
 * - Valida se o usuário tem permissão para alterar este usuário
 * - Valida payload com Zod
 */
export async function PUT(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { user, error: authError } = await requireAuth()
    if (authError) return authError

    const { id } = await context.params
    const idNumerico = parseInt(id, 10)

    if (isNaN(idNumerico) || idNumerico <= 0) {
      return NextResponse.json(
        { error: 'ID de usuário inválido.' },
        { status: 400 }
      )
    }

    const body = await request.json().catch(() => null)
    if (!body) {
      return NextResponse.json(
        { error: 'Corpo da requisição inválido ou ausente.' },
        { status: 400 }
      )
    }

    const validation = UpdateUsuarioSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Dados inválidos.',
          details: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      )
    }

    const usuarioAtualizado = await atualizarUsuario(
      idNumerico,
      validation.data,
      user
    )

    return NextResponse.json(usuarioAtualizado, { status: 200 })
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
    if (error instanceof AccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    if (error instanceof ConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
    console.error('Erro ao atualizar usuário:', error)
    return NextResponse.json(
      { error: 'Erro interno ao atualizar usuário.' },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/session'
import { buscarCongregacaoPorId } from '@/lib/services/congregacao.service'

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * GET /api/congregacoes/[id]
 *
 * Endpoint autenticado: busca uma congregação específica por ID.
 * Replica CongregacaoController.getCongregacaoById():
 * - Exige autenticação
 * - Se SUPER_ADMIN: inclui contagem de membros ativos
 * - Se não encontrado: 404
 */
export async function GET(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    // 1. Autenticação obrigatória
    const { user, error: authError } = await requireAuth()
    if (authError) return authError

    // 2. Extração e validação do ID numérico
    const { id } = await context.params
    const idNumerico = parseInt(id, 10)

    if (isNaN(idNumerico) || idNumerico <= 0) {
      return NextResponse.json(
        { error: 'ID de congregação inválido.' },
        { status: 400 }
      )
    }

    // 3. Busca congregação
    const isSuperAdmin = user.perfil === 'SUPER_ADMIN'
    const congregacao = await buscarCongregacaoPorId(idNumerico, isSuperAdmin)

    if (!congregacao) {
      return NextResponse.json(
        { error: 'Congregação não encontrada.' },
        { status: 404 }
      )
    }

    return NextResponse.json(congregacao, { status: 200 })
  } catch (error) {
    console.error('Erro ao buscar congregação por ID:', error)
    return NextResponse.json(
      { error: 'Erro interno ao buscar congregação.' },
      { status: 500 }
    )
  }
}

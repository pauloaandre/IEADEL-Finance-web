import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, requirePerfil } from '@/lib/session'
import {
  ListMovimentacoesQuerySchema,
  CreateMovimentacaoSchema,
} from '@/lib/validations/movimentacao'
import {
  listarPorMesAno,
  criarMovimentacao,
  AccessDeniedError,
  BusinessRuleError,
} from '@/lib/services/movimentacao.service'

/**
 * GET /api/movimentacoes?tipo=DIZIMO&mes=01&ano=2025&idCongregacao=1
 *
 * Lista movimentações por tipo, mês e ano.
 * Proteção IDOR:
 *  - SUPER_ADMIN: vê todas as congregações (ou filtra por idCongregacao)
 *  - ADMIN / USER: ignora idCongregacao e usa a congregação da sessão
 */
export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAuth()
    if (authError) return authError

    const { searchParams } = request.nextUrl

    const query = ListMovimentacoesQuerySchema.safeParse({
      tipo: searchParams.get('tipo'),
      mes: searchParams.get('mes'),
      ano: searchParams.get('ano'),
      idCongregacao: searchParams.get('idCongregacao') ?? undefined,
    })

    if (!query.success) {
      return NextResponse.json(
        { error: 'Parâmetros inválidos.', details: query.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const movimentacoes = await listarPorMesAno(
      query.data.tipo,
      query.data.mes,
      query.data.ano,
      user,
      query.data.idCongregacao
    )

    return NextResponse.json(movimentacoes, { status: 200 })
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('Erro ao listar movimentações:', error)
    return NextResponse.json({ error: 'Erro interno ao listar movimentações.' }, { status: 500 })
  }
}

/**
 * POST /api/movimentacoes
 *
 * Cria nova movimentação — restrito a ADMIN+.
 * Regras de negócio:
 *  - Dízimo requer usuarioId OU isVisitante=true
 *  - A congregação é sempre a do usuário logado (IDOR multi-tenant)
 *  - ADMIN só pode criar para usuários da sua congregação
 */
export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAuth()
    if (authError) return authError

    // Apenas ADMIN ou SUPER_ADMIN pode criar movimentações
    const perfilError = requirePerfil(user, 'ADMIN')
    if (perfilError) return perfilError

    const body = await request.json().catch(() => null)
    if (!body) {
      return NextResponse.json(
        { error: 'Corpo da requisição inválido ou ausente.' },
        { status: 400 }
      )
    }

    const validation = CreateMovimentacaoSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dados inválidos.', details: validation.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const movimentacao = await criarMovimentacao(validation.data, user)
    return NextResponse.json(movimentacao, { status: 201 })
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    if (error instanceof BusinessRuleError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error('Erro ao criar movimentação:', error)
    return NextResponse.json({ error: 'Erro interno ao criar movimentação.' }, { status: 500 })
  }
}

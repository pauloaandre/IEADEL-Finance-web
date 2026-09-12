import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser, requireAuth, requirePerfil } from '@/lib/session'
import { CreateCongregacaoSchema } from '@/lib/validations/congregacao'
import {
  listarCongregacoes,
  criarCongregacao,
} from '@/lib/services/congregacao.service'

/**
 * GET /api/congregacoes
 *
 * Endpoint público: lista todas as congregações cadastradas.
 * Replica o CongregacaoController.getCongregacao():
 * - Se chamado por SUPER_ADMIN autenticado: inclui a contagem de membros ativos.
 * - Caso contrário: omite a contagem.
 */
export async function GET() {
  try {
    const user = await getSessionUser()
    const isSuperAdmin = user?.perfil === 'SUPER_ADMIN'

    const congregacoes = await listarCongregacoes(isSuperAdmin)
    return NextResponse.json(congregacoes, { status: 200 })
  } catch (error) {
    console.error('Erro ao listar congregações:', error)
    return NextResponse.json(
      { error: 'Erro interno ao buscar congregações.' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/congregacoes
 *
 * Criação de congregação — restrito a SUPER_ADMIN.
 * Replica o CongregacaoController.criarCongregacao():
 * - Valida com Zod
 * - Cria a congregação e o usuário Visitante atrelado
 * - Retorna 201 CREATED
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Autenticação obrigatória
    const { user, error: authError } = await requireAuth()
    if (authError) return authError

    // 2. Autorização: apenas SUPER_ADMIN
    const perfilError = requirePerfil(user, 'SUPER_ADMIN')
    if (perfilError) return perfilError

    // 3. Validação do payload
    const body = await request.json().catch(() => null)
    if (!body) {
      return NextResponse.json(
        { error: 'Corpo da requisição inválido ou ausente.' },
        { status: 400 }
      )
    }

    const validation = CreateCongregacaoSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Dados inválidos.',
          details: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      )
    }

    // 4. Executa criação transacional
    const novaCongregacao = await criarCongregacao(validation.data)

    return NextResponse.json(novaCongregacao, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar congregação:', error)
    return NextResponse.json(
      { error: 'Erro interno ao processar criação da congregação.' },
      { status: 500 }
    )
  }
}

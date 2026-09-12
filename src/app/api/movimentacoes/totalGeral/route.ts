import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/session'
import { TotalGeralQuerySchema } from '@/lib/validations/movimentacao'
import { calcularTotalGeral, AccessDeniedError } from '@/lib/services/movimentacao.service'

/**
 * GET /api/movimentacoes/totalGeral?idCongregacao=1
 *
 * Retorna o saldo geral (dízimos + ofertas - despesas).
 * Proteção IDOR idêntica ao getTotalGeral() do MovimentacaoController.
 *
 * Resposta: { total: "1600.00" }
 */
export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAuth()
    if (authError) return authError

    const { searchParams } = request.nextUrl

    const query = TotalGeralQuerySchema.safeParse({
      idCongregacao: searchParams.get('idCongregacao') ?? undefined,
    })

    if (!query.success) {
      return NextResponse.json(
        { error: 'Parâmetros inválidos.', details: query.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const resultado = await calcularTotalGeral(user, query.data.idCongregacao)
    return NextResponse.json(resultado, { status: 200 })
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('Erro ao calcular total geral:', error)
    return NextResponse.json({ error: 'Erro interno ao calcular total geral.' }, { status: 500 })
  }
}

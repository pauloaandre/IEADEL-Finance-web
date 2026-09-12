import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/session'
import { TotaisQuerySchema } from '@/lib/validations/movimentacao'
import { calcularTotaisMensais, AccessDeniedError } from '@/lib/services/movimentacao.service'

/**
 * GET /api/movimentacoes/totais?mes=01&ano=2025&idCongregacao=1
 *
 * Retorna os totais mensais de dízimos, ofertas e despesas.
 * Proteção IDOR idêntica ao getTotaisPorMes() do MovimentacaoController.
 *
 * Resposta: { dizimo: "1500.00", oferta: "300.00", despesa: "200.00" }
 */
export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAuth()
    if (authError) return authError

    const { searchParams } = request.nextUrl

    const query = TotaisQuerySchema.safeParse({
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

    const totais = await calcularTotaisMensais(
      query.data.mes,
      query.data.ano,
      user,
      query.data.idCongregacao
    )

    return NextResponse.json(totais, { status: 200 })
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('Erro ao calcular totais mensais:', error)
    return NextResponse.json({ error: 'Erro interno ao calcular totais.' }, { status: 500 })
  }
}

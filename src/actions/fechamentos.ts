'use server'

import { revalidatePath } from 'next/cache'
import { requireAuth } from '@/lib/session'
import { fecharCompetenciaGeral, reabrirFilial } from '@/lib/services/fechamento.service'
import { createClient } from '@/utils/supabase/server'
import { ActionResult } from './movimentacoes'

export async function fecharCompetenciaGeralAction(
  mes: number,
  ano: number
): Promise<ActionResult<void>> {
  try {
    const { user, error: authError } = await requireAuth()
    if (authError) return { success: false, error: 'Usuário não autenticado.' }

    await fecharCompetenciaGeral(mes, ano, user)
    revalidatePath('/relatorio')
    revalidatePath('/fechamento')
    return { success: true, data: undefined }
  } catch (error: any) {
    console.error('Erro em fecharCompetenciaGeralAction:', error)
    return { success: false, error: error.message || 'Erro interno.' }
  }
}

export async function reabrirFilialAction(
  mes: number,
  ano: number,
  idCongregacao: number
): Promise<ActionResult<void>> {
  try {
    const { user, error: authError } = await requireAuth()
    if (authError) return { success: false, error: 'Usuário não autenticado.' }

    await reabrirFilial(mes, ano, idCongregacao, user)
    revalidatePath('/relatorio')
    revalidatePath('/fechamento')
    return { success: true, data: undefined }
  } catch (error: any) {
    console.error('Erro em reabrirFilialAction:', error)
    return { success: false, error: error.message || 'Erro interno.' }
  }
}

export async function listarFechamentosAction(
  mes: number,
  ano: number
): Promise<ActionResult<any[]>> {
  try {
    const { user, error: authError } = await requireAuth()
    if (authError) return { success: false, error: 'Usuário não autenticado.' }

    const supabase = await createClient()
    const { data, error } = await supabase
      .from('fechamento_mensal')
      .select('id, mes, ano, id_congregacao, status')
      .eq('mes', mes)
      .eq('ano', ano)

    if (error) throw new Error('Falha ao listar fechamentos: ' + error.message)
    return { success: true, data: data || [] }
  } catch (error: any) {
    console.error('Erro em listarFechamentosAction:', error)
    return { success: false, error: error.message || 'Erro interno.' }
  }
}

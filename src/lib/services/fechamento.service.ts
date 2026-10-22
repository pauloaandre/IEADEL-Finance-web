import { createClient } from '@/utils/supabase/server'
import { SessionUser } from '@/lib/session'
import { AccessDeniedError } from './movimentacao.service'

export async function fecharCompetenciaGeral(
  mes: number,
  ano: number,
  logado: SessionUser
): Promise<void> {
  if (logado.perfil !== 'GESTOR' && logado.perfil !== 'SUPER_ADMIN') {
    throw new AccessDeniedError('Apenas GESTOR pode realizar o fechamento geral.')
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('fn_fechar_competencia_geral', {
    p_mes: mes,
    p_ano: ano,
    p_id_gestor: logado.id
  })

  if (error) {
    throw new Error('Falha ao executar fechamento geral: ' + error.message)
  }
}

export async function reabrirFilial(
  mes: number,
  ano: number,
  idCongregacao: number,
  logado: SessionUser
): Promise<void> {
  if (logado.perfil !== 'GESTOR' && logado.perfil !== 'SUPER_ADMIN') {
    throw new AccessDeniedError('Apenas GESTOR pode reabrir uma competência.')
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('fn_reabrir_filial', {
    p_mes: mes,
    p_ano: ano,
    p_id_congregacao: idCongregacao
  })

  if (error) {
    throw new Error('Falha ao reabrir filial: ' + error.message)
  }
}

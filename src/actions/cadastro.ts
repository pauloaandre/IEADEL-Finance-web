'use server'

import { createClient } from '@/utils/supabase/server'

/**
 * Server Action para cadastrar um novo usuário via Supabase Auth.
 * O trigger `handle_new_user` no banco cria automaticamente o registro em public.usuario.
 * Após o signup, atualizamos o id_congregacao do novo usuário.
 */
export async function cadastrarUsuarioAction(input: {
    nome: string
    email: string
    senha: string
    idCongregacao: string
}): Promise<{ success: true } | { success: false; error: string }> {
    try {
        const supabase = await createClient()

        // 1. Cria o usuário no Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email: input.email,
            password: input.senha,
            options: {
                data: {
                    nome: input.nome,
                    id_congregacao: input.idCongregacao,
                },
            },
        })

        if (authError) {
            // Tratar erros conhecidos
            if (authError.message.includes('already registered') || authError.message.includes('already exists')) {
                return { success: false, error: 'Este e-mail já está cadastrado.' }
            }
            console.error('Erro no Supabase Auth signUp:', authError)
            return { success: false, error: authError.message }
        }

        if (!authData.user) {
            return { success: false, error: 'Erro ao criar usuário.' }
        }

        // 2. Atualiza a congregação do novo usuário
        //    O trigger handle_new_user já criou o registro em public.usuario com perfil USER
        //    Agora vinculamos à congregação escolhida
        const idCongNum = parseInt(input.idCongregacao, 10)
        if (!isNaN(idCongNum)) {
            const { error: updateError } = await supabase
                .from('usuario')
                .update({ id_congregacao: idCongNum, nome: input.nome })
                .eq('id_usuario', authData.user.id)

            if (updateError) {
                console.error('Erro ao vincular congregação:', updateError)
                // Não retornamos erro pois o usuário já foi criado
            }
        }

        return { success: true }
    } catch (error) {
        console.error('Erro em cadastrarUsuarioAction:', error)
        return { success: false, error: 'Erro interno ao cadastrar usuário.' }
    }
}

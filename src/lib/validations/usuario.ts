import { z } from 'zod'

export const PerfilEnum = z.enum(['USER', 'ADMIN', 'SUPER_ADMIN'])
export type PerfilType = z.infer<typeof PerfilEnum>

export const UpdateUsuarioSchema = z.object({
  nome: z
    .string()
    .trim()
    .min(2, 'Nome deve ter pelo menos 2 caracteres.')
    .max(100, 'Nome deve ter no máximo 100 caracteres.')
    .optional(),
  email: z
    .string()
    .trim()
    .email('E-mail inválido.')
    .max(150, 'E-mail deve ter no máximo 150 caracteres.')
    .optional(),
  senha: z
    .string()
    .min(6, 'Senha deve ter pelo menos 6 caracteres.')
    .max(100, 'Senha deve ter no máximo 100 caracteres.')
    .optional(),
  perfil: PerfilEnum.optional(),
  ativo: z.boolean().optional(),
  idCongregacao: z.number().int().positive().nullable().optional(),
})

export type UpdateUsuarioInput = z.infer<typeof UpdateUsuarioSchema>

export interface UsuarioResponse {
  id: number
  nome: string
  email: string
  perfil: PerfilType
  idCongregacao: number | null
  nomeCongregacao: string | null
  ativo?: boolean | null
}

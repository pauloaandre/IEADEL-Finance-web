import { z } from 'zod'

export const CreateCongregacaoSchema = z.object({
  nome: z
    .string({ error: 'O nome da congregação é obrigatório.' })
    .trim()
    .min(1, 'O nome da congregação não pode ser vazio.'),
  endereco: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((val) => (val && val.length > 0 ? val : null)),
})

export type CreateCongregacaoInput = z.infer<typeof CreateCongregacaoSchema>

export interface CongregacaoResponse {
  idCongregacao: number
  nome: string
  endereco: string | null
  quantidadeMembros?: number
}

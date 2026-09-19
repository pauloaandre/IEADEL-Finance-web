import { z } from 'zod'

export const TipoMovimentacaoEnum = z.enum(['DIZIMO', 'OFERTA', 'DESPESA'])
export type TipoMovimentacao = z.infer<typeof TipoMovimentacaoEnum>

/**
 * Schema para criação de movimentação — equivalente ao MovimentacaoDTO do Spring Boot
 * Regra de dízimo: requer usuarioId OU isVisitante === true
 */
export const CreateMovimentacaoSchema = z
  .object({
    descricao: z
      .string()
      .trim()
      .max(255, 'Descrição deve ter no máximo 255 caracteres.')
      .optional()
      .nullable(),
    valor: z
      .number({ error: 'Valor é obrigatório.' })
      .positive('Valor deve ser positivo.'),
    data: z
      .string({ error: 'Data é obrigatória.' })
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato YYYY-MM-DD.'),
    tipo: TipoMovimentacaoEnum,
    usuarioId: z.string().uuid('ID do usuário deve ser um UUID válido.').optional().nullable(),
    isVisitante: z.boolean().optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (
      data.tipo === 'DIZIMO' &&
      !data.usuarioId &&
      !data.isVisitante
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Dízimos requerem usuarioId ou flag isVisitante=true.',
        path: ['usuarioId'],
      })
    }
  })

export type CreateMovimentacaoInput = z.infer<typeof CreateMovimentacaoSchema>

/**
 * Schema para atualização — idêntico ao CreateMovimentacaoSchema
 */
export const UpdateMovimentacaoSchema = CreateMovimentacaoSchema

export type UpdateMovimentacaoInput = z.infer<typeof UpdateMovimentacaoSchema>

/**
 * Response DTO — espelha o MovimentacaoResponseDTO do Spring Boot
 */
export interface MovimentacaoResponse {
  id: number
  descricao: string | null
  valor: string  // Decimal serializado como string para preservar precisão
  data: string   // ISO date string YYYY-MM-DD
  tipo: TipoMovimentacao
  idUsuario: string | null
  nomeUsuario: string | null
  idCongregacao: number
  dataRegistro: string | null
}

/**
 * Schema de parâmetros de query para listagem por mês/ano/tipo
 */
export const ListMovimentacoesQuerySchema = z.object({
  tipo: TipoMovimentacaoEnum,
  mes: z.string().regex(/^\d{1,2}$/, 'Mês inválido.'),
  ano: z.string().regex(/^\d{4}$/, 'Ano inválido.'),
  idCongregacao: z
    .string()
    .regex(/^\d+$/, 'ID de congregação inválido.')
    .transform(Number)
    .optional(),
})

export type ListMovimentacoesQuery = z.infer<typeof ListMovimentacoesQuerySchema>

/**
 * Schema de query para totais mensais
 */
export const TotaisQuerySchema = z.object({
  mes: z.string().regex(/^\d{1,2}$/, 'Mês inválido.'),
  ano: z.string().regex(/^\d{4}$/, 'Ano inválido.'),
  idCongregacao: z
    .string()
    .regex(/^\d+$/, 'ID de congregação inválido.')
    .transform(Number)
    .optional(),
})

export type TotaisQuery = z.infer<typeof TotaisQuerySchema>

/**
 * Schema de query para total geral
 */
export const TotalGeralQuerySchema = z.object({
  idCongregacao: z
    .string()
    .regex(/^\d+$/, 'ID de congregação inválido.')
    .transform(Number)
    .optional(),
})

export type TotalGeralQuery = z.infer<typeof TotalGeralQuerySchema>

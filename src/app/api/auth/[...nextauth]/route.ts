/**
 * /api/auth/[...nextauth]/route.ts
 *
 * Ponto de entrada do Auth.js v5 para todos os endpoints de autenticação.
 * Desestrutura handlers para compatibilidade com Next.js 16 Route Handler types.
 */
import { handlers } from '@/auth'

export const { GET, POST } = handlers

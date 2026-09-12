/**
 * auth.ts — Configuração completa do Auth.js v5 (NextAuth)
 *
 * Replica o comportamento do Spring Boot:
 * - Provider Credentials: email + senha (BCrypt via bcryptjs)
 * - Sessão JWT armazenada em Cookie httpOnly
 * - session.user carrega: id, nome, email, perfil, congregacaoId
 */
import NextAuth, { CredentialsSignin } from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

// =============================================================================
// Tipos customizados — expõe perfil e congregacaoId no session.user
// =============================================================================
declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      nome: string
      email: string
      perfil: 'USER' | 'ADMIN' | 'SUPER_ADMIN'
      congregacaoId: number | null
      congregacaoNome: string | null
      ativo: boolean
    }
  }

  interface User {
    id: string
    nome: string
    email: string
    perfil: 'USER' | 'ADMIN' | 'SUPER_ADMIN'
    congregacaoId: number | null
    congregacaoNome: string | null
    ativo: boolean
  }
}

// =============================================================================
// Schema de validação Zod para as credenciais de login
// Replica o AuthenticationDTO do Spring Boot
// =============================================================================
const loginSchema = z.object({
  email: z.string().email('E-mail inválido.'),
  password: z.string().min(1, 'Senha é obrigatória.'),
})

// =============================================================================
// Erro customizado para credenciais inválidas
// =============================================================================
class InvalidCredentialsError extends CredentialsSignin {
  code = 'INVALID_CREDENTIALS'
}

// =============================================================================
// NextAuth Configuration
// =============================================================================
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      name: 'Credenciais',
      credentials: {
        email: { label: 'E-mail', type: 'email' },
        password: { label: 'Senha', type: 'password' },
      },

      async authorize(credentials) {
        // 1. Validar formato das credenciais com Zod
        const parsed = loginSchema.safeParse(credentials)
        if (!parsed.success) {
          throw new InvalidCredentialsError()
        }

        const { email, password } = parsed.data

        // 2. Buscar usuário no banco (equivalente ao UserDetailsService do Spring)
        const usuario = await prisma.usuario.findUnique({
          where: { email },
          include: { congregacao: true },
        })

        // 3. Verificar existência e status ativo
        if (!usuario || !usuario.ativo) {
          throw new InvalidCredentialsError()
        }

        if (!usuario.isVerified) {
          throw new CredentialsSignin('Email não verificado. Por favor, verifique seu email.');
        }

        // 4. Comparar senha com BCrypt (equivalente ao BCryptPasswordEncoder.matches())
        const senhaValida = await bcrypt.compare(password, usuario.senha)
        if (!senhaValida) {
          throw new InvalidCredentialsError()
        }

        // 5. Retornar objeto User que será salvo no JWT
        return {
          id: String(usuario.id),
          nome: usuario.nome,
          email: usuario.email,
          perfil: usuario.perfil as 'USER' | 'ADMIN' | 'SUPER_ADMIN',
          congregacaoId: usuario.congregacaoId ?? null,
          congregacaoNome: usuario.congregacao?.nome ?? null,
          ativo: usuario.ativo,
        }
      },
    }),
  ],

  // =============================================================================
  // Callbacks: preencher JWT e Session
  // Replica o comportamento do TokenService.generateToken() do Spring Boot
  // =============================================================================
  callbacks: {
    async jwt({ token, user }) {
      // user só está disponível no login inicial
      if (user) {
        token.id = user.id
        token.nome = user.nome
        token.perfil = user.perfil
        token.congregacaoId = user.congregacaoId
        token.congregacaoNome = user.congregacaoNome
        token.ativo = user.ativo
      }
      return token
    },

    async session({ session, token }) {
      // Propagar campos do JWT para session.user
      if (session.user) {
        session.user.id = token.id as string
        session.user.nome = token.nome as string
        session.user.perfil = token.perfil as 'USER' | 'ADMIN' | 'SUPER_ADMIN'
        session.user.congregacaoId = token.congregacaoId as number | null
        session.user.congregacaoNome = token.congregacaoNome as string | null
        session.user.ativo = token.ativo as boolean
      }
      return session
    },
  },

  // =============================================================================
  // Estratégia de sessão: JWT (stateless — igual ao Spring Boot)
  // Cookie httpOnly gerado automaticamente pelo Auth.js
  // =============================================================================
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 horas — igual ao Spring: maxAge(24 * 60 * 60)
  },

  pages: {
    signIn: '/',
  },
})

/**
 * POST /api/usuarios/novo
 *
 * Endpoint público de auto-cadastro de usuário.
 * Replica o comportamento do UsuarioController.criar() do Spring Boot:
 *  - Valida payload com Zod (equivalente ao @Valid RegisterDTO)
 *  - Verifica e-mail duplicado (equivalente ao findByEmail check)
 *  - Força perfil = USER (segurança: ignora perfil enviado pelo cliente)
 *  - Faz hash BCrypt da senha com bcryptjs
 *  - Vincula à congregação informada
 */
import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'

// =============================================================================
// Schema Zod — equivalente ao RegisterDTO do Spring Boot
// =============================================================================
const registerSchema = z.object({
  nome: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres.').max(100),
  email: z.string().email('E-mail inválido.').max(150),
  senha: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres.').max(100),
  idCongregacao: z.number({ error: 'Congregação é obrigatória.' }).int().positive(),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // 1. Validar payload com Zod
    const parsed = registerSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { errors: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { nome, email, senha, idCongregacao } = parsed.data

    // 2. Verificar se e-mail já está cadastrado (equivalente ao findByEmail check)
    const emailExistente = await prisma.usuario.findUnique({ where: { email } })
    if (emailExistente) {
      return NextResponse.json(
        { error: 'E-mail já cadastrado.' },
        { status: 400 }
      )
    }

    // 3. Verificar se a congregação existe
    const congregacao = await prisma.congregacao.findUnique({
      where: { idCongregacao },
    })
    if (!congregacao) {
      return NextResponse.json(
        { error: 'Congregação não encontrada.' },
        { status: 400 }
      )
    }

    // 4. Fazer hash BCrypt da senha (rounds=10 — mesmo padrão do BCryptPasswordEncoder)
    const senhaHash = await bcrypt.hash(senha, 10)

    // 5. Criar usuário — perfil forçado para USER (segurança: autocadastro não pode escolher perfil)
    await prisma.usuario.create({
      data: {
        nome,
        email,
        senha: senhaHash,
        perfil: 'USER',       // força USER — replica o Spring Boot
        ativo: true,
        isVerified: true,
        congregacaoId: idCongregacao,
      },
    })

    return NextResponse.json(
      { message: 'Usuário registrado com sucesso.' },
      { status: 201 }
    )
  } catch (error) {
    console.error('[POST /api/usuarios/novo]', error)
    return NextResponse.json(
      { error: 'Erro interno ao registrar usuário.' },
      { status: 500 }
    )
  }
}

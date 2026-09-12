import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { sendVerificationEmail } from '@/lib/mail';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { nome, email, senha, idCongregacao } = body;

    if (!nome || !email || !senha || !idCongregacao) {
      return NextResponse.json(
        { error: 'Todos os campos são obrigatórios.' },
        { status: 400 }
      );
    }

    // Verificar se o email já existe
    const usuarioExistente = await prisma.usuario.findUnique({
      where: { email },
    });

    if (usuarioExistente) {
      return NextResponse.json(
        { error: 'Esse email já está em uso.' },
        { status: 400 }
      );
    }

    // Hash da senha
    const salt = await bcrypt.genSalt(10);
    const senhaHash = await bcrypt.hash(senha, salt);

    // Gerar token de verificação
    const verificationToken = crypto.randomUUID();

    // Criar o usuário inativo e não verificado
    const novoUsuario = await prisma.usuario.create({
      data: {
        nome,
        email,
        senha: senhaHash,
        congregacaoId: Number(idCongregacao),
        perfil: 'USER',
        ativo: false, // Pode ser mantido false até aprovação ou verificação
        isVerified: false,
        verification_token: verificationToken,
      },
    });

    // Enviar email de verificação
    await sendVerificationEmail({
      to: email,
      token: verificationToken,
    });

    return NextResponse.json(
      { message: 'Usuário cadastrado com sucesso. Verifique seu email.' },
      { status: 201 }
    );
  } catch (error) {
    console.error('Erro no cadastro:', error);
    return NextResponse.json(
      { error: 'Ocorreu um erro ao realizar o cadastro.' },
      { status: 500 }
    );
  }
}

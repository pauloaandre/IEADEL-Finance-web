import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.redirect(new URL('/?error=TokenInvalido', req.url));
    }

    const usuario = await prisma.usuario.findFirst({
      where: { verification_token: token },
    });

    if (!usuario) {
      return NextResponse.redirect(new URL('/?error=TokenInvalidoOuExpirado', req.url));
    }

    await prisma.usuario.update({
      where: { id: usuario.id },
      data: {
        isVerified: true,
        verification_token: null,
        ativo: true, // Define como ativo também (depende da regra de negócio da IEADEL)
      },
    });

    return NextResponse.redirect(new URL('/?success=EmailVerificado', req.url));
  } catch (error) {
    console.error('Erro ao verificar email:', error);
    return NextResponse.redirect(new URL('/?error=ErroInterno', req.url));
  }
}

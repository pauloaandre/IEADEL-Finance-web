import nodemailer from 'nodemailer';

interface SendVerificationEmailParams {
  to: string;
  token: string;
}

export async function sendVerificationEmail({ to, token }: SendVerificationEmailParams) {
  // Use a URL base do aplicativo. O padrão é localhost:3000 se não definido no ambiente
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const verificationLink = `${appUrl}/api/verify-email?token=${token}`;

  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_SERVER_HOST,
    port: Number(process.env.EMAIL_SERVER_PORT),
    auth: {
      user: process.env.EMAIL_SERVER_USER,
      pass: process.env.EMAIL_SERVER_PASSWORD,
    },
    // se usar port 465 (secure: true), se usar 587 (secure: false)
    secure: Number(process.env.EMAIL_SERVER_PORT) === 465, 
  });

  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: to,
    subject: 'Verifique seu e-mail - IEADEL Finance',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Confirmação de Cadastro</h2>
        <p>Olá,</p>
        <p>Obrigado por se cadastrar no sistema IEADEL Finance. Por favor, confirme seu endereço de e-mail clicando no link abaixo:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationLink}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">
            Verificar Meu E-mail
          </a>
        </div>
        <p>Se você não se cadastrou em nosso sistema, pode ignorar este e-mail.</p>
        <hr style="border: none; border-top: 1px solid #eaeaea; margin-top: 30px;" />
        <p style="color: #666; font-size: 12px;">Se o botão não funcionar, copie e cole este link no seu navegador: ${verificationLink}</p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Email de verificação enviado para ${to}`);
  } catch (error) {
    console.error('Erro ao enviar e-mail de verificação:', error);
    throw new Error('Falha ao enviar e-mail de verificação.');
  }
}

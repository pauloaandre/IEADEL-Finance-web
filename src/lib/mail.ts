/**
 * lib/mail.ts
 *
 * NOTA: Com a migração para Supabase Auth, a verificação de e-mail é feita
 * nativamente pelo Supabase. O método supabase.auth.signUp() envia
 * automaticamente um e-mail de confirmação quando a opção está habilitada
 * no dashboard do Supabase (Authentication > Settings > Email Auth).
 *
 * Este módulo é mantido apenas para eventuais e-mails transacionais futuros
 * (ex: notificações, recuperação de senha customizada, etc.).
 */
import nodemailer from 'nodemailer';

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: SendEmailParams) {
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
    to,
    subject,
    html,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Email enviado para ${to}`);
  } catch (error) {
    console.error('Erro ao enviar e-mail:', error);
    throw new Error('Falha ao enviar e-mail.');
  }
}

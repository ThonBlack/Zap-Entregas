import nodemailer from 'nodemailer';

// Configuração do transporter com variáveis de ambiente
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false, // true para 465, false para outras portas
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

interface SendEmailOptions {
    to: string;
    subject: string;
    html: string;
}

/**
 * Envia um email genérico
 */
export async function sendEmail({ to, subject, html }: SendEmailOptions): Promise<boolean> {
    try {
        await transporter.sendMail({
            from: process.env.SMTP_FROM || process.env.SMTP_USER,
            to,
            subject,
            html,
        });
        return true;
    } catch (error) {
        console.error('Erro ao enviar email:', error);
        return false;
    }
}

/**
 * Envia email de recuperação de senha
 */
export async function sendPasswordResetEmail(to: string, resetUrl: string, userName: string): Promise<boolean> {
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #18181b;">
        <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
            <div style="background: linear-gradient(135deg, #16a34a 0%, #22c55e 100%); border-radius: 16px 16px 0 0; padding: 32px; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 28px; font-weight: bold;">⚡ Zap Entregas</h1>
            </div>
            <div style="background-color: #27272a; border-radius: 0 0 16px 16px; padding: 32px;">
                <h2 style="color: #fafafa; margin: 0 0 16px 0; font-size: 22px;">Olá, ${userName}!</h2>
                <p style="color: #a1a1aa; margin: 0 0 24px 0; font-size: 16px; line-height: 1.6;">
                    Recebemos uma solicitação para redefinir a senha da sua conta. 
                    Clique no botão abaixo para criar uma nova senha:
                </p>
                <div style="text-align: center; margin: 32px 0;">
                    <a href="${resetUrl}" 
                       style="display: inline-block; background: linear-gradient(135deg, #16a34a 0%, #22c55e 100%); 
                              color: white; text-decoration: none; padding: 16px 32px; border-radius: 12px; 
                              font-weight: bold; font-size: 16px;">
                        🔐 Redefinir Minha Senha
                    </a>
                </div>
                <div style="background-color: #3f3f46; border-radius: 8px; padding: 16px; margin: 24px 0;">
                    <p style="color: #fbbf24; margin: 0; font-size: 14px;">
                        ⚠️ <strong>Importante:</strong> Este link expira em 15 minutos.
                    </p>
                </div>
                <p style="color: #71717a; margin: 0; font-size: 14px; line-height: 1.6;">
                    Se você não solicitou a redefinição de senha, ignore este email. 
                    Sua senha atual permanecerá inalterada.
                </p>
                <hr style="border: none; border-top: 1px solid #3f3f46; margin: 24px 0;">
                <p style="color: #52525b; margin: 0; font-size: 12px; text-align: center;">
                    © 2026 Zap Entregas • Feito com 💚 no Brasil
                </p>
            </div>
        </div>
    </body>
    </html>
    `;

    return sendEmail({
        to,
        subject: '🔐 Redefinir sua senha - Zap Entregas',
        html,
    });
}

import nodemailer from 'nodemailer';

/**
 * Crea el transporter de Nodemailer usando variables de entorno.
 */
const createTransporter = (): nodemailer.Transporter | null => {
  const { MAIL_HOST, MAIL_PORT, MAIL_USER, MAIL_PASS } = process.env;

  if (!MAIL_HOST || !MAIL_USER || !MAIL_PASS) {
    return null;
  }

  return nodemailer.createTransport({
    host: MAIL_HOST,
    port: Number(MAIL_PORT) || 587,
    secure: Number(MAIL_PORT) === 465,
    auth: { user: MAIL_USER, pass: MAIL_PASS },
  });
};

export const sendVerificationEmail = async ({
  email,
  code,
}: {
  email: string;
  code: string;
}): Promise<void> => {
  if (process.env.NODE_ENV === 'test') return;

  const transporter = createTransporter();

  if (!transporter) {
    console.log(`[DEV] Codigo de verificacion para ${email}: ${code}`);
    return;
  }

  await transporter.sendMail({
    from:    process.env.MAIL_FROM || process.env.MAIL_USER,
    to:      email,
    subject: 'BildyApp — Verifica tu email',
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Verifica tu cuenta</h2>
        <p>Usa este codigo para verificar tu direccion de email:</p>
        <div style="background: #f1f5f9; padding: 24px; text-align: center;
                    border-radius: 8px; font-size: 32px; letter-spacing: 8px;
                    font-weight: bold; color: #1e293b;">
          ${code}
        </div>
        <p style="color: #64748b; font-size: 14px; margin-top: 16px;">
          Este codigo es valido para 3 intentos. Si no has solicitado esto, ignora este email.
        </p>
      </div>
    `,
  });
};

export const sendInviteEmail = async ({
  email,
  name,
  tempPassword,
}: {
  email: string;
  name: string;
  tempPassword: string;
}): Promise<void> => {
  if (process.env.NODE_ENV === 'test') return;

  const transporter = createTransporter();

  if (!transporter) {
    console.log(`[DEV] Invitacion para ${email} — contrasena temporal: ${tempPassword}`);
    return;
  }

  await transporter.sendMail({
    from:    process.env.MAIL_FROM || process.env.MAIL_USER,
    to:      email,
    subject: 'Has sido invitado a BildyApp',
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Bienvenido a BildyApp, ${name}</h2>
        <p>Has sido invitado a unirte a una compania en BildyApp.</p>
        <p>Tus credenciales temporales:</p>
        <ul>
          <li><strong>Email:</strong> ${email}</li>
          <li><strong>Contrasena temporal:</strong> <code>${tempPassword}</code></li>
        </ul>
        <p style="color: #64748b; font-size: 14px;">
          Por seguridad, cambia tu contrasena en el primer acceso.
        </p>
      </div>
    `,
  });
};

// Gmail SMTP mailer using nodemailer
// Reads credentials from .env (SMTP_* variables)
import nodemailer from 'nodemailer';

let _transporter = null;

export function isSmtpConfigured() {
  return Boolean(
    process.env.SMTP_HOST &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASSWORD &&
    process.env.SMTP_PASSWORD.length > 0
  );
}

function getTransporter() {
  if (_transporter) return _transporter;
  if (!isSmtpConfigured()) return null;
  _transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: parseInt(process.env.SMTP_PORT || '587', 10) === 465, // true for 465, false for 587 (STARTTLS)
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  });
  return _transporter;
}

/**
 * Send an email via Gmail SMTP.
 * 🛡️  SAFETY GUARD : Si MAIL_TEST_MODE=true (ou MAIL_REDIRECT_TO défini),
 * tous les destinataires sont remplacés par MAIL_REDIRECT_TO (par défaut tevageros@me.com).
 * Le sujet est préfixé [TEST→…] pour ne jamais confondre avec un envoi réel.
 * @param {Object} opts
 * @param {string} opts.to - recipient email
 * @param {string} opts.subject
 * @param {string} opts.html
 * @param {string} [opts.text] - plain text fallback
 * @param {string} [opts.replyTo]
 * @returns {Promise<{ok: boolean, messageId?: string, error?: string, redirected_from?: string}>}
 */
export async function sendMail({ to, subject, html, text, replyTo }) {
  if (!isSmtpConfigured()) {
    return { ok: false, error: 'SMTP non configuré (SMTP_PASSWORD manquant)' };
  }
  const transporter = getTransporter();
  const fromName = process.env.SMTP_FROM_NAME || 'ARACOM';
  const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER;

  // 🛡️ TEST MODE GUARD
  const testMode = String(process.env.MAIL_TEST_MODE || '').toLowerCase() === 'true';
  const redirectTo = process.env.MAIL_REDIRECT_TO || 'tevageros@me.com';
  const allowList = (process.env.MAIL_ALLOWED_RECIPIENTS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  const originalTo = to;
  let redirected = false;
  if (testMode) {
    const isAllowed = allowList.includes(String(to || '').toLowerCase());
    if (!isAllowed) {
      to = redirectTo;
      redirected = true;
      subject = `[TEST→${originalTo}] ${subject}`;
      html = `
<div style="background:#fef3c7;border:2px solid #f59e0b;padding:12px;margin-bottom:20px;border-radius:8px;font-family:Helvetica,Arial,sans-serif">
  <div style="font-weight:bold;color:#92400e">🛡️ MODE TEST ACTIVÉ</div>
  <div style="color:#78350f;font-size:13px;margin-top:4px">Ce mail aurait été envoyé à <b>${originalTo}</b> en production.<br>Pour désactiver le mode test : positionner <code>MAIL_TEST_MODE=false</code> dans les variables d'environnement.</div>
</div>
${html}`;
    }
  }

  try {
    const info = await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to,
      subject,
      html,
      text: text || stripHtml(html),
      replyTo: replyTo || fromEmail,
    });
    return { ok: true, messageId: info.messageId, redirected_from: redirected ? originalTo : undefined };
  } catch (e) {
    console.error('SMTP send error:', e.message);
    return { ok: false, error: e.message };
  }
}

/** Verify SMTP connection (for test endpoint). */
export async function verifySmtp() {
  if (!isSmtpConfigured()) {
    return { ok: false, error: 'SMTP non configuré : ajoutez SMTP_PASSWORD (App Password Gmail) dans .env' };
  }
  const transporter = getTransporter();
  try {
    await transporter.verify();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

function stripHtml(html) {
  return (html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

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
 * @param {Object} opts
 * @param {string} opts.to - recipient email
 * @param {string} opts.subject
 * @param {string} opts.html
 * @param {string} [opts.text] - plain text fallback
 * @param {string} [opts.replyTo]
 * @returns {Promise<{ok: boolean, messageId?: string, error?: string}>}
 */
export async function sendMail({ to, subject, html, text, replyTo }) {
  if (!isSmtpConfigured()) {
    return { ok: false, error: 'SMTP non configuré (SMTP_PASSWORD manquant)' };
  }
  const transporter = getTransporter();
  const fromName = process.env.SMTP_FROM_NAME || 'ARACOM';
  const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER;
  try {
    const info = await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to,
      subject,
      html,
      text: text || stripHtml(html),
      replyTo: replyTo || fromEmail,
    });
    return { ok: true, messageId: info.messageId };
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

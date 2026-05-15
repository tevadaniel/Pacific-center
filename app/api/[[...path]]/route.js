import { NextResponse } from 'next/server';
import { v4 as uuid } from 'uuid';
import { getDb } from '@/lib/mongo';
import { ASSOCIATIONS, PLANNING, VENUE_INFO } from '@/lib/seed-data';
import { sendMail, isSmtpConfigured, verifySmtp } from '@/lib/mailer';
import { getMailConfig, invalidateMailConfigCache, sendMailAuto } from '@/lib/mail-config';
import { emergentChat, DEFAULT_MODEL_CLAUDE } from '@/lib/llm';
import { savePushSubscription, deletePushSubscription, pushToRole, getVapidPublicKey, isPushConfigured } from '@/lib/push';
import { isDriveConfigured, validateAccess as driveValidate, ensureFolderPath, uploadFile as driveUploadFile, makeAnyoneReader, getServiceAccountEmail, safeName as driveSafeName } from '@/lib/drive';
import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import '@/lib/mailing-scheduler'; // Auto-start background scheduler at boot
import { seedVisitSlots, getFullAvailability, bookVisitSlot, releaseVisitSlot, getWizardState, createModificationToken, WIZARD_CONFIG } from '@/lib/wizard-helpers';
import { generateBadgePdf } from '@/lib/badge-generator';
import { restoreVenueLayoutsIfEmpty, restoreVenueLayoutsForce } from '@/lib/venue-layouts-restore';

// 🛟 Auto-restauration des plans de salles au tout premier démarrage (idempotent).
//    Lance la restauration du backup JSON embarqué si aucun stand n'a de position en DB.
let __layoutRestoreRan = false;
async function tryAutoRestoreVenueLayouts() {
  if (__layoutRestoreRan) return;
  __layoutRestoreRan = true;
  try {
    const db = await getDb();
    const r = await restoreVenueLayoutsIfEmpty(db);
    if (r?.ok) console.log('[boot] venue layouts auto-restored:', r);
    else console.log('[boot] venue layouts restore skipped:', r);
  } catch (e) { console.error('[boot] venue layouts restore error:', e?.message); }
}

// 🛡️ Garde-fou anti-envoi de mails accidentels au démarrage.
//    Si la collection app_settings.mail_config n'existe pas, ou n'a pas test_mode,
//    on force test_mode=true (sauf si la var d'env ALLOW_PROD_MAIL=true est définie,
//    auquel cas on respecte la valeur DB actuelle).
let __mailGuardRan = false;
async function tryAutoMailGuard() {
  if (__mailGuardRan) return;
  __mailGuardRan = true;
  try {
    const db = await getDb();
    const mc = await db.collection('app_settings').findOne({ key: 'mail_config' });
    const allowProd = String(process.env.ALLOW_PROD_MAIL || '').toLowerCase() === 'true';
    if (!mc) {
      await db.collection('app_settings').insertOne({
        key: 'mail_config',
        test_mode: true,
        redirect_to: process.env.MAIL_REDIRECT_TO || 'tevageros@me.com',
        allow_list: (process.env.MAIL_ALLOWED_RECIPIENTS || 'tevageros@me.com,teva.geros@aracom-conseil.fr,agence@aracom-conseil.fr,admin@aracom.pf').split(',').map(s => s.trim()).filter(Boolean),
        updated_at: new Date(),
        updated_by: 'boot-guard',
      });
      console.warn('[boot] 🛡️ mail_config absent → créé en MODE TEST (redirect=' + (process.env.MAIL_REDIRECT_TO || 'tevageros@me.com') + ')');
    } else if (mc.test_mode === false && !allowProd) {
      await db.collection('app_settings').updateOne(
        { key: 'mail_config' },
        { $set: { test_mode: true, updated_at: new Date(), updated_by: 'boot-guard' } }
      );
      console.warn('[boot] 🛡️ mail_config était en PROD → forcé en TEST (set ALLOW_PROD_MAIL=true en env pour autoriser la prod)');
    } else if (mc.test_mode === true) {
      console.log('[boot] ✅ mail_config en mode TEST (redirect=' + mc.redirect_to + ')');
    } else if (allowProd) {
      console.warn('[boot] ⚠️ mail_config en PRODUCTION (ALLOW_PROD_MAIL=true) — envois réels actifs');
    }
  } catch (e) { console.error('[boot] mail guard error:', e?.message); }
}

// ===== Tracking helpers =====

// 🆕 Helper : génère le HTML d'une attestation de remboursement avec 2 exemplaires sur 2 pages A4
function buildRefundAttestationHTML({ org, venue, reg, dep, num, today }) {
  const modeLabel = dep?.deposit_mode === 'especes' ? 'Espèces' : (dep?.deposit_mode === 'virement' ? 'Virement bancaire' : 'Chèque');
  // Construction d'UN exemplaire (réutilisé 2× avec un copy_label différent)
  const singleCopy = (copyLabel, copyNumber) => `
<div class="page">
  <div class="copy-badge">EXEMPLAIRE ${copyNumber}/2 — ${copyLabel}</div>
  <div class="header">
    <div>
      <h1>ATTESTATION DE REMBOURSEMENT DE CAUTION</h1>
      <p style="margin:0;color:#64748b">Forum de la Rentrée 2026 · 14 &amp; 15 août 2026</p>
    </div>
    <div style="text-align:right">
      <div class="brand">ARACOM</div>
      <div style="font-size:11px;color:#64748b;margin-top:6px">Émise le ${today}</div>
    </div>
  </div>
  <p style="margin-top:24px">La société <b>ARACOM</b>, organisatrice du Forum de la Rentrée 2026, atteste par la présente avoir procédé au <b>remboursement intégral</b> de la caution versée par l'exposant ci-dessous, dans le cadre de sa participation à l'événement.</p>
  <div class="box">
    <div class="row"><span class="label">N° d'attestation</span><b>${num}</b></div>
    <div class="row"><span class="label">Exposant</span><b>${org?.name || '—'}</b></div>
    <div class="row"><span class="label">Contact</span><span>${org?.contact_name || '—'}</span></div>
    <div class="row"><span class="label">Site / Stand</span><span>${venue?.name || '—'} / ${reg?.stand_code || '—'}</span></div>
    <div class="row"><span class="label">Mode de versement initial</span><b>${modeLabel}</b></div>
    <div class="row"><span class="label">Date de remboursement</span><b>${today}</b></div>
  </div>
  <div class="amount">Montant remboursé : 20 000 XPF</div>
  <p>Le remboursement est effectué après constat du respect des conditions de présence et de tenue conforme du stand sur les deux jours du Forum (vendredi 14 et samedi 15 août 2026), suite à la complétion du questionnaire de satisfaction par l'exposant.</p>
  <div class="sig">
    <div class="sig-block">
      <div style="font-weight:600;color:#1e293b;margin-bottom:24px">Pour <b>ARACOM</b></div>
      <div style="border-top:1px solid #cbd5e1;padding-top:6px;font-size:11px;color:#64748b">Date &amp; signature</div>
    </div>
    <div class="sig-block">
      <div style="font-weight:600;color:#1e293b;margin-bottom:24px">L'exposant <b>${org?.name || ''}</b></div>
      <div style="border-top:1px solid #cbd5e1;padding-top:6px;font-size:11px;color:#64748b">Date &amp; signature</div>
    </div>
  </div>
  <p class="footer-note">Document officiel — Forum de la Rentrée 2026 · ${num} · Exemplaire ${copyNumber} sur 2</p>
</div>`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Attestation de remboursement ${org?.name || ''} (2 exemplaires)</title>
<style>
* { box-sizing: border-box; }
body { font-family: Helvetica, Arial, sans-serif; margin: 0; color: #1f2937; background: #f1f5f9; }
.page {
  width: 210mm;
  min-height: 270mm;
  padding: 18mm 18mm 14mm 18mm;
  margin: 12px auto;
  background: white;
  box-shadow: 0 2px 12px rgba(0,0,0,0.08);
  position: relative;
  page-break-after: always;
  line-height: 1.55;
}
.page:last-child { page-break-after: auto; }
.copy-badge {
  position: absolute; top: 8mm; right: 18mm;
  background: #059669; color: white;
  font-size: 10px; font-weight: 700; letter-spacing: .08em;
  padding: 4px 10px; border-radius: 4px;
}
h1 { color: #059669; margin: 0 0 4px; font-size: 22px; }
.header { display: flex; justify-content: space-between; align-items: start; border-bottom: 3px solid #059669; padding-bottom: 10px; margin-top: 12mm; }
.brand { background: #059669; color: #fff; font-weight: 700; padding: 6px 12px; border-radius: 6px; display: inline-block; letter-spacing: .05em; }
.box { border: 2px solid #059669; padding: 18px; border-radius: 8px; margin: 20px 0; background: #f0fdf4; }
.row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px dashed #d1fae5; }
.row:last-child { border-bottom: 0; }
.label { color: #475569; }
.amount { font-size: 26px; color: #059669; font-weight: 800; text-align: center; margin: 14px 0; padding: 10px; background: #ecfdf5; border-radius: 8px; }
.sig { display: flex; justify-content: space-between; margin-top: 30px; gap: 24px; }
.sig-block { flex: 1; padding-top: 8px; }
.footer-note { font-size: 10px; color: #94a3b8; margin-top: 24px; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 6px; }
.print-btn-bar {
  position: fixed; top: 16px; right: 16px; z-index: 100;
  display: flex; gap: 8px;
}
.print-btn {
  padding: 10px 18px;
  border-radius: 6px;
  background: #059669;
  color: #fff;
  border: 0;
  cursor: pointer;
  font-weight: 600;
  font-size: 13px;
  box-shadow: 0 2px 8px rgba(5, 150, 105, 0.3);
}
.print-btn.secondary { background: #475569; box-shadow: 0 2px 8px rgba(71, 85, 105, 0.3); }
.tip {
  max-width: 210mm; margin: 12px auto 0; padding: 10px 16px;
  background: #fef3c7; border-left: 4px solid #f59e0b; color: #92400e;
  font-size: 12px; border-radius: 0 6px 6px 0;
}
@media print {
  body { background: white; }
  .print-btn-bar, .tip { display: none !important; }
  .page { box-shadow: none; margin: 0; }
  @page { size: A4; margin: 0; }
}
</style></head>
<body>
<div class="print-btn-bar">
  <button class="print-btn" onclick="window.print()">🖨️ Imprimer les 2 exemplaires</button>
  <button class="print-btn secondary" onclick="window.close()">Fermer</button>
</div>
<div class="tip">
  💡 <b>Conseil d'impression</b> : cliquez sur "Imprimer les 2 exemplaires", choisissez votre imprimante,
  et le document s'imprimera sur <b>2 feuilles A4 identiques</b>. Faites signer les deux par l'exposant (un exemplaire pour ARACOM, un pour l'exposant).
</div>
${singleCopy('ARACOM', 1)}
${singleCopy('EXPOSANT', 2)}
</body></html>`;
}

/**
 * Get the public base URL for emails / access links / etc.
 * 🛡️ Stratégie : priorité à l'origine de la requête entrante (preserves preview vs production)
 *    1. Si request est passé → utiliser x-forwarded-host + x-forwarded-proto (or origin/referer)
 *    2. Sinon → fallback sur NEXT_PUBLIC_BASE_URL (.env)
 *    3. Sinon → localhost
 * Ainsi, en preview les liens pointent vers preview, en prod vers prod, sans configuration .env spécifique.
 */
function getPublicBaseUrl(request) {
  if (request) {
    try {
      const h = request.headers;
      const xfHost = h.get?.('x-forwarded-host') || h.get?.('host');
      const xfProto = h.get?.('x-forwarded-proto') || 'https';
      // Liste des hosts considérés comme "local/dev" → on préfère le fallback env si dispo
      const isLocalHost = (host) => !host || host.includes('localhost') || host.includes('127.0.0.1') || host.includes('0.0.0.0');
      if (xfHost && !isLocalHost(xfHost)) {
        return `${xfProto}://${xfHost}`;
      }
      const origin = h.get?.('origin');
      if (origin && /^https?:\/\//.test(origin)) {
        try {
          const ou = new URL(origin);
          if (!isLocalHost(ou.host)) return origin;
        } catch { /* ignore */ }
      }
      if (request.url) {
        const u = new URL(request.url);
        if (!isLocalHost(u.host)) return `${u.protocol}//${u.host}`;
      }
    } catch (_e) { /* ignore */ }
  }
  return process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
}
/**
 * Inject tracking pixel + wrap links for click tracking
 * @param {string} html - email body HTML
 * @param {string} messageId - email_messages.id
 * @returns {string} HTML with tracking instrumentation
 */
function injectTracking(html, messageId, baseUrl) {
  if (!html) return html;
  const base = baseUrl || getPublicBaseUrl();
  // Wrap <a href="..."> to redirect through our tracker
  let out = html.replace(/<a([^>]*?)href="(https?:\/\/[^"]+)"([^>]*?)>/gi, (m, pre, url, post) => {
    if (url.includes('/api/track/')) return m; // avoid double-wrap
    const tracked = `${base}/api/track/click/${messageId}?u=${encodeURIComponent(url)}`;
    return `<a${pre}href="${tracked}"${post}>`;
  });
  // Append 1x1 tracking pixel
  out += `\n<img src="${base}/api/track/open/${messageId}.gif" alt="" width="1" height="1" style="display:none" />`;
  return out;
}

/**
 * Sanitize email HTML generated by the AI (or pasted by admin):
 * - Replace ANY mailto: that is NOT towards a real ARACOM address (agence@ / teva.geros@)
 *   by a working mailto:agence@aracom-conseil.fr (preserving the ?subject=... if any).
 * - This protects against the LLM hallucinating fake addresses like "contact@aracom.pf".
 */
function sanitizeEmailHtml(html) {
  if (!html) return html;
  const ALLOWED = new Set(['agence@aracom-conseil.fr', 'teva.geros@aracom-conseil.fr', 'admin@aracom.pf']);
  const FALLBACK = 'agence@aracom-conseil.fr';
  return html.replace(/mailto:([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})([^"'\s<>]*)/g, (m, addr, query) => {
    const lower = addr.toLowerCase();
    if (ALLOWED.has(lower)) return `mailto:${addr}${query}`;
    return `mailto:${FALLBACK}${query}`;
  });
}

/**
 * Get-or-create a permanent access magic link for an exposant.
 * Returns the full URL (https://.../access/TOKEN).
 * Reuses the most recent non-revoked token if it exists, otherwise creates one.
 */
async function getOrCreateExposantAccessUrl(db, organizationId, email, request) {
  if (!organizationId && !email) return null;
  const query = organizationId
    ? { organization_id: organizationId, purpose: 'exposant', revoked_at: null }
    : { email: String(email || '').toLowerCase().trim(), purpose: 'exposant', revoked_at: null };
  let tk = await db.collection('access_tokens').findOne(query, { sort: { created_at: -1 } });
  if (!tk) {
    const tokenStr = uuid().replace(/-/g, '') + uuid().replace(/-/g, '').slice(0, 16);
    const tokenId = uuid();
    await db.collection('access_tokens').insertOne({
      id: tokenId,
      token: tokenStr,
      purpose: 'exposant',
      organization_id: organizationId || null,
      email: email || null,
      label: 'Espace exposant (auto, mailing)',
      expires_at: null,
      revoked_at: null,
      last_used_at: null,
      last_email_sent_at: null,
      use_count: 0,
      created_at: new Date(),
      updated_at: new Date(),
      created_by: 'mailing_auto',
    });
    tk = { token: tokenStr };
  }
  return `${getPublicBaseUrl(request)}/access/${tk.token}`;
}

/**
 * Whitelist of action placeholders → corresponding tab in the exposant portal.
 * The AI can ONLY use these placeholders. Anything else is rejected by the sanitizer.
 */
const EXPOSANT_ACTIONS = {
  '[[MON_ESPACE]]':              { tab: null,           label: 'Accéder à mon espace' },
  '[[MON_ESPACE_PROFIL]]':       { tab: 'profil',       label: 'Mettre à jour mon profil' },
  '[[MON_ESPACE_SITES]]':        { tab: 'sites',        label: 'Confirmer mes sites' },
  '[[MON_ESPACE_ANIMATION]]':    { tab: 'animation',    label: 'Détailler mon animation' },
  '[[MON_ESPACE_DOCS]]':         { tab: 'docs',         label: 'Téléverser mes documents' },
  '[[MON_ESPACE_ASSURANCE]]':    { tab: 'docs',         label: 'Téléverser mon attestation d\'assurance' },
  '[[MON_ESPACE_CONVENTION]]':   { tab: 'docs',         label: 'Signer ma convention' },
  '[[MON_ESPACE_CAUTION]]':      { tab: 'docs',         label: 'Régler ma caution' },
  '[[MON_ESPACE_LOGISTIQUE]]':   { tab: 'logistique',   label: 'Compléter mes besoins logistiques' },
  '[[MON_ESPACE_SATISFACTION]]': { tab: 'satisfaction', label: 'Donner mon avis' },
  '[[MON_ESPACE_GUIDE]]':        { tab: 'guide',        label: 'Consulter le guide pratique' },
};

/** Map a mail_type to the most appropriate action placeholder. */
function mailTypeToDefaultAction(mailType) {
  const map = {
    relance_caution: '[[MON_ESPACE_CAUTION]]',
    relance_convention: '[[MON_ESPACE_CONVENTION]]',
    relance_assurance: '[[MON_ESPACE_ASSURANCE]]',
    relance_generale: '[[MON_ESPACE_DOCS]]',
    confirmation: '[[MON_ESPACE]]',
    invitation_inscription: '[[MON_ESPACE]]',
    invitation_satisfaction: '[[MON_ESPACE_SATISFACTION]]',
    remerciement: '[[MON_ESPACE_SATISFACTION]]',
  };
  return map[mailType] || '[[MON_ESPACE]]';
}

/**
 * Replace all action placeholders [[MON_ESPACE_*]] with the corresponding URL
 * (magic link + tab anchor when applicable).
 */
function expandActionPlaceholders(html, accessUrl) {
  if (!html || !accessUrl) return html;
  let out = html;
  for (const [placeholder, def] of Object.entries(EXPOSANT_ACTIONS)) {
    const url = def.tab ? `${accessUrl}?tab=${def.tab}` : accessUrl;
    // escape brackets for regex
    const escaped = placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(new RegExp(escaped, 'g'), url);
  }
  // Backwards-compat
  out = out.replaceAll('[[ACCESS_LINK]]', accessUrl);
  return out;
}

/**
 * Replace mailto:agence@aracom-conseil.fr links in body_html with a real HTTP magic-link URL,
 * AND append a fallback contact footer at the bottom.
 *
 * This solves the “mailto: opens blank page” problem on iCloud / Safari without default mail client.
 * Recipients now click → arrive in their personal exposant space → they can complete docs, reply, etc.
 */
function replaceContactWithAccessLink(html, accessUrl) {
  if (!html) return html;
  let out = html;
  if (accessUrl) {
    // Replace href="mailto:agence@aracom-conseil.fr..." with href="ACCESS_URL"
    out = out.replace(/href=(["'])mailto:agence@aracom-conseil\.fr[^"']*\1/gi, `href=$1${accessUrl}$1`);
    // Replace common French CTA labels inside <a>...<a> when they were mailto-bound
    out = out.replace(
      /(<a[^>]+href=["']mailto:agence@aracom-conseil\.fr[^"']*["'][^>]*>)([\s\S]*?)(<\/a>)/gi,
      (m, open, _inner, close) => `${open.replace(/href=["']mailto:[^"']+["']/i, `href="${accessUrl}"`)}Accéder à mon espace${close}`
    );
  }
  // Append a fallback contact line if not already present
  if (!/agence@aracom-conseil\.fr/.test(out) || !out.includes('💬')) {
    out += `
<hr style="margin:28px 0 12px;border:0;border-top:1px solid #e2e8f0" />
<p style="font-size:11px;color:#64748b;line-height:1.6;margin:6px 0">
💬 Si le bouton ne fonctionne pas, vous pouvez aussi nous écrire directement à
<a href="mailto:agence@aracom-conseil.fr" style="color:#1d4ed8">agence@aracom-conseil.fr</a>
${accessUrl ? `<br/>🔗 Ou copier-coller ce lien dans votre navigateur : <span style="word-break:break-all;color:#475569">${accessUrl}</span>` : ''}
</p>`;
  }
  return out;
}

/**
 * 🛡️ STRICT LINK GUARD — Reject any <a href> that doesn't match the strict whitelist.
 *
 * Allowed targets :
 *   1. The exposant magic link (accessUrl) and its variants with ?tab=...
 *   2. mailto: agence@aracom-conseil.fr
 *   3. mailto: any address from MAIL_ALLOWED_RECIPIENTS
 *   4. Any URL on our own production base (NEXT_PUBLIC_BASE_URL)
 *
 * For ANY other URL or mailto: → unwrap the <a> tag (keep the visible text, remove the link).
 * This guarantees the AI cannot send users to fictional pages.
 *
 * Called AFTER expandActionPlaceholders so all legitimate placeholders have already been resolved.
 */
function guardLinks(html, accessUrl) {
  if (!html) return html;
  const baseUrl = getPublicBaseUrl();
  const ALLOWED_MAILTO = new Set(['agence@aracom-conseil.fr', 'teva.geros@aracom-conseil.fr', 'admin@aracom.pf']);
  const isAllowed = (href) => {
    if (!href) return false;
    if (accessUrl && href.startsWith(accessUrl)) return true;
    if (baseUrl && href.startsWith(baseUrl)) return true;
    if (href.startsWith(`${baseUrl}/api/track/`)) return true; // tracking wrapper safe
    if (href.startsWith('mailto:')) {
      const addr = href.slice(7).split('?')[0].toLowerCase();
      return ALLOWED_MAILTO.has(addr);
    }
    return false;
  };
  // Unwrap any <a> whose href is not whitelisted (preserve inner content)
  return html.replace(
    /<a([^>]*?)href=["']([^"']+)["']([^>]*)>([\s\S]*?)<\/a>/gi,
    (m, _pre, href, _post, inner) => {
      if (isAllowed(href)) return m;
      // Replace by the magic link if we have one (so the button still works), otherwise unwrap.
      if (accessUrl) {
        return `<a href="${accessUrl}" style="color:#2563eb;text-decoration:underline">${inner}</a>`;
      }
      return inner; // unwrap → just keep the text
    }
  );
}

const EDITION_ID = 'edition-2026';

// 🆕 No-cache headers pour éviter que le navigateur garde des réponses obsolètes
//    (notamment pour /api/venues, /api/dashboard/*, /api/registrations etc.)
const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  'Pragma': 'no-cache',
  'Expires': '0',
  'Surrogate-Control': 'no-store',
};
const json = (data, status = 200) => NextResponse.json(data, { status, headers: NO_CACHE_HEADERS });
const err = (message, status = 400) => NextResponse.json({ error: message }, { status });

function getUserContext(request) {
  return {
    userId: request.headers.get('x-user-id') || null,
    role: request.headers.get('x-user-role') || null,
  };
}

async function logActivity(db, userId, entity_type, entity_id, action_type, old_values, new_values) {
  await db.collection('activity_logs').insertOne({
    id: uuid(),
    user_id: userId,
    entity_type,
    entity_id,
    action_type,
    old_values_json: old_values || null,
    new_values_json: new_values || null,
    created_at: new Date(),
  });
}

// ---------- SEED ----------
async function doSeed(force = false) {
  const db = await getDb();
  const existing = await db.collection('registrations').countDocuments();
  if (existing > 0 && !force) return { seeded: false, message: 'Données déjà présentes. Utilisez force=true pour réinitialiser.' };

  // Clear
  const cols = ['users','roles','organizations','organization_contacts','organization_history','organization_preferences','editions','venues','venue_stands','registrations','stand_assignments','animation_slots','registration_documents','deposit_transactions','email_campaigns','email_messages','tasks_or_followups','attendance_sessions','attendance_events','registration_anomalies','field_comments','field_media','post_event_reports','activity_logs'];
  for (const c of cols) await db.collection(c).deleteMany({});

  // Roles
  const roles = [
    { id: 'role-admin', code: 'aracom_admin', label: 'Administrateur ARACOM' },
    { id: 'role-exposant', code: 'exposant', label: 'Exposant' },
    { id: 'role-pc', code: 'pacific_centers_readonly', label: 'Pacific Centers (lecture seule)' },
  ];
  await db.collection('roles').insertMany(roles);

  // Users (demo accounts)
  const users = [
    { id: 'u-admin', email: 'admin@aracom.pf', full_name: 'ARACOM Admin', phone: null, role_id: 'role-admin', role_code: 'aracom_admin', password: 'demo', is_active: true, created_at: new Date(), updated_at: new Date() },
    { id: 'u-teva', email: 'teva.geros@aracom-conseil.fr', full_name: 'Teva Geros', phone: '+(689) 87 210 444', role_id: 'role-admin', role_code: 'aracom_admin', password: 'Projetaracom12', is_active: true, created_at: new Date(), updated_at: new Date() },
    { id: 'u-pc', email: 'pacific@centers.pf', full_name: 'Pacific Centers', phone: null, role_id: 'role-pc', role_code: 'pacific_centers_readonly', password: 'demo', is_active: true, created_at: new Date(), updated_at: new Date() },
  ];

  // Edition
  await db.collection('editions').insertOne({
    id: EDITION_ID, name: 'Forum de la Rentrée 2026', year: 2026,
    start_date: '2026-08-14', end_date: '2026-08-15', status: 'actif',
    created_at: new Date(), updated_at: new Date(),
  });

  // Venues + Stands
  const venueIdByName = {};
  for (const v of VENUE_INFO) {
    const venueId = `venue-${v.code.toLowerCase()}`;
    venueIdByName[v.name] = venueId;
    await db.collection('venues').insertOne({
      id: venueId, edition_id: EDITION_ID, name: v.name, code: v.code,
      capacity_stands: v.stand_count, address: `${v.name}, Polynésie française`,
      is_active: true,
      is_available_2026: v.is_available_2026 !== false,
      created_at: new Date(), updated_at: new Date(),
    });
    const stands = [];
    for (let i = 1; i <= v.stand_count; i++) {
      const code = `${v.prefix}${String(i).padStart(2, '0')}`;
      stands.push({
        id: `stand-${code}`, venue_id: venueId, stand_code: code,
        zone: v.prefix, size_label: 'standard', is_premium: i <= 2, is_active: true,
        notes: null, created_at: new Date(), updated_at: new Date(),
      });
    }
    if (stands.length) await db.collection('venue_stands').insertMany(stands);
  }

  // Organizations + contacts + history + exposant users
  const orgIdByN = {};
  for (const a of ASSOCIATIONS) {
    const orgId = `org-${a.n}`;
    orgIdByN[a.n] = orgId;
    await db.collection('organizations').insertOne({
      id: orgId, name: a.name, discipline: a.discipline,
      priority_level: a.prio === 'prospect' ? 'prospect' : a.prio,
      main_email: a.email, main_phone: a.tel, contact_name: a.contact,
      notes: null, source_origin: 'import_excel_2026',
      created_at: new Date(), updated_at: new Date(),
    });
    if (a.contact) {
      await db.collection('organization_contacts').insertOne({
        id: uuid(), organization_id: orgId, full_name: a.contact,
        role_label: 'Contact principal', email: a.email, phone: a.tel,
        is_primary: true, created_at: new Date(), updated_at: new Date(),
      });
    }
    for (const y of a.hist) {
      await db.collection('organization_history').insertOne({
        id: uuid(), organization_id: orgId, year: y, participated: true,
        comment: null, created_at: new Date(),
      });
    }
    // Preferences
    for (let i = 0; i < a.sites.length; i++) {
      const vid = venueIdByName[a.sites[i]];
      if (vid) {
        await db.collection('organization_preferences').insertOne({
          id: uuid(), organization_id: orgId, edition_id: EDITION_ID,
          venue_id: vid, preference_rank: i + 1, is_eligible: true,
          source: 'import_excel', created_at: new Date(),
        });
      }
    }
    // Create exposant user for each association with email
    if (a.email) {
      users.push({
        id: `u-exp-${a.n}`, email: a.email, full_name: a.contact || a.name,
        phone: a.tel, role_id: 'role-exposant', role_code: 'exposant',
        password: 'demo', organization_id: orgId, is_active: true,
        created_at: new Date(), updated_at: new Date(),
      });
    }
  }
  await db.collection('users').insertMany(users);

  // Registrations + stand_assignments + animation_slots + deposits
  for (const venueBlock of PLANNING) {
    const venueId = venueIdByName[venueBlock.site];
    for (const row of venueBlock.rows) {
      const a = ASSOCIATIONS.find(x => x.n === row.n);
      if (!a) continue;
      const orgId = orgIdByN[a.n];
      const regId = `reg-${venueBlock.site.toLowerCase()}-${row.stand}`;
      const standId = `stand-${row.stand}`;
      // registration
      const reg = {
        id: regId, edition_id: EDITION_ID, organization_id: orgId,
        venue_id: venueId, status: row.status,
        animation_type: a.animation,
        friday_slot_label: row.status !== 'prospect' ? 'Oui' : null,
        saturday_slot_label: row.status !== 'prospect' ? 'Oui' : null,
        stand_needed: true, completion_percent: row.status === 'a_confirmer' ? 40 : (row.status === 'a_relancer' ? 20 : 0),
        is_convention_signed: false, is_deposit_required: true, is_deposit_received: false,
        is_insurance_uploaded: false, is_guide_sent: false,
        planned_arrival_time: '10:30', planned_departure_time: '17:00',
        post_event_status: 'en_attente', post_event_summary: null,
        internal_notes: null, stand_code: row.stand,
        created_at: new Date(), updated_at: new Date(),
      };
      await db.collection('registrations').insertOne(reg);
      await db.collection('stand_assignments').insertOne({
        id: uuid(), registration_id: regId, venue_stand_id: standId,
        assigned_by: 'u-admin', assigned_at: new Date(),
        status: row.status === 'prospect' ? 'provisoire' : 'provisoire',
        created_at: new Date(), updated_at: new Date(),
      });
      // animation slots for both days (if not prospect)
      if (row.status !== 'prospect') {
        for (const d of [{ label: 'vendredi', date: '2026-08-14', start: '11:00', end: '17:00' },
                         { label: 'samedi', date: '2026-08-15', start: '09:00', end: '17:00' }]) {
          await db.collection('animation_slots').insertOne({
            id: uuid(), registration_id: regId, venue_id: venueId,
            day_label: d.label, event_date: d.date,
            start_time: d.start, end_time: d.end,
            title: a.animation, slot_type: 'animation', status: 'planifié',
            notes: null, created_at: new Date(), updated_at: new Date(),
          });
        }
      }
      // deposit record
      await db.collection('deposit_transactions').insertOne({
        id: uuid(), registration_id: regId, amount_xpf: 20000,
        status: 'non_demandee', payment_method: null,
        received_at: null, expected_return_date: '2026-08-30', returned_at: null,
        retained_reason: null, retained_amount_xpf: 0, receipt_document_id: null,
        post_event_review_status: 'non_revu', post_event_review_comment: null,
        recommended_return_amount_xpf: 20000, notes: null,
        created_at: new Date(), updated_at: new Date(),
      });
    }
  }

  // Seed email campaign (reinscription)
  const campaignId = uuid();
  await db.collection('email_campaigns').insertOne({
    id: campaignId, edition_id: EDITION_ID, name: 'Réinscription 2026',
    campaign_type: 'reinscription', status: 'pret', created_by: 'u-admin',
    created_at: new Date(), updated_at: new Date(),
  });

  return { seeded: true, associations: ASSOCIATIONS.length, stands_planned: PLANNING.reduce((a, b) => a + b.rows.length, 0) };
}

// ---------- KPI ----------
function computeCompletion(reg, hasStand) {
  let pct = 0;
  if (reg.status && reg.status !== 'prospect') pct += 15;              // inscription démarrée
  if (hasStand || reg.stand_code) pct += 20;                           // stand affecté
  if (reg.is_insurance_uploaded) pct += 25;                            // assurance
  if (reg.is_deposit_received) pct += 20;                              // caution reçue
  if (reg.is_convention_signed) pct += 15;                             // convention signée
  if (reg.status === 'confirme') pct += 5;                             // confirmation finale
  return Math.min(100, pct);
}

async function computeKpis(db, userRole = null) {
  // 🆕 Filtrage par sites visibles selon rôle (Pacific/Exposant ne voient pas les sites masqués)
  let allowedVenueIds = null;
  if (userRole === 'pacific_centers_readonly' || userRole === 'exposant') {
    const flag = userRole === 'pacific_centers_readonly' ? 'pacific_visible' : 'exposant_visible';
    const venues = await db.collection('venues').find({ edition_id: EDITION_ID }).toArray();
    allowedVenueIds = new Set(venues.filter(v => v.is_available_2026 !== false && v[flag] !== false).map(v => v.id));
  }
  const q = { edition_id: EDITION_ID };
  if (allowedVenueIds) q.venue_id = { $in: [...allowedVenueIds] };
  const regs = await db.collection('registrations').find(q).toArray();
  const regIds = new Set(regs.map(r => r.id));
  const depAll = await db.collection('deposit_transactions').find({}).toArray();
  const deposits = allowedVenueIds ? depAll.filter(d => regIds.has(d.registration_id)) : depAll;
  const depById = {};
  deposits.forEach(d => { depById[d.registration_id] = d; });
  const total = regs.length;
  const by_status = {};
  for (const r of regs) by_status[r.status] = (by_status[r.status] || 0) + 1;
  const cautions_recues = deposits.filter(d => d.status === 'recue').length;
  const cautions_en_attente = deposits.filter(d => ['demandee','en_attente'].includes(d.status)).length;
  const conv_signed = regs.filter(r => r.is_convention_signed).length;
  const docs_manquants = regs.filter(r => !r.is_insurance_uploaded).length;
  const xpf_encaisses = deposits.filter(d => d.status === 'recue').reduce((s, d) => s + (d.amount_xpf || 0), 0);
  const xpf_en_attente = deposits.filter(d => ['demandee','en_attente'].includes(d.status)).reduce((s, d) => s + (d.amount_xpf || 0), 0);
  return { total, by_status, cautions_recues, cautions_en_attente, conv_signed, docs_manquants, xpf_encaisses, xpf_en_attente };
}

async function computeBySite(db) {
  const venues = await db.collection('venues').find({ edition_id: EDITION_ID }).toArray();
  const regs = await db.collection('registrations').find({ edition_id: EDITION_ID }).toArray();
  const deposits = await db.collection('deposit_transactions').find({}).toArray();
  const depByReg = {}; deposits.forEach(d => { depByReg[d.registration_id] = d; });
  return venues.map(v => {
    const vregs = regs.filter(r => r.venue_id === v.id);
    const confirmed = vregs.filter(r => r.status === 'confirme').length;
    const to_confirm = vregs.filter(r => r.status === 'a_confirmer').length;
    const to_follow_up = vregs.filter(r => r.status === 'a_relancer').length;
    const prospects = vregs.filter(r => r.status === 'prospect').length;
    const cautions_recues = vregs.filter(r => depByReg[r.id]?.status === 'recue').length;
    const conv_signed = vregs.filter(r => r.is_convention_signed).length;
    const assigned = vregs.length;
    const remplissage = v.capacity_stands > 0 ? Math.round((confirmed / v.capacity_stands) * 100) : 0;
    return {
      venue_id: v.id, venue_name: v.name, venue_code: v.code,
      capacity_stands: v.capacity_stands, assigned, confirmed, to_confirm, to_follow_up, prospects,
      cautions_recues, conv_signed, remplissage,
    };
  });
}

// ---------- ROUTING ----------
export async function GET(request, { params }) {
  try {
    // 🛟 Auto-restauration des plans au premier hit (idempotent, tourne 1 seule fois)
    tryAutoRestoreVenueLayouts();
    // 🛡️ Garde-fou anti-envoi mail accidentel (idempotent, tourne 1 seule fois)
    tryAutoMailGuard();
    const db = await getDb();
    const p = params.path || [];
    const route = p.join('/');
    const url = new URL(request.url);
    // 🛡️ ctx is needed by several handlers below — declare once here so it's always available
    const ctx = getUserContext(request);

    if (route === '' || route === 'health') return json({ ok: true, service: 'Forum Rentrée 2026' });

    // ════════════════════════════════════════════════════════════════
    // 🎯 WIZARD — Endpoints GET (disponibilités + état)
    // ════════════════════════════════════════════════════════════════

    // Disponibilités complètes (toutes venues + jours + créneaux)
    if (route === 'wizard/availability') {
      const data = await getFullAvailability(db);
      return json(data);
    }

    // 📄 Génère la Convention de Participation en PDF (avec données live)
    if (route.match(/^exposant\/documents\/convention\/[^/]+$/)) {
      const regId = p[3];
      const reg = await db.collection('registrations').findOne({ id: regId });
      if (!reg) return err('Inscription introuvable', 404);
      const org = await db.collection('organizations').findOne({ id: reg.organization_id });
      const venue = reg.venue_id ? await db.collection('venues').findOne({ id: reg.venue_id }) : null;
      const animations = await db.collection('animation_slots').find({ registration_id: regId, status: { $ne: 'annulé' } }).toArray();
      try {
        const { generateConventionPDF } = await import('@/lib/document-generator');
        const pdf = await generateConventionPDF({ registration: reg, organization: org, venue, animations });
        return new NextResponse(pdf, {
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `inline; filename="Convention_${(org?.name || 'exposant').replace(/[^a-z0-9_-]/gi, '_')}.pdf"`,
            'Cache-Control': 'no-cache',
          },
        });
      } catch (e) {
        console.error('[convention-pdf]', e);
        return err('Erreur génération PDF : ' + e.message, 500);
      }
    }

    // 📕 Génère le Guide de l'Exposant en PDF (personnalisé)
    if (route.match(/^exposant\/documents\/guide\/[^/]+$/)) {
      const regId = p[3];
      const reg = await db.collection('registrations').findOne({ id: regId });
      if (!reg) return err('Inscription introuvable', 404);
      const org = await db.collection('organizations').findOne({ id: reg.organization_id });
      const venue = reg.venue_id ? await db.collection('venues').findOne({ id: reg.venue_id }) : null;
      const animations = await db.collection('animation_slots').find({ registration_id: regId, status: { $ne: 'annulé' } }).toArray();
      try {
        const { generateGuidePDF } = await import('@/lib/document-generator');
        const pdf = await generateGuidePDF({ registration: reg, organization: org, venue, animations });
        return new NextResponse(pdf, {
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `inline; filename="Guide_Exposant_${(org?.name || 'exposant').replace(/[^a-z0-9_-]/gi, '_')}.pdf"`,
            'Cache-Control': 'no-cache',
          },
        });
      } catch (e) {
        console.error('[guide-pdf]', e);
        return err('Erreur génération PDF : ' + e.message, 500);
      }
    }

    // 📝 Questionnaire VIERGE — version imprimable (avec ou sans pré-remplissage org)
    if (route === 'exposant/documents/questionnaire-blank' || route.match(/^exposant\/documents\/questionnaire-blank\/[^/]+$/)) {
      const regId = p[3] || null;  // optionnel
      let reg = null, org = null, venue = null;
      if (regId) {
        reg = await db.collection('registrations').findOne({ id: regId });
        if (reg) {
          org = await db.collection('organizations').findOne({ id: reg.organization_id });
          venue = reg.venue_id ? await db.collection('venues').findOne({ id: reg.venue_id }) : null;
        }
      }
      try {
        const { generateQuestionnaireBlankPDF } = await import('@/lib/document-generator');
        const pdf = await generateQuestionnaireBlankPDF({ organization: org, registration: reg, venue });
        return new NextResponse(pdf, {
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `inline; filename="Questionnaire_Vierge_${(org?.name || 'forum2026').replace(/[^a-z0-9_-]/gi, '_')}.pdf"`,
            'Cache-Control': 'no-cache',
          },
        });
      } catch (e) {
        console.error('[questionnaire-blank-pdf]', e);
        return err('Erreur génération PDF : ' + e.message, 500);
      }
    }

    // 📋 Questionnaire REMPLI — récapitulatif des réponses soumises
    if (route.match(/^exposant\/documents\/questionnaire\/[^/]+$/)) {
      const orgId = p[3];
      const response = await db.collection('satisfaction_responses').findOne({ organization_id: orgId });
      if (!response) return err('Aucune réponse trouvée pour cette organisation', 404);
      const org = await db.collection('organizations').findOne({ id: orgId });
      const venue = response.venue_id ? await db.collection('venues').findOne({ id: response.venue_id }) : null;
      try {
        const { generateQuestionnaireFilledPDF } = await import('@/lib/document-generator');
        const pdf = await generateQuestionnaireFilledPDF({ response, organization: org, venue });
        return new NextResponse(pdf, {
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `inline; filename="Satisfaction_Reponses_${(org?.name || 'exposant').replace(/[^a-z0-9_-]/gi, '_')}.pdf"`,
            'Cache-Control': 'no-cache',
          },
        });
      } catch (e) {
        console.error('[questionnaire-filled-pdf]', e);
        return err('Erreur génération PDF : ' + e.message, 500);
      }
    }

    // [placeholder ancien guide] — non utilisé
    if (false && route === 'never_match_placeholder') {
      const regId = p[3];
      const reg = await db.collection('registrations').findOne({ id: regId });
      if (!reg) return err('Inscription introuvable', 404);
      const org = await db.collection('organizations').findOne({ id: reg.organization_id });
      const venue = reg.venue_id ? await db.collection('venues').findOne({ id: reg.venue_id }) : null;
      const animations = await db.collection('animation_slots').find({ registration_id: regId, status: { $ne: 'annulé' } }).toArray();
      try {
        const { generateGuidePDF } = await import('@/lib/document-generator');
        const pdf = await generateGuidePDF({ registration: reg, organization: org, venue, animations });
        return new NextResponse(pdf, {
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `inline; filename="Guide_Exposant_${(org?.name || 'exposant').replace(/[^a-z0-9_-]/gi, '_')}.pdf"`,
            'Cache-Control': 'no-cache',
          },
        });
      } catch (e) {
        console.error('[guide-pdf]', e);
        return err('Erreur génération PDF : ' + e.message, 500);
      }
    }

    // 🗓️ EXPOSANT — Demande de RDV pour récupérer sa caution (GET)
    if (route === 'exposant/caution-appointment') {
      const ctx = getUserContext(request);
      const regId = url.searchParams.get('registration_id') || ctx.registration_id;
      if (!regId) return err('registration_id requis', 400);
      const appt = await db.collection('caution_appointments').findOne(
        { registration_id: regId },
        { sort: { created_at: -1 } }
      );
      if (appt) delete appt._id;
      return json({ appointment: appt || null });
    }

    // 🗓️ ADMIN — Liste des RDV caution (avec infos org pour le cockpit)
    if (route === 'admin/caution-appointments') {
      const ctx = getUserContext(request);
      if (ctx.role !== 'aracom_admin') return err('Accès admin requis', 403);
      const status = url.searchParams.get('status'); // filtre optionnel : demande, confirme, propose, restitue, annule
      const q = status ? { status } : {};
      const appts = await db.collection('caution_appointments').find(q).sort({ created_at: -1 }).toArray();
      const orgIds = [...new Set(appts.map(a => a.organization_id).filter(Boolean))];
      const regIds = [...new Set(appts.map(a => a.registration_id).filter(Boolean))];
      const [orgs, regs, surveys, deposits] = await Promise.all([
        orgIds.length ? db.collection('organizations').find({ id: { $in: orgIds } }).toArray() : [],
        regIds.length ? db.collection('registrations').find({ id: { $in: regIds } }).toArray() : [],
        orgIds.length ? db.collection('satisfaction_responses').find({ organization_id: { $in: orgIds } }).toArray() : [],
        regIds.length ? db.collection('deposit_transactions').find({ registration_id: { $in: regIds } }).toArray() : [],
      ]);
      const orgById = Object.fromEntries(orgs.map(o => [o.id, o]));
      const regById = Object.fromEntries(regs.map(r => [r.id, r]));
      const surveyByOrg = Object.fromEntries(surveys.map(s => [s.organization_id, s]));
      const depByReg = Object.fromEntries(deposits.map(d => [d.registration_id, d]));

      const venues = await db.collection('venues').find({}).toArray();
      const venueById = Object.fromEntries(venues.map(v => [v.id, v]));

      return json(appts.map(a => {
        delete a._id;
        const org = orgById[a.organization_id];
        const reg = regById[a.registration_id];
        const survey = surveyByOrg[a.organization_id];
        const dep = depByReg[a.registration_id];
        return {
          ...a,
          organization_name: org?.name || null,
          organization_email: org?.main_email || null,
          contact_name: org?.contact_name || null,
          contact_phone: org?.main_phone || null,
          stand_code: reg?.stand_code || null,
          venue_name: reg ? venueById[reg.venue_id]?.name : null,
          survey_submitted: !!survey,
          survey_submitted_at: survey?.submitted_at || null,
          deposit_status: dep?.status || null,
          deposit_amount: dep?.amount_xpf || 20000,
        };
      }));
    }

    // 📝 Récupère la réponse satisfaction d'un exposant (own or admin)
    if (route === 'exposant/satisfaction') {
      const ctx = getUserContext(request);
      const orgId = url.searchParams.get('organization_id') || ctx.organization_id;
      if (!orgId) return err('organization_id requis', 400);
      const resp = await db.collection('satisfaction_responses').findOne({ organization_id: orgId });
      return json({ response: resp || null });
    }


    // 📊 Admin : liste toutes les réponses satisfaction
    if (route === 'admin/satisfaction-responses') {
      const ctx = getUserContext(request);
      // Admin OR Pacific Centers (read-only) peuvent consulter les réponses agrégées
      if (ctx.role !== 'aracom_admin' && ctx.role !== 'pacific_centers_readonly') return err('Accès réservé', 403);
      const responses = await db.collection('satisfaction_responses').find({}).sort({ submitted_at: -1 }).toArray();
      const orgIds = [...new Set(responses.map(r => r.organization_id))];
      const orgs = await db.collection('organizations').find({ id: { $in: orgIds } }).toArray();
      const orgMap = new Map(orgs.map(o => [o.id, o]));
      // Calcul agrégats
      const avg = (key) => {
        const arr = responses.map(r => r.ratings?.[key]).filter(v => typeof v === 'number');
        if (arr.length === 0) return null;
        return Math.round((arr.reduce((s, v) => s + v, 0) / arr.length) * 10) / 10;
      };
      const nps = (() => {
        const arr = responses.map(r => r.nps).filter(v => typeof v === 'number');
        if (arr.length === 0) return null;
        const promoters = arr.filter(v => v >= 7).length;
        const detractors = arr.filter(v => v <= 2).length;
        return Math.round(((promoters - detractors) / arr.length) * 100);
      })();
      return json({
        count: responses.length,
        nps_score: nps,
        averages: {
          procedure_clarte: avg('procedure_clarte'),
          infos_pre_event: avg('infos_pre_event'),
          reactivite_aracom: avg('reactivite_aracom'),
          accueil_aracom: avg('accueil_aracom'),
          materiel_quality: avg('materiel_quality'),
          animation_fluidite: avg('animation_fluidite'),
          visiteurs_count: avg('visiteurs_count'),
          objectifs_atteints: avg('objectifs_atteints'),
          satisfaction_globale: avg('satisfaction_globale'),
        },
        responses: responses.map(r => ({
          ...r,
          organization_name: orgMap.get(r.organization_id)?.name || '—',
          venue_id: orgMap.get(r.organization_id)?.venue_id || null,
        })),
      });
    }

    // 🔐 GET /api/exposant/password/status — check if password is set for current/specified org
    if (route === 'exposant/password/status') {
      const ctx = getUserContext(request);
      const orgId = url.searchParams.get('organization_id') || ctx.organization_id;
      if (!orgId) return json({ has_password: false, organization_id: null });
      const org = await db.collection('organizations').findOne({ id: orgId });
      return json({
        has_password: !!org?.access_password_hash,
        organization_id: orgId,
        password_set_at: org?.password_set_at || null,
      });
    }

    // 🌐 Liste tous les sites (registrations) d'une organisation (multi-sites)
    if (route === 'wizard/org-sites') {
      const orgId = url.searchParams.get('organization_id');
      if (!orgId) return err('organization_id requis', 400);
      const regs = await db.collection('registrations').find({ organization_id: orgId }).sort({ created_at: 1 }).toArray();
      const venues = await db.collection('venues').find({}).toArray();
      const venueMap = new Map(venues.map(v => [v.id, v]));
      const regIds = regs.map(r => r.id);
      const animCounts = {};
      const anims = await db.collection('animation_slots').find({ registration_id: { $in: regIds } }).toArray();
      anims.forEach(a => { animCounts[a.registration_id] = (animCounts[a.registration_id] || 0) + 1; });
      return json({
        organization_id: orgId,
        sites: regs.map(r => ({
          registration_id: r.id,
          venue_id: r.venue_id,
          venue_name: r.venue_id ? venueMap.get(r.venue_id)?.name : null,
          stand_code: r.stand_code,
          attending_days: r.attending_days || [],
          attending_day_times: r.attending_day_times || {},
          animations_count: animCounts[r.id] || 0,
          status: r.status,
          wizard_step: r.wizard_step,
          created_at: r.created_at,
        })),
      });
    }

    // État wizard d'un exposant (reprise)
    if (route.match(/^wizard\/state\/[^/]+$/)) {
      const regId = p[2];
      const state = await getWizardState(db, regId);
      if (!state) return err('Inscription introuvable', 404);
      return json(state);
    }

    // Récupère une modification_token (pour les liens email de modification)
    if (route.match(/^wizard\/modification-token\/[^/]+$/)) {
      const tok = p[2];
      const t = await db.collection('modification_tokens').findOne({ token: tok });
      if (!t) return err('Lien invalide', 404);
      if (t.expires_at < new Date()) return err('Lien expiré', 410);
      const state = await getWizardState(db, t.registration_id);
      return json({ token: t, state });
    }

    // Télécharge le badge PDF d'un exposant (signé URL ou accès admin)
    if (route.match(/^wizard\/badge\/[^/]+$/)) {
      const regId = p[2];
      const state = await getWizardState(db, regId);
      if (!state) return err('Inscription introuvable', 404);
      const buf = await generateBadgePdf({
        organization: state.organization,
        registration: state.registration,
        venue: state.venue,
        visit_slot: state.visit_slot,
        animation_slots: state.animation_slots,
      });
      return new Response(buf, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="Badge_${(state.organization?.name || 'exposant').replace(/[^a-zA-Z0-9]/g, '_')}.pdf"`,
        },
      });
    }

    if (route === 'stats/public') {
      // Public stats for landing page — no auth required
      const venues = await db.collection('venues').find({ edition_id: EDITION_ID }).toArray();
      const stands = await db.collection('venue_stands').countDocuments({});
      const orgs = await db.collection('organizations').countDocuments({ source_origin: { $ne: 'self_register' } });
      return json({ sites: venues.length, stands, associations: orgs });
    }

    if (route === 'auth/me') {
      const ctx = getUserContext(request);
      if (!ctx.userId) return err('Non authentifié', 401);
      const user = await db.collection('users').findOne({ id: ctx.userId });
      if (!user) {
        // Fallback : si les headers sont valides mais que l'utilisateur n'existe pas en DB
        // (ex: cas d'un admin technique non seedé), renvoyer un objet user minimal
        // afin que l'UI puisse continuer à fonctionner.
        if (ctx.role === 'aracom_admin') {
          return json({
            user: {
              id: ctx.userId,
              email: 'admin@aracom.pf',
              full_name: 'ARACOM Admin',
              role_code: 'aracom_admin',
              is_active: true,
            },
            organization: null,
          });
        }
        return err('Utilisateur introuvable', 404);
      }
      let organization = null;
      if (user.organization_id) organization = await db.collection('organizations').findOne({ id: user.organization_id });
      delete user.password; delete user._id;
      return json({ user, organization });
    }

    if (route === 'dashboard/kpis') {
      const userRole = request.headers.get('x-user-role');
      const kpis = await computeKpis(db, userRole);
      return json(kpis);
    }
    if (route === 'dashboard/by-site') {
      const userRole = request.headers.get('x-user-role');
      const sites = await computeBySite(db);
      // 🆕 Filtre Pacific : ne renvoie que les sites visibles ET disponibles
      if (userRole === 'pacific_centers_readonly') {
        const allVenues = await db.collection('venues').find({ edition_id: EDITION_ID }).toArray();
        const allowedIds = new Set(allVenues.filter(v => v.is_available_2026 !== false && v.pacific_visible !== false).map(v => v.id));
        return json(sites.filter(s => allowedIds.has(s.venue_id)));
      }
      return json(sites);
    }

    if (route === 'venues') {
      const venues = await db.collection('venues').find({ edition_id: EDITION_ID }).toArray();
      const userRole = request.headers.get('x-user-role');
      // Hide unavailable venues for non-admin roles
      let visible = userRole === 'aracom_admin' ? venues : venues.filter(v => v.is_available_2026 !== false);
      // 🆕 Filtre supplémentaire pour Pacific Centers : seuls les sites avec pacific_visible=true (ou non défini = true par défaut)
      if (userRole === 'pacific_centers_readonly') {
        visible = visible.filter(v => v.pacific_visible !== false);
      }
      // 🆕 Filtre exposants : seuls les sites avec exposant_visible !== false (masque Mahina/Moorea par défaut)
      if (userRole === 'exposant') {
        visible = visible.filter(v => v.exposant_visible !== false);
      }
      return json(visible.map(v => { delete v._id; return v; }));
    }

    // ============ DOCUMENTS OFFICIELS (bibliothèque admin → exposants) ============
    // GET /api/official-documents — accessible à tous les rôles authentifiés
    if (route === 'official-documents') {
      const docs = await db.collection('official_documents').find({ active: { $ne: false } }).sort({ category: 1, sort_order: 1 }).toArray();
      return json(docs.map(d => { delete d._id; return d; }));
    }

    // 🆕 GET /api/admin/rib-config — RIB ARACOM (accessible à tous pour usage interne)
    if (route === 'admin/rib-config') {
      const cfg = await db.collection('app_settings').findOne({ key: 'rib_config' });
      const defaults = { titulaire: 'ARACOM', banque: '', iban: '', bic: '', reference: 'Caution Forum 2026 + nom exposant' };
      return json(cfg?.value || defaults);
    }

    // 🆕 GET /api/admin/exposant-limits — config max sites par exposant (lue par exposant ET admin)
    if (route === 'admin/exposant-limits') {
      const cfg = await db.collection('app_settings').findOne({ key: 'exposant_limits' });
      return json(cfg?.value || { max_sites_per_exposant: 3 });
    }

    // 🆕 GET /api/exposant/my-sites — liste de toutes les registrations de l'organisation connectée
    if (route === 'exposant/my-sites') {
      const orgId = ctx.organization_id || url.searchParams.get('organization_id');
      if (!orgId) return err('organization_id requis', 400);
      const regs = await db.collection('registrations').find({ organization_id: orgId, edition_id: EDITION_ID }).toArray();
      const venues = await db.collection('venues').find({}).toArray();
      const vById = Object.fromEntries(venues.map(v => [v.id, v]));
      const slots = await db.collection('animation_slots').find({ registration_id: { $in: regs.map(r => r.id) } }).toArray();
      const slotsByReg = {};
      for (const s of slots) { (slotsByReg[s.registration_id] = slotsByReg[s.registration_id] || []).push(s); }
      const deposits = await db.collection('deposit_transactions').find({ registration_id: { $in: regs.map(r => r.id) } }).toArray();
      const depByReg = Object.fromEntries(deposits.map(d => [d.registration_id, d]));
      const out = regs.map(r => {
        const v = vById[r.venue_id];
        const regSlots = slotsByReg[r.id] || [];
        const has_vendredi = regSlots.some(s => s.day_label === 'vendredi');
        const has_samedi = regSlots.some(s => s.day_label === 'samedi');
        delete r._id;
        return {
          ...r,
          is_locked: r.is_locked ?? false,
          is_deposit_received: r.is_deposit_received ?? false,
          site_priority: r.site_priority || 1,
          venue: v ? { id: v.id, name: v.name, code: v.code, capacity_stands: v.capacity_stands } : null,
          deposit: depByReg[r.id] || null,
          animations_count: regSlots.length,
          has_vendredi_animation: has_vendredi,
          has_samedi_animation: has_samedi,
          is_complete: has_vendredi && has_samedi && !!r.venue_id && !!r.stand_code,
        };
      }).sort((a, b) => (a.site_priority || 99) - (b.site_priority || 99));
      return json(out);
    }

    // 🆕 GET /api/admin/document-templates — liste des 4 templates éditables
    if (route === 'admin/document-templates') {
      const userRole = request.headers.get('x-user-role');
      if (userRole !== 'aracom_admin') return err('Réservé aux admins', 403);
      const keys = ['convention', 'guide', 'recu', 'attestation_remboursement'];
      const out = {};
      for (const k of keys) {
        const cfg = await db.collection('app_settings').findOne({ key: `doc_template_${k}` });
        out[k] = { texts: cfg?.texts || {}, logo_base64: cfg?.logo_base64 || null, updated_at: cfg?.updated_at || null };
      }
      return json(out);
    }

    // ============ DEADLINES par étape (Profil, Stand, Animation, Documents, Caution, Convention) ============
    // Lecture publique (tous rôles authentifiés) — les exposants verront leur compte à rebours
    if (route === 'step-deadlines') {
      const cfg = await db.collection('app_settings').findOne({ key: 'step_deadlines' });
      const defaults = {
        profile: null,         // ISO date string ou null
        stand: null,
        animation: null,
        documents: null,
        caution: null,
        convention: null,
      };
      const deadlines = { ...defaults, ...(cfg?.deadlines || {}) };
      return json({ deadlines, updated_at: cfg?.updated_at || null, updated_by: cfg?.updated_by || null });
    }

    // 🆕 Phase post-événement (Bilans / Satisfaction) — débloquée par ARACOM
    if (route === 'post-event-status') {
      const cfg = await db.collection('app_settings').findOne({ key: 'post_event_status' });
      return json({
        unlocked: Boolean(cfg?.unlocked),
        unlocked_at: cfg?.unlocked_at || null,
        unlocked_by: cfg?.unlocked_by || null,
      });
    }

    // ============ PROSPECTION (Pacific Centers + ARACOM) ============
    // Liste des prospects. Pacific Centers voient uniquement leurs sites.
    if (route === 'prospects') {
      const q = new URL(request.url).searchParams;
      const filter = {};
      const venueId = q.get('venue_id');
      if (venueId) filter.venue_id = venueId;
      const status = q.get('status');
      if (status) filter.status = status;
      // Restreindre aux venues du pacific user si applicable
      const role = request.headers.get('x-user-role');
      if (role === 'pacific_centers_readonly') {
        const userId = request.headers.get('x-user-id');
        const user = await db.collection('users').findOne({ id: userId });
        // Si le user a des venue_ids limités, filtrer
        if (user?.allowed_venue_ids?.length) {
          filter.venue_id = filter.venue_id || { $in: user.allowed_venue_ids };
        }
      }
      const prospects = await db.collection('prospects').find(filter).sort({ updated_at: -1 }).toArray();
      // Enrichit avec venue name
      const vids = [...new Set(prospects.map(p => p.venue_id).filter(Boolean))];
      const venues = vids.length ? await db.collection('venues').find({ id: { $in: vids } }).toArray() : [];
      const vmap = Object.fromEntries(venues.map(v => [v.id, v]));
      return json(prospects.map(p => {
        delete p._id;
        return { ...p, venue_name: vmap[p.venue_id]?.name || null, venue_code: vmap[p.venue_id]?.code || null };
      }));
    }

    // Stats de prospection (pour KPI taux de conversion)
    if (route === 'prospects/stats') {
      const q = new URL(request.url).searchParams;
      const filter = {};
      const venueId = q.get('venue_id');
      if (venueId) filter.venue_id = venueId;
      const role = request.headers.get('x-user-role');
      if (role === 'pacific_centers_readonly') {
        const userId = request.headers.get('x-user-id');
        const user = await db.collection('users').findOne({ id: userId });
        if (user?.allowed_venue_ids?.length) {
          filter.venue_id = filter.venue_id || { $in: user.allowed_venue_ids };
        }
      }
      const all = await db.collection('prospects').find(filter).toArray();
      const byStatus = { a_contacter: 0, contacte: 0, interesse: 0, converti: 0, refuse: 0, abandonne: 0 };
      all.forEach(p => { if (p.status in byStatus) byStatus[p.status]++; else byStatus.a_contacter++; });
      const total = all.length;
      const contacted = total - byStatus.a_contacter;
      const converted = byStatus.converti;
      const conversion_rate_pct = total > 0 ? Math.round((converted / total) * 100) : 0;
      const contact_to_conversion_pct = contacted > 0 ? Math.round((converted / contacted) * 100) : 0;
      // Par site
      const byVenue = {};
      all.forEach(p => {
        const k = p.venue_id || 'autre';
        if (!byVenue[k]) byVenue[k] = { total: 0, converti: 0 };
        byVenue[k].total++;
        if (p.status === 'converti') byVenue[k].converti++;
      });
      return json({ total, contacted, converted, by_status: byStatus, by_venue: byVenue, conversion_rate_pct, contact_to_conversion_pct });
    }

    if (route.startsWith('venues/') && !route.includes('/stands')) {
      const id = p[1];
      const v = await db.collection('venues').findOne({ id });
      if (!v) return err('Site introuvable', 404);
      delete v._id;
      return json(v);
    }

    if (route.startsWith('venues/') && route.endsWith('/stands')) {
      const venueId = p[1];
      // 🔒 Tri stable par stand_code pour garantir le même ordre entre appels (évite tout "remélange" côté UI)
      const stands = await db.collection('venue_stands').find({ venue_id: venueId }).sort({ stand_code: 1 }).toArray();
      const assignments = await db.collection('stand_assignments').find({}).toArray();
      const regs = await db.collection('registrations').find({ edition_id: EDITION_ID }).toArray();
      const orgs = await db.collection('organizations').find({}).toArray();
      const orgById = Object.fromEntries(orgs.map(o => [o.id, o]));
      const regById = Object.fromEntries(regs.map(r => [r.id, r]));
      const result = stands.map(s => {
        const assign = assignments.find(a => a.venue_stand_id === s.id && a.status !== 'annule');
        let reg = null, org = null;
        if (assign) {
          reg = regById[assign.registration_id];
          if (reg) org = orgById[reg.organization_id];
        }
        delete s._id;
        return { ...s, assignment: assign ? { registration_id: assign.registration_id, status: assign.status } : null, organization: org ? { id: org.id, name: org.name, discipline: org.discipline, priority_level: org.priority_level } : null, registration_status: reg?.status || null };
      });
      return json(result);
    }

    if (route === 'registrations') {
      const q = { edition_id: EDITION_ID };
      const venue_id = url.searchParams.get('venue_id');
      const status = url.searchParams.get('status');
      const priority = url.searchParams.get('priority');
      const discipline = url.searchParams.get('discipline');
      const search = url.searchParams.get('search');
      if (venue_id) q.venue_id = venue_id;
      if (status) q.status = status;
      // 🆕 Filtrage par rôle : Pacific Centers ne voit que les exposants des sites visibles pour Pacific
      //                       Exposants externes : sites visibles pour exposants
      const userRole = request.headers.get('x-user-role');
      const allVenues = await db.collection('venues').find({ edition_id: EDITION_ID }).toArray();
      if (userRole === 'pacific_centers_readonly') {
        const allowedVenues = allVenues.filter(v => v.is_available_2026 !== false && v.pacific_visible !== false).map(v => v.id);
        q.venue_id = q.venue_id && allowedVenues.includes(q.venue_id) ? q.venue_id : { $in: allowedVenues };
      } else if (userRole === 'exposant') {
        const allowedVenues = allVenues.filter(v => v.is_available_2026 !== false && v.exposant_visible !== false).map(v => v.id);
        q.venue_id = q.venue_id && allowedVenues.includes(q.venue_id) ? q.venue_id : { $in: allowedVenues };
      }
      const regs = await db.collection('registrations').find(q).toArray();
      const orgIds = [...new Set(regs.map(r => r.organization_id))];
      const orgs = await db.collection('organizations').find({ id: { $in: orgIds } }).toArray();
      const orgById = Object.fromEntries(orgs.map(o => [o.id, o]));
      const vById = Object.fromEntries(allVenues.map(v => [v.id, v]));
      const deposits = await db.collection('deposit_transactions').find({}).toArray();
      const depByReg = Object.fromEntries(deposits.map(d => [d.registration_id, d]));
      let rows = regs.map(r => {
        const o = orgById[r.organization_id];
        const v = vById[r.venue_id];
        const d = depByReg[r.id];
        delete r._id;
        return { ...r, organization: o ? { id: o.id, name: o.name, discipline: o.discipline, priority_level: o.priority_level, main_email: o.main_email, main_phone: o.main_phone, contact_name: o.contact_name, participation_history: o.participation_history || null } : null, venue: v ? { id: v.id, name: v.name, code: v.code } : null, deposit: d ? { status: d.status, amount_xpf: d.amount_xpf } : null };
      });
      if (priority) rows = rows.filter(r => r.organization?.priority_level === priority);
      if (discipline) rows = rows.filter(r => r.organization?.discipline === discipline);
      if (search) {
        const s = search.toLowerCase();
        rows = rows.filter(r => r.organization?.name?.toLowerCase().includes(s) || r.organization?.contact_name?.toLowerCase().includes(s) || r.stand_code?.toLowerCase().includes(s));
      }
      rows.sort((a, b) => (a.venue?.name || '').localeCompare(b.venue?.name || '') || (a.stand_code || '').localeCompare(b.stand_code || ''));
      return json(rows);
    }

    if (route.startsWith('registrations/')) {
      const id = p[1];
      const reg = await db.collection('registrations').findOne({ id });
      if (!reg) return err('Inscription introuvable', 404);
      const ctx = getUserContext(request);
      // Exposant can only see own
      if (ctx.role === 'exposant') {
        const user = await db.collection('users').findOne({ id: ctx.userId });
        if (!user || user.organization_id !== reg.organization_id) return err('Accès refusé', 403);
      }
      const org = await db.collection('organizations').findOne({ id: reg.organization_id });
      const venue = await db.collection('venues').findOne({ id: reg.venue_id });
      const slots = await db.collection('animation_slots').find({ registration_id: id }).toArray();
      const docs = await db.collection('registration_documents').find({ registration_id: id }).toArray();
      const deposit = await db.collection('deposit_transactions').findOne({ registration_id: id });
      const history = await db.collection('organization_history').find({ organization_id: reg.organization_id }).toArray();
      const preferences = await db.collection('organization_preferences').find({ organization_id: reg.organization_id }).toArray();
      const tasks = await db.collection('tasks_or_followups').find({ registration_id: id }).toArray();
      const emails = await db.collection('email_messages').find({ registration_id: id }).toArray();
      const anomalies = await db.collection('registration_anomalies').find({ registration_id: id }).toArray();
      const comments = await db.collection('field_comments').find({ registration_id: id }).toArray();
      const sessions = await db.collection('attendance_sessions').find({ registration_id: id }).toArray();
      const media = await db.collection('field_media').find({ registration_id: id }, { projection: { file_data: 0 } }).sort({ captured_at: -1 }).toArray();
      [reg, org, venue, deposit].forEach(x => { if (x) delete x._id; });
      // Strip ARACOM-private data for non-admins (exposants and pacific centers)
      if (org && ctx.role !== 'aracom_admin') {
        delete org.aracom_private;
      }
      return json({
        registration: reg,
        organization: org,
        venue,
        slots: slots.map(s => { delete s._id; return s; }),
        documents: docs.map(d => { delete d._id; return d; }),
        deposit,
        history: history.map(h => { delete h._id; return h; }),
        preferences: preferences.map(pr => { delete pr._id; return pr; }),
        tasks: tasks.map(t => { delete t._id; return t; }),
        emails: emails.map(e => { delete e._id; return e; }),
        anomalies: anomalies.map(a => { delete a._id; return a; }),
        comments: comments.map(c => { delete c._id; return c; }),
        attendance_sessions: sessions.map(s => { delete s._id; return s; }),
        media: media.map(m => { delete m._id; return m; }),
      });
    }

    if (route === 'animation-slots') {
      const venue_id = url.searchParams.get('venue_id');
      const day = url.searchParams.get('day');
      const userRole = request.headers.get('x-user-role');
      const q = {};
      if (venue_id) q.venue_id = venue_id;
      if (day) q.day_label = day;
      // 🆕 Filtre Pacific : ne renvoie que les slots des sites visibles Pacific
      if (userRole === 'pacific_centers_readonly') {
        const allowedVenues = await db.collection('venues').find({ edition_id: EDITION_ID, pacific_visible: { $ne: false }, is_available_2026: { $ne: false } }).toArray();
        const allowedIds = allowedVenues.map(v => v.id);
        if (q.venue_id && !allowedIds.includes(q.venue_id)) return json([]);
        if (!q.venue_id) q.venue_id = { $in: allowedIds };
      }
      const slots = await db.collection('animation_slots').find(q).toArray();
      const regIds = [...new Set(slots.map(s => s.registration_id))];
      const regs = await db.collection('registrations').find({ id: { $in: regIds } }).toArray();
      const orgs = await db.collection('organizations').find({ id: { $in: regs.map(r => r.organization_id) } }).toArray();
      const orgById = Object.fromEntries(orgs.map(o => [o.id, o]));
      const regById = Object.fromEntries(regs.map(r => [r.id, r]));
      const venues = await db.collection('venues').find({}).toArray();
      const vById = Object.fromEntries(venues.map(v => [v.id, v]));
      return json(slots.map(s => {
        const r = regById[s.registration_id];
        const o = r ? orgById[r.organization_id] : null;
        const v = vById[s.venue_id];
        delete s._id;
        return { ...s, organization_name: o?.name, discipline: o?.discipline, stand_code: r?.stand_code, venue_name: v?.name };
      }));
    }

    if (route === 'attendance') {
      const event_date = url.searchParams.get('event_date') || '2026-08-14';
      const venue_id = url.searchParams.get('venue_id');
      // Ensure sessions exist for confirmed + a_confirmer registrations
      const regsQ = { edition_id: EDITION_ID, status: { $in: ['confirme','a_confirmer','a_relancer'] } };
      if (venue_id) regsQ.venue_id = venue_id;
      const regs = await db.collection('registrations').find(regsQ).toArray();
      const orgs = await db.collection('organizations').find({ id: { $in: regs.map(r => r.organization_id) } }).toArray();
      const orgById = Object.fromEntries(orgs.map(o => [o.id, o]));
      const venues = await db.collection('venues').find({}).toArray();
      const vById = Object.fromEntries(venues.map(v => [v.id, v]));

      const sessions = [];
      for (const r of regs) {
        let s = await db.collection('attendance_sessions').findOne({ registration_id: r.id, event_date });
        if (!s) {
          s = {
            id: uuid(), registration_id: r.id, venue_id: r.venue_id, event_date,
            expected_arrival_time: r.planned_arrival_time || '10:30',
            actual_arrival_time: null,
            expected_departure_time: r.planned_departure_time || '17:00',
            actual_departure_time: null,
            presence_status: 'attendu',
            arrival_checked_by: null, departure_checked_by: null,
            is_animation_completed: false,
            arrival_stand_condition: null, departure_stand_condition: null,
            final_day_status: null,
            created_at: new Date(), updated_at: new Date(),
          };
          await db.collection('attendance_sessions').insertOne(s);
        }
        const o = orgById[r.organization_id];
        const v = vById[r.venue_id];
        delete s._id;
        sessions.push({ ...s, organization: o ? { id: o.id, name: o.name, discipline: o.discipline } : null, venue: v ? { id: v.id, name: v.name } : null, stand_code: r.stand_code, planned_arrival_time: r.planned_arrival_time, planned_departure_time: r.planned_departure_time, animation_type: r.animation_type });
      }
      sessions.sort((a, b) => (a.venue?.name || '').localeCompare(b.venue?.name || '') || (a.stand_code || '').localeCompare(b.stand_code || ''));
      return json(sessions);
    }

    if (route === 'anomalies') {
      const event_date = url.searchParams.get('event_date');
      const q = {}; if (event_date) q.event_date = event_date;
      const anomalies = await db.collection('registration_anomalies').find(q).sort({ detected_at: -1 }).toArray();
      const regs = await db.collection('registrations').find({ id: { $in: anomalies.map(a => a.registration_id) } }).toArray();
      const orgs = await db.collection('organizations').find({ id: { $in: regs.map(r => r.organization_id) } }).toArray();
      const regById = Object.fromEntries(regs.map(r => [r.id, r]));
      const orgById = Object.fromEntries(orgs.map(o => [o.id, o]));
      const venues = await db.collection('venues').find({}).toArray();
      const vById = Object.fromEntries(venues.map(v => [v.id, v]));
      return json(anomalies.map(a => {
        const r = regById[a.registration_id];
        const o = r ? orgById[r.organization_id] : null;
        const v = vById[a.venue_id];
        delete a._id;
        return { ...a, organization_name: o?.name, venue_name: v?.name, stand_code: r?.stand_code };
      }));
    }

    if (route === 'reports') {
      const baseQuery = { edition_id: EDITION_ID };
      // Pacific Centers can only see reports explicitly shared with them
      if (ctx.role === 'pacific_centers_readonly') {
        baseQuery.shared_with_pacific = true;
      }
      const reports = await db.collection('post_event_reports').find(baseQuery).sort({ generated_at: -1 }).toArray();
      return json(reports.map(r => { delete r._id; return r; }));
    }

    // GET /api/field-comments?registration_id=... — liste des commentaires terrain (filtrable)
    if (route === 'field-comments') {
      const registration_id = url.searchParams.get('registration_id');
      const q = {};
      if (registration_id) q.registration_id = registration_id;
      const comments = await db.collection('field_comments').find(q).sort({ created_at: -1 }).toArray();
      return json(comments.map(c => { delete c._id; return c; }));
    }

    if (route === 'emails') {
      const emails = await db.collection('email_messages').find({}).sort({ created_at: -1 }).limit(200).toArray();
      return json(emails.map(e => { delete e._id; return e; }));
    }

    if (route === 'activity-logs') {
      const logs = await db.collection('activity_logs').find({}).sort({ created_at: -1 }).limit(100).toArray();
      return json(logs.map(l => { delete l._id; return l; }));
    }

    if (route === 'organizations') {
      const orgs = await db.collection('organizations').find({}).sort({ name: 1 }).toArray();
      return json(orgs.map(o => { delete o._id; return o; }));
    }

    // 🚨 Alertes multi-sites (concentration / doublons / surbooké chronologique)
    if (route === 'admin/multi-site-alerts') {
      const ctx = getUserContext(request);
      if (ctx.role !== 'aracom_admin') return err('Accès admin requis', 403);

      const venues = await db.collection('venues').find({}).toArray();
      const allRegs = await db.collection('registrations').find({
        venue_id: { $ne: null, $exists: true },
        status: { $nin: ['annule', 'annulé'] },
      }).toArray();
      const allOrgs = await db.collection('organizations').find({}).toArray();
      const orgMap = new Map(allOrgs.map(o => [o.id, o]));

      // 1) Concentration : sites avec significativement plus de regs
      const byVenue = {};
      allRegs.forEach(r => { byVenue[r.venue_id] = (byVenue[r.venue_id] || 0) + 1; });
      const counts = Object.values(byVenue);
      const avg = counts.length ? counts.reduce((a, b) => a + b, 0) / counts.length : 0;
      const overloaded = venues
        .filter(v => (byVenue[v.id] || 0) > Math.max(avg * 1.5, avg + 3))
        .map(v => {
          const regs = allRegs
            .filter(r => r.venue_id === v.id)
            .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
            .map(r => ({
              registration_id: r.id,
              org_id: r.organization_id,
              org_name: orgMap.get(r.organization_id)?.name || '(inconnu)',
              created_at: r.created_at,
              status: r.status,
            }));
          return { venue_id: v.id, venue_name: v.name, count: byVenue[v.id] || 0, avg: Math.round(avg * 10) / 10, registrations: regs };
        });

      // 2) Doublons : orgs avec regs sur plusieurs sites
      const byOrg = {};
      allRegs.forEach(r => {
        if (!byOrg[r.organization_id]) byOrg[r.organization_id] = [];
        byOrg[r.organization_id].push(r);
      });
      const duplicates = Object.entries(byOrg)
        .filter(([_, regs]) => regs.length > 1)
        .map(([orgId, regs]) => ({
          org_id: orgId,
          org_name: orgMap.get(orgId)?.name || '(inconnu)',
          venues: regs.map(r => ({
            registration_id: r.id,
            venue_id: r.venue_id,
            venue_name: venues.find(v => v.id === r.venue_id)?.name || r.venue_id,
            created_at: r.created_at,
            status: r.status,
          })),
        }));

      return json({
        overloaded_sites: overloaded,
        avg_per_site: Math.round(avg * 10) / 10,
        duplicate_exposants: duplicates,
        generated_at: new Date(),
      });
    }

    // 🌐 Vue par site (associations confirmées + animations) — pour le dashboard switchable
    if (route.match(/^admin\/site-view\/[^/]+$/)) {
      const ctx = getUserContext(request);
      if (ctx.role !== 'aracom_admin') return err('Accès admin requis', 403);
      const venueId = p[2];
      const venue = await db.collection('venues').findOne({ id: venueId });
      if (!venue) return err('Site introuvable', 404);

      const regs = await db.collection('registrations').find({
        venue_id: venueId,
        status: { $nin: ['annule', 'annulé'] },
      }).sort({ created_at: 1 }).toArray();
      const orgIds = regs.map(r => r.organization_id);
      const orgs = await db.collection('organizations').find({ id: { $in: orgIds } }).toArray();
      const orgMap = new Map(orgs.map(o => [o.id, o]));
      const regIds = regs.map(r => r.id);
      const anims = await db.collection('animation_slots').find({
        registration_id: { $in: regIds },
        status: { $ne: 'annulé' },
      }).sort({ day_label: 1, start_time: 1 }).toArray();

      const exposants = regs.map(r => {
        const org = orgMap.get(r.organization_id) || {};
        return {
          registration_id: r.id,
          org_id: org.id,
          org_name: org.name,
          discipline: org.discipline,
          contact_name: org.contact_name,
          stand_code: r.stand_code,
          status: r.status,
          attending_days: r.attending_days || [],
          attending_day_times: r.attending_day_times || {},
          animations: anims.filter(a => a.registration_id === r.id),
        };
      });

      return json({
        venue: { id: venue.id, name: venue.name, code: venue.code, capacity_stands: venue.capacity_stands },
        exposants,
        animations_total: anims.length,
        confirmed_count: exposants.filter(e => e.status === 'confirme').length,
      });
    }

    // Get/create magic access link for an exposant (admin only)
    if (route.match(/^organizations\/[^/]+\/access-link$/)) {
      const ctx = getUserContext(request);
      if (ctx.role !== 'aracom_admin') return err('Accès admin requis', 403);
      const orgId = p[1];
      const org = await db.collection('organizations').findOne({ id: orgId });
      if (!org) return err('Organisation introuvable', 404);
      const access_url = await getOrCreateExposantAccessUrl(db, org.id, org.main_email, request);
      return json({ ok: true, access_url, organization_name: org.name });
    }

    if (route === 'tasks') {
      const q = {};
      const status = url.searchParams.get('status');
      const registration_id = url.searchParams.get('registration_id');
      if (status) q.status = status;
      if (registration_id) q.registration_id = registration_id;
      const tasks = await db.collection('tasks_or_followups').find(q).sort({ due_date: 1, created_at: -1 }).toArray();
      const regs = await db.collection('registrations').find({ id: { $in: tasks.map(t => t.registration_id) } }).toArray();
      const orgs = await db.collection('organizations').find({ id: { $in: regs.map(r => r.organization_id) } }).toArray();
      const regById = Object.fromEntries(regs.map(r => [r.id, r]));
      const orgById = Object.fromEntries(orgs.map(o => [o.id, o]));
      return json(tasks.map(t => { delete t._id; const r = regById[t.registration_id]; const o = r ? orgById[r.organization_id] : null; return { ...t, organization_name: o?.name, stand_code: r?.stand_code }; }));
    }

    if (route === 'documents') {
      const registration_id = url.searchParams.get('registration_id');
      const q = {};
      if (registration_id) q.registration_id = registration_id;
      // Do not return base64 data blob in list (performance)
      const docs = await db.collection('registration_documents').find(q, { projection: { file_data: 0 } }).sort({ uploaded_at: -1 }).toArray();
      return json(docs.map(d => { delete d._id; return d; }));
    }

    // ---- Mail templates (réutilisables) ----
    if (route === 'mail-templates') {
      const list = await db.collection('mail_templates').find({}).sort({ created_at: -1 }).toArray();
      return json(list.map(({ _id, ...rest }) => rest));
    }
    if (route.match(/^mail-templates\/[^/]+$/)) {
      const tpl = await db.collection('mail_templates').findOne({ id: p[1] });
      if (!tpl) return err('Template introuvable', 404);
      delete tpl._id;
      return json(tpl);
    }
    // ---- Mail recipient lists (sélections sauvegardées) ----
    if (route === 'mail-recipient-lists') {
      const list = await db.collection('mail_recipient_lists').find({}).sort({ created_at: -1 }).toArray();
      return json(list.map(({ _id, ...rest }) => rest));
    }

    // ---- Validation requests (ARACOM listing) ----
    if (route === 'validation-requests') {
      const status = url.searchParams.get('status');
      const q = status ? { status } : {};
      const list = await db.collection('validation_requests').find(q).sort({ created_at: -1 }).toArray();
      const orgIds = [...new Set(list.map(r => r.organization_id))];
      const orgs = await db.collection('organizations').find({ id: { $in: orgIds } }).toArray();
      const venues = await db.collection('venues').find({ id: { $in: list.map(r => r.venue_id) } }).toArray();
      const orgById = Object.fromEntries(orgs.map(o => [o.id, o]));
      const vById = Object.fromEntries(venues.map(v => [v.id, v]));
      return json(list.map(r => ({
        ...r, _id: undefined,
        organization: orgById[r.organization_id] ? { id: orgById[r.organization_id].id, name: orgById[r.organization_id].name, main_email: orgById[r.organization_id].main_email, main_phone: orgById[r.organization_id].main_phone, contact_name: orgById[r.organization_id].contact_name, discipline: orgById[r.organization_id].discipline } : null,
        venue: vById[r.venue_id] ? { id: vById[r.venue_id].id, name: vById[r.venue_id].name, code: vById[r.venue_id].code } : null,
      })));
    }

    // ---- Mailing status (TEST MODE indicator for UI) ----
    if (route === 'mailing/status') {
      const cfg = await getMailConfig(db);
      return json({
        test_mode_active: cfg.test_mode,
        redirect_to: cfg.redirect_to,
        allowed_recipients: cfg.allow_list,
        smtp_configured: isSmtpConfigured(),
        config_source: cfg.source, // 'database' | 'env'
        updated_at: cfg.updated_at,
        updated_by: cfg.updated_by,
      });
    }

    // ---- Dashboard Analytics (graphs : historic, disciplines, completion, cautions, mailing) ----
    if (route === 'dashboard/analytics') {
      const [orgs, regs, deposits, emails, campaigns] = await Promise.all([
        db.collection('organizations').find({}).toArray(),
        db.collection('registrations').find({ edition_id: EDITION_ID }).toArray(),
        db.collection('deposit_transactions').find({}).toArray(),
        db.collection('email_messages').find({}).toArray(),
        db.collection('email_campaigns').find({}).toArray(),
      ]);

      // 1. Historic participation — count per year from participation_history
      const historicYears = ['2019', '2020', '2021', '2022', '2023', '2024', '2025'];
      const historicCounts = {};
      historicYears.forEach(y => { historicCounts[y] = 0; });
      orgs.forEach(o => {
        const h = o.participation_history;
        if (!h) return;
        if (Array.isArray(h)) {
          h.forEach(y => { const ys = String(y); if (historicCounts[ys] !== undefined) historicCounts[ys]++; });
        } else if (typeof h === 'object') {
          Object.keys(h).forEach(y => { if (historicCounts[y] !== undefined && h[y]) historicCounts[y]++; });
        }
      });
      historicCounts['2026'] = regs.length;
      const historic = Object.entries(historicCounts).map(([year, count]) => ({ year, count }));

      // 2. Top disciplines — par site + global + détection multi-sites
      // 2a. Calcule pour chaque org sur quels sites il est présent (via registrations)
      const orgSitesMap = {}; // org_id → Set of venue_id
      regs.forEach(r => {
        if (!r.organization_id || !r.venue_id) return;
        if (!orgSitesMap[r.organization_id]) orgSitesMap[r.organization_id] = new Set();
        orgSitesMap[r.organization_id].add(r.venue_id);
      });
      // 2b. Set des org_ids présentes sur ≥2 sites
      const multiSiteOrgIds = new Set(
        Object.entries(orgSitesMap).filter(([, sites]) => sites.size >= 2).map(([id]) => id)
      );
      // 2c. Récupère venues pour libellés
      const venues = await db.collection('venues').find({}).toArray();
      const venueById = Object.fromEntries(venues.map(v => [v.id, v]));

      // 2d. Construction des disciplines globales (toutes confondues) + per-site
      const buildDiscList = (orgList) => {
        const counts = {};
        const multiInDisc = {};
        const multiOrgsInDisc = {}; // discipline → liste { id, name, sites: [names] }
        orgList.forEach(o => {
          const d = o.discipline || 'Autre';
          counts[d] = (counts[d] || 0) + 1;
          if (multiSiteOrgIds.has(o.id)) {
            multiInDisc[d] = (multiInDisc[d] || 0) + 1;
            if (!multiOrgsInDisc[d]) multiOrgsInDisc[d] = [];
            const sites = Array.from(orgSitesMap[o.id] || []).map(vid => venueById[vid]?.name || vid);
            multiOrgsInDisc[d].push({ id: o.id, name: o.name, sites });
          }
        });
        return Object.entries(counts)
          .map(([name, count]) => ({
            name,
            count,
            multi_site_count: multiInDisc[name] || 0,
            multi_site_orgs: multiOrgsInDisc[name] || [],
          }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 15);
      };

      // Global = toutes les orgs
      const disciplines = buildDiscList(orgs);

      // Par site : map venue_id → liste d'orgs présentes sur ce site
      const orgsByVenue = {};
      regs.forEach(r => {
        if (!r.organization_id || !r.venue_id) return;
        if (!orgsByVenue[r.venue_id]) orgsByVenue[r.venue_id] = new Set();
        orgsByVenue[r.venue_id].add(r.organization_id);
      });
      const disciplines_by_site = {};
      Object.entries(orgsByVenue).forEach(([venueId, orgIdSet]) => {
        const venueOrgs = orgs.filter(o => orgIdSet.has(o.id));
        disciplines_by_site[venueId] = {
          venue_name: venueById[venueId]?.name || 'Site inconnu',
          venue_code: venueById[venueId]?.code || '',
          total_orgs: venueOrgs.length,
          disciplines: buildDiscList(venueOrgs),
        };
      });

      // Liste pour le sélecteur (sites avec au moins 1 inscription)
      const sites_list = Object.keys(orgsByVenue).map(vid => ({
        id: vid,
        name: venueById[vid]?.name || 'Site inconnu',
        count: orgsByVenue[vid].size,
      })).sort((a, b) => b.count - a.count);

      // Stats globales multi-sites : liste complète avec nom et sites
      const multi_site_orgs_count = multiSiteOrgIds.size;
      const multi_site_orgs_list = orgs
        .filter(o => multiSiteOrgIds.has(o.id))
        .map(o => ({
          id: o.id,
          name: o.name,
          discipline: o.discipline || 'Autre',
          sites: Array.from(orgSitesMap[o.id] || []).map(vid => venueById[vid]?.name || vid),
          sites_count: (orgSitesMap[o.id] || new Set()).size,
        }))
        .sort((a, b) => b.sites_count - a.sites_count);

      // 3. Completion distribution (histogram)
      const buckets = { '0–25%': 0, '26–50%': 0, '51–75%': 0, '76–99%': 0, '100%': 0 };
      regs.forEach(r => {
        const c = r.completion_percent || 0;
        if (c >= 100) buckets['100%']++;
        else if (c >= 76) buckets['76–99%']++;
        else if (c >= 51) buckets['51–75%']++;
        else if (c >= 26) buckets['26–50%']++;
        else buckets['0–25%']++;
      });
      const completion = Object.entries(buckets).map(([range, count]) => ({ range, count }));

      // 4. Cautions status
      const cautionsStatus = { recues: 0, en_attente: 0, en_retard: 0, non_demandees: 0 };
      const today = new Date();
      const eventDate = new Date('2026-08-14');
      const J7 = new Date(eventDate); J7.setDate(J7.getDate() - 7);
      deposits.forEach(d => {
        if (d.status === 'recue' || d.status === 'verrouille') cautionsStatus.recues++;
        else if (d.status === 'en_attente') {
          if (today > J7) cautionsStatus.en_retard++;
          else cautionsStatus.en_attente++;
        } else cautionsStatus.non_demandees++;
      });

      // 5. Mailing funnel
      const mailingFunnel = {
        sent: emails.length,
        opened: emails.filter(e => e.opened_at).length,
        clicked: emails.filter(e => e.clicked_at).length,
        failed: emails.filter(e => e.send_status === 'echec').length,
      };
      mailingFunnel.open_rate_pct = mailingFunnel.sent ? Math.round((mailingFunnel.opened / mailingFunnel.sent) * 100) : 0;
      mailingFunnel.click_rate_pct = mailingFunnel.sent ? Math.round((mailingFunnel.clicked / mailingFunnel.sent) * 100) : 0;

      // 6. Daily registration timeline (last 30 days)
      const timeline = {};
      const days = 30;
      for (let i = days; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0,0,0,0);
        timeline[d.toISOString().slice(0,10)] = 0;
      }
      regs.forEach(r => {
        const cd = r.created_at ? new Date(r.created_at) : null;
        if (!cd) return;
        const key = cd.toISOString().slice(0, 10);
        if (timeline[key] !== undefined) timeline[key]++;
      });
      const registrations_timeline = Object.entries(timeline).map(([date, count]) => ({ date, count }));

      // 7. Days to event
      const daysToEvent = Math.ceil((eventDate - today) / (1000 * 60 * 60 * 24));

      return json({
        historic,
        disciplines,
        disciplines_by_site,
        sites_list,
        multi_site_orgs_count,
        multi_site_orgs_list,
        completion,
        cautions_status: cautionsStatus,
        mailing_funnel: mailingFunnel,
        registrations_timeline,
        days_to_event: daysToEvent,
        total_organizations: orgs.length,
        total_registrations: regs.length,
        total_campaigns: campaigns.length,
      });
    }

    // ---- Scheduled emails listing ----
    if (route === 'mailing/scheduled') {
      const list = await db.collection('email_campaigns').find({ status: 'programmee' }).sort({ scheduled_at: 1 }).toArray();
      return json(list.map(({ _id, scheduled_payload, ...rest }) => ({ ...rest, recipients_count: scheduled_payload?.registration_ids?.length || 0 })));
    }

    // ---- Tracking : open pixel (1x1 GIF) ----
    if (route.match(/^track\/open\/[^/]+\.gif$/)) {
      const messageId = p[2].replace(/\.gif$/, '');
      await db.collection('email_messages').updateOne({ id: messageId, opened_at: null }, { $set: { opened_at: new Date(), updated_at: new Date() } });
      const gif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
      return new Response(gif, { status: 200, headers: { 'Content-Type': 'image/gif', 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0', 'Pragma': 'no-cache' } });
    }

    // ---- Tracking : click redirect ----
    if (route.match(/^track\/click\/[^/]+$/)) {
      const messageId = p[2];
      const target = url.searchParams.get('u');
      await db.collection('email_messages').updateOne({ id: messageId }, { $set: { clicked_at: new Date(), updated_at: new Date() }, $inc: { click_count: 1 } });
      if (!target) return new Response('Missing target', { status: 400 });
      return new Response(null, { status: 302, headers: { 'Location': target, 'Cache-Control': 'no-store' } });
    }

    // ---- Dashboard enrichi ----
    if (route === 'dashboard/extended') {
      const regs = await db.collection('registrations').find({ edition_id: EDITION_ID }).toArray();
      const orgs = await db.collection('organizations').find({}).toArray();
      const orgById = Object.fromEntries(orgs.map(o => [o.id, o]));
      const deps = await db.collection('deposit_transactions').find({}).toArray();
      const depByReg = Object.fromEntries(deps.map(d => [d.registration_id, d]));
      const venues = await db.collection('venues').find({ edition_id: EDITION_ID }).toArray();
      const vById = Object.fromEntries(venues.map(v => [v.id, v]));

      const atRisk = regs
        .filter(r => r.status !== 'confirme')
        .map(r => {
          const o = orgById[r.organization_id];
          const dep = depByReg[r.id];
          let score = 0;
          if (!r.is_convention_signed) score += 30;
          if (!r.is_insurance_uploaded) score += 30;
          if (!dep || dep.status !== 'recue') score += 30;
          if ((r.completion_percent || 0) < 30) score += 20;
          return {
            id: r.id, organization_name: o?.name || '—', discipline: o?.discipline,
            venue_name: vById[r.venue_id]?.name || '—',
            completion_percent: r.completion_percent || 0,
            email: o?.main_email, status: r.status, risk_score: score,
            missing: [
              !r.is_convention_signed && 'Convention',
              !r.is_insurance_uploaded && 'Assurance',
              (!dep || dep.status !== 'recue') && 'Caution',
            ].filter(Boolean),
          };
        })
        .sort((a, b) => b.risk_score - a.risk_score)
        .slice(0, 5);

      const since = new Date(Date.now() - 14 * 86400000);
      const msgs = await db.collection('email_messages').find({ sent_at: { $gte: since } }).toArray();
      const byDay = {};
      for (const m of msgs) {
        const d = new Date(m.sent_at).toISOString().slice(0, 10);
        byDay[d] = (byDay[d] || 0) + 1;
      }
      const cadence = Object.entries(byDay).map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date));

      const totalSent = msgs.filter(m => m.send_status === 'envoye').length;
      const totalOpened = msgs.filter(m => m.opened_at).length;
      const totalClicked = msgs.filter(m => m.clicked_at).length;
      const openRate = totalSent ? Math.round((totalOpened / totalSent) * 100) : 0;
      const clickRate = totalSent ? Math.round((totalClicked / totalSent) * 100) : 0;

      const eventStart = new Date('2026-08-14T08:00:00');
      const daysToEvent = Math.max(0, Math.ceil((eventStart - new Date()) / 86400000));

      const completions = regs.map(r => r.completion_percent || 0);
      const avgCompletion = completions.length ? Math.round(completions.reduce((a, b) => a + b, 0) / completions.length) : 0;
      const fullyComplete = completions.filter(c => c >= 100).length;

      const alerts = [];
      const stale = regs.filter(r => r.status === 'a_relancer' && r.updated_at && (new Date() - new Date(r.updated_at)) > 7 * 86400000);
      if (stale.length > 0) alerts.push({ severity: 'warning', icon: '⏳', text: `${stale.length} exposant(s) sans réponse depuis +7 jours` });
      const noPayment = regs.filter(r => (depByReg[r.id]?.status !== 'recue') && r.status !== 'prospect');
      if (daysToEvent < 60 && noPayment.length > 0) alerts.push({ severity: 'critical', icon: '🚨', text: `${noPayment.length} caution(s) non encaissée(s) à ${daysToEvent}j de l'événement` });
      const noInsurance = regs.filter(r => !r.is_insurance_uploaded && r.status !== 'prospect');
      if (noInsurance.length > 5) alerts.push({ severity: 'warning', icon: '🛡️', text: `${noInsurance.length} exposant(s) sans assurance déposée` });

      // 💰 Caution restitutions à programmer (RDV en attente ou questionnaires soumis sans RDV)
      const pendingAppointments = await db.collection('caution_appointments').countDocuments({ status: 'demande' });
      if (pendingAppointments > 0) {
        alerts.push({
          severity: 'info',
          icon: '🗓️',
          text: `${pendingAppointments} RDV de restitution caution à confirmer`,
          action_link: '/aracom?tab=bilans',
          action_label: 'Voir les RDV',
        });
      }

      return json({
        days_to_event: daysToEvent,
        at_risk: atRisk,
        cadence,
        mailing_engagement: { sent: totalSent, opened: totalOpened, clicked: totalClicked, open_rate_pct: openRate, click_rate_pct: clickRate },
        avg_completion: avgCompletion,
        fully_complete_count: fullyComplete,
        smart_alerts: alerts,
      });
    }

    if (route.startsWith('documents/') && route.endsWith('/download')) {
      const id = p[1];
      const doc = await db.collection('registration_documents').findOne({ id });
      if (!doc) return err('Document introuvable', 404);
      // Heavy file stored in Drive → stream content from Drive
      if (doc.drive_file_id) {
        try {
          const drive = await (await import('@/lib/drive')).getDriveClient();
          const r = await drive.files.get(
            { fileId: doc.drive_file_id, alt: 'media', supportsAllDrives: true },
            { responseType: 'arraybuffer' }
          );
          return new Response(Buffer.from(r.data), {
            status: 200,
            headers: {
              'Content-Type': doc.mime_type || 'application/octet-stream',
              'Content-Disposition': `inline; filename="${doc.file_name}"`,
              'Cache-Control': 'private, max-age=300',
            },
          });
        } catch (e) {
          // If Drive fails but we have a view link, redirect there
          if (doc.drive_view_link) {
            return Response.redirect(doc.drive_view_link, 302);
          }
          return err('Erreur lecture Drive: ' + e.message, 500);
        }
      }
      // Legacy : base64 stored in MongoDB
      if (!doc.file_data) return err('Fichier manquant', 404);
      const buf = Buffer.from(doc.file_data, 'base64');
      return new Response(buf, { status: 200, headers: { 'Content-Type': doc.mime_type || 'application/octet-stream', 'Content-Disposition': `inline; filename="${doc.file_name}"` } });
    }

    if (route === 'field-media') {
      const registration_id = url.searchParams.get('registration_id');
      const q = {};
      if (registration_id) q.registration_id = registration_id;
      const media = await db.collection('field_media').find(q, { projection: { file_data: 0 } }).sort({ captured_at: -1 }).toArray();
      return json(media.map(m => { delete m._id; return m; }));
    }

    if (route.startsWith('field-media/') && route.endsWith('/view')) {
      const id = p[1];
      const m = await db.collection('field_media').findOne({ id });
      if (!m) return err('Media introuvable', 404);
      // Prefer Drive direct view link
      if (m.drive_file_id) {
        try {
          const drive = await (await import('@/lib/drive')).getDriveClient();
          const r = await drive.files.get({ fileId: m.drive_file_id, alt: 'media', supportsAllDrives: true }, { responseType: 'arraybuffer' });
          return new Response(Buffer.from(r.data), { status: 200, headers: { 'Content-Type': m.mime_type || 'image/jpeg', 'Cache-Control': 'private, max-age=300' } });
        } catch (e) {
          console.error('[field-media drive read]', e?.message);
        }
      }
      if (!m.file_data) return err('Contenu introuvable', 404);
      const buf = Buffer.from(m.file_data, 'base64');
      return new Response(buf, { status: 200, headers: { 'Content-Type': m.mime_type || 'image/jpeg' } });
    }

    if (route === 'activity-logs/timeline') {
      const reg_id = url.searchParams.get('registration_id');
      if (!reg_id) return err('registration_id requis', 400);
      const timeline = [];
      const sessions = await db.collection('attendance_sessions').find({ registration_id: reg_id }).toArray();
      const sessionIds = sessions.map(s => s.id);
      const logs = await db.collection('activity_logs').find({ $or: [{ entity_type: 'registration', entity_id: reg_id }, { entity_type: 'attendance_session', entity_id: { $in: sessionIds } }] }).toArray();
      logs.forEach(l => timeline.push({ type: 'log', at: l.created_at, label: l.action_type, detail: JSON.stringify(l.new_values_json || {}).slice(0, 120) }));
      const docs = await db.collection('registration_documents').find({ registration_id: reg_id }, { projection: { file_data: 0 } }).toArray();
      docs.forEach(d => timeline.push({ type: 'doc', at: d.uploaded_at, label: `Document ${d.document_type}`, detail: `${d.file_name} (${d.status})` }));
      const emails = await db.collection('email_messages').find({ registration_id: reg_id }).toArray();
      emails.forEach(e => timeline.push({ type: 'email', at: e.sent_at || e.created_at, label: e.subject, detail: `${e.to_email} - ${e.send_status}` }));
      const events = await db.collection('attendance_events').find({ attendance_session_id: { $in: sessionIds } }).toArray();
      events.forEach(e => timeline.push({ type: 'event', at: e.created_at, label: e.event_type, detail: e.short_comment || `à ${e.event_time}` }));
      const anomalies = await db.collection('registration_anomalies').find({ registration_id: reg_id }).toArray();
      anomalies.forEach(a => timeline.push({ type: 'anomaly', at: a.detected_at, label: `Anomalie: ${a.anomaly_type}`, detail: a.description, severity: a.severity_level }));
      const comments = await db.collection('field_comments').find({ registration_id: reg_id }).toArray();
      comments.forEach(c => timeline.push({ type: 'comment', at: c.created_at, label: c.comment_type, detail: c.comment_text }));
      const tasks = await db.collection('tasks_or_followups').find({ registration_id: reg_id }).toArray();
      tasks.forEach(t => timeline.push({ type: 'task', at: t.created_at, label: `Tâche: ${t.title}`, detail: `${t.task_type} - ${t.status}` }));
      timeline.sort((a, b) => new Date(b.at) - new Date(a.at));
      return json(timeline);
    }

    if (route === 'exposant/briefing') {
      // 🎯 BRIEFING EXPOSANT — calcule la prochaine étape, ce qui reste à faire, et propose une action concrète
      // Accessible UNIQUEMENT au rôle exposant ou à un admin (filtré par organization_id du user connecté)
      if (ctx.role !== 'exposant' && ctx.role !== 'aracom_admin') return err('Accès refusé', 403);
      const userRec = await db.collection('users').findOne({ id: ctx.userId });
      const organizationId = userRec?.organization_id;
      if (!organizationId) return err('Organization non liée à votre compte', 403);

      const [org, reg, deadlinesCfg, docs, animSlots, deposits] = await Promise.all([
        db.collection('organizations').findOne({ id: organizationId }),
        db.collection('registrations').findOne({ organization_id: organizationId, edition_id: EDITION_ID }),
        db.collection('app_settings').findOne({ key: 'step_deadlines' }),
        db.collection('registration_documents').find({ organization_id: organizationId }).toArray(),
        db.collection('animation_slots').find({ organization_id: organizationId, edition_id: EDITION_ID }).toArray(),
        db.collection('deposit_transactions').find({ organization_id: organizationId, edition_id: EDITION_ID }).toArray(),
      ]);
      const venueDoc = reg?.venue_id ? await db.collection('venues').findOne({ id: reg.venue_id }) : null;
      const deadlines = deadlinesCfg?.deadlines || {};

      const today = new Date(); today.setHours(0, 0, 0, 0);
      const dayRemaining = (iso) => {
        if (!iso) return null;
        const d = new Date(iso); d.setHours(0, 0, 0, 0);
        return Math.round((d - today) / (1000 * 60 * 60 * 24));
      };

      const cautionReceived = (deposits || []).some(d => d.type === 'caution_received');
      const conventionDoc = (docs || []).find(d => (d.category || '').toLowerCase().includes('convention'));
      const conventionSigned = !!(conventionDoc && conventionDoc.status === 'valide');
      const validatedDocs = (docs || []).filter(d => d.status === 'valide').length;
      const hasInsurance = (docs || []).some(d => (d.category || '').toLowerCase().includes('assurance'));

      const STEPS = [
        { key: 'profile', label: 'Compléter votre profil', done: !!(org?.contact_name && org?.main_email && org?.discipline && (reg?.completion_percent || 0) >= 50), action_label: 'Aller au profil', target_tab: 'profil', deadline_key: 'profile', why: 'Permet à ARACOM de vous identifier et de communiquer avec vous.' },
        { key: 'stand', label: 'Choisir votre site et pré-réserver un stand', done: !!(reg?.venue_id && reg?.stand_code), action_label: 'Choisir mon stand', target_tab: 'parcours', target_step: 1, deadline_key: 'stand', why: 'Réserve votre emplacement avant que les autres exposants ne prennent les meilleurs.' },
        { key: 'animation', label: "Planifier vos créneaux d'animation", done: animSlots.length > 0, action_label: 'Planifier une animation', target_tab: 'parcours', target_step: 2, deadline_key: 'animation', why: "1 créneau d'1 heure maximum par jour. Vendredi 11h-17h ou samedi 9h-17h." },
        { key: 'documents', label: 'Déposer vos documents officiels', done: hasInsurance && validatedDocs >= 2, action_label: 'Téléverser mes documents', target_tab: 'parcours', target_step: 3, deadline_key: 'documents', why: "L'attestation d'assurance responsabilité civile est obligatoire pour exposer." },
        { key: 'caution', label: 'Verser votre caution (20 000 XPF)', done: cautionReceived, action_label: 'Voir les modalités de caution', target_tab: 'parcours', target_step: 3, deadline_key: 'caution', why: "Caution restituée intégralement après l'événement. Versement par chèque ou espèces auprès d'ARACOM." },
        { key: 'convention', label: 'Signer la convention de participation', done: conventionSigned, action_label: 'Voir la convention', target_tab: 'parcours', target_step: 3, deadline_key: 'convention', why: 'Document contractuel envoyé par ARACOM après validation de votre dossier.' },
      ];

      const nextStep = STEPS.find(s => !s.done);
      const completedCount = STEPS.filter(s => s.done).length;
      const totalSteps = STEPS.length;
      const percent = Math.round((completedCount / totalSteps) * 100);
      const remaining = STEPS.filter(s => !s.done).map(s => s.label);

      const urgences = STEPS.filter(s => !s.done && s.deadline_key && deadlines[s.deadline_key]).map(s => {
        const days = dayRemaining(deadlines[s.deadline_key]);
        return { step: s.key, label: s.label, days, deadline: deadlines[s.deadline_key] };
      }).filter(u => u.days != null && u.days <= 14).sort((a, b) => a.days - b.days);

      let nextStepInfo = null;
      if (nextStep) {
        const days = nextStep.deadline_key && deadlines[nextStep.deadline_key] ? dayRemaining(deadlines[nextStep.deadline_key]) : null;
        let urgency = 'normal';
        if (days != null) {
          if (days < 0) urgency = 'overdue';
          else if (days <= 3) urgency = 'critical';
          else if (days <= 7) urgency = 'warning';
        }
        nextStepInfo = {
          step_key: nextStep.key,
          label: nextStep.label,
          why: nextStep.why,
          action_label: nextStep.action_label,
          target_tab: nextStep.target_tab,
          target_step: nextStep.target_step || null,
          deadline_iso: nextStep.deadline_key ? deadlines[nextStep.deadline_key] : null,
          days_remaining: days,
          urgency,
        };
      }

      return json({
        ok: true,
        organization_name: org?.name || '',
        progress: { completed: completedCount, total: totalSteps, percent },
        next_step: nextStepInfo,
        remaining,
        urgences,
        all_steps: STEPS.map(s => ({ key: s.key, label: s.label, done: s.done })),
        completed: !nextStep,
        venue_name: venueDoc?.name || null,
        stand_code: reg?.stand_code || null,
        status: reg?.status || null,
        generated_at: new Date().toISOString(),
      });
    }


    if (route === 'dashboard/briefing') {
      // 📊 BRIEFING DYNAMIQUE — synthèse en 3 colonnes (FAIT / RESTE À FAIRE / VIGILANCE)
      // Calculé à la volée à partir de l'état réel de la DB. Aucun appel IA = instantané + gratuit.
      const [regs, venues, deadlinesCfg, anomalies, deposits, eventCfg] = await Promise.all([
        db.collection('registrations').find({ edition_id: EDITION_ID }).toArray(),
        db.collection('venues').find({ edition_id: EDITION_ID }).toArray(),
        db.collection('app_settings').findOne({ key: 'step_deadlines' }),
        db.collection('registration_anomalies').find({ resolved_status: { $ne: 'resolu' } }).toArray(),
        db.collection('deposit_transactions').find({ edition_id: EDITION_ID, type: 'caution_received' }).toArray(),
        db.collection('editions').findOne({ id: EDITION_ID }),
      ]);
      const docs = await db.collection('registration_documents').find({ status: 'valide' }).toArray();
      const venuesWithReferent = venues.filter(v => v.referent_aracom?.name).length;
      const total = regs.length;
      const confirmed = regs.filter(r => r.status === 'confirme').length;
      const aConfirmer = regs.filter(r => r.status === 'a_confirmer').length;
      const aRelancer = regs.filter(r => r.status === 'a_relancer').length;
      const prospects = regs.filter(r => r.status === 'prospect').length;
      const standsAttributed = regs.filter(r => r.stand_code).length;
      const cautionReceivedCount = deposits.length;
      const cautionTotal = deposits.reduce((a, d) => a + (d.amount || 0), 0);
      const docsValidatedCount = docs.length;
      const animationsPlanned = await db.collection('animation_slots').countDocuments({ edition_id: EDITION_ID });

      const eventDate = eventCfg?.start_date ? new Date(eventCfg.start_date) : new Date('2026-08-14');
      const today = new Date(); today.setHours(0, 0, 0, 0);
      eventDate.setHours(0, 0, 0, 0);
      const daysToEvent = Math.round((eventDate - today) / (1000 * 60 * 60 * 24));

      const deadlines = deadlinesCfg?.deadlines || {};
      const passedDeadlines = Object.entries(deadlines).filter(([, iso]) => {
        const d = new Date(iso); d.setHours(0, 0, 0, 0);
        return d < today;
      }).map(([k]) => k);
      const upcomingDeadlines = Object.entries(deadlines)
        .map(([k, iso]) => {
          const d = new Date(iso); d.setHours(0, 0, 0, 0);
          const days = Math.round((d - today) / (1000 * 60 * 60 * 24));
          return { key: k, days, iso };
        })
        .filter(x => x.days >= 0 && x.days <= 14)
        .sort((a, b) => a.days - b.days);

      const criticalAnomalies = anomalies.filter(a => a.priority === 'haute' || a.priority === 'critique').length;

      const fait = [];
      if (total > 0) fait.push(`**${total}** exposants identifiés sur les ${venues.length} sites Pacific`);
      if (confirmed > 0) fait.push(`**${confirmed}** dossiers confirmés (${Math.round(confirmed * 100 / Math.max(total, 1))}% du portefeuille)`);
      if (cautionReceivedCount > 0) fait.push(`**${cautionReceivedCount}** cautions encaissées (${cautionTotal.toLocaleString('fr-FR')} XPF)`);
      if (standsAttributed > 0) fait.push(`**${standsAttributed}** stands pré-réservés sur le plan`);
      if (animationsPlanned > 0) fait.push(`**${animationsPlanned}** créneaux d'animation planifiés`);
      if (docsValidatedCount > 0) fait.push(`**${docsValidatedCount}** documents officiels validés`);
      if (venuesWithReferent > 0) fait.push(`**${venuesWithReferent}/${venues.length}** sites avec référent ARACOM défini`);
      if (Object.keys(deadlines).length > 0) fait.push(`Deadlines configurées pour les **${Object.keys(deadlines).length}** étapes clés`);

      const reste = [];
      if (aRelancer > 0) reste.push(`Relancer les **${aRelancer}** exposants en statut "à relancer"`);
      if (aConfirmer > 0) reste.push(`Confirmer les **${aConfirmer}** dossiers "à confirmer"`);
      if (prospects > 0) reste.push(`Convertir les **${prospects}** prospects en inscriptions formelles`);
      const cautionMissing = total - cautionReceivedCount;
      if (cautionMissing > 0) reste.push(`Encaisser **${cautionMissing}** cautions restantes (${(cautionMissing * 20000).toLocaleString('fr-FR')} XPF)`);
      const noStand = total - standsAttributed;
      if (noStand > 0) reste.push(`Attribuer **${noStand}** stands non encore réservés`);
      const refMissing = venues.length - venuesWithReferent;
      if (refMissing > 0) reste.push(`Définir le référent ARACOM sur **${refMissing}** site(s) restant(s)`);
      if (upcomingDeadlines.length > 0) {
        const next = upcomingDeadlines[0];
        const lbl = { profile: 'profil', stand: 'stand', animation: 'animation', documents: 'documents', caution: 'caution', convention: 'convention' }[next.key] || next.key;
        reste.push(`Prochaine deadline : **${lbl}** (${next.days === 0 ? "aujourd'hui" : `dans ${next.days}j`})`);
      }

      const vigilance = [];
      if (daysToEvent <= 0) vigilance.push(`🚨 **L'événement a commencé** (J+${Math.abs(daysToEvent)}) — basculer en Mode Jour J`);
      else if (daysToEvent <= 30) vigilance.push(`⏰ **J-${daysToEvent}** avant le forum — phase finale critique`);
      else if (daysToEvent <= 60) vigilance.push(`📅 **J-${daysToEvent}** — phase de consolidation des inscriptions`);
      else vigilance.push(`📅 **J-${daysToEvent}** avant le forum — préparation en cours`);
      if (criticalAnomalies > 0) vigilance.push(`⚠️ **${criticalAnomalies}** anomalie(s) à priorité haute non résolue(s)`);
      if (passedDeadlines.length > 0) vigilance.push(`🔴 **${passedDeadlines.length}** deadline(s) dépassée(s) : ${passedDeadlines.join(', ')}`);
      if (cautionReceivedCount === 0 && total > 0) vigilance.push(`💰 **Aucune caution encaissée** à ce jour — relance prioritaire`);
      const lowCompletion = regs.filter(r => (r.completion_percent || 0) < 30 && r.status !== 'prospect').length;
      if (lowCompletion > 5) vigilance.push(`📉 **${lowCompletion}** dossiers avec moins de 30% de complétion`);
      if (total > 0 && Math.round(confirmed * 100 / total) < 10 && daysToEvent < 90) {
        vigilance.push(`📊 Taux de confirmation faible (${Math.round(confirmed * 100 / total)}%) au regard de l'échéance`);
      }
      if (vigilance.length === 1 && daysToEvent > 60) vigilance.push(`✨ Aucun signal critique — préparation sereine`);

      return json({
        ok: true,
        days_to_event: daysToEvent,
        stats: { total, confirmed, a_confirmer: aConfirmer, a_relancer: aRelancer, prospects, stands_attributed: standsAttributed, caution_received: cautionReceivedCount, caution_total: cautionTotal, docs_validated: docsValidatedCount, animations_planned: animationsPlanned, venues_with_referent: venuesWithReferent, venues_total: venues.length },
        sections: { fait, reste, vigilance },
        generated_at: new Date().toISOString(),
      });
    }


    if (route === 'dashboard/jour-j-live') {
      const event_date = url.searchParams.get('event_date') || '2026-08-14';
      const venues = await db.collection('venues').find({ edition_id: EDITION_ID }).toArray();
      const allSessions = await db.collection('attendance_sessions').find({ event_date }).toArray();
      const anomalies = await db.collection('registration_anomalies').find({ event_date, resolved_status: { $ne: 'resolu' } }).toArray();
      const bySite = venues.map(v => {
        const vs = allSessions.filter(s => s.venue_id === v.id);
        const present = vs.filter(s => ['arrive','parti','depart_anticipe'].includes(s.presence_status)).length;
        const absent = vs.filter(s => s.presence_status === 'absent').length;
        const waiting = vs.filter(s => s.presence_status === 'attendu').length;
        const late = vs.filter(s => s.actual_arrival_time && s.expected_arrival_time && s.actual_arrival_time > s.expected_arrival_time).length;
        const gone = vs.filter(s => ['parti','depart_anticipe'].includes(s.presence_status)).length;
        const anomCount = anomalies.filter(a => a.venue_id === v.id).length;
        return {
          venue_id: v.id, venue_name: v.name, venue_code: v.code,
          total: vs.length, present, absent, waiting, late, gone,
          anomalies: anomCount,
          rate: vs.length > 0 ? Math.round((present / vs.length) * 100) : 0,
        };
      });
      const totals = bySite.reduce((acc, s) => { acc.total += s.total; acc.present += s.present; acc.absent += s.absent; acc.waiting += s.waiting; acc.late += s.late; acc.gone += s.gone; acc.anomalies += s.anomalies; return acc; }, { total: 0, present: 0, absent: 0, waiting: 0, late: 0, gone: 0, anomalies: 0 });
      totals.rate = totals.total > 0 ? Math.round((totals.present / totals.total) * 100) : 0;
      return json({ event_date, totals, by_site: bySite });
    }

    if (route === 'alerts') {
      const anomalies = await db.collection('registration_anomalies').find({ resolved_status: { $in: ['ouvert','en_cours'] } }).toArray();
      const tasks = await db.collection('tasks_or_followups').find({ status: { $in: ['a_faire','en_cours'] } }).toArray();
      const regs = await db.collection('registrations').find({ edition_id: EDITION_ID, status: { $in: ['confirme','a_confirmer'] } }).toArray();
      const docs = await db.collection('registration_documents').find({}, { projection: { file_data: 0 } }).toArray();
      const docsByReg = {}; docs.forEach(d => { if (!docsByReg[d.registration_id]) docsByReg[d.registration_id] = []; docsByReg[d.registration_id].push(d); });
      const missing_insurance = regs.filter(r => !(docsByReg[r.id] || []).some(d => d.document_type === 'assurance' && d.status !== 'refuse')).length;
      const validation_pending = await db.collection('validation_requests').countDocuments({ status: 'en_attente' });
      const validation_rdv = await db.collection('validation_requests').countDocuments({ status: 'rdv_fixe' });
      return json({
        anomalies_open: anomalies.length,
        critical_anomalies: anomalies.filter(a => a.severity_level === 'critique').length,
        tasks_open: tasks.length,
        missing_insurance,
        validation_pending,
        validation_rdv,
      });
    }

    if (route === 'organization-preferences') {
      const organization_id = url.searchParams.get('organization_id');
      const q = {}; if (organization_id) q.organization_id = organization_id;
      const prefs = await db.collection('organization_preferences').find(q).sort({ preference_rank: 1 }).toArray();
      const venues = await db.collection('venues').find({ edition_id: EDITION_ID }).toArray();
      const vById = Object.fromEntries(venues.map(v => [v.id, v]));
      return json(prefs.map(p => { delete p._id; return { ...p, venue: vById[p.venue_id] }; }));
    }

    // ---- Venue elements : list (formes décoratives sur le plan) ----
    if (route === 'venue-elements') {
      const venue_id = url.searchParams.get('venue_id');
      const q = venue_id ? { venue_id } : {};
      const list = await db.collection('venue_elements').find(q).sort({ z_index: 1, created_at: 1 }).toArray();
      return json(list.map(e => { delete e._id; return e; }));
    }

    // ---- Access tokens : list (admin only) ----
    if (route === 'access-tokens') {
      const list = await db.collection('access_tokens').find({}).sort({ created_at: -1 }).toArray();
      const orgIds = [...new Set(list.map(t => t.organization_id).filter(Boolean))];
      const orgs = orgIds.length ? await db.collection('organizations').find({ id: { $in: orgIds } }).toArray() : [];
      const orgById = Object.fromEntries(orgs.map(o => [o.id, o]));
      return json(list.map(t => ({
        ...t, _id: undefined,
        organization: t.organization_id ? (orgById[t.organization_id] ? { id: orgById[t.organization_id].id, name: orgById[t.organization_id].name, main_email: orgById[t.organization_id].main_email } : null) : null,
        access_url: `${getPublicBaseUrl(request)}/access/${t.token}`,
        is_revoked: Boolean(t.revoked_at),
        is_expired: t.expires_at ? new Date(t.expires_at) < new Date() : false,
      })));
    }

    // ---- Google Drive : info / status ----
    if (route === 'drive/info') {
      if (!isDriveConfigured()) return json({ configured: false });
      try {
        const v = await driveValidate();
        return json({ configured: true, ...v });
      } catch (e) {
        return json({ configured: true, ok: false, error: e.message });
      }
    }

    // ---- Backups history : list all past backup exports (most recent first) ----
    if (route === 'backups') {
      const items = await db.collection('backups').find({}).sort({ created_at: -1 }).limit(50).toArray();
      return json(items.map(({ _id, ...rest }) => rest));
    }

    // ---- Push notifications : VAPID public key ----
    if (route === 'push/vapid-key') {
      return json({ public_key: getVapidPublicKey(), configured: isPushConfigured() });
    }
    // ---- Push notifications : check current user subscription ----
    if (route === 'push/me') {
      const userId = request.headers.get('x-user-id');
      if (!userId) return json({ subscribed: false });
      const count = await db.collection('push_subscriptions').countDocuments({ user_id: userId });
      return json({ subscribed: count > 0, count });
    }

    // ---- Questionnaires de satisfaction ----
    if (route === 'satisfaction') {
      // Admin : liste complète. Exposant : uniquement sa réponse (filtrage via registration_id)
      const registration_id = url.searchParams.get('registration_id');
      const q = { edition_id: EDITION_ID };
      if (registration_id) q.registration_id = registration_id;
      const surveys = await db.collection('satisfaction_surveys').find(q).sort({ submitted_at: -1 }).toArray();
      const regIds = [...new Set(surveys.map(s => s.registration_id))];
      const regs = await db.collection('registrations').find({ id: { $in: regIds } }).toArray();
      const orgs = await db.collection('organizations').find({ id: { $in: regs.map(r => r.organization_id) } }).toArray();
      const venues = await db.collection('venues').find({ edition_id: EDITION_ID }).toArray();
      const regById = Object.fromEntries(regs.map(r => [r.id, r]));
      const orgById = Object.fromEntries(orgs.map(o => [o.id, o]));
      const venueById = Object.fromEntries(venues.map(v => [v.id, v]));
      return json(surveys.map(s => {
        delete s._id;
        const r = regById[s.registration_id];
        const o = r ? orgById[r.organization_id] : null;
        const v = r ? venueById[r.venue_id] : null;
        return { ...s, organization_name: o?.name, organization_discipline: o?.discipline, venue_name: v?.name, stand_code: r?.stand_code };
      }));
    }

    if (route === 'satisfaction/stats') {
      const surveys = await db.collection('satisfaction_surveys').find({ edition_id: EDITION_ID }).toArray();
      const regs = await db.collection('registrations').find({ edition_id: EDITION_ID, status: { $in: ['confirme', 'a_confirmer', 'a_relancer'] } }).toArray();
      const venues = await db.collection('venues').find({ edition_id: EDITION_ID }).toArray();
      const venueById = Object.fromEntries(venues.map(v => [v.id, v]));
      const regById = Object.fromEntries(regs.map(r => [r.id, r]));
      const total_eligible = regs.length;
      const total_responses = surveys.length;
      const response_rate = total_eligible ? Math.round((total_responses / total_eligible) * 100) : 0;
      const avg = (arr, key) => { const vals = arr.map(x => x[key]).filter(v => typeof v === 'number'); return vals.length ? +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2) : null; };
      const overallAvg = avg(surveys, 'overall_rating');
      const orgAvg = avg(surveys, 'organization_rating');
      const standAvg = avg(surveys, 'stand_rating');
      const visitorsAvg = avg(surveys, 'visitors_rating');
      const commAvg = avg(surveys, 'communication_rating');
      const npsValues = surveys.map(s => s.nps_score).filter(v => typeof v === 'number');
      let nps = null;
      if (npsValues.length) {
        const promoters = npsValues.filter(v => v >= 9).length;
        const detractors = npsValues.filter(v => v <= 6).length;
        nps = Math.round(((promoters - detractors) / npsValues.length) * 100);
      }
      const willParticipate = { oui: 0, peut_etre: 0, non: 0, nsp: 0 };
      surveys.forEach(s => { const k = s.will_participate_next || 'nsp'; if (willParticipate[k] !== undefined) willParticipate[k]++; });
      // Stats par site
      const bySite = {};
      surveys.forEach(s => {
        const r = regById[s.registration_id];
        const vName = r && venueById[r.venue_id]?.name || 'Sans site';
        if (!bySite[vName]) bySite[vName] = { name: vName, count: 0, overallSum: 0, npsSum: 0, npsCount: 0 };
        bySite[vName].count++;
        if (typeof s.overall_rating === 'number') bySite[vName].overallSum += s.overall_rating;
        if (typeof s.nps_score === 'number') { bySite[vName].npsSum += s.nps_score; bySite[vName].npsCount++; }
      });
      const by_site = Object.values(bySite).map(x => ({ venue_name: x.name, count: x.count, avg_overall: x.count ? +(x.overallSum / x.count).toFixed(2) : null, avg_nps: x.npsCount ? +(x.npsSum / x.npsCount).toFixed(1) : null }));
      return json({
        total_eligible, total_responses, response_rate,
        avg_overall: overallAvg, avg_organization: orgAvg, avg_stand: standAvg, avg_visitors: visitorsAvg, avg_communication: commAvg,
        nps, will_participate: willParticipate, by_site,
      });
    }

    return err(`Route inconnue: ${route}`, 404);
  } catch (e) {
    console.error(e);
    return err(e.message || 'Erreur serveur', 500);
  }
}

export async function POST(request, { params }) {
  try {
    const db = await getDb();
    const p = params.path || [];
    const route = p.join('/');
    const ctx = getUserContext(request);
    const contentType = request.headers.get('content-type') || '';
    const isMultipart = contentType.includes('multipart/form-data');
    let body = {};
    if (!isMultipart) { try { body = await request.json(); } catch {} }

    // ════════════════════════════════════════════════════════════════
    // 🎯 WIZARD — Tunnel de réservation exposant en 5 étapes
    // ════════════════════════════════════════════════════════════════

    // 🔑 Login par code unique (page d'accueil simplifiée)
    if (route === 'auth/code-login') {
      const { code, role } = body;
      const ACCESS_CODE = process.env.UNIVERSAL_ACCESS_CODE || 'Projetaracom12';
      if (!code || code !== ACCESS_CODE) return err('Code invalide', 401);
      if (!['aracom_admin', 'exposant', 'pacific_centers_readonly'].includes(role)) return err('Rôle inconnu', 400);

      if (role === 'aracom_admin') {
        const u = await db.collection('users').findOne({ email: 'admin@aracom.pf' }) || await db.collection('users').findOne({ role_code: 'aracom_admin' });
        if (!u) return err('Compte admin introuvable. Contactez le support.', 500);
        return json({ ok: true, user: { id: u.id, name: u.name || 'ARACOM Admin', email: u.email, role: 'aracom_admin' } });
      }
      if (role === 'pacific_centers_readonly') {
        let u = await db.collection('users').findOne({ email: 'pacific@centers.pf' }) || await db.collection('users').findOne({ role_code: 'pacific_centers_readonly' });
        if (!u) {
          // Auto-seed compte Pacific si absent
          const uid = `u-pacific-${uuid().slice(0, 8)}`;
          await db.collection('users').insertOne({
            id: uid, name: 'Pacific Centers', email: 'pacific@centers.pf',
            role_code: 'pacific_centers_readonly', is_active: true,
            created_at: new Date(), updated_at: new Date(),
          });
          u = await db.collection('users').findOne({ id: uid });
        }
        return json({ ok: true, user: { id: u.id, name: u.name || u.full_name || 'Pacific Centers', email: u.email, role: 'pacific_centers_readonly' } });
      }
      // Exposant : pas de user spécifique — redirection vers /inscription pour saisir email
      return json({ ok: true, redirect: '/inscription' });
    }

    // 🌐 Self-register pour le tunnel public (création registration + organization vides)

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 🔐 LOGIN PAR MOT DE PASSE UNIFIÉ (email + password)
    //    - Admin ARACOM : mot de passe universel (UNIVERSAL_ACCESS_CODE)
    //    - Exposant : mot de passe créé après magic link (bcrypt)
    //    - Pacific Centers : NON autorisé → magic link uniquement
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (route === 'auth/password-login') {
      const { email, password } = body || {};
      const cleanEmail = String(email || '').trim().toLowerCase();
      if (!cleanEmail || !/^[^@]+@[^@]+\.[^@]+$/.test(cleanEmail)) return err('Email invalide', 400);
      if (!password) return err('Mot de passe requis', 400);

      const UNIVERSAL_PWD = process.env.UNIVERSAL_ACCESS_CODE || 'Projetaracom12';

      // 🔍 1) Cherche d'abord dans users (admin / pacific_centers)
      const user = await db.collection('users').findOne({ email: cleanEmail });
      if (user) {
        // 🎯 ADMIN ARACOM → mot de passe universel
        if (user.role_code === 'aracom_admin') {
          if (password !== UNIVERSAL_PWD) {
            return json({ ok: false, error: 'Mot de passe incorrect', fallback_magic_link: false }, 401);
          }
          delete user.password; delete user._id;
          return json({ ok: true, user, organization: null, redirect: '/aracom', method: 'admin_password' });
        }
        // 🚫 PACIFIC CENTERS → pas de password login, magic link uniquement
        if (user.role_code === 'pacific_centers_readonly') {
          return json({
            ok: false,
            error: 'L\'accès Pacific Centers se fait uniquement par lien envoyé par email.',
            requires_magic_link: true,
            fallback_magic_link: true,
          }, 403);
        }
        // 🎯 Exposant lié à un user (rare cas) → check sa password via org
        if (user.organization_id) {
          const bcrypt = require('bcryptjs');
          const org = await db.collection('organizations').findOne({ id: user.organization_id });
          if (org?.access_password_hash) {
            const ok = await bcrypt.compare(password, org.access_password_hash);
            if (ok) {
              delete user.password; delete user._id; delete org._id;
              return json({ ok: true, user, organization: org, redirect: '/exposant', method: 'exposant_password' });
            }
            return json({ ok: false, error: 'Mot de passe incorrect', fallback_magic_link: true }, 401);
          }
        }
        // user existe mais pas de password configuré
        return json({
          ok: false,
          error: 'Aucun mot de passe défini pour cet email. Recevez un lien magique pour en créer un.',
          no_password_set: true,
          fallback_magic_link: true,
        }, 404);
      }

      // 🔍 2) Sinon cherche dans organizations (exposant standard via main_email)
      const org = await db.collection('organizations').findOne({ main_email: cleanEmail });
      if (org) {
        const bcrypt = require('bcryptjs');
        if (!org.access_password_hash) {
          return json({
            ok: false,
            error: 'Aucun mot de passe défini pour ce compte. Recevez un lien magique pour en créer un.',
            no_password_set: true,
            fallback_magic_link: true,
          }, 404);
        }
        const ok = await bcrypt.compare(password, org.access_password_hash);
        if (!ok) {
          return json({ ok: false, error: 'Mot de passe incorrect', fallback_magic_link: true }, 401);
        }
        // Find or build a user-like object for the session (registration owner)
        const reg = await db.collection('registrations').findOne({ organization_id: org.id });
        const sessionUser = {
          id: `exp-${org.id}`,
          email: cleanEmail,
          name: org.contact_name || org.name,
          full_name: org.contact_name || org.name,
          role_code: 'exposant',
          organization_id: org.id,
          registration_id: reg?.id || null,
        };
        delete org._id;
        return json({ ok: true, user: sessionUser, organization: org, redirect: '/exposant', method: 'exposant_password' });
      }

      // 🔒 Email inconnu — réponse générique (sans leak d'existence)
      return json({
        ok: false,
        error: 'Identifiants invalides',
        fallback_magic_link: false,
      }, 401);
    }

    // 🪄 Magic link exposant — envoi par email
    if (route === 'auth/request-magic-link') {
      const { email } = body;
      const cleanEmail = String(email || '').trim().toLowerCase();
      if (!cleanEmail || !/^[^@]+@[^@]+\.[^@]+$/.test(cleanEmail)) return err('Email invalide', 400);

      // 🔍 1) Cherche d'abord dans users (admin / pacific_centers)
      const user = await db.collection('users').findOne({ email: cleanEmail });
      if (user) {
        const purpose = user.role_code === 'aracom_admin' ? 'aracom_admin'
                      : user.role_code === 'pacific_centers_readonly' ? 'pacific_centers'
                      : 'exposant';
        // Génère/réutilise un token permanent pour ce user
        let tk = await db.collection('access_tokens').findOne({ email: cleanEmail, purpose, revoked_at: null });
        if (!tk) {
          const token = require('crypto').randomBytes(32).toString('hex');
          tk = { id: uuid(), token, email: cleanEmail, user_id: user._id?.toString() || user.id || null,
                 organization_id: null, purpose, role_code: user.role_code,
                 created_at: new Date(), revoked_at: null };
          await db.collection('access_tokens').insertOne(tk);
        }
        const url = `${getPublicBaseUrl(request)}/access/${tk.token}`;
        try {
          const { sendMailAuto } = await import('@/lib/mail-config');
          const portalLabel = user.role_code === 'aracom_admin' ? 'Cockpit ARACOM'
                            : user.role_code === 'pacific_centers_readonly' ? 'Portail Pacific Centers'
                            : 'Espace exposant';
          await sendMailAuto({
            to: cleanEmail,
            subject: `🔐 Votre lien de connexion — ${portalLabel}`,
            html: `<div style="font-family:-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#F7F4EF">
              <h2 style="color:#231F20">Bonjour ${user.full_name || ''},</h2>
              <p>Voici votre lien d'accès personnel au <b>${portalLabel}</b> :</p>
              <p style="margin:32px 0;text-align:center">
                <a href="${url}" style="background:#231F20;color:#C9BC9E;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold">Accéder à mon espace</a>
              </p>
              <p style="color:#6b6258;font-size:13px">Ce lien est strictement personnel. Conservez-le précieusement.</p>
              <hr style="border:0;border-top:1px solid #D5CAAF;margin:24px 0" />
              <p style="color:#6b6258;font-size:12px">Forum de la Rentrée 2026 · ARACOM Conseil</p>
            </div>`,
          });
        } catch (e) {
          console.error('[magic-link] mail error (user):', e.message);
          return err('Impossible d\'envoyer le lien pour le moment', 500);
        }
        return json({ ok: true, sent: true, role: user.role_code });
      }

      // 🔍 2) Sinon cherche dans organizations (exposant standard)
      const org = await db.collection('organizations').findOne({ main_email: cleanEmail });
      if (!org) {
        // Réponse volontairement générique pour ne pas leaker l'existence d'un compte
        return json({ ok: true, sent: true, message: 'Si un compte existe sur cet email, un lien vient d\'être envoyé.' });
      }
      // Génère/récupère le magic link
      const url = await getOrCreateExposantAccessUrl(db, org.id, cleanEmail, request);
      try {
        const { sendMailAuto } = await import('@/lib/mail-config');
        await sendMailAuto({
          to: cleanEmail,
          subject: '🔐 Votre lien de connexion — Forum de la Rentrée 2026',
          html: `<div style="font-family:-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#F7F4EF">
            <h2 style="color:#231F20">Bonjour ${org.contact_name || org.name || ''},</h2>
            <p>Voici votre lien d'accès personnel à votre espace exposant :</p>
            <p style="margin:32px 0;text-align:center">
              <a href="${url}" style="background:#231F20;color:#C9BC9E;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold">Accéder à mon espace</a>
            </p>
            <p style="color:#6b6258;font-size:13px">Ce lien est strictement personnel. Conservez-le précieusement.</p>
            <hr style="border:0;border-top:1px solid #D5CAAF;margin:24px 0" />
            <p style="color:#6b6258;font-size:12px">Forum de la Rentrée 2026 · ARACOM Conseil</p>
          </div>`,
        });
        await db.collection('access_tokens').updateOne(
          { organization_id: org.id, purpose: 'exposant', revoked_at: null },
          { $set: { last_email_sent_at: new Date() } }
        );
      } catch (e) {
        console.error('[magic-link] mail error:', e.message);
        return err('Impossible d\'envoyer le lien pour le moment', 500);
      }
      return json({ ok: true, sent: true, role: 'exposant' });
    }


    // 🔐 EXPOSANT — Set / change own password
    if (route === 'exposant/password') {
      const ctx = getUserContext(request);
      const bcrypt = require('bcryptjs');
      const { password, current_password, organization_id } = body || {};
      // Determine target org : explicit (admin override) OR from session
      const targetOrgId = organization_id && ctx.role === 'aracom_admin' ? organization_id : ctx.organization_id;
      if (!targetOrgId) return err('Aucune organisation liée à cette session', 401);
      if (!password || password.length < 4) return err('Mot de passe requis (min. 4 caractères)', 400);
      const org = await db.collection('organizations').findOne({ id: targetOrgId });
      if (!org) return err('Organisation introuvable', 404);
      // Si un mdp existe déjà et qu'on n'est pas admin, vérifier l'ancien
      if (org.access_password_hash && ctx.role !== 'aracom_admin') {
        if (!current_password) return err('Mot de passe actuel requis pour changer', 400);
        const ok = await bcrypt.compare(current_password, org.access_password_hash);
        if (!ok) return err('Mot de passe actuel incorrect', 403);
      }
      const hash = await bcrypt.hash(password, 10);
      await db.collection('organizations').updateOne(
        { id: targetOrgId },
        { $set: { access_password_hash: hash, password_set_at: new Date(), updated_at: new Date() } }
      );
      return json({ ok: true, action: 'password_set' });
    }

    // 🔓 EXPOSANT — Verify password (accept universal admin pwd as bypass)
    if (route === 'exposant/password/verify') {
      const bcrypt = require('bcryptjs');
      const ctx = getUserContext(request);
      const { password, organization_id } = body || {};
      if (!password) return err('Mot de passe requis', 400);
      const targetOrgId = organization_id || ctx.organization_id;
      if (!targetOrgId) return err('Organisation requise', 400);
      // 🔑 Universal admin password bypass
      const UNIVERSAL_PWD = 'Projetaracom12';
      if (password === UNIVERSAL_PWD) {
        return json({ ok: true, method: 'universal_admin' });
      }
      const org = await db.collection('organizations').findOne({ id: targetOrgId });
      if (!org) return err('Organisation introuvable', 404);
      if (!org.access_password_hash) {
        return err('Aucun mot de passe défini pour cette organisation', 400);
      }
      const ok = await bcrypt.compare(password, org.access_password_hash);
      if (!ok) return err('Mot de passe incorrect', 403);
      return json({ ok: true, method: 'own_password' });
    }

    // 🗓️ ADMIN — Confirmer/modifier/annuler un RDV caution + envoyer email à l'exposant
    if (route === 'admin/caution-appointments/update') {
      const ctx = getUserContext(request);
      if (ctx.role !== 'aracom_admin') return err('Accès admin requis', 403);
      const { id, status, confirmed_date, confirmed_time, admin_note } = body || {};
      if (!id) return err('id requis', 400);
      if (!['confirme', 'propose', 'restitue', 'annule', 'demande'].includes(status)) {
        return err('status invalide', 400);
      }
      const appt = await db.collection('caution_appointments').findOne({ id });
      if (!appt) return err('RDV introuvable', 404);

      const updates = {
        status,
        updated_at: new Date(),
        admin_note: admin_note || appt.admin_note || '',
        confirmed_at: status === 'confirme' ? new Date() : (appt.confirmed_at || null),
      };
      if (confirmed_date) updates.confirmed_date = confirmed_date;
      if (confirmed_time) updates.confirmed_time = confirmed_time;
      if (status === 'restitue') updates.restituted_at = new Date();

      await db.collection('caution_appointments').updateOne({ id }, { $set: updates });

      // 📧 Notification email à l'exposant
      const org = await db.collection('organizations').findOne({ id: appt.organization_id });
      const finalDate = updates.confirmed_date || appt.requested_date;
      const finalTime = updates.confirmed_time || appt.requested_time;
      const dateStr = new Date(finalDate).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

      const subjects = {
        confirme: `✅ RDV confirmé pour la restitution de votre caution`,
        propose: `📅 Nouveau créneau proposé pour votre caution`,
        restitue: `🎉 Caution restituée — confirmation`,
        annule: `❌ RDV de restitution caution annulé`,
      };
      const bodies = {
        confirme: `<p>Bonjour ${org?.contact_name || ''},</p>
          <p>Votre RDV pour récupérer votre caution de <b>20 000 XPF</b> est confirmé pour le <b>${dateStr} à ${finalTime}</b>.</p>
          <p>📍 Adresse : ARACOM Conseil — Paea, Polynésie française</p>
          <p>Munissez-vous d'une pièce d'identité.</p>
          ${admin_note ? `<p><i>Note : ${admin_note}</i></p>` : ''}
          <p>À très bientôt,<br>L'équipe ARACOM</p>`,
        propose: `<p>Bonjour ${org?.contact_name || ''},</p>
          <p>Nous vous proposons un nouveau créneau pour récupérer votre caution :</p>
          <p style="font-size:18px"><b>${dateStr} à ${finalTime}</b></p>
          <p>📍 ARACOM Conseil — Paea</p>
          ${admin_note ? `<p><i>Note : ${admin_note}</i></p>` : ''}
          <p>Merci de nous confirmer votre venue par retour de mail.</p>
          <p>L'équipe ARACOM</p>`,
        restitue: `<p>Bonjour ${org?.contact_name || ''},</p>
          <p>Nous confirmons la restitution de votre caution de <b>20 000 XPF</b> ce ${dateStr}.</p>
          <p>Merci pour votre participation au Forum de la Rentrée 2026 et à très bientôt pour la prochaine édition !</p>
          <p>L'équipe ARACOM</p>`,
        annule: `<p>Bonjour ${org?.contact_name || ''},</p>
          <p>Votre RDV de restitution caution du ${dateStr} a été annulé.</p>
          ${admin_note ? `<p><i>Motif : ${admin_note}</i></p>` : ''}
          <p>Contactez-nous pour reprogrammer.</p>
          <p>L'équipe ARACOM</p>`,
      };

      if (org?.main_email && subjects[status]) {
        try {
          await sendMail({
            to: org.main_email,
            subject: subjects[status],
            html: bodies[status],
          });
        } catch (e) { /* best effort */ }
      }

      const updated = await db.collection('caution_appointments').findOne({ id });
      delete updated._id;
      return json({ ok: true, appointment: updated });
    }

    // 🗓️ ADMIN — Créer un RDV caution pour un exposant (initiative admin)
    if (route === 'admin/caution-appointments/create') {
      const ctx = getUserContext(request);
      if (ctx.role !== 'aracom_admin') return err('Accès admin requis', 403);
      const { registration_id, organization_id, confirmed_date, confirmed_time, admin_note } = body || {};
      if (!registration_id || !confirmed_date || !confirmed_time) {
        return err('Champs requis : registration_id, confirmed_date, confirmed_time', 400);
      }
      const existing = await db.collection('caution_appointments').findOne({ registration_id });
      const appt = {
        id: existing?.id || uuid(),
        registration_id,
        organization_id: organization_id || existing?.organization_id || null,
        requested_date: existing?.requested_date || confirmed_date,
        requested_time: existing?.requested_time || confirmed_time,
        confirmed_date,
        confirmed_time,
        status: 'confirme',
        admin_note: admin_note || '',
        notes: existing?.notes || '',
        created_at: existing?.created_at || new Date(),
        updated_at: new Date(),
        confirmed_at: new Date(),
      };
      await db.collection('caution_appointments').updateOne(
        { registration_id },
        { $set: appt },
        { upsert: true }
      );
      // Email proactif
      const org = await db.collection('organizations').findOne({ id: appt.organization_id });
      if (org?.main_email) {
        const dateStr = new Date(confirmed_date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
        try {
          await sendMail({
            to: org.main_email,
            subject: `📅 RDV pour récupérer votre caution — Forum 2026`,
            html: `<p>Bonjour ${org.contact_name || ''},</p>
              <p>Nous vous donnons rendez-vous pour récupérer votre caution de <b>20 000 XPF</b> :</p>
              <p style="font-size:18px"><b>${dateStr} à ${confirmed_time}</b></p>
              <p>📍 ARACOM Conseil — Paea, Polynésie française</p>
              <p>Munissez-vous d'une pièce d'identité.</p>
              ${admin_note ? `<p><i>Note : ${admin_note}</i></p>` : ''}
              <p>Merci de confirmer votre venue par retour de mail.</p>
              <p>L'équipe ARACOM</p>`,
          });
        } catch (e) { /* best effort */ }
      }
      delete appt._id;
      return json({ ok: true, appointment: appt });
    }

    // 🗓️ EXPOSANT — Création d'une demande de RDV pour restitution caution
    if (route === 'exposant/caution-appointment') {
      const { registration_id, organization_id, requested_date, requested_time, notes } = body || {};
      if (!registration_id || !requested_date || !requested_time) {
        return err('Champs requis : registration_id, requested_date, requested_time', 400);
      }
      // Upsert (un RDV par registration)
      const existing = await db.collection('caution_appointments').findOne({ registration_id });
      const appt = {
        id: existing?.id || uuid(),
        registration_id,
        organization_id: organization_id || existing?.organization_id || null,
        requested_date,
        requested_time,
        notes: notes || '',
        status: 'demande',
        created_at: existing?.created_at || new Date(),
        updated_at: new Date(),
      };
      await db.collection('caution_appointments').updateOne(
        { registration_id },
        { $set: appt },
        { upsert: true }
      );
      delete appt._id;
      // Notification admin (mail interne — best effort)
      try {
        const org = await db.collection('organizations').findOne({ id: appt.organization_id });
        await sendMail({
          to: process.env.ARACOM_ADMIN_EMAIL || 'tevageros@me.com',
          subject: `🗓️ Demande de RDV caution — ${org?.name || 'Exposant'}`,
          html: `<p><b>${org?.name || 'Exposant'}</b> demande un RDV pour récupérer sa caution.</p>
                 <p>Créneau souhaité : <b>${new Date(requested_date).toLocaleDateString('fr-FR')} à ${requested_time}</b></p>
                 ${notes ? `<p>Note : ${notes}</p>` : ''}
                 <p>Validez ou proposez un autre créneau depuis le cockpit ARACOM.</p>`,
        });
      } catch (_e) { /* best effort */ }
      return json({ ok: true, appointment: appt });
    }

    // 📝 EXPOSANT — Soumettre les réponses du questionnaire de satisfaction
    if (route === 'exposant/satisfaction') {
      const ctx = getUserContext(request);
      // 🔒 Vérifier que le questionnaire est ouvert par l'admin (sauf admin)
      if (ctx.role !== 'aracom_admin') {
        const setting = await db.collection('app_settings').findOne({ key: 'post_event_status' });
        if (!setting?.unlocked && !setting?.value) {
          return err("Le questionnaire de satisfaction n'est pas encore ouvert. Vous serez notifié(e) par ARACOM quand il sera disponible.", 403);
        }
      }
      const orgId = body?.organization_id || ctx.organization_id;
      if (!orgId) return err('organization_id requis', 400);
      // Données structurées
      const payload = {
        id: body?.id || uuid(),
        organization_id: orgId,
        registration_id: body?.registration_id || null,
        venue_id: body?.venue_id || null,
        // Identification
        stand_code: body?.stand_code || null,
        contact: body?.contact || null,
        attending_days: body?.attending_days || [],
        first_time: body?.first_time || null, // 'first' | '1-2' | '3+'
        // Notations 1-5 (préparation + logistique)
        ratings: {
          procedure_clarte:    body?.ratings?.procedure_clarte ?? null,
          infos_pre_event:     body?.ratings?.infos_pre_event ?? null,
          reactivite_aracom:   body?.ratings?.reactivite_aracom ?? null,
          accueil_aracom:      body?.ratings?.accueil_aracom ?? null,
          materiel_quality:    body?.ratings?.materiel_quality ?? null,
          animation_fluidite:  body?.ratings?.animation_fluidite ?? null,
          visiteurs_count:     body?.ratings?.visiteurs_count ?? null,
          objectifs_atteints:  body?.ratings?.objectifs_atteints ?? null,
          satisfaction_globale: body?.ratings?.satisfaction_globale ?? null,
        },
        emplacement_conforme: body?.emplacement_conforme || null, // 'oui'|'leger'|'non'
        electricity_issue:    body?.electricity_issue || null,    // 'aucun'|'mineur'|'majeur'|'na'
        contacts_collected:   body?.contacts_collected || null,   // '0'|'1-5'|'6-15'|'15+'
        nps:                  typeof body?.nps === 'number' ? body.nps : null, // 0-10
        return_2027:          body?.return_2027 || null,          // 'oui'|'peutetre'|'non'
        // Commentaires libres
        positives:  body?.positives || '',
        improvements: body?.improvements || '',
        free_comment: body?.free_comment || '',
        submitted_at: new Date(),
      };
      await db.collection('satisfaction_responses').replaceOne(
        { organization_id: orgId },
        payload,
        { upsert: true }
      );

      // 🆕 AUTO-GÉNÉRATION : Attestation de remboursement de caution (2 exemplaires imprimables, sans signatures)
      try {
        const regId = body?.registration_id || payload.registration_id;
        if (regId) {
          const existingAttest = await db.collection('registration_documents').findOne({
            registration_id: regId,
            document_type: 'attestation_remboursement',
            status: { $in: ['valide', 'en_attente'] }
          });
          if (!existingAttest) {
            const reg = await db.collection('registrations').findOne({ id: regId });
            const org = await db.collection('organizations').findOne({ id: orgId });
            const venue = reg?.venue_id ? await db.collection('venues').findOne({ id: reg.venue_id }) : null;
            const dep = await db.collection('deposit_transactions').findOne({ registration_id: regId });
            const today = new Date().toLocaleDateString('fr-FR');
            const num = `ATT-2026-${String(regId).slice(0, 6).toUpperCase()}`;
            const html = buildRefundAttestationHTML({ org, venue, reg, dep, num, today });
            await db.collection('registration_documents').insertOne({
              id: uuid(),
              registration_id: regId,
              document_type: 'attestation_remboursement',
              file_name: `Attestation_remboursement_${(org?.name || 'exp').replace(/\s+/g, '_')}_${num}.html`,
              mime_type: 'text/html',
              file_size: html.length,
              file_data: Buffer.from(html, 'utf-8').toString('base64'),
              status: 'valide',
              is_signed: false,
              attestation_number: num,
              uploaded_by: 'aracom-auto',
              uploaded_at: new Date(),
              validated_at: new Date(),
              created_at: new Date(),
              updated_at: new Date(),
            });
          }
        }
      } catch (genErr) {
        console.error('[satisfaction auto-attestation]', genErr?.message);
      }

      return json({ ok: true, id: payload.id });
    }


    if (route === 'auth/self-register') {
      const { email } = body;
      if (!email || !/^[^@]+@[^@]+\.[^@]+$/.test(email)) return err('Email invalide');
      // Si une org existe déjà sur cet email, réutiliser
      let org = await db.collection('organizations').findOne({ main_email: email.toLowerCase() });
      let reg;
      if (org) {
        reg = await db.collection('registrations').findOne({ organization_id: org.id });
      }
      if (!reg) {
        if (!org) {
          const orgId = `org-pub-${uuid().slice(0, 8)}`;
          await db.collection('organizations').insertOne({
            id: orgId,
            name: '',
            discipline: '',
            main_email: email.toLowerCase(),
            contact_name: '',
            main_phone: '',
            created_at: new Date(), updated_at: new Date(),
            source: 'self_register',
          });
          org = await db.collection('organizations').findOne({ id: orgId });
        }
        const regId = `reg-pub-${uuid().slice(0, 12)}`;
        await db.collection('registrations').insertOne({
          id: regId,
          edition_id: EDITION_ID,
          organization_id: org.id,
          venue_id: null,
          stand_code: null,
          status: 'prospect',
          completion_percent: 5,
          wizard_step: 1,
          source: 'self_register',
          created_at: new Date(), updated_at: new Date(),
        });
        reg = await db.collection('registrations').findOne({ id: regId });
      }
      return json({ ok: true, registration_id: reg.id, organization_id: org.id });
    }

    // Seed des créneaux de passage (admin uniquement)
    if (route === 'wizard/seed-visit-slots') {
      if (ctx.role !== 'aracom_admin') return err('Réservé ARACOM', 403);
      const r = await seedVisitSlots(db);
      return json({ ok: true, ...r });
    }

    // Étape 1 — Profil
    if (route === 'wizard/profile') {
      const { registration_id, profile } = body;
      if (!registration_id || !profile) return err('registration_id et profile requis');
      const reg = await db.collection('registrations').findOne({ id: registration_id });
      if (!reg) return err('Inscription introuvable', 404);
      // Validations
      const errs = [];
      if (!profile.name) errs.push('nom de l\'association');
      if (!profile.discipline) errs.push('secteur d\'activité');
      if (!profile.contact_name) errs.push('nom du référent');
      if (!profile.main_email || !/^[^@]+@[^@]+\.[^@]+$/.test(profile.main_email)) errs.push('email valide');
      if (!profile.main_phone) errs.push('téléphone');
      const reps = parseInt(profile.representatives_count) || 0;
      if (reps < 1 || reps > WIZARD_CONFIG.MAX_REPRESENTATIVES) errs.push(`nombre de représentants (1–${WIZARD_CONFIG.MAX_REPRESENTATIVES})`);
      if (!profile.stand_description) errs.push('description du stand');
      if (profile.stand_description && profile.stand_description.length > WIZARD_CONFIG.STAND_DESCRIPTION_MAX_CHARS) {
        errs.push(`description ≤ ${WIZARD_CONFIG.STAND_DESCRIPTION_MAX_CHARS} caractères`);
      }
      if (errs.length) return err(`Champs manquants ou invalides : ${errs.join(', ')}`, 400);

      const update = {
        name: profile.name,
        discipline: profile.discipline,
        contact_name: profile.contact_name,
        contact_function: profile.contact_function || null,
        main_email: profile.main_email,
        main_phone: profile.main_phone,
        representatives_count: reps,
        stand_description: profile.stand_description,
        updated_at: new Date(),
      };
      await db.collection('organizations').updateOne({ id: reg.organization_id }, { $set: update });
      await db.collection('registrations').updateOne({ id: registration_id }, { $set: { wizard_step: 2, updated_at: new Date() } });
      return json({ ok: true, next_step: 2 });
    }

    // 🛠 ADMIN OVERRIDE — Reset/cancel any action of an exposant
    if (route.match(/^admin\/registrations\/[^/]+\/reset$/)) {
      const ctx2 = getUserContext(request);
      if (ctx2.role !== 'aracom_admin') return err('Accès admin requis', 403);
      const regId = p[2];
      const { reset } = body;
      const reg = await db.collection('registrations').findOne({ id: regId });
      if (!reg) return err('Inscription introuvable', 404);

      if (reset === 'stand') {
        await db.collection('stand_assignments').updateMany(
          { registration_id: regId, status: { $nin: ['annule', 'cancelled'] } },
          { $set: { status: 'annule', updated_at: new Date(), cancelled_by: 'admin_override' } }
        );
        await db.collection('registrations').updateOne(
          { id: regId },
          { $unset: { stand_code: '' }, $set: { wizard_step: Math.min(reg.wizard_step || 1, 3), updated_at: new Date() } }
        );
        return json({ ok: true, action: 'stand_released' });
      }
      if (reset === 'animations') {
        const r = await db.collection('animation_slots').deleteMany({ registration_id: regId });
        await db.collection('registrations').updateOne(
          { id: regId },
          { $set: { wizard_step: Math.min(reg.wizard_step || 1, 4), updated_at: new Date() } }
        );
        return json({ ok: true, action: 'animations_cleared', count: r.deletedCount });
      }
      if (reset === 'days') {
        await db.collection('registrations').updateOne(
          { id: regId },
          { $set: { attending_days: [], attending_day_times: {}, wizard_step: 2, updated_at: new Date() }, $unset: { venue_id: '', stand_code: '', visit_day_label: '' } }
        );
        await db.collection('stand_assignments').updateMany(
          { registration_id: regId, status: { $nin: ['annule', 'cancelled'] } },
          { $set: { status: 'annule', updated_at: new Date() } }
        );
        await db.collection('animation_slots').deleteMany({ registration_id: regId });
        return json({ ok: true, action: 'days_reset' });
      }
      if (reset === 'cancel') {
        await db.collection('registrations').updateOne(
          { id: regId },
          { $set: { status: 'annule', cancelled_at: new Date(), cancelled_by: 'admin_override', updated_at: new Date() } }
        );
        await db.collection('stand_assignments').updateMany(
          { registration_id: regId, status: { $nin: ['annule', 'cancelled'] } },
          { $set: { status: 'annule', updated_at: new Date() } }
        );
        await db.collection('animation_slots').updateMany(
          { registration_id: regId },
          { $set: { status: 'annulé', updated_at: new Date() } }
        );
        return json({ ok: true, action: 'registration_cancelled' });
      }
      return err('Action de reset inconnue (stand|animations|days|cancel)', 400);
    }

    // 🗑 DELETE FULL — supprime complètement la registration + ses dépendances
    if (route.match(/^admin\/registrations\/[^/]+\/delete-full$/)) {
      const ctx3 = getUserContext(request);
      if (ctx3.role !== 'aracom_admin') return err('Accès admin requis', 403);
      const regId = p[2];
      const reg = await db.collection('registrations').findOne({ id: regId });
      if (!reg) return err('Inscription introuvable', 404);
      // Garde-fou : refuse de supprimer un exposant protégé (RULES.md)
      const PROTECTED = ['I Mua Papeete', 'Dream Lab', 'ACE Arue', 'Budokan Judo Pirae', 'Lotus Bleu'];
      const org = await db.collection('organizations').findOne({ id: reg.organization_id });
      if (org && PROTECTED.includes(org.name)) {
        return err(`Refus de suppression — "${org.name}" est un exposant protégé. Utilisez "Annuler inscription" à la place.`, 403);
      }
      await db.collection('stand_assignments').deleteMany({ registration_id: regId });
      await db.collection('animation_slots').deleteMany({ registration_id: regId });
      await db.collection('validation_requests').deleteMany({ registration_id: regId });
      await db.collection('modification_tokens').deleteMany({ registration_id: regId });
      await db.collection('registration_documents').deleteMany({ registration_id: regId });
      await db.collection('registrations').deleteOne({ id: regId });
      // Si l'org n'a plus aucune reg, on supprime aussi l'org
      const otherRegs = await db.collection('registrations').countDocuments({ organization_id: reg.organization_id });
      if (otherRegs === 0 && reg.organization_id) {
        await db.collection('organizations').deleteOne({ id: reg.organization_id });
      }
      return json({ ok: true, action: 'fully_deleted', org_also_deleted: otherRegs === 0 });
    }

    // Étape 2 — Site + Jours de présence avec horaires (PAS de stand ici)

    // ➕ Créer une nouvelle registration (un nouveau site) pour une organisation existante
    if (route === 'wizard/add-site') {
      const { organization_id } = body;
      if (!organization_id) return err('organization_id requis', 400);
      const org = await db.collection('organizations').findOne({ id: organization_id });
      if (!org) return err('Organisation introuvable', 404);
      const newRegId = `reg-pub-${uuid().slice(0, 12)}`;
      await db.collection('registrations').insertOne({
        id: newRegId,
        organization_id,
        status: 'contacte',
        source: 'self_register',
        wizard_step: 2,
        attending_days: [],
        attending_day_times: {},
        created_at: new Date(),
        updated_at: new Date(),
      });
      return json({ ok: true, registration_id: newRegId, organization_id });
    }


    if (route === 'wizard/days') {
      const { registration_id, venue_id, attending_days, attending_day_times } = body;
      if (!registration_id || !venue_id) return err('registration_id et venue_id requis', 400);
      if (!Array.isArray(attending_days) || attending_days.length === 0) {
        return err('Veuillez cocher au moins un jour de présence', 400);
      }
      const validDays = attending_days.filter(d => ['vendredi', 'samedi'].includes(d));
      if (validDays.length === 0) return err('Jours invalides', 400);

      const times = attending_day_times || {};
      for (const d of validDays) {
        const t = times[d];
        if (!t || !t.start || !t.end) return err(`Horaire requis pour ${d} (heure début et fin)`, 400);
        if (t.start >= t.end) return err(`Pour ${d}, l'heure de fin doit être après l'heure de début`, 400);
      }

      const reg = await db.collection('registrations').findOne({ id: registration_id });
      if (!reg) return err('Inscription introuvable', 404);

      // Si on change de site, libère le stand précédemment réservé
      if (reg.venue_id && reg.venue_id !== venue_id && reg.stand_code) {
        await db.collection('stand_assignments').updateMany(
          { registration_id, status: { $nin: ['annule', 'cancelled'] } },
          { $set: { status: 'annule', updated_at: new Date() } }
        );
        await db.collection('registrations').updateOne(
          { id: registration_id },
          { $unset: { stand_code: '' }, $set: { updated_at: new Date() } }
        );
      }

      await db.collection('registrations').updateOne(
        { id: registration_id },
        { $set: {
            venue_id,
            attending_days: validDays,
            attending_day_times: validDays.reduce((acc, d) => { acc[d] = { start: times[d].start, end: times[d].end }; return acc; }, {}),
            visit_day_label: validDays.length === 1 ? validDays[0] : (reg.visit_day_label || null),
            wizard_step: 3,
            updated_at: new Date(),
          },
        }
      );

      // Supprime les animations sur des jours plus présents
      const removedAnims = await db.collection('animation_slots').deleteMany({
        registration_id,
        day_label: { $nin: validDays },
      });

      return json({
        ok: true,
        venue_id,
        attending_days: validDays,
        attending_day_times: validDays.reduce((acc, d) => { acc[d] = times[d]; return acc; }, {}),
        removed_animations: removedAnims.deletedCount,
        next_step: 3,
      });
    }

    // Étape 3 — Choix du stand sur la carte interactive
    if (route === 'wizard/stand') {
      const { registration_id, stand_code, venue_stand_id } = body;
      if (!registration_id) return err('registration_id requis', 400);
      if (!stand_code && !venue_stand_id) return err('Veuillez sélectionner un stand sur la carte', 400);

      const reg = await db.collection('registrations').findOne({ id: registration_id });
      if (!reg) return err('Inscription introuvable', 404);
      if (!reg.venue_id) return err('Étape 2 (site & jour) manquante', 400);

      // Résoudre le stand
      let stand = null;
      if (venue_stand_id) {
        stand = await db.collection('venue_stands').findOne({ id: venue_stand_id, venue_id: reg.venue_id });
      } else if (stand_code) {
        stand = await db.collection('venue_stands').findOne({ stand_code: String(stand_code).toUpperCase(), venue_id: reg.venue_id });
      }
      if (!stand) return err('Stand introuvable sur ce site', 404);

      // Vérifier qu'il n'est pas pris par quelqu'un d'autre
      const conflicting = await db.collection('stand_assignments').findOne({
        venue_stand_id: stand.id,
        status: { $nin: ['annule', 'cancelled'] },
        registration_id: { $ne: registration_id },
      });
      if (conflicting) {
        const otherReg = await db.collection('registrations').findOne({ id: conflicting.registration_id });
        const otherOrg = otherReg ? await db.collection('organizations').findOne({ id: otherReg.organization_id }) : null;
        return err(`Ce stand est déjà réservé par ${otherOrg?.name || 'un autre exposant'}. Choisissez-en un autre.`, 409);
      }

      // Annuler les anciennes assignations de cet exposant
      await db.collection('stand_assignments').updateMany(
        { registration_id, status: { $nin: ['annule', 'cancelled'] } },
        { $set: { status: 'annule', updated_at: new Date() } }
      );

      // Créer la nouvelle assignation
      await db.collection('stand_assignments').insertOne({
        id: uuid(),
        registration_id,
        venue_stand_id: stand.id,
        assigned_by: 'wizard',
        assigned_at: new Date(),
        status: 'provisoire',
        created_at: new Date(),
        updated_at: new Date(),
      });

      await db.collection('registrations').updateOne(
        { id: registration_id },
        { $set: { stand_code: stand.stand_code, wizard_step: 4, updated_at: new Date() } }
      );

      return json({
        ok: true,
        stand: { id: stand.id, stand_code: stand.stand_code, zone: stand.zone },
        next_step: 4,
      });
    }

    // Étape 2 — (DEPRECATED, conservé pour compat) Site + Stand + Jours en une seule fois
    if (route === 'wizard/booking') {
      const { registration_id, venue_id, stand_code, venue_stand_id, attending_days, attending_day_times } = body;
      if (!registration_id || !venue_id) return err('registration_id et venue_id requis', 400);
      if (!stand_code && !venue_stand_id) return err('Veuillez sélectionner un stand sur la carte', 400);
      if (!Array.isArray(attending_days) || attending_days.length === 0) {
        return err('Veuillez cocher au moins un jour de présence', 400);
      }
      const validDays = attending_days.filter(d => ['vendredi', 'samedi'].includes(d));
      if (validDays.length === 0) return err('Jours invalides', 400);

      // Horaires par jour : { vendredi: {start, end}, samedi: {start, end} }
      const times = attending_day_times || {};
      for (const d of validDays) {
        const t = times[d];
        if (!t || !t.start || !t.end) return err(`Horaire requis pour ${d} (heure début et fin)`, 400);
        if (t.start >= t.end) return err(`Pour ${d}, l'heure de fin doit être après l'heure de début`, 400);
      }

      const reg = await db.collection('registrations').findOne({ id: registration_id });
      if (!reg) return err('Inscription introuvable', 404);

      // Résoudre le stand
      let stand = null;
      if (venue_stand_id) {
        stand = await db.collection('venue_stands').findOne({ id: venue_stand_id, venue_id });
      } else if (stand_code) {
        stand = await db.collection('venue_stands').findOne({ stand_code: String(stand_code).toUpperCase(), venue_id });
      }
      if (!stand) return err('Stand introuvable sur ce site', 404);

      // Vérifier que le stand n'est pas déjà pris par quelqu'un d'autre
      const conflicting = await db.collection('stand_assignments').findOne({
        venue_stand_id: stand.id,
        status: { $nin: ['annule', 'cancelled'] },
        registration_id: { $ne: registration_id },
      });
      if (conflicting) {
        const otherReg = await db.collection('registrations').findOne({ id: conflicting.registration_id });
        const otherOrg = otherReg ? await db.collection('organizations').findOne({ id: otherReg.organization_id }) : null;
        return err(`Ce stand est déjà réservé par ${otherOrg?.name || 'un autre exposant'}. Choisissez-en un autre.`, 409);
      }

      // Annuler les anciennes assignations de cet exposant
      await db.collection('stand_assignments').updateMany(
        { registration_id, status: { $nin: ['annule', 'cancelled'] } },
        { $set: { status: 'annule', updated_at: new Date() } }
      );

      // Créer la nouvelle assignation (statut provisoire jusqu'à la fin du wizard)
      await db.collection('stand_assignments').insertOne({
        id: uuid(),
        registration_id,
        venue_stand_id: stand.id,
        assigned_by: 'wizard',
        assigned_at: new Date(),
        status: 'provisoire',
        created_at: new Date(),
        updated_at: new Date(),
      });

      // Mise à jour de la registration : site + stand + jours + horaires
      await db.collection('registrations').updateOne(
        { id: registration_id },
        { $set: {
            venue_id,
            stand_code: stand.stand_code,
            attending_days: validDays,
            attending_day_times: validDays.reduce((acc, d) => { acc[d] = { start: times[d].start, end: times[d].end }; return acc; }, {}),
            // Si l'exposant est présent un seul jour, on garde aussi visit_day_label pour rétro-compat
            visit_day_label: validDays.length === 1 ? validDays[0] : (reg.visit_day_label || null),
            wizard_step: 3,
            updated_at: new Date(),
          },
        }
      );

      // Si l'exposant avait des animations sur des jours qu'il ne fait plus, on les supprime
      const removedAnims = await db.collection('animation_slots').deleteMany({
        registration_id,
        day_label: { $nin: validDays },
      });

      return json({
        ok: true,
        stand: { id: stand.id, stand_code: stand.stand_code, zone: stand.zone },
        attending_days: validDays,
        attending_day_times: validDays.reduce((acc, d) => { acc[d] = times[d]; return acc; }, {}),
        removed_animations: removedAnims.deletedCount,
        next_step: 3,
      });
    }

    // Étape 3 — Animations (1 ou 2 jours, OBLIGATOIRE au moins 1)
    if (route === 'wizard/animation') {
      const { registration_id, animations, location_type, slot_type, title, target_audience, material_needs, start_time, end_time } = body;
      if (!registration_id) return err('registration_id requis');
      const reg = await db.collection('registrations').findOne({ id: registration_id });
      if (!reg) return err('Inscription introuvable', 404);
      if (!reg.venue_id || !Array.isArray(reg.attending_days) || reg.attending_days.length === 0) {
        return err('Étape 2 (site, stand, jours) manquante', 400);
      }

      // Compatibilité : si le caller envoie un objet simple, on le convertit en tableau
      let anims = Array.isArray(animations) ? animations : null;
      if (!anims && (location_type || slot_type || title)) {
        anims = [{ day_label: reg.attending_days[0], location_type, slot_type, title, target_audience, material_needs, start_time, end_time }];
      }
      if (!Array.isArray(anims) || anims.length === 0) {
        return err('Au moins une animation est obligatoire pour finaliser votre inscription', 400);
      }

      // Validation par animation
      const normalized = [];
      for (const a of anims) {
        const errs = [];
        if (!a.day_label || !reg.attending_days.includes(a.day_label)) errs.push(`jour invalide (${a.day_label || '—'})`);
        if (!a.location_type || !['sur_stand', 'zone_demo'].includes(a.location_type)) errs.push('lieu (sur stand / zone démo)');
        if (!a.slot_type) errs.push('type');
        if (!a.title) errs.push('nom');
        if (!a.description || String(a.description).trim().length < 10) errs.push('description courte (10 caractères mini)');
        if (a.description && String(a.description).length > 300) errs.push('description trop longue (300 caractères max)');
        if (!a.target_audience) errs.push('public cible');
        if (!a.start_time || !a.end_time) errs.push('horaire');
        if (a.start_time && a.end_time && a.start_time >= a.end_time) errs.push('horaire (fin > début)');
        if (errs.length) return err(`Animation ${a.day_label || '?'} : ${errs.join(', ')}`, 400);
        normalized.push({ ...a, description: String(a.description).trim() });
      }

      // Maximum 1 animation par jour
      const daysSeen = new Set();
      for (const a of normalized) {
        if (daysSeen.has(a.day_label)) return err(`Plusieurs animations sur le même jour (${a.day_label}) — 1 max par jour.`, 400);
        daysSeen.add(a.day_label);
      }

      // Vérifier conflits avec autres exposants du même site / même jour / même lieu
      for (const a of normalized) {
        const conflict = await db.collection('animation_slots').findOne({
          venue_id: reg.venue_id,
          day_label: a.day_label,
          location_type: a.location_type,
          registration_id: { $ne: registration_id },
          status: { $ne: 'annulé' },
          start_time: { $lt: a.end_time },
          end_time: { $gt: a.start_time },
        });
        if (conflict) {
          return err(`Conflit ${a.day_label} ${a.start_time}–${a.end_time} (${a.location_type === 'sur_stand' ? 'sur stand' : 'zone démo'}) : créneau déjà pris.`, 409);
        }
      }

      // Remplacer toutes les animations existantes de cet exposant
      await db.collection('animation_slots').deleteMany({ registration_id });
      const venue = await db.collection('venues').findOne({ id: reg.venue_id });
      const org = await db.collection('organizations').findOne({ id: reg.organization_id });
      const inserted = [];
      for (const a of normalized) {
        const slotId = uuid();
        const doc = {
          id: slotId,
          registration_id,
          venue_id: reg.venue_id,
          venue_name: venue?.name,
          organization_name: org?.name,
          discipline: org?.discipline,
          stand_code: reg.stand_code,
          day_label: a.day_label,
          event_date: a.day_label === 'vendredi' ? '2026-08-14' : '2026-08-15',
          start_time: a.start_time,
          end_time: a.end_time,
          slot_type: a.slot_type,
          location_type: a.location_type,
          title: a.title,
          description: a.description,
          target_audience: a.target_audience,
          material_needs: a.material_needs || '',
          status: 'planifié',
          created_at: new Date(),
          updated_at: new Date(),
        };
        await db.collection('animation_slots').insertOne(doc);
        inserted.push({ id: slotId, day_label: a.day_label });
      }

      await db.collection('registrations').updateOne(
        { id: registration_id },
        { $set: { wizard_step: 4, updated_at: new Date() } }
      );
      return json({ ok: true, animations: inserted, next_step: 4 });
    }

    // Étape 4 — Documents & RDV caution (réutilise les endpoints existants ; ici marquage step)
    if (route === 'wizard/mark-step-4') {
      const { registration_id } = body;
      if (!registration_id) return err('registration_id requis');
      const valReq = await db.collection('validation_requests').findOne({
        registration_id, status: { $in: ['rdv_fixe', 'en_attente', 'rdv_confirme'] },
      });
      if (!valReq) return err('Veuillez d\'abord fixer votre rendez-vous caution', 400);
      await db.collection('registrations').updateOne(
        { id: registration_id },
        { $set: { wizard_step: 5, updated_at: new Date() } }
      );
      return json({ ok: true, next_step: 5 });
    }

    // Étape 5 — Confirmer le RDV proposé par ARACOM
    if (route === 'wizard/rdv-confirm') {
      const { registration_id } = body;
      if (!registration_id) return err('registration_id requis');
      const valReq = await db.collection('validation_requests').findOne({
        registration_id, status: 'rdv_fixe',
      });
      if (!valReq) return err('Aucun RDV à confirmer', 404);
      await db.collection('validation_requests').updateOne(
        { id: valReq.id },
        { $set: { status: 'rdv_confirme', confirmed_by_exposant_at: new Date(), updated_at: new Date() } }
      );
      return json({ ok: true, validation_request_id: valReq.id, status: 'rdv_confirme' });
    }

    // Étape 5 — Demander une modification du RDV (renvoie en attente)
    if (route === 'wizard/rdv-modify') {
      const { registration_id, new_proposal, new_preferred_payment } = body;
      if (!registration_id) return err('registration_id requis');
      if (!new_proposal || String(new_proposal).trim().length < 3) {
        return err('Indiquez vos nouvelles disponibilités', 400);
      }
      const valReq = await db.collection('validation_requests').findOne({
        registration_id, status: { $in: ['rdv_fixe', 'rdv_confirme'] },
      });
      if (!valReq) return err('Aucun RDV à modifier', 404);
      await db.collection('validation_requests').updateOne(
        { id: valReq.id },
        { $set: {
            status: 'en_attente',
            rdv_proposal: String(new_proposal).trim(),
            ...(new_preferred_payment ? { preferred_payment: new_preferred_payment } : {}),
            rdv_date: null,
            rdv_location: null,
            modify_requested_at: new Date(),
            updated_at: new Date(),
          }
        }
      );
      return json({ ok: true, validation_request_id: valReq.id, status: 'en_attente' });
    }

    // Étape 5 — Finaliser (verrouille tout + envoie email avec badge en pièce jointe)
    if (route === 'wizard/finalize') {
      const { registration_id, regulation_accepted } = body;
      if (!registration_id) return err('registration_id requis');
      if (!regulation_accepted) return err('Vous devez accepter le règlement exposant', 400);
      const state = await getWizardState(db, registration_id);
      if (!state) return err('Inscription introuvable', 404);
      const missing = Object.entries(state.step_status).filter(([k, v]) => k !== 'step5_confirmed' && !v).map(([k]) => k);
      if (missing.length) return err(`Étapes incomplètes : ${missing.join(', ')}`, 400);

      // Tokens modification 90j
      const tokVisit = await createModificationToken(db, { registration_id, scope: 'visit_slot' });
      const tokAnim = await createModificationToken(db, { registration_id, scope: 'animation_slot' });

      await db.collection('registrations').updateOne(
        { id: registration_id },
        { $set: {
            wizard_step: 5,
            wizard_completed_at: new Date(),
            wizard_regulation_accepted: true,
            status: state.registration.status === 'confirme' ? 'confirme' : 'a_confirmer',
            modification_token_visit: tokVisit,
            modification_token_animation: tokAnim,
            updated_at: new Date(),
          },
        }
      );

      // Génère le badge PDF
      let badgeBuffer = null;
      try {
        badgeBuffer = await generateBadgePdf({
          organization: state.organization,
          registration: state.registration,
          venue: state.venue,
          visit_slot: state.visit_slot,
          animation_slots: state.animation_slots,
        });
      } catch (e) { console.error('[wizard finalize] badge generation failed:', e.message); }

      // Email avec PJ
      const baseUrl = getPublicBaseUrl(request);
      const linkVisit = `${baseUrl}/modify/visit/${tokVisit}`;
      const linkAnim = `${baseUrl}/modify/animation/${tokAnim}`;
      const a = state.animation_slots[0];
      try {
        await sendMailAuto({
          to: state.organization.main_email,
          subject: `🎉 Votre inscription au Forum 2026 est confirmée — ${state.organization.name}`,
          html: `<div style="font-family:Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto">
<h1 style="color:#1e3a8a">🎉 Bienvenue au Forum de la Rentrée 2026 !</h1>
<p>Bonjour ${state.organization.contact_name},</p>
<p>Votre inscription est <b style="color:#16a34a">officiellement validée</b>. Voici le récapitulatif de votre participation :</p>

<div style="background:#dbeafe;border-left:4px solid #1d4ed8;padding:14px 18px;border-radius:6px;margin:18px 0">
  <h3 style="margin:0 0 10px 0;color:#1e3a8a">📍 Votre passage</h3>
  <div><b>Site :</b> ${state.venue?.name}</div>
  <div><b>Stand :</b> ${state.registration.stand_code || '—'}</div>
  <div><b>Jour :</b> ${state.registration.visit_day_label === 'samedi' ? 'Samedi 15 août 2026' : 'Vendredi 14 août 2026'}</div>
  ${state.visit_slot ? `<div><b>Créneau de passage :</b> ${state.visit_slot.start_time}–${state.visit_slot.end_time}</div>` : ''}
</div>

${a ? `<div style="background:#dcfce7;border-left:4px solid #16a34a;padding:14px 18px;border-radius:6px;margin:18px 0">
  <h3 style="margin:0 0 10px 0;color:#166534">🎭 Votre animation</h3>
  <div><b>Nom :</b> ${a.title}</div>
  <div><b>Type :</b> ${a.slot_type}</div>
  <div><b>Lieu :</b> ${(a.location_type === 'sur_stand' || a.location_type === 'stand') ? 'Sur le stand' : 'Zone de démonstration'}</div>
  <div><b>Horaire :</b> ${a.start_time}–${a.end_time}</div>
  <div><b>Public cible :</b> ${a.target_audience || '—'}</div>
</div>` : ''}

<div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:14px 18px;border-radius:6px;margin:18px 0">
  <h3 style="margin:0 0 10px 0;color:#92400e">📎 Votre badge exposant</h3>
  <p style="margin:0">Votre badge officiel est en <b>pièce jointe</b>. À présenter à l'accueil le jour J.</p>
</div>

<h3 style="color:#1e3a8a;margin-top:24px">Besoin de modifier vos créneaux ?</h3>
<p>Si vous devez ajuster votre créneau de passage ou d'animation, utilisez les liens ci-dessous (valides 90 jours) :</p>
<p>
  <a href="${linkVisit}" style="display:inline-block;padding:10px 16px;background:#1d4ed8;color:white;text-decoration:none;border-radius:6px;font-weight:600;margin-right:8px">📅 Modifier mon créneau de passage</a>
</p>
<p>
  <a href="${linkAnim}" style="display:inline-block;padding:10px 16px;background:#7c3aed;color:white;text-decoration:none;border-radius:6px;font-weight:600">🎭 Modifier mon créneau d'animation</a>
</p>

<hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0"/>
<p style="font-size:13px;color:#64748b">Pour toute question, contactez ARACOM Conseil. À très vite !</p>
<p style="font-size:13px;color:#64748b">— L'équipe ARACOM × Pacific Centers</p>
</div>`,
          attachments: badgeBuffer ? [{
            filename: `Badge_${(state.organization.name || 'exposant').replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
            content: badgeBuffer,
            contentType: 'application/pdf',
          }] : [],
        }, db);
      } catch (e) { console.error('[wizard finalize] email failed:', e.message); }

      return json({
        ok: true,
        modification_links: { visit_slot: linkVisit, animation: linkAnim },
        badge_download_url: `${baseUrl}/api/wizard/badge/${registration_id}`,
      });
    }

    // ============ RESET POUR NOUVELLE ÉDITION ============
    // Remet tous les exposants à "a_relancer" + archive leurs documents + décoche les flags
    // de validation. Préserve : organisation, stand, cautions historiques, notes internes,
    // animations, planification. L'exposant devra renvoyer ses documents pour confirmer
    // l'inscription à la nouvelle édition.
    // Sécurité : nécessite le body.confirm === 'RESET-NOUVELLE-EDITION-2026'
    if (route === 'admin/reset-for-new-edition') {
      if (ctx.role !== 'aracom_admin') return err('Réservé aux admins ARACOM', 403);
      if (body?.confirm !== 'RESET-NOUVELLE-EDITION-2026') {
        return err('Confirmation requise : envoyer { confirm: "RESET-NOUVELLE-EDITION-2026" }', 400);
      }
      const now = new Date();
      const regs = await db.collection('registrations').find({ edition_id: EDITION_ID }).toArray();
      let archivedDocs = 0;
      for (const r of regs) {
        // Archive les documents existants
        const docs = await db.collection('registration_documents').find({ registration_id: r.id }).toArray();
        for (const d of docs) {
          const { _id, ...rest } = d;
          await db.collection('registration_documents_archive').insertOne({
            ...rest,
            archived_at: now,
            archived_reason: 'reset_nouvelle_edition_2026',
            archived_by: ctx.userId || 'u-admin',
            original_edition_id: r.edition_id || EDITION_ID,
          });
          archivedDocs++;
        }
        await db.collection('registration_documents').deleteMany({ registration_id: r.id });
      }
      // Reset des flags & statut sur toutes les registrations
      const rUpd = await db.collection('registrations').updateMany(
        { edition_id: EDITION_ID },
        {
          $set: {
            status: 'a_relancer',
            is_convention_signed: false,
            is_insurance_uploaded: false,
            is_guide_sent: false,
            completion_percent: 0,
            stand_code: null,              // 🆕 détache les stands pour plans vierges
            stand_detached_at: now,
            // 🆕 nettoie les données d'animation héritées des anciennes éditions
            animation_type: null,
            friday_slot_label: null,
            saturday_slot_label: null,
            planned_arrival_time: null,
            planned_departure_time: null,
            reset_for_edition_at: now,
            updated_at: now,
          },
        }
      );
      // 🆕 Annule toutes les assignments de stands (plans deviennent vierges)
      const assignResult = await db.collection('stand_assignments').updateMany(
        { status: { $ne: 'annule' } },
        { $set: { status: 'annule', cancelled_at: now, cancelled_reason: 'reset_nouvelle_edition', updated_at: now } }
      );
      // 🆕 Reset complet des animations : on archive puis on supprime
      // → Les exposants repartent sur de nouveaux créneaux (nouvelles dates 2026, nouveaux horaires Vendredi 11-17h / Samedi 9-17h)
      const oldSlots = await db.collection('animation_slots').find({}).toArray();
      let archivedSlots = 0;
      if (oldSlots.length > 0) {
        const archiveDocs = oldSlots.map(s => {
          const { _id, ...rest } = s;
          return { ...rest, archived_at: now, archived_reason: 'reset_nouvelle_edition_2026', archived_by: ctx.userId || 'u-admin' };
        });
        await db.collection('animation_slots_archive').insertMany(archiveDocs);
        archivedSlots = oldSlots.length;
        await db.collection('animation_slots').deleteMany({});
      }
      // Note : on ne touche PAS aux cautions pour préserver l'historique financier.
      //        L'admin pourra remettre à "non_demandee" manuellement si besoin.
      //        On laisse internal_notes intacts (notes archivées d'ARACOM).
      //        L'admin pourra remettre à "non_demandee" manuellement si besoin.
      //        On laisse internal_notes, stand_code, animation_type, planned_arrival_time intacts.
      // Log l'action
      await db.collection('activity_logs').insertOne({
        id: uuid(),
        actor_user_id: ctx.userId || 'u-admin',
        action: 'RESET_NEW_EDITION',
        description: `Reset global : ${regs.length} exposants remis à 'a_relancer', ${archivedDocs} documents archivés`,
        metadata: { registrations_reset: regs.length, documents_archived: archivedDocs },
        created_at: now,
      });
      // Log l'action
      await db.collection('activity_logs').insertOne({
        id: uuid(),
        actor_user_id: ctx.userId || 'u-admin',
        action: 'RESET_NEW_EDITION',
        description: `Reset global : ${regs.length} exposants remis à 'a_relancer', ${archivedDocs} documents archivés, ${oldSlots.length} animations archivées`,
        metadata: { registrations_reset: regs.length, documents_archived: archivedDocs, animations_archived: archivedSlots },
        created_at: now,
      });
      return json({
        ok: true,
        registrations_reset: rUpd.modifiedCount,
        documents_archived: archivedDocs,
        stand_assignments_cancelled: assignResult.modifiedCount,
        animations_archived: archivedSlots,
        total_registrations_found: regs.length,
        message: `✅ ${rUpd.modifiedCount} exposants remis en "à relancer". ${archivedDocs} document(s) archivé(s). ${assignResult.modifiedCount} stand(s) libéré(s). ${archivedSlots} animation(s) archivée(s) — les exposants repartent sur les nouveaux créneaux 2026 (Ven 11-17h / Sam 9-17h). L'historique est préservé.`,
      });
    }

    if (route === 'seed') {
      const result = await doSeed(body?.force || false);
      return json(result);
    }

    // ============ DOCUMENTS OFFICIELS (admin upload) ============
    // POST /api/official-documents — upload d'un PDF/document partagé à tous les exposants
    // body : { title, description, category, file_data (base64), mime_type, file_name }
    if (route === 'official-documents') {
      if (ctx.role !== 'aracom_admin') return err('Réservé aux admins ARACOM', 403);
      if (!body.title) return err('Titre requis', 400);
      if (!body.file_data) return err('Fichier requis (base64)', 400);
      const id = uuid();
      const safeFileName = (body.file_name || `${body.title}.pdf`).replace(/[^a-zA-Z0-9._-]/g, '_');
      let driveFile = null;
      let drive_url = null;
      if (isDriveConfigured()) {
        try {
          const folderId = await ensureFolderPath(['Forum 2026', 'Documents officiels']);
          const buffer = Buffer.from(body.file_data, 'base64');
          driveFile = await driveUploadFile({
            folderId,
            fileName: safeFileName,
            mimeType: body.mime_type || 'application/pdf',
            buffer,
          });
          await makeAnyoneReader(driveFile.id);
          drive_url = driveFile.webViewLink || `https://drive.google.com/file/d/${driveFile.id}/view`;
        } catch (e) {
          return err('Erreur upload Drive : ' + e.message, 500);
        }
      } else {
        return err('Google Drive non configuré — impossible d\'uploader un document officiel', 500);
      }
      const doc = {
        id,
        title: body.title,
        description: body.description || '',
        category: body.category || 'autre', // 'convention', 'guide', 'reglement', 'autre'
        file_name: safeFileName,
        mime_type: body.mime_type || 'application/pdf',
        size_bytes: Buffer.from(body.file_data, 'base64').length,
        drive_file_id: driveFile?.id || null,
        drive_url,
        active: true,
        sort_order: body.sort_order || 0,
        uploaded_by: ctx.userId || 'u-admin',
        uploaded_at: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
      };
      await db.collection('official_documents').insertOne(doc);
      delete doc._id;
      return json(doc);
    }

    // ============ DEADLINES par étape — POST (admin only) ============
    if (route === 'step-deadlines') {
      if (ctx.role !== 'aracom_admin') return err('Réservé aux admins', 403);
      const { deadlines } = body || {};
      if (!deadlines || typeof deadlines !== 'object') return err('Body invalide : deadlines requis', 400);
      const allowed = ['profile', 'stand', 'animation', 'documents', 'caution', 'convention'];
      const cleaned = {};
      for (const k of allowed) {
        if (deadlines[k] === null || deadlines[k] === '') {
          cleaned[k] = null;
        } else if (typeof deadlines[k] === 'string') {
          // Validation : doit être parsable en date
          const d = new Date(deadlines[k]);
          if (isNaN(d.getTime())) return err(`Deadline ${k} invalide`, 400);
          cleaned[k] = d.toISOString();
        }
      }
      const userId = ctx.userId || request.headers.get('x-user-id');
      const user = userId ? await db.collection('users').findOne({ id: userId }) : null;
      await db.collection('app_settings').updateOne(
        { key: 'step_deadlines' },
        {
          $set: {
            key: 'step_deadlines',
            deadlines: cleaned,
            updated_at: new Date(),
            updated_by: user?.email || userId || 'admin',
          },
        },
        { upsert: true }
      );
      return json({ ok: true, deadlines: cleaned });
    }

    // 🆕 Toggle phase post-événement (Bilans / Satisfaction) — admin only
    if (route === 'post-event-status') {
      if (ctx.role !== 'aracom_admin') return err('Réservé aux admins', 403);
      const { unlocked } = body || {};
      const userId = ctx.userId || request.headers.get('x-user-id');
      const user = userId ? await db.collection('users').findOne({ id: userId }) : null;
      await db.collection('app_settings').updateOne(
        { key: 'post_event_status' },
        {
          $set: {
            key: 'post_event_status',
            unlocked: Boolean(unlocked),
            unlocked_at: unlocked ? new Date() : null,
            unlocked_by: unlocked ? (user?.email || userId || 'admin') : null,
          },
        },
        { upsert: true }
      );
      return json({ ok: true, unlocked: Boolean(unlocked) });
    }

    // ============ VALIDATION D'UN DOCUMENT REÇU PAR L'EXPOSANT ============
    // POST /api/registration-documents/:id/validate
    // body : { decision: 'approved'|'rejected', comment }
    if (route.match(/^registration-documents\/[^/]+\/validate$/)) {
      if (ctx.role !== 'aracom_admin') return err('Réservé aux admins ARACOM', 403);
      const docId = p[1];
      const decision = body.decision;
      if (!['approved', 'rejected', 'pending'].includes(decision)) return err('Décision invalide (approved|rejected|pending)', 400);
      const doc = await db.collection('registration_documents').findOne({ id: docId });
      if (!doc) return err('Document introuvable', 404);
      const upd = {
        validation_status: decision,
        validation_comment: body.comment || null,
        validated_at: decision === 'pending' ? null : new Date(),
        validated_by: decision === 'pending' ? null : (ctx.userId || 'u-admin'),
        updated_at: new Date(),
      };
      await db.collection('registration_documents').updateOne({ id: docId }, { $set: upd });
      // Synchro flag exposant : si décision 'rejected' → décocher le flag du type de doc
      const reg = await db.collection('registrations').findOne({ id: doc.registration_id });
      if (reg && doc.document_type) {
        const flagsByType = {
          convention: 'is_convention_signed',
          attestation_assurance: 'is_insurance_uploaded',
          assurance: 'is_insurance_uploaded',
        };
        const flag = flagsByType[doc.document_type];
        if (flag) {
          await db.collection('registrations').updateOne(
            { id: reg.id },
            { $set: { [flag]: decision === 'approved', updated_at: new Date() } }
          );
        }
      }
      // Trace
      await db.collection('activity_logs').insertOne({
        id: uuid(),
        actor_user_id: ctx.userId || 'u-admin',
        action: `DOCUMENT_${decision.toUpperCase()}`,
        description: `Document ${doc.document_type} ${decision === 'approved' ? 'validé' : decision === 'rejected' ? 'refusé' : 'remis en attente'}${body.comment ? ' — ' + body.comment : ''}`,
        metadata: { registration_id: doc.registration_id, document_id: docId, decision, comment: body.comment },
        created_at: new Date(),
      });
      const out = await db.collection('registration_documents').findOne({ id: docId });
      delete out._id;
      return json(out);
    }

    // ============ PROSPECTS (création + ajout de note) ============
    if (route === 'prospects') {
      // Création d'un prospect
      const now = new Date();
      const doc = {
        id: uuid(),
        venue_id: body.venue_id || null,
        organization_name: body.organization_name || '',
        contact_name: body.contact_name || '',
        contact_email: (body.contact_email || '').toLowerCase() || null,
        contact_phone: body.contact_phone || null,
        discipline: body.discipline || null,
        status: body.status || 'a_contacter',
        notes: [],
        converted_to_registration_id: null,
        created_at: now,
        updated_at: now,
        created_by: ctx.userId || null,
      };
      if (body.initial_note) {
        doc.notes.push({ text: body.initial_note, at: now, by: ctx.userId || null });
      }
      await db.collection('prospects').insertOne(doc);
      delete doc._id;
      return json(doc);
    }
    if (route.match(/^prospects\/[^/]+\/notes$/)) {
      // Ajout d'une note à un prospect
      const pid = p[1];
      const prospect = await db.collection('prospects').findOne({ id: pid });
      if (!prospect) return err('Prospect introuvable', 404);
      const note = { text: body.text || '', at: new Date(), by: ctx.userId || null };
      await db.collection('prospects').updateOne({ id: pid }, { $push: { notes: note }, $set: { updated_at: new Date() } });
      const out = await db.collection('prospects').findOne({ id: pid }); delete out._id;
      return json(out);
    }
    if (route.match(/^prospects\/[^/]+\/convert$/)) {
      // Conversion d'un prospect en exposant (création d'une organization + registration)
      const pid = p[1];
      const prospect = await db.collection('prospects').findOne({ id: pid });
      if (!prospect) return err('Prospect introuvable', 404);
      if (prospect.converted_to_registration_id) return err('Déjà converti', 400);
      // Créer l'organisation
      const orgId = uuid();
      await db.collection('organizations').insertOne({
        id: orgId,
        name: prospect.organization_name,
        discipline: prospect.discipline || 'autre',
        primary_contact_email: prospect.contact_email,
        primary_contact_name: prospect.contact_name,
        primary_contact_phone: prospect.contact_phone,
        created_at: new Date(), updated_at: new Date(),
      });
      // Créer la registration
      const regId = uuid();
      await db.collection('registrations').insertOne({
        id: regId,
        edition_id: EDITION_ID,
        organization_id: orgId,
        venue_id: prospect.venue_id,
        stand_code: null,
        status: 'a_confirmer',
        priority: 'normale',
        is_deposit_received: false,
        created_at: new Date(), updated_at: new Date(),
      });
      // Marquer le prospect comme converti
      await db.collection('prospects').updateOne(
        { id: pid },
        { $set: { status: 'converti', converted_to_registration_id: regId, converted_at: new Date(), updated_at: new Date() } }
      );
      return json({ ok: true, organization_id: orgId, registration_id: regId });
    }

    // ============ AUTO-RESTORE DES PLANS DE SALLES (après redéploiement) ============
    // Force l'import du backup JSON embarqué (/app/data-backup/venue-layouts-backup.json)
    // Réservé aux admins ARACOM. Écrase les éléments décoratifs existants pour les venues
    // présents dans le backup. Utilisé après un redéploiement pour restaurer le travail éditorial.
    if (route === 'admin/restore-venue-layouts') {
      if (ctx.role !== 'aracom_admin') return err('Réservé aux admins ARACOM', 403);
      const db2 = await getDb();
      const r = await restoreVenueLayoutsForce(db2);
      return json(r);
    }

    // Export à la volée du JSON de backup en se basant sur la DB courante (pour regénérer le fichier)
    if (route === 'admin/export-venue-layouts') {
      if (ctx.role !== 'aracom_admin') return err('Réservé aux admins ARACOM', 403);
      const db2 = await getDb();
      const venues = await db2.collection('venues').find({}).sort({ code: 1 }).toArray();
      const result = { exported_at: new Date().toISOString(), venues: [] };
      for (const v of venues) {
        const stands = await db2.collection('venue_stands').find({ venue_id: v.id }).toArray();
        const els = await db2.collection('venue_elements').find({ venue_id: v.id }).toArray();
        result.venues.push({
          code: v.code, name: v.name, id: v.id,
          stands_count: stands.length,
          stands_with_pos: stands.filter(s => typeof s.pos_x === 'number').length,
          elements_count: els.length,
          stands: stands.map(s => ({ stand_code: s.stand_code, pos_x: s.pos_x, pos_y: s.pos_y })),
          elements: els.map(e => ({ type: e.type, shape: e.shape, pos_x: e.pos_x, pos_y: e.pos_y, width: e.width, height: e.height, rotation: e.rotation, color: e.color, label: e.label, z_index: e.z_index })),
        });
      }
      return json(result);
    }

    if (route === 'auth/login') {
      const { email, password } = body;
      const user = await db.collection('users').findOne({ email: (email || '').toLowerCase().trim() });
      if (!user) return err('Email inconnu', 401);
      if (user.password !== password) return err('Mot de passe incorrect', 401);
      // Only ARACOM admins login by password — exposants & pacific use access tokens
      if (user.role_code !== 'aracom_admin') {
        return err("Pour les exposants et Pacific Centers, l'accès se fait uniquement par lien envoyé par ARACOM.", 403);
      }
      let organization = null;
      if (user.organization_id) organization = await db.collection('organizations').findOne({ id: user.organization_id });
      delete user.password; delete user._id; if (organization) delete organization._id;
      return json({ user, organization });
    }

    // ============ ACCESS TOKENS (lien magique) ============
    // Consume a token: opens a session for the bound user (exposant or pacific)
    if (route === 'auth/consume-token') {
      const { token } = body;
      if (!token) return err('token requis', 400);
      const tk = await db.collection('access_tokens').findOne({ token });
      if (!tk) return err('Lien invalide', 404);
      if (tk.revoked_at) return err('Lien révoqué par ARACOM', 410);
      if (tk.expires_at && new Date(tk.expires_at) < new Date()) return err('Lien expiré', 410);

      // Mark used (track only first use date if not set)
      await db.collection('access_tokens').updateOne(
        { id: tk.id },
        { $set: { last_used_at: new Date(), updated_at: new Date() }, $inc: { use_count: 1 }, $setOnInsert: {} }
      );

      // Look up user
      let user = null;
      let organization = null;
      if (tk.purpose === 'inscription_exposant') {
        // Special case: token bound to a future inscription. We don't have a user yet.
        // Return a placeholder user object that the inscription page understands.
        return json({
          user: { id: 'guest-' + tk.id, email: tk.email || '', role_code: 'exposant_guest', full_name: 'Inscription en cours', organization_id: null },
          organization: null,
          token_info: { id: tk.id, purpose: tk.purpose, email: tk.email },
        });
      }
      // ⚠️ Cas spécial : un token `pacific_centers` doit TOUJOURS ouvrir le portail Pacific,
      // peu importe l'email associé. On force l'utilisation du compte Pacific Centers unique.
      // Cela évite 2 bugs : (a) email inconnu → 404, (b) email qui matche un exposant → route vers /exposant.
      if (tk.purpose === 'pacific_centers') {
        user = await db.collection('users').findOne({ role_code: 'pacific_centers_readonly' });
        if (!user) return err('Aucun compte Pacific Centers configuré dans le système', 500);
      }
      if (!user && tk.user_id) {
        user = await db.collection('users').findOne({ id: tk.user_id });
      }
      if (!user && tk.email) {
        user = await db.collection('users').findOne({ email: tk.email.toLowerCase() });
      }
      if (!user) return err('Compte associé introuvable', 404);
      if (user.organization_id) organization = await db.collection('organizations').findOne({ id: user.organization_id });
      delete user.password; delete user._id; if (organization) delete organization._id;
      return json({ user, organization, token_info: { id: tk.id, purpose: tk.purpose } });
    }

    // ============ AUTO-RENVOI DU MAGIC LINK À LA DÉCONNEXION ============
    // Appelé par le frontend juste avant clearSession() : renvoie à l'utilisateur son lien magique par email
    // pour qu'il puisse se reconnecter en un clic sans avoir à retrouver l'ancien mail.
    if (route === 'auth/logout-email') {
      const userId = request.headers.get('x-user-id');
      const role = request.headers.get('x-user-role');
      if (!userId || !role) return json({ ok: false, skipped: 'no session' });
      // Pas d'email de renvoi pour les admins ARACOM (ils se connectent par mot de passe)
      if (role === 'aracom_admin') return json({ ok: true, skipped: 'admin password login' });
      const user = await db.collection('users').findOne({ id: userId });
      if (!user?.email) return json({ ok: false, skipped: 'no email' });
      // Détermine la purpose en fonction du rôle
      const purpose = role === 'pacific_centers_readonly' ? 'pacific_centers' : 'exposant';
      // Cherche un token existant non révoqué (par user_id, email ou organization_id)
      const orQuery = [{ user_id: userId }, { email: user.email.toLowerCase() }];
      if (user.organization_id) orQuery.push({ organization_id: user.organization_id });
      let tk = await db.collection('access_tokens').findOne(
        { $or: orQuery, purpose, revoked_at: null },
        { sort: { created_at: -1 } }
      );
      // Sinon fallback sur n'importe quel token non-révoqué du user (tous purposes)
      if (!tk) {
        tk = await db.collection('access_tokens').findOne(
          { $or: orQuery, revoked_at: null },
          { sort: { created_at: -1 } }
        );
      }
      // Si aucun token trouvé → en créer un
      if (!tk) {
        const tokenStr = uuid().replace(/-/g, '') + uuid().replace(/-/g, '').slice(0, 16);
        const tokenId = uuid();
        const doc = {
          id: tokenId, token: tokenStr, purpose,
          user_id: userId, email: user.email.toLowerCase(),
          organization_id: user.organization_id || null,
          label: `Auto-renvoi déconnexion ${purpose}`,
          expires_at: null, revoked_at: null, last_used_at: null, last_email_sent_at: null,
          use_count: 0, created_at: new Date(), updated_at: new Date(), created_by: 'auto_logout',
        };
        await db.collection('access_tokens').insertOne(doc);
        tk = doc;
      }
      const accessUrl = `${getPublicBaseUrl(request)}/access/${tk.token}`;
      const displayName = user.full_name || user.email;
      const html = `<p>Bonjour ${displayName},</p>
<p>Vous venez de vous déconnecter de votre espace <b>${purpose === 'pacific_centers' ? 'Pacific Centers' : 'exposant'}</b> du Forum de la Rentrée 2026.</p>
<p>Voici à nouveau votre <b>lien personnel</b> pour vous reconnecter à tout moment :</p>
<p><a href="${accessUrl}" style="display:inline-block;padding:12px 22px;background:#1d4ed8;color:white;text-decoration:none;border-radius:6px;font-weight:600">🔐 Me reconnecter à mon espace</a></p>
<p style="font-size:12px;color:#64748b">Ce lien est <b>permanent et personnel</b>. Conservez-le précieusement (ajoutez-le à vos favoris) pour vos prochaines connexions. Aucun mot de passe à retenir.</p>
<p>À bientôt,<br/>L'équipe ARACOM</p>`;
      const subject = `🔐 Votre lien de reconnexion — Forum de la Rentrée 2026`;
      // Envoi non-bloquant (le user redirige immédiatement vers /goodbye)
      sendMailAuto({ to: user.email, subject, html }, db).then(r => {
        if (r.ok) {
          db.collection('access_tokens').updateOne({ id: tk.id }, { $set: { last_email_sent_at: new Date(), last_resent_at: new Date(), updated_at: new Date() } }).catch(() => {});
        } else {
          console.error('[logout-email]', r.error);
        }
      }).catch(e => console.error('[logout-email]', e?.message));
      return json({ ok: true, email: user.email, purpose });
    }

    // Check-in
    if (route.match(/^attendance\/[^/]+\/check-in$/)) {
      const regId = p[1];
      const { event_date, time, comment } = body;
      let s = await db.collection('attendance_sessions').findOne({ registration_id: regId, event_date });
      if (!s) return err('Session introuvable', 404);
      const now = time || new Date().toTimeString().slice(0, 5);
      await db.collection('attendance_sessions').updateOne({ id: s.id }, { $set: { actual_arrival_time: now, presence_status: 'arrive', arrival_checked_by: ctx.userId || 'u-admin', updated_at: new Date() } });
      await db.collection('attendance_events').insertOne({
        id: uuid(), attendance_session_id: s.id, event_type: 'check_in',
        event_time: now, created_by: ctx.userId || 'u-admin',
        short_comment: comment || null, detailed_comment: null, created_at: new Date(),
      });
      if (comment) {
        await db.collection('field_comments').insertOne({
          id: uuid(), registration_id: regId, attendance_session_id: s.id,
          comment_type: 'commentaire_arrivee', comment_text: comment,
          created_by: ctx.userId || 'u-admin', created_at: new Date(),
        });
      }
      // Check if late
      const expected = s.expected_arrival_time;
      if (expected && now > expected) {
        const [eh, em] = expected.split(':').map(Number);
        const [nh, nm] = now.split(':').map(Number);
        const diff = (nh * 60 + nm) - (eh * 60 + em);
        if (diff > 30) {
          await db.collection('registration_anomalies').insertOne({
            id: uuid(), registration_id: regId, attendance_session_id: s.id,
            venue_id: s.venue_id, event_date,
            anomaly_type: 'retard_important',
            severity_level: diff > 60 ? 'haute' : 'moyenne',
            title: `Retard de ${diff} min`, description: `Arrivée à ${now} au lieu de ${expected}`,
            detected_at: new Date(), reported_by: ctx.userId || 'u-admin',
            requires_deposit_review: diff > 90,
            recommended_deposit_action: diff > 90 ? 'verification_manuelle' : 'aucun_impact',
            resolved_status: 'ouvert', resolved_at: null, resolved_by: null, resolution_comment: null,
            created_at: new Date(), updated_at: new Date(),
          });
        }
      }
      await logActivity(db, ctx.userId, 'attendance_session', s.id, 'check_in', null, { time: now });
      return json({ ok: true });
    }

    // Check-out
    if (route.match(/^attendance\/[^/]+\/check-out$/)) {
      const regId = p[1];
      const { event_date, time, comment, stand_condition } = body;
      let s = await db.collection('attendance_sessions').findOne({ registration_id: regId, event_date });
      if (!s) return err('Session introuvable', 404);
      const now = time || new Date().toTimeString().slice(0, 5);
      const expected = s.expected_departure_time;
      let presence = 'parti';
      if (expected && now < expected) {
        const [eh, em] = expected.split(':').map(Number);
        const [nh, nm] = now.split(':').map(Number);
        const diff = (eh * 60 + em) - (nh * 60 + nm);
        if (diff > 30) presence = 'depart_anticipe';
      }
      await db.collection('attendance_sessions').updateOne({ id: s.id }, { $set: { actual_departure_time: now, presence_status: presence, departure_checked_by: ctx.userId || 'u-admin', departure_stand_condition: stand_condition || null, updated_at: new Date() } });
      await db.collection('attendance_events').insertOne({
        id: uuid(), attendance_session_id: s.id, event_type: 'check_out',
        event_time: now, created_by: ctx.userId || 'u-admin',
        short_comment: comment || null, detailed_comment: null, created_at: new Date(),
      });
      if (comment) {
        await db.collection('field_comments').insertOne({
          id: uuid(), registration_id: regId, attendance_session_id: s.id,
          comment_type: 'commentaire_depart', comment_text: comment,
          created_by: ctx.userId || 'u-admin', created_at: new Date(),
        });
      }
      if (presence === 'depart_anticipe') {
        await db.collection('registration_anomalies').insertOne({
          id: uuid(), registration_id: regId, attendance_session_id: s.id,
          venue_id: s.venue_id, event_date,
          anomaly_type: 'depart_avant_heure', severity_level: 'moyenne',
          title: `Départ anticipé`, description: `Départ à ${now} au lieu de ${expected}`,
          detected_at: new Date(), reported_by: ctx.userId || 'u-admin',
          requires_deposit_review: true,
          recommended_deposit_action: 'verification_manuelle',
          resolved_status: 'ouvert', resolved_at: null, resolved_by: null, resolution_comment: null,
          created_at: new Date(), updated_at: new Date(),
        });
      }
      return json({ ok: true });
    }

    // Mark absent
    if (route.match(/^attendance\/[^/]+\/mark-absent$/)) {
      const regId = p[1];
      const { event_date, comment } = body;
      let s = await db.collection('attendance_sessions').findOne({ registration_id: regId, event_date });
      if (!s) return err('Session introuvable', 404);
      await db.collection('attendance_sessions').updateOne({ id: s.id }, { $set: { presence_status: 'absent', updated_at: new Date() } });
      await db.collection('registration_anomalies').insertOne({
        id: uuid(), registration_id: regId, attendance_session_id: s.id,
        venue_id: s.venue_id, event_date,
        anomaly_type: 'absent_sans_prevenir', severity_level: 'critique',
        title: 'Absent le jour J', description: comment || 'Aucune présence constatée',
        detected_at: new Date(), reported_by: ctx.userId || 'u-admin',
        requires_deposit_review: true,
        recommended_deposit_action: 'retenue_totale',
        resolved_status: 'ouvert', resolved_at: null, resolved_by: null, resolution_comment: null,
        created_at: new Date(), updated_at: new Date(),
      });
      return json({ ok: true });
    }

    if (route === 'anomalies') {
      const anomaly = {
        id: uuid(),
        registration_id: body.registration_id,
        attendance_session_id: body.attendance_session_id || null,
        venue_id: body.venue_id || null,
        event_date: body.event_date || null,
        anomaly_type: body.anomaly_type,
        severity_level: body.severity_level || 'moyenne',
        title: body.title,
        description: body.description || null,
        detected_at: new Date(),
        reported_by: ctx.userId || 'u-admin',
        requires_deposit_review: body.requires_deposit_review || false,
        recommended_deposit_action: body.recommended_deposit_action || 'aucun_impact',
        resolved_status: 'ouvert',
        resolved_at: null, resolved_by: null, resolution_comment: null,
        created_at: new Date(), updated_at: new Date(),
      };
      await db.collection('registration_anomalies').insertOne(anomaly);
      delete anomaly._id;
      return json(anomaly, 201);
    }

    if (route === 'field-comments') {
      const c = {
        id: uuid(), registration_id: body.registration_id,
        attendance_session_id: body.attendance_session_id || null,
        comment_type: body.comment_type || 'observation',
        comment_text: body.comment_text,
        created_by: ctx.userId || 'u-admin', created_at: new Date(),
      };
      await db.collection('field_comments').insertOne(c);
      delete c._id;
      return json(c, 201);
    }

    if (route === 'emails/send') {
      // MOCKED: log email send
      const { subject, body_html, registration_ids, campaign_type } = body;
      const regs = registration_ids?.length
        ? await db.collection('registrations').find({ id: { $in: registration_ids } }).toArray()
        : await db.collection('registrations').find({ edition_id: EDITION_ID }).toArray();
      const orgs = await db.collection('organizations').find({ id: { $in: regs.map(r => r.organization_id) } }).toArray();
      const orgById = Object.fromEntries(orgs.map(o => [o.id, o]));
      // Create campaign
      const campaignId = uuid();
      await db.collection('email_campaigns').insertOne({
        id: campaignId, edition_id: EDITION_ID, name: subject || 'Campagne',
        campaign_type: campaign_type || 'relance', status: 'envoye',
        created_by: ctx.userId || 'u-admin', created_at: new Date(), updated_at: new Date(),
      });
      const msgs = [];
      for (const r of regs) {
        const o = orgById[r.organization_id];
        if (!o?.main_email) continue;
        msgs.push({
          id: uuid(), campaign_id: campaignId, registration_id: r.id,
          to_email: o.main_email, subject: subject || 'Forum Rentrée 2026',
          body_html: body_html || '<p>Bonjour,</p>',
          send_status: 'envoye', sent_at: new Date(),
          opened_at: null, clicked_at: null, response_status: 'attente',
          provider_message_id: `mock_${uuid()}`,
          created_at: new Date(), updated_at: new Date(),
        });
      }
      if (msgs.length) await db.collection('email_messages').insertMany(msgs);
      return json({ sent: msgs.length, campaign_id: campaignId });
    }

    if (route === 'reports/generate') {
      // Generate auto bilan for a registration, a site, or global
      const { scope, venue_id, registration_id, event_date } = body;
      const now = new Date();
      if (scope === 'bilan_exposant' && registration_id) {
        const reg = await db.collection('registrations').findOne({ id: registration_id });
        const org = await db.collection('organizations').findOne({ id: reg.organization_id });
        const venue = await db.collection('venues').findOne({ id: reg.venue_id });
        const sessions = await db.collection('attendance_sessions').find({ registration_id }).toArray();
        const anomalies = await db.collection('registration_anomalies').find({ registration_id }).toArray();
        const comments = await db.collection('field_comments').find({ registration_id }).toArray();
        const dep = await db.collection('deposit_transactions').findOne({ registration_id });
        const docs = await db.collection('documents').find({ registration_id }).toArray();
        const satisfaction = await db.collection('satisfaction_surveys').findOne({ registration_id, edition_id: EDITION_ID });
        let recommended = 'restitution';
        if (anomalies.some(a => ['absent_sans_prevenir','degradation','probleme_securite'].includes(a.anomaly_type))) recommended = 'retenue_totale';
        else if (anomalies.some(a => a.severity_level === 'haute' || a.severity_level === 'critique')) recommended = 'retenue_partielle';
        else if (anomalies.length) recommended = 'verification_manuelle';
        const data = {
          exposant: org?.name, discipline: org?.discipline,
          contact_name: org?.contact_name, contact_email: org?.main_email, contact_phone: org?.main_phone,
          site: venue?.name, stand: reg?.stand_code, status: reg?.status, completion_percent: reg?.completion_percent,
          documents: { uploaded: docs.length, validated: docs.filter(d => d.validation_status === 'valide').length, pending: docs.filter(d => d.validation_status === 'en_attente').length, refused: docs.filter(d => d.validation_status === 'refuse').length },
          caution: { status: dep?.status, amount_xpf: dep?.amount_xpf || 20000, received_at: dep?.received_at, post_event_review_status: dep?.post_event_review_status },
          sessions: sessions.map(s => ({ date: s.event_date, expected_arrival: s.expected_arrival_time, actual_arrival: s.actual_arrival_time, expected_departure: s.expected_departure_time, actual_departure: s.actual_departure_time, presence: s.presence_status, animation_completed: s.is_animation_completed })),
          anomalies_count: anomalies.length,
          anomalies: anomalies.map(a => ({ type: a.anomaly_type, severity: a.severity_level, title: a.title, description: a.description })),
          comments: comments.map(c => ({ type: c.comment_type, text: c.comment_text })),
          satisfaction: satisfaction ? {
            submitted_at: satisfaction.submitted_at,
            overall_rating: satisfaction.overall_rating, organization_rating: satisfaction.organization_rating,
            stand_rating: satisfaction.stand_rating, visitors_rating: satisfaction.visitors_rating,
            communication_rating: satisfaction.communication_rating, nps_score: satisfaction.nps_score,
            will_participate_next: satisfaction.will_participate_next,
            positive_points: satisfaction.positive_points, improvement_points: satisfaction.improvement_points,
            free_comment: satisfaction.free_comment,
          } : null,
          deposit_amount_xpf: dep?.amount_xpf, recommended_deposit_action: recommended,
        };
        const report = {
          id: uuid(), edition_id: EDITION_ID, venue_id: reg.venue_id,
          registration_id, report_type: 'bilan_exposant', report_status: 'genere_auto',
          generated_at: now, generated_by: ctx.userId || 'u-admin',
          validated_at: null, validated_by: null,
          report_data_json: data, pdf_file_path: null,
          created_at: now, updated_at: now,
        };
        await db.collection('post_event_reports').insertOne(report);
        if (dep) await db.collection('deposit_transactions').updateOne({ id: dep.id }, { $set: { post_event_review_status: recommended === 'restitution' ? 'a_restituer' : (recommended === 'retenue_totale' ? 'retenue_totale' : (recommended === 'retenue_partielle' ? 'retenue_partielle' : 'verification_manuelle')), post_event_review_comment: `Bilan auto: ${anomalies.length} anomalie(s)`, updated_at: now } });
        delete report._id;
        return json(report, 201);
      }
      if (scope === 'bilan_site' && venue_id) {
        const venue = await db.collection('venues').findOne({ id: venue_id });
        const regs = await db.collection('registrations').find({ venue_id, edition_id: EDITION_ID }).toArray();
        const orgs = await db.collection('organizations').find({ id: { $in: regs.map(r => r.organization_id) } }).toArray();
        const orgById = Object.fromEntries(orgs.map(o => [o.id, o]));
        const sessionsQ = { venue_id }; if (event_date) sessionsQ.event_date = event_date;
        const sessions = await db.collection('attendance_sessions').find(sessionsQ).toArray();
        const anomalies = await db.collection('registration_anomalies').find({ venue_id, ...(event_date ? { event_date } : {}) }).toArray();
        const deposits = await db.collection('deposit_transactions').find({ registration_id: { $in: regs.map(r => r.id) } }).toArray();
        const surveys = await db.collection('satisfaction_surveys').find({ registration_id: { $in: regs.map(r => r.id) } }).toArray();
        const present = sessions.filter(s => ['arrive','parti','depart_anticipe'].includes(s.presence_status)).length;
        const absent = sessions.filter(s => s.presence_status === 'absent').length;
        const late = sessions.filter(s => s.actual_arrival_time && s.expected_arrival_time && s.actual_arrival_time > s.expected_arrival_time).length;
        const early_leave = sessions.filter(s => s.presence_status === 'depart_anticipe').length;
        const cautionsRecues = deposits.filter(d => d.status === 'recue').length;
        const avg = (arr, k) => { const v = arr.map(x => x[k]).filter(n => typeof n === 'number'); return v.length ? +(v.reduce((a,b)=>a+b,0)/v.length).toFixed(2) : null; };
        const npsValues = surveys.map(s => s.nps_score).filter(v => typeof v === 'number');
        let nps = null;
        if (npsValues.length) { const pr = npsValues.filter(v => v>=9).length; const dt = npsValues.filter(v => v<=6).length; nps = Math.round(((pr-dt)/npsValues.length)*100); }
        const data = {
          site: venue?.name, event_date: event_date || 'les deux journées',
          exposants_total: regs.length, exposants_confirmes: regs.filter(r => r.status === 'confirme').length,
          expected: sessions.length, present, absent, late, early_leave,
          taux_presence: sessions.length > 0 ? Math.round((present / sessions.length) * 100) : 0,
          cautions_recues: cautionsRecues, cautions_total_attendu: regs.length, cautions_xpf_encaisse: cautionsRecues * 20000,
          anomalies_count: anomalies.length,
          anomalies_by_severity: anomalies.reduce((acc, a) => { acc[a.severity_level || 'non_critique'] = (acc[a.severity_level || 'non_critique'] || 0) + 1; return acc; }, {}),
          incidents_majeurs: anomalies.filter(a => a.severity_level === 'haute' || a.severity_level === 'critique').map(a => ({ exposant: orgById[regs.find(r => r.id === a.registration_id)?.organization_id]?.name, type: a.anomaly_type, title: a.title })),
          satisfaction: { total_responses: surveys.length, response_rate: regs.length ? Math.round((surveys.length/regs.length)*100) : 0, avg_overall: avg(surveys,'overall_rating'), avg_organization: avg(surveys,'organization_rating'), avg_stand: avg(surveys,'stand_rating'), avg_visitors: avg(surveys,'visitors_rating'), avg_communication: avg(surveys,'communication_rating'), nps, will_participate_yes: surveys.filter(s => s.will_participate_next === 'oui').length },
          exposants: regs.map(r => ({ name: orgById[r.organization_id]?.name, discipline: orgById[r.organization_id]?.discipline, stand: r.stand_code, status: r.status })),
        };
        const report = {
          id: uuid(), edition_id: EDITION_ID, venue_id, registration_id: null,
          report_type: 'bilan_site', report_status: 'genere_auto',
          generated_at: now, generated_by: ctx.userId || 'u-admin',
          validated_at: null, validated_by: null,
          report_data_json: data, pdf_file_path: null,
          created_at: now, updated_at: now,
        };
        await db.collection('post_event_reports').insertOne(report);
        delete report._id;
        return json(report, 201);
      }
      if (scope === 'bilan_global') {
        const venues = await db.collection('venues').find({ edition_id: EDITION_ID }).toArray();
        const regs = await db.collection('registrations').find({ edition_id: EDITION_ID }).toArray();
        const orgs = await db.collection('organizations').find({}).toArray();
        const orgById = Object.fromEntries(orgs.map(o => [o.id, o]));
        const sessions = await db.collection('attendance_sessions').find({}).toArray();
        const anomalies = await db.collection('registration_anomalies').find({}).toArray();
        const deposits = await db.collection('deposit_transactions').find({}).toArray();
        const surveys = await db.collection('satisfaction_surveys').find({ edition_id: EDITION_ID }).toArray();
        const docs = await db.collection('documents').find({}).toArray();
        const cautionsRecues = deposits.filter(d => d.status === 'recue').length;
        const avg = (arr, k) => { const v = arr.map(x => x[k]).filter(n => typeof n === 'number'); return v.length ? +(v.reduce((a,b)=>a+b,0)/v.length).toFixed(2) : null; };
        const npsValues = surveys.map(s => s.nps_score).filter(v => typeof v === 'number');
        let nps = null;
        if (npsValues.length) { const pr = npsValues.filter(v => v>=9).length; const dt = npsValues.filter(v => v<=6).length; nps = Math.round(((pr-dt)/npsValues.length)*100); }
        const data = {
          edition: 'Forum de la Rentrée 2026', dates: '14 & 15 août 2026',
          venues_count: venues.length,
          total_exposants: regs.length,
          by_status: regs.reduce((acc, r) => { acc[r.status || 'prospect'] = (acc[r.status || 'prospect'] || 0) + 1; return acc; }, {}),
          total_confirmed: regs.filter(r => r.status === 'confirme').length,
          total_sessions: sessions.length,
          total_present: sessions.filter(s => ['arrive','parti','depart_anticipe'].includes(s.presence_status)).length,
          total_absent: sessions.filter(s => s.presence_status === 'absent').length,
          total_anomalies: anomalies.length,
          anomalies_by_type: anomalies.reduce((acc, a) => { acc[a.anomaly_type] = (acc[a.anomaly_type] || 0) + 1; return acc; }, {}),
          anomalies_by_severity: anomalies.reduce((acc, a) => { acc[a.severity_level] = (acc[a.severity_level] || 0) + 1; return acc; }, {}),
          cautions: { recues: cautionsRecues, attendues: regs.length, xpf_encaisse: cautionsRecues * 20000, xpf_attendu: regs.length * 20000, taux_recuperation: regs.length ? Math.round((cautionsRecues/regs.length)*100) : 0 },
          documents: { total: docs.length, valides: docs.filter(d => d.validation_status === 'valide').length, en_attente: docs.filter(d => d.validation_status === 'en_attente').length, refuses: docs.filter(d => d.validation_status === 'refuse').length },
          satisfaction: { total_responses: surveys.length, response_rate: regs.length ? Math.round((surveys.length/regs.length)*100) : 0, avg_overall: avg(surveys,'overall_rating'), avg_organization: avg(surveys,'organization_rating'), avg_stand: avg(surveys,'stand_rating'), avg_visitors: avg(surveys,'visitors_rating'), avg_communication: avg(surveys,'communication_rating'), nps, will_participate_yes: surveys.filter(s => s.will_participate_next === 'oui').length, will_participate_maybe: surveys.filter(s => s.will_participate_next === 'peut_etre').length, will_participate_no: surveys.filter(s => s.will_participate_next === 'non').length, top_positives: surveys.map(s => s.positive_points).filter(Boolean).slice(0, 5), top_improvements: surveys.map(s => s.improvement_points).filter(Boolean).slice(0, 5) },
          by_site: venues.map(v => {
            const vregs = regs.filter(r => r.venue_id === v.id);
            const vsurveys = surveys.filter(s => vregs.some(r => r.id === s.registration_id));
            return { site: v.name, exposants: vregs.length, confirmes: vregs.filter(r => r.status === 'confirme').length, anomalies: anomalies.filter(a => a.venue_id === v.id).length, satisfaction_responses: vsurveys.length, satisfaction_avg: avg(vsurveys, 'overall_rating') };
          }),
        };
        const report = {
          id: uuid(), edition_id: EDITION_ID, venue_id: null, registration_id: null,
          report_type: 'bilan_global', report_status: 'genere_auto',
          generated_at: now, generated_by: ctx.userId || 'u-admin',
          validated_at: null, validated_by: null,
          report_data_json: data, pdf_file_path: null,
          created_at: now, updated_at: now,
        };
        await db.collection('post_event_reports').insertOne(report);
        delete report._id;
        return json(report, 201);
      }
      return err('scope invalide', 400);
    }

    if (route === 'tasks') {
      const t = {
        id: uuid(), registration_id: body.registration_id,
        task_type: body.task_type || 'autre', title: body.title,
        due_date: body.due_date || null, status: 'a_faire',
        assigned_to: body.assigned_to || ctx.userId || 'u-admin',
        completed_at: null, notes: body.notes || null,
        created_at: new Date(), updated_at: new Date(),
      };
      await db.collection('tasks_or_followups').insertOne(t);
      delete t._id;
      return json(t, 201);
    }

    if (route === 'documents') {
      const sizeBytes = body.size_bytes || (body.file_data ? Math.floor(body.file_data.length * 0.75) : 0);
      const HEAVY_THRESHOLD = 4 * 1024 * 1024; // 4 MB → upload vers Drive
      let driveMeta = null;
      let storeBase64 = body.file_data || null;

      // Upload heavy files to Google Drive instead of MongoDB base64
      if (sizeBytes > HEAVY_THRESHOLD && body.file_data && isDriveConfigured()) {
        try {
          const buffer = Buffer.from(String(body.file_data).replace(/^data:[^;]+;base64,/, ''), 'base64');
          // Resolve org name for folder structure
          const reg = await db.collection('registrations').findOne({ id: body.registration_id });
          const org = reg ? await db.collection('organizations').findOne({ id: reg.organization_id }) : null;
          const orgName = driveSafeName(org?.name || body.registration_id || 'inconnu');
          const folderId = await ensureFolderPath(['Documents exposants', orgName]);
          const safeName = driveSafeName(body.file_name || 'document');
          const uploaded = await driveUploadFile({
            folderId,
            fileName: `${body.document_type || 'doc'}__${Date.now()}__${safeName}`,
            mimeType: body.mime_type || 'application/octet-stream',
            buffer,
          });
          driveMeta = {
            drive_file_id: uploaded.id,
            drive_view_link: uploaded.webViewLink || null,
            drive_download_link: uploaded.webContentLink || null,
            stored_in_drive: true,
          };
          storeBase64 = null; // do not duplicate in DB
        } catch (driveErr) {
          console.error('[documents/drive-upload]', driveErr);
          // Fallback : keep base64 in DB if Drive fails
        }
      }

      const doc = {
        id: uuid(),
        registration_id: body.registration_id,
        document_type: body.document_type || 'autre',
        file_path: null,
        file_name: body.file_name || 'document',
        file_data: storeBase64,
        mime_type: body.mime_type || 'application/octet-stream',
        size_bytes: sizeBytes,
        uploaded_by: ctx.userId || 'u-admin',
        status: body.status || 'depose',
        uploaded_at: new Date(),
        validated_at: null,
        notes: body.notes || null,
        ...driveMeta,
        created_at: new Date(),
        updated_at: new Date(),
      };
      await db.collection('registration_documents').insertOne(doc);
      // Auto-flag registration if type is assurance
      if (doc.document_type === 'assurance') {
        await db.collection('registrations').updateOne({ id: doc.registration_id }, { $set: { is_insurance_uploaded: true, updated_at: new Date() } });
      }
      if (doc.document_type === 'convention') {
        await db.collection('registrations').updateOne({ id: doc.registration_id }, { $set: { is_convention_signed: true, updated_at: new Date() } });
      }
      const { file_data, ...res } = doc; delete res._id;
      return json(res, 201);
    }

    if (route === 'field-media') {
      // Resolve registration → organization → venue for folder path
      let folderPath = ['Photos Jour J'];
      let driveFile = null;
      const reg = body.registration_id ? await db.collection('registrations').findOne({ id: body.registration_id }) : null;
      const org = reg?.organization_id ? await db.collection('organizations').findOne({ id: reg.organization_id }) : null;
      const venue = reg?.venue_id ? await db.collection('venues').findOne({ id: reg.venue_id }) : null;
      // Build path: Photos Jour J / 2026-08-14 (vendredi) / Arue / I Mua Papeete - A-C01 /
      const captureDate = body.captured_at ? new Date(body.captured_at) : new Date();
      const dayLabel = captureDate.toLocaleDateString('fr-FR', { weekday: 'long' });
      const dateStr = captureDate.toISOString().slice(0, 10);
      folderPath.push(`${dateStr} (${dayLabel})`);
      if (venue?.name) folderPath.push(driveSafeName(venue.name));
      if (org?.name) folderPath.push(driveSafeName(`${org.name}${reg?.stand_code ? ' - ' + reg.stand_code : ''}`));

      // Build target file name: arrivee_I-Mua-Papeete_A-C01_20260814-0915.jpg
      const ext = (body.file_name || 'photo.jpg').split('.').pop().toLowerCase();
      const ts = captureDate.toISOString().replace(/[-:T]/g, '').slice(0, 13); // YYYYMMDDHHMM
      const orgSlug = driveSafeName(org?.name || 'exposant').replace(/\s+/g, '-');
      const stand = reg?.stand_code || '';
      const mediaType = body.media_type || 'autre';
      const targetName = `${mediaType}_${orgSlug}${stand ? '_' + stand : ''}_${ts}.${ext}`;

      // Try Drive upload if configured
      const wantDrive = body.upload_drive !== false; // default true
      if (wantDrive && isDriveConfigured() && body.file_data) {
        try {
          const folderId = await ensureFolderPath(folderPath);
          const buffer = Buffer.from(body.file_data, 'base64');
          const uploaded = await driveUploadFile({
            folderId,
            fileName: targetName,
            mimeType: body.mime_type || 'image/jpeg',
            buffer,
          });
          // Make readable by anyone with the link (so we can embed in app)
          await makeAnyoneReader(uploaded.id);
          driveFile = uploaded;
        } catch (e) {
          console.error('[field-media drive upload]', e?.message);
        }
      }

      const m = {
        id: uuid(),
        registration_id: body.registration_id,
        attendance_session_id: body.attendance_session_id || null,
        anomaly_id: body.anomaly_id || null,
        media_type: body.media_type || 'autre',
        file_path: driveFile ? `drive:${driveFile.id}` : null,
        file_name: targetName,
        // If uploaded to Drive successfully, drop base64 from MongoDB to save space
        file_data: driveFile ? null : (body.file_data || null),
        mime_type: body.mime_type || 'image/jpeg',
        size_bytes: body.size_bytes || (body.file_data ? Math.floor(body.file_data.length * 0.75) : 0),
        // Drive metadata
        drive_file_id: driveFile?.id || null,
        drive_view_link: driveFile?.webViewLink || null,
        drive_thumbnail: driveFile?.thumbnailLink || null,
        drive_folder_path: driveFile ? folderPath.join('/') : null,
        uploaded_by: ctx.userId || 'u-admin',
        captured_at: captureDate,
        created_at: new Date(),
      };
      await db.collection('field_media').insertOne(m);
      const { file_data, ...res } = m; delete res._id;
      return json(res, 201);
    }

    if (route.match(/^registrations\/[^/]+\/assign-stand$/)) {
      const regId = p[1];
      const { venue_stand_id, status, venue_id, stand_code } = body;
      // 🛡️ Always cancel previous active assignments (both detach and reassign cases)
      await db.collection('stand_assignments').updateMany({ registration_id: regId, status: { $ne: 'annule' } }, { $set: { status: 'annule', updated_at: new Date() } });
      if (venue_stand_id) {
        await db.collection('stand_assignments').insertOne({
          id: uuid(), registration_id: regId, venue_stand_id,
          assigned_by: ctx.userId || 'u-admin', assigned_at: new Date(),
          status: status || 'provisoire',
          created_at: new Date(), updated_at: new Date(),
        });
      }
      const upd = { updated_at: new Date() };
      if (venue_id !== undefined) upd.venue_id = venue_id;
      // 🆕 Support detach: stand_code: null  → set to null in DB (was previously ignored due to falsy check)
      if (stand_code !== undefined) upd.stand_code = stand_code; // null OK = detach
      await db.collection('registrations').updateOne({ id: regId }, { $set: upd });
      await logActivity(db, ctx.userId, 'registration', regId, stand_code === null ? 'stand_detach' : 'stand_assign', null, { venue_stand_id, stand_code });
      return json({ ok: true });
    }

    if (route === 'animation-slots') {
      // 🆕 Vérifs LOT 2 : verrouillage + cohérence avec attending_days
      const reg = await db.collection('registrations').findOne({ id: body.registration_id });
      if (reg) {
        const lockedReq = await db.collection('validation_requests').findOne({ registration_id: body.registration_id, status: 'verrouille' });
        if (lockedReq) return err('Dossier verrouillé par ARACOM. Modifications impossibles.', 403);
        if (Array.isArray(reg.attending_days) && reg.attending_days.length > 0 && !reg.attending_days.includes(body.day_label)) {
          return err(`Vous n'êtes pas inscrit le ${body.day_label}. Sélectionnez ce jour à l'étape 1.`, 400);
        }
      }
      // Normalisation : valeurs canoniques sur_stand / zone_demo (anciennes valeurs remappées)
      const normLoc = (v) => {
        if (v === 'sur_stand' || v === 'stand') return 'sur_stand';
        if (v === 'zone_demo' || v === 'zone_animation' || v === 'scene' || v === 'spectacle') return 'zone_demo';
        return 'sur_stand';
      };
      const s = {
        id: uuid(),
        registration_id: body.registration_id,
        venue_id: body.venue_id,
        day_label: body.day_label,
        event_date: body.event_date || (body.day_label === 'vendredi' ? '2026-08-14' : '2026-08-15'),
        start_time: body.start_time || '10:00',
        end_time: body.end_time || '12:00',
        duration_minutes: body.duration_minutes || null,
        title: body.title || 'Animation',
        description: body.description || null,
        slot_type: body.slot_type || 'animation',
        location_type: normLoc(body.location_type),
        status: body.status || 'planifié',
        notes: body.notes || null,
        created_at: new Date(), updated_at: new Date(),
      };
      await db.collection('animation_slots').insertOne(s);
      delete s._id;
      return json(s, 201);
    }

    if (route === 'organization-preferences') {
      const { organization_id, venue_id, preference_rank, replace_all } = body;
      if (replace_all) {
        await db.collection('organization_preferences').deleteMany({ organization_id, edition_id: EDITION_ID });
      }
      const pref = {
        id: uuid(),
        organization_id,
        edition_id: EDITION_ID,
        venue_id,
        preference_rank: preference_rank || 1,
        is_eligible: true,
        source: body.source || 'self_service',
        created_at: new Date(),
      };
      await db.collection('organization_preferences').insertOne(pref);
      delete pref._id;
      return json(pref, 201);
    }

    if (route === 'satisfaction') {
      // Exposant submit/update satisfaction survey (upsert par registration_id)
      // 🆕 Workflow étendu : bilan + RDV restitution caution + validation ARACOM
      const {
        registration_id, nps_score, overall_rating, organization_rating, stand_rating,
        visitors_rating, communication_rating, will_participate_next, positive_points,
        improvement_points, free_comment,
        // 🆕 Soumission finale + RDV restitution caution
        validated_by_exposant,           // boolean — true = bilan finalisé par l'exposant
        caution_return_rdv_proposed,     // ISO date — RDV proposé par l'exposant pour reprendre la caution
        // 🆕 Mode "rempli par ARACOM pour le compte de l'exposant"
        filled_by_aracom,                // boolean
      } = body;
      if (!registration_id) return err('registration_id requis', 400);
      const reg = await db.collection('registrations').findOne({ id: registration_id });
      if (!reg) return err('Inscription introuvable', 404);
      const existing = await db.collection('satisfaction_surveys').findOne({ registration_id, edition_id: EDITION_ID });
      const doc = {
        registration_id, organization_id: reg.organization_id, edition_id: EDITION_ID,
        nps_score: typeof nps_score === 'number' ? nps_score : null,
        overall_rating: typeof overall_rating === 'number' ? overall_rating : null,
        organization_rating: typeof organization_rating === 'number' ? organization_rating : null,
        stand_rating: typeof stand_rating === 'number' ? stand_rating : null,
        visitors_rating: typeof visitors_rating === 'number' ? visitors_rating : null,
        communication_rating: typeof communication_rating === 'number' ? communication_rating : null,
        will_participate_next: will_participate_next || null,
        positive_points: positive_points || null,
        improvement_points: improvement_points || null,
        free_comment: free_comment || null,
        submitted_at: new Date(), updated_at: new Date(),
      };
      // 🆕 Conserve les champs de workflow s'ils sont fournis (sinon on garde existing)
      if (validated_by_exposant === true) {
        doc.validated_by_exposant_at = new Date();
        doc.validation_status = 'pending_aracom_review';
      }
      if (caution_return_rdv_proposed) {
        const d = new Date(caution_return_rdv_proposed);
        if (!isNaN(d.getTime())) {
          doc.caution_return_rdv_proposed = d.toISOString();
          doc.caution_return_status = 'proposed';
        }
      }
      if (filled_by_aracom && ctx.role === 'aracom_admin') {
        doc.filled_by_aracom_at = new Date();
        doc.filled_by_aracom_user = ctx.userId || null;
      }
      if (existing) {
        await db.collection('satisfaction_surveys').updateOne({ id: existing.id }, { $set: doc });
        await logActivity(db, ctx.userId, 'satisfaction_survey', existing.id, 'update', null, null);
        const r = await db.collection('satisfaction_surveys').findOne({ id: existing.id });
        delete r._id;
        return json(r);
      } else {
        const id = uuid();
        const created = { id, ...doc, created_at: new Date() };
        await db.collection('satisfaction_surveys').insertOne(created);
        await logActivity(db, ctx.userId, 'satisfaction_survey', id, 'create', null, null);
        delete created._id;
        return json(created, 201);
      }
    }

    // 🆕 ARACOM valide le bilan + confirme/modifie le RDV restitution caution
    if (route.match(/^satisfaction\/[^/]+\/aracom-validate$/)) {
      if (ctx.role !== 'aracom_admin') return err('Réservé aux admins', 403);
      const surveyId = p[1];
      const { caution_return_rdv_confirmed, validated, validation_comment } = body || {};
      const survey = await db.collection('satisfaction_surveys').findOne({ id: surveyId });
      if (!survey) return err('Bilan introuvable', 404);
      const update = { updated_at: new Date() };
      if (validated === true) {
        update.validation_status = 'validated_by_aracom';
        update.validated_by_aracom_at = new Date();
        update.validated_by_aracom_user = ctx.userId || null;
      }
      if (validation_comment !== undefined) update.validation_comment = validation_comment || null;
      if (caution_return_rdv_confirmed) {
        const d = new Date(caution_return_rdv_confirmed);
        if (!isNaN(d.getTime())) {
          update.caution_return_rdv_confirmed = d.toISOString();
          update.caution_return_status = 'confirmed';
        }
      }
      await db.collection('satisfaction_surveys').updateOne({ id: surveyId }, { $set: update });
      const r = await db.collection('satisfaction_surveys').findOne({ id: surveyId });
      delete r._id;
      return json(r);
    }

    // 🆕 ARACOM marque la caution comme rendue (RDV honoré)
    if (route.match(/^satisfaction\/[^/]+\/mark-caution-returned$/)) {
      if (ctx.role !== 'aracom_admin') return err('Réservé aux admins', 403);
      const surveyId = p[1];
      const survey = await db.collection('satisfaction_surveys').findOne({ id: surveyId });
      if (!survey) return err('Bilan introuvable', 404);
      const update = {
        caution_return_status: 'completed',
        caution_returned_at: new Date(),
        caution_returned_by: ctx.userId || null,
        updated_at: new Date(),
      };
      await db.collection('satisfaction_surveys').updateOne({ id: surveyId }, { $set: update });
      // Optionnel : reflète sur le deposit
      await db.collection('deposits').updateOne(
        { registration_id: survey.registration_id, edition_id: EDITION_ID },
        { $set: { status: 'restituee', returned_at: new Date(), updated_at: new Date() } }
      );
      const r = await db.collection('satisfaction_surveys').findOne({ id: surveyId });
      delete r._id;
      return json(r);
    }


    // ---- Recompute completion % for all registrations (ARACOM tool) ----
    if (route === 'tools/recompute-completion') {
      const regs = await db.collection('registrations').find({ edition_id: EDITION_ID }).toArray();
      const assignments = await db.collection('stand_assignments').find({}).toArray();
      const assignByReg = {};
      assignments.forEach(a => { if (a.status !== 'annule') assignByReg[a.registration_id] = a; });
      let updated = 0;
      for (const r of regs) {
        const pct = computeCompletion(r, !!assignByReg[r.id]);
        if (pct !== r.completion_percent) {
          await db.collection('registrations').updateOne({ id: r.id }, { $set: { completion_percent: pct, updated_at: new Date() } });
          updated++;
        }
      }
      return json({ ok: true, total: regs.length, updated });
    }

    // ---- Auto-generate relance tasks for incomplete dossiers ----
    if (route === 'tools/generate-relances') {
      const regs = await db.collection('registrations').find({ edition_id: EDITION_ID }).toArray();
      const deposits = await db.collection('deposit_transactions').find({}).toArray();
      const depByReg = Object.fromEntries(deposits.map(d => [d.registration_id, d]));
      const existingTasks = await db.collection('tasks_or_followups').find({ status: { $in: ['a_faire', 'en_cours'] } }).toArray();
      const now = new Date();
      const tasks = [];

      for (const r of regs) {
        if (r.status === 'annule' || r.status === 'prospect') continue;
        const d = depByReg[r.id];

        const checks = [
          { cond: !r.is_insurance_uploaded, type: 'document', title: 'Relancer : attestation d\'assurance manquante', priority: 'haute' },
          { cond: d && d.status !== 'recue' && r.is_deposit_required, type: 'caution', title: 'Relancer : caution 20 000 XPF non reçue', priority: 'haute' },
          { cond: !r.is_convention_signed, type: 'validation', title: 'Relancer : convention non signée', priority: 'moyenne' },
          { cond: r.status === 'a_relancer', type: 'appel', title: 'Relance téléphonique exposant', priority: 'moyenne' },
        ];
        for (const c of checks) {
          if (!c.cond) continue;
          // Avoid duplicates — same reg + same title already open
          if (existingTasks.some(t => t.registration_id === r.id && t.title === c.title)) continue;
          const due = new Date(now); due.setDate(due.getDate() + 7);
          tasks.push({
            id: uuid(), registration_id: r.id, task_type: c.type, title: c.title,
            description: `Auto-généré le ${now.toLocaleDateString('fr-FR')}`,
            priority: c.priority, status: 'a_faire',
            due_date: due.toISOString().slice(0, 10),
            auto_generated: true,
            created_at: now, updated_at: now,
          });
        }
      }
      if (tasks.length) await db.collection('tasks_or_followups').insertMany(tasks);
      return json({ ok: true, created: tasks.length });
    }

    // ---- Venue stands CRUD (edit plan) ----
    if (route === 'venue-stands') {
      const { venue_id, stand_code, zone = 'Zone 1', pos_x, pos_y } = body;
      if (!venue_id || !stand_code) return err('venue_id et stand_code requis', 400);
      const exists = await db.collection('venue_stands').findOne({ venue_id, stand_code });
      if (exists) return err('Un stand avec ce code existe déjà sur ce site', 400);
      const venue = await db.collection('venues').findOne({ id: venue_id });
      const stand = {
        id: uuid(), venue_id, stand_code, zone, capacity: 1, is_accessible: true,
        pos_x: typeof pos_x === 'number' ? pos_x : 50,
        pos_y: typeof pos_y === 'number' ? pos_y : 50,
        created_at: new Date(), updated_at: new Date(),
      };
      await db.collection('venue_stands').insertOne(stand);
      if (venue) await db.collection('venues').updateOne({ id: venue_id }, { $set: { capacity_stands: (venue.capacity_stands || 0) + 1 } });
      delete stand._id;
      return json(stand, 201);
    }

    // ---- Mail templates : CREATE ----
    if (route === 'mail-templates') {
      const { name, mail_type, subject, body_html, tone, custom_instruction } = body;
      if (!name?.trim()) return err('Nom du template requis', 400);
      if (!subject || !body_html) return err('subject et body_html requis', 400);
      const id = uuid();
      const tpl = {
        id, name: name.trim(),
        mail_type: mail_type || 'annonce',
        subject, body_html,
        tone: tone || 'professionnel chaleureux',
        custom_instruction: custom_instruction || '',
        created_at: new Date(), updated_at: new Date(),
      };
      await db.collection('mail_templates').insertOne(tpl);
      delete tpl._id;
      return json({ ok: true, template: tpl });
    }
    // ---- Mail recipient lists : CREATE ----
    if (route === 'mail-recipient-lists') {
      const { name, registration_ids } = body;
      if (!name?.trim()) return err('Nom de la liste requis', 400);
      if (!Array.isArray(registration_ids) || registration_ids.length === 0) return err('Au moins 1 destinataire requis', 400);
      const id = uuid();
      const lst = {
        id, name: name.trim(),
        registration_ids,
        count: registration_ids.length,
        created_at: new Date(), updated_at: new Date(),
      };
      await db.collection('mail_recipient_lists').insertOne(lst);
      delete lst._id;
      return json({ ok: true, list: lst });
    }

    // ============ BULK ACTIONS (ARACOM productivity) ============
    if (route === 'registrations/bulk-confirm') {
      const { ids } = body;
      if (!Array.isArray(ids) || ids.length === 0) return err('ids requis', 400);
      let confirmed = 0;
      for (const id of ids) {
        const reg = await db.collection('registrations').findOne({ id });
        if (!reg) continue;
        await db.collection('registrations').updateOne({ id }, { $set: {
          status: 'confirme', is_pre_reserved: false, is_deposit_received: true,
          is_guide_sent: true, // 🆕 guide auto-mis à dispo dès caution payée
          confirmed_at: new Date(), updated_at: new Date(),
        } });
        const dep = await db.collection('deposit_transactions').findOne({ registration_id: id });
        if (dep && dep.status !== 'recue') {
          await db.collection('deposit_transactions').updateOne({ id: dep.id }, { $set: { status: 'recue', received_at: new Date(), updated_at: new Date() } });
        } else if (!dep) {
          await db.collection('deposit_transactions').insertOne({ id: uuid(), registration_id: id, amount_xpf: 20000, status: 'recue', received_at: new Date(), created_at: new Date(), updated_at: new Date() });
        }
        await db.collection('stand_assignments').updateMany({ registration_id: id, status: 'pre_reserve' }, { $set: { status: 'confirme', updated_at: new Date() } });
        // 🆕 AUTO-génération du reçu de caution
        try {
          const existing = await db.collection('registration_documents').findOne({ registration_id: id, document_type: 'recu_caution' });
          if (!existing) {
            const org = await db.collection('organizations').findOne({ id: reg.organization_id });
            const venue = reg.venue_id ? await db.collection('venues').findOne({ id: reg.venue_id }) : null;
            const dep2 = await db.collection('deposit_transactions').findOne({ registration_id: id });
            const receiptNumber = `CAUT-2026-${String(reg.id).slice(0, 6).toUpperCase()}`;
            const paymentLabel = dep2?.deposit_mode === 'especes' ? 'Espèces' : (dep2?.deposit_mode === 'virement' ? 'Virement bancaire' : 'Chèque');
            const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Reçu de caution ${org?.name || ''}</title><style>body{font-family:Helvetica,Arial,sans-serif;max-width:680px;margin:32px auto;color:#1f2937;padding:0 16px}h1{color:#1d4ed8;margin:0 0 4px}.box{border:2px solid #1d4ed8;padding:20px;border-radius:8px;margin:20px 0}.row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px dashed #e5e7eb}.label{color:#64748b}.amount{font-size:28px;color:#1d4ed8;font-weight:800}.print-btn{position:fixed;top:20px;right:20px;padding:10px 20px;border-radius:6px;background:#1d4ed8;color:#fff;border:0;cursor:pointer;font-weight:600}@media print{.print-btn{display:none}}</style></head><body><button class="print-btn" onclick="window.print()">🖨️ Imprimer / PDF</button><div style="display:flex;justify-content:space-between;align-items:start;border-bottom:3px solid #1d4ed8;padding-bottom:10px"><div><h1>REÇU DE CAUTION</h1><p style="margin:0;color:#64748b">Forum de la Rentrée 2026 · 14 & 15 août 2026</p></div><div style="text-align:right"><div style="background:#1d4ed8;color:#fff;font-weight:700;padding:6px 12px;border-radius:6px;display:inline-block;letter-spacing:.05em">ARACOM</div><div style="font-size:11px;color:#64748b;margin-top:6px">Émis le ${new Date().toLocaleDateString('fr-FR')}</div></div></div><div class="box"><div class="row"><span class="label">N° de reçu</span><b>${receiptNumber}</b></div><div class="row"><span class="label">Date d'émission</span><b>${new Date().toLocaleDateString('fr-FR')}</b></div><div class="row"><span class="label">Exposant</span><b>${org?.name || '—'}</b></div><div class="row"><span class="label">Site / Stand</span><span>${venue?.name || '—'} / ${reg.stand_code || '—'}</span></div><div class="row"><span class="label">Mode de paiement</span><b>${paymentLabel}</b></div></div><div style="text-align:center;padding:18px 0;background:#eff6ff;border-radius:8px"><div class="label">Montant reçu en garantie</div><div class="amount">20 000 XPF</div></div></body></html>`;
            await db.collection('registration_documents').insertOne({
              id: uuid(), registration_id: id, document_type: 'recu_caution',
              file_name: `Recu_caution_${(org?.name || 'exp').replace(/\s+/g, '_')}_${receiptNumber}.html`,
              mime_type: 'text/html', file_size: html.length,
              file_data: Buffer.from(html, 'utf-8').toString('base64'),
              status: 'valide', uploaded_by: 'aracom-auto',
              uploaded_at: new Date(), validated_at: new Date(),
              receipt_number: receiptNumber,
              created_at: new Date(), updated_at: new Date(),
            });
          }
        } catch (rcptErr) { console.error('[bulk-confirm auto-recu]', rcptErr?.message); }
        confirmed++;
      }
      return json({ ok: true, confirmed });
    }
    if (route === 'registrations/bulk-generate-receipts') {
      const { ids } = body;
      if (!Array.isArray(ids) || ids.length === 0) return err('ids requis', 400);
      let generated = 0;
      for (const id of ids) {
        const reg = await db.collection('registrations').findOne({ id });
        if (!reg) continue;
        const org = await db.collection('organizations').findOne({ id: reg.organization_id });
        const dep = await db.collection('deposit_transactions').findOne({ registration_id: id });
        const venue = await db.collection('venues').findOne({ id: reg.venue_id });
        const receiptNumber = `CAUT-2026-${String(reg.id).slice(0, 6).toUpperCase()}`;
        // Skip if already has a recu_caution
        const existing = await db.collection('registration_documents').findOne({ registration_id: id, document_type: 'recu_caution' });
        if (existing) continue;
        const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Reçu de caution ${org?.name || ''}</title><style>body{font-family:Helvetica,Arial,sans-serif;max-width:680px;margin:32px auto;color:#1f2937}h1{color:#1d4ed8}.box{border:2px solid #1d4ed8;padding:20px;border-radius:8px;margin:20px 0}.row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px dashed #e5e7eb}.label{color:#64748b}.amount{font-size:28px;color:#1d4ed8;font-weight:800}</style></head><body><h1>REÇU DE CAUTION</h1><p><b>Forum de la Rentrée 2026</b> · 14 & 15 août 2026<br>Organisé par <b>ARACOM</b></p><div class="box"><div class="row"><span class="label">N° de reçu</span><b>${receiptNumber}</b></div><div class="row"><span class="label">Date</span><b>${new Date().toLocaleDateString('fr-FR')}</b></div><div class="row"><span class="label">Exposant</span><b>${org?.name || '—'}</b></div><div class="row"><span class="label">Site / Stand</span><span>${venue?.name || '—'} / ${reg.stand_code || '—'}</span></div></div><div style="text-align:center;padding:18px 0"><div class="label">Montant</div><div class="amount">20 000 XPF</div></div></body></html>`;
        await db.collection('registration_documents').insertOne({
          id: uuid(), registration_id: id, document_type: 'recu_caution',
          file_name: `Recu_caution_${(org?.name || 'exp').replace(/\s+/g,'_')}_${receiptNumber}.html`,
          mime_type: 'text/html', file_size: html.length,
          file_data: Buffer.from(html, 'utf-8').toString('base64'),
          status: 'valide', uploaded_by: 'aracom',
          uploaded_at: new Date(), validated_at: new Date(),
          receipt_number: receiptNumber,
          created_at: new Date(), updated_at: new Date(),
        });
        generated++;
      }
      return json({ ok: true, generated });
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 📦 ADMIN — Export groupé de documents (Conventions + Reçus de caution)
    //    Body : { type: 'conventions'|'receipts'|'all',
    //             site_ids?: string[]|['all'],
    //             registration_ids?: string[]|['all'] }
    //    Retour : Fichier ZIP (application/zip) avec PDFs nommés clairement
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (route === 'admin/export-documents') {
      const type = (body.type || 'all').toLowerCase();
      if (!['conventions', 'receipts', 'all'].includes(type)) {
        return err("type doit être 'conventions', 'receipts' ou 'all'", 400);
      }
      const siteIds = Array.isArray(body.site_ids) ? body.site_ids : ['all'];
      const regIds = Array.isArray(body.registration_ids) ? body.registration_ids : ['all'];
      const wantAllSites = siteIds.includes('all') || siteIds.length === 0;
      const wantAllRegs = regIds.includes('all') || regIds.length === 0;

      // Build registrations filter
      const regFilter = {};
      if (!wantAllRegs) regFilter.id = { $in: regIds };
      if (!wantAllSites) regFilter.venue_id = { $in: siteIds };

      const registrations = await db.collection('registrations').find(regFilter).toArray();
      if (registrations.length === 0) {
        return err("Aucun exposant ne correspond aux filtres sélectionnés.", 404);
      }

      // Preload organizations and venues for performance
      const orgIds = [...new Set(registrations.map(r => r.organization_id).filter(Boolean))];
      const venueIdsAll = [...new Set(registrations.map(r => r.venue_id).filter(Boolean))];
      const [orgs, venues] = await Promise.all([
        db.collection('organizations').find({ id: { $in: orgIds } }).toArray(),
        db.collection('venues').find({ id: { $in: venueIdsAll } }).toArray(),
      ]);
      const orgById = Object.fromEntries(orgs.map(o => [o.id, o]));
      const venueById = Object.fromEntries(venues.map(v => [v.id, v]));

      // Preload deposits & animations
      const allRegIds = registrations.map(r => r.id);
      const [deposits, animations] = await Promise.all([
        db.collection('deposit_transactions').find({ registration_id: { $in: allRegIds } }).toArray(),
        db.collection('animation_slots').find({ registration_id: { $in: allRegIds }, status: { $ne: 'annulé' } }).toArray(),
      ]);
      const depByReg = Object.fromEntries(deposits.map(d => [d.registration_id, d]));
      const animByReg = animations.reduce((acc, a) => {
        (acc[a.registration_id] = acc[a.registration_id] || []).push(a); return acc;
      }, {});

      const { generateConventionPDF, generateReceiptPDF } = await import('@/lib/document-generator');
      const zip = new JSZip();
      const safeName = (s) => String(s || 'exposant').replace(/[^a-z0-9_-]/gi, '_').replace(/_+/g, '_').slice(0, 60);

      let conventionsCount = 0;
      let receiptsCount = 0;
      const errors = [];

      for (const reg of registrations) {
        const org = orgById[reg.organization_id] || null;
        const venue = venueById[reg.venue_id] || null;
        const dep = depByReg[reg.id] || null;
        const anims = animByReg[reg.id] || [];

        const expName = safeName(org?.name);
        const siteName = safeName(venue?.name || 'sans-site');
        const stand = safeName(reg?.stand_code || 'sans-stand');
        const baseFolder = `${siteName}/${expName}_${stand}`;

        if (type === 'conventions' || type === 'all') {
          try {
            const pdf = await generateConventionPDF({ registration: reg, organization: org, venue, animations: anims });
            zip.file(`Conventions/${baseFolder}/Convention_${expName}_${stand}.pdf`, pdf);
            conventionsCount++;
          } catch (e) {
            errors.push(`Convention ${org?.name || reg.id} : ${e.message}`);
          }
        }
        if (type === 'receipts' || type === 'all') {
          try {
            const pdf = await generateReceiptPDF({ registration: reg, organization: org, venue, deposit: dep });
            zip.file(`Recus_Caution/${baseFolder}/Recu_Caution_${expName}_${stand}.pdf`, pdf);
            receiptsCount++;
          } catch (e) {
            errors.push(`Reçu ${org?.name || reg.id} : ${e.message}`);
          }
        }
      }

      // Manifest README inside the ZIP for traceability
      const manifest = [
        `Export Forum de la Rentrée 2026 — ARACOM`,
        `Généré le : ${new Date().toLocaleString('fr-FR')}`,
        `Type demandé : ${type}`,
        `Filtre sites : ${wantAllSites ? 'TOUS' : siteIds.join(', ')}`,
        `Filtre exposants : ${wantAllRegs ? 'TOUS' : `${regIds.length} sélectionnés`}`,
        `Conventions générées : ${conventionsCount}`,
        `Reçus de caution générés : ${receiptsCount}`,
        errors.length ? `\nErreurs (${errors.length}) :\n - ${errors.join('\n - ')}` : '',
      ].join('\n');
      zip.file('README.txt', manifest);

      const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } });
      const ts = new Date().toISOString().slice(0, 10);
      const fname = `Export_${type === 'all' ? 'Documents' : (type === 'conventions' ? 'Conventions' : 'Recus_Caution')}_${ts}.zip`;
      return new NextResponse(buf, {
        status: 200,
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="${fname}"`,
          'Cache-Control': 'no-cache',
          'X-Documents-Conventions': String(conventionsCount),
          'X-Documents-Receipts': String(receiptsCount),
        },
      });
    }

    if (route === 'deposits/bulk-update-status') {
      const { ids, status } = body;
      if (!Array.isArray(ids) || !status) return err('ids et status requis', 400);
      const r = await db.collection('deposit_transactions').updateMany(
        { id: { $in: ids } },
        { $set: { status, ...(status === 'recue' ? { received_at: new Date() } : {}), updated_at: new Date() } }
      );
      return json({ ok: true, modified: r.modifiedCount });
    }
    if (route === 'anomalies/bulk-resolve') {
      const { ids, comment = 'Résolu en masse' } = body;
      if (!Array.isArray(ids) || ids.length === 0) return err('ids requis', 400);
      const r = await db.collection('registration_anomalies').updateMany(
        { id: { $in: ids } },
        { $set: { resolved_status: 'resolu', resolution_comment: comment, resolved_at: new Date(), updated_at: new Date() } }
      );
      return json({ ok: true, modified: r.modifiedCount });
    }

    // ============ SCHEDULED MAILING ============
    if (route === 'mailing/schedule') {
      const { subject, body_html, registration_ids, mail_type, scheduled_at } = body;
      if (!subject || !body_html) return err('subject et body_html requis', 400);
      if (!Array.isArray(registration_ids) || registration_ids.length === 0) return err('registration_ids requis', 400);
      if (!scheduled_at) return err('scheduled_at requis (ISO date)', 400);
      const when = new Date(scheduled_at);
      if (isNaN(when.getTime()) || when.getTime() < Date.now() - 5 * 60 * 1000) return err('Date programmée invalide ou passée', 400);
      const campaignId = uuid();
      await db.collection('email_campaigns').insertOne({
        id: campaignId, edition_id: EDITION_ID,
        name: `Programmé — ${mail_type || 'custom'} — ${when.toISOString().slice(0, 16)}`,
        template: mail_type || 'ai_custom',
        status: 'programmee',
        scheduled_at: when,
        scheduled_payload: { subject, body_html, registration_ids, mail_type },
        target_filter: { registration_ids },
        sent_count: 0, opened_count: 0, clicked_count: 0,
        created_at: new Date(), updated_at: new Date(),
      });
      return json({ ok: true, campaign_id: campaignId, scheduled_at: when });
    }
    if (route === 'mailing/process-scheduled') {
      // Process all scheduled campaigns whose time has come
      const now = new Date();
      const due = await db.collection('email_campaigns').find({ status: 'programmee', scheduled_at: { $lte: now } }).toArray();
      let totalSent = 0, totalFailed = 0, processed = 0;
      for (const camp of due) {
        const payload = camp.scheduled_payload || {};
        const regs = await db.collection('registrations').find({ id: { $in: payload.registration_ids || [] } }).toArray();
        const orgs = await db.collection('organizations').find({ id: { $in: regs.map(r => r.organization_id) } }).toArray();
        const venues = await db.collection('venues').find({ id: { $in: regs.map(r => r.venue_id).filter(Boolean) } }).toArray();
        const orgById = Object.fromEntries(orgs.map(o => [o.id, o]));
        const venueById = Object.fromEntries(venues.map(v => [v.id, v]));
        const smtpReady = isSmtpConfigured();
        let sent = 0, failed = 0;
        for (const r of regs) {
          const o = orgById[r.organization_id]; const v = venueById[r.venue_id];
          if (!o?.main_email) continue;
          const personSub = (payload.subject || '').replaceAll('[[NOM_EXPOSANT]]', o.name || '').replaceAll('[[STAND]]', r.stand_code || '').replaceAll('[[SITE]]', v?.name || '').replaceAll('[[CONTACT_NAME]]', o.contact_name || '').replaceAll('[[DISCIPLINE]]', o.discipline || '');
          const personBody = (payload.body_html || '').replaceAll('[[NOM_EXPOSANT]]', o.name || '').replaceAll('[[STAND]]', r.stand_code || '').replaceAll('[[SITE]]', v?.name || '').replaceAll('[[CONTACT_NAME]]', o.contact_name || '').replaceAll('[[DISCIPLINE]]', o.discipline || '');
          const messageId = uuid();
          const trackedBody = injectTracking(personBody, messageId);
          let sendStatus = 'envoye', errorMsg = null;
          if (smtpReady) {
            const r2 = await sendMailAuto({ to: o.main_email, subject: personSub, html: trackedBody }, db);
            if (!r2.ok) { sendStatus = 'echec'; errorMsg = r2.error; failed++; }
          }
          await db.collection('email_messages').insertOne({
            id: messageId, campaign_id: camp.id, registration_id: r.id,
            to_email: o.main_email, subject: personSub, body_html: trackedBody,
            send_status: sendStatus, sent_at: new Date(),
            opened_at: null, clicked_at: null, response_status: 'attente',
            provider_message_id: smtpReady ? messageId : `mock_${messageId}`,
            error_message: errorMsg,
            created_at: new Date(), updated_at: new Date(),
          });
          if (sendStatus === 'envoye') sent++;
        }
        await db.collection('email_campaigns').updateOne({ id: camp.id }, { $set: { status: 'envoyee', sent_count: sent, failed_count: failed, processed_at: new Date(), updated_at: new Date() } });
        totalSent += sent; totalFailed += failed; processed++;
      }
      return json({ ok: true, processed, sent: totalSent, failed: totalFailed });
    }

    if (route === 'tools/sync-exposants-history') {
      // Synchronise l'historique de participation sur les organizations existantes
      // (matching par nom normalisé). Source: /app/lib/exposants-history.json
      const fs = await import('fs/promises');
      const path = await import('path');
      const filePath = path.default.join(process.cwd(), 'lib', 'exposants-history.json');
      let history = [];
      try {
        history = JSON.parse(await fs.default.readFile(filePath, 'utf-8'));
      } catch (e) {
        return err('Fichier exposants-history.json introuvable', 500);
      }
      const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
      const orgs = await db.collection('organizations').find({}).toArray();
      let matched = 0, unmatched = [];
      for (const h of history) {
        const target = norm(h.name);
        // Try exact normalized match first, then includes match
        const found = orgs.find(o => norm(o.name) === target) ||
          orgs.find(o => target.length > 4 && norm(o.name).includes(target.slice(0, 12))) ||
          orgs.find(o => target.length > 6 && target.includes(norm(o.name).slice(0, 10)));
        if (!found) { unmatched.push(h.name); continue; }
        await db.collection('organizations').updateOne({ id: found.id }, { $set: {
          participation_history: {
            y2019: h.y2019, y2020: h.y2020, y2023: h.y2023, y2024: h.y2024, y2025: h.y2025,
            nb_editions: h.nb_editions || 0,
            fidelity: h.fidelity || 'Inconnu',
            site_principal: h.site_principal,
          },
          updated_at: new Date(),
        } });
        matched++;
      }
      return json({ ok: true, total_history_entries: history.length, matched, unmatched_count: unmatched.length, unmatched_sample: unmatched.slice(0, 10) });
    }

    if (route === 'tools/import-exposants-from-excel') {
      // Crée de NOUVELLES organizations + registrations à partir de l'Excel pour les exposants non encore présents.
      // Useful pour pré-charger la base réelle de 102 exposants.
      const fs = await import('fs/promises');
      const path = await import('path');
      const filePath = path.default.join(process.cwd(), 'lib', 'exposants-history.json');
      let history = [];
      try {
        history = JSON.parse(await fs.default.readFile(filePath, 'utf-8'));
      } catch (e) {
        return err('Fichier exposants-history.json introuvable', 500);
      }
      const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
      const venues = await db.collection('venues').find({ edition_id: EDITION_ID }).toArray();
      const venueByName = {}; venues.forEach(v => { venueByName[norm(v.name)] = v; });
      const existing = await db.collection('organizations').find({}).toArray();
      const existingNames = new Set(existing.map(o => norm(o.name)));
      let created = 0; let skipped = 0;
      for (const h of history) {
        const k = norm(h.name);
        if (existingNames.has(k)) { skipped++; continue; }
        const venue = venueByName[norm(h.site_principal)] || null;
        const orgId = uuid();
        await db.collection('organizations').insertOne({
          id: orgId, name: h.name, discipline: h.discipline || 'Autre',
          contact_name: '', main_email: `${k.replace(/\s+/g, '.').slice(0, 30)}@aracom-import.local`,
          main_phone: '', description: '',
          participation_history: {
            y2019: h.y2019, y2020: h.y2020, y2023: h.y2023, y2024: h.y2024, y2025: h.y2025,
            nb_editions: h.nb_editions || 0,
            fidelity: h.fidelity || 'Inconnu',
            site_principal: h.site_principal,
          },
          created_at: new Date(), updated_at: new Date(),
        });
        await db.collection('registrations').insertOne({
          id: uuid(), edition_id: EDITION_ID,
          organization_id: orgId,
          venue_id: venue?.id || null,
          stand_code: null, status: 'prospect',
          completion_percent: 0,
          is_convention_signed: false, is_insurance_uploaded: false, is_deposit_received: false,
          planned_arrival_time: '09:00', planned_departure_time: '17:00',
          friday_slot_label: null, saturday_slot_label: null,
          created_at: new Date(), updated_at: new Date(),
        });
        created++;
      }
      return json({ ok: true, total_in_excel: history.length, created, skipped_existing: skipped });
    }

    // ============ PUSH NOTIFICATIONS ============
    if (route === 'push/subscribe') {
      const userId = request.headers.get('x-user-id');
      const role = request.headers.get('x-user-role');
      if (!userId) return err('Authentification requise', 401);
      const { subscription, user_agent } = body;
      if (!subscription?.endpoint) return err('subscription.endpoint requis', 400);
      try {
        await savePushSubscription({ userId, role, subscription, userAgent: user_agent || request.headers.get('user-agent') || '' });
        return json({ ok: true });
      } catch (e) {
        return err(e.message || 'Erreur sauvegarde subscription', 500);
      }
    }
    if (route === 'push/unsubscribe') {
      const userId = request.headers.get('x-user-id');
      const { endpoint } = body;
      if (!userId || !endpoint) return err('userId et endpoint requis', 400);
      await deletePushSubscription({ userId, endpoint });
      return json({ ok: true });
    }
    if (route === 'push/test') {
      // Send a test push to all aracom_admin subs
      const r = await pushToRole({
        title: '🔔 Test ARACOM',
        body: 'Si vous voyez cette notification, le push web fonctionne !',
        url: `${getPublicBaseUrl(request)}/aracom?tab=validations`,
        tag: 'aracom-test',
      }, { role: 'aracom_admin' });
      return json(r);
    }

    // ARACOM toggle availability of a venue for current edition
    if (route.match(/^venues\/[^/]+\/set-availability$/)) {
      const id = p[1];
      const { is_available_2026 } = body;
      const newVal = Boolean(is_available_2026);
      // 🆕 Synchronisation : si on active globalement le site, on active aussi Pacific et Exposants
      //                     si on désactive, le filtrage par is_available_2026 masque le site partout (Pacific + Exposants)
      const upd = { is_available_2026: newVal, updated_at: new Date() };
      if (newVal) {
        upd.pacific_visible = true;
        upd.exposant_visible = true;
      }
      await db.collection('venues').updateOne({ id }, { $set: upd });
      return json({ ok: true, is_available_2026: newVal, synced: newVal });
    }

    // 🆕 Toggle visibility côté Pacific Centers (admin only)
    if (route.match(/^venues\/[^/]+\/set-pacific-visible$/)) {
      if (ctx.role !== 'aracom_admin') return err('Réservé aux admins', 403);
      const id = p[1];
      const { pacific_visible } = body;
      await db.collection('venues').updateOne({ id }, { $set: { pacific_visible: Boolean(pacific_visible), updated_at: new Date() } });
      return json({ ok: true, pacific_visible: Boolean(pacific_visible) });
    }

    // 🆕 Toggle visibility côté Exposants (admin only) — Mahina/Moorea masqués par défaut
    if (route.match(/^venues\/[^/]+\/set-exposant-visible$/)) {
      if (ctx.role !== 'aracom_admin') return err('Réservé aux admins', 403);
      const id = p[1];
      const { exposant_visible } = body;
      await db.collection('venues').updateOne({ id }, { $set: { exposant_visible: Boolean(exposant_visible), updated_at: new Date() } });
      return json({ ok: true, exposant_visible: Boolean(exposant_visible) });
    }

    // 🆕 Configuration du référent ARACOM sur place (admin only)
    if (route.match(/^venues\/[^/]+\/set-referent$/)) {
      if (ctx.role !== 'aracom_admin') return err('Réservé aux admins', 403);
      const id = p[1];
      const { name, email, phone } = body || {};
      const referent = {
        name: (name || '').trim() || null,
        email: (email || '').trim() || null,
        phone: (phone || '').trim() || null,
      };
      await db.collection('venues').updateOne({ id }, { $set: { referent_aracom: referent, updated_at: new Date() } });
      return json({ ok: true, referent });
    }

    // ============================================================
    // 🆕 CONFIG ARACOM — RIB + Templates documents officiels (admin only)
    // ============================================================
    // POST /api/admin/rib-config — sauvegarde du RIB ARACOM (champs structurés)
    if (route === 'admin/rib-config') {
      if (ctx.role !== 'aracom_admin') return err('Réservé aux admins', 403);
      const rib = {
        titulaire: (body?.titulaire || '').trim(),
        banque: (body?.banque || '').trim(),
        iban: (body?.iban || '').trim().replace(/\s+/g, ' ').toUpperCase(),
        bic: (body?.bic || '').trim().toUpperCase(),
        reference: (body?.reference || 'Caution Forum 2026 + nom exposant').trim(),
        updated_at: new Date(),
      };
      await db.collection('app_settings').updateOne(
        { key: 'rib_config' },
        { $set: { key: 'rib_config', value: rib, updated_at: new Date() } },
        { upsert: true }
      );
      return json({ ok: true, rib });
    }

    // 🆕 POST /api/admin/exposant-limits — limite max de sites par exposant
    if (route === 'admin/exposant-limits') {
      if (ctx.role !== 'aracom_admin') return err('Réservé aux admins', 403);
      const raw = body?.max_sites_per_exposant;
      const parsed = parseInt(raw, 10);
      const max = Number.isFinite(parsed) ? parsed : 3;
      const clamped = Math.max(1, Math.min(6, max));
      await db.collection('app_settings').updateOne(
        { key: 'exposant_limits' },
        { $set: { key: 'exposant_limits', value: { max_sites_per_exposant: clamped }, updated_at: new Date() } },
        { upsert: true }
      );
      return json({ ok: true, max_sites_per_exposant: clamped });
    }

    // 🆕 POST /api/exposant/sites/add — ajoute une nouvelle registration (= un site supplémentaire) sur la même organisation
    if (route === 'exposant/sites/add') {
      const orgId = body?.organization_id || ctx.organization_id;
      const venueId = body?.venue_id;
      if (!orgId || !venueId) return err('organization_id et venue_id requis', 400);
      // Vérifie la limite max sites
      const limCfg = await db.collection('app_settings').findOne({ key: 'exposant_limits' });
      const maxSites = limCfg?.value?.max_sites_per_exposant || 3;
      const existing = await db.collection('registrations').find({ organization_id: orgId, edition_id: EDITION_ID }).toArray();
      if (existing.length >= maxSites) {
        return err(`Limite atteinte : maximum ${maxSites} site(s) par exposant.`, 400);
      }
      // Vérifie qu'il n'a pas déjà ce site
      if (existing.some(r => r.venue_id === venueId)) {
        return err('Vous êtes déjà inscrit(e) sur ce site. 1 stand max par site.', 400);
      }
      // Vérifie que le site est ouvert aux exposants
      const venue = await db.collection('venues').findOne({ id: venueId });
      if (!venue) return err('Site introuvable', 404);
      if (venue.is_available_2026 === false || venue.exposant_visible === false) {
        return err('Ce site n\'est pas ouvert aux inscriptions exposants.', 400);
      }
      // Crée la registration avec priority = next available
      const nextPriority = (Math.max(0, ...existing.map(r => r.site_priority || 1)) + 1);
      const newReg = {
        id: uuid(),
        edition_id: EDITION_ID,
        organization_id: orgId,
        venue_id: venueId,
        stand_code: null,
        status: 'a_confirmer',
        is_pre_reserved: false,
        is_deposit_received: false,
        is_locked: false,
        is_convention_signed: false,
        is_insurance_uploaded: false,
        is_guide_sent: false,
        completion_percent: 10,
        site_priority: nextPriority,
        friday_slot_label: null,
        saturday_slot_label: null,
        exposant_notes: '',
        created_at: new Date(),
        updated_at: new Date(),
      };
      await db.collection('registrations').insertOne(newReg);
      delete newReg._id;
      return json({ ok: true, registration: newReg });
    }

    // 🆕 DELETE/POST /api/exposant/sites/:regId/remove — retire un site (registration) si pas locked
    if (route.match(/^exposant\/sites\/[^/]+\/remove$/)) {
      const regId = p[2];
      const reg = await db.collection('registrations').findOne({ id: regId });
      if (!reg) return err('Inscription introuvable', 404);
      if (reg.is_locked) return err('Impossible de retirer ce site : la caution a déjà été reçue par ARACOM.', 400);
      if (reg.is_deposit_received) return err('Impossible de retirer ce site : caution déjà encaissée.', 400);
      // Vérifier qu'il restera au moins 1 site
      const orgId = reg.organization_id;
      const otherRegs = await db.collection('registrations').countDocuments({ organization_id: orgId, edition_id: EDITION_ID, id: { $ne: regId } });
      if (otherRegs === 0) return err('Vous devez conserver au moins 1 site.', 400);
      // Suppression cascade : registration + animation_slots + stand_assignments + deposit (en attente)
      await db.collection('animation_slots').deleteMany({ registration_id: regId });
      await db.collection('stand_assignments').deleteMany({ registration_id: regId });
      await db.collection('deposit_transactions').deleteMany({ registration_id: regId, status: { $ne: 'recue' } });
      await db.collection('registrations').deleteOne({ id: regId });
      return json({ ok: true });
    }

    // 🆕 POST /api/exposant/sites/:regId/priority — changer la priorité d'un site (1 = principal)
    if (route.match(/^exposant\/sites\/[^/]+\/priority$/)) {
      const regId = p[2];
      const reg = await db.collection('registrations').findOne({ id: regId });
      if (!reg) return err('Inscription introuvable', 404);
      const newPriority = parseInt(body?.priority, 10) || 1;
      // Décale les autres registrations de la même organisation si conflit
      const others = await db.collection('registrations').find({ organization_id: reg.organization_id, edition_id: EDITION_ID, id: { $ne: regId } }).toArray();
      const conflicting = others.find(r => (r.site_priority || 1) === newPriority);
      if (conflicting) {
        // Swap priorities
        await db.collection('registrations').updateOne({ id: conflicting.id }, { $set: { site_priority: reg.site_priority || 1, updated_at: new Date() } });
      }
      await db.collection('registrations').updateOne({ id: regId }, { $set: { site_priority: newPriority, updated_at: new Date() } });
      return json({ ok: true, priority: newPriority });
    }

    // POST /api/admin/document-templates — sauvegarde d'un template (textes + logo)
    // body : { key: 'convention'|'guide'|'recu'|'attestation_remboursement', texts: {...}, logo_base64?: '...' }
    if (route === 'admin/document-templates') {
      if (ctx.role !== 'aracom_admin') return err('Réservé aux admins', 403);
      const { key: tplKey, texts, logo_base64 } = body || {};
      const validKeys = ['convention', 'guide', 'recu', 'attestation_remboursement'];
      if (!validKeys.includes(tplKey)) return err('Template inconnu', 400);
      const upd = { updated_at: new Date() };
      if (texts && typeof texts === 'object') upd.texts = texts;
      if (typeof logo_base64 === 'string') upd.logo_base64 = logo_base64; // empty = reset
      await db.collection('app_settings').updateOne(
        { key: `doc_template_${tplKey}` },
        { $set: { key: `doc_template_${tplKey}`, ...upd } },
        { upsert: true }
      );
      return json({ ok: true });
    }

    // POST /api/admin/refund-attestation/:regId/upload — ARACOM upload version signée
    if (route.match(/^admin\/refund-attestation\/[^/]+\/upload$/)) {
      if (ctx.role !== 'aracom_admin') return err('Réservé aux admins', 403);
      const regId = p[2];
      const { file_name, mime_type, file_base64 } = body || {};
      if (!file_base64) return err('file_base64 requis', 400);
      // Désactive l'ancienne attestation auto si présente
      await db.collection('registration_documents').updateMany(
        { registration_id: regId, document_type: 'attestation_remboursement' },
        { $set: { status: 'remplace', updated_at: new Date() } }
      );
      const fileBuf = Buffer.from(file_base64, 'base64');
      await db.collection('registration_documents').insertOne({
        id: uuid(),
        registration_id: regId,
        document_type: 'attestation_remboursement',
        file_name: file_name || `Attestation_remboursement_signee.pdf`,
        mime_type: mime_type || 'application/pdf',
        file_size: fileBuf.length,
        file_data: file_base64,
        status: 'valide',
        is_signed: true,
        uploaded_by: 'aracom',
        uploaded_at: new Date(),
        validated_at: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
      });
      return json({ ok: true });
    }

    // 🆕 POST /api/admin/refund-attestation/:regId/generate — ARACOM (re)génère l'attestation auto
    //   (force la création même si le questionnaire n'a pas été rempli)
    if (route.match(/^admin\/refund-attestation\/[^/]+\/generate$/)) {
      if (ctx.role !== 'aracom_admin') return err('Réservé aux admins', 403);
      const regId = p[2];
      const reg = await db.collection('registrations').findOne({ id: regId });
      if (!reg) return err('Inscription introuvable', 404);
      const org = await db.collection('organizations').findOne({ id: reg.organization_id });
      const venue = reg.venue_id ? await db.collection('venues').findOne({ id: reg.venue_id }) : null;
      const dep = await db.collection('deposit_transactions').findOne({ registration_id: regId });
      const today = new Date().toLocaleDateString('fr-FR');
      const num = `ATT-2026-${String(regId).slice(0, 6).toUpperCase()}`;
      // Désactive les anciennes attestations auto non signées
      await db.collection('registration_documents').updateMany(
        { registration_id: regId, document_type: 'attestation_remboursement', is_signed: { $ne: true } },
        { $set: { status: 'remplace', updated_at: new Date() } }
      );
      const html = buildRefundAttestationHTML({ org, venue, reg, dep, num, today });
      const docId = uuid();
      await db.collection('registration_documents').insertOne({
        id: docId,
        registration_id: regId,
        document_type: 'attestation_remboursement',
        file_name: `Attestation_remboursement_${(org?.name || 'exp').replace(/\s+/g, '_')}_${num}.html`,
        mime_type: 'text/html',
        file_size: html.length,
        file_data: Buffer.from(html, 'utf-8').toString('base64'),
        status: 'valide',
        is_signed: false,
        attestation_number: num,
        uploaded_by: 'aracom-manual',
        uploaded_at: new Date(),
        validated_at: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
      });
      return json({ ok: true, document_id: docId, attestation_number: num });
    }

    // One-time migration : set is_available_2026 + disable exposant/pacific passwords
    if (route === 'tools/migrate-2026') {
      // 1) Set is_available_2026 on venues based on name
      const allVenues = await db.collection('venues').find({}).toArray();
      let updatedVenues = 0;
      for (const v of allVenues) {
        if (v.is_available_2026 !== undefined) continue; // already set
        const offSites = ['Mahina', 'Moorea'];
        const isOff = offSites.some(n => v.name?.toLowerCase().includes(n.toLowerCase()));
        await db.collection('venues').updateOne({ id: v.id }, { $set: { is_available_2026: !isOff, updated_at: new Date() } });
        updatedVenues++;
      }
      // 2) Disable password login for non-admin users
      const r = await db.collection('users').updateMany(
        { role_code: { $ne: 'aracom_admin' } },
        { $set: { password: '__disabled_use_access_token__', updated_at: new Date() } }
      );
      return json({ ok: true, venues_updated: updatedVenues, users_password_disabled: r.modifiedCount });
    }

    // ============ IMPORT EXPOSANTS EXCEL ============
    // POST /api/import/exposants-excel
    // Body: multipart/form-data with "file" = .xlsx file
    // Parses the first sheet, auto-detects columns, updates/creates organizations with:
    //   - Contact info (email, phone, contact_name)
    //   - participation_history (years + fidelity + nb_editions)
    //   - aracom_private (convention_history, caution_history, animation_history, admin_remarks) [ADMIN ONLY]
    // New rows without existing match are created with status='prospect' (not linked to a registration).
    if (route === 'import/exposants-excel') {
      if (ctx.role !== 'aracom_admin') return err('Accès admin requis', 403);
      try {
        const formData = await request.formData();
        const file = formData.get('file');
        if (!file) return err('Fichier manquant', 400);
        const buffer = Buffer.from(await file.arrayBuffer());
        const wb = XLSX.read(buffer, { type: 'buffer' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rowsRaw = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });

        // Clean helper: treat placeholder dashes/em-dashes as empty
        const cleanVal = (v) => {
          const s = String(v || '').trim();
          if (!s) return '';
          if (['-', '–', '—', 'n/a', 'N/A', '?'].includes(s)) return '';
          return s;
        };

        const asBool = (v) => {
          if (v === true || v === 'true') return true;
          const s = String(v || '').trim();
          return s === '✓' || s === '1' || s === 'oui' || s === 'Oui' || s === 'OUI' || s === 'x' || s === 'X' || s === 'yes';
        };
        const pick = (r, ...keys) => {
          for (const k of keys) {
            for (const rk of Object.keys(r)) {
              if (rk.toLowerCase().replace(/[^a-z0-9]/g, '').includes(k.toLowerCase().replace(/[^a-z0-9]/g, ''))) {
                const v = cleanVal(r[rk]);
                if (v) return v;
              }
            }
          }
          return '';
        };
        const pickBool = (r, ...keys) => {
          for (const k of keys) {
            for (const rk of Object.keys(r)) {
              if (rk.toLowerCase().replace(/[^a-z0-9]/g, '').includes(k.toLowerCase().replace(/[^a-z0-9]/g, ''))) {
                if (r[rk] !== '' && r[rk] !== undefined) return asBool(r[rk]);
              }
            }
          }
          return false;
        };

        // Normalize name for matching — keep words with length >= 4 (so short noise words get removed)
        const norm = (s) => String(s || '').toLowerCase()
          .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
          .replace(/\(.*?\)/g, ' ')
          .replace(/\b(19|20)\d{2}\b/g, ' ')
          .replace(/[^a-z0-9]+/g, ' ')
          .trim().split(/\s+/).filter(w => w.length >= 3).join(' ');

        const orgs = await db.collection('organizations').find({}).toArray();
        const orgByNorm = new Map();
        orgs.forEach(o => {
          const n = norm(o.name);
          if (!orgByNorm.has(n)) orgByNorm.set(n, []);
          orgByNorm.get(n).push(o);
        });
        // Fuzzy matcher — stricter than before, requires a real overlap
        const findMatch = (excelName) => {
          const n = norm(excelName);
          if (!n || n.length < 4) return null;
          if (orgByNorm.has(n)) return orgByNorm.get(n)[0];
          const nw = n.split(' ');
          if (nw.length < 2) return null; // single-word matches are unsafe (e.g. "judo")
          let best = null, bestScore = 0;
          for (const o of orgs) {
            const oN = norm(o.name);
            if (!oN) continue;
            const ow = oN.split(' ');
            // Jaccard-ish with 2-word minimum on shortest side
            const [short, longSet] = nw.length <= ow.length ? [nw, new Set(ow)] : [ow, new Set(nw)];
            if (short.length < 2) continue;
            const hits = short.filter(w => longSet.has(w)).length;
            const score = hits / short.length;
            // Require ≥ 75% word overlap AND at least 2 distinct word matches
            if (score >= 0.75 && hits >= 2 && score > bestScore) {
              best = o; bestScore = score;
            }
          }
          return best;
        };

        let matched = 0, updated = 0, created = 0, prospects = 0, mailingOnly = 0, skipped = 0;
        const report = [];
        const alreadyMatchedOrgIds = new Set(); // prevent overwriting a rich match with a poor one

        // Pre-compute nb_editions to sort rows by richness DESC (so best data wins in case of multiple matches)
        const rowsEnriched = rowsRaw.map(r => {
          const y2019 = pickBool(r, '2019');
          const y2020 = pickBool(r, '2020');
          const y2023 = pickBool(r, '2023');
          const y2024 = pickBool(r, '2024');
          const y2025 = pickBool(r, '2025');
          const nb = [y2019, y2020, y2023, y2024, y2025].filter(Boolean).length;
          return { r, nb };
        }).sort((a, b) => b.nb - a.nb);
        const rows = rowsEnriched.map(x => x.r);

        for (const r of rows) {
          const name = pick(r, 'exposant', 'contact', 'nom', 'structure', 'organisation');
          if (!name || name.length < 2 || /^(site|taravao|arue|faa|punaauia|mahina|multi|légende|color|fidel|total)/i.test(name)) { skipped++; continue; }

          const activity = pick(r, 'activit', 'discipline');
          const main_site = pick(r, 'site principal', 'site');
          const email = pick(r, 'email', 'courriel', 'mail').toLowerCase().trim();
          const phone = pick(r, 'tel', 'phon');
          const contact_name = pick(r, 'contact(nom', 'nomcontact', 'contactnom');

          const y2019 = pickBool(r, '2019');
          const y2020 = pickBool(r, '2020');
          const y2023 = pickBool(r, '2023');
          const y2024 = pickBool(r, '2024');
          const y2025 = pickBool(r, '2025');
          const nbComputed = [y2019, y2020, y2023, y2024, y2025].filter(Boolean).length;
          const nbExcel = parseInt(pick(r, 'nbedit', 'editions') || '0', 10);
          const nb_editions = nbExcel || nbComputed;

          let fidelity = pick(r, 'fidelit');
          fidelity = fidelity.replace(/⭐|[\u2b50]/g, '').trim();
          if (!fidelity) {
            if (nb_editions >= 3) fidelity = 'Fidèle';
            else if (nb_editions === 2) fidelity = 'Régulier';
            else if (nb_editions === 1) fidelity = 'Ponctuel';
            else fidelity = 'Nouveau';
          }

          const convention_2025 = pick(r, 'convention 2025', 'convention2025', 'convention');
          const caution_2025 = pick(r, 'caution 2025', 'caution2025', 'caution');
          const animation_2024 = pick(r, 'animation 2024', 'animation2024');
          const animation_2025 = pick(r, 'animation 2025', 'animation2025');
          const remarks = pick(r, 'remarque', 'source', 'note');

          // Heuristic: contact-only (mailing list) row = no activity + no site + no editions
          const isContactOnly = !activity && !main_site && nb_editions === 0;

          const participation_history = { y2019, y2020, y2023, y2024, y2025, nb_editions, fidelity };
          const aracom_private = {
            convention_history: { '2025': convention_2025 },
            caution_history: { '2025': caution_2025 },
            animation_history: { '2024': animation_2024, '2025': animation_2025 },
            admin_remarks: remarks,
            historical_contact_names: contact_name ? [contact_name] : [],
            source_main_site: main_site,
            last_imported_at: new Date().toISOString(),
          };

          const match = findMatch(name);
          if (match && alreadyMatchedOrgIds.has(match.id)) {
            // An richer row already updated this org → skip (but log)
            report.push({ action: 'skipped_duplicate_match', excel: name, db: match.name });
            continue;
          }
          if (match) {
            alreadyMatchedOrgIds.add(match.id);
            const patch = {
              participation_history,
              aracom_private: { ...(match.aracom_private || {}), ...aracom_private },
              source_activity: activity || match.source_activity || null,
              updated_at: new Date(),
            };
            if (email && !match.main_email) patch.main_email = email;
            if (phone && !match.main_phone) patch.main_phone = phone;
            if (contact_name && !match.contact_name) patch.contact_name = contact_name;
            await db.collection('organizations').updateOne({ id: match.id }, { $set: patch });
            matched++; updated++;
            report.push({ action: 'updated', excel: name, db: match.name, fidelity, nb_editions });
          } else {
            // Create new org as prospect
            const newOrg = {
              id: uuid(),
              edition_id: EDITION_ID,
              name,
              discipline: activity || null,
              main_email: email || null,
              main_phone: phone || null,
              contact_name: contact_name || null,
              priority_level: isContactOnly ? 'prospect_mailing' : 'prospect_historique',
              status: 'prospect',
              participation_history,
              aracom_private,
              source_activity: activity || null,
              is_mailing_only: isContactOnly,
              created_at: new Date(),
              updated_at: new Date(),
            };
            await db.collection('organizations').insertOne(newOrg);
            created++;
            if (isContactOnly) mailingOnly++;
            else prospects++;
            report.push({ action: 'created', name, status: 'prospect', is_mailing_only: isContactOnly, fidelity, nb_editions });
          }
        }

        await logActivity(db, ctx.userId, 'import', null, 'import_exposants_excel', null, { rows: rows.length, matched, created, skipped });

        return json({
          ok: true,
          summary: {
            total_rows: rows.length,
            matched_and_updated: updated,
            new_prospects_created: prospects,
            new_mailing_contacts_created: mailingOnly,
            skipped_rows: skipped,
          },
          report,
        });
      } catch (e) {
        console.error('[import/exposants-excel]', e);
        return err('Erreur parsing Excel: ' + (e?.message || e), 500);
      }
    }

    // ============ BACKUP — Export complet vers Google Drive ============
    // POST /api/backup/export : dump all MongoDB collections as a single JSON file
    // and upload it to the connected Google Drive inside a "Sauvegardes" sub-folder.
    if (route === 'backup/export') {
      if (!isDriveConfigured()) return err('Google Drive non configuré (GOOGLE_SERVICE_ACCOUNT_JSON + GOOGLE_DRIVE_ROOT_FOLDER_ID requis)', 500);
      try {
        const mongo = await db.collections();
        const collectionNames = mongo.map(c => c.collectionName).filter(n => !n.startsWith('system.'));
        const dump = {
          exported_at: new Date().toISOString(),
          edition_id: EDITION_ID,
          db_name: db.databaseName,
          app: 'Forum de la Rentrée 2026',
          version: '1.0',
          collections: {},
        };
        const stats = {};
        for (const name of collectionNames) {
          const docs = await db.collection(name).find({}).toArray();
          // strip _id to avoid ObjectId serialization issues
          const clean = docs.map(d => { const { _id, ...rest } = d; return rest; });
          dump.collections[name] = clean;
          stats[name] = clean.length;
        }

        const json_str = JSON.stringify(dump, null, 2);
        const buffer = Buffer.from(json_str, 'utf-8');
        const size_bytes = buffer.length;

        // Build filename : backup-forum-rentree-2026-YYYY-MM-DD_HH-MM-SS.json (Pacific timezone friendly)
        const now = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        const ts = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
        const fileName = `backup-forum-rentree-2026_${ts}.json`;

        // Ensure folder "Sauvegardes" exists at the root of the connected Drive
        const folderId = await ensureFolderPath(['Sauvegardes']);
        const uploaded = await driveUploadFile({
          folderId,
          fileName,
          mimeType: 'application/json',
          buffer,
        });

        // ========== ZIP des documents (PDF/HTML/reçus) ==========
        // Consolide tous les fichiers base64 des collections `documents` et `registration_documents`
        // dans une archive ZIP lisible directement, sans passer par la restauration du JSON.
        let zipMeta = null;
        try {
          const zip = new JSZip();
          let zipFileCount = 0;

          const addBase64 = (subfolder, doc, b64Field, nameField, mimeField) => {
            const content = doc[b64Field];
            if (!content) return;
            // Strip data URL prefix if present
            const pure = String(content).replace(/^data:[^;]+;base64,/, '');
            let buf;
            try { buf = Buffer.from(pure, 'base64'); } catch { return; }
            if (!buf.length) return;
            const fname = driveSafeName(doc[nameField] || (doc.id + '_' + (doc.document_type || 'fichier')));
            // Group by document_type if possible
            const subdir = driveSafeName(doc.document_type || subfolder);
            zip.folder(`${subfolder}/${subdir}`).file(fname, buf);
            zipFileCount++;
          };

          for (const d of dump.collections.documents || []) {
            addBase64('documents', d, 'file_data_base64', 'file_name', 'file_type');
          }
          for (const d of dump.collections.registration_documents || []) {
            addBase64('registration_documents', d, 'file_data', 'file_name', 'mime_type');
          }

          // Always add the JSON dump inside the ZIP as well (one-stop archive)
          zip.file('backup.json', json_str);

          if (zipFileCount > 0) {
            const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } });
            const zipName = `backup-forum-rentree-2026_${ts}.zip`;
            const uploadedZip = await driveUploadFile({
              folderId,
              fileName: zipName,
              mimeType: 'application/zip',
              buffer: zipBuffer,
            });
            zipMeta = {
              file_name: zipName,
              drive_file_id: uploadedZip.id,
              drive_view_link: uploadedZip.webViewLink || null,
              drive_download_link: uploadedZip.webContentLink || null,
              size_bytes: zipBuffer.length,
              documents_count: zipFileCount,
            };
          }
        } catch (zipErr) {
          console.error('[backup/export zip]', zipErr);
          // ZIP failure must NOT break the main backup → just log
        }

        // Record the backup metadata in a "backups" collection for history
        const backupRecord = {
          id: uuid(),
          file_name: fileName,
          drive_file_id: uploaded.id,
          drive_view_link: uploaded.webViewLink || null,
          drive_download_link: uploaded.webContentLink || null,
          size_bytes,
          collections_count: collectionNames.length,
          documents_total: Object.values(stats).reduce((a, b) => a + b, 0),
          stats,
          zip: zipMeta, // may be null if no file-bearing docs
          created_at: new Date(),
          created_by: ctx.userId || 'u-admin',
        };
        await db.collection('backups').insertOne(backupRecord);
        await logActivity(db, ctx.userId, 'backup', backupRecord.id, 'export_drive', null, { file_name: fileName, size_bytes });

        const { _id, ...rec } = backupRecord;
        return json({ ok: true, backup: rec });
      } catch (e) {
        console.error('[backup/export]', e);
        return err('Erreur lors de la sauvegarde: ' + (e?.message || e), 500);
      }
    }

    // ============ ACCESS TOKENS (lien magique) — ARACOM management ============
    // Helper : envoi de l'email de lien d'accès
    const sendAccessTokenEmail = async ({ purpose, accessUrl, recipientEmail, org }) => {
      const orgName = org?.name || 'Forum de la Rentrée 2026';
      const subj = purpose === 'inscription_exposant'
        ? "Votre lien d'inscription au Forum de la Rentrée 2026"
        : purpose === 'pacific_centers'
          ? 'Votre accès Pacific Centers — Forum de la Rentrée 2026'
          : `Votre espace exposant — ${orgName}`;
      const html = purpose === 'inscription_exposant' ? `<p>Bonjour,</p>
<p>ARACOM vous invite à inscrire votre structure au <b>Forum de la Rentrée 2026</b> (vendredi 14 &amp; samedi 15 août 2026).</p>
<p>👉 <a href="${accessUrl}" style="display:inline-block;padding:10px 18px;background:#1d4ed8;color:white;text-decoration:none;border-radius:6px;font-weight:600">Démarrer mon inscription</a></p>
<p style="font-size:12px;color:#64748b">Ce lien est <b>permanent</b> jusqu'à révocation : conservez-le pour accéder à votre espace dès que vous voulez.</p>
<p>L'équipe ARACOM</p>` : `<p>Bonjour ${org?.contact_name || ''},</p>
<p>Voici votre lien personnel d'accès à votre espace ${purpose === 'pacific_centers' ? 'Pacific Centers' : 'exposant'} pour le <b>Forum de la Rentrée 2026</b>.</p>
<p>👉 <a href="${accessUrl}" style="display:inline-block;padding:10px 18px;background:#1d4ed8;color:white;text-decoration:none;border-radius:6px;font-weight:600">Accéder à mon espace</a></p>
<p style="font-size:12px;color:#64748b">Ce lien est <b>permanent et personnel</b>. Conservez-le précieusement (favoris). Aucun mot de passe à retenir.</p>
<p>L'équipe ARACOM</p>`;
      try {
        const r = await sendMailAuto({ to: recipientEmail, subject: subj, html }, db);
        if (!r.ok) console.error('[mail token]', r.error);
        return r;
      } catch (e) { console.error('[mail token]', e?.message); return { ok: false, error: e?.message }; }
    };

    if (route === 'access-tokens') {
      const { organization_id, email, purpose = 'access', send_email = true, label = '', force = false, new_exposant } = body;
      // Liste des purposes officiellement supportés. Tout autre purpose non vide (ex: 'test') est accepté en mode soft.
      const KNOWN_PURPOSES = ['access', 'inscription_exposant', 'pacific_centers'];
      if (!purpose || typeof purpose !== 'string' || !purpose.trim()) {
        return err('purpose requis', 400);
      }
      if (!KNOWN_PURPOSES.includes(purpose) && purpose !== 'test') {
        // On accepte quand même les purposes custom mais on log un warning pour visibilité
        console.warn('[access-tokens] purpose non standard accepté:', purpose);
      }
      // Resolve user/email
      let resolvedEmail = (email || '').toLowerCase().trim();
      let resolvedUserId = null;
      let org = null;
      let resolvedOrganizationId = organization_id;

      // ============ NEW : Create org + user on the fly ============
      // When ARACOM provides new_exposant: { name, email, phone?, discipline?, contact_name? }
      // we create the org, the exposant user (passwordless) and link them, then issue an access token.
      if (purpose === 'access' && !organization_id && new_exposant && new_exposant.email && new_exposant.name) {
        const newEmail = String(new_exposant.email).toLowerCase().trim();
        // Reject if email is already taken by a different user
        const existingUser = await db.collection('users').findOne({ email: newEmail });
        if (existingUser) {
          return err(`Cet email est déjà utilisé par "${existingUser.full_name || existingUser.email}". Choisissez "Lien d'accès exposant existant" pour cet exposant.`, 409);
        }
        const orgId = `org-${uuid()}`;
        await db.collection('organizations').insertOne({
          id: orgId,
          edition_id: EDITION_ID,
          name: new_exposant.name,
          discipline: new_exposant.discipline || null,
          main_email: newEmail,
          main_phone: new_exposant.phone || null,
          contact_name: new_exposant.contact_name || null,
          priority_level: 'prospect',
          status: 'invited',
          notes: null,
          source_origin: 'aracom_invited',
          created_at: new Date(),
          updated_at: new Date(),
        });
        const userId = `u-exp-${orgId}`;
        await db.collection('users').insertOne({
          id: userId,
          email: newEmail,
          full_name: new_exposant.contact_name || new_exposant.name,
          phone: new_exposant.phone || null,
          role_id: 'role-exposant',
          role_code: 'exposant',
          password: null,
          organization_id: orgId,
          is_active: true,
          password_changed: false,
          created_at: new Date(),
          updated_at: new Date(),
        });
        // Create the registration shell (so the exposant can edit when he logs in)
        const regId = `reg-${orgId}`;
        await db.collection('registrations').insertOne({
          id: regId, edition_id: EDITION_ID, organization_id: orgId,
          venue_id: null, status: 'invited',
          animation_type: null, friday_slot_label: null, saturday_slot_label: null,
          stand_needed: true, stand_code: null, completion_percent: 5,
          is_convention_signed: false, is_deposit_required: true, is_deposit_received: false,
          is_insurance_uploaded: false, is_guide_sent: false,
          planned_arrival_time: '10:30', planned_departure_time: '17:00',
          post_event_status: 'en_attente', internal_notes: null, exposant_notes: null,
          created_at: new Date(), updated_at: new Date(),
        });
        // Initial deposit transaction (default 20 000 XPF)
        await db.collection('deposit_transactions').insertOne({
          id: uuid(), registration_id: regId, amount_xpf: 20000,
          status: 'non_demandee', expected_return_date: '2026-08-30',
          retained_amount_xpf: 0, recommended_return_amount_xpf: 20000,
          post_event_review_status: 'non_revu',
          created_at: new Date(), updated_at: new Date(),
        });
        await logActivity(db, ctx.userId, 'organization', orgId, 'create_invited_exposant', null, { name: new_exposant.name, email: newEmail });
        resolvedOrganizationId = orgId;
        resolvedUserId = userId;
        resolvedEmail = newEmail;
        org = { id: orgId, name: new_exposant.name, main_email: newEmail };
      }

      if (organization_id) {
        org = await db.collection('organizations').findOne({ id: organization_id });
        if (!org) return err('Organisation introuvable', 404);
        if (!resolvedEmail) resolvedEmail = (org.main_email || '').toLowerCase();
        // find user attached
        const u = await db.collection('users').findOne({ organization_id });
        if (u) resolvedUserId = u.id;
      }
      if (purpose === 'access' && !resolvedUserId && !resolvedEmail) {
        return err('Pour un lien d\'accès, organization_id ou email requis', 400);
      }
      // Pour les liens Pacific Centers, aucun compte ni email n'est requis :
      // c'est un simple lien magique partageable. On le rattache au compte Pacific générique au consume.

      // ============ IDEMPOTENCY : reuse existing active token ============
      // Check if an active (non-revoked, non-expired) token already exists for this target.
      const existingQuery = { revoked_at: null, purpose };
      if (resolvedOrganizationId) existingQuery.organization_id = resolvedOrganizationId;
      else if (resolvedEmail) existingQuery.email = resolvedEmail;
      const existingTokens = await db.collection('access_tokens').find(existingQuery).sort({ created_at: -1 }).toArray();
      const existing = existingTokens.find(t => !t.expires_at || new Date(t.expires_at) > new Date());

      if (existing && !force) {
        // Reuse existing token. Send email ONLY if explicitly asked AND not already sent recently (cooldown 1h).
        const lastSent = existing.last_email_sent_at ? new Date(existing.last_email_sent_at) : null;
        const cooldownMs = 60 * 60 * 1000; // 1 hour
        const canSend = send_email && (!lastSent || (Date.now() - lastSent.getTime()) > cooldownMs);
        const accessUrl = `${getPublicBaseUrl(request)}/access/${existing.token}`;
        if (canSend && resolvedEmail) {
          await sendAccessTokenEmail({ purpose, accessUrl, recipientEmail: resolvedEmail, org });
          await db.collection('access_tokens').updateOne({ id: existing.id }, { $set: { last_email_sent_at: new Date(), updated_at: new Date() } });
        }
        return json({
          ok: true,
          id: existing.id,
          token: existing.token,
          access_url: accessUrl,
          reused: true,
          email_sent: canSend,
          message: canSend ? 'Lien réutilisé et email renvoyé' : (existing.last_email_sent_at ? 'Lien existant — email récemment envoyé, pas de renvoi (cooldown 1h)' : 'Lien existant réutilisé (aucun email envoyé)'),
        });
      }

      // If force=true and existing token, revoke it first
      if (force && existing) {
        await db.collection('access_tokens').updateOne({ id: existing.id }, { $set: { revoked_at: new Date(), updated_at: new Date() } });
      }

      // Generate cryptographically random token (32 hex chars)
      const tokenStr = uuid().replace(/-/g, '') + uuid().replace(/-/g, '').slice(0, 16);
      const tokenId = uuid();
      await db.collection('access_tokens').insertOne({
        id: tokenId,
        token: tokenStr,
        purpose,
        organization_id: organization_id || null,
        user_id: resolvedUserId,
        email: resolvedEmail || null,
        label: label || (org?.name || resolvedEmail || 'Lien'),
        expires_at: null,
        revoked_at: null,
        last_used_at: null,
        last_email_sent_at: null,
        use_count: 0,
        created_at: new Date(),
        updated_at: new Date(),
        created_by: ctx.userId || 'admin',
      });
      const accessUrl = `${getPublicBaseUrl(request)}/access/${tokenStr}`;

      // Send email on first creation
      if (send_email && resolvedEmail) {
        await sendAccessTokenEmail({ purpose, accessUrl, recipientEmail: resolvedEmail, org });
        await db.collection('access_tokens').updateOne({ id: tokenId }, { $set: { last_email_sent_at: new Date() } });
      }

      return json({ ok: true, id: tokenId, token: tokenStr, access_url: accessUrl, reused: false, email_sent: Boolean(send_email && resolvedEmail) });
    }

    if (route.match(/^access-tokens\/[^/]+\/revoke$/)) {
      const id = p[1];
      await db.collection('access_tokens').updateOne({ id }, { $set: { revoked_at: new Date(), updated_at: new Date() } });
      return json({ ok: true });
    }

    // ✅ Révocation groupée de tous les liens actifs (non révoqués + non expirés)
    if (route === 'access-tokens/revoke-all') {
      // Filtres optionnels : purpose, scope (toutes les actifs par défaut)
      const purposeFilter = body.purpose; // ex: 'access', 'inscription_exposant', 'pacific'
      const filter = { revoked_at: null };
      if (purposeFilter) filter.purpose = purposeFilter;
      // Liens actifs = non révoqués (l'expiration est calculée à la lecture)
      const activeTokens = await db.collection('access_tokens').find(filter).toArray();
      const countBefore = activeTokens.length;
      if (countBefore === 0) return json({ ok: true, revoked: 0, message: 'Aucun lien actif à révoquer' });
      await db.collection('access_tokens').updateMany(
        filter,
        { $set: { revoked_at: new Date(), updated_at: new Date() } }
      );
      // Audit log
      try {
        await db.collection('audit_logs').insertOne({
          id: uuid(),
          action: 'access_tokens.bulk_revoke',
          user_id: userId,
          payload: { count: countBefore, purpose: purposeFilter || 'all' },
          created_at: new Date(),
        });
      } catch {}
      return json({ ok: true, revoked: countBefore });
    }

    if (route.match(/^access-tokens\/[^/]+\/resend$/)) {
      const id = p[1];
      const tk = await db.collection('access_tokens').findOne({ id });
      if (!tk) return err('Lien introuvable', 404);
      if (tk.revoked_at) return err('Lien révoqué — créez-en un nouveau', 400);
      if (!tk.email) return err('Aucun email associé à ce lien', 400);
      const accessUrl = `${getPublicBaseUrl(request)}/access/${tk.token}`;
      const orgName = tk.label || 'Forum de la Rentrée 2026';
      sendMailAuto({
        to: tk.email,
        subject: `Rappel : votre lien d'accès — ${orgName}`,
        html: `<p>Bonjour,</p><p>Voici à nouveau votre lien personnel d'accès :</p><p><a href="${accessUrl}" style="display:inline-block;padding:10px 18px;background:#1d4ed8;color:white;text-decoration:none;border-radius:6px;font-weight:600">Accéder à mon espace</a></p><p style="font-size:12px;color:#64748b">Lien permanent jusqu'à révocation.</p><p>L'équipe ARACOM</p>`,
      }, db).catch(e => console.error('[mail resend]', e?.message));
      await db.collection('access_tokens').updateOne({ id }, { $set: { last_resent_at: new Date(), updated_at: new Date() } });
      return json({ ok: true });
    }

    // ============ VENUE ELEMENTS (formes décoratives sur le plan) ============
    if (route === 'venue-elements') {
      const { venue_id, type, shape, pos_x, pos_y, width, height, rotation = 0, color, label = '', icon = null, z_index = 1 } = body;
      if (!venue_id || !type) return err('venue_id et type requis', 400);
      const id = uuid();
      const doc = {
        id, venue_id, type, shape: shape || 'rectangle',
        pos_x: pos_x ?? 50, pos_y: pos_y ?? 50,
        width: width ?? 8, height: height ?? 5,
        rotation, color: color || '#3b82f6',
        label, icon, z_index,
        created_at: new Date(), updated_at: new Date(),
      };
      await db.collection('venue_elements').insertOne(doc);
      delete doc._id;
      return json(doc, 201);
    }

    if (route === 'venue-elements/bulk-update') {
      const { updates = [] } = body;
      if (!Array.isArray(updates)) return err('updates doit être un tableau', 400);
      let n = 0;
      for (const u of updates) {
        if (!u.id) continue;
        const { id, ...rest } = u;
        await db.collection('venue_elements').updateOne({ id }, { $set: { ...rest, updated_at: new Date() } });
        n++;
      }
      return json({ ok: true, updated: n });
    }

    // ============ VALIDATION REQUESTS (workflow lock) ============
    // Helper : retrouver l'org/exposant pour les emails
    const buildExposantContext = async (registrationId) => {
      const reg = await db.collection('registrations').findOne({ id: registrationId });
      if (!reg) return null;
      const org = await db.collection('organizations').findOne({ id: reg.organization_id });
      const venue = reg.venue_id ? await db.collection('venues').findOne({ id: reg.venue_id }) : null;
      return { reg, org, venue };
    };
    const aracomEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || 'agence@aracom-conseil.fr';
    const baseUrl = getPublicBaseUrl(request);
    const formatDateFr = (d) => {
      const dt = new Date(d);
      return dt.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) +
        ' à ' + dt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    };

    // Exposant : demande la validation après avoir choisi site + créneau
    // 🆕 Sélection des jours de participation (LOT 2 - Étape 1)
    // Body : { attending_days: ['vendredi'] | ['samedi'] | ['vendredi','samedi'] }
    // Si on retire un jour, les animations de ce jour sont supprimées automatiquement.
    if (route.match(/^registrations\/[^/]+\/set-attending-days$/)) {
      const regId = p[1];
      const reg = await db.collection('registrations').findOne({ id: regId });
      if (!reg) return err('Inscription introuvable', 404);
      // Bloque si verrouillé
      const lockedReq = await db.collection('validation_requests').findOne({ registration_id: regId, status: 'verrouille' });
      if (lockedReq) return err('Dossier verrouillé par ARACOM. Modifications impossibles.', 403);
      const { attending_days } = body || {};
      if (!Array.isArray(attending_days)) return err('attending_days doit être un tableau', 400);
      const valid = attending_days.filter(d => ['vendredi', 'samedi'].includes(d));
      if (valid.length === 0) return err('Sélectionnez au moins un jour', 400);
      // Cleanup animations des jours retirés
      const removedDays = ['vendredi', 'samedi'].filter(d => !valid.includes(d));
      let removedSlots = 0;
      if (removedDays.length > 0) {
        const r = await db.collection('animation_slots').deleteMany({ registration_id: regId, day_label: { $in: removedDays } });
        removedSlots = r.deletedCount;
      }
      await db.collection('registrations').updateOne(
        { id: regId },
        { $set: { attending_days: valid, updated_at: new Date() } }
      );
      // Recompute completion
      const updated = await db.collection('registrations').findOne({ id: regId });
      return json({ ok: true, attending_days: valid, removed_animations: removedSlots, registration: updated && (delete updated._id, updated) });
    }

    if (route.match(/^registrations\/[^/]+\/request-validation$/)) {
      const regId = p[1];
      const reg = await db.collection('registrations').findOne({ id: regId });
      if (!reg) return err('Inscription introuvable', 404);
      if (reg.status === 'confirme') return err('Inscription déjà confirmée', 400);
      if (!reg.venue_id) return err('Choisissez d\'abord un site dans Sites & plan', 400);
      if (!reg.stand_code) return err('Pré-réservez un stand avant de demander la validation', 400);
      // Vérifier qu'au moins 1 créneau animation existe pour ce reg
      const slots = await db.collection('animation_slots').find({ registration_id: regId }).toArray();
      if (slots.length === 0) return err('Choisissez au moins 1 créneau d\'animation avant de valider', 400);

      const { rdv_proposal = '', preferred_payment = 'cheque', notes = '' } = body;
      // Cancel any previous pending request
      await db.collection('validation_requests').updateMany(
        { registration_id: regId, status: { $in: ['en_attente', 'rdv_fixe'] } },
        { $set: { status: 'annulee', updated_at: new Date() } }
      );
      const reqId = uuid();
      await db.collection('validation_requests').insertOne({
        id: reqId,
        registration_id: regId,
        organization_id: reg.organization_id,
        venue_id: reg.venue_id,
        stand_code: reg.stand_code,
        status: 'en_attente', // en_attente -> rdv_fixe -> verrouille | annulee
        preferred_payment, // 'cheque' | 'especes' | 'virement'
        rdv_proposal,
        notes,
        rdv_date: null,
        rdv_location: null,
        locked_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      });
      // Update registration flag
      await db.collection('registrations').updateOne({ id: regId }, { $set: {
        validation_request_id: reqId,
        validation_requested_at: new Date(),
        updated_at: new Date(),
      } });

      // ===== EMAILS automatiques =====
      try {
        const ctx = await buildExposantContext(regId);
        if (ctx?.org) {
          const exposantName = ctx.org.name;
          const venueName = ctx.venue?.name || '—';
          const stand = ctx.reg.stand_code;
          const paymentLabel = preferred_payment === 'especes' ? 'Espèces' : (preferred_payment === 'virement' ? 'Virement bancaire' : 'Chèque');
          // 1) Mail à l'exposant : confirmation de prise en compte
          if (ctx.org.main_email) {
            sendMailAuto({
              to: ctx.org.main_email,
              subject: `Demande de validation reçue — ${exposantName}`,
              html: `<p>Bonjour ${ctx.org.contact_name || exposantName},</p>
<p>Nous avons bien reçu votre <b>demande de confirmation de présence</b> au Forum de la Rentrée 2026.</p>
<div style="background:#f1f5f9;border-left:4px solid #2563eb;padding:12px 16px;border-radius:6px;margin:16px 0">
  <div><b>Site :</b> ${venueName}</div>
  <div><b>Stand :</b> ${stand}</div>
  <div><b>Mode de caution préféré :</b> ${paymentLabel} (20 000 XPF)</div>
  ${rdv_proposal ? `<div><b>Vos disponibilités :</b> ${rdv_proposal}</div>` : ''}
</div>
<p>L'équipe ARACOM va vous recontacter sous peu pour <b>fixer un rendez-vous</b> de remise de la caution. Une fois la caution réceptionnée, votre stand et vos créneaux d'animation seront <b>verrouillés définitivement</b>.</p>
<p>📌 <b>Modes acceptés :</b> chèque, espèces ou virement bancaire.</p>
<p>À très vite,<br/>L'équipe ARACOM</p>`,
            }, db).catch(e => console.error('[mail exposant request-validation]', e?.message));
          }
          // 2) Mail à ARACOM : notification nouvelle demande
          sendMailAuto({
            to: aracomEmail,
            subject: `🔔 Nouvelle demande de validation — ${exposantName}`,
            html: `<p>Une nouvelle demande de validation vient d'être soumise.</p>
<div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:12px 16px;border-radius:6px;margin:16px 0">
  <div><b>Exposant :</b> ${exposantName}</div>
  <div><b>Discipline :</b> ${ctx.org.discipline || '—'}</div>
  <div><b>Contact :</b> ${ctx.org.contact_name || '—'} — ${ctx.org.main_email || '—'} — ${ctx.org.main_phone || '—'}</div>
  <div><b>Site :</b> ${venueName}</div>
  <div><b>Stand :</b> ${stand}</div>
  <div><b>Mode souhaité :</b> ${paymentLabel}</div>
  ${rdv_proposal ? `<div><b>Disponibilités :</b> ${rdv_proposal}</div>` : ''}
  ${notes ? `<div><b>Notes :</b> ${notes}</div>` : ''}
</div>
<p><a href="${baseUrl}/aracom?tab=validations" style="display:inline-block;padding:10px 18px;background:#2563eb;color:white;text-decoration:none;border-radius:6px;font-weight:600">Traiter la demande</a></p>`,
          }, db).catch(e => console.error('[mail aracom request-validation]', e?.message));
          // 3) Push ARACOM : notification temps réel
          pushToRole({
            title: `🔔 Nouvelle demande de validation`,
            body: `${exposantName} (${venueName} · ${stand}) — Mode ${paymentLabel}`,
            url: `${baseUrl}/aracom?tab=validations`,
            tag: `validation-${reqId}`,
          }, { role: 'aracom_admin' }).catch(e => console.error('[push request-validation]', e?.message));
        }
      } catch (e) { console.error('[validation-request emails]', e?.message); }

      return json({ ok: true, validation_request_id: reqId });
    }

    // ARACOM : fixer un RDV pour la collecte de caution
    if (route.match(/^validation-requests\/[^/]+\/set-rdv$/)) {
      const reqId = p[1];
      const { rdv_date, rdv_location, rdv_notes = '' } = body;
      if (!rdv_date) return err('rdv_date requis', 400);
      const r = await db.collection('validation_requests').findOne({ id: reqId });
      if (!r) return err('Demande introuvable', 404);
      await db.collection('validation_requests').updateOne({ id: reqId }, { $set: {
        status: 'rdv_fixe',
        rdv_date: new Date(rdv_date),
        rdv_location: rdv_location || '',
        rdv_notes,
        updated_at: new Date(),
      } });

      // ===== Email à l'exposant : RDV fixé =====
      try {
        const ctx = await buildExposantContext(r.registration_id);
        if (ctx?.org?.main_email) {
          sendMailAuto({
            to: ctx.org.main_email,
            subject: `📅 Rendez-vous fixé pour la caution — ${ctx.org.name}`,
            html: `<p>Bonjour ${ctx.org.contact_name || ctx.org.name},</p>
<p>Nous avons le plaisir de vous confirmer le <b>rendez-vous</b> pour la remise de votre caution.</p>
<div style="background:#dcfce7;border-left:4px solid #16a34a;padding:14px 16px;border-radius:6px;margin:16px 0">
  <div style="font-size:18px;font-weight:700;color:#166534">${formatDateFr(rdv_date)}</div>
  ${rdv_location ? `<div style="margin-top:6px"><b>📍 Lieu :</b> ${rdv_location}</div>` : ''}
  ${rdv_notes ? `<div style="margin-top:6px"><b>Notes :</b> ${rdv_notes}</div>` : ''}
</div>
<p>📌 <b>Merci de prévoir :</b></p>
<ul>
  <li>Votre <b>caution de 20 000 XPF</b> en <b>chèque</b> (à l'ordre d'ARACOM) ou <b>espèces</b> uniquement</li>
  <li>Votre <b>attestation d'assurance</b> et la <b>convention signée</b> si pas encore déposées</li>
  <li>Une pièce d'identité du responsable légal de l'association</li>
</ul>
<p>Site : <b>${ctx.venue?.name || '—'}</b> · Stand : <b>${ctx.reg.stand_code}</b></p>
<p>Une fois la caution réceptionnée, votre inscription sera <b>verrouillée définitivement</b> et vous recevrez votre reçu officiel.</p>
<p>À très vite,<br/>L'équipe ARACOM</p>`,
          }, db).catch(e => console.error('[mail set-rdv]', e?.message));
        }
      } catch (e) { console.error('[set-rdv emails]', e?.message); }

      return json({ ok: true });
    }

    // ARACOM : verrouille DÉFINITIVEMENT (caution reçue + tout figé)
    if (route.match(/^validation-requests\/[^/]+\/lock$/)) {
      const reqId = p[1];
      const { payment_mode = 'cheque', amount_xpf = 20000 } = body;
      const vreq = await db.collection('validation_requests').findOne({ id: reqId });
      if (!vreq) return err('Demande introuvable', 404);
      const reg = await db.collection('registrations').findOne({ id: vreq.registration_id });
      if (!reg) return err('Inscription liée introuvable', 404);
      // Lock validation request
      await db.collection('validation_requests').updateOne({ id: reqId }, { $set: {
        status: 'verrouille',
        locked_at: new Date(),
        payment_mode,
        amount_xpf,
        updated_at: new Date(),
      } });
      // Confirm registration: status confirme, deposit recue, lock everything
      await db.collection('registrations').updateOne({ id: vreq.registration_id }, { $set: {
        status: 'confirme',
        is_pre_reserved: false,
        is_deposit_received: true,
        is_guide_sent: true, // 🆕 guide auto-mis à dispo dès caution réceptionnée
        is_locked: true,
        confirmed_at: new Date(),
        locked_at: new Date(),
        updated_at: new Date(),
      } });
      // Mark deposit
      const dep = await db.collection('deposit_transactions').findOne({ registration_id: vreq.registration_id });
      if (dep) {
        await db.collection('deposit_transactions').updateOne({ id: dep.id }, { $set: {
          status: 'recue', amount_xpf, deposit_mode: payment_mode,
          received_at: new Date(), updated_at: new Date(),
        } });
      } else {
        await db.collection('deposit_transactions').insertOne({
          id: uuid(), registration_id: vreq.registration_id,
          amount_xpf, status: 'recue', deposit_mode: payment_mode,
          received_at: new Date(), created_at: new Date(), updated_at: new Date(),
        });
      }
      // Lock animation slots (mark as locked so DELETE refuses)
      await db.collection('animation_slots').updateMany(
        { registration_id: vreq.registration_id },
        { $set: { is_locked: true, locked_at: new Date(), updated_at: new Date() } }
      );
      // Confirm stand assignment
      await db.collection('stand_assignments').updateMany(
        { registration_id: vreq.registration_id, status: 'pre_reserve' },
        { $set: { status: 'confirme', updated_at: new Date() } }
      );

      // ===== Auto-génération du reçu de caution si pas déjà émis =====
      let receiptDocId = null;
      let receiptNumber = null;
      try {
        const existing = await db.collection('registration_documents').findOne({ registration_id: vreq.registration_id, document_type: 'recu_caution' });
        if (existing) {
          receiptDocId = existing.id;
          receiptNumber = existing.receipt_number;
        } else {
          const org = await db.collection('organizations').findOne({ id: reg.organization_id });
          const venue = reg.venue_id ? await db.collection('venues').findOne({ id: reg.venue_id }) : null;
          receiptNumber = `CAUT-2026-${String(reg.id).slice(0, 6).toUpperCase()}`;
          const paymentLabel = payment_mode === 'especes' ? 'Espèces' : 'Chèque';
          const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Reçu de caution ${org?.name || ''}</title><style>body{font-family:Helvetica,Arial,sans-serif;max-width:680px;margin:32px auto;color:#1f2937;padding:0 16px}h1{color:#1d4ed8;margin:0 0 4px}.box{border:2px solid #1d4ed8;padding:20px;border-radius:8px;margin:20px 0}.row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px dashed #e5e7eb}.label{color:#64748b}.amount{font-size:28px;color:#1d4ed8;font-weight:800}.print-btn{position:fixed;top:20px;right:20px;padding:10px 20px;border-radius:6px;background:#1d4ed8;color:#fff;border:0;cursor:pointer;font-weight:600}@media print{.print-btn{display:none}}</style></head><body><button class="print-btn" onclick="window.print()">🖨️ Imprimer / PDF</button><div style="display:flex;justify-content:space-between;align-items:start;border-bottom:3px solid #1d4ed8;padding-bottom:10px"><div><h1>REÇU DE CAUTION</h1><p style="margin:0;color:#64748b">Forum de la Rentrée 2026 · 14 & 15 août 2026</p></div><div style="text-align:right"><div style="background:#1d4ed8;color:#fff;font-weight:700;padding:6px 12px;border-radius:6px;display:inline-block;letter-spacing:.05em">ARACOM</div><div style="font-size:11px;color:#64748b;margin-top:6px">Émis le ${new Date().toLocaleDateString('fr-FR')}</div></div></div><div class="box"><div class="row"><span class="label">N° de reçu</span><b>${receiptNumber}</b></div><div class="row"><span class="label">Date d'émission</span><b>${new Date().toLocaleDateString('fr-FR')}</b></div><div class="row"><span class="label">Exposant</span><b>${org?.name || '—'}</b></div><div class="row"><span class="label">Discipline</span><span>${org?.discipline || '—'}</span></div><div class="row"><span class="label">Contact</span><span>${org?.contact_name || '—'}</span></div><div class="row"><span class="label">Site / Stand</span><span>${venue?.name || '—'} / ${reg.stand_code || '—'}</span></div><div class="row"><span class="label">Mode de paiement</span><b>${paymentLabel}</b></div></div><div style="text-align:center;padding:18px 0;background:#eff6ff;border-radius:8px"><div class="label">Montant reçu en garantie</div><div class="amount">20 000 XPF</div><div class="label" style="margin-top:6px">Caution restituée intégralement sous 2 semaines après l'événement<br/>sous réserve de présence et tenue conforme du stand</div></div><p style="font-size:12px;color:#64748b;margin-top:24px">Cette caution sera restituée sous 2 semaines après l'événement, à condition que toutes les conditions de présence et de tenue de stand soient respectées (présence sur les jours confirmés, montage et démontage du stand dans les horaires, aucune dégradation constatée).</p><div style="margin-top:40px;padding-top:16px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between"><div><i>Pour ARACOM,</i><br/><b>L'équipe organisation</b></div><div style="text-align:right;font-size:11px;color:#94a3b8">Document officiel — Forum de la Rentrée 2026<br/>${receiptNumber}</div></div></body></html>`;
          receiptDocId = uuid();
          await db.collection('registration_documents').insertOne({
            id: receiptDocId,
            registration_id: vreq.registration_id,
            document_type: 'recu_caution',
            file_name: `Recu_caution_${(org?.name || 'exposant').replace(/\s+/g,'_')}_${receiptNumber}.html`,
            mime_type: 'text/html',
            file_size: html.length,
            file_data: Buffer.from(html, 'utf-8').toString('base64'),
            status: 'valide',
            uploaded_by: 'aracom',
            uploaded_at: new Date(),
            validated_at: new Date(),
            receipt_number: receiptNumber,
            created_at: new Date(), updated_at: new Date(),
          });
        }
      } catch (e) { console.error('[auto-receipt on lock]', e?.message); }

      // ===== Email à l'exposant : verrouillage + reçu =====
      try {
        const ctx = await buildExposantContext(vreq.registration_id);
        if (ctx?.org?.main_email) {
          const receiptUrl = receiptDocId ? `${baseUrl}/api/documents/${receiptDocId}/download` : '';
          const paymentLabel = payment_mode === 'especes' ? 'Espèces' : 'Chèque';
          sendMailAuto({
            to: ctx.org.main_email,
            subject: `🔒 Inscription verrouillée — ${ctx.org.name}`,
            html: `<p>Bonjour ${ctx.org.contact_name || ctx.org.name},</p>
<p>Excellente nouvelle ! Nous avons bien <b>réceptionné votre caution</b> de 20 000 XPF (${paymentLabel}).</p>
<div style="background:#dcfce7;border-left:4px solid #16a34a;padding:14px 16px;border-radius:6px;margin:16px 0">
  <div style="font-size:16px;font-weight:700;color:#166534">🎉 Votre inscription au Forum de la Rentrée 2026 est maintenant <u>verrouillée</u> !</div>
  <ul style="margin:10px 0 0 0;padding-left:20px;color:#166534">
    <li><b>Site :</b> ${ctx.venue?.name || '—'}</li>
    <li><b>Stand :</b> ${ctx.reg.stand_code}</li>
    <li><b>Statut :</b> Confirmé</li>
  </ul>
</div>
<p>Vos créneaux d'animation sont également figés. Pour toute modification, contactez ARACOM directement.</p>
${receiptNumber ? `<p>📄 <b>Votre reçu officiel</b> (n° ${receiptNumber}) est disponible dans votre espace exposant. ${receiptUrl ? `<br/><a href="${receiptUrl}" style="display:inline-block;margin-top:8px;padding:10px 18px;background:#1d4ed8;color:white;text-decoration:none;border-radius:6px;font-weight:600">📥 Télécharger mon reçu de caution</a>` : ''}</p>` : ''}
<p>Rendez-vous le <b>vendredi 14 et samedi 15 août 2026</b> pour faire de cette édition un succès !</p>
<p>L'équipe ARACOM</p>`,
          }, db).catch(e => console.error('[mail lock]', e?.message));
        }
      } catch (e) { console.error('[lock emails]', e?.message); }

      return json({ ok: true, receipt_number: receiptNumber, receipt_document_id: receiptDocId });
    }

    // ARACOM : annuler une demande
    if (route.match(/^validation-requests\/[^/]+\/cancel$/)) {
      const reqId = p[1];
      const { reason = '' } = body;
      const vreq = await db.collection('validation_requests').findOne({ id: reqId });
      if (!vreq) return err('Demande introuvable', 404);
      if (vreq.status === 'verrouille') return err('Impossible d\'annuler une demande déjà verrouillée', 400);
      await db.collection('validation_requests').updateOne({ id: reqId }, { $set: {
        status: 'annulee', cancellation_reason: reason, updated_at: new Date(),
      } });
      await db.collection('registrations').updateOne({ id: vreq.registration_id }, { $unset: { validation_request_id: '' }, $set: { updated_at: new Date() } });

      // Email à l'exposant : annulation
      try {
        const ctx = await buildExposantContext(vreq.registration_id);
        if (ctx?.org?.main_email) {
          sendMailAuto({
            to: ctx.org.main_email,
            subject: `Demande de validation annulée — ${ctx.org.name}`,
            html: `<p>Bonjour ${ctx.org.contact_name || ctx.org.name},</p>
<p>Votre demande de validation a été annulée par ARACOM.</p>
${reason ? `<div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:12px 16px;border-radius:6px;margin:16px 0"><b>Motif :</b> ${reason}</div>` : ''}
<p>Vous pouvez à nouveau ajuster votre site, votre stand ou vos créneaux d'animation puis soumettre une nouvelle demande depuis votre espace exposant.</p>
<p>L'équipe ARACOM</p>`,
          }, db).catch(e => console.error('[mail cancel]', e?.message));
        }
      } catch (e) { console.error('[cancel emails]', e?.message); }

      return json({ ok: true });
    }

    if (route === 'venue-stands/positions') {
      const { updates } = body;
      if (!Array.isArray(updates)) return err('updates requis', 400);
      let count = 0;
      for (const u of updates) {
        if (!u.id) continue;
        const upd = {};
        if (typeof u.pos_x === 'number') upd.pos_x = u.pos_x;
        if (typeof u.pos_y === 'number') upd.pos_y = u.pos_y;
        if (Object.keys(upd).length) {
          upd.updated_at = new Date();
          await db.collection('venue_stands').updateOne({ id: u.id }, { $set: upd });
          count++;
        }
      }
      return json({ ok: true, updated: count });
    }

    // ---- 🗑️ Effacer toutes les positions des stands d'un site (repartir de zéro) ----
    // ⚠️ CHANGEMENT DE COMPORTEMENT (session 14) :
    // L'action "Vider le plan" n'efface PLUS les positions des stands ni les éléments décoratifs.
    // Elle libère uniquement les stands de leurs exposants assignés (statut "à relancer" sur les inscriptions liées).
    // → conserve la mise en page visuelle (alignements, kiosques, démos, commerces…)
    // → permet de réutiliser les positions pour la prochaine édition / la nouvelle vague d'exposants
    if (route === 'venue-stands/clear-positions') {
      const { venue_id } = body;
      if (!venue_id) return err('venue_id requis', 400);
      // 1) Libère les inscriptions liées à ce venue (stand_code → null, et statut éventuellement remis en "à relancer")
      const stands = await db.collection('venue_stands').find({ venue_id }).toArray();
      const standCodes = stands.map(s => s.stand_code).filter(Boolean);
      const regsRes = await db.collection('registrations').updateMany(
        { venue_id, stand_code: { $in: standCodes } },
        { $set: { stand_code: null, updated_at: new Date() } }
      );
      // 2) Annule toutes les assignations actives sur les stands de ce venue
      const standIds = stands.map(s => s.id);
      const asgRes = await db.collection('stand_assignments').updateMany(
        { venue_stand_id: { $in: standIds }, status: { $ne: 'annule' } },
        { $set: { status: 'annule', updated_at: new Date() } }
      );
      // 3) Met à jour l'updated_at des stands (pour traçabilité), SANS toucher aux positions
      await db.collection('venue_stands').updateMany(
        { venue_id },
        { $set: { updated_at: new Date() } }
      );
      return json({
        ok: true,
        stands_freed: regsRes.modifiedCount,
        assignments_cancelled: asgRes.modifiedCount,
        positions_kept: stands.length, // info : positions conservées
        elements_kept: true,
      });
    }

    // ---- Exposant : édition de son profil (org info + reg info) ----
    if (route.match(/^registrations\/[^/]+\/profile$/)) {
      const regId = p[1];
      const reg = await db.collection('registrations').findOne({ id: regId });
      if (!reg) return err('Inscription introuvable', 404);
      const orgUpd = {};
      ['name', 'discipline', 'discipline_other', 'contact_name', 'main_phone', 'description', 'animation_default'].forEach(k => {
        if (typeof body[k] === 'string') orgUpd[k] = body[k];
      });
      if (Object.keys(orgUpd).length) {
        orgUpd.updated_at = new Date();
        await db.collection('organizations').updateOne({ id: reg.organization_id }, { $set: orgUpd });
      }
      // Hours are FIXED to the event start/end — ignore any client-sent override
      const regUpd = {
        planned_arrival_time: '09:00',
        planned_departure_time: '17:00',
        updated_at: new Date(),
      };
      ['friday_slot_label', 'saturday_slot_label', 'exposant_notes'].forEach(k => {
        if (body[k] !== undefined) regUpd[k] = body[k];
      });
      await db.collection('registrations').updateOne({ id: regId }, { $set: regUpd });
      return json({ ok: true });
    }

    // ---- Exposant : pré-réservation d'un stand (atomique) ----
    if (route.match(/^registrations\/[^/]+\/pre-reserve-stand$/)) {
      const regId = p[1];
      const { stand_id } = body;
      if (!stand_id) return err('stand_id requis', 400);
      const reg = await db.collection('registrations').findOne({ id: regId });
      if (!reg) return err('Inscription introuvable', 404);
      const stand = await db.collection('venue_stands').findOne({ id: stand_id });
      if (!stand) return err('Stand introuvable', 404);
      // Check the stand is FREE (not assigned to another registration via stand_code)
      const occupant = await db.collection('registrations').findOne({
        edition_id: EDITION_ID,
        venue_id: stand.venue_id,
        stand_code: stand.stand_code,
        id: { $ne: regId },
      });
      if (occupant) return err('Ce stand est déjà pré-réservé ou attribué à un autre exposant', 409);
      // Also check via stand_assignments
      const existingAssignment = await db.collection('stand_assignments').findOne({
        venue_stand_id: stand.id,
        status: { $ne: 'annule' },
        registration_id: { $ne: regId },
      });
      if (existingAssignment) return err('Ce stand est déjà attribué via une affectation', 409);
      // Update registration: assign venue + stand
      const upd = {
        venue_id: stand.venue_id,
        stand_code: stand.stand_code,
        status: reg.status === 'confirme' ? 'confirme' : 'a_confirmer',
        is_pre_reserved: true,
        pre_reserved_at: new Date(),
        updated_at: new Date(),
      };
      await db.collection('registrations').updateOne({ id: regId }, { $set: upd });
      // Sync stand_assignments — remove any old assignment for this registration, add a new one
      await db.collection('stand_assignments').updateMany({ registration_id: regId, status: { $ne: 'annule' } }, { $set: { status: 'annule', updated_at: new Date() } });
      await db.collection('stand_assignments').insertOne({
        id: uuid(),
        registration_id: regId,
        venue_stand_id: stand.id,
        status: 'pre_reserve',
        created_at: new Date(), updated_at: new Date(),
      });
      await logActivity(db, getUserContext(request).userId, 'registrations', regId, 'update', null, { event: 'pre_reserve_stand', stand_code: stand.stand_code, venue_id: stand.venue_id });
      return json({ ok: true, stand_code: stand.stand_code, status: upd.status });
    }

    // ---- Exposant : libération du stand pré-réservé ----
    if (route.match(/^registrations\/[^/]+\/release-stand$/)) {
      const regId = p[1];
      const reg = await db.collection('registrations').findOne({ id: regId });
      if (!reg) return err('Inscription introuvable', 404);
      if (reg.status === 'confirme') return err('Impossible de libérer un stand confirmé. Contactez ARACOM.', 400);
      await db.collection('registrations').updateOne({ id: regId }, { $set: {
        stand_code: null,
        is_pre_reserved: false,
        pre_reserved_at: null,
        updated_at: new Date(),
      } });
      // Cancel any active stand_assignments for this registration
      await db.collection('stand_assignments').updateMany({ registration_id: regId, status: { $ne: 'annule' } }, { $set: { status: 'annule', updated_at: new Date() } });
      return json({ ok: true });
    }

    // ---- ARACOM : confirme un stand pré-réservé après réception caution ----
    if (route.match(/^registrations\/[^/]+\/confirm-stand$/)) {
      const regId = p[1];
      const reg = await db.collection('registrations').findOne({ id: regId });
      if (!reg) return err('Inscription introuvable', 404);
      await db.collection('registrations').updateOne({ id: regId }, { $set: {
        status: 'confirme',
        is_pre_reserved: false,
        is_deposit_received: true,
        confirmed_at: new Date(),
        updated_at: new Date(),
      } });
      // Mark deposit as received (collection is deposit_transactions)
      const dep = await db.collection('deposit_transactions').findOne({ registration_id: regId });
      if (dep && dep.status !== 'recue') {
        await db.collection('deposit_transactions').updateOne({ id: dep.id }, { $set: {
          status: 'recue', received_at: new Date(), updated_at: new Date(),
        } });
      } else if (!dep) {
        // Create one if missing
        await db.collection('deposit_transactions').insertOne({
          id: uuid(), registration_id: regId, amount_xpf: 20000, status: 'recue',
          received_at: new Date(), created_at: new Date(), updated_at: new Date(),
        });
      }
      // Confirm any pre_reserve assignment
      await db.collection('stand_assignments').updateMany({ registration_id: regId, status: 'pre_reserve' }, { $set: { status: 'confirme', updated_at: new Date() } });
      return json({ ok: true });
    }

    // ---- ARACOM : générer un reçu de caution (HTML) pour un exposant ----
    if (route.match(/^registrations\/[^/]+\/generate-caution-receipt$/)) {
      const regId = p[1];
      const reg = await db.collection('registrations').findOne({ id: regId });
      if (!reg) return err('Inscription introuvable', 404);
      const org = await db.collection('organizations').findOne({ id: reg.organization_id });
      const dep = await db.collection('deposit_transactions').findOne({ registration_id: regId });
      const venue = await db.collection('venues').findOne({ id: reg.venue_id });
      const receiptNumber = `CAUT-2026-${String(reg.id).slice(0, 6).toUpperCase()}`;
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Reçu de caution ${org?.name || ''}</title><style>body{font-family:Helvetica,Arial,sans-serif;max-width:680px;margin:32px auto;color:#1f2937}h1{color:#1d4ed8}.box{border:2px solid #1d4ed8;padding:20px;border-radius:8px;margin:20px 0}.row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px dashed #e5e7eb}.label{color:#64748b}.amount{font-size:28px;color:#1d4ed8;font-weight:800}</style></head><body><h1>REÇU DE CAUTION</h1><p><b>Forum de la Rentrée 2026</b> · 14 & 15 août 2026<br>Organisé par <b>ARACOM</b></p><div class="box"><div class="row"><span class="label">N° de reçu</span><b>${receiptNumber}</b></div><div class="row"><span class="label">Date</span><b>${new Date().toLocaleDateString('fr-FR')}</b></div><div class="row"><span class="label">Exposant</span><b>${org?.name || '—'}</b></div><div class="row"><span class="label">Discipline</span><span>${org?.discipline || '—'}</span></div><div class="row"><span class="label">Site / Stand</span><span>${venue?.name || '—'} / ${reg.stand_code || '—'}</span></div><div class="row"><span class="label">Mode</span><span>${dep?.deposit_mode || 'Chèque / Virement / Espèces'}</span></div></div><div style="text-align:center;padding:18px 0"><div class="label">Montant</div><div class="amount">20 000 XPF</div><div class="label" style="margin-top:6px">Reçu en garantie de présence sur le Forum</div></div><p style="font-size:12px;color:#64748b">Cette caution sera restituée intégralement sous 2 semaines après l'événement, à condition que toutes les conditions de présence et de tenue de stand soient respectées.</p><p style="margin-top:40px"><i>L'équipe ARACOM</i></p></body></html>`;
      // Save in registration_documents collection (matches the GET /api/documents endpoint)
      const docId = uuid();
      const fileName = `Recu_caution_${(org?.name || 'exposant').replace(/\s+/g,'_')}_${receiptNumber}.html`;
      await db.collection('registration_documents').insertOne({
        id: docId,
        registration_id: regId,
        document_type: 'recu_caution',
        file_name: fileName,
        mime_type: 'text/html',
        file_size: html.length,
        file_data: Buffer.from(html, 'utf-8').toString('base64'),
        status: 'valide',
        uploaded_by: 'aracom',
        uploaded_at: new Date(),
        validated_at: new Date(),
        receipt_number: receiptNumber,
        created_at: new Date(), updated_at: new Date(),
      });
      return json({ ok: true, receipt_number: receiptNumber, document_id: docId });
    }

    // ============ AI Email Reminder J-X (manuel par étape) ============
    // POST /api/registrations/:id/generate-jx-reminder
    // Body: { step_key: 'profile'|'stand'|'animation'|'documents'|'caution'|'convention', custom_instruction?: string }
    // → Génère un email de rappel personnalisé pour l'exposant avec :
    //   - le décompte J-X jusqu'à la date butoir de l'étape
    //   - les coordonnées du référent ARACOM sur le site (si défini)
    //   - les actions concrètes attendues
    // Retourne { ok, subject, body_html }
    if (route.match(/^registrations\/[^/]+\/generate-jx-reminder$/)) {
      const regId = p[1];
      const { step_key, custom_instruction = '' } = body || {};
      const STEP_LABELS = {
        profile: 'Compléter le profil exposant (coordonnées, description)',
        stand: 'Choisir un site et pré-réserver un stand',
        animation: "Planifier les créneaux d'animation",
        documents: 'Téléverser les documents officiels (assurance, RIB, etc.)',
        caution: 'Verser la caution de 20 000 XPF',
        convention: 'Signer la convention de participation',
      };
      if (!step_key || !STEP_LABELS[step_key]) return err('step_key invalide', 400);

      const reg = await db.collection('registrations').findOne({ id: regId });
      if (!reg) return err('Inscription introuvable', 404);
      const org = await db.collection('organizations').findOne({ id: reg.organization_id });
      const venue = reg.venue_id ? await db.collection('venues').findOne({ id: reg.venue_id }) : null;

      // Read step deadlines
      const cfg = await db.collection('app_settings').findOne({ key: 'step_deadlines' });
      const deadlines = cfg?.deadlines || {};
      const deadlineIso = deadlines[step_key] || null;
      let jxLabel = 'date à définir';
      let daysRemaining = null;
      if (deadlineIso) {
        const d = new Date(deadlineIso);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        d.setHours(0, 0, 0, 0);
        daysRemaining = Math.round((d - today) / (1000 * 60 * 60 * 24));
        const fmt = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
        if (daysRemaining > 0) jxLabel = `J-${daysRemaining} (échéance le ${fmt})`;
        else if (daysRemaining === 0) jxLabel = `🚨 ÉCHÉANCE AUJOURD'HUI (${fmt})`;
        else jxLabel = `🚨 ÉCHÉANCE DÉPASSÉE depuis ${Math.abs(daysRemaining)} jour(s) — ${fmt}`;
      }

      const referent = venue?.referent_aracom || {};
      const referentBlock = (referent.name || referent.email || referent.phone)
        ? `Référent ARACOM sur le site : ${referent.name || '—'}${referent.email ? ' · ' + referent.email : ''}${referent.phone ? ' · ' + referent.phone : ''}`
        : 'Aucun référent ARACOM spécifique au site (contact général : agence@aracom-conseil.fr).';

      const contextDescription = `Destinataire : ${org?.name || '—'} (${org?.discipline || '—'}), contact ${org?.contact_name || 'responsable'}.
Site : ${venue?.name || 'non attribué'}, stand ${reg.stand_code || 'non attribué'}.
Statut du dossier : ${reg.status}. Complétion : ${reg.completion_percent || 0}%.
Étape concernée : "${STEP_LABELS[step_key]}".
Échéance : ${jxLabel}.
${referentBlock}`;

      const systemPrompt = `Tu es un assistant rédactionnel expert pour ARACOM, l'organisateur du Forum de la Rentrée 2026 en Polynésie française.
Ton rôle : rédiger un email de rappel J-X chaleureux et factuel à un exposant pour l'inviter à compléter une étape précise de son inscription.

Contexte général :
- Forum de la Rentrée 2026, vendredi 14 & samedi 15 août 2026
- Caution de 20 000 XPF par exposant requise
- Organisé par ARACOM, en partenariat avec Pacific Centers

Règles de rédaction :
- Français soigné, vouvoiement, ton "professionnel chaleureux".
- 3 à 5 paragraphes courts. HTML inline (<p>, <b>, <a>).
- Mets en évidence l'échéance (J-X) en début de mail.
- Indique clairement l'action attendue.
- Si un référent ARACOM est défini sur le site, donne ses coordonnées dans un encart à la fin du mail (<p style="background:#f1f5f9;border-left:3px solid #2563eb;padding:10px 14px;border-radius:4px;font-size:13px"><b>Votre contact local :</b> ...</p>).
- Termine par "Bien cordialement,<br>L'équipe ARACOM".

🛡️ RÈGLE ABSOLUE — BOUTONS ET LIENS :
Tu n'utilises QUE les placeholders ci-dessous comme href. Aucun autre lien.
- href="[[MON_ESPACE]]"              → page d'accueil de l'espace exposant
- href="[[MON_ESPACE_PROFIL]]"       → onglet Profil
- href="[[MON_ESPACE_SITES]]"        → onglet Sites & plan
- href="[[MON_ESPACE_ANIMATION]]"    → onglet Animations
- href="[[MON_ESPACE_DOCS]]"         → onglet Documents
- href="[[MON_ESPACE_ASSURANCE]]"    → focus assurance
- href="[[MON_ESPACE_CONVENTION]]"   → focus convention
- href="[[MON_ESPACE_CAUTION]]"      → focus caution

Choisis le placeholder le plus pertinent selon l'étape :
- step=profile → [[MON_ESPACE_PROFIL]]
- step=stand → [[MON_ESPACE_SITES]]
- step=animation → [[MON_ESPACE_ANIMATION]]
- step=documents → [[MON_ESPACE_DOCS]]
- step=caution → [[MON_ESPACE_CAUTION]]
- step=convention → [[MON_ESPACE_CONVENTION]]

Tu retournes UNIQUEMENT un JSON valide : {"subject": "...", "body_html": "..."}
Pas de markdown, pas de backticks, pas d'explication.`;

      const userPrompt = `Rédige un email de rappel J-X pour cet exposant.

Contexte :
${contextDescription}

${custom_instruction ? `Instructions spécifiques : ${custom_instruction}\n` : ''}
Contraintes :
- Subject : court, percutant, mentionne J-X ou l'urgence si dépassé. 60 caractères max.
- Body : HTML inline. 3-5 paragraphes max.
- Inclus 1 bouton d'action (placeholder de la liste autorisée).
- Inclus l'encart "Votre contact local" SEULEMENT si un référent est défini.
- Pas d'autre footer, il sera ajouté côté serveur.

Retourne UNIQUEMENT le JSON { "subject": "...", "body_html": "..." }.`;

      const result = await emergentChat({
        model: DEFAULT_MODEL_CLAUDE,
        system: systemPrompt,
        user: userPrompt,
        max_tokens: 2000,
        temperature: 0.7,
      });
      if (!result.ok) {
        console.error('[generate-jx-reminder] LLM error:', result.error);
        return err('Erreur IA : ' + (result.error || 'inconnue'), 500);
      }
      const text = result.text || '';
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) return err('Réponse IA invalide : ' + text.slice(0, 200), 500);
      let parsed;
      try { parsed = JSON.parse(match[0]); } catch { return err('JSON invalide dans la réponse IA', 500); }
      const cleanedBodyHtml = sanitizeEmailHtml(parsed.body_html || '');
      return json({
        ok: true,
        subject: parsed.subject,
        body_html: cleanedBodyHtml,
        step_key,
        days_remaining: daysRemaining,
        deadline_iso: deadlineIso,
        referent: referent,
        usage: result.usage,
        llm_source: result.source || 'unknown',
      });
    }

    // ============ 🤖 CHATBOT IA — Assistant contextuel role-aware ============
    // POST /api/chatbot
    // Body: { message: string, history?: [{role, content}] }
    // Le backend construit un contexte data ADAPTÉ au rôle de l'utilisateur :
    //  - aracom_admin : accès complet (KPIs, exposants, sites, mailing, caution, bilans, anomalies…)
    //  - exposant : accès UNIQUEMENT à son profil + infos événement génériques
    //  - pacific_centers_readonly : accès aux venues pacific_visible + stats agrégées + aide outils
    // 🛡️ Isolation stricte : impossible pour un exposant de voir d'autres données via le chat.
    // 🔒 Sessions volatiles (pas de persistance — reconstruit le contexte à chaque requête)
    if (route === 'satisfaction/ai-enrich') {
      // ✨ Enrichit ou rédige les commentaires textuels du questionnaire de satisfaction (POST)
      const { registration_id, ratings = {}, nps_score, will_participate_next = '', current_text = {}, mode = 'enrich' } = body || {};
      if (!registration_id) return err('registration_id requis', 400);
      const reg = await db.collection('registrations').findOne({ id: registration_id });
      if (!reg) return err('Inscription introuvable', 404);
      const org = await db.collection('organizations').findOne({ id: reg.organization_id });
      const venue = reg.venue_id ? await db.collection('venues').findOne({ id: reg.venue_id }) : null;

      const ratingLabel = (n) => {
        if (n == null || n === 0) return 'non noté';
        if (n >= 4.5) return 'excellent';
        if (n >= 3.5) return 'bon';
        if (n >= 2.5) return 'moyen';
        return 'décevant';
      };
      const npsLabel = (n) => {
        if (n == null) return 'non renseigné';
        if (n >= 9) return `${n}/10 (Promoteur enthousiaste)`;
        if (n >= 7) return `${n}/10 (Passif satisfait)`;
        return `${n}/10 (Détracteur)`;
      };

      const contextDescription = `Exposant : ${org?.name || '—'} (${org?.discipline || '—'})
Site : ${venue?.name || '—'}
Stand : ${reg.stand_code || '—'}

Notes données (sur 5 étoiles) :
- Note globale : ${ratings.overall || 0}/5 (${ratingLabel(ratings.overall)})
- Organisation ARACOM : ${ratings.organization || 0}/5 (${ratingLabel(ratings.organization)})
- Stand & emplacement : ${ratings.stand || 0}/5 (${ratingLabel(ratings.stand)})
- Affluence visiteurs : ${ratings.visitors || 0}/5 (${ratingLabel(ratings.visitors)})
- Communication ARACOM : ${ratings.communication || 0}/5 (${ratingLabel(ratings.communication)})

NPS (recommandation) : ${npsLabel(nps_score)}
Souhaite revenir l'an prochain : ${will_participate_next || 'non précisé'}

${mode === 'enrich' && (current_text.positive || current_text.improvement || current_text.free)
  ? `Texte déjà rédigé par l'exposant (à ENRICHIR, pas remplacer) :
- Points positifs : "${current_text.positive || '—'}"
- Améliorations souhaitées : "${current_text.improvement || '—'}"
- Commentaire libre : "${current_text.free || '—'}"`
  : "L'exposant n'a encore rien rédigé — propose un PREMIER JET cohérent avec ses notes."
}`;

      const systemPrompt = `Tu es un assistant d'écriture pour un exposant du Forum de la Rentrée 2026 en Polynésie française.
Tu aides l'exposant à rédiger son questionnaire de satisfaction post-événement de façon CONSTRUCTIVE et NUANCÉE.

Règles ABSOLUES :
- Tu écris à la PREMIÈRE PERSONNE du singulier ("J'ai apprécié…", "J'aurais aimé…", "Je recommande…").
- Tu produis un texte qui REFLÈTE FIDÈLEMENT les notes données :
  * Note ≥ 4 : ton positif et reconnaissant
  * Note 3 : ton nuancé (du positif ET du constructif)
  * Note ≤ 2 : ton honnête et constructif (pointer ce qui n'a pas marché)
- Tu RESPECTES le ton de l'exposant : professionnel, jamais agressif.
- Tu ne mens pas, tu n'inventes pas de faits que tu ne peux pas connaître.
- Si l'exposant a déjà écrit quelque chose, tu l'ENRICHIS sans le contredire.
- Tu es CONCIS : 2-3 phrases par section maximum.

Tu retournes UNIQUEMENT un JSON valide : {"positive_points": "...", "improvement_points": "...", "free_comment": "..."}.
Pas de markdown, pas de backticks, pas d'explication.`;

      const userPrompt = `Rédige (ou enrichis si déjà écrit) les 3 zones de commentaire du questionnaire de satisfaction.

Contexte :
${contextDescription}

Contraintes :
- "positive_points" : 2-3 phrases sur ce qui a fonctionné, en accord avec les notes hautes.
- "improvement_points" : 2-3 phrases sur ce qui pourrait être amélioré, en accord avec les notes basses (ou avec un ton constructif s'il n'y en a pas).
- "free_comment" : 1-2 phrases de conclusion / mot final / remerciement / souhait pour la prochaine édition.

Retourne UNIQUEMENT le JSON { "positive_points": "...", "improvement_points": "...", "free_comment": "..." }.`;

      const result = await emergentChat({
        model: DEFAULT_MODEL_CLAUDE,
        system: systemPrompt,
        user: userPrompt,
        max_tokens: 1200,
        temperature: 0.7,
      });
      if (!result.ok) {
        console.error('[satisfaction/ai-enrich] LLM error:', result.error);
        return err('Erreur IA : ' + (result.error || 'inconnue'), 500);
      }
      const text = result.text || '';
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) return err('Réponse IA invalide : ' + text.slice(0, 200), 500);
      let parsed;
      try { parsed = JSON.parse(match[0]); } catch { return err('JSON invalide dans la réponse IA', 500); }
      return json({
        ok: true,
        positive_points: parsed.positive_points || '',
        improvement_points: parsed.improvement_points || '',
        free_comment: parsed.free_comment || '',
        usage: result.usage,
        llm_source: result.source || 'unknown',
      });
    }


    if (route === 'chatbot') {
      const { message, history = [] } = body || {};
      if (!message || typeof message !== 'string' || !message.trim()) {
        return err('Message requis', 400);
      }
      if (!ctx.userId) return err('Non authentifié', 401);

      const fmtDate = (d) => d ? new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';
      const dayRemaining = (iso) => {
        if (!iso) return null;
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const d = new Date(iso); d.setHours(0, 0, 0, 0);
        return Math.round((d - today) / (1000 * 60 * 60 * 24));
      };

      // ---- Infos événement communes à tous ----
      const EVENT_INFO = `Événement : Forum de la Rentrée 2026
Dates : vendredi 14 août 2026 (11h-17h) et samedi 15 août 2026 (9h-17h)
Organisateur : ARACOM Conseil (Teva GEROS · contact@aracom-conseil.fr · +(689) 87 210 444)
Sites : 6 centres commerciaux Pacific Centers en Polynésie française (Faaa, Punaauia, Arue, Taravao, Mahina, Moorea)
Caution exposant : 20 000 XPF (restituée après l'événement si le stand est rendu en état)
Animations : 1 créneau d'animation maximum par jour par exposant (créneaux d'1 heure)`;

      let systemPrompt = '';
      let contextData = '';

      if (ctx.role === 'aracom_admin') {
        // ==== ADMIN : accès TOTAL — liste exhaustive de la base ====
        const [regs, venues, deadlinesCfg, anomalies, deposits, valReqs, satSurveys, tasks] = await Promise.all([
          db.collection('registrations').find({ edition_id: EDITION_ID }).toArray(),
          db.collection('venues').find({ edition_id: EDITION_ID }).toArray(),
          db.collection('app_settings').findOne({ key: 'step_deadlines' }),
          db.collection('registration_anomalies').find({ resolved_status: { $ne: 'resolu' } }).toArray(),
          db.collection('deposit_transactions').find({}).toArray(),
          db.collection('validation_requests').find({ status: { $in: ['en_attente', 'rdv_fixe'] } }).toArray(),
          db.collection('satisfaction_surveys').find({}).toArray().catch(() => []),
          db.collection('tasks_or_followups').find({ status: { $in: ['a_faire', 'en_cours'] } }).toArray().catch(() => []),
        ]);
        const orgs = await db.collection('organizations').find({ id: { $in: regs.map(r => r.organization_id) } }).toArray();
        const orgMap = Object.fromEntries(orgs.map(o => [o.id, o]));
        const venueMap = Object.fromEntries(venues.map(v => [v.id, v]));
        const depByReg = Object.fromEntries(deposits.map(d => [d.registration_id, d]));

        const byStatus = regs.reduce((a, r) => { a[r.status] = (a[r.status] || 0) + 1; return a; }, {});
        const cautionsRecues = deposits.filter(d => d.status === 'recue').length;
        const cautionsAttente = deposits.filter(d => d.status !== 'recue' && d.status !== 'restituee').length;
        const xpfEncaisses = deposits.filter(d => d.status === 'recue').reduce((a, d) => a + (d.amount_xpf || 20000), 0);
        const avgCompletion = regs.length ? Math.round(regs.reduce((a, r) => a + (r.completion_percent || 0), 0) / regs.length) : 0;
        const convSigned = regs.filter(r => r.is_convention_signed).length;
        const insurUploaded = regs.filter(r => r.is_insurance_uploaded).length;

        // ===== LISTE EXHAUSTIVE DES EXPOSANTS (format pipe-séparé compact) =====
        const exposantsRows = regs.map(r => {
          const o = orgMap[r.organization_id] || {};
          const v = venueMap[r.venue_id] || {};
          const dep = depByReg[r.id] || {};
          return `${o.name || '?'} | ${o.discipline || '?'} | site=${v.name || '—'} | stand=${r.stand_code || '—'} | statut=${r.status} | compl=${r.completion_percent || 0}% | caution=${dep.status || 'non_demandee'} | conv=${r.is_convention_signed ? 'oui' : 'non'} | assur=${r.is_insurance_uploaded ? 'oui' : 'non'} | contact=${o.contact_name || '—'} | email=${o.main_email || '—'} | tel=${o.main_phone || '—'} | prio=${o.priority_level || '—'}`;
        });

        // ===== Détails par site (vrais chiffres) =====
        const byVenue = venues.map(v => {
          const vregs = regs.filter(r => r.venue_id === v.id);
          const confirmed = vregs.filter(r => r.status === 'confirme').length;
          const aRelancer = vregs.filter(r => r.status === 'a_relancer').length;
          const aConfirmer = vregs.filter(r => r.status === 'a_confirmer').length;
          const cautionsOK = vregs.filter(r => depByReg[r.id]?.status === 'recue').length;
          const capacity = v.stands_count || v.total_stands || 0;
          const fillPct = capacity > 0 ? Math.round((vregs.length / capacity) * 100) : 0;
          return `${v.name} : capacité ${capacity} stands · ${vregs.length} inscrits (${fillPct}%) · ${confirmed} confirmés · ${aConfirmer} à confirmer · ${aRelancer} à relancer · ${cautionsOK} cautions reçues`;
        });

        // ===== Anomalies ouvertes détaillées =====
        const anomLines = anomalies.map(a => {
          const reg = regs.find(r => r.id === a.registration_id);
          const o = reg ? orgMap[reg.organization_id] : null;
          const v = reg ? venueMap[reg.venue_id] : null;
          return `• [${a.severity_level || '?'}] ${a.anomaly_type || '?'} — ${o?.name || '?'} (${v?.name || '?'}) : ${a.title || a.description || '—'}`;
        });

        // ===== Validations en attente =====
        const valLines = valReqs.map(vr => {
          const reg = regs.find(r => r.id === vr.registration_id);
          const o = reg ? orgMap[reg.organization_id] : null;
          return `• ${o?.name || '?'} — statut ${vr.status} · paiement ${vr.preferred_payment || '—'} · RDV ${vr.rdv_date || '—'}`;
        });

        // ===== Top exposants à risque =====
        const atRisk = regs
          .filter(r => (r.completion_percent || 0) < 50 && r.status !== 'confirme')
          .sort((a, b) => (a.completion_percent || 0) - (b.completion_percent || 0))
          .slice(0, 15)
          .map(r => `• ${orgMap[r.organization_id]?.name || '?'} — ${r.completion_percent || 0}% · ${r.status} · ${venueMap[r.venue_id]?.name || 'aucun site'}`);

        // ===== Deadlines =====
        const deadlines = deadlinesCfg?.deadlines || {};
        const deadlineLines = Object.entries(deadlines).map(([k, v]) => {
          const d = dayRemaining(v);
          return `• ${k} : ${fmtDate(v)} (${d > 0 ? `J-${d}` : d === 0 ? 'aujourd\'hui' : `dépassée de ${Math.abs(d)}j`})`;
        }).join('\n') || 'Aucune deadline configurée.';

        // ===== Satisfaction (si réponses présentes) =====
        const satLine = satSurveys.length
          ? `${satSurveys.length} réponses · moy globale ${(satSurveys.reduce((a, s) => a + (s.overall_rating || 0), 0) / satSurveys.length).toFixed(1)}/5`
          : 'aucune réponse';

        // ===== Tâches ouvertes =====
        const tasksOpen = tasks.length;

        contextData = `${EVENT_INFO}

═══════════════════════════════════════════════════════════════
📊 SNAPSHOT TEMPS RÉEL — Forum 2026 (J-${dayRemaining('2026-08-14') ?? '?'} avant l'événement)
═══════════════════════════════════════════════════════════════
Inscriptions totales : ${regs.length}
Statuts : ${Object.entries(byStatus).map(([k, v]) => `${v} ${k}`).join(', ')}
Complétion moyenne : ${avgCompletion}%
Conventions signées : ${convSigned}/${regs.length}
Attestations assurance déposées : ${insurUploaded}/${regs.length}
Cautions : ${cautionsRecues} reçues · ${cautionsAttente} en attente · ${xpfEncaisses.toLocaleString('fr-FR')} XPF encaissés
Anomalies ouvertes : ${anomalies.length}
Validations en attente : ${valReqs.length}
Tâches ouvertes : ${tasksOpen}
Satisfaction : ${satLine}

═══════════════════════════════════════════════════════════════
🌍 RÉPARTITION PAR SITE (${venues.length} sites)
═══════════════════════════════════════════════════════════════
${byVenue.join('\n')}

═══════════════════════════════════════════════════════════════
📅 DEADLINES CONFIGURÉES
═══════════════════════════════════════════════════════════════
${deadlineLines}

═══════════════════════════════════════════════════════════════
⚠️ ANOMALIES OUVERTES (${anomalies.length})
═══════════════════════════════════════════════════════════════
${anomLines.join('\n') || 'Aucune anomalie ouverte.'}

═══════════════════════════════════════════════════════════════
🔐 VALIDATIONS EN ATTENTE (${valReqs.length})
═══════════════════════════════════════════════════════════════
${valLines.join('\n') || 'Aucune demande de validation en attente.'}

═══════════════════════════════════════════════════════════════
🚨 EXPOSANTS À RISQUE (complétion < 50%, top 15)
═══════════════════════════════════════════════════════════════
${atRisk.join('\n') || 'Aucun.'}

═══════════════════════════════════════════════════════════════
📋 BASE COMPLÈTE DES ${regs.length} EXPOSANTS (chaque ligne = 1 exposant)
Format : nom | discipline | site | stand | statut | compl% | caution | conv | assur | contact | email | tel | prio
═══════════════════════════════════════════════════════════════
${exposantsRows.join('\n')}`;

        systemPrompt = `Tu es l'assistant opérationnel de Teva GEROS, directeur d'ARACOM Conseil, organisateur du Forum de la Rentrée 2026 (6 sites Pacific Centers en Polynésie française).

🎯 RÈGLES ABSOLUES (DO):
1. Tu as un accès COMPLET aux données de la base MongoDB ci-dessous : 67 exposants, 6 sites, anomalies, cautions, validations, deadlines.
2. À CHAQUE question, interroge ces données et réponds avec des chiffres RÉELS, des noms RÉELS, des listes RÉELLES.
3. Réponses COURTES, DIRECTES, OPÉRATIONNELLES — pas de blabla pédagogique, pas d'introduction.
4. Si une donnée n'existe pas dans le snapshot ci-dessous, dis-le clairement en une phrase. Pas de "va chercher".

🚫 INTERDICTIONS STRICTES (DON'T):
- ❌ Ne JAMAIS dire "tu peux exporter", "va dans l'interface", "consulte l'onglet", "je n'ai pas accès"
- ❌ Ne JAMAIS suggérer un export CSV ou un téléchargement
- ❌ Ne JAMAIS renvoyer Teva vers une page de l'app — il connaît son outil
- ❌ Ne JAMAIS dire "pour plus d'infos, contactez X"

✅ FORMAT DE RÉPONSE :
- Chiffres en gras quand pertinent
- Listes à puces pour énumérer des exposants/sites
- Markdown court (pas de HTML)
- Réponse en français
- Une phrase de synthèse + liste/chiffres bruts si demandé

EXEMPLES :
Q : "Combien de cautions manquent à Arue ?"
R : "**14 cautions manquantes à Arue** sur 17 exposants engagés :\n• I Mua Papeete\n• Olympique de Pirae\n• [...]"

Q : "Quels exposants sont prioritaires à relancer ?"
R : "**15 exposants à risque** (complétion < 50%) :\n• Lotus Bleu — 12% · à relancer · Faaa\n• [...]"

Q : "Statut des conventions ?"
R : "**4 conventions signées sur 67** (6%). Il en manque 63."`;

      } else if (ctx.role === 'exposant') {
        // ==== EXPOSANT : UNIQUEMENT son profil ====
        // Résoudre l'organization depuis le user (getUserContext ne l'expose pas)
        const userRec = await db.collection('users').findOne({ id: ctx.userId });
        const organizationId = userRec?.organization_id;
        if (!organizationId) return err('Organization non liée à votre compte', 403);
        const org = await db.collection('organizations').findOne({ id: organizationId });
        const reg = await db.collection('registrations').findOne({ organization_id: organizationId, edition_id: EDITION_ID });
        const venue = reg?.venue_id ? await db.collection('venues').findOne({ id: reg.venue_id }) : null;
        const deadlinesCfg = await db.collection('app_settings').findOne({ key: 'step_deadlines' });
        const deadlines = deadlinesCfg?.deadlines || {};
        const docs = reg ? await db.collection('registration_documents').find({ registration_id: reg.id }).toArray() : [];
        const animSlots = reg ? await db.collection('animation_slots').find({ registration_id: reg.id }).toArray() : [];
        const deposits = reg ? await db.collection('deposit_transactions').find({ registration_id: reg.id }).toArray() : [];
        const cautionReceived = deposits.some(d => d.type === 'caution_received');

        const docsSummary = docs.length
          ? docs.map(d => `• ${d.category || d.filename} : ${d.status || 'en attente'}`).join('\n')
          : 'Aucun document déposé pour le moment.';

        const deadlineLines = Object.entries(deadlines).map(([k, v]) => {
          const d = dayRemaining(v);
          const label = {
            profile: 'Compléter le profil',
            stand: 'Choisir son site/stand',
            animation: 'Planifier une animation',
            documents: 'Déposer les documents',
            caution: 'Payer la caution',
            convention: 'Signer la convention',
          }[k] || k;
          return `• ${label} : ${fmtDate(v)} (${d > 0 ? `dans ${d} jours` : d === 0 ? 'aujourd\'hui !' : `échéance dépassée de ${Math.abs(d)}j`})`;
        }).join('\n') || 'Aucune deadline configurée pour le moment.';

        const animList = animSlots.length
          ? animSlots.map(a => `• ${a.day} ${a.start_time}–${a.end_time} : ${a.title || 'Animation'}`).join('\n')
          : 'Aucune animation planifiée pour le moment.';

        contextData = `${EVENT_INFO}

═══════════════════════════════════════════════════════════════
🎪 VOTRE DOSSIER EXPOSANT
═══════════════════════════════════════════════════════════════
Structure : ${org?.name || '—'} (${org?.discipline || '—'})
Contact : ${org?.contact_name || '—'} · ${org?.main_email || '—'} · ${org?.main_phone || '—'}

INSCRIPTION 2026 :
Statut : ${reg?.status || 'non inscrit'}
Complétion : ${reg?.completion_percent || 0}%
Site attribué : ${venue?.name || 'non attribué'}
Stand : ${reg?.stand_code || 'non attribué'}
Caution (20 000 XPF) : ${cautionReceived ? '✅ reçue par ARACOM' : '⏳ en attente'}

ANIMATIONS PLANIFIÉES :
${animList}

DOCUMENTS :
${docsSummary}

DATES LIMITES POUR VOUS :
${deadlineLines}

═══════════════════════════════════════════════════════════════
📋 PROCÉDURE D'INSCRIPTION (étapes séquentielles)
═══════════════════════════════════════════════════════════════
1. Compléter le profil (infos structure + coordonnées + description)
2. Choisir un site Pacific Centers et pré-réserver un stand libre sur le plan
3. Planifier 1 créneau d'animation par jour maximum (vendredi 11h-17h, samedi 9h-17h)
4. Déposer les documents officiels (assurance responsabilité civile, RIB, etc.)
5. Verser la caution de 20 000 XPF auprès d'ARACOM (chèque ou espèces)
6. Signer la convention de participation envoyée par ARACOM

🔒 Verrouillage du stand : votre stand devient définitivement réservé UNIQUEMENT après validation d'ARACOM (caution reçue + convention signée + documents validés). Avant cela, vous pouvez libérer votre pré-réservation à tout moment.

💰 Caution : les 20 000 XPF sont VERSÉS à ARACOM avant l'événement et RESTITUÉS après l'événement si le stand est rendu en bon état et que vous avez respecté les règles de l'événement.`;

        systemPrompt = `Tu es l'assistant IA personnel de l'exposant "${org?.name || 'exposant'}" pour le Forum de la Rentrée 2026.

Tu aides UNIQUEMENT cet exposant. Tu n'as accès qu'à SON dossier — tu ne connais PAS les autres exposants ni les données internes ARACOM.

Ton ton : chaleureux, pédagogique, rassurant. Vouvoiement. Tu expliques clairement les étapes, les échéances, la procédure.
Tu réponds en markdown court (gras, listes à puces). Pas de HTML.

🛡️ RÈGLE ABSOLUE : si on te demande des infos sur d'autres exposants, d'autres sites, ou des données internes ARACOM, refuse poliment : "Je n'ai accès qu'à votre dossier. Pour toute autre question, contactez ARACOM (contact@aracom-conseil.fr)."

Si la question n'est pas liée à l'événement ou au dossier de l'exposant, redirige poliment.`;

      } else if (ctx.role === 'pacific_centers_readonly') {
        // ==== PACIFIC : venues visibles + stats agrégées + aide outils ====
        const venues = await db.collection('venues').find({ edition_id: EDITION_ID, pacific_visible: { $ne: false } }).toArray();
        const venueIds = venues.map(v => v.id);
        const regs = await db.collection('registrations').find({ edition_id: EDITION_ID, venue_id: { $in: venueIds } }).toArray();
        const orgs = await db.collection('organizations').find({ id: { $in: regs.map(r => r.organization_id) } }).toArray();
        const orgMap = Object.fromEntries(orgs.map(o => [o.id, o]));

        const byVenue = venues.map(v => {
          const vregs = regs.filter(r => r.venue_id === v.id);
          const confirmed = vregs.filter(r => r.status === 'confirme').length;
          const disciplines = [...new Set(vregs.map(r => orgMap[r.organization_id]?.discipline).filter(Boolean))];
          return `${v.name} : ${vregs.length} inscrit(s), ${confirmed} confirmé(s) · disciplines : ${disciplines.slice(0, 8).join(', ') || '—'}`;
        });

        contextData = `${EVENT_INFO}

═══════════════════════════════════════════════════════════════
📊 STATISTIQUES PACIFIC CENTERS (lecture seule)
═══════════════════════════════════════════════════════════════
Sites visibles : ${venues.length}
Total exposants engagés sur vos sites : ${regs.length}
Confirmés : ${regs.filter(r => r.status === 'confirme').length}

DÉTAIL PAR SITE :
${byVenue.join('\n')}

═══════════════════════════════════════════════════════════════
🛠️ OUTILS DE VOTRE PORTAIL PACIFIC CENTERS
═══════════════════════════════════════════════════════════════
• Dashboard : vue consolidée des KPIs (inscrits, confirmés, disciplines)
• Filtre par site : affiche uniquement les données du site choisi
• Graphiques : répartition disciplines, timeline de confirmation, engagement
• Calendrier des animations : visualise les créneaux programmés vendredi/samedi
• Export : télécharge les données au format CSV pour vos équipes

Votre portail est en LECTURE SEULE : aucune modification possible. Pour toute action, contactez ARACOM.`;

        systemPrompt = `Tu es l'assistant IA du portail Pacific Centers pour le Forum de la Rentrée 2026.

Tu aides les équipes Pacific Centers à comprendre leurs stats, interpréter les graphiques, et comprendre l'usage des outils de leur portail (en lecture seule).

Ton ton : professionnel, clair, pédagogique. Tu vulgarises les chiffres et expliques les graphiques.
Tu réponds en markdown court (gras, listes à puces). Pas de HTML.

🛡️ RÈGLE : tu n'as accès qu'aux données AGRÉGÉES des sites Pacific Centers. Tu ne peux pas divulguer d'infos personnelles sur un exposant précis (email, téléphone). Si on te demande ce type d'info, renvoie vers ARACOM.

Si la question n'est pas liée aux outils ou aux stats visibles, redirige poliment.`;

      } else {
        return err('Rôle non autorisé pour le chatbot', 403);
      }

      // ---- Construction des messages pour l'IA ----
      // history = [{role: 'user'|'assistant', content}]  (côté client, volatile)
      const safeHistory = Array.isArray(history)
        ? history.filter(m => m && typeof m.role === 'string' && typeof m.content === 'string').slice(-10)
        : [];

      const userPrompt = `${contextData}

═══════════════════════════════════════════════════════════════
❓ QUESTION DE L'UTILISATEUR
═══════════════════════════════════════════════════════════════
${message.trim()}

Réponds en français, en markdown court, en t'appuyant sur les données du contexte ci-dessus. Si l'info n'y est pas, dis-le.`;

      const result = await emergentChat({
        model: DEFAULT_MODEL_CLAUDE,
        system: systemPrompt,
        user: userPrompt,
        history: safeHistory,
        max_tokens: 1500,
        temperature: 0.5,
      });
      if (!result.ok) {
        console.error('[chatbot] LLM error:', result.error);
        return err('Assistant IA temporairement indisponible. Réessayez dans quelques instants.', 503);
      }
      return json({
        ok: true,
        reply: result.text || '',
        role_context: ctx.role,
        usage: result.usage,
        llm_source: result.source || 'unknown',
      });
    }

    // ============ AI INSIGHT — Synthèse IA du comportement historique d'un exposant ============
    // Génère un texte court d'aide à la décision pour l'admin :
    //   - fidélité (nb éditions passées),
    //   - respect des délais documents,
    //   - paiement caution,
    //   - rigueur globale,
    //   - points de vigilance.
    // Stocké dans registration.ai_insight (+ ai_insight_generated_at)
    if (route.match(/^registrations\/[^/]+\/generate-insight$/)) {
      if (!process.env.EMERGENT_LLM_KEY) return err('Clé Emergent LLM non configurée', 500);
      const regId = p[1];
      const reg = await db.collection('registrations').findOne({ id: regId });
      if (!reg) return err('Registration introuvable', 404);
      const org = await db.collection('organizations').findOne({ id: reg.organization_id });
      if (!org) return err('Organisation introuvable', 404);
      // Données historiques
      const deposits = await db.collection('deposit_transactions').find({ registration_id: regId }).sort({ created_at: 1 }).toArray();
      const docsArchive = await db.collection('registration_documents_archive').find({ registration_id: regId }).toArray();
      const acts = await db.collection('activity_logs').find({ 'metadata.registration_id': regId }).sort({ created_at: 1 }).limit(15).toArray();
      const ph = org.participation_history || {};
      const editionsPast = Object.keys(ph).filter(k => k.startsWith('y') && ph[k] === true).map(k => k.slice(1));

      const ctxLines = [
        `**Exposant** : ${org.name} (${org.discipline || 'discipline non précisée'})`,
        `**Contact principal** : ${org.contact_name || '—'} · ${org.main_email || '—'} · ${org.main_phone || '—'}`,
        `**Priorité officielle** : ${org.priority_level || 'C'}`,
        `**Fidélité** : ${ph.fidelity || (editionsPast.length >= 3 ? 'Fidèle' : 'Nouveau / occasionnel')} — ${ph.nb_editions || editionsPast.length} édition(s) passée(s) ${editionsPast.length ? '('+editionsPast.join(', ')+')' : ''}`,
        `**Notes internes ARACOM** : ${org.aracom_private || org.notes || '—'}`,
        ``,
        `**Caution (historique)** : ${deposits.length} transaction(s) — ${deposits.map(d => d.status).join(', ') || 'aucune'}`,
        `**Documents archivés** : ${docsArchive.length}`,
        `**Activités récentes** : ${acts.slice(-5).map(a => a.action).join(', ') || 'aucune trace'}`,
      ];
      const contextStr = ctxLines.join('\n');

      const systemPrompt = `Tu es un assistant analytique pour ARACOM (organisateur du Forum de la Rentrée 2026 en Polynésie).
Ton rôle : générer un MICRO-PROFIL TYPE FICHE PROSPECT pour aider l'admin à se positionner immédiatement face à un exposant.

Règles strictes :
- Maximum 80 mots, en français concis et factuel.
- Format Markdown avec des balises <b> pour les points clés.
- Termine par 1 ou 2 indicateurs visuels : 🟢 Fiable / 🟡 À surveiller / 🔴 Vigilance / 🆕 Nouveau dossier
- Pas de blabla, aucune phrase neutre type "il faudrait voir".
- Concentre-toi sur : fidélité, ponctualité documents, paiement caution, rigueur, points d'attention.
- Si données absentes ou nouveau dossier, le dis clairement.
- Ne hallucine PAS de chiffres ou faits non présents dans le contexte.

Retourne UNIQUEMENT un JSON :
{ "insight": "...", "vigilance_level": "low" | "medium" | "high" | "new" }`;

      const userPrompt = `Voici le contexte de l'exposant :
${contextStr}

Génère le micro-profil et le niveau de vigilance.`;

      const result = await emergentChat({
        model: DEFAULT_MODEL_CLAUDE,
        system: systemPrompt,
        user: userPrompt,
        max_tokens: 600,
        temperature: 0.4,
      });
      if (!result.ok) return err('Erreur IA : ' + (result.error || 'inconnue'), 500);
      const m = (result.text || '').match(/\{[\s\S]*\}/);
      if (!m) return err('Réponse IA invalide', 500);
      let parsed;
      try { parsed = JSON.parse(m[0]); } catch { return err('JSON IA invalide', 500); }

      await db.collection('registrations').updateOne(
        { id: regId },
        {
          $set: {
            ai_insight: parsed.insight || '',
            ai_insight_vigilance: parsed.vigilance_level || 'new',
            ai_insight_generated_at: new Date(),
            updated_at: new Date(),
          },
        }
      );
      return json({ ok: true, insight: parsed.insight, vigilance_level: parsed.vigilance_level, llm_source: result.source });
    }

    // Bulk generate (background) — l'admin peut générer pour tous les exposants
    if (route === 'registrations/generate-insights-bulk') {
      if (!process.env.EMERGENT_LLM_KEY) return err('Clé Emergent LLM non configurée', 500);
      if (ctx.role !== 'aracom_admin') return err('Réservé aux admins', 403);
      const regs = await db.collection('registrations').find({ edition_id: EDITION_ID }).toArray();
      // Lance en arrière-plan (fire-and-forget) pour ne pas bloquer l'UI
      (async () => {
        for (const r of regs) {
          try {
            // Skip si déjà généré récemment (< 24h)
            if (r.ai_insight_generated_at && (Date.now() - new Date(r.ai_insight_generated_at).getTime()) < 86400000) continue;
            const fakeReq = new Request(`http://localhost/api/registrations/${r.id}/generate-insight`, {
              method: 'POST',
              headers: { 'x-user-id': ctx.userId || 'u-admin', 'x-user-role': 'aracom_admin', 'Content-Type': 'application/json' },
              body: '{}',
            });
            await POST(fakeReq, { params: { path: ['registrations', r.id, 'generate-insight'] } });
            await new Promise(res => setTimeout(res, 1500)); // throttle 1.5s entre 2 calls
          } catch (e) { console.error('[bulk-insight]', r.id, e?.message); }
        }
        console.log('[bulk-insight] terminé sur', regs.length, 'registrations');
      })().catch(e => console.error('[bulk-insight] fatal', e?.message));
      return json({ ok: true, total: regs.length, message: `Génération lancée en arrière-plan pour ${regs.length} exposants. Les insights apparaîtront progressivement (~${Math.ceil(regs.length * 1.5 / 60)} min).` });
    }

    // ---- AI-powered email generation (Claude Sonnet 4.5 via Emergent LLM proxy) ----
    if (route === 'mailing/generate-ai') {
      const { mail_type, registration_ids, tone = 'professionnel chaleureux', custom_instruction = '', preview_only = true } = body;
      if (!process.env.EMERGENT_LLM_KEY) return err('Clé Emergent LLM non configurée', 500);
      if (!mail_type) return err('mail_type requis', 400);

      const regs = registration_ids?.length
        ? await db.collection('registrations').find({ id: { $in: registration_ids } }).toArray()
        : [];
      const orgIds = [...new Set(regs.map(r => r.organization_id))];
      const orgs = await db.collection('organizations').find({ id: { $in: orgIds } }).toArray();
      const venueIds = [...new Set(regs.map(r => r.venue_id))];
      const venues = await db.collection('venues').find({ id: { $in: venueIds } }).toArray();
      const orgById = Object.fromEntries(orgs.map(o => [o.id, o]));
      const venueById = Object.fromEntries(venues.map(v => [v.id, v]));

      // Context — first registration used for sample generation
      let contextDescription = '';
      if (regs.length === 1) {
        const r = regs[0]; const o = orgById[r.organization_id]; const v = venueById[r.venue_id];
        contextDescription = `Destinataire unique : ${o?.name} (${o?.discipline}), contact ${o?.contact_name || 'responsable'}.
Site : ${v?.name}, stand ${r.stand_code || 'non attribué'}.
Statut du dossier : ${r.status}. Complétion : ${r.completion_percent || 0}%.
Documents : assurance ${r.is_insurance_uploaded ? 'OK' : 'manquante'}, convention ${r.is_convention_signed ? 'OK' : 'non signée'}, caution ${r.is_deposit_received ? 'reçue' : 'non reçue'}.`;
      } else if (regs.length > 1) {
        contextDescription = `Mail groupé à ${regs.length} exposants (exemples : ${regs.slice(0, 3).map(r => orgById[r.organization_id]?.name).join(', ')}...).
Utilise [[NOM_EXPOSANT]], [[STAND]], [[SITE]] comme variables de personnalisation.`;
      } else {
        contextDescription = 'Mail à personnaliser — pas de destinataire spécifique encore sélectionné. Utilise des variables [[NOM_EXPOSANT]], [[STAND]], [[SITE]].';
      }

      const MAIL_TYPES = {
        relance_caution: 'Relance pour la caution de 20 000 XPF non reçue',
        relance_convention: 'Relance pour la convention de participation non signée',
        relance_assurance: "Relance pour l'attestation d'assurance manquante",
        relance_generale: 'Relance générale pour dossier incomplet',
        confirmation: 'Confirmation officielle de participation',
        invitation_inscription: 'Invitation à compléter son inscription',
        invitation_satisfaction: 'Invitation à remplir le questionnaire de satisfaction post-événement',
        remerciement: 'Remerciement post-événement',
        info_pratique: 'Informations pratiques (horaires, logistique, accès site)',
        annonce: 'Annonce ou information générale',
      };
      const typeLabel = MAIL_TYPES[mail_type] || mail_type;
      const defaultAction = mailTypeToDefaultAction(mail_type);
      const defaultActionLabel = EXPOSANT_ACTIONS[defaultAction]?.label || 'Accéder à mon espace';

      const systemPrompt = `Tu es un assistant rédactionnel expert pour ARACOM, l'organisateur du Forum de la Rentrée 2026 en Polynésie française.
Ton rôle : rédiger des emails professionnels en français à destination d'associations sportives et culturelles (exposants du forum).
Contexte de l'événement :
- Forum de la Rentrée 2026, vendredi 14 & samedi 15 août 2026
- 6 sites simultanés en Polynésie française (Faa'a, Punaauia, Arue, Taravao, Mahina, Moorea)
- 66 associations inscrites, 67 stands
- Caution de 20 000 XPF par exposant requise
- Organisé par ARACOM, en partenariat avec Pacific Centers

Ton style : ${tone}. Le français doit être soigné, chaleureux mais professionnel. Utilise le vouvoiement. Signe toujours "L'équipe ARACOM".
Le HTML doit être propre et inline (email-compatible) : <p>, <b>, <a>, <ul>/<li>, pas de CSS externe.
Tu peux utiliser des variables [[NOM_EXPOSANT]], [[DISCIPLINE]], [[STAND]], [[SITE]], [[CONTACT_NAME]] pour la personnalisation.

🛡️ RÈGLE ABSOLUE — BOUTONS ET LIENS (NON NÉGOCIABLE) :
Tu n'as le droit d'utiliser QUE les placeholders ci-dessous comme href. AUCUN AUTRE LIEN N'EST AUTORISÉ.
Tout lien hors de cette liste sera SUPPRIMÉ automatiquement par le serveur (texte conservé seul, sans bouton).
Tu n'as PAS le droit d'inventer une URL, un mailto, un domaine, un site, ou un bouton qui ne correspond à AUCUNE des actions ci-dessous.

Liste exhaustive des href autorisés (chacun mène à la bonne page de l'espace exposant) :
- href="[[MON_ESPACE]]"              → page d'accueil de l'espace exposant (général)
- href="[[MON_ESPACE_PROFIL]]"       → onglet Profil de l'exposant
- href="[[MON_ESPACE_SITES]]"        → onglet Choix des sites (Tahiti / Moorea / Bora-Bora…)
- href="[[MON_ESPACE_ANIMATION]]"    → onglet Détail de l'animation proposée
- href="[[MON_ESPACE_DOCS]]"         → onglet Documents (assurance, convention, caution, RIB)
- href="[[MON_ESPACE_ASSURANCE]]"    → onglet Documents — focus attestation d'assurance
- href="[[MON_ESPACE_CONVENTION]]"   → onglet Documents — focus convention signée
- href="[[MON_ESPACE_CAUTION]]"      → onglet Documents — focus caution 20 000 XPF
- href="[[MON_ESPACE_LOGISTIQUE]]"   → onglet Logistique (mobilier, électricité, parking, hébergement)
- href="[[MON_ESPACE_SATISFACTION]]" → onglet Questionnaire satisfaction post-événement
- href="[[MON_ESPACE_GUIDE]]"        → onglet Guide pratique du Forum

INTERDICTIONS FORMELLES :
❌ Pas de href="mailto:..." (sauf le footer auto qui est ajouté par le serveur, ne le mets pas toi-même).
❌ Pas de href="https://aracom.pf" ou autre site externe inventé.
❌ Pas de href="#" ou href="" (boutons vides).
❌ Pas de bouton sans correspondance avec une action concrète. Si tu n'as pas d'action utile, n'ajoute PAS de bouton, écris simplement le texte.

Choisis le placeholder selon le contexte du mail (par exemple : relance assurance → [[MON_ESPACE_ASSURANCE]] ; relance caution → [[MON_ESPACE_CAUTION]] ; satisfaction → [[MON_ESPACE_SATISFACTION]] ; mail générique → [[MON_ESPACE]]).

Tu retournes UNIQUEMENT un JSON valide de la forme : {"subject": "...", "body_html": "..."}
Pas de markdown, pas de backticks, pas d'explication, juste le JSON.`;

      const userPrompt = `Rédige un email de type : **${typeLabel}**.

Contexte du destinataire :
${contextDescription}

${custom_instruction ? `Instructions spécifiques : ${custom_instruction}` : ''}

Contraintes :
- Objet (subject) : court et accrocheur, 60 caractères max.
- Corps (body_html) : 3-5 paragraphes max.
- Pour ce mail (type "${mail_type}"), si tu mets un bouton d'action, utilise OBLIGATOIREMENT le placeholder approprié de la liste autorisée (voir le rappel système). Pour ce type de mail, le placeholder le plus pertinent est : ${defaultAction}.
- Exemple de bouton conforme : <a href="${defaultAction}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:white;text-decoration:none;border-radius:6px;font-weight:600">${defaultActionLabel}</a>
- Si aucune action ne correspond à ce mail, n'ajoute AUCUN bouton (juste le texte).
- N'ajoute pas de footer "Nous contacter" : un footer est ajouté automatiquement par le serveur.
- Termine par "Bien cordialement,<br>L'équipe ARACOM".

Retourne UNIQUEMENT le JSON { "subject": "...", "body_html": "..." }.`;

      const result = await emergentChat({
        model: DEFAULT_MODEL_CLAUDE,
        system: systemPrompt,
        user: userPrompt,
        max_tokens: 2000,
        temperature: 0.7,
      });
      if (!result.ok) {
        console.error('Emergent LLM error:', result.error);
        return err('Erreur IA : ' + (result.error || 'inconnue'), 500);
      }
      const text = result.text || '';
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) return err('Réponse IA invalide : ' + text.slice(0, 200), 500);
      let parsed;
      try { parsed = JSON.parse(match[0]); } catch { return err('JSON invalide dans la réponse IA', 500); }
      const cleanedBodyHtml = sanitizeEmailHtml(parsed.body_html || '');
      return json({ ok: true, mail_type, subject: parsed.subject, body_html: cleanedBodyHtml, target_count: regs.length, usage: result.usage, llm_source: result.source || 'unknown' });
    }

    // ---- Send a composed email to selected registrations (Gmail SMTP if configured, else mocked) ----
    if (route === 'mailing/send') {
      const { subject, body_html, registration_ids, mail_type } = body;
      if (!subject || !body_html) return err('subject et body_html requis', 400);
      if (!registration_ids?.length) return err('registration_ids requis', 400);
      // 🛡️ Always sanitize mailto links before sending (replaces hallucinated addresses by agence@aracom-conseil.fr)
      const sanitizedBodyHtml = sanitizeEmailHtml(body_html);
      const mailCfg = await getMailConfig(db);
      const regs = await db.collection('registrations').find({ id: { $in: registration_ids } }).toArray();
      const orgs = await db.collection('organizations').find({ id: { $in: regs.map(r => r.organization_id) } }).toArray();
      const venues = await db.collection('venues').find({ id: { $in: regs.map(r => r.venue_id) } }).toArray();
      const orgById = Object.fromEntries(orgs.map(o => [o.id, o]));
      const venueById = Object.fromEntries(venues.map(v => [v.id, v]));

      const smtpReady = isSmtpConfigured();
      const campaignId = uuid();
      await db.collection('email_campaigns').insertOne({
        id: campaignId, edition_id: EDITION_ID,
        name: `IA — ${mail_type || 'custom'} — ${new Date().toISOString().slice(0,16)}`,
        template: mail_type || 'ai_custom',
        status: smtpReady ? 'envoyee' : 'envoyee_mock',
        target_filter: { registration_ids },
        sent_count: 0, opened_count: 0, clicked_count: 0,
        created_at: new Date(), updated_at: new Date(),
      });
      let sent = 0;
      let failed = 0;
      let redirected_count = 0;
      const redirected_originals = [];
      const errors = [];
      for (const r of regs) {
        const o = orgById[r.organization_id];
        const v = venueById[r.venue_id];
        if (!o?.main_email) continue;
        // 🔗 Get-or-create permanent magic link to exposant's space (replaces mailto: which fails on Safari/iCloud)
        const accessUrl = await getOrCreateExposantAccessUrl(db, o.id, o.main_email, request);
        const personalizedSubject = subject
          .replaceAll('[[NOM_EXPOSANT]]', o.name || '')
          .replaceAll('[[DISCIPLINE]]', o.discipline || '')
          .replaceAll('[[STAND]]', r.stand_code || '')
          .replaceAll('[[SITE]]', v?.name || '')
          .replaceAll('[[CONTACT_NAME]]', o.contact_name || '');
        let personalizedBody = sanitizedBodyHtml
          .replaceAll('[[NOM_EXPOSANT]]', o.name || '')
          .replaceAll('[[DISCIPLINE]]', o.discipline || '')
          .replaceAll('[[STAND]]', r.stand_code || '')
          .replaceAll('[[SITE]]', v?.name || '')
          .replaceAll('[[CONTACT_NAME]]', o.contact_name || '');
        // 🔗 Resolve action placeholders ([[MON_ESPACE]], [[MON_ESPACE_DOCS]], etc.) to real magic-link URLs
        personalizedBody = expandActionPlaceholders(personalizedBody, accessUrl);
        // 🔗 Replace any remaining mailto:agence@aracom-conseil.fr with the personal access URL
        // and append a fallback footer (mailto + raw URL) so users can always reach us.
        personalizedBody = replaceContactWithAccessLink(personalizedBody, accessUrl);
        // 🛡️ STRICT GUARD : reject any link the AI may have hallucinated outside our whitelist
        personalizedBody = guardLinks(personalizedBody, accessUrl);

        const messageId = uuid();
        const trackedBody = injectTracking(personalizedBody, messageId, getPublicBaseUrl(request));

        let sendStatus = 'envoye';
        let providerId = `mock_${messageId}`;
        let errorMsg = null;
        if (smtpReady) {
          const r2 = await sendMail({
            to: o.main_email,
            subject: personalizedSubject,
            html: trackedBody,
            testModeOverride: mailCfg.test_mode,
            redirectToOverride: mailCfg.redirect_to,
            allowListOverride: mailCfg.allow_list,
          });
          if (r2.ok) {
            providerId = r2.messageId || providerId;
            if (r2.redirected_from) {
              redirected_count++;
              if (redirected_originals.length < 50) redirected_originals.push(r2.redirected_from);
            }
          } else {
            sendStatus = 'echec';
            errorMsg = r2.error;
            failed++;
            errors.push({ to: o.main_email, error: r2.error });
          }
        }

        await db.collection('email_messages').insertOne({
          id: messageId, campaign_id: campaignId, registration_id: r.id,
          to_email: o.main_email, subject: personalizedSubject, body_html: trackedBody,
          send_status: sendStatus, sent_at: new Date(),
          opened_at: null, clicked_at: null, response_status: 'attente',
          provider_message_id: providerId,
          error_message: errorMsg,
          created_at: new Date(), updated_at: new Date(),
        });
        if (sendStatus === 'envoye') sent++;
      }
      await db.collection('email_campaigns').updateOne({ id: campaignId }, { $set: { sent_count: sent, updated_at: new Date() } });
      return json({
        ok: true,
        sent,
        failed,
        smtp_used: smtpReady,
        errors: errors.slice(0, 5),
        campaign_id: campaignId,
        test_mode_active: mailCfg.test_mode,
        redirect_to: mailCfg.test_mode ? mailCfg.redirect_to : null,
        redirected_count,
        redirected_originals: redirected_originals.slice(0, 10),
      });
    }

    // ---- SMTP test endpoint (verifies Gmail SMTP credentials) ----
    if (route === 'mailing/test-smtp') {
      const result = await verifySmtp();
      return json({
        ok: result.ok,
        configured: isSmtpConfigured(),
        host: process.env.SMTP_HOST || null,
        user: process.env.SMTP_USER || null,
        from_email: process.env.SMTP_FROM_EMAIL || null,
        error: result.error || null,
      }); // always 200 — body indicates actual SMTP status
    }

    // ---- Send a real test email via SMTP (admin only) ----
    if (route === 'mailing/send-test') {
      const { to } = body;
      if (!to) return err('to requis', 400);
      if (!isSmtpConfigured()) return err('SMTP non configuré : ajoutez SMTP_PASSWORD (App Password Gmail)', 400);
      const mailCfg = await getMailConfig(db);
      const result = await sendMail({
        to,
        subject: '✅ Test SMTP — Forum de la Rentrée 2026',
        html: `<p>Bonjour,</p><p>Ceci est un email de test envoyé depuis l'application <b>Forum de la Rentrée 2026</b>.</p><p>Si vous recevez ce message, la configuration Gmail SMTP fonctionne parfaitement. 🎉</p><p>Bien cordialement,<br>L'équipe ARACOM</p>`,
        testModeOverride: mailCfg.test_mode,
        redirectToOverride: mailCfg.redirect_to,
        allowListOverride: mailCfg.allow_list,
      });
      return json({
        ...result,
        test_mode_active: mailCfg.test_mode,
        redirect_to: mailCfg.test_mode ? mailCfg.redirect_to : null,
        intended_recipient: to,
      }, result.ok ? 200 : 500);
    }

    // ---- 🛡️ Toggle MAIL TEST MODE (DB-backed, requires admin password) ----
    if (route === 'mailing/toggle-test-mode') {
      const { mode, confirm_password } = body;
      if (!['test', 'production'].includes(mode)) return err('mode requis : "test" ou "production"', 400);
      if (!confirm_password) return err('Mot de passe administrateur requis pour confirmer', 400);
      const ctx = getUserContext(request);
      if (!ctx?.userId) return err('Session admin requise', 401);
      const user = await db.collection('users').findOne({ id: ctx.userId });
      if (!user) return err('Utilisateur introuvable', 404);
      if (user.role_code !== 'aracom_admin') return err('Réservé aux administrateurs ARACOM', 403);
      if (String(user.password) !== String(confirm_password)) return err('Mot de passe incorrect', 401);
      const newTestMode = mode === 'test';
      const cfg = await getMailConfig(db);
      await db.collection('app_settings').updateOne(
        { key: 'mail_config' },
        {
          $set: {
            key: 'mail_config',
            test_mode: newTestMode,
            redirect_to: cfg.redirect_to,
            allow_list: cfg.allow_list,
            updated_at: new Date(),
            updated_by: user.email,
          },
        },
        { upsert: true }
      );
      invalidateMailConfigCache();
      // Audit log
      await db.collection('audit_logs').insertOne({
        id: uuid(),
        action: 'mail_test_mode_toggle',
        actor_email: user.email,
        details: { from_mode: cfg.test_mode ? 'test' : 'production', to_mode: mode },
        created_at: new Date(),
      });
      return json({
        ok: true,
        test_mode_active: newTestMode,
        message: newTestMode
          ? '🛡️ Mode TEST activé — Tous les emails sont à nouveau interceptés.'
          : '⚠️ Mode PRODUCTION activé — Les emails partiront RÉELLEMENT vers les destinataires.',
        updated_by: user.email,
        updated_at: new Date(),
      });
    }

    // ---- Send satisfaction survey invitation campaign (mocked) ----
    if (route === 'emails/send-satisfaction') {
      const regs = await db.collection('registrations').find({ edition_id: EDITION_ID, status: { $in: ['confirme', 'a_confirmer', 'a_relancer'] } }).toArray();
      const orgIds = [...new Set(regs.map(r => r.organization_id))];
      const orgs = await db.collection('organizations').find({ id: { $in: orgIds } }).toArray();
      const orgById = Object.fromEntries(orgs.map(o => [o.id, o]));

      const campaignId = uuid();
      await db.collection('email_campaigns').insertOne({
        id: campaignId, edition_id: EDITION_ID,
        name: 'Questionnaire de satisfaction — Forum 2026',
        template: 'satisfaction_invite', status: 'envoyee',
        target_filter: { status: ['confirme','a_confirmer','a_relancer'] },
        sent_count: 0, opened_count: 0, clicked_count: 0,
        created_at: new Date(), updated_at: new Date(),
      });
      let sent = 0;
      for (const r of regs) {
        const org = orgById[r.organization_id];
        if (!org?.main_email) continue;
        await db.collection('email_messages').insertOne({
          id: uuid(), campaign_id: campaignId, registration_id: r.id,
          to_email: org.main_email,
          subject: '📝 Votre retour sur le Forum de la Rentrée 2026',
          body_html: `<p>Bonjour ${org.contact_name || ''},</p><p>Merci d'avoir participé au Forum de la Rentrée 2026 !</p><p>Votre avis nous est précieux pour améliorer les prochaines éditions. Merci de prendre 2 minutes pour remplir ce court questionnaire.</p><p><a href="${getPublicBaseUrl(request)}/exposant?tab=satisfaction" style="background:#10b981;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block">Donner mon avis →</a></p><p>Merci encore et à l'année prochaine !<br>L'équipe ARACOM</p>`,
          send_status: 'envoye', sent_at: new Date(),
          opened_at: null, clicked_at: null, response_status: 'attente',
          provider_message_id: `mock_${uuid()}`,
          created_at: new Date(), updated_at: new Date(),
        });
        sent++;
      }
      await db.collection('email_campaigns').updateOne({ id: campaignId }, { $set: { sent_count: sent, updated_at: new Date() } });
      return json({ ok: true, sent, campaign_id: campaignId });
    }

    if (route.match(/^registrations\/[^/]+\/confirm$/)) {
      const regId = p[1];
      const reg = await db.collection('registrations').findOne({ id: regId });
      if (!reg) return err('Introuvable', 404);
      await db.collection('registrations').updateOne({ id: regId }, { $set: { status: 'confirme', completion_percent: Math.max(reg.completion_percent || 0, 60), updated_at: new Date() } });
      // Auto-send confirmation email (mocked)
      const org = await db.collection('organizations').findOne({ id: reg.organization_id });
      if (org?.main_email) {
        await db.collection('email_messages').insertOne({
          id: uuid(), campaign_id: null, registration_id: regId,
          to_email: org.main_email, subject: 'Confirmation de votre inscription - Forum de la Rentrée 2026',
          body_html: `<p>Bonjour,</p><p>Votre inscription au Forum de la Rentrée 2026 est confirmée. Stand ${reg.stand_code}.</p><p>Merci de déposer votre caution de 20 000 XPF.</p>`,
          send_status: 'envoye', sent_at: new Date(),
          opened_at: null, clicked_at: null, response_status: 'attente',
          provider_message_id: `mock_${uuid()}`,
          created_at: new Date(), updated_at: new Date(),
        });
      }
      await logActivity(db, ctx.userId, 'registration', regId, 'confirm', null, { status: 'confirme' });
      return json({ ok: true });
    }

    if (route === 'organizations') {
      // Create new organization + registration (ARACOM from Nouveau exposant OR self-register)
      const orgId = body.organization_id || `org-${uuid()}`;
      const existing = body.organization_id ? await db.collection('organizations').findOne({ id: body.organization_id }) : null;
      if (!existing) {
        await db.collection('organizations').insertOne({
          id: orgId,
          name: body.name,
          discipline: body.discipline || 'Autre',
          priority_level: body.priority_level || 'prospect',
          main_email: body.email || null,
          main_phone: body.phone || null,
          contact_name: body.contact_name || null,
          notes: body.notes || null,
          source_origin: body.source || 'aracom_manual',
          created_at: new Date(), updated_at: new Date(),
        });
      }
      // Create user account for exposant if email provided
      if (body.email) {
        const existingUser = await db.collection('users').findOne({ email: body.email.toLowerCase().trim() });
        if (!existingUser) {
          await db.collection('users').insertOne({
            id: `u-exp-${orgId}`, email: body.email.toLowerCase().trim(),
            full_name: body.contact_name || body.name,
            phone: body.phone, role_id: 'role-exposant', role_code: 'exposant',
            password: body.password || 'forum2026',
            organization_id: orgId, is_active: true,
            password_changed: false,
            created_at: new Date(), updated_at: new Date(),
          });
        }
      }
      // Optionally create a registration
      let registration = null;
      if (body.create_registration !== false) {
        const regId = `reg-${orgId}`;
        const existingReg = await db.collection('registrations').findOne({ id: regId });
        if (!existingReg) {
          registration = {
            id: regId, edition_id: EDITION_ID, organization_id: orgId,
            venue_id: body.venue_id || null, status: body.status || 'prospect',
            animation_type: body.animation_type || null,
            friday_slot_label: null, saturday_slot_label: null,
            stand_needed: true, completion_percent: 10,
            is_convention_signed: false, is_deposit_required: true, is_deposit_received: false,
            is_insurance_uploaded: false, is_guide_sent: false,
            planned_arrival_time: '10:30', planned_departure_time: '17:00',
            post_event_status: 'en_attente', post_event_summary: null,
            internal_notes: null, stand_code: body.stand_code || null,
            exposant_notes: null,
            created_at: new Date(), updated_at: new Date(),
          };
          await db.collection('registrations').insertOne(registration);
          await db.collection('deposit_transactions').insertOne({
            id: uuid(), registration_id: regId, amount_xpf: 20000,
            status: 'non_demandee', payment_method: null,
            received_at: null, expected_return_date: '2026-08-30', returned_at: null,
            retained_reason: null, retained_amount_xpf: 0, receipt_document_id: null,
            post_event_review_status: 'non_revu', post_event_review_comment: null,
            recommended_return_amount_xpf: 20000, notes: null,
            created_at: new Date(), updated_at: new Date(),
          });
          delete registration._id;
        }
      }
      await logActivity(db, ctx.userId, 'organization', orgId, 'create', null, { name: body.name });
      return json({ ok: true, organization_id: orgId, registration }, 201);
    }

    if (route === 'auth/register') {
      // 🛡️ DÉSACTIVÉ depuis avril 2026 — l'auto-inscription a été supprimée pour
      // garantir un suivi strict des dossiers. Seul ARACOM peut créer un compte
      // exposant via le portail admin (1-clic "Créer & inviter exposant").
      return err('Inscription publique désactivée. Contactez ARACOM à agence@aracom-conseil.fr pour rejoindre le Forum.', 403);
    }
    if (route === 'auth/register__deprecated_unreachable') {
      // Self-service exposant registration (from landing page)
      const { email, password, name, discipline, phone, contact_name } = body;
      if (!email || !password || !name) return err('Email, mot de passe et nom requis', 400);
      const existing = await db.collection('users').findOne({ email: email.toLowerCase().trim() });
      if (existing) return err('Cet email est déjà inscrit', 409);
      const orgId = `org-${uuid()}`;
      await db.collection('organizations').insertOne({
        id: orgId, name, discipline: discipline || 'Autre', priority_level: 'prospect',
        main_email: email, main_phone: phone || null, contact_name: contact_name || name,
        notes: null, source_origin: 'self_register',
        created_at: new Date(), updated_at: new Date(),
      });
      const userId = `u-exp-${orgId}`;
      await db.collection('users').insertOne({
        id: userId, email: email.toLowerCase().trim(),
        full_name: contact_name || name, phone: phone || null,
        role_id: 'role-exposant', role_code: 'exposant',
        password, organization_id: orgId, is_active: true,
        password_changed: true,
        created_at: new Date(), updated_at: new Date(),
      });
      const regId = `reg-${orgId}`;
      await db.collection('registrations').insertOne({
        id: regId, edition_id: EDITION_ID, organization_id: orgId,
        venue_id: null, status: 'prospect',
        animation_type: null,
        stand_needed: true, completion_percent: 10,
        is_convention_signed: false, is_deposit_required: true, is_deposit_received: false,
        is_insurance_uploaded: false, is_guide_sent: false,
        planned_arrival_time: '10:30', planned_departure_time: '17:00',
        post_event_status: 'en_attente', internal_notes: null, stand_code: null,
        exposant_notes: null,
        created_at: new Date(), updated_at: new Date(),
      });
      await db.collection('deposit_transactions').insertOne({
        id: uuid(), registration_id: regId, amount_xpf: 20000,
        status: 'non_demandee', expected_return_date: '2026-08-30',
        retained_amount_xpf: 0, recommended_return_amount_xpf: 20000,
        post_event_review_status: 'non_revu',
        created_at: new Date(), updated_at: new Date(),
      });
      const user = await db.collection('users').findOne({ id: userId });
      delete user.password; delete user._id;
      return json({ user }, 201);
    }

    // ============ TOOL : Reset DB to clean test state (admin only) ============
    // Wipes all "live" data (orgs, registrations, tokens, mailing, documents, validations…)
    // KEEPS : venues, animation_slots templates, users admin/pacific, roles
    if (route === 'tools/reset-db') {
      if (ctx.role !== 'aracom_admin') return err('Accès admin requis', 403);
      // 🛡️ Garde-fou supplémentaire : requiert une phrase de confirmation explicite
      if (body?.confirm !== 'JE-VEUX-VRAIMENT-EFFACER-TOUTES-LES-DONNEES') {
        return err('Pour exécuter ce reset, envoyez { "confirm": "JE-VEUX-VRAIMENT-EFFACER-TOUTES-LES-DONNEES" } dans le body. Cette protection évite les déclenchements accidentels.', 400);
      }
      const KEEP_USERS = ['u-admin', 'u-teva', 'u-agence', 'u-pc'];
      const stats = {};
      const COLLECTIONS_TO_WIPE = [
        'organizations', 'organization_contacts', 'organization_history', 'organization_preferences',
        'registrations', 'stand_assignments', 'registration_documents', 'deposit_transactions',
        'access_tokens', 'email_campaigns', 'email_messages', 'tasks_or_followups',
        'attendance_sessions', 'attendance_events', 'registration_anomalies',
        'field_comments', 'field_media', 'post_event_reports', 'activity_logs',
        'validation_requests', 'push_subscriptions', 'satisfaction_surveys', 'satisfaction_responses',
        'backups',
      ];
      for (const c of COLLECTIONS_TO_WIPE) {
        const r = await db.collection(c).deleteMany({});
        if (r.deletedCount > 0) stats[c] = r.deletedCount;
      }
      const u = await db.collection('users').deleteMany({ id: { $nin: KEEP_USERS }, role_code: { $ne: 'aracom_admin' } });
      stats.users_removed = u.deletedCount;
      const s = await db.collection('venue_stands').updateMany({}, {
        $set: { status: 'libre', updated_at: new Date() },
        $unset: { reserved_for: '', reserved_at: '', confirmed_for: '' },
      });
      stats.venue_stands_freed = s.modifiedCount;
      const ve = await db.collection('venue_elements').deleteMany({});
      stats.venue_elements_removed = ve.deletedCount;
      await logActivity(db, ctx.userId, 'system', 'reset', 'reset_db', null, stats);
      return json({ ok: true, message: 'Base de données réinitialisée — vous pouvez tester en mode propre', stats });
    }

    // ============ TOOL : Ensure ARACOM admin accounts (idempotent, no auth) ============
    // Used after deploys to (re)create the deterministic admin accounts with a known password.
    // Safe: only manages 3 specific emails. Default password = "Projetaracom12".
    if (route === 'tools/ensure-admins') {
      const PASSWORD = body?.password || 'Projetaracom12';
      const TARGETS = [
        { id: 'u-admin', email: 'admin@aracom.pf', full_name: 'ARACOM Admin' },
        { id: 'u-teva', email: 'teva.geros@aracom-conseil.fr', full_name: 'Teva Geros' },
        { id: 'u-agence', email: 'agence@aracom-conseil.fr', full_name: 'Agence ARACOM' },
      ];
      const out = [];
      for (const t of TARGETS) {
        const existing = await db.collection('users').findOne({ email: t.email.toLowerCase() });
        if (existing) {
          await db.collection('users').updateOne({ id: existing.id }, {
            $set: { password: PASSWORD, role_id: 'role-admin', role_code: 'aracom_admin', is_active: true, full_name: existing.full_name || t.full_name, updated_at: new Date() }
          });
          out.push({ email: t.email, action: 'updated', id: existing.id });
        } else {
          await db.collection('users').insertOne({
            id: t.id, email: t.email.toLowerCase(), full_name: t.full_name,
            phone: null, role_id: 'role-admin', role_code: 'aracom_admin', password: PASSWORD,
            is_active: true, created_at: new Date(), updated_at: new Date(),
          });
          out.push({ email: t.email, action: 'created', id: t.id });
        }
      }
      return json({ ok: true, password: PASSWORD, accounts: out });
    }

    if (route === 'auth/change-password') {
      const { current_password, new_password, target_user_id, target_email } = body;
      if (!new_password) return err('Nouveau mot de passe requis', 400);
      // Admin resets without needing current password (by id OR email)
      if (ctx.role === 'aracom_admin' && (target_user_id || target_email)) {
        const q = target_user_id ? { id: target_user_id } : { email: (target_email || '').toLowerCase().trim() };
        const r = await db.collection('users').updateOne(q, { $set: { password: new_password, password_changed: false, updated_at: new Date() } });
        if (r.matchedCount === 0) return err('Utilisateur cible introuvable', 404);
        await logActivity(db, ctx.userId, 'user', target_user_id || target_email, 'password_reset_by_admin', null, null);
        return json({ ok: true, matched: r.matchedCount, modified: r.modifiedCount });
      }
      if (!ctx.userId) return err('Non authentifié', 401);
      const user = await db.collection('users').findOne({ id: ctx.userId });
      if (!user) return err('Utilisateur introuvable', 404);
      if (user.password !== current_password) return err('Mot de passe actuel incorrect', 401);
      await db.collection('users').updateOne({ id: ctx.userId }, { $set: { password: new_password, password_changed: true, updated_at: new Date() } });
      return json({ ok: true });
    }

    return err(`Route POST inconnue: ${route}`, 404);
  } catch (e) {
    console.error(e);
    return err(e.message || 'Erreur serveur', 500);
  }
}

export async function PUT(request, { params }) {
  try {
    const db = await getDb();
    const p = params.path || [];
    const route = p.join('/');
    const ctx = getUserContext(request);
    let body = {}; try { body = await request.json(); } catch {}

    if (route.startsWith('organizations/')) {
      if (ctx.role !== 'aracom_admin') return err('Accès admin requis', 403);
      const orgId = p[1];
      const oldOrg = await db.collection('organizations').findOne({ id: orgId });
      if (!oldOrg) return err('Organisation introuvable', 404);
      const orgAllowed = ['name', 'discipline', 'main_email', 'main_phone', 'contact_name', 'notes', 'priority_level', 'status', 'is_mailing_only', 'aracom_private', 'participation_history', 'source_activity'];
      const orgUpd = {};
      for (const k of orgAllowed) if (k in body) orgUpd[k] = body[k];
      orgUpd.updated_at = new Date();
      await db.collection('organizations').updateOne({ id: orgId }, { $set: orgUpd });
      await logActivity(db, ctx.userId, 'organization', orgId, 'update', oldOrg, orgUpd);
      const fresh = await db.collection('organizations').findOne({ id: orgId });
      if (fresh) delete fresh._id;
      return json(fresh);
    }

    if (route.startsWith('registrations/')) {
      const id = p[1];
      const old = await db.collection('registrations').findOne({ id });
      if (!old) return err('Introuvable', 404);
      const allowed = ['status','animation_type','friday_slot_label','saturday_slot_label','stand_needed','is_convention_signed','is_deposit_required','is_deposit_received','is_insurance_uploaded','is_guide_sent','planned_arrival_time','planned_departure_time','post_event_status','post_event_summary','internal_notes','exposant_notes','venue_id','stand_code','completion_percent'];
      const upd = {};
      for (const k of allowed) if (k in body) upd[k] = body[k];
      upd.updated_at = new Date();
      await db.collection('registrations').updateOne({ id }, { $set: upd });
      await logActivity(db, ctx.userId, 'registration', id, 'update', old, upd);
      const reg = await db.collection('registrations').findOne({ id });
      delete reg._id;
      return json(reg);
    }

    if (route.startsWith('deposits/')) {
      const id = p[1];
      const allowed = ['status','payment_method','received_at','returned_at','retained_reason','retained_amount_xpf','post_event_review_status','post_event_review_comment','recommended_return_amount_xpf','notes'];
      const upd = {};
      for (const k of allowed) if (k in body) upd[k] = body[k];
      upd.updated_at = new Date();
      // Also set received_at if status is recue and not set
      if (upd.status === 'recue' && !upd.received_at) upd.received_at = new Date();
      // 🔁 Upsert intelligent : si aucun deposit trouvé par id, traite l'id comme un registration_id.
      //    Cela permet à l'UI de ne passer que la registration_id (absence d'ID de deposit dans /api/registrations).
      let dep = await db.collection('deposit_transactions').findOne({ id });
      if (!dep) {
        dep = await db.collection('deposit_transactions').findOne({ registration_id: id });
        if (!dep) {
          const newId = uuid();
          await db.collection('deposit_transactions').insertOne({
            id: newId,
            registration_id: id,
            amount_xpf: 20000,
            status: upd.status || 'non_demandee',
            payment_method: upd.payment_method || null,
            received_at: upd.status === 'recue' ? (upd.received_at || new Date()) : null,
            created_at: new Date(),
            updated_at: new Date(),
          });
          dep = await db.collection('deposit_transactions').findOne({ id: newId });
        } else {
          await db.collection('deposit_transactions').updateOne({ id: dep.id }, { $set: upd });
        }
      } else {
        await db.collection('deposit_transactions').updateOne({ id: dep.id }, { $set: upd });
      }
      // Sync is_deposit_received on registration
      if (upd.status) {
        const refreshed = await db.collection('deposit_transactions').findOne({ id: dep.id });
        await db.collection('registrations').updateOne({ id: refreshed.registration_id }, { $set: { is_deposit_received: upd.status === 'recue', updated_at: new Date() } });
      }
      const out = await db.collection('deposit_transactions').findOne({ id: dep.id });
      delete out._id;
      return json(out);
    }

    if (route.startsWith('anomalies/')) {
      const id = p[1];
      const allowed = ['resolved_status','resolution_comment','recommended_deposit_action','severity_level'];
      const upd = {}; for (const k of allowed) if (k in body) upd[k] = body[k];
      if (upd.resolved_status && upd.resolved_status !== 'ouvert') { upd.resolved_at = new Date(); upd.resolved_by = ctx.userId || 'u-admin'; }
      upd.updated_at = new Date();
      await db.collection('registration_anomalies').updateOne({ id }, { $set: upd });
      const a = await db.collection('registration_anomalies').findOne({ id }); delete a._id;
      return json(a);
    }

    if (route.startsWith('attendance-sessions/')) {
      const id = p[1];
      const allowed = ['actual_arrival_time','actual_departure_time','presence_status','is_animation_completed','arrival_stand_condition','departure_stand_condition','final_day_status'];
      const upd = {}; for (const k of allowed) if (k in body) upd[k] = body[k];
      upd.updated_at = new Date();
      await db.collection('attendance_sessions').updateOne({ id }, { $set: upd });
      const s = await db.collection('attendance_sessions').findOne({ id }); delete s._id;
      return json(s);
    }

    if (route.startsWith('reports/')) {
      const id = p[1];
      const allowed = ['report_status','report_data_json','validated_at','validated_by','shared_with_pacific','pacific_share_note'];
      const upd = {}; for (const k of allowed) if (k in body) upd[k] = body[k];
      if (upd.report_status === 'valide') { upd.validated_at = new Date(); upd.validated_by = ctx.userId || 'u-admin'; }
      if ('shared_with_pacific' in upd) {
        upd.shared_with_pacific_at = upd.shared_with_pacific ? new Date() : null;
        upd.shared_with_pacific_by = upd.shared_with_pacific ? (ctx.userId || 'u-admin') : null;
      }
      upd.updated_at = new Date();
      await db.collection('post_event_reports').updateOne({ id }, { $set: upd });
      const r = await db.collection('post_event_reports').findOne({ id }); delete r._id;
      return json(r);
    }

    if (route.startsWith('tasks/')) {
      const id = p[1];
      const allowed = ['status','title','due_date','assigned_to','notes','task_type'];
      const upd = {}; for (const k of allowed) if (k in body) upd[k] = body[k];
      if (upd.status === 'termine') upd.completed_at = new Date();
      upd.updated_at = new Date();
      await db.collection('tasks_or_followups').updateOne({ id }, { $set: upd });
      const t = await db.collection('tasks_or_followups').findOne({ id }); delete t._id;
      return json(t);
    }

    if (route.startsWith('documents/')) {
      const id = p[1];
      const allowed = ['status','notes','document_type'];
      const upd = {}; for (const k of allowed) if (k in body) upd[k] = body[k];
      if (upd.status === 'valide') upd.validated_at = new Date();
      upd.updated_at = new Date();
      await db.collection('registration_documents').updateOne({ id }, { $set: upd });
      const d = await db.collection('registration_documents').findOne({ id }, { projection: { file_data: 0 } }); delete d._id;
      return json(d);
    }

    if (route.startsWith('animation-slots/')) {
      const id = p[1];
      const allowed = ['day_label','event_date','start_time','end_time','duration_minutes','title','description','slot_type','location_type','status','notes','venue_id'];
      const upd = {}; for (const k of allowed) if (k in body) upd[k] = body[k];

      // 🆕 Validation amplitude horaires (cohérence avec les créneaux exposants)
      // Vendredi 11h→17h · Samedi 9h→17h
      const existing = await db.collection('animation_slots').findOne({ id });
      if (!existing) return err('Créneau introuvable', 404);
      const dayLabel = upd.day_label || existing.day_label || 'vendredi';
      const startTime = upd.start_time || existing.start_time;
      const endTime = upd.end_time || existing.end_time;
      if (startTime && endTime) {
        const dayBounds = dayLabel === 'vendredi'
          ? { open: '11:00', close: '17:00' }
          : { open: '09:00', close: '17:00' };
        if (startTime < dayBounds.open) {
          return err(`Horaire invalide : le ${dayLabel} commence à ${dayBounds.open}. Début demandé : ${startTime}`, 400);
        }
        if (endTime > dayBounds.close) {
          return err(`Horaire invalide : le ${dayLabel} se termine à ${dayBounds.close}. Fin demandée : ${endTime}`, 400);
        }
        if (startTime >= endTime) {
          return err(`Horaire invalide : l'heure de fin (${endTime}) doit être après le début (${startTime})`, 400);
        }
      }

      upd.updated_at = new Date();
      await db.collection('animation_slots').updateOne({ id }, { $set: upd });
      const s = await db.collection('animation_slots').findOne({ id }); delete s._id;
      return json(s);
    }

    // PUT /prospects/:id — mise à jour d'un prospect
    if (route.startsWith('prospects/')) {
      const id = p[1];
      const allowed = ['venue_id','organization_name','contact_name','contact_email','contact_phone','discipline','status'];
      const upd = {}; for (const k of allowed) if (k in body) upd[k] = body[k];
      if (upd.contact_email) upd.contact_email = upd.contact_email.toLowerCase();
      upd.updated_at = new Date();
      await db.collection('prospects').updateOne({ id }, { $set: upd });
      const out = await db.collection('prospects').findOne({ id }); delete out._id;
      return json(out);
    }

    return err(`Route PUT inconnue: ${route}`, 404);
  } catch (e) {
    console.error(e);
    return err(e.message || 'Erreur serveur', 500);
  }
}

export async function DELETE(request, { params }) {
  try {
    const db = await getDb();
    const p = params.path || [];
    const route = p.join('/');
    if (route.startsWith('registrations/')) {
      await db.collection('registrations').deleteOne({ id: p[1] });
      return json({ ok: true });
    }
    if (route.startsWith('documents/')) {
      await db.collection('registration_documents').deleteOne({ id: p[1] });
      return json({ ok: true });
    }
    if (route.startsWith('field-media/')) {
      await db.collection('field_media').deleteOne({ id: p[1] });
      return json({ ok: true });
    }
    // 🗑️ DELETE bilan / rapport (admin only)
    if (route.startsWith('reports/')) {
      const userRole = request.headers.get('x-user-role');
      if (userRole !== 'aracom_admin') return err('Réservé aux admins', 403);
      await db.collection('post_event_reports').deleteOne({ id: p[1] });
      return json({ ok: true });
    }
    if (route.startsWith('tasks/')) {
      await db.collection('tasks_or_followups').deleteOne({ id: p[1] });
      return json({ ok: true });
    }

    // 🔓 DELETE /api/exposant/password — remove password (admin can clear any, exposant can clear own)
    if (route === 'exposant/password') {
      const ctx = getUserContext(request);
      const url2 = new URL(request.url);
      const targetOrgId = url2.searchParams.get('organization_id') && ctx.role === 'aracom_admin'
        ? url2.searchParams.get('organization_id')
        : ctx.organization_id;
      if (!targetOrgId) return err('Organisation requise', 400);
      await db.collection('organizations').updateOne(
        { id: targetOrgId },
        { $unset: { access_password_hash: '', password_set_at: '' }, $set: { updated_at: new Date() } }
      );
      return json({ ok: true, action: 'password_removed' });
    }
    if (route.startsWith('animation-slots/')) {
      const slot = await db.collection('animation_slots').findOne({ id: p[1] });
      if (slot?.is_locked) return err('Ce créneau est verrouillé par ARACOM et ne peut plus être supprimé. Contactez l\'organisateur.', 403);
      await db.collection('animation_slots').deleteOne({ id: p[1] });
      return json({ ok: true });
    }
    if (route.startsWith('mail-templates/')) {
      await db.collection('mail_templates').deleteOne({ id: p[1] });
      return json({ ok: true });
    }
    if (route.startsWith('prospects/')) {
      await db.collection('prospects').deleteOne({ id: p[1] });
      return json({ ok: true });
    }
    if (route.startsWith('official-documents/')) {
      const userRole = request.headers.get('x-user-role');
      if (userRole !== 'aracom_admin') return err('Réservé aux admins', 403);
      const docId = p[1];
      const doc = await db.collection('official_documents').findOne({ id: docId });
      if (!doc) return err('Document introuvable', 404);
      // Désactive plutôt que supprimer (garde la traçabilité dans Drive)
      await db.collection('official_documents').updateOne({ id: docId }, { $set: { active: false, deactivated_at: new Date(), updated_at: new Date() } });
      return json({ ok: true });
    }
    if (route.startsWith('mail-recipient-lists/')) {
      await db.collection('mail_recipient_lists').deleteOne({ id: p[1] });
      return json({ ok: true });
    }
    // 🗑️ Annulation d'un mail programmé (campagne en statut "scheduled")
    if (route.startsWith('mailing/scheduled/')) {
      const campaignId = p[2];
      const camp = await db.collection('email_campaigns').findOne({ id: campaignId });
      if (!camp) return err('Campagne introuvable', 404);
      if (camp.status === 'completed') return err('Campagne déjà envoyée, impossible d\'annuler', 400);
      // Supprimer les messages en attente liés à cette campagne
      await db.collection('email_messages').deleteMany({ campaign_id: campaignId, send_status: { $in: ['pending', 'scheduled'] } });
      // Marquer la campagne comme annulée
      await db.collection('email_campaigns').updateOne(
        { id: campaignId },
        { $set: { status: 'cancelled', cancelled_at: new Date(), cancelled_by: ctx.userId || 'u-admin', updated_at: new Date() } }
      );
      return json({ ok: true, campaign_id: campaignId });
    }
    if (route.startsWith('venue-elements/')) {
      await db.collection('venue_elements').deleteOne({ id: p[1] });
      return json({ ok: true });
    }
    if (route.startsWith('venue-stands/')) {
      const stand = await db.collection('venue_stands').findOne({ id: p[1] });
      if (!stand) return err('Stand introuvable', 404);
      // 🆕 Auto-detach: cancel any active assignment + clear stand_code on linked registrations
      // (le frontend a déjà détaché via assign-stand mais on sécurise au cas où)
      await db.collection('stand_assignments').updateMany(
        { venue_stand_id: stand.id, status: { $ne: 'annule' } },
        { $set: { status: 'annule', updated_at: new Date() } }
      );
      await db.collection('registrations').updateMany(
        { venue_id: stand.venue_id, stand_code: stand.stand_code },
        { $set: { stand_code: null, updated_at: new Date() } }
      );
      await db.collection('venue_stands').deleteOne({ id: p[1] });
      await db.collection('venues').updateOne({ id: stand.venue_id }, { $inc: { capacity_stands: -1 } });
      return json({ ok: true });
    }
    return err('Route DELETE inconnue', 404);
  } catch (e) { return err(e.message, 500); }
}

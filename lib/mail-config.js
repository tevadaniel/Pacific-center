/**
 * Runtime mail config — DB-backed override of env vars.
 * Allows ARACOM admin to toggle MAIL_TEST_MODE on/off from the UI without redeployment.
 *
 * Storage : collection `app_settings`, document with key='mail_config'
 *   { key: 'mail_config', test_mode: boolean, redirect_to: string, allow_list: string[],
 *     simulation_active: boolean, simulation_redirect: string,
 *     updated_at: Date, updated_by: string }
 *
 * If no document exists → fallback to env vars.
 */

let _cache = null;
let _cacheAt = 0;
const CACHE_MS = 5_000; // re-read DB every 5s max

export async function getMailConfig(db) {
  const now = Date.now();
  if (_cache && now - _cacheAt < CACHE_MS) return _cache;
  let dbDoc = null;
  try {
    dbDoc = await db.collection('app_settings').findOne({ key: 'mail_config' });
  } catch {
    // ignore — fallback to env
  }
  const envTestMode = String(process.env.MAIL_TEST_MODE || '').toLowerCase() === 'true';
  const envRedirect = process.env.MAIL_REDIRECT_TO || 'tevageros@me.com';
  const envAllowList = (process.env.MAIL_ALLOWED_RECIPIENTS || '').split(',').map(s => s.trim()).filter(Boolean);
  const config = {
    test_mode: dbDoc?.test_mode !== undefined ? Boolean(dbDoc.test_mode) : envTestMode,
    redirect_to: dbDoc?.redirect_to || envRedirect,
    allow_list: (dbDoc?.allow_list && dbDoc.allow_list.length) ? dbDoc.allow_list : envAllowList,
    // 🆕 SESSION 47 — Simulation E2E : forces all emails to gerosteva@gmail.com with [SIM] prefix
    simulation_active: Boolean(dbDoc?.simulation_active),
    simulation_redirect: dbDoc?.simulation_redirect || 'gerosteva@gmail.com',
    simulation_session_id: dbDoc?.simulation_session_id || null,
    source: dbDoc ? 'database' : 'env',
    updated_at: dbDoc?.updated_at || null,
    updated_by: dbDoc?.updated_by || null,
  };
  _cache = config;
  _cacheAt = now;
  return config;
}

/** Force a refresh on next read. Called after updating the config. */
export function invalidateMailConfigCache() {
  _cache = null;
  _cacheAt = 0;
}

/**
 * 🆕 SESSION 47.11 — Génère ou retrouve un magic link d'accès pour un email
 * Retourne null si l'email ne correspond à aucune organisation/user.
 * Version "light" de getOrCreateExposantAccessUrl (sans dépendances data-integrity).
 */
async function findOrCreateAccessUrlForEmail(db, email) {
  if (!email || !db) return null;
  const normalized = String(email).toLowerCase().trim();
  if (!normalized) return null;
  // 1. Cherche une organisation avec ce main_email
  const org = await db.collection('organizations').findOne({ main_email: normalized });
  if (!org) return null;
  // 2. Cherche un token actif pour cette org
  let tk = await db.collection('access_tokens').findOne(
    { organization_id: org.id, purpose: 'exposant', revoked_at: null },
    { sort: { created_at: -1 } }
  );
  if (!tk) {
    // 3. Crée un nouveau token permanent
    const { v4: uuid } = await import('uuid');
    const tokenStr = uuid().replace(/-/g, '') + uuid().replace(/-/g, '').slice(0, 16);
    const tokenId = uuid();
    const u = await db.collection('users').findOne({ organization_id: org.id, role_code: 'exposant' });
    await db.collection('access_tokens').insertOne({
      id: tokenId,
      token: tokenStr,
      purpose: 'exposant',
      organization_id: org.id,
      user_id: u?.id || null,
      email: normalized,
      label: 'Espace exposant (auto, sendMailAuto)',
      expires_at: null, revoked_at: null,
      last_used_at: null, last_email_sent_at: null,
      use_count: 0,
      created_at: new Date(), updated_at: new Date(),
      created_by: 'mailer_auto',
    });
    tk = { token: tokenStr, id: tokenId };
  }
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://aracompacificcenters.com';
  return `${baseUrl.replace(/\/$/, '')}/access/${tk.token}`;
}

/**
 * 🆕 SESSION 47.11 — Ajoute automatiquement un bouton "Accéder à mon espace personnel"
 * à la fin de chaque mail envoyé à un exposant.
 * Le bouton n'est ajouté que si :
 *   - On a réussi à résoudre un accessUrl pour le destinataire
 *   - Le mail n'en contient PAS déjà un (évite les doublons)
 */
function appendAccessButtonHtml(html, accessUrl) {
  if (!html || !accessUrl) return html;
  // Évite les doublons :
  //  - si l'URL d'accès est déjà dans le body
  //  - si un autre lien /access/ existe déjà (token différent → on n'en rajoute pas un de plus)
  //  - si le texte "espace personnel" ou "espace exposant" est déjà présent
  if (html.includes(accessUrl)) return html;
  if (/\/access\/[a-f0-9]{24,}/i.test(html)) return html;
  const buttonBlock = `
<div style="margin:32px 0 8px;padding:20px;text-align:center;background:linear-gradient(135deg,#eff6ff 0%,#e0e7ff 100%);border-radius:10px;border:1px solid #c7d2fe">
  <p style="margin:0 0 12px;font-size:13px;color:#475569;font-weight:500">Retrouvez toutes vos informations dans votre espace personnel :</p>
  <a href="${accessUrl}" style="display:inline-block;padding:12px 28px;background:linear-gradient(135deg,#2563eb 0%,#7c3aed 100%);color:white;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;box-shadow:0 2px 8px rgba(37,99,235,0.25)">🔐 Accéder à mon espace personnel</a>
  <p style="margin:10px 0 0;font-size:11px;color:#64748b">Lien personnel & sécurisé — aucun mot de passe à retenir</p>
</div>`;
  // Insère avant </body> si présent, sinon à la fin
  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, `${buttonBlock}</body>`);
  }
  return html + buttonBlock;
}

/**
 * 🛡️ Wrapper universel : lit la config DB et appelle sendMail avec les overrides corrects.
 * Garantit que TOUS les mails (RDV caution, magic links, relances, reçus, campaigns)
 * respectent la même source de vérité = la collection app_settings.mail_config.
 * À utiliser PARTOUT dans le code à la place de `sendMail` directement.
 *
 * 🆕 SESSION 47 — SIMULATION : si simulation_active=true, redirige TOUS les emails vers
 * simulation_redirect (gerosteva@gmail.com) avec préfixe [SIM] sur le sujet.
 * Override par-appel possible via opts.forceSimulation = true.
 *
 * 🆕 SESSION 47.11 — BOUTON ESPACE PERSO : ajoute automatiquement un bouton CTA
 * "Accéder à mon espace personnel" à la fin de chaque mail envoyé à un exposant.
 * Opt-out via opts.skipAccessButton = true (pour les mails d'auth qui SONT déjà le lien).
 */
export async function sendMailAuto(opts, db) {
  const { sendMail } = await import('./mailer.js');
  const cfg = await getMailConfig(db);

  // 🆕 SESSION 47.11 — Auto-bouton "Accéder à mon espace personnel"
  let enrichedHtml = opts.html;
  if (opts.html && !opts.skipAccessButton && db && opts.to) {
    try {
      const recipientEmail = Array.isArray(opts.to) ? opts.to[0] : opts.to;
      const accessUrl = await findOrCreateAccessUrlForEmail(db, recipientEmail);
      if (accessUrl) {
        enrichedHtml = appendAccessButtonHtml(opts.html, accessUrl);
      }
    } catch (e) {
      // Non-critique : si la résolution échoue, on envoie le mail original
      console.warn('[sendMailAuto] access button skipped:', e?.message);
    }
  }
  const finalOpts = { ...opts, html: enrichedHtml };

  // Simulation prioritaire sur tout le reste
  if (cfg.simulation_active || finalOpts.forceSimulation) {
    const simSubject = (finalOpts.subject || '').startsWith('[SIM]') ? finalOpts.subject : `[SIM] ${finalOpts.subject || ''}`;
    return sendMail({
      ...finalOpts,
      subject: simSubject,
      testModeOverride: true,
      redirectToOverride: cfg.simulation_redirect || 'gerosteva@gmail.com',
      allowListOverride: [],
    });
  }
  return sendMail({
    ...finalOpts,
    testModeOverride: finalOpts.testModeOverride !== undefined ? finalOpts.testModeOverride : cfg.test_mode,
    redirectToOverride: finalOpts.redirectToOverride || cfg.redirect_to,
    allowListOverride: finalOpts.allowListOverride && finalOpts.allowListOverride.length ? finalOpts.allowListOverride : cfg.allow_list,
  });
}

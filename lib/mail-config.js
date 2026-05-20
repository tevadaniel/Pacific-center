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
 * 🛡️ Wrapper universel : lit la config DB et appelle sendMail avec les overrides corrects.
 * Garantit que TOUS les mails (RDV caution, magic links, relances, reçus, campaigns)
 * respectent la même source de vérité = la collection app_settings.mail_config.
 * À utiliser PARTOUT dans le code à la place de `sendMail` directement.
 *
 * 🆕 SESSION 47 — SIMULATION : si simulation_active=true, redirige TOUS les emails vers
 * simulation_redirect (gerosteva@gmail.com) avec préfixe [SIM] sur le sujet.
 * Override par-appel possible via opts.forceSimulation = true.
 */
export async function sendMailAuto(opts, db) {
  const { sendMail } = await import('./mailer.js');
  const cfg = await getMailConfig(db);
  // Simulation prioritaire sur tout le reste
  if (cfg.simulation_active || opts.forceSimulation) {
    const simSubject = (opts.subject || '').startsWith('[SIM]') ? opts.subject : `[SIM] ${opts.subject || ''}`;
    return sendMail({
      ...opts,
      subject: simSubject,
      testModeOverride: true,
      redirectToOverride: cfg.simulation_redirect || 'gerosteva@gmail.com',
      allowListOverride: [],
    });
  }
  return sendMail({
    ...opts,
    testModeOverride: opts.testModeOverride !== undefined ? opts.testModeOverride : cfg.test_mode,
    redirectToOverride: opts.redirectToOverride || cfg.redirect_to,
    allowListOverride: opts.allowListOverride && opts.allowListOverride.length ? opts.allowListOverride : cfg.allow_list,
  });
}

/**
 * Runtime mail config — DB-backed override of env vars.
 * Allows ARACOM admin to toggle MAIL_TEST_MODE on/off from the UI without redeployment.
 *
 * Storage : collection `app_settings`, document with key='mail_config'
 *   { key: 'mail_config', test_mode: boolean, redirect_to: string, allow_list: string[],
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

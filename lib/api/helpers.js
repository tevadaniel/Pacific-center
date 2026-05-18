import { NextResponse } from 'next/server';
import { v4 as uuid } from 'uuid';

/**
 * Helpers partagés pour toutes les routes /api/[[...path]]/route.js
 * et les handlers modulaires dans /app/lib/api/handlers/
 */

export const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  'Pragma': 'no-cache',
  'Expires': '0',
  'Surrogate-Control': 'no-store',
};

export const json = (data, status = 200) => NextResponse.json(data, { status, headers: NO_CACHE_HEADERS });
export const err = (message, status = 400) => NextResponse.json({ error: message }, { status });

/** Identifiant de l'édition courante (constante partagée par les routes et handlers) */
export const EDITION_ID = 'edition-2026';

export function getUserContext(request) {
  return {
    userId: request.headers.get('x-user-id') || null,
    role: request.headers.get('x-user-role') || null,
  };
}

/**
 * Journalise une action dans la collection activity_logs (audit trail).
 *
 * @param {import('mongodb').Db} db
 * @param {string|null} userId
 * @param {string} entity_type    - ex: 'registration', 'organization', 'caution_appointment'
 * @param {string} entity_id      - identifiant UUID de l'entité
 * @param {string} action_type    - ex: 'archive', 'restore', 'delete_definitive', 'reset_caution', ...
 * @param {object|null} old_values - état précédent (facultatif)
 * @param {object|null} new_values - état après changement (facultatif)
 */
export async function logActivity(db, userId, entity_type, entity_id, action_type, old_values, new_values) {
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

/**
 * 🆕 SESSION 28i — Garantit qu'une organisation a au moins une registration 2026 active.
 * Si aucune n'existe (et que l'org n'est pas archivée et n'est pas mailing-only),
 * crée un dossier 2026 minimal qui permettra à l'exposant d'accéder à son portail.
 *
 * À appeler après toute création d'organisation pour éviter le bug "Dossier non initialisé".
 *
 * @param {import('mongodb').Db} db
 * @param {string} orgId
 * @param {object} options - { source, status, venue_id, force }
 * @returns {Promise<string|null>} L'id de la registration (existante ou créée), ou null si skip
 */
export async function ensureRegistrationForOrg(db, orgId, options = {}) {
  if (!orgId) return null;
  const org = await db.collection('organizations').findOne({ id: orgId });
  if (!org) return null;
  // Skip si org archivée OU mailing-only (sauf si force=true)
  if (!options.force) {
    if (org.archived_at) return null;
    if (org.is_mailing_only === true) return null;
  }
  // Vérifie qu'une registration active existe déjà
  const existing = await db.collection('registrations').findOne({
    organization_id: orgId,
    edition_id: EDITION_ID,
    status: { $nin: ['annule'] },
  });
  if (existing) return existing.id;
  // Crée un dossier 2026 minimal
  const newRegId = `reg-${orgId}`;
  const alreadyId = await db.collection('registrations').findOne({ id: newRegId });
  const regId = alreadyId ? `reg-${orgId}-${uuid().slice(0, 8)}` : newRegId;
  await db.collection('registrations').insertOne({
    id: regId,
    edition_id: EDITION_ID,
    organization_id: orgId,
    venue_id: options.venue_id || null,
    stand_code: null,
    status: options.status || 'a_confirmer',
    completion_percent: 5,
    wizard_step: 1,
    source: options.source || 'auto_ensure',
    is_locked: false,
    is_deposit_received: false,
    is_convention_signed: false,
    is_insurance_uploaded: false,
    candidature_locked: false,
    created_at: new Date(),
    updated_at: new Date(),
  });
  return regId;
}

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

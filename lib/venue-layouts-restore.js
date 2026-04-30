// 🛟 Module de restauration automatique des plans (stands + éléments décoratifs)
// Au premier démarrage, si la DB détecte que les venues existent mais que
// AUCUN stand n'a de position sauvegardée, on restaure automatiquement depuis
// le backup JSON embarqué dans le repo (/app/data-backup/venue-layouts-backup.json).
//
// Cela protège contre la perte de travail lors des redéploiements sur une
// base MongoDB vierge. Le flag "venue_layouts_restored_at" en app_config
// empêche la restauration de tourner en boucle (idempotent).

import fs from 'fs';
import path from 'path';

const BACKUP_PATH = path.join(process.cwd(), 'data-backup', 'venue-layouts-backup.json');
const CONFIG_KEY = 'venue_layouts_restored_at';

export async function restoreVenueLayoutsIfEmpty(db) {
  try {
    // 0) Vérifier si déjà restauré (idempotence)
    const cfg = await db.collection('app_config').findOne({ key: CONFIG_KEY });
    if (cfg?.value) {
      return { skipped: 'already_restored', at: cfg.value };
    }

    // 1) Vérifier qu'il y a bien des venues en DB (sinon pas de restauration possible)
    const venuesCount = await db.collection('venues').countDocuments();
    if (venuesCount === 0) {
      return { skipped: 'no_venues_yet' };
    }

    // 2) Vérifier si des positions existent déjà → ne pas écraser
    const existingPos = await db.collection('venue_stands').countDocuments({
      pos_x: { $exists: true, $ne: null },
      pos_y: { $exists: true, $ne: null },
    });
    if (existingPos > 0) {
      // Marque quand même comme restauré pour ne pas revérifier à chaque démarrage
      await db.collection('app_config').updateOne(
        { key: CONFIG_KEY },
        { $set: { key: CONFIG_KEY, value: new Date().toISOString(), reason: 'existing_positions_found', updated_at: new Date() } },
        { upsert: true }
      );
      return { skipped: 'positions_already_exist', count: existingPos };
    }

    // 3) Lire le backup
    if (!fs.existsSync(BACKUP_PATH)) {
      return { skipped: 'no_backup_file' };
    }
    const raw = fs.readFileSync(BACKUP_PATH, 'utf8');
    const backup = JSON.parse(raw);
    if (!Array.isArray(backup?.venues)) {
      return { skipped: 'invalid_backup' };
    }

    // 4) Appliquer les positions des stands + insérer les éléments décoratifs
    let standsUpdated = 0;
    let elementsInserted = 0;

    for (const v of backup.venues) {
      // Identifier le venue dans la DB courante (par code prioritairement, puis par id)
      const dbVenue = await db.collection('venues').findOne({
        $or: [{ code: v.code }, { id: v.id }],
      });
      if (!dbVenue) continue;

      // Restaurer les positions des stands (par stand_code)
      for (const s of (v.stands || [])) {
        if (typeof s.pos_x !== 'number' || typeof s.pos_y !== 'number') continue;
        const r = await db.collection('venue_stands').updateOne(
          { venue_id: dbVenue.id, stand_code: s.stand_code },
          { $set: { pos_x: s.pos_x, pos_y: s.pos_y, updated_at: new Date(), restored_from_backup: true } }
        );
        if (r.modifiedCount) standsUpdated++;
      }

      // Restaurer les éléments décoratifs (supprime les existants pour ce venue d'abord)
      await db.collection('venue_elements').deleteMany({ venue_id: dbVenue.id });
      for (const e of (v.elements || [])) {
        await db.collection('venue_elements').insertOne({
          id: crypto.randomUUID ? crypto.randomUUID() : (Date.now().toString(36) + Math.random().toString(36).slice(2)),
          venue_id: dbVenue.id,
          type: e.type,
          shape: e.shape || 'rectangle',
          pos_x: e.pos_x, pos_y: e.pos_y,
          width: e.width, height: e.height,
          rotation: e.rotation || 0,
          color: e.color || '#3b82f6',
          label: e.label || '',
          z_index: e.z_index || 1,
          created_at: new Date(),
          updated_at: new Date(),
          restored_from_backup: true,
        });
        elementsInserted++;
      }
    }

    // 5) Marquer comme restauré (idempotence)
    await db.collection('app_config').updateOne(
      { key: CONFIG_KEY },
      { $set: { key: CONFIG_KEY, value: new Date().toISOString(), stands_restored: standsUpdated, elements_restored: elementsInserted, updated_at: new Date() } },
      { upsert: true }
    );

    console.log(`[venue-layouts-restore] ✅ Restauré ${standsUpdated} stands + ${elementsInserted} éléments décoratifs depuis ${BACKUP_PATH}`);
    return { ok: true, stands: standsUpdated, elements: elementsInserted };
  } catch (e) {
    console.error('[venue-layouts-restore] ERREUR :', e?.message || e);
    return { error: e?.message || String(e) };
  }
}

// Permet aussi une restauration FORCÉE via endpoint admin (écrase tout)
export async function restoreVenueLayoutsForce(db) {
  if (!fs.existsSync(BACKUP_PATH)) throw new Error('Fichier backup introuvable : ' + BACKUP_PATH);
  const backup = JSON.parse(fs.readFileSync(BACKUP_PATH, 'utf8'));
  if (!Array.isArray(backup?.venues)) throw new Error('Backup invalide');

  let standsUpdated = 0;
  let elementsInserted = 0;
  for (const v of backup.venues) {
    const dbVenue = await db.collection('venues').findOne({ $or: [{ code: v.code }, { id: v.id }] });
    if (!dbVenue) continue;
    for (const s of (v.stands || [])) {
      if (typeof s.pos_x !== 'number' || typeof s.pos_y !== 'number') continue;
      const r = await db.collection('venue_stands').updateOne(
        { venue_id: dbVenue.id, stand_code: s.stand_code },
        { $set: { pos_x: s.pos_x, pos_y: s.pos_y, updated_at: new Date(), restored_from_backup: true } }
      );
      if (r.matchedCount) standsUpdated++;
    }
    await db.collection('venue_elements').deleteMany({ venue_id: dbVenue.id });
    for (const e of (v.elements || [])) {
      await db.collection('venue_elements').insertOne({
        id: crypto.randomUUID ? crypto.randomUUID() : (Date.now().toString(36) + Math.random().toString(36).slice(2)),
        venue_id: dbVenue.id,
        type: e.type, shape: e.shape || 'rectangle',
        pos_x: e.pos_x, pos_y: e.pos_y,
        width: e.width, height: e.height,
        rotation: e.rotation || 0,
        color: e.color || '#3b82f6',
        label: e.label || '', z_index: e.z_index || 1,
        created_at: new Date(), updated_at: new Date(),
        restored_from_backup: true,
      });
      elementsInserted++;
    }
  }
  await db.collection('app_config').updateOne(
    { key: CONFIG_KEY },
    { $set: { key: CONFIG_KEY, value: new Date().toISOString(), stands_restored: standsUpdated, elements_restored: elementsInserted, forced: true, updated_at: new Date() } },
    { upsert: true }
  );
  return { ok: true, stands: standsUpdated, elements: elementsInserted };
}

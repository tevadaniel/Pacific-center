/**
 * 🆕 SESSION 46 — Seeder de exposants de test couvrant TOUTES les configurations possibles.
 *
 * Cible : permettre de tester rapidement tous les boutons / flows du cockpit ARACOM
 * sans dépendre des données de production.
 *
 * Tous les exposants créés sont préfixés "TEST-" pour facilement les filtrer et nettoyer.
 * Le marqueur `_test_seed: true` est apposé sur chaque document pour distinguer du réel.
 */

import { v4 as uuid } from 'uuid';

const TEST_PREFIX = 'TEST-';
const TEST_MARKER = { _test_seed: true };

const DISCIPLINES = ['Karaté', 'Judo', 'Danse', 'Tennis', 'Football', 'Basket', 'Natation', 'Aïkido', 'Boxe', 'Volley'];
const PREFECTURES = ['Punaauia', 'Faaa', 'Arue', 'Mahina', 'Moorea', 'Taravao'];

/** Liste des 20 scénarios de test (1 exposant par scénario) */
const SCENARIOS = [
  // === Statuts simples ===
  { code: 'PROSPECT-01', label: 'Prospect frais (aucune config)', status: 'prospect', venue: null, withStand: false, withDays: false, withAnims: 0, withCaution: false, withDocs: false, locked: false, validation: null },
  { code: 'RELANCER-02', label: 'À relancer (silence radio)', status: 'a_relancer', venue: 'venue-faaa', withStand: false, withDays: false, withAnims: 0, withCaution: false, withDocs: false, locked: false, validation: null },
  { code: 'ACONFIRMER-03', label: 'À confirmer (stand pris, pas d\'anim)', status: 'a_confirmer', venue: 'venue-pun', withStand: true, withDays: ['vendredi'], withAnims: 0, withCaution: false, withDocs: false, locked: false, validation: null },
  { code: 'CONFIRME-04', label: 'Confirmé complet (anim + caution + docs)', status: 'confirme', venue: 'venue-aru', withStand: true, withDays: ['vendredi', 'samedi'], withAnims: 2, withCaution: 'recue', withDocs: ['convention', 'insurance'], locked: true, validation: 'verrouille' },
  { code: 'CONFIRME-05', label: 'Confirmé sans animation (à relancer pour anim)', status: 'confirme', venue: 'venue-faaa', withStand: true, withDays: ['samedi'], withAnims: 0, withCaution: 'recue', withDocs: ['convention'], locked: false, validation: 'verrouille' },
  { code: 'ATTENTE-06', label: 'Liste d\'attente (site complet)', status: 'liste_attente', venue: 'venue-pun', withStand: false, withDays: ['vendredi'], withAnims: 0, withCaution: false, withDocs: false, locked: false, validation: 'waitlist' },
  { code: 'ANNULE-07', label: 'Annulé par ARACOM', status: 'annule', venue: null, withStand: false, withDays: false, withAnims: 0, withCaution: false, withDocs: false, locked: false, validation: null, cancelReason: 'Désistement de l\'exposant — test cascade' },

  // === Animations variées ===
  { code: 'ANIM-STAND-08', label: 'Animation sur stand uniquement', status: 'confirme', venue: 'venue-aru', withStand: true, withDays: ['vendredi', 'samedi'], withAnims: 2, animLoc: 'sur_stand', withCaution: 'recue', withDocs: ['convention'], locked: true, validation: 'verrouille' },
  { code: 'ANIM-DEMO-09', label: 'Animation zone démo uniquement', status: 'confirme', venue: 'venue-aru', withStand: true, withDays: ['vendredi'], withAnims: 1, animLoc: 'zone_demo', withCaution: 'recue', withDocs: ['convention'], locked: true, validation: 'verrouille' },
  { code: 'ANIM-MIX-10', label: 'Animation mixte (stand + zone)', status: 'confirme', venue: 'venue-faaa', withStand: true, withDays: ['vendredi', 'samedi'], withAnims: 2, animLoc: 'mix', withCaution: 'recue', withDocs: ['convention'], locked: true, validation: 'verrouille' },

  // === Cautions ===
  { code: 'CAUTION-DUE-11', label: 'Caution due (non payée)', status: 'a_confirmer', venue: 'venue-pun', withStand: true, withDays: ['vendredi'], withAnims: 1, withCaution: 'due', withDocs: false, locked: false, validation: null },
  { code: 'CAUTION-RENDU-12', label: 'Caution rendue (post-événement)', status: 'confirme', venue: 'venue-faaa', withStand: true, withDays: ['samedi'], withAnims: 1, withCaution: 'rendue', withDocs: ['convention'], locked: true, validation: 'verrouille' },

  // === Documents ===
  { code: 'DOCS-PARTIAL-13', label: 'Convention signée, assurance manquante', status: 'a_confirmer', venue: 'venue-faaa', withStand: true, withDays: ['vendredi'], withAnims: 1, withCaution: 'due', withDocs: ['convention'], locked: false, validation: null },
  { code: 'DOCS-NONE-14', label: 'Aucun document uploadé', status: 'a_confirmer', venue: 'venue-pun', withStand: true, withDays: ['vendredi'], withAnims: 1, withCaution: 'non_demandee', withDocs: false, locked: false, validation: null },

  // === Multi-jours ===
  { code: 'BIJOUR-15', label: '2 jours présents avec 2 animations', status: 'confirme', venue: 'venue-aru', withStand: true, withDays: ['vendredi', 'samedi'], withAnims: 2, withCaution: 'recue', withDocs: ['convention'], locked: true, validation: 'verrouille' },
  { code: 'MONJOUR-16', label: 'Vendredi seul', status: 'confirme', venue: 'venue-aru', withStand: true, withDays: ['vendredi'], withAnims: 1, withCaution: 'recue', withDocs: ['convention'], locked: true, validation: 'verrouille' },

  // === Demandes de validation ===
  { code: 'PREVAL-17', label: 'Demande validation en attente (pré-validé)', status: 'a_confirmer', venue: 'venue-mah', withStand: true, withDays: ['vendredi'], withAnims: 1, withCaution: false, withDocs: false, locked: false, validation: 'pending' },
  { code: 'WAITLIST-18', label: 'Demande validation en liste d\'attente', status: 'liste_attente', venue: 'venue-moo', withStand: false, withDays: ['vendredi'], withAnims: 0, withCaution: false, withDocs: false, locked: false, validation: 'waitlist' },

  // === Cas limites ===
  { code: 'LOCKED-NOANIM-19', label: 'Verrouillé MAIS sans animation (anomalie)', status: 'confirme', venue: 'venue-faaa', withStand: true, withDays: ['vendredi'], withAnims: 0, withCaution: 'recue', withDocs: ['convention'], locked: true, validation: 'verrouille' },
  { code: 'ORPHAN-20', label: 'Organisation orpheline (sans inscription)', status: null, venue: null, withStand: false, withDays: false, withAnims: 0, withCaution: false, withDocs: false, locked: false, validation: null, orphan: true },
];

const venueNamesById = {
  'venue-faaa': 'Faaa', 'venue-pun': 'Punaauia', 'venue-aru': 'Arue', 'venue-tar': 'Taravao', 'venue-mah': 'Mahina', 'venue-moo': 'Moorea',
};

export async function seedTestExposants(db) {
  const now = new Date();
  const created = { organizations: 0, registrations: 0, animations: 0, deposits: 0, documents: 0, validations: 0 };
  const errors = [];

  // Récupérer les stands disponibles par venue (pour assigner)
  const allStands = await db.collection('venue_stands').find({}).toArray();
  const usedStands = new Set();
  const standsByVenue = new Map();
  for (const s of allStands) {
    if (!standsByVenue.has(s.venue_id)) standsByVenue.set(s.venue_id, []);
    standsByVenue.get(s.venue_id).push(s.stand_code);
  }
  // Récupérer les stands déjà assignés (pour éviter conflit)
  const existingAssigns = await db.collection('stand_assignments').find({ status: { $nin: ['annule', 'cancelled'] } }).toArray();
  for (const a of existingAssigns) usedStands.add(`${a.venue_id}::${a.stand_code}`);

  for (const sc of SCENARIOS) {
    try {
      const orgId = uuid();
      const orgName = `${TEST_PREFIX}${sc.code}`;
      const idx = SCENARIOS.indexOf(sc);
      const discipline = DISCIPLINES[idx % DISCIPLINES.length];
      const venueName = sc.venue ? venueNamesById[sc.venue] : null;

      // Organisation
      await db.collection('organizations').insertOne({
        id: orgId,
        name: orgName,
        contact_name: `Contact ${sc.code}`,
        main_email: `${sc.code.toLowerCase()}@test-aracom.local`,
        main_phone: `+(689) 87.${String(idx + 10).padStart(2, '0')}.${String(idx + 20).padStart(2, '0')}.${String(idx + 30).padStart(2, '0')}`,
        address: `Adresse test ${PREFECTURES[idx % PREFECTURES.length]}`,
        siret: `TEST${String(idx).padStart(8, '0')}`,
        association_number: `W${idx}TEST`,
        discipline,
        stand_description: `[TEST ${sc.code}] ${sc.label}`,
        notes: `Scénario de test : ${sc.label}`,
        created_at: now,
        updated_at: now,
        ...TEST_MARKER,
      });
      created.organizations += 1;

      if (sc.orphan) continue; // Orphelin = pas d'inscription

      // Pick stand if needed
      let standCode = null;
      if (sc.withStand && sc.venue) {
        const candidates = (standsByVenue.get(sc.venue) || []).filter((c) => !usedStands.has(`${sc.venue}::${c}`));
        if (candidates.length > 0) {
          standCode = candidates[0];
          usedStands.add(`${sc.venue}::${standCode}`);
        }
      }

      // Registration
      const regId = uuid();
      const attendingDays = Array.isArray(sc.withDays) ? sc.withDays : (sc.withDays ? ['vendredi'] : []);
      await db.collection('registrations').insertOne({
        id: regId,
        organization_id: orgId,
        organization_name: orgName,
        status: sc.status || 'prospect',
        venue_id: sc.venue || null,
        venue_name: venueName,
        stand_code: standCode,
        attending_days: attendingDays,
        completion_percent: sc.locked ? 100 : Math.min(80, 20 + attendingDays.length * 20 + (standCode ? 20 : 0)),
        block_locked_at: sc.locked ? now : null,
        candidature_locked: !!sc.locked,
        reply_status: sc.status === 'confirme' ? 'oui' : 'en_attente',
        cancelled_at: sc.status === 'annule' ? now : null,
        cancel_reason: sc.cancelReason || null,
        notes: `[TEST] ${sc.label}`,
        created_at: now,
        updated_at: now,
        ...TEST_MARKER,
      });
      created.registrations += 1;

      // Stand assignment
      if (standCode && sc.venue) {
        await db.collection('stand_assignments').insertOne({
          id: uuid(),
          registration_id: regId,
          organization_id: orgId,
          venue_id: sc.venue,
          stand_code: standCode,
          status: 'assigned',
          assigned_at: now,
          created_at: now,
          updated_at: now,
          ...TEST_MARKER,
        });
      }

      // Animations
      for (let i = 0; i < (sc.withAnims || 0); i++) {
        const day = attendingDays[i] || 'vendredi';
        let locType = 'sur_stand';
        if (sc.animLoc === 'zone_demo') locType = 'zone_demo';
        else if (sc.animLoc === 'mix') locType = i === 0 ? 'sur_stand' : 'zone_demo';
        await db.collection('animation_slots').insertOne({
          id: uuid(),
          registration_id: regId,
          organization_name: orgName,
          discipline,
          venue_id: sc.venue,
          venue_name: venueName,
          stand_code: standCode,
          day_label: day,
          event_date: day === 'vendredi' ? '2026-08-14' : '2026-08-15',
          start_time: locType === 'zone_demo' ? '14:00' : '10:00',
          end_time: locType === 'zone_demo' ? '14:30' : '11:00',
          duration_minutes: locType === 'zone_demo' ? 30 : 60,
          slot_type: 'demonstration',
          location_type: locType,
          title: `[TEST] Démonstration ${discipline}`,
          description: `Animation de test pour le scénario ${sc.code} — démonstration ${discipline.toLowerCase()}.`,
          target_audience: 'tous_publics',
          material_needs: i === 0 ? '2 tapis, sono' : '',
          status: 'planifié',
          created_at: now,
          updated_at: now,
          ...TEST_MARKER,
        });
        created.animations += 1;
      }

      // Caution
      if (sc.withCaution) {
        await db.collection('deposit_transactions').insertOne({
          id: uuid(),
          registration_id: regId,
          organization_id: orgId,
          amount: 30000,
          status: sc.withCaution,
          payment_mode: 'cheque',
          received_at: sc.withCaution === 'recue' || sc.withCaution === 'rendue' ? now : null,
          refunded_at: sc.withCaution === 'rendue' ? now : null,
          notes: `[TEST] Caution scénario ${sc.code}`,
          created_at: now,
          ...TEST_MARKER,
        });
        created.deposits += 1;
      }

      // Documents
      if (Array.isArray(sc.withDocs)) {
        for (const docType of sc.withDocs) {
          await db.collection('registration_documents').insertOne({
            id: uuid(),
            registration_id: regId,
            organization_id: orgId,
            document_type: docType,
            kind: docType,
            status: 'signed',
            file_name: `[TEST] ${docType}_${sc.code}.pdf`,
            file_size: 102400,
            signed_at: docType === 'convention' ? now : null,
            uploaded_at: now,
            created_at: now,
            ...TEST_MARKER,
          });
          created.documents += 1;
        }
      }

      // Validation request
      if (sc.validation) {
        await db.collection('validation_requests').insertOne({
          id: uuid(),
          registration_id: regId,
          organization_id: orgId,
          organization_name: orgName,
          venue_id: sc.venue || null,
          venue_name: venueName,
          requested_stand_code: standCode,
          status: sc.validation,
          kind: sc.validation === 'waitlist' ? 'site_complet_waitlist' : 'wizard_submit',
          note: `[TEST] ${sc.label}`,
          created_at: new Date(now.getTime() - idx * 60 * 1000), // espace les dates pour tri
          updated_at: now,
          ...TEST_MARKER,
        });
        created.validations += 1;
      }
    } catch (e) {
      errors.push({ scenario: sc.code, error: e.message });
    }
  }

  return { created, errors, scenarios_count: SCENARIOS.length };
}

/** Supprime toutes les données de test (identifiées par `_test_seed: true`) */
export async function cleanupTestExposants(db) {
  const deleted = {};
  for (const col of ['organizations', 'registrations', 'animation_slots', 'stand_assignments', 'deposit_transactions', 'registration_documents', 'validation_requests']) {
    const r = await db.collection(col).deleteMany({ _test_seed: true });
    deleted[col] = r.deletedCount || 0;
  }
  return { deleted };
}

export { SCENARIOS as TEST_SCENARIOS };

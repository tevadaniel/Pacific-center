/**
 * 📥 IMPORT LISTING EXPOSANTS 2026 — Parse Excel "Listing Exposant" → seed clean DB.
 *
 * Source : /app/data-imports/listing-exposants.xlsx (uploaded by admin — SESSION 53.5)
 * Cible  : Wipe + recreate organizations + registrations selon statut 2026
 *          - "Confirmé"  → status='a_confirmer' (verbalement OK, dossier à finaliser)
 *          - "Relance"   → status='a_relancer'  (campagne mailing à faire)
 *          - "Multi-sites" / vide → venue_id=null (l'exposant choisira plus tard)
 *          - Site précis → venue_id pré-affecté (venue-faaa/pun/aru/tar)
 *
 * Stratégie : WIPE & RELOAD destructif. Préserve : users admin, venues, app_settings.
 */

import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { v4 as uuid } from 'uuid';

const EDITION_ID = 'edition-2026';
const EXCEL_PATH = path.join(process.cwd(), 'data-imports', 'listing-exposants.xlsx');
const SHEET_NAME = '📋 BASE EXPOSANTS (2)';

// Mapping nom de site → venue_id
const SITE_TO_VENUE = {
  "faa'a": 'venue-faaa',
  'faaa': 'venue-faaa',
  'punaauia': 'venue-pun',
  'arue': 'venue-aru',
  'taravao': 'venue-tar',
  'mahina': 'venue-mah',
  'moorea': 'venue-moo',
};

// Mapping statut Excel → status registration
const STATUS_MAP = {
  'confirmé': 'a_confirmer',
  'confirme': 'a_confirmer',
  'relance': 'a_relancer',
  'à relancer': 'a_relancer',
  'a relancer': 'a_relancer',
};

// Collections à wiper avant l'import (mêmes que tools/reset-db)
const COLLECTIONS_TO_WIPE = [
  'organizations', 'organization_contacts', 'organization_history', 'organization_preferences',
  'registrations', 'stand_assignments', 'registration_documents', 'deposit_transactions',
  'access_tokens', 'email_campaigns', 'email_messages', 'tasks_or_followups',
  'attendance_sessions', 'attendance_events', 'registration_anomalies',
  'field_comments', 'field_media', 'post_event_reports', 'activity_logs',
  'validation_requests', 'push_subscriptions', 'satisfaction_surveys', 'satisfaction_responses',
  'caution_appointments', 'animation_slots', 'backups',
  'modification_tokens', 'modification_requests',
];

// Utilisateurs à PRÉSERVER absolument (admins ARACOM)
const KEEP_USERS = ['u-admin', 'u-teva', 'u-agence', 'u-pc'];

// ─── HELPERS ─────────────────────────────────────────────────────────────
function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // strip accents
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

function normalizeEmail(s) {
  if (!s) return null;
  const v = String(s).trim().toLowerCase();
  if (!v || v === '–' || v === '-') return null;
  if (!v.includes('@')) return null;
  return v;
}

function normalizePhone(s) {
  if (!s) return null;
  const v = String(s).trim();
  if (!v || v === '–' || v === '-') return null;
  return v.replace(/\s+/g, ' ');
}

function clean(s) {
  if (s == null) return null;
  const v = String(s).trim();
  if (!v || v === '–' || v === '-') return null;
  return v;
}

function fidelityFromExcel(s) {
  const v = clean(s);
  if (!v) return null;
  if (v.includes('Fidèle')) return 'Fidèle';
  if (v.includes('Régulier')) return 'Régulier';
  if (v.includes('Ponctuel')) return 'Ponctuel';
  return v;
}

// "Faa'a" / "Punaauia" / "Arue" / "Taravao" / "Multi-sites" / null → venue_id ou null
function venueIdFromSite(s) {
  const v = clean(s);
  if (!v) return null;
  const key = v.toLowerCase().trim();
  if (key === 'multi-sites' || key === 'multisites') return null;
  return SITE_TO_VENUE[key] || null;
}

// "Confirmé" / "Relance" → status registration
function registrationStatusFromStatut2026(s) {
  const v = clean(s);
  if (!v) return 'a_confirmer';
  const key = v.toLowerCase().trim();
  return STATUS_MAP[key] || 'a_confirmer';
}

// ✓ → true, '–'/null → false
function presentYear(v) {
  return clean(v) === '✓';
}

// ─── PARSER ──────────────────────────────────────────────────────────────
export function parseFusionExcel() {
  // Lit le buffer manuellement (XLSX.readFile ne fonctionne pas dans Next.js bundle)
  if (!fs.existsSync(EXCEL_PATH)) {
    throw new Error(`Fichier Excel introuvable : ${EXCEL_PATH}`);
  }
  const buf = fs.readFileSync(EXCEL_PATH);
  const wb = XLSX.read(buf, { type: 'buffer' });
  const ws = wb.Sheets[SHEET_NAME];
  if (!ws) throw new Error(`Feuille "${SHEET_NAME}" introuvable dans le fichier Excel`);

  // header row index = 2 (rows 0-1 are titles/categories)
  // data starts at row 3
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

  const exposants = [];
  for (let i = 3; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row[1]) continue; // skip empty
    const numero = row[0];
    const name = clean(row[1]);
    if (!name) continue;

    const discipline = clean(row[2]) || '';
    const sitePrincipal = clean(row[3]); // peut être "Multi-sites", "Faa'a", "Punaauia", "Arue", "Taravao", "Mahina", "Moorea"
    const yearsPresence = {
      y2019: presentYear(row[4]),
      y2020: presentYear(row[5]),
      y2023: presentYear(row[6]),
      y2024: presentYear(row[7]),
      y2025: presentYear(row[8]),
    };
    const nbEditions = Number(row[9] || 0) || 0;
    const fidelity = fidelityFromExcel(row[10]);
    const contactName = clean(row[11]);
    const phone = normalizePhone(row[12]);
    const email = normalizeEmail(row[13]);
    const statut2026 = clean(row[14]);
    const jour1 = clean(row[15]);
    const jour2 = clean(row[16]);
    const commentaire = clean(row[17]);

    exposants.push({
      numero, name, discipline, sitePrincipal,
      yearsPresence, nbEditions, fidelity,
      contactName, phone, email,
      statut2026, jour1, jour2, commentaire,
    });
  }
  return exposants;
}

// ─── DRY RUN PREVIEW ─────────────────────────────────────────────────────
export function previewImport() {
  const exposants = parseFusionExcel();
  const withEmail = exposants.filter(e => !!e.email);
  const withoutEmail = exposants.filter(e => !e.email);
  const byFidelity = exposants.reduce((acc, e) => {
    const k = e.fidelity || '—';
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});
  const bySite = exposants.reduce((acc, e) => {
    const k = e.sitePrincipal || '—';
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});
  const byStatut = exposants.reduce((acc, e) => {
    const k = e.statut2026 || '—';
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});
  const byVenuePreaffected = exposants.reduce((acc, e) => {
    const v = venueIdFromSite(e.sitePrincipal);
    const k = v || '— (à choisir plus tard)';
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});
  return {
    total: exposants.length,
    with_email: withEmail.length,
    without_email: withoutEmail.length,
    by_fidelity: byFidelity,
    by_site_historique: bySite,
    by_statut_2026: byStatut,
    by_venue_preaffected: byVenuePreaffected,
    sample: exposants.slice(0, 5).map(e => ({ name: e.name, email: e.email, contact: e.contactName, fidelity: e.fidelity, site: e.sitePrincipal, statut: e.statut2026 })),
  };
}

// ─── WIPE & RELOAD ───────────────────────────────────────────────────────
export async function executeImport(db, { dryRun = false, actorUserId = 'u-admin' } = {}) {
  const exposants = parseFusionExcel();

  if (dryRun) {
    return { ok: true, dry_run: true, would_import: exposants.length, preview: previewImport() };
  }

  const stats = { wipe: {}, created: { organizations: 0, organization_contacts: 0, organization_history: 0, registrations: 0, users: 0 } };

  // 1. WIPE collections
  for (const c of COLLECTIONS_TO_WIPE) {
    const r = await db.collection(c).deleteMany({});
    if (r.deletedCount > 0) stats.wipe[c] = r.deletedCount;
  }

  // 2. Wipe non-admin users (exposants, pacific, etc.)
  const u = await db.collection('users').deleteMany({
    id: { $nin: KEEP_USERS },
    role_code: { $ne: 'aracom_admin' },
  });
  stats.wipe.users_removed = u.deletedCount;

  // 3. Reset venue_stands (libère tous les stands)
  const vs = await db.collection('venue_stands').updateMany({}, {
    $set: { status: 'libre', updated_at: new Date() },
    $unset: { reserved_for: '', reserved_at: '', confirmed_for: '' },
  });
  stats.wipe.venue_stands_freed = vs.modifiedCount;

  // 4. Wipe venue_elements (si présents - ils peuvent contenir des layouts custom)
  // ATTENTION: on les garde pour préserver les plans, ils ne contiennent pas de data exposant.

  // 5. CREATE — Groupage par organisation + sélection primary site aléatoire + assignation stands
  // 🆕 SESSION 53.7 — Règles utilisateur :
  //   - attending_days = ['vendredi', 'samedi'] par défaut sur chaque reg
  //   - Multi-sites : 1 site primaire RANDOM parmi les venues demandés → pre_reserve si place, sinon waitlist
  //   - Autres sites de l'org → toujours waitlist
  //   - Sites sans capacité (NULL) → a_confirmer sans venue
  //   - Tri des orgs : status Excel (Confirmé > Relance) > fidélité > nom alpha

  const FIDELITY_ORDER = { 'Fidèle': 0, 'Régulier': 1, 'Ponctuel': 2 };
  const STATUS_EXCEL_ORDER = { 'Confirmé': 0, 'Relance': 1 };

  // Group exposants by slug (= 1 organisation par nom unique)
  const orgGroups = new Map();
  for (const e of exposants) {
    const slug = slugify(e.name);
    if (!orgGroups.has(slug)) orgGroups.set(slug, []);
    orgGroups.get(slug).push(e);
  }

  // Tri prioritaire pour la course aux stands
  const orgEntries = [...orgGroups.entries()].sort(([, ar], [, br]) => {
    const a = ar[0], b = br[0];
    const sa = STATUS_EXCEL_ORDER[a.statut2026] ?? 9;
    const sb = STATUS_EXCEL_ORDER[b.statut2026] ?? 9;
    if (sa !== sb) return sa - sb;
    const fa = FIDELITY_ORDER[a.fidelity] ?? 9;
    const fb = FIDELITY_ORDER[b.fidelity] ?? 9;
    if (fa !== fb) return fa - fb;
    return (a.name || '').localeCompare(b.name || '');
  });

  // Pré-charge les stands libres par venue
  const freeStandsByVenue = {};
  for (const venueId of ['venue-faaa', 'venue-pun', 'venue-aru', 'venue-tar']) {
    const allStands = await db.collection('venue_stands')
      .find({ venue_id: venueId, is_active: { $ne: false } })
      .sort({ stand_code: 1 })
      .toArray();
    freeStandsByVenue[venueId] = allStands; // tous libres après wipe
  }

  const DEFAULT_DAYS = ['vendredi', 'samedi'];
  const DEFAULT_DAY_TIMES = {
    vendredi: { from: '09:00', to: '17:00' },
    samedi: { from: '09:00', to: '17:00' },
  };

  const regCounter = new Map();
  const usedEmails = new Set();
  stats.created.pre_reserved = 0;
  stats.created.waitlisted = 0;
  stats.created.no_venue = 0;

  for (const [slug, rows] of orgEntries) {
    const e0 = rows[0]; // données org (mêmes pour toutes les rows)
    const orgId = `org-fusion-${slug}`;

    // Organization (1×)
    const priorityLevel = e0.fidelity === 'Fidèle' ? 'fidele' : 'standard';
    await db.collection('organizations').insertOne({
      id: orgId,
      name: e0.name,
      discipline: e0.discipline || '',
      priority_level: priorityLevel,
      main_email: e0.email || null,
      main_phone: e0.phone || null,
      contact_name: e0.contactName || null,
      notes: e0.commentaire || null,
      source_origin: 'import_fusion_2026',
      participation_history: {
        ...e0.yearsPresence,
        nb_editions: e0.nbEditions,
        fidelity: e0.fidelity || null,
        site_historique: e0.sitePrincipal || null,
      },
      created_at: new Date(),
      updated_at: new Date(),
    });
    stats.created.organizations += 1;

    // Contact
    if (e0.contactName) {
      await db.collection('organization_contacts').insertOne({
        id: uuid(),
        organization_id: orgId,
        full_name: e0.contactName,
        role_label: 'Contact principal',
        email: e0.email || null,
        phone: e0.phone || null,
        is_primary: true,
        created_at: new Date(),
        updated_at: new Date(),
      });
      stats.created.organization_contacts += 1;
    }

    // History
    for (const [yKey, present] of Object.entries(e0.yearsPresence)) {
      if (!present) continue;
      const year = Number(yKey.replace('y', ''));
      await db.collection('organization_history').insertOne({
        id: uuid(),
        organization_id: orgId,
        year,
        participated: true,
        comment: null,
        created_at: new Date(),
      });
      stats.created.organization_history += 1;
    }

    // 🎯 Liste des venues demandés (un par row) — déduplication & exclusion null
    const venuesRequested = rows.map(r => venueIdFromSite(r.sitePrincipal));
    const distinctVenues = [...new Set(venuesRequested.filter(Boolean))];

    // Pick PRIMARY venue aléatoirement parmi les distincts (règle utilisateur)
    let primaryVenue = null;
    if (distinctVenues.length > 0) {
      primaryVenue = distinctVenues[Math.floor(Math.random() * distinctVenues.length)];
    }

    // Créer 1 registration par row (= par site demandé, y compris doublons NULL)
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowVenue = venuesRequested[i];

      // Build regId
      const venueShort = rowVenue ? rowVenue.replace('venue-', '') : 'nosite';
      const regIdBase = `reg-fusion-${slug}-${venueShort}`;
      const seenBefore = regCounter.get(regIdBase) || 0;
      const regId = seenBefore === 0 ? regIdBase : `${regIdBase}-${seenBefore + 1}`;
      regCounter.set(regIdBase, seenBefore + 1);

      let status, isPreReserved = false, isWaitlist = false, standCode = null;
      let standDoc = null;

      if (!rowVenue) {
        // Pas de venue → reste a_confirmer, l'admin/exposant choisira
        status = 'a_confirmer';
        stats.created.no_venue += 1;
      } else if (rowVenue === primaryVenue) {
        // PRIMARY → tente de prendre un stand libre
        const freeList = freeStandsByVenue[rowVenue] || [];
        if (freeList.length > 0) {
          standDoc = freeList.shift();
          status = 'a_confirmer';
          isPreReserved = true;
          standCode = standDoc.stand_code;
          stats.created.pre_reserved += 1;
        } else {
          status = 'liste_attente';
          isWaitlist = true;
          stats.created.waitlisted += 1;
        }
      } else {
        // SECONDARY (autres sites de l'org multi-site) → waitlist auto
        status = 'liste_attente';
        isWaitlist = true;
        stats.created.waitlisted += 1;
      }

      await db.collection('registrations').insertOne({
        id: regId,
        edition_id: EDITION_ID,
        organization_id: orgId,
        venue_id: rowVenue || null,
        stand_code: standCode,
        status,
        is_pre_reserved: isPreReserved,
        is_waitlist: isWaitlist,
        is_primary_venue: rowVenue && rowVenue === primaryVenue, // trace
        attending_days: DEFAULT_DAYS,
        attending_day_times: DEFAULT_DAY_TIMES,
        completion_percent: standCode ? 25 : 10,
        wizard_step: 1,
        is_convention_signed: false,
        is_deposit_required: true,
        is_deposit_received: false,
        is_insurance_uploaded: false,
        is_guide_sent: false,
        candidature_locked: false,
        planned_arrival_time: null,
        planned_departure_time: null,
        post_event_status: 'en_attente',
        internal_notes: row.commentaire || null,
        source: 'import_listing_exposants_2026',
        statut_2026_excel: row.statut2026 || null,
        created_at: new Date(),
        updated_at: new Date(),
      });
      stats.created.registrations += 1;

      // Si stand assigné : marquer comme reserved + créer stand_assignment
      if (standDoc) {
        await db.collection('venue_stands').updateOne({ id: standDoc.id }, {
          $set: { status: 'reserved', updated_at: new Date() },
        });
        await db.collection('stand_assignments').insertOne({
          id: uuid(),
          registration_id: regId,
          venue_stand_id: standDoc.id,
          stand_code: standDoc.stand_code,
          status: 'pre_reserve',
          request_status: 'pending',
          request_submitted_at: new Date(),
          waitlist_position: null,
          validated_at: null,
          validated_by: null,
          refused_reason: null,
          created_at: new Date(),
          updated_at: new Date(),
        });
      }
    }

    // User exposant (1× par org si email valide)
    if (e0.email && !usedEmails.has(e0.email)) {
      usedEmails.add(e0.email);
      const userId = `u-exp-${orgId.replace(/^org-/, '')}`;
      await db.collection('users').insertOne({
        id: userId,
        email: e0.email,
        full_name: e0.contactName || e0.name,
        phone: e0.phone || null,
        role_id: 'role-exposant',
        role_code: 'exposant',
        organization_id: orgId,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      });
      stats.created.users += 1;
    }
  }

  // 6. Activity log
  try {
    await db.collection('activity_logs').insertOne({
      id: uuid(),
      user_id: actorUserId,
      entity_type: 'system',
      entity_id: 'import',
      action_type: 'import_fusion_2026',
      old_values_json: null,
      new_values_json: stats,
      created_at: new Date(),
    });
  } catch { /* ignore */ }

  return { ok: true, dry_run: false, stats, message: `✅ Import terminé — ${stats.created.organizations} organisations, ${stats.created.registrations} registrations, ${stats.created.users} comptes exposants.` };
}

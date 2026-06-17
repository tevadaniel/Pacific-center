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

  // 5. CREATE organizations + history + contacts + users + registrations
  // ⚠️ Gestion des doublons : même nom (slug) Excel = MÊME organization mais REGS séparées par site
  const orgIdBySlug = new Map();          // slug → orgId (réutilisation)
  const orgsCreated = new Set();          // orgIds déjà créés (évite re-création)
  const regCounter = new Map();           // orgId → counter pour suffixer regId
  const usedEmails = new Set();
  for (const e of exposants) {
    const slug = slugify(e.name);
    let orgId = orgIdBySlug.get(slug);
    if (!orgId) {
      orgId = `org-fusion-${slug}`;
      orgIdBySlug.set(slug, orgId);
    }
    const isNewOrg = !orgsCreated.has(orgId);

    // Organization (créée UNE SEULE FOIS par nom unique)
    if (isNewOrg) {
      orgsCreated.add(orgId);
      const priorityLevel = e.fidelity === 'Fidèle' ? 'fidele'
        : e.fidelity === 'Régulier' ? 'standard'
        : e.fidelity === 'Ponctuel' ? 'standard'
        : 'standard';

      await db.collection('organizations').insertOne({
        id: orgId,
        name: e.name,
        discipline: e.discipline || '',
        priority_level: priorityLevel,
        main_email: e.email || null,
        main_phone: e.phone || null,
        contact_name: e.contactName || null,
        notes: e.commentaire || null,
        source_origin: 'import_fusion_2026',
        participation_history: {
          ...e.yearsPresence,
          nb_editions: e.nbEditions,
          fidelity: e.fidelity || null,
          site_historique: e.sitePrincipal || null,
        },
        created_at: new Date(),
        updated_at: new Date(),
      });
      stats.created.organizations += 1;

      // Contact principal
      if (e.contactName) {
        await db.collection('organization_contacts').insertOne({
          id: uuid(),
          organization_id: orgId,
          full_name: e.contactName,
          role_label: 'Contact principal',
          email: e.email || null,
          phone: e.phone || null,
          is_primary: true,
          created_at: new Date(),
          updated_at: new Date(),
        });
        stats.created.organization_contacts += 1;
      }

      // History (1 doc par année participée)
      for (const [yKey, present] of Object.entries(e.yearsPresence)) {
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
    }

    // Registration 2026 — venue pré-affecté si site précis, sinon null (Multi-sites/vide)
    // ⚠️ regId unique : prefix + suffix venue + compteur si plusieurs entrées même site
    const preaffectedVenue = venueIdFromSite(e.sitePrincipal);
    const venueShort = preaffectedVenue ? preaffectedVenue.replace('venue-', '') : 'multi';
    const regIdBase = orgId.replace(/^org-/, 'reg-') + '-' + venueShort;
    const seenBefore = regCounter.get(regIdBase) || 0;
    const regId = seenBefore === 0 ? regIdBase : `${regIdBase}-${seenBefore + 1}`;
    regCounter.set(regIdBase, seenBefore + 1);
    const regStatus = registrationStatusFromStatut2026(e.statut2026);
    await db.collection('registrations').insertOne({
      id: regId,
      edition_id: EDITION_ID,
      organization_id: orgId,
      venue_id: preaffectedVenue,
      stand_code: null,
      status: regStatus,
      attending_days: [],
      attending_day_times: {},
      completion_percent: regStatus === 'a_confirmer' ? 10 : 5,
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
      internal_notes: e.commentaire || null,
      source: 'import_listing_exposants_2026',
      statut_2026_excel: e.statut2026 || null, // trace de la valeur Excel d'origine
      created_at: new Date(),
      updated_at: new Date(),
    });
    stats.created.registrations += 1;

    // User exposant (uniquement si email valide ET pas déjà utilisé)
    if (e.email && !usedEmails.has(e.email)) {
      usedEmails.add(e.email);
      const userId = `u-exp-${orgId.replace(/^org-/, '')}`;
      await db.collection('users').insertOne({
        id: userId,
        email: e.email,
        full_name: e.contactName || e.name,
        phone: e.phone || null,
        role_id: 'role-exposant',
        role_code: 'exposant',
        organization_id: orgId,
        is_active: true,
        // NOTE : pas de password par défaut. L'exposant utilisera magic-link.
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

#!/usr/bin/env node
/**
 * 🛡️ SAFETY CHECK SCRIPT — À EXÉCUTER APRÈS CHAQUE DÉPLOIEMENT PROD
 *
 * Vérifie et force l'état sûr de la base de données :
 *  - Mail mode TEST forcé (aucun envoi vers les vrais destinataires)
 *  - Utilisateurs critiques (admin, pacific) présents
 *  - Compteurs visit_slots cohérents avec les réservations réelles
 *  - Aucun token de modification expiré
 *  - Aucune org/registration de test (préfixes "wizard-e2e-", "TEST-", etc.)
 *
 * USAGE:
 *   node scripts/safety-check.js              # mode dry-run (affiche les anomalies)
 *   node scripts/safety-check.js --apply      # corrige automatiquement
 *   node scripts/safety-check.js --force-prod # désactive le mode test mail (DANGEREUX)
 *
 * Variables d'env attendues :
 *   MONGO_URL=mongodb://...
 *   DB_NAME=your_database_name (ou autre)
 */

// Charge dotenv si présent (pour run local). En CI/prod, les vars sont injectées.
try { require('dotenv').config(); } catch {}
const { MongoClient } = require('mongodb');

const DRY_RUN = !process.argv.includes('--apply');
const FORCE_PROD = process.argv.includes('--force-prod');
const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017';
const DB_NAME = process.env.DB_NAME || 'your_database_name';

const ALLOWED_TEST_EMAILS = [
  'tevageros@me.com',
  'teva.geros@aracom-conseil.fr',
  'agence@aracom-conseil.fr',
  'admin@aracom.pf',
];
const DEFAULT_REDIRECT = 'tevageros@me.com';

// 🚨 RÈGLE ABSOLUE : seuls ces préfixes/noms sont autorisés pour les données de test.
// Voir /app/memory/RULES.md
const ALLOWED_TEST_NAME_PATTERN = /\b(teva|aracom|teka)\b/i;

// 🛡️ Liste blanche des exposants RÉELS — toujours préservés
const PROTECTED_ORG_NAMES = [
  'I Mua Papeete',
  'Dream Lab',
  'ACE Arue',
  'Budokan Judo Pirae',
  'Lotus Bleu',
];

const log = (icon, msg) => console.log(`${icon} ${msg}`);
const ok = m => log('✅', m);
const warn = m => log('⚠️ ', m);
const err = m => log('❌', m);
const info = m => log('ℹ️ ', m);
const action = m => log(DRY_RUN ? '🔍' : '🔧', m);

(async () => {
  console.log('━'.repeat(70));
  console.log('🛡️  SAFETY CHECK — Forum de la Rentrée 2026');
  console.log(`   Mode: ${DRY_RUN ? 'DRY-RUN (lecture seule)' : 'APPLY (corrections actives)'}`);
  console.log(`   DB:   ${DB_NAME} @ ${MONGO_URL.replace(/:[^:@/]+@/, ':***@')}`);
  console.log('━'.repeat(70));

  const client = new MongoClient(MONGO_URL);
  await client.connect();
  const db = client.db(DB_NAME);

  let issues = 0;

  // ── 1) MAIL CONFIG ────────────────────────────────────────────────
  console.log('\n[1/7] Mail config (test mode)');
  let mc = await db.collection('app_settings').findOne({ key: 'mail_config' });
  if (!mc) {
    issues++;
    err('Aucune config mail trouvée');
    if (!DRY_RUN) {
      await db.collection('app_settings').insertOne({
        key: 'mail_config',
        test_mode: true,
        redirect_to: DEFAULT_REDIRECT,
        allow_list: ALLOWED_TEST_EMAILS,
        updated_at: new Date(),
        updated_by: 'safety-check',
      });
      ok('Config mail créée en mode TEST');
    }
  } else if (!mc.test_mode && !FORCE_PROD) {
    issues++;
    err(`Mode TEST mail désactivé ! redirect_to=${mc.redirect_to}`);
    action('Forcer test_mode=true');
    if (!DRY_RUN) {
      await db.collection('app_settings').updateOne(
        { key: 'mail_config' },
        { $set: { test_mode: true, updated_at: new Date(), updated_by: 'safety-check' } }
      );
      ok('Mode TEST activé');
    }
  } else if (FORCE_PROD && mc.test_mode) {
    warn('⚠️  --force-prod : passage en mode PRODUCTION (envois réels)');
    if (!DRY_RUN) {
      await db.collection('app_settings').updateOne(
        { key: 'mail_config' },
        { $set: { test_mode: false, updated_at: new Date(), updated_by: 'safety-check' } }
      );
      ok('Mode PRODUCTION activé');
    }
  } else {
    ok(`Mode TEST actif · redirect=${mc.redirect_to} · ${mc.allow_list?.length || 0} email(s) en allow-list`);
  }

  // ── 2) UTILISATEURS CRITIQUES ─────────────────────────────────────
  console.log('\n[2/7] Utilisateurs critiques');
  const adminUser = await db.collection('users').findOne({
    $or: [{ email: 'admin@aracom.pf' }, { role_code: 'aracom_admin' }],
  });
  if (!adminUser) {
    issues++;
    err('Compte admin ARACOM introuvable');
    if (!DRY_RUN) {
      await db.collection('users').insertOne({
        id: 'u-admin',
        email: 'admin@aracom.pf',
        full_name: 'ARACOM Admin',
        name: 'ARACOM Admin',
        role_code: 'aracom_admin',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      });
      ok('Admin créé');
    }
  } else {
    ok(`Admin OK : ${adminUser.email}`);
  }
  const pcUser = await db.collection('users').findOne({
    $or: [{ email: 'pacific@centers.pf' }, { role_code: 'pacific_centers_readonly' }],
  });
  if (!pcUser) {
    issues++;
    err('Compte Pacific Centers introuvable');
    if (!DRY_RUN) {
      await db.collection('users').insertOne({
        id: 'u-pc',
        email: 'pacific@centers.pf',
        full_name: 'Pacific Centers',
        name: 'Pacific Centers',
        role_code: 'pacific_centers_readonly',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      });
      ok('Pacific Centers créé');
    }
  } else if (!pcUser.name) {
    if (!DRY_RUN) {
      await db.collection('users').updateOne({ _id: pcUser._id }, { $set: { name: 'Pacific Centers' } });
    }
    ok(`Pacific Centers OK : ${pcUser.email} (name normalisé)`);
  } else {
    ok(`Pacific Centers OK : ${pcUser.email}`);
  }

  // ── 3) VENUES & VISIT SLOTS ───────────────────────────────────────
  console.log('\n[3/7] Venues & visit slots');
  const venuesCount = await db.collection('venues').countDocuments({});
  const slotsCount = await db.collection('visit_slots').countDocuments({});
  if (venuesCount < 6) { issues++; err(`Seulement ${venuesCount}/6 venues`); } else ok(`${venuesCount} venues`);
  if (slotsCount < 120) {
    issues++;
    err(`Seulement ${slotsCount}/120 visit_slots — appeler POST /api/wizard/seed-visit-slots`);
  } else {
    ok(`${slotsCount} visit_slots`);
  }

  // ── 4) INTÉGRITÉ booked_count ─────────────────────────────────────
  console.log('\n[4/7] Intégrité visit_slots.booked_count');
  const realBookings = await db.collection('registrations').aggregate([
    { $match: { visit_slot_id: { $ne: null, $exists: true } } },
    { $group: { _id: '$visit_slot_id', count: { $sum: 1 } } },
  ]).toArray();
  const realMap = new Map(realBookings.map(b => [b._id, b.count]));
  const allSlots = await db.collection('visit_slots').find({ booked_count: { $gt: 0 } }).toArray();
  let drift = 0;
  for (const s of allSlots) {
    const real = realMap.get(s.id) || 0;
    if (s.booked_count !== real) {
      drift++;
      action(`Slot ${s.id} : booked_count=${s.booked_count} → réel=${real}`);
      if (!DRY_RUN) {
        await db.collection('visit_slots').updateOne({ id: s.id }, { $set: { booked_count: real, updated_at: new Date() } });
      }
    }
  }
  if (drift) { issues++; warn(`${drift} slot(s) avec compteur incorrect`); } else ok('Tous les compteurs sont cohérents');

  // ── 5) TOKENS DE MODIFICATION EXPIRÉS ─────────────────────────────
  console.log('\n[5/7] Tokens de modification');
  const expired = await db.collection('modification_tokens').countDocuments({
    expires_at: { $lt: new Date() },
    used_at: null,
  });
  if (expired > 0) {
    action(`Purger ${expired} token(s) expiré(s)`);
    if (!DRY_RUN) {
      const r = await db.collection('modification_tokens').deleteMany({
        expires_at: { $lt: new Date() },
        used_at: null,
      });
      ok(`${r.deletedCount} token(s) purgé(s)`);
    }
  } else {
    ok('Aucun token expiré');
  }

  // ── 6) DONNÉES DE TEST RÉSIDUELLES ────────────────────────────────
  console.log('\n[6/7] Données de test résiduelles');
  // 🚨 Conditions cumulatives pour pouvoir supprimer automatiquement :
  //  - Le nom doit contenir teva|aracom|teka (préfixes autorisés)
  //  - ET l'email doit être manifestement un email de test (pas un vrai mail)
  // Cela protège le compte de Teva (tevageros@me.com) qui est légitime.
  const TEST_EMAIL_PATTERN = /(@e2e-test\.local$|\+test@|wizard.?e2e|e2e[-_.]test|@test\.|@example\.)/i;
  const candidates = await db.collection('organizations').find({
    $and: [
      { name: ALLOWED_TEST_NAME_PATTERN },
      { main_email: TEST_EMAIL_PATTERN },
    ],
  }).toArray();
  const testOrgs = candidates; // Déjà filtrés par AND
  // Détecter aussi tout reste suspect non auto-purgeable (pour info uniquement)
  const suspicious = await db.collection('organizations').find({
    main_email: TEST_EMAIL_PATTERN,
    name: { $not: ALLOWED_TEST_NAME_PATTERN },
  }).toArray();
  if (suspicious.length > 0) {
    warn(`${suspicious.length} org(s) avec email de test mais nom non autorisé — IGNORÉES (à traiter manuellement) :`);
    suspicious.forEach(o => warn(`   · "${o.name}" (${o.main_email}) id=${o.id}`));
  }
  if (testOrgs.length > 0) {
    issues++;
    warn(`${testOrgs.length} organisation(s) de test détectée(s)`);
    for (const o of testOrgs) {
      action(`Supprimer org="${o.name}" id=${o.id}`);
      if (!DRY_RUN) {
        const regs = await db.collection('registrations').find({ organization_id: o.id }).toArray();
        for (const r of regs) {
          if (r.visit_slot_id) await db.collection('visit_slots').updateOne({ id: r.visit_slot_id }, { $inc: { booked_count: -1 } });
          await db.collection('animation_slots').deleteMany({ registration_id: r.id });
          await db.collection('validation_requests').deleteMany({ registration_id: r.id });
          await db.collection('modification_tokens').deleteMany({ registration_id: r.id });
          await db.collection('registrations').deleteOne({ id: r.id });
        }
        await db.collection('organizations').deleteOne({ id: o.id });
      }
    }
  } else {
    ok('Aucune donnée de test résiduelle');
  }

  // ── 7) INTÉGRITÉ DES EXPOSANTS PROTÉGÉS ───────────────────────────
  console.log('\n[7/7] Intégrité des exposants protégés (whitelist intouchable)');
  let missingProtected = 0;
  for (const protName of PROTECTED_ORG_NAMES) {
    const o = await db.collection('organizations').findOne({ name: protName });
    if (!o) {
      issues++; missingProtected++;
      err(`Exposant protégé MANQUANT : "${protName}" — possible corruption DB`);
    } else {
      // Vérifie aussi qu'il y a une registration + un stand actif
      const reg = await db.collection('registrations').findOne({ organization_id: o.id });
      if (!reg) {
        issues++;
        err(`Exposant "${protName}" sans inscription`);
      }
    }
  }
  if (missingProtected === 0) {
    ok(`Tous les exposants protégés sont présents (${PROTECTED_ORG_NAMES.length}/${PROTECTED_ORG_NAMES.length})`);
  }

  // ── RÉCAP ─────────────────────────────────────────────────────────
  console.log('\n' + '━'.repeat(70));
  if (issues === 0) {
    console.log('✅ TOUS LES CHECKS OK — Base saine, prête pour la prod.');
  } else {
    console.log(`${DRY_RUN ? '⚠️ ' : '🔧'} ${issues} anomalie(s) détectée(s)${DRY_RUN ? ' — relance avec --apply pour corriger' : ' — corrigée(s)'}`);
  }
  console.log('━'.repeat(70));

  await client.close();
  process.exit(issues > 0 && DRY_RUN ? 2 : 0);
})().catch(e => {
  console.error('💥 Erreur :', e.message);
  process.exit(1);
});

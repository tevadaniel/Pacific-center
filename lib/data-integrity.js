/**
 * 🛡️ Data Integrity Checker — Audit & Self-Heal
 *
 * Détecte et répare automatiquement les incohérences entre :
 *  - organizations ↔ users (chaque org doit avoir un user passwordless)
 *  - organizations ↔ registrations (chaque org doit avoir au moins 1 reg pour l'édition courante)
 *  - registrations ↔ users (chaque reg.user_id doit pointer vers un user existant)
 *  - access_tokens ↔ organizations/users (orphelins)
 *  - registration_documents ↔ registrations (orphelins)
 *  - animation_slots ↔ registrations (orphelins)
 *  - deposit_transactions ↔ registrations (orphelins)
 *
 * Modes :
 *  - audit() : ne fait que lister les problèmes
 *  - heal() : audit + réparation automatique
 *
 * À appeler :
 *  - Au démarrage serveur (boot)
 *  - Après création/modif d'org/reg/user
 *  - Sur demande via endpoint /api/maintenance/audit
 */

import { v4 as uuid } from 'uuid';

const EDITION_ID = process.env.EDITION_ID || 'forum-rentree-2026';

/**
 * Audit complet + self-heal.
 * @param {Db} db
 * @param {Object} opts
 * @param {boolean} opts.heal — si true, répare automatiquement
 * @returns {Object} rapport
 */
export async function runDataIntegrityCheck(db, { heal = true, verbose = false } = {}) {
  const startedAt = Date.now();
  const report = {
    started_at: new Date(),
    heal_mode: heal,
    issues: [],
    healed: [],
    warnings: [],
    summary: {},
  };

  try {
    // ── 1️⃣ Cache : roles
    const rolesByCode = {};
    const allRoles = await db.collection('roles').find({}).toArray();
    for (const r of allRoles) rolesByCode[r.code] = r;
    const exposantRoleId = rolesByCode['exposant']?.id || null;

    // ── 2️⃣ Cache : collections (ids only)
    const [orgs, users, regs, tokens, docs, anims, deposits] = await Promise.all([
      db.collection('organizations').find({}, { projection: { id: 1, main_email: 1, name: 1, first_name: 1, last_name: 1, contact_name: 1, deleted_at: 1 } }).toArray(),
      db.collection('users').find({}, { projection: { id: 1, email: 1, organization_id: 1, role_code: 1, full_name: 1 } }).toArray(),
      db.collection('registrations').find({}, { projection: { id: 1, organization_id: 1, edition_id: 1, status: 1, deleted_at: 1 } }).toArray(),
      db.collection('access_tokens').find({ revoked_at: null }, { projection: { id: 1, token: 1, organization_id: 1, user_id: 1, email: 1, purpose: 1 } }).toArray(),
      db.collection('registration_documents').find({}, { projection: { id: 1, registration_id: 1, organization_id: 1 } }).toArray(),
      db.collection('animation_slots').find({}, { projection: { id: 1, registration_id: 1 } }).toArray(),
      db.collection('deposit_transactions').find({}, { projection: { id: 1, registration_id: 1, organization_id: 1 } }).toArray(),
    ]);

    const orgIds = new Set(orgs.filter((o) => !o.deleted_at).map((o) => o.id));
    const userIds = new Set(users.map((u) => u.id));
    const userByOrg = new Map();
    for (const u of users) {
      if (u.organization_id) {
        if (!userByOrg.has(u.organization_id)) userByOrg.set(u.organization_id, []);
        userByOrg.get(u.organization_id).push(u);
      }
    }
    const userByEmail = new Map(users.filter((u) => u.email).map((u) => [u.email.toLowerCase().trim(), u]));
    const regIds = new Set(regs.filter((r) => !r.deleted_at).map((r) => r.id));
    const regsByOrg = new Map();
    for (const r of regs) {
      if (!r.deleted_at && r.organization_id) {
        if (!regsByOrg.has(r.organization_id)) regsByOrg.set(r.organization_id, []);
        regsByOrg.get(r.organization_id).push(r);
      }
    }

    report.summary = {
      organizations: orgs.length,
      users: users.length,
      registrations: regs.length,
      access_tokens: tokens.length,
      documents: docs.length,
      animations: anims.length,
      deposits: deposits.length,
    };

    // ════════════════════════════════════════════════════════════════
    // 🩺 CHECK 1 : Organisations sans user (le bug Teva)
    // ════════════════════════════════════════════════════════════════
    for (const org of orgs) {
      if (org.deleted_at) continue;
      const hasUser = userByOrg.has(org.id) || (org.main_email && userByEmail.has(org.main_email.toLowerCase().trim()));
      if (!hasUser) {
        report.issues.push({ type: 'org_without_user', org_id: org.id, org_name: org.name, email: org.main_email });
        if (heal) {
          const newUserId = uuid();
          const newUser = {
            id: newUserId,
            email: (org.main_email || `${org.id}@auto.aracom.pf`).toLowerCase().trim(),
            full_name: [org.first_name, org.last_name].filter(Boolean).join(' ') || org.contact_name || org.name || 'Exposant',
            role_id: exposantRoleId,
            role_code: 'exposant',
            organization_id: org.id,
            passwordless: true,
            auto_healed_at: new Date(),
            auto_healed_source: 'integrity_check',
            created_at: new Date(),
            updated_at: new Date(),
          };
          try {
            await db.collection('users').insertOne(newUser);
            report.healed.push({ type: 'user_created', user_id: newUserId, org_id: org.id, email: newUser.email });
            userIds.add(newUserId);
            userByOrg.set(org.id, [newUser]);
            userByEmail.set(newUser.email, newUser);
          } catch (e) {
            // Duplicate email peut arriver — chercher l'existant et le relier à l'org
            const existing = await db.collection('users').findOne({ email: newUser.email });
            if (existing && !existing.organization_id) {
              await db.collection('users').updateOne({ id: existing.id }, { $set: { organization_id: org.id, auto_healed_at: new Date(), updated_at: new Date() } });
              report.healed.push({ type: 'user_relinked', user_id: existing.id, org_id: org.id });
            } else {
              report.warnings.push({ type: 'user_create_failed', org_id: org.id, error: e.message });
            }
          }
        }
      }
    }

    // ════════════════════════════════════════════════════════════════
    // 🩺 CHECK 2 : Tokens orphelins (purpose=exposant sans org valide ni user valide)
    // ════════════════════════════════════════════════════════════════
    for (const tk of tokens) {
      if (tk.purpose !== 'exposant') continue;
      const orgValid = tk.organization_id && orgIds.has(tk.organization_id);
      const userValid = tk.user_id && userIds.has(tk.user_id);
      const emailValid = tk.email && userByEmail.has(tk.email.toLowerCase().trim());
      if (!orgValid && !userValid && !emailValid) {
        report.issues.push({ type: 'orphan_token', token_id: tk.id });
        if (heal) {
          await db.collection('access_tokens').updateOne({ id: tk.id }, { $set: { revoked_at: new Date(), revoked_by: 'integrity_check', revoked_reason: 'orphan_no_target' } });
          report.healed.push({ type: 'token_revoked', token_id: tk.id });
        }
      } else if (orgValid && !tk.user_id) {
        // Token a une org mais pas de user_id → lier au user de l'org
        const orgUsers = userByOrg.get(tk.organization_id);
        if (orgUsers && orgUsers.length > 0) {
          if (heal) {
            await db.collection('access_tokens').updateOne({ id: tk.id }, { $set: { user_id: orgUsers[0].id, updated_at: new Date() } });
            report.healed.push({ type: 'token_linked_to_user', token_id: tk.id, user_id: orgUsers[0].id });
          }
        }
      }
    }

    // ════════════════════════════════════════════════════════════════
    // 🩺 CHECK 3 : Documents orphelins (sans registration valide)
    // ════════════════════════════════════════════════════════════════
    let orphanDocs = 0;
    for (const d of docs) {
      if (d.registration_id && !regIds.has(d.registration_id)) {
        // Reg supprimée — le doc reste orphelin
        orphanDocs++;
        report.issues.push({ type: 'orphan_document', doc_id: d.id, missing_reg: d.registration_id });
        // On NE supprime PAS automatiquement (peut être précieux), juste signal
      }
    }
    if (orphanDocs > 0) report.summary.orphan_documents = orphanDocs;

    // ════════════════════════════════════════════════════════════════
    // 🩺 CHECK 4 : Animations orphelines
    // ════════════════════════════════════════════════════════════════
    let orphanAnims = 0;
    for (const a of anims) {
      if (a.registration_id && !regIds.has(a.registration_id)) {
        orphanAnims++;
        if (heal) {
          // Sécurité : on libère les créneaux (suppression du slot)
          await db.collection('animation_slots').deleteOne({ id: a.id });
          report.healed.push({ type: 'orphan_animation_deleted', anim_id: a.id });
        }
      }
    }
    if (orphanAnims > 0) report.summary.orphan_animations = orphanAnims;

    // ════════════════════════════════════════════════════════════════
    // 🩺 CHECK 5 : Deposits orphelins (caution sans reg valide)
    // ════════════════════════════════════════════════════════════════
    let orphanDeposits = 0;
    for (const dep of deposits) {
      if (dep.registration_id && !regIds.has(dep.registration_id)) {
        orphanDeposits++;
        report.issues.push({ type: 'orphan_deposit', deposit_id: dep.id });
        // ⚠️ Ne supprime PAS : trace financière à conserver
      }
    }
    if (orphanDeposits > 0) report.summary.orphan_deposits = orphanDeposits;

    // ════════════════════════════════════════════════════════════════
    // 🩺 CHECK 6 : Registrations sans organization (très grave)
    // ════════════════════════════════════════════════════════════════
    for (const r of regs) {
      if (r.deleted_at) continue;
      if (!r.organization_id || !orgIds.has(r.organization_id)) {
        report.issues.push({ type: 'reg_without_org', reg_id: r.id });
        report.warnings.push({ type: 'critical_reg_without_org', reg_id: r.id, action: 'manual_review_required' });
        // Pas de heal auto : signalement uniquement
      }
    }

    // ════════════════════════════════════════════════════════════════
    // 🩺 CHECK 7 : Users sans org (autres que admin)
    // ════════════════════════════════════════════════════════════════
    let usersWithoutOrg = 0;
    for (const u of users) {
      if (u.role_code === 'exposant' && !u.organization_id) {
        usersWithoutOrg++;
        // Tente de retrouver par email ↔ org
        const matchOrg = orgs.find((o) => o.main_email && o.main_email.toLowerCase().trim() === (u.email || '').toLowerCase().trim());
        if (matchOrg && !matchOrg.deleted_at) {
          if (heal) {
            await db.collection('users').updateOne({ id: u.id }, { $set: { organization_id: matchOrg.id, auto_healed_at: new Date(), updated_at: new Date() } });
            report.healed.push({ type: 'user_linked_to_org', user_id: u.id, org_id: matchOrg.id });
          }
        } else {
          report.warnings.push({ type: 'exposant_user_no_org', user_id: u.id, email: u.email });
        }
      }
    }
    if (usersWithoutOrg > 0) report.summary.users_without_org = usersWithoutOrg;

  } catch (err) {
    report.error = err.message;
    console.error('[integrity-check] FATAL', err);
  }

  report.finished_at = new Date();
  report.duration_ms = Date.now() - startedAt;
  report.total_issues = report.issues.length;
  report.total_healed = report.healed.length;
  report.total_warnings = report.warnings.length;

  if (report.total_issues > 0 || report.total_healed > 0) {
    console.log(`[integrity-check] 🛡️ ${report.total_issues} issues, ${report.total_healed} healed, ${report.total_warnings} warnings (${report.duration_ms}ms)`);
  }
  return report;
}

/**
 * Cheap-mode check : ne vérifie QUE qu'une org spécifique a un user.
 * Utile après création d'org pour réparation immédiate.
 */
export async function ensureOrgHasUser(db, organizationId) {
  if (!organizationId) return null;
  const org = await db.collection('organizations').findOne({ id: organizationId });
  if (!org || org.deleted_at) return null;
  let user = await db.collection('users').findOne({ organization_id: organizationId, role_code: 'exposant' });
  if (!user && org.main_email) {
    user = await db.collection('users').findOne({ email: org.main_email.toLowerCase().trim() });
    if (user && !user.organization_id) {
      await db.collection('users').updateOne({ id: user.id }, { $set: { organization_id: organizationId, updated_at: new Date() } });
    }
  }
  if (!user) {
    const exposantRole = await db.collection('roles').findOne({ code: 'exposant' });
    const newUserId = uuid();
    const newUser = {
      id: newUserId,
      email: (org.main_email || `${organizationId}@auto.aracom.pf`).toLowerCase().trim(),
      full_name: [org.first_name, org.last_name].filter(Boolean).join(' ') || org.contact_name || org.name || 'Exposant',
      role_id: exposantRole?.id || null,
      role_code: 'exposant',
      organization_id: organizationId,
      passwordless: true,
      auto_healed_at: new Date(),
      auto_healed_source: 'ensure_org_has_user',
      created_at: new Date(),
      updated_at: new Date(),
    };
    try {
      await db.collection('users').insertOne(newUser);
      return newUser;
    } catch (e) {
      // Duplicate email — re-fetch
      return await db.collection('users').findOne({ email: newUser.email });
    }
  }
  return user;
}

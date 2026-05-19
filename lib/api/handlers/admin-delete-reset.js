import { v4 as uuid } from 'uuid';
import { json, err, getUserContext, logActivity, ensureRegistrationForOrg } from '../helpers';

/**
 * 🆕 SESSION 23 — Handlers admin de suppression / archive / reset granulaire.
 *
 * Tous ces endpoints sont réservés aux admins ARACOM (role=aracom_admin) et journalisés
 * dans activity_logs.
 *
 * Routes prises en charge :
 *   POST /api/admin/organizations/:id/archive
 *   POST /api/admin/organizations/:id/restore
 *   POST /api/admin/organizations/:id/delete
 *   POST /api/admin/registrations/:id/reset-caution
 *   POST /api/admin/registrations/:id/reset-virement
 *   POST /api/admin/registrations/:id/reset-convention
 *   POST /api/admin/registrations/:id/reset-attendance
 *   POST /api/admin/registrations/:id/reset-caution-appointment
 *   POST /api/admin/registrations/:id/reset-satisfaction
 *   POST /api/admin/registrations/:id/cancel-virement
 *
 * @param {object} args
 * @param {import('mongodb').Db} args.db
 * @param {Request} args.request
 * @param {string} args.route - p.join('/')
 * @param {string[]} args.p   - params.path
 * @param {object} args.body  - parsed JSON body
 * @param {object} args.deps  - dépendances injectées (sendMail, etc.)
 * @returns {Promise<Response|null>} - Response si la route est gérée, null sinon
 */
export async function handleAdminDeleteResetPost({ db, request, route, p, body, deps = {} }) {
  // 📦 ARCHIVER une organisation (soft delete)
  if (route.match(/^admin\/organizations\/[^/]+\/archive$/)) {
    const ctx = getUserContext(request);
    if (ctx.role !== 'aracom_admin') return err('Accès admin requis', 403);
    const orgId = p[2];
    const org = await db.collection('organizations').findOne({ id: orgId });
    if (!org) return err('Organisation introuvable', 404);
    if (org.archived_at) return err('Organisation déjà archivée', 400);
    const { reason } = body || {};
    await db.collection('organizations').updateOne(
      { id: orgId },
      { $set: {
        archived_at: new Date(),
        archived_by: ctx.userId || 'u-admin',
        archive_reason: reason || '',
        updated_at: new Date(),
      }}
    );
    await db.collection('registrations').updateMany(
      { organization_id: orgId },
      { $set: { status: 'annule', cancelled_at: new Date(), cancelled_by: 'admin_archive', updated_at: new Date() } }
    );
    const regs = await db.collection('registrations').find({ organization_id: orgId }).toArray();
    await db.collection('stand_assignments').updateMany(
      { registration_id: { $in: regs.map(r => r.id) }, status: { $nin: ['annule', 'cancelled'] } },
      { $set: { status: 'annule', updated_at: new Date() } }
    );
    await logActivity(db, ctx.userId, 'organization', orgId, 'archive', { name: org.name }, { reason });
    return json({ ok: true, action: 'archived', organization_id: orgId });
  }

  // ♻️ RESTAURER une organisation archivée
  if (route.match(/^admin\/organizations\/[^/]+\/restore$/)) {
    const ctx = getUserContext(request);
    if (ctx.role !== 'aracom_admin') return err('Accès admin requis', 403);
    const orgId = p[2];
    const org = await db.collection('organizations').findOne({ id: orgId });
    if (!org) return err('Organisation introuvable', 404);
    if (!org.archived_at) return err("Cette organisation n'est pas archivée", 400);
    await db.collection('organizations').updateOne(
      { id: orgId },
      { $unset: { archived_at: '', archived_by: '', archive_reason: '' }, $set: { updated_at: new Date() } }
    );
    await logActivity(db, ctx.userId, 'organization', orgId, 'restore', { name: org.name }, null);
    return json({ ok: true, action: 'restored', organization_id: orgId });
  }

  // 💥 SUPPRESSION DÉFINITIVE d'une organisation
  if (route.match(/^admin\/organizations\/[^/]+\/delete$/)) {
    const ctx = getUserContext(request);
    if (ctx.role !== 'aracom_admin') return err('Accès admin requis', 403);
    const orgId = p[2];
    const org = await db.collection('organizations').findOne({ id: orgId });
    if (!org) return err('Organisation introuvable', 404);
    const { confirm_name, force_unsafe } = body || {};
    if (!confirm_name || confirm_name.trim() !== (org.name || '').trim()) {
      return err(`Confirmation invalide. Saisissez exactement le nom de l'exposant : "${org.name}"`, 400);
    }
    const PROTECTED = ['I Mua Papeete', 'Dream Lab', 'ACE Arue', 'Budokan Judo Pirae', 'Lotus Bleu'];
    if (PROTECTED.includes(org.name) && !force_unsafe) {
      return err(`"${org.name}" est un exposant protégé. Utilisez force_unsafe=true pour passer outre (ou archivez-le).`, 403);
    }
    const regs = await db.collection('registrations').find({ organization_id: orgId }).toArray();
    const regIds = regs.map(r => r.id);
    const collections = [
      'stand_assignments', 'animation_slots', 'validation_requests', 'modification_tokens',
      'registration_documents', 'deposit_transactions', 'caution_appointments',
      'attendance_sessions', 'attendance_events', 'registration_anomalies',
      'field_comments', 'field_media', 'tasks_or_followups', 'email_messages',
      'post_event_reports',
    ];
    const counts = {};
    for (const c of collections) {
      const r = await db.collection(c).deleteMany({ registration_id: { $in: regIds } });
      counts[c] = r.deletedCount;
    }
    const orgScoped = ['organization_contacts', 'organization_history', 'organization_preferences', 'satisfaction_responses'];
    for (const c of orgScoped) {
      const r = await db.collection(c).deleteMany({ organization_id: orgId });
      counts[c] = r.deletedCount;
    }
    await db.collection('registrations').deleteMany({ organization_id: orgId });
    await db.collection('organizations').deleteOne({ id: orgId });
    await db.collection('users').updateMany(
      { organization_id: orgId },
      { $set: { is_active: false, updated_at: new Date() } }
    );
    // 🛡️ SESSION 43-e — LEDGER DE SUPPRESSION DÉFINITIVE (tombstone)
    //   Inscrit l'org_id dans une collection persistante. Toutes les listes filtrent
    //   ce ledger pour garantir qu'un exposant supprimé NE REVIENT JAMAIS, même si :
    //    - Un seed ou un import réinsère par erreur l'org
    //    - Un redéploiement reset partiel la collection organizations
    //    - Un bug crée un doublon avec le même id
    //   Pour réellement "restaurer" un exposant supprimé, il faut explicitement enlever
    //   son id du ledger via POST /api/admin/deletions-ledger/:id/forgive.
    await db.collection('deleted_org_ledger').updateOne(
      { org_id: orgId },
      { $set: {
        org_id: orgId,
        org_name: org.name,
        org_email: org.main_email || null,
        deleted_at: new Date(),
        deleted_by: ctx.userId || 'u-admin',
        force_unsafe: !!force_unsafe,
        cascaded_counts: counts,
        reg_ids: regIds,
      }},
      { upsert: true }
    );
    await logActivity(db, ctx.userId, 'organization', orgId, 'delete_definitive', { name: org.name, force_unsafe: !!force_unsafe }, { cascaded: counts, reg_ids: regIds });
    return json({ ok: true, action: 'permanently_deleted', organization_id: orgId, cascaded: counts });
  }

  // 🔄 SWAP STAND — échange les stands de 2 inscriptions (même venue)
  //   POST /api/admin/registrations/:id/swap-stand  body: { other_registration_id }
  //   Marche même si les 2 regs sont verrouillées (admin override).
  if (route.match(/^admin\/registrations\/[^/]+\/swap-stand$/)) {
    const ctx = getUserContext(request);
    if (ctx.role !== 'aracom_admin') return err('Accès admin requis', 403);
    const regAId = p[2];
    const { other_registration_id: regBId } = body || {};
    if (!regBId) return err('other_registration_id requis', 400);
    if (regAId === regBId) return err('Les deux inscriptions doivent être différentes', 400);
    const regA = await db.collection('registrations').findOne({ id: regAId });
    const regB = await db.collection('registrations').findOne({ id: regBId });
    if (!regA || !regB) return err('Une des inscriptions est introuvable', 404);
    if (regA.venue_id !== regB.venue_id) return err('Les deux stands doivent être sur le même site', 400);
    const standA = regA.stand_code;
    const standB = regB.stand_code;
    if (!standA && !standB) return err('Au moins une des inscriptions doit avoir un stand', 400);
    const now = new Date();
    // 1) Swap stand_code dans les registrations
    await db.collection('registrations').updateOne({ id: regAId }, { $set: { stand_code: standB || null, updated_at: now, last_swap_at: now, last_swap_by: ctx.userId || 'u-admin' } });
    await db.collection('registrations').updateOne({ id: regBId }, { $set: { stand_code: standA || null, updated_at: now, last_swap_at: now, last_swap_by: ctx.userId || 'u-admin' } });
    // 2) Swap stand_assignments (les liens stand <-> registration)
    const aA = await db.collection('stand_assignments').findOne({ registration_id: regAId, status: { $nin: ['annule', 'cancelled'] } });
    const aB = await db.collection('stand_assignments').findOne({ registration_id: regBId, status: { $nin: ['annule', 'cancelled'] } });
    if (aA && aB) {
      const tmpStandId = aA.venue_stand_id;
      await db.collection('stand_assignments').updateOne({ id: aA.id }, { $set: { venue_stand_id: aB.venue_stand_id, updated_at: now } });
      await db.collection('stand_assignments').updateOne({ id: aB.id }, { $set: { venue_stand_id: tmpStandId, updated_at: now } });
    } else if (aA && !aB) {
      await db.collection('stand_assignments').updateOne({ id: aA.id }, { $set: { registration_id: regBId, updated_at: now } });
    } else if (!aA && aB) {
      await db.collection('stand_assignments').updateOne({ id: aB.id }, { $set: { registration_id: regAId, updated_at: now } });
    }
    await logActivity(db, ctx.userId, 'registration', regAId, 'swap_stand', { with: regBId }, { swapped: { [regAId]: { from: standA, to: standB }, [regBId]: { from: standB, to: standA } } });
    return json({ ok: true, action: 'stands_swapped', stand_a_was: standA, stand_b_was: standB, registration_a: { id: regAId, stand_code: standB }, registration_b: { id: regBId, stand_code: standA } });
  }

  // 🔧 FORCE-CHANGE STAND — admin force le stand même si l'inscription est verrouillée
  //   POST /api/admin/registrations/:id/force-stand  body: { stand_id (libre) OU stand_code }
  if (route.match(/^admin\/registrations\/[^/]+\/force-stand$/)) {
    const ctx = getUserContext(request);
    if (ctx.role !== 'aracom_admin') return err('Accès admin requis', 403);
    const regId = p[2];
    const { stand_id, stand_code } = body || {};
    if (!stand_id && !stand_code) return err('stand_id ou stand_code requis', 400);
    const reg = await db.collection('registrations').findOne({ id: regId });
    if (!reg) return err('Inscription introuvable', 404);
    let stand = null;
    if (stand_id) {
      stand = await db.collection('venue_stands').findOne({ id: stand_id });
    } else if (stand_code) {
      stand = await db.collection('venue_stands').findOne({ venue_id: reg.venue_id, stand_code });
    }
    if (!stand) return err('Stand introuvable sur ce site', 404);
    // Vérifie qu'il n'est pas déjà pris (sauf si c'est le mien)
    const occupant = await db.collection('stand_assignments').findOne({ venue_stand_id: stand.id, status: { $nin: ['annule', 'cancelled'] } });
    if (occupant && occupant.registration_id !== regId) {
      return err(`Ce stand est déjà occupé par une autre inscription. Utilisez /swap-stand pour échanger.`, 409);
    }
    const now = new Date();
    // Libère l'ancien stand de cette reg (s'il y en a un)
    await db.collection('stand_assignments').updateMany(
      { registration_id: regId, status: { $nin: ['annule', 'cancelled'] }, venue_stand_id: { $ne: stand.id } },
      { $set: { status: 'annule', updated_at: now } }
    );
    // Crée ou réactive l'assignment sur le nouveau stand
    if (occupant && occupant.registration_id === regId) {
      // déjà là, rien à faire
    } else {
      await db.collection('stand_assignments').insertOne({
        id: 'sa-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
        registration_id: regId,
        venue_id: reg.venue_id,
        venue_stand_id: stand.id,
        stand_code: stand.stand_code,
        status: 'pre_reserve',
        source: 'admin_force',
        created_at: now,
        updated_at: now,
      });
    }
    await db.collection('registrations').updateOne({ id: regId }, { $set: { stand_code: stand.stand_code, updated_at: now } });
    await logActivity(db, ctx.userId, 'registration', regId, 'force_stand', { stand_code: stand.stand_code }, { was_locked: !!reg.is_locked });
    return json({ ok: true, action: 'stand_forced', stand_code: stand.stand_code });
  }


  // 🔄 RESET CAUTION
  if (route.match(/^admin\/registrations\/[^/]+\/reset-caution$/)) {
    const ctx = getUserContext(request);
    if (ctx.role !== 'aracom_admin') return err('Accès admin requis', 403);
    const regId = p[2];
    const reg = await db.collection('registrations').findOne({ id: regId });
    if (!reg) return err('Inscription introuvable', 404);
    const dep = await db.collection('deposit_transactions').findOne({ registration_id: regId });
    if (!dep) return err('Aucune caution à réinitialiser', 404);
    await db.collection('deposit_transactions').updateOne(
      { registration_id: regId },
      { $set: {
        status: 'en_attente',
        received_at: null,
        received_by: null,
        virement_reference: null,
        virement_date: null,
        virement_declared_at: null,
        virement_validated_at: null,
        virement_validated_by: null,
        updated_at: new Date(),
      }}
    );
    await db.collection('registration_documents').updateMany(
      { registration_id: regId, document_type: 'recu' },
      { $set: { status: 'remplace', updated_at: new Date() } }
    );
    await db.collection('registrations').updateOne(
      { id: regId },
      { $set: { is_locked: false, updated_at: new Date() } }
    );
    await logActivity(db, ctx.userId, 'registration', regId, 'reset_caution', { previous_status: dep.status }, null);
    return json({ ok: true, action: 'caution_reset' });
  }

  // 🔄 RESET VIREMENT
  if (route.match(/^admin\/registrations\/[^/]+\/reset-virement$/)) {
    const ctx = getUserContext(request);
    if (ctx.role !== 'aracom_admin') return err('Accès admin requis', 403);
    const regId = p[2];
    const reg = await db.collection('registrations').findOne({ id: regId });
    if (!reg) return err('Inscription introuvable', 404);
    const r = await db.collection('deposit_transactions').updateOne(
      { registration_id: regId },
      { $set: {
        virement_reference: null,
        virement_date: null,
        virement_declared_at: null,
        virement_validated_at: null,
        virement_validated_by: null,
        updated_at: new Date(),
      }}
    );
    if (r.matchedCount === 0) return err('Aucune déclaration de virement à annuler', 404);
    await logActivity(db, ctx.userId, 'registration', regId, 'reset_virement', null, null);
    return json({ ok: true, action: 'virement_cleared' });
  }

  // 🔄 RESET CONVENTION
  if (route.match(/^admin\/registrations\/[^/]+\/reset-convention$/)) {
    const ctx = getUserContext(request);
    if (ctx.role !== 'aracom_admin') return err('Accès admin requis', 403);
    const regId = p[2];
    const reg = await db.collection('registrations').findOne({ id: regId });
    if (!reg) return err('Inscription introuvable', 404);
    const r = await db.collection('registration_documents').updateMany(
      { registration_id: regId, document_type: 'convention', status: { $ne: 'remplace' } },
      { $set: { status: 'remplace', is_signed: false, updated_at: new Date() } }
    );
    await db.collection('registrations').updateOne(
      { id: regId },
      { $set: { convention_signed_at: null, updated_at: new Date() } }
    );
    await logActivity(db, ctx.userId, 'registration', regId, 'reset_convention', null, { documents_marked: r.modifiedCount });
    return json({ ok: true, action: 'convention_reset', documents_marked: r.modifiedCount });
  }

  // 🔄 RESET ATTENDANCE
  if (route.match(/^admin\/registrations\/[^/]+\/reset-attendance$/)) {
    const ctx = getUserContext(request);
    if (ctx.role !== 'aracom_admin') return err('Accès admin requis', 403);
    const regId = p[2];
    const { event_date, scope } = body || {};
    const q = { registration_id: regId };
    if (event_date) q.event_date = event_date;
    const sessions = await db.collection('attendance_sessions').find(q).toArray();
    if (sessions.length === 0) return err('Aucune session à réinitialiser', 404);
    let unset = {};
    const set = { updated_at: new Date(), presence_status: 'attendu' };
    if (scope === 'arrival') {
      unset = { actual_arrival_time: '', arrival_checked_by: '' };
    } else if (scope === 'departure') {
      unset = { actual_departure_time: '', departure_checked_by: '', departure_stand_condition: '' };
    } else {
      unset = { actual_arrival_time: '', actual_departure_time: '', arrival_checked_by: '', departure_checked_by: '', departure_stand_condition: '' };
    }
    const sessionIds = sessions.map(s => s.id);
    await db.collection('attendance_sessions').updateMany(
      { id: { $in: sessionIds } },
      { $unset: unset, $set: set }
    );
    await db.collection('attendance_events').deleteMany({ attendance_session_id: { $in: sessionIds } });
    await db.collection('registration_anomalies').deleteMany({
      attendance_session_id: { $in: sessionIds },
      anomaly_type: { $in: ['retard_important', 'depart_avant_heure'] },
    });
    await logActivity(db, ctx.userId, 'registration', regId, 'reset_attendance', { scope, event_date }, { sessions: sessionIds.length });
    return json({ ok: true, action: 'attendance_reset', sessions: sessionIds.length, scope: scope || 'all' });
  }

  // 🔄 RESET CAUTION-APPOINTMENT
  if (route.match(/^admin\/registrations\/[^/]+\/reset-caution-appointment$/)) {
    const ctx = getUserContext(request);
    if (ctx.role !== 'aracom_admin') return err('Accès admin requis', 403);
    const regId = p[2];
    const r = await db.collection('caution_appointments').deleteOne({ registration_id: regId });
    if (r.deletedCount === 0) return err('Aucun RDV à supprimer', 404);
    await logActivity(db, ctx.userId, 'registration', regId, 'reset_caution_appointment', null, null);
    return json({ ok: true, action: 'caution_appointment_deleted' });
  }

  // 🔄 RESET SATISFACTION
  if (route.match(/^admin\/registrations\/[^/]+\/reset-satisfaction$/)) {
    const ctx = getUserContext(request);
    if (ctx.role !== 'aracom_admin') return err('Accès admin requis', 403);
    const regId = p[2];
    const reg = await db.collection('registrations').findOne({ id: regId });
    if (!reg) return err('Inscription introuvable', 404);
    const r = await db.collection('satisfaction_responses').deleteOne({ organization_id: reg.organization_id });
    await db.collection('registration_documents').updateMany(
      { registration_id: regId, document_type: 'attestation_remboursement', is_signed: { $ne: true } },
      { $set: { status: 'remplace', updated_at: new Date() } }
    );
    await logActivity(db, ctx.userId, 'registration', regId, 'reset_satisfaction', null, { had_response: r.deletedCount > 0 });
    return json({ ok: true, action: 'satisfaction_reset', had_response: r.deletedCount > 0 });
  }

  // 🆕 CANCEL VIREMENT (alias explicite)
  if (route.match(/^admin\/registrations\/[^/]+\/cancel-virement$/)) {
    const ctx = getUserContext(request);
    if (ctx.role !== 'aracom_admin') return err('Accès admin requis', 403);
    const regId = p[2];
    await db.collection('deposit_transactions').updateOne(
      { registration_id: regId },
      { $set: {
        status: 'en_attente',
        received_at: null,
        virement_reference: null,
        virement_date: null,
        virement_validated_at: null,
        virement_validated_by: null,
        updated_at: new Date(),
      }}
    );
    await db.collection('registration_documents').updateMany(
      { registration_id: regId, document_type: 'recu' },
      { $set: { status: 'remplace', updated_at: new Date() } }
    );
    await db.collection('registrations').updateOne(
      { id: regId },
      { $set: { is_locked: false, updated_at: new Date() } }
    );
    await logActivity(db, ctx.userId, 'registration', regId, 'cancel_virement', null, null);
    return json({ ok: true, action: 'virement_cancelled' });
  }

  // 🔓 UNLOCK CANDIDATURE — Permet à l'exposant de modifier à nouveau site/stand/animations
  if (route.match(/^admin\/registrations\/[^/]+\/unlock-candidature$/)) {
    const ctx = getUserContext(request);
    if (ctx.role !== 'aracom_admin') return err('Accès admin requis', 403);
    const regId = p[2];
    const reg = await db.collection('registrations').findOne({ id: regId });
    if (!reg) return err('Inscription introuvable', 404);
    await db.collection('registrations').updateOne(
      { id: regId },
      { $set: {
        candidature_locked: false,
        candidature_unlocked_at: new Date(),
        candidature_unlocked_by: ctx.userId || 'u-admin',
        updated_at: new Date(),
      }}
    );
    // Annuler aussi la demande de validation pendante pour permettre une nouvelle soumission
    await db.collection('validation_requests').updateMany(
      { registration_id: regId, status: { $in: ['en_attente', 'rdv_fixe'] } },
      { $set: { status: 'annulee', cancelled_at: new Date(), updated_at: new Date() } }
    );
    await logActivity(db, ctx.userId, 'registration', regId, 'unlock_candidature', null, null);
    return json({ ok: true, action: 'candidature_unlocked' });
  }

  // 🆕 SESSION 28d — INITIALIZE REGISTRATION pour une organisation existante (sans dossier 2026)
  // Cas d'usage : l'admin a inscrit manuellement une organisation en base mais aucune registration n'a été créée.
  // L'exposant voit alors le message "Votre dossier n'a pas encore été initialisé".
  // Ce endpoint crée la registration manquante en un clic.
  if (route.match(/^admin\/organizations\/[^/]+\/initialize-registration$/)) {
    const ctx = getUserContext(request);
    if (ctx.role !== 'aracom_admin') return err('Accès admin requis', 403);
    const orgId = p[2];
    const org = await db.collection('organizations').findOne({ id: orgId });
    if (!org) return err('Organisation introuvable', 404);

    // Vérifie qu'il n'existe pas déjà une registration 2026 active pour cette org
    const EDITION_ID_LOCAL = 'edition-2026';
    const existing = await db.collection('registrations').findOne({
      organization_id: orgId,
      edition_id: EDITION_ID_LOCAL,
      status: { $ne: 'annule' },
    });
    if (existing) return err(`Cette organisation a déjà un dossier 2026 (${existing.id}). Ouvrez sa fiche pour le voir.`, 400);

    // Paramètres optionnels venant du body
    const { venue_id, status, source } = body || {};

    const newRegId = `reg-${orgId}-${uuid().slice(0, 8)}`;
    const newReg = {
      id: newRegId,
      edition_id: EDITION_ID_LOCAL,
      organization_id: orgId,
      venue_id: venue_id || null,
      stand_code: null,
      status: status || 'a_confirmer',
      site_priority: 1,
      completion_percent: 5,
      wizard_step: venue_id ? 2 : 1,
      source: source || 'admin_manual',
      is_locked: false,
      is_deposit_received: false,
      is_convention_signed: false,
      is_insurance_uploaded: false,
      candidature_locked: false,
      created_at: new Date(),
      updated_at: new Date(),
      created_by: ctx.userId || 'u-admin',
    };
    await db.collection('registrations').insertOne(newReg);

    await logActivity(db, ctx.userId, 'organization', orgId, 'initialize_registration', null, {
      registration_id: newRegId,
      venue_id: venue_id || null,
      org_name: org.name,
    });

    return json({ ok: true, action: 'registration_initialized', registration_id: newRegId, organization_id: orgId });
  }

  // 🆕 SESSION 28i — AUTO-REPAIR : Crée un dossier 2026 pour TOUTES les orgs sans registration
  // Réparation en masse — utile après import Excel ou pour réparer une base héritée.
  if (route === 'admin/auto-repair/initialize-all-missing-registrations') {
    const ctx = getUserContext(request);
    if (ctx.role !== 'aracom_admin') return err('Accès admin requis', 403);
    const allOrgs = await db.collection('organizations').find({
      $and: [
        { $or: [{ archived_at: null }, { archived_at: { $exists: false } }] },
        { $or: [{ is_mailing_only: { $ne: true } }, { is_mailing_only: { $exists: false } }] },
      ],
    }).toArray();
    let created = 0, alreadyOk = 0, errors = [];
    for (const org of allOrgs) {
      try {
        const existingId = await db.collection('registrations').findOne({
          organization_id: org.id,
          status: { $ne: 'annule' },
        });
        if (existingId) { alreadyOk++; continue; }
        const regId = await ensureRegistrationForOrg(db, org.id, { source: 'auto_repair_bulk' });
        if (regId) created++;
      } catch (e) {
        errors.push(`${org.name || org.id}: ${e.message}`);
      }
    }
    await logActivity(db, ctx.userId, 'system', 'auto_repair', 'initialize_all_missing', null, { created, alreadyOk, errors: errors.length });
    return json({ ok: true, action: 'auto_repair_done', created, already_ok: alreadyOk, errors });
  }

  // 🆕 SESSION 28g — LINK USER TO ORGANIZATION
  // Lie un compte utilisateur existant à une organisation existante
  if (route.match(/^admin\/users\/[^/]+\/link-organization$/)) {
    const ctx = getUserContext(request);
    if (ctx.role !== 'aracom_admin') return err('Accès admin requis', 403);
    const userId = p[2];
    const { organization_id } = body || {};
    if (!organization_id) return err('organization_id requis dans le body', 400);

    const user = await db.collection('users').findOne({ id: userId });
    if (!user) return err('Utilisateur introuvable', 404);
    const org = await db.collection('organizations').findOne({ id: organization_id });
    if (!org) return err('Organisation introuvable', 404);

    const oldOrgId = user.organization_id || null;
    await db.collection('users').updateOne(
      { id: userId },
      { $set: {
        organization_id,
        // Si pas de role_code, assigne 'exposant' par défaut
        role_code: user.role_code || 'exposant',
        updated_at: new Date(),
        linked_at: new Date(),
        linked_by: ctx.userId || 'u-admin',
      }}
    );
    await logActivity(db, ctx.userId, 'user', userId, 'link_organization',
      { old_organization_id: oldOrgId },
      { new_organization_id: organization_id, org_name: org.name }
    );
    return json({ ok: true, action: 'user_linked', user_id: userId, organization_id });
  }

  return null; // Route non gérée par ce module
}

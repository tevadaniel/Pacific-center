import { v4 as uuid } from 'uuid';
import { json, err, getUserContext, logActivity } from '../helpers';

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
    await logActivity(db, ctx.userId, 'organization', orgId, 'delete_definitive', { name: org.name, force_unsafe: !!force_unsafe }, { cascaded: counts, reg_ids: regIds });
    return json({ ok: true, action: 'permanently_deleted', organization_id: orgId, cascaded: counts });
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

  return null; // Route non gérée par ce module
}

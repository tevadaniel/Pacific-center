import { v4 as uuid } from 'uuid';
import { json, err, getUserContext } from '../helpers';

/**
 * Handler POST validation — Valide/Refuse/Bulk de demandes stand/animation.
 *
 * Routes :
 *   POST /api/admin/validation/:id/validate
 *   POST /api/admin/validation/:id/refuse
 *   POST /api/admin/validation/bulk
 *   POST /api/admin/validation-deadline
 *
 * Helpers internes :
 *   - buildExposantEmailTemplate : génère un template d'email validé/refusé/promu
 *   - promoteNextInWaitlist : promeut le #1 waitlist après un refus
 *
 * Retourne null si la route ne matche pas (le dispatcher continue).
 *
 * @param {object} args
 * @param {import('mongodb').Db} args.db
 * @param {Request} args.request
 * @param {string} args.route
 * @param {object} args.body
 */
export async function handleValidationPost({ db, request, route, body }) {
  const ctx = getUserContext(request);

  // ──────────────────────────────────────────────────────────
  // Helpers internes (closures sur db)
  // ──────────────────────────────────────────────────────────
  async function buildExposantEmailTemplate(registration_id, action, context = {}) {
    try {
      const reg = await db.collection('registrations').findOne({ id: registration_id });
      if (!reg) return null;
      const org = await db.collection('organizations').findOne({ id: reg.organization_id });
      if (!org) return null;
      const orgName = org.name || 'votre association';
      const venue = reg.venue_id ? await db.collection('venues').findOne({ id: reg.venue_id }) : null;
      const venueName = venue?.name || '';
      const kind = context.kind === 'animation' ? 'animation' : 'stand';
      const standCode = context.stand_code || reg.stand_code || '';
      const standOrAnim = kind === 'stand'
        ? (standCode ? `<b>stand ${standCode}</b>` : 'votre stand')
        : (context.day_label ? `créneau d'animation du ${context.day_label === 'samedi' ? 'samedi' : 'vendredi'} ${context.start_time || ''}–${context.end_time || ''}` : 'votre créneau d\'animation');
      let subject = '';
      let body2 = '';
      if (action === 'validated') {
        subject = `[Forum 2026] ✅ Votre ${kind === 'stand' ? 'stand' : 'créneau d\'animation'} est confirmé !`;
        body2 = `<p>Bonjour ${orgName},</p>
<p>Excellente nouvelle ! Votre demande pour ${standOrAnim}${venueName ? ` sur le site <b>${venueName}</b>` : ''} vient d'être <b>validée par ARACOM</b>. 🎉</p>
<p>Votre place est maintenant officiellement confirmée pour le Forum de la Rentrée des 14 & 15 août 2026.</p>
<p>Vous pouvez désormais finaliser votre dossier (caution, convention, documents) directement depuis votre espace personnel.</p>
<p>[[MON_ESPACE]]</p>
<p>À très bientôt,<br/>L'équipe ARACOM</p>`;
      } else if (action === 'refused') {
        const reason = context.reason || 'Demande refusée';
        subject = `[Forum 2026] Concernant votre demande de ${kind === 'stand' ? 'stand' : 'créneau'}`;
        body2 = `<p>Bonjour ${orgName},</p>
<p>Nous vous remercions pour votre intérêt pour le Forum de la Rentrée 2026.</p>
<p>Malheureusement, votre demande pour ${standOrAnim}${venueName ? ` sur le site <b>${venueName}</b>` : ''} <b>n'a pas pu être retenue</b>.</p>
<p><b>Motif :</b> ${reason}</p>
<p>Nous restons à votre disposition pour vous proposer une alternative (autre stand, autre site ou autre créneau). N'hésitez pas à nous recontacter ou à modifier votre demande depuis votre espace.</p>
<p>[[MON_ESPACE]]</p>
<p>Cordialement,<br/>L'équipe ARACOM</p>`;
      } else if (action === 'promoted') {
        subject = `[Forum 2026] 🎉 Vous êtes promu(e) — votre ${kind === 'stand' ? 'stand' : 'créneau'} est disponible !`;
        body2 = `<p>Bonjour ${orgName},</p>
<p>Bonne nouvelle ! Vous étiez en <b>liste d'attente</b> sur ${standOrAnim}${venueName ? ` sur le site <b>${venueName}</b>` : ''}. La place s'étant libérée, votre demande passe automatiquement <b>en attente de validation</b> par ARACOM.</p>
<p>Aucune action n'est requise de votre part pour l'instant — ARACOM va examiner votre dossier et vous tiendra informé.e dans les meilleurs délais.</p>
<p>[[MON_ESPACE]]</p>
<p>Cordialement,<br/>L'équipe ARACOM</p>`;
      }
      return {
        registration_id,
        organization_name: orgName,
        organization_email: org.main_email || null,
        subject,
        body_html: body2,
        mail_type: action === 'validated' ? 'confirmation' : 'info_pratique',
      };
    } catch (e) {
      console.error('[buildExposantEmailTemplate] error', e?.message);
      return null;
    }
  }

  async function promoteNextInWaitlist(refusedAsn, kind) {
    const collName = kind === 'stand' ? 'stand_assignments' : 'animation_slots';
    const filter = kind === 'stand'
      ? { venue_stand_id: refusedAsn.venue_stand_id, request_status: 'waitlist', status: { $nin: ['annule', 'cancelled', 'annulé'] }, id: { $ne: refusedAsn.id } }
      : { venue_id: refusedAsn.venue_id, day_label: refusedAsn.day_label, location_type: refusedAsn.location_type, start_time: refusedAsn.start_time, end_time: refusedAsn.end_time, request_status: 'waitlist', status: { $ne: 'annulé' }, id: { $ne: refusedAsn.id } };
    const waitlist = await db.collection(collName).find(filter).sort({ waitlist_position: 1, request_submitted_at: 1 }).toArray();
    if (waitlist.length === 0) return null;
    const promoted = waitlist[0];
    await db.collection(collName).updateOne(
      { id: promoted.id },
      { $set: { request_status: 'pending', waitlist_position: null, promoted_at: new Date(), updated_at: new Date() } }
    );
    for (let i = 1; i < waitlist.length; i++) {
      await db.collection(collName).updateOne(
        { id: waitlist[i].id },
        { $set: { waitlist_position: Math.max(1, (waitlist[i].waitlist_position || i + 1) - 1), updated_at: new Date() } }
      );
    }
    await db.collection('activity_logs').insertOne({
      id: uuid(),
      actor_user_id: 'system',
      action: 'WAITLIST_AUTO_PROMOTE',
      description: `Promotion auto de l'exposant ${promoted.registration_id} suite au refus de ${refusedAsn.registration_id}`,
      metadata: { kind, promoted_id: promoted.id, refused_id: refusedAsn.id },
      created_at: new Date(),
    });
    const template = await buildExposantEmailTemplate(promoted.registration_id, 'promoted', {
      kind,
      stand_code: promoted.stand_code,
      day_label: promoted.day_label,
      start_time: promoted.start_time,
      end_time: promoted.end_time,
    });
    return { promoted_assignment: promoted, email_template: template };
  }

  // ──────────────────────────────────────────────────────────
  // POST /api/admin/validation/:id/validate
  // ──────────────────────────────────────────────────────────
  if (route.startsWith('admin/validation/') && route.endsWith('/validate')) {
    if (ctx.role !== 'aracom_admin') return err('Réservé ARACOM', 403);
    const targetId = route.split('/')[2];
    let asn = await db.collection('stand_assignments').findOne({ id: targetId });
    let kind = 'stand';
    if (!asn) {
      asn = await db.collection('animation_slots').findOne({ id: targetId });
      kind = 'animation';
    }
    if (!asn) return err('Demande introuvable', 404);

    // 🆕 GARDE-FOU CRITIQUE — Règle métier : 1 animation obligatoire par jour de présence
    if (kind === 'stand' && !body?.force_validate) {
      const reg = await db.collection('registrations').findOne({ id: asn.registration_id });
      const attendingDays = reg?.attending_days || [];
      if (attendingDays.length > 0) {
        const existingAnims = await db.collection('animation_slots').find({
          registration_id: asn.registration_id,
          status: { $ne: 'annulé' },
          request_status: { $in: ['pending', 'validated'] },
        }).toArray();
        const daysWithAnim = new Set(existingAnims.map(a => a.day_label));
        const missingDays = attendingDays.filter(d => !daysWithAnim.has(d));
        if (missingDays.length > 0) {
          const daysLabel = missingDays.map(d => d === 'samedi' ? 'samedi 15/08' : 'vendredi 14/08').join(', ');
          return err(
            `❌ Validation impossible : ce dossier n'a pas d'animation déclarée pour ${daysLabel}. ` +
            `La règle impose 1 animation OBLIGATOIRE par jour de présence. ` +
            `Demandez à l'exposant de compléter ses animations, ou ajoutez "force_validate: true" pour passer outre (déconseillé).`,
            422
          );
        }
      }
    }

    const collName = kind === 'stand' ? 'stand_assignments' : 'animation_slots';
    await db.collection(collName).updateOne(
      { id: targetId },
      { $set: { request_status: 'validated', validated_at: new Date(), validated_by: ctx.userId || 'u-admin', updated_at: new Date() } }
    );
    await db.collection('activity_logs').insertOne({
      id: uuid(),
      actor_user_id: ctx.userId || 'u-admin',
      action: 'VALIDATION_VALIDATE',
      description: `Validation ${kind} ${targetId}${body?.force_validate ? ' (FORCED — sans animation complète)' : ''}`,
      metadata: { kind, target_id: targetId, registration_id: asn.registration_id, forced: !!body?.force_validate },
      created_at: new Date(),
    });
    const emailTemplate = await buildExposantEmailTemplate(asn.registration_id, 'validated', {
      kind,
      stand_code: asn.stand_code,
      day_label: asn.day_label,
      start_time: asn.start_time,
      end_time: asn.end_time,
    });
    return json({ ok: true, kind, target_id: targetId, request_status: 'validated', email_template: emailTemplate });
  }

  // ──────────────────────────────────────────────────────────
  // POST /api/admin/validation/:id/refuse
  // ──────────────────────────────────────────────────────────
  if (route.startsWith('admin/validation/') && route.endsWith('/refuse')) {
    if (ctx.role !== 'aracom_admin') return err('Réservé ARACOM', 403);
    const targetId = route.split('/')[2];
    const reason = body?.reason || 'Refusé par ARACOM';
    let asn = await db.collection('stand_assignments').findOne({ id: targetId });
    let kind = 'stand';
    if (!asn) {
      asn = await db.collection('animation_slots').findOne({ id: targetId });
      kind = 'animation';
    }
    if (!asn) return err('Demande introuvable', 404);
    const collName = kind === 'stand' ? 'stand_assignments' : 'animation_slots';
    await db.collection(collName).updateOne(
      { id: targetId },
      { $set: { request_status: 'refused', refused_reason: reason, validated_at: new Date(), validated_by: ctx.userId || 'u-admin', status: 'annule', updated_at: new Date() } }
    );
    await db.collection('activity_logs').insertOne({
      id: uuid(),
      actor_user_id: ctx.userId || 'u-admin',
      action: 'VALIDATION_REFUSE',
      description: `Refus ${kind} ${targetId} : ${reason}`,
      metadata: { kind, target_id: targetId, registration_id: asn.registration_id, reason },
      created_at: new Date(),
    });
    const promotion = await promoteNextInWaitlist(asn, kind);
    const refusedTemplate = await buildExposantEmailTemplate(asn.registration_id, 'refused', {
      kind,
      stand_code: asn.stand_code,
      day_label: asn.day_label,
      start_time: asn.start_time,
      end_time: asn.end_time,
      reason,
    });
    let nextInfo = null;
    if (promotion?.promoted_assignment) {
      const pReg = await db.collection('registrations').findOne({ id: promotion.promoted_assignment.registration_id });
      const pOrg = pReg ? await db.collection('organizations').findOne({ id: pReg.organization_id }) : null;
      nextInfo = {
        assignment_id: promotion.promoted_assignment.id,
        registration_id: promotion.promoted_assignment.registration_id,
        organization_name: pOrg?.name,
        waitlist_position: 1,
      };
    }
    return json({
      ok: true,
      kind,
      target_id: targetId,
      request_status: 'refused',
      reason,
      next_in_waitlist: nextInfo,
      email_template: refusedTemplate,
      promoted_email_template: promotion?.email_template || null,
    });
  }

  // ──────────────────────────────────────────────────────────
  // POST /api/admin/validation/bulk
  // ──────────────────────────────────────────────────────────
  if (route === 'admin/validation/bulk') {
    if (ctx.role !== 'aracom_admin') return err('Réservé ARACOM', 403);
    const { ids, type, action, reason, force_validate } = body || {};
    if (!Array.isArray(ids) || !ids.length) return err('ids[] requis');
    if (!['validate', 'refuse'].includes(action)) return err('action invalide');
    if (!['stand', 'animation'].includes(type)) return err('type invalide');
    const collName = type === 'stand' ? 'stand_assignments' : 'animation_slots';

    const targetsPreCheck = await db.collection(collName).find({ id: { $in: ids } }).toArray();
    if (action === 'validate' && type === 'stand' && !force_validate) {
      const blocked = [];
      for (const asn of targetsPreCheck) {
        const reg = await db.collection('registrations').findOne({ id: asn.registration_id });
        const attendingDays = reg?.attending_days || [];
        if (attendingDays.length === 0) continue;
        const existingAnims = await db.collection('animation_slots').find({
          registration_id: asn.registration_id,
          status: { $ne: 'annulé' },
          request_status: { $in: ['pending', 'validated'] },
        }).toArray();
        const daysWithAnim = new Set(existingAnims.map(a => a.day_label));
        const missingDays = attendingDays.filter(d => !daysWithAnim.has(d));
        if (missingDays.length > 0) {
          blocked.push({ id: asn.id, stand_code: asn.stand_code, registration_id: asn.registration_id, missing_days: missingDays });
        }
      }
      if (blocked.length > 0) {
        return err(
          `❌ Validation bulk impossible pour ${blocked.length} stand(s) sans animation complète. ` +
          `Animations manquantes pour : ${blocked.map(b => `${b.stand_code} (${b.missing_days.join('+')})`).join('; ')}. ` +
          `Ajoutez "force_validate: true" pour passer outre (déconseillé), ou demandez à l'exposant de compléter.`,
          422
        );
      }
    }

    const set = action === 'validate'
      ? { request_status: 'validated', validated_at: new Date(), validated_by: ctx.userId || 'u-admin', updated_at: new Date() }
      : { request_status: 'refused', refused_reason: reason || 'Refusé en masse', validated_at: new Date(), validated_by: ctx.userId || 'u-admin', status: 'annule', updated_at: new Date() };
    const targets = targetsPreCheck;
    const result = await db.collection(collName).updateMany({ id: { $in: ids } }, { $set: set });
    const emailTemplates = [];
    const promotedTemplates = [];
    for (const asn of targets) {
      const tpl = await buildExposantEmailTemplate(asn.registration_id, action === 'validate' ? 'validated' : 'refused', {
        kind: type,
        stand_code: asn.stand_code,
        day_label: asn.day_label,
        start_time: asn.start_time,
        end_time: asn.end_time,
        reason: reason || 'Refusé en masse',
      });
      if (tpl) emailTemplates.push(tpl);
      if (action === 'refuse') {
        const promo = await promoteNextInWaitlist(asn, type);
        if (promo?.email_template) promotedTemplates.push(promo.email_template);
      }
    }
    await db.collection('activity_logs').insertOne({
      id: uuid(),
      actor_user_id: ctx.userId || 'u-admin',
      action: `VALIDATION_BULK_${action.toUpperCase()}`,
      description: `Bulk ${action} ${type} : ${result.modifiedCount} record(s)${promotedTemplates.length ? `, ${promotedTemplates.length} promu(s)` : ''}`,
      metadata: { type, action, ids, reason, modified: result.modifiedCount, promoted_count: promotedTemplates.length },
      created_at: new Date(),
    });
    return json({
      ok: true,
      action,
      type,
      modified: result.modifiedCount,
      email_templates: emailTemplates,
      promoted_email_templates: promotedTemplates,
    });
  }

  // ──────────────────────────────────────────────────────────
  // POST /api/admin/validation-deadline
  // ──────────────────────────────────────────────────────────
  if (route === 'admin/validation-deadline') {
    if (ctx.role !== 'aracom_admin') return err('Réservé ARACOM', 403);
    const { deadline } = body || {};
    if (!deadline) return err('deadline ISO requise');
    const dl = new Date(deadline);
    if (isNaN(dl.getTime())) return err('Format de date invalide');
    await db.collection('app_settings').updateOne(
      { key: 'validation_deadline' },
      { $set: { key: 'validation_deadline', deadline_at: dl, updated_at: new Date(), updated_by: ctx.userId || 'u-admin' } },
      { upsert: true }
    );
    return json({ ok: true, deadline_at: dl });
  }

  return null;
}

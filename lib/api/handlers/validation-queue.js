import { json, err, getUserContext } from '../helpers';

/**
 * Handler GET validation-queue + validation-deadline.
 *
 * Routes (GET only) :
 *   GET /api/admin/validation-queue?status=&type=&site=&date=
 *   GET /api/admin/validation-deadline
 *
 * Retourne null si la route ne matche pas (le dispatcher route.js continue).
 *
 * @param {object} args
 * @param {import('mongodb').Db} args.db
 * @param {Request} args.request
 * @param {URL} args.url
 * @param {string} args.route
 */
export async function handleValidationQueueGet({ db, request, url, route }) {
  const ctx = getUserContext(request);

  // GET /api/admin/validation-queue
  if (route === 'admin/validation-queue') {
    if (ctx.role !== 'aracom_admin') return err('Réservé ARACOM', 403);
    const statusFilter = url.searchParams.get('status');
    const typeFilter = url.searchParams.get('type');
    const siteFilter = url.searchParams.get('site');
    const dateFilter = url.searchParams.get('date');

    const matchStand = { status: { $nin: ['annule', 'cancelled'] } };
    const matchAnim = { status: { $ne: 'annulé' } };
    if (statusFilter && statusFilter !== 'all') {
      matchStand.request_status = statusFilter;
      matchAnim.request_status = statusFilter;
    } else {
      matchStand.request_status = { $in: ['pending', 'waitlist', 'validated', 'refused'] };
      matchAnim.request_status = { $in: ['pending', 'waitlist', 'validated', 'refused'] };
    }
    if (dateFilter) matchAnim.event_date = dateFilter;

    const items = [];

    // 1. Stands
    if (!typeFilter || typeFilter === 'all' || typeFilter === 'stand') {
      const stands = await db.collection('stand_assignments').find(matchStand).sort({ request_submitted_at: 1 }).toArray();
      for (const s of stands) {
        const reg = await db.collection('registrations').findOne({ id: s.registration_id });
        if (!reg) continue;
        if (siteFilter && reg.venue_id !== siteFilter) continue;
        const org = await db.collection('organizations').findOne({ id: reg.organization_id });
        const venue = await db.collection('venues').findOne({ id: reg.venue_id });
        const stand = await db.collection('venue_stands').findOne({ id: s.venue_stand_id });
        // Next-in-waitlist
        let nextInfo = null;
        if (s.request_status === 'pending' || s.request_status === 'validated') {
          const next = await db.collection('stand_assignments').findOne(
            { venue_stand_id: s.venue_stand_id, request_status: 'waitlist', id: { $ne: s.id } },
            { sort: { waitlist_position: 1, request_submitted_at: 1 } }
          );
          if (next) {
            const nReg = await db.collection('registrations').findOne({ id: next.registration_id });
            const nOrg = nReg ? await db.collection('organizations').findOne({ id: nReg.organization_id }) : null;
            nextInfo = { name: nOrg?.name, waitlist_position: next.waitlist_position, assignment_id: next.id };
          }
        }
        // 🆕 GARDE-FOU ANIMATION — Détection des jours sans animation (règle 1 animation/jour obligatoire)
        const attendingDays = reg.attending_days || [];
        const linkedAnims = await db.collection('animation_slots').find({
          registration_id: reg.id,
          status: { $ne: 'annulé' },
          request_status: { $in: ['pending', 'validated'] },
        }).toArray();
        const daysWithAnim = new Set(linkedAnims.map(a => a.day_label));
        const missingAnimationDays = attendingDays.filter(d => !daysWithAnim.has(d));
        const animationsComplete = missingAnimationDays.length === 0 && attendingDays.length > 0;
        items.push({
          type: 'stand',
          id: s.id,
          registration_id: reg.id,
          organization: { id: org?.id, name: org?.name, main_email: org?.main_email },
          venue: { id: venue?.id, name: venue?.name },
          stand_code: stand?.stand_code,
          attending_days: attendingDays,
          request_status: s.request_status,
          waitlist_position: s.waitlist_position,
          request_submitted_at: s.request_submitted_at,
          validated_at: s.validated_at,
          validated_by: s.validated_by,
          refused_reason: s.refused_reason,
          next_in_waitlist: nextInfo,
          animations_count: linkedAnims.length,
          animations_complete: animationsComplete,
          missing_animation_days: missingAnimationDays,
        });
      }
    }

    // 2. Animations
    if (!typeFilter || typeFilter === 'all' || typeFilter === 'animation') {
      const anims = await db.collection('animation_slots').find(matchAnim).sort({ request_submitted_at: 1 }).toArray();
      for (const a of anims) {
        if (siteFilter && a.venue_id !== siteFilter) continue;
        let nextInfo = null;
        if (a.request_status === 'pending' || a.request_status === 'validated') {
          const next = await db.collection('animation_slots').findOne(
            { venue_id: a.venue_id, day_label: a.day_label, location_type: a.location_type, start_time: a.start_time, request_status: 'waitlist', id: { $ne: a.id } },
            { sort: { waitlist_position: 1, request_submitted_at: 1 } }
          );
          if (next) {
            const nReg = await db.collection('registrations').findOne({ id: next.registration_id });
            const nOrg = nReg ? await db.collection('organizations').findOne({ id: nReg.organization_id }) : null;
            nextInfo = { name: nOrg?.name, waitlist_position: next.waitlist_position, assignment_id: next.id };
          }
        }
        items.push({
          type: 'animation',
          id: a.id,
          registration_id: a.registration_id,
          organization: { id: null, name: a.organization_name, main_email: null },
          venue: { id: a.venue_id, name: a.venue_name },
          day_label: a.day_label,
          event_date: a.event_date,
          start_time: a.start_time,
          end_time: a.end_time,
          location_type: a.location_type,
          title: a.title,
          request_status: a.request_status,
          waitlist_position: a.waitlist_position,
          request_submitted_at: a.request_submitted_at,
          validated_at: a.validated_at,
          validated_by: a.validated_by,
          refused_reason: a.refused_reason,
          next_in_waitlist: nextInfo,
        });
      }
    }

    // Tri FIFO global
    items.sort((x, y) => new Date(x.request_submitted_at || 0) - new Date(y.request_submitted_at || 0));

    const deadlineDoc = await db.collection('app_settings').findOne({ key: 'validation_deadline' });

    return json({
      ok: true,
      items,
      total: items.length,
      deadline_at: deadlineDoc?.deadline_at || null,
      counts: {
        pending: items.filter(i => i.request_status === 'pending').length,
        waitlist: items.filter(i => i.request_status === 'waitlist').length,
        validated: items.filter(i => i.request_status === 'validated').length,
        refused: items.filter(i => i.request_status === 'refused').length,
      },
    });
  }

  // GET /api/admin/validation-deadline (config)
  if (route === 'admin/validation-deadline') {
    const d = await db.collection('app_settings').findOne({ key: 'validation_deadline' });
    return json({ deadline_at: d?.deadline_at || null });
  }

  return null;
}

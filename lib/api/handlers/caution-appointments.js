import { v4 as uuid } from 'uuid';
import { json, err, getUserContext } from '../helpers';

const placeLabelFr = (placeKey, placeCustom) => {
  if (placeKey === 'sur_site') return 'Sur site / à votre stand le jour J';
  if (placeKey === 'autre') return placeCustom || 'Lieu à préciser';
  return 'ARACOM Conseil — Paea, Polynésie française';
};

const placeLabelShortFr = (placeKey, placeCustom) => {
  if (placeKey === 'sur_site') return 'Sur site / à mon stand (jour J)';
  if (placeKey === 'autre') return placeCustom || 'À préciser';
  return 'ARACOM Conseil — Paea';
};

/**
 * Handler caution-appointments — RDV de restitution caution (exposant + admin).
 *
 * Routes :
 *   POST /api/exposant/caution-appointment
 *   POST /api/admin/caution-appointments/update
 *   POST /api/admin/caution-appointments/create
 *
 * @param {object} args
 * @param {import('mongodb').Db} args.db
 * @param {Request} args.request
 * @param {string} args.route
 * @param {object} args.body
 * @param {object} args.deps        - { sendMail }
 */
export async function handleCautionAppointmentsPost({ db, request, route, body, deps = {} }) {
  const { sendMail } = deps;

  // 🗓️ ADMIN — Update RDV + send email
  if (route === 'admin/caution-appointments/update') {
    const ctx = getUserContext(request);
    if (ctx.role !== 'aracom_admin') return err('Accès admin requis', 403);
    const { id, status, confirmed_date, confirmed_time, confirmed_place, confirmed_place_custom, admin_note } = body || {};
    if (!id) return err('id requis', 400);
    if (!['confirme', 'propose', 'restitue', 'annule', 'demande'].includes(status)) {
      return err('status invalide', 400);
    }
    const appt = await db.collection('caution_appointments').findOne({ id });
    if (!appt) return err('RDV introuvable', 404);

    const updates = {
      status,
      updated_at: new Date(),
      admin_note: admin_note || appt.admin_note || '',
      confirmed_at: status === 'confirme' ? new Date() : (appt.confirmed_at || null),
    };
    if (confirmed_date) updates.confirmed_date = confirmed_date;
    if (confirmed_time) updates.confirmed_time = confirmed_time;
    if (confirmed_place) updates.confirmed_place = confirmed_place;
    if (confirmed_place_custom !== undefined) updates.confirmed_place_custom = confirmed_place_custom;
    if (status === 'restitue') updates.restituted_at = new Date();

    await db.collection('caution_appointments').updateOne({ id }, { $set: updates });

    const org = await db.collection('organizations').findOne({ id: appt.organization_id });
    const finalDate = updates.confirmed_date || appt.requested_date;
    const finalTime = updates.confirmed_time || appt.requested_time;
    const finalPlaceKey = updates.confirmed_place || appt.confirmed_place || appt.requested_place || 'aracom_paea';
    const finalPlaceCustom = updates.confirmed_place_custom !== undefined
      ? updates.confirmed_place_custom
      : (appt.confirmed_place_custom || appt.requested_place_custom || '');
    const placeLabel = placeLabelFr(finalPlaceKey, finalPlaceCustom);
    const dateStr = new Date(finalDate).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

    const subjects = {
      confirme: `✅ RDV confirmé pour la restitution de votre caution`,
      propose: `📅 Nouveau créneau proposé pour votre caution`,
      restitue: `🎉 Caution restituée — confirmation`,
      annule: `❌ RDV de restitution caution annulé`,
    };
    const bodies = {
      confirme: `<p>Bonjour ${org?.contact_name || ''},</p>
        <p>Votre RDV pour récupérer votre caution de <b>20 000 XPF</b> est confirmé pour le <b>${dateStr} à ${finalTime}</b>.</p>
        <p>📍 Lieu : <b>${placeLabel}</b></p>
        <p>Munissez-vous d'une pièce d'identité. Nous vous remettrons l'<b>attestation de remboursement</b> à signer en 2 exemplaires (un pour ARACOM, un pour vous).</p>
        ${admin_note ? `<p><i>Note : ${admin_note}</i></p>` : ''}
        <p>À très bientôt,<br>L'équipe ARACOM</p>`,
      propose: `<p>Bonjour ${org?.contact_name || ''},</p>
        <p>Nous vous proposons un nouveau créneau pour récupérer votre caution :</p>
        <p style="font-size:18px"><b>${dateStr} à ${finalTime}</b></p>
        <p>📍 Lieu : <b>${placeLabel}</b></p>
        ${admin_note ? `<p><i>Note : ${admin_note}</i></p>` : ''}
        <p>Merci de nous confirmer votre venue par retour de mail.</p>
        <p>L'équipe ARACOM</p>`,
      restitue: `<p>Bonjour ${org?.contact_name || ''},</p>
        <p>Nous confirmons la restitution de votre caution de <b>20 000 XPF</b> ce ${dateStr}${placeLabel ? ` (${placeLabel})` : ''}.</p>
        <p>L'attestation de remboursement signée vous a été remise.</p>
        <p>Merci pour votre participation au Forum de la Rentrée 2026 et à très bientôt pour la prochaine édition !</p>
        <p>L'équipe ARACOM</p>`,
      annule: `<p>Bonjour ${org?.contact_name || ''},</p>
        <p>Votre RDV de restitution caution du ${dateStr} a été annulé.</p>
        ${admin_note ? `<p><i>Motif : ${admin_note}</i></p>` : ''}
        <p>Contactez-nous pour reprogrammer.</p>
        <p>L'équipe ARACOM</p>`,
    };

    if (org?.main_email && subjects[status] && sendMail) {
      try {
        await sendMail({ to: org.main_email, subject: subjects[status], html: bodies[status] });
      } catch (_e) { /* best effort */ }
    }

    const updated = await db.collection('caution_appointments').findOne({ id });
    delete updated._id;
    return json({ ok: true, appointment: updated });
  }

  // 🗓️ ADMIN — Créer un RDV pour un exposant
  if (route === 'admin/caution-appointments/create') {
    const ctx = getUserContext(request);
    if (ctx.role !== 'aracom_admin') return err('Accès admin requis', 403);
    const { registration_id, organization_id, confirmed_date, confirmed_time, confirmed_place, confirmed_place_custom, admin_note } = body || {};
    if (!registration_id || !confirmed_date || !confirmed_time) {
      return err('Champs requis : registration_id, confirmed_date, confirmed_time', 400);
    }
    const existing = await db.collection('caution_appointments').findOne({ registration_id });
    const appt = {
      id: existing?.id || uuid(),
      registration_id,
      organization_id: organization_id || existing?.organization_id || null,
      requested_date: existing?.requested_date || confirmed_date,
      requested_time: existing?.requested_time || confirmed_time,
      requested_place: existing?.requested_place || confirmed_place || 'aracom_paea',
      requested_place_custom: existing?.requested_place_custom || '',
      confirmed_date,
      confirmed_time,
      confirmed_place: confirmed_place || existing?.requested_place || 'aracom_paea',
      confirmed_place_custom: confirmed_place_custom || existing?.requested_place_custom || '',
      status: 'confirme',
      admin_note: admin_note || '',
      notes: existing?.notes || '',
      created_at: existing?.created_at || new Date(),
      updated_at: new Date(),
      confirmed_at: new Date(),
    };
    await db.collection('caution_appointments').updateOne(
      { registration_id },
      { $set: appt },
      { upsert: true }
    );
    const org = await db.collection('organizations').findOne({ id: appt.organization_id });
    const placeLabel = placeLabelFr(appt.confirmed_place, appt.confirmed_place_custom);
    if (org?.main_email && sendMail) {
      const dateStr = new Date(confirmed_date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
      try {
        await sendMail({
          to: org.main_email,
          subject: `📅 RDV pour récupérer votre caution — Forum 2026`,
          html: `<p>Bonjour ${org.contact_name || ''},</p>
            <p>Nous vous donnons rendez-vous pour récupérer votre caution de <b>20 000 XPF</b> :</p>
            <p style="font-size:18px"><b>${dateStr} à ${confirmed_time}</b></p>
            <p>📍 Lieu : <b>${placeLabel}</b></p>
            <p>Munissez-vous d'une pièce d'identité.</p>
            ${admin_note ? `<p><i>Note : ${admin_note}</i></p>` : ''}
            <p>Merci de confirmer votre venue par retour de mail.</p>
            <p>L'équipe ARACOM</p>`,
        });
      } catch (_e) { /* best effort */ }
    }
    delete appt._id;
    return json({ ok: true, appointment: appt });
  }

  // 🗓️ EXPOSANT — Demande de RDV
  if (route === 'exposant/caution-appointment') {
    const { registration_id, organization_id, requested_date, requested_time, requested_place, requested_place_custom, notes } = body || {};
    if (!registration_id || !requested_date || !requested_time) {
      return err('Champs requis : registration_id, requested_date, requested_time', 400);
    }
    const existing = await db.collection('caution_appointments').findOne({ registration_id });
    const appt = {
      id: existing?.id || uuid(),
      registration_id,
      organization_id: organization_id || existing?.organization_id || null,
      requested_date,
      requested_time,
      requested_place: requested_place || 'aracom_paea',
      requested_place_custom: requested_place_custom || '',
      notes: notes || '',
      status: 'demande',
      created_at: existing?.created_at || new Date(),
      updated_at: new Date(),
    };
    await db.collection('caution_appointments').updateOne(
      { registration_id },
      { $set: appt },
      { upsert: true }
    );
    delete appt._id;
    if (sendMail) {
      const placeLabel = placeLabelShortFr(appt.requested_place, appt.requested_place_custom);
      try {
        const org = await db.collection('organizations').findOne({ id: appt.organization_id });
        await sendMail({
          to: process.env.ARACOM_ADMIN_EMAIL || 'tevageros@me.com',
          subject: `🗓️ Demande de RDV caution — ${org?.name || 'Exposant'}`,
          html: `<p><b>${org?.name || 'Exposant'}</b> demande un RDV pour récupérer sa caution.</p>
                 <p>Créneau souhaité : <b>${new Date(requested_date).toLocaleDateString('fr-FR')} à ${requested_time}</b></p>
                 <p>Lieu souhaité : <b>${placeLabel}</b></p>
                 ${notes ? `<p>Note : ${notes}</p>` : ''}
                 <p>Validez ou proposez un autre créneau depuis le cockpit ARACOM.</p>`,
        });
      } catch (_e) { /* best effort */ }
    }
    return json({ ok: true, appointment: appt });
  }

  return null;
}

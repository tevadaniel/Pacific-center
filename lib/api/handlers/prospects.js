import { v4 as uuid } from 'uuid';
import { json, err, getUserContext, EDITION_ID } from '../helpers';

/**
 * Handlers pour les routes prospects (CRM léger Pacific Centers + ARACOM)
 *
 * Routes gérées :
 *   GET    /api/prospects                       — liste (filtres venue_id, status)
 *   GET    /api/prospects/stats                 — KPIs (taux de conversion, par site…)
 *   POST   /api/prospects                       — création
 *   POST   /api/prospects/:id/notes             — ajout d'une note
 *   POST   /api/prospects/:id/convert           — conversion en exposant (org + registration)
 *   PUT    /api/prospects/:id                   — mise à jour
 *   DELETE /api/prospects/:id                   — suppression
 *
 * Chaque fonction renvoie une Response (json/err) si elle gère la route, sinon null.
 */

/** Filtre venues autorisés pour les utilisateurs Pacific (si allowed_venue_ids défini) */
async function applyPacificVenueFilter(db, request, filter) {
  const role = request.headers.get('x-user-role');
  if (role !== 'pacific_centers_readonly') return filter;
  const userId = request.headers.get('x-user-id');
  const user = userId ? await db.collection('users').findOne({ id: userId }) : null;
  if (user?.allowed_venue_ids?.length) {
    filter.venue_id = filter.venue_id || { $in: user.allowed_venue_ids };
  }
  return filter;
}

export async function handleProspectsGet({ db, request, url, route }) {
  // GET /api/prospects
  if (route === 'prospects') {
    const filter = {};
    const venueId = url.searchParams.get('venue_id');
    if (venueId) filter.venue_id = venueId;
    const status = url.searchParams.get('status');
    if (status) filter.status = status;
    await applyPacificVenueFilter(db, request, filter);

    const prospects = await db.collection('prospects').find(filter).sort({ updated_at: -1 }).toArray();
    const vids = [...new Set(prospects.map(p => p.venue_id).filter(Boolean))];
    const venues = vids.length ? await db.collection('venues').find({ id: { $in: vids } }).toArray() : [];
    const vmap = Object.fromEntries(venues.map(v => [v.id, v]));
    return json(prospects.map(p => {
      delete p._id;
      return { ...p, venue_name: vmap[p.venue_id]?.name || null, venue_code: vmap[p.venue_id]?.code || null };
    }));
  }

  // GET /api/prospects/stats
  if (route === 'prospects/stats') {
    const filter = {};
    const venueId = url.searchParams.get('venue_id');
    if (venueId) filter.venue_id = venueId;
    await applyPacificVenueFilter(db, request, filter);

    const all = await db.collection('prospects').find(filter).toArray();
    const byStatus = { a_contacter: 0, contacte: 0, interesse: 0, converti: 0, refuse: 0, abandonne: 0 };
    all.forEach(p => { if (p.status in byStatus) byStatus[p.status]++; else byStatus.a_contacter++; });
    const total = all.length;
    const contacted = total - byStatus.a_contacter;
    const converted = byStatus.converti;
    const conversion_rate_pct = total > 0 ? Math.round((converted / total) * 100) : 0;
    const contact_to_conversion_pct = contacted > 0 ? Math.round((converted / contacted) * 100) : 0;
    const byVenue = {};
    all.forEach(p => {
      const k = p.venue_id || 'autre';
      if (!byVenue[k]) byVenue[k] = { total: 0, converti: 0 };
      byVenue[k].total++;
      if (p.status === 'converti') byVenue[k].converti++;
    });
    return json({ total, contacted, converted, by_status: byStatus, by_venue: byVenue, conversion_rate_pct, contact_to_conversion_pct });
  }

  return null;
}

export async function handleProspectsPost({ db, request, route, p, body }) {
  const ctx = getUserContext(request);

  // POST /api/prospects — création
  if (route === 'prospects') {
    const now = new Date();
    const doc = {
      id: uuid(),
      venue_id: body.venue_id || null,
      organization_name: body.organization_name || '',
      contact_name: body.contact_name || '',
      contact_email: (body.contact_email || '').toLowerCase() || null,
      contact_phone: body.contact_phone || null,
      discipline: body.discipline || null,
      status: body.status || 'a_contacter',
      notes: [],
      converted_to_registration_id: null,
      created_at: now,
      updated_at: now,
      created_by: ctx.userId || null,
    };
    if (body.initial_note) {
      doc.notes.push({ text: body.initial_note, at: now, by: ctx.userId || null });
    }
    await db.collection('prospects').insertOne(doc);
    delete doc._id;
    return json(doc);
  }

  // POST /api/prospects/:id/notes — ajout d'une note
  if (route.match(/^prospects\/[^/]+\/notes$/)) {
    const pid = p[1];
    const prospect = await db.collection('prospects').findOne({ id: pid });
    if (!prospect) return err('Prospect introuvable', 404);
    const note = { text: body.text || '', at: new Date(), by: ctx.userId || null };
    await db.collection('prospects').updateOne({ id: pid }, { $push: { notes: note }, $set: { updated_at: new Date() } });
    const out = await db.collection('prospects').findOne({ id: pid }); delete out._id;
    return json(out);
  }

  // POST /api/prospects/:id/convert — conversion en exposant
  if (route.match(/^prospects\/[^/]+\/convert$/)) {
    const pid = p[1];
    const prospect = await db.collection('prospects').findOne({ id: pid });
    if (!prospect) return err('Prospect introuvable', 404);
    if (prospect.converted_to_registration_id) return err('Déjà converti', 400);

    const orgId = uuid();
    await db.collection('organizations').insertOne({
      id: orgId,
      name: prospect.organization_name,
      discipline: prospect.discipline || 'autre',
      primary_contact_email: prospect.contact_email,
      primary_contact_name: prospect.contact_name,
      primary_contact_phone: prospect.contact_phone,
      created_at: new Date(), updated_at: new Date(),
    });

    const regId = uuid();
    await db.collection('registrations').insertOne({
      id: regId,
      edition_id: EDITION_ID,
      organization_id: orgId,
      venue_id: prospect.venue_id,
      stand_code: null,
      status: 'a_confirmer',
      priority: 'normale',
      is_deposit_received: false,
      created_at: new Date(), updated_at: new Date(),
    });

    await db.collection('prospects').updateOne(
      { id: pid },
      { $set: { status: 'converti', converted_to_registration_id: regId, converted_at: new Date(), updated_at: new Date() } }
    );
    return json({ ok: true, organization_id: orgId, registration_id: regId });
  }

  return null;
}

export async function handleProspectsPut({ db, route, p, body }) {
  if (route.startsWith('prospects/')) {
    const id = p[1];
    const allowed = ['venue_id', 'organization_name', 'contact_name', 'contact_email', 'contact_phone', 'discipline', 'status'];
    const upd = {};
    for (const k of allowed) if (k in body) upd[k] = body[k];
    if (upd.contact_email) upd.contact_email = upd.contact_email.toLowerCase();
    upd.updated_at = new Date();
    await db.collection('prospects').updateOne({ id }, { $set: upd });
    const out = await db.collection('prospects').findOne({ id });
    if (out) delete out._id;
    return json(out);
  }
  return null;
}

export async function handleProspectsDelete({ db, route, p }) {
  if (route.startsWith('prospects/')) {
    await db.collection('prospects').deleteOne({ id: p[1] });
    return json({ ok: true });
  }
  return null;
}

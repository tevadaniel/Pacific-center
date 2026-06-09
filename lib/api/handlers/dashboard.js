import { json, EDITION_ID } from '../helpers';

/**
 * 🆕 SESSION 28 — Handlers GET pour les endpoints dashboard légers et statistiques publiques.
 *
 * Couvre les endpoints suivants (GET) :
 *   GET /api/stats/public
 *   GET /api/dashboard/kpis
 *   GET /api/dashboard/by-site
 *   GET /api/dashboard/jour-j-live
 *   GET /api/alerts
 *
 * NOTE : dashboard/analytics, dashboard/extended et dashboard/briefing
 * restent dans route.js (trop volumineux + nombreuses dépendances).
 */

async function computeKpis(db, userRole = null) {
  let allowedVenueIds = null;
  if (userRole === 'pacific_centers_readonly' || userRole === 'exposant') {
    const flag = userRole === 'pacific_centers_readonly' ? 'pacific_visible' : 'exposant_visible';
    const venues = await db.collection('venues').find({ edition_id: EDITION_ID }).toArray();
    allowedVenueIds = new Set(venues.filter(v => v.is_available_2026 !== false && v[flag] !== false).map(v => v.id));
  }
  const q = { edition_id: EDITION_ID };
  if (allowedVenueIds) q.venue_id = { $in: [...allowedVenueIds] };
  const regs = await db.collection('registrations').find(q).toArray();
  const regIds = new Set(regs.map(r => r.id));
  const depAll = await db.collection('deposit_transactions').find({}).toArray();
  const deposits = allowedVenueIds ? depAll.filter(d => regIds.has(d.registration_id)) : depAll;
  const total = regs.length;
  const by_status = {};
  for (const r of regs) by_status[r.status] = (by_status[r.status] || 0) + 1;
  const cautions_recues = deposits.filter(d => d.status === 'recue').length;
  const cautions_en_attente = deposits.filter(d => ['demandee', 'en_attente'].includes(d.status)).length;
  const conv_signed = regs.filter(r => r.is_convention_signed).length;
  const docs_manquants = regs.filter(r => !r.is_insurance_uploaded).length;
  const xpf_encaisses = deposits.filter(d => d.status === 'recue').reduce((s, d) => s + (d.amount_xpf || 0), 0);
  const xpf_en_attente = deposits.filter(d => ['demandee', 'en_attente'].includes(d.status)).reduce((s, d) => s + (d.amount_xpf || 0), 0);
  return { total, by_status, cautions_recues, cautions_en_attente, conv_signed, docs_manquants, xpf_encaisses, xpf_en_attente };
}

async function computeBySite(db) {
  // 🆕 SESSION 52f — Filtre les sites INACTIFS (Mahina, Moorea) du dashboard
  // Dashboard by-site doit montrer SEULEMENT les sites actifs (is_available_2026 + is_active)
  const allVenues = await db.collection('venues').find({ edition_id: EDITION_ID }).toArray();
  const venues = allVenues.filter(v => v.is_available_2026 !== false && v.is_active !== false);
  const regs = await db.collection('registrations').find({ edition_id: EDITION_ID }).toArray();
  const deposits = await db.collection('deposit_transactions').find({}).toArray();
  const depByReg = {};
  deposits.forEach(d => { depByReg[d.registration_id] = d; });
  return venues.map(v => {
    const vregs = regs.filter(r => r.venue_id === v.id);
    const confirmed = vregs.filter(r => r.status === 'confirme').length;
    const to_confirm = vregs.filter(r => r.status === 'a_confirmer').length;
    const to_follow_up = vregs.filter(r => r.status === 'a_relancer').length;
    const prospects = vregs.filter(r => r.status === 'prospect').length;
    const cautions_recues = vregs.filter(r => depByReg[r.id]?.status === 'recue').length;
    const conv_signed = vregs.filter(r => r.is_convention_signed).length;
    const assigned = vregs.length;
    const remplissage = v.capacity_stands > 0 ? Math.round((confirmed / v.capacity_stands) * 100) : 0;
    return {
      venue_id: v.id, venue_name: v.name, venue_code: v.code,
      capacity_stands: v.capacity_stands, assigned, confirmed, to_confirm, to_follow_up, prospects,
      cautions_recues, conv_signed, remplissage,
    };
  });
}

export async function handleDashboardGet({ db, request, url, route }) {
  // Public stats — pas d'auth requise
  if (route === 'stats/public') {
    const venues = await db.collection('venues').find({ edition_id: EDITION_ID }).toArray();
    const stands = await db.collection('venue_stands').countDocuments({});
    const orgs = await db.collection('organizations').countDocuments({ source_origin: { $ne: 'self_register' } });
    return json({ sites: venues.length, stands, associations: orgs });
  }

  // Dashboard KPIs principaux
  if (route === 'dashboard/kpis') {
    const userRole = request.headers.get('x-user-role');
    const kpis = await computeKpis(db, userRole);
    return json(kpis);
  }

  // Dashboard par site (avec filtrage Pacific)
  if (route === 'dashboard/by-site') {
    const userRole = request.headers.get('x-user-role');
    const sites = await computeBySite(db);
    if (userRole === 'pacific_centers_readonly') {
      const allVenues = await db.collection('venues').find({ edition_id: EDITION_ID }).toArray();
      const allowedIds = new Set(allVenues.filter(v => v.is_available_2026 !== false && v.pacific_visible !== false).map(v => v.id));
      return json(sites.filter(s => allowedIds.has(s.venue_id)));
    }
    return json(sites);
  }

  // Vue temps réel Jour J
  if (route === 'dashboard/jour-j-live') {
    const event_date = url.searchParams.get('event_date') || '2026-08-14';
    // 🆕 SESSION 52f — Filtre les sites INACTIFS du dashboard Jour J
    const allVenues = await db.collection('venues').find({ edition_id: EDITION_ID }).toArray();
    const venues = allVenues.filter(v => v.is_available_2026 !== false && v.is_active !== false);
    const allSessions = await db.collection('attendance_sessions').find({ event_date }).toArray();
    const anomalies = await db.collection('registration_anomalies').find({ event_date, resolved_status: { $ne: 'resolu' } }).toArray();
    const bySite = venues.map(v => {
      const vs = allSessions.filter(s => s.venue_id === v.id);
      const present = vs.filter(s => ['arrive', 'parti', 'depart_anticipe'].includes(s.presence_status)).length;
      const absent = vs.filter(s => s.presence_status === 'absent').length;
      const waiting = vs.filter(s => s.presence_status === 'attendu').length;
      const late = vs.filter(s => s.actual_arrival_time && s.expected_arrival_time && s.actual_arrival_time > s.expected_arrival_time).length;
      const gone = vs.filter(s => ['parti', 'depart_anticipe'].includes(s.presence_status)).length;
      const anomCount = anomalies.filter(a => a.venue_id === v.id).length;
      return {
        venue_id: v.id, venue_name: v.name, venue_code: v.code,
        total: vs.length, present, absent, waiting, late, gone,
        anomalies: anomCount,
        rate: vs.length > 0 ? Math.round((present / vs.length) * 100) : 0,
      };
    });
    const totals = bySite.reduce((acc, s) => {
      acc.total += s.total; acc.present += s.present; acc.absent += s.absent;
      acc.waiting += s.waiting; acc.late += s.late; acc.gone += s.gone;
      acc.anomalies += s.anomalies; return acc;
    }, { total: 0, present: 0, absent: 0, waiting: 0, late: 0, gone: 0, anomalies: 0 });
    totals.rate = totals.total > 0 ? Math.round((totals.present / totals.total) * 100) : 0;
    return json({ event_date, totals, by_site: bySite });
  }

  // Alerts agrégées
  if (route === 'alerts') {
    const anomalies = await db.collection('registration_anomalies').find({ resolved_status: { $in: ['ouvert', 'en_cours'] } }).toArray();
    const tasks = await db.collection('tasks_or_followups').find({ status: { $in: ['a_faire', 'en_cours'] } }).toArray();
    const regs = await db.collection('registrations').find({ edition_id: EDITION_ID, status: { $in: ['confirme', 'a_confirmer'] } }).toArray();
    const docs = await db.collection('registration_documents').find({}, { projection: { file_data: 0 } }).toArray();
    const docsByReg = {};
    docs.forEach(d => { if (!docsByReg[d.registration_id]) docsByReg[d.registration_id] = []; docsByReg[d.registration_id].push(d); });
    const missing_insurance = regs.filter(r => !(docsByReg[r.id] || []).some(d => d.document_type === 'assurance' && d.status !== 'refuse')).length;
    const validation_pending = await db.collection('validation_requests').countDocuments({ status: 'en_attente' });
    const validation_rdv = await db.collection('validation_requests').countDocuments({ status: 'rdv_fixe' });
    return json({
      anomalies_open: anomalies.length,
      critical_anomalies: anomalies.filter(a => a.severity_level === 'critique').length,
      tasks_open: tasks.length,
      missing_insurance,
      validation_pending,
      validation_rdv,
    });
  }

  return null;
}

// Re-export pour usage interne par route.js (anciens appels directs à computeKpis/BySite)
export { computeKpis, computeBySite };

import { NextResponse } from 'next/server';
import { v4 as uuid } from 'uuid';
import { getDb } from '@/lib/mongo';
import { ASSOCIATIONS, PLANNING, VENUE_INFO } from '@/lib/seed-data';

const EDITION_ID = 'edition-2026';

const json = (data, status = 200) => NextResponse.json(data, { status });
const err = (message, status = 400) => NextResponse.json({ error: message }, { status });

function getUserContext(request) {
  return {
    userId: request.headers.get('x-user-id') || null,
    role: request.headers.get('x-user-role') || null,
  };
}

async function logActivity(db, userId, entity_type, entity_id, action_type, old_values, new_values) {
  await db.collection('activity_logs').insertOne({
    id: uuid(),
    user_id: userId,
    entity_type,
    entity_id,
    action_type,
    old_values_json: old_values || null,
    new_values_json: new_values || null,
    created_at: new Date(),
  });
}

// ---------- SEED ----------
async function doSeed(force = false) {
  const db = await getDb();
  const existing = await db.collection('registrations').countDocuments();
  if (existing > 0 && !force) return { seeded: false, message: 'Données déjà présentes. Utilisez force=true pour réinitialiser.' };

  // Clear
  const cols = ['users','roles','organizations','organization_contacts','organization_history','organization_preferences','editions','venues','venue_stands','registrations','stand_assignments','animation_slots','registration_documents','deposit_transactions','email_campaigns','email_messages','tasks_or_followups','attendance_sessions','attendance_events','registration_anomalies','field_comments','field_media','post_event_reports','activity_logs'];
  for (const c of cols) await db.collection(c).deleteMany({});

  // Roles
  const roles = [
    { id: 'role-admin', code: 'aracom_admin', label: 'Administrateur ARACOM' },
    { id: 'role-exposant', code: 'exposant', label: 'Exposant' },
    { id: 'role-pc', code: 'pacific_centers_readonly', label: 'Pacific Centers (lecture seule)' },
  ];
  await db.collection('roles').insertMany(roles);

  // Users (demo accounts)
  const users = [
    { id: 'u-admin', email: 'admin@aracom.pf', full_name: 'ARACOM Admin', phone: null, role_id: 'role-admin', role_code: 'aracom_admin', password: 'demo', is_active: true, created_at: new Date(), updated_at: new Date() },
    { id: 'u-pc', email: 'pacific@centers.pf', full_name: 'Pacific Centers', phone: null, role_id: 'role-pc', role_code: 'pacific_centers_readonly', password: 'demo', is_active: true, created_at: new Date(), updated_at: new Date() },
  ];

  // Edition
  await db.collection('editions').insertOne({
    id: EDITION_ID, name: 'Forum de la Rentrée 2026', year: 2026,
    start_date: '2026-08-14', end_date: '2026-08-15', status: 'actif',
    created_at: new Date(), updated_at: new Date(),
  });

  // Venues + Stands
  const venueIdByName = {};
  for (const v of VENUE_INFO) {
    const venueId = `venue-${v.code.toLowerCase()}`;
    venueIdByName[v.name] = venueId;
    await db.collection('venues').insertOne({
      id: venueId, edition_id: EDITION_ID, name: v.name, code: v.code,
      capacity_stands: v.stand_count, address: `${v.name}, Polynésie française`,
      is_active: true, created_at: new Date(), updated_at: new Date(),
    });
    const stands = [];
    for (let i = 1; i <= v.stand_count; i++) {
      const code = `${v.prefix}${String(i).padStart(2, '0')}`;
      stands.push({
        id: `stand-${code}`, venue_id: venueId, stand_code: code,
        zone: v.prefix, size_label: 'standard', is_premium: i <= 2, is_active: true,
        notes: null, created_at: new Date(), updated_at: new Date(),
      });
    }
    if (stands.length) await db.collection('venue_stands').insertMany(stands);
  }

  // Organizations + contacts + history + exposant users
  const orgIdByN = {};
  for (const a of ASSOCIATIONS) {
    const orgId = `org-${a.n}`;
    orgIdByN[a.n] = orgId;
    await db.collection('organizations').insertOne({
      id: orgId, name: a.name, discipline: a.discipline,
      priority_level: a.prio === 'prospect' ? 'prospect' : a.prio,
      main_email: a.email, main_phone: a.tel, contact_name: a.contact,
      notes: null, source_origin: 'import_excel_2026',
      created_at: new Date(), updated_at: new Date(),
    });
    if (a.contact) {
      await db.collection('organization_contacts').insertOne({
        id: uuid(), organization_id: orgId, full_name: a.contact,
        role_label: 'Contact principal', email: a.email, phone: a.tel,
        is_primary: true, created_at: new Date(), updated_at: new Date(),
      });
    }
    for (const y of a.hist) {
      await db.collection('organization_history').insertOne({
        id: uuid(), organization_id: orgId, year: y, participated: true,
        comment: null, created_at: new Date(),
      });
    }
    // Preferences
    for (let i = 0; i < a.sites.length; i++) {
      const vid = venueIdByName[a.sites[i]];
      if (vid) {
        await db.collection('organization_preferences').insertOne({
          id: uuid(), organization_id: orgId, edition_id: EDITION_ID,
          venue_id: vid, preference_rank: i + 1, is_eligible: true,
          source: 'import_excel', created_at: new Date(),
        });
      }
    }
    // Create exposant user for each association with email
    if (a.email) {
      users.push({
        id: `u-exp-${a.n}`, email: a.email, full_name: a.contact || a.name,
        phone: a.tel, role_id: 'role-exposant', role_code: 'exposant',
        password: 'demo', organization_id: orgId, is_active: true,
        created_at: new Date(), updated_at: new Date(),
      });
    }
  }
  await db.collection('users').insertMany(users);

  // Registrations + stand_assignments + animation_slots + deposits
  for (const venueBlock of PLANNING) {
    const venueId = venueIdByName[venueBlock.site];
    for (const row of venueBlock.rows) {
      const a = ASSOCIATIONS.find(x => x.n === row.n);
      if (!a) continue;
      const orgId = orgIdByN[a.n];
      const regId = `reg-${venueBlock.site.toLowerCase()}-${row.stand}`;
      const standId = `stand-${row.stand}`;
      // registration
      const reg = {
        id: regId, edition_id: EDITION_ID, organization_id: orgId,
        venue_id: venueId, status: row.status,
        animation_type: a.animation,
        friday_slot_label: row.status !== 'prospect' ? 'Oui' : null,
        saturday_slot_label: row.status !== 'prospect' ? 'Oui' : null,
        stand_needed: true, completion_percent: row.status === 'a_confirmer' ? 40 : (row.status === 'a_relancer' ? 20 : 0),
        is_convention_signed: false, is_deposit_required: true, is_deposit_received: false,
        is_insurance_uploaded: false, is_guide_sent: false,
        planned_arrival_time: '10:30', planned_departure_time: '17:00',
        post_event_status: 'en_attente', post_event_summary: null,
        internal_notes: null, stand_code: row.stand,
        created_at: new Date(), updated_at: new Date(),
      };
      await db.collection('registrations').insertOne(reg);
      await db.collection('stand_assignments').insertOne({
        id: uuid(), registration_id: regId, venue_stand_id: standId,
        assigned_by: 'u-admin', assigned_at: new Date(),
        status: row.status === 'prospect' ? 'provisoire' : 'provisoire',
        created_at: new Date(), updated_at: new Date(),
      });
      // animation slots for both days (if not prospect)
      if (row.status !== 'prospect') {
        for (const d of [{ label: 'vendredi', date: '2026-08-14', start: '11:00', end: '17:00' },
                         { label: 'samedi', date: '2026-08-15', start: '09:00', end: '17:00' }]) {
          await db.collection('animation_slots').insertOne({
            id: uuid(), registration_id: regId, venue_id: venueId,
            day_label: d.label, event_date: d.date,
            start_time: d.start, end_time: d.end,
            title: a.animation, slot_type: 'animation', status: 'planifié',
            notes: null, created_at: new Date(), updated_at: new Date(),
          });
        }
      }
      // deposit record
      await db.collection('deposit_transactions').insertOne({
        id: uuid(), registration_id: regId, amount_xpf: 20000,
        status: 'non_demandee', payment_method: null,
        received_at: null, expected_return_date: '2026-08-30', returned_at: null,
        retained_reason: null, retained_amount_xpf: 0, receipt_document_id: null,
        post_event_review_status: 'non_revu', post_event_review_comment: null,
        recommended_return_amount_xpf: 20000, notes: null,
        created_at: new Date(), updated_at: new Date(),
      });
    }
  }

  // Seed email campaign (reinscription)
  const campaignId = uuid();
  await db.collection('email_campaigns').insertOne({
    id: campaignId, edition_id: EDITION_ID, name: 'Réinscription 2026',
    campaign_type: 'reinscription', status: 'pret', created_by: 'u-admin',
    created_at: new Date(), updated_at: new Date(),
  });

  return { seeded: true, associations: ASSOCIATIONS.length, stands_planned: PLANNING.reduce((a, b) => a + b.rows.length, 0) };
}

// ---------- KPI ----------
async function computeKpis(db) {
  const regs = await db.collection('registrations').find({ edition_id: EDITION_ID }).toArray();
  const deposits = await db.collection('deposit_transactions').find({}).toArray();
  const depById = {};
  deposits.forEach(d => { depById[d.registration_id] = d; });
  const total = regs.length;
  const by_status = {};
  for (const r of regs) by_status[r.status] = (by_status[r.status] || 0) + 1;
  const cautions_recues = deposits.filter(d => d.status === 'recue').length;
  const cautions_en_attente = deposits.filter(d => ['demandee','en_attente'].includes(d.status)).length;
  const conv_signed = regs.filter(r => r.is_convention_signed).length;
  const docs_manquants = regs.filter(r => !r.is_insurance_uploaded).length;
  const xpf_encaisses = deposits.filter(d => d.status === 'recue').reduce((s, d) => s + (d.amount_xpf || 0), 0);
  const xpf_en_attente = deposits.filter(d => ['demandee','en_attente'].includes(d.status)).reduce((s, d) => s + (d.amount_xpf || 0), 0);
  return { total, by_status, cautions_recues, cautions_en_attente, conv_signed, docs_manquants, xpf_encaisses, xpf_en_attente };
}

async function computeBySite(db) {
  const venues = await db.collection('venues').find({ edition_id: EDITION_ID }).toArray();
  const regs = await db.collection('registrations').find({ edition_id: EDITION_ID }).toArray();
  const deposits = await db.collection('deposit_transactions').find({}).toArray();
  const depByReg = {}; deposits.forEach(d => { depByReg[d.registration_id] = d; });
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

// ---------- ROUTING ----------
export async function GET(request, { params }) {
  try {
    const db = await getDb();
    const p = params.path || [];
    const route = p.join('/');
    const url = new URL(request.url);

    if (route === '' || route === 'health') return json({ ok: true, service: 'Forum Rentrée 2026' });

    if (route === 'auth/me') {
      const ctx = getUserContext(request);
      if (!ctx.userId) return err('Non authentifié', 401);
      const user = await db.collection('users').findOne({ id: ctx.userId });
      if (!user) return err('Utilisateur introuvable', 404);
      let organization = null;
      if (user.organization_id) organization = await db.collection('organizations').findOne({ id: user.organization_id });
      delete user.password; delete user._id;
      return json({ user, organization });
    }

    if (route === 'dashboard/kpis') {
      const kpis = await computeKpis(db);
      return json(kpis);
    }
    if (route === 'dashboard/by-site') {
      const sites = await computeBySite(db);
      return json(sites);
    }

    if (route === 'venues') {
      const venues = await db.collection('venues').find({ edition_id: EDITION_ID }).toArray();
      return json(venues.map(v => { delete v._id; return v; }));
    }

    if (route.startsWith('venues/') && !route.includes('/stands')) {
      const id = p[1];
      const v = await db.collection('venues').findOne({ id });
      if (!v) return err('Site introuvable', 404);
      delete v._id;
      return json(v);
    }

    if (route.startsWith('venues/') && route.endsWith('/stands')) {
      const venueId = p[1];
      const stands = await db.collection('venue_stands').find({ venue_id: venueId }).toArray();
      const assignments = await db.collection('stand_assignments').find({}).toArray();
      const regs = await db.collection('registrations').find({ edition_id: EDITION_ID }).toArray();
      const orgs = await db.collection('organizations').find({}).toArray();
      const orgById = Object.fromEntries(orgs.map(o => [o.id, o]));
      const regById = Object.fromEntries(regs.map(r => [r.id, r]));
      const result = stands.map(s => {
        const assign = assignments.find(a => a.venue_stand_id === s.id && a.status !== 'annule');
        let reg = null, org = null;
        if (assign) {
          reg = regById[assign.registration_id];
          if (reg) org = orgById[reg.organization_id];
        }
        delete s._id;
        return { ...s, assignment: assign ? { registration_id: assign.registration_id, status: assign.status } : null, organization: org ? { id: org.id, name: org.name, discipline: org.discipline, priority_level: org.priority_level } : null, registration_status: reg?.status || null };
      });
      return json(result);
    }

    if (route === 'registrations') {
      const q = { edition_id: EDITION_ID };
      const venue_id = url.searchParams.get('venue_id');
      const status = url.searchParams.get('status');
      const priority = url.searchParams.get('priority');
      const discipline = url.searchParams.get('discipline');
      const search = url.searchParams.get('search');
      if (venue_id) q.venue_id = venue_id;
      if (status) q.status = status;
      const regs = await db.collection('registrations').find(q).toArray();
      const orgIds = [...new Set(regs.map(r => r.organization_id))];
      const orgs = await db.collection('organizations').find({ id: { $in: orgIds } }).toArray();
      const orgById = Object.fromEntries(orgs.map(o => [o.id, o]));
      const venues = await db.collection('venues').find({ edition_id: EDITION_ID }).toArray();
      const vById = Object.fromEntries(venues.map(v => [v.id, v]));
      const deposits = await db.collection('deposit_transactions').find({}).toArray();
      const depByReg = Object.fromEntries(deposits.map(d => [d.registration_id, d]));
      let rows = regs.map(r => {
        const o = orgById[r.organization_id];
        const v = vById[r.venue_id];
        const d = depByReg[r.id];
        delete r._id;
        return { ...r, organization: o ? { id: o.id, name: o.name, discipline: o.discipline, priority_level: o.priority_level, main_email: o.main_email, main_phone: o.main_phone, contact_name: o.contact_name } : null, venue: v ? { id: v.id, name: v.name, code: v.code } : null, deposit: d ? { status: d.status, amount_xpf: d.amount_xpf } : null };
      });
      if (priority) rows = rows.filter(r => r.organization?.priority_level === priority);
      if (discipline) rows = rows.filter(r => r.organization?.discipline === discipline);
      if (search) {
        const s = search.toLowerCase();
        rows = rows.filter(r => r.organization?.name?.toLowerCase().includes(s) || r.organization?.contact_name?.toLowerCase().includes(s) || r.stand_code?.toLowerCase().includes(s));
      }
      rows.sort((a, b) => (a.venue?.name || '').localeCompare(b.venue?.name || '') || (a.stand_code || '').localeCompare(b.stand_code || ''));
      return json(rows);
    }

    if (route.startsWith('registrations/')) {
      const id = p[1];
      const reg = await db.collection('registrations').findOne({ id });
      if (!reg) return err('Inscription introuvable', 404);
      const ctx = getUserContext(request);
      // Exposant can only see own
      if (ctx.role === 'exposant') {
        const user = await db.collection('users').findOne({ id: ctx.userId });
        if (!user || user.organization_id !== reg.organization_id) return err('Accès refusé', 403);
      }
      const org = await db.collection('organizations').findOne({ id: reg.organization_id });
      const venue = await db.collection('venues').findOne({ id: reg.venue_id });
      const slots = await db.collection('animation_slots').find({ registration_id: id }).toArray();
      const docs = await db.collection('registration_documents').find({ registration_id: id }).toArray();
      const deposit = await db.collection('deposit_transactions').findOne({ registration_id: id });
      const history = await db.collection('organization_history').find({ organization_id: reg.organization_id }).toArray();
      const preferences = await db.collection('organization_preferences').find({ organization_id: reg.organization_id }).toArray();
      const tasks = await db.collection('tasks_or_followups').find({ registration_id: id }).toArray();
      const emails = await db.collection('email_messages').find({ registration_id: id }).toArray();
      const anomalies = await db.collection('registration_anomalies').find({ registration_id: id }).toArray();
      const comments = await db.collection('field_comments').find({ registration_id: id }).toArray();
      const sessions = await db.collection('attendance_sessions').find({ registration_id: id }).toArray();
      [reg, org, venue, deposit].forEach(x => { if (x) delete x._id; });
      return json({
        registration: reg,
        organization: org,
        venue,
        slots: slots.map(s => { delete s._id; return s; }),
        documents: docs.map(d => { delete d._id; return d; }),
        deposit,
        history: history.map(h => { delete h._id; return h; }),
        preferences: preferences.map(pr => { delete pr._id; return pr; }),
        tasks: tasks.map(t => { delete t._id; return t; }),
        emails: emails.map(e => { delete e._id; return e; }),
        anomalies: anomalies.map(a => { delete a._id; return a; }),
        comments: comments.map(c => { delete c._id; return c; }),
        attendance_sessions: sessions.map(s => { delete s._id; return s; }),
      });
    }

    if (route === 'animation-slots') {
      const venue_id = url.searchParams.get('venue_id');
      const day = url.searchParams.get('day');
      const q = {};
      if (venue_id) q.venue_id = venue_id;
      if (day) q.day_label = day;
      const slots = await db.collection('animation_slots').find(q).toArray();
      const regIds = [...new Set(slots.map(s => s.registration_id))];
      const regs = await db.collection('registrations').find({ id: { $in: regIds } }).toArray();
      const orgs = await db.collection('organizations').find({ id: { $in: regs.map(r => r.organization_id) } }).toArray();
      const orgById = Object.fromEntries(orgs.map(o => [o.id, o]));
      const regById = Object.fromEntries(regs.map(r => [r.id, r]));
      const venues = await db.collection('venues').find({}).toArray();
      const vById = Object.fromEntries(venues.map(v => [v.id, v]));
      return json(slots.map(s => {
        const r = regById[s.registration_id];
        const o = r ? orgById[r.organization_id] : null;
        const v = vById[s.venue_id];
        delete s._id;
        return { ...s, organization_name: o?.name, discipline: o?.discipline, stand_code: r?.stand_code, venue_name: v?.name };
      }));
    }

    if (route === 'attendance') {
      const event_date = url.searchParams.get('event_date') || '2026-08-14';
      const venue_id = url.searchParams.get('venue_id');
      // Ensure sessions exist for confirmed + a_confirmer registrations
      const regsQ = { edition_id: EDITION_ID, status: { $in: ['confirme','a_confirmer','a_relancer'] } };
      if (venue_id) regsQ.venue_id = venue_id;
      const regs = await db.collection('registrations').find(regsQ).toArray();
      const orgs = await db.collection('organizations').find({ id: { $in: regs.map(r => r.organization_id) } }).toArray();
      const orgById = Object.fromEntries(orgs.map(o => [o.id, o]));
      const venues = await db.collection('venues').find({}).toArray();
      const vById = Object.fromEntries(venues.map(v => [v.id, v]));

      const sessions = [];
      for (const r of regs) {
        let s = await db.collection('attendance_sessions').findOne({ registration_id: r.id, event_date });
        if (!s) {
          s = {
            id: uuid(), registration_id: r.id, venue_id: r.venue_id, event_date,
            expected_arrival_time: r.planned_arrival_time || '10:30',
            actual_arrival_time: null,
            expected_departure_time: r.planned_departure_time || '17:00',
            actual_departure_time: null,
            presence_status: 'attendu',
            arrival_checked_by: null, departure_checked_by: null,
            is_animation_completed: false,
            arrival_stand_condition: null, departure_stand_condition: null,
            final_day_status: null,
            created_at: new Date(), updated_at: new Date(),
          };
          await db.collection('attendance_sessions').insertOne(s);
        }
        const o = orgById[r.organization_id];
        const v = vById[r.venue_id];
        delete s._id;
        sessions.push({ ...s, organization: o ? { id: o.id, name: o.name, discipline: o.discipline } : null, venue: v ? { id: v.id, name: v.name } : null, stand_code: r.stand_code, planned_arrival_time: r.planned_arrival_time, planned_departure_time: r.planned_departure_time, animation_type: r.animation_type });
      }
      sessions.sort((a, b) => (a.venue?.name || '').localeCompare(b.venue?.name || '') || (a.stand_code || '').localeCompare(b.stand_code || ''));
      return json(sessions);
    }

    if (route === 'anomalies') {
      const event_date = url.searchParams.get('event_date');
      const q = {}; if (event_date) q.event_date = event_date;
      const anomalies = await db.collection('registration_anomalies').find(q).sort({ detected_at: -1 }).toArray();
      const regs = await db.collection('registrations').find({ id: { $in: anomalies.map(a => a.registration_id) } }).toArray();
      const orgs = await db.collection('organizations').find({ id: { $in: regs.map(r => r.organization_id) } }).toArray();
      const regById = Object.fromEntries(regs.map(r => [r.id, r]));
      const orgById = Object.fromEntries(orgs.map(o => [o.id, o]));
      const venues = await db.collection('venues').find({}).toArray();
      const vById = Object.fromEntries(venues.map(v => [v.id, v]));
      return json(anomalies.map(a => {
        const r = regById[a.registration_id];
        const o = r ? orgById[r.organization_id] : null;
        const v = vById[a.venue_id];
        delete a._id;
        return { ...a, organization_name: o?.name, venue_name: v?.name, stand_code: r?.stand_code };
      }));
    }

    if (route === 'reports') {
      const reports = await db.collection('post_event_reports').find({ edition_id: EDITION_ID }).sort({ generated_at: -1 }).toArray();
      return json(reports.map(r => { delete r._id; return r; }));
    }

    if (route === 'emails') {
      const emails = await db.collection('email_messages').find({}).sort({ created_at: -1 }).limit(200).toArray();
      return json(emails.map(e => { delete e._id; return e; }));
    }

    if (route === 'activity-logs') {
      const logs = await db.collection('activity_logs').find({}).sort({ created_at: -1 }).limit(100).toArray();
      return json(logs.map(l => { delete l._id; return l; }));
    }

    if (route === 'organizations') {
      const orgs = await db.collection('organizations').find({}).sort({ name: 1 }).toArray();
      return json(orgs.map(o => { delete o._id; return o; }));
    }

    return err(`Route inconnue: ${route}`, 404);
  } catch (e) {
    console.error(e);
    return err(e.message || 'Erreur serveur', 500);
  }
}

export async function POST(request, { params }) {
  try {
    const db = await getDb();
    const p = params.path || [];
    const route = p.join('/');
    const ctx = getUserContext(request);
    let body = {}; try { body = await request.json(); } catch {}

    if (route === 'seed') {
      const result = await doSeed(body?.force || false);
      return json(result);
    }

    if (route === 'auth/login') {
      const { email, password } = body;
      const user = await db.collection('users').findOne({ email: (email || '').toLowerCase().trim() });
      if (!user) return err('Email inconnu. Avez-vous initialisé les données ?', 401);
      if (user.password !== password) return err('Mot de passe incorrect (demo: demo)', 401);
      let organization = null;
      if (user.organization_id) organization = await db.collection('organizations').findOne({ id: user.organization_id });
      delete user.password; delete user._id; if (organization) delete organization._id;
      return json({ user, organization });
    }

    // Check-in
    if (route.match(/^attendance\/[^/]+\/check-in$/)) {
      const regId = p[1];
      const { event_date, time, comment } = body;
      let s = await db.collection('attendance_sessions').findOne({ registration_id: regId, event_date });
      if (!s) return err('Session introuvable', 404);
      const now = time || new Date().toTimeString().slice(0, 5);
      await db.collection('attendance_sessions').updateOne({ id: s.id }, { $set: { actual_arrival_time: now, presence_status: 'arrive', arrival_checked_by: ctx.userId || 'u-admin', updated_at: new Date() } });
      await db.collection('attendance_events').insertOne({
        id: uuid(), attendance_session_id: s.id, event_type: 'check_in',
        event_time: now, created_by: ctx.userId || 'u-admin',
        short_comment: comment || null, detailed_comment: null, created_at: new Date(),
      });
      if (comment) {
        await db.collection('field_comments').insertOne({
          id: uuid(), registration_id: regId, attendance_session_id: s.id,
          comment_type: 'commentaire_arrivee', comment_text: comment,
          created_by: ctx.userId || 'u-admin', created_at: new Date(),
        });
      }
      // Check if late
      const expected = s.expected_arrival_time;
      if (expected && now > expected) {
        const [eh, em] = expected.split(':').map(Number);
        const [nh, nm] = now.split(':').map(Number);
        const diff = (nh * 60 + nm) - (eh * 60 + em);
        if (diff > 30) {
          await db.collection('registration_anomalies').insertOne({
            id: uuid(), registration_id: regId, attendance_session_id: s.id,
            venue_id: s.venue_id, event_date,
            anomaly_type: 'retard_important',
            severity_level: diff > 60 ? 'haute' : 'moyenne',
            title: `Retard de ${diff} min`, description: `Arrivée à ${now} au lieu de ${expected}`,
            detected_at: new Date(), reported_by: ctx.userId || 'u-admin',
            requires_deposit_review: diff > 90,
            recommended_deposit_action: diff > 90 ? 'verification_manuelle' : 'aucun_impact',
            resolved_status: 'ouvert', resolved_at: null, resolved_by: null, resolution_comment: null,
            created_at: new Date(), updated_at: new Date(),
          });
        }
      }
      await logActivity(db, ctx.userId, 'attendance_session', s.id, 'check_in', null, { time: now });
      return json({ ok: true });
    }

    // Check-out
    if (route.match(/^attendance\/[^/]+\/check-out$/)) {
      const regId = p[1];
      const { event_date, time, comment, stand_condition } = body;
      let s = await db.collection('attendance_sessions').findOne({ registration_id: regId, event_date });
      if (!s) return err('Session introuvable', 404);
      const now = time || new Date().toTimeString().slice(0, 5);
      const expected = s.expected_departure_time;
      let presence = 'parti';
      if (expected && now < expected) {
        const [eh, em] = expected.split(':').map(Number);
        const [nh, nm] = now.split(':').map(Number);
        const diff = (eh * 60 + em) - (nh * 60 + nm);
        if (diff > 30) presence = 'depart_anticipe';
      }
      await db.collection('attendance_sessions').updateOne({ id: s.id }, { $set: { actual_departure_time: now, presence_status: presence, departure_checked_by: ctx.userId || 'u-admin', departure_stand_condition: stand_condition || null, updated_at: new Date() } });
      await db.collection('attendance_events').insertOne({
        id: uuid(), attendance_session_id: s.id, event_type: 'check_out',
        event_time: now, created_by: ctx.userId || 'u-admin',
        short_comment: comment || null, detailed_comment: null, created_at: new Date(),
      });
      if (comment) {
        await db.collection('field_comments').insertOne({
          id: uuid(), registration_id: regId, attendance_session_id: s.id,
          comment_type: 'commentaire_depart', comment_text: comment,
          created_by: ctx.userId || 'u-admin', created_at: new Date(),
        });
      }
      if (presence === 'depart_anticipe') {
        await db.collection('registration_anomalies').insertOne({
          id: uuid(), registration_id: regId, attendance_session_id: s.id,
          venue_id: s.venue_id, event_date,
          anomaly_type: 'depart_avant_heure', severity_level: 'moyenne',
          title: `Départ anticipé`, description: `Départ à ${now} au lieu de ${expected}`,
          detected_at: new Date(), reported_by: ctx.userId || 'u-admin',
          requires_deposit_review: true,
          recommended_deposit_action: 'verification_manuelle',
          resolved_status: 'ouvert', resolved_at: null, resolved_by: null, resolution_comment: null,
          created_at: new Date(), updated_at: new Date(),
        });
      }
      return json({ ok: true });
    }

    // Mark absent
    if (route.match(/^attendance\/[^/]+\/mark-absent$/)) {
      const regId = p[1];
      const { event_date, comment } = body;
      let s = await db.collection('attendance_sessions').findOne({ registration_id: regId, event_date });
      if (!s) return err('Session introuvable', 404);
      await db.collection('attendance_sessions').updateOne({ id: s.id }, { $set: { presence_status: 'absent', updated_at: new Date() } });
      await db.collection('registration_anomalies').insertOne({
        id: uuid(), registration_id: regId, attendance_session_id: s.id,
        venue_id: s.venue_id, event_date,
        anomaly_type: 'absent_sans_prevenir', severity_level: 'critique',
        title: 'Absent le jour J', description: comment || 'Aucune présence constatée',
        detected_at: new Date(), reported_by: ctx.userId || 'u-admin',
        requires_deposit_review: true,
        recommended_deposit_action: 'retenue_totale',
        resolved_status: 'ouvert', resolved_at: null, resolved_by: null, resolution_comment: null,
        created_at: new Date(), updated_at: new Date(),
      });
      return json({ ok: true });
    }

    if (route === 'anomalies') {
      const anomaly = {
        id: uuid(),
        registration_id: body.registration_id,
        attendance_session_id: body.attendance_session_id || null,
        venue_id: body.venue_id || null,
        event_date: body.event_date || null,
        anomaly_type: body.anomaly_type,
        severity_level: body.severity_level || 'moyenne',
        title: body.title,
        description: body.description || null,
        detected_at: new Date(),
        reported_by: ctx.userId || 'u-admin',
        requires_deposit_review: body.requires_deposit_review || false,
        recommended_deposit_action: body.recommended_deposit_action || 'aucun_impact',
        resolved_status: 'ouvert',
        resolved_at: null, resolved_by: null, resolution_comment: null,
        created_at: new Date(), updated_at: new Date(),
      };
      await db.collection('registration_anomalies').insertOne(anomaly);
      delete anomaly._id;
      return json(anomaly, 201);
    }

    if (route === 'field-comments') {
      const c = {
        id: uuid(), registration_id: body.registration_id,
        attendance_session_id: body.attendance_session_id || null,
        comment_type: body.comment_type || 'observation',
        comment_text: body.comment_text,
        created_by: ctx.userId || 'u-admin', created_at: new Date(),
      };
      await db.collection('field_comments').insertOne(c);
      delete c._id;
      return json(c, 201);
    }

    if (route === 'emails/send') {
      // MOCKED: log email send
      const { subject, body_html, registration_ids, campaign_type } = body;
      const regs = registration_ids?.length
        ? await db.collection('registrations').find({ id: { $in: registration_ids } }).toArray()
        : await db.collection('registrations').find({ edition_id: EDITION_ID }).toArray();
      const orgs = await db.collection('organizations').find({ id: { $in: regs.map(r => r.organization_id) } }).toArray();
      const orgById = Object.fromEntries(orgs.map(o => [o.id, o]));
      // Create campaign
      const campaignId = uuid();
      await db.collection('email_campaigns').insertOne({
        id: campaignId, edition_id: EDITION_ID, name: subject || 'Campagne',
        campaign_type: campaign_type || 'relance', status: 'envoye',
        created_by: ctx.userId || 'u-admin', created_at: new Date(), updated_at: new Date(),
      });
      const msgs = [];
      for (const r of regs) {
        const o = orgById[r.organization_id];
        if (!o?.main_email) continue;
        msgs.push({
          id: uuid(), campaign_id: campaignId, registration_id: r.id,
          to_email: o.main_email, subject: subject || 'Forum Rentrée 2026',
          body_html: body_html || '<p>Bonjour,</p>',
          send_status: 'envoye', sent_at: new Date(),
          opened_at: null, clicked_at: null, response_status: 'attente',
          provider_message_id: `mock_${uuid()}`,
          created_at: new Date(), updated_at: new Date(),
        });
      }
      if (msgs.length) await db.collection('email_messages').insertMany(msgs);
      return json({ sent: msgs.length, campaign_id: campaignId });
    }

    if (route === 'reports/generate') {
      // Generate auto bilan for a registration, a site, or global
      const { scope, venue_id, registration_id, event_date } = body;
      const now = new Date();
      if (scope === 'bilan_exposant' && registration_id) {
        const reg = await db.collection('registrations').findOne({ id: registration_id });
        const org = await db.collection('organizations').findOne({ id: reg.organization_id });
        const venue = await db.collection('venues').findOne({ id: reg.venue_id });
        const sessions = await db.collection('attendance_sessions').find({ registration_id }).toArray();
        const anomalies = await db.collection('registration_anomalies').find({ registration_id }).toArray();
        const comments = await db.collection('field_comments').find({ registration_id }).toArray();
        const dep = await db.collection('deposit_transactions').findOne({ registration_id });
        // Compute recommended deposit
        let recommended = 'restitution';
        if (anomalies.some(a => ['absent_sans_prevenir','degradation','probleme_securite'].includes(a.anomaly_type))) recommended = 'retenue_totale';
        else if (anomalies.some(a => a.severity_level === 'haute' || a.severity_level === 'critique')) recommended = 'retenue_partielle';
        else if (anomalies.length) recommended = 'verification_manuelle';
        const data = {
          exposant: org?.name, discipline: org?.discipline,
          site: venue?.name, stand: reg?.stand_code,
          sessions: sessions.map(s => ({ date: s.event_date, expected_arrival: s.expected_arrival_time, actual_arrival: s.actual_arrival_time, expected_departure: s.expected_departure_time, actual_departure: s.actual_departure_time, presence: s.presence_status, animation_completed: s.is_animation_completed })),
          anomalies_count: anomalies.length,
          anomalies: anomalies.map(a => ({ type: a.anomaly_type, severity: a.severity_level, title: a.title, description: a.description })),
          comments: comments.map(c => ({ type: c.comment_type, text: c.comment_text })),
          deposit_amount_xpf: dep?.amount_xpf, recommended_deposit_action: recommended,
        };
        const report = {
          id: uuid(), edition_id: EDITION_ID, venue_id: reg.venue_id,
          registration_id, report_type: 'bilan_exposant', report_status: 'genere_auto',
          generated_at: now, generated_by: ctx.userId || 'u-admin',
          validated_at: null, validated_by: null,
          report_data_json: data, pdf_file_path: null,
          created_at: now, updated_at: now,
        };
        await db.collection('post_event_reports').insertOne(report);
        // Update deposit recommendation
        if (dep) await db.collection('deposit_transactions').updateOne({ id: dep.id }, { $set: { post_event_review_status: recommended === 'restitution' ? 'a_restituer' : (recommended === 'retenue_totale' ? 'retenue_totale' : (recommended === 'retenue_partielle' ? 'retenue_partielle' : 'verification_manuelle')), post_event_review_comment: `Bilan auto: ${anomalies.length} anomalie(s)`, updated_at: now } });
        delete report._id;
        return json(report, 201);
      }
      if (scope === 'bilan_site' && venue_id) {
        const venue = await db.collection('venues').findOne({ id: venue_id });
        const regs = await db.collection('registrations').find({ venue_id, edition_id: EDITION_ID }).toArray();
        const orgs = await db.collection('organizations').find({ id: { $in: regs.map(r => r.organization_id) } }).toArray();
        const orgById = Object.fromEntries(orgs.map(o => [o.id, o]));
        const sessionsQ = { venue_id }; if (event_date) sessionsQ.event_date = event_date;
        const sessions = await db.collection('attendance_sessions').find(sessionsQ).toArray();
        const anomalies = await db.collection('registration_anomalies').find({ venue_id, ...(event_date ? { event_date } : {}) }).toArray();
        const present = sessions.filter(s => ['arrive','parti','depart_anticipe'].includes(s.presence_status)).length;
        const absent = sessions.filter(s => s.presence_status === 'absent').length;
        const late = sessions.filter(s => s.actual_arrival_time && s.expected_arrival_time && s.actual_arrival_time > s.expected_arrival_time).length;
        const early_leave = sessions.filter(s => s.presence_status === 'depart_anticipe').length;
        const data = {
          site: venue?.name, event_date: event_date || 'tous les jours',
          expected: sessions.length, present, absent, late, early_leave,
          taux_presence: sessions.length > 0 ? Math.round((present / sessions.length) * 100) : 0,
          anomalies_count: anomalies.length,
          incidents_majeurs: anomalies.filter(a => a.severity_level === 'haute' || a.severity_level === 'critique').map(a => ({ exposant: orgById[regs.find(r => r.id === a.registration_id)?.organization_id]?.name, type: a.anomaly_type, title: a.title })),
          exposants: regs.map(r => ({ name: orgById[r.organization_id]?.name, stand: r.stand_code, status: r.status })),
        };
        const report = {
          id: uuid(), edition_id: EDITION_ID, venue_id, registration_id: null,
          report_type: 'bilan_site', report_status: 'genere_auto',
          generated_at: now, generated_by: ctx.userId || 'u-admin',
          validated_at: null, validated_by: null,
          report_data_json: data, pdf_file_path: null,
          created_at: now, updated_at: now,
        };
        await db.collection('post_event_reports').insertOne(report);
        delete report._id;
        return json(report, 201);
      }
      if (scope === 'bilan_global') {
        const venues = await db.collection('venues').find({ edition_id: EDITION_ID }).toArray();
        const regs = await db.collection('registrations').find({ edition_id: EDITION_ID }).toArray();
        const sessions = await db.collection('attendance_sessions').find({}).toArray();
        const anomalies = await db.collection('registration_anomalies').find({}).toArray();
        const data = {
          edition: 'Forum de la Rentrée 2026', venues_count: venues.length,
          total_exposants: regs.length,
          total_confirmed: regs.filter(r => r.status === 'confirme').length,
          total_sessions: sessions.length,
          total_present: sessions.filter(s => ['arrive','parti','depart_anticipe'].includes(s.presence_status)).length,
          total_absent: sessions.filter(s => s.presence_status === 'absent').length,
          total_anomalies: anomalies.length,
          anomalies_by_type: anomalies.reduce((acc, a) => { acc[a.anomaly_type] = (acc[a.anomaly_type] || 0) + 1; return acc; }, {}),
          anomalies_by_severity: anomalies.reduce((acc, a) => { acc[a.severity_level] = (acc[a.severity_level] || 0) + 1; return acc; }, {}),
          by_site: venues.map(v => ({ site: v.name, exposants: regs.filter(r => r.venue_id === v.id).length, anomalies: anomalies.filter(a => a.venue_id === v.id).length })),
        };
        const report = {
          id: uuid(), edition_id: EDITION_ID, venue_id: null, registration_id: null,
          report_type: 'bilan_global', report_status: 'genere_auto',
          generated_at: now, generated_by: ctx.userId || 'u-admin',
          validated_at: null, validated_by: null,
          report_data_json: data, pdf_file_path: null,
          created_at: now, updated_at: now,
        };
        await db.collection('post_event_reports').insertOne(report);
        delete report._id;
        return json(report, 201);
      }
      return err('scope invalide', 400);
    }

    if (route === 'tasks') {
      const t = {
        id: uuid(), registration_id: body.registration_id,
        task_type: body.task_type || 'autre', title: body.title,
        due_date: body.due_date || null, status: 'a_faire',
        assigned_to: body.assigned_to || ctx.userId || 'u-admin',
        completed_at: null, notes: body.notes || null,
        created_at: new Date(), updated_at: new Date(),
      };
      await db.collection('tasks_or_followups').insertOne(t);
      delete t._id;
      return json(t, 201);
    }

    return err(`Route POST inconnue: ${route}`, 404);
  } catch (e) {
    console.error(e);
    return err(e.message || 'Erreur serveur', 500);
  }
}

export async function PUT(request, { params }) {
  try {
    const db = await getDb();
    const p = params.path || [];
    const route = p.join('/');
    const ctx = getUserContext(request);
    let body = {}; try { body = await request.json(); } catch {}

    if (route.startsWith('registrations/')) {
      const id = p[1];
      const old = await db.collection('registrations').findOne({ id });
      if (!old) return err('Introuvable', 404);
      const allowed = ['status','animation_type','friday_slot_label','saturday_slot_label','stand_needed','is_convention_signed','is_deposit_required','is_deposit_received','is_insurance_uploaded','is_guide_sent','planned_arrival_time','planned_departure_time','post_event_status','post_event_summary','internal_notes','venue_id','stand_code','completion_percent'];
      const upd = {};
      for (const k of allowed) if (k in body) upd[k] = body[k];
      upd.updated_at = new Date();
      await db.collection('registrations').updateOne({ id }, { $set: upd });
      await logActivity(db, ctx.userId, 'registration', id, 'update', old, upd);
      const reg = await db.collection('registrations').findOne({ id });
      delete reg._id;
      return json(reg);
    }

    if (route.startsWith('deposits/')) {
      const id = p[1];
      const allowed = ['status','payment_method','received_at','returned_at','retained_reason','retained_amount_xpf','post_event_review_status','post_event_review_comment','recommended_return_amount_xpf','notes'];
      const upd = {};
      for (const k of allowed) if (k in body) upd[k] = body[k];
      upd.updated_at = new Date();
      // Also set received_at if status is recue and not set
      if (upd.status === 'recue' && !upd.received_at) upd.received_at = new Date();
      await db.collection('deposit_transactions').updateOne({ id }, { $set: upd });
      // Sync is_deposit_received on registration
      if (upd.status) {
        const dep = await db.collection('deposit_transactions').findOne({ id });
        await db.collection('registrations').updateOne({ id: dep.registration_id }, { $set: { is_deposit_received: upd.status === 'recue', updated_at: new Date() } });
      }
      const dep = await db.collection('deposit_transactions').findOne({ id });
      delete dep._id;
      return json(dep);
    }

    if (route.startsWith('anomalies/')) {
      const id = p[1];
      const allowed = ['resolved_status','resolution_comment','recommended_deposit_action','severity_level'];
      const upd = {}; for (const k of allowed) if (k in body) upd[k] = body[k];
      if (upd.resolved_status && upd.resolved_status !== 'ouvert') { upd.resolved_at = new Date(); upd.resolved_by = ctx.userId || 'u-admin'; }
      upd.updated_at = new Date();
      await db.collection('registration_anomalies').updateOne({ id }, { $set: upd });
      const a = await db.collection('registration_anomalies').findOne({ id }); delete a._id;
      return json(a);
    }

    if (route.startsWith('attendance-sessions/')) {
      const id = p[1];
      const allowed = ['actual_arrival_time','actual_departure_time','presence_status','is_animation_completed','arrival_stand_condition','departure_stand_condition','final_day_status'];
      const upd = {}; for (const k of allowed) if (k in body) upd[k] = body[k];
      upd.updated_at = new Date();
      await db.collection('attendance_sessions').updateOne({ id }, { $set: upd });
      const s = await db.collection('attendance_sessions').findOne({ id }); delete s._id;
      return json(s);
    }

    if (route.startsWith('reports/')) {
      const id = p[1];
      const allowed = ['report_status','report_data_json','validated_at','validated_by'];
      const upd = {}; for (const k of allowed) if (k in body) upd[k] = body[k];
      if (upd.report_status === 'valide') { upd.validated_at = new Date(); upd.validated_by = ctx.userId || 'u-admin'; }
      upd.updated_at = new Date();
      await db.collection('post_event_reports').updateOne({ id }, { $set: upd });
      const r = await db.collection('post_event_reports').findOne({ id }); delete r._id;
      return json(r);
    }

    return err(`Route PUT inconnue: ${route}`, 404);
  } catch (e) {
    console.error(e);
    return err(e.message || 'Erreur serveur', 500);
  }
}

export async function DELETE(request, { params }) {
  try {
    const db = await getDb();
    const p = params.path || [];
    const route = p.join('/');
    if (route.startsWith('registrations/')) {
      await db.collection('registrations').deleteOne({ id: p[1] });
      return json({ ok: true });
    }
    return err('Route DELETE inconnue', 404);
  } catch (e) { return err(e.message, 500); }
}

/**
 * 🎯 WIZARD HELPERS — Tunnel de réservation exposant en 5 étapes
 * Module utilitaire pour la gestion des créneaux de passage,
 * des disponibilités temps réel, et de l'état du wizard.
 *
 * Collections impliquées :
 *  - visit_slots : créneaux de passage (1h, par venue + jour, capacité 4)
 *  - registrations : champ wizard_state ajouté
 *  - animation_slots : déjà existant (45 min)
 *
 * Source de vérité unique : MongoDB. Atomic ops pour éviter les conflits.
 */
import { v4 as uuid } from 'uuid';

/**
 * 🆕 SESSION 53.22 — Charge les paramètres centralisés du Forum depuis event_settings.
 *   - Fallback sur WIZARD_CONFIG.DAYS / DEFAULT_ANIMATION_WINDOW si la collection est vide.
 *   - Utilisé par getFullAvailability() pour propager les dates/horaires saisis par l'admin
 *     dans la page « Configuration » jusqu'au tunnel exposant.
 *
 * @param {import('mongodb').Db} db
 * @returns {Promise<{
 *   DAYS: Array<{ key: 'vendredi'|'samedi', label: string, date: string, open: string, close: string }>,
 *   ANIM_DURATION_STAND_MIN: number,
 *   ANIM_DURATION_DEMO_MIN: number,
 *   LUNCH: { start: string, end: string },
 *   raw: object
 * }>}
 */
export async function loadEffectiveEventConfig(db) {
  let raw = {};
  try {
    if (db?.collection) {
      raw = await db.collection('event_settings').findOne({ id: 'current' }) || {};
    }
  } catch { raw = {}; }
  const DAYS = [
    {
      key: 'vendredi',
      label: raw.friday_label || 'Vendredi 14 août 2026',
      date: raw.friday_date || '2026-08-14',
      open: raw.friday_open || '11:00',
      close: raw.friday_close || '17:00',
    },
    {
      key: 'samedi',
      label: raw.saturday_label || 'Samedi 15 août 2026',
      date: raw.saturday_date || '2026-08-15',
      open: raw.saturday_open || '09:00',
      close: raw.saturday_close || '17:00',
    },
  ];
  return {
    DAYS,
    ANIM_DURATION_STAND_MIN: Number(raw.stand_slot_minutes) || 30,
    ANIM_DURATION_DEMO_MIN: Number(raw.demo_slot_minutes) || 45,
    LUNCH: { start: raw.lunch_start || '12:00', end: raw.lunch_end || '13:00' },
    raw,
  };
}

export const WIZARD_CONFIG = {
  DAYS: [
    { key: 'vendredi', label: 'Vendredi 14 août 2026', date: '2026-08-14' },
    { key: 'samedi', label: 'Samedi 15 août 2026', date: '2026-08-15' },
  ],
  // Créneaux de passage exposant — toutes les 1h de 8h à 18h
  VISIT_SLOT_HOURS: [
    { start: '08:00', end: '09:00' },
    { start: '09:00', end: '10:00' },
    { start: '10:00', end: '11:00' },
    { start: '11:00', end: '12:00' },
    { start: '12:00', end: '13:00' },
    { start: '13:00', end: '14:00' },
    { start: '14:00', end: '15:00' },
    { start: '15:00', end: '16:00' },
    { start: '16:00', end: '17:00' },
    { start: '17:00', end: '18:00' },
  ],
  // 🆕 SESSION 48b — Durées FIXES par lieu d'animation (remplace l'ancienne logique dynamique)
  //   • Sur stand (zone exposant) = 30 min (chaque exposant sur son stand, multiples parallèles possibles)
  //   • Zone démo (zone partagée) = 45 min (1 seul exposant à la fois)
  ANIM_DURATION_STAND_MIN: 30,
  ANIM_DURATION_DEMO_MIN: 45,
  // Plage horaire par défaut si pas configurée par site
  DEFAULT_ANIMATION_WINDOW: { start: '09:00', end: '17:00' },
  // ⚠️ Conservés pour rétro-compat (utilisés par anciens écrans en lecture seule)
  ANIM_MIN_DURATION_MIN: 15,
  ANIM_MAX_DURATION_MIN: 60,
  ANIM_DEFAULT_DURATION_MIN: 30,
  ANIM_SLOT_DURATION_MIN: 30,
  ANIM_SLOTS: (() => {
    const out = [];
    let m = 9 * 60;
    const end = 17 * 60;
    while (m + 30 <= end) {
      const sh = String(Math.floor(m / 60)).padStart(2, '0');
      const sm = String(m % 60).padStart(2, '0');
      const eM = m + 30;
      const eh = String(Math.floor(eM / 60)).padStart(2, '0');
      const em = String(eM % 60).padStart(2, '0');
      out.push({ start: `${sh}:${sm}`, end: `${eh}:${em}` });
      m += 30;
    }
    return out;
  })(),
  VISIT_SLOT_CAPACITY_DEFAULT: 4, // max 4 exposants par créneau de passage
  MAX_REPRESENTATIVES: 2,
  STAND_DESCRIPTION_MAX_CHARS: 150,
  ANIMATION_LOCATIONS: [
    { value: 'sur_stand', label: 'Sur stand', description: "L'animation se déroule directement sur l'espace de l'exposant" },
    { value: 'zone_demo', label: 'Zone de démonstration', description: 'Espace partagé dédié aux performances et démonstrations devant public' },
  ],
  ANIMATION_TYPES: [
    { value: 'demonstration', label: 'Démonstration / initiation', description: "Présentez votre activité par une démonstration en direct ou proposez une initiation pour les visiteurs curieux." },
    { value: 'spectacle', label: 'Spectacle / performance', description: 'Offrez une performance ou un spectacle structuré devant le public (chorégraphie, démonstration sportive, etc.).' },
    { value: 'atelier', label: 'Atelier participatif', description: 'Animez un atelier interactif où le public peut essayer et apprendre par la pratique.' },
    { value: 'jeu', label: 'Jeu / concours', description: "Proposez un jeu ou un concours pour faire participer le public de manière ludique." },
    { value: 'exposition', label: 'Exposition / affichage', description: 'Présentez votre activité via une exposition visuelle, photos, panneaux ou vidéos.' },
    { value: 'conference', label: 'Conférence / présentation', description: 'Donnez une présentation orale structurée sur votre association ou discipline.' },
  ],
  PUBLIC_TARGETS: [
    { value: 'enfants', label: 'Enfants' },
    { value: 'adultes', label: 'Adultes' },
    { value: 'tous_publics', label: 'Tous publics' },
    { value: 'familles', label: 'Familles' },
  ],
};

/**
 * Génère (idempotent) la grille des visit_slots pour toutes les venues+jours.
 * Capacité par défaut : 4 exposants par créneau d'1h.
 */
export async function seedVisitSlots(db) {
  // 🆕 SESSION 53.22 — Utilise les dates centralisées event_settings (avec fallback WIZARD_CONFIG.DAYS)
  const cfg = await loadEffectiveEventConfig(db);
  const DAYS = cfg.DAYS;
  const venues = await db.collection('venues').find({}).toArray();
  let created = 0, skipped = 0;
  for (const v of venues) {
    for (const day of DAYS) {
      for (const slot of WIZARD_CONFIG.VISIT_SLOT_HOURS) {
        const exists = await db.collection('visit_slots').findOne({
          venue_id: v.id, day_label: day.key, start_time: slot.start,
        });
        if (exists) { skipped++; continue; }
        await db.collection('visit_slots').insertOne({
          id: uuid(),
          venue_id: v.id,
          venue_name: v.name,
          day_label: day.key,
          day_date: day.date,
          start_time: slot.start,
          end_time: slot.end,
          capacity: WIZARD_CONFIG.VISIT_SLOT_CAPACITY_DEFAULT,
          booked_count: 0,
          status: 'open',
          created_at: new Date(),
          updated_at: new Date(),
        });
        created++;
      }
    }
  }
  return { created, skipped, total_expected: venues.length * DAYS.length * WIZARD_CONFIG.VISIT_SLOT_HOURS.length };
}

/**
 * 🆕 SESSION 44 — Génère une grille d'animation DYNAMIQUE selon le nombre d'exposants attendus.
 *
 * Règle métier :
 *  - durée_créneau = plage_totale_minutes / N_exposants_attendus
 *  - durée bornée par [ANIM_MIN_DURATION_MIN, ANIM_MAX_DURATION_MIN]
 *  - durée arrondie au plus proche multiple de 5 min pour lisibilité
 *  - Si N=0 : grille de prévisualisation avec durée par défaut (30 min)
 *  - capacity = floor(plage_totale / durée_créneau)
 *  - is_full = (N >= capacity)
 *  - waitlist_count = max(0, N - capacity)
 *
 * @param {{ window_start: string, window_end: string, expected_count: number }} args
 * @returns {{ duration_min: number, capacity: number, expected_count: number, is_full: boolean, waitlist_count: number, slots: Array<{index, start, end}>, window_start: string, window_end: string }}
 */
/**
 * 🆕 SESSION 48b — Génère une grille d'animation avec TROIS sous-grilles par jour :
 *   • slots_stand : créneaux de 30 min pour animation sur stand
 *   • slots_demo  : créneaux de 45 min pour zone de démonstration
 *   • slots       : alias = slots_stand (rétro-compat avec live-availability-floater & simulation-engine)
 *
 * Pour zone démo : 1 seul exposant peut occuper le créneau (zone partagée).
 * Pour stand : chaque exposant a son propre stand (occupations parallèles possibles).
 *
 * @param {{ window_start: string, window_end: string, expected_count: number }} args
 */
export function buildAnimationGrid({ window_start, window_end, expected_count, duration_stand_min, duration_demo_min }) {
  const toMin = (hhmm) => {
    const [h, m] = (hhmm || '09:00').split(':').map(Number);
    return h * 60 + m;
  };
  const toHHMM = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  const startM = toMin(window_start);
  const endM = toMin(window_end);
  const total = Math.max(0, endM - startM);
  const n = Math.max(0, Number(expected_count) || 0);
  const dStand = Number(duration_stand_min) > 0 ? Number(duration_stand_min) : WIZARD_CONFIG.ANIM_DURATION_STAND_MIN;
  const dDemo = Number(duration_demo_min) > 0 ? Number(duration_demo_min) : WIZARD_CONFIG.ANIM_DURATION_DEMO_MIN;

  const buildSlots = (duration_min) => {
    const slots = [];
    if (duration_min <= 0) return slots;
    const capacity = Math.floor(total / duration_min);
    for (let i = 0; i < capacity; i++) {
      const s = startM + i * duration_min;
      const e = s + duration_min;
      slots.push({ index: i, start: toHHMM(s), end: toHHMM(e) });
    }
    return slots;
  };

  const slots_stand = buildSlots(dStand);
  const slots_demo = buildSlots(dDemo);

  return {
    duration_min: dStand, // rétro-compat (anciens écrans)
    duration_stand_min: dStand,
    duration_demo_min: dDemo,
    capacity: slots_stand.length, // rétro-compat = capacité stand
    capacity_stand: slots_stand.length,
    capacity_demo: slots_demo.length,
    expected_count: n,
    is_full: n >= slots_stand.length && slots_stand.length > 0,
    waitlist_count: Math.max(0, n - slots_stand.length),
    slots: slots_stand, // rétro-compat : pointe vers slots_stand
    slots_stand,
    slots_demo,
    window_start,
    window_end,
  };
}

/**
 * Retourne la disponibilité complète pour un site (toutes les venues+jours).
 * Format optimisé pour l'UI wizard.
 */
export async function getFullAvailability(db) {
  // 🆕 SESSION 53.22 — Charge la config centralisée (event_settings) pour propager
  //   les dates/horaires admin dans tout le tunnel exposant.
  const cfg = await loadEffectiveEventConfig(db);
  const DAYS = cfg.DAYS; // [{key, label, date, open, close}]
  const ANIM_STAND = cfg.ANIM_DURATION_STAND_MIN;
  const ANIM_DEMO = cfg.ANIM_DURATION_DEMO_MIN;

  // 🆕 SESSION 47.15 — Filtre cohérent avec /api/venues?only_active=1 :
  //   on exclut les venues désactivées pour 2026 (is_available_2026=false) OU globalement (is_active=false).
  const venues = await db.collection('venues').find({
    is_active: { $ne: false },
    is_available_2026: { $ne: false },
  }).toArray();
  const visitSlots = await db.collection('visit_slots').find({}).toArray();
  const animSlots = await db.collection('animation_slots').find({ status: { $ne: 'annulé' } }).toArray();
  const regs = await db.collection('registrations').find({}).toArray();

  // Capacité par site = capacity_stands. Compte les regs confirmées par site+jour.
  // (Une registration n'a qu'un seul jour de présence — TODO: pour l'instant non distingué)
  const venueData = venues.map(v => {
    const regsAtVenue = regs.filter(r => r.venue_id === v.id);
    // 🆕 SESSION 43-k — Comptages dynamiques par statut (pour comportement premier-arrivé-premier-servi)
    const regsConfirmed = regsAtVenue.filter(r => r.status === 'confirme');
    const regsPending = regsAtVenue.filter(r => r.status === 'a_confirmer');
    const regsWaitlist = regsAtVenue.filter(r => r.status === 'liste_attente');
    const visitSlotsAtVenue = visitSlots.filter(vs => vs.venue_id === v.id);
    const animSlotsAtVenue = animSlots.filter(as => as.venue_id === v.id);
    return {
      id: v.id,
      name: v.name,
      code: v.code,
      address: v.address,
      capacity_stands: v.capacity_stands || 0,
      stands_used: regsAtVenue.length,
      // Comptages globaux par statut
      confirmed_count: regsConfirmed.length,
      pending_count: regsPending.length,
      waitlist_count: regsWaitlist.length,
      available_per_day: DAYS.map(d => {
        const slots = visitSlotsAtVenue.filter(vs => vs.day_label === d.key);
        const totalCapacity = slots.reduce((a, s) => a + (s.capacity || 0), 0);
        const totalBooked = slots.reduce((a, s) => a + (s.booked_count || 0), 0);
        // 🆕 Comptages par jour basés sur attending_days des registrations
        const dayConfirmed = regsConfirmed.filter(r => Array.isArray(r.attending_days) && (r.attending_days.includes(d.key) || r.attending_days.includes(d.date))).length;
        const dayPending = regsPending.filter(r => Array.isArray(r.attending_days) && (r.attending_days.includes(d.key) || r.attending_days.includes(d.date))).length;
        const dayWaitlist = regsWaitlist.filter(r => Array.isArray(r.attending_days) && (r.attending_days.includes(d.key) || r.attending_days.includes(d.date))).length;
        return {
          day_key: d.key,
          day_label: d.label,
          day_date: d.date,
          total_capacity: totalCapacity,
          total_booked: totalBooked,
          remaining: Math.max(0, totalCapacity - totalBooked),
          is_full: totalCapacity > 0 && totalBooked >= totalCapacity,
          // 🆕 Signalétique premier-arrivé : montrer combien sont en attente sur ce jour
          confirmed_count_day: dayConfirmed,
          pending_count_day: dayPending,
          waitlist_count_day: dayWaitlist,
          competition_level: dayPending > 5 ? 'forte' : dayPending > 2 ? 'modérée' : dayPending > 0 ? 'faible' : 'aucune',
        };
      }),
      visit_slots: visitSlotsAtVenue.map(vs => ({
        id: vs.id,
        day_label: vs.day_label,
        start_time: vs.start_time,
        end_time: vs.end_time,
        capacity: vs.capacity,
        booked_count: vs.booked_count || 0,
        remaining: Math.max(0, (vs.capacity || 0) - (vs.booked_count || 0)),
        is_full: (vs.capacity || 0) <= (vs.booked_count || 0),
      })),
      // 🆕 SESSION 44 — Plage horaire d'animation configurée par site (par jour).
      //   Si pas définie par site, fallback sur la config centralisée event_settings (ouverture/fermeture).
      animation_windows: v.animation_windows || {
        vendredi: { start: DAYS[0].open, end: DAYS[0].close },
        samedi: { start: DAYS[1].open, end: DAYS[1].close },
      },
      // 🆕 SESSION 44 — Grille DYNAMIQUE par jour (durée = plage ÷ N exposants attendus)
      animation_grid: (() => {
        const out = {};
        for (const d of DAYS) {
          const winFromSite = v.animation_windows?.[d.key];
          const win = winFromSite && winFromSite.start && winFromSite.end
            ? winFromSite
            : { start: d.open, end: d.close };
          // N = nombre d'exposants qui seront présents ce jour (animation obligatoire pour tous)
          const expectedCount = regsAtVenue.filter(r => {
            const ad = Array.isArray(r.attending_days) ? r.attending_days : [];
            return r.status !== 'annule' && r.status !== 'cancelled' && (ad.includes(d.key) || ad.includes(d.date));
          }).length;
          const grid = buildAnimationGrid({
            window_start: win.start,
            window_end: win.end,
            expected_count: expectedCount,
            duration_stand_min: ANIM_STAND,
            duration_demo_min: ANIM_DEMO,
          });
          // Marque l'occupation des slots avec les animations déjà sauvegardées
          // 🆕 SESSION 48b — On marque slots_stand ET slots_demo séparément (durées différentes).
          //   Pour zone démo : 1 seul exposant par créneau (zone partagée).
          //   Pour sur stand : plusieurs exposants peuvent avoir le même créneau (chacun son stand).
          //   La logique d'occupation reste néanmoins identique côté UI (afficher qui occupe).
          const occupants = animSlotsAtVenue.filter(a => a.day_label === d.key);
          const markSlots = (slots, kind) => slots.map(s => {
            const sameSlot = occupants.filter(o => {
              if (o.start_time !== s.start || o.end_time !== s.end) return false;
              // Filtre par type de lieu pour distinguer les occupations stand vs démo
              const oKind = (o.location_type === 'zone_demo' || o.location_type === 'zone_animation' || o.location_type === 'scene') ? 'demo' : 'stand';
              return oKind === kind;
            });
            const primary = sameSlot.find(o => o.request_status === 'validated')
              || sameSlot.find(o => o.request_status === 'pending')
              || sameSlot.find(o => !o.request_status)
              || sameSlot.find(o => o.request_status === 'waitlist')
              || null;
            const waitlistOnSlot = sameSlot.filter(o => o.request_status === 'waitlist').length;
            return primary
              ? {
                  ...s,
                  occupied: true,
                  registration_id: primary.registration_id,
                  organization_name: primary.organization_name,
                  location_type: primary.location_type,
                  request_status: primary.request_status || null,
                  slot_waitlist_count: waitlistOnSlot,
                }
              : { ...s, occupied: false };
          });
          grid.slots_stand = markSlots(grid.slots_stand, 'stand');
          grid.slots_demo = markSlots(grid.slots_demo, 'demo');
          // Rétro-compat : .slots = slots_stand
          grid.slots = grid.slots_stand;
          out[d.key] = grid;
        }
        return out;
      })(),
      animation_slots_occupied: animSlotsAtVenue.map(as => ({
        id: as.id,
        day_label: as.day_label,
        start_time: as.start_time,
        end_time: as.end_time,
        registration_id: as.registration_id,
      })),
    };
  });
  return { venues: venueData, config: WIZARD_CONFIG };
}

/**
 * Réservation atomique d'un créneau de passage.
 * Utilise findOneAndUpdate avec filtre capacity > booked_count pour éviter le double booking.
 */
export async function bookVisitSlot(db, { visit_slot_id, registration_id }) {
  // 1) Libère l'ancien créneau si existant
  const reg = await db.collection('registrations').findOne({ id: registration_id });
  if (!reg) throw new Error('Inscription introuvable');
  if (reg.visit_slot_id && reg.visit_slot_id !== visit_slot_id) {
    await db.collection('visit_slots').updateOne(
      { id: reg.visit_slot_id },
      { $inc: { booked_count: -1 }, $set: { updated_at: new Date() } }
    );
  }
  // 2) Réserve le nouveau si pas déjà sur ce créneau
  if (reg.visit_slot_id !== visit_slot_id) {
    const updated = await db.collection('visit_slots').findOneAndUpdate(
      { id: visit_slot_id, $expr: { $lt: ['$booked_count', '$capacity'] } },
      { $inc: { booked_count: 1 }, $set: { updated_at: new Date() } },
      { returnDocument: 'after' }
    );
    // MongoDB driver >= 5.x renvoie directement le document (ou null), driver <5 renvoie { value: doc }
    const newDoc = updated && (updated.value !== undefined ? updated.value : updated);
    if (!newDoc) {
      // Re-incrémenter l'ancien si on en avait un (rollback)
      if (reg.visit_slot_id) {
        await db.collection('visit_slots').updateOne(
          { id: reg.visit_slot_id },
          { $inc: { booked_count: 1 }, $set: { updated_at: new Date() } }
        );
      }
      throw new Error('Ce créneau est complet, choisissez-en un autre');
    }
    await db.collection('registrations').updateOne(
      { id: registration_id },
      { $set: { visit_slot_id, updated_at: new Date() } }
    );
  }
  const slot = await db.collection('visit_slots').findOne({ id: visit_slot_id });
  return { ok: true, slot };
}

/**
 * Libère un créneau de passage (annulation).
 */
export async function releaseVisitSlot(db, { registration_id }) {
  const reg = await db.collection('registrations').findOne({ id: registration_id });
  if (!reg?.visit_slot_id) return { ok: true, released: false };
  await db.collection('visit_slots').updateOne(
    { id: reg.visit_slot_id },
    { $inc: { booked_count: -1 }, $set: { updated_at: new Date() } }
  );
  await db.collection('registrations').updateOne(
    { id: registration_id },
    { $unset: { visit_slot_id: '' }, $set: { updated_at: new Date() } }
  );
  return { ok: true, released: true };
}

/**
 * Récupère l'état complet du wizard pour un exposant.
 */
export async function getWizardState(db, registration_id) {
  const reg = await db.collection('registrations').findOne({ id: registration_id });
  if (!reg) return null;
  const org = await db.collection('organizations').findOne({ id: reg.organization_id });
  const venue = reg.venue_id ? await db.collection('venues').findOne({ id: reg.venue_id }) : null;
  const visitSlot = reg.visit_slot_id ? await db.collection('visit_slots').findOne({ id: reg.visit_slot_id }) : null;
  const animSlots = await db.collection('animation_slots').find({ registration_id }).toArray();
  const docs = await db.collection('registration_documents').find({ registration_id }).toArray();
  const dep = await db.collection('deposit_transactions').findOne({ registration_id });
  const valReq = reg.validation_request_id
    ? await db.collection('validation_requests').findOne({ id: reg.validation_request_id })
    : null;

  // Statut de chaque étape — 5 étapes simplifiées
  // 1) Profil  2) Jour (site+jours+horaires)  3) Stand  4) Animation  5) RDV & confirmation
  const stepStatus = {
    step1_profile: !!(org?.name && org?.discipline && org?.contact_name && org?.main_email && org?.main_phone && org?.representatives_count && org?.stand_description),
    step2_days: !!(reg.venue_id && Array.isArray(reg.attending_days) && reg.attending_days.length > 0),
    step3_stand: !!reg.stand_code,
    step4_animation: animSlots.length >= 1 && animSlots.every(a => a.status !== 'annulé'),
    step5_docs_rdv: !!(valReq?.rdv_date || ['rdv_fixe','en_attente','rdv_confirme'].includes(valReq?.status) || reg.caution_deposit_at || (docs.length >= 2 && reg.is_insurance_uploaded && reg.is_convention_signed)),
    step6_confirmed: reg.status === 'confirme',
    // Compat rétro pour code historique
    step2_booking: !!(reg.venue_id && reg.stand_code && Array.isArray(reg.attending_days) && reg.attending_days.length > 0),
    step3_animation: animSlots.length >= 1 && animSlots.every(a => a.status !== 'annulé'),
    step4_docs_rdv: !!(valReq?.rdv_date || ['rdv_fixe','en_attente','rdv_confirme'].includes(valReq?.status) || reg.caution_deposit_at || (docs.length >= 2 && reg.is_insurance_uploaded && reg.is_convention_signed)),
    step5_confirmed: reg.status === 'confirme',
  };
  const currentStep = stepStatus.step6_confirmed ? 5
    : stepStatus.step5_docs_rdv ? 5
    : stepStatus.step4_animation ? 5
    : stepStatus.step3_stand ? 4
    : stepStatus.step2_days ? 3
    : stepStatus.step1_profile ? 2
    : 1;

  return {
    registration: reg,
    organization: org,
    venue,
    visit_slot: visitSlot,
    animation_slots: animSlots,
    documents: docs,
    deposit: dep,
    validation_request: valReq,
    step_status: stepStatus,
    current_step: currentStep,
    locked_fields: {
      venue_id: !!(reg.venue_id && reg.stand_code),
      stand_code: !!(reg.stand_code && reg.status === 'confirme'),
      attending_days: !!(reg.attending_days && reg.attending_days.length > 0 && reg.status === 'confirme'),
      animation_slots: animSlots.length > 0 && reg.status === 'confirme',
    },
  };
}

/**
 * Génère un token de modification post-confirmation
 * (pour modifier créneau de passage OU créneau d'animation).
 */
export async function createModificationToken(db, { registration_id, scope }) {
  const token = uuid().replace(/-/g, '') + uuid().replace(/-/g, '').slice(0, 16);
  await db.collection('modification_tokens').insertOne({
    id: uuid(),
    token,
    registration_id,
    scope, // 'visit_slot' | 'animation_slot' | 'rdv_caution'
    used_at: null,
    expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 jours
    created_at: new Date(),
  });
  return token;
}

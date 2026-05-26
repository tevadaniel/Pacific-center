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
  // 🆕 SESSION 44 — Créneaux d'animation DYNAMIQUES (durée = plage_totale ÷ N exposants)
  // Plage horaire par défaut si pas configurée par site (09:00 → 17:00 = 480 min)
  DEFAULT_ANIMATION_WINDOW: { start: '09:00', end: '17:00' },
  ANIM_MIN_DURATION_MIN: 15,   // créneau minimum
  ANIM_MAX_DURATION_MIN: 60,   // créneau maximum (si peu d'exposants)
  ANIM_DEFAULT_DURATION_MIN: 30, // utilisé quand 0 exposant attendu (rendu d'aperçu)
  // Conservé pour compat (utilisé par anciens écrans en lecture seule)
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
  const venues = await db.collection('venues').find({}).toArray();
  let created = 0, skipped = 0;
  for (const v of venues) {
    for (const day of WIZARD_CONFIG.DAYS) {
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
  return { created, skipped, total_expected: venues.length * WIZARD_CONFIG.DAYS.length * WIZARD_CONFIG.VISIT_SLOT_HOURS.length };
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
export function buildAnimationGrid({ window_start, window_end, expected_count }) {
  const toMin = (hhmm) => {
    const [h, m] = (hhmm || '09:00').split(':').map(Number);
    return h * 60 + m;
  };
  const toHHMM = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  const startM = toMin(window_start);
  const endM = toMin(window_end);
  const total = Math.max(0, endM - startM);
  const n = Math.max(0, Number(expected_count) || 0);

  let duration_min;
  if (n === 0) {
    duration_min = WIZARD_CONFIG.ANIM_DEFAULT_DURATION_MIN;
  } else {
    // Durée idéale = plage / n, bornée et arrondie à 5 min
    let raw = Math.floor(total / n);
    raw = Math.max(WIZARD_CONFIG.ANIM_MIN_DURATION_MIN, Math.min(WIZARD_CONFIG.ANIM_MAX_DURATION_MIN, raw));
    duration_min = Math.max(5, Math.round(raw / 5) * 5);
  }

  const capacity = duration_min > 0 ? Math.floor(total / duration_min) : 0;
  const slots = [];
  for (let i = 0; i < capacity; i++) {
    const s = startM + i * duration_min;
    const e = s + duration_min;
    slots.push({ index: i, start: toHHMM(s), end: toHHMM(e) });
  }
  return {
    duration_min,
    capacity,
    expected_count: n,
    is_full: n >= capacity && capacity > 0,
    waitlist_count: Math.max(0, n - capacity),
    slots,
    window_start,
    window_end,
  };
}

/**
 * Retourne la disponibilité complète pour un site (toutes les venues+jours).
 * Format optimisé pour l'UI wizard.
 */
export async function getFullAvailability(db) {
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
      available_per_day: WIZARD_CONFIG.DAYS.map(d => {
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
      // 🆕 SESSION 44 — Plage horaire d'animation configurée par site (par jour)
      animation_windows: v.animation_windows || {
        vendredi: { ...WIZARD_CONFIG.DEFAULT_ANIMATION_WINDOW },
        samedi: { ...WIZARD_CONFIG.DEFAULT_ANIMATION_WINDOW },
      },
      // 🆕 SESSION 44 — Grille DYNAMIQUE par jour (durée = plage ÷ N exposants attendus)
      animation_grid: (() => {
        const out = {};
        for (const d of WIZARD_CONFIG.DAYS) {
          const win = (v.animation_windows?.[d.key]) || WIZARD_CONFIG.DEFAULT_ANIMATION_WINDOW;
          // N = nombre d'exposants qui seront présents ce jour (animation obligatoire pour tous)
          const expectedCount = regsAtVenue.filter(r => {
            const ad = Array.isArray(r.attending_days) ? r.attending_days : [];
            return r.status !== 'annule' && r.status !== 'cancelled' && (ad.includes(d.key) || ad.includes(d.date));
          }).length;
          const grid = buildAnimationGrid({
            window_start: win.start,
            window_end: win.end,
            expected_count: expectedCount,
          });
          // Marque l'occupation des slots avec les animations déjà sauvegardées
          // 🆕 SESSION 47.13 — Inclut request_status + waitlist count pour permettre la sélection en waitlist
          const occupants = animSlotsAtVenue.filter(a => a.day_label === d.key);
          grid.slots = grid.slots.map(s => {
            // Récupère l'occupant "principal" (priorité validated > pending > legacy)
            const sameSlot = occupants.filter(o => o.start_time === s.start && o.end_time === s.end);
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

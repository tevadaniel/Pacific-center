/**
 * 📅 Configuration centralisée des horaires et créneaux du Forum.
 *
 * Stockée dans la collection MongoDB `event_settings` (document unique avec id='current').
 * Tous les workflows (tunnel exposant, fiche admin, PDF, etc.) lisent ces valeurs.
 *
 * Quand l'admin change un horaire dans /aracom Paramètres, tous les écrans
 * connectés se rafraîchissent automatiquement (cache invalidé via /api/event-settings).
 */

// 🔒 Defaults fallback si la DB n'est pas encore initialisée
export const DEFAULT_EVENT_SETTINGS = {
  id: 'current',
  // Vendredi : 14 août 2026 (par défaut), ouverture 11:00 → fermeture 17:00
  friday_date: '2026-08-14',
  friday_label: 'Vendredi 14 août 2026',
  friday_open: '11:00',
  friday_close: '17:00',
  // Samedi : 15 août 2026 (par défaut), ouverture 09:00 → fermeture 17:00
  saturday_date: '2026-08-15',
  saturday_label: 'Samedi 15 août 2026',
  saturday_open: '09:00',
  saturday_close: '17:00',
  // Durées par défaut
  stand_slot_minutes: 30,
  demo_slot_minutes: 45,
  // Pause déjeuner : créneaux zone démo non générés entre lunch_start et lunch_end
  lunch_start: '12:00',
  lunch_end: '13:00',
  // Pré-accueil exposants (avant ouverture grand public)
  exposant_arrival_friday: '10:00',
  exposant_arrival_saturday: '08:00',
  // 🆕 SESSION 53.21 — Documents complémentaires activés par ARACOM (visibles dans le tunnel exposant)
  //   Par défaut : VIDE — aucun document optionnel proposé.
  //   ARACOM active uniquement ceux dont il a besoin via la page Configuration.
  enabled_optional_docs: [],
};

/**
 * Convertit "HH:MM" → minutes depuis minuit
 */
export function toMinutes(hhmm) {
  if (!hhmm || typeof hhmm !== 'string') return 0;
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * Convertit minutes → "HH:MM"
 */
export function toHHMM(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Génère les créneaux "Sur stand" pour un jour donné.
 * @param {object} settings - event_settings doc
 * @param {'vendredi'|'samedi'} day
 * @returns {Array<{start: string, end: string}>}
 */
export function generateStandSlots(settings, day) {
  const s = settings || DEFAULT_EVENT_SETTINGS;
  const open = day === 'vendredi' ? s.friday_open : s.saturday_open;
  const close = day === 'vendredi' ? s.friday_close : s.saturday_close;
  const step = s.stand_slot_minutes || 30;
  const slots = [];
  let cur = toMinutes(open);
  const end = toMinutes(close);
  while (cur + step <= end) {
    slots.push({ start: toHHMM(cur), end: toHHMM(cur + step) });
    cur += step;
  }
  return slots;
}

/**
 * Génère les créneaux "Zone démo" pour un jour donné.
 * Exclut la pause déjeuner.
 */
export function generateDemoSlots(settings, day) {
  const s = settings || DEFAULT_EVENT_SETTINGS;
  const open = day === 'vendredi' ? s.friday_open : s.saturday_open;
  const close = day === 'vendredi' ? s.friday_close : s.saturday_close;
  const step = s.demo_slot_minutes || 45;
  const lunchStart = toMinutes(s.lunch_start || '12:00');
  const lunchEnd = toMinutes(s.lunch_end || '13:00');
  const slots = [];
  let cur = toMinutes(open);
  const end = toMinutes(close);
  while (cur + step <= end) {
    const slotEnd = cur + step;
    // Skip si le créneau chevauche la pause déjeuner
    const overlapsLunch = cur < lunchEnd && slotEnd > lunchStart;
    if (!overlapsLunch) {
      slots.push({ start: toHHMM(cur), end: toHHMM(cur + step) });
    }
    cur += step;
  }
  return slots;
}

/**
 * Renvoie un résumé lisible pour les PDF / mails
 */
export function formatScheduleSummary(settings) {
  const s = settings || DEFAULT_EVENT_SETTINGS;
  const fmt = (t) => t.replace(':', 'h');
  return {
    friday: `${fmt(s.friday_open)} – ${fmt(s.friday_close)} (accueil exposants dès ${fmt(s.exposant_arrival_friday || '10:00')})`,
    saturday: `${fmt(s.saturday_open)} – ${fmt(s.saturday_close)} (accueil exposants dès ${fmt(s.exposant_arrival_saturday || '08:00')})`,
  };
}

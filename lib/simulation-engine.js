/**
 * 🧪 SESSION 47 — SIMULATION E2E ENGINE
 *
 * Exécute des parcours complets dans le tunnel d'inscription (étapes 1→5)
 * pour des exposants fictifs polynésiens, en tapant les VRAIES API.
 *
 * • Les enregistrements créés portent `is_simulation: true` (préfixe [SIM] sur les noms).
 * • Tous les emails sont redirigés vers `gerosteva@gmail.com` (config mail simulation_active).
 * • Délais aléatoires 0.5–2s entre étapes.
 * • Feed live d'événements + statistiques temps réel.
 * • Pause / reprise / stop en cours d'exécution.
 *
 * Usage côté client :
 *   const engine = new SimulationEngine({
 *     count: 25,
 *     concurrency: 3,
 *     adminHeaders: { 'x-user-role': 'aracom_admin', 'x-user-id': 'u-admin' },
 *     onEvent: (e) => { ... },     // event log entries
 *     onProgress: (p) => { ... },  // counters update
 *     onComplete: (summary) => { ... },
 *   });
 *   await engine.start();
 */

// Pool de noms polynésiens (associations sportives/culturelles/écoles fictives)
const POLY_NAMES = [
  'Te Mana Toa', 'Heiva Junior', 'Tamarii Punaruu', 'Te Fenua Aito',
  'Polynesia Surf School', 'Va\'a O Tahiti', 'Hura Tau', 'Mareva Sports',
  'Te Ari\'i Nui', 'Manuia Dance', 'Tiare Apetahi', 'Faaroa Judo Club',
  'Pirae Karate', 'Punaauia Volleyball', 'Arue Athletisme', 'Taravao Fitness',
  'Mahina Tennis Club', 'Faaa Cycling', 'Papeete Boxe', 'Outumaoro Plongée',
  'Te Vai Ara', 'Heiva i Tahiti Junior', 'Tamariki No Te Ora', 'Manava Arts',
  'Fare Hau', 'Te Aroha Polynesia', 'Hina Voga', 'Mauruuru Yoga',
  'Tamarii Moorea', 'Vaitupa Football', 'Pa\'ea Hapkido', 'Toahotu Sports',
];

const SECTORS = [
  'Sport — Arts martiaux', 'Sport — Sports nautiques', 'Sport — Sports collectifs',
  'Sport — Fitness/Bien-être', 'Culture — Danse', 'Culture — Musique',
  'Culture — Arts plastiques', 'Éducation — Soutien scolaire', 'Éducation — Langues',
  'Services — Restauration', 'Bien-être — Yoga/Méditation',
];

const DISCIPLINES = [
  'Judo', 'Karaté', 'Taekwondo', 'Hapkido', 'Aïkido', 'Boxe',
  'Surf', 'Voile', 'Va\'a (pirogue)', 'Plongée', 'Natation',
  'Football', 'Volley-ball', 'Basket', 'Tennis', 'Athlétisme',
  'Pilates', 'Yoga', 'Zumba', 'Crossfit',
  'Danse polynésienne', 'Danse classique', 'Hip-hop',
  'Piano', 'Guitare', 'Ukulélé', 'Chant',
  'Peinture', 'Sculpture', 'Photographie',
  'Cours de soutien', 'Tahitien', 'Anglais',
];

const VENUE_IDS = ['venue-faaa', 'venue-punaauia', 'venue-arue', 'venue-taravao', 'venue-mahina', 'venue-pirae'];

// Helpers --------------------------------------------------------------------

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const rand = (min, max) => Math.random() * (max - min) + min;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const pickN = (arr, n) => {
  const copy = [...arr];
  const out = [];
  for (let i = 0; i < n && copy.length; i++) {
    const idx = Math.floor(Math.random() * copy.length);
    out.push(copy.splice(idx, 1)[0]);
  }
  return out;
};

function buildScenario(index, sessionId) {
  const name = pick(POLY_NAMES);
  const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  return {
    index,
    label: `SIM-${String(index + 1).padStart(3, '0')}`,
    email: `sim+${sessionId.slice(4, 12)}+${index}+${slug}@simulation.local`,
    name: `[SIM] ${name}`,
    sector: pick(SECTORS),
    discipline: pick(DISCIPLINES),
    contact_name: `Sim Tester ${index + 1}`,
    contact_function: pick(['Président', 'Trésorier', 'Secrétaire', 'Responsable événementiel']),
    main_phone: `87${Math.floor(10000000 + Math.random() * 89999999)}`,
    stand_description: `Animation autour de ${pick(DISCIPLINES).toLowerCase()} pour familles et enfants. [SIMULATION]`,
    venue_id: pick(VENUE_IDS),
    attending_days: Math.random() > 0.3 ? ['vendredi', 'samedi'] : [pick(['vendredi', 'samedi'])],
    representatives_count: 1 + Math.floor(Math.random() * 4),
    // probabilité d'abandon à une étape donnée (réalisme)
    abandon_step: Math.random() < 0.1 ? 1 + Math.floor(Math.random() * 4) : null,
  };
}

// Engine ---------------------------------------------------------------------

export class SimulationEngine {
  constructor(opts = {}) {
    this.count = opts.count || 25;
    this.concurrency = opts.concurrency || 3;
    this.adminHeaders = opts.adminHeaders || {};
    this.onEvent = opts.onEvent || (() => {});
    this.onProgress = opts.onProgress || (() => {});
    this.onComplete = opts.onComplete || (() => {});
    this.sessionId = null;
    this.scenarios = [];
    this.state = 'idle'; // idle | running | paused | stopped | done
    this.startedAt = null;
    this.endedAt = null;
    this.stats = {
      total: 0,
      in_progress: 0,
      success: 0,
      abandoned: 0,
      failed: 0,
      api_calls: 0,
      errors: [],
      by_site: {},
      by_step: { profile: 0, days: 0, stand: 0, animation: 0, finalize: 0 },
    };
    this._pauseResolver = null;
  }

  _emit(event) {
    const e = { timestamp: new Date().toISOString(), ...event };
    this.onEvent(e);
  }

  _updateProgress() {
    this.onProgress({ ...this.stats });
  }

  async _waitIfPaused() {
    if (this.state === 'paused') {
      await new Promise(resolve => { this._pauseResolver = resolve; });
    }
  }

  async _api(path, opts = {}) {
    const t0 = performance.now();
    const headers = {
      'Content-Type': 'application/json',
      'x-simulation': '1',
      'x-sim-session': this.sessionId || '',
      ...this.adminHeaders,
      ...(opts.headers || {}),
    };
    try {
      const r = await fetch(`/api${path}`, { ...opts, headers });
      const elapsed = Math.round(performance.now() - t0);
      this.stats.api_calls++;
      let data = null;
      try { data = await r.json(); } catch { data = null; }
      if (!r.ok) {
        const errMsg = data?.error || `HTTP ${r.status}`;
        this.stats.errors.push({ path, status: r.status, error: errMsg, ts: new Date().toISOString() });
        throw new Error(errMsg);
      }
      return { data, elapsed, status: r.status };
    } catch (e) {
      const elapsed = Math.round(performance.now() - t0);
      throw Object.assign(e, { elapsed });
    }
  }

  pause() {
    if (this.state === 'running') {
      this.state = 'paused';
      this._emit({ type: 'state', message: '⏸ Simulation en pause' });
    }
  }

  resume() {
    if (this.state === 'paused') {
      this.state = 'running';
      this._emit({ type: 'state', message: '▶ Simulation reprise' });
      if (this._pauseResolver) { this._pauseResolver(); this._pauseResolver = null; }
    }
  }

  stop() {
    if (this.state === 'running' || this.state === 'paused') {
      this.state = 'stopped';
      this._emit({ type: 'state', message: '⏹ Simulation arrêtée' });
      if (this._pauseResolver) { this._pauseResolver(); this._pauseResolver = null; }
    }
  }

  async _runOne(scenario) {
    if (this.state === 'stopped') return;
    this.stats.in_progress++;
    this._updateProgress();
    this._emit({ type: 'start', label: scenario.label, name: scenario.name, message: `🚀 Démarrage parcours ${scenario.name}` });

    let regId = null;
    let step = 0;
    try {
      // STEP 0 — Self register
      await this._waitIfPaused();
      const r0 = await this._api('/auth/self-register', { method: 'POST', body: JSON.stringify({ email: scenario.email }) });
      regId = r0.data.registration_id;
      this._emit({ type: 'api', label: scenario.label, step: 'register', path: '/auth/self-register', status: r0.status, elapsed: r0.elapsed, message: `📩 self-register → reg=${regId.slice(0, 12)}…` });

      // Abandon possibly here
      if (scenario.abandon_step === 1) throw new Error('ABANDON_STEP_1');

      // STEP 1 — Profile
      await sleep(rand(500, 2000)); await this._waitIfPaused();
      if (this.state === 'stopped') return;
      step = 1;
      const r1 = await this._api('/wizard/profile', {
        method: 'POST',
        body: JSON.stringify({
          registration_id: regId,
          profile: {
            name: scenario.name,
            discipline: scenario.discipline,
            contact_name: scenario.contact_name,
            contact_function: scenario.contact_function,
            main_email: scenario.email,
            main_phone: scenario.main_phone,
            representatives_count: scenario.representatives_count,
            stand_description: scenario.stand_description,
          },
        }),
      });
      this.stats.by_step.profile++;
      this._emit({ type: 'api', label: scenario.label, step: 'profile', path: '/wizard/profile', status: r1.status, elapsed: r1.elapsed, message: `✏️ Profil enregistré (${scenario.discipline})` });

      if (scenario.abandon_step === 2) throw new Error('ABANDON_STEP_2');

      // STEP 2 — Days + venue
      await sleep(rand(500, 2000)); await this._waitIfPaused();
      if (this.state === 'stopped') return;
      step = 2;
      const dayTimes = {};
      if (scenario.attending_days.includes('vendredi')) dayTimes.vendredi = { start: '08:00', end: '17:00' };
      if (scenario.attending_days.includes('samedi')) dayTimes.samedi = { start: '08:00', end: '17:00' };
      const r2 = await this._api('/wizard/days', {
        method: 'POST',
        body: JSON.stringify({
          registration_id: regId,
          venue_id: scenario.venue_id,
          attending_days: scenario.attending_days,
          attending_day_times: dayTimes,
        }),
      });
      this.stats.by_step.days++;
      this.stats.by_site[scenario.venue_id] = (this.stats.by_site[scenario.venue_id] || 0) + 1;
      this._emit({ type: 'api', label: scenario.label, step: 'days', path: '/wizard/days', status: r2.status, elapsed: r2.elapsed, message: `📅 Site ${scenario.venue_id} + ${scenario.attending_days.join('/')}` });

      if (scenario.abandon_step === 3) throw new Error('ABANDON_STEP_3');

      // STEP 3 — Stand (choisir un stand libre dans la venue)
      await sleep(rand(500, 2000)); await this._waitIfPaused();
      if (this.state === 'stopped') return;
      step = 3;
      // Récupère la liste des stands disponibles
      const standsResp = await this._api(`/venues/${scenario.venue_id}/stands`, { method: 'GET' });
      const stands = standsResp.data?.stands || standsResp.data || [];
      // ✅ Format réel : un stand est libre quand `assignment === null` ET il est actif
      const freeStands = stands.filter(s => (s.assignment == null) && (s.is_active !== false));
      if (!freeStands.length) {
        // Plus aucun stand libre → waitlist
        await this._api('/wizard/waitlist', {
          method: 'POST',
          body: JSON.stringify({ registration_id: regId, venue_id: scenario.venue_id, reason: 'no_stand_available_sim' }),
        }).catch(() => null);
        this._emit({ type: 'waitlist', label: scenario.label, message: `📋 Mis en liste d'attente (${scenario.venue_id} plein)` });
        this.stats.abandoned++;
        this.stats.in_progress--;
        this._updateProgress();
        return;
      }
      const chosenStand = pick(freeStands);
      // Retry-friendly stand booking : si conflit (autre worker a pris le stand), retry avec un autre
      let r3 = null;
      let attempt = 0;
      const triedCodes = new Set();
      while (attempt < 4 && !r3) {
        const candidate = attempt === 0 ? chosenStand : pick(freeStands.filter(s => !triedCodes.has(s.stand_code)));
        if (!candidate) break;
        const code = candidate.code || candidate.stand_code;
        triedCodes.add(code);
        try {
          r3 = await this._api('/wizard/stand', {
            method: 'POST',
            body: JSON.stringify({
              registration_id: regId,
              venue_id: scenario.venue_id,
              stand_code: code,
            }),
          });
          this.stats.by_step.stand++;
          this._emit({ type: 'api', label: scenario.label, step: 'stand', path: '/wizard/stand', status: r3.status, elapsed: r3.elapsed, message: `🎪 Stand ${code} attribué${attempt > 0 ? ` (essai ${attempt + 1})` : ''}` });
        } catch (err) {
          attempt++;
          if (attempt >= 4) throw err;
          this._emit({ type: 'warn', label: scenario.label, message: `↻ Stand ${code} pris, retry…` });
          await sleep(rand(100, 300));
        }
      }
      if (!r3) throw new Error('Aucun stand disponible après 4 essais');

      if (scenario.abandon_step === 4) throw new Error('ABANDON_STEP_4');

      // STEP 4 — Animation (créneau dynamique)
      await sleep(rand(500, 2000)); await this._waitIfPaused();
      if (this.state === 'stopped') return;
      step = 4;
      // Lit la disponibilité pour trouver un créneau libre
      const avail = await this._api('/wizard/availability', { method: 'GET' });
      const venue = (avail.data?.venues || []).find(v => v.id === scenario.venue_id || v.venue_id === scenario.venue_id);
      const dayKey = scenario.attending_days[0] || 'vendredi';
      const grid = venue?.animation_grid?.[dayKey];
      const freeSlot = grid?.slots?.find(s => !s.occupied);
      if (freeSlot) {
        const r4 = await this._api('/wizard/animation', {
          method: 'POST',
          body: JSON.stringify({
            registration_id: regId,
            slots: [{
              day_label: dayKey,
              location_type: 'sur_stand',
              start_time: freeSlot.start,
              end_time: freeSlot.end,
              title: `Démo ${scenario.discipline}`,
              description: `Présentation de ${scenario.discipline} en direct sur le stand. [SIMULATION]`,
              target_audience: 'familles',
              material_needs: 'aucun',
            }],
          }),
        });
        this.stats.by_step.animation++;
        this._emit({ type: 'api', label: scenario.label, step: 'animation', path: '/wizard/animation', status: r4.status, elapsed: r4.elapsed, message: `🎭 Animation ${freeSlot.start}-${freeSlot.end} ${dayKey}` });
      } else {
        this._emit({ type: 'warn', label: scenario.label, message: `⚠ Aucun créneau d'animation libre (${dayKey})` });
      }

      if (scenario.abandon_step === 5) throw new Error('ABANDON_STEP_5');

      // STEP 5 — Finalize
      await sleep(rand(500, 2000)); await this._waitIfPaused();
      if (this.state === 'stopped') return;
      step = 5;
      const r5 = await this._api('/wizard/finalize', {
        method: 'POST',
        body: JSON.stringify({ registration_id: regId, regulation_accepted: true }),
      });
      this.stats.by_step.finalize++;
      this._emit({ type: 'success', label: scenario.label, step: 'finalize', path: '/wizard/finalize', status: r5.status, elapsed: r5.elapsed, message: `✅ Parcours terminé pour ${scenario.name}` });

      this.stats.success++;
    } catch (e) {
      if (String(e.message || '').startsWith('ABANDON_')) {
        this.stats.abandoned++;
        this._emit({ type: 'abandon', label: scenario.label, step, message: `🚪 Abandon à l'étape ${step + 1}` });
      } else if (this.state !== 'stopped') {
        this.stats.failed++;
        this._emit({ type: 'error', label: scenario.label, step, message: `❌ Erreur étape ${step + 1} : ${e.message}` });
      }
    } finally {
      this.stats.in_progress--;
      this._updateProgress();
    }
  }

  async start() {
    if (this.state !== 'idle') return;
    this.state = 'running';
    this.startedAt = new Date().toISOString();
    this._emit({ type: 'state', message: `🚀 Démarrage simulation : ${this.count} exposants` });

    // 1) Active la simulation côté backend (redirection email + flag)
    try {
      const r = await fetch('/api/admin/simulation/begin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...this.adminHeaders },
        body: JSON.stringify({ redirect_email: 'gerosteva@gmail.com' }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Impossible de démarrer la simulation');
      this.sessionId = data.session_id;
      this._emit({ type: 'state', message: `🔧 Session ${this.sessionId} · emails → ${data.redirect_to}` });
    } catch (e) {
      this.state = 'idle';
      this._emit({ type: 'error', message: `❌ Initialisation échouée : ${e.message}` });
      throw e;
    }

    // 2) Génère les scénarios
    this.scenarios = Array.from({ length: this.count }, (_, i) => buildScenario(i, this.sessionId));
    this.stats.total = this.scenarios.length;
    this._updateProgress();

    // 3) Exécute par batches (concurrency)
    const queue = [...this.scenarios];
    const workers = Array.from({ length: this.concurrency }, async () => {
      while (queue.length && this.state !== 'stopped') {
        const sc = queue.shift();
        if (!sc) break;
        await this._runOne(sc);
        await sleep(rand(200, 800));
      }
    });
    await Promise.all(workers);

    // 4) Désactive la simulation côté backend
    if (this.state !== 'stopped') this.state = 'done';
    this.endedAt = new Date().toISOString();
    try {
      await fetch('/api/admin/simulation/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...this.adminHeaders },
        body: '{}',
      });
    } catch {}

    const summary = this.getSummary();
    this._emit({ type: 'state', message: `🏁 Simulation ${this.state === 'stopped' ? 'arrêtée' : 'terminée'} — ${this.stats.success}/${this.stats.total} réussis` });
    this.onComplete(summary);
    return summary;
  }

  getSummary() {
    const duration_s = this.startedAt && this.endedAt
      ? (new Date(this.endedAt) - new Date(this.startedAt)) / 1000
      : 0;
    const conversion_rate = this.stats.total > 0
      ? Math.round((this.stats.success / this.stats.total) * 1000) / 10
      : 0;
    return {
      session_id: this.sessionId,
      state: this.state,
      started_at: this.startedAt,
      ended_at: this.endedAt,
      duration_s,
      conversion_rate,
      stats: { ...this.stats },
    };
  }
}

export const SIMULATION_POOL = { POLY_NAMES, SECTORS, DISCIPLINES, VENUE_IDS };

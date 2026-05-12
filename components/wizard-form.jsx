'use client';
import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast, Toaster } from 'sonner';
import { Check, ChevronRight, ChevronLeft, Lock, Plus, Minus, MapPin, Calendar, Clock, Music, FileText, ShieldCheck, Sparkles, Loader2, AlertCircle, Edit, Download } from 'lucide-react';
import SmartVenueMap from '@/components/smart-venue-map';

const STEPS = [
  { n: 1, key: 'profile', label: 'Profil', icon: '👤' },
  { n: 2, key: 'booking', label: 'Site & Stand', icon: '📍' },
  { n: 3, key: 'animation', label: 'Animation', icon: '🎭' },
  { n: 4, key: 'documents', label: 'Documents & Caution', icon: '📁' },
  { n: 5, key: 'confirm', label: 'Récapitulatif', icon: '🎉' },
];

async function api(path, opts = {}) {
  const r = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    ...opts,
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || r.statusText);
  return d;
}

export default function WizardPage({ registrationId, isPublic = false }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [state, setState] = useState(null);
  const stateRef = useRef(null);
  const [availability, setAvailability] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const lastFetchRef = useRef(0);

  // Sauvegarde locale (localStorage)
  const localKey = `wizard:${registrationId}`;
  const [draft, setDraft] = useState(() => {
    if (typeof window === 'undefined') return {};
    try { return JSON.parse(localStorage.getItem(localKey) || '{}'); } catch { return {}; }
  });
  useEffect(() => {
    try { localStorage.setItem(localKey, JSON.stringify(draft)); } catch {}
  }, [draft, localKey]);

  // Chargement initial + sync
  const loadState = useCallback(async () => {
    if (!registrationId) { setLoading(false); return; }
    try {
      const s = await api(`/wizard/state/${registrationId}`);
      const isFirstLoad = !stateRef.current;
      setState(s);
      stateRef.current = s;
      // Ne fixer currentStep qu'au tout premier chargement (sinon on saute des étapes
      // après chaque save car le current_step backend remonte en même temps que onNext).
      if (isFirstLoad) setCurrentStep(s.current_step || 1);
      // Pré-remplir le draft avec les données DB existantes
      if (!Object.keys(draft).length) {
        setDraft({
          profile: {
            name: s.organization?.name || '',
            discipline: s.organization?.discipline || '',
            contact_name: s.organization?.contact_name || '',
            contact_function: s.organization?.contact_function || '',
            main_email: s.organization?.main_email || '',
            main_phone: s.organization?.main_phone || '',
            representatives_count: s.organization?.representatives_count || 1,
            stand_description: s.organization?.stand_description || '',
          },
          booking: {
            venue_id: s.registration?.venue_id || '',
            stand_code: s.registration?.stand_code || '',
            venue_stand_id: '',
            attending_days: Array.isArray(s.registration?.attending_days) ? s.registration.attending_days : [],
            attending_day_times: s.registration?.attending_day_times || {
              vendredi: { start: '08:00', end: '17:00' },
              samedi: { start: '08:00', end: '17:00' },
            },
          },
          animations: Array.isArray(s.animation_slots) && s.animation_slots.length
            ? s.animation_slots.map(a => ({
                day_label: a.day_label,
                location_type: a.location_type === 'stand' ? 'sur_stand' : (a.location_type || 'sur_stand'),
                slot_type: a.slot_type || '',
                title: a.title || '',
                target_audience: a.target_audience || '',
                material_needs: a.material_needs || '',
                start_time: a.start_time || '',
                end_time: a.end_time || '',
              }))
            : [],
        });
      }
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  }, [registrationId]);

  const loadAvailability = useCallback(async () => {
    try {
      const a = await api(`/wizard/availability`);
      setAvailability(a);
      lastFetchRef.current = Date.now();
    } catch (e) { console.error('availability', e); }
  }, []);

  useEffect(() => { loadState(); loadAvailability(); }, [loadState, loadAvailability]);

  // Polling temps réel des dispos toutes les 8s
  useEffect(() => {
    const id = setInterval(() => { loadAvailability(); }, 8000);
    return () => clearInterval(id);
  }, [loadAvailability]);

  const stepStatus = state?.step_status || {};
  const canAdvanceTo = (step) => {
    if (step === 1) return true;
    if (step === 2) return stepStatus.step1_profile;
    if (step === 3) return stepStatus.step2_booking;
    if (step === 4) return stepStatus.step3_animation;
    if (step === 5) return stepStatus.step4_docs_rdv;
    return false;
  };

  const goNext = () => setCurrentStep(s => Math.min(5, s + 1));
  const goBack = () => setCurrentStep(s => Math.max(1, s - 1));

  if (loading) return <FullScreenLoader />;
  if (!state) return <div className="p-8 text-center text-red-600">Impossible de charger l&apos;inscription.</div>;

  const progressPct = ((currentStep - 1) / 4) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 pb-12">
      <Toaster position="top-right" richColors />
      {/* Header progress */}
      <header className="sticky top-0 z-50 bg-white border-b shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <div className="text-xs text-slate-500 uppercase tracking-wider">Inscription Forum 2026</div>
              <div className="font-bold text-slate-900 text-sm md:text-base">{state.organization?.name || 'Nouvel exposant'}</div>
            </div>
            <div className="text-xs text-slate-500">Étape <b className="text-slate-900 text-base">{currentStep}</b> / 5</div>
          </div>
          {/* Progress bar */}
          <div className="mt-3 relative h-2 bg-slate-200 rounded-full overflow-hidden">
            <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-500" style={{ width: `${progressPct + (currentStep === 5 ? 25 : 0)}%` }} />
          </div>
          {/* Steps nav */}
          <div className="mt-3 grid grid-cols-5 gap-1 md:gap-2">
            {STEPS.map(s => {
              const isDone = currentStep > s.n || (state.step_status[`step${s.n}_${s.key === 'profile' ? 'profile' : s.key === 'booking' ? 'booking' : s.key === 'animation' ? 'animation' : s.key === 'documents' ? 'docs_rdv' : 'confirmed'}`]);
              const isActive = currentStep === s.n;
              const isLocked = !canAdvanceTo(s.n);
              return (
                <button
                  key={s.n}
                  type="button"
                  disabled={isLocked && !isActive}
                  onClick={() => !isLocked && setCurrentStep(s.n)}
                  className={`relative flex flex-col items-center gap-1 py-2 px-1 rounded-lg transition ${
                    isActive ? 'bg-blue-100 text-blue-900' :
                    isDone ? 'bg-emerald-50 text-emerald-700' :
                    isLocked ? 'opacity-50 cursor-not-allowed text-slate-400' : 'hover:bg-slate-50 text-slate-600'
                  }`}
                  data-testid={`wizard-step-${s.n}`}
                >
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${
                    isActive ? 'bg-blue-600 text-white' :
                    isDone ? 'bg-emerald-500 text-white' :
                    'bg-slate-200 text-slate-500'
                  }`}>
                    {isDone && !isActive ? <Check className="w-4 h-4" /> : s.n}
                  </div>
                  <div className="text-[10px] md:text-xs font-medium text-center leading-tight">{s.label}</div>
                  {isLocked && !isActive && <Lock className="w-3 h-3 absolute top-1 right-1 text-slate-400" />}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        {currentStep === 1 && <Step1Profile state={state} draft={draft} setDraft={setDraft} onNext={goNext} reload={loadState} registrationId={registrationId} saving={saving} setSaving={setSaving} />}
        {currentStep === 2 && <Step2Booking state={state} availability={availability} draft={draft} setDraft={setDraft} onNext={goNext} onBack={goBack} reload={loadState} reloadAvailability={loadAvailability} registrationId={registrationId} saving={saving} setSaving={setSaving} />}
        {currentStep === 3 && <Step3Animation state={state} availability={availability} draft={draft} setDraft={setDraft} onNext={goNext} onBack={goBack} reload={loadState} reloadAvailability={loadAvailability} registrationId={registrationId} saving={saving} setSaving={setSaving} />}
        {currentStep === 4 && <Step4Documents state={state} onNext={goNext} onBack={goBack} reload={loadState} registrationId={registrationId} saving={saving} setSaving={setSaving} />}
        {currentStep === 5 && <Step5Confirm state={state} onBack={goBack} reload={loadState} registrationId={registrationId} saving={saving} setSaving={setSaving} onEditStep={(n) => setCurrentStep(n)} />}
      </main>
    </div>
  );
}

function FullScreenLoader() {
  return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;
}

// ─────────────────────────────────────────────────────────
// STEP 1 — Profil
// ─────────────────────────────────────────────────────────
function Step1Profile({ state, draft, setDraft, onNext, reload, registrationId, saving, setSaving }) {
  const p = draft.profile || {};
  const setField = (k, v) => setDraft(d => ({ ...d, profile: { ...d.profile, [k]: v } }));
  const emailValid = !p.main_email || /^[^@]+@[^@]+\.[^@]+$/.test(p.main_email);
  const descLen = (p.stand_description || '').length;

  const submit = async () => {
    setSaving(true);
    try {
      await api('/wizard/profile', { method: 'POST', body: JSON.stringify({ registration_id: registrationId, profile: p }) });
      toast.success('Profil enregistré ✓');
      await reload();
      onNext();
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  return (
    <Card>
      <CardContent className="p-6 space-y-5">
        <SectionHeader icon="👤" title="Profil exposant" desc="Tous les champs marqués (*) sont obligatoires pour passer à l'étape suivante." />
        <Field label="Nom de l'association *" testid="profile-name">
          <Input value={p.name || ''} onChange={e => setField('name', e.target.value)} placeholder="Ex: I Mua Papeete" />
        </Field>
        <Field label="Secteur d'activité *" testid="profile-discipline">
          <Input value={p.discipline || ''} onChange={e => setField('discipline', e.target.value)} placeholder="Ex: Natation" />
        </Field>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Nom du référent *" testid="profile-contact-name">
            <Input value={p.contact_name || ''} onChange={e => setField('contact_name', e.target.value)} placeholder="Prénom NOM" />
          </Field>
          <Field label="Fonction (optionnel)" testid="profile-function">
            <Input value={p.contact_function || ''} onChange={e => setField('contact_function', e.target.value)} placeholder="Ex: Président·e" />
          </Field>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Email * (format vérifié en direct)" error={p.main_email && !emailValid ? 'Email invalide' : null} testid="profile-email">
            <Input type="email" value={p.main_email || ''} onChange={e => setField('main_email', e.target.value)} placeholder="contact@asso.pf" />
          </Field>
          <Field label="Téléphone *" testid="profile-phone">
            <Input value={p.main_phone || ''} onChange={e => setField('main_phone', e.target.value)} placeholder="87 12 34 56" />
          </Field>
        </div>

        <Field label="Représentants sur le stand * (max 2)" testid="profile-reps">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" onClick={() => setField('representatives_count', Math.max(1, (p.representatives_count || 1) - 1))} disabled={(p.representatives_count || 1) <= 1}><Minus className="w-4 h-4" /></Button>
            <div className="text-2xl font-bold w-10 text-center">{p.representatives_count || 1}</div>
            <Button variant="outline" size="icon" onClick={() => setField('representatives_count', Math.min(2, (p.representatives_count || 1) + 1))} disabled={(p.representatives_count || 1) >= 2}><Plus className="w-4 h-4" /></Button>
            <div className="text-xs text-slate-500 ml-2">personne{(p.representatives_count || 1) > 1 ? 's' : ''}</div>
          </div>
        </Field>

        <Field label={`Description courte du stand * (${descLen}/150 caractères)`} error={descLen > 150 ? 'Trop long' : null} testid="profile-desc">
          <Textarea rows={3} value={p.stand_description || ''} onChange={e => setField('stand_description', e.target.value.slice(0, 150))} maxLength={150} placeholder="En une phrase : ce que les visiteurs vont découvrir sur votre stand…" />
        </Field>

        <div className="flex justify-end pt-3 border-t">
          <Button onClick={submit} disabled={saving || !p.name || !p.discipline || !p.contact_name || !emailValid || !p.main_phone || !p.stand_description || descLen > 150} className="gap-2 bg-blue-600 hover:bg-blue-700" data-testid="step1-next">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Continuer <ChevronRight className="w-4 h-4" /></>}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────
// STEP 2 — Site + Stand (carte interactive) + Jours de présence avec horaires
// ─────────────────────────────────────────────────────────
function Step2Booking({ state, availability, draft, setDraft, onNext, onBack, reload, reloadAvailability, registrationId, saving, setSaving }) {
  const b = draft.booking || {};
  const setField = (k, v) => setDraft(d => ({ ...d, booking: { ...d.booking, [k]: v } }));
  const setTime = (day, field, val) => setDraft(d => ({
    ...d,
    booking: {
      ...d.booking,
      attending_day_times: {
        ...(d.booking?.attending_day_times || {}),
        [day]: { ...((d.booking?.attending_day_times || {})[day] || {}), [field]: val },
      },
    },
  }));
  const toggleDay = (day) => {
    const current = Array.isArray(b.attending_days) ? b.attending_days : [];
    const next = current.includes(day) ? current.filter(d => d !== day) : [...current, day];
    setField('attending_days', next);
  };

  const venues = availability?.venues || [];
  const selectedVenue = venues.find(v => v.id === b.venue_id);

  // Charge les stands du site sélectionné
  const [stands, setStands] = useState([]);
  const [loadingStands, setLoadingStands] = useState(false);
  useEffect(() => {
    if (!b.venue_id) { setStands([]); return; }
    let cancelled = false;
    (async () => {
      setLoadingStands(true);
      try {
        const list = await api(`/venues/${b.venue_id}/stands`);
        if (!cancelled) setStands(Array.isArray(list) ? list : []);
      } catch (e) { console.error('stands load', e); }
      finally { if (!cancelled) setLoadingStands(false); }
    })();
    return () => { cancelled = true; };
  }, [b.venue_id]);

  // Stand sélectionné — disponible si pas d'assignation OU si c'est moi
  const isStandAvailable = (s) => {
    if (!s.assignment) return true;
    if (s.assignment.registration_id === registrationId) return true;
    return ['annule', 'cancelled'].includes(s.assignment.status);
  };
  const myStand = stands.find(s => s.stand_code === b.stand_code);

  const onStandClick = (stand) => {
    if (!stand) return;
    if (!isStandAvailable(stand)) {
      toast.error(`Stand ${stand.stand_code} déjà attribué à ${stand.organization?.name || 'un autre exposant'}`);
      return;
    }
    setField('stand_code', stand.stand_code);
    setField('venue_stand_id', stand.id);
    toast.success(`Stand ${stand.stand_code} sélectionné`);
  };

  const submit = async () => {
    if (!b.venue_id) { toast.error('Choisissez un site'); return; }
    if (!b.stand_code) { toast.error('Cliquez sur un stand disponible sur la carte'); return; }
    if (!Array.isArray(b.attending_days) || b.attending_days.length === 0) {
      toast.error('Cochez au moins un jour de présence');
      return;
    }
    for (const d of b.attending_days) {
      const t = b.attending_day_times?.[d];
      if (!t?.start || !t?.end) { toast.error(`Renseignez les horaires pour ${d}`); return; }
      if (t.start >= t.end) { toast.error(`${d} : l'heure de fin doit être après l'heure de début`); return; }
    }
    setSaving(true);
    try {
      await api('/wizard/booking', {
        method: 'POST',
        body: JSON.stringify({
          registration_id: registrationId,
          venue_id: b.venue_id,
          stand_code: b.stand_code,
          venue_stand_id: b.venue_stand_id,
          attending_days: b.attending_days,
          attending_day_times: b.attending_day_times,
        }),
      });
      toast.success('Site, stand et présence enregistrés ✓');
      await reload();
      onNext();
    } catch (e) { toast.error(e.message); reloadAvailability(); }
    finally { setSaving(false); }
  };

  return (
    <Card>
      <CardContent className="p-6 space-y-6">
        <SectionHeader icon="📍" title="Site, stand et jours de présence" desc="Choisissez votre site, votre stand sur la carte interactive, puis cochez vos jours de présence avec les horaires." />

        {/* 1) SITES */}
        <div>
          <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2"><MapPin className="w-4 h-4 text-blue-600" /> 1. Choisir mon site</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {venues.map(v => {
              const isSel = b.venue_id === v.id;
              const totalRem = v.available_per_day?.reduce((a, d) => a + d.remaining, 0) || 0;
              const isFull = totalRem === 0;
              return (
                <button
                  key={v.id}
                  type="button"
                  disabled={isFull && !isSel}
                  onClick={() => {
                    if (b.venue_id !== v.id) {
                      setField('venue_id', v.id);
                      setField('stand_code', '');
                      setField('venue_stand_id', '');
                    }
                  }}
                  className={`relative p-3 rounded-lg border-2 text-left transition ${
                    isSel ? 'border-blue-600 bg-blue-50' :
                    isFull ? 'border-slate-200 bg-slate-50 opacity-50 cursor-not-allowed' :
                    'border-slate-200 hover:border-blue-300 hover:bg-blue-50/30'
                  }`}
                  data-testid={`venue-${v.id}`}
                >
                  <div className="font-bold text-slate-900">{v.name}</div>
                  <div className="text-xs text-slate-500 mt-1">{v.capacity_stands} stands</div>
                  <div className="text-xs mt-1 font-medium">
                    {isFull ? <span className="text-slate-400">Complet</span> : <span className="text-emerald-600">{totalRem} créneaux dispo</span>}
                  </div>
                  {isSel && <div className="absolute top-2 right-2 bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center"><Check className="w-3 h-3" /></div>}
                </button>
              );
            })}
          </div>
        </div>

        {/* 2) STAND sur carte interactive */}
        {selectedVenue && (
          <div>
            <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">🗺️ 2. Choisir mon stand sur le plan</h3>
            <div className="text-xs text-slate-500 mb-3">Cliquez sur un stand libre pour le sélectionner. Les stands grisés sont déjà pris.</div>
            {loadingStands ? (
              <div className="py-8 text-center text-slate-400"><Loader2 className="w-5 h-5 animate-spin inline mr-2" />Chargement du plan…</div>
            ) : stands.length === 0 ? (
              <div className="py-6 text-center text-amber-700 bg-amber-50 rounded-lg border border-amber-200">Le plan de ce site n&apos;est pas encore disponible. Contactez ARACOM.</div>
            ) : (
              <div className="border rounded-lg overflow-hidden bg-slate-50">
                <SmartVenueMap
                  venue={selectedVenue}
                  stands={stands}
                  highlightStandCode={b.stand_code}
                  onStandClick={onStandClick}
                />
              </div>
            )}
            {b.stand_code && (
              <div className="mt-3 bg-emerald-50 border-l-4 border-emerald-500 p-3 rounded-r text-sm font-medium text-emerald-900 flex items-center justify-between">
                <span>✓ Stand sélectionné : <b>{b.stand_code}</b>{myStand?.zone ? ` (zone ${myStand.zone})` : ''}</span>
                <button onClick={() => { setField('stand_code', ''); setField('venue_stand_id', ''); }} className="text-xs text-emerald-700 underline">Changer</button>
              </div>
            )}
          </div>
        )}

        {/* 3) JOURS DE PRÉSENCE + HORAIRES */}
        {selectedVenue && b.stand_code && (
          <div>
            <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2"><Calendar className="w-4 h-4 text-blue-600" /> 3. Mes jours de présence et horaires</h3>
            <div className="text-xs text-slate-500 mb-3">Cochez au moins un jour. Renseignez vos horaires d&apos;ouverture du stand pour chaque jour coché.</div>
            <div className="space-y-3">
              {[
                { key: 'vendredi', label: 'Vendredi 14 août 2026' },
                { key: 'samedi', label: 'Samedi 15 août 2026' },
              ].map(d => {
                const isChecked = Array.isArray(b.attending_days) && b.attending_days.includes(d.key);
                const t = b.attending_day_times?.[d.key] || { start: '08:00', end: '17:00' };
                return (
                  <div key={d.key} className={`p-4 rounded-lg border-2 transition ${isChecked ? 'border-blue-600 bg-blue-50/40' : 'border-slate-200'}`}>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleDay(d.key)}
                        className="w-5 h-5 accent-blue-600"
                        data-testid={`day-check-${d.key}`}
                      />
                      <span className="font-bold text-slate-900">{d.label}</span>
                    </label>
                    {isChecked && (
                      <div className="mt-3 ml-8 grid grid-cols-2 gap-3 max-w-md">
                        <Field label="De" testid={`day-${d.key}-start`}>
                          <Input type="time" value={t.start || '08:00'} onChange={e => setTime(d.key, 'start', e.target.value)} step={900} />
                        </Field>
                        <Field label="À" testid={`day-${d.key}-end`}>
                          <Input type="time" value={t.end || '17:00'} onChange={e => setTime(d.key, 'end', e.target.value)} step={900} />
                        </Field>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex justify-between pt-3 border-t">
          <Button variant="outline" onClick={onBack} className="gap-2"><ChevronLeft className="w-4 h-4" /> Retour</Button>
          <Button
            onClick={submit}
            disabled={saving || !b.venue_id || !b.stand_code || !(b.attending_days?.length > 0)}
            className="gap-2 bg-blue-600 hover:bg-blue-700"
            data-testid="step2-next"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Confirmer & verrouiller <ChevronRight className="w-4 h-4" /></>}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────
// STEP 3 — Animation OBLIGATOIRE (1 par jour de présence, sur stand ou zone démo)
// ─────────────────────────────────────────────────────────
function Step3Animation({ state, availability, draft, setDraft, onNext, onBack, reload, reloadAvailability, registrationId, saving, setSaving }) {
  const config = availability?.config || {};
  const reg = state.registration || {};
  const venueId = reg.venue_id;
  const attendingDays = Array.isArray(reg.attending_days) && reg.attending_days.length > 0
    ? reg.attending_days
    : (Array.isArray(draft.booking?.attending_days) ? draft.booking.attending_days : []);

  // Animations en cours d'édition (un objet par jour de présence)
  const initialAnims = useMemo(() => {
    const existing = Array.isArray(draft.animations) ? draft.animations : [];
    return attendingDays.map(day => {
      const found = existing.find(a => a.day_label === day);
      return found || {
        day_label: day,
        location_type: 'sur_stand',
        slot_type: '',
        title: '',
        target_audience: '',
        material_needs: '',
        start_time: '',
        end_time: '',
      };
    });
  }, [attendingDays, draft.animations]);

  const [anims, setAnims] = useState(initialAnims);
  useEffect(() => { setAnims(initialAnims); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [attendingDays.join(',')]);

  const updateAnim = (day, field, value) => {
    setAnims(prev => {
      const next = prev.map(a => a.day_label === day ? { ...a, [field]: value } : a);
      setDraft(d => ({ ...d, animations: next }));
      return next;
    });
  };

  // Créneaux occupés par d'autres exposants sur ce site / par jour / par lieu
  const venue = (availability?.venues || []).find(v => v.id === venueId);
  const occupiedSlots = (day, location_type) => {
    return (venue?.animation_slots_occupied || []).filter(s =>
      s.day_label === day &&
      s.registration_id !== registrationId &&
      (s.location_type ? s.location_type === location_type : true)
    );
  };

  const submit = async () => {
    if (anims.length === 0) { toast.error('Vous devez avoir au moins une animation'); return; }
    // Valider chaque animation
    for (const a of anims) {
      const errs = [];
      if (!a.location_type) errs.push('lieu');
      if (!a.slot_type) errs.push('type');
      if (!a.title) errs.push('nom');
      if (!a.target_audience) errs.push('public cible');
      if (!a.start_time || !a.end_time) errs.push('horaire');
      if (a.start_time && a.end_time && a.start_time >= a.end_time) errs.push('horaire fin > début');
      if (errs.length) {
        toast.error(`Animation ${a.day_label} : ${errs.join(', ')} manquant`);
        return;
      }
    }
    setSaving(true);
    try {
      await api('/wizard/animation', {
        method: 'POST',
        body: JSON.stringify({ registration_id: registrationId, animations: anims }),
      });
      toast.success(`${anims.length} animation${anims.length > 1 ? 's' : ''} enregistrée${anims.length > 1 ? 's' : ''} ✓`);
      await reload();
      onNext();
    } catch (e) { toast.error(e.message); reloadAvailability(); }
    finally { setSaving(false); }
  };

  if (attendingDays.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r">
            <p className="font-semibold text-amber-900">Veuillez d&apos;abord cocher vos jours de présence à l&apos;étape précédente.</p>
          </div>
          <div className="mt-4">
            <Button variant="outline" onClick={onBack}><ChevronLeft className="w-4 h-4 mr-2" /> Retour étape 2</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-6 space-y-6">
        <SectionHeader
          icon="🎭"
          title="Animations (obligatoire)"
          desc={`Une animation obligatoire par jour de présence (${attendingDays.length} jour${attendingDays.length > 1 ? 's' : ''} coché${attendingDays.length > 1 ? 's' : ''}). Vous pouvez animer sur votre stand ou dans la zone de démonstration.`}
        />

        {anims.map((a, idx) => (
          <AnimationBlock
            key={a.day_label}
            anim={a}
            idx={idx}
            config={config}
            occupied={occupiedSlots(a.day_label, a.location_type)}
            update={(field, value) => updateAnim(a.day_label, field, value)}
          />
        ))}

        <div className="flex justify-between pt-3 border-t">
          <Button variant="outline" onClick={onBack} className="gap-2"><ChevronLeft className="w-4 h-4" /> Retour</Button>
          <Button onClick={submit} disabled={saving} className="gap-2 bg-violet-600 hover:bg-violet-700" data-testid="step3-next">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Confirmer mes animations <ChevronRight className="w-4 h-4" /></>}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function AnimationBlock({ anim, idx, config, occupied, update }) {
  const a = anim;
  const dayLabel = a.day_label === 'samedi' ? 'Samedi 15 août 2026' : 'Vendredi 14 août 2026';
  const typeInfo = (config.ANIMATION_TYPES || []).find(t => t.value === a.slot_type);
  const animSlots = (config.ANIM_SLOTS || []).map(slot => {
    const isOccupied = occupied.some(o => o.start_time < slot.end && o.end_time > slot.start);
    const isSel = a.start_time === slot.start && a.end_time === slot.end;
    return { ...slot, isOccupied, isSel };
  });

  return (
    <div className="border-2 border-violet-200 rounded-lg p-4 bg-violet-50/30 space-y-4">
      <div className="flex items-center gap-3">
        <div className="bg-violet-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold">{idx + 1}</div>
        <div>
          <div className="font-bold text-slate-900">Animation du {dayLabel}</div>
          <div className="text-xs text-slate-600">Champs obligatoires pour finaliser l&apos;inscription.</div>
        </div>
      </div>

      {/* 1) Lieu */}
      <div>
        <Label className="text-sm font-semibold">Lieu de l&apos;animation *</Label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
          {[
            { value: 'sur_stand', label: 'Sur mon stand', desc: 'Démonstration directement sur votre stand' },
            { value: 'zone_demo', label: 'Zone de démonstration', desc: 'Espace dédié partagé (sportifs, scènes, tatamis…)' },
          ].map(loc => {
            const isSel = a.location_type === loc.value;
            return (
              <button
                key={loc.value}
                type="button"
                onClick={() => update('location_type', loc.value)}
                className={`p-3 rounded-lg border-2 text-left transition ${isSel ? 'border-violet-600 bg-violet-100' : 'border-slate-200 hover:border-violet-300 bg-white'}`}
                data-testid={`anim-${a.day_label}-location-${loc.value}`}
              >
                <div className="font-bold text-slate-900">{loc.label}</div>
                <div className="text-xs text-slate-600 mt-1">{loc.desc}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2) Type, titre, public, matériel */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Type d'animation *" testid={`anim-${a.day_label}-type`}>
          <Select value={a.slot_type || ''} onValueChange={v => update('slot_type', v)}>
            <SelectTrigger><SelectValue placeholder="Choisir un type…" /></SelectTrigger>
            <SelectContent>
              {(config.ANIMATION_TYPES || []).map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Public cible *" testid={`anim-${a.day_label}-audience`}>
          <Select value={a.target_audience || ''} onValueChange={v => update('target_audience', v)}>
            <SelectTrigger><SelectValue placeholder="Choisir un public…" /></SelectTrigger>
            <SelectContent>
              {(config.PUBLIC_TARGETS || []).map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
      </div>
      {typeInfo && (
        <div className="bg-violet-50 border-l-4 border-violet-500 p-2 rounded-r text-xs text-violet-900">💡 {typeInfo.description}</div>
      )}

      <Field label="Nom de l'animation *" testid={`anim-${a.day_label}-title`}>
        <Input value={a.title || ''} onChange={e => update('title', e.target.value)} placeholder="Ex : Initiation natation enfants" />
      </Field>
      <Field label="Besoins matériels (optionnel)" testid={`anim-${a.day_label}-material`}>
        <Textarea rows={2} value={a.material_needs || ''} onChange={e => update('material_needs', e.target.value)} placeholder="Ex : 2 tapis, sono, projecteur…" />
      </Field>

      {/* 3) Créneau horaire */}
      <div>
        <Label className="text-sm font-semibold">Créneau horaire * ({dayLabel} · 45 min)</Label>
        <div className="text-xs text-slate-500 my-2">Les créneaux pris par d&apos;autres exposants ({a.location_type === 'sur_stand' ? 'sur stand' : 'zone démo'}) sont grisés.</div>
        <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
          {animSlots.map((s, i) => (
            <button
              key={`${a.day_label}-${s.start}-${i}`}
              type="button"
              disabled={s.isOccupied}
              onClick={() => { update('start_time', s.start); update('end_time', s.end); }}
              className={`p-2 rounded border-2 text-center transition ${
                s.isSel ? 'border-violet-600 bg-violet-600 text-white' :
                s.isOccupied ? 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed' :
                'border-slate-200 hover:border-violet-400 bg-white'
              }`}
              data-testid={`anim-${a.day_label}-slot-${s.start}`}
            >
              <div className="font-mono text-xs font-bold">{s.start}</div>
              <div className="text-[10px]">{s.isOccupied ? 'Pris' : 'Libre'}</div>
            </button>
          ))}
        </div>
        {a.start_time && (
          <div className="mt-3 bg-emerald-50 border-l-4 border-emerald-500 p-2 rounded-r text-sm font-medium text-emerald-900">
            ✓ {a.start_time} → {a.end_time}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// STEP 4 — Documents & Caution
// ─────────────────────────────────────────────────────────
function Step4Documents({ state, onNext, onBack, reload, registrationId, saving, setSaving }) {
  const DOC_TYPES = [
    { key: 'attestation_assurance', label: 'Attestation d\'assurance', required: true },
    { key: 'convention_signee', label: 'Convention signée', required: true },
    { key: 'piece_identite', label: 'Pièce d\'identité du responsable', required: false },
    { key: 'rib', label: 'RIB de l\'association', required: false },
  ];
  const [uploading, setUploading] = useState(null);
  const [rdvForm, setRdvForm] = useState({
    preferred_payment: state.validation_request?.preferred_payment || '',
    rdv_proposal: state.validation_request?.rdv_proposal || '',
    notes: state.validation_request?.notes || '',
  });

  const uploadedTypes = new Set((state.documents || []).map(d => d.document_type));
  const requiredDocs = DOC_TYPES.filter(d => d.required);
  const requiredDocsUploaded = requiredDocs.filter(d => uploadedTypes.has(d.key)).length;
  const docProgress = Math.round((requiredDocsUploaded / requiredDocs.length) * 100);

  const handleUpload = async (docType, file) => {
    if (!file) return;
    setUploading(docType);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('document_type', docType);
      const r = await fetch(`/api/registrations/${registrationId}/documents`, { method: 'POST', body: fd });
      if (!r.ok) throw new Error((await r.json()).error || 'Upload échoué');
      toast.success('Document chargé ✓');
      await reload();
    } catch (e) { toast.error(e.message); }
    finally { setUploading(null); }
  };

  const submitRdv = async () => {
    if (!rdvForm.preferred_payment) { toast.error('Choisissez chèque ou espèces'); return; }
    if (!rdvForm.rdv_proposal) { toast.error('Indiquez vos disponibilités'); return; }
    setSaving(true);
    try {
      await api(`/registrations/${registrationId}/request-validation`, { method: 'POST', body: JSON.stringify(rdvForm) });
      toast.success('Demande de RDV caution envoyée ✓ Vous serez contacté par ARACOM.');
      await reload();
      await api('/wizard/mark-step-4', { method: 'POST', body: JSON.stringify({ registration_id: registrationId }) });
      onNext();
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  return (
    <Card>
      <CardContent className="p-6 space-y-6">
        <SectionHeader icon="📁" title="Documents et caution" desc="Les documents peuvent être uploadés ici ou remis en main propre lors du rendez-vous caution. Choisir un créneau RDV est obligatoire pour continuer." />

        {/* Documents */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-slate-900">Documents administratifs</h3>
            <div className="text-xs text-slate-500">{requiredDocsUploaded}/{requiredDocs.length} obligatoires chargés</div>
          </div>
          <div className="h-2 bg-slate-200 rounded-full mb-3 overflow-hidden">
            <div className="h-full bg-emerald-500 transition-all" style={{ width: `${docProgress}%` }} />
          </div>
          <div className="space-y-2">
            {DOC_TYPES.map(d => {
              const isUploaded = uploadedTypes.has(d.key);
              return (
                <div key={d.key} className={`p-3 rounded-lg border flex items-center justify-between ${isUploaded ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="flex items-center gap-2">
                    {isUploaded ? <Check className="w-4 h-4 text-emerald-600" /> : <FileText className="w-4 h-4 text-slate-400" />}
                    <div>
                      <div className="font-medium text-sm">{d.label}</div>
                      <Badge variant="outline" className={`text-[10px] ${d.required ? 'border-rose-300 text-rose-700' : 'border-slate-300 text-slate-600'}`}>{d.required ? 'Obligatoire' : 'Optionnel'}</Badge>
                    </div>
                  </div>
                  <label className="cursor-pointer">
                    <input type="file" className="hidden" onChange={e => handleUpload(d.key, e.target.files?.[0])} accept=".pdf,.jpg,.jpeg,.png" />
                    <Button asChild variant="outline" size="sm" disabled={uploading === d.key}><span>{uploading === d.key ? 'Envoi…' : isUploaded ? 'Remplacer' : 'Choisir un fichier'}</span></Button>
                  </label>
                </div>
              );
            })}
          </div>
          <div className="text-xs text-slate-500 mt-2">💡 Vous pouvez aussi remettre ces documents en main propre lors du RDV caution.</div>
        </div>

        {/* RDV caution */}
        <div className="border-t pt-5">
          <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2"><Calendar className="w-4 h-4 text-amber-600" /> Rendez-vous caution (obligatoire)</h3>
          {state.validation_request?.rdv_date ? (
            <div className="bg-emerald-50 border-l-4 border-emerald-500 p-4 rounded-r">
              <div className="font-bold text-emerald-900">✓ RDV fixé pour le {new Date(state.validation_request.rdv_date).toLocaleString('fr-FR')}</div>
              <div className="text-sm text-emerald-700 mt-1">📍 {state.validation_request.rdv_location || 'Lieu à confirmer'}</div>
            </div>
          ) : (
            <div className="space-y-3">
              <Field label="Mode de caution préféré *" testid="rdv-payment">
                <Select value={rdvForm.preferred_payment} onValueChange={v => setRdvForm(r => ({ ...r, preferred_payment: v }))}>
                  <SelectTrigger><SelectValue placeholder="Choisir…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cheque">Chèque (à l&apos;ordre d&apos;ARACOM)</SelectItem>
                    <SelectItem value="especes">Espèces</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Vos disponibilités pour le RDV *" testid="rdv-proposal">
                <Textarea rows={2} value={rdvForm.rdv_proposal} onChange={e => setRdvForm(r => ({ ...r, rdv_proposal: e.target.value }))} placeholder="Ex : lundi 16/05 entre 14h et 17h, ou mardi matin…" />
              </Field>
              <Field label="Notes pour ARACOM (optionnel)">
                <Textarea rows={1} value={rdvForm.notes} onChange={e => setRdvForm(r => ({ ...r, notes: e.target.value }))} placeholder="Notes complémentaires…" />
              </Field>
              <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">💡 Lors du RDV, vous pourrez remettre votre caution de <b>20 000 XPF</b> ainsi que vos documents (assurance, convention) si pas déjà uploadés ici.</div>
            </div>
          )}
        </div>

        <div className="flex justify-between pt-3 border-t">
          <Button variant="outline" onClick={onBack} className="gap-2"><ChevronLeft className="w-4 h-4" /> Retour</Button>
          <Button onClick={state.validation_request?.rdv_date ? onNext : submitRdv} disabled={saving} className="gap-2 bg-blue-600 hover:bg-blue-700" data-testid="step4-next">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Continuer <ChevronRight className="w-4 h-4" /></>}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────
// STEP 5 — Récapitulatif et confirmation
// ─────────────────────────────────────────────────────────
function Step5Confirm({ state, onBack, reload, registrationId, saving, setSaving, onEditStep }) {
  const [accepted, setAccepted] = useState(state.registration?.wizard_regulation_accepted || false);
  const [completed, setCompleted] = useState(state.registration?.status === 'confirme');
  const [links, setLinks] = useState({});

  const o = state.organization || {};
  const v = state.venue || {};
  const reg = state.registration || {};
  const attendingDays = Array.isArray(reg.attending_days) ? reg.attending_days : [];
  const dayTimes = reg.attending_day_times || {};
  const dayLabel = (k) => k === 'samedi' ? 'Samedi 15 août 2026' : 'Vendredi 14 août 2026';
  const animations = Array.isArray(state.animation_slots) ? state.animation_slots : [];

  const submit = async () => {
    if (!accepted) { toast.error('Acceptez le règlement exposant pour finaliser'); return; }
    setSaving(true);
    try {
      const r = await api('/wizard/finalize', { method: 'POST', body: JSON.stringify({ registration_id: registrationId, regulation_accepted: true }) });
      toast.success('🎉 Inscription confirmée ! Email envoyé avec votre badge en pièce jointe.');
      setLinks(r.modification_links || {});
      setCompleted(true);
      await reload();
      try { localStorage.removeItem(`wizard:${registrationId}`); } catch {}
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  if (completed) {
    return (
      <Card>
        <CardContent className="p-6 text-center space-y-4">
          <div className="text-6xl">🎉</div>
          <h2 className="text-2xl font-bold text-emerald-700">Inscription confirmée !</h2>
          <p className="text-slate-600">Votre badge exposant a été envoyé par email. Bienvenue au Forum de la Rentrée 2026.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 max-w-2xl mx-auto pt-4">
            <a href={`/api/wizard/badge/${registrationId}`} target="_blank" rel="noopener noreferrer" className="p-3 border rounded-lg bg-amber-50 hover:bg-amber-100 transition flex flex-col items-center gap-1">
              <Download className="w-5 h-5 text-amber-700" />
              <div className="text-xs font-bold text-amber-900">Télécharger mon badge</div>
            </a>
            {links.visit_slot && <a href={links.visit_slot} className="p-3 border rounded-lg bg-blue-50 hover:bg-blue-100 transition flex flex-col items-center gap-1">
              <Calendar className="w-5 h-5 text-blue-700" />
              <div className="text-xs font-bold text-blue-900">Modifier mes jours / horaires</div>
            </a>}
            {links.animation && <a href={links.animation} className="p-3 border rounded-lg bg-violet-50 hover:bg-violet-100 transition flex flex-col items-center gap-1">
              <Music className="w-5 h-5 text-violet-700" />
              <div className="text-xs font-bold text-violet-900">Modifier mon animation</div>
            </a>}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-6 space-y-5">
        <SectionHeader icon="🎉" title="Récapitulatif et confirmation" desc="Vérifiez vos réservations. Les éléments verrouillés sont marqués d'un badge vert." />

        {/* Profil */}
        <RecapBlock title="Profil" icon="👤" onEdit={() => onEditStep(1)}>
          <RecapRow label="Association" value={o.name} />
          <RecapRow label="Secteur" value={o.discipline} />
          <RecapRow label="Référent" value={`${o.contact_name} ${o.contact_function ? `(${o.contact_function})` : ''}`} />
          <RecapRow label="Contact" value={`${o.main_email} · ${o.main_phone}`} />
          <RecapRow label="Représentants" value={`${o.representatives_count || 1} pers.`} />
          <RecapRow label="Description stand" value={o.stand_description} />
        </RecapBlock>

        {/* Lieu */}
        <RecapBlock title="Site, stand et présence" icon="📍" locked onEdit={() => onEditStep(2)}>
          <RecapRow label="Site" value={v.name} locked />
          <RecapRow label="Stand" value={reg.stand_code || '—'} locked />
          <RecapRow label="Jours de présence" value={attendingDays.length ? attendingDays.map(dayLabel).join(' · ') : '—'} locked />
          {attendingDays.map(d => (
            <RecapRow
              key={d}
              label={`Horaires ${d === 'samedi' ? 'samedi' : 'vendredi'}`}
              value={dayTimes[d] ? `${dayTimes[d].start} → ${dayTimes[d].end}` : '—'}
              locked
            />
          ))}
        </RecapBlock>

        {/* Animations */}
        {animations.length > 0 && (
          <RecapBlock title={`Animations (${animations.length})`} icon="🎭" locked onEdit={() => onEditStep(3)}>
            {animations.map((a, idx) => (
              <div key={a.id || idx} className="pb-2 mb-2 border-b last:border-b-0 last:mb-0 last:pb-0">
                <div className="text-xs font-bold text-violet-700 uppercase tracking-wider">{dayLabel(a.day_label)}</div>
                <RecapRow label="Nom" value={a.title} />
                <RecapRow label="Type" value={a.slot_type} />
                <RecapRow label="Lieu" value={a.location_type === 'sur_stand' ? 'Sur stand' : 'Zone de démonstration'} />
                <RecapRow label="Public cible" value={a.target_audience} />
                <RecapRow label="Créneau" value={`${a.start_time} → ${a.end_time}`} locked />
              </div>
            ))}
          </RecapBlock>
        )}

        {/* Documents */}
        <RecapBlock title="Documents et caution" icon="📁" onEdit={() => onEditStep(4)}>
          <RecapRow label="Documents chargés" value={`${state.documents?.length || 0}`} />
          <RecapRow label="RDV caution" value={state.validation_request?.rdv_date ? new Date(state.validation_request.rdv_date).toLocaleString('fr-FR') : 'À fixer par ARACOM'} />
          <RecapRow label="Mode de paiement" value={state.validation_request?.preferred_payment === 'cheque' ? 'Chèque' : 'Espèces'} />
        </RecapBlock>

        {/* Aperçu badge */}
        <div className="border-2 border-dashed border-amber-300 rounded-lg p-4 bg-amber-50/50">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold text-amber-900 flex items-center gap-2">🎖️ Aperçu de votre badge exposant</h3>
            <Badge variant="outline" className="bg-amber-100 border-amber-300 text-amber-900">Sera envoyé par email</Badge>
          </div>
          <div className="bg-white rounded p-3 text-sm">
            <div className="font-bold text-lg">{o.name}</div>
            <div className="text-slate-500">{o.discipline}</div>
            <div className="mt-2 grid grid-cols-3 md:grid-cols-4 gap-2 text-xs">
              <div><span className="text-slate-400">SITE</span><br/><b>{v.name}</b></div>
              <div><span className="text-slate-400">STAND</span><br/><b>{reg.stand_code}</b></div>
              <div><span className="text-slate-400">JOURS</span><br/><b>{attendingDays.length === 2 ? 'Ven + Sam' : attendingDays.includes('samedi') ? 'Sam 15/08' : 'Ven 14/08'}</b></div>
              <div><span className="text-slate-400">ANIMATIONS</span><br/><b>{animations.length}</b></div>
            </div>
          </div>
        </div>

        {/* Acceptation règlement */}
        <div className="border-t pt-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <Checkbox checked={accepted} onCheckedChange={setAccepted} data-testid="accept-regulation" />
            <span className="text-sm text-slate-700">J&apos;accepte le <a href="/reglement-exposant.pdf" target="_blank" className="underline text-blue-600">règlement exposant du Forum de la Rentrée 2026</a> et je m&apos;engage à respecter les conditions de participation (présence aux horaires choisis, attestation d&apos;assurance, caution de 20 000 XPF).</span>
          </label>
        </div>

        <div className="flex justify-between pt-3 border-t">
          <Button variant="outline" onClick={onBack} className="gap-2"><ChevronLeft className="w-4 h-4" /> Retour</Button>
          <Button onClick={submit} disabled={saving || !accepted} size="lg" className="gap-2 bg-emerald-600 hover:bg-emerald-700" data-testid="finalize">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4" /> Confirmer mon inscription</>}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────
// Helpers UI
// ─────────────────────────────────────────────────────────
function SectionHeader({ icon, title, desc }) {
  return (
    <div>
      <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2"><span className="text-2xl">{icon}</span> {title}</h2>
      <p className="text-sm text-slate-500 mt-1">{desc}</p>
    </div>
  );
}
function Field({ label, error, children, testid }) {
  return (
    <div data-testid={testid}>
      <Label className="text-xs uppercase tracking-wider text-slate-600 font-medium">{label}</Label>
      <div className="mt-1">{children}</div>
      {error && <div className="text-xs text-rose-600 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {error}</div>}
    </div>
  );
}
function RecapBlock({ title, icon, locked = false, children, onEdit }) {
  return (
    <div className="border rounded-lg p-4 bg-slate-50/30">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-slate-900 flex items-center gap-2"><span>{icon}</span> {title}{locked && <Badge className="bg-emerald-100 text-emerald-700 border-emerald-300 text-[10px] ml-1"><Lock className="w-3 h-3 mr-1" /> Verrouillé</Badge>}</h3>
        {onEdit && <Button variant="ghost" size="sm" onClick={onEdit} className="text-xs gap-1"><Edit className="w-3 h-3" /> Modifier</Button>}
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}
function RecapRow({ label, value, locked }) {
  return (
    <div className="flex items-start justify-between text-sm gap-3">
      <div className="text-slate-500 text-xs uppercase tracking-wider shrink-0">{label}</div>
      <div className={`text-right font-medium ${locked ? 'text-emerald-700' : 'text-slate-900'}`}>{value || '—'}</div>
    </div>
  );
}

'use client';

/**
 * 🚀 SESSION 52 Phase B — TunnelV2
 *
 * Nouveau tunnel de candidature exposant en 5 blocs (priorité UX absolue : verrouiller le stand le plus vite possible).
 *
 * BLOC 1 — Site(s)             : jusqu'à 3 sites priorisés ▲▼ + compteurs stands libres/waitlist
 * BLOC 2 — Jours de présence   : cases à cocher Ven/Sam (sur le site actif)
 * BLOC 3 — Stand               : CTA unique "X stands libres — Réserver" ou "Rejoindre la liste d'attente (N)"
 * BLOC 4 — Animations          : 1 picker par jour de présence (Sur stand 🔵 OU Zone démo 🟡)
 * BLOC 5 — Documents & Submit  : validation stricte, tooltip listant exactement ce qui manque
 *
 * Props : tout ce qu'il faut pour piloter les 5 blocs et soumettre la candidature active.
 */

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  MapPin, Clock, Calendar, Users, Star, ChevronUp, ChevronDown, Plus, Trash2,
  Check, AlertTriangle, Loader2, Lock, Sparkles, ArrowRight, Info, Send,
  Tent, Sun,
} from 'lucide-react';
import { api } from '@/lib/auth-client';
import StandViewToggle from '@/components/stand-view-toggle';

const DAY_FRI = 'vendredi';
const DAY_SAT = 'samedi';

function dayLabel(d) {
  if (d === DAY_FRI) return 'Vendredi 14 août';
  if (d === DAY_SAT) return 'Samedi 15 août';
  return d;
}

// 🆕 SESSION 53.3 — Conventions de mise à disposition par site (PDF officiel Pacific Centers)
// Disponibles dès que l'exposant a sélectionné un site
const CONVENTION_BY_VENUE = {
  'venue-faaa': '/conventions/venue-faaa.pdf',
  'venue-pun':  '/conventions/venue-pun.pdf',
  'venue-aru':  '/conventions/venue-aru.pdf',
  'venue-tar':  '/conventions/venue-tar.pdf',
};

// =======================================================
// BLOC 1 — Sites priorisés
// =======================================================
function Bloc1Sites({ allSites, activeRegId, availableVenues, allVenues, venuesAvailability, onAddSite, onRemoveSite, onSwapPriority, onSwitchSite, busy }) {
  // Trier par site_priority
  const sorted = [...(allSites || [])].sort((a, b) => (a.site_priority || 99) - (b.site_priority || 99));
  const occupiedIds = new Set(sorted.map((s) => s.venue_id));
  const remaining = (availableVenues || []).filter((v) => !occupiedIds.has(v.id));
  const canAddMore = sorted.length < 3 && remaining.length > 0;
  // 🆕 SESSION 52g.14 — Fallback robuste : si venue.name manquant, recherche dans allVenues puis availableVenues,
  //   sinon affiche le code venue ou les 6 derniers caractères de l'ID pour ne JAMAIS afficher "—"
  const venueNameById = (vid) => {
    if (!vid) return null;
    const fromAll = (allVenues || []).find(v => v.id === vid);
    if (fromAll?.name) return fromAll.name;
    if (fromAll?.code) return fromAll.code;
    const fromAvail = (availableVenues || []).find(v => v.id === vid);
    if (fromAvail?.name) return fromAvail.name;
    if (fromAvail?.code) return fromAvail.code;
    return `Site ${String(vid).slice(-6).toUpperCase()}`;
  };

  const moveUp = (idx) => {
    if (idx <= 0) return;
    onSwapPriority(sorted[idx].id, sorted[idx - 1].id);
  };
  const moveDown = (idx) => {
    if (idx >= sorted.length - 1) return;
    onSwapPriority(sorted[idx].id, sorted[idx + 1].id);
  };

  return (
    <Card data-section="site" className="border-violet-300">
      <CardContent className="p-3 md:p-4">
        <header className="flex items-center gap-2 mb-2">
          <span className="w-7 h-7 rounded-full bg-violet-600 text-white flex items-center justify-center text-xs font-bold">1</span>
          <h3 className="font-bold text-base text-slate-900">Mes sites (jusqu&apos;à 3, par ordre de priorité)</h3>
        </header>
        <div className="rounded-md bg-violet-50 border border-violet-200 px-2.5 py-1.5 mb-2 text-[11px] text-violet-900 flex items-start gap-1.5">
          <Star className="w-3 h-3 mt-0.5 fill-violet-500 text-violet-600 shrink-0" />
          <span><span className="font-semibold">Votre Site 1 est prioritaire.</span> ARACOM traitera vos demandes dans cet ordre. Site 2 et 3 sont optionnels.</span>
        </div>

        {sorted.length === 0 && (
          <div className="text-xs text-slate-500 italic mb-2">Aucun site sélectionné. Ajoutez-en au moins un ci-dessous.</div>
        )}

        <ul className="space-y-1.5">
          {sorted.map((site, idx) => {
            const av = venuesAvailability?.[site.venue_id];
            const free = av?.available_stands ?? 0;
            const isFull = !!av?.capacity_full || free <= 0;
            const wait = av?.waitlist_count ?? 0;
            const isActive = site.id === activeRegId;
            const rank = idx + 1;
            const cantRemove = rank === 1 && sorted.length > 1; // Le Site 1 ne peut être retiré tant qu'il y a un Site 2

            return (
              <li
                key={site.id}
                className={`rounded-lg border p-2.5 flex items-center gap-2 flex-wrap ${
                  isActive ? 'border-aracom-orange bg-aracom-orange/5' : 'border-slate-200 bg-white'
                }`}
              >
                {/* ▲▼ */}
                <div className="flex flex-col gap-0.5 shrink-0">
                  <button
                    onClick={() => moveUp(idx)}
                    disabled={idx === 0 || busy}
                    className="w-6 h-5 rounded border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed text-slate-500 inline-flex items-center justify-center"
                    title="Monter d'un rang"
                  >
                    <ChevronUp className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => moveDown(idx)}
                    disabled={idx === sorted.length - 1 || busy}
                    className="w-6 h-5 rounded border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed text-slate-500 inline-flex items-center justify-center"
                    title="Descendre d'un rang"
                  >
                    <ChevronDown className="w-3 h-3" />
                  </button>
                </div>

                <Badge className={`text-[10px] font-bold shrink-0 ${rank === 1 ? 'bg-amber-500 text-white border-amber-600' : 'bg-slate-200 text-slate-700 border-slate-300'}`}>
                  Site {rank}
                </Badge>

                <button
                  onClick={() => !isActive && onSwitchSite(site.id)}
                  className="flex-1 min-w-0 text-left"
                  disabled={isActive}
                >
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="font-semibold text-sm text-slate-900 truncate">
                      {site.venue?.name || venueNameById(site.venue_id) || (site.venue_id ? `Site ${String(site.venue_id).slice(-6).toUpperCase()}` : '— site à choisir —')}
                    </span>
                    {isActive && <Badge className="text-[9px] bg-aracom-orange text-white border-aracom-orange shrink-0">Site actif</Badge>}
                    {/* 🆕 SESSION 52g.16 — Badge "EN LISTE D'ATTENTE" très visible si l'inscription est en waitlist */}
                    {(site.is_waitlist || site.status === 'liste_attente') && (
                      <Badge className="text-[9px] bg-amber-500 text-white border-amber-600 shrink-0 animate-pulse">
                        🕒 EN LISTE D&apos;ATTENTE
                      </Badge>
                    )}
                  </div>
                  <div className="text-[10.5px] text-slate-500">
                    {isFull ? (
                      <span className="text-amber-700">⏳ <span className="font-semibold">Complet</span> — liste d&apos;attente : {wait} inscrit{wait > 1 ? 's' : ''}</span>
                    ) : (
                      <span className="text-emerald-700"><span className="font-semibold">{free}</span> stand{free > 1 ? 's' : ''} libre{free > 1 ? 's' : ''}</span>
                    )}
                  </div>
                </button>

                {/* 🆕 SESSION 53.3 — Convention de mise à disposition (PDF officiel Pacific Centers) */}
                {CONVENTION_BY_VENUE[site.venue_id] && (
                  <a
                    href={CONVENTION_BY_VENUE[site.venue_id]}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="basis-full inline-flex items-center gap-1 mt-1 text-[10.5px] font-semibold text-aracom-orange hover:text-aracom-orange/80 hover:underline"
                    title="Télécharger la convention de mise à disposition de stand (PDF)"
                  >
                    📜 Télécharger la convention de mise à disposition (PDF)
                  </a>
                )}

                {/* Suppression */}
                {sorted.length > 1 && !cantRemove && (
                  <button
                    onClick={() => onRemoveSite(site.id)}
                    disabled={busy}
                    className="text-[10px] text-slate-400 hover:text-red-600 px-1 shrink-0"
                    title="Retirer ce site"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>

        {/* 🆕 SESSION 53.7 — RULE 6 : "Ajouter un site" désactivé côté exposant.
            Seul ARACOM (cockpit admin) peut ajouter/retirer un site. */}
        {false && canAddMore && (
          <details className="mt-2">
            <summary className="text-xs font-semibold text-aracom-orange cursor-pointer hover:underline inline-flex items-center gap-1">
              <Plus className="w-3 h-3" /> Ajouter un site ({3 - sorted.length} restant{3 - sorted.length > 1 ? 's' : ''})
            </summary>
            <div className="mt-2 grid grid-cols-2 md:grid-cols-3 gap-1.5">
              {remaining.map((v) => {
                const av = venuesAvailability?.[v.id];
                const free = av?.available_stands ?? 0;
                const isFull = !!av?.capacity_full || free <= 0;
                return (
                  <button
                    key={v.id}
                    onClick={() => onAddSite(v.id)}
                    disabled={busy}
                    className="rounded-md border border-slate-200 bg-white hover:bg-aracom-orange/5 hover:border-aracom-orange p-2 text-left transition disabled:opacity-50"
                  >
                    <div className="font-semibold text-xs text-slate-900 flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-slate-400" /> {v.name}
                    </div>
                    <div className={`text-[10px] mt-0.5 ${isFull ? 'text-amber-700' : 'text-emerald-700'}`}>
                      {isFull ? `⏳ Liste d'attente (${av?.waitlist_count || 0})` : `${free} libre${free > 1 ? 's' : ''}`}
                    </div>
                  </button>
                );
              })}
            </div>
          </details>
        )}
        {!canAddMore && sorted.length >= 3 && (
          <div className="mt-2 text-[10px] text-slate-500 italic">Maximum 3 sites atteint.</div>
        )}
      </CardContent>
    </Card>
  );
}

// =======================================================
// BLOC 2 — Jours de présence
// =======================================================
function Bloc2Days({ days, onChangeDays, isLocked, busy }) {
  const set = new Set(days || []);
  const toggle = (d) => {
    const next = new Set(set);
    if (next.has(d)) next.delete(d);
    else next.add(d);
    onChangeDays(Array.from(next).sort());
  };
  return (
    <Card data-section="days" className="border-blue-300">
      <CardContent className="p-3 md:p-4">
        <header className="flex items-center gap-2 mb-2">
          <span className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">2</span>
          <h3 className="font-bold text-base text-slate-900">Mes jours de présence</h3>
        </header>
        <p className="text-[11px] text-blue-900 bg-blue-50 border border-blue-200 px-2.5 py-1.5 rounded-md mb-2 flex items-start gap-1.5">
          <Info className="w-3 h-3 mt-0.5 shrink-0" />
          <span>Vous devrez choisir <span className="font-semibold">1 animation par jour sélectionné</span> au Bloc 4.</span>
        </p>
        <div className="grid grid-cols-2 gap-2">
          {[DAY_FRI, DAY_SAT].map((d) => {
            const checked = set.has(d);
            return (
              <button
                key={d}
                onClick={() => !isLocked && !busy && toggle(d)}
                disabled={isLocked || busy}
                className={`rounded-lg border-2 px-3 py-2.5 text-left transition flex items-center gap-2 ${
                  checked ? 'border-emerald-400 bg-emerald-50/60' : 'border-slate-200 bg-white hover:bg-slate-50'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <span className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${
                  checked ? 'bg-emerald-500 border-emerald-600' : 'bg-white border-slate-300'
                }`}>
                  {checked && <Check className="w-3 h-3 text-white" />}
                </span>
                <span>
                  <div className="font-semibold text-sm text-slate-900">{dayLabel(d)}</div>
                  <div className="text-[10px] text-slate-500">{d === DAY_FRI ? '08:00 – 18:00' : '08:00 – 18:00'}</div>
                </span>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// =======================================================
// BLOC 3 — Stand (sélection libre + plan visuel cliquable)
// 🆕 SESSION 53.5 — RULE 6 révisée : l'exposant CHOISIT/CHANGE son stand
//   tant que ARACOM n'a pas verrouillé. Si pris → bascule waitlist.
// =======================================================
function Bloc3Stand({ registration, venue, venueAvailability, onRefresh, onPickStand, onReleaseStand, onJoinWaitlist, busy }) {
  const r = registration || {};
  const av = venueAvailability || {};
  const hasStand = !!r.stand_code;
  const isWaitlist = !!r.is_waitlist || r.status === 'liste_attente';
  const isLocked = !!r.candidature_locked || !!r.is_locked || r.status === 'confirme';

  const [showPlan, setShowPlan] = useState(false);
  const [stands, setStands] = useState([]);
  const [loadingStands, setLoadingStands] = useState(false);
  const [picking, setPicking] = useState(null); // stand_id en cours de réservation

  const loadStands = async () => {
    if (!venue?.id) return;
    setLoadingStands(true);
    try {
      const data = await api(`/api/venues/${venue.id}/stands`);
      setStands(Array.isArray(data) ? data : []);
    } catch { setStands([]); }
    finally { setLoadingStands(false); }
  };

  // Charge automatiquement les stands à l'ouverture
  useEffect(() => {
    if (showPlan && stands.length === 0) loadStands();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPlan]);

  const pickStand = async (stand, forceWaitlist = false) => {
    if (isLocked) {
      toast.error('🔒 Votre candidature est verrouillée par ARACOM. Contactez-nous.');
      return;
    }
    const isOwn = stand.assignment?.registration_id === r.id;
    if (isOwn) { toast.info('Vous êtes déjà sur ce stand.'); return; }
    const isTaken = stand.assignment && stand.assignment.request_status === 'pending' && !isOwn;
    if (isTaken && !forceWaitlist) {
      const ok = window.confirm(`Le stand ${stand.stand_code} est déjà pré-réservé par un autre exposant.\n\nVoulez-vous vous mettre en LISTE D'ATTENTE sur ce stand (position ${(stand.assignment?.waitlist_position || 0) + 1}/3) ?`);
      if (!ok) return;
      return pickStand(stand, true);
    }
    if (hasStand && r.stand_code !== stand.stand_code) {
      const ok = window.confirm(`Changer votre stand de ${r.stand_code} vers ${stand.stand_code} ?\n\nL'ancien stand sera libéré et un exposant en liste d'attente pourra y être promu automatiquement.`);
      if (!ok) return;
    }
    setPicking(stand.id);
    try {
      const res = await api(`/api/registrations/${r.id}/pre-reserve-stand`, {
        method: 'POST',
        body: JSON.stringify({ stand_id: stand.id, force_waitlist: forceWaitlist }),
      });
      if (res.conflict && res.waitlist_full) {
        toast.error(res.message || 'Liste d\'attente complète sur ce stand');
      } else if (res.conflict && !forceWaitlist) {
        // Should not happen because we handled above, but just in case
        const ok = window.confirm(res.message || 'Conflit. Se mettre en liste d\'attente ?');
        if (ok) return pickStand(stand, true);
      } else if (res.ok) {
        if (res.request_status === 'waitlist') {
          toast.success(`📋 Vous êtes en liste d'attente sur le stand ${stand.stand_code} (position ${res.waitlist_position}/3)`);
        } else {
          toast.success(`✅ Stand ${stand.stand_code} pré-réservé !`);
        }
        setShowPlan(false);
        await onRefreshCb?.();
      }
    } catch (e) {
      toast.error(e.message || 'Erreur de réservation');
    } finally {
      setPicking(null);
    }
  };

  // Groupe les stands par zone (utilisé en mode fallback si StandViewToggle indispo)
  // 🆕 SESSION 53.6 — Remplacé par StandViewToggle (Plan PNG + Grille, sync admin↔exposant).
  //   On garde la variable au cas où mais elle n'est plus utilisée directement.
  // eslint-disable-next-line no-unused-vars
  const standsByZone = useMemo(() => {
    const groups = {};
    for (const s of stands) {
      const z = s.zone || s.zone_name || 'Zone non définie';
      (groups[z] = groups[z] || []).push(s);
    }
    for (const z in groups) groups[z].sort((a, b) => (a.stand_code || '').localeCompare(b.stand_code || '', 'fr', { numeric: true }));
    return groups;
  }, [stands]);

  const onRefreshCb = onRefresh || onPickStand; // refresh callback fallback

  return (
    <Card data-section="stand" className="border-orange-300">
      <CardContent className="p-3 md:p-4">
        <header className="flex items-center gap-2 mb-2 flex-wrap">
          <span className="w-7 h-7 rounded-full bg-orange-600 text-white flex items-center justify-center text-xs font-bold">3</span>
          <h3 className="font-bold text-base text-slate-900">Mon stand</h3>
          {hasStand && !isWaitlist && <Badge className="bg-emerald-600 text-white border-emerald-700 text-[10px]">✓ Pré-réservé</Badge>}
          {isWaitlist && <Badge className="bg-amber-500 text-white border-amber-600 text-[10px]">📋 Liste d&apos;attente</Badge>}
          {isLocked && <Badge className="bg-slate-600 text-white border-slate-700 text-[10px] ml-auto"><Lock className="w-3 h-3 inline mr-0.5" />Verrouillé ARACOM</Badge>}
        </header>

        {/* État courant */}
        {hasStand && !isWaitlist && (
          <div className="rounded-lg border-2 border-emerald-400 bg-emerald-50 p-3 mb-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Lock className="w-4 h-4 text-emerald-700 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-bold text-base text-emerald-900">Stand {r.stand_code} — pré-réservé sur {venue?.name}</div>
                <div className="text-[11px] text-emerald-800">{r.status === 'confirme' ? '✅ Validé par ARACOM' : r.status === 'a_confirmer' ? '⏳ En attente de validation ARACOM' : '🟧 Pré-réservé'}</div>
              </div>
            </div>
          </div>
        )}

        {isWaitlist && (
          <div className="rounded-lg border-2 border-amber-400 bg-amber-50 p-3 mb-2 flex items-center gap-2 flex-wrap">
            <Clock className="w-4 h-4 text-amber-700 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm text-amber-900">En liste d&apos;attente sur {venue?.name || '—'}</div>
              <div className="text-[10.5px] text-amber-800">Vous serez promu automatiquement dès qu&apos;un stand se libère. Vous pouvez aussi essayer de choisir un autre stand ci-dessous.</div>
            </div>
          </div>
        )}

        {!hasStand && !isWaitlist && (
          <div className="rounded-lg border-2 border-blue-300 bg-blue-50 p-3 mb-2 flex items-center gap-2 flex-wrap">
            <MapPin className="w-4 h-4 text-blue-700 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm text-blue-900">Choisissez votre stand sur {venue?.name || 'votre site'}</div>
              <div className="text-[10.5px] text-blue-800">Cliquez sur un stand libre ci-dessous. ARACOM se réserve le droit de réaffecter en fonction des besoins logistiques.</div>
            </div>
          </div>
        )}

        {/* CTA Ouverture du plan des stands */}
        {!isLocked && (
          <Button
            size="sm"
            variant={showPlan ? 'outline' : 'default'}
            onClick={() => setShowPlan(s => !s)}
            className={`gap-1 text-xs h-8 ${showPlan ? 'border-slate-300 text-slate-700' : 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white'}`}
            data-testid="toggle-stand-plan"
          >
            <MapPin className="w-3.5 h-3.5" />
            {showPlan ? 'Fermer le plan' : hasStand ? 'Changer de stand' : 'Voir les stands disponibles'}
          </Button>
        )}

        {/* Plan des stands — utilise StandViewToggle (Plan PNG + Grille, sync admin↔exposant) */}
        {showPlan && !isLocked && (
          <div className="mt-3 border border-slate-200 rounded-lg p-2 bg-slate-50">
            {loadingStands && <div className="text-center py-6 text-xs text-slate-500"><Loader2 className="w-4 h-4 animate-spin inline mr-1" />Chargement des stands…</div>}
            {!loadingStands && stands.length === 0 && <div className="text-center py-6 text-xs text-slate-500">Aucun stand disponible sur ce site.</div>}
            {!loadingStands && stands.length > 0 && (
              <StandViewToggle
                venue={venue}
                stands={stands}
                highlightStandCode={r.stand_code || null}
                onStandClick={(stand) => pickStand(stand)}
                editable={false}
                anonymizeOthers={true}
                serverSyncRole="reader"
                showFilters={false}
                compact={true}
              />
            )}
            <div className="mt-2 text-[10px] text-slate-500 italic">
              ARACOM se réserve le droit de réaffecter votre stand selon les besoins logistiques.
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// =======================================================
// BLOC 4 — Animations par jour (PICKER INLINE + FORMULAIRE DÉTAIL)
// =======================================================
function Bloc4Animations({ registration, venueId, days, attendingDayTimes, slots, onRefresh, busy }) {
  const [openDay, setOpenDay] = useState(null); // 'vendredi' | 'samedi' | null
  const [grid, setGrid] = useState(null);
  const [loadingGrid, setLoadingGrid] = useState(false);
  const [locationType, setLocationType] = useState('sur_stand');
  const [pickedSlot, setPickedSlot] = useState(null); // { start, end } — slot choisi, en attente de détails
  const [form, setForm] = useState({ title: '', description: '', target_audience: 'tous_publics', material_needs: '' });
  const [saving, setSaving] = useState(false);

  const loadGrid = async () => {
    if (!venueId) return;
    setLoadingGrid(true);
    try {
      const data = await api('/api/wizard/availability');
      const list = Array.isArray(data) ? data : Array.isArray(data?.venues) ? data.venues : [];
      const v = list.find(x => x.id === venueId);
      setGrid(v?.animation_grid || null);
    } catch { setGrid(null); }
    finally { setLoadingGrid(false); }
  };

  const resetPicker = () => {
    setOpenDay(null);
    setGrid(null);
    setPickedSlot(null);
    setForm({ title: '', description: '', target_audience: 'tous_publics', material_needs: '' });
  };

  const toMin = (hhmm) => {
    if (!hhmm) return null;
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + (m || 0);
  };

  const availableSlots = useMemo(() => {
    if (!openDay || !grid) return [];
    const dayGrid = grid[openDay];
    if (!dayGrid) return [];
    const baseSlots = locationType === 'zone_demo' ? (dayGrid.slots_demo || []) : (dayGrid.slots_stand || []);
    const expWindow = attendingDayTimes?.[openDay] || null;
    const expStart = toMin(expWindow?.start);
    const expEnd = toMin(expWindow?.end);
    return baseSlots.filter(s => {
      if (expStart != null && expEnd != null) {
        const sStart = toMin(s.start);
        const sEnd = toMin(s.end);
        if (sStart < expStart || sEnd > expEnd) return false;
      }
      return true;
    });
  }, [openDay, grid, locationType, attendingDayTimes]);

  // Étape 2 : valider le formulaire + POST /api/animation-slots
  const submitAnimation = async () => {
    if (!pickedSlot || !openDay || !registration?.id || !venueId) return;
    if (!form.title.trim()) { toast.error('Titre requis'); return; }
    setSaving(true);
    try {
      await api('/api/animation-slots', {
        method: 'POST',
        body: JSON.stringify({
          registration_id: registration.id,
          venue_id: venueId,
          day_label: openDay,
          start_time: pickedSlot.start,
          end_time: pickedSlot.end,
          duration_minutes: locationType === 'zone_demo' ? 45 : 30,
          title: form.title.trim(),
          description: form.description.trim() || null,
          target_audience: form.target_audience,
          slot_type: locationType,
          location_type: locationType,
        }),
      });
      toast.success(`✅ Animation enregistrée — ${dayLabel(openDay)} ${pickedSlot.start}-${pickedSlot.end}`);
      resetPicker();
      onRefresh?.();
    } catch (e) {
      toast.error(`Erreur : ${e.message}`);
    } finally { setSaving(false); }
  };

  const deleteSlot = async (slotId) => {
    if (!slotId) return;
    if (!confirm('Supprimer cette animation ?')) return;
    try {
      await api(`/api/animation-slots/${slotId}`, { method: 'DELETE' });
      toast.success('Animation supprimée');
      onRefresh?.();
    } catch (e) { toast.error(e.message); }
  };

  return (
    <Card data-section="planning" className="border-yellow-300">
      <CardContent className="p-3 md:p-4">
        <header className="flex items-center gap-2 mb-2">
          <span className="w-7 h-7 rounded-full bg-yellow-500 text-white flex items-center justify-center text-xs font-bold">4</span>
          <h3 className="font-bold text-base text-slate-900">Mes animations <span className="text-xs font-normal text-slate-500">(1 créneau réservé par jour de présence)</span></h3>
        </header>

        <div className="rounded-md bg-blue-50 border border-blue-200 px-2.5 py-2 mb-3 text-[11px] text-blue-900 leading-snug flex items-start gap-2">
          <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-blue-700" />
          <div>
            <b>1 créneau réservé suffit par jour</b> — il sera publié dans le programme officiel ARACOM.
            Vous restez <b>libre d&apos;animer votre propre stand</b> autant que vous le souhaitez en dehors de ce créneau,
            sans réservation supplémentaire.
          </div>
        </div>

        {(!days || days.length === 0) && (
          <div className="rounded-md border-2 border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-center text-[11px] text-slate-500 italic">
            Sélectionnez d&apos;abord vos jours de présence au Bloc 2. <b>Pas de jour → pas d&apos;animation.</b>
          </div>
        )}

        {days?.length > 0 && (
          <div className="space-y-2">
            {days.map((d) => {
              const daySlots = (slots || []).filter((s) => s.day_label === d);
              const hasAny = daySlots.length > 0;
              const isOpen = openDay === d;
              const expWindow = attendingDayTimes?.[d];
              return (
                <div
                  key={d}
                  className={`rounded-lg border-2 ${hasAny ? 'border-emerald-300 bg-emerald-50/40' : (isOpen ? 'border-yellow-400 bg-yellow-50/50' : 'border-red-300 bg-red-50/40')}`}
                >
                  <div className="p-2.5">
                    <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
                      <div className="font-semibold text-sm text-slate-900 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" /> {dayLabel(d)}
                        {expWindow?.start && expWindow?.end && (
                          <span className="text-[10px] text-slate-500 font-normal">
                            (vos horaires : {expWindow.start}–{expWindow.end})
                          </span>
                        )}
                      </div>
                      {!hasAny && !isOpen && (
                        <Badge className="bg-red-500 text-white border-red-600 text-[9px]">⚠ Aucune animation</Badge>
                      )}
                      {hasAny && (
                        <Badge className="bg-emerald-600 text-white border-emerald-700 text-[9px]">✓ {daySlots.length} créneau{daySlots.length > 1 ? 'x' : ''}</Badge>
                      )}
                    </div>

                    {/* Liste des animations existantes */}
                    {hasAny && (
                      <ul className="space-y-1 mb-2">
                        {daySlots.map((s) => (
                          <li key={s.id} className="rounded border border-slate-200 bg-white px-2 py-1.5 text-[11px]">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                                {(s.location_type === 'zone_demo' || s.slot_type === 'zone_demo') ? (
                                  <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300 text-[9px] shrink-0">🟡 Zone démo</Badge>
                                ) : (
                                  <Badge className="bg-blue-100 text-blue-800 border-blue-300 text-[9px] shrink-0">🔵 Sur stand</Badge>
                                )}
                                <span className="text-slate-700 font-semibold">
                                  {s.start_time}–{s.end_time}
                                </span>
                                {s.title && <span className="text-slate-900 truncate">· {s.title}</span>}
                                <span className="text-emerald-600 font-bold">✅</span>
                              </div>
                              <button
                                onClick={() => deleteSlot(s.id)}
                                disabled={busy || saving}
                                className="text-[10px] text-slate-400 hover:text-red-600 shrink-0"
                                title="Supprimer cette animation"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                            {s.description && (
                              <div className="text-[10px] text-slate-500 mt-0.5 line-clamp-2">{s.description}</div>
                            )}
                            {s.material_needs && (
                              <div className="text-[10px] text-amber-700 mt-0.5 flex items-start gap-1">
                                <span className="font-semibold shrink-0">🛠 Matériel :</span>
                                <span className="line-clamp-2">{s.material_needs}</span>
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}

                    {/* 🆕 SESSION 52g.10 — Si déjà 1 anim pour ce jour, on bloque l'ajout d'un 2ème
                        créneau sur la plateforme. Note : libre d'animer son stand autant qu'il veut. */}
                    {hasAny && !isOpen && (
                      <div className="rounded-md bg-emerald-50 border border-emerald-200 px-2 py-1.5 text-[10px] text-emerald-800 leading-snug flex items-start gap-1.5">
                        <Info className="w-3 h-3 mt-0.5 shrink-0 text-emerald-700" />
                        <div>
                          <b>1 créneau réservé suffit</b> pour ce jour. Animez librement votre stand
                          autant que vous voulez en dehors de ce créneau, sans réservation.
                        </div>
                      </div>
                    )}
                    {!hasAny && !isOpen && (
                      <button
                        onClick={() => { setOpenDay(d); if (!grid && !loadingGrid) loadGrid(); }}
                        disabled={busy || !venueId}
                        className="w-full rounded-md border-2 px-2 py-1.5 text-xs font-semibold transition flex items-center justify-center gap-1.5 border-red-400 bg-white hover:bg-red-50 text-red-700 disabled:opacity-50"
                        title={!venueId ? 'Choisissez un site d\'abord' : 'Ouvrir le sélecteur'}
                      >
                        <Plus className="w-3 h-3" /> Choisir un créneau pour {dayLabel(d)}
                      </button>
                    )}
                  </div>

                  {/* PICKER + FORMULAIRE INLINE */}
                  {isOpen && (
                    <div className="border-t-2 border-yellow-300 bg-white p-3 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-xs font-semibold text-slate-700">
                          {pickedSlot
                            ? <>Détails de l&apos;animation <b>{dayLabel(d)} · {pickedSlot.start}–{pickedSlot.end}</b></>
                            : <>Choisir un créneau pour <b>{dayLabel(d)}</b></>
                          }
                        </div>
                        <button onClick={resetPicker} className="text-[10px] text-slate-500 hover:text-slate-900 underline">Annuler</button>
                      </div>

                      {/* ÉTAPE 1 : Choisir lieu + créneau */}
                      {!pickedSlot && (
                        <>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setLocationType('sur_stand')}
                              className={`flex-1 rounded-md border-2 px-2.5 py-2 text-[11px] font-semibold transition ${
                                locationType === 'sur_stand'
                                  ? 'border-blue-500 bg-blue-50 text-blue-900'
                                  : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300'
                              }`}
                            >
                              🔵 Sur mon stand
                              <div className="text-[9px] font-normal opacity-70 mt-0.5">Animation à côté de votre stand · 30 min</div>
                            </button>
                            <button
                              onClick={() => setLocationType('zone_demo')}
                              className={`flex-1 rounded-md border-2 px-2.5 py-2 text-[11px] font-semibold transition ${
                                locationType === 'zone_demo'
                                  ? 'border-yellow-500 bg-yellow-50 text-yellow-900'
                                  : 'border-slate-200 bg-white text-slate-600 hover:border-yellow-300'
                              }`}
                            >
                              🟡 Zone démo (scène)
                              <div className="text-[9px] font-normal opacity-70 mt-0.5">Espace public dédié · 45 min</div>
                            </button>
                          </div>

                          {loadingGrid && (
                            <div className="text-center text-xs text-slate-500 py-4">
                              <Loader2 className="w-4 h-4 animate-spin inline-block mr-1.5" /> Chargement des créneaux…
                            </div>
                          )}
                          {!loadingGrid && grid && (
                            <>
                              {availableSlots.length === 0 ? (
                                <div className="text-center text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md py-3 px-2">
                                  ⚠ Aucun créneau {locationType === 'zone_demo' ? 'en zone démo' : 'sur stand'} disponible
                                  {expWindow ? ` dans votre plage horaire (${expWindow.start}–${expWindow.end})` : ''}
                                  {locationType === 'zone_demo' ? '. Essayez "Sur mon stand".' : '.'}
                                </div>
                              ) : (
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
                                  {availableSlots.map((s) => {
                                    const isOccupied = !!s.occupied || (locationType === 'zone_demo' && s.occupants?.length > 0);
                                    return (
                                      <button
                                        key={`${s.start}-${s.end}`}
                                        onClick={() => !isOccupied && setPickedSlot({ start: s.start, end: s.end })}
                                        disabled={isOccupied}
                                        className={`rounded-md border-2 px-2 py-1.5 text-[11px] font-semibold transition ${
                                          isOccupied
                                            ? 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed line-through'
                                            : locationType === 'zone_demo'
                                              ? 'border-yellow-300 bg-yellow-50 hover:bg-yellow-100 hover:border-yellow-500 text-yellow-900'
                                              : 'border-blue-300 bg-blue-50 hover:bg-blue-100 hover:border-blue-500 text-blue-900'
                                        }`}
                                        title={isOccupied ? 'Créneau déjà pris' : 'Cliquer pour choisir ce créneau'}
                                      >
                                        {s.start}–{s.end}
                                        {isOccupied && <div className="text-[8px] font-normal opacity-70">pris</div>}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </>
                          )}
                        </>
                      )}

                      {/* ÉTAPE 2 : Saisir titre + description */}
                      {pickedSlot && (
                        <div className="space-y-2.5">
                          <div className="flex items-center gap-2 text-[11px]">
                            {locationType === 'zone_demo' ? (
                              <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300 text-[9px]">🟡 Zone démo</Badge>
                            ) : (
                              <Badge className="bg-blue-100 text-blue-800 border-blue-300 text-[9px]">🔵 Sur stand</Badge>
                            )}
                            <span className="text-slate-700 font-semibold">{pickedSlot.start}–{pickedSlot.end}</span>
                            <button onClick={() => setPickedSlot(null)} className="text-[10px] text-slate-500 hover:text-slate-900 underline ml-auto">← changer le créneau</button>
                          </div>

                          <div>
                            <label className="text-[11px] font-semibold text-slate-700 block mb-1">Titre de l&apos;animation *</label>
                            <input
                              type="text"
                              value={form.title}
                              onChange={(e) => setForm({ ...form, title: e.target.value })}
                              placeholder="Ex : Démonstration de Va'a, atelier judo, concert…"
                              maxLength={120}
                              autoFocus
                              className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-xs focus:border-aracom-orange focus:outline-none focus:ring-1 focus:ring-aracom-orange"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] font-semibold text-slate-700 block mb-1">Description (optionnelle)</label>
                            <textarea
                              rows={3}
                              value={form.description}
                              onChange={(e) => setForm({ ...form, description: e.target.value })}
                              placeholder="Décrivez votre animation : besoin matériel, déroulé, public ciblé…"
                              maxLength={400}
                              className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-xs focus:border-aracom-orange focus:outline-none focus:ring-1 focus:ring-aracom-orange resize-none"
                            />
                            <div className="text-[9px] text-slate-400 text-right mt-0.5">{form.description.length}/400</div>
                          </div>
                          <div>
                            <label className="text-[11px] font-semibold text-slate-700 block mb-1">Public ciblé</label>
                            <div className="flex gap-1.5 flex-wrap">
                              {[
                                { v: 'tous_publics', l: '👨‍👩‍👧 Tous publics' },
                                { v: 'enfants', l: '🧒 Enfants' },
                                { v: 'adolescents', l: '🧑 Adolescents' },
                                { v: 'adultes', l: '👤 Adultes' },
                                { v: 'familles', l: '👪 Familles' },
                              ].map(opt => (
                                <button
                                  key={opt.v}
                                  onClick={() => setForm({ ...form, target_audience: opt.v })}
                                  className={`rounded-full border px-2.5 py-0.5 text-[10px] transition ${
                                    form.target_audience === opt.v
                                      ? 'border-aracom-orange bg-aracom-orange/10 text-aracom-orange font-semibold'
                                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                                  }`}
                                >
                                  {opt.l}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div>
                            <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                              Matériel utilisé <span className="font-normal text-slate-400">(si nécessaire)</span>
                            </label>
                            <textarea
                              rows={2}
                              value={form.material_needs}
                              onChange={(e) => setForm({ ...form, material_needs: e.target.value })}
                              placeholder="Ex: 2 tables, 1 sono avec micro, 1 écran projection, accès électrique 220V, tapis de sol…"
                              maxLength={400}
                              className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-xs focus:border-aracom-orange focus:outline-none focus:ring-1 focus:ring-aracom-orange resize-none"
                            />
                            <div className="text-[9px] text-slate-400 text-right mt-0.5">{form.material_needs.length}/400</div>
                          </div>

                          <div className="flex justify-end gap-2 pt-1">
                            <Button variant="ghost" size="sm" onClick={resetPicker} disabled={saving} className="h-7 text-xs">
                              Annuler
                            </Button>
                            <Button
                              size="sm"
                              onClick={submitAnimation}
                              disabled={saving || !form.title.trim()}
                              className={`h-7 text-xs gap-1 ${locationType === 'zone_demo' ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                            >
                              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                              Enregistrer l&apos;animation
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// =======================================================
// BLOC 5 — Documents + Soumission stricte
// =======================================================
function Bloc5Submit({ checks, missingList, canSubmit, isSubmitted, isLocked, isSubmitting, onSubmit }) {
  const docs = (checks || []).filter((c) => c.kind === 'doc');

  return (
    <Card data-section="submit" className="border-emerald-300">
      <CardContent className="p-3 md:p-4">
        <header className="flex items-center gap-2 mb-2">
          <span className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold">5</span>
          <h3 className="font-bold text-base text-slate-900">Documents & Soumission</h3>
        </header>

        {/* Liste documents requis */}
        <div className="space-y-1 mb-3">
          {docs.map((d) => (
            <div
              key={d.label}
              className={`rounded-md border px-2 py-1.5 text-xs flex items-center justify-between gap-2 ${
                d.ok ? 'border-emerald-200 bg-emerald-50/60 text-emerald-900' : 'border-amber-200 bg-amber-50/60 text-amber-900'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <span>{d.ok ? '✅' : '⚠️'}</span>
                <span>{d.label}</span>
              </span>
              {!d.ok && <Badge className="bg-amber-500 text-white border-amber-600 text-[9px]">À fournir</Badge>}
            </div>
          ))}
        </div>

        {/* Bouton soumettre — 🆕 SESSION 53.7 RULE 6 : Toujours TRÈS VISIBLE et coloré
            même quand incomplet. Clic sur bouton incomplet → toast listant ce qui manque.
            Tant qu'ARACOM n'a pas verrouillé, l'exposant peut re-soumettre autant qu'il veut. */}
        {isSubmitted && !isLocked && (
          <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900 mb-2">
            ⏳ Candidature soumise à ARACOM (vous pouvez la modifier et la <b>re-soumettre</b> tant qu&apos;elle n&apos;est pas validée).
          </div>
        )}
        {isLocked && (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900 mb-2">
            🔒 Candidature validée par ARACOM. Vos modifications sont verrouillées (les documents restent uploadables).
          </div>
        )}

        <div className="relative group">
          <Button
            size="lg"
            onClick={() => {
              if (isLocked) return;
              if (!canSubmit) {
                // Toast avec liste explicite de ce qui manque
                toast.error(`⚠️ Il vous reste à compléter avant de ${isSubmitted ? 're-soumettre' : 'soumettre'} :\n• ${missingList.join('\n• ')}`, { duration: 6000 });
                // Scroll vers la 1re étape manquante (mapping kind → data-section)
                const firstMissing = checks.find(c => !c.ok);
                if (firstMissing?.kind) {
                  const KIND_MAP = { 'anim': 'planning', 'doc': 'submit' };
                  const sectionKey = KIND_MAP[firstMissing.kind] || firstMissing.kind;
                  const el = document.querySelector(`[data-section="${sectionKey}"]`);
                  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
                return;
              }
              onSubmit();
            }}
            disabled={isSubmitting || isLocked}
            className={`w-full h-12 text-sm font-bold gap-2 transition-all ${
              isLocked
                ? 'bg-emerald-600/80 text-white cursor-not-allowed'
                : canSubmit
                  ? (isSubmitted
                      ? 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white shadow-lg ring-2 ring-blue-300/40 animate-pulse'
                      : 'bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white shadow-lg ring-2 ring-emerald-300/40')
                  : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-md opacity-90'
            }`}
            title={!canSubmit && missingList?.length ? `Cliquez pour voir ce qui manque` : ''}
            data-testid="submit-candidature-btn"
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : (isLocked ? <Lock className="w-4 h-4" /> : <Send className="w-4 h-4" />)}
            {isLocked
              ? 'Candidature validée par ARACOM'
              : (isSubmitted
                  ? (canSubmit ? '✅ Re-soumettre ma candidature (écrase la précédente)' : `⚠️ Compléter avant re-soumission (${missingList.length} élément${missingList.length > 1 ? 's' : ''})`)
                  : (canSubmit ? '🚀 Soumettre ma candidature à ARACOM' : `⚠️ Cliquez pour voir ce qui manque (${missingList.length} élément${missingList.length > 1 ? 's' : ''})`))}
          </Button>

          {/* Liste détaillée des éléments manquants */}
          {!canSubmit && missingList?.length > 0 && (
            <div className="mt-2 rounded-md border-2 border-amber-300 bg-amber-50/80 px-3 py-2">
              <div className="text-[11px] font-bold text-amber-900 mb-1 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Il vous reste à compléter :
              </div>
              <ul className="space-y-0.5">
                {missingList.map((m, i) => (
                  <li key={i} className="text-[11px] text-amber-900 flex items-center gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-amber-700" /> {m}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {canSubmit && !isSubmitted && (
            <div className="mt-2 rounded-md border-2 border-emerald-300 bg-emerald-50/60 px-3 py-2 text-[11px] text-emerald-900 flex items-center gap-1.5">
              <Sparkles className="w-3 h-3" /> <span className="font-semibold">Tout est prêt !</span> Vous pouvez soumettre votre candidature.
            </div>
          )}
          {canSubmit && isSubmitted && !isLocked && (
            <div className="mt-2 rounded-md border-2 border-blue-300 bg-blue-50/60 px-3 py-2 text-[11px] text-blue-900 flex items-center gap-1.5">
              <Sparkles className="w-3 h-3" /> <span className="font-semibold">Modifications détectées</span> — cliquez pour re-soumettre (écrase la précédente demande).
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// =======================================================
// COMPOSANT PRINCIPAL TunnelV2
// =======================================================
export default function TunnelV2({
  registration,
  organization,
  venue,
  slots = [],
  docs = [],
  deposit = null,
  allSites = [],
  availableVenues = [],
  allVenues = [],
  venuesAvailability = {},
  validationRequest = null,
  isLocked = false,
  onRefresh,
  onSwitchSite,
  onOpenStandPicker,
  onOpenAnimationPicker,
}) {
  const [busy, setBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const r = registration || {};
  const days = Array.isArray(r.attending_days) ? r.attending_days : [];
  const venueAvailability = venuesAvailability?.[r.venue_id] || {};
  const isSubmitted = !!validationRequest && ['pending', 'submitted', 'a_valider'].includes(validationRequest.status);

  // =====================================================
  // HANDLERS BLOC 1
  // =====================================================
  const addSite = async (venueId) => {
    setBusy(true);
    try {
      // 🆕 SESSION 52g.17 — Inclut organization_id (sinon backend rejette "organization_id et venue_id requis")
      const res = await api('/api/exposant/sites/add', {
        method: 'POST',
        body: JSON.stringify({ organization_id: organization?.id, venue_id: venueId }),
      });
      if (res?.is_waitlist) {
        toast.success('🕒 Site complet — vous êtes en liste d\'attente automatiquement');
      } else {
        toast.success('✅ Site ajouté');
      }
      // Bascule sur la registration mise à jour ou nouvellement créée
      const newRegId = res?.registration?.id;
      if (newRegId && typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        url.searchParams.set('reg', newRegId);
        window.history.replaceState({}, '', url);
      }
      onRefresh?.();
      // Scroll vers Bloc 1 avec halo
      setTimeout(() => {
        const target = document.querySelector('[data-section="site"]');
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
          target.classList.add('ring-2', 'ring-aracom-orange', 'ring-offset-2');
          setTimeout(() => target.classList.remove('ring-2', 'ring-aracom-orange', 'ring-offset-2'), 1800);
        }
      }, 350);
    } catch (e) { toast.error(`❌ ${e.message}`); }
    finally { setBusy(false); }
  };
  const removeSite = async (regId) => {
    if (!confirm('Retirer ce site ? Cette action libère le stand éventuel.')) return;
    setBusy(true);
    try {
      await api(`/api/exposant/sites/${regId}/remove`, { method: 'POST', body: '{}' });
      toast.success('Site retiré');
      onRefresh?.();
    } catch (e) { toast.error(e.message); }
    finally { setBusy(false); }
  };
  const swapPriority = async (idA, idB) => {
    setBusy(true);
    try {
      const sites = allSites.sort((a, b) => (a.site_priority || 99) - (b.site_priority || 99));
      const a = sites.find((s) => s.id === idA);
      const b = sites.find((s) => s.id === idB);
      if (!a || !b) return;
      const pA = a.site_priority || 99;
      const pB = b.site_priority || 99;
      // Swap
      await api(`/api/exposant/sites/${a.id}/priority`, { method: 'POST', body: JSON.stringify({ priority: pB }) });
      await api(`/api/exposant/sites/${b.id}/priority`, { method: 'POST', body: JSON.stringify({ priority: pA }) });
      toast.success('🔁 Ordre mis à jour');
      onRefresh?.();
    } catch (e) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  // =====================================================
  // HANDLERS BLOC 2 — Days
  // =====================================================
  const changeDays = async (newDays) => {
    setBusy(true);
    try {
      await api(`/api/registrations/${r.id}/set-attending-days`, { method: 'POST', body: JSON.stringify({ attending_days: newDays }) });
      toast.success('✅ Jours mis à jour');
      onRefresh?.();
    } catch (e) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  // =====================================================
  // HANDLERS BLOC 3 — Stand
  // =====================================================
  const releaseStand = async () => {
    if (!confirm('Libérer le stand ' + r.stand_code + ' ? Vous le perdrez.')) return;
    setBusy(true);
    try {
      await api(`/api/registrations/${r.id}/release-stand`, { method: 'POST', body: JSON.stringify({}) });
      toast.success('Stand libéré');
      onRefresh?.();
    } catch (e) { toast.error(e.message); }
    finally { setBusy(false); }
  };
  const joinWaitlist = async () => {
    setBusy(true);
    try {
      await api('/api/wizard/waitlist', {
        method: 'POST',
        body: JSON.stringify({ registration_id: r.id, venue_id: r.venue_id, note: `Inscription site-level — ${venue?.name} complet` }),
      });
      toast.success('⏳ Inscrit en liste d\'attente');
      onRefresh?.();
    } catch (e) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  // =====================================================
  // HANDLERS BLOC 4 — Animations
  // =====================================================
  const deleteSlot = async (slotId) => {
    if (!confirm('Supprimer cette animation ?')) return;
    setBusy(true);
    try {
      await api(`/api/animation-slots/${slotId}`, { method: 'DELETE' });
      toast.success('Animation supprimée');
      onRefresh?.();
    } catch (e) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  // =====================================================
  // BLOC 5 — Checks de complétude + soumission
  // =====================================================
  const animVen = (slots || []).filter((s) => s.day_label === DAY_FRI);
  const animSam = (slots || []).filter((s) => s.day_label === DAY_SAT);

  const checks = useMemo(() => {
    const list = [];
    // 🆕 SESSION 52g.9 — Si l'exposant est en LISTE D'ATTENTE pour ce site, on adapte les checks.
    //   Un stand ne peut pas être attribué tant qu'il n'est pas promu → on accepte "Inscrit en liste d'attente".
    const isWaitlist = !!r.is_waitlist || r.status === 'liste_attente';
    // Bloc 1 — Site
    list.push({ kind: 'site', ok: !!r.venue_id, label: 'Site choisi' });
    // Bloc 2 — Jours
    list.push({ kind: 'days', ok: days.length > 0, label: 'Jours de présence' });
    // Bloc 3 — Stand OU Liste d'attente
    if (isWaitlist) {
      list.push({ kind: 'stand', ok: true, label: '⏳ Inscrit en liste d\'attente', isInfo: true });
    } else {
      list.push({ kind: 'stand', ok: !!r.stand_code, label: 'Stand réservé' });
    }
    // Bloc 4 — Animations par jour (toujours requis : ce sont les souhaits, même en waitlist)
    if (days.includes(DAY_FRI)) list.push({ kind: 'anim', ok: animVen.length >= 1, label: 'Animation du vendredi 14 août' });
    if (days.includes(DAY_SAT)) list.push({ kind: 'anim', ok: animSam.length >= 1, label: 'Animation du samedi 15 août' });
    // Bloc 5 — Documents (en waitlist, optionnels jusqu'à promotion)
    if (!isWaitlist) {
      const hasConv = !!r.is_convention_signed || (docs || []).some((d) => d.document_type === 'convention');
      list.push({ kind: 'doc', ok: hasConv, label: 'Convention signée' });
      const hasAss = (docs || []).some((d) => d.document_type === 'assurance') || !!r.is_insurance_uploaded;
      list.push({ kind: 'doc', ok: hasAss, label: 'Attestation d\'assurance' });
    } else {
      list.push({ kind: 'doc', ok: true, label: '📄 Documents à fournir quand promu de la liste d\'attente', isInfo: true });
    }
    return list;
  }, [r, days, slots, docs, animVen, animSam]);

  const missingList = checks.filter((c) => !c.ok).map((c) => c.label);
  const canSubmit = missingList.length === 0;

  const onSubmit = async () => {
    setSubmitting(true);
    try {
      await api(`/api/registrations/${r.id}/request-validation`, { method: 'POST', body: JSON.stringify({}) });
      toast.success('📤 Candidature soumise à ARACOM');
      onRefresh?.();
    } catch (e) { toast.error(e.message); }
    finally { setSubmitting(false); }
  };

  // =====================================================
  // RENDU
  // =====================================================
  return (
    <div className="space-y-3">
      <Bloc1Sites
        allSites={allSites}
        activeRegId={r.id}
        availableVenues={availableVenues}
        allVenues={allVenues}
        venuesAvailability={venuesAvailability}
        onAddSite={addSite}
        onRemoveSite={removeSite}
        onSwapPriority={swapPriority}
        onSwitchSite={onSwitchSite}
        busy={busy}
      />
      <Bloc2Days
        days={days}
        onChangeDays={changeDays}
        isLocked={isLocked}
        busy={busy}
      />
      <Bloc3Stand
        registration={r}
        venue={venue}
        venueAvailability={venueAvailability}
        onRefresh={onRefresh}
        onPickStand={onOpenStandPicker}
        onReleaseStand={releaseStand}
        onJoinWaitlist={joinWaitlist}
        busy={busy}
      />
      <Bloc4Animations
        registration={r}
        venueId={r.venue_id}
        days={days}
        attendingDayTimes={r.attending_day_times || {}}
        slots={slots}
        onRefresh={onRefresh}
        busy={busy}
      />
      <Bloc5Submit
        checks={checks}
        missingList={missingList}
        canSubmit={canSubmit}
        isSubmitted={isSubmitted}
        isLocked={isLocked}
        isSubmitting={submitting}
        onSubmit={onSubmit}
      />
    </div>
  );
}

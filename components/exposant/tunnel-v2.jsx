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

const DAY_FRI = '2026-08-14';
const DAY_SAT = '2026-08-15';

function dayLabel(d) {
  if (d === DAY_FRI) return 'Vendredi 14 août';
  if (d === DAY_SAT) return 'Samedi 15 août';
  return d;
}

// =======================================================
// BLOC 1 — Sites priorisés
// =======================================================
function Bloc1Sites({ allSites, activeRegId, availableVenues, venuesAvailability, onAddSite, onRemoveSite, onSwapPriority, onSwitchSite, busy }) {
  // Trier par site_priority
  const sorted = [...(allSites || [])].sort((a, b) => (a.site_priority || 99) - (b.site_priority || 99));
  const occupiedIds = new Set(sorted.map((s) => s.venue_id));
  const remaining = (availableVenues || []).filter((v) => !occupiedIds.has(v.id));
  const canAddMore = sorted.length < 3 && remaining.length > 0;

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
                    <span className="font-semibold text-sm text-slate-900 truncate">{site.venue?.name || '—'}</span>
                    {isActive && <Badge className="text-[9px] bg-aracom-orange text-white border-aracom-orange shrink-0">Site actif</Badge>}
                  </div>
                  <div className="text-[10.5px] text-slate-500">
                    {isFull ? (
                      <span className="text-amber-700">⏳ <span className="font-semibold">Complet</span> — liste d&apos;attente : {wait} inscrit{wait > 1 ? 's' : ''}</span>
                    ) : (
                      <span className="text-emerald-700"><span className="font-semibold">{free}</span> stand{free > 1 ? 's' : ''} libre{free > 1 ? 's' : ''}</span>
                    )}
                  </div>
                </button>

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

        {/* Ajouter un site */}
        {canAddMore && (
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
// BLOC 3 — Stand (priorité UX maximale : CTA unique)
// =======================================================
function Bloc3Stand({ registration, venue, venueAvailability, onPickStand, onReleaseStand, onJoinWaitlist, busy }) {
  const r = registration || {};
  const av = venueAvailability || {};
  const free = av.available_stands ?? 0;
  const isFull = !!av.capacity_full || free <= 0;
  const waitlistCount = av.waitlist_count || 0;
  const hasStand = !!r.stand_code;
  const isWaitlist = !!r.is_waitlist || r.status === 'liste_attente';

  return (
    <Card data-section="stand" className="border-orange-300">
      <CardContent className="p-3 md:p-4">
        <header className="flex items-center gap-2 mb-2">
          <span className="w-7 h-7 rounded-full bg-orange-600 text-white flex items-center justify-center text-xs font-bold">3</span>
          <h3 className="font-bold text-base text-slate-900">Mon stand</h3>
          {hasStand && <Badge className="bg-emerald-600 text-white border-emerald-700 text-[10px] ml-auto">✓ Verrouillé</Badge>}
        </header>

        {/* Cas 1 — Stand déjà attribué */}
        {hasStand && (
          <div className="rounded-lg border-2 border-emerald-400 bg-emerald-50 p-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Lock className="w-4 h-4 text-emerald-700" />
              <div className="flex-1 min-w-0">
                <div className="font-bold text-base text-emerald-900">
                  Stand {r.stand_code} — réservé ✓
                </div>
                <div className="text-[11px] text-emerald-800">
                  {r.status === 'confirme' ? '✅ Validé par ARACOM'
                    : r.status === 'a_confirmer' ? '⏳ En attente de validation ARACOM'
                    : '🟧 Pré-réservé'}
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={onReleaseStand}
                disabled={busy || r.status === 'confirme'}
                className="h-7 text-[10px] gap-1 text-red-700 border-red-300 hover:bg-red-50"
              >
                Libérer
              </Button>
            </div>
          </div>
        )}

        {/* Cas 2 — Waitlist active */}
        {!hasStand && isWaitlist && (
          <div className="rounded-lg border-2 border-amber-400 bg-amber-50 p-3 flex items-center gap-2 flex-wrap">
            <Clock className="w-4 h-4 text-amber-700 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm text-amber-900">En liste d&apos;attente sur {venue?.name || '—'}</div>
              <div className="text-[10.5px] text-amber-800">ARACOM vous contactera dès qu&apos;un stand se libère.</div>
            </div>
          </div>
        )}

        {/* Cas 3 — Site complet, proposer waitlist */}
        {!hasStand && !isWaitlist && isFull && (
          <button
            onClick={onJoinWaitlist}
            disabled={busy}
            className="w-full rounded-lg border-2 border-amber-400 bg-amber-50 hover:bg-amber-100 px-3 py-3 flex items-center justify-between gap-2 transition disabled:opacity-50"
          >
            <div className="text-left">
              <div className="font-bold text-sm text-amber-900">Rejoindre la liste d&apos;attente</div>
              <div className="text-[11px] text-amber-800">{waitlistCount} inscrit{waitlistCount > 1 ? 's' : ''} actuellement</div>
            </div>
            <span className="text-amber-900 font-bold flex items-center gap-1">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
            </span>
          </button>
        )}

        {/* Cas 4 — Stands libres : CTA unique */}
        {!hasStand && !isWaitlist && !isFull && (
          <button
            onClick={onPickStand}
            disabled={busy}
            className="w-full rounded-lg border-2 border-emerald-400 bg-emerald-50 hover:bg-emerald-100 px-3 py-3 flex items-center justify-between gap-2 transition disabled:opacity-50"
          >
            <div className="text-left">
              <div className="font-bold text-base text-emerald-900">{free} stand{free > 1 ? 's' : ''} libre{free > 1 ? 's' : ''} — Réserver un stand</div>
              <div className="text-[11px] text-emerald-800">Sélectionnez votre emplacement sur le plan ↓</div>
            </div>
            <span className="text-emerald-900 font-bold flex items-center gap-1">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
            </span>
          </button>
        )}
      </CardContent>
    </Card>
  );
}

// =======================================================
// BLOC 4 — Animations par jour
// =======================================================
function Bloc4Animations({ days, slots, onOpenAnimationPicker, onDeleteSlot, busy }) {
  return (
    <Card data-section="planning" className="border-yellow-300">
      <CardContent className="p-3 md:p-4">
        <header className="flex items-center gap-2 mb-2">
          <span className="w-7 h-7 rounded-full bg-yellow-500 text-white flex items-center justify-center text-xs font-bold">4</span>
          <h3 className="font-bold text-base text-slate-900">Mes animations (1 par jour de présence)</h3>
        </header>

        {(!days || days.length === 0) && (
          <div className="rounded-md border-2 border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-center text-[11px] text-slate-500 italic">
            Sélectionnez d&apos;abord vos jours de présence au Bloc 2.
          </div>
        )}

        {days?.length > 0 && (
          <div className="space-y-2">
            {days.map((d) => {
              const daySlots = (slots || []).filter((s) => s.date === d);
              const hasAny = daySlots.length > 0;
              return (
                <div
                  key={d}
                  className={`rounded-lg border-2 p-2.5 ${hasAny ? 'border-emerald-300 bg-emerald-50/40' : 'border-red-300 bg-red-50/40'}`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
                    <div className="font-semibold text-sm text-slate-900 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" /> {dayLabel(d)}
                    </div>
                    {!hasAny && (
                      <Badge className="bg-red-500 text-white border-red-600 text-[9px]">
                        ⚠ Aucune animation
                      </Badge>
                    )}
                  </div>

                  {/* Liste des animations du jour */}
                  {hasAny && (
                    <ul className="space-y-1 mb-2">
                      {daySlots.map((s) => (
                        <li
                          key={s.id}
                          className="rounded border border-slate-200 bg-white px-2 py-1.5 text-[11px] flex items-center justify-between gap-2"
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            {s.location_type === 'zone_demo' ? (
                              <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300 text-[9px] shrink-0">🟡 Zone démo</Badge>
                            ) : (
                              <Badge className="bg-blue-100 text-blue-800 border-blue-300 text-[9px] shrink-0">🔵 Sur stand</Badge>
                            )}
                            <span className="text-slate-700 truncate">
                              {dayLabel(d)} — {s.start_time}–{s.end_time}
                              {s.title ? ` · ${s.title}` : ''}
                            </span>
                            <span className="text-emerald-600 font-bold">✅</span>
                          </div>
                          <button
                            onClick={() => onDeleteSlot(s.id)}
                            disabled={busy}
                            className="text-[10px] text-slate-400 hover:text-red-600 shrink-0"
                            title="Supprimer cette animation"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}

                  {/* Bouton choisir/ajouter */}
                  <button
                    onClick={() => onOpenAnimationPicker(d)}
                    disabled={busy}
                    className={`w-full rounded-md border px-2 py-1.5 text-xs font-semibold transition flex items-center justify-center gap-1.5 ${
                      hasAny
                        ? 'border-slate-300 bg-white hover:bg-slate-50 text-slate-700'
                        : 'border-red-400 bg-white hover:bg-red-50 text-red-700'
                    }`}
                  >
                    <Plus className="w-3 h-3" /> {hasAny ? 'Ajouter une autre animation' : 'Choisir une animation pour ce jour'}
                  </button>
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

        {/* Bouton soumettre */}
        {isSubmitted && (
          <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900 mb-2">
            ⏳ Votre candidature a été soumise à ARACOM. Vous serez notifié dès traitement.
          </div>
        )}
        {isLocked && !isSubmitted && (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900 mb-2">
            🔒 Candidature verrouillée par ARACOM.
          </div>
        )}

        <div className="relative group">
          <Button
            size="lg"
            onClick={onSubmit}
            disabled={!canSubmit || isSubmitting || isSubmitted || isLocked}
            className={`w-full h-11 text-sm font-bold gap-2 ${
              canSubmit && !isSubmitted && !isLocked
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                : 'bg-slate-300 text-slate-500 cursor-not-allowed'
            }`}
            title={!canSubmit && missingList?.length ? `Il manque :\n• ${missingList.join('\n• ')}` : ''}
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {isSubmitted ? 'Candidature soumise' : 'Soumettre ma candidature'}
          </Button>

          {/* Tooltip natif visible si grisé */}
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
      await api('/api/exposant/sites/add', { method: 'POST', body: JSON.stringify({ venue_id: venueId }) });
      toast.success('✅ Site ajouté');
      onRefresh?.();
    } catch (e) { toast.error(e.message); }
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
  const animVen = (slots || []).filter((s) => s.date === DAY_FRI);
  const animSam = (slots || []).filter((s) => s.date === DAY_SAT);

  const checks = useMemo(() => {
    const list = [];
    // Bloc 1 — Site
    list.push({ kind: 'site', ok: !!r.venue_id, label: 'Site choisi' });
    // Bloc 2 — Jours
    list.push({ kind: 'days', ok: days.length > 0, label: 'Jours de présence' });
    // Bloc 3 — Stand
    list.push({ kind: 'stand', ok: !!r.stand_code, label: 'Stand réservé' });
    // Bloc 4 — Animations par jour
    if (days.includes(DAY_FRI)) list.push({ kind: 'anim', ok: animVen.length >= 1, label: 'Animation du vendredi 14 août' });
    if (days.includes(DAY_SAT)) list.push({ kind: 'anim', ok: animSam.length >= 1, label: 'Animation du samedi 15 août' });
    // Bloc 5 — Documents
    const hasConv = !!r.is_convention_signed || (docs || []).some((d) => d.document_type === 'convention');
    list.push({ kind: 'doc', ok: hasConv, label: 'Convention signée' });
    const hasAss = (docs || []).some((d) => d.document_type === 'assurance') || !!r.is_insurance_uploaded;
    list.push({ kind: 'doc', ok: hasAss, label: 'Attestation d\'assurance' });
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
        onPickStand={onOpenStandPicker}
        onReleaseStand={releaseStand}
        onJoinWaitlist={joinWaitlist}
        busy={busy}
      />
      <Bloc4Animations
        days={days}
        slots={slots}
        onOpenAnimationPicker={onOpenAnimationPicker}
        onDeleteSlot={deleteSlot}
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

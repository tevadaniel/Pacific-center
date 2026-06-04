'use client';
import { useEffect, useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronRight, MapPin, Sparkles, AlertCircle, CheckCircle2, ChevronUp, ChevronDown } from 'lucide-react';

/**
 * 🆕 PHASE G1 — Bandeau contextuel STICKY pour le Portail Exposant.
 *
 * Affiche en temps réel :
 *  - Org · Site · Stand · Animations · Caution · Deadline 31/07
 *  - "Prochaine action recommandée" dynamique selon l'état
 *
 * Mobile : compact + collapsible (scroll-down hide, scroll-up show).
 *
 * Props attendues :
 *  - registration (objet) : { id, status, venue_id, stand_code, attending_days, is_waitlist }
 *  - organization (objet) : { name, discipline }
 *  - venue (objet|null) : { id, name, owner_sci }
 *  - standAssignment (objet|null) : { request_status, stand_code, cession_status }
 *  - animations (array)
 *  - cautionStatus (string) : 'due' | 'received' | 'returned'
 *  - onJumpTo (fn) : (sectionKey) => void (déclenche scroll/onglet)
 */
export default function StickyContextBar({
  registration,
  organization,
  venue,
  standAssignment,
  animations = [],
  cautionStatus = 'due',
  onJumpTo,
  // 🆕 SESSION 48h — Données enrichies pour dropdowns site/stand/animation
  allSites = [],
  availableVenues = [],
  onSiteSwitch,
  onAddSite,
  // 🆕 SESSION 48j — Sélection date directement depuis le bandeau
  onUpdateAttendingDays,
  // venuesData : map venue.id => { available_stands, total_stands, capacity_full }
  venuesAvailability = {},
}) {
  const [scrolled, setScrolled] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [manualCollapsed, setManualCollapsed] = useState(false);
  // 🆕 État dropdown ouvert (1 à la fois) : 'site' | 'stand' | 'animations' | null
  const [openDropdown, setOpenDropdown] = useState(null);

  // Détection scroll : sur mobile, repli auto au scroll-down, dépli au scroll-up
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 30);
      if (window.innerWidth < 768 && !manualCollapsed) {
        if (y > lastScrollY + 10) setCollapsed(true);   // scroll down → hide
        else if (y < lastScrollY - 10) setCollapsed(false); // scroll up → show
      }
      setLastScrollY(y);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY, manualCollapsed]);

  // 📊 Calcul de l'état du dossier
  const state = useMemo(() => {
    const hasSite = !!registration?.venue_id;
    const hasStand = !!registration?.stand_code;
    const hasAttendingDays = (registration?.attending_days || []).length > 0;
    const daysCount = (registration?.attending_days || []).length;
    const minAnimsRequired = Math.max(1, daysCount);
    const activeAnims = animations.filter(a => a.status !== 'annulé' && a.request_status !== 'refused');
    const animsCount = activeAnims.length;
    const animsOK = animsCount >= minAnimsRequired;
    const isValidated = standAssignment?.request_status === 'validated';
    const isWaitlist = registration?.is_waitlist || standAssignment?.request_status === 'waitlist';
    const isPending = standAssignment?.request_status === 'pending';
    const cautionReceived = cautionStatus === 'received';
    const cautionReturned = cautionStatus === 'returned';
    const cessionActive = standAssignment?.cession_status === 'pending_approval' || standAssignment?.cession_status === 'available_for_promotion';

    // Score complétude
    const checks = [hasSite, hasStand, hasAttendingDays, animsOK, cautionReceived || cautionReturned];
    const completedCount = checks.filter(Boolean).length;
    const completionPct = Math.round((completedCount / checks.length) * 100);

    return {
      hasSite, hasStand, hasAttendingDays, daysCount, animsCount, minAnimsRequired, animsOK,
      isValidated, isWaitlist, isPending, cautionReceived, cautionReturned, cessionActive,
      completionPct, completedCount, totalChecks: checks.length,
    };
  }, [registration, standAssignment, animations, cautionStatus]);

  // 🎯 "Prochaine action recommandée" — règles métier
  const nextAction = useMemo(() => {
    if (state.cessionActive) {
      return { label: '🔁 Cession en cours', desc: 'ARACOM traite votre demande', tone: 'amber', target: null };
    }
    if (state.isWaitlist) {
      return { label: '⏳ En liste d\'attente', desc: 'ARACOM vous notifiera dès qu\'un créneau se libère', tone: 'amber', target: 'parcours' };
    }
    if (!state.hasSite) {
      return { label: 'Choisir mon site', desc: 'Sélectionnez le centre commercial qui vous intéresse', tone: 'orange', target: 'parcours' };
    }
    if (!state.hasAttendingDays) {
      return { label: 'Indiquer mes jours de présence', desc: 'Vendredi et/ou Samedi', tone: 'orange', target: 'parcours' };
    }
    if (!state.hasStand) {
      return { label: 'Choisir mon stand', desc: 'Cliquez sur un stand libre sur le plan', tone: 'orange', target: 'parcours' };
    }
    if (state.isPending && !state.isValidated) {
      // Stand demandé, en attente Aracom
      if (!state.animsOK) {
        return { label: 'Compléter mes animations', desc: `${state.animsCount}/${state.minAnimsRequired} minimum requis`, tone: 'orange', target: 'parcours' };
      }
      return { label: '⏳ Validation ARACOM en cours', desc: 'Votre dossier est complet et en attente', tone: 'blue', target: 'infos' };
    }
    if (state.isValidated && !state.animsOK) {
      return { label: 'Ajouter mes animations', desc: `${state.animsCount}/${state.minAnimsRequired} minimum (obligatoire)`, tone: 'orange', target: 'parcours' };
    }
    if (state.isValidated && state.animsOK && !state.cautionReceived) {
      return { label: 'Apporter mon chèque de caution', desc: '20 000 XPF — RDV avec ARACOM avant le 31/07', tone: 'orange', target: 'documents' };
    }
    if (state.cautionReceived && state.animsOK && state.isValidated) {
      return { label: 'Imprimer mon annexe + Convention', desc: 'Dossier complet ✓ — préparez vos documents', tone: 'emerald', target: 'documents' };
    }
    return { label: 'Voir mon parcours', desc: 'Continuer mon inscription', tone: 'orange', target: 'parcours' };
  }, [state]);

  const TONE = {
    orange: 'bg-aracom-orange hover:bg-aracom-orange/90 text-white',
    blue: 'bg-blue-600 hover:bg-blue-700 text-white',
    amber: 'bg-amber-500 hover:bg-amber-600 text-white',
    emerald: 'bg-emerald-600 hover:bg-emerald-700 text-white',
  };

  // 📅 Compteur deadline 31/07/2026
  const deadlineLeft = useMemo(() => {
    const deadline = new Date('2026-07-31T23:59:59');
    const now = new Date();
    const diffMs = deadline - now;
    if (diffMs < 0) return { passed: true, label: 'Deadline dépassée', short: 'Dépassée' };
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (days <= 0) return { passed: false, label: 'Aujourd\'hui !', short: 'Auj.' };
    if (days <= 7) return { passed: false, label: `${days}j restant${days > 1 ? 's' : ''}`, short: `${days}j`, urgent: true };
    if (days <= 30) return { passed: false, label: `${days}j restants`, short: `${days}j`, warning: true };
    return { passed: false, label: `${days}j restants`, short: `${days}j` };
  }, []);

  if (!organization) return null;

  return (
    <div className={`sticky top-0 z-40 transition-all duration-200 ${
      scrolled ? 'shadow-xl bg-aracom-black/97 backdrop-blur' : 'bg-aracom-black'
    } ${collapsed ? 'h-12' : ''}`} data-testid="sticky-context-bar">
      <div className="max-w-7xl mx-auto px-3 md:px-4 py-2">
        {/* HEADER COMPACT (toujours visible) */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="text-xl shrink-0">🌺</span>
            <div className="min-w-0">
              <div className="font-bold text-white text-sm md:text-base truncate">
                {organization.name}
              </div>
              <div className="text-[10px] md:text-[11px] text-aracom-gold/80 truncate">
                {organization.discipline || '—'} · Forum 2026
              </div>
            </div>
          </div>
          {/* Mini-progress */}
          <div className="hidden sm:flex items-center gap-1.5 shrink-0">
            <div className="w-20 md:w-32 h-1.5 bg-white/15 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-aracom-orange to-aracom-gold transition-all duration-500"
                style={{ width: `${state.completionPct}%` }}
              />
            </div>
            <span className="text-[10px] md:text-xs font-bold text-white">{state.completionPct}%</span>
          </div>
          {/* Bouton Next Action (compact) */}
          {nextAction.target && (
            <Button
              size="sm"
              onClick={() => onJumpTo && onJumpTo(nextAction.target)}
              className={`gap-1 h-8 px-2 md:px-3 text-[11px] md:text-xs font-semibold shrink-0 ${TONE[nextAction.tone] || TONE.orange}`}
              data-testid="next-action-btn"
            >
              <span className="hidden md:inline">{nextAction.label}</span>
              <span className="md:hidden">{nextAction.label.split(' ').slice(0, 2).join(' ')}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          )}
          {/* Toggle collapse */}
          <button
            onClick={() => { setManualCollapsed(!manualCollapsed); setCollapsed(!collapsed); }}
            className="p-1 rounded hover:bg-white/10 text-white/60 hover:text-white transition shrink-0"
            aria-label={collapsed ? 'Déplier' : 'Replier'}
          >
            {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>

        {/* DÉTAILS ÉTAT (visible quand non-collapsed) */}
        {!collapsed && (
          <>
          <div className="mt-2 grid grid-cols-2 md:grid-cols-5 gap-1.5 md:gap-2 text-[11px]">
            <Chip
              icon={<MapPin className="w-3 h-3" />}
              label="Site"
              value={venue?.name || '—'}
              ok={state.hasSite}
              missing={!state.hasSite}
              isDropdown
              isOpen={openDropdown === 'site'}
              onClick={() => setOpenDropdown(openDropdown === 'site' ? null : 'site')}
            />
            <Chip
              icon="🎪"
              label="Stand"
              value={registration?.stand_code || (state.isWaitlist ? '⏳ Waitlist' : '—')}
              ok={state.hasStand && !state.isWaitlist}
              warning={state.isWaitlist}
              missing={!state.hasStand && !state.isWaitlist}
              isDropdown
              isOpen={openDropdown === 'stand'}
              onClick={() => setOpenDropdown(openDropdown === 'stand' ? null : 'stand')}
            />
            <Chip
              icon="🎭"
              label="Animations"
              value={`${state.animsCount}/${state.minAnimsRequired}`}
              ok={state.animsOK}
              missing={state.hasStand && !state.animsOK}
              isDropdown
              isOpen={openDropdown === 'animations'}
              onClick={() => setOpenDropdown(openDropdown === 'animations' ? null : 'animations')}
            />
            <Chip
              icon="💰"
              label="Caution"
              value={state.cautionReturned ? '🔄 Rendue' : state.cautionReceived ? '✅ Reçue' : '⏳ À recevoir'}
              ok={state.cautionReceived || state.cautionReturned}
              warning={!state.cautionReceived && !state.cautionReturned}
              onClick={() => { setOpenDropdown(null); onJumpTo && onJumpTo('documents'); }}
            />
            <Chip
              icon="⏰"
              label="Deadline 31/07"
              value={deadlineLeft.short}
              ok={!deadlineLeft.passed && !deadlineLeft.urgent && !deadlineLeft.warning}
              warning={deadlineLeft.warning}
              danger={deadlineLeft.urgent || deadlineLeft.passed}
              onClick={() => { setOpenDropdown(null); onJumpTo && onJumpTo('documents'); }}
            />
          </div>

          {/* 🆕 SESSION 48h — Dropdown panel (1 à la fois) — détails site/stand/animations */}
          {openDropdown && (
            <div className="mt-2 rounded-lg bg-white text-slate-800 shadow-xl border border-aracom-orange/30 overflow-hidden animate-in fade-in slide-in-from-top-1">
              {openDropdown === 'site' && (
                <div className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-bold text-xs uppercase tracking-wide text-aracom-orange flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5" /> Mes sites & dates
                    </div>
                    <button onClick={() => setOpenDropdown(null)} className="text-slate-400 hover:text-slate-700 text-xs">✕</button>
                  </div>

                  {/* 🆕 SESSION 48j — Sélecteur de date pour le site en cours */}
                  {venue && onUpdateAttendingDays && (
                    <div className="mb-3 px-2 py-2 rounded bg-orange-50 border border-orange-200">
                      <div className="text-[10px] uppercase tracking-wide font-bold text-aracom-orange mb-1">Mes jours sur ce site</div>
                      <div className="flex gap-2 flex-wrap">
                        {[
                          { key: 'vendredi', label: '📅 Vendredi 14/08' },
                          { key: 'samedi', label: '📅 Samedi 15/08' },
                        ].map(d => {
                          const checked = (registration?.attending_days || []).includes(d.key);
                          return (
                            <label key={d.key} className="flex items-center gap-1.5 cursor-pointer text-xs select-none">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                  const cur = registration?.attending_days || [];
                                  const next = e.target.checked
                                    ? [...new Set([...cur, d.key])]
                                    : cur.filter(x => x !== d.key);
                                  onUpdateAttendingDays(next);
                                }}
                                className="w-3.5 h-3.5 accent-aracom-orange"
                              />
                              <span className={checked ? 'font-semibold text-slate-900' : 'text-slate-600'}>{d.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {allSites.length === 0 ? (
                    <div className="text-xs text-slate-500 italic px-1 py-2">Aucun site sélectionné</div>
                  ) : (
                    <ul className="space-y-1 mb-2">
                      {allSites.map(s => {
                        const isCurrent = s.id === registration?.id;
                        const vid = s.venue_id || s.venue?.id;
                        const avail = venuesAvailability[vid] || {};
                        const isWaitlistOnly = avail.capacity_full === true;
                        return (
                          <li key={s.id}>
                            <button
                              onClick={() => { setOpenDropdown(null); if (!isCurrent && onSiteSwitch) onSiteSwitch(s.id); }}
                              disabled={isCurrent}
                              className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded text-xs text-left transition ${isCurrent ? 'bg-aracom-orange/10 border border-aracom-orange/40 cursor-default' : 'hover:bg-slate-100 border border-transparent'}`}
                            >
                              <div className="flex-1 min-w-0">
                                <div className="font-semibold text-slate-900 truncate">{s.venue?.name || s.venue_name || 'Site'}</div>
                                <div className="text-[10px] text-slate-500">
                                  {s.stand_code ? `Stand ${s.stand_code}` : 'Pas de stand'}
                                  {s.is_user_priority ? ' · ⭐ Priorité' : ''}
                                </div>
                              </div>
                              {isCurrent && <span className="text-[10px] text-aracom-orange font-bold shrink-0">✓ Actif</span>}
                              {!isCurrent && isWaitlistOnly && (
                                <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded shrink-0 font-semibold">⏳ Waitlist</span>
                              )}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}

                  {/* 🆕 SESSION 48j — Sélecteur de nouveau site avec dispo */}
                  {availableVenues.length > allSites.length && (
                    <div className="pt-2 border-t border-slate-100">
                      <div className="text-[10px] uppercase tracking-wide font-bold text-slate-600 mb-1">Ajouter un site</div>
                      <ul className="space-y-1 max-h-40 overflow-y-auto">
                        {availableVenues
                          .filter(av => !allSites.some(s => (s.venue_id || s.venue?.id) === av.id))
                          .map(av => {
                            const avail = venuesAvailability[av.id] || {};
                            const isFull = avail.capacity_full === true;
                            return (
                              <li key={av.id}>
                                <button
                                  onClick={() => { setOpenDropdown(null); onAddSite && onAddSite(av.id); }}
                                  className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded text-xs text-left transition border ${isFull ? 'bg-amber-50 hover:bg-amber-100 border-amber-200' : 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200'}`}
                                >
                                  <div className="flex-1 min-w-0">
                                    <div className="font-semibold text-slate-900 truncate">{av.name}</div>
                                    <div className="text-[10px] text-slate-600">
                                      {typeof avail.available_stands === 'number' ? (
                                        isFull ? '⏳ Complet — vous serez en liste d\'attente' : `✅ ${avail.available_stands} stand${avail.available_stands > 1 ? 's' : ''} libre${avail.available_stands > 1 ? 's' : ''}`
                                      ) : 'Disponibilité inconnue'}
                                    </div>
                                  </div>
                                  <span className="text-[10px] font-bold text-aracom-orange shrink-0">➕</span>
                                </button>
                              </li>
                            );
                          })}
                      </ul>
                      <p className="text-[10px] text-amber-700 mt-1 italic">⚠️ Si un site est complet, vous serez ajouté en liste d&apos;attente. ARACOM vous tient au courant.</p>
                    </div>
                  )}

                  <button
                    onClick={() => { setOpenDropdown(null); onJumpTo && onJumpTo('parcours'); }}
                    className="w-full mt-2 px-2.5 py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700"
                  >
                    Modifier mes choix en détail
                  </button>
                </div>
              )}
              {openDropdown === 'stand' && (
                <div className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-bold text-xs uppercase tracking-wide text-aracom-orange flex items-center gap-1.5">
                      🎪 Mon stand
                    </div>
                    <button onClick={() => setOpenDropdown(null)} className="text-slate-400 hover:text-slate-700 text-xs">✕</button>
                  </div>
                  {registration?.stand_code ? (
                    <div className="text-xs text-slate-700 mb-2 space-y-1">
                      <div><b className="font-mono text-aracom-orange">{registration.stand_code}</b> {venue?.name ? `· ${venue.name}` : ''}</div>
                      {standAssignment?.surface_m2 && <div className="text-[11px] text-slate-500">Surface : ~{standAssignment.surface_m2} m²</div>}
                      {state.isWaitlist && <div className="text-[11px] text-amber-700">⏳ En liste d&apos;attente</div>}
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500 italic mb-2 px-1">Pas de stand sélectionné</div>
                  )}
                  <button
                    onClick={() => { setOpenDropdown(null); onJumpTo && onJumpTo('parcours'); }}
                    className="w-full px-2.5 py-1.5 rounded bg-aracom-orange hover:bg-orange-600 text-white text-xs font-semibold"
                  >
                    {registration?.stand_code ? 'Changer de stand' : 'Choisir un stand'}
                  </button>
                </div>
              )}
              {openDropdown === 'animations' && (
                <div className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-bold text-xs uppercase tracking-wide text-aracom-orange flex items-center gap-1.5">
                      🎭 Mes animations ({state.animsCount}/{state.minAnimsRequired})
                    </div>
                    <button onClick={() => setOpenDropdown(null)} className="text-slate-400 hover:text-slate-700 text-xs">✕</button>
                  </div>
                  {animations.length === 0 ? (
                    <div className="text-xs text-slate-500 italic mb-2 px-1">Aucune animation enregistrée</div>
                  ) : (
                    <ul className="space-y-1 mb-2 max-h-56 overflow-y-auto">
                      {animations.map(a => (
                        <li key={a.id} className="px-2 py-1.5 rounded bg-slate-50 border border-slate-200 text-xs">
                          <div className="font-semibold text-slate-800">
                            {a.day_label === 'samedi' ? '📅 Samedi' : '📅 Vendredi'} · {a.start_time}–{a.end_time}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            {a.location_type === 'zone_demo' ? '🟧 Zone démo (45 min)' : '🟦 Sur stand (30 min)'}
                            {a.title ? ` · ${a.title}` : ''}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                  <button
                    onClick={() => { setOpenDropdown(null); onJumpTo && onJumpTo('parcours'); }}
                    className="w-full px-2.5 py-1.5 rounded bg-aracom-orange hover:bg-orange-600 text-white text-xs font-semibold"
                  >
                    Ajouter / Modifier une animation
                  </button>
                </div>
              )}
            </div>
          )}
          </>
        )}

        {/* DESC NEXT ACTION (subtle, sous le bouton) */}
        {!collapsed && nextAction.desc && (
          <div className="mt-1.5 text-[10px] md:text-[11px] text-aracom-gold/70 text-right pr-1 italic truncate">
            → {nextAction.desc}
          </div>
        )}
      </div>
    </div>
  );
}

function Chip({ icon, label, value, ok, warning, missing, danger, onClick, isDropdown = false, isOpen = false }) {
  const bg = danger ? 'bg-rose-500/25 border-rose-400/50 text-rose-100'
    : missing ? 'bg-rose-500/15 border-rose-400/40 text-rose-200'
    : warning ? 'bg-amber-500/20 border-amber-400/50 text-amber-100'
    : ok ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-100'
    : 'bg-white/5 border-white/15 text-white/80';
  const openRing = isOpen ? 'ring-2 ring-white/60' : '';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 px-2 py-1 rounded border ${bg} ${openRing} hover:brightness-125 transition text-left min-w-0`}
    >
      <span className="text-[12px] shrink-0">{typeof icon === 'string' ? icon : icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-[9px] uppercase tracking-wider opacity-80 flex items-center gap-0.5">
          <span>{label}</span>
          {isDropdown && <span className={`text-[8px] opacity-70 transition-transform ${isOpen ? 'rotate-180' : ''}`}>▾</span>}
        </div>
        <div className="font-bold text-[11px] truncate">{value}</div>
      </div>
    </button>
  );
}

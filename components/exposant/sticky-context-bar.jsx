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
}) {
  const [scrolled, setScrolled] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [manualCollapsed, setManualCollapsed] = useState(false);

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
          <div className="mt-2 grid grid-cols-2 md:grid-cols-5 gap-1.5 md:gap-2 text-[11px]">
            <Chip
              icon={<MapPin className="w-3 h-3" />}
              label="Site"
              value={venue?.name || '—'}
              ok={state.hasSite}
              missing={!state.hasSite}
              onClick={() => onJumpTo && onJumpTo('parcours')}
            />
            <Chip
              icon="🎪"
              label="Stand"
              value={registration?.stand_code || (state.isWaitlist ? '⏳ Waitlist' : '—')}
              ok={state.hasStand && !state.isWaitlist}
              warning={state.isWaitlist}
              missing={!state.hasStand && !state.isWaitlist}
              onClick={() => onJumpTo && onJumpTo('parcours')}
            />
            <Chip
              icon="🎭"
              label="Animations"
              value={`${state.animsCount}/${state.minAnimsRequired}`}
              ok={state.animsOK}
              missing={state.hasStand && !state.animsOK}
              onClick={() => onJumpTo && onJumpTo('parcours')}
            />
            <Chip
              icon="💰"
              label="Caution"
              value={state.cautionReturned ? '🔄 Rendue' : state.cautionReceived ? '✅ Reçue' : '⏳ À recevoir'}
              ok={state.cautionReceived || state.cautionReturned}
              warning={!state.cautionReceived && !state.cautionReturned}
              onClick={() => onJumpTo && onJumpTo('documents')}
            />
            <Chip
              icon="⏰"
              label="Deadline 31/07"
              value={deadlineLeft.short}
              ok={!deadlineLeft.passed && !deadlineLeft.urgent && !deadlineLeft.warning}
              warning={deadlineLeft.warning}
              danger={deadlineLeft.urgent || deadlineLeft.passed}
              onClick={() => onJumpTo && onJumpTo('documents')}
            />
          </div>
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

function Chip({ icon, label, value, ok, warning, missing, danger, onClick }) {
  const bg = danger ? 'bg-rose-500/25 border-rose-400/50 text-rose-100'
    : missing ? 'bg-rose-500/15 border-rose-400/40 text-rose-200'
    : warning ? 'bg-amber-500/20 border-amber-400/50 text-amber-100'
    : ok ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-100'
    : 'bg-white/5 border-white/15 text-white/80';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 px-2 py-1 rounded border ${bg} hover:brightness-125 transition text-left min-w-0`}
    >
      <span className="text-[12px] shrink-0">{typeof icon === 'string' ? icon : icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-[9px] uppercase tracking-wider opacity-80">{label}</div>
        <div className="font-bold text-[11px] truncate">{value}</div>
      </div>
    </button>
  );
}

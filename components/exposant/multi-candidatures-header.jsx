'use client';

/**
 * 🆕 SESSION 52 — MultiCandidaturesHeader (Phase A)
 *
 * Header sticky avec UNE LIGNE PAR CANDIDATURE (= par site).
 * - Affiche : rang (Site 1/2/3) + nom site + statut + résumé synthétique
 * - Résumé cliquable : chaque élément (Stand, Animations, Convention…) renvoie au bloc concerné
 * - Clic sur la ligne entière = bascule le site actif (switche le `?reg=`)
 *
 * Props :
 *   allSites      — array of registrations (de /api/exposant/my-sites)
 *   activeRegId   — id de la candidature actuellement active
 *   orgName       — nom de l'organisation (entête)
 *   onSwitchSite  — (regId) => void   bascule sur ce site
 *   onJumpTo      — (sectionKey) => void  scroll vers le bloc concerné
 */

import { Badge } from '@/components/ui/badge';
import { MapPin, Check, AlertTriangle, Clock, X, ChevronRight, Star } from 'lucide-react';

// Statut → label + classes
function statusInfo(status) {
  switch (status) {
    case 'confirme':       return { label: 'Validée', cls: 'bg-emerald-100 text-emerald-800 border-emerald-300', icon: '✅' };
    case 'a_confirmer':    return { label: 'Soumise',  cls: 'bg-blue-100 text-blue-800 border-blue-300',           icon: '📤' };
    case 'a_relancer':     return { label: 'En cours', cls: 'bg-amber-100 text-amber-800 border-amber-300',         icon: '⏳' };
    case 'liste_attente':  return { label: 'Liste d\'attente', cls: 'bg-violet-100 text-violet-800 border-violet-300', icon: '⏳' };
    case 'refuse':         return { label: 'Refusée',  cls: 'bg-red-100 text-red-800 border-red-300',               icon: '❌' };
    case 'annule':         return { label: 'Annulée',  cls: 'bg-slate-100 text-slate-600 border-slate-300',         icon: '⛔' };
    default:               return { label: 'En cours', cls: 'bg-amber-100 text-amber-800 border-amber-300',         icon: '⏳' };
  }
}

function rankLabel(priority) {
  if (priority === 1) return 'Site 1';
  if (priority === 2) return 'Site 2';
  if (priority === 3) return 'Site 3';
  return `Site ${priority || '?'}`;
}

function Chip({ ok, partial = false, label, missing, onClick, sectionKey }) {
  const icon = ok ? '✅' : partial ? '⏳' : (missing ? '⚠️' : '❌');
  const cls = ok
    ? 'text-emerald-700 hover:bg-emerald-50 border-emerald-200'
    : partial
    ? 'text-amber-700 hover:bg-amber-50 border-amber-200'
    : 'text-rose-700 hover:bg-rose-50 border-rose-200';
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick && onClick(sectionKey); }}
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border bg-white text-[11px] font-medium transition ${cls}`}
      title={`Aller au bloc ${label}`}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

export default function MultiCandidaturesHeader({
  allSites = [],
  activeRegId = null,
  orgName = '',
  globalPercent = null,
  onSwitchSite,
  onJumpTo,
}) {
  // Sites triés par priorité ASC, exclus refusés/annulés affichés en bas
  const sorted = [...(allSites || [])].sort((a, b) => {
    const aPrio = (a.site_priority || 99);
    const bPrio = (b.site_priority || 99);
    if (aPrio !== bPrio) return aPrio - bPrio;
    return (a.venue?.name || '').localeCompare(b.venue?.name || '');
  });

  // Pré-calcul des statuts résumés
  const cards = sorted.map((s) => {
    const sti = statusInfo(s.status);
    const hasStand = !!s.stand_code;
    const days = Array.isArray(s.attending_days) ? s.attending_days : [];
    // 🔧 SESSION 52c — Format DB = 'vendredi'/'samedi' (pas ISO date)
    const hasVen = days.includes('vendredi');
    const hasSam = days.includes('samedi');
    // Animations par jour
    const animVen = !!s.has_vendredi_animation;
    const animSam = !!s.has_samedi_animation;
    // Convention / assurance
    const convOk = !!s.is_convention_signed;
    const assOk = !!s.is_insurance_uploaded;
    const cautionOk = !!s.is_deposit_received;
    // Complet global ?
    const isComplete = !!s.is_complete && !!s.can_submit;
    return { s, sti, hasStand, days, hasVen, hasSam, animVen, animSam, convOk, assOk, cautionOk, isComplete };
  });

  return (
    <div
      className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm"
      data-testid="multi-candidatures-header"
    >
      {/* En-tête global (org + complétion globale) */}
      <div className="max-w-5xl mx-auto px-3 py-2 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="w-8 h-8 rounded-full bg-aracom-orange text-white flex items-center justify-center text-sm font-bold shrink-0">
            {(orgName || '?').charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="font-bold text-sm text-slate-900 truncate">{orgName || 'Mon dossier'}</div>
            <div className="text-[10px] text-slate-500">
              {cards.length} candidature{cards.length > 1 ? 's' : ''}
              {globalPercent != null && ` · ${globalPercent}% global`}
            </div>
          </div>
        </div>
        {/* Légende rapide */}
        <div className="hidden md:flex items-center gap-1 text-[10px] text-slate-500">
          <span className="inline-flex items-center gap-0.5">✅ OK</span>
          <span className="inline-flex items-center gap-0.5 ml-1.5">⚠️ Manquant</span>
          <span className="inline-flex items-center gap-0.5 ml-1.5">⏳ En attente</span>
        </div>
      </div>

      {/* UNE LIGNE PAR CANDIDATURE */}
      <div className="max-w-5xl mx-auto px-2 pb-2 space-y-1">
        {cards.length === 0 && (
          <div className="text-center text-slate-500 text-xs py-2 italic">Aucune candidature pour l&apos;instant</div>
        )}
        {cards.map(({ s, sti, hasStand, days, animVen, animSam, convOk, assOk, cautionOk, isComplete }) => {
          const isActive = s.id === activeRegId;
          return (
            <button
              key={s.id}
              onClick={() => onSwitchSite && onSwitchSite(s.id)}
              className={`w-full text-left rounded-lg border px-2.5 py-1.5 transition flex items-center gap-2 flex-wrap ${
                isActive
                  ? 'bg-aracom-orange/5 border-aracom-orange ring-2 ring-aracom-orange/30 shadow-sm'
                  : 'bg-white border-slate-200 hover:bg-slate-50'
              }`}
              data-testid={`candidature-line-${s.id}`}
            >
              {/* Rang + Site name */}
              <div className="flex items-center gap-1.5 min-w-0 flex-1 max-w-[42%]">
                <Badge variant="outline" className={`text-[10px] font-bold ${isActive ? 'border-aracom-orange text-aracom-orange' : 'border-slate-300 text-slate-600'}`}>
                  {rankLabel(s.site_priority)}
                </Badge>
                {s.is_user_priority && (
                  <Star className="w-3 h-3 fill-amber-400 text-amber-500 shrink-0" />
                )}
                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="font-semibold text-[12.5px] text-slate-900 truncate">
                  {s.venue?.name || '—'}
                </span>
              </div>

              {/* Statut */}
              <Badge className={`text-[10px] ${sti.cls} shrink-0`} title={sti.label}>
                {sti.icon} {sti.label}
              </Badge>

              {/* Résumé synthétique CLIQUABLE */}
              <div className="flex flex-wrap items-center gap-1 ml-auto">
                <Chip
                  ok={hasStand}
                  missing={!hasStand}
                  label={hasStand ? `Stand ${s.stand_code}` : (s.is_waitlist ? 'Waitlist' : 'Stand')}
                  partial={s.is_waitlist}
                  onClick={onJumpTo}
                  sectionKey="stand"
                />
                <Chip
                  ok={animVen && days.includes('vendredi')}
                  partial={!days.includes('vendredi') && animSam}
                  missing={days.includes('vendredi') && !animVen}
                  label="Anim Ven"
                  onClick={onJumpTo}
                  sectionKey="planning"
                />
                <Chip
                  ok={animSam && days.includes('samedi')}
                  partial={!days.includes('samedi') && animVen}
                  missing={days.includes('samedi') && !animSam}
                  label="Anim Sam"
                  onClick={onJumpTo}
                  sectionKey="planning"
                />
                <Chip
                  ok={convOk}
                  missing={!convOk}
                  label="Convention"
                  onClick={onJumpTo}
                  sectionKey="documents"
                />
                {!assOk && (
                  <Chip
                    ok={false}
                    missing
                    label="Assurance"
                    onClick={onJumpTo}
                    sectionKey="documents"
                  />
                )}
              </div>

              {/* Pastille "complet" ou flèche */}
              {isComplete ? (
                <Badge className="bg-emerald-600 text-white border-emerald-700 text-[10px] gap-0.5 shrink-0">
                  <Check className="w-2.5 h-2.5" /> Complet
                </Badge>
              ) : (
                <ChevronRight className={`w-4 h-4 ${isActive ? 'text-aracom-orange' : 'text-slate-300'} shrink-0`} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

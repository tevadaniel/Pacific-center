'use client';

import { useEffect, useState } from 'react';
import { Calendar, MapPin, ShieldCheck, ListChecks, Sparkles, ChevronDown, ChevronUp, X, BookOpen } from 'lucide-react';
import { CONVENTION_CONFIG } from '@/lib/convention-config';

/**
 * 🆕 SESSION 48e — Bandeau de Bienvenue & Récap Convention
 *
 * Affiché en haut du portail exposant. Donne en UN COUP D'ŒIL :
 *   1. Mot de bienvenue + présentation rapide du Forum
 *   2. Dates / lieu / public ciblé
 *   3. Obligations mutuelles ARACOM ↔ Exposant
 *   4. Parcours à suivre (étapes pour finaliser sa participation)
 *
 * - Repliable (collapse) + état persistant via localStorage
 * - Auto-collapse si l'exposant est déjà verrouillé (workflow terminé)
 * - Compact, design system aracom (orange + slate)
 */
export default function WelcomeRecapBanner({ organization, registration, isLocked, activeVenues = [] }) {
  // 🆕 SESSION 48l — Replié par défaut pour ne pas surcharger le portail exposant
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const orgName = organization?.name || '';
  const firstName = organization?.first_name || organization?.contact_name?.split(' ')[0] || '';

  // 🆕 Liste dynamique de sites actifs (passée en prop, fallback CONVENTION_CONFIG)
  const venuesList = Array.isArray(activeVenues) && activeVenues.length > 0
    ? activeVenues
    : [];
  const venueCount = venuesList.length || 6;
  const venueNames = venuesList.length > 0
    ? venuesList.map(v => v.name).join(' · ')
    : 'À définir';

  // Restaure la préférence et auto-ferme si déjà verrouillé
  useEffect(() => {
    try {
      const stored = localStorage.getItem('exposant_welcome_open');
      if (isLocked) {
        setOpen(false);
      } else if (stored !== null) {
        // 🆕 SESSION 48l — Respecte le choix utilisateur ; par défaut fermé (déjà géré par useState)
        setOpen(stored === '1');
      }
    } catch { /* ignore */ }
    setLoaded(true);
  }, [isLocked]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    try { localStorage.setItem('exposant_welcome_open', next ? '1' : '0'); } catch {}
  };

  const close = () => {
    setOpen(false);
    try { localStorage.setItem('exposant_welcome_open', '0'); } catch {}
  };

  if (!loaded) return null;

  // --- Vue REPLIÉE : compact bar
  if (!open) {
    return (
      <button
        onClick={toggle}
        className="w-full flex items-center gap-2 px-4 py-2 rounded-lg border border-aracom-orange/30 bg-gradient-to-r from-orange-50 to-amber-50 hover:from-orange-100 hover:to-amber-100 text-aracom-orange text-sm font-semibold transition-all"
      >
        <BookOpen className="w-4 h-4" />
        <span>📘 Bienvenue · Présentation, obligations & parcours</span>
        <ChevronDown className="w-4 h-4 ml-auto" />
      </button>
    );
  }

  // --- Vue DÉPLIÉE : full banner
  const dates = CONVENTION_CONFIG.forum_dates;
  const deadlineLabel = CONVENTION_CONFIG.cancellation_deadline_label;

  return (
    <div className="rounded-xl border-2 border-aracom-orange/40 bg-gradient-to-br from-orange-50 via-amber-50 to-white shadow-md overflow-hidden">
      {/* HEADER : bienvenue */}
      <div className="bg-gradient-to-r from-aracom-orange to-orange-600 text-white px-5 py-4 flex items-start gap-3">
        <div className="text-3xl">🎉</div>
        <div className="flex-1 min-w-0">
          <div className="text-lg sm:text-xl font-bold leading-tight">
            Bienvenue {firstName ? firstName + ' ' : ''}!
          </div>
          <p className="text-orange-100 text-sm mt-0.5 leading-snug">
            {orgName ? <><b className="text-white">{orgName}</b> participe au </> : 'Vous participez au '}
            <b className="text-white">Forum de la Rentrée 2026</b> · le rendez-vous incontournable
            entre <b className="text-white">familles</b>, <b className="text-white">jeunes</b> et <b className="text-white">structures locales</b> sur {venueCount} centre{venueCount > 1 ? 's' : ''} <b className="text-white">Pacific Centers</b> à Tahiti.
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={toggle}
            className="p-1.5 rounded-md hover:bg-white/20 transition"
            title="Replier"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
          <button
            onClick={close}
            className="p-1.5 rounded-md hover:bg-white/20 transition"
            title="Masquer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* CORPS : 3 colonnes de récap */}
      <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
        {/* COL 1 — DATES & LIEU */}
        <div className="rounded-lg bg-white border border-orange-200 p-3">
          <div className="flex items-center gap-2 text-aracom-orange font-bold text-xs uppercase tracking-wide mb-2">
            <Calendar className="w-4 h-4" /> L&apos;événement
          </div>
          <ul className="space-y-1.5 text-slate-700 text-xs leading-relaxed">
            {dates.map((d) => (
              <li key={d.date} className="flex items-baseline gap-1.5">
                <span className="text-aracom-orange">•</span>
                <span><b>{d.long_label}</b><br /><span className="text-slate-500">{d.start} – {d.end}</span></span>
              </li>
            ))}
            <li className="flex items-start gap-1.5 pt-1 mt-1 border-t border-orange-100">
              <MapPin className="w-3.5 h-3.5 text-aracom-orange shrink-0 mt-0.5" />
              <span><b>{venueCount} centre{venueCount > 1 ? 's' : ''} Pacific Centers</b>{venuesList.length > 0 ? ` : ${venueNames}` : ''}</span>
            </li>
          </ul>
        </div>

        {/* COL 2 — OBLIGATIONS MUTUELLES */}
        <div className="rounded-lg bg-white border border-orange-200 p-3">
          <div className="flex items-center gap-2 text-aracom-orange font-bold text-xs uppercase tracking-wide mb-2">
            <ShieldCheck className="w-4 h-4" /> Engagements
          </div>
          <div className="text-[11px] font-bold text-emerald-700 uppercase tracking-wide mb-1">ARACOM s&apos;engage à</div>
          <ul className="space-y-1 text-slate-700 text-xs leading-snug ml-1">
            <li>✓ Fournir une <b>table nappée noire</b></li>
            <li>✓ Remettre le <b>plan d&apos;implantation</b></li>
            <li>✓ Assurer <b>encadrement et suivi</b> sur site</li>
          </ul>
          <div className="text-[11px] font-bold text-rose-700 uppercase tracking-wide mt-2.5 mb-1">Vous vous engagez à</div>
          <ul className="space-y-1 text-slate-700 text-xs leading-snug ml-1">
            <li>✓ Être <b>présent</b> aux heures indiquées</li>
            <li>✓ Assurer une <b>animation</b> (1 par jour minimum)</li>
            <li>✓ Décorer à <b>votre image</b></li>
            <li>✓ Fournir <b>attestation d&apos;assurance</b> RC</li>
            <li>✓ Apporter le <b>matériel complémentaire</b></li>
            <li>✓ Verser <b>caution {CONVENTION_CONFIG.caution_label}</b></li>
          </ul>
        </div>

        {/* COL 3 — PARCOURS */}
        <div className="rounded-lg bg-white border border-orange-200 p-3">
          <div className="flex items-center gap-2 text-aracom-orange font-bold text-xs uppercase tracking-wide mb-2">
            <ListChecks className="w-4 h-4" /> Mon parcours en 5 étapes
          </div>
          <ol className="space-y-1.5 text-xs text-slate-700">
            <Step n={1} title="Compléter mon profil" desc="Identité, contact, description" />
            <Step n={2} title="Choisir mon stand" desc="1 site = 1 stand" />
            <Step n={3} title="Sélectionner mes animations" desc="1 obligatoire par jour" />
            <Step n={4} title="Déposer mes documents" desc="Convention + assurance" />
            <Step n={5} title="Soumettre à ARACOM" desc="Validation finale & caution" />
          </ol>
          <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 mt-2 leading-snug">
            ⏰ Annulation sans frais jusqu&apos;au <b>{deadlineLabel}</b>
          </div>
        </div>
      </div>

      {/* FOOTER : organisateur + agence d'exécution */}
      <div className="px-4 py-2 bg-white/60 border-t border-orange-200 text-[11px] text-slate-600 flex items-center gap-2 flex-wrap">
        <Sparkles className="w-3.5 h-3.5 text-aracom-orange" />
        <span>
          Organisé par <b>{CONVENTION_CONFIG.organizer.name}</b>
          {CONVENTION_CONFIG.agency?.name ? <> · Géré par <b>{CONVENTION_CONFIG.agency.name}</b></> : ''}
          {CONVENTION_CONFIG.agency?.contact_email && (
            <> · Contact : <a href={`mailto:${CONVENTION_CONFIG.agency.contact_email}`} className="text-aracom-orange underline">{CONVENTION_CONFIG.agency.contact_email}</a></>
          )}
        </span>
      </div>
    </div>
  );
}

function Step({ n, title, desc }) {
  return (
    <li className="flex items-start gap-2">
      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-aracom-orange text-white text-[10px] font-bold shrink-0 mt-0.5">{n}</span>
      <div className="leading-tight">
        <div className="font-semibold text-slate-800">{title}</div>
        <div className="text-[11px] text-slate-500">{desc}</div>
      </div>
    </li>
  );
}

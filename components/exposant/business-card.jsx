'use client';

/**
 * 🆔 BusinessCard — Carte de visite exposant (V2 lisibilité renforcée)
 *
 * Affichée en haut de l'onglet "Mon profil" du portail exposant.
 * - Typographie agrandie, contrastes renforcés
 * - Badges regroupés par catégorie (Lieu | Présence | Dossier admin)
 * - Anneau de progression plus grand et lisible
 */

import { Badge } from '@/components/ui/badge';
import {
  Building2, MapPin, Calendar, Hash, CheckCircle2, Clock,
  Wallet, FileCheck, Award, Users, Star,
} from 'lucide-react';

function getInitials(name = '') {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const STATUS_TONE = {
  a_confirmer:    { label: 'À confirmer',    color: 'bg-amber-100 text-amber-900 border-amber-400',     icon: Clock },
  contacte:       { label: 'Contacté',       color: 'bg-blue-100 text-blue-900 border-blue-400',         icon: Users },
  confirme:       { label: 'Confirmé',       color: 'bg-emerald-100 text-emerald-900 border-emerald-400', icon: CheckCircle2 },
  liste_attente:  { label: "Liste d'attente",color: 'bg-violet-100 text-violet-900 border-violet-400',   icon: Clock },
  annule:         { label: 'Annulé',         color: 'bg-rose-100 text-rose-900 border-rose-400',         icon: Clock },
  prospect:       { label: 'Prospect',       color: 'bg-slate-100 text-slate-800 border-slate-400',      icon: Users },
};

export default function BusinessCard({
  organization = {},
  registration = {},
  venue,
  slots = [],
  animationsCount = 0,
  deposit,
  progress = 0,
  sitePriority = null,   // 🆕 numéro de site (1=★ prioritaire, 2, 3…)
  totalSites = 1,
}) {
  const fullName = [organization.first_name, organization.last_name].filter(Boolean).join(' ').trim()
    || organization.contact_name
    || '';
  const orgName = organization.name || 'Sans nom';
  const initials = getInitials(orgName);
  const discipline = organization.discipline || 'Discipline non précisée';
  const status = STATUS_TONE[registration.status] || STATUS_TONE.a_confirmer;
  const StatusIcon = status.icon;

  const standCode = registration.stand_code;
  const venueName = venue?.name;
  const cautionReceived = !!(deposit?.received_at || registration.caution_received_date);
  const conventionSigned = !!registration.is_convention_signed;
  const insuranceReceived = !!registration.is_insurance_uploaded;
  const days = Array.isArray(registration.attending_days)
    ? registration.attending_days
    : (registration.days_present ? registration.days_present.split(',') : []);

  const isPrimary = sitePriority === 1 || sitePriority === null;

  return (
    <div className="relative overflow-hidden rounded-2xl border-2 border-orange-200 bg-gradient-to-br from-white via-orange-50/60 to-amber-50/80 shadow-md p-6">
      {/* Décor subtil */}
      <div className="absolute top-0 right-0 w-40 h-40 bg-orange-500/10 rounded-full -translate-y-16 translate-x-16" aria-hidden></div>
      <div className="absolute bottom-0 left-0 w-32 h-32 bg-amber-500/10 rounded-full translate-y-14 -translate-x-14" aria-hidden></div>

      <div className="relative flex flex-col md:flex-row gap-5 items-start">
        {/* ── Avatar agrandi ── */}
        <div className="shrink-0 w-20 h-20 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 text-white flex items-center justify-center text-2xl font-extrabold shadow-lg ring-4 ring-white">
          {initials}
        </div>

        {/* ── Identité ── */}
        <div className="flex-1 min-w-0">
          {/* Ligne 1 : Nom + Statut + Badge "Site N" */}
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <h2 className="text-2xl font-extrabold text-slate-900 truncate leading-tight">{orgName}</h2>
            <Badge className={`${status.color} border text-xs font-semibold gap-1 px-2 py-0.5`}>
              <StatusIcon className="w-3.5 h-3.5" /> {status.label}
            </Badge>
            {totalSites > 1 && (
              <Badge className={`text-xs font-semibold px-2 py-0.5 border ${isPrimary ? 'bg-amber-100 text-amber-900 border-amber-400' : 'bg-slate-100 text-slate-700 border-slate-300'}`} title={isPrimary ? 'Site prioritaire' : `Site secondaire ${sitePriority}`}>
                {isPrimary ? <><Star className="w-3.5 h-3.5 inline -mt-0.5 fill-amber-500 text-amber-500" /> Site 1 — Prioritaire</> : `Site ${sitePriority}`}
              </Badge>
            )}
          </div>

          {/* Ligne 2 : Référent + Discipline */}
          <div className="text-sm text-slate-700 mb-4 flex items-center gap-2 flex-wrap font-medium">
            <span>{fullName || <span className="italic text-slate-500">Référent à compléter</span>}</span>
            {organization.position && <><span className="text-slate-400">·</span><span>{organization.position}</span></>}
            <span className="text-slate-400">·</span>
            <span className="italic text-slate-600">{discipline}</span>
          </div>

          {/* ── BADGES par groupes ── */}
          <div className="space-y-2">
            {/* Groupe 1 : Lieu & Stand */}
            <div className="flex flex-wrap gap-2 text-sm">
              {venueName ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border-2 border-orange-200 text-slate-800 shadow-sm font-medium">
                  <MapPin className="w-4 h-4 text-orange-600" /> <b>{venueName}</b>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 border-2 border-slate-200 text-slate-600 italic">
                  <MapPin className="w-4 h-4" /> Site à choisir
                </span>
              )}
              {standCode ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border-2 border-blue-200 text-slate-800 shadow-sm font-medium">
                  <Hash className="w-4 h-4 text-blue-600" /> Stand <b className="font-mono">{standCode}</b>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 border-2 border-slate-200 text-slate-600 italic">
                  <Hash className="w-4 h-4" /> Stand à choisir
                </span>
              )}
              {days.length > 0 && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border-2 border-emerald-200 text-slate-800 shadow-sm font-medium">
                  <Calendar className="w-4 h-4 text-emerald-600" /> {days.length === 2 ? '2 jours' : days.map(d => d.charAt(0).toUpperCase() + d.slice(1)).join(' & ')}
                </span>
              )}
              {animationsCount > 0 ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border-2 border-violet-200 text-slate-800 shadow-sm font-medium">
                  <Award className="w-4 h-4 text-violet-600" /> {animationsCount} animation{animationsCount > 1 ? 's' : ''}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 border-2 border-slate-200 text-slate-600 italic">
                  <Award className="w-4 h-4" /> Aucune animation
                </span>
              )}
            </div>

            {/* Groupe 2 : Dossier admin (Convention / Assurance / Caution) */}
            <div className="flex flex-wrap gap-2 text-sm">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-2 shadow-sm font-medium ${conventionSigned ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-amber-50 border-amber-300 text-amber-800'}`}>
                <FileCheck className="w-4 h-4" /> {conventionSigned ? 'Convention signée' : 'Convention à signer'}
              </span>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-2 shadow-sm font-medium ${insuranceReceived ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-amber-50 border-amber-300 text-amber-800'}`}>
                <Building2 className="w-4 h-4" /> {insuranceReceived ? 'Assurance reçue' : 'Assurance à déposer'}
              </span>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-2 shadow-sm font-medium ${cautionReceived ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-blue-50 border-blue-300 text-blue-800'}`}>
                <Wallet className="w-4 h-4" /> {cautionReceived ? 'Caution reçue' : '20 000 XPF à verser'}
              </span>
            </div>
          </div>
        </div>

        {/* ── Progression dossier (anneau agrandi) ── */}
        <div className="shrink-0 flex flex-col items-center md:items-end gap-1.5 min-w-[110px]">
          <div className="relative w-24 h-24">
            <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="16" fill="none" stroke="#FED7AA" strokeWidth="3.5" />
              <circle
                cx="18" cy="18" r="16" fill="none"
                stroke="#F97316" strokeWidth="3.5" strokeLinecap="round"
                strokeDasharray={`${(progress / 100) * 100.53} 100.53`}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-extrabold text-orange-600 leading-none">{progress}%</span>
            </div>
          </div>
          <span className="text-[11px] uppercase tracking-wider text-slate-600 font-bold">Dossier complet</span>
        </div>
      </div>
    </div>
  );
}

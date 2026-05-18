'use client';

/**
 * 🆔 BusinessCard — Carte de visite exposant
 *
 * Affichée en haut de l'onglet "Mon profil" du portail exposant.
 * Style : carte stylisée avec avatar initiales + nom + discipline + mini-badges
 *         résumant la réservation (stand, site, animations, statut, dossier %)
 */

import { Badge } from '@/components/ui/badge';
import { Building2, MapPin, Calendar, Hash, CheckCircle2, Clock, Wallet, FileCheck, Award, Users } from 'lucide-react';

function getInitials(name = '') {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const STATUS_TONE = {
  a_confirmer: { label: 'À confirmer', color: 'bg-amber-100 text-amber-800 border-amber-300', icon: Clock },
  contacte: { label: 'Contacté', color: 'bg-blue-100 text-blue-800 border-blue-300', icon: Users },
  confirme: { label: 'Confirmé', color: 'bg-emerald-100 text-emerald-800 border-emerald-300', icon: CheckCircle2 },
  liste_attente: { label: 'Liste d\'attente', color: 'bg-violet-100 text-violet-800 border-violet-300', icon: Clock },
  annule: { label: 'Annulé', color: 'bg-rose-100 text-rose-800 border-rose-300', icon: Clock },
  prospect: { label: 'Prospect', color: 'bg-slate-100 text-slate-700 border-slate-300', icon: Users },
};

export default function BusinessCard({ organization = {}, registration = {}, venue, slots = [], animationsCount = 0, checks = [], deposit, progress = 0 }) {
  const fullName = [organization.first_name, organization.last_name].filter(Boolean).join(' ').trim()
    || organization.contact_name
    || '—';
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

  // Group slots by day
  const slotsByDay = {};
  for (const sl of slots) {
    const day = sl.event_day || sl.day || 'autre';
    if (!slotsByDay[day]) slotsByDay[day] = [];
    slotsByDay[day].push(sl);
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border-2 border-orange-200 bg-gradient-to-br from-white via-orange-50/40 to-amber-50/60 shadow-md p-5">
      {/* Décor en haut à droite */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 rounded-full -translate-y-12 translate-x-12" aria-hidden></div>
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-amber-500/10 rounded-full translate-y-10 -translate-x-10" aria-hidden></div>

      <div className="relative flex flex-col md:flex-row gap-4 items-start">
        {/* ── Avatar ── */}
        <div className="shrink-0 w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 text-white flex items-center justify-center text-xl font-bold shadow-lg ring-4 ring-white">
          {initials}
        </div>

        {/* ── Identité ── */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h2 className="text-xl font-bold text-slate-900 truncate">{orgName}</h2>
            <Badge className={`${status.color} border text-[10px] gap-1`}>
              <StatusIcon className="w-3 h-3" /> {status.label}
            </Badge>
          </div>
          <div className="text-sm text-slate-600 mb-3 flex items-center gap-2 flex-wrap">
            <span className="font-medium">{fullName !== '—' ? fullName : 'Référent à compléter'}</span>
            {organization.position && <span className="text-slate-400">·</span>}
            {organization.position && <span>{organization.position}</span>}
            <span className="text-slate-400">·</span>
            <span className="italic">{discipline}</span>
          </div>

          {/* ── MINI-BADGES : Réservation Stand & Animation ── */}
          <div className="flex flex-wrap gap-1.5 text-xs">
            {/* Site */}
            {venueName ? (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white border border-slate-200 text-slate-700 shadow-sm">
                <MapPin className="w-3 h-3 text-orange-500" /> <b>{venueName}</b>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-100 border border-slate-200 text-slate-500 italic">
                <MapPin className="w-3 h-3" /> Site à choisir
              </span>
            )}

            {/* Stand */}
            {standCode ? (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white border border-slate-200 text-slate-700 shadow-sm">
                <Hash className="w-3 h-3 text-blue-500" /> Stand <b className="font-mono">{standCode}</b>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-100 border border-slate-200 text-slate-500 italic">
                <Hash className="w-3 h-3" /> Stand à choisir
              </span>
            )}

            {/* Jours présence */}
            {days.length > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white border border-slate-200 text-slate-700 shadow-sm">
                <Calendar className="w-3 h-3 text-emerald-500" /> {days.length === 2 ? '2 jours' : days.join(', ')}
              </span>
            )}

            {/* Animations */}
            {animationsCount > 0 ? (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white border border-slate-200 text-slate-700 shadow-sm">
                <Award className="w-3 h-3 text-violet-500" /> {animationsCount} animation{animationsCount > 1 ? 's' : ''}
                {Object.keys(slotsByDay).length > 1 && <span className="text-slate-400">· {Object.keys(slotsByDay).length}j</span>}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-100 border border-slate-200 text-slate-500 italic">
                <Award className="w-3 h-3" /> Aucune animation
              </span>
            )}

            {/* Convention */}
            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border shadow-sm ${conventionSigned ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
              <FileCheck className="w-3 h-3" /> {conventionSigned ? 'Convention signée' : 'Convention à signer'}
            </span>

            {/* Assurance */}
            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border shadow-sm ${insuranceReceived ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
              <Building2 className="w-3 h-3" /> {insuranceReceived ? 'Assurance reçue' : 'Assurance à déposer'}
            </span>

            {/* Caution */}
            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border shadow-sm ${cautionReceived ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-blue-50 border-blue-200 text-blue-700'}`}>
              <Wallet className="w-3 h-3" /> {cautionReceived ? 'Caution reçue' : '20 000 XPF à verser'}
            </span>
          </div>
        </div>

        {/* ── Progression dossier ── */}
        <div className="shrink-0 flex flex-col items-center md:items-end gap-1 min-w-[100px]">
          <div className="relative w-20 h-20">
            <svg className="w-20 h-20 transform -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="16" fill="none" stroke="#FED7AA" strokeWidth="3" />
              <circle
                cx="18" cy="18" r="16" fill="none"
                stroke="#F97316" strokeWidth="3" strokeLinecap="round"
                strokeDasharray={`${(progress / 100) * 100.53} 100.53`}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-bold text-orange-600">{progress}%</span>
            </div>
          </div>
          <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Dossier complet</span>
        </div>
      </div>
    </div>
  );
}

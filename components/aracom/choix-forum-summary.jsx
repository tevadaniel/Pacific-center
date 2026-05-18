'use client';

import { MapPin, Tag, Calendar, Sparkles, Lock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

/**
 * 🎯 RÉSUMÉ "CHOIX FORUM" — Affiché en haut de la fiche exposant
 *
 * Lecture rapide pour les admins ARACOM :
 *  - Site / Stand (numéro, zone, surface)
 *  - Animations verrouillées (titre, jour, créneau, type)
 *  - Statut candidature (verrouillée ou non)
 */
export default function ChoixForumSummary({ data }) {
  if (!data?.registration) return null;
  const r = data.registration;
  const v = data.venue;
  const slots = data.slots || [];
  const stand = data.stand_assignment || null;

  // Détails du stand (numéro + zone + surface) à partir des données disponibles
  const standCode = r.stand_code;
  const standZone = stand?.zone || stand?.zone_label || r.stand_zone;
  const standSurface = stand?.surface_m2 || stand?.area_m2 || r.stand_surface;

  const slotsVendredi = slots.filter(s => s.day_label === 'vendredi');
  const slotsSamedi = slots.filter(s => s.day_label === 'samedi');

  const isLocked = !!r.candidature_locked;
  const isDepositLocked = !!r.is_locked;

  return (
    <div className={`rounded-lg border-2 p-4 ${isLocked || isDepositLocked ? 'border-violet-200 bg-gradient-to-br from-violet-50 to-blue-50' : 'border-slate-200 bg-gradient-to-br from-slate-50 to-white'}`}>
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="font-bold text-sm flex items-center gap-2 text-slate-900">
          <Sparkles className="w-4 h-4 text-violet-600" /> Résumé Choix Forum
        </div>
        <div className="flex gap-1.5">
          {isDepositLocked && (
            <Badge className="bg-emerald-600 text-white text-[10px] gap-1">
              <Lock className="w-3 h-3" /> Caution reçue
            </Badge>
          )}
          {isLocked && !isDepositLocked && (
            <Badge className="bg-violet-600 text-white text-[10px] gap-1">
              <Lock className="w-3 h-3" /> Candidature verrouillée
            </Badge>
          )}
          {!isLocked && !isDepositLocked && (
            <Badge variant="outline" className="text-[10px] border-slate-300 text-slate-600">
              Modifiable
            </Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Bloc Stand */}
        <div className="rounded-md bg-white/80 border border-violet-100 p-3">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-violet-700 font-bold mb-1">
            <MapPin className="w-3 h-3" /> Stand & site
          </div>
          {standCode ? (
            <>
              <div className="text-lg font-bold font-mono text-slate-900 leading-tight">
                {standCode}
              </div>
              <div className="text-xs text-slate-700 mt-0.5">
                {v?.name || '— Site non défini —'}
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {standZone && <Badge variant="outline" className="text-[10px] border-blue-300 text-blue-700">Zone {standZone}</Badge>}
                {standSurface && <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700">{standSurface} m²</Badge>}
              </div>
            </>
          ) : (
            <div className="text-sm text-slate-400 italic mt-1">Aucun stand pré-réservé</div>
          )}
        </div>

        {/* Bloc Animations */}
        <div className="rounded-md bg-white/80 border border-violet-100 p-3">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-violet-700 font-bold mb-1">
            <Calendar className="w-3 h-3" /> Animations ({slots.length})
          </div>
          {slots.length === 0 ? (
            <div className="text-sm text-slate-400 italic mt-1">Aucun créneau choisi</div>
          ) : (
            <div className="space-y-1.5 mt-1">
              {slotsVendredi.length > 0 && (
                <div className="text-xs">
                  <span className="text-slate-500 font-medium">Ven. 14 août :</span>{' '}
                  {slotsVendredi.map(s => (
                    <span key={s.id} className="inline-block mr-1.5">
                      <span className="font-medium text-slate-800">{s.title || 'Sans nom'}</span>
                      <span className="text-slate-500"> ({s.start_time}–{s.end_time})</span>
                    </span>
                  ))}
                </div>
              )}
              {slotsSamedi.length > 0 && (
                <div className="text-xs">
                  <span className="text-slate-500 font-medium">Sam. 15 août :</span>{' '}
                  {slotsSamedi.map(s => (
                    <span key={s.id} className="inline-block mr-1.5">
                      <span className="font-medium text-slate-800">{s.title || 'Sans nom'}</span>
                      <span className="text-slate-500"> ({s.start_time}–{s.end_time})</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
          {slots.length > 0 && (
            <div className="flex gap-1.5 mt-2 flex-wrap">
              {slotsVendredi.length > 0 && (
                <Badge variant="outline" className="text-[10px] border-violet-300 text-violet-700">
                  Ven : {slotsVendredi.length} créneau{slotsVendredi.length > 1 ? 'x' : ''}
                </Badge>
              )}
              {slotsSamedi.length > 0 && (
                <Badge variant="outline" className="text-[10px] border-violet-300 text-violet-700">
                  Sam : {slotsSamedi.length} créneau{slotsSamedi.length > 1 ? 'x' : ''}
                </Badge>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

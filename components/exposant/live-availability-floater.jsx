'use client';

import { useEffect, useState } from 'react';
import { MapPin, X } from 'lucide-react';

/**
 * 🆕 SESSION 45 — Bulle flottante de disponibilité en temps réel
 *
 * - Position : bottom-left (le chatbot occupe bottom-right)
 * - Au repos : petite pastille ronde discrète avec le total de stands libres
 * - Au clic  : panneau détaillé par site (stands libres + créneaux d'animation libres)
 * - Refresh automatique toutes les 60 s via /api/wizard/availability (public, pas d'auth)
 */
export default function LiveAvailabilityFloater() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);

  const load = async () => {
    try {
      const r = await fetch('/api/wizard/availability', { cache: 'no-store' });
      if (!r.ok) throw new Error('availability failed');
      const j = await r.json();
      setData(j);
      setLastUpdate(new Date());
      setErr(null);
    } catch (e) {
      setErr(e.message);
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, []);

  // Recharge à chaque ouverture pour valeurs fraîches
  useEffect(() => {
    if (open) load();
  }, [open]);

  const venues = Array.isArray(data?.venues) ? data.venues : [];

  // Total stands libres (toutes venues confondues)
  const totalStandsFree = venues.reduce((acc, v) => {
    const free = Math.max(0, (v.capacity_stands || 0) - (v.stands_used || 0));
    return acc + free;
  }, 0);

  // Total créneaux animation libres
  const totalAnimFree = venues.reduce((acc, v) => {
    const grid = v.animation_grid || {};
    for (const day of Object.keys(grid)) {
      const g = grid[day] || {};
      const slots = Array.isArray(g.slots) ? g.slots : [];
      acc += slots.filter((s) => !s.occupied).length;
    }
    return acc;
  }, 0);

  return (
    <>
      {/* ─── Bouton flottant (au repos) ─── */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Voir la disponibilité en temps réel"
          className="fixed bottom-5 left-5 z-[890] flex items-center gap-2 rounded-full bg-white/95 backdrop-blur border border-slate-200 shadow-lg hover:shadow-xl hover:bg-white hover:scale-[1.02] active:scale-95 transition-all px-3 py-2 group"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <MapPin className="w-4 h-4 text-slate-600 group-hover:text-emerald-600 transition-colors" />
          <span className="text-[11px] font-semibold text-slate-700 leading-none">
            {totalStandsFree} stand{totalStandsFree > 1 ? 's' : ''} · {totalAnimFree} créneaux
          </span>
        </button>
      )}

      {/* ─── Panneau ouvert ─── */}
      {open && (
        <div className="fixed bottom-5 left-5 z-[890] w-[320px] max-w-[calc(100vw-24px)] max-h-[70vh] overflow-hidden rounded-xl shadow-2xl border border-slate-200 bg-white animate-in slide-in-from-bottom-2 duration-150 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between gap-2 px-3 py-2 bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-emerald-100">
            <div className="flex items-center gap-2 min-w-0">
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <div className="min-w-0">
                <div className="text-[11px] font-bold text-emerald-900 leading-tight">Disponibilité en direct</div>
                <div className="text-[9px] text-slate-500 leading-tight truncate">
                  {lastUpdate ? `MAJ ${lastUpdate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : '…'}
                  {' · '}toutes les 60s
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Fermer"
              className="text-slate-400 hover:text-slate-700 hover:bg-white/60 rounded p-1 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Liste */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {err && (
              <div className="text-[11px] text-red-600 bg-red-50 border border-red-200 rounded p-2">
                {err}
              </div>
            )}
            {!err && venues.length === 0 && (
              <div className="text-[11px] text-slate-500 text-center py-4">Chargement…</div>
            )}
            {venues.map((v) => {
              const grid = v.animation_grid || {};
              const animFreeVen = Object.keys(grid).reduce((acc, d) => {
                const slots = Array.isArray(grid[d]?.slots) ? grid[d].slots : [];
                return acc + slots.filter((s) => !s.occupied).length;
              }, 0);
              const animFreeFri = (grid.vendredi?.slots || []).filter((s) => !s.occupied).length;
              const animFreeSat = (grid.samedi?.slots || []).filter((s) => !s.occupied).length;
              const standsFree = Math.max(0, (v.capacity_stands || 0) - (v.stands_used || 0));
              const standsTotal = v.capacity_stands || 0;
              const noStands = standsFree === 0;
              const noAnims = animFreeVen === 0;
              return (
                <div
                  key={v.id}
                  className={`rounded-md border px-2 py-1.5 ${(noStands && noAnims) ? 'bg-slate-50 border-slate-200' : 'bg-white border-slate-200 hover:border-emerald-300'}`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="text-[11px] font-bold text-slate-800 truncate">{v.name}</div>
                    <div className="text-[9px] text-slate-400 shrink-0">{v.code}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    <div
                      className={`rounded text-center py-1 ${
                        noStands ? 'bg-slate-100 text-slate-400' :
                        standsFree <= 3 ? 'bg-amber-50 text-amber-800' :
                        'bg-emerald-50 text-emerald-800'
                      }`}
                      title={`${standsFree} stand(s) libre(s) sur ${standsTotal}`}
                    >
                      <div className="text-[14px] font-bold leading-none">{standsFree}</div>
                      <div className="text-[8px] uppercase tracking-wide mt-0.5">stands libres</div>
                    </div>
                    <div
                      className={`rounded text-center py-1 ${
                        noAnims ? 'bg-slate-100 text-slate-400' :
                        animFreeVen <= 3 ? 'bg-amber-50 text-amber-800' :
                        'bg-violet-50 text-violet-800'
                      }`}
                      title={`Vendredi: ${animFreeFri} · Samedi: ${animFreeSat}`}
                    >
                      <div className="text-[14px] font-bold leading-none">{animFreeVen}</div>
                      <div className="text-[8px] uppercase tracking-wide mt-0.5">créneaux anim.</div>
                    </div>
                  </div>
                  {(animFreeFri >= 0 || animFreeSat >= 0) && (
                    <div className="flex items-center justify-between text-[9px] text-slate-500 mt-1 px-0.5">
                      <span>Ven : <b className={animFreeFri === 0 ? 'text-slate-400' : 'text-slate-700'}>{animFreeFri}</b></span>
                      <span>Sam : <b className={animFreeSat === 0 ? 'text-slate-400' : 'text-slate-700'}>{animFreeSat}</b></span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="px-3 py-1.5 border-t border-slate-100 bg-slate-50 text-[9px] text-slate-500 text-center leading-snug">
            Les créneaux d&apos;animation sont calculés dynamiquement par site.
          </div>
        </div>
      )}
    </>
  );
}

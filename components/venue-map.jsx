'use client';

import { useMemo, useState } from 'react';
import { MapPin, DoorOpen, Music, Search, Filter } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

/**
 * VenueMap — Carte interactive schématique d'un site du forum.
 * Affiche les stands en rangées disposées comme un vrai plan :
 *   ┌──────── ENTRÉE ────────┐
 *   │  Rangée A (stands 1..N/2)  │
 *   │       — allée centrale —    │
 *   │  Rangée B (stands N/2+1..N) │
 *   └─────── SCÈNE / ANIM. ──────┘
 *
 * Props:
 *   stands            : [{ id, stand_code, organization, registration_status, ... }]
 *   venue             : { id, name }
 *   highlightRegId    : string — met en évidence le stand d'un exposant particulier (via registration_id)
 *   highlightStandCode: string — met en évidence par code de stand (ex. "A-C01")
 *   onStandClick      : (stand) => void — si défini, les stands sont cliquables
 *   showFilters       : bool (default true)
 *   compact           : bool — mode compact pour petit écran
 */
export default function VenueMap({ stands = [], venue, highlightRegId, highlightStandCode, onStandClick, showFilters = true, compact = false }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const rows = useMemo(() => splitInRows(stands), [stands]);

  const matchesFilters = (s) => {
    if (statusFilter !== 'all') {
      const st = s.organization ? (s.registration_status || 'prospect') : 'libre';
      if (st !== statusFilter) return false;
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      const hit = (s.stand_code || '').toLowerCase().includes(q) ||
        (s.organization?.name || '').toLowerCase().includes(q) ||
        (s.organization?.discipline || '').toLowerCase().includes(q);
      if (!hit) return false;
    }
    return true;
  };

  const counts = useMemo(() => {
    const c = { confirme: 0, a_confirmer: 0, a_relancer: 0, prospect: 0, libre: 0 };
    stands.forEach(s => {
      const st = s.organization ? (s.registration_status || 'prospect') : 'libre';
      if (c[st] !== undefined) c[st]++;
    });
    return c;
  }, [stands]);

  return (
    <div className="space-y-3">
      {showFilters && (
        <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input placeholder="Rechercher un stand ou un exposant…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
          </div>
          <div className="flex flex-wrap gap-1.5">
            <FilterChip label="Tous" count={stands.length} active={statusFilter === 'all'} onClick={() => setStatusFilter('all')} />
            <FilterChip label="Confirmés" count={counts.confirme} color="emerald" active={statusFilter === 'confirme'} onClick={() => setStatusFilter('confirme')} />
            <FilterChip label="À confirmer" count={counts.a_confirmer} color="amber" active={statusFilter === 'a_confirmer'} onClick={() => setStatusFilter('a_confirmer')} />
            <FilterChip label="À relancer" count={counts.a_relancer} color="orange" active={statusFilter === 'a_relancer'} onClick={() => setStatusFilter('a_relancer')} />
            <FilterChip label="Prospects" count={counts.prospect} color="slate" active={statusFilter === 'prospect'} onClick={() => setStatusFilter('prospect')} />
            <FilterChip label="Libres" count={counts.libre} color="white" active={statusFilter === 'libre'} onClick={() => setStatusFilter('libre')} />
          </div>
        </div>
      )}

      {/* Plan du site */}
      <div className="relative rounded-2xl border-2 border-dashed border-slate-300 bg-gradient-to-br from-slate-50 via-white to-blue-50/30 p-4 md:p-6 overflow-hidden">
        {/* Header — Entrée */}
        <div className="flex items-center justify-center mb-4">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-600 text-white text-xs font-semibold shadow-md">
            <DoorOpen className="w-3.5 h-3.5" />
            ENTRÉE — {venue?.name || 'Site'}
          </div>
        </div>

        <div className="space-y-4">
          {rows.map((row, rowIdx) => (
            <div key={rowIdx}>
              {rowIdx > 0 && (
                <div className="relative flex items-center justify-center my-3">
                  <div className="flex-1 border-t border-dashed border-slate-300"></div>
                  <span className="px-2 text-[10px] uppercase tracking-widest text-slate-400">allée</span>
                  <div className="flex-1 border-t border-dashed border-slate-300"></div>
                </div>
              )}
              <div className={`grid gap-2 ${gridColsFor(row.length, compact)}`}>
                {row.map(stand => (
                  <StandCell
                    key={stand.id}
                    stand={stand}
                    dimmed={!matchesFilters(stand)}
                    highlighted={(highlightRegId && stand.assignment?.registration_id === highlightRegId) || (highlightStandCode && stand.stand_code === highlightStandCode)}
                    onClick={onStandClick ? () => onStandClick(stand) : null}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer — Scène */}
        <div className="flex items-center justify-center mt-5">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900 text-white text-xs font-semibold shadow-md">
            <Music className="w-3.5 h-3.5" />
            SCÈNE / ANIMATIONS
          </div>
        </div>

        {/* Légende */}
        <div className="mt-5 pt-4 border-t border-slate-200 flex flex-wrap items-center gap-3 text-[11px] text-slate-600">
          <span className="flex items-center gap-1.5"><Dot c="bg-emerald-200 border-emerald-400" /> Confirmé</span>
          <span className="flex items-center gap-1.5"><Dot c="bg-amber-200 border-amber-400" /> À confirmer</span>
          <span className="flex items-center gap-1.5"><Dot c="bg-orange-200 border-orange-400" /> À relancer</span>
          <span className="flex items-center gap-1.5"><Dot c="bg-slate-100 border-slate-300" /> Prospect</span>
          <span className="flex items-center gap-1.5"><Dot c="bg-white border-slate-300" /> Libre</span>
          {(highlightRegId || highlightStandCode) && <span className="flex items-center gap-1.5 ml-auto"><Dot c="bg-blue-500 ring-2 ring-blue-300" /> Votre stand</span>}
        </div>
      </div>
    </div>
  );
}

function splitInRows(stands) {
  if (!stands || stands.length === 0) return [];
  // Trier par stand_code pour un plan cohérent
  const sorted = [...stands].sort((a, b) => (a.stand_code || '').localeCompare(b.stand_code || ''));
  const n = sorted.length;
  if (n <= 7) return [sorted];
  // Split en 2 rangées
  const half = Math.ceil(n / 2);
  return [sorted.slice(0, half), sorted.slice(half)];
}

function gridColsFor(len, compact) {
  if (compact) {
    if (len <= 4) return 'grid-cols-2 sm:grid-cols-4';
    if (len <= 6) return 'grid-cols-3 sm:grid-cols-6';
    return 'grid-cols-4 sm:grid-cols-8';
  }
  if (len <= 4) return 'grid-cols-2 md:grid-cols-4';
  if (len <= 6) return 'grid-cols-3 md:grid-cols-6';
  if (len <= 7) return 'grid-cols-3 sm:grid-cols-4 md:grid-cols-7';
  return 'grid-cols-4 md:grid-cols-6 lg:grid-cols-8';
}

function StandCell({ stand, dimmed, highlighted, onClick }) {
  const status = stand.organization ? (stand.registration_status || 'prospect') : 'libre';
  const colors = {
    confirme: 'bg-emerald-100 border-emerald-300 hover:bg-emerald-150',
    a_confirmer: 'bg-amber-100 border-amber-300',
    a_relancer: 'bg-orange-100 border-orange-300',
    prospect: 'bg-slate-100 border-slate-300',
    libre: 'bg-white border-slate-200 border-dashed hover:bg-blue-50',
  };
  const priorityBadge = stand.organization?.priority_level;
  const baseCls = `group relative rounded-lg border text-left transition-all p-2.5 ${colors[status]} ${onClick ? 'cursor-pointer hover:shadow-md hover:scale-[1.02]' : ''} ${dimmed ? 'opacity-25' : ''} ${highlighted ? 'ring-4 ring-blue-400 ring-offset-2 z-10 shadow-lg' : ''}`;

  const content = (
    <>
      <div className="flex items-start justify-between mb-0.5">
        <span className="font-mono text-[10px] font-bold text-slate-600">{stand.stand_code}</span>
        {priorityBadge && <span className={`text-[9px] font-bold px-1 rounded ${priorityBadge === 'A' ? 'bg-red-600 text-white' : priorityBadge === 'B' ? 'bg-blue-600 text-white' : 'bg-slate-400 text-white'}`}>{priorityBadge}</span>}
      </div>
      {stand.organization ? (
        <>
          <div className="text-xs font-semibold text-slate-900 leading-tight line-clamp-2">{stand.organization.name}</div>
          <div className="text-[10px] text-slate-500 mt-0.5 truncate">{stand.organization.discipline}</div>
        </>
      ) : (
        <div className="text-xs text-slate-400 italic">Libre</div>
      )}
    </>
  );

  if (onClick) {
    return (
      <button onClick={onClick} className={baseCls} title={stand.organization ? `${stand.organization.name} — ${stand.organization.discipline}` : 'Stand libre'}>
        {content}
      </button>
    );
  }
  return (
    <div className={baseCls} title={stand.organization ? `${stand.organization.name} — ${stand.organization.discipline}` : 'Stand libre'}>
      {content}
    </div>
  );
}

function Dot({ c }) {
  return <span className={`inline-block w-3 h-3 rounded-sm border ${c}`} />;
}

function FilterChip({ label, count, color = 'blue', active, onClick }) {
  const activeColors = {
    blue: 'bg-blue-600 text-white border-blue-600',
    emerald: 'bg-emerald-600 text-white border-emerald-600',
    amber: 'bg-amber-500 text-white border-amber-500',
    orange: 'bg-orange-500 text-white border-orange-500',
    slate: 'bg-slate-700 text-white border-slate-700',
    white: 'bg-slate-900 text-white border-slate-900',
  };
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium transition-all ${active ? activeColors[color] : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
    >
      {label}
      <span className={`text-[10px] font-bold ${active ? 'text-white/90' : 'text-slate-400'}`}>{count}</span>
    </button>
  );
}

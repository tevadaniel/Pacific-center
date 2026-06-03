'use client';
import { useEffect, useState } from 'react';
import VenueMapPng from '@/components/venue-map-png';
import { Map, Grid3x3 } from 'lucide-react';

/**
 * 🆕 Toggle Plan/Grille — wrapper unifié pour afficher les stands.
 * - Vue "Plan" : VenueMapPng (image avec positions)
 * - Vue "Grille" : grille de boutons numérotés
 * - Persistance localStorage (clé fr26_stand_view_mode = 'map' | 'grid')
 * - Props identiques à SmartVenueMap pour drop-in replacement
 */
export default function StandViewToggle({
  venue,
  stands = [],
  highlightStandCode,
  highlightRegId,
  onStandClick,
  onStandsReload,
  editable = false,
  showFilters = true,
  compact = false,
  defaultMode = 'map',
}) {
  const [mode, setMode] = useState(defaultMode);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = localStorage.getItem('fr26_stand_view_mode');
    if (saved === 'map' || saved === 'grid') setMode(saved);
    setHydrated(true);
  }, []);

  const setModePersist = (m) => {
    setMode(m);
    if (typeof window !== 'undefined') localStorage.setItem('fr26_stand_view_mode', m);
  };

  // Don't render until hydrated to avoid hydration mismatch
  if (!hydrated) {
    return (
      <div className="space-y-1">
        <VenueMapPng venue={venue} stands={stands} highlightStandCode={highlightStandCode} onStandClick={onStandClick} onStandsReload={onStandsReload} editable={editable} />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Toggle bar */}
      <div className="flex items-center justify-end gap-1 pr-1">
        <div className="inline-flex rounded-lg border border-aracom-gold/40 bg-white p-0.5 shadow-sm">
          <button
            type="button"
            onClick={() => setModePersist('map')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition ${
              mode === 'map' ? 'bg-aracom-orange text-white shadow' : 'text-aracom-black hover:bg-aracom-orange/10'
            }`}
            data-testid="stand-view-map"
            aria-pressed={mode === 'map'}
          >
            <Map className="w-3.5 h-3.5" /> Plan
          </button>
          <button
            type="button"
            onClick={() => setModePersist('grid')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition ${
              mode === 'grid' ? 'bg-aracom-orange text-white shadow' : 'text-aracom-black hover:bg-aracom-orange/10'
            }`}
            data-testid="stand-view-grid"
            aria-pressed={mode === 'grid'}
          >
            <Grid3x3 className="w-3.5 h-3.5" /> Grille
          </button>
        </div>
      </div>

      {/* Body */}
      {mode === 'map' ? (
        <div className="space-y-1">
          <VenueMapPng
            venue={venue}
            stands={stands}
            highlightStandCode={highlightStandCode}
            onStandClick={onStandClick}
            onStandsReload={onStandsReload}
            editable={editable}
          />
          <div className="text-xs italic text-slate-500 text-center pt-1 select-none">
            Sous réserve de modification le jour J
          </div>
        </div>
      ) : (
        <StandsGrid
          stands={stands}
          venue={venue}
          highlightStandCode={highlightStandCode}
          onStandClick={onStandClick}
        />
      )}
    </div>
  );
}

// 🆕 Vue grille — cases numérotées avec état (libre/pris/waitlist/highlighted)
function StandsGrid({ stands = [], venue, highlightStandCode, onStandClick }) {
  if (!Array.isArray(stands) || stands.length === 0) {
    return (
      <div className="text-center text-slate-500 italic py-6 text-sm">
        Aucun stand configuré pour ce site.
      </div>
    );
  }
  // Tri par code (alphabétique : F-A01, F-A02, etc.)
  const sorted = [...stands].sort((a, b) => {
    const ca = a.stand_code || a.code || '';
    const cb = b.stand_code || b.code || '';
    return ca.localeCompare(cb, undefined, { numeric: true });
  });

  return (
    <div className="bg-aracom-beige-pale/40 border border-aracom-gold/30 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2 text-[11px] text-slate-600">
        <span className="font-semibold text-aracom-black">📦 {sorted.length} stand{sorted.length > 1 ? 's' : ''} — {venue?.name || ''}</span>
        <span className="flex items-center gap-2">
          <Legend color="bg-emerald-100 border-emerald-400" label="Libre" />
          <Legend color="bg-amber-100 border-amber-400" label="En attente" />
          <Legend color="bg-rose-100 border-rose-400" label="Pris" />
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
        {sorted.map(stand => {
          const code = stand.stand_code || stand.code || stand.label || '—';
          const isHighlighted = highlightStandCode && (code === highlightStandCode);
          const asn = stand.assignment;
          const orgName = stand.organization?.name;
          const isTaken = !!asn?.registration_id && (asn.request_status === 'validated' || stand.registration_status === 'confirme' || !asn.request_status);
          const isPending = asn?.request_status === 'pending';
          const isWaitlist = asn?.request_status === 'waitlist' || stand.has_waitlist;
          const clickable = !!onStandClick;
          let cls = 'bg-emerald-100 border-emerald-400 hover:bg-emerald-200 text-emerald-900';
          let icon = '✓';
          let statusLabel = 'Libre';
          if (isHighlighted) { cls = 'bg-aracom-orange border-aracom-orange text-white shadow-md ring-2 ring-aracom-orange/30'; icon = '★'; statusLabel = 'Votre stand'; }
          else if (isTaken) { cls = 'bg-rose-100 border-rose-400 text-rose-700 hover:bg-rose-200'; icon = '✕'; statusLabel = 'Pris'; }
          else if (isPending) { cls = 'bg-amber-100 border-amber-400 text-amber-800 hover:bg-amber-200'; icon = '⏳'; statusLabel = 'En attente'; }
          else if (isWaitlist) { cls = 'bg-amber-100 border-amber-400 text-amber-800 hover:bg-amber-200'; icon = '⏳'; statusLabel = 'Liste d\'attente'; }
          const tooltip = `${code} — ${statusLabel}${orgName && !isHighlighted ? ' · ' + orgName : ''}`;
          return (
            <button
              key={stand.id || code}
              type="button"
              disabled={!clickable}
              onClick={clickable ? () => onStandClick(stand) : undefined}
              title={tooltip}
              className={`p-2 rounded-md border-2 text-center transition ${cls} ${clickable ? 'cursor-pointer' : 'cursor-default'}`}
              data-testid={`stand-grid-${code}`}
            >
              <div className="text-[10px] uppercase tracking-wider opacity-80 leading-none mb-0.5">{icon} <span className="text-[9px]">{statusLabel}</span></div>
              <div className="font-mono font-bold text-[13px] leading-tight">{code}</div>
              {orgName && !isHighlighted && (
                <div className="text-[9px] opacity-70 mt-0.5 truncate" title={orgName}>{orgName}</div>
              )}
            </button>
          );
        })}
      </div>
      <div className="text-[10px] italic text-slate-500 text-center mt-2 select-none">
        Sous réserve de modification le jour J
      </div>
    </div>
  );
}

function Legend({ color, label }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px]">
      <span className={`w-2.5 h-2.5 rounded border ${color}`} /> {label}
    </span>
  );
}

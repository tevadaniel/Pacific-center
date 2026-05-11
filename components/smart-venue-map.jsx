'use client';

import VenueMapPng from '@/components/venue-map-png';

/**
 * SmartVenueMap — utilise désormais TOUJOURS VenueMapPng (fond vierge éditable).
 * L'admin construit le plan manuellement via l'éditeur intégré pour chacun des 6 sites.
 */
export default function SmartVenueMap({ venue, stands, highlightStandCode, highlightRegId, onStandClick, onStandsReload, editable = false, showFilters = true, compact = false }) {
  return (
    <div className="space-y-1">
      <VenueMapPng
        venue={venue}
        stands={stands}
        highlightStandCode={highlightStandCode}
        onStandClick={onStandClick}
        onStandsReload={onStandsReload}
        editable={editable}
      />
      {/* Mention permanente, discrète mais visible — sur tous les plans (admin, exposant, pacific, jour-j) */}
      <div className="text-xs italic text-slate-500 text-center pt-1 select-none">
        Sous réserve de modification le jour J
      </div>
    </div>
  );
}

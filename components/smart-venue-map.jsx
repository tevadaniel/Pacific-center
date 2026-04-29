'use client';

import VenueMapPng from '@/components/venue-map-png';

/**
 * SmartVenueMap — utilise désormais TOUJOURS VenueMapPng (fond vierge éditable).
 * L'admin construit le plan manuellement via l'éditeur intégré pour chacun des 6 sites.
 */
export default function SmartVenueMap({ venue, stands, highlightStandCode, highlightRegId, onStandClick, onStandsReload, editable = false, showFilters = true, compact = false }) {
  return (
    <VenueMapPng
      venue={venue}
      stands={stands}
      highlightStandCode={highlightStandCode}
      onStandClick={onStandClick}
      onStandsReload={onStandsReload}
      editable={editable}
    />
  );
}

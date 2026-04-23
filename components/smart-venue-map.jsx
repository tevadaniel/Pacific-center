'use client';

import VenueMap from '@/components/venue-map';
import VenueMapPng from '@/components/venue-map-png';

const HAS_PNG = ['FAAA', 'PUN', 'ARU', 'TAR'];

/**
 * SmartVenueMap — Dispatch automatique :
 *  - Sites avec PNG (FAAA/PUN/ARU/TAR) → VenueMapPng (plan réel + drag & drop)
 *  - Autres (MAH/MOO) → VenueMap schématique
 */
export default function SmartVenueMap({ venue, stands, highlightStandCode, highlightRegId, onStandClick, onStandsReload, editable = false, showFilters = true, compact = false }) {
  if (venue?.code && HAS_PNG.includes(venue.code)) {
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

  return (
    <VenueMap
      venue={venue}
      stands={stands}
      highlightStandCode={highlightStandCode}
      highlightRegId={highlightRegId}
      onStandClick={onStandClick}
      showFilters={showFilters}
      compact={compact}
    />
  );
}

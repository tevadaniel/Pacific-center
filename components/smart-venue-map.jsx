'use client';

import VenueMap from '@/components/venue-map';
import VenueMapReal from '@/components/venue-map-real';
import { PLAN_KEY_BY_VENUE } from '@/lib/venue-plans';

/**
 * SmartVenueMap — Affiche le vrai plan SVG si disponible pour ce site,
 * sinon fallback sur le plan schématique (grille type ENTRÉE/SCÈNE).
 *
 * Accepte les mêmes props que VenueMap + VenueMapReal.
 */
export default function SmartVenueMap({ venue, stands, highlightStandCode, highlightRegId, onStandClick, showFilters = true, compact = false }) {
  const hasRealPlan = venue?.code && PLAN_KEY_BY_VENUE[venue.code];

  if (hasRealPlan) {
    return (
      <VenueMapReal
        venue={venue}
        stands={stands}
        highlightStandCode={highlightStandCode}
        onStandClick={onStandClick}
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

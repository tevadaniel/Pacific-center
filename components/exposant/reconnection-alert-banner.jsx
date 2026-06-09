'use client';

/**
 * 🆕 SESSION 52 — ReconnectionAlertBanner (Phase A)
 *
 * Bandeau d'alerte affiché à la reconnexion pour les candidatures incomplètes.
 * - Un bandeau par candidature incomplète, empilés
 * - Format : "⚠️ [Site] — il vous reste : [liste précise]"
 * - Bouton unique "Reprendre →" → bascule sur ce site + scroll au 1er bloc manquant
 *
 * Props :
 *   allSites      — array de registrations (de /api/exposant/my-sites)
 *   activeRegId   — id du site actuellement actif
 *   onResume      — (regId, firstMissingBlock) => void
 */

import { Button } from '@/components/ui/button';
import { AlertTriangle, ChevronRight, Sparkles } from 'lucide-react';

/**
 * Calcule la liste des éléments manquants pour une candidature.
 * Retourne { items: [{label, block}], firstBlock }
 * où firstBlock est la clé de section où renvoyer en premier ('site' | 'stand' | 'planning' | 'documents').
 */
export function computeMissingItems(site) {
  const items = [];
  const days = Array.isArray(site.attending_days) ? site.attending_days : [];

  // 1. Jours
  if (days.length === 0) {
    items.push({ label: 'Choisir les jours de présence', block: 'site' });
  }
  // 2. Stand
  if (!site.stand_code && !site.is_waitlist) {
    items.push({ label: 'Réserver un stand', block: 'stand' });
  }
  // 3. Animations par jour sélectionné (format DB = 'vendredi'/'samedi')
  if (days.includes('vendredi') && !site.has_vendredi_animation) {
    items.push({ label: 'Animation du vendredi 14 août', block: 'planning' });
  }
  if (days.includes('samedi') && !site.has_samedi_animation) {
    items.push({ label: 'Animation du samedi 15 août', block: 'planning' });
  }
  // 4. Documents
  if (!site.is_convention_signed) {
    items.push({ label: 'Convention signée', block: 'documents' });
  }
  if (!site.is_insurance_uploaded) {
    items.push({ label: 'Attestation d\'assurance', block: 'documents' });
  }
  if (site.is_deposit_required && !site.is_deposit_received) {
    items.push({ label: 'Caution (20 000 XPF)', block: 'caution' });
  }

  // 1er bloc à atteindre
  const blockOrder = ['site', 'stand', 'planning', 'caution', 'documents'];
  const firstBlock = items.length > 0
    ? blockOrder.find((b) => items.some((it) => it.block === b)) || items[0].block
    : null;

  return { items, firstBlock };
}

export default function ReconnectionAlertBanner({ allSites = [], onResume }) {
  // Filtre uniquement les candidatures INCOMPLÈTES non-refusées/annulées
  const incomplete = (allSites || [])
    .filter((s) => !['refuse', 'annule'].includes(s.status))
    .map((s) => ({ site: s, ...computeMissingItems(s) }))
    .filter(({ items }) => items.length > 0)
    .sort((a, b) => (a.site.site_priority || 99) - (b.site.site_priority || 99));

  if (incomplete.length === 0) {
    return (
      <div className="rounded-lg border-2 border-emerald-300 bg-emerald-50 px-3 py-2.5 flex items-center gap-2 text-sm">
        <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
        <span className="font-semibold text-emerald-900">
          Toutes vos candidatures sont complètes — bravo !
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {incomplete.map(({ site, items, firstBlock }) => {
        const venueName = site.venue?.name || '—';
        return (
          <div
            key={site.id}
            className="rounded-lg border-2 border-amber-300 bg-amber-50/80 px-3 py-2.5"
            data-testid={`reconnection-banner-${site.id}`}
          >
            <div className="flex items-start gap-2 flex-wrap">
              <div className="flex items-start gap-2 flex-1 min-w-0">
                <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm text-amber-950">
                    {venueName}
                    {site.site_priority && (
                      <span className="ml-1.5 text-[10px] font-semibold bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded">
                        Site&nbsp;{site.site_priority}
                      </span>
                    )}
                    {' '}— il vous reste&nbsp;:
                  </div>
                  <ul className="mt-1 space-y-0.5">
                    {items.map((it, idx) => (
                      <li key={idx} className="text-xs text-amber-900 flex items-center gap-1.5">
                        <span className="w-1 h-1 rounded-full bg-amber-700 shrink-0" />
                        {it.label}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => onResume && onResume(site.id, firstBlock)}
                className="h-8 px-3 text-xs bg-amber-600 hover:bg-amber-700 text-white gap-1 shrink-0"
              >
                Reprendre <ChevronRight className="w-3 h-3" />
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

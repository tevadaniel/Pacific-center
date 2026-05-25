'use client';

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import {
  AlertCircle, Plus, MapPin, Star, Loader2, X, ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';

/**
 * 🆕 SESSION 47 — Bannière collante d'urgence + ajout multi-site
 *
 * Affiche en haut du wizard / portail exposant :
 *  - Le nombre d'exposants en cours d'inscription + en attente de validation
 *    (crée l'urgence : "il faut se dépêcher")
 *  - Un bouton "+ Ajouter un autre site" visible dès qu'au moins un site est réservé
 *
 * Quand l'utilisateur clique sur "Ajouter un autre site" :
 *  1. Modal qui demande quel site sera ajouté
 *  2. Question : "Quel site sera votre site PRIORITAIRE ?"
 *  3. Crée la nouvelle registration via /api/wizard/add-site
 *  4. Définit la préférence via /api/exposant/sites/:regId/priority
 *  5. Redirige le wizard sur la nouvelle registration
 *
 * Props :
 *  - organizationId : string (l'org en cours)
 *  - currentRegistrationId : string (la reg en cours d'édition)
 *  - existingSites : Array<{registration_id, venue_id, venue_name, is_user_priority}> (déjà réservés)
 *  - availableVenues : Array<{id, name}> (toutes les venues actives)
 *  - onSiteAdded : (newRegistrationId) => void (callback pour rediriger le wizard)
 *  - context : 'wizard' | 'portal'
 */
async function api(path, opts = {}) {
  const r = await fetch(`/api${path}`, {
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    ...opts,
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(t || r.statusText);
  }
  return r.json();
}

export default function UrgencyBanner({
  organizationId,
  currentRegistrationId,
  existingSites = [],
  availableVenues = [],
  onSiteAdded,
  context = 'wizard',
}) {
  const [stats, setStats] = useState({ pending_validations: 0, registrations_in_progress: 0, total: 0 });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Auto-poll urgency stats every 20s
  const loadStats = useCallback(async () => {
    try {
      const s = await api('/wizard/urgency-stats');
      setStats(s);
    } catch { /* silent */ }
  }, []);
  useEffect(() => {
    loadStats();
    const t = setInterval(loadStats, 20000);
    return () => clearInterval(t);
  }, [loadStats]);

  const canAddSite = existingSites.length >= 1 && existingSites.length < 3 && availableVenues.length > existingSites.length;
  const reachedLimit = existingSites.length >= 3;
  const totalUrgency = stats.total;
  const showUrgency = totalUrgency >= 1 && !dismissed;

  // Ne rien afficher si pas d'urgence ET pas de bouton d'ajout possible
  if (!showUrgency && !canAddSite && !reachedLimit) return null;

  return (
    <>
      <div className="sticky top-0 z-30 -mx-4 -mt-4 mb-4 px-4 py-2 bg-gradient-to-r from-amber-50 via-orange-50 to-rose-50 border-b-2 border-amber-300 shadow-sm">
        <div className="max-w-5xl mx-auto flex items-center gap-3 flex-wrap">
          {showUrgency && (
            <div className="flex items-center gap-2 flex-1 min-w-[240px]">
              <div className="relative">
                <div className="absolute inset-0 bg-amber-400 rounded-full animate-ping opacity-50"></div>
                <AlertCircle className="w-5 h-5 text-amber-700 relative" />
              </div>
              <div className="text-sm text-amber-900 leading-tight">
                <b>⚡ Il y a {totalUrgency} exposant{totalUrgency > 1 ? 's' : ''} en attente de validation</b>
                <span className="text-amber-700 text-xs ml-1.5">
                  ({stats.registrations_in_progress} en cours · {stats.pending_validations} en validation)
                </span>
                <span className="hidden sm:inline text-amber-800 ml-2">— pensez à finaliser votre dossier !</span>
              </div>
              <button onClick={() => setDismissed(true)} title="Masquer" className="text-amber-700 hover:text-amber-900 ml-auto">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          {canAddSite && (
            <Button
              size="sm"
              onClick={() => setDialogOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-700 gap-1.5 shrink-0"
              data-testid="add-site-btn"
            >
              <Plus className="w-3.5 h-3.5" />
              Ajouter un autre site
              <Badge className="bg-white/20 text-white border-0 ml-1 text-[10px]">{existingSites.length}/3</Badge>
            </Button>
          )}
          {reachedLimit && (
            <Badge variant="outline" className="bg-slate-100 border-slate-300 text-slate-700 shrink-0">
              📍 Limite atteinte : 3 sites maximum
            </Badge>
          )}
        </div>
      </div>

      <AddSiteDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        organizationId={organizationId}
        currentRegistrationId={currentRegistrationId}
        existingSites={existingSites}
        availableVenues={availableVenues}
        onSiteAdded={(newRegId) => {
          setDialogOpen(false);
          if (onSiteAdded) onSiteAdded(newRegId);
        }}
        context={context}
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────
function AddSiteDialog({ open, onClose, organizationId, currentRegistrationId, existingSites, availableVenues, onSiteAdded, context }) {
  const [selectedVenue, setSelectedVenue] = useState('');
  const [preference, setPreference] = useState('current'); // 'current' or 'new'
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setSelectedVenue('');
      setPreference('current');
    }
  }, [open]);

  // Filtre les venues : exclure celles déjà réservées
  const bookedVenueIds = new Set(existingSites.map(s => s.venue_id));
  const candidateVenues = availableVenues.filter(v => !bookedVenueIds.has(v.id));

  const currentSite = existingSites.find(s => s.registration_id === currentRegistrationId) || existingSites[0];
  const currentVenueName = currentSite?.venue_name || 'votre site actuel';

  const handleConfirm = async () => {
    if (!selectedVenue) { toast.error('Veuillez sélectionner un site'); return; }
    if (!organizationId) { toast.error('Organisation introuvable'); return; }
    setBusy(true);
    try {
      // 1. Crée la nouvelle registration via add-site
      const newRegResp = await api('/wizard/add-site', {
        method: 'POST',
        body: JSON.stringify({ organization_id: organizationId }),
      });
      const newRegId = newRegResp.registration_id;
      if (!newRegId) throw new Error('Impossible de créer la nouvelle inscription');

      // 2. Définit la préférence
      // Si l'utilisateur a choisi le nouveau site comme prioritaire → priority sur newRegId
      // Si l'utilisateur préfère son site actuel → priority sur currentRegistrationId
      const priorityRegId = preference === 'new' ? newRegId : currentRegistrationId;
      try {
        await api(`/exposant/sites/${priorityRegId}/priority`, {
          method: 'POST',
          body: JSON.stringify({ priority: 1 }),
        });
      } catch (e) { console.warn('priority set warning:', e.message); }

      // 3. Pré-sélectionne la venue dans le draft (sera utilisée à l'étape 2)
      try {
        localStorage.setItem(`wizard:${newRegId}`, JSON.stringify({
          booking: { venue_id: selectedVenue, attending_days: [], attending_day_times: {} },
        }));
      } catch {}

      toast.success(`✅ Nouvelle demande créée. Site prioritaire : ${preference === 'new' ? candidateVenues.find(v => v.id === selectedVenue)?.name : currentVenueName}`);

      // 4. Callback → bascule le wizard sur la nouvelle registration
      onSiteAdded(newRegId);
    } catch (e) {
      toast.error(`Erreur : ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-indigo-600" />
            Ajouter un autre site
          </DialogTitle>
          <DialogDescription>
            Vous allez créer une nouvelle demande pour un site supplémentaire. Une caution de <b>20 000 XPF</b> sera applicable par site.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Sélection du nouveau site */}
          <div>
            <label className="text-sm font-semibold text-slate-700 block mb-1.5">Nouveau site souhaité *</label>
            {candidateVenues.length === 0 ? (
              <div className="text-sm text-amber-700 bg-amber-50 p-2 rounded border border-amber-200">
                Aucun nouveau site disponible (tous déjà réservés ou inactifs).
              </div>
            ) : (
              <select
                value={selectedVenue}
                onChange={e => setSelectedVenue(e.target.value)}
                className="w-full border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">— Choisir un site —</option>
                {candidateVenues.map(v => (
                  <option key={v.id} value={v.id}>📍 {v.name}</option>
                ))}
              </select>
            )}
          </div>

          {/* Choix du site prioritaire */}
          {candidateVenues.length > 0 && (
            <div>
              <label className="text-sm font-semibold text-slate-700 block mb-2">
                <Star className="w-4 h-4 inline text-amber-500 mr-1" />
                Quel site sera votre site <b>PRIORITAIRE</b> ? *
              </label>
              <div className="space-y-2">
                <label className={`flex items-start gap-2 p-2.5 border-2 rounded-md cursor-pointer transition ${preference === 'current' ? 'border-amber-400 bg-amber-50' : 'border-slate-200 hover:border-slate-300'}`}>
                  <input
                    type="radio"
                    name="preference"
                    value="current"
                    checked={preference === 'current'}
                    onChange={() => setPreference('current')}
                    className="mt-0.5"
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium">Garder <b>{currentVenueName}</b> comme site prioritaire ⭐</div>
                    <div className="text-xs text-slate-500">Le nouveau site sera secondaire.</div>
                  </div>
                </label>
                <label className={`flex items-start gap-2 p-2.5 border-2 rounded-md cursor-pointer transition ${preference === 'new' ? 'border-amber-400 bg-amber-50' : 'border-slate-200 hover:border-slate-300'}`}>
                  <input
                    type="radio"
                    name="preference"
                    value="new"
                    checked={preference === 'new'}
                    onChange={() => setPreference('new')}
                    className="mt-0.5"
                    disabled={!selectedVenue}
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium">
                      Définir <b>{selectedVenue ? candidateVenues.find(v => v.id === selectedVenue)?.name : 'le nouveau site'}</b> comme prioritaire ⭐
                    </div>
                    <div className="text-xs text-slate-500">Le site actuel deviendra secondaire.</div>
                  </div>
                </label>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="outline" onClick={onClose} disabled={busy}>Annuler</Button>
          <Button
            onClick={handleConfirm}
            disabled={busy || !selectedVenue || candidateVenues.length === 0}
            className="bg-indigo-600 hover:bg-indigo-700 gap-1.5"
            data-testid="confirm-add-site"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
            Créer la nouvelle demande
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

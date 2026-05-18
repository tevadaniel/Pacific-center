'use client';

import { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { Pencil, Loader2, X, Save, MapPin, AlertTriangle } from 'lucide-react';
import { api } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';

/**
 * EDIT EXPOSANT CHOICES DIALOG
 * Permet à l'admin de modifier directement les choix de l'exposant :
 * - Site (venue)
 * - Stand (parmi ceux libres du site sélectionné — le stand actuel reste sélectionnable)
 * - Animation prévue (label)
 * - Créneaux vendredi/samedi (labels libres)
 * - Notes exposant
 *
 * Backend : PUT /api/registrations/:id avec les champs autorisés
 */
export default function EditExposantChoicesDialog({ registration, organization, venue, onClose, onReload }) {
  const initial = {
    venue_id: registration?.venue_id || '',
    stand_code: registration?.stand_code || '',
    animation_type: registration?.animation_type || '',
    friday_slot_label: registration?.friday_slot_label || '',
    saturday_slot_label: registration?.saturday_slot_label || '',
    exposant_notes: registration?.exposant_notes || '',
  };

  const [venues, setVenues] = useState([]);
  const [stands, setStands] = useState([]);
  const [loadingStands, setLoadingStands] = useState(false);
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);

  // 🔄 Charger les venues une fois à l'ouverture
  useEffect(() => {
    api('/api/venues').then((v) => {
      setVenues(Array.isArray(v) ? v : []);
    }).catch(() => {});
  }, []);

  // 🔄 Charger les stands à chaque changement de venue
  useEffect(() => {
    if (!form.venue_id) { setStands([]); return; }
    setLoadingStands(true);
    api(`/api/venues/${form.venue_id}/stands`)
      .then((s) => setStands(Array.isArray(s) ? s : []))
      .catch(() => setStands([]))
      .finally(() => setLoadingStands(false));
  }, [form.venue_id]);

  const venueChanged = form.venue_id !== initial.venue_id;
  const standChanged = form.stand_code !== initial.stand_code;

  // 🪧 Stands disponibles = stands libres + le stand actuel (si on est sur le même venue)
  const availableStands = useMemo(() => {
    return stands.filter((s) => {
      const isAvailable = !s.assignment;
      const isCurrent = !venueChanged && s.stand_code === initial.stand_code;
      return isAvailable || isCurrent;
    });
  }, [stands, venueChanged, initial.stand_code]);

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // 🆕 Si on change de venue, on doit réinitialiser le stand (sauf s'il existe dans le nouveau venue)
  useEffect(() => {
    if (!venueChanged) return;
    // Reset stand quand on change de site
    if (form.stand_code && !stands.some((s) => s.stand_code === form.stand_code)) {
      setForm((f) => ({ ...f, stand_code: '' }));
    }
  }, [stands, venueChanged]);

  const hasChanges = useMemo(() => {
    return Object.keys(form).some((k) => (form[k] || '') !== (initial[k] || ''));
  }, [form]);

  const save = async () => {
    if (!hasChanges) { toast.info('Aucune modification à enregistrer'); return; }
    if (form.venue_id !== initial.venue_id && !form.stand_code) {
      toast.error('Choisissez un stand pour le nouveau site');
      return;
    }
    if (!window.confirm('Appliquer les modifications au dossier de l\'exposant ?')) return;
    setSaving(true);
    try {
      // Ne renvoyer que les champs modifiés
      const patch = {};
      for (const k of Object.keys(form)) {
        if ((form[k] || '') !== (initial[k] || '')) patch[k] = form[k];
      }
      await api(`/api/registrations/${registration.id}`, {
        method: 'PUT',
        body: JSON.stringify(patch),
      });
      toast.success('✅ Choix de l\'exposant mis à jour');
      await onReload?.();
      onClose();
    } catch (e) {
      toast.error(e.message || 'Erreur lors de l\'enregistrement');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Pencil className="w-5 h-5 text-violet-600" />
            <div>
              <div className="font-bold text-base">Modifier les choix de l'exposant</div>
              <div className="text-xs text-slate-500">
                {organization?.name} · {organization?.discipline || '—'}
              </div>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Warning candidature locked */}
        {registration?.candidature_locked && (
          <div className="m-4 mb-0 rounded-md border border-amber-300 bg-amber-50 p-3 flex items-start gap-2 text-xs text-amber-900">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <div>
              <b>Candidature verrouillée</b> — toute modification ici écrasera les choix soumis.
              Pensez à débloquer la candidature ou à la resoumettre si nécessaire.
            </div>
          </div>
        )}

        {/* Body */}
        <div className="p-4 space-y-5">
          {/* ━━━ SITE & STAND ━━━ */}
          <div className="rounded-md border border-blue-200 bg-blue-50/40 p-3 space-y-3">
            <div className="font-semibold text-sm text-blue-900 flex items-center gap-2">
              <MapPin className="w-4 h-4" /> Site & stand
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Site (venue)</Label>
                <Select value={form.venue_id} onValueChange={(v) => setField('venue_id', v)}>
                  <SelectTrigger className="h-9 mt-1"><SelectValue placeholder="Choisir un site" /></SelectTrigger>
                  <SelectContent>
                    {venues.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.name} {v.code ? `· ${v.code}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {venueChanged && (
                  <div className="text-[11px] text-orange-700 mt-1 font-medium">
                    ⚠ Changement de site — sélectionnez un nouveau stand.
                  </div>
                )}
              </div>

              <div>
                <Label className="text-xs">Stand</Label>
                <Select value={form.stand_code || '_none'} onValueChange={(v) => setField('stand_code', v === '_none' ? '' : v)}>
                  <SelectTrigger className="h-9 mt-1">
                    <SelectValue placeholder={loadingStands ? 'Chargement…' : 'Choisir un stand'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">— Aucun stand —</SelectItem>
                    {availableStands.map((s) => (
                      <SelectItem key={s.stand_code} value={s.stand_code}>
                        {s.stand_code}
                        {s.zone_label ? ` · ${s.zone_label}` : ''}
                        {!venueChanged && s.stand_code === initial.stand_code ? ' (actuel)' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {standChanged && initial.stand_code && (
                  <div className="text-[11px] text-orange-700 mt-1 font-medium">
                    ⚠ L'ancien stand {initial.stand_code} sera libéré.
                  </div>
                )}
                {!loadingStands && availableStands.length === 0 && form.venue_id && (
                  <div className="text-[11px] text-red-600 mt-1">
                    Aucun stand disponible sur ce site.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ━━━ ANIMATIONS / LABELS ━━━ */}
          <div className="rounded-md border border-violet-200 bg-violet-50/40 p-3 space-y-3">
            <div className="font-semibold text-sm text-violet-900">🎭 Animations / labels (champs libres)</div>

            <div>
              <Label className="text-xs">Animation prévue (texte libre)</Label>
              <Input
                value={form.animation_type}
                onChange={(e) => setField('animation_type', e.target.value)}
                placeholder="Ex : Démonstration de judo enfants"
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Créneau vendredi (label libre)</Label>
                <Input
                  value={form.friday_slot_label}
                  onChange={(e) => setField('friday_slot_label', e.target.value)}
                  placeholder="Ex : 14h–15h Démo seniors"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Créneau samedi (label libre)</Label>
                <Input
                  value={form.saturday_slot_label}
                  onChange={(e) => setField('saturday_slot_label', e.target.value)}
                  placeholder="Ex : 10h–11h Initiation"
                  className="mt-1"
                />
              </div>
            </div>

            <div className="text-[11px] text-violet-700 italic">
              💡 Ces champs sont des libellés affichés sur le profil exposant. Pour gérer les créneaux d'animation
              détaillés (date, horaire, type, zone), utilisez l'onglet « Profil » de la fiche (section Créneaux).
            </div>
          </div>

          {/* ━━━ NOTES EXPOSANT ━━━ */}
          <div className="rounded-md border border-slate-200 bg-slate-50/40 p-3 space-y-2">
            <Label className="text-xs font-semibold text-slate-700">📝 Notes / commentaires de l'exposant</Label>
            <Textarea
              rows={4}
              value={form.exposant_notes}
              onChange={(e) => setField('exposant_notes', e.target.value)}
              placeholder="Commentaires / demandes spécifiques de l'exposant…"
              className="text-xs"
            />
          </div>

          {/* Récap changements */}
          {hasChanges && (
            <div className="rounded-md border border-emerald-300 bg-emerald-50 p-3 text-xs">
              <div className="font-semibold text-emerald-900 mb-1">Modifications à appliquer :</div>
              <ul className="space-y-0.5 text-emerald-800">
                {Object.keys(form).map((k) => {
                  if ((form[k] || '') === (initial[k] || '')) return null;
                  return (
                    <li key={k}>
                      • <code className="text-[10px]">{k}</code> : <span className="line-through opacity-60">{initial[k] || '∅'}</span> → <b>{form[k] || '∅'}</b>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t bg-slate-50/50">
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>
            Annuler
          </Button>
          <Button
            size="sm"
            onClick={save}
            disabled={saving || !hasChanges}
            className="bg-violet-600 hover:bg-violet-700 text-white gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Enregistrer les modifications
          </Button>
        </div>
      </div>
    </div>
  );
}

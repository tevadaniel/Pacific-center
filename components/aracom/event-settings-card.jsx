'use client';

/**
 * 🕐 EventSettingsCard — Section admin pour modifier les horaires du Forum.
 *
 * Toute modification :
 *   1. Sauvegarde via PUT /api/event-settings
 *   2. Invalide le cache module-level (useEventSettings)
 *   3. Tous les écrans connectés (fiche exposant, tunnel, etc.) se rafraîchissent
 *      au prochain mount ou via le notifier listener.
 */

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Save, Clock, Calendar, RefreshCw } from 'lucide-react';
import { api } from '@/lib/auth-client';
import { useEventSettings, invalidateEventSettings } from '@/lib/use-event-settings';
import { generateStandSlots, generateDemoSlots } from '@/lib/event-time-config';
import { EXPOSANT_ADDITIONAL_DOC_TYPES } from '@/lib/exposant-document-types';

export default function EventSettingsCard() {
  const { settings, refresh, loading } = useEventSettings();
  const [draft, setDraft] = useState(settings);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => { setDraft(settings); setDirty(false); }, [settings]);

  const upd = (k, v) => { setDraft((d) => ({ ...d, [k]: v })); setDirty(true); };

  const save = async () => {
    setSaving(true);
    try {
      const fresh = await api('/api/event-settings', { method: 'PUT', body: JSON.stringify(draft) });
      invalidateEventSettings(fresh);
      setDirty(false);
      toast.success('✅ Horaires sauvegardés — tous les workflows utiliseront ces valeurs');
    } catch (e) {
      toast.error(e?.message || 'Erreur sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !draft) {
    return <Card><CardContent className="p-4"><Loader2 className="w-4 h-4 animate-spin" /></CardContent></Card>;
  }

  // Aperçu créneaux dynamiquement générés
  const venStand = generateStandSlots(draft, 'vendredi');
  const samStand = generateStandSlots(draft, 'samedi');
  const venDemo = generateDemoSlots(draft, 'vendredi');
  const samDemo = generateDemoSlots(draft, 'samedi');

  return (
    <Card className="border-blue-200">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Clock className="w-4 h-4 text-blue-600" />
          Horaires & créneaux du Forum
          <Badge variant="outline" className="ml-auto text-[10px]">
            Centralisé · propagation auto
          </Badge>
        </CardTitle>
        <p className="text-[11px] text-slate-500">
          Toute modification est appliquée immédiatement aux workflows : tunnel exposant, fiche admin (CRUD animations), génération PDF.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">

        {/* VENDREDI */}
        <div className="rounded-lg border border-slate-200 p-3 bg-slate-50/50">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-3.5 h-3.5 text-violet-600" />
            <span className="font-bold text-sm text-violet-900">Vendredi</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <FieldRow label="Date" value={draft.friday_date} onChange={(v) => upd('friday_date', v)} type="date" />
            <FieldRow label="Libellé" value={draft.friday_label} onChange={(v) => upd('friday_label', v)} />
            <FieldRow label="Ouverture" value={draft.friday_open} onChange={(v) => upd('friday_open', v)} type="time" />
            <FieldRow label="Fermeture" value={draft.friday_close} onChange={(v) => upd('friday_close', v)} type="time" />
            <FieldRow label="Arrivée exposants" value={draft.exposant_arrival_friday} onChange={(v) => upd('exposant_arrival_friday', v)} type="time" hint="pré-accueil" />
          </div>
          <div className="text-[10px] text-slate-500 mt-2">
            → {venStand.length} créneaux Sur stand · {venDemo.length} créneaux Zone démo
          </div>
        </div>

        {/* SAMEDI */}
        <div className="rounded-lg border border-slate-200 p-3 bg-slate-50/50">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-3.5 h-3.5 text-emerald-600" />
            <span className="font-bold text-sm text-emerald-900">Samedi</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <FieldRow label="Date" value={draft.saturday_date} onChange={(v) => upd('saturday_date', v)} type="date" />
            <FieldRow label="Libellé" value={draft.saturday_label} onChange={(v) => upd('saturday_label', v)} />
            <FieldRow label="Ouverture" value={draft.saturday_open} onChange={(v) => upd('saturday_open', v)} type="time" />
            <FieldRow label="Fermeture" value={draft.saturday_close} onChange={(v) => upd('saturday_close', v)} type="time" />
            <FieldRow label="Arrivée exposants" value={draft.exposant_arrival_saturday} onChange={(v) => upd('exposant_arrival_saturday', v)} type="time" hint="pré-accueil" />
          </div>
          <div className="text-[10px] text-slate-500 mt-2">
            → {samStand.length} créneaux Sur stand · {samDemo.length} créneaux Zone démo
          </div>
        </div>

        {/* DURÉES & PAUSE */}
        <div className="rounded-lg border border-slate-200 p-3 bg-slate-50/50">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            <span className="font-bold text-sm text-amber-900">Durées créneaux & pause déjeuner</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <FieldRow label="Sur stand (min)" value={draft.stand_slot_minutes} onChange={(v) => upd('stand_slot_minutes', Number(v))} type="number" min={5} max={120} />
            <FieldRow label="Zone démo (min)" value={draft.demo_slot_minutes} onChange={(v) => upd('demo_slot_minutes', Number(v))} type="number" min={5} max={120} />
            <FieldRow label="Début pause déjeuner" value={draft.lunch_start} onChange={(v) => upd('lunch_start', v)} type="time" />
            <FieldRow label="Fin pause déjeuner" value={draft.lunch_end} onChange={(v) => upd('lunch_end', v)} type="time" />
          </div>
          <div className="text-[10px] text-slate-500 mt-2">
            La pause déjeuner exclut uniquement les créneaux <b>Zone démo</b> (les stands restent disponibles).
          </div>
        </div>

        {/* 🆕 SESSION 53.21 — Documents complémentaires (activation par ARACOM) */}
        <div className="rounded-lg border border-slate-200 p-3 bg-slate-50/50">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-base">📎</span>
            <span className="font-bold text-sm text-slate-900">Documents complémentaires demandés aux exposants</span>
            <Badge variant="outline" className="ml-auto text-[10px]">
              {(draft.enabled_optional_docs || []).length} activé{(draft.enabled_optional_docs || []).length > 1 ? 's' : ''}
            </Badge>
          </div>
          <div className="text-[10px] text-slate-500 mb-2 italic">
            Par défaut <b>aucun</b> document optionnel n&apos;est demandé aux exposants. Activez ici uniquement ceux nécessaires pour cette édition. ARACOM garde toujours accès à tous les types depuis la fiche admin.
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
            {EXPOSANT_ADDITIONAL_DOC_TYPES.filter((t) => t.key !== 'autre').map((t) => {
              const isEnabled = (draft.enabled_optional_docs || []).includes(t.key);
              return (
                <label
                  key={t.key}
                  className={`flex items-start gap-2 px-2 py-1.5 rounded border cursor-pointer transition ${
                    isEnabled ? 'bg-emerald-50 border-emerald-300' : 'bg-white border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isEnabled}
                    onChange={(e) => {
                      const cur = new Set(draft.enabled_optional_docs || []);
                      if (e.target.checked) cur.add(t.key); else cur.delete(t.key);
                      upd('enabled_optional_docs', Array.from(cur));
                    }}
                    className="mt-0.5"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-slate-900">{t.label}</div>
                    <div className="text-[10px] text-slate-500">{t.subtitle}</div>
                  </div>
                </label>
              );
            })}
            {/* "autre" (nom libre) toujours dispo si au moins un doc est activé */}
            <label className="flex items-start gap-2 px-2 py-1.5 rounded border bg-white border-dashed border-slate-300 text-slate-500 col-span-full">
              <span className="text-base mt-0.5">📎</span>
              <div className="text-[11px] italic">
                « Autre document (nom libre) » est toujours disponible côté admin. Pour les exposants, il sera affiché si au moins un autre type est activé ci-dessus.
              </div>
            </label>
          </div>
        </div>

        {/* ACTIONS */}
        <div className="flex items-center gap-2 pt-1">
          <Button onClick={save} disabled={!dirty || saving} className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Sauvegarder
          </Button>
          <Button variant="ghost" onClick={() => { setDraft(settings); setDirty(false); }} disabled={!dirty || saving} className="text-xs">
            Annuler
          </Button>
          <Button variant="outline" size="sm" onClick={refresh} className="ml-auto text-xs gap-1" disabled={saving}>
            <RefreshCw className="w-3 h-3" /> Recharger
          </Button>
          {dirty && <span className="text-[10px] text-amber-700 ml-2">⚠️ Modifications non sauvegardées</span>}
        </div>
      </CardContent>
    </Card>
  );
}

function FieldRow({ label, value, onChange, type = 'text', hint, min, max }) {
  return (
    <div>
      <Label className="text-[10px] uppercase tracking-wide text-slate-500">{label}</Label>
      <Input
        type={type}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        min={min}
        max={max}
        className="h-8 text-xs mt-0.5"
      />
      {hint && <div className="text-[9px] text-slate-400 italic mt-0.5">{hint}</div>}
    </div>
  );
}

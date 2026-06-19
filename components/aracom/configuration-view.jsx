'use client';

/**
 * 🆕 SESSION 48n — Vue Configuration ARACOM
 * Onglet "Système > Configuration" — Toggles globaux de la plateforme.
 *
 * Inclut :
 *  - 📝 Activation du questionnaire de satisfaction (visible côté Exposant)
 */
import { useEffect, useState } from 'react';
import { api } from '@/lib/auth-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Settings, ClipboardCheck, Info, RefreshCw, Loader2, FileText } from 'lucide-react';
import { toast } from 'sonner';
import EventSettingsCard from '@/components/aracom/event-settings-card';

export default function ConfigurationView() {
  const [surveyEnabled, setSurveyEnabled] = useState(null);
  const [surveyMeta, setSurveyMeta] = useState({ updated_at: null, updated_by: null });
  const [busy, setBusy] = useState(false);
  // 🆕 SESSION 53.22 — Maintenance : régénération en masse des PDF
  const [regenBusy, setRegenBusy] = useState(false);
  const [regenResult, setRegenResult] = useState(null);
  const [selectedDocTypes, setSelectedDocTypes] = useState({ convention: true, recu_caution: false, guide_participant: false });
  const [regenScope, setRegenScope] = useState('with_existing');

  const load = async () => {
    try {
      const r = await api('/api/settings/survey-enabled');
      setSurveyEnabled(Boolean(r?.enabled));
      setSurveyMeta({ updated_at: r?.updated_at || null, updated_by: r?.updated_by || null });
    } catch (e) {
      console.error('[ConfigurationView] load failed', e);
    }
  };

  useEffect(() => { load(); }, []);

  const toggleSurvey = async (next) => {
    setBusy(true);
    try {
      const r = await api('/api/settings/survey-enabled', {
        method: 'POST',
        body: JSON.stringify({ enabled: Boolean(next) }),
      });
      setSurveyEnabled(Boolean(r?.enabled));
      toast.success(next ? '✅ Questionnaire de satisfaction ACTIVÉ pour tous les exposants' : '⏸ Questionnaire de satisfaction désactivé');
      await load();
    } catch (e) {
      toast.error(e?.message || 'Erreur lors du toggle');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Settings className="w-5 h-5 text-slate-700" />
        <h2 className="text-lg font-semibold text-slate-900">Configuration générale</h2>
        <span className="text-xs text-slate-500 italic">Réglages globaux appliqués à toute la plateforme</span>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          📝 TOGGLE : Questionnaire de satisfaction (côté Exposant)
      ═══════════════════════════════════════════════════════════════════ */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-md bg-violet-100 flex items-center justify-center shrink-0">
                <ClipboardCheck className="w-5 h-5 text-violet-700" />
              </div>
              <div>
                <CardTitle className="text-base">Questionnaire de satisfaction</CardTitle>
                <p className="text-xs text-slate-500 mt-0.5">Activer ou désactiver l&apos;accès au questionnaire pour tous les exposants connectés au portail</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {surveyEnabled === null ? (
                <Badge variant="secondary" className="text-[10px]">Chargement…</Badge>
              ) : surveyEnabled ? (
                <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px]">🟢 ACTIVÉ</Badge>
              ) : (
                <Badge className="bg-slate-100 text-slate-700 border-slate-300 text-[10px]">⚪ Désactivé</Badge>
              )}
              <Switch
                checked={Boolean(surveyEnabled)}
                onCheckedChange={toggleSurvey}
                disabled={busy || surveyEnabled === null}
                data-testid="toggle-survey-enabled"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md bg-slate-50 border border-slate-200 p-3 text-xs text-slate-700 space-y-1.5">
            <div className="flex items-start gap-2">
              <Info className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
              <div>
                <p>
                  <b>Comportement :</b> lorsque ce toggle est <b>activé</b>, le bandeau « Donner mon avis » s&apos;affiche dans le portail
                  exposant et les exposants peuvent soumettre leur questionnaire. Lorsqu&apos;il est <b>désactivé</b>, le bandeau
                  est masqué et les soumissions sont bloquées.
                </p>
                <p className="mt-1.5">
                  Conseillé : activer ce toggle <b>après l&apos;événement</b> (à partir du 16 août 2026) pour collecter les retours,
                  puis désactiver une fois la phase de collecte terminée.
                </p>
              </div>
            </div>
          </div>
          {surveyMeta.updated_at && (
            <div className="text-[10px] text-slate-500 mt-2 italic">
              Dernière modification : {new Date(surveyMeta.updated_at).toLocaleString('fr-FR')} par {surveyMeta.updated_by || '—'}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 🆕 SESSION 53.20 — Horaires & créneaux centralisés du Forum */}
      <EventSettingsCard />

      {/* Placeholder pour d'autres toggles globaux à venir */}
      <Card className="border-dashed">
        <CardContent className="p-4 text-center text-xs text-slate-500 italic">
          D&apos;autres paramètres globaux pourront être ajoutés ici par la suite (mode test mail, RIB, etc.).
        </CardContent>
      </Card>
    </div>
  );
}

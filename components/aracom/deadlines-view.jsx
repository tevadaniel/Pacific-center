'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, Trash2, Sparkles } from 'lucide-react';
import { api } from '@/lib/auth-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

const DEADLINE_STEPS = [
  { key: 'profile', label: 'Profil complété', icon: '👤', desc: 'Coordonnées, discipline, description' },
  { key: 'stand', label: 'Site & stand choisis', icon: '📍', desc: 'Sélection du stand sur le plan' },
  { key: 'animation', label: 'Animation choisie', icon: '🎯', desc: '1 créneau d\'animation par jour' },
  { key: 'documents', label: 'Documents déposés', icon: '📄', desc: 'Assurance, RIB, autres docs' },
  { key: 'caution', label: 'Caution payée', icon: '💰', desc: 'Versement effectué auprès d\'ARACOM' },
  { key: 'convention', label: 'Convention signée', icon: '📋', desc: 'Téléchargée, signée et redéposée' },
];

/**
 * DEADLINES VIEW — Configuration des dates limites par étape du parcours exposant.
 *
 * Endpoints :
 *  - GET  /api/step-deadlines
 *  - POST /api/step-deadlines (body: { deadlines: { profile: ISO, stand: ISO, ... } })
 */
export default function DeadlinesView() {
  const [deadlines, setDeadlines] = useState({});
  const [meta, setMeta] = useState({ updated_at: null, updated_by: null });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    api('/api/step-deadlines')
      .then(d => { setDeadlines(d.deadlines || {}); setMeta({ updated_at: d.updated_at, updated_by: d.updated_by }); })
      .catch(e => toast.error(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const updateField = (key, val) => setDeadlines(prev => ({ ...prev, [key]: val || null }));

  const save = async () => {
    setSaving(true);
    try {
      const cleaned = {};
      for (const [k, v] of Object.entries(deadlines)) {
        cleaned[k] = v ? new Date(v + 'T23:59:59').toISOString() : null;
      }
      await api('/api/step-deadlines', { method: 'POST', body: JSON.stringify({ deadlines: cleaned }) });
      toast.success('Deadlines mises à jour');
      load();
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const clearAll = async () => {
    if (!window.confirm('Effacer toutes les deadlines ?')) return;
    setSaving(true);
    try {
      const cleaned = Object.fromEntries(DEADLINE_STEPS.map(s => [s.key, null]));
      await api('/api/step-deadlines', { method: 'POST', body: JSON.stringify({ deadlines: cleaned }) });
      toast.success('Deadlines effacées');
      load();
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const toInputDate = (iso) => {
    if (!iso) return '';
    try { return new Date(iso).toISOString().slice(0, 10); } catch { return ''; }
  };

  if (loading) return <div className="p-8 text-center text-slate-500">Chargement…</div>;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <div className="space-y-4 max-w-4xl">
      <Card className="bg-gradient-to-br from-violet-50 to-fuchsia-50 border-violet-200">
        <CardContent className="p-4 flex items-start gap-3">
          <span className="text-2xl">⏰</span>
          <div>
            <p className="font-medium text-violet-900">Deadlines par étape</p>
            <p className="text-sm text-violet-800 mt-1 leading-relaxed">
              Définissez une date limite pour chaque étape de progression des exposants. Si la deadline est <b>dépassée</b>, l&apos;étape reste modifiable mais une <b>anomalie est créée automatiquement</b> et un <b>email de relance</b> est envoyé. Le compte à rebours est visible côté Exposant.
            </p>
            {meta.updated_at && (
              <p className="text-xs text-violet-600 mt-2">
                Dernière modification : {new Date(meta.updated_at).toLocaleString('fr-FR')} par {meta.updated_by}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Configuration des dates limites</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {DEADLINE_STEPS.map(step => {
            const val = toInputDate(deadlines[step.key]);
            const dl = deadlines[step.key] ? new Date(deadlines[step.key]) : null;
            const overdue = dl && dl < today;
            const daysLeft = dl ? Math.ceil((dl - today) / (1000 * 60 * 60 * 24)) : null;
            return (
              <div key={step.key} className={`grid sm:grid-cols-[1fr_180px_120px] gap-3 items-center p-3 rounded-md border ${overdue ? 'bg-red-50 border-red-200' : daysLeft !== null && daysLeft <= 3 ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{step.icon}</span>
                  <div>
                    <div className="font-medium text-sm">{step.label}</div>
                    <div className="text-xs text-slate-500">{step.desc}</div>
                  </div>
                </div>
                <Input
                  type="date"
                  value={val}
                  onChange={(e) => updateField(step.key, e.target.value)}
                  className="text-sm"
                />
                <div className="text-xs">
                  {!val ? (
                    <span className="text-slate-400">— pas de deadline —</span>
                  ) : overdue ? (
                    <Badge className="bg-red-600 text-white">⚠️ Dépassée</Badge>
                  ) : daysLeft === 0 ? (
                    <Badge className="bg-orange-500 text-white">Aujourd&apos;hui</Badge>
                  ) : daysLeft <= 3 ? (
                    <Badge className="bg-amber-500 text-white">J-{daysLeft}</Badge>
                  ) : daysLeft <= 7 ? (
                    <Badge className="bg-yellow-500 text-white">J-{daysLeft}</Badge>
                  ) : (
                    <Badge variant="secondary">J-{daysLeft}</Badge>
                  )}
                </div>
              </div>
            );
          })}

          <div className="flex flex-wrap gap-2 pt-3 border-t">
            <Button onClick={save} disabled={saving} className="gap-2">
              <CheckCircle2 className="w-4 h-4" /> {saving ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
            <Button variant="outline" onClick={clearAll} disabled={saving} className="gap-2">
              <Trash2 className="w-4 h-4" /> Effacer toutes les deadlines
            </Button>
            <div className="flex-1" />
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const eventDate = new Date('2026-08-14');
                const suggest = (daysBefore) => new Date(eventDate.getTime() - daysBefore * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
                setDeadlines({
                  profile: suggest(60),
                  stand: suggest(45),
                  animation: suggest(30),
                  documents: suggest(21),
                  caution: suggest(14),
                  convention: suggest(7),
                });
                toast.success('Suggestion appliquée — pensez à enregistrer');
              }}
            >
              <Sparkles className="w-3 h-3 mr-1" /> Suggestion auto (60→7 jours avant J)
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

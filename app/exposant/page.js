'use client';

import { useEffect, useState } from 'react';
import { Shell, KpiCard } from '@/components/app-shell';
import { api, getSession } from '@/lib/auth-client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { Building2, MapPin, Calendar, FileCheck2, Wallet, CheckCircle2, XCircle, Info, Mail, Phone, Clock } from 'lucide-react';
import { REGISTRATION_STATUS_LABEL, REGISTRATION_STATUS_COLOR, DEPOSIT_STATUS_LABEL, DEPOSIT_AMOUNT_XPF } from '@/lib/constants';

export default function ExposantPortal() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const me = await api('/api/auth/me');
        if (!me.organization) { toast.error('Aucune organisation liée à ce compte'); return; }
        // Find registration for this org
        const regs = await api('/api/registrations');
        const mine = regs.find(r => r.organization_id === me.organization.id);
        if (!mine) { setData({ me, registration: null }); setLoading(false); return; }
        const full = await api(`/api/registrations/${mine.id}`);
        setData({ me, ...full });
      } catch (e) { toast.error(e.message); }
      setLoading(false);
    })();
  }, []);

  if (loading) return <Shell title="Mon dossier exposant" allowedRoles={['exposant']}><div className="py-20 text-center text-slate-500">Chargement…</div></Shell>;
  if (!data?.registration) {
    return <Shell title="Mon dossier exposant" allowedRoles={['exposant']}><Card><CardContent className="py-12 text-center">
      <Info className="w-12 h-12 mx-auto text-slate-400" />
      <p className="mt-3 font-medium">Votre dossier n’a pas encore été initialisé</p>
      <p className="text-slate-500 text-sm">L’équipe ARACOM va bientôt vous contacter.</p>
    </CardContent></Card></Shell>;
  }

  const r = data.registration, o = data.organization, v = data.venue, d = data.deposit;
  const checks = [
    { ok: r.is_convention_signed, label: 'Convention signée' },
    { ok: d?.status === 'recue', label: 'Caution reçue' },
    { ok: r.is_insurance_uploaded, label: 'Assurance déposée' },
    { ok: r.is_guide_sent, label: 'Guide exposant reçu' },
  ];
  const completion = Math.round((checks.filter(c => c.ok).length / checks.length) * 100);

  return (
    <Shell title={`Dossier — ${o?.name || 'Mon exposant'}`} subtitle="Votre espace personnel pour le Forum de la Rentrée 2026." allowedRoles={['exposant']}>
      <div className="space-y-6">
        <Card className="bg-gradient-to-br from-blue-50 to-emerald-50 border-blue-100">
          <CardContent className="p-6 flex flex-col md:flex-row md:items-center gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2"><Building2 className="w-5 h-5 text-blue-600" /><h2 className="text-2xl font-bold">{o?.name}</h2></div>
              <p className="text-slate-600 mt-1">{o?.discipline}</p>
              <div className="flex flex-wrap gap-2 mt-3">
                <Badge variant="secondary"><MapPin className="w-3 h-3 mr-1" /> {v?.name}</Badge>
                <Badge variant="secondary" className="font-mono">Stand {r.stand_code}</Badge>
                <Badge className={REGISTRATION_STATUS_COLOR[r.status]}>{REGISTRATION_STATUS_LABEL[r.status]}</Badge>
              </div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-blue-700">{completion}%</div>
              <div className="text-xs text-slate-500 uppercase tracking-wider">Dossier complet</div>
              <Progress value={completion} className="h-2 w-32 mt-2" />
            </div>
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Calendar className="w-4 h-4 text-blue-600" /> Mes créneaux d’animation</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {data.slots.length === 0 ? <p className="text-slate-500 text-sm">Aucun créneau planifié pour l’instant.</p> : data.slots.map(s => (
                <div key={s.id} className="border rounded-md p-3 flex items-center justify-between">
                  <div>
                    <div className="font-medium">{s.day_label === 'vendredi' ? 'Vendredi 14 août' : 'Samedi 15 août'}</div>
                    <div className="text-xs text-slate-500"><Clock className="w-3 h-3 inline mr-1" /> {s.start_time} – {s.end_time} • {s.title}</div>
                  </div>
                  <Badge variant="secondary">{s.status}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><FileCheck2 className="w-4 h-4 text-emerald-600" /> Chémincheminement de mon dossier</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {checks.map((c, i) => (
                <div key={i} className="flex items-center justify-between border rounded-md p-3">
                  <div className="flex items-center gap-2">
                    {c.ok ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <XCircle className="w-4 h-4 text-slate-300" />}
                    <span className={c.ok ? 'text-slate-900 font-medium' : 'text-slate-600'}>{c.label}</span>
                  </div>
                  {!c.ok && <Badge variant="secondary" className="text-xs">À faire</Badge>}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Wallet className="w-4 h-4 text-blue-600" /> Caution (20 000 XPF)</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <div className="rounded-md bg-blue-50 border border-blue-100 p-4">
                <div className="text-sm text-slate-600">Statut actuel</div>
                <div className="text-2xl font-bold text-blue-700">{DEPOSIT_STATUS_LABEL[d?.status] || '—'}</div>
                {d?.received_at && <div className="text-xs text-slate-500 mt-1">Reçue le {new Date(d.received_at).toLocaleDateString('fr-FR')}</div>}
              </div>
              <div className="text-xs text-slate-500 bg-amber-50 border border-amber-100 rounded-md p-3">
                <strong>Œ Rappel :</strong> la caution est obligatoire pour valider votre inscription. Chèque, virement ou espèces acceptés.
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Info className="w-4 h-4 text-violet-600" /> Mes coordonnées</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center gap-2"><Mail className="w-4 h-4 text-slate-400" /> {o?.main_email || '—'}</div>
              <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-slate-400" /> {o?.main_phone || '—'}</div>
              <div className="flex items-center gap-2"><Info className="w-4 h-4 text-slate-400" /> Contact principal : {o?.contact_name || '—'}</div>
              <div className="flex items-center gap-2"><Clock className="w-4 h-4 text-slate-400" /> Horaire prévu : {r.planned_arrival_time} – {r.planned_departure_time}</div>
            </CardContent>
          </Card>
        </div>

        {data.anomalies?.length > 0 && (
          <Card className="border-red-100 bg-red-50/20">
            <CardHeader><CardTitle className="text-base text-red-900">Remarques terrain</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {data.anomalies.map(a => (
                <div key={a.id} className="border rounded-md p-3 bg-white">
                  <div className="flex items-center justify-between"><div className="font-medium">{a.title}</div><Badge variant="destructive">{a.severity_level}</Badge></div>
                  <p className="text-sm text-slate-600 mt-1">{a.description}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </Shell>
  );
}

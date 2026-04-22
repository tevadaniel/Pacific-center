'use client';

import { useEffect, useState } from 'react';
import { Shell, KpiCard } from '@/components/app-shell';
import { api } from '@/lib/auth-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { MapPin, Users, TrendingUp, FileDown, AlertTriangle, Eye, Calendar, Sparkles } from 'lucide-react';

export default function PacificCentersPage() {
  const [kpis, setKpis] = useState(null);
  const [sites, setSites] = useState([]);
  const [slots, setSlots] = useState([]);
  const [day, setDay] = useState('vendredi');

  useEffect(() => { (async () => {
    try {
      const [k, s, a] = await Promise.all([api('/api/dashboard/kpis'), api('/api/dashboard/by-site'), api('/api/animation-slots')]);
      setKpis(k); setSites(s); setSlots(a);
    } catch (e) { toast.error(e.message); }
  })(); }, []);

  if (!kpis) return <Shell title="Portail Pacific Centers" allowedRoles={['pacific_centers_readonly']}><div className="py-12 text-center text-slate-500">Chargement…</div></Shell>;

  const totalStands = sites.reduce((a, s) => a + s.capacity_stands, 0);
  const totalAssigned = sites.reduce((a, s) => a + s.assigned, 0);
  const globalFill = totalStands ? Math.round((totalAssigned / totalStands) * 100) : 0;
  const underFilled = sites.filter(s => s.remplissage < 60);

  const daySlots = slots.filter(s => s.day_label === day);

  const exportReport = () => {
    const data = { kpis, sites, generated_at: new Date().toLocaleString('fr-FR') };
    const rows = [
      ['Vue consolidée Pacific Centers'],
      [`Généré le ${new Date().toLocaleString('fr-FR')}`],
      [''],
      ['Indicateurs globaux'],
      ['Exposants totaux', kpis.total],
      ['Confirmés', kpis.by_status?.confirme || 0],
      ['À relancer', kpis.by_status?.a_relancer || 0],
      ['Conventions signées', kpis.conv_signed],
      [''],
      ['Par site'],
      ['Site', 'Capacité', 'Attribués', 'Confirmés', 'Remplissage'],
      ...sites.map(s => [s.venue_name, s.capacity_stands, s.assigned, s.confirmed, `${s.remplissage}%`]),
    ];
    const w = window.open('', '_blank');
    w.document.write(`<!doctype html><html><head><title>Synthèse Pacific Centers</title><style>body{font-family:system-ui;padding:40px;max-width:900px;margin:auto}h1{color:#7c3aed;margin:0 0 4px}h2{font-size:14px;color:#64748b;text-transform:uppercase;letter-spacing:.1em;margin:0 0 32px}table{border-collapse:collapse;width:100%;margin:16px 0}td,th{padding:10px;border-bottom:1px solid #e2e8f0;text-align:left}th{background:#faf5ff;font-weight:600}button{position:fixed;top:16px;right:16px;padding:10px 18px;background:#7c3aed;color:#fff;border:0;border-radius:6px;cursor:pointer}@media print{button{display:none}}</style></head><body><button onclick="window.print()">Imprimer / PDF</button><h1>Forum de la Rentrée 2026 — Synthèse Pacific Centers</h1><h2>Lecture seule • Généré le ${new Date().toLocaleString('fr-FR')}</h2>${rows.map(r => Array.isArray(r) && r.length > 1 ? `<table><tr>${r.map((c, i) => i === 0 ? `<th style="width:240px">${c}</th>` : `<td>${c}</td>`).join('')}</tr></table>` : `<h3>${r[0]}</h3>`).join('')}</body></html>`);
    w.document.close();
  };

  return (
    <Shell
      title="Portail Pacific Centers"
      subtitle="Vue lecture seule consolidée — taux de remplissage, exposants confirmés et synthèses."
      allowedRoles={['pacific_centers_readonly']}
      right={<Button variant="outline" onClick={exportReport} className="gap-2"><FileDown className="w-4 h-4" /> Export PDF</Button>}
    >
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard label="Exposants" value={kpis.total} accent="violet" icon={Users} />
          <KpiCard label="Confirmés" value={kpis.by_status?.confirme || 0} accent="emerald" />
          <KpiCard label="Remplissage" value={`${globalFill}%`} accent="blue" icon={TrendingUp} hint={`${totalAssigned}/${totalStands} stands`} />
          <KpiCard label="Conventions" value={kpis.conv_signed} accent="emerald" />
        </div>

        {underFilled.length > 0 && (
          <Card className="border-orange-200 bg-orange-50/30">
            <CardContent className="p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-orange-900">{underFilled.length} site(s) sous le seuil de 60 %</p>
                <p className="text-sm text-orange-700">{underFilled.map(s => `${s.venue_name} (${s.remplissage}%)`).join(' • ')}</p>
              </div>
            </CardContent>
          </Card>
        )}

        <div>
          <h3 className="font-semibold text-slate-900 mb-3">Remplissage par site</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sites.map(s => (
              <Card key={s.venue_id}>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-violet-600" /><div className="font-semibold">{s.venue_name}</div></div>
                    <Badge variant={s.remplissage >= 80 ? 'default' : 'secondary'} className={s.remplissage >= 80 ? 'bg-emerald-600' : ''}>{s.remplissage}%</Badge>
                  </div>
                  <Progress value={(s.assigned / s.capacity_stands) * 100} className="h-2 mb-3" />
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div><div className="text-lg font-bold">{s.capacity_stands}</div><div className="text-[11px] text-slate-500 uppercase">Capacité</div></div>
                    <div><div className="text-lg font-bold text-emerald-600">{s.confirmed}</div><div className="text-[11px] text-slate-500 uppercase">Confirmés</div></div>
                    <div><div className="text-lg font-bold text-blue-600">{s.assigned}</div><div className="text-[11px] text-slate-500 uppercase">Attribués</div></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2"><Calendar className="w-4 h-4 text-violet-600" /> Planning des animations</CardTitle>
              <div className="flex gap-2">
                <Button size="sm" variant={day === 'vendredi' ? 'default' : 'outline'} onClick={() => setDay('vendredi')}>Ven 14/08</Button>
                <Button size="sm" variant={day === 'samedi' ? 'default' : 'outline'} onClick={() => setDay('samedi')}>Sam 15/08</Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-y text-left text-xs uppercase text-slate-500"><tr><th className="py-2 px-4">Site</th><th>Horaire</th><th>Exposant</th><th>Discipline</th><th>Stand</th><th>Animation</th></tr></thead>
              <tbody className="divide-y">
                {daySlots.length === 0 ? <tr><td colSpan="6" className="py-6 text-center text-slate-400">Pas de créneaux pour ce jour.</td></tr> :
                  daySlots.map(s => (
                    <tr key={s.id}>
                      <td className="py-2 px-4">{s.venue_name}</td>
                      <td className="text-xs">{s.start_time}–{s.end_time}</td>
                      <td className="font-medium">{s.organization_name}</td>
                      <td className="text-slate-600">{s.discipline}</td>
                      <td className="font-mono text-xs">{s.stand_code}</td>
                      <td className="text-slate-600">{s.title}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card className="bg-violet-50/30 border-violet-100">
          <CardContent className="p-4 flex items-start gap-3">
            <Eye className="w-5 h-5 text-violet-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-violet-900">Accès en lecture seule</p>
              <p className="text-sm text-violet-700">Les montants de cautions individuels et les données sensibles sont masqués. Pour toute action opérationnelle, contactez ARACOM.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </Shell>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { Shell, KpiCard } from '@/components/app-shell';
import { api } from '@/lib/auth-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { toast } from 'sonner';
import { MapPin, Users, TrendingUp, FileDown, AlertTriangle, Eye, Calendar, Sparkles, LayoutGrid, FileText, Activity } from 'lucide-react';

export default function PacificCentersPage() {
  return (
    <Shell
      title="Portail Pacific Centers"
      subtitle="Vue lecture seule consolidée — taux de remplissage, exposants confirmés, planning et reporting."
      allowedRoles={['pacific_centers_readonly']}
    >
      <Tabs defaultValue="synthese">
        <TabsList className="w-full grid grid-cols-4">
          <TabsTrigger value="synthese">Synthèse</TabsTrigger>
          <TabsTrigger value="sites">Sites & plan</TabsTrigger>
          <TabsTrigger value="planning">Planning animations</TabsTrigger>
          <TabsTrigger value="reporting">Reporting</TabsTrigger>
        </TabsList>
        <TabsContent value="synthese" className="space-y-6 mt-4"><SyntheseView /></TabsContent>
        <TabsContent value="sites" className="space-y-6 mt-4"><SitesView /></TabsContent>
        <TabsContent value="planning" className="space-y-6 mt-4"><PlanningView /></TabsContent>
        <TabsContent value="reporting" className="space-y-6 mt-4"><ReportingView /></TabsContent>
      </Tabs>
    </Shell>
  );
}

function SyntheseView() {
  const [kpis, setKpis] = useState(null);
  const [sites, setSites] = useState([]);
  useEffect(() => { (async () => {
    try {
      const [k, s] = await Promise.all([api('/api/dashboard/kpis'), api('/api/dashboard/by-site')]);
      setKpis(k); setSites(s);
    } catch (e) { toast.error(e.message); }
  })(); }, []);
  if (!kpis) return <div className="py-12 text-center text-slate-500">Chargement…</div>;
  const totalStands = sites.reduce((a, s) => a + s.capacity_stands, 0);
  const totalAssigned = sites.reduce((a, s) => a + s.assigned, 0);
  const globalFill = totalStands ? Math.round((totalAssigned / totalStands) * 100) : 0;
  const underFilled = sites.filter(s => s.remplissage < 60);

  const exportReport = () => {
    const w = window.open('', '_blank');
    const rows = sites.map(s => `<tr><td>${s.venue_name}</td><td>${s.capacity_stands}</td><td>${s.assigned}</td><td>${s.confirmed}</td><td>${s.remplissage}%</td></tr>`).join('');
    w.document.write(`<!doctype html><html><head><title>Synthèse Pacific Centers</title><style>body{font-family:system-ui;padding:40px;max-width:900px;margin:auto}h1{color:#7c3aed;margin:0 0 4px}h2{font-size:14px;color:#64748b;text-transform:uppercase;letter-spacing:.1em;margin:0 0 32px}table{border-collapse:collapse;width:100%;margin:16px 0}td,th{padding:10px;border-bottom:1px solid #e2e8f0;text-align:left}th{background:#faf5ff;font-weight:600}button{position:fixed;top:16px;right:16px;padding:10px 18px;background:#7c3aed;color:#fff;border:0;border-radius:6px;cursor:pointer}@media print{button{display:none}}</style></head><body><button onclick="window.print()">Imprimer / PDF</button><h1>Forum de la Rentrée 2026 — Synthèse Pacific Centers</h1><h2>Lecture seule • Généré le ${new Date().toLocaleString('fr-FR')}</h2><p>Exposants totaux : <strong>${kpis.total}</strong> • Confirmés : ${kpis.by_status?.confirme || 0} • Conventions signées : ${kpis.conv_signed}</p><table><thead><tr><th>Site</th><th>Capacité</th><th>Attribués</th><th>Confirmés</th><th>Remplissage</th></tr></thead><tbody>${rows}</tbody></table></body></html>`);
    w.document.close();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end"><Button variant="outline" onClick={exportReport} className="gap-2"><FileDown className="w-4 h-4" /> Export PDF synthèse</Button></div>
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
      <Card className="bg-violet-50/30 border-violet-100">
        <CardContent className="p-4 flex items-start gap-3">
          <Eye className="w-5 h-5 text-violet-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-violet-900">Accès en lecture seule</p>
            <p className="text-sm text-violet-700">Les montants individuels de caution sont masqués. Pour toute action opérationnelle, contactez ARACOM.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SitesView() {
  const [venues, setVenues] = useState([]);
  const [selectedVenueId, setSelectedVenueId] = useState('');
  const [stands, setStands] = useState([]);
  useEffect(() => { api('/api/venues').then(v => { setVenues(v); if (v[0]) setSelectedVenueId(v[0].id); }); }, []);
  useEffect(() => { if (selectedVenueId) api(`/api/venues/${selectedVenueId}/stands`).then(setStands); }, [selectedVenueId]);
  const selectedVenue = venues.find(v => v.id === selectedVenueId);
  const occupied = stands.filter(s => s.organization).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {venues.map(v => (
          <Button key={v.id} variant={selectedVenueId === v.id ? 'default' : 'outline'} onClick={() => setSelectedVenueId(v.id)} className={selectedVenueId === v.id ? 'bg-violet-600 hover:bg-violet-700' : ''}><MapPin className="w-4 h-4 mr-2" /> {v.name}</Button>
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><LayoutGrid className="w-4 h-4 text-violet-600" /> Plan stands — {selectedVenue?.name}</CardTitle>
          <p className="text-xs text-slate-500 mt-1">{stands.length} stands • {occupied} attribués • {stands.length - occupied} libres</p>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 text-xs mb-3 flex-wrap">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-200 border border-emerald-300"></span> confirmé</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-200 border border-amber-300"></span> à confirmer</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-orange-200 border border-orange-300"></span> à relancer</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-white border"></span> libre</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
            {stands.map(s => (
              <div key={s.id} className={`rounded-md border p-3 ${s.organization ? (s.registration_status === 'confirme' ? 'bg-emerald-50 border-emerald-200' : s.registration_status === 'a_confirmer' ? 'bg-amber-50 border-amber-200' : s.registration_status === 'a_relancer' ? 'bg-orange-50 border-orange-200' : 'bg-slate-50') : 'bg-white'}`}>
                <div className="font-mono text-xs font-bold">{s.stand_code}</div>
                <div className="text-xs text-slate-700 mt-1 truncate">{s.organization?.name || <span className="text-slate-400 italic">libre</span>}</div>
                {s.organization && <div className="text-[10px] text-slate-500 truncate">{s.organization.discipline}</div>}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Exposants confirmés — {selectedVenue?.name}</CardTitle></CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-y text-left text-xs uppercase text-slate-500"><tr><th className="py-2 px-4">Stand</th><th>Exposant</th><th>Discipline</th><th>Statut</th></tr></thead>
            <tbody className="divide-y">
              {stands.filter(s => s.organization).length === 0 ? <tr><td colSpan="4" className="py-6 text-center text-slate-400">Aucun exposant attribué.</td></tr> :
                stands.filter(s => s.organization).map(s => (
                  <tr key={s.id}>
                    <td className="py-2 px-4 font-mono text-xs">{s.stand_code}</td>
                    <td className="font-medium">{s.organization.name}</td>
                    <td className="text-slate-600">{s.organization.discipline}</td>
                    <td><Badge variant="secondary">{s.registration_status || '—'}</Badge></td>
                  </tr>
                ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function PlanningView() {
  const [slots, setSlots] = useState([]);
  const [day, setDay] = useState('vendredi');
  const [venueId, setVenueId] = useState('');
  const [venues, setVenues] = useState([]);
  useEffect(() => { api('/api/animation-slots').then(setSlots); api('/api/venues').then(setVenues); }, []);
  const filtered = slots.filter(s => s.day_label === day && (!venueId || s.venue_id === venueId)).sort((a, b) => (a.venue_name || '').localeCompare(b.venue_name || '') || (a.start_time || '').localeCompare(b.start_time || ''));
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base flex items-center gap-2"><Calendar className="w-4 h-4 text-violet-600" /> Planning des animations</CardTitle>
            <div className="flex gap-2">
              <Button size="sm" variant={day === 'vendredi' ? 'default' : 'outline'} onClick={() => setDay('vendredi')} className={day === 'vendredi' ? 'bg-violet-600' : ''}>Ven 14/08</Button>
              <Button size="sm" variant={day === 'samedi' ? 'default' : 'outline'} onClick={() => setDay('samedi')} className={day === 'samedi' ? 'bg-violet-600' : ''}>Sam 15/08</Button>
              <Select value={venueId || 'all'} onValueChange={v => setVenueId(v === 'all' ? '' : v)}>
                <SelectTrigger className="w-[180px]"><SelectValue placeholder="Site" /></SelectTrigger>
                <SelectContent><SelectItem value="all">Tous les sites</SelectItem>{venues.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-y text-left text-xs uppercase text-slate-500"><tr><th className="py-2 px-4">Site</th><th>Horaire</th><th>Type</th><th>Exposant</th><th>Animation</th><th>Description</th></tr></thead>
            <tbody className="divide-y">
              {filtered.length === 0 ? <tr><td colSpan="6" className="py-6 text-center text-slate-400">Aucun créneau pour ce jour/site.</td></tr> :
                filtered.map(s => (
                  <tr key={s.id}>
                    <td className="py-2 px-4">{s.venue_name}</td>
                    <td className="text-xs">{s.start_time}–{s.end_time}</td>
                    <td><Badge variant="secondary" className="text-[10px]">{s.location_type || s.slot_type}</Badge></td>
                    <td className="font-medium">{s.organization_name}</td>
                    <td className="text-slate-700">{s.title}</td>
                    <td className="text-xs text-slate-600 max-w-[300px]">{s.description || '—'}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function ReportingView() {
  const [anomalies, setAnomalies] = useState([]);
  const [reports, setReports] = useState([]);
  useEffect(() => { api('/api/anomalies').then(setAnomalies); api('/api/reports').then(setReports); }, []);

  const byType = anomalies.reduce((a, x) => { a[x.anomaly_type] = (a[x.anomaly_type] || 0) + 1; return a; }, {});
  const bySev = anomalies.reduce((a, x) => { a[x.severity_level] = (a[x.severity_level] || 0) + 1; return a; }, {});
  const openCount = anomalies.filter(a => a.resolved_status !== 'resolu').length;

  const openReport = (r) => {
    const w = window.open('', '_blank');
    const data = r.report_data_json || {};
    const rows = Object.entries(data).map(([k, v]) => `<tr><th>${k}</th><td>${typeof v === 'object' ? '<pre>' + JSON.stringify(v, null, 2) + '</pre>' : v}</td></tr>`).join('');
    w.document.write(`<!doctype html><html><head><title>${r.report_type}</title><style>body{font-family:system-ui;padding:32px;max-width:900px;margin:auto}h1{color:#7c3aed}table{border-collapse:collapse;width:100%}th,td{padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:left;vertical-align:top}th{background:#faf5ff;width:240px}pre{background:#f1f5f9;padding:12px;border-radius:6px;font-size:12px}button{position:fixed;top:16px;right:16px;padding:10px 18px;background:#7c3aed;color:#fff;border:0;border-radius:6px;cursor:pointer}@media print{button{display:none}}</style></head><body><button onclick="window.print()">Imprimer / PDF</button><h1>Rapport — ${r.report_type}</h1><p>Généré le ${new Date(r.generated_at).toLocaleString('fr-FR')} • Statut : ${r.report_status}</p><table>${rows}</table></body></html>`);
    w.document.close();
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Anomalies totales" value={anomalies.length} accent="violet" icon={AlertTriangle} />
        <KpiCard label="Ouvertes" value={openCount} accent={openCount ? 'orange' : 'emerald'} />
        <KpiCard label="Critiques" value={bySev.critique || 0} accent="red" />
        <KpiCard label="Rapports" value={reports.length} accent="blue" icon={FileText} />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Activity className="w-4 h-4 text-violet-600" /> Répartition par type d'anomalie</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {Object.keys(byType).length === 0 ? <p className="text-sm text-slate-500">Aucune anomalie. 🎉</p> : Object.entries(byType).sort((a,b) => b[1] - a[1]).map(([type, count]) => (
              <div key={type} className="flex items-center gap-2">
                <div className="flex-1 text-sm">{type}</div>
                <div className="h-2 bg-slate-100 rounded flex-1 overflow-hidden"><div className="h-full bg-violet-500" style={{ width: `${(count / anomalies.length) * 100}%` }}></div></div>
                <Badge variant="secondary" className="w-8 justify-center">{count}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Activity className="w-4 h-4 text-violet-600" /> Répartition par gravité</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {['faible','moyenne','haute','critique'].map(s => (
              <div key={s} className="flex items-center gap-2">
                <div className="flex-1 text-sm capitalize">{s}</div>
                <div className="h-2 bg-slate-100 rounded flex-1 overflow-hidden"><div className={`h-full ${s === 'critique' ? 'bg-red-500' : s === 'haute' ? 'bg-orange-500' : s === 'moyenne' ? 'bg-amber-500' : 'bg-slate-400'}`} style={{ width: `${anomalies.length ? ((bySev[s] || 0) / anomalies.length) * 100 : 0}%` }}></div></div>
                <Badge variant="secondary" className="w-8 justify-center">{bySev[s] || 0}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Anomalies constatées</CardTitle></CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-y text-left text-xs uppercase text-slate-500"><tr><th className="py-2 px-4">Site</th><th>Stand</th><th>Type</th><th>Gravité</th><th>Statut</th><th>Date</th></tr></thead>
            <tbody className="divide-y">
              {anomalies.length === 0 ? <tr><td colSpan="6" className="py-6 text-center text-slate-400">Aucune anomalie à signaler.</td></tr> :
                anomalies.map(a => (
                  <tr key={a.id}>
                    <td className="py-2 px-4">{a.venue_name}</td>
                    <td className="font-mono text-xs">{a.stand_code}</td>
                    <td className="text-xs">{a.anomaly_type}</td>
                    <td><Badge variant={a.severity_level === 'critique' || a.severity_level === 'haute' ? 'destructive' : 'secondary'}>{a.severity_level}</Badge></td>
                    <td className="text-xs">{a.resolved_status}</td>
                    <td className="text-xs text-slate-500">{new Date(a.detected_at).toLocaleString('fr-FR')}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Rapports ARACOM disponibles</CardTitle></CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-y text-left text-xs uppercase text-slate-500"><tr><th className="py-2 px-4">Type</th><th>Portée</th><th>Statut</th><th>Date</th><th></th></tr></thead>
            <tbody className="divide-y">
              {reports.length === 0 ? <tr><td colSpan="5" className="py-6 text-center text-slate-400">Aucun rapport généré pour l'instant.</td></tr> : reports.map(r => (
                <tr key={r.id}>
                  <td className="py-2 px-4 font-medium">{r.report_type}</td>
                  <td className="text-xs text-slate-600">{r.report_data_json?.site || r.report_data_json?.exposant || 'Global'}</td>
                  <td><Badge variant={r.report_status === 'valide' ? 'default' : 'secondary'} className={r.report_status === 'valide' ? 'bg-emerald-600' : ''}>{r.report_status}</Badge></td>
                  <td className="text-xs text-slate-500">{new Date(r.generated_at).toLocaleString('fr-FR')}</td>
                  <td className="pr-4"><Button size="sm" variant="outline" onClick={() => openReport(r)}><FileText className="w-3 h-3 mr-1" /> Voir / PDF</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

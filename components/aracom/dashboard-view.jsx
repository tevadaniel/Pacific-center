'use client';

import { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { Sparkles, RefreshCw, Users, Layers3, MapPin, Wallet, Calendar, Mail, AlertCircle, CheckCircle2, Clock, Layers, FileText, Activity, ChartBar, Eye, Send, ChevronRight, ChevronUp, ChevronDown, BellRing, Search, Lock, AlertTriangle, Download, FileCheck2, ThumbsUp, TrendingUp, Zap } from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import AiInsightTrigger from '@/components/ai-insight-trigger';
import { api } from '@/lib/auth-client';
import { KpiCard } from '@/components/app-shell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { ExposantLink, useExposantPanel } from './exposant-panel-context';

/**
 * DASHBOARD VIEW — Vue principale Aracom (KPIs, alertes, anomalies, validations).
 */
export default
function DashboardView({ onGoto }) {
  const [kpis, setKpis] = useState(null);
  const [sites, setSites] = useState([]);
  const [extended, setExtended] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const { open: openExposant } = useExposantPanel();
  const load = async () => {
    setLoading(true);
    try {
      const [k, s, e, a] = await Promise.all([
        api('/api/dashboard/kpis'),
        api('/api/dashboard/by-site'),
        api('/api/dashboard/extended').catch(() => null),
        api('/api/dashboard/analytics').catch(() => null),
      ]);
      setKpis(k); setSites(s); setExtended(e); setAnalytics(a);
    } catch (e) { toast.error(e.message); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  if (loading || !kpis) return <div className="text-slate-500 py-12 text-center">Chargement…</div>;

  const totalStands = sites.reduce((s, v) => s + v.capacity_stands, 0);
  const totalAssigned = sites.reduce((s, v) => s + v.assigned, 0);
  const totalConfirmed = sites.reduce((s, v) => s + v.confirmed, 0);
  const globalFill = totalStands ? Math.round((totalAssigned / totalStands) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Hero countdown */}
      {extended && (
        <Card className="bg-gradient-to-r from-blue-600 to-emerald-600 text-white border-0">
          <CardContent className="p-5 flex flex-col md:flex-row items-center gap-4">
            <div className="text-center md:text-left flex-1">
              <div className="text-xs uppercase tracking-wider opacity-90">Forum de la Rentrée 2026</div>
              <div className="text-2xl font-bold">14 & 15 août 2026 · 6 sites</div>
            </div>
            <div className="text-center">
              <div className="text-5xl font-extrabold">{extended.days_to_event}</div>
              <div className="text-xs uppercase tracking-wider opacity-90">jours restants</div>
            </div>
            <div className="text-center border-l border-white/20 pl-4">
              <div className="text-3xl font-bold">{extended.avg_completion}%</div>
              <div className="text-xs uppercase tracking-wider opacity-90">complétion moy.</div>
            </div>
            <div className="text-center border-l border-white/20 pl-4">
              <div className="text-3xl font-bold">{extended.fully_complete_count}</div>
              <div className="text-xs uppercase tracking-wider opacity-90">dossiers prêts</div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Smart alerts */}
      {extended?.smart_alerts?.length > 0 && (
        <div className="space-y-2">
          {extended.smart_alerts.map((a, i) => (
            <div key={i} className={`rounded-md border-l-4 px-4 py-3 flex items-center gap-3 ${
              a.severity === 'critical' ? 'border-rose-500 bg-rose-50' : 'border-amber-500 bg-amber-50'
            }`}>
              <span className="text-2xl">{a.icon}</span>
              <span className={`flex-1 font-medium ${a.severity === 'critical' ? 'text-rose-900' : 'text-amber-900'}`}>{a.text}</span>
            </div>
          ))}
        </div>
      )}

      {/* Validation requests pending */}
      <PendingValidationsCard onGoto={onGoto} />

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <KpiCard label="Exposants" value={kpis.total} hint={`${kpis.by_status?.confirme || 0} confirmés`} accent="blue" icon={Users} />
        <KpiCard label="À relancer" value={kpis.by_status?.a_relancer || 0} accent="orange" icon={Clock} />
        <KpiCard label="À confirmer" value={kpis.by_status?.a_confirmer || 0} accent="orange" icon={Activity} />
        <KpiCard label="Prospects" value={kpis.by_status?.prospect || 0} accent="slate" icon={Sparkles} />
        <KpiCard label="Cautions reçues" value={kpis.cautions_recues} hint={`${(kpis.xpf_encaisses || 0).toLocaleString('fr-FR')} XPF`} accent="emerald" icon={Wallet} />
        <KpiCard label="Conventions" value={kpis.conv_signed} hint="signées" accent="emerald" icon={FileCheck2} />
      </div>

      {/* Top 5 at risk + Mailing engagement */}
      {extended && (
        <div className="grid lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-rose-600" /> Top 5 dossiers à risque</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {extended.at_risk.length === 0 ? <p className="text-sm text-slate-400">Aucun dossier à risque 👍</p> : extended.at_risk.map(r => (
                <div key={r.id} className="border rounded-md p-3 flex items-center gap-3 hover:bg-slate-50 transition-colors">
                  <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-700 font-bold flex items-center justify-center text-xs">{r.risk_score}</div>
                  <div onClick={() => openExposant(r.id)} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && openExposant(r.id)} className="flex-1 min-w-0 text-left cursor-pointer">
                    <div className="flex items-center gap-2"><AiInsightTrigger registration={r} size="xs" /><span className="font-medium truncate hover:text-blue-600 hover:underline">{r.organization_name}</span><Badge variant="secondary" className="text-[10px] shrink-0">{r.completion_percent}%</Badge></div>
                    <div className="text-xs text-slate-500">{r.venue_name} · {r.discipline}</div>
                    <div className="flex flex-wrap gap-1 mt-1">{r.missing.map(m => <Badge key={m} className="text-[10px] bg-rose-100 text-rose-700 border-rose-200">❌ {m}</Badge>)}</div>
                  </div>
                  <Button size="sm" variant="outline" className="text-xs shrink-0" onClick={() => openExposant(r.id)}>Ouvrir</Button>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Mail className="w-4 h-4 text-violet-600" /> Engagement mailing</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-md bg-violet-50 p-3 text-center">
                <div className="text-3xl font-extrabold text-violet-700">{extended.mailing_engagement.sent}</div>
                <div className="text-xs uppercase text-slate-500">emails envoyés (14j)</div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-md bg-white border p-3 text-center">
                  <div className="text-2xl font-bold text-emerald-600">{extended.mailing_engagement.open_rate_pct}%</div>
                  <div className="text-[10px] uppercase text-slate-500">Taux d&apos;ouverture</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{extended.mailing_engagement.opened} ouverts</div>
                </div>
                <div className="rounded-md bg-white border p-3 text-center">
                  <div className="text-2xl font-bold text-blue-600">{extended.mailing_engagement.click_rate_pct}%</div>
                  <div className="text-[10px] uppercase text-slate-500">Taux de clic</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{extended.mailing_engagement.clicked} clics</div>
                </div>
              </div>
              {extended.cadence.length > 0 && (
                <div>
                  <div className="text-[10px] uppercase text-slate-500 mb-1">Cadence (14j)</div>
                  <div className="flex items-end gap-0.5 h-12">
                    {extended.cadence.map(d => {
                      const max = Math.max(...extended.cadence.map(x => x.count));
                      const h = max > 0 ? Math.max(8, (d.count / max) * 48) : 4;
                      return <div key={d.date} className="flex-1 bg-violet-400 rounded-t" style={{ height: `${h}px` }} title={`${d.date}: ${d.count}`} />;
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* 🤖 Assistant IA retiré du dashboard — disponible via la bulle flottante */}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Remplissage global</CardTitle>
              <p className="text-sm text-slate-500 mt-1">{totalAssigned}/{totalStands} stands attribués • {totalConfirmed} confirmés</p>
            </div>
            <Badge variant="secondary" className="text-lg font-bold">{globalFill}%</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <Progress value={globalFill} className="h-3" />
        </CardContent>
      </Card>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-slate-900">Avancement par site</h3>
          <Button variant="ghost" size="sm" onClick={load}><RefreshCw className="w-3.5 h-3.5 mr-1" /> Actualiser</Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sites.map(s => (
            <Card key={s.venue_id} className="hover:shadow-md transition">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-blue-600" />
                      <h4 className="font-semibold text-slate-900">{s.venue_name}</h4>
                    </div>
                    <div className="text-xs text-slate-500 mt-1">{s.capacity_stands} stands prévus</div>
                  </div>
                  <Badge variant={s.remplissage >= 80 ? 'default' : 'secondary'} className={s.remplissage >= 80 ? 'bg-emerald-600' : ''}>{s.remplissage}%</Badge>
                </div>
                <Progress value={(s.assigned / s.capacity_stands) * 100} className="h-2 mb-3" />
                <div className="grid grid-cols-4 gap-2 text-center">
                  <Stat label="Attrib." value={s.assigned} c="text-slate-900" />
                  <Stat label="Confirmé" value={s.confirmed} c="text-emerald-600" />
                  <Stat label="À relanc." value={s.to_follow_up} c="text-orange-600" />
                  <Stat label="Cautions" value={s.cautions_recues} c="text-blue-600" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Synthèse financière cautions</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard label="Encaissé" value={`${(kpis.xpf_encaisses || 0).toLocaleString('fr-FR')} XPF`} accent="emerald" />
            <KpiCard label="En attente" value={`${(kpis.xpf_en_attente || 0).toLocaleString('fr-FR')} XPF`} accent="orange" />
            <KpiCard label="Cautions reçues" value={kpis.cautions_recues} accent="emerald" />
            <KpiCard label="Docs manquants" value={kpis.docs_manquants} accent="violet" icon={AlertTriangle} />
          </div>
        </CardContent>
      </Card>

      {/* Graphiques */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Activity className="w-4 h-4 text-blue-600" /> Remplissage par site</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={sites.map(s => ({ name: s.venue_name, Attribués: s.assigned, Confirmés: s.confirmed, Libres: s.capacity_stands - s.assigned }))}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Attribués" fill="#94a3b8" />
                <Bar dataKey="Confirmés" fill="#10b981" />
                <Bar dataKey="Libres" fill="#e2e8f0" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Sparkles className="w-4 h-4 text-violet-600" /> Répartition des statuts</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={[
                    { name: 'Confirmés', value: kpis.by_status?.confirme || 0, color: '#10b981' },
                    { name: 'À confirmer', value: kpis.by_status?.a_confirmer || 0, color: '#f59e0b' },
                    { name: 'À relancer', value: kpis.by_status?.a_relancer || 0, color: '#f97316' },
                    { name: 'Prospects', value: kpis.by_status?.prospect || 0, color: '#94a3b8' },
                  ]}
                  dataKey="value" nameKey="name" outerRadius={85} innerRadius={50}
                  label={e => `${e.name} ${e.value}`}
                  labelLine={false}
                >
                  {[0, 1, 2, 3].map(i => <Cell key={i} fill={['#10b981', '#f59e0b', '#f97316', '#94a3b8'][i]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Graphiques avancés (analytics) */}
      {analytics && (
        <div className="grid lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><TrendingUp className="w-4 h-4 text-emerald-600" /> Évolution historique 2019 → 2026</CardTitle>
              <p className="text-[11px] text-slate-500 mt-0.5">Nombre d&apos;associations participantes par édition</p>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={analytics.historic}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Area type="monotone" dataKey="count" stroke="#10b981" fill="#10b98155" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <DisciplinesCard analytics={analytics} />

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><FileCheck2 className="w-4 h-4 text-blue-600" /> Avancement des dossiers</CardTitle>
              <p className="text-[11px] text-slate-500 mt-0.5">Distribution du % de complétion des inscriptions</p>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={analytics.completion}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="range" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {analytics.completion.map((d, i) => (
                      <Cell key={i} fill={['#ef4444', '#f97316', '#f59e0b', '#10b981', '#059669'][i] || '#94a3b8'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Calendar className="w-4 h-4 text-orange-600" /> Inscriptions sur 30 jours</CardTitle>
              <p className="text-[11px] text-slate-500 mt-0.5">
                J-{analytics.days_to_event} avant le Forum • {analytics.total_registrations} inscriptions au total
              </p>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={analytics.registrations_timeline}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10 }}
                    tickFormatter={d => {
                      const dt = new Date(d);
                      return `${dt.getDate()}/${dt.getMonth() + 1}`;
                    }}
                    interval={4}
                  />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip
                    labelFormatter={d => new Date(d).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                  />
                  <Line type="monotone" dataKey="count" stroke="#f97316" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Outils ARACOM */}
      <Card className="border-violet-200 bg-gradient-to-br from-violet-50/40 to-white">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Zap className="w-4 h-4 text-violet-600" /> Outils rapides ARACOM</CardTitle>
          <p className="text-xs text-slate-500 mt-1">Automatisations en un clic</p>
        </CardHeader>
        <CardContent>
          <AracomTools onRefresh={load} />
        </CardContent>
      </Card>
    </div>
  );
}

function AracomTools({ onRefresh }) {
  const [busy, setBusy] = useState(null);
  const run = async (route, successMsg, confirmMsg) => {
    if (confirmMsg && !confirm(confirmMsg)) return;
    setBusy(route);
    try {
      const res = await api(route, { method: 'POST', body: JSON.stringify({}) });
      toast.success(successMsg(res));
      onRefresh && onRefresh();
    } catch (e) { toast.error(e.message); }
    finally { setBusy(null); }
  };
  const runExport = async () => {
    setBusy('xlsx');
    try {
      const res = await exportFullXLSX(api);
      toast.success(`📊 Export Excel généré (${res.sheets.length} feuilles)`);
    } catch (e) { toast.error(e.message); }
    finally { setBusy(null); }
  };
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
      <Button
        variant="outline" className="h-auto py-3 flex-col items-start gap-1 text-left"
        disabled={busy !== null} onClick={() => run('/api/tools/recompute-completion', (r) => `Complétion recalculée pour ${r.total} dossiers (${r.updated} mis à jour)`)}
      >
        <div className="flex items-center gap-2 font-semibold"><Activity className="w-4 h-4 text-blue-600" /> Recalculer complétion</div>
        <div className="text-xs text-slate-500 font-normal">Met à jour le % d'avancement de tous les dossiers en fonction des docs/caution/convention</div>
        {busy === '/api/tools/recompute-completion' && <Badge className="mt-1">En cours…</Badge>}
      </Button>
      <Button
        variant="outline" className="h-auto py-3 flex-col items-start gap-1 text-left"
        disabled={busy !== null} onClick={() => run('/api/tools/generate-relances', (r) => `${r.created} tâches de relance créées`, 'Générer automatiquement des tâches de relance pour les dossiers incomplets ?')}
      >
        <div className="flex items-center gap-2 font-semibold"><Clock className="w-4 h-4 text-orange-600" /> Générer relances auto</div>
        <div className="text-xs text-slate-500 font-normal">Crée des tâches pour tous les dossiers avec assurance/caution/convention manquantes</div>
        {busy === '/api/tools/generate-relances' && <Badge className="mt-1">En cours…</Badge>}
      </Button>
      <Button
        variant="outline" className="h-auto py-3 flex-col items-start gap-1 text-left"
        disabled={busy !== null} onClick={() => run('/api/emails/send-satisfaction', (r) => `${r.sent} invitations satisfaction envoyées (mock)`, 'Envoyer la campagne de questionnaire de satisfaction à tous les exposants confirmés ?')}
      >
        <div className="flex items-center gap-2 font-semibold"><ThumbsUp className="w-4 h-4 text-emerald-600" /> Campagne satisfaction</div>
        <div className="text-xs text-slate-500 font-normal">Envoie l'invitation au questionnaire à tous les exposants inscrits</div>
        {busy === '/api/emails/send-satisfaction' && <Badge className="mt-1">En cours…</Badge>}
      </Button>
      <Button
        variant="outline" className="h-auto py-3 flex-col items-start gap-1 text-left border-emerald-300"
        disabled={busy !== null} onClick={runExport}
      >
        <div className="flex items-center gap-2 font-semibold"><Download className="w-4 h-4 text-emerald-600" /> Export Excel complet</div>
        <div className="text-xs text-slate-500 font-normal">Télécharge un fichier .xlsx avec toutes les données : exposants, stands, cautions, satisfaction, tâches, anomalies</div>
        {busy === 'xlsx' && <Badge className="mt-1">Export…</Badge>}
      </Button>
    </div>
  );
}

function Stat({ label, value, c }) {
  return <div><div className={`text-xl font-bold ${c}`}>{value}</div><div className="text-[11px] text-slate-500 uppercase tracking-wider">{label}</div></div>;
}

// =====================================================================
// PendingValidationsCard — affichée dans le dashboard pour relayer les demandes en attente
// =====================================================================
function PendingValidationsCard({ onGoto }) {
  const [items, setItems] = useState(null);
  const load = async () => {
    try {
      const list = await api('/api/validation-requests');
      const pending = list.filter(r => r.status === 'en_attente' || r.status === 'rdv_fixe');
      setItems(pending);
    } catch {/* ignore */}
  };
  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, []);
  if (!items || items.length === 0) return null;
  const enAttente = items.filter(r => r.status === 'en_attente');
  const rdvFixe = items.filter(r => r.status === 'rdv_fixe');
  return (
    <Card className="border-2 border-violet-300 bg-gradient-to-br from-violet-50 to-blue-50">
      <CardContent className="p-4">
        <div className="flex items-start gap-3 mb-3">
          <div className="text-3xl">🔔</div>
          <div className="flex-1">
            <h3 className="font-bold text-violet-900 text-lg">Demandes de validation à traiter</h3>
            <p className="text-sm text-violet-800">{enAttente.length} en attente · {rdvFixe.length} avec RDV fixé. Action requise pour verrouiller les inscriptions.</p>
          </div>
          <Button size="sm" onClick={() => onGoto?.('validations')} className="bg-violet-600 hover:bg-violet-700 gap-1.5"><Lock className="w-4 h-4" /> Ouvrir l&apos;onglet Validations</Button>
        </div>
        <div className="grid md:grid-cols-2 gap-2">
          {items.slice(0, 4).map(r => (
            <div key={r.id} className="bg-white rounded-md border border-violet-200 p-2 flex items-center gap-2">
              <Badge className={r.status === 'en_attente' ? 'bg-amber-500 text-white shrink-0' : 'bg-blue-500 text-white shrink-0'}>{r.status === 'en_attente' ? '⏳' : '📅'}</Badge>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate flex items-center gap-1.5"><AiInsightTrigger registration={{ id: r.registration_id || r.id }} size="xs" /><ExposantLink id={r.registration_id || r.id}>{r.organization?.name || '—'}</ExposantLink></div>
                <div className="text-xs text-slate-500 truncate">{r.venue?.name} · Stand <span className="font-mono">{r.stand_code}</span> · {r.preferred_payment === 'especes' ? '💵 Espèces' : '💳 Chèque'}</div>
                {r.status === 'rdv_fixe' && r.rdv_date && <div className="text-[10px] text-blue-700 font-semibold">{new Date(r.rdv_date).toLocaleString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>}
              </div>
            </div>
          ))}
          {items.length > 4 && <div className="text-xs text-slate-500 text-center md:col-span-2">+ {items.length - 4} autre(s) demande(s)…</div>}
        </div>
      </CardContent>
    </Card>
  );
}

// =====================================================================
// DisciplinesCard — graphique horizontal des disciplines + filtre par site
// =====================================================================
function DisciplinesCard({ analytics }) {
  const [selectedSite, setSelectedSite] = useState('all');
  const [showMultiList, setShowMultiList] = useState(false);

  const data = useMemo(() => {
    if (selectedSite === 'all') {
      return {
        list: analytics.disciplines || [],
        total: analytics.total_organizations || 0,
        multiSites: analytics.multi_site_orgs_count || 0,
        multiOrgs: analytics.multi_site_orgs_list || [],
        label: 'Tous sites confondus',
      };
    }
    const site = analytics.disciplines_by_site?.[selectedSite];
    if (!site) return { list: [], total: 0, multiSites: 0, multiOrgs: [], label: '—' };
    const orgsMap = new Map();
    (site.disciplines || []).forEach(d => {
      (d.multi_site_orgs || []).forEach(o => {
        if (!orgsMap.has(o.id)) orgsMap.set(o.id, { ...o, discipline: d.name });
      });
    });
    return {
      list: site.disciplines,
      total: site.total_orgs,
      multiSites: orgsMap.size,
      multiOrgs: Array.from(orgsMap.values()),
      label: site.venue_name,
    };
  }, [analytics, selectedSite]);

  const sites = analytics.sites_list || [];

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div className="bg-white border border-violet-200 rounded-md p-3 shadow-lg text-xs max-w-xs">
        <div className="font-bold text-slate-800">{d.name}</div>
        <div className="mt-1">
          <b>{d.count}</b> exposant{d.count > 1 ? 's' : ''}
        </div>
        {d.multi_site_count > 0 && (
          <div className="mt-1 text-orange-700">
            <div className="flex items-center gap-1 font-semibold">🔄 {d.multi_site_count} sur plusieurs sites :</div>
            <ul className="mt-1 ml-3 list-disc text-orange-900 space-y-0.5">
              {(d.multi_site_orgs || []).slice(0, 5).map(o => (
                <li key={o.id}><b>{o.name}</b> <span className="text-orange-600 text-[10px]">({o.sites?.join(' · ') || '—'})</span></li>
              ))}
              {(d.multi_site_orgs?.length || 0) > 5 && <li className="italic text-orange-600">+ {d.multi_site_orgs.length - 5} autres…</li>}
            </ul>
          </div>
        )}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="w-4 h-4 text-violet-600" /> Top disciplines
            </CardTitle>
            <p className="text-[11px] text-slate-500 mt-0.5">{data.label} · {data.total} exposant{data.total > 1 ? 's' : ''}</p>
          </div>
          <Select value={selectedSite} onValueChange={setSelectedSite}>
            <SelectTrigger className="w-44 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">🌐 Tous les sites</SelectItem>
              {sites.map(s => (
                <SelectItem key={s.id} value={s.id}>📍 {s.name} ({s.count})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {data.multiSites > 0 && (
          <button
            onClick={() => setShowMultiList(s => !s)}
            className="w-full text-left text-xs text-orange-700 bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded-md p-2 mt-2 flex items-center gap-2 transition"
          >
            <span className="text-lg">🔄</span>
            <span className="flex-1"><b>{data.multiSites}</b> exposant{data.multiSites > 1 ? 's' : ''} {selectedSite === 'all' ? 'inscrit(s) sur plusieurs sites' : 'aussi présent(s) sur un autre site'}</span>
            <span className="text-orange-600 underline-offset-2 underline">{showMultiList ? 'Masquer' : 'Voir la liste'}</span>
          </button>
        )}
        {showMultiList && data.multiOrgs.length > 0 && (
          <div className="bg-orange-50/40 border border-orange-200 rounded-md p-3 mt-2 max-h-56 overflow-y-auto">
            <div className="text-[10px] uppercase tracking-wider text-orange-700 font-semibold mb-2">Associations sur plusieurs sites</div>
            <div className="space-y-1.5">
              {data.multiOrgs.map(o => (
                <div key={o.id} className="flex items-center justify-between gap-2 text-xs p-1.5 rounded hover:bg-white transition">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-slate-800 truncate">{o.name}</div>
                    {o.discipline && <div className="text-[10px] text-slate-500">{o.discipline}</div>}
                  </div>
                  <div className="flex flex-wrap gap-1 justify-end max-w-[55%]">
                    {(o.sites || []).map(s => (
                      <Badge key={s} variant="outline" className="text-[10px] bg-white border-orange-300 text-orange-700">📍 {s}</Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {data.list.length === 0 ? (
          <div className="text-sm text-slate-500 italic text-center py-8">Aucune donnée pour ce site.</div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.list} layout="vertical" margin={{ left: 30 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={90} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-3 pt-3 border-t border-slate-100 max-h-32 overflow-y-auto space-y-1">
              {data.list.map(d => (
                <div key={d.name} className="flex items-center justify-between text-xs px-2 py-1 rounded hover:bg-slate-50">
                  <span className="text-slate-700 truncate flex-1">{d.name}</span>
                  <div className="flex items-center gap-2">
                    {d.multi_site_count > 0 && (
                      <Badge className="bg-orange-100 text-orange-700 border-orange-200 text-[10px] gap-1" title={(d.multi_site_orgs || []).map(o => `${o.name} (${o.sites?.join(', ') || ''})`).join('\n')}>
                        🔄 {d.multi_site_count}
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-[10px] font-bold">{d.count}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}


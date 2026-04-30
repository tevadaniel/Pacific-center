'use client';

import React, { useEffect, useMemo, useState, useRef } from 'react';
import Link from 'next/link';
import { Shell, KpiCard } from '@/components/app-shell';
import HelpCard from '@/components/help-card';
import AiInsightTrigger from '@/components/ai-insight-trigger';
import { api, getSession } from '@/lib/auth-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Users, MapPin, FileCheck2, Wallet, AlertTriangle, AlertCircle, Send, Search, FileText, RefreshCw, RotateCcw, CheckCircle2, XCircle, Clock, Building2, Smartphone, Mail, Phone, Lock, Activity, Sparkles, Download, Trash2, Move, Plus, KeyRound, ThumbsUp, Star, Smile, MessageCircle, Calendar, Zap, Printer, Eye, TrendingUp } from 'lucide-react';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, LineChart, Line, AreaChart, Area, CartesianGrid } from 'recharts';
import { REGISTRATION_STATUS, REGISTRATION_STATUS_LABEL, REGISTRATION_STATUS_COLOR, PRIORITY_LEVELS, PRIORITY_DEFINITIONS, PROSPECT_STATUS_DEFINITIONS, DEPOSIT_STATUS, DEPOSIT_STATUS_LABEL, DISCIPLINES, DEPOSIT_AMOUNT_XPF, DOCUMENT_TYPES, DOCUMENT_TYPE_LABEL } from '@/lib/constants';
import { FileUploadButton } from '@/components/file-upload';
import SmartVenueMap from '@/components/smart-venue-map';
import { exportExposantsCSV, exportCautionsCSV, exportSatisfactionCSV } from '@/lib/csv-export';
import { exportFullXLSX } from '@/lib/xlsx-export';
import PushToggle from '@/components/push-toggle';

const TABS = [
  { key: 'dashboard', label: 'Dashboard', href: '/aracom' },
  { key: 'exposants', label: 'Exposants', href: '/aracom?tab=exposants' },
  { key: 'sites', label: 'Sites & stands', href: '/aracom?tab=sites' },
  { key: 'validations', label: 'Validations', href: '/aracom?tab=validations' },
  { key: 'access', label: 'Liens d\'accès', href: '/aracom?tab=access' },
  { key: 'cautions', label: 'Cautions', href: '/aracom?tab=cautions' },
  { key: 'mailing', label: 'Mailing', href: '/aracom?tab=mailing' },
  { key: 'relances', label: 'Relances', href: '/aracom?tab=relances' },
  { key: 'prospection', label: 'Prospection', href: '/aracom?tab=prospection' },
  { key: 'anomalies', label: 'Anomalies', href: '/aracom?tab=anomalies' },
  { key: 'bilans', label: 'Bilans', href: '/aracom?tab=bilans' },
  { key: 'satisfaction', label: 'Satisfaction', href: '/aracom?tab=satisfaction' },
  { key: 'documents-officiels', label: 'Docs officiels', href: '/aracom?tab=documents-officiels' },
  { key: 'backup', label: 'Sauvegarde', href: '/aracom?tab=backup' },
  { key: 'import', label: 'Import Excel', href: '/aracom?tab=import' },
];

export default function AracomPage() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [mailStatus, setMailStatus] = useState({ test_mode_active: false, redirect_to: null });
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setActiveTab(params.get('tab') || 'dashboard');
    const onPop = () => setActiveTab(new URLSearchParams(window.location.search).get('tab') || 'dashboard');
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  useEffect(() => {
    api('/api/mailing/status').then(setMailStatus).catch(() => {});
  }, []);
  const setTab = (k) => {
    setActiveTab(k);
    const url = k === 'dashboard' ? '/aracom' : `/aracom?tab=${k}`;
    window.history.pushState({}, '', url);
  };

  const tabs = TABS.map(t => ({ ...t, href: '#', onClick: () => setTab(t.key) }));

  return (
    <Shell
      title="Cockpit ARACOM"
      subtitle="Source de vérité pour la préparation et l'exploitation terrain du Forum de la Rentrée 2026."
      allowedRoles={['aracom_admin']}
      activeTab={activeTab}
      tabs={TABS.map(t => ({ ...t, onClick: () => setTab(t.key) }))}
      right={
        <div className="flex items-center gap-2">
          {mailStatus.test_mode_active && (
            <button
              onClick={() => setTab('mailing')}
              title={`Mode test mail actif — redirection vers ${mailStatus.redirect_to}`}
              className="inline-flex items-center gap-1.5 rounded-md bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-2.5 py-1.5 shadow-sm border border-red-700 transition-colors animate-pulse"
            >
              🛡️ TEST MAIL
            </button>
          )}
          <PushToggle />
          <AlertsBadge />
          <Link href="/jour-j"><Button className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 gap-2"><Smartphone className="w-4 h-4" /> Mode Jour J</Button></Link>
        </div>
      }
    >
      {activeTab === 'dashboard' && <DashboardView onGoto={setTab} />}
      {activeTab === 'prospection' && <ProspectionAracomView />}
      {activeTab === 'documents-officiels' && <OfficialDocumentsView />}
      {activeTab === 'exposants' && <ExposantsView />}
      {activeTab === 'sites' && <SitesView />}
      {activeTab === 'validations' && <ValidationsView />}
      {activeTab === 'access' && <AccessTokensView />}
      {activeTab === 'cautions' && <CautionsView />}
      {activeTab === 'mailing' && <MailingView />}
      {activeTab === 'relances' && <RelancesView />}
      {activeTab === 'anomalies' && <AnomaliesView />}
      {activeTab === 'bilans' && <BilansView />}
      {activeTab === 'satisfaction' && <SatisfactionAdminView />}
      {activeTab === 'backup' && <BackupView />}
      {activeTab === 'import' && <ImportExcelView />}
    </Shell>
  );
}

function DashboardView({ onGoto }) {
  const [kpis, setKpis] = useState(null);
  const [sites, setSites] = useState([]);
  const [extended, setExtended] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
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
                <div key={r.id} className="border rounded-md p-3 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-700 font-bold flex items-center justify-center text-xs">{r.risk_score}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2"><AiInsightTrigger registration={r} size="xs" /><span className="font-medium truncate">{r.organization_name}</span><Badge variant="secondary" className="text-[10px] shrink-0">{r.completion_percent}%</Badge></div>
                    <div className="text-xs text-slate-500">{r.venue_name} · {r.discipline}</div>
                    <div className="flex flex-wrap gap-1 mt-1">{r.missing.map(m => <Badge key={m} className="text-[10px] bg-rose-100 text-rose-700 border-rose-200">❌ {m}</Badge>)}</div>
                  </div>
                  <Button size="sm" variant="outline" className="text-xs shrink-0" onClick={() => {
                    // 🔗 Navigue vers Exposants avec le registration_id en param → ouvre direct la fiche
                    const url = `/aracom?tab=exposants&open=${encodeURIComponent(r.id)}`;
                    window.history.pushState({}, '', url);
                    onGoto?.('exposants');
                  }}>Ouvrir</Button>
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

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Activity className="w-4 h-4 text-violet-600" /> Top disciplines</CardTitle>
              <p className="text-[11px] text-slate-500 mt-0.5">Répartition des associations par activité</p>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={analytics.disciplines} layout="vertical" margin={{ left: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

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

function ExposantsView() {
  const [rows, setRows] = useState([]);
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ venue_id: '', status: '', priority: '', discipline: '', search: '' });
  const [selected, setSelected] = useState(null);
  const [showNew, setShowNew] = useState(false);

  // 🔗 Ouvre directement la fiche si un registration_id est passé dans l'URL (?open=...)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const openId = new URLSearchParams(window.location.search).get('open');
    if (openId) {
      setSelected(openId);
      // Nettoie le param pour éviter de rouvrir en boucle sur refresh
      const url = new URL(window.location.href);
      url.searchParams.delete('open');
      window.history.replaceState({}, '', url.toString());
    }
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      Object.entries(filters).forEach(([k, v]) => { if (v) qs.set(k, v); });
      const [r, v] = await Promise.all([api('/api/registrations?' + qs.toString()), api('/api/venues')]);
      setRows(r); setVenues(v);
    } catch (e) { toast.error(e.message); }
    setLoading(false);
  };
  useEffect(() => { load(); }, [filters]);

  return (
    <div className="space-y-4">
      <HelpCard
        title="Signification des priorités (A / B / C / Prospect)"
        definitions={PRIORITY_DEFINITIONS}
        storageKey="fr26_help_priorities"
      />
      <Card className="border-violet-200 bg-gradient-to-br from-violet-50 to-fuchsia-50">
        <CardContent className="p-3 flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-[260px]">
            <div className="font-semibold text-violet-900 text-sm flex items-center gap-1.5"><Sparkles className="w-4 h-4" /> Synthèses IA des profils exposants</div>
            <div className="text-xs text-violet-800">Génère pour chaque exposant un mini-profil (fidélité, ponctualité, caution, vigilance) à partir de son historique. Apparaît dans l&apos;onglet « Résumé » de chaque fiche.</div>
          </div>
          <Button
            size="sm"
            className="bg-violet-600 hover:bg-violet-700 gap-1.5"
            onClick={async () => {
              if (!confirm('Générer une synthèse IA pour tous les exposants ?\n\nL\'opération tourne en arrière-plan (env. 1-2 min/100 exposants).\nCoût IA : ~600 tokens par exposant.')) return;
              try {
                const r = await api('/api/registrations/generate-insights-bulk', { method: 'POST', body: JSON.stringify({}) });
                toast.success(r.message);
              } catch (e) { toast.error(e.message); }
            }}
          >
            <Sparkles className="w-4 h-4" /> Générer pour tous
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div className="md:col-span-2 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <Input className="pl-9" placeholder="Rechercher par nom, contact, stand…" value={filters.search} onChange={e => setFilters({ ...filters, search: e.target.value })} />
            </div>
            <Select value={filters.venue_id || 'all'} onValueChange={v => setFilters({ ...filters, venue_id: v === 'all' ? '' : v })}>
              <SelectTrigger><SelectValue placeholder="Site" /></SelectTrigger>
              <SelectContent><SelectItem value="all">Tous les sites</SelectItem>{venues.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={filters.status || 'all'} onValueChange={v => setFilters({ ...filters, status: v === 'all' ? '' : v })}>
              <SelectTrigger><SelectValue placeholder="Statut" /></SelectTrigger>
              <SelectContent><SelectItem value="all">Tous statuts</SelectItem>{REGISTRATION_STATUS.map(s => <SelectItem key={s} value={s}>{REGISTRATION_STATUS_LABEL[s]}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={filters.priority || 'all'} onValueChange={v => setFilters({ ...filters, priority: v === 'all' ? '' : v })}>
              <SelectTrigger><SelectValue placeholder="Priorité" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes priorités</SelectItem>
                {PRIORITY_LEVELS.map(p => {
                  const d = PRIORITY_DEFINITIONS[p];
                  return (
                    <SelectItem key={p} value={p} title={d?.description}>
                      {d?.emoji} {d?.label || p}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between mt-3 pt-3 border-t">
            <div className="text-sm text-slate-600">{rows.length} exposant(s) affiché(s)</div>
            <div className="flex gap-2">
              <Button size="sm" className="gap-2 bg-blue-600 hover:bg-blue-700" onClick={() => setShowNew(true)}><Plus className="w-3.5 h-3.5" /> Nouveau exposant</Button>
              <Button size="sm" variant="outline" onClick={() => exportExposantsCSV(rows)} className="gap-2"><Download className="w-3.5 h-3.5" /> Export CSV</Button>
            </div>
          </div>
        </CardContent>
      </Card>
      {showNew && <NewExposantDialog venues={venues} onClose={() => setShowNew(false)} onCreated={() => { setShowNew(false); load(); }} />}

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr className="text-left text-slate-500 text-xs uppercase tracking-wider">
                <th className="py-3 px-4">Exposant</th>
                <th className="py-3 px-2">Prio</th>
                <th className="py-3 px-2">Site</th>
                <th className="py-3 px-2">Stand</th>
                <th className="py-3 px-2">Statut</th>
                <th className="py-3 px-2">Créneaux</th>
                <th className="py-3 px-2">Conv.</th>
                <th className="py-3 px-2">Caution</th>
                <th className="py-3 px-2">Contact</th>
                <th className="py-3 px-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading && <tr><td colSpan="10" className="py-8 text-center text-slate-400">Chargement…</td></tr>}
              {!loading && rows.length === 0 && <tr><td colSpan="10" className="py-8 text-center text-slate-400">Aucun résultat</td></tr>}
              {rows.map(r => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="py-2.5 px-4">
                    <div className="flex items-center gap-2">
                      <AiInsightTrigger registration={r} size="xs" />
                      <div>
                        <div className="font-medium text-slate-900">{r.organization?.name}</div>
                        <div className="text-xs text-slate-500">{r.organization?.discipline}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-2"><PrioBadge p={r.organization?.priority_level} /></td>
                  <td className="px-2 text-slate-700">{r.venue?.name}</td>
                  <td className="px-2 font-mono text-xs text-slate-700">{r.stand_code}</td>
                  <td className="px-2"><span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-xs font-medium ${REGISTRATION_STATUS_COLOR[r.status] || 'bg-slate-100'}`}>{REGISTRATION_STATUS_LABEL[r.status] || r.status}</span></td>
                  <td className="px-2 text-xs text-slate-600">
                    {r.friday_slot_label && <span className="inline-block bg-blue-50 text-blue-700 px-1.5 rounded mr-1">V</span>}
                    {r.saturday_slot_label && <span className="inline-block bg-emerald-50 text-emerald-700 px-1.5 rounded">S</span>}
                  </td>
                  <td className="px-2">{r.is_convention_signed ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <XCircle className="w-4 h-4 text-slate-300" />}</td>
                  <td className="px-2">
                    {r.deposit?.status === 'recue' ? <Badge className="bg-emerald-600 text-[10px] font-normal">reçue</Badge> : <Badge variant="secondary" className="text-[10px] font-normal">{DEPOSIT_STATUS_LABEL[r.deposit?.status] || '—'}</Badge>}
                  </td>
                  <td className="px-2 text-xs text-slate-600 max-w-[180px] truncate">{r.organization?.main_email || r.organization?.main_phone}</td>
                  <td className="px-2 text-right"><Button size="sm" variant="ghost" onClick={() => setSelected(r.id)}>Ouvrir</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {selected && <FicheExposant id={selected} onClose={() => { setSelected(null); load(); }} />}
    </div>
  );
}

function PrioBadge({ p }) {
  const c = { A: 'bg-emerald-100 text-emerald-700 border-emerald-200', B: 'bg-amber-100 text-amber-700 border-amber-200', C: 'bg-slate-100 text-slate-700 border-slate-200', prospect: 'bg-blue-100 text-blue-700 border-blue-200' }[p] || 'bg-slate-100 text-slate-600';
  return <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-xs font-semibold ${c}`}>{p === 'prospect' ? 'P' : p}</span>;
}

function FicheExposant({ id, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try { setData(await api(`/api/registrations/${id}`)); } catch (e) { toast.error(e.message); }
    setLoading(false);
  };
  useEffect(() => { load(); }, [id]);

  const updateReg = async (patch) => {
    try {
      await api(`/api/registrations/${id}`, { method: 'PUT', body: JSON.stringify(patch) });
      toast.success('Mis à jour');
      load();
    } catch (e) { toast.error(e.message); }
  };
  const updateDeposit = async (patch) => {
    try {
      await api(`/api/deposits/${data.deposit.id}`, { method: 'PUT', body: JSON.stringify(patch) });
      toast.success('Caution mise à jour');
      load();
    } catch (e) { toast.error(e.message); }
  };

  const generateBilan = async () => {
    try {
      await api('/api/reports/generate', { method: 'POST', body: JSON.stringify({ scope: 'bilan_exposant', registration_id: id }) });
      toast.success('Bilan exposant généré');
      load();
    } catch (e) { toast.error(e.message); }
  };

  const confirmReg = async () => {
    try {
      await api(`/api/registrations/${id}/confirm`, { method: 'POST', body: JSON.stringify({}) });
      toast.success('Inscription confirmée — email envoyé');
      load();
    } catch (e) { toast.error(e.message); }
  };

  const resetPassword = async () => {
    const newPw = prompt("Nouveau mot de passe pour cet exposant :", "forum2026");
    if (!newPw) return;
    // Find user linked to this organization
    const orgId = data.registration?.organization_id;
    if (!orgId) { toast.error('Aucun exposant lié'); return; }
    // Admin reset
    try {
      // Use the same endpoint with target_user_id
      await api('/api/auth/change-password', { method: 'POST', body: JSON.stringify({ target_user_id: `u-exp-${orgId}`, new_password: newPw }) });
      toast.success(`Mot de passe réinitialisé : ${newPw}`);
    } catch (e) { toast.error(e.message); }
  };

  return (
    <Sheet open={true} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        {loading || !data ? <div className="py-10 text-center text-slate-500">Chargement…</div> : (
          <div className="space-y-5">
            <SheetHeader>
              <SheetTitle className="text-xl">{data.organization?.name}</SheetTitle>
              <SheetDescription>{data.organization?.discipline} • <PrioBadge p={data.organization?.priority_level} /> • <span className="font-mono">{data.registration?.stand_code}</span> • {data.venue?.name}</SheetDescription>
            </SheetHeader>

            {data.registration?.status !== 'confirme' && (
              <div className="flex items-center justify-between rounded-md border border-emerald-200 bg-emerald-50 p-3">
                <div>
                  <div className="font-medium text-emerald-900 text-sm">Valider l'inscription de cet exposant</div>
                  <div className="text-xs text-emerald-700">Bascule vers « Confirmé » et envoie un email de confirmation.</div>
                </div>
                <Button onClick={confirmReg} className="bg-emerald-600 hover:bg-emerald-700 gap-2"><CheckCircle2 className="w-4 h-4" /> Confirmer</Button>
              </div>
            )}

            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <div className="font-medium text-sm">Gestion du compte exposant</div>
                <div className="text-xs text-slate-500">Réinitialiser le mot de passe de l'exposant lié à cette structure.</div>
              </div>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={resetPassword}><KeyRound className="w-3.5 h-3.5" /> Reset mot de passe</Button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <KpiCard label="Statut" value={REGISTRATION_STATUS_LABEL[data.registration?.status] || '—'} accent="blue" />
              <KpiCard label="Caution" value={DEPOSIT_STATUS_LABEL[data.deposit?.status] || '—'} accent={data.deposit?.status === 'recue' ? 'emerald' : 'orange'} />
              <KpiCard label="Convention" value={data.registration?.is_convention_signed ? 'Signée' : 'Non'} accent={data.registration?.is_convention_signed ? 'emerald' : 'slate'} />
              <KpiCard label="Dossier" value={`${data.registration?.completion_percent || 0}%`} accent="violet" />
            </div>

            <Tabs defaultValue="resume">
              <TabsList className="w-full grid grid-cols-7">
                <TabsTrigger value="resume">Résumé</TabsTrigger>
                <TabsTrigger value="animation">Animation</TabsTrigger>
                <TabsTrigger value="docs">Documents</TabsTrigger>
                <TabsTrigger value="caution">Caution</TabsTrigger>
                <TabsTrigger value="terrain">Terrain</TabsTrigger>
                <TabsTrigger value="timeline">Timeline</TabsTrigger>
                <TabsTrigger value="histo">Historique</TabsTrigger>
                <TabsTrigger value="aracom" className="data-[state=active]:bg-amber-100 data-[state=active]:text-amber-900">🔒 ARACOM</TabsTrigger>
              </TabsList>

              <TabsContent value="resume" className="space-y-3">
                <AiInsightCard registration={data.registration} onRefresh={load} />
                <Info label="Contact" value={data.organization?.contact_name} />
                <Info label="Email" value={data.organization?.main_email} />
                <Info label="Téléphone" value={data.organization?.main_phone} />
                <Info label="Animation prévue" value={data.registration?.animation_type} />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Statut inscription</Label>
                    <Select value={data.registration?.status} onValueChange={v => updateReg({ status: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{REGISTRATION_STATUS.map(s => <SelectItem key={s} value={s}>{REGISTRATION_STATUS_LABEL[s]}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="pt-6 flex items-center gap-2">
                    <Button size="sm" variant={data.registration?.is_convention_signed ? 'default' : 'outline'} onClick={() => updateReg({ is_convention_signed: !data.registration?.is_convention_signed })} className={data.registration?.is_convention_signed ? 'bg-emerald-600' : ''}>
                      {data.registration?.is_convention_signed ? <><CheckCircle2 className="w-4 h-4 mr-1" /> Convention signée</> : 'Convention non signée'}
                    </Button>
                  </div>
                </div>
                <div>
                  <Label>Notes internes</Label>
                  <Textarea rows={3} defaultValue={data.registration?.internal_notes || ''} onBlur={e => e.target.value !== (data.registration?.internal_notes || '') && updateReg({ internal_notes: e.target.value })} />
                </div>
              </TabsContent>

              <TabsContent value="animation" className="space-y-3">
                {data.slots.length === 0 ? <p className="text-slate-500 text-sm">Aucun créneau planifié.</p> : data.slots.map(s => (
                  <div key={s.id} className="border rounded-md p-3 flex items-center justify-between">
                    <div>
                      <div className="font-medium text-sm">{s.day_label === 'vendredi' ? 'Vendredi 14 août' : 'Samedi 15 août'} • {s.start_time}–{s.end_time}</div>
                      <div className="text-xs text-slate-500">{s.title}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{s.status}</Badge>
                      <Button size="sm" variant="ghost" onClick={async () => { if (!confirm('Supprimer ce créneau ?')) return; await api(`/api/animation-slots/${s.id}`, { method: 'DELETE' }); toast.success('Supprimé'); load(); }}><Trash2 className="w-3 h-3 text-red-600" /></Button>
                    </div>
                  </div>
                ))}
                <NewSlotForm registrationId={id} venueId={data.registration?.venue_id} onDone={load} />
              </TabsContent>

              <TabsContent value="docs" className="space-y-3">
                <DocsBlock registrationId={id} documents={data.documents} onRefresh={load} />
              </TabsContent>

              <TabsContent value="caution" className="space-y-3">
                <div className="rounded-md border p-4 bg-blue-50/40">
                  <div className="text-sm text-slate-600">Montant de la caution</div>
                  <div className="text-2xl font-bold text-blue-700">{(data.deposit?.amount_xpf || DEPOSIT_AMOUNT_XPF).toLocaleString('fr-FR')} XPF</div>
                </div>
                <div>
                  <Label>Statut</Label>
                  <Select value={data.deposit?.status} onValueChange={v => updateDeposit({ status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{DEPOSIT_STATUS.map(s => <SelectItem key={s} value={s}>{DEPOSIT_STATUS_LABEL[s]}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Mode d'encaissement</Label>
                    <Select value={data.deposit?.payment_method || ''} onValueChange={v => updateDeposit({ payment_method: v })}>
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cheque">Chèque</SelectItem>
                        <SelectItem value="virement">Virement</SelectItem>
                        <SelectItem value="especes">Espèces</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Date de restitution prévue</Label>
                    <Input type="date" defaultValue={data.deposit?.expected_return_date} onBlur={e => updateDeposit({ expected_return_date: e.target.value })} />
                  </div>
                </div>
                {data.deposit?.post_event_review_comment && (
                  <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-sm">
                    <div className="font-medium text-amber-900">Revue post-événement</div>
                    <div className="text-amber-700 text-xs mt-1">{data.deposit.post_event_review_comment}</div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="terrain" className="space-y-3">
                {data.attendance_sessions.length === 0 ? <p className="text-slate-500 text-sm">Pas encore de session de contrôle terrain.</p> : data.attendance_sessions.map(s => (
                  <div key={s.id} className="border rounded-md p-3">
                    <div className="flex items-center justify-between">
                      <div className="font-medium">{s.event_date}</div>
                      <Badge>{s.presence_status}</Badge>
                    </div>
                    <div className="text-xs text-slate-500 mt-1">Arrivée : {s.actual_arrival_time || '—'} (prévue {s.expected_arrival_time}) • Départ : {s.actual_departure_time || '—'}</div>
                  </div>
                ))}
                {data.anomalies.length > 0 && (
                  <div>
                    <div className="font-medium text-sm mb-2">Anomalies</div>
                    <div className="space-y-2">
                      {data.anomalies.map(a => (
                        <div key={a.id} className="border rounded-md p-3 bg-red-50/40">
                          <div className="flex items-center justify-between">
                            <div className="font-medium text-sm">{a.title}</div>
                            <Badge variant="destructive">{a.severity_level}</Badge>
                          </div>
                          <div className="text-xs text-slate-600 mt-1">{a.description}</div>
                          <div className="text-[11px] text-slate-400 mt-1">{a.anomaly_type} • statut : {a.resolved_status}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {data.comments.length > 0 && (
                  <div>
                    <div className="font-medium text-sm mb-2">Commentaires terrain</div>
                    <div className="space-y-2">
                      {data.comments.map(c => (
                        <div key={c.id} className="border rounded-md p-3 bg-slate-50">
                          <div className="text-xs text-slate-500 uppercase tracking-wider">{c.comment_type}</div>
                          <div className="text-sm mt-1">{c.comment_text}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <Button onClick={generateBilan} variant="outline" className="w-full gap-2"><Sparkles className="w-4 h-4" /> Générer un brouillon de bilan exposant</Button>
              </TabsContent>

              <TabsContent value="timeline" className="space-y-2">
                <TimelineBlock registrationId={id} />
              </TabsContent>

              <TabsContent value="histo" className="space-y-3">
                <div>
                  <div className="font-medium text-sm mb-2">Historique de présence</div>
                  <div className="flex gap-2">
                    {data.history.length === 0 ? <div className="text-slate-500 text-sm">Aucun historique.</div> : data.history.map(h => <Badge key={h.id} variant="secondary">{h.year}</Badge>)}
                  </div>
                </div>
                <div>
                  <div className="font-medium text-sm mb-2">Préférences de sites</div>
                  <div className="flex flex-wrap gap-2">
                    {data.preferences.map(p => <Badge key={p.id} variant="outline">Rang {p.preference_rank}</Badge>)}
                  </div>
                </div>
                <div>
                  <div className="font-medium text-sm mb-2">Emails envoyés</div>
                  {data.emails.length === 0 ? <div className="text-slate-500 text-sm">Aucun email.</div> : data.emails.map(e => (
                    <div key={e.id} className="text-xs border rounded-md p-2 mb-1">
                      <div className="font-medium">{e.subject}</div>
                      <div className="text-slate-500">{e.send_status} • {e.sent_at && new Date(e.sent_at).toLocaleString('fr-FR')}</div>
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="aracom" className="space-y-3">
                <div className="rounded-md bg-amber-50 border-2 border-amber-200 p-3">
                  <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
                    <Lock className="w-4 h-4" /> Historique ARACOM — Zone privée
                  </div>
                  <div className="text-xs text-amber-700 mt-1">Ces informations sont réservées à l&apos;équipe ARACOM. Elles ne sont <b>jamais</b> affichées dans le portail exposant.</div>
                </div>

                {(() => {
                  const priv = data.organization?.aracom_private || {};
                  const ph = data.organization?.participation_history || {};
                  const convHist = priv.convention_history || {};
                  const cauHist = priv.caution_history || {};
                  const animHist = priv.animation_history || {};
                  const hasData = Object.keys(convHist).length || Object.keys(cauHist).length || Object.keys(animHist).length || priv.admin_remarks;

                  if (!hasData && !ph.nb_editions) {
                    return <div className="text-center text-slate-500 text-sm py-6 border-2 border-dashed rounded-md">Aucun historique ARACOM importé pour cet exposant.<br />Lancez l&apos;import Excel pour enrichir.</div>;
                  }

                  return (
                    <>
                      {/* Fidélité */}
                      {ph.fidelity && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          <div className="bg-white border-2 rounded-md p-2.5 text-center">
                            <div className="text-[10px] uppercase text-slate-500">Fidélité</div>
                            <div className="font-bold text-sm mt-0.5">
                              {ph.fidelity === 'Fidèle' && '⭐ Fidèle'}
                              {ph.fidelity === 'Régulier' && '📅 Régulier'}
                              {ph.fidelity === 'Ponctuel' && '📆 Ponctuel'}
                              {ph.fidelity === 'Nouveau' && '🆕 Nouveau'}
                            </div>
                          </div>
                          <div className="bg-white border-2 rounded-md p-2.5 text-center">
                            <div className="text-[10px] uppercase text-slate-500">Éditions</div>
                            <div className="font-bold text-lg text-blue-700 mt-0.5">{ph.nb_editions || 0}</div>
                          </div>
                          <div className="bg-white border-2 rounded-md p-2.5 text-center col-span-2">
                            <div className="text-[10px] uppercase text-slate-500">Présence par année</div>
                            <div className="flex gap-1 justify-center mt-1">
                              {['2019','2020','2023','2024','2025'].map(y => (
                                <span key={y} className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${ph['y'+y] ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-slate-100 text-slate-400'}`}>
                                  {y.slice(-2)} {ph['y'+y] ? '✓' : '—'}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Conventions par année */}
                      <div className="bg-white border rounded-md p-3">
                        <div className="font-medium text-sm mb-2 flex items-center gap-2">📄 Conventions par année</div>
                        {Object.keys(convHist).length === 0 ? <div className="text-xs text-slate-400">—</div> : (
                          <div className="space-y-1">
                            {Object.entries(convHist).sort().map(([year, val]) => (
                              <div key={year} className="flex items-center gap-2 text-sm">
                                <Badge variant="outline" className="w-12 justify-center">{year}</Badge>
                                <span className="text-slate-700">{val || '—'}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Cautions par année */}
                      <div className="bg-white border rounded-md p-3">
                        <div className="font-medium text-sm mb-2 flex items-center gap-2">💰 Cautions par année</div>
                        {Object.keys(cauHist).length === 0 ? <div className="text-xs text-slate-400">—</div> : (
                          <div className="space-y-1">
                            {Object.entries(cauHist).sort().map(([year, val]) => (
                              <div key={year} className="flex items-center gap-2 text-sm">
                                <Badge variant="outline" className="w-12 justify-center">{year}</Badge>
                                <span className="text-slate-700">{val || '—'}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Animations par année */}
                      <div className="bg-white border rounded-md p-3">
                        <div className="font-medium text-sm mb-2 flex items-center gap-2">🎭 Animations par année</div>
                        {Object.keys(animHist).length === 0 ? <div className="text-xs text-slate-400">—</div> : (
                          <div className="space-y-1">
                            {Object.entries(animHist).sort().map(([year, val]) => (
                              <div key={year} className="flex items-start gap-2 text-sm">
                                <Badge variant="outline" className="w-12 justify-center shrink-0">{year}</Badge>
                                <span className="text-slate-700 flex-1">{val || '—'}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Contacts historiques */}
                      {priv.historical_contact_names?.length > 0 && (
                        <div className="bg-white border rounded-md p-3">
                          <div className="font-medium text-sm mb-2">👤 Contacts historiques</div>
                          <div className="flex flex-wrap gap-1.5">
                            {priv.historical_contact_names.map((n, i) => <Badge key={i} variant="secondary">{n}</Badge>)}
                          </div>
                        </div>
                      )}

                      {/* Remarques admin (éditables) */}
                      <div className="bg-white border-2 border-amber-200 rounded-md p-3">
                        <Label className="flex items-center gap-2">📝 Remarques internes ARACOM</Label>
                        <Textarea
                          rows={4}
                          defaultValue={priv.admin_remarks || ''}
                          placeholder="Notes privées sur l'exposant (observations, incidents, rappels…) — invisible pour l'exposant"
                          onBlur={async (e) => {
                            const newVal = e.target.value.trim();
                            if (newVal === (priv.admin_remarks || '').trim()) return;
                            try {
                              await api(`/api/organizations/${data.organization.id}`, {
                                method: 'PUT',
                                body: JSON.stringify({ aracom_private: { ...priv, admin_remarks: newVal } }),
                              });
                              toast.success('Remarques ARACOM enregistrées');
                              load();
                            } catch (err) { toast.error('Erreur : ' + err.message); }
                          }}
                        />
                        {priv.last_imported_at && <div className="text-[10px] text-slate-400 mt-1">Dernier import : {new Date(priv.last_imported_at).toLocaleString('fr-FR')}</div>}
                      </div>

                      {priv.source_main_site && (
                        <div className="text-xs text-slate-500">Site principal (source Excel) : <b>{priv.source_main_site}</b></div>
                      )}
                    </>
                  );
                })()}
              </TabsContent>
            </Tabs>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Info({ label, value }) {
  return <div className="flex items-center justify-between border-b py-2"><div className="text-xs text-slate-500 uppercase tracking-wider">{label}</div><div className="text-sm font-medium text-slate-900">{value || '—'}</div></div>;
}

function SitesView() {
  const [venues, setVenues] = useState([]);
  const [selected, setSelected] = useState(null);
  const [stands, setStands] = useState([]);
  const [regs, setRegs] = useState([]);
  const [editStand, setEditStand] = useState(null);
  useEffect(() => { api('/api/venues').then(v => { setVenues(v); if (v[0]) setSelected(v[0].id); }); api('/api/registrations').then(setRegs); }, []);
  useEffect(() => { if (selected) api(`/api/venues/${selected}/stands`).then(setStands); }, [selected]);
  const reload = () => { if (selected) api(`/api/venues/${selected}/stands`).then(setStands); api('/api/registrations').then(setRegs); };

  const assignRegToStand = async (regId) => {
    if (!regId || !editStand) return;
    try {
      await api(`/api/registrations/${regId}/assign-stand`, { method: 'POST', body: JSON.stringify({ venue_stand_id: editStand.id, stand_code: editStand.stand_code, venue_id: editStand.venue_id, status: 'provisoire' }) });
      toast.success('Stand attribué');
      setEditStand(null); reload();
    } catch (e) { toast.error(e.message); }
  };
  const freeStand = async () => {
    if (!editStand?.assignment) return;
    await api(`/api/registrations/${editStand.assignment.registration_id}/assign-stand`, { method: 'POST', body: JSON.stringify({ venue_stand_id: null, venue_id: null, stand_code: null }) });
    toast.success('Stand libéré'); setEditStand(null); reload();
  };

  const toggleAvailability = async (v) => {
    const newVal = !(v.is_available_2026 !== false);
    if (!confirm(`${newVal ? 'ACTIVER' : 'DÉSACTIVER'} le site « ${v.name} » pour l'édition 2026 ?\n\n${newVal ? 'Les exposants pourront le sélectionner.' : 'Les exposants ne pourront plus le voir ni le sélectionner. Les inscriptions déjà placées sur ce site restent intactes.'}`)) return;
    try {
      await api(`/api/venues/${v.id}/set-availability`, { method: 'POST', body: JSON.stringify({ is_available_2026: newVal }) });
      toast.success(`Site ${v.name} ${newVal ? 'activé ✅' : 'désactivé 🔒'}`);
      api('/api/venues').then(setVenues);
    } catch (e) { toast.error(e.message); }
  };

  return (
    <div className="space-y-4">
      <Card className="border-blue-200 bg-blue-50/40">
        <CardContent className="p-4">
          <div className="flex items-start gap-3 mb-2">
            <MapPin className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-bold text-blue-900">Sites disponibles pour l&apos;édition 2026</h3>
              <p className="text-xs text-blue-800">Activez ou désactivez chaque site. Les sites désactivés ne sont plus visibles côté exposant.</p>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-2">
            {venues.map(v => {
              const active = v.is_available_2026 !== false;
              return (
                <div key={v.id} className={`flex items-center justify-between p-2 rounded-md border ${active ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-100 border-slate-200 opacity-70'}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{v.name}</span>
                    <Badge variant="secondary" className="text-[10px]">{v.code}</Badge>
                  </div>
                  <Switch checked={active} onCheckedChange={() => toggleAvailability(v)} />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        {venues.filter(v => v.is_available_2026 !== false).map(v => {
          return (
            <Button key={v.id} variant={selected === v.id ? 'default' : 'outline'} onClick={() => setSelected(v.id)}>
              <MapPin className="w-4 h-4 mr-2" /> {v.name}
              <Badge variant="secondary" className="ml-2 bg-white/20 text-xs">{v.capacity_stands}</Badge>
            </Button>
          );
        })}
      </div>

      {selected && (
        <SmartVenueMap
          stands={stands}
          venue={venues.find(v => v.id === selected)}
          onStandClick={(s) => setEditStand(s)}
          onStandsReload={reload}
          editable={true}
        />
      )}

      {selected && <ConfirmedExposantsPanel stands={stands} venue={venues.find(v => v.id === selected)} />}

      <Sheet open={!!editStand} onOpenChange={(o) => !o && setEditStand(null)}>
        <SheetContent className="w-full sm:max-w-md">
          {editStand && (
            <>
              <SheetHeader>
                <SheetTitle>Stand {editStand.stand_code}</SheetTitle>
                <SheetDescription>{venues.find(v => v.id === editStand.venue_id)?.name}</SheetDescription>
              </SheetHeader>
              <div className="mt-4 space-y-4">
                {editStand.organization ? (
                  <div className="rounded-md bg-slate-50 border p-3">
                    <div className="text-xs text-slate-500 uppercase">Actuellement attribué à</div>
                    <div className="font-medium mt-1">{editStand.organization.name}</div>
                    <div className="text-xs text-slate-500">{editStand.organization.discipline}</div>
                    <Button variant="outline" size="sm" className="mt-2 text-red-600 border-red-200" onClick={freeStand}><XCircle className="w-4 h-4 mr-1" /> Libérer ce stand</Button>
                  </div>
                ) : (
                  <div className="rounded-md bg-blue-50 border border-blue-100 p-3 text-blue-900 text-sm">Ce stand est libre.</div>
                )}
                <div>
                  <Label>Attribuer à un exposant</Label>
                  <Select onValueChange={assignRegToStand}>
                    <SelectTrigger><SelectValue placeholder="Choisir un exposant…" /></SelectTrigger>
                    <SelectContent className="max-h-[400px]">
                      {regs.map(r => (
                        <SelectItem key={r.id} value={r.id}>{r.organization?.name} — {r.venue?.name || 'sans site'} / {r.stand_code || 'libre'}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function CautionsView() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [venueFilter, setVenueFilter] = useState('all');
  const [bulkSelected, setBulkSelected] = useState(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const reload = () => api('/api/registrations').then(r => { setRows(r); setLoading(false); });
  useEffect(() => { reload(); }, []);
  const updateStatus = async (depId, status) => {
    await api(`/api/deposits/${depId}`, { method: 'PUT', body: JSON.stringify({ status }) });
    const r = await api('/api/registrations'); setRows(r);
    toast.success('Caution mise à jour');
  };
  const generateReceipt = async (reg) => {
    if (!confirm(`Générer le reçu de caution pour ${reg.organization?.name} ?\n\nLe document sera automatiquement disponible dans son espace exposant.`)) return;
    try {
      const res = await api(`/api/registrations/${reg.id}/generate-caution-receipt`, { method: 'POST', body: JSON.stringify({}) });
      toast.success(`✅ Reçu ${res.receipt_number} généré et transmis à l'exposant`);
      reload();
    } catch (e) { toast.error(e.message); }
  };
  const confirmStand = async (reg) => {
    if (!confirm(`Confirmer définitivement l'inscription de ${reg.organization?.name} (stand ${reg.stand_code}) ?\n\nLa caution sera marquée comme reçue et l'exposant passera en statut "Confirmé".`)) return;
    try {
      await api(`/api/registrations/${reg.id}/confirm-stand`, { method: 'POST', body: JSON.stringify({}) });
      toast.success(`✅ ${reg.organization?.name} confirmé`);
      reload();
    } catch (e) { toast.error(e.message); }
  };

  // ===== BULK ACTIONS =====
  const toggleBulk = (id) => { const n = new Set(bulkSelected); if (n.has(id)) n.delete(id); else n.add(id); setBulkSelected(n); };
  const bulkConfirm = async () => {
    if (bulkSelected.size === 0) return;
    if (!confirm(`Confirmer DÉFINITIVEMENT les inscriptions de ${bulkSelected.size} exposant(s) ? Les cautions passeront en "Reçue" et le statut en "Confirmé".`)) return;
    setBulkBusy(true);
    try {
      const r = await api('/api/registrations/bulk-confirm', { method: 'POST', body: JSON.stringify({ ids: Array.from(bulkSelected) }) });
      toast.success(`✅ ${r.confirmed} exposant(s) confirmé(s)`);
      setBulkSelected(new Set()); reload();
    } catch (e) { toast.error(e.message); }
    finally { setBulkBusy(false); }
  };
  const bulkGenerateReceipts = async () => {
    if (bulkSelected.size === 0) return;
    if (!confirm(`Générer ${bulkSelected.size} reçus de caution en masse ? (Les exposants ayant déjà un reçu seront ignorés)`)) return;
    setBulkBusy(true);
    try {
      const r = await api('/api/registrations/bulk-generate-receipts', { method: 'POST', body: JSON.stringify({ ids: Array.from(bulkSelected) }) });
      toast.success(`✅ ${r.generated} reçu(s) généré(s)`);
      setBulkSelected(new Set()); reload();
    } catch (e) { toast.error(e.message); }
    finally { setBulkBusy(false); }
  };
  const bulkMarkCaution = async (status) => {
    if (bulkSelected.size === 0) return;
    if (!confirm(`Marquer les cautions de ${bulkSelected.size} exposant(s) comme "${DEPOSIT_STATUS_LABEL[status]}" ?`)) return;
    setBulkBusy(true);
    try {
      const depIds = rows.filter(r => bulkSelected.has(r.id)).map(r => r.deposit?.id).filter(Boolean);
      const r = await api('/api/deposits/bulk-update-status', { method: 'POST', body: JSON.stringify({ ids: depIds, status }) });
      toast.success(`✅ ${r.modified} caution(s) mises à jour`);
      setBulkSelected(new Set()); reload();
    } catch (e) { toast.error(e.message); }
    finally { setBulkBusy(false); }
  };

  const venues = [...new Set(rows.map(r => r.venue?.name).filter(Boolean))].sort();
  const filtered = rows.filter(r => {
    if (statusFilter !== 'all' && r.deposit?.status !== statusFilter) return false;
    if (venueFilter !== 'all' && r.venue?.name !== venueFilter) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const hit = (r.organization?.name || '').toLowerCase().includes(q) ||
        (r.organization?.discipline || '').toLowerCase().includes(q) ||
        (r.stand_code || '').toLowerCase().includes(q) ||
        (r.organization?.main_email || '').toLowerCase().includes(q);
      if (!hit) return false;
    }
    return true;
  });
  const totalExpected = rows.length * 20000;
  const totalReceived = rows.filter(r => r.deposit?.status === 'recue').length * 20000;
  const allFilteredChecked = filtered.length > 0 && filtered.every(r => bulkSelected.has(r.id));
  const toggleAll = () => {
    if (allFilteredChecked) { const n = new Set(bulkSelected); filtered.forEach(r => n.delete(r.id)); setBulkSelected(n); }
    else { const n = new Set(bulkSelected); filtered.forEach(r => n.add(r.id)); setBulkSelected(n); }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Total attendu" value={`${totalExpected.toLocaleString('fr-FR')} XPF`} accent="blue" />
        <KpiCard label="Encaissé" value={`${totalReceived.toLocaleString('fr-FR')} XPF`} accent="emerald" />
        <KpiCard label="Reçues" value={rows.filter(r => r.deposit?.status === 'recue').length} accent="emerald" />
        <KpiCard label="Non demandées" value={rows.filter(r => !r.deposit || r.deposit.status === 'non_demandee').length} accent="slate" />
      </div>

      {bulkSelected.size > 0 && (
        <Card className="border-violet-200 bg-violet-50/40 sticky top-2 z-10">
          <CardContent className="p-3 flex flex-wrap items-center gap-2">
            <Badge className="bg-violet-600">{bulkSelected.size} sélectionné(s)</Badge>
            <Button size="sm" className="h-8 gap-1 bg-emerald-600 hover:bg-emerald-700" onClick={bulkConfirm} disabled={bulkBusy}>
              <CheckCircle2 className="w-3.5 h-3.5" /> Confirmer en masse
            </Button>
            <Button size="sm" variant="outline" className="h-8 gap-1" onClick={bulkGenerateReceipts} disabled={bulkBusy}>
              <FileText className="w-3.5 h-3.5" /> Générer reçus
            </Button>
            <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => bulkMarkCaution('recue')} disabled={bulkBusy}>
              <Wallet className="w-3.5 h-3.5" /> Caution reçue
            </Button>
            <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => bulkMarkCaution('demandee')} disabled={bulkBusy}>
              Caution demandée
            </Button>
            <div className="flex-1" />
            <Button size="sm" variant="ghost" className="h-8" onClick={() => setBulkSelected(new Set())}>Annuler sélection</Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input placeholder="Rechercher un exposant, stand, email, discipline…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={venueFilter} onValueChange={setVenueFilter}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Site" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les sites</SelectItem>
                {venues.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Statut" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous statuts</SelectItem>
                {DEPOSIT_STATUS.map(s => <SelectItem key={s} value={s}>{DEPOSIT_STATUS_LABEL[s]}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={() => exportCautionsCSV(filtered)} className="gap-2"><Download className="w-3.5 h-3.5" /> Export CSV</Button>
            <div className="text-xs text-slate-500 font-medium whitespace-nowrap">{filtered.length} / {rows.length}</div>
          </div>
        </CardContent>
      </Card>

      <Card><CardContent className="p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b text-left text-xs uppercase text-slate-500"><tr>
            <th className="py-2 pl-4 w-8"><input type="checkbox" checked={allFilteredChecked} onChange={toggleAll} className="w-4 h-4 accent-violet-600" /></th>
            <th>Exposant</th><th>Site</th><th>Stand</th><th>Email</th><th>Statut caution</th><th>Inscription</th><th className="text-right pr-4">Actions</th>
          </tr></thead>
          <tbody className="divide-y">
            {loading ? <tr><td colSpan="8" className="py-6 text-center text-slate-400">…</td></tr> : filtered.length === 0 ? <tr><td colSpan="8" className="py-6 text-center text-slate-400">Aucun résultat</td></tr> : filtered.map(r => {
              const isPreReserved = r.is_pre_reserved && r.status !== 'confirme';
              const checked = bulkSelected.has(r.id);
              return (
                <tr key={r.id} className={`hover:bg-slate-50/50 ${checked ? 'bg-violet-50/30' : ''}`}>
                  <td className="py-2 pl-4"><input type="checkbox" checked={checked} onChange={() => toggleBulk(r.id)} className="w-4 h-4 accent-violet-600" /></td>
                  <td><div className="flex items-center gap-2"><AiInsightTrigger registration={r} size="xs" /><div><div className="font-medium">{r.organization?.name}</div><div className="text-xs text-slate-500">{r.organization?.discipline}</div></div></div></td>
                  <td>{r.venue?.name}</td>
                  <td className="font-mono text-xs">{r.stand_code}</td>
                  <td className="text-xs text-slate-600">{r.organization?.main_email}</td>
                  <td><Badge variant={r.deposit?.status === 'recue' ? 'default' : 'secondary'} className={r.deposit?.status === 'recue' ? 'bg-emerald-600' : ''}>{DEPOSIT_STATUS_LABEL[r.deposit?.status] || '—'}</Badge></td>
                  <td>
                    <Badge className={REGISTRATION_STATUS_COLOR[r.status]}>{REGISTRATION_STATUS_LABEL[r.status]}</Badge>
                    {isPreReserved && <div className="text-[10px] text-amber-600 mt-0.5">⏳ Pré-réservé</div>}
                  </td>
                  <td className="py-1 pr-4">
                    <div className="flex gap-1.5 justify-end items-center flex-wrap">
                      <Select value={r.deposit?.status || 'non_demandee'} onValueChange={v => updateStatus(r.deposit?.id || r.deposit?._id || r.id, v)}>
                        <SelectTrigger className="h-8 w-[140px]"><SelectValue /></SelectTrigger>
                        <SelectContent>{DEPOSIT_STATUS.map(s => <SelectItem key={s} value={s}>{DEPOSIT_STATUS_LABEL[s]}</SelectItem>)}</SelectContent>
                      </Select>
                      {r.deposit?.status === 'recue' && (
                        <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={() => generateReceipt(r)} title="Générer un reçu de caution">
                          <FileText className="w-3 h-3" /> Reçu
                        </Button>
                      )}
                      {isPreReserved && r.deposit?.status === 'recue' && (
                        <Button size="sm" className="h-8 gap-1 text-xs bg-emerald-600 hover:bg-emerald-700" onClick={() => confirmStand(r)} title="Confirmer définitivement l'inscription">
                          <CheckCircle2 className="w-3 h-3" /> Confirmer
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent></Card>
    </div>
  );
}

// 🛡️ Toggle Mail TEST/PRODUCTION mode — exige mot de passe admin pour passer en PROD
function ToggleMailModeButton({ currentMode, onToggled }) {
  const [open, setOpen] = useState(false);
  const [pwd, setPwd] = useState('');
  const [busy, setBusy] = useState(false);
  const targetMode = currentMode === 'test' ? 'production' : 'test';
  const isDangerous = targetMode === 'production'; // Production = envoi RÉEL

  const submit = async () => {
    if (!pwd) { toast.error('Mot de passe requis'); return; }
    setBusy(true);
    try {
      const r = await api('/api/mailing/toggle-test-mode', {
        method: 'POST',
        body: JSON.stringify({ mode: targetMode, confirm_password: pwd }),
      });
      toast.success(r.message, { duration: 6000 });
      setOpen(false);
      setPwd('');
      onToggled?.();
    } catch (e) {
      toast.error(e.message);
    } finally { setBusy(false); }
  };

  if (!open) {
    return (
      <Button
        size="sm"
        variant={isDangerous ? 'destructive' : 'outline'}
        onClick={() => setOpen(true)}
        className={`h-7 text-[11px] gap-1 ${isDangerous ? '' : 'border-emerald-600 text-emerald-700 hover:bg-emerald-50'}`}
      >
        {isDangerous
          ? '⚠️ Passer en mode PRODUCTION (envoi RÉEL)'
          : '🛡️ Repasser en mode TEST'}
      </Button>
    );
  }
  return (
    <div className={`rounded-md border-2 ${isDangerous ? 'border-red-600 bg-red-50' : 'border-emerald-600 bg-emerald-50'} p-3 flex flex-col gap-2 max-w-md`}>
      <div className="text-xs font-bold">
        {isDangerous
          ? '⚠️ DOUBLE CONFIRMATION : passer en mode PRODUCTION'
          : '🛡️ Repasser en mode TEST'}
      </div>
      {isDangerous && (
        <div className="text-[11px] text-red-800 leading-relaxed">
          Tous les emails partiront <b>RÉELLEMENT</b> aux destinataires. Cette action est tracée dans le journal d&apos;audit. Saisissez votre mot de passe ARACOM pour confirmer.
        </div>
      )}
      <Input
        type="password"
        value={pwd}
        onChange={e => setPwd(e.target.value)}
        placeholder="Votre mot de passe ARACOM"
        className="h-8 text-xs"
        autoFocus
        onKeyDown={e => e.key === 'Enter' && submit()}
      />
      <div className="flex gap-2">
        <Button size="sm" variant="ghost" onClick={() => { setOpen(false); setPwd(''); }} disabled={busy} className="h-7 text-[11px]">Annuler</Button>
        <Button
          size="sm"
          variant={isDangerous ? 'destructive' : 'default'}
          onClick={submit}
          disabled={busy || !pwd}
          className="h-7 text-[11px] flex-1"
        >
          {busy ? 'Application…' : (isDangerous ? 'Confirmer le passage en PRODUCTION' : 'Confirmer le retour en TEST')}
        </Button>
      </div>
    </div>
  );
}


const MAIL_TYPES = [
  { value: 'relance_caution', label: 'Relance caution (20 000 XPF)', icon: '💰' },
  { value: 'relance_convention', label: 'Relance convention non signée', icon: '📝' },
  { value: 'relance_assurance', label: 'Relance attestation assurance', icon: '🛡️' },
  { value: 'relance_generale', label: 'Relance dossier incomplet', icon: '⚠️' },
  { value: 'confirmation', label: 'Confirmation de participation', icon: '✅' },
  { value: 'invitation_inscription', label: "Invitation à s'inscrire", icon: '📨' },
  { value: 'invitation_satisfaction', label: 'Questionnaire satisfaction', icon: '⭐' },
  { value: 'remerciement', label: 'Remerciement post-événement', icon: '🙏' },
  { value: 'info_pratique', label: 'Infos pratiques (horaires, accès)', icon: 'ℹ️' },
  { value: 'annonce', label: 'Annonce générale', icon: '📣' },
];

function MailingView() {
  const [emails, setEmails] = useState([]);
  const [regs, setRegs] = useState([]);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [type, setType] = useState('relance_caution');
  const [tone, setTone] = useState('professionnel chaleureux');
  const [customInstruction, setCustomInstruction] = useState('');
  const [filter, setFilter] = useState('a_relancer');
  const [siteFilter, setSiteFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all'); // '2019', '2020', '2023', '2024', '2025', 'fidele', 'regulier', 'ponctuel', 'jamais'
  const [recipientSearch, setRecipientSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [lastUsage, setLastUsage] = useState(null);
  const [smtp, setSmtp] = useState({ ok: false, configured: false, host: null, user: null, error: 'Non testé' });
  const [mailStatus, setMailStatus] = useState({ test_mode_active: false, redirect_to: null, allowed_recipients: [] });
  const [testingSmtp, setTestingSmtp] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [testRecipient, setTestRecipient] = useState('');
  const [templates, setTemplates] = useState([]);
  const [recipientLists, setRecipientLists] = useState([]);

  const load = () => Promise.all([api('/api/emails').then(setEmails), api('/api/registrations').then(setRegs)]);
  const loadTemplates = () => api('/api/mail-templates').then(setTemplates).catch(() => {});
  const loadLists = () => api('/api/mail-recipient-lists').then(setRecipientLists).catch(() => {});
  const loadSmtp = async () => {
    try {
      const r = await api('/api/mailing/test-smtp', { method: 'POST', body: JSON.stringify({}) });
      setSmtp(r);
    } catch (e) {
      setSmtp({ ok: false, configured: false, error: e.message });
    }
  };
  const loadMailStatus = async () => {
    try {
      const r = await api('/api/mailing/status');
      setMailStatus(r);
    } catch (e) {
      // Silent — banner just won't appear
    }
  };
  useEffect(() => { load(); loadSmtp(); loadTemplates(); loadLists(); loadMailStatus(); }, []);

  // Save / load templates
  const saveTemplate = async () => {
    if (!subject || !body) { toast.error('Générez ou écrivez un mail d\'abord'); return; }
    const name = window.prompt('Nom du template ?', `${MAIL_TYPES.find(t => t.value === type)?.label || type} — ${new Date().toLocaleDateString('fr-FR')}`);
    if (!name?.trim()) return;
    try {
      await api('/api/mail-templates', {
        method: 'POST',
        body: JSON.stringify({ name, mail_type: type, subject, body_html: body, tone, custom_instruction: customInstruction }),
      });
      toast.success(`💾 Template "${name}" sauvegardé`);
      loadTemplates();
    } catch (e) { toast.error(e.message); }
  };
  const loadTemplate = async (templateId) => {
    if (!templateId) return;
    try {
      const tpl = await api(`/api/mail-templates/${templateId}`);
      setSubject(tpl.subject);
      setBody(tpl.body_html);
      setType(tpl.mail_type);
      setTone(tpl.tone);
      setCustomInstruction(tpl.custom_instruction || '');
      toast.success(`📩 Template "${tpl.name}" chargé`);
    } catch (e) { toast.error(e.message); }
  };
  const deleteTemplate = async (templateId, name) => {
    if (!confirm(`Supprimer le template "${name}" ?`)) return;
    await api(`/api/mail-templates/${templateId}`, { method: 'DELETE' });
    toast.success('Template supprimé');
    loadTemplates();
  };

  // Save / load recipient lists
  const saveRecipientList = async () => {
    if (selectedIds.size === 0) { toast.error('Sélectionnez au moins 1 destinataire'); return; }
    const name = window.prompt('Nom de cette liste de destinataires ?', `Liste ${selectedIds.size} dest. — ${new Date().toLocaleDateString('fr-FR')}`);
    if (!name?.trim()) return;
    try {
      await api('/api/mail-recipient-lists', {
        method: 'POST',
        body: JSON.stringify({ name, registration_ids: Array.from(selectedIds) }),
      });
      toast.success(`💾 Liste "${name}" (${selectedIds.size} dest.) sauvegardée`);
      loadLists();
    } catch (e) { toast.error(e.message); }
  };
  const loadRecipientList = (listId) => {
    if (!listId) return;
    const lst = recipientLists.find(l => l.id === listId);
    if (!lst) return;
    setSelectedIds(new Set(lst.registration_ids));
    setFilter('all'); // show all so the loaded ids are visible
    setSiteFilter('all');
    setRecipientSearch('');
    toast.success(`📋 Liste "${lst.name}" chargée (${lst.count} dest.)`);
  };
  const deleteRecipientList = async (listId, name) => {
    if (!confirm(`Supprimer la liste "${name}" ?`)) return;
    await api(`/api/mail-recipient-lists/${listId}`, { method: 'DELETE' });
    toast.success('Liste supprimée');
    loadLists();
  };

  // Liste filtrée par les filtres (statut + site + recherche)
  const filteredRegs = regs.filter(r => {
    if (filter === 'a_relancer' && r.status !== 'a_relancer') return false;
    if (filter === 'a_confirmer' && r.status !== 'a_confirmer') return false;
    if (filter === 'confirme' && r.status !== 'confirme') return false;
    if (filter === 'no_caution' && r.deposit?.status === 'recue') return false;
    if (filter === 'no_insurance' && r.is_insurance_uploaded) return false;
    if (siteFilter !== 'all' && r.venue?.name !== siteFilter) return false;
    if (yearFilter !== 'all') {
      const h = r.organization?.participation_history;
      if (yearFilter === 'no_history') {
        if (h) return false;
      } else if (['2019', '2020', '2023', '2024', '2025'].includes(yearFilter)) {
        if (!h || !h[`y${yearFilter}`]) return false;
      } else if (yearFilter === 'fidele') {
        if (!h || !(h.fidelity || '').includes('Fidèle')) return false;
      } else if (yearFilter === 'regulier') {
        if (!h || h.fidelity !== 'Régulier') return false;
      } else if (yearFilter === 'ponctuel') {
        if (!h || h.fidelity !== 'Ponctuel') return false;
      } else if (yearFilter === 'jamais') {
        if (h && h.nb_editions > 0) return false;
      }
    }
    if (recipientSearch.trim()) {
      const q = recipientSearch.trim().toLowerCase();
      const hit = (r.organization?.name || '').toLowerCase().includes(q) ||
        (r.organization?.main_email || '').toLowerCase().includes(q) ||
        (r.organization?.discipline || '').toLowerCase().includes(q) ||
        (r.stand_code || '').toLowerCase().includes(q);
      if (!hit) return false;
    }
    return true;
  });
  const venues = [...new Set(regs.map(r => r.venue?.name).filter(Boolean))].sort();

  // Quand les filtres changent, on resync la sélection avec tous les visibles
  useEffect(() => {
    setSelectedIds(new Set(filteredRegs.map(r => r.id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, siteFilter, yearFilter, regs.length]);

  // Destinataires effectifs (= cochés ET visibles dans le filtre)
  const targetRegs = filteredRegs.filter(r => selectedIds.has(r.id));

  const toggleOne = (id) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };
  const selectOnly = (id) => {
    setSelectedIds(new Set([id]));
  };
  const selectAll = () => setSelectedIds(new Set(filteredRegs.map(r => r.id)));
  const selectNone = () => setSelectedIds(new Set());

  const generateAI = async () => {
    setGenerating(true);
    try {
      const sampleIds = targetRegs.slice(0, Math.min(3, targetRegs.length)).map(r => r.id);
      const res = await api('/api/mailing/generate-ai', {
        method: 'POST',
        body: JSON.stringify({ mail_type: type, registration_ids: sampleIds, tone, custom_instruction: customInstruction }),
      });
      setSubject(res.subject || '');
      setBody(res.body_html || '');
      setLastUsage(res.usage);
      toast.success(`✨ Mail généré par Claude Sonnet 4.5 (${res.target_count} destinataire${res.target_count > 1 ? 's' : ''} ciblé${res.target_count > 1 ? 's' : ''})`);
    } catch (e) { toast.error(`IA: ${e.message}`); }
    finally { setGenerating(false); }
  };

  const send = async () => {
    if (!subject || !body) { toast.error('Objet et corps requis'); return; }
    if (!targetRegs.length) { toast.error('Aucun destinataire sélectionné — cochez au moins une case'); return; }
    const realSend = smtp.ok;
    const testModeActive = mailStatus.test_mode_active;
    // 🛡️ EN MODE TEST : aucune confirmation nécessaire (impossible d'envoyer aux vrais contacts)
    if (!testModeActive && targetRegs.length > 1) {
      const samples = targetRegs.slice(0, 5).map(r => `• ${r.organization?.name} <${r.organization?.main_email}>`).join('\n');
      const more = targetRegs.length > 5 ? `\n... et ${targetRegs.length - 5} autre(s)` : '';
      const mode = realSend
        ? '✅ MODE RÉEL via Gmail SMTP — les emails partiront réellement.'
        : '⚠️ MODE MOCK — SMTP non configuré, aucun email réel ne partira.';
      if (!confirm(`📧 ENVOI GROUPÉ à ${targetRegs.length} destinataires\n${mode}\n\nObjet : ${subject}\n\nDestinataires :\n${samples}${more}\n\nConfirmer l'envoi ?`)) return;
    }
    if (testModeActive) {
      toast.info(`🛡️ Mode TEST — Envoi intercepté, redirection vers ${mailStatus.redirect_to}…`);
    } else if (targetRegs.length === 1) {
      toast.info(`📧 Envoi en cours à ${targetRegs[0]?.organization?.main_email || '1 destinataire'}…`);
    }
    if (!testModeActive && realSend && targetRegs.length > 10) {
      if (!confirm(`⚠️ DOUBLE CONFIRMATION : vous allez envoyer ${targetRegs.length} emails RÉELS. Cette action est irréversible. Continuer ?`)) return;
    }
    setSending(true);
    try {
      const res = await api('/api/mailing/send', {
        method: 'POST',
        body: JSON.stringify({ subject, body_html: body, registration_ids: targetRegs.map(r => r.id), mail_type: type }),
      });
      if (res.test_mode_active && res.redirected_count > 0) {
        toast.success(
          `🛡️ MODE TEST — ${res.redirected_count} email(s) intercepté(s) → ${res.redirect_to}\nAucun email n'est parti vers vos contacts.`,
          { duration: 8000 }
        );
      } else if (res.smtp_used) {
        toast.success(`📧 ${res.sent} email(s) envoyé(s) via Gmail${res.failed ? ` — ${res.failed} échec(s)` : ''}`);
      } else {
        toast.success(`✉️ ${res.sent} email(s) enregistrés (MOCK — SMTP non configuré)`);
      }
      load();
    } catch (e) { toast.error(e.message); }
    finally { setSending(false); }
  };

  // Schedule send for later
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduled, setScheduled] = useState([]);
  const loadScheduled = () => api('/api/mailing/scheduled').then(setScheduled).catch(() => {});
  useEffect(() => { loadScheduled(); }, []);

  const scheduleSend = async () => {
    if (!subject || !body) { toast.error('Objet et corps requis'); return; }
    if (!targetRegs.length) { toast.error('Aucun destinataire sélectionné'); return; }
    if (!scheduledDate) { toast.error('Choisissez une date/heure'); return; }
    const when = new Date(scheduledDate);
    if (isNaN(when.getTime())) { toast.error('Date invalide'); return; }
    if (when.getTime() < Date.now()) { toast.error('La date doit être dans le futur'); return; }
    if (!confirm(`Programmer l'envoi de ce mail à ${targetRegs.length} destinataire(s) pour le ${when.toLocaleString('fr-FR')} ?`)) return;
    try {
      await api('/api/mailing/schedule', {
        method: 'POST',
        body: JSON.stringify({ subject, body_html: body, registration_ids: targetRegs.map(r => r.id), mail_type: type, scheduled_at: when.toISOString() }),
      });
      toast.success(`📅 Envoi programmé pour le ${when.toLocaleString('fr-FR')}`);
      setScheduledDate('');
      loadScheduled();
    } catch (e) { toast.error(e.message); }
  };
  const processNow = async () => {
    try {
      const r = await api('/api/mailing/process-scheduled', { method: 'POST', body: JSON.stringify({}) });
      toast.success(`🚀 ${r.processed} campagne(s) traitée(s) — ${r.sent} envoyé(s) — ${r.failed} échec(s)`);
      loadScheduled(); load();
    } catch (e) { toast.error(e.message); }
  };

  const testSmtp = async () => {
    setTestingSmtp(true);
    try {
      await loadSmtp();
      // Re-read after loadSmtp to display result
      const r = await api('/api/mailing/test-smtp', { method: 'POST', body: JSON.stringify({}) }).catch(e => ({ ok: false, error: e.message }));
      if (r.ok) toast.success('✅ Connexion SMTP réussie !');
      else toast.error(`❌ ${r.error || 'Erreur SMTP'}`);
      setSmtp(r);
    } finally { setTestingSmtp(false); }
  };

  const sendTestEmail = async () => {
    if (!testRecipient) { toast.error('Adresse de test requise'); return; }
    setSendingTest(true);
    try {
      const r = await api('/api/mailing/send-test', { method: 'POST', body: JSON.stringify({ to: testRecipient }) });
      if (r.ok) {
        if (r.test_mode_active && r.redirect_to && String(r.redirect_to).toLowerCase() !== String(testRecipient).toLowerCase()) {
          toast.success(`🛡️ MODE TEST — Email intercepté → redirigé vers ${r.redirect_to} (au lieu de ${testRecipient})`, { duration: 8000 });
        } else {
          toast.success(`📨 Email de test envoyé à ${testRecipient}`);
        }
      }
      else toast.error(`❌ ${r.error}`);
    } catch (e) { toast.error(e.message); }
    finally { setSendingTest(false); }
  };

  return (
    <div className="space-y-4">
      {/* 🛡️ TEST MODE — top-of-page sticky banner */}
      {mailStatus.test_mode_active && (
        <div className="rounded-lg border-2 border-red-500 bg-red-50 p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="text-3xl">🛡️</div>
            <div className="flex-1 min-w-0">
              <div className="font-extrabold text-red-700 text-base flex items-center gap-2 flex-wrap">
                MODE TEST ACTIVÉ — Aucun email ne part vers vos contacts
                <Badge className="bg-red-600 text-white">Sécurité maximale</Badge>
              </div>
              <div className="text-sm text-red-800 mt-1.5 leading-relaxed">
                Tous les emails sont <b>interceptés par le serveur</b> et redirigés vers&nbsp;
                <code className="bg-white px-1.5 py-0.5 rounded border border-red-300 text-red-900 font-bold">
                  {mailStatus.redirect_to}
                </code>.
                Le sujet est préfixé par <code className="bg-white px-1 rounded border border-red-300">[TEST→email.original]</code> pour vous indiquer le destinataire prévu.
                {mailStatus.allowed_recipients?.length > 0 && (
                  <div className="mt-1 text-xs text-red-700">
                    Exceptions (envois directs autorisés) : {mailStatus.allowed_recipients.join(', ')}
                  </div>
                )}
              </div>
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <ToggleMailModeButton currentMode="test" onToggled={loadMailStatus} />
                {mailStatus.updated_at && (
                  <span className="text-[11px] text-red-600">
                    Dernière modification : {new Date(mailStatus.updated_at).toLocaleString('fr-FR')} par {mailStatus.updated_by}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {!mailStatus.test_mode_active && smtp.ok && (
        <div className="rounded-lg border-2 border-emerald-500 bg-emerald-50 p-3 shadow-sm">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="text-2xl">📨</div>
            <div className="text-sm text-emerald-900 flex-1 min-w-0">
              <b>MODE PRODUCTION — Envoi RÉEL aux contacts.</b> Vos destinataires recevront effectivement les emails. Soyez vigilant.
            </div>
            <ToggleMailModeButton currentMode="production" onToggled={loadMailStatus} />
          </div>
          {mailStatus.updated_at && (
            <div className="text-[11px] text-emerald-700 mt-1.5 ml-9">
              Activé le {new Date(mailStatus.updated_at).toLocaleString('fr-FR')} par {mailStatus.updated_by}
            </div>
          )}
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-4">
      {/* Colonne 1 : composition */}
      <div className="lg:col-span-2 space-y-4">
        {/* SMTP status banner */}
        <Card className={smtp.ok ? 'border-emerald-200 bg-emerald-50/30' : 'border-amber-200 bg-amber-50/30'}>
          <CardContent className="p-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm">
              {smtp.ok ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span><b>Gmail SMTP actif</b> — envois réels via <code className="text-xs bg-white px-1 py-0.5 rounded border">{smtp.user || '—'}</code></span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                  <span><b>SMTP non actif</b> — {smtp.configured ? 'erreur de connexion' : 'mot de passe Gmail manquant'}. {smtp.error && <span className="text-amber-700 text-xs">({smtp.error})</span>}</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="email"
                placeholder="email@test.com"
                value={testRecipient}
                onChange={e => setTestRecipient(e.target.value)}
                className="h-8 text-xs w-44"
                disabled={!smtp.ok}
              />
              <Button size="sm" variant="outline" disabled={!smtp.ok || sendingTest || !testRecipient} onClick={sendTestEmail} className="h-8 text-xs gap-1">
                <Send className="w-3 h-3" /> {sendingTest ? '…' : 'Test'}
              </Button>
              <Button size="sm" variant="outline" disabled={testingSmtp} onClick={testSmtp} className="h-8 text-xs gap-1">
                <RefreshCw className={`w-3 h-3 ${testingSmtp ? 'animate-spin' : ''}`} /> Vérifier
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-violet-200 bg-gradient-to-br from-violet-50/40 to-white">
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base flex items-center gap-2"><Sparkles className="w-4 h-4 text-violet-600" /> Rédaction IA — Claude Sonnet 4.5</CardTitle>
              <Badge variant="secondary" className="bg-violet-100 text-violet-700">Boosté IA</Badge>
            </div>
            <p className="text-xs text-slate-500 mt-1">Sélectionne un type, des destinataires, et laisse l'IA rédiger un mail professionnel personnalisé que tu pourras éditer avant envoi.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs uppercase text-slate-500">Type de mail</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{MAIL_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.icon} {t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs uppercase text-slate-500">Ton</Label>
                <Select value={tone} onValueChange={setTone}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="professionnel chaleureux">Professionnel chaleureux</SelectItem>
                    <SelectItem value="formel et institutionnel">Formel et institutionnel</SelectItem>
                    <SelectItem value="direct et efficace">Direct et efficace</SelectItem>
                    <SelectItem value="amical et convivial">Amical et convivial</SelectItem>
                    <SelectItem value="ferme (pour relance urgente)">Ferme (pour relance urgente)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs uppercase text-slate-500">Instructions spécifiques <span className="normal-case text-slate-400">(optionnel)</span></Label>
              <Textarea rows={2} value={customInstruction} onChange={e => setCustomInstruction(e.target.value)} placeholder="Ex: mentionner la date limite du 15 juillet, inclure un lien vers le portail exposant…" className="mt-1" />
            </div>
            <Button onClick={generateAI} disabled={generating} size="lg" className="w-full bg-violet-600 hover:bg-violet-700 gap-2">
              <Sparkles className="w-4 h-4" />
              {generating ? 'Claude rédige le mail…' : targetRegs.length > 0 ? `Générer un mail pour ${targetRegs.length} destinataire(s)` : 'Sélectionnez des destinataires'}
            </Button>
            {lastUsage && <p className="text-[11px] text-slate-400">Claude Sonnet 4.5 (via Emergent) • {lastUsage.prompt_tokens || lastUsage.input_tokens || 0} tokens in / {lastUsage.completion_tokens || lastUsage.output_tokens || 0} out</p>}

            {/* Templates row */}
            <div className="pt-3 border-t flex items-center gap-2 flex-wrap">
              <span className="text-xs text-slate-500 uppercase">Templates :</span>
              {templates.length > 0 ? (
                <Select onValueChange={loadTemplate}>
                  <SelectTrigger className="h-8 w-[220px] text-xs"><SelectValue placeholder="📩 Charger un template…" /></SelectTrigger>
                  <SelectContent>{templates.map(t => <SelectItem key={t.id} value={t.id}><span className="truncate">{t.name}</span></SelectItem>)}</SelectContent>
                </Select>
              ) : <span className="text-[11px] text-slate-400">Aucun template enregistré</span>}
              <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={saveTemplate} disabled={!subject || !body}><FileText className="w-3 h-3" /> Sauver template</Button>
              {templates.length > 0 && (
                <Select onValueChange={(v) => { const tpl = templates.find(t => t.id === v); if (tpl) deleteTemplate(tpl.id, tpl.name); }}>
                  <SelectTrigger className="h-8 w-[120px] text-xs"><SelectValue placeholder="🗑️ Supprimer…" /></SelectTrigger>
                  <SelectContent>{templates.map(t => <SelectItem key={t.id} value={t.id}><span className="text-rose-600 truncate">Supp : {t.name}</span></SelectItem>)}</SelectContent>
                </Select>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Mail className="w-4 h-4 text-blue-600" /> Aperçu & édition</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs uppercase text-slate-500">Objet</Label>
              <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="L'objet apparaîtra ici après génération…" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs uppercase text-slate-500">Corps HTML</Label>
              <Textarea rows={12} value={body} onChange={e => setBody(e.target.value)} placeholder="Le corps HTML apparaîtra ici après génération…" className="mt-1 font-mono text-xs" />
            </div>
            {body && (
              <div>
                <Label className="text-xs uppercase text-slate-500">Aperçu rendu</Label>
                <div className="mt-1 rounded-md border bg-white p-4 text-sm max-h-[300px] overflow-y-auto" dangerouslySetInnerHTML={{ __html: body }} />
              </div>
            )}
            <Button
              className={`w-full gap-2 ${mailStatus.test_mode_active ? 'bg-amber-600 hover:bg-amber-700' : ''}`}
              onClick={send}
              disabled={sending || !subject || !body}
            >
              <Send className="w-4 h-4" />
              {sending
                ? 'Envoi…'
                : mailStatus.test_mode_active
                  ? `🛡️ Tester l'envoi à ${targetRegs.length} dest. (intercepté → ${mailStatus.redirect_to})`
                  : `Envoyer à ${targetRegs.length} destinataire(s)`}
              {!smtp.ok && <Badge variant="secondary" className="ml-1">MOCK</Badge>}
            </Button>
            {mailStatus.test_mode_active && (
              <p className="text-xs text-amber-700 -mt-1 flex items-center gap-1.5">
                <span>🔒</span>
                <span>Mode test actif — l&apos;email partira uniquement vers <b>{mailStatus.redirect_to}</b>, jamais vers les vrais contacts.</span>
              </p>
            )}

            {/* Schedule for later */}
            <div className="pt-3 border-t">
              <Label className="text-xs uppercase text-slate-500 flex items-center gap-2"><Calendar className="w-3.5 h-3.5" /> Ou programmer pour plus tard</Label>
              <div className="flex gap-2 mt-1">
                <Input type="datetime-local" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)} className="text-xs" />
                <Button onClick={scheduleSend} disabled={!subject || !body || !scheduledDate || !targetRegs.length} variant="outline" className="gap-1 shrink-0">
                  <Calendar className="w-3.5 h-3.5" /> Programmer
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Scheduled mailings list */}
        {scheduled.length > 0 && (
          <Card className="border-amber-200 bg-amber-50/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2"><Calendar className="w-4 h-4 text-amber-600" /> Mails programmés ({scheduled.length})</span>
                <Button size="sm" variant="outline" onClick={processNow} className="h-7 text-xs gap-1"><Zap className="w-3 h-3" /> Traiter dûs maintenant</Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {scheduled.map(s => {
                const due = new Date(s.scheduled_at) <= new Date();
                const cancelScheduled = async () => {
                  if (!confirm(`Annuler le mail programmé « ${s.name} » pour le ${new Date(s.scheduled_at).toLocaleString('fr-FR')} ?\n\n${s.recipients_count} destinataire(s) ne recevront PAS ce mail.`)) return;
                  try {
                    await api(`/api/mailing/scheduled/${s.id}`, { method: 'DELETE' });
                    toast.success('Mail programmé annulé');
                    loadScheduled();
                  } catch (e) { toast.error('Erreur : ' + e.message); }
                };
                return (
                  <div key={s.id} className={`border rounded-md p-3 text-xs ${due ? 'bg-rose-50 border-rose-200' : 'bg-white border-amber-100'}`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium truncate flex-1">{s.name}</div>
                      <Badge variant={due ? 'destructive' : 'secondary'}>{due ? 'À traiter' : 'Programmé'}</Badge>
                      <button onClick={cancelScheduled} className="text-rose-600 hover:text-rose-800 hover:bg-rose-100 rounded p-1 -m-1" title="Annuler ce mail programmé">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="text-slate-500 mt-0.5">📅 {new Date(s.scheduled_at).toLocaleString('fr-FR')} · 👥 {s.recipients_count} destinataire(s)</div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Colonne 2 : destinataires + historique */}
      <div className="space-y-4">
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Users className="w-4 h-4 text-blue-600" /> Destinataires</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs uppercase text-slate-500">Statut dossier</Label>
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les exposants</SelectItem>
                  <SelectItem value="a_relancer">À relancer</SelectItem>
                  <SelectItem value="a_confirmer">À confirmer</SelectItem>
                  <SelectItem value="confirme">Confirmés uniquement</SelectItem>
                  <SelectItem value="no_caution">Sans caution reçue</SelectItem>
                  <SelectItem value="no_insurance">Sans assurance</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs uppercase text-slate-500">Site</Label>
              <Select value={siteFilter} onValueChange={setSiteFilter}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les sites</SelectItem>
                  {venues.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs uppercase text-slate-500">Année / Fidélité</Label>
              <Select value={yearFilter} onValueChange={setYearFilter}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes années</SelectItem>
                  <SelectItem value="2025">📅 Présent en 2025</SelectItem>
                  <SelectItem value="2024">📅 Présent en 2024</SelectItem>
                  <SelectItem value="2023">📅 Présent en 2023</SelectItem>
                  <SelectItem value="2020">📅 Présent en 2020</SelectItem>
                  <SelectItem value="2019">📅 Présent en 2019</SelectItem>
                  <SelectItem value="fidele">⭐ Fidèles (toutes éditions)</SelectItem>
                  <SelectItem value="regulier">🔁 Réguliers</SelectItem>
                  <SelectItem value="ponctuel">📌 Ponctuels</SelectItem>
                  <SelectItem value="jamais">🆕 Jamais participé / nouveaux</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs uppercase text-slate-500">Recherche (nom, email, stand)</Label>
              <div className="relative mt-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <Input value={recipientSearch} onChange={e => setRecipientSearch(e.target.value)} placeholder="ex: teva, swimua, A-C04…" className="pl-8 h-9" />
              </div>
            </div>

            <div className="pt-2 border-t flex items-end justify-between gap-2">
              <div>
                <div className="text-2xl font-bold text-blue-600">{targetRegs.length}<span className="text-sm font-normal text-slate-400"> / {filteredRegs.length}</span></div>
                <p className="text-xs text-slate-500">cochés / visibles</p>
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={selectAll} disabled={filteredRegs.length === 0}>Tout cocher</Button>
                <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={selectNone} disabled={selectedIds.size === 0}>Tout décocher</Button>
              </div>
            </div>

            {/* Saved recipient lists */}
            <div className="pt-2 border-t space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs uppercase text-slate-500">Listes sauvegardées</span>
                <Button size="sm" variant="outline" className="h-7 gap-1 text-[10px]" onClick={saveRecipientList} disabled={selectedIds.size === 0}><Plus className="w-3 h-3" /> Sauver</Button>
              </div>
              {recipientLists.length === 0 ? (
                <p className="text-[11px] text-slate-400">Aucune liste enregistrée. Cochez des destinataires puis cliquez sur Sauver.</p>
              ) : (
                <div className="space-y-1">
                  {recipientLists.map(lst => (
                    <div key={lst.id} className="flex items-center gap-1 text-xs border rounded-md px-2 py-1 bg-slate-50/50">
                      <button type="button" onClick={() => loadRecipientList(lst.id)} className="flex-1 text-left hover:text-blue-600 transition truncate" title="Charger cette liste">
                        📋 {lst.name} <span className="text-slate-400">({lst.count})</span>
                      </button>
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0 shrink-0" onClick={() => deleteRecipientList(lst.id, lst.name)} title="Supprimer"><Trash2 className="w-3 h-3 text-rose-500" /></Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="max-h-[360px] overflow-y-auto text-xs space-y-1 pt-2 border-t">
              {filteredRegs.length === 0 && <p className="text-slate-400 text-center py-3">Aucun exposant trouvé</p>}
              {filteredRegs.slice(0, 100).map(r => {
                const checked = selectedIds.has(r.id);
                const h = r.organization?.participation_history;
                return (
                  <div key={r.id} className={`flex items-center gap-2 py-1.5 px-2 rounded border ${checked ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-100 hover:bg-slate-50'}`}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleOne(r.id)}
                      className="w-4 h-4 cursor-pointer accent-blue-600 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <AiInsightTrigger registration={r} size="xs" />
                        <span className="font-medium truncate">{r.organization?.name}</span>
                        {r.stand_code && <span className="text-[10px] font-mono text-slate-400 shrink-0">{r.stand_code}</span>}
                        {h?.fidelity?.includes('Fidèle') && <span className="text-[9px] px-1 rounded bg-amber-100 text-amber-700 border border-amber-200 shrink-0" title={`${h.nb_editions} éditions`}>⭐</span>}
                        {h?.fidelity === 'Régulier' && <span className="text-[9px] px-1 rounded bg-blue-100 text-blue-700 border border-blue-200 shrink-0" title={`${h.nb_editions} éditions`}>🔁</span>}
                        {h?.fidelity === 'Ponctuel' && <span className="text-[9px] px-1 rounded bg-slate-100 text-slate-600 border border-slate-200 shrink-0" title={`${h.nb_editions} éditions`}>📌</span>}
                        {!h && <span className="text-[9px] px-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">🆕</span>}
                      </div>
                      <div className="text-[10px] text-slate-500 truncate">
                        {r.organization?.main_email}
                        {h && <span className="text-slate-400"> · {[h.y2025 && '25', h.y2024 && '24', h.y2023 && '23', h.y2020 && '20', h.y2019 && '19'].filter(Boolean).join('/')}</span>}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-1.5 text-[10px] shrink-0"
                      onClick={() => selectOnly(r.id)}
                      title="Sélectionner uniquement celui-ci"
                    >
                      Lui seul
                    </Button>
                  </div>
                );
              })}
              {filteredRegs.length > 100 && <div className="text-slate-400 text-center pt-1">+ {filteredRegs.length - 100} autre(s)… affinez avec la recherche</div>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Clock className="w-4 h-4 text-slate-500" /> Historique</CardTitle></CardHeader>
          <CardContent className="space-y-2 max-h-[400px] overflow-y-auto">
            {emails.length === 0 ? <p className="text-slate-500 text-sm">Aucun email envoyé.</p> : emails.slice(0, 30).map(e => (
              <div key={e.id} className="border rounded-md p-2.5 text-xs">
                <div className="flex items-center justify-between gap-2"><div className="font-medium truncate">{e.subject}</div><Badge variant="secondary" className="shrink-0">{e.send_status}</Badge></div>
                <div className="text-slate-500 mt-1"><Mail className="w-3 h-3 inline mr-1" /> {e.to_email}</div>
                <div className="text-slate-400 mt-0.5">{e.sent_at && new Date(e.sent_at).toLocaleString('fr-FR')}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
      </div>
    </div>
  );
}

function AnomaliesView() {
  const [rows, setRows] = useState([]);
  const load = () => api('/api/anomalies').then(setRows);
  useEffect(() => { load(); }, []);
  const resolve = async (id) => {
    await api(`/api/anomalies/${id}`, { method: 'PUT', body: JSON.stringify({ resolved_status: 'resolu', resolution_comment: 'Résolue à l’administration' }) });
    toast.success('Anomalie résolue'); load();
  };
  return (
    <Card><CardContent className="p-0">
      {rows.length === 0 ? <div className="py-12 text-center text-slate-500">Aucune anomalie détectée. 👍</div> : (
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b text-left text-xs uppercase text-slate-500"><tr><th className="py-2 px-4">Exposant</th><th>Site</th><th>Type</th><th>Gravité</th><th>Statut</th><th>Date</th><th></th></tr></thead>
          <tbody className="divide-y">
            {rows.map(a => (
              <tr key={a.id}>
                <td className="py-2 px-4 font-medium"><div className="flex items-center gap-1.5">{a.registration_id && <AiInsightTrigger registration={{ id: a.registration_id }} size="xs" />}{a.organization_name}</div></td>
                <td>{a.venue_name}</td>
                <td className="text-xs">{a.anomaly_type}</td>
                <td><Badge variant={a.severity_level === 'critique' || a.severity_level === 'haute' ? 'destructive' : 'secondary'}>{a.severity_level}</Badge></td>
                <td>{a.resolved_status}</td>
                <td className="text-xs text-slate-500">{new Date(a.detected_at).toLocaleString('fr-FR')}</td>
                <td className="pr-4">{a.resolved_status !== 'resolu' && <Button size="sm" variant="ghost" onClick={() => resolve(a.id)}>Marquer résolu</Button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </CardContent></Card>
  );
}

function BilansView() {
  const [reports, setReports] = useState([]);
  const [venues, setVenues] = useState([]);
  const [venueId, setVenueId] = useState('');
  const [eventDate, setEventDate] = useState('2026-08-14');
  const load = () => api('/api/reports').then(setReports);
  useEffect(() => { load(); api('/api/venues').then(setVenues); }, []);
  const genSite = async () => {
    if (!venueId) return toast.error('Choisir un site');
    await api('/api/reports/generate', { method: 'POST', body: JSON.stringify({ scope: 'bilan_site', venue_id: venueId, event_date: eventDate }) });
    toast.success('Bilan site généré'); load();
  };
  const genGlobal = async () => {
    await api('/api/reports/generate', { method: 'POST', body: JSON.stringify({ scope: 'bilan_global' }) });
    toast.success('Bilan global généré'); load();
  };
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Générateur de bilans automatique</CardTitle></CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-4">
          <div className="border rounded-md p-4">
            <div className="font-medium mb-2">Bilan par site</div>
            <div className="flex gap-2 mb-2">
              <Select value={venueId} onValueChange={setVenueId}><SelectTrigger><SelectValue placeholder="Choisir un site" /></SelectTrigger><SelectContent>{venues.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent></Select>
              <Select value={eventDate} onValueChange={setEventDate}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="2026-08-14">Ven 14/08</SelectItem><SelectItem value="2026-08-15">Sam 15/08</SelectItem></SelectContent></Select>
            </div>
            <Button className="gap-2" onClick={genSite}><Sparkles className="w-4 h-4" /> Générer bilan site</Button>
          </div>
          <div className="border rounded-md p-4">
            <div className="font-medium mb-2">Bilan global consolidé</div>
            <p className="text-xs text-slate-500 mb-3">Agrège tous les sites et toutes les dates.</p>
            <Button className="gap-2" onClick={genGlobal}><Sparkles className="w-4 h-4" /> Générer bilan global</Button>
          </div>
        </CardContent>
      </Card>
      <Card><CardContent className="p-0">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b text-left text-xs uppercase text-slate-500"><tr><th className="py-2 px-4">Type</th><th>Portée</th><th>Statut</th><th>Généré le</th><th>Partage Pacific</th><th></th></tr></thead>
          <tbody className="divide-y">
            {reports.map(r => (
              <tr key={r.id}>
                <td className="py-2 px-4 font-medium">{r.report_type}</td>
                <td className="text-xs text-slate-600">{r.report_data_json?.site || r.report_data_json?.exposant || 'Global'}</td>
                <td><Badge variant={r.report_status === 'valide' ? 'default' : 'secondary'} className={r.report_status === 'valide' ? 'bg-emerald-600' : ''}>{r.report_status}</Badge></td>
                <td className="text-xs text-slate-500">{new Date(r.generated_at).toLocaleString('fr-FR')}</td>
                <td>
                  <Button
                    size="sm"
                    variant={r.shared_with_pacific ? 'default' : 'outline'}
                    className={r.shared_with_pacific ? 'bg-cyan-600 hover:bg-cyan-700 gap-1' : 'gap-1 border-cyan-300 text-cyan-700 hover:bg-cyan-50'}
                    onClick={async () => {
                      const newVal = !r.shared_with_pacific;
                      try {
                        await api(`/api/reports/${r.id}`, { method: 'PUT', body: JSON.stringify({ shared_with_pacific: newVal }) });
                        toast.success(newVal ? '✅ Bilan partagé avec Pacific Centers' : '🔒 Bilan retiré du partage Pacific');
                        load();
                      } catch (e) { toast.error(e.message); }
                    }}
                  >
                    {r.shared_with_pacific ? <><Eye className="w-3 h-3" /> Partagé</> : <><Eye className="w-3 h-3" /> Partager</>}
                  </Button>
                </td>
                <td className="pr-4"><Button size="sm" variant="outline" onClick={() => openReport(r)}><FileText className="w-3 h-3 mr-1" /> Voir / PDF</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent></Card>
    </div>
  );
}

function openReport(r) {
  const w = window.open('', '_blank');
  if (!w) return;
  const data = r.report_data_json || {};
  const type = r.report_type;
  const generatedAt = new Date(r.generated_at).toLocaleString('fr-FR');

  // Helpers for PDF-ready HTML
  const num = (n) => (typeof n === 'number' ? n.toLocaleString('fr-FR') : (n ?? '—'));
  const pct = (n) => (n == null ? '—' : n + '%');
  const rating = (n) => {
    if (n == null) return '—';
    const stars = '★'.repeat(Math.round(n)) + '☆'.repeat(5 - Math.round(n));
    return `<span style="color:#f59e0b">${stars}</span> <span style="color:#64748b">${n}/5</span>`;
  };
  const kpi = (label, val, hint) => `<div class="kpi"><div class="kpi-label">${label}</div><div class="kpi-value">${val}</div>${hint ? `<div class="kpi-hint">${hint}</div>` : ''}</div>`;
  const section = (title, body) => `<section><h3>${title}</h3>${body}</section>`;
  const table = (headers, rows) => `<table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${c}}</td>`).join('')}</tr>`).join('')}</tbody></table>`.replace(/\}\}/g,'}');

  let titleLabel = 'Bilan', subtitle = '', kpis = '', body = '';

  if (type === 'bilan_global') {
    titleLabel = 'Bilan Global — Forum de la Rentrée 2026';
    subtitle = data.dates || '14 & 15 août 2026';
    kpis = [
      kpi('Sites', num(data.venues_count), 'sites actifs'),
      kpi('Exposants', num(data.total_exposants), `${num(data.total_confirmed)} confirmés`),
      kpi('Taux présence', data.total_sessions ? Math.round((data.total_present/data.total_sessions)*100)+'%' : '—', `${num(data.total_present)}/${num(data.total_sessions)}`),
      kpi('Cautions', (data.cautions?.xpf_encaisse || 0).toLocaleString('fr-FR')+' XPF', `${num(data.cautions?.recues)}/${num(data.cautions?.attendues)}`),
      kpi('Anomalies', num(data.total_anomalies), 'signalées'),
      kpi('NPS Satisfaction', data.satisfaction?.nps ?? '—', `${num(data.satisfaction?.total_responses)} réponses`),
    ].join('');
    const byStatus = Object.entries(data.by_status || {}).map(([k,v])=>`<tr><td>${k}</td><td style="text-align:right"><b>${v}</b></td></tr>`).join('');
    const bySiteRows = (data.by_site || []).map(s => `<tr><td>${s.site}</td><td style="text-align:center">${s.exposants}</td><td style="text-align:center">${s.confirmes}</td><td style="text-align:center">${s.anomalies}</td><td style="text-align:center">${s.satisfaction_responses || 0}</td><td style="text-align:center">${s.satisfaction_avg ? s.satisfaction_avg.toFixed(1)+'★' : '—'}</td></tr>`).join('');
    const anoSev = Object.entries(data.anomalies_by_severity || {}).map(([k,v])=>`<tr><td>${k}</td><td style="text-align:right"><b>${v}</b></td></tr>`).join('');
    const sat = data.satisfaction || {};
    const satBody = sat.total_responses > 0 ? `
      <div class="grid2">
        <div><b>Répartition participation prochaine édition</b>
          <ul>
            <li>✅ Oui : ${sat.will_participate_yes || 0}</li>
            <li>🤔 Peut-être : ${sat.will_participate_maybe || 0}</li>
            <li>❌ Non : ${sat.will_participate_no || 0}</li>
          </ul>
        </div>
        <div><b>Notes moyennes</b>
          <ul>
            <li>Note globale : ${rating(sat.avg_overall)}</li>
            <li>Organisation : ${rating(sat.avg_organization)}</li>
            <li>Stand : ${rating(sat.avg_stand)}</li>
            <li>Visiteurs : ${rating(sat.avg_visitors)}</li>
            <li>Communication : ${rating(sat.avg_communication)}</li>
          </ul>
        </div>
      </div>
      ${sat.top_positives?.length ? `<div style="margin-top:12px"><b>Points positifs remontés</b><ul>${sat.top_positives.map(p=>`<li>« ${p} »</li>`).join('')}</ul></div>` : ''}
      ${sat.top_improvements?.length ? `<div style="margin-top:12px"><b>Points d'amélioration</b><ul>${sat.top_improvements.map(p=>`<li>« ${p} »</li>`).join('')}</ul></div>` : ''}
    ` : '<p style="color:#94a3b8;font-style:italic">Aucun retour exposant reçu.</p>';
    body = `
      ${section('Vue par site', `<table><thead><tr><th>Site</th><th>Exposants</th><th>Confirmés</th><th>Anomalies</th><th>Sat.</th><th>Note moy.</th></tr></thead><tbody>${bySiteRows}</tbody></table>`)}
      ${section('Statuts des dossiers', `<table><tbody>${byStatus}</tbody></table>`)}
      ${section('Situation cautions', `
        <div class="grid3">
          ${kpi('Reçues', num(data.cautions?.recues), `/${num(data.cautions?.attendues)}`)}
          ${kpi('XPF encaissés', (data.cautions?.xpf_encaisse||0).toLocaleString('fr-FR'), 'sur '+(data.cautions?.xpf_attendu||0).toLocaleString('fr-FR'))}
          ${kpi('Taux récupération', pct(data.cautions?.taux_recuperation), '')}
        </div>
      `)}
      ${section('Documents', `
        <div class="grid3">
          ${kpi('Validés', num(data.documents?.valides), `/${num(data.documents?.total)}`)}
          ${kpi('En attente', num(data.documents?.en_attente), '')}
          ${kpi('Refusés', num(data.documents?.refuses), '')}
        </div>
      `)}
      ${anoSev ? section('Anomalies par gravité', `<table><tbody>${anoSev}</tbody></table>`) : ''}
      ${section('Satisfaction exposants', satBody)}
    `;
  } else if (type === 'bilan_site') {
    titleLabel = `Bilan Site — ${data.site || ''}`;
    subtitle = `Journée : ${data.event_date || 'Tout l\'évènement'}`;
    kpis = [
      kpi('Exposants', num(data.exposants_total), `${num(data.exposants_confirmes)} confirmés`),
      kpi('Taux présence', pct(data.taux_presence), `${num(data.present)}/${num(data.expected)}`),
      kpi('Absences', num(data.absent), 'non excusées incluses'),
      kpi('Cautions', num(data.cautions_recues), `${(data.cautions_xpf_encaisse||0).toLocaleString('fr-FR')} XPF`),
      kpi('Anomalies', num(data.anomalies_count), 'signalées'),
      kpi('Satisfaction', data.satisfaction?.avg_overall ? data.satisfaction.avg_overall.toFixed(1)+' ★' : '—', `${num(data.satisfaction?.total_responses)} réponses`),
    ].join('');
    const exposantsRows = (data.exposants || []).map(e => `<tr><td>${e.name || '—'}</td><td>${e.discipline || ''}</td><td style="font-family:monospace">${e.stand || ''}</td><td><span class="badge badge-${e.status}">${e.status}</span></td></tr>`).join('');
    const incidentsRows = (data.incidents_majeurs || []).map(i => `<tr><td>${i.exposant || '—'}</td><td>${i.type}</td><td>${i.title}</td></tr>`).join('');
    const sat = data.satisfaction || {};
    body = `
      ${section('Liste des exposants', `<table><thead><tr><th>Exposant</th><th>Discipline</th><th>Stand</th><th>Statut</th></tr></thead><tbody>${exposantsRows}</tbody></table>`)}
      ${incidentsRows ? section('Incidents majeurs', `<table><thead><tr><th>Exposant</th><th>Type</th><th>Titre</th></tr></thead><tbody>${incidentsRows}</tbody></table>`) : ''}
      ${section('Présence terrain', `
        <div class="grid4">
          ${kpi('Présents', num(data.present))}
          ${kpi('Retardataires', num(data.late))}
          ${kpi('Absents', num(data.absent))}
          ${kpi('Départs anticipés', num(data.early_leave))}
        </div>
      `)}
      ${sat.total_responses ? section('Satisfaction exposants', `
        <div class="grid3">
          ${kpi('Taux réponse', pct(sat.response_rate), `${sat.total_responses} sur ${data.exposants_total}`)}
          ${kpi('Note globale', rating(sat.avg_overall))}
          ${kpi('NPS', sat.nps ?? '—')}
        </div>
        <div class="grid2" style="margin-top:8px">
          ${kpi('Organisation', rating(sat.avg_organization))}
          ${kpi('Stand', rating(sat.avg_stand))}
          ${kpi('Visiteurs', rating(sat.avg_visitors))}
          ${kpi('Communication', rating(sat.avg_communication))}
        </div>
      `) : ''}
    `;
  } else if (type === 'bilan_exposant') {
    titleLabel = `Bilan Exposant — ${data.exposant || ''}`;
    subtitle = `${data.discipline || ''} • ${data.site || ''} • Stand ${data.stand || ''}`;
    kpis = [
      kpi('Statut dossier', data.status || '—', `${data.completion_percent || 0}% complété`),
      kpi('Documents', `${num(data.documents?.validated)}/${num(data.documents?.uploaded)}`, 'validés'),
      kpi('Caution', data.caution?.status || '—', `${num(data.caution?.amount_xpf)} XPF`),
      kpi('Anomalies', num(data.anomalies_count), data.recommended_deposit_action),
    ].join('');
    const sessionsRows = (data.sessions || []).map(s => `<tr><td>${s.date || '—'}</td><td>${s.expected_arrival || '—'}</td><td>${s.actual_arrival || '—'}</td><td><b>${s.presence || '—'}</b></td><td>${s.animation_completed ? '✅' : '—'}</td></tr>`).join('');
    const anoRows = (data.anomalies || []).map(a => `<tr><td>${a.type}</td><td><span class="badge badge-${a.severity}">${a.severity}</span></td><td>${a.title || ''}</td><td>${a.description || ''}</td></tr>`).join('');
    const sat = data.satisfaction;
    body = `
      ${section('Contact', `<table><tbody>
        <tr><th>Nom du contact</th><td>${data.contact_name || '—'}</td></tr>
        <tr><th>Email</th><td>${data.contact_email || '—'}</td></tr>
        <tr><th>Téléphone</th><td>${data.contact_phone || '—'}</td></tr>
      </tbody></table>`)}
      ${sessionsRows ? section('Présence terrain', `<table><thead><tr><th>Date</th><th>Prévu</th><th>Réel</th><th>Statut</th><th>Animation</th></tr></thead><tbody>${sessionsRows}</tbody></table>`) : ''}
      ${anoRows ? section('Anomalies rencontrées', `<table><thead><tr><th>Type</th><th>Gravité</th><th>Titre</th><th>Détail</th></tr></thead><tbody>${anoRows}</tbody></table>`) : ''}
      ${sat ? section('Satisfaction — retour exposant', `
        <div class="grid3">
          ${kpi('Note globale', rating(sat.overall_rating))}
          ${kpi('NPS', sat.nps_score ?? '—')}
          ${kpi('Participation prochaine', sat.will_participate_next === 'oui' ? '✅ Oui' : sat.will_participate_next === 'peut_etre' ? '🤔 Peut-être' : sat.will_participate_next === 'non' ? '❌ Non' : '—')}
        </div>
        <div class="grid4" style="margin-top:8px">
          ${kpi('Organisation', rating(sat.organization_rating))}
          ${kpi('Stand', rating(sat.stand_rating))}
          ${kpi('Visiteurs', rating(sat.visitors_rating))}
          ${kpi('Communication', rating(sat.communication_rating))}
        </div>
        ${sat.positive_points ? `<p style="margin-top:12px"><b>Points positifs :</b> ${sat.positive_points}</p>` : ''}
        ${sat.improvement_points ? `<p><b>Points à améliorer :</b> ${sat.improvement_points}</p>` : ''}
        ${sat.free_comment ? `<p><b>Commentaire :</b> ${sat.free_comment}</p>` : ''}
      `) : '<section><h3>Satisfaction</h3><p style="color:#94a3b8;font-style:italic">Pas encore de retour de l\'exposant.</p></section>'}
      ${section('Recommandation caution', `
        <div style="padding:16px;background:${data.recommended_deposit_action === 'restitution' ? '#d1fae5' : data.recommended_deposit_action === 'retenue_totale' ? '#fee2e2' : '#fef3c7'};border-radius:8px;border-left:4px solid ${data.recommended_deposit_action === 'restitution' ? '#10b981' : data.recommended_deposit_action === 'retenue_totale' ? '#ef4444' : '#f59e0b'};">
          <b>Action recommandée : </b>${data.recommended_deposit_action}
        </div>
      `)}
    `;
  } else {
    body = `<pre>${JSON.stringify(data, null, 2)}</pre>`;
  }

  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${titleLabel}</title><style>
    @page { margin: 20mm; }
    *{box-sizing:border-box}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:40px;max-width:900px;margin:auto;color:#0f172a;background:#fff;line-height:1.5}
    .header{border-bottom:3px solid #2563eb;padding-bottom:16px;margin-bottom:24px;display:flex;justify-content:space-between;align-items:start}
    .header-left h1{font-size:24px;margin:0 0 4px;color:#0f172a;font-weight:700}
    .header-left .subtitle{color:#64748b;font-size:14px}
    .header-right{text-align:right;font-size:12px;color:#64748b}
    .header-right .logo{background:#2563eb;color:#fff;font-weight:700;padding:6px 12px;border-radius:6px;display:inline-block;margin-bottom:8px;font-size:13px;letter-spacing:.05em}
    .kpis{display:grid;grid-template-columns:repeat(6,1fr);gap:10px;margin-bottom:24px}
    .kpis.grid3{grid-template-columns:repeat(3,1fr)}.kpis.grid4{grid-template-columns:repeat(4,1fr)}
    .kpi{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px}
    .kpi-label{font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:#64748b;font-weight:600}
    .kpi-value{font-size:18px;font-weight:700;color:#0f172a;margin-top:4px;word-break:break-word}
    .kpi-hint{font-size:11px;color:#94a3b8;margin-top:2px}
    .grid2{display:grid;grid-template-columns:1fr 1fr;gap:16px}.grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.grid4{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
    section{margin-bottom:24px;page-break-inside:avoid}
    section h3{font-size:14px;text-transform:uppercase;letter-spacing:.1em;color:#475569;margin:0 0 10px;padding-bottom:6px;border-bottom:2px solid #e2e8f0;font-weight:700}
    table{border-collapse:collapse;width:100%;font-size:12px}
    th,td{text-align:left;padding:8px 10px;border-bottom:1px solid #e2e8f0;vertical-align:top}
    th{background:#f1f5f9;font-weight:600;color:#475569;font-size:11px;text-transform:uppercase;letter-spacing:.05em}
    .badge{display:inline-block;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.05em}
    .badge-confirme{background:#d1fae5;color:#065f46}.badge-a_confirmer{background:#fef3c7;color:#92400e}.badge-a_relancer{background:#fed7aa;color:#9a3412}.badge-prospect{background:#e2e8f0;color:#475569}.badge-haute,.badge-critique{background:#fee2e2;color:#991b1b}.badge-moyenne{background:#fef3c7;color:#92400e}.badge-basse{background:#e0e7ff;color:#3730a3}
    ul{margin:4px 0;padding-left:20px}li{margin:2px 0}
    .footer{margin-top:40px;padding-top:16px;border-top:1px solid #e2e8f0;color:#94a3b8;font-size:10px;text-align:center}
    pre{background:#f1f5f9;padding:12px;border-radius:6px;overflow:auto;font-size:11px}
    .print-btn{position:fixed;top:20px;right:20px;padding:10px 20px;border-radius:6px;background:#2563eb;color:#fff;border:0;cursor:pointer;font-weight:600;box-shadow:0 4px 10px rgba(37,99,235,.3)}
    @media print{.print-btn{display:none}body{padding:0}}
  </style></head><body>
    <button class="print-btn" onclick="window.print()">🖨️ Imprimer / PDF</button>
    <div class="header">
      <div class="header-left">
        <h1>${titleLabel}</h1>
        <div class="subtitle">${subtitle}</div>
      </div>
      <div class="header-right">
        <div class="logo">ARACOM</div>
        <div>Généré le ${generatedAt}</div>
        <div>Statut : <b>${r.report_status}</b></div>
      </div>
    </div>
    <div class="kpis ${type === 'bilan_exposant' ? 'grid4' : ''}">${kpis}</div>
    ${body}
    <div class="footer">Forum de la Rentrée 2026 — Document confidentiel généré automatiquement par la plateforme ARACOM.</div>
  </body></html>`;

  w.document.write(html);
  w.document.close();
}

function RelancesView() {
  const [rows, setRows] = useState([]);
  const [regs, setRegs] = useState([]);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ registration_id: '', task_type: 'appel', title: '', due_date: '', notes: '' });
  const load = () => api('/api/tasks').then(setRows);
  useEffect(() => { load(); api('/api/registrations').then(setRegs); }, []);
  const create = async () => {
    if (!form.registration_id || !form.title) return toast.error('Exposant et titre requis');
    await api('/api/tasks', { method: 'POST', body: JSON.stringify(form) });
    toast.success('Tâche créée'); setShowNew(false); setForm({ registration_id: '', task_type: 'appel', title: '', due_date: '', notes: '' }); load();
  };
  const toggleDone = async (t) => {
    await api(`/api/tasks/${t.id}`, { method: 'PUT', body: JSON.stringify({ status: t.status === 'termine' ? 'a_faire' : 'termine' }) });
    load();
  };
  const del = async (id) => {
    if (!confirm('Supprimer cette tâche ?')) return;
    await api(`/api/tasks/${id}`, { method: 'DELETE' });
    toast.success('Supprimée'); load();
  };
  const open = rows.filter(t => t.status !== 'termine' && t.status !== 'annule');
  const done = rows.filter(t => t.status === 'termine');
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="grid grid-cols-3 gap-3 flex-1">
          <KpiCard label="À faire" value={open.length} accent="orange" />
          <KpiCard label="Terminées" value={done.length} accent="emerald" />
          <KpiCard label="Total" value={rows.length} accent="blue" />
        </div>
        <Button className="ml-4 gap-2 bg-blue-600 hover:bg-blue-700" onClick={() => setShowNew(!showNew)}>+ Nouvelle tâche</Button>
      </div>
      {showNew && (
        <Card><CardContent className="p-4 grid md:grid-cols-5 gap-2">
          <Select value={form.registration_id} onValueChange={v => setForm({ ...form, registration_id: v })}>
            <SelectTrigger className="md:col-span-2"><SelectValue placeholder="Exposant" /></SelectTrigger>
            <SelectContent className="max-h-[300px]">{regs.map(r => <SelectItem key={r.id} value={r.id}>{r.organization?.name} — {r.stand_code}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={form.task_type} onValueChange={v => setForm({ ...form, task_type: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{['appel','mail','document','caution','validation','autre'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
          <Input placeholder="Titre" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
          <Input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} />
          <div className="md:col-span-4"><Textarea rows={2} placeholder="Notes…" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
          <Button onClick={create} className="bg-emerald-600 hover:bg-emerald-700">Créer</Button>
        </CardContent></Card>
      )}
      <Card><CardContent className="p-0">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b text-left text-xs uppercase text-slate-500"><tr><th className="py-2 px-4 w-8"></th><th>Titre</th><th>Exposant</th><th>Type</th><th>Échéance</th><th></th></tr></thead>
          <tbody className="divide-y">
            {rows.length === 0 ? <tr><td colSpan="6" className="py-10 text-center text-slate-400">Aucune tâche. Créez-en une pour commencer.</td></tr> : rows.map(t => (
              <tr key={t.id} className={t.status === 'termine' ? 'opacity-60' : ''}>
                <td className="px-4"><input type="checkbox" checked={t.status === 'termine'} onChange={() => toggleDone(t)} /></td>
                <td className={`py-2 font-medium ${t.status === 'termine' ? 'line-through text-slate-500' : ''}`}>{t.title}<div className="text-xs text-slate-500 font-normal">{t.notes}</div></td>
                <td className="text-slate-700"><div className="flex items-center gap-1.5">{t.registration_id && <AiInsightTrigger registration={{ id: t.registration_id }} size="xs" />}{t.organization_name} • <span className="font-mono text-xs">{t.stand_code}</span></div></td>
                <td><Badge variant="secondary">{t.task_type}</Badge></td>
                <td className="text-xs text-slate-500">{t.due_date || '—'}</td>
                <td className="pr-4 text-right"><Button size="sm" variant="ghost" onClick={() => del(t.id)}>Supprimer</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent></Card>
    </div>
  );
}

function openReport_DEPRECATED() {}

function DocsBlock({ registrationId, documents = [], onRefresh }) {
  const upload = async (type, payload) => {
    try {
      await api('/api/documents', { method: 'POST', body: JSON.stringify({ registration_id: registrationId, document_type: type, ...payload }) });
      toast.success('Document ajouté'); onRefresh();
    } catch (e) { toast.error(e.message); }
  };
  const del = async (id) => {
    if (!confirm('Supprimer ce document ?')) return;
    await api(`/api/documents/${id}`, { method: 'DELETE' }); toast.success('Supprimé'); onRefresh();
  };
  const validate = async (id, status) => {
    await api(`/api/documents/${id}`, { method: 'PUT', body: JSON.stringify({ status }) });
    toast.success(`Statut : ${status}`); onRefresh();
  };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {DOCUMENT_TYPES.map(t => (
          <FileUploadButton key={t} onUpload={(p) => upload(t, p)} label={`+ ${DOCUMENT_TYPE_LABEL[t]}`} />
        ))}
      </div>
      {documents.length === 0 ? <p className="text-slate-500 text-sm">Aucun document.</p> : (
        <div className="space-y-2">
          {documents.map(d => (
            <div key={d.id} className="border rounded-md p-3 flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="w-4 h-4 text-slate-500 shrink-0" />
                <div className="min-w-0">
                  <div className="font-medium text-sm truncate">{d.file_name}</div>
                  <div className="text-xs text-slate-500">{DOCUMENT_TYPE_LABEL[d.document_type]} • {(d.size_bytes / 1024).toFixed(0)} Ko</div>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Badge variant={d.status === 'valide' ? 'default' : 'secondary'} className={d.status === 'valide' ? 'bg-emerald-600' : d.status === 'refuse' ? 'bg-red-600' : ''}>{d.status}</Badge>
                <a href={`/api/documents/${d.id}/download`} target="_blank" rel="noreferrer"><Button size="sm" variant="ghost"><Download className="w-3 h-3" /></Button></a>
                {d.status !== 'valide' && <Button size="sm" variant="ghost" className="text-emerald-600" onClick={() => validate(d.id, 'valide')}><CheckCircle2 className="w-3 h-3" /></Button>}
                {d.status !== 'refuse' && <Button size="sm" variant="ghost" className="text-red-600" onClick={() => validate(d.id, 'refuse')}><XCircle className="w-3 h-3" /></Button>}
                <Button size="sm" variant="ghost" onClick={() => del(d.id)}><Trash2 className="w-3 h-3 text-red-600" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function NewExposantDialog({ venues, onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', discipline: 'Sport', email: '', phone: '', contact_name: '', priority_level: 'B', venue_id: '', animation_type: '', password: 'forum2026' });
  const [loading, setLoading] = useState(false);
  const create = async () => {
    if (!form.name) { toast.error('Nom requis'); return; }
    setLoading(true);
    try {
      await api('/api/organizations', { method: 'POST', body: JSON.stringify({ ...form, status: 'contacte', source: 'aracom_manual' }) });
      toast.success(`Exposant créé${form.email ? ' — mot de passe par défaut : ' + form.password : ''}`);
      onCreated();
    } catch (e) { toast.error(e.message); }
    setLoading(false);
  };
  return (
    <Sheet open={true} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Nouveau exposant</SheetTitle>
          <SheetDescription>Créez un dossier exposant manuellement. Si vous renseignez un email, un compte sera créé avec le mot de passe par défaut que l'exposant pourra changer.</SheetDescription>
        </SheetHeader>
        <div className="mt-4 space-y-3">
          <div><Label>Nom de la structure *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex : Tahitian Explorers" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Discipline</Label>
              <Select value={form.discipline} onValueChange={v => setForm({ ...form, discipline: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{DISCIPLINES.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent></Select>
            </div>
            <div><Label>Priorité</Label>
              <Select value={form.priority_level} onValueChange={v => setForm({ ...form, priority_level: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITY_LEVELS.map(p => {
                    const d = PRIORITY_DEFINITIONS[p];
                    return <SelectItem key={p} value={p} title={d?.description}>{d?.emoji} {d?.label || p}</SelectItem>;
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Contact principal</Label><Input value={form.contact_name} onChange={e => setForm({ ...form, contact_name: e.target.value })} /></div>
            <div><Label>Téléphone</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
          </div>
          <div><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="contact@structure.pf" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Site proposé</Label>
              <Select value={form.venue_id} onValueChange={v => setForm({ ...form, venue_id: v })}><SelectTrigger><SelectValue placeholder="—" /></SelectTrigger><SelectContent>{venues.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent></Select>
            </div>
            <div><Label>Animation prévue</Label><Input value={form.animation_type} onChange={e => setForm({ ...form, animation_type: e.target.value })} placeholder="Démo, atelier..." /></div>
          </div>
          {form.email && (
            <div><Label>Mot de passe par défaut (à communiquer à l'exposant)</Label><Input value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} /></div>
          )}
          <div className="flex gap-2 pt-3">
            <Button onClick={create} disabled={loading} className="bg-emerald-600 hover:bg-emerald-700 gap-2">{loading ? '...' : <><CheckCircle2 className="w-4 h-4" /> Créer</>}</Button>
            <Button variant="ghost" onClick={onClose}>Annuler</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// =====================================================================
// ACCESS TOKENS — ARACOM gestion des liens d'accès magiques
// =====================================================================
function AccessTokensView() {
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('actifs');
  const [showCreate, setShowCreate] = useState(null); // 'access' | 'inscription' | null

  const load = async () => {
    setLoading(true);
    try { setTokens(await api('/api/access-tokens')); }
    catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const revoke = async (t) => {
    if (!confirm(`Révoquer le lien de ${t.organization?.name || t.email} ?\nL'utilisateur ne pourra plus accéder à son espace.`)) return;
    try { await api(`/api/access-tokens/${t.id}/revoke`, { method: 'POST', body: '{}' }); toast.success('Lien révoqué'); load(); }
    catch (e) { toast.error(e.message); }
  };
  const resend = async (t) => {
    try { await api(`/api/access-tokens/${t.id}/resend`, { method: 'POST', body: '{}' }); toast.success('Email renvoyé à ' + t.email); }
    catch (e) { toast.error(e.message); }
  };
  const copyLink = async (t) => {
    try { await navigator.clipboard.writeText(t.access_url); toast.success('Lien copié dans le presse-papiers'); }
    catch { toast.info(t.access_url); }
  };

  const visibleTokens = tokens.filter(t => {
    if (filter === 'actifs') return !t.is_revoked && !t.is_expired;
    if (filter === 'revoques') return t.is_revoked;
    if (filter === 'inscriptions') return t.purpose === 'inscription_exposant';
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Liens actifs" value={tokens.filter(t => !t.is_revoked).length} accent="emerald" />
        <KpiCard label="Liens utilisés" value={tokens.filter(t => t.use_count > 0).length} accent="blue" />
        <KpiCard label="Inscriptions ouvertes" value={tokens.filter(t => t.purpose === 'inscription_exposant' && !t.is_revoked).length} accent="violet" />
        <KpiCard label="Liens révoqués" value={tokens.filter(t => t.is_revoked).length} accent="slate" />
      </div>

      <Card className="border-violet-200 bg-violet-50/30">
        <CardContent className="p-4 text-sm text-violet-900 flex items-start gap-3">
          <KeyRound className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="flex-1">
            <b>Comment ça marche :</b> Chaque exposant et chaque Pacific Centers reçoit par email un <i>lien personnel permanent</i> qui ouvre directement son espace, sans mot de passe. Vous pouvez aussi générer un <i>lien d&apos;inscription</i> pour démarcher un nouveau prospect (formulaire vierge).
          </div>
          <div className="flex gap-2 shrink-0 flex-wrap">
            <Button size="sm" onClick={() => setShowCreate('access')} className="bg-blue-600 hover:bg-blue-700 gap-1.5"><Send className="w-4 h-4" /> Lien d&apos;accès exposant</Button>
            <Button size="sm" onClick={() => setShowCreate('new_exposant')} className="bg-violet-600 hover:bg-violet-700 gap-1.5"><Plus className="w-4 h-4" /> Créer & inviter exposant</Button>
            <Button size="sm" onClick={() => setShowCreate('pacific')} className="bg-cyan-600 hover:bg-cyan-700 gap-1.5"><Eye className="w-4 h-4" /> Lien Pacific Centers</Button>
          </div>
        </CardContent>
      </Card>

      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList>
          <TabsTrigger value="actifs">Actifs</TabsTrigger>
          <TabsTrigger value="inscriptions">Inscriptions</TabsTrigger>
          <TabsTrigger value="revoques">Révoqués</TabsTrigger>
          <TabsTrigger value="tous">Tous</TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? <div className="py-8 text-center text-slate-500">Chargement…</div> : visibleTokens.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-slate-500">Aucun lien dans cette catégorie.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {visibleTokens.map(t => (
            <Card key={t.id} className={t.is_revoked ? 'border-slate-200 bg-slate-50' : 'border-slate-200'}>
              <CardContent className="p-3 flex items-start gap-3">
                <div className="text-2xl shrink-0">
                  {t.purpose === 'inscription_exposant' ? '📝' : t.purpose === 'pacific_centers' ? '👁️' : '🔗'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {t.registration_id && <AiInsightTrigger registration={{ id: t.registration_id }} size="xs" />}
                    <b className="text-sm">{t.organization?.name || t.email || t.label || '—'}</b>
                    <Badge variant="secondary" className="text-[10px]">{t.purpose === 'inscription_exposant' ? 'Inscription' : t.purpose === 'pacific_centers' ? 'Pacific' : 'Accès'}</Badge>
                    {t.is_revoked && <Badge className="bg-slate-500 text-white text-[10px]">Révoqué</Badge>}
                    {!t.is_revoked && t.use_count > 0 && <Badge className="bg-emerald-500 text-white text-[10px]">Utilisé {t.use_count}×</Badge>}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">{t.email || '—'}</div>
                  <div className="text-[10px] text-slate-400 font-mono truncate mt-1" title={t.access_url}>{t.access_url}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    Créé {new Date(t.created_at).toLocaleDateString('fr-FR')}
                    {t.last_used_at && <> · Dernier accès {new Date(t.last_used_at).toLocaleString('fr-FR')}</>}
                  </div>
                </div>
                <div className="flex flex-col gap-1.5 shrink-0">
                  {!t.is_revoked && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => copyLink(t)} className="gap-1.5"><FileText className="w-3 h-3" /> Copier le lien</Button>
                      {t.email && <Button size="sm" variant="outline" onClick={() => resend(t)} className="gap-1.5"><Send className="w-3 h-3" /> Renvoyer email</Button>}
                      <Button size="sm" variant="outline" onClick={() => revoke(t)} className="gap-1.5 text-rose-600 border-rose-200"><XCircle className="w-3 h-3" /> Révoquer</Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {showCreate && <CreateAccessTokenModal mode={showCreate} onClose={() => setShowCreate(null)} onCreated={() => { setShowCreate(null); load(); }} />}
    </div>
  );
}

function CreateAccessTokenModal({ mode, onClose, onCreated }) {
  const [busy, setBusy] = useState(false);
  const [orgs, setOrgs] = useState([]);
  const [form, setForm] = useState({
    organization_id: '',
    email: mode === 'pacific' ? 'pacific@centers.pf' : '',
    send_email: true,
    label: '',
    new_name: '',
    new_phone: '',
    new_discipline: '',
    new_contact_name: '',
  });
  const [created, setCreated] = useState(null);

  useEffect(() => {
    if (mode === 'access') {
      api('/api/registrations').then(regs => {
        const seen = new Set();
        const list = [];
        regs.forEach(r => {
          if (r.organization && !seen.has(r.organization.id)) {
            seen.add(r.organization.id);
            list.push(r.organization);
          }
        });
        list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        setOrgs(list);
      }).catch(() => {});
    }
  }, [mode]);

  const submit = async () => {
    if (mode === 'access' && !form.organization_id) { toast.error('Choisissez un exposant'); return; }
    if (mode === 'new_exposant' && (!form.email || !form.new_name)) { toast.error('Email et nom de la structure sont requis'); return; }
    if (mode === 'pacific' && !form.email) { toast.error('Email requis'); return; }
    setBusy(true);
    try {
      let body;
      if (mode === 'access') {
        body = { purpose: 'access', organization_id: form.organization_id, send_email: form.send_email };
      } else if (mode === 'new_exposant') {
        // Create org + user + access token in one call (handled by backend)
        body = {
          purpose: 'access',
          send_email: form.send_email,
          new_exposant: {
            name: form.new_name,
            email: form.email,
            phone: form.new_phone || null,
            discipline: form.new_discipline || null,
            contact_name: form.new_contact_name || null,
          },
          label: form.label || form.new_name,
        };
      } else {
        // pacific
        body = { purpose: 'pacific_centers', email: form.email, label: form.label || 'Pacific Centers', send_email: form.send_email };
      }
      const res = await api('/api/access-tokens', { method: 'POST', body: JSON.stringify(body) });
      if (res.reused) {
        toast.info(res.message || 'Lien existant réutilisé (pas de nouveau lien créé)');
      } else if (res.email_sent) {
        toast.success('Lien créé et envoyé par email ✉️');
      } else {
        toast.success('Lien créé');
      }
      setCreated(res);
    } catch (e) { toast.error(e.message); setBusy(false); }
  };

  const titleNode = mode === 'access'
    ? <><Send className="w-5 h-5 text-blue-600" /> Lien d&apos;accès exposant existant</>
    : mode === 'new_exposant'
      ? <><Plus className="w-5 h-5 text-violet-600" /> Créer un nouvel exposant + envoyer le lien</>
      : <><Eye className="w-5 h-5 text-cyan-600" /> Lien Pacific Centers (lecture seule)</>;
  const subtitleNode = mode === 'access'
    ? "L'exposant recevra un email avec son lien personnel permanent. Aucun mot de passe à retenir."
    : mode === 'new_exposant'
      ? "ARACOM saisit l'exposant ici. Il recevra automatiquement un lien pour compléter son profil. Aucune inscription libre — vous gardez la main."
      : "Génère un lien magique pour le portail Pacific Centers (vue consolidée en lecture seule). Le destinataire accède sans mot de passe.";
  const submitClass = mode === 'access'
    ? 'bg-blue-600 hover:bg-blue-700 gap-2'
    : mode === 'new_exposant'
      ? 'bg-violet-600 hover:bg-violet-700 gap-2'
      : 'bg-cyan-600 hover:bg-cyan-700 gap-2';

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => !busy && !created && onClose()}>
      <Card className="max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">{titleNode}</CardTitle>
          <p className="text-sm text-slate-600">{subtitleNode}</p>
        </CardHeader>
        {!created ? (
          <CardContent className="space-y-3">
            {mode === 'access' && (
              <div>
                <Label>Exposant</Label>
                <select className="w-full border rounded-md px-3 py-2 text-sm" value={form.organization_id} onChange={(e) => setForm({ ...form, organization_id: e.target.value })}>
                  <option value="">— Sélectionner —</option>
                  {orgs.map(o => <option key={o.id} value={o.id}>{o.name}{o.main_email ? ` (${o.main_email})` : ''}</option>)}
                </select>
              </div>
            )}
            {mode === 'new_exposant' && (
              <>
                <div>
                  <Label>Nom de la structure / association *</Label>
                  <Input value={form.new_name} onChange={(e) => setForm({ ...form, new_name: e.target.value })} placeholder="Ex: Tahiti Iti Natation" />
                </div>
                <div>
                  <Label>Email principal *</Label>
                  <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="contact@asso.pf" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Téléphone</Label>
                    <Input value={form.new_phone} onChange={(e) => setForm({ ...form, new_phone: e.target.value })} placeholder="87xxxxxx" />
                  </div>
                  <div>
                    <Label>Contact (nom)</Label>
                    <Input value={form.new_contact_name} onChange={(e) => setForm({ ...form, new_contact_name: e.target.value })} placeholder="Jean Dupont" />
                  </div>
                </div>
                <div>
                  <Label>Discipline / activité</Label>
                  <Input value={form.new_discipline} onChange={(e) => setForm({ ...form, new_discipline: e.target.value })} placeholder="Ex: Natation, Judo, Danse…" />
                </div>
              </>
            )}
            {mode === 'pacific' && (
              <>
                <div>
                  <Label>Email du destinataire Pacific Centers</Label>
                  <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="pacific@centers.pf" />
                  <p className="text-[11px] text-slate-500 mt-1">L&apos;email doit correspondre à un compte Pacific Centers existant. Par défaut : <code>pacific@centers.pf</code></p>
                </div>
                <div>
                  <Label>Étiquette interne (facultatif)</Label>
                  <Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="Pacific Centers — Direction" />
                </div>
              </>
            )}
            <div className="flex items-center gap-2 bg-slate-50 border rounded-md p-2">
              <Checkbox id="se" checked={form.send_email} onCheckedChange={(c) => setForm({ ...form, send_email: c })} />
              <Label htmlFor="se" className="text-sm cursor-pointer">Envoyer le lien par email automatiquement</Label>
            </div>
          </CardContent>
        ) : (
          <CardContent className="space-y-3">
            <div className={`rounded-md border p-3 ${created.reused ? 'bg-blue-50 border-blue-200 text-blue-900' : 'bg-emerald-50 border-emerald-200 text-emerald-900'}`}>
              <div className="font-bold flex items-center gap-2"><CheckCircle2 className="w-5 h-5" /> {created.reused ? '🔄 Lien existant réutilisé' : '✨ Nouveau lien créé !'}</div>
              {created.message && <div className="text-sm mt-1">{created.message}</div>}
              {!created.reused && form.send_email && <div className="text-sm mt-1">📧 L&apos;email vient d&apos;être envoyé.</div>}
            </div>
            <div>
              <Label className="text-xs">URL personnelle</Label>
              <div className="flex gap-2">
                <Input readOnly value={created.access_url} className="font-mono text-xs" onClick={(e) => e.target.select()} />
                <Button variant="outline" onClick={() => { navigator.clipboard.writeText(created.access_url); toast.success('Copié'); }}>Copier</Button>
              </div>
            </div>
          </CardContent>
        )}
        <div className="flex gap-2 justify-end p-4 border-t">
          {!created ? (
            <>
              <Button variant="ghost" onClick={onClose} disabled={busy}>Annuler</Button>
              <Button onClick={submit} disabled={busy} className={submitClass}>
                {busy ? 'Création…' : <><Send className="w-4 h-4" /> Créer le lien</>}
              </Button>
            </>
          ) : (
            <Button onClick={onCreated} className="ml-auto">Fermer</Button>
          )}
        </div>
      </Card>
    </div>
  );
}

function BackupView() {
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [driveInfo, setDriveInfo] = useState(null);
  const [lastBackup, setLastBackup] = useState(null);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const [items, info] = await Promise.all([
        api('/api/backups'),
        api('/api/drive/info').catch(() => null),
      ]);
      setHistory(items);
      setDriveInfo(info);
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { loadHistory(); }, []);

  const runBackup = async () => {
    if (busy) return;
    if (!confirm('Lancer une sauvegarde complète de la base et l\'uploader dans votre Google Drive (dossier "Sauvegardes") ?\n\nCette opération peut prendre 10–30 secondes.')) return;
    setBusy(true);
    const toastId = toast.loading('Sauvegarde en cours — export de toutes les collections puis upload Drive…');
    try {
      const res = await api('/api/backup/export', { method: 'POST', body: '{}' });
      toast.dismiss(toastId);
      toast.success('✅ Sauvegarde réussie : ' + res.backup.file_name);
      setLastBackup(res.backup);
      await loadHistory();
    } catch (e) {
      toast.dismiss(toastId);
      toast.error('Erreur : ' + e.message);
    } finally { setBusy(false); }
  };

  // 🛟 Restauration des plans de salles depuis le backup JSON embarqué dans le code
  //    (utilisé après un redéploiement sur une base vierge).
  const [layoutBusy, setLayoutBusy] = useState(false);
  const restoreVenueLayouts = async () => {
    if (layoutBusy) return;
    if (!confirm('⚠️ RESTAURATION DES PLANS DE SALLES\n\nCette action va remettre tous les stands et éléments décoratifs aux positions sauvegardées dans le backup embarqué (venue-layouts-backup.json).\n\nLes éléments décoratifs actuels (kiosques, formes, étiquettes) seront ÉCRASÉS par ceux du backup.\n\nContinuer ?')) return;
    setLayoutBusy(true);
    try {
      const r = await api('/api/admin/restore-venue-layouts', { method: 'POST', body: JSON.stringify({}) });
      toast.success(`✅ Plans restaurés : ${r.stands} stands + ${r.elements} éléments décoratifs`);
    } catch (e) { toast.error('Erreur : ' + e.message); }
    finally { setLayoutBusy(false); }
  };

  const downloadCurrentLayout = async () => {
    try {
      const data = await api('/api/admin/export-venue-layouts');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `venue-layouts-${new Date().toISOString().slice(0,10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('✅ Export téléchargé');
    } catch (e) { toast.error('Erreur : ' + e.message); }
  };

  const formatSize = (b) => {
    if (b < 1024) return b + ' o';
    if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' Ko';
    return (b / 1024 / 1024).toFixed(2) + ' Mo';
  };

  return (
    <div className="space-y-4">
      {/* 🚨 Reset pour nouvelle édition */}
      <Card className="border-2 border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50">
        <CardContent className="p-5 flex items-start gap-4 flex-wrap">
          <div className="w-16 h-16 rounded-lg bg-white shadow-md flex items-center justify-center shrink-0">
            <RefreshCw className="w-8 h-8 text-orange-600" />
          </div>
          <div className="flex-1 min-w-[280px]">
            <h2 className="font-bold text-orange-900 text-lg">🚨 Reset pour une nouvelle édition</h2>
            <p className="text-sm text-orange-800 mt-1">
              Remet <b>tous les exposants</b> au statut <b>&quot;à relancer&quot;</b>, <b>détache les stands</b> (plans vierges), décoche les flags convention/assurance/guide et archive les documents passés. Les exposants devront renvoyer leurs documents pour finaliser leur inscription.
            </p>
            <p className="text-xs text-orange-700 mt-1 italic">
              ✅ <b>Conservé</b> : organisations, <b>positions des stands sur le plan</b> (kiosques, stands visuels), cautions passées, notes internes, animations, historique complet dans les profils.
            </p>
          </div>
          <Button
            size="lg"
            onClick={async () => {
              const answer = window.prompt('⚠️ Cette action est IRRÉVERSIBLE.\n\nPour confirmer, tapez exactement :\nRESET-NOUVELLE-EDITION-2026\n\n(Les documents existants seront archivés, les flags décochés, les 68 exposants remis à "à relancer".)');
              if (answer !== 'RESET-NOUVELLE-EDITION-2026') { if (answer !== null) toast.error('Confirmation incorrecte'); return; }
              try {
                const r = await api('/api/admin/reset-for-new-edition', { method: 'POST', body: JSON.stringify({ confirm: 'RESET-NOUVELLE-EDITION-2026' }) });
                toast.success(r.message || '✅ Reset effectué');
              } catch (e) { toast.error(e.message); }
            }}
            className="bg-orange-600 hover:bg-orange-700 gap-2 shadow-md"
          >
            <RefreshCw className="w-5 h-5" /> Reset pour nouvelle édition
          </Button>
        </CardContent>
      </Card>

      {/* Intro + Drive info */}
      <Card className="border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50">
        <CardContent className="p-5 flex items-start gap-4 flex-wrap">
          <div className="w-16 h-16 rounded-lg bg-white shadow-md flex items-center justify-center shrink-0">
            <Download className="w-8 h-8 text-emerald-600" />
          </div>
          <div className="flex-1 min-w-[280px]">
            <h2 className="font-bold text-emerald-900 text-lg">Sauvegarde complète sur Google Drive</h2>
            <p className="text-sm text-emerald-800 mt-1">
              Exportez l&apos;intégralité des données de la plateforme (exposants, stands, cautions, animations, documents, mailing, etc.) dans un seul fichier JSON, stocké automatiquement dans votre Google Drive connecté, dossier <b>Sauvegardes/</b>.
            </p>
            {driveInfo?.configured && driveInfo?.ok && (
              <div className="mt-2 text-[11px] text-emerald-700 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" /> Drive connecté — dossier racine : <b>{driveInfo.folder_name}</b>
              </div>
            )}
            {driveInfo && !driveInfo.configured && (
              <div className="mt-2 text-[11px] text-rose-700 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" /> Drive non configuré — la sauvegarde ne fonctionnera pas.
              </div>
            )}
          </div>
          <Button
            size="lg"
            onClick={runBackup}
            disabled={busy || !driveInfo?.configured}
            className="bg-emerald-600 hover:bg-emerald-700 gap-2 shadow-md"
          >
            {busy ? <><RefreshCw className="w-5 h-5 animate-spin" /> Sauvegarde en cours…</> : <><Download className="w-5 h-5" /> Sauvegarder maintenant</>}
          </Button>
        </CardContent>
      </Card>

      {/* 🛟 Restauration des plans après redéploiement */}
      <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50">
        <CardContent className="p-5 space-y-3">
          <div className="flex items-start gap-4 flex-wrap">
            <div className="w-16 h-16 rounded-lg bg-white shadow-md flex items-center justify-center shrink-0">
              <MapPin className="w-8 h-8 text-blue-600" />
            </div>
            <div className="flex-1 min-w-[280px]">
              <h2 className="font-bold text-blue-900 text-lg">🛟 Plans de salles — Restauration après déploiement</h2>
              <p className="text-sm text-blue-800 mt-1">
                Après un <b>redéploiement</b>, la base de production peut être vide. Utilisez ce bouton pour <b>restaurer en un clic</b> toutes les positions des stands + éléments décoratifs depuis le <b>backup embarqué dans le code</b> (versionné avec l&apos;app).
              </p>
              <p className="text-xs text-blue-700 mt-1 italic">
                💡 La restauration automatique tourne déjà au premier démarrage si la DB est vide. Ce bouton est là au cas où vous voulez forcer la remise à zéro vers le dernier backup figé.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Button
                size="lg"
                onClick={restoreVenueLayouts}
                disabled={layoutBusy}
                className="bg-blue-600 hover:bg-blue-700 gap-2 shadow-md"
              >
                {layoutBusy ? <><RefreshCw className="w-5 h-5 animate-spin" /> Restauration…</> : <><RotateCcw className="w-5 h-5" /> Restaurer les plans</>}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={downloadCurrentLayout}
                className="border-blue-300 text-blue-700 hover:bg-blue-100 gap-1.5"
              >
                <Download className="w-4 h-4" /> Télécharger l&apos;état actuel (JSON)
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Last success highlight */}
      {lastBackup && (
        <Card className="border-2 border-emerald-300 bg-emerald-50">
          <CardContent className="p-4 flex items-start gap-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="font-bold text-emerald-900">Dernière sauvegarde créée avec succès ✨</div>
              <div className="text-sm text-emerald-800 mt-1">
                <b>{lastBackup.file_name}</b> · {formatSize(lastBackup.size_bytes)} · {lastBackup.documents_total} documents sur {lastBackup.collections_count} collections
                {lastBackup.zip && <> · <b>+ ZIP documents</b> ({lastBackup.zip.documents_count} fichiers, {formatSize(lastBackup.zip.size_bytes)})</>}
              </div>
              <div className="mt-2 flex gap-2 flex-wrap">
                {lastBackup.drive_view_link && (
                  <a href={lastBackup.drive_view_link} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" variant="outline" className="gap-1.5 border-emerald-400 text-emerald-700 hover:bg-emerald-100">
                      <Eye className="w-3.5 h-3.5" /> Ouvrir JSON
                    </Button>
                  </a>
                )}
                {lastBackup.drive_download_link && (
                  <a href={lastBackup.drive_download_link} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" variant="outline" className="gap-1.5 border-emerald-400 text-emerald-700 hover:bg-emerald-100">
                      <Download className="w-3.5 h-3.5" /> JSON
                    </Button>
                  </a>
                )}
                {lastBackup.zip?.drive_view_link && (
                  <a href={lastBackup.zip.drive_view_link} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" variant="outline" className="gap-1.5 border-violet-400 text-violet-700 hover:bg-violet-100">
                      <FileText className="w-3.5 h-3.5" /> Ouvrir ZIP docs
                    </Button>
                  </a>
                )}
                {lastBackup.zip?.drive_download_link && (
                  <a href={lastBackup.zip.drive_download_link} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" variant="outline" className="gap-1.5 border-violet-400 text-violet-700 hover:bg-violet-100">
                      <Download className="w-3.5 h-3.5" /> ZIP
                    </Button>
                  </a>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Sauvegardes totales" value={history.length} accent="emerald" icon={Download} />
        <KpiCard label="Dernière sauvegarde" value={history[0] ? new Date(history[0].created_at).toLocaleDateString('fr-FR') : '—'} accent="blue" />
        <KpiCard label="Volume total" value={formatSize(history.reduce((s, h) => s + (h.size_bytes || 0), 0))} accent="violet" />
        <KpiCard label="Docs. dernière sauv." value={history[0]?.documents_total || 0} accent="orange" />
      </div>

      {/* History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-4 h-4 text-emerald-600" /> Historique des sauvegardes
          </CardTitle>
          <p className="text-xs text-slate-500">Toutes les sauvegardes sont stockées dans votre Google Drive sous <code>Sauvegardes/</code>. La liste ci-dessous affiche les 50 plus récentes.</p>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-8 text-center text-slate-500">Chargement…</div>
          ) : history.length === 0 ? (
            <div className="py-8 text-center text-slate-500">Aucune sauvegarde pour l&apos;instant. Cliquez sur <b>Sauvegarder maintenant</b> pour créer la première.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-y text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-2 px-4">Fichier</th>
                  <th>Date</th>
                  <th>Collections</th>
                  <th>Documents</th>
                  <th>Taille</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {history.map(h => (
                  <tr key={h.id}>
                    <td className="py-2 px-4 font-mono text-xs break-all">{h.file_name}</td>
                    <td className="text-xs text-slate-600">{new Date(h.created_at).toLocaleString('fr-FR')}</td>
                    <td className="text-center"><Badge variant="secondary">{h.collections_count}</Badge></td>
                    <td className="text-center"><Badge variant="secondary">{h.documents_total}</Badge></td>
                    <td className="text-xs text-slate-600">{formatSize(h.size_bytes)}</td>
                    <td className="space-x-1.5 py-2 pr-4">
                      {h.drive_view_link && (
                        <a href={h.drive_view_link} target="_blank" rel="noopener noreferrer">
                          <Button size="sm" variant="outline" className="gap-1 h-7"><Eye className="w-3 h-3" /> Drive</Button>
                        </a>
                      )}
                      {h.drive_download_link && (
                        <a href={h.drive_download_link} target="_blank" rel="noopener noreferrer">
                          <Button size="sm" variant="outline" className="gap-1 h-7"><Download className="w-3 h-3" /> JSON</Button>
                        </a>
                      )}
                      {h.zip?.drive_download_link && (
                        <a href={h.zip.drive_download_link} target="_blank" rel="noopener noreferrer">
                          <Button size="sm" variant="outline" className="gap-1 h-7 border-violet-300 text-violet-700"><FileText className="w-3 h-3" /> ZIP ({h.zip.documents_count})</Button>
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card className="bg-amber-50 border-amber-200">
        <CardContent className="p-4 flex items-start gap-3 text-sm">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-amber-900">
            <b>À propos du format :</b> chaque sauvegarde produit <b>2 fichiers</b> dans votre Drive (dossier <code>Sauvegardes/</code>) :
            <ul className="list-disc pl-5 mt-1 space-y-0.5">
              <li><b>.json</b> → toutes les collections MongoDB (exposants, stands, cautions, mailing, etc.) — lisible tel quel, idéal pour restauration ou audit.</li>
              <li><b>.zip</b> → tous les documents PDF/reçus (cautions, conventions…) regroupés par type, pour consultation rapide sans décoder le base64. Contient aussi une copie du JSON pour archive unique.</li>
            </ul>
            <div className="mt-2">Les photos/vidéos Jour J restent dans leur dossier Drive dédié — la sauvegarde contient leurs métadonnées et liens uniquement.</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// =====================================================================
// IMPORT EXCEL — Import des exposants depuis un fichier .xlsx
// =====================================================================
function ImportExcelView() {
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const inputRef = useRef(null);

  const runImport = async () => {
    if (!file) { toast.error('Choisissez un fichier .xlsx'); return; }
    if (!confirm(`Lancer l'import depuis "${file.name}" ?\n\nOpération :\n- Les exposants existants seront enrichis (contact, historique, conventions, cautions, animations, remarques)\n- Les nouveaux exposants historiques seront créés avec le statut "prospect"\n- Les contacts mailing seuls seront créés avec statut "mailing_only"\n\nContinuer ?`)) return;
    setBusy(true);
    const toastId = toast.loading('Import en cours… parsing du fichier puis écriture en base');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/import/exposants-excel', {
        method: 'POST', body: fd,
        headers: { 'x-user-id': (getSession()?.id || 'u-admin'), 'x-user-role': (getSession()?.role || 'aracom_admin') },
      });
      const data = await res.json();
      toast.dismiss(toastId);
      if (!res.ok) throw new Error(data.error || 'Erreur');
      setResult(data);
      toast.success('✅ Import terminé — ' + data.summary.matched_and_updated + ' enrichies, ' + data.summary.new_prospects_created + ' prospects créés');
    } catch (e) {
      toast.dismiss(toastId);
      toast.error('Erreur : ' + e.message);
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <Card className="border-2 border-violet-200 bg-gradient-to-br from-violet-50 to-fuchsia-50">
        <CardContent className="p-5 flex items-start gap-4 flex-wrap">
          <div className="w-16 h-16 rounded-lg bg-white shadow-md flex items-center justify-center shrink-0">
            <FileText className="w-8 h-8 text-violet-600" />
          </div>
          <div className="flex-1 min-w-[280px]">
            <h2 className="font-bold text-violet-900 text-lg">Import exposants depuis Excel</h2>
            <p className="text-sm text-violet-800 mt-1">
              Uploadez un fichier <b>.xlsx</b> pour enrichir la base avec les historiques (présences par année, conventions, cautions, animations, remarques ARACOM) et créer les nouveaux prospects.
            </p>
            <ul className="text-[12px] text-violet-700 mt-2 list-disc pl-5 space-y-0.5">
              <li>Les historiques privés sont visibles uniquement par ARACOM (jamais par les exposants).</li>
              <li>Les exposants sont matchés automatiquement par nom (algorithme flou, strict ≥ 75% de similarité).</li>
              <li>Les doublons détectés gardent la ligne la plus riche (nb d&apos;éditions max).</li>
              <li>Formats supportés : colonnes nommées &quot;Exposant&quot;, &quot;Activité&quot;, &quot;Email&quot;, &quot;Téléphone&quot;, &quot;Contact&quot;, &quot;2019/2020/2023/2024/2025&quot;, &quot;Fidélité&quot;, &quot;Convention 2025&quot;, &quot;Caution 2025&quot;, &quot;Animation 2024/2025&quot;, &quot;Remarques&quot;.</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <Label>Sélectionner un fichier Excel (.xlsx)</Label>
          <div className="flex gap-2 mt-2 flex-wrap">
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(e) => { setFile(e.target.files?.[0] || null); setResult(null); }}
              className="flex-1 min-w-[240px] text-sm border rounded-md px-3 py-2"
            />
            <Button onClick={runImport} disabled={busy || !file} className="bg-violet-600 hover:bg-violet-700 gap-2">
              {busy ? <><RefreshCw className="w-4 h-4 animate-spin" /> Import…</> : <><Download className="w-4 h-4 rotate-180" /> Lancer l&apos;import</>}
            </Button>
          </div>
          {file && <div className="text-xs text-slate-600 mt-2">📎 {file.name} · {(file.size / 1024).toFixed(1)} Ko</div>}
        </CardContent>
      </Card>

      {result && (
        <>
          <Card className="border-2 border-emerald-300 bg-emerald-50">
            <CardContent className="p-4">
              <div className="font-bold text-emerald-900 flex items-center gap-2"><CheckCircle2 className="w-5 h-5" /> Import terminé</div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-3">
                <div className="bg-white rounded-md p-2 border"><div className="text-[10px] uppercase text-slate-500">Lignes lues</div><div className="font-bold text-xl text-slate-900">{result.summary.total_rows}</div></div>
                <div className="bg-white rounded-md p-2 border border-emerald-300"><div className="text-[10px] uppercase text-emerald-600">Enrichies</div><div className="font-bold text-xl text-emerald-700">{result.summary.matched_and_updated}</div></div>
                <div className="bg-white rounded-md p-2 border border-blue-300"><div className="text-[10px] uppercase text-blue-600">Prospects créés</div><div className="font-bold text-xl text-blue-700">{result.summary.new_prospects_created}</div></div>
                <div className="bg-white rounded-md p-2 border border-violet-300"><div className="text-[10px] uppercase text-violet-600">Mailing-only</div><div className="font-bold text-xl text-violet-700">{result.summary.new_mailing_contacts_created}</div></div>
                <div className="bg-white rounded-md p-2 border"><div className="text-[10px] uppercase text-slate-500">Ignorées</div><div className="font-bold text-xl text-slate-600">{result.summary.skipped_rows}</div></div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Détail des actions ({result.report?.length || 0})</CardTitle>
            </CardHeader>
            <CardContent className="p-0 max-h-[500px] overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-y text-left text-xs uppercase text-slate-500 sticky top-0">
                  <tr><th className="py-2 px-3">Action</th><th>Excel</th><th>DB</th><th>Fidélité</th><th>Éd.</th></tr>
                </thead>
                <tbody className="divide-y">
                  {(result.report || []).map((r, i) => (
                    <tr key={i}>
                      <td className="px-3 py-1.5">
                        {r.action === 'updated' && <Badge className="bg-emerald-100 text-emerald-800">Enrichie</Badge>}
                        {r.action === 'created' && <Badge className="bg-blue-100 text-blue-800">{r.is_mailing_only ? 'Mailing' : 'Prospect'}</Badge>}
                        {r.action === 'skipped_duplicate_match' && <Badge className="bg-amber-100 text-amber-800">Doublon ignoré</Badge>}
                      </td>
                      <td className="text-xs">{r.excel || r.name}</td>
                      <td className="text-xs text-slate-500">{r.db || '—'}</td>
                      <td className="text-xs">{r.fidelity || '—'}</td>
                      <td className="text-xs text-center">{r.nb_editions ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}



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
                <div className="text-sm font-semibold truncate flex items-center gap-1.5"><AiInsightTrigger registration={{ id: r.registration_id || r.id }} size="xs" />{r.organization?.name || '—'}</div>
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

function AlertsBadge() {
  const [alerts, setAlerts] = useState(null);
  const [open, setOpen] = useState(false);
  useEffect(() => { api('/api/alerts').then(setAlerts).catch(() => {}); const t = setInterval(() => api('/api/alerts').then(setAlerts).catch(() => {}), 30000); return () => clearInterval(t); }, []);
  if (!alerts) return null;
  const total = alerts.anomalies_open + alerts.tasks_open + alerts.missing_insurance + (alerts.validation_pending || 0) + (alerts.validation_rdv || 0);
  return (
    <div className="relative">
      <Button size="sm" variant="outline" className="gap-2" onClick={() => setOpen(!open)}>
        <AlertTriangle className="w-4 h-4" />
        {total > 0 && <Badge className="bg-red-600 text-white h-5 min-w-[20px] px-1.5 text-[10px]">{total}</Badge>}
      </Button>
      {open && (
        <div className="absolute right-0 top-10 w-80 bg-white border rounded-md shadow-lg p-3 z-50 space-y-2">
          <div className="font-medium text-sm">Alertes</div>
          <div className="space-y-1 text-sm">
            {alerts.validation_pending > 0 && (
              <Link href="/aracom?tab=validations" className="flex items-center justify-between rounded px-2 py-1 bg-violet-50 hover:bg-violet-100">
                <span className="text-violet-900 font-medium">🔔 Demandes de validation</span>
                <Badge className="bg-violet-600">{alerts.validation_pending}</Badge>
              </Link>
            )}
            {alerts.validation_rdv > 0 && (
              <Link href="/aracom?tab=validations" className="flex items-center justify-between rounded px-2 py-1 bg-blue-50 hover:bg-blue-100">
                <span className="text-blue-900 font-medium">📅 RDV cautions à honorer</span>
                <Badge className="bg-blue-600">{alerts.validation_rdv}</Badge>
              </Link>
            )}
            <div className="flex items-center justify-between"><span>Anomalies ouvertes</span><Badge variant={alerts.anomalies_open ? 'destructive' : 'secondary'}>{alerts.anomalies_open}</Badge></div>
            <div className="flex items-center justify-between"><span>Dont critiques</span><Badge variant={alerts.critical_anomalies ? 'destructive' : 'secondary'}>{alerts.critical_anomalies}</Badge></div>
            <div className="flex items-center justify-between"><span>Tâches en cours</span><Badge variant="secondary">{alerts.tasks_open}</Badge></div>
            <div className="flex items-center justify-between"><span>Assurances manquantes</span><Badge variant={alerts.missing_insurance ? 'destructive' : 'secondary'}>{alerts.missing_insurance}</Badge></div>
          </div>
          <Button size="sm" variant="ghost" className="w-full" onClick={() => setOpen(false)}>Fermer</Button>
        </div>
      )}
    </div>
  );
}

// =====================================================================
// VALIDATIONS — ARACOM workflow : voir / fixer RDV / verrouiller / annuler
// =====================================================================
function ValidationsView() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('en_attente');
  const [showRdv, setShowRdv] = useState(null);
  const [showLock, setShowLock] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const list = await api('/api/validation-requests');
      setRequests(list);
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const cancel = async (req) => {
    const reason = prompt(`Annuler la demande de ${req.organization?.name} ?\nMotif (optionnel) :`);
    if (reason === null) return;
    try {
      await api(`/api/validation-requests/${req.id}/cancel`, { method: 'POST', body: JSON.stringify({ reason }) });
      toast.success('Demande annulée — l\'exposant a été informé par email');
      load();
    } catch (e) { toast.error(e.message); }
  };

  const counts = {
    en_attente: requests.filter(r => r.status === 'en_attente').length,
    rdv_fixe: requests.filter(r => r.status === 'rdv_fixe').length,
    verrouille: requests.filter(r => r.status === 'verrouille').length,
    annulee: requests.filter(r => r.status === 'annulee').length,
  };

  const filtered = requests.filter(r => r.status === tab);

  if (loading) return <div className="py-12 text-center text-slate-500">Chargement…</div>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="En attente" value={counts.en_attente} accent="amber" />
        <KpiCard label="RDV fixés" value={counts.rdv_fixe} accent="blue" />
        <KpiCard label="Verrouillées" value={counts.verrouille} accent="emerald" />
        <KpiCard label="Annulées" value={counts.annulee} accent="slate" />
      </div>

      <Card className="border-violet-200 bg-violet-50/30">
        <CardContent className="p-4 text-sm text-violet-900 flex items-start gap-3">
          <Sparkles className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <b>Workflow de verrouillage :</b> l&apos;exposant clique sur <i>« Confirmer ma présence »</i> ⟶ vous fixez un RDV (chèque ou espèces) ⟶ vous encaissez ⟶ vous verrouillez la demande ⟶ l&apos;application confirme l&apos;inscription, marque la caution comme reçue, génère automatiquement le reçu et l&apos;envoie à l&apos;exposant par email.
          </div>
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid grid-cols-4 w-full md:w-auto">
          <TabsTrigger value="en_attente">⏳ En attente {counts.en_attente > 0 && <Badge className="ml-2 bg-amber-500 text-white">{counts.en_attente}</Badge>}</TabsTrigger>
          <TabsTrigger value="rdv_fixe">📅 RDV fixés {counts.rdv_fixe > 0 && <Badge className="ml-2 bg-blue-500 text-white">{counts.rdv_fixe}</Badge>}</TabsTrigger>
          <TabsTrigger value="verrouille">🔒 Verrouillées</TabsTrigger>
          <TabsTrigger value="annulee">❌ Annulées</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-3">
          {filtered.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-slate-500">Aucune demande dans cette catégorie.</CardContent></Card>
          ) : (
            <div className="space-y-3">
              {filtered.map(req => <ValidationRequestCard key={req.id} req={req} onSetRdv={() => setShowRdv(req)} onLock={() => setShowLock(req)} onCancel={() => cancel(req)} />)}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {showRdv && <SetRdvModal req={showRdv} onClose={() => setShowRdv(null)} onSaved={() => { setShowRdv(null); load(); }} />}
      {showLock && <LockValidationModal req={showLock} onClose={() => setShowLock(null)} onLocked={() => { setShowLock(null); load(); }} />}
    </div>
  );
}

function ValidationRequestCard({ req, onSetRdv, onLock, onCancel }) {
  const paymentLabel = req.preferred_payment === 'especes' ? '💵 Espèces' : '💳 Chèque';
  const accent = req.status === 'en_attente' ? 'border-amber-300 bg-amber-50/40'
    : req.status === 'rdv_fixe' ? 'border-blue-300 bg-blue-50/40'
    : req.status === 'verrouille' ? 'border-emerald-300 bg-emerald-50/40'
    : 'border-slate-200 bg-slate-50/40';
  return (
    <Card className={`border-2 ${accent}`}>
      <CardContent className="p-4">
        <div className="flex flex-wrap items-start gap-3 justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Building2 className="w-4 h-4 text-slate-500" />
              <AiInsightTrigger registration={{ id: req.registration_id || req.id, ai_insight: req.ai_insight, ai_insight_vigilance: req.ai_insight_vigilance, ai_insight_generated_at: req.ai_insight_generated_at }} size="xs" />
              <h3 className="font-bold text-base">{req.organization?.name || '—'}</h3>
              <Badge variant="secondary" className="text-xs">{req.organization?.discipline || '—'}</Badge>
            </div>
            <div className="text-sm text-slate-600 grid md:grid-cols-3 gap-x-4 gap-y-1">
              <div><b>Site :</b> {req.venue?.name || '—'}</div>
              <div><b>Stand :</b> <span className="font-mono">{req.stand_code}</span></div>
              <div><b>Mode souhaité :</b> {paymentLabel}</div>
              {req.organization?.contact_name && <div><b>Contact :</b> {req.organization.contact_name}</div>}
              {req.organization?.main_phone && <div><Phone className="inline w-3 h-3 mr-1" />{req.organization.main_phone}</div>}
              {req.organization?.main_email && <div className="truncate"><Mail className="inline w-3 h-3 mr-1" />{req.organization.main_email}</div>}
            </div>
            {req.rdv_proposal && <div className="text-xs text-slate-700 mt-2 bg-white border rounded px-2 py-1"><b>Disponibilités :</b> {req.rdv_proposal}</div>}
            {req.notes && <div className="text-xs text-slate-700 mt-1 bg-white border rounded px-2 py-1"><b>Notes :</b> {req.notes}</div>}
            {req.status === 'rdv_fixe' && req.rdv_date && (
              <div className="mt-2 bg-blue-100 border border-blue-300 rounded p-2 text-sm">
                <b>📅 RDV :</b> {new Date(req.rdv_date).toLocaleString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                {req.rdv_location && <> — {req.rdv_location}</>}
              </div>
            )}
            {req.status === 'verrouille' && req.locked_at && (
              <div className="mt-2 text-xs text-emerald-700">🔒 Verrouillée le {new Date(req.locked_at).toLocaleString('fr-FR')} · {(req.amount_xpf || 20000).toLocaleString('fr-FR')} XPF en {req.payment_mode === 'especes' ? 'espèces' : 'chèque'}</div>
            )}
            {req.status === 'annulee' && req.cancellation_reason && (
              <div className="mt-2 text-xs text-rose-700">❌ Annulée — {req.cancellation_reason}</div>
            )}
            <div className="text-[11px] text-slate-400 mt-2">Soumise le {new Date(req.created_at).toLocaleString('fr-FR')}</div>
          </div>
          <div className="flex flex-col gap-2 shrink-0">
            {req.status === 'en_attente' && (
              <>
                <Button size="sm" onClick={onSetRdv} className="bg-blue-600 hover:bg-blue-700 gap-1.5"><Calendar className="w-4 h-4" /> Fixer le RDV</Button>
                <Button size="sm" variant="outline" onClick={onCancel}>Annuler</Button>
              </>
            )}
            {req.status === 'rdv_fixe' && (
              <>
                <Button size="sm" onClick={onLock} className="bg-emerald-600 hover:bg-emerald-700 gap-1.5"><Lock className="w-4 h-4" /> Caution reçue → Verrouiller</Button>
                <Button size="sm" variant="outline" onClick={onSetRdv}>Modifier le RDV</Button>
                <Button size="sm" variant="ghost" onClick={onCancel}>Annuler</Button>
              </>
            )}
            {req.status === 'verrouille' && (
              <Badge className="bg-emerald-600 text-white">🔒 Verrouillée</Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SetRdvModal({ req, onClose, onSaved }) {
  const initial = req.rdv_date ? new Date(req.rdv_date).toISOString().slice(0, 16) : '';
  const [form, setForm] = useState({ rdv_date: initial, rdv_location: req.rdv_location || 'Bureau ARACOM', rdv_notes: req.rdv_notes || '' });
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!form.rdv_date) { toast.error('Date du RDV requise'); return; }
    setBusy(true);
    try {
      await api(`/api/validation-requests/${req.id}/set-rdv`, { method: 'POST', body: JSON.stringify(form) });
      toast.success('RDV fixé — email envoyé à l\'exposant');
      onSaved();
    } catch (e) { toast.error(e.message); }
    finally { setBusy(false); }
  };
  const paymentLabel = req.preferred_payment === 'especes' ? 'Espèces' : 'Chèque';
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => !busy && onClose()}>
      <Card className="max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Calendar className="w-5 h-5 text-blue-600" /> Fixer le RDV — {req.organization?.name}</CardTitle>
          <p className="text-sm text-slate-600">Site <b>{req.venue?.name}</b> · Stand <b className="font-mono">{req.stand_code}</b> · Mode souhaité : <b>{paymentLabel}</b> (20 000 XPF)</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Date et heure du RDV</Label>
            <Input type="datetime-local" value={form.rdv_date} onChange={(e) => setForm({ ...form, rdv_date: e.target.value })} />
          </div>
          <div>
            <Label>Lieu</Label>
            <Input value={form.rdv_location} onChange={(e) => setForm({ ...form, rdv_location: e.target.value })} placeholder="Ex : Bureau ARACOM, Papeete" />
          </div>
          <div>
            <Label>Notes complémentaires (facultatif)</Label>
            <Textarea rows={2} value={form.rdv_notes} onChange={(e) => setForm({ ...form, rdv_notes: e.target.value })} placeholder="Indications, parking, étage…" />
          </div>
          <div className="rounded-md bg-blue-50 border border-blue-200 p-3 text-xs text-blue-900">
            📧 Un email sera automatiquement envoyé à l&apos;exposant avec les détails du RDV et la liste des éléments à apporter (caution, pièce d&apos;identité…).
          </div>
        </CardContent>
        <div className="flex gap-2 justify-end p-4 border-t">
          <Button variant="ghost" onClick={onClose} disabled={busy}>Annuler</Button>
          <Button onClick={submit} disabled={busy} className="bg-blue-600 hover:bg-blue-700 gap-2">{busy ? 'Envoi…' : <><Send className="w-4 h-4" /> Confirmer le RDV</>}</Button>
        </div>
      </Card>
    </div>
  );
}

function LockValidationModal({ req, onClose, onLocked }) {
  const [form, setForm] = useState({ payment_mode: req.preferred_payment || 'cheque', amount_xpf: 20000 });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const submit = async () => {
    setBusy(true);
    try {
      const res = await api(`/api/validation-requests/${req.id}/lock`, { method: 'POST', body: JSON.stringify(form) });
      toast.success(`✅ Inscription verrouillée — reçu ${res.receipt_number || ''} envoyé`);
      setDone(res);
    } catch (e) { toast.error(e.message); setBusy(false); }
  };
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => !busy && !done && onClose()}>
      <Card className="max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Lock className="w-5 h-5 text-emerald-600" /> Verrouiller — {req.organization?.name}</CardTitle>
          <p className="text-sm text-slate-600">Confirmez la réception de la caution. Cette action est <b>irréversible</b> : statut → confirmé, stand & créneaux figés, reçu généré et envoyé à l&apos;exposant.</p>
        </CardHeader>
        {!done ? (
          <CardContent className="space-y-3">
            <div>
              <Label className="text-sm font-semibold">Mode de paiement reçu</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {[
                  { v: 'cheque', label: '💳 Chèque' },
                  { v: 'especes', label: '💵 Espèces' },
                ].map(o => (
                  <button key={o.v} type="button" onClick={() => setForm({ ...form, payment_mode: o.v })}
                    className={`border-2 rounded-md p-3 text-center transition ${form.payment_mode === o.v ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:border-slate-300'}`}>
                    <div className="font-semibold">{o.label}</div>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>Montant (XPF)</Label>
              <Input type="number" value={form.amount_xpf} onChange={(e) => setForm({ ...form, amount_xpf: parseInt(e.target.value || 0, 10) })} />
            </div>
            <div className="rounded-md bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-900 space-y-1">
              <div>🔒 La validation finale va :</div>
              <ul className="list-disc pl-5">
                <li>Marquer la caution comme <b>reçue</b></li>
                <li>Confirmer l&apos;inscription (statut <b>Confirmé</b>)</li>
                <li>Verrouiller le stand et tous les créneaux d&apos;animation</li>
                <li>Générer le <b>reçu officiel</b> (PDF imprimable)</li>
                <li>Envoyer un email à l&apos;exposant avec le lien de téléchargement</li>
              </ul>
            </div>
          </CardContent>
        ) : (
          <CardContent className="space-y-3">
            <div className="rounded-md bg-emerald-50 border border-emerald-200 p-4 text-emerald-900">
              <div className="font-bold flex items-center gap-2"><CheckCircle2 className="w-5 h-5" /> Inscription verrouillée avec succès !</div>
              {done.receipt_number && <div className="text-sm mt-2">📄 Reçu généré : <b>{done.receipt_number}</b></div>}
            </div>
            {done.receipt_document_id && (
              <a href={`/api/documents/${done.receipt_document_id}/download`} target="_blank" rel="noreferrer">
                <Button className="w-full gap-2 bg-blue-600 hover:bg-blue-700"><FileText className="w-4 h-4" /> Ouvrir / Imprimer le reçu</Button>
              </a>
            )}
          </CardContent>
        )}
        <div className="flex gap-2 justify-end p-4 border-t">
          {!done ? (
            <>
              <Button variant="ghost" onClick={onClose} disabled={busy}>Annuler</Button>
              <Button onClick={submit} disabled={busy} className="bg-emerald-600 hover:bg-emerald-700 gap-2">{busy ? 'Verrouillage…' : <><Lock className="w-4 h-4" /> Verrouiller définitivement</>}</Button>
            </>
          ) : (
            <Button onClick={onLocked} className="ml-auto">Fermer</Button>
          )}
        </div>
      </Card>
    </div>
  );
}

function TimelineBlock({ registrationId }) {
  const [items, setItems] = useState(null);
  useEffect(() => { api(`/api/activity-logs/timeline?registration_id=${registrationId}`).then(setItems).catch(e => toast.error(e.message)); }, [registrationId]);
  if (!items) return <div className="text-sm text-slate-500">Chargement…</div>;
  if (items.length === 0) return <div className="text-sm text-slate-500 py-6 text-center">Aucun événement dans la timeline.</div>;
  const color = { log: 'bg-slate-100 text-slate-700', doc: 'bg-blue-100 text-blue-700', email: 'bg-violet-100 text-violet-700', event: 'bg-emerald-100 text-emerald-700', anomaly: 'bg-red-100 text-red-700', comment: 'bg-amber-100 text-amber-700', task: 'bg-orange-100 text-orange-700' };
  return (
    <div className="relative pl-6 border-l-2 border-slate-200 space-y-4">
      {items.map((it, i) => (
        <div key={i} className="relative">
          <div className={`absolute -left-[27px] top-1 w-3 h-3 rounded-full border-2 border-white ${color[it.type]?.split(' ')[0] || 'bg-slate-400'}`}></div>
          <div className="flex items-center gap-2 mb-0.5">
            <Badge variant="secondary" className={`text-[10px] ${color[it.type] || ''}`}>{it.type}</Badge>
            <span className="text-xs text-slate-500">{new Date(it.at).toLocaleString('fr-FR')}</span>
          </div>
          <div className="font-medium text-sm">{it.label}</div>
          {it.detail && <div className="text-xs text-slate-600 mt-0.5">{it.detail}</div>}
        </div>
      ))}
    </div>
  );
}

function NewSlotForm({ registrationId, venueId, onDone }) {
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ day_label: 'vendredi', start_time: '11:00', end_time: '12:00', title: 'Animation' });
  const save = async () => {
    try {
      await api('/api/animation-slots', { method: 'POST', body: JSON.stringify({ registration_id: registrationId, venue_id: venueId, ...form }) });
      toast.success('Créneau ajouté'); setShow(false); onDone();
    } catch (e) { toast.error('Erreur : ' + e.message); }
  };
  if (!show) return <Button variant="outline" size="sm" className="gap-2" onClick={() => setShow(true)}><Plus className="w-4 h-4" /> Ajouter un créneau</Button>;
  return (
    <div className="border rounded-md p-3 bg-slate-50 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <Select value={form.day_label} onValueChange={v => setForm({ ...form, day_label: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="vendredi">Vendredi 14/08</SelectItem><SelectItem value="samedi">Samedi 15/08</SelectItem></SelectContent></Select>
        <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Titre" />
        <Input type="time" value={form.start_time} onChange={e => setForm({ ...form, start_time: e.target.value })} />
        <Input type="time" value={form.end_time} onChange={e => setForm({ ...form, end_time: e.target.value })} />
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={save} className="bg-blue-600 hover:bg-blue-700">Ajouter</Button>
        <Button size="sm" variant="ghost" onClick={() => setShow(false)}>Annuler</Button>
      </div>
    </div>
  );
}


// ---------- SatisfactionAdminView ----------
function SatisfactionAdminView() {
  const [stats, setStats] = useState(null);
  const [surveys, setSurveys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [s, list] = await Promise.all([
        api('/api/satisfaction/stats'),
        api('/api/satisfaction'),
      ]);
      setStats(s);
      setSurveys(list);
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  if (loading) return <div className="py-12 text-center text-slate-500">Chargement…</div>;
  if (!stats) return null;

  const npsColor = stats.nps === null ? 'slate' : stats.nps >= 50 ? 'emerald' : stats.nps >= 0 ? 'amber' : 'rose';
  const npsColorCls = { slate: 'text-slate-400', emerald: 'text-emerald-600', amber: 'text-amber-600', rose: 'text-rose-600' };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2"><ThumbsUp className="w-5 h-5 text-emerald-600" /> Satisfaction des exposants</h2>
          <p className="text-sm text-slate-500">Retours post-événement — {stats.total_responses}/{stats.total_eligible} réponses ({stats.response_rate}% de participation)</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => exportSatisfactionCSV(surveys)} disabled={surveys.length === 0} className="gap-2"><Download className="w-4 h-4" /> Export CSV</Button>
          <Button variant="outline" size="sm" onClick={load} className="gap-2"><RefreshCw className="w-4 h-4" /> Actualiser</Button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <StatKpi label="Réponses" value={stats.total_responses} hint={`${stats.response_rate}% de participation`} icon={ThumbsUp} color="emerald" />
        <StatKpi label="Note globale" value={stats.avg_overall ? stats.avg_overall.toFixed(1) : '—'} hint="sur 5" icon={Star} color="amber" />
        <StatKpi label="Organisation" value={stats.avg_organization ? stats.avg_organization.toFixed(1) : '—'} hint="sur 5" color="blue" />
        <StatKpi label="Stand" value={stats.avg_stand ? stats.avg_stand.toFixed(1) : '—'} hint="sur 5" color="violet" />
        <StatKpi label="Visiteurs" value={stats.avg_visitors ? stats.avg_visitors.toFixed(1) : '—'} hint="sur 5" color="pink" />
        <StatKpi label="NPS" value={stats.nps !== null ? stats.nps : '—'} hint="score de recommandation" icon={Smile} colorCls={npsColorCls[npsColor]} />
      </div>

      {/* Will participate breakdown + by site */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Calendar className="w-4 h-4 text-violet-600" /> Prochaine édition</CardTitle></CardHeader>
          <CardContent>
            {stats.total_responses === 0 ? (
              <p className="text-sm text-slate-400 italic">Aucune réponse pour le moment.</p>
            ) : (
              <div className="space-y-2">
                {[
                  { k: 'oui', label: 'Oui, avec plaisir', cls: 'bg-emerald-500' },
                  { k: 'peut_etre', label: 'Peut-être', cls: 'bg-amber-500' },
                  { k: 'non', label: 'Non', cls: 'bg-rose-500' },
                  { k: 'nsp', label: 'Sans réponse', cls: 'bg-slate-400' },
                ].map(opt => {
                  const n = stats.will_participate[opt.k] || 0;
                  const pct = stats.total_responses ? Math.round((n / stats.total_responses) * 100) : 0;
                  return (
                    <div key={opt.k} className="flex items-center gap-3">
                      <div className="w-24 text-xs text-slate-600">{opt.label}</div>
                      <div className="flex-1 h-6 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full ${opt.cls} transition-all flex items-center justify-end pr-2`} style={{ width: `${Math.max(pct, 3)}%` }}>
                          {pct > 15 && <span className="text-[10px] font-bold text-white">{pct}%</span>}
                        </div>
                      </div>
                      <div className="w-10 text-right text-xs font-semibold">{n}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><MapPin className="w-4 h-4 text-blue-600" /> Satisfaction par site</CardTitle></CardHeader>
          <CardContent>
            {stats.by_site.length === 0 ? (
              <p className="text-sm text-slate-400 italic">Aucune réponse pour le moment.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-xs text-slate-500 uppercase border-b"><tr><th className="text-left py-2">Site</th><th className="text-center">Réponses</th><th className="text-center">Note</th><th className="text-center">NPS</th></tr></thead>
                <tbody className="divide-y">
                  {stats.by_site.map((s, i) => (
                    <tr key={i}>
                      <td className="py-2 font-medium">{s.venue_name}</td>
                      <td className="text-center">{s.count}</td>
                      <td className="text-center"><span className="inline-flex items-center gap-1"><Star className="w-3 h-3 fill-amber-400 text-amber-400" />{s.avg_overall?.toFixed(1) ?? '—'}</span></td>
                      <td className={`text-center font-semibold ${s.avg_nps === null ? 'text-slate-400' : s.avg_nps >= 7 ? 'text-emerald-600' : s.avg_nps >= 5 ? 'text-amber-600' : 'text-rose-600'}`}>{s.avg_nps ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Liste des retours */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><MessageCircle className="w-4 h-4 text-slate-600" /> Retours individuels ({surveys.length})</CardTitle></CardHeader>
        <CardContent className="p-0">
          {surveys.length === 0 ? (
            <div className="p-8 text-center text-slate-400 italic">Aucun retour soumis pour le moment.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-y text-xs uppercase text-slate-500 text-left"><tr>
                <th className="py-2 px-4">Exposant</th><th>Site</th><th>Stand</th><th className="text-center">Globale</th><th className="text-center">NPS</th><th>Prochaine</th><th>Soumis le</th><th></th>
              </tr></thead>
              <tbody className="divide-y">
                {surveys.map(s => {
                  const isOpen = expanded === s.id;
                  return (
                    <React.Fragment key={s.id}>
                      <tr className="hover:bg-slate-50/50 cursor-pointer" onClick={() => setExpanded(isOpen ? null : s.id)}>
                        <td className="py-2 px-4 font-medium">{s.organization_name || '—'}</td>
                        <td className="text-slate-600">{s.venue_name || '—'}</td>
                        <td className="font-mono text-xs">{s.stand_code || '—'}</td>
                        <td className="text-center"><span className="inline-flex items-center gap-1"><Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />{s.overall_rating ?? '—'}</span></td>
                        <td className={`text-center font-bold ${s.nps_score === null ? 'text-slate-400' : s.nps_score >= 9 ? 'text-emerald-600' : s.nps_score >= 7 ? 'text-amber-600' : 'text-rose-600'}`}>{s.nps_score ?? '—'}</td>
                        <td>{s.will_participate_next ? <Badge variant="secondary" className={s.will_participate_next === 'oui' ? 'bg-emerald-100 text-emerald-700' : s.will_participate_next === 'non' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}>{s.will_participate_next === 'peut_etre' ? 'Peut-être' : s.will_participate_next === 'oui' ? 'Oui' : 'Non'}</Badge> : '—'}</td>
                        <td className="text-xs text-slate-500">{s.submitted_at ? new Date(s.submitted_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</td>
                        <td className="text-xs text-blue-600 pr-4">{isOpen ? 'Fermer ↑' : 'Détails ↓'}</td>
                      </tr>
                      {isOpen && (
                        <tr className="bg-slate-50/60">
                          <td colSpan={8} className="p-4">
                            <div className="grid md:grid-cols-3 gap-4 text-xs">
                              <div>
                                <div className="font-semibold text-slate-700 mb-1">Notes détaillées</div>
                                <div className="space-y-1 text-slate-600">
                                  <div>Organisation : <RatingInline n={s.organization_rating} /></div>
                                  <div>Stand : <RatingInline n={s.stand_rating} /></div>
                                  <div>Visiteurs : <RatingInline n={s.visitors_rating} /></div>
                                  <div>Communication : <RatingInline n={s.communication_rating} /></div>
                                </div>
                              </div>
                              <div>
                                <div className="font-semibold text-slate-700 mb-1">Points positifs</div>
                                <p className="text-slate-600 italic whitespace-pre-wrap">{s.positive_points || <span className="text-slate-400">—</span>}</p>
                              </div>
                              <div>
                                <div className="font-semibold text-slate-700 mb-1">Points à améliorer</div>
                                <p className="text-slate-600 italic whitespace-pre-wrap">{s.improvement_points || <span className="text-slate-400">—</span>}</p>
                              </div>
                              {s.free_comment && (
                                <div className="md:col-span-3">
                                  <div className="font-semibold text-slate-700 mb-1">Commentaire libre</div>
                                  <p className="text-slate-600 italic whitespace-pre-wrap bg-white border rounded p-3">{s.free_comment}</p>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatKpi({ label, value, hint, icon: Icon, color, colorCls }) {
  const colorMap = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    violet: 'bg-violet-50 text-violet-700 border-violet-200',
    pink: 'bg-pink-50 text-pink-700 border-pink-200',
  };
  const cls = colorMap[color] || 'bg-slate-50 text-slate-700 border-slate-200';
  return (
    <Card className={`border ${cls}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider opacity-75">{label}</div>
            <div className={`text-2xl font-bold mt-0.5 ${colorCls || ''}`}>{value}</div>
            {hint && <div className="text-[10px] opacity-60 mt-0.5">{hint}</div>}
          </div>
          {Icon && <Icon className="w-5 h-5 opacity-40" />}
        </div>
      </CardContent>
    </Card>
  );
}

function RatingInline({ n }) {
  if (!n) return <span className="text-slate-400">—</span>;
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(k => <Star key={k} className={`w-3 h-3 ${k <= n ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />)}
      <span className="ml-1 text-slate-600">{n}/5</span>
    </span>
  );
}

// ---------- ConfirmedExposantsPanel: liste des exposants confirmés + caution à jour pour un site ----------
function ConfirmedExposantsPanel({ stands, venue }) {
  if (!venue) return null;

  const exposants = (stands || [])
    .filter(s => s.organization && s.assignment)
    .map(s => ({
      stand_code: s.stand_code,
      organization: s.organization,
      registration_id: s.assignment?.registration_id,
      registration_status: s.registration_status,
    }));

  const [regDetails, setRegDetails] = useState({});
  useEffect(() => {
    (async () => {
      const all = await api('/api/registrations');
      const map = {};
      all.forEach(r => { map[r.id] = r; });
      setRegDetails(map);
    })();
  }, [stands]);

  const rows = exposants.map(e => {
    const d = regDetails[e.registration_id];
    return {
      ...e,
      caution_status: d?.deposit?.status || 'non_demandee',
      caution_received_at: d?.deposit?.received_at,
      is_insurance_uploaded: d?.is_insurance_uploaded,
      is_convention_signed: d?.is_convention_signed,
      completion_percent: d?.completion_percent,
      main_email: d?.organization?.main_email,
    };
  });

  const confirmed = rows.filter(r => r.registration_status === 'confirme');
  const cautionOk = rows.filter(r => r.caution_status === 'recue');
  const fullyReady = rows.filter(r => r.registration_status === 'confirme' && r.caution_status === 'recue');

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="text-base flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600" /> Exposants confirmés & à jour de leur caution — {venue?.name}</CardTitle>
            <p className="text-xs text-slate-500 mt-1">Liste connectée du plan ci-dessus</p>
          </div>
          <div className="flex gap-2">
            <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">{fullyReady.length} 100% prêts</Badge>
            <Badge variant="secondary" className="bg-blue-100 text-blue-700">{confirmed.length} confirmés</Badge>
            <Badge variant="secondary" className="bg-violet-100 text-violet-700">{cautionOk.length} cautions OK</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-y text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="py-2 px-4">Stand</th>
              <th>Exposant</th>
              <th>Discipline</th>
              <th>Email</th>
              <th className="text-center">Inscription</th>
              <th className="text-center">Caution</th>
              <th className="text-center">Assurance</th>
              <th className="text-center">Convention</th>
              <th className="text-center">Complétion</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.length === 0 ? (
              <tr><td colSpan={9} className="py-6 text-center text-slate-400 italic">Aucun exposant attribué sur ce site.</td></tr>
            ) : rows.sort((a,b)=> (a.stand_code||'').localeCompare(b.stand_code||'')).map(r => (
              <tr key={r.stand_code} className="hover:bg-slate-50/50">
                <td className="py-2 px-4 font-mono text-xs font-bold">{r.stand_code}</td>
                <td className="font-medium">{r.organization.name}</td>
                <td className="text-xs text-slate-600">{r.organization.discipline}</td>
                <td className="text-xs text-slate-600">{r.main_email || '—'}</td>
                <td className="text-center">
                  <Badge variant="secondary" className={r.registration_status === 'confirme' ? 'bg-emerald-100 text-emerald-700' : r.registration_status === 'a_confirmer' ? 'bg-amber-100 text-amber-700' : r.registration_status === 'a_relancer' ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-600'}>
                    {r.registration_status === 'confirme' ? '✓ Confirmé' : r.registration_status === 'a_confirmer' ? 'À confirmer' : r.registration_status === 'a_relancer' ? 'À relancer' : r.registration_status}
                  </Badge>
                </td>
                <td className="text-center">
                  {r.caution_status === 'recue' ? <Badge className="bg-emerald-600">✓ Reçue</Badge> :
                   r.caution_status === 'demandee' ? <Badge variant="secondary" className="bg-amber-100 text-amber-700">Demandée</Badge> :
                   <Badge variant="secondary" className="bg-slate-100 text-slate-500">—</Badge>}
                </td>
                <td className="text-center">{r.is_insurance_uploaded ? <CheckCircle2 className="w-4 h-4 text-emerald-600 inline" /> : <XCircle className="w-4 h-4 text-slate-300 inline" />}</td>
                <td className="text-center">{r.is_convention_signed ? <CheckCircle2 className="w-4 h-4 text-emerald-600 inline" /> : <XCircle className="w-4 h-4 text-slate-300 inline" />}</td>
                <td className="text-center">
                  <div className="inline-flex items-center gap-1">
                    <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div className={`h-full ${(r.completion_percent || 0) >= 80 ? 'bg-emerald-500' : (r.completion_percent || 0) >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${r.completion_percent || 0}%` }} />
                    </div>
                    <span className="text-xs font-semibold">{r.completion_percent || 0}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}


// ============ PROSPECTION ARACOM VIEW (vue consolidée admin) ============
// ============ AI Insight Card (synthèse IA d'un exposant) ============
const VIGILANCE_STYLE = {
  low:    { bg: 'bg-emerald-50 border-emerald-300', label: '🟢 Fiable',         text: 'text-emerald-900' },
  medium: { bg: 'bg-amber-50 border-amber-300',     label: '🟡 À surveiller',   text: 'text-amber-900' },
  high:   { bg: 'bg-rose-50 border-rose-300',       label: '🔴 Vigilance',      text: 'text-rose-900' },
  new:    { bg: 'bg-violet-50 border-violet-300',   label: '🆕 Nouveau dossier', text: 'text-violet-900' },
};

function AiInsightCard({ registration, onRefresh }) {
  const [busy, setBusy] = useState(false);
  if (!registration) return null;
  const v = VIGILANCE_STYLE[registration.ai_insight_vigilance] || VIGILANCE_STYLE.new;
  const generate = async () => {
    setBusy(true);
    try {
      await api(`/api/registrations/${registration.id}/generate-insight`, { method: 'POST', body: JSON.stringify({}) });
      toast.success('✨ Synthèse IA générée');
      onRefresh && onRefresh();
    } catch (e) { toast.error('Erreur IA : ' + e.message); }
    setBusy(false);
  };
  return (
    <Card className={`border-2 ${v.bg}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2 gap-2">
          <h3 className={`font-bold text-sm flex items-center gap-1.5 ${v.text}`}>
            <Sparkles className="w-4 h-4" /> Synthèse IA — Profil de l&apos;exposant
            <Badge variant="outline" className="text-[10px] ml-1">{v.label}</Badge>
          </h3>
          <Button size="sm" variant="outline" onClick={generate} disabled={busy} className="gap-1 text-[11px] h-7">
            {busy ? <><RefreshCw className="w-3 h-3 animate-spin" /> Génération…</> : <><Sparkles className="w-3 h-3" /> {registration.ai_insight ? 'Régénérer' : 'Générer'}</>}
          </Button>
        </div>
        {registration.ai_insight ? (
          <>
            <div className={`text-sm leading-relaxed ${v.text}`} dangerouslySetInnerHTML={{ __html: registration.ai_insight }} />
            {registration.ai_insight_generated_at && (
              <div className="text-[10px] text-slate-500 mt-2 italic">
                Générée le {new Date(registration.ai_insight_generated_at).toLocaleString('fr-FR')}
              </div>
            )}
          </>
        ) : (
          <div className="text-xs text-slate-600 italic">
            Aucune synthèse IA encore générée pour cet exposant. Cliquez sur <b>Générer</b> pour analyser son historique (fidélité, ponctualité, caution, points de vigilance).
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const PROSPECT_STATUS_ARACOM = [
  { value: 'a_contacter', label: 'À contacter', color: 'bg-slate-100 text-slate-700' },
  { value: 'contacte', label: 'Contacté', color: 'bg-blue-100 text-blue-700' },
  { value: 'interesse', label: 'Intéressé', color: 'bg-amber-100 text-amber-700' },
  { value: 'converti', label: '✓ Converti', color: 'bg-emerald-100 text-emerald-700' },
  { value: 'refuse', label: 'Refusé', color: 'bg-rose-100 text-rose-700' },
  { value: 'abandonne', label: 'Abandonné', color: 'bg-slate-100 text-slate-500' },
];

function ProspectionAracomView() {
  const [prospects, setProspects] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [detail, setDetail] = useState(null);
  const [newNote, setNewNote] = useState('');

  const reload = async () => {
    setLoading(true);
    try {
      const [p, s] = await Promise.all([api('/api/prospects'), api('/api/prospects/stats')]);
      setProspects(p); setStats(s);
    } catch (e) { toast.error(e.message); }
    setLoading(false);
  };
  useEffect(() => { reload(); }, []);

  const filtered = statusFilter === 'all' ? prospects : prospects.filter(p => p.status === statusFilter);

  const addNote = async () => {
    if (!newNote.trim() || !detail) return;
    try {
      const r = await api(`/api/prospects/${detail.id}/notes`, { method: 'POST', body: JSON.stringify({ text: newNote.trim() }) });
      setDetail(r); setNewNote('');
      toast.success('Note ajoutée'); reload();
    } catch (e) { toast.error(e.message); }
  };

  const convertProspect = async (p) => {
    if (!confirm(`Convertir "${p.organization_name}" en exposant ?`)) return;
    try {
      const r = await api(`/api/prospects/${p.id}/convert`, { method: 'POST', body: JSON.stringify({}) });
      toast.success(`✅ Converti — inscription ${r.registration_id.slice(0,8)}…`); reload();
    } catch (e) { toast.error(e.message); }
  };

  const deleteProspect = async (p) => {
    if (!confirm(`Supprimer "${p.organization_name}" ?`)) return;
    try { await api(`/api/prospects/${p.id}`, { method: 'DELETE' }); reload(); toast.success('Supprimé'); }
    catch (e) { toast.error(e.message); }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2">🎯 Prospection — Vue consolidée</h2>
        <p className="text-sm text-slate-500">Les Pacific Centers gèrent leurs prospects dans leur portail. Cette vue synthétise l&apos;ensemble.</p>
      </div>

      <HelpCard
        title="Signification des 6 statuts de prospection"
        definitions={PROSPECT_STATUS_DEFINITIONS}
        storageKey="fr26_help_prospect_aracom"
      />

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <KpiCard label="Total prospects" value={stats.total} accent="violet" />
          <KpiCard label="Contactés" value={stats.contacted} accent="blue" />
          <KpiCard label="Intéressés" value={stats.by_status.interesse} accent="orange" />
          <KpiCard label="Convertis" value={stats.converted} accent="emerald" />
          <Card className="border-2 border-violet-200 bg-gradient-to-br from-violet-50 to-fuchsia-50">
            <CardContent className="p-4">
              <div className="text-xs uppercase text-violet-700 font-semibold">Taux conversion</div>
              <div className="text-3xl font-extrabold text-violet-900 mt-1">{stats.conversion_rate_pct}%</div>
              <div className="text-[11px] text-slate-500">{stats.converted}/{stats.total} prospects</div>
              {stats.contacted > 0 && <div className="text-[11px] text-slate-600 mt-1">Sur contactés : <b>{stats.contact_to_conversion_pct}%</b></div>}
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardContent className="p-3">
          <div className="flex gap-2 items-center mb-3">
            <Label className="text-xs uppercase text-slate-500">Statut :</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-8 w-[220px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous ({prospects.length})</SelectItem>
                {PROSPECT_STATUS_ARACOM.map(s => <SelectItem key={s.value} value={s.value}>{s.label} ({prospects.filter(p => p.status === s.value).length})</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {loading ? <div className="py-12 text-center text-slate-500">Chargement…</div> : filtered.length === 0 ? (
            <div className="py-12 text-center text-slate-500">Aucun prospect pour ce filtre.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b text-left text-xs uppercase text-slate-500">
                <tr><th className="py-2 px-3">Organisation</th><th>Contact</th><th>Site</th><th>Statut</th><th>Notes</th><th>MàJ</th><th></th></tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map(p => {
                  const sd = PROSPECT_STATUS_ARACOM.find(s => s.value === p.status) || PROSPECT_STATUS_ARACOM[0];
                  return (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="py-2 px-3"><div className="font-medium">{p.organization_name}</div>{p.discipline && <div className="text-[11px] text-slate-500">{p.discipline}</div>}</td>
                      <td className="text-xs">{p.contact_name || '—'}<div className="text-slate-500">{p.contact_email}</div></td>
                      <td className="text-xs">{p.venue_name || '—'}</td>
                      <td>
                        <Select value={p.status} onValueChange={async v => { await api(`/api/prospects/${p.id}`, { method: 'PUT', body: JSON.stringify({ status: v }) }); toast.success('Statut modifié'); reload(); }}>
                          <SelectTrigger className={`h-8 w-[160px] text-xs ${sd.color}`}><SelectValue /></SelectTrigger>
                          <SelectContent>{PROSPECT_STATUS_ARACOM.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                        </Select>
                      </td>
                      <td className="text-xs"><button onClick={() => setDetail(p)} className="text-blue-600 hover:underline">{p.notes?.length || 0} note(s)</button></td>
                      <td className="text-[11px] text-slate-500">{new Date(p.updated_at).toLocaleDateString('fr-FR')}</td>
                      <td>
                        <div className="flex gap-1 justify-end">
                          {p.status !== 'converti' && <Button size="sm" variant="ghost" className="h-7 px-2 text-emerald-600" title="Convertir en exposant" onClick={() => convertProspect(p)}><CheckCircle2 className="w-4 h-4" /></Button>}
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-rose-600" title="Supprimer" onClick={() => deleteProspect(p)}><Trash2 className="w-4 h-4" /></Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {detail && (
        <Dialog open={!!detail} onOpenChange={v => !v && setDetail(null)}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>{detail.organization_name}</DialogTitle>
              <DialogDescription>Notes & historique de prospection</DialogDescription>
            </DialogHeader>
            <div className="space-y-2 max-h-[50vh] overflow-y-auto">
              {(detail.notes || []).slice().reverse().map((n, i) => (
                <div key={i} className="border-l-4 border-violet-200 bg-violet-50 p-3 rounded-r text-sm">
                  <div className="text-[11px] text-slate-500 mb-1">📅 {new Date(n.at).toLocaleString('fr-FR')}</div>
                  <div className="whitespace-pre-wrap">{n.text}</div>
                </div>
              ))}
              {(!detail.notes || detail.notes.length === 0) && <div className="text-center text-slate-500 py-4">Aucune note.</div>}
            </div>
            <div className="space-y-2 border-t pt-3">
              <textarea className="w-full border rounded-md p-2 text-sm resize-y min-h-[60px]" value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="Nouvelle note…" />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDetail(null)}>Fermer</Button>
                <Button onClick={addNote} disabled={!newNote.trim()} className="bg-violet-600 hover:bg-violet-700">Ajouter</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
// ============ DOCUMENTS OFFICIELS (admin upload + bibliothèque partagée) ============
const DOC_CATEGORIES = [
  { value: 'convention', label: '📜 Convention de participation', emoji: '📜' },
  { value: 'guide',      label: '📖 Guide exposant',                emoji: '📖' },
  { value: 'reglement',  label: '⚖️ Règlement intérieur',           emoji: '⚖️' },
  { value: 'autre',      label: '📁 Autre',                          emoji: '📁' },
];

function OfficialDocumentsView() {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', category: 'convention', file: null });
  const [uploading, setUploading] = useState(false);

  const reload = async () => {
    setLoading(true);
    try { const d = await api('/api/official-documents'); setDocs(d); }
    catch (e) { toast.error(e.message); }
    setLoading(false);
  };
  useEffect(() => { reload(); }, []);

  const upload = async () => {
    if (!form.title.trim()) { toast.error('Titre requis'); return; }
    if (!form.file) { toast.error('Fichier requis'); return; }
    setUploading(true);
    try {
      // Lit le fichier en base64
      const file = form.file;
      const buf = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result.split(',')[1]); // remove data: prefix
        r.onerror = rej;
        r.readAsDataURL(file);
      });
      await api('/api/official-documents', {
        method: 'POST',
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description.trim(),
          category: form.category,
          file_data: buf,
          file_name: file.name,
          mime_type: file.type || 'application/pdf',
        }),
      });
      toast.success('✅ Document officiel ajouté à la bibliothèque');
      setForm({ title: '', description: '', category: 'convention', file: null });
      setShowForm(false);
      reload();
    } catch (e) { toast.error('Erreur : ' + e.message); }
    setUploading(false);
  };

  const remove = async (d) => {
    if (!confirm(`Retirer "${d.title}" de la bibliothèque ? Le fichier reste dans Google Drive mais ne sera plus visible des exposants.`)) return;
    try { await api(`/api/official-documents/${d.id}`, { method: 'DELETE' }); toast.success('Retiré'); reload(); }
    catch (e) { toast.error(e.message); }
  };

  return (
    <div className="space-y-4">
      <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50">
        <CardContent className="p-5 flex items-start gap-4 flex-wrap">
          <div className="w-14 h-14 rounded-lg bg-white shadow-md flex items-center justify-center shrink-0">
            <FileText className="w-7 h-7 text-blue-600" />
          </div>
          <div className="flex-1 min-w-[260px]">
            <h2 className="font-bold text-blue-900 text-lg">📚 Bibliothèque de documents officiels</h2>
            <p className="text-sm text-blue-800 mt-1">
              Téléchargez ici la <b>convention 2026</b>, le <b>guide exposant</b>, le <b>règlement</b>… Ils seront automatiquement disponibles dans le portail de chacun des 68 exposants, qui pourront les télécharger, les signer puis vous les renvoyer (par email ou directement dans leur espace).
            </p>
            <p className="text-xs text-blue-700 italic mt-1">📂 Stockage automatique dans <b>Google Drive &gt; Forum 2026 &gt; Documents officiels/</b></p>
          </div>
          <Button onClick={() => setShowForm(!showForm)} className="bg-blue-600 hover:bg-blue-700 gap-1.5">
            <Plus className="w-4 h-4" /> Ajouter un document
          </Button>
        </CardContent>
      </Card>

      {showForm && (
        <Card className="border-blue-300">
          <CardContent className="p-4 space-y-3">
            <h3 className="font-semibold text-sm">Nouveau document officiel</h3>
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs uppercase">Titre *</Label>
                <Input className="mt-1" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Ex: Convention de participation 2026" />
              </div>
              <div>
                <Label className="text-xs uppercase">Catégorie</Label>
                <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{DOC_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs uppercase">Description (visible des exposants)</Label>
              <Input className="mt-1" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Ex: À signer et nous retourner avant le 15 juillet 2026" />
            </div>
            <div>
              <Label className="text-xs uppercase">Fichier (PDF recommandé, max 20 Mo)</Label>
              <Input className="mt-1" type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" onChange={e => setForm({ ...form, file: e.target.files?.[0] || null })} />
              {form.file && <div className="text-xs text-slate-500 mt-1">{form.file.name} — {(form.file.size/1024).toFixed(1)} Ko</div>}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowForm(false)}>Annuler</Button>
              <Button onClick={upload} disabled={uploading} className="bg-blue-600 hover:bg-blue-700 gap-1.5">
                {uploading ? <><RefreshCw className="w-4 h-4 animate-spin" /> Upload Drive…</> : <><Plus className="w-4 h-4" /> Ajouter</>}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {loading ? <div className="py-8 text-center text-slate-500">Chargement…</div> :
           docs.length === 0 ? <div className="py-12 text-center text-slate-500">
             <FileText className="w-10 h-10 mx-auto text-slate-300 mb-2" />
             Aucun document officiel pour l&apos;instant. Cliquez sur <b>« Ajouter un document »</b>.
           </div> : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b text-left text-xs uppercase text-slate-500">
                <tr><th className="py-2 px-3">Titre</th><th>Catégorie</th><th>Description</th><th>Taille</th><th>Ajouté</th><th></th></tr>
              </thead>
              <tbody className="divide-y">
                {docs.map(d => {
                  const cat = DOC_CATEGORIES.find(c => c.value === d.category) || DOC_CATEGORIES[3];
                  return (
                    <tr key={d.id} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-medium">{d.title}</td>
                      <td><Badge variant="secondary">{cat.emoji} {cat.label.replace(/^.{2,3}\s/, '')}</Badge></td>
                      <td className="text-xs text-slate-600 max-w-md">{d.description || '—'}</td>
                      <td className="text-xs">{d.size_bytes ? (d.size_bytes / 1024).toFixed(0) + ' Ko' : '—'}</td>
                      <td className="text-[11px] text-slate-500">{new Date(d.uploaded_at || d.created_at).toLocaleDateString('fr-FR')}</td>
                      <td>
                        <div className="flex gap-1 justify-end pr-3">
                          {d.drive_url && <a href={d.drive_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:bg-blue-50 rounded p-1.5"><Eye className="w-4 h-4" /></a>}
                          <button onClick={() => remove(d)} className="text-rose-600 hover:bg-rose-50 rounded p-1.5"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


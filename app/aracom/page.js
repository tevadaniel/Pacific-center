'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Shell, KpiCard } from '@/components/app-shell';
import { api } from '@/lib/auth-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Users, MapPin, FileCheck2, Wallet, AlertTriangle, Send, Search, FileText, RefreshCw, CheckCircle2, XCircle, Clock, Building2, Smartphone, Mail, Activity, Sparkles, Download, Trash2, Move, Plus, KeyRound, ThumbsUp, Star, Smile, MessageCircle, Calendar, Zap, Printer } from 'lucide-react';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { REGISTRATION_STATUS, REGISTRATION_STATUS_LABEL, REGISTRATION_STATUS_COLOR, PRIORITY_LEVELS, DEPOSIT_STATUS, DEPOSIT_STATUS_LABEL, DISCIPLINES, DEPOSIT_AMOUNT_XPF, DOCUMENT_TYPES, DOCUMENT_TYPE_LABEL } from '@/lib/constants';
import { FileUploadButton } from '@/components/file-upload';
import SmartVenueMap from '@/components/smart-venue-map';
import { exportExposantsCSV, exportCautionsCSV, exportSatisfactionCSV } from '@/lib/csv-export';

const TABS = [
  { key: 'dashboard', label: 'Dashboard', href: '/aracom' },
  { key: 'exposants', label: 'Exposants', href: '/aracom?tab=exposants' },
  { key: 'sites', label: 'Sites & stands', href: '/aracom?tab=sites' },
  { key: 'cautions', label: 'Cautions', href: '/aracom?tab=cautions' },
  { key: 'mailing', label: 'Mailing', href: '/aracom?tab=mailing' },
  { key: 'relances', label: 'Relances', href: '/aracom?tab=relances' },
  { key: 'anomalies', label: 'Anomalies', href: '/aracom?tab=anomalies' },
  { key: 'bilans', label: 'Bilans', href: '/aracom?tab=bilans' },
  { key: 'satisfaction', label: 'Satisfaction', href: '/aracom?tab=satisfaction' },
];

export default function AracomPage() {
  const [activeTab, setActiveTab] = useState('dashboard');
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setActiveTab(params.get('tab') || 'dashboard');
    const onPop = () => setActiveTab(new URLSearchParams(window.location.search).get('tab') || 'dashboard');
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
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
      right={<div className="flex items-center gap-2"><AlertsBadge /><Link href="/jour-j"><Button className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 gap-2"><Smartphone className="w-4 h-4" /> Mode Jour J</Button></Link></div>}
    >
      {activeTab === 'dashboard' && <DashboardView onGoto={setTab} />}
      {activeTab === 'exposants' && <ExposantsView />}
      {activeTab === 'sites' && <SitesView />}
      {activeTab === 'cautions' && <CautionsView />}
      {activeTab === 'mailing' && <MailingView />}
      {activeTab === 'relances' && <RelancesView />}
      {activeTab === 'anomalies' && <AnomaliesView />}
      {activeTab === 'bilans' && <BilansView />}
      {activeTab === 'satisfaction' && <SatisfactionAdminView />}
    </Shell>
  );
}

function DashboardView({ onGoto }) {
  const [kpis, setKpis] = useState(null);
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const load = async () => {
    setLoading(true);
    try {
      const [k, s] = await Promise.all([api('/api/dashboard/kpis'), api('/api/dashboard/by-site')]);
      setKpis(k); setSites(s);
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
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <KpiCard label="Exposants" value={kpis.total} hint={`${kpis.by_status?.confirme || 0} confirmés`} accent="blue" icon={Users} />
        <KpiCard label="À relancer" value={kpis.by_status?.a_relancer || 0} accent="orange" icon={Clock} />
        <KpiCard label="À confirmer" value={kpis.by_status?.a_confirmer || 0} accent="orange" icon={Activity} />
        <KpiCard label="Prospects" value={kpis.by_status?.prospect || 0} accent="slate" icon={Sparkles} />
        <KpiCard label="Cautions reçues" value={kpis.cautions_recues} hint={`${(kpis.xpf_encaisses || 0).toLocaleString('fr-FR')} XPF`} accent="emerald" icon={Wallet} />
        <KpiCard label="Conventions" value={kpis.conv_signed} hint="signées" accent="emerald" icon={FileCheck2} />
      </div>

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
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
              <SelectContent><SelectItem value="all">Toutes priorités</SelectItem>{PRIORITY_LEVELS.map(p => <SelectItem key={p} value={p}>{p === 'prospect' ? 'Prospect' : `Priorité ${p}`}</SelectItem>)}</SelectContent>
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
                    <div className="font-medium text-slate-900">{r.organization?.name}</div>
                    <div className="text-xs text-slate-500">{r.organization?.discipline}</div>
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
              </TabsList>

              <TabsContent value="resume" className="space-y-3">
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {venues.map(v => {
          const vStands = selected === v.id ? stands.length : v.capacity_stands;
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
  useEffect(() => { api('/api/registrations').then(r => { setRows(r); setLoading(false); }); }, []);
  const updateStatus = async (depId, status) => {
    await api(`/api/deposits/${depId}`, { method: 'PUT', body: JSON.stringify({ status }) });
    const r = await api('/api/registrations'); setRows(r);
    toast.success('Caution mise à jour');
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
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Total attendu" value={`${totalExpected.toLocaleString('fr-FR')} XPF`} accent="blue" />
        <KpiCard label="Encaissé" value={`${totalReceived.toLocaleString('fr-FR')} XPF`} accent="emerald" />
        <KpiCard label="Reçues" value={rows.filter(r => r.deposit?.status === 'recue').length} accent="emerald" />
        <KpiCard label="Non demandées" value={rows.filter(r => !r.deposit || r.deposit.status === 'non_demandee').length} accent="slate" />
      </div>
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
          <thead className="bg-slate-50 border-b text-left text-xs uppercase text-slate-500"><tr><th className="py-2 px-4">Exposant</th><th>Site</th><th>Stand</th><th>Email</th><th>Statut</th><th>Actions</th></tr></thead>
          <tbody className="divide-y">
            {loading ? <tr><td colSpan="6" className="py-6 text-center text-slate-400">…</td></tr> : filtered.length === 0 ? <tr><td colSpan="6" className="py-6 text-center text-slate-400">Aucun résultat</td></tr> : filtered.map(r => (
              <tr key={r.id} className="hover:bg-slate-50/50">
                <td className="py-2 px-4"><div className="font-medium">{r.organization?.name}</div><div className="text-xs text-slate-500">{r.organization?.discipline}</div></td>
                <td>{r.venue?.name}</td>
                <td className="font-mono text-xs">{r.stand_code}</td>
                <td className="text-xs text-slate-600">{r.organization?.main_email}</td>
                <td><Badge variant={r.deposit?.status === 'recue' ? 'default' : 'secondary'} className={r.deposit?.status === 'recue' ? 'bg-emerald-600' : ''}>{DEPOSIT_STATUS_LABEL[r.deposit?.status] || '—'}</Badge></td>
                <td className="py-1 pr-4">
                  <Select value={r.deposit?.status} onValueChange={v => updateStatus(r.deposit.id || r.deposit._id, v)}>
                    <SelectTrigger className="h-8 w-[160px]"><SelectValue /></SelectTrigger>
                    <SelectContent>{DEPOSIT_STATUS.map(s => <SelectItem key={s} value={s}>{DEPOSIT_STATUS_LABEL[s]}</SelectItem>)}</SelectContent>
                  </Select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent></Card>
    </div>
  );
}

function MailingView() {
  const [emails, setEmails] = useState([]);
  const [subject, setSubject] = useState('Forum de la Rentrée 2026 — Confirmation de votre inscription');
  const [body, setBody] = useState('<p>Bonjour,</p><p>Nous vous confirmons votre inscription au Forum de la Rentrée 2026 (14 et 15 août 2026).</p><p>Merci de nous retourner la convention signée et votre caution de 20 000 XPF.</p><p>Cordialement,<br/>L’équipe ARACOM</p>');
  const [type, setType] = useState('confirmation');
  const [filter, setFilter] = useState('all');
  const load = () => api('/api/emails').then(setEmails);
  useEffect(() => { load(); }, []);
  const send = async () => {
    try {
      const regs = await api('/api/registrations' + (filter === 'a_relancer' ? '?status=a_relancer' : filter === 'a_confirmer' ? '?status=a_confirmer' : ''));
      const ids = regs.map(r => r.id);
      const res = await api('/api/emails/send', { method: 'POST', body: JSON.stringify({ subject, body_html: body, registration_ids: ids, campaign_type: type }) });
      toast.success(`✉️ ${res.sent} email(s) envoyé(s) (mock)`);
      load();
    } catch (e) { toast.error(e.message); }
  };
  return (
    <div className="grid md:grid-cols-2 gap-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Nouvelle campagne <Badge variant="secondary" className="ml-2">MOCK</Badge></CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div><Label>Type</Label><Select value={type} onValueChange={setType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['reinscription','relance','confirmation','documents','caution'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></div>
          <div><Label>Destinataires</Label><Select value={filter} onValueChange={setFilter}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Tous les exposants</SelectItem><SelectItem value="a_relancer">À relancer</SelectItem><SelectItem value="a_confirmer">À confirmer</SelectItem></SelectContent></Select></div>
          <div><Label>Objet</Label><Input value={subject} onChange={e => setSubject(e.target.value)} /></div>
          <div><Label>Corps HTML</Label><Textarea rows={8} value={body} onChange={e => setBody(e.target.value)} /></div>
          <Button className="gap-2" onClick={send}><Send className="w-4 h-4" /> Envoyer la campagne</Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Historique (200 derniers)</CardTitle></CardHeader>
        <CardContent className="space-y-2 max-h-[600px] overflow-y-auto">
          {emails.length === 0 ? <p className="text-slate-500 text-sm">Aucun email.</p> : emails.map(e => (
            <div key={e.id} className="border rounded-md p-3">
              <div className="flex items-center justify-between"><div className="font-medium text-sm">{e.subject}</div><Badge variant="secondary">{e.send_status}</Badge></div>
              <div className="text-xs text-slate-500 mt-1"><Mail className="w-3 h-3 inline mr-1" /> {e.to_email} • {e.sent_at && new Date(e.sent_at).toLocaleString('fr-FR')}</div>
            </div>
          ))}
        </CardContent>
      </Card>
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
                <td className="py-2 px-4 font-medium">{a.organization_name}</td>
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
          <thead className="bg-slate-50 border-b text-left text-xs uppercase text-slate-500"><tr><th className="py-2 px-4">Type</th><th>Portée</th><th>Statut</th><th>Généré le</th><th></th></tr></thead>
          <tbody className="divide-y">
            {reports.map(r => (
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
                <td className="text-slate-700">{t.organization_name} • <span className="font-mono text-xs">{t.stand_code}</span></td>
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
              <Select value={form.priority_level} onValueChange={v => setForm({ ...form, priority_level: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PRIORITY_LEVELS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select>
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

function AlertsBadge() {
  const [alerts, setAlerts] = useState(null);
  const [open, setOpen] = useState(false);
  useEffect(() => { api('/api/alerts').then(setAlerts).catch(() => {}); const t = setInterval(() => api('/api/alerts').then(setAlerts).catch(() => {}), 30000); return () => clearInterval(t); }, []);
  if (!alerts) return null;
  const total = alerts.anomalies_open + alerts.tasks_open + alerts.missing_insurance;
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

function TimelineBlock({ registrationId }) {
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
  const [form, setForm] = useState({ day_label: 'vendredi', start_time: '11:00', end_time: '12:00', title: 'Animation' });
  const save = async () => {
    await api('/api/animation-slots', { method: 'POST', body: JSON.stringify({ registration_id: registrationId, venue_id: venueId, ...form }) });
    toast.success('Créneau ajouté'); setShow(false); onDone();
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


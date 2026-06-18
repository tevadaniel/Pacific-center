'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Shell, KpiCard } from '@/components/app-shell';
import { api } from '@/lib/auth-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { ChatbotFloating } from '@/components/chatbot-widget';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { MapPin, Users, TrendingUp, FileDown, AlertTriangle, Eye, Calendar, Sparkles, LayoutGrid, FileText, Activity, Target, Plus, MessageSquare, CheckCircle2, XCircle, Mail, Phone, Trash2 } from 'lucide-react';
import { PROSPECT_STATUS_DEFINITIONS } from '@/lib/constants';
import HelpCard from '@/components/help-card';
import SmartVenueMap from '@/components/smart-venue-map';
import { exportExposantsCSV, exportCautionsCSV, exportSatisfactionCSV, exportAnimationsCSV, exportAllZIP } from '@/lib/csv-export';
import { Package, Loader2, Wallet, FileSpreadsheet } from 'lucide-react';
import PacificValidationsView from '@/components/pacific/pacific-validations-view';

export default function PacificCentersPage() {
  return (
    <Shell
      title="Portail Pacific Centers"
      subtitle="Vue lecture seule consolidée — taux de remplissage, exposants confirmés, planning et reporting."
      allowedRoles={['pacific_centers_readonly']}
    >
      <div className="space-y-4">
        <Card className="border-2 border-cyan-200 bg-gradient-to-br from-cyan-50 to-teal-50">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-20 h-20 rounded-lg bg-white shadow-md flex items-center justify-center shrink-0 relative overflow-hidden">
              <Image src="/pacific-logo.jpg" alt="Pacific Centers" fill className="object-cover" />
            </div>
            <div className="flex-1">
              <h2 className="font-bold text-cyan-900 text-lg">Pacific Centers</h2>
              <p className="text-sm text-cyan-800">Espace de consultation dédié — visualisation synthétique de l&apos;avancement du Forum de la Rentrée 2026, sites par sites.</p>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="synthese">
          <TabsList className="w-full grid grid-cols-8">
            <TabsTrigger value="synthese">Synthèse</TabsTrigger>
            <TabsTrigger value="sites">Sites & plan</TabsTrigger>
            <TabsTrigger value="exposants">👥 Exposants</TabsTrigger>
            <TabsTrigger value="domaines">📊 Domaines</TabsTrigger>
            <TabsTrigger value="validations">📋 Validations & Attente</TabsTrigger>
            <TabsTrigger value="planning">Planning animations</TabsTrigger>
            <TabsTrigger value="prospection">🎯 Prospection</TabsTrigger>
            <TabsTrigger value="reporting">Reporting</TabsTrigger>
          </TabsList>
          <TabsContent value="synthese" className="space-y-6 mt-4"><SyntheseView /></TabsContent>
          <TabsContent value="sites" className="space-y-6 mt-4"><SitesView /></TabsContent>
          <TabsContent value="exposants" className="space-y-6 mt-4"><ExposantsPacificView /></TabsContent>
          <TabsContent value="domaines" className="space-y-6 mt-4"><DomainesPacificView /></TabsContent>
          <TabsContent value="validations" className="space-y-6 mt-4"><PacificValidationsView /></TabsContent>
          <TabsContent value="planning" className="space-y-6 mt-4"><PlanningView /></TabsContent>
          <TabsContent value="prospection" className="space-y-6 mt-4"><ProspectionView /></TabsContent>
          <TabsContent value="reporting" className="space-y-6 mt-4"><ReportingView /></TabsContent>
        </Tabs>
      </div>
      <ChatbotFloating role="pacific_centers_readonly" />
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

      {/* 🤝 Engagement & accompagnement */}
      <div className="grid sm:grid-cols-2 gap-3">
        <Card className="bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-200">
          <CardContent className="p-4">
            <p className="font-medium text-sm text-amber-900 flex items-center gap-2">🕐 Présence appréciée des exposants</p>
            <p className="text-xs text-amber-800 mt-1 leading-relaxed">
              En assurant une présence régulière et un stand vivant tout au long de la journée, chaque exposant contribue au respect des engagements partagés pour cet événement.
            </p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-50 to-sky-50 border-blue-200">
          <CardContent className="p-4">
            <p className="font-medium text-sm text-blue-900 flex items-center gap-2">🤝 ARACOM sur le terrain</p>
            <p className="text-xs text-blue-800 mt-1 leading-relaxed">
              L&apos;équipe ARACOM est présente <b>toute la journée</b> sur chaque site pour accompagner les exposants et résoudre toute difficulté.
            </p>
          </CardContent>
        </Card>
      </div>
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
          <CardTitle className="text-base flex items-center gap-2"><LayoutGrid className="w-4 h-4 text-violet-600" /> Plan interactif — {selectedVenue?.name}</CardTitle>
          <p className="text-xs text-slate-500 mt-1">{stands.length} stands • {occupied} attribués • {stands.length - occupied} libres</p>
        </CardHeader>
        <CardContent>
          <SmartVenueMap stands={stands} venue={selectedVenue} />
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


// 🆕 SESSION 53.12 — Cellule de check (✓ / ✕) pour la table Exposants Pacific
function CheckCell({ ok, title }) {
  return (
    <span title={title || (ok ? 'Reçu' : 'À fournir')}>
      {ok ? <CheckCircle2 className="w-4 h-4 text-emerald-600 inline" /> : <XCircle className="w-4 h-4 text-slate-300 inline" />}
    </span>
  );
}

// 🆕 SESSION 53.12 — Vue Exposants Pacific Centers (lecture seule)
// Affiche la liste complète des exposants par site avec leur état de complétion :
// - Convention signée
// - Assurance déposée
// - Caution / chèque reçu(e)
// - Reçu (transaction encaissée)
function ExposantsPacificView() {
  const [regs, setRegs] = useState([]);
  const [orgs, setOrgs] = useState([]);
  const [venues, setVenues] = useState([]);
  const [deposits, setDeposits] = useState([]);
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [venueFilter, setVenueFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api('/api/registrations').catch(() => []),
      api('/api/organizations').catch(() => []),
      api('/api/venues').catch(() => []),
      api('/api/documents').catch(() => []),
    ]).then(([r, o, v, doc]) => {
      setRegs(Array.isArray(r) ? r : []);
      setOrgs(Array.isArray(o) ? o : []);
      setVenues(Array.isArray(v) ? v : []);
      // Le deposit est déjà embarqué dans chaque registration via /api/registrations
      setDeposits([]);
      setDocs(Array.isArray(doc) ? doc : []);
    }).finally(() => setLoading(false));
  }, []);

  const orgById = Object.fromEntries(orgs.map(o => [o.id, o]));
  const venueById = Object.fromEntries(venues.map(v => [v.id, v]));
  // 🆕 Le deposit est embarqué dans la registration sous la clé `deposit` (cf /api/registrations endpoint)
  const depositByReg = {};
  for (const r of regs) {
    if (r.deposit) depositByReg[r.id] = r.deposit;
  }
  const docsByReg = {};
  for (const d of docs) {
    if (!docsByReg[d.registration_id]) docsByReg[d.registration_id] = [];
    docsByReg[d.registration_id].push(d);
  }

  // Filtrage + tri
  const filtered = regs
    .filter(r => venueFilter === 'all' || r.venue_id === venueFilter)
    .filter(r => {
      if (statusFilter === 'all') return true;
      if (statusFilter === 'validated') return ['confirme', 'verrouille', 'pre_validated'].includes(r.status);
      if (statusFilter === 'pre_reserved') return r.status === 'a_confirmer' && !r.is_waitlist;
      if (statusFilter === 'waitlist') return r.is_waitlist === true || r.status === 'liste_attente';
      return r.status === statusFilter;
    })
    .filter(r => {
      if (!search) return true;
      const org = orgById[r.organization_id];
      const q = search.toLowerCase();
      return (org?.name || '').toLowerCase().includes(q)
        || (org?.main_email || '').toLowerCase().includes(q)
        || (r.stand_code || '').toLowerCase().includes(q);
    })
    .sort((a, b) => {
      const oa = orgById[a.organization_id]?.name || '';
      const ob = orgById[b.organization_id]?.name || '';
      return oa.localeCompare(ob, 'fr');
    });

  const stats = {
    total: regs.length,
    validated: regs.filter(r => ['confirme', 'verrouille', 'pre_validated'].includes(r.status)).length,
    preReserved: regs.filter(r => r.status === 'a_confirmer' && !r.is_waitlist).length,
    waitlist: regs.filter(r => r.is_waitlist === true || r.status === 'liste_attente').length,
    convSigned: regs.filter(r => r.is_convention_signed).length,
    insurance: regs.filter(r => r.is_insurance_uploaded).length,
    cautionReceived: regs.filter(r => r.is_deposit_received).length,
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Users className="w-4 h-4 text-cyan-600" /> Détail des exposants</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
            <KpiCard label="Total" value={stats.total} accent="slate" />
            <KpiCard label="Validés" value={stats.validated} accent="emerald" />
            <KpiCard label="Pré-réservés" value={stats.preReserved} accent="violet" />
            <KpiCard label="Liste d'attente" value={stats.waitlist} accent="amber" />
            <KpiCard label="Conventions signées" value={`${stats.convSigned}/${stats.total}`} accent="blue" />
            <KpiCard label="Assurances reçues" value={`${stats.insurance}/${stats.total}`} accent="cyan" />
            <KpiCard label="Cautions reçues" value={`${stats.cautionReceived}/${stats.total}`} accent="teal" />
          </div>

          {/* Filtres */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <div>
              <Label className="text-xs">Recherche</Label>
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nom org., email, stand…" className="h-8" />
            </div>
            <div>
              <Label className="text-xs">Site</Label>
              <Select value={venueFilter} onValueChange={setVenueFilter}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous sites</SelectItem>
                  {venues.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Statut</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous statuts</SelectItem>
                  <SelectItem value="validated">Validés</SelectItem>
                  <SelectItem value="pre_reserved">Pré-réservés</SelectItem>
                  <SelectItem value="waitlist">Liste d&apos;attente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-8 text-sm text-slate-500"><Loader2 className="w-4 h-4 animate-spin inline mr-1" /> Chargement…</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-sm text-slate-500">Aucun exposant ne correspond aux filtres.</div>
          ) : (
            <div className="rounded-md border border-slate-200 overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-700">
                  <tr>
                    <th className="px-2 py-1.5 text-left font-bold">Exposant</th>
                    <th className="px-2 py-1.5 text-left font-bold">Site</th>
                    <th className="px-2 py-1.5 text-left font-bold">Stand</th>
                    <th className="px-2 py-1.5 text-center font-bold">Statut</th>
                    <th className="px-2 py-1.5 text-center font-bold" title="Convention signée">📝 Conv.</th>
                    <th className="px-2 py-1.5 text-center font-bold" title="Assurance RC déposée">🛡️ Assur.</th>
                    <th className="px-2 py-1.5 text-center font-bold" title="Caution / chèque reçu">💰 Caution</th>
                    <th className="px-2 py-1.5 text-center font-bold" title="Reçu (paiement)">🧾 Reçu</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(r => {
                    const org = orgById[r.organization_id] || {};
                    const venue = venueById[r.venue_id] || {};
                    const dep = depositByReg[r.id];
                    const isValidated = ['confirme', 'verrouille', 'pre_validated'].includes(r.status);
                    const isPreReserved = r.status === 'a_confirmer' && !r.is_waitlist;
                    const isWaitlist = r.is_waitlist === true || r.status === 'liste_attente';
                    const statusLabel = isValidated ? 'Validé' : isPreReserved ? 'Pré-réservé' : isWaitlist ? 'Attente' : r.status;
                    const statusColor = isValidated ? 'bg-emerald-100 text-emerald-900 border-emerald-300' : isPreReserved ? 'bg-violet-100 text-violet-900 border-violet-300' : isWaitlist ? 'bg-amber-100 text-amber-900 border-amber-300' : 'bg-slate-100 text-slate-700 border-slate-300';
                    return (
                      <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50">
                        <td className="px-2 py-1.5">
                          <div className="font-medium text-slate-900 truncate max-w-[260px]" title={org.name}>{org.name || '—'}</div>
                          <div className="text-[10px] text-slate-500 truncate">{org.main_email}</div>
                        </td>
                        <td className="px-2 py-1.5 text-slate-700">{venue.name || '—'}</td>
                        <td className="px-2 py-1.5 font-mono">{r.stand_code || '—'}</td>
                        <td className="px-2 py-1.5 text-center">
                          <Badge className={`text-[10px] ${statusColor} border`}>{statusLabel}</Badge>
                        </td>
                        <td className="px-2 py-1.5 text-center"><CheckCell ok={r.is_convention_signed} title="Convention signée" /></td>
                        <td className="px-2 py-1.5 text-center"><CheckCell ok={r.is_insurance_uploaded} title="Attestation d'assurance RC" /></td>
                        <td className="px-2 py-1.5 text-center"><CheckCell ok={r.is_deposit_received} title={dep ? `${dep.amount_xpf} XPF · ${dep.status}` : 'Caution non reçue'} /></td>
                        <td className="px-2 py-1.5 text-center"><CheckCell ok={dep?.status === 'recue'} title={dep ? `Reçu : ${dep.amount_xpf} XPF` : 'Pas de transaction'} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div className="text-[10px] text-slate-500 italic">
            🔒 Vue lecture seule. Pour toute modification, contactez ARACOM.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}



// 🆕 SESSION 53.13 — Vue Domaines & Secteurs (graphique par site)
// Couleurs reproductibles pour chaque discipline (hash-based)
const DISCIPLINE_COLORS = [
  'bg-rose-500', 'bg-pink-500', 'bg-fuchsia-500', 'bg-purple-500', 'bg-violet-500',
  'bg-indigo-500', 'bg-blue-500', 'bg-sky-500', 'bg-cyan-500', 'bg-teal-500',
  'bg-emerald-500', 'bg-green-500', 'bg-lime-500', 'bg-yellow-500', 'bg-amber-500',
  'bg-orange-500', 'bg-red-500',
];
function colorForDiscipline(name) {
  let h = 0;
  for (let i = 0; i < (name || '').length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return DISCIPLINE_COLORS[h % DISCIPLINE_COLORS.length];
}

function DomainesPacificView() {
  const [regs, setRegs] = useState([]);
  const [orgs, setOrgs] = useState([]);
  const [venues, setVenues] = useState([]);
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api('/api/registrations').catch(() => []),
      api('/api/organizations').catch(() => []),
      api('/api/venues').catch(() => []),
      api('/api/animation-slots').catch(() => []),
    ]).then(([r, o, v, s]) => {
      setRegs(Array.isArray(r) ? r : []);
      setOrgs(Array.isArray(o) ? o : []);
      setVenues(Array.isArray(v) ? v : []);
      setSlots(Array.isArray(s) ? s : []);
    }).finally(() => setLoading(false));
  }, []);

  const orgById = Object.fromEntries(orgs.map(o => [o.id, o]));
  const activeVenues = venues.filter(v => v.is_available_2026 !== false);

  // Pour chaque site : agréger par discipline
  const perVenue = activeVenues.map(v => {
    const vregs = regs.filter(r => r.venue_id === v.id && !r.is_waitlist);
    const byDisc = {};
    for (const r of vregs) {
      const o = orgById[r.organization_id];
      const disc = o?.discipline || 'Sans discipline';
      if (!byDisc[disc]) byDisc[disc] = [];
      byDisc[disc].push({ ...o, stand_code: r.stand_code, reg_id: r.id });
    }
    // Tri par taille décroissante
    const sortedDisc = Object.entries(byDisc).sort((a, b) => b[1].length - a[1].length);
    const total = vregs.length;

    // Animations sur ce site
    const vslots = slots.filter(s => {
      const r = regs.find(rr => rr.id === s.registration_id);
      return r?.venue_id === v.id;
    });
    const animVen = vslots.filter(s => s.day_label === 'vendredi').length;
    const animSam = vslots.filter(s => s.day_label === 'samedi').length;
    const animStand = vslots.filter(s => s.location === 'on_stand' || s.is_on_stand).length;
    const animDemo = vslots.filter(s => s.location === 'demo_zone' || s.is_demo_zone).length;

    return { venue: v, sortedDisc, total, animVen, animSam, animStand, animDemo, slotsCount: vslots.length };
  });

  // Vue globale : disciplines toutes éditions confondues
  const globalDisc = {};
  for (const r of regs.filter(r => !r.is_waitlist)) {
    const o = orgById[r.organization_id];
    const disc = o?.discipline || 'Sans discipline';
    globalDisc[disc] = (globalDisc[disc] || 0) + 1;
  }
  const globalSorted = Object.entries(globalDisc).sort((a, b) => b[1] - a[1]);
  const globalTotal = Object.values(globalDisc).reduce((s, n) => s + n, 0);

  if (loading) return <div className="text-center py-8 text-sm text-slate-500"><Loader2 className="w-4 h-4 animate-spin inline mr-1" /> Chargement…</div>;

  return (
    <div className="space-y-4">
      {/* Vue globale */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Activity className="w-4 h-4 text-violet-600" /> Répartition globale par domaine d&apos;activité</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-[11px] text-slate-500">{globalSorted.length} domaines · {globalTotal} exposants</div>
          {/* Stacked bar */}
          <div className="w-full h-4 rounded-full overflow-hidden flex border border-slate-200">
            {globalSorted.map(([disc, count]) => (
              <div
                key={disc}
                className={`${colorForDiscipline(disc)} transition-all hover:opacity-80`}
                style={{ width: `${(count / globalTotal) * 100}%` }}
                title={`${disc} · ${count} exposant${count > 1 ? 's' : ''} (${Math.round((count / globalTotal) * 100)}%)`}
              />
            ))}
          </div>
          {/* Liste classement */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-1 text-[11px]">
            {globalSorted.map(([disc, count]) => (
              <div key={disc} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-50">
                <span className={`w-3 h-3 rounded ${colorForDiscipline(disc)} shrink-0`} />
                <span className="flex-1 truncate text-slate-800" title={disc}>{disc}</span>
                <Badge variant="outline" className="text-[10px]">{count}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Par site */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {perVenue.map(({ venue, sortedDisc, total, animVen, animSam, animStand, animDemo, slotsCount }) => (
          <Card key={venue.id} className="border-slate-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 text-cyan-600" /> {venue.name}
                <Badge variant="outline" className="ml-auto text-[10px]">{total} exposants</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Bar par discipline */}
              {sortedDisc.length === 0 ? (
                <div className="text-xs text-slate-500 italic">Aucun exposant inscrit.</div>
              ) : (
                <>
                  <div className="w-full h-3 rounded-full overflow-hidden flex border border-slate-200">
                    {sortedDisc.map(([disc, list]) => (
                      <div
                        key={disc}
                        className={`${colorForDiscipline(disc)} hover:opacity-80 transition`}
                        style={{ width: `${(list.length / total) * 100}%` }}
                        title={`${disc} · ${list.length} (${Math.round((list.length / total) * 100)}%)`}
                      />
                    ))}
                  </div>

                  {/* Disciplines + associations associées */}
                  <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                    {sortedDisc.map(([disc, list]) => (
                      <details key={disc} className="rounded border border-slate-200 bg-white">
                        <summary className="px-2 py-1 cursor-pointer flex items-center gap-2 hover:bg-slate-50">
                          <span className={`w-2.5 h-2.5 rounded ${colorForDiscipline(disc)} shrink-0`} />
                          <span className="text-xs font-medium text-slate-800 flex-1 truncate">{disc}</span>
                          <Badge variant="outline" className="text-[10px]">{list.length}</Badge>
                        </summary>
                        <ul className="px-3 py-1.5 space-y-0.5 border-t border-slate-100">
                          {list.map(o => (
                            <li key={o.reg_id} className="flex items-center gap-2 text-[11px]">
                              <span className="w-1 h-1 rounded-full bg-slate-400" />
                              <span className="flex-1 truncate text-slate-700" title={o.name}>{o.name || '—'}</span>
                              {o.stand_code && <span className="font-mono text-[10px] text-slate-500">{o.stand_code}</span>}
                            </li>
                          ))}
                        </ul>
                      </details>
                    ))}
                  </div>
                </>
              )}

              {/* Animations résumé */}
              <div className="pt-2 border-t border-slate-100">
                <div className="text-[10px] font-bold text-slate-700 mb-1 uppercase tracking-wide">🎯 Animations programmées</div>
                <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                  <div className="rounded bg-blue-50 border border-blue-200 px-2 py-1 text-center">
                    <div className="text-blue-700 font-bold">{animVen}</div>
                    <div className="text-blue-900">Vendredi</div>
                  </div>
                  <div className="rounded bg-indigo-50 border border-indigo-200 px-2 py-1 text-center">
                    <div className="text-indigo-700 font-bold">{animSam}</div>
                    <div className="text-indigo-900">Samedi</div>
                  </div>
                  <div className="rounded bg-emerald-50 border border-emerald-200 px-2 py-1 text-center">
                    <div className="text-emerald-700 font-bold">{animStand}</div>
                    <div className="text-emerald-900">Sur stand</div>
                  </div>
                  <div className="rounded bg-amber-50 border border-amber-200 px-2 py-1 text-center">
                    <div className="text-amber-700 font-bold">{animDemo}</div>
                    <div className="text-amber-900">Zone démo</div>
                  </div>
                </div>
                <div className="text-[10px] text-slate-500 italic mt-1">{slotsCount} créneau{slotsCount > 1 ? 'x' : ''} au total</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
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
  const [exporting, setExporting] = useState(null);

  useEffect(() => { api('/api/anomalies').then(setAnomalies); api('/api/reports').then(setReports); }, []);

  // 📦 Téléchargements (chaque bouton charge à la demande pour éviter de tout précharger)
  const exportExposants = async () => {
    setExporting('exposants');
    try {
      const rows = await api('/api/registrations');
      exportExposantsCSV(rows);
      toast.success(`${rows.length} exposants exportés ✅`);
    } catch (e) { toast.error(e.message); } finally { setExporting(null); }
  };
  const exportCautions = async () => {
    setExporting('cautions');
    try {
      const rows = await api('/api/registrations');
      exportCautionsCSV(rows);
      toast.success(`${rows.length} cautions exportées ✅`);
    } catch (e) { toast.error(e.message); } finally { setExporting(null); }
  };
  const exportAnimations = async () => {
    setExporting('animations');
    try {
      const rows = await api('/api/animation-slots');
      exportAnimationsCSV(rows);
      toast.success(`${rows.length} animations exportées ✅`);
    } catch (e) { toast.error(e.message); } finally { setExporting(null); }
  };
  const exportSatisfaction = async () => {
    setExporting('satisfaction');
    try {
      const rows = await api('/api/admin/satisfaction-responses').catch(() => []);
      exportSatisfactionCSV(rows);
      toast.success(`${rows.length} réponses exportées ✅`);
    } catch (e) { toast.error(e.message); } finally { setExporting(null); }
  };
  const exportAll = async () => {
    setExporting('all');
    const tId = toast.loading('Génération du ZIP complet…');
    try {
      const [exposants, animations, satisfaction] = await Promise.all([
        api('/api/registrations'),
        api('/api/animation-slots'),
        api('/api/admin/satisfaction-responses').catch(() => []),
      ]);
      await exportAllZIP({ exposants, cautions: exposants, animations, satisfaction });
      toast.success('Archive ZIP complète téléchargée 📦', { id: tId });
    } catch (e) {
      toast.error(`Échec : ${e.message}`, { id: tId });
    } finally { setExporting(null); }
  };

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
      {/* 📦 EXPORTS — Pacific Centers peut télécharger toutes les données */}
      <Card className="border-violet-200 bg-gradient-to-br from-violet-50 to-cyan-50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="w-4 h-4 text-violet-700" /> Exporter les données
          </CardTitle>
          <p className="text-xs text-slate-600 mt-1">Téléchargez les données du Forum 2026 au format CSV (Excel-compatible). Pour tout obtenir en une fois, utilisez le ZIP complet.</p>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-5 gap-2">
          <Button variant="outline" onClick={exportExposants} disabled={!!exporting} className="gap-1 justify-start text-xs">
            {exporting === 'exposants' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Users className="w-3.5 h-3.5 text-blue-600" />}
            Exposants
          </Button>
          <Button variant="outline" onClick={exportCautions} disabled={!!exporting} className="gap-1 justify-start text-xs">
            {exporting === 'cautions' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wallet className="w-3.5 h-3.5 text-emerald-600" />}
            Cautions
          </Button>
          <Button variant="outline" onClick={exportAnimations} disabled={!!exporting} className="gap-1 justify-start text-xs">
            {exporting === 'animations' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Calendar className="w-3.5 h-3.5 text-orange-600" />}
            Animations
          </Button>
          <Button variant="outline" onClick={exportSatisfaction} disabled={!!exporting} className="gap-1 justify-start text-xs">
            {exporting === 'satisfaction' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-amber-600" />}
            Satisfaction
          </Button>
          <Button onClick={exportAll} disabled={!!exporting} className="gap-1 justify-start text-xs bg-violet-700 hover:bg-violet-800 text-white">
            {exporting === 'all' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5" />}
            ZIP complet
          </Button>
        </CardContent>
      </Card>

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
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-4 h-4 text-violet-600" /> Bilans & comptes-rendus partagés par ARACOM
          </CardTitle>
          <p className="text-xs text-slate-500 mt-1">Seuls les rapports explicitement partagés par ARACOM sont visibles ici. Pour toute demande de bilan supplémentaire, contactez agence@aracom-conseil.fr.</p>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-y text-left text-xs uppercase text-slate-500"><tr><th className="py-2 px-4">Type</th><th>Portée</th><th>Statut</th><th>Date</th><th></th></tr></thead>
            <tbody className="divide-y">
              {reports.length === 0 ? <tr><td colSpan="5" className="py-8 text-center text-slate-400">📋 Aucun bilan partagé pour l&apos;instant.<br /><span className="text-xs">ARACOM partagera ici les comptes-rendus dès qu&apos;ils seront finalisés.</span></td></tr> : reports.map(r => (
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

// ============ PROSPECTION VIEW ============
// Statuts possibles : à contacter → contacté → intéressé → converti (ou refusé/abandonné)
const PROSPECT_STATUS = [
  { value: 'a_contacter', label: 'À contacter', color: 'bg-slate-100 text-slate-700 border-slate-200' },
  { value: 'contacte', label: 'Contacté', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { value: 'interesse', label: 'Intéressé', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  { value: 'converti', label: '✓ Converti (exposant)', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { value: 'refuse', label: 'Refusé', color: 'bg-rose-100 text-rose-700 border-rose-200' },
  { value: 'abandonne', label: 'Abandonné', color: 'bg-slate-100 text-slate-500 border-slate-200' },
];

function ProspectionView() {
  const [prospects, setProspects] = useState([]);
  const [stats, setStats] = useState(null);
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [venueFilter, setVenueFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [detailProspect, setDetailProspect] = useState(null);

  const reload = async () => {
    setLoading(true);
    try {
      const [p, s, v] = await Promise.all([api('/api/prospects'), api('/api/prospects/stats'), api('/api/venues')]);
      setProspects(p); setStats(s); setVenues(v);
    } catch (e) { toast.error(e.message); }
    setLoading(false);
  };
  useEffect(() => { reload(); }, []);

  const filtered = prospects.filter(p => {
    if (statusFilter !== 'all' && p.status !== statusFilter) return false;
    if (venueFilter !== 'all' && p.venue_id !== venueFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      if (!(p.organization_name?.toLowerCase().includes(s) || p.contact_name?.toLowerCase().includes(s) || p.contact_email?.toLowerCase().includes(s))) return false;
    }
    return true;
  });

  const deleteProspect = async (p) => {
    if (!confirm(`Supprimer définitivement le prospect "${p.organization_name}" ?`)) return;
    try { await api(`/api/prospects/${p.id}`, { method: 'DELETE' }); toast.success('Prospect supprimé'); reload(); }
    catch (e) { toast.error(e.message); }
  };

  const convertProspect = async (p) => {
    if (!confirm(`Convertir "${p.organization_name}" en exposant officiel ?\n\nCela créera une inscription pré-réservée liée à ce prospect.`)) return;
    try {
      const r = await api(`/api/prospects/${p.id}/convert`, { method: 'POST', body: JSON.stringify({}) });
      toast.success(`✅ Prospect converti — nouvelle inscription créée (id: ${r.registration_id.slice(0,8)}…)`);
      reload();
    } catch (e) { toast.error(e.message); }
  };

  return (
    <div className="space-y-4">
      <HelpCard
        title="Signification des 6 statuts de prospection"
        definitions={PROSPECT_STATUS_DEFINITIONS}
        storageKey="fr26_help_prospect_pacific"
      />
      {/* KPIs prospection */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <KpiCard label="Total prospects" value={stats.total} accent="violet" icon={Target} />
          <KpiCard label="Contactés" value={stats.contacted} accent="blue" icon={Phone} />
          <KpiCard label="Intéressés" value={stats.by_status.interesse} accent="orange" icon={Sparkles} />
          <KpiCard label="Convertis" value={stats.converted} accent="emerald" icon={CheckCircle2} />
          <Card className="border-2 border-violet-200 bg-gradient-to-br from-violet-50 to-fuchsia-50">
            <CardContent className="p-4">
              <div className="text-xs uppercase text-violet-700 font-semibold flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Taux conversion</div>
              <div className="text-3xl font-extrabold text-violet-900 mt-1">{stats.conversion_rate_pct}%</div>
              <div className="text-[11px] text-slate-500 mt-0.5">{stats.converted} / {stats.total} prospects</div>
              {stats.contacted > 0 && <div className="text-[11px] text-slate-600 mt-1">Sur contactés : <b>{stats.contact_to_conversion_pct}%</b></div>}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Toolbar + filtres */}
      <Card>
        <CardContent className="p-3 flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-[180px]">
            <Label className="text-[10px] uppercase text-slate-500">Recherche</Label>
            <Input placeholder="Nom org., contact, email…" value={search} onChange={e => setSearch(e.target.value)} className="h-9 mt-1" />
          </div>
          <div className="w-[180px]">
            <Label className="text-[10px] uppercase text-slate-500">Statut</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous statuts</SelectItem>
                {PROSPECT_STATUS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="w-[180px]">
            <Label className="text-[10px] uppercase text-slate-500">Site</Label>
            <Select value={venueFilter} onValueChange={setVenueFilter}>
              <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous sites</SelectItem>
                {venues.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => { setEditing(null); setShowForm(true); }} className="gap-1.5 bg-violet-600 hover:bg-violet-700">
            <Plus className="w-4 h-4" /> Nouveau prospect
          </Button>
        </CardContent>
      </Card>

      {/* Liste */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {loading ? (
            <div className="py-12 text-center text-slate-500">Chargement…</div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-slate-500">
              <Target className="w-12 h-12 mx-auto mb-2 text-slate-300" />
              Aucun prospect. Cliquez sur <b>Nouveau prospect</b> pour commencer votre suivi.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-2 px-3">Organisation</th>
                  <th>Contact</th>
                  <th>Site</th>
                  <th>Statut</th>
                  <th>Notes</th>
                  <th>MàJ</th>
                  <th className="pr-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map(p => {
                  const statusDef = PROSPECT_STATUS.find(s => s.value === p.status) || PROSPECT_STATUS[0];
                  return (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="py-2 px-3">
                        <div className="font-medium">{p.organization_name || '—'}</div>
                        {p.discipline && <div className="text-[11px] text-slate-500">{p.discipline}</div>}
                      </td>
                      <td className="text-xs">
                        <div>{p.contact_name || '—'}</div>
                        {p.contact_email && <div className="text-slate-500 flex items-center gap-1"><Mail className="w-3 h-3" />{p.contact_email}</div>}
                        {p.contact_phone && <div className="text-slate-500 flex items-center gap-1"><Phone className="w-3 h-3" />{p.contact_phone}</div>}
                      </td>
                      <td className="text-xs">{p.venue_name || '—'}</td>
                      <td>
                        <Select value={p.status} onValueChange={async v => { await api(`/api/prospects/${p.id}`, { method: 'PUT', body: JSON.stringify({ status: v }) }); toast.success('Statut mis à jour'); reload(); }}>
                          <SelectTrigger className={`h-8 w-[170px] border text-xs ${statusDef.color}`}><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {PROSPECT_STATUS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="text-xs">
                        <button onClick={() => setDetailProspect(p)} className="text-blue-600 hover:underline flex items-center gap-1">
                          <MessageSquare className="w-3 h-3" /> {p.notes?.length || 0} note(s)
                        </button>
                      </td>
                      <td className="text-[11px] text-slate-500">{new Date(p.updated_at).toLocaleDateString('fr-FR')}</td>
                      <td className="pr-3">
                        <div className="flex gap-1 justify-end">
                          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => { setEditing(p); setShowForm(true); }} title="Éditer">✏️</Button>
                          {p.status !== 'converti' && <Button size="sm" variant="ghost" className="h-7 px-2 text-emerald-600 hover:bg-emerald-50" onClick={() => convertProspect(p)} title="Convertir en exposant"><CheckCircle2 className="w-4 h-4" /></Button>}
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-rose-600 hover:bg-rose-50" onClick={() => deleteProspect(p)} title="Supprimer"><Trash2 className="w-4 h-4" /></Button>
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

      {/* Formulaire nouveau/édition */}
      <ProspectFormDialog open={showForm} onClose={() => { setShowForm(false); setEditing(null); }} prospect={editing} venues={venues} onSaved={reload} />
      {/* Panel détail + notes */}
      <ProspectDetailDialog open={!!detailProspect} prospect={detailProspect} onClose={() => setDetailProspect(null)} onChanged={reload} />
    </div>
  );
}

function ProspectFormDialog({ open, onClose, prospect, venues, onSaved }) {
  const [form, setForm] = useState({ venue_id: '', organization_name: '', contact_name: '', contact_email: '', contact_phone: '', discipline: '', status: 'a_contacter', initial_note: '' });
  useEffect(() => {
    if (prospect) {
      setForm({
        venue_id: prospect.venue_id || '',
        organization_name: prospect.organization_name || '',
        contact_name: prospect.contact_name || '',
        contact_email: prospect.contact_email || '',
        contact_phone: prospect.contact_phone || '',
        discipline: prospect.discipline || '',
        status: prospect.status || 'a_contacter',
        initial_note: '',
      });
    } else {
      setForm({ venue_id: '', organization_name: '', contact_name: '', contact_email: '', contact_phone: '', discipline: '', status: 'a_contacter', initial_note: '' });
    }
  }, [prospect, open]);

  const save = async () => {
    if (!form.organization_name.trim()) { toast.error("Nom de l'organisation requis"); return; }
    try {
      if (prospect) {
        const upd = { ...form }; delete upd.initial_note;
        await api(`/api/prospects/${prospect.id}`, { method: 'PUT', body: JSON.stringify(upd) });
        toast.success('Prospect mis à jour');
      } else {
        await api('/api/prospects', { method: 'POST', body: JSON.stringify(form) });
        toast.success('Prospect créé');
      }
      onClose(); onSaved();
    } catch (e) { toast.error(e.message); }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{prospect ? 'Modifier le prospect' : 'Nouveau prospect'}</DialogTitle>
          <DialogDescription>Suivez vos actions de prospection d&apos;exposants potentiels.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs uppercase text-slate-500">Nom de l&apos;organisation *</Label>
            <Input className="mt-1" value={form.organization_name} onChange={e => setForm({ ...form, organization_name: e.target.value })} placeholder="Ex: Club Sportif Pirae" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs uppercase text-slate-500">Nom contact</Label>
              <Input className="mt-1" value={form.contact_name} onChange={e => setForm({ ...form, contact_name: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs uppercase text-slate-500">Discipline</Label>
              <Input className="mt-1" value={form.discipline} onChange={e => setForm({ ...form, discipline: e.target.value })} placeholder="Danse, Sport, Art…" />
            </div>
            <div>
              <Label className="text-xs uppercase text-slate-500">Email</Label>
              <Input className="mt-1" type="email" value={form.contact_email} onChange={e => setForm({ ...form, contact_email: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs uppercase text-slate-500">Téléphone</Label>
              <Input className="mt-1" value={form.contact_phone} onChange={e => setForm({ ...form, contact_phone: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs uppercase text-slate-500">Site pressenti</Label>
              <Select value={form.venue_id} onValueChange={v => setForm({ ...form, venue_id: v })}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Aucun" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Aucun —</SelectItem>
                  {venues.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs uppercase text-slate-500">Statut</Label>
              <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PROSPECT_STATUS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          {!prospect && (
            <div>
              <Label className="text-xs uppercase text-slate-500">Première note (optionnel)</Label>
              <textarea className="mt-1 w-full border rounded-md p-2 text-sm resize-y min-h-[60px]" value={form.initial_note} onChange={e => setForm({ ...form, initial_note: e.target.value })} placeholder="Ex: Première prise de contact par téléphone le 12/05" />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={save} className="bg-violet-600 hover:bg-violet-700">{prospect ? 'Enregistrer' : 'Créer le prospect'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProspectDetailDialog({ open, prospect, onClose, onChanged }) {
  const [newNote, setNewNote] = useState('');
  const [current, setCurrent] = useState(prospect);
  useEffect(() => { setCurrent(prospect); setNewNote(''); }, [prospect, open]);

  const addNote = async () => {
    if (!newNote.trim()) return;
    try {
      const r = await api(`/api/prospects/${current.id}/notes`, { method: 'POST', body: JSON.stringify({ text: newNote.trim() }) });
      setCurrent(r); setNewNote('');
      toast.success('Note ajoutée');
      onChanged();
    } catch (e) { toast.error(e.message); }
  };
  if (!current) return null;
  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{current.organization_name}</DialogTitle>
          <DialogDescription>{current.contact_name} · {current.contact_email} · {current.venue_name || 'Site non défini'}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 max-h-[50vh] overflow-y-auto">
          {(current.notes || []).slice().reverse().map((n, i) => (
            <div key={i} className="border-l-4 border-violet-200 bg-violet-50 p-3 rounded-r text-sm">
              <div className="text-[11px] text-slate-500 mb-1">📅 {new Date(n.at).toLocaleString('fr-FR')}</div>
              <div className="whitespace-pre-wrap">{n.text}</div>
            </div>
          ))}
          {(!current.notes || current.notes.length === 0) && <div className="text-center text-slate-500 py-6">Aucune note. Ajoutez-en une ci-dessous.</div>}
        </div>
        <div className="border-t pt-3 space-y-2">
          <Label className="text-xs uppercase text-slate-500">Nouvelle note</Label>
          <textarea className="w-full border rounded-md p-2 text-sm resize-y min-h-[80px]" value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="Ex: Relance effectuée, attend retour équipe…" />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Fermer</Button>
            <Button onClick={addNote} disabled={!newNote.trim()} className="bg-violet-600 hover:bg-violet-700">Ajouter la note</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

'use client';

import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { Shell, KpiCard } from '@/components/app-shell';
import HelpCard from '@/components/help-card';
import AiInsightTrigger from '@/components/ai-insight-trigger';
import { ChatbotFloating, ChatbotCard } from '@/components/chatbot-widget';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Users, MapPin, FileCheck2, Wallet, AlertTriangle, AlertCircle, Send, Search, FileText, RefreshCw, RotateCcw, CheckCircle2, XCircle, Clock, Building2, Smartphone, Mail, Phone, Lock, Activity, Sparkles, Download, Trash2, Move, Plus, KeyRound, ThumbsUp, Star, Smile, MessageCircle, Calendar, Zap, Printer, Eye, TrendingUp, Ban, Music, Filter } from 'lucide-react';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, LineChart, Line, AreaChart, Area, CartesianGrid } from 'recharts';
import { REGISTRATION_STATUS, REGISTRATION_STATUS_LABEL, REGISTRATION_STATUS_COLOR, PRIORITY_LEVELS, PRIORITY_DEFINITIONS, PROSPECT_STATUS_DEFINITIONS, DEPOSIT_STATUS, DEPOSIT_STATUS_LABEL, DISCIPLINES, DEPOSIT_AMOUNT_XPF, DOCUMENT_TYPES, DOCUMENT_TYPE_LABEL } from '@/lib/constants';
import { FileUploadButton } from '@/components/file-upload';
import SmartVenueMap from '@/components/smart-venue-map';
import { exportExposantsCSV, exportCautionsCSV, exportSatisfactionCSV } from '@/lib/csv-export';
import { exportFullXLSX } from '@/lib/xlsx-export';
import PushToggle from '@/components/push-toggle';
import PortalSwitcher from '@/components/portal-switcher';
import MultiSiteCockpit from '@/components/multi-site-cockpit';
import StatusLegend from '@/components/status-legend';
import BulkExportDialog from '@/components/bulk-export-dialog';
import AdminOverridePanel from '@/components/aracom/admin-override-panel';
import ChoixForumSummary from '@/components/aracom/choix-forum-summary';
import SendExposantMailDialog from '@/components/aracom/send-exposant-mail-dialog';
import EditExposantChoicesDialog from '@/components/aracom/edit-exposant-choices-dialog';
import FicheExposantV2 from '@/components/aracom/fiche-exposant-v2';
import ExposantsListView from '@/components/aracom/exposants-list-view';
import CorbeilleView from '@/components/aracom/corbeille-view';
import OrgsSansDossierView from '@/components/aracom/orgs-sans-dossier-view';
import CautionAppointmentsAdminPanel from '@/components/aracom/caution-appointments-panel';
import { ExposantPanelProvider, useExposantPanel, ExposantLink } from '@/components/aracom/exposant-panel-context';
import AnomaliesView from '@/components/aracom/anomalies-view';
import ProspectionAracomView from '@/components/aracom/prospection-view';
import OfficialDocumentsView from '@/components/aracom/official-documents-view';
import AccessTokensView from '@/components/aracom/access-tokens-view';
import BackupView from '@/components/aracom/backup-view';
import ImportExcelView from '@/components/aracom/import-excel-view';
import DeadlinesView from '@/components/aracom/deadlines-view';
import ValidationsView from '@/components/aracom/validations-view';
import MailingView from '@/components/aracom/mailing-view';
import BilansView from '@/components/aracom/bilans-view';
import RelancesView from '@/components/aracom/relances-view';
import DashboardView from '@/components/aracom/dashboard-view';
import SatisfactionAdminView, { ConfirmedExposantsPanel } from '@/components/aracom/satisfaction-admin-view';

// 🎨 SESSION 29 — Menus intelligents : 6 groupes accordéon cohérents, Exposants en tête
//    • Renaming : libellés explicites (ex: "Liste exposants" → "Liste & fiches")
//    • Icônes Lucide harmonisées pour chaque item (cohérence visuelle)
//    • Items "admin" séparés visuellement (adminTool:true → divider + section "Outils admin" dans le dropdown)
const TABS = [
  { key: 'dashboard', label: 'Tableau de bord', icon: 'LayoutDashboard', href: '/aracom' },
  // — Exposants (cœur métier) —
  { key: 'exposants', label: 'Liste & fiches', icon: 'Users', href: '/aracom?tab=exposants' },
  { key: 'cautions', label: 'Cautions & restitutions', icon: 'Wallet', href: '/aracom?tab=cautions' },
  { key: 'relances', label: 'Relances IA', icon: 'Bell', href: '/aracom?tab=relances' },
  { key: 'validations', label: 'Validations dossiers', icon: 'ClipboardCheck', href: '/aracom?tab=validations' },
  { key: 'prospection', label: 'Prospection', icon: 'Target', href: '/aracom?tab=prospection' },
  { key: 'orgs-sans-dossier', label: 'Comptes orphelins', icon: 'AlertTriangle', href: '/aracom?tab=orgs-sans-dossier', adminTool: true },
  { key: 'corbeille', label: 'Corbeille', icon: 'Trash2', href: '/aracom?tab=corbeille', adminTool: true },
  // — Terrain —
  { key: 'sites', label: 'Sites & stands', icon: 'MapPin', href: '/aracom?tab=sites' },
  { key: 'animations', label: 'Animations & créneaux', icon: 'Sparkles', href: '/aracom?tab=animations' },
  { key: 'anomalies', label: 'Anomalies terrain', icon: 'AlertCircle', href: '/aracom?tab=anomalies' },
  // — Communication —
  { key: 'mailing', label: 'Mailing & campagnes', icon: 'Mail', href: '/aracom?tab=mailing' },
  { key: 'documents-officiels', label: 'Documents officiels', icon: 'FileText', href: '/aracom?tab=documents-officiels' },
  { key: 'access', label: 'Liens magic-link', icon: 'Link2', href: '/aracom?tab=access' },
  // — Pilotage —
  { key: 'bilans', label: 'Bilans & stats', icon: 'BarChart3', href: '/aracom?tab=bilans' },
  { key: 'deadlines', label: 'Échéances', icon: 'Clock', href: '/aracom?tab=deadlines' },
  { key: 'satisfaction', label: 'Satisfaction & feedback', icon: 'Star', href: '/aracom?tab=satisfaction' },
  // — Système (outils admin) —
  { key: 'import', label: 'Import Excel', icon: 'Upload', href: '/aracom?tab=import', adminTool: true },
  { key: 'backup', label: 'Sauvegarde DB', icon: 'Database', href: '/aracom?tab=backup', adminTool: true },
];

// 🎯 Regroupement intelligent en 6 catégories (Exposants en 1er groupe — cœur métier)
const TAB_GROUPS = [
  { key: 'dashboard', label: 'Tableau de bord', icon: 'LayoutDashboard', single: true },
  {
    key: 'exposants_grp',
    label: 'Exposants',
    icon: 'Users',
    items: ['exposants', 'cautions', 'relances', 'validations', 'prospection', 'orgs-sans-dossier', 'corbeille'],
  },
  {
    key: 'terrain',
    label: 'Terrain',
    icon: 'MapPin',
    items: ['sites', 'animations', 'anomalies'],
  },
  {
    key: 'communication',
    label: 'Communication',
    icon: 'Mail',
    items: ['mailing', 'documents-officiels', 'access'],
  },
  {
    key: 'pilotage',
    label: 'Pilotage',
    icon: 'Compass',
    items: ['bilans', 'deadlines', 'satisfaction'],
  },
  {
    key: 'systeme',
    label: 'Système',
    icon: 'Settings',
    items: ['import', 'backup'],
  },
];

// ============================================================
// 🌐 EXPOSANT PANEL CONTEXT — déplacé dans /components/aracom/exposant-panel-context.jsx
// ============================================================
// (ExposantPanelContext, ExposantPanelProvider, useExposantPanel, ExposantLink importés ci-dessus)

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
  const setTab = (k, extraParams) => {
    setActiveTab(k);
    const base = k === 'dashboard' ? '/aracom' : `/aracom?tab=${k}`;
    let url = base;
    if (extraParams && typeof extraParams === 'object') {
      const sp = new URLSearchParams();
      if (k !== 'dashboard') sp.set('tab', k);
      Object.entries(extraParams).forEach(([key, val]) => { if (val != null) sp.set(key, String(val)); });
      url = `/aracom?${sp.toString()}`;
    }
    window.history.pushState({}, '', url);
  };

  const tabs = TABS.map(t => ({ ...t, href: '#', onClick: () => setTab(t.key) }));

  return (
    <ExposantPanelProvider renderPanel={(id, close) => <FicheExposantV2 id={id} onClose={close} />}>
      <Shell
      title="Cockpit ARACOM"
      subtitle={<AracomBriefing />}
      allowedRoles={['aracom_admin']}
      activeTab={activeTab}
      tabs={TABS.map(t => ({ ...t, onClick: () => setTab(t.key) }))}
      tabGroups={TAB_GROUPS}
      onTabClick={setTab}
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
          <PortalSwitcher />
          <PushToggle />
          <AlertsBadge onGoto={setTab} />
          <Link href="/jour-j"><Button className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 gap-2"><Smartphone className="w-4 h-4" /> Mode Jour J</Button></Link>
        </div>
      }
    >
      {activeTab === 'dashboard' && <DashboardView onGoto={setTab} />}
      {activeTab === 'cockpit-multi' && <MultiSiteCockpit />}
      {activeTab === 'prospection' && <ProspectionAracomView />}
      {activeTab === 'documents-officiels' && <OfficialDocumentsView />}
      {activeTab === 'deadlines' && <DeadlinesView />}
      {activeTab === 'exposants' && <ExposantsListView />}
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
      {activeTab === 'animations' && <AnimationsView />}
      {activeTab === 'import' && <ImportExcelView />}
      {activeTab === 'corbeille' && <CorbeilleView />}
      {activeTab === 'orgs-sans-dossier' && <OrgsSansDossierView />}
      <ChatbotFloating role="aracom_admin" />
    </Shell>
    </ExposantPanelProvider>
  );
}

// 📊 BRIEFING DYNAMIQUE — synthèse en 3 colonnes (Fait / Reste à faire / Vigilance)
// Affiché en sous-titre du Cockpit ARACOM. Données calculées en temps réel côté backend.
function AracomBriefing() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api('/api/dashboard/briefing');
      setData(r);
    } catch (e) {
      console.error('[briefing]', e?.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
    // Auto-refresh toutes les 5 minutes
    const t = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(t);
  }, []);

  const renderItems = (items) => (
    <ul className="space-y-1.5 text-[13px]">
      {items.map((it, i) => (
        <li key={i} className="leading-snug" dangerouslySetInnerHTML={{
          __html: it.replace(/\*\*(.+?)\*\*/g, '<b class="font-semibold">$1</b>')
        }} />
      ))}
    </ul>
  );

  if (loading && !data) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
        ⏳ Chargement du briefing temps réel…
      </div>
    );
  }
  if (!data) return null;

  return (
    <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-4 py-2.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-white min-w-0">
          <span className="text-base shrink-0">📊</span>
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate">Briefing temps réel · Cockpit ARACOM</div>
            <div className="text-[11px] opacity-70 truncate">
              Forum de la Rentrée 2026 · J-{data.days_to_event} · Mis à jour {new Date(data.generated_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            size="sm"
            variant="ghost"
            className="text-white hover:bg-white/10 h-7 px-2 text-[11px]"
            onClick={load}
            disabled={loading}
            title="Recalculer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-white hover:bg-white/10 h-7 px-2 text-[11px]"
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? 'Développer' : 'Réduire'}
          >
            <span className={`text-[10px] inline-block transition-transform ${collapsed ? '-rotate-90' : ''}`}>▼</span>
          </Button>
        </div>
      </div>

      {/* Body — 3 colonnes */}
      {!collapsed && (
        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-200">
          {/* FAIT */}
          <div className="p-4">
            <div className="flex items-center gap-2 mb-2.5 pb-2 border-b border-emerald-100">
              <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-sm font-bold">✓</div>
              <div>
                <div className="text-xs font-bold text-emerald-800 uppercase tracking-wide">Ce qui est fait</div>
                <div className="text-[10px] text-slate-500">{data.sections.fait.length} jalons franchis</div>
              </div>
            </div>
            {data.sections.fait.length > 0
              ? renderItems(data.sections.fait)
              : <div className="text-xs text-slate-400 italic">Aucun jalon enregistré pour le moment.</div>
            }
          </div>

          {/* RESTE */}
          <div className="p-4 bg-amber-50/30">
            <div className="flex items-center gap-2 mb-2.5 pb-2 border-b border-amber-200">
              <div className="w-7 h-7 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-sm font-bold">→</div>
              <div>
                <div className="text-xs font-bold text-amber-800 uppercase tracking-wide">Ce qu&apos;il reste à faire</div>
                <div className="text-[10px] text-slate-500">{data.sections.reste.length} actions ouvertes</div>
              </div>
            </div>
            {data.sections.reste.length > 0
              ? renderItems(data.sections.reste)
              : <div className="text-xs text-emerald-600 italic">🎉 Tout est en ordre !</div>
            }
          </div>

          {/* VIGILANCE */}
          <div className="p-4 bg-red-50/30">
            <div className="flex items-center gap-2 mb-2.5 pb-2 border-b border-red-200">
              <div className="w-7 h-7 rounded-full bg-red-100 text-red-700 flex items-center justify-center text-sm font-bold">!</div>
              <div>
                <div className="text-xs font-bold text-red-800 uppercase tracking-wide">Points de vigilance</div>
                <div className="text-[10px] text-slate-500">{data.sections.vigilance.length} alerte(s)</div>
              </div>
            </div>
            {renderItems(data.sections.vigilance)}
          </div>
        </div>
      )}
    </div>
  );
}


function ExposantsView() {
  const [rows, setRows] = useState([]);
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ venue_id: '', status: '', priority: '', discipline: '', search: '' });
  const [showNew, setShowNew] = useState(false);
  const [showBulkExport, setShowBulkExport] = useState(false);
  const { open: openExposant, refreshTrigger } = useExposantPanel();

  // 🛡️ SESSION 28r — Compteur de requêtes pour ignorer les réponses obsolètes
  //     (sinon, en cas de filter rapide, l'ancienne réponse écrase la nouvelle → exposants qui clignotent)
  const loadSeqRef = useRef(0);

  // 🔗 Ouvre directement la fiche si un registration_id est passé dans l'URL (?open=...)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const openId = new URLSearchParams(window.location.search).get('open');
    if (openId) {
      openExposant(openId);
      // Nettoie le param pour éviter de rouvrir en boucle sur refresh
      const url = new URL(window.location.href);
      url.searchParams.delete('open');
      window.history.replaceState({}, '', url.toString());
    }
  }, []);

  const load = async () => {
    const seq = ++loadSeqRef.current;
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      Object.entries(filters).forEach(([k, v]) => { if (v) qs.set(k, v); });
      // 🛡️ Cache-buster pour les navigateurs récalcitrants (Safari iOS notamment)
      qs.set('_t', Date.now().toString());
      const [r, v] = await Promise.all([api('/api/registrations?' + qs.toString()), api('/api/venues')]);
      // 🛡️ Si une requête plus récente est partie entretemps, on ignore cette réponse
      if (seq !== loadSeqRef.current) return;
      setRows(r); setVenues(v);
    } catch (e) {
      if (seq === loadSeqRef.current) toast.error(e.message);
    }
    if (seq === loadSeqRef.current) setLoading(false);
  };
  useEffect(() => { load(); }, [filters]);
  // Recharge après fermeture d'une fiche pour répercuter les modifications
  useEffect(() => { if (refreshTrigger) load(); }, [refreshTrigger]);

  // 🆕 SESSION 28r — Après création d'un nouvel exposant, on reset les filtres ET on attend
  //     que le DB soit bien committé avant de recharger (évite les exposants qui clignotent)
  const handleCreated = async () => {
    setShowNew(false);
    // Reset filtres pour s'assurer que le nouvel exposant est bien visible
    // (status par défaut = 'contacte', donc si l'utilisateur filtre par confirmé, il ne le verrait pas)
    setFilters({ venue_id: '', status: '', priority: '', discipline: '', search: '' });
    // Petit delay pour laisser le temps au backend de commit + au state de se mettre à jour
    await new Promise((r) => setTimeout(r, 250));
    await load();
    toast.info('✅ Liste rafraîchie — le nouvel exposant doit apparaître maintenant');
  };

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
              <Button size="sm" onClick={() => setShowBulkExport(true)} className="gap-2 bg-orange-600 hover:bg-orange-700 text-white"><FileText className="w-3.5 h-3.5" /> Export PDFs (Conventions / Reçus)</Button>
            </div>
          </div>
        </CardContent>
      </Card>
      {showNew && <NewExposantDialog venues={venues} onClose={() => setShowNew(false)} onCreated={handleCreated} />}

      <BulkExportDialog
        open={showBulkExport}
        onOpenChange={setShowBulkExport}
        rows={rows.map(r => ({
          id: r.id,
          org_name: r.organization?.name || '',
          venue_id: r.venue_id,
          venue_name: r.venue?.name || '',
          stand_code: r.stand_code || '',
        }))}
        venues={venues}
      />

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
                <tr key={r.id} className="hover:bg-slate-50 cursor-pointer" onClick={(e) => { if (e.target.closest('button,a,input,[role="checkbox"]')) return; openExposant(r.id); }}>
                  <td className="py-2.5 px-4">
                    <div className="flex items-center gap-2">
                      <AiInsightTrigger registration={r} size="xs" />
                      <div>
                        <ExposantLink id={r.id} className="font-medium text-slate-900">{r.organization?.name}</ExposantLink>
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
                  <td className="px-2 text-right"><Button size="sm" variant="ghost" onClick={() => openExposant(r.id)}>Ouvrir</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* FicheExposant maintenant rendu globalement via ExposantPanelProvider — pas besoin ici */}
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
  const [showSendMailDialog, setShowSendMailDialog] = useState(false);
  const [showEditChoicesDialog, setShowEditChoicesDialog] = useState(false);

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

  // 🔗 Génère + copie le magic link de l'exposant (remplace l'ancien reset password)
  const copyAccessLink = async () => {
    const orgId = data.registration?.organization_id;
    if (!orgId) { toast.error('Aucun exposant lié'); return; }
    try {
      const res = await api('/api/access-tokens', {
        method: 'POST',
        body: JSON.stringify({ organization_id: orgId, purpose: 'access', send_email: false }),
      });
      if (res?.access_url) {
        try { await navigator.clipboard?.writeText(res.access_url); toast.success('🔗 Lien d\'accès copié dans le presse-papier'); }
        catch { toast.success(`Lien d'accès : ${res.access_url}`); }
      }
    } catch (e) { toast.error(e.message); }
  };

  const sendAccessLinkEmail = async () => {
    const orgId = data.registration?.organization_id;
    if (!orgId) { toast.error('Aucun exposant lié'); return; }
    try {
      const res = await api('/api/access-tokens', {
        method: 'POST',
        body: JSON.stringify({ organization_id: orgId, purpose: 'access', send_email: true, force: false }),
      });
      if (res?.email_sent) toast.success('📧 Email envoyé à l\'exposant avec son lien d\'accès');
      else toast.info(res?.message || 'Lien réutilisé (email non renvoyé — cooldown)');
    } catch (e) { toast.error(e.message); }
  };

  // 🧠 Calcul de la prochaine action évidente
  const nextAction = useMemo(() => {
    if (!data) return null;
    const r = data.registration || {};
    const dep = data.deposit || {};
    const docs = data.documents || [];
    const slots = data.slots || [];

    if (r.status === 'confirme' && dep.status === 'recue' && r.is_insurance_uploaded && r.is_convention_signed) {
      return { kind: 'done', label: '✅ Dossier complet et confirmé', tone: 'emerald' };
    }
    if (r.status !== 'confirme' && dep.status === 'recue' && r.is_insurance_uploaded && r.is_convention_signed) {
      return { kind: 'confirm', label: 'Tout est en règle — Confirmer l\'inscription', cta: 'Confirmer maintenant', tone: 'emerald', action: confirmReg };
    }
    if (!r.is_insurance_uploaded && docs.filter(d => d.document_type === 'attestation_assurance').length === 0) {
      return { kind: 'reminder_insurance', label: 'Attestation d\'assurance manquante', cta: '✨ Envoyer un rappel IA', tone: 'amber', step: 'documents' };
    }
    if (!r.is_convention_signed) {
      return { kind: 'reminder_convention', label: 'Convention non signée', cta: '✨ Envoyer un rappel IA', tone: 'amber', step: 'convention' };
    }
    if (dep.status !== 'recue') {
      return { kind: 'reminder_caution', label: 'Caution 20 000 XPF non encaissée', cta: '✨ Envoyer un rappel IA', tone: 'orange', step: 'caution' };
    }
    if (slots.length === 0) {
      return { kind: 'reminder_animation', label: 'Aucun créneau d\'animation choisi', cta: '✨ Envoyer un rappel IA', tone: 'blue', step: 'animation' };
    }
    if (r.status === 'a_relancer') {
      return { kind: 'reminder_followup', label: 'Statut "À relancer" — relance recommandée', cta: '✨ Envoyer un rappel IA', tone: 'rose', step: 'profile' };
    }
    return { kind: 'idle', label: 'Aucune action urgente — surveiller la complétion du dossier', tone: 'slate' };
  }, [data]);

  return (
    <Sheet open={true} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        {loading || !data ? <div className="py-10 text-center text-slate-500">Chargement…</div> : (
          <div className="space-y-5">
            <SheetHeader>
              <SheetTitle className="text-xl">{data.organization?.name}</SheetTitle>
              <SheetDescription>{data.organization?.discipline} • <PrioBadge p={data.organization?.priority_level} /> • <span className="font-mono">{data.registration?.stand_code}</span> • {data.venue?.name}</SheetDescription>
            </SheetHeader>

            {/* 🆕 RÉSUMÉ CHOIX FORUM — Stand + Animations en un coup d'œil */}
            <ChoixForumSummary data={data} />

            {/* 🛠 ACTIONS ADMIN OVERRIDE — modifier/annuler/supprimer toute action de l'exposant */}
            <AdminOverridePanel data={data} onReload={load} onClose={onClose} />

            {/* ✉️ COMMUNICATION & ÉDITION RAPIDE — Envoyer mail / Modifier choix */}
            <div className="rounded-md border-2 border-blue-200 bg-blue-50/40 p-3">
              <div className="font-bold text-blue-900 text-sm mb-2 flex items-center gap-2">
                ✉️ Communication & édition rapide
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowSendMailDialog(true)}
                  disabled={!data.organization?.main_email}
                  className="bg-white border-blue-300 text-blue-700 hover:bg-blue-50 h-8 text-xs gap-1.5"
                  data-testid="fiche-send-mail-btn"
                >
                  <Mail className="w-3 h-3" /> 📧 Envoyer un mail
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowEditChoicesDialog(true)}
                  className="bg-white border-violet-300 text-violet-700 hover:bg-violet-50 h-8 text-xs gap-1.5"
                  data-testid="fiche-edit-choices-btn"
                >
                  ✏️ Modifier les choix
                </Button>
              </div>
              {!data.organization?.main_email && (
                <div className="text-[11px] text-amber-700 mt-2 italic">
                  ⚠ Aucun email renseigné pour cet exposant — l'envoi de mail est désactivé.
                </div>
              )}
            </div>

            {data.registration?.status !== 'confirme' && (
              <div className="flex items-center justify-between rounded-md border border-emerald-200 bg-emerald-50 p-3">
                <div>
                  <div className="font-medium text-emerald-900 text-sm">Valider l'inscription de cet exposant</div>
                  <div className="text-xs text-emerald-700">Bascule vers « Confirmé » et envoie un email de confirmation.</div>
                </div>
                <Button onClick={confirmReg} className="bg-emerald-600 hover:bg-emerald-700 gap-2"><CheckCircle2 className="w-4 h-4" /> Confirmer</Button>
              </div>
            )}

            {/* 🧠 SYNTHÈSE INTELLIGENTE + PROCHAINE ACTION */}
            {nextAction && (
              <NextActionCard
                action={nextAction}
                registration={data.registration}
                organization={data.organization}
                venue={data.venue}
                onCopyLink={copyAccessLink}
                onSendLinkEmail={sendAccessLinkEmail}
              />
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <KpiCard label="Statut" value={REGISTRATION_STATUS_LABEL[data.registration?.status] || '—'} accent="blue" />
              <KpiCard label="Caution" value={DEPOSIT_STATUS_LABEL[data.deposit?.status] || '—'} accent={data.deposit?.status === 'recue' ? 'emerald' : 'orange'} />
              <KpiCard label="Convention" value={data.registration?.is_convention_signed ? 'Signée' : 'Non'} accent={data.registration?.is_convention_signed ? 'emerald' : 'slate'} />
              <KpiCard label="Dossier" value={`${data.registration?.completion_percent || 0}%`} accent="violet" />
            </div>

            <Tabs defaultValue="profil">
              <TabsList className="w-full grid grid-cols-4">
                <TabsTrigger value="profil">📋 Profil</TabsTrigger>
                <TabsTrigger value="docs">📁 Documents & Caution</TabsTrigger>
                <TabsTrigger value="terrain">🌍 Terrain & Bilan</TabsTrigger>
                <TabsTrigger value="aracom" className="data-[state=active]:bg-amber-100 data-[state=active]:text-amber-900">🔒 ARACOM</TabsTrigger>
              </TabsList>

              {/* ===== ONGLET 1 : PROFIL (résumé + animations) ===== */}
              <TabsContent value="profil" className="space-y-3">
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

                {/* Animations intégrées dans Profil */}
                <div className="pt-2 border-t mt-3">
                  <div className="font-medium text-sm mb-2 flex items-center gap-2">🎭 Créneaux d&apos;animation</div>
                  {data.slots.length === 0 ? <p className="text-slate-500 text-sm">Aucun créneau planifié.</p> : data.slots.map(s => (
                    <div key={s.id} className="border rounded-md p-3 mb-2 bg-violet-50/30">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-sm text-slate-900">{s.title || 'Sans nom'}</div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            {s.day_label === 'vendredi' ? 'Vendredi 14 août' : 'Samedi 15 août'} • {s.start_time}–{s.end_time}
                          </div>
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {s.slot_type && <Badge variant="outline" className="text-[10px] border-violet-300 text-violet-700">{s.slot_type}</Badge>}
                            {s.location_type && <Badge variant="outline" className="text-[10px] border-blue-300 text-blue-700">{(s.location_type === 'zone_demo' || s.location_type === 'zone_animation' || s.location_type === 'scene' || s.location_type === 'spectacle') ? 'Zone démo' : 'Sur le stand'}</Badge>}
                            {s.target_audience && <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700">{s.target_audience}</Badge>}
                          </div>
                          {s.description && (
                            <div className="text-xs text-slate-700 mt-2 italic bg-white/60 rounded p-2 border border-violet-100">
                              <span className="font-medium text-violet-700">Description :</span> {s.description}
                            </div>
                          )}
                          {s.material_needs && (
                            <div className="text-[11px] text-slate-500 mt-1.5">
                              <span className="font-medium">Matériel :</span> {s.material_needs}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <Badge variant="secondary">{s.status}</Badge>
                          <Button size="sm" variant="ghost" onClick={async () => { if (!confirm('Supprimer ce créneau ?')) return; await api(`/api/animation-slots/${s.id}`, { method: 'DELETE' }); toast.success('Supprimé'); load(); }}><Trash2 className="w-3 h-3 text-red-600" /></Button>
                        </div>
                      </div>
                    </div>
                  ))}
                  <NewSlotForm registrationId={id} venueId={data.registration?.venue_id} onDone={load} />
                </div>
              </TabsContent>

              {/* ===== ONGLET 2 : DOCUMENTS & CAUTION ===== */}
              <TabsContent value="docs" className="space-y-4">
                <div>
                  <div className="font-medium text-sm mb-2 flex items-center gap-2">📁 Documents</div>
                  <DocsBlock registrationId={id} documents={data.documents} onRefresh={load} />
                </div>

                <div className="pt-3 border-t">
                  <div className="font-medium text-sm mb-2 flex items-center gap-2">💰 Caution</div>
                  <div className="rounded-md border p-4 bg-blue-50/40 mb-3">
                    <div className="text-sm text-slate-600">Montant de la caution</div>
                    <div className="text-2xl font-bold text-blue-700">{(data.deposit?.amount_xpf || DEPOSIT_AMOUNT_XPF).toLocaleString('fr-FR')} XPF</div>
                  </div>
                  <div className="space-y-2">
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
                  </div>
                </div>
              </TabsContent>

              {/* ===== ONGLET 3 : TERRAIN & BILAN (terrain + anomalies + bilan + timeline) ===== */}
              <TabsContent value="terrain" className="space-y-4">
                {/* Sessions de présence + anomalies */}
                <div>
                  <div className="font-medium text-sm mb-2 flex items-center gap-2">📍 Présence Jour J</div>
                  {data.attendance_sessions.length === 0 ? <p className="text-slate-500 text-sm">Pas encore de session de contrôle terrain.</p> : data.attendance_sessions.map(s => (
                    <div key={s.id} className="border rounded-md p-3 mb-2">
                      <div className="flex items-center justify-between">
                        <div className="font-medium">{s.event_date}</div>
                        <Badge>{s.presence_status}</Badge>
                      </div>
                      <div className="text-xs text-slate-500 mt-1">Arrivée : {s.actual_arrival_time || '—'} (prévue {s.expected_arrival_time}) • Départ : {s.actual_departure_time || '—'}</div>
                    </div>
                  ))}
                  {data.anomalies.length > 0 && (
                    <div className="mt-3">
                      <div className="font-medium text-sm mb-2">⚠️ Anomalies</div>
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
                    <div className="mt-3">
                      <div className="font-medium text-sm mb-2">💬 Commentaires terrain</div>
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
                  <Button onClick={generateBilan} variant="outline" className="w-full gap-2 mt-3"><Sparkles className="w-4 h-4" /> Générer un brouillon de bilan exposant</Button>
                </div>

                {/* Bilan post-événement */}
                <div className="pt-3 border-t">
                  <div className="font-medium text-sm mb-2 flex items-center gap-2">⭐ Bilan post-événement</div>
                  <BilanRDVAdminBlock registrationId={id} onRefresh={load} />
                </div>

                {/* Timeline */}
                <div className="pt-3 border-t">
                  <div className="font-medium text-sm mb-2 flex items-center gap-2">📜 Timeline d'activité</div>
                  <TimelineBlock registrationId={id} />
                </div>
              </TabsContent>

              {/* ===== ONGLET 4 : ARACOM (zone privée + historique) ===== */}
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

                {/* Sous-bloc historique applicatif (déplacé depuis l'ancien onglet Historique) */}
                <div className="pt-3 border-t mt-3 space-y-3">
                  <div>
                    <div className="font-medium text-sm mb-2">📅 Historique de présence (DB)</div>
                    <div className="flex gap-2 flex-wrap">
                      {data.history.length === 0 ? <div className="text-slate-500 text-xs italic">Aucun historique enregistré.</div> : data.history.map(h => <Badge key={h.id} variant="secondary">{h.year}</Badge>)}
                    </div>
                  </div>
                  <div>
                    <div className="font-medium text-sm mb-2">🌍 Préférences de sites</div>
                    <div className="flex flex-wrap gap-2">
                      {data.preferences.length === 0 ? <div className="text-slate-500 text-xs italic">Aucune préférence.</div> : data.preferences.map(p => <Badge key={p.id} variant="outline">Rang {p.preference_rank}</Badge>)}
                    </div>
                  </div>
                  <div>
                    <div className="font-medium text-sm mb-2">📨 Emails envoyés ({data.emails.length})</div>
                    {data.emails.length === 0 ? <div className="text-slate-500 text-xs italic">Aucun email.</div> : data.emails.slice(0, 8).map(e => (
                      <div key={e.id} className="text-xs border rounded-md p-2 mb-1 bg-white">
                        <div className="font-medium">{e.subject}</div>
                        <div className="text-slate-500">{e.send_status} • {e.sent_at && new Date(e.sent_at).toLocaleString('fr-FR')}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </SheetContent>

      {/* 📧 DIALOG : Envoyer un mail à l'exposant */}
      {showSendMailDialog && data && (
        <SendExposantMailDialog
          registration={data.registration}
          organization={data.organization}
          venue={data.venue}
          onClose={() => setShowSendMailDialog(false)}
        />
      )}

      {/* ✏️ DIALOG : Modifier les choix de l'exposant */}
      {showEditChoicesDialog && data && (
        <EditExposantChoicesDialog
          registration={data.registration}
          organization={data.organization}
          venue={data.venue}
          onClose={() => setShowEditChoicesDialog(false)}
          onReload={load}
        />
      )}
    </Sheet>
  );
}

function Info({ label, value }) {
  return <div className="flex items-center justify-between border-b py-2"><div className="text-xs text-slate-500 uppercase tracking-wider">{label}</div><div className="text-sm font-medium text-slate-900">{value || '—'}</div></div>;
}

// 🧠 Carte synthèse intelligente avec prochaine action évidente
function NextActionCard({ action, registration, organization, venue, onCopyLink, onSendLinkEmail }) {
  const tones = {
    emerald: { bg: 'bg-emerald-50', border: 'border-emerald-300', text: 'text-emerald-900', sub: 'text-emerald-700', dot: 'bg-emerald-500', btn: 'bg-emerald-600 hover:bg-emerald-700' },
    amber: { bg: 'bg-amber-50', border: 'border-amber-300', text: 'text-amber-900', sub: 'text-amber-700', dot: 'bg-amber-500', btn: 'bg-amber-600 hover:bg-amber-700' },
    orange: { bg: 'bg-orange-50', border: 'border-orange-300', text: 'text-orange-900', sub: 'text-orange-700', dot: 'bg-orange-500', btn: 'bg-orange-600 hover:bg-orange-700' },
    rose: { bg: 'bg-rose-50', border: 'border-rose-300', text: 'text-rose-900', sub: 'text-rose-700', dot: 'bg-rose-500', btn: 'bg-rose-600 hover:bg-rose-700' },
    blue: { bg: 'bg-blue-50', border: 'border-blue-300', text: 'text-blue-900', sub: 'text-blue-700', dot: 'bg-blue-500', btn: 'bg-blue-600 hover:bg-blue-700' },
    slate: { bg: 'bg-slate-50', border: 'border-slate-300', text: 'text-slate-900', sub: 'text-slate-600', dot: 'bg-slate-400', btn: 'bg-slate-600 hover:bg-slate-700' },
  };
  const t = tones[action.tone] || tones.slate;

  return (
    <div className={`rounded-xl border-2 ${t.border} ${t.bg} p-4 space-y-3`} data-testid="next-action-card">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-2.5 h-2.5 rounded-full ${t.dot} ${action.kind !== 'done' && action.kind !== 'idle' ? 'animate-pulse' : ''} shrink-0`} />
          <div className="min-w-0">
            <div className={`text-[10px] uppercase tracking-wider ${t.sub} font-semibold`}>Prochaine action</div>
            <div className={`font-bold ${t.text} text-base truncate`}>{action.label}</div>
          </div>
        </div>

        {/* Bouton CTA principal */}
        {action.kind === 'confirm' && action.action && (
          <Button onClick={action.action} className={`${t.btn} text-white gap-2`} size="sm">
            <CheckCircle2 className="w-4 h-4" /> {action.cta}
          </Button>
        )}
        {action.step && (
          <JxReminderTrigger
            registration={registration}
            organization={organization}
            venue={venue}
            defaultStepKey={action.step}
            buttonClassName={`${t.btn} text-white gap-2`}
            buttonLabel={action.cta || '✨ Rédiger un rappel IA'}
            buttonSize="sm"
          />
        )}
      </div>

      {/* Actions secondaires : lien d'accès exposant */}
      <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-white/40">
        <span className={`text-xs ${t.sub} font-medium`}>🔗 Lien d'accès exposant :</span>
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={onCopyLink}>
          <KeyRound className="w-3 h-3" /> Copier le lien
        </Button>
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={onSendLinkEmail}>
          <Mail className="w-3 h-3" /> Renvoyer par email
        </Button>
      </div>
    </div>
  );
}

// 🆕 Config admin : limite de sites par exposant
function ExposantLimitsConfig() {
  const [max, setMax] = useState(3);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    api('/api/admin/exposant-limits').then(d => setMax(d?.max_sites_per_exposant || 3)).catch(() => {});
  }, []);
  const save = async () => {
    setSaving(true);
    try {
      await api('/api/admin/exposant-limits', { method: 'POST', body: JSON.stringify({ max_sites_per_exposant: max }) });
      toast.success(`✅ Limite définie à ${max} site(s) par exposant`);
    } catch (e) { toast.error(e.message); }
    setSaving(false);
  };
  return (
    <div className="mt-2 pt-3 border-t border-blue-200 flex items-center gap-3 flex-wrap">
      <span className="text-xs font-semibold text-blue-900">🔢 Limite de sites par exposant :</span>
      <Select value={String(max)} onValueChange={v => setMax(parseInt(v, 10))}>
        <SelectTrigger className="w-24 h-8 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          {[1, 2, 3, 4, 5, 6].map(n => <SelectItem key={n} value={String(n)}>{n} site{n > 1 ? 's' : ''}</SelectItem>)}
        </SelectContent>
      </Select>
      <Button size="sm" onClick={save} disabled={saving} className="h-8 text-xs bg-blue-600 hover:bg-blue-700 gap-1">
        💾 {saving ? 'Enregistrement…' : 'Enregistrer'}
      </Button>
      <span className="text-[11px] text-slate-600 italic">L&apos;exposant peut s&apos;inscrire sur au plus N sites. Caution séparée par site.</span>
    </div>
  );
}

function VenueAdminCard({ venue, active, pacific, exposantVisible, onToggleAvailability, onTogglePacific, onToggleExposantVisible, onSaveReferent }) {
  const [open, setOpen] = useState(false);
  const initial = venue.referent_aracom || {};
  const [name, setName] = useState(initial.name || '');
  const [email, setEmail] = useState(initial.email || '');
  const [phone, setPhone] = useState(initial.phone || '');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setName(venue.referent_aracom?.name || '');
    setEmail(venue.referent_aracom?.email || '');
    setPhone(venue.referent_aracom?.phone || '');
  }, [venue.referent_aracom?.name, venue.referent_aracom?.email, venue.referent_aracom?.phone]);

  const hasReferent = Boolean(venue.referent_aracom?.name || venue.referent_aracom?.email || venue.referent_aracom?.phone);

  const save = async () => {
    setSaving(true);
    try { await onSaveReferent({ name, email, phone }); } finally { setSaving(false); }
  };

  return (
    <div className={`p-2.5 rounded-md border ${active ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-100 border-slate-200 opacity-70'}`}>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-semibold truncate">{venue.name}</span>
          <Badge variant="secondary" className="text-[10px] shrink-0">{venue.code}</Badge>
        </div>
        <Switch checked={active} onCheckedChange={onToggleAvailability} title="Site actif pour l'édition 2026 (impacte tous les portails)" />
      </div>
      {!active && (
        <div className="text-[10px] text-slate-500 italic bg-slate-50 rounded px-2 py-1 mb-1 border border-slate-200">
          ⛔ Site désactivé — invisible pour Pacific Centers et Exposants
        </div>
      )}
      <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-emerald-100/50">
        <span className={`flex items-center gap-1 ${!active ? 'text-slate-400' : 'text-slate-600'}`}>
          {(pacific && active) ? '👁️' : '🙈'} Pacific Centers
        </span>
        <Switch
          checked={pacific && active}
          disabled={!active}
          onCheckedChange={onTogglePacific}
          className="data-[state=checked]:bg-violet-500 scale-75"
          title={!active ? 'Activez d\'abord le site globalement' : 'Visibilité pour le portail Pacific Centers'}
        />
      </div>
      <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-emerald-100/50">
        <span className={`flex items-center gap-1 ${!active ? 'text-slate-400' : 'text-slate-600'}`} title="Visibilité du site dans le portail exposant (sélection lors de l'inscription)">
          {(exposantVisible && active) ? '👁️' : '🙈'} Exposants
        </span>
        <Switch
          checked={!!exposantVisible && active}
          disabled={!active}
          onCheckedChange={onToggleExposantVisible}
          className="data-[state=checked]:bg-blue-500 scale-75"
          title={!active ? 'Activez d\'abord le site globalement' : 'Visibilité pour le portail Exposants'}
        />
      </div>
      <div className="pt-1.5 mt-1.5 border-t border-emerald-100/50">
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className="w-full flex items-center justify-between text-[11px] text-slate-700 hover:text-blue-700 transition"
          data-testid={`referent-toggle-${venue.code}`}
        >
          <span className="flex items-center gap-1">
            👤 <span className="font-medium">Référent ARACOM</span>
            {hasReferent ? (
              <Badge variant="secondary" className="text-[9px] bg-emerald-100 text-emerald-800 ml-1">défini</Badge>
            ) : (
              <Badge variant="secondary" className="text-[9px] bg-amber-100 text-amber-800 ml-1">à définir</Badge>
            )}
          </span>
          <span className="text-slate-400">{open ? '▲' : '▼'}</span>
        </button>
        {open && (
          <div className="mt-2 space-y-1.5 bg-white rounded-md p-2 border border-emerald-100">
            <Input
              placeholder="Nom du référent"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-7 text-xs"
              data-testid={`referent-name-input-${venue.code}`}
            />
            <Input
              placeholder="email@aracom-conseil.fr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-7 text-xs"
              data-testid={`referent-email-input-${venue.code}`}
            />
            <Input
              placeholder="+(689) XX XX XX XX"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="h-7 text-xs"
              data-testid={`referent-phone-input-${venue.code}`}
            />
            <Button
              size="sm"
              onClick={save}
              disabled={saving}
              className="w-full h-7 text-[11px] bg-blue-600 hover:bg-blue-700"
              data-testid={`referent-save-${venue.code}`}
            >
              {saving ? '…' : '💾 Enregistrer'}
            </Button>
            {hasReferent && (
              <div className="text-[10px] text-slate-500 leading-relaxed pt-1">
                Ce référent sera automatiquement inséré dans les emails de rappel J-X envoyés depuis le portail exposant.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SitesView() {
  const [venues, setVenues] = useState([]);
  const [selected, setSelected] = useState(null);
  const [stands, setStands] = useState([]);
  const [regs, setRegs] = useState([]);
  const [editStand, setEditStand] = useState(null);
  const { open: openExposant } = useExposantPanel();
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

  const togglePacificVisible = async (v) => {
    const newVal = !(v.pacific_visible !== false);
    try {
      await api(`/api/venues/${v.id}/set-pacific-visible`, { method: 'POST', body: JSON.stringify({ pacific_visible: newVal }) });
      toast.success(`Site ${v.name} ${newVal ? '👁️ visible Pacific' : '🙈 masqué pour Pacific'}`);
      api('/api/venues').then(setVenues);
    } catch (e) { toast.error(e.message); }
  };

  const toggleExposantVisible = async (v) => {
    const newVal = !(v.exposant_visible !== false);
    try {
      await api(`/api/venues/${v.id}/set-exposant-visible`, { method: 'POST', body: JSON.stringify({ exposant_visible: newVal }) });
      toast.success(`Site ${v.name} ${newVal ? '👁️ visible Exposants' : '🙈 masqué pour Exposants'}`);
      api('/api/venues').then(setVenues);
    } catch (e) { toast.error(e.message); }
  };

  const saveReferent = async (v, ref) => {
    try {
      await api(`/api/venues/${v.id}/set-referent`, { method: 'POST', body: JSON.stringify(ref) });
      toast.success(`Référent enregistré pour ${v.name}`);
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
              <p className="text-xs text-blue-800">
                <b>Toggle principal</b> : active/désactive le site globalement. Si désactivé, le site est <b>invisible</b> pour Pacific Centers ET Exposants.
              </p>
              <p className="text-xs text-violet-800 mt-1">👁️ <b>Pacific Centers</b> / 👁️ <b>Exposants</b> : visibilité par portail. Désactivés automatiquement quand le toggle principal est OFF.</p>
            </div>
          </div>
          {/* 🆕 Config : Limite max de sites par exposant */}
          <ExposantLimitsConfig />
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-2">
            {venues.map(v => {
              const active = v.is_available_2026 !== false;
              const pacific = v.pacific_visible !== false;
              const expoVisible = v.exposant_visible !== false;
              return (
                <VenueAdminCard
                  key={v.id}
                  venue={v}
                  active={active}
                  pacific={pacific}
                  exposantVisible={expoVisible}
                  onToggleAvailability={() => toggleAvailability(v)}
                  onTogglePacific={() => togglePacificVisible(v)}
                  onToggleExposantVisible={() => toggleExposantVisible(v)}
                  onSaveReferent={(ref) => saveReferent(v, ref)}
                />
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
                    <div className="flex flex-wrap gap-2 mt-2">
                      {editStand.registration_id && (
                        <Button variant="default" size="sm" className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5" onClick={() => { openExposant(editStand.registration_id); setEditStand(null); }} data-testid="open-exposant-from-stand">
                          <Eye className="w-3.5 h-3.5" /> Voir la fiche complète
                        </Button>
                      )}
                      <Button variant="outline" size="sm" className="text-red-600 border-red-200" onClick={freeStand}><XCircle className="w-4 h-4 mr-1" /> Libérer ce stand</Button>
                    </div>
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
                  <td><div className="flex items-center gap-2"><AiInsightTrigger registration={r} size="xs" /><div><ExposantLink id={r.id} className="font-medium">{r.organization?.name}</ExposantLink><div className="text-xs text-slate-500">{r.organization?.discipline}</div></div></div></td>
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



// 🆕 Configuration des statuts de relance + actions contextuelles

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


// =====================================================================
// IMPORT EXCEL — Import des exposants depuis un fichier .xlsx
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

function AlertsBadge({ onGoto }) {
  const [alerts, setAlerts] = useState(null);
  const [open, setOpen] = useState(false);
  const [regs, setRegs] = useState(null);
  const [anomalies, setAnomalies] = useState([]);
  const [multiSite, setMultiSite] = useState(null); // 🌐 Anomalies multi-sites
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [activeCat, setActiveCat] = useState('insurance');
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Polling alertes (toutes les 30s)
  useEffect(() => {
    api('/api/alerts').then(setAlerts).catch(() => {});
    api('/api/admin/multi-site-alerts').then(setMultiSite).catch(() => {});
    const t = setInterval(() => {
      api('/api/alerts').then(setAlerts).catch(() => {});
      api('/api/admin/multi-site-alerts').then(setMultiSite).catch(() => {});
    }, 30000);
    return () => clearInterval(t);
  }, []);

  // Charge regs + anomalies à l'ouverture du Sheet
  useEffect(() => {
    if (!open) return;
    setLoadingDetail(true);
    Promise.all([
      api('/api/registrations'),
      api('/api/anomalies').catch(() => []),
      api('/api/admin/multi-site-alerts').catch(() => null),
    ])
      .then(([r, a, m]) => { setRegs(r); setAnomalies(Array.isArray(a) ? a : []); if (m) setMultiSite(m); })
      .catch(() => {})
      .finally(() => setLoadingDetail(false));
    setSelectedIds(new Set());
  }, [open]);

  if (!alerts) return null;
  const multiSiteOverloadedCount = multiSite?.overloaded_sites?.length || 0;
  const multiSiteDuplicatesCount = multiSite?.duplicate_exposants?.length || 0;
  const total = alerts.anomalies_open + alerts.tasks_open + alerts.missing_insurance + (alerts.validation_pending || 0) + (alerts.validation_rdv || 0) + multiSiteOverloadedCount + multiSiteDuplicatesCount;

  // Catégorisation des dossiers (côté client, à partir des flags registrations + anomalies)
  const activeRegs = (regs || []).filter(r => r.status !== 'annule' && r.status !== 'libre');
  const byCat = {
    insurance: {
      label: '🛡️ Assurance manquante',
      mail_type: 'relance_assurance',
      color: 'rose',
      items: activeRegs.filter(r => !r.is_insurance_uploaded),
    },
    convention: {
      label: '📋 Convention non signée',
      mail_type: 'relance_convention',
      color: 'amber',
      items: activeRegs.filter(r => !r.is_convention_signed),
    },
    deposit: {
      label: '💰 Caution non reçue',
      mail_type: 'relance_caution',
      color: 'orange',
      items: activeRegs.filter(r => !r.is_deposit_received && r.status !== 'a_relancer' && r.stand_code),
    },
    a_relancer: {
      label: '🔔 À relancer (aucune réponse)',
      mail_type: 'relance_generale',
      color: 'violet',
      items: activeRegs.filter(r => r.status === 'a_relancer'),
    },
    no_stand: {
      label: '📍 Sans stand attribué',
      mail_type: 'relance_generale',
      color: 'sky',
      items: activeRegs.filter(r => !r.stand_code && r.status !== 'a_relancer'),
    },
    anomalies: {
      label: '⚠️ Anomalies ouvertes (terrain)',
      mail_type: 'relance_generale',
      color: 'red',
      items: (() => {
        const openAnom = anomalies.filter(a => a.resolved_status !== 'resolved' && !a.resolved_at);
        const ids = new Set(openAnom.map(a => a.registration_id));
        return activeRegs.filter(r => ids.has(r.id)).map(r => ({
          ...r,
          _anom_count: openAnom.filter(a => a.registration_id === r.id).length,
        }));
      })(),
    },
    multi_site_duplicates: {
      label: '🌐 Exposants multi-sites (à surveiller)',
      mail_type: 'relance_generale',
      color: 'cyan',
      items: (() => {
        const dups = multiSite?.duplicate_exposants || [];
        // Mapper sur la 1ʳᵉ registration de chaque exposant pour pouvoir l'ouvrir
        return dups.map(d => {
          const firstRegId = d.venues?.[0]?.registration_id;
          const baseReg = activeRegs.find(r => r.id === firstRegId);
          const venuesLabel = (d.venues || []).map(v => v.venue_name).filter(Boolean).join(' · ');
          return {
            id: firstRegId || `org-${d.org_id}`,
            organization_id: d.org_id,
            organization_name: d.org_name,
            discipline: baseReg?.discipline || null,
            priority_level: baseReg?.priority_level || null,
            status: baseReg?.status || 'multi_site',
            stand_code: null,
            main_email: baseReg?.main_email || null,
            _multi_site_count: d.venues?.length || 0,
            _multi_site_label: venuesLabel,
            _multi_site_venues: d.venues || [],
          };
        });
      })(),
    },
    multi_site_overloaded: {
      label: '📍 Sites surchargés',
      mail_type: 'relance_generale',
      color: 'orange',
      items: (() => {
        const overloaded = multiSite?.overloaded_sites || [];
        return overloaded.map(s => ({
          id: `site-${s.venue_id}`,
          organization_name: s.venue_name,
          discipline: `${s.count} inscriptions (moyenne ${multiSite?.avg_per_site || '—'}, capacité ${s.capacity || '?'})`,
          status: 'overloaded',
          _site_capacity: s.capacity,
          _site_count: s.count,
          _site_overload: s.overload_pct,
        }));
      })(),
    },
  };

  const cur = byCat[activeCat] || byCat.insurance;
  const allSelected = cur.items.length > 0 && cur.items.every(r => selectedIds.has(r.id));
  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(cur.items.map(r => r.id)));
    }
  };
  const toggleOne = (id) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };

  const openFiche = (regId) => {
    const url = `/aracom?tab=exposants&open=${encodeURIComponent(regId)}`;
    window.history.pushState({}, '', url);
    onGoto?.('exposants');
    setOpen(false);
  };

  const sendRelance = () => {
    if (selectedIds.size === 0) { toast.error('Sélectionnez au moins un exposant'); return; }
    const ids = Array.from(selectedIds).join(',');
    setOpen(false);
    // Passe les params via le 2e argument de setTab (qui préserve preselect/mail_type dans l'URL)
    onGoto?.('mailing', { preselect: ids, mail_type: cur.mail_type });
    toast.success(`${selectedIds.size} exposant${selectedIds.size > 1 ? 's' : ''} pré-sélectionné${selectedIds.size > 1 ? 's' : ''} dans Mailing`);
  };

  return (
    <>
      <Button size="sm" variant="outline" className="gap-2" onClick={() => setOpen(true)} title="Centre d'alertes">
        <AlertTriangle className="w-4 h-4" />
        {total > 0 && <Badge className="bg-red-600 text-white h-5 min-w-[20px] px-1.5 text-[10px]">{total}</Badge>}
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto p-0 flex flex-col">
          <SheetHeader className="p-5 border-b sticky top-0 bg-white z-10">
            <SheetTitle className="flex items-center gap-2 text-lg">
              <AlertTriangle className="w-5 h-5 text-rose-600" /> Centre d&apos;alertes
              {total > 0 && <Badge className="bg-rose-600">{total}</Badge>}
            </SheetTitle>
            <SheetDescription>
              Visualisez les dossiers litigieux par catégorie, sélectionnez les destinataires et lancez une relance par email.
            </SheetDescription>
          </SheetHeader>

          {/* Mini-récap header (stats globales) */}
          <div className="px-5 pt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
            {alerts.validation_pending > 0 && (
              <button onClick={() => { setOpen(false); onGoto?.('validations'); }} className="rounded-md p-2 text-left bg-violet-50 hover:bg-violet-100 border border-violet-200">
                <div className="text-xs text-violet-700">🔔 Validations en attente</div>
                <div className="text-xl font-bold text-violet-900">{alerts.validation_pending}</div>
              </button>
            )}
            {alerts.validation_rdv > 0 && (
              <button onClick={() => { setOpen(false); onGoto?.('validations'); }} className="rounded-md p-2 text-left bg-blue-50 hover:bg-blue-100 border border-blue-200">
                <div className="text-xs text-blue-700">📅 RDV cautions</div>
                <div className="text-xl font-bold text-blue-900">{alerts.validation_rdv}</div>
              </button>
            )}
            {alerts.tasks_open > 0 && (
              <button onClick={() => { setOpen(false); onGoto?.('relances'); }} className="rounded-md p-2 text-left bg-amber-50 hover:bg-amber-100 border border-amber-200">
                <div className="text-xs text-amber-700">📌 Tâches en cours</div>
                <div className="text-xl font-bold text-amber-900">{alerts.tasks_open}</div>
              </button>
            )}
            {alerts.critical_anomalies > 0 && (
              <button onClick={() => { setActiveCat('anomalies'); }} className="rounded-md p-2 text-left bg-red-50 hover:bg-red-100 border border-red-200">
                <div className="text-xs text-red-700">🚨 Anomalies critiques</div>
                <div className="text-xl font-bold text-red-900">{alerts.critical_anomalies}</div>
              </button>
            )}
            {multiSiteDuplicatesCount > 0 && (
              <button onClick={() => { setActiveCat('multi_site_duplicates'); }} className="rounded-md p-2 text-left bg-cyan-50 hover:bg-cyan-100 border border-cyan-200">
                <div className="text-xs text-cyan-700">🌐 Exposants multi-sites</div>
                <div className="text-xl font-bold text-cyan-900">{multiSiteDuplicatesCount}</div>
              </button>
            )}
            {multiSiteOverloadedCount > 0 && (
              <button onClick={() => { setActiveCat('multi_site_overloaded'); }} className="rounded-md p-2 text-left bg-orange-50 hover:bg-orange-100 border border-orange-200">
                <div className="text-xs text-orange-700">📍 Sites surchargés</div>
                <div className="text-xl font-bold text-orange-900">{multiSiteOverloadedCount}</div>
              </button>
            )}
          </div>

          {/* Tabs catégories */}
          <div className="px-5 pt-3 pb-2 border-b">
            <div className="text-xs uppercase text-slate-500 mb-2">Dossiers litigieux par catégorie</div>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(byCat).map(([key, cat]) => (
                <button
                  key={key}
                  onClick={() => { setActiveCat(key); setSelectedIds(new Set()); }}
                  className={`text-xs rounded-full px-3 py-1.5 border transition-colors ${activeCat === key ? `bg-${cat.color}-600 text-white border-${cat.color}-700` : 'bg-white hover:bg-slate-50 border-slate-200'}`}
                >
                  {cat.label} <span className={`ml-1 ${activeCat === key ? 'text-white' : 'text-slate-500'}`}>({cat.items.length})</span>
                </button>
              ))}
            </div>
          </div>

          {/* Liste des dossiers de la catégorie active */}
          <div className="flex-1 overflow-y-auto px-5 py-3">
            {loadingDetail ? (
              <div className="py-12 text-center text-slate-500"><RefreshCw className="w-6 h-6 mx-auto animate-spin mb-2" /> Chargement…</div>
            ) : cur.items.length === 0 ? (
              <div className="py-12 text-center text-emerald-600">
                <CheckCircle2 className="w-10 h-10 mx-auto mb-2" />
                <div className="font-medium">Aucun dossier dans cette catégorie 🎉</div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs pb-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
                    <span className="font-medium">{allSelected ? 'Tout désélectionner' : 'Tout sélectionner'}</span>
                  </label>
                  <span className="text-slate-500">{selectedIds.size} / {cur.items.length} sélectionnés</span>
                </div>
                {cur.items.map(r => (
                  <div key={r.id} className={`border rounded-md p-2.5 flex items-start gap-2 transition-colors ${selectedIds.has(r.id) ? 'bg-blue-50 border-blue-300' : 'bg-white hover:bg-slate-50'}`}>
                    <Checkbox className="mt-1" checked={selectedIds.has(r.id)} onCheckedChange={() => toggleOne(r.id)} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <ExposantLink id={r.id} className="font-medium text-sm truncate">{r.organization_name || r.organization?.name || '—'}</ExposantLink>
                        {r.priority_level && <Badge variant="secondary" className="text-[10px] shrink-0">{r.priority_level}</Badge>}
                        <Badge variant="secondary" className={`text-[10px] shrink-0 ${REGISTRATION_STATUS_COLOR[r.status] || ''}`}>{REGISTRATION_STATUS_LABEL[r.status] || r.status}</Badge>
                        {r._anom_count > 0 && <Badge className="bg-red-600 text-white text-[10px]">{r._anom_count} anom.</Badge>}
                      </div>
                      <div className="text-xs text-slate-500 truncate">
                        {r.discipline || '—'}
                        {r.venue_name && <> · 📍 {r.venue_name}</>}
                        {r.stand_code && <> · 🔖 {r.stand_code}</>}
                        {typeof r.completion_percent === 'number' && <> · {r.completion_percent}%</>}
                      </div>
                      {r._multi_site_count > 1 && (
                        <div className="text-[11px] text-cyan-700 mt-0.5 truncate">
                          🌐 Inscrit sur <b>{r._multi_site_count}</b> sites : {r._multi_site_label}
                        </div>
                      )}
                      {r._site_overload && (
                        <div className="text-[11px] text-orange-700 mt-0.5">
                          ⚠️ {r._site_count}/{r._site_capacity || '?'} stands occupés (+{Math.round(r._site_overload * 100)}% au-dessus moyenne)
                        </div>
                      )}
                      {(r.main_email || r.organization?.main_email) && (
                        <div className="text-[11px] text-slate-400 truncate">📧 {r.main_email || r.organization?.main_email}</div>
                      )}
                    </div>
                    <Button size="sm" variant="outline" className="text-xs shrink-0" onClick={() => openFiche(r.id)}>
                      <Eye className="w-3 h-3 mr-1" /> Fiche
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer fixe avec actions */}
          <div className="border-t p-4 bg-slate-50 flex items-center gap-2 sticky bottom-0">
            <div className="flex-1 text-sm">
              {selectedIds.size > 0 ? (
                <span className="font-medium text-blue-700">{selectedIds.size} exposant{selectedIds.size > 1 ? 's' : ''} sélectionné{selectedIds.size > 1 ? 's' : ''}</span>
              ) : (
                <span className="text-slate-500 text-xs">Cochez des dossiers puis lancez une relance groupée</span>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Fermer</Button>
            <Button
              size="sm"
              disabled={selectedIds.size === 0}
              className="bg-blue-600 hover:bg-blue-700 gap-1.5 disabled:opacity-50"
              onClick={sendRelance}
            >
              <Send className="w-4 h-4" /> Relancer par mail ({selectedIds.size})
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

// =====================================================================
// VALIDATIONS — ARACOM workflow : voir / fixer RDV / verrouiller / annuler
// =====================================================================

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

// ============ DOCUMENTS OFFICIELS (admin upload + bibliothèque partagée) ============


// =====================================================================
// ⏰ DEADLINES par étape — UI ARACOM
// =====================================================================

// =====================================================================
// ⭐ BILAN + RDV restitution caution (UI ARACOM dans la fiche exposant)
// =====================================================================
function JxReminderTrigger({ registration, organization, venue, defaultStepKey, buttonClassName, buttonLabel, buttonSize }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        size={buttonSize || 'sm'}
        className={buttonClassName || 'bg-blue-600 hover:bg-blue-700 gap-1.5'}
        data-testid="jx-reminder-button"
      >
        <Sparkles className="w-3.5 h-3.5" /> {buttonLabel || 'Rédiger & envoyer'}
      </Button>
      {open && (
        <JxReminderDialog
          registration={registration}
          organization={organization}
          venue={venue}
          defaultStepKey={defaultStepKey}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function JxReminderDialog({ registration, organization, venue, onClose, defaultStepKey }) {
  const [stepKey, setStepKey] = useState(defaultStepKey || 'documents');
  const [customInstruction, setCustomInstruction] = useState('');
  const [subject, setSubject] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [meta, setMeta] = useState(null);

  const STEPS = [
    { key: 'profile', label: '👤 Profil exposant', desc: 'Coordonnées, description, contact' },
    { key: 'stand', label: '🗺️ Choix du site / stand', desc: 'Pré-réservation d\'un emplacement' },
    { key: 'animation', label: '🎭 Créneaux d\'animation', desc: 'Planification vendredi / samedi' },
    { key: 'documents', label: '📄 Documents officiels', desc: 'Assurance, RIB, etc.' },
    { key: 'caution', label: '💰 Caution 20 000 XPF', desc: 'Versement de la caution' },
    { key: 'convention', label: '✍️ Convention', desc: 'Signature du document' },
  ];

  const currentReferent = venue?.referent_aracom || {};
  const hasReferent = Boolean(currentReferent.name || currentReferent.email || currentReferent.phone);

  const generate = async () => {
    setGenerating(true);
    try {
      const r = await api(`/api/registrations/${registration.id}/generate-jx-reminder`, {
        method: 'POST',
        body: JSON.stringify({ step_key: stepKey, custom_instruction: customInstruction }),
      });
      setSubject(r.subject || '');
      setBodyHtml(r.body_html || '');
      setMeta({ days_remaining: r.days_remaining, deadline_iso: r.deadline_iso, llm_source: r.llm_source });
      setGenerated(true);
      toast.success('✨ Email généré par IA');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setGenerating(false);
    }
  };

  const send = async () => {
    if (!subject.trim() || !bodyHtml.trim()) {
      toast.error('Subject et corps requis');
      return;
    }
    setSending(true);
    try {
      const r = await api('/api/mailing/send', {
        method: 'POST',
        body: JSON.stringify({
          subject,
          body_html: bodyHtml,
          registration_ids: [registration.id],
          mail_type: `jx_reminder_${stepKey}`,
        }),
      });
      const sent = r.sent || 0;
      const failed = r.failed || 0;
      const redirected = r.redirected_count || 0;
      let msg = `✉️ Email envoyé (${sent} succès`;
      if (failed) msg += `, ${failed} échec`;
      if (redirected) msg += ` — mode TEST : redirigé vers admin`;
      msg += ')';
      toast.success(msg);
      onClose();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            📧 Rappel J-X — {organization?.name}
          </DialogTitle>
          <DialogDescription>
            Génère un email personnalisé via IA, le rend modifiable, puis l'envoie à <b>{organization?.main_email || '—'}</b>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div>
            <Label className="mb-2 block">1️⃣ Étape concernée</Label>
            <div className="grid sm:grid-cols-2 gap-2">
              {STEPS.map(s => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setStepKey(s.key)}
                  className={`text-left p-2.5 rounded-md border-2 transition ${stepKey === s.key ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300 bg-white'}`}
                >
                  <div className="text-sm font-medium">{s.label}</div>
                  <div className="text-[11px] text-slate-500">{s.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div className={`rounded-md p-3 text-xs ${hasReferent ? 'bg-emerald-50 border border-emerald-200' : 'bg-amber-50 border border-amber-200'}`}>
            <div className="font-semibold mb-1">{hasReferent ? '👤 Référent qui sera mentionné dans l\'email' : '⚠️ Aucun référent défini sur ce site'}</div>
            {hasReferent ? (
              <div className="text-slate-700 leading-relaxed">
                <b>{currentReferent.name || '—'}</b>
                {currentReferent.email && <> · <a href={`mailto:${currentReferent.email}`} className="text-blue-700 underline">{currentReferent.email}</a></>}
                {currentReferent.phone && <> · {currentReferent.phone}</>}
              </div>
            ) : (
              <div className="text-amber-800">
                Allez dans <b>Configuration → Sites & stands</b> pour définir un référent ARACOM sur le site « {venue?.name || '—'} » avant d'envoyer le rappel.
              </div>
            )}
          </div>

          <div>
            <Label className="mb-1 block">2️⃣ Instructions optionnelles pour l'IA</Label>
            <Textarea
              rows={2}
              placeholder="Ex : insister sur le passage en personne au bureau, mentionner que l'animation est unique..."
              value={customInstruction}
              onChange={(e) => setCustomInstruction(e.target.value)}
            />
          </div>

          <Button
            onClick={generate}
            disabled={generating}
            className="w-full bg-violet-600 hover:bg-violet-700 gap-2"
            data-testid="jx-reminder-generate"
          >
            <Sparkles className="w-4 h-4" />
            {generating ? 'Génération en cours…' : (generated ? '🔄 Régénérer' : '✨ Générer l\'email avec IA')}
          </Button>

          {generated && (
            <>
              {meta?.days_remaining != null && (
                <div className={`text-xs p-2 rounded-md ${meta.days_remaining > 7 ? 'bg-emerald-50 text-emerald-800' : meta.days_remaining > 0 ? 'bg-amber-50 text-amber-800' : 'bg-red-50 text-red-800'}`}>
                  ⏰ Échéance : {meta.days_remaining > 0 ? `J-${meta.days_remaining}` : meta.days_remaining === 0 ? 'AUJOURD\'HUI' : `dépassée (${Math.abs(meta.days_remaining)}j)`}
                  {meta.deadline_iso && ` · ${new Date(meta.deadline_iso).toLocaleDateString('fr-FR')}`}
                  {meta.llm_source && ` · IA: ${meta.llm_source}`}
                </div>
              )}
              <div>
                <Label className="mb-1 block">3️⃣ Objet de l'email <span className="text-xs text-slate-400">(éditable)</span></Label>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} className="font-medium" data-testid="jx-reminder-subject" />
              </div>
              <div>
                <Label className="mb-1 block">4️⃣ Corps HTML <span className="text-xs text-slate-400">(éditable)</span></Label>
                <Textarea
                  rows={10}
                  value={bodyHtml}
                  onChange={(e) => setBodyHtml(e.target.value)}
                  className="font-mono text-xs"
                  data-testid="jx-reminder-body"
                />
              </div>
              <div>
                <Label className="mb-1 block">👁️ Aperçu</Label>
                <div
                  className="border rounded-md p-4 bg-white max-h-[300px] overflow-y-auto text-sm"
                  dangerouslySetInnerHTML={{ __html: bodyHtml }}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button variant="outline" onClick={onClose} data-testid="jx-reminder-cancel">Annuler</Button>
                <Button
                  onClick={send}
                  disabled={sending || !subject.trim() || !bodyHtml.trim()}
                  className="bg-blue-600 hover:bg-blue-700 gap-2"
                  data-testid="jx-reminder-send"
                >
                  <Send className="w-4 h-4" />
                  {sending ? 'Envoi…' : 'Envoyer le rappel'}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function BilanRDVAdminBlock({ registrationId, onRefresh }) {
  const [survey, setSurvey] = useState(null);
  const [loading, setLoading] = useState(true);
  const [confirmedRdv, setConfirmedRdv] = useState('');
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [showFillForm, setShowFillForm] = useState(false);
  const [adminForm, setAdminForm] = useState({
    overall_rating: 0, organization_rating: 0, stand_rating: 0, visitors_rating: 0, communication_rating: 0,
    nps_score: null, will_participate_next: '',
    positive_points: '', improvement_points: '', free_comment: '',
  });
  const [adminAiBusy, setAdminAiBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const arr = await api(`/api/satisfaction?registration_id=${registrationId}`);
      const s = arr?.[0] || null;
      setSurvey(s);
      if (s?.caution_return_rdv_confirmed) {
        setConfirmedRdv(new Date(s.caution_return_rdv_confirmed).toISOString().slice(0, 16));
      } else if (s?.caution_return_rdv_proposed) {
        setConfirmedRdv(new Date(s.caution_return_rdv_proposed).toISOString().slice(0, 16));
      }
      if (s?.validation_comment) setComment(s.validation_comment);
    } catch (e) { console.error(e); }
    setLoading(false);
  };
  useEffect(() => { load(); }, [registrationId]);

  const validateBilan = async () => {
    if (!confirmedRdv) { toast.error('Définissez la date de RDV restitution caution'); return; }
    if (!window.confirm(`Valider ce bilan et confirmer le RDV du ${new Date(confirmedRdv).toLocaleString('fr-FR')} pour la restitution de la caution ?`)) return;
    setBusy(true);
    try {
      await api(`/api/satisfaction/${survey.id}/aracom-validate`, {
        method: 'POST',
        body: JSON.stringify({
          validated: true,
          caution_return_rdv_confirmed: new Date(confirmedRdv).toISOString(),
          validation_comment: comment || null,
        }),
      });
      toast.success('✅ Bilan validé et RDV confirmé');
      load();
      onRefresh?.();
    } catch (e) { toast.error(e.message); }
    setBusy(false);
  };

  const markCautionReturned = async () => {
    if (!window.confirm('Confirmer que la caution a été restituée à l\'exposant ?')) return;
    setBusy(true);
    try {
      await api(`/api/satisfaction/${survey.id}/mark-caution-returned`, { method: 'POST', body: JSON.stringify({}) });
      toast.success('💰 Caution marquée comme restituée');
      load();
      onRefresh?.();
    } catch (e) { toast.error(e.message); }
    setBusy(false);
  };

  const adminFill = async () => {
    setBusy(true);
    try {
      await api('/api/satisfaction', { method: 'POST', body: JSON.stringify({ registration_id: registrationId, ...adminForm, filled_by_aracom: true }) });
      toast.success('Bilan rempli pour l\'exposant');
      setShowFillForm(false);
      load();
    } catch (e) { toast.error(e.message); }
    setBusy(false);
  };

  if (loading) return <div className="p-4 text-sm text-slate-500">Chargement…</div>;

  if (!survey) {
    if (showFillForm) {
      return (
        <Card>
          <CardHeader><CardTitle className="text-base">Remplir le bilan pour cet exposant</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-slate-500">Vous remplissez ce questionnaire au nom de l&apos;exposant. Il pourra ensuite voir le bilan dans son portail.</p>
            <div className="grid sm:grid-cols-2 gap-3">
              <StarRow label="Note globale" value={adminForm.overall_rating} onChange={v => setAdminForm({ ...adminForm, overall_rating: v })} />
              <StarRow label="Organisation" value={adminForm.organization_rating} onChange={v => setAdminForm({ ...adminForm, organization_rating: v })} />
              <StarRow label="Stand" value={adminForm.stand_rating} onChange={v => setAdminForm({ ...adminForm, stand_rating: v })} />
              <StarRow label="Visiteurs" value={adminForm.visitors_rating} onChange={v => setAdminForm({ ...adminForm, visitors_rating: v })} />
              <StarRow label="Communication" value={adminForm.communication_rating} onChange={v => setAdminForm({ ...adminForm, communication_rating: v })} />
              <div>
                <Label className="text-xs uppercase">NPS (0-10)</Label>
                <Input type="number" min={0} max={10} value={adminForm.nps_score ?? ''} onChange={e => setAdminForm({ ...adminForm, nps_score: e.target.value === '' ? null : Number(e.target.value) })} />
              </div>
            </div>
            <div><Label>Points positifs</Label><Textarea rows={3} value={adminForm.positive_points} onChange={e => setAdminForm({ ...adminForm, positive_points: e.target.value })} /></div>
            <div><Label>À améliorer</Label><Textarea rows={3} value={adminForm.improvement_points} onChange={e => setAdminForm({ ...adminForm, improvement_points: e.target.value })} /></div>
            <div><Label>Commentaire libre</Label><Textarea rows={3} value={adminForm.free_comment} onChange={e => setAdminForm({ ...adminForm, free_comment: e.target.value })} /></div>
            <Button
              variant="outline"
              size="sm"
              disabled={adminAiBusy}
              onClick={async () => {
                const totalRated = (adminForm.overall_rating ? 1 : 0) + (adminForm.organization_rating ? 1 : 0) + (adminForm.stand_rating ? 1 : 0) + (adminForm.visitors_rating ? 1 : 0) + (adminForm.communication_rating ? 1 : 0);
                if (totalRated < 2) { toast.error('Notez au moins 2 critères avant de demander à l\'IA.'); return; }
                setAdminAiBusy(true);
                try {
                  const r = await api('/api/satisfaction/ai-enrich', {
                    method: 'POST',
                    body: JSON.stringify({
                      registration_id: registrationId,
                      ratings: { overall: adminForm.overall_rating, organization: adminForm.organization_rating, stand: adminForm.stand_rating, visitors: adminForm.visitors_rating, communication: adminForm.communication_rating },
                      nps_score: adminForm.nps_score,
                      will_participate_next: adminForm.will_participate_next,
                      current_text: { positive: adminForm.positive_points, improvement: adminForm.improvement_points, free: adminForm.free_comment },
                      mode: (adminForm.positive_points || adminForm.improvement_points || adminForm.free_comment) ? 'enrich' : 'draft',
                    }),
                  });
                  setAdminForm(prev => ({ ...prev, positive_points: r.positive_points || prev.positive_points, improvement_points: r.improvement_points || prev.improvement_points, free_comment: r.free_comment || prev.free_comment }));
                  toast.success('✨ Commentaires enrichis par l\'IA');
                } catch (e) { toast.error(e.message); } finally { setAdminAiBusy(false); }
              }}
              className="gap-1.5 border-violet-300 text-violet-700 hover:bg-violet-50"
              data-testid="admin-satisfaction-ai-enrich"
            >
              <Sparkles className={`w-3.5 h-3.5 ${adminAiBusy ? 'animate-spin' : ''}`} />
              {adminAiBusy ? 'IA en cours…' : '✨ Enrichir les commentaires avec l\'IA'}
            </Button>
            <div className="flex gap-2">
              <Button onClick={adminFill} disabled={busy} className="bg-violet-600 hover:bg-violet-700"><CheckCircle2 className="w-4 h-4 mr-1" /> Enregistrer le bilan</Button>
              <Button variant="outline" onClick={() => setShowFillForm(false)} disabled={busy}>Annuler</Button>
            </div>
          </CardContent>
        </Card>
      );
    }
    return (
      <Card className="border-dashed">
        <CardContent className="p-5 text-center space-y-3">
          <span className="text-4xl">📋</span>
          <p className="text-sm text-slate-600">Aucun bilan saisi pour le moment.</p>
          <p className="text-xs text-slate-500">L&apos;exposant peut le compléter via son portail (si phase post-événement activée), ou vous pouvez le remplir directement ici.</p>
          <Button onClick={() => setShowFillForm(true)} variant="outline" className="gap-2">
            <Sparkles className="w-4 h-4" /> Remplir le bilan pour l&apos;exposant
          </Button>
        </CardContent>
      </Card>
    );
  }

  const cautionReturned = survey.caution_return_status === 'completed';
  const validated = survey.validation_status === 'validated_by_aracom';

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Star className="w-4 h-4 text-amber-500 fill-amber-400" /> Bilan de l&apos;exposant
            {survey.filled_by_aracom_at && <Badge variant="secondary" className="text-[10px]">Rempli par ARACOM</Badge>}
            {validated && <Badge className="bg-emerald-100 text-emerald-700 ml-auto">✅ Validé</Badge>}
            {cautionReturned && <Badge className="bg-blue-100 text-blue-700">💰 Caution rendue</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-3 gap-2 text-sm">
          <Info label="Note globale" value={survey.overall_rating ? `${survey.overall_rating}/5 ⭐` : '—'} />
          <Info label="Organisation" value={survey.organization_rating ? `${survey.organization_rating}/5` : '—'} />
          <Info label="Stand" value={survey.stand_rating ? `${survey.stand_rating}/5` : '—'} />
          <Info label="Visiteurs" value={survey.visitors_rating ? `${survey.visitors_rating}/5` : '—'} />
          <Info label="Communication" value={survey.communication_rating ? `${survey.communication_rating}/5` : '—'} />
          <Info label="NPS" value={survey.nps_score != null ? `${survey.nps_score}/10` : '—'} />
        </CardContent>
        {(survey.positive_points || survey.improvement_points || survey.free_comment) && (
          <CardContent className="border-t pt-3 space-y-2 text-xs">
            {survey.positive_points && <div><b>👍 Points positifs :</b> {survey.positive_points}</div>}
            {survey.improvement_points && <div><b>✏️ À améliorer :</b> {survey.improvement_points}</div>}
            {survey.free_comment && <div className="italic text-slate-600">💬 « {survey.free_comment} »</div>}
          </CardContent>
        )}
      </Card>

      <Card className={cautionReturned ? 'border-emerald-300 bg-emerald-50/30' : validated ? 'border-blue-300 bg-blue-50/30' : 'border-violet-300 bg-violet-50/30'}>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Wallet className="w-4 h-4" /> RDV restitution de la caution</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {survey.caution_return_rdv_proposed && !validated && (
            <div className="bg-amber-50 border border-amber-200 rounded p-3 text-sm">
              <b className="text-amber-900">Date proposée par l&apos;exposant :</b><br />
              {new Date(survey.caution_return_rdv_proposed).toLocaleString('fr-FR', { dateStyle: 'full', timeStyle: 'short' })}
            </div>
          )}
          {cautionReturned ? (
            <div className="text-sm text-emerald-800">
              ✅ Caution restituée le {new Date(survey.caution_returned_at).toLocaleDateString('fr-FR')}
            </div>
          ) : (
            <>
              <div>
                <Label>Date du RDV (confirmée ARACOM)</Label>
                <Input type="datetime-local" value={confirmedRdv} onChange={e => setConfirmedRdv(e.target.value)} />
              </div>
              <div>
                <Label>Commentaire (visible côté exposant)</Label>
                <Textarea rows={2} value={comment} onChange={e => setComment(e.target.value)} placeholder="Ex: Merci de venir au siège ARACOM avec votre pièce d'identité..." />
              </div>
              <div className="flex gap-2 flex-wrap">
                {!validated && (
                  <Button onClick={validateBilan} disabled={busy} className="bg-violet-600 hover:bg-violet-700 gap-1.5">
                    <CheckCircle2 className="w-4 h-4" /> Valider bilan + Confirmer RDV
                  </Button>
                )}
                {validated && (
                  <Button onClick={markCautionReturned} disabled={busy} className="bg-emerald-600 hover:bg-emerald-700 gap-1.5">
                    <Wallet className="w-4 h-4" /> Marquer caution comme restituée
                  </Button>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StarRow({ label, value, onChange }) {
  return (
    <div>
      <Label className="text-xs uppercase">{label}</Label>
      <div className="flex gap-1 mt-1">
        {[1,2,3,4,5].map(n => (
          <button key={n} type="button" onClick={() => onChange(n)}>
            <Star className={`w-6 h-6 ${n <= value ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />
          </button>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// 🎭 ANIMATIONS — Vue consolidée de toutes les animations exposants
// ============================================================
function AnimationsView() {
  const [slots, setSlots] = useState([]);
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterVenue, setFilterVenue] = useState('all');
  const [filterDay, setFilterDay] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterSearch, setFilterSearch] = useState('');
  const [groupByVenue, setGroupByVenue] = useState(true);
  const [editingSlot, setEditingSlot] = useState(null);
  const { open: openExposant, refreshTrigger } = useExposantPanel();

  const load = async () => {
    setLoading(true);
    try {
      const [s, v] = await Promise.all([
        api('/api/animation-slots'),
        api('/api/venues'),
      ]);
      setSlots(Array.isArray(s) ? s : []);
      setVenues(Array.isArray(v) ? v : []);
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  // Filtres
  const filteredSlots = useMemo(() => {
    return slots.filter(s => {
      if (filterVenue !== 'all' && s.venue_id !== filterVenue) return false;
      if (filterDay !== 'all' && s.day_label !== filterDay) return false;
      if (filterStatus !== 'all' && s.status !== filterStatus) return false;
      if (filterSearch) {
        const q = filterSearch.toLowerCase();
        const haystack = `${s.organization_name || ''} ${s.discipline || ''} ${s.title || ''} ${s.stand_code || ''}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [slots, filterVenue, filterDay, filterStatus, filterSearch]);

  // 🔥 Détection conflits = même venue + même day + chevauchement horaire + (même lieu si dispo)
  const conflicts = useMemo(() => {
    const set = new Set();
    for (let i = 0; i < filteredSlots.length; i++) {
      for (let j = i + 1; j < filteredSlots.length; j++) {
        const a = filteredSlots[i], b = filteredSlots[j];
        if (a.venue_id !== b.venue_id) continue;
        if (a.day_label !== b.day_label) continue;
        // Même lieu : "sur le stand" est personnel (jamais de conflit) — "zone démo" est partagée
        const aLoc = (a.location_type === 'sur_stand' || a.location_type === 'stand') ? 'sur_stand' : 'zone_demo';
        const bLoc = (b.location_type === 'sur_stand' || b.location_type === 'stand') ? 'sur_stand' : 'zone_demo';
        if (aLoc === 'sur_stand' && bLoc === 'sur_stand' && a.stand_code !== b.stand_code) continue;
        // Chevauchement
        const aS = (a.start_time || '00:00'), aE = (a.end_time || '00:00');
        const bS = (b.start_time || '00:00'), bE = (b.end_time || '00:00');
        if (aS < bE && bS < aE) { set.add(a.id); set.add(b.id); }
      }
    }
    return set;
  }, [filteredSlots]);

  const statusBadge = (st) => {
    const cls = {
      'planifié': 'bg-amber-100 text-amber-800 border-amber-300',
      'confirmé': 'bg-emerald-100 text-emerald-800 border-emerald-300',
      'modifié': 'bg-blue-100 text-blue-800 border-blue-300',
      'annulé': 'bg-rose-100 text-rose-800 border-rose-300',
    }[st] || 'bg-slate-100 text-slate-700 border-slate-300';
    return <Badge variant="outline" className={`${cls} text-xs`}>{st || '—'}</Badge>;
  };

  const saveSlot = async (slotId, patch) => {
    try {
      await api(`/api/animation-slots/${slotId}`, { method: 'PUT', body: JSON.stringify(patch) });
      toast.success('Animation mise à jour');
      setEditingSlot(null);
      load();
    } catch (e) { toast.error(e.message); }
  };

  const deleteSlot = async (slot) => {
    if (!confirm(`Supprimer l'animation "${slot.title || ''}" de ${slot.organization_name} ?\n${slot.day_label} ${slot.start_time}–${slot.end_time}`)) return;
    try {
      await api(`/api/animation-slots/${slot.id}`, { method: 'DELETE' });
      toast.success('Animation supprimée');
      load();
    } catch (e) { toast.error(e.message); }
  };

  // Groupement par site
  const grouped = useMemo(() => {
    if (!groupByVenue) return null;
    const map = {};
    for (const s of filteredSlots) {
      const k = s.venue_id || 'aucun';
      if (!map[k]) map[k] = { venue_name: s.venue_name || 'Aucun site', items: [] };
      map[k].items.push(s);
    }
    // Trier par heure dans chaque groupe
    Object.values(map).forEach(g => g.items.sort((a, b) => {
      const dayCmp = (a.day_label || '').localeCompare(b.day_label || '');
      if (dayCmp !== 0) return dayCmp;
      return (a.start_time || '').localeCompare(b.start_time || '');
    }));
    return map;
  }, [filteredSlots, groupByVenue]);

  // Stats KPIs
  const stats = useMemo(() => ({
    total: slots.length,
    confirmes: slots.filter(s => s.status === 'confirmé').length,
    planifies: slots.filter(s => s.status === 'planifié').length,
    modifies: slots.filter(s => s.status === 'modifié').length,
    conflicts_count: conflicts.size,
  }), [slots, conflicts]);

  if (loading) return <div className="py-12 text-center text-slate-500">Chargement…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2"><Music className="w-5 h-5 text-violet-600" /> Animations exposants</h2>
          <p className="text-sm text-slate-500">Vue consolidée de toutes les animations déclarées · {stats.total} créneau{stats.total > 1 ? 'x' : ''} · {stats.conflicts_count > 0 && <span className="text-rose-600 font-medium">⚠️ {stats.conflicts_count} conflit{stats.conflicts_count > 1 ? 's' : ''} détecté{stats.conflicts_count > 1 ? 's' : ''}</span>}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} className="gap-2"><RefreshCw className="w-4 h-4" /> Actualiser</Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard label="Total" value={stats.total} accent="blue" />
        <KpiCard label="Confirmées" value={stats.confirmes} accent="emerald" />
        <KpiCard label="Planifiées" value={stats.planifies} accent="amber" />
        <KpiCard label="Modifiées" value={stats.modifies} accent="violet" />
        <KpiCard label="Conflits" value={stats.conflicts_count} accent={stats.conflicts_count > 0 ? 'red' : 'slate'} />
      </div>

      {/* Filtres */}
      <Card>
        <CardContent className="p-3 flex flex-wrap gap-2 items-center">
          <Filter className="w-4 h-4 text-slate-500" />
          <Input placeholder="Rechercher (exposant, discipline, titre, stand)…" value={filterSearch} onChange={e => setFilterSearch(e.target.value)} className="max-w-xs h-9" />
          <Select value={filterVenue} onValueChange={setFilterVenue}>
            <SelectTrigger className="w-[160px] h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les sites</SelectItem>
              {venues.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterDay} onValueChange={setFilterDay}>
            <SelectTrigger className="w-[140px] h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Vendredi & Samedi</SelectItem>
              <SelectItem value="vendredi">Vendredi 14/08</SelectItem>
              <SelectItem value="samedi">Samedi 15/08</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[140px] h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous statuts</SelectItem>
              <SelectItem value="planifié">Planifié</SelectItem>
              <SelectItem value="confirmé">Confirmé</SelectItem>
              <SelectItem value="modifié">Modifié</SelectItem>
              <SelectItem value="annulé">Annulé</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1.5 ml-auto">
            <Label className="text-xs cursor-pointer flex items-center gap-1.5"><input type="checkbox" checked={groupByVenue} onChange={e => setGroupByVenue(e.target.checked)} className="cursor-pointer" /> Grouper par site</Label>
          </div>
        </CardContent>
      </Card>

      {/* Liste / groupée */}
      {filteredSlots.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-slate-500">Aucune animation ne correspond aux filtres.</CardContent></Card>
      ) : groupByVenue ? (
        <div className="space-y-4">
          {Object.entries(grouped).map(([vid, g]) => (
            <Card key={vid}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="font-bold text-slate-900 flex items-center gap-2"><MapPin className="w-4 h-4 text-blue-600" /> {g.venue_name}</div>
                  <Badge variant="secondary">{g.items.length} créneau{g.items.length > 1 ? 'x' : ''}</Badge>
                </div>
                <AnimSlotsTable slots={g.items} conflicts={conflicts} statusBadge={statusBadge} onEdit={setEditingSlot} onDelete={deleteSlot} onOpenExposant={(s) => openExposant(s.registration_id)} />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-3">
            <AnimSlotsTable slots={filteredSlots} conflicts={conflicts} statusBadge={statusBadge} onEdit={setEditingSlot} onDelete={deleteSlot} onOpenExposant={(s) => openExposant(s.registration_id)} />
          </CardContent>
        </Card>
      )}

      {/* Edition inline */}
      {editingSlot && (
        <EditAnimationDialog
          slot={editingSlot}
          venues={venues}
          onClose={() => setEditingSlot(null)}
          onSave={(patch) => saveSlot(editingSlot.id, patch)}
        />
      )}

      {/* FicheExposant ouvert globalement via ExposantPanelProvider */}
    </div>
  );
}

function AnimSlotsTable({ slots, conflicts, statusBadge, onEdit, onDelete, onOpenExposant }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-xs text-slate-500 uppercase">
            <th className="text-left p-2 font-medium">Exposant</th>
            <th className="text-left p-2 font-medium">Site / Stand</th>
            <th className="text-left p-2 font-medium">Jour</th>
            <th className="text-left p-2 font-medium">Horaire</th>
            <th className="text-left p-2 font-medium">Type / Titre</th>
            <th className="text-left p-2 font-medium">Statut</th>
            <th className="text-right p-2 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {slots.map(s => {
            const isConflict = conflicts.has(s.id);
            return (
              <tr key={s.id} className={`border-b hover:bg-slate-50 ${isConflict ? 'bg-rose-50/60' : ''}`} data-testid={`anim-row-${s.id}`}>
                <td className="p-2">
                  <button onClick={() => onOpenExposant(s)} className="text-left hover:text-blue-600 hover:underline">
                    <div className="font-medium text-slate-900">{s.organization_name || '—'}</div>
                    <div className="text-xs text-slate-500">{s.discipline || '—'}</div>
                  </button>
                </td>
                <td className="p-2">
                  <div className="text-slate-700">{s.venue_name || '—'}</div>
                  <div className="text-xs text-slate-400">{s.stand_code || '—'}</div>
                </td>
                <td className="p-2 text-slate-700">{s.day_label === 'vendredi' ? 'Ven 14/08' : s.day_label === 'samedi' ? 'Sam 15/08' : '—'}</td>
                <td className="p-2 font-mono text-xs">
                  {s.start_time}–{s.end_time}
                  {isConflict && <div className="text-rose-600 font-bold text-[10px] mt-0.5">⚠️ CONFLIT</div>}
                </td>
                <td className="p-2">
                  <div className="text-slate-700">{s.slot_type || 'animation'}</div>
                  <div className="text-xs text-slate-500 truncate max-w-[200px]">{s.title || '—'}</div>
                </td>
                <td className="p-2">{statusBadge(s.status)}</td>
                <td className="p-2 text-right">
                  <Button size="sm" variant="ghost" onClick={() => onEdit(s)} className="h-7 w-7 p-0" title="Modifier"><Sparkles className="w-3.5 h-3.5 text-blue-600" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => onDelete(s)} className="h-7 w-7 p-0" title="Supprimer"><Trash2 className="w-3.5 h-3.5 text-rose-600" /></Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function EditAnimationDialog({ slot, venues = [], onClose, onSave }) {
  // Normalisation : on accepte les anciennes valeurs en lecture mais on remap vers les 2 valeurs canoniques
  const normalizeLocation = (v) => {
    if (v === 'sur_stand' || v === 'stand') return 'sur_stand';
    if (v === 'zone_demo' || v === 'zone_animation' || v === 'scene' || v === 'spectacle') return 'zone_demo';
    // 'exterieur', 'autre' ou autre → par défaut "sur le stand"
    return 'sur_stand';
  };
  const [form, setForm] = useState({
    title: slot.title || '',
    slot_type: slot.slot_type || 'animation',
    start_time: slot.start_time || '09:00',
    end_time: slot.end_time || '10:00',
    day_label: slot.day_label || 'vendredi',
    status: slot.status || 'planifié',
    location_type: normalizeLocation(slot.location_type),
    venue_id: slot.venue_id || '',
    description: slot.description || '',
  });
  // 🆕 Détection si le créneau a été modifié (date/heure/site)
  const hasScheduleChanged =
    form.start_time !== (slot.start_time || '09:00') ||
    form.end_time !== (slot.end_time || '10:00') ||
    form.day_label !== (slot.day_label || 'vendredi') ||
    form.venue_id !== (slot.venue_id || '');

  // 🆕 Amplitude autorisée selon le jour (Vendredi 11h→17h · Samedi 9h→17h)
  const dayBounds = form.day_label === 'vendredi'
    ? { open: '11:00', close: '17:00' }
    : { open: '09:00', close: '17:00' };
  const isStartValid = form.start_time >= dayBounds.open && form.start_time < dayBounds.close;
  const isEndValid = form.end_time > dayBounds.open && form.end_time <= dayBounds.close;
  const isOrderValid = form.start_time < form.end_time;
  const isTimeValid = isStartValid && isEndValid && isOrderValid;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modifier l&apos;animation</DialogTitle>
          <DialogDescription>{slot.organization_name} · {slot.venue_name}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label>Titre</Label>
            <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Type</Label>
              <Select value={form.slot_type} onValueChange={v => setForm({ ...form, slot_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="animation">Animation</SelectItem>
                  <SelectItem value="demonstration">Démonstration</SelectItem>
                  <SelectItem value="atelier">Atelier</SelectItem>
                  <SelectItem value="presentation">Présentation</SelectItem>
                  <SelectItem value="performance">Performance</SelectItem>
                  <SelectItem value="initiation">Initiation</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Statut</Label>
              <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="planifié">Planifié</SelectItem>
                  <SelectItem value="confirmé">Confirmé</SelectItem>
                  <SelectItem value="modifié">Modifié</SelectItem>
                  <SelectItem value="annulé">Annulé</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {/* 🆕 Sélecteur de site */}
          <div>
            <Label>Site</Label>
            <Select value={form.venue_id} onValueChange={v => setForm({ ...form, venue_id: v })}>
              <SelectTrigger><SelectValue placeholder="Choisir un site" /></SelectTrigger>
              <SelectContent>
                {venues.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Jour</Label>
              <Select value={form.day_label} onValueChange={v => setForm({ ...form, day_label: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="vendredi">Vendredi</SelectItem>
                  <SelectItem value="samedi">Samedi</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Début</Label>
              <Input type="time" min={dayBounds.open} max={dayBounds.close} step="900" value={form.start_time} onChange={e => setForm({ ...form, start_time: e.target.value })} className={!isStartValid || !isOrderValid ? 'border-red-400' : ''} />
            </div>
            <div>
              <Label>Fin</Label>
              <Input type="time" min={dayBounds.open} max={dayBounds.close} step="900" value={form.end_time} onChange={e => setForm({ ...form, end_time: e.target.value })} className={!isEndValid || !isOrderValid ? 'border-red-400' : ''} />
            </div>
          </div>
          {/* 🆕 Indicateur d'amplitude autorisée */}
          <div className={`text-xs rounded-md px-3 py-2 ${isTimeValid ? 'bg-emerald-50 border border-emerald-200 text-emerald-900' : 'bg-red-50 border border-red-300 text-red-900'}`}>
            {isTimeValid ? '✅' : '❌'} <b>Amplitude {form.day_label === 'vendredi' ? 'Vendredi' : 'Samedi'} :</b> ouverture <b>{dayBounds.open}</b> → fermeture <b>{dayBounds.close}</b>
            {!isStartValid && <div className="mt-1 text-red-700">⚠️ Début hors plage : doit être entre {dayBounds.open} et {dayBounds.close}</div>}
            {!isEndValid && <div className="mt-1 text-red-700">⚠️ Fin hors plage : doit être entre {dayBounds.open} et {dayBounds.close}</div>}
            {!isOrderValid && <div className="mt-1 text-red-700">⚠️ L&apos;heure de fin doit être après le début</div>}
          </div>
          <div>
            <Label>Lieu</Label>
            <Select value={form.location_type} onValueChange={v => setForm({ ...form, location_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sur_stand">Sur le stand</SelectItem>
                <SelectItem value="zone_demo">Zone de démonstration</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Description / notes</Label>
            <Textarea rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          </div>
          {/* 🆕 Alerte si créneau modifié */}
          {hasScheduleChanged && (
            <div className="rounded-md border-2 border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              <div className="font-bold flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> N&apos;oubliez pas !</div>
              <p className="text-xs mt-1">
                Vous modifiez le créneau (date, heure ou site). <b>Pensez à envoyer un mail à l&apos;exposant</b> pour lui confirmer le nouveau créneau via l&apos;onglet <i>Mailing</i> ou <i>Relances</i>.
              </p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={() => onSave(form)} disabled={!isTimeValid} className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50">
            {isTimeValid ? 'Enregistrer' : '⛔ Horaires invalides'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// AdminOverridePanel et DeleteOrgDialog déplacés dans /app/components/aracom/
// CorbeilleView déplacée dans /app/components/aracom/corbeille-view.jsx






// =====================================================================
// 📊 Top disciplines avec sélecteur de site + pastilles multi-sites
// =====================================================================
function DisciplinesCard({ analytics }) {
  const [selectedSite, setSelectedSite] = useState('all');
  const [showMultiList, setShowMultiList] = useState(false);

  // Récupère les disciplines selon le filtre
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
    // Pour un site spécifique : agréger les orgs multi-sites de toutes les disciplines de ce site
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

  // Custom Tooltip qui affiche le détail multi-sites
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
        {/* Bandeau multi-sites — cliquable pour voir la liste */}
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
        {/* Liste des associations multi-sites */}
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
            {/* Liste détaillée avec pastilles */}
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



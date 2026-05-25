'use client';

/**
 * 📋 ExposantsListView — Vue liste exposants enrichie (Cockpit ARACOM)
 *
 * - 4 métriques cliquables 2×2 (À confirmer / Confirmés / Total / Annulés)
 * - Barre recherche + 3 filtres (site, statut, priorité)
 * - Tableau avec : checkbox, exposant, prio, site, statut INLINE, convention, caution, actions
 * - Bulk bar (changer statut, rappel, export, suppr, désélectionner)
 * - 3 niveaux de suppression avec confirmation par texte exact
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  Search, Plus, Download, Trash2, Send, ExternalLink, Check,
  X, AlertTriangle, Loader2, ChevronDown, ChevronUp, ArrowUpDown,
  ArrowDownUp,
} from 'lucide-react';
import { api } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { useExposantPanel } from './exposant-panel-context';

const STATUS_OPTS = [
  { key: 'contacte', label: 'À confirmer', cls: 'bg-amber-100 text-amber-900 border-amber-300', dotCls: 'bg-amber-500' },
  { key: 'confirme', label: 'Confirmé', cls: 'bg-emerald-100 text-emerald-900 border-emerald-300', dotCls: 'bg-emerald-500' },
  { key: 'liste_attente', label: "Liste d'attente", cls: 'bg-violet-100 text-violet-900 border-violet-300', dotCls: 'bg-violet-500' },
  { key: 'annule', label: 'Annulé', cls: 'bg-red-100 text-red-900 border-red-300', dotCls: 'bg-red-500' },
];

const PRIO_OPTS = [
  { key: 'A', label: 'A', cls: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  { key: 'B', label: 'B', cls: 'bg-amber-100 text-amber-800 border-amber-300' },
  { key: 'C', label: 'C', cls: 'bg-blue-100 text-blue-800 border-blue-300' },
  { key: 'prospect', label: 'Prospect', cls: 'bg-violet-100 text-violet-800 border-violet-300' },
];

// ─── 🔽 OPTIONS DE TRI — combinaison dropdown + en-têtes cliquables ───
const SORT_OPTS = [
  { key: 'name',         label: '🔤 Nom (A → Z)',              dir: 'asc'  },
  { key: 'name',         label: '🔤 Nom (Z → A)',              dir: 'desc' },
  { key: 'created_at',   label: '📅 Profil — plus récent',     dir: 'desc' },
  { key: 'created_at',   label: '📅 Profil — plus ancien',     dir: 'asc'  },
  { key: 'editions',     label: '🏅 Fidélité — Multi-éditions d\'abord', dir: 'desc' },
  { key: 'editions',     label: '🆕 Nouveaux d\'abord',         dir: 'asc'  },
  { key: 'priority',     label: '🏷 Priorité (A → C)',          dir: 'asc'  },
  { key: 'status',       label: '⏱ Statut (À conf. → Annulé)', dir: 'asc'  },
  { key: 'venue',        label: '📍 Site (A → Z)',             dir: 'asc'  },
  { key: 'discipline',   label: '🎯 Discipline (A → Z)',       dir: 'asc'  },
  { key: 'caution',      label: '💰 Caution (croissant)',      dir: 'asc'  },
  { key: 'caution',      label: '💰 Caution (décroissant)',    dir: 'desc' },
  { key: 'convention',   label: '📝 Convention (signée d\'abord)', dir: 'desc' },
];
const PRIO_ORDER = { A: 0, B: 1, C: 2, prospect: 3, '': 4, null: 4, undefined: 4 };
const STATUS_ORDER = { contacte: 0, liste_attente: 1, confirme: 2, annule: 3 };

const getStatusOpt = (s) => STATUS_OPTS.find((o) => o.key === s) || STATUS_OPTS[0];
const getPrioOpt = (p) => PRIO_OPTS.find((o) => o.key === p) || null;

export default function ExposantsListView() {
  const [rows, setRows] = useState([]);
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterSite, setFilterSite] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPrio, setFilterPrio] = useState('');
  // 🔽 TRI — clé + direction (synchronisé avec dropdown + en-têtes cliquables)
  const [sortKey, setSortKey] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const [selected, setSelected] = useState(new Set());
  const [showNew, setShowNew] = useState(false);
  const [bulkStatusOpen, setBulkStatusOpen] = useState(false);
  const [deleteMode, setDeleteMode] = useState(null); // null | 'single' | 'bulk' | 'all'
  const [deleteTargetId, setDeleteTargetId] = useState(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [busy, setBusy] = useState(false);
  const loadSeqRef = useRef(0);
  const { open: openExposant, refreshTrigger } = useExposantPanel();

  // 🔄 Chargement avec race-safety
  const load = async () => {
    const seq = ++loadSeqRef.current;
    setLoading(true);
    try {
      const [r, v] = await Promise.all([
        api('/api/registrations?_t=' + Date.now()),
        api('/api/venues'),
      ]);
      if (seq !== loadSeqRef.current) return;
      setRows(Array.isArray(r) ? r : []);
      setVenues(Array.isArray(v) ? v : []);
    } catch (e) {
      if (seq === loadSeqRef.current) toast.error(e.message);
    } finally {
      if (seq === loadSeqRef.current) setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);
  useEffect(() => { if (refreshTrigger) load(); }, [refreshTrigger]);

  // 🔗 Auto-ouvrir une fiche via URL ?open=...
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const openId = new URLSearchParams(window.location.search).get('open');
    if (openId) {
      openExposant(openId);
      const url = new URL(window.location.href);
      url.searchParams.delete('open');
      window.history.replaceState({}, '', url.toString());
    }
  }, []);

  const venueMap = useMemo(() => {
    const m = {};
    for (const v of venues) m[v.id] = v.name;
    return m;
  }, [venues]);

  // 🔎 Filtrage en mémoire
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = rows.filter((r) => {
      if (filterSite && r.venue_id !== filterSite) return false;
      if (filterStatus && r.status !== filterStatus) return false;
      if (filterPrio) {
        const prio = r.organization?.priority_level || (r.organization?.status === 'prospect' ? 'prospect' : null);
        if (prio !== filterPrio) return false;
      }
      if (!q) return true;
      const name = (r.organization?.name || '').toLowerCase();
      const email = (r.organization?.main_email || '').toLowerCase();
      const stand = (r.stand_code || '').toLowerCase();
      return name.includes(q) || email.includes(q) || stand.includes(q);
    });

    // 🔽 TRI appliqué après le filtrage
    const venueNameOf = (r) => (venues.find((v) => v.id === r.venue_id)?.name || '').toLowerCase();
    const prioOf = (r) => r.organization?.priority_level || (r.organization?.status === 'prospect' ? 'prospect' : null);
    const sortValue = (r) => {
      switch (sortKey) {
        case 'name':       return (r.organization?.name || '').toLowerCase();
        case 'created_at': return r.organization?.created_at ? new Date(r.organization.created_at).getTime() : 0;
        case 'editions':   return r.organization?.participation_history?.nb_editions || 0;
        case 'priority':   return PRIO_ORDER[prioOf(r)] ?? 99;
        case 'status':     return STATUS_ORDER[r.status] ?? 99;
        case 'venue':      return venueNameOf(r);
        case 'discipline': return (r.organization?.discipline || '').toLowerCase();
        case 'caution':    return r.deposit?.amount_xpf || 0;
        case 'convention': return r.is_convention_signed ? 1 : 0;
        default:           return 0;
      }
    };
    const sorted = [...base].sort((a, b) => {
      const va = sortValue(a);
      const vb = sortValue(b);
      let cmp;
      if (typeof va === 'number' && typeof vb === 'number') cmp = va - vb;
      else cmp = String(va).localeCompare(String(vb), 'fr', { numeric: true, sensitivity: 'base' });
      // 🪢 Tie-break stable par nom (A→Z) pour un ordre déterministe quand les valeurs sont égales
      if (cmp === 0 && sortKey !== 'name') {
        const na = (a.organization?.name || '').toLowerCase();
        const nb = (b.organization?.name || '').toLowerCase();
        cmp = na.localeCompare(nb, 'fr', { sensitivity: 'base' });
      }
      return sortDir === 'desc' ? -cmp : cmp;
    });
    return sorted;
  }, [rows, search, filterSite, filterStatus, filterPrio, sortKey, sortDir, venues]);

  // 🔽 Helpers tri : toggle on header click + sync dropdown
  const toggleSort = (key, defaultDir = 'asc') => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(defaultDir);
    }
  };
  const SortIcon = ({ col }) => {
    if (sortKey !== col) return <ArrowUpDown className="inline w-3 h-3 ml-1 text-slate-300" />;
    return sortDir === 'asc'
      ? <ChevronUp className="inline w-3 h-3 ml-1 text-slate-700" />
      : <ChevronDown className="inline w-3 h-3 ml-1 text-slate-700" />;
  };
  // Valeur sérialisée pour le dropdown : "key|dir"
  const sortDropdownValue = `${sortKey}|${sortDir}`;
  const applySortDropdown = (val) => {
    const [k, d] = (val || '').split('|');
    if (k) setSortKey(k);
    if (d) setSortDir(d);
  };

  // 📊 Métriques
  const metrics = useMemo(() => {
    const m = { total: rows.length, contacte: 0, confirme: 0, annule: 0, liste_attente: 0 };
    for (const r of rows) {
      if (r.status === 'confirme') m.confirme++;
      else if (r.status === 'annule') m.annule++;
      else if (r.status === 'liste_attente') m.liste_attente++;
      else m.contacte++;
    }
    return m;
  }, [rows]);

  // ✅ Sélection
  const allVisibleSelected = filtered.length > 0 && filtered.every((r) => selected.has(r.id));
  const toggleAll = () => {
    const next = new Set(selected);
    if (allVisibleSelected) {
      filtered.forEach((r) => next.delete(r.id));
    } else {
      filtered.forEach((r) => next.add(r.id));
    }
    setSelected(next);
  };
  const toggleOne = (id) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };
  const clearSelection = () => setSelected(new Set());

  // 🔄 Update inline statut
  const updateStatus = async (regId, newStatus) => {
    const old = rows.find((r) => r.id === regId)?.status;
    if (old === newStatus) return;
    // Optimistic update
    setRows((rs) => rs.map((r) => (r.id === regId ? { ...r, status: newStatus } : r)));
    try {
      await api(`/api/registrations/${regId}`, { method: 'PUT', body: JSON.stringify({ status: newStatus }) });
      toast.success(`Statut → ${getStatusOpt(newStatus).label}`);
    } catch (e) {
      toast.error(e.message);
      setRows((rs) => rs.map((r) => (r.id === regId ? { ...r, status: old } : r)));
    }
  };

  // 🔄 Bulk update statut
  const bulkUpdateStatus = async (newStatus) => {
    if (selected.size === 0) return;
    setBusy(true);
    let ok = 0, fail = 0;
    for (const id of selected) {
      try { await api(`/api/registrations/${id}`, { method: 'PUT', body: JSON.stringify({ status: newStatus }) }); ok++; }
      catch { fail++; }
    }
    toast.success(`${ok} mis à jour${fail ? `, ${fail} échec` : ''}`);
    setBulkStatusOpen(false);
    setBusy(false);
    await load();
    clearSelection();
  };

  // ✉️ Envoi rappel — single
  const sendReminderSingle = async (reg) => {
    if (!reg.organization?.main_email) { toast.error('Pas d\'email pour cet exposant'); return; }
    try {
      await api('/api/mailing/send', {
        method: 'POST',
        body: JSON.stringify({
          subject: `[Forum 2026] Rappel — ${reg.organization?.name || 'votre dossier'}`,
          body_html: `<p>Bonjour,</p><p>Nous vous adressons un petit rappel concernant votre dossier d'inscription au Forum de la Rentrée 2026.</p><p>Merci de finaliser les éléments manquants depuis votre espace exposant.</p><p>Cordialement,<br/>L'équipe ARACOM</p>`,
          registration_ids: [reg.id],
          mail_type: 'reminder',
        }),
      });
      toast.success('📧 Rappel envoyé');
    } catch (e) { toast.error(e.message); }
  };

  // ✉️ Bulk rappel
  const bulkReminder = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Envoyer un rappel à ${selected.size} exposant(s) ?`)) return;
    setBusy(true);
    try {
      const res = await api('/api/mailing/send', {
        method: 'POST',
        body: JSON.stringify({
          subject: `[Forum 2026] Rappel — finaliser votre inscription`,
          body_html: `<p>Bonjour,</p><p>Nous vous adressons un rappel concernant votre dossier d'inscription au Forum de la Rentrée 2026.</p><p>Merci de finaliser les éléments manquants.</p><p>Cordialement,<br/>L'équipe ARACOM</p>`,
          registration_ids: [...selected],
          mail_type: 'reminder',
        }),
      });
      toast.success(`📧 ${res?.sent || 0} rappel(s) envoyé(s)${res?.failed ? `, ${res.failed} échec` : ''}`);
      clearSelection();
    } catch (e) { toast.error(e.message); }
    setBusy(false);
  };

  // 📥 Export CSV
  const exportCSV = (idsScope) => {
    const scope = idsScope ? rows.filter((r) => idsScope.has(r.id)) : filtered;
    const headers = ['Nom organisation', 'Discipline', 'Email', 'Téléphone', 'Site', 'Stand', 'Statut', 'Convention', 'Caution XPF', 'Priorité'];
    const lines = [headers.join(',')];
    for (const r of scope) {
      const cells = [
        r.organization?.name || '',
        r.organization?.discipline || '',
        r.organization?.main_email || '',
        r.organization?.main_phone || '',
        venueMap[r.venue_id] || '',
        r.stand_code || '',
        getStatusOpt(r.status).label,
        r.is_convention_signed ? 'Signée' : 'Non',
        r.deposit?.amount_xpf || '',
        r.organization?.priority_level || '',
      ].map((c) => `"${String(c).replace(/"/g, '""')}"`);
      lines.push(cells.join(','));
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `exposants_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
    toast.success(`${scope.length} ligne(s) exportée(s)`);
  };

  // 🗑️ Confirmations de suppression
  const askDeleteSingle = (regId) => {
    setDeleteTargetId(regId);
    setDeleteConfirmText('');
    setDeleteMode('single');
  };
  const askDeleteBulk = () => { setDeleteConfirmText(''); setDeleteMode('bulk'); };
  const askDeleteAll = () => { setDeleteConfirmText(''); setDeleteMode('all'); };
  const cancelDelete = () => { setDeleteMode(null); setDeleteTargetId(null); setDeleteConfirmText(''); };

  const targetReg = deleteMode === 'single' ? rows.find((r) => r.id === deleteTargetId) : null;
  const deleteCanProceed = useMemo(() => {
    if (deleteMode === 'single') return deleteConfirmText.trim() === (targetReg?.organization?.name || '');
    if (deleteMode === 'bulk') return deleteConfirmText.trim() === 'CONFIRMER';
    if (deleteMode === 'all') return deleteConfirmText.trim() === 'SUPPRIMER TOUT';
    return false;
  }, [deleteMode, deleteConfirmText, targetReg]);

  const performDelete = async () => {
    if (!deleteCanProceed) return;
    setBusy(true);
    try {
      if (deleteMode === 'single') {
        await api(`/api/registrations/${deleteTargetId}`, { method: 'DELETE' });
        setRows((rs) => rs.filter((r) => r.id !== deleteTargetId));
        toast.success('Exposant supprimé');
      } else if (deleteMode === 'bulk') {
        let ok = 0, fail = 0;
        for (const id of selected) {
          try { await api(`/api/registrations/${id}`, { method: 'DELETE' }); ok++; }
          catch { fail++; }
        }
        toast.success(`${ok} supprimé(s)${fail ? `, ${fail} échec` : ''}`);
        clearSelection();
        await load();
      } else if (deleteMode === 'all') {
        let ok = 0, fail = 0;
        const ids = filtered.map((r) => r.id);
        for (const id of ids) {
          try { await api(`/api/registrations/${id}`, { method: 'DELETE' }); ok++; }
          catch { fail++; }
        }
        toast.success(`${ok} supprimé(s)${fail ? `, ${fail} échec` : ''}`);
        clearSelection();
        await load();
      }
      cancelDelete();
    } catch (e) {
      toast.error(e.message);
    }
    setBusy(false);
  };

  return (
    <div className="space-y-3">
      {/* ═══════════════ MÉTRIQUES CLIQUABLES 2×2 ═══════════════ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          { key: 'contacte', label: 'À confirmer', n: metrics.contacte, cls: 'bg-amber-50 border-amber-300 text-amber-900', activeCls: 'ring-2 ring-amber-500' },
          { key: 'confirme', label: 'Confirmés', n: metrics.confirme, cls: 'bg-emerald-50 border-emerald-300 text-emerald-900', activeCls: 'ring-2 ring-emerald-500' },
          { key: '', label: 'Total', n: metrics.total, cls: 'bg-slate-50 border-slate-300 text-slate-900', activeCls: 'ring-2 ring-slate-500' },
          { key: 'annule', label: 'Annulés', n: metrics.annule, cls: 'bg-red-50 border-red-300 text-red-900', activeCls: 'ring-2 ring-red-500' },
        ].map((m) => {
          const active = filterStatus === m.key;
          return (
            <button
              key={m.label}
              onClick={() => setFilterStatus(m.key)}
              className={`rounded-xl border-2 px-3 py-2.5 text-left transition hover:scale-[1.02] ${m.cls} ${active ? m.activeCls : ''}`}
            >
              <div className="text-[10px] uppercase tracking-wider opacity-80">{m.label}</div>
              <div className="text-2xl font-bold">{m.n}</div>
            </button>
          );
        })}
      </div>

      {/* ═══════════════ RECHERCHE + FILTRES ═══════════════ */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Rechercher par nom, email, stand..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
        <Select value={filterSite || '_all'} onValueChange={(v) => setFilterSite(v === '_all' ? '' : v)}>
          <SelectTrigger className="w-40 h-9 text-xs"><SelectValue placeholder="Tous les sites" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">Tous les sites</SelectItem>
            {venues.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus || '_all'} onValueChange={(v) => setFilterStatus(v === '_all' ? '' : v)}>
          <SelectTrigger className="w-40 h-9 text-xs"><SelectValue placeholder="Tous statuts" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">Tous statuts</SelectItem>
            {STATUS_OPTS.map((o) => <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterPrio || '_all'} onValueChange={(v) => setFilterPrio(v === '_all' ? '' : v)}>
          <SelectTrigger className="w-32 h-9 text-xs"><SelectValue placeholder="Priorité" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">Toutes priorités</SelectItem>
            {PRIO_OPTS.map((o) => <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
        {/* 🔽 Dropdown TRI */}
        <Select value={sortDropdownValue} onValueChange={applySortDropdown}>
          <SelectTrigger className="w-52 h-9 text-xs gap-1">
            <ArrowDownUp className="w-3.5 h-3.5 text-slate-500" />
            <SelectValue placeholder="Trier par…" />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTS.map((o, i) => (
              <SelectItem key={`${o.key}-${o.dir}-${i}`} value={`${o.key}|${o.dir}`}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ═══════════════ ACTIONS GLOBALES ═══════════════ */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-slate-600 mr-auto">{filtered.length} exposant(s) affiché(s)</span>
        <Button size="sm" onClick={() => setShowNew(true)} className="h-8 text-xs gap-1 bg-blue-600 hover:bg-blue-700 text-white">
          <Plus className="w-3.5 h-3.5" /> Nouveau exposant
        </Button>
        <Button size="sm" variant="outline" onClick={() => exportCSV(null)} className="h-8 text-xs gap-1">
          <Download className="w-3.5 h-3.5" /> Export CSV
        </Button>
        <Button size="sm" variant="outline" onClick={askDeleteAll} disabled={filtered.length === 0} className="h-8 text-xs gap-1 border-red-300 text-red-700 hover:bg-red-50">
          <Trash2 className="w-3.5 h-3.5" /> Tout supprimer
        </Button>
      </div>

      {/* ═══════════════ TABLEAU ═══════════════ */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-left">
                <th className="p-2 w-8">
                  <input type="checkbox" checked={allVisibleSelected} onChange={toggleAll} className="rounded" />
                </th>
                <th className="p-2 font-medium uppercase tracking-wider text-[10px] text-slate-600 cursor-pointer select-none hover:bg-slate-100" onClick={() => toggleSort('name', 'asc')} title="Trier par nom">
                  Exposant<SortIcon col="name" />
                </th>
                <th className="p-2 font-medium uppercase tracking-wider text-[10px] text-slate-600 cursor-pointer select-none hover:bg-slate-100" onClick={() => toggleSort('priority', 'asc')} title="Trier par priorité">
                  Prio<SortIcon col="priority" />
                </th>
                <th className="p-2 font-medium uppercase tracking-wider text-[10px] text-slate-600 cursor-pointer select-none hover:bg-slate-100" onClick={() => toggleSort('venue', 'asc')} title="Trier par site">
                  Site<SortIcon col="venue" />
                </th>
                <th className="p-2 font-medium uppercase tracking-wider text-[10px] text-slate-600 cursor-pointer select-none hover:bg-slate-100" onClick={() => toggleSort('status', 'asc')} title="Trier par statut">
                  Statut<SortIcon col="status" />
                </th>
                <th className="p-2 font-medium uppercase tracking-wider text-[10px] text-slate-600 cursor-pointer select-none hover:bg-slate-100" onClick={() => toggleSort('convention', 'desc')} title="Trier par convention">
                  Conv.<SortIcon col="convention" />
                </th>
                <th className="p-2 font-medium uppercase tracking-wider text-[10px] text-slate-600 cursor-pointer select-none hover:bg-slate-100" onClick={() => toggleSort('caution', 'desc')} title="Trier par caution">
                  Caution<SortIcon col="caution" />
                </th>
                <th className="p-2 font-medium uppercase tracking-wider text-[10px] text-slate-600 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan="8" className="text-center text-slate-400 py-6"><Loader2 className="w-5 h-5 animate-spin inline" /></td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan="8" className="text-center text-slate-400 py-6 italic">Aucun exposant trouvé</td></tr>
              )}
              {!loading && filtered.map((r) => {
                const isSel = selected.has(r.id);
                const opt = getStatusOpt(r.status);
                const prio = r.organization?.priority_level || (r.organization?.status === 'prospect' ? 'prospect' : null);
                const prioOpt = getPrioOpt(prio);
                return (
                  <tr key={r.id} className={`border-b border-slate-100 hover:bg-slate-50 transition ${isSel ? 'bg-blue-50/40' : ''}`}>
                    <td className="p-2">
                      <input type="checkbox" checked={isSel} onChange={() => toggleOne(r.id)} className="rounded" />
                    </td>
                    <td className="p-2">
                      <button onClick={() => openExposant(r.id)} className="text-left">
                        <div className="font-semibold text-slate-900 hover:underline flex items-center gap-1.5 flex-wrap">
                          <span>{r.organization?.name || '—'}</span>
                          {/* 🆕 SESSION 41 — Badge fidélité multi-éditions */}
                          {(() => {
                            const nb = r.organization?.participation_history?.nb_editions || 0;
                            if (nb >= 4) return <span className="text-[9px] bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold px-1.5 py-0.5 rounded" title={`Fidèle · ${nb} éditions`}>🏆 {nb}×</span>;
                            if (nb >= 2) return <span className="text-[9px] bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold px-1.5 py-0.5 rounded" title={`Multi-éditions · ${nb} éditions`}>🏅 {nb}×</span>;
                            if (nb === 1) return <span className="text-[9px] bg-blue-100 text-blue-700 border border-blue-200 font-medium px-1.5 py-0.5 rounded" title="Participation antérieure">1×</span>;
                            return <span className="text-[9px] bg-slate-100 text-slate-500 border border-slate-200 px-1.5 py-0.5 rounded" title="Nouveau">🆕</span>;
                          })()}
                        </div>
                        <div className="text-[10px] text-slate-500 flex items-center gap-1.5 flex-wrap">
                          <span>{r.organization?.discipline || '—'}</span>
                          {r.organization?.created_at && (
                            <span className="text-slate-400" title={new Date(r.organization.created_at).toLocaleString('fr-FR')}>
                              · créé le {new Date(r.organization.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit' })}
                            </span>
                          )}
                        </div>
                      </button>
                    </td>
                    <td className="p-2">
                      {prioOpt ? <Badge className={`${prioOpt.cls} text-[10px] font-bold`}>{prioOpt.label}</Badge> : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="p-2 text-slate-700">{venueMap[r.venue_id] || <span className="text-slate-300">—</span>}</td>
                    <td className="p-2">
                      <Select value={r.status || 'contacte'} onValueChange={(v) => updateStatus(r.id, v)}>
                        <SelectTrigger className={`h-7 text-[11px] font-medium px-2 ${opt.cls} border`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTS.map((o) => (
                            <SelectItem key={o.key} value={o.key}>
                              <span className="flex items-center gap-1.5">
                                <span className={`w-2 h-2 rounded-full ${o.dotCls}`} />
                                {o.label}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="p-2">
                      {r.is_convention_signed
                        ? <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px]">Signée</Badge>
                        : <Badge className="bg-slate-100 text-slate-600 border-slate-300 text-[10px]">Non</Badge>}
                    </td>
                    <td className="p-2">
                      {r.deposit?.amount_xpf
                        ? <span className="font-mono text-slate-800">{r.deposit.amount_xpf.toLocaleString('fr')} XPF</span>
                        : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="p-2">
                      <div className="flex items-center justify-end gap-0.5">
                        <button onClick={() => openExposant(r.id)} title="Ouvrir fiche" className="p-1.5 rounded hover:bg-slate-100 text-slate-600">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => updateStatus(r.id, 'confirme')}
                          disabled={r.status === 'confirme'}
                          title="Confirmer rapidement"
                          className="p-1.5 rounded hover:bg-emerald-100 text-emerald-600 disabled:opacity-30"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            // 🆕 SESSION 47.7 — Ouvre l'onglet Mailing avec cet exposant pré-coché (envoi unique)
                            if (!r.organization?.main_email) { toast.error('Pas d\'email enregistré pour cet exposant'); return; }
                            const url = new URL(window.location.href);
                            url.searchParams.set('tab', 'mailing');
                            url.searchParams.set('preselect', r.id);
                            window.location.href = url.toString();
                          }}
                          title={`Composer un email pour ${r.organization?.name || 'cet exposant'}`}
                          className="p-1.5 rounded hover:bg-blue-100 text-blue-600"
                        >
                          <Send className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => askDeleteSingle(r.id)} title="Supprimer" className="p-1.5 rounded hover:bg-red-100 text-red-600">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══════════════ BULK BAR (apparaît si sélection) ═══════════════ */}
      {selected.size > 0 && (
        <div className="sticky bottom-3 z-40 rounded-xl border-2 border-blue-300 bg-blue-50 shadow-lg p-3 flex flex-wrap items-center gap-2">
          <span className="font-bold text-blue-900 text-sm">{selected.size} sélectionné(s)</span>
          <div className="flex-1" />
          <div className="relative">
            <Button size="sm" onClick={() => setBulkStatusOpen((v) => !v)} disabled={busy} className="h-8 text-xs gap-1 bg-blue-600 hover:bg-blue-700 text-white">
              Changer statut <ChevronDown className="w-3 h-3" />
            </Button>
            {bulkStatusOpen && (
              <div className="absolute bottom-full mb-1.5 right-0 bg-white rounded-md shadow-lg border border-slate-200 grid grid-cols-2 gap-1 p-1.5 min-w-[260px] z-50">
                {STATUS_OPTS.map((o) => (
                  <button
                    key={o.key}
                    onClick={() => bulkUpdateStatus(o.key)}
                    disabled={busy}
                    className={`rounded px-2 py-1.5 text-xs font-medium border ${o.cls} hover:opacity-80 disabled:opacity-40`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <Button size="sm" variant="outline" onClick={bulkReminder} disabled={busy} className="h-8 text-xs gap-1">
            <Send className="w-3 h-3" /> Rappel
          </Button>
          <Button size="sm" variant="outline" onClick={() => exportCSV(selected)} disabled={busy} className="h-8 text-xs gap-1">
            <Download className="w-3 h-3" /> Export
          </Button>
          <Button size="sm" variant="outline" onClick={askDeleteBulk} disabled={busy} className="h-8 text-xs gap-1 border-red-300 text-red-700 hover:bg-red-50">
            <Trash2 className="w-3 h-3" /> Supprimer
          </Button>
          <Button size="sm" variant="ghost" onClick={clearSelection} disabled={busy} className="h-8 text-xs">
            <X className="w-3 h-3 mr-1" /> Désélectionner
          </Button>
        </div>
      )}

      {/* ═══════════════ MODALES DE SUPPRESSION ═══════════════ */}
      {deleteMode && (
        <div className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center p-4" onClick={cancelDelete}>
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <h3 className="font-bold text-base text-red-900">
                {deleteMode === 'single' && 'Supprimer cet exposant ?'}
                {deleteMode === 'bulk' && `Supprimer ${selected.size} exposant(s) ?`}
                {deleteMode === 'all' && `Supprimer TOUS les ${filtered.length} exposants affichés ?`}
              </h3>
            </div>
            <div className="text-xs text-slate-600 mb-3 space-y-1">
              <p>⚠️ Cette action est <b>irréversible</b>.</p>
              {deleteMode === 'single' && targetReg && (
                <p>Tapez le nom exact <code className="bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">{targetReg.organization?.name}</code> pour confirmer :</p>
              )}
              {deleteMode === 'bulk' && (
                <p>Tapez <code className="bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">CONFIRMER</code> pour valider :</p>
              )}
              {deleteMode === 'all' && (
                <p>Tapez <code className="bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">SUPPRIMER TOUT</code> pour valider :</p>
              )}
            </div>
            <Input
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder={
                deleteMode === 'single' ? targetReg?.organization?.name :
                deleteMode === 'bulk' ? 'CONFIRMER' : 'SUPPRIMER TOUT'
              }
              className="h-9 text-sm mb-3"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={cancelDelete} disabled={busy}>Annuler</Button>
              <Button
                size="sm"
                onClick={performDelete}
                disabled={!deleteCanProceed || busy}
                className="bg-red-700 text-white hover:bg-red-800 disabled:opacity-40 gap-1.5"
              >
                {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                Supprimer définitivement
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* showNew renvoyé au parent via callback (le NewExposantDialog est plus haut) */}
      {showNew && (
        <NewExposantInline venues={venues} onClose={() => setShowNew(false)} onCreated={async () => { setShowNew(false); await load(); toast.success('✅ Nouvel exposant créé'); }} />
      )}
    </div>
  );
}

// ╔══════════════════════════════════════════════════════╗
// 📝 MODAL "Nouveau exposant" minimaliste (inline)
// ╚══════════════════════════════════════════════════════╝
function NewExposantInline({ venues, onClose, onCreated }) {
  const [form, setForm] = useState({
    name: '', main_email: '', main_phone: '', contact_name: '',
    discipline: '', venue_id: '', priority_level: 'C',
  });
  const [submitting, setSubmitting] = useState(false);
  const submit = async () => {
    if (!form.name.trim()) { toast.error('Nom requis'); return; }
    setSubmitting(true);
    try {
      await api('/api/organizations', { method: 'POST', body: JSON.stringify({ ...form, status: 'contacte', source: 'aracom_manual' }) });
      onCreated();
    } catch (e) { toast.error(e.message); }
    setSubmitting(false);
  };
  return (
    <div className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-5 max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-base">➕ Nouvel exposant</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X className="w-4 h-4" /></button>
        </div>
        <div className="space-y-2">
          <div>
            <label className="text-[11px] text-slate-500">Nom de l&apos;organisation *</label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="ex: Tahitian Explorers" className="h-9" />
          </div>
          <div>
            <label className="text-[11px] text-slate-500">Email principal</label>
            <Input type="email" value={form.main_email} onChange={(e) => setForm({ ...form, main_email: e.target.value })} placeholder="contact@..." className="h-9" />
          </div>
          <div>
            <label className="text-[11px] text-slate-500">Téléphone</label>
            <Input type="tel" value={form.main_phone} onChange={(e) => setForm({ ...form, main_phone: e.target.value })} placeholder="ex: 87 12 34 56" className="h-9" />
          </div>
          <div>
            <label className="text-[11px] text-slate-500">Nom du contact</label>
            <Input value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} placeholder="ex: Marie Tehei" className="h-9" />
          </div>
          <div>
            <label className="text-[11px] text-slate-500">Discipline / Secteur</label>
            <Input value={form.discipline} onChange={(e) => setForm({ ...form, discipline: e.target.value })} placeholder="ex: Sport" className="h-9" />
          </div>
          <div>
            <label className="text-[11px] text-slate-500">Site préféré</label>
            <Select value={form.venue_id || '_none'} onValueChange={(v) => setForm({ ...form, venue_id: v === '_none' ? '' : v })}>
              <SelectTrigger className="h-9"><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent className="z-[300]">
                <SelectItem value="_none">—</SelectItem>
                {venues.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[11px] text-slate-500">Priorité</label>
            <Select value={form.priority_level} onValueChange={(v) => setForm({ ...form, priority_level: v })}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent className="z-[300]">
                {PRIO_OPTS.map((o) => <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button size="sm" variant="ghost" onClick={onClose} disabled={submitting}>Annuler</Button>
          <Button size="sm" onClick={submit} disabled={submitting} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1">
            {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            Créer
          </Button>
        </div>
      </div>
    </div>
  );
}

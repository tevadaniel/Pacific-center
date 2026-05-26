'use client';

import { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/auth-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { KpiCard } from '@/components/app-shell';
import { CheckCircle2, XCircle, Clock, ListChecks, RefreshCw, AlertTriangle, Calendar, MapPin, Users, ChevronUp, ChevronDown, Loader2 } from 'lucide-react';

/**
 * VALIDATION QUEUE VIEW — SESSION 47.13
 * File d'attente FIFO des demandes en attente / liste d'attente pour stands & animations.
 *
 * Endpoints :
 *  - GET  /admin/validation-queue?status=&type=&site=&date=
 *  - POST /admin/validation/:id/validate
 *  - POST /admin/validation/:id/refuse   {reason}
 *  - POST /admin/validation/bulk         {ids, type, action, reason?}
 *  - GET  /admin/validation-deadline
 *  - POST /admin/validation-deadline     {deadline:ISO}
 */
export default function ValidationQueueView() {
  const [items, setItems] = useState([]);
  const [counts, setCounts] = useState({ pending: 0, waitlist: 0, validated: 0, refused: 0 });
  const [deadlineAt, setDeadlineAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [refusing, setRefusing] = useState(null); // {id, type, organization_name, ...}
  const [refuseReason, setRefuseReason] = useState('');
  const [bulkRefusing, setBulkRefusing] = useState(false);
  const [bulkReason, setBulkReason] = useState('');
  const [showDeadlineEditor, setShowDeadlineEditor] = useState(false);
  const [newDeadline, setNewDeadline] = useState('');
  // 🆕 SESSION 47.14 — Queue d'emails à proposer après validate/refuse (validated/refused/promoted)
  // Format: [{ registration_id, subject, body_html, organization_name, kind: 'validated'|'refused'|'promoted' }, ...]
  const [emailQueue, setEmailQueue] = useState([]);

  // Filtres
  const [statusFilter, setStatusFilter] = useState('pending');
  const [typeFilter, setTypeFilter] = useState('all');
  const [siteFilter, setSiteFilter] = useState('all');
  const [search, setSearch] = useState('');

  // Sites (chargés une fois)
  const [venues, setVenues] = useState([]);

  // Sélection bulk
  const [selectedIds, setSelectedIds] = useState(new Set());

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (typeFilter !== 'all') params.set('type', typeFilter);
      if (siteFilter !== 'all') params.set('site', siteFilter);
      const qs = params.toString();
      const r = await api(`/api/admin/validation-queue${qs ? `?${qs}` : ''}`);
      setItems(r.items || []);
      setCounts(r.counts || { pending: 0, waitlist: 0, validated: 0, refused: 0 });
      setDeadlineAt(r.deadline_at || null);
      // Reset selection si elle référence des items disparus
      setSelectedIds(new Set());
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    (async () => {
      try {
        const v = await api('/api/venues?only_active=1');
        setVenues(Array.isArray(v) ? v : []);
      } catch (e) { /* silent */ }
    })();
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [statusFilter, typeFilter, siteFilter]);

  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter(it => {
      const name = it.organization?.name?.toLowerCase() || '';
      const email = it.organization?.main_email?.toLowerCase() || '';
      const venue = it.venue?.name?.toLowerCase() || '';
      const code = it.stand_code?.toLowerCase() || '';
      const title = it.title?.toLowerCase() || '';
      return name.includes(q) || email.includes(q) || venue.includes(q) || code.includes(q) || title.includes(q);
    });
  }, [items, search]);

  const allChecked = filtered.length > 0 && filtered.every(it => selectedIds.has(it.id));
  const toggleAll = () => {
    if (allChecked) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(it => it.id)));
    }
  };
  const toggleOne = (id) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };

  const selectedItems = filtered.filter(it => selectedIds.has(it.id));
  const selectedTypes = new Set(selectedItems.map(it => it.type));

  const validateOne = async (it) => {
    setBusy(true);
    try {
      const r = await api(`/api/admin/validation/${it.id}/validate`, { method: 'POST' });
      toast.success(`✅ ${it.type === 'stand' ? 'Stand' : 'Animation'} validé(e) — ${it.organization?.name || ''}`);
      // 🆕 SESSION 47.14 — Propose le template email pour notifier l'exposant
      if (r.email_template) {
        setEmailQueue([{ ...r.email_template, kind: 'validated' }]);
      }
      await load();
    } catch (e) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  const refuseOne = async () => {
    if (!refusing) return;
    if (!refuseReason.trim()) { toast.error('Motif obligatoire'); return; }
    setBusy(true);
    try {
      const r = await api(`/api/admin/validation/${refusing.id}/refuse`, {
        method: 'POST',
        body: JSON.stringify({ reason: refuseReason.trim() }),
      });
      if (r.next_in_waitlist) {
        toast.success(`❌ Refusé — ${r.next_in_waitlist.organization_name} promu(e) automatiquement (position #${r.next_in_waitlist.waitlist_position}).`);
      } else {
        toast.success('❌ Refusé.');
      }
      // 🆕 SESSION 47.14 — Queue des emails (refusé + promu si applicable)
      const queue = [];
      if (r.email_template) queue.push({ ...r.email_template, kind: 'refused' });
      if (r.promoted_email_template) queue.push({ ...r.promoted_email_template, kind: 'promoted' });
      if (queue.length > 0) setEmailQueue(queue);
      setRefusing(null);
      setRefuseReason('');
      await load();
    } catch (e) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  const bulkAction = async (action) => {
    if (selectedIds.size === 0) { toast.error('Aucune demande sélectionnée'); return; }
    if (selectedTypes.size > 1) {
      toast.error('Bulk impossible : sélection mixte (stand + animation). Filtrez par type d\'abord.');
      return;
    }
    if (action === 'refuse' && !bulkReason.trim()) {
      toast.error('Motif obligatoire pour refuser');
      return;
    }
    setBusy(true);
    try {
      const ids = Array.from(selectedIds);
      const type = Array.from(selectedTypes)[0];
      const r = await api('/api/admin/validation/bulk', {
        method: 'POST',
        body: JSON.stringify({ ids, type, action, reason: action === 'refuse' ? bulkReason.trim() : undefined }),
      });
      toast.success(`${action === 'validate' ? '✅ Validé' : '❌ Refusé'} : ${r.modified} demande(s)${r.promoted_email_templates?.length ? ` · ${r.promoted_email_templates.length} promu(s) auto` : ''}`);
      // 🆕 SESSION 47.14 — Queue tous les emails (actionned + promoted)
      const queue = [];
      (r.email_templates || []).forEach(t => queue.push({ ...t, kind: action === 'validate' ? 'validated' : 'refused' }));
      (r.promoted_email_templates || []).forEach(t => queue.push({ ...t, kind: 'promoted' }));
      if (queue.length > 0) setEmailQueue(queue);
      setBulkRefusing(false);
      setBulkReason('');
      setSelectedIds(new Set());
      await load();
    } catch (e) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  // 🆕 SESSION 47.14 — Ouvre la composer mail avec un template pré-rempli pour 1 destinataire
  const openMailComposer = (template) => {
    if (!template?.registration_id) {
      toast.error('Destinataire introuvable pour ce template');
      return;
    }
    // Encode le sujet & body en base64 (gère les caractères unicode FR via escape/unescape trick)
    const b64 = (str) => {
      try { return btoa(unescape(encodeURIComponent(str))); } catch (e) { return ''; }
    };
    const params = new URLSearchParams({
      tab: 'mailing',
      preselect: template.registration_id,
      mail_type: template.mail_type || 'info_pratique',
      prefill_subject: b64(template.subject || ''),
      prefill_body: b64(template.body_html || ''),
    });
    // Retire ce template de la queue
    setEmailQueue(q => q.filter(t => t !== template));
    // Navigate (full reload via window.location pour s'assurer que MailingView pick up les params)
    window.location.href = `/aracom?${params.toString()}`;
  };

  const skipAllEmails = () => {
    setEmailQueue([]);
    toast.info('Notifications email annulées. Vous pourrez toujours envoyer un email manuellement depuis la fiche exposant.');
  };

  const saveDeadline = async () => {
    if (!newDeadline) { toast.error('Date invalide'); return; }
    try {
      const iso = new Date(newDeadline).toISOString();
      await api('/api/admin/validation-deadline', {
        method: 'POST',
        body: JSON.stringify({ deadline: iso }),
      });
      toast.success('📅 Date butoir enregistrée');
      setShowDeadlineEditor(false);
      await load();
    } catch (e) { toast.error(e.message); }
  };

  const formatRelative = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    const now = new Date();
    const diff = (now - d) / 1000; // seconds
    if (diff < 60) return `${Math.floor(diff)} s`;
    if (diff < 3600) return `${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} h`;
    return `${Math.floor(diff / 86400)} j`;
  };

  const statusBadge = (s) => {
    if (s === 'pending') return <Badge className="bg-amber-100 text-amber-800 border-amber-300">⏳ En attente</Badge>;
    if (s === 'waitlist') return <Badge className="bg-violet-100 text-violet-800 border-violet-300">📋 Liste d&apos;attente</Badge>;
    if (s === 'validated') return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300">✅ Validée</Badge>;
    if (s === 'refused') return <Badge className="bg-rose-100 text-rose-800 border-rose-300">❌ Refusée</Badge>;
    return <Badge variant="outline">{s}</Badge>;
  };

  const deadlineLocalValue = () => {
    if (!deadlineAt) return '';
    const d = new Date(deadlineAt);
    const tz = d.getTime() - d.getTimezoneOffset() * 60000;
    return new Date(tz).toISOString().slice(0, 16);
  };

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="⏳ En attente" value={counts.pending} accent="amber" />
        <KpiCard label="📋 Liste d'attente" value={counts.waitlist} accent="violet" />
        <KpiCard label="✅ Validées" value={counts.validated} accent="emerald" />
        <KpiCard label="❌ Refusées" value={counts.refused} accent="rose" />
      </div>

      {/* Bandeau explicatif + deadline */}
      <Card className="border-indigo-200 bg-indigo-50/30">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start gap-3">
            <ListChecks className="w-5 h-5 shrink-0 mt-0.5 text-indigo-700" />
            <div className="flex-1 text-sm text-indigo-900">
              <b>File de validation FIFO :</b> les demandes apparaissent par ordre de soumission (plus anciennes en haut). Validez ou refusez avant la date butoir. Le refus d&apos;une demande <i>en attente</i> promeut automatiquement le 1er de la liste d&apos;attente.
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 pt-2 border-t border-indigo-200">
            <div className="text-sm flex items-center gap-2 text-indigo-900">
              <Calendar className="w-4 h-4" />
              <span>Date butoir validation :</span>
              <b>{deadlineAt ? new Date(deadlineAt).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' }) : 'Non définie'}</b>
            </div>
            <Button size="sm" variant="outline" onClick={() => { setNewDeadline(deadlineLocalValue()); setShowDeadlineEditor(true); }}>
              <Calendar className="w-4 h-4 mr-1" /> Modifier
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Filtres */}
      <Card>
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-5 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1 block">Statut</label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">⏳ En attente</SelectItem>
                <SelectItem value="waitlist">📋 Liste d&apos;attente</SelectItem>
                <SelectItem value="validated">✅ Validées</SelectItem>
                <SelectItem value="refused">❌ Refusées</SelectItem>
                <SelectItem value="all">Tous</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1 block">Type</label>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Stand + Animation</SelectItem>
                <SelectItem value="stand">🏪 Stand</SelectItem>
                <SelectItem value="animation">🎭 Animation</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1 block">Site</label>
            <Select value={siteFilter} onValueChange={setSiteFilter}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les sites</SelectItem>
                {venues.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <label className="text-xs font-semibold text-slate-500 mb-1 block">Recherche</label>
            <Input className="h-9" placeholder="Org, email, stand, titre…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {/* Bulk bar */}
      {selectedIds.size > 0 && (
        <Card className="border-2 border-blue-300 bg-blue-50">
          <CardContent className="p-3 flex items-center justify-between flex-wrap gap-2">
            <div className="text-sm font-semibold text-blue-900">
              {selectedIds.size} demande{selectedIds.size > 1 ? 's' : ''} sélectionnée{selectedIds.size > 1 ? 's' : ''}
              {selectedTypes.size > 1 && (
                <span className="ml-2 text-rose-700 text-xs">⚠️ Sélection mixte — filtrez par type pour activer le bulk</span>
              )}
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setSelectedIds(new Set())}>Annuler la sélection</Button>
              <Button size="sm" disabled={busy || selectedTypes.size > 1} className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => bulkAction('validate')}>
                <CheckCircle2 className="w-4 h-4 mr-1" /> Valider en masse
              </Button>
              <Button size="sm" disabled={busy || selectedTypes.size > 1} className="bg-rose-600 hover:bg-rose-700 text-white" onClick={() => setBulkRefusing(true)}>
                <XCircle className="w-4 h-4 mr-1" /> Refuser en masse
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <ListChecks className="w-5 h-5 text-indigo-600" />
              File FIFO — {filtered.length} demande{filtered.length > 1 ? 's' : ''}
            </CardTitle>
            <Button size="sm" variant="ghost" onClick={load} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Actualiser
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-12 text-center text-slate-500"><Loader2 className="w-5 h-5 animate-spin inline mr-2" />Chargement…</div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-slate-400">Aucune demande pour ce filtre.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="px-3 py-2 text-left w-10"><Checkbox checked={allChecked} onCheckedChange={toggleAll} /></th>
                    <th className="px-3 py-2 text-left">Soumis</th>
                    <th className="px-3 py-2 text-left">Type</th>
                    <th className="px-3 py-2 text-left">Exposant</th>
                    <th className="px-3 py-2 text-left">Site / Détails</th>
                    <th className="px-3 py-2 text-left">Statut</th>
                    <th className="px-3 py-2 text-left">Position</th>
                    <th className="px-3 py-2 text-right pr-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((it, idx) => (
                    <tr key={it.id} className={`border-b hover:bg-slate-50 ${selectedIds.has(it.id) ? 'bg-blue-50' : ''}`}>
                      <td className="px-3 py-2"><Checkbox checked={selectedIds.has(it.id)} onCheckedChange={() => toggleOne(it.id)} /></td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1 text-xs">
                          <span className="font-mono text-slate-500">#{idx + 1}</span>
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span title={new Date(it.request_submitted_at).toLocaleString('fr-FR')}>{formatRelative(it.request_submitted_at)}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        {it.type === 'stand' ? (
                          <Badge variant="outline" className="border-blue-300 text-blue-700">🏪 Stand</Badge>
                        ) : (
                          <Badge variant="outline" className="border-violet-300 text-violet-700">🎭 Anim</Badge>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-semibold text-slate-900">{it.organization?.name || '—'}</div>
                        <div className="text-xs text-slate-500">{it.organization?.main_email || ''}</div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="text-xs flex items-center gap-1 text-slate-600">
                          <MapPin className="w-3 h-3" /> {it.venue?.name || '—'}
                        </div>
                        {it.type === 'stand' ? (
                          <div className="text-xs font-mono mt-1">{it.stand_code || '—'}</div>
                        ) : (
                          <div className="text-xs mt-1">
                            {it.day_label === 'samedi' ? 'Sam' : 'Ven'} {it.start_time}–{it.end_time}
                            <span className="ml-1 text-slate-500">({it.location_type === 'sur_stand' ? 'stand' : 'démo'})</span>
                            {it.title && <div className="text-slate-500 italic truncate max-w-[200px]">« {it.title} »</div>}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2">{statusBadge(it.request_status)}</td>
                      <td className="px-3 py-2">
                        {it.request_status === 'waitlist' && it.waitlist_position && (
                          <Badge variant="outline" className="border-violet-300 text-violet-700">#{it.waitlist_position}</Badge>
                        )}
                        {it.next_in_waitlist && (
                          <div className="text-xs text-slate-500 mt-1">
                            Suivant : <b>{it.next_in_waitlist.name}</b> (#{it.next_in_waitlist.waitlist_position})
                          </div>
                        )}
                        {it.refused_reason && (
                          <div className="text-xs text-rose-700 italic mt-1">{it.refused_reason}</div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right pr-4">
                        {(it.request_status === 'pending' || it.request_status === 'waitlist') && (
                          <div className="flex gap-1 justify-end">
                            <Button size="sm" disabled={busy} className="h-7 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => validateOne(it)}>
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="sm" disabled={busy} variant="outline" className="h-7 border-rose-300 text-rose-700 hover:bg-rose-50" onClick={() => { setRefusing(it); setRefuseReason(''); }}>
                              <XCircle className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog : refus unitaire */}
      <Dialog open={!!refusing} onOpenChange={(v) => !v && setRefusing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Refuser la demande</DialogTitle>
            <DialogDescription>
              {refusing?.organization?.name} — {refusing?.type === 'stand' ? `Stand ${refusing?.stand_code}` : `${refusing?.day_label} ${refusing?.start_time}–${refusing?.end_time}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-600">Motif (obligatoire) — sera communiqué à l&apos;exposant</label>
            <Textarea rows={3} value={refuseReason} onChange={(e) => setRefuseReason(e.target.value)} placeholder="Ex: Doublon avec une demande prioritaire / Date incompatible…" />
            <div className="text-xs bg-amber-50 border-l-4 border-amber-400 p-2 rounded-r text-amber-900">
              💡 Le 1er exposant en liste d&apos;attente (s&apos;il y en a un) sera automatiquement promu en position pending.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefusing(null)} disabled={busy}>Annuler</Button>
            <Button onClick={refuseOne} disabled={busy || !refuseReason.trim()} className="bg-rose-600 hover:bg-rose-700 text-white">
              {busy && <Loader2 className="w-4 h-4 animate-spin mr-2" />}❌ Confirmer le refus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog : refus en masse */}
      <Dialog open={bulkRefusing} onOpenChange={(v) => !v && setBulkRefusing(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Refuser {selectedIds.size} demande{selectedIds.size > 1 ? 's' : ''} en masse</DialogTitle>
            <DialogDescription>
              Type : {Array.from(selectedTypes)[0]}. Le motif sera identique pour toutes les demandes sélectionnées.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-600">Motif (obligatoire)</label>
            <Textarea rows={3} value={bulkReason} onChange={(e) => setBulkReason(e.target.value)} placeholder="Ex: Date butoir dépassée / Doublons…" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkRefusing(false)} disabled={busy}>Annuler</Button>
            <Button onClick={() => bulkAction('refuse')} disabled={busy || !bulkReason.trim()} className="bg-rose-600 hover:bg-rose-700 text-white">
              {busy && <Loader2 className="w-4 h-4 animate-spin mr-2" />}❌ Refuser en masse
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog : date butoir */}
      <Dialog open={showDeadlineEditor} onOpenChange={(v) => !v && setShowDeadlineEditor(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>📅 Date butoir de validation</DialogTitle>
            <DialogDescription>
              Date avant laquelle ARACOM doit avoir validé / refusé toutes les demandes en attente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Input type="datetime-local" value={newDeadline} onChange={(e) => setNewDeadline(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeadlineEditor(false)}>Annuler</Button>
            <Button onClick={saveDeadline} className="bg-indigo-600 hover:bg-indigo-700 text-white">Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 🆕 SESSION 47.14 — Dialog Notification Email Queue */}
      <Dialog open={emailQueue.length > 0} onOpenChange={(v) => { if (!v) skipAllEmails(); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              📧 Notifier {emailQueue.length} exposant{emailQueue.length > 1 ? 's' : ''} ?
            </DialogTitle>
            <DialogDescription>
              Un template d&apos;email a été pré-rempli pour chaque exposant concerné. Cliquez sur <b>« Préparer l&apos;email »</b> pour ouvrir le composer (modifiable avant envoi). Vous pourrez aussi ignorer cette étape et envoyer manuellement plus tard.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {emailQueue.map((t, idx) => {
              const kindLabel = t.kind === 'validated' ? '✅ Validé' : t.kind === 'refused' ? '❌ Refusé' : '🎉 Promu de waitlist';
              const kindClass = t.kind === 'validated' ? 'border-emerald-300 bg-emerald-50' : t.kind === 'refused' ? 'border-rose-300 bg-rose-50' : 'border-violet-300 bg-violet-50';
              return (
                <div key={idx} className={`border-2 rounded-lg p-3 ${kindClass}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-xs">{kindLabel}</Badge>
                        <span className="font-semibold text-slate-900 truncate">{t.organization_name || '—'}</span>
                      </div>
                      <div className="text-xs text-slate-600 truncate">{t.organization_email || '(email non disponible)'}</div>
                      <div className="text-sm font-medium text-slate-800 mt-2 italic">« {t.subject} »</div>
                    </div>
                    <Button size="sm" onClick={() => openMailComposer(t)} className="bg-indigo-600 hover:bg-indigo-700 text-white shrink-0">
                      📧 Préparer l&apos;email
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={skipAllEmails}>Ignorer toutes les notifications</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

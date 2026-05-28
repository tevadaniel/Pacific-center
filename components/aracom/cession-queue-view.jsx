'use client';
import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Loader2, RefreshCw, CheckCircle2, XCircle, Mail, Send, ArrowRight, Eye } from 'lucide-react';

async function adminApi(path, opts = {}) {
  const r = await fetch(`/api${path}`, {
    headers: {
      'Content-Type': 'application/json',
      'x-user-role': 'aracom_admin',
      'x-user-id': 'u-admin',
      ...(opts.headers || {}),
    },
    ...opts,
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || r.statusText);
  return d;
}

const STATUS_BADGES = {
  pending_approval: { label: '⏳ En attente d\'approbation', color: 'bg-amber-100 text-amber-800 border-amber-300' },
  available_for_promotion: { label: '🔔 Offerte au candidat', color: 'bg-blue-100 text-blue-800 border-blue-300' },
  transferred: { label: '✅ Transférée', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  cancelled: { label: '❌ Annulée', color: 'bg-slate-100 text-slate-700 border-slate-300' },
};

export default function CessionQueueView() {
  const [items, setItems] = useState([]);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all');
  const [busy, setBusy] = useState({});
  const [previewOpen, setPreviewOpen] = useState(null); // assignment object
  const [cancelDialog, setCancelDialog] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await adminApi(`/admin/cessions?status=${filter}`);
      setItems(d.items || []);
      setCounts(d.counts || {});
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const approve = async (asnId) => {
    setBusy(b => ({ ...b, [asnId]: 'approve' }));
    try {
      const d = await adminApi(`/admin/cession/${asnId}/approve`, { method: 'POST' });
      if (d.offer?.ok) {
        toast.success(`✅ Cession approuvée. Offre envoyée à ${d.offer.organization_name || 'candidat'} (waitlist #${d.offer.waitlist_position || 1}).`);
      } else {
        toast.warning(`Cession approuvée mais aucun candidat en liste d'attente. Le stand reste disponible.`);
      }
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(b => { const n = { ...b }; delete n[asnId]; return n; });
    }
  };

  const cancel = async (asnId) => {
    setBusy(b => ({ ...b, [asnId]: 'cancel' }));
    try {
      await adminApi(`/admin/cession/${asnId}/cancel`, { method: 'POST' });
      toast.success('Cession annulée.');
      setCancelDialog(null);
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(b => { const n = { ...b }; delete n[asnId]; return n; });
    }
  };

  const initiateAdmin = async (regId, standCode) => {
    // Not used in this view, but available for fiche-exposant
  };

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Object.entries(STATUS_BADGES).map(([k, b]) => (
          <Card key={k} className={`cursor-pointer transition ${filter === k ? 'ring-2 ring-aracom-orange' : ''}`} onClick={() => setFilter(k)}>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-aracom-black">{counts[k] || 0}</div>
              <div className="text-[11px] uppercase tracking-wider text-slate-500 mt-1">{b.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Header */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-xl font-bold text-aracom-black flex items-center gap-2">
                🔁 File de cession des créneaux
              </h2>
              <p className="text-xs text-slate-500 mt-1">Demandes d'exposants validés souhaitant céder leur package (stand + animations). Anonymisé pour les bénéficiaires.</p>
            </div>
            <div className="flex items-center gap-2">
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les cessions</SelectItem>
                  <SelectItem value="pending_approval">⏳ En attente</SelectItem>
                  <SelectItem value="available_for_promotion">🔔 Offerte</SelectItem>
                  <SelectItem value="transferred">✅ Transférée</SelectItem>
                  <SelectItem value="cancelled">❌ Annulée</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={load} disabled={loading} className="gap-2">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                Rafraîchir
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-slate-500"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
          ) : items.length === 0 ? (
            <div className="p-8 text-center text-slate-500">Aucune cession dans ce statut.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b text-[11px] uppercase tracking-wider text-slate-600">
                  <tr>
                    <th className="text-left p-3">Demandé le</th>
                    <th className="text-left p-3">Cédant</th>
                    <th className="text-left p-3">Site / Stand</th>
                    <th className="text-left p-3">Animations</th>
                    <th className="text-left p-3">Statut</th>
                    <th className="text-left p-3">Bénéficiaire</th>
                    <th className="text-left p-3">Waitlist</th>
                    <th className="text-right p-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(it => {
                    const b = STATUS_BADGES[it.cession_status] || { label: it.cession_status, color: 'bg-slate-100' };
                    return (
                      <tr key={it.assignment_id} className="border-b hover:bg-slate-50/50">
                        <td className="p-3 text-xs text-slate-600">{new Date(it.cession_requested_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</td>
                        <td className="p-3">
                          <div className="font-semibold text-aracom-black">{it.cedant?.name || '—'}</div>
                          <div className="text-[11px] text-slate-500 truncate max-w-[180px]">{it.cedant?.main_email}</div>
                        </td>
                        <td className="p-3">
                          <div className="font-mono text-aracom-orange font-bold">{it.stand_code}</div>
                          <div className="text-[11px] text-slate-500">{it.venue?.name}</div>
                        </td>
                        <td className="p-3 text-xs">{it.animations?.length || 0} créneau(x)</td>
                        <td className="p-3"><Badge variant="outline" className={b.color}>{b.label}</Badge></td>
                        <td className="p-3">
                          {it.candidate ? (
                            <div>
                              <div className="text-xs font-semibold text-aracom-black">{it.candidate.name}</div>
                              <div className="text-[10px] text-slate-500 truncate max-w-[180px]">{it.candidate.main_email}</div>
                            </div>
                          ) : it.cession_status === 'available_for_promotion' ? (
                            <span className="text-xs text-slate-400 italic">Aucun candidat</span>
                          ) : <span className="text-xs text-slate-400">—</span>}
                        </td>
                        <td className="p-3 text-xs text-center">{it.waitlist_count} en attente</td>
                        <td className="p-3 text-right">
                          <div className="flex items-center gap-1 justify-end flex-wrap">
                            <Button size="sm" variant="outline" className="gap-1 h-7 px-2 text-xs" onClick={() => setPreviewOpen(it)}>
                              <Eye className="w-3 h-3" /> Détails
                            </Button>
                            {it.cession_status === 'pending_approval' && (
                              <Button
                                size="sm"
                                className="gap-1 h-7 px-2 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                                onClick={() => approve(it.assignment_id)}
                                disabled={!!busy[it.assignment_id]}
                              >
                                {busy[it.assignment_id] === 'approve' ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                                Approuver
                              </Button>
                            )}
                            {(it.cession_status === 'pending_approval' || it.cession_status === 'available_for_promotion') && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1 h-7 px-2 text-xs border-rose-300 text-rose-600 hover:bg-rose-50"
                                onClick={() => setCancelDialog(it)}
                                disabled={!!busy[it.assignment_id]}
                              >
                                <XCircle className="w-3 h-3" /> Annuler
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preview dialog */}
      <Dialog open={!!previewOpen} onOpenChange={(v) => !v && setPreviewOpen(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Détails de la cession</DialogTitle></DialogHeader>
          {previewOpen && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><b className="text-slate-500 text-xs uppercase">Cédant</b><div>{previewOpen.cedant?.name}</div><div className="text-xs text-slate-500">{previewOpen.cedant?.main_email}</div></div>
                <div><b className="text-slate-500 text-xs uppercase">Stand</b><div className="font-mono text-aracom-orange font-bold">{previewOpen.stand_code}</div><div className="text-xs text-slate-500">{previewOpen.venue?.name}</div></div>
                <div><b className="text-slate-500 text-xs uppercase">Statut</b><div>{STATUS_BADGES[previewOpen.cession_status]?.label}</div></div>
                <div><b className="text-slate-500 text-xs uppercase">Demandé par</b><div>{previewOpen.cession_requested_by === 'exposant' ? 'Exposant' : 'ARACOM'}</div></div>
                {previewOpen.cession_reason && <div className="col-span-2"><b className="text-slate-500 text-xs uppercase">Motif</b><div className="italic">« {previewOpen.cession_reason} »</div></div>}
                {previewOpen.candidate && (
                  <div className="col-span-2"><b className="text-slate-500 text-xs uppercase">Bénéficiaire</b><div>{previewOpen.candidate.name}</div><div className="text-xs text-slate-500">{previewOpen.candidate.main_email}</div></div>
                )}
              </div>
              <div>
                <b className="text-slate-500 text-xs uppercase">Animations dans le package</b>
                {Array.isArray(previewOpen.animations) && previewOpen.animations.length > 0 ? (
                  <ul className="mt-2 space-y-1">
                    {previewOpen.animations.map(a => (
                      <li key={a.id} className="text-xs">
                        📅 {a.day_label === 'samedi' ? 'Sam.' : 'Ven.'} {a.start_time}–{a.end_time} · {a.location_type === 'sur_stand' ? 'sur stand' : 'zone démo'}
                        {a.title && <span className="italic"> · « {a.title} »</span>}
                      </li>
                    ))}
                  </ul>
                ) : <div className="text-xs italic text-slate-400 mt-1">Aucune animation liée</div>}
              </div>
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setPreviewOpen(null)}>Fermer</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel confirmation dialog */}
      <Dialog open={!!cancelDialog} onOpenChange={(v) => !v && setCancelDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Annuler cette cession ?</DialogTitle></DialogHeader>
          <div className="text-sm text-slate-700 space-y-2">
            <p>L'exposant <b>{cancelDialog?.cedant?.name}</b> conservera son stand <b>{cancelDialog?.stand_code}</b>.</p>
            {cancelDialog?.candidate && <p className="text-xs bg-amber-50 border border-amber-200 rounded p-2">⚠️ Une offre a déjà été envoyée à <b>{cancelDialog.candidate.name}</b>. Pensez à les notifier.</p>}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCancelDialog(null)}>Retour</Button>
            <Button onClick={() => cancel(cancelDialog.assignment_id)} disabled={!!busy[cancelDialog?.assignment_id]} className="bg-rose-600 hover:bg-rose-700 text-white">
              {busy[cancelDialog?.assignment_id] === 'cancel' && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Annuler la cession
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

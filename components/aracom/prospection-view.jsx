'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, Trash2 } from 'lucide-react';
import { api } from '@/lib/auth-client';
import { KpiCard } from '@/components/app-shell';
import HelpCard from '@/components/help-card';
import { PROSPECT_STATUS_DEFINITIONS } from '@/lib/constants';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

const PROSPECT_STATUS_ARACOM = [
  { value: 'a_contacter', label: 'À contacter', color: 'bg-slate-100 text-slate-700' },
  { value: 'contacte', label: 'Contacté', color: 'bg-blue-100 text-blue-700' },
  { value: 'interesse', label: 'Intéressé', color: 'bg-amber-100 text-amber-700' },
  { value: 'converti', label: '✓ Converti', color: 'bg-emerald-100 text-emerald-700' },
  { value: 'refuse', label: 'Refusé', color: 'bg-rose-100 text-rose-700' },
  { value: 'abandonne', label: 'Abandonné', color: 'bg-slate-100 text-slate-500' },
];

/**
 * PROSPECTION ARACOM VIEW — Vue consolidée des prospects gérés par les Pacific Centers.
 *
 * Endpoints utilisés :
 *  - GET    /api/prospects                    (liste consolidée)
 *  - GET    /api/prospects/stats              (KPIs)
 *  - PUT    /api/prospects/:id                (changement de statut)
 *  - POST   /api/prospects/:id/notes          (ajout de note)
 *  - POST   /api/prospects/:id/convert        (conversion en exposant)
 *  - DELETE /api/prospects/:id
 */
export default function ProspectionAracomView() {
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

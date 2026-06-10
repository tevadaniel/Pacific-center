'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Building2, Phone, Mail, Calendar, Lock, FileText, Sparkles, Send, CheckCircle2 } from 'lucide-react';
import AiInsightTrigger from '@/components/ai-insight-trigger';
import { api } from '@/lib/auth-client';
import { KpiCard } from '@/components/app-shell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { ExposantLink } from './exposant-panel-context';

/**
 * VALIDATIONS VIEW — Gestion du workflow de verrouillage (RDV caution + lock).
 *
 * Endpoints :
 *  - GET  /api/validation-requests
 *  - POST /api/validation-requests/:id/set-rdv
 *  - POST /api/validation-requests/:id/lock
 *  - POST /api/validation-requests/:id/cancel
 */
export default function ValidationsView() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('en_attente');
  const [showRdv, setShowRdv] = useState(null);
  const [showLock, setShowLock] = useState(null);
  // 🆕 SESSION 52g.5 — Filtre par jour de présence
  const [dayFilter, setDayFilter] = useState('all'); // 'all' | 'vendredi' | 'samedi' | 'both'

  const load = async () => {
    setLoading(true);
    try { setRequests(await api('/api/validation-requests')); }
    catch (e) { toast.error(e.message); }
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

  // 🆕 SESSION 52g.5 — Helper de filtrage par jour
  const matchesDay = (r) => {
    const days = Array.isArray(r.attending_days) ? r.attending_days : [];
    if (dayFilter === 'all') return true;
    if (dayFilter === 'vendredi') return days.includes('vendredi');
    if (dayFilter === 'samedi') return days.includes('samedi');
    if (dayFilter === 'both') return days.includes('vendredi') && days.includes('samedi');
    return true;
  };

  const counts = {
    en_attente: requests.filter(r => r.status === 'en_attente' && matchesDay(r)).length,
    rdv_fixe: requests.filter(r => r.status === 'rdv_fixe' && matchesDay(r)).length,
    verrouille: requests.filter(r => r.status === 'verrouille' && matchesDay(r)).length,
    annulee: requests.filter(r => r.status === 'annulee' && matchesDay(r)).length,
  };

  // 🆕 Compteurs par jour pour l'onglet actif
  const tabRequests = requests.filter(r => r.status === tab);
  const dayCounts = {
    ven: tabRequests.filter(r => (r.attending_days || []).includes('vendredi') && !(r.attending_days || []).includes('samedi')).length,
    sam: tabRequests.filter(r => (r.attending_days || []).includes('samedi') && !(r.attending_days || []).includes('vendredi')).length,
    both: tabRequests.filter(r => (r.attending_days || []).includes('vendredi') && (r.attending_days || []).includes('samedi')).length,
    unknown: tabRequests.filter(r => !(r.attending_days || []).length).length,
  };

  const filtered = requests.filter(r => r.status === tab && matchesDay(r));

  if (loading) return <div className="py-12 text-center text-slate-500">Chargement…</div>;

  return (
    <div className="space-y-4">
      {/* 🆕 SESSION 52g.5 — Filtre par jour de présence + compteurs */}
      <div className="flex items-center gap-2 flex-wrap">
        <Calendar className="w-4 h-4 text-slate-600" />
        <span className="text-sm font-semibold text-slate-700">Filtrer par jour :</span>
        <Select value={dayFilter} onValueChange={setDayFilter}>
          <SelectTrigger className="h-9 w-48 text-xs" data-testid="validations-day-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">📅 Tous les jours</SelectItem>
            <SelectItem value="vendredi">🟦 Vendredi 14/08</SelectItem>
            <SelectItem value="samedi">🟪 Samedi 15/08</SelectItem>
            <SelectItem value="both">✅ Vendredi + Samedi</SelectItem>
          </SelectContent>
        </Select>
        <Badge className="text-[10px] bg-blue-100 text-blue-900 border-blue-300 border" title="Sur l'onglet courant : présents vendredi seul">📅 Ven seul : {dayCounts.ven}</Badge>
        <Badge className="text-[10px] bg-purple-100 text-purple-900 border-purple-300 border" title="Sur l'onglet courant : présents samedi seul">📅 Sam seul : {dayCounts.sam}</Badge>
        <Badge className="text-[10px] bg-emerald-100 text-emerald-900 border-emerald-300 border" title="Sur l'onglet courant : présents les deux jours">V+S : {dayCounts.both}</Badge>
        {dayCounts.unknown > 0 && <Badge className="text-[10px] bg-slate-100 text-slate-700 border-slate-300 border" title="Sur l'onglet courant : jours non définis">? : {dayCounts.unknown}</Badge>}
      </div>

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
            <b>Workflow de verrouillage :</b> l&apos;exposant clique sur <i>« Confirmer ma présence »</i> ⟶ vous fixez un RDV pour la remise du <b>chèque</b> (20 000 XPF à l&apos;ordre d&apos;ARACOM) ⟶ vous encaissez ⟶ vous verrouillez la demande ⟶ l&apos;application confirme l&apos;inscription, marque la caution comme reçue, génère automatiquement le reçu et l&apos;envoie à l&apos;exposant par email.
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
  const paymentLabel = '💳 Chèque';
  const accent = req.status === 'en_attente' ? 'border-amber-300 bg-amber-50/40'
    : req.status === 'rdv_fixe' ? 'border-blue-300 bg-blue-50/40'
    : req.status === 'verrouille' ? 'border-emerald-300 bg-emerald-50/40'
    : 'border-slate-200 bg-slate-50/40';
  // 🆕 SESSION 52g.5 — Badges des jours de présence
  const days = Array.isArray(req.attending_days) ? req.attending_days : [];
  const hasVen = days.includes('vendredi');
  const hasSam = days.includes('samedi');
  return (
    <Card className={`border-2 ${accent}`}>
      <CardContent className="p-4">
        <div className="flex flex-wrap items-start gap-3 justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <Building2 className="w-4 h-4 text-slate-500" />
              <AiInsightTrigger registration={{ id: req.registration_id || req.id, ai_insight: req.ai_insight, ai_insight_vigilance: req.ai_insight_vigilance, ai_insight_generated_at: req.ai_insight_generated_at }} size="xs" />
              <ExposantLink id={req.registration_id || req.id} className="font-bold text-base">{req.organization?.name || '—'}</ExposantLink>
              <Badge variant="secondary" className="text-xs">{req.organization?.discipline || '—'}</Badge>
              {/* 🆕 Badges jours de présence */}
              {hasVen && <Badge className="text-[10px] bg-blue-100 text-blue-900 border-blue-300 border h-5">📅 Ven</Badge>}
              {hasSam && <Badge className="text-[10px] bg-purple-100 text-purple-900 border-purple-300 border h-5">📅 Sam</Badge>}
              {!hasVen && !hasSam && <Badge className="text-[10px] bg-slate-100 text-slate-600 border-slate-300 border h-5" title="Jours non définis">? jours</Badge>}
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
              <div className="mt-2 text-xs text-emerald-700">🔒 Verrouillée le {new Date(req.locked_at).toLocaleString('fr-FR')} · {(req.amount_xpf || 20000).toLocaleString('fr-FR')} XPF en chèque</div>
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
  const paymentLabel = 'Chèque';
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
  // 🆕 SESSION 48n — Caution = Chèque uniquement (plus de choix de mode)
  const [form, setForm] = useState({ payment_mode: 'cheque', amount_xpf: 20000 });
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
            <div className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 flex items-center gap-2">
              <span className="text-xl">💳</span>
              <span><b>Mode de paiement :</b> Chèque (à l&apos;ordre d&apos;ARACOM) — seul mode accepté.</span>
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

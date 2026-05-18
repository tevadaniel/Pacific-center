'use client';

import { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { Send, Mail, Filter, Search, Phone, AlertCircle, Download } from 'lucide-react';
import AiInsightTrigger from '@/components/ai-insight-trigger';
import { api } from '@/lib/auth-client';
import { KpiCard } from '@/components/app-shell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ExposantLink } from './exposant-panel-context';

/**
 * RELANCES VIEW — Module avancé de relances exposants avec filtres + actions de masse.
 */
const RELANCE_STATUS_CONFIG = [
  {
    key: 'caution_a_regler',
    label: 'Caution à régler',
    emoji: '💰',
    color: 'red',
    subject: '[Forum 2026] Rappel — Caution de 20 000 XPF à régler',
    body: `<p>Bonjour,</p><p>Nous n'avons pas encore reçu votre <b>caution de 20 000 XPF</b> pour votre participation au Forum de la Rentrée 2026.</p><p>📌 <b>Modes acceptés :</b> chèque, espèces ou virement bancaire.</p><p>Sans ce versement, votre stand ne pourra pas être verrouillé. Merci de prendre rendez-vous au plus vite.</p><p>L'équipe ARACOM</p>`,
    filter: (r) => r.deposit_status !== 'recue' && r.status !== 'annule' && r.status !== 'prospect',
    actions: ['mail', 'export_dossier'],
  },
  {
    key: 'rdv_a_prendre',
    label: 'RDV caution à prendre',
    emoji: '📅',
    color: 'orange',
    subject: '[Forum 2026] Prenez rendez-vous pour la remise de votre caution',
    body: `<p>Bonjour,</p><p>Afin de finaliser votre inscription au Forum de la Rentrée 2026, vous devez <b>fixer un rendez-vous</b> avec ARACOM pour la remise de votre caution de 20 000 XPF.</p><p>Merci de nous indiquer vos disponibilités (matin, après-midi, en semaine ou samedi) en répondant à ce mail.</p><p>L'équipe ARACOM</p>`,
    filter: (r) => !r.validation_request_id && r.deposit_status !== 'recue' && r.venue_id && r.stand_code && r.status !== 'confirme',
    actions: ['mail'],
  },
  {
    key: 'remboursement_attente',
    label: 'Remboursement en attente',
    emoji: '↩️',
    color: 'emerald',
    subject: '[Forum 2026] Remboursement de votre caution — Attestation',
    body: `<p>Bonjour,</p><p>Suite à votre participation au Forum de la Rentrée 2026 et à la complétion de votre questionnaire de satisfaction, votre <b>caution de 20 000 XPF</b> sera prochainement remboursée.</p><p>Vous trouverez l'attestation de remboursement dans votre espace exposant. Nous reviendrons vers vous pour finaliser le remboursement.</p><p>L'équipe ARACOM</p>`,
    filter: (r) => r.status === 'confirme' && r.deposit_status === 'recue' && r.has_satisfaction_response,
    actions: ['mail', 'export_attestation'],
  },
  {
    key: 'documents_manquants',
    label: 'Documents manquants',
    emoji: '📄',
    color: 'amber',
    subject: '[Forum 2026] Documents manquants à fournir',
    body: `<p>Bonjour,</p><p>Pour finaliser votre inscription, il vous reste à déposer les documents suivants dans votre espace exposant :</p><ul><li>{{DOCS_MISSING}}</li></ul><p>Merci de vous connecter à votre <a href="{{PORTAL_URL}}">espace exposant</a> pour les déposer.</p><p>L'équipe ARACOM</p>`,
    filter: (r) => !r.is_convention_signed || !r.is_insurance_uploaded,
    actions: ['mail', 'export_dossier'],
  },
];

export default function RelancesView() {
  const [rows, setRows] = useState([]);
  const [regs, setRegs] = useState([]);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ registration_id: '', task_type: 'appel', title: '', due_date: '', notes: '' });
  // 🆕 Module Relances ciblées
  const [selectedStatus, setSelectedStatus] = useState('caution_a_regler');
  const [selectedRegs, setSelectedRegs] = useState(new Set());
  const [mailSubject, setMailSubject] = useState('');
  const [mailBody, setMailBody] = useState('');
  const [sending, setSending] = useState(false);
  const [satisfactionMap, setSatisfactionMap] = useState({});

  const load = () => api('/api/tasks').then(setRows);
  useEffect(() => {
    load();
    api('/api/registrations').then(setRegs);
    api('/api/admin/satisfaction-responses').then(r => {
      const map = {};
      (r || []).forEach(s => { if (s.organization_id) map[s.organization_id] = true; });
      setSatisfactionMap(map);
    }).catch(() => {});
  }, []);

  const enrichedRegs = useMemo(() => regs.map(r => ({
    ...r,
    deposit_status: r.deposit?.status || null,
    has_satisfaction_response: !!satisfactionMap[r.organization?.id || r.organization_id],
  })), [regs, satisfactionMap]);

  // Initial subject/body when status changes
  useEffect(() => {
    const cfg = RELANCE_STATUS_CONFIG.find(c => c.key === selectedStatus);
    if (cfg) {
      setMailSubject(cfg.subject);
      setMailBody(cfg.body);
      setSelectedRegs(new Set()); // reset selection
    }
  }, [selectedStatus]);

  const currentCfg = RELANCE_STATUS_CONFIG.find(c => c.key === selectedStatus);
  const filteredRegs = enrichedRegs.filter(currentCfg?.filter || (() => true));

  const toggleReg = (id) => {
    const s = new Set(selectedRegs);
    if (s.has(id)) s.delete(id); else s.add(id);
    setSelectedRegs(s);
  };
  const toggleAll = () => {
    if (selectedRegs.size === filteredRegs.length) setSelectedRegs(new Set());
    else setSelectedRegs(new Set(filteredRegs.map(r => r.id)));
  };

  const sendBulkMail = async () => {
    if (selectedRegs.size === 0) { toast.error('Sélectionnez au moins un exposant'); return; }
    if (!mailSubject.trim() || !mailBody.trim()) { toast.error('Sujet et corps requis'); return; }
    if (!confirm(`Envoyer ce mail de relance à ${selectedRegs.size} exposant(s) ?`)) return;
    setSending(true);
    try {
      const ids = Array.from(selectedRegs);
      const res = await api('/api/mailing/send', {
        method: 'POST',
        body: JSON.stringify({
          registration_ids: ids,
          subject: mailSubject,
          body_html: mailBody,
          mail_type: `relance_${selectedStatus}`,
        }),
      });
      toast.success(`📤 ${res.sent || ids.length} mail(s) envoyé(s)`);
      setSelectedRegs(new Set());
    } catch (e) { toast.error(e.message); }
    setSending(false);
  };

  const exportSelection = async (type) => {
    if (selectedRegs.size === 0) { toast.error('Sélectionnez au moins un exposant'); return; }
    try {
      const ids = Array.from(selectedRegs);
      const resp = await fetch('/api/admin/export-documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-role': 'aracom_admin' },
        body: JSON.stringify({ type, registration_ids: ids }),
      });
      if (!resp.ok) throw new Error('Export échoué');
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Export_${type}_${new Date().toISOString().slice(0, 10)}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('📦 ZIP téléchargé');
    } catch (e) { toast.error(e.message); }
  };

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
      {/* 🎯 Section Relances ciblées par statut */}
      <Card className="border-2 border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2 text-orange-900">
            🎯 Relances ciblées par statut
          </CardTitle>
          <p className="text-xs text-orange-800 mt-1">Filtrez les exposants par <b>statut</b>, sélectionnez ceux à relancer, puis envoyez un mail pré-rempli ou exportez leur dossier.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Filtre statut */}
          <div className="flex flex-wrap gap-2">
            {RELANCE_STATUS_CONFIG.map(cfg => {
              const count = enrichedRegs.filter(cfg.filter).length;
              const active = selectedStatus === cfg.key;
              return (
                <Button key={cfg.key} size="sm" variant={active ? 'default' : 'outline'}
                  onClick={() => setSelectedStatus(cfg.key)}
                  className={active ? `bg-${cfg.color}-600 hover:bg-${cfg.color}-700 gap-1` : 'gap-1'}>
                  <span>{cfg.emoji}</span> {cfg.label} <Badge variant="secondary" className="ml-1 bg-white/30">{count}</Badge>
                </Button>
              );
            })}
          </div>

          {/* Sujet + corps pré-remplis */}
          <div className="grid md:grid-cols-2 gap-3 pt-2 border-t border-orange-200">
            <div>
              <Label className="text-xs uppercase">Objet du mail (pré-rempli)</Label>
              <Input value={mailSubject} onChange={e => setMailSubject(e.target.value)} className="mt-1" />
            </div>
            <div className="flex items-end gap-2">
              <Button onClick={sendBulkMail} disabled={sending || selectedRegs.size === 0} className="bg-orange-600 hover:bg-orange-700 gap-2 flex-1">
                <Send className="w-4 h-4" /> {sending ? 'Envoi…' : `Envoyer (${selectedRegs.size})`}
              </Button>
              {currentCfg?.actions?.includes('export_dossier') && (
                <Button onClick={() => exportSelection('all')} variant="outline" className="border-blue-300 text-blue-700 gap-1">
                  <Download className="w-4 h-4" /> Dossier ZIP
                </Button>
              )}
              {currentCfg?.actions?.includes('export_attestation') && (
                <Button onClick={() => exportSelection('all')} variant="outline" className="border-emerald-300 text-emerald-700 gap-1">
                  <Download className="w-4 h-4" /> Attestations
                </Button>
              )}
            </div>
            <div className="md:col-span-2">
              <Label className="text-xs uppercase">Corps (HTML)</Label>
              <Textarea rows={5} value={mailBody} onChange={e => setMailBody(e.target.value)} className="mt-1 font-mono text-xs" />
            </div>
          </div>

          {/* Liste exposants avec checkboxes */}
          <div className="pt-2 border-t border-orange-200">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-semibold text-orange-900">
                {filteredRegs.length} exposant(s) concerné(s)
              </div>
              <Button size="sm" variant="ghost" onClick={toggleAll} className="text-xs">
                {selectedRegs.size === filteredRegs.length && filteredRegs.length > 0 ? '☑️ Tout désélectionner' : '⬜ Tout sélectionner'}
              </Button>
            </div>
            <div className="max-h-72 overflow-y-auto bg-white rounded-md border border-orange-200">
              {filteredRegs.length === 0 ? (
                <div className="p-6 text-center text-slate-500 text-sm">Aucun exposant ne correspond à ce statut. 🎉</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-orange-100 text-xs uppercase text-orange-900 sticky top-0">
                    <tr><th className="px-3 py-2 w-8"></th><th className="text-left">Exposant</th><th className="text-left">Email</th><th className="text-left">Site / Stand</th><th className="text-left">Statut</th></tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredRegs.map(r => (
                      <tr key={r.id} className={selectedRegs.has(r.id) ? 'bg-orange-50' : ''}>
                        <td className="px-3 py-2"><input type="checkbox" checked={selectedRegs.has(r.id)} onChange={() => toggleReg(r.id)} /></td>
                        <td className="font-medium">{r.organization?.name || '—'}</td>
                        <td className="text-xs text-slate-600">{r.organization?.main_email || '—'}</td>
                        <td className="text-xs"><span className="font-mono">{r.stand_code || '—'}</span> · {r.venue?.name || '—'}</td>
                        <td><Badge variant="secondary" className="text-[10px]">{r.status}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section Tâches manuelles (conservée) */}
      <div className="flex items-center justify-between pt-4 border-t">
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
                <td className="text-slate-700"><div className="flex items-center gap-1.5">{t.registration_id && <AiInsightTrigger registration={{ id: t.registration_id }} size="xs" />}<ExposantLink id={t.registration_id}>{t.organization_name}</ExposantLink> • <span className="font-mono text-xs">{t.stand_code}</span></div></td>
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

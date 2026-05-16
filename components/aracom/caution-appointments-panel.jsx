'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Plus, Wallet } from 'lucide-react';
import { api } from '@/lib/auth-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

// =====================================================================
// 🆕 Bouton ARACOM : Enregistrement d'un virement reçu (référence + date)
// =====================================================================
export function RegisterVirementButton({ registrationId, defaultRef = '', defaultDate = '', alreadyValidated = false, onDone }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    virement_reference: defaultRef,
    virement_date: defaultDate || new Date().toISOString().slice(0, 10),
  });
  const submit = async () => {
    if (!form.virement_reference.trim() || !form.virement_date) {
      return toast.error('Référence et date du virement requises');
    }
    setBusy(true);
    try {
      await api(`/api/admin/register-virement/${registrationId}`, {
        method: 'POST',
        body: JSON.stringify(form),
      });
      toast.success('✅ Virement enregistré — caution validée, stand verrouillé, reçu généré.');
      setOpen(false);
      if (onDone) onDone();
    } catch (e) { toast.error(e.message); }
    setBusy(false);
  };
  return (
    <>
      <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-cyan-300 text-cyan-700 hover:bg-cyan-50" onClick={() => setOpen(true)} title="Confirmer la réception du virement bancaire">
        🏦 {alreadyValidated ? 'Virement OK' : 'Valider virement'}
      </Button>
      {open && (
        <Dialog open onOpenChange={() => !busy && setOpen(false)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>🏦 Enregistrer le virement reçu</DialogTitle>
              <DialogDescription>
                Confirme la réception du virement de <b>20 000 XPF</b>. La caution sera marquée comme reçue, le stand verrouillé, et le reçu de caution sera généré automatiquement.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div>
                <Label className="text-xs">Référence du virement *</Label>
                <Input value={form.virement_reference} onChange={e => setForm({ ...form, virement_reference: e.target.value })} placeholder="Ex : VIR-20260815-001" className="font-mono text-xs" disabled={busy} />
                {defaultRef && <p className="text-[10px] text-slate-500 mt-1">Référence déclarée par l&apos;exposant : <b className="font-mono">{defaultRef}</b></p>}
              </div>
              <div>
                <Label className="text-xs">Date du virement *</Label>
                <Input type="date" value={form.virement_date} onChange={e => setForm({ ...form, virement_date: e.target.value })} disabled={busy} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Annuler</Button>
              <Button onClick={submit} disabled={busy} className="bg-cyan-600 hover:bg-cyan-700 gap-2">
                {busy ? 'Enregistrement…' : '✅ Valider la réception'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

// =====================================================================
// 🆕 Bouton ARACOM : Génère + ouvre l'attestation imprimable (2 exemplaires)
// =====================================================================
export function GeneratePrintAttestationButton({ registrationId, onDone }) {
  const [busy, setBusy] = useState(false);
  const generate = async () => {
    setBusy(true);
    try {
      const res = await api(`/api/admin/refund-attestation/${registrationId}/generate`, { method: 'POST', body: '{}' });
      toast.success('✅ Attestation générée — ouverture pour impression');
      window.open(`/api/documents/${res.document_id}/download`, '_blank');
      if (onDone) onDone();
    } catch (e) { toast.error(e.message); }
    setBusy(false);
  };
  return (
    <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-blue-300 text-blue-700 hover:bg-blue-50" onClick={generate} disabled={busy} title="Génère et ouvre l'attestation prête à imprimer en 2 exemplaires">
      🖨️ {busy ? '…' : 'Attestation x2'}
    </Button>
  );
}

// =====================================================================
// 🆕 Bouton ARACOM pour uploader la version signée de l'attestation de remboursement
// =====================================================================
export function UploadSignedAttestationButton({ registrationId, onDone }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const submit = async (file) => {
    if (!file) return;
    if (file.size > 6 * 1024 * 1024) { toast.error('Fichier trop volumineux (max 6 Mo)'); return; }
    setBusy(true);
    try {
      const buf = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result.split(',')[1]); r.onerror = rej; r.readAsDataURL(file); });
      await api(`/api/admin/refund-attestation/${registrationId}/upload`, {
        method: 'POST',
        body: JSON.stringify({ file_name: file.name, mime_type: file.type || 'application/pdf', file_base64: buf }),
      });
      toast.success('✅ Attestation signée déposée dans l\'espace de l\'exposant');
      setOpen(false);
      if (onDone) onDone();
    } catch (e) { toast.error(e.message); }
    setBusy(false);
  };
  return (
    <>
      <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-emerald-300 text-emerald-700 hover:bg-emerald-50" onClick={() => setOpen(true)} title="Uploader la version signée de l'attestation">
        📎 Attestation signée
      </Button>
      {open && (
        <Dialog open onOpenChange={() => !busy && setOpen(false)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Déposer l&apos;attestation signée</DialogTitle>
              <DialogDescription>
                Uploadez la version <b>finale signée</b> par les deux parties (ARACOM + exposant). Elle remplacera la version auto générée dans l&apos;espace de l&apos;exposant.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <Input type="file" accept="application/pdf,image/*" onChange={e => submit(e.target.files?.[0])} disabled={busy} />
              <p className="text-xs text-slate-500 italic">Format conseillé : PDF · 6 Mo max</p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Annuler</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

// =====================================================================
// Dialog édition / création d'un RDV de restitution caution
// =====================================================================
function CautionAppointmentEditDialog({ appointment, onClose, onSaved }) {
  const isNew = appointment?.id === 'new';
  const [registrations, setRegistrations] = useState([]);
  const [selectedReg, setSelectedReg] = useState(isNew ? '' : appointment.registration_id);
  const [date, setDate] = useState(appointment?.confirmed_date || appointment?.requested_date || '2026-08-17');
  const [time, setTime] = useState(appointment?.confirmed_time || appointment?.requested_time || '10:00');
  const [place, setPlace] = useState(appointment?.confirmed_place || appointment?.requested_place || 'aracom_paea');
  const [placeCustom, setPlaceCustom] = useState(appointment?.confirmed_place_custom || appointment?.requested_place_custom || '');
  const [adminNote, setAdminNote] = useState(appointment?.admin_note || '');
  const [status, setStatus] = useState(appointment?.status || 'confirme');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isNew) api('/api/registrations').then(setRegistrations);
  }, [isNew]);

  const save = async () => {
    if (!date || !time) { toast.error('Date et heure requises'); return; }
    if (place === 'autre' && !placeCustom.trim()) { toast.error('Précisez le lieu (autre)'); return; }
    setBusy(true);
    try {
      if (isNew) {
        if (!selectedReg) { toast.error('Choisir un exposant'); setBusy(false); return; }
        const reg = registrations.find(r => r.id === selectedReg);
        await api('/api/admin/caution-appointments/create', {
          method: 'POST',
          body: JSON.stringify({
            registration_id: selectedReg,
            organization_id: reg?.organization_id,
            confirmed_date: date,
            confirmed_time: time,
            confirmed_place: place,
            confirmed_place_custom: placeCustom,
            admin_note: adminNote,
          }),
        });
        toast.success('RDV créé + email envoyé ✅');
      } else {
        await api('/api/admin/caution-appointments/update', {
          method: 'POST',
          body: JSON.stringify({
            id: appointment.id,
            status,
            confirmed_date: date,
            confirmed_time: time,
            confirmed_place: place,
            confirmed_place_custom: placeCustom,
            admin_note: adminNote,
          }),
        });
        toast.success('RDV mis à jour + email envoyé ✅');
      }
      onSaved();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const PLACE_OPTIONS = [
    { key: 'aracom_paea', label: '🏢 ARACOM Paea (siège)' },
    { key: 'sur_site',    label: '🎪 Sur site (jour J)' },
    { key: 'autre',       label: '📍 Autre lieu' },
  ];

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isNew ? '➕ Nouveau RDV restitution caution' : `🗓️ Modifier le RDV — ${appointment.organization_name || ''}`}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {isNew && (
            <div>
              <Label className="text-xs font-semibold">Exposant</Label>
              <Select value={selectedReg} onValueChange={setSelectedReg}>
                <SelectTrigger><SelectValue placeholder="Choisir un exposant…" /></SelectTrigger>
                <SelectContent className="max-h-80">
                  {registrations.map(r => (
                    <SelectItem key={r.id} value={r.id}>{r.organization?.name} — {r.venue?.name} ({r.stand_code})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {!isNew && (
            <div>
              <Label className="text-xs font-semibold">Statut</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="confirme">✅ Confirmer</SelectItem>
                  <SelectItem value="propose">📅 Proposer un autre créneau</SelectItem>
                  <SelectItem value="restitue">🎉 Caution restituée</SelectItem>
                  <SelectItem value="annule">❌ Annuler</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs font-semibold">Date</Label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs font-semibold">Heure</Label>
              <Input type="time" value={time} onChange={e => setTime(e.target.value)} />
            </div>
          </div>
          <div>
            <Label className="text-xs font-semibold">Lieu confirmé</Label>
            <Select value={place} onValueChange={setPlace}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PLACE_OPTIONS.map(o => <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
            {place === 'autre' && (
              <Input className="mt-2" value={placeCustom} onChange={e => setPlaceCustom(e.target.value)} placeholder="Précisez l'adresse / le lieu" />
            )}
            {appointment?.requested_place && appointment?.requested_place !== place && !isNew && (
              <p className="text-[10px] text-amber-700 mt-1">Demande initiale exposant : <b>{appointment.requested_place === 'sur_site' ? 'Sur site' : appointment.requested_place === 'autre' ? (appointment.requested_place_custom || 'Autre') : 'ARACOM Paea'}</b></p>
            )}
          </div>
          <div>
            <Label className="text-xs font-semibold">Note pour l&apos;exposant (incluse dans l&apos;email)</Label>
            <Textarea rows={3} value={adminNote} onChange={e => setAdminNote(e.target.value)} placeholder="Informations complémentaires, parking, accès, etc." />
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-md p-2.5 text-xs text-blue-800">
            📧 <b>Email automatique</b> envoyé à l&apos;exposant avec les détails du RDV (date, heure, <b>lieu</b>).
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Annuler</Button>
          <Button onClick={save} disabled={busy} className="bg-orange-600 hover:bg-orange-700 gap-2">
            {busy ? 'Envoi…' : '💾 Enregistrer & envoyer email'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =====================================================================
// 🗓️ ADMIN — Panneau de gestion des RDV de restitution caution
// =====================================================================
export default function CautionAppointmentsAdminPanel() {
  const [appts, setAppts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);

  const load = () => {
    setLoading(true);
    api('/api/admin/caution-appointments')
      .then(d => { setAppts(d); setLoading(false); })
      .catch(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const update = async (id, status, extra = {}) => {
    try {
      await api('/api/admin/caution-appointments/update', {
        method: 'POST',
        body: JSON.stringify({ id, status, ...extra }),
      });
      toast.success(
        status === 'confirme' ? 'RDV confirmé + email envoyé ✅' :
        status === 'propose'  ? 'Nouveau créneau proposé + email envoyé 📧' :
        status === 'restitue' ? 'Caution restituée enregistrée 🎉' :
        status === 'annule'   ? 'RDV annulé + email envoyé ❌' :
        'Mis à jour ✅'
      );
      setEditing(null);
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }) : '—';
  const statusBadge = (s) => {
    const map = {
      demande:  { label: '🕒 Demandé',   cls: 'bg-amber-100 text-amber-800 border-amber-300' },
      propose:  { label: '📅 Proposé',   cls: 'bg-blue-100 text-blue-800 border-blue-300' },
      confirme: { label: '✅ Confirmé',  cls: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
      restitue: { label: '🎉 Restitué', cls: 'bg-violet-100 text-violet-800 border-violet-300' },
      annule:   { label: '❌ Annulé',    cls: 'bg-slate-100 text-slate-600 border-slate-300' },
    };
    return map[s] || { label: s, cls: '' };
  };

  const counts = {
    demande:  appts.filter(a => a.status === 'demande').length,
    propose:  appts.filter(a => a.status === 'propose').length,
    confirme: appts.filter(a => a.status === 'confirme').length,
    restitue: appts.filter(a => a.status === 'restitue').length,
    annule:   appts.filter(a => a.status === 'annule').length,
  };

  return (
    <>
      <Card className="border-amber-300 shadow-sm">
        <CardHeader className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-t-lg pb-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Wallet className="w-4 h-4 text-orange-600" /> RDV restitution caution
              </CardTitle>
              <p className="text-xs text-slate-600 mt-1">Confirmez, modifiez ou planifiez les RDV pour rendre la caution aux exposants. Email automatique envoyé à chaque action.</p>
            </div>
            <Button size="sm" onClick={() => setEditing({ id: 'new' })} className="bg-orange-600 hover:bg-orange-700 gap-1 h-8">
              <Plus className="w-3.5 h-3.5" /> Nouveau RDV
            </Button>
          </div>
          <div className="grid grid-cols-5 gap-2 mt-3">
            {Object.entries(counts).map(([k, n]) => (
              <div key={k} className="text-center p-2 rounded-md bg-white border">
                <div className="text-xs text-slate-500">{statusBadge(k).label}</div>
                <div className="text-lg font-bold text-slate-800">{n}</div>
              </div>
            ))}
          </div>
        </CardHeader>
        <CardContent className="p-3">
          {loading ? (
            <div className="text-sm text-slate-500 text-center py-8">Chargement…</div>
          ) : appts.length === 0 ? (
            <div className="text-sm text-slate-500 text-center py-8 italic">Aucun RDV pour le moment. Les RDV apparaîtront ici dès qu&apos;un exposant remplit son questionnaire de satisfaction.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-[10px] uppercase tracking-wider text-slate-500 border-b">
                  <tr>
                    <th className="text-left p-2">Exposant</th>
                    <th className="text-left p-2">Site / Stand</th>
                    <th className="text-left p-2">Caution</th>
                    <th className="text-left p-2">Questionnaire</th>
                    <th className="text-left p-2">Demande exposant</th>
                    <th className="text-left p-2">RDV confirmé</th>
                    <th className="text-left p-2">Lieu</th>
                    <th className="text-left p-2">Statut</th>
                    <th className="text-right p-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {appts.map(a => {
                    const placeKey = a.confirmed_place || a.requested_place || 'aracom_paea';
                    const placeCustom = a.confirmed_place_custom || a.requested_place_custom || '';
                    const placeShort = placeKey === 'sur_site' ? '🎪 Sur site' : placeKey === 'autre' ? `📍 ${placeCustom || 'Autre'}` : '🏢 ARACOM Paea';
                    return (
                    <tr key={a.id} className="border-b hover:bg-slate-50">
                      <td className="p-2">
                        <div className="font-semibold text-slate-800">{a.organization_name || '—'}</div>
                        <div className="text-xs text-slate-500">{a.contact_name || ''}</div>
                        <div className="text-xs text-slate-400">{a.organization_email || ''}</div>
                      </td>
                      <td className="p-2 text-xs">
                        <div>{a.venue_name || '—'}</div>
                        <div className="text-slate-500">Stand {a.stand_code || '—'}</div>
                      </td>
                      <td className="p-2 text-xs">
                        <Badge variant="outline" className={a.deposit_status === 'recue' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-600'}>
                          {a.deposit_status === 'recue' ? '✓ Reçue' : a.deposit_status || '—'}
                        </Badge>
                        <div className="text-slate-400 mt-1">{a.deposit_amount?.toLocaleString('fr-FR')} XPF</div>
                      </td>
                      <td className="p-2 text-xs">
                        {a.survey_submitted ? (
                          <Badge className="bg-blue-100 text-blue-700 border-blue-200">✓ Rempli</Badge>
                        ) : (
                          <Badge variant="outline" className="text-slate-500">En attente</Badge>
                        )}
                      </td>
                      <td className="p-2 text-xs">
                        <div>{fmtDate(a.requested_date)}</div>
                        <div className="text-slate-500">{a.requested_time}</div>
                      </td>
                      <td className="p-2 text-xs">
                        {a.confirmed_date ? (
                          <>
                            <div className="font-semibold text-emerald-700">{fmtDate(a.confirmed_date)}</div>
                            <div className="text-emerald-600">{a.confirmed_time}</div>
                          </>
                        ) : <span className="text-slate-400 italic">—</span>}
                      </td>
                      <td className="p-2 text-xs" title={placeCustom || placeShort}>
                        <Badge variant="outline" className={placeKey === 'sur_site' ? 'bg-violet-50 text-violet-800 border-violet-200' : placeKey === 'autre' ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-blue-50 text-blue-800 border-blue-200'}>
                          {placeShort}
                        </Badge>
                      </td>
                      <td className="p-2">
                        <Badge variant="outline" className={statusBadge(a.status).cls}>
                          {statusBadge(a.status).label}
                        </Badge>
                      </td>
                      <td className="p-2 text-right">
                        <div className="flex gap-1 justify-end flex-wrap">
                          {a.status === 'demande' && a.preferred_payment !== 'virement' && (
                            <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                              onClick={() => update(a.id, 'confirme', { confirmed_date: a.requested_date, confirmed_time: a.requested_time, confirmed_place: a.requested_place || 'aracom_paea', confirmed_place_custom: a.requested_place_custom || '' })}>
                              ✓ Confirmer
                            </Button>
                          )}
                          {a.preferred_payment !== 'virement' && (
                            <Button size="sm" variant="outline" className="h-7 text-xs"
                              onClick={() => setEditing(a)}>
                              Modifier
                            </Button>
                          )}
                          {a.preferred_payment === 'virement' && a.registration_id && (
                            <RegisterVirementButton
                              registrationId={a.registration_id}
                              defaultRef={a.virement_reference || ''}
                              defaultDate={a.virement_date || ''}
                              alreadyValidated={a.deposit_status === 'recue'}
                              onDone={load}
                            />
                          )}
                          {a.status === 'confirme' && (
                            <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-violet-300 text-violet-700 hover:bg-violet-50"
                              onClick={() => {
                                if (!window.confirm('Confirmer que la caution a été restituée à l\'exposant et que l\'attestation a été signée en 2 exemplaires ?')) return;
                                update(a.id, 'restitue');
                              }}>
                              🎉 Restitué
                            </Button>
                          )}
                          {a.registration_id && (
                            <GeneratePrintAttestationButton registrationId={a.registration_id} onDone={load} />
                          )}
                          {a.survey_submitted && a.registration_id && (
                            <UploadSignedAttestationButton registrationId={a.registration_id} onDone={load} />
                          )}
                        </div>
                      </td>
                    </tr>
                  );})}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {editing && (
        <CautionAppointmentEditDialog
          appointment={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </>
  );
}

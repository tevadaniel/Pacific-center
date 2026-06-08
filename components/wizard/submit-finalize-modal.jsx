'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { toast } from 'sonner';
import {
  CheckCircle2, AlertCircle, Calendar, Clock, Banknote, FileText,
  Upload, ChevronRight, Loader2, X, Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';

/**
 * 🆕 SESSION 47 — Modal post-soumission (Wizard Étape 5)
 *
 * S'ouvre quand l'exposant clique sur le bouton final "Soumettre ma demande".
 * Permet de compléter :
 *  - Mode de règlement de la caution (Chèque uniquement)
 *  - Date + heure libres pour déposer la caution + documents
 *  - Statut des documents (déjà uploadés ou à apporter le jour J)
 *
 * Props :
 *  - open : boolean
 *  - onClose : fn
 *  - onConfirm : ({ caution_payment_method, caution_deposit_date, caution_deposit_time, bring_documents_to_rdv, missing_documents_note }) => Promise<void>
 *  - state : objet wizard state complet (registration, organization, documents, etc.)
 */
export default function SubmitFinalizeModal({ open, onClose, onConfirm, state, registrationId, saving }) {
  const [paymentMethod, setPaymentMethod] = useState('cheque');
  const [depositDate, setDepositDate] = useState('');
  const [depositTime, setDepositTime] = useState('14:00');
  const [bringToRdv, setBringToRdv] = useState(true);
  const [note, setNote] = useState('');
  const [uploadingDoc, setUploadingDoc] = useState(null);

  // Documents requis vs uploadés
  const reg = state?.registration || {};
  const docs = state?.documents || state?.required_documents || [];
  // Heuristiques de statut sur les documents requis
  const conventionSigned = reg.is_convention_signed || docs.find(d => /convention/i.test(d.kind || d.name) && d.uploaded);
  const insuranceUploaded = reg.is_insurance_uploaded || docs.find(d => /assurance|insurance/i.test(d.kind || d.name) && d.uploaded);
  const requiredDocs = useMemo(() => ([
    { id: 'convention', label: 'Convention signée', ok: !!conventionSigned, hint: 'Convention de location de stand signée' },
    { id: 'insurance', label: 'Attestation d\'assurance', ok: !!insuranceUploaded, hint: 'Responsabilité civile pour l\'événement' },
  ]), [conventionSigned, insuranceUploaded]);

  const missingDocs = requiredDocs.filter(d => !d.ok);
  const allDocsOk = missingDocs.length === 0;

  // Date minimum : aujourd'hui
  const today = new Date().toISOString().slice(0, 10);
  // Date maximum : 14 août 2026 (jour J)
  const eventDay = '2026-08-14';

  useEffect(() => {
    if (open) {
      // Pré-remplir avec les valeurs existantes si déjà saisies
      setPaymentMethod(reg.caution_payment_method || '');
      if (reg.caution_deposit_at) {
        const d = new Date(reg.caution_deposit_at);
        setDepositDate(d.toISOString().slice(0, 10));
        setDepositTime(d.toTimeString().slice(0, 5));
      } else {
        setDepositDate('');
        setDepositTime('14:00');
      }
      setBringToRdv(reg.bring_documents_to_rdv !== false);
      setNote(reg.missing_documents_note || '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const validate = () => {
    if (!paymentMethod) { toast.error('Choisissez votre mode de règlement'); return false; }
    if (!depositDate) { toast.error('Choisissez une date de dépôt'); return false; }
    if (!depositTime) { toast.error('Choisissez une heure de dépôt'); return false; }
    return true;
  };

  const handleConfirm = async () => {
    if (!validate()) return;
    await onConfirm({
      caution_payment_method: paymentMethod,
      caution_deposit_date: depositDate,
      caution_deposit_time: depositTime,
      bring_documents_to_rdv: !allDocsOk && bringToRdv,
      missing_documents_note: missingDocs.length > 0 ? note : null,
    });
  };

  // Quick upload d'un document via /api/registrations/:id/documents
  const handleQuickUpload = async (docId, file) => {
    if (!file || !registrationId) return;
    setUploadingDoc(docId);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('kind', docId);
      const r = await fetch(`/api/registrations/${registrationId}/documents`, { method: 'POST', body: fd });
      if (!r.ok) {
        const t = await r.text();
        throw new Error(t || 'Upload échoué');
      }
      toast.success(`✅ ${docId === 'convention' ? 'Convention' : 'Attestation'} envoyée`);
      // Refresh du parent pour mettre à jour les flags
      window.dispatchEvent(new CustomEvent('wizard:refresh-state'));
    } catch (e) { toast.error(`Erreur : ${e.message}`); }
    finally { setUploadingDoc(null); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Sparkles className="w-6 h-6 text-emerald-600" />
            Finalisons votre inscription
          </DialogTitle>
          <DialogDescription>
            Quelques dernières informations avant de soumettre votre demande à ARACOM.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* ───── Section 1 : Mode de règlement de la caution ───── */}
          <section className="border-2 border-violet-200 bg-violet-50/40 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Banknote className="w-5 h-5 text-violet-600" />
              <h3 className="font-bold text-slate-900">Caution par chèque</h3>
            </div>
            <p className="text-xs text-slate-600">Caution de <b>20 000 XPF</b> par site, par <b>chèque uniquement</b> à l&apos;ordre d&apos;ARACOM. Restituée après l&apos;événement.</p>
            <div className="rounded-md border-2 border-violet-300 bg-white px-3 py-2.5 flex items-center gap-3">
              <span className="text-2xl">📃</span>
              <div>
                <div className="font-semibold text-sm">Chèque — à l&apos;ordre d&apos;ARACOM</div>
                <div className="text-[11px] text-slate-500">Seul mode de règlement accepté pour la caution.</div>
              </div>
            </div>
          </section>

          {/* ───── Section 2 : Date + heure de dépôt ───── */}
          <section className="border-2 border-blue-200 bg-blue-50/40 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-600" />
              <h3 className="font-bold text-slate-900">Jour & heure du dépôt <span className="text-rose-600">*</span></h3>
            </div>
            <p className="text-xs text-slate-600">Choisissez librement le moment où vous viendrez déposer la caution et vos documents auprès d'ARACOM.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Date</label>
                <input
                  type="date"
                  value={depositDate}
                  min={today}
                  max={eventDay}
                  onChange={e => setDepositDate(e.target.value)}
                  className="w-full border-2 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Heure</label>
                <input
                  type="time"
                  value={depositTime}
                  onChange={e => setDepositTime(e.target.value)}
                  className="w-full border-2 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
                />
              </div>
            </div>
            {depositDate && depositTime && (
              <div className="bg-white border border-blue-200 rounded p-2 text-xs text-blue-800 flex items-center gap-2">
                <Clock className="w-3.5 h-3.5" />
                Rendez-vous prévu le <b>{new Date(`${depositDate}T${depositTime}`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</b> à <b>{depositTime}</b>
              </div>
            )}
          </section>

          {/* ───── Section 3 : Documents ───── */}
          <section className={`border-2 rounded-lg p-4 space-y-3 ${allDocsOk ? 'border-emerald-200 bg-emerald-50/40' : 'border-amber-300 bg-amber-50/40'}`}>
            <div className="flex items-center gap-2">
              <FileText className={`w-5 h-5 ${allDocsOk ? 'text-emerald-600' : 'text-amber-600'}`} />
              <h3 className="font-bold text-slate-900">Documents requis</h3>
              {allDocsOk ? (
                <Badge className="bg-emerald-100 border-emerald-300 text-emerald-800 ml-auto">✓ Tous complets</Badge>
              ) : (
                <Badge className="bg-amber-100 border-amber-300 text-amber-800 ml-auto">{missingDocs.length} manquant{missingDocs.length > 1 ? 's' : ''}</Badge>
              )}
            </div>

            <div className="space-y-2">
              {requiredDocs.map(d => (
                <div key={d.id} className={`flex items-center gap-3 p-2.5 rounded-md border ${d.ok ? 'bg-emerald-100/60 border-emerald-200' : 'bg-white border-amber-200'}`}>
                  {d.ok ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{d.label}</div>
                    <div className="text-[11px] text-slate-500">{d.hint}</div>
                  </div>
                  {!d.ok && (
                    <label className={`cursor-pointer text-xs font-medium px-2.5 py-1 rounded border-2 border-amber-300 bg-white hover:bg-amber-100 text-amber-700 flex items-center gap-1 ${uploadingDoc === d.id ? 'opacity-50 pointer-events-none' : ''}`}>
                      {uploadingDoc === d.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                      Uploader
                      <input
                        type="file"
                        className="hidden"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={e => e.target.files?.[0] && handleQuickUpload(d.id, e.target.files[0])}
                      />
                    </label>
                  )}
                </div>
              ))}
            </div>

            {/* Message rassurant si docs manquants */}
            {!allDocsOk && (
              <div className="space-y-3 pt-2 border-t border-amber-200">
                <div className="bg-white border-2 border-amber-300 rounded-md p-3">
                  <div className="font-semibold text-amber-900 text-sm flex items-center gap-1.5 mb-1.5">
                    <Sparkles className="w-4 h-4" /> Pas de panique !
                  </div>
                  <p className="text-xs text-amber-800 leading-snug">
                    Vous pouvez <b>apporter directement les documents manquants le jour du dépôt de la caution</b>. Cochez ci-dessous si c'est votre cas, ou uploadez-les maintenant depuis cette fenêtre. ARACOM sera prévenu.
                  </p>
                </div>
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={bringToRdv}
                    onChange={e => setBringToRdv(e.target.checked)}
                    className="mt-0.5"
                  />
                  <div className="text-sm">
                    <b>Oui, j'apporterai les documents manquants</b> le jour du RDV avec ARACOM
                  </div>
                </label>
                {bringToRdv && (
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">Une précision pour ARACOM ? (optionnel)</label>
                    <Textarea
                      value={note}
                      onChange={e => setNote(e.target.value)}
                      maxLength={500}
                      rows={2}
                      placeholder="Ex : Je dois encore signer la convention chez le notaire, je l'apporte le jour J…"
                      className="text-sm"
                    />
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Récapitulatif final */}
          {paymentMethod && depositDate && (
            <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border-2 border-emerald-200 rounded-lg p-3 text-xs text-emerald-900">
              <div className="font-bold mb-1 flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> Récapitulatif</div>
              <div>💰 Caution 20 000 XPF en <b>chèque</b> (à l&apos;ordre d&apos;ARACOM)</div>
              <div>📅 Dépôt le <b>{new Date(`${depositDate}T${depositTime}`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</b> à <b>{depositTime}</b></div>
              <div>📋 Documents : <b>{allDocsOk ? 'tous OK' : `${missingDocs.length} à apporter${bringToRdv ? ' le jour J' : ''}`}</b></div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            <X className="w-4 h-4 mr-1" /> Annuler
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={saving || !paymentMethod || !depositDate || !depositTime}
            className="bg-emerald-600 hover:bg-emerald-700 gap-1.5"
            data-testid="confirm-finalize"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
            Soumettre ma demande
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

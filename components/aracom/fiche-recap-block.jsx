'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Send, ExternalLink, FileCheck2, CheckCircle2, Loader2, Mail, Calendar, AlertCircle } from 'lucide-react';
import { api } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

/**
 * 🆕 SESSION 48d — Section "Fiche récap & Confirmation" dans la fiche admin
 *
 * Permet à ARACOM :
 *   1. Visualiser la fiche auto-générée (lien vers /exposant/annexe/:regId)
 *   2. Envoyer un email de confirmation à l'exposant (avec template pré-rempli, modifiable)
 *   3. Voir le statut "Email envoyé le XX/XX/XXXX par YYYY"
 *
 * Backend : POST /api/admin/registrations/:id/send-confirmation
 */
export default function FicheRecapBlock({ registration, organization, venue, onRefresh }) {
  const r = registration || {};
  const o = organization || {};
  const v = venue || {};
  const [openDlg, setOpenDlg] = useState(false);
  const [sending, setSending] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [subject, setSubject] = useState(
    `[Forum Rentrée 2026] ✅ Votre inscription est confirmée — Stand ${r.stand_code || ''}`.trim()
  );
  const [bodyExtra, setBodyExtra] = useState(
    'Bonjour,\n\nNous avons le plaisir de vous confirmer votre participation au Forum de la Rentrée 2026.\n\n' +
    'Votre fiche récapitulative est disponible dans votre espace exposant. ' +
    'Vous y trouverez tous les détails : stand, animations, jours de présence, et la convention à signer.\n\n' +
    'Préparez votre venue avec la caution de 20 000 XPF par chèque ' +
    'et n\'hésitez pas à nous contacter pour toute question.\n\n' +
    'Cordialement,\nL\'équipe ARACOM'
  );

  const annexeUrl = r.id ? `/exposant/annexe/${r.id}` : null;

  const send = async () => {
    if (!r.id) return toast.error('Inscription manquante');
    if (!subject.trim()) return toast.error('Sujet requis');
    if (!o.main_email) return toast.error('Aucun email exposant — saisissez-le dans la section Contact');
    setSending(true);
    try {
      const res = await api(`/api/admin/registrations/${r.id}/send-confirmation`, {
        method: 'POST',
        body: JSON.stringify({ subject, body_extra: bodyExtra }),
      });
      toast.success(`✅ Email envoyé à ${res?.recipient || o.main_email}`);
      setOpenDlg(false);
      if (onRefresh) onRefresh();
    } catch (e) {
      toast.error(e.message || 'Échec de l\'envoi');
    } finally {
      setSending(false);
    }
  };

  const sentAt = r.confirmation_sent_at;
  const sentBy = r.confirmation_sent_by;

  return (
    <div className="space-y-3">
      <div className="text-xs text-slate-600 leading-relaxed">
        Cette section regroupe la <b>fiche récapitulative auto-générée</b> à partir des données saisies
        plus haut (profil, stand, animations). Elle est <b>visible par l&apos;exposant</b> dès lors que vous lui envoyez l&apos;email de confirmation.
      </div>

      {/* Statut email envoyé */}
      {sentAt ? (
        <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <div className="text-xs text-emerald-900">
            <b>Confirmation envoyée</b> le {new Date(sentAt).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })}
            {sentBy ? ` par ${sentBy}` : ''} à <b>{o.main_email || 'l\'exposant'}</b>.
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-900">
            <b>Aucun email de confirmation envoyé.</b> L&apos;exposant verra sa fiche officielle uniquement après votre envoi.
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Button
          variant="outline"
          onClick={async () => {
            if (!annexeUrl) return;
            setLoadingPreview(true);
            try {
              window.open(annexeUrl, '_blank', 'noopener');
            } finally {
              setLoadingPreview(false);
            }
          }}
          disabled={!annexeUrl || loadingPreview}
          className="gap-1.5 justify-center"
        >
          {loadingPreview ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
          Voir la fiche générée
        </Button>
        <Button
          onClick={() => setOpenDlg(true)}
          disabled={!o.main_email}
          className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 justify-center"
        >
          <Send className="w-4 h-4" />
          {sentAt ? 'Renvoyer l\'email' : 'Envoyer l\'email de confirmation'}
        </Button>
      </div>

      {!o.main_email && (
        <div className="text-[11px] text-rose-700 bg-rose-50 px-2 py-1.5 rounded border border-rose-200">
          ⚠️ Email exposant manquant — saisissez-le dans la section <b>Contact</b> au-dessus pour activer l&apos;envoi.
        </div>
      )}

      {/* Dialog envoi email */}
      <Dialog open={openDlg} onOpenChange={setOpenDlg}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-emerald-600" /> Envoyer la confirmation à l&apos;exposant
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-xs text-slate-600">
              Destinataire : <b>{o.main_email}</b> · Stand <b className="font-mono">{r.stand_code || '—'}</b>{v.name ? ` · ${v.name}` : ''}
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 mb-1 block">Objet</label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 mb-1 block">Message (en plus du résumé auto-généré)</label>
              <Textarea
                value={bodyExtra}
                onChange={(e) => setBodyExtra(e.target.value)}
                rows={8}
                className="font-mono text-xs"
              />
              <div className="text-[11px] text-slate-500 mt-1">
                💡 Le résumé (stand, animations, jours) est ajouté automatiquement avec un lien vers la fiche officielle.
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpenDlg(false)} disabled={sending}>Annuler</Button>
            <Button onClick={send} disabled={sending} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5">
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Envoyer maintenant
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

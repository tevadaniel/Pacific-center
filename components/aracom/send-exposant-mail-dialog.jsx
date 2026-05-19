'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Mail, Loader2, Send } from 'lucide-react';
import { api } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';

/**
 * SEND EXPOSANT MAIL DIALOG (v2 - Radix Dialog)
 * Composer un mail libre à un exposant depuis sa fiche admin.
 * Variables : [[NOM_EXPOSANT]] [[CONTACT_NAME]] [[DISCIPLINE]] [[STAND]] [[SITE]] [[MON_ESPACE]] [[MON_ESPACE_DOCS]]
 *
 * ⚠️ Utilise Radix Dialog (et non createPortal custom) pour gérer le stacking de focus
 *    avec le parent Radix <Sheet> qui contient la fiche exposant.
 */
const TEMPLATES = {
  vide: { label: '— Mail vide —', subject: '', body: '' },
  info: {
    label: '📩 Demande d\'information',
    subject: '[Forum 2026] Information complémentaire — [[NOM_EXPOSANT]]',
    body: `<p>Bonjour [[CONTACT_NAME]],</p>
<p>Dans le cadre de votre participation au <b>Forum de la Rentrée 2026</b>, nous aurions besoin d'une information complémentaire :</p>
<p style="background:#fff8e1;padding:12px;border-left:4px solid #f59e0b;">[Précisez ici votre demande]</p>
<p>Merci de nous répondre à ce mail ou de mettre à jour votre dossier depuis votre espace :</p>
<p>[[MON_ESPACE]]</p>
<p>Cordialement,<br/>L'équipe ARACOM</p>`,
  },
  rdv_caution: {
    label: '📅 Confirmation de RDV caution',
    subject: '[Forum 2026] RDV caution confirmé — [[STAND]] [[SITE]]',
    body: `<p>Bonjour [[CONTACT_NAME]],</p>
<p>Nous confirmons votre rendez-vous pour la remise de la caution de <b>20 000 XPF</b> :</p>
<ul>
  <li><b>Date :</b> [à compléter]</li>
  <li><b>Heure :</b> [à compléter]</li>
  <li><b>Lieu :</b> [à compléter]</li>
</ul>
<p>Merci d'apporter un chèque ou de prévoir un règlement en espèces. La caution vous sera restituée après l'événement après vérification du stand.</p>
<p>[[MON_ESPACE]]</p>
<p>Cordialement,<br/>L'équipe ARACOM</p>`,
  },
  doc_manquant: {
    label: '📄 Document manquant',
    subject: '[Forum 2026] Document manquant — [[NOM_EXPOSANT]]',
    body: `<p>Bonjour [[CONTACT_NAME]],</p>
<p>Pour finaliser votre dossier d'inscription, il vous reste à fournir :</p>
<ul>
  <li>[à préciser]</li>
</ul>
<p>Merci de déposer ce document depuis votre espace exposant :</p>
<p>[[MON_ESPACE_DOCS]]</p>
<p>Cordialement,<br/>L'équipe ARACOM</p>`,
  },
  felicitations: {
    label: '🎉 Dossier complet — Félicitations',
    subject: '[Forum 2026] Félicitations — Dossier complet — [[NOM_EXPOSANT]]',
    body: `<p>Bonjour [[CONTACT_NAME]],</p>
<p>🎉 Excellente nouvelle : votre dossier d'inscription au <b>Forum de la Rentrée 2026</b> est <b>complet et validé</b> !</p>
<p>Récapitulatif :</p>
<ul>
  <li><b>Stand :</b> [[STAND]]</li>
  <li><b>Site :</b> [[SITE]]</li>
  <li><b>Discipline :</b> [[DISCIPLINE]]</li>
</ul>
<p>Vous pouvez retrouver tous les détails et documents sur votre espace :</p>
<p>[[MON_ESPACE]]</p>
<p>À très bientôt,<br/>L'équipe ARACOM</p>`,
  },
  personnalise: {
    label: '✍️ Mail personnalisé',
    subject: '[Forum 2026] [[NOM_EXPOSANT]]',
    body: `<p>Bonjour [[CONTACT_NAME]],</p>
<p>[Votre message ici]</p>
<p>[[MON_ESPACE]]</p>
<p>Cordialement,<br/>L'équipe ARACOM</p>`,
  },
};

export default function SendExposantMailDialog({ registration, organization, venue, onClose }) {
  const [templateKey, setTemplateKey] = useState('vide');
  const [subject, setSubject] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [sending, setSending] = useState(false);
  const [confirmStep, setConfirmStep] = useState(false);

  const applyTemplate = (key) => {
    setTemplateKey(key);
    const tpl = TEMPLATES[key] || TEMPLATES.vide;
    setSubject(tpl.subject);
    setBodyHtml(tpl.body);
  };

  const previewSubject = subject
    .replaceAll('[[NOM_EXPOSANT]]', organization?.name || '')
    .replaceAll('[[CONTACT_NAME]]', organization?.contact_name || organization?.name || '')
    .replaceAll('[[DISCIPLINE]]', organization?.discipline || '')
    .replaceAll('[[STAND]]', registration?.stand_code || '')
    .replaceAll('[[SITE]]', venue?.name || '');

  const send = async () => {
    if (!subject.trim()) { toast.error('Sujet requis'); return; }
    if (!bodyHtml.trim()) { toast.error('Corps du message requis'); return; }
    if (!organization?.main_email) { toast.error('Aucun email destinataire'); return; }
    if (!registration?.id) { toast.error('Inscription introuvable'); return; }

    setSending(true);
    try {
      console.log('[mail-dialog] Envoi en cours →', organization.main_email);
      const res = await api('/api/mailing/send', {
        method: 'POST',
        body: JSON.stringify({
          subject,
          body_html: bodyHtml,
          registration_ids: [registration.id],
          mail_type: 'admin_direct',
        }),
      });
      console.log('[mail-dialog] Réponse API:', res);
      if (res?.sent > 0) {
        toast.success(`📧 Email envoyé à ${organization.main_email}`);
        onClose();
      } else if (res?.failed > 0) {
        toast.error(`Échec de l'envoi (${res.errors?.[0]?.error || res.errors?.[0] || 'erreur inconnue'})`);
      } else if (res?.test_mode_active) {
        toast.info(`Mode TEST actif — mail redirigé vers ${res.redirect_to || 'allow-list'}`);
        onClose();
      } else {
        toast.warning(res?.message || `Aucun envoi effectué (réponse: ${JSON.stringify(res)})`);
      }
    } catch (e) {
      console.error('[mail-dialog] Erreur envoi:', e);
      toast.error(e.message || 'Erreur lors de l\'envoi');
    } finally {
      setSending(false);
      setConfirmStep(false);
    }
  };

  const handleSendClick = () => {
    if (!subject.trim()) { toast.error('Sujet requis'); return; }
    if (!bodyHtml.trim()) { toast.error('Corps du message requis'); return; }
    if (!organization?.main_email) { toast.error('Aucun email destinataire'); return; }
    setConfirmStep(true);
  };

  return (
    <Dialog open={true} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto p-0 z-[300]">
        <DialogHeader className="px-5 pt-5 pb-3 border-b">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Mail className="w-5 h-5 text-blue-600" />
            Envoyer un mail à l'exposant
          </DialogTitle>
          <DialogDescription className="text-xs">
            Destinataire : <span className="font-mono text-slate-700">{organization?.main_email || '—'}</span>
            {organization?.contact_name && <> · {organization.contact_name}</>}
          </DialogDescription>
        </DialogHeader>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {/* Template selector */}
          <div>
            <Label className="text-xs">Modèle</Label>
            <Select value={templateKey} onValueChange={applyTemplate}>
              <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
              <SelectContent className="z-[400]">
                {Object.entries(TEMPLATES).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Subject — input HTML natif (pas shadcn) pour éviter tout focus trap */}
          <div>
            <Label htmlFor="mail-subject" className="text-xs">Sujet</Label>
            <input
              id="mail-subject"
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Sujet du mail…"
              autoComplete="off"
              className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            {subject !== previewSubject && (
              <div className="text-[11px] text-slate-500 mt-1 italic">
                Aperçu : <span className="text-slate-700">{previewSubject}</span>
              </div>
            )}
          </div>

          {/* Body HTML — textarea natif */}
          <div>
            <Label htmlFor="mail-body" className="text-xs">Corps du message (HTML accepté)</Label>
            <textarea
              id="mail-body"
              rows={12}
              value={bodyHtml}
              onChange={(e) => setBodyHtml(e.target.value)}
              placeholder="Bonjour,…"
              className="mt-1 flex w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
            />
          </div>

          {/* Variables hint */}
          <div className="text-[11px] bg-slate-50 border border-slate-200 rounded-md p-2 text-slate-600">
            <div className="font-semibold text-slate-700 mb-1">🪄 Variables disponibles</div>
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              <code>[[NOM_EXPOSANT]]</code>
              <code>[[CONTACT_NAME]]</code>
              <code>[[DISCIPLINE]]</code>
              <code>[[STAND]]</code>
              <code>[[SITE]]</code>
              <code>[[MON_ESPACE]]</code>
              <code>[[MON_ESPACE_DOCS]]</code>
            </div>
          </div>
        </div>

        <DialogFooter className="px-5 py-3 border-t bg-slate-50/50 gap-2 flex-col sm:flex-row">
          {confirmStep ? (
            <div className="flex w-full items-center justify-between gap-2 flex-wrap">
              <div className="text-xs text-slate-700">
                Confirmer l'envoi à <span className="font-mono font-bold">{organization?.main_email}</span> ?
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setConfirmStep(false)} disabled={sending}>
                  Non
                </Button>
                <Button
                  size="sm"
                  onClick={send}
                  disabled={sending}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                >
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Oui, envoyer
                </Button>
              </div>
            </div>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={onClose} disabled={sending}>
                Annuler
              </Button>
              <Button
                size="sm"
                type="button"
                onClick={handleSendClick}
                disabled={sending || !subject.trim() || !bodyHtml.trim()}
                className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Envoyer le mail
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

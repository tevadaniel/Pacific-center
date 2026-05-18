'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { Mail, Loader2, X, Send, Sparkles } from 'lucide-react';
import { api } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';

/**
 * SEND EXPOSANT MAIL DIALOG
 * Composer un mail libre à un exposant depuis sa fiche admin.
 * - Choix d'un template pré-rempli (ou vide)
 * - Variables disponibles : [[NOM_EXPOSANT]] [[CONTACT_NAME]] [[DISCIPLINE]] [[STAND]] [[SITE]]
 * - Action [[MON_ESPACE]] insère un bouton « Mon espace exposant »
 *
 * Backend : POST /api/mailing/send avec { subject, body_html, registration_ids:[id], mail_type:'admin_direct' }
 */
const TEMPLATES = {
  vide: {
    label: '— Mail vide —',
    subject: '',
    body: '',
  },
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
  const [mounted, setMounted] = useState(false);

  // 🔌 Mount detection pour Portal (SSR safety)
  useEffect(() => { setMounted(true); }, []);

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
    if (!window.confirm(`Envoyer ce mail à ${organization.main_email} ?`)) return;

    setSending(true);
    try {
      const res = await api('/api/mailing/send', {
        method: 'POST',
        body: JSON.stringify({
          subject,
          body_html: bodyHtml,
          registration_ids: [registration.id],
          mail_type: 'admin_direct',
        }),
      });
      if (res?.sent > 0) {
        toast.success(`📧 Email envoyé à ${organization.main_email}`);
        onClose();
      } else if (res?.failed > 0) {
        toast.error(`Échec de l'envoi (${res.errors?.[0] || 'erreur inconnue'})`);
      } else {
        toast.info(res?.message || 'Aucun envoi effectué (vérifiez les filtres test/redirect)');
      }
    } catch (e) {
      toast.error(e.message || 'Erreur lors de l\'envoi');
    } finally {
      setSending(false);
    }
  };

  return (!mounted || typeof document === 'undefined') ? null : createPortal(
    <div className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-blue-600" />
            <div>
              <div className="font-bold text-base">Envoyer un mail à l'exposant</div>
              <div className="text-xs text-slate-500">
                Destinataire : <span className="font-mono text-slate-700">{organization?.main_email || '—'}</span>
                {organization?.contact_name && <> · {organization.contact_name}</>}
              </div>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          {/* Template selector */}
          <div>
            <Label className="text-xs">Modèle</Label>
            <Select value={templateKey} onValueChange={applyTemplate}>
              <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(TEMPLATES).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Subject */}
          <div>
            <Label className="text-xs">Sujet</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Sujet du mail…"
              className="mt-1"
            />
            {subject !== previewSubject && (
              <div className="text-[11px] text-slate-500 mt-1 italic">
                Aperçu : <span className="text-slate-700">{previewSubject}</span>
              </div>
            )}
          </div>

          {/* Body HTML */}
          <div>
            <Label className="text-xs">Corps du message (HTML accepté)</Label>
            <Textarea
              rows={12}
              value={bodyHtml}
              onChange={(e) => setBodyHtml(e.target.value)}
              placeholder="Bonjour,…"
              className="mt-1 font-mono text-xs"
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

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t bg-slate-50/50">
          <Button variant="outline" size="sm" onClick={onClose} disabled={sending}>
            Annuler
          </Button>
          <Button
            size="sm"
            onClick={send}
            disabled={sending || !subject.trim() || !bodyHtml.trim()}
            className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Envoyer le mail
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}

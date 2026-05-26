'use client';

import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { AlertCircle, CheckCircle2, Sparkles, Mail, Send, RefreshCw, Calendar, Users, Search, FileText, Trash2, Plus, Zap, Clock } from 'lucide-react';
import AiInsightTrigger from '@/components/ai-insight-trigger';
import { api } from '@/lib/auth-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';

/**
 * MAILING VIEW — Vue admin du module d'emailing.
 *
 * Composé de :
 *  - ToggleMailModeButton (toggle mode TEST/PRODUCTION protégé par mot de passe)
 *  - MAIL_TYPES (constantes des types de mails)
 *  - MailingView (composant principal exporté par défaut)
 *
 * Endpoints utilisés :
 *  - /api/mailing/toggle-test-mode, /api/mailing/status, /api/mailing/test-smtp
 *  - /api/mailing/send-test, /api/mailing/send, /api/mailing/schedule
 *  - /api/mailing/scheduled, /api/mailing/process-scheduled, /api/mailing/generate-ai
 *  - /api/emails, /api/registrations, /api/mail-templates, /api/mail-recipient-lists
 */
function ToggleMailModeButton({ currentMode, onToggled }) {
  const [open, setOpen] = useState(false);
  const [pwd, setPwd] = useState('');
  const [busy, setBusy] = useState(false);
  const targetMode = currentMode === 'test' ? 'production' : 'test';
  const isDangerous = targetMode === 'production'; // Production = envoi RÉEL

  const submit = async () => {
    if (!pwd) { toast.error('Mot de passe requis'); return; }
    setBusy(true);
    try {
      const r = await api('/api/mailing/toggle-test-mode', {
        method: 'POST',
        body: JSON.stringify({ mode: targetMode, confirm_password: pwd }),
      });
      toast.success(r.message, { duration: 6000 });
      setOpen(false);
      setPwd('');
      onToggled?.();
    } catch (e) {
      toast.error(e.message);
    } finally { setBusy(false); }
  };

  if (!open) {
    return (
      <Button
        size="sm"
        variant={isDangerous ? 'destructive' : 'outline'}
        onClick={() => setOpen(true)}
        className={`h-7 text-[11px] gap-1 ${isDangerous ? '' : 'border-emerald-600 text-emerald-700 hover:bg-emerald-50'}`}
      >
        {isDangerous
          ? '⚠️ Passer en mode PRODUCTION (envoi RÉEL)'
          : '🛡️ Repasser en mode TEST'}
      </Button>
    );
  }
  return (
    <div className={`rounded-md border-2 ${isDangerous ? 'border-red-600 bg-red-50' : 'border-emerald-600 bg-emerald-50'} p-3 flex flex-col gap-2 max-w-md`}>
      <div className="text-xs font-bold">
        {isDangerous
          ? '⚠️ DOUBLE CONFIRMATION : passer en mode PRODUCTION'
          : '🛡️ Repasser en mode TEST'}
      </div>
      {isDangerous && (
        <div className="text-[11px] text-red-800 leading-relaxed">
          Tous les emails partiront <b>RÉELLEMENT</b> aux destinataires. Cette action est tracée dans le journal d&apos;audit. Saisissez votre mot de passe ARACOM pour confirmer.
        </div>
      )}
      <Input
        type="password"
        value={pwd}
        onChange={e => setPwd(e.target.value)}
        placeholder="Votre mot de passe ARACOM"
        className="h-8 text-xs"
        autoFocus
        onKeyDown={e => e.key === 'Enter' && submit()}
      />
      <div className="flex gap-2">
        <Button size="sm" variant="ghost" onClick={() => { setOpen(false); setPwd(''); }} disabled={busy} className="h-7 text-[11px]">Annuler</Button>
        <Button
          size="sm"
          variant={isDangerous ? 'destructive' : 'default'}
          onClick={submit}
          disabled={busy || !pwd}
          className="h-7 text-[11px] flex-1"
        >
          {busy ? 'Application…' : (isDangerous ? 'Confirmer le passage en PRODUCTION' : 'Confirmer le retour en TEST')}
        </Button>
      </div>
    </div>
  );
}


const MAIL_TYPES = [
  { value: 'relance_caution', label: 'Relance caution (20 000 XPF)', icon: '💰' },
  { value: 'relance_convention', label: 'Relance convention non signée', icon: '📝' },
  { value: 'relance_assurance', label: 'Relance attestation assurance', icon: '🛡️' },
  { value: 'relance_generale', label: 'Relance dossier incomplet', icon: '⚠️' },
  { value: 'confirmation', label: 'Confirmation de participation', icon: '✅' },
  { value: 'invitation_inscription', label: "Invitation à s'inscrire", icon: '📨' },
  { value: 'invitation_satisfaction', label: 'Questionnaire satisfaction', icon: '⭐' },
  { value: 'remerciement', label: 'Remerciement post-événement', icon: '🙏' },
  { value: 'info_pratique', label: 'Infos pratiques (horaires, accès)', icon: 'ℹ️' },
  { value: 'annonce', label: 'Annonce générale', icon: '📣' },
];

export default function MailingView() {
  const [emails, setEmails] = useState([]);
  const [regs, setRegs] = useState([]);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [type, setType] = useState('relance_caution');
  const [tone, setTone] = useState('professionnel chaleureux');
  const [customInstruction, setCustomInstruction] = useState('');
  const [filter, setFilter] = useState('a_relancer');
  const [siteFilter, setSiteFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all'); // '2019', '2020', '2023', '2024', '2025', 'fidele', 'regulier', 'ponctuel', 'jamais'
  const [recipientSearch, setRecipientSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  // Ref pour tracker l'initialisation de la sélection (évite les écrasements côté client)
  const selectionInitializedRef = useRef(false);
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [lastUsage, setLastUsage] = useState(null);
  const [smtp, setSmtp] = useState({ ok: false, configured: false, host: null, user: null, error: 'Non testé' });
  const [mailStatus, setMailStatus] = useState({ test_mode_active: false, redirect_to: null, allowed_recipients: [] });
  const [testingSmtp, setTestingSmtp] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [testRecipient, setTestRecipient] = useState('');
  const [templates, setTemplates] = useState([]);
  const [recipientLists, setRecipientLists] = useState([]);

  const load = () => Promise.all([api('/api/emails').then(setEmails), api('/api/registrations').then(setRegs)]);
  const loadTemplates = () => api('/api/mail-templates').then(setTemplates).catch(() => {});
  const loadLists = () => api('/api/mail-recipient-lists').then(setRecipientLists).catch(() => {});
  const loadSmtp = async () => {
    try {
      const r = await api('/api/mailing/test-smtp', { method: 'POST', body: JSON.stringify({}) });
      setSmtp(r);
    } catch (e) {
      setSmtp({ ok: false, configured: false, error: e.message });
    }
  };
  const loadMailStatus = async () => {
    try {
      const r = await api('/api/mailing/status');
      setMailStatus(r);
    } catch (e) {
      // Silent — banner just won't appear
    }
  };
  useEffect(() => { load(); loadSmtp(); loadTemplates(); loadLists(); loadMailStatus(); }, []);

  // 🔗 Initialisation de la sélection (preselect URL via Centre d'alertes OU auto-populate par défaut)
  // Ce useEffect tourne UNE SEULE FOIS quand regs sont chargés. Il consomme les params URL
  // (preselect + mail_type) ou populate avec tous les visibles si pas de preselect.
  useEffect(() => {
    if (regs.length === 0) return;
    if (selectionInitializedRef.current) return;
    selectionInitializedRef.current = true;

    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const preselect = params.get('preselect');
      const mailType = params.get('mail_type');
      // 🆕 SESSION 47.14 — Support prefill_subject + prefill_body (base64) pour templates pré-générés
      const prefillSubject = params.get('prefill_subject');
      const prefillBody = params.get('prefill_body');

      if (preselect) {
        const ids = preselect.split(',').filter(Boolean);
        if (ids.length > 0) {
          // 🐛 FIX SESSION 47.9 — Force filtre 'all' pour que les destinataires pré-cochés soient visibles
          // (sinon le filtre par défaut 'a_relancer' les cache si leur statut ne match pas)
          setFilter('all');
          setSiteFilter('all');
          setYearFilter('all');
          setRecipientSearch('');
          setSelectedIds(new Set(ids));
          // Récupère les noms pour le toast (depuis regs si chargés)
          const matched = regs.filter(r => ids.includes(r.id));
          const names = matched.map(r => r.organization?.name).filter(Boolean).slice(0, 3);
          const suffix = matched.length > names.length ? `… (+${matched.length - names.length})` : '';
          const detail = names.length ? ` : ${names.join(', ')}${suffix}` : '';
          toast.success(`📥 ${ids.length} destinataire${ids.length > 1 ? 's' : ''} pré-coché${ids.length > 1 ? 's' : ''}${detail}`);
        }
        if (mailType && MAIL_TYPES.some(t => t.value === mailType)) {
          setType(mailType);
        }
        // 🆕 SESSION 47.14 — Pré-remplit le sujet + corps si fournis (base64 decoded)
        try {
          if (prefillSubject) {
            const decodedSubject = decodeURIComponent(escape(atob(prefillSubject)));
            setSubject(decodedSubject);
          }
          if (prefillBody) {
            const decodedBody = decodeURIComponent(escape(atob(prefillBody)));
            setBody(decodedBody);
          }
          if (prefillSubject || prefillBody) {
            toast.info('📝 Sujet & corps pré-remplis — modifiez-les avant envoi si besoin.');
          }
        } catch (e) {
          console.error('[mailing-view] prefill decode error', e);
        }
        // Nettoie les params pour éviter le re-déclenchement après refresh
        const url = new URL(window.location.href);
        url.searchParams.delete('preselect');
        url.searchParams.delete('mail_type');
        url.searchParams.delete('prefill_subject');
        url.searchParams.delete('prefill_body');
        window.history.replaceState({}, '', url.toString());
        return; // sélection imposée → ne pas auto-populate
      }
    }
    // Cas par défaut : populate avec tous les visibles
    setSelectedIds(new Set(filteredRegs.map(r => r.id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regs.length]);

  // Quand les FILTRES changent (action utilisateur APRÈS init), on resync la sélection avec tous les visibles
  useEffect(() => {
    if (!selectionInitializedRef.current) return; // pas encore initialisé → laisser l'autre useEffect gérer
    setSelectedIds(new Set(filteredRegs.map(r => r.id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, siteFilter, yearFilter]);

  // Save / load templates
  const saveTemplate = async () => {
    if (!subject || !body) { toast.error('Générez ou écrivez un mail d\'abord'); return; }
    const name = window.prompt('Nom du template ?', `${MAIL_TYPES.find(t => t.value === type)?.label || type} — ${new Date().toLocaleDateString('fr-FR')}`);
    if (!name?.trim()) return;
    try {
      await api('/api/mail-templates', {
        method: 'POST',
        body: JSON.stringify({ name, mail_type: type, subject, body_html: body, tone, custom_instruction: customInstruction }),
      });
      toast.success(`💾 Template "${name}" sauvegardé`);
      loadTemplates();
    } catch (e) { toast.error(e.message); }
  };
  const loadTemplate = async (templateId) => {
    if (!templateId) return;
    try {
      const tpl = await api(`/api/mail-templates/${templateId}`);
      setSubject(tpl.subject);
      setBody(tpl.body_html);
      setType(tpl.mail_type);
      setTone(tpl.tone);
      setCustomInstruction(tpl.custom_instruction || '');
      toast.success(`📩 Template "${tpl.name}" chargé`);
    } catch (e) { toast.error(e.message); }
  };
  const deleteTemplate = async (templateId, name) => {
    if (!confirm(`Supprimer le template "${name}" ?`)) return;
    await api(`/api/mail-templates/${templateId}`, { method: 'DELETE' });
    toast.success('Template supprimé');
    loadTemplates();
  };

  // Save / load recipient lists
  const saveRecipientList = async () => {
    if (selectedIds.size === 0) { toast.error('Sélectionnez au moins 1 destinataire'); return; }
    const name = window.prompt('Nom de cette liste de destinataires ?', `Liste ${selectedIds.size} dest. — ${new Date().toLocaleDateString('fr-FR')}`);
    if (!name?.trim()) return;
    try {
      await api('/api/mail-recipient-lists', {
        method: 'POST',
        body: JSON.stringify({ name, registration_ids: Array.from(selectedIds) }),
      });
      toast.success(`💾 Liste "${name}" (${selectedIds.size} dest.) sauvegardée`);
      loadLists();
    } catch (e) { toast.error(e.message); }
  };
  const loadRecipientList = (listId) => {
    if (!listId) return;
    const lst = recipientLists.find(l => l.id === listId);
    if (!lst) return;
    setSelectedIds(new Set(lst.registration_ids));
    setFilter('all'); // show all so the loaded ids are visible
    setSiteFilter('all');
    setRecipientSearch('');
    toast.success(`📋 Liste "${lst.name}" chargée (${lst.count} dest.)`);
  };
  const deleteRecipientList = async (listId, name) => {
    if (!confirm(`Supprimer la liste "${name}" ?`)) return;
    await api(`/api/mail-recipient-lists/${listId}`, { method: 'DELETE' });
    toast.success('Liste supprimée');
    loadLists();
  };

  // Liste filtrée par les filtres (statut + site + recherche)
  const filteredRegs = regs.filter(r => {
    if (filter === 'a_relancer' && r.status !== 'a_relancer') return false;
    if (filter === 'a_confirmer' && r.status !== 'a_confirmer') return false;
    if (filter === 'confirme' && r.status !== 'confirme') return false;
    if (filter === 'no_caution' && r.deposit?.status === 'recue') return false;
    if (filter === 'no_insurance' && r.is_insurance_uploaded) return false;
    if (siteFilter !== 'all' && r.venue?.name !== siteFilter) return false;
    if (yearFilter !== 'all') {
      const h = r.organization?.participation_history;
      if (yearFilter === 'no_history') {
        if (h) return false;
      } else if (['2019', '2020', '2023', '2024', '2025'].includes(yearFilter)) {
        if (!h || !h[`y${yearFilter}`]) return false;
      } else if (yearFilter === 'fidele') {
        if (!h || !(h.fidelity || '').includes('Fidèle')) return false;
      } else if (yearFilter === 'regulier') {
        if (!h || h.fidelity !== 'Régulier') return false;
      } else if (yearFilter === 'ponctuel') {
        if (!h || h.fidelity !== 'Ponctuel') return false;
      } else if (yearFilter === 'jamais') {
        if (h && h.nb_editions > 0) return false;
      }
    }
    if (recipientSearch.trim()) {
      const q = recipientSearch.trim().toLowerCase();
      const hit = (r.organization?.name || '').toLowerCase().includes(q) ||
        (r.organization?.main_email || '').toLowerCase().includes(q) ||
        (r.organization?.discipline || '').toLowerCase().includes(q) ||
        (r.stand_code || '').toLowerCase().includes(q);
      if (!hit) return false;
    }
    return true;
  });
  const venues = [...new Set(regs.map(r => r.venue?.name).filter(Boolean))].sort();

  // Destinataires effectifs (= cochés ET visibles dans le filtre)
  const targetRegs = filteredRegs.filter(r => selectedIds.has(r.id));

  const toggleOne = (id) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };
  const selectOnly = (id) => {
    setSelectedIds(new Set([id]));
  };
  const selectAll = () => setSelectedIds(new Set(filteredRegs.map(r => r.id)));
  const selectNone = () => setSelectedIds(new Set());

  const generateAI = async () => {
    setGenerating(true);
    try {
      const sampleIds = targetRegs.slice(0, Math.min(3, targetRegs.length)).map(r => r.id);
      const res = await api('/api/mailing/generate-ai', {
        method: 'POST',
        body: JSON.stringify({ mail_type: type, registration_ids: sampleIds, tone, custom_instruction: customInstruction }),
      });
      setSubject(res.subject || '');
      setBody(res.body_html || '');
      setLastUsage(res.usage);
      toast.success(`✨ Mail généré par Claude Sonnet 4.5 (${res.target_count} destinataire${res.target_count > 1 ? 's' : ''} ciblé${res.target_count > 1 ? 's' : ''})`);
    } catch (e) { toast.error(`IA: ${e.message}`); }
    finally { setGenerating(false); }
  };

  const send = async () => {
    if (!subject || !body) { toast.error('Objet et corps requis'); return; }
    if (!targetRegs.length) { toast.error('Aucun destinataire sélectionné — cochez au moins une case'); return; }
    const realSend = smtp.ok;
    const testModeActive = mailStatus.test_mode_active;
    // 🛡️ EN MODE TEST : aucune confirmation nécessaire (impossible d'envoyer aux vrais contacts)
    if (!testModeActive && targetRegs.length > 1) {
      const samples = targetRegs.slice(0, 5).map(r => `• ${r.organization?.name} <${r.organization?.main_email}>`).join('\n');
      const more = targetRegs.length > 5 ? `\n... et ${targetRegs.length - 5} autre(s)` : '';
      const mode = realSend
        ? '✅ MODE RÉEL via Gmail SMTP — les emails partiront réellement.'
        : '⚠️ MODE MOCK — SMTP non configuré, aucun email réel ne partira.';
      if (!confirm(`📧 ENVOI GROUPÉ à ${targetRegs.length} destinataires\n${mode}\n\nObjet : ${subject}\n\nDestinataires :\n${samples}${more}\n\nConfirmer l'envoi ?`)) return;
    }
    if (testModeActive) {
      toast.info(`🛡️ Mode TEST — Envoi intercepté, redirection vers ${mailStatus.redirect_to}…`);
    } else if (targetRegs.length === 1) {
      toast.info(`📧 Envoi en cours à ${targetRegs[0]?.organization?.main_email || '1 destinataire'}…`);
    }
    if (!testModeActive && realSend && targetRegs.length > 10) {
      if (!confirm(`⚠️ DOUBLE CONFIRMATION : vous allez envoyer ${targetRegs.length} emails RÉELS. Cette action est irréversible. Continuer ?`)) return;
    }
    setSending(true);
    try {
      const res = await api('/api/mailing/send', {
        method: 'POST',
        body: JSON.stringify({ subject, body_html: body, registration_ids: targetRegs.map(r => r.id), mail_type: type }),
      });
      if (res.test_mode_active && res.redirected_count > 0) {
        toast.success(
          `🛡️ MODE TEST — ${res.redirected_count} email(s) intercepté(s) → ${res.redirect_to}\nAucun email n'est parti vers vos contacts.`,
          { duration: 8000 }
        );
      } else if (res.smtp_used) {
        toast.success(`📧 ${res.sent} email(s) envoyé(s) via Gmail${res.failed ? ` — ${res.failed} échec(s)` : ''}`);
      } else {
        toast.success(`✉️ ${res.sent} email(s) enregistrés (MOCK — SMTP non configuré)`);
      }
      load();
    } catch (e) { toast.error(e.message); }
    finally { setSending(false); }
  };

  // Schedule send for later
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduled, setScheduled] = useState([]);
  const loadScheduled = () => api('/api/mailing/scheduled').then(setScheduled).catch(() => {});
  useEffect(() => { loadScheduled(); }, []);

  const scheduleSend = async () => {
    if (!subject || !body) { toast.error('Objet et corps requis'); return; }
    if (!targetRegs.length) { toast.error('Aucun destinataire sélectionné'); return; }
    if (!scheduledDate) { toast.error('Choisissez une date/heure'); return; }
    const when = new Date(scheduledDate);
    if (isNaN(when.getTime())) { toast.error('Date invalide'); return; }
    if (when.getTime() < Date.now()) { toast.error('La date doit être dans le futur'); return; }
    if (!confirm(`Programmer l'envoi de ce mail à ${targetRegs.length} destinataire(s) pour le ${when.toLocaleString('fr-FR')} ?`)) return;
    try {
      await api('/api/mailing/schedule', {
        method: 'POST',
        body: JSON.stringify({ subject, body_html: body, registration_ids: targetRegs.map(r => r.id), mail_type: type, scheduled_at: when.toISOString() }),
      });
      toast.success(`📅 Envoi programmé pour le ${when.toLocaleString('fr-FR')}`);
      setScheduledDate('');
      loadScheduled();
    } catch (e) { toast.error(e.message); }
  };
  const processNow = async () => {
    try {
      const r = await api('/api/mailing/process-scheduled', { method: 'POST', body: JSON.stringify({}) });
      toast.success(`🚀 ${r.processed} campagne(s) traitée(s) — ${r.sent} envoyé(s) — ${r.failed} échec(s)`);
      loadScheduled(); load();
    } catch (e) { toast.error(e.message); }
  };

  const testSmtp = async () => {
    setTestingSmtp(true);
    try {
      await loadSmtp();
      // Re-read after loadSmtp to display result
      const r = await api('/api/mailing/test-smtp', { method: 'POST', body: JSON.stringify({}) }).catch(e => ({ ok: false, error: e.message }));
      if (r.ok) toast.success('✅ Connexion SMTP réussie !');
      else toast.error(`❌ ${r.error || 'Erreur SMTP'}`);
      setSmtp(r);
    } finally { setTestingSmtp(false); }
  };

  const sendTestEmail = async () => {
    if (!testRecipient) { toast.error('Adresse de test requise'); return; }
    setSendingTest(true);
    try {
      const r = await api('/api/mailing/send-test', { method: 'POST', body: JSON.stringify({ to: testRecipient }) });
      if (r.ok) {
        if (r.test_mode_active && r.redirect_to && String(r.redirect_to).toLowerCase() !== String(testRecipient).toLowerCase()) {
          toast.success(`🛡️ MODE TEST — Email intercepté → redirigé vers ${r.redirect_to} (au lieu de ${testRecipient})`, { duration: 8000 });
        } else {
          toast.success(`📨 Email de test envoyé à ${testRecipient}`);
        }
      }
      else toast.error(`❌ ${r.error}`);
    } catch (e) { toast.error(e.message); }
    finally { setSendingTest(false); }
  };

  return (
    <div className="space-y-4">
      {/* 🛡️ TEST MODE — top-of-page sticky banner */}
      {mailStatus.test_mode_active && (
        <div className="rounded-lg border-2 border-red-500 bg-red-50 p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="text-3xl">🛡️</div>
            <div className="flex-1 min-w-0">
              <div className="font-extrabold text-red-700 text-base flex items-center gap-2 flex-wrap">
                MODE TEST ACTIVÉ — Aucun email ne part vers vos contacts
                <Badge className="bg-red-600 text-white">Sécurité maximale</Badge>
              </div>
              <div className="text-sm text-red-800 mt-1.5 leading-relaxed">
                Tous les emails sont <b>interceptés par le serveur</b> et redirigés vers&nbsp;
                <code className="bg-white px-1.5 py-0.5 rounded border border-red-300 text-red-900 font-bold">
                  {mailStatus.redirect_to}
                </code>.
                Le sujet est préfixé par <code className="bg-white px-1 rounded border border-red-300">[TEST→email.original]</code> pour vous indiquer le destinataire prévu.
                {mailStatus.allowed_recipients?.length > 0 && (
                  <div className="mt-1 text-xs text-red-700">
                    Exceptions (envois directs autorisés) : {mailStatus.allowed_recipients.join(', ')}
                  </div>
                )}
              </div>
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <ToggleMailModeButton currentMode="test" onToggled={loadMailStatus} />
                {mailStatus.updated_at && (
                  <span className="text-[11px] text-red-600">
                    Dernière modification : {new Date(mailStatus.updated_at).toLocaleString('fr-FR')} par {mailStatus.updated_by}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {!mailStatus.test_mode_active && smtp.ok && (
        <div className="rounded-lg border-2 border-emerald-500 bg-emerald-50 p-3 shadow-sm">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="text-2xl">📨</div>
            <div className="text-sm text-emerald-900 flex-1 min-w-0">
              <b>MODE PRODUCTION — Envoi RÉEL aux contacts.</b> Vos destinataires recevront effectivement les emails. Soyez vigilant.
            </div>
            <ToggleMailModeButton currentMode="production" onToggled={loadMailStatus} />
          </div>
          {mailStatus.updated_at && (
            <div className="text-[11px] text-emerald-700 mt-1.5 ml-9">
              Activé le {new Date(mailStatus.updated_at).toLocaleString('fr-FR')} par {mailStatus.updated_by}
            </div>
          )}
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-4">
      {/* Colonne 1 : composition */}
      <div className="lg:col-span-2 space-y-4">
        {/* SMTP status banner */}
        <Card className={smtp.ok ? 'border-emerald-200 bg-emerald-50/30' : 'border-amber-200 bg-amber-50/30'}>
          <CardContent className="p-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm">
              {smtp.ok ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span><b>Gmail SMTP actif</b> — envois réels via <code className="text-xs bg-white px-1 py-0.5 rounded border">{smtp.user || '—'}</code></span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                  <span><b>SMTP non actif</b> — {smtp.configured ? 'erreur de connexion' : 'mot de passe Gmail manquant'}. {smtp.error && <span className="text-amber-700 text-xs">({smtp.error})</span>}</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="email"
                placeholder="email@test.com"
                value={testRecipient}
                onChange={e => setTestRecipient(e.target.value)}
                className="h-8 text-xs w-44"
                disabled={!smtp.ok}
              />
              <Button size="sm" variant="outline" disabled={!smtp.ok || sendingTest || !testRecipient} onClick={sendTestEmail} className="h-8 text-xs gap-1">
                <Send className="w-3 h-3" /> {sendingTest ? '…' : 'Test'}
              </Button>
              <Button size="sm" variant="outline" disabled={testingSmtp} onClick={testSmtp} className="h-8 text-xs gap-1">
                <RefreshCw className={`w-3 h-3 ${testingSmtp ? 'animate-spin' : ''}`} /> Vérifier
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-violet-200 bg-gradient-to-br from-violet-50/40 to-white">
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base flex items-center gap-2"><Sparkles className="w-4 h-4 text-violet-600" /> Rédaction IA — Claude Sonnet 4.5</CardTitle>
              <Badge variant="secondary" className="bg-violet-100 text-violet-700">Boosté IA</Badge>
            </div>
            <p className="text-xs text-slate-500 mt-1">Sélectionne un type, des destinataires, et laisse l'IA rédiger un mail professionnel personnalisé que tu pourras éditer avant envoi.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs uppercase text-slate-500">Type de mail</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{MAIL_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.icon} {t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs uppercase text-slate-500">Ton</Label>
                <Select value={tone} onValueChange={setTone}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="professionnel chaleureux">Professionnel chaleureux</SelectItem>
                    <SelectItem value="formel et institutionnel">Formel et institutionnel</SelectItem>
                    <SelectItem value="direct et efficace">Direct et efficace</SelectItem>
                    <SelectItem value="amical et convivial">Amical et convivial</SelectItem>
                    <SelectItem value="ferme (pour relance urgente)">Ferme (pour relance urgente)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs uppercase text-slate-500">Instructions spécifiques <span className="normal-case text-slate-400">(optionnel)</span></Label>
              <Textarea rows={2} value={customInstruction} onChange={e => setCustomInstruction(e.target.value)} placeholder="Ex: mentionner la date limite du 15 juillet, inclure un lien vers le portail exposant…" className="mt-1" />
            </div>
            <Button onClick={generateAI} disabled={generating} size="lg" className="w-full bg-violet-600 hover:bg-violet-700 gap-2">
              <Sparkles className="w-4 h-4" />
              {generating ? 'Claude rédige le mail…' : targetRegs.length > 0 ? `Générer un mail pour ${targetRegs.length} destinataire(s)` : 'Sélectionnez des destinataires'}
            </Button>
            {lastUsage && <p className="text-[11px] text-slate-400">Claude Sonnet 4.5 (via Emergent) • {lastUsage.prompt_tokens || lastUsage.input_tokens || 0} tokens in / {lastUsage.completion_tokens || lastUsage.output_tokens || 0} out</p>}

            {/* Templates row */}
            <div className="pt-3 border-t flex items-center gap-2 flex-wrap">
              <span className="text-xs text-slate-500 uppercase">Templates :</span>
              {templates.length > 0 ? (
                <Select onValueChange={loadTemplate}>
                  <SelectTrigger className="h-8 w-[220px] text-xs"><SelectValue placeholder="📩 Charger un template…" /></SelectTrigger>
                  <SelectContent>{templates.map(t => <SelectItem key={t.id} value={t.id}><span className="truncate">{t.name}</span></SelectItem>)}</SelectContent>
                </Select>
              ) : <span className="text-[11px] text-slate-400">Aucun template enregistré</span>}
              <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={saveTemplate} disabled={!subject || !body}><FileText className="w-3 h-3" /> Sauver template</Button>
              {templates.length > 0 && (
                <Select onValueChange={(v) => { const tpl = templates.find(t => t.id === v); if (tpl) deleteTemplate(tpl.id, tpl.name); }}>
                  <SelectTrigger className="h-8 w-[120px] text-xs"><SelectValue placeholder="🗑️ Supprimer…" /></SelectTrigger>
                  <SelectContent>{templates.map(t => <SelectItem key={t.id} value={t.id}><span className="text-rose-600 truncate">Supp : {t.name}</span></SelectItem>)}</SelectContent>
                </Select>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Mail className="w-4 h-4 text-blue-600" /> Aperçu & édition</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs uppercase text-slate-500">Objet</Label>
              <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="L'objet apparaîtra ici après génération…" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs uppercase text-slate-500">Corps HTML</Label>
              <Textarea rows={12} value={body} onChange={e => setBody(e.target.value)} placeholder="Le corps HTML apparaîtra ici après génération…" className="mt-1 font-mono text-xs" />
            </div>
            {body && (
              <div>
                <Label className="text-xs uppercase text-slate-500">Aperçu rendu</Label>
                <div className="mt-1 rounded-md border bg-white p-4 text-sm max-h-[300px] overflow-y-auto" dangerouslySetInnerHTML={{ __html: body }} />
              </div>
            )}
            <Button
              className={`w-full gap-2 ${mailStatus.test_mode_active ? 'bg-amber-600 hover:bg-amber-700' : ''}`}
              onClick={send}
              disabled={sending || !subject || !body}
            >
              <Send className="w-4 h-4" />
              {sending
                ? 'Envoi…'
                : mailStatus.test_mode_active
                  ? `🛡️ Tester l'envoi à ${targetRegs.length} dest. (intercepté → ${mailStatus.redirect_to})`
                  : `Envoyer à ${targetRegs.length} destinataire(s)`}
              {!smtp.ok && <Badge variant="secondary" className="ml-1">MOCK</Badge>}
            </Button>
            {mailStatus.test_mode_active && (
              <p className="text-xs text-amber-700 -mt-1 flex items-center gap-1.5">
                <span>🔒</span>
                <span>Mode test actif — l&apos;email partira uniquement vers <b>{mailStatus.redirect_to}</b>, jamais vers les vrais contacts.</span>
              </p>
            )}

            {/* Schedule for later */}
            <div className="pt-3 border-t">
              <Label className="text-xs uppercase text-slate-500 flex items-center gap-2"><Calendar className="w-3.5 h-3.5" /> Ou programmer pour plus tard</Label>
              <div className="flex gap-2 mt-1">
                <Input type="datetime-local" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)} className="text-xs" />
                <Button onClick={scheduleSend} disabled={!subject || !body || !scheduledDate || !targetRegs.length} variant="outline" className="gap-1 shrink-0">
                  <Calendar className="w-3.5 h-3.5" /> Programmer
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Scheduled mailings list */}
        {scheduled.length > 0 && (
          <Card className="border-amber-200 bg-amber-50/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2"><Calendar className="w-4 h-4 text-amber-600" /> Mails programmés ({scheduled.length})</span>
                <Button size="sm" variant="outline" onClick={processNow} className="h-7 text-xs gap-1"><Zap className="w-3 h-3" /> Traiter dûs maintenant</Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {scheduled.map(s => {
                const due = new Date(s.scheduled_at) <= new Date();
                const cancelScheduled = async () => {
                  if (!confirm(`Annuler le mail programmé « ${s.name} » pour le ${new Date(s.scheduled_at).toLocaleString('fr-FR')} ?\n\n${s.recipients_count} destinataire(s) ne recevront PAS ce mail.`)) return;
                  try {
                    await api(`/api/mailing/scheduled/${s.id}`, { method: 'DELETE' });
                    toast.success('Mail programmé annulé');
                    loadScheduled();
                  } catch (e) { toast.error('Erreur : ' + e.message); }
                };
                return (
                  <div key={s.id} className={`border rounded-md p-3 text-xs ${due ? 'bg-rose-50 border-rose-200' : 'bg-white border-amber-100'}`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium truncate flex-1">{s.name}</div>
                      <Badge variant={due ? 'destructive' : 'secondary'}>{due ? 'À traiter' : 'Programmé'}</Badge>
                      <button onClick={cancelScheduled} className="text-rose-600 hover:text-rose-800 hover:bg-rose-100 rounded p-1 -m-1" title="Annuler ce mail programmé">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="text-slate-500 mt-0.5">📅 {new Date(s.scheduled_at).toLocaleString('fr-FR')} · 👥 {s.recipients_count} destinataire(s)</div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Colonne 2 : destinataires + historique */}
      <div className="space-y-4">
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Users className="w-4 h-4 text-blue-600" /> Destinataires</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs uppercase text-slate-500">Statut dossier</Label>
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les exposants</SelectItem>
                  <SelectItem value="a_relancer">À relancer</SelectItem>
                  <SelectItem value="a_confirmer">À confirmer</SelectItem>
                  <SelectItem value="confirme">Confirmés uniquement</SelectItem>
                  <SelectItem value="no_caution">Sans caution reçue</SelectItem>
                  <SelectItem value="no_insurance">Sans assurance</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs uppercase text-slate-500">Site</Label>
              <Select value={siteFilter} onValueChange={setSiteFilter}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les sites</SelectItem>
                  {venues.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs uppercase text-slate-500">Année / Fidélité</Label>
              <Select value={yearFilter} onValueChange={setYearFilter}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes années</SelectItem>
                  <SelectItem value="2025">📅 Présent en 2025</SelectItem>
                  <SelectItem value="2024">📅 Présent en 2024</SelectItem>
                  <SelectItem value="2023">📅 Présent en 2023</SelectItem>
                  <SelectItem value="2020">📅 Présent en 2020</SelectItem>
                  <SelectItem value="2019">📅 Présent en 2019</SelectItem>
                  <SelectItem value="fidele">⭐ Fidèles (toutes éditions)</SelectItem>
                  <SelectItem value="regulier">🔁 Réguliers</SelectItem>
                  <SelectItem value="ponctuel">📌 Ponctuels</SelectItem>
                  <SelectItem value="jamais">🆕 Jamais participé / nouveaux</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs uppercase text-slate-500">Recherche (nom, email, stand)</Label>
              <div className="relative mt-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <Input value={recipientSearch} onChange={e => setRecipientSearch(e.target.value)} placeholder="ex: teva, swimua, A-C04…" className="pl-8 h-9" />
              </div>
            </div>

            <div className="pt-2 border-t flex items-end justify-between gap-2">
              <div>
                <div className="text-2xl font-bold text-blue-600">{targetRegs.length}<span className="text-sm font-normal text-slate-400"> / {filteredRegs.length}</span></div>
                <p className="text-xs text-slate-500">cochés / visibles</p>
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={selectAll} disabled={filteredRegs.length === 0}>Tout cocher</Button>
                <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={selectNone} disabled={selectedIds.size === 0}>Tout décocher</Button>
              </div>
            </div>

            {/* Saved recipient lists */}
            <div className="pt-2 border-t space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs uppercase text-slate-500">Listes sauvegardées</span>
                <Button size="sm" variant="outline" className="h-7 gap-1 text-[10px]" onClick={saveRecipientList} disabled={selectedIds.size === 0}><Plus className="w-3 h-3" /> Sauver</Button>
              </div>
              {recipientLists.length === 0 ? (
                <p className="text-[11px] text-slate-400">Aucune liste enregistrée. Cochez des destinataires puis cliquez sur Sauver.</p>
              ) : (
                <div className="space-y-1">
                  {recipientLists.map(lst => (
                    <div key={lst.id} className="flex items-center gap-1 text-xs border rounded-md px-2 py-1 bg-slate-50/50">
                      <button type="button" onClick={() => loadRecipientList(lst.id)} className="flex-1 text-left hover:text-blue-600 transition truncate" title="Charger cette liste">
                        📋 {lst.name} <span className="text-slate-400">({lst.count})</span>
                      </button>
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0 shrink-0" onClick={() => deleteRecipientList(lst.id, lst.name)} title="Supprimer"><Trash2 className="w-3 h-3 text-rose-500" /></Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="max-h-[360px] overflow-y-auto text-xs space-y-1 pt-2 border-t">
              {filteredRegs.length === 0 && <p className="text-slate-400 text-center py-3">Aucun exposant trouvé</p>}
              {filteredRegs.slice(0, 100).map(r => {
                const checked = selectedIds.has(r.id);
                const h = r.organization?.participation_history;
                return (
                  <div key={r.id} className={`flex items-center gap-2 py-1.5 px-2 rounded border ${checked ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-100 hover:bg-slate-50'}`}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleOne(r.id)}
                      className="w-4 h-4 cursor-pointer accent-blue-600 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <AiInsightTrigger registration={r} size="xs" />
                        <span className="font-medium truncate">{r.organization?.name}</span>
                        {r.stand_code && <span className="text-[10px] font-mono text-slate-400 shrink-0">{r.stand_code}</span>}
                        {h?.fidelity?.includes('Fidèle') && <span className="text-[9px] px-1 rounded bg-amber-100 text-amber-700 border border-amber-200 shrink-0" title={`${h.nb_editions} éditions`}>⭐</span>}
                        {h?.fidelity === 'Régulier' && <span className="text-[9px] px-1 rounded bg-blue-100 text-blue-700 border border-blue-200 shrink-0" title={`${h.nb_editions} éditions`}>🔁</span>}
                        {h?.fidelity === 'Ponctuel' && <span className="text-[9px] px-1 rounded bg-slate-100 text-slate-600 border border-slate-200 shrink-0" title={`${h.nb_editions} éditions`}>📌</span>}
                        {!h && <span className="text-[9px] px-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">🆕</span>}
                      </div>
                      <div className="text-[10px] text-slate-500 truncate">
                        {r.organization?.main_email}
                        {h && <span className="text-slate-400"> · {[h.y2025 && '25', h.y2024 && '24', h.y2023 && '23', h.y2020 && '20', h.y2019 && '19'].filter(Boolean).join('/')}</span>}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-1.5 text-[10px] shrink-0"
                      onClick={() => selectOnly(r.id)}
                      title="Sélectionner uniquement celui-ci"
                    >
                      Lui seul
                    </Button>
                  </div>
                );
              })}
              {filteredRegs.length > 100 && <div className="text-slate-400 text-center pt-1">+ {filteredRegs.length - 100} autre(s)… affinez avec la recherche</div>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Clock className="w-4 h-4 text-slate-500" /> Historique</CardTitle></CardHeader>
          <CardContent className="space-y-2 max-h-[400px] overflow-y-auto">
            {emails.length === 0 ? <p className="text-slate-500 text-sm">Aucun email envoyé.</p> : emails.slice(0, 30).map(e => (
              <div key={e.id} className="border rounded-md p-2.5 text-xs">
                <div className="flex items-center justify-between gap-2"><div className="font-medium truncate">{e.subject}</div><Badge variant="secondary" className="shrink-0">{e.send_status}</Badge></div>
                <div className="text-slate-500 mt-1"><Mail className="w-3 h-3 inline mr-1" /> {e.to_email}</div>
                <div className="text-slate-400 mt-0.5">{e.sent_at && new Date(e.sent_at).toLocaleString('fr-FR')}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
      </div>
    </div>
  );
}

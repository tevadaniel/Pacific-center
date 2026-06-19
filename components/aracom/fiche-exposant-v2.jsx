'use client';

/**
 * 🆔 FicheExposantV2 — Panneau complet de gestion d'un profil exposant
 *
 * - Toggle Entreprise/Association (cosmétique + DB via entity_type)
 * - Header : avatar, méta, badges dynamiques, alerte contextuelle, 4 métriques
 * - 11 sections collapsibles avec inline edit par champ (OK/Annuler + toast)
 * - Sauvegarde temps réel via PUT /api/organizations/:id et PUT /api/registrations/:id
 * - Zone suppression 2 étapes (réutilise DeleteOrgDialog)
 *
 * Stack : Next.js + MongoDB (les references "Supabase" du brief sont mappées sur nos APIs)
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  ChevronDown, ChevronUp, Pencil, Plus, X, Check, CheckCircle2, Loader2,
  User, Phone, FileText, MapPin, History, ListChecks, Wallet,
  FileBox, Sparkles, Activity, StickyNote, AlertTriangle, Trash2,
  Mail, ExternalLink, Building2, Users as UsersIcon, CalendarClock,
  FileCheck2, Upload, Download, RefreshCw, Copy, Link as LinkIcon,
  IdCard, Shield, FileSpreadsheet, Receipt, FileBadge, Lock,
} from 'lucide-react';
import { api } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
// (Tabs supprimés en SESSION 43-g — tout regroupé en sections scrollables)
import DeleteOrgDialog from './delete-org-dialog';
import SendExposantMailDialog from './send-exposant-mail-dialog';
import DocumentsTab from './documents-tab';
import PortalTab from './portal-tab';
import FicheRecapBlock from './fiche-recap-block';
import AiInsightTrigger from '@/components/ai-insight-trigger';
import { useExposantPanel } from './exposant-panel-context';

// =======================================================
// 🧰 Helpers : EditableField, CollapsibleSection, etc.
// =======================================================

function getInitials(name = '') {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() || '').join('') || '??';
}

function CollapsibleSection({ icon: Icon, title, children, defaultOpen = true, badge }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 hover:bg-slate-50 transition"
      >
        <div className="flex items-center gap-2">
          {Icon && <Icon className="w-4 h-4 text-slate-500" />}
          <span className="font-semibold text-xs uppercase tracking-wider text-slate-700">{title}</span>
          {badge}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>
      {open && <div className="px-3.5 pb-3 pt-1 space-y-2">{children}</div>}
    </div>
  );
}

/**
 * Champ inline-editable. type: 'text' | 'email' | 'tel' | 'url' | 'number' | 'textarea' | 'select' | 'date' | 'datetime-local' | 'time'
 */
function EditableField({ label, value, type = 'text', options, placeholder, onSave, validate, format, maxLength }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');
  const [saving, setSaving] = useState(false);
  useEffect(() => { setDraft(value ?? ''); }, [value]);

  const isEmpty = value === null || value === undefined || value === '';
  const display = isEmpty
    ? <span className="italic text-slate-400">Non renseigné</span>
    : (format ? format(value) : <span className="text-slate-800">{String(value)}</span>);

  const save = async () => {
    if (validate) {
      const err = validate(draft);
      if (err) { toast.error(err); return; }
    }
    setSaving(true);
    try {
      await onSave(draft === '' ? null : draft);
      setEditing(false);
      toast.success('Enregistré');
    } catch (e) {
      toast.error(e.message || 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-start gap-2 py-1.5 border-b border-slate-100 last:border-b-0">
      <div className="w-28 sm:w-36 text-xs text-slate-500 pt-1.5 shrink-0">{label}</div>
      <div className="flex-1 min-w-0">
        {editing ? (
          <div className="flex items-center gap-1.5">
            {type === 'textarea' ? (
              <Textarea
                rows={3}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                maxLength={maxLength}
                className="text-xs flex-1 min-w-0"
                placeholder={placeholder}
              />
            ) : type === 'select' ? (
              <select
                value={draft || ''}
                onChange={(e) => setDraft(e.target.value)}
                className="h-8 text-xs flex-1 min-w-0 rounded-md border border-input bg-white px-2"
              >
                <option value="">{placeholder || '—'}</option>
                {(options || []).map((o) => {
                  const val = typeof o === 'string' ? o : o.value;
                  const lbl = typeof o === 'string' ? o : (o.label || o.value);
                  return <option key={val} value={val}>{lbl}</option>;
                })}
              </select>
            ) : (
              <Input
                type={type}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className="h-8 text-xs flex-1 min-w-0"
                placeholder={placeholder}
              />
            )}
            <Button size="sm" onClick={save} disabled={saving} className="h-8 px-2 bg-emerald-600 hover:bg-emerald-700 text-white">
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setDraft(value ?? ''); }} className="h-8 px-2 text-slate-500">
              <X className="w-3 h-3" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs truncate">{display}</div>
            <Button size="sm" variant="outline" onClick={() => setEditing(true)} className="h-7 px-2 text-[11px] shrink-0">
              <Pencil className="w-3 h-3 mr-1" />
              {isEmpty ? 'Ajouter' : 'Modifier'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// =======================================================
// 🆕 SESSION 50 — Sous-composants pour la nouvelle structure
// =======================================================

/**
 * Card pour un document REQUIS uploadable (Convention / Assurance / ID / Justif)
 */
function RequiredDocCard({ icon: Icon, title, required = true, doc, regId, docType, onReload, extraAction }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const hasFile = !!doc;

  const upload = async (file) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error('Fichier trop volumineux (max 10 Mo)'); return; }
    setUploading(true);
    try {
      const reader = new FileReader();
      const dataUrl = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const base64 = String(dataUrl).split(',')[1];
      await api('/api/registration-documents', {
        method: 'POST',
        body: JSON.stringify({
          registration_id: regId,
          document_type: docType,
          category: docType,
          file_name: file.name,
          mime_type: file.type || 'application/octet-stream',
          file_data: base64,
          status: 'recu',
        }),
      });
      toast.success(`✅ ${title} uploadé`);
      onReload?.();
    } catch (e) { toast.error(e?.message || 'Erreur upload'); }
    finally { setUploading(false); }
  };

  return (
    <div className="rounded-lg border border-amber-200 bg-white p-2.5 flex items-center gap-2.5">
      <div className="w-8 h-8 rounded-md bg-amber-100 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-amber-700" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-semibold text-xs text-slate-900">{title}</span>
          <Badge className={`text-[9px] h-4 px-1.5 ${required ? 'bg-red-50 text-red-700 border-red-200' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
            {required ? 'Obligatoire' : 'Optionnel'}
          </Badge>
          {hasFile && <Badge className="text-[9px] h-4 px-1.5 bg-emerald-100 text-emerald-800 border-emerald-300">✓ Reçu</Badge>}
        </div>
        {hasFile && <div className="text-[10px] text-slate-500 truncate italic mt-0.5">📎 {doc.file_name}</div>}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Button size="sm" variant="outline" onClick={() => inputRef.current?.click()} disabled={uploading} className="h-7 px-2 text-[10px] gap-1">
          {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
          {hasFile ? 'Remplacer' : 'Uploader'}
        </Button>
        {extraAction}
      </div>
      <input
        type="file"
        ref={inputRef}
        className="hidden"
        accept=".pdf,.jpg,.jpeg,.png"
        onChange={(e) => upload(e.target.files?.[0])}
      />
    </div>
  );
}

/**
 * Card simplifiée pour un document AUTO-GÉNÉRÉ (Reçu / Attestation / Badge / Guide)
 */
function AutoDocCard({ icon: Icon, iconBg, title, doc, regId, docType, onReload, disabled = false, disabledReason }) {
  const [busy, setBusy] = useState(false);
  const hasFile = !!doc;

  const generate = async () => {
    setBusy(true);
    try {
      await api('/api/documents/generate', {
        method: 'POST',
        body: JSON.stringify({ registration_id: regId, doc_type: docType }),
      });
      toast.success(`✅ ${title} généré`);
      onReload?.();
    } catch (e) { toast.error(e?.message || 'Erreur génération'); }
    finally { setBusy(false); }
  };

  const download = () => doc?.id && window.open(`/api/documents/${doc.id}/download`, '_blank');
  const sendMail = async () => {
    if (!doc?.id) return;
    try {
      await api('/api/documents/send', {
        method: 'POST',
        body: JSON.stringify({ registration_id: regId, doc_id: doc.id, doc_type: docType }),
      });
      toast.success('📧 Envoyé par mail');
    } catch (e) { toast.error(e.message); }
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-2.5 flex items-center gap-2.5">
      <div className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${iconBg}`}>
        <Icon className="w-4 h-4 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-semibold text-xs text-slate-900">{title}</span>
          <Badge className="text-[9px] h-4 px-1.5 bg-blue-50 text-blue-700 border-blue-200">Auto</Badge>
          <Badge className={`text-[9px] h-4 px-1.5 ${
            hasFile ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
            : disabled ? 'bg-slate-100 text-slate-500 border-slate-300'
            : 'bg-amber-100 text-amber-800 border-amber-300'
          }`}>
            {hasFile ? '✓ Généré' : disabled ? 'En attente' : 'À générer'}
          </Badge>
        </div>
        {disabled && disabledReason && (
          <div className="text-[10px] text-slate-500 italic mt-0.5">{disabledReason}</div>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {!hasFile && (
          <Button
            size="sm"
            onClick={generate}
            disabled={busy || disabled}
            className="h-7 px-2 text-[10px] bg-slate-900 hover:bg-slate-800 text-white gap-1 disabled:opacity-40"
            title={disabled ? disabledReason : ''}
          >
            {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />} Générer
          </Button>
        )}
        {hasFile && (
          <>
            <Button size="sm" variant="outline" onClick={generate} disabled={busy} className="h-7 px-2 text-[10px] gap-1">
              {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />} Régén.
            </Button>
            <Button size="sm" variant="outline" onClick={download} className="h-7 px-2 text-[10px] gap-1">
              <Download className="w-3 h-3" />
            </Button>
            <Button size="sm" variant="outline" onClick={sendMail} className="h-7 px-2 text-[10px] gap-1">
              <Mail className="w-3 h-3" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Petite ligne "condition" avec icône ✓/✗/⏳
 */
function ConditionRow({ ok, partial = false, label }) {
  const icon = ok ? '✓' : partial ? '⏳' : '✗';
  const cls = ok ? 'text-emerald-600' : partial ? 'text-amber-600' : 'text-red-500';
  return (
    <div className="flex items-center gap-1.5">
      <span className={`font-bold ${cls} w-3 text-center`}>{icon}</span>
      <span className={`${ok ? 'text-slate-700' : 'text-slate-500'}`}>{label}</span>
    </div>
  );
}


// =======================================================
// 🚀 MAIN COMPONENT
// =======================================================

export default function FicheExposantV2({ id, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [allVenues, setAllVenues] = useState([]);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [showDelete2Step, setShowDelete2Step] = useState(false);
  const [showMailDialog, setShowMailDialog] = useState(false);
  const [confirming, setConfirming] = useState(false);
  // 🆕 SESSION 50 — Multi-sites + magic-link
  const [sitesList, setSitesList] = useState([]);
  const [magicLink, setMagicLink] = useState(null);
  const [magicLinkBusy, setMagicLinkBusy] = useState(false);
  const { open: openExposantPanel } = useExposantPanel();

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [d, v] = await Promise.all([
        api(`/api/registrations/${id}`),
        api('/api/venues?only_active=1').catch(() => []),
      ]);
      setData(d);
      setAllVenues(Array.isArray(v) ? v : []);
      // 🆕 Multi-sites + magic-link en parallèle (silent fail)
      const orgId = d?.organization?.id;
      if (orgId) {
        api(`/api/exposant/my-sites?organization_id=${encodeURIComponent(orgId)}`)
          .then((s) => setSitesList(Array.isArray(s) ? s : []))
          .catch(() => setSitesList([]));
      }
      api(`/api/registrations/${id}/access-link`)
        .then((r) => setMagicLink(r || null))
        .catch(() => setMagicLink(null));
    } catch (e) {
      toast.error(e.message || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, [id]);

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  const reg = data.registration || {};
  const org = data.organization || {};
  const venue = data.venue || {};
  const slots = data.slots || [];
  const docs = data.documents || [];
  const dep = data.deposit || {};
  const sessions = data.attendance_sessions || [];

  // 🎨 Determine entity type — default 'entreprise' if not set
  const entityType = org.entity_type === 'association' ? 'association' : 'entreprise';
  const isAssoc = entityType === 'association';

  // 🗓️ Format dates (FR) — pour affichage "Profil créé le …"
  const fmtDate = (d) => {
    if (!d) return null;
    try {
      const date = new Date(d);
      if (isNaN(date.getTime())) return null;
      return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch { return null; }
  };
  const fmtDateTime = (d) => {
    if (!d) return null;
    try {
      const date = new Date(d);
      if (isNaN(date.getTime())) return null;
      return date.toLocaleString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch { return null; }
  };
  const orgCreatedAt = fmtDate(org.created_at);
  const orgCreatedAtFull = fmtDateTime(org.created_at);
  const regCreatedAt = fmtDate(reg.created_at);
  const regCreatedAtFull = fmtDateTime(reg.created_at);
  const orgUpdatedAtFull = fmtDateTime(org.updated_at);

  // 🏷️ Compute display metrics
  const dossierPct = reg.completion_percent ?? reg.dossier_pct ?? 0;
  const isCautionOk = dep && dep.status && dep.status !== 'en_attente';
  const isConventionOk = reg.is_convention_signed || reg.convention_status === 'signee';
  const isAssuranceOk = reg.is_insurance_uploaded || reg.assurance_status === 'recue';
  const isEmailMissing = !org.main_email;

  // 🎨 Avatar color
  const avatarBg = isAssoc ? 'bg-teal-600' : 'bg-blue-600';
  const orgDisplay = org.name || '—';
  const fullName = ((org.first_name || '') + ' ' + (org.last_name || '')).trim() || org.contact_name || orgDisplay;

  // 💾 Save helpers — patch one or several fields
  const saveOrg = async (patch) => {
    const updated = await api(`/api/organizations/${org.id}`, { method: 'PUT', body: JSON.stringify(patch) });
    setData((d) => ({ ...d, organization: updated }));
    return updated;
  };
  const saveReg = async (patch) => {
    const updated = await api(`/api/registrations/${reg.id}`, { method: 'PUT', body: JSON.stringify(patch) });
    setData((d) => ({ ...d, registration: updated }));
    return updated;
  };
  const saveDep = async (patch) => {
    if (!dep?.id) {
      toast.error('Aucun dépôt initialisé pour ce dossier');
      return;
    }
    const updated = await api(`/api/deposits/${dep.id}`, { method: 'PUT', body: JSON.stringify(patch) });
    setData((d) => ({ ...d, deposit: updated }));
    return updated;
  };

  // ─── Quick actions ───
  const confirmInscription = async () => {
    if (reg.status === 'confirme') { toast.info('Déjà confirmée'); return; }
    setConfirming(true);
    try {
      await saveReg({ status: 'confirme' });
      toast.success('✅ Inscription confirmée');
    } catch (e) { toast.error(e.message); }
    finally { setConfirming(false); }
  };

  const copyAccessLink = async () => {
    try {
      const r = await api(`/api/registrations/${reg.id}/access-link`);
      const url = r?.url || r?.link;
      if (!url) throw new Error('Lien indisponible');
      await navigator.clipboard.writeText(url);
      toast.success('📋 Lien copié');
    } catch (e) { toast.error(e.message); }
  };

  // ─── Status grid handler ───
  const setStatus = async (newStatus) => {
    if (newStatus === reg.status) return;
    try {
      await saveReg({ status: newStatus });
      toast.success(`Statut → ${newStatus}`);
    } catch (e) { toast.error(e.message); }
  };

  // ─── Delete 2-step ───
  const askDelete = () => setShowDelete2Step(true);
  const cancelDelete = () => { setShowDelete2Step(false); setDeleteConfirmName(''); };
  const performDelete = () => {
    if (deleteConfirmName.trim() !== org.name) {
      toast.error('Le nom ne correspond pas');
      return;
    }
    setShowDeleteDialog(true);
  };

  // ─── Entity type toggle ───
  const toggleEntityType = async (newType) => {
    if (newType === entityType) return;
    try { await saveOrg({ entity_type: newType }); toast.success(`Type → ${newType === 'association' ? 'Association' : 'Entreprise'}`); }
    catch (e) { toast.error(e.message); }
  };

  // ─── Quick toggle for required docs (3 obligatoires : convention, assurance, identité) ───
  const toggleDocReceived = async (docType, isOk) => {
    try {
      if (docType === 'convention') {
        await saveReg({ is_convention_signed: isOk, convention_status: isOk ? 'signee' : 'non_signee' });
      } else if (docType === 'assurance') {
        await saveReg({ is_insurance_uploaded: isOk, assurance_status: isOk ? 'recue' : 'manquante' });
      } else if (docType === 'identite') {
        await saveReg({ identity_received: isOk });
      }
      toast.success('✅ Mis à jour');
    } catch (e) { toast.error(e.message); }
  };

  // 🆕 SESSION 50 — Magic link handlers (regenerate / send / copy / open)
  const copyMagicLink = async () => {
    try {
      const url = magicLink?.url || magicLink?.link;
      if (!url) throw new Error('Lien indisponible');
      await navigator.clipboard.writeText(url);
      toast.success('📋 Lien copié');
    } catch (e) { toast.error(e.message); }
  };
  const openMagicLink = () => {
    const url = magicLink?.url || magicLink?.link;
    if (!url) { toast.error('Lien indisponible'); return; }
    window.open(url, '_blank');
  };
  const sendMagicLinkByMail = async () => {
    setMagicLinkBusy(true);
    try {
      await api(`/api/registrations/${reg.id}/send-access-link`, { method: 'POST' });
      toast.success('📧 Lien envoyé à l\'exposant');
    } catch (e) { toast.error(e.message); }
    finally { setMagicLinkBusy(false); }
  };
  const regenerateMagicLink = async () => {
    setMagicLinkBusy(true);
    try {
      await api(`/api/registrations/${reg.id}/regenerate-token`, { method: 'POST' });
      // Refetch the link
      const fresh = await api(`/api/registrations/${reg.id}/access-link`).catch(() => null);
      setMagicLink(fresh);
      toast.success('🔄 Nouveau lien généré');
    } catch (e) { toast.error(e.message); }
    finally { setMagicLinkBusy(false); }
  };

  // 🆕 SESSION 50 — Statut visuel d'un site (vert/orange/gris) selon règle métier
  // vert (validé) = stand assigné + date(s) + ≥1 anim/jour + caution remise
  // orange (pré-réservé) = stand assigné + date(s) + ≥1 anim/jour mais caution manquante
  // gris (liste d'attente) = conditions incomplètes
  const computeSiteCardStatus = (site, siteSlots) => {
    const hasStand = !!site.stand_code;
    const days = Array.isArray(site.attending_days) ? site.attending_days : [];
    const hasDates = days.length > 0;
    const animsByDay = days.map((d) => ({ day: d, slots: (siteSlots || []).filter((s) => s.date === d) }));
    const minOneAnimPerDay = hasDates && animsByDay.every((g) => g.slots.length >= 1);
    const cautionOk = !!(dep?.amount_xpf || reg.caution_received_date);
    if (hasStand && hasDates && minOneAnimPerDay && cautionOk) return 'valide';
    if (hasStand && hasDates && minOneAnimPerDay) return 'pre_reserve';
    return 'liste_attente';
  };

  // 🆕 SESSION 50 — Liste agrégée des sites (multi-sites OU site courant)
  const aggregatedSites = (sitesList && sitesList.length > 0)
    ? sitesList
    : [{
        id: reg.id,
        venue: venue,
        venue_id: reg.venue_id,
        stand_code: reg.stand_code,
        attending_days: reg.attending_days,
        status: reg.status,
        is_locked: reg.is_locked,
      }];

  // 🆕 SESSION 50 — Documents catégorisés
  const findDoc = (type) => (docs || []).find((d) => d.document_type === type || d.category === type);
  const conventionDoc = findDoc('convention');
  const assuranceDoc = findDoc('assurance');
  const identiteDoc = findDoc('identite');
  const immatDoc = findDoc('immatriculation');
  const recuCautionDoc = findDoc('recu_caution');
  const attestRemboursDoc = findDoc('attestation_remboursement');
  const badgeDoc = findDoc('badge_exposant');
  const guideDoc = findDoc('guide_participant');

  // 🆕 SESSION 50 — Liste des docs manquants (Convention/Assurance/Identité = obligatoires, Immat = optionnel)
  const missingDocs = [];
  if (!conventionDoc && !isConventionOk) missingDocs.push({ key: 'convention', icon: FileCheck2, title: 'Convention signée', required: true, docType: 'convention', doc: conventionDoc });
  if (!assuranceDoc && !isAssuranceOk) missingDocs.push({ key: 'assurance', icon: Shield, title: 'Attestation d\'assurance', required: true, docType: 'assurance', doc: assuranceDoc });
  if (!identiteDoc && !reg.identity_received) missingDocs.push({ key: 'identite', icon: IdCard, title: 'Pièce d\'identité du référent', required: true, docType: 'identite', doc: identiteDoc });
  if (!immatDoc && !org.tahiti_number && !org.siret && !org.siren) missingDocs.push({ key: 'immat', icon: FileSpreadsheet, title: 'Justificatif d\'immatriculation', required: false, docType: 'immatriculation', doc: immatDoc });

  // 🆕 SESSION 50 — Statut "global" du dossier pour le badge header (locked = workflow)
  const stsLabel = reg.status === 'confirme' ? 'Confirmé'
    : reg.status === 'annule' ? 'Annulé'
    : reg.status === 'liste_attente' ? 'Liste d\'attente'
    : 'À confirmer';
  const stsClass = reg.status === 'confirme' ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
    : reg.status === 'annule' ? 'bg-red-100 text-red-800 border-red-300'
    : reg.status === 'liste_attente' ? 'bg-violet-100 text-violet-800 border-violet-300'
    : 'bg-amber-100 text-amber-800 border-amber-300';

  // Format date for "Dernier accès" / "Validité token"
  const fmtLastAccess = (d) => d ? fmtDateTime(d) : 'Jamais';

  return (
    <div className="space-y-3 max-w-3xl mx-auto pb-8">
      {/* ═══════════════════ 1. HEADER (toujours visible) ═══════════════════ */}
      <div className="rounded-xl border border-slate-200 bg-white p-3.5">
        <div className="flex items-start gap-3">
          <div className={`w-12 h-12 rounded-full ${avatarBg} text-white flex items-center justify-center font-bold text-lg shrink-0`}>
            {getInitials(fullName)}
          </div>
          <div className="flex-1 min-w-0">
            {/* Ligne 1 — Nom représentant + Nom structure */}
            <div className="font-bold text-base text-slate-900 truncate">{fullName}</div>
            <div className="text-xs text-slate-500 truncate">
              <span className="font-medium">{orgDisplay}</span>
              {reg.stand_code && <span> · 🎪 <span className="font-mono font-semibold text-slate-700">{reg.stand_code}</span></span>}
              {venue?.name && <span> · 📍 {venue.name}</span>}
            </div>

            {/* Ligne 2 — Badges statut + secteur/discipline + priorité */}
            <div className="flex flex-wrap gap-1 mt-2">
              <Badge className={`text-[10px] ${stsClass}`}>
                {reg.status === 'confirme' ? '✓' : reg.status === 'annule' ? '⛔' : reg.status === 'liste_attente' ? '⏳' : '⏱'} {stsLabel}
              </Badge>
              {org.discipline && (
                <Badge variant="outline" className="text-[10px] border-slate-300 text-slate-600">
                  🎨 {org.discipline}
                </Badge>
              )}
              {org.priority_level && (
                <Badge className={`text-[10px] ${
                  org.priority_level === 'A' ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                  : org.priority_level === 'B' ? 'bg-amber-100 text-amber-800 border-amber-300'
                  : 'bg-blue-100 text-blue-800 border-blue-300'}`}>Priorité {org.priority_level}</Badge>
              )}
              {isEmailMissing && <Badge className="bg-red-100 text-red-800 border-red-300 text-[10px]">📧 Email manquant</Badge>}
            </div>

            {/* Ligne 3 — Métadonnées temporelles */}
            {(orgCreatedAt || regCreatedAt) && (
              <div
                className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10.5px] text-slate-500"
                title={[
                  orgCreatedAtFull && `Profil organisation créé : ${orgCreatedAtFull}`,
                  regCreatedAtFull && `Inscription créée : ${regCreatedAtFull}`,
                  orgUpdatedAtFull && `Dernière modification : ${orgUpdatedAtFull}`,
                ].filter(Boolean).join('\n')}
              >
                <CalendarClock className="w-3 h-3 text-slate-400" />
                {orgCreatedAt && <span>Profil créé le <span className="font-semibold text-slate-700">{orgCreatedAt}</span></span>}
                {regCreatedAt && regCreatedAt !== orgCreatedAt && (
                  <span>· Inscription le <span className="font-semibold text-slate-700">{regCreatedAt}</span></span>
                )}
              </div>
            )}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 shrink-0 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 4 métriques EN LIGNE */}
        <div className="grid grid-cols-4 gap-2 mt-3">
          <div className="rounded-md bg-slate-50 border border-slate-200 px-2 py-1.5 text-center">
            <div className="text-[9px] text-slate-500 uppercase tracking-wider">Dossier</div>
            <div className="font-bold text-slate-900 text-sm">{dossierPct}%</div>
          </div>
          <div className="rounded-md bg-slate-50 border border-slate-200 px-2 py-1.5 text-center">
            <div className="text-[9px] text-slate-500 uppercase tracking-wider">Caution</div>
            <div className="font-bold text-slate-900 text-sm">{dep?.amount_xpf ? `${(dep.amount_xpf / 1000).toFixed(0)}K` : '—'}</div>
          </div>
          <div className="rounded-md bg-slate-50 border border-slate-200 px-2 py-1.5 text-center">
            <div className="text-[9px] text-slate-500 uppercase tracking-wider">Animations</div>
            <div className="font-bold text-slate-900 text-sm">{slots.length}</div>
          </div>
          <div className="rounded-md bg-slate-50 border border-slate-200 px-2 py-1.5 text-center">
            <div className="text-[9px] text-slate-500 uppercase tracking-wider">Jour(s)</div>
            <div className="font-bold text-slate-900 text-sm">
              {Array.isArray(reg.attending_days) ? reg.attending_days.length : 0}/2
            </div>
          </div>
        </div>

        {/* 3 boutons d'action */}
        <div className="flex flex-wrap gap-1.5 mt-3">
          <Button
            size="sm"
            onClick={confirmInscription}
            disabled={confirming || reg.status === 'confirme'}
            className="flex-1 min-w-[110px] h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
          >
            {confirming ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
            Confirmer
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowMailDialog(true)}
            disabled={!org.main_email}
            className="flex-1 min-w-[110px] h-8 text-xs gap-1"
          >
            <Mail className="w-3 h-3" /> Envoyer mail
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={copyAccessLink}
            className="flex-1 min-w-[110px] h-8 text-xs gap-1"
          >
            <LinkIcon className="w-3 h-3" /> Lien accès
          </Button>
        </div>
      </div>

      {/* ═══════════════════ 2. BLOC DOSSIER INCOMPLET (orange warning, si manquant) ═══════════════════ */}
      {missingDocs.length > 0 && (
        <div className="rounded-xl border-2 border-amber-400 bg-amber-50/40 p-3">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-amber-700" />
            <span className="font-bold text-xs uppercase tracking-wider text-amber-900">
              Dossier incomplet — {missingDocs.filter(d => d.required).length} document(s) obligatoire(s)
            </span>
          </div>
          <div className="space-y-1.5">
            {missingDocs.map((m) => (
              <RequiredDocCard
                key={m.key}
                icon={m.icon}
                title={m.title}
                required={m.required}
                doc={m.doc}
                regId={reg.id}
                docType={m.docType}
                onReload={load}
                extraAction={m.key === 'convention' ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      try {
                        await api(`/api/registrations/${reg.id}/send-convention`, { method: 'POST' });
                        toast.success('📧 Convention renvoyée');
                      } catch (e) {
                        // Fallback: simple mail action
                        setShowMailDialog(true);
                      }
                    }}
                    className="h-7 px-2 text-[10px] gap-1"
                  >
                    <Mail className="w-3 h-3" /> Renvoyer
                  </Button>
                ) : null}
              />
            ))}
          </div>
        </div>
      )}

      {/* ═══════════════════ 3. ACCORDÉON IDENTITÉ & CONTACT (closed) ═══════════════════ */}
      <CollapsibleSection icon={User} title="Identité & Contact" defaultOpen={false}>
        {/* Sous-section Structure */}
        <div className="mb-2">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1.5">
            <Building2 className="w-3 h-3" /> Structure
          </div>
          <EditableField label="Nom de la structure" value={org.name} placeholder="Nom de la société ou association" onSave={(v) => saveOrg({ name: v })} />
          <EditableField
            label="Forme juridique"
            type="select"
            options={['Association', 'Entreprise', 'Société', 'SARL', 'SAS', 'EURL', 'EI (Entreprise individuelle)', 'Patente', 'GIE', 'Coopérative', 'Profession libérale', 'Autre']}
            value={org.forme_juridique}
            onSave={(v) => saveOrg({ forme_juridique: v })}
          />
          <AdminDisciplineField value={org.discipline} onSave={(v) => saveOrg({ discipline: v })} />
          <EditableField label="Description stand" type="textarea" maxLength={150} value={org.description} placeholder="150 caractères max" onSave={(v) => saveOrg({ description: v })} />
        </div>

        {/* Sous-section Personnes */}
        <div className="mb-2 pt-2 border-t border-slate-100">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1.5">
            <UsersIcon className="w-3 h-3" /> Personnes
          </div>
          <EditableField label="Président(e)" value={org.president_name} placeholder="Nom complet du président" onSave={(v) => saveOrg({ president_name: v })} />
          <EditableField label="Référent / Représentant" value={org.contact_name} placeholder="Prénom Nom" onSave={(v) => saveOrg({ contact_name: v })} />
          <EditableField label="Fonction" value={org.position} placeholder="ex: Président, Directeur, Responsable…" onSave={(v) => saveOrg({ position: v })} />
        </div>

        {/* Sous-section Contact */}
        <div className="mb-2 pt-2 border-t border-slate-100">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1.5">
            <Phone className="w-3 h-3" /> Contact
          </div>
          <EditableField label="Email" type="email" value={org.main_email}
            validate={(v) => v && !/.+@.+\..+/.test(v) ? 'Email invalide' : null}
            onSave={(v) => saveOrg({ main_email: v })} />
          <EditableField label="Téléphone" type="tel" value={org.main_phone} placeholder="+689 ..." onSave={(v) => saveOrg({ main_phone: v })} />
          <EditableField label="Site web" type="url" value={org.website} placeholder="https://..." onSave={(v) => saveOrg({ website: v })} />
          <EditableField label="Facebook" type="url" value={org.facebook} placeholder="https://facebook.com/..." onSave={(v) => saveOrg({ facebook: v })} />
        </div>

        {/* Sous-section Immatriculation */}
        <div className="pt-2 border-t border-slate-100">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1.5">
            <FileText className="w-3 h-3" /> Immatriculation
          </div>
          <EditableField label="N° Tahiti" value={org.tahiti_number} placeholder="N° Tahiti (obligatoire en PF)" onSave={(v) => saveOrg({ tahiti_number: v })} />
          <EditableField label="SIRET" value={org.siret} placeholder="14 chiffres" onSave={(v) => saveOrg({ siret: v })} />
          <EditableField label="SIREN" value={org.siren} placeholder="9 chiffres" onSave={(v) => saveOrg({ siren: v })} />
        </div>
      </CollapsibleSection>

      {/* ═══════════════════ 4. ACCORDÉON STAND & SITE (closed) ═══════════════════ */}
      <CollapsibleSection
        icon={MapPin}
        title="Stand & Site"
        defaultOpen={false}
        badge={<Badge variant="secondary" className="text-[10px] ml-1">{aggregatedSites.length} site{aggregatedSites.length > 1 ? 's' : ''}</Badge>}
      >
        {/* Carte par site avec bordure colorée selon statut */}
        <div className="space-y-3">
          {aggregatedSites.map((site) => {
            const isCurrent = site.id === reg.id;
            // Slots pour ce site (uniquement disponibles pour le site courant)
            const siteSlots = isCurrent ? slots : [];
            const visualStatus = computeSiteCardStatus(site, siteSlots);
            const borderClass = visualStatus === 'valide' ? 'border-emerald-400 bg-emerald-50/30'
              : visualStatus === 'pre_reserve' ? 'border-orange-400 bg-orange-50/30'
              : 'border-slate-300 bg-slate-50/30';
            const statusBadge = visualStatus === 'valide' ? { lbl: '✓ Validé', cls: 'bg-emerald-600 text-white border-emerald-700' }
              : visualStatus === 'pre_reserve' ? { lbl: '🟧 Pré-réservé', cls: 'bg-orange-500 text-white border-orange-600' }
              : { lbl: '⏳ Liste d\'attente', cls: 'bg-slate-400 text-white border-slate-500' };
            const days = Array.isArray(site.attending_days) ? site.attending_days : [];
            const hasStand = !!site.stand_code;
            const hasDates = days.length > 0;
            const animsByDay = days.map((d) => ({ day: d, slots: (siteSlots || []).filter((s) => s.date === d) }));
            const minOneAnimPerDay = hasDates && animsByDay.every((g) => g.slots.length >= 1);
            const cautionOk = !!(dep?.amount_xpf || reg.caution_received_date);

            return (
              <div key={site.id} className={`rounded-lg border-2 ${borderClass} p-3`}>
                {/* Header de la carte site */}
                <div className="flex items-start justify-between gap-2 mb-2 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-sm text-slate-900 truncate">📍 {site.venue?.name || '—'}</span>
                      {site.stand_code && (
                        <Badge variant="outline" className="text-[10px] font-mono font-bold border-slate-400">
                          🎪 {site.stand_code}
                        </Badge>
                      )}
                      {!isCurrent && (
                        <button
                          onClick={() => openExposantPanel(site.id)}
                          className="text-[10px] text-blue-600 underline hover:text-blue-800"
                        >
                          (basculer)
                        </button>
                      )}
                    </div>
                  </div>
                  {/* Bouton statut verrouillé */}
                  <button
                    disabled
                    title="Statut géré par le workflow plateforme"
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-[10px] font-bold cursor-not-allowed opacity-90 ${statusBadge.cls}`}
                  >
                    <Lock className="w-2.5 h-2.5" /> {statusBadge.lbl}
                  </button>
                </div>

                {/* 4 conditions avec icônes */}
                <div className="grid grid-cols-2 gap-1.5 text-[11px] mb-2">
                  <ConditionRow ok={hasStand} label="Site & stand assigné" />
                  <ConditionRow ok={hasDates} label="Date(s) renseignée(s)" />
                  <ConditionRow ok={minOneAnimPerDay} label="Animation(s) planifiée(s)" partial={hasDates && !minOneAnimPerDay} />
                  <ConditionRow ok={cautionOk} label="Caution remise" />
                </div>

                {/* Jours de présence */}
                {hasDates && (
                  <div className="text-[10px] text-slate-600 mb-2">
                    <span className="font-semibold">Jours :</span> {days.map((d) => d === '2026-08-14' ? 'Ven. 14' : 'Sam. 15').join(' + ')}
                  </div>
                )}

                {/* Boutons d'action (uniquement sur le site courant) */}
                {isCurrent && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {!hasDates && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => saveReg({ attending_days: ['2026-08-14', '2026-08-15'] })}
                        className="h-7 px-2 text-[10px] gap-1 border-orange-300 text-orange-700 hover:bg-orange-50"
                      >
                        <Plus className="w-3 h-3" /> Ajouter dates
                      </Button>
                    )}
                  </div>
                )}

                {/* Animations par jour (uniquement site courant) */}
                {isCurrent && hasDates && (
                  <div className="space-y-1.5 mt-2 pt-2 border-t border-slate-200">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Planning par jour</div>
                    {animsByDay.map(({ day, slots: daySlots }) => {
                      const dayLabel = day === '2026-08-14' ? 'Vendredi 14 août' : 'Samedi 15 août';
                      return (
                        <div key={day} className={`rounded-md border p-2 ${daySlots.length === 0 ? 'border-red-300 bg-red-50/50' : 'border-slate-200 bg-white'}`}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold text-xs text-slate-800">📅 {dayLabel}</span>
                            <Badge variant="outline" className="text-[9px]">{daySlots.length} anim.</Badge>
                          </div>
                          {daySlots.length === 0 ? (
                            <div className="text-[10px] text-red-700 italic flex items-center gap-1 mt-1">
                              <AlertTriangle className="w-3 h-3" /> Aucune animation — obligatoire pour ce jour de présence
                            </div>
                          ) : (
                            <ul className="space-y-0.5">
                              {daySlots.map((s) => (
                                <li key={s.id} className="text-[10.5px] text-slate-700 flex items-center justify-between gap-1.5 py-0.5">
                                  <span className="truncate">
                                    <Badge className={`text-[9px] mr-1 ${s.location_type === 'zone_demo' ? 'bg-orange-100 text-orange-800 border-orange-300' : 'bg-blue-100 text-blue-800 border-blue-300'}`}>
                                      {s.location_type === 'zone_demo' ? 'Zone démo' : 'Sur stand'}
                                    </Badge>
                                    {s.start_time}–{s.end_time}
                                    {s.title && <span className="italic text-slate-500"> · {s.title}</span>}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      );
                    })}
                    {/* Panel animations admin (CRUD complet pour le site courant) */}
                    <details className="mt-1">
                      <summary className="text-[10px] text-slate-500 cursor-pointer hover:text-slate-700 font-semibold">⚙️ Gestion avancée des animations (CRUD)</summary>
                      <div className="mt-2">
                        <AdminAnimationsPanel
                          registrationId={reg.id}
                          venueId={reg.venue_id}
                          venueName={venue?.name}
                          attendingDays={days}
                          slots={slots}
                          isLocked={reg.is_locked || reg.candidature_locked}
                          onReload={load}
                        />
                      </div>
                    </details>
                  </div>
                )}

                {/* Stand picker / Swap (uniquement site courant) */}
                {isCurrent && (
                  <details className="mt-2 pt-2 border-t border-slate-200">
                    <summary className="text-[10px] text-slate-500 cursor-pointer hover:text-slate-700 font-semibold">⚙️ Changer / Libérer le stand</summary>
                    <div className="mt-2">
                      <AdminStandPicker
                        registrationId={reg.id}
                        venueId={reg.venue_id}
                        venueName={venue?.name}
                        currentStandCode={reg.stand_code}
                        isLocked={reg.is_locked || reg.candidature_locked || reg.status === 'confirme' || reg.status === 'verrouille' || reg.status === 'pre_validated'}
                        onReload={load}
                      />
                    </div>
                  </details>
                )}
              </div>
            );
          })}
        </div>

        {/* Multi-sites panel (ajout / suppression / priorité) */}
        <div className="mt-3 pt-3 border-t border-slate-200">
          <AdminMultiSitesPanel
            organizationId={org.id}
            currentRegId={reg.id}
            onReload={load}
            onSwitchSite={(newRegId) => openExposantPanel(newRegId)}
          />
        </div>

        {/* Annulation (zone dangereuse) */}
        <details className="mt-3 pt-3 border-t border-slate-200">
          <summary className="text-[10px] text-red-600 cursor-pointer hover:text-red-800 font-semibold">⚠️ Annuler cette réservation (libère le stand)</summary>
          <div className="mt-2">
            <CancelReservationPanel reg={reg} org={org} venue={venue} slots={slots} onCancelled={load} />
          </div>
        </details>
      </CollapsibleSection>

      {/* ═══════════════════ 5. ACCORDÉON CAUTION (closed) ═══════════════════ */}
      <CollapsibleSection icon={Wallet} title="Caution" defaultOpen={false}>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <div className="rounded-md border border-slate-200 bg-slate-50 p-2">
            <div className="text-[9px] text-slate-500 uppercase tracking-wider mb-0.5">Montant XPF</div>
            <div className="font-bold text-sm text-slate-900">
              {dep?.amount_xpf ? `${dep.amount_xpf.toLocaleString('fr')} XPF` : <span className="italic text-slate-400 font-normal">Non saisi</span>}
            </div>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-2">
            <div className="text-[9px] text-slate-500 uppercase tracking-wider mb-0.5">Mode encaissement</div>
            <div className="font-bold text-sm text-slate-900">
              {reg.caution_mode || dep?.payment_method || <span className="italic text-slate-400 font-normal">Chèque</span>}
            </div>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-2">
            <div className="text-[9px] text-slate-500 uppercase tracking-wider mb-0.5">Date encaissement</div>
            <div className="font-bold text-sm text-slate-900">
              {reg.caution_received_date ? fmtDate(reg.caution_received_date) : <span className="italic text-slate-400 font-normal">—</span>}
            </div>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-2">
            <div className="text-[9px] text-slate-500 uppercase tracking-wider mb-0.5">Statut restitution</div>
            <div className="font-bold text-sm text-slate-900 capitalize">
              {reg.restitution_status?.replace(/_/g, ' ') || <span className="italic text-slate-400 font-normal">À traiter</span>}
            </div>
          </div>
        </div>

        {/* Boutons d'action */}
        <div className="flex flex-wrap gap-1.5 mb-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const v = prompt('Montant de la caution (XPF) :', String(dep?.amount_xpf || reg.caution_amount_xpf || 20000));
              if (v && !isNaN(Number(v))) saveReg({ caution_amount_xpf: Number(v) });
            }}
            className="h-7 text-[10px] gap-1"
          >
            💰 Saisir montant
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const v = prompt('Date & heure RDV (YYYY-MM-DDTHH:MM) :', reg.caution_appointment_at || '');
              if (v) saveReg({ caution_appointment_at: v });
            }}
            className="h-7 text-[10px] gap-1"
          >
            📅 Fixer RDV
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              try {
                await api('/api/documents/generate', { method: 'POST', body: JSON.stringify({ registration_id: reg.id, doc_type: 'recu_caution' }) });
                toast.success('✅ Reçu généré');
                load();
              } catch (e) { toast.error(e.message); }
            }}
            disabled={!dep?.amount_xpf && !reg.caution_received_date}
            className="h-7 text-[10px] gap-1"
          >
            <Receipt className="w-3 h-3" /> Générer reçu
          </Button>
        </div>

        {/* Champs détaillés (edition inline) */}
        <details>
          <summary className="text-[10px] text-slate-500 cursor-pointer hover:text-slate-700 font-semibold">⚙️ Édition détaillée (RDV, restitution, motif…)</summary>
          <div className="mt-2 space-y-1">
            <EditableField label="Montant (XPF)" type="number" value={dep?.amount_xpf || reg.caution_amount_xpf} onSave={(v) => saveReg({ caution_amount_xpf: Number(v) })} />
            <EditableField label="Date encaissement" type="date" value={reg.caution_received_date} onSave={(v) => saveReg({ caution_received_date: v })} />
            <EditableField label="RDV caution" type="datetime-local" value={reg.caution_appointment_at} onSave={(v) => saveReg({ caution_appointment_at: v })} />
            <EditableField
              label="Statut restitution"
              type="select"
              options={[{ value: 'a_restituer', label: 'À restituer' }, { value: 'restituee', label: 'Restituée' }, { value: 'retenue_partielle', label: 'Retenue partielle' }, { value: 'retenue_totale', label: 'Retenue totale' }, { value: 'a_verifier', label: 'À vérifier' }]}
              value={reg.restitution_status}
              onSave={(v) => saveReg({ restitution_status: v })}
            />
            <EditableField label="Motif retenue" type="textarea" value={reg.restitution_motif} onSave={(v) => saveReg({ restitution_motif: v })} />
            <EditableField label="Date restit. prévue" type="date" value={reg.restitution_planned_date} onSave={(v) => saveReg({ restitution_planned_date: v })} />
            <EditableField label="Date restit. effective" type="date" value={reg.restitution_actual_date} onSave={(v) => saveReg({ restitution_actual_date: v })} />
          </div>
        </details>
      </CollapsibleSection>

      {/* ═══════════════════ 6. ACCORDÉON DOCUMENTS AUTO-GÉNÉRÉS (closed) ═══════════════════ */}
      <CollapsibleSection icon={FileBox} title="Documents auto-générés" defaultOpen={false}>
        <div className="space-y-1.5">
          <AutoDocCard
            icon={Receipt}
            iconBg="bg-amber-600"
            title="Reçu de caution"
            doc={recuCautionDoc}
            regId={reg.id}
            docType="recu_caution"
            onReload={load}
            disabled={!dep?.amount_xpf && !reg.caution_received_date}
            disabledReason="Caution non encaissée"
          />
          <AutoDocCard
            icon={RefreshCw}
            iconBg="bg-violet-600"
            title="Attestation de remboursement"
            doc={attestRemboursDoc}
            regId={reg.id}
            docType="attestation_remboursement"
            onReload={load}
            disabled={reg.restitution_status !== 'restituee'}
            disabledReason="Caution non restituée"
          />
          <AutoDocCard
            icon={FileBadge}
            iconBg="bg-emerald-600"
            title="Badge exposant"
            doc={badgeDoc}
            regId={reg.id}
            docType="badge_exposant"
            onReload={load}
          />
          <AutoDocCard
            icon={FileText}
            iconBg="bg-orange-600"
            title="Guide du participant"
            doc={guideDoc}
            regId={reg.id}
            docType="guide_participant"
            onReload={load}
          />
        </div>
      </CollapsibleSection>

      {/* ═══════════════════ 7. ACCORDÉON PORTAIL & ACCÈS (closed) ═══════════════════ */}
      <CollapsibleSection icon={ExternalLink} title="Portail & Accès" defaultOpen={false}>
        {/* URL magic link en monospace */}
        <div className="mb-2">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">URL d&apos;accès exposant</div>
          <div className="font-mono text-[10.5px] text-slate-700 bg-slate-50 border border-slate-200 rounded-md px-2 py-1.5 break-all">
            {magicLink?.url || magicLink?.link || <span className="italic text-slate-400">Lien non disponible — Régénérez le token</span>}
          </div>
        </div>

        {/* Boutons */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          <Button size="sm" variant="outline" onClick={copyMagicLink} disabled={!magicLink} className="h-7 text-[10px] gap-1">
            <Copy className="w-3 h-3" /> Copier
          </Button>
          <Button size="sm" variant="outline" onClick={openMagicLink} disabled={!magicLink} className="h-7 text-[10px] gap-1">
            <ExternalLink className="w-3 h-3" /> Ouvrir
          </Button>
          <Button size="sm" variant="outline" onClick={sendMagicLinkByMail} disabled={magicLinkBusy || !org.main_email} className="h-7 text-[10px] gap-1">
            {magicLinkBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Mail className="w-3 h-3" />} Envoyer par mail
          </Button>
          <Button size="sm" variant="outline" onClick={regenerateMagicLink} disabled={magicLinkBusy} className="h-7 text-[10px] gap-1 border-amber-300 text-amber-700 hover:bg-amber-50">
            {magicLinkBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />} Régénérer
          </Button>
        </div>

        {/* Grille : Dernier accès / Validité token */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-md border border-slate-200 bg-slate-50 p-2">
            <div className="text-[9px] text-slate-500 uppercase tracking-wider mb-0.5">Dernier accès</div>
            <div className="font-semibold text-xs text-slate-800">
              {reg.last_portal_access_at ? fmtLastAccess(reg.last_portal_access_at) : <span className="italic text-slate-400 font-normal">Jamais</span>}
            </div>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-2">
            <div className="text-[9px] text-slate-500 uppercase tracking-wider mb-0.5">Validité token</div>
            <div className="font-semibold text-xs text-slate-800">
              {magicLink?.expires_at ? fmtLastAccess(magicLink.expires_at)
                : reg.portal_token ? <span className="text-emerald-700">Actif</span>
                : <span className="italic text-slate-400 font-normal">—</span>}
            </div>
          </div>
        </div>
      </CollapsibleSection>

      {/* ═══════════════════ 8. ACCORDÉON BILAN JOUR J (closed) ═══════════════════ */}
      <CollapsibleSection icon={Activity} title="Bilan Jour J" defaultOpen={false}>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <div className="rounded-md border border-slate-200 bg-slate-50 p-2">
            <div className="text-[9px] text-slate-500 uppercase tracking-wider mb-0.5">Présence constatée</div>
            <div className="font-semibold text-xs text-slate-800 capitalize">
              {reg.bilan_presence?.replace(/_/g, ' ') || <span className="italic text-slate-400 font-normal">Non renseigné</span>}
            </div>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-2">
            <div className="text-[9px] text-slate-500 uppercase tracking-wider mb-0.5">Arrivée réelle</div>
            <div className="font-semibold text-xs text-slate-800">
              {reg.bilan_arrival_real || <span className="italic text-slate-400 font-normal">—</span>}
            </div>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-2">
            <div className="text-[9px] text-slate-500 uppercase tracking-wider mb-0.5">Animation réalisée</div>
            <div className="font-semibold text-xs text-slate-800 capitalize">
              {reg.bilan_animation_status?.replace(/_/g, ' ') || <span className="italic text-slate-400 font-normal">Non renseigné</span>}
            </div>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-2">
            <div className="text-[9px] text-slate-500 uppercase tracking-wider mb-0.5">Reco caution</div>
            <div className="font-semibold text-xs text-slate-800 capitalize">
              {reg.bilan_caution_reco?.replace(/_/g, ' ') || <span className="italic text-slate-400 font-normal">À évaluer</span>}
            </div>
          </div>
        </div>

        <details>
          <summary className="text-[10px] text-slate-500 cursor-pointer hover:text-slate-700 font-semibold">📝 Remplir / Modifier le bilan</summary>
          <div className="mt-2 space-y-1">
            <EditableField label="Présence" type="select" options={[{ value: 'present', label: 'Présent' }, { value: 'absent', label: 'Absent' }, { value: 'retard', label: 'Retard' }, { value: 'depart_anticipe', label: 'Départ anticipé' }]} value={reg.bilan_presence} onSave={(v) => saveReg({ bilan_presence: v })} />
            <EditableField label="Arrivée réelle" type="time" value={reg.bilan_arrival_real} onSave={(v) => saveReg({ bilan_arrival_real: v })} />
            <EditableField label="Départ réel" type="time" value={reg.bilan_departure_real} onSave={(v) => saveReg({ bilan_departure_real: v })} />
            <EditableField label="Animation réalisée" type="select" options={[{ value: 'oui_conforme', label: 'Oui — conforme' }, { value: 'oui_partielle', label: 'Oui — partielle' }, { value: 'non', label: 'Non' }]} value={reg.bilan_animation_status} onSave={(v) => saveReg({ bilan_animation_status: v })} />
            <EditableField label="État stand au départ" type="select" options={[{ value: 'bon_etat', label: 'Bon état' }, { value: 'degrade', label: 'Dégradé' }, { value: 'incident', label: 'Incident matériel' }]} value={reg.bilan_stand_status} onSave={(v) => saveReg({ bilan_stand_status: v })} />
            <EditableField label="Anomalie / Incident" type="textarea" value={reg.bilan_anomaly} onSave={(v) => saveReg({ bilan_anomaly: v })} />
            <EditableField label="Commentaire agent" type="textarea" value={reg.bilan_agent_comment} onSave={(v) => saveReg({ bilan_agent_comment: v })} />
            <EditableField label="Reco caution" type="select" options={[{ value: 'integrale', label: 'Restitution intégrale' }, { value: 'partielle', label: 'Retenue partielle' }, { value: 'totale', label: 'Retenue totale' }, { value: 'a_verifier', label: 'À vérifier' }]} value={reg.bilan_caution_reco} onSave={(v) => saveReg({ bilan_caution_reco: v })} />
          </div>
        </details>
      </CollapsibleSection>

      {/* ═══════════════════ 9. ZONE SUPPRESSION (toujours visible, tout en bas) ═══════════════════ */}
      <div className="rounded-xl border-2 border-red-300 bg-red-50/50 p-3.5 mt-6">
        <div className="font-bold text-sm text-red-900 mb-1 flex items-center gap-2">
          <Trash2 className="w-4 h-4" /> Zone de suppression
        </div>
        <div className="text-xs text-red-700 mb-3">
          Suppression définitive et irréversible de la base de données.
        </div>
        {!showDelete2Step ? (
          <Button size="sm" variant="outline" onClick={askDelete} className="bg-white border-red-400 text-red-700 hover:bg-red-100 h-8 text-xs gap-1.5">
            <Trash2 className="w-3 h-3" /> Supprimer cet exposant
          </Button>
        ) : (
          <div className="space-y-2">
            <div className="text-xs font-medium text-red-900">
              Pour confirmer, retapez le nom exact : <code className="bg-white px-1.5 py-0.5 rounded text-[11px]">{org.name}</code>
            </div>
            <Input
              value={deleteConfirmName}
              onChange={(e) => setDeleteConfirmName(e.target.value)}
              placeholder={`Tapez "${org.name}" pour confirmer`}
              className="h-8 text-xs bg-white"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={performDelete}
                disabled={deleteConfirmName.trim() !== org.name}
                className="bg-red-700 text-white hover:bg-red-800 h-8 text-xs gap-1.5 disabled:opacity-40"
              >
                <Trash2 className="w-3 h-3" /> Supprimer définitivement
              </Button>
              <Button size="sm" variant="ghost" onClick={cancelDelete} className="h-8 text-xs">
                Annuler
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ═══════════════════ DIALOGS ═══════════════════ */}
      {showDeleteDialog && (
        <DeleteOrgDialog
          org={org}
          onClose={() => setShowDeleteDialog(false)}
          onDeleted={() => { setShowDeleteDialog(false); onClose(); }}
        />
      )}
      {showMailDialog && (
        <SendExposantMailDialog
          registration={reg}
          organization={org}
          venue={venue}
          onClose={() => setShowMailDialog(false)}
        />
      )}
    </div>
  );

}

// =======================================================
// 🌐 AdminMultiSitesPanel — gestion multi-sites depuis l'admin
//   (réplique le portail exposant : liste, switch, add, remove, priorité)
// =======================================================
function AdminMultiSitesPanel({ organizationId, currentRegId, onReload, onSwitchSite }) {
  const [sites, setSites] = useState(null);
  const [venues, setVenues] = useState([]);
  const [busy, setBusy] = useState(false);
  const [busyAction, setBusyAction] = useState(null); // ex: `remove:${regId}` ou `prio:${regId}`
  const [showAdd, setShowAdd] = useState(false);
  const [addVenueId, setAddVenueId] = useState('');
  const [removeConfirmId, setRemoveConfirmId] = useState(null); // regId à supprimer (étape 2)

  const load = async () => {
    if (!organizationId) return;
    try {
      const [s, v] = await Promise.all([
        api(`/api/exposant/my-sites?organization_id=${encodeURIComponent(organizationId)}`).catch(() => []),
        api('/api/venues?only_active=1').catch(() => []),
      ]);
      setSites(Array.isArray(s) ? s : []);
      setVenues(Array.isArray(v) ? v : []);
    } catch { /* ignore */ }
  };
  useEffect(() => { load(); }, [organizationId]);

  if (!sites) return (
    <div className="py-3 text-center text-xs text-slate-400">
      <Loader2 className="w-4 h-4 inline animate-spin mr-1" /> Chargement des sites…
    </div>
  );

  const usedVenueIds = new Set(sites.map((s) => s.venue_id));
  const maxSites = 3;
  const canAddMore = sites.length < maxSites;
  const availableVenues = venues.filter((v) =>
    !usedVenueIds.has(v.id)
    && v.is_available_2026 !== false
    && v.exposant_visible !== false
  );

  const addSite = async () => {
    if (!addVenueId) return toast.error('Choisissez un site');
    setBusy(true);
    try {
      const res = await api('/api/exposant/sites/add', {
        method: 'POST',
        body: JSON.stringify({ organization_id: organizationId, venue_id: addVenueId }),
      });
      toast.success('🎉 Nouveau site ajouté');
      setShowAdd(false);
      setAddVenueId('');
      await load();
      onReload?.();
      // Basculer sur le nouveau site pour permettre de le compléter
      const newRegId = res?.registration?.id;
      if (newRegId) onSwitchSite?.(newRegId);
    } catch (e) { toast.error(e.message); }
    setBusy(false);
  };

  const removeSite = async (regId) => {
    setBusyAction(`remove:${regId}`);
    try {
      await api(`/api/exposant/sites/${regId}/remove`, { method: 'POST', body: '{}' });
      toast.success('Site retiré de l\'inscription');
      setRemoveConfirmId(null);
      await load();
      onReload?.();
      // Si on a retiré le site courant, basculer sur un autre
      if (regId === currentRegId) {
        const remaining = sites.find((s) => s.id !== regId);
        if (remaining) onSwitchSite?.(remaining.id);
      }
    } catch (e) { toast.error(e.message); }
    setBusyAction(null);
  };

  const setPriority = async (regId, priority) => {
    setBusyAction(`prio:${regId}`);
    try {
      await api(`/api/exposant/sites/${regId}/priority`, {
        method: 'POST',
        body: JSON.stringify({ priority }),
      });
      toast.success(priority === 1 ? '★ Site prioritaire défini' : 'Priorité retirée');
      await load();
      onReload?.();
    } catch (e) { toast.error(e.message); }
    setBusyAction(null);
  };

  return (
    <div className="rounded-lg border-2 border-blue-200 bg-blue-50/40 p-3 mb-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-bold text-blue-900 uppercase tracking-wide flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5" />
          Sites de cet exposant
          <Badge variant="secondary" className="text-[10px] ml-1">{sites.length}/{maxSites}</Badge>
        </div>
      </div>

      <div className="space-y-1.5">
        {sites.map((s) => {
          const isCurrent = s.id === currentRegId;
          const isLocked = s.is_locked || s.is_deposit_received;
          const isStar = s.is_user_priority === true;
          const canRemove = sites.length > 1 && !isLocked;
          const statusColor = {
            confirme: 'bg-emerald-100 text-emerald-800 border-emerald-300',
            a_confirmer: 'bg-amber-100 text-amber-800 border-amber-300',
            a_relancer: 'bg-orange-100 text-orange-800 border-orange-300',
            prospect: 'bg-slate-100 text-slate-700 border-slate-300',
            verrouille: 'bg-violet-100 text-violet-800 border-violet-300',
          }[s.status] || 'bg-slate-100 text-slate-700 border-slate-300';

          return (
            <div
              key={s.id}
              className={`rounded-md border bg-white p-2 flex items-center gap-2 flex-wrap ${
                isCurrent ? 'border-blue-500 ring-1 ring-blue-300' : 'border-slate-200'
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {isStar && <span title="Site prioritaire désigné par l'exposant" className="text-amber-500">★</span>}
                  <span className="font-semibold text-sm text-slate-900 truncate">📍 {s.venue?.name || '—'}</span>
                  {s.stand_code && (
                    <Badge variant="outline" className="text-[10px] font-mono">{s.stand_code}</Badge>
                  )}
                  <Badge className={`text-[10px] ${statusColor}`} variant="outline">{s.status}</Badge>
                  {isLocked && <Badge className="text-[10px] bg-violet-100 text-violet-800 border-violet-300" variant="outline">🔒 verrouillé</Badge>}
                  {isCurrent && <Badge className="text-[10px] bg-blue-600 text-white">vue actuelle</Badge>}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  {s.is_complete ? '✅ complet' : '⏳ incomplet'} · {s.animations_count || 0} animation{(s.animations_count || 0) > 1 ? 's' : ''}
                  {s.deposit?.status && ` · caution: ${s.deposit.status}`}
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                {!isCurrent && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[11px] px-2"
                    onClick={() => onSwitchSite?.(s.id)}
                  >
                    Ouvrir
                  </Button>
                )}
                <Button
                  size="sm"
                  variant={isStar ? 'default' : 'outline'}
                  className={`h-7 text-[11px] px-2 ${isStar ? 'bg-amber-500 hover:bg-amber-600 text-white' : 'border-amber-300 text-amber-700 hover:bg-amber-50'}`}
                  disabled={busyAction === `prio:${s.id}`}
                  onClick={() => setPriority(s.id, isStar ? 0 : 1)}
                  title={isStar ? 'Retirer la priorité' : 'Définir comme site prioritaire'}
                >
                  {busyAction === `prio:${s.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : '★'}
                </Button>
                {canRemove && removeConfirmId !== s.id && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[11px] px-2 border-red-300 text-red-700 hover:bg-red-50"
                    onClick={() => setRemoveConfirmId(s.id)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                )}
                {canRemove && removeConfirmId === s.id && (
                  <>
                    <Button
                      size="sm"
                      className="h-7 text-[11px] px-2 bg-red-600 hover:bg-red-700 text-white"
                      disabled={busyAction === `remove:${s.id}`}
                      onClick={() => removeSite(s.id)}
                    >
                      {busyAction === `remove:${s.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Confirmer'}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-[11px] px-2"
                      onClick={() => setRemoveConfirmId(null)}
                    >
                      Annuler
                    </Button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Ajouter un site */}
      {canAddMore && !showAdd && (
        <Button
          variant="outline"
          size="sm"
          className="w-full mt-2 border-dashed border-2 border-blue-300 text-blue-700 hover:bg-blue-100 gap-2 h-8 text-xs"
          onClick={() => setShowAdd(true)}
        >
          <Plus className="w-3.5 h-3.5" /> Ajouter un autre site ({sites.length}/{maxSites})
        </Button>
      )}
      {showAdd && (
        <div className="mt-2 rounded-md border-2 border-blue-400 bg-white p-2 space-y-2">
          <div className="text-xs font-semibold text-blue-900">Choisir un site à ajouter :</div>
          <select
            value={addVenueId}
            onChange={(e) => setAddVenueId(e.target.value)}
            className="w-full h-8 text-xs rounded-md border border-input bg-white px-2"
          >
            <option value="">Sélectionner un site disponible…</option>
            {availableVenues.length === 0 ? (
              <option value="" disabled>Aucun site disponible</option>
            ) : availableVenues.map((v) => (
              <option key={v.id} value={v.id}>📍 {v.name} ({v.capacity_stands} stands)</option>
            ))}
          </select>
          <p className="text-[10px] text-slate-600 leading-snug">
            💡 Une nouvelle inscription sera créée (statut « à confirmer »). Une caution séparée de 20 000 XPF sera demandée pour ce site.
          </p>
          <div className="flex gap-1 justify-end">
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setShowAdd(false); setAddVenueId(''); }} disabled={busy}>Annuler</Button>
            <Button
              size="sm"
              className="h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white gap-1"
              onClick={addSite}
              disabled={busy || !addVenueId}
            >
              {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
              Ajouter
            </Button>
          </div>
        </div>
      )}
      {!canAddMore && (
        <div className="mt-2 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-2 py-1.5">
          🚫 Limite atteinte ({maxSites} sites maximum par exposant).
        </div>
      )}
    </div>
  );
}



// =======================================================
// 🎭 AdminAnimationsPanel — CRUD animations depuis l'admin
//   (réplique le portail exposant : liste + ajout + suppression)
// =======================================================
// 🆕 SESSION 45 — Panneau "Zone Dangereuse" pour annuler une réservation (avec cascade et email)
function CancelReservationPanel({ reg, org, venue, slots, onCancelled }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirmTxt, setConfirmTxt] = useState('');
  const isAlreadyCancelled = reg.status === 'annule' || reg.status === 'cancelled';
  const hasBookings = !!reg.venue_id || !!reg.stand_code || (Array.isArray(reg.attending_days) && reg.attending_days.length > 0) || (slots && slots.length > 0);
  const expectedConfirm = (org?.name || 'CONFIRMER').toUpperCase().slice(0, 20);

  const doCancel = async () => {
    if (confirmTxt.trim().toUpperCase() !== expectedConfirm) {
      toast.error(`Tapez exactement « ${expectedConfirm} » pour confirmer`);
      return;
    }
    setBusy(true);
    try {
      const r = await fetch(`/api/admin/registrations/${reg.id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-role': 'aracom_admin' },
        body: JSON.stringify({ reason: reason.trim() || null, notify }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || 'Échec annulation');
      toast.success(
        `🗑️ Réservation annulée — ${data.cascade?.freed_stand ? `stand ${data.cascade.freed_stand} libéré, ` : ''}${data.cascade?.deleted_animations || 0} animation(s) supprimée(s)${data.mail_sent ? ' · ✉ mail envoyé' : ''}`
      );
      setOpen(false);
      setConfirmTxt('');
      setReason('');
      onCancelled && onCancelled();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (isAlreadyCancelled) {
    return (
      <div className="rounded-xl border-2 border-slate-300 bg-slate-50 p-3">
        <div className="text-xs font-semibold text-slate-600">⛔ Réservation déjà annulée</div>
        {reg.cancel_reason && <div className="text-[11px] text-slate-500 mt-1">Motif : {reg.cancel_reason}</div>}
        {reg.cancelled_at && <div className="text-[10px] text-slate-400 mt-0.5">Annulée le {new Date(reg.cancelled_at).toLocaleString('fr-FR')}</div>}
      </div>
    );
  }

  return (
    <div className="rounded-xl border-2 border-red-300 bg-red-50/40 p-3 space-y-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-red-700"
      >
        <span className="flex items-center gap-2">⚠️ Zone dangereuse — Annuler la réservation</span>
        <span>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="space-y-2 bg-white rounded-md p-3 border border-red-200">
          <div className="text-[11px] text-slate-700 leading-snug">
            Cette action va <b>annuler complètement</b> la réservation de <b>{org?.name || '—'}</b>.
            La cascade suivante sera appliquée automatiquement :
          </div>
          <ul className="text-[11px] text-red-700 list-disc list-inside space-y-0.5 bg-red-50 p-2 rounded">
            {reg.stand_code && <li>Stand <b>{reg.stand_code}</b> ({venue?.name || ''}) → <b>libéré</b></li>}
            {Array.isArray(reg.attending_days) && reg.attending_days.length > 0 && <li>Jours de présence ({reg.attending_days.join(' + ')}) → <b>effacés</b></li>}
            {slots && slots.length > 0 && <li><b>{slots.length}</b> créneau(x) d&apos;animation → <b>supprimé(s)</b></li>}
            <li>Site sélectionné → <b>retiré</b></li>
            <li>Statut → <b>annulé</b></li>
          </ul>

          <div>
            <label className="block text-[10px] uppercase text-slate-500 font-semibold mb-0.5">Motif (optionnel, inclus dans l&apos;email)</label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="ex : Désistement de l'exposant, doublon, paiement non reçu…"
              rows={2}
              className="text-xs"
            />
          </div>

          <label className="flex items-center gap-2 text-[11px] text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={notify}
              onChange={(e) => setNotify(e.target.checked)}
              className="rounded"
            />
            <span>✉ Envoyer l&apos;email d&apos;annulation à <b>{org?.main_email || '(pas d\'email)'}</b></span>
          </label>

          <div>
            <label className="block text-[10px] uppercase text-slate-500 font-semibold mb-0.5">
              Pour confirmer, tapez : <code className="bg-slate-100 px-1.5 py-0.5 rounded text-red-700">{expectedConfirm}</code>
            </label>
            <Input
              value={confirmTxt}
              onChange={(e) => setConfirmTxt(e.target.value)}
              placeholder={expectedConfirm}
              className="h-8 text-xs font-mono"
            />
          </div>

          <div className="flex gap-2 justify-end pt-1">
            <Button size="sm" variant="ghost" className="h-8 text-xs" disabled={busy} onClick={() => { setOpen(false); setConfirmTxt(''); setReason(''); }}>
              Annuler
            </Button>
            <Button
              size="sm"
              className="h-8 text-xs bg-red-600 hover:bg-red-700 text-white"
              disabled={busy || !hasBookings || confirmTxt.trim().toUpperCase() !== expectedConfirm}
              onClick={doCancel}
            >
              {busy ? '…' : '🗑️ Confirmer l\'annulation'}
            </Button>
          </div>
          {!hasBookings && (
            <div className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded p-1.5">
              ℹ️ Aucun élément à annuler (pas de site, pas de stand, pas d&apos;animation).
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AdminAnimationsPanel({ registrationId, venueId, venueName, attendingDays, slots, isLocked, onReload }) {
  const [allSlotsVenue, setAllSlotsVenue] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [busyDelete, setBusyDelete] = useState(null);
  const [editingId, setEditingId] = useState(null); // id de l'animation en cours d'édition
  const [editDraft, setEditDraft] = useState({});
  const [allVenuesList, setAllVenuesList] = useState([]);
  // 🆕 SESSION 44 — Récupérer le nom de l'organisation pour affichage
  const [orgInfo, setOrgInfo] = useState({ name: null, discipline: null, description: null, contact_name: null });
  // 🆕 SESSION 53.16 — Édition inline des attending_days + bulk clear + custom time + swap
  const [savingDays, setSavingDays] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(null); // 'vendredi' | 'samedi' | 'all'
  const [swapSourceSlot, setSwapSourceSlot] = useState(null); // slot dont on veut échanger l'horaire
  const [swapCandidates, setSwapCandidates] = useState([]); // autres animations sur le même site
  const [swapBusy, setSwapBusy] = useState(false);
  const [form, setForm] = useState({
    day: 'vendredi',
    location_type: 'sur_stand',
    slot_index: 0,
    title: '',
    description: '',
    material_needs: '',
    target_audience: '',
    // 🆕 SESSION 53.16 — Mode "horaire libre"
    use_custom_time: false,
    custom_start: '',
    custom_end: '',
  });

  // 🆕 SESSION 53.16 — Toggle attending_days (Ven only / Sam only / Ven+Sam)
  const setAttendingDays = async (newDays) => {
    setSavingDays(true);
    try {
      await api(`/api/registrations/${registrationId}`, {
        method: 'PUT',
        body: JSON.stringify({ attending_days: newDays }),
      });
      toast.success('📅 Jours prévus mis à jour');
      onReload?.();
    } catch (e) { toast.error(e?.message || 'Erreur'); }
    setSavingDays(false);
  };

  // 🆕 SESSION 53.16 — Effacer toutes les animations d'un jour (ou des 2)
  const bulkClearAnimations = async (day) => {
    const targetSlots = (slots || []).filter((s) => day === 'all' ? true : s.day_label === day);
    if (targetSlots.length === 0) { toast.info('Aucune animation à effacer'); return; }
    const msg = day === 'all'
      ? `Supprimer TOUTES les animations (${targetSlots.length}) de cet exposant ?`
      : `Supprimer les ${targetSlots.length} animation(s) du ${day === 'vendredi' ? 'vendredi' : 'samedi'} ?`;
    if (!confirm(msg)) return;
    setBulkBusy(day);
    try {
      await Promise.all(targetSlots.map((s) => api(`/api/animation-slots/${s.id}`, { method: 'DELETE' })));
      toast.success(`✅ ${targetSlots.length} animation(s) supprimée(s)`);
      await loadAllVenueSlots();
      onReload?.();
    } catch (e) { toast.error(e?.message || 'Erreur'); }
    setBulkBusy(null);
  };

  // 🆕 SESSION 53.16 — Ouvre le dialogue d'échange : liste tous les autres slots du même site
  const openSwapDialog = async (sourceSlot) => {
    setSwapSourceSlot(sourceSlot);
    try {
      // Charge TOUS les slots du même venue, exclut ceux de cet exposant
      const data = await api(`/api/animation-slots?venue_id=${sourceSlot.venue_id}`);
      const all = Array.isArray(data) ? data : [];
      // Hydrate avec org name via registrations
      const otherRegIds = [...new Set(all.filter((s) => s.registration_id && s.registration_id !== registrationId).map((s) => s.registration_id))];
      const orgsMap = {};
      if (otherRegIds.length > 0) {
        try {
          const regs = await api('/api/registrations');
          for (const r of (regs || [])) {
            if (otherRegIds.includes(r.id)) orgsMap[r.id] = r.organization?.name || r.organization_name || '—';
          }
        } catch { /* ignore */ }
      }
      const candidates = all
        .filter((s) => s.registration_id !== registrationId)
        .map((s) => ({ ...s, _org_name: orgsMap[s.registration_id] || '—' }));
      setSwapCandidates(candidates);
    } catch (e) { toast.error(e?.message); setSwapSourceSlot(null); }
  };

  // 🆕 SESSION 53.16 — Effectue l'échange de propriétaires entre 2 slots
  //   Cas 1 (échange complet) : on inverse les registration_id (chaque slot change de propriétaire,
  //   mais garde son créneau horaire et son emplacement).
  const confirmSwap = async (targetSlot) => {
    if (!swapSourceSlot || !targetSlot) return;
    if (!confirm(`Échanger : "${swapSourceSlot.title || swapSourceSlot.start_time}" ↔ "${targetSlot.title || targetSlot.start_time}" (${targetSlot._org_name}) ?\n\nChaque créneau changera de propriétaire mais gardera son horaire et son emplacement.`)) return;
    setSwapBusy(true);
    try {
      const srcRegId = swapSourceSlot.registration_id;
      const tgtRegId = targetSlot.registration_id;
      await api(`/api/animation-slots/${swapSourceSlot.id}`, {
        method: 'PUT',
        body: JSON.stringify({ registration_id: tgtRegId }),
      });
      await api(`/api/animation-slots/${targetSlot.id}`, {
        method: 'PUT',
        body: JSON.stringify({ registration_id: srcRegId }),
      });
      toast.success('🔄 Créneaux échangés');
      setSwapSourceSlot(null); setSwapCandidates([]);
      await loadAllVenueSlots();
      onReload?.();
    } catch (e) { toast.error(e?.message); }
    setSwapBusy(false);
  };

  const EVENT_DATES_LOCAL = [
    { label: 'vendredi', date: '2026-08-14', display: 'Vendredi 14 août' },
    { label: 'samedi', date: '2026-08-15', display: 'Samedi 15 août' },
  ];
  // 🆕 SESSION 48b — Créneaux NORMALISÉS par lieu d'animation :
  //   • Sur stand (zone exposant) = 30 min  (auparavant 60 min)
  //   • Zone démo                  = 45 min (auparavant 30 min)
  // Plage : vendredi 11h–17h, samedi 9h–17h (pause déjeuner 12h–13h pour zone démo)
  const STAND_SLOTS_FRIDAY = [
    { start: '11:00', end: '11:30' }, { start: '11:30', end: '12:00' },
    { start: '12:00', end: '12:30' }, { start: '12:30', end: '13:00' },
    { start: '13:00', end: '13:30' }, { start: '13:30', end: '14:00' },
    { start: '14:00', end: '14:30' }, { start: '14:30', end: '15:00' },
    { start: '15:00', end: '15:30' }, { start: '15:30', end: '16:00' },
    { start: '16:00', end: '16:30' }, { start: '16:30', end: '17:00' },
  ];
  const STAND_SLOTS_SATURDAY = [
    { start: '09:00', end: '09:30' }, { start: '09:30', end: '10:00' },
    { start: '10:00', end: '10:30' }, { start: '10:30', end: '11:00' },
    ...STAND_SLOTS_FRIDAY,
  ];
  const DEMO_SLOTS = [
    // Matin (avant pause déjeuner) — utilisable surtout le samedi
    { start: '09:00', end: '09:45' },
    { start: '09:45', end: '10:30' },
    { start: '10:30', end: '11:15' },
    { start: '11:15', end: '12:00' },
    // Après-midi
    { start: '13:00', end: '13:45' },
    { start: '13:45', end: '14:30' },
    { start: '14:30', end: '15:15' },
    { start: '15:15', end: '16:00' },
    { start: '16:00', end: '16:45' },
  ];

  const slotChoicesForCurrent = () => {
    if (form.location_type === 'zone_demo') return DEMO_SLOTS;
    return form.day === 'vendredi' ? STAND_SLOTS_FRIDAY : STAND_SLOTS_SATURDAY;
  };

  const loadAllVenueSlots = async () => {
    if (!venueId) { setAllSlotsVenue([]); return; }
    try {
      const data = await api(`/api/animation-slots?venue_id=${venueId}`);
      setAllSlotsVenue(Array.isArray(data) ? data : []);
    } catch { /* ignore */ }
  };
  const loadAllVenues = async () => {
    try {
      const v = await api('/api/venues?only_active=1');
      setAllVenuesList(Array.isArray(v) ? v.filter((x) => x.is_available_2026 !== false) : []);
    } catch { /* ignore */ }
  };
  useEffect(() => { loadAllVenueSlots(); loadAllVenues(); }, [venueId, slots.length]);
  // 🆕 SESSION 44 — Charger les infos de l'association (nom, discipline, description)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const reg = await api(`/api/registrations/${registrationId}`);
        const r = reg?.registration || reg;
        if (!r?.organization_id) return;
        const orgs = await api('/api/organizations');
        const o = (Array.isArray(orgs) ? orgs : []).find(x => x.id === r.organization_id);
        if (!cancelled && o) {
          setOrgInfo({
            name: o.name || null,
            discipline: o.discipline || null,
            description: o.stand_description || o.description || null,
            contact_name: o.contact_name || null,
          });
        }
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [registrationId]);

  const normalizeLoc = (v) => (v === 'zone_demo' || v === 'zone_animation' || v === 'scene') ? 'zone_demo' : 'sur_stand';

  const isDemoSlotTaken = (day, start, end) => {
    return allSlotsVenue.some(s =>
      s.day_label === day
      && normalizeLoc(s.location_type) === 'zone_demo'
      && s.start_time === start
      && s.end_time === end
      && s.registration_id !== registrationId
    );
  };

  const addAnim = async () => {
    if (!venueId) return toast.error('Aucun site défini sur cette inscription');
    // 🆕 SESSION 53.16 — Titre optionnel : si vide, placeholder "Créneau réservé"
    const effectiveTitle = form.title.trim() || 'Créneau réservé';

    // 🆕 SESSION 53.16 — Mode horaire libre
    let startT, endT, duration;
    if (form.use_custom_time) {
      if (!/^\d{2}:\d{2}$/.test(form.custom_start) || !/^\d{2}:\d{2}$/.test(form.custom_end)) {
        return toast.error('Format horaire attendu HH:MM');
      }
      if (form.custom_start >= form.custom_end) {
        return toast.error('Heure de fin doit être après le début');
      }
      // Bornes minimums
      const dayBounds = form.day === 'vendredi' ? { open: '11:00', close: '17:00' } : { open: '09:00', close: '17:00' };
      if (form.custom_start < dayBounds.open) return toast.error(`Le ${form.day} commence à ${dayBounds.open}`);
      if (form.custom_end > dayBounds.close) return toast.error(`Le ${form.day} se termine à ${dayBounds.close}`);
      startT = form.custom_start;
      endT = form.custom_end;
      const [sh, sm] = startT.split(':').map(Number);
      const [eh, em] = endT.split(':').map(Number);
      duration = (eh * 60 + em) - (sh * 60 + sm);
    } else {
      const choices = slotChoicesForCurrent();
      const slot = choices[form.slot_index];
      if (!slot) return toast.error('Créneau invalide');
      startT = slot.start;
      endT = slot.end;
      duration = form.location_type === 'zone_demo' ? 45 : 30;
    }
    if (form.location_type === 'zone_demo' && isDemoSlotTaken(form.day, startT, endT)) {
      return toast.error('Ce créneau de zone démo est déjà pris par un autre exposant');
    }
    setBusy(true);
    try {
      const event_date = form.day === 'vendredi' ? '2026-08-14' : '2026-08-15';
      await api('/api/animation-slots', {
        method: 'POST',
        body: JSON.stringify({
          registration_id: registrationId,
          venue_id: venueId,
          day_label: form.day,
          event_date,
          start_time: startT,
          end_time: endT,
          duration_minutes: duration,
          title: effectiveTitle,
          description: form.description || null,
          material_needs: form.material_needs || null,
          target_audience: form.target_audience || null,
          slot_type: form.location_type,
          location_type: form.location_type,
        }),
      });
      toast.success(`✨ Animation ${startT}–${endT} créée`);
      setShowForm(false);
      setForm({ day: 'vendredi', location_type: 'sur_stand', slot_index: 0, title: '', description: '', material_needs: '', target_audience: '', use_custom_time: false, custom_start: '', custom_end: '' });
      await loadAllVenueSlots();
      onReload?.();
    } catch (e) { toast.error(e.message); }
    setBusy(false);
  };

  const deleteAnim = async (slotId) => {
    setBusyDelete(slotId);
    try {
      await api(`/api/animation-slots/${slotId}`, { method: 'DELETE' });
      toast.success('Animation supprimée');
      await loadAllVenueSlots();
      onReload?.();
    } catch (e) { toast.error(e.message); }
    setBusyDelete(null);
  };

  // 🆕 Édition d'une animation existante (créneau, zone, jour, site, titre, descriptif)
  const startEdit = (s) => {
    const loc = normalizeLoc(s.location_type);
    const choices = loc === 'zone_demo' ? DEMO_SLOTS : (s.day_label === 'vendredi' ? STAND_SLOTS_FRIDAY : STAND_SLOTS_SATURDAY);
    const idx = choices.findIndex((c) => c.start === s.start_time && c.end === s.end_time);
    setEditDraft({
      day: s.day_label,
      location_type: loc,
      slot_index: idx >= 0 ? idx : 0,
      venue_id: s.venue_id || venueId,
      title: s.title || '',
      description: s.description || '',
      material_needs: s.material_needs || '',
      target_audience: s.target_audience || '',
    });
    setEditingId(s.id);
  };
  const editSlotChoices = () => {
    if (editDraft.location_type === 'zone_demo') return DEMO_SLOTS;
    return editDraft.day === 'vendredi' ? STAND_SLOTS_FRIDAY : STAND_SLOTS_SATURDAY;
  };
  const saveEdit = async () => {
    const choices = editSlotChoices();
    const slot = choices[editDraft.slot_index];
    if (!slot) return toast.error('Créneau invalide');
    if (!editDraft.title?.trim()) return toast.error('Titre requis');
    if (editDraft.location_type === 'zone_demo') {
      // Vérif conflit avec d'autres exposants (sauf moi-même)
      const conflict = allSlotsVenue.some((s) =>
        s.id !== editingId
        && s.day_label === editDraft.day
        && normalizeLoc(s.location_type) === 'zone_demo'
        && s.start_time === slot.start
        && s.end_time === slot.end
        && s.venue_id === editDraft.venue_id
      );
      if (conflict) return toast.error('Ce créneau de zone démo est déjà pris par un autre exposant sur ce site');
    }
    setBusy(true);
    try {
      const event_date = editDraft.day === 'vendredi' ? '2026-08-14' : '2026-08-15';
      await api(`/api/animation-slots/${editingId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          day_label: editDraft.day,
          event_date,
          start_time: slot.start,
          end_time: slot.end,
          duration_minutes: editDraft.location_type === 'zone_demo' ? 45 : 30,
          title: editDraft.title,
          description: editDraft.description || null,
          material_needs: editDraft.material_needs || null,
          target_audience: editDraft.target_audience || null,
          slot_type: editDraft.location_type,
          location_type: editDraft.location_type,
          venue_id: editDraft.venue_id,
        }),
      });
      toast.success('✨ Animation modifiée');
      setEditingId(null);
      setEditDraft({});
      await loadAllVenueSlots();
      onReload?.();
    } catch (e) { toast.error(e.message); }
    setBusy(false);
  };

  if (!venueId) {
    return (
      <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900">
        ⚠️ Aucun site défini sur cette inscription. Définissez d&apos;abord un site dans la section <b>Stand &amp; Site</b>.
      </div>
    );
  }

  const slotsByDay = {
    vendredi: slots.filter(s => s.day_label === 'vendredi'),
    samedi: slots.filter(s => s.day_label === 'samedi'),
  };

  return (
    <div className="space-y-2">
      {/* 🆕 SESSION 44 — En-tête association (nom + discipline + description) */}
      {(orgInfo.name || orgInfo.discipline || orgInfo.description) && (
        <div className="rounded-md bg-violet-50 border-2 border-violet-200 p-3">
          <div className="flex items-start gap-2">
            <span className="text-lg shrink-0">🎭</span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-violet-900">{orgInfo.name || '—'}</div>
              {orgInfo.discipline && <div className="text-[11px] text-violet-700 mt-0.5">📂 {orgInfo.discipline}{orgInfo.contact_name ? ` · 👤 ${orgInfo.contact_name}` : ''}</div>}
              {orgInfo.description && (
                <div className="text-[11px] text-slate-700 mt-1.5 whitespace-pre-wrap break-words border-l-2 border-violet-300 pl-2 italic">
                  {orgInfo.description}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="text-[11px] text-slate-600 bg-slate-50 border border-slate-200 rounded-md p-2 leading-relaxed">
        📍 Site : <b>{venueName || '—'}</b>
        {/* 🆕 SESSION 53.16 — Édition inline des Jours prévus (3 toggles) */}
        <span className="ml-2 inline-flex items-center gap-1">
          · Jours prévus :
          {[
            { val: ['vendredi'], label: 'Ven seul' },
            { val: ['samedi'], label: 'Sam seul' },
            { val: ['vendredi', 'samedi'], label: 'Ven + Sam' },
          ].map((opt) => {
            const isActive = JSON.stringify([...(attendingDays || [])].sort()) === JSON.stringify([...opt.val].sort());
            return (
              <button
                key={opt.label}
                type="button"
                disabled={savingDays || isLocked}
                onClick={() => setAttendingDays(opt.val)}
                className={`px-1.5 py-0.5 rounded text-[10px] border ${isActive ? 'bg-violet-600 text-white border-violet-700' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'} disabled:opacity-50`}
                title={`Configurer comme : ${opt.label}`}
              >
                {opt.label}
              </button>
            );
          })}
          {savingDays && <Loader2 className="w-3 h-3 animate-spin text-violet-600" />}
        </span>
        <br />
        🟦 <b>Sur stand</b> = 30 min sur votre stand · 🟧 <b>Zone démo</b> = 45 min partagé (1 seul exposant à la fois)
        {isLocked && <div className="mt-1 text-amber-700 font-semibold">🔒 Inscription verrouillée — modifications restreintes</div>}
        {/* 🆕 SESSION 53.16 — Bulk clear all animations */}
        {!isLocked && (slots || []).length > 0 && (
          <div className="mt-1.5 flex items-center gap-2 text-[10px]">
            <button
              type="button"
              disabled={bulkBusy === 'all'}
              onClick={() => bulkClearAnimations('all')}
              className="text-rose-700 hover:text-rose-900 underline decoration-dotted disabled:opacity-50"
              title="Effacer TOUTES les animations de cet exposant"
            >
              {bulkBusy === 'all' ? '⏳ Suppression…' : '🗑️ Effacer toutes les animations'}
            </button>
          </div>
        )}
      </div>

      {EVENT_DATES_LOCAL.map((d) => {
        const list = slotsByDay[d.label];
        return (
          <div key={d.label} className="rounded-md border border-slate-200 bg-white p-2">
            <div className="text-xs font-bold text-slate-700 mb-1 flex items-center justify-between gap-2">
              <span>📅 {d.display}</span>
              <div className="flex items-center gap-1.5">
                <Badge variant="outline" className="text-[10px]">{list.length} animation{list.length > 1 ? 's' : ''}</Badge>
                {/* 🆕 SESSION 53.16 — Effacer toutes les animations de CE jour */}
                {!isLocked && list.length > 0 && (
                  <button
                    type="button"
                    disabled={bulkBusy === d.label}
                    onClick={() => bulkClearAnimations(d.label)}
                    className="text-[10px] px-1.5 py-0.5 rounded border border-rose-300 text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                    title={`Effacer les ${list.length} animation(s) du ${d.display.toLowerCase()}`}
                  >
                    {bulkBusy === d.label ? '⏳' : '🗑️ Tout effacer'}
                  </button>
                )}
              </div>
            </div>
            {list.length === 0 ? (
              <div className="text-[11px] italic text-slate-400 py-1">
                Aucune animation ce jour
                {!isLocked && <span className="ml-1 text-slate-500 not-italic">— cliquez sur <b>« + Ajouter une animation »</b> ci-dessous pour en créer une (puis ✏️ Modifier / ↔ Échanger / 🗑️ Supprimer apparaîtront ici).</span>}
              </div>
            ) : (
              <div className="space-y-1">
                {list.map((s) => editingId === s.id ? (
                  <div key={s.id} className="rounded border-2 border-violet-400 bg-violet-50/40 p-2 space-y-1.5 text-xs">
                    <div className="text-[10px] font-bold uppercase text-violet-900">✏️ Modifier l&apos;animation</div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <div>
                        <label className="block text-[9px] uppercase text-slate-500 font-semibold mb-0.5">Jour</label>
                        <select
                          value={editDraft.day}
                          onChange={(e) => setEditDraft((f) => ({ ...f, day: e.target.value, slot_index: 0 }))}
                          className="w-full h-7 text-[11px] rounded-md border border-input bg-white px-1.5"
                        >
                          <option value="vendredi">Vendredi 14 août</option>
                          <option value="samedi">Samedi 15 août</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[9px] uppercase text-slate-500 font-semibold mb-0.5">Zone</label>
                        <select
                          value={editDraft.location_type}
                          onChange={(e) => setEditDraft((f) => ({ ...f, location_type: e.target.value, slot_index: 0 }))}
                          className="w-full h-7 text-[11px] rounded-md border border-input bg-white px-1.5"
                        >
                          <option value="sur_stand">🟦 Sur stand (30 min)</option>
                          <option value="zone_demo">🟧 Zone démo (45 min)</option>
                        </select>
                      </div>
                      <div className="col-span-2">
                        <label className="block text-[9px] uppercase text-slate-500 font-semibold mb-0.5">Créneau horaire</label>
                        <select
                          value={String(editDraft.slot_index)}
                          onChange={(e) => setEditDraft((f) => ({ ...f, slot_index: Number(e.target.value) }))}
                          className="w-full h-7 text-[11px] rounded-md border border-input bg-white px-1.5"
                        >
                          {editSlotChoices().map((c, i) => {
                            const taken = editDraft.location_type === 'zone_demo' && allSlotsVenue.some((x) =>
                              x.id !== editingId
                              && x.day_label === editDraft.day
                              && normalizeLoc(x.location_type) === 'zone_demo'
                              && x.start_time === c.start && x.end_time === c.end
                              && x.venue_id === editDraft.venue_id
                            );
                            return <option key={`${c.start}-${c.end}`} value={String(i)} disabled={taken}>{c.start}–{c.end}{taken ? ' 🚫' : ''}</option>;
                          })}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[9px] uppercase text-slate-500 font-semibold mb-0.5">Titre *</label>
                      <Input value={editDraft.title} onChange={(e) => setEditDraft((f) => ({ ...f, title: e.target.value }))} className="h-7 text-[11px]" />
                    </div>
                    <div>
                      <label className="block text-[9px] uppercase text-slate-500 font-semibold mb-0.5">Descriptif</label>
                      <Textarea value={editDraft.description} onChange={(e) => setEditDraft((f) => ({ ...f, description: e.target.value }))} rows={2} className="text-[11px]" />
                    </div>
                    {/* 🆕 SESSION 44 — Public cible + Besoins matériels (notes exposant) */}
                    <div className="grid grid-cols-2 gap-1.5">
                      <div>
                        <label className="block text-[9px] uppercase text-slate-500 font-semibold mb-0.5">🎯 Public cible</label>
                        <select
                          value={editDraft.target_audience || ''}
                          onChange={(e) => setEditDraft((f) => ({ ...f, target_audience: e.target.value }))}
                          className="w-full h-7 text-[11px] rounded-md border border-input bg-white px-1.5"
                        >
                          <option value="">— Non précisé —</option>
                          <option value="enfants">Enfants</option>
                          <option value="adultes">Adultes</option>
                          <option value="tous_publics">Tous publics</option>
                          <option value="familles">Familles</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[9px] uppercase text-slate-500 font-semibold mb-0.5">📦 Besoins matériels (notes)</label>
                        <Input
                          value={editDraft.material_needs || ''}
                          onChange={(e) => setEditDraft((f) => ({ ...f, material_needs: e.target.value }))}
                          placeholder="ex: 2 tapis, sono, projecteur…"
                          className="h-7 text-[11px]"
                        />
                      </div>
                    </div>
                    <div className="flex gap-1 justify-end">
                      <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px]" disabled={busy} onClick={() => { setEditingId(null); setEditDraft({}); }}>Annuler</Button>
                      <Button size="sm" className="h-6 px-2 text-[11px] bg-violet-600 hover:bg-violet-700 text-white" disabled={busy || !editDraft.title?.trim()} onClick={saveEdit}>
                        {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div key={s.id} className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5 flex items-start gap-2 text-xs">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge className={`text-[10px] ${normalizeLoc(s.location_type) === 'zone_demo' ? 'bg-orange-100 text-orange-800 border-orange-300' : 'bg-blue-100 text-blue-800 border-blue-300'}`} variant="outline">
                          {normalizeLoc(s.location_type) === 'zone_demo' ? '🟧 Zone démo' : '🟦 Sur stand'}
                        </Badge>
                        <span className="text-[10px] font-mono font-semibold text-slate-700">{s.start_time}–{s.end_time}</span>
                        {s.venue_id && s.venue_id !== venueId && (
                          <Badge variant="outline" className="text-[9px] bg-amber-50 border-amber-300 text-amber-800">📍 autre site</Badge>
                        )}
                      </div>
                      <div className="font-medium text-slate-800 mt-0.5 truncate">{s.title || '—'}</div>
                      {s.description && <div className="text-[10px] text-slate-600 mt-0.5 whitespace-pre-wrap break-words">{s.description}</div>}
                      {/* 🆕 SESSION 44 — Public cible + besoins matériels visibles côté admin */}
                      {(s.target_audience || s.material_needs) && (
                        <div className="mt-1 flex flex-wrap gap-2 text-[10px]">
                          {s.target_audience && (
                            <span className="bg-blue-50 border border-blue-200 text-blue-800 px-1.5 py-0.5 rounded">
                              🎯 Public : <b>{s.target_audience}</b>
                            </span>
                          )}
                          {s.material_needs && (
                            <span className="bg-amber-50 border border-amber-200 text-amber-800 px-1.5 py-0.5 rounded">
                              📦 Besoins : <span className="font-medium">{s.material_needs}</span>
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 px-1.5 border-violet-300 text-violet-700 hover:bg-violet-50"
                        disabled={isLocked || busyDelete === s.id || editingId === s.id}
                        onClick={() => startEdit(s)}
                        title="Modifier cette animation"
                      >
                        <Pencil className="w-3 h-3" />
                      </Button>
                      {/* 🆕 SESSION 53.16 — Échanger avec un autre exposant du même site */}
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 px-1.5 border-amber-300 text-amber-700 hover:bg-amber-50"
                        disabled={isLocked || busyDelete === s.id || editingId === s.id}
                        onClick={() => openSwapDialog(s)}
                        title="Échanger ce créneau avec un autre exposant"
                      >
                        ↔
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 px-1.5 border-red-300 text-red-700 hover:bg-red-50"
                        disabled={isLocked || busyDelete === s.id || editingId === s.id}
                        onClick={() => deleteAnim(s.id)}
                        title="Supprimer cette animation"
                      >
                        {busyDelete === s.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {!showForm && !isLocked && (
        <Button
          variant="outline"
          size="sm"
          className="w-full border-dashed border-2 border-violet-300 text-violet-700 hover:bg-violet-50 gap-2 h-8 text-xs"
          onClick={() => setShowForm(true)}
        >
          <Plus className="w-3.5 h-3.5" /> Ajouter une animation
        </Button>
      )}
      {showForm && (
        <div className="rounded-md border-2 border-violet-400 bg-violet-50/30 p-3 space-y-2">
          <div className="text-xs font-bold text-violet-900 mb-1">Nouvelle animation</div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] uppercase text-slate-500 font-semibold mb-0.5">Jour</label>
              <select
                value={form.day}
                onChange={(e) => setForm((f) => ({ ...f, day: e.target.value, slot_index: 0 }))}
                className="w-full h-8 text-xs rounded-md border border-input bg-white px-2"
              >
                <option value="vendredi">Vendredi 14 août</option>
                <option value="samedi">Samedi 15 août</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase text-slate-500 font-semibold mb-0.5">Type</label>
              <select
                value={form.location_type}
                onChange={(e) => setForm((f) => ({ ...f, location_type: e.target.value, slot_index: 0 }))}
                className="w-full h-8 text-xs rounded-md border border-input bg-white px-2"
              >
                <option value="sur_stand">🟦 Sur stand (30 min)</option>
                <option value="zone_demo">🟧 Zone démo (45 min)</option>
              </select>
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-0.5">
              <label className="block text-[10px] uppercase text-slate-500 font-semibold">Créneau horaire</label>
              {/* 🆕 SESSION 53.16 — Toggle "horaire libre" */}
              <label className="flex items-center gap-1 text-[10px] text-violet-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.use_custom_time}
                  onChange={(e) => setForm((f) => ({ ...f, use_custom_time: e.target.checked }))}
                  className="w-3 h-3"
                />
                ⚙️ Horaire libre
              </label>
            </div>
            {form.use_custom_time ? (
              <div className="grid grid-cols-2 gap-1.5">
                <div>
                  <label className="block text-[9px] text-slate-500 mb-0.5">Début</label>
                  <Input
                    type="time"
                    value={form.custom_start}
                    onChange={(e) => setForm((f) => ({ ...f, custom_start: e.target.value }))}
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[9px] text-slate-500 mb-0.5">Fin</label>
                  <Input
                    type="time"
                    value={form.custom_end}
                    onChange={(e) => setForm((f) => ({ ...f, custom_end: e.target.value }))}
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            ) : (
              <select
                value={String(form.slot_index)}
                onChange={(e) => setForm((f) => ({ ...f, slot_index: Number(e.target.value) }))}
                className="w-full h-8 text-xs rounded-md border border-input bg-white px-2"
              >
                {slotChoicesForCurrent().map((s, i) => {
                  const taken = form.location_type === 'zone_demo' && isDemoSlotTaken(form.day, s.start, s.end);
                  return (
                    <option key={`${s.start}-${s.end}`} value={String(i)} disabled={taken}>
                      {s.start}–{s.end} {taken ? '🚫 (déjà pris)' : ''}
                    </option>
                  );
                })}
              </select>
            )}
          </div>
          <div>
            <label className="block text-[10px] uppercase text-slate-500 font-semibold mb-0.5">Titre <span className="text-slate-400">(optionnel — si vide, "Créneau réservé")</span></label>
            <Input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="ex: Démonstration de judo — laissez vide pour réserver"
              className="h-8 text-xs"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase text-slate-500 font-semibold mb-0.5">Descriptif</label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Détails de l'animation (visible par les visiteurs)…"
              rows={3}
              className="text-xs"
            />
          </div>
          {/* 🆕 SESSION 44 — Public cible + Besoins matériels */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] uppercase text-slate-500 font-semibold mb-0.5">🎯 Public cible</label>
              <select
                value={form.target_audience || ''}
                onChange={(e) => setForm((f) => ({ ...f, target_audience: e.target.value }))}
                className="w-full h-8 text-xs rounded-md border border-input bg-white px-2"
              >
                <option value="">— Non précisé —</option>
                <option value="enfants">Enfants</option>
                <option value="adultes">Adultes</option>
                <option value="tous_publics">Tous publics</option>
                <option value="familles">Familles</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase text-slate-500 font-semibold mb-0.5">📦 Besoins matériels</label>
              <Input
                value={form.material_needs || ''}
                onChange={(e) => setForm((f) => ({ ...f, material_needs: e.target.value }))}
                placeholder="ex: 2 tapis, sono, projecteur…"
                className="h-8 text-xs"
              />
            </div>
          </div>
          <div className="flex gap-1 justify-end pt-1">
            <Button size="sm" variant="ghost" className="h-7 text-xs" disabled={busy} onClick={() => { setShowForm(false); setForm({ day: 'vendredi', location_type: 'sur_stand', slot_index: 0, title: '', description: '', material_needs: '', target_audience: '', use_custom_time: false, custom_start: '', custom_end: '' }); }}>
              Annuler
            </Button>
            <Button size="sm" className="h-7 text-xs bg-violet-600 hover:bg-violet-700 text-white gap-1" disabled={busy} onClick={addAnim}>
              {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
              {form.title.trim() ? 'Créer' : 'Réserver créneau vide'}
            </Button>
          </div>
        </div>
      )}

      {/* 🆕 SESSION 53.16 — Dialogue d'échange de propriétaire de créneau */}
      {swapSourceSlot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !swapBusy && setSwapSourceSlot(null)}>
          <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-slate-200 bg-amber-50">
              <div className="flex items-center gap-2 text-amber-900 font-bold">
                ↔ Échanger ce créneau avec un autre exposant
              </div>
              <div className="text-[11px] text-slate-600 mt-1">
                <b>Source :</b> {swapSourceSlot.title || 'Créneau réservé'} · {swapSourceSlot.day_label} · {swapSourceSlot.start_time}–{swapSourceSlot.end_time} · {swapSourceSlot.location_type === 'zone_demo' ? '🟧 Zone démo' : '🟦 Sur stand'}
              </div>
              <div className="text-[11px] text-slate-500 italic mt-0.5">
                Sélectionnez un créneau d'un autre exposant : les 2 créneaux échangeront de propriétaire (le créneau garde son horaire et son emplacement).
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
              {swapCandidates.length === 0 ? (
                <div className="text-xs text-slate-500 italic text-center py-6">Aucun autre créneau sur ce site</div>
              ) : (
                swapCandidates.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    disabled={swapBusy}
                    onClick={() => confirmSwap(c)}
                    className="w-full text-left p-2 rounded border border-slate-200 hover:border-amber-400 hover:bg-amber-50 transition disabled:opacity-50"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold text-slate-900 truncate">
                          {c._org_name} <span className="text-[10px] text-slate-500 font-normal">— {c.title || 'Créneau réservé'}</span>
                        </div>
                        <div className="text-[10px] text-slate-600 mt-0.5">
                          📅 {c.day_label} · ⏰ {c.start_time}–{c.end_time} · {c.location_type === 'zone_demo' ? '🟧 Zone démo' : '🟦 Sur stand'}
                        </div>
                      </div>
                      <span className="text-amber-700 text-base">↔</span>
                    </div>
                  </button>
                ))
              )}
            </div>
            <div className="px-4 py-2 border-t border-slate-200 bg-slate-50 flex justify-end gap-2">
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setSwapSourceSlot(null)} disabled={swapBusy}>
                Fermer
              </Button>
              {swapBusy && <span className="text-xs text-amber-700 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Échange en cours…</span>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// =======================================================
// 🏠 AdminStandPicker — sélection visuelle de stand depuis l'admin
//   (réplique le portail exposant : grille stands libres + pré-réservation/libération)
// =======================================================
function AdminStandPicker({ registrationId, venueId, venueName, currentStandCode, isLocked, onReload }) {
  const [stands, setStands] = useState(null);
  const [busy, setBusy] = useState(false);
  const [swapTarget, setSwapTarget] = useState(null); // stand object pour confirm swap
  const [forceTarget, setForceTarget] = useState(null); // stand object pour force-attribute en mode locked

  const load = async () => {
    if (!venueId) { setStands([]); return; }
    try {
      const data = await api(`/api/venues/${venueId}/stands`);
      setStands(Array.isArray(data) ? data : []);
    } catch { setStands([]); }
  };
  useEffect(() => { load(); }, [venueId]);

  if (!venueId) return null;
  if (stands === null) {
    return (
      <div className="rounded-md border border-slate-200 bg-slate-50 p-2 text-xs text-slate-400 text-center">
        <Loader2 className="w-3 h-3 inline animate-spin mr-1" /> Chargement des stands…
      </div>
    );
  }

  // Standard reservation (admin, non-locked)
  const reserve = async (stand) => {
    setBusy(true);
    try {
      if (isLocked) {
        // Admin force-attribute même si verrouillé
        await api(`/api/admin/registrations/${registrationId}/force-stand`, {
          method: 'POST',
          body: JSON.stringify({ stand_id: stand.id }),
        });
        toast.success(`⚡ Stand ${stand.stand_code} forcé par admin (inscription verrouillée)`);
      } else {
        await api(`/api/registrations/${registrationId}/pre-reserve-stand`, {
          method: 'POST',
          body: JSON.stringify({ stand_id: stand.id }),
        });
        toast.success(`✅ Stand ${stand.stand_code} attribué`);
      }
      await load();
      onReload?.();
    } catch (e) { toast.error(e.message); }
    setBusy(false);
  };

  // Swap stand with another exposant (works even when locked)
  const swap = async (otherStand) => {
    if (!otherStand?.organization) return;
    const otherRegId = otherStand.assignment?.registration_id;
    if (!otherRegId) return toast.error('Impossible d\'identifier l\'inscription liée à ce stand');
    setBusy(true);
    try {
      await api(`/api/admin/registrations/${registrationId}/swap-stand`, {
        method: 'POST',
        body: JSON.stringify({ other_registration_id: otherRegId }),
      });
      toast.success(`🔄 Stands échangés : ${currentStandCode || '—'} ↔ ${otherStand.stand_code}`);
      setSwapTarget(null);
      await load();
      onReload?.();
    } catch (e) { toast.error(e.message); }
    setBusy(false);
  };

  const release = async () => {
    if (isLocked) return toast.error('Inscription verrouillée — utilisez "échanger" plutôt que libérer');
    if (!confirm(`Libérer le stand ${currentStandCode} ? L'exposant pourra en choisir un autre.`)) return;
    setBusy(true);
    try {
      await api(`/api/registrations/${registrationId}/release-stand`, { method: 'POST', body: '{}' });
      toast.success('Stand libéré');
      await load();
      onReload?.();
    } catch (e) { toast.error(e.message); }
    setBusy(false);
  };

  const freeStands = stands.filter((s) => !s.organization);
  const occupiedStands = stands.filter((s) => s.organization);
  const myStand = stands.find((s) => s.stand_code === currentStandCode);
  const otherOccupiedStands = occupiedStands.filter((s) => s.stand_code !== currentStandCode);

  return (
    <div className="rounded-md border-2 border-emerald-200 bg-emerald-50/30 p-2.5 my-2">
      <div className="text-xs font-bold text-emerald-900 mb-1.5 flex items-center justify-between flex-wrap gap-1">
        <span className="flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5" />
          Attribution de stand · {venueName || '—'}
        </span>
        <Badge variant="outline" className="text-[10px] bg-white">
          {freeStands.length} libre{freeStands.length > 1 ? 's' : ''} / {stands.length}
        </Badge>
      </div>

      {/* État actuel */}
      {myStand ? (
        <div className="bg-blue-50 border border-blue-300 rounded p-2 mb-2 flex items-center gap-2 flex-wrap">
          <CheckCircle2 className="w-4 h-4 text-blue-700 shrink-0" />
          <div className="text-xs flex-1">
            <span className="font-bold text-blue-900">Stand attribué :</span>
            <span className="font-mono font-bold text-blue-700 ml-1">{currentStandCode}</span>
            <span className="text-[10px] text-slate-500 ml-2">{myStand.row ? `Rangée ${myStand.row}` : ''} {myStand.col ? `· Col ${myStand.col}` : ''}</span>
            {isLocked && <Badge className="ml-2 text-[9px] bg-violet-100 text-violet-800 border-violet-300" variant="outline">🔒 verrouillé</Badge>}
          </div>
          {!isLocked && (
            <Button size="sm" variant="outline" className="h-6 px-2 text-[11px] border-red-300 text-red-700 hover:bg-red-50" onClick={release} disabled={busy}>
              <Trash2 className="w-3 h-3 mr-1" /> Libérer
            </Button>
          )}
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded p-2 mb-2 text-xs text-amber-800 flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> Aucun stand attribué — cliquez sur un stand libre ci-dessous
        </div>
      )}

      {isLocked && (
        <div className="text-[11px] text-violet-800 bg-violet-50 border border-violet-200 rounded p-1.5 mb-2 leading-relaxed">
          🔒 <b>Inscription verrouillée</b> — vous pouvez quand même <b>modifier le stand</b> (admin force) ou <b>échanger</b> avec un autre exposant en cliquant ci-dessous.
        </div>
      )}

      {/* Grille stands libres — cliquables admin (force si verrouillé) */}
      {freeStands.length > 0 && (
        <>
          <div className="text-[10px] uppercase text-slate-500 font-semibold mb-1">Stands libres ({freeStands.length}) — cliquer pour attribuer</div>
          <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-1 mb-2">
            {freeStands.map((s) => (
              <button
                key={s.id}
                type="button"
                disabled={busy}
                onClick={() => isLocked ? setForceTarget(s) : reserve(s)}
                className="border border-emerald-300 bg-white hover:bg-emerald-100 hover:border-emerald-500 rounded text-center transition disabled:opacity-50 py-1 px-0.5"
                title={isLocked ? `Forcer le stand ${s.stand_code} (admin)` : `Attribuer le stand ${s.stand_code}`}
              >
                <div className="font-mono font-bold text-[10px] text-emerald-700">{s.stand_code}</div>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Stands occupés — cliquables pour SWAP */}
      {otherOccupiedStands.length > 0 && (
        <details className="text-[10px] text-slate-500" open={isLocked}>
          <summary className="cursor-pointer hover:text-slate-700 font-semibold uppercase">
            🔄 Échanger avec un stand occupé ({otherOccupiedStands.length}) — cliquer pour swap
          </summary>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 mt-1">
            {otherOccupiedStands.map((s) => (
              <button
                key={s.id}
                type="button"
                disabled={busy || !myStand}
                onClick={() => setSwapTarget(s)}
                title={myStand ? `Échanger ${currentStandCode} ↔ ${s.stand_code}` : 'Vous devez avoir un stand attribué pour pouvoir échanger'}
                className="rounded border border-blue-200 bg-blue-50 hover:bg-blue-100 hover:border-blue-400 px-1.5 py-1 text-left text-[10px] flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="font-mono font-bold text-blue-700 shrink-0">🔄 {s.stand_code}</span>
                <span className="text-slate-600 truncate" title={s.organization?.name}>{s.organization?.name || '—'}</span>
              </button>
            ))}
          </div>
        </details>
      )}

      {/* Confirmation swap modal inline */}
      {swapTarget && (
        <div className="mt-2 rounded-md border-2 border-blue-500 bg-blue-50 p-2.5">
          <div className="text-xs font-bold text-blue-900 mb-1">🔄 Confirmer l&apos;échange de stands</div>
          <div className="text-[11px] text-slate-700 mb-2 leading-relaxed">
            <b>{venueName}</b> :<br />
            • Votre stand <b className="font-mono">{currentStandCode}</b> → ira à <b>{swapTarget.organization?.name || '—'}</b><br />
            • Le stand <b className="font-mono">{swapTarget.stand_code}</b> (de {swapTarget.organization?.name}) → vous reviendra<br />
            <span className="text-amber-700">⚠️ L&apos;autre exposant verra son numéro de stand changer.</span>
          </div>
          <div className="flex gap-1 justify-end">
            <Button size="sm" variant="ghost" className="h-7 text-xs" disabled={busy} onClick={() => setSwapTarget(null)}>Annuler</Button>
            <Button size="sm" className="h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white" disabled={busy} onClick={() => swap(swapTarget)}>
              {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3 mr-1" />}
              Confirmer l&apos;échange
            </Button>
          </div>
        </div>
      )}

      {/* Confirmation force-stand (mode verrouillé) */}
      {forceTarget && (
        <div className="mt-2 rounded-md border-2 border-violet-500 bg-violet-50 p-2.5">
          <div className="text-xs font-bold text-violet-900 mb-1">⚡ Forcer le stand (admin override)</div>
          <div className="text-[11px] text-slate-700 mb-2 leading-relaxed">
            L&apos;inscription est verrouillée mais l&apos;admin peut quand même changer le stand.<br />
            Stand actuel <b className="font-mono">{currentStandCode || 'aucun'}</b> → nouveau <b className="font-mono">{forceTarget.stand_code}</b>
          </div>
          <div className="flex gap-1 justify-end">
            <Button size="sm" variant="ghost" className="h-7 text-xs" disabled={busy} onClick={() => setForceTarget(null)}>Annuler</Button>
            <Button size="sm" className="h-7 text-xs bg-violet-600 hover:bg-violet-700 text-white" disabled={busy} onClick={() => { reserve(forceTarget); setForceTarget(null); }}>
              {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3 mr-1" />}
              Forcer le stand
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}


// =======================================================
// 🏘️ AdminSecondarySitesField — sites secondaires en multi-select
// =======================================================
function AdminSecondarySitesField({ currentSites, allVenues, primaryVenueId, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(currentSites || []);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setDraft(currentSites || []); }, [currentSites?.join(',')]);

  const availableVenues = allVenues.filter((v) =>
    v.is_available_2026 !== false && v.id !== primaryVenueId
  );

  const toggle = (venueName) => {
    if (draft.includes(venueName)) {
      setDraft(draft.filter((s) => s !== venueName));
    } else {
      setDraft([...draft, venueName]);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      await onSave(draft);
      setEditing(false);
    } catch (e) { toast.error(e.message); }
    setSaving(false);
  };

  return (
    <div className="py-1.5 border-b border-slate-100">
      <div className="text-[10px] uppercase text-slate-500 font-semibold mb-0.5">Sites secondaires (souhaits)</div>
      {editing ? (
        <div className="space-y-1">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
            {availableVenues.length === 0 ? (
              <div className="text-[11px] italic text-slate-400 col-span-3">Aucun autre site disponible</div>
            ) : availableVenues.map((v) => (
              <label key={v.id} className={`flex items-center gap-1.5 rounded border px-1.5 py-1 cursor-pointer text-[11px] ${draft.includes(v.name) ? 'border-blue-400 bg-blue-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
                <input
                  type="checkbox"
                  checked={draft.includes(v.name)}
                  onChange={() => toggle(v.name)}
                  className="w-3 h-3"
                />
                <span>📍 {v.name}</span>
              </label>
            ))}
          </div>
          <div className="flex gap-1 justify-end">
            <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px]" onClick={() => { setEditing(false); setDraft(currentSites || []); }} disabled={saving}>Annuler</Button>
            <Button size="sm" className="h-6 px-2 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white" onClick={save} disabled={saving}>
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs truncate flex-1">
            {(currentSites || []).length === 0 ? (
              <span className="italic text-slate-400">Non renseigné</span>
            ) : (
              (currentSites || []).map((s) => <Badge key={s} variant="outline" className="text-[10px] mr-1 bg-blue-50 border-blue-200 text-blue-800">📍 {s}</Badge>)
            )}
          </div>
          <Button size="sm" variant="outline" onClick={() => setEditing(true)} className="h-7 px-2 text-[11px] shrink-0">
            <Pencil className="w-3 h-3 mr-1" />
            {(currentSites || []).length === 0 ? 'Ajouter' : 'Modifier'}
          </Button>
        </div>
      )}
    </div>
  );
}


// =======================================================
// 🎯 AdminDisciplineField — dropdown exhaustif avec catégories
// =======================================================
const DISCIPLINE_GROUPS = [
  { label: '🥋 Arts martiaux & combat', items: [
    'Aïkido', 'Arts martiaux', 'Boxe anglaise', 'Boxe française (savate)', 'Boxe thaï',
    'Capoeira', 'Escrime', 'Hapkido', 'Judo', 'Judo / Jujitsu', 'Judo / Kendo',
    'Judo / MMA', 'Jujitsu', 'Karaté', 'Kendo', 'Kickboxing', 'Krav-Maga', 'MMA',
    'Taekwondo', 'Taekwondo / Jujitsu', 'Viet Vo Dao', 'Wushu / Kung-fu',
  ]},
  { label: '🏃 Sports collectifs & individuels', items: [
    'Athlétisme', 'Badminton', 'Basket-ball', 'Cyclisme / BMX', 'Football',
    'Football américain', 'Futsal', 'Golf', 'Gymnastique', 'Handball', 'Hockey',
    'Multisports', 'Pétanque', 'Rugby', 'Tennis', 'Tennis de table', 'Triathlon',
    'Ultimate frisbee', 'Volleyball',
  ]},
  { label: '🌊 Sports nautiques', items: [
    'Aviron', 'Kitesurf / Voile', 'Natation', 'Natation / Sauvetage', 'Plongée / Permis bateau',
    'Surf', 'Stand-up paddle (SUP)', 'Va\'a', 'Voile', 'Water-polo', 'Wakeboard',
  ]},
  { label: '💃 Danse & expression corporelle', items: [
    'Danse', 'Danse classique', 'Danse contemporaine', 'Danse Polynésienne',
    'Danse / Bien-être', 'Hip-hop', 'Modern jazz', 'Ori Tahiti', 'Ori Tahiti / Danse feu',
    'Salsa / Bachata', 'Zumba',
  ]},
  { label: '🧘 Bien-être & forme', items: [
    'Bien-être', 'Coaching sportif', 'Crossfit', 'Fitness', 'Méditation',
    'Pilates', 'Sophrologie', 'Yoga', 'Éveil sportif bébés',
  ]},
  { label: '🎨 Arts plastiques & créatifs', items: [
    'Art', 'Anglais / Dessin', 'Arts plastiques', 'Couture / Broderie',
    'Dessin / Peinture', 'Fabrication / DIY', 'Origami / Art / Japonais', 'Photographie',
    'Poterie / Céramique', 'Sculpture', 'Tatouage traditionnel',
  ]},
  { label: '🎵 Musique & spectacle', items: [
    'Musique', 'Chant / Chorale', 'Cinéma / Vidéo', 'Cirque', 'Magie',
    'Piano / Clavier', 'Théâtre', 'Ukulélé / Guitare', 'Percussions',
  ]},
  { label: '🧪 Sciences & numérique', items: [
    'Astronomie', 'Échecs', 'Informatique / Code', 'Jeux vidéo / Ateliers', 'Mathématiques',
    'Robotique', 'Robotique / Soutien', 'Sciences', 'Sciences de la nature',
  ]},
  { label: '📚 Langues & culture', items: [
    'Cours de japonais', 'Langue anglaise', 'Langue chinoise',
    'Langue espagnole', 'Langue allemande', 'Reo Tahiti', 'FLE (Français)',
  ]},
  { label: '🎓 Éducation & soutien', items: [
    'Activités', 'Activités enfants', 'Éducation', 'Lecture / Dons livres',
    'Méthodologie / Bullet journal', 'Soutien scolaire', 'Tutorat',
  ]},
  { label: '🍔 Restauration', items: [
    'Boulangerie / Pâtisserie', 'Café / Salon de thé', 'Cuisine', 'Food truck',
    'Glacier', 'Pâtisserie', 'Restauration rapide', 'Restaurant',
  ]},
  { label: '🏢 Services & autres', items: [
    'Assurance', 'Banque', 'Beauté / Coiffure', 'Coaching / Conseil',
    'Commerce / Boutique', 'Communication / Marketing', 'Énergie / Solaire',
    'Immobilier', 'Information / Presse', 'Santé / Paramédical', 'Tourisme',
    'Transport',
  ]},
  { label: '❓ Autre', items: ['Autre'] },
];

function AdminDisciplineField({ value, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || '');
  const [customMode, setCustomMode] = useState(false);
  const [saving, setSaving] = useState(false);

  // Détecte si la valeur actuelle est dans la liste, sinon active le mode "autre/personnalisé"
  const allItems = DISCIPLINE_GROUPS.flatMap((g) => g.items);
  useEffect(() => {
    setDraft(value || '');
    setCustomMode(value && !allItems.includes(value));
  }, [value]);

  const save = async () => {
    setSaving(true);
    try { await onSave(draft); setEditing(false); }
    catch (e) { toast.error(e.message); }
    setSaving(false);
  };

  return (
    <div className="py-1.5 border-b border-slate-100">
      <div className="text-[10px] uppercase text-slate-500 font-semibold mb-0.5">Secteur / Discipline</div>
      {editing ? (
        <div className="space-y-1">
          {!customMode ? (
            <select
              value={draft}
              onChange={(e) => {
                if (e.target.value === '__custom__') { setCustomMode(true); setDraft(''); }
                else setDraft(e.target.value);
              }}
              className="w-full h-8 text-xs rounded-md border border-input bg-white px-2"
            >
              <option value="">— Sélectionner —</option>
              {DISCIPLINE_GROUPS.map((g) => (
                <optgroup key={g.label} label={g.label}>
                  {g.items.map((it) => <option key={it} value={it}>{it}</option>)}
                </optgroup>
              ))}
              <option value="__custom__">✏️ Saisir une discipline personnalisée…</option>
            </select>
          ) : (
            <div className="flex gap-1">
              <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Discipline personnalisée…" className="h-8 text-xs flex-1" />
              <Button size="sm" variant="ghost" className="h-8 px-2 text-[11px]" onClick={() => { setCustomMode(false); setDraft(''); }} type="button">↩ Liste</Button>
            </div>
          )}
          <div className="flex gap-1 justify-end">
            <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px]" onClick={() => { setEditing(false); setDraft(value || ''); setCustomMode(value && !allItems.includes(value)); }} disabled={saving}>Annuler</Button>
            <Button size="sm" className="h-7 px-2 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white" onClick={save} disabled={saving}>
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs truncate flex-1">
            {value ? <span>{value}</span> : <span className="italic text-slate-400">Non renseigné</span>}
          </div>
          <Button size="sm" variant="outline" onClick={() => setEditing(true)} className="h-7 px-2 text-[11px] shrink-0">
            <Pencil className="w-3 h-3 mr-1" />
            {value ? 'Modifier' : 'Choisir'}
          </Button>
        </div>
      )}
    </div>
  );
}


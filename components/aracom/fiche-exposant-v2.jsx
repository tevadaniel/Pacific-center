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

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  ChevronDown, ChevronUp, Pencil, Plus, X, Check, CheckCircle2, Loader2,
  User, Phone, FileText, MapPin, History, ListChecks, Wallet,
  FileBox, Sparkles, Activity, StickyNote, AlertTriangle, Trash2,
  Mail, ExternalLink, Building2, Users as UsersIcon, CalendarClock,
} from 'lucide-react';
import { api } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import DeleteOrgDialog from './delete-org-dialog';
import SendExposantMailDialog from './send-exposant-mail-dialog';
import DocumentsTab from './documents-tab';
import PortalTab from './portal-tab';
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
              <Select value={draft || '_none'} onValueChange={(v) => setDraft(v === '_none' ? '' : v)}>
                <SelectTrigger className="h-8 text-xs flex-1 min-w-0"><SelectValue placeholder={placeholder} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">—</SelectItem>
                  {(options || []).map((o) => (
                    <SelectItem key={typeof o === 'string' ? o : o.value} value={typeof o === 'string' ? o : o.value}>
                      {typeof o === 'string' ? o : (o.label || o.value)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
// 🚀 MAIN COMPONENT
// =======================================================

export default function FicheExposantV2({ id, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [showDelete2Step, setShowDelete2Step] = useState(false);
  const [showMailDialog, setShowMailDialog] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const { open: openExposantPanel } = useExposantPanel();

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const d = await api(`/api/registrations/${id}`);
      setData(d);
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

  return (
    <div className="space-y-3 max-w-3xl mx-auto pb-8">
      {/* ═══════════════════ HEADER ═══════════════════ */}
      <div className="rounded-xl border border-slate-200 bg-white p-3.5">
        <div className="flex items-start gap-3">
          <div className={`w-12 h-12 rounded-full ${avatarBg} text-white flex items-center justify-center font-bold text-lg shrink-0`}>
            {getInitials(fullName)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-base text-slate-900 truncate">{fullName}</div>
            <div className="text-xs text-slate-500 truncate">
              {orgDisplay} {reg.stand_code ? `· Stand ${reg.stand_code}` : ''} {venue?.name ? `· ${venue.name}` : ''}
              {org.priority_level && (
                <Badge className={`ml-2 ${
                  org.priority_level === 'A' ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                  : org.priority_level === 'B' ? 'bg-amber-100 text-amber-800 border-amber-300'
                  : 'bg-blue-100 text-blue-800 border-blue-300'} text-[10px]`}>Priorité {org.priority_level}</Badge>
              )}
            </div>

            {/* 🗓️ Métadonnées temporelles : création + dernière MAJ */}
            {(orgCreatedAt || regCreatedAt) && (
              <div
                className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10.5px] text-slate-500"
                title={[
                  orgCreatedAtFull && `Profil organisation créé : ${orgCreatedAtFull}`,
                  regCreatedAtFull && `Inscription créée : ${regCreatedAtFull}`,
                  orgUpdatedAtFull && `Dernière modification : ${orgUpdatedAtFull}`,
                ].filter(Boolean).join('\n')}
              >
                <CalendarClock className="w-3 h-3 text-slate-400" />
                {orgCreatedAt && (
                  <span>
                    Profil créé le <span className="font-semibold text-slate-700">{orgCreatedAt}</span>
                  </span>
                )}
                {regCreatedAt && regCreatedAt !== orgCreatedAt && (
                  <span>· Inscription le <span className="font-semibold text-slate-700">{regCreatedAt}</span></span>
                )}
                {org.source_origin && (
                  <Badge variant="outline" className="text-[9px] h-4 px-1.5 border-slate-200 text-slate-500 font-normal">
                    {org.source_origin === 'import_excel_2026' ? 'Import 2026'
                      : org.source_origin === 'public_inscription' ? 'Inscription publique'
                      : org.source_origin === 'admin_manual' ? 'Création admin'
                      : org.source_origin}
                  </Badge>
                )}
              </div>
            )}

            {/* Status badges */}
            <div className="flex flex-wrap gap-1 mt-2">
              <Badge className={`text-[10px] ${
                reg.status === 'confirme' ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                : reg.status === 'annule' ? 'bg-red-100 text-red-800 border-red-300'
                : reg.status === 'liste_attente' ? 'bg-violet-100 text-violet-800 border-violet-300'
                : 'bg-amber-100 text-amber-800 border-amber-300'
              }`}>
                {reg.status === 'confirme' ? '✓ Confirmé' : reg.status === 'annule' ? '⛔ Annulé' : reg.status === 'liste_attente' ? '⏳ Liste d\'attente' : '⏱ À confirmer'}
              </Badge>
              {isEmailMissing && <Badge className="bg-red-100 text-red-800 border-red-300 text-[10px]">📧 Email manquant</Badge>}
              <Badge className={`text-[10px] ${isCautionOk ? 'bg-blue-100 text-blue-800 border-blue-300' : 'bg-slate-100 text-slate-600 border-slate-300'}`}>
                💰 Caution {isCautionOk ? '✓' : '—'}
              </Badge>
              <Badge className={`text-[10px] ${isConventionOk ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-red-50 text-red-700 border-red-200'}`}>
                📝 Convention {isConventionOk ? '✓' : 'à signer'}
              </Badge>
              <Badge className={`text-[10px] ${isAssuranceOk ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-red-50 text-red-700 border-red-200'}`}>
                🛡 Assurance {isAssuranceOk ? '✓' : 'manquante'}
              </Badge>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 shrink-0 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contextual alert */}
        {dossierPct < 80 && (
          <div className="mt-3 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-900 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>Dossier incomplet — {!isAssuranceOk && 'Attestation d\'assurance manquante · '}{!isConventionOk && 'Convention non signée · '}{dossierPct}%</span>
          </div>
        )}
        {dossierPct >= 80 && (
          <div className="mt-3 rounded-md bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs text-emerald-800 flex items-start gap-2">
            <Check className="w-4 h-4 mt-0.5 shrink-0" />
            <span>Dossier complet à {dossierPct}% — prêt pour le Forum</span>
          </div>
        )}

        {/* 4 metrics 2x2 */}
        <div className="grid grid-cols-2 gap-2 mt-3">
          <div className="rounded-md bg-slate-50 border border-slate-200 px-3 py-2">
            <div className="text-[10px] text-slate-500 uppercase">Dossier</div>
            <div className="font-bold text-slate-900 text-base">{dossierPct}%</div>
          </div>
          <div className="rounded-md bg-slate-50 border border-slate-200 px-3 py-2">
            <div className="text-[10px] text-slate-500 uppercase">Statut</div>
            <div className="font-bold text-slate-900 text-sm capitalize">{reg.status?.replace('_', ' ') || '—'}</div>
          </div>
          <div className="rounded-md bg-slate-50 border border-slate-200 px-3 py-2">
            <div className="text-[10px] text-slate-500 uppercase">Caution</div>
            <div className="font-bold text-slate-900 text-sm">{dep?.amount_xpf ? `${dep.amount_xpf.toLocaleString('fr')} XPF` : '—'}</div>
          </div>
          <div className="rounded-md bg-slate-50 border border-slate-200 px-3 py-2">
            <div className="text-[10px] text-slate-500 uppercase">Animations</div>
            <div className="font-bold text-slate-900 text-base">{slots.length}</div>
          </div>
        </div>

        {/* Quick action strip */}
        <div className="flex flex-wrap gap-1.5 mt-3">
          <Button size="sm" onClick={confirmInscription} disabled={confirming || reg.status === 'confirme'} className="h-7 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white gap-1">
            {confirming ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
            Confirmer
          </Button>
          <Button size="sm" variant="outline" onClick={() => setShowMailDialog(true)} disabled={!org.main_email} className="h-7 text-[11px] gap-1">
            <Mail className="w-3 h-3" /> Envoyer mail
          </Button>
          <AiInsightTrigger
            scope="exposant"
            registrationId={reg.id}
            organizationId={org.id}
            label="✨ Synthèse IA"
            buttonClassName="h-7 text-[11px] px-3 rounded-md border border-violet-300 bg-violet-50 text-violet-800 hover:bg-violet-100"
          />
          <Button size="sm" variant="outline" onClick={copyAccessLink} className="h-7 text-[11px] gap-1">
            <ExternalLink className="w-3 h-3" /> Lien accès
          </Button>
        </div>
      </div>

      {/* ═══════════════════ TABS NAVIGATION ═══════════════════ */}
      <Tabs defaultValue="profil" className="w-full">
        <TabsList className="grid grid-cols-6 w-full bg-slate-100 h-9 p-0.5">
          <TabsTrigger value="profil" className="text-[11px] gap-1 data-[state=active]:bg-white"><User className="w-3 h-3" /> Profil</TabsTrigger>
          <TabsTrigger value="animations" className="text-[11px] gap-1 data-[state=active]:bg-white"><Sparkles className="w-3 h-3" /> Animations</TabsTrigger>
          <TabsTrigger value="documents" className="text-[11px] gap-1 data-[state=active]:bg-white"><FileBox className="w-3 h-3" /> Documents</TabsTrigger>
          <TabsTrigger value="statut" className="text-[11px] gap-1 data-[state=active]:bg-white"><ListChecks className="w-3 h-3" /> Statut</TabsTrigger>
          <TabsTrigger value="bilan" className="text-[11px] gap-1 data-[state=active]:bg-white"><Activity className="w-3 h-3" /> Bilan&nbsp;J</TabsTrigger>
          <TabsTrigger value="portail" className="text-[11px] gap-1 data-[state=active]:bg-white"><ExternalLink className="w-3 h-3" /> Portail</TabsTrigger>
        </TabsList>

        {/* ═══════════════════ ONGLET PROFIL ═══════════════════ */}
        <TabsContent value="profil" className="space-y-3 mt-3">

      {/* ═══════════════════ SECTION 1 : IDENTITÉ ═══════════════════ */}
      <CollapsibleSection icon={User} title="Identité" defaultOpen>
        <EditableField label="Raison sociale" value={org.name} placeholder="Nom de la société ou association" onSave={(v) => saveOrg({ name: v })} />
        <EditableField label="Poste / Fonction" value={org.position} onSave={(v) => saveOrg({ position: v })} />
        <EditableField label="Secteur / Discipline" value={org.discipline} placeholder="ex: Sport, Artisanat, Santé..." onSave={(v) => saveOrg({ discipline: v })} />
        <EditableField label="Description stand" type="textarea" maxLength={150} value={org.description} placeholder="150 caractères max" onSave={(v) => saveOrg({ description: v })} />
        <EditableField label="Président(e)" value={org.president_name} placeholder="Si association — laisser vide sinon" onSave={(v) => saveOrg({ president_name: v })} />
      </CollapsibleSection>

      {/* ═══════════════════ SECTION 2 : CONTACT ═══════════════════ */}
      <CollapsibleSection icon={Phone} title="Contact" defaultOpen>
        <EditableField
          label="Email"
          type="email"
          value={org.main_email}
          validate={(v) => v && !/.+@.+\..+/.test(v) ? 'Email invalide' : null}
          onSave={(v) => saveOrg({ main_email: v })}
        />
        <EditableField label="Téléphone" type="tel" value={org.main_phone} placeholder="+689 ..." onSave={(v) => saveOrg({ main_phone: v })} />
        <EditableField label="Site web" type="url" value={org.website} placeholder="https://..." onSave={(v) => saveOrg({ website: v })} />
        <EditableField label="Facebook" type="url" value={org.facebook} placeholder="https://facebook.com/..." onSave={(v) => saveOrg({ facebook: v })} />
      </CollapsibleSection>

      {/* ═══════════════════ SECTION 3 : IMMATRICULATION ═══════════════════ */}
      <CollapsibleSection icon={FileText} title="Immatriculation">
        <EditableField label="N° Tahiti" value={org.tahiti_number} placeholder="N° Tahiti (obligatoire en PF)" onSave={(v) => saveOrg({ tahiti_number: v })} />
        <EditableField label="SIRET" value={org.siret} placeholder="14 chiffres (laisser vide si non applicable)" onSave={(v) => saveOrg({ siret: v })} />
        <EditableField label="SIREN" value={org.siren} placeholder="9 chiffres (laisser vide si non applicable)" onSave={(v) => saveOrg({ siren: v })} />
        <EditableField label="N° RNA" value={org.rna_number} placeholder="W... (associations uniquement)" onSave={(v) => saveOrg({ rna_number: v })} />
        <EditableField
          label="Forme juridique"
          type="select"
          options={[
            'SARL',
            'PATENTE',
            'Association',
            'SAS',
            'EI (Entreprise individuelle)',
            'EURL',
            'Association Loi 1901',
            'Association Loi 1887 PF',
            'GIE',
            'Coopérative',
            'Société Civile',
            'Profession libérale',
            'Autre',
          ]}
          value={org.forme_juridique}
          onSave={(v) => saveOrg({ forme_juridique: v })}
        />
      </CollapsibleSection>

      {/* ═══════════════════ SECTION 4 : STAND & SITE ═══════════════════ */}
      <CollapsibleSection icon={MapPin} title="Stand & Site" defaultOpen>
        {/* 🆕 SESSION 43 — Gestion multi-sites depuis l'admin (réplique du portail exposant) */}
        <AdminMultiSitesPanel
          organizationId={org.id}
          currentRegId={reg.id}
          onReload={load}
          onSwitchSite={(newRegId) => openExposantPanel(newRegId)}
        />
        <EditableField
          label="Site principal"
          type="select"
          options={['Faaa', 'Punaauia', 'Arue', 'Taravao', 'Moorea', 'Mahina']}
          value={venue?.name}
          onSave={(v) => saveReg({ venue_id: data.venues_lookup_by_name?.[v] || reg.venue_id })}
          format={(v) => v || '—'}
        />
        <EditableField label="N° stand" value={reg.stand_code} onSave={(v) => saveReg({ stand_code: v })} />
        {/* 🆕 SESSION 43-d — Sélecteur visuel de stands libres (réplique du portail exposant) */}
        <AdminStandPicker
          registrationId={reg.id}
          venueId={reg.venue_id}
          venueName={venue?.name}
          currentStandCode={reg.stand_code}
          isLocked={reg.is_locked || reg.candidature_locked || reg.status === 'confirme'}
          onReload={load}
        />
        <EditableField
          label="Taille stand"
          type="select"
          options={['3×3 m', '3×6 m', '6×6 m', 'Angle/Spécial']}
          value={reg.stand_size}
          onSave={(v) => saveReg({ stand_size: v })}
        />
        <EditableField
          label="Sites secondaires"
          value={Array.isArray(org.secondary_sites) ? org.secondary_sites.join(', ') : org.secondary_sites}
          placeholder="ex: Punaauia, Arue"
          onSave={(v) => saveOrg({ secondary_sites: v ? v.split(',').map((s) => s.trim()) : [] })}
        />
        <EditableField
          label="Priorité"
          type="select"
          options={[
            { value: 'A', label: 'A — Fidèle / prioritaire' },
            { value: 'B', label: 'B — Régulier' },
            { value: 'C', label: 'C — Nouveau' },
          ]}
          value={org.priority_level}
          onSave={(v) => saveOrg({ priority_level: v })}
        />
        <EditableField
          label="Jour(s) présence"
          type="select"
          options={[
            { value: 'both', label: 'Ven. 14 + Sam. 15 août' },
            { value: 'friday', label: 'Ven. 14 uniquement' },
            { value: 'saturday', label: 'Sam. 15 uniquement' },
          ]}
          value={Array.isArray(reg.attending_days) ? (reg.attending_days.length === 2 ? 'both' : reg.attending_days[0] === '2026-08-14' ? 'friday' : 'saturday') : ''}
          onSave={(v) => {
            const days = v === 'both' ? ['2026-08-14', '2026-08-15']
              : v === 'friday' ? ['2026-08-14']
              : v === 'saturday' ? ['2026-08-15']
              : [];
            return saveReg({ attending_days: days });
          }}
          format={(v) => v === 'both' ? 'Ven. 14 + Sam. 15 août' : v === 'friday' ? 'Ven. 14' : v === 'saturday' ? 'Sam. 15' : '—'}
        />
      </CollapsibleSection>

      {/* ═══════════════════ SECTION 5 : HISTORIQUE PRÉSENCE ═══════════════════ */}
      <CollapsibleSection icon={History} title="Historique de présence">
        <div className="grid grid-cols-4 gap-2 mb-2">
          {[2023, 2024, 2025, 2026].map((year) => {
            const histo = (org.participation_history || {})[year];
            const status = year === 2026 ? 'en_cours' : (histo?.status || 'nc');
            const colors = {
              present: 'bg-emerald-100 text-emerald-800 border-emerald-300',
              absent: 'bg-red-100 text-red-800 border-red-300',
              en_cours: 'bg-slate-100 text-slate-700 border-slate-300',
              nc: 'bg-slate-50 text-slate-400 border-slate-200',
            };
            const labels = { present: 'Présent', absent: 'Absent', en_cours: 'En cours', nc: 'NC' };
            return (
              <div key={year} className={`rounded-md border px-2 py-2 text-center ${colors[status]}`}>
                <div className="text-[10px] font-bold">{year}</div>
                <div className="text-[11px]">{labels[status]}</div>
              </div>
            );
          })}
        </div>
        <EditableField label="Incident 2023" value={reg.incident_2023} type="textarea" onSave={(v) => saveReg({ incident_2023: v })} />
        <EditableField label="Incident 2024" value={reg.incident_2024} type="textarea" onSave={(v) => saveReg({ incident_2024: v })} />
        <EditableField label="Incident 2025" value={reg.incident_2025} type="textarea" onSave={(v) => saveReg({ incident_2025: v })} />
      </CollapsibleSection>

      {/* ═══════════════════ SECTION 11 : NOTES INTERNES (profil tab) ═══════════════════ */}
      <CollapsibleSection icon={StickyNote} title="Notes internes ARACOM">
        <EditableField label="Notes" type="textarea" value={reg.internal_notes} onSave={(v) => saveReg({ internal_notes: v })} />
        <div className="text-[10px] italic text-slate-400 mt-1">🔒 Non visible par l&apos;exposant</div>
      </CollapsibleSection>

        </TabsContent>

        {/* ═══════════════════ ONGLET STATUT ═══════════════════ */}
        <TabsContent value="statut" className="space-y-3 mt-3">

      {/* ═══════════════════ SECTION 6 : STATUT & DOSSIER ═══════════════════ */}
      <CollapsibleSection icon={ListChecks} title="Statut & Dossier" defaultOpen>
        <div className="text-xs text-slate-500 mb-1.5">Statut d&apos;inscription</div>
        <div className="grid grid-cols-2 gap-2 mb-3">
          {[
            { key: 'a_confirmer', label: '⏱ À confirmer', cls: 'bg-amber-50 text-amber-900 border-amber-300', active: 'bg-amber-500 text-white border-amber-600' },
            { key: 'confirme', label: '✓ Confirmé', cls: 'bg-emerald-50 text-emerald-900 border-emerald-300', active: 'bg-emerald-600 text-white border-emerald-700' },
            { key: 'liste_attente', label: '⏳ Liste d\'attente', cls: 'bg-violet-50 text-violet-900 border-violet-300', active: 'bg-violet-600 text-white border-violet-700' },
            { key: 'annule', label: '⛔ Annulé', cls: 'bg-red-50 text-red-900 border-red-300', active: 'bg-red-600 text-white border-red-700' },
          ].map((s) => (
            <button
              key={s.key}
              onClick={() => setStatus(s.key)}
              className={`rounded-md border px-2 py-1.5 text-xs font-medium transition ${reg.status === s.key ? s.active : s.cls + ' hover:bg-slate-50'}`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <EditableField label="Convention" type="select" options={[{ value: 'non_signee', label: 'Non signée' }, { value: 'signee', label: 'Signée' }, { value: 'en_cours', label: 'En cours' }]} value={reg.convention_status} onSave={(v) => saveReg({ convention_status: v, is_convention_signed: v === 'signee' })} />
        <EditableField label="Assurance" type="select" options={[{ value: 'manquante', label: 'Manquante' }, { value: 'recue', label: 'Reçue' }, { value: 'en_attente', label: 'En attente' }]} value={reg.assurance_status} onSave={(v) => saveReg({ assurance_status: v, is_insurance_uploaded: v === 'recue' })} />
        <EditableField label="Dossier %" type="number" value={dossierPct} onSave={(v) => saveReg({ completion_percent: Number(v), dossier_pct: Number(v) })} />
        <EditableField label="Mail envoyé" type="select" options={[{ value: 'non', label: 'Non' }, { value: 'oui', label: 'Oui' }, { value: 'attente_reponse', label: 'En attente réponse' }]} value={reg.mail_sent_status} onSave={(v) => saveReg({ mail_sent_status: v })} />
        <EditableField label="Réponse reçue" type="select" options={[{ value: 'oui', label: 'Oui' }, { value: 'non', label: 'Non' }, { value: 'en_attente', label: 'En attente' }]} value={reg.reply_status} onSave={(v) => saveReg({ reply_status: v })} />
      </CollapsibleSection>

      {/* ═══════════════════ SECTION 7 : CAUTION ═══════════════════ */}
      <CollapsibleSection icon={Wallet} title="Caution">
        <EditableField label="Montant (XPF)" type="number" value={dep?.amount_xpf || reg.caution_amount_xpf} onSave={(v) => saveReg({ caution_amount_xpf: Number(v) })} />
        <EditableField label="Mode encaissement" type="select" options={['Espèces', 'Chèque', 'Virement', 'Carte bancaire']} value={reg.caution_mode || dep?.payment_method} onSave={(v) => saveReg({ caution_mode: v })} />
        <EditableField label="Date encaissement" type="date" value={reg.caution_received_date} onSave={(v) => saveReg({ caution_received_date: v })} />
        <EditableField label="RDV caution" type="datetime-local" value={reg.caution_appointment_at} onSave={(v) => saveReg({ caution_appointment_at: v })} />
        <EditableField
          label="Statut restitution"
          type="select"
          options={['a_restituer', 'restituee', 'retenue_partielle', 'retenue_totale', 'a_verifier']}
          value={reg.restitution_status}
          onSave={(v) => saveReg({ restitution_status: v })}
        />
        <EditableField label="Motif de retenue" type="textarea" value={reg.restitution_motif} onSave={(v) => saveReg({ restitution_motif: v })} />
        <EditableField label="Date restit. prévue" type="date" value={reg.restitution_planned_date} onSave={(v) => saveReg({ restitution_planned_date: v })} />
        <EditableField label="Date restit. effective" type="date" value={reg.restitution_actual_date} onSave={(v) => saveReg({ restitution_actual_date: v })} />
      </CollapsibleSection>

        </TabsContent>

        {/* ═══════════════════ ONGLET DOCUMENTS ═══════════════════ */}
        <TabsContent value="documents" className="space-y-3 mt-3">
          <DocumentsTab
            registration={reg}
            organization={org}
            deposit={dep}
            documents={docs}
            onReload={load}
          />
        </TabsContent>

        {/* ═══════════════════ ONGLET ANIMATIONS ═══════════════════ */}
        <TabsContent value="animations" className="space-y-3 mt-3">

      {/* ═══════════════════ SECTION 9 : ANIMATIONS — CRUD ADMIN ═══════════════════ */}
      <CollapsibleSection icon={Sparkles} title="Animations" badge={<Badge className="text-[10px] ml-1">{slots.length}</Badge>}>
        <AdminAnimationsPanel
          registrationId={reg.id}
          venueId={reg.venue_id}
          venueName={venue?.name}
          attendingDays={Array.isArray(reg.attending_days) ? reg.attending_days : []}
          slots={slots}
          isLocked={reg.is_locked || reg.candidature_locked}
          onReload={load}
        />
      </CollapsibleSection>

        </TabsContent>

        {/* ═══════════════════ ONGLET BILAN JOUR J ═══════════════════ */}
        <TabsContent value="bilan" className="space-y-3 mt-3">

      {/* ═══════════════════ SECTION 10 : BILAN JOUR J ═══════════════════ */}
      <CollapsibleSection icon={Activity} title="Bilan Jour J">
        <EditableField label="Présence constatée" type="select" options={[{ value: 'present', label: 'Présent' }, { value: 'absent', label: 'Absent' }, { value: 'retard', label: 'Retard' }, { value: 'depart_anticipe', label: 'Départ anticipé' }]} value={reg.bilan_presence} onSave={(v) => saveReg({ bilan_presence: v })} />
        <EditableField label="Arrivée réelle" type="time" value={reg.bilan_arrival_real} onSave={(v) => saveReg({ bilan_arrival_real: v })} />
        <EditableField label="Départ réel" type="time" value={reg.bilan_departure_real} onSave={(v) => saveReg({ bilan_departure_real: v })} />
        <EditableField label="Animation réalisée" type="select" options={[{ value: 'oui_conforme', label: 'Oui — conforme' }, { value: 'oui_partielle', label: 'Oui — partielle' }, { value: 'non', label: 'Non' }]} value={reg.bilan_animation_status} onSave={(v) => saveReg({ bilan_animation_status: v })} />
        <EditableField label="État stand au départ" type="select" options={[{ value: 'bon_etat', label: 'Bon état' }, { value: 'degrade', label: 'Dégradé' }, { value: 'incident', label: 'Incident matériel' }]} value={reg.bilan_stand_status} onSave={(v) => saveReg({ bilan_stand_status: v })} />
        <EditableField label="Anomalie / Incident" type="textarea" value={reg.bilan_anomaly} onSave={(v) => saveReg({ bilan_anomaly: v })} />
        <EditableField label="Commentaire agent" type="textarea" value={reg.bilan_agent_comment} onSave={(v) => saveReg({ bilan_agent_comment: v })} />
        <EditableField label="Reco caution" type="select" options={[{ value: 'integrale', label: 'Restitution intégrale' }, { value: 'partielle', label: 'Retenue partielle' }, { value: 'totale', label: 'Retenue totale' }, { value: 'a_verifier', label: 'À vérifier' }]} value={reg.bilan_caution_reco} onSave={(v) => saveReg({ bilan_caution_reco: v })} />
      </CollapsibleSection>

        </TabsContent>

        {/* ═══════════════════ ONGLET PORTAIL ═══════════════════ */}
        <TabsContent value="portail" className="space-y-3 mt-3">
          <PortalTab registration={reg} organization={org} documents={docs} />
        </TabsContent>
      </Tabs>

      {/* ═══════════════════ ZONE DE SUPPRESSION ═══════════════════ */}
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
        api('/api/venues').catch(() => []),
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
function AdminAnimationsPanel({ registrationId, venueId, venueName, attendingDays, slots, isLocked, onReload }) {
  const [allSlotsVenue, setAllSlotsVenue] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [busyDelete, setBusyDelete] = useState(null);
  const [form, setForm] = useState({
    day: 'vendredi',
    location_type: 'sur_stand',
    slot_index: 0,
    title: '',
    description: '',
  });

  const EVENT_DATES_LOCAL = [
    { label: 'vendredi', date: '2026-08-14', display: 'Vendredi 14 août' },
    { label: 'samedi', date: '2026-08-15', display: 'Samedi 15 août' },
  ];
  const STAND_SLOTS_FRIDAY = [
    { start: '11:00', end: '12:00' }, { start: '12:00', end: '13:00' },
    { start: '13:00', end: '14:00' }, { start: '14:00', end: '15:00' },
    { start: '15:00', end: '16:00' }, { start: '16:00', end: '17:00' },
  ];
  const STAND_SLOTS_SATURDAY = [
    { start: '09:00', end: '10:00' }, { start: '10:00', end: '11:00' },
    ...STAND_SLOTS_FRIDAY,
  ];
  const DEMO_SLOTS = [
    { start: '09:00', end: '09:30' }, { start: '09:30', end: '10:00' },
    { start: '10:00', end: '10:30' }, { start: '10:30', end: '11:00' },
    { start: '11:00', end: '11:30' }, { start: '11:30', end: '12:00' },
    { start: '13:00', end: '13:30' }, { start: '13:30', end: '14:00' },
    { start: '14:00', end: '14:30' }, { start: '14:30', end: '15:00' },
    { start: '15:00', end: '15:30' }, { start: '15:30', end: '16:00' },
    { start: '16:00', end: '16:30' }, { start: '16:30', end: '17:00' },
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
  useEffect(() => { loadAllVenueSlots(); }, [venueId, slots.length]);

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
    if (!form.title.trim()) return toast.error('Titre requis');
    const choices = slotChoicesForCurrent();
    const slot = choices[form.slot_index];
    if (!slot) return toast.error('Créneau invalide');
    if (form.location_type === 'zone_demo' && isDemoSlotTaken(form.day, slot.start, slot.end)) {
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
          start_time: slot.start,
          end_time: slot.end,
          duration_minutes: form.location_type === 'zone_demo' ? 30 : 60,
          title: form.title,
          description: form.description || null,
          slot_type: form.location_type,
          location_type: form.location_type,
        }),
      });
      toast.success(`✨ Animation ${slot.start}–${slot.end} créée`);
      setShowForm(false);
      setForm({ day: 'vendredi', location_type: 'sur_stand', slot_index: 0, title: '', description: '' });
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
      <div className="text-[11px] text-slate-600 bg-slate-50 border border-slate-200 rounded-md p-2 leading-relaxed">
        📍 Site : <b>{venueName || '—'}</b>
        {attendingDays.length > 0 && <> · Jours prévus : <b>{attendingDays.includes('vendredi') ? 'Ven' : ''}{attendingDays.length === 2 ? ' + ' : ''}{attendingDays.includes('samedi') ? 'Sam' : ''}</b></>}
        <br />
        🟦 <b>Sur stand</b> = 1h propre à votre stand · 🟧 <b>Zone démo</b> = 30 min partagé (1 seul exposant à la fois)
        {isLocked && <div className="mt-1 text-amber-700 font-semibold">🔒 Inscription verrouillée — modifications restreintes</div>}
      </div>

      {EVENT_DATES_LOCAL.map((d) => {
        const list = slotsByDay[d.label];
        return (
          <div key={d.label} className="rounded-md border border-slate-200 bg-white p-2">
            <div className="text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
              <span>📅 {d.display}</span>
              <Badge variant="outline" className="text-[10px]">{list.length} animation{list.length > 1 ? 's' : ''}</Badge>
            </div>
            {list.length === 0 ? (
              <div className="text-[11px] italic text-slate-400 py-1">Aucune animation ce jour</div>
            ) : (
              <div className="space-y-1">
                {list.map((s) => (
                  <div key={s.id} className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5 flex items-start gap-2 text-xs">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge className={`text-[10px] ${normalizeLoc(s.location_type) === 'zone_demo' ? 'bg-orange-100 text-orange-800 border-orange-300' : 'bg-blue-100 text-blue-800 border-blue-300'}`} variant="outline">
                          {normalizeLoc(s.location_type) === 'zone_demo' ? '🟧 Zone démo' : '🟦 Sur stand'}
                        </Badge>
                        <span className="text-[10px] font-mono font-semibold text-slate-700">{s.start_time}–{s.end_time}</span>
                      </div>
                      <div className="font-medium text-slate-800 mt-0.5 truncate">{s.title || '—'}</div>
                      {s.description && <div className="text-[10px] text-slate-600 mt-0.5 whitespace-pre-wrap break-words">{s.description}</div>}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 px-1.5 border-red-300 text-red-700 hover:bg-red-50 shrink-0"
                      disabled={isLocked || busyDelete === s.id}
                      onClick={() => deleteAnim(s.id)}
                      title="Supprimer cette animation"
                    >
                      {busyDelete === s.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                    </Button>
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
                <option value="sur_stand">🟦 Sur stand (1h)</option>
                <option value="zone_demo">🟧 Zone démo (30 min)</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-[10px] uppercase text-slate-500 font-semibold mb-0.5">Créneau horaire</label>
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
          </div>
          <div>
            <label className="block text-[10px] uppercase text-slate-500 font-semibold mb-0.5">Titre *</label>
            <Input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="ex: Démonstration de judo"
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
          <div className="flex gap-1 justify-end pt-1">
            <Button size="sm" variant="ghost" className="h-7 text-xs" disabled={busy} onClick={() => { setShowForm(false); setForm({ day: 'vendredi', location_type: 'sur_stand', slot_index: 0, title: '', description: '' }); }}>
              Annuler
            </Button>
            <Button size="sm" className="h-7 text-xs bg-violet-600 hover:bg-violet-700 text-white gap-1" disabled={busy || !form.title.trim()} onClick={addAnim}>
              {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
              Créer
            </Button>
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

  const reserve = async (stand) => {
    if (isLocked) return toast.error('Inscription verrouillée — modification impossible');
    setBusy(true);
    try {
      await api(`/api/registrations/${registrationId}/pre-reserve-stand`, {
        method: 'POST',
        body: JSON.stringify({ stand_id: stand.id }),
      });
      toast.success(`✅ Stand ${stand.stand_code} attribué`);
      await load();
      onReload?.();
    } catch (e) { toast.error(e.message); }
    setBusy(false);
  };

  const release = async () => {
    if (isLocked) return toast.error('Inscription verrouillée');
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

      {/* Grille stands libres */}
      {!isLocked && freeStands.length > 0 && (
        <>
          <div className="text-[10px] uppercase text-slate-500 font-semibold mb-1">Stands libres ({freeStands.length})</div>
          <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-1 mb-2">
            {freeStands.map((s) => (
              <button
                key={s.id}
                type="button"
                disabled={busy}
                onClick={() => reserve(s)}
                className="border border-emerald-300 bg-white hover:bg-emerald-100 hover:border-emerald-500 rounded text-center transition disabled:opacity-50 py-1 px-0.5"
                title={`Attribuer le stand ${s.stand_code}`}
              >
                <div className="font-mono font-bold text-[10px] text-emerald-700">{s.stand_code}</div>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Stands occupés (info) */}
      {occupiedStands.length > 0 && (
        <details className="text-[10px] text-slate-500">
          <summary className="cursor-pointer hover:text-slate-700">Voir les {occupiedStands.length} stand{occupiedStands.length > 1 ? 's' : ''} occupé{occupiedStands.length > 1 ? 's' : ''}</summary>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 mt-1">
            {occupiedStands.map((s) => (
              <div key={s.id} className={`rounded border bg-slate-100 px-1.5 py-0.5 text-[10px] flex items-center gap-1 ${s.stand_code === currentStandCode ? 'border-blue-400 bg-blue-50' : 'border-slate-200'}`}>
                <span className="font-mono font-bold text-slate-700">{s.stand_code}</span>
                <span className="text-slate-500 truncate" title={s.organization?.name}>{s.organization?.name || '—'}</span>
              </div>
            ))}
          </div>
        </details>
      )}

      {isLocked && (
        <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded p-1.5 mt-1">
          🔒 Inscription verrouillée — modification du stand impossible
        </div>
      )}
    </div>
  );
}


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
  ChevronDown, ChevronUp, Pencil, Plus, X, Check, Loader2,
  User, Phone, FileText, MapPin, History, ListChecks, Wallet,
  FileBox, Sparkles, Activity, StickyNote, AlertTriangle, Trash2,
  Mail, ExternalLink, Building2, Users as UsersIcon,
} from 'lucide-react';
import { api } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import DeleteOrgDialog from './delete-org-dialog';
import SendExposantMailDialog from './send-exposant-mail-dialog';
import AiInsightTrigger from '@/components/ai-insight-trigger';

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
      {/* ═══════════════════ TOGGLE ENTREPRISE / ASSOCIATION ═══════════════════ */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => toggleEntityType('entreprise')}
          className={`flex-1 px-3 py-2 rounded-lg border text-xs font-medium transition flex items-center justify-center gap-1.5 ${
            !isAssoc
              ? 'bg-blue-600 text-white border-blue-700 shadow'
              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
          }`}
        >
          <Building2 className="w-3.5 h-3.5" /> Entreprise
        </button>
        <button
          type="button"
          onClick={() => toggleEntityType('association')}
          className={`flex-1 px-3 py-2 rounded-lg border text-xs font-medium transition flex items-center justify-center gap-1.5 ${
            isAssoc
              ? 'bg-teal-600 text-white border-teal-700 shadow'
              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
          }`}
        >
          <UsersIcon className="w-3.5 h-3.5" /> Association
        </button>
      </div>

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

      {/* ═══════════════════ SECTION 1 : IDENTITÉ ═══════════════════ */}
      <CollapsibleSection icon={User} title="Identité" defaultOpen>
        <EditableField label="Prénom" value={org.first_name} onSave={(v) => saveOrg({ first_name: v })} />
        <EditableField label="Nom" value={org.last_name} onSave={(v) => saveOrg({ last_name: v })} />
        <EditableField label={isAssoc ? 'Association' : 'Société'} value={org.name} onSave={(v) => saveOrg({ name: v })} />
        <EditableField label="Poste / Fonction" value={org.position} onSave={(v) => saveOrg({ position: v })} />
        <EditableField label="Secteur / Discipline" value={org.discipline} placeholder="ex: Sport, Artisanat, Santé..." onSave={(v) => saveOrg({ discipline: v })} />
        <EditableField label="Description stand" type="textarea" maxLength={150} value={org.description} placeholder="150 caractères max" onSave={(v) => saveOrg({ description: v })} />
        <EditableField
          label="Représentants sur stand"
          type="select"
          options={['1', '2']}
          value={org.representants_count != null ? String(org.representants_count) : ''}
          onSave={(v) => saveOrg({ representants_count: v ? Number(v) : null })}
          format={(v) => `${v} (max 2)`}
        />
        {isAssoc && (
          <>
            <EditableField label="Président(e)" value={org.president_name} onSave={(v) => saveOrg({ president_name: v })} />
            <EditableField label="Nb membres" type="number" value={org.members_count} onSave={(v) => saveOrg({ members_count: v ? Number(v) : null })} />
          </>
        )}
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
        {!isAssoc && (
          <EditableField label="SIRET" value={org.siret} placeholder="14 chiffres" onSave={(v) => saveOrg({ siret: v })} />
        )}
        {isAssoc && (
          <>
            <EditableField label="N° RNA" value={org.rna_number} placeholder="W..." onSave={(v) => saveOrg({ rna_number: v })} />
            <EditableField label="N° Tahiti" value={org.tahiti_number} onSave={(v) => saveOrg({ tahiti_number: v })} />
          </>
        )}
        <EditableField
          label="Forme juridique"
          type="select"
          options={['SARL', 'SAS', 'EI', 'Association Loi 1901', 'Association Loi 1887 PF', 'GIE', 'Coopérative', 'Autre']}
          value={org.forme_juridique}
          onSave={(v) => saveOrg({ forme_juridique: v })}
        />
      </CollapsibleSection>

      {/* ═══════════════════ SECTION 4 : STAND & SITE ═══════════════════ */}
      <CollapsibleSection icon={MapPin} title="Stand & Site" defaultOpen>
        <EditableField
          label="Site principal"
          type="select"
          options={['Faaa', 'Punaauia', 'Arue', 'Taravao', 'Moorea', 'Mahina']}
          value={venue?.name}
          onSave={(v) => saveReg({ venue_id: data.venues_lookup_by_name?.[v] || reg.venue_id })}
          format={(v) => v || '—'}
        />
        <EditableField label="N° stand" value={reg.stand_code} onSave={(v) => saveReg({ stand_code: v })} />
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

      {/* ═══════════════════ SECTION 8 : DOCUMENTS ═══════════════════ */}
      <CollapsibleSection icon={FileBox} title="Documents">
        <div className="space-y-1.5">
          {[
            { key: 'convention', label: 'Convention signée', required: true, isOk: isConventionOk },
            { key: 'assurance', label: 'Attestation d\'assurance', required: true, isOk: isAssuranceOk },
            { key: 'identite', label: 'Pièce d\'identité du référent', required: true, isOk: !!reg.identity_received },
            { key: 'immat', label: 'Justificatif d\'immatriculation', required: false, isOk: docs.some((d) => d.document_type === 'immatriculation') },
            { key: 'visuels', label: 'Visuels / Photos du stand', required: false, isOk: docs.some((d) => d.document_type === 'visuel') },
          ].map((d) => (
            <div key={d.key} className="flex items-center gap-2 py-1.5 border-b border-slate-100 last:border-b-0">
              <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="text-xs text-slate-700 flex-1 truncate">{d.label}</span>
              <Badge className={`text-[9px] ${d.required ? 'bg-red-100 text-red-700 border-red-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>{d.required ? 'Obligatoire' : 'Optionnel'}</Badge>
              <Badge className={`text-[10px] ${d.isOk ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-red-50 text-red-700 border-red-200'}`}>{d.isOk ? '✓ Reçu' : (d.required ? 'Manquant' : 'Non fourni')}</Badge>
              {d.required && !d.isOk && (
                <Button size="sm" variant="outline" onClick={() => toggleDocReceived(d.key, true)} className="h-6 px-2 text-[10px]">
                  Marquer reçu
                </Button>
              )}
              {d.required && d.isOk && (
                <Button size="sm" variant="ghost" onClick={() => toggleDocReceived(d.key, false)} className="h-6 px-2 text-[10px] text-slate-500">
                  Annuler
                </Button>
              )}
            </div>
          ))}
        </div>
      </CollapsibleSection>

      {/* ═══════════════════ SECTION 9 : ANIMATIONS DÉCLARÉES ═══════════════════ */}
      <CollapsibleSection icon={Sparkles} title="Animations déclarées" badge={<Badge className="text-[10px] ml-1">{slots.length}</Badge>}>
        {slots.length === 0 ? (
          <div className="text-xs italic text-slate-400 text-center py-3">Aucune animation déclarée</div>
        ) : (
          <div className="space-y-2">
            {slots.map((s) => (
              <div key={s.id} className="rounded-md border border-slate-200 bg-slate-50 p-2 text-xs">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <Badge className="bg-violet-100 text-violet-800 border-violet-300 text-[10px]">{s.animation_type_label || s.type || 'Animation'}</Badge>
                  <span className="text-[10px] text-slate-500">{s.event_date} · {s.time_slot || `${s.start_time || ''}–${s.end_time || ''}`}</span>
                </div>
                <div className="font-medium text-slate-800">{s.title || s.animation_name || '—'}</div>
                <div className="text-[11px] text-slate-600 mt-0.5">{s.description}</div>
                <div className="text-[10px] text-slate-500 mt-1">📍 {s.location_detail || s.zone_label || venue?.name || '—'}</div>
              </div>
            ))}
          </div>
        )}
        <Button size="sm" variant="outline" className="w-full mt-2 h-7 text-[11px]" onClick={() => toast.info('💡 Ajout / suppression via l\'onglet Pilotage > Animations')}>
          <Plus className="w-3 h-3 mr-1" /> Gérer les animations…
        </Button>
      </CollapsibleSection>

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

      {/* ═══════════════════ SECTION 11 : NOTES INTERNES ═══════════════════ */}
      <CollapsibleSection icon={StickyNote} title="Notes internes ARACOM">
        <EditableField label="Notes" type="textarea" value={reg.internal_notes} onSave={(v) => saveReg({ internal_notes: v })} />
        <div className="text-[10px] italic text-slate-400 mt-1">🔒 Non visible par l&apos;exposant</div>
      </CollapsibleSection>

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

'use client';

/**
 * 📄 DocumentsTab — Gestion documents exposant (Cockpit ARACOM)
 *
 * 2 catégories visuelles :
 *  ① Documents autogénérés (Auto) : Convention, Reçu caution, Attestation remboursement, Badge
 *  ② Documents à fournir : Assurance (obligatoire), Pièce d'identité (obligatoire), Immatriculation (optionnel)
 *
 * Stack : Next.js + MongoDB + pdfkit (génération PDF) + Nodemailer (envoi mail)
 */

import { useEffect, useState, useRef } from 'react';
import { toast } from 'sonner';
import {
  FileText, FileCheck, FileBadge, Receipt, RefreshCw, Download, Mail,
  Check, Upload, Trash2, Loader2, CloudUpload, FileX, FileWarning, Shield, IdCard, FileSpreadsheet,
} from 'lucide-react';
import { api } from '@/lib/auth-client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import AdditionalDocsSection from '@/components/shared/additional-docs-section';

// ──────────────────────────────────────────────────────────────────────────────
// AUTOGEN DOC CARD
// ──────────────────────────────────────────────────────────────────────────────
function AutoGenCard({ icon: Icon, iconBg, title, subtitle, statusLabel, statusTone, onGenerate, onDownload, onSend, onMarkSigned, generating, hasFile }) {
  const tones = {
    emerald: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    amber: 'bg-amber-100 text-amber-800 border-amber-300',
    slate: 'bg-slate-100 text-slate-700 border-slate-300',
    blue: 'bg-blue-100 text-blue-800 border-blue-300',
    rose: 'bg-rose-100 text-rose-800 border-rose-300',
  };
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 hover:shadow-sm transition">
      <div className="flex items-start gap-3">
        <div className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${iconBg}`}>
          <Icon className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-semibold text-sm text-slate-900">{title}</span>
            <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-[9px] h-4 px-1.5">Auto</Badge>
            <Badge className={`text-[10px] h-4 px-1.5 ${tones[statusTone] || tones.slate}`}>{statusLabel}</Badge>
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5 truncate">{subtitle}</div>
          <div className="flex flex-wrap gap-1.5 mt-2">
            <Button size="sm" onClick={onGenerate} disabled={generating} className="h-6 text-[10px] gap-1 bg-slate-900 hover:bg-slate-800 text-white">
              {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />} {hasFile ? 'Régénérer' : 'Générer'}
            </Button>
            {hasFile && (
              <Button size="sm" variant="outline" onClick={onDownload} className="h-6 text-[10px] gap-1">
                <Download className="w-3 h-3" /> Télécharger
              </Button>
            )}
            {hasFile && (
              <Button size="sm" variant="outline" onClick={onSend} className="h-6 text-[10px] gap-1">
                <Mail className="w-3 h-3" /> Envoyer
              </Button>
            )}
            {onMarkSigned && (
              <Button size="sm" variant="outline" onClick={onMarkSigned} className="h-6 text-[10px] gap-1 text-emerald-700 border-emerald-300 hover:bg-emerald-50">
                <Check className="w-3 h-3" /> Marquer signée
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// UPLOAD CARD (Assurance / ID / Immat)
// ──────────────────────────────────────────────────────────────────────────────
function UploadCard({ icon: Icon, iconBg, title, subtitle, required, doc, regId, docType, onReload }) {
  const [drag, setDrag] = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef(null);
  const hasFile = !!doc;
  const statusLabel = hasFile ? '✓ Reçu' : (required ? 'Manquant' : 'Non fourni');
  const statusTone = hasFile ? 'emerald' : (required ? 'rose' : 'slate');
  const tones = {
    emerald: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    rose: 'bg-rose-100 text-rose-800 border-rose-300',
    slate: 'bg-slate-100 text-slate-700 border-slate-300',
  };

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
    } catch (e) {
      toast.error(e?.message || 'Erreur upload');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!doc?.id || !confirm('Supprimer ce document ?')) return;
    try {
      await api(`/api/registration-documents/${doc.id}`, { method: 'DELETE' });
      toast.success('Document supprimé');
      onReload?.();
    } catch (e) { toast.error(e.message); }
  };

  const handleDownload = () => {
    if (!doc?.id) return;
    window.open(`/api/documents/${doc.id}/download`, '_blank');
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex items-start gap-3">
        <div className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${iconBg}`}>
          <Icon className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-semibold text-sm text-slate-900">{title}</span>
            <Badge className={`text-[9px] h-4 px-1.5 ${required ? 'bg-red-50 text-red-700 border-red-200' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
              {required ? 'Obligatoire' : 'Optionnel'}
            </Badge>
            <Badge className={`text-[10px] h-4 px-1.5 ${tones[statusTone]}`}>{statusLabel}</Badge>
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">{subtitle}</div>

          {hasFile ? (
            <div className="flex flex-wrap gap-1.5 mt-2">
              <span className="text-[10px] text-slate-600 truncate max-w-[200px] italic">📎 {doc.file_name}</span>
              <Button size="sm" variant="outline" onClick={handleDownload} className="h-6 text-[10px] gap-1">
                <Download className="w-3 h-3" /> Télécharger
              </Button>
              <Button size="sm" variant="outline" onClick={() => inputRef.current?.click()} className="h-6 text-[10px] gap-1">
                <Upload className="w-3 h-3" /> Remplacer
              </Button>
              <Button size="sm" variant="ghost" onClick={handleDelete} className="h-6 text-[10px] gap-1 text-red-600 hover:bg-red-50">
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          ) : (
            <div
              className={`mt-2 rounded-md border-2 border-dashed text-center px-3 py-3 text-[11px] cursor-pointer transition ${
                drag ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:bg-slate-50'
              }`}
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDrag(false);
                const f = e.dataTransfer.files?.[0];
                if (f) upload(f);
              }}
            >
              {uploading ? (
                <span className="inline-flex items-center gap-1.5"><Loader2 className="w-3 h-3 animate-spin" /> Upload en cours…</span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-slate-600">
                  <CloudUpload className="w-3.5 h-3.5" />
                  Glissez un fichier ici ou cliquez pour parcourir <span className="text-slate-400">(PDF/JPG/PNG • 10 Mo max)</span>
                </span>
              )}
            </div>
          )}
          <input
            type="file"
            ref={inputRef}
            className="hidden"
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={(e) => upload(e.target.files?.[0])}
          />
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// MAIN
// ──────────────────────────────────────────────────────────────────────────────
export default function DocumentsTab({ registration, organization, deposit, documents = [], onReload }) {
  const [generating, setGenerating] = useState({});
  const reg = registration || {};
  const org = organization || {};
  const dep = deposit || {};

  // Helper : trouve un document généré par type
  const findDoc = (type) => documents.find((d) => d.document_type === type || d.category === type);
  const conventionDoc = findDoc('convention');
  const recuDoc = findDoc('recu_caution');
  const remboursementDoc = findDoc('attestation_remboursement');
  const badgeDoc = findDoc('badge_exposant');
  const guideDoc = findDoc('guide_participant');
  const assuranceDoc = findDoc('assurance');
  const identiteDoc = findDoc('identite');
  const immatDoc = findDoc('immatriculation');

  // Génère un PDF côté backend, retourne l'URL/id
  const generate = async (docType) => {
    setGenerating((g) => ({ ...g, [docType]: true }));
    try {
      await api('/api/documents/generate', {
        method: 'POST',
        body: JSON.stringify({ registration_id: reg.id, doc_type: docType }),
      });
      toast.success(`✅ ${docType} généré`);
      onReload?.();
    } catch (e) {
      toast.error(e?.message || 'Erreur génération');
    } finally {
      setGenerating((g) => ({ ...g, [docType]: false }));
    }
  };

  const download = (doc) => {
    if (!doc?.id) return;
    window.open(`/api/documents/${doc.id}/download`, '_blank');
  };

  const sendByMail = async (docType, doc) => {
    if (!doc?.id) { toast.error('Document non disponible'); return; }
    try {
      await api('/api/documents/send', {
        method: 'POST',
        body: JSON.stringify({ registration_id: reg.id, doc_id: doc.id, doc_type: docType }),
      });
      toast.success('📧 Envoyé par mail');
    } catch (e) { toast.error(e.message); }
  };

  const markConventionSigned = async () => {
    try {
      await api(`/api/registrations/${reg.id}`, {
        method: 'PUT',
        body: JSON.stringify({ is_convention_signed: true, convention_status: 'signee' }),
      });
      toast.success('✓ Convention marquée signée');
      onReload?.();
    } catch (e) { toast.error(e.message); }
  };

  // ─── Status helpers ───
  // 🆕 SESSION 48n — La convention n'est PLUS auto-générée ; elle est uploadée par ARACOM (signée)
  //    ou par l'exposant. Le flag is_convention_signed est auto-set quand un doc type 'convention' est uploadé.
  const conventionStatus = reg.is_convention_signed || reg.convention_status === 'signee'
    ? { label: '✓ Signée & uploadée', tone: 'emerald' }
    : conventionDoc
    ? { label: 'Uploadée — en relecture', tone: 'amber' }
    : { label: 'À uploader', tone: 'rose' };

  const cautionReceived = dep?.amount_xpf || reg.caution_received_date;
  const recuStatus = recuDoc ? { label: '✓ Généré', tone: 'emerald' } : cautionReceived ? { label: 'À générer', tone: 'amber' } : { label: 'En attente caution', tone: 'slate' };
  const rembStatus = remboursementDoc ? { label: '✓ Généré', tone: 'emerald' } : reg.restitution_status === 'restituee' ? { label: 'À générer', tone: 'amber' } : { label: 'Non générée', tone: 'slate' };
  const badgeStatus = badgeDoc ? { label: '✓ Généré', tone: 'emerald' } : { label: 'Non généré', tone: 'slate' };

  return (
    <div className="space-y-4">
      {/* ════════ Catégorie 1 : DOCUMENTS AUTOGÉNÉRÉS ════════ */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <FileCheck className="w-4 h-4 text-blue-600" />
          <h3 className="font-semibold text-sm text-slate-900">Documents autogénérés ARACOM</h3>
          <span className="text-[10px] text-slate-500 italic">— PDF générés depuis les données du dossier</span>
        </div>
        <div className="space-y-2">
          {/* 🆕 SESSION 48n — Convention déplacée vers "Documents à fournir" (upload manuel) */}
          <AutoGenCard
            icon={Receipt}
            iconBg="bg-amber-600"
            title="Reçu de caution"
            subtitle={cautionReceived ? `Caution ${(dep?.amount_xpf || reg.caution_amount_xpf || 20000).toLocaleString('fr')} XPF encaissée` : 'À générer après encaissement caution'}
            statusLabel={recuStatus.label}
            statusTone={recuStatus.tone}
            generating={generating.recu_caution}
            hasFile={!!recuDoc}
            onGenerate={() => generate('recu_caution')}
            onDownload={() => download(recuDoc)}
            onSend={() => sendByMail('recu_caution', recuDoc)}
          />
          <AutoGenCard
            icon={RefreshCw}
            iconBg="bg-violet-600"
            title="Attestation de remboursement"
            subtitle={reg.restitution_status === 'restituee' ? 'Caution restituée' : 'Sera générée après restitution caution'}
            statusLabel={rembStatus.label}
            statusTone={rembStatus.tone}
            generating={generating.attestation_remboursement}
            hasFile={!!remboursementDoc}
            onGenerate={() => generate('attestation_remboursement')}
            onDownload={() => download(remboursementDoc)}
            onSend={() => sendByMail('attestation_remboursement', remboursementDoc)}
          />
          <AutoGenCard
            icon={FileBadge}
            iconBg="bg-emerald-600"
            title="Badge exposant"
            subtitle="Badge nominatif pour le jour J (nom, stand, site, QR code)"
            statusLabel={badgeStatus.label}
            statusTone={badgeStatus.tone}
            generating={generating.badge_exposant}
            hasFile={!!badgeDoc}
            onGenerate={() => generate('badge_exposant')}
            onDownload={() => download(badgeDoc)}
            onSend={() => sendByMail('badge_exposant', badgeDoc)}
          />
          {/* 🆕 SESSION 37 — Guide du participant (template charte ARACOM) */}
          <AutoGenCard
            icon={FileText}
            iconBg="bg-orange-600"
            title="Guide du participant"
            subtitle="Guide complet : programme, infos pratiques, contacts, accès stand"
            statusLabel={guideDoc ? 'Généré' : 'À générer'}
            statusTone={guideDoc ? 'emerald' : 'slate'}
            generating={generating.guide_participant}
            hasFile={!!guideDoc}
            onGenerate={() => generate('guide_participant')}
            onDownload={() => download(guideDoc)}
            onSend={() => sendByMail('guide_participant', guideDoc)}
          />
        </div>
      </div>

      {/* ════════ Catégorie 2 : DOCUMENTS À FOURNIR PAR L'EXPOSANT ════════ */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Upload className="w-4 h-4 text-emerald-600" />
          <h3 className="font-semibold text-sm text-slate-900">Documents à fournir (upload manuel)</h3>
          <span className="text-[10px] text-slate-500 italic">— Upload depuis cockpit ARACOM OU portail exposant</span>
        </div>
        <div className="space-y-2">
          {/* 🆕 SESSION 48n — Convention signée : upload manuel (ARACOM la fait signer puis upload, OU l'exposant la signe et la renvoie via son portail) */}
          <UploadCard
            icon={FileText}
            iconBg="bg-blue-600"
            title="Convention signée"
            subtitle="Document contractuel signé — peut être uploadé par ARACOM ou par l'exposant"
            required
            doc={conventionDoc}
            regId={reg.id}
            docType="convention"
            onReload={onReload}
          />
          <UploadCard
            icon={Shield}
            iconBg="bg-emerald-600"
            title="Attestation d'assurance"
            subtitle="RC pro couvrant la période du Forum (14-15 août 2026)"
            required
            doc={assuranceDoc}
            regId={reg.id}
            docType="assurance"
            onReload={onReload}
          />
          <UploadCard
            icon={IdCard}
            iconBg="bg-emerald-600"
            title="Pièce d'identité du référent"
            subtitle="CNI ou passeport en cours de validité"
            required
            doc={identiteDoc}
            regId={reg.id}
            docType="identite"
            onReload={onReload}
          />
          <UploadCard
            icon={FileSpreadsheet}
            iconBg="bg-slate-500"
            title="Justificatif d'immatriculation"
            subtitle="Kbis, extrait RNA, ou équivalent"
            required={false}
            doc={immatDoc}
            regId={reg.id}
            docType="immatriculation"
            onReload={onReload}
          />
        </div>
      </div>

      {/* ════════ Catégorie 3 : DOCUMENTS COMPLÉMENTAIRES ════════ */}
      <AdditionalDocsSection
        regId={reg.id}
        documents={documents}
        onReload={onReload}
        title="📎 Documents complémentaires (RIB, statuts, programme, photos…)"
      />
    </div>
  );
}

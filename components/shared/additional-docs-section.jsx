'use client';

/**
 * 📎 AdditionalDocsSection — Section générique d'upload/listing des documents
 * complémentaires d'un exposant. Utilisée :
 *   - dans le tunnel Exposant (Bloc 5)
 *   - dans la fiche admin ARACOM (DocumentsTab)
 *   - dans la fiche Pacific Centers (lecture seule)
 *
 * Props :
 *   - regId         : ID de la registration cible
 *   - documents     : tableau des documents déjà uploadés sur cette reg
 *   - onReload      : callback après upload/suppression
 *   - readonly      : (bool) désactive les actions upload/delete — utile pour Pacific
 *   - title / icon  : personnalisation header
 */

import { useState, useRef } from 'react';
import { toast } from 'sonner';
import {
  Upload, Download, Trash2, Loader2, CloudUpload, Plus, Paperclip,
  Landmark, FileText, FileBadge, CalendarDays, Image as ImageIcon,
  Music, Utensils, UserSquare,
} from 'lucide-react';
import { api } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  EXPOSANT_ADDITIONAL_DOC_TYPES,
  EXPOSANT_ADDITIONAL_DOC_TYPE_MAP,
  RESERVED_DOC_TYPES,
} from '@/lib/exposant-document-types';

const ICON_MAP = {
  Landmark, FileText, FileBadge, CalendarDays, Image: ImageIcon,
  Music, Utensils, UserSquare, Paperclip,
};

function DocRowCard({ doc, label, subtitle, iconKey, iconBg, onUpload, onDelete, onDownload, uploading, readonly }) {
  const inputRef = useRef(null);
  const [drag, setDrag] = useState(false);
  const Icon = ICON_MAP[iconKey] || Paperclip;
  const hasFile = !!doc;

  const tone = hasFile ? 'border-emerald-300 bg-emerald-50/60' : 'border-slate-200 bg-white';

  return (
    <div className={`rounded-lg border-2 ${tone} p-3`}>
      <div className="flex items-start gap-2.5">
        <div className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${iconBg}`}>
          <Icon className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="min-w-0">
              <div className="font-semibold text-sm text-slate-900 truncate">{label}</div>
              {subtitle && <div className="text-[11px] text-slate-500">{subtitle}</div>}
            </div>
            {hasFile && (
              <Badge className="text-[9px] h-4 px-1.5 bg-emerald-100 text-emerald-800 border-emerald-300">✓ Reçu</Badge>
            )}
          </div>

          {hasFile ? (
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <span className="text-[11px] text-slate-700 truncate max-w-[220px] italic">📎 {doc.file_name}</span>
              <Button size="sm" variant="outline" onClick={onDownload} className="h-7 text-[10px] gap-1">
                <Download className="w-3 h-3" /> Télécharger
              </Button>
              {!readonly && (
                <>
                  <Button size="sm" variant="outline" onClick={() => inputRef.current?.click()} disabled={uploading} className="h-7 text-[10px] gap-1">
                    {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />} Remplacer
                  </Button>
                  <Button size="sm" variant="ghost" onClick={onDelete} className="h-7 text-[10px] gap-1 text-red-600 hover:bg-red-50">
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </>
              )}
            </div>
          ) : (
            !readonly && (
              <div
                className={`mt-2 rounded-md border-2 border-dashed text-center px-3 py-2.5 text-[11px] cursor-pointer transition ${
                  drag ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:bg-slate-50'
                }`}
                onClick={() => !uploading && inputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
                onDragLeave={() => setDrag(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDrag(false);
                  const f = e.dataTransfer.files?.[0];
                  if (f) onUpload(f);
                }}
              >
                {uploading ? (
                  <span className="inline-flex items-center gap-1.5 text-slate-600"><Loader2 className="w-3 h-3 animate-spin" /> Upload…</span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-slate-600">
                    <CloudUpload className="w-3.5 h-3.5" />
                    Glissez ou cliquez pour parcourir <span className="text-slate-400">(PDF/JPG/PNG/DOCX • 10 Mo)</span>
                  </span>
                )}
              </div>
            )
          )}
          {readonly && !hasFile && (
            <div className="text-[11px] text-slate-400 italic mt-2">— Non fourni —</div>
          )}
          <input
            type="file"
            ref={inputRef}
            className="hidden"
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
            onChange={(e) => onUpload(e.target.files?.[0])}
          />
        </div>
      </div>
    </div>
  );
}

export default function AdditionalDocsSection({
  regId,
  documents = [],
  onReload,
  readonly = false,
  title = '📎 Documents complémentaires',
  collapsedByDefault = false,
  // 🆕 SESSION 53.21 — Filtre des types activés par ARACOM
  //   - undefined / null = pas de filtre (vue admin/fiche) — tous types affichés
  //   - [] = aucun type activé (vue exposant si rien activé)
  //   - ['rib','statuts'] = seuls ces types affichés
  enabledTypes = undefined,
}) {
  const [busyKey, setBusyKey] = useState(null);
  const [showCustom, setShowCustom] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customFile, setCustomFile] = useState(null);
  const [open, setOpen] = useState(!collapsedByDefault);
  const customInputRef = useRef(null);

  // Index docs by document_type (uniquement les types "complémentaires" + custom name)
  const additionalDocs = (documents || []).filter((d) => !RESERVED_DOC_TYPES.has(d.document_type));
  const docsByType = additionalDocs.reduce((acc, d) => {
    if (!acc[d.document_type]) acc[d.document_type] = d;
    return acc;
  }, {});
  const customDocs = additionalDocs.filter((d) => !EXPOSANT_ADDITIONAL_DOC_TYPE_MAP[d.document_type] || d.document_type === 'autre');

  const upload = async (docType, file, displayName) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error('Fichier trop volumineux (max 10 Mo)'); return; }
    setBusyKey(docType);
    try {
      const reader = new FileReader();
      const dataUrl = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file);
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
          display_name: displayName || null,
        }),
      });
      toast.success(`✅ ${displayName || EXPOSANT_ADDITIONAL_DOC_TYPE_MAP[docType]?.label || 'Document'} uploadé`);
      onReload?.();
    } catch (e) {
      toast.error(e?.message || 'Erreur upload');
    } finally {
      setBusyKey(null);
    }
  };

  const handleDelete = async (doc) => {
    if (!doc?.id || !confirm('Supprimer ce document ?')) return;
    try {
      await api(`/api/registration-documents/${doc.id}`, { method: 'DELETE' });
      toast.success('Document supprimé');
      onReload?.();
    } catch (e) { toast.error(e.message); }
  };

  const handleDownload = (doc) => {
    if (!doc?.id) return;
    window.open(`/api/documents/${doc.id}/download`, '_blank');
  };

  const submitCustom = async () => {
    if (!customName.trim() || !customFile) {
      toast.error('Nom du document + fichier requis');
      return;
    }
    // Custom doc: use slug from name as document_type
    const slug = 'autre_' + customName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 40) + '_' + Date.now().toString(36);
    await upload(slug, customFile, customName.trim());
    setCustomName(''); setCustomFile(null); setShowCustom(false);
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-slate-50 rounded-t-lg"
      >
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm text-slate-900">{title}</span>
          <Badge className="text-[10px] bg-slate-100 text-slate-700 border-slate-300">{additionalDocs.length}</Badge>
        </div>
        <span className="text-slate-400 text-xs">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-2">
          <div className="text-[11px] text-slate-500 italic mb-2">
            {readonly
              ? '👁️ Lecture seule — vous pouvez télécharger les pièces déjà reçues.'
              : 'Ajoutez ici toute pièce utile pour compléter la base ARACOM (visible également par Pacific Centers).'}
          </div>
          {/* Liste des types standard (filtrée si enabledTypes fourni) */}
          {EXPOSANT_ADDITIONAL_DOC_TYPES
            .filter((t) => t.key !== 'autre')
            .filter((t) => {
              // Si enabledTypes est fourni (mode exposant) : filtre.
              // Si null/undefined (mode admin) : tout afficher.
              // Si readonly : afficher ceux qui ont un doc OU ceux activés (pour Pacific)
              if (enabledTypes === undefined || enabledTypes === null) return true;
              const hasDoc = !!docsByType[t.key];
              const isEnabled = enabledTypes.includes(t.key);
              return isEnabled || hasDoc; // toujours montrer si déjà rempli
            })
            .map((t) => (
            <DocRowCard
              key={t.key}
              doc={docsByType[t.key]}
              label={t.label}
              subtitle={t.subtitle}
              iconKey={t.icon}
              iconBg={t.iconBg}
              uploading={busyKey === t.key}
              readonly={readonly}
              onUpload={(f) => upload(t.key, f)}
              onDelete={() => handleDelete(docsByType[t.key])}
              onDownload={() => handleDownload(docsByType[t.key])}
            />
          ))}

          {/* Documents custom déjà uploadés (autre_xxx) */}
          {customDocs.filter((d) => d.document_type.startsWith('autre_') || d.document_type === 'autre').map((d) => (
            <DocRowCard
              key={d.id}
              doc={d}
              label={d.display_name || d.file_name || 'Autre document'}
              subtitle="Document personnalisé"
              iconKey="Paperclip"
              iconBg="bg-slate-400"
              uploading={false}
              readonly={readonly}
              onUpload={(f) => upload(d.document_type, f, d.display_name)}
              onDelete={() => handleDelete(d)}
              onDownload={() => handleDownload(d)}
            />
          ))}

          {/* Ajouter un document libre */}
          {!readonly && (
            <div className="rounded-md border-2 border-dashed border-slate-300 p-2.5">
              {!showCustom ? (
                <Button size="sm" variant="outline" onClick={() => setShowCustom(true)} className="w-full h-8 text-xs gap-1.5">
                  <Plus className="w-3.5 h-3.5" /> Ajouter un autre document (nom libre)
                </Button>
              ) : (
                <div className="space-y-2">
                  <Input
                    placeholder="Nom du document (ex: Devis prestataire)"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    className="h-8 text-xs"
                  />
                  <div className="flex items-center gap-2">
                    <input
                      ref={customInputRef}
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                      onChange={(e) => setCustomFile(e.target.files?.[0] || null)}
                      className="hidden"
                    />
                    <Button size="sm" variant="outline" onClick={() => customInputRef.current?.click()} className="h-8 text-xs gap-1.5">
                      <Upload className="w-3.5 h-3.5" />
                      {customFile ? customFile.name.slice(0, 25) : 'Choisir un fichier'}
                    </Button>
                    <Button size="sm" onClick={submitCustom} disabled={!customName.trim() || !customFile || busyKey} className="h-8 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white">
                      {busyKey ? <Loader2 className="w-3 h-3 animate-spin" /> : '✅'} Uploader
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => { setShowCustom(false); setCustomName(''); setCustomFile(null); }} className="h-8 text-xs">
                      Annuler
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {readonly && additionalDocs.length === 0 && (
            <div className="text-xs text-slate-400 italic text-center py-3">Aucun document complémentaire fourni</div>
          )}
        </div>
      )}
    </div>
  );
}

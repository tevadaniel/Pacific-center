'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, Camera, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { chunkedUpload } from '@/lib/chunked-upload';

// 🆕 SESSION 41 — Limites élargies pour fichiers volumineux via chunked upload
const DEFAULT_MAX_SIZE = 200 * 1024 * 1024; // 200 MB (PDF/images)
const VIDEO_MAX_SIZE = 500 * 1024 * 1024;   // 500 MB (vidéos)
const CHUNKED_THRESHOLD = 3 * 1024 * 1024;  // >3 MB → upload chunké (évite limites ingress)

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = r.result;
      const comma = s.indexOf(',');
      resolve(comma >= 0 ? s.slice(comma + 1) : s);
    };
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

/**
 * FileUploadButton — gère upload de fichiers jusqu'à 200 MB (500 MB vidéos)
 *
 * 🆕 Pour les fichiers > 3 MB, utilise automatiquement l'upload chunké
 *   (chunks de 2 MB → /api/uploads/chunk puis /api/uploads/finalize)
 *   pour contourner les limites du proxy Kubernetes & garantir un upload fiable.
 *
 * Props supplémentaires pour chunked upload :
 *   - registrationId : id de l'inscription (passé au backend pour Drive folder)
 *   - documentType   : type de document (assurance, devis, photo, etc.)
 */
export function FileUploadButton({
  onUpload,
  accept = 'image/*,application/pdf',
  capture = false,
  label = 'Ajouter un fichier',
  icon,
  variant = 'outline',
  className = '',
  maxSize = null,
  registrationId = null,
  documentType = null,
}) {
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);

  const handle = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const isVideo = (f.type || '').startsWith('video/');
    const limit = maxSize || (isVideo ? VIDEO_MAX_SIZE : DEFAULT_MAX_SIZE);
    if (f.size > limit) {
      const limitMb = Math.round(limit / (1024 * 1024));
      const fileMb = (f.size / (1024 * 1024)).toFixed(1);
      toast.error(`Fichier trop volumineux : ${fileMb} Mo (max ${limitMb} Mo)`);
      return;
    }
    setBusy(true);
    setProgress(0);
    const fileMb = (f.size / (1024 * 1024)).toFixed(1);
    const useChunked = f.size > CHUNKED_THRESHOLD;
    const t = toast.loading(useChunked
      ? `Upload chunké (${fileMb} Mo) — 0%`
      : `Upload en cours (${fileMb} Mo)…`);
    try {
      if (useChunked) {
        // 🆕 Upload chunké : envoie en morceaux de 2 MB
        const result = await chunkedUpload(f, {
          registrationId,
          documentType,
          onProgress: (pct) => {
            setProgress(pct);
            toast.loading(`Upload (${fileMb} Mo) — ${pct}%`, { id: t });
          },
        });
        // result peut contenir file_data (base64) OU drive_meta
        await onUpload({
          file_data: result.file_data || null,
          file_name: result.file_name || f.name,
          mime_type: result.mime_type || f.type,
          size_bytes: result.size_bytes || f.size,
          drive_file_id: result.drive_file_id || null,
          drive_view_link: result.drive_view_link || null,
          drive_download_link: result.drive_download_link || null,
          stored_in_drive: result.stored_in_drive || false,
        });
      } else {
        // Petit fichier → flow classique base64
        const base64 = await fileToBase64(f);
        await onUpload({ file_data: base64, file_name: f.name, mime_type: f.type, size_bytes: f.size });
      }
      toast.success('Fichier uploadé ✅', { id: t });
    } catch (err) {
      console.error('[FileUploadButton]', err);
      toast.error('Erreur upload : ' + (err?.message || 'inconnue'), { id: t });
    }
    setBusy(false);
    setProgress(0);
    if (ref.current) ref.current.value = '';
  };

  const Icon = icon || (capture ? Camera : Upload);
  return (
    <>
      <input ref={ref} type="file" accept={accept} capture={capture ? 'environment' : undefined} className="hidden" onChange={handle} />
      <Button type="button" variant={variant} className={`gap-2 ${className}`} onClick={() => ref.current?.click()} disabled={busy}>
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon className="w-4 h-4" />}
        {busy && progress > 0 ? `${label} · ${progress}%` : label}
      </Button>
    </>
  );
}

export function MediaThumb({ src, name, onDelete }) {
  const isImg = src?.match(/\.(jpe?g|png|gif|webp|heic)/i) || !src?.match(/\.(pdf|docx?|xlsx?)/i);
  return (
    <div className="relative group rounded-md border overflow-hidden bg-slate-50">
      {isImg ? <img src={src} alt={name} className="w-full h-28 object-cover" /> : (
        <div className="h-28 flex items-center justify-center text-xs text-slate-500">{name}</div>
      )}
      {onDelete && (
        <button onClick={onDelete} className="absolute top-1 right-1 bg-white/90 hover:bg-white rounded-full p-1 shadow opacity-0 group-hover:opacity-100 transition">
          <X className="w-3 h-3 text-red-600" />
        </button>
      )}
      <div className="absolute bottom-0 inset-x-0 bg-black/50 text-white text-[10px] px-2 py-1 truncate">{name}</div>
    </div>
  );
}

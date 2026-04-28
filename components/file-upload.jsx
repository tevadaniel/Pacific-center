'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, Camera, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const DEFAULT_MAX_SIZE = 10 * 1024 * 1024; // 10 MB par défaut (images / docs)
const VIDEO_MAX_SIZE = 80 * 1024 * 1024; // 80 MB pour les vidéos

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

export function FileUploadButton({ onUpload, accept = 'image/*,application/pdf', capture = false, label = 'Ajouter un fichier', icon, variant = 'outline', className = '', maxSize = null }) {
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);
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
    const t = toast.loading(isVideo ? `Upload vidéo (${(f.size / (1024 * 1024)).toFixed(1)} Mo)…` : 'Upload en cours…');
    try {
      const base64 = await fileToBase64(f);
      await onUpload({ file_data: base64, file_name: f.name, mime_type: f.type, size_bytes: f.size });
      toast.success('Fichier uploadé', { id: t });
    } catch (err) {
      toast.error('Erreur upload : ' + err.message, { id: t });
    }
    setBusy(false);
    if (ref.current) ref.current.value = '';
  };
  const Icon = icon || (capture ? Camera : Upload);
  return (
    <>
      <input ref={ref} type="file" accept={accept} capture={capture ? 'environment' : undefined} className="hidden" onChange={handle} />
      <Button type="button" variant={variant} className={`gap-2 ${className}`} onClick={() => ref.current?.click()} disabled={busy}>
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon className="w-4 h-4" />} {label}
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

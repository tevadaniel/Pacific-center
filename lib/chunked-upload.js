'use client';

/**
 * 🆕 SESSION 41 — Chunked Upload Client Helper
 *
 * Découpe un File en chunks de 2 MB et les envoie séquentiellement à
 * /api/uploads/chunk, puis appelle /api/uploads/finalize pour assembler
 * et router vers Google Drive (>4 MB) ou MongoDB base64 (<4 MB).
 *
 * Supporte fichiers jusqu'à ~500 MB.
 *
 * Usage :
 *   const result = await chunkedUpload(file, {
 *     registrationId: 'reg-xxx',
 *     documentType: 'assurance',
 *     onProgress: (pct) => setProgress(pct), // 0..100
 *   });
 *   // result = { file_data, file_name, mime_type, size_bytes, drive_file_id?, drive_view_link?, stored_in_drive? }
 */

const CHUNK_SIZE = 2 * 1024 * 1024; // 2 MB — bien en-dessous de toutes les limites ingress

function genUploadId() {
  // UUID-like id (suffisant pour usage temporaire)
  return 'upl-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

async function postFormData(url, formData, token) {
  const headers = {};
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const r = await fetch(url, { method: 'POST', body: formData, headers });
  if (!r.ok) {
    const text = await r.text();
    throw new Error(`Chunk upload failed (${r.status}): ${text.slice(0, 200)}`);
  }
  return r.json();
}

async function postJson(url, payload, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const r = await fetch(url, { method: 'POST', body: JSON.stringify(payload), headers });
  if (!r.ok) {
    const text = await r.text();
    throw new Error(`Finalize failed (${r.status}): ${text.slice(0, 200)}`);
  }
  return r.json();
}

/**
 * @param {File} file - Le fichier à uploader
 * @param {object} opts
 * @param {string} [opts.registrationId]
 * @param {string} [opts.documentType]
 * @param {(pct:number)=>void} [opts.onProgress]
 * @returns {Promise<object>} - Métadonnées (file_data | drive_*)
 */
export async function chunkedUpload(file, opts = {}) {
  const { registrationId, documentType, onProgress } = opts;
  const uploadId = genUploadId();
  const totalChunks = Math.max(1, Math.ceil(file.size / CHUNK_SIZE));

  // Token pour auth (admin OR exposant)
  let token = null;
  if (typeof window !== 'undefined') {
    token = localStorage.getItem('aracom_token')
      || localStorage.getItem('exposant_token')
      || sessionStorage.getItem('aracom_token')
      || null;
  }

  // 1) Envoie chaque chunk séquentiellement (séquentiel = plus stable que parallèle pour les gros fichiers)
  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, file.size);
    const blob = file.slice(start, end);
    const fd = new FormData();
    fd.append('uploadId', uploadId);
    fd.append('chunkIndex', String(i));
    fd.append('totalChunks', String(totalChunks));
    fd.append('data', blob, `chunk-${i}`);
    await postFormData('/api/uploads/chunk', fd, token);
    if (onProgress) onProgress(Math.round(((i + 1) / totalChunks) * 95)); // 95% pour l'upload, garde 5% pour finalize
  }

  // 2) Finalize : assemble + upload Drive
  const result = await postJson('/api/uploads/finalize', {
    uploadId,
    fileName: file.name,
    mimeType: file.type || 'application/octet-stream',
    registrationId: registrationId || null,
    documentType: documentType || null,
  }, token);

  if (onProgress) onProgress(100);
  return result;
}

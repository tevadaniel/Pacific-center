// Google Drive helper — Service Account authentication
// Used to upload Jour J photos/videos to a structured folder hierarchy
// in the user's Drive.
//
// Env vars:
//   GOOGLE_SERVICE_ACCOUNT_FILE  — path to JSON credentials file
//   GOOGLE_DRIVE_ROOT_FOLDER_ID  — root "Forum Rentrée 2026" folder ID
import { google } from 'googleapis';
import fs from 'fs';
import { Readable } from 'stream';

const FOLDER_MIME = 'application/vnd.google-apps.folder';

let _drive = null;
let _saEmail = null;

export function isDriveConfigured() {
  return Boolean((process.env.GOOGLE_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_SERVICE_ACCOUNT_FILE) && process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID);
}

export function getRootFolderId() {
  return process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID || '';
}

/**
 * Lazy-init the Drive client. Cached per process.
 * Loads credentials from either:
 *   - GOOGLE_SERVICE_ACCOUNT_JSON (env var with full JSON content) — preferred for prod
 *   - GOOGLE_SERVICE_ACCOUNT_FILE (path to a JSON file on disk) — dev/local
 */
export async function getDriveClient() {
  if (_drive) return _drive;
  let credentials = null;
  // 1) Try env var with JSON content
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    try {
      credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
    } catch (e) {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON: JSON invalide — ' + e.message);
    }
  } else {
    // 2) Fallback to file on disk
    const file = process.env.GOOGLE_SERVICE_ACCOUNT_FILE;
    if (!file) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON ou GOOGLE_SERVICE_ACCOUNT_FILE requis');
    if (!fs.existsSync(file)) throw new Error('Fichier de credentials introuvable: ' + file);
    credentials = JSON.parse(fs.readFileSync(file, 'utf-8'));
  }
  _saEmail = credentials.client_email;
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
  const authClient = await auth.getClient();
  _drive = google.drive({ version: 'v3', auth: authClient });
  return _drive;
}

export function getServiceAccountEmail() {
  return _saEmail;
}

/**
 * Find a sub-folder by exact name under a parent. Returns id or null.
 */
async function findChildFolder(drive, parentId, name) {
  const escName = name.replace(/'/g, "\\'");
  const q = `'${parentId}' in parents and name='${escName}' and mimeType='${FOLDER_MIME}' and trashed=false`;
  const r = await drive.files.list({
    q, fields: 'files(id,name)', pageSize: 5, supportsAllDrives: true, includeItemsFromAllDrives: true,
  });
  return r.data.files?.[0]?.id || null;
}

async function createFolder(drive, parentId, name) {
  const r = await drive.files.create({
    requestBody: { name, mimeType: FOLDER_MIME, parents: [parentId] },
    fields: 'id,name',
    supportsAllDrives: true,
  });
  return r.data.id;
}

/**
 * Ensure the path of folders exists (mkdir -p style). Returns the leaf folder id.
 * @param {string[]} parts - e.g., ["Photos Jour J", "2026-08-14", "Arue", "I Mua Papeete - A-C01"]
 */
export async function ensureFolderPath(parts) {
  const drive = await getDriveClient();
  let currentId = getRootFolderId();
  if (!currentId) throw new Error('GOOGLE_DRIVE_ROOT_FOLDER_ID non configuré');
  for (const p of parts) {
    if (!p || !p.trim()) continue;
    let id = await findChildFolder(drive, currentId, p);
    if (!id) id = await createFolder(drive, currentId, p);
    currentId = id;
  }
  return currentId;
}

/**
 * Upload a file (Buffer) into a Drive folder. Returns file metadata.
 */
export async function uploadFile({ folderId, fileName, mimeType, buffer }) {
  const drive = await getDriveClient();
  const stream = Readable.from(buffer);
  const r = await drive.files.create({
    requestBody: { name: fileName, parents: [folderId] },
    media: { mimeType: mimeType || 'application/octet-stream', body: stream },
    fields: 'id,name,webViewLink,webContentLink,thumbnailLink,size,mimeType,createdTime',
    supportsAllDrives: true,
  });
  return r.data;
}

/**
 * Make a file readable by anyone with the link (anyoneWithLink reader).
 * Useful so the app can display images embedded.
 */
export async function makeAnyoneReader(fileId) {
  const drive = await getDriveClient();
  try {
    await drive.permissions.create({
      fileId,
      requestBody: { role: 'reader', type: 'anyone' },
      supportsAllDrives: true,
    });
  } catch (e) {
    // Already shared or not authorized — ignore
  }
}

/**
 * List files in a folder.
 */
export async function listFolderFiles(folderId, { pageSize = 100 } = {}) {
  const drive = await getDriveClient();
  const r = await drive.files.list({
    q: `'${folderId}' in parents and trashed=false`,
    fields: 'files(id,name,mimeType,size,createdTime,webViewLink,thumbnailLink)',
    pageSize,
    orderBy: 'createdTime desc',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  return r.data.files || [];
}

/**
 * Validate that the service account has access to the root folder.
 */
export async function validateAccess() {
  const drive = await getDriveClient();
  const folderId = getRootFolderId();
  const r = await drive.files.get({
    fileId: folderId,
    fields: 'id,name,mimeType,driveId,owners(emailAddress,displayName)',
    supportsAllDrives: true,
  });
  return {
    ok: true,
    folder_id: r.data.id,
    folder_name: r.data.name,
    is_folder: r.data.mimeType === FOLDER_MIME,
    service_account_email: _saEmail,
  };
}

/**
 * Sanitize a string for Drive file/folder name.
 */
export function safeName(s) {
  return String(s || '')
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120) || 'sans-nom';
}

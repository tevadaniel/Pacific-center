/**
 * 🆕 SESSION 45 — Générateur de TEMPLATE exhaustif de la base de données
 *
 * - Introspecte TOUTES les collections MongoDB
 * - Pour chaque collection : analyse un échantillon de documents pour détecter les types
 * - Produit :
 *    • JSON skeleton (1 par collection)
 *    • CSV vierge (1 par collection, en-têtes = champs)
 *    • Documentation Markdown complète
 *    • Un fichier global `_README.md` avec liste des collections et leur cardinalité
 * - Le tout zippé en `db-template-YYYYMMDD-HHmmss.zip`
 *
 * 🆕 Mode `withData=true` → exporte AUSSI tous les documents de chaque collection
 *    en JSON complet + CSV peuplé. Utile pour fusion / migration / archive.
 */

import JSZip from 'jszip';

/** Détection du type d'une valeur (sample) */
function detectType(value) {
  if (value === null || value === undefined) return 'null';
  if (Array.isArray(value)) {
    if (value.length === 0) return 'array';
    return `array<${detectType(value[0])}>`;
  }
  if (value instanceof Date) return 'date';
  const t = typeof value;
  if (t === 'object') {
    if (value._bsontype === 'ObjectID' || value.constructor?.name === 'ObjectId') return 'ObjectId';
    return 'object';
  }
  return t; // string, number, boolean
}

/** Agrège les types observés sur tous les documents d'une collection */
function buildFieldSchema(samples) {
  const fields = new Map();
  for (const doc of samples) {
    if (!doc || typeof doc !== 'object') continue;
    for (const [k, v] of Object.entries(doc)) {
      if (!fields.has(k)) fields.set(k, { name: k, types: new Set(), samples: [], nonNullCount: 0 });
      const f = fields.get(k);
      f.types.add(detectType(v));
      if (v !== null && v !== undefined && v !== '') {
        f.nonNullCount += 1;
        if (f.samples.length < 3) {
          let s = v;
          if (v instanceof Date) s = v.toISOString();
          if (typeof v === 'string' && v.length > 80) s = v.slice(0, 80) + '…';
          if (Array.isArray(v) && v.length > 3) s = [...v.slice(0, 3), `…(+${v.length - 3})`];
          if (typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date)) {
            try { s = JSON.stringify(v).slice(0, 80); } catch { s = '[object]'; }
          }
          f.samples.push(s);
        }
      }
    }
  }
  return Array.from(fields.values()).map((f) => ({
    name: f.name,
    types: Array.from(f.types),
    nonNullCount: f.nonNullCount,
    samples: f.samples,
  }));
}

/** Crée un squelette JSON vide pour une collection */
function emptySkeletonFromSchema(schema) {
  const sk = {};
  for (const f of schema) {
    if (f.name === '_id') continue;
    const t = (f.types[0] || 'string').replace(/<.*>/, '');
    if (t.startsWith('array')) sk[f.name] = [];
    else if (t === 'object') sk[f.name] = {};
    else if (t === 'date') sk[f.name] = null;
    else if (t === 'number') sk[f.name] = 0;
    else if (t === 'boolean') sk[f.name] = false;
    else if (t === 'null') sk[f.name] = null;
    else sk[f.name] = '';
  }
  return sk;
}

/** Catégorise les collections pour les regrouper dans le README */
const COLLECTION_CATEGORIES = {
  '🏢 Référentiels métier': ['venues', 'venue_stands', 'venue_elements', 'editions', 'visit_slots', 'roles'],
  '👥 Exposants & contacts': ['organizations', 'organization_contacts', 'organization_preferences', 'organization_history', 'registrations', 'registration_documents', 'registration_anomalies', 'stand_assignments'],
  '🎭 Animations': ['animation_slots', 'animation_slots_archive'],
  '💰 Cautions & paiements': ['deposit_transactions', 'caution_appointments'],
  '✉ Communication & emails': ['email_messages', 'email_campaigns', 'mail_templates', 'mail_recipient_lists'],
  '📄 Documents': ['documents', 'official_documents', 'upload_chunks'],
  '🔐 Authentification & accès': ['users', 'access_tokens', 'modification_tokens', 'modification_requests', 'validation_requests'],
  '📊 Suivi & événements': ['attendance_sessions', 'attendance_events', 'post_event_reports', 'satisfaction_surveys', 'satisfaction_responses', 'field_media', 'field_comments', 'tasks_or_followups'],
  '⚙ Système & logs': ['app_config', 'app_settings', 'activity_logs', 'audit_logs', 'backups', 'deleted_org_ledger', 'prospects'],
};

function categoryOf(colName) {
  for (const [cat, list] of Object.entries(COLLECTION_CATEGORIES)) {
    if (list.includes(colName)) return cat;
  }
  return '📦 Divers';
}

/**
 * Génère le ZIP complet du template DB et retourne un Buffer.
 */
export async function buildDbTemplate({ db, includeSamples = true } = {}) {
  const allCols = await db.listCollections().toArray();
  const collections = allCols.map((c) => c.name).sort();

  const zip = new JSZip();
  const jsonFolder = zip.folder('json-skeletons');
  const csvFolder = zip.folder('csv-templates');
  const docsFolder = zip.folder('docs');

  const summaryRows = []; // pour README
  const fullMd = []; // doc markdown complète

  fullMd.push('# 📘 Schéma complet de la base de données — Forum de la Rentrée 2026');
  fullMd.push('');
  fullMd.push(`> Généré le **${new Date().toISOString()}**`);
  fullMd.push(`> Total : **${collections.length} collections** MongoDB.`);
  fullMd.push('');
  fullMd.push('## 📋 Sommaire par catégorie');
  fullMd.push('');

  // Build per-collection
  const perCollection = [];
  for (const colName of collections) {
    const count = await db.collection(colName).countDocuments();
    const sampleDocs = await db.collection(colName).find({}).limit(20).toArray();
    const schema = buildFieldSchema(sampleDocs);
    const category = categoryOf(colName);
    perCollection.push({ name: colName, count, schema, sampleDocs, category });
    summaryRows.push({ name: colName, count, category, fields: schema.length });
  }

  // README global
  const readme = [];
  readme.push('# 📦 Template Base de Données — Forum de la Rentrée 2026');
  readme.push('');
  readme.push(`> Généré le **${new Date().toISOString()}**`);
  readme.push('');
  readme.push('## 📁 Structure du dossier');
  readme.push('');
  readme.push('- `docs/SCHEMA.md` — Documentation complète et détaillée de toutes les collections');
  readme.push('- `docs/SCHEMA.json` — Schéma machine-readable (utile pour les imports automatisés)');
  readme.push('- `json-skeletons/<collection>.json` — Squelette JSON vide à remplir, un par collection');
  readme.push('- `csv-templates/<collection>.csv` — Template CSV (en-tête uniquement) à remplir dans Excel/Sheets');
  readme.push('');
  readme.push('## 🔑 Règles importantes pour la fusion');
  readme.push('');
  readme.push('1. **IDs (champs `id`)** : tous les documents utilisent des UUIDs (string) comme clé primaire. NE PAS utiliser les `_id` MongoDB (générés automatiquement à l\'import).');
  readme.push('2. **Relations entre collections** :');
  readme.push('   - `registrations.organization_id` → `organizations.id`');
  readme.push('   - `registrations.venue_id` → `venues.id`');
  readme.push('   - `registrations.stand_code` → `venue_stands.stand_code` (couplé à `venue_id`)');
  readme.push('   - `animation_slots.registration_id` → `registrations.id`');
  readme.push('   - `animation_slots.venue_id` → `venues.id`');
  readme.push('   - `deposit_transactions.registration_id` → `registrations.id`');
  readme.push('   - `users.organization_id` → `organizations.id` (pour les exposants)');
  readme.push('   - `access_tokens.organization_id` → `organizations.id`');
  readme.push('3. **Dates** : format ISO 8601 (ex: `"2026-08-14T10:00:00.000Z"`).');
  readme.push('4. **Statuts d\'inscription** : `prospect | a_relancer | a_confirmer | confirme | liste_attente | annule`.');
  readme.push('5. **Jours du forum** : `vendredi` = 2026-08-14, `samedi` = 2026-08-15.');
  readme.push('');
  readme.push('## 📊 Vue d\'ensemble par catégorie');
  readme.push('');

  // Group summary by category
  const grouped = new Map();
  for (const r of summaryRows) {
    if (!grouped.has(r.category)) grouped.set(r.category, []);
    grouped.get(r.category).push(r);
  }
  for (const [cat, list] of grouped.entries()) {
    readme.push(`### ${cat}`);
    readme.push('');
    readme.push('| Collection | Documents | Champs |');
    readme.push('|---|---:|---:|');
    for (const r of list) {
      readme.push(`| \`${r.name}\` | ${r.count} | ${r.fields} |`);
    }
    readme.push('');
  }

  zip.file('_README.md', readme.join('\n'));

  // Markdown SCHEMA full
  fullMd.push(...Array.from(grouped.entries()).map(([cat, list]) => `- ${cat} — ${list.length} collection(s)`));
  fullMd.push('');
  for (const [cat, list] of grouped.entries()) {
    fullMd.push('---');
    fullMd.push(`# ${cat}`);
    fullMd.push('');
    for (const r of list) {
      const col = perCollection.find((p) => p.name === r.name);
      if (!col) continue;
      fullMd.push(`## \`${col.name}\` _(${col.count} docs)_`);
      fullMd.push('');
      fullMd.push('| Champ | Type(s) | Non-null | Exemple |');
      fullMd.push('|---|---|---:|---|');
      for (const f of col.schema) {
        if (f.name === '_id') continue;
        const sample = f.samples[0] !== undefined ? '`' + String(f.samples[0]).replace(/\|/g, '\\|').slice(0, 60) + '`' : '—';
        fullMd.push(`| \`${f.name}\` | ${f.types.join(' / ')} | ${f.nonNullCount} | ${sample} |`);
      }
      fullMd.push('');
    }
  }
  docsFolder.file('SCHEMA.md', fullMd.join('\n'));

  // SCHEMA.json (machine-readable)
  const schemaJson = perCollection.map((c) => ({
    collection: c.name,
    category: c.category,
    document_count: c.count,
    fields: c.schema.map((f) => ({ name: f.name, types: f.types, non_null_count: f.nonNullCount, samples: f.samples })),
  }));
  docsFolder.file('SCHEMA.json', JSON.stringify(schemaJson, null, 2));

  // Per-collection JSON skeleton + CSV
  for (const col of perCollection) {
    const sk = emptySkeletonFromSchema(col.schema);
    const skJson = { _doc: `Squelette pour la collection ${col.name}. Remplissez les champs et importez via /api/admin/db-template/import (à venir).`, _fields_count: col.schema.length, ...sk };
    jsonFolder.file(`${col.name}.json`, JSON.stringify(skJson, null, 2));

    // CSV avec headers
    const fieldsNoId = col.schema.filter((f) => f.name !== '_id').map((f) => f.name);
    const csvHeader = fieldsNoId.join(',');
    // Une ligne d'exemple (si includeSamples)
    let csv = csvHeader + '\n';
    if (includeSamples && col.sampleDocs.length > 0) {
      const ex = col.sampleDocs[0];
      const row = fieldsNoId.map((k) => {
        const v = ex[k];
        if (v === null || v === undefined) return '';
        if (v instanceof Date) return v.toISOString();
        if (typeof v === 'object') return JSON.stringify(v).replace(/"/g, '""');
        const s = String(v).replace(/"/g, '""');
        return s.includes(',') || s.includes('\n') || s.includes('"') ? `"${s}"` : s;
      });
      csv += row.join(',') + '\n';
    }
    csvFolder.file(`${col.name}.csv`, csv);
  }

  const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } });
  return buf;
}

/**
 * 🆕 SESSION 45 — Extraction COMPLÈTE de la DB (template + toutes les données)
 *   - data/<collection>.json : tous les documents en JSON (Array)
 *   - data/<collection>.csv  : tous les documents en CSV (lignes peuplées)
 *   - docs/SCHEMA.md         : doc complète
 *   - _README.md             : sommaire + cardinalité + relations
 *   - _MANIFEST.json         : métadonnées de l'export
 */
export async function buildDbExtraction({ db } = {}) {
  const allCols = await db.listCollections().toArray();
  const collections = allCols.map((c) => c.name).sort();

  const zip = new JSZip();
  const dataJsonFolder = zip.folder('data-json');
  const dataCsvFolder = zip.folder('data-csv');
  const docsFolder = zip.folder('docs');

  const manifest = {
    exported_at: new Date().toISOString(),
    edition: '2026',
    source: 'forum-rentree-2026',
    collections: [],
    total_documents: 0,
    total_collections: collections.length,
  };

  const fullMd = ['# 📘 Schéma complet de la base de données — Forum 2026 (extraction avec données)', '', `> Généré le **${new Date().toISOString()}**`, ''];
  const readme = ['# 📦 Extraction complète de la base — Forum 2026', '', `> Date : **${new Date().toISOString()}**`, '', '## 📁 Contenu', '', '- `data-json/<collection>.json` — Tous les documents de chaque collection (format JSON natif, prêt pour `mongoimport`).', '- `data-csv/<collection>.csv` — Mêmes données en CSV (lignes peuplées, en-têtes inclus).', '- `docs/SCHEMA.md` — Documentation des collections, champs, types et exemples.', '- `_MANIFEST.json` — Métadonnées de l\'export (date, cardinalités, hashes).', '', '## ⚙ Réimport via mongoimport (par collection)', '', '```bash', 'for f in data-json/*.json; do', '  col=$(basename "$f" .json)', '  mongoimport --uri "$MONGO_URL" --db your_db --collection "$col" --file "$f" --jsonArray --upsert', 'done', '```', '', '## 🔑 Règles de fusion', '', '- **Clés primaires** : champ `id` (UUID string). Ne pas réimporter `_id`.', '- **Relations** : voir `docs/SCHEMA.md`.', '- **Dates** : format ISO 8601.', '', '## 📊 Cardinalités', '', '| Collection | Documents |', '|---|---:|'];

  fullMd.push('## 📋 Sommaire');
  fullMd.push('');

  for (const colName of collections) {
    const docs = await db.collection(colName).find({}).toArray();
    const count = docs.length;
    // Strip _id (mongo internal) — on garde le champ id business
    const cleaned = docs.map((d) => { const { _id, ...rest } = d; return rest; });

    // JSON
    dataJsonFolder.file(`${colName}.json`, JSON.stringify(cleaned, null, 2));

    // CSV
    const schema = buildFieldSchema(cleaned.slice(0, 20));
    const fields = schema.filter((f) => f.name !== '_id').map((f) => f.name);
    const csvLines = [fields.join(',')];
    for (const doc of cleaned) {
      const row = fields.map((k) => {
        const v = doc[k];
        if (v === null || v === undefined) return '';
        if (v instanceof Date) return v.toISOString();
        if (typeof v === 'object') {
          const s = JSON.stringify(v).replace(/"/g, '""');
          return `"${s}"`;
        }
        const s = String(v).replace(/"/g, '""');
        return (s.includes(',') || s.includes('\n') || s.includes('"')) ? `"${s}"` : s;
      });
      csvLines.push(row.join(','));
    }
    dataCsvFolder.file(`${colName}.csv`, csvLines.join('\n'));

    // Manifest
    manifest.collections.push({ name: colName, document_count: count, fields_count: fields.length });
    manifest.total_documents += count;

    // Markdown schema
    fullMd.push(`### \`${colName}\` _(${count} docs · ${fields.length} champs)_`);
    fullMd.push('');
    if (schema.length > 0) {
      fullMd.push('| Champ | Type(s) | Non-null | Exemple |');
      fullMd.push('|---|---|---:|---|');
      for (const f of schema) {
        if (f.name === '_id') continue;
        const sample = f.samples[0] !== undefined ? '`' + String(f.samples[0]).replace(/\|/g, '\\|').slice(0, 60) + '`' : '—';
        fullMd.push(`| \`${f.name}\` | ${f.types.join(' / ')} | ${f.nonNullCount} | ${sample} |`);
      }
    }
    fullMd.push('');

    readme.push(`| \`${colName}\` | ${count} |`);
  }

  readme.push('');
  readme.push(`**TOTAL : ${manifest.total_documents} documents** sur **${manifest.total_collections} collections**.`);

  zip.file('_README.md', readme.join('\n'));
  zip.file('_MANIFEST.json', JSON.stringify(manifest, null, 2));
  docsFolder.file('SCHEMA.md', fullMd.join('\n'));

  const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } });
  return { buf, total_documents: manifest.total_documents, total_collections: manifest.total_collections };
}

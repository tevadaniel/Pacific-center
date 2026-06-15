'use client';

import { useState, useRef } from 'react';
import { toast } from 'sonner';
import { FileText, RefreshCw, Download, CheckCircle2, AlertTriangle, Eye } from 'lucide-react';
import { api, getSession } from '@/lib/auth-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

/**
 * 🚨 FUSION 2026 — WIPE & RELOAD depuis le fichier Excel master
 * /app/data-imports/forum-fusion-2026.xlsx (déposé par admin technique).
 * DESTRUCTIF : efface tout sauf admins, venues, app_settings.
 */
function FusionMasterImport() {
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(null);
  const [applied, setApplied] = useState(null);

  const runPreview = async () => {
    setBusy(true);
    try {
      const r = await api('/api/admin/import-fusion-2026', { method: 'POST', body: JSON.stringify({ dry_run: true }) });
      setPreview(r.preview);
      setApplied(null);
      toast.success(`Aperçu : ${r.preview.total} exposants détectés`);
    } catch (e) { toast.error(e.message); }
    setBusy(false);
  };

  const runApply = async () => {
    if (!confirm('🚨 OPÉRATION DESTRUCTIVE\n\nVous allez :\n• EFFACER les 91 inscriptions actuelles + leurs documents/animations/cautions/validations\n• Importer les 72 exposants historiques depuis le fichier Excel\n• Conserver : comptes admin, sites/venues, templates RIB/convention\n\nCONTINUER ?')) return;
    if (!confirm('⚠️ DOUBLE CONFIRMATION\n\nCette action est IRRÉVERSIBLE en préview. Tapez OK si vous êtes certain.')) return;
    setBusy(true);
    const tid = toast.loading('Import en cours…');
    try {
      const r = await api('/api/admin/import-fusion-2026', {
        method: 'POST',
        body: JSON.stringify({ confirm: 'JE-VEUX-VRAIMENT-EFFACER-TOUTES-LES-DONNEES' }),
      });
      toast.dismiss(tid);
      setApplied(r);
      setPreview(null);
      toast.success(r.message || '✅ Import terminé');
    } catch (e) { toast.dismiss(tid); toast.error(e.message); }
    setBusy(false);
  };

  return (
    <Card className="border-2 border-red-300 bg-gradient-to-br from-red-50 to-orange-50">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2 text-red-900">
          🚨 IMPORT FUSION 2026 (destructif — base BDD Fusion master)
        </CardTitle>
        <p className="text-xs text-red-800 mt-1">
          Source : <code className="bg-white px-1 rounded">/app/data-imports/forum-fusion-2026.xlsx</code> · Sheet : <b>📋 BASE EXPOSANTS</b> (72 historiques 2019-2025).
          <br/>Wipe complet puis recréation des organisations + registrations « à confirmer » + comptes exposants. La feuille Prospection 2026 est <b>ignorée</b>.
          <br/>Conservés : comptes admin, sites/venues, templates RIB/convention/guide.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2 flex-wrap">
          <Button onClick={runPreview} disabled={busy} variant="outline" className="gap-2 border-blue-400 text-blue-700 hover:bg-blue-50">
            <Eye className="w-4 h-4" /> Aperçu (dry-run, ne touche pas la base)
          </Button>
          <Button onClick={runApply} disabled={busy} className="bg-red-600 hover:bg-red-700 text-white gap-2">
            <AlertTriangle className="w-4 h-4" /> Wipe & Reload — IMPORT RÉEL
          </Button>
        </div>

        {preview && (
          <div className="bg-white rounded-md border border-blue-200 p-3 text-xs">
            <div className="font-bold text-blue-900 mb-2">📊 Aperçu — {preview.total} exposants détectés</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
              <div className="bg-blue-50 rounded p-2"><div className="text-[10px] uppercase text-blue-700">Avec email</div><div className="font-bold text-lg text-blue-900">{preview.with_email}</div></div>
              <div className="bg-amber-50 rounded p-2"><div className="text-[10px] uppercase text-amber-700">Sans email</div><div className="font-bold text-lg text-amber-900">{preview.without_email}</div></div>
              {Object.entries(preview.by_fidelity).map(([k, v]) => (
                <div key={k} className="bg-slate-50 rounded p-2"><div className="text-[10px] uppercase text-slate-600">{k}</div><div className="font-bold text-lg text-slate-900">{v}</div></div>
              ))}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-3">
              {Object.entries(preview.by_site_historique).map(([k, v]) => (
                <div key={k} className="border rounded p-2 bg-white"><span className="text-slate-500">{k}</span> : <b>{v}</b></div>
              ))}
            </div>
            <div className="font-semibold text-slate-700 mb-1">Exemples :</div>
            <ul className="space-y-0.5 ml-4 list-disc">
              {(preview.sample || []).map((s, i) => (
                <li key={i}><b>{s.name}</b> — {s.contact || '?'} · {s.email || 'pas d\'email'} · {s.fidelity || '—'} · {s.site || '—'}</li>
              ))}
            </ul>
          </div>
        )}

        {applied && (
          <div className="bg-emerald-50 rounded-md border border-emerald-300 p-3 text-xs">
            <div className="font-bold text-emerald-900 flex items-center gap-2 mb-2"><CheckCircle2 className="w-4 h-4" /> {applied.message}</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <div className="bg-white rounded p-2"><div className="text-[10px] uppercase text-slate-500">Organisations</div><div className="font-bold text-lg text-emerald-700">{applied.stats?.created?.organizations}</div></div>
              <div className="bg-white rounded p-2"><div className="text-[10px] uppercase text-slate-500">Registrations</div><div className="font-bold text-lg text-emerald-700">{applied.stats?.created?.registrations}</div></div>
              <div className="bg-white rounded p-2"><div className="text-[10px] uppercase text-slate-500">Users exposants</div><div className="font-bold text-lg text-emerald-700">{applied.stats?.created?.users}</div></div>
              <div className="bg-white rounded p-2"><div className="text-[10px] uppercase text-slate-500">Historiques</div><div className="font-bold text-lg text-emerald-700">{applied.stats?.created?.organization_history}</div></div>
            </div>
            <details className="mt-3">
              <summary className="cursor-pointer text-emerald-800 font-semibold">Voir le détail technique du wipe</summary>
              <pre className="mt-2 bg-slate-900 text-emerald-300 p-2 rounded overflow-auto text-[10px]">{JSON.stringify(applied.stats?.wipe || {}, null, 2)}</pre>
            </details>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * IMPORT EXCEL VIEW — Import des exposants depuis un fichier .xlsx.
 * Endpoint : POST /api/import/exposants-excel (FormData).
 */
export default function ImportExcelView() {
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const inputRef = useRef(null);

  const runImport = async () => {
    if (!file) { toast.error('Choisissez un fichier .xlsx'); return; }
    if (!confirm(`Lancer l'import depuis "${file.name}" ?\n\nOpération :\n- Les exposants existants seront enrichis (contact, historique, conventions, cautions, animations, remarques)\n- Les nouveaux exposants historiques seront créés avec le statut "prospect"\n- Les contacts mailing seuls seront créés avec statut "mailing_only"\n\nContinuer ?`)) return;
    setBusy(true);
    const toastId = toast.loading('Import en cours… parsing du fichier puis écriture en base');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const sess = getSession();
      const res = await fetch('/api/import/exposants-excel', {
        method: 'POST', body: fd,
        headers: { 'x-user-id': (sess?.id || 'u-admin'), 'x-user-role': (sess?.role || sess?.role_code || 'aracom_admin') },
      });
      const data = await res.json();
      toast.dismiss(toastId);
      if (!res.ok) throw new Error(data.error || 'Erreur');
      setResult(data);
      toast.success('✅ Import terminé — ' + data.summary.matched_and_updated + ' enrichies, ' + data.summary.new_prospects_created + ' prospects créés');
    } catch (e) {
      toast.dismiss(toastId);
      toast.error('Erreur : ' + e.message);
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <FusionMasterImport />
      <Card className="border-2 border-violet-200 bg-gradient-to-br from-violet-50 to-fuchsia-50">
        <CardContent className="p-5 flex items-start gap-4 flex-wrap">
          <div className="w-16 h-16 rounded-lg bg-white shadow-md flex items-center justify-center shrink-0">
            <FileText className="w-8 h-8 text-violet-600" />
          </div>
          <div className="flex-1 min-w-[280px]">
            <h2 className="font-bold text-violet-900 text-lg">Import exposants depuis Excel</h2>
            <p className="text-sm text-violet-800 mt-1">
              Uploadez un fichier <b>.xlsx</b> pour enrichir la base avec les historiques (présences par année, conventions, cautions, animations, remarques ARACOM) et créer les nouveaux prospects.
            </p>
            <ul className="text-[12px] text-violet-700 mt-2 list-disc pl-5 space-y-0.5">
              <li>Les historiques privés sont visibles uniquement par ARACOM (jamais par les exposants).</li>
              <li>Les exposants sont matchés automatiquement par nom (algorithme flou, strict ≥ 75% de similarité).</li>
              <li>Les doublons détectés gardent la ligne la plus riche (nb d&apos;éditions max).</li>
              <li>Formats supportés : colonnes nommées &quot;Exposant&quot;, &quot;Activité&quot;, &quot;Email&quot;, &quot;Téléphone&quot;, &quot;Contact&quot;, &quot;2019/2020/2023/2024/2025&quot;, &quot;Fidélité&quot;, &quot;Convention 2025&quot;, &quot;Caution 2025&quot;, &quot;Animation 2024/2025&quot;, &quot;Remarques&quot;.</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <Label>Sélectionner un fichier Excel (.xlsx)</Label>
          <div className="flex gap-2 mt-2 flex-wrap">
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(e) => { setFile(e.target.files?.[0] || null); setResult(null); }}
              className="flex-1 min-w-[240px] text-sm border rounded-md px-3 py-2"
            />
            <Button onClick={runImport} disabled={busy || !file} className="bg-violet-600 hover:bg-violet-700 gap-2">
              {busy ? <><RefreshCw className="w-4 h-4 animate-spin" /> Import…</> : <><Download className="w-4 h-4 rotate-180" /> Lancer l&apos;import</>}
            </Button>
          </div>
          {file && <div className="text-xs text-slate-600 mt-2">📎 {file.name} · {(file.size / 1024).toFixed(1)} Ko</div>}
        </CardContent>
      </Card>

      {result && (
        <>
          <Card className="border-2 border-emerald-300 bg-emerald-50">
            <CardContent className="p-4">
              <div className="font-bold text-emerald-900 flex items-center gap-2"><CheckCircle2 className="w-5 h-5" /> Import terminé</div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-3">
                <div className="bg-white rounded-md p-2 border"><div className="text-[10px] uppercase text-slate-500">Lignes lues</div><div className="font-bold text-xl text-slate-900">{result.summary.total_rows}</div></div>
                <div className="bg-white rounded-md p-2 border border-emerald-300"><div className="text-[10px] uppercase text-emerald-600">Enrichies</div><div className="font-bold text-xl text-emerald-700">{result.summary.matched_and_updated}</div></div>
                <div className="bg-white rounded-md p-2 border border-blue-300"><div className="text-[10px] uppercase text-blue-600">Prospects créés</div><div className="font-bold text-xl text-blue-700">{result.summary.new_prospects_created}</div></div>
                <div className="bg-white rounded-md p-2 border border-violet-300"><div className="text-[10px] uppercase text-violet-600">Mailing-only</div><div className="font-bold text-xl text-violet-700">{result.summary.new_mailing_contacts_created}</div></div>
                <div className="bg-white rounded-md p-2 border"><div className="text-[10px] uppercase text-slate-500">Ignorées</div><div className="font-bold text-xl text-slate-600">{result.summary.skipped_rows}</div></div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Détail des actions ({result.report?.length || 0})</CardTitle>
            </CardHeader>
            <CardContent className="p-0 max-h-[500px] overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-y text-left text-xs uppercase text-slate-500 sticky top-0">
                  <tr><th className="py-2 px-3">Action</th><th>Excel</th><th>DB</th><th>Fidélité</th><th>Éd.</th></tr>
                </thead>
                <tbody className="divide-y">
                  {(result.report || []).map((r, i) => (
                    <tr key={i}>
                      <td className="px-3 py-1.5">
                        {r.action === 'updated' && <Badge className="bg-emerald-100 text-emerald-800">Enrichie</Badge>}
                        {r.action === 'created' && <Badge className="bg-blue-100 text-blue-800">{r.is_mailing_only ? 'Mailing' : 'Prospect'}</Badge>}
                        {r.action === 'skipped_duplicate_match' && <Badge className="bg-amber-100 text-amber-800">Doublon ignoré</Badge>}
                      </td>
                      <td className="text-xs">{r.excel || r.name}</td>
                      <td className="text-xs text-slate-500">{r.db || '—'}</td>
                      <td className="text-xs">{r.fidelity || '—'}</td>
                      <td className="text-xs text-center">{r.nb_editions ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

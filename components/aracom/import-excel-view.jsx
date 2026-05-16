'use client';

import { useState, useRef } from 'react';
import { toast } from 'sonner';
import { FileText, RefreshCw, Download, CheckCircle2 } from 'lucide-react';
import { getSession } from '@/lib/auth-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

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

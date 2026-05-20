'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Download, FileSpreadsheet, Loader2, Settings2, FileText, Package } from 'lucide-react';
import { api, getSession } from '@/lib/auth-client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';

const STORAGE_KEY = 'fr26_excel_selected_columns';

/**
 * 🆕 SESSION 46 — Carte unifiée "Export & Extraction de la base de données"
 *
 *  Fusionne les anciennes cartes ExcelExportCard + DbTemplateAndExtractionCard.
 *  3 formats disponibles :
 *    1. 📊 Excel (.xlsx)         → multi-onglets normalisés, avec sélecteur de colonnes
 *    2. 📦 Extraction complète   → ZIP de toutes les collections (JSON + CSV + Markdown)
 *    3. 📋 Template vide         → squelettes pour préparer une fusion
 */
export default function UnifiedExportCard() {
  const [allCols, setAllCols] = useState([]);
  const [selected, setSelected] = useState([]);
  const [busy, setBusy] = useState(null); // 'xlsx' | 'zip-data' | 'zip-empty-1' | 'zip-empty-0'
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await api('/api/admin/excel-export/columns');
        const cols = Array.isArray(r?.columns) ? r.columns : [];
        setAllCols(cols);
        const saved = typeof window !== 'undefined' ? sessionStorage.getItem(STORAGE_KEY) : null;
        if (saved) {
          try { setSelected(JSON.parse(saved)); return; } catch { /* */ }
        }
        setSelected(cols.map((c) => c.key));
      } catch { /* */ }
    })();
  }, []);

  const persist = (next) => {
    setSelected(next);
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* */ }
  };

  const toggle = (key) => persist(selected.includes(key) ? selected.filter((k) => k !== key) : [...selected, key]);

  const groups = {};
  allCols.forEach((c) => { (groups[c.group] = groups[c.group] || []).push(c); });

  const selectAll = () => persist(allCols.map((c) => c.key));
  const selectNone = () => persist([]);
  const selectGroup = (g, on) => {
    const inGroup = (groups[g] || []).map((c) => c.key);
    persist(on
      ? Array.from(new Set([...selected, ...inGroup]))
      : selected.filter((k) => !inGroup.includes(k)));
  };

  const buildHeaders = () => {
    const session = getSession();
    const headers = {};
    if (session?.id) headers['x-user-id'] = session.id;
    const role = session?.role || session?.role_code;
    if (role) headers['x-user-role'] = role;
    return headers;
  };

  const downloadBlob = async (path, filename, key, label) => {
    try {
      setBusy(key);
      const res = await fetch(path, { cache: 'no-store', headers: buildHeaders() });
      if (!res.ok) {
        let msg = `Erreur HTTP ${res.status}`;
        try { const j = await res.json(); msg = j.error || msg; } catch { /* */ }
        throw new Error(msg);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      const sizeKo = (blob.size / 1024).toFixed(0);
      toast.success(`✅ ${label} téléchargé (${sizeKo} ko)`);
    } catch (e) {
      toast.error(`Échec : ${e.message}`);
    } finally {
      setBusy(null);
    }
  };

  const ts = () => new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

  const downloadExcel = () => {
    const cols = selected.length > 0 ? selected.join(',') : '';
    const url = `/api/admin/excel-export${cols ? `?columns=${encodeURIComponent(cols)}` : ''}`;
    return downloadBlob(url, `export-exposants-${ts()}.xlsx`, 'xlsx', 'Excel (.xlsx)');
  };

  return (
    <Card className="border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 via-teal-50 to-violet-50">
      <CardContent className="p-5 space-y-4">
        {/* Header */}
        <div className="flex items-start gap-4 flex-wrap">
          <div className="w-16 h-16 rounded-lg bg-white shadow-md flex items-center justify-center shrink-0">
            <Package className="w-8 h-8 text-emerald-600" />
          </div>
          <div className="flex-1 min-w-[280px]">
            <h2 className="font-bold text-emerald-900 text-lg">📦 Export & Extraction de la base de données</h2>
            <p className="text-sm text-emerald-800 mt-1">
              Téléchargez vos données dans le format de votre choix : <b>Excel (.xlsx)</b> structuré pour analyse, <b>extraction complète (ZIP)</b> pour fusion/réimport, ou <b>template vide</b> pour préparer vos propres données.
            </p>
            <p className="text-xs text-emerald-700 mt-1 italic">
              💡 Tous les exports utilisent les mêmes <b>colonnes normalisées</b> · noms cohérents avec le schéma BDD · prêts pour Emergent et tout système externe.
            </p>
          </div>
        </div>

        {/* Sélecteur de colonnes commun aux 3 formats */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-emerald-200 pt-3">
          <span className="text-xs text-slate-600 font-medium">Colonnes incluses :</span>
          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 border">
            {selected.length || allCols.length} / {allCols.length}
          </Badge>
          <Dialog open={showPicker} onOpenChange={setShowPicker}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="gap-1.5 border-emerald-300 text-emerald-700 hover:bg-emerald-100">
                <Settings2 className="w-4 h-4" /> Personnaliser
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
              <DialogHeader>
                <DialogTitle>📋 Colonnes à inclure dans l&apos;export Excel</DialogTitle>
              </DialogHeader>
              <div className="flex items-center gap-2 border-b pb-2">
                <Button size="sm" variant="ghost" onClick={selectAll}>Tout cocher</Button>
                <Button size="sm" variant="ghost" onClick={selectNone}>Tout décocher</Button>
                <div className="ml-auto text-xs text-slate-500">
                  {selected.length} / {allCols.length} sélectionnées
                </div>
              </div>
              <div className="overflow-y-auto flex-1 -mx-1 px-1 space-y-3">
                {Object.entries(groups).map(([groupName, cols]) => {
                  const groupKeys = cols.map((c) => c.key);
                  const allOn = groupKeys.every((k) => selected.includes(k));
                  const someOn = groupKeys.some((k) => selected.includes(k));
                  return (
                    <div key={groupName} className="rounded border bg-slate-50 p-2">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="text-xs font-bold uppercase text-slate-700">{groupName}</div>
                        <label className="flex items-center gap-1.5 text-[11px] text-slate-600 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={allOn}
                            ref={(el) => { if (el) el.indeterminate = !allOn && someOn; }}
                            onChange={(e) => selectGroup(groupName, e.target.checked)}
                          />
                          {allOn ? 'Tout décocher' : 'Tout cocher'}
                        </label>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                        {cols.map((c) => (
                          <label key={c.key} className="flex items-center gap-1.5 text-xs text-slate-700 hover:bg-white rounded px-1.5 py-1 cursor-pointer">
                            <input type="checkbox" checked={selected.includes(c.key)} onChange={() => toggle(c.key)} />
                            <span className="flex-1 truncate">{c.label}</span>
                            <code className="text-[9px] text-slate-400 font-mono">{c.key}</code>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              <DialogFooter className="border-t pt-2">
                <Button onClick={() => setShowPicker(false)} className="bg-emerald-600 hover:bg-emerald-700">
                  Valider la sélection
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <span className="text-[10px] text-slate-500 ml-auto italic hidden sm:inline">
            La sélection s&apos;applique à l&apos;onglet Exposants_flat de l&apos;Excel.
          </span>
        </div>

        {/* 3 cartes de format côte à côte */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Format Excel */}
          <div className="rounded-md border-2 border-emerald-300 bg-white p-3 flex flex-col">
            <div className="flex items-start gap-2 mb-2">
              <div className="w-10 h-10 rounded-md bg-emerald-100 flex items-center justify-center shrink-0">
                <FileSpreadsheet className="w-5 h-5 text-emerald-700" />
              </div>
              <div className="flex-1">
                <div className="font-bold text-emerald-900 text-sm">📊 Excel (.xlsx)</div>
                <div className="text-[11px] text-slate-600 leading-snug mt-0.5">
                  Multi-onglets : Exposants_flat, Stands, Animations, Cautions, Documents, Validations, Organisations. Headers normalisés en ligne 1.
                </div>
              </div>
            </div>
            <Button
              size="sm"
              disabled={!!busy}
              onClick={downloadExcel}
              className="w-full bg-emerald-600 hover:bg-emerald-700 gap-1.5 mt-auto"
            >
              {busy === 'xlsx' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Télécharger Excel
            </Button>
          </div>

          {/* Format Extraction ZIP */}
          <div className="rounded-md border-2 border-fuchsia-300 bg-white p-3 flex flex-col">
            <div className="flex items-start gap-2 mb-2">
              <div className="w-10 h-10 rounded-md bg-fuchsia-100 flex items-center justify-center shrink-0">
                <Package className="w-5 h-5 text-fuchsia-700" />
              </div>
              <div className="flex-1">
                <div className="font-bold text-fuchsia-900 text-sm">📦 Extraction complète (ZIP)</div>
                <div className="text-[11px] text-slate-600 leading-snug mt-0.5">
                  Toutes les <b>45 collections</b> + tous les documents en JSON natif + CSV. Réimportable via <code>mongoimport</code>.
                </div>
              </div>
            </div>
            <Button
              size="sm"
              disabled={!!busy}
              onClick={() => downloadBlob('/api/admin/db-extraction', `db-extraction-${ts()}.zip`, 'zip-data', 'Extraction complète')}
              className="w-full bg-fuchsia-600 hover:bg-fuchsia-700 gap-1.5 mt-auto"
            >
              {busy === 'zip-data' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Extraction ZIP
            </Button>
          </div>

          {/* Format Template ZIP */}
          <div className="rounded-md border-2 border-violet-300 bg-white p-3 flex flex-col">
            <div className="flex items-start gap-2 mb-2">
              <div className="w-10 h-10 rounded-md bg-violet-100 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5 text-violet-700" />
              </div>
              <div className="flex-1">
                <div className="font-bold text-violet-900 text-sm">📋 Template vide (ZIP)</div>
                <div className="text-[11px] text-slate-600 leading-snug mt-0.5">
                  Squelettes JSON + CSV vides à remplir, avec liste exhaustive des champs et types. Documentation Markdown incluse.
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-1.5 mt-auto">
              <Button
                size="sm"
                disabled={!!busy}
                onClick={() => downloadBlob('/api/admin/db-template', `db-template-${ts()}.zip`, 'zip-empty-1', 'Template (avec exemples)')}
                className="w-full bg-violet-600 hover:bg-violet-700 gap-1.5"
              >
                {busy === 'zip-empty-1' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                Avec exemples
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!!busy}
                onClick={() => downloadBlob('/api/admin/db-template?samples=0', `db-template-empty-${ts()}.zip`, 'zip-empty-0', 'Template vierge')}
                className="w-full border-violet-300 text-violet-700 hover:bg-violet-100 gap-1.5"
              >
                {busy === 'zip-empty-0' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                100 % vierge
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

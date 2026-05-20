'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Download, FileSpreadsheet, Loader2, Settings2 } from 'lucide-react';
import { api, getSession } from '@/lib/auth-client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';

const STORAGE_KEY = 'fr26_excel_selected_columns';

/**
 * 🆕 SESSION 45 — Carte d'export Excel exhaustif avec sélecteur de colonnes
 *  - Multi-onglets : Exposants_flat + Stands + Animations + Cautions + Documents + Validations + Organisations
 *  - Sélecteur de colonnes (cases à cocher) pour Exposants_flat, mémorisé en sessionStorage
 */
export default function ExcelExportCard() {
  const [allCols, setAllCols] = useState([]);
  const [selected, setSelected] = useState([]);
  const [busy, setBusy] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  // Charger les colonnes disponibles + restaurer la sélection sessionStorage
  useEffect(() => {
    (async () => {
      try {
        const r = await api('/api/admin/excel-export/columns');
        const cols = Array.isArray(r?.columns) ? r.columns : [];
        setAllCols(cols);
        const saved = typeof window !== 'undefined' ? sessionStorage.getItem(STORAGE_KEY) : null;
        if (saved) {
          try { setSelected(JSON.parse(saved)); return; } catch { /* ignore */ }
        }
        setSelected(cols.map((c) => c.key));
      } catch {
        // pas grave : on laisse vide → endpoint exportera tout par défaut
      }
    })();
  }, []);

  const persist = (next) => {
    setSelected(next);
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* */ }
  };

  const toggle = (key) => {
    const next = selected.includes(key) ? selected.filter((k) => k !== key) : [...selected, key];
    persist(next);
  };

  const groups = {};
  allCols.forEach((c) => { (groups[c.group] = groups[c.group] || []).push(c); });

  const selectAll = () => persist(allCols.map((c) => c.key));
  const selectNone = () => persist([]);
  const selectGroup = (g, on) => {
    const inGroup = (groups[g] || []).map((c) => c.key);
    if (on) persist(Array.from(new Set([...selected, ...inGroup])));
    else persist(selected.filter((k) => !inGroup.includes(k)));
  };

  const download = async () => {
    try {
      setBusy(true);
      const session = getSession();
      const headers = {};
      if (session?.id) headers['x-user-id'] = session.id;
      const role = session?.role || session?.role_code;
      if (role) headers['x-user-role'] = role;
      const cols = selected.length > 0 ? selected.join(',') : '';
      const url = `/api/admin/excel-export${cols ? `?columns=${encodeURIComponent(cols)}` : ''}`;
      const res = await fetch(url, { cache: 'no-store', headers });
      if (!res.ok) {
        let msg = `Erreur HTTP ${res.status}`;
        try { const j = await res.json(); msg = j.error || msg; } catch { /* */ }
        throw new Error(msg);
      }
      const blob = await res.blob();
      const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const dl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = dl;
      a.download = `export-exposants-${ts}.xlsx`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(dl), 1500);
      const sizeKo = (blob.size / 1024).toFixed(0);
      toast.success(`📊 Excel téléchargé (${sizeKo} ko · ${selected.length || 'toutes'} colonne·s)`);
    } catch (e) {
      toast.error(`Échec : ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50">
      <CardContent className="p-5 space-y-3">
        <div className="flex items-start gap-4 flex-wrap">
          <div className="w-16 h-16 rounded-lg bg-white shadow-md flex items-center justify-center shrink-0">
            <FileSpreadsheet className="w-8 h-8 text-emerald-600" />
          </div>
          <div className="flex-1 min-w-[280px]">
            <h2 className="font-bold text-emerald-900 text-lg">📊 Export Excel Dashboard</h2>
            <p className="text-sm text-emerald-800 mt-1">
              Téléchargez un fichier <b>.xlsx multi-onglets</b> structuré et lisible par Emergent :
              Exposants_flat (vue plate avec colonnes sélectionnées), Stands, Animations, Cautions, Documents, Validations, Organisations.
            </p>
            <p className="text-xs text-emerald-700 mt-1">
              💡 Headers normalisés en ligne 1 · noms de champs cohérents avec le schéma BDD · pas de cellules fusionnées.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 border">
            {selected.length || allCols.length} / {allCols.length} colonnes
          </Badge>

          <Dialog open={showPicker} onOpenChange={setShowPicker}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="gap-1.5 border-emerald-300 text-emerald-700 hover:bg-emerald-100">
                <Settings2 className="w-4 h-4" /> Choisir les colonnes
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
              <DialogHeader>
                <DialogTitle>📋 Sélection des colonnes Excel (onglet Exposants_flat)</DialogTitle>
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
                            <input
                              type="checkbox"
                              checked={selected.includes(c.key)}
                              onChange={() => toggle(c.key)}
                            />
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

          <Button size="sm" disabled={busy} onClick={download} className="bg-emerald-600 hover:bg-emerald-700 gap-1.5 ml-auto">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Télécharger Excel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

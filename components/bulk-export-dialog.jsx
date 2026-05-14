'use client';

import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Download, FileText, Wallet, Package, Search, Loader2 } from 'lucide-react';

/**
 * Dialog de téléchargement groupé des documents (Conventions + Reçus de caution)
 * Permet de filtrer par site, par exposant, et de choisir le type de document.
 *
 * Props :
 * - open, onOpenChange : contrôle du Dialog
 * - rows : liste des exposants (registrations enrichies — { id, org_name, venue_id, venue_name, stand_code, status })
 * - venues : liste des sites — { id, name }
 */
export default function BulkExportDialog({ open, onOpenChange, rows = [], venues = [] }) {
  const [type, setType] = useState('all'); // conventions | receipts | all
  const [selectedSites, setSelectedSites] = useState(() => new Set(['all']));
  const [selectedRegs, setSelectedRegs] = useState(() => new Set(['all']));
  const [search, setSearch] = useState('');
  const [downloading, setDownloading] = useState(false);

  // Reset state on close
  React.useEffect(() => {
    if (!open) {
      setType('all');
      setSelectedSites(new Set(['all']));
      setSelectedRegs(new Set(['all']));
      setSearch('');
    }
  }, [open]);

  const sitesAllChecked = selectedSites.has('all');
  const regsAllChecked = selectedRegs.has('all');

  const toggleSite = (id) => {
    setSelectedSites(prev => {
      const next = new Set(prev);
      if (id === 'all') {
        return new Set(['all']);
      }
      next.delete('all');
      if (next.has(id)) next.delete(id); else next.add(id);
      if (next.size === 0) next.add('all');
      return next;
    });
  };

  const toggleReg = (id) => {
    setSelectedRegs(prev => {
      const next = new Set(prev);
      if (id === 'all') {
        return new Set(['all']);
      }
      next.delete('all');
      if (next.has(id)) next.delete(id); else next.add(id);
      if (next.size === 0) next.add('all');
      return next;
    });
  };

  // Filter rows according to selected sites + search
  const filteredRows = useMemo(() => {
    let list = rows;
    if (!sitesAllChecked) {
      list = list.filter(r => selectedSites.has(r.venue_id));
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(r =>
        (r.org_name || '').toLowerCase().includes(q) ||
        (r.stand_code || '').toLowerCase().includes(q) ||
        (r.venue_name || '').toLowerCase().includes(q),
      );
    }
    return list;
  }, [rows, selectedSites, sitesAllChecked, search]);

  // Compute final count to be downloaded
  const finalCount = useMemo(() => {
    if (regsAllChecked) return filteredRows.length;
    return filteredRows.filter(r => selectedRegs.has(r.id)).length;
  }, [filteredRows, selectedRegs, regsAllChecked]);

  const docsPerExposant = type === 'all' ? 2 : 1;
  const totalDocs = finalCount * docsPerExposant;

  const handleDownload = async () => {
    if (finalCount === 0) {
      toast.error('Aucun exposant sélectionné.');
      return;
    }
    setDownloading(true);
    const toastId = toast.loading(`Génération de ${totalDocs} document(s) PDF...`);
    try {
      const payload = {
        type,
        site_ids: sitesAllChecked ? ['all'] : Array.from(selectedSites),
        registration_ids: regsAllChecked
          ? (sitesAllChecked ? ['all'] : filteredRows.map(r => r.id))
          : Array.from(selectedRegs),
      };

      const res = await fetch('/api/admin/export-documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include',
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || `Erreur ${res.status}`);
      }

      const conv = res.headers.get('X-Documents-Conventions') || '0';
      const rec = res.headers.get('X-Documents-Receipts') || '0';
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const disp = res.headers.get('Content-Disposition') || '';
      const m = disp.match(/filename="([^"]+)"/);
      a.download = m ? m[1] : `Export_Documents_${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      toast.success(`Archive ZIP téléchargée — ${conv} convention(s) · ${rec} reçu(s)`, { id: toastId });
      onOpenChange(false);
    } catch (e) {
      toast.error(`Échec du téléchargement : ${e.message}`, { id: toastId });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-orange-600" />
            Téléchargement groupé de documents
          </DialogTitle>
          <DialogDescription>
            Génère un fichier ZIP contenant les Conventions de participation et/ou les Reçus de caution
            des exposants sélectionnés (PDFs pré-remplis).
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-5 px-1">
          {/* TYPE DE DOCUMENTS */}
          <div>
            <Label className="text-sm font-semibold mb-2 block">📄 Type de documents</Label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 'conventions', label: 'Conventions',      icon: FileText, color: 'border-blue-500 bg-blue-50' },
                { value: 'receipts',    label: 'Reçus de caution', icon: Wallet,   color: 'border-green-500 bg-green-50' },
                { value: 'all',         label: 'Les deux',         icon: Package,  color: 'border-orange-500 bg-orange-50' },
              ].map(opt => {
                const Icon = opt.icon;
                const active = type === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setType(opt.value)}
                    className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition ${
                      active ? opt.color : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <Icon className={`w-5 h-5 ${active ? 'text-slate-800' : 'text-slate-400'}`} />
                    <span className={`text-sm font-medium ${active ? 'text-slate-900' : 'text-slate-600'}`}>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* FILTRE SITES */}
          <div>
            <Label className="text-sm font-semibold mb-2 block">📍 Sites</Label>
            <div className="border rounded-lg p-3 bg-slate-50 max-h-44 overflow-y-auto space-y-1">
              <label className="flex items-center gap-2 p-1 rounded hover:bg-white cursor-pointer">
                <Checkbox checked={sitesAllChecked} onCheckedChange={() => toggleSite('all')} />
                <span className="text-sm font-semibold">🌐 Tous les sites</span>
                <Badge variant="outline" className="ml-auto text-xs">{venues.length}</Badge>
              </label>
              <div className="border-t my-1" />
              {venues.map(v => {
                const checked = !sitesAllChecked && selectedSites.has(v.id);
                const count = rows.filter(r => r.venue_id === v.id).length;
                return (
                  <label key={v.id} className="flex items-center gap-2 p-1 rounded hover:bg-white cursor-pointer">
                    <Checkbox checked={checked} onCheckedChange={() => toggleSite(v.id)} />
                    <span className="text-sm">{v.name}</span>
                    <Badge variant="outline" className="ml-auto text-xs">{count}</Badge>
                  </label>
                );
              })}
            </div>
          </div>

          {/* FILTRE EXPOSANTS */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm font-semibold">👥 Exposants</Label>
              <div className="relative w-56">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher…"
                  className="h-8 pl-7 text-sm"
                />
              </div>
            </div>
            <div className="border rounded-lg p-3 bg-slate-50 max-h-64 overflow-y-auto space-y-1">
              <label className="flex items-center gap-2 p-1 rounded hover:bg-white cursor-pointer">
                <Checkbox checked={regsAllChecked} onCheckedChange={() => toggleReg('all')} />
                <span className="text-sm font-semibold">✅ Tous les exposants {sitesAllChecked ? '' : 'des sites filtrés'}</span>
                <Badge variant="outline" className="ml-auto text-xs">{filteredRows.length}</Badge>
              </label>
              <div className="border-t my-1" />
              {filteredRows.length === 0 && (
                <div className="text-sm text-slate-500 italic p-2">Aucun exposant correspond aux filtres.</div>
              )}
              {filteredRows.map(r => {
                const checked = !regsAllChecked && selectedRegs.has(r.id);
                return (
                  <label key={r.id} className="flex items-center gap-2 p-1 rounded hover:bg-white cursor-pointer">
                    <Checkbox checked={checked} onCheckedChange={() => toggleReg(r.id)} />
                    <span className="text-sm flex-1 truncate">{r.org_name || '— Sans nom —'}</span>
                    <Badge variant="outline" className="text-xs">{r.venue_name || '—'}</Badge>
                    <Badge variant="outline" className="text-xs">{r.stand_code || '—'}</Badge>
                  </label>
                );
              })}
            </div>
          </div>

          {/* RÉCAPITULATIF */}
          <div className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-lg p-3">
            <div className="text-xs font-semibold text-orange-800 mb-1 uppercase tracking-wide">📦 Récapitulatif</div>
            <div className="text-sm text-slate-700">
              <b>{finalCount}</b> exposant(s) — <b>{totalDocs}</b> PDF(s) à générer
              {type === 'all'   && ' (Convention + Reçu)'}
              {type === 'conventions' && ' (Convention uniquement)'}
              {type === 'receipts'    && ' (Reçu de caution uniquement)'}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Le fichier ZIP sera organisé par site puis par exposant pour faciliter la distribution.
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={downloading}>Annuler</Button>
          <Button
            onClick={handleDownload}
            disabled={downloading || finalCount === 0}
            className="gap-2 bg-orange-600 hover:bg-orange-700"
          >
            {downloading
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Génération en cours…</>
              : <><Download className="w-4 h-4" /> Télécharger ({totalDocs} PDF)</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

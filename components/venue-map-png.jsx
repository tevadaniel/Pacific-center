'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Move, Plus, Save, Trash2, X, Edit3, RotateCcw, MapPin, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/auth-client';
import { toast } from 'sonner';
import VenueElementsLayer from '@/components/venue-elements-layer';

// 🎨 Fond vierge — l'admin construit son plan en plaçant manuellement les éléments
// (stands, kiosques, commerces, démos, flèches d'entrée) via l'éditeur intégré.
// Le PNG d'arrière-plan a été retiré pour permettre une création libre.
const BG_BY_VENUE = {
  // FAAA: '/plans/faaa_bg.png',  // ⛔ retiré
  // PUN: '/plans/punaauia_bg.png', // ⛔ retiré
  // ARU: '/plans/arue_bg.png',   // ⛔ retiré
  // TAR: '/plans/taravao.png',    // ⛔ retiré
};

// Fond beige uni (sable clair) utilisé quand aucune image PNG n'est définie
const BLANK_BG_COLOR = '#d6c4a8';

// Default layout positions (percentages). Used when stand has no saved position.
// 🆕 Vidé pour partir d'un layout vierge — l'admin place tous les stands manuellement.
const DEFAULT_POSITIONS = {
  // ARU: {...}, TAR: {...}, FAAA: {...}, PUN: {...}  // ⛔ retirés
};

const STATUS_COLORS = {
  confirme: '#10b981',
  a_confirmer: '#f59e0b',
  a_relancer: '#f97316',
  prospect: '#94a3b8',
  libre: '#00AEEF',
};

export default function VenueMapPng({ venue, stands = [], onStandClick, onStandsReload, highlightStandCode, editable = false }) {
  const [search, setSearch] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [positions, setPositions] = useState({}); // stand_code -> {x,y}
  const [draggedCode, setDraggedCode] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [snapEnabled, setSnapEnabled] = useState(true); // 🎯 Toggle UI plus fiable que Shift
  const [alignOpen, setAlignOpen] = useState(false); // 📐 Panneau d'alignement auto
  const [alignParams, setAlignParams] = useState({
    mode: 'grid',       // 'row' | 'column' | 'grid'
    target: 'all',      // 'all' | 'visible' (after search filter)
    cols: 6,            // pour grille
    startX: 15,         // % position de départ X
    startY: 25,         // % position de départ Y
    spacingX: 10,       // % espacement horizontal
    spacingY: 10,       // % espacement vertical
  });
  const containerRef = useRef(null);

  const venueCode = venue?.code;
  const bgUrl = BG_BY_VENUE[venueCode];

  // Initialize positions from stands (DB pos_x,pos_y) or defaults
  // 🆕 Si plusieurs stands sont à la position par défaut (50,50) ou n'ont pas de position,
  // on les répartit automatiquement en grille pour qu'ils soient cliquables individuellement.
  useEffect(() => {
    const map = {};
    const defaults = DEFAULT_POSITIONS[venueCode] || {};
    const standsWithoutPos = [];
    stands.forEach(s => {
      const db = (typeof s.pos_x === 'number' && typeof s.pos_y === 'number') ? { x: s.pos_x, y: s.pos_y } : null;
      const dflt = defaults[s.stand_code];
      if (db) {
        map[s.stand_code] = db;
      } else if (dflt) {
        map[s.stand_code] = dflt;
      } else {
        standsWithoutPos.push(s.stand_code);
      }
    });
    // Auto-grid layout pour les stands sans position : 8 colonnes, espacement régulier
    if (standsWithoutPos.length) {
      const cols = Math.min(8, Math.ceil(Math.sqrt(standsWithoutPos.length * 1.5)));
      const stepX = 70 / cols;
      const stepY = 8;
      const startX = 15;
      const startY = 18;
      standsWithoutPos.forEach((code, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        map[code] = {
          x: +(startX + col * stepX).toFixed(1),
          y: +(startY + row * stepY).toFixed(1),
        };
      });
    }
    setPositions(map);
    setDirty(false);
  }, [stands, venueCode]);

  if (!bgUrl && !venueCode) return null;

  // 🎯 Snap-to-grid : aligne automatiquement sur une grille de 2.5% (40 colonnes / 40 lignes)
  // Le toggle "Snap" dans la barre désactive le snap (placement libre).
  const GRID_STEP = 2.5;
  const snap = (val) => snapEnabled ? Math.round(val / GRID_STEP) * GRID_STEP : +val.toFixed(2);

  const onDragStart = (e, code) => {
    if (!editMode) return;
    setDraggedCode(code);
    e.dataTransfer.effectAllowed = 'move';
  };
  const onDragEnd = (e) => {
    if (!editMode || !draggedCode || !containerRef.current) { setDraggedCode(null); return; }
    const r = containerRef.current.getBoundingClientRect();
    const xRaw = ((e.clientX - r.left) / r.width) * 100;
    const yRaw = ((e.clientY - r.top) / r.height) * 100;
    if (xRaw < 0 || xRaw > 100 || yRaw < 0 || yRaw > 100) { setDraggedCode(null); return; }
    const x = snap(xRaw);
    const y = snap(yRaw);
    setPositions(p => ({ ...p, [draggedCode]: { x, y } }));
    setDirty(true);
    setDraggedCode(null);
  };

  // 🌐 Propage l'état du snap globalement pour que VenueElementsLayer (drag éléments décoratifs) le respecte
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.__VENUE_SNAP_ENABLED = snapEnabled;
    }
  }, [snapEnabled]);

  const savePositions = async () => {
    try {
      const updates = stands.map(s => ({
        id: s.id,
        pos_x: positions[s.stand_code]?.x,
        pos_y: positions[s.stand_code]?.y,
      })).filter(u => u.pos_x != null);
      await api('/api/venue-stands/positions', { method: 'POST', body: JSON.stringify({ updates }) });
      toast.success('Positions sauvegardées');
      setDirty(false);
      onStandsReload && onStandsReload();
    } catch (e) { toast.error(e.message); }
  };

  const resetPositions = () => {
    const defaults = DEFAULT_POSITIONS[venueCode] || {};
    const map = {};
    stands.forEach(s => { map[s.stand_code] = defaults[s.stand_code] || { x: 50, y: 50 }; });
    setPositions(map);
    setDirty(true);
  };

  const clearAllPositions = async () => {
    if (!confirm(`⚠️ Effacer DÉFINITIVEMENT toutes les positions des ${stands.length} stands ET tous les éléments décoratifs (kiosques, démos, commerces, flèches) du site ${venue?.name} ?\n\nVous repartirez d'un fond vierge.`)) return;
    try {
      const r = await api('/api/venue-stands/clear-positions', {
        method: 'POST',
        body: JSON.stringify({ venue_id: venue.id }),
      });
      toast.success(`✅ Plan vidé — ${r.stands_cleared} positions effacées, ${r.elements_deleted} éléments supprimés`);
      onStandsReload && onStandsReload();
      // Force le rechargement des éléments décoratifs
      window.location.reload();
    } catch (e) { toast.error(e.message); }
  };

  // 📐 Alignement automatique : range les stands en ligne, colonne ou grille
  const applyAlignment = () => {
    const filtered = stands.filter(s => alignParams.target === 'all' || s.stand_code.toLowerCase().includes(search.toLowerCase()));
    if (!filtered.length) { toast.error('Aucun stand à aligner'); return; }
    const { mode, cols, startX, startY, spacingX, spacingY } = alignParams;
    const newPositions = { ...positions };
    filtered.forEach((s, i) => {
      let x, y;
      if (mode === 'row') {
        x = startX + i * spacingX;
        y = startY;
      } else if (mode === 'column') {
        x = startX;
        y = startY + i * spacingY;
      } else {
        // grid
        const c = i % cols;
        const r = Math.floor(i / cols);
        x = startX + c * spacingX;
        y = startY + r * spacingY;
      }
      newPositions[s.stand_code] = {
        x: Math.max(2, Math.min(98, +x.toFixed(2))),
        y: Math.max(2, Math.min(98, +y.toFixed(2))),
      };
    });
    setPositions(newPositions);
    setDirty(true);
    toast.success(`✅ ${filtered.length} stand(s) aligné(s) en ${mode === 'row' ? 'ligne horizontale' : mode === 'column' ? 'colonne verticale' : `grille ${cols} colonnes`}. N'oubliez pas de sauver.`);
  };

  const addStand = async () => {
    const code = prompt(`Code du nouveau stand (ex: ${venueCode === 'ARU' ? 'A-C13' : venueCode === 'TAR' ? 'T-D13' : venueCode === 'FAAA' ? 'F-A17' : 'P-B14'}) :`);
    if (!code) return;
    try {
      await api('/api/venue-stands', {
        method: 'POST',
        body: JSON.stringify({ venue_id: venue.id, stand_code: code.trim().toUpperCase(), pos_x: 50, pos_y: 50 }),
      });
      toast.success(`Stand ${code} créé`);
      onStandsReload && onStandsReload();
    } catch (e) { toast.error(e.message); }
  };

  const deleteStand = async (stand) => {
    if (stand.organization) {
      const orgName = stand.organization.name || 'cet exposant';
      if (!confirm(`⚠️ Le stand ${stand.stand_code} est attribué à ${orgName}.\n\nVoulez-vous DÉTACHER ${orgName} ET supprimer ce stand ?\n\n${orgName} restera inscrit(e) mais sans stand attribué (vous pourrez en réassigner un autre plus tard).`)) return;
    } else {
      if (!confirm(`Supprimer définitivement le stand ${stand.stand_code} ?`)) return;
    }
    try {
      // Le backend détache automatiquement les registrations liées + annule les stand_assignments
      await api(`/api/venue-stands/${stand.id}`, { method: 'DELETE' });
      toast.success(`✅ Stand ${stand.stand_code} supprimé`);
      onStandsReload && onStandsReload();
    } catch (e) { toast.error('Erreur de suppression : ' + e.message); }
  };

  const q = search.trim().toLowerCase();

  const counts = (() => {
    const c = { confirme: 0, a_confirmer: 0, a_relancer: 0, prospect: 0, libre: 0 };
    stands.forEach(s => {
      const st = s.organization ? (s.registration_status || 'prospect') : 'libre';
      if (c[st] !== undefined) c[st]++;
    });
    return c;
  })();

  return (
    <div className="space-y-3">
      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input placeholder="Rechercher un stand ou un exposant…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
        {editable && (
          <div className="flex gap-2">
            <Button variant={editMode ? 'default' : 'outline'} size="sm" className="gap-1.5" onClick={() => setEditMode(!editMode)}>
              <Edit3 className="w-3.5 h-3.5" /> {editMode ? 'Quitter édition' : 'Éditer plan'}
            </Button>
            {editMode && (
              <>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={addStand}><Plus className="w-3.5 h-3.5" /> Ajouter</Button>
                <Button variant={alignOpen ? 'default' : 'outline'} size="sm" className="gap-1.5" onClick={() => setAlignOpen(!alignOpen)}>📐 Aligner</Button>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={resetPositions}><RotateCcw className="w-3.5 h-3.5" /> Reset</Button>
                <Button variant="outline" size="sm" className="gap-1.5 text-red-600 border-red-300 hover:bg-red-50" onClick={clearAllPositions}><Trash2 className="w-3.5 h-3.5" /> Tout effacer</Button>
                <Button variant="default" size="sm" className="gap-1.5" disabled={!dirty} onClick={savePositions}><Save className="w-3.5 h-3.5" /> Sauver</Button>
              </>
            )}
          </div>
        )}
      </div>

      {editMode && (
        <div className="text-xs bg-amber-50 border border-amber-200 rounded-md px-3 py-2 text-amber-800 flex flex-wrap items-center gap-3">
          <Move className="w-3.5 h-3.5 inline" /> <b>Mode édition</b>
          <span>•</span>
          <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={snapEnabled}
              onChange={e => setSnapEnabled(e.target.checked)}
              className="w-3.5 h-3.5 cursor-pointer accent-amber-600"
            />
            <span>Aligner sur la grille (snap 2,5%)</span>
          </label>
          <span>•</span>
          <span>Cliquez sur la croix rouge pour supprimer un stand. N&apos;oubliez pas de <b>Sauver</b>.</span>
        </div>
      )}

      {/* 📐 Panneau d'alignement automatique */}
      {editMode && alignOpen && (
        <div className="rounded-md bg-blue-50 border-2 border-blue-300 px-4 py-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-sm text-blue-900">📐 Alignement automatique des stands</h4>
            <button onClick={() => setAlignOpen(false)} className="text-slate-400 hover:text-rose-600">✕</button>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-700 block mb-1">Disposition</label>
              <div className="flex gap-1">
                {[
                  { v: 'row', label: '➡️ Ligne H' },
                  { v: 'column', label: '⬇️ Colonne' },
                  { v: 'grid', label: '⊞ Grille' },
                ].map(opt => (
                  <Button
                    key={opt.v}
                    size="sm"
                    variant={alignParams.mode === opt.v ? 'default' : 'outline'}
                    className="text-[11px] flex-1"
                    onClick={() => setAlignParams(p => ({ ...p, mode: opt.v }))}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-700 block mb-1">Sélection</label>
              <div className="flex gap-1">
                <Button size="sm" variant={alignParams.target === 'all' ? 'default' : 'outline'} className="text-[11px] flex-1" onClick={() => setAlignParams(p => ({ ...p, target: 'all' }))}>
                  Tous ({stands.length})
                </Button>
                <Button size="sm" variant={alignParams.target === 'visible' ? 'default' : 'outline'} className="text-[11px] flex-1" onClick={() => setAlignParams(p => ({ ...p, target: 'visible' }))}>
                  Filtre actuel ({stands.filter(s => s.stand_code.toLowerCase().includes(search.toLowerCase())).length})
                </Button>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-4 gap-3">
            <div>
              <label className="text-[11px] text-slate-600">Position X départ ({alignParams.startX}%)</label>
              <input type="range" min="0" max="90" step="2.5" value={alignParams.startX} onChange={e => setAlignParams(p => ({ ...p, startX: parseFloat(e.target.value) }))} className="w-full accent-blue-600" />
            </div>
            <div>
              <label className="text-[11px] text-slate-600">Position Y départ ({alignParams.startY}%)</label>
              <input type="range" min="0" max="90" step="2.5" value={alignParams.startY} onChange={e => setAlignParams(p => ({ ...p, startY: parseFloat(e.target.value) }))} className="w-full accent-blue-600" />
            </div>
            <div>
              <label className="text-[11px] text-slate-600">Espacement X ({alignParams.spacingX}%)</label>
              <input type="range" min="2.5" max="25" step="2.5" value={alignParams.spacingX} onChange={e => setAlignParams(p => ({ ...p, spacingX: parseFloat(e.target.value) }))} className="w-full accent-blue-600" />
            </div>
            <div>
              <label className="text-[11px] text-slate-600">Espacement Y ({alignParams.spacingY}%)</label>
              <input type="range" min="2.5" max="25" step="2.5" value={alignParams.spacingY} onChange={e => setAlignParams(p => ({ ...p, spacingY: parseFloat(e.target.value) }))} className="w-full accent-blue-600" />
            </div>
          </div>

          {alignParams.mode === 'grid' && (
            <div>
              <label className="text-[11px] text-slate-600">Nombre de colonnes ({alignParams.cols})</label>
              <input type="range" min="2" max="12" step="1" value={alignParams.cols} onChange={e => setAlignParams(p => ({ ...p, cols: parseInt(e.target.value) }))} className="w-full accent-blue-600" />
            </div>
          )}

          <div className="flex items-center gap-2 pt-1 border-t border-blue-200">
            <Button size="sm" variant="default" className="gap-1.5 bg-blue-600 hover:bg-blue-700" onClick={applyAlignment}>
              ✓ Appliquer l&apos;alignement
            </Button>
            <span className="text-[11px] text-slate-600">
              💡 Aperçu instantané sur le plan • Cliquez « Sauver » pour persister en base.
            </span>
          </div>
        </div>
      )}

      {/* 🎯 Barre des outils décoratifs (kiosques, démos, commerces, flèches…) — au-dessus du plan */}
      {editMode && (
        <div id="venue-elements-toolbar" className="rounded-md bg-white border border-slate-200 px-3 py-2 flex flex-wrap items-center gap-2 min-h-[44px]" />
      )}

      {/* 🎯 Barre d'options de l'élément sélectionné — au-dessus du plan, ne masque jamais la zone de travail */}
      {editMode && (
        <div id="venue-element-edit-toolbar" className="min-h-[0] flex items-center" />
      )}

      <div
        ref={containerRef}
        onDragOver={(e) => editMode && e.preventDefault()}
        onDrop={onDragEnd}
        className="relative rounded-xl overflow-hidden border bg-black shadow-lg w-full max-w-full"
        style={{
          aspectRatio: '1600 / 556',
          ...(bgUrl
            ? { backgroundImage: `url(${bgUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
            : { backgroundColor: BLANK_BG_COLOR }),
        }}
      >
        {/* 🎯 Grille de snap visible en mode édition (lignes tous les 2.5% en clair, tous les 10% en plus marqué) */}
        {editMode && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: [
                'linear-gradient(to right, rgba(0,0,0,0.04) 1px, transparent 1px)',
                'linear-gradient(to bottom, rgba(0,0,0,0.04) 1px, transparent 1px)',
                'linear-gradient(to right, rgba(0,0,0,0.10) 1px, transparent 1px)',
                'linear-gradient(to bottom, rgba(0,0,0,0.10) 1px, transparent 1px)',
              ].join(','),
              backgroundSize: '2.5% 2.5%, 2.5% 2.5%, 10% 10%, 10% 10%',
            }}
          />
        )}
        {/* Couche d'éléments décoratifs (zones, kiosques, commerces, flèches, prises) */}
        <VenueElementsLayer venueId={venue?.id} editable={editable} containerRef={containerRef} />

        {stands.map(s => {
          const pos = positions[s.stand_code];
          if (!pos) return null;
          const status = s.organization ? (s.registration_status || 'prospect') : 'libre';
          const color = STATUS_COLORS[status];
          const highlighted = highlightStandCode && s.stand_code === highlightStandCode;
          const matchesSearch = !q ||
            (s.stand_code || '').toLowerCase().includes(q) ||
            (s.organization?.name || '').toLowerCase().includes(q) ||
            (s.organization?.discipline || '').toLowerCase().includes(q);
          return (
            <div
              key={s.id || s.stand_code}
              draggable={editMode}
              onDragStart={e => onDragStart(e, s.stand_code)}
              onClick={(e) => { if (!editMode && onStandClick) { e.stopPropagation(); onStandClick(s); } }}
              className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full text-[9px] font-bold select-none transition-all ${editMode ? 'cursor-move z-20' : onStandClick ? 'cursor-pointer z-10' : 'z-10'} ${highlighted ? 'ring-4 ring-blue-400 ring-offset-1' : ''}`}
              style={{
                left: `${pos.x}%`,
                top: `${pos.y}%`,
                width: '3.5%',
                minWidth: '38px',
                padding: '4px 2px',
                background: color,
                color: '#fff',
                textAlign: 'center',
                boxShadow: editMode ? '0 0 0 2px #fff, 0 0 8px rgba(0,0,0,.4)' : '0 1px 3px rgba(0,0,0,.3)',
                opacity: matchesSearch ? 1 : 0.25,
              }}
              title={s.organization ? `${s.stand_code} — ${s.organization.name} (${s.organization.discipline})` : `${s.stand_code} — Libre`}
            >
              <div className="text-[9px] leading-tight font-mono">{s.stand_code.replace(/^[A-Z]-[A-Z]/, '').replace(/^[A-Z]/, '')}</div>
              {editMode && (
                <button onClick={(e) => { e.stopPropagation(); deleteStand(s); }} className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center hover:scale-110 shadow" title={s.organization ? `Détacher ${s.organization.name} et supprimer ce stand` : 'Supprimer ce stand'}>
                  <X className="w-2.5 h-2.5" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Légende */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 px-2">
        {Object.entries(STATUS_COLORS).map(([k, c]) => (
          <span key={k} className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-full" style={{ background: c }} />
            {{ confirme: 'Confirmé', a_confirmer: 'À confirmer', a_relancer: 'À relancer', prospect: 'Prospect', libre: 'Libre' }[k]}
            <span className="text-slate-400">({counts[k] || 0})</span>
          </span>
        ))}
      </div>
    </div>
  );
}

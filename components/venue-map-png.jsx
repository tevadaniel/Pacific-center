'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Move, Plus, Save, Trash2, X, Edit3, RotateCcw, MapPin, Search, UserMinus } from 'lucide-react';
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
  const [saving, setSaving] = useState(false);
  const [snapEnabled, setSnapEnabled] = useState(true); // 🎯 Toggle UI plus fiable que Shift
  const [alignOpen, setAlignOpen] = useState(false); // 📐 Panneau d'alignement auto
  const [selectedCodes, setSelectedCodes] = useState(() => new Set()); // 🎯 Multi-sélection de stands
  const [alignParams, setAlignParams] = useState({
    mode: 'row',        // 'row' | 'column'  (🧹 simplifié : plus de 'grid')
    startX: 15,         // % position de départ X
    startY: 50,         // % position de départ Y (milieu par défaut pour une ligne horizontale)
    spacing: 6,         // % espacement entre stands (unique, s'applique sur X ou Y selon mode)
  });
  const containerRef = useRef(null);

  const venueCode = venue?.code;
  const bgUrl = BG_BY_VENUE[venueCode];

  // ⚠️ TOUS les hooks DOIVENT être déclarés avant tout early return (Rules of Hooks).

  // Initialize positions from stands (DB pos_x,pos_y) or defaults
  // 🆕 Si plusieurs stands sont à la position par défaut (50,50) ou n'ont pas de position,
  // on les répartit automatiquement en grille pour qu'ils soient cliquables individuellement.
  // 🛡️ MERGE au lieu de REPLACE : on préserve les positions déjà en state React pour les stands
  //    sans pos_x/pos_y DB (évite le "remélange" quand le parent refetch après Sauver).
  useEffect(() => {
    setPositions(prev => {
      const map = { ...prev }; // 🔐 conserve les positions existantes (y compris drag non encore sauvés)
      const defaults = DEFAULT_POSITIONS[venueCode] || {};
      const standsWithoutPos = [];
      stands.forEach(s => {
        const db = (typeof s.pos_x === 'number' && typeof s.pos_y === 'number') ? { x: s.pos_x, y: s.pos_y } : null;
        const dflt = defaults[s.stand_code];
        if (db) {
          // DB fait foi : on écrase le state local
          map[s.stand_code] = db;
        } else if (!map[s.stand_code]) {
          // Pas de position en DB ET pas de position en state → on cherche un défaut puis auto-grid
          if (dflt) map[s.stand_code] = dflt;
          else standsWithoutPos.push(s.stand_code);
        }
        // Sinon : on garde map[s.stand_code] déjà présent (positionné par l'utilisateur)
      });
      // Auto-grid layout UNIQUEMENT pour les stands vraiment sans position : tri alphabétique pour ordre stable
      if (standsWithoutPos.length) {
        standsWithoutPos.sort((a, b) => a.localeCompare(b, 'fr', { numeric: true }));
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
      // 🧹 Retire du state les stands qui n'existent plus (supprimés)
      const activeCodes = new Set(stands.map(s => s.stand_code));
      Object.keys(map).forEach(k => { if (!activeCodes.has(k)) delete map[k]; });
      return map;
    });
    setDirty(false);
  }, [stands, venueCode]);

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

  // 🚨 Avertissement si fermeture d'onglet ou navigation avec des modifications non sauvées
  useEffect(() => {
    if (!editMode) return;
    const handler = (e) => {
      const elementsDirty = typeof window !== 'undefined' && window.__VENUE_ELEMENTS_DIRTY;
      if (dirty || elementsDirty) {
        e.preventDefault();
        e.returnValue = 'Vous avez des modifications non sauvegardées. Voulez-vous vraiment quitter ?';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [editMode, dirty]);

  // ✅ Early return APRÈS tous les hooks (Rules of Hooks respectées)
  if (!bgUrl && !venueCode) return null;

  const savePositions = async () => {
    if (saving) return;
    setSaving(true);
    try {
      // 🛡️ On envoie UNE LIGNE PAR STAND du site, avec la position issue du state React.
      //    Si un stand n'a pas de position en state (cas extrême), on retombe sur son pos_x/pos_y DB.
      //    Si aucun des deux n'est dispo, on ignore ce stand (il garde son état actuel en DB).
      const updates = stands.map(s => {
        const local = positions[s.stand_code];
        const x = (local && typeof local.x === 'number') ? local.x : (typeof s.pos_x === 'number' ? s.pos_x : null);
        const y = (local && typeof local.y === 'number') ? local.y : (typeof s.pos_y === 'number' ? s.pos_y : null);
        if (x == null || y == null) return null;
        return { id: s.id, pos_x: Number(x.toFixed(2)), pos_y: Number(y.toFixed(2)) };
      }).filter(Boolean);
      let standsSaved = 0;
      if (updates.length) {
        const r = await api('/api/venue-stands/positions', { method: 'POST', body: JSON.stringify({ updates }) });
        standsSaved = r.updated || updates.length;
      }
      // 🔗 Sauvegarde UNIFIÉE : on déclenche aussi le save des éléments décoratifs
      let elementsSaved = 0;
      if (typeof window !== 'undefined' && typeof window.__VENUE_ELEMENTS_SAVE_ALL === 'function') {
        try {
          const r2 = await window.__VENUE_ELEMENTS_SAVE_ALL();
          elementsSaved = r2?.elements_saved || 0;
        } catch (e) { /* toast déjà affiché côté enfant */ }
      }
      toast.success(`✅ Plan sauvegardé — ${standsSaved} stand(s) + ${elementsSaved} élément(s) décoratif(s)`);
      setDirty(false);
      // 🔕 Pas de reload : state local déjà synchronisé.
    } catch (e) { toast.error('Erreur sauvegarde : ' + e.message); }
    finally { setSaving(false); }
  };

  const resetPositions = () => {
    const defaults = DEFAULT_POSITIONS[venueCode] || {};
    const map = {};
    stands.forEach(s => { map[s.stand_code] = defaults[s.stand_code] || { x: 50, y: 50 }; });
    setPositions(map);
    setDirty(true);
  };

  // 🆕 Session 14 : "Vider le plan" libère seulement les stands de leurs exposants.
  // Les positions visuelles et les éléments décoratifs restent INTACTS (la mise en page est préservée).
  const clearAllPositions = async () => {
    if (!confirm(`🔓 Libérer TOUS les stands du site ${venue?.name} ?\n\nLes ${stands.length} stand(s) seront détachés de leurs exposants actuels (les inscriptions liées passeront en "stand non attribué").\n\n✅ Les positions des stands et les éléments décoratifs (kiosques, démos, commerces, flèches) sont CONSERVÉS — la mise en page reste intacte.`)) return;
    try {
      const r = await api('/api/venue-stands/clear-positions', {
        method: 'POST',
        body: JSON.stringify({ venue_id: venue.id }),
      });
      const freed = r.stands_freed || 0;
      const cancelled = r.assignments_cancelled || 0;
      toast.success(`✅ Plan libéré — ${freed} exposant(s) détaché(s), ${cancelled} assignation(s) annulée(s). Positions conservées.`);
      onStandsReload && onStandsReload();
    } catch (e) { toast.error(e.message); }
  };

  // 📐 Alignement simple : stands sélectionnés (s'il y en a) sinon tous.
  //    Mode : 'row' (ligne horizontale) ou 'column' (colonne verticale).
  //    Paramètres : startX, startY, spacing (espacement entre chaque stand).
  const applyAlignment = () => {
    const hasSelection = selectedCodes.size > 0;
    let filtered = hasSelection
      ? stands.filter(s => selectedCodes.has(s.stand_code))
      : [...stands];
    if (!filtered.length) { toast.error('Aucun stand à aligner'); return; }
    // Tri pour ordre cohérent (stand_code alphanumérique)
    filtered.sort((a, b) => a.stand_code.localeCompare(b.stand_code, 'fr', { numeric: true }));
    const { mode, startX, startY, spacing } = alignParams;
    const newPositions = { ...positions };
    filtered.forEach((s, i) => {
      const x = mode === 'row' ? startX + i * spacing : startX;
      const y = mode === 'column' ? startY + i * spacing : startY;
      newPositions[s.stand_code] = {
        x: Math.max(2, Math.min(98, +x.toFixed(2))),
        y: Math.max(2, Math.min(98, +y.toFixed(2))),
      };
    });
    setPositions(newPositions);
    setDirty(true);
    toast.success(`✅ ${filtered.length} stand(s) alignés en ${mode === 'row' ? 'ligne horizontale ➡️' : 'colonne verticale ⬇️'}. N'oubliez pas de Sauver.`);
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
                <Button variant="outline" size="sm" className="gap-1.5 text-orange-600 border-orange-300 hover:bg-orange-50" onClick={clearAllPositions} title="Détache tous les exposants des stands. Les positions et les éléments décoratifs sont conservés."><UserMinus className="w-3.5 h-3.5" /> Libérer tous les stands</Button>
                <Button variant="default" size="sm" className={`gap-1.5 ${dirty ? 'animate-pulse bg-emerald-600 hover:bg-emerald-700' : ''}`} disabled={saving} onClick={savePositions}>
                  <Save className="w-3.5 h-3.5" /> {saving ? 'Sauvegarde…' : dirty ? '💾 Tout sauver (stands + éléments)' : 'Tout sauver'}
                </Button>
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
          <span><b>Clic</b> sur un stand = (dé)sélection pour alignement (anneau bleu) • <b>Glisser</b> = déplacer • <b>Croix rouge</b> = supprimer.</span>
          {selectedCodes.size > 0 && (
            <>
              <span>•</span>
              <span className="inline-flex items-center gap-1.5 bg-sky-100 border border-sky-300 rounded px-2 py-0.5 text-sky-900 font-semibold">
                {selectedCodes.size} stand(s) sélectionné(s)
                <button onClick={() => setSelectedCodes(new Set())} className="ml-1 hover:text-rose-600" title="Tout désélectionner">✕</button>
              </span>
            </>
          )}
        </div>
      )}

      {/* 📐 Panneau d'alignement simplifié : Ligne/Colonne + X + Y + Espacement */}
      {editMode && alignOpen && (
        <div className="rounded-md bg-blue-50 border-2 border-blue-300 px-4 py-3 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-sm text-blue-900">
              📐 Aligner {selectedCodes.size > 0 ? `les ${selectedCodes.size} stand(s) sélectionné(s)` : `les ${stands.length} stands`}
            </h4>
            <button onClick={() => setAlignOpen(false)} className="text-slate-400 hover:text-rose-600">✕</button>
          </div>

          {/* Mode : Ligne ou Colonne */}
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={alignParams.mode === 'row' ? 'default' : 'outline'}
              className="flex-1"
              onClick={() => setAlignParams(p => ({ ...p, mode: 'row' }))}
            >
              ➡️ Ligne horizontale
            </Button>
            <Button
              size="sm"
              variant={alignParams.mode === 'column' ? 'default' : 'outline'}
              className="flex-1"
              onClick={() => setAlignParams(p => ({ ...p, mode: 'column' }))}
            >
              ⬇️ Colonne verticale
            </Button>
          </div>

          {/* Sliders X / Y / Espacement */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-700 block mb-1">Position X : <b>{alignParams.startX}%</b></label>
              <input type="range" min="0" max="95" step="2.5" value={alignParams.startX} onChange={e => setAlignParams(p => ({ ...p, startX: parseFloat(e.target.value) }))} className="w-full accent-blue-600" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-700 block mb-1">Position Y : <b>{alignParams.startY}%</b></label>
              <input type="range" min="0" max="95" step="2.5" value={alignParams.startY} onChange={e => setAlignParams(p => ({ ...p, startY: parseFloat(e.target.value) }))} className="w-full accent-blue-600" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-700 block mb-1">Espacement : <b>{alignParams.spacing}%</b></label>
              <input type="range" min="2.5" max="20" step="0.5" value={alignParams.spacing} onChange={e => setAlignParams(p => ({ ...p, spacing: parseFloat(e.target.value) }))} className="w-full accent-blue-600" />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-blue-200">
            <Button size="sm" variant="default" className="gap-1.5 bg-blue-600 hover:bg-blue-700" onClick={applyAlignment}>
              ✓ Appliquer l&apos;alignement
            </Button>
            {selectedCodes.size > 0 && (
              <Button size="sm" variant="outline" className="text-[11px]" onClick={() => setSelectedCodes(new Set())}>
                ✕ Tout désélectionner
              </Button>
            )}
            <span className="text-[11px] text-slate-600 ml-auto">
              💡 Aperçu instantané • Cliquez « Tout sauver » pour persister.
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
          const isSelected = editMode && selectedCodes.has(s.stand_code);
          return (
            <div
              key={s.id || s.stand_code}
              draggable={editMode}
              onDragStart={e => onDragStart(e, s.stand_code)}
              onClick={(e) => {
                if (editMode) {
                  // 🎯 En mode édition, clic = toggle sélection (pour alignement multi)
                  e.stopPropagation();
                  setSelectedCodes(prev => {
                    const next = new Set(prev);
                    if (next.has(s.stand_code)) next.delete(s.stand_code);
                    else next.add(s.stand_code);
                    return next;
                  });
                  // Auto-bascule la cible alignement sur "Sélection"
                  setAlignParams(p => p.target === 'selected' ? p : { ...p, target: 'selected' });
                } else if (onStandClick) {
                  e.stopPropagation();
                  onStandClick(s);
                }
              }}
              className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full text-[9px] font-bold select-none transition-all ${editMode ? 'cursor-pointer z-20' : onStandClick ? 'cursor-pointer z-10' : 'z-10'} ${isSelected ? 'scale-125' : ''}`}
              style={{
                left: `${pos.x}%`,
                top: `${pos.y}%`,
                width: '3.5%',
                minWidth: '38px',
                padding: '4px 2px',
                background: color,
                color: '#fff',
                textAlign: 'center',
                // ⚠️ Utilisation de boxShadow stacké (au lieu de Tailwind ring) car la classe ring est neutralisée par le boxShadow inline
                boxShadow: isSelected
                  ? '0 0 0 3px #fff, 0 0 0 6px #0284c7, 0 0 12px rgba(2,132,199,.6)' // Anneau bleu sky-600 pour stand sélectionné
                  : highlighted
                    ? '0 0 0 2px #fff, 0 0 0 5px #60a5fa, 0 0 8px rgba(0,0,0,.4)' // Anneau bleu clair pour stand surligné (recherche)
                    : editMode
                      ? '0 0 0 2px #fff, 0 0 8px rgba(0,0,0,.4)'
                      : '0 1px 3px rgba(0,0,0,.3)',
                opacity: matchesSearch ? 1 : 0.25,
              }}
              title={s.organization ? `${s.stand_code} — ${s.organization.name} (${s.organization.discipline})${editMode ? ' — Cliquez pour (dé)sélectionner, glisser pour déplacer' : ''}` : `${s.stand_code} — Libre${editMode ? ' — Cliquez pour (dé)sélectionner, glisser pour déplacer' : ''}`}
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

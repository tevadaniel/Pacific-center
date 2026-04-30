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

  const onDragStart = (e, code) => {
    if (!editMode) return;
    setDraggedCode(code);
    e.dataTransfer.effectAllowed = 'move';
  };
  const onDragEnd = (e) => {
    if (!editMode || !draggedCode || !containerRef.current) { setDraggedCode(null); return; }
    const r = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 100;
    const y = ((e.clientY - r.top) / r.height) * 100;
    if (x < 0 || x > 100 || y < 0 || y > 100) { setDraggedCode(null); return; }
    setPositions(p => ({ ...p, [draggedCode]: { x: +x.toFixed(2), y: +y.toFixed(2) } }));
    setDirty(true);
    setDraggedCode(null);
  };

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
                <Button variant="outline" size="sm" className="gap-1.5" onClick={resetPositions}><RotateCcw className="w-3.5 h-3.5" /> Reset</Button>
                <Button variant="outline" size="sm" className="gap-1.5 text-red-600 border-red-300 hover:bg-red-50" onClick={clearAllPositions}><Trash2 className="w-3.5 h-3.5" /> Tout effacer</Button>
                <Button variant="default" size="sm" className="gap-1.5" disabled={!dirty} onClick={savePositions}><Save className="w-3.5 h-3.5" /> Sauver</Button>
              </>
            )}
          </div>
        )}
      </div>

      {editMode && (
        <div className="text-xs bg-amber-50 border border-amber-200 rounded-md px-3 py-2 text-amber-800">
          <Move className="w-3.5 h-3.5 inline mr-1" /> <b>Mode édition</b> : glisse les stands pour les repositionner, clique sur la croix pour supprimer un stand libre, ou utilise "Ajouter" pour en créer un nouveau. N'oublie pas de <b>Sauver</b>.
        </div>
      )}

      <div
        ref={containerRef}
        onDragOver={(e) => editMode && e.preventDefault()}
        onDrop={onDragEnd}
        className="relative rounded-xl overflow-hidden border bg-black shadow-lg"
        style={{
          aspectRatio: '1600 / 556',
          ...(bgUrl
            ? { backgroundImage: `url(${bgUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
            : { backgroundColor: BLANK_BG_COLOR }),
        }}
      >
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
              className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full text-[9px] font-bold select-none transition-all ${editMode ? 'cursor-move' : onStandClick ? 'cursor-pointer' : ''} ${highlighted ? 'ring-4 ring-blue-400 ring-offset-1 z-10' : ''}`}
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

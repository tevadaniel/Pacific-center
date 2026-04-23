'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Move, Plus, Save, Trash2, X, Edit3, RotateCcw, MapPin, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/auth-client';
import { toast } from 'sonner';

// Map venue.code -> PNG file
const BG_BY_VENUE = {
  FAAA: '/plans/faaa_bg.png',
  PUN: '/plans/punaauia_bg.png',
  ARU: '/plans/arue_bg.png',
  TAR: '/plans/taravao_bg.png',
};

// Default layout positions (percentages). Used when stand has no saved position.
// These are visual estimations — admin can drag & save new positions.
const DEFAULT_POSITIONS = {
  ARU: { // 12 stands horizontal
    'A-C01': { x: 13, y: 50 }, 'A-C02': { x: 19, y: 50 }, 'A-C03': { x: 25, y: 50 }, 'A-C04': { x: 31, y: 50 },
    'A-C05': { x: 37, y: 50 }, 'A-C06': { x: 43, y: 50 }, 'A-C07': { x: 49, y: 50 }, 'A-C08': { x: 55, y: 50 },
    'A-C09': { x: 61, y: 50 }, 'A-C10': { x: 72, y: 50 }, 'A-C11': { x: 78, y: 50 }, 'A-C12': { x: 84, y: 50 },
  },
  TAR: { // 6 + DEMO + 6
    'T-D01': { x: 16, y: 50 }, 'T-D02': { x: 22, y: 50 }, 'T-D03': { x: 28, y: 50 }, 'T-D04': { x: 34, y: 50 },
    'T-D05': { x: 40, y: 50 }, 'T-D06': { x: 46, y: 50 },
    'T-D07': { x: 58, y: 50 }, 'T-D08': { x: 64, y: 50 }, 'T-D09': { x: 70, y: 50 }, 'T-D10': { x: 76, y: 50 },
    'T-D11': { x: 82, y: 50 }, 'T-D12': { x: 88, y: 50 },
  },
  FAAA: { // 16 stands in a row with 2 kiosques intercalés
    'F-A01': { x: 10, y: 55 }, 'F-A02': { x: 14, y: 55 }, 'F-A03': { x: 18, y: 55 }, 'F-A04': { x: 24, y: 55 },
    'F-A05': { x: 28, y: 55 }, 'F-A06': { x: 32, y: 55 }, 'F-A07': { x: 36, y: 55 }, 'F-A08': { x: 40, y: 55 },
    'F-A09': { x: 44, y: 55 }, 'F-A10': { x: 54, y: 55 }, 'F-A11': { x: 58, y: 55 }, 'F-A12': { x: 62, y: 55 },
    'F-A13': { x: 66, y: 55 }, 'F-A14': { x: 78, y: 55 }, 'F-A15': { x: 82, y: 55 }, 'F-A16': { x: 86, y: 55 },
  },
  PUN: { // 3 + DEMO + 9 + Kiosque
    'P-B01': { x: 18, y: 50 }, 'P-B02': { x: 22, y: 50 }, 'P-B03': { x: 26, y: 50 },
    'P-B04': { x: 42, y: 50 }, 'P-B05': { x: 46, y: 50 }, 'P-B06': { x: 50, y: 50 }, 'P-B07': { x: 54, y: 50 },
    'P-B08': { x: 58, y: 50 }, 'P-B09': { x: 62, y: 50 }, 'P-B10': { x: 66, y: 50 }, 'P-B11': { x: 70, y: 50 },
    'P-B12': { x: 74, y: 50 }, 'P-B13': { x: 78, y: 50 },
  },
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
  useEffect(() => {
    const map = {};
    const defaults = DEFAULT_POSITIONS[venueCode] || {};
    stands.forEach(s => {
      const db = (typeof s.pos_x === 'number' && typeof s.pos_y === 'number') ? { x: s.pos_x, y: s.pos_y } : null;
      map[s.stand_code] = db || defaults[s.stand_code] || { x: 50, y: 50 };
    });
    setPositions(map);
    setDirty(false);
  }, [stands, venueCode]);

  if (!bgUrl) return null;

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
    if (stand.organization) { toast.error('Libérez le stand avant de le supprimer'); return; }
    if (!confirm(`Supprimer définitivement le stand ${stand.stand_code} ?`)) return;
    try {
      await api(`/api/venue-stands/${stand.id}`, { method: 'DELETE' });
      toast.success('Stand supprimé');
      onStandsReload && onStandsReload();
    } catch (e) { toast.error(e.message); }
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
        style={{ aspectRatio: '1600 / 556', backgroundImage: `url(${bgUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
      >
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
              {editMode && !s.organization && (
                <button onClick={(e) => { e.stopPropagation(); deleteStand(s); }} className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center hover:scale-110" title="Supprimer ce stand">
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

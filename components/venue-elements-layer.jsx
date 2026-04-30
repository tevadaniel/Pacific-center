'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Trash2, Save, Square, ArrowRight, Coffee, ShoppingBag, Zap, Layers, RotateCw, X, Plus } from 'lucide-react';
import { api } from '@/lib/auth-client';
import { toast } from 'sonner';

// 7 types d'éléments avec leur configuration par défaut
const ELEMENT_TYPES = {
  stand_zone:    { label: 'Zone stand exposant', icon: Square,       defaultColor: '#3b82f6', defaultW: 8, defaultH: 5, shape: 'rectangle' },
  demo_zone:     { label: 'Zone démonstration',  icon: Layers,       defaultColor: '#a855f7', defaultW: 14, defaultH: 8, shape: 'rectangle' },
  kiosque:       { label: 'Kiosque',             icon: Coffee,       defaultColor: '#7c2d12', defaultW: 6, defaultH: 6, shape: 'rectangle' },
  commerce:      { label: 'Commerce',            icon: ShoppingBag,  defaultColor: '#0a0a0a', defaultW: 18, defaultH: 8, shape: 'rectangle' },
  carrefour:     { label: 'Carrefour',           icon: ShoppingBag,  defaultColor: '#0a0a0a', defaultW: 30, defaultH: 6, shape: 'rectangle' },
  flow_arrow:    { label: 'Sens circulation',    icon: ArrowRight,   defaultColor: '#10b981', defaultW: 10, defaultH: 4, shape: 'arrow' },
  electric_outlet: { label: 'Prise électrique',  icon: Zap,          defaultColor: '#fbbf24', defaultW: 3, defaultH: 3, shape: 'circle' },
};

const PALETTE = ['#3b82f6', '#10b981', '#a855f7', '#f97316', '#ec4899', '#fbbf24', '#06b6d4', '#92400e', '#475569', '#ef4444'];

export default function VenueElementsLayer({ venueId, editable = false, containerRef }) {
  const [elements, setElements] = useState([]);
  const [editMode, setEditMode] = useState(false);
  const [selected, setSelected] = useState(null); // selected element id
  const [draft, setDraft] = useState(null); // unsaved changes
  const [dragOffset, setDragOffset] = useState(null);
  const [dirty, setDirty] = useState(false);

  const load = async () => {
    if (!venueId) return;
    try { setElements(await api(`/api/venue-elements?venue_id=${venueId}`)); }
    catch (e) { console.error(e.message); }
  };
  useEffect(() => { load(); }, [venueId]);

  const addElement = async (type) => {
    const cfg = ELEMENT_TYPES[type];
    try {
      const created = await api('/api/venue-elements', {
        method: 'POST',
        body: JSON.stringify({
          venue_id: venueId, type, shape: cfg.shape,
          pos_x: 50, pos_y: 50, width: cfg.defaultW, height: cfg.defaultH,
          rotation: 0, color: cfg.defaultColor, label: cfg.label,
        }),
      });
      setElements(prev => [...prev, created]);
      setSelected(created.id);
      toast.success(`${cfg.label} ajouté(e) au centre du plan`);
    } catch (e) { toast.error(e.message); }
  };

  const startDrag = (e, el) => {
    if (!editMode || !containerRef?.current) return;
    e.stopPropagation();
    setSelected(el.id);
    const r = containerRef.current.getBoundingClientRect();
    const elX = (el.pos_x / 100) * r.width;
    const elY = (el.pos_y / 100) * r.height;
    setDragOffset({ id: el.id, dx: e.clientX - r.left - elX, dy: e.clientY - r.top - elY });
  };

  // 🎯 Snap-to-grid : aligne sur 2.5%. Lit le toggle global (window.__VENUE_SNAP_ENABLED) défini par le parent.
  const GRID_STEP = 2.5;
  const snap = (val) => {
    const snapOn = typeof window !== 'undefined' ? (window.__VENUE_SNAP_ENABLED !== false) : true;
    return snapOn ? +(Math.round(val / GRID_STEP) * GRID_STEP).toFixed(2) : +val.toFixed(2);
  };

  useEffect(() => {
    if (!dragOffset) return;
    const onMove = (e) => {
      const r = containerRef.current?.getBoundingClientRect();
      if (!r) return;
      const x = ((e.clientX - r.left - dragOffset.dx) / r.width) * 100;
      const y = ((e.clientY - r.top - dragOffset.dy) / r.height) * 100;
      const cx = Math.max(0, Math.min(100, x));
      const cy = Math.max(0, Math.min(100, y));
      const sx = snap(cx);
      const sy = snap(cy);
      setElements(prev => prev.map(el => el.id === dragOffset.id ? { ...el, pos_x: sx, pos_y: sy } : el));
      setDirty(true);
    };
    const onUp = () => setDragOffset(null);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [dragOffset, containerRef]);

  const updateField = (id, field, value) => {
    setElements(prev => prev.map(el => el.id === id ? { ...el, [field]: value } : el));
    setDirty(true);
  };

  const saveAll = async () => {
    try {
      const updates = elements.map(el => ({
        id: el.id, pos_x: el.pos_x, pos_y: el.pos_y,
        width: el.width, height: el.height, rotation: el.rotation,
        color: el.color, label: el.label, z_index: el.z_index || 1,
      }));
      await api('/api/venue-elements/bulk-update', { method: 'POST', body: JSON.stringify({ updates }) });
      toast.success('Plan sauvegardé');
      setDirty(false);
    } catch (e) { toast.error(e.message); }
  };

  const deleteEl = async (el) => {
    // Pas de confirm() : Safari peut bloquer le popup et le user a déjà cliqué explicitement sur "Supprimer".
    // Suppression directe + toast undo possible plus tard si besoin.
    try {
      // Suppression optimiste : on retire de la liste IMMÉDIATEMENT, puis on appelle l'API.
      // Si l'API échoue, on remet l'élément.
      const backup = el;
      setElements(prev => prev.filter(e => e.id !== el.id));
      setSelected(null);
      try {
        await api(`/api/venue-elements/${el.id}`, { method: 'DELETE' });
        toast.success(`✅ ${ELEMENT_TYPES[el.type]?.label || 'Élément'} supprimé`);
      } catch (e) {
        // Rollback en cas d'échec API
        setElements(prev => [...prev, backup]);
        toast.error('Suppression échouée : ' + e.message);
      }
    } catch (e) { toast.error(e.message); }
  };

  const selectedEl = elements.find(e => e.id === selected);

  return (
    <>
      {/* Layer rendu — toujours visible (lecture seule + édition) */}
      {elements.map(el => {
        const cfg = ELEMENT_TYPES[el.type] || ELEMENT_TYPES.stand_zone;
        const Icon = cfg.icon;
        const isSelected = selected === el.id && editMode;
        const isArrow = el.shape === 'arrow';
        const isCircle = el.shape === 'circle';
        return (
          <div key={el.id}
            onMouseDown={(e) => startDrag(e, el)}
            onClick={(e) => { e.stopPropagation(); if (editMode) setSelected(el.id); }}
            className={`absolute -translate-x-1/2 -translate-y-1/2 select-none transition-all flex items-center justify-center font-bold text-white text-[10px] shadow-md ${editMode ? 'cursor-move' : 'pointer-events-none'} ${isSelected ? 'ring-4 ring-yellow-400 ring-offset-1 z-50' : editMode ? 'z-30' : 'z-10'} ${isCircle ? 'rounded-full' : isArrow ? '' : 'rounded'}`}
            style={{
              left: `${el.pos_x}%`,
              top: `${el.pos_y}%`,
              width: `${el.width}%`,
              height: `${el.height}%`,
              minWidth: '14px',
              minHeight: '14px',
              background: isArrow ? 'transparent' : el.color,
              transform: `translate(-50%, -50%) rotate(${el.rotation || 0}deg)`,
              opacity: el.opacity ?? 0.85,
              clipPath: isArrow ? 'polygon(0 35%, 65% 35%, 65% 10%, 100% 50%, 65% 90%, 65% 65%, 0 65%)' : 'none',
            }}
            title={el.label || cfg.label}
          >
            {isArrow ? (
              <svg viewBox="0 0 100 50" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
                <polygon points="0,17.5 65,17.5 65,5 100,25 65,45 65,32.5 0,32.5" fill={el.color} stroke="rgba(0,0,0,0.2)" strokeWidth="0.5" />
              </svg>
            ) : isCircle ? (
              <Icon className="w-1/2 h-1/2" strokeWidth={3} />
            ) : el.label ? (
              <span className="px-1 text-center leading-tight truncate">{el.label}</span>
            ) : null}
          </div>
        );
      })}

      {/* Toolbar — RENDU EN PORTAL au-dessus du plan, dans la zone dédiée (ne masque plus le plan) */}
      {editable && typeof document !== 'undefined' && (() => {
        const host = document.getElementById('venue-elements-toolbar');
        if (!host) return null;
        return createPortal(
          !editMode ? (
            <Button size="sm" variant="default" className="gap-1.5" onClick={() => setEditMode(true)}>
              <Plus className="w-3.5 h-3.5" /> Édition plan
            </Button>
          ) : (
            <div className="flex flex-wrap items-center gap-2 w-full">
              <span className="text-xs font-bold text-slate-700">➕ Ajouter :</span>
              {Object.entries(ELEMENT_TYPES).map(([type, cfg]) => {
                const Icon = cfg.icon;
                return (
                  <Button key={type} size="sm" variant="outline" className="gap-1 h-7 text-[11px]" onClick={() => addElement(type)} style={{ borderColor: cfg.defaultColor }}>
                    <Icon className="w-3 h-3" style={{ color: cfg.defaultColor }} />
                    {cfg.label}
                  </Button>
                );
              })}
              <span className="border-l h-5 mx-1" />
              <Button size="sm" variant="default" className="gap-1.5" disabled={!dirty} onClick={saveAll}><Save className="w-3.5 h-3.5" /> Sauver</Button>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => { setEditMode(false); setSelected(null); }}>Quitter</Button>
            </div>
          ),
          host
        );
      })()}

      {/* Panneau d'édition de l'élément sélectionné — RENDU EN PORTAL au-dessus du plan (ne masque plus la zone de travail) */}
      {editMode && selectedEl && typeof document !== 'undefined' && (() => {
        const host = document.getElementById('venue-element-edit-toolbar');
        if (!host) return null;
        return createPortal(
          <div className="bg-white rounded-md shadow-md border-2 border-blue-300 px-3 py-2 flex flex-wrap items-center gap-2 text-xs" onMouseDown={(e) => e.stopPropagation()}>
            <span className="font-semibold text-blue-900 mr-1">⚙️ {ELEMENT_TYPES[selectedEl.type]?.label}</span>
            <span className="border-l h-5" />
            <div className="flex items-center gap-1">
              <Label className="text-[10px] text-slate-600 mb-0">Étiquette</Label>
              <Input className="h-7 text-xs w-32" value={selectedEl.label || ''} onChange={(e) => updateField(selectedEl.id, 'label', e.target.value)} />
            </div>
            <div className="flex items-center gap-1">
              <Label className="text-[10px] text-slate-600 mb-0 whitespace-nowrap">L {selectedEl.width}%</Label>
              <input type="range" min="2.5" max="100" step="2.5" value={selectedEl.width} onChange={(e) => updateField(selectedEl.id, 'width', parseFloat(e.target.value))} className="w-24" />
            </div>
            <div className="flex items-center gap-1">
              <Label className="text-[10px] text-slate-600 mb-0 whitespace-nowrap">H {selectedEl.height}%</Label>
              <input type="range" min="2.5" max="100" step="2.5" value={selectedEl.height} onChange={(e) => updateField(selectedEl.id, 'height', parseFloat(e.target.value))} className="w-24" />
            </div>
            <div className="flex items-center gap-1">
              <Label className="text-[10px] text-slate-600 mb-0 whitespace-nowrap">⟳ {selectedEl.rotation || 0}°</Label>
              <input type="range" min="0" max="360" step="5" value={selectedEl.rotation || 0} onChange={(e) => updateField(selectedEl.id, 'rotation', parseInt(e.target.value))} className="w-20" />
              <Button size="sm" variant="outline" className="h-6 px-1.5" onClick={() => updateField(selectedEl.id, 'rotation', ((selectedEl.rotation || 0) + 90) % 360)} title="Rotation +90°"><RotateCw className="w-3 h-3" /></Button>
            </div>
            <div className="flex items-center gap-0.5">
              {PALETTE.map(c => (
                <button key={c} onClick={() => updateField(selectedEl.id, 'color', c)} className={`w-5 h-5 rounded ${selectedEl.color === c ? 'ring-2 ring-offset-1 ring-slate-700' : ''}`} style={{ background: c }} />
              ))}
              <input type="color" value={selectedEl.color} onChange={(e) => updateField(selectedEl.id, 'color', e.target.value)} className="w-5 h-5 rounded border cursor-pointer ml-0.5" />
            </div>
            <span className="border-l h-5" />
            <Button size="sm" variant="outline" className="text-rose-600 border-rose-200 gap-1 h-7 text-[11px]" onClick={() => deleteEl(selectedEl)}>
              <Trash2 className="w-3 h-3" /> Supprimer
            </Button>
            <Button size="sm" variant="ghost" className="h-7 px-1.5" onClick={() => setSelected(null)} title="Fermer le panneau">
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>,
          host
        );
      })()}
    </>
  );
}

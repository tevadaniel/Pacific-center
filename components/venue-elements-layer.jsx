'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Trash2, Save, Square, ArrowRight, Coffee, ShoppingBag, Zap, Layers, RotateCw, X, Plus } from 'lucide-react';
import { api } from '@/lib/auth-client';
import { toast } from 'sonner';

// 6 types d'éléments avec leur configuration par défaut
const ELEMENT_TYPES = {
  stand_zone:    { label: 'Zone stand exposant', icon: Square,       defaultColor: '#3b82f6', defaultW: 8, defaultH: 5, shape: 'rectangle' },
  demo_zone:     { label: 'Zone démonstration',  icon: Layers,       defaultColor: '#a855f7', defaultW: 14, defaultH: 8, shape: 'rectangle' },
  kiosque:       { label: 'Kiosque',             icon: Coffee,       defaultColor: '#92400e', defaultW: 6, defaultH: 6, shape: 'rectangle' },
  commerce:      { label: 'Commerce',            icon: ShoppingBag,  defaultColor: '#f97316', defaultW: 8, defaultH: 5, shape: 'rectangle' },
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

  useEffect(() => {
    if (!dragOffset) return;
    const onMove = (e) => {
      const r = containerRef.current?.getBoundingClientRect();
      if (!r) return;
      const x = ((e.clientX - r.left - dragOffset.dx) / r.width) * 100;
      const y = ((e.clientY - r.top - dragOffset.dy) / r.height) * 100;
      const cx = Math.max(0, Math.min(100, x));
      const cy = Math.max(0, Math.min(100, y));
      setElements(prev => prev.map(el => el.id === dragOffset.id ? { ...el, pos_x: +cx.toFixed(2), pos_y: +cy.toFixed(2) } : el));
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
    if (!confirm(`Supprimer ${ELEMENT_TYPES[el.type]?.label || 'cet élément'} ?`)) return;
    try {
      await api(`/api/venue-elements/${el.id}`, { method: 'DELETE' });
      setElements(prev => prev.filter(e => e.id !== el.id));
      setSelected(null);
      toast.success('Supprimé');
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
            className={`absolute -translate-x-1/2 -translate-y-1/2 select-none transition-all flex items-center justify-center font-bold text-white text-[10px] shadow-md ${editMode ? 'cursor-move' : 'pointer-events-none'} ${isSelected ? 'ring-4 ring-yellow-400 ring-offset-1 z-30' : 'z-10'} ${isCircle ? 'rounded-full' : isArrow ? '' : 'rounded'}`}
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
            ) : (
              <span className="px-1 text-center leading-tight truncate">{el.label || cfg.label}</span>
            )}
          </div>
        );
      })}

      {/* Toolbar — visible uniquement quand editable */}
      {editable && (
        <div className="absolute top-2 right-2 z-40 flex flex-col gap-2 items-end">
          {!editMode ? (
            <Button size="sm" variant="default" className="gap-1.5 shadow-lg" onClick={() => setEditMode(true)}>
              <Plus className="w-3.5 h-3.5" /> Édition plan
            </Button>
          ) : (
            <>
              <div className="bg-white rounded-md shadow-lg border p-2 flex flex-wrap gap-1 max-w-[440px]">
                {Object.entries(ELEMENT_TYPES).map(([type, cfg]) => {
                  const Icon = cfg.icon;
                  return (
                    <Button key={type} size="sm" variant="outline" className="gap-1 h-7 text-[11px]" onClick={() => addElement(type)} style={{ borderColor: cfg.defaultColor }}>
                      <Icon className="w-3 h-3" style={{ color: cfg.defaultColor }} />
                      {cfg.label}
                    </Button>
                  );
                })}
              </div>
              <div className="flex gap-1.5">
                <Button size="sm" variant="default" className="gap-1.5 shadow-lg" disabled={!dirty} onClick={saveAll}><Save className="w-3.5 h-3.5" /> Sauver</Button>
                <Button size="sm" variant="outline" className="gap-1.5 shadow-lg" onClick={() => { setEditMode(false); setSelected(null); }}>Quitter</Button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Panneau d'édition de l'élément sélectionné */}
      {editMode && selectedEl && (
        <div className="absolute bottom-2 left-2 z-40 bg-white rounded-md shadow-lg border p-3 w-72 space-y-2" onMouseDown={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between">
            <div className="font-semibold text-sm">{ELEMENT_TYPES[selectedEl.type]?.label}</div>
            <button onClick={() => setSelected(null)}><X className="w-4 h-4 text-slate-400 hover:text-slate-700" /></button>
          </div>
          <div>
            <Label className="text-[11px]">Étiquette</Label>
            <Input className="h-7 text-xs" value={selectedEl.label || ''} onChange={(e) => updateField(selectedEl.id, 'label', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[11px]">Largeur ({selectedEl.width}%)</Label>
              <input type="range" min="1" max="50" step="0.5" value={selectedEl.width} onChange={(e) => updateField(selectedEl.id, 'width', parseFloat(e.target.value))} className="w-full" />
            </div>
            <div>
              <Label className="text-[11px]">Hauteur ({selectedEl.height}%)</Label>
              <input type="range" min="1" max="50" step="0.5" value={selectedEl.height} onChange={(e) => updateField(selectedEl.id, 'height', parseFloat(e.target.value))} className="w-full" />
            </div>
          </div>
          <div>
            <Label className="text-[11px]">Rotation ({selectedEl.rotation || 0}°)</Label>
            <div className="flex items-center gap-2">
              <input type="range" min="0" max="360" step="5" value={selectedEl.rotation || 0} onChange={(e) => updateField(selectedEl.id, 'rotation', parseInt(e.target.value))} className="flex-1" />
              <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => updateField(selectedEl.id, 'rotation', ((selectedEl.rotation || 0) + 90) % 360)}><RotateCw className="w-3 h-3" /></Button>
            </div>
          </div>
          <div>
            <Label className="text-[11px]">Couleur</Label>
            <div className="flex gap-1 flex-wrap">
              {PALETTE.map(c => (
                <button key={c} onClick={() => updateField(selectedEl.id, 'color', c)} className={`w-6 h-6 rounded ${selectedEl.color === c ? 'ring-2 ring-offset-1 ring-slate-700' : ''}`} style={{ background: c }} />
              ))}
              <input type="color" value={selectedEl.color} onChange={(e) => updateField(selectedEl.id, 'color', e.target.value)} className="w-6 h-6 rounded border cursor-pointer" />
            </div>
          </div>
          <Button size="sm" variant="outline" className="w-full text-rose-600 border-rose-200 gap-1.5 h-7" onClick={() => deleteEl(selectedEl)}>
            <Trash2 className="w-3 h-3" /> Supprimer
          </Button>
        </div>
      )}
    </>
  );
}

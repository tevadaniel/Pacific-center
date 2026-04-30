'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronDown, ChevronUp, Info } from 'lucide-react';

/**
 * Carte d'aide pliable qui affiche les définitions d'un ensemble de statuts/priorités.
 * Réutilisée pour Priorités exposants + Statuts prospection.
 *
 * Props :
 *   - title : titre affiché (ex: "Signification des priorités")
 *   - definitions : objet clé → { label, emoji, color, description }
 *   - defaultOpen : boolean (par défaut false)
 *   - storageKey : clé sessionStorage pour mémoriser l'état plié/déplié
 */
export default function HelpCard({ title, definitions, defaultOpen = false, storageKey }) {
  const [open, setOpen] = useState(() => {
    if (typeof window === 'undefined' || !storageKey) return defaultOpen;
    try {
      const saved = sessionStorage.getItem(storageKey);
      return saved === null ? defaultOpen : saved === '1';
    } catch { return defaultOpen; }
  });
  const toggle = () => {
    const v = !open;
    setOpen(v);
    try { if (storageKey) sessionStorage.setItem(storageKey, v ? '1' : '0'); } catch { /* ignore */ }
  };
  const entries = Object.entries(definitions || {});
  return (
    <Card className="border-blue-200 bg-gradient-to-br from-blue-50/70 to-indigo-50/50">
      <CardContent className="p-3">
        <button
          onClick={toggle}
          className="w-full flex items-center justify-between text-left font-semibold text-blue-900 hover:text-blue-700 transition"
        >
          <span className="flex items-center gap-2 text-sm">
            <Info className="w-4 h-4" /> {title}
          </span>
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {open && (
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {entries.map(([key, def]) => (
              <div
                key={key}
                className={`rounded-md border px-3 py-2 text-xs ${def.color || 'bg-white border-slate-200'}`}
              >
                <div className="font-semibold flex items-center gap-1.5 mb-1">
                  <span>{def.emoji}</span>
                  <span>{def.label}</span>
                </div>
                <div className="text-[11px] leading-relaxed opacity-90">{def.description}</div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

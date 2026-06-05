'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/auth-client';
import { ShieldCheck, Repeat, Bell, ClipboardCheck, AlertCircle, Wallet, X, Zap, ChevronRight } from 'lucide-react';

/**
 * 🆕 QUICK ACTION BAR — Mode action rapide ARACOM
 * 🆕 SESSION 48k — Refonte UX :
 *  - Groupes prioritaires (À TRAITER / À RELANCER / SUIVI) avec coloration cohérente
 *  - Auto-masquage des compteurs à 0 (sauf si l'onglet correspondant est actif)
 *  - Si tout est à 0 → barre devient minimaliste (✅ Aucune action urgente)
 *  - Conserve hotkeys hint (V/R) et persistance localStorage
 */
const GROUPS = [
  {
    id: 'urgent',
    label: 'À TRAITER',
    accent: 'rose', // rouge urgent
    counters: [
      { key: 'pending_validations', tab: 'file-validation', label: 'Demandes', icon: ShieldCheck, hint: '⌨️ V = valider · R = refuser' },
      { key: 'pending_cessions', tab: 'file-cession', label: 'Cessions', icon: Repeat },
      { key: 'validations', tab: 'validations', label: 'Candidatures', icon: ClipboardCheck },
    ],
  },
  {
    id: 'followup',
    label: 'À RELANCER',
    accent: 'orange',
    counters: [
      { key: 'relances', tab: 'relances', label: 'Exposants', icon: Bell },
      { key: 'cautions', tab: 'cautions', label: 'Cautions', icon: Wallet },
    ],
  },
  {
    id: 'monitoring',
    label: 'SUIVI',
    accent: 'amber',
    counters: [
      { key: 'anomalies', tab: 'anomalies', label: 'Anomalies', icon: AlertCircle },
    ],
  },
];

const ACCENT_CLASSES = {
  rose: {
    chip: 'bg-rose-50 border-rose-300 text-rose-900 hover:bg-rose-100',
    chipActive: 'ring-2 ring-rose-400 ring-offset-1',
    number: 'bg-rose-600 text-white',
    label: 'text-rose-700',
    dot: 'bg-rose-500',
  },
  orange: {
    chip: 'bg-orange-50 border-orange-300 text-orange-900 hover:bg-orange-100',
    chipActive: 'ring-2 ring-orange-400 ring-offset-1',
    number: 'bg-orange-600 text-white',
    label: 'text-orange-700',
    dot: 'bg-orange-500',
  },
  amber: {
    chip: 'bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100',
    chipActive: 'ring-2 ring-amber-400 ring-offset-1',
    number: 'bg-amber-600 text-white',
    label: 'text-amber-700',
    dot: 'bg-amber-500',
  },
};

export default function QuickActionBar({ onGoto, activeTab }) {
  const [badges, setBadges] = useState({});
  const [hidden, setHidden] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Restaure préférence localStorage
  useEffect(() => {
    try {
      const v = localStorage.getItem('aracom_quick_bar_hidden');
      if (v === '1') setHidden(true);
    } catch { /* ignore */ }
    setLoaded(true);
  }, []);

  useEffect(() => {
    const load = () => api('/api/menu-badges').then(setBadges).catch(() => {});
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, []);

  const totalUrgent = GROUPS.reduce(
    (sum, g) => sum + g.counters.reduce((s, c) => s + (badges[c.key] || 0), 0),
    0
  );

  if (!loaded) return null;

  // Mode masqué : bouton mini pour réafficher
  if (hidden) {
    return (
      <div className="sticky top-0 z-40 flex justify-end px-4 py-1 bg-transparent pointer-events-none">
        <button
          onClick={() => { setHidden(false); try { localStorage.setItem('aracom_quick_bar_hidden', '0'); } catch { /* ignore */ } }}
          className="pointer-events-auto inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-md transition-all"
          title="Afficher la barre Mode action rapide"
        >
          <Zap className="w-3.5 h-3.5" /> Mode action rapide
          {totalUrgent > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full bg-white text-indigo-700 text-[10px] font-bold">{totalUrgent}</span>
          )}
        </button>
      </div>
    );
  }

  // Récupère hint hotkeys pour l'onglet actif
  let hintForActive = null;
  for (const g of GROUPS) {
    const c = g.counters.find(c => c.tab === activeTab);
    if (c?.hint) { hintForActive = c.hint; break; }
  }

  // 🆕 SESSION 48k — Cas zéro : barre allégée
  if (totalUrgent === 0) {
    return (
      <div className="sticky top-0 z-40 bg-gradient-to-r from-emerald-50 via-white to-emerald-50 border-b border-emerald-200">
        <div className="px-3 py-1.5 flex items-center gap-2">
          <div className="inline-flex items-center gap-1.5 text-emerald-700">
            <span className="text-base">✅</span>
            <span className="text-xs font-bold uppercase tracking-wide">Aucune action urgente</span>
            <span className="text-[10px] text-slate-500 font-normal hidden md:inline">— tout est à jour</span>
          </div>
          <button
            onClick={() => { setHidden(true); try { localStorage.setItem('aracom_quick_bar_hidden', '1'); } catch { /* ignore */ } }}
            className="ml-auto p-1 rounded hover:bg-emerald-100 text-emerald-700"
            title="Masquer la barre"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="sticky top-0 z-40 bg-gradient-to-r from-indigo-50 via-white to-indigo-50 border-b border-indigo-200 shadow-sm">
      <div className="px-3 py-2 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 pr-3 border-r border-indigo-200 shrink-0">
          <Zap className="w-4 h-4 text-indigo-600" />
          <span className="text-xs font-bold text-indigo-900 uppercase tracking-wide">Actions rapides</span>
        </div>

        {/* 🆕 Affichage par groupes */}
        <div className="flex items-center gap-x-4 gap-y-1.5 flex-wrap flex-1">
          {GROUPS.map((g) => {
            // Filtre les compteurs visibles : > 0 OU correspondant à l'onglet actif (pour la cohérence)
            const visible = g.counters.filter(c => (badges[c.key] || 0) > 0 || activeTab === c.tab);
            if (visible.length === 0) return null;
            const accent = ACCENT_CLASSES[g.accent];
            return (
              <div key={g.id} className="flex items-center gap-1.5">
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className={`w-1.5 h-1.5 rounded-full ${accent.dot}`} />
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${accent.label} hidden sm:inline`}>
                    {g.label}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {visible.map((c) => {
                    const value = badges[c.key] || 0;
                    const Icon = c.icon;
                    const isActive = activeTab === c.tab;
                    return (
                      <button
                        key={c.key}
                        onClick={() => onGoto?.(c.tab)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-semibold transition-all ${accent.chip} ${isActive ? accent.chipActive : ''}`}
                        title={`${c.label} — cliquer pour ouvrir l'onglet`}
                        data-testid={`quick-counter-${c.key}`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span className="hidden md:inline">{c.label}</span>
                        <span className={`inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full text-[10px] font-bold px-1 ${accent.number}`}>
                          {value}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {hintForActive && (
          <div className="hidden md:flex items-center gap-1 px-2 py-1 rounded-md bg-slate-900 text-white text-[11px] font-mono shrink-0">
            {hintForActive}
          </div>
        )}

        <button
          onClick={() => { setHidden(true); try { localStorage.setItem('aracom_quick_bar_hidden', '1'); } catch { /* ignore */ } }}
          className="ml-auto p-1 rounded hover:bg-indigo-100 text-indigo-700 shrink-0"
          title="Masquer la barre"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/auth-client';
import { ShieldCheck, Repeat, Bell, ClipboardCheck, AlertCircle, Wallet, X, Zap } from 'lucide-react';

/**
 * 🆕 QUICK ACTION BAR — Mode action rapide ARACOM
 * Barre sticky compacte affichant les compteurs critiques cliquables.
 * - Cliquer un compteur navigue vers l'onglet correspondant.
 * - Affiche un rappel des raccourcis clavier (V = valider, R = refuser) sur file-validation.
 * - Refresh auto toutes les 60s.
 * - Peut être masquée par l'admin (persisté dans localStorage).
 */
const COUNTERS = [
  {
    key: 'pending_validations',
    tab: 'file-validation',
    label: 'Demandes à valider',
    icon: ShieldCheck,
    color: 'amber',
    hint: '⌨️ V = valider · R = refuser',
  },
  {
    key: 'pending_cessions',
    tab: 'file-cession',
    label: 'Cessions à arbitrer',
    icon: Repeat,
    color: 'violet',
  },
  {
    key: 'validations',
    tab: 'validations',
    label: 'Candidatures à valider',
    icon: ClipboardCheck,
    color: 'indigo',
  },
  {
    key: 'relances',
    tab: 'relances',
    label: 'Exposants à relancer',
    icon: Bell,
    color: 'rose',
  },
  {
    key: 'cautions',
    tab: 'cautions',
    label: 'Cautions à encaisser',
    icon: Wallet,
    color: 'emerald',
  },
  {
    key: 'anomalies',
    tab: 'anomalies',
    label: 'Anomalies ouvertes',
    icon: AlertCircle,
    color: 'orange',
  },
];

const COLOR_CLASSES = {
  amber: 'bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100',
  violet: 'bg-violet-50 border-violet-300 text-violet-900 hover:bg-violet-100',
  indigo: 'bg-indigo-50 border-indigo-300 text-indigo-900 hover:bg-indigo-100',
  rose: 'bg-rose-50 border-rose-300 text-rose-900 hover:bg-rose-100',
  emerald: 'bg-emerald-50 border-emerald-300 text-emerald-900 hover:bg-emerald-100',
  orange: 'bg-orange-50 border-orange-300 text-orange-900 hover:bg-orange-100',
};

const NUMBER_COLOR_CLASSES = {
  amber: 'bg-amber-600 text-white',
  violet: 'bg-violet-600 text-white',
  indigo: 'bg-indigo-600 text-white',
  rose: 'bg-rose-600 text-white',
  emerald: 'bg-emerald-600 text-white',
  orange: 'bg-orange-600 text-white',
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
    } catch {}
    setLoaded(true);
  }, []);

  useEffect(() => {
    const load = () => api('/api/menu-badges').then(setBadges).catch(() => {});
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, []);

  const totalUrgent = COUNTERS.reduce((sum, c) => sum + (badges[c.key] || 0), 0);

  if (!loaded) return null;

  // Mode masqué : bouton mini pour réafficher
  if (hidden) {
    return (
      <div className="sticky top-0 z-40 flex justify-end px-4 py-1 bg-transparent pointer-events-none">
        <button
          onClick={() => { setHidden(false); try { localStorage.setItem('aracom_quick_bar_hidden', '0'); } catch {} }}
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

  const hintForActive = COUNTERS.find(c => c.tab === activeTab)?.hint;

  return (
    <div className="sticky top-0 z-40 bg-gradient-to-r from-indigo-50 via-white to-indigo-50 border-b border-indigo-200 shadow-sm">
      <div className="px-3 py-2 flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 pr-2 border-r border-indigo-200">
          <Zap className="w-4 h-4 text-indigo-600" />
          <span className="text-xs font-bold text-indigo-900 uppercase tracking-wide">Mode action rapide</span>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap flex-1">
          {COUNTERS.map((c) => {
            const value = badges[c.key] || 0;
            const Icon = c.icon;
            const isActive = activeTab === c.tab;
            return (
              <button
                key={c.key}
                onClick={() => onGoto?.(c.tab)}
                disabled={value === 0 && !isActive}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-semibold transition-all ${
                  value === 0
                    ? 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed'
                    : COLOR_CLASSES[c.color]
                } ${isActive ? 'ring-2 ring-offset-1 ring-indigo-400' : ''}`}
                title={value === 0 ? `${c.label} : aucune action requise` : `${c.label} — cliquer pour ouvrir l'onglet`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{c.label}</span>
                <span className={`inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full text-[10px] font-bold px-1 ${
                  value === 0 ? 'bg-slate-200 text-slate-500' : NUMBER_COLOR_CLASSES[c.color]
                }`}>
                  {value}
                </span>
              </button>
            );
          })}
        </div>
        {hintForActive && (
          <div className="hidden md:flex items-center gap-1 px-2 py-1 rounded-md bg-slate-900 text-white text-[11px] font-mono">
            {hintForActive}
          </div>
        )}
        <button
          onClick={() => { setHidden(true); try { localStorage.setItem('aracom_quick_bar_hidden', '1'); } catch {} }}
          className="ml-auto p-1 rounded hover:bg-indigo-100 text-indigo-700"
          title="Masquer la barre"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { Sparkles, RefreshCw } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { api } from '@/lib/auth-client';

/**
 * Badge IA réutilisable — affiche un petit pictogramme coloré (selon vigilance) à côté
 * d'un exposant. Au clic, ouvre une popover avec la synthèse IA complète + bouton régénérer.
 *
 * Props :
 *   - registration : objet registration (avec ai_insight, ai_insight_vigilance, ai_insight_generated_at)
 *   - onRefresh : callback optionnel à appeler après régénération
 *   - size : 'sm' (défaut) | 'xs'
 */

const VIGILANCE_VISUALS = {
  low:    { color: 'bg-emerald-500 hover:bg-emerald-600',   borderColor: 'border-emerald-300',   bg: 'bg-emerald-50',   text: 'text-emerald-900',   label: '🟢 Fiable',          tooltip: 'Profil fiable' },
  medium: { color: 'bg-amber-500 hover:bg-amber-600',       borderColor: 'border-amber-300',     bg: 'bg-amber-50',     text: 'text-amber-900',     label: '🟡 À surveiller',    tooltip: 'À surveiller' },
  high:   { color: 'bg-rose-500 hover:bg-rose-600',         borderColor: 'border-rose-300',      bg: 'bg-rose-50',      text: 'text-rose-900',      label: '🔴 Vigilance',       tooltip: 'Vigilance élevée' },
  new:    { color: 'bg-violet-500 hover:bg-violet-600',     borderColor: 'border-violet-300',    bg: 'bg-violet-50',    text: 'text-violet-900',    label: '🆕 Nouveau dossier', tooltip: 'Nouveau dossier' },
  none:   { color: 'bg-slate-300 hover:bg-slate-400',       borderColor: 'border-slate-200',     bg: 'bg-slate-50',     text: 'text-slate-700',     label: '✨ À générer',       tooltip: 'Synthèse IA non générée — cliquer pour générer' },
};

export default function AiInsightTrigger({ registration, onRefresh, size = 'sm' }) {
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [reg, setReg] = useState(registration);
  if (!reg?.id) return null;

  const v = VIGILANCE_VISUALS[reg.ai_insight_vigilance] || (reg.ai_insight ? VIGILANCE_VISUALS.medium : VIGILANCE_VISUALS.none);
  const dim = size === 'xs' ? 'w-5 h-5' : 'w-6 h-6';
  const iconDim = size === 'xs' ? 'w-3 h-3' : 'w-3.5 h-3.5';

  const generate = async (e) => {
    e?.stopPropagation();
    setBusy(true);
    try {
      const r = await api(`/api/registrations/${reg.id}/generate-insight`, { method: 'POST', body: JSON.stringify({}) });
      setReg(prev => ({
        ...prev,
        ai_insight: r.insight,
        ai_insight_vigilance: r.vigilance_level,
        ai_insight_generated_at: new Date().toISOString(),
      }));
      toast.success('✨ Synthèse IA générée');
      onRefresh && onRefresh();
    } catch (err) { toast.error('Erreur IA : ' + err.message); }
    setBusy(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className={`${dim} rounded-full ${v.color} text-white flex items-center justify-center shadow-sm transition-all hover:scale-110`}
          title={reg.ai_insight ? v.tooltip + ' — Cliquer pour voir la synthèse IA' : 'Cliquer pour générer la synthèse IA'}
        >
          <Sparkles className={iconDim} />
        </button>
      </PopoverTrigger>
      <PopoverContent className={`w-96 p-0 border-2 ${v.borderColor} ${v.bg}`} side="left" align="start">
        <div className="p-3">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className={`text-xs font-bold flex items-center gap-1.5 ${v.text}`}>
              <Sparkles className="w-3.5 h-3.5" /> Synthèse IA · {v.label}
            </div>
            <Button size="sm" variant="ghost" disabled={busy} onClick={generate} className="h-6 px-2 text-[10px] gap-1">
              {busy ? <><RefreshCw className="w-3 h-3 animate-spin" /> …</> : <>{reg.ai_insight ? 'Régénérer' : 'Générer'}</>}
            </Button>
          </div>
          {reg.ai_insight ? (
            <>
              <div className={`text-[11px] leading-relaxed ${v.text}`} dangerouslySetInnerHTML={{ __html: reg.ai_insight }} />
              {reg.ai_insight_generated_at && (
                <div className="text-[9px] text-slate-500 mt-2 italic">Générée {new Date(reg.ai_insight_generated_at).toLocaleString('fr-FR')}</div>
              )}
            </>
          ) : (
            <div className="text-[11px] text-slate-600 italic">
              Aucune synthèse IA encore générée. Cliquez sur <b>Générer</b> pour analyser l&apos;historique de cet exposant.
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

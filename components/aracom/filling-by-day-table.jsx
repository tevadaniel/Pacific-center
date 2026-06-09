'use client';

/**
 * 🆕 SESSION 51 — FillingByDayTable
 *
 * Vue "Remplissage" : 1 ligne par site × 1 colonne par jour
 * - Cellule = confirmés/attribués vs capacité du site ce jour-là
 * - Couleur : vert (≥100%) / orange (80-99%) / jaune (50-79%) / rouge (<50%)
 * - Toggle : "Attribués" (occupation réelle) ou "Confirmés strict" (status='confirme')
 * - Un exposant peut être présent jour 1 et absent jour 2 — chaque jour se calcule séparément
 * - Les animations ne comptent PAS (uniquement stands assignés)
 */

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Calendar, RefreshCw, Info } from 'lucide-react';
import { api } from '@/lib/auth-client';
import { toast } from 'sonner';

// Couleur de cellule selon % de remplissage
function cellStyle(percent) {
  if (percent >= 100) return { bg: 'bg-emerald-500', text: 'text-white', label: 'Complet', border: 'border-emerald-600' };
  if (percent >= 80) return { bg: 'bg-amber-400', text: 'text-amber-950', label: 'Presque', border: 'border-amber-500' };
  if (percent >= 50) return { bg: 'bg-yellow-300', text: 'text-yellow-950', label: 'À combler', border: 'border-yellow-400' };
  return { bg: 'bg-red-400', text: 'text-white', label: 'Incomplet', border: 'border-red-500' };
}

export default function FillingByDayTable() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState('attributed'); // 'attributed' | 'confirmed'

  const load = async () => {
    setLoading(true);
    try {
      const d = await api('/api/admin/filling-by-day');
      setData(d);
    } catch (e) {
      toast.error(e?.message || 'Erreur chargement');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-5 text-center text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin inline mr-2" /> Calcul du remplissage…
        </CardContent>
      </Card>
    );
  }
  if (!data) return null;

  const { days, sites, totals } = data;
  const valueKey = mode === 'confirmed' ? 'confirmed' : 'attributed';
  const missingKey = mode === 'confirmed' ? 'missing_confirmed' : 'missing_attributed';
  const percentKey = mode === 'confirmed' ? 'percent_confirmed' : 'percent_attributed';

  return (
    <Card>
      <CardContent className="p-4 md:p-5">
        {/* HEADER */}
        <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-base md:text-lg flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-600" /> Remplissage par jour
            </h2>
            <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
              <Info className="w-3 h-3 shrink-0" />
              <span>
                Stands {mode === 'confirmed' ? 'avec inscription confirmée (status=confirmé)' : 'attribués (occupation réelle)'} / capacité du site.
                Chaque jour se calcule séparément.
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Toggle Attribués / Confirmés */}
            <div className="inline-flex rounded-md border border-slate-300 overflow-hidden text-[11px]">
              <button
                onClick={() => setMode('attributed')}
                className={`px-2.5 py-1 transition ${mode === 'attributed' ? 'bg-blue-600 text-white font-semibold' : 'bg-white text-slate-700 hover:bg-slate-50'}`}
              >
                Attribués
              </button>
              <button
                onClick={() => setMode('confirmed')}
                className={`px-2.5 py-1 transition border-l border-slate-300 ${mode === 'confirmed' ? 'bg-blue-600 text-white font-semibold' : 'bg-white text-slate-700 hover:bg-slate-50'}`}
              >
                Confirmés
              </button>
            </div>
            <button
              onClick={load}
              title="Rafraîchir"
              className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-slate-300 hover:bg-slate-50 text-slate-600"
            >
              <RefreshCw className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* TABLEAU */}
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-3 py-2 font-semibold text-slate-700 uppercase tracking-wider text-[10px]">
                  Site
                </th>
                <th className="text-center px-2 py-2 font-semibold text-slate-700 uppercase tracking-wider text-[10px]">
                  Capacité
                </th>
                {days.map((d) => (
                  <th
                    key={d.value}
                    className="text-center px-2 py-2 font-semibold text-slate-700 uppercase tracking-wider text-[10px] min-w-[120px]"
                  >
                    {d.short}
                    <div className="text-[9px] text-slate-400 font-normal normal-case mt-0.5">{d.label.split(' ').slice(1).join(' ')}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {sites.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50/50">
                  <td className="px-3 py-2 font-semibold text-slate-900">
                    📍 {s.name}
                    {s.code && <span className="ml-1.5 text-[10px] text-slate-400 font-mono font-normal">{s.code}</span>}
                  </td>
                  <td className="text-center px-2 py-2 text-slate-700 font-mono">{s.capacity}</td>
                  {days.map((d) => {
                    const cell = s.per_day[d.value];
                    const value = cell[valueKey];
                    const missing = cell[missingKey];
                    const percent = cell[percentKey];
                    const style = cellStyle(percent);
                    return (
                      <td key={d.value} className="text-center px-1.5 py-1.5">
                        <div className={`inline-flex flex-col items-center justify-center gap-0.5 px-2 py-1.5 rounded-md border ${style.bg} ${style.text} ${style.border} min-w-[96px]`}>
                          <div className="font-bold text-sm leading-none">
                            {value}<span className="opacity-70 font-medium text-[11px]">/{s.capacity}</span>
                          </div>
                          <div className="text-[9px] uppercase tracking-wider font-semibold opacity-90 leading-none">
                            {percent}% · {style.label}
                          </div>
                          {missing > 0 && (
                            <div className="text-[9px] mt-0.5 opacity-90 leading-none">
                              {missing} stand{missing > 1 ? 's' : ''} manquant{missing > 1 ? 's' : ''}
                            </div>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
              {/* Ligne TOTAUX */}
              {totals && (
                <tr className="bg-slate-100 border-t-2 border-slate-300 font-semibold">
                  <td className="px-3 py-2 text-slate-900 uppercase text-[10px] tracking-wider">Total Polynésie</td>
                  <td className="text-center px-2 py-2 text-slate-700 font-mono">
                    {sites.reduce((acc, s) => acc + s.capacity, 0)}
                  </td>
                  {days.map((d) => {
                    const t = totals[d.value];
                    if (!t) return <td key={d.value} />;
                    const style = cellStyle(t[percentKey]);
                    return (
                      <td key={d.value} className="text-center px-1.5 py-1.5">
                        <div className={`inline-flex flex-col items-center justify-center gap-0.5 px-2 py-1.5 rounded-md border ${style.bg} ${style.text} ${style.border} min-w-[96px]`}>
                          <div className="font-bold text-sm leading-none">
                            {t[valueKey]}<span className="opacity-70 font-medium text-[11px]">/{t.capacity}</span>
                          </div>
                          <div className="text-[9px] uppercase tracking-wider font-semibold opacity-90 leading-none">
                            {t[percentKey]}%
                          </div>
                          {t[missingKey] > 0 && (
                            <div className="text-[9px] mt-0.5 opacity-90 leading-none">
                              {t[missingKey]} manquant{t[missingKey] > 1 ? 's' : ''}
                            </div>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* LÉGENDE */}
        <div className="flex flex-wrap items-center gap-2 mt-3 text-[10px]">
          <span className="text-slate-500 font-semibold uppercase tracking-wider">Légende :</span>
          <LegendItem color="bg-emerald-500" label="Complet (≥100%)" />
          <LegendItem color="bg-amber-400" label="Presque (80-99%)" />
          <LegendItem color="bg-yellow-300" label="À combler (50-79%)" />
          <LegendItem color="bg-red-400" label="Incomplet (<50%)" />
          <Badge variant="outline" className="text-[9px] border-slate-300 text-slate-500">
            🎭 Animations exclues du calcul
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

function LegendItem({ color, label }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`inline-block w-3 h-3 rounded ${color} border border-slate-300`} />
      <span className="text-slate-600">{label}</span>
    </span>
  );
}

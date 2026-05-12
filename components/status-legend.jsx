'use client';
import { Badge } from '@/components/ui/badge';
import { HelpCircle } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

// Liste centrale des statuts — utilisée partout dans l'application
export const STATUS_DEFINITIONS = [
  { value: 'prospect',    label: 'Prospect',         color: 'bg-slate-100 text-slate-700 border-slate-300',     desc: 'Association identifiée, pas encore contactée formellement.' },
  { value: 'contacte',    label: 'Contacté',         color: 'bg-blue-100 text-blue-700 border-blue-300',         desc: 'Association contactée, attente de réponse.' },
  { value: 'a_confirmer', label: 'À confirmer',      color: 'bg-amber-100 text-amber-700 border-amber-300',     desc: 'A répondu favorablement, dossier en cours de constitution.' },
  { value: 'a_relancer',  label: 'À relancer',       color: 'bg-orange-100 text-orange-700 border-orange-300',  desc: 'Sans réponse depuis plus de 7 jours.' },
  { value: 'confirme',    label: 'Confirmé',         color: 'bg-emerald-100 text-emerald-700 border-emerald-300', desc: 'Inscription confirmée, caution reçue, documents OK.' },
  { value: 'annule',      label: 'Annulé',           color: 'bg-red-100 text-red-700 border-red-300',           desc: 'Inscription annulée par l\'exposant ou ARACOM.' },
];

const MAP = STATUS_DEFINITIONS.reduce((acc, s) => { acc[s.value] = s; return acc; }, {});

export function StatusBadge({ value, size = 'sm' }) {
  const s = MAP[value] || { label: value || '—', color: 'bg-slate-100 text-slate-600' };
  return <Badge variant="outline" className={`${s.color} font-medium ${size === 'sm' ? 'text-xs' : 'text-sm'}`}>{s.label}</Badge>;
}

export function StatusLegend({ compact = false }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 underline-offset-2 hover:underline" data-testid="status-legend-toggle">
          <HelpCircle className="w-3.5 h-3.5" /> Légende des statuts
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="space-y-2">
          <h4 className="font-semibold text-sm">📋 Statuts d&apos;inscription</h4>
          <p className="text-xs text-slate-500">Chaque exposant passe par ces statuts dans l&apos;ordre, sauf en cas d&apos;annulation.</p>
          <div className="space-y-1.5 pt-1">
            {STATUS_DEFINITIONS.map(s => (
              <div key={s.value} className="flex items-start gap-2">
                <StatusBadge value={s.value} />
                {!compact && <span className="text-[11px] text-slate-600 leading-snug">{s.desc}</span>}
              </div>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default StatusLegend;

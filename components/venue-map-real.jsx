'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { DoorOpen, Search, Printer } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { SVG_PLANS, PLAN_KEY_BY_VENUE, svgCodeToDbCode } from '@/lib/venue-plans';

const STATUS_COLORS = {
  confirme: '#10b981',       // emerald-500
  a_confirmer: '#f59e0b',    // amber-500
  a_relancer: '#f97316',     // orange-500
  prospect: '#94a3b8',       // slate-400
  libre: '#00AEEF',          // original cyan
};

const STATUS_LABELS = {
  confirme: 'Confirmé',
  a_confirmer: 'À confirmer',
  a_relancer: 'À relancer',
  prospect: 'Prospect',
  libre: 'Libre',
};

/**
 * VenueMapReal — Plan terrain SVG officiel avec stands colorés par statut.
 * Props:
 *   venue          : { code, name } — FAAA / PUN / ARU / TAR
 *   stands         : [{ stand_code, organization, registration_status, assignment, ... }]
 *   highlightStandCode : string — met en évidence (animation) un stand spécifique
 *   onStandClick   : (stand) => void — si défini, les stands sont cliquables
 *   mode           : 'status' | 'names' — affiche couleurs ou noms exposants
 */
export default function VenueMapReal({ venue, stands = [], highlightStandCode, onStandClick, mode: initialMode = 'status' }) {
  const svgRef = useRef(null);
  const [search, setSearch] = useState('');
  const [mode, setMode] = useState(initialMode);
  const [hoveredStand, setHoveredStand] = useState(null);

  const planKey = PLAN_KEY_BY_VENUE[venue?.code];
  const plan = planKey ? SVG_PLANS[planKey] : null;

  // Build lookup by db stand_code
  const standByCode = useMemo(() => {
    const m = {};
    stands.forEach(s => { if (s.stand_code) m[s.stand_code] = s; });
    return m;
  }, [stands]);

  // Inject SVG once + apply coloring/handlers on any relevant change
  useEffect(() => {
    if (!svgRef.current || !plan) return;
    const root = svgRef.current;
    // Inject SVG content (only if different to avoid remount)
    if (root.getAttribute('data-plan-key') !== planKey) {
      root.innerHTML = plan.svg;
      root.setAttribute('viewBox', plan.viewBox);
      root.setAttribute('data-plan-key', planKey);
    }
    const snumTexts = root.querySelectorAll('text.snum');
    const handlers = [];

    snumTexts.forEach(textEl => {
      const svgCode = textEl.textContent?.trim();
      if (!svgCode) return;
      const dbCode = svgCodeToDbCode(svgCode);
      const stand = standByCode[dbCode];

      // Find the associated rect (previous sibling)
      let rect = textEl.previousElementSibling;
      while (rect && rect.tagName !== 'rect') rect = rect.previousElementSibling;
      if (!rect) return;

      // Determine status & color
      const status = stand?.organization ? (stand.registration_status || 'prospect') : 'libre';
      const color = STATUS_COLORS[status] || STATUS_COLORS.libre;

      // Search filter dims non-matching stands
      const q = search.trim().toLowerCase();
      const matches = !q ||
        dbCode.toLowerCase().includes(q) ||
        svgCode.toLowerCase().includes(q) ||
        (stand?.organization?.name || '').toLowerCase().includes(q) ||
        (stand?.organization?.discipline || '').toLowerCase().includes(q);

      rect.setAttribute('fill', color);
      rect.style.opacity = matches ? '1' : '0.2';
      rect.style.transition = 'all .25s ease';

      // Highlight stand
      const isHighlighted = highlightStandCode && dbCode === highlightStandCode;
      if (isHighlighted) {
        rect.setAttribute('stroke', '#2563eb');
        rect.setAttribute('stroke-width', '3');
        rect.style.filter = 'drop-shadow(0 0 8px rgba(37,99,235,.8))';
      } else {
        rect.removeAttribute('stroke');
        rect.removeAttribute('stroke-width');
        rect.style.filter = '';
      }

      // Mode: show exposant name instead of stand number
      const snomEl = textEl.nextElementSibling;
      if (snomEl && snomEl.classList.contains('snom')) {
        if (mode === 'names' && stand?.organization?.name) {
          const name = stand.organization.name;
          snomEl.textContent = name.length > 14 ? name.slice(0, 13) + '…' : name;
          snomEl.style.display = '';
          textEl.style.display = 'none';
        } else {
          snomEl.style.display = 'none';
          textEl.style.display = '';
        }
      }

      // Click & hover handlers
      const enterHandler = () => setHoveredStand({ dbCode, stand, status });
      const leaveHandler = () => setHoveredStand(null);
      if (stand) {
        rect.addEventListener('mouseenter', enterHandler);
        rect.addEventListener('mouseleave', leaveHandler);
        handlers.push({ el: rect, enterHandler, leaveHandler });
      }
      if (onStandClick && stand) {
        rect.style.cursor = 'pointer';
        const clickHandler = (e) => { e.stopPropagation(); onStandClick(stand); };
        rect.addEventListener('click', clickHandler);
        handlers[handlers.length - 1].clickHandler = clickHandler;
      }
    });

    return () => {
      handlers.forEach(h => {
        if (h.clickHandler) h.el.removeEventListener('click', h.clickHandler);
        if (h.enterHandler) h.el.removeEventListener('mouseenter', h.enterHandler);
        if (h.leaveHandler) h.el.removeEventListener('mouseleave', h.leaveHandler);
      });
    };
  }, [plan, planKey, standByCode, search, mode, highlightStandCode, onStandClick]);

  if (!plan) {
    return <div className="py-6 text-center text-slate-500 text-sm">Plan terrain non disponible pour ce site (affichage schématique utilisé).</div>;
  }

  const printPlan = () => {
    if (!svgRef.current) return;
    const svgHtml = svgRef.current.outerHTML;
    const rows = stands.map(function(s) {
      const name = (s.organization && s.organization.name) || '—';
      const disc = (s.organization && s.organization.discipline) || '';
      const st = s.registration_status || 'libre';
      return '<tr><td>' + s.stand_code + '</td><td>' + name + '</td><td>' + disc + '</td><td>' + st + '</td></tr>';
    }).join('');
    const title = (venue && venue.name) || '';
    const now = new Date().toLocaleDateString('fr-FR');
    const head = '<style>body{font-family:Arial,sans-serif;padding:20px;background:#fff;color:#000}h1{margin:0 0 4px}.meta{color:#666;font-size:12px;margin-bottom:16px}.plan{background:#0f172a;padding:12px;border-radius:8px;margin-bottom:20px}svg{width:100%;height:auto;display:block}table{border-collapse:collapse;width:100%;font-size:12px;margin-top:12px}th,td{border:1px solid #cbd5e1;padding:6px 8px;text-align:left}th{background:#f1f5f9;font-weight:600}@media print{.no-print{display:none}}</style>';
    const body = '<h1>Plan terrain — ' + title + '</h1><div class="meta">Forum de la Rentrée 2026 — ' + now + ' — ' + stands.length + ' stands</div><div class="plan">' + svgHtml + '</div><h2 style="margin-top:24px">Liste des stands et exposants</h2><table><thead><tr><th>Stand</th><th>Exposant</th><th>Discipline</th><th>Statut</th></tr></thead><tbody>' + rows + '</tbody></table>';
    const w = window.open('', '_blank', 'width=1200,height=900');
    if (!w) return;
    w.document.write('<!doctype html><html><head><title>Plan ' + title + '</title>' + head + '</head><body>' + body + '</body></html>');
    w.document.close();
    setTimeout(function() { w.print(); }, 600);
  };

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
        <div className="inline-flex rounded-md border bg-slate-100 p-0.5">
          <button onClick={() => setMode('status')} className={`px-3 py-1 text-xs font-medium rounded ${mode === 'status' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}>Numéros</button>
          <button onClick={() => setMode('names')} className={`px-3 py-1 text-xs font-medium rounded ${mode === 'names' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}>Noms exposants</button>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5 h-9" onClick={printPlan}><Printer className="w-3.5 h-3.5" /> Imprimer</Button>
      </div>

      {/* Vrai plan SVG */}
      <div className="relative rounded-xl overflow-hidden border bg-black shadow-lg">
        <div className="flex items-center justify-between bg-gradient-to-r from-slate-900 to-slate-800 px-4 py-2 text-white text-xs">
          <div className="flex items-center gap-2">
            <DoorOpen className="w-3.5 h-3.5 text-emerald-400" />
            <span className="font-semibold">Plan officiel — {venue?.name}</span>
          </div>
          <span className="text-slate-400">{stands.length} stands</span>
        </div>
        <div className="p-2 sm:p-4">
          <svg
            ref={svgRef}
            xmlns="http://www.w3.org/2000/svg"
            className="w-full h-auto"
            style={{ fontFamily: 'Barlow, sans-serif' }}
          />
        </div>
      </div>

      {/* Tooltip info on hover */}
      {hoveredStand && (
        <div className="rounded-lg border-2 border-blue-300 bg-blue-50 p-3 text-sm">
          <div className="flex items-center gap-3">
            <span className="inline-block w-3 h-3 rounded" style={{ background: STATUS_COLORS[hoveredStand.status] }} />
            <span className="font-mono font-bold">{hoveredStand.dbCode}</span>
            {hoveredStand.stand.organization ? (
              <>
                <span className="font-semibold">{hoveredStand.stand.organization.name}</span>
                <span className="text-slate-500">— {hoveredStand.stand.organization.discipline}</span>
                <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-white border font-medium">{STATUS_LABELS[hoveredStand.status]}</span>
              </>
            ) : (
              <span className="text-slate-400 italic">Stand libre</span>
            )}
          </div>
        </div>
      )}

      {/* Légende */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 px-2">
        {Object.entries(STATUS_COLORS).map(([k, c]) => (
          <span key={k} className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded" style={{ background: c }} />
            {STATUS_LABELS[k]}
            <span className="text-slate-400">({counts[k] || 0})</span>
          </span>
        ))}
        {highlightStandCode && <span className="flex items-center gap-1.5 ml-auto"><span className="inline-block w-3 h-3 rounded border-2 border-blue-600" /> Votre stand</span>}
      </div>
    </div>
  );
}

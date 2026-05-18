'use client';

/**
 * 🛡️ IntegrityAuditButton — Bouton "Audit système" dans le header Aracom
 *
 * - Clic → lance /api/maintenance/audit (heal=true)
 * - Affiche un toast avec le résultat
 * - Badge orange si dernière exécution avait des issues
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Shield, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/auth-client';

export default function IntegrityAuditButton() {
  const [running, setRunning] = useState(false);
  const [lastReport, setLastReport] = useState(null);

  const run = async () => {
    setRunning(true);
    try {
      const r = await api('/api/maintenance/audit', { method: 'POST', body: JSON.stringify({ heal: true }) });
      setLastReport(r);
      if (r.total_healed > 0) {
        toast.success(`🛡️ ${r.total_healed} incohérence(s) réparée(s) automatiquement`);
      } else if (r.total_issues > 0) {
        toast.warning(`${r.total_issues} alerte(s) — ${r.total_warnings} nécessitent une action manuelle`);
      } else {
        toast.success('✅ Tout est cohérent — aucune réparation nécessaire');
      }
    } catch (e) {
      toast.error('Erreur audit : ' + e.message);
    } finally {
      setRunning(false);
    }
  };

  // Affichage compact
  const hasIssues = lastReport && (lastReport.total_issues || 0) > 0;

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={run}
      disabled={running}
      title="Audit complet de l'intégrité des données. Répare automatiquement les incohérences (orgs sans user, tokens orphelins, animations orphelines, etc.)"
      className={`gap-1.5 h-8 text-xs ${hasIssues ? 'border-amber-400 text-amber-700 hover:bg-amber-50' : ''}`}
    >
      {running ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : hasIssues ? (
        <AlertTriangle className="w-3.5 h-3.5" />
      ) : (
        <Shield className="w-3.5 h-3.5" />
      )}
      Audit
      {hasIssues && (
        <Badge className="bg-amber-500 text-white text-[9px] h-4 px-1.5 ml-1">{lastReport.total_issues}</Badge>
      )}
    </Button>
  );
}

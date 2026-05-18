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
      // Étape 1 : audit (heal=true par défaut)
      const audit = await api('/api/maintenance/audit', { method: 'POST', body: JSON.stringify({ heal: true }) });
      // Étape 2 : cleanup (déduplique users, vide corbeille, purge tokens anciens)
      const cleanup = await api('/api/maintenance/cleanup', { method: 'POST', body: JSON.stringify({}) });
      const totalCleaned = (cleanup.actions || []).reduce((acc, a) => acc + (a.count || 0), 0);
      const totalHealed = audit.total_healed || 0;
      setLastReport(audit);
      if (totalHealed > 0 || totalCleaned > 0) {
        toast.success(`🛡️ ${totalHealed} cohérence(s) réparée(s) · 🧹 ${totalCleaned} entrée(s) nettoyée(s)`);
      } else if ((audit.total_issues || 0) > 0) {
        toast.warning(`${audit.total_issues} alerte(s) — review manuelle`);
      } else {
        toast.success('✅ Base 100% propre — rien à nettoyer');
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

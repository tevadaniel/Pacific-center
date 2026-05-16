'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import AiInsightTrigger from '@/components/ai-insight-trigger';
import { api } from '@/lib/auth-client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ExposantLink } from './exposant-panel-context';

/**
 * ANOMALIES VIEW — Vue admin des anomalies détectées sur les inscriptions
 * (caution non payée, départ anticipé, retard important, etc.)
 *
 * Endpoint utilisé : GET /api/anomalies, PUT /api/anomalies/:id (résolution).
 */
export default function AnomaliesView() {
  const [rows, setRows] = useState([]);
  const load = () => api('/api/anomalies').then(setRows);
  useEffect(() => { load(); }, []);
  const resolve = async (id) => {
    await api(`/api/anomalies/${id}`, { method: 'PUT', body: JSON.stringify({ resolved_status: 'resolu', resolution_comment: 'Résolue à l\u2019administration' }) });
    toast.success('Anomalie résolue');
    load();
  };
  return (
    <Card><CardContent className="p-0">
      {rows.length === 0 ? <div className="py-12 text-center text-slate-500">Aucune anomalie détectée. 👍</div> : (
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="py-2 px-4">Exposant</th>
              <th>Site</th>
              <th>Type</th>
              <th>Gravité</th>
              <th>Statut</th>
              <th>Date</th>
              <th></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map(a => (
              <tr key={a.id}>
                <td className="py-2 px-4 font-medium">
                  <div className="flex items-center gap-1.5">
                    {a.registration_id && <AiInsightTrigger registration={{ id: a.registration_id }} size="xs" />}
                    <ExposantLink id={a.registration_id} className="font-medium">{a.organization_name}</ExposantLink>
                  </div>
                </td>
                <td>{a.venue_name}</td>
                <td className="text-xs">{a.anomaly_type}</td>
                <td><Badge variant={a.severity_level === 'critique' || a.severity_level === 'haute' ? 'destructive' : 'secondary'}>{a.severity_level}</Badge></td>
                <td>{a.resolved_status}</td>
                <td className="text-xs text-slate-500">{new Date(a.detected_at).toLocaleString('fr-FR')}</td>
                <td className="pr-4">{a.resolved_status !== 'resolu' && <Button size="sm" variant="ghost" onClick={() => resolve(a.id)}>Marquer résolu</Button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </CardContent></Card>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Loader2, Trash2 } from 'lucide-react';
import { api } from '@/lib/auth-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import DeleteOrgDialog from './delete-org-dialog';

/**
 * CORBEILLE — Vue admin des organisations archivées.
 *
 * Permet de :
 *  - Lister les exposants archivés (GET /api/organizations?only_archived=true)
 *  - Rechercher par nom
 *  - Restaurer (POST /api/admin/organizations/:id/restore)
 *  - Supprimer définitivement (DeleteOrgDialog)
 *
 * Réservée aux admins ARACOM (le backend renvoie 403 sinon).
 */
export default function CorbeilleView() {
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(null);
  const [toDelete, setToDelete] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api('/api/organizations?only_archived=true');
      setOrgs(data || []);
    } catch (e) { toast.error(e.message); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const restore = async (org) => {
    if (!window.confirm(`Restaurer "${org.name}" ? L'organisation redeviendra active. Note : les inscriptions restent en statut "annulé" et devront être réactivées manuellement.`)) return;
    setBusy(org.id);
    try {
      const r = await fetch(`/api/admin/organizations/${org.id}/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-role': 'aracom_admin', 'x-user-id': 'u-admin' },
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Erreur restauration');
      toast.success(`♻️ ${org.name} restauré`);
      load();
    } catch (e) { toast.error(e.message); }
    finally { setBusy(null); }
  };

  const filtered = orgs.filter(o => !search || (o.name || '').toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-4">
      <Card className="border-amber-300">
        <CardHeader className="bg-gradient-to-r from-amber-50 to-orange-50">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Trash2 className="w-5 h-5 text-amber-700" /> Corbeille — Exposants archivés
              </CardTitle>
              <p className="text-xs text-slate-600 mt-1">
                Les exposants archivés conservent toutes leurs données (registrations, cautions, documents). Ils peuvent être <b>restaurés à tout moment</b>, ou <b>supprimés définitivement</b>.
              </p>
            </div>
            <Badge variant="outline" className="bg-amber-100 text-amber-900 border-amber-300 text-sm">{orgs.length} archivé(s)</Badge>
          </div>
          <div className="mt-3">
            <Input
              placeholder="🔍 Rechercher un exposant archivé…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-white"
            />
          </div>
        </CardHeader>
        <CardContent className="p-3">
          {loading ? (
            <div className="text-center py-8 text-slate-500">Chargement…</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-slate-500 italic">
              {orgs.length === 0 ? '🌱 Corbeille vide — aucun exposant n\'a été archivé.' : 'Aucun résultat pour cette recherche.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-[10px] uppercase tracking-wider text-slate-500 border-b">
                  <tr>
                    <th className="text-left p-2">Exposant</th>
                    <th className="text-left p-2">Discipline</th>
                    <th className="text-left p-2">Archivé le</th>
                    <th className="text-left p-2">Motif</th>
                    <th className="text-right p-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(o => (
                    <tr key={o.id} className="border-b hover:bg-slate-50">
                      <td className="p-2">
                        <div className="font-semibold text-slate-800">{o.name}</div>
                        <div className="text-xs text-slate-500">{o.contact_name || ''} {o.main_email && `· ${o.main_email}`}</div>
                      </td>
                      <td className="p-2 text-xs text-slate-700">{o.discipline || '—'}</td>
                      <td className="p-2 text-xs text-slate-700">
                        {o.archived_at ? new Date(o.archived_at).toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                      </td>
                      <td className="p-2 text-xs text-slate-600 italic max-w-xs truncate" title={o.archive_reason || ''}>
                        {o.archive_reason || <span className="text-slate-400">—</span>}
                      </td>
                      <td className="p-2 text-right">
                        <div className="flex gap-1 justify-end">
                          <Button size="sm" variant="outline" onClick={() => restore(o)} disabled={busy === o.id} className="h-7 text-xs gap-1 border-emerald-300 text-emerald-700 hover:bg-emerald-50">
                            {busy === o.id ? <Loader2 className="w-3 h-3 animate-spin" /> : '♻️'} Restaurer
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setToDelete(o)} className="h-7 text-xs gap-1 bg-zinc-900 text-white hover:bg-black border-black">
                            <Trash2 className="w-3 h-3" /> Supprimer définitivement
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {toDelete && (
        <DeleteOrgDialog
          org={toDelete}
          onClose={() => setToDelete(null)}
          onDeleted={() => { setToDelete(null); load(); }}
        />
      )}
    </div>
  );
}

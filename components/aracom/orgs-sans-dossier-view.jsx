'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Loader2, AlertCircle, Plus, Search } from 'lucide-react';
import { api } from '@/lib/auth-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';

/**
 * 🆕 SESSION 28d — Vue admin "Organisations sans dossier 2026"
 *
 * Liste les organisations en base qui n'ont AUCUNE registration active pour l'édition 2026.
 * L'admin peut initialiser un dossier en un clic, optionnellement avec un site présélectionné.
 *
 * Utilité : quand on inscrit manuellement une organisation en base (via import ou direct DB),
 * il faut aussi créer la registration qui lie l'org au Forum 2026, sinon le portail exposant
 * affiche "Votre dossier n'a pas encore été initialisé".
 *
 * Endpoints utilisés :
 *  - GET /api/organizations
 *  - GET /api/exposants (avec registration_id pour filtrer)
 *  - GET /api/venues
 *  - POST /api/admin/organizations/:id/initialize-registration
 */
export default function OrgsSansDossierView() {
  const [orgs, setOrgs] = useState([]);
  const [exposants, setExposants] = useState([]);
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(null);
  const [venueByOrg, setVenueByOrg] = useState({}); // org_id -> venue_id sélectionné
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0, ok: 0, ko: 0 });
  const [bulkDefaultVenue, setBulkDefaultVenue] = useState(''); // site par défaut pour le bulk

  const load = async () => {
    setLoading(true);
    try {
      const [allOrgs, allRegs, allVenues] = await Promise.all([
        api('/api/organizations'),
        api('/api/registrations'),
        api('/api/venues'),
      ]);
      setOrgs(allOrgs || []);
      setExposants(allRegs || []);
      setVenues(allVenues || []);
    } catch (e) { toast.error(e.message); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  // Calcule les orgs sans dossier 2026 actif (croisement orgs / registrations)
  const orgsWithReg = new Set(
    (exposants || [])
      .filter(r => r.status !== 'annule' && !r.is_archived)
      .map(r => r.organization_id)
      .filter(Boolean)
  );
  const orgsSansDossier = orgs.filter(o => !orgsWithReg.has(o.id) && !o.archived_at);

  const filtered = orgsSansDossier.filter(o =>
    !search ||
    (o.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (o.main_email || '').toLowerCase().includes(search.toLowerCase())
  );

  const initialize = async (org) => {
    const venue_id = venueByOrg[org.id] || null;
    const venueName = venue_id ? venues.find(v => v.id === venue_id)?.name : null;
    const msg = venue_id
      ? `Initialiser un dossier 2026 pour "${org.name}" sur le site ${venueName} ?\n\nL'exposant pourra ensuite se connecter et compléter son inscription.`
      : `Initialiser un dossier 2026 pour "${org.name}" sans site présélectionné ?\n\nL'exposant choisira son site lui-même.`;
    if (!window.confirm(msg)) return;
    setBusy(org.id);
    try {
      // 🔧 Utilise le helper api() qui injecte automatiquement les headers d'auth (session)
      const j = await api(`/api/admin/organizations/${org.id}/initialize-registration`, {
        method: 'POST',
        body: JSON.stringify({ venue_id }),
      });
      toast.success(`✅ Dossier créé pour ${org.name} — id : ${(j.registration_id || '').slice(0, 12)}…`);
      load();
    } catch (e) {
      toast.error(`❌ ${org.name} : ${e.message}`);
      console.error('[initialize]', e);
    }
    finally { setBusy(null); }
  };

  // 🆕 Initialisation en lot — traite toutes les orgs filtrées affichées
  const bulkInitialize = async () => {
    const targets = filtered;
    if (targets.length === 0) return;
    const venueName = bulkDefaultVenue ? venues.find(v => v.id === bulkDefaultVenue)?.name : null;
    const sitePart = bulkDefaultVenue
      ? `sur le site « ${venueName} »`
      : `sans site présélectionné (chaque exposant choisira le sien)`;
    const msg = `Initialiser ${targets.length} dossier(s) 2026 en lot ${sitePart} ?\n\nLes sites individuellement sélectionnés ci-dessous seront utilisés en priorité, sinon le site par défaut ci-dessus s'applique.`;
    if (!window.confirm(msg)) return;

    setBulkBusy(true);
    setBulkProgress({ done: 0, total: targets.length, ok: 0, ko: 0 });
    let ok = 0, ko = 0;
    const failed = [];

    for (let i = 0; i < targets.length; i++) {
      const org = targets[i];
      const venue_id = venueByOrg[org.id] || bulkDefaultVenue || null;
      try {
        await api(`/api/admin/organizations/${org.id}/initialize-registration`, {
          method: 'POST',
          body: JSON.stringify({ venue_id }),
        });
        ok++;
      } catch (e) {
        ko++;
        failed.push(`${org.name}: ${e.message}`);
        console.error('[bulk init]', org.name, e);
      }
      setBulkProgress({ done: i + 1, total: targets.length, ok, ko });
    }

    setBulkBusy(false);
    if (ok > 0) toast.success(`✅ ${ok} dossier(s) initialisé(s)${ko ? ` · ${ko} échec(s)` : ''}`);
    if (ko > 0) toast.error(`${ko} échec(s) :\n${failed.slice(0, 3).join('\n')}${ko > 3 ? `\n+ ${ko - 3} autre(s)…` : ''}`);
    load();
  };

  if (loading) {
    return (
      <div className="py-16 text-center text-slate-500">
        <Loader2 className="w-6 h-6 animate-spin mx-auto" />
        <p className="text-sm mt-2">Chargement…</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="border-amber-300 bg-amber-50">
        <CardContent className="p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-900">
            <p className="font-semibold mb-1">Organisations sans dossier d&apos;inscription au Forum 2026</p>
            <p className="text-amber-800">
              Ces organisations existent en base mais n&apos;ont <b>aucune inscription active</b> pour l&apos;édition 2026.
              Tant que le dossier n&apos;est pas initialisé, l&apos;exposant voit le message <i>&quot;Votre dossier n&apos;a pas encore été initialisé&quot;</i> dans son portail.
            </p>
            <p className="text-amber-800 mt-1.5">
              💡 <b>Initialisez le dossier</b> pour permettre à l&apos;exposant de se connecter et compléter son inscription (site, stand, animations, documents).
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600" />
              Organisations sans dossier ({filtered.length})
            </CardTitle>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher…"
                className="pl-8 h-9 w-64"
              />
            </div>
          </div>

          {/* 🚀 BARRE BULK — initialiser toutes les orgs filtrées en un clic */}
          {filtered.length > 0 && (
            <div className="mt-3 p-3 rounded-md border-2 border-emerald-200 bg-emerald-50 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1 text-sm text-emerald-900">
                <b>⚡ Action en lot :</b> initialiser les <b>{filtered.length}</b> dossier(s) listé(s) en un seul clic.
                {' '}Les sites sélectionnés individuellement ci-dessous ont priorité, sinon le site par défaut ci-contre est utilisé.
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Select
                  value={bulkDefaultVenue || ''}
                  onValueChange={(v) => setBulkDefaultVenue(v === '__none__' ? '' : v)}
                >
                  <SelectTrigger className="w-48 h-9 text-xs bg-white">
                    <SelectValue placeholder="Site par défaut (optionnel)…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Aucun site (l&apos;exposant choisit) —</SelectItem>
                    {venues.map(v => (
                      <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  onClick={bulkInitialize}
                  disabled={bulkBusy || filtered.length === 0}
                  className="bg-emerald-600 hover:bg-emerald-700 gap-1.5"
                >
                  {bulkBusy
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> {bulkProgress.done}/{bulkProgress.total}…</>
                    : <><Plus className="w-3.5 h-3.5" /> Tout initialiser ({filtered.length})</>
                  }
                </Button>
              </div>
            </div>
          )}

          {/* Barre de progression pendant le bulk */}
          {bulkBusy && (
            <div className="mt-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-md text-xs">
              <div className="flex items-center justify-between mb-1">
                <span className="text-blue-900 font-semibold">Initialisation en cours…</span>
                <span className="text-blue-700">{bulkProgress.done}/{bulkProgress.total} traité(s) — ✅ {bulkProgress.ok} · ❌ {bulkProgress.ko}</span>
              </div>
              <div className="h-1.5 bg-blue-200 rounded-full overflow-hidden">
                <div className="h-full bg-blue-600 transition-all" style={{ width: `${bulkProgress.total > 0 ? (bulkProgress.done / bulkProgress.total) * 100 : 0}%` }} />
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="py-10 text-center text-slate-500 text-sm">
              {search
                ? '🔍 Aucune organisation ne correspond à votre recherche.'
                : '✨ Toutes les organisations actives ont un dossier 2026. Rien à initialiser.'}
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map(org => (
                <div key={org.id} className="border border-slate-200 rounded-md p-3 bg-white hover:bg-slate-50 transition flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-900">{org.name || <i className="text-slate-400">— Sans nom —</i>}</span>
                      {org.discipline && <Badge variant="outline" className="text-[10px]">{org.discipline}</Badge>}
                      {org.priority_level && <Badge variant="outline" className="text-[10px] bg-violet-50 text-violet-700 border-violet-200">P{org.priority_level}</Badge>}
                      {org.source && <Badge variant="outline" className="text-[10px] text-slate-500">{org.source}</Badge>}
                    </div>
                    <div className="text-xs text-slate-500 mt-1 flex flex-wrap gap-x-3">
                      {org.main_email && <span>📧 {org.main_email}</span>}
                      {org.main_phone && <span>📞 {org.main_phone}</span>}
                      {org.contact_name && <span>👤 {org.contact_name}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 sm:flex-shrink-0">
                    <Select
                      value={venueByOrg[org.id] || ''}
                      onValueChange={(v) => setVenueByOrg({ ...venueByOrg, [org.id]: v === '__none__' ? null : v })}
                    >
                      <SelectTrigger className="w-44 h-8 text-xs">
                        <SelectValue placeholder="Site (optionnel)…" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— Aucun site —</SelectItem>
                        {venues.map(v => (
                          <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      onClick={() => initialize(org)}
                      disabled={busy === org.id}
                      className="bg-emerald-600 hover:bg-emerald-700 gap-1.5"
                    >
                      {busy === org.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                      Initialiser dossier
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

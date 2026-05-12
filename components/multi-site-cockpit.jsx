'use client';
import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, MapPin, Users, Loader2, ArrowLeftRight, Calendar, Music, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

async function api(path) {
  const r = await fetch(`/api${path}`, { headers: { 'x-user-role': 'aracom_admin', 'x-user-id': 'u-admin' } });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || 'Erreur API');
  return j;
}

export default function MultiSiteCockpit() {
  const [alerts, setAlerts] = useState(null);
  const [loadingAlerts, setLoadingAlerts] = useState(true);
  const [venues, setVenues] = useState([]);
  const [selectedVenue, setSelectedVenue] = useState(null);
  const [siteView, setSiteView] = useState(null);
  const [loadingSite, setLoadingSite] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [a, v] = await Promise.all([api('/admin/multi-site-alerts'), api('/venues')]);
        setAlerts(a);
        setVenues(Array.isArray(v) ? v : []);
        if (Array.isArray(v) && v.length > 0) setSelectedVenue(v[0].id);
      } catch (e) { toast.error(e.message); }
      finally { setLoadingAlerts(false); }
    })();
  }, []);

  useEffect(() => {
    if (!selectedVenue) return;
    let cancelled = false;
    setLoadingSite(true);
    api(`/admin/site-view/${selectedVenue}`)
      .then(d => { if (!cancelled) setSiteView(d); })
      .catch(e => toast.error(e.message))
      .finally(() => { if (!cancelled) setLoadingSite(false); });
    return () => { cancelled = true; };
  }, [selectedVenue]);

  if (loadingAlerts) return <div className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin inline" /></div>;

  return (
    <div className="space-y-6">
      {/* === ALERTES MULTI-SITES === */}
      <Card>
        <CardContent className="p-5">
          <h2 className="font-bold text-lg flex items-center gap-2 mb-3">
            <AlertTriangle className="w-5 h-5 text-amber-600" /> Alertes multi-sites
          </h2>

          {/* Sites surbookés */}
          {alerts?.overloaded_sites?.length > 0 ? (
            <div className="mb-4">
              <div className="text-sm font-semibold text-red-700 mb-2">🔴 Sites concentrant trop d&apos;exposants (moyenne : {alerts.avg_per_site}/site)</div>
              {alerts.overloaded_sites.map(o => (
                <div key={o.venue_id} className="border-2 border-red-200 bg-red-50/50 rounded-lg p-3 mb-2">
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-red-900">{o.venue_name} — {o.count} exposants</div>
                    <Badge variant="outline" className="bg-red-100 border-red-300 text-red-800">+{Math.round(o.count - o.avg)} vs moyenne</Badge>
                  </div>
                  <div className="text-xs text-red-700 mt-2">Les autres sites sont moins sollicités. Liste chronologique :</div>
                  <div className="mt-2 max-h-40 overflow-y-auto bg-white rounded border border-red-200 divide-y divide-red-100">
                    {o.registrations.map((r, idx) => (
                      <div key={r.registration_id} className="px-2 py-1.5 text-xs flex items-center justify-between hover:bg-red-50">
                        <span><span className="font-mono text-red-500 mr-2">#{idx + 1}</span><b>{r.org_name}</b></span>
                        <span className="text-[10px] text-slate-500">{new Date(r.created_at).toLocaleDateString('fr-FR')} · {r.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-slate-500 mb-3">✓ Aucun site n&apos;est significativement plus chargé que les autres.</div>
          )}

          {/* Doublons exposants */}
          {alerts?.duplicate_exposants?.length > 0 && (
            <div>
              <div className="text-sm font-semibold text-amber-700 mb-2">⚠ Exposants présents sur plusieurs sites — ils doivent en choisir un et libérer les autres :</div>
              <div className="space-y-1.5 max-h-72 overflow-y-auto">
                {alerts.duplicate_exposants.map(d => (
                  <div key={d.org_id} className="border border-amber-200 bg-amber-50/40 rounded p-2 text-sm flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <div className="font-medium text-slate-900">{d.org_name}</div>
                      <div className="text-[11px] text-amber-700">Sites : {d.venues.map(v => v.venue_name).join(' · ')}</div>
                    </div>
                    <Badge variant="outline" className="bg-amber-100 border-amber-300 text-amber-800">{d.venues.length} sites</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* === VUE PAR SITE SWITCHABLE === */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
            <h2 className="font-bold text-lg flex items-center gap-2"><MapPin className="w-5 h-5 text-blue-600" /> Vue par site</h2>
            <div className="flex items-center gap-2">
              <ArrowLeftRight className="w-4 h-4 text-slate-400" />
              <select
                value={selectedVenue || ''}
                onChange={e => setSelectedVenue(e.target.value)}
                className="border rounded-md px-3 py-1.5 text-sm font-medium bg-white"
                data-testid="site-switcher"
              >
                {venues.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
          </div>

          {loadingSite ? (
            <div className="py-8 text-center text-slate-400"><Loader2 className="w-5 h-5 animate-spin inline mr-2" />Chargement…</div>
          ) : !siteView ? (
            <div className="text-slate-400">Sélectionnez un site.</div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <KpiBlock icon="👥" label="Exposants" value={siteView.exposants.length} />
                <KpiBlock icon="✓" label="Confirmés" value={siteView.confirmed_count} color="emerald" />
                <KpiBlock icon="🎭" label="Animations" value={siteView.animations_total} color="violet" />
                <KpiBlock icon="🗺️" label="Capacité" value={siteView.venue.capacity_stands} color="slate" />
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {siteView.exposants.length === 0 ? (
                  <div className="text-center text-slate-400 py-6">Aucun exposant sur ce site.</div>
                ) : siteView.exposants.map(e => (
                  <div key={e.registration_id} className="border rounded-lg p-3 bg-white hover:bg-slate-50 transition">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-slate-900 truncate">{e.org_name}</div>
                        <div className="text-xs text-slate-500">{e.discipline} · {e.contact_name}</div>
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {e.stand_code && <Badge variant="outline" className="bg-blue-50 border-blue-200 text-blue-800 text-[10px]"><MapPin className="w-3 h-3 mr-1" />{e.stand_code}</Badge>}
                          {e.attending_days?.map(d => (
                            <Badge key={d} variant="outline" className="bg-slate-50 border-slate-200 text-slate-700 text-[10px]"><Calendar className="w-3 h-3 mr-1" />{d === 'samedi' ? 'Sam' : 'Ven'}{e.attending_day_times?.[d] ? ` ${e.attending_day_times[d].start}-${e.attending_day_times[d].end}` : ''}</Badge>
                          ))}
                          <Badge variant="outline" className={`text-[10px] ${e.status === 'confirme' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>{e.status}</Badge>
                        </div>
                        {e.animations?.length > 0 && (
                          <div className="mt-2 text-[11px] text-violet-700 space-y-0.5">
                            {e.animations.map(a => (
                              <div key={a.id} className="flex items-center gap-1.5">
                                <Music className="w-3 h-3" />
                                <b>{a.day_label === 'samedi' ? 'Sam' : 'Ven'} {a.start_time}–{a.end_time}</b> · {a.title}
                                <Badge variant="outline" className="text-[9px] border-violet-300 text-violet-600">{a.location_type === 'sur_stand' ? 'Sur stand' : 'Zone démo'}</Badge>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function KpiBlock({ icon, label, value, color = 'blue' }) {
  const colorMap = {
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    violet: 'bg-violet-50 border-violet-200 text-violet-700',
    slate: 'bg-slate-50 border-slate-200 text-slate-700',
  };
  return (
    <div className={`border rounded-lg p-3 text-center ${colorMap[color]}`}>
      <div className="text-2xl">{icon}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
      <div className="text-[10px] uppercase tracking-wider">{label}</div>
    </div>
  );
}

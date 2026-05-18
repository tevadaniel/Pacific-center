'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Sparkles, Star, Users, AlertCircle, CheckCircle2, FileText } from 'lucide-react';
import { api } from '@/lib/auth-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

/**
 * SATISFACTION ADMIN VIEW — Vue admin du module de satisfaction.
 */
export default
function SatisfactionAdminView() {
  const [stats, setStats] = useState(null);
  const [surveys, setSurveys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [postEvent, setPostEvent] = useState({ unlocked: false, unlocked_at: null, unlocked_by: null });
  const [togglingPE, setTogglingPE] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [s, list, pe] = await Promise.all([
        api('/api/satisfaction/stats'),
        api('/api/satisfaction'),
        api('/api/post-event-status').catch(() => ({ unlocked: false })),
      ]);
      setStats(s);
      setSurveys(list);
      setPostEvent(pe || { unlocked: false });
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const togglePostEvent = async () => {
    const next = !postEvent.unlocked;
    const confirmMsg = next
      ? '⚠️ Activer la phase post-événement ?\n\nCela débloquera l\'onglet Satisfaction côté Exposants et permettra la collecte des retours. À utiliser après le forum.'
      : 'Désactiver la phase post-événement ?\n\nLes exposants ne pourront plus répondre au questionnaire de satisfaction.';
    if (!confirm(confirmMsg)) return;
    setTogglingPE(true);
    try {
      const res = await api('/api/post-event-status', { method: 'POST', body: JSON.stringify({ unlocked: next }) });
      setPostEvent(p => ({ ...p, unlocked: res.unlocked, unlocked_at: next ? new Date().toISOString() : null }));
      toast.success(next ? '✅ Phase post-événement activée. Les exposants peuvent désormais répondre.' : 'Phase post-événement désactivée.');
    } catch (e) { toast.error(e.message); }
    finally { setTogglingPE(false); }
  };

  if (loading) return <div className="py-12 text-center text-slate-500">Chargement…</div>;
  if (!stats) return null;

  const npsColor = stats.nps === null ? 'slate' : stats.nps >= 50 ? 'emerald' : stats.nps >= 0 ? 'amber' : 'rose';
  const npsColorCls = { slate: 'text-slate-400', emerald: 'text-emerald-600', amber: 'text-amber-600', rose: 'text-rose-600' };

  return (
    <div className="space-y-5">
      {/* Bannière phase post-événement */}
      <div
        className={`rounded-xl border-2 p-4 flex items-center justify-between gap-4 flex-wrap ${
          postEvent.unlocked
            ? 'bg-emerald-50 border-emerald-300'
            : 'bg-amber-50 border-amber-300'
        }`}
        data-testid="post-event-banner"
      >
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl ${postEvent.unlocked ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'}`}>
            {postEvent.unlocked ? '🟢' : '🔒'}
          </div>
          <div>
            <div className="font-bold text-slate-900">
              {postEvent.unlocked ? 'Phase post-événement ACTIVE' : 'Phase post-événement verrouillée'}
            </div>
            <div className="text-xs text-slate-600">
              {postEvent.unlocked
                ? `Les exposants peuvent répondre au questionnaire de satisfaction.${postEvent.unlocked_at ? ` Activée le ${new Date(postEvent.unlocked_at).toLocaleDateString('fr-FR')}.` : ''}`
                : 'À activer après le forum pour permettre la collecte des retours exposants.'}
            </div>
          </div>
        </div>
        <Button
          onClick={togglePostEvent}
          disabled={togglingPE}
          className={postEvent.unlocked ? 'bg-rose-600 hover:bg-rose-700 text-white gap-2' : 'bg-emerald-600 hover:bg-emerald-700 text-white gap-2'}
          data-testid="toggle-post-event"
        >
          {togglingPE ? '…' : postEvent.unlocked ? '🔒 Désactiver' : '🚀 Activer post-événement'}
        </Button>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2"><ThumbsUp className="w-5 h-5 text-emerald-600" /> Satisfaction des exposants</h2>
          <p className="text-sm text-slate-500">Retours post-événement — {stats.total_responses}/{stats.total_eligible} réponses ({stats.response_rate}% de participation)</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => exportSatisfactionCSV(surveys)} disabled={surveys.length === 0} className="gap-2"><Download className="w-4 h-4" /> Export CSV</Button>
          <Button variant="outline" size="sm" onClick={load} className="gap-2"><RefreshCw className="w-4 h-4" /> Actualiser</Button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <StatKpi label="Réponses" value={stats.total_responses} hint={`${stats.response_rate}% de participation`} icon={ThumbsUp} color="emerald" />
        <StatKpi label="Note globale" value={stats.avg_overall ? stats.avg_overall.toFixed(1) : '—'} hint="sur 5" icon={Star} color="amber" />
        <StatKpi label="Organisation" value={stats.avg_organization ? stats.avg_organization.toFixed(1) : '—'} hint="sur 5" color="blue" />
        <StatKpi label="Stand" value={stats.avg_stand ? stats.avg_stand.toFixed(1) : '—'} hint="sur 5" color="violet" />
        <StatKpi label="Visiteurs" value={stats.avg_visitors ? stats.avg_visitors.toFixed(1) : '—'} hint="sur 5" color="pink" />
        <StatKpi label="NPS" value={stats.nps !== null ? stats.nps : '—'} hint="score de recommandation" icon={Smile} colorCls={npsColorCls[npsColor]} />
      </div>

      {/* Will participate breakdown + by site */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Calendar className="w-4 h-4 text-violet-600" /> Prochaine édition</CardTitle></CardHeader>
          <CardContent>
            {stats.total_responses === 0 ? (
              <p className="text-sm text-slate-400 italic">Aucune réponse pour le moment.</p>
            ) : (
              <div className="space-y-2">
                {[
                  { k: 'oui', label: 'Oui, avec plaisir', cls: 'bg-emerald-500' },
                  { k: 'peut_etre', label: 'Peut-être', cls: 'bg-amber-500' },
                  { k: 'non', label: 'Non', cls: 'bg-rose-500' },
                  { k: 'nsp', label: 'Sans réponse', cls: 'bg-slate-400' },
                ].map(opt => {
                  const n = stats.will_participate[opt.k] || 0;
                  const pct = stats.total_responses ? Math.round((n / stats.total_responses) * 100) : 0;
                  return (
                    <div key={opt.k} className="flex items-center gap-3">
                      <div className="w-24 text-xs text-slate-600">{opt.label}</div>
                      <div className="flex-1 h-6 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full ${opt.cls} transition-all flex items-center justify-end pr-2`} style={{ width: `${Math.max(pct, 3)}%` }}>
                          {pct > 15 && <span className="text-[10px] font-bold text-white">{pct}%</span>}
                        </div>
                      </div>
                      <div className="w-10 text-right text-xs font-semibold">{n}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><MapPin className="w-4 h-4 text-blue-600" /> Satisfaction par site</CardTitle></CardHeader>
          <CardContent>
            {stats.by_site.length === 0 ? (
              <p className="text-sm text-slate-400 italic">Aucune réponse pour le moment.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-xs text-slate-500 uppercase border-b"><tr><th className="text-left py-2">Site</th><th className="text-center">Réponses</th><th className="text-center">Note</th><th className="text-center">NPS</th></tr></thead>
                <tbody className="divide-y">
                  {stats.by_site.map((s, i) => (
                    <tr key={i}>
                      <td className="py-2 font-medium">{s.venue_name}</td>
                      <td className="text-center">{s.count}</td>
                      <td className="text-center"><span className="inline-flex items-center gap-1"><Star className="w-3 h-3 fill-amber-400 text-amber-400" />{s.avg_overall?.toFixed(1) ?? '—'}</span></td>
                      <td className={`text-center font-semibold ${s.avg_nps === null ? 'text-slate-400' : s.avg_nps >= 7 ? 'text-emerald-600' : s.avg_nps >= 5 ? 'text-amber-600' : 'text-rose-600'}`}>{s.avg_nps ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Liste des retours */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><MessageCircle className="w-4 h-4 text-slate-600" /> Retours individuels ({surveys.length})</CardTitle></CardHeader>
        <CardContent className="p-0">
          {surveys.length === 0 ? (
            <div className="p-8 text-center text-slate-400 italic">Aucun retour soumis pour le moment.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-y text-xs uppercase text-slate-500 text-left"><tr>
                <th className="py-2 px-4">Exposant</th><th>Site</th><th>Stand</th><th className="text-center">Globale</th><th className="text-center">NPS</th><th>Prochaine</th><th>Soumis le</th><th></th>
              </tr></thead>
              <tbody className="divide-y">
                {surveys.map(s => {
                  const isOpen = expanded === s.id;
                  return (
                    <React.Fragment key={s.id}>
                      <tr className="hover:bg-slate-50/50 cursor-pointer" onClick={() => setExpanded(isOpen ? null : s.id)}>
                        <td className="py-2 px-4 font-medium">{s.organization_name || '—'}</td>
                        <td className="text-slate-600">{s.venue_name || '—'}</td>
                        <td className="font-mono text-xs">{s.stand_code || '—'}</td>
                        <td className="text-center"><span className="inline-flex items-center gap-1"><Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />{s.overall_rating ?? '—'}</span></td>
                        <td className={`text-center font-bold ${s.nps_score === null ? 'text-slate-400' : s.nps_score >= 9 ? 'text-emerald-600' : s.nps_score >= 7 ? 'text-amber-600' : 'text-rose-600'}`}>{s.nps_score ?? '—'}</td>
                        <td>{s.will_participate_next ? <Badge variant="secondary" className={s.will_participate_next === 'oui' ? 'bg-emerald-100 text-emerald-700' : s.will_participate_next === 'non' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}>{s.will_participate_next === 'peut_etre' ? 'Peut-être' : s.will_participate_next === 'oui' ? 'Oui' : 'Non'}</Badge> : '—'}</td>
                        <td className="text-xs text-slate-500">{s.submitted_at ? new Date(s.submitted_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</td>
                        <td className="text-xs text-blue-600 pr-4">{isOpen ? 'Fermer ↑' : 'Détails ↓'}</td>
                      </tr>
                      {isOpen && (
                        <tr className="bg-slate-50/60">
                          <td colSpan={8} className="p-4">
                            <div className="grid md:grid-cols-3 gap-4 text-xs">
                              <div>
                                <div className="font-semibold text-slate-700 mb-1">Notes détaillées</div>
                                <div className="space-y-1 text-slate-600">
                                  <div>Organisation : <RatingInline n={s.organization_rating} /></div>
                                  <div>Stand : <RatingInline n={s.stand_rating} /></div>
                                  <div>Visiteurs : <RatingInline n={s.visitors_rating} /></div>
                                  <div>Communication : <RatingInline n={s.communication_rating} /></div>
                                </div>
                              </div>
                              <div>
                                <div className="font-semibold text-slate-700 mb-1">Points positifs</div>
                                <p className="text-slate-600 italic whitespace-pre-wrap">{s.positive_points || <span className="text-slate-400">—</span>}</p>
                              </div>
                              <div>
                                <div className="font-semibold text-slate-700 mb-1">Points à améliorer</div>
                                <p className="text-slate-600 italic whitespace-pre-wrap">{s.improvement_points || <span className="text-slate-400">—</span>}</p>
                              </div>
                              {s.free_comment && (
                                <div className="md:col-span-3">
                                  <div className="font-semibold text-slate-700 mb-1">Commentaire libre</div>
                                  <p className="text-slate-600 italic whitespace-pre-wrap bg-white border rounded p-3">{s.free_comment}</p>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatKpi({ label, value, hint, icon: Icon, color, colorCls }) {
  const colorMap = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    violet: 'bg-violet-50 text-violet-700 border-violet-200',
    pink: 'bg-pink-50 text-pink-700 border-pink-200',
  };
  const cls = colorMap[color] || 'bg-slate-50 text-slate-700 border-slate-200';
  return (
    <Card className={`border ${cls}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider opacity-75">{label}</div>
            <div className={`text-2xl font-bold mt-0.5 ${colorCls || ''}`}>{value}</div>
            {hint && <div className="text-[10px] opacity-60 mt-0.5">{hint}</div>}
          </div>
          {Icon && <Icon className="w-5 h-5 opacity-40" />}
        </div>
      </CardContent>
    </Card>
  );
}

function RatingInline({ n }) {
  if (!n) return <span className="text-slate-400">—</span>;
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(k => <Star key={k} className={`w-3 h-3 ${k <= n ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />)}
      <span className="ml-1 text-slate-600">{n}/5</span>
    </span>
  );
}

// ---------- ConfirmedExposantsPanel: liste des exposants confirmés + caution à jour pour un site ----------
function ConfirmedExposantsPanel({ stands, venue }) {
  const { open: openExposant } = useExposantPanel();
  if (!venue) return null;

  const exposants = (stands || [])
    .filter(s => s.organization && s.assignment)
    .map(s => ({
      stand_code: s.stand_code,
      organization: s.organization,
      registration_id: s.assignment?.registration_id,
      registration_status: s.registration_status,
    }));

  const [regDetails, setRegDetails] = useState({});
  useEffect(() => {
    (async () => {
      const all = await api('/api/registrations');
      const map = {};
      all.forEach(r => { map[r.id] = r; });
      setRegDetails(map);
    })();
  }, [stands]);

  const rows = exposants.map(e => {
    const d = regDetails[e.registration_id];
    return {
      ...e,
      caution_status: d?.deposit?.status || 'non_demandee',
      caution_received_at: d?.deposit?.received_at,
      is_insurance_uploaded: d?.is_insurance_uploaded,
      is_convention_signed: d?.is_convention_signed,
      completion_percent: d?.completion_percent,
      main_email: d?.organization?.main_email,
    };
  });

  const confirmed = rows.filter(r => r.registration_status === 'confirme');
  const cautionOk = rows.filter(r => r.caution_status === 'recue');
  const fullyReady = rows.filter(r => r.registration_status === 'confirme' && r.caution_status === 'recue');

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="text-base flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600" /> Exposants confirmés & à jour de leur caution — {venue?.name}</CardTitle>
            <p className="text-xs text-slate-500 mt-1">Liste connectée du plan ci-dessus</p>
          </div>
          <div className="flex gap-2">
            <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">{fullyReady.length} 100% prêts</Badge>
            <Badge variant="secondary" className="bg-blue-100 text-blue-700">{confirmed.length} confirmés</Badge>
            <Badge variant="secondary" className="bg-violet-100 text-violet-700">{cautionOk.length} cautions OK</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-y text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="py-2 px-4">Stand</th>
              <th>Exposant</th>
              <th>Discipline</th>
              <th>Email</th>
              <th className="text-center">Inscription</th>
              <th className="text-center">Caution</th>
              <th className="text-center">Assurance</th>
              <th className="text-center">Convention</th>
              <th className="text-center">Complétion</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.length === 0 ? (
              <tr><td colSpan={9} className="py-6 text-center text-slate-400 italic">Aucun exposant attribué sur ce site.</td></tr>
            ) : rows.sort((a,b)=> (a.stand_code||'').localeCompare(b.stand_code||'')).map(r => (
              <tr key={r.stand_code} className="hover:bg-slate-50/50 cursor-pointer" onClick={() => r.registration_id && openExposant(r.registration_id)}>
                <td className="py-2 px-4 font-mono text-xs font-bold">{r.stand_code}</td>
                <td className="font-medium"><ExposantLink id={r.registration_id} className="font-medium">{r.organization.name}</ExposantLink></td>
                <td className="text-xs text-slate-600">{r.organization.discipline}</td>
                <td className="text-xs text-slate-600">{r.main_email || '—'}</td>
                <td className="text-center">
                  <Badge variant="secondary" className={r.registration_status === 'confirme' ? 'bg-emerald-100 text-emerald-700' : r.registration_status === 'a_confirmer' ? 'bg-amber-100 text-amber-700' : r.registration_status === 'a_relancer' ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-600'}>
                    {r.registration_status === 'confirme' ? '✓ Confirmé' : r.registration_status === 'a_confirmer' ? 'À confirmer' : r.registration_status === 'a_relancer' ? 'À relancer' : r.registration_status}
                  </Badge>
                </td>
                <td className="text-center">
                  {r.caution_status === 'recue' ? <Badge className="bg-emerald-600">✓ Reçue</Badge> :
                   r.caution_status === 'demandee' ? <Badge variant="secondary" className="bg-amber-100 text-amber-700">Demandée</Badge> :
                   <Badge variant="secondary" className="bg-slate-100 text-slate-500">—</Badge>}
                </td>
                <td className="text-center">{r.is_insurance_uploaded ? <CheckCircle2 className="w-4 h-4 text-emerald-600 inline" /> : <XCircle className="w-4 h-4 text-slate-300 inline" />}</td>
                <td className="text-center">{r.is_convention_signed ? <CheckCircle2 className="w-4 h-4 text-emerald-600 inline" /> : <XCircle className="w-4 h-4 text-slate-300 inline" />}</td>
                <td className="text-center">
                  <div className="inline-flex items-center gap-1">
                    <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div className={`h-full ${(r.completion_percent || 0) >= 80 ? 'bg-emerald-500' : (r.completion_percent || 0) >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${r.completion_percent || 0}%` }} />
                    </div>
                    <span className="text-xs font-semibold">{r.completion_percent || 0}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}


// ============ PROSPECTION ARACOM VIEW (vue consolidée admin) ============
// ============ AI Insight Card (synthèse IA d'un exposant) ============
const VIGILANCE_STYLE = {
  low:    { bg: 'bg-emerald-50 border-emerald-300', label: '🟢 Fiable',         text: 'text-emerald-900' },
  medium: { bg: 'bg-amber-50 border-amber-300',     label: '🟡 À surveiller',   text: 'text-amber-900' },
  high:   { bg: 'bg-rose-50 border-rose-300',       label: '🔴 Vigilance',      text: 'text-rose-900' },
  new:    { bg: 'bg-violet-50 border-violet-300',   label: '🆕 Nouveau dossier', text: 'text-violet-900' },
};


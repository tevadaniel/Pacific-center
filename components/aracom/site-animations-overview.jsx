'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/auth-client';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { MapPin, Sparkles, AlertTriangle, Users, ClipboardCheck } from 'lucide-react';
import { ExposantLink } from './exposant-panel-context';
import { toast } from 'sonner';

/**
 * 🆕 SESSION 45 — Vue d'ensemble + onglet par site du remplissage stand par jour
 *   et du nombre d'animations (sur stand / zone démo).
 *   Met en évidence les exposants sans aucune animation (obligation forum 2026).
 */
export default function SiteAnimationsOverview() {
  const [data, setData] = useState(null);
  const [regs, setRegs] = useState([]);
  const [animSlots, setAnimSlots] = useState([]);
  const [validations, setValidations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeSiteId, setActiveSiteId] = useState('overview');

  const load = async () => {
    setLoading(true);
    try {
      const [av, rs, as, vr] = await Promise.all([
        api('/api/wizard/availability'),
        api('/api/registrations'),
        api('/api/animation-slots'),
        api('/api/validation-requests').catch(() => []),
      ]);
      setData(av);
      setRegs(Array.isArray(rs) ? rs : []);
      setAnimSlots(Array.isArray(as) ? as : []);
      setValidations(Array.isArray(vr) ? vr : []);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const venues = useMemo(() => Array.isArray(data?.venues) ? data.venues : [], [data]);

  // 🆕 SESSION 45 — Index des demandes de validation par venue, triées par date ASC.
  //   Logique métier : les premières demandes (jusqu'à capacity_stands) = PRÉ-VALIDÉES.
  //   Les suivantes = LISTE D'ATTENTE (le quota du site est dépassé).
  const validationsByVenue = useMemo(() => {
    const m = new Map();
    for (const vr of validations) {
      if (!vr.venue_id) continue;
      // 🆕 SESSION 53.11 — Filtre tous les statuts finaux (annule + annulee + variants)
      if (['verrouille', 'refused', 'cancelled', 'annule', 'annulee', 'refuse'].includes(vr.status)) continue;
      if (!m.has(vr.venue_id)) m.set(vr.venue_id, []);
      m.get(vr.venue_id).push(vr);
    }
    // Trier par date (les plus anciens en premier → priorité)
    for (const arr of m.values()) {
      arr.sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
    }
    return m;
  }, [validations]);

  // 🆕 SESSION 52g.4 — Classification stricte des inscriptions par état métier réel
  //   • CONFIRMED   = exposant validé (tunnel terminé) — a_confirmer, confirme, verrouille…
  //   • WAITLIST    = liste d'attente (is_waitlist OU status liste_attente)
  //   • DRAFT       = tunnel en cours (provisoire UNIQUEMENT — vraie inscription en cours)
  //   • PROSPECT    = prospects/relances CRM (prospect, a_relancer) — PAS un tunnel
  //   • CANCELLED   = refusé/annulé — ignoré
  const STATUSES_CONFIRMED = ['a_confirmer', 'confirme', 'verrouille', 'rdv_fixe', 'en_attente'];
  const STATUSES_WAITLIST = ['liste_attente'];
  const STATUSES_CANCELLED = ['annule', 'cancelled', 'refused', 'refuse'];
  const STATUSES_PROSPECT = ['prospect', 'a_relancer'];
  const STATUSES_DRAFT = ['provisoire'];
  const classifyReg = (r) => {
    if (STATUSES_CANCELLED.includes(r.status)) return 'cancelled';
    if (r.is_waitlist === true || STATUSES_WAITLIST.includes(r.status)) return 'waitlist';
    if (STATUSES_CONFIRMED.includes(r.status)) return 'confirmed';
    if (STATUSES_PROSPECT.includes(r.status)) return 'prospect';
    if (STATUSES_DRAFT.includes(r.status)) return 'draft';
    return 'other';
  };

  // Index : registrations par venue ET par état (hors annulé et prospects qui ne sont PAS dans le tunnel)
  const regsByVenue = useMemo(() => {
    const m = new Map();
    for (const r of regs) {
      if (!r.venue_id) continue;
      const cls = classifyReg(r);
      if (cls === 'cancelled' || cls === 'prospect' || cls === 'other') continue;
      if (!m.has(r.venue_id)) m.set(r.venue_id, { confirmed: [], waitlist: [], draft: [] });
      const bucket = cls === 'draft' ? 'draft' : cls; // map in_progress→draft consistency
      m.get(r.venue_id)[bucket].push(r);
    }
    return m;
  }, [regs]);

  // Index : animations par venue/jour/location_type
  const animsByVenue = useMemo(() => {
    const m = new Map();
    for (const a of animSlots) {
      if (a.status === 'annulé' || a.status === 'annule' || a.status === 'cancelled') continue;
      if (!a.venue_id) continue;
      if (!m.has(a.venue_id)) m.set(a.venue_id, []);
      m.get(a.venue_id).push(a);
    }
    return m;
  }, [animSlots]);

  // Set des registration_ids ayant au moins 1 animation
  const regsWithAnim = useMemo(() => {
    const s = new Set();
    for (const a of animSlots) {
      if (a.status === 'annulé' || a.status === 'annule' || a.status === 'cancelled') continue;
      if (a.registration_id) s.add(a.registration_id);
    }
    return s;
  }, [animSlots]);

  /** Stats agrégées par venue */
  const venueStats = useMemo(() => {
    return venues.map((v) => {
      const buckets = regsByVenue.get(v.id) || { confirmed: [], waitlist: [], draft: [] };
      const venueRegs = buckets.confirmed; // 🆕 SESSION 52g.4 — Seuls les confirmés sont des "exposants"
      const venueAnims = animsByVenue.get(v.id) || [];
      const dayCount = (day) =>
        venueRegs.filter((r) => Array.isArray(r.attending_days) && (r.attending_days.includes(day) || r.attending_days.includes(day === 'vendredi' ? '2026-08-14' : '2026-08-15'))).length;
      const animsByDay = (day) => venueAnims.filter((a) => a.day_label === day);
      const ven = animsByDay('vendredi');
      const sam = animsByDay('samedi');
      const ven_stand = ven.filter((a) => a.location_type === 'sur_stand' || a.slot_type === 'sur_stand').length;
      const ven_demo = ven.filter((a) => a.location_type === 'zone_demo' || a.slot_type === 'zone_demo').length;
      const sam_stand = sam.filter((a) => a.location_type === 'sur_stand' || a.slot_type === 'sur_stand').length;
      const sam_demo = sam.filter((a) => a.location_type === 'zone_demo' || a.slot_type === 'zone_demo').length;
      const standsTotal = v.capacity_stands || 0;
      const standsUsed = Math.min(standsTotal, v.stands_used || 0);
      const standsFree = Math.max(0, standsTotal - standsUsed);
      // 🆕 SESSION 52g — Sans animation = UNIQUEMENT exposants confirmés (tunnel terminé) sans animation
      //   On exclut les brouillons (provisoire) et les waitlist : ils ne peuvent pas avoir d'anim normalement.
      const noAnim = venueRegs.filter((r) => !regsWithAnim.has(r.id));
      // 🆕 SESSION 45 — Demandes de validation par site, séparées en pré-validés (dans quota) / liste d'attente
      const valReqs = validationsByVenue.get(v.id) || [];
      const preValidated = valReqs.slice(0, standsTotal);
      const waitlist = valReqs.slice(standsTotal);
      return {
        id: v.id,
        name: v.name,
        code: v.code,
        standsTotal,
        standsUsed,
        standsFree,
        regsCount: venueRegs.length,
        regsVen: dayCount('vendredi'),
        regsSam: dayCount('samedi'),
        anims: { ven, sam, ven_stand, ven_demo, sam_stand, sam_demo, total: ven.length + sam.length },
        noAnim,
        regsList: venueRegs,
        // 🆕 SESSION 52g.4 — Comptage séparé pour transparence admin
        draftCount: buckets.draft.length,
        waitlistRegsCount: buckets.waitlist.length,
        valReqs,
        preValidated,
        waitlist,
      };
    });
  }, [venues, regsByVenue, animsByVenue, regsWithAnim, validationsByVenue]);

  // Totaux globaux
  const totals = useMemo(() => venueStats.reduce(
    (acc, s) => {
      acc.standsTotal += s.standsTotal;
      acc.standsUsed += s.standsUsed;
      acc.standsFree += s.standsFree;
      acc.regsCount += s.regsCount;
      acc.regsVen += s.regsVen;
      acc.regsSam += s.regsSam;
      acc.animVen += s.anims.ven.length;
      acc.animSam += s.anims.sam.length;
      acc.animOnStand += s.anims.ven_stand + s.anims.sam_stand;
      acc.animOnDemo += s.anims.ven_demo + s.anims.sam_demo;
      acc.noAnim += s.noAnim.length;
      acc.preValidated += s.preValidated.length;
      acc.waitlist += s.waitlist.length;
      acc.draft += s.draftCount || 0;
      acc.waitlistRegs += s.waitlistRegsCount || 0;
      return acc;
    },
    { standsTotal: 0, standsUsed: 0, standsFree: 0, regsCount: 0, regsVen: 0, regsSam: 0, animVen: 0, animSam: 0, animOnStand: 0, animOnDemo: 0, noAnim: 0, preValidated: 0, waitlist: 0, draft: 0, waitlistRegs: 0 }
  ), [venueStats]);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-sm text-slate-500">Chargement de la vue remplissage & animations…</CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2 flex-wrap">
          <span className="flex items-center gap-2">🗺️ Remplissage & animations par site</span>
          <Badge variant="secondary" className="text-[10px]">{venueStats.length} sites</Badge>
          {totals.noAnim > 0 && (
            <Badge className="text-[10px] bg-rose-100 text-rose-800 border-rose-300 border" title="Exposants confirmés (tunnel terminé) qui n'ont aucune animation programmée — c'est une anomalie">
              🚨 {totals.noAnim} confirmé·s sans animation
            </Badge>
          )}
          {totals.draft > 0 && (
            <Badge className="text-[10px] bg-slate-100 text-slate-700 border-slate-300 border" title="Brouillons : tunnels d'inscription en cours, pas encore soumis">
              ✏️ {totals.draft} en cours
            </Badge>
          )}
          <Button size="sm" variant="ghost" onClick={load} className="ml-auto h-7 text-xs">🔄</Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={activeSiteId} onValueChange={setActiveSiteId} className="w-full">
          <TabsList className="w-full flex-wrap h-auto justify-start gap-1 bg-slate-100 p-1">
            <TabsTrigger value="overview" className="text-xs h-8">📊 Vue d&apos;ensemble</TabsTrigger>
            {venueStats.map((s) => (
              <TabsTrigger key={s.id} value={s.id} className="text-xs h-8">
                {s.name}
                {s.noAnim.length > 0 && (
                  <span className="ml-1.5 inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-[9px] bg-rose-200 text-rose-900 font-bold" title="Exposants confirmés sans animation">
                    {s.noAnim.length}
                  </span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* ───────── OVERVIEW TAB ───────── */}
          <TabsContent value="overview" className="mt-4 space-y-3">
            {/* KPIs globaux */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
              <KpiMini label="Stands utilisés" value={`${totals.standsUsed} / ${totals.standsTotal}`} accent="blue" sub={`${totals.standsFree} libres`} />
              <KpiMini label="Exposants confirmés" value={totals.regsCount} accent="emerald" sub={`Ven: ${totals.regsVen} · Sam: ${totals.regsSam}`} />
              <KpiMini label="Animations totales" value={totals.animVen + totals.animSam} accent="violet" sub={`Ven: ${totals.animVen} · Sam: ${totals.animSam}`} />
              <KpiMini label="🚨 Anomalies anim." value={totals.noAnim} accent={totals.noAnim > 0 ? 'rose' : 'slate'} sub={totals.noAnim > 0 ? 'confirmés sans anim' : 'aucune'} />
              <KpiMini label="En cours (brouillons)" value={totals.draft} accent="slate" sub="tunnel non terminé" />
              <KpiMini label="✓ Pré-validés" value={totals.preValidated} accent="emerald" sub="dans quota" />
              <KpiMini label="⏳ Liste d'attente" value={totals.waitlist} accent={totals.waitlist > 0 ? 'amber' : 'slate'} sub="quota dépassé" />
            </div>

            {/* Tableau récap par site */}
            <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-2 py-2 text-left">Site</th>
                    <th className="px-2 py-2 text-center">Stands</th>
                    <th className="px-2 py-2 text-center">Exposants</th>
                    <th className="px-2 py-2 text-center" colSpan={2}>Vendredi 14/08</th>
                    <th className="px-2 py-2 text-center" colSpan={2}>Samedi 15/08</th>
                    <th className="px-2 py-2 text-center">🚨 Anomalies</th>
                  </tr>
                  <tr className="bg-slate-100 text-[9px] text-slate-500">
                    <th></th><th></th><th></th>
                    <th className="px-2 py-1 text-center">🟦 Stand</th>
                    <th className="px-2 py-1 text-center">🟧 Zone</th>
                    <th className="px-2 py-1 text-center">🟦 Stand</th>
                    <th className="px-2 py-1 text-center">🟧 Zone</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {venueStats.map((s) => {
                    const fillPct = s.standsTotal ? Math.round((s.standsUsed / s.standsTotal) * 100) : 0;
                    return (
                      <tr
                        key={s.id}
                        className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer"
                        onClick={() => setActiveSiteId(s.id)}
                      >
                        <td className="px-2 py-1.5 font-medium text-slate-900">
                          {s.name}
                          <span className="ml-1 text-[9px] text-slate-400">{s.code}</span>
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <div className="inline-flex items-center gap-1">
                            <span className={`text-[11px] font-bold ${fillPct >= 90 ? 'text-rose-700' : fillPct >= 70 ? 'text-amber-700' : 'text-slate-700'}`}>
                              {s.standsUsed}/{s.standsTotal}
                            </span>
                            <span className="text-[9px] text-slate-400">({fillPct}%)</span>
                          </div>
                        </td>
                        <td className="px-2 py-1.5 text-center text-slate-700 font-medium">{s.regsCount}</td>
                        <td className="px-2 py-1.5 text-center">
                          <span className={`inline-block px-1.5 rounded text-[11px] font-bold ${s.anims.ven_stand > 0 ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-400'}`}>{s.anims.ven_stand}</span>
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <span className={`inline-block px-1.5 rounded text-[11px] font-bold ${s.anims.ven_demo > 0 ? 'bg-orange-100 text-orange-800' : 'bg-slate-100 text-slate-400'}`}>{s.anims.ven_demo}</span>
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <span className={`inline-block px-1.5 rounded text-[11px] font-bold ${s.anims.sam_stand > 0 ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-400'}`}>{s.anims.sam_stand}</span>
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <span className={`inline-block px-1.5 rounded text-[11px] font-bold ${s.anims.sam_demo > 0 ? 'bg-orange-100 text-orange-800' : 'bg-slate-100 text-slate-400'}`}>{s.anims.sam_demo}</span>
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          {s.noAnim.length > 0 ? (
                            <Badge className="text-[10px] bg-rose-100 text-rose-800 border-rose-300 border" title="Exposants confirmés sans animation">🚨 {s.noAnim.length}</Badge>
                          ) : (
                            <span className="text-emerald-600 text-[11px]">✓</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {/* Ligne totaux */}
                  <tr className="border-t-2 border-slate-300 bg-slate-50 font-bold text-slate-800">
                    <td className="px-2 py-2">TOTAL</td>
                    <td className="px-2 py-2 text-center">{totals.standsUsed}/{totals.standsTotal}</td>
                    <td className="px-2 py-2 text-center">{totals.regsCount}</td>
                    <td className="px-2 py-2 text-center text-blue-800">
                      {venueStats.reduce((a, s) => a + s.anims.ven_stand, 0)}
                    </td>
                    <td className="px-2 py-2 text-center text-orange-800">
                      {venueStats.reduce((a, s) => a + s.anims.ven_demo, 0)}
                    </td>
                    <td className="px-2 py-2 text-center text-blue-800">
                      {venueStats.reduce((a, s) => a + s.anims.sam_stand, 0)}
                    </td>
                    <td className="px-2 py-2 text-center text-orange-800">
                      {venueStats.reduce((a, s) => a + s.anims.sam_demo, 0)}
                    </td>
                    <td className="px-2 py-2 text-center text-rose-700">{totals.noAnim > 0 ? `🚨 ${totals.noAnim}` : '✓'}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="text-[10px] text-slate-500 leading-snug">
              💡 Les <b>exposants confirmés</b> sont ceux qui ont terminé le tunnel (statut <code>a_confirmer</code>/<code>confirme</code>/<code>verrouille</code>).
              Les brouillons (<code>provisoire</code>) et la liste d&apos;attente (<code>liste_attente</code>) sont comptés séparément.
              L&apos;animation est <b>obligatoire</b> au moment de la soumission — si un exposant confirmé n&apos;a pas d&apos;animation, c&apos;est une <b className="text-rose-700">anomalie</b> à corriger manuellement.
            </div>
          </TabsContent>

          {/* ───────── PER-SITE TABS ───────── */}
          {venueStats.map((s) => (
            <TabsContent key={s.id} value={s.id} className="mt-4 space-y-3">
              <SiteDetailPanel site={s} onRefresh={load} />
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}

function KpiMini({ label, value, sub, accent = 'blue' }) {
  const colors = {
    blue: 'border-blue-200 bg-blue-50 text-blue-800',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    violet: 'border-violet-200 bg-violet-50 text-violet-800',
    amber: 'border-amber-300 bg-amber-50 text-amber-900',
    rose: 'border-rose-300 bg-rose-50 text-rose-900',
    slate: 'border-slate-200 bg-slate-50 text-slate-700',
  };
  return (
    <div className={`rounded-md border ${colors[accent]} px-3 py-2`}>
      <div className="text-[9px] uppercase tracking-wider font-bold opacity-80">{label}</div>
      <div className="text-2xl font-extrabold leading-tight mt-0.5">{value}</div>
      {sub && <div className="text-[10px] opacity-70 mt-0.5">{sub}</div>}
    </div>
  );
}

function SiteDetailPanel({ site, onRefresh }) {
  const s = site;
  const fillPct = s.standsTotal ? Math.round((s.standsUsed / s.standsTotal) * 100) : 0;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <MapPin className="w-4 h-4 text-slate-500" />
        <h3 className="font-bold text-slate-900">{s.name}</h3>
        <Badge variant="secondary" className="text-[10px]">{s.code}</Badge>
      </div>

      {/* KPIs site */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <KpiMini label="Remplissage stand" value={`${s.standsUsed}/${s.standsTotal}`} accent={fillPct >= 90 ? 'amber' : fillPct >= 70 ? 'violet' : 'blue'} sub={`${fillPct}% · ${s.standsFree} libres`} />
        <KpiMini label="Exposants confirmés" value={s.regsCount} accent="emerald" sub={`Ven: ${s.regsVen} · Sam: ${s.regsSam}`} />
        <KpiMini label="Animations" value={s.anims.total} accent="violet" sub={`Ven: ${s.anims.ven.length} · Sam: ${s.anims.sam.length}`} />
        <KpiMini label="🚨 Anomalie anim." value={s.noAnim.length} accent={s.noAnim.length > 0 ? 'rose' : 'slate'} sub={s.noAnim.length > 0 ? 'confirmés sans anim' : 'tout est ok'} />
        <KpiMini label="En cours" value={s.draftCount || 0} accent="slate" sub="brouillons tunnel" />
      </div>

      {/* 🆕 SESSION 45 — Demandes de validation : pré-validés (dans quota) vs liste d'attente */}
      {s.valReqs.length > 0 && (
        <div className="rounded-md border-2 border-blue-200 bg-blue-50/40 p-3 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <ClipboardCheck className="w-4 h-4 text-blue-700" />
            <div className="text-sm font-bold text-blue-900">Demandes de validation — {s.valReqs.length} au total</div>
            <Badge className="text-[10px] bg-emerald-100 text-emerald-800 border-emerald-300 border">
              ✓ {s.preValidated.length} pré-validé·s
            </Badge>
            {s.waitlist.length > 0 && (
              <Badge className="text-[10px] bg-amber-100 text-amber-800 border-amber-300 border">
                ⏳ {s.waitlist.length} en attente
              </Badge>
            )}
            <span className="text-[10px] text-slate-500 ml-auto">
              Quota site : <b>{s.standsTotal}</b> stands · les demandes prioritaires (les plus anciennes) entrent dans le quota.
            </span>
          </div>

          {s.preValidated.length > 0 && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 mb-1">
                ✓ Pré-validés (dans le quota de {s.standsTotal})
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                {s.preValidated.map((vr, idx) => (
                  <ValidationRow key={vr.id} vr={vr} rank={idx + 1} kind="prevalidated" onRefresh={onRefresh} />
                ))}
              </div>
            </div>
          )}

          {s.waitlist.length > 0 && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-amber-800 mb-1">
                ⏳ Liste d&apos;attente — quota dépassé · {s.waitlist.length} exposant·s à recontacter pour verrouillage manuel
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                {s.waitlist.map((vr, idx) => (
                  <ValidationRow key={vr.id} vr={vr} rank={s.standsTotal + idx + 1} kind="waitlist" onRefresh={onRefresh} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Split par jour */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <DayCard day="Vendredi 14 août" exposants={s.regsVen} stand={s.anims.ven_stand} demo={s.anims.ven_demo} />
        <DayCard day="Samedi 15 août" exposants={s.regsSam} stand={s.anims.sam_stand} demo={s.anims.sam_demo} />
      </div>

      {/* Liste des exposants sans animation */}
      {s.noAnim.length > 0 && (
        <div className="rounded-md border-2 border-rose-300 bg-rose-50 p-3">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-rose-700" />
            <div className="text-xs font-bold text-rose-900">
              🚨 ANOMALIE — {s.noAnim.length} exposant·s confirmé·s sans animation sur {s.name}
            </div>
          </div>
          <div className="text-[10px] text-rose-800 mb-2">
            Ces exposants ont <b>terminé le tunnel d&apos;inscription</b> mais n&apos;ont aucune animation enregistrée — ce qui ne devrait jamais arriver (le tunnel l&apos;impose). Cliquez sur un nom pour ouvrir la fiche et corriger.
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
            {s.noAnim.map((r) => (
              <ExposantLink
                key={r.id}
                exposant={{ registration_id: r.id, organization_id: r.organization_id, name: r.organization?.name || r.organization_name || '—' }}
                className="text-xs text-slate-800 hover:text-rose-900 hover:bg-white rounded px-2 py-1 border border-rose-200 bg-white/70 transition flex items-center justify-between gap-2"
              >
                <span className="truncate">
                  <Users className="w-3 h-3 inline mr-1 text-slate-400" />
                  {/* 🆕 SESSION 50b — Pastille "Site prioritaire" */}
                  {r.is_user_priority === true && (
                    <span className="text-amber-500 mr-0.5" title="L'exposant a marqué ce site comme prioritaire">⭐</span>
                  )}
                  {r.organization?.name || r.organization_name || '(sans nom)'}
                </span>
                <span className="text-[9px] text-slate-500 shrink-0">
                  {r.stand_code || '—'}
                  {Array.isArray(r.attending_days) && r.attending_days.length > 0 && (
                    <> · {r.attending_days.map((d) => d === 'vendredi' ? 'V' : d === 'samedi' ? 'S' : d.charAt(0).toUpperCase()).join('+')}</>
                  )}
                </span>
              </ExposantLink>
            ))}
          </div>
        </div>
      )}

      {/* Tous les exposants du site */}
      {s.regsList.length > 0 && (
        <details className="rounded-md border border-slate-200 bg-white">
          <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
            👥 Tous les exposants ({s.regsList.length})
          </summary>
          <div className="p-2 grid grid-cols-1 md:grid-cols-3 gap-1">
            {s.regsList.map((r) => (
              <ExposantLink
                key={r.id}
                exposant={{ registration_id: r.id, organization_id: r.organization_id, name: r.organization?.name || r.organization_name || '—' }}
                className="text-[11px] text-slate-700 hover:text-blue-700 hover:bg-blue-50 rounded px-2 py-1 transition flex items-center justify-between gap-2"
              >
                <span className="truncate">
                  {/* 🆕 SESSION 50b — Pastille "Site prioritaire" */}
                  {r.is_user_priority === true && (
                    <span className="text-amber-500 mr-0.5" title="L'exposant a marqué ce site comme prioritaire">⭐</span>
                  )}
                  {r.organization?.name || r.organization_name || '(sans nom)'}
                </span>
                <span className="text-[9px] text-slate-400 shrink-0">{r.stand_code || '—'}</span>
              </ExposantLink>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function DayCard({ day, exposants, stand, demo }) {  const total = stand + demo;
  return (
    <div className="rounded-md border border-slate-200 bg-white p-3 space-y-2">
      <div className="text-xs font-bold text-slate-800 flex items-center gap-2">
        <Sparkles className="w-3.5 h-3.5 text-violet-500" />
        {day}
      </div>
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-slate-500">Exposants présents :</span>
        <span className="font-bold text-emerald-700">{exposants}</span>
      </div>
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-slate-500">Animations programmées :</span>
        <span className="font-bold text-violet-700">{total}</span>
      </div>
      <div className="grid grid-cols-2 gap-2 pt-1">
        <div className="rounded bg-blue-50 border border-blue-100 px-2 py-1.5 text-center">
          <div className="text-[9px] uppercase text-blue-700 font-semibold">🟦 Sur stand</div>
          <div className="text-base font-bold text-blue-900">{stand}</div>
        </div>
        <div className="rounded bg-orange-50 border border-orange-100 px-2 py-1.5 text-center">
          <div className="text-[9px] uppercase text-orange-700 font-semibold">🟧 Zone démo</div>
          <div className="text-base font-bold text-orange-900">{demo}</div>
        </div>
      </div>
      {/* Couverture animation par exposant présent */}
      {exposants > 0 && (
        <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-100">
          Couverture : <b className={total >= exposants ? 'text-emerald-700' : 'text-amber-700'}>{total}/{exposants}</b>
          {total < exposants && <span className="ml-1">⚠ {exposants - total} exposant·s sans anim. ce jour</span>}
          {total >= exposants && <span className="ml-1 text-emerald-700">✓ couvert</span>}
        </div>
      )}
    </div>
  );
}



// 🆕 SESSION 45 — Ligne d'affichage d'une demande de validation (pré-validé ou liste d'attente)
// 🆕 SESSION 53.11 — Actions admin inline (toast importé en tête de fichier)

function ValidationRow({ vr, rank, kind, onRefresh }) {
  const [busy, setBusy] = useState(null); // 'validate' | 'cancel' | 'unlock'
  const dateStr = vr.created_at ? new Date(vr.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';
  const org = vr.organization || {};
  const orgName = org.name || vr.organization_name || '(sans nom)';
  const standCode = vr.stand_code || vr.requested_stand_code || '—';
  const styles = kind === 'prevalidated'
    ? 'border-emerald-200 bg-white hover:border-emerald-400'
    : 'border-amber-200 bg-amber-50/60 hover:border-amber-400';

  const doAction = async (action, e) => {
    e?.preventDefault();
    e?.stopPropagation();
    if (busy) return;
    const regId = vr.registration_id;
    if (!regId) { toast.error('Registration_id manquant'); return; }
    if (action === 'validate') {
      if (!confirm(`✅ Verrouiller définitivement la candidature de ${orgName} (stand ${standCode}) ?\n\nL'exposant ne pourra plus modifier ses dates/animations/stand.`)) return;
      setBusy('validate');
      try {
        await api(`/api/admin/registrations/${regId}/validate`, { method: 'POST', body: JSON.stringify({}) });
        toast.success(`✅ ${orgName} verrouillé`);
        await onRefresh?.();
      } catch (err) { toast.error(err.message || 'Erreur'); } finally { setBusy(null); }
    } else if (action === 'unlock') {
      if (!confirm(`🔓 Déverrouiller la candidature de ${orgName} pour permettre des modifications ?`)) return;
      setBusy('unlock');
      try {
        await api(`/api/admin/registrations/${regId}/unlock-candidature`, { method: 'POST', body: JSON.stringify({}) });
        toast.success(`🔓 ${orgName} déverrouillé`);
        await onRefresh?.();
      } catch (err) { toast.error(err.message || 'Erreur'); } finally { setBusy(null); }
    } else if (action === 'cancel') {
      const reason = prompt(`❌ Annuler la pré-réservation de ${orgName} ?\n\nRaison (optionnelle) :`, '');
      if (reason === null) return;
      setBusy('cancel');
      try {
        await api(`/api/admin/registrations/${regId}/cancel`, { method: 'POST', body: JSON.stringify({ reason }) });
        toast.success(`❌ ${orgName} annulé`);
        await onRefresh?.();
      } catch (err) { toast.error(err.message || 'Erreur'); } finally { setBusy(null); }
    }
  };

  return (
    <div className={`text-xs text-slate-800 rounded px-2 py-1.5 border ${styles} transition flex items-center justify-between gap-2`}>
      <ExposantLink
        exposant={{ registration_id: vr.registration_id, organization_id: vr.organization_id, name: orgName }}
        className="flex items-center gap-1.5 min-w-0 flex-1 cursor-pointer hover:underline"
      >
        <span className={`text-[9px] font-bold w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${kind === 'prevalidated' ? 'bg-emerald-200 text-emerald-900' : 'bg-amber-200 text-amber-900'}`}>
          {rank}
        </span>
        <span className="font-medium truncate">{orgName}</span>
      </ExposantLink>
      <span className="text-[9px] text-slate-500 shrink-0 flex items-center gap-1.5">
        <span className="font-mono">{standCode}</span>
        <span className="hidden md:inline">{dateStr}</span>
        {kind === 'waitlist' && <span className="text-amber-700 font-bold" title="En attente de promotion">⏳</span>}
        {/* 🆕 SESSION 53.11 — Actions admin inline */}
        <div className="flex items-center gap-0.5 ml-1 border-l border-slate-300 pl-1.5">
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => doAction('validate', e)}
            disabled={!!busy}
            className="h-5 w-5 p-0 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-900"
            title="Verrouiller définitivement la candidature"
          >
            {busy === 'validate' ? '⏳' : '✓'}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => doAction('unlock', e)}
            disabled={!!busy}
            className="h-5 w-5 p-0 text-blue-700 hover:bg-blue-100 hover:text-blue-900"
            title="Déverrouiller la candidature (re-permettre les modifications)"
          >
            {busy === 'unlock' ? '⏳' : '🔓'}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => doAction('cancel', e)}
            disabled={!!busy}
            className="h-5 w-5 p-0 text-red-600 hover:bg-red-100 hover:text-red-700"
            title="Annuler la pré-réservation"
          >
            {busy === 'cancel' ? '⏳' : '✕'}
          </Button>
        </div>
      </span>
    </div>
  );
}

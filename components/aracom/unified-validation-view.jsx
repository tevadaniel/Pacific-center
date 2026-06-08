'use client';

/**
 * 🆕 SESSION 48v — VUE UNIFIÉE Gestion exposants
 * Fusionne "File de validation" + "Liste d'attente" en une seule vue par site.
 *
 * Affiche 3 colonnes par site :
 *  - ✅ Validés (confirmés ARACOM)
 *  - ⏳ Pré-réservés (en attente de validation)
 *  - 📋 Liste d'attente (par ordre d'arrivée)
 *
 * Actions :
 *  - Validate (sur pré-réservé) → ouvre le flow de validation existant
 *  - Refuse (sur pré-réservé) → libère le stand
 *  - Promouvoir (waitlister → stand libre)
 *  - Switch (waitlister ↔ pré-réservé) → refuse le pré-réservé ET promeut le waitlister sur ce stand
 */
import { useEffect, useState, useMemo } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/auth-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ShieldCheck, Hourglass, ArrowUpCircle, ArrowLeftRight, Check, X, MapPin, RefreshCw, Trash2, Clock, Lock } from 'lucide-react';
import { useExposantPanel } from './exposant-panel-context';

export default function UnifiedValidationView({ readonly = false, onExposantClick = null }) {
  // 🆕 SESSION 48x — En mode ARACOM (non-readonly), on connecte automatiquement le clic sur
  // le nom de l'exposant pour ouvrir la fiche détaillée via le contexte ExposantPanelProvider.
  const { open: openExposantPanel } = useExposantPanel();
  const effectiveExposantClick = onExposantClick
    || (readonly ? null : (r) => openExposantPanel(r.registration_id || r.id));
  const [venues, setVenues] = useState([]);
  const [requests, setRequests] = useState([]);
  const [standsByVenue, setStandsByVenue] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeVenue, setActiveVenue] = useState('all');

  // Dialog states
  const [promote, setPromote] = useState(null); // { req, freeStands: [] }
  const [targetStand, setTargetStand] = useState('');
  const [switchOp, setSwitchOp] = useState(null); // { waitlister, preReserved }

  const load = async () => {
    setLoading(true);
    try {
      // 🆕 SESSION 48z — Fusion des SOURCES de données pour afficher TOUS les exposants :
      //   - validation_requests : workflow nouvelle génération (validations, waitlist explicite)
      //   - registrations : inscriptions complètes (statuts a_confirmer, a_relancer, confirme, etc.)
      // On déduplique par registration_id (les validation_requests priment).
      const [vlist, allValReqs, allRegs] = await Promise.all([
        api('/api/venues'),
        api('/api/validation-requests'),
        api('/api/registrations'),
      ]);
      // 🆕 SESSION 48w — Filtre les sites désactivés (cohérence avec activation site/stands)
      const activeVenues = (vlist || []).filter(v => v.is_active !== false && v.is_available_2026 !== false);
      setVenues(activeVenues);

      // Index validation_requests par registration_id
      const valByRegId = {};
      for (const vr of (allValReqs || [])) {
        if (vr.registration_id) valByRegId[vr.registration_id] = vr;
      }

      // Fusion : pour chaque registration, on prend le validation_request s'il existe, sinon on mappe le statut
      const merged = [];
      for (const reg of (allRegs || [])) {
        // Exclut explicitement les statuts non-actifs (prospect → pas encore engagé)
        if (reg.status === 'prospect' || reg.status === 'cancelled' || reg.status === 'annule') continue;
        const valReq = valByRegId[reg.id];
        if (valReq) {
          // Le validation_request a priorité, on ajoute les infos de contact venant de la reg
          merged.push({ ...valReq, _source: 'validation_request', registration: reg });
        } else {
          // Mapping registration → format validation_request
          merged.push({
            id: `reg-${reg.id}`,
            registration_id: reg.id,
            organization_id: reg.organization_id,
            venue_id: reg.venue_id,
            stand_code: reg.stand_code,
            status: reg.status, // a_confirmer / a_relancer / confirme / verrouille
            created_at: reg.created_at || reg.updated_at,
            organization: reg.organization,
            venue: reg.venue,
            locked_at: reg.locked_at || null,
            _source: 'registration',
            registration: reg,
          });
        }
      }
      // On ajoute aussi les validation_requests qui n'ont pas de registration correspondante (ex: waitlist sans reg)
      for (const vr of (allValReqs || [])) {
        const hasReg = (allRegs || []).find(r => r.id === vr.registration_id);
        if (!hasReg) merged.push({ ...vr, _source: 'validation_request_only' });
      }
      setRequests(merged);
      // Charge les stands de tous les venues actifs
      const standsMap = {};
      await Promise.all(activeVenues.map(async (v) => {
        try {
          const stands = await api(`/api/venues/${v.id}/stands`);
          standsMap[v.id] = stands || [];
        } catch { /* ignore */ }
      }));
      setStandsByVenue(standsMap);
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  // Group requests by venue + status
  const grouped = useMemo(() => {
    const out = {};
    for (const v of venues) {
      out[v.id] = { venue: v, validated: [], preReserved: [], waitlist: [], freeStands: [] };
    }
    for (const r of requests) {
      const v = r.venue_id;
      if (!out[v]) continue;
      // 🆕 SESSION 48z — Statuts élargis pour couvrir les deux sources (validation_requests + registrations)
      if (r.status === 'validated' || r.status === 'confirme' || r.status === 'locked' || r.status === 'verrouille') {
        out[v].validated.push(r);
      } else if (r.status === 'waitlist') {
        out[v].waitlist.push(r);
      } else if (
        r.status === 'en_attente' || r.status === 'pending' || r.status === 'rdv_fixe' ||
        r.status === 'a_confirmer' || r.status === 'a_relancer'
      ) {
        out[v].preReserved.push(r);
      }
    }
    // Sort waitlist by created_at (par ordre d'arrivée)
    for (const k of Object.keys(out)) {
      out[k].waitlist.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      out[k].waitlist = out[k].waitlist.map((r, i) => ({ ...r, fifo_position: i + 1 }));
      // Free stands
      const stands = standsByVenue[k] || [];
      out[k].freeStands = stands.filter(s => {
        const a = s.assignment;
        const isFree = !a || (a.request_status !== 'pending' && a.request_status !== 'validated');
        return isFree && !s.organization;
      });
    }
    return out;
  }, [venues, requests, standsByVenue]);

  const filtered = activeVenue === 'all' ? Object.values(grouped) : [grouped[activeVenue]].filter(Boolean);
  const totals = useMemo(() => {
    return Object.values(grouped).reduce((acc, g) => ({
      validated: acc.validated + g.validated.length,
      preReserved: acc.preReserved + g.preReserved.length,
      waitlist: acc.waitlist + g.waitlist.length,
    }), { validated: 0, preReserved: 0, waitlist: 0 });
  }, [grouped]);

  // ─── Actions ───
  const openPromote = (req, freeStands) => {
    setPromote({ req, freeStands });
    setTargetStand(freeStands[0]?.stand_code || '');
  };

  const doPromote = async () => {
    if (!promote || !targetStand) return;
    try {
      await api(`/api/admin/waitlist/${promote.req.id}/promote`, {
        method: 'POST',
        body: JSON.stringify({ stand_code: targetStand }),
      });
      toast.success(`✅ Promu vers stand ${targetStand}`);
      setPromote(null);
      setTargetStand('');
      await load();
    } catch (e) { toast.error(e.message); }
  };

  const doRemoveWaitlist = async (req) => {
    if (!window.confirm(`Retirer ${req.organization?.name || 'cet exposant'} de la liste d'attente ?`)) return;
    try {
      await api(`/api/admin/waitlist/${req.id}/remove`, { method: 'POST' });
      toast.success('Retiré');
      await load();
    } catch (e) { toast.error(e.message); }
  };

  const doRefusePending = async (req) => {
    if (!window.confirm(`Refuser la demande de ${req.organization?.name || 'cet exposant'} sur le stand ${req.stand_code} ?`)) return;
    try {
      await api(`/api/validation-requests/${req.id}/decline`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'Refusé par ARACOM' }),
      });
      toast.success(`Demande refusée — stand ${req.stand_code} libéré`);
      await load();
    } catch (e) { toast.error(e.message); }
  };

  const doValidate = async (req) => {
    // Réutilise le flow existant (redirection vers la vue dédiée)
    window.location.href = `/aracom?tab=file-validation&focus=${req.id}`;
  };

  const openSwitch = (waitlister, preReserved) => setSwitchOp({ waitlister, preReserved });
  const doSwitch = async () => {
    if (!switchOp) return;
    const { waitlister, preReserved } = switchOp;
    if (!window.confirm(
      `Échanger ?\n\n` +
      `• ${preReserved.organization?.name} (pré-réservé sur stand ${preReserved.stand_code}) sera REFUSÉ\n` +
      `• ${waitlister.organization?.name} sera PROMU sur le stand ${preReserved.stand_code}\n\n` +
      `Cette action est définitive.`
    )) return;
    try {
      const targetStandCode = preReserved.stand_code;
      // 1) Refuser le pré-réservé (libère le stand)
      await api(`/api/validation-requests/${preReserved.id}/decline`, {
        method: 'POST',
        body: JSON.stringify({ reason: `Échange manuel avec ${waitlister.organization?.name}` }),
      });
      // 2) Promouvoir le waitlister sur le stand libéré
      await api(`/api/admin/waitlist/${waitlister.id}/promote`, {
        method: 'POST',
        body: JSON.stringify({ stand_code: targetStandCode }),
      });
      toast.success(`✅ Échange effectué — ${waitlister.organization?.name} sur stand ${targetStandCode}`);
      setSwitchOp(null);
      await load();
    } catch (e) { toast.error(e.message); }
  };

  if (loading) return <div className="py-12 text-center text-slate-500">Chargement…</div>;

  return (
    <div className="space-y-4">
      {/* Header avec sélecteur site + compteurs */}
      <div className="rounded-md bg-gradient-to-r from-blue-50 via-white to-amber-50 border border-slate-200 px-3 py-2 flex items-center gap-4 flex-wrap shadow-sm">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-blue-600" />
          <h2 className="text-sm font-semibold text-slate-900">Gestion exposants — par site</h2>
        </div>
        <span className="text-slate-300">|</span>
        <div className="flex items-center gap-3 text-xs flex-wrap">
          <span className="inline-flex items-center gap-1"><Check className="w-3 h-3 text-emerald-600" /> <b className="text-emerald-700">{totals.validated}</b> validés</span>
          <span className="inline-flex items-center gap-1"><Hourglass className="w-3 h-3 text-violet-600" /> <b className="text-violet-700">{totals.preReserved}</b> pré-réservés</span>
          <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3 text-amber-600" /> <b className="text-amber-700">{totals.waitlist}</b> en attente</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Select value={activeVenue} onValueChange={setActiveVenue}>
            <SelectTrigger className="h-8 text-xs w-44"><SelectValue placeholder="Filtrer site…" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les sites</SelectItem>
              {venues.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="ghost" size="sm" onClick={load} className="h-8 px-2" title="Actualiser"><RefreshCw className="w-3.5 h-3.5" /></Button>
        </div>
      </div>

      {/* Cards par site */}
      <div className="space-y-3">
        {filtered.map(g => (
          <Card key={g.venue.id} className="overflow-hidden">
            <CardHeader className="pb-2 bg-slate-50">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-blue-600" />
                  <CardTitle className="text-base">{g.venue.name}</CardTitle>
                  <Badge variant="secondary" className="text-[10px]">{g.venue.capacity_stands || 0} stands</Badge>
                  {(() => {
                    // 🆕 SESSION 48x — Site complet si (validés + pré-réservés) ≥ capacité
                    //                  même si certains stands sont encore "libres" physiquement.
                    const capacity = g.venue.capacity_stands || 0;
                    const totalReserved = g.validated.length + g.preReserved.length;
                    const remainingQuota = Math.max(0, capacity - totalReserved);
                    const isComplete = capacity > 0 && totalReserved >= capacity;
                    if (isComplete) {
                      return <Badge className="bg-rose-500 text-white text-[10px]" title={`${totalReserved} / ${capacity} stands réservés (validés + pré-réservés)`}>Site complet</Badge>;
                    }
                    return (
                      <Badge className="bg-emerald-500 text-white text-[10px]" title={`${remainingQuota} place(s) restante(s) sur ${capacity}`}>
                        {remainingQuota} place{remainingQuota > 1 ? 's' : ''} restante{remainingQuota > 1 ? 's' : ''}
                      </Badge>
                    );
                  })()}
                </div>
                <div className="text-[11px] text-slate-500">
                  <b className="text-emerald-700">{g.validated.length}</b>v · <b className="text-violet-700">{g.preReserved.length}</b>p · <b className="text-amber-700">{g.waitlist.length}</b>a
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* ───── COL 1 : VALIDÉS ───── */}
                <Section
                  icon={<Check className="w-3.5 h-3.5 text-emerald-600" />}
                  title="Validés"
                  count={g.validated.length}
                  tone="emerald"
                >
                  {g.validated.length === 0 ? (
                    <Empty label="Aucun exposant validé" />
                  ) : (
                    g.validated.map(r => (
                      <Row key={r.id} icon="🔒" tone="emerald">
                        <ExposantName r={r} onClick={effectiveExposantClick} />
                        <div className="text-[10px] text-slate-500 flex items-center gap-1">
                          <span className="font-mono">{r.stand_code || '—'}</span>
                          {r.locked_at && <span>· verrouillé le {new Date(r.locked_at).toLocaleDateString('fr-FR')} à {new Date(r.locked_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>}
                        </div>
                      </Row>
                    ))
                  )}
                </Section>

                {/* ───── COL 2 : PRÉ-RÉSERVÉS ───── */}
                <Section
                  icon={<Hourglass className="w-3.5 h-3.5 text-violet-600" />}
                  title="Pré-réservés"
                  count={g.preReserved.length}
                  tone="violet"
                >
                  {g.preReserved.length === 0 ? (
                    <Empty label="Aucune pré-réservation" />
                  ) : (
                    g.preReserved.map(r => (
                      <Row key={r.id} icon={r.status === 'rdv_fixe' ? '📅' : '⏳'} tone="violet">
                        <ExposantName r={r} onClick={effectiveExposantClick} />
                        <div className="text-[10px] text-slate-500 flex items-center gap-1 flex-wrap">
                          <span className="font-mono">{r.stand_code}</span>
                          {r.created_at && (
                            <span title={new Date(r.created_at).toLocaleString('fr-FR')}>
                              · soumis le {new Date(r.created_at).toLocaleDateString('fr-FR')} à {new Date(r.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>
                        {!readonly && (
                          <div className="flex items-center gap-1 mt-1">
                            <Button size="sm" onClick={() => doValidate(r)} className="h-6 px-2 text-[10px] bg-emerald-600 hover:bg-emerald-700">
                              <Check className="w-3 h-3 mr-0.5" /> Valider
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => doRefusePending(r)} className="h-6 px-2 text-[10px] border-rose-200 text-rose-700 hover:bg-rose-50">
                              <X className="w-3 h-3 mr-0.5" /> Refuser
                            </Button>
                            {g.waitlist.length > 0 && (
                              <Button size="sm" variant="outline" onClick={() => openSwitch(g.waitlist[0], r)} className="h-6 px-2 text-[10px] border-amber-300 text-amber-800 hover:bg-amber-50" title={`Échanger avec ${g.waitlist[0].organization?.name} (#1 attente)`}>
                                <ArrowLeftRight className="w-3 h-3 mr-0.5" /> Échanger
                              </Button>
                            )}
                          </div>
                        )}
                      </Row>
                    ))
                  )}
                </Section>

                {/* ───── COL 3 : LISTE D'ATTENTE ───── */}
                <Section
                  icon={<Clock className="w-3.5 h-3.5 text-amber-600" />}
                  title="Liste d'attente"
                  count={g.waitlist.length}
                  tone="amber"
                >
                  {g.waitlist.length === 0 ? (
                    <Empty label="Aucun en attente" />
                  ) : (
                    g.waitlist.map(r => {
                      const canPromote = g.freeStands.length > 0;
                      return (
                        <Row key={r.id} icon={`#${r.fifo_position}`} tone="amber">
                          <ExposantName r={r} onClick={effectiveExposantClick} />
                          <div className="text-[10px] text-slate-500 flex items-center gap-1 flex-wrap">
                            {r.requested_stand_code && <span>↦ <code className="font-mono">{r.requested_stand_code}</code></span>}
                            {r.created_at && (
                              <span title={new Date(r.created_at).toLocaleString('fr-FR')}>
                                · inscrit le {new Date(r.created_at).toLocaleDateString('fr-FR')} à {new Date(r.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                          </div>
                          {!readonly && (
                            <div className="flex items-center gap-1 mt-1">
                              <Button
                                size="sm"
                                onClick={() => openPromote(r, g.freeStands)}
                                disabled={!canPromote}
                                className="h-6 px-2 text-[10px] bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40"
                                title={canPromote ? 'Promouvoir vers un stand libre' : 'Aucun stand libre'}
                              >
                                <ArrowUpCircle className="w-3 h-3 mr-0.5" /> Promouvoir
                              </Button>
                              {g.preReserved.length > 0 && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openSwitch(r, g.preReserved[0])}
                                  className="h-6 px-2 text-[10px] border-violet-200 text-violet-700 hover:bg-violet-50"
                                  title={`Échanger avec un pré-réservé`}
                                >
                                  <ArrowLeftRight className="w-3 h-3 mr-0.5" /> Échanger
                                </Button>
                              )}
                              <Button size="sm" variant="ghost" onClick={() => doRemoveWaitlist(r)} className="h-6 px-1.5 text-[10px] text-rose-600 hover:bg-rose-50" title="Retirer de la liste">
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          )}
                        </Row>
                      );
                    })
                  )}
                </Section>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Dialog Promouvoir */}
      <Dialog open={!!promote} onOpenChange={(open) => { if (!open) { setPromote(null); setTargetStand(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Promouvoir {promote?.req.organization?.name}</DialogTitle>
            <DialogDescription>Choisissez le stand libre à attribuer.</DialogDescription>
          </DialogHeader>
          {promote && promote.freeStands.length > 0 && (
            <Select value={targetStand} onValueChange={setTargetStand}>
              <SelectTrigger><SelectValue placeholder="Choisir un stand…" /></SelectTrigger>
              <SelectContent>
                {promote.freeStands.map(s => (
                  <SelectItem key={s.stand_code} value={s.stand_code}>{s.stand_code}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPromote(null)}>Annuler</Button>
            <Button onClick={doPromote} disabled={!targetStand}><ArrowUpCircle className="w-4 h-4 mr-1.5" /> Promouvoir sur {targetStand}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Échange */}
      <Dialog open={!!switchOp} onOpenChange={(open) => { if (!open) setSwitchOp(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ArrowLeftRight className="w-5 h-5 text-amber-600" /> Échanger pré-réservé ↔ liste d&apos;attente</DialogTitle>
            <DialogDescription>L&apos;exposant pré-réservé sera refusé et le waitlister sera placé sur ce stand.</DialogDescription>
          </DialogHeader>
          {switchOp && (
            <div className="space-y-3 py-2">
              <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm">
                <div className="text-[10px] uppercase text-rose-700 font-bold mb-0.5">À refuser</div>
                <div className="font-semibold">{switchOp.preReserved.organization?.name}</div>
                <div className="text-xs text-slate-600">Stand <code className="font-mono">{switchOp.preReserved.stand_code}</code></div>
              </div>
              <div className="text-center text-xl">⇅</div>
              <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm">
                <div className="text-[10px] uppercase text-emerald-700 font-bold mb-0.5">À promouvoir</div>
                <div className="font-semibold">{switchOp.waitlister.organization?.name}</div>
                <div className="text-xs text-slate-600">Liste d&apos;attente — sera placé sur stand <b>{switchOp.preReserved.stand_code}</b></div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSwitchOp(null)}>Annuler</Button>
            <Button onClick={doSwitch} className="bg-amber-600 hover:bg-amber-700"><ArrowLeftRight className="w-4 h-4 mr-1.5" /> Confirmer l&apos;échange</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Petits composants utilitaires ───
function Section({ icon, title, count, tone, children }) {
  const toneClasses = {
    emerald: 'border-emerald-200 bg-emerald-50/30',
    violet: 'border-violet-200 bg-violet-50/30',
    amber: 'border-amber-200 bg-amber-50/30',
  };
  return (
    <div className={`rounded-md border ${toneClasses[tone] || 'border-slate-200'} p-2 space-y-1.5`}>
      <div className="flex items-center gap-1.5 px-1">
        {icon}
        <span className="text-xs font-semibold uppercase tracking-wider">{title}</span>
        <Badge variant="secondary" className="text-[9px] h-4 px-1.5 ml-auto">{count}</Badge>
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function Row({ icon, tone, children }) {
  const toneClasses = {
    emerald: 'border-emerald-100',
    violet: 'border-violet-100',
    amber: 'border-amber-100',
  };
  return (
    <div className={`bg-white rounded border ${toneClasses[tone] || 'border-slate-100'} px-2 py-1.5 flex items-start gap-2`}>
      <span className="text-xs shrink-0 mt-0.5 font-bold opacity-70">{icon}</span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

function Empty({ label }) {
  return <div className="text-[11px] text-slate-400 italic text-center py-2">{label}</div>;
}

// 🆕 SESSION 48w — Nom d'exposant cliquable (ouvre le drawer/handler externe)
function ExposantName({ r, onClick }) {
  const name = r.organization?.name || '—';
  if (typeof onClick === 'function') {
    return (
      <button
        onClick={() => onClick(r)}
        className="font-semibold text-sm truncate text-blue-700 hover:underline cursor-pointer text-left w-full"
        title="Voir la fiche détaillée"
      >
        {name}
      </button>
    );
  }
  return <div className="font-semibold text-sm truncate">{name}</div>;
}

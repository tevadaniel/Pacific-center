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
import { ShieldCheck, Hourglass, ArrowUpCircle, ArrowLeftRight, Check, X, MapPin, RefreshCw, Trash2, Clock, Lock, Mail } from 'lucide-react';
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
  // 🆕 SESSION 52g.5 — Filtre par jour de présence (Vendredi / Samedi / V+S)
  const [dayFilter, setDayFilter] = useState('all'); // 'all' | 'vendredi' | 'samedi' | 'both'

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
        // 🆕 SESSION 53.9 — Le dashboard montre seulement le pipeline d'inscription :
        //   Validées · Pré-réservés · Liste d'attente.
        //   Les statuts amont (prospect/contacte/a_relancer) sont visibles UNIQUEMENT
        //   dans la liste des exposants (Exposants > Liste & fiches) avec le dropdown enrichi.
        if (['prospect', 'contacte', 'cancelled', 'annule', 'refuse', 'refused'].includes(reg.status)) continue;
        const valReq = valByRegId[reg.id];
        if (valReq) {
          // 🆕 SESSION 48ak/al — Propagation des flags swap depuis la registration
          //   On override le status SEULEMENT si valReq est dans la zone "en attente" (pas validé/refusé)
          //   Sinon valReq.status (validated/confirme/refused) a TOUJOURS priorité.
          // 🆕 SESSION 52e FIX — ex_pre_reserved demotés → 'liste_attente' (cohérent avec is_waitlist=true en DB)
          //   tri en fin de liste assuré par swap_demoted_at (cf. ligne ~182)
          // 🆕 SESSION 53.10 — Si valReq est en pre_validated, on conserve ce statut pour le bucket VALIDÉES
          const valStatusInFlight = ['en_attente', 'pending', 'rdv_fixe', 'a_confirmer', 'a_relancer', 'waitlist', 'liste_attente'].includes(valReq.status);
          let effectiveStatus = valReq.status;
          if (valStatusInFlight) {
            if (reg.ex_pre_reserved) effectiveStatus = 'liste_attente';
            else if (reg.swap_promoted_at) effectiveStatus = 'a_confirmer';
          }
          // Si reg est explicitement validé/refusé/verrouille → prime sur tout
          if (['confirme', 'verrouille', 'validated', 'locked', 'refuse', 'refused'].includes(reg.status)) {
            effectiveStatus = reg.status;
          }
          merged.push({
            ...valReq,
            status: effectiveStatus,
            stand_code: reg.stand_code,
            ex_pre_reserved: !!reg.ex_pre_reserved,
            ex_pre_reserved_at: reg.ex_pre_reserved_at || null,
            swap_promoted_at: reg.swap_promoted_at || null,
            swap_demoted_at: reg.swap_demoted_at || null,
            locked_at: reg.locked_at || valReq.locked_at || null,
            _source: 'validation_request',
            registration: reg,
          });
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
            // 🆕 SESSION 48aj — Flags d'échange pour le tri FIFO + affichage badge
            ex_pre_reserved: !!reg.ex_pre_reserved,
            ex_pre_reserved_at: reg.ex_pre_reserved_at || null,
            swap_promoted_at: reg.swap_promoted_at || null,
            swap_demoted_at: reg.swap_demoted_at || null,
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
  // eslint-disable-next-line react-hooks/set-state-in-effect
  const grouped = useMemo(() => {
    const out = {};
    for (const v of venues) {
      out[v.id] = { venue: v, validated: [], _candidates: [], waitlist: [], freeStands: [], overflowCount: 0 };
    }
    for (const r of requests) {
      const v = r.venue_id;
      if (!out[v]) continue;
      // 🆕 SESSION 52g.5 — Filtre par jour de présence (lit attending_days depuis registration ou validation_request)
      const daysAttended = Array.isArray(r.registration?.attending_days)
        ? r.registration.attending_days
        : (Array.isArray(r.attending_days) ? r.attending_days : []);
      const matchesDay = dayFilter === 'all'
        ? true
        : dayFilter === 'vendredi' ? daysAttended.includes('vendredi')
        : dayFilter === 'samedi' ? daysAttended.includes('samedi')
        : dayFilter === 'both' ? (daysAttended.includes('vendredi') && daysAttended.includes('samedi'))
        : true;
      if (!matchesDay) continue;
      // 🆕 SESSION 53.10 — Statuts de validation explicites (cohérent avec site-animations-overview)
      //   validated / confirme / locked / verrouille / pre_validated → VALIDÉES (vert)
      //   Sans ce ajout, les pré-validés étaient silencieusement perdus (cause du décalage "1 place restante" vs "16/16").
      if (r.status === 'validated' || r.status === 'confirme' || r.status === 'locked' || r.status === 'verrouille' || r.status === 'pre_validated') {
        out[v].validated.push(r);
      } else if (
        r.status === 'en_attente' || r.status === 'pending' || r.status === 'rdv_fixe' ||
        r.status === 'a_confirmer' || r.status === 'a_relancer' ||
        r.status === 'waitlist'
      ) {
        out[v]._candidates.push(r);
      } else {
        // 🆕 SESSION 53.10 — Filet de sécurité : tout statut inconnu mais avec stand_code → _candidates
        //   pour éviter de "perdre" un exposant comme c'est arrivé avec pre_validated.
        if (r.stand_code) {
          console.warn('[UnifiedValidationView] Statut inconnu, fallback _candidates :', r.status, r.id);
          out[v]._candidates.push(r);
        }
      }
    }
    // 🆕 SESSION 48ac — Ventilation FIFO (premier arrivé, premier servi) :
    //   - Les N premiers candidats (où N = capacity - validated.length) deviennent "pré-réservés"
    //   - Le reste reste en "liste d'attente"
    //   ➜ Une liste d'attente n'a de sens QUE si le quota max est atteint.
    //   ➜ Si des places sont disponibles, les entrées waitlist sont AUTO-PROMUES en pré-réservé.
    for (const k of Object.keys(out)) {
      const g = out[k];
      const capacity = g.venue.capacity_stands || 0;
      const slotsForPre = Math.max(0, capacity - g.validated.length);
      // 🆕 SESSION 48aj — Tri FIFO avancé :
      //   1. swap_promoted_at en TÊTE (l'admin a choisi de les promouvoir)
      //   2. created_at normal au milieu
      //   3. swap_demoted_at en FIN (ex-pré-réservés rétrogradés)
      const sortKey = (r) => {
        if (r.swap_promoted_at) return new Date(r.swap_promoted_at).getTime() - 1e15; // tout en haut
        if (r.swap_demoted_at) return new Date(r.swap_demoted_at).getTime() + 1e15;   // tout en bas
        return new Date(r.created_at || 0).getTime();
      };
      g._candidates.sort((a, b) => sortKey(a) - sortKey(b));
      g.preReserved = g._candidates.slice(0, slotsForPre);
      const overflow = g._candidates.slice(slotsForPre);
      // Conserve les marquages auto-waitlist et numéro FIFO
      g.waitlist = overflow.map((r, i) => ({
        ...r,
        _auto_waitlist: r.status !== 'waitlist', // marqué si à l'origine c'était une pré-réservation
        fifo_position: i + 1,
      }));
      g.overflowCount = overflow.length;
      delete g._candidates;
      // Free stands physiques
      const stands = standsByVenue[k] || [];
      g.freeStands = stands.filter(s => {
        const a = s.assignment;
        const isFree = !a || (a.request_status !== 'pending' && a.request_status !== 'validated');
        return isFree && !s.organization;
      });
    }
    return out;
  }, [venues, requests, standsByVenue, dayFilter]);

  const filtered = activeVenue === 'all' ? Object.values(grouped) : [grouped[activeVenue]].filter(Boolean);
  const totals = useMemo(() => {
    return Object.values(grouped).reduce((acc, g) => ({
      validated: acc.validated + g.validated.length,
      preReserved: acc.preReserved + g.preReserved.length,
      waitlist: acc.waitlist + g.waitlist.length,
    }), { validated: 0, preReserved: 0, waitlist: 0 });
  }, [grouped]);

  // 🆕 SESSION 52g.5 — Compteurs par jour (sur tous les requests, ignorant le dayFilter actif)
  const dayCounts = useMemo(() => {
    const c = { ven: 0, sam: 0, both: 0, unknown: 0 };
    for (const r of requests) {
      const days = Array.isArray(r.registration?.attending_days)
        ? r.registration.attending_days
        : (Array.isArray(r.attending_days) ? r.attending_days : []);
      const isVen = days.includes('vendredi');
      const isSam = days.includes('samedi');
      if (isVen && isSam) c.both++;
      else if (isVen) c.ven++;
      else if (isSam) c.sam++;
      else c.unknown++;
    }
    return c;
  }, [requests]);

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
      // 🆕 SESSION 48ab — Refus direct par registration_id (uniforme entre validation_requests et registrations)
      const regId = req.registration_id || req.id;
      await api(`/api/admin/registrations/${regId}/refuse`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'Refusé par ARACOM' }),
      });
      toast.success(`Demande refusée — stand ${req.stand_code} libéré`);
      await load();
    } catch (e) { toast.error(e.message); }
  };

  const doValidate = async (req) => {
    // 🆕 SESSION 48ab — Validation directe via /api/admin/registrations/:id/validate
    const regId = req.registration_id || req.id;
    if (!window.confirm(`Valider l'inscription de ${req.organization?.name || 'cet exposant'} sur le stand ${req.stand_code} ?\n\n(L'exposant passera en statut "Validé". Pensez à avoir reçu la caution et la convention signée avant de valider.)`)) return;
    try {
      await api(`/api/admin/registrations/${regId}/validate`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      toast.success(`✅ ${req.organization?.name || 'Exposant'} validé — stand ${req.stand_code}`);
      await load();
    } catch (e) { toast.error(`❌ ${e.message}`); }
  };

  // 🆕 SESSION 48ae — Le dialogue d'échange s'ouvre désormais au niveau du site (venue)
  //                  et propose 2 menus déroulants pour choisir qui remplace qui.
  const openSwitch = (venueGroup, initialWaitlister = null, initialPreReserved = null) => {
    setSwitchOp({
      venue: venueGroup.venue,
      preReservedOptions: venueGroup.preReserved,
      waitlistOptions: venueGroup.waitlist,
      selectedPreReservedId: initialPreReserved?.registration_id || initialPreReserved?.id || venueGroup.preReserved[0]?.registration_id || venueGroup.preReserved[0]?.id || '',
      selectedWaitlisterId: initialWaitlister?.registration_id || initialWaitlister?.id || venueGroup.waitlist[0]?.registration_id || venueGroup.waitlist[0]?.id || '',
    });
  };
  const doSwitch = async () => {
    if (!switchOp) return;
    const { preReservedOptions, waitlistOptions, selectedPreReservedId, selectedWaitlisterId } = switchOp;
    const preReserved = preReservedOptions.find(r => (r.registration_id || r.id) === selectedPreReservedId);
    const waitlister = waitlistOptions.find(r => (r.registration_id || r.id) === selectedWaitlisterId);
    if (!preReserved || !waitlister) { toast.error('Sélection incomplète'); return; }
    if (!window.confirm(
      `Échanger ?\n\n` +
      `• ${preReserved.organization?.name || preReservedOptions[0]?.organization?.name} (pré-réservé sur stand ${preReserved.stand_code}) sera REFUSÉ\n` +
      `• ${waitlister.organization?.name} sera PROMU sur le stand ${preReserved.stand_code}\n\n` +
      `Cette action est définitive.`
    )) return;
    setSwitchOp({ ...switchOp, _processing: true });
    try {
      const promoteId = waitlister.registration_id || waitlister.id;
      const refuseId = preReserved.registration_id || preReserved.id;
      await api(`/api/admin/registrations/${promoteId}/swap`, {
        method: 'POST',
        body: JSON.stringify({ with_registration_id: refuseId }),
      });
      // 🆕 SESSION 48af — Toast très visible + état success dans le dialog
      toast.success(`✅ Échange effectué — ${waitlister.organization?.name || 'Exposant'} placé sur stand ${preReserved.stand_code}`, {
        description: `${preReserved.organization?.name || 'L\'ancien exposant'} a été refusé et libère le stand.`,
        duration: 6000,
      });
      setSwitchOp({
        ...switchOp,
        _processing: false,
        _success: {
          promotedName: waitlister.organization?.name || 'Exposant',
          refusedName: preReserved.organization?.name || 'Ancien exposant',
          newStand: preReserved.stand_code,
        }
      });
      // Recharge les données puis ferme la modale après 2.5s
      await load();
      setTimeout(() => setSwitchOp(null), 2500);
    } catch (e) {
      toast.error(`❌ ${e.message}`, { duration: 6000 });
      setSwitchOp({ ...switchOp, _processing: false });
    }
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
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          {/* 🆕 SESSION 52g.5 — Filtre par jour Vendredi/Samedi */}
          <Select value={dayFilter} onValueChange={setDayFilter}>
            <SelectTrigger className="h-8 text-xs w-44" data-testid="unified-day-filter"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">📅 Tous les jours ({dayCounts.ven + dayCounts.sam + dayCounts.both})</SelectItem>
              <SelectItem value="vendredi">🟦 Vendredi 14/08 ({dayCounts.ven + dayCounts.both})</SelectItem>
              <SelectItem value="samedi">🟪 Samedi 15/08 ({dayCounts.sam + dayCounts.both})</SelectItem>
              <SelectItem value="both">✅ Vendredi + Samedi ({dayCounts.both})</SelectItem>
            </SelectContent>
          </Select>
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

      {/* 🆕 SESSION 52g.12 — Tableau global de remplissage par jour + statistiques */}
      <GlobalFillingDashboard venues={venues} requests={requests} />

      {/* Cards par site */}
      <div className="space-y-3">
        {filtered.map(g => {
          // 🆕 SESSION 52g.7 — Comptages par jour pour chaque bucket
          const dayBreakdown = (items) => {
            const c = { ven: 0, sam: 0, both: 0, unknown: 0 };
            for (const r of items) {
              const days = Array.isArray(r._attendingDays) ? r._attendingDays
                : Array.isArray(r.registration?.attending_days) ? r.registration.attending_days
                : Array.isArray(r.attending_days) ? r.attending_days : [];
              const isVen = days.includes('vendredi');
              const isSam = days.includes('samedi');
              if (isVen && isSam) c.both++;
              else if (isVen) c.ven++;
              else if (isSam) c.sam++;
              else c.unknown++;
            }
            // Présents le jour = "ven seul" + "V+S" pour vendredi, "sam seul" + "V+S" pour samedi
            return {
              ...c,
              vendredi_total: c.ven + c.both,
              samedi_total: c.sam + c.both,
            };
          };
          const valBreakdown = dayBreakdown(g.validated);
          const preBreakdown = dayBreakdown(g.preReserved);
          const waitBreakdown = dayBreakdown(g.waitlist);
          // 🆕 SESSION 52g.11 — Helper : sépare les items en sous-colonnes Vendredi / Samedi.
          //   Un exposant présent les 2 jours apparaît dans LES 2 colonnes (le but est de voir le jour).
          const getDays = (r) => {
            return Array.isArray(r._attendingDays) ? r._attendingDays
              : Array.isArray(r.registration?.attending_days) ? r.registration.attending_days
              : Array.isArray(r.attending_days) ? r.attending_days : [];
          };
          const splitByDay = (items) => {
            const ven = [], sam = [], unknown = [];
            for (const r of items) {
              const d = getDays(r);
              const isVen = d.includes('vendredi');
              const isSam = d.includes('samedi');
              if (isVen) ven.push(r);
              if (isSam) sam.push(r);
              if (!isVen && !isSam) unknown.push(r);
            }
            return { ven, sam, unknown };
          };
          const valByDay = splitByDay(g.validated);
          const preByDay = splitByDay(g.preReserved);
          const waitByDay = splitByDay(g.waitlist);
          // 🆕 Récap stands par jour (validés + pré-réservés) vs capacité
          const capacity = g.venue.capacity_stands || 0;
          const venDayReserved = valBreakdown.vendredi_total + preBreakdown.vendredi_total;
          const samDayReserved = valBreakdown.samedi_total + preBreakdown.samedi_total;
          const venFull = capacity > 0 && venDayReserved >= capacity;
          const samFull = capacity > 0 && samDayReserved >= capacity;
          return (
          <Card key={g.venue.id} className="overflow-hidden">
            <CardHeader className="pb-2 bg-slate-50">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <MapPin className="w-4 h-4 text-blue-600" />
                  <CardTitle className="text-base">{g.venue.name}</CardTitle>
                  <Badge variant="secondary" className="text-[10px]">{g.venue.capacity_stands || 0} stands</Badge>
                  {(() => {
                    // 🆕 SESSION 48x — Site complet si (validés + pré-réservés) ≥ capacité
                    //                  même si certains stands sont encore "libres" physiquement.
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
                  {/* 🆕 SESSION 52g.7 — Récap remplissage par jour */}
                  <Badge
                    className={`text-[10px] border ${venFull ? 'bg-rose-100 text-rose-900 border-rose-300' : 'bg-blue-100 text-blue-900 border-blue-300'}`}
                    title={`Vendredi 14/08 : ${venDayReserved} exposants sur ${capacity} stands (validés + pré-réservés)`}
                  >
                    📅 Ven 14/08 : <b className="ml-0.5">{venDayReserved}/{capacity}</b>{venFull ? ' · complet' : ''}
                  </Badge>
                  <Badge
                    className={`text-[10px] border ${samFull ? 'bg-rose-100 text-rose-900 border-rose-300' : 'bg-purple-100 text-purple-900 border-purple-300'}`}
                    title={`Samedi 15/08 : ${samDayReserved} exposants sur ${capacity} stands (validés + pré-réservés)`}
                  >
                    📅 Sam 15/08 : <b className="ml-0.5">{samDayReserved}/{capacity}</b>{samFull ? ' · complet' : ''}
                  </Badge>
                </div>
                <div className="text-[11px] text-slate-500">
                  <b className="text-emerald-700">{g.validated.length}</b>v · <b className="text-violet-700">{g.preReserved.length}</b>p · <b className="text-amber-700">{g.waitlist.length}</b>a
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-3">
              {/* 🆕 SESSION 52g.7 — Sous-en-tête : récap par bucket et par jour */}
              <div className="grid grid-cols-3 gap-3 mb-2 text-[10px]">
                <DayBreakdownStrip tone="emerald" label="Validées" bd={valBreakdown} />
                <DayBreakdownStrip tone="violet" label="Pré-inscription site" bd={preBreakdown} />
                <DayBreakdownStrip tone="amber" label="Hors quota" bd={waitBreakdown} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* ───── COL 1 : VALIDÉS (par jour) ───── */}
                <Section
                  icon={<Check className="w-3.5 h-3.5 text-emerald-600" />}
                  title="Validés"
                  count={g.validated.length}
                  tone="emerald"
                >
                  <DayColumns
                    venItems={valByDay.ven}
                    samItems={valByDay.sam}
                    emptyLabel="—"
                    renderRow={(r) => (
                      <Row key={r.id} icon="🔒" tone="emerald">
                        <ExposantName r={r} onClick={effectiveExposantClick} />
                        <div className="text-[10px] text-slate-500 flex items-center gap-1 flex-wrap">
                          <span className="font-mono">{r.stand_code || '—'}</span>
                          {r.locked_at && <span>· {new Date(r.locked_at).toLocaleDateString('fr-FR')}</span>}
                        </div>
                        {!readonly && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="mt-1 h-6 text-[10px] bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100 gap-1 px-2"
                            onClick={async () => {
                              if (!confirm(`Envoyer la confirmation d'inscription + reçu de caution à ${r.organization?.name || r.organization?.main_email || 'cet exposant'} ?`)) return;
                              try {
                                const regId = r.registration_id || r.id;
                                await api(`/api/admin/registrations/${regId}/send-confirmation`, { method: 'POST', body: JSON.stringify({}) });
                                toast.success('✉️ Confirmation d\'inscription + reçu envoyés');
                              } catch (e) { toast.error(`❌ ${e.message}`); }
                            }}
                          >
                            <Mail className="w-3 h-3" /> Confirmation
                          </Button>
                        )}
                      </Row>
                    )}
                  />
                </Section>

                {/* ───── COL 2 : PRÉ-INSCRIPTION SITE (par jour) ───── */}
                {/* 🆕 SESSION 53.18 — Renommée "Pré-inscription site" : ces exposants ont juste
                    choisi un site (pas de stand committé, pas encore soumis le tunnel). */}
                <Section
                  icon={<Hourglass className="w-3.5 h-3.5 text-violet-600" />}
                  title="Pré-inscription site"
                  count={g.preReserved.length}
                  tone="violet"
                >
                  <DayColumns
                    venItems={preByDay.ven}
                    samItems={preByDay.sam}
                    emptyLabel="—"
                    renderRow={(r) => {
                      const reg = r.registration || {};
                      const hasSubmitted = !!(reg.validation_requested_at || reg.validation_request_id || r._source === 'validation_request');
                      return (
                        <Row key={r.id} icon={r.status === 'rdv_fixe' ? '📅' : '⏳'} tone="violet">
                          <ExposantName r={r} onClick={effectiveExposantClick} />
                          <div className="text-[10px] text-slate-500 flex items-center gap-1 flex-wrap">
                            {r.stand_code && <span className="font-mono">{r.stand_code}</span>}
                            {r.created_at && (
                              <span title={new Date(r.created_at).toLocaleString('fr-FR')}>· {new Date(r.created_at).toLocaleDateString('fr-FR')}</span>
                            )}
                            {!hasSubmitted && (
                              <Badge className="bg-slate-100 text-slate-600 border border-slate-300 text-[9px] px-1 py-0" title="L'exposant a choisi son site mais n'a pas encore choisi de stand ni soumis sa demande">
                                📋 Site choisi · tunnel en cours
                              </Badge>
                            )}
                          </div>
                          {!readonly && hasSubmitted && (
                            <div className="flex items-center gap-1 mt-1 flex-wrap">
                              <Button size="sm" onClick={() => doValidate(r)} className="h-6 px-1.5 text-[10px] bg-emerald-600 hover:bg-emerald-700" title="Valider">
                                <Check className="w-3 h-3" />
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => doRefusePending(r)} className="h-6 px-1.5 text-[10px] border-rose-200 text-rose-700 hover:bg-rose-50" title="Refuser">
                                <X className="w-3 h-3" />
                              </Button>
                              {g.waitlist.length > 0 && (
                                <Button size="sm" variant="outline" onClick={() => openSwitch(g, g.waitlist[0], r)} className="h-6 px-1.5 text-[10px] border-amber-300 text-amber-800 hover:bg-amber-50" title={`Échanger sur ${g.venue.name}`}>
                                  <ArrowLeftRight className="w-3 h-3" />
                                </Button>
                              )}
                            </div>
                          )}
                        </Row>
                      );
                    }}
                  />
                </Section>

                {/* ───── COL 3 : SURPLUS HORS QUOTA (anciennement "Liste d'attente") ───── */}
                {/* 🆕 SESSION 53.18 — Renommée : ce sont toujours des demandes EN COURS sur ce site,
                    mais au-delà de la capacité d'accueil → seront promues si une place se libère. */}
                <Section
                  icon={<Clock className="w-3.5 h-3.5 text-amber-600" />}
                  title="Pré-inscription (hors quota)"
                  count={g.waitlist.length}
                  tone="amber"
                >
                  {/* 🆕 SESSION 52g.11 — Liste d'attente par jour */}
                  <DayColumns
                    venItems={waitByDay.ven}
                    samItems={waitByDay.sam}
                    emptyLabel="—"
                    renderRow={(r) => {
                      const canPromote = g.freeStands.length > 0;
                      // 🆕 SESSION 53.15 — Idem actions waitlist : visibles UNIQUEMENT si l'exposant a soumis.
                      const reg = r.registration || {};
                      const hasSubmitted = !!(reg.validation_requested_at || reg.validation_request_id || r._source === 'validation_request');
                      return (
                        <Row key={r.id} icon={`#${r.fifo_position}`} tone="amber">
                          <ExposantName r={r} onClick={effectiveExposantClick} />
                          <div className="text-[10px] text-slate-500 flex items-center gap-1 flex-wrap">
                            {r.requested_stand_code && <span>↦ <code className="font-mono">{r.requested_stand_code}</code></span>}
                            {r.created_at && (
                              <span title={new Date(r.created_at).toLocaleString('fr-FR')}>· {new Date(r.created_at).toLocaleDateString('fr-FR')}</span>
                            )}
                            {r.ex_pre_reserved && (
                              <Badge className="bg-orange-100 text-orange-800 border border-orange-300 text-[9px] px-1 py-0">↩️ Ancien pré-réservé</Badge>
                            )}
                            {!hasSubmitted && (
                              <Badge className="bg-slate-100 text-slate-600 border border-slate-300 text-[9px] px-1 py-0">📋 En cours de création</Badge>
                            )}
                          </div>
                          {!readonly && hasSubmitted && (
                            <div className="flex items-center gap-1 mt-1 flex-wrap">
                              <Button
                                size="sm"
                                onClick={() => openPromote(r, g.freeStands)}
                                disabled={!canPromote}
                                className="h-6 px-1.5 text-[10px] bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40"
                                title={canPromote ? 'Promouvoir vers un stand libre' : 'Aucun stand libre'}
                              >
                                <ArrowUpCircle className="w-3 h-3" />
                              </Button>
                              {g.preReserved.length > 0 && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openSwitch(g, r, g.preReserved[0])}
                                  className="h-6 px-1.5 text-[10px] border-violet-200 text-violet-700 hover:bg-violet-50"
                                  title={`Échanger sur ${g.venue.name}`}
                                >
                                  <ArrowLeftRight className="w-3 h-3" />
                                </Button>
                              )}
                              <Button size="sm" variant="ghost" onClick={() => doRemoveWaitlist(r)} className="h-6 px-1.5 text-[10px] text-rose-600 hover:bg-rose-50" title="Retirer de la liste">
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          )}
                        </Row>
                      );
                    }}
                  />
                </Section>

              </div>
            </CardContent>
          </Card>
          );
        })}
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ArrowLeftRight className="w-5 h-5 text-amber-600" /> Échanger pré-réservé ↔ liste d&apos;attente</DialogTitle>
            <DialogDescription>
              Choisissez qui remplace qui sur le site <b>{switchOp?.venue?.name}</b>. L&apos;exposant pré-réservé sera refusé et le waitlister prendra son stand.
            </DialogDescription>
          </DialogHeader>
          {switchOp?._success ? (
            /* 🆕 SESSION 48af — Écran de succès très visible */
            <div className="space-y-3 py-6 text-center">
              <div className="mx-auto w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
                <Check className="w-9 h-9 text-emerald-600" />
              </div>
              <div className="text-lg font-bold text-emerald-800">Échange effectué !</div>
              <div className="rounded-md border-2 border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900 space-y-1">
                <div>🟢 <b>{switchOp._success.promotedName}</b> placé sur stand <code className="font-mono bg-white px-1.5 py-0.5 rounded">{switchOp._success.newStand}</code></div>
                <div>🔴 <b>{switchOp._success.refusedName}</b> refusé et libéré</div>
              </div>
              <div className="text-xs text-slate-500">Cette fenêtre se ferme dans 2 secondes…</div>
            </div>
          ) : switchOp && (
            <div className="space-y-4 py-2">
              {/* Pré-réservé à refuser */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-rose-800 flex items-center gap-1">
                  <X className="w-3.5 h-3.5" /> Pré-réservé à refuser (libère son stand)
                </label>
                <Select
                  value={switchOp.selectedPreReservedId}
                  onValueChange={(v) => setSwitchOp({ ...switchOp, selectedPreReservedId: v })}
                  disabled={switchOp._processing}
                >
                  <SelectTrigger className="border-rose-300 bg-rose-50/40">
                    <SelectValue placeholder="Choisir un pré-réservé…" />
                  </SelectTrigger>
                  <SelectContent>
                    {switchOp.preReservedOptions.length === 0 ? (
                      <SelectItem value="__empty__" disabled>Aucun pré-réservé disponible</SelectItem>
                    ) : (
                      switchOp.preReservedOptions.map(r => (
                        <SelectItem key={r.registration_id || r.id} value={r.registration_id || r.id}>
                          {r.organization?.name || r.organization?.main_email || 'Sans nom'} — Stand {r.stand_code || '—'}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="text-center text-xl">⇅</div>
              {/* Waitlister à promouvoir */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-emerald-800 flex items-center gap-1">
                  <ArrowUpCircle className="w-3.5 h-3.5" /> Waitlister à promouvoir (prend le stand libéré)
                </label>
                <Select
                  value={switchOp.selectedWaitlisterId}
                  onValueChange={(v) => setSwitchOp({ ...switchOp, selectedWaitlisterId: v })}
                  disabled={switchOp._processing}
                >
                  <SelectTrigger className="border-emerald-300 bg-emerald-50/40">
                    <SelectValue placeholder="Choisir un waitlister…" />
                  </SelectTrigger>
                  <SelectContent>
                    {switchOp.waitlistOptions.length === 0 ? (
                      <SelectItem value="__empty__" disabled>Aucune liste d&apos;attente</SelectItem>
                    ) : (
                      switchOp.waitlistOptions.map((r, i) => (
                        <SelectItem key={r.registration_id || r.id} value={r.registration_id || r.id}>
                          #{i + 1} — {r.organization?.name || r.organization?.main_email || 'Sans nom'}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              {/* Récap */}
              {switchOp.selectedPreReservedId && switchOp.selectedWaitlisterId && (() => {
                const preR = switchOp.preReservedOptions.find(r => (r.registration_id || r.id) === switchOp.selectedPreReservedId);
                const wl = switchOp.waitlistOptions.find(r => (r.registration_id || r.id) === switchOp.selectedWaitlisterId);
                if (!preR || !wl) return null;
                return (
                  <div className="rounded-md border border-amber-300 bg-amber-50 p-2.5 text-xs">
                    <b>Récapitulatif :</b><br />
                    🔴 <b>{preR.organization?.name}</b> refusé sur stand <code className="font-mono">{preR.stand_code}</code><br />
                    🟢 <b>{wl.organization?.name}</b> placé sur stand <code className="font-mono">{preR.stand_code}</code>
                  </div>
                );
              })()}
            </div>
          )}
          {!switchOp?._success && (
            <DialogFooter>
              <Button variant="outline" onClick={() => setSwitchOp(null)} disabled={switchOp?._processing}>Annuler</Button>
              <Button
                onClick={doSwitch}
                disabled={!switchOp?.selectedPreReservedId || !switchOp?.selectedWaitlisterId || switchOp?.preReservedOptions.length === 0 || switchOp?.waitlistOptions.length === 0 || switchOp?._processing}
                className="bg-amber-600 hover:bg-amber-700"
              >
                {switchOp?._processing ? (
                  <><RefreshCw className="w-4 h-4 mr-1.5 animate-spin" /> Échange en cours…</>
                ) : (
                  <><ArrowLeftRight className="w-4 h-4 mr-1.5" /> Confirmer l&apos;échange</>
                )}
              </Button>
            </DialogFooter>
          )}
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
    sky: 'border-sky-200 bg-sky-50/30',
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
    sky: 'border-sky-100',
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

// 🆕 SESSION 52g.11 — DayColumns : sépare un bucket en 2 sous-colonnes Vendredi / Samedi
function DayColumns({ venItems, samItems, renderRow, emptyLabel, tone = 'slate' }) {
  const toneRing = {
    emerald: 'border-blue-200', // header ven
    violet: 'border-blue-200',
    amber: 'border-blue-200',
    slate: 'border-blue-200',
  };
  return (
    <div className="grid grid-cols-2 gap-1.5">
      <div className="space-y-1">
        <div className="text-[9px] uppercase tracking-wider font-bold text-blue-700 px-1.5 py-0.5 rounded bg-blue-50 border border-blue-200 text-center">
          📅 Vendredi <span className="ml-0.5 text-blue-900">({venItems.length})</span>
        </div>
        <div className="space-y-1">
          {venItems.length === 0 ? <Empty label={emptyLabel} /> : venItems.map(renderRow)}
        </div>
      </div>
      <div className="space-y-1">
        <div className="text-[9px] uppercase tracking-wider font-bold text-purple-700 px-1.5 py-0.5 rounded bg-purple-50 border border-purple-200 text-center">
          📅 Samedi <span className="ml-0.5 text-purple-900">({samItems.length})</span>
        </div>
        <div className="space-y-1">
          {samItems.length === 0 ? <Empty label={emptyLabel} /> : samItems.map(renderRow)}
        </div>
      </div>
    </div>
  );
}

// 🆕 SESSION 48w — Nom d'exposant cliquable (ouvre le drawer/handler externe)
// 🆕 SESSION 48w — Nom d'exposant cliquable (ouvre le drawer/handler externe)
function ExposantName({ r, onClick }) {
  const name = r.organization?.name || '—';
  // 🆕 SESSION 52g.12 — Affichage Vendredi/Samedi ✅/❌ très visible
  const days = Array.isArray(r._attendingDays) ? r._attendingDays
    : Array.isArray(r.registration?.attending_days) ? r.registration.attending_days
    : Array.isArray(r.attending_days) ? r.attending_days
    : [];
  const hasVen = days.includes('vendredi');
  const hasSam = days.includes('samedi');
  const dayBadges = (
    <span className="inline-flex items-center gap-1 ml-1 shrink-0 text-[10px]">
      <span
        className={`inline-flex items-center gap-0.5 px-1 py-0.5 rounded border font-semibold ${hasVen ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-rose-50 border-rose-300 text-rose-700'}`}
        title={hasVen ? 'Inscrit le vendredi 14/08' : 'Pas inscrit le vendredi'}
      >
        Ven {hasVen ? '✅' : '❌'}
      </span>
      <span
        className={`inline-flex items-center gap-0.5 px-1 py-0.5 rounded border font-semibold ${hasSam ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-rose-50 border-rose-300 text-rose-700'}`}
        title={hasSam ? 'Inscrit le samedi 15/08' : 'Pas inscrit le samedi'}
      >
        Sam {hasSam ? '✅' : '❌'}
      </span>
    </span>
  );
  if (typeof onClick === 'function') {
    return (
      <div className="flex items-center gap-1 w-full">
        <button
          onClick={() => onClick(r)}
          className="font-semibold text-sm truncate text-blue-700 hover:underline cursor-pointer text-left flex-1 min-w-0"
          title="Voir la fiche détaillée"
        >
          {name}
        </button>
        {dayBadges}
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1 w-full">
      <div className="font-semibold text-sm truncate flex-1 min-w-0">{name}</div>
      {dayBadges}
    </div>
  );
}

// 🆕 SESSION 52g.7 — Strip récap d'un bucket (validés / pré-réservés / liste d'attente) par jour
function DayBreakdownStrip({ tone = 'slate', label, bd }) {
  const tones = {
    emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-900', accent: 'text-emerald-700' },
    violet: { bg: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-900', accent: 'text-violet-700' },
    amber: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-900', accent: 'text-amber-700' },
    sky: { bg: 'bg-sky-50', border: 'border-sky-200', text: 'text-sky-900', accent: 'text-sky-700' },
    slate: { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-900', accent: 'text-slate-700' },
  };
  const t = tones[tone] || tones.slate;
  const total = bd.ven + bd.sam + bd.both + bd.unknown;
  return (
    <div className={`rounded-md border ${t.border} ${t.bg} px-2 py-1.5 flex items-center justify-between gap-2`}>
      <div className={`font-semibold ${t.text} text-[10px] truncate`}>{label}</div>
      <div className="flex items-center gap-1.5 text-[10px] flex-wrap">
        <span className="inline-flex items-center gap-0.5" title={`Vendredi 14/08 : ${bd.vendredi_total} exposant(s)`}>
          <span className="font-bold text-blue-800">V</span><span className={`font-mono ${t.accent}`}>{bd.vendredi_total}</span>
        </span>
        <span className="text-slate-300">·</span>
        <span className="inline-flex items-center gap-0.5" title={`Samedi 15/08 : ${bd.samedi_total} exposant(s)`}>
          <span className="font-bold text-purple-800">S</span><span className={`font-mono ${t.accent}`}>{bd.samedi_total}</span>
        </span>
        {bd.both > 0 && (
          <>
            <span className="text-slate-300">·</span>
            <span className="inline-flex items-center gap-0.5" title="Exposants présents les 2 jours">
              <span className="font-bold text-emerald-800">V+S</span><span className={`font-mono ${t.accent}`}>{bd.both}</span>
            </span>
          </>
        )}
        {bd.unknown > 0 && (
          <>
            <span className="text-slate-300">·</span>
            <span className="inline-flex items-center gap-0.5" title="Jours non définis">
              <span className="font-bold text-slate-500">?</span><span className={`font-mono ${t.accent}`}>{bd.unknown}</span>
            </span>
          </>
        )}
        <span className="text-slate-300">·</span>
        <span className={`font-mono ${t.accent}`} title="Total dans ce bucket">total {total}</span>
      </div>
    </div>
  );
}



// 🆕 SESSION 52g.12 — Tableau global de remplissage par jour + statistiques rapides
function GlobalFillingDashboard({ venues, requests }) {
  // Capacité totale = somme des capacity_stands de TOUS les sites visibles
  const totalCapacity = (venues || []).reduce((sum, v) => sum + (v.capacity_stands || 0), 0);
  // Pour chaque jour, on compte les exposants validés + pré-réservés (= "réservant un stand pour ce jour")
  // 🆕 SESSION 53.10 — ACTIVE_STATUSES inclut désormais pre_validated et a_relancer pour cohérence avec grouped()
  const ACTIVE_STATUSES = ['validated', 'confirme', 'locked', 'verrouille', 'pre_validated', 'en_attente', 'pending', 'rdv_fixe', 'a_confirmer', 'a_relancer'];
  let venReserved = 0, samReserved = 0;
  let venOnly = 0, samOnly = 0, both = 0;
  for (const r of (requests || [])) {
    if (!ACTIVE_STATUSES.includes(r.status)) continue; // exclut waitlist + annulé
    const days = Array.isArray(r._attendingDays) ? r._attendingDays
      : Array.isArray(r.registration?.attending_days) ? r.registration.attending_days
      : Array.isArray(r.attending_days) ? r.attending_days : [];
    const isVen = days.includes('vendredi');
    const isSam = days.includes('samedi');
    if (isVen) venReserved++;
    if (isSam) samReserved++;
    if (isVen && isSam) both++;
    else if (isVen) venOnly++;
    else if (isSam) samOnly++;
  }
  const venPct = totalCapacity > 0 ? Math.round((venReserved / totalCapacity) * 100) : 0;
  const samPct = totalCapacity > 0 ? Math.round((samReserved / totalCapacity) * 100) : 0;
  const venRem = Math.max(0, totalCapacity - venReserved);
  const samRem = Math.max(0, totalCapacity - samReserved);
  // 🎨 Couleurs : rouge < 50%, orange 50-80%, vert > 80%
  const colorForPct = (pct) => {
    if (pct < 50) return { bar: 'bg-rose-500', text: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200' };
    if (pct < 80) return { bar: 'bg-orange-500', text: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200' };
    return { bar: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' };
  };
  const venColors = colorForPct(venPct);
  const samColors = colorForPct(samPct);

  if (totalCapacity === 0) return null;

  return (
    <Card className="border-2 border-slate-200">
      <CardContent className="p-4 space-y-4">
        <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
          📊 <span>Remplissage global du Forum</span>
          <Badge variant="secondary" className="text-[10px]">{venues?.length || 0} sites · {totalCapacity} stands au total</Badge>
        </div>

        {/* Jauges Ven & Sam */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* VENDREDI */}
          <div className={`rounded-lg border-2 ${venColors.border} ${venColors.bg} p-3`}>
            <div className="flex items-center justify-between mb-2">
              <div className="font-bold text-sm text-blue-900">📅 Vendredi 14/08</div>
              <div className={`font-mono text-sm font-bold ${venColors.text}`}>
                {venReserved} / {totalCapacity} <span className="text-xs">({venPct}%)</span>
              </div>
            </div>
            <div className="h-4 w-full rounded-full bg-white border border-slate-200 overflow-hidden">
              <div
                className={`h-full ${venColors.bar} transition-all duration-500`}
                style={{ width: `${Math.min(100, venPct)}%` }}
              />
            </div>
            <div className="mt-2 text-xs text-slate-700 flex items-center justify-between">
              <span>Places restantes :</span>
              <b className={venColors.text}>{venRem}</b>
            </div>
          </div>

          {/* SAMEDI */}
          <div className={`rounded-lg border-2 ${samColors.border} ${samColors.bg} p-3`}>
            <div className="flex items-center justify-between mb-2">
              <div className="font-bold text-sm text-purple-900">📅 Samedi 15/08</div>
              <div className={`font-mono text-sm font-bold ${samColors.text}`}>
                {samReserved} / {totalCapacity} <span className="text-xs">({samPct}%)</span>
              </div>
            </div>
            <div className="h-4 w-full rounded-full bg-white border border-slate-200 overflow-hidden">
              <div
                className={`h-full ${samColors.bar} transition-all duration-500`}
                style={{ width: `${Math.min(100, samPct)}%` }}
              />
            </div>
            <div className="mt-2 text-xs text-slate-700 flex items-center justify-between">
              <span>Places restantes :</span>
              <b className={samColors.text}>{samRem}</b>
            </div>
          </div>
        </div>

        {/* Statistiques */}
        <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-200">
          <div className="rounded-md border border-blue-200 bg-blue-50 p-2 text-center">
            <div className="text-[10px] uppercase tracking-wide font-bold text-blue-700">Vendredi uniquement</div>
            <div className="text-2xl font-bold text-blue-900 mt-0.5">{venOnly}</div>
            <div className="text-[9px] text-blue-600">exposants</div>
          </div>
          <div className="rounded-md border border-purple-200 bg-purple-50 p-2 text-center">
            <div className="text-[10px] uppercase tracking-wide font-bold text-purple-700">Samedi uniquement</div>
            <div className="text-2xl font-bold text-purple-900 mt-0.5">{samOnly}</div>
            <div className="text-[9px] text-purple-600">exposants</div>
          </div>
          <div className="rounded-md border border-emerald-200 bg-emerald-50 p-2 text-center">
            <div className="text-[10px] uppercase tracking-wide font-bold text-emerald-700">Week-end complet</div>
            <div className="text-2xl font-bold text-emerald-900 mt-0.5">{both}</div>
            <div className="text-[9px] text-emerald-600">exposants V + S</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

'use client';

/**
 * 🆕 SESSION 48s — WAITLIST VIEW (Cockpit ARACOM)
 * Vue dédiée pour gérer la liste d'attente des exposants par site.
 *
 * Fonctionnalités :
 *  - Listing groupé par site avec compteurs (pré-réservés + waitlist)
 *  - Tri FIFO par created_at
 *  - Bouton "Promouvoir" qui propose un stand libre du site
 *  - Bouton "Retirer" (annule la demande)
 */
import { useEffect, useState, useMemo } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/auth-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Hourglass, ArrowUpCircle, X, MapPin, Users, RefreshCw, Trash2, Clock } from 'lucide-react';

export default function WaitlistView() {
  const [items, setItems] = useState([]);
  const [venues, setVenues] = useState([]);
  const [standsByVenue, setStandsByVenue] = useState({}); // { venue_id: [stand objects] }
  const [loading, setLoading] = useState(true);
  const [promoting, setPromoting] = useState(null); // { req, freeStands: [] }
  const [targetStand, setTargetStand] = useState('');
  // 🆕 SESSION 52g.5 — Filtre par jour de présence
  const [dayFilter, setDayFilter] = useState('all'); // 'all' | 'vendredi' | 'samedi' | 'both'

  const load = async () => {
    setLoading(true);
    try {
      const [vlist, all] = await Promise.all([
        api('/api/venues'),
        api('/api/validation-requests'),
      ]);
      setVenues(vlist || []);
      // Filtre uniquement les waitlist
      const wl = (all || []).filter(r => r.status === 'waitlist');
      setItems(wl);

      // Charge les stands de tous les venues concernés
      const venueIds = [...new Set(wl.map(r => r.venue_id).filter(Boolean))];
      const standsMap = {};
      await Promise.all(venueIds.map(async (vid) => {
        try {
          const stands = await api(`/api/venues/${vid}/stands`);
          standsMap[vid] = stands || [];
        } catch { /* ignore */ }
      }));
      setStandsByVenue(standsMap);
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  // Regroupement par site (avec position FIFO calculée) — filtre par jour appliqué
  const byVenue = useMemo(() => {
    const map = {};
    for (const v of venues) map[v.id] = { venue: v, items: [], freeStands: [], counts: { ven: 0, sam: 0, both: 0, unknown: 0 } };
    // 🆕 SESSION 52g.5 — Filtre par jour de présence
    const matchesDay = (r) => {
      const days = Array.isArray(r.attending_days) ? r.attending_days : [];
      if (dayFilter === 'all') return true;
      if (dayFilter === 'vendredi') return days.includes('vendredi');
      if (dayFilter === 'samedi') return days.includes('samedi');
      if (dayFilter === 'both') return days.includes('vendredi') && days.includes('samedi');
      return true;
    };
    // Sort items by created_at (FIFO)
    const sorted = [...items].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    sorted.forEach((r) => {
      const v = r.venue_id;
      if (!map[v]) return;
      const days = Array.isArray(r.attending_days) ? r.attending_days : [];
      // Comptage par jour (toujours, même si filtré)
      const isVen = days.includes('vendredi');
      const isSam = days.includes('samedi');
      if (isVen && isSam) map[v].counts.both++;
      else if (isVen) map[v].counts.ven++;
      else if (isSam) map[v].counts.sam++;
      else map[v].counts.unknown++;
      if (!matchesDay(r)) return;
      map[v].items.push({ ...r, fifo_position: map[v].items.length + 1 });
    });
    // Calcule les stands libres par venue
    for (const vid of Object.keys(standsByVenue)) {
      if (!map[vid]) continue;
      const stands = standsByVenue[vid] || [];
      map[vid].freeStands = stands.filter(s => {
        const a = s.assignment;
        const isFree = !a || (a.request_status !== 'pending' && a.request_status !== 'validated');
        return isFree && !s.organization;
      });
    }
    // Ne garde que les venues ayant au moins 1 waitlister (après filtre)
    return Object.values(map).filter(v => v.items.length > 0);
  }, [items, venues, standsByVenue, dayFilter]);

  const totalWaitlist = items.length;
  // 🆕 SESSION 52g.5 — Compteurs globaux par jour
  const globalCounts = useMemo(() => {
    const c = { ven: 0, sam: 0, both: 0, unknown: 0 };
    for (const r of items) {
      const days = Array.isArray(r.attending_days) ? r.attending_days : [];
      const isVen = days.includes('vendredi');
      const isSam = days.includes('samedi');
      if (isVen && isSam) c.both++;
      else if (isVen) c.ven++;
      else if (isSam) c.sam++;
      else c.unknown++;
    }
    return c;
  }, [items]);

  const openPromote = (req) => {
    const free = standsByVenue[req.venue_id]?.filter(s => {
      const a = s.assignment;
      const isFree = !a || (a.request_status !== 'pending' && a.request_status !== 'validated');
      return isFree && !s.organization;
    }) || [];
    setPromoting({ req, freeStands: free });
    setTargetStand(free[0]?.stand_code || '');
  };

  const doPromote = async () => {
    if (!promoting || !targetStand) return;
    try {
      await api(`/api/admin/waitlist/${promoting.req.id}/promote`, {
        method: 'POST',
        body: JSON.stringify({ stand_code: targetStand }),
      });
      toast.success(`✅ ${promoting.req.organization?.name || 'Exposant'} promu sur stand ${targetStand}`);
      setPromoting(null);
      setTargetStand('');
      await load();
    } catch (e) { toast.error(e.message); }
  };

  const doRemove = async (req) => {
    if (!window.confirm(`Retirer ${req.organization?.name || 'cet exposant'} de la liste d'attente ?`)) return;
    try {
      await api(`/api/admin/waitlist/${req.id}/remove`, { method: 'POST' });
      toast.success('Retiré de la liste d\'attente');
      await load();
    } catch (e) { toast.error(e.message); }
  };

  if (loading) return <div className="text-slate-500 py-12 text-center">Chargement…</div>;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Hourglass className="w-5 h-5 text-amber-600" />
          <h2 className="text-lg font-semibold text-slate-900">Liste d&apos;attente — par site</h2>
          <Badge variant="secondary" className="text-[10px]">{totalWaitlist} exposant{totalWaitlist > 1 ? 's' : ''} en attente</Badge>
          {/* 🆕 SESSION 52g.5 — Compteurs par jour de présence */}
          <Badge className="text-[10px] bg-blue-100 text-blue-900 border-blue-300 border">📅 Ven : {globalCounts.ven + globalCounts.both}</Badge>
          <Badge className="text-[10px] bg-purple-100 text-purple-900 border-purple-300 border">📅 Sam : {globalCounts.sam + globalCounts.both}</Badge>
          {globalCounts.both > 0 && <Badge className="text-[10px] bg-emerald-100 text-emerald-900 border-emerald-300 border">V+S : {globalCounts.both}</Badge>}
          {globalCounts.unknown > 0 && <Badge className="text-[10px] bg-slate-100 text-slate-700 border-slate-300 border" title="Inscriptions sans jour défini">? : {globalCounts.unknown}</Badge>}
        </div>
        <div className="flex items-center gap-2">
          <Select value={dayFilter} onValueChange={setDayFilter}>
            <SelectTrigger className="h-9 w-44 text-xs" data-testid="waitlist-day-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">📅 Tous les jours</SelectItem>
              <SelectItem value="vendredi">🟦 Vendredi 14/08</SelectItem>
              <SelectItem value="samedi">🟪 Samedi 15/08</SelectItem>
              <SelectItem value="both">✅ Vendredi + Samedi</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={load} className="gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" /> Actualiser
          </Button>
        </div>
      </div>

      {/* État vide */}
      {byVenue.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center">
            <div className="text-4xl mb-2">📋</div>
            <h3 className="font-bold text-slate-900">Aucun exposant en liste d&apos;attente</h3>
            <p className="text-sm text-slate-600 mt-1">Lorsqu&apos;un exposant rejoint la liste d&apos;attente d&apos;un site complet, il apparaîtra ici.</p>
          </CardContent>
        </Card>
      )}

      {/* Listing par site */}
      <div className="space-y-4">
        {byVenue.map(({ venue, items, freeStands, counts }) => (
          <Card key={venue.id} className="border-amber-200 bg-amber-50/30">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <MapPin className="w-4 h-4 text-blue-600" />
                  <CardTitle className="text-base">{venue.name}</CardTitle>
                  <Badge className="bg-amber-500 text-white text-[10px]">{items.length} en attente</Badge>
                  {/* 🆕 SESSION 52g.5 — Compteurs par jour pour ce site */}
                  <Badge className="text-[10px] bg-blue-50 text-blue-900 border-blue-200 border" title="Présents vendredi (V seul ou V+S)">📅 Ven {counts.ven + counts.both}</Badge>
                  <Badge className="text-[10px] bg-purple-50 text-purple-900 border-purple-200 border" title="Présents samedi (S seul ou V+S)">📅 Sam {counts.sam + counts.both}</Badge>
                  {freeStands.length > 0 ? (
                    <Badge className="bg-emerald-500 text-white text-[10px]">{freeStands.length} stand{freeStands.length > 1 ? 's' : ''} libre{freeStands.length > 1 ? 's' : ''}</Badge>
                  ) : (
                    <Badge className="bg-slate-200 text-slate-700 text-[10px]">Site complet</Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5">
                {items.map((r) => {
                  const canPromote = freeStands.length > 0;
                  const days = Array.isArray(r.attending_days) ? r.attending_days : [];
                  const hasVen = days.includes('vendredi');
                  const hasSam = days.includes('samedi');
                  return (
                    <div key={r.id} className="bg-white rounded-md border border-amber-200 px-3 py-2 flex items-center gap-3 flex-wrap">
                      <div className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-100 text-amber-900 text-xs font-bold shrink-0">
                        #{r.fifo_position}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-slate-900 truncate flex items-center gap-2">
                          {r.organization?.name || '—'}
                          {/* 🆕 SESSION 52g.5 — Badges de jours de présence */}
                          {hasVen && <Badge className="text-[9px] bg-blue-100 text-blue-900 border-blue-300 border h-4 px-1">Ven</Badge>}
                          {hasSam && <Badge className="text-[9px] bg-purple-100 text-purple-900 border-purple-300 border h-4 px-1">Sam</Badge>}
                          {!hasVen && !hasSam && <Badge className="text-[9px] bg-slate-100 text-slate-600 border-slate-300 border h-4 px-1" title="Jours non définis">? jours</Badge>}
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-2 flex-wrap">
                          <span className="inline-flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {r.created_at ? new Date(r.created_at).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
                          </span>
                          {r.requested_stand_code && (
                            <span>· Souhaité : <code className="font-mono">{r.requested_stand_code}</code></span>
                          )}
                          {r.organization?.discipline && (
                            <span>· {r.organization.discipline}</span>
                          )}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => openPromote(r)}
                        disabled={!canPromote}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                        title={canPromote ? 'Promouvoir vers un stand libre' : 'Aucun stand libre — site complet'}
                        data-testid={`waitlist-promote-${r.id}`}
                      >
                        <ArrowUpCircle className="w-3.5 h-3.5" /> Promouvoir
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => doRemove(r)}
                        className="gap-1.5 border-rose-200 text-rose-700 hover:bg-rose-50"
                        title="Retirer de la liste d'attente"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Retirer
                      </Button>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Dialog Promotion */}
      <Dialog open={!!promoting} onOpenChange={(open) => { if (!open) { setPromoting(null); setTargetStand(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowUpCircle className="w-5 h-5 text-emerald-600" />
              Promouvoir {promoting?.req.organization?.name || ''}
            </DialogTitle>
            <DialogDescription>
              Choisissez le stand libre à attribuer à cet exposant. La demande passera de « liste d&apos;attente » à « en attente de validation » sur le stand sélectionné.
            </DialogDescription>
          </DialogHeader>
          {promoting && promoting.freeStands.length > 0 ? (
            <div className="space-y-3">
              <div>
                <label className="text-sm font-semibold mb-1.5 block">Stand libre à attribuer</label>
                <Select value={targetStand} onValueChange={setTargetStand}>
                  <SelectTrigger><SelectValue placeholder="Choisir un stand…" /></SelectTrigger>
                  <SelectContent>
                    {promoting.freeStands.map(s => (
                      <SelectItem key={s.stand_code} value={s.stand_code}>
                        {s.stand_code}{s.label ? ` — ${s.label}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded p-2">
                ℹ️ L&apos;exposant sera notifié. Pensez à valider la demande après réception de sa caution.
              </div>
            </div>
          ) : (
            <div className="text-sm text-slate-600">Aucun stand libre disponible sur ce site.</div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPromoting(null)}>Annuler</Button>
            <Button onClick={doPromote} disabled={!targetStand} className="bg-emerald-600 hover:bg-emerald-700">
              <ArrowUpCircle className="w-4 h-4 mr-1.5" /> Promouvoir vers {targetStand || '—'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

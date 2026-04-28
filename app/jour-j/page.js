'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Shell, KpiCard } from '@/components/app-shell';
import { api, getSession } from '@/lib/auth-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { ChevronLeft, CheckCircle2, XCircle, Clock, AlertTriangle, Users, MapPin, Zap, TrendingUp, Camera, Video, MessageSquare, Sparkles, Search, ImageIcon, Trash2, FileText, ExternalLink } from 'lucide-react';
import { PRESENCE_STATUS_LABEL, PRESENCE_STATUS_COLOR, ANOMALY_TYPES, ANOMALY_TYPE_LABEL, SEVERITY_LEVELS, SEVERITY_COLOR } from '@/lib/constants';
import { FileUploadButton, MediaThumb } from '@/components/file-upload';

const EVENT_DATES = [
  { value: '2026-08-14', label: 'Ven 14/08' },
  { value: '2026-08-15', label: 'Sam 15/08' },
];

export default function JourJPage() {
  const [eventDate, setEventDate] = useState('2026-08-14');
  const [venues, setVenues] = useState([]);
  const [venueId, setVenueId] = useState('');
  const [sessions, setSessions] = useState([]);
  const [liveSites, setLiveSites] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');
  const [showLive, setShowLive] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ event_date: eventDate });
      if (venueId) qs.set('venue_id', venueId);
      const [data, live] = await Promise.all([
        api('/api/attendance?' + qs.toString()),
        api(`/api/dashboard/jour-j-live?event_date=${eventDate}`),
      ]);
      setSessions(data);
      setLiveSites(live);
    } catch (e) { toast.error(e.message); }
    setLoading(false);
  };
  useEffect(() => { api('/api/venues').then(setVenues); }, []);
  useEffect(() => { load(); }, [eventDate, venueId]);
  useEffect(() => {
    if (!autoRefresh) return;
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, [autoRefresh, eventDate, venueId]);

  const filtered = useMemo(() => {
    if (!search) return sessions;
    const s = search.toLowerCase();
    return sessions.filter(x => x.organization?.name?.toLowerCase().includes(s) || x.stand_code?.toLowerCase().includes(s));
  }, [sessions, search]);

  const kpis = useMemo(() => {
    const total = sessions.length;
    const present = sessions.filter(s => ['arrive','parti','depart_anticipe'].includes(s.presence_status)).length;
    const absent = sessions.filter(s => s.presence_status === 'absent').length;
    const late = sessions.filter(s => s.actual_arrival_time && s.expected_arrival_time && s.actual_arrival_time > s.expected_arrival_time).length;
    const gone = sessions.filter(s => ['parti','depart_anticipe'].includes(s.presence_status)).length;
    return { total, present, absent, late, gone, rate: total > 0 ? Math.round((present / total) * 100) : 0 };
  }, [sessions]);

  return (
    <Shell
      title="Mode Jour J — Terrain"
      subtitle="Contrôle des présences en temps réel. Mobile-first : ouvrez depuis votre téléphone sur le site."
      allowedRoles={['aracom_admin']}
      right={<Link href="/aracom"><Button variant="ghost" size="sm"><ChevronLeft className="w-4 h-4 mr-1" /> Retour ARACOM</Button></Link>}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2 items-center">
          {EVENT_DATES.map(d => (
            <Button key={d.value} size="sm" variant={eventDate === d.value ? 'default' : 'outline'} onClick={() => setEventDate(d.value)}>{d.label}</Button>
          ))}
          <Button size="sm" variant={autoRefresh ? 'default' : 'outline'} onClick={() => setAutoRefresh(!autoRefresh)} className="gap-1">
            <span className={`w-2 h-2 rounded-full ${autoRefresh ? 'bg-emerald-400 animate-pulse' : 'bg-slate-300'}`}></span>
            Live 20s
          </Button>
          <div className="flex-1"></div>
          <Button size="sm" variant={showLive ? 'default' : 'outline'} onClick={() => setShowLive(!showLive)}>Vue consolidée</Button>
          <Select value={venueId || 'all'} onValueChange={v => setVenueId(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="Site" /></SelectTrigger>
            <SelectContent><SelectItem value="all">Tous les sites</SelectItem>{venues.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>

        {showLive && liveSites && (
          <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700 text-white">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-xs uppercase tracking-widest text-slate-400">Vue consolidée live — {EVENT_DATES.find(d => d.value === eventDate)?.label}</div>
                  <div className="text-3xl font-bold mt-1">{liveSites.totals.rate}% <span className="text-sm font-normal text-slate-400">de présence globale</span></div>
                </div>
                <div className="grid grid-cols-4 gap-3 text-center">
                  <div><div className="text-2xl font-bold text-emerald-400">{liveSites.totals.present}</div><div className="text-[10px] uppercase text-slate-400">Présents</div></div>
                  <div><div className="text-2xl font-bold text-slate-300">{liveSites.totals.waiting}</div><div className="text-[10px] uppercase text-slate-400">Attendus</div></div>
                  <div><div className="text-2xl font-bold text-red-400">{liveSites.totals.absent}</div><div className="text-[10px] uppercase text-slate-400">Absents</div></div>
                  <div><div className="text-2xl font-bold text-orange-400">{liveSites.totals.anomalies}</div><div className="text-[10px] uppercase text-slate-400">Anomalies</div></div>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
                {liveSites.by_site.map(s => (
                  <button key={s.venue_id} onClick={() => setVenueId(s.venue_id === venueId ? '' : s.venue_id)} className={`text-left rounded-md p-3 transition ${venueId === s.venue_id ? 'bg-white text-slate-900' : 'bg-slate-800/80 text-white hover:bg-slate-700'}`}>
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-sm">{s.venue_name}</div>
                      {s.anomalies > 0 && <Badge variant="destructive" className="h-4 text-[10px] px-1">{s.anomalies}</Badge>}
                    </div>
                    <div className="flex items-end gap-1 mt-1">
                      <div className="text-xl font-bold">{s.rate}%</div>
                      <div className="text-[10px] opacity-70 mb-1">{s.present}/{s.total}</div>
                    </div>
                    <div className="h-1.5 bg-slate-700 rounded mt-2 overflow-hidden">
                      <div className="h-full bg-emerald-500" style={{ width: `${s.rate}%` }}></div>
                    </div>
                    <div className="flex gap-2 mt-1.5 text-[10px] text-slate-400">
                      <span>⏱ {s.late}</span>
                      <span>✗ {s.absent}</span>
                      <span>🏃 {s.gone}</span>
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          <KpiCard label="Attendus" value={kpis.total} accent="slate" icon={Users} />
          <KpiCard label="Présents" value={kpis.present} accent="emerald" icon={CheckCircle2} hint={`${kpis.rate}% de présence`} />
          <KpiCard label="Absents" value={kpis.absent} accent="red" icon={XCircle} />
          <KpiCard label="Retards" value={kpis.late} accent="orange" icon={Clock} />
          <KpiCard label="Déjà partis" value={kpis.gone} accent="blue" icon={TrendingUp} />
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <Input className="pl-9" placeholder="Rechercher un exposant ou un stand…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {loading && <div className="col-span-full text-center py-12 text-slate-400">Chargement…</div>}
          {!loading && filtered.length === 0 && <div className="col-span-full text-center py-12 text-slate-400">Aucun exposant à afficher.</div>}
          {filtered.map(s => (
            <ExposantCard key={s.id} s={s} onOpen={() => setSelected(s)} eventDate={eventDate} onRefresh={load} />
          ))}
        </div>
      </div>

      {selected && <FicheTerrain session={selected} eventDate={eventDate} onClose={() => { setSelected(null); load(); }} />}
    </Shell>
  );
}

function ExposantCard({ s, onOpen, eventDate, onRefresh }) {
  const quickIn = async (e) => {
    e.stopPropagation();
    try {
      await api(`/api/attendance/${s.registration_id}/check-in`, { method: 'POST', body: JSON.stringify({ event_date: eventDate }) });
      toast.success(`✅ Check-in ${s.organization?.name}`);
      onRefresh();
    } catch (err) { toast.error(err.message); }
  };
  const quickOut = async (e) => {
    e.stopPropagation();
    try {
      await api(`/api/attendance/${s.registration_id}/check-out`, { method: 'POST', body: JSON.stringify({ event_date: eventDate }) });
      toast.success(`👋 Check-out ${s.organization?.name}`);
      onRefresh();
    } catch (err) { toast.error(err.message); }
  };
  const markAbsent = async (e) => {
    e.stopPropagation();
    if (!confirm(`Marquer ${s.organization?.name} comme absent ?`)) return;
    try {
      await api(`/api/attendance/${s.registration_id}/mark-absent`, { method: 'POST', body: JSON.stringify({ event_date: eventDate }) });
      toast.success('Absence enregistrée');
      onRefresh();
    } catch (err) { toast.error(err.message); }
  };

  const statusColor = PRESENCE_STATUS_COLOR[s.presence_status] || 'bg-slate-100 text-slate-700 border-slate-200';
  const isArrived = ['arrive','parti','depart_anticipe'].includes(s.presence_status);
  const isGone = ['parti','depart_anticipe'].includes(s.presence_status);

  return (
    <Card className="hover:shadow-md transition cursor-pointer" onClick={onOpen}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-slate-900 truncate">{s.organization?.name}</div>
            <div className="text-xs text-slate-500 truncate">{s.organization?.discipline}</div>
          </div>
          <div className="text-right shrink-0">
            <div className="font-mono text-xs text-slate-700">{s.stand_code}</div>
            <div className="text-[11px] text-slate-500">{s.venue?.name}</div>
          </div>
        </div>
        <div className="flex items-center justify-between mb-3">
          <span className={`px-2 py-0.5 rounded-md border text-xs font-medium ${statusColor}`}>{PRESENCE_STATUS_LABEL[s.presence_status]}</span>
          <div className="text-[11px] text-slate-500">Prévu : {s.expected_arrival_time} → {s.expected_departure_time}</div>
        </div>
        {(s.actual_arrival_time || s.actual_departure_time) && (
          <div className="flex items-center gap-2 text-xs text-slate-600 mb-3">
            {s.actual_arrival_time && <Badge variant="secondary" className="bg-emerald-50 text-emerald-700">→ {s.actual_arrival_time}</Badge>}
            {s.actual_departure_time && <Badge variant="secondary" className="bg-blue-50 text-blue-700">← {s.actual_departure_time}</Badge>}
          </div>
        )}
        <div className="grid grid-cols-3 gap-1.5">
          {!isArrived && <Button size="sm" onClick={quickIn} className="bg-emerald-600 hover:bg-emerald-700 h-9"><CheckCircle2 className="w-4 h-4 mr-1" /> Check-in</Button>}
          {isArrived && !isGone && <Button size="sm" onClick={quickOut} className="bg-blue-600 hover:bg-blue-700 h-9">Check-out</Button>}
          {isGone && <Button size="sm" variant="secondary" disabled className="h-9">Parti</Button>}
          {s.presence_status === 'attendu' && <Button size="sm" variant="outline" onClick={markAbsent} className="h-9 text-red-600 border-red-200"><XCircle className="w-4 h-4 mr-1" /> Absent</Button>}
          <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); onOpen(); }} className="h-9"><Zap className="w-4 h-4 mr-1" /> Détails</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function FicheTerrain({ session, eventDate, onClose }) {
  const [fiche, setFiche] = useState(null);
  const load = () => api(`/api/registrations/${session.registration_id}`).then(setFiche);
  useEffect(() => { load(); }, [session.registration_id]);

  const [comment, setComment] = useState('');
  const [commentType, setCommentType] = useState('observation');
  const addComment = async () => {
    if (!comment.trim()) return;
    try {
      await api('/api/field-comments', { method: 'POST', body: JSON.stringify({ registration_id: session.registration_id, attendance_session_id: session.id, comment_type: commentType, comment_text: comment }) });
      toast.success('Commentaire ajouté');
      setComment(''); load();
    } catch (e) { toast.error(e.message); }
  };

  const [anomalyType, setAnomalyType] = useState('stand_non_conforme');
  const [severity, setSeverity] = useState('moyenne');
  const [anomalyTitle, setAnomalyTitle] = useState('');
  const [anomalyDesc, setAnomalyDesc] = useState('');
  const [impactCaution, setImpactCaution] = useState('aucun_impact');
  const submitAnomaly = async () => {
    if (!anomalyTitle.trim()) return toast.error('Titre requis');
    try {
      await api('/api/anomalies', { method: 'POST', body: JSON.stringify({ registration_id: session.registration_id, attendance_session_id: session.id, venue_id: session.venue_id, event_date: eventDate, anomaly_type: anomalyType, severity_level: severity, title: anomalyTitle, description: anomalyDesc, requires_deposit_review: impactCaution !== 'aucun_impact', recommended_deposit_action: impactCaution }) });
      toast.success('Anomalie signalée');
      setAnomalyTitle(''); setAnomalyDesc(''); load();
    } catch (e) { toast.error(e.message); }
  };

  const checkIn = async () => {
    await api(`/api/attendance/${session.registration_id}/check-in`, { method: 'POST', body: JSON.stringify({ event_date: eventDate, comment }) });
    toast.success('Check-in enregistré'); setComment(''); load();
  };
  const checkOut = async (cond) => {
    await api(`/api/attendance/${session.registration_id}/check-out`, { method: 'POST', body: JSON.stringify({ event_date: eventDate, comment, stand_condition: cond }) });
    toast.success('Check-out enregistré'); setComment(''); load();
  };
  const markAbsent = async () => {
    await api(`/api/attendance/${session.registration_id}/mark-absent`, { method: 'POST', body: JSON.stringify({ event_date: eventDate, comment }) });
    toast.success('Absence enregistrée'); load();
  };

  const generateBilan = async () => {
    await api('/api/reports/generate', { method: 'POST', body: JSON.stringify({ scope: 'bilan_exposant', registration_id: session.registration_id }) });
    toast.success('Brouillon de bilan généré');
  };

  return (
    <Sheet open={true} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{session.organization?.name}</SheetTitle>
          <p className="text-sm text-slate-500">{session.organization?.discipline} • <span className="font-mono">{session.stand_code}</span> • {session.venue?.name}</p>
        </SheetHeader>
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-3 gap-2">
            <KpiCard label="Statut" value={PRESENCE_STATUS_LABEL[session.presence_status]} accent={session.presence_status === 'absent' ? 'red' : session.presence_status === 'arrive' ? 'emerald' : 'slate'} />
            <KpiCard label="Arrivée" value={session.actual_arrival_time || '—'} hint={`prévue ${session.expected_arrival_time}`} accent="blue" />
            <KpiCard label="Départ" value={session.actual_departure_time || '—'} hint={`prévu ${session.expected_departure_time}`} accent="violet" />
          </div>

          <Tabs defaultValue="checkin">
            <TabsList className="w-full grid grid-cols-5">
              <TabsTrigger value="checkin">Check</TabsTrigger>
              <TabsTrigger value="comment">Commentaire</TabsTrigger>
              <TabsTrigger value="anomaly">Anomalie</TabsTrigger>
              <TabsTrigger value="photos">Photos</TabsTrigger>
              <TabsTrigger value="history">Historique</TabsTrigger>
            </TabsList>

            <TabsContent value="checkin" className="space-y-3">
              <div className="space-y-2">
                <Label>Commentaire (optionnel)</Label>
                <Textarea rows={2} value={comment} onChange={e => setComment(e.target.value)} placeholder="Ex : arrivee en retard — panne de véhicule" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button onClick={checkIn} className="bg-emerald-600 hover:bg-emerald-700 h-12 gap-2"><CheckCircle2 className="w-5 h-5" /> Check-in</Button>
                <Button onClick={() => checkOut('conforme')} className="bg-blue-600 hover:bg-blue-700 h-12">Check-out OK</Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button onClick={() => checkOut('a_signaler')} variant="outline" className="h-12 text-orange-600 border-orange-200">Check-out à signaler</Button>
                <Button onClick={markAbsent} variant="outline" className="h-12 text-red-600 border-red-200"><XCircle className="w-5 h-5 mr-1" /> Marquer absent</Button>
              </div>
            </TabsContent>

            <TabsContent value="comment" className="space-y-3">
              <Select value={commentType} onValueChange={setCommentType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[{v:'observation',l:'Observation'},{v:'commentaire_arrivee',l:'Commentaire arrivée'},{v:'commentaire_depart',l:'Commentaire départ'},{v:'commentaire_incident',l:'Commentaire incident'},{v:'recommendation_post_event',l:'Recommandation post-événement'},{v:'commentaire_superviseur',l:'Commentaire superviseur'}].map(o => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}
                </SelectContent>
              </Select>
              <Textarea rows={4} value={comment} onChange={e => setComment(e.target.value)} placeholder="Votre commentaire…" />
              <Button onClick={addComment} className="gap-2"><MessageSquare className="w-4 h-4" /> Ajouter le commentaire</Button>
            </TabsContent>

            <TabsContent value="anomaly" className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Type</Label>
                  <Select value={anomalyType} onValueChange={setAnomalyType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{ANOMALY_TYPES.map(t => <SelectItem key={t} value={t}>{ANOMALY_TYPE_LABEL[t]}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Gravité</Label>
                  <Select value={severity} onValueChange={setSeverity}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{SEVERITY_LEVELS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <Input placeholder="Titre de l'anomalie" value={anomalyTitle} onChange={e => setAnomalyTitle(e.target.value)} />
              <Textarea rows={3} placeholder="Description détaillée…" value={anomalyDesc} onChange={e => setAnomalyDesc(e.target.value)} />
              <div>
                <Label>Impact sur caution</Label>
                <Select value={impactCaution} onValueChange={setImpactCaution}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[{v:'aucun_impact',l:'Aucun impact'},{v:'verification_manuelle',l:'Vérification manuelle'},{v:'retenue_partielle',l:'Retenue partielle'},{v:'retenue_totale',l:'Retenue totale'}].map(o => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={submitAnomaly} className="bg-red-600 hover:bg-red-700 gap-2"><AlertTriangle className="w-4 h-4" /> Signaler l’anomalie</Button>
            </TabsContent>

            <TabsContent value="photos" className="space-y-3">
              <PhotoUploader registrationId={session.registration_id} attendanceSessionId={session.id} media={fiche?.media || []} onRefresh={() => load()} />
            </TabsContent>

            <TabsContent value="history" className="space-y-3">
              {fiche?.anomalies?.length > 0 && <div>
                <div className="font-medium text-sm mb-2">Anomalies</div>
                {fiche.anomalies.map(a => (
                  <div key={a.id} className="border rounded-md p-2 mb-2 bg-red-50/40">
                    <div className="flex items-center justify-between"><div className="font-medium text-sm">{a.title}</div><Badge variant="destructive">{a.severity_level}</Badge></div>
                    <div className="text-xs text-slate-600 mt-1">{a.description}</div>
                  </div>
                ))}
              </div>}
              {fiche?.comments?.length > 0 && <div>
                <div className="font-medium text-sm mb-2">Commentaires</div>
                {fiche.comments.map(c => (
                  <div key={c.id} className="border rounded-md p-2 mb-2 bg-slate-50"><div className="text-[11px] text-slate-500 uppercase">{c.comment_type}</div><div className="text-sm">{c.comment_text}</div></div>
                ))}
              </div>}
              <Button onClick={generateBilan} variant="outline" className="w-full gap-2"><Sparkles className="w-4 h-4" /> Générer brouillon bilan exposant</Button>
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}


const MEDIA_TYPES = [
  { key: 'photo_arrivee', label: '📍 Stand à l\'arrivée', color: 'bg-emerald-50 border-emerald-200', accept: 'image/*', icon: Camera },
  { key: 'photo_depart', label: '🚪 Stand au départ', color: 'bg-blue-50 border-blue-200', accept: 'image/*', icon: Camera },
  { key: 'photo_animation', label: '🎭 Photo animation (preuve)', color: 'bg-violet-50 border-violet-200', accept: 'image/*', icon: Camera },
  { key: 'video_animation', label: '🎬 Vidéo animation (preuve)', color: 'bg-fuchsia-50 border-fuchsia-200', accept: 'video/*', icon: Video },
  { key: 'photo_ambiance', label: '✨ Photo d\'ambiance', color: 'bg-amber-50 border-amber-200', accept: 'image/*', icon: Camera },
  { key: 'preuve_incident', label: '⚠️ Preuve incident', color: 'bg-red-50 border-red-200', accept: 'image/*,video/*', icon: AlertTriangle },
  { key: 'document_terrain', label: '📄 Document terrain', color: 'bg-slate-50 border-slate-200', accept: 'image/*,application/pdf', icon: FileText },
];

function PhotoUploader({ registrationId, attendanceSessionId, media = [], onRefresh }) {
  const upload = async (type, payload) => {
    try {
      await api('/api/field-media', { method: 'POST', body: JSON.stringify({ registration_id: registrationId, attendance_session_id: attendanceSessionId, media_type: type, ...payload }) });
      toast.success('✅ Média ajouté — uploadé sur Drive'); onRefresh();
    } catch (e) { toast.error(e.message); }
  };
  const del = async (id) => {
    if (!confirm('Supprimer ce média ?')) return;
    await api(`/api/field-media/${id}`, { method: 'DELETE' }); toast.success('Supprimé'); onRefresh();
  };
  const isVideo = (m) => (m.mime_type || '').startsWith('video/');
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {MEDIA_TYPES.map(t => (
          <FileUploadButton key={t.key} capture={t.accept?.startsWith('image/') || t.accept?.startsWith('video/')} accept={t.accept} icon={t.icon} onUpload={(p) => upload(t.key, p)} label={t.label} className="h-auto py-3 text-[11px] whitespace-normal" />
        ))}
      </div>
      {media.length === 0 ? <p className="text-slate-500 text-sm py-3">Aucun média pour cet exposant.</p> : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {media.map(m => {
            const cfg = MEDIA_TYPES.find(x => x.key === m.media_type);
            return (
              <div key={m.id} className={`relative group rounded-md border overflow-hidden ${cfg?.color || 'bg-slate-50'}`}>
                {isVideo(m) ? (
                  <video src={`/api/field-media/${m.id}/view`} controls className="w-full h-28 object-cover bg-black" />
                ) : (
                  <img src={`/api/field-media/${m.id}/view`} alt={m.file_name} className="w-full h-28 object-cover" />
                )}
                <div className="absolute bottom-0 inset-x-0 bg-black/70 text-white text-[10px] px-1.5 py-1 truncate">{cfg?.label || m.media_type}</div>
                {m.drive_view_link && (
                  <a href={m.drive_view_link} target="_blank" rel="noreferrer" className="absolute top-1 left-1 bg-white/90 hover:bg-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition" title="Ouvrir dans Drive"><ExternalLink className="w-3 h-3 text-blue-600" /></a>
                )}
                <button onClick={() => del(m.id)} className="absolute top-1 right-1 bg-white/90 hover:bg-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition"><Trash2 className="w-3 h-3 text-red-600" /></button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shell, KpiCard } from '@/components/app-shell';
import { api, getSession, saveSession, clearSession } from '@/lib/auth-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { FileUploadButton } from '@/components/file-upload';
import VenueMap from '@/components/venue-map';
import { toast } from 'sonner';
import { Building2, MapPin, Calendar, FileCheck2, Wallet, CheckCircle2, XCircle, Info, Mail, Phone, Clock, FileText, Trash2, Download, Star, Sparkles, BookOpen, KeyRound, Plus, LayoutGrid, ChevronLeft, ListChecks, MessageCircle } from 'lucide-react';
import { REGISTRATION_STATUS_LABEL, REGISTRATION_STATUS_COLOR, DEPOSIT_STATUS_LABEL, DEPOSIT_AMOUNT_XPF, DOCUMENT_TYPE_LABEL, EVENT_DATES } from '@/lib/constants';

const DOC_TYPES = [
  { key: 'assurance', label: 'Attestation d’assurance', icon: FileCheck2 },
  { key: 'recu_caution', label: 'Reçu de caution', icon: Wallet },
  { key: 'convention', label: 'Convention signée', icon: FileText },
  { key: 'autre', label: 'Autre document', icon: FileText },
];

const SLOT_TYPES = [
  { value: 'stand', label: 'Sur mon stand', color: 'bg-blue-50 text-blue-700' },
  { value: 'zone_animation', label: 'Zone d’animation centrale', color: 'bg-violet-50 text-violet-700' },
  { value: 'spectacle', label: 'Spectacle / Démonstration', color: 'bg-orange-50 text-orange-700' },
];

export default function ExposantPortal() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  const load = async () => {
    try {
      const me = await api('/api/auth/me');
      setUser(me.user);
      if (!me.organization) { toast.error('Aucune organisation liée'); setLoading(false); return; }
      const regs = await api('/api/registrations');
      const mine = regs.find(r => r.organization_id === me.organization.id);
      if (!mine) { setData({ me, registration: null }); setLoading(false); return; }
      const full = await api(`/api/registrations/${mine.id}`);
      setData({ me, ...full });
    } catch (e) { toast.error(e.message); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  if (loading) return <Shell title="Mon dossier exposant" allowedRoles={['exposant']}><div className="py-20 text-center text-slate-500">Chargement…</div></Shell>;
  if (!data?.registration) {
    return <Shell title="Mon dossier exposant" allowedRoles={['exposant']}><Card><CardContent className="py-12 text-center">
      <Info className="w-12 h-12 mx-auto text-slate-400" />
      <p className="mt-3 font-medium">Votre dossier n’a pas encore été initialisé</p>
      <p className="text-slate-500 text-sm">L’équipe ARACOM va bientôt vous contacter.</p>
    </CardContent></Card></Shell>;
  }

  const r = data.registration, o = data.organization, v = data.venue, d = data.deposit;
  const docs = data.documents || [];
  const checks = [
    { ok: r.is_convention_signed, label: 'Convention signée' },
    { ok: d?.status === 'recue', label: 'Caution reçue' },
    { ok: r.is_insurance_uploaded, label: 'Assurance déposée' },
    { ok: docs.some(dd => dd.document_type === 'recu_caution'), label: 'Reçu de caution' },
    { ok: data.slots?.length > 0, label: 'Créneaux d’animation choisis' },
  ];
  const completion = Math.round((checks.filter(c => c.ok).length / checks.length) * 100);

  return (
    <Shell
      title={`Dossier — ${o?.name || 'Mon exposant'}`}
      subtitle="Votre espace personnel pour le Forum de la Rentrée 2026."
      allowedRoles={['exposant']}
      right={<PasswordButton user={user} onChanged={load} />}
    >
      <div className="space-y-6">
        <Card className="bg-gradient-to-br from-blue-50 to-emerald-50 border-blue-100">
          <CardContent className="p-6 flex flex-col md:flex-row md:items-center gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2"><Building2 className="w-5 h-5 text-blue-600" /><h2 className="text-2xl font-bold">{o?.name}</h2></div>
              <p className="text-slate-600 mt-1">{o?.discipline}</p>
              <div className="flex flex-wrap gap-2 mt-3">
                {v?.name && <Badge variant="secondary"><MapPin className="w-3 h-3 mr-1" /> {v.name}</Badge>}
                {r.stand_code && <Badge variant="secondary" className="font-mono">Stand {r.stand_code}</Badge>}
                <Badge className={REGISTRATION_STATUS_COLOR[r.status]}>{REGISTRATION_STATUS_LABEL[r.status]}</Badge>
              </div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-blue-700">{completion}%</div>
              <div className="text-xs text-slate-500 uppercase tracking-wider">Dossier complet</div>
              <Progress value={completion} className="h-2 w-32 mt-2" />
            </div>
          </CardContent>
        </Card>

        {r.status !== 'confirme' && <ConfirmParticipation registration={r} onRefresh={load} />}

        <Tabs defaultValue="profil">
          <TabsList className="w-full grid grid-cols-3 md:grid-cols-6">
            <TabsTrigger value="profil">Profil</TabsTrigger>
            <TabsTrigger value="sites">Sites & plan</TabsTrigger>
            <TabsTrigger value="animation">Animations</TabsTrigger>
            <TabsTrigger value="docs">Documents</TabsTrigger>
            <TabsTrigger value="logistique">Logistique</TabsTrigger>
            <TabsTrigger value="guide">Guide</TabsTrigger>
          </TabsList>

          <TabsContent value="profil" className="space-y-4">
            <ProfilBlock organization={o} registration={r} onRefresh={load} />
            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><FileCheck2 className="w-4 h-4 text-emerald-600" /> Chéminement de mon dossier</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {checks.map((c, i) => (
                    <div key={i} className="flex items-center justify-between border rounded-md p-3">
                      <div className="flex items-center gap-2">
                        {c.ok ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <XCircle className="w-4 h-4 text-slate-300" />}
                        <span className={c.ok ? 'text-slate-900 font-medium' : 'text-slate-600'}>{c.label}</span>
                      </div>
                      {!c.ok && <Badge variant="secondary" className="text-xs">À faire</Badge>}
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><Wallet className="w-4 h-4 text-blue-600" /> Caution (20 000 XPF)</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  <div className="rounded-md bg-blue-50 border border-blue-100 p-4">
                    <div className="text-sm text-slate-600">Statut actuel</div>
                    <div className="text-2xl font-bold text-blue-700">{DEPOSIT_STATUS_LABEL[d?.status] || '—'}</div>
                    {d?.received_at && <div className="text-xs text-slate-500 mt-1">Reçue le {new Date(d.received_at).toLocaleDateString('fr-FR')}</div>}
                  </div>
                  <div className="text-xs text-slate-500 bg-amber-50 border border-amber-100 rounded-md p-3">
                    <strong>Rappel :</strong> chèque, virement ou espèces acceptés. Restituée après l’événement si tout s’est bien passé.
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="sites" className="space-y-4">
            <PreferencesBlock organizationId={o.id} onRefresh={load} />
            <StandMapBlock venueId={r.venue_id} currentStandCode={r.stand_code} />
          </TabsContent>

          <TabsContent value="animation" className="space-y-4">
            <AnimationsBlock registrationId={r.id} venueId={r.venue_id} slots={data.slots} onRefresh={load} />
          </TabsContent>

          <TabsContent value="docs" className="space-y-4">
            <DocsBlockExposant registrationId={r.id} docs={docs} onRefresh={load} />
          </TabsContent>

          <TabsContent value="logistique" className="space-y-4">
            <LogistiqueBlock registration={r} onRefresh={load} />
          </TabsContent>

          <TabsContent value="guide" className="space-y-4">
            <GuideBlock />
          </TabsContent>
        </Tabs>
      </div>
    </Shell>
  );
}

function ConfirmParticipation({ registration, onRefresh }) {
  const confirmNow = async () => {
    try {
      await api(`/api/registrations/${registration.id}/confirm`, { method: 'POST', body: JSON.stringify({}) });
      toast.success('Participation confirmée ! Un email a été envoyé.');
      onRefresh();
    } catch (e) { toast.error(e.message); }
  };
  return (
    <Card className="border-emerald-200 bg-emerald-50/40">
      <CardContent className="p-5 flex flex-col md:flex-row md:items-center gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 font-semibold text-emerald-900"><Sparkles className="w-4 h-4" /> Confirmez votre participation</div>
          <p className="text-sm text-emerald-800 mt-1">Valider votre inscription au Forum de la Rentrée 2026 (14 & 15 août).</p>
        </div>
        <Button onClick={confirmNow} className="bg-emerald-600 hover:bg-emerald-700 gap-2"><CheckCircle2 className="w-4 h-4" /> Je confirme</Button>
      </CardContent>
    </Card>
  );
}

function ProfilBlock({ organization, registration, onRefresh }) {
  const [form, setForm] = useState({
    name: organization.name, discipline: organization.discipline,
    main_email: organization.main_email, main_phone: organization.main_phone,
    contact_name: organization.contact_name,
    friday: !!registration.friday_slot_label, saturday: !!registration.saturday_slot_label,
    planned_arrival_time: registration.planned_arrival_time || '10:30',
    planned_departure_time: registration.planned_departure_time || '17:00',
  });
  const save = async () => {
    try {
      await api(`/api/registrations/${registration.id}`, { method: 'PUT', body: JSON.stringify({
        friday_slot_label: form.friday ? 'Oui' : null,
        saturday_slot_label: form.saturday ? 'Oui' : null,
        planned_arrival_time: form.planned_arrival_time,
        planned_departure_time: form.planned_departure_time,
      }) });
      toast.success('Profil mis à jour');
      onRefresh();
    } catch (e) { toast.error(e.message); }
  };
  return (
    <Card>
      <CardHeader><CardTitle className="text-base flex items-center gap-2"><Building2 className="w-4 h-4 text-blue-600" /> Mon profil & ma participation</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="grid md:grid-cols-2 gap-3">
          <div><Label>Nom de la structure</Label><Input value={form.name} disabled /></div>
          <div><Label>Discipline</Label><Input value={form.discipline} disabled /></div>
          <div><Label>Email principal</Label><Input value={form.main_email || ''} disabled /></div>
          <div><Label>Téléphone</Label><Input value={form.main_phone || ''} disabled /></div>
          <div className="md:col-span-2"><Label>Contact principal</Label><Input value={form.contact_name || ''} disabled /></div>
        </div>
        <div className="text-xs text-slate-500">Pour modifier les infos de base, contactez ARACOM.</div>

        <div className="pt-3 border-t">
          <div className="font-medium text-sm mb-2 flex items-center gap-2"><Calendar className="w-4 h-4 text-blue-600" /> Jours de participation</div>
          <div className="grid grid-cols-2 gap-3">
            {EVENT_DATES.map(d => {
              const key = d.label === 'vendredi' ? 'friday' : 'saturday';
              return (
                <button key={d.label} onClick={() => setForm({ ...form, [key]: !form[key] })} className={`border rounded-md p-3 text-left transition ${form[key] ? 'bg-emerald-50 border-emerald-300' : 'bg-white hover:border-slate-400'}`}>
                  <div className="flex items-center justify-between"><div className="font-semibold">{d.display}</div>{form[key] && <CheckCircle2 className="w-5 h-5 text-emerald-600" />}</div>
                  <div className="text-xs text-slate-500 mt-1">{form[key] ? 'Vous serez présent' : 'Cliquez pour confirmer'}</div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div><Label>Heure d’arrivée prévue</Label><Input type="time" value={form.planned_arrival_time} onChange={e => setForm({ ...form, planned_arrival_time: e.target.value })} /></div>
          <div><Label>Heure de départ prévue</Label><Input type="time" value={form.planned_departure_time} onChange={e => setForm({ ...form, planned_departure_time: e.target.value })} /></div>
        </div>
        <Button onClick={save} className="gap-2"><CheckCircle2 className="w-4 h-4" /> Enregistrer</Button>
      </CardContent>
    </Card>
  );
}

function PreferencesBlock({ organizationId, onRefresh }) {
  const [venues, setVenues] = useState([]);
  const [prefs, setPrefs] = useState([]);
  const [selected, setSelected] = useState('');
  const load = async () => {
    const [v, p] = await Promise.all([api('/api/venues'), api(`/api/organization-preferences?organization_id=${organizationId}`)]);
    setVenues(v); setPrefs(p);
  };
  useEffect(() => { load(); }, [organizationId]);
  const addPref = async () => {
    if (!selected || prefs.some(p => p.venue_id === selected)) return;
    await api('/api/organization-preferences', { method: 'POST', body: JSON.stringify({ organization_id: organizationId, venue_id: selected, preference_rank: prefs.length + 1 }) });
    toast.success('Site ajouté à vos préférences');
    setSelected(''); load(); if (onRefresh) onRefresh();
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><Star className="w-4 h-4 text-amber-500" /> Mes sites préférés</CardTitle>
        <p className="text-xs text-slate-500 mt-1">Classez par ordre de préférence. ARACOM en tiendra compte pour l’affectation.</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {prefs.length === 0 ? <p className="text-sm text-slate-500">Aucune préférence exprimée.</p> : (
          <div className="space-y-1.5">
            {prefs.map((p, i) => (
              <div key={p.id} className="flex items-center gap-3 border rounded-md p-3">
                <div className="w-7 h-7 rounded-full bg-amber-100 text-amber-800 text-xs font-bold flex items-center justify-center">{i + 1}</div>
                <div className="flex-1">
                  <div className="font-medium">{p.venue?.name}</div>
                  <div className="text-xs text-slate-500">{p.source === 'self_service' ? 'Votre choix' : 'Pré-enregistré'}</div>
                </div>
                <Badge variant="secondary">Rang {p.preference_rank}</Badge>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger className="flex-1"><SelectValue placeholder="Ajouter un site préféré…" /></SelectTrigger>
            <SelectContent>{venues.filter(v => !prefs.some(p => p.venue_id === v.id)).map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent>
          </Select>
          <Button onClick={addPref} disabled={!selected}><Plus className="w-4 h-4 mr-1" /> Ajouter</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function StandMapBlock({ venueId, currentStandCode }) {
  const [venues, setVenues] = useState([]);
  const [selectedVenueId, setSelectedVenueId] = useState(venueId);
  const [stands, setStands] = useState([]);
  useEffect(() => { api('/api/venues').then(v => { setVenues(v); if (!selectedVenueId && v[0]) setSelectedVenueId(v[0].id); }); }, []);
  useEffect(() => { if (selectedVenueId) api(`/api/venues/${selectedVenueId}/stands`).then(setStands); }, [selectedVenueId]);
  const selectedVenue = venues.find(v => v.id === selectedVenueId);
  const occupied = stands.filter(s => s.organization).length;
  const free = stands.length - occupied;
  const isOwnVenue = selectedVenueId === venueId;
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base flex items-center gap-2"><LayoutGrid className="w-4 h-4 text-blue-600" /> Plan interactif des stands</CardTitle>
          <Select value={selectedVenueId} onValueChange={setSelectedVenueId}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>{venues.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <p className="text-xs text-slate-500 mt-1">{selectedVenue?.name} — {stands.length} stands • {occupied} attribués • {free} libres</p>
        {currentStandCode && isOwnVenue && (
          <div className="mt-2 inline-flex items-center gap-2 text-xs bg-blue-50 border border-blue-200 rounded-md px-3 py-1.5">
            <MapPin className="w-3.5 h-3.5 text-blue-600" />
            <span>Votre stand : <span className="font-mono font-bold text-blue-700">{currentStandCode}</span></span>
          </div>
        )}
      </CardHeader>
      <CardContent>
        <VenueMap
          stands={stands}
          venue={selectedVenue}
          highlightStandCode={isOwnVenue ? currentStandCode : null}
        />
      </CardContent>
    </Card>
  );
}

function AnimationsBlock({ registrationId, venueId, slots = [], onRefresh }) {
  const [planning, setPlanning] = useState([]);
  useEffect(() => { if (venueId) api(`/api/animation-slots?venue_id=${venueId}`).then(setPlanning); }, [venueId, slots.length]);
  const byDay = (day) => planning.filter(s => s.day_label === day).sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));
  return (
    <div className="space-y-4">
      <NewAnimationForm registrationId={registrationId} venueId={venueId} onDone={onRefresh} />
      <div className="grid md:grid-cols-2 gap-4">
        {EVENT_DATES.map(d => (
          <Card key={d.label}>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Calendar className="w-4 h-4 text-blue-600" /> {d.display}</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {byDay(d.label).length === 0 ? <p className="text-sm text-slate-400">Aucun créneau planifié sur ce site.</p> : byDay(d.label).map(s => {
                const isMine = s.registration_id === registrationId;
                return (
                  <div key={s.id} className={`border rounded-md p-3 flex items-center justify-between gap-2 ${isMine ? 'bg-blue-50 border-blue-200' : 'bg-slate-50'}`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-bold">{s.start_time}–{s.end_time}</span>
                        <Badge className={`${SLOT_TYPES.find(t => t.value === s.location_type)?.color || 'bg-slate-100'} text-[10px]`}>{SLOT_TYPES.find(t => t.value === s.location_type)?.label || s.slot_type}</Badge>
                        {isMine && <Badge className="bg-blue-600 text-[10px]">Vous</Badge>}
                      </div>
                      <div className="text-sm font-medium truncate mt-1">{s.title}</div>
                      <div className="text-xs text-slate-500 truncate">{s.organization_name}</div>
                      {s.description && <div className="text-xs text-slate-600 mt-1">{s.description}</div>}
                    </div>
                    {isMine && <Button size="sm" variant="ghost" onClick={async () => { if (!confirm('Supprimer ?')) return; await api(`/api/animation-slots/${s.id}`, { method: 'DELETE' }); toast.success('Supprimé'); onRefresh(); }}><Trash2 className="w-3.5 h-3.5 text-red-600" /></Button>}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function NewAnimationForm({ registrationId, venueId, onDone }) {
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ day_label: 'vendredi', start_time: '11:00', end_time: '12:00', duration_minutes: 60, title: '', description: '', location_type: 'stand' });
  const save = async () => {
    if (!form.title.trim()) { toast.error('Titre requis'); return; }
    try {
      await api('/api/animation-slots', { method: 'POST', body: JSON.stringify({ registration_id: registrationId, venue_id: venueId, ...form, slot_type: form.location_type }) });
      toast.success('Créneau ajouté !');
      setShow(false);
      setForm({ day_label: 'vendredi', start_time: '11:00', end_time: '12:00', duration_minutes: 60, title: '', description: '', location_type: 'stand' });
      onDone();
    } catch (e) { toast.error(e.message); }
  };
  if (!show) return <Button onClick={() => setShow(true)} className="bg-blue-600 hover:bg-blue-700 gap-2"><Plus className="w-4 h-4" /> Proposer un créneau d’animation</Button>;
  return (
    <Card className="border-blue-200 bg-blue-50/30">
      <CardHeader><CardTitle className="text-base">Nouveau créneau d’animation</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <Label>Jour</Label>
            <Select value={form.day_label} onValueChange={v => setForm({ ...form, day_label: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{EVENT_DATES.map(d => <SelectItem key={d.label} value={d.label}>{d.display}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Lieu</Label>
            <Select value={form.location_type} onValueChange={v => setForm({ ...form, location_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{SLOT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Heure début</Label><Input type="time" value={form.start_time} onChange={e => setForm({ ...form, start_time: e.target.value })} /></div>
          <div><Label>Heure fin</Label><Input type="time" value={form.end_time} onChange={e => setForm({ ...form, end_time: e.target.value })} /></div>
          <div><Label>Durée (min)</Label><Input type="number" value={form.duration_minutes} onChange={e => setForm({ ...form, duration_minutes: parseInt(e.target.value) || 0 })} /></div>
          <div><Label>Titre de l’animation</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Démo judo, concert, atelier..." /></div>
        </div>
        <div><Label>Description — de quoi s’agit-il ?</Label><Textarea rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Décrivez votre animation (besoins matériels, public ciblé, nombre de personnes...)" /></div>
        <div className="flex gap-2">
          <Button onClick={save} className="bg-emerald-600 hover:bg-emerald-700 gap-2"><CheckCircle2 className="w-4 h-4" /> Enregistrer</Button>
          <Button variant="ghost" onClick={() => setShow(false)}>Annuler</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function DocsBlockExposant({ registrationId, docs, onRefresh }) {
  const uploadDoc = async (type, payload) => {
    try {
      await api('/api/documents', { method: 'POST', body: JSON.stringify({ registration_id: registrationId, document_type: type, ...payload }) });
      toast.success('Document déposé');
      onRefresh();
    } catch (e) { toast.error(e.message); }
  };
  const deleteDoc = async (id) => {
    if (!confirm('Supprimer ce document ?')) return;
    await api(`/api/documents/${id}`, { method: 'DELETE' });
    toast.success('Document supprimé'); onRefresh();
  };
  const docsByType = DOC_TYPES.map(dt => ({ ...dt, items: docs.filter(d => d.document_type === dt.key) }));
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><FileText className="w-4 h-4 text-blue-600" /> Mes documents</CardTitle>
        <p className="text-xs text-slate-500 mt-1">Déposez vos pièces (PDF ou photo, max 6 Mo chacun). L’équipe ARACOM les validera.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {docsByType.map(dt => (
          <div key={dt.key} className="border rounded-md p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2"><dt.icon className="w-4 h-4 text-slate-500" /><div className="font-medium">{dt.label}</div></div>
              <FileUploadButton onUpload={(p) => uploadDoc(dt.key, p)} label="Déposer" />
            </div>
            {dt.items.length === 0 ? <div className="text-xs text-slate-400">Aucun fichier</div> : (
              <div className="space-y-1">
                {dt.items.map(d => (
                  <div key={d.id} className="flex items-center justify-between text-sm py-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{d.file_name}</span>
                      <Badge variant={d.status === 'valide' ? 'default' : 'secondary'} className={`text-[10px] ${d.status === 'valide' ? 'bg-emerald-600' : ''}`}>{d.status}</Badge>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <a href={`/api/documents/${d.id}/download`} target="_blank" rel="noreferrer"><Button size="sm" variant="ghost"><Download className="w-3 h-3" /></Button></a>
                      <Button size="sm" variant="ghost" onClick={() => deleteDoc(d.id)}><Trash2 className="w-3 h-3 text-red-600" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function LogistiqueBlock({ registration, onRefresh }) {
  const [value, setValue] = useState(registration.exposant_notes || '');
  const save = async () => {
    try {
      await api(`/api/registrations/${registration.id}`, { method: 'PUT', body: JSON.stringify({ exposant_notes: value }) });
      toast.success('Complément enregistré');
      onRefresh();
    } catch (e) { toast.error(e.message); }
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><MessageCircle className="w-4 h-4 text-violet-600" /> Complément d’information & logistique</CardTitle>
        <p className="text-xs text-slate-500 mt-1">Toute information utile pour ARACOM (besoins matériel, contraintes, demandes particulières...)</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea rows={8} value={value} onChange={e => setValue(e.target.value)} placeholder="Ex : nous avons besoin d’une prise électrique, de 2 tables, d’un espace enfant sur notre stand, etc." />
        <Button onClick={save} className="gap-2"><CheckCircle2 className="w-4 h-4" /> Enregistrer</Button>
      </CardContent>
    </Card>
  );
}

function GuideBlock() {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base flex items-center gap-2"><BookOpen className="w-4 h-4 text-emerald-600" /> Guide de l’exposant</CardTitle></CardHeader>
      <CardContent className="space-y-5 prose prose-sm max-w-none">
        <section>
          <h3 className="font-semibold text-base">Bienvenue au Forum de la Rentrée 2026</h3>
          <p className="text-slate-700">Le Forum de la Rentrée 2026 se tiendra les <strong>vendredi 14 et samedi 15 août 2026</strong> sur 6 sites en Polynésie française : Faaa, Punaauia, Arue, Taravao, Mahina et Moorea. Merci pour votre engagement !</p>
        </section>

        <section>
          <h4 className="font-semibold">1. Inscription & validation</h4>
          <ul className="list-disc pl-5 text-slate-700">
            <li>Complétez votre profil dans l’onglet <strong>Profil</strong> (jours de présence, horaires).</li>
            <li>Indiquez vos sites préférés dans <strong>Sites & plan</strong>.</li>
            <li>ARACOM validera votre stand et vous confirmera l’affectation.</li>
          </ul>
        </section>

        <section>
          <h4 className="font-semibold">2. Caution de 20 000 XPF</h4>
          <p className="text-slate-700">La caution est obligatoire pour valider votre inscription. Elle est restituée sous 2 semaines après l’événement si :</p>
          <ul className="list-disc pl-5 text-slate-700">
            <li>vous êtes présent sur les deux jours confirmés</li>
            <li>votre stand est monté et démonté dans les horaires</li>
            <li>aucune dégradation n’est constatée</li>
          </ul>
          <p className="text-slate-700"><strong>Modes acceptés :</strong> chèque à l’ordre d’ARACOM, virement bancaire ou espèces sur rendez-vous.</p>
        </section>

        <section>
          <h4 className="font-semibold">3. Animations & créneaux</h4>
          <p className="text-slate-700">Utilisez l’onglet <strong>Animations</strong> pour proposer un ou plusieurs créneaux. Précisez :</p>
          <ul className="list-disc pl-5 text-slate-700">
            <li>le lieu : <em>sur votre stand</em> (anim permanente), <em>zone d’animation centrale</em>, ou <em>spectacle</em>.</li>
            <li>la durée et les besoins (sono, estrade, public max, etc.).</li>
            <li>la description précise pour que le public et la communication sachent à quoi s’attendre.</li>
          </ul>
        </section>

        <section>
          <h4 className="font-semibold">4. Documents obligatoires</h4>
          <ul className="list-disc pl-5 text-slate-700">
            <li><strong>Assurance RC</strong> couvrant votre présence sur site (2026)</li>
            <li><strong>Convention</strong> signée et scannée</li>
            <li><strong>Reçu de caution</strong> (fourni par ARACOM après réception)</li>
          </ul>
        </section>

        <section>
          <h4 className="font-semibold">5. Jour J — arrivée & présence</h4>
          <ul className="list-disc pl-5 text-slate-700">
            <li>Arrivée : <strong>au moins 1 h avant</strong> l’ouverture du public (généralement 9h30 pour une ouverture à 10h30).</li>
            <li>Un agent ARACOM vous accueille, vérifie votre stand et effectue un <strong>check-in</strong>.</li>
            <li>Un <strong>check-out</strong> est fait avant votre départ.</li>
            <li>Tout départ anticipé non autorisé peut entraîner une retenue partielle de la caution.</li>
          </ul>
        </section>

        <section>
          <h4 className="font-semibold">6. Contacts ARACOM</h4>
          <p className="text-slate-700">En cas de question, utilisez l’onglet <strong>Logistique</strong> pour laisser un mot à ARACOM, ou contactez directement l’équipe par email/téléphone communiqué dans votre convention.</p>
        </section>

        <div className="rounded-md bg-emerald-50 border border-emerald-200 p-4 not-prose">
          <div className="flex items-start gap-2"><Sparkles className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" /><div>
            <div className="font-semibold text-emerald-900">Merci pour votre engagement !</div>
            <p className="text-sm text-emerald-800 mt-1">Votre participation contribue au succès du Forum et à l’épanouissement des familles polynésiennes. L’équipe ARACOM est là pour vous accompagner.</p>
          </div></div>
        </div>
      </CardContent>
    </Card>
  );
}

function PasswordButton({ user, onChanged }) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [next2, setNext2] = useState('');
  const submit = async () => {
    if (!next || next !== next2) { toast.error('Les mots de passe ne correspondent pas'); return; }
    try {
      await api('/api/auth/change-password', { method: 'POST', body: JSON.stringify({ current_password: current, new_password: next }) });
      toast.success('Mot de passe mis à jour');
      setOpen(false); setCurrent(''); setNext(''); setNext2('');
      if (onChanged) onChanged();
    } catch (e) { toast.error(e.message); }
  };
  return (
    <div className="relative">
      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setOpen(!open)}><KeyRound className="w-3.5 h-3.5" /> Mot de passe</Button>
      {open && (
        <div className="absolute right-0 top-10 w-72 bg-white border rounded-md shadow-lg p-3 z-50 space-y-2">
          <div className="font-medium text-sm">Changer mon mot de passe</div>
          <Input type="password" placeholder="Mot de passe actuel" value={current} onChange={e => setCurrent(e.target.value)} />
          <Input type="password" placeholder="Nouveau mot de passe" value={next} onChange={e => setNext(e.target.value)} />
          <Input type="password" placeholder="Confirmer" value={next2} onChange={e => setNext2(e.target.value)} />
          <div className="flex gap-2">
            <Button size="sm" onClick={submit} className="flex-1">Changer</Button>
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
          </div>
        </div>
      )}
    </div>
  );
}

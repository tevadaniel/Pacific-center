'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shell } from '@/components/app-shell';
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
import { Checkbox } from '@/components/ui/checkbox';
import { FileUploadButton } from '@/components/file-upload';
import SmartVenueMap from '@/components/smart-venue-map';
import { ChatbotFloating } from '@/components/chatbot-widget';
import { toast } from 'sonner';
import {
  Building2, MapPin, Calendar, FileCheck2, Wallet, CheckCircle2, XCircle, Info, Mail, Phone, Clock,
  FileText, Trash2, Download, Star, Sparkles, BookOpen, KeyRound, Plus, LayoutGrid, ChevronLeft,
  ListChecks, MessageCircle, Send, Smile, Lock, AlertCircle, ShieldCheck, Truck,
} from 'lucide-react';
import {
  DEPOSIT_STATUS_LABEL, DEPOSIT_AMOUNT_XPF,
  DOCUMENT_TYPE_LABEL, EVENT_DATES, EVENT_OPENING_TIME, EVENT_CLOSING_TIME,
  ANIMATION_HOURLY_SLOTS, getAnimationSlotsForDate, DEMO_ZONE_SLOTS, MAX_ANIMATION_SLOTS_PER_DAY, MAX_PARALLEL_ANIMATIONS, MAX_DEMO_PARALLEL, MIN_ANIMATION_SLOTS_PER_DAY,
  LOGISTIQUE_PROVISIONS, LOGISTIQUE_RULES, DISCIPLINES,
} from '@/lib/constants';

// Documents que l'EXPOSANT doit déposer (le Reçu de caution est fourni par ARACOM, donc pas dans cette liste)
const DOC_TYPES = [
  { key: 'assurance', label: "Attestation d'assurance", icon: FileCheck2, mandatory: true },
  { key: 'convention', label: 'Convention signée', icon: FileText, mandatory: true },
  { key: 'autre', label: 'Autre document', icon: FileText, mandatory: false },
];

const SLOT_TYPES = [
  { value: 'stand', label: 'Sur mon stand', color: 'bg-blue-50 text-blue-700' },
  { value: 'zone_animation', label: "Zone d'animation centrale", color: 'bg-violet-50 text-violet-700' },
  { value: 'spectacle', label: 'Spectacle / Démonstration', color: 'bg-orange-50 text-orange-700' },
];

export default function ExposantPortal() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('parcours');
  const [stepDeadlines, setStepDeadlines] = useState({});
  const [postEvent, setPostEvent] = useState({ unlocked: false });
  const [validationRequest, setValidationRequest] = useState(null);

  // Read ?tab= from URL on mount and when changed externally
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sync = () => {
      const t = new URLSearchParams(window.location.search).get('tab');
      const valid = ['parcours', 'profil', 'sites', 'animation', 'docs', 'logistique', 'satisfaction', 'guide'];
      if (t && valid.includes(t)) setActiveTab(t);
    };
    sync();
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);

  const handleTabChange = (v) => {
    setActiveTab(v);
    if (typeof window !== 'undefined') {
      const url = v === 'parcours' ? '/exposant' : `/exposant?tab=${v}`;
      window.history.replaceState({}, '', url);
    }
  };

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
      // Charge la demande de validation existante (si présente)
      try {
        const vrList = await api('/api/validation-requests');
        const myVr = (Array.isArray(vrList) ? vrList : []).find(x => x.registration_id === mine.id);
        setValidationRequest(myVr || null);
      } catch {}
    } catch (e) { toast.error(e.message); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);
  // Charge les deadlines globales définies par ARACOM (pour le compte à rebours)
  useEffect(() => {
    api('/api/step-deadlines').then(d => setStepDeadlines(d.deadlines || {})).catch(() => {});
    api('/api/post-event-status').then(s => setPostEvent(s || { unlocked: false })).catch(() => {});
  }, []);

  if (loading) return <Shell title="Mon dossier exposant" allowedRoles={['exposant']}><div className="py-20 text-center text-slate-500">Chargement…</div></Shell>;
  if (!data?.registration) {
    return <Shell title="Mon dossier exposant" allowedRoles={['exposant']}><Card><CardContent className="py-12 text-center">
      <Info className="w-12 h-12 mx-auto text-slate-400" />
      <p className="mt-3 font-medium">Votre dossier n&apos;a pas encore été initialisé</p>
      <p className="text-slate-500 text-sm">L&apos;équipe ARACOM va bientôt vous contacter.</p>
    </CardContent></Card></Shell>;
  }

  const r = data.registration, o = data.organization, v = data.venue, d = data.deposit;
  const docs = data.documents || [];
  const cautionReceiptDoc = docs.find(dd => dd.document_type === 'recu_caution');
  const slotsArr = data.slots || [];
  const animationsCount = slotsArr.length;
  const validationRequestId = r.validation_request_id;
  const isLocked = !!r.is_locked || r.status === 'confirme';
  const checks = [
    { ok: !!r.venue_id && !!r.stand_code, label: 'Site & stand pré-réservés' },
    { ok: animationsCount > 0, label: 'Au moins un créneau d\'animation choisi' },
    { ok: !!validationRequestId || isLocked, label: 'Demande de validation envoyée à ARACOM' },
    { ok: r.is_convention_signed || docs.some(dd => dd.document_type === 'convention'), label: 'Convention signée' },
    { ok: docs.some(dd => dd.document_type === 'assurance'), label: 'Attestation d\'assurance déposée' },
    { ok: d?.status === 'recue', label: 'Caution reçue par ARACOM' },
    { ok: !!cautionReceiptDoc, label: 'Reçu de caution disponible (fourni par ARACOM)' },
    { ok: isLocked, label: '🔒 Inscription verrouillée par ARACOM' },
  ];
  const completion = Math.round((checks.filter(c => c.ok).length / checks.length) * 100);
  const isPreReserved = !!r.is_pre_reserved && r.status !== 'confirme';

  return (
    <Shell
      title={`Dossier — ${o?.name || 'Mon exposant'}`}
      subtitle="Votre espace personnel pour le Forum de la Rentrée 2026."
      allowedRoles={['exposant']}
      right={null}
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
                {isPreReserved && <Badge className="bg-amber-100 text-amber-700 border-amber-200">⏳ Pré-réservé — en attente caution</Badge>}
              </div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-blue-700">{completion}%</div>
              <div className="text-xs text-slate-500 uppercase tracking-wider">Dossier complet</div>
              <Progress value={completion} className="h-2 w-32 mt-2" />
            </div>
          </CardContent>
        </Card>

        {/* STEPPER — Process en 6 étapes + deadlines */}
        <ExposantStepper
          deadlines={stepDeadlines}
          checks={{
            profile: !!o?.contact_name && !!o?.main_email && !!o?.main_phone,
            site_stand: !!r.venue_id && !!r.stand_code,
            animations: animationsCount > 0,
            documents: docs.some(dd => dd.document_type === 'assurance') && (r.is_convention_signed || docs.some(dd => dd.document_type === 'convention')),
            validation_requested: !!validationRequestId || isLocked,
            locked: isLocked,
          }}
        />

        {isPreReserved && (
          <Card className="border-amber-300 bg-amber-50/40">
            <CardContent className="p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-amber-900">Votre stand est pré-réservé</div>
                <p className="text-sm text-amber-800 mt-0.5">Le stand <b className="font-mono">{r.stand_code}</b> sur le site <b>{v?.name}</b> vous est réservé. <b>ARACOM le confirmera définitivement dès réception de votre caution de 20 000 XPF</b> (chèque, virement ou espèces).</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* CTA "Confirmer ma présence" — visible quand site + stand + au moins 1 anim */}
        {!isLocked && (() => {
          const canRequest = !!r.venue_id && !!r.stand_code && animationsCount > 0;
          const alreadyRequested = !!validationRequestId;
          if (alreadyRequested) {
            return <ValidationStatusCard registrationId={r.id} validationRequestId={validationRequestId} onRefresh={load} />;
          }
          return (
            <Card className={`border-2 ${canRequest ? 'border-violet-300 bg-gradient-to-br from-violet-50 to-blue-50' : 'border-slate-200 bg-slate-50'}`}>
              <CardContent className="p-5 flex flex-col md:flex-row md:items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Sparkles className={`w-5 h-5 ${canRequest ? 'text-violet-600' : 'text-slate-400'}`} />
                    <h3 className={`text-lg font-bold ${canRequest ? 'text-violet-900' : 'text-slate-500'}`}>Confirmer ma présence avec dépôt de caution</h3>
                  </div>
                  <p className={`text-sm ${canRequest ? 'text-violet-800' : 'text-slate-500'}`}>
                    {canRequest
                      ? <>Tout est prêt ! Cliquez pour <b>verrouiller votre place</b>. ARACOM recevra une notification et vous contactera pour fixer un RDV de remise de la caution (<b>chèque ou espèces</b> uniquement, 20 000 XPF).</>
                      : <>Avant de pouvoir confirmer votre présence : choisissez un site & un stand <i>(onglet Sites & plan)</i>, puis <b>1 créneau d&apos;animation par jour</b> <i>(onglet Animations)</i>.</>
                    }
                  </p>
                </div>
                <ConfirmPresenceButton registrationId={r.id} disabled={!canRequest} onDone={load} />
              </CardContent>
            </Card>
          );
        })()}

        {isLocked && (
          <Card className="border-emerald-300 bg-gradient-to-br from-emerald-50 to-teal-50">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="text-4xl">🔒</div>
              <div className="flex-1">
                <div className="text-lg font-bold text-emerald-900">Inscription verrouillée par ARACOM</div>
                <p className="text-sm text-emerald-800">Votre site, votre stand et vos créneaux d&apos;animation sont définitifs. Pour toute modification, contactez ARACOM directement.</p>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="w-full grid grid-cols-3 md:grid-cols-7">
            <TabsTrigger value="parcours" className="font-bold">🎯 Mon parcours</TabsTrigger>
            <TabsTrigger value="profil">Mon profil</TabsTrigger>
            <TabsTrigger value="logistique">Logistique</TabsTrigger>
            <TabsTrigger value="guide">Guide</TabsTrigger>
            <TabsTrigger value="satisfaction" disabled={!postEvent.unlocked} className={!postEvent.unlocked ? 'opacity-40 cursor-not-allowed' : ''} title={!postEvent.unlocked ? 'Activé après l\'événement par ARACOM' : ''}>
              ⭐ Satisfaction {!postEvent.unlocked && <span className="text-[10px] ml-1">🔒</span>}
            </TabsTrigger>
            <TabsTrigger value="bilan" disabled={!postEvent.unlocked} className={!postEvent.unlocked ? 'opacity-40 cursor-not-allowed' : ''} title={!postEvent.unlocked ? 'Activé après l\'événement par ARACOM' : ''}>
              📋 Bilan {!postEvent.unlocked && <span className="text-[10px] ml-1">🔒</span>}
            </TabsTrigger>
          </TabsList>

          {/* 🎯 ÉTAPE STRUCTURANTE — Mon parcours en 3 étapes */}
          <TabsContent value="parcours" className="space-y-4">
            <ParcoursWizard
              registration={r}
              organization={o}
              venue={v}
              docs={docs}
              slots={data.slots}
              validationRequest={validationRequest}
              onRefresh={load}
            />
          </TabsContent>

          <TabsContent value="profil" className="space-y-4">
            <ProfilBlock organization={o} registration={r} onRefresh={load} />
            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><FileCheck2 className="w-4 h-4 text-emerald-600" /> Cheminement de mon dossier</CardTitle></CardHeader>
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
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><Wallet className="w-4 h-4 text-blue-600" /> Caution (20 000 XPF)</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  <div className="rounded-md bg-blue-50 border border-blue-100 p-4">
                    <div className="text-sm text-slate-600">Statut actuel</div>
                    <div className="text-2xl font-bold text-blue-700">{DEPOSIT_STATUS_LABEL[d?.status] || '—'}</div>
                    {d?.received_at && <div className="text-xs text-slate-500 mt-1">Reçue le {new Date(d.received_at).toLocaleDateString('fr-FR')}</div>}
                  </div>
                  {cautionReceiptDoc ? (
                    <a href={`/api/documents/${cautionReceiptDoc.id}/download`} target="_blank" rel="noreferrer">
                      <Button size="sm" variant="outline" className="w-full gap-2">
                        <Download className="w-4 h-4" /> Télécharger mon reçu de caution
                      </Button>
                    </a>
                  ) : (
                    <div className="text-xs text-slate-500 bg-amber-50 border border-amber-100 rounded-md p-3">
                      <strong>Modes acceptés :</strong> chèque, virement ou espèces. <br />
                      Le reçu de caution sera <b>fourni par ARACOM</b> dans cet espace dès réception du paiement.
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="logistique" className="space-y-4">
            <LogistiqueBlock registration={r} onRefresh={load} />
          </TabsContent>

          <TabsContent value="satisfaction" className="space-y-4">
            {postEvent.unlocked ? (
              <SatisfactionBlock registration={r} />
            ) : (
              <Card className="border-slate-200">
                <CardContent className="p-12 text-center">
                  <span className="text-5xl">🔒</span>
                  <p className="text-lg font-bold mt-3">Module Satisfaction verrouillé</p>
                  <p className="text-sm text-slate-500 mt-2">Ce questionnaire sera <b>activé par ARACOM</b> après l&apos;événement (15 août 2026). Vous serez notifié par email dès qu&apos;il sera disponible.</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="bilan" className="space-y-4">
            {postEvent.unlocked ? (
              <Card className="border-emerald-200 bg-emerald-50/30">
                <CardContent className="p-8 text-center">
                  <span className="text-4xl">📋</span>
                  <p className="text-lg font-bold mt-3">Bilan de l&apos;événement</p>
                  <p className="text-sm text-slate-600 mt-2">Vous pouvez consulter le bilan global de l&apos;édition 2026, ainsi que vos statistiques personnalisées (présence, animations, satisfaction).</p>
                  <Button variant="outline" className="mt-4 gap-2"><Download className="w-4 h-4" /> Télécharger mon bilan PDF</Button>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-slate-200">
                <CardContent className="p-12 text-center">
                  <span className="text-5xl">🔒</span>
                  <p className="text-lg font-bold mt-3">Bilan verrouillé</p>
                  <p className="text-sm text-slate-500 mt-2">Le bilan sera <b>activé par ARACOM</b> après l&apos;événement. Vous y trouverez vos statistiques personnelles, le bilan global et les comptes-rendus.</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="guide" className="space-y-4">
            <GuideBlock />
          </TabsContent>
        </Tabs>
      </div>
      <ChatbotFloating role="exposant" />
    </Shell>
  );
}

// =====================================================================
// EXPOSANT STEPPER — 6 étapes visuelles du parcours d'inscription
// =====================================================================
// =====================================================================
// 🎯 PARCOURS WIZARD — Les 3 étapes structurantes (Dates / Animations / Validation)
// =====================================================================
function ParcoursWizard({ registration, organization, venue, docs, slots, validationRequest, onRefresh }) {
  const r = registration;
  const isLocked = r.status === 'verrouille' || validationRequest?.status === 'verrouille';
  const isPending = validationRequest?.status === 'en_attente';
  const hasRdv = validationRequest?.status === 'rdv_fixe';

  // État dérivé des étapes
  const attendingDays = Array.isArray(r.attending_days) ? r.attending_days : [];
  const hasDays = attendingDays.length > 0;
  const hasStand = !!r.stand_code;
  const hasAnimVendredi = (slots || []).some(s => s.day_label === 'vendredi');
  const hasAnimSamedi = (slots || []).some(s => s.day_label === 'samedi');
  const animOk = attendingDays.every(d => (slots || []).some(s => s.day_label === d));

  const step1Ok = hasDays && hasStand;
  const step2Ok = step1Ok && animOk;
  const step3Ok = step2Ok && (validationRequest != null);

  return (
    <div className="space-y-4">
      {/* Bandeau état global */}
      {isLocked && (
        <Card className="border-emerald-300 bg-gradient-to-br from-emerald-50 to-teal-50">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="text-4xl">🔒</div>
            <div className="flex-1">
              <div className="text-lg font-bold text-emerald-900">Inscription verrouillée par ARACOM ✅</div>
              <p className="text-sm text-emerald-800">Tout est en ordre ! Votre dossier est définitif. Pour toute modification, contactez ARACOM.</p>
            </div>
          </CardContent>
        </Card>
      )}
      {hasRdv && !isLocked && (
        <Card className="border-blue-300 bg-gradient-to-br from-blue-50 to-sky-50">
          <CardContent className="p-5 flex items-start gap-4">
            <div className="text-4xl">📅</div>
            <div className="flex-1">
              <div className="text-lg font-bold text-blue-900">Rendez-vous fixé avec ARACOM</div>
              <p className="text-sm text-blue-800">
                {validationRequest.rdv_date && <><b>Date</b> : {new Date(validationRequest.rdv_date).toLocaleString('fr-FR', { dateStyle: 'full', timeStyle: 'short' })}<br /></>}
                {validationRequest.rdv_location && <><b>Lieu</b> : {validationRequest.rdv_location}<br /></>}
                Préparez les documents à apporter (convention signée, justificatif d&apos;assurance) et la <b>caution de 20 000 XPF</b>.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
      {isPending && !hasRdv && !isLocked && (
        <Card className="border-amber-300 bg-gradient-to-br from-amber-50 to-yellow-50">
          <CardContent className="p-5 flex items-start gap-4">
            <div className="text-4xl">⏳</div>
            <div className="flex-1">
              <div className="text-lg font-bold text-amber-900">Demande de validation en cours</div>
              <p className="text-sm text-amber-800">Votre demande a été envoyée à ARACOM le {new Date(validationRequest.requested_at).toLocaleDateString('fr-FR')}. Nous vous fixerons un rendez-vous très prochainement.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ÉTAPE 1 — Dates + Stand */}
      <Step1Card
        registration={r}
        venue={venue}
        attendingDays={attendingDays}
        isLocked={isLocked}
        done={step1Ok}
        onRefresh={onRefresh}
      />

      {/* ÉTAPE 2 — Animations */}
      <Step2Card
        registration={r}
        venue={venue}
        slots={slots || []}
        attendingDays={attendingDays}
        isLocked={isLocked}
        unlocked={step1Ok}
        done={step2Ok}
        onRefresh={onRefresh}
      />

      {/* ÉTAPE 3 — Documents + Soumettre */}
      <Step3Card
        registration={r}
        docs={docs}
        validationRequest={validationRequest}
        isLocked={isLocked}
        unlocked={step2Ok}
        done={step3Ok}
        onRefresh={onRefresh}
      />
    </div>
  );
}

function StepHeader({ n, title, done, unlocked = true, locked }) {
  return (
    <CardHeader className={`pb-3 ${done ? 'bg-emerald-50/40' : unlocked ? 'bg-violet-50/40' : 'bg-slate-50'}`}>
      <CardTitle className="text-base flex items-center gap-3">
        <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-white ${done ? 'bg-emerald-500' : unlocked ? 'bg-violet-500' : 'bg-slate-300'}`}>
          {done ? '✓' : n}
        </div>
        <span className={!unlocked ? 'text-slate-400' : ''}>{title}</span>
        {locked && <Badge className="bg-slate-200 text-slate-600 ml-auto">🔒 Verrouillé</Badge>}
        {!unlocked && !locked && <Badge variant="secondary" className="ml-auto">À débloquer</Badge>}
      </CardTitle>
    </CardHeader>
  );
}

function Step1Card({ registration, venue, attendingDays, isLocked, done, onRefresh }) {
  const r = registration;
  const [busy, setBusy] = useState(false);

  const toggleDay = async (day) => {
    if (isLocked) { toast.error('Dossier verrouillé'); return; }
    const newDays = attendingDays.includes(day) ? attendingDays.filter(d => d !== day) : [...attendingDays, day];
    if (newDays.length === 0) { toast.error('Vous devez participer au moins à un jour.'); return; }
    if (attendingDays.includes(day) && !newDays.includes(day)) {
      if (!window.confirm(`Désélectionner ${day} ? Vos animations de ce jour seront supprimées automatiquement.`)) return;
    }
    setBusy(true);
    try {
      await api(`/api/registrations/${r.id}/set-attending-days`, { method: 'POST', body: JSON.stringify({ attending_days: newDays }) });
      toast.success('Jours mis à jour');
      onRefresh?.();
    } catch (e) { toast.error(e.message); }
    setBusy(false);
  };

  return (
    <Card className={done ? 'border-emerald-300' : 'border-violet-300 ring-2 ring-violet-100'}>
      <StepHeader n={1} title="Mes jours de présence + mon stand" done={done} locked={isLocked} />
      <CardContent className="space-y-3 pt-4">
        <p className="text-sm text-slate-600">Sélectionnez le ou les jours où votre association sera présente. Décochez un jour pour vous désinscrire (vos animations associées seront supprimées).</p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { key: 'vendredi', label: 'Vendredi 14 août', sub: '11h – 17h', color: 'amber' },
            { key: 'samedi', label: 'Samedi 15 août', sub: '9h – 17h', color: 'sky' },
          ].map(d => {
            const checked = attendingDays.includes(d.key);
            return (
              <button
                key={d.key}
                disabled={busy || isLocked}
                onClick={() => toggleDay(d.key)}
                className={`relative p-4 rounded-lg border-2 text-left transition ${checked ? `bg-${d.color}-50 border-${d.color}-400 shadow-sm` : 'bg-white border-slate-200 hover:border-slate-400'} ${(busy || isLocked) ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                <div className="flex items-start gap-2">
                  <Checkbox checked={checked} className="mt-0.5 pointer-events-none" />
                  <div>
                    <div className="font-semibold text-sm">{d.label}</div>
                    <div className="text-xs text-slate-500">{d.sub}</div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Stand */}
        <div className="pt-3 border-t">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div>
              <div className="font-medium text-sm">📍 Mon site & mon stand</div>
              <p className="text-xs text-slate-500">Choisissez votre site puis cliquez sur un stand libre du plan.</p>
            </div>
            {r.stand_code && (
              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                {venue?.name} · Stand {r.stand_code}
              </Badge>
            )}
          </div>
          <SiteAndStandPicker registration={r} organization={null} onRefresh={onRefresh} />
        </div>
      </CardContent>
    </Card>
  );
}

function Step2Card({ registration, venue, slots, attendingDays, isLocked, unlocked, done, onRefresh }) {
  if (!unlocked) {
    return (
      <Card className="border-slate-200 opacity-70">
        <StepHeader n={2} title="Mes animations (1 par jour)" unlocked={false} done={false} />
        <CardContent className="pt-4">
          <p className="text-sm text-slate-500">⚠️ Validez d&apos;abord vos jours et votre stand à l&apos;étape 1.</p>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card className={done ? 'border-emerald-300' : 'border-violet-300'}>
      <StepHeader n={2} title="Mes animations (1 par jour minimum)" done={done} locked={isLocked} />
      <CardContent className="pt-4">
        {isLocked && <p className="text-sm text-amber-700 mb-3">🔒 Vos animations sont verrouillées par ARACOM.</p>}
        <AnimationsBlock
          registrationId={registration.id}
          venueId={registration.venue_id}
          venueName={venue?.name}
          slots={slots}
          onRefresh={onRefresh}
          attendingDays={attendingDays}
          readOnly={isLocked}
        />
      </CardContent>
    </Card>
  );
}

function Step3Card({ registration, docs, validationRequest, isLocked, unlocked, done, onRefresh }) {
  const [submitting, setSubmitting] = useState(false);

  const submitValidation = async () => {
    if (!window.confirm('Soumettre votre demande de validation à ARACOM ?\n\nUne fois soumise, ARACOM vous fixera un rendez-vous pour récupérer vos documents et la caution.')) return;
    setSubmitting(true);
    try {
      await api(`/api/registrations/${registration.id}/request-validation`, { method: 'POST', body: JSON.stringify({}) });
      toast.success('✅ Votre demande a été envoyée à ARACOM');
      onRefresh?.();
    } catch (e) { toast.error(e.message); }
    setSubmitting(false);
  };

  if (!unlocked) {
    return (
      <Card className="border-slate-200 opacity-70">
        <StepHeader n={3} title="Validation finale + Documents" unlocked={false} done={false} />
        <CardContent className="pt-4">
          <p className="text-sm text-slate-500">⚠️ Complétez les étapes 1 et 2 pour débloquer la soumission.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={done ? 'border-emerald-300' : 'border-violet-300'}>
      <StepHeader n={3} title="Documents + Soumission de ma demande" done={done} locked={isLocked} />
      <CardContent className="pt-4 space-y-4">
        <DocsBlockExposant registrationId={registration.id} docs={docs} onRefresh={onRefresh} />

        {/* Bouton de soumission */}
        {!validationRequest && !isLocked && (
          <div className="bg-gradient-to-br from-violet-50 to-fuchsia-50 border-2 border-violet-300 rounded-lg p-5">
            <div className="flex items-start gap-3">
              <Send className="w-6 h-6 text-violet-600 shrink-0 mt-1" />
              <div className="flex-1">
                <h4 className="font-bold text-violet-900">Prêt à soumettre votre demande ?</h4>
                <p className="text-sm text-violet-800 mt-1">
                  Une fois soumise, ARACOM vous fixera un <b>rendez-vous</b> pour récupérer :
                </p>
                <ul className="text-xs text-violet-700 mt-2 ml-4 list-disc space-y-0.5">
                  <li>Convention signée (téléchargeable plus haut)</li>
                  <li>Justificatif d&apos;assurance responsabilité civile</li>
                  <li>Caution de <b>20 000 XPF</b> (chèque, virement ou espèces)</li>
                </ul>
                <p className="text-xs text-violet-700 mt-2">Une fois le rendez-vous honoré, votre stand sera <b>définitivement verrouillé</b> et vous recevrez un email de confirmation avec le guide de l&apos;exposant.</p>
                <Button onClick={submitValidation} disabled={submitting} className="mt-3 bg-violet-600 hover:bg-violet-700 gap-2">
                  <Send className="w-4 h-4" /> {submitting ? 'Envoi en cours…' : 'Soumettre ma demande à ARACOM'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// =====================================================================
const STEPS = [
  { key: 'profile', n: 1, label: 'Compléter mon profil', desc: 'Contact, téléphone, description', tab: 'profil', dl_key: 'profile' },
  { key: 'site_stand', n: 2, label: 'Choisir mon site & stand', desc: 'Pré-réservation', tab: 'sites', dl_key: 'stand' },
  { key: 'animations', n: 3, label: 'Sélectionner mes animations', desc: '1 créneau par jour', tab: 'animations', dl_key: 'animation' },
  { key: 'documents', n: 4, label: 'Déposer mes documents', desc: 'Assurance + convention', tab: 'documents', dl_key: 'documents' },
  { key: 'validation_requested', n: 5, label: 'Demander la validation', desc: 'Caution chèque ou espèces', tab: 'profil', dl_key: 'caution' },
  { key: 'locked', n: 6, label: 'Inscription verrouillée', desc: 'Confirmé par ARACOM', tab: 'profil', dl_key: 'convention' },
];

// Helper : calcule J-X depuis une deadline ISO. Retourne { daysLeft, overdue, label, color }
function computeDeadlineState(isoDate) {
  if (!isoDate) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const dl = new Date(isoDate); dl.setHours(0, 0, 0, 0);
  const daysLeft = Math.ceil((dl - today) / (1000 * 60 * 60 * 24));
  if (daysLeft < 0) return { daysLeft, overdue: true, label: `⚠️ Retard ${-daysLeft}j`, color: 'bg-red-600 text-white' };
  if (daysLeft === 0) return { daysLeft, overdue: false, label: '⏰ Aujourd\'hui', color: 'bg-orange-500 text-white' };
  if (daysLeft <= 3) return { daysLeft, overdue: false, label: `⏰ Plus que ${daysLeft}j`, color: 'bg-amber-500 text-white' };
  if (daysLeft <= 7) return { daysLeft, overdue: false, label: `J-${daysLeft}`, color: 'bg-yellow-500 text-white' };
  return { daysLeft, overdue: false, label: `J-${daysLeft}`, color: 'bg-slate-200 text-slate-700' };
}

function ExposantStepper({ checks, deadlines = {} }) {
  // Find the first incomplete step → "current"
  const currentIdx = STEPS.findIndex(s => !checks[s.key]);
  return (
    <Card className="border-violet-200">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <ListChecks className="w-5 h-5 text-violet-600" />
          <h3 className="font-bold text-slate-900">Mes étapes pour finaliser ma présence</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2 relative">
          {STEPS.map((s, i) => {
            const done = checks[s.key];
            const isCurrent = i === currentIdx;
            const dl = !done ? computeDeadlineState(deadlines[s.dl_key]) : null;
            return (
              <div key={s.key} className={`relative rounded-md p-3 border-2 text-center transition ${
                done ? 'border-emerald-300 bg-emerald-50' :
                dl?.overdue ? 'border-red-400 bg-red-50 shadow-md' :
                isCurrent ? 'border-violet-400 bg-violet-50 shadow-md ring-2 ring-violet-200' :
                'border-slate-200 bg-slate-50'
              }`}>
                <div className={`mx-auto mb-1 w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold ${
                  done ? 'bg-emerald-500 text-white' :
                  isCurrent ? 'bg-violet-500 text-white animate-pulse' :
                  'bg-slate-300 text-slate-600'
                }`}>
                  {done ? '✓' : s.n}
                </div>
                <div className={`text-xs font-bold ${done ? 'text-emerald-900' : isCurrent ? 'text-violet-900' : 'text-slate-700'}`}>{s.label}</div>
                <div className={`text-[10px] mt-0.5 ${done ? 'text-emerald-700' : 'text-slate-500'}`}>{s.desc}</div>
                {dl && (
                  <div className={`mt-1.5 inline-block text-[10px] font-bold rounded-full px-2 py-0.5 ${dl.color}`} title={`Deadline : ${new Date(deadlines[s.dl_key]).toLocaleDateString('fr-FR')}`}>
                    {dl.label}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {currentIdx >= 0 && currentIdx < STEPS.length && (
          <div className="mt-3 text-xs text-slate-600 bg-violet-50 rounded-md px-3 py-2 border border-violet-100 flex items-center gap-2">
            <span className="text-violet-700 font-bold">→</span>
            Prochaine étape : <b className="text-violet-900">{STEPS[currentIdx].label}</b>
            {(() => {
              const dl = computeDeadlineState(deadlines[STEPS[currentIdx].dl_key]);
              if (!dl) return null;
              return <span className={`ml-auto text-[11px] font-bold rounded-full px-2 py-0.5 ${dl.color}`}>{dl.label}</span>;
            })()}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// =====================================================================
// CONFIRM PRESENCE — bouton + modale (envoi demande de validation)
// =====================================================================
function ConfirmPresenceButton({ registrationId, disabled, onDone }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ preferred_payment: 'cheque', rdv_proposal: '', notes: '' });
  const submit = async () => {
    setBusy(true);
    try {
      await api(`/api/registrations/${registrationId}/request-validation`, {
        method: 'POST',
        body: JSON.stringify(form),
      });
      toast.success('✅ Demande envoyée à ARACOM. Vous serez recontacté pour fixer le rendez-vous.');
      setOpen(false);
      if (onDone) onDone();
    } catch (e) { toast.error(e.message); }
    finally { setBusy(false); }
  };
  return (
    <>
      <Button
        size="lg"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className="bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 gap-2 shadow-lg disabled:opacity-50"
      >
        <Lock className="w-5 h-5" /> Confirmer ma présence
      </Button>
      {open && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => !busy && setOpen(false)}>
          <Card className="max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Lock className="w-5 h-5 text-violet-600" /> Confirmer ma présence</CardTitle>
              <p className="text-sm text-slate-600">Votre site, votre stand et vos créneaux d&apos;animation seront <b>verrouillés définitivement</b> par ARACOM dès que la caution sera réceptionnée.</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm font-semibold">Mode de caution préféré (20 000 XPF)</Label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {[
                    { v: 'cheque', label: '💳 Chèque', desc: "À l'ordre d'ARACOM" },
                    { v: 'especes', label: '💵 Espèces', desc: 'Remise en main propre' },
                  ].map(o => (
                    <button key={o.v} type="button" onClick={() => setForm({ ...form, preferred_payment: o.v })}
                      className={`border-2 rounded-md p-3 text-left transition ${form.preferred_payment === o.v ? 'border-violet-500 bg-violet-50' : 'border-slate-200 hover:border-slate-300'}`}>
                      <div className="font-semibold text-sm">{o.label}</div>
                      <div className="text-xs text-slate-500">{o.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-sm font-semibold">Vos disponibilités pour le RDV (facultatif)</Label>
                <Input
                  value={form.rdv_proposal}
                  onChange={(e) => setForm({ ...form, rdv_proposal: e.target.value })}
                  placeholder="Ex : matin, en semaine, après 17h…"
                />
              </div>
              <div>
                <Label className="text-sm font-semibold">Notes pour ARACOM (facultatif)</Label>
                <Textarea
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Information utile pour la prise de RDV…"
                />
              </div>
              <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900">
                <b>📌 Modes acceptés :</b> chèque ou espèces uniquement (pas de virement pour la caution).
              </div>
            </CardContent>
            <div className="flex gap-2 justify-end p-4 border-t">
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>Annuler</Button>
              <Button onClick={submit} disabled={busy} className="bg-violet-600 hover:bg-violet-700 gap-2">
                {busy ? 'Envoi…' : <><Send className="w-4 h-4" /> Envoyer la demande</>}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}

// =====================================================================
// VALIDATION STATUS CARD — affichée quand la demande est en cours
// =====================================================================
function ValidationStatusCard({ registrationId, validationRequestId, onRefresh }) {
  const [vreq, setVreq] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = async () => {
    try {
      const list = await api('/api/validation-requests');
      const found = list.find(x => x.id === validationRequestId);
      setVreq(found || null);
    } catch {/* ignore */}
  };
  useEffect(() => { load(); }, [validationRequestId]);
  const cancel = async () => {
    if (!confirm("Annuler votre demande de validation ? Vous pourrez en soumettre une nouvelle après modification.")) return;
    setBusy(true);
    try {
      await api(`/api/validation-requests/${validationRequestId}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'Annulée par l\'exposant' }),
      });
      toast.success('Demande annulée');
      if (onRefresh) onRefresh();
    } catch (e) { toast.error(e.message); }
    finally { setBusy(false); }
  };
  if (!vreq) {
    return (
      <Card className="border-blue-200 bg-blue-50/50">
        <CardContent className="p-4 text-sm text-blue-900 flex items-center gap-3">
          <Clock className="w-5 h-5 text-blue-600 animate-pulse" />
          Demande envoyée à ARACOM — chargement du statut…
        </CardContent>
      </Card>
    );
  }
  const status = vreq.status;
  const paymentLabel = vreq.preferred_payment === 'especes' ? 'Espèces' : 'Chèque';

  if (status === 'en_attente') {
    return (
      <Card className="border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50">
        <CardContent className="p-5 flex items-start gap-4">
          <div className="text-3xl">⏳</div>
          <div className="flex-1">
            <div className="font-bold text-amber-900 text-lg">Demande en attente de traitement</div>
            <p className="text-sm text-amber-800 mt-1">ARACOM a bien reçu votre demande de confirmation et vous recontactera très vite pour fixer le RDV de remise de caution ({paymentLabel}, 20 000 XPF).</p>
            <div className="text-xs text-slate-600 mt-2">Soumise le {new Date(vreq.created_at).toLocaleString('fr-FR')}</div>
          </div>
          <Button size="sm" variant="outline" onClick={cancel} disabled={busy}>Annuler la demande</Button>
        </CardContent>
      </Card>
    );
  }
  if (status === 'rdv_fixe') {
    const rdv = new Date(vreq.rdv_date);
    return (
      <Card className="border-emerald-300 bg-gradient-to-br from-emerald-50 to-teal-50">
        <CardContent className="p-5 flex items-start gap-4">
          <div className="text-3xl">📅</div>
          <div className="flex-1">
            <div className="font-bold text-emerald-900 text-lg">Rendez-vous fixé — {rdv.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} à {rdv.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>
            {vreq.rdv_location && <div className="text-sm text-emerald-800 mt-1"><b>📍 Lieu :</b> {vreq.rdv_location}</div>}
            {vreq.rdv_notes && <div className="text-sm text-emerald-800 mt-1">{vreq.rdv_notes}</div>}
            <div className="text-sm text-emerald-800 mt-2"><b>À prévoir :</b> votre caution de 20 000 XPF en {paymentLabel}{vreq.preferred_payment === 'cheque' ? ' (à l\'ordre d\'ARACOM)' : ''} + pièce d\'identité du responsable.</div>
          </div>
          <Button size="sm" variant="outline" onClick={cancel} disabled={busy}>Annuler</Button>
        </CardContent>
      </Card>
    );
  }
  return null;
}

// =====================================================================
// PROFIL — éditable, heures figées
// =====================================================================
function ProfilBlock({ organization, registration, onRefresh }) {
  const [form, setForm] = useState({
    name: organization.name || '',
    discipline: organization.discipline || '',
    contact_name: organization.contact_name || '',
    main_phone: organization.main_phone || '',
    description: organization.description || '',
    friday: !!registration.friday_slot_label,
    saturday: !!registration.saturday_slot_label,
  });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      await api(`/api/registrations/${registration.id}/profile`, {
        method: 'POST',
        body: JSON.stringify({
          name: form.name,
          discipline: form.discipline,
          contact_name: form.contact_name,
          main_phone: form.main_phone,
          description: form.description,
          friday_slot_label: form.friday ? 'Oui' : null,
          saturday_slot_label: form.saturday ? 'Oui' : null,
        }),
      });
      toast.success('Profil mis à jour ✅');
      onRefresh();
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><Building2 className="w-4 h-4 text-blue-600" /> Mon profil & ma participation</CardTitle>
        <p className="text-xs text-slate-500 mt-1">Vous pouvez modifier librement les informations de votre structure. L&apos;email de connexion est figé pour des raisons de sécurité.</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid md:grid-cols-2 gap-3">
          <div><Label>Nom de la structure *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
          <div>
            <Label>Discipline *</Label>
            <Select value={form.discipline} onValueChange={v => setForm({ ...form, discipline: v })}>
              <SelectTrigger><SelectValue placeholder="Choisir…" /></SelectTrigger>
              <SelectContent>{DISCIPLINES.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}<SelectItem value="Autre">Autre…</SelectItem></SelectContent>
            </Select>
          </div>
          <div><Label>Email principal <Lock className="w-3 h-3 inline ml-1 text-slate-400" /></Label><Input value={organization.main_email || ''} disabled /></div>
          <div><Label>Téléphone</Label><Input value={form.main_phone} onChange={e => setForm({ ...form, main_phone: e.target.value })} placeholder="87 XX XX XX" /></div>
          <div className="md:col-span-2"><Label>Contact principal (Nom Prénom)</Label><Input value={form.contact_name} onChange={e => setForm({ ...form, contact_name: e.target.value })} /></div>
          <div className="md:col-span-2"><Label>Description / présentation publique</Label><Textarea rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Présentation de votre structure (sera affichée dans le programme public)" /></div>
        </div>

        <div className="pt-3 border-t">
          <div className="font-medium text-sm mb-2 flex items-center gap-2"><Calendar className="w-4 h-4 text-blue-600" /> Jours de participation</div>
          <div className="grid grid-cols-2 gap-3">
            {EVENT_DATES.map(d => {
              const key = d.label === 'vendredi' ? 'friday' : 'saturday';
              return (
                <button key={d.label} type="button" onClick={() => setForm({ ...form, [key]: !form[key] })} className={`border rounded-md p-3 text-left transition ${form[key] ? 'bg-emerald-50 border-emerald-300' : 'bg-white hover:border-slate-400'}`}>
                  <div className="flex items-center justify-between"><div className="font-semibold">{d.display}</div>{form[key] && <CheckCircle2 className="w-5 h-5 text-emerald-600" />}</div>
                  <div className="text-xs text-slate-500 mt-1">{form[key] ? 'Vous serez présent' : 'Cliquez pour confirmer'}</div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="pt-3 border-t">
          <div className="font-medium text-sm mb-2 flex items-center gap-2"><Clock className="w-4 h-4 text-slate-500" /> Horaires officiels du Forum <Badge variant="secondary" className="text-[10px]">Figés 2026</Badge></div>
          <div className="grid grid-cols-2 gap-3">
            {EVENT_DATES.map(d => (
              <div key={d.label} className="rounded-md bg-slate-50 border p-3">
                <div className="text-xs text-slate-500 uppercase">{d.display}</div>
                <div className="text-2xl font-bold text-slate-700 font-mono">{d.start} – {d.end}</div>
                <div className="text-xs text-slate-500 mt-1">{d.label === 'vendredi' ? 'Ouverture publique 11h' : 'Journée complète 9h-17h'}</div>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-500 mt-2">⚠️ Soyez présent <b>1h avant</b> l&apos;ouverture pour le montage du stand.</p>
        </div>

        {/* 🤝 Bandeau d'engagement et accompagnement ARACOM */}
        <div className="pt-3 border-t space-y-2">
          <div className="rounded-lg bg-gradient-to-br from-amber-50 to-yellow-50 border border-amber-200 p-3">
            <div className="font-medium text-sm flex items-center gap-2 text-amber-900">🕐 Présence appréciée</div>
            <p className="text-xs text-amber-800 mt-1 leading-relaxed">
              En assurant une présence régulière et un stand vivant tout au long de la journée, vous contribuez au respect des engagements partagés pour cet événement. <b>Un grand merci pour votre implication.</b>
            </p>
          </div>
          <div className="rounded-lg bg-gradient-to-br from-blue-50 to-sky-50 border border-blue-200 p-3">
            <div className="font-medium text-sm flex items-center gap-2 text-blue-900">🤝 L&apos;équipe ARACOM à vos côtés</div>
            <p className="text-xs text-blue-800 mt-1 leading-relaxed">
              L&apos;équipe ARACOM sera <b>présente toute la journée</b> sur chaque site pour vous accompagner, répondre à vos questions et résoudre toute difficulté.
            </p>
          </div>
        </div>

        <Button onClick={save} disabled={saving} className="gap-2"><CheckCircle2 className="w-4 h-4" /> {saving ? 'Enregistrement…' : 'Enregistrer mon profil'}</Button>
      </CardContent>
    </Card>
  );
}

// =====================================================================
// SITES & PLAN — un seul site, sélection rapide d'un stand libre
// =====================================================================
function SiteAndStandPicker({ registration, organization, onRefresh }) {
  const [venues, setVenues] = useState([]);
  const [stands, setStands] = useState([]);
  const [selectedVenueId, setSelectedVenueId] = useState(registration.venue_id || '');
  const [busy, setBusy] = useState(false);

  useEffect(() => { api('/api/venues').then(setVenues); }, []);
  useEffect(() => {
    if (selectedVenueId) api(`/api/venues/${selectedVenueId}/stands`).then(setStands);
    else setStands([]);
  }, [selectedVenueId]);

  const venue = venues.find(v => v.id === selectedVenueId);
  const myStandCode = registration.stand_code;
  const isOnSelectedVenue = registration.venue_id === selectedVenueId;
  const isLocked = registration.status === 'confirme';

  const reserve = async (stand) => {
    if (isLocked) { toast.error('Stand confirmé — contactez ARACOM pour changer'); return; }
    if (!confirm(`Pré-réserver le stand ${stand.stand_code} sur ${venue?.name} ?\n\nLa réservation sera CONFIRMÉE par ARACOM dès réception de votre caution de 20 000 XPF.`)) return;
    setBusy(true);
    try {
      await api(`/api/registrations/${registration.id}/pre-reserve-stand`, {
        method: 'POST',
        body: JSON.stringify({ stand_id: stand.id }),
      });
      toast.success(`✅ Stand ${stand.stand_code} pré-réservé sur ${venue?.name}`);
      onRefresh();
    } catch (e) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  const release = async () => {
    if (isLocked) return;
    if (!confirm('Libérer votre stand pré-réservé ? Vous pourrez en re-choisir un autre.')) return;
    setBusy(true);
    try {
      await api(`/api/registrations/${registration.id}/release-stand`, { method: 'POST', body: JSON.stringify({}) });
      toast.success('Stand libéré');
      onRefresh();
    } catch (e) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  // Stands FREE = those without an organization
  const freeStands = stands.filter(s => !s.organization);
  const myStand = stands.find(s => s.stand_code === myStandCode && isOnSelectedVenue);

  return (
    <div className="space-y-4">
      {/* Site picker */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><MapPin className="w-4 h-4 text-blue-600" /> Choix de votre site</CardTitle>
          <p className="text-xs text-slate-500 mt-1">Vous pouvez choisir <b>un seul site</b>. Le choix sera confirmé par ARACOM après réception de votre caution.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <Select value={selectedVenueId} onValueChange={setSelectedVenueId} disabled={isLocked}>
            <SelectTrigger><SelectValue placeholder="Choisir un site…" /></SelectTrigger>
            <SelectContent>{venues.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent>
          </Select>
          {isLocked && <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md p-2">🔒 Inscription confirmée — votre site et votre stand sont définitifs.</p>}
        </CardContent>
      </Card>

      {/* Current stand status */}
      {selectedVenueId && (
        <Card className={myStand ? 'border-blue-200 bg-blue-50/40' : 'border-slate-200'}>
          <CardContent className="p-4 flex flex-col md:flex-row md:items-center gap-3">
            {myStand ? (
              <>
                <CheckCircle2 className="w-5 h-5 text-blue-600 shrink-0" />
                <div className="flex-1">
                  <div className="font-semibold">Stand pré-réservé : <span className="font-mono text-blue-700">{myStandCode}</span></div>
                  <div className="text-xs text-slate-600">{venue?.name} • {registration.status === 'confirme' ? 'Confirmé par ARACOM ✅' : 'En attente de caution ⏳'}</div>
                </div>
                {!isLocked && <Button variant="outline" size="sm" onClick={release} disabled={busy} className="gap-1.5"><Trash2 className="w-3.5 h-3.5" /> Libérer</Button>}
              </>
            ) : (
              <>
                <Info className="w-5 h-5 text-slate-500 shrink-0" />
                <div className="flex-1 text-sm text-slate-600">Vous n&apos;avez pas encore choisi de stand sur ce site. Cliquez sur un stand libre ci-dessous pour le pré-réserver.</div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Quick stand picker — list of FREE stands */}
      {selectedVenueId && !isLocked && freeStands.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><LayoutGrid className="w-4 h-4 text-emerald-600" /> Sélection rapide d&apos;un stand libre</CardTitle>
            <p className="text-xs text-slate-500 mt-1">{freeStands.length} stand(s) disponible(s) sur {venue?.name}. Cliquez pour pré-réserver.</p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
              {freeStands.map(s => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => reserve(s)}
                  disabled={busy}
                  className="border-2 border-emerald-300 bg-emerald-50 hover:bg-emerald-100 hover:border-emerald-500 rounded-md p-2 text-center transition disabled:opacity-50"
                  title={`Pré-réserver le stand ${s.stand_code}`}
                >
                  <div className="font-mono font-bold text-emerald-700">{s.stand_code}</div>
                  <div className="text-[10px] text-emerald-600">Libre</div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Visual map */}
      {selectedVenueId && venue && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><MapPin className="w-4 h-4 text-blue-600" /> Plan interactif — {venue.name}</CardTitle>
            <p className="text-xs text-slate-500 mt-1">Vue d&apos;ensemble : votre stand est mis en évidence en bleu.</p>
          </CardHeader>
          <CardContent>
            <SmartVenueMap stands={stands} venue={venue} highlightStandCode={isOnSelectedVenue ? myStandCode : null} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// =====================================================================
// ANIMATIONS — créneaux fixes ; site obligatoire ; stand vs zone démo
// =====================================================================
function AnimationsBlock({ registrationId, venueId, venueName, slots = [], onRefresh, attendingDays, readOnly = false }) {
  const [allSlots, setAllSlots] = useState([]);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(null); // {day, start, end, location_type}
  const [form, setForm] = useState({ title: '', description: '' });

  const loadSlots = async () => {
    if (!venueId) return;
    const data = await api(`/api/animation-slots?venue_id=${venueId}`);
    setAllSlots(data);
  };
  useEffect(() => { loadSlots(); }, [venueId, slots.length]);

  // Si aucun site choisi : message bloquant explicite
  if (!venueId) {
    return (
      <Card className="border-amber-300 bg-amber-50/40">
        <CardContent className="py-10 text-center space-y-3">
          <AlertCircle className="w-12 h-12 mx-auto text-amber-600" />
          <h3 className="text-lg font-semibold text-amber-900">Choisissez d&apos;abord votre site</h3>
          <p className="text-sm text-amber-800 max-w-md mx-auto">
            Les créneaux d&apos;animation dépendent du site sur lequel vous serez. Allez dans l&apos;onglet <b>Sites &amp; plan</b> pour pré-réserver un stand, puis revenez ici pour planifier vos animations.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Stand = personnel (jamais de conflit). Démo = partagé (max 1 par créneau).
  const standSlotsByDay = (day) => allSlots.filter(s => s.day_label === day && s.location_type === 'stand');
  const demoSlotsByDay = (day) => allSlots.filter(s => s.day_label === day && s.location_type === 'zone_animation');
  const myCountForDay = (day) => allSlots.filter(s => s.day_label === day && s.registration_id === registrationId).length;

  const standMine = (day, slot) => standSlotsByDay(day).find(s => s.start_time === slot.start && s.end_time === slot.end && s.registration_id === registrationId);
  const demoBookings = (day, slot) => demoSlotsByDay(day).filter(s => s.start_time === slot.start && s.end_time === slot.end);
  const demoMine = (day, slot) => demoBookings(day, slot).find(s => s.registration_id === registrationId);
  const demoOccupiedBy = (day, slot) => demoBookings(day, slot).find(s => s.registration_id !== registrationId);

  const startBooking = (day, slot, location_type) => {
    if (location_type === 'zone_animation' && demoOccupiedBy(day, slot)) {
      toast.error(`Créneau déjà réservé par ${demoOccupiedBy(day, slot).organization_name}`);
      return;
    }
    if (myCountForDay(day) >= MAX_ANIMATION_SLOTS_PER_DAY) {
      toast.error(`Vous avez atteint la limite de ${MAX_ANIMATION_SLOTS_PER_DAY} créneaux/jour`);
      return;
    }
    setEditing({ day, start: slot.start, end: slot.end, location_type });
    setForm({ title: '', description: '' });
  };

  const submitBooking = async () => {
    if (!form.title.trim()) { toast.error('Titre requis'); return; }
    setBusy(true);
    try {
      await api('/api/animation-slots', {
        method: 'POST',
        body: JSON.stringify({
          registration_id: registrationId,
          venue_id: venueId,
          day_label: editing.day,
          start_time: editing.start,
          end_time: editing.end,
          duration_minutes: editing.location_type === 'zone_animation' ? 30 : 60,
          title: form.title,
          description: form.description,
          slot_type: editing.location_type,
          location_type: editing.location_type,
        }),
      });
      toast.success(`✨ Créneau ${editing.start}–${editing.end} réservé !`);
      setEditing(null);
      loadSlots();
      onRefresh();
    } catch (e) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  const removeBooking = async (slotId) => {
    if (!confirm('Supprimer ce créneau ?')) return;
    setBusy(true);
    try {
      await api(`/api/animation-slots/${slotId}`, { method: 'DELETE' });
      toast.success('Créneau supprimé');
      loadSlots();
      onRefresh();
    } catch (e) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  const dayCompleteness = (day) => {
    const c = myCountForDay(day);
    if (c >= MIN_ANIMATION_SLOTS_PER_DAY) return { ok: true, label: `${c} créneau${c > 1 ? 'x' : ''}` };
    return { ok: false, label: 'Aucun créneau choisi' };
  };

  return (
    <div className="space-y-4">
      <Card className="bg-blue-50/30 border-blue-200">
        <CardContent className="p-4 flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <div className="text-sm text-blue-900 space-y-1">
            <p>📍 <b>Site sélectionné :</b> {venueName || 'Votre site'} — les créneaux affichés sont spécifiques à ce site.</p>
            <p>👉 Pour chaque jour, choisissez <b>1 créneau d&apos;animation</b> (obligatoire, 1 max). Deux types possibles :</p>
            <ul className="text-xs space-y-0.5 ml-3">
              <li>🟦 <b>Sur mon stand</b> : 1h, votre stand vous appartient pour la journée</li>
              <li>🟧 <b>Zone de démonstration</b> : 30min, partagée — <b>1 seul exposant à la fois</b></li>
            </ul>
            <p className="text-[11px] mt-1 text-amber-700">⚠️ Vous devez tenir votre stand <b>toute la journée</b> ({EVENT_DATES.find(x => x.label === 'vendredi')?.start || '11:00'}-17h vendredi · 9h-17h samedi). L&apos;animation est un temps fort de votre journée.</p>
          </div>
        </CardContent>
      </Card>

      {/* Daily completeness summary - filtré par les jours sélectionnés */}
      <div className="grid grid-cols-2 gap-3">
        {EVENT_DATES.filter(d => !attendingDays || attendingDays.length === 0 || attendingDays.includes(d.label)).map(d => {
          const dc = dayCompleteness(d.label);
          return (
            <div key={d.label} className={`rounded-md border-2 p-3 ${dc.ok ? 'bg-emerald-50 border-emerald-300' : 'bg-amber-50 border-amber-300'}`}>
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold uppercase">{d.display}</div>
                {dc.ok ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <AlertCircle className="w-5 h-5 text-amber-600" />}
              </div>
              <div className={`text-sm font-medium mt-0.5 ${dc.ok ? 'text-emerald-700' : 'text-amber-700'}`}>{dc.label}</div>
            </div>
          );
        })}
      </div>

      {EVENT_DATES.filter(d => !attendingDays || attendingDays.length === 0 || attendingDays.includes(d.label)).map(d => (
        <Card key={d.label} className={readOnly ? 'opacity-70' : ''}>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-600" /> {d.display}
              <Badge variant="secondary" className="text-[10px] ml-auto">{myCountForDay(d.label)}/{MAX_ANIMATION_SLOTS_PER_DAY} créneau</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* === SUR MON STAND (1h, no conflict) === */}
            <div>
              <div className="font-semibold text-xs uppercase text-blue-700 mb-2 flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-600" /> Sur mon stand <span className="text-slate-400 font-normal normal-case">— créneaux d&apos;1h, votre stand</span></div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {getAnimationSlotsForDate(d.date).map(slot => {
                  const mine = standMine(d.label, slot);
                  if (mine) {
                    return (
                      <div key={slot.start} className="border-2 border-blue-400 bg-blue-50 rounded-md p-2 text-xs">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-mono font-bold text-blue-700">{slot.start}–{slot.end}</span>
                          <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={() => removeBooking(mine.id)} disabled={busy}><Trash2 className="w-3 h-3 text-rose-600" /></Button>
                        </div>
                        <div className="font-medium text-[11px] mt-0.5 truncate">{mine.title}</div>
                      </div>
                    );
                  }
                  const overLimit = myCountForDay(d.label) >= MAX_ANIMATION_SLOTS_PER_DAY;
                  return (
                    <button
                      key={slot.start}
                      type="button"
                      disabled={overLimit || busy}
                      onClick={() => startBooking(d.label, slot, 'stand')}
                      className={`border rounded-md p-2 text-xs text-left transition disabled:opacity-50 disabled:cursor-not-allowed ${
                        overLimit ? 'bg-slate-50 border-slate-200' :
                        'bg-white border-slate-200 hover:bg-blue-50 hover:border-blue-400'
                      }`}
                    >
                      <div className="flex items-center gap-1">
                        <span className="font-mono font-bold">{slot.start}</span>
                        {!overLimit && <Plus className="w-3 h-3 text-blue-600 ml-auto" />}
                      </div>
                      <div className="text-[10px] text-emerald-700 mt-0.5">Libre</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* === ZONE DE DÉMONSTRATION (30min, 1 max) === */}
            <div>
              <div className="font-semibold text-xs uppercase text-orange-700 mb-2 flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-orange-500" /> Zone de démonstration <span className="text-slate-400 font-normal normal-case">— 30min, partagée (1 exposant à la fois)</span></div>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-1.5">
                {DEMO_ZONE_SLOTS.filter(s => d.label === 'vendredi' ? s.start >= '11:00' : true).map(slot => {
                  const mine = demoMine(d.label, slot);
                  if (mine) {
                    return (
                      <div key={slot.start} className="border-2 border-orange-400 bg-orange-50 rounded-md p-2 text-[11px]">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-mono font-bold text-orange-700">{slot.start}</span>
                          <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={() => removeBooking(mine.id)} disabled={busy}><Trash2 className="w-3 h-3 text-rose-600" /></Button>
                        </div>
                        <div className="font-medium truncate">{mine.title}</div>
                      </div>
                    );
                  }
                  const occupiedBy = demoOccupiedBy(d.label, slot);
                  if (occupiedBy) {
                    return (
                      <div key={slot.start} className="border-2 border-rose-200 bg-rose-50 rounded-md p-2 text-[11px] cursor-not-allowed" title={`Pris par ${occupiedBy.organization_name}`}>
                        <div className="flex items-center gap-1">
                          <span className="font-mono font-bold text-rose-600">{slot.start}</span>
                          <Lock className="w-3 h-3 text-rose-500 ml-auto" />
                        </div>
                        <div className="text-rose-600 truncate font-medium">Occupé</div>
                        <div className="text-[9px] text-rose-500/80 truncate">{occupiedBy.organization_name}</div>
                      </div>
                    );
                  }
                  const overLimit = myCountForDay(d.label) >= MAX_ANIMATION_SLOTS_PER_DAY;
                  return (
                    <button
                      key={slot.start}
                      type="button"
                      disabled={overLimit || busy}
                      onClick={() => startBooking(d.label, slot, 'zone_animation')}
                      className={`border rounded-md p-2 text-[11px] text-left transition disabled:opacity-50 disabled:cursor-not-allowed ${
                        overLimit ? 'bg-slate-50 border-slate-200' :
                        'bg-white border-slate-200 hover:bg-orange-50 hover:border-orange-400'
                      }`}
                    >
                      <div className="flex items-center gap-1">
                        <span className="font-mono font-bold">{slot.start}</span>
                        {!overLimit && <Plus className="w-3 h-3 text-orange-600 ml-auto" />}
                      </div>
                      <div className="text-emerald-700 mt-0.5 text-[10px]">Libre</div>
                    </button>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Booking dialog */}
      {editing && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => !busy && setEditing(null)}>
          <Card className="w-full max-w-md" onClick={e => e.stopPropagation()}>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                {editing.location_type === 'stand' ? <span className="w-3 h-3 rounded-full bg-blue-500" /> : <span className="w-3 h-3 rounded-full bg-orange-500" />}
                Réserver {editing.start} → {editing.end}
              </CardTitle>
              <p className="text-xs text-slate-500 mt-1">{EVENT_DATES.find(d => d.label === editing.day)?.display} · {editing.location_type === 'stand' ? 'Sur votre stand' : 'Zone de démonstration centrale'}</p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>Titre de l&apos;animation *</Label>
                <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Démo judo, concert, atelier..." autoFocus />
              </div>
              <div>
                <Label>Description (optionnelle)</Label>
                <Textarea rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Décrivez votre animation (besoins matériels, public ciblé...)" />
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <Button variant="ghost" onClick={() => setEditing(null)} disabled={busy}>Annuler</Button>
                <Button onClick={submitBooking} disabled={busy} className={`gap-2 ${editing.location_type === 'stand' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-orange-600 hover:bg-orange-700'}`}><CheckCircle2 className="w-4 h-4" /> {busy ? 'Réservation…' : 'Réserver'}</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

// =====================================================================
// DOCUMENTS — sans "reçu de caution" (fourni par ARACOM)
// =====================================================================
function DocsBlockExposant({ registrationId, docs, onRefresh }) {
  const cautionReceipt = docs.find(d => d.document_type === 'recu_caution');
  const [officialDocs, setOfficialDocs] = useState([]);

  useEffect(() => {
    api('/api/official-documents').then(setOfficialDocs).catch(() => {});
  }, []);

  const uploadDoc = async (type, payload) => {
    try {
      await api('/api/documents', { method: 'POST', body: JSON.stringify({ registration_id: registrationId, document_type: type, ...payload }) });
      toast.success('Document déposé ✅');
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
    <div className="space-y-4">
      {/* BANNIÈRE — Documents officiels à télécharger (fournis par ARACOM) */}
      {officialDocs.length > 0 && (
        <Card className="border-2 border-amber-300 bg-gradient-to-br from-amber-50 to-yellow-50">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-amber-900">
              <FileText className="w-5 h-5 text-amber-600" />
              📄 Documents officiels à télécharger
            </CardTitle>
            <p className="text-sm text-amber-800 mt-1">
              Téléchargez la <b>convention</b>, le <b>guide</b> et tout autre document à signer. Imprimez, signez et redéposez-les ci-dessous dans la section <i>« Mes documents à fournir »</i>.
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 gap-2">
              {officialDocs.map(d => (
                <a key={d.id} href={d.drive_url} target="_blank" rel="noreferrer" className="flex items-start gap-3 bg-white border border-amber-200 hover:border-amber-400 hover:shadow-sm rounded-md p-3 transition">
                  <FileText className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm text-amber-900 truncate">{d.title}</div>
                    {d.description && <div className="text-xs text-amber-700 line-clamp-2 mt-0.5">{d.description}</div>}
                    <div className="text-[11px] text-amber-600 mt-1 flex items-center gap-1"><Download className="w-3 h-3" /> Cliquer pour télécharger</div>
                  </div>
                </a>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reçu de caution — INFO ONLY */}
      <Card className={cautionReceipt ? 'border-emerald-200 bg-emerald-50/30' : 'border-amber-200 bg-amber-50/30'}>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Wallet className="w-4 h-4 text-blue-600" />
            Reçu de caution {cautionReceipt ? <Badge className="bg-emerald-600 text-white text-[10px]">Disponible</Badge> : <Badge variant="secondary" className="text-[10px]">En attente</Badge>}
          </CardTitle>
          <p className="text-xs text-slate-500 mt-1">📌 Ce document est <b>généré et fourni par ARACOM</b> dès réception de votre caution.</p>
        </CardHeader>
        <CardContent>
          {cautionReceipt ? (
            <a href={`/api/documents/${cautionReceipt.id}/download`} target="_blank" rel="noreferrer">
              <Button className="w-full bg-emerald-600 hover:bg-emerald-700 gap-2"><Download className="w-4 h-4" /> Télécharger mon reçu de caution</Button>
            </a>
          ) : (
            <div className="text-sm text-amber-800 bg-amber-50 rounded-md p-3 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <div>Votre reçu sera disponible ici dès que ARACOM aura enregistré la réception de votre caution de <b>20 000 XPF</b>.</div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Documents to upload by exposant */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><FileText className="w-4 h-4 text-blue-600" /> Mes documents à fournir</CardTitle>
          <p className="text-xs text-slate-500 mt-1">Déposez vos pièces (PDF ou photo, max 6 Mo chacun). L&apos;équipe ARACOM les validera.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {docsByType.map(dt => (
            <div key={dt.key} className="border rounded-md p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <dt.icon className="w-4 h-4 text-slate-500" />
                  <div className="font-medium">{dt.label}</div>
                  {dt.mandatory && <Badge variant="secondary" className="text-[10px] bg-red-50 text-red-700 border-red-200">Obligatoire</Badge>}
                </div>
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
    </div>
  );
}

// =====================================================================
// LOGISTIQUE — info structurée (ce qui est fourni + règles)
// =====================================================================
function LogistiqueBlock({ registration, onRefresh }) {
  const [value, setValue] = useState(registration.exposant_notes || '');
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      await api(`/api/registrations/${registration.id}`, { method: 'PUT', body: JSON.stringify({ exposant_notes: value }) });
      toast.success('Demande enregistrée ✅');
      onRefresh();
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  };
  return (
    <div className="space-y-4">
      <Card className="border-emerald-200 bg-emerald-50/30">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Truck className="w-4 h-4 text-emerald-600" /> Tenue d&apos;un stand & logistique fournie par ARACOM</CardTitle>
          <p className="text-xs text-slate-700 mt-1">Voici exactement ce qui sera mis à disposition sur votre stand le jour J.</p>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-3">
            {LOGISTIQUE_PROVISIONS.map((p, i) => (
              <div key={i} className="bg-white border border-emerald-100 rounded-md p-3 flex items-start gap-3">
                <div className="text-2xl">{p.icon}</div>
                <div className="flex-1">
                  <div className="font-semibold text-sm">{p.label}</div>
                  <div className="text-xs text-slate-500">{p.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-blue-600" /> Règles à respecter sur le stand</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            {LOGISTIQUE_RULES.map((r, i) => (
              <li key={i} className="border-l-2 border-blue-300 pl-3 py-0.5">{r}</li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><MessageCircle className="w-4 h-4 text-violet-600" /> Demandes ou besoins spécifiques</CardTitle>
          <p className="text-xs text-slate-500 mt-1">Indiquez à ARACOM tout besoin particulier (prise électrique, espace enfant, table supplémentaire, etc.).</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea rows={5} value={value} onChange={e => setValue(e.target.value)} placeholder="Ex: nous avons besoin d'une prise électrique pour un écran de démo, d'une table supplémentaire, d'un espace de change pour les démonstrations..." />
          <Button onClick={save} disabled={saving} className="gap-2"><CheckCircle2 className="w-4 h-4" /> {saving ? 'Enregistrement…' : 'Enregistrer ma demande'}</Button>
        </CardContent>
      </Card>
    </div>
  );
}

// =====================================================================
// SATISFACTION (inchangé, déjà en place)
// =====================================================================
function SatisfactionBlock({ registration }) {
  const [survey, setSurvey] = useState(null);
  const [form, setForm] = useState({
    overall_rating: 0, organization_rating: 0, stand_rating: 0, visitors_rating: 0, communication_rating: 0,
    nps_score: null, will_participate_next: '',
    positive_points: '', improvement_points: '', free_comment: '',
  });
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [rdvProposed, setRdvProposed] = useState('');

  const reload = async () => {
    try {
      const arr = await api(`/api/satisfaction?registration_id=${registration.id}`);
      if (arr.length > 0) {
        const s = arr[0];
        setSurvey(s);
        setForm({
          overall_rating: s.overall_rating || 0,
          organization_rating: s.organization_rating || 0,
          stand_rating: s.stand_rating || 0,
          visitors_rating: s.visitors_rating || 0,
          communication_rating: s.communication_rating || 0,
          nps_score: s.nps_score,
          will_participate_next: s.will_participate_next || '',
          positive_points: s.positive_points || '',
          improvement_points: s.improvement_points || '',
          free_comment: s.free_comment || '',
        });
        if (s.caution_return_rdv_proposed) {
          setRdvProposed(new Date(s.caution_return_rdv_proposed).toISOString().slice(0, 16));
        }
      }
    } catch {}
  };
  useEffect(() => { reload(); }, [registration.id]);

  const isLocked = survey?.validation_status === 'validated_by_aracom' || survey?.caution_return_status === 'completed';
  const isPendingReview = survey?.validation_status === 'pending_aracom_review';
  const rdvConfirmed = survey?.caution_return_rdv_confirmed;
  const cautionReturned = survey?.caution_return_status === 'completed';

  const save = async () => {
    setSaving(true);
    try {
      await api('/api/satisfaction', { method: 'POST', body: JSON.stringify({ registration_id: registration.id, ...form }) });
      toast.success('Réponses enregistrées (brouillon)');
      reload();
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const submitFinal = async () => {
    if (!form.overall_rating || !form.nps_score == null) {
      toast.error('Merci de noter au moins la note globale et le NPS avant de valider');
      return;
    }
    if (!rdvProposed) {
      toast.error('Proposez une date pour la restitution de la caution');
      return;
    }
    if (!window.confirm(`Valider votre bilan et proposer le RDV du ${new Date(rdvProposed).toLocaleString('fr-FR')} pour la restitution de votre caution ?\n\nUne fois soumis, ARACOM examinera vos réponses puis confirmera ou modifiera la date.`)) return;
    setSubmitting(true);
    try {
      await api('/api/satisfaction', {
        method: 'POST',
        body: JSON.stringify({
          registration_id: registration.id, ...form,
          validated_by_exposant: true,
          caution_return_rdv_proposed: new Date(rdvProposed).toISOString(),
        }),
      });
      toast.success('✅ Bilan soumis à ARACOM. Vous serez notifié de la confirmation du RDV.');
      reload();
    } catch (e) { toast.error(e.message); }
    finally { setSubmitting(false); }
  };

  const StarRating = ({ value, onChange, label }) => (
    <div>
      <Label className="text-xs uppercase">{label}</Label>
      <div className="flex gap-1 mt-1">
        {[1,2,3,4,5].map(n => (
          <button key={n} type="button" disabled={isLocked || isPendingReview} onClick={() => onChange(n)}>
            <Star className={`w-7 h-7 transition ${n <= value ? 'fill-amber-400 text-amber-400' : 'text-slate-300 hover:text-amber-200'} ${(isLocked || isPendingReview) ? 'opacity-60' : ''}`} />
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <Card className="border-violet-200 bg-violet-50/30">
        <CardContent className="p-4 flex items-start gap-3">
          <Smile className="w-5 h-5 text-violet-600 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-violet-900">Votre avis sur le Forum 2026</p>
            <p className="text-xs text-violet-800 mt-0.5">Vos réponses nous aident à améliorer l&apos;événement chaque année. {survey && <span className="font-semibold">Vous pouvez encore mettre à jour vos réponses.</span>}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Notes globales</CardTitle></CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-4">
          <StarRating value={form.overall_rating} onChange={n => setForm({ ...form, overall_rating: n })} label="Note globale" />
          <StarRating value={form.organization_rating} onChange={n => setForm({ ...form, organization_rating: n })} label="Organisation" />
          <StarRating value={form.stand_rating} onChange={n => setForm({ ...form, stand_rating: n })} label="Mon stand" />
          <StarRating value={form.visitors_rating} onChange={n => setForm({ ...form, visitors_rating: n })} label="Affluence visiteurs" />
          <StarRating value={form.communication_rating} onChange={n => setForm({ ...form, communication_rating: n })} label="Communication ARACOM" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recommanderiez-vous le Forum ? (NPS 0-10)</CardTitle>
          <p className="text-xs text-slate-500 mt-1">0 = pas du tout · 10 = totalement</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-11 gap-1">
            {Array.from({ length: 11 }).map((_, n) => (
              <button key={n} type="button" onClick={() => setForm({ ...form, nps_score: n })}
                className={`h-10 rounded text-sm font-bold transition ${
                  form.nps_score === n
                    ? n <= 6 ? 'bg-rose-600 text-white' : n <= 8 ? 'bg-amber-500 text-white' : 'bg-emerald-600 text-white'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}>{n}</button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Participation édition 2027</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-3 gap-2">
          {[
            { v: 'oui', label: 'Oui, sans hésiter', color: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
            { v: 'peut_etre', label: 'Peut-être', color: 'bg-amber-100 text-amber-700 border-amber-300' },
            { v: 'non', label: 'Non', color: 'bg-rose-100 text-rose-700 border-rose-300' },
          ].map(o => (
            <button key={o.v} type="button" onClick={() => setForm({ ...form, will_participate_next: o.v })}
              className={`border-2 rounded-md p-3 text-center text-sm font-medium transition ${
                form.will_participate_next === o.v ? o.color : 'bg-white border-slate-200 hover:border-slate-400'
              }`}>{o.label}</button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Vos commentaires</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div><Label>Points positifs</Label><Textarea rows={2} disabled={isLocked || isPendingReview} value={form.positive_points} onChange={e => setForm({ ...form, positive_points: e.target.value })} placeholder="Ce qui a particulièrement bien fonctionné…" /></div>
          <div><Label>À améliorer</Label><Textarea rows={2} disabled={isLocked || isPendingReview} value={form.improvement_points} onChange={e => setForm({ ...form, improvement_points: e.target.value })} placeholder="Suggestions pour améliorer le Forum…" /></div>
          <div><Label>Commentaire libre</Label><Textarea rows={3} disabled={isLocked || isPendingReview} value={form.free_comment} onChange={e => setForm({ ...form, free_comment: e.target.value })} placeholder="Toute remarque libre…" /></div>
        </CardContent>
      </Card>

      {/* 🆕 Bloc Validation finale + RDV restitution caution */}
      {cautionReturned ? (
        <Card className="border-emerald-300 bg-gradient-to-br from-emerald-50 to-teal-50">
          <CardContent className="p-5 text-center">
            <span className="text-5xl">✅</span>
            <p className="text-lg font-bold text-emerald-900 mt-2">Caution restituée — Édition terminée</p>
            <p className="text-sm text-emerald-700 mt-1">Votre caution vous a été rendue le {new Date(survey.caution_returned_at).toLocaleDateString('fr-FR')}. Merci pour votre participation au Forum 2026 !</p>
          </CardContent>
        </Card>
      ) : isLocked ? (
        <Card className="border-blue-300 bg-gradient-to-br from-blue-50 to-sky-50">
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <span className="text-4xl">📅</span>
              <div className="flex-1">
                <p className="text-lg font-bold text-blue-900">Bilan validé par ARACOM ✅</p>
                {rdvConfirmed ? (
                  <>
                    <p className="text-sm text-blue-800 mt-1">RDV confirmé pour la restitution de votre caution :</p>
                    <p className="text-base font-bold text-blue-900 mt-1">{new Date(rdvConfirmed).toLocaleString('fr-FR', { dateStyle: 'full', timeStyle: 'short' })}</p>
                    {survey.validation_comment && <p className="text-xs text-blue-700 mt-2 italic">💬 {survey.validation_comment}</p>}
                  </>
                ) : (
                  <p className="text-sm text-blue-800 mt-1">Date de RDV en cours de confirmation par ARACOM. Vous serez notifié(e).</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : isPendingReview ? (
        <Card className="border-amber-300 bg-gradient-to-br from-amber-50 to-yellow-50">
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <span className="text-4xl">⏳</span>
              <div className="flex-1">
                <p className="text-lg font-bold text-amber-900">Bilan en cours de validation</p>
                <p className="text-sm text-amber-800 mt-1">Votre bilan a été soumis le {new Date(survey.validated_by_exposant_at).toLocaleDateString('fr-FR')}. ARACOM examine vos réponses.</p>
                {survey.caution_return_rdv_proposed && (
                  <p className="text-sm text-amber-800 mt-1">RDV proposé : <b>{new Date(survey.caution_return_rdv_proposed).toLocaleString('fr-FR', { dateStyle: 'full', timeStyle: 'short' })}</b></p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-violet-300 bg-gradient-to-br from-violet-50 to-fuchsia-50">
          <CardContent className="p-5 space-y-3">
            <div className="flex items-start gap-3">
              <Wallet className="w-6 h-6 text-violet-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-bold text-violet-900">📅 Proposer un rendez-vous pour la restitution de la caution</p>
                <p className="text-xs text-violet-700 mt-1">Une fois votre bilan validé par ARACOM, votre caution de 20 000 XPF vous sera restituée à cette date (sous réserve de confirmation par ARACOM).</p>
              </div>
            </div>
            <Input
              type="datetime-local"
              value={rdvProposed}
              onChange={(e) => setRdvProposed(e.target.value)}
              className="bg-white"
            />
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={save} disabled={saving} variant="outline" className="gap-2">
                <Send className="w-4 h-4" /> {saving ? 'Sauvegarde…' : 'Enregistrer brouillon'}
              </Button>
              <Button onClick={submitFinal} disabled={submitting || !rdvProposed} className="gap-2 bg-violet-600 hover:bg-violet-700">
                <CheckCircle2 className="w-4 h-4" /> {submitting ? 'Envoi…' : 'Valider mon bilan + Soumettre RDV'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// =====================================================================
// GUIDE EXPOSANT
// =====================================================================
function GuideBlock() {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base flex items-center gap-2"><BookOpen className="w-4 h-4 text-emerald-600" /> Guide de l&apos;exposant</CardTitle></CardHeader>
      <CardContent className="space-y-5 prose prose-sm max-w-none">
        <section>
          <h3 className="font-semibold text-base">Bienvenue au Forum de la Rentrée 2026</h3>
          <p className="text-slate-700">Le Forum se tiendra les <strong>vendredi 14 et samedi 15 août 2026</strong> sur 6 sites en Polynésie française : Faaa, Punaauia, Arue, Taravao, Mahina et Moorea. Merci pour votre engagement !</p>
        </section>

        <section>
          <h4 className="font-semibold">1. Inscription en 4 étapes</h4>
          <ol className="list-decimal pl-5 text-slate-700">
            <li>Complétez votre <strong>profil</strong> (description, contact, jours de présence).</li>
            <li>Choisissez <strong>un site et pré-réservez un stand</strong> dans l&apos;onglet <em>Sites & plan</em>.</li>
            <li>Versez votre <strong>caution de 20 000 XPF</strong> à ARACOM (chèque, virement ou espèces).</li>
            <li>ARACOM <strong>confirme votre inscription</strong> et vous remet le reçu de caution.</li>
          </ol>
        </section>

        <section>
          <h4 className="font-semibold">2. Animations</h4>
          <p className="text-slate-700">Sélectionnez vos créneaux d&apos;animation (1h chacun) directement sur la grille horaire. <b>1 créneau par jour</b> obligatoire (1 max).</p>
        </section>

        <section>
          <h4 className="font-semibold">3. Documents obligatoires</h4>
          <ul className="list-disc pl-5 text-slate-700">
            <li><strong>Attestation d&apos;assurance RC</strong> couvrant votre présence (à déposer)</li>
            <li><strong>Convention</strong> signée et scannée (à déposer)</li>
            <li><strong>Reçu de caution</strong> (fourni automatiquement par ARACOM)</li>
          </ul>
        </section>

        <section>
          <h4 className="font-semibold">4. Jour J — horaires figés</h4>
          <p className="text-slate-700">Le Forum est ouvert au public <b>vendredi de 11h à 17h</b> et <b>samedi de 9h à 17h</b>, identique pour tous les sites et tous les exposants. Soyez sur place <b>1h avant l&apos;ouverture</b> pour le montage du stand.</p>
        </section>

        <section>
          <h4 className="font-semibold">5. Caution</h4>
          <p className="text-slate-700">La caution est restituée intégralement sous 2 semaines après l&apos;événement si :</p>
          <ul className="list-disc pl-5 text-slate-700">
            <li>vous êtes présent sur les jours confirmés</li>
            <li>votre stand est monté et démonté dans les horaires</li>
            <li>aucune dégradation n&apos;est constatée</li>
          </ul>
        </section>

        <div className="rounded-md bg-emerald-50 border border-emerald-200 p-4 not-prose">
          <div className="flex items-start gap-2"><Sparkles className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" /><div>
            <div className="font-semibold text-emerald-900">Merci pour votre engagement !</div>
            <p className="text-sm text-emerald-800 mt-1">Votre participation contribue au succès du Forum et à l&apos;épanouissement des familles polynésiennes. L&apos;équipe ARACOM est là pour vous accompagner.</p>
          </div></div>
        </div>
      </CardContent>
    </Card>
  );
}

// =====================================================================
// PASSWORD CHANGE
// =====================================================================
function PasswordButton__deprecated__unused({ user, onChanged }) {
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
          <Input type="password" placeholder="Actuel" value={current} onChange={e => setCurrent(e.target.value)} />
          <Input type="password" placeholder="Nouveau (6 char min)" value={next} onChange={e => setNext(e.target.value)} />
          <Input type="password" placeholder="Confirmer" value={next2} onChange={e => setNext2(e.target.value)} />
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
            <Button size="sm" onClick={submit}>OK</Button>
          </div>
        </div>
      )}
    </div>
  );
}

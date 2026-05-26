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
import BusinessCard from '@/components/exposant/business-card';
import RequestModificationDialog from '@/components/exposant/request-modification-dialog';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { FileUploadButton } from '@/components/file-upload';
import SmartVenueMap from '@/components/smart-venue-map';
import ConflictDialog from '@/components/wizard/conflict-dialog';
import { ChatbotFloating } from '@/components/chatbot-widget';
import LiveAvailabilityFloater from '@/components/exposant/live-availability-floater';
import SimulationModal from '@/components/aracom/simulation-modal';
import UrgencyBanner from '@/components/wizard/urgency-banner';
import ExposantPasswordGate, { ExposantPasswordManager } from '@/components/exposant-password-gate';
import SatisfactionSurvey from '@/components/satisfaction-survey';
import { toast } from 'sonner';
import {
  Building2, MapPin, Calendar, FileCheck2, Wallet, CheckCircle2, XCircle, Info, Mail, Phone, Clock,
  FileText, Trash2, Download, Star, Sparkles, BookOpen, KeyRound, Plus, LayoutGrid, ChevronLeft,
  ListChecks, MessageCircle, Send, Smile, Lock, AlertCircle, ShieldCheck, Truck, Loader2,
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

// Lieux d'animation — uniquement 2 options officielles
const SLOT_TYPES = [
  { value: 'sur_stand', label: 'Sur le stand',           color: 'bg-blue-50 text-blue-700' },
  { value: 'zone_demo', label: 'Zone de démonstration',  color: 'bg-violet-50 text-violet-700' },
];

// Normalise toute valeur historique vers une des 2 valeurs canoniques
const normalizeLocationType = (v) => {
  if (v === 'sur_stand' || v === 'stand') return 'sur_stand';
  if (v === 'zone_demo' || v === 'zone_animation' || v === 'scene' || v === 'spectacle') return 'zone_demo';
  return 'sur_stand';
};

export default function ExposantPortal() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('parcours');
  const [stepDeadlines, setStepDeadlines] = useState({});
  const [postEvent, setPostEvent] = useState({ unlocked: false });
  const [validationRequest, setValidationRequest] = useState(null);
  const [passwordStatus, setPasswordStatus] = useState({ has_password: false });
  const [simulationOpen, setSimulationOpen] = useState(false);
  const [allVenues, setAllVenues] = useState([]);

  // 🆕 SESSION 47 — Charge la liste des venues pour le banner d'ajout multi-site
  // 🆕 SESSION 47.10 — only_active=1 : seuls les sites activés par ARACOM sont proposés
  useEffect(() => {
    api('/api/venues?only_active=1').then(setAllVenues).catch(() => setAllVenues([]));
  }, []);

  // 🔐 Charge le statut du mot de passe (pour l'affichage du panneau de gestion)
  const loadPasswordStatus = async (orgId) => {
    if (!orgId) return;
    try {
      const s = await api(`/api/exposant/password/status?organization_id=${encodeURIComponent(orgId)}`);
      setPasswordStatus(s);
    } catch { /* ignore */ }
  };

  // Read ?tab= from URL on mount and when changed externally
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sync = () => {
      const params = new URLSearchParams(window.location.search);
      const t = params.get('tab');
      const valid = ['parcours', 'profil', 'infos', 'jourj', 'bilan'];
      if (t && valid.includes(t)) setActiveTab(t);
      // 🆕 SESSION 29 — support ?section=convention|recu|remboursement|documents
      const section = params.get('section');
      if (section) {
        // section → tab mapping : tous documents vont sur 'parcours' (étape 3 Documents)
        setActiveTab('parcours');
        // Scroll vers la section après render
        setTimeout(() => {
          const el = document.querySelector(`[data-portal-section="${section}"]`) || document.getElementById(`section-${section}`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            el.classList.add('ring-2', 'ring-aracom-orange', 'ring-offset-2', 'rounded-lg');
            setTimeout(() => el.classList.remove('ring-2', 'ring-aracom-orange', 'ring-offset-2', 'rounded-lg'), 3000);
          }
        }, 800);
      }
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
      // 🆕 SESSION 28h — Toujours sauvegarder `me` dans data pour permettre l'affichage
      // des infos du compte connecté (email, ID) dans le message d'erreur.
      if (!me.organization) {
        toast.error('Aucune organisation liée à votre compte');
        setData({ me, registration: null });
        setLoading(false);
        return;
      }
      // 🆕 MULTI-SITES : charger toutes les registrations de l'organisation
      const mySites = await api(`/api/exposant/my-sites?organization_id=${encodeURIComponent(me.organization.id)}`).catch(() => []);
      if (!Array.isArray(mySites) || mySites.length === 0) { setData({ me, registration: null }); setLoading(false); return; }
      // Sélection du site actif : ?reg=<id> dans l'URL OU priorité 1 (principal) par défaut
      const wantedRegId = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('reg') : null;
      const chosen = (wantedRegId && mySites.find(s => s.id === wantedRegId)) || mySites[0];
      const full = await api(`/api/registrations/${chosen.id}`);
      setData({ me, ...full, allSites: mySites });
      // 🔐 Statut mot de passe (pour le bandeau de gestion)
      loadPasswordStatus(me.organization.id);
      // Charge la demande de validation existante (si présente)
      try {
        const vrList = await api('/api/validation-requests');
        const myVr = (Array.isArray(vrList) ? vrList : []).find(x => x.registration_id === chosen.id);
        setValidationRequest(myVr || null);
      } catch {}
    } catch (e) { toast.error(e.message); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);
  // 🆕 SESSION 43-j — PHASE 4 : Sync admin ↔ exposant en temps réel
  //   Polling toutes les 60s pour détecter une modif ARACOM. Si updated_at change,
  //   toast d'info + rechargement automatique.
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  useEffect(() => {
    if (!data?.registration?.id) return;
    const t = setInterval(async () => {
      try {
        const r = await fetch(`/api/registrations/${data.registration.id}`, { cache: 'no-store' });
        if (!r.ok) return;
        const fresh = await r.json();
        const newUpdate = fresh?.registration?.updated_at;
        const knownUpdate = lastUpdatedAt || data?.registration?.updated_at;
        if (newUpdate && knownUpdate && new Date(newUpdate) > new Date(knownUpdate)) {
          setLastUpdatedAt(newUpdate);
          toast.info('🔔 Votre dossier a été modifié par ARACOM. Mise à jour…', { duration: 5000 });
          load();
        }
      } catch {/* ignore */}
    }, 60000);
    return () => clearInterval(t);
  }, [data?.registration?.id, lastUpdatedAt]);
  // Charge les deadlines globales définies par ARACOM (pour le compte à rebours)
  useEffect(() => {
    api('/api/step-deadlines').then(d => setStepDeadlines(d.deadlines || {})).catch(() => {});
    api('/api/post-event-status').then(s => setPostEvent(s || { unlocked: false })).catch(() => {});
  }, []);

  if (loading) return <Shell title="Mon dossier exposant" allowedRoles={['exposant']}><div className="py-20 text-center text-slate-500">Chargement…</div></Shell>;
  if (!data?.registration) {
    // 🆕 Distinguer les 2 causes possibles pour mieux orienter l'utilisateur
    const hasOrg = !!data?.me?.organization;
    const myEmail = data?.me?.user?.email || data?.me?.email;
    const myName = data?.me?.user?.full_name || data?.me?.full_name;
    const myId = data?.me?.user?.id || data?.me?.id;
    const refreshSession = async () => {
      try {
        // Force un re-fetch de /api/auth/me et /api/exposant/my-sites
        await load();
        toast.success('Session rafraîchie');
      } catch (e) { toast.error(e.message); }
    };
    const fullLogout = () => {
      try {
        localStorage.removeItem('fr26_session');
        if (typeof window !== 'undefined') window.location.href = '/';
      } catch {}
    };
    return <Shell title="Mon dossier exposant" allowedRoles={['exposant']}><Card><CardContent className="py-10 text-center">
      <Info className="w-12 h-12 mx-auto text-slate-400" />
      <p className="mt-3 font-medium text-slate-900">Votre dossier n&apos;a pas encore été initialisé</p>
      {hasOrg ? (
        <>
          <p className="text-slate-500 text-sm mt-2">
            Votre compte est lié à <b>{data.me.organization.name}</b>, mais aucune inscription au Forum 2026 n&apos;est encore enregistrée.
          </p>
          <p className="text-slate-500 text-xs mt-2">L&apos;équipe ARACOM va bientôt créer votre inscription. Vous recevrez un email quand votre dossier sera prêt.</p>
        </>
      ) : (
        <>
          <p className="text-slate-500 text-sm mt-2">
            Aucune organisation n&apos;est liée à votre compte.
          </p>
          <p className="text-slate-500 text-xs mt-2 max-w-md mx-auto">
            Si votre admin vient de lier votre compte, cliquez sur <b>« Rafraîchir ma session »</b> ci-dessous.
            Sinon, contactez ARACOM pour qu&apos;il lie votre compte à votre organisation.
          </p>
        </>
      )}
      {/* 🆕 SESSION 28h — Diagnostics du compte connecté + boutons d'action */}
      <div className="mt-5 mx-auto max-w-md text-left bg-slate-50 border border-slate-200 rounded-md p-3 text-xs space-y-1">
        <div className="font-semibold text-slate-700 mb-1 text-[11px] uppercase tracking-wider">🔍 Informations à donner à ARACOM</div>
        <div><span className="text-slate-500">Compte connecté :</span> <b className="text-slate-900">{myName || '—'}</b></div>
        <div><span className="text-slate-500">Email :</span> <b className="text-slate-900 select-all">{myEmail || '—'}</b></div>
        <div><span className="text-slate-500">Identifiant :</span> <span className="font-mono text-slate-700 select-all">{myId || '—'}</span></div>
      </div>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <Button size="sm" variant="outline" onClick={refreshSession} className="gap-1.5">
          🔄 Rafraîchir ma session
        </Button>
        <Button size="sm" variant="outline" onClick={fullLogout} className="gap-1.5">
          ↩️ Me reconnecter
        </Button>
      </div>
      <p className="text-xs text-slate-400 mt-5">
        📧 contact@aracom.pf
      </p>
    </CardContent></Card></Shell>;
  }

  const r = data.registration, o = data.organization, v = data.venue, d = data.deposit;
  const docs = data.documents || [];
  const cautionReceiptDoc = docs.find(dd => dd.document_type === 'recu_caution' && dd.status !== 'remplace');
  const refundAttestationDoc = docs.find(dd => dd.document_type === 'attestation_remboursement' && dd.status === 'valide');
  const slotsArr = data.slots || [];
  const animationsCount = slotsArr.length;
  const validationRequestId = r.validation_request_id;
  const isLocked = !!r.is_locked || !!r.candidature_locked || r.status === 'confirme';
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
      <ExposantPasswordGate
        organizationId={o?.id}
        organizationName={o?.name}
        userRole={user?.role}
      >
      <div className="space-y-6">
        {/* 🔐 Bandeau gestion mot de passe — visible seulement à l'exposant (pas en mode aperçu admin) */}
        {user?.role === 'exposant' && o?.id && (
          <ExposantPasswordManager
            organizationId={o.id}
            hasPassword={passwordStatus.has_password}
            onUpdated={() => loadPasswordStatus(o.id)}
          />
        )}

        {/* 📄 Bandeau "Mes documents officiels" — exhaustif (auto-générés + reçu) */}
        {r?.id && (
          <Card className="border-aracom-gold/40 bg-gradient-to-br from-aracom-beige-pale to-white">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-md bg-aracom-black flex items-center justify-center">
                  <FileText className="w-6 h-6 text-aracom-gold" />
                </div>
                <div className="flex-1">
                  <div className="font-serif text-lg text-aracom-black">Mes documents officiels</div>
                  <div className="text-xs text-slate-600">PDFs générés automatiquement avec vos données. Téléchargez, signez et déposez ci-dessous l&apos;assurance et la convention signée.</div>
                </div>
              </div>

              {/* Ligne 1 — PDFs auto-générés (toujours dispo) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <a
                  href={`/api/exposant/documents/convention/${r.id}`}
                  target="_blank"
                  rel="noreferrer"
                  data-portal-section="convention"
                  id="section-convention"
                  className="group flex items-center gap-3 p-3 rounded-lg bg-aracom-black text-aracom-beige-pale hover:bg-aracom-black/90 transition shadow-sm"
                  data-testid="download-convention"
                >
                  <div className="w-9 h-9 rounded-md bg-aracom-gold/20 flex items-center justify-center">
                    <FileText className="w-4 h-4 text-aracom-gold" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] uppercase tracking-wider text-aracom-gold/70">Convention</div>
                    <div className="text-sm font-medium truncate">Convention de participation</div>
                  </div>
                  <Download className="w-4 h-4 text-aracom-gold opacity-70 group-hover:opacity-100" />
                </a>

                <a
                  href={`/api/exposant/documents/guide/${r.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="group flex items-center gap-3 p-3 rounded-lg bg-aracom-gold text-aracom-black hover:bg-aracom-beige-clair transition shadow-sm"
                  data-testid="download-guide"
                >
                  <div className="w-9 h-9 rounded-md bg-aracom-black/15 flex items-center justify-center">
                    <BookOpen className="w-4 h-4 text-aracom-black" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] uppercase tracking-wider text-aracom-black/70">Guide</div>
                    <div className="text-sm font-medium truncate">Guide de l&apos;exposant</div>
                  </div>
                  <Download className="w-4 h-4 text-aracom-black opacity-70 group-hover:opacity-100" />
                </a>

                {/* Reçu de caution : visible si caution reçue (sinon état grisé) */}
                {cautionReceiptDoc ? (
                  <a
                    href={`/api/documents/${cautionReceiptDoc.id}/download`}
                    target="_blank"
                    rel="noreferrer"
                    data-portal-section="recu"
                    id="section-recu"
                    className="group flex items-center gap-3 p-3 rounded-lg bg-emerald-700 text-white hover:bg-emerald-800 transition shadow-sm"
                    data-testid="download-receipt"
                  >
                    <div className="w-9 h-9 rounded-md bg-white/15 flex items-center justify-center">
                      <Wallet className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] uppercase tracking-wider text-white/70">Reçu officiel</div>
                      <div className="text-sm font-medium truncate">Reçu de caution</div>
                    </div>
                    <Download className="w-4 h-4 opacity-70 group-hover:opacity-100" />
                  </a>
                ) : (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-100 text-slate-500 border border-dashed border-slate-300">
                    <div className="w-9 h-9 rounded-md bg-white flex items-center justify-center">
                      <Wallet className="w-4 h-4 text-slate-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] uppercase tracking-wider text-slate-400">En attente</div>
                      <div className="text-sm font-medium truncate">Reçu de caution</div>
                    </div>
                    <Lock className="w-4 h-4 text-slate-400" />
                  </div>
                )}
              </div>

              <div className="text-[11px] text-slate-500 pt-2 border-t border-aracom-gold/15">
                💡 Pour déposer votre <b>convention signée</b>, votre <b>attestation d&apos;assurance</b> ou tout autre document, allez dans l&apos;onglet
                <button
                  onClick={() => setActiveTab('docs')}
                  className="ml-1 text-aracom-orange underline-offset-4 hover:underline font-medium"
                >Documents</button>.
              </div>
            </CardContent>
          </Card>
        )}
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
            <ConfirmPresenceInlineCard
              registrationId={r.id}
              canRequest={canRequest}
              onDone={load}
            />
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

        {/* 🎯 BRIEFING EXPOSANT — Prochaine étape + résumé du restant + bouton d'action */}
        {!isLocked && <ExposantBriefing onAction={(tab, step) => {
          handleTabChange(tab);
          if (step != null && typeof window !== 'undefined') {
            // Notify ParcoursWizard via custom event to jump to specific step
            setTimeout(() => window.dispatchEvent(new CustomEvent('exposant:goto-step', { detail: { step } })), 50);
          }
        }} />}

        {/* 🆕 SESSION 47 — Bannière collante : urgence + ajout multi-site */}
        <UrgencyBanner
          organizationId={o?.id}
          currentRegistrationId={r?.id}
          existingSites={(data.allSites || []).map(s => ({
            registration_id: s.id || s.registration_id,
            venue_id: s.venue_id,
            venue_name: s.venue?.name || s.venue_name,
            is_user_priority: s.is_user_priority,
          })).filter(s => s.venue_id)}
          availableVenues={(allVenues || []).map(v => ({ id: v.id, name: v.name }))}
          onSiteAdded={(newRegId) => {
            // Bascule le portail sur la nouvelle inscription
            if (typeof window !== 'undefined') {
              const u = new URL(window.location.href);
              u.searchParams.set('reg', newRegId);
              window.location.href = u.toString();
            }
          }}
          context="portal"
        />

        {/* 🆕 SESSION 47.15 — Bandeau permanent quand l'exposant est en liste d'attente */}
        {r?.is_waitlist && (
          <div className="my-3 bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-400 rounded-lg p-4 flex items-start gap-3 shadow-sm">
            <span className="text-2xl shrink-0">⏳</span>
            <div className="flex-1 text-sm">
              <div className="font-bold text-amber-900 text-base mb-1">Vous êtes en liste d&apos;attente</div>
              <div className="text-amber-800 leading-snug">
                Votre demande sur le site <b>{v?.name || data.allSites?.find(x => x.id === r?.id)?.venue?.name || 'sélectionné'}</b>{r?.stand_code ? ` (stand ${r.stand_code})` : ''} est placée en <b>liste d&apos;attente</b>. ARACOM vous recontactera pour confirmer votre demande ou vous proposer une alternative.
              </div>
              <div className="text-xs text-amber-700 italic mt-1">Vous pouvez continuer à compléter votre dossier (animations, documents) en attendant la validation.</div>
            </div>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={handleTabChange}>
          {/* 🆕 SESSION 29 — Mon profil mis en valeur (orange) séparé visuellement des autres onglets */}
          <TabsList className="w-full flex flex-wrap gap-1 bg-transparent p-0 h-auto justify-start">
            <TabsTrigger
              value="profil"
              className="bg-white border-2 border-orange-200 data-[state=active]:border-orange-500 data-[state=active]:bg-orange-50 data-[state=active]:text-orange-700 font-bold shadow-sm hover:bg-orange-50 transition px-4 py-2 mr-2"
            >
              👤 Mon profil
            </TabsTrigger>
            <span className="hidden md:inline-block w-px bg-slate-300 mx-1 my-1" aria-hidden></span>
            <TabsTrigger value="parcours" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">🎯 Mon parcours</TabsTrigger>
            <TabsTrigger value="infos" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">📦 Infos pratiques</TabsTrigger>
            <TabsTrigger value="jourj" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">📅 Jour J</TabsTrigger>
            <TabsTrigger
              value="bilan"
              disabled={!postEvent.unlocked && user?.role !== 'aracom_admin'}
              className={`data-[state=active]:bg-white data-[state=active]:shadow-sm ${!postEvent.unlocked ? (user?.role === 'aracom_admin' ? 'border-2 border-dashed border-amber-400' : 'opacity-40 cursor-not-allowed') : ''}`}
              title={!postEvent.unlocked ? (user?.role === 'aracom_admin' ? '⚠️ Verrouillé pour les exposants — accès admin uniquement' : "Activé après l'événement par ARACOM") : ''}
            >
              ⭐ Satisfaction & Caution {!postEvent.unlocked && <span className="text-[10px] ml-1">🔒</span>}
            </TabsTrigger>
          </TabsList>

          {/* 🎯 ÉTAPE STRUCTURANTE — Mon parcours en 3 étapes */}
          <TabsContent value="parcours" className="space-y-4">
            {/* 🆕 MULTI-SITES : panneau de gestion des sites */}
            <MultiSitesPanel
              allSites={data.allSites || []}
              currentRegId={r.id}
              organizationId={o.id}
              onRefresh={load}
            />
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
            {/* 🆕 SESSION 29 — Carte de visite : aperçu rapide avec mini-badges */}
            <BusinessCard
              organization={o}
              registration={r}
              venue={v}
              slots={slotsArr}
              animationsCount={animationsCount}
              checks={checks}
              deposit={d}
              progress={completion}
              isUserPriority={r?.is_user_priority === true}
              totalSites={(data.allSites || []).length || 1}
            />
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
                      Le reçu de caution sera <b>fourni automatiquement par ARACOM</b> dans cet espace dès réception du paiement.
                    </div>
                  )}
                  {refundAttestationDoc && (
                    <a href={`/api/documents/${refundAttestationDoc.id}/download`} target="_blank" rel="noreferrer"
                       data-portal-section="remboursement" id="section-remboursement">
                      <Button size="sm" variant="outline" className="w-full gap-2 border-emerald-300 text-emerald-700 hover:bg-emerald-50">
                        <Download className="w-4 h-4" /> Attestation de remboursement de caution
                        {refundAttestationDoc.is_signed && <Badge className="bg-emerald-600 text-white text-[10px] ml-1">Signée</Badge>}
                      </Button>
                    </a>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="infos" className="space-y-4">
            {/* 📦 Section LOGISTIQUE */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">📦</span>
                <h2 className="text-lg font-semibold">Logistique de votre stand</h2>
              </div>
              <LogistiqueBlock registration={r} onRefresh={load} />
            </div>
            {/* 📚 Section GUIDE */}
            <div className="pt-4 border-t border-slate-200">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">📚</span>
                <h2 className="text-lg font-semibold">Guide pratique de l&apos;exposant</h2>
              </div>
              <GuideBlock />
            </div>
          </TabsContent>

          {/* 📅 JOUR J — Check-in / Check-out renseignés par l'agent ARACOM sur le terrain */}
          <TabsContent value="jourj" className="space-y-4">
            <JourJBlock registration={r} />
          </TabsContent>

          {/* ⭐ SATISFACTION & CAUTION — Questionnaire + RDV restitution caution (post-event) */}
          <TabsContent value="bilan" className="space-y-4">
            {(postEvent.unlocked || user?.role === 'aracom_admin') ? (
              <>
                {!postEvent.unlocked && user?.role === 'aracom_admin' && (
                  <div className="rounded-md border-2 border-dashed border-amber-400 bg-amber-50 p-3 text-xs text-amber-900 flex items-center gap-2">
                    <span className="text-lg">🔒</span>
                    <span><b>Mode admin :</b> ce contenu est actuellement <b>verrouillé pour les exposants</b>. Vous pouvez consulter, modifier les réponses et gérer la restitution de caution. Pour l&apos;ouvrir aux exposants, allez dans <b>Cockpit ARACOM &gt; Bilans &gt; Activer post-événement</b>.</span>
                  </div>
                )}
                <BilanSatisfactionView
                  registration={r}
                  organization={o}
                  deposit={d}
                />
              </>
            ) : (
              <Card>
                <CardContent className="p-12 text-center">
                  <span className="text-5xl">🔒</span>
                  <p className="text-lg font-bold mt-3">Bilan & questionnaire verrouillés</p>
                  <p className="text-sm text-slate-500 mt-2">Le questionnaire de satisfaction et la prise de RDV pour récupérer votre caution seront <b>activés par ARACOM</b> après l&apos;événement (15 août 2026). Vous serez notifié(e) par email dès que ce sera disponible.</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
      <ChatbotFloating role="exposant" />
      <LiveAvailabilityFloater />
      {/* 🆕 SESSION 47 — Bouton Simulation visible UNIQUEMENT pour aracom_admin */}
      {user?.role === 'aracom_admin' && (
        <>
          <button
            onClick={() => setSimulationOpen(true)}
            title="🧪 Simulation E2E — lancer un parcours exposant fictif (admin uniquement)"
            className="fixed bottom-24 right-4 z-40 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white text-xs font-bold px-3 py-2 shadow-lg transition-transform hover:scale-105 border-2 border-white"
          >
            🧪 Simuler parcours
          </button>
          <SimulationModal open={simulationOpen} onClose={() => setSimulationOpen(false)} />
        </>
      )}
      </ExposantPasswordGate>
    </Shell>
  );
}

// =====================================================================
// EXPOSANT STEPPER — 6 étapes visuelles du parcours d'inscription
// =====================================================================
// =====================================================================
// 🎯 PARCOURS WIZARD — Les 3 étapes structurantes (Dates / Animations / Validation)
// =====================================================================
// 🆕 MULTI-SITES — Panneau de gestion des sites de l'exposant
function MultiSitesPanel({ allSites, currentRegId, organizationId, onRefresh }) {
  const [venues, setVenues] = useState([]);
  const [venueOccupancy, setVenueOccupancy] = useState({}); // venue_id -> { used, total, isFull }
  const [maxSites, setMaxSites] = useState(3);
  const [showAdd, setShowAdd] = useState(false);
  const [addVenueId, setAddVenueId] = useState('');
  const [busy, setBusy] = useState(false);
  const [busySubmit, setBusySubmit] = useState(null); // 🆕 SESSION 28l : id du site en cours de soumission

  // 🆕 SESSION 28l — Soumettre UN SEUL site (validation_request individuel)
  const submitSingleSite = async (site) => {
    const msg = `Soumettre la candidature pour le site « ${site.venue?.name} » (stand ${site.stand_code}) ?\n\n` +
      `Ce site sera verrouillé et ARACOM vous contactera pour fixer un RDV de remise de caution (20 000 XPF).\n` +
      `Les autres sites restent modifiables.`;
    if (!window.confirm(msg)) return;
    setBusySubmit(site.id);
    try {
      await api(`/api/registrations/${site.id}/request-validation`, {
        method: 'POST',
        body: JSON.stringify({ preferred_payment: 'cheque', rdv_proposal: '', notes: '' }),
      });
      toast.success(`✅ Candidature soumise pour ${site.venue?.name}`);
      onRefresh();
    } catch (e) { toast.error(`❌ ${e.message}`); }
    finally { setBusySubmit(null); }
  };

  useEffect(() => {
    api('/api/venues?only_active=1').then(async (vs) => {
      setVenues(vs || []);
      // 🆕 SESSION 28k — Charge l'occupation de chaque site pour afficher "Complet" si plein
      const stats = {};
      await Promise.all((vs || []).map(async (v) => {
        try {
          const stands = await api(`/api/venues/${v.id}/stands`);
          const total = (stands || []).length;
          // Un stand est occupé s'il a une assignment (réservation/pré-réservation active)
          const used = (stands || []).filter(s => !!s.assignment).length;
          stats[v.id] = { used, total, isFull: total > 0 && used >= total };
        } catch { stats[v.id] = { used: 0, total: 0, isFull: false }; }
      }));
      setVenueOccupancy(stats);
    }).catch(() => {});
    api('/api/admin/exposant-limits').then(d => setMaxSites(d?.max_sites_per_exposant || 3)).catch(() => {});
  }, []);

  const usedVenueIds = new Set(allSites.map(s => s.venue_id));
  const availableVenues = venues.filter(v => !usedVenueIds.has(v.id));

  // 🆕 SESSION 33 — Critères de complétion alignés avec le backend (is_complete)
  // = dates de présence choisies + venue + 1 animation par jour choisi (PAS le stand)
  // Le flow est séquentiel : on complète le site courant AVANT d'en ajouter un nouveau.
  const allCurrentSitesComplete = allSites.length === 0 || allSites.every(s => s.is_complete);
  const incompleteSite = allSites.find(s => !s.is_complete);
  const canAddMore = allSites.length < maxSites && availableVenues.length > 0 && allCurrentSitesComplete;

  // 🆕 SESSION 35 — Pas de gel cascade : chaque site est indépendant.
  //                La priorité est désignée par l'exposant au moment de la soumission finale.
  //                Aucun site n'est ★ automatiquement.
  const switchTo = (regId) => {
    if (regId === currentRegId) return;
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('reg', regId);
      window.history.replaceState({}, '', url);
    }
    // 🆕 Pas de rechargement de page : on rafraîchit les données via le parent
    onRefresh();
  };

  const addSite = async () => {
    if (!addVenueId) return toast.error('Choisissez un site à ajouter');
    setBusy(true);
    try {
      const res = await api('/api/exposant/sites/add', {
        method: 'POST',
        body: JSON.stringify({ organization_id: organizationId, venue_id: addVenueId }),
      });
      toast.success('🎉 Nouveau site ajouté à votre inscription !');
      setShowAdd(false);
      setAddVenueId('');
      // 🆕 Bascule automatiquement sur le nouveau site pour permettre de le compléter
      const newRegId = res?.registration?.id || res?.id;
      if (newRegId && typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        url.searchParams.set('reg', newRegId);
        window.history.replaceState({}, '', url);
      }
      onRefresh();
    } catch (e) { toast.error(e.message); }
    setBusy(false);
  };

  const removeSite = async (regId, venueName) => {
    if (!confirm(`Retirer le site "${venueName}" de votre inscription ?\n\nVotre stand sera libéré et vos animations sur ce site seront supprimées. Cette action est définitive.`)) return;
    try {
      await api(`/api/exposant/sites/${regId}/remove`, { method: 'POST', body: '{}' });
      toast.success('Site retiré de votre inscription');
      if (regId === currentRegId && typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        url.searchParams.delete('reg');
        window.history.pushState({}, '', url);
      }
      onRefresh();
    } catch (e) { toast.error(e.message); }
  };

  const setPriority = async (regId, priority) => {
    try {
      await api(`/api/exposant/sites/${regId}/priority`, { method: 'POST', body: JSON.stringify({ priority }) });
      toast.success('Priorité mise à jour');
      onRefresh();
    } catch (e) { toast.error(e.message); }
  };

  return (
    <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2 text-blue-900">
          <Building2 className="w-5 h-5 text-blue-600" /> Mes sites de participation
          <Badge className="bg-blue-600 text-white">{allSites.length} / {maxSites}</Badge>
        </CardTitle>
        <p className="text-xs text-blue-800 mt-1 leading-relaxed">
          ℹ️ Vous pouvez vous inscrire sur <b>jusqu&apos;à {maxSites} site(s)</b>. Pour chaque site :
          <br />• <b>1 stand maximum</b> par site (réservé via l&apos;Étape 1 du parcours)
          <br />• <b>Au moins 1 animation par jour</b> (vendredi ET samedi) — Étape 2
          <br />• <b>Caution de 20 000 XPF par site</b> (chèque, espèces ou virement)
          <br />• Vous pouvez <b>modifier ou retirer un site</b> tant qu&apos;ARACOM n&apos;a pas reçu votre caution.
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {allSites.map((s, idx) => {
          const isActive = s.id === currentRegId;
          const isLocked = s.is_locked || s.is_deposit_received || s.candidature_locked;
          const valReq = s.validation_request;
          const canSubmit = !!s.can_submit;
          // 🆕 SESSION 35 — Le rang est par ordre de création/priorité, MAIS pas d'étoile auto.
          //                  L'étoile (★) n'apparaît que si l'exposant l'a explicitement désignée
          //                  via `is_user_priority` (champ persistant, distinct de `site_priority`).
          const siteRank = idx + 1;
          const isUserDesignatedPriority = !!s.is_user_priority;
          const isMultiSite = allSites.length > 1;
          return (
            <div key={s.id} className={`rounded-md border-2 p-3 transition ${isActive ? 'bg-white border-blue-500 shadow-sm' : 'bg-white/50 border-slate-200 hover:border-blue-300'}`}>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2 flex-1 min-w-[180px]">
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-bold ${isUserDesignatedPriority ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-slate-100 text-slate-700 border border-slate-200'}`}>
                    {isUserDesignatedPriority ? <>★ Site {siteRank}</> : <>Site {siteRank}</>}
                  </span>
                  <div className="flex-1">
                    <div className="font-semibold text-sm flex items-center gap-2 flex-wrap">
                      <span className="text-slate-900">{s.venue?.name || '— site à choisir —'}</span>
                      {isUserDesignatedPriority && <Badge className="bg-amber-500 text-white text-[10px]">★ Site prioritaire</Badge>}
                      {isActive && <Badge className="bg-blue-600 text-white text-[10px]">Actif</Badge>}
                      {isLocked && <Badge className="bg-emerald-600 text-white text-[10px]">🔒 Verrouillé</Badge>}
                      {s.is_complete && !isLocked && !valReq && <Badge className="bg-emerald-100 text-emerald-800 text-[10px]">✅ Complet</Badge>}
                      {!s.is_complete && !isLocked && <Badge className="bg-amber-100 text-amber-800 text-[10px]">⏳ À compléter</Badge>}
                      {/* 🆕 SESSION 47.15 — Badge waitlist visible en permanence sur la carte */}
                      {s.is_waitlist && <Badge className="bg-orange-100 text-orange-800 text-[10px] border-orange-300">⏳ Liste d&apos;attente</Badge>}
                      {valReq?.status === 'en_attente' && <Badge className="bg-amber-500 text-white text-[10px]">⏳ Soumis · en attente</Badge>}
                      {valReq?.status === 'rdv_fixe' && <Badge className="bg-blue-500 text-white text-[10px]">📅 RDV fixé</Badge>}
                    </div>
                    <div className="text-xs text-slate-600 mt-0.5 flex flex-wrap gap-x-3">
                      <span>Stand : <b>{s.stand_code || '— à réserver —'}</b></span>
                      <span>Anim. vendredi : {s.has_vendredi_animation ? '✅' : '⚠️'}</span>
                      <span>Anim. samedi : {s.has_samedi_animation ? '✅' : '⚠️'}</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-1 flex-wrap items-center">
                  {/* 🆕 SESSION 35 — Bouton "Désigner ★ prioritaire" (visible uniquement en multi-site) */}
                  {isMultiSite && !isLocked && !valReq && (
                    <Button
                      size="sm"
                      variant={isUserDesignatedPriority ? 'default' : 'outline'}
                      onClick={() => setPriority(s.id, isUserDesignatedPriority ? 0 : 1)}
                      className={`text-xs gap-1 h-8 ${isUserDesignatedPriority ? 'bg-amber-500 hover:bg-amber-600 text-white border-amber-500' : 'border-amber-300 text-amber-700 hover:bg-amber-50'}`}
                      title={isUserDesignatedPriority ? 'Retirer la priorité' : 'Désigner ce site comme prioritaire'}
                    >
                      {isUserDesignatedPriority ? '★ Prioritaire' : '☆ Définir prioritaire'}
                    </Button>
                  )}
                  {!isActive && (
                    <Button size="sm" variant="outline" onClick={() => switchTo(s.id)} className="text-xs gap-1 h-8">
                      → Travailler sur ce site
                    </Button>
                  )}
                  {/* 🆕 SESSION 35 — Soumettre ce site : bloqué si site incomplet (toast clair) */}
                  {/* 🆕 SESSION 47.15 — Label dynamique selon mode liste d'attente */}
                  {!isLocked && !valReq && (
                    <Button
                      size="sm"
                      onClick={() => {
                        if (!s.is_complete) {
                          toast.error(`⏳ ${s.venue?.name || 'Ce site'} est incomplet : choisissez dates + animations avant de soumettre.`);
                          return;
                        }
                        if (isMultiSite && !allSites.some(x => x.is_user_priority)) {
                          toast.error('★ Désignez d\'abord un site prioritaire (★ Définir prioritaire) avant de soumettre.');
                          return;
                        }
                        submitSingleSite(s);
                      }}
                      disabled={busySubmit === s.id}
                      className={`text-xs gap-1 h-8 ${canSubmit && (!isMultiSite || allSites.some(x => x.is_user_priority))
                        ? (s.is_waitlist ? 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white' : 'bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white')
                        : 'bg-slate-300 text-slate-600 cursor-not-allowed hover:bg-slate-300'}`}
                    >
                      {busySubmit === s.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Lock className="w-3 h-3" />}
                      {s.is_waitlist ? 'Soumettre la demande sur la liste d\'attente' : 'Soumettre ce site'}
                    </Button>
                  )}
                  {!isLocked && !valReq && allSites.length > 1 && (
                    <Button size="sm" variant="outline" onClick={() => removeSite(s.id, s.venue?.name || 'ce site')} className="text-xs gap-1 h-8 border-red-300 text-red-700 hover:bg-red-50">
                      Retirer
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {canAddMore && !showAdd && (
          <Button variant="outline" onClick={() => setShowAdd(true)} className="w-full border-dashed border-2 border-blue-300 text-blue-700 hover:bg-blue-100 gap-2">
            ➕ Ajouter un autre site ({allSites.length} sur {maxSites} utilisé{allSites.length > 1 ? 's' : ''})
          </Button>
        )}

        {/* 🆕 SESSION 33 — Message clair sur les critères de complétion mis à jour */}
        {!allCurrentSitesComplete && allSites.length < maxSites && availableVenues.length > 0 && incompleteSite && (
          <div className="text-xs text-amber-900 bg-amber-50 border-2 border-amber-200 rounded-md px-3 py-2 flex items-start gap-2">
            <span className="text-base">⏳</span>
            <div>
              <b>Complétez d&apos;abord le site « {incompleteSite.venue?.name || 'en cours'} »</b> avant d&apos;en ajouter un autre.<br />
              Il vous manque :
              {!incompleteSite.has_dates_chosen && <span className="text-red-700 font-semibold"> · jours de présence</span>}
              {incompleteSite.has_dates_chosen && !incompleteSite.animations_cover_chosen_days && incompleteSite.attending_days?.includes('vendredi') && !incompleteSite.has_vendredi_animation && <span className="text-red-700 font-semibold"> · une animation vendredi (sur stand ou zone)</span>}
              {incompleteSite.has_dates_chosen && !incompleteSite.animations_cover_chosen_days && incompleteSite.attending_days?.includes('samedi') && !incompleteSite.has_samedi_animation && <span className="text-red-700 font-semibold"> · une animation samedi (sur stand ou zone)</span>}
            </div>
          </div>
        )}

        {showAdd && (
          <div className="rounded-md border-2 border-blue-400 bg-white p-3 space-y-2">
            <div className="text-sm font-semibold text-blue-900">Choisissez un nouveau site :</div>
            <Select value={addVenueId} onValueChange={setAddVenueId}>
              <SelectTrigger><SelectValue placeholder="Sélectionner un site disponible…" /></SelectTrigger>
              <SelectContent>
                {availableVenues.map(v => {
                  const occ = venueOccupancy[v.id];
                  const isFull = occ?.isFull;
                  return (
                    <SelectItem key={v.id} value={v.id} disabled={isFull}>
                      📍 {v.name} {occ ? `(${occ.total - occ.used}/${occ.total} stands libres)` : `(${v.capacity_stands} stands)`}
                      {isFull && ' 🚫 COMPLET'}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            <p className="text-xs text-slate-600">
              💡 Une nouvelle inscription va être créée pour ce site. Vous devrez ensuite y réserver un stand et y planifier vos animations.
              <br />💰 Une caution séparée de 20 000 XPF sera demandée pour ce site.
            </p>
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="ghost" onClick={() => { setShowAdd(false); setAddVenueId(''); }} disabled={busy}>Annuler</Button>
              <Button size="sm" onClick={addSite} disabled={busy || !addVenueId} className="bg-blue-600 hover:bg-blue-700 gap-1">
                {busy ? 'Création…' : '✅ Ajouter ce site'}
              </Button>
            </div>
          </div>
        )}

        {!canAddMore && allSites.length >= maxSites && (
          <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
            🚫 Limite atteinte : vous avez utilisé les {maxSites} sites maximum autorisés par ARACOM.
          </div>
        )}
        {!canAddMore && availableVenues.length === 0 && allSites.length < maxSites && (
          <div className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-md px-3 py-2">
            Vous êtes inscrit(e) sur tous les sites disponibles.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ParcoursWizard({ registration, organization, venue, docs, slots, validationRequest, onRefresh }) {
  const r = registration;
  const isLocked = r.status === 'verrouille' || r.candidature_locked || r.is_locked || validationRequest?.status === 'verrouille';
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
// CONFIRM PRESENCE — Carte inline (pas de modal)
// Affiche le sélecteur de mode de caution + le bouton de soumission directement.
// Le bouton s'active automatiquement dès que stand + animations sont remplis.
// =====================================================================
function ConfirmPresenceInlineCard({ registrationId, canRequest, onDone }) {
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ preferred_payment: 'cheque', rdv_proposal: '', notes: '' });
  const [rib, setRib] = useState(null);
  useEffect(() => {
    api('/api/admin/rib-config').then(setRib).catch(() => {});
  }, []);
  const submit = async () => {
    setBusy(true);
    try {
      await api(`/api/registrations/${registrationId}/request-validation`, {
        method: 'POST',
        body: JSON.stringify(form),
      });
      toast.success('✅ Demande envoyée à ARACOM. Votre candidature est verrouillée et nous vous recontacterons pour fixer le RDV.');
      if (onDone) onDone();
    } catch (e) { toast.error(e.message); }
    finally { setBusy(false); }
  };
  return (
    <Card className={`border-2 ${canRequest ? 'border-violet-300 bg-gradient-to-br from-violet-50 to-blue-50' : 'border-slate-200 bg-slate-50'}`}>
      <CardContent className="p-5 space-y-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className={`w-5 h-5 ${canRequest ? 'text-violet-600' : 'text-slate-400'}`} />
            <h3 className={`text-lg font-bold ${canRequest ? 'text-violet-900' : 'text-slate-500'}`}>Soumettre ma candidature</h3>
          </div>
          <p className={`text-sm ${canRequest ? 'text-violet-800' : 'text-slate-500'}`}>
            {canRequest
              ? <>Tout est prêt ! En soumettant, votre <b>candidature sera verrouillée</b> et ARACOM vous contactera pour fixer un RDV de remise de caution (chèque, espèces ou virement, 20 000 XPF).</>
              : <>Pour activer la soumission : choisissez un <b>site + stand</b> (onglet Sites &amp; plan) et au moins <b>un créneau d&apos;animation</b> (onglet Animations).</>
            }
          </p>
          {canRequest && (
            <div className="mt-2 text-[12px] rounded-md bg-emerald-50 border border-emerald-200 px-3 py-2 text-emerald-900">
              💡 <b>Bon à savoir :</b> Aucun document (convention, assurance…) n&apos;est obligatoire pour soumettre. Vous compléterez votre dossier après la validation ARACOM.
            </div>
          )}
        </div>

        {canRequest && (
          <>
            {/* Sélecteur de mode de caution — inline */}
            <div>
              <Label className="text-sm font-semibold">Mode de caution préféré (20 000 XPF)</Label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
                {[
                  { v: 'cheque', label: '💳 Chèque', desc: "À l'ordre d'ARACOM" },
                  { v: 'especes', label: '💵 Espèces', desc: 'Remise en main propre' },
                  { v: 'virement', label: '🏦 Virement', desc: 'Bancaire (RIB ci-dessous)' },
                ].map(o => (
                  <button key={o.v} type="button" onClick={() => setForm({ ...form, preferred_payment: o.v })}
                    className={`border-2 rounded-md p-3 text-left transition ${form.preferred_payment === o.v ? 'border-violet-500 bg-white shadow-sm' : 'border-slate-200 bg-white/60 hover:border-slate-300'}`}>
                    <div className="font-semibold text-sm">{o.label}</div>
                    <div className="text-xs text-slate-500">{o.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {form.preferred_payment === 'virement' && rib && (
              <div className="rounded-md bg-blue-50 border-2 border-blue-200 p-3 text-xs space-y-1">
                <div className="font-bold text-blue-900 flex items-center gap-2">🏦 Coordonnées bancaires ARACOM</div>
                <div className="grid grid-cols-2 gap-2 mt-2 font-mono text-[11px]">
                  <div><span className="text-slate-500">Titulaire :</span> <b className="text-blue-900">{rib.titulaire || '—'}</b></div>
                  <div><span className="text-slate-500">Banque :</span> <b className="text-blue-900">{rib.banque || '—'}</b></div>
                  <div className="col-span-2"><span className="text-slate-500">IBAN :</span> <b className="text-blue-900 select-all">{rib.iban || '—'}</b></div>
                  <div><span className="text-slate-500">BIC :</span> <b className="text-blue-900 select-all">{rib.bic || '—'}</b></div>
                </div>
                <div className="mt-2 pt-2 border-t border-blue-200"><span className="text-slate-500">Référence à indiquer :</span> <b className="text-blue-900">{rib.reference || '—'}</b></div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-sm">Vos disponibilités pour le RDV (facultatif)</Label>
                <Input
                  value={form.rdv_proposal}
                  onChange={(e) => setForm({ ...form, rdv_proposal: e.target.value })}
                  placeholder="Ex : matin, en semaine, après 17h…"
                />
              </div>
              <div>
                <Label className="text-sm">Notes pour ARACOM (facultatif)</Label>
                <Input
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Information utile…"
                />
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <Button
                size="lg"
                disabled={busy}
                onClick={submit}
                className="bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 gap-2 shadow-lg"
                data-testid="submit-candidature"
              >
                <Lock className="w-5 h-5" /> {busy ? 'Envoi…' : 'Soumettre ma candidature'}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// =====================================================================
// CONFIRM PRESENCE — bouton + modale (envoi demande de validation) — DEPRECATED
// Conservé pour compatibilité, mais remplacé par ConfirmPresenceInlineCard.
// =====================================================================
function ConfirmPresenceButton({ registrationId, disabled, onDone }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ preferred_payment: 'cheque', rdv_proposal: '', notes: '' });
  const [rib, setRib] = useState(null);
  useEffect(() => {
    // Charge le RIB ARACOM pour affichage si virement sélectionné
    api('/api/admin/rib-config').then(setRib).catch(() => {});
  }, []);
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
          <Card className="max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Lock className="w-5 h-5 text-violet-600" /> Confirmer ma présence</CardTitle>
              <p className="text-sm text-slate-600">Votre site, votre stand et vos créneaux d&apos;animation seront <b>verrouillés définitivement</b> par ARACOM dès que la caution sera réceptionnée.</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm font-semibold">Mode de caution préféré (20 000 XPF)</Label>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {[
                    { v: 'cheque', label: '💳 Chèque', desc: "À l'ordre d'ARACOM" },
                    { v: 'especes', label: '💵 Espèces', desc: 'Remise en main propre' },
                    { v: 'virement', label: '🏦 Virement', desc: 'Bancaire (RIB ci-dessous)' },
                  ].map(o => (
                    <button key={o.v} type="button" onClick={() => setForm({ ...form, preferred_payment: o.v })}
                      className={`border-2 rounded-md p-3 text-left transition ${form.preferred_payment === o.v ? 'border-violet-500 bg-violet-50' : 'border-slate-200 hover:border-slate-300'}`}>
                      <div className="font-semibold text-sm">{o.label}</div>
                      <div className="text-xs text-slate-500">{o.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
              {form.preferred_payment === 'virement' && rib && (
                <div className="rounded-md bg-blue-50 border-2 border-blue-200 p-3 text-xs space-y-1">
                  <div className="font-bold text-blue-900 flex items-center gap-2">🏦 Coordonnées bancaires ARACOM</div>
                  <div className="grid grid-cols-2 gap-2 mt-2 font-mono text-[11px]">
                    <div><span className="text-slate-500">Titulaire :</span> <b className="text-blue-900">{rib.titulaire || '—'}</b></div>
                    <div><span className="text-slate-500">Banque :</span> <b className="text-blue-900">{rib.banque || '—'}</b></div>
                    <div className="col-span-2"><span className="text-slate-500">IBAN :</span> <b className="text-blue-900 select-all">{rib.iban || '—'}</b></div>
                    <div><span className="text-slate-500">BIC :</span> <b className="text-blue-900 select-all">{rib.bic || '—'}</b></div>
                  </div>
                  <div className="mt-2 pt-2 border-t border-blue-200"><span className="text-slate-500">Référence à indiquer :</span> <b className="text-blue-900">{rib.reference || '—'}</b></div>
                  <div className="text-[10px] text-slate-500 italic">Le RIB officiel ARACOM vous sera envoyé en pièce jointe lors de la confirmation de votre demande.</div>
                </div>
              )}
              {form.preferred_payment === 'virement' && !rib && (
                <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900">
                  ℹ️ Le RIB ARACOM vous sera communiqué par email après l&apos;envoi de votre demande.
                </div>
              )}
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
                <b>📌 Modes acceptés :</b> chèque, espèces ou virement bancaire (20 000 XPF).
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
// 🆕 Carte spécifique pour le mode VIREMENT — l'exposant déclare la date + référence
function VirementDeclarationCard({ vreq, onRefresh }) {
  const [rib, setRib] = useState(null);
  const [form, setForm] = useState({ virement_reference: '', virement_date: new Date().toISOString().slice(0, 10) });
  const [busy, setBusy] = useState(false);
  const [declared, setDeclared] = useState(false);

  useEffect(() => {
    api('/api/admin/rib-config').then(setRib).catch(() => {});
    api(`/api/registrations/${vreq.registration_id}`).then(d => {
      if (d?.deposit?.virement_declared_at || d?.deposit?.virement_reference) {
        setDeclared(true);
        setForm({
          virement_reference: d.deposit.virement_reference || '',
          virement_date: d.deposit.virement_date || new Date().toISOString().slice(0, 10),
        });
      }
    }).catch(() => {});
  }, [vreq.registration_id]);

  const submit = async () => {
    if (!form.virement_reference.trim()) return toast.error('Référence du virement requise');
    if (!form.virement_date) return toast.error('Date du virement requise');
    setBusy(true);
    try {
      await api(`/api/exposant/declare-virement/${vreq.registration_id}`, {
        method: 'POST',
        body: JSON.stringify(form),
      });
      toast.success('✅ Virement déclaré — ARACOM a été notifié(e). Vous recevrez votre reçu dès validation.');
      setDeclared(true);
      if (onRefresh) onRefresh();
    } catch (e) { toast.error(e.message); }
    setBusy(false);
  };

  return (
    <Card className="border-2 border-blue-300 bg-gradient-to-br from-blue-50 to-cyan-50">
      <CardContent className="p-5 space-y-3">
        <div className="flex items-center gap-3">
          <div className="text-3xl">🏦</div>
          <div>
            <div className="font-bold text-blue-900 text-lg">Caution par virement bancaire</div>
            <p className="text-sm text-blue-800 mt-0.5">
              {declared
                ? '✅ Vous avez déclaré votre virement. ARACOM en a été notifié(e) et validera dès réception sur le compte.'
                : 'Effectuez le virement de 20 000 XPF avec les coordonnées ci-dessous, puis déclarez-le pour notifier ARACOM.'}
            </p>
          </div>
        </div>

        {rib && (
          <div className="rounded-md bg-white border-2 border-blue-200 p-3 text-xs space-y-1">
            <div className="font-bold text-blue-900 flex items-center gap-2">🏦 Coordonnées bancaires ARACOM</div>
            <div className="grid grid-cols-2 gap-2 mt-2 font-mono text-[11px]">
              <div><span className="text-slate-500">Titulaire :</span> <b className="text-blue-900">{rib.titulaire || '—'}</b></div>
              <div><span className="text-slate-500">Banque :</span> <b className="text-blue-900">{rib.banque || '—'}</b></div>
              <div className="col-span-2"><span className="text-slate-500">IBAN :</span> <b className="text-blue-900 select-all">{rib.iban || '—'}</b></div>
              <div><span className="text-slate-500">BIC :</span> <b className="text-blue-900 select-all">{rib.bic || '—'}</b></div>
            </div>
            <div className="mt-2 pt-2 border-t border-blue-200"><span className="text-slate-500">Référence à indiquer :</span> <b className="text-blue-900">{rib.reference || '—'}</b></div>
            <div className="mt-2 pt-2 border-t border-blue-200 text-[10px] text-slate-500 italic">
              💡 Le montant à virer est de <b>20 000 XPF</b>. Indiquez bien la référence ci-dessus pour faciliter l&apos;identification.
            </div>
          </div>
        )}

        <div className="rounded-md bg-white border-2 border-blue-300 p-3 space-y-2">
          <div className="font-semibold text-sm text-blue-900">
            {declared ? '📝 Détails de votre virement' : '📝 Déclarez votre virement'}
          </div>
          <div className="grid sm:grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Référence / N° du virement *</Label>
              <Input value={form.virement_reference} onChange={e => setForm({ ...form, virement_reference: e.target.value })} placeholder="Ex : VIR-20260815-001 ou n° opération bancaire" className="text-xs font-mono" disabled={busy} />
            </div>
            <div>
              <Label className="text-xs">Date du virement *</Label>
              <Input type="date" value={form.virement_date} onChange={e => setForm({ ...form, virement_date: e.target.value })} className="text-xs" disabled={busy} />
            </div>
          </div>
          {!declared ? (
            <Button onClick={submit} disabled={busy} className="w-full bg-blue-600 hover:bg-blue-700 gap-2">
              {busy ? 'Envoi…' : '✅ Déclarer mon virement et notifier ARACOM'}
            </Button>
          ) : (
            <Button onClick={submit} disabled={busy} variant="outline" className="w-full border-blue-300 text-blue-700 hover:bg-blue-50 gap-2">
              {busy ? 'Mise à jour…' : '🔄 Mettre à jour mes informations de virement'}
            </Button>
          )}
        </div>

        <div className="text-[11px] text-blue-700 italic bg-blue-100/50 rounded px-2 py-1.5">
          ℹ️ Aucun rendez-vous physique n&apos;est nécessaire pour le virement. ARACOM vérifie la réception sur son compte bancaire, valide votre caution, et vous fournit automatiquement votre <b>reçu de caution</b> dans cet espace.
        </div>
      </CardContent>
    </Card>
  );
}

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
  const paymentLabel = vreq.preferred_payment === 'especes' ? 'Espèces' : (vreq.preferred_payment === 'virement' ? 'Virement bancaire' : 'Chèque');
  const isVirement = vreq.preferred_payment === 'virement';

  // 🆕 Cas spécial : VIREMENT — pas de RDV physique, juste une déclaration
  if (isVirement && status === 'en_attente') {
    return <VirementDeclarationCard vreq={vreq} onRefresh={() => location.reload()} />;
  }

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
    discipline_other: organization.discipline_other || '',
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
          discipline_other: form.discipline === 'Autre' ? form.discipline_other : '',
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
            {form.discipline === 'Autre' && (
              <Input
                className="mt-2"
                placeholder="Précisez votre discipline…"
                value={form.discipline_other}
                onChange={e => setForm({ ...form, discipline_other: e.target.value })}
              />
            )}
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
// SITES & PLAN — un seul site, sélection rapide d'un stand libre OU rejoindre la liste d'attente
// =====================================================================
function SiteAndStandPicker({ registration, organization, onRefresh }) {
  const [venues, setVenues] = useState([]);
  const [stands, setStands] = useState([]);
  const [selectedVenueId, setSelectedVenueId] = useState(registration.venue_id || '');
  const [busy, setBusy] = useState(false);
  // 🆕 SESSION 47.15 — Popup conflit pour rejoindre une waitlist sur un stand pris
  const [conflictInfo, setConflictInfo] = useState(null); // {stand, conflict_response}
  const [conflictBusy, setConflictBusy] = useState(false);

  // 🆕 SESSION 47.15 — Filtre `?only_active=1` pour ne montrer QUE les sites actifs aux exposants
  useEffect(() => { api('/api/venues?only_active=1').then(setVenues); }, []);
  useEffect(() => {
    if (selectedVenueId) api(`/api/venues/${selectedVenueId}/stands`).then(setStands);
    else setStands([]);
  }, [selectedVenueId]);

  const venue = venues.find(v => v.id === selectedVenueId);
  const myStandCode = registration.stand_code;
  const isOnSelectedVenue = registration.venue_id === selectedVenueId;
  const isLocked = registration.status === 'confirme';

  // 🆕 SESSION 47.15 — Helpers pour classer les stands
  const isStandFree = (s) => !s.assignment || ['annule', 'cancelled'].includes(s.assignment.status);
  const isStandValidated = (s) => s.assignment?.request_status === 'validated';
  const isStandClickable = (s) => !isStandValidated(s);

  const reserve = async (stand, forceWaitlist = false) => {
    if (isLocked) { toast.error('Stand confirmé — contactez ARACOM pour changer'); return; }
    if (!isStandClickable(stand)) { toast.error(`Stand ${stand.stand_code} verrouillé par ARACOM`); return; }
    if (forceWaitlist) setConflictBusy(true); else setBusy(true);
    try {
      const r = await api(`/api/registrations/${registration.id}/pre-reserve-stand`, {
        method: 'POST',
        body: JSON.stringify({ stand_id: stand.id, force_waitlist: forceWaitlist || undefined }),
      });
      if (r && r.conflict === true && !forceWaitlist) {
        setConflictInfo({ stand, response: r });
        return;
      }
      const rs = r?.request_status;
      if (rs === 'waitlist') {
        toast.success(`⏳ Inscrit en liste d'attente sur le stand ${stand.stand_code} (position #${r?.waitlist_position || '?'}). ARACOM tranchera.`);
      } else {
        toast.success(`📋 Stand ${stand.stand_code} demandé — en attente de validation ARACOM.`);
      }
      setConflictInfo(null);
      onRefresh();
    } catch (e) { toast.error(e.message); }
    finally { setBusy(false); setConflictBusy(false); }
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
  const freeStands = stands.filter(isStandFree);
  // 🆕 SESSION 47.15 — Stands rejoignables en waitlist (taken mais pas validated)
  const waitlistableStands = stands.filter(s => !isStandFree(s) && isStandClickable(s));
  const myStand = stands.find(s => s.stand_code === myStandCode && isOnSelectedVenue);
  const siteIsFull = selectedVenueId && stands.length > 0 && freeStands.length === 0;
  // Récupère la deadline pour le message waitlist
  const [deadline, setDeadline] = useState(null);
  useEffect(() => {
    api('/api/admin/validation-deadline').then(r => setDeadline(r?.deadline_at || null)).catch(() => setDeadline(null));
  }, []);
  const deadlineLabel = deadline ? new Date(deadline).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' }) : null;

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
          {isLocked && (
            <div className="rounded-md p-2.5 bg-emerald-50 border border-emerald-200 space-y-2">
              <p className="text-xs text-emerald-800">🔒 Inscription confirmée — votre bloc réservation est verrouillé.</p>
              <RequestModificationDialog
                registrationId={registration.id}
                triggerLabel="Demander une modification"
                triggerClass="border-blue-400 text-blue-700 hover:bg-blue-50 w-full sm:w-auto"
                context="site"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* 🆕 SESSION 47.15 — Bandeau SITE COMPLET avec proposition liste d'attente */}
      {siteIsFull && !myStand && (
        <Card className="border-2 border-amber-400 bg-amber-50">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-start gap-3">
              <span className="text-3xl shrink-0">⏳</span>
              <div className="flex-1">
                <div className="font-bold text-amber-900 text-base mb-1">{venue?.name} est complet — Inscrivez-vous en liste d&apos;attente</div>
                <div className="text-sm text-amber-800 leading-snug">
                  Tous les stands de ce site sont actuellement demandés ou validés par d&apos;autres exposants. Vous pouvez :
                </div>
                <ul className="list-disc ml-5 mt-2 text-sm text-amber-900 space-y-1">
                  <li><b>Choisir un autre site</b> dans le sélecteur ci-dessus (s&apos;il en reste de disponibles).</li>
                  <li><b>Cliquer sur un stand ci-dessous</b> pour rejoindre sa liste d&apos;attente — vous serez automatiquement promu(e) si l&apos;exposant en attente est refusé.</li>
                </ul>
                {deadlineLabel && (
                  <div className="mt-3 bg-white border border-amber-300 rounded p-2 text-xs text-slate-800">
                    📅 <b>ARACOM recontactera les exposants en liste d&apos;attente au plus tard le {deadlineLabel}</b> pour confirmer ou proposer une alternative.
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Current stand status */}
      {selectedVenueId && (
        <Card className={myStand ? (registration.is_waitlist ? 'border-amber-300 bg-amber-50/40' : 'border-blue-200 bg-blue-50/40') : 'border-slate-200'}>
          <CardContent className="p-4 flex flex-col md:flex-row md:items-center gap-3">
            {myStand ? (
              <>
                <CheckCircle2 className={`w-5 h-5 shrink-0 ${registration.is_waitlist ? 'text-amber-600' : 'text-blue-600'}`} />
                <div className="flex-1">
                  <div className="font-semibold">
                    {registration.is_waitlist ? '⏳ En liste d\'attente — Stand : ' : 'Stand pré-réservé : '}
                    <span className={`font-mono ${registration.is_waitlist ? 'text-amber-700' : 'text-blue-700'}`}>{myStandCode}</span>
                  </div>
                  <div className="text-xs text-slate-600">
                    {venue?.name} • {registration.status === 'confirme' ? 'Confirmé par ARACOM ✅' : (registration.is_waitlist ? 'ARACOM tranchera selon les disponibilités' : 'En attente de validation ARACOM ⏳')}
                  </div>
                </div>
                {!isLocked && <Button variant="outline" size="sm" onClick={release} disabled={busy} className="gap-1.5"><Trash2 className="w-3.5 h-3.5" /> Libérer</Button>}
              </>
            ) : (
              <>
                <Info className="w-5 h-5 text-slate-500 shrink-0" />
                <div className="flex-1 text-sm text-slate-600">Vous n&apos;avez pas encore choisi de stand sur ce site. {siteIsFull ? 'Cliquez sur un stand pour rejoindre sa liste d\'attente.' : 'Cliquez sur un stand libre ci-dessous pour le pré-réserver.'}</div>
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

      {/* 🆕 SESSION 47.15 — Stands rejoignables en waitlist (visibles surtout quand site complet) */}
      {selectedVenueId && !isLocked && !myStand && waitlistableStands.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <LayoutGrid className="w-4 h-4 text-amber-600" /> Rejoindre une liste d&apos;attente
            </CardTitle>
            <p className="text-xs text-slate-500 mt-1">
              {waitlistableStands.length} stand(s) déjà demandé(s) sur {venue?.name}. Cliquez pour rejoindre la liste d&apos;attente correspondante. Si l&apos;exposant en attente est refusé, vous serez automatiquement promu(e).
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
              {waitlistableStands.map(s => {
                const rs = s.assignment?.request_status;
                const owner = s.organization?.name?.slice(0, 12) || 'Pris';
                const wpos = s.assignment?.waitlist_position;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => reserve(s)}
                    disabled={busy || conflictBusy}
                    className="border-2 border-amber-300 bg-amber-50 hover:bg-amber-100 hover:border-amber-500 rounded-md p-2 text-center transition disabled:opacity-50"
                    title={`Stand ${s.stand_code} — demandé par ${s.organization?.name || 'un autre exposant'} (${rs === 'waitlist' ? `liste d'attente${wpos ? ` #${wpos}` : ''}` : 'en attente de validation'}). Cliquez pour rejoindre sa file.`}
                  >
                    <div className="font-mono font-bold text-amber-700">{s.stand_code}</div>
                    <div className="text-[10px] text-amber-700 truncate">⏳ {owner}</div>
                  </button>
                );
              })}
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
            <SmartVenueMap stands={stands} venue={venue} highlightStandCode={isOnSelectedVenue ? myStandCode : null} onStandClick={!isLocked ? (st) => reserve(st) : null} />
          </CardContent>
        </Card>
      )}

      {/* 🆕 SESSION 47.15 — Popup conflit pour rejoindre une waitlist */}
      <ConflictDialog
        open={!!conflictInfo}
        onClose={() => setConflictInfo(null)}
        kind="stand"
        conflicts={conflictInfo?.response}
        standCode={conflictInfo?.stand?.stand_code}
        submitting={conflictBusy}
        onConfirmWaitlist={() => reserve(conflictInfo?.stand, true)}
      />
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
  const standSlotsByDay = (day) => allSlots.filter(s => s.day_label === day && normalizeLocationType(s.location_type) === 'sur_stand');
  const demoSlotsByDay = (day) => allSlots.filter(s => s.day_label === day && normalizeLocationType(s.location_type) === 'zone_demo');
  const myCountForDay = (day) => allSlots.filter(s => s.day_label === day && s.registration_id === registrationId).length;

  const standMine = (day, slot) => standSlotsByDay(day).find(s => s.start_time === slot.start && s.end_time === slot.end && s.registration_id === registrationId);
  const demoBookings = (day, slot) => demoSlotsByDay(day).filter(s => s.start_time === slot.start && s.end_time === slot.end);
  const demoMine = (day, slot) => demoBookings(day, slot).find(s => s.registration_id === registrationId);
  const demoOccupiedBy = (day, slot) => demoBookings(day, slot).find(s => s.registration_id !== registrationId);

  const startBooking = (day, slot, location_type) => {
    const loc = normalizeLocationType(location_type);
    if (loc === 'zone_demo' && demoOccupiedBy(day, slot)) {
      toast.error(`Créneau déjà réservé par ${demoOccupiedBy(day, slot).organization_name}`);
      return;
    }
    if (myCountForDay(day) >= MAX_ANIMATION_SLOTS_PER_DAY) {
      toast.error(`Vous avez atteint la limite de ${MAX_ANIMATION_SLOTS_PER_DAY} créneaux/jour`);
      return;
    }
    setEditing({ day, start: slot.start, end: slot.end, location_type: loc });
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
          duration_minutes: editing.location_type === 'zone_demo' ? 30 : 60,
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
                      onClick={() => startBooking(d.label, slot, 'sur_stand')}
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
                      onClick={() => startBooking(d.label, slot, 'zone_demo')}
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
                {editing.location_type === 'sur_stand' ? <span className="w-3 h-3 rounded-full bg-blue-500" /> : <span className="w-3 h-3 rounded-full bg-orange-500" />}
                Réserver {editing.start} → {editing.end}
              </CardTitle>
              <p className="text-xs text-slate-500 mt-1">{EVENT_DATES.find(d => d.label === editing.day)?.display} · {editing.location_type === 'sur_stand' ? 'Sur votre stand' : 'Zone de démonstration'}</p>
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
                <Button onClick={submitBooking} disabled={busy} className={`gap-2 ${editing.location_type === 'sur_stand' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-orange-600 hover:bg-orange-700'}`}><CheckCircle2 className="w-4 h-4" /> {busy ? 'Réservation…' : 'Réserver'}</Button>
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
  const cautionReceipt = docs.find(d => d.document_type === 'recu_caution' && d.status !== 'remplace');
  const refundAttestation = docs.find(d => d.document_type === 'attestation_remboursement' && d.status === 'valide');
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

      {/* 🆕 Reçu de caution — INFO ONLY */}
      <Card className={cautionReceipt ? 'border-emerald-200 bg-emerald-50/30' : 'border-amber-200 bg-amber-50/30'}>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Wallet className="w-4 h-4 text-blue-600" />
            Reçu de caution {cautionReceipt ? <Badge className="bg-emerald-600 text-white text-[10px]">Disponible</Badge> : <Badge variant="secondary" className="text-[10px]">En attente</Badge>}
          </CardTitle>
          <p className="text-xs text-slate-500 mt-1">📌 Ce document est <b>généré automatiquement</b> par ARACOM dès réception de votre caution.</p>
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

      {/* 🆕 Attestation de remboursement de caution — généré post-questionnaire */}
      {refundAttestation && (
        <Card className="border-2 border-emerald-300 bg-gradient-to-br from-emerald-50 to-teal-50">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-emerald-900">
              <FileCheck2 className="w-4 h-4 text-emerald-600" />
              Attestation de remboursement de caution
              {refundAttestation.is_signed
                ? <Badge className="bg-emerald-600 text-white text-[10px]">Signée ARACOM</Badge>
                : <Badge variant="secondary" className="bg-amber-100 text-amber-900 text-[10px]">En attente de signature</Badge>}
            </CardTitle>
            <p className="text-xs text-emerald-800 mt-1">
              📌 Document généré <b>automatiquement</b> après votre questionnaire de satisfaction.
              {!refundAttestation.is_signed && <> ARACOM déposera ici la version signée par les deux parties.</>}
            </p>
          </CardHeader>
          <CardContent>
            <a href={`/api/documents/${refundAttestation.id}/download`} target="_blank" rel="noreferrer">
              <Button className="w-full bg-emerald-600 hover:bg-emerald-700 gap-2"><Download className="w-4 h-4" /> Télécharger l&apos;attestation</Button>
            </a>
          </CardContent>
        </Card>
      )}
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
          <div className="rounded-md bg-amber-50 border border-amber-200 p-2.5 flex items-start gap-2 text-xs text-amber-900">
            <span className="text-base shrink-0">ℹ️</span>
            <span><b>ARACOM reviendra vers vous</b> pour confirmer la faisabilité de votre demande après étude avec Pacific Centers. Vous serez recontacté(e) par email.</span>
          </div>
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
  const [aiBusy, setAiBusy] = useState(false);

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

  const enrichWithAi = async () => {
    // Vérifier qu'au moins quelques notes ont été données
    const totalRated = (form.overall_rating ? 1 : 0) + (form.organization_rating ? 1 : 0) + (form.stand_rating ? 1 : 0) + (form.visitors_rating ? 1 : 0) + (form.communication_rating ? 1 : 0);
    if (totalRated < 2) {
      toast.error('Notez au moins 2 critères avant de demander à l\'IA de rédiger.');
      return;
    }
    const hasText = form.positive_points || form.improvement_points || form.free_comment;
    setAiBusy(true);
    try {
      const r = await api('/api/satisfaction/ai-enrich', {
        method: 'POST',
        body: JSON.stringify({
          registration_id: registration.id,
          ratings: {
            overall: form.overall_rating,
            organization: form.organization_rating,
            stand: form.stand_rating,
            visitors: form.visitors_rating,
            communication: form.communication_rating,
          },
          nps_score: form.nps_score,
          will_participate_next: form.will_participate_next,
          current_text: {
            positive: form.positive_points,
            improvement: form.improvement_points,
            free: form.free_comment,
          },
          mode: hasText ? 'enrich' : 'draft',
        }),
      });
      setForm(prev => ({
        ...prev,
        positive_points: r.positive_points || prev.positive_points,
        improvement_points: r.improvement_points || prev.improvement_points,
        free_comment: r.free_comment || prev.free_comment,
      }));
      toast.success(hasText ? '✨ Vos commentaires ont été enrichis !' : '✨ Premier jet généré — libre à vous de modifier !');
    } catch (e) {
      toast.error(`Erreur IA : ${e.message}`);
    } finally { setAiBusy(false); }
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
        <CardHeader>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="text-base">Vos commentaires</CardTitle>
              <p className="text-xs text-slate-500 mt-1">Vos retours nous aident à améliorer la prochaine édition.</p>
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={isLocked || isPendingReview || aiBusy}
              onClick={enrichWithAi}
              className="gap-1.5 border-violet-300 text-violet-700 hover:bg-violet-50"
              data-testid="satisfaction-ai-enrich"
            >
              <Sparkles className={`w-3.5 h-3.5 ${aiBusy ? 'animate-spin' : ''}`} />
              {aiBusy ? 'IA en cours…' : ((form.positive_points || form.improvement_points || form.free_comment) ? '✨ Enrichir avec l\'IA' : '✨ M\'aider à rédiger')}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div><Label>Points positifs</Label><Textarea rows={3} disabled={isLocked || isPendingReview} value={form.positive_points} onChange={e => setForm({ ...form, positive_points: e.target.value })} placeholder="Ce qui a particulièrement bien fonctionné…" /></div>
          <div><Label>À améliorer</Label><Textarea rows={3} disabled={isLocked || isPendingReview} value={form.improvement_points} onChange={e => setForm({ ...form, improvement_points: e.target.value })} placeholder="Suggestions pour améliorer le Forum…" /></div>
          <div><Label>Commentaire libre</Label><Textarea rows={3} disabled={isLocked || isPendingReview} value={form.free_comment} onChange={e => setForm({ ...form, free_comment: e.target.value })} placeholder="Toute remarque libre…" /></div>
          {!isLocked && !isPendingReview && (
            <p className="text-[11px] text-slate-500 italic">💡 L&apos;IA s&apos;appuie sur vos notes ci-dessus pour proposer un texte cohérent. Vous restez libre de tout modifier ensuite.</p>
          )}
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
// 🎯 EXPOSANT BRIEFING — Prochaine étape + résumé du restant + bouton d'action
// Remplace les anciennes "suggestions" statiques. Auto-calculé côté backend.
// =====================================================================
function ExposantBriefing({ onAction }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const load = async () => {
    setLoading(true);
    try {
      const r = await api('/api/exposant/briefing');
      setData(r);
    } catch (e) {
      console.error('[exposant briefing]', e?.message);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  if (loading && !data) {
    return (
      <Card className="border-slate-200 bg-slate-50">
        <CardContent className="p-4 text-sm text-slate-500">⏳ Calcul de votre prochaine étape…</CardContent>
      </Card>
    );
  }
  if (!data) return null;

  const { progress, next_step, remaining, urgences, completed } = data;

  // Cas : tout est terminé
  if (completed) {
    return (
      <Card className="border-emerald-300 bg-gradient-to-br from-emerald-50 to-teal-50">
        <CardContent className="p-5 flex items-center gap-4">
          <div className="text-4xl">🎉</div>
          <div className="flex-1">
            <div className="text-lg font-bold text-emerald-900">Bravo, votre dossier est complet à 100% !</div>
            <p className="text-sm text-emerald-800">Toutes les étapes sont franchies. ARACOM va valider votre inscription. Vous recevrez la confirmation par email.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const urgencyColors = {
    overdue: { bg: 'from-red-50 to-rose-50', border: 'border-red-300', text: 'text-red-900', accent: 'bg-red-600 hover:bg-red-700', emoji: '🚨' },
    critical: { bg: 'from-orange-50 to-amber-50', border: 'border-orange-300', text: 'text-orange-900', accent: 'bg-orange-600 hover:bg-orange-700', emoji: '⏰' },
    warning: { bg: 'from-amber-50 to-yellow-50', border: 'border-amber-300', text: 'text-amber-900', accent: 'bg-amber-600 hover:bg-amber-700', emoji: '⚠️' },
    normal: { bg: 'from-blue-50 to-indigo-50', border: 'border-blue-300', text: 'text-blue-900', accent: 'bg-blue-600 hover:bg-blue-700', emoji: '🎯' },
  };
  const u = urgencyColors[next_step?.urgency || 'normal'];

  let deadlineLabel = '';
  if (next_step?.days_remaining != null) {
    if (next_step.days_remaining < 0) deadlineLabel = `Échéance dépassée de ${Math.abs(next_step.days_remaining)} jour(s)`;
    else if (next_step.days_remaining === 0) deadlineLabel = "🚨 Échéance AUJOURD'HUI";
    else deadlineLabel = `À faire dans ${next_step.days_remaining} jour(s)`;
  }

  return (
    <Card className={`border-2 ${u.border} bg-gradient-to-br ${u.bg} shadow-md`}>
      <CardContent className="p-5">
        {/* Header avec progression */}
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{u.emoji}</span>
            <div>
              <div className={`text-xs font-bold uppercase tracking-wide ${u.text}`}>Votre prochaine étape</div>
              <div className="text-[10px] text-slate-500">{progress.completed}/{progress.total} étapes terminées · {progress.percent}%</div>
            </div>
          </div>
          <div className="flex-1 max-w-xs ml-auto">
            <div className="h-2 bg-white/60 rounded-full overflow-hidden">
              <div className={`h-full transition-all ${u.accent.split(' ')[0]}`} style={{ width: `${progress.percent}%` }} />
            </div>
          </div>
        </div>

        {/* Next step principal */}
        <div className="bg-white/70 backdrop-blur rounded-lg p-4 mb-3">
          <div className={`text-lg font-bold ${u.text} mb-1`}>{next_step?.label}</div>
          {deadlineLabel && (
            <div className={`text-xs font-semibold ${u.text} mb-2 inline-block px-2 py-0.5 rounded bg-white/70`}>
              📅 {deadlineLabel}
            </div>
          )}
          <p className="text-sm text-slate-700 mb-3">{next_step?.why}</p>
          <Button
            onClick={() => onAction(next_step?.target_tab, next_step?.target_step)}
            className={`${u.accent} text-white gap-2`}
          >
            {next_step?.action_label} →
          </Button>
        </div>

        {/* Reste à faire (compact) */}
        {remaining.length > 1 && (
          <details className="text-sm">
            <summary className="cursor-pointer font-medium text-slate-700 hover:text-slate-900">
              📝 Voir tout ce qu&apos;il reste à faire ({remaining.length} étapes)
            </summary>
            <ul className="mt-2 space-y-1 ml-5 list-disc text-slate-600">
              {remaining.map((r, i) => <li key={i} className="leading-snug">{r}</li>)}
            </ul>
          </details>
        )}

        {/* Urgences (si plusieurs deadlines proches) */}
        {urgences.length > 1 && (
          <div className="mt-3 pt-3 border-t border-white/60">
            <div className="text-xs font-bold text-slate-700 mb-1.5">⏳ Échéances à venir :</div>
            <div className="flex flex-wrap gap-1.5">
              {urgences.slice(0, 4).map((urg, i) => (
                <span key={i} className={`text-[11px] px-2 py-0.5 rounded ${urg.days < 0 ? 'bg-red-100 text-red-800' : urg.days <= 3 ? 'bg-orange-100 text-orange-800' : urg.days <= 7 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'}`}>
                  {urg.label.split(' ')[0]} : {urg.days < 0 ? `J+${Math.abs(urg.days)}` : `J-${urg.days}`}
                </span>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}



// =====================================================================
// 📅 JOUR J — Affichage des check-in / check-out renseignés par l'agent ARACOM
// =====================================================================
function JourJBlock({ registration }) {
  const [sessions, setSessions] = useState([]);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastFetched, setLastFetched] = useState(null);

  const reload = async () => {
    if (!registration?.id) return;
    setRefreshing(true);
    try {
      const d = await api(`/api/registrations/${registration.id}`);
      setSessions(d.attendance_sessions || []);
      setComments(d.comments || []);
      setLastFetched(new Date());
    } catch (_e) {
      // best effort
    }
    setRefreshing(false);
    setLoading(false);
  };

  useEffect(() => {
    reload();
    // Auto-refresh toutes les 30s pour suivre les pointages en temps réel
    const t = setInterval(reload, 30000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registration?.id]);

  const dayInfo = [
    { date: '2026-08-14', label: 'Vendredi 14 août 2026', hours: '11h – 17h' },
    { date: '2026-08-15', label: 'Samedi 15 août 2026',   hours: '9h – 17h'  },
  ];

  if (loading) return <div className="text-sm text-slate-500 p-4">Chargement…</div>;

  // Le backend retourne actual_arrival_time / actual_departure_time au format "HH:MM"
  const fmtTime = (hhmm) => {
    if (!hhmm) return null;
    // Si on reçoit une ISO date par compatibilité, on extrait l'heure locale
    if (typeof hhmm === 'string' && hhmm.includes('T')) {
      return new Date(hhmm).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    }
    return hhmm; // déjà "HH:MM"
  };

  // Statut visuel pour chaque jour
  const presenceBadge = (status) => {
    const map = {
      arrive:           { label: '✓ Présent',         cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
      parti:            { label: '✓ Présent (parti)', cls: 'bg-blue-100 text-blue-700 border-blue-200' },
      depart_anticipe:  { label: '⚠ Départ anticipé', cls: 'bg-amber-100 text-amber-800 border-amber-200' },
      absent:           { label: '✗ Absent',          cls: 'bg-red-100 text-red-700 border-red-200' },
      attendu:          { label: '⏳ En attente',     cls: 'bg-slate-100 text-slate-600 border-slate-200' },
      annule:           { label: '— Annulé',          cls: 'bg-slate-100 text-slate-500 border-slate-200' },
    };
    return map[status] || map.attendu;
  };

  return (
    <div className="space-y-4">
      {/* En-tête pédagogique avec rafraîchissement */}
      <Card className="border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50">
        <CardContent className="p-5">
          <div className="flex items-start gap-3">
            <div className="text-3xl">📅</div>
            <div className="flex-1">
              <h3 className="font-bold text-orange-900">Votre présence sur site (Jour J)</h3>
              <p className="text-sm text-orange-800 mt-1">L&apos;agent ARACOM sur le terrain pointe votre arrivée et votre départ via son application mobile. Voici un suivi <b>en temps réel</b> de votre journée — utile pour la restitution de votre caution.</p>
            </div>
            <Button size="sm" variant="outline" onClick={reload} disabled={refreshing} className="gap-1 h-8 text-xs bg-white">
              <span className={`w-1.5 h-1.5 rounded-full ${refreshing ? 'bg-orange-400 animate-pulse' : 'bg-emerald-500'}`}></span>
              {refreshing ? 'Sync…' : 'Actualiser'}
            </Button>
          </div>
          {lastFetched && (
            <p className="text-[10px] text-orange-700/60 mt-2 ml-12">Dernière synchro : {lastFetched.toLocaleTimeString('fr-FR')}</p>
          )}
        </CardContent>
      </Card>

      {/* 2 jours possibles */}
      <div className="grid md:grid-cols-2 gap-4">
        {dayInfo.map(day => {
          const session = sessions.find(s => s.event_date === day.date);
          const arrival   = fmtTime(session?.actual_arrival_time);
          const departure = fmtTime(session?.actual_departure_time);
          const expArrival   = session?.expected_arrival_time;
          const expDeparture = session?.expected_departure_time;
          const status = session?.presence_status || 'attendu';
          const badge = presenceBadge(status);
          const present = ['arrive', 'parti', 'depart_anticipe'].includes(status);
          const isLate = arrival && expArrival && arrival > expArrival;
          const isEarlyOut = departure && expDeparture && departure < expDeparture;

          // Commentaires liés à cette journée (par l'agent ARACOM)
          const dayComments = (comments || []).filter(c => c.attendance_session_id === session?.id);

          return (
            <Card key={day.date} className={present ? 'border-emerald-300' : (status === 'absent' ? 'border-red-300' : 'border-slate-200')}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-orange-600" /> {day.label}
                  </span>
                  <Badge variant="outline" className={badge.cls}>{badge.label}</Badge>
                </CardTitle>
                <p className="text-xs text-slate-500 mt-1">Horaires officiels : {day.hours}</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-md border bg-emerald-50/40 p-3">
                    <div className="text-[10px] uppercase tracking-wider text-emerald-700 font-semibold flex items-center justify-between">
                      <span>Arrivée</span>
                      {isLate && <span className="text-amber-700 normal-case">⚠ retard</span>}
                    </div>
                    <div className="text-2xl font-bold text-emerald-700 mt-1">{arrival || '—'}</div>
                    {expArrival && (
                      <div className="text-[10px] text-slate-500">prévue {expArrival}</div>
                    )}
                  </div>
                  <div className="rounded-md border bg-blue-50/40 p-3">
                    <div className="text-[10px] uppercase tracking-wider text-blue-700 font-semibold flex items-center justify-between">
                      <span>Départ</span>
                      {isEarlyOut && <span className="text-amber-700 normal-case">⚠ anticipé</span>}
                    </div>
                    <div className="text-2xl font-bold text-blue-700 mt-1">{departure || '—'}</div>
                    {expDeparture && (
                      <div className="text-[10px] text-slate-500">prévu {expDeparture}</div>
                    )}
                  </div>
                </div>

                {/* État du stand au départ (si renseigné) */}
                {session?.departure_stand_condition && (
                  <div className={`text-xs rounded-md p-2 border ${session.departure_stand_condition === 'conforme' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-amber-50 border-amber-200 text-amber-900'}`}>
                    <b>État du stand au départ :</b> {session.departure_stand_condition === 'conforme' ? '✓ Conforme' : '⚠ À signaler'}
                  </div>
                )}

                {/* Commentaires de l'agent ARACOM */}
                {dayComments.length > 0 && (
                  <div className="space-y-1.5">
                    {dayComments.map(c => (
                      <div key={c.id} className="text-xs text-slate-600 bg-slate-50 rounded-md p-2 border">
                        <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                          {c.comment_type?.replace(/_/g, ' ') || 'Note de l\'agent'}
                        </div>
                        <div className="mt-0.5">{c.comment_text}</div>
                      </div>
                    ))}
                  </div>
                )}

                {!session && (
                  <p className="text-xs text-slate-500 italic">Aucun pointage enregistré pour cette journée. L&apos;agent ARACOM vous accueillera à votre arrivée sur site.</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Pédagogie : comment ça marche */}
      <Card className="border-slate-200 bg-slate-50/30">
        <CardContent className="p-4 text-xs text-slate-600 space-y-1.5">
          <div className="font-semibold text-slate-800">💡 Comment ça marche ?</div>
          <p>• À votre arrivée sur site, présentez-vous à l&apos;agent ARACOM qui pointe votre <b>arrivée</b> via tablette/mobile.</p>
          <p>• À votre départ (17h ou plus tôt avec accord ARACOM), l&apos;agent pointe votre <b>départ</b> et l&apos;état de votre stand.</p>
          <p>• Cette page se rafraîchit automatiquement toutes les 30 secondes — vous voyez les pointages en temps réel.</p>
          <p>• Ces données conditionnent la <b>restitution de votre caution</b> (présence effective + horaires respectés).</p>
        </CardContent>
      </Card>
    </div>
  );
}

// =====================================================================
// ⭐ BILAN & SATISFACTION — Questionnaire + RDV restitution caution
// =====================================================================
function BilanSatisfactionView({ registration, organization, deposit }) {
  const r = registration;
  const o = organization;
  const [hasSubmitted, setHasSubmitted] = useState(false);

  useEffect(() => {
    if (!o?.id) return;
    api(`/api/exposant/satisfaction?organization_id=${o.id}`).then(d => {
      if (d.response) setHasSubmitted(true);
    }).catch(() => {});
  }, [o?.id]);

  return (
    <div className="space-y-5">
      {/* Bandeau pédagogique */}
      <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50">
        <CardContent className="p-5">
          <div className="flex items-start gap-3">
            <div className="text-3xl">⭐</div>
            <div className="flex-1">
              <h3 className="font-bold text-amber-900">Bilan & restitution de votre caution</h3>
              <p className="text-sm text-amber-800 mt-1">
                Pour récupérer votre caution de 20 000 XPF, suivez ces 2 étapes :
              </p>
              <ol className="text-sm text-amber-900 mt-2 space-y-1 list-decimal list-inside">
                <li><b>Remplissez le questionnaire de satisfaction</b> ci-dessous (5 minutes).</li>
                <li><b>Prenez un RDV</b> pour récupérer votre caution (vous serez guidé après soumission).</li>
              </ol>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Questionnaire (inchangé — toast/UI gérés par le composant) */}
      <SatisfactionSurvey
        organizationId={o?.id}
        organizationName={o?.name}
        registrationId={r?.id}
        venueId={r?.venue_id}
        standCode={r?.stand_code}
        defaultDays={r?.attending_days || []}
      />

      {/* RDV pour récupérer la caution — apparaît après soumission */}
      {hasSubmitted && (
        <CautionAppointmentBlock registration={r} organization={o} deposit={deposit} />
      )}
    </div>
  );
}

// =====================================================================
// 🗓️ PRISE DE RDV pour récupérer la caution (post-questionnaire)
// =====================================================================
function CautionAppointmentBlock({ registration, organization, deposit }) {
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [place, setPlace] = useState('aracom_paea');
  const [placeCustom, setPlaceCustom] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [existing, setExisting] = useState(null);

  useEffect(() => {
    if (!registration?.id) return;
    api(`/api/exposant/caution-appointment?registration_id=${registration.id}`).then(d => {
      if (d?.appointment) {
        setExisting(d.appointment);
        setSubmitted(true);
      }
    }).catch(() => {});
  }, [registration?.id]);

  // Créneaux suggérés
  const suggestedDates = [
    { value: '2026-08-17', label: 'Lundi 17 août 2026' },
    { value: '2026-08-18', label: 'Mardi 18 août 2026' },
    { value: '2026-08-19', label: 'Mercredi 19 août 2026' },
    { value: '2026-08-20', label: 'Jeudi 20 août 2026' },
    { value: '2026-08-21', label: 'Vendredi 21 août 2026' },
    { value: '2026-08-24', label: 'Lundi 24 août 2026' },
    { value: '2026-08-25', label: 'Mardi 25 août 2026' },
  ];
  const suggestedTimes = ['09:00', '10:00', '11:00', '13:30', '14:30', '15:30', '16:30'];

  // Lieux suggérés
  const PLACE_OPTIONS = [
    { key: 'aracom_paea', label: '🏢 ARACOM Conseil — Paea', hint: 'Siège ARACOM, sur RDV' },
    { key: 'sur_site',    label: '🎪 Sur site / à mon stand le jour J', hint: 'Pendant l\'événement (sam 15 août)' },
    { key: 'autre',       label: '📍 Autre lieu',           hint: 'À préciser ci-dessous' },
  ];
  const placeLabel = (k, custom) => {
    if (k === 'sur_site') return 'Sur site / à votre stand le jour J';
    if (k === 'autre') return custom || 'Lieu à préciser';
    return 'ARACOM Conseil — Paea, Polynésie française';
  };

  const submit = async () => {
    if (!date || !time) { toast.error('Choisissez une date et une heure'); return; }
    if (place === 'autre' && !placeCustom.trim()) { toast.error('Précisez le lieu'); return; }
    setBusy(true);
    try {
      const res = await api('/api/exposant/caution-appointment', {
        method: 'POST',
        body: JSON.stringify({
          registration_id: registration.id,
          organization_id: organization.id,
          requested_date: date,
          requested_time: time,
          requested_place: place,
          requested_place_custom: placeCustom,
          notes,
        }),
      });
      setExisting(res.appointment);
      setSubmitted(true);
      toast.success('Demande de RDV envoyée à ARACOM ✅');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (submitted && existing) {
    const isConfirmed = existing.status === 'confirme' || existing.status === 'restitue';
    const confirmedDate = existing.confirmed_date || existing.requested_date;
    const confirmedTime = existing.confirmed_time || existing.requested_time;
    const confirmedPlace = existing.confirmed_place || existing.requested_place || 'aracom_paea';
    const confirmedPlaceCustom = existing.confirmed_place_custom || existing.requested_place_custom || '';
    const placeStr = placeLabel(confirmedPlace, confirmedPlaceCustom);

    return (
      <Card className={isConfirmed ? 'border-emerald-300 bg-gradient-to-br from-emerald-50 to-teal-50' : 'border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50'}>
        <CardContent className="p-6">
          <div className="flex items-start gap-3">
            <CheckCircle2 className={`w-8 h-8 shrink-0 ${isConfirmed ? 'text-emerald-600' : 'text-amber-600'}`} />
            <div className="flex-1">
              <h3 className={`text-lg font-bold ${isConfirmed ? 'text-emerald-900' : 'text-amber-900'}`}>
                {existing.status === 'restitue' ? '🎉 Caution restituée' : isConfirmed ? 'RDV confirmé ✓' : 'Demande de RDV envoyée ✓'}
              </h3>
              <p className={`text-sm mt-1 ${isConfirmed ? 'text-emerald-800' : 'text-amber-800'}`}>
                Vous serez accueilli(e) le <b>{new Date(confirmedDate).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} à {confirmedTime}</b>.
              </p>
              <div className="mt-3 text-xs bg-white/70 rounded-md p-3 border border-white/80">
                <p className="font-semibold mb-1">📍 Lieu : <span className="font-bold">{placeStr}</span></p>
                <p className="text-slate-600 mt-1">Munissez-vous d&apos;une pièce d&apos;identité. La caution de <b>20 000 XPF</b> vous sera restituée sous la forme acceptée à l&apos;origine (espèces, chèque ou virement) et vous signerez sur place l&apos;<b>attestation de remboursement</b> en 2 exemplaires.</p>
              </div>
              <p className={`text-xs mt-2 ${isConfirmed ? 'text-emerald-700' : 'text-amber-700'}`}>
                Statut : <b>
                  {existing.status === 'demande' ? 'En attente de validation ARACOM' :
                   existing.status === 'propose' ? 'Nouveau créneau proposé par ARACOM' :
                   existing.status === 'confirme' ? 'Confirmé' :
                   existing.status === 'restitue' ? 'Caution restituée' :
                   existing.status === 'annule' ? 'Annulé' : existing.status}
                </b>.
                {!isConfirmed && ' Vous recevrez une confirmation par email dès qu\'ARACOM aura validé votre créneau.'}
              </p>
              {existing.admin_note && (
                <div className="mt-2 text-xs bg-blue-50 border border-blue-200 rounded-md p-2 text-blue-900">
                  <b>Note ARACOM :</b> {existing.admin_note}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-orange-300 shadow-lg">
      <CardHeader className="bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-t-lg">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Wallet className="w-5 h-5" /> Récupérer ma caution (20 000 XPF)
        </CardTitle>
        <p className="text-sm text-white/90 mt-1">Choisissez une <b>date</b>, une <b>heure</b> et un <b>lieu</b> pour récupérer votre caution.</p>
      </CardHeader>
      <CardContent className="p-5 space-y-4">
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Date souhaitée</Label>
            <div className="grid grid-cols-1 gap-1 mt-2">
              {suggestedDates.map(d => (
                <button
                  key={d.value}
                  onClick={() => setDate(d.value)}
                  className={`text-left px-3 py-2 rounded-md border text-sm transition ${date === d.value ? 'border-orange-500 bg-orange-50 text-orange-900 font-semibold' : 'border-slate-200 hover:border-orange-300'}`}
                >{d.label}</button>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Heure souhaitée</Label>
            <div className="grid grid-cols-2 gap-1 mt-2">
              {suggestedTimes.map(t => (
                <button
                  key={t}
                  onClick={() => setTime(t)}
                  className={`px-3 py-2 rounded-md border text-sm transition ${time === t ? 'border-orange-500 bg-orange-50 text-orange-900 font-semibold' : 'border-slate-200 hover:border-orange-300'}`}
                >{t}</button>
              ))}
            </div>
            <div className="mt-3">
              <Label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Note (optionnel)</Label>
              <Input
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Précisions, contraintes…"
                className="mt-1"
              />
            </div>
          </div>
        </div>

        {/* 🆕 LIEU */}
        <div>
          <Label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Lieu de restitution</Label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-2">
            {PLACE_OPTIONS.map(o => (
              <button
                key={o.key}
                onClick={() => setPlace(o.key)}
                className={`text-left px-3 py-2 rounded-md border text-sm transition ${place === o.key ? 'border-orange-500 bg-orange-50 ring-2 ring-orange-200' : 'border-slate-200 hover:border-orange-300'}`}
              >
                <div className="font-semibold text-slate-800 text-xs">{o.label}</div>
                <div className="text-[10px] text-slate-500 mt-0.5">{o.hint}</div>
              </button>
            ))}
          </div>
          {place === 'autre' && (
            <Input
              value={placeCustom}
              onChange={e => setPlaceCustom(e.target.value)}
              placeholder="Précisez l'adresse / le lieu (ex : Carrefour Paea, parking église...)"
              className="mt-2"
            />
          )}
        </div>

        <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900">
          <b>Info :</b> ARACOM peut vous proposer un autre créneau ou lieu si le vôtre n&apos;est pas disponible. Vous recevrez un email de confirmation. À votre arrivée, vous signerez l&apos;<b>attestation de remboursement</b> en 2 exemplaires.
        </div>

        <Button
          onClick={submit}
          disabled={busy || !date || !time || (place === 'autre' && !placeCustom.trim())}
          className="w-full bg-orange-600 hover:bg-orange-700 gap-2"
        >
          {busy ? 'Envoi…' : '🗓️ Demander ce créneau'}
        </Button>
      </CardContent>
    </Card>
  );
}


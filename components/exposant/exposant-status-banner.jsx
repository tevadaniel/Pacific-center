'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Lock, CalendarCheck, Hourglass, Clock4, ShieldCheck, Edit3 } from 'lucide-react';

/**
 * 🆕 SESSION 48c — Bandeau unifié de statut exposant
 *
 * Remplace les 4-5 bannières redondantes qui s'empilaient sur le portail :
 *   - "Inscription verrouillée par ARACOM"
 *   - "Rendez-vous fixé avec ARACOM"
 *   - "Demande soumise / en attente"
 *   - "Vous êtes en liste d'attente"
 *   - "Votre stand est pré-réservé"
 *
 * Priorité (du plus prioritaire au moins) — UN SEUL bandeau affiché :
 *   1. 🟢 LOCKED       — Inscription verrouillée par ARACOM (statut final)
 *   2. 🔵 RDV_FIXE     — RDV planifié avec ARACOM
 *   3. 🟡 PENDING      — Demande soumise, en attente de validation
 *   4. 🟠 WAITLIST     — Inscription en liste d'attente (stand pris)
 *   5. 🟣 PRE_RESERVED — Stand pré-réservé, en attente de caution
 *
 * Compact, sticky possible, avec CTA contextuel (modifier, voir RDV…).
 */
export default function ExposantStatusBanner({
  registration,
  venue,
  validationRequest,
  onEdit,
  sticky = false,
}) {
  const r = registration || {};
  const v = venue || {};
  const vr = validationRequest || null;

  // Détermine l'état prioritaire
  const isLocked = r.status === 'verrouille' || r.candidature_locked || r.is_locked || vr?.status === 'verrouille';
  const hasRdv = vr?.status === 'rdv_fixe';
  const isPending = vr?.status === 'en_attente';
  const isWaitlist = r.is_waitlist === true && !isLocked && !isPending && !hasRdv;
  const isPreReserved = !isLocked && !isPending && !hasRdv && !isWaitlist && !!r.stand_code;

  // Aucun état particulier → pas de bandeau
  if (!isLocked && !hasRdv && !isPending && !isWaitlist && !isPreReserved) return null;

  const wrapBase = sticky
    ? 'sticky top-[64px] z-30 shadow-md'
    : 'shadow-sm';

  // 🟢 LOCKED
  if (isLocked) {
    return (
      <div className={`${wrapBase} bg-emerald-50 border border-emerald-300 rounded-lg p-3 flex items-center gap-3`}>
        <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
        <div className="flex-1 min-w-0 text-sm">
          <span className="font-bold text-emerald-900">Inscription confirmée</span>
          <span className="text-emerald-800"> · Votre dossier est définitif. Pour toute modification, contactez ARACOM.</span>
        </div>
        <Badge className="bg-emerald-600 text-white text-[10px] shrink-0">🔒 VERROUILLÉ</Badge>
      </div>
    );
  }

  // 🔵 RDV_FIXE
  if (hasRdv) {
    const dateStr = vr.rdv_date ? new Date(vr.rdv_date).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }) : null;
    return (
      <div className={`${wrapBase} bg-sky-50 border border-sky-300 rounded-lg p-3 flex items-start gap-3`}>
        <CalendarCheck className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0 text-sm">
          <div className="font-bold text-sky-900">RDV ARACOM planifié</div>
          <div className="text-sky-800">
            {dateStr && <><b>{dateStr}</b>{vr.rdv_location ? ` · ${vr.rdv_location}` : ''}<br /></>}
            Préparez : convention signée, justificatif d&apos;assurance, caution 20 000 XPF.
          </div>
        </div>
        <Badge className="bg-sky-600 text-white text-[10px] shrink-0">📅 RDV FIXÉ</Badge>
      </div>
    );
  }

  // 🟡 PENDING
  if (isPending) {
    const submittedStr = vr.requested_at ? new Date(vr.requested_at).toLocaleDateString('fr-FR') : null;
    return (
      <div className={`${wrapBase} bg-amber-50 border border-amber-300 rounded-lg p-3 flex items-start gap-3`}>
        <Hourglass className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0 text-sm">
          <div className="font-bold text-amber-900">Demande soumise à ARACOM</div>
          <div className="text-amber-800">
            {submittedStr && <>Envoyée le <b>{submittedStr}</b>. </>}
            Vous pouvez encore <b>modifier vos choix</b> tant qu&apos;ARACOM n&apos;a pas confirmé.
          </div>
        </div>
        {onEdit && (
          <Button size="sm" variant="outline" onClick={onEdit} className="bg-white hover:bg-amber-100 border-amber-300 text-amber-900 gap-1 shrink-0">
            <Edit3 className="w-3.5 h-3.5" /> Modifier
          </Button>
        )}
      </div>
    );
  }

  // 🟠 WAITLIST
  if (isWaitlist) {
    return (
      <div className={`${wrapBase} bg-orange-50 border border-orange-300 rounded-lg p-3 flex items-start gap-3`}>
        <Clock4 className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0 text-sm">
          <div className="font-bold text-orange-900">Vous êtes en liste d&apos;attente</div>
          <div className="text-orange-800">
            Site <b>{v.name || 'sélectionné'}</b>{r.stand_code ? `, stand ${r.stand_code}` : ''}.
            ARACOM vous recontactera pour confirmer ou proposer une alternative.
            <span className="italic"> Continuez à compléter votre dossier en attendant.</span>
          </div>
        </div>
        <Badge className="bg-orange-600 text-white text-[10px] shrink-0">⏳ ATTENTE</Badge>
      </div>
    );
  }

  // 🟣 PRE_RESERVED
  return (
    <div className={`${wrapBase} bg-violet-50 border border-violet-300 rounded-lg p-3 flex items-start gap-3`}>
      <Lock className="w-5 h-5 text-violet-600 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0 text-sm">
        <div className="font-bold text-violet-900">Stand pré-réservé</div>
        <div className="text-violet-800">
          <b className="font-mono">{r.stand_code}</b>{v.name ? ` · ${v.name}` : ''}.
          ARACOM confirmera votre stand <b>dès réception de votre caution</b> (20 000 XPF).
        </div>
      </div>
      <Badge className="bg-violet-600 text-white text-[10px] shrink-0">📌 PRÉ-RÉSERVÉ</Badge>
    </div>
  );
}

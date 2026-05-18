'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import DeleteOrgDialog from './delete-org-dialog';

/**
 * ADMIN OVERRIDE PANEL — Tableau de bord des actions admin sur un exposant.
 *
 * Permet à un admin ARACOM de :
 *  - Libérer un stand, supprimer animations, réinitialiser jours
 *  - Annuler une inscription
 *  - Réinitialiser : caution / virement / convention / pointages jour J / RDV restitution / satisfaction
 *  - Archiver (corbeille réversible) ou restaurer
 *  - Supprimer définitivement (avec saisie du nom)
 *
 * Toutes les actions appellent /api/admin/registrations/:id/... ou /api/admin/organizations/:id/...
 * et nécessitent un header x-user-role=aracom_admin (ajouté automatiquement dans callAdmin()).
 *
 * Props:
 *  - data: { registration, organization, deposit, slots, documents, attendance_sessions }
 *  - onReload: () => Promise<void>  // recharge la fiche depuis l'API
 *  - onClose: () => void            // ferme le panneau parent (utilisé après archive/delete)
 */
export default function AdminOverridePanel({ data, onReload, onClose }) {
  const [busy, setBusy] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  if (!data?.registration) return null;
  const reg = data.registration;
  const org = data.organization;
  const dep = data.deposit;
  const sessions = data.attendance_sessions || [];
  const hasArchive = !!org?.archived_at;

  const callAdmin = async (label, path, body, confirmMsg) => {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    setBusy(label);
    try {
      const r = await fetch(`/api${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-role': 'aracom_admin', 'x-user-id': 'u-admin' },
        body: body ? JSON.stringify(body) : undefined,
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `Erreur ${label}`);
      toast.success(`${label} ✓`);
      await onReload();
    } catch (e) { toast.error(e.message); }
    finally { setBusy(null); }
  };

  // Actions sur le parcours d'inscription
  const releaseStand = () => callAdmin('Stand libéré', `/admin/registrations/${reg.id}/reset`, { reset: 'stand' }, `Libérer le stand ${reg.stand_code} de ${org?.name} ?`);
  const clearAnimation = () => callAdmin('Animations supprimées', `/admin/registrations/${reg.id}/reset`, { reset: 'animations' }, `Supprimer toutes les animations de ${org?.name} ?`);
  const clearDays = () => callAdmin('Jours réinitialisés', `/admin/registrations/${reg.id}/reset`, { reset: 'days' }, `Réinitialiser les jours de présence ?`);
  const cancelReg = () => callAdmin('Inscription annulée', `/admin/registrations/${reg.id}/reset`, { reset: 'cancel' }, `⚠ Annuler complètement l'inscription de ${org?.name} ?\n\n• Statut → "annulé"\n• Stand libéré\n• Animations supprimées\n• L'organisation reste en base (le bouton "Annuler" disparaîtra ensuite, mais vous pourrez réactiver l'inscription)`);

  // 🆕 SUPPRIMER DÉFINITIVEMENT l'inscription (delete-full)
  const deleteReg = async () => {
    if (!window.confirm(`💥 SUPPRESSION DÉFINITIVE de l'inscription de ${org?.name} ?\n\n⚠ Cette action est irréversible :\n• L'inscription, le stand, les animations, la caution, le reçu, le RDV restitution, les pointages, les anomalies, les documents et les jetons de modification seront SUPPRIMÉS.\n• Si c'est la seule inscription de l'organisation, l'organisation est aussi supprimée.\n\nPréférez l'archivage si vous voulez pouvoir restaurer.`)) return;
    if (!window.confirm(`Confirmation finale : tapez OK pour valider la suppression définitive de l'inscription de "${org?.name}".`)) return;
    setBusy('delete-reg');
    try {
      const r = await fetch(`/api/admin/registrations/${reg.id}/delete-full`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-role': 'aracom_admin', 'x-user-id': 'u-admin' },
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Erreur suppression inscription');
      toast.success(`💥 Inscription supprimée définitivement${j.org_also_deleted ? ' (et organisation aussi)' : ''}`);
      onClose();
    } catch (e) { toast.error(e.message); }
    finally { setBusy(null); }
  };

  // Reset granulaires
  const resetCaution    = () => callAdmin('Caution réinitialisée',       `/admin/registrations/${reg.id}/reset-caution`,             null, `Réinitialiser la caution de ${org?.name} ?\n\nLe paiement repasse en "en attente", le reçu est invalidé, et la registration est déverrouillée.`);
  const resetVirement   = () => callAdmin('Déclaration virement annulée', `/admin/registrations/${reg.id}/reset-virement`,            null, `Annuler la déclaration de virement de ${org?.name} ?\n\nLa référence et la date du virement seront effacées.`);
  const resetConvention = () => callAdmin('Convention invalidée',        `/admin/registrations/${reg.id}/reset-convention`,          null, `Invalider la convention signée de ${org?.name} ?\n\nL'exposant devra re-signer la convention.`);
  const resetAppt       = () => callAdmin('RDV caution supprimé',        `/admin/registrations/${reg.id}/reset-caution-appointment`, null, `Supprimer le RDV de restitution caution ?\n\nL'exposant pourra en demander un nouveau.`);
  const resetSurvey     = () => callAdmin('Questionnaire réinitialisé',   `/admin/registrations/${reg.id}/reset-satisfaction`,        null, `Supprimer la réponse au questionnaire de satisfaction de ${org?.name} ?\n\nL'exposant pourra le re-remplir et l'attestation auto sera régénérée.`);
  const resetAttendanceAll = () => callAdmin('Pointages Jour J supprimés', `/admin/registrations/${reg.id}/reset-attendance`, { scope: 'all' }, `⚠ Supprimer TOUS les pointages Jour J (arrivée + départ) de ${org?.name} ?\n\nLes anomalies de retard/départ anticipé seront aussi supprimées.`);
  const resetAttendanceDay = (event_date, scope) => callAdmin(`Pointage ${event_date} ${scope === 'arrival' ? '(arrivée)' : scope === 'departure' ? '(départ)' : '(tout)'} supprimé`, `/admin/registrations/${reg.id}/reset-attendance`, { event_date, scope }, `Supprimer le pointage ${scope === 'arrival' ? "d'arrivée" : scope === 'departure' ? 'de départ' : 'complet'} du ${event_date} ?`);
  // 🔓 Déblocage de la candidature (autorise l'exposant à modifier site/stand/animations à nouveau)
  const unlockCandidature = () => callAdmin('Candidature débloquée', `/admin/registrations/${reg.id}/unlock-candidature`, null, `Débloquer la candidature de ${org?.name} ?\n\nL'exposant pourra à nouveau modifier son site, son stand et ses créneaux d'animation.\nLa demande de validation en cours sera annulée — l'exposant devra resoumettre.`);

  // Archive / Restore organisation
  const archiveOrg = async () => {
    const reason = window.prompt(`Archiver "${org?.name}" ? (l'exposant disparaît des vues actives, les inscriptions sont annulées, mais les données restent en base et peuvent être restaurées).\n\nMotif (optionnel) :`, '');
    if (reason === null) return;
    setBusy('archive');
    try {
      const r = await fetch(`/api/admin/organizations/${org.id}/archive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-role': 'aracom_admin', 'x-user-id': 'u-admin' },
        body: JSON.stringify({ reason }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Erreur archivage');
      toast.success(`📦 ${org.name} archivé`);
      onClose();
    } catch (e) { toast.error(e.message); }
    finally { setBusy(null); }
  };
  const restoreOrg = () => callAdmin('Organisation restaurée', `/admin/organizations/${org?.id}/restore`, null, `Restaurer ${org?.name} depuis la corbeille ?`);

  // Suppression définitive avec saisie nom
  const deleteOrgDefinitive = () => setShowDeleteDialog(true);

  return (
    <>
    <div className="rounded-md border-2 border-red-200 bg-red-50/40 p-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <div className="font-bold text-red-900 text-sm">🛠️ Zone admin — Override & Reset</div>
          {hasArchive && <Badge className="bg-amber-100 text-amber-900 border-amber-300">📦 Archivé</Badge>}
          {reg.candidature_locked && <Badge className="bg-violet-100 text-violet-900 border-violet-300">🔒 Candidature verrouillée</Badge>}
        </div>
        <Button size="sm" variant="ghost" onClick={() => setExpanded(!expanded)} className="h-7 text-xs">
          {expanded ? '▲ Masquer' : '▼ Toutes les actions'}
        </Button>
      </div>

      {/* Actions essentielles (toujours visibles) */}
      <div className="flex flex-wrap gap-2">
        {/* 🔓 Débloquer la candidature — bouton prioritaire si verrouillée */}
        {reg.candidature_locked && (
          <Button size="sm" variant="outline" onClick={unlockCandidature} disabled={busy === 'Candidature débloquée'} className="bg-violet-600 text-white hover:bg-violet-700 border-violet-700 h-8 text-xs">
            {busy === 'Candidature débloquée' ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
            🔓 Débloquer candidature
          </Button>
        )}
        {reg.stand_code && (
          <Button size="sm" variant="outline" onClick={releaseStand} disabled={busy === 'Stand libéré'} className="bg-white border-red-300 text-red-700 hover:bg-red-50 h-8 text-xs">
            {busy === 'Stand libéré' ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
            🪧 Libérer stand {reg.stand_code}
          </Button>
        )}
        {data.slots?.length > 0 && (
          <Button size="sm" variant="outline" onClick={clearAnimation} disabled={busy === 'Animations supprimées'} className="bg-white border-red-300 text-red-700 hover:bg-red-50 h-8 text-xs">
            {busy === 'Animations supprimées' ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
            🎭 Suppr. animations ({data.slots.length})
          </Button>
        )}
        {reg.status !== 'annule' && (
          <Button size="sm" variant="outline" onClick={cancelReg} disabled={busy === 'Inscription annulée'} className="bg-red-600 text-white hover:bg-red-700 border-red-700 h-8 text-xs">
            {busy === 'Inscription annulée' ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
            ⛔ Annuler inscription
          </Button>
        )}
        {reg.status === 'annule' && (
          <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-300 h-8 px-3 flex items-center">⛔ Inscription annulée</Badge>
        )}
        {/* 🆕 Suppression définitive de l'inscription (delete-full) — disponible quel que soit le statut */}
        <Button size="sm" variant="outline" onClick={deleteReg} disabled={busy === 'delete-reg'} className="bg-zinc-900 text-white hover:bg-black border-black h-8 text-xs gap-1">
          {busy === 'delete-reg' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
          💥 Supprimer inscription
        </Button>
      </div>

      {/* Actions avancées (déroulées sur demande) */}
      {expanded && (
        <div className="mt-3 space-y-3 pt-3 border-t border-red-200">
          {/* Reset granulaires */}
          <div>
            <div className="font-semibold text-xs text-red-900 mb-1.5">↩️ Annuler une action de l&apos;exposant</div>
            <div className="flex flex-wrap gap-1.5">
              {dep && dep.status !== 'en_attente' && (
                <Button size="sm" variant="outline" onClick={resetCaution} disabled={busy} className="bg-white border-amber-300 text-amber-800 hover:bg-amber-50 h-7 text-[11px]">
                  🪙 Réinit. caution
                </Button>
              )}
              {dep?.virement_reference && (
                <Button size="sm" variant="outline" onClick={resetVirement} disabled={busy} className="bg-white border-cyan-300 text-cyan-800 hover:bg-cyan-50 h-7 text-[11px]">
                  🏦 Annuler virement déclaré
                </Button>
              )}
              {(reg.convention_signed_at || (data.documents || []).some(d => d.document_type === 'convention' && d.is_signed)) && (
                <Button size="sm" variant="outline" onClick={resetConvention} disabled={busy} className="bg-white border-indigo-300 text-indigo-800 hover:bg-indigo-50 h-7 text-[11px]">
                  📝 Invalider convention
                </Button>
              )}
              {(reg.attending_days?.length > 0) && (
                <Button size="sm" variant="outline" onClick={clearDays} disabled={busy === 'Jours réinitialisés'} className="bg-white border-violet-300 text-violet-800 hover:bg-violet-50 h-7 text-[11px]">
                  📅 Réinit. jours présence
                </Button>
              )}
              {sessions.length > 0 && (
                <Button size="sm" variant="outline" onClick={resetAttendanceAll} disabled={busy} className="bg-white border-orange-300 text-orange-800 hover:bg-orange-50 h-7 text-[11px]">
                  🕒 Suppr. pointages Jour J
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={resetAppt} disabled={busy} className="bg-white border-pink-300 text-pink-800 hover:bg-pink-50 h-7 text-[11px]">
                🗓️ Suppr. RDV caution
              </Button>
              <Button size="sm" variant="outline" onClick={resetSurvey} disabled={busy} className="bg-white border-emerald-300 text-emerald-800 hover:bg-emerald-50 h-7 text-[11px]">
                ⭐ Réinit. questionnaire
              </Button>
            </div>
          </div>

          {/* Pointages Jour J par jour */}
          {sessions.length > 0 && (
            <div>
              <div className="font-semibold text-xs text-red-900 mb-1.5">🕒 Pointages Jour J ciblés</div>
              <div className="space-y-1">
                {sessions.map(s => (
                  <div key={s.id} className="flex items-center gap-2 text-[11px]">
                    <span className="text-slate-600 w-28">{s.event_date}</span>
                    <span className="text-emerald-700">↑ {s.actual_arrival_time || '—'}</span>
                    <span className="text-blue-700">↓ {s.actual_departure_time || '—'}</span>
                    <div className="flex gap-1 ml-auto">
                      {s.actual_arrival_time && (
                        <Button size="sm" variant="ghost" onClick={() => resetAttendanceDay(s.event_date, 'arrival')} disabled={busy} className="h-6 px-2 text-[10px] text-emerald-700 hover:bg-emerald-50">Annuler arrivée</Button>
                      )}
                      {s.actual_departure_time && (
                        <Button size="sm" variant="ghost" onClick={() => resetAttendanceDay(s.event_date, 'departure')} disabled={busy} className="h-6 px-2 text-[10px] text-blue-700 hover:bg-blue-50">Annuler départ</Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Archive / Suppression définitive */}
          <div className="pt-2 border-t border-red-200">
            <div className="font-semibold text-xs text-red-900 mb-1.5">🗑️ Suppression / Archivage</div>
            <div className="flex flex-wrap gap-1.5">
              {!hasArchive ? (
                <Button size="sm" variant="outline" onClick={archiveOrg} disabled={busy === 'archive'} className="bg-white border-amber-400 text-amber-900 hover:bg-amber-50 h-7 text-[11px]">
                  {busy === 'archive' ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                  📦 Archiver (corbeille)
                </Button>
              ) : (
                <Button size="sm" variant="outline" onClick={restoreOrg} disabled={busy === 'Organisation restaurée'} className="bg-emerald-50 border-emerald-400 text-emerald-900 hover:bg-emerald-100 h-7 text-[11px]">
                  {busy === 'Organisation restaurée' ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                  ♻️ Restaurer depuis corbeille
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={deleteOrgDefinitive} disabled={busy === 'delete-org'} className="bg-zinc-900 text-white hover:bg-black border-black h-7 text-[11px]">
                {busy === 'delete-org' ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Trash2 className="w-3 h-3 mr-1" />}
                💥 Suppression définitive (org)
              </Button>
            </div>
            <p className="text-[10px] text-red-700 mt-1.5 italic">📦 Archive = soft delete (réversible) · 💥 Suppression définitive = irréversible, supprime l&apos;organisation + toutes ses inscriptions + données associées.</p>
          </div>
        </div>
      )}
    </div>

    {showDeleteDialog && (
      <DeleteOrgDialog
        org={org}
        onClose={() => setShowDeleteDialog(false)}
        onDeleted={() => { setShowDeleteDialog(false); onClose(); }}
      />
    )}
    </>
  );
}

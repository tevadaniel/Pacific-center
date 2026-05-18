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
    {/* 🛠️ ZONE ADMIN — Collapsée par défaut pour alléger l'UX
        Tous les actions sont accessibles en 1 clic via "▼ Toutes les actions". */}
    <div className="rounded-md border border-red-200 bg-red-50/30 p-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="font-semibold text-red-900 text-xs flex items-center gap-1.5 hover:underline"
          >
            <span className="text-base leading-none">🛠️</span>
            Zone admin — Override & Reset
            <span className="text-red-600">{expanded ? '▲' : '▼'}</span>
          </button>
          {hasArchive && <Badge className="bg-amber-100 text-amber-900 border-amber-300 text-[10px]">📦 Archivé</Badge>}
          {reg.candidature_locked && <Badge className="bg-violet-100 text-violet-900 border-violet-300 text-[10px]">🔒 Verrouillée</Badge>}
          {reg.status === 'annule' && <Badge className="bg-slate-200 text-slate-700 border-slate-300 text-[10px]">⛔ Annulée</Badge>}
        </div>
        {/* 🔓 Bouton prioritaire toujours visible si candidature verrouillée */}
        {reg.candidature_locked && (
          <Button size="sm" variant="outline" onClick={unlockCandidature} disabled={busy === 'Candidature débloquée'} className="bg-violet-600 text-white hover:bg-violet-700 border-violet-700 h-7 text-[11px]">
            {busy === 'Candidature débloquée' ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
            🔓 Débloquer
          </Button>
        )}
      </div>

      {/* Actions complètes — affichées uniquement si "Toutes les actions" est ouvert */}
      {expanded && (
        <div className="mt-3 pt-3 border-t border-red-200 space-y-3">
          {/* ━━━ ACTIONS COURANTES (réversibles) ━━━ */}
          <div>
            <div className="font-semibold text-[10px] uppercase tracking-wider text-slate-600 mb-1.5">↩️ Actions réversibles</div>
            <div className="flex flex-wrap gap-1.5">
              {reg.stand_code && (
                <Button size="sm" variant="outline" onClick={releaseStand} disabled={busy === 'Stand libéré'} className="bg-white border-red-300 text-red-700 hover:bg-red-50 h-7 text-[11px]">
                  {busy === 'Stand libéré' ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                  🪧 Libérer stand {reg.stand_code}
                </Button>
              )}
              {data.slots?.length > 0 && (
                <Button size="sm" variant="outline" onClick={clearAnimation} disabled={busy === 'Animations supprimées'} className="bg-white border-red-300 text-red-700 hover:bg-red-50 h-7 text-[11px]">
                  {busy === 'Animations supprimées' ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                  🎭 Suppr. animations ({data.slots.length})
                </Button>
              )}
              {reg.status !== 'annule' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={cancelReg}
                  disabled={busy === 'Inscription annulée'}
                  title="Change le statut à 'annulée' (réversible — on peut remettre un autre statut)"
                  className="bg-orange-500 text-white hover:bg-orange-600 border-orange-600 h-7 text-[11px]"
                >
                  {busy === 'Inscription annulée' ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                  ⛔ Marquer annulée
                </Button>
              )}
            </div>
            <div className="text-[10px] text-slate-500 italic mt-1.5">
              💡 Ces actions modifient l&apos;état mais conservent les données. L&apos;exposant peut reprendre son dossier.
            </div>
          </div>

          {/* Reset granulaires (ouverts au sein du bloc expanded) */}
          <div>
            <div className="font-semibold text-[10px] uppercase tracking-wider text-slate-600 mb-1.5">↩️ Annuler une action de l&apos;exposant</div>
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

          {/* ━━━ ACTIONS IRRÉVERSIBLES ━━━ */}
          <div className="pt-2 border-t border-red-200">
            <div className="font-semibold text-[10px] uppercase tracking-wider text-red-900 mb-1.5">⚠️ Actions IRRÉVERSIBLES — perte de données</div>
            <div className="flex flex-wrap gap-1.5">
              {!hasArchive ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={archiveOrg}
                  disabled={busy === 'archive'}
                  title="Met l'organisation à la corbeille — restaurable plus tard"
                  className="bg-white border-amber-400 text-amber-900 hover:bg-amber-50 h-7 text-[11px]"
                >
                  {busy === 'archive' ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                  📦 Archiver (corbeille)
                </Button>
              ) : (
                <Button size="sm" variant="outline" onClick={restoreOrg} disabled={busy === 'Organisation restaurée'} className="bg-emerald-50 border-emerald-400 text-emerald-900 hover:bg-emerald-100 h-7 text-[11px]">
                  {busy === 'Organisation restaurée' ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                  ♻️ Restaurer depuis corbeille
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={deleteReg}
                disabled={busy === 'delete-reg'}
                title="Supprime DÉFINITIVEMENT l'inscription 2026 (l'organisation reste, peut être ré-inscrite)"
                className="bg-red-700 text-white hover:bg-red-800 border-red-800 h-7 text-[11px] gap-1"
              >
                {busy === 'delete-reg' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                🗑️ Supprimer inscription
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={deleteOrgDefinitive}
                disabled={busy === 'delete-org'}
                title="Supprime l'organisation ET toutes ses inscriptions — TOUT est perdu"
                className="bg-zinc-900 text-white hover:bg-black border-black h-7 text-[11px]"
              >
                {busy === 'delete-org' ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Trash2 className="w-3 h-3 mr-1" />}
                💥 Suppr. organisation
              </Button>
            </div>
            <p className="text-[10px] text-red-700 mt-1.5 italic">
              📦 Archive = soft delete (réversible) · 🗑️ Suppr. inscription = supprime seulement le dossier 2026 (org reste) · 💥 Suppr. organisation = TOUT supprimé (irréversible)
            </p>
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

'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertTriangle, Clock, Users } from 'lucide-react';

/**
 * ConflictDialog — Popup affiché lorsqu'un stand ou un créneau d'animation
 * est déjà demandé (pending) ou validé par un autre exposant.
 *
 * Permet à l'utilisateur de basculer en liste d'attente ou d'annuler pour
 * choisir autre chose. Utilisé aux étapes 3 (stand) et 4 (animation) du wizard.
 *
 * Props :
 *   - open : boolean
 *   - onClose : () => void
 *   - kind : 'stand' | 'animation'
 *   - conflicts : objet ou tableau d'objets {owner_name, owner_status, waitlist_count, waitlist_position, day_label?, start_time?, end_time?, location_type?}
 *   - onConfirmWaitlist : async () => void  (relance la soumission avec force_waitlist:true)
 *   - submitting : boolean
 */
export default function ConflictDialog({
  open,
  onClose,
  kind = 'stand',
  conflicts,
  onConfirmWaitlist,
  submitting = false,
  standCode = null,
}) {
  // Normalise conflicts en tableau
  const list = Array.isArray(conflicts) ? conflicts : conflicts ? [conflicts] : [];
  const isAnimation = kind === 'animation';
  const title = isAnimation
    ? `${list.length} créneau${list.length > 1 ? 'x' : ''} déjà demandé${list.length > 1 ? 's' : ''}`
    : `Stand ${standCode || ''} déjà demandé`;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose?.()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-700">
            <AlertTriangle className="w-5 h-5" />
            {title}
          </DialogTitle>
          <DialogDescription className="text-slate-700 leading-relaxed">
            {isAnimation ? (
              <>Le{list.length > 1 ? 's' : ''} créneau{list.length > 1 ? 'x' : ''} sélectionné{list.length > 1 ? 's' : ''} {list.length > 1 ? 'sont' : 'est'} déjà demandé{list.length > 1 ? 's' : ''} par d&apos;autre{list.length > 1 ? 's' : ''} exposant{list.length > 1 ? 's' : ''}. Votre demande peut être placée en <b>liste d&apos;attente</b> — ARACOM tranchera lors de la validation.</>
            ) : (
              <>Ce stand est déjà en attente de validation pour un autre exposant. Votre demande peut être placée en <b>liste d&apos;attente</b> — ARACOM tranchera lors de la validation.</>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 my-2">
          {list.map((c, idx) => {
            const isValidated = c.owner_status === 'validated';
            return (
              <div key={idx} className="border-2 border-amber-200 rounded-lg p-3 bg-amber-50/60 space-y-2">
                {isAnimation && (
                  <div className="text-xs font-semibold text-amber-900">
                    📅 {c.day_label === 'samedi' ? 'Samedi' : 'Vendredi'} {c.start_time}–{c.end_time}
                    {c.location_type && <span className="ml-2 text-slate-600">• {c.location_type === 'sur_stand' ? 'sur stand' : 'zone démo'}</span>}
                  </div>
                )}
                <div className="text-sm flex items-center gap-2 flex-wrap">
                  <Users className="w-4 h-4 text-slate-500 shrink-0" />
                  <span className="text-slate-800">Demandé par <b>{c.owner_name || 'un autre exposant'}</b></span>
                  <Badge variant="outline" className={isValidated ? 'border-emerald-400 text-emerald-700 bg-emerald-50' : 'border-amber-400 text-amber-700 bg-amber-50'}>
                    {isValidated ? '✅ Validé' : '⏳ En attente'}
                  </Badge>
                </div>
                <div className="text-sm flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-500 shrink-0" />
                  <span className="text-slate-700">
                    Liste d&apos;attente actuelle : <b>{c.waitlist_count || 0}</b> exposant{(c.waitlist_count || 0) > 1 ? 's' : ''}
                  </span>
                </div>
                <div className="text-sm font-semibold text-violet-800 bg-violet-100 rounded px-2 py-1 inline-block">
                  Votre position si vous acceptez : <b>#{c.waitlist_position}</b>
                </div>
              </div>
            );
          })}
        </div>

        <div className="bg-slate-50 border-l-4 border-slate-300 rounded-r p-3 text-xs text-slate-600 leading-relaxed">
          💡 Si l&apos;exposant en attente est <b>refusé par ARACOM</b>, vous serez automatiquement <b>promu</b> en position suivante (ordre FIFO).
        </div>

        <DialogFooter className="gap-2 sm:gap-2 flex-col sm:flex-row">
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Annuler — choisir autre chose
          </Button>
          <Button
            onClick={onConfirmWaitlist}
            disabled={submitting}
            className="bg-amber-600 hover:bg-amber-700 text-white"
            data-testid="confirm-waitlist"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            ⏳ Me placer en liste d&apos;attente
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

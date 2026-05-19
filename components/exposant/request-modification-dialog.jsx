'use client';

/**
 * RequestModificationDialog — SESSION 43-j Phase 3
 *
 * Bouton + dialog qui permet à l'exposant de demander une modification
 * de son bloc Site/Stand/Animation après confirmation (bloc verrouillé).
 *
 * Envoie POST /api/registrations/:id/request-modification qui :
 *  - Crée une entrée dans modification_requests
 *  - Email automatique à agence@aracom-conseil.fr avec lien direct vers la fiche admin
 */

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Pencil, Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';

export default function RequestModificationDialog({
  registrationId,
  triggerLabel = 'Demander une modification',
  triggerVariant = 'outline',
  triggerClass = '',
  context = '', // ex: "stand", "animation", "site"
}) {
  const [open, setOpen] = useState(false);
  const [requestedChanges, setRequestedChanges] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!requestedChanges.trim() && !message.trim()) {
      toast.error('Précisez la modification souhaitée');
      return;
    }
    setBusy(true);
    try {
      const r = await fetch(`/api/registrations/${registrationId}/request-modification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requested_changes: requestedChanges, message }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Erreur');
      toast.success('📨 Demande envoyée à ARACOM');
      setOpen(false);
      setRequestedChanges('');
      setMessage('');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button
        size="sm"
        variant={triggerVariant}
        className={`gap-1.5 ${triggerClass}`}
        onClick={() => setOpen(true)}
      >
        <Pencil className="w-3.5 h-3.5" /> {triggerLabel}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>🔧 Demander une modification</DialogTitle>
            <DialogDescription>
              Votre bloc réservation est verrouillé après confirmation. Décrivez la modification souhaitée — ARACOM vous répondra par email.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Modifications souhaitées *</label>
              <Textarea
                rows={4}
                placeholder={
                  context === 'stand' ? 'ex: changer mon stand F-A12 pour F-B05'
                  : context === 'animation' ? 'ex: décaler mon animation de 11h00 à 14h00'
                  : context === 'site' ? 'ex: déplacer ma réservation de Faaa à Punaauia'
                  : 'Précisez ce que vous souhaitez modifier (site, date, stand, créneau, animation…)'
                }
                value={requestedChanges}
                onChange={(e) => setRequestedChanges(e.target.value)}
                className="text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Message à ARACOM (optionnel)</label>
              <Textarea
                rows={3}
                placeholder="Contexte, urgence, précisions complémentaires…"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="text-sm"
              />
            </div>
            <div className="text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded-md p-2 leading-relaxed">
              📧 Votre demande sera transmise à <b>agence@aracom-conseil.fr</b>. Vous recevrez un email de confirmation et de suivi.
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>Annuler</Button>
            <Button
              onClick={submit}
              disabled={busy || (!requestedChanges.trim() && !message.trim())}
              className="gap-1.5 bg-blue-600 hover:bg-blue-700"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Envoyer la demande
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

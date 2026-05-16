'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

/**
 * Dialog de confirmation pour suppression définitive d'une organisation.
 * Exige la saisie EXACTE du nom + option force_unsafe pour exposants protégés.
 *
 * Props:
 *  - org: { id, name }
 *  - onClose: () => void
 *  - onDeleted: () => void
 */
export default function DeleteOrgDialog({ org, onClose, onDeleted }) {
  const [confirmName, setConfirmName] = useState('');
  const [forceUnsafe, setForceUnsafe] = useState(false);
  const [busy, setBusy] = useState(false);
  const isValid = confirmName.trim() === (org?.name || '').trim();

  const submit = async () => {
    if (!isValid) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/admin/organizations/${org.id}/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-role': 'aracom_admin', 'x-user-id': 'u-admin' },
        body: JSON.stringify({ confirm_name: confirmName, force_unsafe: forceUnsafe }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Erreur suppression');
      const total = Object.values(j.cascaded || {}).reduce((a, b) => a + b, 0);
      toast.success(`💥 ${org.name} supprimé définitivement (${total} enregistrements liés supprimés)`);
      onDeleted();
    } catch (e) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => !busy && !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-red-900">💥 Suppression définitive — Action irréversible</DialogTitle>
          <DialogDescription className="text-red-700">
            Vous êtes sur le point de supprimer <b>définitivement</b> l&apos;organisation <b>&quot;{org?.name}&quot;</b> ainsi que <b>toutes ses inscriptions, paiements, documents, pointages, RDV et historique</b>.
            <br /><br />
            <b>Cette action ne peut pas être annulée.</b> Si vous souhaitez la rendre réversible, utilisez plutôt l&apos;archivage.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label className="text-xs font-semibold">Pour confirmer, saisissez exactement le nom de l&apos;exposant :</Label>
            <Input
              value={confirmName}
              onChange={e => setConfirmName(e.target.value)}
              placeholder={org?.name || ''}
              className="mt-1 font-mono"
              disabled={busy}
            />
            <p className="text-[10px] text-slate-500 mt-1">
              Attendu : <b className="font-mono">{org?.name}</b>
            </p>
          </div>
          <label className="flex items-center gap-2 text-xs text-red-800 cursor-pointer">
            <input type="checkbox" checked={forceUnsafe} onChange={e => setForceUnsafe(e.target.checked)} disabled={busy} />
            Forcer la suppression même si l&apos;exposant est protégé (RULES.md)
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Annuler</Button>
          <Button onClick={submit} disabled={!isValid || busy} className="bg-red-600 hover:bg-red-700 gap-2 disabled:opacity-50">
            {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
            {busy ? 'Suppression…' : 'Supprimer définitivement'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

'use client';
import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Lock, Shield, ShieldOff, KeyRound, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/auth-client';

/**
 * Password gate for the exposant portal.
 *
 * Behavior:
 *  - If the organization has an `access_password_hash` defined → blocks the UI until the user
 *    types either their own password OR the universal admin password (`Projetaracom12`).
 *  - If the user is `aracom_admin` (cockpit) → bypass automatically.
 *  - If accessed via `?admin=1` query param OR sessionStorage flag `admin_preview_mode` → bypass.
 *  - Once unlocked, the session is cached for the rest of the browser tab via sessionStorage.
 */
export default function ExposantPasswordGate({ organizationId, organizationName, userRole, children }) {
  const [status, setStatus] = useState('loading'); // loading | locked | unlocked
  const [pwd, setPwd] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Storage key per org so different orgs are independently locked
  const storageKey = organizationId ? `exposant_unlocked_${organizationId}` : null;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!organizationId) { setStatus('unlocked'); return; }

      // 1) Admin bypass
      if (userRole === 'aracom_admin') {
        setStatus('unlocked');
        return;
      }

      // 2) Admin preview bypass (from PortalSwitcher)
      try {
        const params = new URLSearchParams(window.location.search);
        if (params.get('admin') === '1') {
          sessionStorage.setItem('admin_preview_mode', '1');
        }
        if (sessionStorage.getItem('admin_preview_mode') === '1') {
          setStatus('unlocked');
          return;
        }
      } catch { /* ignore */ }

      // 3) Already unlocked this tab
      try {
        if (storageKey && sessionStorage.getItem(storageKey) === '1') {
          setStatus('unlocked');
          return;
        }
      } catch { /* ignore */ }

      // 4) Check if password is required
      try {
        const r = await api(`/api/exposant/password/status?organization_id=${encodeURIComponent(organizationId)}`);
        if (cancelled) return;
        if (r.has_password) {
          setStatus('locked');
        } else {
          setStatus('unlocked');
        }
      } catch (e) {
        if (cancelled) return;
        // Erreur réseau : on laisse passer (failsafe)
        console.error('[password-gate]', e?.message);
        setStatus('unlocked');
      }
    })();
    return () => { cancelled = true; };
  }, [organizationId, userRole, storageKey]);

  const tryUnlock = async () => {
    if (!pwd) { toast.error('Mot de passe requis'); return; }
    setSubmitting(true);
    try {
      const r = await api('/api/exposant/password/verify', {
        method: 'POST',
        body: JSON.stringify({ password: pwd, organization_id: organizationId }),
      });
      if (r.ok) {
        if (storageKey) {
          try { sessionStorage.setItem(storageKey, '1'); } catch { /* ignore */ }
        }
        if (r.method === 'universal_admin') {
          toast.success('Accès admin universel — bienvenue');
        } else {
          toast.success('Accès débloqué');
        }
        setStatus('unlocked');
      }
    } catch (e) {
      toast.error(e.message || 'Mot de passe incorrect');
    } finally {
      setSubmitting(false);
      setPwd('');
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="text-slate-500 text-sm">Vérification de votre accès…</div>
      </div>
    );
  }

  if (status === 'locked') {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-6 bg-gradient-to-br from-slate-50 to-blue-50">
        <Card className="max-w-md w-full border-2 border-blue-200 shadow-lg">
          <CardContent className="p-6 space-y-4">
            <div className="text-center">
              <div className="mx-auto w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mb-3">
                <Lock className="w-8 h-8 text-blue-700" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">Espace protégé</h2>
              <p className="text-sm text-slate-600 mt-1">
                {organizationName || 'Votre organisation'}
              </p>
              <p className="text-xs text-slate-500 mt-2">
                Saisissez votre mot de passe d&apos;accès pour consulter votre dossier.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pwd-gate">Mot de passe</Label>
              <div className="relative">
                <Input
                  id="pwd-gate"
                  type={showPwd ? 'text' : 'password'}
                  value={pwd}
                  onChange={e => setPwd(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') tryUnlock(); }}
                  autoFocus
                  placeholder="Votre mot de passe"
                  className="pr-10"
                  data-testid="exposant-pwd-input"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(s => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                  tabIndex={-1}
                >
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <Button onClick={tryUnlock} disabled={submitting} className="w-full bg-blue-600 hover:bg-blue-700" data-testid="exposant-pwd-submit">
              {submitting ? 'Vérification…' : 'Accéder à mon espace'}
            </Button>
            <div className="text-[11px] text-slate-400 text-center pt-2 border-t">
              Vous avez oublié votre mot de passe ?<br />
              Contactez ARACOM : <a href="mailto:agence@aracom-conseil.fr" className="text-blue-600 hover:underline">agence@aracom-conseil.fr</a>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return children;
}

/**
 * Inline panel for the exposant to set / change / remove their password.
 * To be embedded inside the exposant portal (e.g., in a "Sécurité" tab or as a banner).
 */
export function ExposantPasswordManager({ organizationId, hasPassword, onUpdated }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState(hasPassword ? 'change' : 'create');
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { setMode(hasPassword ? 'change' : 'create'); }, [hasPassword]);

  const submit = async () => {
    if (mode !== 'remove') {
      if (newPwd.length < 4) { toast.error('Min. 4 caractères'); return; }
      if (newPwd !== confirm) { toast.error('Les mots de passe ne correspondent pas'); return; }
    }
    setSubmitting(true);
    try {
      if (mode === 'remove') {
        await api(`/api/exposant/password?organization_id=${encodeURIComponent(organizationId)}`, { method: 'DELETE' });
        toast.success('Mot de passe supprimé');
      } else {
        await api('/api/exposant/password', {
          method: 'POST',
          body: JSON.stringify({
            password: newPwd,
            current_password: mode === 'change' ? currentPwd : undefined,
            organization_id: organizationId,
          }),
        });
        toast.success(mode === 'create' ? 'Mot de passe créé' : 'Mot de passe modifié');
      }
      setOpen(false);
      setCurrentPwd(''); setNewPwd(''); setConfirm('');
      onUpdated && onUpdated();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className={`border-2 ${hasPassword ? 'border-emerald-200 bg-emerald-50/40' : 'border-amber-200 bg-amber-50/40'}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {hasPassword ? (
              <Shield className="w-6 h-6 text-emerald-600" />
            ) : (
              <ShieldOff className="w-6 h-6 text-amber-600" />
            )}
            <div>
              <div className="font-semibold text-sm">
                {hasPassword ? 'Votre espace est protégé' : 'Sécurisez votre espace'}
              </div>
              <div className="text-xs text-slate-600">
                {hasPassword
                  ? 'Un mot de passe est requis pour accéder à votre dossier.'
                  : 'Définissez un mot de passe pour protéger l\'accès à votre dossier.'}
              </div>
            </div>
          </div>
          <Button size="sm" variant={hasPassword ? 'outline' : 'default'} onClick={() => { setMode(hasPassword ? 'change' : 'create'); setOpen(o => !o); }}>
            <KeyRound className="w-4 h-4 mr-1" />
            {hasPassword ? 'Modifier' : 'Créer un mot de passe'}
          </Button>
        </div>

        {open && (
          <div className="mt-4 pt-4 border-t space-y-3">
            <div className="flex gap-2 text-xs">
              <button onClick={() => setMode(hasPassword ? 'change' : 'create')} className={`px-3 py-1 rounded ${mode !== 'remove' ? 'bg-blue-600 text-white' : 'bg-slate-100'}`}>
                {hasPassword ? 'Changer le mot de passe' : 'Créer un mot de passe'}
              </button>
              {hasPassword && (
                <button onClick={() => setMode('remove')} className={`px-3 py-1 rounded ${mode === 'remove' ? 'bg-red-600 text-white' : 'bg-slate-100'}`}>
                  Supprimer la protection
                </button>
              )}
            </div>

            {mode === 'change' && (
              <div>
                <Label className="text-xs">Mot de passe actuel</Label>
                <Input type="password" value={currentPwd} onChange={e => setCurrentPwd(e.target.value)} />
              </div>
            )}
            {mode !== 'remove' && (
              <>
                <div>
                  <Label className="text-xs">{mode === 'create' ? 'Nouveau mot de passe' : 'Nouveau mot de passe'}</Label>
                  <Input type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)} placeholder="Min. 4 caractères" />
                </div>
                <div>
                  <Label className="text-xs">Confirmer le mot de passe</Label>
                  <Input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} />
                </div>
              </>
            )}
            {mode === 'remove' && (
              <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">
                ⚠️ Confirmer la suppression du mot de passe ? L&apos;accès via votre magic link sera de nouveau public.
              </div>
            )}
            <div className="flex gap-2">
              <Button size="sm" onClick={submit} disabled={submitting} className={mode === 'remove' ? 'bg-red-600 hover:bg-red-700' : ''}>
                {submitting ? '...' : (mode === 'remove' ? 'Supprimer' : 'Enregistrer')}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

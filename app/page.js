'use client';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { toast, Toaster } from 'sonner';
import { Mail, Loader2, Lock, ArrowRight, Eye, EyeOff, Sparkles } from 'lucide-react';
import { saveSession } from '@/lib/auth-client';

export default function HomePage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [magicSubmitting, setMagicSubmitting] = useState(false);
  const [magicSent, setMagicSent] = useState(false);
  const [sentRole, setSentRole] = useState(null);
  const [fallbackOffered, setFallbackOffered] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // 🛡️ Refs pour relire les inputs au moment du submit
  //    Critique pour gérer l'autofill du navigateur qui ne déclenche pas onChange dans tous les cas
  const emailRef = useRef(null);
  const pwdRef = useRef(null);

  // 🛡️ Sync state from refs after mount + on autofill animation (webkit hack)
  //    Garantit que email/password reflètent toujours ce que voit l'utilisateur
  useEffect(() => {
    const syncFromInputs = () => {
      const emailVal = emailRef.current?.value || '';
      const pwdVal = pwdRef.current?.value || '';
      if (emailVal && emailVal !== email) setEmail(emailVal);
      if (pwdVal && pwdVal !== password) setPassword(pwdVal);
    };
    // Une fois au mount (capte les autofills navigateur instantanés)
    const t1 = setTimeout(syncFromInputs, 100);
    const t2 = setTimeout(syncFromInputs, 500);
    const t3 = setTimeout(syncFromInputs, 1500);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  const cleanEmail = (emailRef.current?.value || email).trim().toLowerCase();
  const emailValid = /.+@.+\..+/.test(cleanEmail);

  // 🔐 Tentative de login par mot de passe — relit TOUJOURS depuis les refs (sécurité autofill)
  const submitPassword = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    // 🛡️ Source de vérité = la valeur affichée dans le champ (ref), pas le state
    const liveEmail = (emailRef.current?.value || email || '').trim().toLowerCase();
    const livePwd = pwdRef.current?.value || password || '';
    // Sync state si différent (pour l'UI suivante)
    if (liveEmail !== email) setEmail(liveEmail);
    if (livePwd !== password) setPassword(livePwd);

    if (!liveEmail || !/.+@.+\..+/.test(liveEmail)) { toast.error('Email invalide'); return; }
    if (!livePwd) { toast.error('Mot de passe requis'); return; }

    setSubmitting(true);
    setErrorMsg('');
    setFallbackOffered(false);
    try {
      const r = await fetch('/api/auth/password-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: liveEmail, password: livePwd }),
      });
      const d = await r.json();
      if (!r.ok) {
        setErrorMsg(d.error || 'Échec de la connexion');
        if (d.fallback_magic_link || d.requires_magic_link || d.no_password_set) {
          setFallbackOffered(true);
        }
        return;
      }
      // Sauvegarde la session avec le bon format
      saveSession({
        id: d.user.id,
        email: d.user.email,
        role: d.user.role_code,
        name: d.user.full_name || d.user.name,
        organization_id: d.user.organization_id || null,
        registration_id: d.user.registration_id || null,
        accessed_via_password: true,
      });
      toast.success(`Bienvenue ${d.user.full_name || d.user.name || ''}`);
      router.push(d.redirect || '/');
    } catch (e) {
      setErrorMsg(e.message || 'Erreur réseau');
    } finally {
      setSubmitting(false);
    }
  };

  // 🪄 Envoi du magic link (fallback ou volontaire) — même bulletproof depuis ref
  const sendMagicLink = async () => {
    const liveEmail = (emailRef.current?.value || email || '').trim().toLowerCase();
    if (!liveEmail || !/.+@.+\..+/.test(liveEmail)) { toast.error('Email invalide'); return; }
    setMagicSubmitting(true);
    try {
      const r = await fetch('/api/auth/request-magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: liveEmail }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Impossible d\'envoyer le lien');
      setMagicSent(true);
      setSentRole(d.role || null);
      setErrorMsg('');
      setFallbackOffered(false);
      toast.success('Lien envoyé. Consultez votre boîte mail (et les spams).');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setMagicSubmitting(false);
    }
  };

  // Reset state pour recommencer
  const resetForm = () => {
    setMagicSent(false);
    setSentRole(null);
    setEmail('');
    setPassword('');
    setErrorMsg('');
    setFallbackOffered(false);
    if (emailRef.current) emailRef.current.value = '';
    if (pwdRef.current) pwdRef.current.value = '';
  };

  return (
    <div className="min-h-screen bg-aracom-black text-aracom-beige-pale flex flex-col">
      <Toaster position="top-right" theme="dark" richColors />

      {/* Header sobre */}
      <header className="border-b border-aracom-gold/20 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-2xl">🌺</div>
            <div>
              <div className="text-sm font-bold tracking-wider">FORUM DE LA RENTRÉE 2026</div>
              <div className="text-xs text-aracom-gold/70 mt-0.5">14 & 15 août 2026 · Polynésie française</div>
            </div>
          </div>
          <div className="text-xs text-aracom-gold/60 hidden sm:block">ARACOM Conseil</div>
        </div>
      </header>

      {/* Hero — Connexion */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="max-w-md w-full space-y-6">

          <div className="text-center space-y-2">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Bienvenue</h1>
            <p className="text-aracom-gold/80 text-sm">
              Espace officiel du <b className="text-aracom-beige-pale">Forum de la Rentrée 2026</b> · organisé par ARACOM.
            </p>
          </div>

          {/* Carte principale */}
          <Card className="bg-aracom-black border border-aracom-gold/30 shadow-2xl">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-md bg-aracom-gold flex items-center justify-center shadow-lg">
                  <Lock className="w-6 h-6 text-aracom-black" />
                </div>
                <div>
                  <div className="text-[10px] tracking-[0.2em] uppercase text-aracom-gold/70">Connexion</div>
                  <div className="text-xl font-bold text-aracom-beige-pale">Accès à votre espace</div>
                </div>
              </div>

              {magicSent ? (
                <div className="bg-aracom-gold/10 border border-aracom-gold/40 rounded-lg p-4 space-y-2 text-sm">
                  <div className="text-aracom-beige-pale">
                    ✓ Lien envoyé à <b className="text-aracom-gold">{cleanEmail}</b>
                  </div>
                  <div className="text-xs text-aracom-gold/70">
                    Cliquez sur le lien reçu pour accéder à votre espace.
                    {sentRole === 'exposant' && ' Vous pourrez ensuite créer un mot de passe pour vous connecter directement la prochaine fois.'}
                  </div>
                  <button
                    onClick={resetForm}
                    className="text-xs text-aracom-gold underline-offset-4 hover:underline"
                  >Renvoyer à un autre email</button>
                </div>
              ) : (
                <form
                  onSubmit={(e) => { e.preventDefault(); e.stopPropagation(); submitPassword(e); return false; }}
                  noValidate
                  className="space-y-4"
                >
                  {/* Champ Email */}
                  <div className="space-y-1.5">
                    <label htmlFor="email-input" className="text-[11px] tracking-wider uppercase text-aracom-gold/70">Email</label>
                    <Input
                      id="email-input"
                      ref={emailRef}
                      type="email"
                      name="email"
                      autoComplete="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      onBlur={e => setEmail(e.target.value)}
                      placeholder="votre@email.com"
                      className="bg-aracom-black/60 border-aracom-gold/30 text-aracom-beige-pale placeholder:text-aracom-gold/40 focus-visible:ring-aracom-gold focus-visible:border-aracom-gold"
                      data-testid="email-input"
                    />
                  </div>

                  {/* Champ Mot de passe */}
                  <div className="space-y-1.5">
                    <label htmlFor="pwd-input" className="text-[11px] tracking-wider uppercase text-aracom-gold/70">Mot de passe</label>
                    <div className="relative">
                      <Input
                        id="pwd-input"
                        ref={pwdRef}
                        type={showPwd ? 'text' : 'password'}
                        name="password"
                        autoComplete="current-password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        onBlur={e => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="bg-aracom-black/60 border-aracom-gold/30 text-aracom-beige-pale placeholder:text-aracom-gold/40 focus-visible:ring-aracom-gold focus-visible:border-aracom-gold pr-10"
                        data-testid="password-input"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPwd(s => !s)}
                        tabIndex={-1}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-aracom-gold/50 hover:text-aracom-gold"
                      >
                        {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Message d'erreur + fallback magic link */}
                  {errorMsg && (
                    <div className="bg-red-950/40 border border-red-700/40 rounded-md px-3 py-2 text-xs text-red-200 space-y-2">
                      <div>⚠️ {errorMsg}</div>
                      {fallbackOffered && (
                        <Button
                          type="button"
                          onClick={sendMagicLink}
                          disabled={magicSubmitting}
                          size="sm"
                          className="w-full bg-aracom-gold/20 border border-aracom-gold/40 text-aracom-beige-pale hover:bg-aracom-gold hover:text-aracom-black"
                        >
                          {magicSubmitting ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <Mail className="w-3 h-3 mr-2" />}
                          Recevoir un lien magique par email
                        </Button>
                      )}
                    </div>
                  )}

                  {/* 🛡️ BOUTON DE CONNEXION — JAMAIS désactivé sauf en cours d'envoi
                       (la validation se fait dans submitPassword pour gérer l'autofill navigateur) */}
                  <Button
                    type="submit"
                    disabled={submitting}
                    className="w-full bg-aracom-gold text-aracom-black hover:bg-aracom-beige-clair font-medium tracking-wider disabled:opacity-70"
                    data-testid="submit-login"
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ArrowRight className="w-4 h-4 mr-2" />}
                    Se connecter
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>

          {/* Lien discret : pas encore de mot de passe → magic link */}
          {!magicSent && (
            <div className="text-center text-xs text-aracom-gold/60 space-y-1">
              <div>
                Pas encore de mot de passe ?{' '}
                <button
                  type="button"
                  onClick={sendMagicLink}
                  disabled={magicSubmitting}
                  className="text-aracom-gold underline-offset-4 hover:underline inline-flex items-center gap-1 disabled:opacity-50"
                  data-testid="send-magic-link"
                >
                  <Sparkles className="w-3 h-3" /> Recevoir un lien magique
                </button>
              </div>
              <div className="text-aracom-gold/40">
                Saisissez d&apos;abord votre email ci-dessus
              </div>
            </div>
          )}

          {/* Première inscription publique */}
          <div className="text-center text-xs text-aracom-gold/60 pt-2 border-t border-aracom-gold/15">
            Pas encore inscrit au Forum ?{' '}
            <a href="/inscription" className="text-aracom-gold underline-offset-4 hover:underline inline-flex items-center gap-1">
              Démarrer mon inscription <ArrowRight className="w-3 h-3" />
            </a>
          </div>

          <div className="text-center text-[10px] tracking-[0.15em] uppercase text-aracom-gold/30 pt-2">
            ARACOM Conseil · Édition 2026
          </div>
        </div>
      </main>
    </div>
  );
}

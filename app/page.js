'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { toast, Toaster } from 'sonner';
import { Mail, Loader2, Shield, ArrowRight } from 'lucide-react';
import { saveSession } from '@/lib/auth-client';

export default function HomePage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [sentRole, setSentRole] = useState(null);

  // Bypass admin "express" via mot de passe universel (caché par défaut)
  const [showAdminBypass, setShowAdminBypass] = useState(false);
  const [adminCode, setAdminCode] = useState('');
  const [adminSubmitting, setAdminSubmitting] = useState(false);

  const sendMagicLink = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !/.+@.+\..+/.test(cleanEmail)) {
      toast.error('Email invalide'); return;
    }
    setSubmitting(true);
    try {
      const r = await fetch('/api/auth/request-magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Impossible d\'envoyer le lien');
      setSent(true);
      setSentRole(d.role || null);
      toast.success('Lien envoyé. Consultez votre boîte mail (et les spams).');
    } catch (e) { toast.error(e.message); }
    finally { setSubmitting(false); }
  };

  const submitAdminCode = async () => {
    if (!adminCode) return;
    setAdminSubmitting(true);
    try {
      const r = await fetch('/api/auth/code-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: adminCode, role: 'aracom_admin' }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Code incorrect');
      saveSession(d.user);
      toast.success(`Bienvenue ${d.user.name}`);
      router.push('/aracom');
    } catch (e) { toast.error(e.message); }
    finally { setAdminSubmitting(false); }
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

      {/* Hero — Connexion unifiée */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="max-w-md w-full space-y-6">

          <div className="text-center space-y-2">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Bienvenue</h1>
            <p className="text-aracom-gold/80 text-sm">
              Espace officiel du <b className="text-aracom-beige-pale">Forum de la Rentrée 2026</b> · organisé par ARACOM.
            </p>
          </div>

          {/* Carte principale — Magic link unique */}
          <Card className="bg-aracom-black border border-aracom-gold/30 shadow-2xl">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-md bg-aracom-gold flex items-center justify-center shadow-lg">
                  <Mail className="w-6 h-6 text-aracom-black" />
                </div>
                <div>
                  <div className="text-[10px] tracking-[0.2em] uppercase text-aracom-gold/70">Connexion</div>
                  <div className="text-xl font-bold text-aracom-beige-pale">Lien par email</div>
                </div>
              </div>

              {sent ? (
                <div className="bg-aracom-gold/10 border border-aracom-gold/40 rounded-lg p-4 space-y-2 text-sm">
                  <div className="text-aracom-beige-pale">
                    ✓ Lien envoyé à <b className="text-aracom-gold">{email}</b>
                  </div>
                  <div className="text-xs text-aracom-gold/70">
                    Cliquez sur le lien reçu pour accéder à votre espace.
                    {sentRole === 'aracom_admin' && ' — Vous êtes reconnu comme administrateur ARACOM.'}
                    {sentRole === 'pacific_centers_readonly' && ' — Vous êtes reconnu comme Pacific Centers.'}
                    {sentRole === 'exposant' && ' — Vous êtes reconnu comme exposant.'}
                  </div>
                  <button
                    onClick={() => { setSent(false); setEmail(''); setSentRole(null); }}
                    className="text-xs text-aracom-gold underline-offset-4 hover:underline"
                  >Renvoyer à un autre email</button>
                </div>
              ) : (
                <>
                  <p className="text-xs text-aracom-gold/70">
                    Entrez votre email professionnel. Vous recevrez un lien personnel sécurisé pour accéder à votre espace.
                  </p>
                  <Input
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && sendMagicLink()}
                    placeholder="votre@email.com"
                    className="bg-aracom-black/60 border-aracom-gold/30 text-aracom-beige-pale placeholder:text-aracom-gold/40 focus-visible:ring-aracom-gold focus-visible:border-aracom-gold"
                    data-testid="email-input"
                  />
                  <Button
                    onClick={sendMagicLink}
                    disabled={!email || submitting}
                    className="w-full bg-aracom-gold text-aracom-black hover:bg-aracom-beige-clair font-medium tracking-wider"
                    data-testid="send-magic"
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Mail className="w-4 h-4 mr-2" />}
                    Recevoir mon lien de connexion
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          {/* Première inscription */}
          <div className="text-center text-xs text-aracom-gold/60">
            Pas encore inscrit ?{' '}
            <a href="/inscription" className="text-aracom-gold underline-offset-4 hover:underline inline-flex items-center gap-1">
              Démarrer mon inscription <ArrowRight className="w-3 h-3" />
            </a>
          </div>

          {/* Bypass admin — accordéon discret */}
          <div className="border-t border-aracom-gold/15 pt-4 text-center">
            {!showAdminBypass ? (
              <button
                onClick={() => setShowAdminBypass(true)}
                className="text-[11px] text-aracom-gold/50 hover:text-aracom-gold inline-flex items-center gap-1 transition"
              >
                <Shield className="w-3 h-3" /> Accès administrateur direct
              </button>
            ) : (
              <div className="bg-aracom-black/40 border border-aracom-gold/15 rounded-lg p-3 space-y-2">
                <div className="text-[10px] tracking-[0.18em] uppercase text-aracom-gold/60 flex items-center justify-center gap-1">
                  <Shield className="w-3 h-3" /> Mot de passe administrateur
                </div>
                <div className="flex gap-2">
                  <Input
                    type="password"
                    value={adminCode}
                    onChange={e => setAdminCode(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && submitAdminCode()}
                    placeholder="••••••••••••"
                    className="bg-aracom-black/60 border-aracom-gold/20 text-aracom-beige-pale placeholder:text-aracom-gold/30 text-sm h-9"
                    data-testid="admin-code"
                  />
                  <Button
                    onClick={submitAdminCode}
                    disabled={!adminCode || adminSubmitting}
                    size="sm"
                    className="bg-aracom-gold/20 border border-aracom-gold/40 text-aracom-beige-pale hover:bg-aracom-gold hover:text-aracom-black h-9"
                    data-testid="submit-admin"
                  >
                    {adminSubmitting ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Entrer'}
                  </Button>
                </div>
                <button
                  onClick={() => { setShowAdminBypass(false); setAdminCode(''); }}
                  className="text-[10px] text-aracom-gold/40 hover:text-aracom-gold/70"
                >Fermer</button>
              </div>
            )}
          </div>

          <div className="text-center text-[10px] tracking-[0.15em] uppercase text-aracom-gold/30 pt-2">
            ARACOM Conseil · Édition 2026
          </div>
        </div>
      </main>
    </div>
  );
}

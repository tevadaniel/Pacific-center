'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { toast, Toaster } from 'sonner';
import { Shield, Mail, Loader2, ArrowRight } from 'lucide-react';
import { saveSession } from '@/lib/auth-client';

export default function HomePage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [magicEmail, setMagicEmail] = useState('');
  const [magicSubmitting, setMagicSubmitting] = useState(false);
  const [magicSent, setMagicSent] = useState(false);

  const submit = async () => {
    if (!code) return;
    setSubmitting(true);
    try {
      const r = await fetch('/api/auth/code-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, role: 'aracom_admin' }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Code incorrect');
      saveSession(d.user);
      toast.success(`Bienvenue ${d.user.name}`);
      router.push('/aracom');
    } catch (e) { toast.error(e.message); }
    finally { setSubmitting(false); }
  };

  const sendMagicLink = async () => {
    if (!magicEmail || !/.+@.+\..+/.test(magicEmail)) {
      toast.error('Email invalide'); return;
    }
    setMagicSubmitting(true);
    try {
      const r = await fetch('/api/auth/request-magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: magicEmail.trim().toLowerCase() }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Impossible d\'envoyer le lien');
      setMagicSent(true);
      toast.success('Lien envoyé ! Consultez votre boîte mail.');
    } catch (e) { toast.error(e.message); }
    finally { setMagicSubmitting(false); }
  };

  return (
    <div className="min-h-screen bg-aracom-black text-aracom-beige-pale flex flex-col">
      <Toaster position="top-right" theme="dark" richColors />

      {/* Header */}
      <header className="border-b border-aracom-gold/20 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-2xl">🌺</div>
            <div>
              <div className="text-sm font-semibold tracking-[0.18em] uppercase">Forum de la Rentrée 2026</div>
              <div className="text-xs text-aracom-gold/70 mt-0.5">14 & 15 août 2026 · Polynésie française</div>
            </div>
          </div>
          <div className="text-[10px] tracking-[0.2em] uppercase text-aracom-gold/60 hidden sm:block">ARACOM Conseil · Édition 2026</div>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <h1 className="font-serif text-5xl md:text-6xl tracking-tight text-aracom-beige-pale">Bienvenue</h1>
            <div className="mt-3 inline-block h-[1px] w-16 bg-aracom-gold"></div>
            <p className="mt-3 text-aracom-gold/80 text-sm tracking-wide">Connexion à la plateforme du Forum</p>
          </div>

          {/* ARACOM admin login */}
          <Card className="bg-aracom-black border border-aracom-gold/30 shadow-2xl">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-md bg-aracom-gold flex items-center justify-center shadow-lg">
                  <Shield className="w-6 h-6 text-aracom-black" />
                </div>
                <div>
                  <div className="text-[10px] tracking-[0.2em] uppercase text-aracom-gold/70">Administration</div>
                  <div className="font-serif text-2xl text-aracom-beige-pale">Accès ARACOM</div>
                </div>
              </div>
              <Input
                type="password"
                value={code}
                onChange={e => setCode(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submit()}
                placeholder="Code d'accès"
                className="bg-aracom-black/60 border-aracom-gold/20 text-aracom-beige-pale placeholder:text-aracom-gold/40 focus-visible:ring-aracom-gold focus-visible:border-aracom-gold"
                data-testid="code-input"
              />
              <Button
                onClick={submit}
                disabled={!code || submitting}
                className="w-full bg-aracom-gold text-aracom-black hover:bg-aracom-beige-clair font-medium tracking-wider"
                data-testid="submit-code"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Accéder au cockpit
              </Button>
            </CardContent>
          </Card>

          {/* Magic link exposant */}
          <div className="border-t border-aracom-gold/15 pt-6">
            <div className="text-center mb-3">
              <div className="text-[10px] tracking-[0.2em] uppercase text-aracom-gold/70">Exposants</div>
              <div className="text-sm text-aracom-beige-pale/85 mt-1.5">Recevez votre lien de connexion par email</div>
            </div>
            {magicSent ? (
              <div className="bg-aracom-gold/10 border border-aracom-gold/40 rounded-lg p-4 text-center text-sm text-aracom-beige-pale">
                ✓ Lien envoyé à <b className="text-aracom-gold">{magicEmail}</b><br />
                <span className="text-xs text-aracom-gold/70">Vérifiez votre boîte mail (et les spams).</span>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input
                  type="email"
                  value={magicEmail}
                  onChange={e => setMagicEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendMagicLink()}
                  placeholder="votre@email.com"
                  className="bg-aracom-black/60 border-aracom-gold/20 text-aracom-beige-pale placeholder:text-aracom-gold/40 focus-visible:ring-aracom-gold focus-visible:border-aracom-gold"
                  data-testid="magic-email"
                />
                <Button
                  onClick={sendMagicLink}
                  disabled={magicSubmitting || !magicEmail}
                  variant="outline"
                  className="bg-transparent border-aracom-gold/50 text-aracom-gold hover:bg-aracom-gold hover:text-aracom-black"
                  data-testid="send-magic"
                >
                  {magicSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Mail className="w-4 h-4 mr-1" /> Recevoir</>}
                </Button>
              </div>
            )}
          </div>

          <div className="text-center text-xs text-aracom-gold/60">
            Pas encore inscrit ? <a href="/inscription" className="text-aracom-gold underline-offset-4 hover:underline inline-flex items-center gap-1">Démarrer mon inscription <ArrowRight className="w-3 h-3" /></a>
          </div>

          <div className="text-center text-[10px] tracking-[0.15em] uppercase text-aracom-gold/40">
            Powered by ARACOM Conseil · aracompacificcenters.com
          </div>
        </div>
      </main>
    </div>
  );
}

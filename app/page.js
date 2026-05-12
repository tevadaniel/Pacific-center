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
    <div className="min-h-screen bg-black text-white flex flex-col">
      <Toaster position="top-right" theme="dark" richColors />

      {/* Header */}
      <header className="border-b border-white/10 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-2xl">🌺</div>
            <div>
              <div className="text-sm font-bold tracking-wider">FORUM DE LA RENTRÉE 2026</div>
              <div className="text-xs text-white/50">14 & 15 août 2026 · Polynésie française</div>
            </div>
          </div>
          <div className="text-xs text-white/40 hidden sm:block">ARACOM × Pacific Centers</div>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Bienvenue</h1>
            <p className="mt-2 text-white/60 text-sm">Connexion à la plateforme du Forum</p>
          </div>

          {/* ARACOM admin login */}
          <Card className="bg-zinc-950 border-blue-400/40">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center shadow-lg">
                  <Shield className="w-6 h-6 text-white" />
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wider text-white/40">Administration</div>
                  <div className="text-xl font-bold text-white">Accès ARACOM</div>
                </div>
              </div>
              <Input
                type="password"
                value={code}
                onChange={e => setCode(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submit()}
                placeholder="Code d'accès"
                className="bg-zinc-900 border-zinc-800 text-white placeholder:text-white/30 focus-visible:ring-blue-500"
                data-testid="code-input"
              />
              <Button
                onClick={submit}
                disabled={!code || submitting}
                className="w-full bg-white text-black hover:bg-white/90"
                data-testid="submit-code"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Accéder au cockpit
              </Button>
            </CardContent>
          </Card>

          {/* Magic link exposant */}
          <div className="border-t border-white/10 pt-6">
            <div className="text-center mb-3">
              <div className="text-xs uppercase tracking-wider text-white/40">Exposants</div>
              <div className="text-sm text-white/70 mt-1">Recevez votre lien de connexion par email</div>
            </div>
            {magicSent ? (
              <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-lg p-4 text-center text-sm text-emerald-300">
                ✓ Lien envoyé à <b>{magicEmail}</b><br />
                <span className="text-xs text-emerald-400/70">Vérifiez votre boîte mail (et les spams).</span>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input
                  type="email"
                  value={magicEmail}
                  onChange={e => setMagicEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendMagicLink()}
                  placeholder="votre@email.com"
                  className="bg-zinc-900 border-zinc-800 text-white placeholder:text-white/30 focus-visible:ring-emerald-500"
                  data-testid="magic-email"
                />
                <Button
                  onClick={sendMagicLink}
                  disabled={magicSubmitting || !magicEmail}
                  variant="outline"
                  className="bg-emerald-600/20 border-emerald-500/50 text-emerald-300 hover:bg-emerald-600/30 hover:text-emerald-200"
                  data-testid="send-magic"
                >
                  {magicSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Mail className="w-4 h-4 mr-1" /> Recevoir</>}
                </Button>
              </div>
            )}
          </div>

          <div className="text-center text-xs text-white/30">
            Pas encore inscrit ? <a href="/inscription" className="underline hover:text-white/60 inline-flex items-center gap-1">Démarrer mon inscription <ArrowRight className="w-3 h-3" /></a>
          </div>

          <div className="text-center text-[10px] text-white/20">
            Powered by ARACOM Conseil · aracompacificcenters.com
          </div>
        </div>
      </main>
    </div>
  );
}

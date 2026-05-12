'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast, Toaster } from 'sonner';
import { Shield, Users, Eye, Lock, Loader2 } from 'lucide-react';
import { saveSession, getSession } from '@/lib/auth-client';

const ROLES = [
  {
    key: 'aracom_admin',
    title: 'ARACOM',
    subtitle: 'Administration',
    description: 'Tableau de bord, exposants, sites, cautions, mailing, bilans',
    icon: Shield,
    gradient: 'from-blue-600 to-indigo-700',
    border: 'border-blue-400/40 hover:border-blue-400',
  },
  {
    key: 'exposant',
    title: 'Exposant',
    subtitle: 'Inscription & profil',
    description: 'Inscription en 5 étapes, gestion de votre stand et animation',
    icon: Users,
    gradient: 'from-emerald-600 to-teal-700',
    border: 'border-emerald-400/40 hover:border-emerald-400',
  },
  {
    key: 'pacific_centers_readonly',
    title: 'Pacific Centers',
    subtitle: 'Suivi des sites',
    description: 'Vue lecture seule sur l\'occupation et les animations',
    icon: Eye,
    gradient: 'from-cyan-600 to-sky-700',
    border: 'border-cyan-400/40 hover:border-cyan-400',
  },
];

export default function HomePage() {
  const router = useRouter();
  const [selected, setSelected] = useState(null); // role key
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Pas d'auto-redirect : on laisse toujours l'utilisateur choisir son portail
  // et ressaisir le code, même s'il a déjà une session active dans le navigateur.

  const submit = async () => {
    if (!selected || !code) return;
    setSubmitting(true);
    try {
      const r = await fetch('/api/auth/code-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, role: selected }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Code incorrect');

      if (selected === 'exposant') {
        router.push(d.redirect || '/inscription');
        return;
      }

      // Persist session
      saveSession(d.user);
      toast.success(`Bienvenue ${d.user.name}`);
      if (d.user.role === 'aracom_admin') router.push('/aracom');
      else if (d.user.role === 'pacific_centers_readonly') router.push('/pacific');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
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
        <div className="max-w-5xl w-full">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight">Bienvenue sur la plateforme</h1>
            <p className="mt-3 text-white/60 text-sm md:text-base">Choisissez votre espace pour vous connecter</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {ROLES.map(r => {
              const Icon = r.icon;
              return (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => setSelected(r.key)}
                  className={`group relative bg-zinc-950 border ${r.border} rounded-2xl p-6 text-left transition-all hover:bg-zinc-900 hover:-translate-y-1`}
                  data-testid={`role-${r.key}`}
                >
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${r.gradient} flex items-center justify-center mb-4 shadow-lg`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="text-xs uppercase tracking-wider text-white/40 mb-1">{r.subtitle}</div>
                  <div className="text-xl font-bold mb-2">{r.title}</div>
                  <div className="text-xs text-white/50 leading-relaxed">{r.description}</div>
                  <div className="mt-4 inline-flex items-center gap-1.5 text-xs text-white/40 group-hover:text-white/70 transition">
                    <Lock className="w-3 h-3" /> Code d&apos;accès requis
                  </div>
                </button>
              );
            })}
          </div>

          <div className="text-center mt-10 text-xs text-white/30">
            Powered by ARACOM Conseil · aracompacificcenters.com
          </div>
        </div>
      </main>

      {/* Code dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => { if (!o) { setSelected(null); setCode(''); } }}>
        <DialogContent className="bg-zinc-950 border-zinc-800 text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white">{ROLES.find(r => r.key === selected)?.title}</DialogTitle>
            <DialogDescription className="text-white/60">Entrez le code d&apos;accès pour continuer.</DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Input
              type="password"
              value={code}
              onChange={e => setCode(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submit()}
              placeholder="••••••••••••"
              autoFocus
              className="bg-zinc-900 border-zinc-800 text-white placeholder:text-white/30 focus-visible:ring-blue-500"
              data-testid="code-input"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setSelected(null); setCode(''); }} className="bg-transparent border-zinc-800 text-white hover:bg-zinc-900 hover:text-white">Annuler</Button>
            <Button onClick={submit} disabled={!code || submitting} className="bg-white text-black hover:bg-white/90" data-testid="submit-code">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Accéder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

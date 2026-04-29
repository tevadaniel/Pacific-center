'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Shield, Sparkles, MapPin, Mail, Info } from 'lucide-react';
import { saveSession, getSession } from '@/lib/auth-client';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [bootChecked, setBootChecked] = useState(false);
  const [stats, setStats] = useState({ sites: 4, associations: 66, stands: 53 });

  useEffect(() => {
    const s = getSession();
    if (s?.role) redirectByRole(s.role, router);
    setBootChecked(true);
    fetch('/api/stats/public').then(r => r.json()).then(d => d?.sites && setStats(d)).catch(() => {});
  }, [router]);

  const redirectByRole = (role, r) => {
    if (role === 'aracom_admin') r.push('/aracom');
    else if (role === 'exposant') r.push('/exposant');
    else if (role === 'pacific_centers_readonly') r.push('/pacific');
  };

  const runSeed = async () => {
    setSeeding(true);
    try {
      // 🛡️ SAFE MODE : force=false → idempotent, ne wipe JAMAIS la DB existante.
      // Pour réinitialiser, il faut explicitement passer par /api/tools/reset-db (protégé par confirmation stricte).
      const res = await fetch('/api/seed', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ force: false }) });
      const data = await res.json();
      if (data.seeded) toast.success(`✅ Base initialisée : ${data.associations} associations créées.`);
      else toast.info('✅ Base déjà peuplée — aucune modification effectuée.');
    } catch (e) {
      toast.error('Erreur de vérification : ' + e.message);
    } finally { setSeeding(false); }
  };

  const login = async (em, pw) => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: em, password: pw }) });
      if (!res.ok) {
        const t = await res.json().catch(() => ({}));
        throw new Error(t.error || 'Erreur de connexion');
      }
      const data = await res.json();
      saveSession({ id: data.user.id, email: data.user.email, role: data.user.role_code, name: data.user.full_name, organization_id: data.user.organization_id });
      toast.success(`Bienvenue ${data.user.full_name}`);
      redirectByRole(data.user.role_code, router);
    } catch (e) {
      toast.error(e.message);
    } finally { setLoading(false); }
  };

  const onSubmit = (e) => { e.preventDefault(); login(email, password); };

  if (!bootChecked) return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-emerald-50 px-4 py-8">
      <div className="w-full max-w-5xl grid md:grid-cols-2 gap-6">
        <div className="flex flex-col justify-center space-y-6 p-2">
          <div className="flex items-center gap-3">
            <div className="w-16 h-16 rounded-xl bg-white flex items-center justify-center shadow-lg p-2 ring-1 ring-slate-200 relative">
              <Image src="/aracom-logo.png" alt="ARACOM" fill className="object-contain p-1.5" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-slate-500">ARACOM</p>
              <h1 className="text-xl font-bold text-slate-900">Forum de la Rentrée 2026</h1>
              <p className="text-[11px] text-slate-500">Vendredi 14 &amp; samedi 15 août 2026</p>
            </div>
          </div>
          <div>
            <h2 className="text-4xl font-bold tracking-tight text-slate-900">
              Pilotage opérationnel<br/>
              <span className="text-blue-600">de A à Z.</span>
            </h2>
            <p className="mt-4 text-slate-600 leading-relaxed">
              La source de vérité pour {stats.sites} sites, {stats.associations} associations et le suivi terrain du Forum.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[{ t: String(stats.sites), l: 'sites' }, { t: String(stats.associations), l: 'associations' }, { t: String(stats.stands), l: 'stands' }].map((k, i) => (
              <div key={i} className="rounded-xl border bg-white p-4 text-center shadow-sm">
                <div className="text-2xl font-bold text-slate-900">{k.t}</div>
                <div className="text-xs uppercase tracking-wider text-slate-500">{k.l}</div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            {['Dashboard temps réel', 'Mode Jour J mobile', 'Validations & cautions', 'Anomalies équipées', 'Bilans auto', 'Mailing IA', 'Push temps réel'].map(f => (
              <Badge key={f} variant="secondary" className="bg-white border">{f}</Badge>
            ))}
          </div>
        </div>

        <Card className="shadow-xl border-slate-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Shield className="w-5 h-5 text-blue-600" /> Connexion ARACOM</CardTitle>
            <CardDescription>Espace réservé à l&apos;équipe ARACOM.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <form onSubmit={onSubmit} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@aracom.pf" required autoFocus />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pw">Mot de passe</Label>
                <Input id="pw" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
              </div>
              <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={loading}>
                {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Connexion…</> : 'Se connecter'}
              </Button>
            </form>

            <div className="rounded-md bg-blue-50 border border-blue-200 p-3 text-sm space-y-2">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-blue-900">Vous êtes Exposant ou Pacific Centers ?</div>
                  <div className="text-xs text-blue-800 mt-1">L&apos;accès se fait <b>uniquement</b> via le lien personnel envoyé par ARACOM par email. Aucun mot de passe à saisir, aucun compte à créer.</div>
                  <div className="text-xs text-blue-800 mt-2 flex items-center gap-1.5">
                    <Mail className="w-3 h-3" /> Pas reçu votre lien ? Contactez ARACOM : <a className="underline" href="mailto:agence@aracom-conseil.fr">agence@aracom-conseil.fr</a>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t">
              <Button variant="ghost" className="w-full text-slate-600 text-xs" onClick={runSeed} disabled={seeding}>
                {seeding ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                Vérifier les données initiales (idempotent)
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

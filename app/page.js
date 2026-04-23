'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Shield, Users, Eye, Sparkles, MapPin } from 'lucide-react';
import { saveSession, getSession } from '@/lib/auth-client';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('demo');
  const [loading, setLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [bootChecked, setBootChecked] = useState(false);

  useEffect(() => {
    const s = getSession();
    if (s?.role) redirectByRole(s.role, router);
    setBootChecked(true);
  }, [router]);

  const redirectByRole = (role, r) => {
    if (role === 'aracom_admin') r.push('/aracom');
    else if (role === 'exposant') r.push('/exposant');
    else if (role === 'pacific_centers_readonly') r.push('/pacific');
  };

  const runSeed = async () => {
    setSeeding(true);
    try {
      const res = await fetch('/api/seed', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ force: true }) });
      const data = await res.json();
      if (data.seeded) toast.success(`Données initialisées : ${data.associations} associations, ${data.stands_planned} stands planifiés.`);
      else toast.info(data.message || 'Données déjà présentes');
    } catch (e) {
      toast.error('Erreur de seed: ' + e.message);
    } finally { setSeeding(false); }
  };

  const login = async (em, pw) => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: em, password: pw }) });
      if (!res.ok) {
        const t = await res.json();
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
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-emerald-500 flex items-center justify-center shadow-lg">
              <MapPin className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-slate-500">ARACOM • Pacific Centers</p>
              <h1 className="text-xl font-bold text-slate-900">Forum de la Rentrée 2026</h1>
            </div>
          </div>
          <div>
            <h2 className="text-4xl font-bold tracking-tight text-slate-900">
              Pilotage opérationnel<br/>
              <span className="text-blue-600">de A à Z.</span>
            </h2>
            <p className="mt-4 text-slate-600 leading-relaxed">
              La source de vérité pour les 6 sites, 67 associations et le suivi terrain du vendredi 14 &amp; samedi 15 août 2026. Exit Excel, mails et relances manuelles.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[{ t: '6', l: 'sites' }, { t: '67', l: 'associations' }, { t: '57', l: 'stands' }].map((k, i) => (
              <div key={i} className="rounded-xl border bg-white p-4 text-center shadow-sm">
                <div className="text-2xl font-bold text-slate-900">{k.t}</div>
                <div className="text-xs uppercase tracking-wider text-slate-500">{k.l}</div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            {['Dashboard temps réel', 'Mode Jour J mobile', 'Check-in / Check-out', 'Anomalies équipées', 'Bilans auto', 'Portail exposant', 'Vue Pacific Centers'].map(f => (
              <Badge key={f} variant="secondary" className="bg-white border">{f}</Badge>
            ))}
          </div>
        </div>

        <Card className="shadow-xl border-slate-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Shield className="w-5 h-5 text-blue-600" /> Connexion</CardTitle>
            <CardDescription>Accédez à votre portail selon votre rôle.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Accès rapide démo</div>
              <div className="grid gap-2">
                <Button variant="outline" disabled={loading} onClick={() => login('admin@aracom.pf', 'demo')} className="justify-start h-auto py-3">
                  <Shield className="w-4 h-4 text-blue-600 mr-3" />
                  <div className="text-left">
                    <div className="font-semibold">ARACOM admin</div>
                    <div className="text-xs text-slate-500">admin@aracom.pf — accès total</div>
                  </div>
                </Button>
                <Button variant="outline" disabled={loading} onClick={() => login('swimua.tahiti@gmail.com', 'demo')} className="justify-start h-auto py-3">
                  <Users className="w-4 h-4 text-emerald-600 mr-3" />
                  <div className="text-left">
                    <div className="font-semibold">Exposant (exemple : I Mua Papeete)</div>
                    <div className="text-xs text-slate-500">Portail dossier exposant</div>
                  </div>
                </Button>
                <Button variant="outline" disabled={loading} onClick={() => login('pacific@centers.pf', 'demo')} className="justify-start h-auto py-3">
                  <Eye className="w-4 h-4 text-violet-600 mr-3" />
                  <div className="text-left">
                    <div className="font-semibold">Pacific Centers</div>
                    <div className="text-xs text-slate-500">Lecture seule — synthèse</div>
                  </div>
                </Button>
              </div>
            </div>
            <div className="rounded-md bg-emerald-50 border border-emerald-100 p-3 text-sm">
              <div className="font-medium text-emerald-900 mb-1">Pas encore inscrit ?</div>
              <Link href="/inscription"><Button variant="link" className="h-auto p-0 text-emerald-700">Créer un compte exposant (auto-inscription) →</Button></Link>
            </div>
            <div className="relative">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t" /></div>
              <div className="relative flex justify-center text-xs"><span className="bg-white px-2 text-slate-500">ou connexion manuelle</span></div>
            </div>
            <form onSubmit={onSubmit} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@aracom.pf" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pw">Mot de passe</Label>
                <Input id="pw" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
                <p className="text-[11px] text-slate-400">Mot de passe démo : <code className="bg-slate-100 px-1 rounded">demo</code></p>
              </div>
              <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={loading}>
                {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Connexion…</> : 'Se connecter'}
              </Button>
            </form>
            <div className="pt-3 border-t">
              <Button variant="ghost" className="w-full text-slate-600" onClick={runSeed} disabled={seeding}>
                {seeding ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                Initialiser / réinitialiser les données démo
              </Button>
              <p className="text-[11px] text-slate-400 mt-1 text-center">Crée les 6 sites, 67 associations, 57 stands et les utilisateurs démo.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

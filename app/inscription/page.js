'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Loader2, Building2, ChevronLeft, MapPin, Sparkles } from 'lucide-react';
import { saveSession } from '@/lib/auth-client';
import { DISCIPLINES } from '@/lib/constants';

export default function InscriptionPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: '', discipline: 'Sport', email: '', phone: '', contact_name: '', password: '', password2: '',
  });

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.password) { toast.error('Nom, email et mot de passe requis'); return; }
    if (form.password.length < 6) { toast.error('Mot de passe trop court (min 6)'); return; }
    if (form.password !== form.password2) { toast.error('Les mots de passe ne correspondent pas'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        name: form.name, discipline: form.discipline, email: form.email, phone: form.phone, contact_name: form.contact_name, password: form.password,
      }) });
      if (!res.ok) { const t = await res.json(); throw new Error(t.error); }
      const data = await res.json();
      saveSession({ id: data.user.id, email: data.user.email, role: data.user.role_code, name: data.user.full_name, organization_id: data.user.organization_id });
      toast.success(`Bienvenue ${data.user.full_name} ! Votre dossier est créé.`);
      router.push('/exposant');
    } catch (err) { toast.error(err.message); }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-emerald-50 px-4 py-8">
      <div className="w-full max-w-4xl grid md:grid-cols-2 gap-6">
        <div className="flex flex-col justify-center space-y-6 p-2">
          <Link href="/" className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900"><ChevronLeft className="w-4 h-4" /> Retour</Link>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-emerald-500 flex items-center justify-center shadow-lg">
              <MapPin className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-slate-500">Forum de la Rentrée 2026</p>
              <h1 className="text-xl font-bold text-slate-900">Inscription exposant</h1>
            </div>
          </div>
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">Rejoignez les 66 associations déjà inscrites.</h2>
            <p className="mt-3 text-slate-600">Le forum se tient les <strong>14 & 15 août 2026</strong> sur 6 sites polynésiens. Créez votre compte en 2 minutes : ARACOM validera votre dossier et vous accompagnera dans la préparation.</p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm"><Sparkles className="w-4 h-4 text-emerald-600" /> Choix des sites préférés</div>
            <div className="flex items-center gap-2 text-sm"><Sparkles className="w-4 h-4 text-emerald-600" /> Planification des créneaux d’animation</div>
            <div className="flex items-center gap-2 text-sm"><Sparkles className="w-4 h-4 text-emerald-600" /> Gestion documents, caution et convention</div>
            <div className="flex items-center gap-2 text-sm"><Sparkles className="w-4 h-4 text-emerald-600" /> Guide exposant et support ARACOM</div>
          </div>
        </div>

        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Building2 className="w-5 h-5 text-blue-600" /> Créer mon compte exposant</CardTitle>
            <CardDescription>Renseignez les informations de votre structure.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-3">
              <div><Label>Nom de votre association / structure *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex : I Mua Papeete" required /></div>
              <div>
                <Label>Discipline *</Label>
                <Select value={form.discipline} onValueChange={v => setForm({ ...form, discipline: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{DISCIPLINES.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Contact principal</Label><Input value={form.contact_name} onChange={e => setForm({ ...form, contact_name: e.target.value })} placeholder="Prénom Nom" /></div>
                <div><Label>Téléphone</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="87 XX XX XX" /></div>
              </div>
              <div><Label>Email *</Label><Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="contact@association.pf" required /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Mot de passe *</Label><Input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required minLength={6} /></div>
                <div><Label>Confirmer *</Label><Input type="password" value={form.password2} onChange={e => setForm({ ...form, password2: e.target.value })} required minLength={6} /></div>
              </div>
              <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={loading}>
                {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Création…</> : 'Créer mon compte exposant'}
              </Button>
              <p className="text-[11px] text-slate-500 text-center">Déjà inscrit ? <Link href="/" className="text-blue-600 hover:underline">Se connecter</Link></p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

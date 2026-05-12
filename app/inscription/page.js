'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast, Toaster } from 'sonner';
import WizardForm from '@/components/wizard-form';
import { Loader2 } from 'lucide-react';

export default function InscriptionPublicPage() {
  const [stage, setStage] = useState('email'); // email -> wizard
  const [email, setEmail] = useState('');
  const [registrationId, setRegistrationId] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Si déjà en session locale, reprendre
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = localStorage.getItem('inscription_public_reg_id');
    if (stored) { setRegistrationId(stored); setStage('wizard'); }
  }, []);

  const startInscription = async () => {
    if (!/^[^@]+@[^@]+\.[^@]+$/.test(email)) { toast.error('Email invalide'); return; }
    setSubmitting(true);
    try {
      const r = await fetch('/api/auth/self-register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Erreur');
      localStorage.setItem('inscription_public_reg_id', d.registration_id);
      setRegistrationId(d.registration_id);
      setStage('wizard');
      toast.success('Inscription créée. Complétez votre profil.');
    } catch (e) { toast.error(e.message); }
    finally { setSubmitting(false); }
  };

  if (stage === 'wizard' && registrationId) {
    return <WizardForm registrationId={registrationId} isPublic={true} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-slate-100 flex items-center justify-center p-4">
      <Toaster position="top-right" richColors />
      <Card className="w-full max-w-md">
        <CardContent className="p-8 space-y-5">
          <div className="text-center">
            <div className="text-5xl mb-2">🌺</div>
            <h1 className="text-2xl font-bold text-slate-900">Forum de la Rentrée 2026</h1>
            <p className="text-sm text-slate-500 mt-1">Inscription exposant — 14 & 15 août 2026</p>
          </div>
          <div>
            <Label>Email du référent</Label>
            <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="contact@votre-asso.pf" data-testid="public-email" />
          </div>
          <Button onClick={startInscription} disabled={submitting || !email} className="w-full bg-blue-600 hover:bg-blue-700" size="lg" data-testid="start-inscription">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Commencer mon inscription
          </Button>
          <p className="text-xs text-slate-500 text-center">Vous accéderez ensuite au formulaire en 5 étapes. Votre saisie est sauvegardée automatiquement.</p>
        </CardContent>
      </Card>
    </div>
  );
}

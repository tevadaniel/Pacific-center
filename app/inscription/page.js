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
    <div className="min-h-screen bg-gradient-to-b from-aracom-beige-pale to-aracom-beige-fond flex items-center justify-center p-4">
      <Toaster position="top-right" richColors />
      <Card className="w-full max-w-md border-2 border-aracom-gold/60 shadow-xl">
        <CardContent className="p-8 space-y-5">
          <div className="text-center">
            <div className="text-5xl mb-2">🌺</div>
            <h1 className="text-2xl font-bold text-aracom-black">Forum de la Rentrée 2026</h1>
            <p className="text-sm text-aracom-black/60 mt-1">Inscription exposant — 14 &amp; 15 août 2026</p>
          </div>
          <div className="bg-aracom-gold/15 border border-aracom-gold/50 rounded-lg p-3 text-xs text-aracom-black/80 leading-relaxed">
            ✨ Votre inscription se fait en 5 étapes guidées : <b>profil → site → jours → stand → animation</b>. À chaque étape, un bouton vous indiquera explicitement la suivante. Votre saisie est sauvegardée automatiquement.
          </div>
          <div>
            <Label className="text-aracom-black">Email du référent</Label>
            <Input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="contact@votre-asso.pf"
              data-testid="public-email"
              className="border-aracom-gold/40 focus:border-aracom-orange focus:ring-aracom-orange/30"
            />
          </div>
          <Button
            onClick={startInscription}
            disabled={submitting || !email}
            className="w-full bg-aracom-orange hover:bg-aracom-orange/90 text-white shadow-lg"
            size="lg"
            data-testid="start-inscription"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Commencer mon inscription →
          </Button>
          <p className="text-xs text-aracom-black/50 text-center">⚠️ Toute réservation est une <b>pré-réservation</b>. Elle sera confirmée après validation par ARACOM.</p>
        </CardContent>
      </Card>
    </div>
  );
}

'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Mail, ChevronLeft, Lock, Info } from 'lucide-react';

/**
 * Auto-inscription DÉSACTIVÉE depuis avril 2026.
 * Les exposants ne peuvent plus créer leur compte directement.
 * Seul ARACOM peut créer un compte exposant via le portail admin
 * (1-clic "Créer & inviter exposant" → magic link envoyé par email).
 */
export default function InscriptionDisabledPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-emerald-50 px-4 py-8">
      <Card className="w-full max-w-xl shadow-xl border-slate-200">
        <CardContent className="p-8 space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-xl bg-white border border-slate-200 flex items-center justify-center shrink-0 relative p-1">
              <Image src="/aracom-logo.png" alt="ARACOM" fill className="object-contain p-1.5" />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-widest text-slate-500">ARACOM</p>
              <h1 className="text-lg font-bold text-slate-900">Forum de la Rentrée 2026</h1>
            </div>
          </div>

          <div className="rounded-lg border-2 border-amber-300 bg-amber-50 p-4 flex items-start gap-3">
            <Lock className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div className="text-sm">
              <div className="font-bold text-amber-900">Inscription désormais sur invitation uniquement</div>
              <div className="text-amber-800 mt-1.5 leading-relaxed">
                Pour garantir la qualité et le suivi des dossiers, l&apos;auto-inscription a été désactivée.
                Seule l&apos;équipe ARACOM peut désormais créer un compte exposant et vous envoyer un lien personnel sécurisé.
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-blue-50 border border-blue-200 p-4 space-y-3">
            <div className="flex items-start gap-2">
              <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
              <div className="text-sm">
                <div className="font-semibold text-blue-900">Comment participer au Forum ?</div>
                <ol className="text-blue-800 mt-2 space-y-1.5 list-decimal list-inside">
                  <li>Envoyez votre demande à <a href="mailto:agence@aracom-conseil.fr?subject=Demande%20de%20participation%20-%20Forum%20de%20la%20Rentr%C3%A9e%202026" className="underline font-medium">agence@aracom-conseil.fr</a> avec le nom de votre association, votre discipline et vos coordonnées.</li>
                  <li>Si votre dossier est retenu, ARACOM vous envoie un <b>lien personnel par email</b>.</li>
                  <li>Cliquez sur ce lien : votre espace exposant s&apos;ouvre directement, sans mot de passe.</li>
                </ol>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <a href="mailto:agence@aracom-conseil.fr?subject=Demande%20de%20participation%20-%20Forum%20de%20la%20Rentr%C3%A9e%202026" className="flex-1">
              <Button className="w-full bg-blue-600 hover:bg-blue-700 gap-2">
                <Mail className="w-4 h-4" /> Contacter ARACOM
              </Button>
            </a>
            <Link href="/" className="flex-1">
              <Button variant="outline" className="w-full gap-2">
                <ChevronLeft className="w-4 h-4" /> Retour à l&apos;accueil
              </Button>
            </Link>
          </div>

          <p className="text-[11px] text-slate-500 text-center pt-2 border-t">
            Vous avez déjà reçu un lien personnel ? <Link href="/" className="text-blue-600 hover:underline">Retournez à l&apos;accueil</Link> et patientez quelques secondes — votre session sera reconnue automatiquement si elle est encore active.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

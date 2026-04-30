'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Mail, CheckCircle2 } from 'lucide-react';

export default function GoodbyePage() {
  const [emailSent, setEmailSent] = useState(null); // null | true | false

  useEffect(() => {
    // L'envoi du mail a déjà été déclenché par app-shell.jsx AVANT la redirection.
    // On lit juste un flag placé dans sessionStorage pour afficher un retour UI cohérent.
    try {
      const flag = sessionStorage.getItem('fr26_logout_email_sent');
      if (flag === 'ok') setEmailSent(true);
      else if (flag === 'fail') setEmailSent(false);
      sessionStorage.removeItem('fr26_logout_email_sent');
    } catch { /* ignore */ }
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-blue-50 px-4">
      <div className="max-w-lg w-full text-center space-y-6">
        <div className="mx-auto w-20 h-20 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-center relative p-2">
          <Image src="/aracom-logo.png" alt="ARACOM" fill className="object-contain p-2" />
        </div>

        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-slate-900">Au revoir et merci ! 👋</h1>
          <p className="text-slate-600">
            Vous vous êtes déconnecté(e) avec succès du Forum de la Rentrée 2026.
          </p>
        </div>

        {emailSent === true && (
          <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50 p-5 text-left space-y-2">
            <div className="flex items-center gap-2 text-emerald-700 font-semibold">
              <CheckCircle2 className="w-5 h-5" />
              <span>Lien de reconnexion envoyé</span>
            </div>
            <p className="text-sm text-emerald-900">
              Un email vient d&apos;être envoyé à votre adresse avec votre <b>lien personnel</b>.
              Il vous suffit de <b>cliquer sur le bouton</b> dans ce mail pour revenir à votre espace —
              aucun mot de passe à retenir.
            </p>
            <p className="text-xs text-emerald-800 italic">
              💡 Astuce : ajoutez ce lien à vos favoris pour y accéder encore plus vite la prochaine fois.
            </p>
          </div>
        )}

        {emailSent === false && (
          <div className="rounded-xl border-2 border-amber-200 bg-amber-50 p-5 text-left space-y-2">
            <div className="flex items-center gap-2 text-amber-700 font-semibold">
              <Mail className="w-5 h-5" />
              <span>Email non envoyé</span>
            </div>
            <p className="text-sm text-amber-900">
              Impossible d&apos;envoyer automatiquement le lien de reconnexion.
              Retrouvez votre lien dans l&apos;email d&apos;invitation d&apos;origine, ou contactez
              <a href="mailto:agence@aracom-conseil.fr" className="underline ml-1">agence@aracom-conseil.fr</a>.
            </p>
          </div>
        )}

        {emailSent === null && (
          <div className="rounded-xl border border-slate-200 bg-white p-5 text-left">
            <p className="text-sm text-slate-600 flex items-start gap-2">
              <Mail className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
              Pour vous reconnecter, cliquez sur le lien que vous avez reçu par email.
              Ce lien reste <b>valide en permanence</b>.
            </p>
          </div>
        )}

        <p className="text-xs text-slate-400 pt-4">
          Forum de la Rentrée 2026 · 14 &amp; 15 août 2026 · ARACOM
        </p>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { saveSession } from '@/lib/auth-client';
import { Loader2, AlertTriangle } from 'lucide-react';

export default function AccessTokenPage() {
  const params = useParams();
  const router = useRouter();
  const token = params?.token;
  const [status, setStatus] = useState('loading'); // loading | error
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    if (!token) { setStatus('error'); setError('Lien invalide'); return; }
    (async () => {
      try {
        const res = await fetch('/api/auth/consume-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        if (!res.ok) {
          const t = await res.text();
          if (!alive) return;
          setStatus('error'); setError(t || 'Lien invalide ou expiré');
          return;
        }
        const data = await res.json();
        if (!alive) return;
        saveSession({
          id: data.user.id,
          email: data.user.email,
          role: data.user.role_code,
          name: data.user.full_name,
          organization_id: data.user.organization_id,
          token_purpose: data.token_info?.purpose || null,
          accessed_via_token: true,
        });
        // Redirect by role / purpose
        const purpose = data.token_info?.purpose;
        if (purpose === 'inscription_exposant') {
          router.replace('/inscription?token=' + encodeURIComponent(token));
        } else if (data.user.role_code === 'pacific_centers_readonly') {
          router.replace('/pacific');
        } else if (data.user.role_code === 'aracom_admin') {
          router.replace('/aracom');
        } else {
          router.replace('/exposant');
        }
      } catch (e) {
        if (!alive) return;
        setStatus('error'); setError(e.message || 'Erreur réseau');
      }
    })();
    return () => { alive = false; };
  }, [token, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-50 via-white to-blue-50 p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 w-20 h-20 relative">
            <Image src="/aracom-logo.png" alt="ARACOM" fill className="object-contain" />
          </div>
          <CardTitle className="text-xl">Forum de la Rentrée 2026</CardTitle>
          <div className="text-xs text-slate-500 mt-1">Vendredi 14 & samedi 15 août 2026</div>
        </CardHeader>
        <CardContent>
          {status === 'loading' ? (
            <div className="text-center space-y-3 py-6">
              <Loader2 className="w-10 h-10 mx-auto animate-spin text-violet-600" />
              <div className="text-slate-700 font-medium">Ouverture de votre espace…</div>
              <div className="text-xs text-slate-500">Vérification du lien d&apos;accès personnel</div>
            </div>
          ) : (
            <div className="text-center space-y-3 py-6">
              <AlertTriangle className="w-10 h-10 mx-auto text-rose-600" />
              <div className="text-slate-900 font-bold">Impossible d&apos;ouvrir votre espace</div>
              <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-md p-3">{error}</div>
              <div className="text-xs text-slate-600 mt-3">
                Contactez ARACOM si le problème persiste : <a href="mailto:agence@aracom-conseil.fr" className="text-violet-600 underline">agence@aracom-conseil.fr</a>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

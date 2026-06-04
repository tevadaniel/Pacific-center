'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, Home, LogOut } from 'lucide-react';

/**
 * 🆘 Error Boundary GLOBAL — Affiché quand une erreur React/JS non gérée se produit.
 *
 * Avantage vs fallback Next.js par défaut :
 *  - Montre le message d'erreur réel à l'utilisateur (diagnostic en prod)
 *  - Offre 3 actions de récupération : réessayer, retour accueil, se déconnecter
 *  - Logue l'erreur dans la console + sur le serveur (best effort)
 */
export default function GlobalError({ error, reset }) {
  useEffect(() => {
    // Log côté client
    console.error('[GlobalError]', error);
    // Best-effort log côté serveur (pour audit ARACOM)
    try {
      fetch('/api/client-error-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: error?.message || 'Unknown error',
          stack: error?.stack || '',
          digest: error?.digest || null,
          url: typeof window !== 'undefined' ? window.location.href : '',
          user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
          at: new Date().toISOString(),
        }),
      }).catch(() => {});
    } catch {}
  }, [error]);

  const fullLogout = () => {
    try {
      localStorage.removeItem('fr26_session');
      // Désinscrit le service worker pour éliminer le cache PWA potentiellement corrompu
      if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(regs => {
          regs.forEach(r => r.unregister());
        }).catch(() => {});
      }
      // Vide les caches
      if (typeof caches !== 'undefined') {
        caches.keys().then(keys => keys.forEach(k => caches.delete(k))).catch(() => {});
      }
    } catch {}
    setTimeout(() => { window.location.href = '/'; }, 300);
  };

  return (
    <html lang="fr">
      <body className="min-h-screen bg-gradient-to-br from-rose-50 to-amber-50 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full bg-white rounded-xl shadow-xl border border-rose-200 overflow-hidden">
          <div className="bg-gradient-to-r from-rose-500 to-orange-500 text-white px-6 py-5 flex items-center gap-3">
            <AlertTriangle className="w-8 h-8 shrink-0" />
            <div>
              <h1 className="text-xl font-bold">Une erreur s&apos;est produite</h1>
              <p className="text-rose-100 text-sm">Forum de la Rentrée 2026 · ARACOM Conseil</p>
            </div>
          </div>

          <div className="p-6 space-y-5">
            <p className="text-slate-700">
              Désolé, votre espace n&apos;a pas pu se charger correctement. Vous pouvez essayer ces solutions :
            </p>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1">Détail technique</div>
              <div className="font-mono text-xs text-rose-900 break-words">
                {error?.message || 'Erreur inconnue'}
              </div>
              {error?.digest && (
                <div className="font-mono text-[10px] text-slate-500 mt-2">
                  ID : {error.digest}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Button
                onClick={() => reset()}
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
              >
                <RefreshCw className="w-4 h-4" /> Réessayer
              </Button>
              <Button
                variant="outline"
                onClick={() => { window.location.href = '/'; }}
                className="gap-2"
              >
                <Home className="w-4 h-4" /> Accueil
              </Button>
              <Button
                variant="outline"
                onClick={fullLogout}
                className="gap-2 border-rose-300 text-rose-700 hover:bg-rose-50"
              >
                <LogOut className="w-4 h-4" /> Vider le cache + déconnexion
              </Button>
            </div>

            <div className="text-xs text-slate-500 pt-3 border-t border-slate-100">
              💡 Si le problème persiste : essayez en navigation privée ou contactez
              <a href="mailto:contact@aracom.pf" className="text-rose-600 underline mx-1">contact@aracom.pf</a>
              en précisant le message d&apos;erreur ci-dessus.
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}

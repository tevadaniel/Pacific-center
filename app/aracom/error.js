'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, LogOut } from 'lucide-react';

/**
 * 🆘 Error boundary spécifique au cockpit ARACOM.
 * Évite le fallback générique Next.js et donne un message + récupération.
 */
export default function AracomError({ error, reset }) {
  useEffect(() => {
    console.error('[AracomError]', error);
    try {
      fetch('/api/client-error-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope: 'aracom',
          message: error?.message || 'Unknown error',
          stack: error?.stack || '',
          digest: error?.digest || null,
          url: typeof window !== 'undefined' ? window.location.href : '',
          at: new Date().toISOString(),
        }),
      }).catch(() => {});
    } catch {}
  }, [error]);

  const clearAndRelogin = () => {
    try {
      localStorage.removeItem('fr26_session');
      if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(regs => {
          regs.forEach(r => r.unregister());
        }).catch(() => {});
      }
      if (typeof caches !== 'undefined') {
        caches.keys().then(keys => keys.forEach(k => caches.delete(k))).catch(() => {});
      }
    } catch {}
    setTimeout(() => { window.location.href = '/'; }, 300);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-rose-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white rounded-xl shadow-xl border border-rose-200">
        <div className="bg-gradient-to-r from-rose-500 to-orange-500 text-white px-6 py-5 flex items-center gap-3 rounded-t-xl">
          <AlertTriangle className="w-8 h-8 shrink-0" />
          <div>
            <h1 className="text-xl font-bold">Erreur dans le cockpit ARACOM</h1>
            <p className="text-rose-100 text-sm">Forum de la Rentrée 2026</p>
          </div>
        </div>
        <div className="p-6 space-y-5">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1">Détail technique</div>
            <div className="font-mono text-xs text-rose-900 break-words">
              {error?.message || 'Erreur inconnue'}
            </div>
            {error?.digest && (
              <div className="font-mono text-[10px] text-slate-500 mt-2">ID : {error.digest}</div>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Button onClick={() => reset()} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
              <RefreshCw className="w-4 h-4" /> Réessayer
            </Button>
            <Button variant="outline" onClick={clearAndRelogin} className="gap-2 border-rose-300 text-rose-700 hover:bg-rose-50">
              <LogOut className="w-4 h-4" /> Vider cache + reconnexion
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

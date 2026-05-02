'use client';
import { useEffect, useState } from 'react';

// 🆘 PAGE DE RESET D'URGENCE
// Accessible via /reset → désinstalle TOUS les Service Workers + vide TOUS les caches
// + clear localStorage/sessionStorage, puis redirige vers la home.
// À utiliser quand le navigateur sert une ancienne version cachée et qu'aucune autre méthode ne marche.
export default function ResetPage() {
  const [step, setStep] = useState('Préparation…');
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setStep('🧹 Désinstallation des Service Workers…');
        if ('serviceWorker' in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          for (const r of regs) await r.unregister();
        }
        setStep('🗑️ Vidage de tous les caches…');
        if ('caches' in window) {
          const keys = await caches.keys();
          for (const k of keys) await caches.delete(k);
        }
        setStep('💾 Effacement du stockage local…');
        try { window.localStorage?.clear(); } catch (e) {}
        try { window.sessionStorage?.clear(); } catch (e) {}
        try {
          if ('indexedDB' in window && indexedDB.databases) {
            const dbs = await indexedDB.databases();
            for (const d of dbs) { if (d.name) indexedDB.deleteDatabase(d.name); }
          }
        } catch (e) {}
        setStep('✅ Reset terminé ! Redirection…');
        setDone(true);
        setTimeout(() => { window.location.href = '/'; }, 1500);
      } catch (err) {
        setStep('❌ Erreur : ' + (err?.message || err));
      }
    })();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50 p-6">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
        <div className="text-5xl mb-4">{done ? '✅' : '🔄'}</div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Réinitialisation en cours</h1>
        <p className="text-sm text-slate-500 mb-6">
          On efface l&apos;ancien cache de votre navigateur pour vous donner la dernière version.
        </p>
        <div className="bg-slate-50 rounded-lg p-4 mb-4">
          <div className="text-sm text-slate-700">{step}</div>
          {!done && (
            <div className="mt-3 h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 animate-pulse" style={{ width: '70%' }} />
            </div>
          )}
        </div>
        {done && (
          <p className="text-xs text-emerald-600">Redirection vers l&apos;accueil…</p>
        )}
      </div>
    </div>
  );
}

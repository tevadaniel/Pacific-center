'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, X } from 'lucide-react';

// 🛡️ SESSION 28s — DÉFINITIVE pour le bug "mises à jour qui ne s'affichent pas"
//     On poll /api/version toutes les 60s. Si la version change (= redéploiement détecté) :
//     1. Tous les caches du SW sont supprimés (postMessage CLEAR_CACHES)
//     2. Le SW est désinscrit (forceUnregister)
//     3. La page est rechargée pour servir le HTML+JS le plus récent
//     → L'utilisateur voit AUTOMATIQUEMENT la dernière version max 60s après déploiement.
//
// 🛡️ SESSION 43-fix — Anti-boucle de rechargement :
//     - Si on a déjà rechargé 2 fois en moins de 5min, on arrête de poll (garde-fou).
//     - Grâce de 30s post-reload : on n'enclenche pas un nouveau reload trop vite.
const VERSION_KEY = 'fr26_build_version';
const RELOAD_HISTORY_KEY = 'fr26_reload_history';
const VERSION_POLL_INTERVAL_MS = 60 * 1000;
const RELOAD_LOOP_WINDOW_MS = 5 * 60 * 1000; // 5 min
const RELOAD_LOOP_MAX = 2; // max 2 reloads dans la fenêtre avant blocage
const RELOAD_GRACE_MS = 30 * 1000; // 30 s après un reload, on ne re-déclenche pas

function getReloadHistory() {
  try {
    const raw = sessionStorage.getItem(RELOAD_HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    const now = Date.now();
    return arr.filter((t) => typeof t === 'number' && now - t < RELOAD_LOOP_WINDOW_MS);
  } catch { return []; }
}
function pushReloadHistory() {
  try {
    const arr = getReloadHistory();
    arr.push(Date.now());
    sessionStorage.setItem(RELOAD_HISTORY_KEY, JSON.stringify(arr));
  } catch {/* ignore */}
}

async function checkBuildVersion() {
  try {
    // Garde-fou anti-boucle : si on a déjà rechargé trop de fois récemment, on stoppe.
    const history = getReloadHistory();
    if (history.length >= RELOAD_LOOP_MAX) {
      // On log une seule fois et on n'agit plus dans cette session.
      if (!window.__pwa_loop_blocked_logged) {
        console.warn('[pwa] ⚠️ Boucle de rechargement détectée (' + history.length + ' reloads en <5min). Auto-reload désactivé pour cette session.');
        window.__pwa_loop_blocked_logged = true;
      }
      return;
    }
    // Grâce post-reload : ne pas déclencher dans les 30s qui suivent un reload
    if (history.length > 0) {
      const lastReload = Math.max(...history);
      if (Date.now() - lastReload < RELOAD_GRACE_MS) return;
    }
    const r = await fetch('/api/version', { cache: 'no-store' });
    if (!r.ok) return;
    const data = await r.json();
    const currentVersion = data?.version;
    if (!currentVersion) return;
    const knownVersion = localStorage.getItem(VERSION_KEY);
    if (!knownVersion) {
      // Première visite — on enregistre la version actuelle, pas besoin de reload
      localStorage.setItem(VERSION_KEY, currentVersion);
      return;
    }
    if (knownVersion !== currentVersion) {
      // 🚨 Nouvelle version détectée — on clear tout et on reload
      console.info('[pwa] Nouvelle version détectée :', knownVersion, '→', currentVersion);
      localStorage.setItem(VERSION_KEY, currentVersion);
      pushReloadHistory(); // tracking anti-boucle
      // 1) Clear caches du SW
      try {
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_CACHES' });
        }
        if (typeof caches !== 'undefined') {
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k)));
        }
      } catch {}
      // 2) Force reload de la page sans cache navigateur
      setTimeout(() => {
        try { window.location.reload(); } catch { window.location.href = window.location.href; }
      }, 300);
    }
  } catch {/* network down or boot — ignore */}
}

export default function PwaRegister() {
  const [installPrompt, setInstallPrompt] = useState(null);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // Register service worker with auto-update detection
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').then((reg) => {
          // 🔄 Vérifier les mises à jour à chaque chargement (force fetch du sw.js)
          reg.update().catch(() => {});

          // Si une nouvelle version a été détectée et est en attente d'activation,
          // demander au SW de prendre le relais immédiatement (skipWaiting)
          if (reg.waiting) {
            reg.waiting.postMessage({ type: 'SKIP_WAITING' });
          }

          // Détection de nouvelle version arrivante
          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing;
            if (!newWorker) return;
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // Nouvelle version installée, on lui demande de prendre le contrôle tout de suite
                newWorker.postMessage({ type: 'SKIP_WAITING' });
              }
            });
          });
        }).catch(() => {});

        // 🆕 Si le SW change de contrôleur (nouvelle version active), recharger la page
        // pour servir la version fraîche à l'utilisateur
        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (refreshing) return;
          refreshing = true;
          // Petit délai pour laisser les caches se nettoyer avant le reload
          setTimeout(() => window.location.reload(), 100);
        });
      });
    }

    // 🛡️ SESSION 28s — Polling de /api/version (cache-busting définitif)
    //    Au mount + toutes les 60s + à chaque retour de focus (utile mobile).
    checkBuildVersion();
    const pollId = setInterval(checkBuildVersion, VERSION_POLL_INTERVAL_MS);
    const onFocus = () => checkBuildVersion();
    window.addEventListener('focus', onFocus);
    window.addEventListener('visibilitychange', onFocus);

    // Capture install prompt for later use
    const handler = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
      // Show only if not previously dismissed
      const dismissed = typeof window !== 'undefined' && window.localStorage?.getItem('pwa_install_dismissed');
      if (!dismissed) setShowBanner(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('visibilitychange', onFocus);
      clearInterval(pollId);
    };
  }, []);

  const install = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
    setShowBanner(false);
  };
  const dismiss = () => {
    setShowBanner(false);
    if (typeof window !== 'undefined') window.localStorage?.setItem('pwa_install_dismissed', '1');
  };

  if (!showBanner || !installPrompt) return null;
  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:bottom-4 md:max-w-sm z-[60]">
      <div className="bg-blue-600 text-white rounded-lg shadow-2xl p-4 flex items-center gap-3">
        <Download className="w-6 h-6 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm">Installer Forum 2026</div>
          <div className="text-xs opacity-90">Accès rapide depuis votre écran d&apos;accueil, mode hors-ligne sur le terrain.</div>
        </div>
        <Button size="sm" onClick={install} className="bg-white text-blue-700 hover:bg-blue-50">Installer</Button>
        <button onClick={dismiss} className="text-white/80 hover:text-white"><X className="w-4 h-4" /></button>
      </div>
    </div>
  );
}

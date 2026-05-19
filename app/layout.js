import './globals.css';
import { Toaster } from '@/components/ui/sonner';
import PwaRegister from '@/components/pwa-register';

export const metadata = {
  title: 'Forum de la Rentrée 2026 — ARACOM',
  description: 'Plateforme de pilotage opérationnel — Forum de la Rentrée 2026 • Polynésie française',
  applicationName: 'Forum 2026',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    title: 'Forum 2026',
    statusBarStyle: 'default',
  },
  icons: {
    icon: '/icon-192.png',
    apple: '/icon-192.png',
  },
};

export const viewport = {
  themeColor: '#1d4ed8',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Forum 2026" />
        {/* 🆕 Auto-update SW + cache buster — force le rafraîchissement définitif des anciens caches */}
        {/* Ce script s'exécute AVANT tout le reste du JS, donc avant que le vieux SW ne serve une vieille page */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                if (typeof window === 'undefined') return;
                var APP_VERSION = 'v42-2026-05-19-sort-loyalty-editions';
                try {
                  var stored = localStorage.getItem('app_sw_version');
                  // Si la version stockée est différente (ou absente), on force un nettoyage agressif
                  if (stored !== APP_VERSION) {
                    if ('serviceWorker' in navigator) {
                      navigator.serviceWorker.getRegistrations().then(function(regs) {
                        regs.forEach(function(r) { r.unregister(); });
                      }).catch(function(){});
                    }
                    if ('caches' in window) {
                      caches.keys().then(function(keys) {
                        keys.forEach(function(k) { caches.delete(k); });
                      }).catch(function(){});
                    }
                    try { localStorage.setItem('app_sw_version', APP_VERSION); } catch(e){}
                    // Si on n'avait JAMAIS la version (1ère install), pas besoin de reload
                    // Si on AVAIT une vieille version, on force un reload propre
                    if (stored !== null && stored !== APP_VERSION) {
                      setTimeout(function() { window.location.reload(); }, 200);
                    }
                  }
                } catch (e) { /* localStorage indisponible */ }
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        {children}
        <Toaster position="top-right" richColors />
        <PwaRegister />
      </body>
    </html>
  );
}

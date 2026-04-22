import './globals.css';
import { Toaster } from '@/components/ui/sonner';

export const metadata = {
  title: 'Forum de la Rentrée 2026 — ARACOM',
  description: 'Plateforme de pilotage opérationnel — Forum de la Rentrée 2026 • Polynésie française',
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}

'use client';

/**
 * 🆕 SESSION 48p — ContactFooter
 * Bannière footer sticky en bas du portail Exposant.
 * Affiche les coordonnées de support ARACOM pour les exposants en difficulté.
 *
 * Position : sticky bottom (toujours visible)
 * Style : sobre, beige/noir charte ARACOM
 * Repliable : un bouton "X" permet de masquer la bannière (persistance localStorage).
 */
import { useEffect, useState } from 'react';
import { Phone, Mail, X, HelpCircle } from 'lucide-react';

export default function ContactFooter() {
  const [hidden, setHidden] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const v = localStorage.getItem('exposant_contact_footer_hidden');
      if (v === '1') setHidden(true);
    } catch { /* ignore */ }
    setLoaded(true);
  }, []);

  if (!loaded) return null;

  if (hidden) {
    return (
      <button
        onClick={() => {
          setHidden(false);
          try { localStorage.setItem('exposant_contact_footer_hidden', '0'); } catch { /* ignore */ }
        }}
        className="fixed bottom-3 right-3 z-40 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-aracom-black hover:bg-aracom-black/90 text-aracom-gold text-xs font-semibold shadow-lg border border-aracom-gold/40 transition-all"
        title="Afficher les coordonnées ARACOM"
        data-testid="contact-footer-reopen"
      >
        <HelpCircle className="w-3.5 h-3.5" /> Besoin d&apos;aide ?
      </button>
    );
  }

  return (
    <div className="sticky bottom-0 left-0 right-0 z-30 bg-aracom-black/95 backdrop-blur text-aracom-beige-pale border-t-2 border-aracom-gold shadow-[0_-4px_12px_rgba(0,0,0,0.15)]">
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-lg" aria-hidden>💬</span>
          <span className="font-serif text-aracom-gold font-semibold text-sm hidden sm:inline">
            Une difficulté&nbsp;?
          </span>
          <span className="font-serif text-aracom-gold font-semibold text-sm sm:hidden">
            Aide
          </span>
        </div>
        <span className="text-aracom-beige-pale/40 hidden md:inline">|</span>
        <div className="flex items-center gap-3 flex-wrap text-xs">
          <a
            href="tel:+68987210444"
            className="inline-flex items-center gap-1.5 text-aracom-beige-pale hover:text-aracom-gold transition font-medium"
            title="Appeler ARACOM — Standard"
          >
            <Phone className="w-3.5 h-3.5" />
            <span className="font-mono">87 21 04 44</span>
          </a>
          <span className="text-aracom-beige-pale/30">/</span>
          <a
            href="tel:+68989679729"
            className="inline-flex items-center gap-1.5 text-aracom-beige-pale hover:text-aracom-gold transition font-medium"
            title="Appeler ARACOM — Mobile"
          >
            <Phone className="w-3.5 h-3.5" />
            <span className="font-mono">89 67 97 29</span>
          </a>
          <span className="text-aracom-beige-pale/30">|</span>
          <a
            href="mailto:agence@aracom-conseil.fr"
            className="inline-flex items-center gap-1.5 text-aracom-beige-pale hover:text-aracom-gold transition font-medium"
            title="Envoyer un mail à ARACOM"
          >
            <Mail className="w-3.5 h-3.5" />
            <span>agence@aracom-conseil.fr</span>
          </a>
        </div>
        <span className="text-[10px] text-aracom-beige-pale/50 italic hidden lg:inline ml-auto mr-2">
          Notre équipe vous accompagne.
        </span>
        <button
          onClick={() => {
            setHidden(true);
            try { localStorage.setItem('exposant_contact_footer_hidden', '1'); } catch { /* ignore */ }
          }}
          className="ml-auto lg:ml-0 p-1 rounded hover:bg-aracom-beige-pale/10 text-aracom-beige-pale/60 hover:text-aracom-beige-pale transition"
          title="Masquer cette bannière"
          aria-label="Fermer la bannière de contact"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

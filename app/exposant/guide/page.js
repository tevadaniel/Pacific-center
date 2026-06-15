'use client';
import { Button } from '@/components/ui/button';
import { Printer, ArrowLeft } from 'lucide-react';

const SECTIONS = [
  {
    icon: '🎯',
    title: 'Bienvenue au Forum de la Rentrée 2026',
    content: [
      "Le Forum de la Rentrée est l'événement incontournable de la rentrée polynésienne. Il rassemble dans les centres commerciaux Pacific Centers les associations sportives, culturelles, éducatives et de loisirs qui souhaitent présenter leurs activités au grand public.",
      "Ce guide synthétise les règles et bonnes pratiques pour réussir votre participation. Il complète la Convention de mise à disposition de stand signée avec le propriétaire du site.",
    ],
  },
  {
    icon: '📅',
    title: 'Dates et horaires clés',
    content: [
      { label: 'Installation', value: 'Vendredi 14 août 2026 à partir de 10h00' },
      { label: 'Forum — Jour 1', value: 'Vendredi 14 août 2026 · 11h00 à 17h00' },
      { label: 'Forum — Jour 2', value: 'Samedi 15 août 2026 · 09h00 à 17h00' },
      { label: 'Démontage', value: "Samedi 15 août dès 17h00 (impérativement avant 18h)" },
      { label: 'Deadline annulation sans frais', value: 'Vendredi 31 juillet 2026 (au-delà, la caution est encaissée)' },
    ],
  },
  {
    icon: '🏪',
    title: 'Votre stand — Ce qui est fourni',
    content: [
      "✅ Une table nappée noire (1 par exposant)",
      "✅ L'emplacement balisé selon le plan d'implantation Aracom",
      "✅ L'encadrement et la coordination ARACOM sur site",
      "✅ La promotion globale du Forum (affichage, communication centre commercial)",
    ],
  },
  {
    icon: '🎒',
    title: 'À apporter par vos soins',
    content: [
      "🪑 Chaises (la table seule est fournie)",
      "🔌 Rallonges électriques",
      "📺 Écran ou matériel audiovisuel si nécessaire",
      "🎨 Décoration de votre stand à l'image de votre enseigne",
      "📦 Matériel de démonstration / animation",
      "📋 Documents d'information (à distribuer UNIQUEMENT sur le stand, à la demande)",
      "🛡️ Attestation d'assurance dommages + responsabilité civile (obligatoire)",
    ],
  },
  {
    icon: '🎭',
    title: 'Animation : obligatoire et essentielle',
    content: [
      "Le Forum est un événement **interactif**. Chaque exposant doit assurer une animation sur son stand pendant les horaires d'ouverture.",
      "**Types d'animation acceptés** :",
      "• Démonstration en direct (sport, art, savoir-faire)",
      "• Initiation publique (mini-cours, atelier)",
      "• Activité interactive (jeu, quiz, échange)",
      "• Écran vidéo (en dernier recours uniquement)",
      "",
      "Un planning sera défini avec l'agence ARACOM. **L'absence d'animation entraîne l'encaissement de la caution.**",
    ],
  },
  {
    icon: '💰',
    title: 'Caution / Dépôt de garantie',
    content: [
      { label: 'Montant', value: '20 000 XPF par exposant' },
      { label: 'Forme', value: "Chèque de caution à l'ordre du bailleur du site" },
      { label: 'Rendue', value: "À l'issue du Forum si tous les engagements ont été respectés" },
      { label: 'Encaissée si', value: "Non-respect des horaires, absence d'animation, ou annulation après le 31 juillet 2026" },
    ],
  },
  {
    icon: '🚫',
    title: 'Strictement interdit',
    content: [
      "❌ Vente directe de produits sur le Forum",
      "❌ Démarchage direct dans la galerie marchande",
      "❌ Distribution de prospectus en galerie ou parking",
      "❌ Implantation d'oriflammes ou banderoles",
      "❌ Utilisation de nappes personnelles (la nappe noire fournie est obligatoire)",
      "❌ Débordement en dehors de votre emplacement",
      "❌ Stationnement gênant ou dépôt de marchandise dans la circulation",
    ],
  },
  {
    icon: '✅',
    title: 'PLV & communication',
    content: [
      "✓ **1 roll-up maximum** par exposant (support informatif uniquement)",
      "✓ Documentation distribuée **uniquement sur votre stand**, à la demande du client",
      "✓ Pas de PLV débordant en dehors de l'emplacement",
    ],
  },
  {
    icon: '🛡️',
    title: 'Assurances & responsabilités',
    content: [
      "• Vous devez fournir une **attestation d'assurance dommages + responsabilité civile** avant l'événement.",
      "• Vous êtes **seul responsable de votre matériel** (jour et nuit). Le centre commercial décline toute responsabilité en cas de vol ou dégât.",
      "• Vous êtes **responsable** de la conformité de votre animation et de l'image que vous renvoyez de votre structure.",
    ],
  },
  {
    icon: '🤝',
    title: 'Bonnes pratiques',
    content: [
      "💡 Préparez des supports visuels (photos, vidéos courtes) avant l'événement",
      "💡 Coordonnez plusieurs animateurs pour assurer une présence continue",
      "💡 Privilégiez l'interaction : faites essayer, faites participer",
      "💡 Respectez les autres exposants et le public (volume sonore, espace)",
    ],
  },
  {
    icon: '📞',
    title: 'Contact ARACOM',
    content: [
      "🏢 **ARACOM Conseil** — Organisation du Forum de la Rentrée 2026",
      "📧 agence@aracom-conseil.fr",
      "📱 40 47 88 50 (bureau)",
      "📞 87 21 04 44 (Teva — direct)",
      "",
      "💼 Pour toute question, suggestion ou problème sur site, contactez-nous directement.",
    ],
  },
];

export default function GuideExposantPage() {
  return (
    <div className="min-h-screen bg-slate-100 print:bg-white">
      {/* Bar d'action */}
      <div className="sticky top-0 z-50 bg-aracom-black text-white p-3 flex justify-between items-center shadow-lg print:hidden">
        <a href="/exposant" className="flex items-center gap-2 text-sm hover:text-aracom-orange transition">
          <ArrowLeft className="w-4 h-4" /> Retour au portail
        </a>
        <h1 className="font-bold text-sm md:text-base">📖 Guide de l&apos;Exposant — Forum 2026</h1>
        <Button onClick={() => window.print()} className="bg-aracom-orange hover:bg-aracom-orange/90 text-white gap-2" size="sm">
          <Printer className="w-4 h-4" /> Imprimer / PDF
        </Button>
      </div>

      <div className="max-w-[210mm] mx-auto bg-white shadow-2xl print:shadow-none my-4 print:my-0 text-[12.5px] leading-relaxed">
        {/* Couverture */}
        <div className="bg-gradient-to-br from-aracom-black to-aracom-black/90 text-white p-8 print:p-6">
          <div className="text-center">
            <div className="text-6xl mb-3">🌺</div>
            <div className="text-[10px] uppercase tracking-widest text-aracom-orange font-bold">Guide Officiel</div>
            <h1 className="text-3xl font-bold mt-2 mb-1">Forum de la Rentrée 2026</h1>
            <div className="text-[14px] text-aracom-gold">Pacific Centers · Polynésie française</div>
            <div className="text-[12px] text-white/70 mt-3">14 &amp; 15 août 2026 — Faaa · Punaauia · Arue · Taravao</div>
            <div className="inline-block mt-5 px-4 py-1.5 bg-aracom-orange rounded-full text-[11px] font-bold">
              Guide de l&apos;Exposant
            </div>
          </div>
        </div>

        {/* TOC */}
        <div className="bg-aracom-beige-pale p-5 print:p-4">
          <div className="text-[10px] uppercase tracking-wider text-aracom-orange font-bold mb-2">Sommaire</div>
          <ol className="text-[11px] space-y-0.5 columns-2 list-decimal list-inside text-aracom-black">
            {SECTIONS.map((s, i) => (
              <li key={i}>{s.icon} {s.title}</li>
            ))}
          </ol>
        </div>

        {/* Sections */}
        <div className="p-8 print:p-6 space-y-6">
          {SECTIONS.map((s, i) => (
            <section key={i} className="break-inside-avoid">
              <h2 className="flex items-center gap-2 text-[16px] font-bold text-aracom-black border-l-4 border-aracom-orange pl-2 mb-2">
                <span className="text-xl">{s.icon}</span>
                <span>{i + 1}. {s.title}</span>
              </h2>
              <div className="ml-3 space-y-1 text-slate-800">
                {s.content.map((item, j) => {
                  if (typeof item === 'string') {
                    if (item === '') return <div key={j} className="h-1" />;
                    // gras simple **xxx**
                    const parts = item.split(/\*\*(.+?)\*\*/g);
                    return (
                      <p key={j}>
                        {parts.map((p, k) => k % 2 === 1 ? <strong key={k} className="text-aracom-black">{p}</strong> : p)}
                      </p>
                    );
                  }
                  // Object avec label/value
                  return (
                    <div key={j} className="flex flex-wrap gap-1 text-[11.5px] border-b border-aracom-gold/30 py-1">
                      <span className="text-aracom-orange font-bold min-w-[140px]">{item.label} :</span>
                      <span className="text-aracom-black flex-1">{item.value}</span>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        {/* Footer */}
        <div className="bg-aracom-black text-white/70 text-[10px] text-center p-4 print:p-3">
          © 2026 ARACOM Conseil · Forum de la Rentrée · Pacific Centers Polynésie<br />
          Ce guide est un document de référence. Les conditions contractuelles complètes figurent dans la Convention de mise à disposition de stand.
        </div>
      </div>

      <style jsx global>{`
        @media print {
          @page { margin: 10mm; size: A4; }
          body { background: white !important; }
        }
      `}</style>
    </div>
  );
}

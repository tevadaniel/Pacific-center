'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, FileText, ExternalLink, Printer, Download, BookOpen, ClipboardCheck, FileSignature, ArrowLeft, Mail } from 'lucide-react';
import { toast, Toaster } from 'sonner';
import { api, getSession } from '@/lib/auth-client';

export default function MesDocumentsPage() {
  const [reg, setReg] = useState(null);
  const [venue, setVenue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        let regId = null;
        if (typeof window !== 'undefined') {
          // Try various session keys
          const stored = localStorage.getItem('inscription_public_reg_id') ||
                         localStorage.getItem('exposant_reg_id');
          regId = stored;
          // Or from URL
          const params = new URLSearchParams(window.location.search);
          if (params.get('regId')) regId = params.get('regId');
        }
        if (!regId) {
          // Auto-detect via session → /api/auth/me → org → my-sites → 1st reg
          try {
            const me = await api('/api/auth/me');
            if (me?.organization?.id) {
              const sites = await api(`/api/exposant/my-sites?organization_id=${encodeURIComponent(me.organization.id)}`);
              if (Array.isArray(sites) && sites.length > 0) {
                regId = sites[0].id;
              }
            }
          } catch {}
        }
        if (!regId) {
          setError('Aucune inscription trouvée. Connectez-vous au portail exposant d\'abord.');
          return;
        }
        const data = await api(`/api/exposant/annexe/${regId}`);
        setReg({ ...data.registration, _full: data });
        setVenue(data.venue);
      } catch (e) { setError(e.message); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-aracom-beige-pale"><Loader2 className="w-8 h-8 animate-spin text-aracom-orange" /></div>;

  const documents = [
    {
      id: 'annexe',
      icon: <ClipboardCheck className="w-8 h-8" />,
      title: 'Annexe N°1 — Fiche de réservation',
      desc: "Récapitulatif personnalisé de votre inscription (identité, stand, animations, caution). À imprimer et joindre à la Convention signée.",
      badge: '📋 Auto-généré',
      action: 'open',
      href: reg ? `/exposant/annexe/${reg.id}` : null,
      bgColor: 'bg-aracom-orange/10',
      borderColor: 'border-aracom-orange/40',
      iconColor: 'text-aracom-orange',
    },
    {
      id: 'guide',
      icon: <BookOpen className="w-8 h-8" />,
      title: "Guide de l'Exposant",
      desc: "Toutes les règles et bonnes pratiques du Forum de la Rentrée 2026 : dates, animations, caution, interdictions, contacts. Document de référence.",
      badge: '📖 Référence',
      action: 'open',
      href: '/exposant/guide',
      bgColor: 'bg-aracom-gold/15',
      borderColor: 'border-aracom-gold/50',
      iconColor: 'text-aracom-black',
    },
    {
      id: 'convention',
      icon: <FileSignature className="w-8 h-8" />,
      title: 'Convention de mise à disposition',
      desc: venue?.convention_pdf_url
        ? `Convention PDF du site ${venue.name} (bailleur : ${venue.owner_sci || '—'}). Document contractuel à imprimer, signer et remettre à ARACOM avec votre chèque de caution.`
        : "Choisissez d'abord votre site d'exposition dans le wizard pour télécharger la Convention correspondante.",
      badge: '📜 Contractuel',
      action: 'download',
      href: venue?.convention_pdf_url || null,
      disabled: !venue?.convention_pdf_url,
      bgColor: 'bg-aracom-beige-fond',
      borderColor: 'border-aracom-black/30',
      iconColor: 'text-aracom-black',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-aracom-beige-pale to-aracom-beige-fond">
      <Toaster richColors />
      {/* Bar */}
      <div className="bg-aracom-black text-white p-4 flex justify-between items-center shadow">
        <a href="/exposant" className="flex items-center gap-2 text-sm hover:text-aracom-orange transition">
          <ArrowLeft className="w-4 h-4" /> Retour au portail
        </a>
        <h1 className="font-bold text-base md:text-lg">📂 Mes documents</h1>
        <div className="w-24" />
      </div>

      <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-4">
        {error && (
          <Card className="border-2 border-rose-200">
            <CardContent className="p-4 text-center text-rose-700">{error}</CardContent>
          </Card>
        )}

        {/* Intro */}
        <Card className="border-2 border-aracom-gold/60">
          <CardContent className="p-5">
            <h2 className="text-xl font-bold text-aracom-black mb-2">📂 Votre dossier d&apos;exposant Forum 2026</h2>
            <p className="text-sm text-slate-700 leading-relaxed">
              Voici les <b>3 documents officiels</b> qui composent votre dossier. Imprimez-les tous et apportez-les lors de votre rendez-vous avec ARACOM pour la remise du chèque de caution.
            </p>
            <div className="mt-3 bg-aracom-orange/10 border-l-4 border-aracom-orange rounded-r p-3 text-xs text-aracom-black">
              <b>⚠️ Rappel important</b> — Toute inscription est une <b>pré-réservation</b>. Elle ne devient ferme qu&apos;après réception de votre chèque de caution (<b>20 000 XPF</b>) et signature en main propre de la Convention par ARACOM. Date limite : <b>vendredi 31 juillet 2026</b>.
            </div>
          </CardContent>
        </Card>

        {/* Documents */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {documents.map((doc, idx) => (
            <Card key={doc.id} className={`border-2 ${doc.borderColor} ${doc.disabled ? 'opacity-50' : ''} flex flex-col`}>
              <CardContent className={`p-5 flex-1 flex flex-col ${doc.bgColor}`}>
                <div className="flex items-start justify-between mb-2">
                  <div className={doc.iconColor}>{doc.icon}</div>
                  <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500">#{idx + 1}</span>
                </div>
                <h3 className="font-bold text-aracom-black text-base mb-1">{doc.title}</h3>
                <span className="inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-white/60 text-aracom-orange rounded mb-2 w-fit">{doc.badge}</span>
                <p className="text-xs text-slate-700 leading-relaxed flex-1">{doc.desc}</p>
                <div className="mt-3">
                  {doc.action === 'open' && doc.href ? (
                    <a href={doc.href} target="_blank" rel="noopener noreferrer">
                      <Button className="w-full bg-aracom-orange hover:bg-aracom-orange/90 text-white gap-2" size="sm">
                        <Printer className="w-3.5 h-3.5" /> Ouvrir / Imprimer
                      </Button>
                    </a>
                  ) : doc.action === 'download' && doc.href ? (
                    <a href={doc.href} target="_blank" rel="noopener noreferrer" download>
                      <Button className="w-full bg-aracom-black hover:bg-aracom-black/85 text-white gap-2" size="sm">
                        <Download className="w-3.5 h-3.5" /> Télécharger PDF
                      </Button>
                    </a>
                  ) : (
                    <Button disabled className="w-full" size="sm" variant="outline">Non disponible</Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Caution status */}
        {reg?._full?.caution && (
          <Card className="border-2 border-aracom-gold/40">
            <CardContent className="p-5">
              <h3 className="font-bold text-aracom-black mb-2 flex items-center gap-2">💰 Statut de votre caution</h3>
              <div className="flex items-center gap-4 flex-wrap">
                <div>
                  <div className="text-[10px] uppercase text-slate-500 font-semibold">Montant</div>
                  <div className="text-xl font-bold text-aracom-orange">20 000 XPF</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase text-slate-500 font-semibold">Statut</div>
                  <div className="text-sm font-bold text-aracom-black">
                    {reg._full.caution.status === 'received' ? '✅ Reçue par ARACOM' :
                     reg._full.caution.status === 'returned' ? '🔄 Rendue (post-événement)' :
                     '⏳ En attente — à remettre en main propre'}
                  </div>
                </div>
                <div className="flex-1 min-w-[200px]">
                  <div className="text-xs text-slate-600">
                    Forme : <b>chèque</b> à l&apos;ordre de <b>{venue?.owner_sci || 'votre bailleur (voir Convention)'}</b>
                  </div>
                  <div className="text-xs text-slate-600">
                    Deadline : <b className="text-rose-700">31 juillet 2026</b>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Contact */}
        <Card>
          <CardContent className="p-4 flex items-center gap-3 flex-wrap">
            <Mail className="w-5 h-5 text-aracom-orange" />
            <span className="text-sm text-slate-700">Une question ?</span>
            <a href="mailto:agence@aracom-conseil.fr" className="text-aracom-orange font-semibold hover:underline">agence@aracom-conseil.fr</a>
            <span className="text-slate-400">·</span>
            <span className="text-sm text-slate-600">40 47 88 50</span>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

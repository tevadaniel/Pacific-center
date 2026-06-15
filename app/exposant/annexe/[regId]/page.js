'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Loader2, Printer, Download, ArrowLeft } from 'lucide-react';
import { api } from '@/lib/auth-client';

function fmtDate(date) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
}
function dayLongLabel(day_label) {
  return day_label === 'samedi' ? 'Samedi 15 août 2026' : 'Vendredi 14 août 2026';
}

export default function AnnexePage() {
  const params = useParams();
  const regId = params?.regId;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!regId) return;
    api(`/api/exposant/annexe/${regId}`)
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [regId]);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-white"><Loader2 className="w-8 h-8 animate-spin text-aracom-orange" /></div>;
  if (error) return <div className="min-h-screen flex items-center justify-center bg-aracom-beige-pale p-8 text-center"><div><h1 className="text-xl font-bold text-rose-700">{error}</h1><p className="text-sm text-slate-500 mt-2">Contactez agence@aracom-conseil.fr</p></div></div>;

  const { registration: reg, organization: org, venue, stand_assignment: standAsn, animations, caution } = data;
  const cautionLabel = caution?.status === 'received' ? '✅ Reçue' : caution?.status === 'returned' ? '🔄 Rendue' : '⏳ À recevoir';

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white">
      {/* Bar d'action (masquée à l'impression) */}
      <div className="sticky top-0 z-50 bg-aracom-black text-white p-3 flex justify-between items-center shadow-lg print:hidden">
        <a href="/exposant" className="flex items-center gap-2 text-sm hover:text-aracom-orange transition">
          <ArrowLeft className="w-4 h-4" /> Retour au portail
        </a>
        <h1 className="font-bold text-sm md:text-base">📋 Annexe N°1 — Fiche de réservation</h1>
        <Button onClick={() => window.print()} className="bg-aracom-orange hover:bg-aracom-orange/90 text-white gap-2" size="sm">
          <Printer className="w-4 h-4" /> Imprimer / Exporter PDF
        </Button>
      </div>

      {/* Document A4 imprimable */}
      <div className="max-w-[210mm] mx-auto bg-white shadow-2xl print:shadow-none my-4 print:my-0 p-8 print:p-6 text-[12px] leading-relaxed">
        {/* Header */}
        <div className="border-b-4 border-aracom-orange pb-3 mb-4">
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-aracom-orange font-bold">Annexe N°1 — Convention de mise à disposition</div>
              <h1 className="text-2xl font-bold text-aracom-black mt-1">Fiche de réservation Exposant</h1>
              <div className="text-[11px] text-slate-600 mt-0.5">Forum de la Rentrée 2026 · Pacific Centers · {venue?.name || '—'}</div>
            </div>
            <div className="text-right">
              <div className="text-3xl">🌺</div>
              <div className="text-[10px] text-slate-500 mt-1">Édition généré le {new Date().toLocaleDateString('fr-FR')}</div>
            </div>
          </div>
        </div>

        {/* Bloc 1 : Identité Exposant */}
        <section className="mb-5">
          <h2 className="text-[14px] font-bold uppercase text-aracom-black border-l-4 border-aracom-orange pl-2 mb-2">1. Identité de l&apos;Exposant</h2>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
            <Field label="Activité / Discipline" value={org?.discipline} />
            <Field label="Entité" value={org?.name} />
            <Field label="Représentée par" value={org?.contact_name} />
            <Field label="N° Tahiti" value={org?.tahiti_number} fillable={!org?.tahiti_number} />
            <Field label="Adresse" value={org?.address} fillable={!org?.address} className="col-span-2" />
            <Field label="Téléphone" value={org?.phone} />
            <Field label="E-mail" value={org?.main_email} />
          </div>
        </section>

        {/* Bloc 2 : Site & Stand */}
        <section className="mb-5">
          <h2 className="text-[14px] font-bold uppercase text-aracom-black border-l-4 border-aracom-orange pl-2 mb-2">2. Site et stand attribués</h2>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
            <Field label="Site" value={venue?.name} />
            <Field label="Adresse" value={venue?.address} />
            <Field label="Propriétaire / Bailleur" value={venue?.owner_sci} className="col-span-2" />
            <Field label="Stand attribué" value={standAsn?.stand_code || reg?.stand_code} highlight />
            <Field label="Statut" value={
              standAsn?.request_status === 'validated' ? '✅ Validé par ARACOM' :
              standAsn?.request_status === 'pending' ? '⏳ En attente de validation' :
              standAsn?.request_status === 'waitlist' ? '⏳ Liste d\'attente' :
              'À confirmer'
            } />
          </div>
        </section>

        {/* Bloc 3 : Jours et horaires de présence */}
        <section className="mb-5">
          <h2 className="text-[14px] font-bold uppercase text-aracom-black border-l-4 border-aracom-orange pl-2 mb-2">3. Jours et horaires de présence</h2>
          <table className="w-full text-[11px] border border-slate-300">
            <thead className="bg-aracom-gold/20">
              <tr>
                <th className="text-left p-1.5 border border-slate-300">Jour</th>
                <th className="text-left p-1.5 border border-slate-300">Horaires Forum</th>
                <th className="text-left p-1.5 border border-slate-300">Horaires de ma présence</th>
              </tr>
            </thead>
            <tbody>
              {['vendredi', 'samedi'].map(d => {
                const isAttending = (reg?.attending_days || []).includes(d);
                const t = reg?.attending_day_times?.[d];
                const forumHours = d === 'vendredi' ? '11h - 17h (installation dès 10h)' : '09h - 17h';
                return (
                  <tr key={d} className={isAttending ? 'bg-emerald-50/40' : 'opacity-40'}>
                    <td className="p-1.5 border border-slate-300 font-semibold">{isAttending ? '☑' : '☐'} {dayLongLabel(d)}</td>
                    <td className="p-1.5 border border-slate-300">{forumHours}</td>
                    <td className="p-1.5 border border-slate-300 font-mono">{isAttending && t ? `${t.start} → ${t.end}` : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        {/* Bloc 4 : Animations prévues */}
        <section className="mb-5">
          <h2 className="text-[14px] font-bold uppercase text-aracom-black border-l-4 border-aracom-orange pl-2 mb-2">4. Animations prévues</h2>
          {Array.isArray(animations) && animations.length > 0 ? (
            <table className="w-full text-[11px] border border-slate-300">
              <thead className="bg-aracom-gold/20">
                <tr>
                  <th className="text-left p-1.5 border border-slate-300 w-[100px]">Jour</th>
                  <th className="text-left p-1.5 border border-slate-300 w-[100px]">Créneau</th>
                  <th className="text-left p-1.5 border border-slate-300 w-[80px]">Lieu</th>
                  <th className="text-left p-1.5 border border-slate-300">Titre / Description</th>
                  <th className="text-left p-1.5 border border-slate-300 w-[100px]">Statut</th>
                </tr>
              </thead>
              <tbody>
                {animations.map(a => (
                  <tr key={a.id}>
                    <td className="p-1.5 border border-slate-300">{a.day_label === 'samedi' ? 'Sam. 15/08' : 'Ven. 14/08'}</td>
                    <td className="p-1.5 border border-slate-300 font-mono">{a.start_time} → {a.end_time}</td>
                    <td className="p-1.5 border border-slate-300">{a.location_type === 'sur_stand' ? 'Sur stand' : 'Zone démo'}</td>
                    <td className="p-1.5 border border-slate-300">
                      {a.title || a.slot_type || '—'}
                      {a.description && <div className="text-[10px] text-slate-600 italic mt-0.5">{a.description}</div>}
                    </td>
                    <td className="p-1.5 border border-slate-300 text-[10px]">
                      {a.request_status === 'validated' ? '✅ Validé' : a.request_status === 'pending' ? '⏳ En attente' : a.request_status === 'waitlist' ? '⏳ Liste d\'attente' : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="text-[11px] italic text-rose-700 bg-rose-50 border border-rose-200 rounded p-2">
              ⚠️ Aucune animation prévue. Rappel : <b>au moins 1 animation par jour de présence est obligatoire</b> (démonstration, initiation, activité ou écran vidéo).
            </div>
          )}
        </section>

        {/* Bloc 5 : Caution */}
        <section className="mb-5">
          <h2 className="text-[14px] font-bold uppercase text-aracom-black border-l-4 border-aracom-orange pl-2 mb-2">5. Caution / Dépôt de garantie</h2>
          <div className="bg-aracom-gold/10 border border-aracom-gold/40 rounded p-3 grid grid-cols-2 gap-3">
            <Field label="Montant" value={`${caution.amount_xpf.toLocaleString('fr-FR')} XPF`} highlight />
            <Field label="Forme" value="Chèque de caution à l'ordre du bailleur" />
            <Field label="Statut" value={cautionLabel} />
            <Field label="Date d'encaissement" value={caution.received_at ? fmtDate(caution.received_at) : '—'} />
          </div>
          <div className="text-[10px] text-slate-600 mt-2 italic">
            La caution sera <b>rendue à l&apos;issue de l&apos;événement</b> si tous les engagements sont respectés (présence, animation, propreté). Elle sera <b>encaissée</b> en cas de non-respect des obligations ou de désistement après le <b>vendredi 31 juillet 2026</b>.
          </div>
        </section>

        {/* Bloc 6 : Engagements (résumé) */}
        <section className="mb-5">
          <h2 className="text-[14px] font-bold uppercase text-aracom-black border-l-4 border-aracom-orange pl-2 mb-2">6. Engagements de l&apos;Exposant</h2>
          <ul className="text-[11px] grid grid-cols-2 gap-x-4 gap-y-0.5 list-disc list-inside text-slate-700">
            <li>Être présent aux horaires indiqués</li>
            <li>Assurer une animation (obligatoire)</li>
            <li>Décorer le stand à mon image</li>
            <li>Fournir attestation d&apos;assurance dommages + RC</li>
            <li>Apporter chaises, rallonges, écran...</li>
            <li>Ranger matériel/stock sous la table</li>
            <li>Pas de vente directe ni démarchage</li>
            <li>Pas de prospectus en galerie</li>
            <li>Pas d&apos;oriflammes ni nappes personnelles</li>
            <li>Respect emplacement et propreté</li>
          </ul>
          <div className="text-[10px] text-slate-500 mt-2">
            ⚠️ Cette annexe est une <b>récapitulation</b> de votre dossier d&apos;inscription. Les conditions complètes figurent dans la <b>Convention de mise à disposition</b> signée séparément.
          </div>
        </section>

        {/* Footer */}
        <div className="mt-6 pt-3 border-t border-slate-200 text-[9px] text-slate-400 text-center">
          ARACOM — Forum de la Rentrée 2026 · Document généré automatiquement le {new Date().toLocaleString('fr-FR')} · Référence registration: {reg?.id}
        </div>
      </div>

      <style jsx global>{`
        @media print {
          @page { margin: 12mm; size: A4; }
          body { background: white !important; }
        }
      `}</style>
    </div>
  );
}

function Field({ label, value, highlight, fillable, className = '' }) {
  return (
    <div className={`flex flex-col ${className}`}>
      <span className="text-[9px] uppercase tracking-wider text-slate-500 font-semibold">{label}</span>
      <span className={`${highlight ? 'text-aracom-orange font-bold text-[14px]' : 'text-aracom-black'} ${fillable ? 'border-b border-dashed border-slate-400 min-h-[14px]' : ''}`}>
        {value || (fillable ? '............................' : '—')}
      </span>
    </div>
  );
}

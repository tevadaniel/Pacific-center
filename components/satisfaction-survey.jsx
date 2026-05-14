'use client';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Star, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/auth-client';

/**
 * 📝 Questionnaire de satisfaction post-événement
 *    Suit la structure officielle du document "Questionnaire.docx".
 *    Toutes les réponses sont stockées dans `satisfaction_responses` (1 par org).
 */
export default function SatisfactionSurvey({ organizationId, organizationName, registrationId, venueId, standCode, defaultDays = [] }) {
  const [submitted, setSubmitted] = useState(false);
  const [existing, setExisting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // ─── Form state ───
  const [contact, setContact] = useState('');
  const [days, setDays] = useState(defaultDays);
  const [firstTime, setFirstTime] = useState('');
  const [ratings, setRatings] = useState({});
  const [emplacementConforme, setEmplacementConforme] = useState('');
  const [electricityIssue, setElectricityIssue] = useState('');
  const [contactsCollected, setContactsCollected] = useState('');
  const [nps, setNps] = useState(null);
  const [return2027, setReturn2027] = useState('');
  const [positives, setPositives] = useState('');
  const [improvements, setImprovements] = useState('');
  const [freeComment, setFreeComment] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!organizationId) { setLoading(false); return; }
      try {
        const r = await api(`/api/exposant/satisfaction?organization_id=${encodeURIComponent(organizationId)}`);
        if (cancelled) return;
        if (r.response) {
          setExisting(r.response);
          setSubmitted(true);
        }
      } catch { /* ignore */ }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [organizationId]);

  const setRating = (k, v) => setRatings(prev => ({ ...prev, [k]: v }));

  const toggleDay = (d) => {
    setDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);
  };

  const submit = async () => {
    // Validation light
    if (!days.length) { toast.error('Indiquez vos jours de participation'); return; }
    if (!firstTime) { toast.error('Indiquez si c\'était votre première participation'); return; }
    if (!ratings.satisfaction_globale) { toast.error('Indiquez votre satisfaction globale'); return; }
    if (nps === null || nps === undefined) { toast.error('Indiquez votre note de recommandation (NPS)'); return; }
    if (!return2027) { toast.error('Indiquez si vous comptez reparticiper en 2027'); return; }

    setSaving(true);
    try {
      const r = await api('/api/exposant/satisfaction', {
        method: 'POST',
        body: JSON.stringify({
          organization_id: organizationId,
          registration_id: registrationId,
          venue_id: venueId,
          stand_code: standCode,
          contact, attending_days: days, first_time: firstTime,
          ratings,
          emplacement_conforme: emplacementConforme,
          electricity_issue: electricityIssue,
          contacts_collected: contactsCollected,
          nps,
          return_2027: return2027,
          positives, improvements, free_comment: freeComment,
        }),
      });
      if (r.ok) {
        toast.success('Merci ! Votre retour a bien été enregistré.');
        setSubmitted(true);
      }
    } catch (e) {
      toast.error(e.message);
    } finally { setSaving(false); }
  };

  if (loading) {
    return <div className="text-sm text-slate-500 p-4">Chargement…</div>;
  }

  if (submitted) {
    return (
      <Card className="border-emerald-200 bg-emerald-50/40">
        <CardContent className="p-8 text-center">
          <CheckCircle2 className="w-16 h-16 mx-auto text-emerald-600 mb-3" />
          <h3 className="text-2xl font-bold text-aracom-black mb-1">Merci pour votre retour !</h3>
          <p className="text-sm text-slate-600">Vos réponses ont été enregistrées le {existing ? new Date(existing.submitted_at).toLocaleString('fr-FR') : 'à l\'instant'}.</p>
          <p className="text-xs text-slate-500 mt-3">L&apos;équipe ARACOM exploite ces retours pour améliorer la prochaine édition.</p>
          <a
            href={`/api/exposant/documents/questionnaire/${encodeURIComponent(organizationId)}`}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-md bg-aracom-black text-aracom-beige-pale text-sm font-medium hover:bg-aracom-black/90 transition"
            data-testid="download-questionnaire-filled"
          >
            📋 Télécharger mes réponses (PDF)
          </a>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border-aracom-gold/40">
        <CardHeader className="bg-aracom-black text-aracom-beige-pale rounded-t-lg">
          <CardTitle className="font-serif text-xl tracking-wide">Questionnaire de satisfaction</CardTitle>
          <p className="text-xs text-aracom-gold/80 mt-1">Forum de la Rentrée 2026 — Votre avis nous est précieux</p>
        </CardHeader>
        <CardContent className="p-6 space-y-8">

          {/* §1 — IDENTIFICATION */}
          <SectionBlock title="Identification">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormRow label="Nom de la structure">
                <Input value={organizationName || ''} disabled className="bg-aracom-beige-fond" />
              </FormRow>
              <FormRow label="Site de participation">
                <Input value={venueId || ''} disabled className="bg-aracom-beige-fond" />
              </FormRow>
              <FormRow label="Numéro d'emplacement">
                <Input value={standCode || ''} disabled className="bg-aracom-beige-fond" />
              </FormRow>
              <FormRow label="Contact (facultatif)">
                <Input value={contact} onChange={e => setContact(e.target.value)} placeholder="email ou téléphone" />
              </FormRow>
            </div>
            <FormRow label="Jours de participation *">
              <div className="flex flex-wrap gap-2">
                {[{ k: 'friday', l: 'Vendredi 14 août' }, { k: 'saturday', l: 'Samedi 15 août' }, { k: 'both', l: 'Les deux jours' }].map(opt => {
                  const active = opt.k === 'both' ? days.length >= 2 : days.includes(opt.k);
                  return (
                    <button key={opt.k} type="button"
                      onClick={() => {
                        if (opt.k === 'both') setDays(['friday', 'saturday']);
                        else toggleDay(opt.k);
                      }}
                      className={`px-3 py-1.5 rounded-full text-sm border transition ${active ? 'bg-aracom-black text-aracom-beige-pale border-aracom-black' : 'bg-white text-slate-700 border-aracom-beige-clair hover:bg-aracom-beige-pale'}`}
                    >{opt.l}</button>
                  );
                })}
              </div>
            </FormRow>
            <FormRow label="Était-ce votre première participation au Forum de la Rentrée ? *">
              <RadioGroup value={firstTime} onChange={setFirstTime} options={[
                { v: 'first', l: 'Oui, première fois' },
                { v: '1-2',   l: 'Non, 1 à 2 éditions précédentes' },
                { v: '3+',    l: 'Non, 3 éditions ou plus' },
              ]} />
            </FormRow>
          </SectionBlock>

          {/* §2 — PRÉPARATION */}
          <SectionBlock title="Préparation et inscription" desc="Notez chaque critère de 1 (☆ mauvais) à 5 (☆☆☆☆☆ excellent)">
            <Stars label="La procédure d'inscription était claire et simple"  value={ratings.procedure_clarte} onChange={v => setRating('procedure_clarte', v)} />
            <Stars label="Les informations reçues avant l'événement étaient suffisantes (convention, guide exposant, confirmation emplacement)" value={ratings.infos_pre_event} onChange={v => setRating('infos_pre_event', v)} />
            <Stars label="La réactivité d'ARACOM à vos questions avant l'événement" value={ratings.reactivite_aracom} onChange={v => setRating('reactivite_aracom', v)} />
          </SectionBlock>

          {/* §3 — LOGISTIQUE */}
          <SectionBlock title="Logistique sur site">
            <Stars label="L'accueil par l'agent ARACOM à votre arrivée" value={ratings.accueil_aracom} onChange={v => setRating('accueil_aracom', v)} />
            <FormRow label="Votre emplacement correspondait au plan d'implantation prévu ?">
              <RadioGroup value={emplacementConforme} onChange={setEmplacementConforme} options={[
                { v: 'oui', l: 'Oui, conforme' },
                { v: 'leger', l: 'Légèrement différent mais acceptable' },
                { v: 'non', l: 'Non, problème important' },
              ]} />
            </FormRow>
            <Stars label="Qualité du matériel fourni (table, nappes)" value={ratings.materiel_quality} onChange={v => setRating('materiel_quality', v)} />
            <FormRow label="Avez-vous rencontré des difficultés avec l'électricité ?">
              <RadioGroup value={electricityIssue} onChange={setElectricityIssue} options={[
                { v: 'aucun', l: 'Aucun problème' },
                { v: 'mineur', l: 'Problème mineur résolu' },
                { v: 'majeur', l: 'Problème majeur non résolu' },
                { v: 'na', l: 'Pas besoin d\'électricité' },
              ]} />
            </FormRow>
            <Stars label="Fluidité de votre créneau animation (si applicable)" value={ratings.animation_fluidite} onChange={v => setRating('animation_fluidite', v)} />
          </SectionBlock>

          {/* §4 — FRÉQUENTATION */}
          <SectionBlock title="Fréquentation et résultats">
            <Stars label="Le nombre de visiteurs sur votre stand répondait à vos attentes" value={ratings.visiteurs_count} onChange={v => setRating('visiteurs_count', v)} />
            <FormRow label="Nombre approximatif d'inscriptions ou contacts collectés">
              <RadioGroup value={contactsCollected} onChange={setContactsCollected} options={[
                { v: '0', l: '0 — résultat décevant' },
                { v: '1-5', l: '1 à 5' },
                { v: '6-15', l: '6 à 15' },
                { v: '15+', l: 'Plus de 15' },
              ]} />
            </FormRow>
            <Stars label="Le forum vous a permis d'atteindre vos objectifs de rentrée" value={ratings.objectifs_atteints} onChange={v => setRating('objectifs_atteints', v)} />
          </SectionBlock>

          {/* §5 — SATISFACTION GLOBALE */}
          <SectionBlock title="Satisfaction globale">
            <Stars label="Satisfaction générale vis-à-vis du Forum de la Rentrée 2026 *" value={ratings.satisfaction_globale} onChange={v => setRating('satisfaction_globale', v)} required />
            <FormRow label="Recommanderiez-vous le forum à une autre association ? * (0 = jamais — 10 = absolument)">
              <div className="flex flex-wrap gap-1.5">
                {[0,1,2,3,4,5,6,7,8,9,10].map(n => (
                  <button key={n} type="button" onClick={() => setNps(n)}
                    className={`w-9 h-9 rounded-full text-sm font-bold transition ${
                      nps === n
                        ? (n >= 7 ? 'bg-emerald-600 text-white' : n >= 3 ? 'bg-amber-500 text-white' : 'bg-red-600 text-white')
                        : 'bg-aracom-beige-pale text-slate-700 hover:bg-aracom-beige-clair'
                    }`}
                  >{n}</button>
                ))}
              </div>
              <div className="flex justify-between text-[10px] text-slate-500 mt-1.5 px-1">
                <span>Jamais</span><span>Peut-être</span><span>Absolument</span>
              </div>
            </FormRow>
            <FormRow label="Souhaitez-vous reparticiper en 2027 ? *">
              <RadioGroup value={return2027} onChange={setReturn2027} options={[
                { v: 'oui', l: 'Oui, certainement' },
                { v: 'peutetre', l: 'Peut-être' },
                { v: 'non', l: 'Non' },
              ]} />
            </FormRow>
          </SectionBlock>

          {/* §6 — COMMENTAIRES */}
          <SectionBlock title="Commentaires libres">
            <FormRow label="Ce qui a particulièrement bien fonctionné">
              <Textarea value={positives} onChange={e => setPositives(e.target.value)} rows={3} placeholder="Vos retours positifs…" />
            </FormRow>
            <FormRow label="Ce qui pourrait être amélioré">
              <Textarea value={improvements} onChange={e => setImprovements(e.target.value)} rows={3} placeholder="Suggestions et améliorations…" />
            </FormRow>
            <FormRow label="Commentaire ou message libre pour ARACOM">
              <Textarea value={freeComment} onChange={e => setFreeComment(e.target.value)} rows={3} placeholder="Un mot libre…" />
            </FormRow>
          </SectionBlock>

          {/* Submit */}
          <div className="border-t pt-6 flex items-center justify-between">
            <p className="text-xs text-slate-500">Vos réponses sont confidentielles et exploitées par ARACOM uniquement.</p>
            <Button onClick={submit} disabled={saving} className="bg-aracom-black hover:bg-aracom-black/90 text-aracom-beige-pale">
              {saving ? 'Envoi…' : 'Envoyer mon questionnaire'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────
function SectionBlock({ title, desc, children }) {
  return (
    <div className="space-y-4">
      <div className="border-b border-aracom-gold/30 pb-2">
        <h4 className="font-serif text-lg text-aracom-black tracking-wide">{title}</h4>
        {desc && <p className="text-xs text-slate-500 mt-0.5">{desc}</p>}
      </div>
      {children}
    </div>
  );
}
function FormRow({ label, children }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wider text-slate-600">{label}</Label>
      {children}
    </div>
  );
}
function RadioGroup({ value, onChange, options }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(o => (
        <button key={o.v} type="button" onClick={() => onChange(o.v)}
          className={`px-3 py-1.5 rounded-full text-sm border transition ${
            value === o.v ? 'bg-aracom-black text-aracom-beige-pale border-aracom-black' : 'bg-white text-slate-700 border-aracom-beige-clair hover:bg-aracom-beige-pale'
          }`}
        >{o.l}</button>
      ))}
    </div>
  );
}
function Stars({ label, value, onChange, required }) {
  return (
    <div className="space-y-1.5">
      <div className="text-sm text-slate-700">{label} {required && <span className="text-aracom-orange">*</span>}</div>
      <div className="flex gap-1">
        {[1,2,3,4,5].map(n => (
          <button key={n} type="button" onClick={() => onChange(n)}
            className={`w-9 h-9 rounded ${value >= n ? 'text-amber-500' : 'text-slate-300'} hover:scale-110 transition`}
          >
            <Star className="w-7 h-7 mx-auto" fill={value >= n ? 'currentColor' : 'none'} />
          </button>
        ))}
        {value && <span className="ml-2 text-sm text-slate-500 self-center">{value}/5</span>}
      </div>
    </div>
  );
}

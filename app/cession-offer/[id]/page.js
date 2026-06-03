'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { toast, Toaster } from 'sonner';
import { Loader2, CheckCircle2, MessageSquare, XCircle, MapPin, Calendar, Clock, AlertTriangle } from 'lucide-react';
import { api as authApi } from '@/lib/auth-client';

async function api(path, opts = {}) {
  // Si un token magic link est présent, on l'envoie en query.
  // Sinon, on utilise la session de l'utilisateur (cookies + headers x-user-id/role).
  if (opts.method && opts.method !== 'GET') {
    const r = await fetch(`/api${path}`, {
      headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
      ...opts,
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || r.statusText);
    return d;
  }
  return authApi(`/api${path}`, opts);
}

export default function CessionOfferPage() {
  const params = useParams();
  const search = useSearchParams();
  const asnId = params?.id;
  const token = search?.get('token') || '';

  const [offer, setOffer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [showSuggest, setShowSuggest] = useState(false);
  const [suggestion, setSuggestion] = useState('');
  const [showRefuse, setShowRefuse] = useState(false);
  const [responded, setResponded] = useState(null); // {action, message}

  const load = useCallback(async () => {
    if (!asnId) return;
    setLoading(true);
    try {
      const d = await api(`/exposant/cession-offer/${asnId}${token ? `?token=${token}` : ''}`);
      setOffer(d);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [asnId, token]);

  useEffect(() => { load(); }, [load]);

  const respond = async (action, extra = {}) => {
    setSubmitting(true);
    try {
      const body = {
        action,
        target_registration_id: offer?.target?.registration_id,
        ...extra,
      };
      const url = `/exposant/cession-offer/${asnId}/respond${token ? `?token=${token}` : ''}`;
      // Si pas de token magic, utiliser la session utilisateur (api du auth-client)
      const d = await api(url, {
        method: 'POST',
        headers: token ? {} : undefined,
        body: JSON.stringify(body),
      });
      let msg = '✅ Réponse enregistrée';
      if (action === 'accept') msg = '✅ Vous avez accepté ce créneau. ARACOM validera dans les prochaines heures.';
      if (action === 'accept_with_suggestion') msg = '💬 Votre acceptation avec suggestion a été transmise à ARACOM pour arbitrage.';
      if (action === 'refuse_definitively') msg = '❌ Votre refus définitif a été enregistré. Le créneau sera proposé au candidat suivant.';
      setResponded({ action, message: msg, data: d });
      toast.success(msg);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-aracom-beige-pale">
        <Loader2 className="w-8 h-8 animate-spin text-aracom-orange" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-aracom-beige-pale to-aracom-beige-fond flex items-center justify-center p-4">
        <Card className="w-full max-w-lg border-2 border-rose-200 shadow-xl">
          <CardContent className="p-8 text-center space-y-4">
            <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto" />
            <h1 className="text-xl font-bold text-aracom-black">Offre non disponible</h1>
            <p className="text-slate-600">{error}</p>
            <p className="text-xs text-slate-500">Si vous pensez qu'il s'agit d'une erreur, contactez <a href="mailto:agence@aracom-conseil.fr" className="text-aracom-orange underline">agence@aracom-conseil.fr</a>.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (responded) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-aracom-beige-pale to-aracom-beige-fond flex items-center justify-center p-4">
        <Toaster position="top-right" richColors />
        <Card className={`w-full max-w-lg border-2 shadow-xl ${
          responded.action === 'refuse_definitively' ? 'border-rose-300' : 'border-emerald-300'
        }`}>
          <CardContent className="p-8 text-center space-y-4">
            <div className="text-6xl">{responded.action === 'refuse_definitively' ? '❌' : responded.action === 'accept_with_suggestion' ? '💬' : '✅'}</div>
            <h1 className="text-2xl font-bold text-aracom-black">Réponse enregistrée</h1>
            <p className="text-slate-700 leading-relaxed">{responded.message}</p>
            <div className="text-xs text-slate-500 pt-4 border-t mt-4">
              Vous recevrez un email de confirmation à l'adresse de votre organisation.
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-aracom-beige-pale to-aracom-beige-fond pb-12">
      <Toaster position="top-right" richColors />
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="text-5xl mb-2">🔔</div>
          <h1 className="text-3xl font-bold text-aracom-black">Un créneau vient de se libérer</h1>
          <p className="text-aracom-black/60 mt-1">Forum de la Rentrée 2026 — Vous étiez en liste d'attente</p>
        </div>

        {/* Package details card */}
        <Card className="border-2 border-aracom-gold/60 shadow-xl mb-6">
          <CardContent className="p-6 space-y-5">
            <div className="bg-aracom-orange/10 border-l-4 border-aracom-orange rounded-r p-3 text-sm text-aracom-black">
              <b>📦 Package complet proposé</b><br />
              Stand + créneaux d'animation indissociables. Si vous acceptez, ce package vous sera attribué après validation par ARACOM.
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
              <div className="flex items-start gap-2">
                <MapPin className="w-5 h-5 text-aracom-orange mt-0.5 shrink-0" />
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Site</div>
                  <div className="text-aracom-black font-bold">{offer?.venue?.name || '—'}</div>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-aracom-orange text-xl">🎪</span>
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Stand</div>
                  <div className="text-aracom-black font-bold">{offer?.stand_code || '—'}</div>
                </div>
              </div>
            </div>

            <div>
              <div className="text-sm font-bold text-aracom-black mb-2 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-aracom-orange" /> Créneaux d'animation inclus
              </div>
              {Array.isArray(offer?.animations) && offer.animations.length > 0 ? (
                <div className="space-y-2">
                  {offer.animations.map(a => (
                    <div key={a.id} className="border border-aracom-gold/40 rounded-lg p-3 bg-aracom-gold/10">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="font-semibold text-aracom-black">
                          📅 {a.day_label === 'samedi' ? 'Samedi 15 août' : 'Vendredi 14 août'}
                        </div>
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-aracom-orange/15 text-aracom-orange border border-aracom-orange/30">
                          {a.location_type === 'sur_stand' ? '🎪 Sur stand' : '🎭 Zone démo'}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-sm text-slate-700">
                        <Clock className="w-3 h-3" />
                        <span>{a.start_time} → {a.end_time}</span>
                      </div>
                      {a.title && <div className="mt-1 text-sm text-slate-600 italic">« {a.title} »</div>}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-slate-500 italic">Aucun créneau d'animation lié à ce stand.</div>
              )}
            </div>

            {offer?.cession_offer_expires_at && (
              <div className="text-xs text-slate-500 border-t pt-3">
                ⏱️ Cette offre expire le <b>{new Date(offer.cession_offer_expires_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}</b>.
              </div>
            )}
          </CardContent>
        </Card>

        {/* 3 actions */}
        {!showSuggest && !showRefuse && (
          <div className="space-y-3">
            <Button
              onClick={() => respond('accept')}
              disabled={submitting}
              className="w-full h-auto py-4 bg-emerald-600 hover:bg-emerald-700 text-white text-base font-bold shadow-lg"
              data-testid="cession-accept"
            >
              <CheckCircle2 className="w-5 h-5 mr-2" />
              ✅ J&apos;accepte ce créneau
            </Button>
            <Button
              onClick={() => setShowSuggest(true)}
              disabled={submitting}
              variant="outline"
              className="w-full h-auto py-4 border-2 border-aracom-orange text-aracom-orange hover:bg-aracom-orange/10 text-base font-bold"
              data-testid="cession-suggest"
            >
              <MessageSquare className="w-5 h-5 mr-2" />
              💬 J&apos;accepte mais j&apos;ai une suggestion
            </Button>
            <Button
              onClick={() => setShowRefuse(true)}
              disabled={submitting}
              variant="outline"
              className="w-full h-auto py-4 border-2 border-rose-400 text-rose-600 hover:bg-rose-50 text-base font-bold"
              data-testid="cession-refuse"
            >
              <XCircle className="w-5 h-5 mr-2" />
              ❌ Je refuse définitivement
            </Button>
            <p className="text-xs text-slate-500 text-center pt-2">
              ⚠️ Le refus définitif est <b>irréversible</b> : votre candidature pour ce stand sera clôturée et le créneau proposé au candidat suivant.
            </p>
          </div>
        )}

        {/* Suggestion dialog inline */}
        {showSuggest && (
          <Card className="border-2 border-aracom-orange/40 shadow-lg">
            <CardContent className="p-6 space-y-4">
              <h2 className="text-lg font-bold text-aracom-black flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-aracom-orange" /> Acceptation avec suggestion
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                Décrivez à ARACOM la modification que vous souhaiteriez (ex: <i>« Je préférerais l&apos;animation à 14h au lieu de 10h »</i>). ARACOM arbitrera et reviendra vers vous.
              </p>
              <Textarea
                value={suggestion}
                onChange={e => setSuggestion(e.target.value)}
                placeholder="Votre suggestion pour ARACOM..."
                rows={4}
                className="border-aracom-gold/40 focus:border-aracom-orange"
                data-testid="cession-suggestion-text"
              />
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => { setShowSuggest(false); setSuggestion(''); }}>Annuler</Button>
                <Button
                  onClick={() => respond('accept_with_suggestion', { suggestion: suggestion.trim() })}
                  disabled={submitting || !suggestion.trim()}
                  className="bg-aracom-orange hover:bg-aracom-orange/90 text-white"
                  data-testid="cession-suggestion-submit"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  Envoyer ma suggestion
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Refuse confirmation dialog inline */}
        {showRefuse && (
          <Card className="border-2 border-rose-300 shadow-lg">
            <CardContent className="p-6 space-y-4">
              <h2 className="text-lg font-bold text-rose-700 flex items-center gap-2">
                <XCircle className="w-5 h-5" /> Confirmer le refus définitif
              </h2>
              <div className="bg-rose-50 border-l-4 border-rose-400 rounded-r p-3 text-sm text-rose-900">
                <b>⚠️ Action irréversible</b><br />
                Votre candidature pour ce stand sera <b>clôturée définitivement</b>. Vous ne recevrez plus aucune offre de cession pour ce stand. Le créneau sera immédiatement proposé au candidat suivant.
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowRefuse(false)}>Annuler</Button>
                <Button
                  onClick={() => respond('refuse_definitively')}
                  disabled={submitting}
                  className="bg-rose-600 hover:bg-rose-700 text-white"
                  data-testid="cession-refuse-confirm"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  Confirmer le refus définitif
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

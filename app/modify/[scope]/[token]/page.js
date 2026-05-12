'use client';
import { useEffect, useState, use as ReactUse } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast, Toaster } from 'sonner';
import { Loader2, Check, Clock, Calendar } from 'lucide-react';

export default function ModifyPage({ params }) {
  const { scope, token } = params;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [availability, setAvailability] = useState(null);
  const [selected, setSelected] = useState({});
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`/api/wizard/modification-token/${token}`);
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'Lien invalide');
        if (d.token.scope !== scope) throw new Error('Lien de mauvaise portée');
        setData(d);
        const av = await fetch('/api/wizard/availability').then(x => x.json());
        setAvailability(av);
      } catch (e) { toast.error(e.message); }
      finally { setLoading(false); }
    })();
  }, [token, scope]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;
  if (!data) return <div className="p-8 text-center text-red-600">Lien invalide ou expiré.</div>;

  const state = data.state;
  const venue = (availability?.venues || []).find(v => v.id === state.registration?.venue_id);

  const submit = async () => {
    setSaving(true);
    try {
      if (scope === 'visit_slot') {
        if (!selected.visit_slot_id) { toast.error('Choisissez un créneau'); setSaving(false); return; }
        const r = await fetch('/api/wizard/booking', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            registration_id: state.registration.id,
            venue_id: state.registration.venue_id,
            day_label: state.registration.visit_day_label,
            visit_slot_id: selected.visit_slot_id,
          }),
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        toast.success('Créneau de passage mis à jour ✓');
        setDone(true);
      } else if (scope === 'animation_slot') {
        if (!selected.start_time) { toast.error('Choisissez un créneau'); setSaving(false); return; }
        const a = state.animation_slots?.[0] || {};
        const r = await fetch('/api/wizard/animation', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            registration_id: state.registration.id,
            location_type: a.location_type || 'sur_stand',
            slot_type: a.slot_type || 'demonstration',
            title: a.title || 'Animation',
            target_audience: a.target_audience || 'tous_publics',
            material_needs: a.material_needs || '',
            start_time: selected.start_time,
            end_time: selected.end_time,
          }),
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        toast.success('Créneau d\'animation mis à jour ✓');
        setDone(true);
      }
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-emerald-50">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <Check className="w-12 h-12 mx-auto text-emerald-600 mb-3" />
            <h1 className="text-2xl font-bold">Modification enregistrée</h1>
            <p className="text-slate-600 mt-2">Votre nouveau créneau a été confirmé. Vous pouvez fermer cette page.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // VISIT SLOT MODIFICATION
  if (scope === 'visit_slot') {
    const slots = venue?.visit_slots?.filter(s => s.day_label === state.registration?.visit_day_label) || [];
    return (
      <div className="min-h-screen bg-slate-50 p-4">
        <Toaster richColors />
        <Card className="max-w-2xl mx-auto mt-8">
          <CardContent className="p-6 space-y-4">
            <h1 className="text-xl font-bold flex items-center gap-2"><Calendar className="w-5 h-5 text-blue-600" /> Modifier mon créneau de passage</h1>
            <p className="text-sm text-slate-500">Site : <b>{venue?.name}</b> · Jour : <b>{state.registration?.visit_day_label === 'samedi' ? 'Samedi 15/08' : 'Vendredi 14/08'}</b></p>
            <p className="text-xs text-slate-500">Créneau actuel : {state.visit_slot ? `${state.visit_slot.start_time}–${state.visit_slot.end_time}` : '—'}</p>
            <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
              {slots.map(s => {
                const isSel = selected.visit_slot_id === s.id;
                const isCurrent = state.visit_slot?.id === s.id;
                return (
                  <button
                    key={s.id}
                    disabled={s.is_full && !isCurrent}
                    onClick={() => setSelected({ visit_slot_id: s.id })}
                    className={`p-2 rounded border-2 text-center transition ${
                      isSel ? 'border-blue-600 bg-blue-600 text-white' :
                      isCurrent ? 'border-emerald-500 bg-emerald-50' :
                      s.is_full ? 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed' :
                      'border-slate-200 hover:border-blue-400'
                    }`}
                  >
                    <div className="font-mono text-sm font-bold">{s.start_time}</div>
                    <div className="text-[10px]">{s.is_full ? 'Plein' : `${s.remaining}/${s.capacity}`}{isCurrent ? ' · actuel' : ''}</div>
                  </button>
                );
              })}
            </div>
            <Button onClick={submit} disabled={saving || !selected.visit_slot_id} className="w-full bg-blue-600 hover:bg-blue-700">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null} Confirmer le nouveau créneau
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ANIMATION SLOT MODIFICATION
  if (scope === 'animation_slot') {
    const config = availability?.config || {};
    const occupied = (venue?.animation_slots_occupied || []).filter(s => s.day_label === state.registration?.visit_day_label && s.registration_id !== state.registration.id);
    const animSlots = (config.ANIM_SLOTS || []).map(slot => {
      const isOccupied = occupied.some(o => o.start_time < slot.end && o.end_time > slot.start);
      const isSel = selected.start_time === slot.start;
      return { ...slot, isOccupied, isSel };
    });
    return (
      <div className="min-h-screen bg-slate-50 p-4">
        <Toaster richColors />
        <Card className="max-w-2xl mx-auto mt-8">
          <CardContent className="p-6 space-y-4">
            <h1 className="text-xl font-bold flex items-center gap-2"><Clock className="w-5 h-5 text-violet-600" /> Modifier mon créneau d&apos;animation</h1>
            <p className="text-sm text-slate-500">Site : <b>{venue?.name}</b> · Animation : <b>{state.animation_slots?.[0]?.title || '—'}</b></p>
            <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
              {animSlots.map((s, i) => (
                <button
                  key={`${s.start}-${i}`}
                  disabled={s.isOccupied}
                  onClick={() => setSelected({ start_time: s.start, end_time: s.end })}
                  className={`p-2 rounded border-2 text-center transition ${
                    s.isSel ? 'border-violet-600 bg-violet-600 text-white' :
                    s.isOccupied ? 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed' :
                    'border-slate-200 hover:border-violet-400'
                  }`}
                >
                  <div className="font-mono text-xs font-bold">{s.start}</div>
                  <div className="text-[10px]">{s.isOccupied ? 'Pris' : 'Libre'}</div>
                </button>
              ))}
            </div>
            <Button onClick={submit} disabled={saving || !selected.start_time} className="w-full bg-violet-600 hover:bg-violet-700">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null} Confirmer le nouveau créneau
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}

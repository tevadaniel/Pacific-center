'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Bell, BellOff } from 'lucide-react';
import { toast } from 'sonner';
import { isPushSupported, subscribeToPush, unsubscribeFromPush, getCurrentPushSubscription, getPushPermission } from '@/lib/push-client';
import { api } from '@/lib/auth-client';

export default function PushToggle() {
  const [supported, setSupported] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [permission, setPermission] = useState('default');

  const refresh = async () => {
    if (!isPushSupported()) { setSupported(false); return; }
    setSupported(true);
    setPermission(await getPushPermission());
    try {
      const sub = await getCurrentPushSubscription();
      setEnabled(Boolean(sub));
    } catch {/* ignore */}
  };

  useEffect(() => { refresh(); }, []);

  const enable = async () => {
    setBusy(true);
    try {
      await subscribeToPush();
      toast.success('🔔 Notifications activées — vous recevrez les nouvelles demandes en temps réel.');
      // Send a test push to confirm the round-trip works
      try { await api('/api/push/test', { method: 'POST', body: JSON.stringify({}) }); } catch {/* ignore */}
      refresh();
    } catch (e) {
      toast.error(e.message || 'Impossible d\'activer les notifications');
    }
    setBusy(false);
  };

  const disable = async () => {
    setBusy(true);
    try {
      await unsubscribeFromPush();
      toast.success('Notifications désactivées');
      refresh();
    } catch (e) { toast.error(e.message); }
    setBusy(false);
  };

  if (!supported) return null;

  if (permission === 'denied') {
    return (
      <Button size="sm" variant="outline" disabled className="gap-1.5 text-rose-600 border-rose-200">
        <BellOff className="w-4 h-4" /> Notifications bloquées
      </Button>
    );
  }

  return enabled ? (
    <Button size="sm" variant="outline" onClick={disable} disabled={busy} className="gap-1.5 text-emerald-700 border-emerald-300 bg-emerald-50">
      <Bell className="w-4 h-4" /> Notifications ON
    </Button>
  ) : (
    <Button size="sm" variant="outline" onClick={enable} disabled={busy} className="gap-1.5">
      <BellOff className="w-4 h-4" /> Activer notifications
    </Button>
  );
}

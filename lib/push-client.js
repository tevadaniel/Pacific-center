'use client';
// Client-side helper to manage Web Push subscriptions
import { api } from '@/lib/auth-client';

export function isPushSupported() {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export async function getPushPermission() {
  if (!isPushSupported()) return 'unsupported';
  return Notification.permission; // 'default' | 'granted' | 'denied'
}

export async function subscribeToPush() {
  if (!isPushSupported()) throw new Error('Push non supporté par ce navigateur');
  // Ask permission if needed
  let perm = Notification.permission;
  if (perm === 'default') {
    perm = await Notification.requestPermission();
  }
  if (perm !== 'granted') throw new Error("Permission refusée pour les notifications");

  // Wait for SW registration
  const reg = await navigator.serviceWorker.ready;
  // Fetch VAPID public key
  const { public_key } = await api('/api/push/vapid-key');
  if (!public_key) throw new Error('VAPID non configuré côté serveur');
  const appServerKey = urlBase64ToUint8Array(public_key);

  // Already subscribed? unsubscribe first to refresh keys
  let sub = await reg.pushManager.getSubscription();
  if (sub && sub.options && sub.options.applicationServerKey) {
    // Compare keys; if changed, resubscribe
    try { await sub.unsubscribe(); } catch {/* ignore */}
    sub = null;
  }
  if (!sub) {
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: appServerKey });
  }
  await api('/api/push/subscribe', { method: 'POST', body: JSON.stringify({ subscription: sub.toJSON(), user_agent: navigator.userAgent }) });
  return { ok: true };
}

export async function unsubscribeFromPush() {
  if (!isPushSupported()) return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  const endpoint = sub.endpoint;
  try { await sub.unsubscribe(); } catch {/* ignore */}
  try { await api('/api/push/unsubscribe', { method: 'POST', body: JSON.stringify({ endpoint }) }); } catch {/* ignore */}
}

export async function getCurrentPushSubscription() {
  if (!isPushSupported()) return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

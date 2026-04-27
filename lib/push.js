// Web Push helper using web-push (VAPID) — fire-and-forget broadcast to ARACOM admins
import webpush from 'web-push';
import { getDb } from '@/lib/mongo';

let _configured = false;
function configure() {
  if (_configured) return true;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const contact = process.env.VAPID_CONTACT || 'mailto:agence@aracom-conseil.fr';
  if (!pub || !priv) return false;
  try {
    webpush.setVapidDetails(contact, pub, priv);
    _configured = true;
    return true;
  } catch (e) {
    console.error('[push] setVapidDetails failed:', e?.message);
    return false;
  }
}

export function isPushConfigured() {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

export function getVapidPublicKey() {
  return process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
}

/**
 * Save a push subscription for a user.
 * Idempotent on (userId, endpoint).
 */
export async function savePushSubscription({ userId, role, subscription, userAgent }) {
  if (!subscription?.endpoint) throw new Error('subscription.endpoint requis');
  const db = await getDb();
  await db.collection('push_subscriptions').updateOne(
    { user_id: userId, endpoint: subscription.endpoint },
    {
      $set: {
        user_id: userId,
        role: role || null,
        endpoint: subscription.endpoint,
        keys: subscription.keys || {},
        user_agent: userAgent || '',
        updated_at: new Date(),
      },
      $setOnInsert: { id: cryptoRandomId(), created_at: new Date() },
    },
    { upsert: true }
  );
}

export async function deletePushSubscription({ userId, endpoint }) {
  const db = await getDb();
  await db.collection('push_subscriptions').deleteOne({ user_id: userId, endpoint });
}

/**
 * Send a push to all subscriptions matching a role (default: aracom_admin).
 * Cleans up gone subscriptions automatically.
 * @param {Object} payload {title, body, url, icon, tag}
 * @param {Object} opts {role}
 */
export async function pushToRole(payload, { role = 'aracom_admin' } = {}) {
  if (!configure()) {
    console.warn('[push] VAPID non configuré, push ignoré');
    return { ok: false, sent: 0, removed: 0 };
  }
  const db = await getDb();
  const subs = await db.collection('push_subscriptions').find({ role }).toArray();
  if (subs.length === 0) return { ok: true, sent: 0, removed: 0 };

  const data = JSON.stringify(payload || {});
  let sent = 0;
  const toRemove = [];
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, data);
      sent++;
    } catch (e) {
      const code = e?.statusCode;
      if (code === 404 || code === 410) {
        toRemove.push(s.endpoint);
      } else {
        console.warn('[push] send error:', code, e?.message);
      }
    }
  }));
  if (toRemove.length) {
    await db.collection('push_subscriptions').deleteMany({ endpoint: { $in: toRemove } });
  }
  return { ok: true, sent, removed: toRemove.length };
}

function cryptoRandomId() {
  // Lightweight random id (MongoDB doesn't need crypto-secure here)
  return 'ps-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

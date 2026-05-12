/**
 * Background scheduler for mailing/process-scheduled.
 * Runs every 60s in the Node process. Idempotent: only one timer per process.
 */
import { getDb } from './mongo';
import { sendMail, isSmtpConfigured } from './mailer';
import { sendMailAuto } from './mail-config';
import { v4 as uuid } from 'uuid';

const NEXT_PUBLIC_BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

function injectTracking(html, messageId) {
  if (!html) return html;
  const base = NEXT_PUBLIC_BASE_URL;
  let out = html.replace(/<a([^>]*?)href="(https?:\/\/[^"]+)"([^>]*?)>/gi, (m, pre, url, post) => {
    if (url.includes('/api/track/')) return m;
    return `<a${pre}href="${base}/api/track/click/${messageId}?u=${encodeURIComponent(url)}"${post}>`;
  });
  return out + `\n<img src="${base}/api/track/open/${messageId}.gif" alt="" width="1" height="1" style="display:none" />`;
}

async function processOnce() {
  try {
    const db = await getDb();
    const due = await db.collection('email_campaigns')
      .find({ status: 'programmee', scheduled_at: { $lte: new Date() } })
      .toArray();
    if (due.length === 0) return;
    console.log(`[scheduler] Processing ${due.length} due campaign(s)…`);
    const smtpReady = isSmtpConfigured();
    for (const camp of due) {
      const payload = camp.scheduled_payload || {};
      const regs = await db.collection('registrations').find({ id: { $in: payload.registration_ids || [] } }).toArray();
      const orgs = await db.collection('organizations').find({ id: { $in: regs.map(r => r.organization_id) } }).toArray();
      const venues = await db.collection('venues').find({ id: { $in: regs.map(r => r.venue_id).filter(Boolean) } }).toArray();
      const orgById = Object.fromEntries(orgs.map(o => [o.id, o]));
      const venueById = Object.fromEntries(venues.map(v => [v.id, v]));
      let sent = 0, failed = 0;
      for (const r of regs) {
        const o = orgById[r.organization_id]; const v = venueById[r.venue_id];
        if (!o?.main_email) continue;
        const sub = (payload.subject || '').replaceAll('[[NOM_EXPOSANT]]', o.name || '').replaceAll('[[STAND]]', r.stand_code || '').replaceAll('[[SITE]]', v?.name || '').replaceAll('[[CONTACT_NAME]]', o.contact_name || '').replaceAll('[[DISCIPLINE]]', o.discipline || '');
        const bdy = (payload.body_html || '').replaceAll('[[NOM_EXPOSANT]]', o.name || '').replaceAll('[[STAND]]', r.stand_code || '').replaceAll('[[SITE]]', v?.name || '').replaceAll('[[CONTACT_NAME]]', o.contact_name || '').replaceAll('[[DISCIPLINE]]', o.discipline || '');
        const messageId = uuid();
        const tracked = injectTracking(bdy, messageId);
        let sendStatus = 'envoye'; let errorMsg = null;
        if (smtpReady) {
          const r2 = await sendMailAuto({ to: o.main_email, subject: sub, html: tracked }, db);
          if (!r2.ok) { sendStatus = 'echec'; errorMsg = r2.error; failed++; }
        }
        await db.collection('email_messages').insertOne({
          id: messageId, campaign_id: camp.id, registration_id: r.id,
          to_email: o.main_email, subject: sub, body_html: tracked,
          send_status: sendStatus, sent_at: new Date(),
          opened_at: null, clicked_at: null, response_status: 'attente',
          provider_message_id: smtpReady ? messageId : `mock_${messageId}`,
          error_message: errorMsg,
          created_at: new Date(), updated_at: new Date(),
        });
        if (sendStatus === 'envoye') sent++;
      }
      await db.collection('email_campaigns').updateOne({ id: camp.id }, { $set: {
        status: 'envoyee', sent_count: sent, failed_count: failed,
        processed_at: new Date(), updated_at: new Date(),
      } });
      console.log(`[scheduler] Campaign ${camp.id}: ${sent} sent, ${failed} failed`);
    }
  } catch (e) {
    console.error('[scheduler] error:', e.message);
  }
}

// Singleton timer guard
if (typeof global !== 'undefined' && !global._mailingScheduler) {
  global._mailingScheduler = setInterval(processOnce, 60_000);
  // Run once shortly after startup
  setTimeout(processOnce, 5000);
  console.log('[scheduler] Mailing background scheduler started (interval 60s)');
}

export { processOnce };

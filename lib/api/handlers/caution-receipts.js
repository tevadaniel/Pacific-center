import { v4 as uuid } from 'uuid';
import { json, err, getUserContext } from '../helpers';

/**
 * Handler caution-receipts — Réception virement + génération attestation remboursement.
 *
 * Routes :
 *   POST /api/admin/register-virement/:regId
 *   POST /api/admin/refund-attestation/:regId/upload
 *   POST /api/admin/refund-attestation/:regId/generate
 *
 * @param {object} args
 * @param {import('mongodb').Db} args.db
 * @param {Request} args.request
 * @param {string} args.route
 * @param {string[]} args.p
 * @param {object} args.body
 * @param {object} args.deps  - { buildRefundAttestationHTML }
 */
export async function handleCautionReceiptsPost({ db, request, route, p, body, deps = {} }) {
  const ctx = getUserContext(request);

  // POST /api/admin/register-virement/:regId
  if (route.match(/^admin\/register-virement\/[^/]+$/)) {
    if (ctx.role !== 'aracom_admin') return err('Réservé aux admins', 403);
    const regId = p[2];
    const reg = await db.collection('registrations').findOne({ id: regId });
    if (!reg) return err('Inscription introuvable', 404);
    const ref = (body?.virement_reference || '').trim();
    const dateStr = (body?.virement_date || '').trim();
    if (!ref) return err('Référence du virement requise', 400);
    if (!dateStr) return err('Date du virement requise', 400);

    const existing = await db.collection('deposit_transactions').findOne({ registration_id: regId });
    const dep = {
      deposit_mode: 'virement',
      virement_reference: ref,
      virement_date: dateStr,
      virement_validated_by: 'aracom',
      virement_validated_at: new Date(),
      status: 'recue',
      received_at: new Date(),
      updated_at: new Date(),
    };
    if (existing) {
      await db.collection('deposit_transactions').updateOne({ id: existing.id }, { $set: dep });
    } else {
      await db.collection('deposit_transactions').insertOne({
        id: uuid(),
        registration_id: regId,
        amount_xpf: 20000,
        ...dep,
        created_at: new Date(),
      });
    }
    await db.collection('registrations').updateOne({ id: regId }, { $set: {
      status: 'confirme',
      is_pre_reserved: false,
      is_deposit_received: true,
      is_guide_sent: true,
      is_locked: true,
      confirmed_at: new Date(),
      locked_at: new Date(),
      updated_at: new Date(),
    } });
    await db.collection('stand_assignments').updateMany(
      { registration_id: regId, status: 'pre_reserve' },
      { $set: { status: 'confirme', updated_at: new Date() } }
    );

    // Génère le reçu de caution
    try {
      const existingDoc = await db.collection('registration_documents').findOne({ registration_id: regId, document_type: 'recu_caution' });
      if (!existingDoc) {
        const org = await db.collection('organizations').findOne({ id: reg.organization_id });
        const venue = reg.venue_id ? await db.collection('venues').findOne({ id: reg.venue_id }) : null;
        const receiptNumber = `CAUT-2026-${String(reg.id).slice(0, 6).toUpperCase()}`;
        const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Reçu de caution ${org?.name || ''}</title><style>body{font-family:Helvetica,Arial,sans-serif;max-width:680px;margin:32px auto;color:#1f2937;padding:0 16px}h1{color:#1d4ed8;margin:0 0 4px}.box{border:2px solid #1d4ed8;padding:20px;border-radius:8px;margin:20px 0}.row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px dashed #e5e7eb}.label{color:#64748b}.amount{font-size:28px;color:#1d4ed8;font-weight:800}.print-btn{position:fixed;top:20px;right:20px;padding:10px 20px;border-radius:6px;background:#1d4ed8;color:#fff;border:0;cursor:pointer;font-weight:600}@media print{.print-btn{display:none}}</style></head><body><button class="print-btn" onclick="window.print()">🖨️ Imprimer / PDF</button><div style="display:flex;justify-content:space-between;align-items:start;border-bottom:3px solid #1d4ed8;padding-bottom:10px"><div><h1>REÇU DE CAUTION</h1><p style="margin:0;color:#64748b">Forum de la Rentrée 2026 · 14 & 15 août 2026</p></div><div style="text-align:right"><div style="background:#1d4ed8;color:#fff;font-weight:700;padding:6px 12px;border-radius:6px;display:inline-block;letter-spacing:.05em">ARACOM</div><div style="font-size:11px;color:#64748b;margin-top:6px">Émis le ${new Date().toLocaleDateString('fr-FR')}</div></div></div><div class="box"><div class="row"><span class="label">N° de reçu</span><b>${receiptNumber}</b></div><div class="row"><span class="label">Date d'émission</span><b>${new Date().toLocaleDateString('fr-FR')}</b></div><div class="row"><span class="label">Exposant</span><b>${org?.name || '—'}</b></div><div class="row"><span class="label">Site / Stand</span><span>${venue?.name || '—'} / ${reg.stand_code || '—'}</span></div><div class="row"><span class="label">Mode de paiement</span><b>🏦 Virement bancaire</b></div><div class="row"><span class="label">Référence virement</span><b style="font-family:monospace">${ref}</b></div><div class="row"><span class="label">Date du virement</span><b>${dateStr}</b></div></div><div style="text-align:center;padding:18px 0;background:#eff6ff;border-radius:8px"><div class="label">Montant reçu en garantie</div><div class="amount">20 000 XPF</div></div></body></html>`;
        await db.collection('registration_documents').insertOne({
          id: uuid(), registration_id: regId, document_type: 'recu_caution',
          file_name: `Recu_caution_${(org?.name || 'exp').replace(/\s+/g, '_')}_${receiptNumber}.html`,
          mime_type: 'text/html', file_size: html.length,
          file_data: Buffer.from(html, 'utf-8').toString('base64'),
          status: 'valide', uploaded_by: 'aracom-virement',
          uploaded_at: new Date(), validated_at: new Date(),
          receipt_number: receiptNumber,
          created_at: new Date(), updated_at: new Date(),
        });
      }
    } catch (e) { console.error('[register-virement receipt]', e?.message); }

    await db.collection('validation_requests').updateMany(
      { registration_id: regId, status: { $in: ['en_attente', 'pending'] } },
      { $set: { status: 'verrouille', validated_at: new Date(), updated_at: new Date() } }
    ).catch(() => {});

    return json({ ok: true, message: 'Virement enregistré. Caution validée, stand verrouillé.' });
  }

  // POST /api/admin/refund-attestation/:regId/upload
  if (route.match(/^admin\/refund-attestation\/[^/]+\/upload$/)) {
    if (ctx.role !== 'aracom_admin') return err('Réservé aux admins', 403);
    const regId = p[2];
    const { file_name, mime_type, file_base64 } = body || {};
    if (!file_base64) return err('file_base64 requis', 400);
    await db.collection('registration_documents').updateMany(
      { registration_id: regId, document_type: 'attestation_remboursement' },
      { $set: { status: 'remplace', updated_at: new Date() } }
    );
    const fileBuf = Buffer.from(file_base64, 'base64');
    await db.collection('registration_documents').insertOne({
      id: uuid(),
      registration_id: regId,
      document_type: 'attestation_remboursement',
      file_name: file_name || `Attestation_remboursement_signee.pdf`,
      mime_type: mime_type || 'application/pdf',
      file_size: fileBuf.length,
      file_data: file_base64,
      status: 'valide',
      is_signed: true,
      uploaded_by: 'aracom',
      uploaded_at: new Date(),
      validated_at: new Date(),
      created_at: new Date(),
      updated_at: new Date(),
    });
    return json({ ok: true });
  }

  // POST /api/admin/refund-attestation/:regId/generate
  if (route.match(/^admin\/refund-attestation\/[^/]+\/generate$/)) {
    if (ctx.role !== 'aracom_admin') return err('Réservé aux admins', 403);
    const { buildRefundAttestationHTML } = deps;
    if (!buildRefundAttestationHTML) return err('Configuration handler manquante', 500);
    const regId = p[2];
    const reg = await db.collection('registrations').findOne({ id: regId });
    if (!reg) return err('Inscription introuvable', 404);
    const org = await db.collection('organizations').findOne({ id: reg.organization_id });
    const venue = reg.venue_id ? await db.collection('venues').findOne({ id: reg.venue_id }) : null;
    const dep = await db.collection('deposit_transactions').findOne({ registration_id: regId });
    const today = new Date().toLocaleDateString('fr-FR');
    const num = `ATT-2026-${String(regId).slice(0, 6).toUpperCase()}`;
    await db.collection('registration_documents').updateMany(
      { registration_id: regId, document_type: 'attestation_remboursement', is_signed: { $ne: true } },
      { $set: { status: 'remplace', updated_at: new Date() } }
    );
    const html = buildRefundAttestationHTML({ org, venue, reg, dep, num, today });
    const docId = uuid();
    await db.collection('registration_documents').insertOne({
      id: docId,
      registration_id: regId,
      document_type: 'attestation_remboursement',
      file_name: `Attestation_remboursement_${(org?.name || 'exp').replace(/\s+/g, '_')}_${num}.html`,
      mime_type: 'text/html',
      file_size: html.length,
      file_data: Buffer.from(html, 'utf-8').toString('base64'),
      status: 'valide',
      is_signed: false,
      attestation_number: num,
      uploaded_by: 'aracom-manual',
      uploaded_at: new Date(),
      validated_at: new Date(),
      created_at: new Date(),
      updated_at: new Date(),
    });
    return json({ ok: true, document_id: docId, attestation_number: num });
  }

  return null;
}

/**
 * 🎖️ BADGE GENERATOR — Génère un badge exposant PDF A6
 * Format : A6 paysage (148×105 mm), QR code, logo ARACOM, infos clés.
 * Utilise pdfkit.standalone.js pour embarquer les fonts standard.
 */
import PDFDocument from 'pdfkit/js/pdfkit.standalone.js';
import QRCode from 'qrcode';

/**
 * Génère le PDF du badge en buffer Node.
 * @param {Object} data { organization, registration, venue, visit_slot, animation_slots }
 * @returns {Promise<Buffer>}
 */
export async function generateBadgePdf(data) {
  const { organization, registration, venue, visit_slot, animation_slots = [] } = data;

  // A6 paysage = 595/4 × 842/2 -- on prend 148 × 105 mm = 419.5 × 297.6 pts (1mm = ~2.835pt)
  const W = 419.5, H = 297.6;
  const doc = new PDFDocument({ size: [W, H], margin: 0, info: {
    Title: `Badge exposant — ${organization?.name || ''}`,
    Author: 'ARACOM Conseil',
    Subject: 'Forum de la Rentrée 2026',
  } });

  // ─── Buffer collection ───
  const chunks = [];
  doc.on('data', c => chunks.push(c));
  const done = new Promise(resolve => doc.on('end', () => resolve(Buffer.concat(chunks))));

  // ─── Header bandeau bleu ARACOM ───
  doc.rect(0, 0, W, 55).fill('#1e3a8a');
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(18).text('FORUM DE LA RENTRÉE 2026', 18, 12);
  doc.fontSize(9).font('Helvetica').text('14 & 15 août 2026 · Polynésie française', 18, 35);
  doc.fontSize(8).text('ARACOM Conseil × Pacific Centers', W - 165, 12);
  doc.fontSize(7).text('Badge exposant officiel', W - 165, 25);

  // ─── Corps : nom association ───
  doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(22).text(organization?.name || '—', 18, 75, { width: W - 110, ellipsis: true });
  doc.fillColor('#475569').font('Helvetica').fontSize(12).text(organization?.discipline || '—', 18, 105);

  // ─── Bloc infos clés ───
  const infoY = 135;
  doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(10).text('SITE', 18, infoY);
  doc.font('Helvetica').fontSize(11).text(venue?.name || '—', 18, infoY + 14);
  doc.font('Helvetica-Bold').fontSize(10).text('STAND', 110, infoY);
  doc.font('Helvetica').fontSize(11).text(registration?.stand_code || '—', 110, infoY + 14);
  doc.font('Helvetica-Bold').fontSize(10).text('JOUR', 175, infoY);
  doc.font('Helvetica').fontSize(11).text(registration?.visit_day_label === 'samedi' ? 'Sam 15 août' : registration?.visit_day_label === 'vendredi' ? 'Ven 14 août' : '—', 175, infoY + 14);
  if (visit_slot) {
    doc.font('Helvetica-Bold').fontSize(10).text('PASSAGE', 250, infoY);
    doc.font('Helvetica').fontSize(11).text(`${visit_slot.start_time}–${visit_slot.end_time}`, 250, infoY + 14);
  }

  // ─── Bloc contact ───
  const contactY = infoY + 40;
  doc.fillColor('#475569').font('Helvetica').fontSize(8).text('Représentant : ' + (organization?.contact_name || '—'), 18, contactY);
  doc.text((organization?.main_phone || '—') + ' · ' + (organization?.main_email || '—'), 18, contactY + 11);
  if (organization?.representatives_count) {
    doc.text(`${organization.representatives_count} représentant${organization.representatives_count > 1 ? 's' : ''} max sur le stand`, 18, contactY + 22);
  }

  // ─── Animation (si présente) ───
  if (animation_slots.length > 0) {
    const a = animation_slots[0];
    const animY = contactY + 38;
    doc.fillColor('#1e3a8a').font('Helvetica-Bold').fontSize(8).text('ANIMATION', 18, animY);
    doc.fillColor('#0f172a').font('Helvetica').fontSize(9).text(
      `${a.title || a.slot_type} · ${a.start_time}–${a.end_time} · ${a.location_type === 'sur_stand' ? 'Sur stand' : 'Zone démo'}`,
      18, animY + 10, { width: W - 110 }
    );
  }

  // ─── QR code (à droite) ───
  const qrPayload = `ARACOM2026|${registration?.id}|${organization?.id}|${venue?.id}|${registration?.stand_code || ''}`;
  try {
    const qrDataUrl = await QRCode.toDataURL(qrPayload, { width: 200, margin: 0, color: { dark: '#0f172a', light: '#ffffff' } });
    const base64 = qrDataUrl.split(',')[1];
    const buf = Buffer.from(base64, 'base64');
    doc.image(buf, W - 96, 75, { width: 80, height: 80 });
    doc.fillColor('#64748b').font('Helvetica').fontSize(6).text('Scanner pour valider', W - 96, 158, { width: 80, align: 'center' });
  } catch (e) { /* QR fail silently */ }

  // ─── Footer ───
  doc.rect(0, H - 22, W, 22).fill('#f1f5f9');
  doc.fillColor('#1e3a8a').font('Helvetica-Bold').fontSize(7).text('À présenter à l\'accueil le jour de l\'événement', 18, H - 16);
  doc.fillColor('#64748b').font('Helvetica').fontSize(6).text('aracompacificcenters.com · contact@aracom-conseil.fr', W - 175, H - 14);

  doc.end();
  return done;
}

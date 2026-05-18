/**
 * 📄 PDF Generators — Convention, Reçu caution, Attestation remboursement, Badge
 *
 * Utilise pdfkit. Retourne un Buffer.
 * Templates simples mais professionnels (logo + branding ARACOM).
 */

import PDFDocument from 'pdfkit';

// Couleurs ARACOM
const COLORS = {
  black: '#231F20',
  beige: '#C9BC9E',
  orange: '#E8500A',
  blue: '#378ADD',
  teal: '#1D9E75',
  slate: '#475569',
  lightSlate: '#94A3B8',
};

function newDoc({ title }) {
  const doc = new PDFDocument({ size: 'A4', margin: 50, info: { Title: title, Author: 'ARACOM' } });
  return doc;
}

function header(doc, subtitle) {
  doc
    .fillColor(COLORS.black)
    .fontSize(18)
    .font('Helvetica-Bold')
    .text('FORUM DE LA RENTRÉE 2026', { align: 'left' });
  doc
    .fillColor(COLORS.slate)
    .fontSize(9)
    .font('Helvetica')
    .text('14 & 15 août 2026 · 6 sites Pacific · Polynésie française', { align: 'left' });
  if (subtitle) {
    doc
      .moveDown(0.3)
      .fillColor(COLORS.orange)
      .fontSize(11)
      .font('Helvetica-Bold')
      .text(subtitle.toUpperCase(), { align: 'left' });
  }
  doc.moveDown(0.5).strokeColor(COLORS.beige).lineWidth(1).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  doc.moveDown(0.8);
}

function footer(doc) {
  const bottom = doc.page.height - 60;
  doc
    .fillColor(COLORS.lightSlate)
    .fontSize(7)
    .font('Helvetica')
    .text('ARACOM · Forum de la Rentrée 2026 · contact@aracom-conseil.fr', 50, bottom, { align: 'center', width: 495 });
}

function kv(doc, label, value, x = 50, y = null) {
  if (y) doc.y = y;
  doc
    .fillColor(COLORS.slate).fontSize(8).font('Helvetica').text(label.toUpperCase(), x, doc.y, { continued: false });
  doc
    .fillColor(COLORS.black).fontSize(11).font('Helvetica-Bold').text(value || '—', x, doc.y);
  doc.moveDown(0.4);
}

// ══════════════════════════════════════════════════════════════════════
// 1. CONVENTION DE PARTICIPATION
// ══════════════════════════════════════════════════════════════════════
export function generateConventionPDF({ org, reg, venue }) {
  return new Promise((resolve, reject) => {
    const doc = newDoc({ title: `Convention - ${org?.name || 'Exposant'}` });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    header(doc, 'Convention de participation');

    doc.fillColor(COLORS.black).fontSize(10).font('Helvetica').text(`Entre les soussignés :`).moveDown(0.5);
    doc.font('Helvetica-Bold').text('ARACOM CONSEIL', { continued: true }).font('Helvetica').text(', organisateur du Forum de la Rentrée 2026,').moveDown(0.3);
    doc.text('Et l\'exposant désigné ci-dessous :').moveDown(0.8);

    // Encadré exposant
    doc.rect(50, doc.y, 495, 100).strokeColor(COLORS.beige).lineWidth(1).stroke();
    const boxY = doc.y + 10;
    kv(doc, 'Organisation', org?.name, 60, boxY);
    kv(doc, 'Référent', `${org?.first_name || ''} ${org?.last_name || ''}`.trim() || org?.contact_name || '—', 60);
    kv(doc, 'Email', org?.main_email, 60);
    kv(doc, 'Téléphone', org?.main_phone, 60);
    doc.moveDown(0.8);

    doc.fillColor(COLORS.black).fontSize(11).font('Helvetica-Bold').text('Article 1 — Objet').moveDown(0.3);
    doc.fontSize(10).font('Helvetica').text(`L'exposant est admis à participer au Forum de la Rentrée 2026 organisé les 14 et 15 août 2026 sur le site de ${venue?.name || '—'}. Stand attribué : ${reg?.stand_code || 'à confirmer'}.`, { align: 'justify' }).moveDown(0.6);

    doc.font('Helvetica-Bold').text('Article 2 — Engagements de l\'exposant').moveDown(0.3);
    doc.font('Helvetica').text('• Présence assurée sur les deux jours du forum (sauf accord exprès).\n• Tenue de stand conforme à la charte ARACOM.\n• Animation déclarée et réalisée selon planning.\n• Caution de 20 000 XPF versée avant le forum.\n• Attestation d\'assurance RC pro fournie avant ouverture.').moveDown(0.6);

    doc.font('Helvetica-Bold').text('Article 3 — Caution').moveDown(0.3);
    doc.font('Helvetica').text('Une caution de 20 000 XPF est demandée à chaque exposant. Elle est restituée intégralement après le forum si les engagements de présence et tenue de stand sont respectés.').moveDown(1.5);

    // Zone signatures
    doc.fillColor(COLORS.slate).fontSize(9).text('Fait à Papeete, le _____________________').moveDown(2);
    doc.font('Helvetica-Bold').fillColor(COLORS.black).text('Pour l\'exposant', 60, doc.y, { width: 220, continued: false });
    doc.text('Pour ARACOM', 320, doc.y - 12, { width: 220 });
    doc.moveDown(0.3).fontSize(8).font('Helvetica').fillColor(COLORS.slate).text('(Nom, qualité, signature)', 60, doc.y, { width: 220, continued: false });
    doc.text('(Signature & cachet)', 320, doc.y - 10, { width: 220 });
    doc.rect(50, doc.y + 5, 230, 80).stroke();
    doc.rect(310, doc.y + 5, 230, 80).stroke();

    footer(doc);
    doc.end();
  });
}

// ══════════════════════════════════════════════════════════════════════
// 2. REÇU DE CAUTION
// ══════════════════════════════════════════════════════════════════════
export function generateRecuCautionPDF({ org, reg, venue, deposit }) {
  return new Promise((resolve, reject) => {
    const doc = newDoc({ title: `Reçu caution - ${org?.name || 'Exposant'}` });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    header(doc, 'Reçu de caution');

    const today = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
    const amount = deposit?.amount_xpf || reg?.caution_amount_xpf || 20000;

    doc.fillColor(COLORS.black).fontSize(10).font('Helvetica')
      .text(`ARACOM CONSEIL accuse réception de la caution versée pour la participation au Forum de la Rentrée 2026.`, { align: 'justify' })
      .moveDown(1);

    // Encadré chiffre
    doc.rect(50, doc.y, 495, 60).fillAndStroke('#FEF3C7', COLORS.orange);
    doc.fillColor(COLORS.black).fontSize(9).font('Helvetica').text('MONTANT REÇU', 60, doc.y + 8);
    doc.fontSize(24).font('Helvetica-Bold').fillColor(COLORS.orange).text(`${amount.toLocaleString('fr-FR')} XPF`, 60, doc.y + 5);
    doc.moveDown(1.5);

    kv(doc, 'Exposant', org?.name);
    kv(doc, 'Référent', `${org?.first_name || ''} ${org?.last_name || ''}`.trim() || org?.contact_name || '—');
    kv(doc, 'Stand', reg?.stand_code || '—');
    kv(doc, 'Site', venue?.name || '—');
    kv(doc, 'Date d\'encaissement', reg?.caution_received_date ? new Date(reg.caution_received_date).toLocaleDateString('fr-FR') : today);
    kv(doc, 'Mode de paiement', reg?.caution_mode || deposit?.payment_method || '—');
    if (deposit?.reference) kv(doc, 'Référence', deposit.reference);

    doc.moveDown(1).fontSize(9).fillColor(COLORS.slate).font('Helvetica')
      .text('La caution sera restituée intégralement après le forum si les engagements de présence (vendredi 14 et samedi 15 août) et de tenue conforme du stand sont respectés.', { align: 'justify' });

    doc.moveDown(2);
    doc.fillColor(COLORS.black).fontSize(10).font('Helvetica-Bold').text('Pour ARACOM', { align: 'right' });
    doc.fontSize(8).font('Helvetica').fillColor(COLORS.slate).text('Cachet & signature', { align: 'right' });

    footer(doc);
    doc.end();
  });
}

// ══════════════════════════════════════════════════════════════════════
// 3. ATTESTATION DE REMBOURSEMENT (PDF version)
// ══════════════════════════════════════════════════════════════════════
export function generateAttestationRemboursementPDF({ org, reg, venue, deposit }) {
  return new Promise((resolve, reject) => {
    const doc = newDoc({ title: `Attestation remboursement - ${org?.name || 'Exposant'}` });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    header(doc, 'Attestation de remboursement de caution');

    const today = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
    const amount = deposit?.amount_xpf || reg?.caution_amount_xpf || 20000;
    const statusLabel = reg?.restitution_status === 'retenue_partielle' ? 'Restitution partielle'
      : reg?.restitution_status === 'retenue_totale' ? 'Retenue totale'
      : 'Restitution intégrale';

    doc.fillColor(COLORS.black).fontSize(10).font('Helvetica')
      .text('La société ARACOM, organisatrice du Forum de la Rentrée 2026, atteste par la présente avoir procédé au remboursement de la caution versée par l\'exposant ci-dessous, conformément aux conditions de participation.', { align: 'justify' })
      .moveDown(1);

    // Encadré
    doc.rect(50, doc.y, 495, 60).fillAndStroke('#EDE9FE', COLORS.blue);
    doc.fillColor(COLORS.black).fontSize(9).font('Helvetica').text('MONTANT RESTITUÉ', 60, doc.y + 8);
    doc.fontSize(24).font('Helvetica-Bold').fillColor('#7C3AED').text(`${amount.toLocaleString('fr-FR')} XPF`, 60, doc.y + 5);
    doc.fontSize(10).fillColor(COLORS.slate).font('Helvetica').text(statusLabel, 60, doc.y);
    doc.moveDown(1.5);

    kv(doc, 'Exposant', org?.name);
    kv(doc, 'Stand', reg?.stand_code || '—');
    kv(doc, 'Site', venue?.name || '—');
    kv(doc, 'Date de remboursement', reg?.restitution_actual_date ? new Date(reg.restitution_actual_date).toLocaleDateString('fr-FR') : today);
    if (reg?.restitution_motif) kv(doc, 'Motif', reg.restitution_motif);

    doc.moveDown(1).fontSize(9).fillColor(COLORS.slate).font('Helvetica')
      .text('Le remboursement est effectué après constat du respect des conditions de présence et de tenue conforme du stand sur les deux jours du Forum.', { align: 'justify' });

    doc.moveDown(2);
    doc.fillColor(COLORS.black).fontSize(10).font('Helvetica-Bold').text('Pour ARACOM', { align: 'right' });

    footer(doc);
    doc.end();
  });
}

// ══════════════════════════════════════════════════════════════════════
// 4. BADGE EXPOSANT
// ══════════════════════════════════════════════════════════════════════
export function generateBadgePDF({ org, reg, venue }) {
  return new Promise((resolve, reject) => {
    const doc = newDoc({ title: `Badge - ${org?.name || 'Exposant'}` });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Badge format : centered card 350x500px on A4
    const cardW = 360, cardH = 540;
    const cardX = (doc.page.width - cardW) / 2;
    const cardY = (doc.page.height - cardH) / 2;

    // Background
    doc.rect(cardX, cardY, cardW, cardH).fillAndStroke('#FFFFFF', COLORS.black);

    // Bandeau top
    doc.rect(cardX, cardY, cardW, 80).fill(COLORS.orange);
    doc.fillColor('#FFFFFF').fontSize(18).font('Helvetica-Bold').text('FORUM DE LA RENTRÉE', cardX, cardY + 22, { width: cardW, align: 'center' });
    doc.fontSize(12).font('Helvetica').text('2026', cardX, cardY + 50, { width: cardW, align: 'center' });

    // Identité exposant
    doc.moveDown(2);
    const nameY = cardY + 130;
    doc.fillColor(COLORS.slate).fontSize(8).font('Helvetica').text('EXPOSANT', cardX, nameY, { width: cardW, align: 'center' });
    doc.fillColor(COLORS.black).fontSize(18).font('Helvetica-Bold').text(org?.name || '—', cardX + 10, nameY + 15, { width: cardW - 20, align: 'center' });

    const refY = nameY + 60;
    doc.fillColor(COLORS.slate).fontSize(8).font('Helvetica').text('RÉFÉRENT', cardX, refY, { width: cardW, align: 'center' });
    doc.fillColor(COLORS.black).fontSize(13).font('Helvetica').text(
      `${org?.first_name || ''} ${org?.last_name || ''}`.trim() || org?.contact_name || '—',
      cardX, refY + 12, { width: cardW, align: 'center' }
    );

    // Stand & Site (large)
    const standY = refY + 60;
    doc.rect(cardX + 20, standY, cardW - 40, 100).fillAndStroke(COLORS.beige, COLORS.beige);
    doc.fillColor(COLORS.black).fontSize(9).font('Helvetica').text('STAND', cardX, standY + 12, { width: cardW, align: 'center' });
    doc.fontSize(38).font('Helvetica-Bold').text(reg?.stand_code || '—', cardX, standY + 24, { width: cardW, align: 'center' });

    // Site
    const siteY = standY + 120;
    doc.fillColor(COLORS.slate).fontSize(9).font('Helvetica').text('SITE', cardX, siteY, { width: cardW, align: 'center' });
    doc.fillColor(COLORS.black).fontSize(16).font('Helvetica-Bold').text(venue?.name || '—', cardX, siteY + 12, { width: cardW, align: 'center' });

    if (org?.discipline) {
      doc.moveDown(0.4).fillColor(COLORS.slate).fontSize(10).font('Helvetica').text(org.discipline, cardX, doc.y, { width: cardW, align: 'center' });
    }

    // Bandeau bottom
    doc.rect(cardX, cardY + cardH - 30, cardW, 30).fill(COLORS.black);
    doc.fillColor('#FFFFFF').fontSize(8).font('Helvetica').text('14 & 15 AOÛT 2026 · ARACOM', cardX, cardY + cardH - 20, { width: cardW, align: 'center' });

    doc.end();
  });
}

/**
 * 📄 PDF Generators — Convention, Reçu caution, Attestation remboursement, Badge
 *
 * Utilise pdfkit. Retourne un Buffer.
 * Templates simples mais professionnels (logo + branding ARACOM).
 */

import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import path from 'path';
import fs from 'fs';

const LOGO_PATH = path.join(process.cwd(), 'public', 'aracom-logo.png');
const PACIFIC_LOGO_PATH = path.join(process.cwd(), 'public', 'pacific-logo.jpg');

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

function tryImage(doc, p, opts) {
  try { if (fs.existsSync(p)) { doc.image(p, opts.x, opts.y, { width: opts.width }); return true; } } catch {}
  return false;
}

function header(doc, subtitle) {
  // Logo ARACOM en haut à droite si dispo
  tryImage(doc, LOGO_PATH, { x: 480, y: 40, width: 65 });
  doc
    .fillColor(COLORS.black)
    .fontSize(18)
    .font('Helvetica-Bold')
    .text('FORUM DE LA RENTRÉE 2026', 50, 50, { align: 'left' });
  doc
    .fillColor(COLORS.slate)
    .fontSize(9)
    .font('Helvetica')
    .text('14 & 15 août 2026 · 6 sites Pacific · Polynésie française', 50, doc.y, { align: 'left' });
  if (subtitle) {
    doc
      .moveDown(0.3)
      .fillColor(COLORS.orange)
      .fontSize(11)
      .font('Helvetica-Bold')
      .text(subtitle.toUpperCase(), 50, doc.y, { align: 'left' });
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

    // ═══════════ PAGE 1 ═══════════
    header(doc, 'Convention de participation');

    // Préambule
    doc.fillColor(COLORS.black).fontSize(10).font('Helvetica').text(`Entre les soussignés :`).moveDown(0.5);
    doc.font('Helvetica-Bold').text('ARACOM CONSEIL', { continued: true }).font('Helvetica')
      .text(', société organisatrice du Forum de la Rentrée 2026, ci-après désignée « l\'Organisateur »,').moveDown(0.4);
    doc.text('D\'une part,').moveDown(0.4);
    doc.text('Et l\'exposant désigné ci-dessous, ci-après désigné « l\'Exposant » :').moveDown(0.6);

    // Encadré identité exposant
    const boxStartY = doc.y;
    doc.rect(50, boxStartY, 495, 120).strokeColor(COLORS.beige).fillColor('#FFFBEB').lineWidth(1).fillAndStroke();
    doc.fillColor(COLORS.black);
    kv(doc, 'Organisation', org?.name || '—', 60, boxStartY + 12);
    kv(doc, 'Référent', `${org?.first_name || ''} ${org?.last_name || ''}`.trim() || org?.contact_name || '—', 60);
    kv(doc, 'Email', org?.main_email || '—', 60);
    kv(doc, 'Téléphone', org?.main_phone || '—', 60);
    kv(doc, 'Discipline', org?.discipline || '—', 60);
    kv(doc, 'Site & stand', `${venue?.name || '—'} · Stand ${reg?.stand_code || 'à confirmer'}`, 60);
    doc.y = boxStartY + 130;
    doc.moveDown(0.5);

    doc.font('Helvetica').fillColor(COLORS.black).fontSize(10)
      .text('D\'autre part,', { align: 'left' }).moveDown(0.3);
    doc.text('Il a été convenu et arrêté ce qui suit :', { align: 'left' }).moveDown(0.8);

    // ─── ARTICLE 1 ───
    doc.fillColor(COLORS.black).fontSize(11).font('Helvetica-Bold').text('Article 1 — Objet de la convention').moveDown(0.3);
    doc.fontSize(10).font('Helvetica').text(
      `La présente convention a pour objet de définir les conditions de participation de l'Exposant au Forum de la Rentrée 2026, événement organisé par l'Organisateur les 14 et 15 août 2026 sur six sites en Polynésie française. L'Exposant est admis à exposer son activité sur le site de ${venue?.name || '—'}, stand ${reg?.stand_code || 'à confirmer'}, selon les modalités définies aux présentes.`,
      { align: 'justify' }
    ).moveDown(0.6);

    // ─── ARTICLE 2 ───
    doc.font('Helvetica-Bold').text('Article 2 — Conditions d\'admission').moveDown(0.3);
    doc.font('Helvetica').text(
      'L\'inscription de l\'Exposant est subordonnée à : (i) la signature de la présente convention ; (ii) la remise d\'une attestation d\'assurance responsabilité civile professionnelle en cours de validité ; (iii) le versement d\'une caution de 20 000 XPF ; (iv) la déclaration au moins d\'une animation par journée de présence. L\'Organisateur se réserve le droit de refuser toute candidature non conforme à la charte qualité ou présentant un caractère contraire à l\'esprit familial et associatif de l\'événement.',
      { align: 'justify' }
    ).moveDown(0.6);

    // ─── ARTICLE 3 ───
    doc.font('Helvetica-Bold').text('Article 3 — Engagements de l\'Exposant').moveDown(0.3);
    doc.font('Helvetica').text(
      '3.1 — Présence : L\'Exposant s\'engage à être présent sur son stand pendant l\'intégralité des horaires d\'ouverture des jours sélectionnés (vendredi 14 août 11h–17h et/ou samedi 15 août 9h–17h).\n' +
      '3.2 — Tenue du stand : Le stand doit être occupé en permanence, propre, conforme à la charte graphique ARACOM, et représentatif de l\'activité déclarée. Aucune sous-location, cession ou partage du stand n\'est autorisé sans accord écrit préalable.\n' +
      '3.3 — Animation : L\'Exposant s\'engage à proposer au moins une animation par journée de présence (démonstration, atelier, initiation, etc.) selon le planning validé.\n' +
      '3.4 — Sécurité : L\'Exposant respecte les consignes de sécurité du site, ne stocke aucun matériel dangereux et veille à la sécurité du public présent sur son stand.\n' +
      '3.5 — Image : L\'Exposant autorise l\'Organisateur à utiliser des photos prises lors du forum à des fins de communication institutionnelle (réseaux sociaux, site, bilan).',
      { align: 'justify' }
    ).moveDown(0.6);

    // ═══════════ PAGE 2 (auto via flow) ═══════════
    doc.font('Helvetica-Bold').text('Article 4 — Engagements de l\'Organisateur').moveDown(0.3);
    doc.font('Helvetica').text(
      'L\'Organisateur s\'engage à : (i) mettre à disposition un emplacement aménagé (stand de 2×2 m avec table, chaises et électricité) ; (ii) assurer la communication globale de l\'événement ; (iii) garantir la sécurité générale du site (gardiennage, signalétique, secours) ; (iv) restituer la caution de l\'Exposant à l\'issue du forum sous réserve du respect de ses engagements.',
      { align: 'justify' }
    ).moveDown(0.6);

    // ─── ARTICLE 5 — CAUTION ───
    doc.font('Helvetica-Bold').text('Article 5 — Caution').moveDown(0.3);
    doc.font('Helvetica').text(
      'Une caution de vingt mille francs Pacifique (20 000 XPF) est exigée de chaque Exposant. Elle est versée par chèque, espèces ou virement à l\'ordre d\'ARACOM CONSEIL au plus tard quinze (15) jours avant l\'ouverture du forum. Elle est restituée intégralement dans les trente (30) jours suivant la fin de l\'événement, sous réserve : (a) du respect intégral des engagements de présence ; (b) de l\'absence de dégradation du stand ou du mobilier mis à disposition ; (c) du démontage propre du stand à l\'heure prévue. À défaut, l\'Organisateur pourra retenir tout ou partie de la caution à titre de réparation forfaitaire.',
      { align: 'justify' }
    ).moveDown(0.6);

    // ─── ARTICLE 6 — ASSURANCE ───
    doc.font('Helvetica-Bold').text('Article 6 — Assurance & Responsabilité').moveDown(0.3);
    doc.font('Helvetica').text(
      'L\'Exposant déclare être titulaire d\'une assurance responsabilité civile professionnelle couvrant les dommages corporels, matériels et immatériels susceptibles d\'être causés par lui, ses préposés ou son matériel, à des tiers ou au public, pendant toute la durée du forum (incluant montage et démontage). Il en remet copie à l\'Organisateur avant l\'ouverture. L\'Organisateur décline toute responsabilité en cas de vol, perte ou dégradation du matériel personnel de l\'Exposant.',
      { align: 'justify' }
    ).moveDown(0.6);

    // ─── ARTICLE 7 — LOGISTIQUE ───
    doc.font('Helvetica-Bold').text('Article 7 — Logistique (montage / démontage)').moveDown(0.3);
    doc.font('Helvetica').text(
      'Le montage des stands se déroule le jeudi 13 août 2026 de 14h à 18h et le vendredi 14 août dès 8h. Le démontage doit être complet le samedi 15 août au plus tard à 19h. Aucun véhicule ne pourra circuler sur le site pendant les heures d\'ouverture au public. Tout matériel oublié après cette date sera considéré comme abandonné et évacué aux frais de l\'Exposant.',
      { align: 'justify' }
    ).moveDown(0.6);

    // ─── ARTICLE 8 — RÉSILIATION ───
    doc.font('Helvetica-Bold').text('Article 8 — Annulation, résiliation').moveDown(0.3);
    doc.font('Helvetica').text(
      'En cas d\'annulation de la participation par l\'Exposant moins de quinze (15) jours avant le forum, la caution sera intégralement conservée par l\'Organisateur à titre d\'indemnité forfaitaire, sauf cas de force majeure dûment justifié. L\'Organisateur peut résilier de plein droit la présente convention, sans indemnité, en cas de manquement grave de l\'Exposant à ses obligations (absence sans excuse, comportement contraire à l\'éthique de l\'événement, non-respect de la sécurité).',
      { align: 'justify' }
    ).moveDown(0.6);

    // ─── ARTICLE 9 — FORCE MAJEURE ───
    doc.font('Helvetica-Bold').text('Article 9 — Force majeure').moveDown(0.3);
    doc.font('Helvetica').text(
      'En cas de force majeure entraînant l\'annulation ou le report du forum (catastrophe naturelle, crise sanitaire, décision administrative…), aucune des parties ne pourra être tenue responsable, et l\'Organisateur s\'engage à restituer intégralement la caution versée par l\'Exposant dans un délai de soixante (60) jours.',
      { align: 'justify' }
    ).moveDown(0.6);

    // ─── ARTICLE 10 — RGPD ───
    doc.font('Helvetica-Bold').text('Article 10 — Données personnelles (RGPD)').moveDown(0.3);
    doc.font('Helvetica').text(
      'Les données personnelles communiquées par l\'Exposant sont collectées et traitées par ARACOM CONSEIL aux seules fins de l\'organisation du forum, de la facturation et de la communication institutionnelle. Elles sont conservées trois (3) ans après l\'événement. L\'Exposant dispose d\'un droit d\'accès, de rectification et de suppression à exercer par courriel à contact@aracom.pf, conformément au RGPD et à la loi polynésienne sur la protection des données.',
      { align: 'justify' }
    ).moveDown(0.6);

    // ─── ARTICLE 11 — LITIGES ───
    doc.font('Helvetica-Bold').text('Article 11 — Litiges & juridiction').moveDown(0.3);
    doc.font('Helvetica').text(
      'Tout différend découlant de l\'exécution ou de l\'interprétation de la présente convention fera d\'abord l\'objet d\'une tentative de règlement amiable entre les parties. À défaut, les tribunaux de Papeete (Polynésie française) seront seuls compétents.',
      { align: 'justify' }
    ).moveDown(1);

    // ═══════════ PAGE FINALE : SIGNATURES ═══════════
    doc.addPage();
    header(doc, 'Convention de participation — Signatures');
    doc.fillColor(COLORS.slate).fontSize(9).font('Helvetica').text(
      'En signant ci-dessous, les parties reconnaissent avoir pris connaissance des onze (11) articles de la présente convention et en acceptent intégralement les termes.',
      { align: 'justify' }
    ).moveDown(1.5);

    doc.fillColor(COLORS.black).fontSize(10).font('Helvetica')
      .text(`Fait à Papeete, le ____________________________`).moveDown(0.5)
      .text(`En deux exemplaires originaux.`).moveDown(2.5);

    // Deux colonnes signatures
    const sigY = doc.y;
    // Colonne gauche — Exposant
    doc.font('Helvetica-Bold').fillColor(COLORS.black).fontSize(11).text('Pour l\'Exposant', 60, sigY, { width: 230 });
    doc.fontSize(9).font('Helvetica').fillColor(COLORS.slate).text('(Nom, qualité, signature précédée de la mention\n« Lu et approuvé »)', 60, sigY + 18, { width: 230 });
    doc.rect(60, sigY + 60, 230, 110).strokeColor(COLORS.beige).lineWidth(1).stroke();
    // ligne nom
    doc.fontSize(9).fillColor(COLORS.slate).text('Nom : ___________________________', 70, sigY + 70);
    doc.text('Qualité : _________________________', 70, sigY + 90);
    doc.text('Date : ___________________________', 70, sigY + 110);

    // Colonne droite — Organisateur
    doc.font('Helvetica-Bold').fillColor(COLORS.black).fontSize(11).text('Pour ARACOM CONSEIL', 315, sigY, { width: 230 });
    doc.fontSize(9).font('Helvetica').fillColor(COLORS.slate).text('(Signature & cachet de l\'organisateur)', 315, sigY + 18, { width: 230 });
    doc.rect(315, sigY + 60, 230, 110).strokeColor(COLORS.beige).lineWidth(1).stroke();
    doc.fontSize(9).fillColor(COLORS.slate).text('Nom : ___________________________', 325, sigY + 70);
    doc.text('Qualité : _________________________', 325, sigY + 90);
    doc.text('Date : ___________________________', 325, sigY + 110);

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
// 4. BADGE EXPOSANT (avec QR code + logos)
// ══════════════════════════════════════════════════════════════════════
export async function generateBadgePDF({ org, reg, venue, portalUrl }) {
  // Pré-génère QR code en data URL (URL du portail exposant)
  let qrBuf = null;
  if (portalUrl) {
    try {
      const dataUrl = await QRCode.toDataURL(portalUrl, { margin: 1, width: 200, color: { dark: COLORS.black, light: '#FFFFFF' } });
      qrBuf = Buffer.from(dataUrl.split(',')[1], 'base64');
    } catch (e) { console.error('[QR]', e?.message); }
  }
  return new Promise((resolve, reject) => {
    const doc = newDoc({ title: `Badge - ${org?.name || 'Exposant'}` });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Badge format : centered card 360x540px on A4
    const cardW = 360, cardH = 540;
    const cardX = (doc.page.width - cardW) / 2;
    const cardY = (doc.page.height - cardH) / 2;

    // Background
    doc.rect(cardX, cardY, cardW, cardH).fillAndStroke('#FFFFFF', COLORS.black);

    // Bandeau top
    doc.rect(cardX, cardY, cardW, 80).fill(COLORS.orange);
    // Logo en haut à gauche
    tryImage(doc, LOGO_PATH, { x: cardX + 10, y: cardY + 15, width: 50 });
    doc.fillColor('#FFFFFF').fontSize(18).font('Helvetica-Bold').text('FORUM DE LA RENTRÉE', cardX + 65, cardY + 22, { width: cardW - 75, align: 'center' });
    doc.fontSize(12).font('Helvetica').text('2026', cardX + 65, cardY + 50, { width: cardW - 75, align: 'center' });

    // Identité exposant
    const nameY = cardY + 100;
    doc.fillColor(COLORS.slate).fontSize(8).font('Helvetica').text('EXPOSANT', cardX, nameY, { width: cardW, align: 'center' });
    doc.fillColor(COLORS.black).fontSize(16).font('Helvetica-Bold').text(org?.name || '—', cardX + 10, nameY + 13, { width: cardW - 20, align: 'center' });

    const refY = nameY + 50;
    doc.fillColor(COLORS.slate).fontSize(8).font('Helvetica').text('RÉFÉRENT', cardX, refY, { width: cardW, align: 'center' });
    doc.fillColor(COLORS.black).fontSize(12).font('Helvetica').text(
      `${org?.first_name || ''} ${org?.last_name || ''}`.trim() || org?.contact_name || '—',
      cardX, refY + 12, { width: cardW, align: 'center' }
    );

    // Stand & Site (large)
    const standY = refY + 50;
    doc.rect(cardX + 20, standY, cardW - 40, 80).fillAndStroke(COLORS.beige, COLORS.beige);
    doc.fillColor(COLORS.black).fontSize(9).font('Helvetica').text('STAND', cardX, standY + 8, { width: cardW, align: 'center' });
    doc.fontSize(32).font('Helvetica-Bold').text(reg?.stand_code || '—', cardX, standY + 18, { width: cardW, align: 'center' });

    // Site
    const siteY = standY + 95;
    doc.fillColor(COLORS.slate).fontSize(9).font('Helvetica').text('SITE', cardX, siteY, { width: cardW, align: 'center' });
    doc.fillColor(COLORS.black).fontSize(14).font('Helvetica-Bold').text(venue?.name || '—', cardX, siteY + 12, { width: cardW, align: 'center' });

    if (org?.discipline) {
      doc.fillColor(COLORS.slate).fontSize(10).font('Helvetica').text(org.discipline, cardX, siteY + 32, { width: cardW, align: 'center' });
    }

    // QR Code en bas (vers portail exposant)
    if (qrBuf) {
      const qrSize = 70;
      doc.image(qrBuf, cardX + (cardW - qrSize) / 2, cardY + cardH - 130, { width: qrSize });
      doc.fillColor(COLORS.slate).fontSize(7).font('Helvetica').text('Scannez pour accéder à votre espace', cardX, cardY + cardH - 55, { width: cardW, align: 'center' });
    }

    // Bandeau bottom
    doc.rect(cardX, cardY + cardH - 30, cardW, 30).fill(COLORS.black);
    doc.fillColor('#FFFFFF').fontSize(8).font('Helvetica').text('14 & 15 AOÛT 2026 · ARACOM', cardX, cardY + cardH - 20, { width: cardW, align: 'center' });

    doc.end();
  });
}

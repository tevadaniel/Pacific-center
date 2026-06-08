/**
 * 📄 Générateur PDF — Convention de Participation & Guide Exposant
 *    Forum de la Rentrée 2026 · ARACOM
 *
 *    Inspiré du badge-generator existant (pdfkit standalone).
 *    Tous les documents respectent la charte ARACOM :
 *      Noir #231F20 · Beige Doré #C9BC9E · Beige Pâle #F7F4EF · Orange #E8500A
 */
import PDFDocument from 'pdfkit/js/pdfkit.standalone.js';

// ─── Palette ARACOM ─────────────────────────────────────────────────────
const C = {
  black:     '#231F20',
  gold:      '#C9BC9E',
  beigeC:    '#D5CAAF',
  beigeF:    '#EDE8DC',
  beigeP:    '#F7F4EF',
  orange:    '#E8500A',
  textMute:  '#6b6258',
  textSoft:  '#3a3431',
};

// ─── Helpers ────────────────────────────────────────────────────────────
function fmtDay(day) {
  if (!day) return '';
  const m = { friday: 'Vendredi 14 août', saturday: 'Samedi 15 août',
              vendredi: 'Vendredi 14 août', samedi: 'Samedi 15 août',
              ven: 'Vendredi 14 août', sam: 'Samedi 15 août',
              '2026-08-14': 'Vendredi 14 août', '2026-08-15': 'Samedi 15 août' };
  return m[String(day).toLowerCase()] || day;
}
function fmtDays(days) {
  if (!Array.isArray(days) || days.length === 0) return '—';
  if (days.length >= 2) return 'Les deux jours (14 & 15 août 2026)';
  return fmtDay(days[0]);
}
// Récupère le bon champ jour d'une animation (day | day_label | event_date)
function animDay(a) {
  return a?.day || a?.day_label || a?.event_date || '';
}
function safe(v, fallback = '—') {
  if (v === null || v === undefined || v === '') return fallback;
  return String(v);
}

// ─── Header commun ──────────────────────────────────────────────────────
function drawHeader(doc, title) {
  doc.save();
  // Bandeau noir
  doc.rect(0, 0, doc.page.width, 80).fill(C.black);
  // Trait or
  doc.rect(0, 80, doc.page.width, 2).fill(C.gold);
  doc.restore();

  // ─── ZONE GAUCHE — ARACOM + sous-titre + édition ────
  // Largeur max stricte = 230pt (pour ne JAMAIS toucher la zone titre droite qui démarre à x=280)
  const LEFT_MAX_W = 230;
  doc.fillColor(C.beigeP)
     .font('Helvetica-Bold').fontSize(9)
     .text('ARACOM', 40, 24, { characterSpacing: 3, width: LEFT_MAX_W, lineBreak: false });
  doc.fillColor(C.gold).fontSize(7)
     .text('AGENCE COMMUNICATION & ÉVÉNEMENTIEL', 40, 38, {
       characterSpacing: 1.2, width: LEFT_MAX_W, lineBreak: false, ellipsis: true,
     });
  doc.fillColor(C.beigeP).font('Helvetica').fontSize(8)
     .text('Forum de la Rentrée 2026', 40, 56, { width: LEFT_MAX_W, lineBreak: false });

  // ─── ZONE DROITE — Titre + sous-titre ──────────────
  // Démarrage à x=280 pour laisser une marge de sécurité avec la zone gauche
  const RIGHT_X = 280;
  const RIGHT_W = doc.page.width - RIGHT_X - 30; // marge droite 30pt
  doc.fillColor(C.gold).font('Helvetica-Bold').fontSize(12)
     .text(title.toUpperCase(), RIGHT_X, 30, {
       width: RIGHT_W, align: 'right', characterSpacing: 1.2, lineBreak: false, ellipsis: true,
     });
  doc.fillColor(C.beigeP).font('Helvetica').fontSize(7.5)
     .text('14 & 15 août 2026 · Polynésie française', RIGHT_X, 56, {
       width: RIGHT_W, align: 'right', lineBreak: false,
     });
}

// ─── Footer ─────────────────────────────────────────────────────────────
function drawFooter(doc, pageLabel) {
  const y = doc.page.height - 40;
  doc.save();
  doc.rect(40, y, doc.page.width - 80, 1).fill(C.gold);
  doc.restore();
  doc.fillColor(C.textMute).font('Helvetica').fontSize(7.5)
     .text('ARACOM · agence@aracom-conseil.fr · aracompacificcenters.com',
           40, y + 8, { width: doc.page.width - 80, align: 'center' });
  if (pageLabel) {
    doc.fillColor(C.textMute).fontSize(7)
       .text(pageLabel, 40, y + 22, { width: doc.page.width - 80, align: 'center' });
  }
}

function sectionTitle(doc, num, label, y) {
  doc.fillColor(C.gold).font('Helvetica-Bold').fontSize(11)
     .text(String(num), 40, y, { continued: true });
  doc.fillColor(C.black).font('Helvetica-Bold').fontSize(10.5)
     .text('  ' + label.toUpperCase(), { characterSpacing: 1.5 });
  doc.moveTo(40, doc.y + 4).lineTo(140, doc.y + 4).strokeColor(C.gold).lineWidth(1).stroke();
  doc.moveDown(0.7);
}

function p(doc, text, opts = {}) {
  doc.fillColor(opts.color || C.textSoft)
     .font(opts.bold ? 'Helvetica-Bold' : 'Helvetica')
     .fontSize(opts.size || 9.5)
     .text(text, opts.x || 40, doc.y, { width: opts.width || (doc.page.width - 80), align: opts.align || 'left', lineGap: opts.lineGap || 2 });
  if (opts.gap !== false) doc.moveDown(opts.gap || 0.5);
}

function kv(doc, label, value, x, y, valueWidth = 220) {
  doc.fillColor(C.textMute).font('Helvetica').fontSize(7.5)
     .text(label.toUpperCase(), x, y, { characterSpacing: 1 });
  doc.fillColor(C.black).font('Helvetica-Bold').fontSize(10)
     .text(safe(value), x, y + 11, { width: valueWidth });
}

// ─── CONVENTION DE PARTICIPATION ────────────────────────────────────────
export async function generateConventionPDF({ registration, organization, venue, animations = [], deposit = null }) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4', margin: 0,
        info: {
          Title: `Convention de Participation - ${organization?.name || 'Exposant'}`,
          Author: 'ARACOM',
          Subject: 'Forum de la Rentrée 2026',
          Creator: 'ARACOM Plateforme',
        },
      });
      const chunks = [];
      doc.on('data', c => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // ═════════ PAGE 1 ═════════
      drawHeader(doc, 'Convention de Participation');
      doc.y = 110;

      // Bloc parties
      doc.fillColor(C.textMute).font('Helvetica-Bold').fontSize(8)
         .text('ENTRE LES SOUSSIGNÉS', 40, doc.y, { characterSpacing: 2 });
      doc.moveTo(40, doc.y + 3).lineTo(doc.page.width - 40, doc.y + 3).strokeColor(C.beigeC).stroke();
      doc.moveDown(0.6);

      // D'une part
      doc.fillColor(C.gold).font('Helvetica-Bold').fontSize(9).text("D'UNE PART,");
      doc.moveDown(0.25);
      doc.fillColor(C.black).font('Helvetica').fontSize(9)
         .text('Organisateur :  ', { continued: true })
         .font('Helvetica-Bold').text('Pacific Centers');
      doc.font('Helvetica')
         .text('Mandataire :  ', { continued: true })
         .font('Helvetica-Bold').text('ARACOM – Agence de communication & événementiel');
      doc.font('Helvetica')
         .text('Représenté par :  ', { continued: true })
         .font('Helvetica-Bold').text('Teva Daniel GEROS, Directeur');
      doc.font('Helvetica')
         .text('Adresse :  ', { continued: true })
         .font('Helvetica-Bold').text('Paea, Polynésie française');
      doc.moveDown(0.5);

      // D'autre part
      doc.fillColor(C.gold).font('Helvetica-Bold').fontSize(9).text("D'AUTRE PART,");
      doc.moveDown(0.25);
      const cx1 = 40, cx2 = 310, ty = doc.y;
      kv(doc, 'Nom de la structure', organization?.name, cx1, ty);
      kv(doc, 'Discipline / Activité', organization?.discipline, cx2, ty);
      kv(doc, 'Représenté par', organization?.contact_name, cx1, ty + 32);
      kv(doc, 'Fonction', organization?.contact_role || '—', cx2, ty + 32);
      kv(doc, 'Téléphone', organization?.main_phone, cx1, ty + 64);
      kv(doc, 'Email', organization?.main_email, cx2, ty + 64);
      kv(doc, 'N° Tahiti / Association', organization?.tahiti_number || organization?.association_number, cx1, ty + 96);
      doc.y = ty + 128;

      // Section 1 — Objet
      sectionTitle(doc, '1.', 'Objet de la convention', doc.y);
      p(doc, "La présente convention définit les conditions de participation de l'exposant au Forum de la Rentrée 2026, organisé par Pacific Centers dans les centres commerciaux de Polynésie française, géré et coordonné par ARACOM.", { size: 9, lineGap: 2 });

      // Section 2 — Site, emplacement, période
      sectionTitle(doc, '2.', 'Site, emplacement et période', doc.y);
      const sy = doc.y;
      kv(doc, 'Site retenu', venue?.name, 40, sy);
      kv(doc, "N° d'emplacement", registration?.stand_code, 230, sy);
      kv(doc, 'Type de stand', registration?.stand_type || 'Stand standard (table + nappes)', 380, sy, 180);
      doc.y = sy + 38;

      // Cases à cocher jours
      const days = registration?.attending_days || [];
      const hasFr = days.includes('friday') || days.includes('vendredi');
      const hasSa = days.includes('saturday') || days.includes('samedi');
      const both  = hasFr && hasSa;
      doc.fillColor(C.textMute).fontSize(8).text('JOUR(S) DE PARTICIPATION', 40, doc.y, { characterSpacing: 1 });
      doc.moveDown(0.3);
      const cy = doc.y;
      const drawCheck = (x, y, checked, label) => {
        doc.rect(x, y, 10, 10).strokeColor(C.black).lineWidth(1).stroke();
        if (checked) doc.save().fillColor(C.orange).rect(x + 2, y + 2, 6, 6).fill().restore();
        doc.fillColor(C.black).font('Helvetica').fontSize(9).text(label, x + 14, y - 1);
      };
      drawCheck(40, cy, hasFr && !both, 'Vendredi 14 août');
      drawCheck(180, cy, hasSa && !both, 'Samedi 15 août');
      drawCheck(310, cy, both, 'Les deux jours');
      doc.y = cy + 20;
      p(doc, 'Horaires : Vendredi 11h – 17h  |  Samedi 9h – 17h', { color: C.textMute, size: 8.5, lineGap: 1 });
      p(doc, "L'emplacement est attribué par ARACOM selon l'ordre d'inscription et la complétude du dossier. Tout changement nécessite l'accord express d'ARACOM.", { color: C.textSoft, size: 9, lineGap: 2 });

      // Section 3 — Créneau animation
      sectionTitle(doc, '3.', "Créneau d'animation", doc.y);
      if (animations.length > 0) {
        animations.forEach(a => {
          doc.fillColor(C.black).font('Helvetica-Bold').fontSize(9.5)
             .text(`• ${fmtDay(animDay(a))} de ${a.start_time} à ${a.end_time} — ${safe(a.title, 'Animation')}`);
          if (a.description) doc.font('Helvetica').fontSize(8.5).fillColor(C.textMute).text(`  ${a.description}`, { lineGap: 2 });
          doc.moveDown(0.25);
        });
      } else {
        const ay = doc.y;
        kv(doc, "Type d'animation prévue", '—', 40, ay);
        kv(doc, 'Créneau horaire attribué', '—', 230, ay);
        kv(doc, 'Matériel spécifique requis', '—', 380, ay, 180);
        doc.y = ay + 38;
      }
      p(doc, "Les meilleurs créneaux sont attribués aux premiers inscrits avec dossier complet. Un seul exposant par activité et par site en cas de forte demande.", { color: C.textMute, size: 8.5, lineGap: 2 });

      drawFooter(doc, 'Page 1/3 — Convention de participation · Forum de la Rentrée 2026');

      // ═════════ PAGE 2 ═════════
      doc.addPage();
      drawHeader(doc, 'Convention de Participation — suite');
      doc.y = 110;

      // Section 4 — Caution
      sectionTitle(doc, '4.', 'Caution de participation', doc.y);
      const dy = doc.y;
      doc.save();
      doc.rect(40, dy, doc.page.width - 80, 68).fill(C.beigeP);
      doc.rect(40, dy, 4, 68).fill(C.orange);
      doc.restore();
      kv(doc, 'Montant', '20 000 XPF', 54, dy + 8, 110);
      kv(doc, 'Mode de règlement', 'Chèque (à l\'ordre d\'ARACOM)', 180, dy + 8, 240);
      kv(doc, 'Référence paiement', deposit?.reference || '—', 380, dy + 8, 160);
      kv(doc, 'Date de règlement', deposit?.received_at ? new Date(deposit.received_at).toLocaleDateString('fr-FR') : '—', 54, dy + 42, 160);
      kv(doc, 'Statut', deposit?.status || 'En attente', 230, dy + 42, 160);
      doc.y = dy + 78;
      p(doc, "La caution est restituée après retour du questionnaire de satisfaction et sous réserve du respect de la présente convention. Tout manquement constaté par l'agent ARACOM peut entraîner une retenue partielle ou intégrale.", { color: C.textSoft, size: 9, lineGap: 2 });

      // Section 5 — Conditions générales
      sectionTitle(doc, '5.', 'Conditions générales de participation', doc.y);
      doc.fillColor(C.black).font('Helvetica-Bold').fontSize(9).text("L'exposant s'engage à respecter l'ensemble des dispositions suivantes :", 40, doc.y);
      doc.moveDown(0.4);
      const blocs = [
        ['Présence et tenue du stand', [
          "Respecter les horaires d'ouverture et de fermeture du site",
          "Rester présent et actif sur son stand durant toute la durée de participation",
          "Ne pas démonter son stand avant la fermeture officielle (17h)",
          "Laisser son emplacement propre et libéré après l'événement",
        ]],
        ['Implantation et signalétique', [
          "Respecter le plan d'implantation et ne pas empiéter sur les emplacements voisins",
          "Identifier clairement sa structure (nom, logo, discipline) depuis l'allée principale",
          "Tout matériel doit rester dans les limites de l'emplacement sans bloquer la circulation",
        ]],
        ['Obligations réglementaires', [
          "Disposer d'une assurance responsabilité civile individuelle valide le jour J",
          "Se conformer en toutes circonstances aux instructions de l'agent ARACOM sur site",
        ]],
      ];
      blocs.forEach(([title, items]) => {
        doc.fillColor(C.gold).font('Helvetica-Bold').fontSize(9).text(title, 40, doc.y);
        doc.moveDown(0.2);
        items.forEach(item => {
          doc.fillColor(C.textSoft).font('Helvetica').fontSize(8.5).text('•  ' + item, 50, doc.y, { width: doc.page.width - 100, lineGap: 2 });
          doc.moveDown(0.15);
        });
        doc.moveDown(0.3);
      });

      // Section 6 — Équipements + Autorisé / Interdit
      sectionTitle(doc, '6.', 'Équipements fournis & règles de stand', doc.y);
      doc.fillColor(C.black).font('Helvetica-Bold').fontSize(9).text('Pacific Centers met à disposition, sans frais supplémentaires :', 40, doc.y);
      doc.moveDown(0.2);
      [
        "1 table et 1 nappe (nappe longue côté client, nappe courte côté intervenant)",
        "Accès électrique sur demande — besoin spécifique à signaler à ARACOM avant le 1er août",
        "Sécurité générale du site",
      ].forEach(item => {
        doc.fillColor(C.textSoft).font('Helvetica').fontSize(8.5).text('•  ' + item, 50, doc.y, { width: doc.page.width - 100, lineGap: 2 });
        doc.moveDown(0.15);
      });
      doc.fillColor(C.textMute).font('Helvetica-Oblique').fontSize(8).text('Non fourni : chaises, présentoirs, sono personnelle, fléchage spécifique.', 40, doc.y);
      doc.moveDown(0.5);

      const colY = doc.y;
      doc.save().rect(40, colY, 250, 110).fill(C.beigeP).restore();
      doc.fillColor('#2d7a2d').font('Helvetica-Bold').fontSize(9).text('✓  AUTORISÉ', 50, colY + 8);
      const auths = ['Présentation/promotion de la structure', 'Distribution de flyers et plaquettes', "Collecte d'inscriptions, contacts", 'Roll-up, kakémono, affichage sur table', "Démonstrations dans les limites de l'emplacement"];
      doc.fillColor(C.textSoft).font('Helvetica').fontSize(8);
      auths.forEach((a, i) => doc.text('•  ' + a, 50, colY + 22 + i * 14, { width: 230 }));

      doc.save().rect(300, colY, 250, 110).fill('#fdf2f0').restore();
      doc.fillColor(C.orange).font('Helvetica-Bold').fontSize(9).text('✗  INTERDIT', 310, colY + 8);
      const inters = ['Vente de produits ou marchandises', "Collecte d'argent (espèces, mobile, chèque)", "Diffusion sonore sans accord ARACOM", "Oriflammes, structures gonflables ou ancrées", "Utilisation du nom / visuels « Carrefour »", "Cession ou partage de l'emplacement"];
      doc.fillColor(C.textSoft).font('Helvetica').fontSize(8);
      inters.forEach((a, i) => doc.text('•  ' + a, 310, colY + 22 + i * 14, { width: 230 }));
      doc.y = colY + 118;
      doc.fillColor(C.textMute).font('Helvetica-Oblique').fontSize(8).text("ARACOM et Pacific Centers se réservent le droit de refuser l'accès ou d'expulser tout exposant ne respectant pas les présentes conditions, sans remboursement de caution.", 40, doc.y, { width: doc.page.width - 80, lineGap: 2 });

      drawFooter(doc, 'Page 2/3 — Convention de participation · Forum de la Rentrée 2026');

      // ═════════ PAGE 3 ═════════
      doc.addPage();
      drawHeader(doc, 'Convention de Participation — suite');
      doc.y = 110;

      // Section 7 — Annulation
      sectionTitle(doc, '7.', 'Annulation et défaillance', doc.y);
      p(doc, "Toute annulation doit être notifiée par écrit à ARACOM avec accusé de réception. La date de réception fait foi.", { color: C.textSoft, size: 8.5, lineGap: 2 });

      const cancel = [
        ["Avant le 31 juillet 2026", "Restitution intégrale", C.textSoft],
        ["Du 1er au 10 août 2026", "Retenue de 50% (10 000 XPF)", C.orange],
        ["Après le 10 août 2026", "Retenue intégrale (20 000 XPF)", C.orange],
        ["Absence non signalée le jour J", "Retenue intégrale + exclusion éditions futures", C.orange],
      ];
      const cty = doc.y;
      doc.save().rect(40, cty, doc.page.width - 80, 16).fill(C.black).restore();
      doc.fillColor(C.gold).font('Helvetica-Bold').fontSize(8.5)
         .text("PÉRIODE D'ANNULATION", 46, cty + 4)
         .text('CONSÉQUENCE SUR LA CAUTION', 320, cty + 4);
      doc.y = cty + 20;
      cancel.forEach((row, i) => {
        const rowY = doc.y;
        if (i % 2 === 0) doc.save().rect(40, rowY - 2, doc.page.width - 80, 16).fill(C.beigeP).restore();
        doc.fillColor(C.black).font('Helvetica').fontSize(8.5).text(row[0], 46, rowY);
        doc.fillColor(row[2]).font('Helvetica-Bold').text(row[1], 320, rowY);
        doc.y = rowY + 14;
      });
      doc.moveDown(0.5);
      doc.fillColor(C.gold).font('Helvetica-Bold').fontSize(9).text('Absence partielle', 40, doc.y);
      doc.moveDown(0.15);
      p(doc, "Départ anticipé (démontage avant 17h) sans accord ARACOM : retenue possible de 50%. Retard d'installation supérieur à 1h après l'ouverture sans justification : assimilé à absence partielle.", { color: C.textSoft, size: 8.5, lineGap: 2 });
      doc.fillColor(C.gold).font('Helvetica-Bold').fontSize(9).text('Force majeure', 40, doc.y);
      doc.moveDown(0.15);
      p(doc, "En cas d'événement imprévisible indépendant de la volonté de l'exposant (catastrophe naturelle, accident, hospitalisation justifiée), ARACOM et Pacific Centers examineront au cas par cas sur présentation de justificatif. La décision reste à la discrétion exclusive de Pacific Centers.", { color: C.textSoft, size: 8.5, lineGap: 2 });
      doc.fillColor(C.gold).font('Helvetica-Bold').fontSize(9).text("Annulation par l'organisateur", 40, doc.y);
      doc.moveDown(0.15);
      p(doc, "En cas d'annulation de l'événement par Pacific Centers, la caution est restituée intégralement dans un délai de 15 jours ouvrés.", { color: C.textSoft, size: 8.5, lineGap: 2 });

      // Section 8 — Participation multi-sites
      sectionTitle(doc, '8.', 'Participation multi-sites', doc.y);
      const my = doc.y;
      kv(doc, 'Site(s) optionnel(s)', registration?.secondary_sites || '—', 40, my, 250);
      kv(doc, 'Date limite de confirmation', '1er août 2026', 310, my, 250);
      doc.y = my + 38;
      p(doc, "En cas de multi-site, une préférence principale doit être indiquée. Les sites secondaires sont confirmés sous réserve de disponibilité.", { color: C.textSoft, size: 8.5, lineGap: 2 });

      // Section 9 — Données
      sectionTitle(doc, '9.', 'Données et communication', doc.y);
      p(doc, "Les informations collectées sont utilisées exclusivement dans le cadre du Forum de la Rentrée 2026 et ne sont pas transmises à des tiers. ARACOM communique exclusivement avec les exposants (conventions, rappels, confirmations) ; la communication grand public est assurée par Pacific Centers.", { color: C.textSoft, size: 8.5, lineGap: 2 });

      // Signatures
      doc.moveDown(0.3);
      doc.fillColor(C.textMute).font('Helvetica-Bold').fontSize(8).text('SIGNATURES', 40, doc.y, { characterSpacing: 2 });
      doc.fillColor(C.textMute).font('Helvetica-Oblique').fontSize(8).text("Fait en deux exemplaires originaux. Lu et approuvé.", 40, doc.y);
      doc.moveTo(40, doc.y + 3).lineTo(doc.page.width - 40, doc.y + 3).strokeColor(C.beigeC).stroke();
      doc.moveDown(0.6);

      const sigY = doc.y;
      doc.fillColor(C.black).font('Helvetica-Bold').fontSize(9).text('Pour ARACOM', 40, sigY);
      doc.font('Helvetica').fontSize(8).fillColor(C.textMute).text('Teva Daniel GEROS, Directeur', 40, sigY + 13);
      doc.text('Date : _____ / _____ / 2026', 40, sigY + 60);
      doc.text('Signature :', 40, sigY + 75);
      doc.rect(40, sigY + 28, 240, 28).strokeColor(C.beigeC).dash(3, { space: 2 }).stroke().undash();

      doc.fillColor(C.black).font('Helvetica-Bold').fontSize(9).text("Pour l'exposant", 310, sigY);
      doc.font('Helvetica').fontSize(8).fillColor(C.textMute).text(`Nom & Prénom : ${safe(organization?.contact_name)}`, 310, sigY + 13);
      doc.text('Date : _____ / _____ / 2026', 310, sigY + 60);
      doc.text('Signature :', 310, sigY + 75);
      doc.rect(310, sigY + 28, 240, 28).strokeColor(C.beigeC).dash(3, { space: 2 }).stroke().undash();

      drawFooter(doc, 'Page 3/3 — Convention de participation · Forum de la Rentrée 2026');
      doc.end();
    } catch (e) { reject(e); }
  });
}

// ─── GUIDE DE L'EXPOSANT ───────────────────────────────────────────────
export async function generateGuidePDF({ registration, organization, venue, animations = [] }) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4', margin: 0,
        info: { Title: `Guide de l'exposant - ${organization?.name || 'Exposant'}`, Author: 'ARACOM', Subject: 'Forum de la Rentrée 2026' },
      });
      const chunks = [];
      doc.on('data', c => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // ─── PAGE 1 ───
      drawHeader(doc, 'Guide de l\'exposant');
      doc.y = 105;

      // Bandeau personnalisation
      doc.save();
      doc.rect(40, doc.y, doc.page.width - 80, 60).fill(C.beigeF);
      doc.rect(40, doc.y, 4, 60).fill(C.gold);
      doc.restore();
      doc.fillColor(C.black).font('Helvetica-Bold').fontSize(13)
         .text(safe(organization?.name, 'Mon dossier'), 60, doc.y + 10);
      doc.font('Helvetica').fontSize(9).fillColor(C.textMute)
         .text(`${safe(venue?.name, 'Site à confirmer')} · Stand ${safe(registration?.stand_code, 'à confirmer')} · ${fmtDays(registration?.attending_days)}`, 60, doc.y + 5);
      doc.y += 75;

      // Intro
      p(doc, 'Bienvenue au Forum de la Rentrée 2026. Ce guide répond à toutes vos questions pratiques pour que votre participation se passe dans les meilleures conditions. Lisez-le attentivement et conservez-le jusqu\'après l\'événement.', { color: C.textSoft, lineGap: 3 });
      doc.save();
      doc.rect(40, doc.y, doc.page.width - 80, 24).fill(C.beigeP).restore();
      doc.fillColor(C.orange).font('Helvetica-Bold').fontSize(8.5)
         .text('☎  ARACOM est votre interlocuteur unique pour tout ce qui concerne votre stand.', 50, doc.y + 8, { characterSpacing: 0.5 });
      doc.y += 32;

      // §1 — Informations pratiques
      sectionTitle(doc, '1.', 'Informations pratiques', doc.y);
      const infoRows = [
        ['Dates', 'Vendredi 14 & Samedi 15 août 2026'],
        ['Horaires vendredi', '11h00 – 17h00 (accueil exposants dès 10h00)'],
        ['Horaires samedi', '9h00 – 17h00 (accueil exposants dès 8h00)'],
        ['Votre site', safe(venue?.name)],
        ['Votre emplacement', safe(registration?.stand_code)],
        ['Contact ARACOM', 'agence@aracom-conseil.fr'],
      ];
      infoRows.forEach(([k, v]) => {
        doc.fillColor(C.textMute).font('Helvetica').fontSize(8.5).text(k, 40, doc.y, { continued: true, width: 150 });
        doc.fillColor(C.black).font('Helvetica-Bold').text('  ' + v);
        doc.moveDown(0.2);
      });
      doc.moveDown(0.5);

      // §2 — Dossier d'inscription
      sectionTitle(doc, '2.', 'Votre dossier d\'inscription', doc.y);
      const docs = [
        ['1', 'Convention signée (2 exemplaires)', 'Obligatoire'],
        ['2', 'Caution réglée (20 000 XPF)', 'Obligatoire'],
        ['3', 'Choix créneau animation (date + heure)', animations.length > 0 ? 'Confirmé' : 'Si animation'],
        ['4', 'Attestation d\'assurance RC valide', 'Obligatoire'],
        ['5', 'Matériel spécifique signalé', 'Si applicable'],
      ];
      const ty = doc.y;
      doc.save().rect(40, ty, doc.page.width - 80, 18).fill(C.black).restore();
      doc.fillColor(C.gold).font('Helvetica-Bold').fontSize(8)
         .text('#', 46, ty + 5)
         .text('DOCUMENT', 70, ty + 5)
         .text('STATUT', 460, ty + 5);
      doc.y = ty + 22;
      docs.forEach((row, i) => {
        const rowY = doc.y;
        if (i % 2 === 0) doc.save().rect(40, rowY - 2, doc.page.width - 80, 16).fill(C.beigeP).restore();
        doc.fillColor(C.textMute).font('Helvetica').fontSize(8.5).text(row[0], 46, rowY);
        doc.fillColor(C.black).text(row[1], 70, rowY);
        doc.fillColor(row[2] === 'Obligatoire' ? C.orange : C.textMute).font('Helvetica-Bold').fontSize(8).text(row[2], 460, rowY);
        doc.y = rowY + 14;
      });
      doc.moveDown(0.5);

      // §3 — Caution
      sectionTitle(doc, '3.', 'Caution de participation', doc.y);
      doc.fillColor(C.orange).font('Helvetica-Bold').fontSize(14).text('20 000 XPF', 40, doc.y);
      doc.moveDown(0.3);
      doc.font('Helvetica').fontSize(9).fillColor(C.textSoft);
      doc.text("✓  Caution restituée si : présence effective les 2 jours · créneau animation respecté · emplacement libéré propre · convention respectée.");
      doc.moveDown(0.15);
      doc.fillColor(C.orange).text('✗  Caution retenue si : absence non signalée · démontage anticipé (avant 17h) · non-respect des conditions · matériel dégradé.');
      doc.moveDown(0.5);

      // §4 — Votre emplacement & équipement fourni
      sectionTitle(doc, '4.', 'Votre emplacement & équipement', doc.y);
      doc.fillColor(C.gold).font('Helvetica-Bold').fontSize(9).text('Pacific Centers met à disposition (sans frais) :', 40, doc.y);
      doc.moveDown(0.25);
      const provided = [
        "1 table (env. 1,80m × 0,70m)",
        "1 nappe longue côté client + 1 nappe courte côté intervenant",
        "Accès électrique sur demande (à signaler avant le 1er août)",
        "Sécurité générale du site assurée par Pacific Centers",
      ];
      provided.forEach(item => {
        doc.fillColor(C.textSoft).font('Helvetica').fontSize(8.5).text('•  ' + item, 50, doc.y, { width: doc.page.width - 100, lineGap: 2 });
        doc.moveDown(0.1);
      });
      doc.moveDown(0.15);
      doc.fillColor(C.textMute).font('Helvetica-Oblique').fontSize(8)
         .text('⚠  Non fourni : chaises, présentoirs, sono personnelle, fléchage spécifique. À apporter par l\'exposant.', 40, doc.y, { width: doc.page.width - 80 });
      doc.moveDown(0.5);

      drawFooter(doc, 'Page 1/2 — ARACOM · Guide de l\'exposant · Forum de la Rentrée 2026');

      // ─── PAGE 2 ───
      doc.addPage();
      drawHeader(doc, 'Guide de l\'exposant — suite');
      doc.y = 110;

      // §5 — Animation personnalisée
      if (animations.length > 0) {
        sectionTitle(doc, '5.', "Votre créneau d'animation", doc.y);
        animations.forEach(a => {
          doc.save().rect(40, doc.y, doc.page.width - 80, 32).fill(C.beigeF).restore();
          doc.fillColor(C.black).font('Helvetica-Bold').fontSize(10)
             .text(`${fmtDay(animDay(a))} · ${a.start_time} → ${a.end_time}`, 50, doc.y + 6);
          doc.fillColor(C.textSoft).font('Helvetica').fontSize(8.5)
             .text(safe(a.title) + (a.description ? ' — ' + a.description : ''), 50, doc.y + 5);
          doc.y += 38;
        });
        p(doc, "Soyez prêt 15 min avant. Respectez la durée allouée. Toute modification après le 1er août nécessite l'accord d'ARACOM.", { color: C.textMute, size: 8.5 });
      } else {
        sectionTitle(doc, '5.', "Créneau d'animation", doc.y);
        p(doc, "Vous n'avez pas réservé de créneau d'animation. Vous pouvez le faire depuis votre espace exposant — les meilleurs créneaux sont attribués aux premiers inscrits avec dossier complet.", { color: C.textMute, size: 9 });
      }

      // §6 — Planning Jour J
      sectionTitle(doc, '6.', 'Planning du jour J', doc.y);
      const planning = [
        ['Ven 10h / Sam 8h',  "Arrivée — émargement auprès de l'agent ARACOM"],
        ['V 10–11h / S 8–9h',  'Installation du stand dans les limites attribuées'],
        ['V 11h / S 9h',       'Ouverture officielle — vous êtes actif sur votre stand'],
        ['En journée',         'Animation, accueil public, respect du créneau attribué'],
        ['V & S 17h',          'Fermeture officielle — NE DÉMONTEZ PAS avant ce signal'],
        ['Après 17h',          "Démontage, nettoyage de l'emplacement, retour matériel"],
      ];
      const pty = doc.y;
      doc.save().rect(40, pty, doc.page.width - 80, 16).fill(C.black).restore();
      doc.fillColor(C.gold).font('Helvetica-Bold').fontSize(8)
         .text('HORAIRE', 46, pty + 4)
         .text('ACTION', 180, pty + 4);
      doc.y = pty + 20;
      planning.forEach((row, i) => {
        const rowY = doc.y;
        if (i % 2 === 0) doc.save().rect(40, rowY - 2, doc.page.width - 80, 16).fill(C.beigeP).restore();
        doc.fillColor(C.gold).font('Helvetica-Bold').fontSize(8).text(row[0], 46, rowY);
        doc.fillColor(C.textSoft).font('Helvetica').fontSize(8.5).text(row[1], 180, rowY);
        doc.y = rowY + 14;
      });
      doc.moveDown(0.4);

      // §7 — Autorisé / Interdit
      sectionTitle(doc, '7.', 'Règles importantes', doc.y);
      const colY = doc.y;
      // Autorisé
      doc.save().rect(40, colY, 250, 130).fill(C.beigeP).restore();
      doc.fillColor('#2d7a2d').font('Helvetica-Bold').fontSize(9).text('✓  AUTORISÉ', 50, colY + 8);
      const auths = ['Présentation/promotion de la structure', 'Distribution flyers et plaquettes', "Collecte d'inscriptions et contacts", 'Roll-up, kakémono, affichage sur table', 'Démonstrations dans les limites du stand'];
      doc.fillColor(C.textSoft).font('Helvetica').fontSize(8);
      auths.forEach((a, i) => doc.text('• ' + a, 50, colY + 22 + i * 12, { width: 230 }));
      // Interdit
      doc.save().rect(300, colY, 250, 130).fill('#fdf2f0').restore();
      doc.fillColor(C.orange).font('Helvetica-Bold').fontSize(9).text('✗  INTERDIT', 310, colY + 8);
      const inters = ['Vente de produits/marchandises', "Collecte d'argent", 'Diffusion sonore sans accord ARACOM', 'Oriflammes, structures gonflables', 'Utilisation visuels « Carrefour »', 'Démontage avant 17h'];
      doc.fillColor(C.textSoft).font('Helvetica').fontSize(8);
      inters.forEach((a, i) => doc.text('• ' + a, 310, colY + 22 + i * 12, { width: 230 }));
      doc.y = colY + 140;

      // §8 — Annulation
      sectionTitle(doc, '8.', 'Annulation', doc.y);
      const cancel = [
        ['Avant le 31 juillet 2026',   'Restitution intégrale', C.textSoft],
        ['Du 1er au 10 août 2026',     'Retenue 50% (10 000 XPF)', C.orange],
        ['Après le 10 août 2026',       'Retenue intégrale (20 000 XPF)', C.orange],
        ['Absence non signalée',       'Retenue intégrale + exclusion future', C.orange],
      ];
      cancel.forEach((row, i) => {
        const rowY = doc.y;
        if (i % 2 === 0) doc.save().rect(40, rowY - 2, doc.page.width - 80, 14).fill(C.beigeP).restore();
        doc.fillColor(C.black).font('Helvetica').fontSize(8.5).text(row[0], 46, rowY);
        doc.fillColor(row[2]).font('Helvetica-Bold').text(row[1], 320, rowY);
        doc.y = rowY + 13;
      });
      doc.moveDown(0.6);

      // §9 — Checklist avant le jour J
      sectionTitle(doc, '9.', 'Checklist avant le jour J', doc.y);
      const checklist = [
        "Convention signée et déposée dans mon espace exposant",
        "Caution réglée (20 000 XPF) — référence transmise à ARACOM",
        "Attestation d'assurance RC valide déposée",
        "Créneau d'animation confirmé (si applicable)",
        "Matériel spécifique signalé avant le 1er août",
        "Roll-up, plaquettes, flyers préparés",
        "Tenue d'équipe coordonnée le jour J",
        "Itinéraire et horaires d'arrivée vérifiés",
        "Référent ARACOM identifié pour le jour J",
        "Téléphone chargé + contact ARACOM enregistré",
      ];
      checklist.forEach((item, i) => {
        const rowY = doc.y;
        doc.rect(46, rowY + 2, 8, 8).strokeColor(C.gold).lineWidth(1).stroke();
        doc.fillColor(C.textSoft).font('Helvetica').fontSize(8.5).text(item, 62, rowY, { width: doc.page.width - 110 });
        doc.y = rowY + 14;
      });

      drawFooter(doc, "Page 2/2 — ARACOM · Guide de l'exposant · Forum de la Rentrée 2026");
      doc.end();
    } catch (e) { reject(e); }
  });
}

// ─── QUESTIONNAIRE DE SATISFACTION — VERSION VIERGE (à imprimer/signer) ──
export async function generateQuestionnaireBlankPDF({ organization = null, registration = null, venue = null } = {}) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4', margin: 0,
        info: { Title: 'Questionnaire de satisfaction - Forum de la Rentrée 2026', Author: 'ARACOM' },
      });
      const chunks = [];
      doc.on('data', c => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // ─── PAGE 1 ───
      drawHeader(doc, 'Questionnaire de satisfaction');
      doc.y = 105;
      p(doc, 'Forum de la Rentrée 2026 — Votre avis nous est précieux. Merci de prendre 5 min pour le remplir.', { color: C.textSoft, size: 9.5 });
      doc.moveDown(0.3);

      // §1 IDENTIFICATION (pré-remplie si possible)
      sectionTitle(doc, '1.', 'Identification', doc.y);
      const idRows = [
        ['Nom de la structure',     safe(organization?.name)],
        ['Discipline / Activité',   safe(organization?.discipline)],
        ['Site de participation',   safe(venue?.name)],
        ['N° d\'emplacement',        safe(registration?.stand_code)],
        ['Contact (facultatif)',    '_____________________________________________'],
      ];
      idRows.forEach(([k, v]) => {
        doc.fillColor(C.textMute).font('Helvetica').fontSize(8.5).text(k, 40, doc.y, { continued: true, width: 180 });
        doc.fillColor(C.black).font('Helvetica-Bold').text('  ' + v);
        doc.moveDown(0.2);
      });
      doc.moveDown(0.3);
      doc.fillColor(C.textMute).font('Helvetica').fontSize(8.5).text('Jour(s) de participation :', 40, doc.y);
      doc.moveDown(0.3);
      drawCheckbox(doc, 40,  doc.y, 'Vendredi 14 août');
      drawCheckbox(doc, 180, doc.y, 'Samedi 15 août');
      drawCheckbox(doc, 310, doc.y, 'Les deux jours');
      doc.y += 16;
      doc.moveDown(0.3);
      doc.fillColor(C.textMute).font('Helvetica').fontSize(8.5).text('Était-ce votre première participation ?', 40, doc.y);
      doc.moveDown(0.3);
      drawCheckbox(doc, 40,  doc.y, 'Oui, première fois');
      drawCheckbox(doc, 180, doc.y, '1 à 2 éditions précédentes');
      drawCheckbox(doc, 380, doc.y, '3 éditions ou plus');
      doc.y += 18;

      // §2 PRÉPARATION
      sectionTitle(doc, '2.', 'Préparation et inscription', doc.y);
      drawRatingLine(doc, 'La procédure d\'inscription était claire et simple');
      drawRatingLine(doc, 'Les informations reçues avant l\'événement étaient suffisantes');
      drawRatingLine(doc, 'La réactivité d\'ARACOM à vos questions avant l\'événement');

      // §3 LOGISTIQUE
      sectionTitle(doc, '3.', 'Logistique sur site', doc.y);
      drawRatingLine(doc, 'L\'accueil par l\'agent ARACOM à votre arrivée');
      doc.fillColor(C.textMute).fontSize(8.5).text('Votre emplacement correspondait au plan prévu ?', 40, doc.y);
      doc.moveDown(0.3);
      drawCheckbox(doc, 40,  doc.y, 'Conforme');
      drawCheckbox(doc, 180, doc.y, 'Légèrement différent');
      drawCheckbox(doc, 380, doc.y, 'Problème important');
      doc.y += 18;
      drawRatingLine(doc, 'Qualité du matériel fourni (table, nappes)');
      doc.fillColor(C.textMute).fontSize(8.5).text('Difficultés avec l\'électricité ?', 40, doc.y);
      doc.moveDown(0.3);
      drawCheckbox(doc, 40,  doc.y, 'Aucun problème');
      drawCheckbox(doc, 180, doc.y, 'Mineur résolu');
      drawCheckbox(doc, 310, doc.y, 'Majeur non résolu');
      drawCheckbox(doc, 460, doc.y, 'Non applicable');
      doc.y += 18;
      drawRatingLine(doc, 'Fluidité de votre créneau animation (si applicable)');

      drawFooter(doc, 'Page 1/2 — ARACOM · Questionnaire de satisfaction · Forum de la Rentrée 2026');

      // ─── PAGE 2 ───
      doc.addPage();
      drawHeader(doc, 'Questionnaire de satisfaction — suite');
      doc.y = 105;

      // §4 FRÉQUENTATION
      sectionTitle(doc, '4.', 'Fréquentation et résultats', doc.y);
      drawRatingLine(doc, 'Le nombre de visiteurs sur votre stand répondait à vos attentes');
      doc.fillColor(C.textMute).fontSize(8.5).text('Nombre approximatif de contacts collectés :', 40, doc.y);
      doc.moveDown(0.3);
      drawCheckbox(doc, 40,  doc.y, '0');
      drawCheckbox(doc, 100, doc.y, '1 à 5');
      drawCheckbox(doc, 200, doc.y, '6 à 15');
      drawCheckbox(doc, 310, doc.y, 'Plus de 15');
      doc.y += 18;
      drawRatingLine(doc, 'Le forum vous a permis d\'atteindre vos objectifs de rentrée');

      // §5 SATISFACTION GLOBALE
      sectionTitle(doc, '5.', 'Satisfaction globale', doc.y);
      drawRatingLine(doc, 'Satisfaction générale vis-à-vis du Forum de la Rentrée 2026');
      doc.fillColor(C.textMute).fontSize(8.5).text('Recommanderiez-vous le forum à une autre association ?  (0 = jamais, 10 = absolument)', 40, doc.y);
      doc.moveDown(0.4);
      // 11 cases 0-10
      const npsY = doc.y, npsW = 22, npsX = 60;
      for (let i = 0; i <= 10; i++) {
        const cx = npsX + i * (npsW + 8);
        doc.rect(cx, npsY, npsW, 18).strokeColor(C.black).lineWidth(0.8).stroke();
        doc.fillColor(C.black).font('Helvetica-Bold').fontSize(9).text(String(i), cx, npsY + 5, { width: npsW, align: 'center' });
      }
      doc.y = npsY + 24;
      doc.fillColor(C.textMute).fontSize(8.5).text('Souhaitez-vous reparticiper en 2027 ?', 40, doc.y);
      doc.moveDown(0.3);
      drawCheckbox(doc, 40,  doc.y, 'Oui, certainement');
      drawCheckbox(doc, 200, doc.y, 'Peut-être');
      drawCheckbox(doc, 320, doc.y, 'Non');
      doc.y += 20;

      // §6 COMMENTAIRES
      sectionTitle(doc, '6.', 'Commentaires libres', doc.y);
      drawTextArea(doc, 'Ce qui a particulièrement bien fonctionné', 4);
      drawTextArea(doc, 'Ce qui pourrait être amélioré', 4);
      drawTextArea(doc, 'Commentaire ou message libre pour ARACOM', 3);

      drawFooter(doc, 'Page 2/2 — ARACOM · Questionnaire de satisfaction · Forum de la Rentrée 2026');
      doc.end();
    } catch (e) { reject(e); }
  });
}

// ─── QUESTIONNAIRE — VERSION REMPLIE (récapitulatif après soumission) ──
export async function generateQuestionnaireFilledPDF({ response, organization = null, venue = null }) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4', margin: 0,
        info: { Title: `Réponses satisfaction - ${organization?.name || 'Exposant'}`, Author: 'ARACOM' },
      });
      const chunks = [];
      doc.on('data', c => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      drawHeader(doc, 'Réponses satisfaction');
      doc.y = 105;
      // Bandeau identité
      doc.save();
      doc.rect(40, doc.y, doc.page.width - 80, 50).fill(C.beigeF);
      doc.rect(40, doc.y, 4, 50).fill(C.gold);
      doc.restore();
      doc.fillColor(C.black).font('Helvetica-Bold').fontSize(12).text(safe(organization?.name, 'Exposant'), 60, doc.y + 8);
      doc.font('Helvetica').fontSize(8.5).fillColor(C.textMute)
         .text(`${safe(venue?.name, '—')} · Stand ${safe(response?.stand_code, '—')} · ${fmtDays(response?.attending_days)}`, 60, doc.y + 5);
      doc.fontSize(8).fillColor(C.textMute).text(`Soumis le ${response?.submitted_at ? new Date(response.submitted_at).toLocaleString('fr-FR') : '—'}`, 60, doc.y + 5);
      doc.y += 60;

      // §1
      sectionTitle(doc, '1.', 'Identification', doc.y);
      kv(doc, 'Première participation', firstTimeLabel(response?.first_time), 40, doc.y, 220);
      kv(doc, 'Contact', response?.contact, 310, doc.y, 220);
      doc.y += 30;

      // §2 RATINGS
      sectionTitle(doc, '2.', 'Notations (1 → 5 étoiles)', doc.y);
      [
        ['Procédure d\'inscription claire',           'procedure_clarte'],
        ['Infos pré-événement suffisantes',           'infos_pre_event'],
        ['Réactivité ARACOM avant événement',         'reactivite_aracom'],
        ['Accueil agent ARACOM',                       'accueil_aracom'],
        ['Qualité matériel fourni',                   'materiel_quality'],
        ['Fluidité créneau animation',                'animation_fluidite'],
        ['Nombre de visiteurs vs attentes',           'visiteurs_count'],
        ['Objectifs de rentrée atteints',             'objectifs_atteints'],
        ['Satisfaction globale',                       'satisfaction_globale'],
      ].forEach(([label, key]) => {
        const v = response?.ratings?.[key];
        doc.fillColor(C.textSoft).font('Helvetica').fontSize(9).text(label, 40, doc.y, { width: 340 });
        // Stars
        const sx = 400, sy = doc.y - 11;
        for (let i = 1; i <= 5; i++) {
          const fill = v && i <= v ? C.gold : '#e5e0d2';
          doc.save().fillColor(fill).circle(sx + (i - 1) * 18, sy, 5).fill().restore();
        }
        doc.fillColor(C.textMute).fontSize(8).text(`  ${v != null ? v + '/5' : 'n.r.'}`, sx + 90, sy - 3);
        doc.moveDown(0.7);
      });

      // §3 SINGLE-CHOICE
      sectionTitle(doc, '3.', 'Logistique & contexte', doc.y);
      kv(doc, 'Emplacement conforme au plan', mapLabel(response?.emplacement_conforme, { oui:'Conforme', leger:'Légèrement diff.', non:'Problème important' }), 40, doc.y, 220);
      kv(doc, 'Difficultés électricité', mapLabel(response?.electricity_issue, { aucun:'Aucun problème', mineur:'Mineur résolu', majeur:'Majeur non résolu', na:'Non applicable' }), 310, doc.y, 220);
      doc.y += 32;
      kv(doc, 'Contacts collectés', mapLabel(response?.contacts_collected, { '0':'0','1-5':'1 à 5','6-15':'6 à 15','15+':'+ de 15' }), 40, doc.y, 220);
      kv(doc, 'Retour en 2027', mapLabel(response?.return_2027, { oui:'Oui certainement', peutetre:'Peut-être', non:'Non' }), 310, doc.y, 220);
      doc.y += 32;

      // §4 NPS
      sectionTitle(doc, '4.', 'Recommandation (NPS)', doc.y);
      const npsV = typeof response?.nps === 'number' ? response.nps : null;
      doc.fillColor(npsV >= 7 ? '#2d7a2d' : npsV >= 3 ? C.orange : '#a82020').font('Helvetica-Bold').fontSize(18)
         .text(npsV != null ? `${npsV}/10` : 'Non renseigné', 40, doc.y);
      doc.fillColor(C.textMute).fontSize(8.5).text(npsV >= 7 ? 'Promoteur ✓' : npsV >= 3 ? 'Passif' : npsV != null ? 'Détracteur' : '', 130, doc.y - 16);
      doc.moveDown(1.2);

      // §5 COMMENTS
      sectionTitle(doc, '5.', 'Commentaires libres', doc.y);
      drawFilledComment(doc, 'Ce qui a bien fonctionné', response?.positives);
      drawFilledComment(doc, 'Améliorations suggérées', response?.improvements);
      drawFilledComment(doc, 'Message libre pour ARACOM', response?.free_comment);

      drawFooter(doc, 'Récapitulatif soumis · ARACOM · Forum de la Rentrée 2026');
      doc.end();
    } catch (e) { reject(e); }
  });
}

// ─── Helpers spécifiques au questionnaire ──────────────────────────────
function drawCheckbox(doc, x, y, label) {
  doc.rect(x, y, 10, 10).strokeColor(C.black).lineWidth(0.8).stroke();
  doc.fillColor(C.black).font('Helvetica').fontSize(9).text(label, x + 14, y - 1, { width: 200, lineBreak: false });
}
function drawRatingLine(doc, label) {
  doc.fillColor(C.textSoft).font('Helvetica').fontSize(9).text(label, 40, doc.y, { width: 340 });
  const sy = doc.y - 11, sx = 400;
  for (let i = 0; i < 5; i++) {
    doc.rect(sx + i * 22, sy, 16, 16).strokeColor(C.black).lineWidth(0.8).stroke();
    doc.fillColor(C.textMute).font('Helvetica').fontSize(7.5).text(String(i + 1), sx + i * 22, sy + 5, { width: 16, align: 'center' });
  }
  doc.moveDown(0.6);
}
function drawTextArea(doc, label, lines = 4) {
  doc.fillColor(C.textMute).font('Helvetica').fontSize(8.5).text(label, 40, doc.y);
  doc.moveDown(0.3);
  const yStart = doc.y;
  for (let i = 0; i < lines; i++) {
    doc.moveTo(40, yStart + i * 16).lineTo(doc.page.width - 40, yStart + i * 16).strokeColor(C.beigeC).dash(2, { space: 2 }).stroke().undash();
  }
  doc.y = yStart + lines * 16 + 8;
}
function drawFilledComment(doc, label, value) {
  doc.fillColor(C.textMute).font('Helvetica').fontSize(8.5).text(label, 40, doc.y);
  doc.moveDown(0.2);
  const v = (value || '').trim() || '— (non renseigné)';
  doc.save().rect(40, doc.y, doc.page.width - 80, 38).fill(C.beigeP).restore();
  doc.fillColor(C.black).font('Helvetica').fontSize(9).text(v, 46, doc.y + 6, { width: doc.page.width - 92, lineGap: 2 });
  doc.y += 46;
}
function firstTimeLabel(v) {
  return { first: 'Oui, première fois', '1-2': '1 à 2 éditions', '3+': '3 éditions ou plus' }[v] || '—';
}
function mapLabel(v, map) { return map[v] || '—'; }


// ─── REÇU DE CAUTION ─────────────────────────────────────────────────────
export async function generateReceiptPDF({ registration, organization, venue, deposit = null }) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 0 });
      const chunks = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      drawHeader(doc, 'Reçu de Caution');
      doc.y = 110;

      const receiptNumber = `CAUT-2026-${String(registration?.id || '').slice(0, 6).toUpperCase() || '------'}`;
      const issueDate = new Date().toLocaleDateString('fr-FR');
      const paymentMode = 'Chèque (à l\'ordre d\'ARACOM)';
      const amount = (deposit?.amount_xpf || 20000).toLocaleString('fr-FR') + ' XPF';

      // Section principale — bloc beige avec infos
      doc.save();
      doc.rect(40, doc.y, doc.page.width - 80, 180).fill(C.beigeP);
      doc.restore();

      const startY = doc.y + 16;
      // Colonne gauche
      kv(doc, "N° de reçu",      receiptNumber,                          54,  startY);
      kv(doc, "Date d'émission", issueDate,                              54,  startY + 36);
      kv(doc, "Exposant",        organization?.name,                      54,  startY + 72);
      kv(doc, "Discipline",      organization?.discipline,                54,  startY + 108);
      // Colonne droite
      kv(doc, "Site",            venue?.name,                             310, startY);
      kv(doc, "Stand",           registration?.stand_code,                310, startY + 36);
      kv(doc, "Contact",         organization?.contact_name,              310, startY + 72);
      kv(doc, "Mode de paiement", paymentMode,                            310, startY + 108);

      doc.y = startY + 180;
      doc.moveDown(1);

      // Bloc montant — encart doré sur fond noir
      const amountY = doc.y;
      doc.save();
      doc.rect(40, amountY, doc.page.width - 80, 80).fill(C.black);
      doc.rect(40, amountY, 4, 80).fill(C.orange);
      doc.restore();

      doc.fillColor(C.gold).font('Helvetica').fontSize(9)
         .text('MONTANT REÇU EN GARANTIE', 60, amountY + 14, { characterSpacing: 2 });
      doc.fillColor(C.beigeP).font('Helvetica-Bold').fontSize(28)
         .text(amount, 60, amountY + 28);
      doc.fillColor(C.gold).font('Helvetica').fontSize(8)
         .text('Caution restituée intégralement sous 2 semaines après l\'événement',
               60, amountY + 60, { width: doc.page.width - 120 });

      doc.y = amountY + 100;
      doc.moveDown(1);

      // Conditions de restitution
      sectionTitle(doc, '01', 'Conditions de restitution', doc.y);
      p(doc, "Cette caution sera restituée intégralement sous 2 semaines après l'événement, à condition que toutes les conditions suivantes soient respectées :", { size: 9, lineGap: 3 });
      doc.moveDown(0.3);
      p(doc, "•  Présence effective de l'exposant sur les jours confirmés (14 et/ou 15 août 2026).", { size: 9, lineGap: 2 });
      p(doc, "•  Montage et démontage du stand dans les horaires communiqués par ARACOM.", { size: 9, lineGap: 2 });
      p(doc, "•  Aucune dégradation constatée sur le matériel ou le site mis à disposition.", { size: 9, lineGap: 2 });
      p(doc, "•  Respect des consignes de sécurité et de la charte exposant.", { size: 9, lineGap: 2 });

      doc.moveDown(1);

      // Signatures
      const sigY = doc.y;
      doc.fillColor(C.textMute).font('Helvetica').fontSize(8)
         .text("Pour ARACOM,", 40, sigY);
      doc.fillColor(C.black).font('Helvetica-Bold').fontSize(10)
         .text("L'équipe organisation", 40, sigY + 12);

      doc.fillColor(C.textMute).font('Helvetica').fontSize(8)
         .text("Document officiel — Forum de la Rentrée 2026", 300, sigY, { width: 250, align: 'right' });
      doc.fillColor(C.black).font('Helvetica-Bold').fontSize(9)
         .text(receiptNumber, 300, sigY + 12, { width: 250, align: 'right' });

      drawFooter(doc, 'Reçu officiel — généré automatiquement');
      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}

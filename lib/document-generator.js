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

  doc.fillColor(C.beigeP)
     .font('Helvetica-Bold').fontSize(9)
     .text('ARACOM', 40, 24, { characterSpacing: 3 });
  doc.fillColor(C.gold).fontSize(7)
     .text('AGENCE DE COMMUNICATION & ÉVÉNEMENTIEL', 40, 38, { characterSpacing: 2 });

  doc.fillColor(C.beigeP).font('Helvetica').fontSize(8)
     .text('Forum de la Rentrée 2026', 40, 56);

  // Titre à droite
  doc.fillColor(C.gold).font('Helvetica-Bold').fontSize(13)
     .text(title.toUpperCase(), 280, 30, { width: 280, align: 'right', characterSpacing: 2 });
  doc.fillColor(C.beigeP).font('Helvetica').fontSize(7.5)
     .text('14 & 15 août 2026 · Polynésie française', 280, 52, { width: 280, align: 'right' });
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
export async function generateConventionPDF({ registration, organization, venue, animations = [] }) {
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

      drawHeader(doc, 'Convention de Participation');
      doc.y = 110;

      // Bloc parties
      doc.fillColor(C.textMute).font('Helvetica-Bold').fontSize(8)
         .text('ENTRE LES SOUSSIGNÉS', 40, doc.y, { characterSpacing: 2 });
      doc.moveTo(40, doc.y + 3).lineTo(doc.page.width - 40, doc.y + 3).strokeColor(C.beigeC).stroke();
      doc.moveDown(0.8);

      // D'une part
      doc.fillColor(C.gold).font('Helvetica-Bold').fontSize(9).text('D\'UNE PART,');
      doc.moveDown(0.3);
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
      doc.moveDown(0.6);

      // D'autre part
      doc.fillColor(C.gold).font('Helvetica-Bold').fontSize(9).text('D\'AUTRE PART,');
      doc.moveDown(0.3);

      // Tableau 2 colonnes pour les infos exposant
      const cx1 = 40, cx2 = 310, ty = doc.y;
      kv(doc, 'Nom de la structure', organization?.name, cx1, ty);
      kv(doc, 'Discipline / Activité', organization?.discipline, cx2, ty);
      kv(doc, 'Représenté par', organization?.contact_name, cx1, ty + 32);
      kv(doc, 'Fonction', organization?.contact_role || '—', cx2, ty + 32);
      kv(doc, 'Téléphone', organization?.main_phone, cx1, ty + 64);
      kv(doc, 'Email', organization?.main_email, cx2, ty + 64);
      kv(doc, 'N° Tahiti / Association', organization?.tahiti_number || organization?.association_number, cx1, ty + 96);
      doc.y = ty + 132;

      // Section 1 — Objet
      sectionTitle(doc, '1.', 'Objet de la convention', doc.y);
      p(doc, 'La présente convention définit les conditions de participation de l\'exposant au Forum de la Rentrée 2026, organisé par Pacific Centers dans les centres commerciaux de Polynésie française, géré et coordonné par ARACOM.');

      // Section 2 — Site, emplacement, période
      sectionTitle(doc, '2.', 'Site, emplacement et période', doc.y);
      const sy = doc.y;
      kv(doc, 'Site retenu', venue?.name, 40, sy);
      kv(doc, 'N° d\'emplacement', registration?.stand_code, 230, sy);
      kv(doc, 'Type de stand', registration?.stand_type || 'Stand standard (table + nappes)', 380, sy, 180);
      doc.y = sy + 38;

      // Cases à cocher jours
      const days = registration?.attending_days || [];
      const hasFr = days.includes('friday') || days.includes('vendredi');
      const hasSa = days.includes('saturday') || days.includes('samedi');
      const both  = hasFr && hasSa;
      doc.fillColor(C.textMute).fontSize(8).text('JOUR(S) DE PARTICIPATION', 40, doc.y, { characterSpacing: 1 });
      doc.moveDown(0.4);
      const cy = doc.y;
      const drawCheck = (x, y, checked, label) => {
        doc.rect(x, y, 10, 10).strokeColor(C.black).lineWidth(1).stroke();
        if (checked) {
          doc.save().fillColor(C.orange).rect(x + 2, y + 2, 6, 6).fill().restore();
        }
        doc.fillColor(C.black).font('Helvetica').fontSize(9).text(label, x + 14, y - 1);
      };
      drawCheck(40, cy, hasFr && !both, 'Vendredi 14 août');
      drawCheck(180, cy, hasSa && !both, 'Samedi 15 août');
      drawCheck(310, cy, both, 'Les deux jours');
      doc.y = cy + 22;

      p(doc, 'Horaires : Vendredi 11h – 17h  |  Samedi 9h – 17h', { color: C.textMute, size: 9 });
      p(doc, 'L\'emplacement est attribué par ARACOM selon l\'ordre d\'inscription et la complétude du dossier. Tout changement nécessite l\'accord express d\'ARACOM.', { color: C.textSoft });

      // Section 3 — Animations
      if (animations.length > 0) {
        sectionTitle(doc, '3.', 'Créneau d\'animation', doc.y);
        animations.forEach(a => {
          doc.fillColor(C.black).font('Helvetica-Bold').fontSize(9.5)
             .text(`• ${fmtDay(animDay(a))} de ${a.start_time} à ${a.end_time} — ${safe(a.title, 'Animation')}`);
          if (a.description) {
            doc.font('Helvetica').fontSize(8.5).fillColor(C.textMute).text(`  ${a.description}`, { lineGap: 2 });
          }
          doc.moveDown(0.3);
        });
      }

      // Section 4 — Caution
      sectionTitle(doc, animations.length > 0 ? '4.' : '3.', 'Caution de participation', doc.y);
      doc.fillColor(C.orange).font('Helvetica-Bold').fontSize(11).text('20 000 XPF');
      doc.moveDown(0.2);
      p(doc, 'Caution restituée si présence effective les deux jours, créneau animation respecté, emplacement libéré propre et convention respectée. Retenue partielle ou intégrale en cas d\'absence, démontage anticipé ou non-respect des conditions.', { color: C.textSoft });

      // Signatures
      doc.moveDown(1);
      doc.fillColor(C.textMute).font('Helvetica-Bold').fontSize(8)
         .text('SIGNATURES', 40, doc.y, { characterSpacing: 2 });
      doc.moveTo(40, doc.y + 3).lineTo(doc.page.width - 40, doc.y + 3).strokeColor(C.beigeC).stroke();
      doc.moveDown(0.8);

      const sigY = doc.y;
      doc.fillColor(C.black).font('Helvetica-Bold').fontSize(9).text('Pour ARACOM (mandataire)', 40, sigY);
      doc.font('Helvetica').fontSize(8).fillColor(C.textMute)
         .text('Teva Daniel GEROS, Directeur', 40, sigY + 13);
      doc.text('Date : _______________________', 40, sigY + 60);
      doc.rect(40, sigY + 25, 240, 28).strokeColor(C.beigeC).dash(3, { space: 2 }).stroke().undash();

      doc.fillColor(C.black).font('Helvetica-Bold').fontSize(9).text('Pour l\'exposant', 310, sigY);
      doc.font('Helvetica').fontSize(8).fillColor(C.textMute)
         .text(safe(organization?.contact_name), 310, sigY + 13);
      doc.text('Date : _______________________', 310, sigY + 60);
      doc.rect(310, sigY + 25, 240, 28).strokeColor(C.beigeC).dash(3, { space: 2 }).stroke().undash();

      drawFooter(doc, 'Convention de participation exposant · Forum de la Rentrée 2026');
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
      doc.text('✓  Caution restituée si : présence effective les 2 jours · créneau animation respecté · emplacement libéré propre · convention respectée.');
      doc.moveDown(0.15);
      doc.fillColor(C.orange).text('✗  Caution retenue si : absence non signalée · démontage anticipé (avant 17h) · non-respect des conditions · matériel dégradé.');
      doc.moveDown(0.5);

      drawFooter(doc, 'Page 1/2 — ARACOM · Guide de l\'exposant · Forum de la Rentrée 2026');

      // ─── PAGE 2 ───
      doc.addPage();
      drawHeader(doc, 'Guide de l\'exposant — suite');
      doc.y = 110;

      // §4 — Animation personnalisée
      if (animations.length > 0) {
        sectionTitle(doc, '4.', 'Votre créneau d\'animation', doc.y);
        animations.forEach(a => {
          doc.save().rect(40, doc.y, doc.page.width - 80, 32).fill(C.beigeF).restore();
          doc.fillColor(C.black).font('Helvetica-Bold').fontSize(10)
             .text(`${fmtDay(animDay(a))} · ${a.start_time} → ${a.end_time}`, 50, doc.y + 6);
          doc.fillColor(C.textSoft).font('Helvetica').fontSize(8.5)
             .text(safe(a.title) + (a.description ? ' — ' + a.description : ''), 50, doc.y + 5);
          doc.y += 38;
        });
        p(doc, 'Soyez prêt 15 min avant. Respectez la durée allouée. Toute modification après le 1er août nécessite l\'accord d\'ARACOM.', { color: C.textMute, size: 8.5 });
      } else {
        sectionTitle(doc, '4.', 'Créneau d\'animation', doc.y);
        p(doc, 'Vous n\'avez pas réservé de créneau d\'animation. Vous pouvez le faire depuis votre espace exposant — les meilleurs créneaux sont attribués aux premiers inscrits avec dossier complet.', { color: C.textMute, size: 9 });
      }

      // §5 — Planning Jour J
      sectionTitle(doc, '5.', 'Planning du jour J', doc.y);
      const planning = [
        ['Ven 10h / Sam 8h',  'Arrivée — émargement auprès de l\'agent ARACOM'],
        ['V 10–11h / S 8–9h',  'Installation du stand dans les limites attribuées'],
        ['V 11h / S 9h',       'Ouverture officielle — vous êtes actif sur votre stand'],
        ['En journée',         'Animation, accueil public, respect du créneau attribué'],
        ['V & S 17h',          'Fermeture officielle — NE DÉMONTEZ PAS avant ce signal'],
        ['Après 17h',          'Démontage, nettoyage de l\'emplacement, retour matériel'],
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

      // §6 — Autorisé / Interdit
      sectionTitle(doc, '6.', 'Règles importantes', doc.y);
      const colY = doc.y;
      // Autorisé
      doc.save().rect(40, colY, 250, 130).fill(C.beigeP).restore();
      doc.fillColor('#2d7a2d').font('Helvetica-Bold').fontSize(9).text('✓  AUTORISÉ', 50, colY + 8);
      const auths = ['Présentation/promotion de la structure', 'Distribution flyers et plaquettes', 'Collecte d\'inscriptions et contacts', 'Roll-up, kakémono, affichage sur table', 'Démonstrations dans les limites du stand'];
      doc.fillColor(C.textSoft).font('Helvetica').fontSize(8);
      auths.forEach((a, i) => doc.text('• ' + a, 50, colY + 22 + i * 12, { width: 230 }));
      // Interdit
      doc.save().rect(300, colY, 250, 130).fill('#fdf2f0').restore();
      doc.fillColor(C.orange).font('Helvetica-Bold').fontSize(9).text('✗  INTERDIT', 310, colY + 8);
      const inters = ['Vente de produits/marchandises', 'Collecte d\'argent', 'Diffusion sonore sans accord ARACOM', 'Oriflammes, structures gonflables', 'Utilisation visuels « Carrefour »', 'Démontage avant 17h'];
      doc.fillColor(C.textSoft).font('Helvetica').fontSize(8);
      inters.forEach((a, i) => doc.text('• ' + a, 310, colY + 22 + i * 12, { width: 230 }));
      doc.y = colY + 140;

      // §7 — Annulation
      sectionTitle(doc, '7.', 'Annulation', doc.y);
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

      drawFooter(doc, 'Page 2/2 — ARACOM · Guide de l\'exposant · Forum de la Rentrée 2026');
      doc.end();
    } catch (e) { reject(e); }
  });
}

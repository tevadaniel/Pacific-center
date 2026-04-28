// Plans terrain officiels — schémas simplifiés reproduits fidèlement d'après
// les PNG utilisateur (ARUE / TARAVAO / FAA'A / PUNAAUIA).
// Chaque plan est un SVG interactif : les stands ont classe "snum" (numéro)
// et "snom" (nom exposant, masqué par défaut) pour que VenueMapReal puisse
// les colorer dynamiquement selon leur statut.

const BG = '#5a3f1e';          // fond marron (terre)
const BLACK = '#0a0a0a';       // commerces / carrefour / kiosques
const CYAN = '#00AEEF';        // stands par défaut + bordures
const GREEN = '#22c55e';       // DEMONSTRATION + flèches
const ENTRY_COLOR = '#2b7fa8'; // texte ENTRÉE bleu

// Génère un stand (ovale bleu avec code au centre + emplacement pour nom)
// x, y : centre du stand
// Stands ~3m × 2m réels → environ 40px × 24px (échelle ~13px/m)
function stand(code, x, y, w = 40, h = 24) {
  const rx = Math.round(w / 2);
  return `<rect x="${x - w/2}" y="${y - h/2}" width="${w}" height="${h}" rx="${rx}" fill="${CYAN}"/><text x="${x}" y="${y + 3}" text-anchor="middle" font-size="10" font-weight="800" fill="#fff" class="snum">${code}</text><text x="${x}" y="${y + 3}" text-anchor="middle" font-size="8" font-weight="700" fill="#fff" class="snom" style="display:none"></text>`;
}

// Kiosque ~3m × 3m réels → environ 38px × 32px (~13px/m)
function kiosque(x, y, w = 80, h = 32) {
  const rx = Math.round(h / 2);
  return `<rect x="${x - w/2}" y="${y - h/2}" width="${w}" height="${h}" rx="${rx}" fill="${BLACK}" stroke="${CYAN}" stroke-width="2"/><text x="${x}" y="${y + 4}" text-anchor="middle" font-size="11" font-weight="700" fill="#fff">Kiosque</text>`;
}

// Zone DEMONSTRATION ~10m × 4m → ~120px × 48px
function demo(x, y, w = 120, h = 48) {
  return `<rect x="${x - w/2}" y="${y - h/2}" width="${w}" height="${h}" rx="${h/2}" fill="${GREEN}" stroke="${CYAN}" stroke-width="3"/><text x="${x}" y="${y + 4}" text-anchor="middle" font-size="13" font-weight="800" fill="#fff">DEMONSTRATION</text>`;
}

// Carrefour rect (noir) — bâtiment principal large et plat
function carrefour(x, y, w, h, label = 'Carrefour') {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${BLACK}"/><text x="${x + w/2}" y="${y + h/2 + 9}" text-anchor="middle" font-size="26" font-weight="800" fill="#fff" letter-spacing="2">${label.toUpperCase()}</text>`;
}

// Commerce rect (noir) — petits commerces avoisinants
function commerce(x, y, w, h, label = 'Commerce') {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${BLACK}" stroke="#333" stroke-width="1"/><text x="${x + w/2}" y="${y + h/2 + 7}" text-anchor="middle" font-size="20" font-weight="700" fill="#fff">${label}</text>`;
}

// Flèche ENTRÉE verte (horizontale)
function entryArrowH(x, y, dir = 'right', label = 'ENTRÉE') {
  const flip = dir === 'left' ? 1 : -1;
  const tipX = dir === 'right' ? x + 60 : x - 60;
  const path = dir === 'right'
    ? `M ${x} ${y - 18} L ${x + 45} ${y - 18} L ${x + 45} ${y - 32} L ${x + 70} ${y} L ${x + 45} ${y + 32} L ${x + 45} ${y + 18} L ${x} ${y + 18} Z`
    : `M ${x} ${y - 18} L ${x - 45} ${y - 18} L ${x - 45} ${y - 32} L ${x - 70} ${y} L ${x - 45} ${y + 32} L ${x - 45} ${y + 18} L ${x} ${y + 18} Z`;
  const textX = dir === 'right' ? x - 5 : x + 5;
  const textAnchor = dir === 'right' ? 'end' : 'start';
  return `<path d="${path}" fill="${GREEN}"/><text x="${textX}" y="${y + 55}" text-anchor="${textAnchor}" font-size="18" font-weight="700" fill="${ENTRY_COLOR}">${label}</text>`;
}

// Flèche ENTRÉE verticale (pointant vers le haut depuis le bas)
function entryArrowV(x, y, label = 'ENTRÉE') {
  const path = `M ${x - 18} ${y} L ${x - 18} ${y - 45} L ${x - 32} ${y - 45} L ${x} ${y - 70} L ${x + 32} ${y - 45} L ${x + 18} ${y - 45} L ${x + 18} ${y} Z`;
  return `<path d="${path}" fill="${GREEN}"/><text x="${x + 30}" y="${y - 25}" font-size="18" font-weight="700" fill="${ENTRY_COLOR}" transform="rotate(90 ${x + 30} ${y - 25})">${label}</text>`;
}

// -----------------------------------------------------------------------
// ARUE — 12 stands (A01..A12) en ligne, DEMO au milieu, Kiosque à droite
// Layout: ENTRÉE gauche / 9 stands / DEMO / 3 stands / Kiosque / ENTRÉE droite
//         Carrefour en haut / Commerces en bas avec ENTRÉE centrale
// -----------------------------------------------------------------------
const arueSvg = `
<rect width="1400" height="600" fill="${BG}"/>
${commerce(200, 120, 1000, 65, 'Carrefour')}
<text x="380" y="260" font-size="14" fill="${CYAN}">côté intervenant</text>
${stand('A01', 300, 300)}
${stand('A02', 360, 300)}
${stand('A03', 420, 300)}
${stand('A04', 480, 300)}
${stand('A05', 540, 300)}
${stand('A06', 600, 300)}
${stand('A07', 660, 300)}
${stand('A08', 720, 300)}
${stand('A09', 780, 300)}
${demo(870, 300)}
${stand('A10', 970, 300)}
${stand('A11', 1030, 300)}
${stand('A12', 1090, 300)}
${kiosque(1180, 300)}
${commerce(260, 400, 360, 110, 'Commerce')}
${commerce(780, 400, 360, 110, 'Commerce')}
${entryArrowH(180, 300, 'right')}
${entryArrowH(1270, 300, 'left')}
${entryArrowV(700, 575)}
`;

// -----------------------------------------------------------------------
// TARAVAO — 12 stands (T01..T12) 6+DEMO+6
// 2 Carrefour séparés en haut, 2 Commerces séparés en bas avec entrées
// -----------------------------------------------------------------------
const taravaoSvg = `
<rect width="1400" height="600" fill="${BG}"/>
${commerce(120, 120, 460, 65, 'Carrefour')}
${commerce(820, 120, 460, 65, 'Carrefour')}
<text x="260" y="260" font-size="14" fill="${CYAN}">côté intervenant</text>
${stand('T01', 260, 300)}
${stand('T02', 320, 300)}
${stand('T03', 380, 300)}
${stand('T04', 440, 300)}
${stand('T05', 500, 300)}
${stand('T06', 560, 300)}
${demo(700, 300)}
${stand('T07', 830, 300)}
${stand('T08', 890, 300)}
${stand('T09', 950, 300)}
${stand('T10', 1010, 300)}
${stand('T11', 1070, 300)}
${stand('T12', 1130, 300)}
${kiosque(1215, 300)}
${commerce(140, 400, 440, 110, 'Commerce')}
${commerce(820, 400, 440, 110, 'Commerce')}
${entryArrowH(70, 300, 'right')}
${entryArrowH(1340, 300, 'left')}
${entryArrowV(700, 575)}
`;

// -----------------------------------------------------------------------
// FAA'A — 16 stands (F01..F16) alignés avec 2 kiosques intercalés
// Layout complexe en L: Commerce+DEMO à gauche, stands en ligne avec 2 kiosques,
// Commerces bas, ENTRÉEs 2 côtés + bas
// -----------------------------------------------------------------------
const faaaSvg = `
<rect width="1400" height="600" fill="${BG}"/>
${commerce(100, 100, 260, 220, 'Commerce')}
<rect x="370" y="140" width="110" height="110" rx="14" fill="${GREEN}" stroke="${CYAN}" stroke-width="3"/>
<text x="425" y="202" text-anchor="middle" font-size="12" font-weight="800" fill="#fff">DEMONSTRATION</text>
${commerce(500, 100, 800, 60, 'Carrefour')}
<text x="200" y="360" font-size="14" fill="${CYAN}">côté intervenant</text>
${stand('F01', 190, 400)}
${stand('F02', 250, 400)}
${stand('F03', 310, 400)}
${stand('F04', 390, 400)}
${stand('F05', 450, 400)}
${stand('F06', 510, 400)}
${stand('F07', 570, 400)}
${stand('F08', 630, 400)}
${stand('F09', 690, 400)}
${kiosque(790, 400)}
${stand('F10', 890, 400)}
${stand('F11', 950, 400)}
${stand('F12', 1010, 400)}
${stand('F13', 1070, 400)}
${kiosque(1170, 400)}
${stand('F14', 1260, 400)}
${stand('F15', 1320, 400)}
${stand('F16', 1370, 400, 40, 28)}
${commerce(100, 475, 520, 85, 'Commerce')}
${commerce(680, 475, 640, 85, 'Commerce')}
${entryArrowH(70, 400, 'right')}
${entryArrowH(1390, 400, 'left', '')}
<text x="1395" y="455" font-size="16" font-weight="700" fill="${ENTRY_COLOR}">ENTRÉE</text>
${entryArrowV(650, 600)}
`;

// -----------------------------------------------------------------------
// PUNAAUIA — 13 stands (P01..P13)
// Layout: Commerces en haut (2), Kiosque+3 stands / DEMO / 9 stands+Kiosque, Commerces bas
// -----------------------------------------------------------------------
const punaauiaSvg = `
<rect width="1400" height="600" fill="${BG}"/>
${commerce(120, 100, 540, 85, 'Commerce')}
${commerce(740, 100, 540, 85, 'Commerce')}
<text x="300" y="260" font-size="14" fill="${CYAN}">côté intervenant</text>
${kiosque(220, 300)}
${stand('P01', 310, 300)}
${stand('P02', 370, 300)}
${stand('P03', 430, 300)}
${demo(570, 300)}
${stand('P04', 700, 300)}
${stand('P05', 760, 300)}
${stand('P06', 820, 300)}
${stand('P07', 880, 300)}
${stand('P08', 940, 300)}
${stand('P09', 1000, 300)}
${stand('P10', 1060, 300)}
${stand('P11', 1120, 300)}
${stand('P12', 1180, 300)}
${stand('P13', 1240, 300)}
${kiosque(1330, 300)}
${commerce(120, 410, 540, 100, 'Commerce')}
${commerce(740, 410, 540, 100, 'Commerce')}
${entryArrowH(70, 300, 'right')}
${entryArrowH(1395, 300, 'left', '')}
<text x="1390" y="355" font-size="16" font-weight="700" fill="${ENTRY_COLOR}">ENTRÉE</text>
${entryArrowV(700, 580)}
`;

export const SVG_PLANS = {
  arue:     { viewBox: '0 0 1400 600', svg: arueSvg },
  taravao:  { viewBox: '0 0 1400 600', svg: taravaoSvg },
  faaa:     { viewBox: '0 0 1400 600', svg: faaaSvg },
  punaauia: { viewBox: '0 0 1400 600', svg: punaauiaSvg },
};

// Mapping venue code (DB) -> SVG plan key
export const PLAN_KEY_BY_VENUE = {
  FAAA: 'faaa',
  PUN: 'punaauia',
  ARU: 'arue',
  TAR: 'taravao',
  // MAH and MOO have no real SVG plan yet -> fallback to schematic VenueMap
};

// Convert SVG stand code (e.g. "A01") -> DB stand_code (e.g. "A-C01")
const SVG_TO_DB_PREFIX = {
  A: 'A-C',
  T: 'T-D',
  F: 'F-A',
  P: 'P-B',
};

export function svgCodeToDbCode(svgCode) {
  if (!svgCode || svgCode.length < 2) return svgCode;
  const letter = svgCode[0];
  const num = svgCode.slice(1);
  const prefix = SVG_TO_DB_PREFIX[letter];
  if (!prefix) return svgCode;
  return `${prefix}${num}`;
}

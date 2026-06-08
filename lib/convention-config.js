// 🆕 PHASE F — Configuration officielle Convention Forum Rentrée 2026
// Source : Conventions PDF signées par les 4 SCI propriétaires (Faaa, Punaauia, Arue, Taravao)

export const CONVENTION_CONFIG = {
  // Caution (chèque)
  caution_amount_xpf: 20000,
  caution_label: '20 000 XPF',
  caution_form: 'chèque de caution',

  // Dates événement
  event_year: 2026,
  installation_date: '2026-08-14',
  installation_time: '10:00',
  forum_dates: [
    { date: '2026-08-14', day_label: 'Vendredi', long_label: 'Vendredi 14 août 2026', start: '11:00', end: '17:00' },
    { date: '2026-08-15', day_label: 'Samedi', long_label: 'Samedi 15 août 2026', start: '09:00', end: '17:00' },
  ],

  // Deadline d'annulation sans frais
  cancellation_deadline: '2026-07-31', // Après cette date, la caution est encaissée
  cancellation_deadline_label: 'vendredi 31 juillet 2026',

  // Organisateur réel + agence d'exécution
  organizer: {
    name: 'Pacific Centers',
    legal_name: 'Pacific Centers — Centres commerciaux de Tahiti',
    contact_email: 'contact@pacificcenters.pf',
    contact_phone: '',
    representative: '',
    city: 'Tahiti',
  },
  // Agence en charge de l'organisation opérationnelle (validation, suivi exposants, conventions)
  agency: {
    name: 'ARACOM',
    legal_name: 'Aracom Conseil',
    contact_email: 'agence@aracom-conseil.fr',
    contact_phone: '40 47 88 50',
    representative: 'ARACOM Conseil',
    city: "Faa'a",
  },

  // Obligations exposant (synthèse pour affichage)
  exposant_obligations: [
    'Être présent sur le stand aux dates et heures indiquées',
    "Assurer une animation (démonstration, initiation, activité ou écran vidéo)",
    "Décorer le stand à l'image de son enseigne",
    "Fournir une attestation d'assurance dommages et responsabilité civile",
    "Apporter le matériel complémentaire (chaises, rallonges, écran...)",
    "Ranger le matériel/stock sous la table (non visible des clients)",
    "Respecter l'emplacement prédéfini (pas de débordement)",
    "Entretenir l'emplacement propre et le rendre en bon état",
    "Surveiller son matériel jour et nuit",
  ],

  // Interdictions
  exposant_interdictions: [
    'Vente directe de produits sur le Forum',
    'Démarchage direct dans la galerie',
    'Distribution de prospectus dans la galerie marchande ou le parking',
    "Implantation d'oriflammes",
    'Utilisation de nappes personnelles (table noire fournie)',
    "Débordement en dehors du stand (sauf matériel promotionnel)",
    "Stationnement de véhicule ou dépôt de marchandise nuisant à la circulation",
  ],

  // Restrictions
  exposant_restrictions: [
    'PLV tolérée dans la limite d\'1 roll-up par exposant (support informatif)',
    'Distribution de documents restreinte au stand et à la demande du client',
  ],

  // Fourni par l'organisateur
  provided_by_organizer: [
    "Table nappée noire pour chaque exposant",
    "Plan d'implantation remis par l'agence ARACOM",
    "Encadrement et suivi sur site",
  ],
};

// Helpers
export function getDeadlineDaysRemaining() {
  const deadline = new Date(CONVENTION_CONFIG.cancellation_deadline);
  const now = new Date();
  const diff = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));
  return diff;
}

export function isDeadlinePassed() {
  return new Date() > new Date(CONVENTION_CONFIG.cancellation_deadline);
}

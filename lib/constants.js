// Business enums & labels for Forum Rentrée 2026

export const SITES = [
  { code: 'FAAA', name: 'Faaa', address: "Faaa, Tahiti", capacity: 18 },
  { code: 'PUN', name: 'Punaauia', address: "Punaauia, Tahiti", capacity: 22 },
  { code: 'ARU', name: 'Arue', address: "Arue, Tahiti", capacity: 16 },
  { code: 'TAR', name: 'Taravao', address: "Taravao, Presqu'île de Tahiti", capacity: 14 },
  { code: 'MAH', name: 'Mahina', address: "Mahina, Tahiti", capacity: 14 },
  { code: 'MOO', name: 'Moorea', address: "Moorea", capacity: 12 },
];

export const PRIORITY_LEVELS = ['A', 'B', 'C', 'prospect'];

export const REGISTRATION_STATUS = [
  'prospect','contacte','a_confirmer','a_relancer','confirme','refuse','annule'
];
export const REGISTRATION_STATUS_LABEL = {
  prospect: 'Prospect', contacte: 'Contacté', a_confirmer: 'À confirmer',
  a_relancer: 'À relancer', confirme: 'Confirmé', refuse: 'Refusé', annule: 'Annulé',
};
export const REGISTRATION_STATUS_COLOR = {
  prospect: 'bg-slate-100 text-slate-700 border-slate-200',
  contacte: 'bg-orange-100 text-orange-700 border-orange-200',
  a_confirmer: 'bg-amber-100 text-amber-700 border-amber-200',
  a_relancer: 'bg-orange-100 text-orange-700 border-orange-200',
  confirme: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  refuse: 'bg-red-100 text-red-700 border-red-200',
  annule: 'bg-slate-100 text-slate-500 border-slate-200',
};

export const DEPOSIT_STATUS = [
  'non_demandee','demandee','en_attente','recue','restituee','retenue_partielle','retenue_totale'
];
export const DEPOSIT_STATUS_LABEL = {
  non_demandee: 'Non demandée', demandee: 'Demandée', en_attente: 'En attente',
  recue: 'Reçue', restituee: 'Restituée', retenue_partielle: 'Retenue partielle',
  retenue_totale: 'Retenue totale',
};

export const DOCUMENT_TYPES = ['assurance','recu_caution','convention','guide','autre'];
export const DOCUMENT_TYPE_LABEL = {
  assurance: 'Assurance', recu_caution: 'Reçu caution', convention: 'Convention',
  guide: 'Guide exposant', autre: 'Autre',
};
export const DOCUMENT_STATUS = ['manquant','depose','valide','refuse'];

export const PRESENCE_STATUS = ['attendu','arrive','absent','parti','depart_anticipe','annule'];
export const PRESENCE_STATUS_LABEL = {
  attendu: 'Attendu', arrive: 'Arrivé', absent: 'Absent',
  parti: 'Parti', depart_anticipe: 'Départ anticipé', annule: 'Annulé',
};
export const PRESENCE_STATUS_COLOR = {
  attendu: 'bg-slate-100 text-slate-700 border-slate-200',
  arrive: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  absent: 'bg-red-100 text-red-700 border-red-200',
  parti: 'bg-blue-100 text-blue-700 border-blue-200',
  depart_anticipe: 'bg-amber-100 text-amber-700 border-amber-200',
  annule: 'bg-slate-100 text-slate-500 border-slate-200',
};

export const ANOMALY_TYPES = [
  'absent_sans_prevenir','retard_important','stand_non_conforme','animation_non_assuree',
  'depart_avant_heure','materiel_manquant','probleme_securite','probleme_comportement',
  'probleme_administratif','degradation','autre'
];
export const ANOMALY_TYPE_LABEL = {
  absent_sans_prevenir: 'Absent sans prévenir',
  retard_important: 'Retard important',
  stand_non_conforme: 'Stand non conforme',
  animation_non_assuree: 'Animation non assurée',
  depart_avant_heure: 'Départ avant l’heure',
  materiel_manquant: 'Matériel manquant',
  probleme_securite: 'Problème sécurité',
  probleme_comportement: 'Problème comportement',
  probleme_administratif: 'Problème administratif',
  degradation: 'Dégradation',
  autre: 'Autre',
};

export const SEVERITY_LEVELS = ['faible','moyenne','haute','critique'];
export const SEVERITY_COLOR = {
  faible: 'bg-slate-100 text-slate-700 border-slate-200',
  moyenne: 'bg-amber-100 text-amber-700 border-amber-200',
  haute: 'bg-orange-100 text-orange-700 border-orange-200',
  critique: 'bg-red-100 text-red-700 border-red-200',
};

export const DEPOSIT_RECOMMENDATIONS = [
  'aucun_impact','restitution','retenue_partielle','retenue_totale','verification_manuelle'
];
export const DEPOSIT_RECO_LABEL = {
  aucun_impact: 'Aucun impact',
  restitution: 'Restitution intégrale',
  retenue_partielle: 'Retenue partielle',
  retenue_totale: 'Retenue totale',
  verification_manuelle: 'Vérification manuelle',
};

export const POST_EVENT_STATUS = [
  'en_attente','termine_sans_incident','termine_avec_observations','incident_a_traiter','caution_a_revoir'
];

export const DISCIPLINES = [
  'Sport','Musique','Danse','Arts','Culture','Éducation','Solidarité',
  'Environnement','Nautique','Traditionnel','Jeunesse','Santé'
];

export const EVENT_DATES = [
  { label: 'vendredi', date: '2026-08-14', display: 'Vendredi 14 août 2026' },
  { label: 'samedi', date: '2026-08-15', display: 'Samedi 15 août 2026' },
];

// Heures d'ouverture officielles du Forum (figées, non modifiables par les exposants)
export const EVENT_OPENING_TIME = '09:00';
export const EVENT_CLOSING_TIME = '17:00';

// Créneaux horaires fixes proposés pour les animations SUR LE STAND (1h chacun)
// Sur le stand = ressource personnelle, pas de conflit possible entre exposants
export const ANIMATION_HOURLY_SLOTS = [
  { start: '09:00', end: '10:00' },
  { start: '10:00', end: '11:00' },
  { start: '11:00', end: '12:00' },
  { start: '12:00', end: '13:00' },
  { start: '13:00', end: '14:00' },
  { start: '14:00', end: '15:00' },
  { start: '15:00', end: '16:00' },
  { start: '16:00', end: '17:00' },
];

// Créneaux ZONE DE DÉMONSTRATION (30 min chacun)
// Zone démo = ressource partagée, 1 SEUL exposant par créneau et par site
export const DEMO_ZONE_SLOTS = [
  { start: '09:00', end: '09:30' },
  { start: '09:30', end: '10:00' },
  { start: '10:00', end: '10:30' },
  { start: '10:30', end: '11:00' },
  { start: '11:00', end: '11:30' },
  { start: '11:30', end: '12:00' },
  { start: '13:00', end: '13:30' },
  { start: '13:30', end: '14:00' },
  { start: '14:00', end: '14:30' },
  { start: '14:30', end: '15:00' },
  { start: '15:00', end: '15:30' },
  { start: '15:30', end: '16:00' },
  { start: '16:00', end: '16:30' },
  { start: '16:30', end: '17:00' },
];

// Combien de créneaux d'animation max par exposant et par jour
export const MAX_ANIMATION_SLOTS_PER_DAY = 3;

// Combien d'animations peuvent tourner en parallèle sur le MÊME site au MÊME créneau
// (uniquement pour le stand : multi-stands en parallèle ; pour la zone démo c'est toujours 1)
export const MAX_PARALLEL_ANIMATIONS = 99;
export const MAX_DEMO_PARALLEL = 1;

// Au moins 1 créneau requis par jour (validation soft, warning si non rempli)
export const MIN_ANIMATION_SLOTS_PER_DAY = 1;

// Logistique fournie par ARACOM (info pour les exposants)
export const LOGISTIQUE_PROVISIONS = [
  { icon: '🪑', label: '1 table (180×80 cm)', detail: 'Une table standard est fournie pour chaque stand' },
  { icon: '🪑', label: '2 chaises', detail: 'Pour vous et un accompagnant' },
  { icon: '🔌', label: 'Prise électrique 220 V', detail: 'Sur demande, à préciser dans les notes' },
  { icon: '🚿', label: 'Accès aux sanitaires', detail: 'Sanitaires communs sur site' },
  { icon: '☂️', label: 'Stand abrité', detail: 'Sous chapiteau ou structure fixe selon le site' },
  { icon: '🚗', label: 'Parking exposant', detail: 'Places réservées à proximité du site' },
];
export const LOGISTIQUE_RULES = [
  '🕘 Arrivée 1h avant l\'ouverture publique pour montage stand (8h max).',
  '🎁 Apportez votre matériel personnel (banderole, flyers, démos, etc.).',
  '🧹 Vous êtes responsable de la propreté et du démontage de votre stand.',
  '🚭 Interdiction stricte de fumer, vapoter ou consommer de l\'alcool sur les sites.',
  '🤝 Soyez bienveillants et professionnels avec les visiteurs et autres exposants.',
  '⚠️ Signaler toute anomalie ou incident à un agent ARACOM dans la journée.',
];

export const DEPOSIT_AMOUNT_XPF = 20000;

export const EVENT_NAME = 'Forum de la Rentrée 2026';

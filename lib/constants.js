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

export const DEPOSIT_AMOUNT_XPF = 20000;

export const EVENT_NAME = 'Forum de la Rentrée 2026';

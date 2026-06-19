/**
 * 📚 Catalogue des types de documents complémentaires pour un exposant.
 *
 * Catégorie 1 (obligatoires/standard) — gérée séparément dans le tunnel et documents-tab :
 *   - convention, assurance, identite, immatriculation
 *
 * Catégorie 2 (autogénérés ARACOM) — gérée séparément :
 *   - recu_caution, attestation_remboursement, badge_exposant, guide_participant
 *
 * Catégorie 3 (compléments libres) — défini ici, partagé entre ARACOM/Exposant/Pacific :
 *   - Permet d'enrichir la base d'un exposant avec des pièces utiles.
 *   - Tous ces docs sont visibles + téléchargeables côté ARACOM + Pacific Centers.
 *   - L'exposant peut aussi déposer ces pièces depuis son portail.
 */

export const EXPOSANT_ADDITIONAL_DOC_TYPES = [
  {
    key: 'rib',
    label: 'RIB / Coordonnées bancaires',
    subtitle: 'Pour la restitution de la caution après l\'événement',
    icon: 'Landmark',
    iconBg: 'bg-violet-500',
  },
  {
    key: 'statuts',
    label: 'Statuts de l\'association / Kbis',
    subtitle: 'Document juridique constitutif',
    icon: 'FileText',
    iconBg: 'bg-indigo-500',
  },
  {
    key: 'rna',
    label: 'Récépissé RNA (associations)',
    subtitle: 'Numéro RNA + récépissé Préfecture',
    icon: 'FileBadge',
    iconBg: 'bg-blue-500',
  },
  {
    key: 'programme_animation',
    label: 'Programme détaillé des animations',
    subtitle: 'Déroulé prévisionnel sur stand / zone démo',
    icon: 'CalendarDays',
    iconBg: 'bg-emerald-500',
  },
  {
    key: 'photos_stand',
    label: 'Photos du stand / matériel',
    subtitle: 'Aperçu du matériel exposé, signalétique, mise en scène',
    icon: 'Image',
    iconBg: 'bg-cyan-500',
  },
  {
    key: 'autorisation_sacem',
    label: 'Autorisation SACEM',
    subtitle: 'Si diffusion musicale prévue sur le stand',
    icon: 'Music',
    iconBg: 'bg-amber-500',
  },
  {
    key: 'autorisation_alimentaire',
    label: 'Autorisation alimentaire / sanitaire',
    subtitle: 'Si dégustation / vente alimentaire (DDPP)',
    icon: 'Utensils',
    iconBg: 'bg-rose-500',
  },
  {
    key: 'cv_referent',
    label: 'CV du référent / éducateur',
    subtitle: 'Diplômes, expérience pédagogique',
    icon: 'UserSquare',
    iconBg: 'bg-slate-500',
  },
  {
    key: 'autre',
    label: 'Autre document',
    subtitle: 'Tout autre document utile (le nom est libre)',
    icon: 'Paperclip',
    iconBg: 'bg-slate-400',
    allowCustomName: true,
  },
];

// Map de référence pour résoudre un libellé depuis un document_type stocké en DB
export const EXPOSANT_ADDITIONAL_DOC_TYPE_MAP = EXPOSANT_ADDITIONAL_DOC_TYPES.reduce((acc, t) => {
  acc[t.key] = t;
  return acc;
}, {});

// Types réservés aux 4 docs "officiels" — à exclure des listes "complémentaires"
export const RESERVED_DOC_TYPES = new Set([
  'convention', 'assurance', 'identite', 'immatriculation',
  'recu_caution', 'attestation_remboursement', 'badge_exposant', 'guide_participant',
]);

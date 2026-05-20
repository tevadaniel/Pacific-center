/**
 * 🆕 SESSION 45 — Builder d'export Excel exhaustif des données exposants
 *
 * - Format multi-onglets (.xlsx) compatible Emergent : headers en ligne 1, pas de fusion,
 *   noms de colonnes normalisés (snake_case), 1 ligne = 1 entité.
 * - Onglet "Exposants_flat" : 1 ligne par exposant avec toutes les colonnes sélectionnées
 * - Onglets dédiés : Stands_assignments, Animations, Cautions, Documents, Validations
 * - Permet la sélection de colonnes via paramètre `columns` (CSV)
 */

import * as XLSX from 'xlsx';

/** Définition exhaustive des colonnes disponibles pour l'onglet "Exposants_flat" */
export const EXPOSANT_COLUMNS = [
  // Identité
  { key: 'organization_id', label: 'ID Organisation', group: 'Identité' },
  { key: 'organization_name', label: 'Nom structure', group: 'Identité' },
  { key: 'discipline', label: 'Discipline', group: 'Identité' },
  { key: 'contact_name', label: 'Contact principal', group: 'Identité' },
  { key: 'main_email', label: 'Email principal', group: 'Identité' },
  { key: 'main_phone', label: 'Téléphone', group: 'Identité' },
  { key: 'address', label: 'Adresse', group: 'Identité' },
  { key: 'siret', label: 'SIRET / N° association', group: 'Identité' },
  { key: 'website', label: 'Site web', group: 'Identité' },
  // Inscription
  { key: 'registration_id', label: 'ID Inscription', group: 'Inscription' },
  { key: 'status', label: 'Statut', group: 'Inscription' },
  { key: 'venue_id', label: 'ID Site', group: 'Inscription' },
  { key: 'venue_name', label: 'Site', group: 'Inscription' },
  { key: 'stand_code', label: 'Stand', group: 'Inscription' },
  { key: 'stand_size', label: 'Taille stand', group: 'Inscription' },
  { key: 'attending_days', label: 'Jours présence', group: 'Inscription' },
  { key: 'completion_percent', label: 'Dossier (%)', group: 'Inscription' },
  { key: 'block_locked_at', label: 'Verrouillé le', group: 'Inscription' },
  { key: 'candidature_locked', label: 'Candidature verrouillée', group: 'Inscription' },
  // Animations
  { key: 'anim_count', label: 'Nb animations', group: 'Animations' },
  { key: 'anim_ven_stand', label: 'Anim Ven · Sur stand', group: 'Animations' },
  { key: 'anim_ven_zone', label: 'Anim Ven · Zone démo', group: 'Animations' },
  { key: 'anim_sam_stand', label: 'Anim Sam · Sur stand', group: 'Animations' },
  { key: 'anim_sam_zone', label: 'Anim Sam · Zone démo', group: 'Animations' },
  { key: 'anim_titles', label: 'Titres animations', group: 'Animations' },
  // Caution & paiement
  { key: 'caution_status', label: 'Caution statut', group: 'Caution' },
  { key: 'caution_amount', label: 'Caution montant (XPF)', group: 'Caution' },
  { key: 'caution_received_at', label: 'Caution reçue le', group: 'Caution' },
  // Documents
  { key: 'convention_status', label: 'Convention statut', group: 'Documents' },
  { key: 'convention_signed_at', label: 'Convention signée le', group: 'Documents' },
  { key: 'insurance_status', label: 'Assurance statut', group: 'Documents' },
  { key: 'is_insurance_uploaded', label: 'Assurance uploadée', group: 'Documents' },
  // Suivi
  { key: 'reply_status', label: 'Réponse reçue', group: 'Suivi' },
  { key: 'last_contact_at', label: 'Dernier contact', group: 'Suivi' },
  { key: 'notes', label: 'Notes', group: 'Suivi' },
  // Méta
  { key: 'created_at', label: 'Créé le', group: 'Méta' },
  { key: 'updated_at', label: 'MAJ le', group: 'Méta' },
  { key: 'cancelled_at', label: 'Annulé le', group: 'Méta' },
  { key: 'cancel_reason', label: 'Motif annulation', group: 'Méta' },
];

const fmt = (v) => {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toISOString();
  if (Array.isArray(v)) return v.join(' | ');
  if (typeof v === 'object') { try { return JSON.stringify(v); } catch { return ''; } }
  return v;
};

/**
 * Construit un workbook Excel multi-onglets + retourne un Buffer
 * @param {{ db, columns?: string[] }} args
 */
export async function buildExposantsExcel({ db, columns }) {
  // Sélection des colonnes (toutes par défaut)
  const selectedKeys = (Array.isArray(columns) && columns.length > 0)
    ? columns.filter((k) => EXPOSANT_COLUMNS.some((c) => c.key === k))
    : EXPOSANT_COLUMNS.map((c) => c.key);
  const selectedCols = EXPOSANT_COLUMNS.filter((c) => selectedKeys.includes(c.key));

  // Charger toutes les données
  const [orgs, regs, venues, animSlots, deposits, valReqs, regDocs] = await Promise.all([
    db.collection('organizations').find({}).toArray(),
    db.collection('registrations').find({}).toArray(),
    db.collection('venues').find({}).toArray(),
    db.collection('animation_slots').find({}).toArray(),
    db.collection('deposit_transactions').find({}).toArray(),
    db.collection('validation_requests').find({}).toArray(),
    db.collection('registration_documents').find({}).toArray(),
  ]);

  const orgById = new Map(orgs.map((o) => [o.id, o]));
  const venueById = new Map(venues.map((v) => [v.id, v]));

  // Build flat rows pour Exposants_flat
  const flatRows = regs.map((r) => {
    const org = orgById.get(r.organization_id) || {};
    const ven = venueById.get(r.venue_id) || {};
    const myAnims = animSlots.filter((a) => a.registration_id === r.id && !['annulé','annule','cancelled'].includes(a.status));
    const myDeposit = deposits.find((d) => d.registration_id === r.id && !['annule','cancelled','refused'].includes(d.status));
    const myDocs = regDocs.filter((d) => d.registration_id === r.id);
    const conv = myDocs.find((d) => d.kind === 'convention' || d.document_type === 'convention');
    const ins = myDocs.find((d) => d.kind === 'insurance' || d.document_type === 'insurance');

    return {
      organization_id: r.organization_id || '',
      organization_name: org.name || r.organization_name || '',
      discipline: org.discipline || '',
      contact_name: org.contact_name || '',
      main_email: org.main_email || '',
      main_phone: org.main_phone || '',
      address: org.address || '',
      siret: org.siret || org.association_number || '',
      website: org.website || '',
      registration_id: r.id,
      status: r.status || '',
      venue_id: r.venue_id || '',
      venue_name: ven.name || '',
      stand_code: r.stand_code || '',
      stand_size: r.stand_size || '',
      attending_days: Array.isArray(r.attending_days) ? r.attending_days.join('+') : '',
      completion_percent: r.completion_percent ?? '',
      block_locked_at: r.block_locked_at || '',
      candidature_locked: r.candidature_locked ? 'oui' : 'non',
      anim_count: myAnims.length,
      anim_ven_stand: myAnims.filter((a) => a.day_label === 'vendredi' && (a.location_type === 'sur_stand' || a.slot_type === 'sur_stand')).length,
      anim_ven_zone: myAnims.filter((a) => a.day_label === 'vendredi' && (a.location_type === 'zone_demo' || a.slot_type === 'zone_demo')).length,
      anim_sam_stand: myAnims.filter((a) => a.day_label === 'samedi' && (a.location_type === 'sur_stand' || a.slot_type === 'sur_stand')).length,
      anim_sam_zone: myAnims.filter((a) => a.day_label === 'samedi' && (a.location_type === 'zone_demo' || a.slot_type === 'zone_demo')).length,
      anim_titles: myAnims.map((a) => a.title).filter(Boolean).join(' | '),
      caution_status: myDeposit?.status || '',
      caution_amount: myDeposit?.amount || '',
      caution_received_at: myDeposit?.received_at || myDeposit?.created_at || '',
      convention_status: conv?.status || '',
      convention_signed_at: conv?.signed_at || '',
      insurance_status: ins?.status || '',
      is_insurance_uploaded: ins ? 'oui' : 'non',
      reply_status: r.reply_status || '',
      last_contact_at: r.last_contact_at || '',
      notes: r.notes || org.notes || '',
      created_at: r.created_at || '',
      updated_at: r.updated_at || '',
      cancelled_at: r.cancelled_at || '',
      cancel_reason: r.cancel_reason || '',
    };
  });

  // === Workbook ===
  const wb = XLSX.utils.book_new();

  // Onglet 1 : Exposants_flat (avec colonnes filtrées)
  const headers1 = selectedCols.map((c) => c.label);
  const data1 = [headers1, ...flatRows.map((row) => selectedCols.map((c) => fmt(row[c.key])))];
  const ws1 = XLSX.utils.aoa_to_sheet(data1);
  ws1['!cols'] = selectedCols.map((c) => ({ wch: Math.min(40, Math.max(10, c.label.length + 4)) }));
  XLSX.utils.book_append_sheet(wb, ws1, 'Exposants_flat');

  // Onglet 2 : Stands_assignments (full)
  const sa = await db.collection('stand_assignments').find({}).toArray();
  const standsRows = sa.map((a) => ({
    assignment_id: a.id,
    registration_id: a.registration_id,
    organization_id: a.organization_id || '',
    venue_id: a.venue_id || '',
    venue_stand_id: a.venue_stand_id || '',
    stand_code: a.stand_code || '',
    status: a.status || '',
    assigned_at: fmt(a.assigned_at),
    cancelled_at: fmt(a.cancelled_at),
    cancel_reason: a.cancel_reason || '',
    notes: a.notes || '',
  }));
  const ws2 = XLSX.utils.json_to_sheet(standsRows);
  XLSX.utils.book_append_sheet(wb, ws2, 'Stands');

  // Onglet 3 : Animations
  const animRows = animSlots.map((a) => ({
    animation_id: a.id,
    registration_id: a.registration_id,
    venue_id: a.venue_id || '',
    stand_code: a.stand_code || '',
    day_label: a.day_label || '',
    event_date: a.event_date || '',
    start_time: a.start_time || '',
    end_time: a.end_time || '',
    duration_minutes: a.duration_minutes || '',
    location_type: a.location_type || a.slot_type || '',
    title: a.title || '',
    description: a.description || '',
    target_audience: a.target_audience || '',
    material_needs: a.material_needs || '',
    status: a.status || '',
    created_at: fmt(a.created_at),
    updated_at: fmt(a.updated_at),
  }));
  const ws3 = XLSX.utils.json_to_sheet(animRows);
  XLSX.utils.book_append_sheet(wb, ws3, 'Animations');

  // Onglet 4 : Cautions
  const cautionRows = deposits.map((d) => ({
    deposit_id: d.id,
    registration_id: d.registration_id,
    organization_id: d.organization_id || '',
    amount: d.amount || '',
    status: d.status || '',
    payment_mode: d.payment_mode || d.mode || '',
    received_at: fmt(d.received_at),
    refunded_at: fmt(d.refunded_at),
    created_at: fmt(d.created_at),
    notes: d.notes || '',
  }));
  const ws4 = XLSX.utils.json_to_sheet(cautionRows);
  XLSX.utils.book_append_sheet(wb, ws4, 'Cautions');

  // Onglet 5 : Documents
  const docRows = regDocs.map((d) => ({
    document_id: d.id,
    registration_id: d.registration_id,
    document_type: d.document_type || d.kind || '',
    status: d.status || '',
    file_name: d.file_name || '',
    file_size: d.file_size || '',
    signed_at: fmt(d.signed_at),
    uploaded_at: fmt(d.uploaded_at),
    created_at: fmt(d.created_at),
  }));
  const ws5 = XLSX.utils.json_to_sheet(docRows);
  XLSX.utils.book_append_sheet(wb, ws5, 'Documents');

  // Onglet 6 : Validations & Liste d'attente
  const valRows = valReqs.map((v) => ({
    validation_id: v.id,
    registration_id: v.registration_id,
    organization_id: v.organization_id || '',
    organization_name: v.organization_name || '',
    venue_id: v.venue_id || '',
    venue_name: v.venue_name || '',
    requested_stand_code: v.requested_stand_code || v.stand_code || '',
    status: v.status || '',
    kind: v.kind || '',
    note: v.note || '',
    created_at: fmt(v.created_at),
    updated_at: fmt(v.updated_at),
  }));
  const ws6 = XLSX.utils.json_to_sheet(valRows);
  XLSX.utils.book_append_sheet(wb, ws6, 'Validations');

  // Onglet 7 : Organisations (référentiel complet)
  const orgRows = orgs.map((o) => ({
    organization_id: o.id,
    name: o.name || '',
    discipline: o.discipline || '',
    contact_name: o.contact_name || '',
    main_email: o.main_email || '',
    main_phone: o.main_phone || '',
    address: o.address || '',
    siret: o.siret || o.association_number || '',
    website: o.website || '',
    notes: o.notes || '',
    created_at: fmt(o.created_at),
  }));
  const ws7 = XLSX.utils.json_to_sheet(orgRows);
  XLSX.utils.book_append_sheet(wb, ws7, 'Organisations');

  // Generate buffer
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx', compression: true });
  return { buf, sheets: ['Exposants_flat', 'Stands', 'Animations', 'Cautions', 'Documents', 'Validations', 'Organisations'], row_count: flatRows.length };
}

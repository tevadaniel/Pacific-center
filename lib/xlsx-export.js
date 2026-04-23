'use client';

import * as XLSX from 'xlsx';

const SITE_ORDER = ['Faaa', 'Punaauia', 'Arue', 'Taravao', 'Mahina', 'Moorea'];

// Generic helper to download a workbook as .xlsx
function downloadWorkbook(wb, filename) {
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); document.body.removeChild(a); }, 100);
}

function sheet(data, colWidths) {
  const ws = XLSX.utils.json_to_sheet(data);
  if (colWidths) ws['!cols'] = colWidths.map(w => ({ wch: w }));
  return ws;
}

/**
 * Export complet — toutes les données de l'édition dans un seul fichier Excel multi-feuilles.
 * Récupère les données via les endpoints API puis construit 7 feuilles :
 *  1. Résumé
 *  2. Exposants
 *  3. Stands
 *  4. Cautions
 *  5. Satisfaction
 *  6. Tâches / Relances
 *  7. Anomalies
 */
export async function exportFullXLSX(fetchApi) {
  const [kpis, sites, regs, venues, emails, surveys, tasks, anomalies] = await Promise.all([
    fetchApi('/api/dashboard/kpis').catch(() => ({})),
    fetchApi('/api/dashboard/by-site').catch(() => []),
    fetchApi('/api/registrations').catch(() => []),
    fetchApi('/api/venues').catch(() => []),
    fetchApi('/api/emails').catch(() => []),
    fetchApi('/api/satisfaction').catch(() => []),
    fetchApi('/api/tasks').catch(() => []),
    fetchApi('/api/anomalies').catch(() => []),
  ]);

  // Stands: pour tous les venues
  const standsAll = [];
  for (const v of venues) {
    try {
      const s = await fetchApi(`/api/venues/${v.id}/stands`);
      s.forEach(st => standsAll.push({ ...st, venue_name: v.name, venue_code: v.code }));
    } catch { /* skip */ }
  }

  const wb = XLSX.utils.book_new();

  // ----- Feuille 1: Résumé -----
  const summary = [
    { Indicateur: 'Total exposants', Valeur: kpis.total || 0 },
    { Indicateur: 'Confirmés', Valeur: kpis.by_status?.confirme || 0 },
    { Indicateur: 'À confirmer', Valeur: kpis.by_status?.a_confirmer || 0 },
    { Indicateur: 'À relancer', Valeur: kpis.by_status?.a_relancer || 0 },
    { Indicateur: 'Prospects', Valeur: kpis.by_status?.prospect || 0 },
    { Indicateur: 'Cautions reçues', Valeur: kpis.cautions_recues || 0 },
    { Indicateur: 'Cautions attendues (XPF)', Valeur: (kpis.xpf_en_attente || 0) + (kpis.xpf_encaisses || 0) },
    { Indicateur: 'Cautions encaissées (XPF)', Valeur: kpis.xpf_encaisses || 0 },
    { Indicateur: 'Conventions signées', Valeur: kpis.conv_signed || 0 },
    { Indicateur: 'Documents manquants', Valeur: kpis.docs_manquants || 0 },
    { Indicateur: '', Valeur: '' },
    { Indicateur: '--- SITES ---', Valeur: '' },
    ...sites.map(s => ({ Indicateur: s.venue_name, Valeur: `${s.assigned}/${s.capacity_stands} attribués — ${s.confirmed} confirmés — ${s.remplissage}%` })),
    { Indicateur: '', Valeur: '' },
    { Indicateur: '--- SATISFACTION ---', Valeur: '' },
    { Indicateur: 'Nombre de retours', Valeur: surveys.length },
    { Indicateur: 'Note moyenne globale', Valeur: surveys.length ? +(surveys.map(s=>s.overall_rating).filter(v=>typeof v==='number').reduce((a,b)=>a+b,0)/surveys.filter(s=>typeof s.overall_rating==='number').length || 0).toFixed(2) : '—' },
    { Indicateur: '', Valeur: '' },
    { Indicateur: 'Export généré le', Valeur: new Date().toLocaleString('fr-FR') },
  ];
  XLSX.utils.book_append_sheet(wb, sheet(summary, [30, 50]), 'Résumé');

  // ----- Feuille 2: Exposants -----
  const expSheet = regs.map(r => ({
    'Exposant': r.organization?.name || '',
    'Discipline': r.organization?.discipline || '',
    'Site': r.venue?.name || '',
    'Stand': r.stand_code || '',
    'Statut': r.status || '',
    'Complétion %': r.completion_percent || 0,
    'Email': r.organization?.main_email || '',
    'Téléphone': r.organization?.main_phone || '',
    'Contact': r.organization?.contact_name || '',
    'Priorité': r.organization?.priority_level || '',
    'Assurance OK': r.is_insurance_uploaded ? 'Oui' : 'Non',
    'Convention signée': r.is_convention_signed ? 'Oui' : 'Non',
    'Caution reçue': r.is_deposit_received ? 'Oui' : 'Non',
    'Créé le': r.created_at ? new Date(r.created_at).toLocaleDateString('fr-FR') : '',
  }));
  XLSX.utils.book_append_sheet(wb, sheet(expSheet, [28, 20, 14, 10, 14, 10, 28, 15, 22, 10, 12, 14, 12, 12]), 'Exposants');

  // ----- Feuille 3: Stands -----
  const standsSheet = standsAll.sort((a,b)=>(a.stand_code||'').localeCompare(b.stand_code||'')).map(s => ({
    'Stand': s.stand_code,
    'Site': s.venue_name,
    'Zone': s.zone || '',
    'Statut stand': s.organization ? (s.registration_status || 'prospect') : 'libre',
    'Exposant': s.organization?.name || '',
    'Discipline': s.organization?.discipline || '',
    'Priorité': s.organization?.priority_level || '',
  }));
  XLSX.utils.book_append_sheet(wb, sheet(standsSheet, [10, 14, 12, 14, 28, 20, 10]), 'Stands');

  // ----- Feuille 4: Cautions -----
  const cautionsSheet = regs.map(r => ({
    'Exposant': r.organization?.name || '',
    'Site': r.venue?.name || '',
    'Stand': r.stand_code || '',
    'Email': r.organization?.main_email || '',
    'Statut caution': r.deposit?.status || 'non_demandee',
    'Montant (XPF)': r.deposit?.amount_xpf || 20000,
    'Méthode': r.deposit?.payment_method || '',
    'Reçue le': r.deposit?.received_at ? new Date(r.deposit.received_at).toLocaleDateString('fr-FR') : '',
    'Post-event': r.deposit?.post_event_review_status || '',
  }));
  XLSX.utils.book_append_sheet(wb, sheet(cautionsSheet, [28, 14, 10, 28, 18, 14, 14, 14, 18]), 'Cautions');

  // ----- Feuille 5: Satisfaction -----
  const satSheet = surveys.map(s => ({
    'Exposant': s.organization_name || '',
    'Discipline': s.organization_discipline || '',
    'Site': s.venue_name || '',
    'Stand': s.stand_code || '',
    'Note globale /5': s.overall_rating ?? '',
    'Organisation /5': s.organization_rating ?? '',
    'Stand /5': s.stand_rating ?? '',
    'Visiteurs /5': s.visitors_rating ?? '',
    'Communication /5': s.communication_rating ?? '',
    'NPS /10': s.nps_score ?? '',
    'Prochaine édition': s.will_participate_next || '',
    'Points positifs': s.positive_points || '',
    'À améliorer': s.improvement_points || '',
    'Commentaire libre': s.free_comment || '',
    'Soumis le': s.submitted_at ? new Date(s.submitted_at).toLocaleString('fr-FR') : '',
  }));
  XLSX.utils.book_append_sheet(wb, sheet(satSheet, [28, 20, 14, 10, 14, 14, 10, 12, 14, 10, 18, 40, 40, 40, 18]), 'Satisfaction');

  // ----- Feuille 6: Tâches / Relances -----
  const regById = Object.fromEntries(regs.map(r => [r.id, r]));
  const tasksSheet = tasks.map(t => {
    const r = regById[t.registration_id];
    return {
      'Exposant': r?.organization?.name || '—',
      'Site': r?.venue?.name || '',
      'Stand': r?.stand_code || '',
      'Titre': t.title || '',
      'Type': t.task_type || '',
      'Priorité': t.priority || '',
      'Statut': t.status || '',
      'Échéance': t.due_date || '',
      'Auto-générée': t.auto_generated ? 'Oui' : 'Non',
      'Créée le': t.created_at ? new Date(t.created_at).toLocaleDateString('fr-FR') : '',
    };
  });
  XLSX.utils.book_append_sheet(wb, sheet(tasksSheet, [28, 14, 10, 40, 14, 12, 12, 14, 14, 14]), 'Tâches');

  // ----- Feuille 7: Anomalies -----
  const anoSheet = anomalies.map(a => ({
    'Exposant': regById[a.registration_id]?.organization?.name || '',
    'Site': regById[a.registration_id]?.venue?.name || a.venue_name || '',
    'Date': a.event_date || '',
    'Type': a.anomaly_type || '',
    'Gravité': a.severity_level || '',
    'Titre': a.title || '',
    'Description': a.description || '',
    'Résolu': a.is_resolved ? 'Oui' : 'Non',
    'Créée le': a.created_at ? new Date(a.created_at).toLocaleDateString('fr-FR') : '',
  }));
  XLSX.utils.book_append_sheet(wb, sheet(anoSheet, [28, 14, 12, 20, 12, 40, 50, 10, 14]), 'Anomalies');

  // ----- Feuille 8: Emails envoyés -----
  const emailsSheet = (emails || []).slice(0, 500).map(e => ({
    'Destinataire': e.to_email || '',
    'Objet': e.subject || '',
    'Statut envoi': e.send_status || '',
    'Ouvert': e.opened_at ? 'Oui' : 'Non',
    'Cliqué': e.clicked_at ? 'Oui' : 'Non',
    'Envoyé le': e.sent_at ? new Date(e.sent_at).toLocaleString('fr-FR') : '',
  }));
  XLSX.utils.book_append_sheet(wb, sheet(emailsSheet, [30, 60, 14, 10, 10, 18]), 'Emails');

  const filename = `Forum_Rentree_2026_export_${new Date().toISOString().slice(0,10)}.xlsx`;
  downloadWorkbook(wb, filename);
  return { filename, sheets: wb.SheetNames };
}

/** Export simple d'une table spécifique en XLSX */
export function exportTableXLSX(rows, filename, sheetName = 'Données') {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), sheetName);
  downloadWorkbook(wb, filename);
}

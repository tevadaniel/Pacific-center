'use client';

// Client-side CSV export helper
export function downloadCSV(filename, rows) {
  if (!rows?.length) return;
  const keys = Array.from(rows.reduce((s, r) => { Object.keys(r).forEach(k => s.add(k)); return s; }, new Set()));
  const esc = (v) => {
    if (v === null || v === undefined) return '';
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [keys.join(','), ...rows.map(r => keys.map(k => esc(r[k])).join(','))].join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportExposantsCSV(rows) {
  const simplified = rows.map(r => ({
    exposant: r.organization?.name,
    discipline: r.organization?.discipline,
    priorité: r.organization?.priority_level,
    contact: r.organization?.contact_name,
    email: r.organization?.main_email,
    téléphone: r.organization?.main_phone,
    site: r.venue?.name,
    stand: r.stand_code,
    statut: r.status,
    convention_signée: r.is_convention_signed ? 'oui' : 'non',
    caution: r.deposit?.status,
    animation: r.animation_type,
    vendredi: r.friday_slot_label || '',
    samedi: r.saturday_slot_label || '',
    complétion: `${r.completion_percent || 0}%`,
  }));
  downloadCSV(`exposants-${new Date().toISOString().slice(0, 10)}.csv`, simplified);
}

export function exportCautionsCSV(rows) {
  const simplified = rows.map(r => ({
    exposant: r.organization?.name,
    site: r.venue?.name,
    stand: r.stand_code,
    statut_caution: r.deposit?.status,
    montant_xpf: r.deposit?.amount_xpf || 20000,
    email: r.organization?.main_email,
  }));
  downloadCSV(`cautions-${new Date().toISOString().slice(0, 10)}.csv`, simplified);
}

export function exportSatisfactionCSV(rows) {
  const simplified = rows.map(r => ({
    exposant: r.organization_name,
    discipline: r.organization_discipline,
    site: r.venue_name,
    stand: r.stand_code,
    note_globale: r.overall_rating,
    organisation: r.organization_rating,
    stand_note: r.stand_rating,
    visiteurs: r.visitors_rating,
    communication: r.communication_rating,
    nps: r.nps_score,
    participation_prochaine: r.will_participate_next,
    points_positifs: r.positive_points,
    points_amelioration: r.improvement_points,
    commentaire: r.free_comment,
    soumis_le: r.submitted_at ? new Date(r.submitted_at).toLocaleString('fr-FR') : '',
  }));
  downloadCSV(`satisfaction-${new Date().toISOString().slice(0, 10)}.csv`, simplified);
}

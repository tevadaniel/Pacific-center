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


export function exportAnimationsCSV(animations) {
  const simplified = animations.map(a => ({
    exposant: a.organization_name || '',
    site: a.venue_name || '',
    stand: a.stand_code || '',
    jour: a.day_label || '',
    date: a.event_date || '',
    debut: a.start_time || '',
    fin: a.end_time || '',
    duree_min: a.duration_minutes || '',
    titre: a.title || '',
    description: a.description || '',
    type: a.slot_type || '',
    lieu: (a.location_type === 'sur_stand' || a.location_type === 'stand') ? 'Sur le stand' : 'Zone de démonstration',
    statut: a.status || '',
  }));
  downloadCSV(`animations-${new Date().toISOString().slice(0, 10)}.csv`, simplified);
}

// 📦 Export complet en ZIP — Exposants + Cautions + Animations + Satisfaction
export async function exportAllZIP({ exposants, cautions, animations, satisfaction }) {
  const JSZipMod = (await import('jszip')).default;
  const zip = new JSZipMod();

  const ts = new Date().toISOString().slice(0, 10);
  const csvOf = (rows) => {
    if (!rows?.length) return '';
    const keys = Array.from(rows.reduce((s, r) => { Object.keys(r).forEach(k => s.add(k)); return s; }, new Set()));
    const esc = (v) => {
      if (v === null || v === undefined) return '';
      const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
    };
    return '\ufeff' + [keys.join(','), ...rows.map(r => keys.map(k => esc(r[k])).join(','))].join('\n');
  };

  if (exposants?.length) {
    zip.file(`exposants-${ts}.csv`, csvOf(exposants.map(r => ({
      exposant: r.organization?.name, discipline: r.organization?.discipline,
      priorité: r.organization?.priority_level, contact: r.organization?.contact_name,
      email: r.organization?.main_email, téléphone: r.organization?.main_phone,
      site: r.venue?.name, stand: r.stand_code, statut: r.status,
      convention_signée: r.is_convention_signed ? 'oui' : 'non',
      caution: r.deposit?.status, animation: r.animation_type,
      vendredi: r.friday_slot_label || '', samedi: r.saturday_slot_label || '',
      complétion: `${r.completion_percent || 0}%`,
    }))));
  }
  if (cautions?.length) {
    zip.file(`cautions-${ts}.csv`, csvOf(cautions.map(r => ({
      exposant: r.organization?.name, site: r.venue?.name, stand: r.stand_code,
      statut_caution: r.deposit?.status, montant_xpf: r.deposit?.amount_xpf || 20000,
      mode_paiement: r.deposit?.deposit_mode || '', reference: r.deposit?.reference || '',
      recu_le: r.deposit?.received_at ? new Date(r.deposit.received_at).toLocaleDateString('fr-FR') : '',
      email: r.organization?.main_email,
    }))));
  }
  if (animations?.length) {
    zip.file(`animations-${ts}.csv`, csvOf(animations.map(a => ({
      exposant: a.organization_name || '', site: a.venue_name || '', stand: a.stand_code || '',
      jour: a.day_label || '', date: a.event_date || '',
      debut: a.start_time || '', fin: a.end_time || '', duree_min: a.duration_minutes || '',
      titre: a.title || '', description: a.description || '',
      lieu: (a.location_type === 'sur_stand' || a.location_type === 'stand') ? 'Sur le stand' : 'Zone de démonstration',
      statut: a.status || '',
    }))));
  }
  if (satisfaction?.length) {
    zip.file(`satisfaction-${ts}.csv`, csvOf(satisfaction.map(r => ({
      exposant: r.organization_name, site: r.venue_name, stand: r.stand_code,
      note_globale: r.overall_rating, organisation: r.organization_rating,
      stand: r.stand_rating, visiteurs: r.visitors_rating, communication: r.communication_rating,
      nps: r.nps_score, participation_prochaine: r.will_participate_next,
      points_positifs: r.positive_points, points_amelioration: r.improvement_points,
      commentaire: r.free_comment,
      soumis_le: r.submitted_at ? new Date(r.submitted_at).toLocaleString('fr-FR') : '',
    }))));
  }

  zip.file('README.txt', [
    'Forum de la Rentrée 2026 — Export Pacific Centers',
    `Généré le : ${new Date().toLocaleString('fr-FR')}`,
    `Exposants : ${exposants?.length || 0}`,
    `Cautions : ${cautions?.length || 0}`,
    `Animations : ${animations?.length || 0}`,
    `Satisfaction : ${satisfaction?.length || 0}`,
  ].join('\n'));

  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Export_Pacific_Centers_${ts}.zip`;
  a.click();
  URL.revokeObjectURL(url);
}

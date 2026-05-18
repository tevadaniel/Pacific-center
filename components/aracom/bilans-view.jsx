'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Sparkles, FileText, Trash2, Eye } from 'lucide-react';
import { api } from '@/lib/auth-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import CautionAppointmentsAdminPanel from './caution-appointments-panel';

/**
 * BILANS VIEW — Génération + visualisation des bilans (site / global / exposant).
 *
 * Endpoints :
 *  - GET    /api/reports
 *  - GET    /api/venues
 *  - POST   /api/reports/generate
 *  - PUT    /api/reports/:id  (partage Pacific)
 *  - DELETE /api/reports/:id
 */
export default function BilansView() {
  const [reports, setReports] = useState([]);
  const [venues, setVenues] = useState([]);
  const [venueId, setVenueId] = useState('');
  const [eventDate, setEventDate] = useState('2026-08-14');
  const load = () => api('/api/reports').then(setReports);
  useEffect(() => { load(); api('/api/venues').then(setVenues); }, []);
  const genSite = async () => {
    if (!venueId) return toast.error('Choisir un site');
    await api('/api/reports/generate', { method: 'POST', body: JSON.stringify({ scope: 'bilan_site', venue_id: venueId, event_date: eventDate }) });
    toast.success('Bilan site généré'); load();
  };
  const genGlobal = async () => {
    await api('/api/reports/generate', { method: 'POST', body: JSON.stringify({ scope: 'bilan_global' }) });
    toast.success('Bilan global généré'); load();
  };
  return (
    <div className="space-y-4">
      {/* 🗓️ RDV restitution caution — Section dédiée */}
      <CautionAppointmentsAdminPanel />

      <Card>
        <CardHeader><CardTitle className="text-base">Générateur de bilans automatique</CardTitle></CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-4">
          <div className="border rounded-md p-4">
            <div className="font-medium mb-2">Bilan par site</div>
            <div className="flex gap-2 mb-2">
              <Select value={venueId} onValueChange={setVenueId}><SelectTrigger><SelectValue placeholder="Choisir un site" /></SelectTrigger><SelectContent>{venues.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent></Select>
              <Select value={eventDate} onValueChange={setEventDate}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="2026-08-14">Ven 14/08</SelectItem><SelectItem value="2026-08-15">Sam 15/08</SelectItem></SelectContent></Select>
            </div>
            <Button className="gap-2" onClick={genSite}><Sparkles className="w-4 h-4" /> Générer bilan site</Button>
          </div>
          <div className="border rounded-md p-4">
            <div className="font-medium mb-2">Bilan global consolidé</div>
            <p className="text-xs text-slate-500 mb-3">Agrège tous les sites et toutes les dates.</p>
            <Button className="gap-2" onClick={genGlobal}><Sparkles className="w-4 h-4" /> Générer bilan global</Button>
          </div>
        </CardContent>
      </Card>
      <Card><CardContent className="p-0">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b text-left text-xs uppercase text-slate-500"><tr><th className="py-2 px-4">Type</th><th>Portée</th><th>Statut</th><th>Généré le</th><th>Partage Pacific</th><th></th><th></th></tr></thead>
          <tbody className="divide-y">
            {reports.map(r => (
              <tr key={r.id}>
                <td className="py-2 px-4 font-medium">{r.report_type}</td>
                <td className="text-xs text-slate-600">{r.report_data_json?.site || r.report_data_json?.exposant || 'Global'}</td>
                <td><Badge variant={r.report_status === 'valide' ? 'default' : 'secondary'} className={r.report_status === 'valide' ? 'bg-emerald-600' : ''}>{r.report_status}</Badge></td>
                <td className="text-xs text-slate-500">{new Date(r.generated_at).toLocaleString('fr-FR')}</td>
                <td>
                  <Button
                    size="sm"
                    variant={r.shared_with_pacific ? 'default' : 'outline'}
                    className={r.shared_with_pacific ? 'bg-cyan-600 hover:bg-cyan-700 gap-1' : 'gap-1 border-cyan-300 text-cyan-700 hover:bg-cyan-50'}
                    onClick={async () => {
                      const newVal = !r.shared_with_pacific;
                      try {
                        await api(`/api/reports/${r.id}`, { method: 'PUT', body: JSON.stringify({ shared_with_pacific: newVal }) });
                        toast.success(newVal ? '✅ Bilan partagé avec Pacific Centers' : '🔒 Bilan retiré du partage Pacific');
                        load();
                      } catch (e) { toast.error(e.message); }
                    }}
                  >
                    {r.shared_with_pacific ? <><Eye className="w-3 h-3" /> Partagé</> : <><Eye className="w-3 h-3" /> Partager</>}
                  </Button>
                </td>
                <td className="pr-2"><Button size="sm" variant="outline" onClick={() => openReport(r)}><FileText className="w-3 h-3 mr-1" /> Voir / PDF</Button></td>
                <td className="pr-4">
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-red-300 text-red-700 hover:bg-red-50 gap-1"
                    onClick={async () => {
                      const portee = r.report_data_json?.site || r.report_data_json?.exposant || 'Global';
                      if (!confirm(`Supprimer définitivement ce bilan ?\n\n• Type : ${r.report_type}\n• Portée : ${portee}\n• Généré le : ${new Date(r.generated_at).toLocaleString('fr-FR')}\n\nCette action est irréversible.`)) return;
                      try {
                        await api(`/api/reports/${r.id}`, { method: 'DELETE' });
                        toast.success('🗑️ Bilan supprimé');
                        load();
                      } catch (e) { toast.error(e.message); }
                    }}
                  >
                    <Trash2 className="w-3 h-3" /> Supprimer
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent></Card>
    </div>
  );
}

function openReport(r) {
  const w = window.open('', '_blank');
  if (!w) return;
  const data = r.report_data_json || {};
  const type = r.report_type;
  const generatedAt = new Date(r.generated_at).toLocaleString('fr-FR');

  // Helpers for PDF-ready HTML
  const num = (n) => (typeof n === 'number' ? n.toLocaleString('fr-FR') : (n ?? '—'));
  const pct = (n) => (n == null ? '—' : n + '%');
  const rating = (n) => {
    if (n == null) return '—';
    const stars = '★'.repeat(Math.round(n)) + '☆'.repeat(5 - Math.round(n));
    return `<span style="color:#f59e0b">${stars}</span> <span style="color:#64748b">${n}/5</span>`;
  };
  const kpi = (label, val, hint) => `<div class="kpi"><div class="kpi-label">${label}</div><div class="kpi-value">${val}</div>${hint ? `<div class="kpi-hint">${hint}</div>` : ''}</div>`;
  const section = (title, body) => `<section><h3>${title}</h3>${body}</section>`;
  const table = (headers, rows) => `<table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${c}}</td>`).join('')}</tr>`).join('')}</tbody></table>`.replace(/\}\}/g,'}');

  let titleLabel = 'Bilan', subtitle = '', kpis = '', body = '';

  if (type === 'bilan_global') {
    titleLabel = 'Bilan Global — Forum de la Rentrée 2026';
    subtitle = data.dates || '14 & 15 août 2026';
    kpis = [
      kpi('Sites', num(data.venues_count), 'sites actifs'),
      kpi('Exposants', num(data.total_exposants), `${num(data.total_confirmed)} confirmés`),
      kpi('Taux présence', data.total_sessions ? Math.round((data.total_present/data.total_sessions)*100)+'%' : '—', `${num(data.total_present)}/${num(data.total_sessions)}`),
      kpi('Cautions', (data.cautions?.xpf_encaisse || 0).toLocaleString('fr-FR')+' XPF', `${num(data.cautions?.recues)}/${num(data.cautions?.attendues)}`),
      kpi('Anomalies', num(data.total_anomalies), 'signalées'),
      kpi('NPS Satisfaction', data.satisfaction?.nps ?? '—', `${num(data.satisfaction?.total_responses)} réponses`),
    ].join('');
    const byStatus = Object.entries(data.by_status || {}).map(([k,v])=>`<tr><td>${k}</td><td style="text-align:right"><b>${v}</b></td></tr>`).join('');
    const bySiteRows = (data.by_site || []).map(s => `<tr><td>${s.site}</td><td style="text-align:center">${s.exposants}</td><td style="text-align:center">${s.confirmes}</td><td style="text-align:center">${s.anomalies}</td><td style="text-align:center">${s.satisfaction_responses || 0}</td><td style="text-align:center">${s.satisfaction_avg ? s.satisfaction_avg.toFixed(1)+'★' : '—'}</td></tr>`).join('');
    const anoSev = Object.entries(data.anomalies_by_severity || {}).map(([k,v])=>`<tr><td>${k}</td><td style="text-align:right"><b>${v}</b></td></tr>`).join('');
    const sat = data.satisfaction || {};
    const satBody = sat.total_responses > 0 ? `
      <div class="grid2">
        <div><b>Répartition participation prochaine édition</b>
          <ul>
            <li>✅ Oui : ${sat.will_participate_yes || 0}</li>
            <li>🤔 Peut-être : ${sat.will_participate_maybe || 0}</li>
            <li>❌ Non : ${sat.will_participate_no || 0}</li>
          </ul>
        </div>
        <div><b>Notes moyennes</b>
          <ul>
            <li>Note globale : ${rating(sat.avg_overall)}</li>
            <li>Organisation : ${rating(sat.avg_organization)}</li>
            <li>Stand : ${rating(sat.avg_stand)}</li>
            <li>Visiteurs : ${rating(sat.avg_visitors)}</li>
            <li>Communication : ${rating(sat.avg_communication)}</li>
          </ul>
        </div>
      </div>
      ${sat.top_positives?.length ? `<div style="margin-top:12px"><b>Points positifs remontés</b><ul>${sat.top_positives.map(p=>`<li>« ${p} »</li>`).join('')}</ul></div>` : ''}
      ${sat.top_improvements?.length ? `<div style="margin-top:12px"><b>Points d'amélioration</b><ul>${sat.top_improvements.map(p=>`<li>« ${p} »</li>`).join('')}</ul></div>` : ''}
    ` : '<p style="color:#94a3b8;font-style:italic">Aucun retour exposant reçu.</p>';
    body = `
      ${section('Vue par site', `<table><thead><tr><th>Site</th><th>Exposants</th><th>Confirmés</th><th>Anomalies</th><th>Sat.</th><th>Note moy.</th></tr></thead><tbody>${bySiteRows}</tbody></table>`)}
      ${section('Statuts des dossiers', `<table><tbody>${byStatus}</tbody></table>`)}
      ${section('Situation cautions', `
        <div class="grid3">
          ${kpi('Reçues', num(data.cautions?.recues), `/${num(data.cautions?.attendues)}`)}
          ${kpi('XPF encaissés', (data.cautions?.xpf_encaisse||0).toLocaleString('fr-FR'), 'sur '+(data.cautions?.xpf_attendu||0).toLocaleString('fr-FR'))}
          ${kpi('Taux récupération', pct(data.cautions?.taux_recuperation), '')}
        </div>
      `)}
      ${section('Documents', `
        <div class="grid3">
          ${kpi('Validés', num(data.documents?.valides), `/${num(data.documents?.total)}`)}
          ${kpi('En attente', num(data.documents?.en_attente), '')}
          ${kpi('Refusés', num(data.documents?.refuses), '')}
        </div>
      `)}
      ${anoSev ? section('Anomalies par gravité', `<table><tbody>${anoSev}</tbody></table>`) : ''}
      ${section('Satisfaction exposants', satBody)}
    `;
  } else if (type === 'bilan_site') {
    titleLabel = `Bilan Site — ${data.site || ''}`;
    subtitle = `Journée : ${data.event_date || 'Tout l\'évènement'}`;
    kpis = [
      kpi('Exposants', num(data.exposants_total), `${num(data.exposants_confirmes)} confirmés`),
      kpi('Taux présence', pct(data.taux_presence), `${num(data.present)}/${num(data.expected)}`),
      kpi('Absences', num(data.absent), 'non excusées incluses'),
      kpi('Cautions', num(data.cautions_recues), `${(data.cautions_xpf_encaisse||0).toLocaleString('fr-FR')} XPF`),
      kpi('Anomalies', num(data.anomalies_count), 'signalées'),
      kpi('Satisfaction', data.satisfaction?.avg_overall ? data.satisfaction.avg_overall.toFixed(1)+' ★' : '—', `${num(data.satisfaction?.total_responses)} réponses`),
    ].join('');
    const exposantsRows = (data.exposants || []).map(e => `<tr><td>${e.name || '—'}</td><td>${e.discipline || ''}</td><td style="font-family:monospace">${e.stand || ''}</td><td><span class="badge badge-${e.status}">${e.status}</span></td></tr>`).join('');
    const incidentsRows = (data.incidents_majeurs || []).map(i => `<tr><td>${i.exposant || '—'}</td><td>${i.type}</td><td>${i.title}</td></tr>`).join('');
    const sat = data.satisfaction || {};
    body = `
      ${section('Liste des exposants', `<table><thead><tr><th>Exposant</th><th>Discipline</th><th>Stand</th><th>Statut</th></tr></thead><tbody>${exposantsRows}</tbody></table>`)}
      ${incidentsRows ? section('Incidents majeurs', `<table><thead><tr><th>Exposant</th><th>Type</th><th>Titre</th></tr></thead><tbody>${incidentsRows}</tbody></table>`) : ''}
      ${section('Présence terrain', `
        <div class="grid4">
          ${kpi('Présents', num(data.present))}
          ${kpi('Retardataires', num(data.late))}
          ${kpi('Absents', num(data.absent))}
          ${kpi('Départs anticipés', num(data.early_leave))}
        </div>
      `)}
      ${sat.total_responses ? section('Satisfaction exposants', `
        <div class="grid3">
          ${kpi('Taux réponse', pct(sat.response_rate), `${sat.total_responses} sur ${data.exposants_total}`)}
          ${kpi('Note globale', rating(sat.avg_overall))}
          ${kpi('NPS', sat.nps ?? '—')}
        </div>
        <div class="grid2" style="margin-top:8px">
          ${kpi('Organisation', rating(sat.avg_organization))}
          ${kpi('Stand', rating(sat.avg_stand))}
          ${kpi('Visiteurs', rating(sat.avg_visitors))}
          ${kpi('Communication', rating(sat.avg_communication))}
        </div>
      `) : ''}
    `;
  } else if (type === 'bilan_exposant') {
    titleLabel = `Bilan Exposant — ${data.exposant || ''}`;
    subtitle = `${data.discipline || ''} • ${data.site || ''} • Stand ${data.stand || ''}`;
    kpis = [
      kpi('Statut dossier', data.status || '—', `${data.completion_percent || 0}% complété`),
      kpi('Documents', `${num(data.documents?.validated)}/${num(data.documents?.uploaded)}`, 'validés'),
      kpi('Caution', data.caution?.status || '—', `${num(data.caution?.amount_xpf)} XPF`),
      kpi('Anomalies', num(data.anomalies_count), data.recommended_deposit_action),
    ].join('');
    const sessionsRows = (data.sessions || []).map(s => `<tr><td>${s.date || '—'}</td><td>${s.expected_arrival || '—'}</td><td>${s.actual_arrival || '—'}</td><td><b>${s.presence || '—'}</b></td><td>${s.animation_completed ? '✅' : '—'}</td></tr>`).join('');
    const anoRows = (data.anomalies || []).map(a => `<tr><td>${a.type}</td><td><span class="badge badge-${a.severity}">${a.severity}</span></td><td>${a.title || ''}</td><td>${a.description || ''}</td></tr>`).join('');
    const sat = data.satisfaction;
    body = `
      ${section('Contact', `<table><tbody>
        <tr><th>Nom du contact</th><td>${data.contact_name || '—'}</td></tr>
        <tr><th>Email</th><td>${data.contact_email || '—'}</td></tr>
        <tr><th>Téléphone</th><td>${data.contact_phone || '—'}</td></tr>
      </tbody></table>`)}
      ${sessionsRows ? section('Présence terrain', `<table><thead><tr><th>Date</th><th>Prévu</th><th>Réel</th><th>Statut</th><th>Animation</th></tr></thead><tbody>${sessionsRows}</tbody></table>`) : ''}
      ${anoRows ? section('Anomalies rencontrées', `<table><thead><tr><th>Type</th><th>Gravité</th><th>Titre</th><th>Détail</th></tr></thead><tbody>${anoRows}</tbody></table>`) : ''}
      ${sat ? section('Satisfaction — retour exposant', `
        <div class="grid3">
          ${kpi('Note globale', rating(sat.overall_rating))}
          ${kpi('NPS', sat.nps_score ?? '—')}
          ${kpi('Participation prochaine', sat.will_participate_next === 'oui' ? '✅ Oui' : sat.will_participate_next === 'peut_etre' ? '🤔 Peut-être' : sat.will_participate_next === 'non' ? '❌ Non' : '—')}
        </div>
        <div class="grid4" style="margin-top:8px">
          ${kpi('Organisation', rating(sat.organization_rating))}
          ${kpi('Stand', rating(sat.stand_rating))}
          ${kpi('Visiteurs', rating(sat.visitors_rating))}
          ${kpi('Communication', rating(sat.communication_rating))}
        </div>
        ${sat.positive_points ? `<p style="margin-top:12px"><b>Points positifs :</b> ${sat.positive_points}</p>` : ''}
        ${sat.improvement_points ? `<p><b>Points à améliorer :</b> ${sat.improvement_points}</p>` : ''}
        ${sat.free_comment ? `<p><b>Commentaire :</b> ${sat.free_comment}</p>` : ''}
      `) : '<section><h3>Satisfaction</h3><p style="color:#94a3b8;font-style:italic">Pas encore de retour de l\'exposant.</p></section>'}
      ${section('Recommandation caution', `
        <div style="padding:16px;background:${data.recommended_deposit_action === 'restitution' ? '#d1fae5' : data.recommended_deposit_action === 'retenue_totale' ? '#fee2e2' : '#fef3c7'};border-radius:8px;border-left:4px solid ${data.recommended_deposit_action === 'restitution' ? '#10b981' : data.recommended_deposit_action === 'retenue_totale' ? '#ef4444' : '#f59e0b'};">
          <b>Action recommandée : </b>${data.recommended_deposit_action}
        </div>
      `)}
    `;
  } else {
    body = `<pre>${JSON.stringify(data, null, 2)}</pre>`;
  }

  const logoUrl = `${window.location.origin}/aracom-logo.png`;
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${titleLabel}</title><style>
    @page { margin: 18mm 20mm 28mm 20mm; }
    *{box-sizing:border-box}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Inter',sans-serif;padding:40px;max-width:900px;margin:auto;color:#0f172a;background:#fff;line-height:1.55}
    .magazine-header{display:flex;align-items:center;justify-content:space-between;gap:24px;border-bottom:4px solid #2563eb;padding-bottom:18px;margin-bottom:8px;position:relative}
    .magazine-header::after{content:'';position:absolute;left:0;right:0;bottom:-8px;height:2px;background:linear-gradient(90deg,#2563eb 0%,#7c3aed 50%,#10b981 100%);border-radius:2px}
    .brand{display:flex;align-items:center;gap:14px}
    .brand img{height:64px;width:auto;display:block}
    .brand-block{display:flex;flex-direction:column}
    .brand-block .edition{font-size:11px;text-transform:uppercase;letter-spacing:.18em;color:#64748b;font-weight:600}
    .brand-block .ev-name{font-size:14px;font-weight:700;color:#1e293b;margin-top:2px}
    .meta-block{text-align:right;font-size:11px;color:#64748b;line-height:1.6}
    .meta-block .badge-status{display:inline-block;background:#2563eb;color:#fff;padding:4px 10px;border-radius:14px;font-size:10px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;margin-bottom:4px}
    .doc-title{margin:24px 0 6px;font-size:28px;font-weight:800;color:#0f172a;letter-spacing:-.02em}
    .doc-subtitle{color:#64748b;font-size:14px;margin-bottom:24px;font-style:italic}
    .kpis{display:grid;grid-template-columns:repeat(6,1fr);gap:10px;margin-bottom:28px}
    .kpis.grid3{grid-template-columns:repeat(3,1fr)}.kpis.grid4{grid-template-columns:repeat(4,1fr)}
    .kpi{background:linear-gradient(180deg,#f8fafc 0%,#f1f5f9 100%);border:1px solid #e2e8f0;border-radius:10px;padding:14px;box-shadow:0 1px 2px rgba(15,23,42,.04)}
    .kpi-label{font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:#64748b;font-weight:600}
    .kpi-value{font-size:20px;font-weight:800;color:#0f172a;margin-top:6px;word-break:break-word;letter-spacing:-.01em}
    .kpi-hint{font-size:11px;color:#94a3b8;margin-top:3px}
    .grid2{display:grid;grid-template-columns:1fr 1fr;gap:16px}.grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.grid4{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
    section{margin-bottom:28px;page-break-inside:avoid}
    section h3{font-size:13px;text-transform:uppercase;letter-spacing:.12em;color:#1e293b;margin:0 0 12px;padding-bottom:8px;border-bottom:2px solid #2563eb;font-weight:800;display:inline-block;padding-right:20px}
    table{border-collapse:collapse;width:100%;font-size:12px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden}
    th,td{text-align:left;padding:9px 12px;border-bottom:1px solid #e2e8f0;vertical-align:top}
    tbody tr:nth-child(even){background:#fafbfc}
    th{background:#f1f5f9;font-weight:700;color:#1e293b;font-size:11px;text-transform:uppercase;letter-spacing:.05em}
    .badge{display:inline-block;padding:3px 10px;border-radius:12px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em}
    .badge-confirme{background:#d1fae5;color:#065f46}.badge-a_confirmer{background:#fef3c7;color:#92400e}.badge-a_relancer{background:#fed7aa;color:#9a3412}.badge-prospect{background:#e2e8f0;color:#475569}.badge-haute,.badge-critique{background:#fee2e2;color:#991b1b}.badge-moyenne{background:#fef3c7;color:#92400e}.badge-basse{background:#e0e7ff;color:#3730a3}
    ul{margin:6px 0;padding-left:22px}li{margin:3px 0}
    .footer{margin-top:48px;padding-top:18px;border-top:2px solid #2563eb;font-size:11px;color:#475569;display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap}
    .footer-left{flex:1;min-width:240px}
    .footer-left .signed{font-weight:800;color:#0f172a;font-size:14px;letter-spacing:.01em;margin-bottom:4px}
    .footer-left .role{font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.1em;margin-bottom:6px}
    .footer-left .contact-line{display:flex;align-items:center;gap:8px;flex-wrap:wrap;color:#475569}
    .footer-left .contact-line a{color:#2563eb;text-decoration:none;font-weight:600}
    .footer-left .contact-line .sep{color:#cbd5e1}
    .footer-right{text-align:right;font-size:10px;color:#94a3b8;line-height:1.6}
    .footer-right .conf{display:inline-block;padding:2px 8px;border-radius:8px;background:#fef3c7;color:#92400e;font-weight:700;font-size:9px;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px}
    pre{background:#f1f5f9;padding:14px;border-radius:8px;overflow:auto;font-size:11px;border:1px solid #e2e8f0}
    .print-btn{position:fixed;top:20px;right:20px;padding:10px 20px;border-radius:8px;background:#2563eb;color:#fff;border:0;cursor:pointer;font-weight:700;box-shadow:0 4px 14px rgba(37,99,235,.35);font-size:13px}
    .print-btn:hover{background:#1d4ed8}
    @media print{.print-btn{display:none}body{padding:0}.magazine-header{break-after:avoid}}
  </style></head><body>
    <button class="print-btn" onclick="window.print()">🖨️ Imprimer / PDF</button>
    <div class="magazine-header">
      <div class="brand">
        <img src="${logoUrl}" alt="ARACOM" onerror="this.style.display='none'" />
        <div class="brand-block">
          <span class="edition">Forum de la Rentrée · Édition 2026</span>
          <span class="ev-name">14 & 15 août 2026 · Polynésie française</span>
        </div>
      </div>
      <div class="meta-block">
        <span class="badge-status">${r.report_status}</span><br>
        Généré le<br><b>${generatedAt}</b>
      </div>
    </div>
    <h1 class="doc-title">${titleLabel}</h1>
    <div class="doc-subtitle">${subtitle}</div>
    <div class="kpis ${type === 'bilan_exposant' ? 'grid4' : ''}">${kpis}</div>
    ${body}
    <div class="footer">
      <div class="footer-left">
        <div class="signed">Teva GEROS</div>
        <div class="role">ARACOM Conseil — Organisateur du Forum</div>
        <div class="contact-line">
          <a href="mailto:contact@aracom-conseil.fr">contact@aracom-conseil.fr</a>
          <span class="sep">·</span>
          <a href="tel:+68987210444">+(689) 87 210 444</a>
        </div>
      </div>
      <div class="footer-right">
        <span class="conf">Confidentiel</span><br>
        Document généré par la plateforme<br>
        de pilotage ARACOM Conseil
      </div>
    </div>
  </body></html>`;

  w.document.write(html);
  w.document.close();
}

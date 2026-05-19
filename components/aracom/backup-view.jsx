'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { RefreshCw, Download, MapPin, RotateCcw, CheckCircle2, AlertTriangle, FileText, Eye } from 'lucide-react';
import { api } from '@/lib/auth-client';
import { KpiCard } from '@/components/app-shell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

/**
 * BACKUP VIEW — Sauvegarde complète sur Google Drive + reset édition + restauration plans.
 *
 * Endpoints :
 *  - GET    /api/backups
 *  - GET    /api/drive/info
 *  - POST   /api/backup/export
 *  - POST   /api/admin/restore-venue-layouts
 *  - GET    /api/admin/export-venue-layouts
 *  - POST   /api/admin/reset-for-new-edition
 */
export default function BackupView() {
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [driveInfo, setDriveInfo] = useState(null);
  const [lastBackup, setLastBackup] = useState(null);
  const [layoutBusy, setLayoutBusy] = useState(false);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const [items, info] = await Promise.all([
        api('/api/backups'),
        api('/api/drive/info').catch(() => null),
      ]);
      setHistory(items);
      setDriveInfo(info);
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { loadHistory(); }, []);

  const runBackup = async () => {
    if (busy) return;
    if (!confirm('Lancer une sauvegarde complète de la base et l\'uploader dans votre Google Drive (dossier "Sauvegardes") ?\n\nCette opération peut prendre 10–30 secondes.')) return;
    setBusy(true);
    const toastId = toast.loading('Sauvegarde en cours — export de toutes les collections puis upload Drive…');
    try {
      const res = await api('/api/backup/export', { method: 'POST', body: '{}' });
      toast.dismiss(toastId);
      toast.success('✅ Sauvegarde réussie : ' + res.backup.file_name);
      setLastBackup(res.backup);
      await loadHistory();
    } catch (e) {
      toast.dismiss(toastId);
      toast.error('Erreur : ' + e.message);
    } finally { setBusy(false); }
  };

  const restoreVenueLayouts = async () => {
    if (layoutBusy) return;
    if (!confirm('⚠️ RESTAURATION DES PLANS DE SALLES\n\nCette action va remettre tous les stands et éléments décoratifs aux positions sauvegardées dans le backup embarqué (venue-layouts-backup.json).\n\nLes éléments décoratifs actuels (kiosques, formes, étiquettes) seront ÉCRASÉS par ceux du backup.\n\nContinuer ?')) return;
    setLayoutBusy(true);
    try {
      const r = await api('/api/admin/restore-venue-layouts', { method: 'POST', body: JSON.stringify({}) });
      toast.success(`✅ Plans restaurés : ${r.stands} stands + ${r.elements} éléments décoratifs`);
    } catch (e) { toast.error('Erreur : ' + e.message); }
    finally { setLayoutBusy(false); }
  };

  const downloadCurrentLayout = async () => {
    try {
      const data = await api('/api/admin/export-venue-layouts');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `venue-layouts-${new Date().toISOString().slice(0,10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('✅ Export téléchargé');
    } catch (e) { toast.error('Erreur : ' + e.message); }
  };

  const formatSize = (b) => {
    if (b < 1024) return b + ' o';
    if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' Ko';
    return (b / 1024 / 1024).toFixed(2) + ' Mo';
  };

  return (
    <div className="space-y-4">
      {/* 🚨 Reset pour nouvelle édition */}
      <Card className="border-2 border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50">
        <CardContent className="p-5 flex items-start gap-4 flex-wrap">
          <div className="w-16 h-16 rounded-lg bg-white shadow-md flex items-center justify-center shrink-0">
            <RefreshCw className="w-8 h-8 text-orange-600" />
          </div>
          <div className="flex-1 min-w-[280px]">
            <h2 className="font-bold text-orange-900 text-lg">🚨 Reset pour une nouvelle édition</h2>
            <p className="text-sm text-orange-800 mt-1">
              Remet <b>tous les exposants</b> au statut <b>&quot;à relancer&quot;</b>, <b>détache les stands</b> (plans vierges), décoche les flags convention/assurance/guide et archive les documents passés. Les exposants devront renvoyer leurs documents pour finaliser leur inscription.
            </p>
            <p className="text-xs text-orange-700 mt-1 italic">
              ✅ <b>Conservé</b> : organisations, <b>positions des stands sur le plan</b> (kiosques, stands visuels), cautions passées, notes internes, animations, historique complet dans les profils.
            </p>
          </div>
          <Button
            size="lg"
            onClick={async () => {
              const answer = window.prompt('⚠️ Cette action est IRRÉVERSIBLE.\n\nPour confirmer, tapez exactement :\nRESET-NOUVELLE-EDITION-2026\n\n(Les documents existants seront archivés, les flags décochés, les 68 exposants remis à "à relancer".)');
              if (answer !== 'RESET-NOUVELLE-EDITION-2026') { if (answer !== null) toast.error('Confirmation incorrecte'); return; }
              try {
                const r = await api('/api/admin/reset-for-new-edition', { method: 'POST', body: JSON.stringify({ confirm: 'RESET-NOUVELLE-EDITION-2026' }) });
                toast.success(r.message || '✅ Reset effectué');
              } catch (e) { toast.error(e.message); }
            }}
            className="bg-orange-600 hover:bg-orange-700 gap-2 shadow-md"
          >
            <RefreshCw className="w-5 h-5" /> Reset pour nouvelle édition
          </Button>
        </CardContent>
      </Card>

      {/* Intro + Drive info */}
      <Card className="border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50">
        <CardContent className="p-5 flex items-start gap-4 flex-wrap">
          <div className="w-16 h-16 rounded-lg bg-white shadow-md flex items-center justify-center shrink-0">
            <Download className="w-8 h-8 text-emerald-600" />
          </div>
          <div className="flex-1 min-w-[280px]">
            <h2 className="font-bold text-emerald-900 text-lg">Sauvegarde complète sur Google Drive</h2>
            <p className="text-sm text-emerald-800 mt-1">
              Exportez l&apos;intégralité des données de la plateforme (exposants, stands, cautions, animations, documents, mailing, etc.) dans un seul fichier JSON, stocké automatiquement dans votre Google Drive connecté, dossier <b>Sauvegardes/</b>.
            </p>
            {driveInfo?.configured && driveInfo?.ok && (
              <div className="mt-2 text-[11px] text-emerald-700 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" /> Drive connecté — dossier racine : <b>{driveInfo.folder_name}</b>
              </div>
            )}
            {driveInfo && !driveInfo.configured && (
              <div className="mt-2 text-[11px] text-rose-700 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" /> Drive non configuré — la sauvegarde ne fonctionnera pas.
              </div>
            )}
          </div>
          <Button
            size="lg"
            onClick={runBackup}
            disabled={busy || !driveInfo?.configured}
            className="bg-emerald-600 hover:bg-emerald-700 gap-2 shadow-md"
          >
            {busy ? <><RefreshCw className="w-5 h-5 animate-spin" /> Sauvegarde en cours…</> : <><Download className="w-5 h-5" /> Sauvegarder maintenant</>}
          </Button>
        </CardContent>
      </Card>

      {/* 🛟 Restauration des plans après redéploiement */}
      <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50">
        <CardContent className="p-5 space-y-3">
          <div className="flex items-start gap-4 flex-wrap">
            <div className="w-16 h-16 rounded-lg bg-white shadow-md flex items-center justify-center shrink-0">
              <MapPin className="w-8 h-8 text-blue-600" />
            </div>
            <div className="flex-1 min-w-[280px]">
              <h2 className="font-bold text-blue-900 text-lg">🛟 Plans de salles — Restauration après déploiement</h2>
              <p className="text-sm text-blue-800 mt-1">
                Après un <b>redéploiement</b>, la base de production peut être vide. Utilisez ce bouton pour <b>restaurer en un clic</b> toutes les positions des stands + éléments décoratifs depuis le <b>backup embarqué dans le code</b> (versionné avec l&apos;app).
              </p>
              <p className="text-xs text-blue-700 mt-1 italic">
                💡 La restauration automatique tourne déjà au premier démarrage si la DB est vide. Ce bouton est là au cas où vous voulez forcer la remise à zéro vers le dernier backup figé.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Button size="lg" onClick={restoreVenueLayouts} disabled={layoutBusy} className="bg-blue-600 hover:bg-blue-700 gap-2 shadow-md">
                {layoutBusy ? <><RefreshCw className="w-5 h-5 animate-spin" /> Restauration…</> : <><RotateCcw className="w-5 h-5" /> Restaurer les plans</>}
              </Button>
              <Button size="sm" variant="outline" onClick={downloadCurrentLayout} className="border-blue-300 text-blue-700 hover:bg-blue-100 gap-1.5">
                <Download className="w-4 h-4" /> Télécharger l&apos;état actuel (JSON)
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 🆕 SESSION 45 — Template exhaustif de la base de données (pour fusion / import) */}
      <Card className="border-2 border-violet-200 bg-gradient-to-br from-violet-50 to-fuchsia-50">
        <CardContent className="p-5 flex items-start gap-4 flex-wrap">
          <div className="w-16 h-16 rounded-lg bg-white shadow-md flex items-center justify-center shrink-0">
            <FileText className="w-8 h-8 text-violet-600" />
          </div>
          <div className="flex-1 min-w-[280px]">
            <h2 className="font-bold text-violet-900 text-lg">📦 Template exhaustif de la base de données</h2>
            <p className="text-sm text-violet-800 mt-1">
              Téléchargez un <b>ZIP</b> contenant la structure complète de la DB avec <b>tous les champs documentés</b> :
              squelettes JSON vides à remplir, CSV vierges (un par collection) pour Excel/Sheets, documentation Markdown détaillée et schéma JSON machine-readable.
            </p>
            <p className="text-xs text-violet-700 mt-1 italic">
              💡 Idéal pour <b>fusionner vos données existantes</b> avec celles de la plateforme : préparez vos fichiers selon le template, puis importez-les.
            </p>
          </div>
          <div className="flex flex-col gap-2 shrink-0">
            <a href="/api/admin/db-template" download>
              <Button size="lg" className="bg-violet-600 hover:bg-violet-700 gap-2 shadow-md w-full">
                <Download className="w-5 h-5" /> Télécharger le template DB (ZIP)
              </Button>
            </a>
            <a href="/api/admin/db-template?samples=0" download>
              <Button size="sm" variant="outline" className="border-violet-300 text-violet-700 hover:bg-violet-100 gap-1.5 w-full">
                <Download className="w-4 h-4" /> Version vide (sans exemples)
              </Button>
            </a>
          </div>
        </CardContent>
      </Card>

      {lastBackup && (
        <Card className="border-2 border-emerald-300 bg-emerald-50">
          <CardContent className="p-4 flex items-start gap-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="font-bold text-emerald-900">Dernière sauvegarde créée avec succès ✨</div>
              <div className="text-sm text-emerald-800 mt-1">
                <b>{lastBackup.file_name}</b> · {formatSize(lastBackup.size_bytes)} · {lastBackup.documents_total} documents sur {lastBackup.collections_count} collections
                {lastBackup.zip && <> · <b>+ ZIP documents</b> ({lastBackup.zip.documents_count} fichiers, {formatSize(lastBackup.zip.size_bytes)})</>}
              </div>
              <div className="mt-2 flex gap-2 flex-wrap">
                {lastBackup.drive_view_link && (
                  <a href={lastBackup.drive_view_link} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" variant="outline" className="gap-1.5 border-emerald-400 text-emerald-700 hover:bg-emerald-100">
                      <Eye className="w-3.5 h-3.5" /> Ouvrir JSON
                    </Button>
                  </a>
                )}
                {lastBackup.drive_download_link && (
                  <a href={lastBackup.drive_download_link} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" variant="outline" className="gap-1.5 border-emerald-400 text-emerald-700 hover:bg-emerald-100">
                      <Download className="w-3.5 h-3.5" /> JSON
                    </Button>
                  </a>
                )}
                {lastBackup.zip?.drive_view_link && (
                  <a href={lastBackup.zip.drive_view_link} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" variant="outline" className="gap-1.5 border-violet-400 text-violet-700 hover:bg-violet-100">
                      <FileText className="w-3.5 h-3.5" /> Ouvrir ZIP docs
                    </Button>
                  </a>
                )}
                {lastBackup.zip?.drive_download_link && (
                  <a href={lastBackup.zip.drive_download_link} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" variant="outline" className="gap-1.5 border-violet-400 text-violet-700 hover:bg-violet-100">
                      <Download className="w-3.5 h-3.5" /> ZIP
                    </Button>
                  </a>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Sauvegardes totales" value={history.length} accent="emerald" icon={Download} />
        <KpiCard label="Dernière sauvegarde" value={history[0] ? new Date(history[0].created_at).toLocaleDateString('fr-FR') : '—'} accent="blue" />
        <KpiCard label="Volume total" value={formatSize(history.reduce((s, h) => s + (h.size_bytes || 0), 0))} accent="violet" />
        <KpiCard label="Docs. dernière sauv." value={history[0]?.documents_total || 0} accent="orange" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-4 h-4 text-emerald-600" /> Historique des sauvegardes
          </CardTitle>
          <p className="text-xs text-slate-500">Toutes les sauvegardes sont stockées dans votre Google Drive sous <code>Sauvegardes/</code>. La liste ci-dessous affiche les 50 plus récentes.</p>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-8 text-center text-slate-500">Chargement…</div>
          ) : history.length === 0 ? (
            <div className="py-8 text-center text-slate-500">Aucune sauvegarde pour l&apos;instant. Cliquez sur <b>Sauvegarder maintenant</b> pour créer la première.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-y text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-2 px-4">Fichier</th>
                  <th>Date</th>
                  <th>Collections</th>
                  <th>Documents</th>
                  <th>Taille</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {history.map(h => (
                  <tr key={h.id}>
                    <td className="py-2 px-4 font-mono text-xs break-all">{h.file_name}</td>
                    <td className="text-xs text-slate-600">{new Date(h.created_at).toLocaleString('fr-FR')}</td>
                    <td className="text-center"><Badge variant="secondary">{h.collections_count}</Badge></td>
                    <td className="text-center"><Badge variant="secondary">{h.documents_total}</Badge></td>
                    <td className="text-xs text-slate-600">{formatSize(h.size_bytes)}</td>
                    <td className="space-x-1.5 py-2 pr-4">
                      {h.drive_view_link && (
                        <a href={h.drive_view_link} target="_blank" rel="noopener noreferrer">
                          <Button size="sm" variant="outline" className="gap-1 h-7"><Eye className="w-3 h-3" /> Drive</Button>
                        </a>
                      )}
                      {h.drive_download_link && (
                        <a href={h.drive_download_link} target="_blank" rel="noopener noreferrer">
                          <Button size="sm" variant="outline" className="gap-1 h-7"><Download className="w-3 h-3" /> JSON</Button>
                        </a>
                      )}
                      {h.zip?.drive_download_link && (
                        <a href={h.zip.drive_download_link} target="_blank" rel="noopener noreferrer">
                          <Button size="sm" variant="outline" className="gap-1 h-7 border-violet-300 text-violet-700"><FileText className="w-3 h-3" /> ZIP ({h.zip.documents_count})</Button>
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card className="bg-amber-50 border-amber-200">
        <CardContent className="p-4 flex items-start gap-3 text-sm">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-amber-900">
            <b>À propos du format :</b> chaque sauvegarde produit <b>2 fichiers</b> dans votre Drive (dossier <code>Sauvegardes/</code>) :
            <ul className="list-disc pl-5 mt-1 space-y-0.5">
              <li><b>.json</b> → toutes les collections MongoDB (exposants, stands, cautions, mailing, etc.) — lisible tel quel, idéal pour restauration ou audit.</li>
              <li><b>.zip</b> → tous les documents PDF/reçus (cautions, conventions…) regroupés par type, pour consultation rapide sans décoder le base64. Contient aussi une copie du JSON pour archive unique.</li>
            </ul>
            <div className="mt-2">Les photos/vidéos Jour J restent dans leur dossier Drive dédié — la sauvegarde contient leurs métadonnées et liens uniquement.</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

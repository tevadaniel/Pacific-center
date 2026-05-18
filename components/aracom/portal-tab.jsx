'use client';

/**
 * 🔗 PortalTab — Aperçu et gestion du portail exposant (Cockpit ARACOM)
 *
 * - Magic-link generation et copie
 * - Boutons : Copier, Ouvrir dans nouvel onglet, Envoyer par mail, Régénérer
 * - Preview "Ce que voit l'exposant" avec liens vers chaque section du portail
 * - Infos accès & sécurité (dernier accès, expiration token)
 */

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  ExternalLink, Copy, Mail, RefreshCw, Eye, Clock, Shield, Bell, BellOff,
  CheckCircle2, AlertCircle, Loader2, FileText, Receipt, Award,
} from 'lucide-react';
import { api } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function PortalTab({ registration, organization, documents = [] }) {
  const [portalInfo, setPortalInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const reg = registration || {};
  const org = organization || {};

  const loadPortal = async () => {
    if (!reg.id) return;
    setLoading(true);
    try {
      const r = await api(`/api/registrations/${reg.id}/access-link`);
      setPortalInfo(r);
    } catch (e) {
      console.error('[portal-tab] error', e?.message);
      setPortalInfo({ url: null });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadPortal(); }, [reg.id]);

  const url = portalInfo?.url || portalInfo?.link;
  const expiresAt = portalInfo?.expires_at;
  const lastAccess = portalInfo?.last_access_at || reg.portal_last_access;

  const copyLink = async () => {
    if (!url) { toast.error('Lien indisponible'); return; }
    try {
      await navigator.clipboard.writeText(url);
      toast.success('📋 Lien copié dans le presse-papiers');
    } catch (e) { toast.error('Impossible de copier'); }
  };

  const openPortal = () => {
    if (!url) { toast.error('Lien indisponible'); return; }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const sendByMail = async () => {
    if (!org.main_email) { toast.error('Aucun email exposant'); return; }
    setSending(true);
    try {
      await api(`/api/registrations/${reg.id}/send-access-link`, { method: 'POST' });
      toast.success('📧 Lien envoyé à ' + org.main_email);
    } catch (e) {
      toast.error(e.message || 'Erreur envoi mail');
    } finally { setSending(false); }
  };

  const regenerate = async () => {
    if (!confirm('Régénérer le lien révoquera l\'ancien token. Continuer ?')) return;
    setRegenerating(true);
    try {
      await api(`/api/registrations/${reg.id}/regenerate-token`, { method: 'POST' });
      toast.success('✅ Nouveau lien généré');
      await loadPortal();
    } catch (e) {
      toast.error(e.message || 'Erreur régénération');
    } finally { setRegenerating(false); }
  };

  const openSection = (path) => {
    if (!url) return;
    try {
      const u = new URL(url, window.location.origin);
      u.searchParams.set('section', path);
      window.open(u.toString(), '_blank', 'noopener,noreferrer');
    } catch {
      window.open(url, '_blank');
    }
  };

  // Format dates
  const fmtDate = (d) => d ? new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
  const daysUntilExpiry = expiresAt ? Math.round((new Date(expiresAt) - new Date()) / (1000 * 60 * 60 * 24)) : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ════════ Lien magique ════════ */}
      <div className="rounded-xl border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-white p-4">
        <div className="flex items-center gap-2 mb-2">
          <ExternalLink className="w-4 h-4 text-blue-600" />
          <h3 className="font-bold text-sm text-slate-900">Lien magique exposant</h3>
          <Badge className="bg-blue-100 text-blue-700 border-blue-300 text-[9px]">JWT</Badge>
        </div>

        {url ? (
          <>
            <div className="bg-white border border-slate-200 rounded-md px-3 py-2 mb-3 text-[11px] font-mono text-slate-700 break-all">
              {url}
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Button size="sm" onClick={copyLink} className="h-7 text-[11px] gap-1 bg-blue-600 hover:bg-blue-700 text-white">
                <Copy className="w-3 h-3" /> Copier
              </Button>
              <Button size="sm" variant="outline" onClick={openPortal} className="h-7 text-[11px] gap-1">
                <ExternalLink className="w-3 h-3" /> Ouvrir le portail ↗
              </Button>
              <Button size="sm" variant="outline" onClick={sendByMail} disabled={sending || !org.main_email} className="h-7 text-[11px] gap-1">
                {sending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Mail className="w-3 h-3" />} Envoyer par mail
              </Button>
              <Button size="sm" variant="outline" onClick={regenerate} disabled={regenerating} className="h-7 text-[11px] gap-1 text-amber-700 border-amber-300 hover:bg-amber-50">
                {regenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />} Régénérer
              </Button>
            </div>
          </>
        ) : (
          <div className="text-center py-4">
            <AlertCircle className="w-5 h-5 text-amber-500 mx-auto mb-1" />
            <div className="text-xs text-slate-600 mb-2">Aucun lien généré pour cet exposant</div>
            <Button size="sm" onClick={regenerate} disabled={regenerating} className="h-7 text-[11px] gap-1">
              {regenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />} Générer un lien
            </Button>
          </div>
        )}
      </div>

      {/* ════════ Aperçu : ce que voit l'exposant ════════ */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center gap-2 mb-3">
          <Eye className="w-4 h-4 text-slate-700" />
          <h3 className="font-bold text-sm text-slate-900">Ce que voit l'exposant</h3>
          <span className="text-[10px] text-slate-500 italic">— Cliquez "Vue exposant ↗" pour vérifier en direct</span>
        </div>

        <div className="space-y-1.5 text-xs">
          {/* Résumé inscription */}
          <PortalRow
            icon={CheckCircle2}
            iconColor="text-emerald-600"
            title="Résumé inscription"
            subtitle={`${reg.status === 'confirme' ? '✓ Confirmé' : '⏱ ' + (reg.status || 'a_confirmer')} · Stand ${reg.stand_code || '—'}`}
            onView={() => openSection('resume')}
          />
          {/* Convention */}
          <PortalRow
            icon={FileText}
            iconColor="text-blue-600"
            title="Convention de participation"
            subtitle={reg.is_convention_signed ? 'Signée par l\'exposant' : 'Doit être signée'}
            onView={() => openSection('convention')}
          />
          {/* Reçu de caution */}
          <PortalRow
            icon={Receipt}
            iconColor="text-amber-600"
            title="Reçu de caution"
            subtitle={reg.caution_received_date ? 'Reçu disponible' : 'En attente d\'encaissement'}
            onView={() => openSection('recu')}
          />
          {/* Attestation remboursement */}
          <PortalRow
            icon={Award}
            iconColor="text-violet-600"
            title="Attestation de remboursement"
            subtitle={reg.restitution_status === 'restituee' ? 'Disponible' : 'Sera générée après restitution'}
            onView={() => openSection('remboursement')}
          />
          {/* Documents à uploader */}
          <PortalRow
            icon={Shield}
            iconColor="text-emerald-600"
            title="Mes documents à fournir"
            subtitle="Assurance · Pièce d'identité · Immatriculation"
            onView={() => openSection('documents')}
          />
        </div>
      </div>

      {/* ════════ Infos accès & sécurité ════════ */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-center gap-2 mb-2">
          <Shield className="w-4 h-4 text-slate-600" />
          <h3 className="font-bold text-sm text-slate-900">Accès & sécurité</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
          <div className="bg-white rounded-md border border-slate-200 px-3 py-2">
            <div className="text-[10px] text-slate-500 uppercase">Dernier accès</div>
            <div className="font-medium text-slate-900 flex items-center gap-1 mt-0.5">
              <Clock className="w-3 h-3 text-slate-400" />
              {fmtDate(lastAccess)}
            </div>
          </div>
          <div className="bg-white rounded-md border border-slate-200 px-3 py-2">
            <div className="text-[10px] text-slate-500 uppercase">Validité token</div>
            <div className={`font-medium flex items-center gap-1 mt-0.5 ${
              daysUntilExpiry !== null && daysUntilExpiry < 7 ? 'text-amber-700' : 'text-slate-900'
            }`}>
              <Clock className="w-3 h-3 text-slate-400" />
              {expiresAt ? `${fmtDate(expiresAt)} (${daysUntilExpiry}j)` : 'Permanent'}
            </div>
          </div>
          <div className="bg-white rounded-md border border-slate-200 px-3 py-2">
            <div className="text-[10px] text-slate-500 uppercase">Notifications</div>
            <div className="font-medium text-slate-900 flex items-center gap-1 mt-0.5">
              {reg.portal_notifications !== false ? (
                <><Bell className="w-3 h-3 text-emerald-500" /> Activées</>
              ) : (
                <><BellOff className="w-3 h-3 text-slate-400" /> Désactivées</>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PortalRow({ icon: Icon, iconColor, title, subtitle, onView }) {
  return (
    <div className="flex items-center gap-2 py-2 px-2 hover:bg-slate-50 rounded-md transition">
      <Icon className={`w-4 h-4 shrink-0 ${iconColor}`} />
      <div className="flex-1 min-w-0">
        <div className="font-medium text-slate-900 truncate">{title}</div>
        <div className="text-[10px] text-slate-500 truncate">{subtitle}</div>
      </div>
      <Button size="sm" variant="outline" onClick={onView} className="h-6 text-[10px] gap-1 shrink-0">
        <Eye className="w-3 h-3" /> Vue exposant ↗
      </Button>
    </div>
  );
}

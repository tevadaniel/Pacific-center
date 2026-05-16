'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { KeyRound, Send, Plus, Eye, Ban, FileText, XCircle, CheckCircle2 } from 'lucide-react';
import AiInsightTrigger from '@/components/ai-insight-trigger';
import { api } from '@/lib/auth-client';
import { KpiCard } from '@/components/app-shell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

/**
 * ACCESS TOKENS VIEW — Gestion des liens magiques (exposants + Pacific Centers + inscriptions).
 *
 * Endpoints :
 *  - GET    /api/access-tokens
 *  - POST   /api/access-tokens                  (création)
 *  - POST   /api/access-tokens/:id/revoke
 *  - POST   /api/access-tokens/:id/resend
 *  - POST   /api/access-tokens/revoke-all       (révocation groupée)
 */
export default function AccessTokensView() {
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('actifs');
  const [showCreate, setShowCreate] = useState(null); // 'access' | 'inscription' | 'pacific' | 'new_exposant' | null

  const load = async () => {
    setLoading(true);
    try { setTokens(await api('/api/access-tokens')); }
    catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const revoke = async (t) => {
    if (!confirm(`Révoquer le lien de ${t.organization?.name || t.email} ?\nL'utilisateur ne pourra plus accéder à son espace.`)) return;
    try { await api(`/api/access-tokens/${t.id}/revoke`, { method: 'POST', body: '{}' }); toast.success('Lien révoqué'); load(); }
    catch (e) { toast.error(e.message); }
  };

  const revokeAll = async () => {
    const activeCount = tokens.filter(t => !t.is_revoked && !t.is_expired).length;
    if (activeCount === 0) { toast.info('Aucun lien actif à révoquer'); return; }
    if (!confirm(`⚠️ RÉVOCATION GROUPÉE\n\nVous allez révoquer ${activeCount} lien${activeCount > 1 ? 's' : ''} actif${activeCount > 1 ? 's' : ''}.\nCette action est irréversible.\n\nLes exposants et Pacific Centers ne pourront plus accéder à leur espace tant qu'un nouveau lien ne leur aura pas été généré.\n\nConfirmer la révocation ?`)) return;
    try {
      const res = await api('/api/access-tokens/revoke-all', { method: 'POST', body: '{}' });
      toast.success(`✅ ${res.revoked} lien${res.revoked > 1 ? 's' : ''} révoqué${res.revoked > 1 ? 's' : ''}`);
      load();
    } catch (e) { toast.error(e.message); }
  };
  const resend = async (t) => {
    try { await api(`/api/access-tokens/${t.id}/resend`, { method: 'POST', body: '{}' }); toast.success('Email renvoyé à ' + t.email); }
    catch (e) { toast.error(e.message); }
  };
  const copyLink = async (t) => {
    try { await navigator.clipboard.writeText(t.access_url); toast.success('Lien copié dans le presse-papiers'); }
    catch { toast.info(t.access_url); }
  };

  const visibleTokens = tokens.filter(t => {
    if (filter === 'actifs') return !t.is_revoked && !t.is_expired;
    if (filter === 'revoques') return t.is_revoked;
    if (filter === 'inscriptions') return t.purpose === 'inscription_exposant';
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Liens actifs" value={tokens.filter(t => !t.is_revoked).length} accent="emerald" />
        <KpiCard label="Liens utilisés" value={tokens.filter(t => t.use_count > 0).length} accent="blue" />
        <KpiCard label="Inscriptions ouvertes" value={tokens.filter(t => t.purpose === 'inscription_exposant' && !t.is_revoked).length} accent="violet" />
        <KpiCard label="Liens révoqués" value={tokens.filter(t => t.is_revoked).length} accent="slate" />
      </div>

      <Card className="border-violet-200 bg-violet-50/30">
        <CardContent className="p-4 text-sm text-violet-900 flex items-start gap-3">
          <KeyRound className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="flex-1">
            <b>Comment ça marche :</b> Chaque exposant et chaque Pacific Centers reçoit par email un <i>lien personnel permanent</i> qui ouvre directement son espace, sans mot de passe. Vous pouvez aussi générer un <i>lien d&apos;inscription</i> pour démarcher un nouveau prospect (formulaire vierge).
          </div>
          <div className="flex gap-2 shrink-0 flex-wrap">
            <Button size="sm" onClick={() => setShowCreate('access')} className="bg-blue-600 hover:bg-blue-700 gap-1.5" data-testid="generate-magic-link-exposant"><Send className="w-4 h-4" /> Lien d&apos;accès exposant</Button>
            <Button size="sm" onClick={() => setShowCreate('new_exposant')} className="bg-violet-600 hover:bg-violet-700 gap-1.5" data-testid="generate-magic-link-new-exposant"><Plus className="w-4 h-4" /> Créer & inviter exposant</Button>
            <Button size="sm" onClick={() => setShowCreate('pacific')} className="bg-cyan-600 hover:bg-cyan-700 gap-1.5" data-testid="generate-magic-link-pacific"><Eye className="w-4 h-4" /> Lien Pacific Centers</Button>
            <Button size="sm" onClick={revokeAll} className="bg-rose-600 hover:bg-rose-700 gap-1.5" data-testid="revoke-all-tokens" disabled={tokens.filter(t => !t.is_revoked && !t.is_expired).length === 0}><Ban className="w-4 h-4" /> Révoquer tous les liens</Button>
          </div>
        </CardContent>
      </Card>

      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList>
          <TabsTrigger value="actifs">Actifs</TabsTrigger>
          <TabsTrigger value="inscriptions">Inscriptions</TabsTrigger>
          <TabsTrigger value="revoques">Révoqués</TabsTrigger>
          <TabsTrigger value="tous">Tous</TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? <div className="py-8 text-center text-slate-500">Chargement…</div> : visibleTokens.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-slate-500">Aucun lien dans cette catégorie.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {visibleTokens.map(t => (
            <Card key={t.id} className={t.is_revoked ? 'border-slate-200 bg-slate-50' : 'border-slate-200'}>
              <CardContent className="p-3 flex items-start gap-3">
                <div className="text-2xl shrink-0">
                  {t.purpose === 'inscription_exposant' ? '📝' : t.purpose === 'pacific_centers' ? '👁️' : '🔗'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {t.registration_id && <AiInsightTrigger registration={{ id: t.registration_id }} size="xs" />}
                    <b className="text-sm">{t.organization?.name || t.email || t.label || '—'}</b>
                    <Badge variant="secondary" className="text-[10px]">{t.purpose === 'inscription_exposant' ? 'Inscription' : t.purpose === 'pacific_centers' ? 'Pacific' : 'Accès'}</Badge>
                    {t.is_revoked && <Badge className="bg-slate-500 text-white text-[10px]">Révoqué</Badge>}
                    {!t.is_revoked && t.use_count > 0 && <Badge className="bg-emerald-500 text-white text-[10px]">Utilisé {t.use_count}×</Badge>}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">{t.email || '—'}</div>
                  <div className="text-[10px] text-slate-400 font-mono truncate mt-1" title={t.access_url}>{t.access_url}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    Créé {new Date(t.created_at).toLocaleDateString('fr-FR')}
                    {t.last_used_at && <> · Dernier accès {new Date(t.last_used_at).toLocaleString('fr-FR')}</>}
                  </div>
                </div>
                <div className="flex flex-col gap-1.5 shrink-0">
                  {!t.is_revoked && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => copyLink(t)} className="gap-1.5"><FileText className="w-3 h-3" /> Copier le lien</Button>
                      {t.email && <Button size="sm" variant="outline" onClick={() => resend(t)} className="gap-1.5"><Send className="w-3 h-3" /> Renvoyer email</Button>}
                      <Button size="sm" variant="outline" onClick={() => revoke(t)} className="gap-1.5 text-rose-600 border-rose-200"><XCircle className="w-3 h-3" /> Révoquer</Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {showCreate && <CreateAccessTokenModal mode={showCreate} onClose={() => setShowCreate(null)} onCreated={() => { setShowCreate(null); load(); }} />}
    </div>
  );
}

function CreateAccessTokenModal({ mode, onClose, onCreated }) {
  const [busy, setBusy] = useState(false);
  const [orgs, setOrgs] = useState([]);
  const [form, setForm] = useState({
    organization_id: '',
    email: mode === 'pacific' ? 'pacific@centers.pf' : '',
    send_email: true,
    label: '',
    new_name: '',
    new_phone: '',
    new_discipline: '',
    new_contact_name: '',
  });
  const [created, setCreated] = useState(null);

  useEffect(() => {
    if (mode === 'access') {
      api('/api/registrations').then(regs => {
        const seen = new Set();
        const list = [];
        regs.forEach(r => {
          if (r.organization && !seen.has(r.organization.id)) {
            seen.add(r.organization.id);
            list.push(r.organization);
          }
        });
        list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        setOrgs(list);
      }).catch(() => {});
    }
  }, [mode]);

  const submit = async () => {
    if (mode === 'access' && !form.organization_id) { toast.error('Choisissez un exposant'); return; }
    if (mode === 'new_exposant' && (!form.email || !form.new_name)) { toast.error('Email et nom de la structure sont requis'); return; }
    if (mode === 'pacific' && !form.email) { toast.error('Email requis'); return; }
    setBusy(true);
    try {
      let body;
      if (mode === 'access') {
        body = { purpose: 'access', organization_id: form.organization_id, send_email: form.send_email };
      } else if (mode === 'new_exposant') {
        body = {
          purpose: 'access',
          send_email: form.send_email,
          new_exposant: {
            name: form.new_name,
            email: form.email,
            phone: form.new_phone || null,
            discipline: form.new_discipline || null,
            contact_name: form.new_contact_name || null,
          },
          label: form.label || form.new_name,
        };
      } else {
        body = { purpose: 'pacific_centers', email: form.email, label: form.label || 'Pacific Centers', send_email: form.send_email };
      }
      const res = await api('/api/access-tokens', { method: 'POST', body: JSON.stringify(body) });
      if (res.reused) {
        toast.info(res.message || 'Lien existant réutilisé (pas de nouveau lien créé)');
      } else if (res.email_sent) {
        toast.success('Lien créé et envoyé par email ✉️');
      } else {
        toast.success('Lien créé');
      }
      setCreated(res);
    } catch (e) { toast.error(e.message); setBusy(false); }
  };

  const titleNode = mode === 'access'
    ? <><Send className="w-5 h-5 text-blue-600" /> Lien d&apos;accès exposant existant</>
    : mode === 'new_exposant'
      ? <><Plus className="w-5 h-5 text-violet-600" /> Créer un nouvel exposant + envoyer le lien</>
      : <><Eye className="w-5 h-5 text-cyan-600" /> Lien Pacific Centers (lecture seule)</>;
  const subtitleNode = mode === 'access'
    ? "L'exposant recevra un email avec son lien personnel permanent. Aucun mot de passe à retenir."
    : mode === 'new_exposant'
      ? "ARACOM saisit l'exposant ici. Il recevra automatiquement un lien pour compléter son profil. Aucune inscription libre — vous gardez la main."
      : "Génère un lien magique pour le portail Pacific Centers (vue consolidée en lecture seule). Le destinataire accède sans mot de passe.";
  const submitClass = mode === 'access'
    ? 'bg-blue-600 hover:bg-blue-700 gap-2'
    : mode === 'new_exposant'
      ? 'bg-violet-600 hover:bg-violet-700 gap-2'
      : 'bg-cyan-600 hover:bg-cyan-700 gap-2';

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => !busy && !created && onClose()}>
      <Card className="max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">{titleNode}</CardTitle>
          <p className="text-sm text-slate-600">{subtitleNode}</p>
        </CardHeader>
        {!created ? (
          <CardContent className="space-y-3">
            {mode === 'access' && (
              <div>
                <Label>Exposant</Label>
                <select className="w-full border rounded-md px-3 py-2 text-sm" value={form.organization_id} onChange={(e) => setForm({ ...form, organization_id: e.target.value })}>
                  <option value="">— Sélectionner —</option>
                  {orgs.map(o => <option key={o.id} value={o.id}>{o.name}{o.main_email ? ` (${o.main_email})` : ''}</option>)}
                </select>
              </div>
            )}
            {mode === 'new_exposant' && (
              <>
                <div>
                  <Label>Nom de la structure / association *</Label>
                  <Input value={form.new_name} onChange={(e) => setForm({ ...form, new_name: e.target.value })} placeholder="Ex: Tahiti Iti Natation" />
                </div>
                <div>
                  <Label>Email principal *</Label>
                  <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="contact@asso.pf" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Téléphone</Label>
                    <Input value={form.new_phone} onChange={(e) => setForm({ ...form, new_phone: e.target.value })} placeholder="87xxxxxx" />
                  </div>
                  <div>
                    <Label>Contact (nom)</Label>
                    <Input value={form.new_contact_name} onChange={(e) => setForm({ ...form, new_contact_name: e.target.value })} placeholder="Jean Dupont" />
                  </div>
                </div>
                <div>
                  <Label>Discipline / activité</Label>
                  <Input value={form.new_discipline} onChange={(e) => setForm({ ...form, new_discipline: e.target.value })} placeholder="Ex: Natation, Judo, Danse…" />
                </div>
              </>
            )}
            {mode === 'pacific' && (
              <>
                <div className="rounded-md bg-cyan-50 border border-cyan-200 p-3 text-sm text-cyan-900">
                  <p className="font-medium mb-1">🔗 Lien magique sans compte requis</p>
                  <p className="text-xs leading-relaxed">
                    Le lien Pacific Centers est un <b>simple lien à partager</b>. Aucun compte ni mot de passe n&apos;est nécessaire — toute personne qui clique sur le lien accède au portail Pacific Centers en lecture seule. Vous pouvez le copier-coller ou l&apos;envoyer par email.
                  </p>
                </div>
                <div>
                  <Label>Email destinataire (facultatif)</Label>
                  <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="contact@pacific.pf (optionnel)" />
                  <p className="text-[11px] text-slate-500 mt-1">Renseignez un email seulement si vous voulez que le lien soit envoyé automatiquement par mail. Sinon, laissez vide et copiez le lien généré.</p>
                </div>
                <div>
                  <Label>Étiquette interne (facultatif)</Label>
                  <Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="Pacific Centers — Direction" />
                </div>
              </>
            )}
            <div className="flex items-center gap-2 bg-slate-50 border rounded-md p-2">
              <Checkbox id="se" checked={form.send_email} onCheckedChange={(c) => setForm({ ...form, send_email: c })} />
              <Label htmlFor="se" className="text-sm cursor-pointer">Envoyer le lien par email automatiquement</Label>
            </div>
          </CardContent>
        ) : (
          <CardContent className="space-y-3">
            <div className={`rounded-md border p-3 ${created.reused ? 'bg-blue-50 border-blue-200 text-blue-900' : 'bg-emerald-50 border-emerald-200 text-emerald-900'}`}>
              <div className="font-bold flex items-center gap-2"><CheckCircle2 className="w-5 h-5" /> {created.reused ? '🔄 Lien existant réutilisé' : '✨ Nouveau lien créé !'}</div>
              {created.message && <div className="text-sm mt-1">{created.message}</div>}
              {!created.reused && form.send_email && <div className="text-sm mt-1">📧 L&apos;email vient d&apos;être envoyé.</div>}
            </div>
            <div>
              <Label className="text-xs">URL personnelle</Label>
              <div className="flex gap-2">
                <Input readOnly value={created.access_url} className="font-mono text-xs" onClick={(e) => e.target.select()} />
                <Button variant="outline" onClick={() => { navigator.clipboard.writeText(created.access_url); toast.success('Copié'); }}>Copier</Button>
              </div>
            </div>
          </CardContent>
        )}
        <div className="flex gap-2 justify-end p-4 border-t">
          {!created ? (
            <>
              <Button variant="ghost" onClick={onClose} disabled={busy}>Annuler</Button>
              <Button onClick={submit} disabled={busy} className={submitClass}>
                {busy ? 'Création…' : <><Send className="w-4 h-4" /> Créer le lien</>}
              </Button>
            </>
          ) : (
            <Button onClick={onCreated} className="ml-auto">Fermer</Button>
          )}
        </div>
      </Card>
    </div>
  );
}

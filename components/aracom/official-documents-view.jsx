'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { FileText, Plus, RefreshCw, Eye, Trash2 } from 'lucide-react';
import { api } from '@/lib/auth-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';

const DOC_CATEGORIES = [
  { value: 'convention', label: '📜 Convention de participation', emoji: '📜' },
  { value: 'guide',      label: '📖 Guide exposant',                emoji: '📖' },
  { value: 'reglement',  label: '⚖️ Règlement intérieur',           emoji: '⚖️' },
  { value: 'autre',      label: '📁 Autre',                          emoji: '📁' },
];

/**
 * 🆕 Éditeur RIB ARACOM — champs structurés pour le virement de caution.
 * Endpoint : GET/POST /api/admin/rib-config
 */
function RibAndTemplatesEditor() {
  const [rib, setRib] = useState({ titulaire: 'ARACOM', banque: '', iban: '', bic: '', reference: 'Caution Forum 2026 + nom exposant' });
  const [savingRib, setSavingRib] = useState(false);

  useEffect(() => {
    api('/api/admin/rib-config').then(setRib).catch(() => {});
  }, []);

  const saveRib = async () => {
    setSavingRib(true);
    try {
      await api('/api/admin/rib-config', { method: 'POST', body: JSON.stringify(rib) });
      toast.success('💾 RIB ARACOM enregistré');
    } catch (e) { toast.error(e.message); }
    setSavingRib(false);
  };

  return (
    <Card className="border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-purple-50">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2 text-indigo-900">
          🏦 RIB ARACOM (utilisé en virement de caution + pièce jointe email)
        </CardTitle>
        <p className="text-xs text-indigo-700 mt-1">Ces informations apparaîtront dans le modal &quot;Confirmer ma présence&quot; quand l&apos;exposant sélectionne le mode <b>Virement bancaire</b>.</p>
      </CardHeader>
      <CardContent className="grid md:grid-cols-2 gap-3">
        <div><Label>Titulaire du compte</Label><Input value={rib.titulaire || ''} onChange={e => setRib({ ...rib, titulaire: e.target.value })} placeholder="ARACOM" /></div>
        <div><Label>Banque</Label><Input value={rib.banque || ''} onChange={e => setRib({ ...rib, banque: e.target.value })} placeholder="Ex : Banque de Polynésie" /></div>
        <div className="md:col-span-2"><Label>IBAN</Label><Input value={rib.iban || ''} onChange={e => setRib({ ...rib, iban: e.target.value })} placeholder="FR76 1234 5678 9012 3456 7890 123" className="font-mono" /></div>
        <div><Label>BIC / SWIFT</Label><Input value={rib.bic || ''} onChange={e => setRib({ ...rib, bic: e.target.value })} placeholder="BPPFPFPP" className="font-mono" /></div>
        <div><Label>Référence à indiquer par l&apos;exposant</Label><Input value={rib.reference || ''} onChange={e => setRib({ ...rib, reference: e.target.value })} placeholder="Caution Forum 2026 + nom" /></div>
        <div className="md:col-span-2">
          <Button onClick={saveRib} disabled={savingRib} className="bg-indigo-600 hover:bg-indigo-700 gap-2">
            {savingRib ? 'Enregistrement…' : <>💾 Enregistrer le RIB</>}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * OFFICIAL DOCUMENTS VIEW — Bibliothèque de documents officiels (convention, guide, règlement…).
 * Upload/Drive, partagés automatiquement avec tous les exposants via leur portail.
 */
export default function OfficialDocumentsView() {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', category: 'convention', file: null });
  const [uploading, setUploading] = useState(false);

  const reload = async () => {
    setLoading(true);
    try { const d = await api('/api/official-documents'); setDocs(d); }
    catch (e) { toast.error(e.message); }
    setLoading(false);
  };
  useEffect(() => { reload(); }, []);

  const upload = async () => {
    if (!form.title.trim()) { toast.error('Titre requis'); return; }
    if (!form.file) { toast.error('Fichier requis'); return; }
    setUploading(true);
    try {
      const file = form.file;
      const buf = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result.split(',')[1]);
        r.onerror = rej;
        r.readAsDataURL(file);
      });
      await api('/api/official-documents', {
        method: 'POST',
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description.trim(),
          category: form.category,
          file_data: buf,
          file_name: file.name,
          mime_type: file.type || 'application/pdf',
        }),
      });
      toast.success('✅ Document officiel ajouté à la bibliothèque');
      setForm({ title: '', description: '', category: 'convention', file: null });
      setShowForm(false);
      reload();
    } catch (e) { toast.error('Erreur : ' + e.message); }
    setUploading(false);
  };

  const remove = async (d) => {
    if (!confirm(`Retirer "${d.title}" de la bibliothèque ? Le fichier reste dans Google Drive mais ne sera plus visible des exposants.`)) return;
    try { await api(`/api/official-documents/${d.id}`, { method: 'DELETE' }); toast.success('Retiré'); reload(); }
    catch (e) { toast.error(e.message); }
  };

  return (
    <div className="space-y-4">
      <RibAndTemplatesEditor />

      <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50">
        <CardContent className="p-5 flex items-start gap-4 flex-wrap">
          <div className="w-14 h-14 rounded-lg bg-white shadow-md flex items-center justify-center shrink-0">
            <FileText className="w-7 h-7 text-blue-600" />
          </div>
          <div className="flex-1 min-w-[260px]">
            <h2 className="font-bold text-blue-900 text-lg">📚 Bibliothèque de documents officiels</h2>
            <p className="text-sm text-blue-800 mt-1">
              Téléchargez ici la <b>convention 2026</b>, le <b>guide exposant</b>, le <b>règlement</b>… Ils seront automatiquement disponibles dans le portail de chacun des 68 exposants, qui pourront les télécharger, les signer puis vous les renvoyer (par email ou directement dans leur espace).
            </p>
            <p className="text-xs text-blue-700 italic mt-1">📂 Stockage automatique dans <b>Google Drive &gt; Forum 2026 &gt; Documents officiels/</b></p>
          </div>
          <Button onClick={() => setShowForm(!showForm)} className="bg-blue-600 hover:bg-blue-700 gap-1.5">
            <Plus className="w-4 h-4" /> Ajouter un document
          </Button>
        </CardContent>
      </Card>

      {showForm && (
        <Card className="border-blue-300">
          <CardContent className="p-4 space-y-3">
            <h3 className="font-semibold text-sm">Nouveau document officiel</h3>
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs uppercase">Titre *</Label>
                <Input className="mt-1" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Ex: Convention de participation 2026" />
              </div>
              <div>
                <Label className="text-xs uppercase">Catégorie</Label>
                <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{DOC_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs uppercase">Description (visible des exposants)</Label>
              <Input className="mt-1" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Ex: À signer et nous retourner avant le 15 juillet 2026" />
            </div>
            <div>
              <Label className="text-xs uppercase">Fichier (PDF recommandé, max 20 Mo)</Label>
              <Input className="mt-1" type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" onChange={e => setForm({ ...form, file: e.target.files?.[0] || null })} />
              {form.file && <div className="text-xs text-slate-500 mt-1">{form.file.name} — {(form.file.size/1024).toFixed(1)} Ko</div>}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowForm(false)}>Annuler</Button>
              <Button onClick={upload} disabled={uploading} className="bg-blue-600 hover:bg-blue-700 gap-1.5">
                {uploading ? <><RefreshCw className="w-4 h-4 animate-spin" /> Upload Drive…</> : <><Plus className="w-4 h-4" /> Ajouter</>}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {loading ? <div className="py-8 text-center text-slate-500">Chargement…</div> :
           docs.length === 0 ? <div className="py-12 text-center text-slate-500">
             <FileText className="w-10 h-10 mx-auto text-slate-300 mb-2" />
             Aucun document officiel pour l&apos;instant. Cliquez sur <b>« Ajouter un document »</b>.
           </div> : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b text-left text-xs uppercase text-slate-500">
                <tr><th className="py-2 px-3">Titre</th><th>Catégorie</th><th>Description</th><th>Taille</th><th>Ajouté</th><th></th></tr>
              </thead>
              <tbody className="divide-y">
                {docs.map(d => {
                  const cat = DOC_CATEGORIES.find(c => c.value === d.category) || DOC_CATEGORIES[3];
                  return (
                    <tr key={d.id} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-medium">{d.title}</td>
                      <td><Badge variant="secondary">{cat.emoji} {cat.label.replace(/^.{2,3}\s/, '')}</Badge></td>
                      <td className="text-xs text-slate-600 max-w-md">{d.description || '—'}</td>
                      <td className="text-xs">{d.size_bytes ? (d.size_bytes / 1024).toFixed(0) + ' Ko' : '—'}</td>
                      <td className="text-[11px] text-slate-500">{new Date(d.uploaded_at || d.created_at).toLocaleDateString('fr-FR')}</td>
                      <td>
                        <div className="flex gap-1 justify-end pr-3">
                          {d.drive_url && <a href={d.drive_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:bg-blue-50 rounded p-1.5"><Eye className="w-4 h-4" /></a>}
                          <button onClick={() => remove(d)} className="text-rose-600 hover:bg-rose-50 rounded p-1.5"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

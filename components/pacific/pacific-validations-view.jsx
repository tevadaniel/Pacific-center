'use client';

/**
 * 🆕 SESSION 48w — Vue Validations & Attente pour Pacific Centers (lecture seule)
 * Réutilise UnifiedValidationView en mode `readonly` + drawer détail exposant.
 */
import { useEffect, useState, useMemo } from 'react';
import { api } from '@/lib/auth-client';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Building2, MapPin, Mail, Phone, FileCheck2, FileX, Wallet, Calendar, Award } from 'lucide-react';
import UnifiedValidationView from '@/components/aracom/unified-validation-view';

export default function PacificValidationsView() {
  const [openReg, setOpenReg] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!openReg) { setDetail(null); return; }
    // ⚠️ openReg est une validation_request → on doit utiliser registration_id (pas id)
    const regId = openReg.registration_id || openReg.id;
    let cancelled = false;
    const loadDetail = async () => {
      setLoading(true);
      try {
        const d = await api(`/api/registrations/${regId}`);
        if (!cancelled) setDetail(d);
      } catch {
        if (!cancelled) setDetail(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadDetail();
    return () => { cancelled = true; };
  }, [openReg]);

  // ─── Normalisation des champs depuis la réponse API (qui renvoie {registration, organization, venue, documents, deposit, slots}) ───
  const normalized = useMemo(() => {
    if (!detail) return null;
    const reg = detail.registration || {};
    const org = detail.organization || {};
    const venue = detail.venue || {};
    const docs = detail.documents || [];
    const deposit = detail.deposit || null;
    const slots = detail.slots || [];

    // 📝 Documents : on cherche par type
    const findDoc = (typeKeywords) => docs.find(d => {
      const t = (d.document_type || d.type || '').toLowerCase();
      return typeKeywords.some(k => t.includes(k));
    });
    const convention = findDoc(['convention']);
    const assurance = findDoc(['assurance', 'rc']);
    const conventionSigned = !!(reg.is_convention_signed || reg.convention_status === 'signee' || (convention && (convention.is_signed || convention.status === 'signed')));
    const hasAssurance = !!(reg.has_assurance || reg.assurance_uploaded || assurance);
    const cautionReceived = !!(deposit && (deposit.status === 'received' || deposit.status === 'confirmed' || deposit.received_at));

    return {
      org_name: org.name || reg.organization_name || '—',
      discipline: org.discipline || '—',
      org_type: org.org_type || org.type || '—',
      contact_name: org.contact_name || org.main_contact || '—',
      email: org.main_email || '',
      phone: org.main_phone || '',
      status: reg.status || '—',
      stand_code: reg.stand_code || '',
      venue_name: venue.name || '',
      attending_days: reg.attending_days || [],
      slots,
      convention_signed: conventionSigned,
      has_assurance: hasAssurance,
      caution_received: cautionReceived,
    };
  }, [detail]);

  return (
    <div className="space-y-4">
      <Card className="border-cyan-200 bg-gradient-to-r from-cyan-50/40 to-white">
        <CardContent className="p-3 text-xs text-cyan-900">
          👁️ <b>Vue lecture seule Pacific Centers</b> — visualisez tous les exposants par site et statut. Cliquez sur le nom d&apos;un exposant pour voir sa fiche détaillée (documents, contact, état d&apos;avancement).
        </CardContent>
      </Card>

      <UnifiedValidationView readonly={true} onExposantClick={setOpenReg} />

      {/* Drawer détail exposant */}
      <Sheet open={!!openReg} onOpenChange={(o) => { if (!o) setOpenReg(null); }}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-600" />
              {normalized?.org_name || openReg?.organization?.name || 'Fiche exposant'}
            </SheetTitle>
            <SheetDescription>
              Fiche détaillée — lecture seule
            </SheetDescription>
          </SheetHeader>

          {loading ? (
            <div className="py-8 text-center text-slate-500">Chargement…</div>
          ) : normalized ? (
            <div className="space-y-3 mt-4">
              {/* Statut */}
              <Card>
                <CardContent className="p-3 space-y-1.5">
                  <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Statut</div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className={`text-[10px] ${
                      normalized.status === 'confirme' ? 'bg-emerald-600' :
                      normalized.status === 'a_confirmer' ? 'bg-violet-500' :
                      normalized.status === 'a_relancer' ? 'bg-amber-500' :
                      'bg-slate-500'
                    } text-white`}>
                      {normalized.status}
                    </Badge>
                    {normalized.stand_code && <Badge variant="outline" className="font-mono text-[10px]">Stand {normalized.stand_code}</Badge>}
                    {normalized.venue_name && <Badge variant="outline" className="text-[10px]"><MapPin className="w-3 h-3 mr-0.5" /> {normalized.venue_name}</Badge>}
                  </div>
                </CardContent>
              </Card>

              {/* Org info */}
              <Card>
                <CardContent className="p-3 space-y-1.5 text-sm">
                  <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Organisation</div>
                  <div><b>Discipline :</b> {normalized.discipline}</div>
                  <div><b>Type :</b> {normalized.org_type}</div>
                  {normalized.contact_name !== '—' && <div><b>Contact :</b> {normalized.contact_name}</div>}
                  {normalized.email && (
                    <div className="flex items-center gap-1">
                      <Mail className="w-3 h-3 text-slate-400" />
                      <a href={`mailto:${normalized.email}`} className="text-blue-700 hover:underline">{normalized.email}</a>
                    </div>
                  )}
                  {normalized.phone && (
                    <div className="flex items-center gap-1">
                      <Phone className="w-3 h-3 text-slate-400" />
                      <a href={`tel:${normalized.phone}`} className="text-blue-700 hover:underline">{normalized.phone}</a>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Documents */}
              <Card>
                <CardContent className="p-3 space-y-1.5 text-sm">
                  <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Documents requis</div>
                  <DocStatus label="Convention signée" icon={FileCheck2} ok={normalized.convention_signed} />
                  <DocStatus label="Attestation d'assurance" icon={FileCheck2} ok={normalized.has_assurance} />
                  <DocStatus label="Caution reçue" icon={Wallet} ok={normalized.caution_received} />
                </CardContent>
              </Card>

              {/* Présence + animations */}
              {(normalized.attending_days.length > 0 || normalized.slots.length > 0) && (
                <Card>
                  <CardContent className="p-3 space-y-1 text-sm">
                    <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Présence & animations</div>
                    {normalized.attending_days.length > 0 && (
                      <div className="flex items-center gap-1"><Calendar className="w-3 h-3 text-slate-400" /> {normalized.attending_days.join(' · ')}</div>
                    )}
                    {normalized.slots.length > 0 && (
                      <div className="flex items-center gap-1"><Award className="w-3 h-3 text-slate-400" /> {normalized.slots.length} créneau(x) d&apos;animation</div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
            <div className="py-8 text-center text-slate-500 italic">Détails non disponibles</div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function DocStatus({ label, icon: Icon, ok }) {
  return (
    <div className="flex items-center gap-2">
      {ok ? <Icon className="w-3.5 h-3.5 text-emerald-600" /> : <FileX className="w-3.5 h-3.5 text-rose-500" />}
      <span className={ok ? 'text-emerald-900' : 'text-rose-800 font-medium'}>{label}</span>
      <Badge className={`ml-auto text-[9px] ${ok ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-rose-100 text-rose-800 border-rose-300'} border`}>
        {ok ? '✓ Fourni' : '⚠ Manquant'}
      </Badge>
    </div>
  );
}

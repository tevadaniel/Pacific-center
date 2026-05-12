'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { LogIn, Eye, Users, Search, Loader2, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

export default function PortalSwitcher() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [exposants, setExposants] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const r = await fetch('/api/organizations');
        const list = await r.json();
        if (!cancelled) setExposants(Array.isArray(list) ? list : []);
      } catch {}
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [open]);

  const filtered = q.trim().length >= 2
    ? exposants.filter(o => (o.name || '').toLowerCase().includes(q.toLowerCase()) || (o.main_email || '').toLowerCase().includes(q.toLowerCase()))
    : exposants.slice(0, 12);

  const goPacific = () => {
    setOpen(false);
    router.push('/pacific');
  };

  const goExposant = async (org) => {
    setOpen(false);
    try {
      // Generate/fetch access link
      const r = await fetch(`/api/organizations/${org.id}/access-link`);
      const d = await r.json();
      if (r.ok && d?.access_url) {
        window.open(d.access_url, '_blank');
      } else {
        toast.error('Lien d\'accès indisponible pour cet exposant');
      }
    } catch (e) {
      toast.error('Erreur : ' + e.message);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="gap-1.5 bg-white border-slate-300 text-slate-700 hover:bg-slate-50"
        data-testid="portal-switcher"
        title="Basculer vers un autre portail"
      >
        <LogIn className="w-3.5 h-3.5" /> Portails
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>🔄 Basculer vers un autre portail</DialogTitle>
            <DialogDescription>Visualisez la plateforme depuis le point de vue d&apos;un autre rôle.</DialogDescription>
          </DialogHeader>

          {/* Pacific Centers */}
          <div>
            <button
              onClick={goPacific}
              className="w-full p-3 border-2 border-cyan-300 hover:border-cyan-500 hover:bg-cyan-50 rounded-lg flex items-center gap-3 transition text-left"
              data-testid="switch-pacific"
            >
              <div className="w-10 h-10 rounded-lg bg-cyan-100 flex items-center justify-center"><Eye className="w-5 h-5 text-cyan-700" /></div>
              <div className="flex-1">
                <div className="font-bold text-slate-900">Portail Pacific Centers</div>
                <div className="text-xs text-slate-500">Vue lecture seule sur l&apos;occupation et les animations</div>
              </div>
              <ExternalLink className="w-4 h-4 text-slate-400" />
            </button>
          </div>

          {/* Exposants */}
          <div>
            <div className="text-xs font-semibold text-slate-600 mb-2 flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> Portail d&apos;un exposant</div>
            <div className="relative mb-2">
              <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                value={q}
                onChange={e => setQ(e.target.value)}
                placeholder="Rechercher par nom ou email…"
                className="pl-8"
                autoFocus
                data-testid="search-exposant"
              />
            </div>
            <div className="max-h-64 overflow-y-auto border rounded-lg">
              {loading ? (
                <div className="p-4 text-center text-slate-400"><Loader2 className="w-4 h-4 animate-spin inline mr-2" />Chargement…</div>
              ) : filtered.length === 0 ? (
                <div className="p-4 text-center text-slate-400 text-sm">Aucun résultat</div>
              ) : (
                filtered.map(o => (
                  <button
                    key={o.id}
                    onClick={() => goExposant(o)}
                    className="w-full p-2.5 border-b last:border-b-0 hover:bg-emerald-50 flex items-center gap-2 text-left transition"
                    data-testid={`switch-exposant-${o.id}`}
                  >
                    <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-xs">
                      {(o.name || '?').charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-slate-900 truncate text-sm">{o.name || '(sans nom)'}</div>
                      <div className="text-[11px] text-slate-500 truncate">{o.main_email}</div>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                ))
              )}
            </div>
            <div className="text-[11px] text-slate-400 mt-1.5">Le lien d&apos;accès s&apos;ouvre dans un nouvel onglet — n&apos;est PAS partagé avec l&apos;exposant.</div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

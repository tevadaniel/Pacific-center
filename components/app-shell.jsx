'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getSession, clearSession } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LogOut, MapPin } from 'lucide-react';

export function Shell({ children, title, subtitle, right, allowedRoles, activeTab, tabs = [] }) {
  const router = useRouter();
  const [session, setSession] = useState(null);
  useEffect(() => {
    const s = getSession();
    if (!s) { router.replace('/'); return; }
    if (allowedRoles && !allowedRoles.includes(s.role)) { router.replace('/'); return; }
    setSession(s);
  }, [router, allowedRoles]);

  const logout = () => { clearSession(); router.replace('/'); };

  if (!session) return null;

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-600 to-emerald-500 flex items-center justify-center shrink-0">
              <MapPin className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-widest text-slate-500">Forum Rentrée 2026</div>
              <div className="font-semibold text-slate-900 truncate">{title}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {right}
            <div className="hidden sm:flex items-center gap-2 text-sm">
              <div className="text-right">
                <div className="font-medium text-slate-900">{session.name}</div>
                <div className="text-xs text-slate-500">{roleLabel(session.role)}</div>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={logout}><LogOut className="w-4 h-4" /></Button>
          </div>
        </div>
        {tabs.length > 0 && (
          <div className="max-w-[1600px] mx-auto px-2 sm:px-4 flex gap-1 overflow-x-auto">
            {tabs.map(t => {
              const cls = `px-3 py-2 text-sm font-medium rounded-t-md whitespace-nowrap transition ${activeTab === t.key ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-slate-600 hover:text-slate-900'}`;
              return t.onClick ? (
                <button key={t.key} onClick={t.onClick} className={cls}>{t.label}</button>
              ) : (
                <Link key={t.key} href={t.href} className={cls}>{t.label}</Link>
              );
            })}
          </div>
        )}
      </header>
      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6">
        {subtitle && <p className="text-sm text-slate-500 mb-4">{subtitle}</p>}
        {children}
      </main>
    </div>
  );
}

function roleLabel(role) {
  return { aracom_admin: 'ARACOM admin', exposant: 'Exposant', pacific_centers_readonly: 'Pacific Centers' }[role] || role;
}

export function KpiCard({ label, value, accent = 'blue', hint, icon: Icon }) {
  const colors = {
    blue: 'from-blue-50 to-white border-blue-100',
    emerald: 'from-emerald-50 to-white border-emerald-100',
    orange: 'from-orange-50 to-white border-orange-100',
    violet: 'from-violet-50 to-white border-violet-100',
    red: 'from-red-50 to-white border-red-100',
    slate: 'from-slate-50 to-white border-slate-200',
  };
  const iconC = { blue: 'text-blue-600', emerald: 'text-emerald-600', orange: 'text-orange-600', violet: 'text-violet-600', red: 'text-red-600', slate: 'text-slate-600' };
  return (
    <div className={`relative rounded-xl border bg-gradient-to-b ${colors[accent]} p-4 shadow-sm`}>
      {Icon && <Icon className={`absolute top-3 right-3 w-4 h-4 ${iconC[accent]}`} />}
      <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">{label}</div>
      <div className="text-2xl font-bold text-slate-900 mt-1">{value}</div>
      {hint && <div className="text-xs text-slate-500 mt-0.5">{hint}</div>}
    </div>
  );
}

export function StatusBadge({ status, map, defaultColor = 'bg-slate-100 text-slate-700' }) {
  const color = map?.[status] || defaultColor;
  const label = status || '—';
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-xs font-medium ${color}`}>{label}</span>;
}

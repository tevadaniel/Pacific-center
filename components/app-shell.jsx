'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { getSession, clearSession, api } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LogOut, MapPin, ChevronDown,
  LayoutDashboard, Compass, Users, Mail, Settings, Star,
  AlertCircle, ClipboardCheck, BarChart3,
  Wallet, Bell, Target, Trash2, AlertTriangle,
  FileText, Link2, Sparkles, Clock, Database, Upload,
} from 'lucide-react';

// 🎨 SESSION 28w — Map icônes string → composant Lucide pour les menus
const ICONS = {
  LayoutDashboard, Compass, Users, Mail, Settings, Star,
  AlertCircle, ClipboardCheck, BarChart3,
  Wallet, Bell, Target, Trash2, AlertTriangle,
  FileText, Link2, Sparkles, Clock, Database, Upload, MapPin,
};
const getIcon = (name) => (name && ICONS[name]) ? ICONS[name] : null;

// 🎯 SESSION 29 — Composant Badge intelligent avec couleurs par seuil, animation et tooltip
//   • 1-9    → ambre (info)
//   • 10-49  → orange (warning)
//   • 50+    → rouge + pulse (critique)
//   • Entrée fade-in + scale, hover ring
function MenuBadge({ value, tooltip, size = 'sm' }) {
  const [animateIn, setAnimateIn] = useState(false);
  useEffect(() => {
    // Trigger animation au mount + à chaque changement de valeur
    setAnimateIn(false);
    const t = setTimeout(() => setAnimateIn(true), 30);
    return () => clearTimeout(t);
  }, [value]);

  if (!value || value <= 0) return null;

  // Couleur par seuil
  let colorCls = 'bg-amber-500 text-white';
  let pulse = '';
  if (value >= 50) {
    colorCls = 'bg-red-500 text-white';
    pulse = 'animate-pulse';
  } else if (value >= 10) {
    colorCls = 'bg-orange-500 text-white';
  }

  const sizeCls = size === 'lg'
    ? 'min-w-[22px] h-[20px] px-1.5 text-[11px]'
    : 'min-w-[20px] h-[18px] px-1.5 text-[10px]';

  const display = value > 99 ? '99+' : value;

  return (
    <span
      title={tooltip || `${value}`}
      className={`inline-flex items-center justify-center rounded-full font-bold leading-none transition-all duration-200 ease-out ${sizeCls} ${colorCls} ${pulse} ${animateIn ? 'opacity-100 scale-100' : 'opacity-0 scale-50'} hover:ring-2 hover:ring-offset-1 hover:ring-current/40`}
    >
      {display}
    </span>
  );
}

export function Shell({ children, title, subtitle, right, allowedRoles, activeTab, tabs = [], tabGroups = null, onTabClick, badgeTooltips = {} }) {
  const router = useRouter();
  const [session, setSession] = useState(null);
  useEffect(() => {
    const s = getSession();
    if (!s) { router.replace('/'); return; }
    // 🔧 BUG FIX : supporter session.role ET session.role_code (compatibilité backend)
    const role = s.role || s.role_code;
    // 🛡️ Bypass admin : l'admin ARACOM peut accéder à TOUS les portails (mode aperçu/audit)
    const isAdmin = role === 'aracom_admin';
    if (allowedRoles && !isAdmin && !allowedRoles.includes(role)) { router.replace('/'); return; }
    // Normalise la session pour les composants enfants (rôle toujours accessible via .role)
    setSession({ ...s, role });
  }, [router, allowedRoles]);

  const logout = () => {
    // 🚫 PLUS d'envoi automatique de mail au logout : l'exposant garde un accès permanent
    //    via son magic link (et est protégé par mot de passe s'il en a défini un).
    try { clearSession(); } catch { /* ignore */ }
    try { sessionStorage.clear(); } catch { /* ignore */ }
    router.replace('/goodbye');
  };

  if (!session) return null;

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0 relative p-1">
              <Image src="/aracom-logo.png" alt="ARACOM" fill className="object-contain p-0.5" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-widest text-slate-500">ARACOM · Forum Rentrée 2026</div>
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
        {tabGroups && tabGroups.length > 0 ? (
          <NavWithGroups tabs={tabs} tabGroups={tabGroups} activeTab={activeTab} onTabClick={onTabClick} badgeTooltips={badgeTooltips} />
        ) : tabs.length > 0 ? (
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
        ) : null}
      </header>
      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6">
        {subtitle && (typeof subtitle === 'string'
          ? <p className="text-sm text-slate-500 mb-4">{subtitle}</p>
          : <div className="mb-4">{subtitle}</div>
        )}
        {children}
      </main>
    </div>
  );
}

function roleLabel(role) {
  return { aracom_admin: 'ARACOM admin', exposant: 'Exposant', pacific_centers_readonly: 'Pacific Centers' }[role] || role;
}

// Navigation à 5 groupes principaux avec dropdowns
function NavWithGroups({ tabs, tabGroups, activeTab, onTabClick, badgeTooltips = {} }) {
  const tabsByKey = Object.fromEntries(tabs.map(t => [t.key, t]));
  const [openMenu, setOpenMenu] = useState(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const buttonRefs = useRef({});

  // Recalcule la position du menu (fixed) quand on l'ouvre, ou au scroll/resize
  const updateMenuPos = (key) => {
    const btn = buttonRefs.current[key];
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const menuWidth = 224; // w-56 = 14rem = 224px
    let left = rect.left;
    // Empêcher le menu de déborder à droite de la fenêtre
    if (left + menuWidth > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - menuWidth - 8);
    }
    setMenuPos({ top: rect.bottom + 4, left });
  };

  useEffect(() => {
    if (!openMenu) return;
    updateMenuPos(openMenu);
    const onScrollOrResize = () => updateMenuPos(openMenu);
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    // Click outside / Escape pour fermer
    const onDocMouseDown = (e) => {
      const btn = buttonRefs.current[openMenu];
      const menu = document.getElementById('app-shell-dropdown-menu');
      if (btn?.contains(e.target)) return;
      if (menu?.contains(e.target)) return;
      setOpenMenu(null);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpenMenu(null); };
    document.addEventListener('mousedown', onDocMouseDown);
    document.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
      document.removeEventListener('mousedown', onDocMouseDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [openMenu]);

  const handleClick = (key) => {
    setOpenMenu(null);
    if (onTabClick) onTabClick(key);
    else tabsByKey[key]?.onClick?.();
  };

  const toggleMenu = (key) => {
    setOpenMenu(prev => prev === key ? null : key);
  };

  const isGroupActive = (group) => {
    if (group.single) return activeTab === (group.redirectTo || group.key);
    return group.items?.includes(activeTab);
  };

  // 🎯 Somme des badges des items d'un groupe (pour afficher un pastille sur le bouton parent)
  const groupBadgeTotal = (group) => {
    if (!group.items) return 0;
    return group.items.reduce((acc, k) => acc + (tabsByKey[k]?.badge || 0), 0);
  };

  // Trouve le label du tab actif au sein d'un groupe (pour afficher le sous-titre)
  const activeChildLabel = (group) => {
    if (!group.items) return null;
    if (!group.items.includes(activeTab)) return null;
    return tabsByKey[activeTab]?.label;
  };

  const activeGroup = openMenu ? tabGroups.find(g => g.key === openMenu) : null;

  return (
    <>
      <div className="max-w-[1600px] mx-auto px-2 sm:px-4 flex flex-wrap gap-1">
        {tabGroups.map(group => {
          const active = isGroupActive(group);
          const cls = `flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-t-md whitespace-nowrap transition ${active ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'}`;
          const Icon = getIcon(group.icon);

          if (group.single) {
            return (
              <button key={group.key} onClick={() => handleClick(group.redirectTo || group.key)} className={cls}>
                {Icon ? <Icon className="w-4 h-4" /> : <span className="text-base">{group.icon}</span>}
                <span>{group.label}</span>
              </button>
            );
          }

          const subLabel = activeChildLabel(group);
          const badgeTotal = groupBadgeTotal(group);
          return (
            <button
              key={group.key}
              ref={(el) => { buttonRefs.current[group.key] = el; }}
              onClick={() => toggleMenu(group.key)}
              className={cls}
              aria-haspopup="menu"
              aria-expanded={openMenu === group.key}
            >
              {Icon ? <Icon className="w-4 h-4" /> : <span className="text-base">{group.icon}</span>}
              <span>{group.label}</span>
              {subLabel && <span className="text-xs text-blue-500 font-normal hidden sm:inline">· {subLabel}</span>}
              <MenuBadge value={badgeTotal} tooltip={`${badgeTotal} action(s) à traiter dans ${group.label}`} />
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${openMenu === group.key ? 'rotate-180' : ''}`} />
            </button>
          );
        })}
      </div>
      {openMenu && activeGroup && !activeGroup.single && (
        <div
          id="app-shell-dropdown-menu"
          className="fixed z-[1000] w-64 bg-white rounded-lg border border-slate-200 shadow-2xl py-1.5 animate-in fade-in slide-in-from-top-1 duration-100"
          style={{ top: `${menuPos.top}px`, left: `${menuPos.left}px` }}
          role="menu"
        >
          {(() => {
            const items = activeGroup.items.map((k) => tabsByKey[k]).filter(Boolean);
            const normalItems = items.filter((t) => !t.adminTool);
            const adminItems = items.filter((t) => t.adminTool);
            const renderItem = (t) => {
              const itemActive = activeTab === t.key;
              const ItemIcon = getIcon(t.icon);
              const itemBadge = t.badge || 0;
              const tooltip = badgeTooltips[t.key] || (itemBadge > 0 ? `${itemBadge} dans ${t.label}` : t.label);
              return (
                <button
                  key={t.key}
                  onClick={() => handleClick(t.key)}
                  className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2.5 transition-all hover:translate-x-0.5 ${itemActive ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700 hover:bg-slate-50'}`}
                  role="menuitem"
                >
                  {ItemIcon ? <ItemIcon className={`w-4 h-4 shrink-0 ${itemActive ? 'text-blue-600' : 'text-slate-400'}`} /> : <span className="w-4 h-4 inline-block" />}
                  <span className="flex-1">{t.label}</span>
                  <MenuBadge value={itemBadge} tooltip={tooltip} />
                  {itemActive && itemBadge === 0 && <span className="text-blue-500 text-xs">●</span>}
                </button>
              );
            };
            return (
              <>
                {normalItems.map(renderItem)}
                {adminItems.length > 0 && (
                  <>
                    <div className="my-1 mx-2 border-t border-slate-200" />
                    <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Outils admin</div>
                    {adminItems.map(renderItem)}
                  </>
                )}
              </>
            );
          })()}
        </div>
      )}
    </>
  );
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

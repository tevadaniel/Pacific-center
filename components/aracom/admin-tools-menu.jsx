'use client';

/**
 * 🆕 SESSION 48k — Menu "Outils admin" déroulant pour regrouper les boutons secondaires
 * du header du Cockpit ARACOM (réduit la charge visuelle).
 *
 * Regroupe : PortalSwitcher, PushToggle (notifications), AlertsBadge, IntegrityAuditButton, Simulation E2E.
 * Les éléments d'origine sont passés en props (composants prêts à monter dans les MenuItems).
 *
 * Reste à l'extérieur du menu (toujours visible dans le header) :
 *  - 🛡️ TEST MAIL (urgence)
 *  - 📱 Mode Jour J (action principale)
 */
import { Settings, ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';

export default function AdminToolsMenu({
  portalSwitcher,
  pushToggle,
  alertsBadge,
  integrityAuditButton,
  onSimulation,
  // 🆕 Compte d'alertes pour pastille rouge sur le bouton
  alertsCount = 0,
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="relative inline-flex items-center gap-1.5 rounded-md bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold px-2.5 py-1.5 shadow-sm transition-colors"
        title="Outils admin (Portails, Audit, Simulation, Notifications, Alertes)"
        data-testid="admin-tools-menu-trigger"
      >
        <Settings className="w-4 h-4" />
        <span className="hidden sm:inline">Outils admin</span>
        <ChevronDown className="w-3 h-3 opacity-70" />
        {alertsCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center border border-white shadow">
            {alertsCount > 99 ? '99+' : alertsCount}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 p-1.5">
        <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold py-1">
          Navigation
        </DropdownMenuLabel>
        <div className="px-2 py-1">{portalSwitcher}</div>

        <DropdownMenuSeparator />

        <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold py-1">
          Notifications & Alertes
        </DropdownMenuLabel>
        <div className="flex items-center justify-between gap-2 px-2 py-1.5 text-xs text-slate-700">
          <span className="font-medium">Push notifications</span>
          {pushToggle}
        </div>
        <div className="flex items-center justify-between gap-2 px-2 py-1.5 text-xs text-slate-700">
          <span className="font-medium">Alertes système</span>
          {alertsBadge}
        </div>

        <DropdownMenuSeparator />

        <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold py-1">
          Outils techniques
        </DropdownMenuLabel>
        <div className="px-2 py-1">{integrityAuditButton}</div>
        <DropdownMenuItem
          onClick={onSimulation}
          className="cursor-pointer text-xs font-medium focus:bg-indigo-50"
          data-testid="admin-tools-menu-simulation"
        >
          🧪 <span className="ml-1.5">Simulation E2E</span>
          <span className="ml-auto text-[10px] text-slate-400">Test des flux</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

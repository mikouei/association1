'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Settings,
  Building2,
  UserCog,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const platformNavItems: NavItem[] = [
  { href: '/platform/dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
  { href: '/platform/associations', label: 'Associations', icon: Building2 },
  { href: '/platform/deletion-requests', label: 'Suppressions', icon: Trash2 },
  { href: '/platform/settings', label: 'Paramètres', icon: Settings },
];

const adminNavItems: NavItem[] = [
  { href: '/dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
  { href: '/members', label: 'Membres', icon: Users },
  { href: '/payments', label: 'Cotisations', icon: CreditCard },
  { href: '/admins', label: 'Administrateurs', icon: UserCog },
  { href: '/settings', label: 'Paramètres', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, isPlatformAuth, platformLogout, logout, selectedAssociation } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  const navItems = isPlatformAuth ? platformNavItems : adminNavItems;
  const handleLogout = isPlatformAuth ? platformLogout : logout;

  return (
    <aside
      className={cn(
        'h-screen flex flex-col transition-all duration-300',
        'bg-[#1F4E79] text-white',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Logo */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-[#2A5F94]">
        {!collapsed && (
          <div>
            <h1 className="text-lg font-bold font-[Poppins]">Kotiz</h1>
            {selectedAssociation && (
              <p className="text-xs text-white/70 truncate">{selectedAssociation.name}</p>
            )}
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 rounded hover:bg-[#2A5F94] transition-colors"
        >
          {collapsed ? (
            <ChevronRight className="w-5 h-5" />
          ) : (
            <ChevronLeft className="w-5 h-5" />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 space-y-1 px-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
                isActive
                  ? 'bg-[#F5A623] text-[#1F2937] font-semibold'
                  : 'text-white/80 hover:bg-[#2A5F94] hover:text-white'
              )}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* User info & Logout */}
      <div className="p-4 border-t border-[#2A5F94]">
        {!collapsed && user && (
          <div className="mb-3">
            <p className="text-sm font-medium truncate">{user.email || user.name}</p>
            <p className="text-xs text-white/60">
              {isPlatformAuth ? 'Super Admin' : 'Administrateur'}
            </p>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2 text-white/80 hover:bg-[#2A5F94] hover:text-white rounded-lg transition-colors"
        >
          <LogOut className="w-5 h-5" />
          {!collapsed && <span>Déconnexion</span>}
        </button>
      </div>
    </aside>
  );
}

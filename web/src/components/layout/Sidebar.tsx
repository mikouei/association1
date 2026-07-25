'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import {
  SquaresFour,
  Users,
  Wallet,
  Gear,
  Buildings,
  UserCircleGear,
  CaretLeft,
  CaretRight,
  SignOut,
  Trash,
  UsersThree,
} from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';

interface NavItem {
  href: string;
  label: string;
  icon: Icon;
  requiresFeature?: string;
}

const platformNavItems: NavItem[] = [
  { href: '/platform/dashboard', label: 'Tableau de bord', icon: SquaresFour },
  { href: '/platform/associations', label: 'Associations', icon: Buildings },
  { href: '/platform/deletion-requests', label: 'Suppressions', icon: Trash },
  { href: '/platform/settings', label: 'Paramètres', icon: Gear },
];

const adminNavItems: NavItem[] = [
  { href: '/dashboard', label: 'Tableau de bord', icon: SquaresFour },
  { href: '/members', label: 'Membres', icon: Users },
  { href: '/payments', label: 'Cotisations', icon: Wallet },
  { href: '/tontines', label: 'Tontines', icon: UsersThree, requiresFeature: 'tontines' },
  { href: '/admins', label: 'Administrateurs', icon: UserCircleGear },
  { href: '/settings', label: 'Paramètres', icon: Gear },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, isPlatformAuth, platformLogout, logout, selectedAssociation } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  // Charger les paramètres de l'association (uniquement pour les admins d'association)
  const { data: settings } = useQuery({
    queryKey: ['association-settings'],
    queryFn: async () => {
      const response = await api.get('/auth/association-settings');
      return response.data as { tontinesEnabled?: boolean; announcementsEnabled?: boolean };
    },
    enabled: !isPlatformAuth, // Ne charger que pour les admins d'association
    staleTime: 5 * 60 * 1000, // Cache 5 minutes
  });

  // Filtrer les items de navigation selon les features activées
  const navItems = useMemo(() => {
    if (isPlatformAuth) return platformNavItems;
    
    return adminNavItems.filter(item => {
      if (!item.requiresFeature) return true;
      if (item.requiresFeature === 'tontines') {
        return settings?.tontinesEnabled === true;
      }
      return true;
    });
  }, [isPlatformAuth, settings?.tontinesEnabled]);

  const handleLogout = isPlatformAuth ? platformLogout : logout;

  return (
    <aside
      className={cn(
        'h-screen flex flex-col transition-all duration-300',
        'bg-[var(--color-secondary)] text-white',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Logo */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-[var(--color-secondary-pressed)]">
        {!collapsed && (
          <div>
            <h1 className="text-lg font-bold font-[var(--font-heading)]">Kotiz</h1>
            {selectedAssociation && (
              <p className="text-xs text-white/70 truncate">{selectedAssociation.name}</p>
            )}
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 rounded hover:bg-[var(--color-secondary-pressed)] transition-colors"
        >
          {collapsed ? (
            <CaretRight size={20} weight="bold" />
          ) : (
            <CaretLeft size={20} weight="bold" />
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
                'flex items-center gap-3 px-3 py-2 rounded-[var(--radius-button)] transition-colors',
                isActive
                  ? 'bg-[var(--color-primary)] text-[var(--color-text-on-primary)] font-semibold'
                  : 'text-white/80 hover:bg-[var(--color-secondary-pressed)] hover:text-white'
              )}
            >
              <Icon size={20} weight={isActive ? 'fill' : 'regular'} className="flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* User info & Logout */}
      <div className="p-4 border-t border-[var(--color-secondary-pressed)]">
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
          className="flex items-center gap-3 w-full px-3 py-2 text-white/80 hover:bg-[var(--color-secondary-pressed)] hover:text-white rounded-[var(--radius-button)] transition-colors"
        >
          <SignOut size={20} weight="regular" />
          {!collapsed && <span>Déconnexion</span>}
        </button>
      </div>
    </aside>
  );
}

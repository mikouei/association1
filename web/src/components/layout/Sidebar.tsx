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
  QrCode,
  Eye,
  Calendar,
} from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import { getVocab } from '@/utils/vocabulary';

interface NavItem {
  href: string;
  label: string;
  icon: Icon;
  requiresFeature?: string;
  allowedRoles?: string[];
}

const platformNavItems: NavItem[] = [
  { href: '/platform/dashboard', label: 'Tableau de bord', icon: SquaresFour },
  { href: '/platform/associations', label: 'Associations', icon: Buildings },
  { href: '/platform/deletion-requests', label: 'Suppressions', icon: Trash },
  { href: '/platform/settings', label: 'Paramètres', icon: Gear },
];

const adminNavItems: NavItem[] = [
  { href: '/dashboard', label: 'Tableau de bord', icon: SquaresFour, allowedRoles: ['ADMIN'] },
  { href: '/members', label: 'Membres', icon: Users, allowedRoles: ['ADMIN'] },
  { href: '/payments', label: 'Cotisations', icon: Wallet, allowedRoles: ['ADMIN'] },
  { href: '/events', label: 'Événements', icon: Calendar, allowedRoles: ['ADMIN'] },
  { href: '/tontines', label: 'Tontines', icon: UsersThree, requiresFeature: 'tontines', allowedRoles: ['ADMIN'] },
  { href: '/admins', label: 'Gestion des accès', icon: UserCircleGear, allowedRoles: ['ADMIN'] },
  { href: '/audit', label: 'Consultation', icon: Eye, allowedRoles: ['ADMIN', 'AUDITEUR'] },
  { href: '/settings', label: 'Paramètres', icon: Gear, allowedRoles: ['ADMIN'] },
];

// Labels des rôles
const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrateur',
  SCANNER: 'Scanner',
  AUDITEUR: 'Auditeur',
};

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ isOpen = false, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { user, isPlatformAuth, platformLogout, logout, selectedAssociation, association } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const vocab = getVocab(association?.type);

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

  // Filtrer les items de navigation selon les features activées et le rôle
  const navItems = useMemo(() => {
    if (isPlatformAuth) return platformNavItems;
    
    const userRole = user?.role || 'MEMBER';
    
    return adminNavItems.filter(item => {
      // Vérifier le rôle
      if (item.allowedRoles && !item.allowedRoles.includes(userRole)) {
        return false;
      }
      // Vérifier les features
      if (item.requiresFeature === 'tontines') {
        return settings?.tontinesEnabled === true;
      }
      return true;
    }).map(item => {
      // Adapter le vocabulaire selon le type d'organisation (association/syndic)
      if (item.href === '/members') return { ...item, label: vocab.Members };
      if (item.href === '/payments') return { ...item, label: vocab.Contributions };
      return item;
    });
  }, [isPlatformAuth, settings?.tontinesEnabled, user?.role, vocab.Members, vocab.Contributions]);

  const handleLogout = isPlatformAuth ? platformLogout : logout;

  return (
    <>
      {/* Fond sombre mobile, visible uniquement quand le tiroir est ouvert */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        className={cn(
          'flex flex-col transition-all duration-300 z-50',
          'bg-[var(--color-secondary)] text-white',
          // Desktop : menu statique dans le flux, largeur selon collapsed
          'md:static md:h-screen md:translate-x-0',
          collapsed ? 'md:w-16' : 'md:w-64',
          // Mobile : tiroir fixe en superposition, toujours largeur 64, glisse depuis la gauche
          'fixed inset-y-0 left-0 h-screen w-64',
          isOpen ? 'translate-x-0' : '-translate-x-full'
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
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="hidden md:flex items-center justify-center min-w-[40px] min-h-[40px] rounded-full bg-white/10 hover:bg-white/20 active:bg-white/30 transition-colors"
              aria-label={collapsed ? 'Étendre le menu' : 'Réduire le menu'}
            >
              {collapsed ? (
                <CaretRight size={20} weight="bold" />
              ) : (
                <CaretLeft size={20} weight="bold" />
              )}
            </button>
            {/* Bouton fermer, visible uniquement sur mobile (le tiroir est toujours en pleine largeur côté mobile) */}
            <button
              onClick={onClose}
              className="md:hidden flex items-center justify-center min-w-[40px] min-h-[40px] rounded-full bg-white/10 hover:bg-white/20 active:bg-white/30 transition-colors"
              aria-label="Fermer le menu"
            >
              <CaretLeft size={20} weight="bold" />
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 space-y-1 px-2 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
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
                {isPlatformAuth ? 'Super Admin' : ROLE_LABELS[user.role] || user.role}
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
    </>
  );
}

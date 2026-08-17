'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { FullPageLoader } from '@/components/ui/LoadingSpinner';

interface AuthGuardProps {
  children: React.ReactNode;
  requirePlatformAuth?: boolean;
}

export function AuthGuard({ children, requirePlatformAuth = false }: AuthGuardProps) {
  const { user, loading, isPlatformAuth } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;

    // Si pas connecté
    if (!user) {
      if (requirePlatformAuth || pathname.startsWith('/platform')) {
        router.push('/platform/login');
      } else {
        router.push('/login');
      }
      return;
    }

    // Si connecté en tant que platform mais accède à des routes non-platform
    if (isPlatformAuth && !pathname.startsWith('/platform')) {
      router.push('/platform/dashboard');
      return;
    }

    // Si connecté en tant qu'admin mais accède à des routes platform
    if (!isPlatformAuth && pathname.startsWith('/platform') && !pathname.includes('login')) {
      router.push('/dashboard');
      return;
    }
  }, [user, loading, isPlatformAuth, pathname, router, requirePlatformAuth]);

  if (loading) {
    return <FullPageLoader />;
  }

  if (!user) {
    return <FullPageLoader />;
  }

  return <>{children}</>;
}

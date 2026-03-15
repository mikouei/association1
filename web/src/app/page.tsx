'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { FullPageLoader } from '@/components/ui';

export default function HomePage() {
  const router = useRouter();
  const { user, loading, isPlatformAuth } = useAuth();

  useEffect(() => {
    if (loading) return;

    if (user) {
      if (isPlatformAuth) {
        router.push('/platform/dashboard');
      } else {
        router.push('/dashboard');
      }
    } else {
      router.push('/login');
    }
  }, [user, loading, isPlatformAuth, router]);

  return <FullPageLoader />;
}

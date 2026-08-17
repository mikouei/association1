'use client';

import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { AuthGuard } from './AuthGuard';

interface DashboardLayoutProps {
  children: React.ReactNode;
  requirePlatformAuth?: boolean;
}

export function DashboardLayout({ children, requirePlatformAuth = false }: DashboardLayoutProps) {
  return (
    <AuthGuard requirePlatformAuth={requirePlatformAuth}>
      <div className="flex h-screen bg-gray-100">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto p-6">
            {children}
          </main>
        </div>
      </div>
    </AuthGuard>
  );
}

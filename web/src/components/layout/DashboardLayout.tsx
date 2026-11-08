'use client';
import { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { AuthGuard } from './AuthGuard';
interface DashboardLayoutProps {
  children: React.ReactNode;
  requirePlatformAuth?: boolean;
}
export function DashboardLayout({ children, requirePlatformAuth = false }: DashboardLayoutProps) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  return (
    <AuthGuard requirePlatformAuth={requirePlatformAuth}>
      <div className="flex h-screen bg-gray-100">
        <Sidebar isOpen={mobileSidebarOpen} onClose={() => setMobileSidebarOpen(false)} />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header onMenuClick={() => setMobileSidebarOpen(true)} />
          <main className="flex-1 overflow-y-auto p-6">
            {children}
          </main>
        </div>
      </div>
    </AuthGuard>
  );
}

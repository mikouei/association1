'use client';

import { useQuery } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout';
import { Card, CardHeader, CardTitle, CardContent, LoadingSpinner } from '@/components/ui';
import { api } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { Users, Wallet, TrendUp, WarningCircle } from '@phosphor-icons/react';
import { formatCurrency } from '@/lib/utils';

export default function DashboardPage() {
  const { selectedAssociation } = useAuth();

  const { data: members, isLoading: loadingMembers } = useQuery({
    queryKey: ['members'],
    queryFn: async () => {
      const response = await api.get('/members');
      return response.data;
    },
  });

  const { data: years, isLoading: loadingYears } = useQuery({
    queryKey: ['years'],
    queryFn: async () => {
      const response = await api.get('/years');
      return response.data;
    },
  });

  const activeYear = years?.find((y: { active: boolean }) => y.active);

  const { data: payments } = useQuery({
    queryKey: ['payments', activeYear?.id],
    queryFn: async () => {
      if (!activeYear) return null;
      const response = await api.get(`/payments/year/${activeYear.id}`);
      return response.data;
    },
    enabled: !!activeYear,
  });

  const stats = {
    totalMembers: members?.length || 0,
    activeMembers: members?.filter((m: { active: boolean }) => m.active).length || 0,
    totalCollected: payments?.members?.reduce(
      (sum: number, m: { totalPaid: number }) => sum + m.totalPaid,
      0
    ) || 0,
    expectedTotal: (members?.length || 0) * (activeYear?.monthlyAmount || 0) * 12,
  };

  const collectionPercentage = stats.expectedTotal > 0
    ? Math.round((stats.totalCollected / stats.expectedTotal) * 100)
    : 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">Tableau de bord</h1>
          <p className="text-[var(--color-text-muted)]">
            {selectedAssociation?.name || 'Bienvenue dans Kotiz'}
          </p>
        </div>

        {/* Statistiques */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-[var(--color-warning-bg)] rounded-[var(--radius-icon)]">
                  <Users size={24} weight="duotone" className="text-[var(--color-primary)]" />
                </div>
                <div>
                  <p className="text-sm text-[var(--color-text-muted)]">Total Membres</p>
                  <p className="text-2xl font-bold text-[var(--color-text)]">
                    {loadingMembers ? '-' : stats.totalMembers}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-[var(--color-success-bg)] rounded-[var(--radius-icon)]">
                  <Users size={24} weight="duotone" className="text-[var(--color-success)]" />
                </div>
                <div>
                  <p className="text-sm text-[var(--color-text-muted)]">Membres Actifs</p>
                  <p className="text-2xl font-bold text-[var(--color-text)]">
                    {loadingMembers ? '-' : stats.activeMembers}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-[#E0F2FE] rounded-[var(--radius-icon)]">
                  <Wallet size={24} weight="duotone" className="text-[var(--color-secondary)]" />
                </div>
                <div>
                  <p className="text-sm text-[var(--color-text-muted)]">Collecté</p>
                  <p className="text-2xl font-bold text-[var(--color-text)]">
                    {formatCurrency(stats.totalCollected)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-[var(--color-warning-bg)] rounded-[var(--radius-icon)]">
                  <TrendUp size={24} weight="duotone" className="text-[var(--color-warning)]" />
                </div>
                <div>
                  <p className="text-sm text-[var(--color-text-muted)]">Taux de collecte</p>
                  <p className="text-2xl font-bold text-[var(--color-text)]">
                    {collectionPercentage}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Année active */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Année en cours</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingYears ? (
                <LoadingSpinner />
              ) : activeYear ? (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-[var(--color-text-muted)]">Année</span>
                    <span className="font-semibold">{activeYear.year}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[var(--color-text-muted)]">Cotisation mensuelle</span>
                    <span className="font-semibold">
                      {formatCurrency(activeYear.monthlyAmount)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[var(--color-text-muted)]">Cotisation annuelle</span>
                    <span className="font-semibold">
                      {formatCurrency(activeYear.monthlyAmount * 12)}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-[var(--color-text-muted)]">
                  <WarningCircle size={48} weight="duotone" className="mx-auto mb-2 text-[var(--color-border)]" />
                  <p>Aucune année active</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Progression des collectes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--color-text-muted)]">Collecté</span>
                  <span className="font-semibold">{formatCurrency(stats.totalCollected)}</span>
                </div>
                <div className="w-full bg-[var(--color-border-light)] rounded-full h-3">
                  <div
                    className="bg-[var(--color-primary)] h-3 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(collectionPercentage, 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--color-text-muted)]">Objectif</span>
                  <span className="font-semibold">{formatCurrency(stats.expectedTotal)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}

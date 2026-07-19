'use client';

import { useQuery } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout';
import { Card, CardHeader, CardTitle, CardContent, LoadingSpinner } from '@/components/ui';
import { api } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { Users, Wallet, TrendUp, WarningCircle, Heart, Gift, HandHeart, Star, SmileyMeh } from '@phosphor-icons/react';
import { formatCurrency } from '@/lib/utils';

interface ExceptionalEvent {
  id: string;
  title: string;
  type: string;
  totalCollected: number;
  participantsCount: number;
}

interface ExceptionalStats {
  events: ExceptionalEvent[];
  summary: {
    totalEvents: number;
    totalCollected: number;
    totalParticipations: number;
  };
}

const getTypeIcon = (type: string) => {
  const props = { size: 20, weight: 'duotone' as const, className: 'text-[var(--color-primary)]' };
  switch (type) {
    case 'décès': return <SmileyMeh {...props} />;
    case 'mariage': return <Heart {...props} />;
    case 'anniversaire': return <Gift {...props} />;
    case 'solidarité': return <HandHeart {...props} />;
    default: return <Star {...props} />;
  }
};

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

  // Fetch exceptional events stats
  const { data: exceptionalStats, isLoading: loadingExceptional } = useQuery<ExceptionalStats>({
    queryKey: ['exceptional-stats'],
    queryFn: async () => {
      const response = await api.get('/exceptional/stats');
      return response.data;
    },
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

        {/* Statistiques principales */}
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

        {/* Année active et Progression */}
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

        {/* Statistiques des événements exceptionnels */}
        <Card>
          <CardHeader>
            <CardTitle>Événements exceptionnels</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingExceptional ? (
              <LoadingSpinner />
            ) : exceptionalStats && exceptionalStats.events.length > 0 ? (
              <div className="space-y-4">
                {/* Résumé global */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="text-center p-4 bg-[var(--color-warning-bg)] rounded-[var(--radius-card)]">
                    <p className="text-2xl font-bold text-[var(--color-primary)]">
                      {exceptionalStats.summary.totalEvents}
                    </p>
                    <p className="text-sm text-[var(--color-text-muted)]">Événements</p>
                  </div>
                  <div className="text-center p-4 bg-[var(--color-success-bg)] rounded-[var(--radius-card)]">
                    <p className="text-2xl font-bold text-[var(--color-success)]">
                      {formatCurrency(exceptionalStats.summary.totalCollected)}
                    </p>
                    <p className="text-sm text-[var(--color-text-muted)]">Collecté</p>
                  </div>
                  <div className="text-center p-4 bg-[#E0F2FE] rounded-[var(--radius-card)]">
                    <p className="text-2xl font-bold text-[var(--color-secondary)]">
                      {exceptionalStats.summary.totalParticipations}
                    </p>
                    <p className="text-sm text-[var(--color-text-muted)]">Participations</p>
                  </div>
                </div>

                {/* Liste des événements récents */}
                <div className="space-y-3">
                  <p className="text-sm font-medium text-[var(--color-text-muted)]">Événements récents</p>
                  {exceptionalStats.events.slice(0, 5).map((event) => (
                    <div
                      key={event.id}
                      className="flex items-center justify-between p-3 bg-[var(--color-background)] rounded-[var(--radius-input)]"
                    >
                      <div className="flex items-center gap-3">
                        {getTypeIcon(event.type)}
                        <div>
                          <p className="font-medium text-[var(--color-text)]">{event.title}</p>
                          <p className="text-xs text-[var(--color-text-muted)] capitalize">{event.type}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-[var(--color-primary)]">
                          {formatCurrency(event.totalCollected)}
                        </p>
                        <p className="text-xs text-[var(--color-text-muted)]">
                          {event.participantsCount} participant{event.participantsCount > 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-[var(--color-text-muted)]">
                <Gift size={48} weight="duotone" className="mx-auto mb-2 text-[var(--color-border)]" />
                <p>Aucun événement exceptionnel</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

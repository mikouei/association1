'use client';

import { useQuery } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout';
import { Card, CardHeader, CardTitle, CardContent, LoadingSpinner } from '@/components/ui';
import { api } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { Users, CreditCard, TrendingUp, AlertCircle } from 'lucide-react';
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
          <h1 className="text-2xl font-bold text-gray-900">Tableau de bord</h1>
          <p className="text-gray-500">
            {selectedAssociation?.name || 'Bienvenue dans AssocManager'}
          </p>
        </div>

        {/* Statistiques */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Membres</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {loadingMembers ? '-' : stats.totalMembers}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-100 rounded-lg">
                  <Users className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Membres Actifs</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {loadingMembers ? '-' : stats.activeMembers}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-purple-100 rounded-lg">
                  <CreditCard className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Collecté</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatCurrency(stats.totalCollected)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-orange-100 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Taux de collecte</p>
                  <p className="text-2xl font-bold text-gray-900">
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
                    <span className="text-gray-500">Année</span>
                    <span className="font-semibold">{activeYear.year}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Cotisation mensuelle</span>
                    <span className="font-semibold">
                      {formatCurrency(activeYear.monthlyAmount)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Cotisation annuelle</span>
                    <span className="font-semibold">
                      {formatCurrency(activeYear.monthlyAmount * 12)}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <AlertCircle className="w-12 h-12 mx-auto mb-2 text-gray-300" />
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
                  <span className="text-gray-500">Collecté</span>
                  <span className="font-semibold">{formatCurrency(stats.totalCollected)}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-blue-600 h-3 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(collectionPercentage, 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Objectif</span>
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

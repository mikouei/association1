'use client';

import { useQuery } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout';
import { Card, CardHeader, CardTitle, CardContent, Badge, LoadingSpinner } from '@/components/ui';
import { platformApi } from '@/services/api';
import { Association } from '@/types';
import { Building2, Users, CheckCircle, XCircle } from 'lucide-react';
import Link from 'next/link';

export default function PlatformDashboardPage() {
  const { data: associations, isLoading } = useQuery({
    queryKey: ['platform-associations'],
    queryFn: async () => {
      const response = await platformApi.get('/platform/associations');
      return response.data as Association[];
    },
  });

  const stats = {
    total: associations?.length || 0,
    active: associations?.filter(a => a.active).length || 0,
    inactive: associations?.filter(a => !a.active).length || 0,
  };

  return (
    <DashboardLayout requirePlatformAuth>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tableau de bord Platform</h1>
          <p className="text-gray-500">Vue d'ensemble de toutes les associations</p>
        </div>

        {/* Statistiques */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <Building2 className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Associations</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-100 rounded-lg">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Actives</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.active}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-red-100 rounded-lg">
                  <XCircle className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Inactives</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.inactive}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Liste récente des associations */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Associations récentes</CardTitle>
              <Link
                href="/platform/associations"
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                Voir tout →
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <LoadingSpinner size="lg" />
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {associations?.slice(0, 5).map((assoc) => (
                  <div
                    key={assoc.id}
                    className="flex items-center justify-between px-6 py-4 hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Building2 className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{assoc.name}</p>
                        <p className="text-sm text-gray-500">{assoc.code}</p>
                      </div>
                    </div>
                    <Badge variant={assoc.active ? 'success' : 'danger'}>
                      {assoc.active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

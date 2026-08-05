'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout';
import { Card, CardContent, Badge, Input } from '@/components/ui';
import { api } from '@/services/api';
import { Search, Calendar, Users, TrendingUp, DollarSign, FileText } from 'lucide-react';
import { formatNumber } from '@/lib/utils';

interface AuditData {
  years: Array<{ id: string; year: number; monthlyAmount: number; active: boolean }>;
  selectedYear: { id: string; year: number; monthlyAmount: number } | null;
  members: Array<{
    id: string;
    name: string;
    customFieldValue: string;
    email: string;
    phone: string;
    monthly: {
      totalPaid: number;
      totalDue: number;
      paymentsByMonth: Record<number, { paid: boolean; amountPaid: number; amountDue: number }>;
    };
    exceptional: {
      totalPaid: number;
      recentPayments: Array<{
        id: string;
        amount: number;
        paymentDate: string;
        contributionTitle: string;
        contributionType: string;
      }>;
    };
  }>;
  exceptional: Array<{
    id: string;
    title: string;
    type: string;
    eventDate: string | null;
    paymentCount: number;
    totalCollected: number;
  }>;
  stats: {
    totalPaid: number;
    totalDue: number;
    remaining: number;
    percentage: number;
    membersCount: number;
  } | null;
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

const MONTHS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

export default function AuditPage() {
  const [selectedYearId, setSelectedYearId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['audit-view', selectedYearId, searchTerm, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedYearId) params.append('yearId', selectedYearId);
      if (searchTerm) params.append('search', searchTerm);
      params.append('page', page.toString());
      params.append('limit', '30');
      
      const response = await api.get(`/payments/audit-view?${params.toString()}`);
      return response.data as AuditData;
    },
  });

  const getStatusColor = (percentage: number) => {
    if (percentage >= 100) return 'text-green-600 bg-green-50';
    if (percentage >= 50) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Consultation des paiements</h1>
          <p className="text-gray-500">
            Vue en lecture seule des cotisations et paiements
          </p>
        </div>

        {/* Statistiques globales */}
        {data?.stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Users className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{data.stats.membersCount}</p>
                    <p className="text-sm text-gray-500">Membres actifs</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <DollarSign className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{formatNumber(data.stats.totalPaid)}</p>
                    <p className="text-sm text-gray-500">Total collecté (FCFA)</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-orange-100 rounded-lg">
                    <TrendingUp className="w-5 h-5 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{formatNumber(data.stats.remaining)}</p>
                    <p className="text-sm text-gray-500">Reste à collecter</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${getStatusColor(data.stats.percentage)}`}>
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{data.stats.percentage}%</p>
                    <p className="text-sm text-gray-500">Taux de recouvrement</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filtres */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Rechercher un membre..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setPage(1);
                    }}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="w-48">
                <select
                  value={selectedYearId}
                  onChange={(e) => {
                    setSelectedYearId(e.target.value);
                    setPage(1);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Année active</option>
                  {data?.years.map((year) => (
                    <option key={year.id} value={year.id}>
                      {year.year} {year.active && '(active)'}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tableau des membres */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Membre</th>
                    {MONTHS.map((month, idx) => (
                      <th key={idx} className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                        {month}
                      </th>
                    ))}
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {isLoading ? (
                    <tr>
                      <td colSpan={14} className="px-4 py-8 text-center text-gray-500">
                        Chargement...
                      </td>
                    </tr>
                  ) : data?.members.length === 0 ? (
                    <tr>
                      <td colSpan={14} className="px-4 py-8 text-center text-gray-500">
                        Aucun membre trouvé
                      </td>
                    </tr>
                  ) : (
                    data?.members.map((member) => (
                      <tr key={member.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium text-gray-900">{member.name}</p>
                            <p className="text-xs text-gray-500">{member.customFieldValue}</p>
                          </div>
                        </td>
                        {Array.from({ length: 12 }, (_, idx) => {
                          const monthData = member.monthly.paymentsByMonth[idx + 1];
                          return (
                            <td key={idx} className="px-2 py-3 text-center">
                              {monthData ? (
                                <span
                                  className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium ${
                                    monthData.paid
                                      ? 'bg-green-100 text-green-700'
                                      : monthData.amountPaid > 0
                                      ? 'bg-yellow-100 text-yellow-700'
                                      : 'bg-gray-100 text-gray-400'
                                  }`}
                                  title={`${formatNumber(monthData.amountPaid)} / ${formatNumber(monthData.amountDue)} FCFA`}
                                >
                                  {monthData.paid ? '✓' : monthData.amountPaid > 0 ? '◐' : '○'}
                                </span>
                              ) : (
                                <span className="text-gray-300">-</span>
                              )}
                            </td>
                          );
                        })}
                        <td className="px-4 py-3 text-right">
                          <div>
                            <p className="font-medium text-gray-900">
                              {formatNumber(member.monthly.totalPaid)}
                            </p>
                            <p className="text-xs text-gray-500">
                              / {formatNumber(member.monthly.totalDue)}
                            </p>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Pagination */}
        {data?.pagination && data.pagination.pages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Page {data.pagination.page} sur {data.pagination.pages} ({data.pagination.total} membres)
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 text-sm border rounded disabled:opacity-50"
              >
                Précédent
              </button>
              <button
                onClick={() => setPage(p => Math.min(data.pagination.pages, p + 1))}
                disabled={page === data.pagination.pages}
                className="px-3 py-1 text-sm border rounded disabled:opacity-50"
              >
                Suivant
              </button>
            </div>
          </div>
        )}

        {/* Cotisations exceptionnelles */}
        {data?.exceptional && data.exceptional.length > 0 && (
          <Card>
            <CardContent className="p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Cotisations exceptionnelles récentes
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.exceptional.map((item) => (
                  <div key={item.id} className="p-4 border rounded-lg">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-gray-900">{item.title}</p>
                        <Badge variant="secondary" className="mt-1">
                          {item.type}
                        </Badge>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-green-600">
                          {formatNumber(item.totalCollected)}
                        </p>
                        <p className="text-xs text-gray-500">
                          {item.paymentCount} paiement(s)
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}

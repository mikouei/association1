'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout';
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Badge, Modal, LoadingSpinner } from '@/components/ui';
import { api } from '@/services/api';
import { formatCurrency, MONTHS } from '@/lib/utils';
import { CreditCard, Check } from 'lucide-react';

interface MemberPayment {
  memberId: string;
  memberName: string;
  customFieldValue?: string;
  months: { month: number; amountPaid: number; isPaid: boolean }[];
  totalPaid: number;
  totalDue: number;
  remaining: number;
  percentage: number;
}

interface Year {
  id: string;
  year: number;
  monthlyAmount: number;
  active: boolean;
}

export default function PaymentsPage() {
  const queryClient = useQueryClient();
  const [selectedYear, setSelectedYear] = useState<Year | null>(null);
  const [paymentModal, setPaymentModal] = useState<{
    isOpen: boolean;
    member: MemberPayment | null;
    month: number;
  }>({ isOpen: false, member: null, month: 1 });
  const [paymentAmount, setPaymentAmount] = useState('');

  const { data: years, isLoading: loadingYears } = useQuery({
    queryKey: ['years'],
    queryFn: async () => {
      const response = await api.get('/years');
      const yearsData = response.data as Year[];
      const active = yearsData.find(y => y.active);
      if (active && !selectedYear) setSelectedYear(active);
      return yearsData;
    },
  });

  const { data: payments, isLoading: loadingPayments } = useQuery({
    queryKey: ['payments', selectedYear?.id],
    queryFn: async () => {
      if (!selectedYear) return null;
      const response = await api.get(`/payments/year/${selectedYear.id}`);
      return response.data as { year: Year; members: MemberPayment[] };
    },
    enabled: !!selectedYear,
  });

  const paymentMutation = useMutation({
    mutationFn: async (data: { memberId: string; yearId: string; month: number; amountPaid: number }) => {
      const response = await api.post('/payments', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      setPaymentModal({ isOpen: false, member: null, month: 1 });
      setPaymentAmount('');
    },
  });

  const openPaymentModal = (member: MemberPayment, month: number) => {
    const monthData = member.months.find(m => m.month === month);
    setPaymentAmount(monthData?.amountPaid?.toString() || selectedYear?.monthlyAmount.toString() || '');
    setPaymentModal({ isOpen: true, member, month });
  };

  const handlePayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentModal.member || !selectedYear) return;

    paymentMutation.mutate({
      memberId: paymentModal.member.memberId,
      yearId: selectedYear.id,
      month: paymentModal.month,
      amountPaid: parseFloat(paymentAmount),
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Cotisations</h1>
            <p className="text-gray-500">Gestion des cotisations mensuelles</p>
          </div>

          {/* Sélecteur d'année */}
          <div className="flex items-center gap-4">
            <select
              value={selectedYear?.id || ''}
              onChange={(e) => {
                const year = years?.find(y => y.id === e.target.value);
                setSelectedYear(year || null);
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {years?.map((year) => (
                <option key={year.id} value={year.id}>
                  {year.year} - {formatCurrency(year.monthlyAmount)}/mois
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Tableau des cotisations */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>
                Cotisations {selectedYear?.year} - {formatCurrency(selectedYear?.monthlyAmount || 0)}/mois
              </CardTitle>
              <Badge variant="info">
                {payments?.members?.length || 0} membre(s)
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loadingPayments || loadingYears ? (
              <div className="flex justify-center py-12">
                <LoadingSpinner size="lg" />
              </div>
            ) : payments?.members?.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                Aucun membre pour cette année
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                        Membre
                      </th>
                      {MONTHS.map((month, idx) => (
                        <th key={idx} className="px-2 py-3 text-center text-xs font-semibold text-gray-600">
                          {month.substring(0, 3)}
                        </th>
                      ))}
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {payments?.members?.map((member) => (
                      <tr key={member.memberId} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900">{member.memberName}</p>
                          <p className="text-xs text-gray-500">{member.customFieldValue}</p>
                        </td>
                        {MONTHS.map((_, idx) => {
                          const monthData = member.months.find(m => m.month === idx + 1);
                          const isPaid = monthData && monthData.amountPaid >= (selectedYear?.monthlyAmount || 0);
                          
                          return (
                            <td key={idx} className="px-1 py-2 text-center">
                              <button
                                onClick={() => openPaymentModal(member, idx + 1)}
                                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                                  isPaid
                                    ? 'bg-green-100 text-green-600 hover:bg-green-200'
                                    : (monthData?.amountPaid ?? 0) > 0
                                    ? 'bg-yellow-100 text-yellow-600 hover:bg-yellow-200'
                                    : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                                }`}
                                title={`${MONTHS[idx]}: ${formatCurrency(monthData?.amountPaid || 0)}`}
                              >
                                {isPaid ? (
                                  <Check className="w-4 h-4" />
                                ) : (monthData?.amountPaid ?? 0) > 0 ? (
                                  <span className="text-xs font-medium">
                                    {Math.round(((monthData?.amountPaid ?? 0) / 1000))}
                                  </span>
                                ) : (
                                  <CreditCard className="w-4 h-4" />
                                )}
                              </button>
                            </td>
                          );
                        })}
                        <td className="px-4 py-3 text-right">
                          <p className="font-semibold text-gray-900">
                            {formatCurrency(member.totalPaid)}
                          </p>
                          <p className="text-xs text-gray-500">
                            {member.percentage}%
                          </p>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Modal Paiement */}
        <Modal
          isOpen={paymentModal.isOpen}
          onClose={() => setPaymentModal({ isOpen: false, member: null, month: 1 })}
          title={`Paiement - ${MONTHS[paymentModal.month - 1]}`}
        >
          <form onSubmit={handlePayment} className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">Membre</p>
              <p className="font-medium text-gray-900">{paymentModal.member?.memberName}</p>
              <p className="text-sm text-gray-500">{paymentModal.member?.customFieldValue}</p>
            </div>

            <Input
              label="Montant (FCFA)"
              type="number"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              placeholder={selectedYear?.monthlyAmount.toString()}
              required
            />

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setPaymentModal({ isOpen: false, member: null, month: 1 })}
              >
                Annuler
              </Button>
              <Button type="submit" loading={paymentMutation.isPending}>
                Enregistrer
              </Button>
            </div>
          </form>
        </Modal>
      </div>
    </DashboardLayout>
  );
}

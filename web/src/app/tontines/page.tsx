'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout';
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Badge, Modal, LoadingSpinner } from '@/components/ui';
import { api } from '@/services/api';
import { formatCurrency } from '@/lib/utils';
import { UsersThree, Plus, Eye, Shuffle, Check, X, Trash, ArrowRight, Warning, LockSimple } from '@phosphor-icons/react';

interface Member {
  id: string;
  name: string;
  active: boolean;
}

interface TontineParticipant {
  id: string;
  memberId: string;
  order: number;
  hasReceived: boolean;
  receivedRound: number | null;
  member: { id: string; name: string };
}

interface TontinePayment {
  id: string;
  roundId: string;
  memberId: string;
  amount: number;
  isPaid: boolean;
  paidAt: string | null;
  member: { id: string; name: string };
}

interface TontineRound {
  id: string;
  roundNumber: number;
  beneficiaryMemberId: string;
  status: 'open' | 'closed';
  closedAt: string | null;
  payments: TontinePayment[];
}

interface Tontine {
  id: string;
  name: string;
  amount: number;
  frequency: 'monthly' | 'weekly';
  status: 'active' | 'completed' | 'cancelled';
  currentRound: number;
  participantsCount?: number;
  currentBeneficiaryName?: string;
  participants?: TontineParticipant[];
  rounds?: TontineRound[];
  createdAt: string;
}

export default function TontinesPage() {
  const queryClient = useQueryClient();
  const [createModal, setCreateModal] = useState(false);
  const [detailModal, setDetailModal] = useState<Tontine | null>(null);
  const [paymentModal, setPaymentModal] = useState<{
    isOpen: boolean;
    memberId: string;
    memberName: string;
    amount: number;
  } | null>(null);

  // Vérifier si les tontines sont activées pour cette association
  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ['association-settings'],
    queryFn: async () => {
      const response = await api.get('/auth/association-settings');
      return response.data as { tontinesEnabled?: boolean };
    },
    staleTime: 5 * 60 * 1000,
  });

  // Formulaire création
  const [formName, setFormName] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formFrequency, setFormFrequency] = useState<'monthly' | 'weekly'>('monthly');
  const [selectedMembers, setSelectedMembers] = useState<Member[]>([]);
  const [paymentAmount, setPaymentAmount] = useState('');

  // Liste des tontines
  const { data: tontines, isLoading } = useQuery({
    queryKey: ['tontines'],
    queryFn: async () => {
      const response = await api.get('/tontines');
      return response.data as Tontine[];
    },
  });

  // Liste des membres pour la création
  const { data: members } = useQuery({
    queryKey: ['members'],
    queryFn: async () => {
      const response = await api.get('/members');
      return (response.data as Member[]).filter(m => m.active);
    },
  });

  // Détail d'une tontine
  const { data: tontineDetail, isLoading: loadingDetail, refetch: refetchDetail } = useQuery({
    queryKey: ['tontine', detailModal?.id],
    queryFn: async () => {
      if (!detailModal) return null;
      const response = await api.get(`/tontines/${detailModal.id}`);
      return response.data as Tontine;
    },
    enabled: !!detailModal,
  });

  // Mutation création
  const createMutation = useMutation({
    mutationFn: async (data: { name: string; amount: number; frequency: string; memberIds: string[] }) => {
      const response = await api.post('/tontines', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tontines'] });
      setCreateModal(false);
      resetForm();
    },
  });

  // Mutation paiement
  const paymentMutation = useMutation({
    mutationFn: async (data: { tontineId: string; memberId: string; amount: number }) => {
      const response = await api.post(`/tontines/${data.tontineId}/payments`, {
        memberId: data.memberId,
        amount: data.amount,
      });
      return response.data;
    },
    onSuccess: () => {
      refetchDetail();
      setPaymentModal(null);
      setPaymentAmount('');
    },
  });

  // Mutation annuler paiement
  const cancelPaymentMutation = useMutation({
    mutationFn: async (paymentId: string) => {
      const response = await api.delete(`/tontines/payments/${paymentId}`);
      return response.data;
    },
    onSuccess: () => {
      refetchDetail();
    },
  });

  // Mutation clôturer tour
  const closeRoundMutation = useMutation({
    mutationFn: async (tontineId: string) => {
      const response = await api.post(`/tontines/${tontineId}/close-round`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tontines'] });
      refetchDetail();
    },
  });

  // Mutation supprimer
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.delete(`/tontines/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tontines'] });
      setDetailModal(null);
    },
  });

  // Mutation annuler
  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.put(`/tontines/${id}`, { status: 'cancelled' });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tontines'] });
      refetchDetail();
    },
  });

  const resetForm = () => {
    setFormName('');
    setFormAmount('');
    setFormFrequency('monthly');
    setSelectedMembers([]);
  };

  const toggleMember = (member: Member) => {
    setSelectedMembers(prev => {
      const exists = prev.find(m => m.id === member.id);
      if (exists) {
        return prev.filter(m => m.id !== member.id);
      } else {
        return [...prev, member];
      }
    });
  };

  const shuffleMembers = () => {
    setSelectedMembers(prev => [...prev].sort(() => Math.random() - 0.5));
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName || !formAmount || selectedMembers.length < 2) return;
    createMutation.mutate({
      name: formName,
      amount: parseFloat(formAmount),
      frequency: formFrequency,
      memberIds: selectedMembers.map(m => m.id),
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="success">Active</Badge>;
      case 'completed':
        return <Badge variant="info">Terminée</Badge>;
      case 'cancelled':
        return <Badge variant="danger">Annulée</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getFrequencyLabel = (freq: string) => {
    return freq === 'weekly' ? 'Hebdomadaire' : 'Mensuel';
  };

  const currentRound = tontineDetail?.rounds?.find(r => r.status === 'open');
  const currentBeneficiary = tontineDetail?.participants?.find(
    p => p.memberId === currentRound?.beneficiaryMemberId
  );

  // Si les tontines sont désactivées pour cette association, afficher un message
  if (settingsLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <LoadingSpinner />
        </div>
      </DashboardLayout>
    );
  }

  if (settings?.tontinesEnabled === false) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-8">
          <div className="w-16 h-16 rounded-full bg-[var(--color-warning-bg)] flex items-center justify-center mb-4">
            <LockSimple size={32} className="text-[var(--color-warning)]" />
          </div>
          <h2 className="text-xl font-semibold text-[var(--color-text)] mb-2">
            Fonctionnalité non activée
          </h2>
          <p className="text-[var(--color-text-muted)] max-w-md">
            La fonctionnalité Tontines n&apos;est pas activée pour votre association. 
            Contactez le support pour l&apos;activer.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--color-text)]">Tontines</h1>
            <p className="text-[var(--color-text-muted)]">
              Gérez les tontines de votre association
            </p>
          </div>
          <Button onClick={() => setCreateModal(true)} data-testid="create-tontine-btn">
            <Plus size={20} className="mr-2" />
            Nouvelle tontine
          </Button>
        </div>

        {/* Liste des tontines */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner />
          </div>
        ) : tontines && tontines.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tontines.map((tontine) => (
              <Card key={tontine.id} data-testid={`tontine-card-${tontine.id}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <UsersThree size={24} className="text-[var(--color-primary)]" weight="duotone" />
                      <CardTitle className="text-lg">{tontine.name}</CardTitle>
                    </div>
                    {getStatusBadge(tontine.status)}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-[var(--color-text-muted)]">Montant/tour</span>
                      <span className="font-semibold">{formatCurrency(tontine.amount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--color-text-muted)]">Fréquence</span>
                      <span>{getFrequencyLabel(tontine.frequency)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--color-text-muted)]">Participants</span>
                      <span>{tontine.participantsCount}</span>
                    </div>
                    {tontine.status === 'active' && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-[var(--color-text-muted)]">Tour actuel</span>
                          <span className="font-semibold text-[var(--color-primary)]">
                            {tontine.currentRound}
                          </span>
                        </div>
                        {tontine.currentBeneficiaryName && (
                          <div className="flex justify-between">
                            <span className="text-[var(--color-text-muted)]">Bénéficiaire</span>
                            <span className="font-semibold">{tontine.currentBeneficiaryName}</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full mt-4"
                    onClick={() => setDetailModal(tontine)}
                    data-testid={`view-tontine-${tontine.id}`}
                  >
                    <Eye size={16} className="mr-2" />
                    Voir le détail
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <UsersThree size={48} className="mx-auto text-[var(--color-text-muted)] mb-4" />
              <h3 className="text-lg font-semibold mb-2">Aucune tontine</h3>
              <p className="text-[var(--color-text-muted)] mb-4">
                Créez votre première tontine pour commencer
              </p>
              <Button onClick={() => setCreateModal(true)}>
                <Plus size={20} className="mr-2" />
                Créer une tontine
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Modal Création */}
        <Modal isOpen={createModal} onClose={() => { setCreateModal(false); resetForm(); }}>
          <form onSubmit={handleCreate} className="space-y-6">
            <h2 className="text-xl font-bold">Nouvelle tontine</h2>

            <div>
              <label className="block text-sm font-medium mb-1">Nom de la tontine *</label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Ex: Tontine Famille"
                required
                data-testid="tontine-name-input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Montant par tour (FCFA) *</label>
              <Input
                type="number"
                value={formAmount}
                onChange={(e) => setFormAmount(e.target.value)}
                placeholder="Ex: 50000"
                min="1"
                required
                data-testid="tontine-amount-input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Fréquence</label>
              <select
                value={formFrequency}
                onChange={(e) => setFormFrequency(e.target.value as 'monthly' | 'weekly')}
                className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-bg)]"
                data-testid="tontine-frequency-select"
              >
                <option value="monthly">Mensuel</option>
                <option value="weekly">Hebdomadaire</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Sélectionnez les participants (minimum 2) *
              </label>
              <div className="max-h-48 overflow-y-auto border border-[var(--color-border)] rounded-lg p-2 space-y-1">
                {members?.map((member) => (
                  <label
                    key={member.id}
                    className="flex items-center gap-2 p-2 hover:bg-[var(--color-bg-secondary)] rounded cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedMembers.some(m => m.id === member.id)}
                      onChange={() => toggleMember(member)}
                      className="rounded"
                    />
                    <span>{member.name}</span>
                  </label>
                ))}
              </div>
            </div>

            {selectedMembers.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium">
                    Ordre de passage ({selectedMembers.length} participants)
                  </label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={shuffleMembers}
                    data-testid="shuffle-btn"
                  >
                    <Shuffle size={16} className="mr-1" />
                    Tirer au sort
                  </Button>
                </div>
                <div className="border border-[var(--color-border)] rounded-lg p-2 space-y-1">
                  {selectedMembers.map((member, index) => (
                    <div
                      key={member.id}
                      className="flex items-center gap-2 p-2 bg-[var(--color-bg-secondary)] rounded"
                    >
                      <span className="w-6 h-6 flex items-center justify-center bg-[var(--color-primary)] text-white rounded-full text-xs font-bold">
                        {index + 1}
                      </span>
                      <span>{member.name}</span>
                      {index === 0 && (
                        <Badge variant="default" className="ml-auto">1er bénéficiaire</Badge>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => { setCreateModal(false); resetForm(); }}>
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={!formName || !formAmount || selectedMembers.length < 2 || createMutation.isPending}
                data-testid="submit-create-tontine"
              >
                {createMutation.isPending ? 'Création...' : 'Créer la tontine'}
              </Button>
            </div>
          </form>
        </Modal>

        {/* Modal Détail */}
        <Modal isOpen={!!detailModal} onClose={() => setDetailModal(null)} size="xl">
          {loadingDetail ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner />
            </div>
          ) : tontineDetail ? (
            <div className="space-y-6">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <UsersThree size={28} className="text-[var(--color-primary)]" weight="duotone" />
                    {tontineDetail.name}
                  </h2>
                  <div className="flex items-center gap-3 mt-2 text-sm text-[var(--color-text-muted)]">
                    <span>{formatCurrency(tontineDetail.amount)} / tour</span>
                    <span>•</span>
                    <span>{getFrequencyLabel(tontineDetail.frequency)}</span>
                    <span>•</span>
                    {getStatusBadge(tontineDetail.status)}
                  </div>
                </div>
              </div>

              {/* Participants */}
              <div>
                <h3 className="font-semibold mb-2">Ordre de passage</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {tontineDetail.participants?.map((p) => (
                    <div
                      key={p.id}
                      className={`flex items-center gap-2 p-2 rounded border ${
                        p.hasReceived
                          ? 'bg-green-50 border-green-200'
                          : currentRound?.beneficiaryMemberId === p.memberId
                          ? 'bg-[var(--color-primary-bg)] border-[var(--color-primary)]'
                          : 'border-[var(--color-border)]'
                      }`}
                    >
                      <span className="w-6 h-6 flex items-center justify-center bg-[var(--color-secondary)] text-white rounded-full text-xs font-bold">
                        {p.order}
                      </span>
                      <span className="flex-1 truncate">{p.member.name}</span>
                      {p.hasReceived ? (
                        <Badge variant="success" className="text-xs">Tour {p.receivedRound}</Badge>
                      ) : currentRound?.beneficiaryMemberId === p.memberId ? (
                        <Badge variant="default" className="text-xs">Ce tour</Badge>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>

              {/* Tour en cours */}
              {tontineDetail.status === 'active' && currentRound && (
                <div className="bg-[var(--color-bg-secondary)] rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold">
                      Tour {currentRound.roundNumber} - Bénéficiaire: {currentBeneficiary?.member.name}
                    </h3>
                    <Button
                      size="sm"
                      onClick={() => {
                        if (window.confirm('Êtes-vous sûr de vouloir clôturer ce tour et passer au suivant ?')) {
                          closeRoundMutation.mutate(tontineDetail.id);
                        }
                      }}
                      disabled={closeRoundMutation.isPending}
                      data-testid="close-round-btn"
                    >
                      <ArrowRight size={16} className="mr-1" />
                      {closeRoundMutation.isPending ? 'En cours...' : 'Clôturer ce tour'}
                    </Button>
                  </div>

                  <div className="space-y-2">
                    {currentRound.payments?.map((payment) => (
                      <div
                        key={payment.id}
                        className="flex items-center justify-between p-2 bg-white rounded border border-[var(--color-border)]"
                      >
                        <div className="flex items-center gap-2">
                          {payment.isPaid ? (
                            <Check size={20} className="text-green-500" weight="bold" />
                          ) : (
                            <X size={20} className="text-[var(--color-text-muted)]" />
                          )}
                          <span>{payment.member.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {payment.isPaid ? (
                            <>
                              <span className="font-semibold text-green-600">
                                {formatCurrency(payment.amount)}
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => cancelPaymentMutation.mutate(payment.id)}
                                disabled={cancelPaymentMutation.isPending}
                              >
                                <X size={14} />
                              </Button>
                            </>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => {
                                setPaymentAmount(tontineDetail.amount.toString());
                                setPaymentModal({
                                  isOpen: true,
                                  memberId: payment.memberId,
                                  memberName: payment.member.name,
                                  amount: tontineDetail.amount,
                                });
                              }}
                              data-testid={`pay-btn-${payment.memberId}`}
                            >
                              Marquer payé
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Message tontine terminée */}
              {tontineDetail.status === 'completed' && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                  <Check size={32} className="mx-auto text-green-500 mb-2" weight="bold" />
                  <p className="font-semibold text-green-700">
                    Cycle terminé — tous les participants ont reçu.
                  </p>
                </div>
              )}

              {/* Message tontine annulée */}
              {tontineDetail.status === 'cancelled' && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                  <Warning size={32} className="mx-auto text-red-500 mb-2" weight="bold" />
                  <p className="font-semibold text-red-700">
                    Cette tontine a été annulée.
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 justify-end border-t pt-4">
                {tontineDetail.status === 'active' && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (window.confirm('Êtes-vous sûr de vouloir annuler cette tontine ?')) {
                        cancelMutation.mutate(tontineDetail.id);
                      }
                    }}
                    disabled={cancelMutation.isPending}
                  >
                    <X size={16} className="mr-1" />
                    Annuler la tontine
                  </Button>
                )}
                <Button
                  variant="danger"
                  onClick={() => {
                    if (window.confirm('Êtes-vous sûr de vouloir supprimer définitivement cette tontine ?')) {
                      deleteMutation.mutate(tontineDetail.id);
                    }
                  }}
                  disabled={deleteMutation.isPending}
                >
                  <Trash size={16} className="mr-1" />
                  Supprimer
                </Button>
              </div>
            </div>
          ) : null}
        </Modal>

        {/* Modal Paiement */}
        <Modal isOpen={!!paymentModal} onClose={() => setPaymentModal(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!paymentModal || !tontineDetail) return;
              paymentMutation.mutate({
                tontineId: tontineDetail.id,
                memberId: paymentModal.memberId,
                amount: parseFloat(paymentAmount),
              });
            }}
            className="space-y-4"
          >
            <h3 className="text-lg font-semibold">Enregistrer un paiement</h3>
            <p className="text-[var(--color-text-muted)]">
              Membre: <strong>{paymentModal?.memberName}</strong>
            </p>
            <div>
              <label className="block text-sm font-medium mb-1">Montant (FCFA)</label>
              <Input
                type="number"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                min="1"
                required
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setPaymentModal(null)}>
                Annuler
              </Button>
              <Button type="submit" disabled={paymentMutation.isPending}>
                {paymentMutation.isPending ? 'Enregistrement...' : 'Confirmer'}
              </Button>
            </div>
          </form>
        </Modal>
      </div>
    </DashboardLayout>
  );
}

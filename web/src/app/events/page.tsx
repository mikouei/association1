'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout';
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Badge, Modal, LoadingSpinner, toast } from '@/components/ui';
import { api } from '@/services/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  CalendarDots,
  Plus,
  Eye,
  Pencil,
  Trash,
  X,
  FilePdf,
  Gift,
} from '@phosphor-icons/react';

const TYPES = ['décès', 'mariage', 'anniversaire', 'solidarité', 'réunion', 'autre'];

const TYPE_LABELS: Record<string, string> = {
  'décès': 'Décès',
  'mariage': 'Mariage',
  'anniversaire': 'Anniversaire',
  'solidarité': 'Solidarité',
  'réunion': 'Réunion',
  'autre': 'Autre',
};

interface Member {
  id: string;
  name: string;
  active: boolean;
}

interface ExceptionalPayment {
  id: string;
  memberId: string;
  amount: number;
  paymentDate: string;
  notes: string | null;
  member?: { id: string; name: string };
}

interface Contribution {
  id: string;
  title: string;
  type: string;
  description: string | null;
  eventDate: string | null;
  hasCollection: boolean;
  recurrence: 'once' | 'monthly';
  active: boolean;
  createdAt: string;
  totalCollected?: number;
  participantsCount?: number;
  payments?: ExceptionalPayment[];
}

export default function EventsPage() {
  const queryClient = useQueryClient();
  const [formModal, setFormModal] = useState(false);
  const [editingContribution, setEditingContribution] = useState<Contribution | null>(null);
  const [detailModal, setDetailModal] = useState<Contribution | null>(null);
  const [paymentModal, setPaymentModal] = useState<{ memberId: string; memberName: string } | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [exportingPdf, setExportingPdf] = useState(false);

  // Formulaire création / édition
  const [formTitle, setFormTitle] = useState('');
  const [formType, setFormType] = useState('autre');
  const [formDescription, setFormDescription] = useState('');
  const [formEventDate, setFormEventDate] = useState('');
  const [formHasCollection, setFormHasCollection] = useState(true);
  const [formRecurrence, setFormRecurrence] = useState<'once' | 'monthly'>('once');

  // Liste des événements / cotisations exceptionnelles
  const { data: contributions, isLoading } = useQuery({
    queryKey: ['exceptional'],
    queryFn: async () => {
      const response = await api.get('/exceptional');
      return response.data as Contribution[];
    },
  });

  // Liste des membres actifs (pour enregistrer un paiement)
  const { data: members } = useQuery({
    queryKey: ['members'],
    queryFn: async () => {
      const response = await api.get('/members');
      return (response.data as Member[]).filter(m => m.active);
    },
  });

  // Détail d'un événement (rafraîchi après chaque paiement)
  const { data: detail, isLoading: loadingDetail, refetch: refetchDetail } = useQuery({
    queryKey: ['exceptional-detail', detailModal?.id],
    queryFn: async () => {
      if (!detailModal) return null;
      const response = await api.get(`/exceptional/${detailModal.id}`);
      return response.data as Contribution;
    },
    enabled: !!detailModal,
  });

  const resetForm = () => {
    setFormTitle('');
    setFormType('autre');
    setFormDescription('');
    setFormEventDate('');
    setFormHasCollection(true);
    setFormRecurrence('once');
  };

  const openCreateModal = () => {
    resetForm();
    setEditingContribution(null);
    setFormModal(true);
  };

  const openEditModal = (contribution: Contribution) => {
    setFormTitle(contribution.title);
    setFormType(contribution.type);
    setFormDescription(contribution.description || '');
    setFormEventDate(contribution.eventDate ? contribution.eventDate.slice(0, 10) : '');
    setFormHasCollection(contribution.hasCollection);
    setFormRecurrence(contribution.recurrence);
    setEditingContribution(contribution);
    setFormModal(true);
  };

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const response = await api.post('/exceptional', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exceptional'] });
      toast.success('Créé avec succès');
      setFormModal(false);
      resetForm();
    },
    onError: () => toast.error('Erreur lors de la création'),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      const response = await api.put(`/exceptional/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exceptional'] });
      queryClient.invalidateQueries({ queryKey: ['exceptional-detail'] });
      toast.success('Modifié avec succès');
      setFormModal(false);
      setEditingContribution(null);
      resetForm();
    },
    onError: () => toast.error('Erreur lors de la modification'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.delete(`/exceptional/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exceptional'] });
      toast.success('Supprimé avec succès');
      setDetailModal(null);
    },
    onError: () => toast.error('Erreur lors de la suppression'),
  });

  const paymentMutation = useMutation({
    mutationFn: async (data: { memberId: string; amount: number }) => {
      if (!detailModal) throw new Error('no contribution');
      const response = await api.post(`/exceptional/${detailModal.id}/payments`, data);
      return response.data;
    },
    onSuccess: () => {
      refetchDetail();
      queryClient.invalidateQueries({ queryKey: ['exceptional'] });
      setPaymentModal(null);
      setPaymentAmount('');
      toast.success('Paiement enregistré');
    },
    onError: () => toast.error('Erreur lors de l\'enregistrement du paiement'),
  });

  const deletePaymentMutation = useMutation({
    mutationFn: async (paymentId: string) => {
      const response = await api.delete(`/exceptional/payments/${paymentId}`);
      return response.data;
    },
    onSuccess: () => {
      refetchDetail();
      queryClient.invalidateQueries({ queryKey: ['exceptional'] });
      toast.success('Paiement supprimé');
    },
    onError: () => toast.error('Erreur lors de la suppression du paiement'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle || !formType) return;
    const data = {
      title: formTitle,
      type: formType,
      description: formDescription || null,
      eventDate: formEventDate || null,
      hasCollection: formHasCollection,
      recurrence: formRecurrence,
    };
    if (editingContribution) {
      updateMutation.mutate({ id: editingContribution.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleExportPdf = async () => {
    if (!detailModal) return;
    setExportingPdf(true);
    try {
      const response = await api.get(`/exceptional/${detailModal.id}/stats/pdf`, { responseType: 'text' });
      const html = response.data;
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.print();
      }
    } catch {
      toast.error('Erreur lors de la génération du document');
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--color-text)]">Événements</h1>
            <p className="text-[var(--color-text-muted)]">
              Cotisations exceptionnelles et événements informatifs de votre association
            </p>
          </div>
          <Button onClick={openCreateModal} data-testid="create-event-btn">
            <Plus size={20} className="mr-2" />
            Nouvel événement
          </Button>
        </div>

        {/* Liste */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner />
          </div>
        ) : contributions && contributions.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {contributions.map((contribution) => (
              <Card key={contribution.id} data-testid={`event-card-${contribution.id}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {contribution.hasCollection ? (
                        <CalendarDots size={24} className="text-[var(--color-primary)] flex-shrink-0" weight="duotone" />
                      ) : (
                        <Gift size={24} className="text-[var(--color-secondary)] flex-shrink-0" weight="duotone" />
                      )}
                      <CardTitle className="text-lg truncate">{contribution.title}</CardTitle>
                    </div>
                    <Badge variant={contribution.hasCollection ? 'default' : 'info'}>
                      {contribution.hasCollection ? 'Collecte' : 'Info'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-[var(--color-text-muted)]">Type</span>
                      <span className="font-medium capitalize">{TYPE_LABELS[contribution.type] || contribution.type}</span>
                    </div>
                    {contribution.eventDate && (
                      <div className="flex justify-between">
                        <span className="text-[var(--color-text-muted)]">Date</span>
                        <span>{formatDate(contribution.eventDate)}</span>
                      </div>
                    )}
                    {contribution.hasCollection && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-[var(--color-text-muted)]">Collecté</span>
                          <span className="font-semibold text-[var(--color-primary)]">
                            {formatCurrency(contribution.totalCollected || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[var(--color-text-muted)]">Participants</span>
                          <span>{contribution.participantsCount || 0}</span>
                        </div>
                      </>
                    )}
                    {contribution.recurrence === 'monthly' && (
                      <Badge variant="warning" className="text-xs">Récurrent (mensuel)</Badge>
                    )}
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => setDetailModal(contribution)}
                      data-testid={`view-event-${contribution.id}`}
                    >
                      <Eye size={16} className="mr-2" />
                      Détail
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditModal(contribution)}
                      title="Modifier"
                    >
                      <Pencil size={16} />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <CalendarDots size={48} className="mx-auto text-[var(--color-text-muted)] mb-4" />
              <h3 className="text-lg font-semibold mb-2">Aucun événement</h3>
              <p className="text-[var(--color-text-muted)] mb-4">
                Créez votre premier événement ou cotisation exceptionnelle
              </p>
              <Button onClick={openCreateModal}>
                <Plus size={20} className="mr-2" />
                Créer un événement
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Modal Création / Édition */}
        <Modal
          isOpen={formModal}
          onClose={() => { setFormModal(false); setEditingContribution(null); resetForm(); }}
          title={editingContribution ? "Modifier l'événement" : 'Nouvel événement'}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Titre *</label>
              <Input
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="Ex: Décès du père de M. Koné"
                required
                data-testid="event-title-input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Type *</label>
              <select
                value={formType}
                onChange={(e) => setFormType(e.target.value)}
                className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-bg)]"
                data-testid="event-type-select"
              >
                {TYPES.map((type) => (
                  <option key={type} value={type}>{TYPE_LABELS[type]}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Détails optionnels"
                rows={3}
                className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-bg)]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Date de l&apos;événement</label>
              <Input
                type="date"
                value={formEventDate}
                onChange={(e) => setFormEventDate(e.target.value)}
              />
            </div>

            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formHasCollection}
                  onChange={(e) => setFormHasCollection(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm font-medium">Avec collecte de cotisation</span>
              </label>
              <p className="text-xs text-[var(--color-text-muted)] mt-1 ml-6">
                Si désactivé, c&apos;est un événement purement informatif (pas de paiements)
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Périodicité</label>
              <select
                value={formRecurrence}
                onChange={(e) => setFormRecurrence(e.target.value as 'once' | 'monthly')}
                className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-bg)]"
              >
                <option value="once">Ponctuel</option>
                <option value="monthly">Mensuel</option>
              </select>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => { setFormModal(false); setEditingContribution(null); resetForm(); }}
              >
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={!formTitle || !formType || createMutation.isPending || updateMutation.isPending}
                data-testid="submit-event-form"
              >
                {createMutation.isPending || updateMutation.isPending
                  ? 'Enregistrement...'
                  : editingContribution ? 'Modifier' : 'Créer'}
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
          ) : detail ? (
            <div className="space-y-6">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    {detail.hasCollection ? (
                      <CalendarDots size={28} className="text-[var(--color-primary)]" weight="duotone" />
                    ) : (
                      <Gift size={28} className="text-[var(--color-secondary)]" weight="duotone" />
                    )}
                    {detail.title}
                  </h2>
                  <div className="flex items-center gap-3 mt-2 text-sm text-[var(--color-text-muted)]">
                    <span className="capitalize">{TYPE_LABELS[detail.type] || detail.type}</span>
                    {detail.eventDate && (
                      <>
                        <span>•</span>
                        <span>{formatDate(detail.eventDate)}</span>
                      </>
                    )}
                    {detail.recurrence === 'monthly' && (
                      <>
                        <span>•</span>
                        <Badge variant="warning" className="text-xs">Récurrent (mensuel)</Badge>
                      </>
                    )}
                  </div>
                  {detail.description && (
                    <p className="text-sm text-[var(--color-text-muted)] mt-2">{detail.description}</p>
                  )}
                </div>
              </div>

              {detail.hasCollection ? (
                <>
                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-[var(--color-bg-secondary)] rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-[var(--color-primary)]">
                        {formatCurrency(detail.totalCollected || 0)}
                      </div>
                      <div className="text-sm text-[var(--color-text-muted)]">Total collecté</div>
                    </div>
                    <div className="bg-[var(--color-bg-secondary)] rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-[var(--color-secondary)]">
                        {detail.participantsCount || 0}
                      </div>
                      <div className="text-sm text-[var(--color-text-muted)]">Participants</div>
                    </div>
                  </div>

                  {/* Paiements */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold">Paiements</h3>
                      <Button
                        size="sm"
                        onClick={() => setPaymentModal({ memberId: '', memberName: '' })}
                        data-testid="add-payment-btn"
                      >
                        <Plus size={16} className="mr-1" />
                        Enregistrer un paiement
                      </Button>
                    </div>
                    {detail.payments && detail.payments.length > 0 ? (
                      <div className="space-y-2">
                        {detail.payments.map((payment) => (
                          <div
                            key={payment.id}
                            className="flex items-center justify-between p-2 bg-[var(--color-bg-secondary)] rounded border border-[var(--color-border)]"
                          >
                            <div>
                              <span className="font-medium">{payment.member?.name || 'Inconnu'}</span>
                              <span className="text-xs text-[var(--color-text-muted)] ml-2">
                                {formatDate(payment.paymentDate)}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-[var(--color-primary)]">
                                {formatCurrency(payment.amount)}
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  if (window.confirm('Supprimer ce paiement ?')) {
                                    deletePaymentMutation.mutate(payment.id);
                                  }
                                }}
                                disabled={deletePaymentMutation.isPending}
                              >
                                <X size={14} />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-[var(--color-text-muted)] text-center py-4">
                        Aucun paiement enregistré
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <div className="bg-[var(--color-bg-secondary)] rounded-lg p-4 text-center text-sm text-[var(--color-text-muted)]">
                  Événement informatif — aucune collecte de cotisation associée.
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 justify-end border-t pt-4">
                {detail.hasCollection && (
                  <Button
                    variant="outline"
                    onClick={handleExportPdf}
                    disabled={exportingPdf}
                  >
                    <FilePdf size={16} className="mr-1" />
                    {exportingPdf ? 'Génération...' : 'Exporter'}
                  </Button>
                )}
                <Button
                  variant="danger"
                  onClick={() => {
                    if (window.confirm('Êtes-vous sûr de vouloir supprimer définitivement cet événement ?')) {
                      deleteMutation.mutate(detail.id);
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
              if (!paymentModal?.memberId || !paymentAmount) return;
              paymentMutation.mutate({
                memberId: paymentModal.memberId,
                amount: parseFloat(paymentAmount),
              });
            }}
            className="space-y-4"
          >
            <h3 className="text-lg font-semibold">Enregistrer un paiement</h3>
            <div>
              <label className="block text-sm font-medium mb-1">Membre *</label>
              <select
                value={paymentModal?.memberId || ''}
                onChange={(e) => {
                  const member = members?.find(m => m.id === e.target.value);
                  setPaymentModal({ memberId: e.target.value, memberName: member?.name || '' });
                }}
                className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-bg)]"
                required
              >
                <option value="">Sélectionner un membre</option>
                {members?.map((member) => (
                  <option key={member.id} value={member.id}>{member.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Montant (FCFA) *</label>
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

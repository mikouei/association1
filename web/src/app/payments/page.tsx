'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout';
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Badge, Modal, LoadingSpinner } from '@/components/ui';
import { api } from '@/services/api';
import { formatCurrency, MONTHS } from '@/lib/utils';
import { CreditCard, Check, Receipt, FileText, Download, Share2, MessageCircle, Mail, MessageSquare } from 'lucide-react';
import { toast } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { getVocab } from '@/utils/vocabulary';

interface MemberPayment {
  id: string;
  userId: string;
  name: string;
  customFieldValue?: string;
  phone?: string;
  email?: string | null;
  paymentsByMonth: Record<number, { paid: boolean; amountPaid: number; payments: Array<{ id: string; notes?: string | null }> }>;
  totalPaid: number;
  totalDue: number;
  remaining: number;
  percentage: number;
}

type ShareKind = 'RECEIPT' | 'RECEIPT_RECAP' | 'CHARGE_NOTICE_PDF' | 'CHARGE_NOTICE_WORD';

interface ReadyDoc {
  blob: Blob;
  filename: string;
  type: string;
  kind: ShareKind;
  targetId: string;
  label: string;
  member: MemberPayment;
}

// Numéro ivoirien au format 225XXXXXXXXXX (10 chiffres après 225), sinon null
const normalizeCiPhone = (phone?: string | null) => {
  let digits = (phone || '').replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.length === 13 && digits.startsWith('225')) return digits;
  if (digits.length === 10) return `225${digits}`;
  return null;
};

interface Year {
  id: string;
  year: number;
  monthlyAmount: number;
  active: boolean;
}

export default function PaymentsPage() {
  const queryClient = useQueryClient();
  const { association } = useAuth();
  const isSyndic = association?.type === 'SYNDIC';
  const vocab = getVocab(association?.type);
  const [selectedYear, setSelectedYear] = useState<Year | null>(null);
  const [paymentModal, setPaymentModal] = useState<{
    isOpen: boolean;
    member: MemberPayment | null;
    month: number;
  }>({ isOpen: false, member: null, month: 1 });
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [readyDoc, setReadyDoc] = useState<ReadyDoc | null>(null);
  const [sharing, setSharing] = useState(false);

  const { data: years, isLoading: loadingYears } = useQuery({
    queryKey: ['years'],
    queryFn: async () => {
      const response = await api.get('/years');
      return response.data as Year[];
    },
  });

  // Sélectionne automatiquement l'année active (ou la première disponible) dès que
  // `years` est disponible — y compris quand la donnée vient du cache React Query
  // (staleTime 60s dans providers.tsx) et que queryFn ne se réexécute pas.
  useEffect(() => {
    if (years && years.length > 0 && !selectedYear) {
      const active = years.find(y => y.active) || years[0];
      setSelectedYear(active);
    }
  }, [years, selectedYear]);

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
    mutationFn: async (data: { memberId: string; yearId: string; month: number; amountPaid: number; notes: string }) => {
      const response = await api.post('/payments', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      setPaymentModal({ isOpen: false, member: null, month: 1 });
      setPaymentAmount('');
      setPaymentNotes('');
    },
  });

  const closePaymentModal = () => {
    setPaymentModal({ isOpen: false, member: null, month: 1 });
    setPaymentAmount('');
    setPaymentNotes('');
  };

  const openPaymentModal = (member: MemberPayment, month: number) => {
    const monthData = member.paymentsByMonth[month];
    setPaymentAmount(monthData?.amountPaid?.toString() || selectedYear?.monthlyAmount.toString() || '');
    // Précharger la note déjà enregistrée pour ce mois (le champ vient de payments[].notes)
    const existingNote = monthData?.payments?.find((p) => p.notes)?.notes || '';
    setPaymentNotes(existingNote);
    setPaymentModal({ isOpen: true, member, month });
  };

  // Récupère le document (blob) puis ouvre la modale « Document prêt »
  const downloadBlob = async (url: string, filename: string, doc: Omit<ReadyDoc, 'blob' | 'filename' | 'type'>) => {
    try {
      toast.info('Génération du document en cours...');
      const response = await api.get(url, { responseType: 'blob' });
      const type = (response.headers['content-type'] as string) || (response.data as Blob).type || 'application/pdf';
      setReadyDoc({ ...doc, blob: response.data as Blob, filename, type });
    } catch (error) {
      console.error('Download document error:', error);
      toast.error('Erreur lors de la génération du document');
    }
  };

  // Téléchargement local (comportement historique)
  const saveReadyDoc = () => {
    if (!readyDoc) return;
    const objUrl = window.URL.createObjectURL(new Blob([readyDoc.blob]));
    const link = document.createElement('a');
    link.href = objUrl;
    link.setAttribute('download', readyDoc.filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(objUrl);
    toast.success('Document téléchargé avec succès');
  };

  const readyFile = readyDoc ? new File([readyDoc.blob], readyDoc.filename, { type: readyDoc.type }) : null;
  const canNativeShare = !!readyFile && typeof navigator !== 'undefined' && !!navigator.canShare?.({ files: [readyFile] });

  const nativeShare = async () => {
    if (!readyDoc || !readyFile) return;
    try {
      await navigator.share({ files: [readyFile], title: readyDoc.label });
    } catch (error) {
      if ((error as Error)?.name !== 'AbortError') toast.error('Partage impossible');
    }
  };

  const shareVia = async (channel: 'whatsapp' | 'email' | 'sms') => {
    if (!readyDoc) return;
    // Onglet ouvert immédiatement (geste utilisateur) pour éviter le bloqueur de pop-up
    const waWindow = channel === 'whatsapp' ? window.open('', '_blank') : null;
    setSharing(true);
    try {
      const { data } = await api.post('/share-links', { kind: readyDoc.kind, targetId: readyDoc.targetId });
      const { member, label } = readyDoc;
      const message = `Bonjour ${member.name}, voici votre ${label} – ${association?.name || ''} : ${data.url} (lien valable 30 jours)`;
      const phone = normalizeCiPhone(member.phone);
      const text = encodeURIComponent(message);
      if (channel === 'whatsapp') {
        const waUrl = `https://wa.me/${phone || ''}?text=${text}`;
        if (waWindow) waWindow.location.href = waUrl; else window.open(waUrl, '_blank');
      } else if (channel === 'email') {
        const subject = encodeURIComponent(`${label.charAt(0).toUpperCase()}${label.slice(1)} – ${association?.name || ''}`);
        window.location.href = `mailto:${member.email || ''}?subject=${subject}&body=${text}`;
      } else {
        window.location.href = `sms:${phone || ''}?&body=${text}`;
      }
    } catch (error) {
      waWindow?.close();
      console.error('Share link error:', error);
      toast.error('Erreur lors de la création du lien de partage');
    } finally {
      setSharing(false);
    }
  };

  const safe = (s: string) => (s || 'membre').replace(/\s+/g, '_');

  const filteredMembers = (payments?.members || []).filter((member) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      member.name?.toLowerCase().includes(q) ||
      member.customFieldValue?.toLowerCase().includes(q) ||
      member.phone?.toLowerCase().includes(q)
    );
  });

  const handlePayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentModal.member || !selectedYear) return;

    paymentMutation.mutate({
      memberId: paymentModal.member.id,
      yearId: selectedYear.id,
      month: paymentModal.month,
      amountPaid: parseFloat(paymentAmount),
      notes: paymentNotes,
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{vocab.Contributions}</h1>
            <p className="text-gray-500">Gestion des {vocab.Contributions.toLowerCase()} mensuelles</p>
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
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <CardTitle>
                {vocab.Contributions} {selectedYear?.year} - {formatCurrency(selectedYear?.monthlyAmount || 0)}/mois
              </CardTitle>
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher par nom, villa, téléphone..."
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
                />
                <Badge variant="info">
                  {filteredMembers.length} {vocab.Member.toLowerCase()}(s)
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loadingPayments || loadingYears ? (
              <div className="flex justify-center py-12">
                <LoadingSpinner size="lg" />
              </div>
            ) : payments?.members?.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                Aucun {vocab.Member.toLowerCase()} pour cette année
              </div>
            ) : filteredMembers.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                Aucun résultat pour cette recherche
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                        {vocab.Member}
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
                    {filteredMembers.map((member) => (
                      <tr key={member.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900">{member.name}</p>
                          <p className="text-xs text-gray-500">{member.customFieldValue}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <button
                              onClick={() => downloadBlob(`/members/${member.id}/receipt-recap`, `recu_recap_${safe(member.name)}.pdf`, { kind: 'RECEIPT_RECAP', targetId: member.id, label: 'reçu récapitulatif', member })}
                              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                              data-testid={`recap-btn-${member.id}`}
                            >
                              <Receipt className="w-4 h-4" />
                              Récap
                            </button>
                            {isSyndic && (
                              <div
                                className="inline-flex items-center rounded-md border border-gray-200 overflow-hidden text-sm"
                                role="group"
                                aria-label="Appel de charges"
                              >
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-50 text-gray-600 border-r border-gray-200">
                                  <FileText className="w-4 h-4" />
                                  Appel de charges
                                </span>
                                <button
                                  onClick={() => downloadBlob(`/members/${member.id}/charge-notice`, `appel_charges_${safe(member.name)}.pdf`, { kind: 'CHARGE_NOTICE_PDF', targetId: member.id, label: 'appel de charges', member })}
                                  className="px-2 py-0.5 text-primary font-medium hover:bg-primary/10"
                                  title="Télécharger l'appel de charges en PDF"
                                  data-testid={`charge-notice-btn-${member.id}`}
                                >
                                  PDF
                                </button>
                                <button
                                  onClick={() => downloadBlob(`/members/${member.id}/charge-notice-word`, `appel_charges_${safe(member.name)}.docx`, { kind: 'CHARGE_NOTICE_WORD', targetId: member.id, label: 'appel de charges', member })}
                                  className="px-2 py-0.5 text-primary font-medium hover:bg-primary/10 border-l border-gray-200"
                                  title="Télécharger l'appel de charges en Word (modifiable)"
                                  data-testid={`charge-notice-word-btn-${member.id}`}
                                >
                                  Word
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                        {MONTHS.map((_, idx) => {
                          const monthData = member.paymentsByMonth[idx + 1];
                          const isPaid = monthData && monthData.amountPaid >= (selectedYear?.monthlyAmount || 0);
                          
                          return (
                            <td key={idx} className="px-1 py-2 text-center">
                              <div className="relative inline-flex">
                                <button
                                  onClick={() => openPaymentModal(member, idx + 1)}
                                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                                    isPaid
                                      ? 'bg-[#2E7D32] text-white hover:bg-[#256a28]'
                                      : (monthData?.amountPaid ?? 0) > 0
                                      ? 'bg-[#B26A00] text-white hover:bg-[#945800]'
                                      : 'bg-[#B00020] text-white hover:bg-[#8e001a]'
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
                                {(monthData?.amountPaid ?? 0) > 0 && monthData?.payments?.[0]?.id && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      downloadBlob(
                                        `/payments/${monthData.payments[0].id}/receipt`,
                                        `recu_${MONTHS[idx]}_${safe(member.name)}.pdf`,
                                        {
                                          kind: 'RECEIPT',
                                          targetId: monthData.payments[0].id,
                                          label: `reçu de paiement de ${MONTHS[idx]} ${selectedYear?.year ?? ''}`.trim(),
                                          member,
                                        }
                                      );
                                    }}
                                    className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-white shadow border border-gray-200 flex items-center justify-center text-green-600 hover:bg-green-50"
                                    title="Télécharger le reçu"
                                    data-testid={`receipt-btn-${monthData.payments[0].id}`}
                                  >
                                    <Receipt className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
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
          onClose={closePaymentModal}
          title={`Paiement - ${MONTHS[paymentModal.month - 1]}`}
        >
          <form onSubmit={handlePayment} className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">Membre</p>
              <p className="font-medium text-gray-900">{paymentModal.member?.name}</p>
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

            <div>
              <label htmlFor="payment-notes" className="block text-sm font-medium text-gray-700 mb-1">
                Notes (optionnel)
              </label>
              <textarea
                id="payment-notes"
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                placeholder="Ajouter une note..."
                rows={3}
                data-testid="payment-notes-input"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-primary focus:ring-1 focus:ring-primary resize-none"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="secondary"
                onClick={closePaymentModal}
              >
                Annuler
              </Button>
              <Button type="submit" loading={paymentMutation.isPending}>
                Enregistrer
              </Button>
            </div>
          </form>
        </Modal>

        {/* Modal Document prêt */}
        <Modal isOpen={!!readyDoc} onClose={() => setReadyDoc(null)} title="Document prêt" size="sm">
          <div className="space-y-4">
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="font-medium text-gray-900 break-all">{readyDoc?.filename}</p>
              <p className="text-sm text-gray-500">{readyDoc?.member.name}</p>
            </div>
            <div className="grid grid-cols-1 gap-2">
              <Button onClick={saveReadyDoc} data-testid="doc-download-btn">
                <Download className="w-4 h-4 mr-2" />
                Télécharger
              </Button>
              {canNativeShare && (
                <Button variant="outline" onClick={nativeShare} data-testid="doc-share-btn">
                  <Share2 className="w-4 h-4 mr-2" />
                  Partager
                </Button>
              )}
              <Button variant="outline" onClick={() => shareVia('whatsapp')} disabled={sharing} data-testid="doc-whatsapp-btn">
                <MessageCircle className="w-4 h-4 mr-2" />
                WhatsApp
              </Button>
              <Button variant="outline" onClick={() => shareVia('email')} disabled={sharing} data-testid="doc-email-btn">
                <Mail className="w-4 h-4 mr-2" />
                E-mail
              </Button>
              <Button variant="outline" onClick={() => shareVia('sms')} disabled={sharing} data-testid="doc-sms-btn">
                <MessageSquare className="w-4 h-4 mr-2" />
                SMS
              </Button>
            </div>
            <p className="text-xs text-gray-500">Les liens WhatsApp, e-mail et SMS sont valables 30 jours.</p>
          </div>
        </Modal>
      </div>
    </DashboardLayout>
  );
}

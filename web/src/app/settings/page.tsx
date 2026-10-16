'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/layout';
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Badge, Modal, toast } from '@/components/ui';
import { api } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, Pencil, Trash2, Save, Copy, QrCode, Share2, Download, Users, Check, UserPlus, Upload, FileText } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { QRCodeSVG } from 'qrcode.react';

interface Year {
  id: string;
  year: number;
  monthlyAmount: number;
  active: boolean;
  createdAt: string;
  rateChanges?: { id: string; fromMonth: number; amount: number }[];
}

interface PendingMember {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  requestedAt: string;
}

// Génère l'URL d'invitation basée sur l'environnement
const getJoinUrl = (code: string) => {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  return `${baseUrl}/join/${code}`;
};

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { user, selectedAssociation, refreshAssociation, linkedAccounts, switchAccount, removeLinkedAccount } = useAuth();
  const qrRef = useRef<SVGSVGElement>(null);
  const [isYearModalOpen, setIsYearModalOpen] = useState(false);
  const [editingYear, setEditingYear] = useState<Year | null>(null);
  const [yearFormData, setYearFormData] = useState({
    year: new Date().getFullYear().toString(),
    monthlyAmount: '',
  });

  // URL d'invitation
  const joinCode = selectedAssociation?.code || '';
  const joinUrl = joinCode ? getJoinUrl(joinCode) : '';

  // Copier le lien dans le presse-papier
  const copyJoinLink = async () => {
    if (!joinUrl) return;
    try {
      await navigator.clipboard.writeText(joinUrl);
      toast.success('Lien copié dans le presse-papier !');
    } catch {
      toast.error('Impossible de copier le lien');
    }
  };

  // Télécharger le QR code en PNG
  const downloadQRCode = () => {
    if (!qrRef.current) return;
    const svg = qrRef.current;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      canvas.width = 300;
      canvas.height = 300;
      if (ctx) {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, 300, 300);
        const pngUrl = canvas.toDataURL('image/png');
        const downloadLink = document.createElement('a');
        downloadLink.href = pngUrl;
        downloadLink.download = `qr-${selectedAssociation?.name || 'association'}.png`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
      }
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  // État pour le libellé du champ personnalisé
  const [memberFieldLabel, setMemberFieldLabel] = useState('');
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [savingLabel, setSavingLabel] = useState(false);
  const [labelMessage, setLabelMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [removeAccountConfirm, setRemoveAccountConfirm] = useState<{ id: string; name: string } | null>(null);
  const [selectedPending, setSelectedPending] = useState<string[]>([]);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importContent, setImportContent] = useState('');
  const [importPreview, setImportPreview] = useState<any>(null);
  const [importing, setImporting] = useState(false);
  const [rateChangeModalYear, setRateChangeModalYear] = useState<Year | null>(null);
  const [rateChangeFormData, setRateChangeFormData] = useState({ fromMonth: '', amount: '' });

  // Paramètres des reçus + type d'organisation
  const [receiptHeader, setReceiptHeader] = useState('');
  const [receiptSignature, setReceiptSignature] = useState('');
  const [paymentInfo, setPaymentInfo] = useState('');
  const [isSyndic, setIsSyndic] = useState(false);
  const [savingReceipt, setSavingReceipt] = useState(false);

  const isAdmin = user?.role === 'ADMIN';

  // Gestion des comptes liés
  const handleAddAccount = () => {
    router.push('/login');
  };

  const handleSwitchAccount = (associationId: string | undefined) => {
    if (!associationId) return;
    switchAccount(associationId);
    // Invalider le cache des queries pour forcer le rechargement des données de la nouvelle association
    queryClient.clear();
    router.push('/dashboard');
  };

  const handleRemoveLinkedAccount = () => {
    if (removeAccountConfirm) {
      removeLinkedAccount(removeAccountConfirm.id);
      setRemoveAccountConfirm(null);
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setImportContent(text);
  };
  const handlePreviewImport = async () => {
    if (!importContent.trim()) {
      toast.error('Veuillez coller ou charger le contenu à importer');
      return;
    }
    setImporting(true);
    try {
      const response = await api.post('/import/members/preview', { content: importContent });
      setImportPreview(response.data);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erreur lors de la prévisualisation');
    } finally {
      setImporting(false);
    }
  };
  const handleConfirmImport = async () => {
    if (!importPreview || importPreview.valid === 0) {
      toast.error('Aucun membre valide à importer');
      return;
    }
    setImporting(true);
    try {
      const response = await api.post('/import/members', { members: importPreview.preview });
      toast.success(`Import terminé : ${response.data.success} réussis, ${response.data.failed} échecs`);
      setImportModalOpen(false);
      setImportContent('');
      setImportPreview(null);
      queryClient.invalidateQueries({ queryKey: ['members'] });
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erreur lors de l\'import');
    } finally {
      setImporting(false);
    }
  };
  const handleExportMembers = async () => {
    try {
      const response = await api.get('/export/members', { responseType: 'text' });
      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'membres.csv';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(link.href);
      toast.success('Fichier téléchargé');
    } catch (error) {
      toast.error('Erreur lors de l\'export');
    }
  };
  const handleExportStats = async () => {
    try {
      const activeYear = years?.find((y: Year) => y.active);
      if (!activeYear) {
        toast.error('Aucune année active');
        return;
      }
      const response = await api.get('/export/stats/csv', { responseType: 'text' });
      const blob = new Blob([response.data], { type: 'text/plain;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `statistiques_${activeYear.year}.txt`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(link.href);
      toast.success('Fichier téléchargé');
    } catch (error) {
      toast.error('Erreur lors de l\'export');
    }
  };
  const handleExportStatsPDF = async () => {
    const activeYear = years?.find((y: Year) => y.active);
    if (!activeYear) {
      toast.error('Aucune année active');
      return;
    }
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Fenêtre bloquée par le navigateur. Autorisez les pop-ups.');
      return;
    }
    printWindow.document.write('<p>Chargement…</p>');
    try {
      const response = await api.get('/export/stats/pdf', { responseType: 'text' });
      printWindow.document.open();
      printWindow.document.write(response.data);
      printWindow.document.close();
      printWindow.print();
    } catch (error) {
      printWindow.document.write('<p style="color:red">Erreur lors du chargement.</p>');
    }
  };

  const { data: config, isLoading: loadingConfig } = useQuery({
    queryKey: ['config'],
    queryFn: async () => {
      const response = await api.get('/config');
      return response.data;
    },
  });

  // Initialiser le libellé quand config est chargé
  useEffect(() => {
    if (config?.memberFieldLabel) {
      setMemberFieldLabel(config.memberFieldLabel);
    }
    if (config) {
      setReceiptHeader(config.receiptHeader || '');
      setReceiptSignature(config.receiptSignature || '');
      setPaymentInfo(config.paymentInfo || '');
      setIsSyndic(config.type === 'SYNDIC');
    }
  }, [config]);

  const handleSaveReceiptSettings = async () => {
    setSavingReceipt(true);
    try {
      await api.put('/admin/association-settings', {
        receiptHeader,
        receiptSignature,
        paymentInfo,
        type: isSyndic ? 'SYNDIC' : 'ASSOCIATION',
      });
      toast.success('Paramètres enregistrés');
      queryClient.invalidateQueries({ queryKey: ['config'] });
      await refreshAssociation();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erreur lors de la sauvegarde');
    } finally {
      setSavingReceipt(false);
    }
  };

  const { data: years, isLoading: loadingYears } = useQuery({
    queryKey: ['years'],
    queryFn: async () => {
      const response = await api.get('/years');
      return response.data as Year[];
    },
  });

  const createYearMutation = useMutation({
    mutationFn: async (data: { year: number; monthlyAmount: number }) => {
      const response = await api.post('/years', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['years'] });
      setIsYearModalOpen(false);
      setEditingYear(null);
      setYearFormData({ year: new Date().getFullYear().toString(), monthlyAmount: '' });
    },
  });

  const updateYearMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { year: number; monthlyAmount: number } }) => {
      const response = await api.put(`/years/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['years'] });
      setIsYearModalOpen(false);
      setEditingYear(null);
      setYearFormData({ year: new Date().getFullYear().toString(), monthlyAmount: '' });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la modification');
    },
  });

  const toggleYearMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.put(`/years/${id}/activate`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['years'] });
    },
  });

  const deleteYearMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/years/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['years'] });
    },
  });

  const addRateChangeMutation = useMutation({
    mutationFn: async ({ yearId, data }: { yearId: string; data: { fromMonth: number; amount: number } }) => {
      const response = await api.post(`/years/${yearId}/rate-changes`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['years'] });
      setRateChangeModalYear(null);
      setRateChangeFormData({ fromMonth: '', amount: '' });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de l\'ajout du changement de tarif');
    },
  });
  const deleteRateChangeMutation = useMutation({
    mutationFn: async ({ yearId, changeId }: { yearId: string; changeId: string }) => {
      await api.delete(`/years/${yearId}/rate-changes/${changeId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['years'] });
    },
  });

  // ── Demandes d'inscription en attente (ADMIN) ──
  const { data: pendingMembers } = useQuery({
    queryKey: ['pending-members'],
    queryFn: async () => {
      const response = await api.get('/admin/pending-members');
      return response.data as PendingMember[];
    },
    enabled: isAdmin,
  });

  const approvePendingMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const response = await api.post('/admin/pending-members/approve', { ids });
      return response.data;
    },
    onSuccess: (data: { count: number }) => {
      toast.success(`${data.count} demande(s) approuvée(s)`);
      setSelectedPending([]);
      queryClient.invalidateQueries({ queryKey: ['pending-members'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || "Erreur lors de l'approbation");
    },
  });

  const rejectPendingMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const response = await api.post('/admin/pending-members/reject', { ids });
      return response.data;
    },
    onSuccess: (data: { count: number }) => {
      toast.success(`${data.count} demande(s) refusée(s)`);
      setSelectedPending([]);
      queryClient.invalidateQueries({ queryKey: ['pending-members'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors du refus');
    },
  });

  const pendingList = pendingMembers || [];
  const togglePendingSelection = (id: string) => {
    setSelectedPending((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };
  const toggleSelectAllPending = () => {
    setSelectedPending((prev) =>
      prev.length === pendingList.length ? [] : pendingList.map((m) => m.id)
    );
  };

  const handleCreateOrUpdateYear = (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      year: parseInt(yearFormData.year),
      monthlyAmount: parseFloat(yearFormData.monthlyAmount),
    };

    if (editingYear) {
      updateYearMutation.mutate({ id: editingYear.id, data });
    } else {
      createYearMutation.mutate(data);
    }
  };

  const handleEditYear = (year: Year) => {
    setEditingYear(year);
    setYearFormData({
      year: year.year.toString(),
      monthlyAmount: year.monthlyAmount.toString(),
    });
    setIsYearModalOpen(true);
  };

  const handleSaveLabel = async () => {
    if (!memberFieldLabel.trim()) {
      setLabelMessage({ type: 'error', text: 'Le libellé ne peut pas être vide' });
      return;
    }

    setSavingLabel(true);
    setLabelMessage(null);

    try {
      await api.put('/auth/association-settings', {
        memberFieldLabel: memberFieldLabel.trim()
      });
      setLabelMessage({ type: 'success', text: 'Libellé enregistré' });
      setIsEditingLabel(false);
      queryClient.invalidateQueries({ queryKey: ['config'] });
    } catch (error: any) {
      setLabelMessage({ type: 'error', text: error.response?.data?.error || 'Erreur lors de la sauvegarde' });
    } finally {
      setSavingLabel(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Paramètres</h1>
          <p className="text-gray-500">
            Configuration de {selectedAssociation?.name || "l'association"}
          </p>
        </div>

        {/* Configuration générale */}
        <Card>
          <CardHeader>
            <CardTitle>Configuration générale</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-500">Nom de l&apos;association</label>
                <p className="font-medium">{config?.name || selectedAssociation?.name}</p>
              </div>
              <div>
                <label className="text-sm text-gray-500">Type</label>
                <p className="font-medium capitalize">{config?.type || selectedAssociation?.type}</p>
              </div>
            </div>

            {/* Libellé champ personnalisé - Modifiable */}
            <div className="border-t pt-4 mt-4">
              <label className="text-sm text-gray-500 block mb-2">
                Libellé du champ personnalisé des membres
              </label>
              
              {labelMessage && (
                <div className={`mb-3 p-2 rounded text-sm ${
                  labelMessage.type === 'success' 
                    ? 'bg-green-50 text-green-700 border border-green-200' 
                    : 'bg-red-50 text-red-700 border border-red-200'
                }`}>
                  {labelMessage.text}
                </div>
              )}

              <div className="flex items-center gap-3">
                {isEditingLabel ? (
                  <>
                    <Input
                      value={memberFieldLabel}
                      onChange={(e) => setMemberFieldLabel(e.target.value)}
                      placeholder="Ex: Villa, Fonction, Matricule..."
                      className="flex-1"
                    />
                    <Button 
                      onClick={handleSaveLabel} 
                      disabled={savingLabel}
                      size="sm"
                    >
                      <Save className="w-4 h-4 mr-1" />
                      {savingLabel ? '...' : 'Enregistrer'}
                    </Button>
                    <Button 
                      variant="secondary" 
                      size="sm"
                      onClick={() => {
                        setIsEditingLabel(false);
                        setMemberFieldLabel(config?.memberFieldLabel || 'Villa');
                        setLabelMessage(null);
                      }}
                    >
                      Annuler
                    </Button>
                  </>
                ) : (
                  <>
                    <p className="font-medium">{config?.memberFieldLabel || 'Villa'}</p>
                    <Button 
                      variant="secondary" 
                      size="sm"
                      onClick={() => setIsEditingLabel(true)}
                    >
                      <Pencil className="w-4 h-4 mr-1" />
                      Modifier
                    </Button>
                  </>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Ce libellé apparaît dans les fiches membres (ex: &quot;Villa 42&quot;, &quot;Trésorier&quot;, etc.)
              </p>
            </div>

            {/* Reçus & type d'organisation */}
            <div className="border-t pt-4 mt-4 space-y-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isSyndic}
                  onChange={(e) => setIsSyndic(e.target.checked)}
                  className="w-4 h-4 accent-primary"
                  data-testid="syndic-checkbox"
                />
                <span className="text-sm font-medium text-gray-700">
                  Ceci est un syndic de copropriété
                  <span className="block text-xs text-gray-400 font-normal">
                    Change le vocabulaire (copropriétaires, charges)
                  </span>
                </span>
              </label>

              <div>
                <label className="text-sm text-gray-500 block mb-1">En-tête des reçus</label>
                <Input
                  value={receiptHeader}
                  onChange={(e) => setReceiptHeader(e.target.value)}
                  placeholder="Ex: Syndic BNI - Reçus officiels"
                  data-testid="receipt-header-input"
                />
              </div>

              <div>
                <label className="text-sm text-gray-500 block mb-1">Signature des reçus</label>
                <textarea
                  value={receiptSignature}
                  onChange={(e) => setReceiptSignature(e.target.value)}
                  placeholder={"Ex: Étude de Maître Sylla Yaya\nSyndic BNI"}
                  rows={2}
                  data-testid="receipt-signature-input"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-primary focus:ring-1 focus:ring-primary resize-none"
                />
              </div>

              <div>
                <label className="text-sm text-gray-500 block mb-1">Infos de paiement</label>
                <Input
                  value={paymentInfo}
                  onChange={(e) => setPaymentInfo(e.target.value)}
                  placeholder="Ex: Paiements au numéro 07 57 43957 (Mme Komian)"
                  data-testid="payment-info-input"
                />
              </div>

              <Button onClick={handleSaveReceiptSettings} disabled={savingReceipt} size="sm">
                <Save className="w-4 h-4 mr-1" />
                {savingReceipt ? '...' : 'Enregistrer'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Demandes d'inscription - ADMIN uniquement */}
        {isAdmin && (
          <Card data-testid="pending-members-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-primary" />
                  <CardTitle>Demandes d&apos;inscription</CardTitle>
                  {pendingList.length > 0 && (
                    <span
                      className="inline-flex items-center justify-center min-w-[24px] h-6 px-2 rounded-full bg-red-500 text-white text-xs font-bold"
                      data-testid="pending-count-badge"
                    >
                      {pendingList.length}
                    </span>
                  )}
                </div>
                {pendingList.length > 0 && (
                  <button
                    type="button"
                    onClick={toggleSelectAllPending}
                    className="text-sm text-primary hover:underline"
                    data-testid="pending-select-all"
                  >
                    {selectedPending.length === pendingList.length ? 'Tout désélectionner' : 'Tout sélectionner'}
                  </button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {pendingList.length === 0 ? (
                <p className="text-sm text-gray-500 py-4 text-center">
                  Aucune demande d&apos;inscription en attente
                </p>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-2">
                    {pendingList.map((m) => {
                      const selected = selectedPending.includes(m.id);
                      return (
                        <label
                          key={m.id}
                          className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                            selected ? 'border-primary bg-amber-50' : 'border-gray-200 hover:bg-gray-50'
                          }`}
                          data-testid={`pending-item-${m.id}`}
                        >
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => togglePendingSelection(m.id)}
                            className="w-4 h-4 accent-primary"
                            data-testid={`pending-checkbox-${m.id}`}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 truncate">{m.name || 'Sans nom'}</p>
                            <p className="text-sm text-gray-500 truncate">
                              {[m.phone, m.email && !m.email.includes('@temp.local') ? m.email : null]
                                .filter(Boolean)
                                .join(' • ')}
                            </p>
                          </div>
                        </label>
                      );
                    })}
                  </div>

                  <div className="flex gap-3 pt-2">
                    <Button
                      onClick={() => approvePendingMutation.mutate(selectedPending)}
                      disabled={selectedPending.length === 0 || approvePendingMutation.isPending}
                      data-testid="pending-approve-button"
                    >
                      <Check className="w-4 h-4 mr-1" />
                      Approuver{selectedPending.length > 0 ? ` (${selectedPending.length})` : ''}
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => rejectPendingMutation.mutate(selectedPending)}
                      disabled={selectedPending.length === 0 || rejectPendingMutation.isPending}
                      data-testid="pending-reject-button"
                      className="text-red-600 border-red-200 hover:bg-red-50"
                    >
                      Refuser
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Inviter des membres */}
        {joinCode && (
          <Card data-testid="invite-members-card">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Share2 className="w-5 h-5 text-primary" />
                <CardTitle>Inviter des membres</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row gap-6">
                {/* QR Code */}
                <div className="flex flex-col items-center gap-3 p-4 bg-gray-50 rounded-lg">
                  <div className="p-3 bg-white rounded-lg shadow-sm">
                    <QRCodeSVG
                      ref={qrRef}
                      value={joinUrl}
                      size={150}
                      level="H"
                      includeMargin
                    />
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={downloadQRCode}
                    data-testid="download-qr-btn"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Télécharger
                  </Button>
                </div>

                {/* Lien et instructions */}
                <div className="flex-1 space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-2">
                      Lien d&apos;invitation
                    </label>
                    <div className="flex gap-2">
                      <Input
                        value={joinUrl}
                        readOnly
                        className="flex-1 bg-gray-50 font-mono text-sm"
                        data-testid="invite-link-input"
                      />
                      <Button
                        onClick={copyJoinLink}
                        data-testid="copy-invite-link-btn"
                      >
                        <Copy className="w-4 h-4 mr-2" />
                        Copier
                      </Button>
                    </div>
                  </div>

                  <div className="text-sm text-gray-600 space-y-2">
                    <p className="flex items-center gap-2">
                      <QrCode className="w-4 h-4 text-gray-400" />
                      <span>Partagez le QR code ou le lien avec vos futurs membres</span>
                    </p>
                    <p className="text-gray-500">
                      En scannant le code ou en cliquant sur le lien, ils pourront rejoindre 
                      <strong className="text-gray-700"> {selectedAssociation?.name}</strong> directement depuis l&apos;application.
                    </p>
                  </div>

                  <div className="pt-2 border-t">
                    <p className="text-xs text-gray-400">
                      Code d&apos;association : <code className="bg-gray-100 px-2 py-0.5 rounded">{joinCode}</code>
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Comptes liés */}
        <Card data-testid="linked-accounts-card">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              <CardTitle>Comptes liés</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Bouton Ajouter un compte - toujours visible */}
              <Button
                variant="secondary"
                onClick={handleAddAccount}
                className="w-full border-2 border-dashed"
                data-testid="add-account-btn"
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Ajouter un compte
              </Button>

              {/* Liste des comptes liés - uniquement si plus d'un */}
              {linkedAccounts && linkedAccounts.length > 1 && (
                <div className="space-y-2">
                  {linkedAccounts.map((account) => {
                    const isActive = account.association?.id === selectedAssociation?.id;
                    return (
                      <div
                        key={account.association?.id}
                        className={`flex items-center justify-between p-3 rounded-lg border ${
                          isActive ? 'border-primary bg-primary/5' : 'border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <button
                          className="flex items-center gap-3 flex-1 text-left"
                          onClick={() => !isActive && handleSwitchAccount(account.association?.id)}
                          disabled={isActive}
                          data-testid={`switch-account-${account.association?.id}`}
                        >
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            isActive ? 'bg-primary/10' : 'bg-gray-100'
                          }`}>
                            <Users className={`w-5 h-5 ${isActive ? 'text-primary' : 'text-gray-500'}`} />
                          </div>
                          <div>
                            <p className={`font-medium ${isActive ? 'text-primary' : 'text-gray-900'}`}>
                              {account.association?.name || 'Association'}
                            </p>
                            <p className="text-sm text-gray-500">
                              {account.association?.type && `${account.association.type} • `}
                              {account.association?.code}
                            </p>
                          </div>
                        </button>
                        
                        <div className="flex items-center gap-2">
                          {isActive && (
                            <Badge variant="success" className="flex items-center gap-1">
                              <Check className="w-3 h-3" />
                              Actif
                            </Badge>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setRemoveAccountConfirm({
                              id: account.association?.id,
                              name: account.association?.name || 'Association'
                            })}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                            data-testid={`remove-account-${account.association?.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {linkedAccounts?.length <= 1 && (
                <p className="text-sm text-gray-500 text-center">
                  Ajoutez un compte pour gérer plusieurs associations sans vous déconnecter.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Gestion des années */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Années de cotisation</CardTitle>
              <Button size="sm" onClick={() => {
                setEditingYear(null);
                setYearFormData({ year: new Date().getFullYear().toString(), monthlyAmount: '' });
                setIsYearModalOpen(true);
              }}>
                <Plus className="w-4 h-4 mr-2" />
                Nouvelle année
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loadingYears ? (
              <p className="text-gray-500">Chargement...</p>
            ) : years?.length === 0 ? (
              <p className="text-gray-500">Aucune année configurée</p>
            ) : (
              <div className="space-y-3">
                {years?.map((year) => (
                  <div
                    key={year.id}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                  >
                    <div>
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-lg">{year.year}</span>
                        {year.active && <Badge variant="success">Active</Badge>}
                      </div>
                      <p className="text-sm text-gray-500">
                        {formatCurrency(year.monthlyAmount)} / mois
                      </p>
                      {year.rateChanges?.map((rc) => (
                        <div key={rc.id} className="flex items-center gap-2 text-xs text-gray-600 mt-1">
                          <span>À partir du mois {rc.fromMonth} : {formatCurrency(rc.amount)}/mois</span>
                          <button onClick={() => deleteRateChangeMutation.mutate({ yearId: year.id, changeId: rc.id })} className="text-red-400 hover:text-red-600">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => { setRateChangeModalYear(year); setRateChangeFormData({ fromMonth: '', amount: '' }); }}
                        className="text-xs text-primary hover:underline mt-1"
                      >
                        + Changement de tarif
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEditYear(year)}
                        className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                        title="Modifier"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      {!year.active && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => toggleYearMutation.mutate(year.id)}
                        >
                          Activer
                        </Button>
                      )}
                      <button
                        onClick={() => {
                          if (confirm('Supprimer cette année ?')) {
                            deleteYearMutation.mutate(year.id);
                          }
                        }}
                        className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                        disabled={year.active}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Import / Export</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <button
              onClick={() => setImportModalOpen(true)}
              className="w-full flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors text-left"
            >
              <Upload className="w-5 h-5 text-primary" />
              <span className="text-sm font-medium text-gray-900">Importer des membres (TXT/CSV)</span>
            </button>
            <button
              onClick={handleExportMembers}
              className="w-full flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors text-left"
            >
              <Download className="w-5 h-5 text-[#2E7D32]" />
              <span className="text-sm font-medium text-gray-900">Exporter les membres (CSV)</span>
            </button>
            <button
              onClick={handleExportStats}
              className="w-full flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors text-left"
            >
              <FileText className="w-5 h-5 text-[#B26A00]" />
              <span className="text-sm font-medium text-gray-900">Exporter les statistiques (CSV)</span>
            </button>
            <button
              onClick={handleExportStatsPDF}
              className="w-full flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors text-left"
            >
              <FileText className="w-5 h-5 text-[#B00020]" />
              <span className="text-sm font-medium text-gray-900">Exporter les statistiques (PDF)</span>
            </button>
          </CardContent>
        </Card>

        {/* Modal Création/Modification Année */}
        <Modal
          isOpen={isYearModalOpen}
          onClose={() => {
            setIsYearModalOpen(false);
            setEditingYear(null);
          }}
          title={editingYear ? "Modifier l'année" : "Nouvelle année de cotisation"}
        >
          <form onSubmit={handleCreateOrUpdateYear} className="space-y-4">
            <Input
              label="Année"
              type="number"
              value={yearFormData.year}
              onChange={(e) => setYearFormData({ ...yearFormData, year: e.target.value })}
              required
            />
            {editingYear && (
              <p className="text-xs text-gray-500 -mt-2">
                Vous pouvez corriger le numéro d&apos;année si nécessaire
              </p>
            )}
            <Input
              label="Cotisation mensuelle (FCFA)"
              type="number"
              value={yearFormData.monthlyAmount}
              onChange={(e) => setYearFormData({ ...yearFormData, monthlyAmount: e.target.value })}
              placeholder="Ex: 5000"
              required
            />
            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setIsYearModalOpen(false);
                  setEditingYear(null);
                }}
              >
                Annuler
              </Button>
              <Button 
                type="submit" 
                loading={createYearMutation.isPending || updateYearMutation.isPending}
              >
                {editingYear ? 'Modifier' : 'Créer'}
              </Button>
            </div>
          </form>
        </Modal>

        <Modal
          isOpen={!!rateChangeModalYear}
          onClose={() => setRateChangeModalYear(null)}
          title={`Changement de tarif — ${rateChangeModalYear?.year ?? ''}`}
        >
          <form onSubmit={(e) => {
            e.preventDefault();
            if (!rateChangeModalYear) return;
            addRateChangeMutation.mutate({
              yearId: rateChangeModalYear.id,
              data: { fromMonth: parseInt(rateChangeFormData.fromMonth), amount: parseFloat(rateChangeFormData.amount) },
            });
          }} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">À partir du mois</label>
              <select
                value={rateChangeFormData.fromMonth}
                onChange={(e) => setRateChangeFormData({ ...rateChangeFormData, fromMonth: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                required
              >
                <option value="">Choisir un mois</option>
                {['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'].map((m, i) => (
                  <option key={i + 1} value={i + 1}>{m}</option>
                ))}
              </select>
            </div>
            <Input
              label="Nouvelle cotisation mensuelle (FCFA)"
              type="number"
              value={rateChangeFormData.amount}
              onChange={(e) => setRateChangeFormData({ ...rateChangeFormData, amount: e.target.value })}
              placeholder="Ex: 10000"
              required
            />
            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="secondary" onClick={() => setRateChangeModalYear(null)}>Annuler</Button>
              <Button type="submit" loading={addRateChangeMutation.isPending}>Ajouter</Button>
            </div>
          </form>
        </Modal>

        {/* Modal de confirmation suppression compte lié */}
        <Modal
          isOpen={!!removeAccountConfirm}
          onClose={() => setRemoveAccountConfirm(null)}
          title="Retirer ce compte ?"
        >
          <div className="space-y-4">
            <p className="text-gray-600">
              Voulez-vous retirer <strong>{removeAccountConfirm?.name}</strong> de vos comptes liés ?
            </p>
            <p className="text-sm text-gray-500">
              Vous pourrez toujours vous reconnecter à ce compte plus tard.
            </p>
            <div className="flex gap-3 justify-end pt-4">
              <Button variant="secondary" onClick={() => setRemoveAccountConfirm(null)}>
                Annuler
              </Button>
              <Button 
                variant="danger"
                onClick={handleRemoveLinkedAccount}
              >
                Retirer
              </Button>
            </div>
          </div>
        </Modal>

        <Modal
          isOpen={importModalOpen}
          onClose={() => { setImportModalOpen(false); setImportContent(''); setImportPreview(null); }}
          title="Importer des membres"
        >
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              Format attendu par ligne : nom;champ personnalisé;téléphone (ex: Jean Kouassi;Villa 12;0708091011)
            </p>
            <input
              type="file"
              accept=".txt,.csv,text/plain,text/csv"
              onChange={handleImportFile}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
            />
            <textarea
              value={importContent}
              onChange={(e) => setImportContent(e.target.value)}
              placeholder={"Jean Kouassi;Villa 12;0708091011\nMarie Yao;Villa 13;0506070809"}
              rows={6}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-primary focus:ring-1 focus:ring-primary resize-none font-mono"
            />
            <Button onClick={handlePreviewImport} loading={importing} disabled={!importContent.trim()}>
              Prévisualiser
            </Button>
            {importPreview && (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="bg-green-50 rounded-lg p-3">
                    <p className="text-lg font-bold text-[#2E7D32]">{importPreview.valid || 0}</p>
                    <p className="text-xs text-gray-500">Valides</p>
                  </div>
                  <div className="bg-orange-50 rounded-lg p-3">
                    <p className="text-lg font-bold text-[#B26A00]">{importPreview.duplicatesCount || 0}</p>
                    <p className="text-xs text-gray-500">Doublons</p>
                  </div>
                  <div className="bg-red-50 rounded-lg p-3">
                    <p className="text-lg font-bold text-[#B00020]">{importPreview.errorsCount || 0}</p>
                    <p className="text-xs text-gray-500">Erreurs</p>
                  </div>
                </div>
                {importPreview.valid > 0 && (
                  <Button onClick={handleConfirmImport} loading={importing} className="w-full">
                    Confirmer l&apos;import ({importPreview.valid} membre{importPreview.valid > 1 ? 's' : ''})
                  </Button>
                )}
              </div>
            )}
          </div>
        </Modal>
      </div>
    </DashboardLayout>
  );
}

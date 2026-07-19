'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout';
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Badge, Modal } from '@/components/ui';
import { api } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, Pencil, Trash2, Save } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface Year {
  id: string;
  year: number;
  monthlyAmount: number;
  active: boolean;
  createdAt: string;
}

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { selectedAssociation } = useAuth();
  const [isYearModalOpen, setIsYearModalOpen] = useState(false);
  const [editingYear, setEditingYear] = useState<Year | null>(null);
  const [yearFormData, setYearFormData] = useState({
    year: new Date().getFullYear().toString(),
    monthlyAmount: '',
  });

  // État pour le libellé du champ personnalisé
  const [memberFieldLabel, setMemberFieldLabel] = useState('');
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [savingLabel, setSavingLabel] = useState(false);
  const [labelMessage, setLabelMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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
  }, [config]);

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
      alert(error.response?.data?.error || 'Erreur lors de la modification');
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
      </div>
    </DashboardLayout>
  );
}

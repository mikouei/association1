'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout';
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Badge, Modal } from '@/components/ui';
import { api } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, Pencil, Trash2 } from 'lucide-react';
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
  const [yearFormData, setYearFormData] = useState({
    year: new Date().getFullYear().toString(),
    monthlyAmount: '',
  });

  const { data: config, isLoading: loadingConfig } = useQuery({
    queryKey: ['config'],
    queryFn: async () => {
      const response = await api.get('/config');
      return response.data;
    },
  });

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
      setYearFormData({ year: new Date().getFullYear().toString(), monthlyAmount: '' });
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

  const handleCreateYear = (e: React.FormEvent) => {
    e.preventDefault();
    createYearMutation.mutate({
      year: parseInt(yearFormData.year),
      monthlyAmount: parseFloat(yearFormData.monthlyAmount),
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Paramètres</h1>
          <p className="text-gray-500">
            Configuration de {selectedAssociation?.name || 'l\'association'}
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
                <label className="text-sm text-gray-500">Nom de l'association</label>
                <p className="font-medium">{config?.name || selectedAssociation?.name}</p>
              </div>
              <div>
                <label className="text-sm text-gray-500">Type</label>
                <p className="font-medium capitalize">{config?.type || selectedAssociation?.type}</p>
              </div>
              <div>
                <label className="text-sm text-gray-500">Libellé champ membre</label>
                <p className="font-medium">{config?.memberFieldLabel || 'Villa'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Gestion des années */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Années de cotisation</CardTitle>
              <Button size="sm" onClick={() => setIsYearModalOpen(true)}>
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

        {/* Modal Création Année */}
        <Modal
          isOpen={isYearModalOpen}
          onClose={() => setIsYearModalOpen(false)}
          title="Nouvelle année de cotisation"
        >
          <form onSubmit={handleCreateYear} className="space-y-4">
            <Input
              label="Année"
              type="number"
              value={yearFormData.year}
              onChange={(e) => setYearFormData({ ...yearFormData, year: e.target.value })}
              required
            />
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
                onClick={() => setIsYearModalOpen(false)}
              >
                Annuler
              </Button>
              <Button type="submit" loading={createYearMutation.isPending}>
                Créer
              </Button>
            </div>
          </form>
        </Modal>
      </div>
    </DashboardLayout>
  );
}

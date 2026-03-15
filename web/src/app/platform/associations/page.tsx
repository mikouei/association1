'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout';
import { Card, CardHeader, CardTitle, CardContent, Button, Input, DataTable, Badge, Modal } from '@/components/ui';
import { platformApi } from '@/services/api';
import { Association } from '@/types';
import { Plus, Pencil, Trash2, UserCog } from 'lucide-react';
import { formatDate } from '@/lib/utils';

export default function AssociationsPage() {
  const queryClient = useQueryClient();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingAssoc, setEditingAssoc] = useState<Association | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    type: 'association',
    adminEmail: '',
    adminPassword: '',
    adminName: '',
  });

  const { data: associations, isLoading } = useQuery({
    queryKey: ['platform-associations'],
    queryFn: async () => {
      const response = await platformApi.get('/platform/associations');
      return response.data as Association[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await platformApi.post('/platform/associations', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-associations'] });
      setIsCreateModalOpen(false);
      resetForm();
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await platformApi.put(`/platform/associations/${id}/toggle`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-associations'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await platformApi.delete(`/platform/associations/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-associations'] });
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      code: '',
      type: 'association',
      adminEmail: '',
      adminPassword: '',
      adminName: '',
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  const columns = [
    {
      key: 'name',
      header: 'Nom',
      render: (assoc: Association) => (
        <div>
          <p className="font-medium text-gray-900">{assoc.name}</p>
          <p className="text-sm text-gray-500">{assoc.code}</p>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (assoc: Association) => (
        <span className="capitalize">{assoc.type || 'Association'}</span>
      ),
    },
    {
      key: 'adminEmail',
      header: 'Admin',
      render: (assoc: Association) => (
        <span className="text-sm text-gray-600">{assoc.adminEmail || '-'}</span>
      ),
    },
    {
      key: 'active',
      header: 'Statut',
      render: (assoc: Association) => (
        <Badge variant={assoc.active ? 'success' : 'danger'}>
          {assoc.active ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'createdAt',
      header: 'Créée le',
      render: (assoc: Association) => formatDate(assoc.createdAt),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (assoc: Association) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => toggleMutation.mutate(assoc.id)}
            className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
            title={assoc.active ? 'Désactiver' : 'Activer'}
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              if (confirm('Êtes-vous sûr de vouloir supprimer cette association ?')) {
                deleteMutation.mutate(assoc.id);
              }
            }}
            className="p-1 text-gray-400 hover:text-red-600 transition-colors"
            title="Supprimer"
            disabled={assoc.code === 'V1-DEFAULT'}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <DashboardLayout requirePlatformAuth>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Associations</h1>
            <p className="text-gray-500">Gérez toutes les associations de la plateforme</p>
          </div>
          <Button onClick={() => setIsCreateModalOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Nouvelle association
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            <DataTable
              data={associations || []}
              columns={columns}
              loading={isLoading}
              emptyMessage="Aucune association"
            />
          </CardContent>
        </Card>

        {/* Modal Création */}
        <Modal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          title="Nouvelle Association"
          size="lg"
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Nom de l'association"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
            <Input
              label="Code unique"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
              placeholder="EX: SYNDIC-A"
              required
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="association">Association</option>
                <option value="syndicat">Syndicat</option>
                <option value="amicale">Amicale</option>
              </select>
            </div>
            <Input
              label="Email Admin"
              type="email"
              value={formData.adminEmail}
              onChange={(e) => setFormData({ ...formData, adminEmail: e.target.value })}
              required
            />
            <Input
              label="Mot de passe Admin"
              type="password"
              value={formData.adminPassword}
              onChange={(e) => setFormData({ ...formData, adminPassword: e.target.value })}
              required
            />
            <Input
              label="Nom Admin"
              value={formData.adminName}
              onChange={(e) => setFormData({ ...formData, adminName: e.target.value })}
            />
            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setIsCreateModalOpen(false)}
              >
                Annuler
              </Button>
              <Button type="submit" loading={createMutation.isPending}>
                Créer
              </Button>
            </div>
          </form>
        </Modal>
      </div>
    </DashboardLayout>
  );
}

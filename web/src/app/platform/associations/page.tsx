'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout';
import { Card, CardHeader, CardTitle, CardContent, Button, Input, DataTable, Badge, Modal } from '@/components/ui';
import { platformApi } from '@/services/api';
import { Association } from '@/types';
import { Plus, Pencil, Trash2, Power, PowerOff } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { useRouter } from 'next/navigation';

export default function AssociationsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [toggleConfirm, setToggleConfirm] = useState<Association | null>(null);
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
      setToggleConfirm(null);
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

  const handleEdit = (assoc: Association) => {
    router.push(`/platform/associations/${assoc.id}`);
  };

  const handleToggleClick = (assoc: Association) => {
    setToggleConfirm(assoc);
  };

  const confirmToggle = () => {
    if (toggleConfirm) {
      toggleMutation.mutate(toggleConfirm.id);
    }
  };

  const columns = [
    {
      key: 'name',
      header: 'Nom',
      render: (assoc: Association) => (
        <div>
          <div className="flex items-center gap-2">
            <p className="font-medium text-gray-900">{assoc.name}</p>
            {(assoc as Association & { source?: string }).source === 'self_service' && (
              <span className="px-2 py-0.5 text-xs bg-purple-100 text-purple-700 rounded-full font-medium">
                Libre-service
              </span>
            )}
          </div>
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
          {/* Bouton Modifier - Ouvre la page d'édition */}
          <button
            onClick={() => handleEdit(assoc)}
            className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
            title="Modifier l'association"
          >
            <Pencil className="w-4 h-4" />
          </button>
          
          {/* Bouton Activer/Désactiver - Avec confirmation */}
          <button
            onClick={() => handleToggleClick(assoc)}
            className={`p-1.5 rounded transition-colors ${
              assoc.active 
                ? 'text-gray-500 hover:text-orange-600 hover:bg-orange-50' 
                : 'text-gray-500 hover:text-green-600 hover:bg-green-50'
            }`}
            title={assoc.active ? 'Désactiver' : 'Activer'}
          >
            {assoc.active ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
          </button>
          
          {/* Bouton Supprimer */}
          <button
            onClick={() => {
              if (confirm('Êtes-vous sûr de vouloir supprimer cette association ? Cette action est irréversible.')) {
                deleteMutation.mutate(assoc.id);
              }
            }}
            className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
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

        {/* Modal Confirmation Toggle */}
        <Modal
          isOpen={!!toggleConfirm}
          onClose={() => setToggleConfirm(null)}
          title={toggleConfirm?.active ? 'Désactiver l\'association' : 'Activer l\'association'}
          size="md"
        >
          <div className="space-y-4">
            {toggleConfirm?.active ? (
              <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                <p className="text-orange-800 font-medium">
                  Êtes-vous sûr de vouloir désactiver « {toggleConfirm?.name} » ?
                </p>
                <p className="text-orange-700 text-sm mt-2">
                  Ses membres et son admin ne pourront plus se connecter tant que l&apos;association sera inactive.
                </p>
              </div>
            ) : (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-green-800 font-medium">
                  Voulez-vous réactiver « {toggleConfirm?.name} » ?
                </p>
                <p className="text-green-700 text-sm mt-2">
                  Ses membres et son admin pourront à nouveau se connecter.
                </p>
              </div>
            )}
            
            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setToggleConfirm(null)}
              >
                Annuler
              </Button>
              <Button 
                onClick={confirmToggle} 
                loading={toggleMutation.isPending}
                className={toggleConfirm?.active ? 'bg-orange-600 hover:bg-orange-700' : 'bg-green-600 hover:bg-green-700'}
              >
                {toggleConfirm?.active ? 'Désactiver' : 'Activer'}
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </DashboardLayout>
  );
}

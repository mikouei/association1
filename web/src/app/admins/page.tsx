'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout';
import { Card, CardContent, Button, Input, DataTable, Badge, Modal, toast } from '@/components/ui';
import { api } from '@/services/api';
import { Admin } from '@/types';
import { Plus, Key, UserX, UserCheck } from 'lucide-react';
import { formatDate } from '@/lib/utils';

export default function AdminsPage() {
  const queryClient = useQueryClient();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [resetPasswordModal, setResetPasswordModal] = useState<{ isOpen: boolean; admin: Admin | null }>({
    isOpen: false,
    admin: null,
  });
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    phone: '',
  });
  const [newPassword, setNewPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');

  const { data: admins, isLoading } = useQuery({
    queryKey: ['admins'],
    queryFn: async () => {
      const response = await api.get('/admin/list');
      return response.data as Admin[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await api.post('/admin/create', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admins'] });
      setIsCreateModalOpen(false);
      resetForm();
      toast.success('Administrateur créé avec succès');
    },
    onError: (error: { response?: { data?: { error?: string } } }) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la création');
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async ({ id, newPassword, currentPassword }: { id: string; newPassword: string; currentPassword: string }) => {
      const response = await api.post(`/admin/${id}/reset-password`, { newPassword, currentPassword });
      return response.data;
    },
    onSuccess: () => {
      setResetPasswordModal({ isOpen: false, admin: null });
      setNewPassword('');
      setCurrentPassword('');
      toast.success('Mot de passe changé avec succès');
    },
    onError: (error: { response?: { data?: { error?: string } } }) => {
      toast.error(error.response?.data?.error || 'Erreur lors du changement de mot de passe');
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const response = await api.put(`/admin/${id}/${active ? 'activate' : 'deactivate'}`);
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admins'] });
      toast.success(variables.active ? 'Administrateur réactivé' : 'Administrateur désactivé');
    },
    onError: (error: { response?: { data?: { error?: string } } }) => {
      toast.error(error.response?.data?.error || 'Erreur lors de l\'opération');
    },
  });

  const resetForm = () => {
    setFormData({ email: '', password: '', phone: '' });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  const handleResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPasswordModal.admin) return;
    resetPasswordMutation.mutate({
      id: resetPasswordModal.admin.id,
      newPassword,
      currentPassword,
    });
  };

  const handleCloseResetModal = () => {
    setResetPasswordModal({ isOpen: false, admin: null });
    setNewPassword('');
    setCurrentPassword('');
  };

  const columns = [
    {
      key: 'email',
      header: 'Email',
      render: (admin: Admin) => (
        <p className="font-medium text-gray-900">{admin.email}</p>
      ),
    },
    {
      key: 'phone',
      header: 'Téléphone',
      render: (admin: Admin) => (
        <span className="text-gray-600">{admin.phone || '-'}</span>
      ),
    },
    {
      key: 'active',
      header: 'Statut',
      render: (admin: Admin) => (
        <Badge variant={admin.active ? 'success' : 'danger'}>
          {admin.active ? 'Actif' : 'Inactif'}
        </Badge>
      ),
    },
    {
      key: 'createdAt',
      header: 'Créé le',
      render: (admin: Admin) => formatDate(admin.createdAt),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (admin: Admin) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => setResetPasswordModal({ isOpen: true, admin })}
            className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
            title="Changer le mot de passe"
          >
            <Key className="w-4 h-4" />
          </button>
          {admin.active ? (
            <button
              onClick={() => {
                if (confirm('Êtes-vous sûr de vouloir désactiver cet administrateur ?')) {
                  toggleActiveMutation.mutate({ id: admin.id, active: false });
                }
              }}
              className="p-1 text-gray-400 hover:text-orange-600 transition-colors"
              title="Désactiver"
            >
              <UserX className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={() => {
                if (confirm('Êtes-vous sûr de vouloir réactiver cet administrateur ?')) {
                  toggleActiveMutation.mutate({ id: admin.id, active: true });
                }
              }}
              className="p-1 text-gray-400 hover:text-green-600 transition-colors"
              title="Réactiver"
            >
              <UserCheck className="w-4 h-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Administrateurs</h1>
            <p className="text-gray-500">
              {admins?.length || 0} administrateur(s) (max 3)
            </p>
          </div>
          <Button onClick={() => setIsCreateModalOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Nouvel admin
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            <DataTable
              data={admins || []}
              columns={columns}
              loading={isLoading}
              emptyMessage="Aucun administrateur"
            />
          </CardContent>
        </Card>

        {/* Modal Création */}
        <Modal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          title="Nouvel administrateur"
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />
            <Input
              label="Téléphone"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
            <Input
              label="Mot de passe"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
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

        {/* Modal Reset Password */}
        <Modal
          isOpen={resetPasswordModal.isOpen}
          onClose={handleCloseResetModal}
          title="Changer le mot de passe"
        >
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">Administrateur</p>
              <p className="font-medium text-gray-900">{resetPasswordModal.admin?.email}</p>
            </div>
            <Input
              label="Votre mot de passe actuel"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              placeholder="Confirmez votre identité"
            />
            <Input
              label="Nouveau mot de passe"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              placeholder="Minimum 8 caractères"
            />
            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="secondary"
                onClick={handleCloseResetModal}
              >
                Annuler
              </Button>
              <Button type="submit" loading={resetPasswordMutation.isPending}>
                Changer
              </Button>
            </div>
          </form>
        </Modal>
      </div>
    </DashboardLayout>
  );
}

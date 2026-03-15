'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout';
import { Card, CardContent, Button, Input, DataTable, Badge, Modal } from '@/components/ui';
import { api } from '@/services/api';
import { Admin } from '@/types';
import { Plus, Trash2, Key } from 'lucide-react';
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

  const { data: admins, isLoading } = useQuery({
    queryKey: ['admins'],
    queryFn: async () => {
      const response = await api.get('/admin/list');
      return response.data as Admin[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await api.post('/admin', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admins'] });
      setIsCreateModalOpen(false);
      resetForm();
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async ({ id, password }: { id: string; password: string }) => {
      const response = await api.put(`/admin/${id}/password`, { password });
      return response.data;
    },
    onSuccess: () => {
      setResetPasswordModal({ isOpen: false, admin: null });
      setNewPassword('');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/admin/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admins'] });
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
      password: newPassword,
    });
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
          <button
            onClick={() => {
              if (confirm('Êtes-vous sûr de vouloir supprimer cet admin ?')) {
                deleteMutation.mutate(admin.id);
              }
            }}
            className="p-1 text-gray-400 hover:text-red-600 transition-colors"
            title="Supprimer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
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
              {admins?.length || 0} administrateur(s)
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
          onClose={() => setResetPasswordModal({ isOpen: false, admin: null })}
          title="Changer le mot de passe"
        >
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">Administrateur</p>
              <p className="font-medium text-gray-900">{resetPasswordModal.admin?.email}</p>
            </div>
            <Input
              label="Nouveau mot de passe"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setResetPasswordModal({ isOpen: false, admin: null })}
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

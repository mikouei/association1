'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout';
import { Card, CardContent, Button, Input, DataTable, Badge, Modal, toast } from '@/components/ui';
import { api } from '@/services/api';
import { Plus, Key, UserX, UserCheck, QrCode, Eye, Shield } from 'lucide-react';
import { formatDate } from '@/lib/utils';

interface StaffUser {
  id: string;
  email: string;
  phone?: string;
  role: 'ADMIN' | 'SCANNER' | 'AUDITEUR';
  active: boolean;
  createdAt: string;
  member?: { id: string };
}

interface RoleQuota {
  label: string;
  current: number;
  max: number;
}

interface Quotas {
  ADMIN: RoleQuota;
  SCANNER: RoleQuota;
  AUDITEUR: RoleQuota;
}

const ROLE_CONFIG = {
  ADMIN: { 
    label: 'Administrateur', 
    description: 'Accès complet à toutes les fonctionnalités',
    color: 'bg-blue-100 text-blue-800',
    icon: Shield
  },
  SCANNER: { 
    label: 'Scanner', 
    description: 'Vérification QR code uniquement',
    color: 'bg-purple-100 text-purple-800',
    icon: QrCode
  },
  AUDITEUR: { 
    label: 'Auditeur', 
    description: 'Consultation des paiements (lecture seule)',
    color: 'bg-green-100 text-green-800',
    icon: Eye
  },
};

export default function AdminsPage() {
  const queryClient = useQueryClient();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [resetPasswordModal, setResetPasswordModal] = useState<{ isOpen: boolean; user: StaffUser | null }>({
    isOpen: false,
    user: null,
  });
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    phone: '',
    role: 'ADMIN' as 'ADMIN' | 'SCANNER' | 'AUDITEUR',
  });
  const [newPassword, setNewPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');

  const { data: staffUsers, isLoading } = useQuery({
    queryKey: ['admin-staff'],
    queryFn: async () => {
      const response = await api.get('/admin/list');
      return response.data as StaffUser[];
    },
  });

  const { data: quotas } = useQuery({
    queryKey: ['admin-quotas'],
    queryFn: async () => {
      const response = await api.get('/admin/quotas');
      return response.data as Quotas;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await api.post('/admin/create', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-staff'] });
      queryClient.invalidateQueries({ queryKey: ['admin-quotas'] });
      setIsCreateModalOpen(false);
      resetForm();
      toast.success('Compte créé avec succès');
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
      setResetPasswordModal({ isOpen: false, user: null });
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
      queryClient.invalidateQueries({ queryKey: ['admin-staff'] });
      toast.success(variables.active ? 'Compte réactivé' : 'Compte désactivé');
    },
    onError: (error: { response?: { data?: { error?: string } } }) => {
      toast.error(error.response?.data?.error || 'Erreur lors de l\'opération');
    },
  });

  const resetForm = () => {
    setFormData({ email: '', password: '', phone: '', role: 'ADMIN' });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  const handleResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPasswordModal.user) return;
    resetPasswordMutation.mutate({
      id: resetPasswordModal.user.id,
      newPassword,
      currentPassword,
    });
  };

  const handleCloseResetModal = () => {
    setResetPasswordModal({ isOpen: false, user: null });
    setNewPassword('');
    setCurrentPassword('');
  };

  const getRoleBadge = (role: string) => {
    const config = ROLE_CONFIG[role as keyof typeof ROLE_CONFIG];
    if (!config) return <Badge>{role}</Badge>;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
        <config.icon className="w-3 h-3" />
        {config.label}
      </span>
    );
  };

  const columns = [
    {
      key: 'email',
      header: 'Email',
      render: (user: StaffUser) => (
        <p className="font-medium text-gray-900">{user.email}</p>
      ),
    },
    {
      key: 'phone',
      header: 'Téléphone',
      render: (user: StaffUser) => (
        <span className="text-gray-600">{user.phone || '-'}</span>
      ),
    },
    {
      key: 'role',
      header: 'Rôle',
      render: (user: StaffUser) => getRoleBadge(user.role),
    },
    {
      key: 'active',
      header: 'Statut',
      render: (user: StaffUser) => (
        <Badge variant={user.active ? 'success' : 'danger'}>
          {user.active ? 'Actif' : 'Inactif'}
        </Badge>
      ),
    },
    {
      key: 'createdAt',
      header: 'Créé le',
      render: (user: StaffUser) => formatDate(user.createdAt),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (user: StaffUser) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => setResetPasswordModal({ isOpen: true, user })}
            className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
            title="Changer le mot de passe"
          >
            <Key className="w-4 h-4" />
          </button>
          {user.active ? (
            <button
              onClick={() => {
                if (confirm('Êtes-vous sûr de vouloir désactiver ce compte ?')) {
                  toggleActiveMutation.mutate({ id: user.id, active: false });
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
                if (confirm('Êtes-vous sûr de vouloir réactiver ce compte ?')) {
                  toggleActiveMutation.mutate({ id: user.id, active: true });
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
            <h1 className="text-2xl font-bold text-gray-900">Gestion des accès</h1>
            <p className="text-gray-500">
              Gérez les comptes administrateurs, scanners et auditeurs
            </p>
          </div>
          <Button onClick={() => setIsCreateModalOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Nouveau compte
          </Button>
        </div>

        {/* Quotas par rôle */}
        {quotas && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(['ADMIN', 'SCANNER', 'AUDITEUR'] as const).map((role) => {
              const config = ROLE_CONFIG[role];
              const quota = quotas[role];
              const percentage = (quota.current / quota.max) * 100;
              return (
                <Card key={role}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${config.color}`}>
                        <config.icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">{config.label}s</p>
                        <p className="text-xs text-gray-500">{config.description}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-gray-900">
                          {quota.current}/{quota.max}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all ${percentage >= 100 ? 'bg-red-500' : percentage >= 80 ? 'bg-yellow-500' : 'bg-green-500'}`}
                        style={{ width: `${Math.min(percentage, 100)}%` }}
                      />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <Card>
          <CardContent className="p-0">
            <DataTable
              data={staffUsers || []}
              columns={columns}
              loading={isLoading}
              emptyMessage="Aucun compte"
            />
          </CardContent>
        </Card>

        {/* Modal Création */}
        <Modal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          title="Nouveau compte"
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Sélecteur de rôle */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Type de compte
              </label>
              <div className="grid grid-cols-1 gap-2">
                {(['ADMIN', 'SCANNER', 'AUDITEUR'] as const).map((role) => {
                  const config = ROLE_CONFIG[role];
                  const quota = quotas?.[role];
                  const isDisabled = quota && quota.current >= quota.max;
                  return (
                    <label
                      key={role}
                      className={`
                        flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-all
                        ${formData.role === role 
                          ? 'border-blue-500 bg-blue-50' 
                          : 'border-gray-200 hover:border-gray-300'
                        }
                        ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}
                      `}
                    >
                      <input
                        type="radio"
                        name="role"
                        value={role}
                        checked={formData.role === role}
                        onChange={(e) => setFormData({ ...formData, role: e.target.value as typeof role })}
                        disabled={isDisabled}
                        className="sr-only"
                      />
                      <div className={`p-2 rounded-lg ${config.color}`}>
                        <config.icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">{config.label}</p>
                        <p className="text-xs text-gray-500">{config.description}</p>
                      </div>
                      {quota && (
                        <span className={`text-xs font-medium ${isDisabled ? 'text-red-600' : 'text-gray-500'}`}>
                          {quota.current}/{quota.max}
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            </div>

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
              <p className="text-sm text-gray-600">Compte</p>
              <p className="font-medium text-gray-900">{resetPasswordModal.user?.email}</p>
              {resetPasswordModal.user && getRoleBadge(resetPasswordModal.user.role)}
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

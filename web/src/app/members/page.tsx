'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout';
import { Card, CardContent, Button, Input, DataTable, Badge, Modal } from '@/components/ui';
import { api } from '@/services/api';
import { Member } from '@/types';
import { Plus, Pencil, Trash2, Search, Key } from 'lucide-react';
import { formatDate } from '@/lib/utils';

export default function MembersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    customFieldValue: '',
    phone: '',
    email: '',
    password: '',
  });

  // Reset password state
  const [resetPasswordMember, setResetPasswordMember] = useState<Member | null>(null);
  const [newPassword, setNewPassword] = useState('');

  const { data: members, isLoading } = useQuery({
    queryKey: ['members', search],
    queryFn: async () => {
      const response = await api.get('/members', {
        params: search ? { search } : {},
      });
      return response.data as Member[];
    },
  });

  const { data: config } = useQuery({
    queryKey: ['config'],
    queryFn: async () => {
      const response = await api.get('/config');
      return response.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await api.post('/members', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] });
      setIsCreateModalOpen(false);
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof formData> }) => {
      const response = await api.put(`/members/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] });
      setEditingMember(null);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/members/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async ({ memberId, password }: { memberId: string; password: string }) => {
      const response = await api.put(`/members/${memberId}/password`, { password });
      return response.data;
    },
    onSuccess: () => {
      setResetPasswordMember(null);
      setNewPassword('');
      alert('Mot de passe réinitialisé avec succès');
    },
    onError: (error: Error & { response?: { data?: { error?: string } } }) => {
      alert(error.response?.data?.error || 'Erreur lors de la réinitialisation');
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      customFieldValue: '',
      phone: '',
      email: '',
      password: '',
    });
  };

  const handleEdit = (member: Member) => {
    setEditingMember(member);
    setFormData({
      name: member.name,
      customFieldValue: member.customFieldValue || '',
      phone: member.phone || '',
      email: member.email || '',
      password: '',
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingMember) {
      updateMutation.mutate({ id: editingMember.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 4) {
      alert('Le mot de passe doit contenir au moins 4 caractères');
      return;
    }
    if (resetPasswordMember) {
      resetPasswordMutation.mutate({ memberId: resetPasswordMember.id, password: newPassword });
    }
  };

  const openResetPasswordModal = () => {
    if (editingMember) {
      setResetPasswordMember(editingMember);
      setEditingMember(null);
      resetForm();
    }
  };

  const columns = [
    {
      key: 'name',
      header: 'Nom',
      render: (member: Member) => (
        <div>
          <p className="font-medium text-gray-900">{member.name}</p>
          <p className="text-sm text-gray-500">{member.customFieldValue}</p>
        </div>
      ),
    },
    {
      key: 'contact',
      header: 'Contact',
      render: (member: Member) => (
        <div className="text-sm">
          {member.phone && <p>{member.phone}</p>}
          {member.email && <p className="text-gray-500">{member.email}</p>}
        </div>
      ),
    },
    {
      key: 'active',
      header: 'Statut',
      render: (member: Member) => (
        <Badge variant={member.active ? 'success' : 'danger'}>
          {member.active ? 'Actif' : 'Inactif'}
        </Badge>
      ),
    },
    {
      key: 'createdAt',
      header: 'Inscrit le',
      render: (member: Member) => formatDate(member.createdAt),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (member: Member) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleEdit(member)}
            className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
            title="Modifier"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              if (confirm('Êtes-vous sûr de vouloir supprimer ce membre ?')) {
                deleteMutation.mutate(member.id);
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
            <h1 className="text-2xl font-bold text-gray-900">Membres</h1>
            <p className="text-gray-500">
              {members?.length || 0} membre(s) enregistré(s)
            </p>
          </div>
          <Button onClick={() => setIsCreateModalOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Nouveau membre
          </Button>
        </div>

        {/* Recherche */}
        <Card>
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher un membre..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </CardContent>
        </Card>

        {/* Tableau */}
        <Card>
          <CardContent className="p-0">
            <DataTable
              data={members || []}
              columns={columns}
              loading={isLoading}
              emptyMessage="Aucun membre trouvé"
            />
          </CardContent>
        </Card>

        {/* Modal Création/Edition */}
        <Modal
          isOpen={isCreateModalOpen || !!editingMember}
          onClose={() => {
            setIsCreateModalOpen(false);
            setEditingMember(null);
            resetForm();
          }}
          title={editingMember ? 'Modifier le membre' : 'Nouveau membre'}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Nom complet"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
            <Input
              label={config?.memberFieldLabel || 'Villa'}
              value={formData.customFieldValue}
              onChange={(e) => setFormData({ ...formData, customFieldValue: e.target.value })}
            />
            <Input
              label="Téléphone"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
            <Input
              label="Email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
            {!editingMember && (
              <Input
                label="Mot de passe"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
              />
            )}
            
            {/* Bouton Réinitialiser le mot de passe (visible uniquement en mode édition) */}
            {editingMember && (
              <button
                type="button"
                onClick={openResetPasswordModal}
                className="flex items-center gap-2 w-full px-4 py-3 text-left bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors"
              >
                <Key className="w-5 h-5 text-amber-600" />
                <span className="text-amber-700 font-medium">Réinitialiser le mot de passe</span>
              </button>
            )}
            
            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setIsCreateModalOpen(false);
                  setEditingMember(null);
                  resetForm();
                }}
              >
                Annuler
              </Button>
              <Button
                type="submit"
                loading={createMutation.isPending || updateMutation.isPending}
              >
                {editingMember ? 'Modifier' : 'Créer'}
              </Button>
            </div>
          </form>
        </Modal>

        {/* Modal Réinitialisation du mot de passe */}
        <Modal
          isOpen={!!resetPasswordMember}
          onClose={() => {
            setResetPasswordMember(null);
            setNewPassword('');
          }}
          title="Réinitialiser le mot de passe"
          size="md"
        >
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <Key className="w-8 h-8 text-amber-600" />
              <div>
                <p className="font-medium text-gray-900">{resetPasswordMember?.name}</p>
                <p className="text-sm text-gray-500">{resetPasswordMember?.phone || resetPasswordMember?.email}</p>
              </div>
            </div>
            
            <Input
              label="Nouveau mot de passe"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Minimum 4 caractères"
              required
            />
            
            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setResetPasswordMember(null);
                  setNewPassword('');
                }}
              >
                Annuler
              </Button>
              <Button
                type="submit"
                loading={resetPasswordMutation.isPending}
                className="bg-amber-600 hover:bg-amber-700"
              >
                Réinitialiser
              </Button>
            </div>
          </form>
        </Modal>
      </div>
    </DashboardLayout>
  );
}

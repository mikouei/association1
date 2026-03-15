'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout';
import { Card, CardContent, Button, Input, DataTable, Badge, Modal } from '@/components/ui';
import { api } from '@/services/api';
import { Member } from '@/types';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';
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

  const columns = [
    {
      key: 'name',
      header: 'Membre',
      render: (member: Member) => (
        <div>
          <p className="font-medium text-gray-900">{member.name}</p>
          <p className="text-sm text-gray-500">{member.phone || member.email || '-'}</p>
        </div>
      ),
    },
    {
      key: 'customFieldValue',
      header: config?.memberFieldLabel || 'Villa',
      render: (member: Member) => (
        <span className="text-gray-600">{member.customFieldValue || '-'}</span>
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
      header: 'Créé le',
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
      </div>
    </DashboardLayout>
  );
}

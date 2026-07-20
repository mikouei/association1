'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/layout';
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Badge, Modal, toast } from '@/components/ui';
import { platformApi } from '@/services/api';
import { ArrowLeft, Plus, Key, Trash2, UserCog, Save, AlertTriangle } from 'lucide-react';

interface Admin {
  id: string;
  email: string;
  phone: string | null;
  active: boolean;
  createdAt: string;
}

interface AssociationDetail {
  id: string;
  name: string;
  code: string;
  type: string;
  active: boolean;
  memberFieldLabel: string;
  enableVehiclePlates: boolean;
  adminEmail: string;
  adminName: string;
  createdAt: string;
  membersCount: number;
  usersCount: number;
}

export default function EditAssociationPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const associationId = params.id as string;

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    type: 'association',
    memberFieldLabel: '',
  });
  const [isDirty, setIsDirty] = useState(false);

  // Admin modals
  const [isAddAdminModalOpen, setIsAddAdminModalOpen] = useState(false);
  const [resetPasswordAdmin, setResetPasswordAdmin] = useState<Admin | null>(null);
  const [deleteAdminConfirm, setDeleteAdminConfirm] = useState<Admin | null>(null);
  
  // Admin form
  const [newAdminData, setNewAdminData] = useState({ email: '', password: '', phone: '' });
  const [newPassword, setNewPassword] = useState('');

  // Fetch association details
  const { data: association, isLoading: loadingAssoc } = useQuery<AssociationDetail>({
    queryKey: ['platform-association', associationId],
    queryFn: async () => {
      const response = await platformApi.get(`/platform/associations/${associationId}`);
      return response.data;
    },
  });

  // Fetch admins
  const { data: admins, isLoading: loadingAdmins } = useQuery<Admin[]>({
    queryKey: ['platform-association-admins', associationId],
    queryFn: async () => {
      const response = await platformApi.get(`/platform/associations/${associationId}/admins`);
      return response.data;
    },
  });

  // Update form when association loads
  useEffect(() => {
    if (association) {
      setFormData({
        name: association.name,
        type: association.type || 'association',
        memberFieldLabel: association.memberFieldLabel || 'Villa',
      });
      setIsDirty(false);
    }
  }, [association]);

  // Update association mutation
  const updateMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await platformApi.put(`/platform/associations/${associationId}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-association', associationId] });
      queryClient.invalidateQueries({ queryKey: ['platform-associations'] });
      setIsDirty(false);
      toast.success('Association mise à jour avec succès');
    },
    onError: (error: Error & { response?: { data?: { error?: string } } }) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la mise à jour');
    },
  });

  // Add admin mutation
  const addAdminMutation = useMutation({
    mutationFn: async (data: typeof newAdminData) => {
      const response = await platformApi.post(`/platform/associations/${associationId}/admins`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-association-admins', associationId] });
      setIsAddAdminModalOpen(false);
      setNewAdminData({ email: '', password: '', phone: '' });
      toast.success('Admin ajouté avec succès');
    },
    onError: (error: Error & { response?: { data?: { error?: string } } }) => {
      toast.error(error.response?.data?.error || "Erreur lors de l'ajout");
    },
  });

  // Reset password mutation
  const resetPasswordMutation = useMutation({
    mutationFn: async ({ adminId, password }: { adminId: string; password: string }) => {
      const response = await platformApi.put(
        `/platform/associations/${associationId}/admins/${adminId}/password`,
        { password }
      );
      return response.data;
    },
    onSuccess: () => {
      setResetPasswordAdmin(null);
      setNewPassword('');
      toast.success('Mot de passe modifié avec succès');
    },
    onError: (error: Error & { response?: { data?: { error?: string } } }) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la modification');
    },
  });

  // Delete admin mutation
  const deleteAdminMutation = useMutation({
    mutationFn: async (adminId: string) => {
      await platformApi.delete(`/platform/associations/${associationId}/admins/${adminId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-association-admins', associationId] });
      setDeleteAdminConfirm(null);
      toast.success('Admin supprimé avec succès');
    },
    onError: (error: Error & { response?: { data?: { error?: string } } }) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la suppression');
    },
  });

  const handleFormChange = (field: string, value: string) => {
    setFormData({ ...formData, [field]: value });
    setIsDirty(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.memberFieldLabel) {
      toast.error('Le nom et le libellé du champ sont requis');
      return;
    }
    updateMutation.mutate(formData);
  };

  const handleAddAdmin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdminData.email || !newAdminData.password) {
      toast.error('Email et mot de passe requis');
      return;
    }
    addAdminMutation.mutate(newAdminData);
  };

  const handleResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 4) {
      toast.error('Le mot de passe doit contenir au moins 4 caractères');
      return;
    }
    if (resetPasswordAdmin) {
      resetPasswordMutation.mutate({ adminId: resetPasswordAdmin.id, password: newPassword });
    }
  };

  const handleDeleteAdmin = () => {
    if (deleteAdminConfirm) {
      deleteAdminMutation.mutate(deleteAdminConfirm.id);
    }
  };

  if (loadingAssoc) {
    return (
      <DashboardLayout requirePlatformAuth>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </DashboardLayout>
    );
  }

  if (!association) {
    return (
      <DashboardLayout requirePlatformAuth>
        <div className="text-center py-12">
          <p className="text-gray-500">Association non trouvée</p>
          <Button onClick={() => router.push('/platform/associations')} className="mt-4">
            Retour à la liste
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout requirePlatformAuth>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/platform/associations')}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">Modifier l&apos;association</h1>
            <p className="text-gray-500">{association.name}</p>
          </div>
          <Badge variant={association.active ? 'success' : 'danger'} className="text-sm">
            {association.active ? 'Active' : 'Inactive'}
          </Badge>
        </div>

        {/* Association Form */}
        <Card>
          <CardHeader>
            <CardTitle>Informations de l&apos;association</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Nom de l'association"
                  value={formData.name}
                  onChange={(e) => handleFormChange('name', e.target.value)}
                  required
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Code (non modifiable)
                  </label>
                  <input
                    type="text"
                    value={association.code}
                    disabled
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select
                    value={formData.type}
                    onChange={(e) => handleFormChange('type', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="association">Association</option>
                    <option value="syndicat">Syndicat</option>
                    <option value="amicale">Amicale</option>
                  </select>
                </div>
                <Input
                  label="Libellé du champ personnalisé"
                  value={formData.memberFieldLabel}
                  onChange={(e) => handleFormChange('memberFieldLabel', e.target.value)}
                  placeholder="Ex: Villa, Fonction, Matricule..."
                  required
                />
              </div>

              <div className="flex justify-end pt-4">
                <Button type="submit" loading={updateMutation.isPending} disabled={!isDirty}>
                  <Save className="w-4 h-4 mr-2" />
                  Enregistrer les modifications
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Admins Section */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <UserCog className="w-5 h-5" />
              Administrateurs ({admins?.length || 0})
            </CardTitle>
            <Button size="sm" onClick={() => setIsAddAdminModalOpen(true)}>
              <Plus className="w-4 h-4 mr-1" />
              Ajouter un admin
            </Button>
          </CardHeader>
          <CardContent>
            {loadingAdmins ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              </div>
            ) : admins && admins.length > 0 ? (
              <div className="space-y-3">
                {admins.map((admin) => (
                  <div
                    key={admin.id}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{admin.email}</p>
                      {admin.phone && (
                        <p className="text-sm text-gray-500">{admin.phone}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant={admin.active ? 'success' : 'danger'} className="text-xs">
                          {admin.active ? 'Actif' : 'Inactif'}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setResetPasswordAdmin(admin)}
                        className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Réinitialiser le mot de passe"
                      >
                        <Key className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          if (admins.length <= 1) {
                            toast.error("Impossible de supprimer le dernier admin de l'association");
                            return;
                          }
                          setDeleteAdminConfirm(admin);
                        }}
                        className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Retirer l'admin"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <UserCog className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p>Aucun administrateur</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Modal: Add Admin */}
        <Modal
          isOpen={isAddAdminModalOpen}
          onClose={() => setIsAddAdminModalOpen(false)}
          title="Ajouter un administrateur"
          size="md"
        >
          <form onSubmit={handleAddAdmin} className="space-y-4">
            <Input
              label="Email"
              type="email"
              value={newAdminData.email}
              onChange={(e) => setNewAdminData({ ...newAdminData, email: e.target.value })}
              placeholder="admin@exemple.com"
              required
            />
            <Input
              label="Mot de passe"
              type="password"
              value={newAdminData.password}
              onChange={(e) => setNewAdminData({ ...newAdminData, password: e.target.value })}
              placeholder="Minimum 4 caractères"
              required
            />
            <Input
              label="Téléphone (optionnel)"
              type="tel"
              value={newAdminData.phone}
              onChange={(e) => setNewAdminData({ ...newAdminData, phone: e.target.value })}
              placeholder="+237 6XX XX XX XX"
            />
            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setIsAddAdminModalOpen(false)}
              >
                Annuler
              </Button>
              <Button type="submit" loading={addAdminMutation.isPending}>
                Ajouter
              </Button>
            </div>
          </form>
        </Modal>

        {/* Modal: Reset Password */}
        <Modal
          isOpen={!!resetPasswordAdmin}
          onClose={() => {
            setResetPasswordAdmin(null);
            setNewPassword('');
          }}
          title="Réinitialiser le mot de passe"
          size="md"
        >
          <form onSubmit={handleResetPassword} className="space-y-4">
            <p className="text-gray-600">
              Définir un nouveau mot de passe pour <strong>{resetPasswordAdmin?.email}</strong>
            </p>
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
                  setResetPasswordAdmin(null);
                  setNewPassword('');
                }}
              >
                Annuler
              </Button>
              <Button type="submit" loading={resetPasswordMutation.isPending}>
                Réinitialiser
              </Button>
            </div>
          </form>
        </Modal>

        {/* Modal: Delete Admin Confirmation */}
        <Modal
          isOpen={!!deleteAdminConfirm}
          onClose={() => setDeleteAdminConfirm(null)}
          title="Retirer l'administrateur"
          size="md"
        >
          <div className="space-y-4">
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-red-800 font-medium">
                  Êtes-vous sûr de vouloir retirer cet administrateur ?
                </p>
                <p className="text-red-700 text-sm mt-1">
                  <strong>{deleteAdminConfirm?.email}</strong> ne pourra plus se connecter à cette association.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setDeleteAdminConfirm(null)}
              >
                Annuler
              </Button>
              <Button
                onClick={handleDeleteAdmin}
                loading={deleteAdminMutation.isPending}
                className="bg-red-600 hover:bg-red-700"
              >
                Retirer
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </DashboardLayout>
  );
}

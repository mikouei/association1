'use client';

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout';
import { Card, CardHeader, CardTitle, CardContent, Input, Button } from '@/components/ui';
import { platformApi } from '@/services/api';

interface SuperAdmin {
  id: string;
  email: string;
  name: string;
  active: boolean;
  createdAt: string;
}

export default function PlatformSettingsPage() {
  // États pour le changement de mot de passe
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // États pour la gestion des Super Admins
  const [superAdmins, setSuperAdmins] = useState<SuperAdmin[]>([]);
  const [superAdminsLoading, setSuperAdminsLoading] = useState(true);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [newAdminName, setNewAdminName] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [adminMessage, setAdminMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Charger la liste des Super Admins
  const loadSuperAdmins = async () => {
    try {
      const response = await platformApi.get('/platform/superadmins');
      setSuperAdmins(response.data);
    } catch (error) {
      console.error('Erreur chargement Super Admins:', error);
    } finally {
      setSuperAdminsLoading(false);
    }
  };

  useEffect(() => {
    loadSuperAdmins();
  }, []);

  // Changement de mot de passe
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMessage(null);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'Tous les champs sont requis' });
      return;
    }

    if (newPassword.length < 4) {
      setPasswordMessage({ type: 'error', text: 'Le nouveau mot de passe doit contenir au moins 4 caractères' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'Les mots de passe ne correspondent pas' });
      return;
    }

    setPasswordLoading(true);

    try {
      await platformApi.put('/platform/me/password', {
        currentPassword,
        newPassword
      });

      setPasswordMessage({ type: 'success', text: 'Mot de passe modifié avec succès' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Erreur lors du changement de mot de passe';
      setPasswordMessage({ type: 'error', text: errorMessage });
    } finally {
      setPasswordLoading(false);
    }
  };

  // Créer un nouveau Super Admin
  const handleCreateSuperAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminMessage(null);

    if (!newAdminEmail || !newAdminPassword) {
      setAdminMessage({ type: 'error', text: 'Email et mot de passe requis' });
      return;
    }

    if (newAdminPassword.length < 4) {
      setAdminMessage({ type: 'error', text: 'Le mot de passe doit contenir au moins 4 caractères' });
      return;
    }

    setCreateLoading(true);

    try {
      await platformApi.post('/platform/superadmins', {
        email: newAdminEmail,
        password: newAdminPassword,
        name: newAdminName || 'Super Admin'
      });

      setAdminMessage({ type: 'success', text: 'Super Admin créé avec succès' });
      setNewAdminEmail('');
      setNewAdminPassword('');
      setNewAdminName('');
      loadSuperAdmins();
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Erreur lors de la création';
      setAdminMessage({ type: 'error', text: errorMessage });
    } finally {
      setCreateLoading(false);
    }
  };

  // Supprimer un Super Admin
  const handleDeleteSuperAdmin = async (id: string, email: string) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer le Super Admin "${email}" ?`)) {
      return;
    }

    try {
      await platformApi.delete(`/platform/superadmins/${id}`);
      setAdminMessage({ type: 'success', text: 'Super Admin supprimé avec succès' });
      loadSuperAdmins();
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Erreur lors de la suppression';
      setAdminMessage({ type: 'error', text: errorMessage });
    }
  };

  return (
    <DashboardLayout requirePlatformAuth>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Paramètres Platform</h1>
          <p className="text-gray-500">Configuration générale de la plateforme</p>
        </div>

        {/* Section Changer mot de passe */}
        <Card>
          <CardHeader>
            <CardTitle>Changer mon mot de passe</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} className="space-y-4">
              {passwordMessage && (
                <div
                  className={`p-3 rounded-lg text-sm ${
                    passwordMessage.type === 'success'
                      ? 'bg-green-50 text-green-700 border border-green-200'
                      : 'bg-red-50 text-red-700 border border-red-200'
                  }`}
                >
                  {passwordMessage.text}
                </div>
              )}
              
              <Input
                label="Mot de passe actuel"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Entrez votre mot de passe actuel"
              />
              <Input
                label="Nouveau mot de passe"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimum 4 caractères"
              />
              <Input
                label="Confirmer le nouveau mot de passe"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirmez le nouveau mot de passe"
              />
              <div className="flex justify-end">
                <Button type="submit" disabled={passwordLoading}>
                  {passwordLoading ? 'Modification...' : 'Changer le mot de passe'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Section Gestion des Super Admins */}
        <Card>
          <CardHeader>
            <CardTitle>Gestion des Super Admins</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {adminMessage && (
              <div
                className={`p-3 rounded-lg text-sm ${
                  adminMessage.type === 'success'
                    ? 'bg-green-50 text-green-700 border border-green-200'
                    : 'bg-red-50 text-red-700 border border-red-200'
                }`}
              >
                {adminMessage.text}
              </div>
            )}

            {/* Liste des Super Admins */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3">Super Admins existants</h3>
              {superAdminsLoading ? (
                <p className="text-gray-500 text-sm">Chargement...</p>
              ) : superAdmins.length === 0 ? (
                <p className="text-gray-500 text-sm">Aucun Super Admin trouvé</p>
              ) : (
                <div className="space-y-2">
                  {superAdmins.map((admin) => (
                    <div
                      key={admin.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div>
                        <p className="font-medium text-gray-900">{admin.name}</p>
                        <p className="text-sm text-gray-500">{admin.email}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-1 text-xs rounded-full ${
                            admin.active
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {admin.active ? 'Actif' : 'Inactif'}
                        </span>
                        {superAdmins.length > 1 && (
                          <button
                            onClick={() => handleDeleteSuperAdmin(admin.id, admin.email)}
                            className="text-red-600 hover:text-red-800 text-sm"
                          >
                            Supprimer
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Formulaire création */}
            <div className="border-t pt-6">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Ajouter un Super Admin</h3>
              <form onSubmit={handleCreateSuperAdmin} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Email"
                    type="email"
                    value={newAdminEmail}
                    onChange={(e) => setNewAdminEmail(e.target.value)}
                    placeholder="email@exemple.com"
                  />
                  <Input
                    label="Nom"
                    type="text"
                    value={newAdminName}
                    onChange={(e) => setNewAdminName(e.target.value)}
                    placeholder="Nom du Super Admin"
                  />
                </div>
                <Input
                  label="Mot de passe"
                  type="password"
                  value={newAdminPassword}
                  onChange={(e) => setNewAdminPassword(e.target.value)}
                  placeholder="Minimum 4 caractères"
                />
                <div className="flex justify-end">
                  <Button type="submit" disabled={createLoading}>
                    {createLoading ? 'Création...' : 'Créer le Super Admin'}
                  </Button>
                </div>
              </form>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

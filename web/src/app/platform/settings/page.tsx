'use client';

import { DashboardLayout } from '@/components/layout';
import { Card, CardHeader, CardTitle, CardContent, Input, Button } from '@/components/ui';

export default function PlatformSettingsPage() {
  return (
    <DashboardLayout requirePlatformAuth>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Paramètres Platform</h1>
          <p className="text-gray-500">Configuration générale de la plateforme</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Profil Super Admin</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input label="Email" type="email" defaultValue="superadmin@platform.local" disabled />
            <Input label="Nom" defaultValue="Super Administrateur" />
            <div className="flex justify-end">
              <Button>Enregistrer</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sécurité</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input label="Mot de passe actuel" type="password" />
            <Input label="Nouveau mot de passe" type="password" />
            <Input label="Confirmer le mot de passe" type="password" />
            <div className="flex justify-end">
              <Button>Changer le mot de passe</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

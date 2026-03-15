'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Button, Input, Card, CardContent } from '@/components/ui';
import { Building2 } from 'lucide-react';
import { api } from '@/services/api';
import { Association } from '@/types';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  
  const [step, setStep] = useState<'association' | 'credentials'>('association');
  const [associations, setAssociations] = useState<Association[]>([]);
  const [selectedAssoc, setSelectedAssoc] = useState<Association | null>(null);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingAssociations, setLoadingAssociations] = useState(false);
  const [error, setError] = useState('');

  const loadAssociations = async () => {
    setLoadingAssociations(true);
    try {
      const response = await api.get('/auth/associations');
      setAssociations(response.data);
    } catch (err) {
      setError('Impossible de charger les associations');
    } finally {
      setLoadingAssociations(false);
    }
  };

  useState(() => {
    loadAssociations();
  });

  const handleSelectAssociation = (assoc: Association) => {
    setSelectedAssoc(assoc);
    setStep('credentials');
    setError('');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssoc) return;

    setLoading(true);
    setError('');

    try {
      await login(identifier, password, selectedAssoc.code);
      router.push('/dashboard');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error.response?.data?.error || 'Identifiants invalides');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-blue-600 rounded-xl flex items-center justify-center mx-auto mb-4">
              <Building2 className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">AssocManager</h1>
            <p className="text-gray-500 mt-1">Connexion Administration</p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg">
              {error}
            </div>
          )}

          {step === 'association' ? (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 mb-4">Sélectionnez votre association :</p>
              {loadingAssociations ? (
                <div className="text-center py-8 text-gray-500">Chargement...</div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {associations.filter(a => a.active).map((assoc) => (
                    <button
                      key={assoc.id}
                      onClick={() => handleSelectAssociation(assoc)}
                      className="w-full p-4 text-left border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors"
                    >
                      <p className="font-medium text-gray-900">{assoc.name}</p>
                      <p className="text-sm text-gray-500">{assoc.code}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              <button
                type="button"
                onClick={() => setStep('association')}
                className="text-sm text-blue-600 hover:text-blue-700 mb-2"
              >
                ← Changer d'association
              </button>
              
              <div className="p-3 bg-gray-50 rounded-lg mb-4">
                <p className="text-sm text-gray-600">Association sélectionnée :</p>
                <p className="font-medium text-gray-900">{selectedAssoc?.name}</p>
              </div>

              <Input
                label="Email ou Téléphone"
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="email@exemple.com"
                required
              />

              <Input
                label="Mot de passe"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />

              <Button type="submit" className="w-full" loading={loading}>
                Se connecter
              </Button>
            </form>
          )}

          <div className="mt-6 text-center">
            <Link
              href="/platform/login"
              className="text-sm text-gray-500 hover:text-blue-600"
            >
              Accès Super Admin →
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

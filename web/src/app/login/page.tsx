'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Button, Input, Card, CardContent } from '@/components/ui';
import { Buildings } from '@phosphor-icons/react';
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

  // Fix: Use useEffect instead of useState for side effects
  useEffect(() => {
    loadAssociations();
  }, []);

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
    <div className="min-h-screen bg-[var(--color-secondary)] flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-[var(--color-primary)] rounded-[var(--radius-card)] flex items-center justify-center mx-auto mb-4">
              <Buildings size={32} weight="duotone" className="text-[var(--color-text-on-primary)]" />
            </div>
            <h1 className="text-2xl font-bold text-[var(--color-text)] font-[var(--font-heading)]">Kotiz</h1>
            <p className="text-[var(--color-text-muted)] mt-1">Connexion Administration</p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-[var(--color-error-bg)] border border-[var(--color-error)] text-[var(--color-error)] text-sm rounded-[var(--radius-input)]">
              {error}
            </div>
          )}

          {step === 'association' ? (
            <div className="space-y-4">
              <p className="text-sm text-[var(--color-text-muted)] mb-4">Sélectionnez votre association :</p>
              {loadingAssociations ? (
                <div className="text-center py-8 text-[var(--color-text-muted)]">Chargement...</div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {associations.filter(a => a.active !== false).map((assoc) => (
                    <button
                      key={assoc.id}
                      onClick={() => handleSelectAssociation(assoc)}
                      className="w-full p-4 text-left border border-[var(--color-border)] rounded-[var(--radius-card)] hover:border-[var(--color-primary)] hover:bg-[var(--color-warning-bg)] transition-colors"
                    >
                      <p className="font-medium text-[var(--color-text)]">{assoc.name}</p>
                      <p className="text-sm text-[var(--color-text-muted)]">{assoc.code}</p>
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
                className="text-sm text-[var(--color-secondary)] hover:text-[var(--color-primary)] mb-2"
              >
                ← Changer d&apos;association
              </button>
              
              <div className="p-3 bg-[var(--color-background)] rounded-[var(--radius-input)] mb-4">
                <p className="text-sm text-[var(--color-text-muted)]">Association sélectionnée :</p>
                <p className="font-medium text-[var(--color-text)]">{selectedAssoc?.name}</p>
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
              className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-primary)]"
            >
              Accès Super Admin →
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Button, Input, Card, CardContent } from '@/components/ui';
import { Buildings, Plus, WhatsappLogo } from '@phosphor-icons/react';
import { api } from '@/services/api';
import { Association } from '@/types';
import GoogleSignInButton from '@/components/GoogleSignInButton';
import { toast } from 'sonner';

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, loginWithToken } = useAuth();
  
  const [step, setStep] = useState<'association' | 'credentials'>('association');
  const [associations, setAssociations] = useState<Association[]>([]);
  const [selectedAssoc, setSelectedAssoc] = useState<Association | null>(null);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [loadingAssociations, setLoadingAssociations] = useState(false);
  const [error, setError] = useState('');
  const [preselectedCode, setPreselectedCode] = useState<string | null>(null);

  const loadAssociations = async () => {
    setLoadingAssociations(true);
    try {
      const response = await api.get('/auth/associations');
      setAssociations(response.data);
      return response.data as Association[];
    } catch {
      setError('Impossible de charger les associations');
      return [];
    } finally {
      setLoadingAssociations(false);
    }
  };

  // Charger les associations et vérifier le paramètre ?code=
  useEffect(() => {
    const initLogin = async () => {
      const assocs = await loadAssociations();
      
      // Vérifier si un code est passé en paramètre
      const codeParam = searchParams.get('code');
      if (codeParam && assocs.length > 0) {
        const matchingAssoc = assocs.find(
          a => a.code.toUpperCase() === codeParam.toUpperCase() && a.active !== false
        );
        if (matchingAssoc) {
          setSelectedAssoc(matchingAssoc);
          setPreselectedCode(codeParam.toUpperCase());
          setStep('credentials');
        }
      }
    };
    initLogin();
  }, [searchParams]);

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

  // Connexion via Google
  const handleGoogleCredential = async (idToken: string) => {
    if (!selectedAssoc) return;

    setGoogleLoading(true);
    setError('');

    try {
      const response = await api.post('/auth/google', {
        idToken,
        associationCode: selectedAssoc.code
      });

      const { token, user, association } = response.data;
      loginWithToken(token, user, association);
      toast.success('Connexion réussie');
      router.push('/dashboard');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string; code?: string } } };
      
      if (error.response?.data?.code === 'NO_ACCOUNT') {
        setError('Aucun compte Google trouvé pour cette association. Voulez-vous créer votre association ?');
      } else {
        setError(error.response?.data?.error || 'Erreur de connexion Google');
      }
    } finally {
      setGoogleLoading(false);
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
              {error.includes('créer votre association') && (
                <Link href="/creer-association" className="block mt-2 text-[var(--color-primary)] underline">
                  → Créer mon association
                </Link>
              )}
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
            <div className="space-y-4">
              {!preselectedCode && (
                <button
                  type="button"
                  onClick={() => setStep('association')}
                  className="text-sm text-[var(--color-secondary)] hover:text-[var(--color-primary)] mb-2"
                >
                  ← Changer d&apos;association
                </button>
              )}
              {preselectedCode && (
                <button
                  type="button"
                  onClick={() => {
                    setPreselectedCode(null);
                    setSelectedAssoc(null);
                    setStep('association');
                  }}
                  className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-primary)] mb-2"
                >
                  Pas votre association ? Changer
                </button>
              )}
              
              <div className="p-3 bg-[var(--color-background)] rounded-[var(--radius-input)] mb-4">
                <p className="text-sm text-[var(--color-text-muted)]">Association sélectionnée :</p>
                <p className="font-medium text-[var(--color-text)]">{selectedAssoc?.name}</p>
              </div>

              {/* Bouton Google Sign-In */}
              <div className="flex justify-center">
                <GoogleSignInButton 
                  onCredential={handleGoogleCredential}
                  onError={(err) => setError(err)}
                  text="continue_with"
                  disabled={googleLoading}
                  width={280}
                />
              </div>

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[var(--color-border)]" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-[var(--color-text-muted)]">ou</span>
                </div>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
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
            </div>
          )}

          <div className="mt-6 text-center space-y-3">
            <Link
              href="/creer-association"
              className="inline-flex items-center gap-2 text-sm text-[var(--color-primary)] hover:text-[var(--color-secondary)] font-medium"
            >
              <Plus size={16} weight="bold" />
              Créer mon association
            </Link>
            <div className="border-t pt-3">
              <Link
                href="/platform/login"
                className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-primary)]"
              >
                Accès Super Admin →
              </Link>
            </div>
            <a
              href="https://wa.me/2250104833352"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-green-600 hover:text-green-700"
            >
              <WhatsappLogo size={18} weight="fill" />
              Besoin d&apos;aide ?
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageContent />
    </Suspense>
  );
}

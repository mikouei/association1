'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Buildings, AndroidLogo, WhatsappLogo, Warning, UserPlus, Eye, EyeSlash } from '@phosphor-icons/react';
import { useAuth } from '@/contexts/AuthContext';
import GoogleSignInButton from '@/components/GoogleSignInButton';
import { toast } from 'sonner';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://web-bx1a.onrender.com';

interface AssociationInfo {
  name: string;
  type: string;
  code: string;
}

export default function JoinPage() {
  const params = useParams();
  const router = useRouter();
  const { loginWithToken } = useAuth();
  const code = (params.code as string)?.toUpperCase();
  
  const [association, setAssociation] = useState<AssociationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [showLoginHighlight, setShowLoginHighlight] = useState(false);

  // Inscription manuelle (demande en attente de validation)
  const [showForm, setShowForm] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formConfirm, setFormConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleJoinRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const name = formName.trim();
    const phone = formPhone.trim();
    if (!name) { setFormError('Veuillez renseigner votre nom'); return; }
    if (!phone) { setFormError('Veuillez renseigner votre numéro de téléphone'); return; }
    if (formPassword.length < 8) { setFormError('Le mot de passe doit contenir au moins 8 caractères'); return; }
    if (formPassword !== formConfirm) { setFormError('Les mots de passe ne correspondent pas'); return; }

    setSubmitting(true);
    try {
      const response = await fetch(`${API_URL}/api/public/associations/${code}/join-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, password: formPassword }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Erreur lors de l'envoi de la demande");
      }
      setSubmitted(true);
    } catch (err: unknown) {
      const error = err as Error;
      setFormError(error.message || "Erreur lors de l'envoi de la demande");
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    const fetchAssociationInfo = async () => {
      if (!code) {
        setError(true);
        setLoading(false);
        return;
      }
      
      try {
        const response = await fetch(`${API_URL}/api/public/associations/${code}/info`);
        if (!response.ok) {
          setError(true);
        } else {
          const data = await response.json();
          setAssociation(data);
        }
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchAssociationInfo();
  }, [code]);

  // Lien Play Store avec referrer pour détecter l'installation
  const playStoreUrl = `https://play.google.com/store/apps/details?id=com.kotiz.ci&referrer=assoc_code%3D${encodeURIComponent(code || '')}`;

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-secondary)] flex items-center justify-center p-4">
        <div className="text-center text-white">
          <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p>Chargement...</p>
        </div>
      </div>
    );
  }

  if (error || !association) {
    return (
      <div className="min-h-screen bg-[var(--color-secondary)] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Warning size={32} weight="duotone" className="text-red-600" />
          </div>
          <h2 className="text-xl font-bold text-[var(--color-text)] mb-2">
            Lien invalide ou expiré
          </h2>
          <p className="text-[var(--color-text-muted)] mb-6">
            Ce lien d&apos;invitation ne correspond à aucune association active.
          </p>
          <Link
            href="/login"
            className="inline-block w-full py-3 bg-[var(--color-primary)] text-[var(--color-text-on-primary)] font-medium rounded-[var(--radius-button)] hover:opacity-90 transition-opacity text-center"
          >
            Aller à la connexion
          </Link>
          <div className="mt-4">
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
        </div>
      </div>
    );
  }

  // Rejoindre via Google
  const handleGoogleCredential = async (idToken: string) => {
    setJoinError(null);
    setGoogleLoading(true);
    setShowLoginHighlight(false);

    try {
      const response = await fetch(`${API_URL}/api/public/associations/${code}/join-google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken })
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.code === 'ALREADY_MEMBER') {
          setJoinError(`Vous avez déjà un compte pour ${association.name}.`);
          setShowLoginHighlight(true);
          return;
        }
        throw new Error(data.error || 'Erreur lors de l\'inscription');
      }

      // Connecter l'utilisateur
      loginWithToken(data.token, data.user, data.association);
      toast.success(`Bienvenue dans ${association.name} !`);
      router.push('/dashboard');
    } catch (err: unknown) {
      const error = err as Error;
      setJoinError(error.message || 'Erreur lors de l\'inscription');
    } finally {
      setGoogleLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-[var(--color-secondary)] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center" data-testid="join-request-success">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Buildings size={32} weight="duotone" className="text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-[var(--color-text)] mb-2">
            Votre demande a été envoyée
          </h2>
          <p className="text-[var(--color-text-muted)] mb-6">
            Votre demande d&apos;inscription à {association.name} est en attente de validation
            par un administrateur. Vous pourrez vous connecter une fois votre compte approuvé.
          </p>
          <Link
            href={`/login?code=${code}`}
            className="inline-block w-full py-3 bg-[var(--color-primary)] text-[var(--color-text-on-primary)] font-medium rounded-[var(--radius-button)] hover:opacity-90 transition-opacity text-center"
          >
            Aller à la connexion
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-secondary)] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
        <div className="w-20 h-20 bg-[var(--color-primary)] rounded-[var(--radius-card)] flex items-center justify-center mx-auto mb-6">
          <Buildings size={40} weight="duotone" className="text-[var(--color-text-on-primary)]" />
        </div>
        
        <h1 className="text-2xl font-bold text-[var(--color-text)] mb-2">
          {association.name}
        </h1>
        <p className="text-[var(--color-text-muted)] mb-6">
          {association.type === 'syndicat' ? 'Syndicat / Copropriété' : 
           association.type === 'amicale' ? 'Amicale' : 'Association'}
        </p>
        
        <div className="bg-[var(--color-warning-bg)] border border-[var(--color-primary)] rounded-xl p-4 mb-6">
          <p className="text-sm text-[var(--color-text-muted)] mb-1">Code d&apos;accès</p>
          <p className="text-2xl font-bold font-mono text-[var(--color-primary)]">
            {association.code}
          </p>
        </div>

        {joinError && (
          <div className="mb-4 p-3 bg-[var(--color-error-bg)] border border-[var(--color-error)] text-[var(--color-error)] text-sm rounded-lg">
            {joinError}
          </div>
        )}

        <div className="space-y-3">
          {/* Bouton Google pour créer un compte membre */}
          <div className="mb-4">
            <p className="text-sm text-[var(--color-text-muted)] mb-3">
              Nouveau ? Rejoignez {association.name} en un clic
            </p>
            <div className="flex justify-center">
              <GoogleSignInButton 
                onCredential={handleGoogleCredential}
                onError={(err) => setJoinError(err)}
                text="signup_with"
                disabled={googleLoading}
                width={280}
              />
            </div>
          </div>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[var(--color-border)]" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-[var(--color-text-muted)]">ou</span>
            </div>
          </div>

          <Link
            href={`/login?code=${code}`}
            className={`block w-full py-3 font-medium rounded-[var(--radius-button)] transition-all ${
              showLoginHighlight 
                ? 'bg-[var(--color-primary)] text-[var(--color-text-on-primary)] ring-2 ring-offset-2 ring-[var(--color-primary)]' 
                : 'bg-gray-100 text-[var(--color-text)] hover:bg-gray-200'
            }`}
          >
            {showLoginHighlight ? '→ ' : ''}Se connecter à {association.name}
          </Link>

          {/* Inscription manuelle (demande en attente de validation) */}
          {!showForm ? (
            <button
              type="button"
              onClick={() => { setShowForm(true); setFormError(null); }}
              data-testid="join-manual-request-button"
              className="flex items-center justify-center gap-2 w-full py-3 border border-[var(--color-primary)] text-[var(--color-primary)] font-medium rounded-[var(--radius-button)] hover:bg-[var(--color-warning-bg)] transition-colors"
            >
              <UserPlus size={20} weight="bold" />
              Demander à rejoindre manuellement
            </button>
          ) : (
            <form onSubmit={handleJoinRequest} className="text-left space-y-3" data-testid="join-request-form">
              <div>
                <p className="text-sm font-semibold text-[var(--color-text)] mb-1">Demande d&apos;inscription</p>
                <p className="text-xs text-[var(--color-text-muted)]">
                  Votre compte sera activé après validation par un administrateur.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--color-text)] mb-1">Nom complet</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ex: Jean Kouassi"
                  data-testid="join-input-name"
                  className="w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text)] focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--color-text)] mb-1">Téléphone</label>
                <input
                  type="tel"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  placeholder="Ex: +225 07 00 00 00 00"
                  data-testid="join-input-phone"
                  className="w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text)] focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--color-text)] mb-1">Mot de passe</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    placeholder="Au moins 8 caractères"
                    data-testid="join-input-password"
                    className="w-full rounded-lg border border-[var(--color-border)] px-3 py-2 pr-10 text-sm text-[var(--color-text)] focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    data-testid="join-toggle-password"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
                  >
                    {showPassword ? <EyeSlash size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--color-text)] mb-1">Confirmer le mot de passe</label>
                <div className="relative">
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={formConfirm}
                    onChange={(e) => setFormConfirm(e.target.value)}
                    placeholder="Retapez le mot de passe"
                    data-testid="join-input-confirm-password"
                    className="w-full rounded-lg border border-[var(--color-border)] px-3 py-2 pr-10 text-sm text-[var(--color-text)] focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    data-testid="join-toggle-confirm-password"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
                  >
                    {showConfirm ? <EyeSlash size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              {formError && (
                <p className="text-sm text-[var(--color-error)]" data-testid="join-form-error">{formError}</p>
              )}

              <button
                type="submit"
                disabled={submitting}
                data-testid="join-submit-button"
                className="w-full py-3 bg-[var(--color-primary)] text-[var(--color-text-on-primary)] font-semibold rounded-[var(--radius-button)] hover:opacity-90 transition-opacity disabled:opacity-60"
              >
                {submitting ? 'Envoi...' : 'Envoyer ma demande'}
              </button>

              <button
                type="button"
                onClick={() => { setShowForm(false); setFormError(null); }}
                data-testid="join-form-cancel"
                className="w-full py-2 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              >
                Annuler
              </button>
            </form>
          )}
          
          <a
            href={playStoreUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-3 bg-[#1F2937] text-white font-medium rounded-[var(--radius-button)] hover:bg-[#374151] transition-colors"
          >
            <AndroidLogo size={20} weight="fill" />
            Télécharger l&apos;app Android
          </a>
        </div>

        <p className="text-xs text-[var(--color-text-muted)] mt-6">
          Créez votre compte avec Google pour rejoindre l&apos;association, ou connectez-vous si vous avez déjà un compte.
        </p>

        <div className="mt-6 pt-4 border-t">
          <a
            href="https://wa.me/2250104833352"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-green-600 hover:text-green-700"
          >
            <WhatsappLogo size={18} weight="fill" />
            Besoin d&apos;aide ? Contactez-nous sur WhatsApp
          </a>
        </div>
      </div>
    </div>
  );
}

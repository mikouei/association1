'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Buildings, Check, X, CircleNotch, WhatsappLogo } from '@phosphor-icons/react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://mobile-bug-crush-1.preview.emergentagent.com';

type CodeStatus = 'idle' | 'checking' | 'available' | 'taken' | 'format';

export default function CreerAssociationPage() {
  const router = useRouter();
  const { loginWithToken } = useAuth();
  
  const [name, setName] = useState('');
  const [type, setType] = useState('association');
  const [code, setCode] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPhone, setAdminPhone] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [codeStatus, setCodeStatus] = useState<CodeStatus>('idle');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<{ code: string; name: string } | null>(null);

  // Debounced code check
  const checkCodeAvailability = useCallback(async (codeToCheck: string) => {
    if (!codeToCheck || codeToCheck.length < 3) {
      setCodeStatus('idle');
      return;
    }
    
    setCodeStatus('checking');
    
    try {
      const response = await fetch(`${API_URL}/api/public/associations/check-code/${codeToCheck.toUpperCase()}`);
      const data = await response.json();
      
      if (data.available) {
        setCodeStatus('available');
      } else if (data.reason === 'format') {
        setCodeStatus('format');
      } else {
        setCodeStatus('taken');
      }
    } catch {
      setCodeStatus('idle');
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (code) {
        checkCodeAvailability(code);
      }
    }, 500);
    
    return () => clearTimeout(timer);
  }, [code, checkCodeAvailability]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (adminPassword !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }
    
    if (adminPassword.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }
    
    if (!adminEmail && !adminPhone) {
      setError('Email ou téléphone requis');
      return;
    }
    
    if (codeStatus !== 'available') {
      setError('Veuillez choisir un code valide et disponible');
      return;
    }
    
    setLoading(true);
    
    try {
      const response = await fetch(`${API_URL}/api/public/associations/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          type,
          code: code.toUpperCase(),
          adminName,
          adminEmail: adminEmail || undefined,
          adminPhone: adminPhone || undefined,
          adminPassword
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors de la création');
      }
      
      // Afficher le succès avec le code
      setSuccess({ code: data.code, name: data.association.name });
      
      // Stocker le token et connecter l'utilisateur
      if (data.token) {
        loginWithToken(data.token, {
          id: data.admin.id,
          email: data.admin.email,
          phone: data.admin.phone,
          role: 'ADMIN',   
      }, data.association);
        
        // Redirection après 5 secondes
        setTimeout(() => {
          router.push('/dashboard');
        }, 5000);
      }
    } catch (err: unknown) {
      const error = err as Error;
      setError(error.message || 'Erreur lors de la création');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-[var(--color-secondary)] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check size={32} weight="bold" className="text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-[var(--color-text)] mb-4">
            Association créée avec succès !
          </h2>
          <div className="bg-[var(--color-warning-bg)] border-2 border-[var(--color-primary)] rounded-xl p-6 mb-6">
            <p className="text-sm text-[var(--color-text-muted)] mb-2">Votre code association :</p>
            <p className="text-3xl font-bold text-[var(--color-primary)] font-mono">
              {success.code}
            </p>
            <p className="text-sm text-[var(--color-text-muted)] mt-3">
              Notez-le bien ! C&apos;est ce qui permet à vous et vos futurs membres de vous connecter.
            </p>
          </div>
          <p className="text-[var(--color-text-muted)] mb-4">
            Redirection automatique vers votre tableau de bord...
          </p>
          <button
            onClick={() => router.push('/dashboard')}
            className="w-full py-3 bg-[var(--color-primary)] text-[var(--color-text-on-primary)] font-medium rounded-[var(--radius-button)] hover:opacity-90 transition-opacity"
          >
            Continuer maintenant
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-secondary)] flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white rounded-xl shadow-lg p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-[var(--color-primary)] rounded-[var(--radius-card)] flex items-center justify-center mx-auto mb-4">
            <Buildings size={32} weight="duotone" className="text-[var(--color-text-on-primary)]" />
          </div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">Créer mon association</h1>
          <p className="text-[var(--color-text-muted)] mt-1">Commencez à gérer vos cotisations en quelques minutes</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-[var(--color-error-bg)] border border-[var(--color-error)] text-[var(--color-error)] text-sm rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--color-text)] mb-1">
              Nom de l&apos;association *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              placeholder="Ex: Amicale des Cadres de Bouaké"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--color-text)] mb-1">
              Type d&apos;organisation
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] bg-white"
            >
              <option value="association">Association</option>
              <option value="amicale">Amicale</option>
              <option value="syndicat">Syndicat / Copropriété</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--color-text)] mb-1">
              Code souhaité * <span className="text-xs text-[var(--color-text-muted)]">(3-20 caractères, lettres/chiffres/tirets)</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className={`w-full px-4 py-3 pr-10 border rounded-lg focus:outline-none focus:ring-2 ${
                  codeStatus === 'available' 
                    ? 'border-green-500 focus:ring-green-500' 
                    : codeStatus === 'taken' || codeStatus === 'format'
                    ? 'border-red-500 focus:ring-red-500'
                    : 'border-[var(--color-border)] focus:ring-[var(--color-primary)]'
                }`}
                placeholder="Ex: ASCB ou MON-ASSO"
                required
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {codeStatus === 'checking' && <CircleNotch size={20} className="animate-spin text-gray-400" />}
                {codeStatus === 'available' && <Check size={20} className="text-green-500" />}
                {(codeStatus === 'taken' || codeStatus === 'format') && <X size={20} className="text-red-500" />}
              </div>
            </div>
            {codeStatus === 'taken' && (
              <p className="text-xs text-red-500 mt-1">Ce code est déjà utilisé</p>
            )}
            {codeStatus === 'format' && (
              <p className="text-xs text-red-500 mt-1">Format invalide (3-20 caractères, lettres majuscules, chiffres, tirets)</p>
            )}
            {codeStatus === 'available' && (
              <p className="text-xs text-green-500 mt-1">Code disponible !</p>
            )}
          </div>

          <hr className="my-6" />
          <p className="text-sm font-medium text-[var(--color-text)] -mt-2 mb-4">Votre compte administrateur</p>

          <div>
            <label className="block text-sm font-medium text-[var(--color-text)] mb-1">
              Votre nom complet *
            </label>
            <input
              type="text"
              value={adminName}
              onChange={(e) => setAdminName(e.target.value)}
              className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              placeholder="Ex: Kouadio Jean-Marc"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--color-text)] mb-1">
                Email
              </label>
              <input
                type="email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                placeholder="email@exemple.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text)] mb-1">
                Téléphone
              </label>
              <input
                type="tel"
                value={adminPhone}
                onChange={(e) => setAdminPhone(e.target.value)}
                className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                placeholder="07 00 00 00 00"
              />
            </div>
          </div>
          <p className="text-xs text-[var(--color-text-muted)] -mt-2">Email ou téléphone requis</p>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--color-text)] mb-1">
                Mot de passe *
              </label>
              <input
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                placeholder="Min. 6 caractères"
                required
                minLength={6}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text)] mb-1">
                Confirmation *
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 ${
                  confirmPassword && adminPassword !== confirmPassword
                    ? 'border-red-500 focus:ring-red-500'
                    : 'border-[var(--color-border)] focus:ring-[var(--color-primary)]'
                }`}
                placeholder="Confirmez"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || codeStatus !== 'available'}
            className="w-full py-3 bg-[var(--color-primary)] text-[var(--color-text-on-primary)] font-medium rounded-[var(--radius-button)] hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed mt-6"
          >
            {loading ? 'Création en cours...' : 'Créer mon association'}
          </button>
        </form>

        <div className="mt-6 text-center space-y-3">
          <Link
            href="/login"
            className="block text-sm text-[var(--color-text-muted)] hover:text-[var(--color-primary)]"
          >
            Déjà une association ? Se connecter
          </Link>
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

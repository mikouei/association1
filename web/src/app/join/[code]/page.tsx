'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Buildings, AndroidLogo, WhatsappLogo, Warning } from '@phosphor-icons/react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://mobile-bug-crush-1.preview.emergentagent.com';
const APP_DOMAIN = process.env.NEXT_PUBLIC_APP_DOMAIN || 'https://mobile-bug-crush-1.preview.emergentagent.com';

interface AssociationInfo {
  name: string;
  type: string;
  code: string;
}

export default function JoinPage() {
  const params = useParams();
  const code = (params.code as string)?.toUpperCase();
  
  const [association, setAssociation] = useState<AssociationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

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

        <div className="space-y-3">
          <Link
            href={`/login?code=${code}`}
            className="block w-full py-3 bg-[var(--color-primary)] text-[var(--color-text-on-primary)] font-medium rounded-[var(--radius-button)] hover:opacity-90 transition-opacity"
          >
            Se connecter à {association.name}
          </Link>
          
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
          Utilisez ce lien pour rejoindre l&apos;association. Vous devrez ensuite vous connecter avec vos identifiants.
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

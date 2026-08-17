'use client';

import { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
          }) => void;
          renderButton: (
            element: HTMLElement,
            config: {
              theme?: 'outline' | 'filled_blue' | 'filled_black';
              size?: 'large' | 'medium' | 'small';
              text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
              shape?: 'rectangular' | 'pill' | 'circle' | 'square';
              logo_alignment?: 'left' | 'center';
              width?: number;
              locale?: string;
            }
          ) => void;
          prompt: () => void;
        };
      };
    };
  }
}

interface GoogleSignInButtonProps {
  onCredential: (idToken: string) => void;
  onError?: (error: string) => void;
  text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
  disabled?: boolean;
  width?: number;
}

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

export default function GoogleSignInButton({ 
  onCredential, 
  onError,
  text = 'continue_with',
  disabled = false,
  width = 300
}: GoogleSignInButtonProps) {
  const buttonRef = useRef<HTMLDivElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Vérifier si le script Google est déjà chargé
    const checkGoogleLoaded = () => {
      if (window.google?.accounts?.id) {
        setIsLoaded(true);
        return true;
      }
      return false;
    };

    if (checkGoogleLoaded()) return;

    // Attendre le chargement du script
    const interval = setInterval(() => {
      if (checkGoogleLoaded()) {
        clearInterval(interval);
      }
    }, 100);

    // Timeout après 10 secondes
    const timeout = setTimeout(() => {
      clearInterval(interval);
      if (!isLoaded) {
        onError?.('Le script Google n\'a pas pu être chargé');
      }
    }, 10000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [isLoaded, onError]);

  useEffect(() => {
    if (!isLoaded || isInitialized || !buttonRef.current || !GOOGLE_CLIENT_ID || disabled) return;

    // Utiliser un ref pour tracker l'état d'initialisation sans trigger de re-render
    const initializeGoogleButton = () => {
      try {
        window.google?.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: (response) => {
            if (response.credential) {
              onCredential(response.credential);
            }
          },
          auto_select: false,
          cancel_on_tap_outside: true,
        });

        window.google?.accounts.id.renderButton(buttonRef.current!, {
          theme: 'outline',
          size: 'large',
          text,
          shape: 'rectangular',
          logo_alignment: 'left',
          width,
          locale: 'fr',
        });

        return true;
      } catch (error) {
        console.error('Erreur initialisation Google Sign-In:', error);
        onError?.('Erreur lors de l\'initialisation de Google Sign-In');
        return false;
      }
    };

    const success = initializeGoogleButton();
    if (success) {
      // Utiliser setTimeout pour éviter setState synchrone dans l'effet
      setTimeout(() => setIsInitialized(true), 0);
    }
  }, [isLoaded, isInitialized, onCredential, onError, text, width, disabled]);

  // Si pas de client ID configuré
  if (!GOOGLE_CLIENT_ID) {
    return null;
  }

  // Afficher un placeholder pendant le chargement
  if (!isLoaded || disabled) {
    return (
      <div 
        className="h-10 bg-gray-100 rounded-md animate-pulse flex items-center justify-center"
        style={{ width }}
      >
        {disabled ? (
          <span className="text-sm text-gray-400">Connexion Google désactivée</span>
        ) : (
          <span className="text-sm text-gray-400">Chargement...</span>
        )}
      </div>
    );
  }

  return (
    <div 
      ref={buttonRef} 
      data-testid="google-signin-button"
      className="flex justify-center"
    />
  );
}

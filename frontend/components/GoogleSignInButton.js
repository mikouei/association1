import React, { useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Platform } from 'react-native';
import { GoogleSignin, GoogleSigninButton, statusCodes } from '@react-native-google-signin/google-signin';
import { colors, spacing, borderRadius, typography } from '../utils/theme';

/**
 * Composant bouton Google Sign-In pour React Native
 * Utilise le bouton officiel Google lorsque disponible
 * 
 * @param {function} onCredential - Callback avec l'idToken Google
 * @param {function} onError - Callback en cas d'erreur
 * @param {boolean} disabled - Désactiver le bouton
 */
export default function GoogleSignInButtonComponent({ 
  onCredential, 
  onError,
  disabled = false 
}) {
  const [loading, setLoading] = useState(false);

  // Vérifier si Google Sign-In est configuré
  //const isConfigured = !!process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  const isConfigured = false; // Google temporairement désactivé - à réactiver plus tard

  const handleGoogleSignIn = async () => {
    if (!isConfigured) {
      onError?.('Google Sign-In non configuré');
      return;
    }

    setLoading(true);

    try {
      // Vérifier que Google Play Services est disponible
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

      // Déconnexion préalable pour forcer la sélection de compte
      try {
        await GoogleSignin.signOut();
      } catch (e) {
        // Ignorer si pas connecté
      }

      // Connexion Google
      const response = await GoogleSignin.signIn();
      
      // Récupérer l'idToken
      const idToken = response.data?.idToken;
      
      if (idToken) {
        onCredential(idToken);
      } else {
        onError?.('Impossible de récupérer le token Google');
      }
    } catch (error) {
      // Gérer les erreurs spécifiques
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        // Utilisateur a annulé, ne rien faire
        console.log('[GoogleSignIn] Utilisateur a annulé');
      } else if (error.code === statusCodes.IN_PROGRESS) {
        // Déjà en cours
        console.log('[GoogleSignIn] Connexion déjà en cours');
      } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        onError?.('Google Play Services non disponible');
      } else {
        console.error('[GoogleSignIn] Erreur:', error);
        onError?.(error.message || 'Erreur de connexion Google');
      }
    } finally {
      setLoading(false);
    }
  };

  // Si non configuré, ne pas afficher
  if (!isConfigured) {
    return null;
  }

  // Utiliser un bouton personnalisé compatible avec Expo Go
  // Le GoogleSigninButton natif ne fonctionne qu'avec un build natif
  return (
    <TouchableOpacity
      style={[
        styles.button,
        disabled && styles.buttonDisabled,
        loading && styles.buttonLoading
      ]}
      onPress={handleGoogleSignIn}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator color={colors.text} size="small" />
      ) : (
        <>
          {/* Logo Google SVG simplifié */}
          <View style={styles.googleIconContainer}>
            <Text style={styles.googleIcon}>G</Text>
          </View>
          <Text style={styles.buttonText}>Continuer avec Google</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dadce0',
    borderRadius: borderRadius.button,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    minHeight: 48,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonLoading: {
    opacity: 0.8,
  },
  googleIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#4285F4',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  googleIcon: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  buttonText: {
    fontSize: typography.body.fontSize,
    fontWeight: '500',
    color: '#3c4043',
  },
});

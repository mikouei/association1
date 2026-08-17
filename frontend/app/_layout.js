import { useEffect } from 'react';
import { Platform } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { AuthProvider } from '../context/AuthContext';
import { OfflineProvider } from '../context/OfflineContext';
import ErrorBoundary from '../components/ErrorBoundary';

const REFERRER_PROCESSED_KEY = '@kotiz_referrer_processed';
const PRESELECTED_ASSOC_KEY = '@kotiz_preselected_association';

// Configuration Google Sign-In au démarrage
// Le webClientId est le même que celui utilisé côté backend et web
const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

if (GOOGLE_WEB_CLIENT_ID) {
  GoogleSignin.configure({
    webClientId: GOOGLE_WEB_CLIENT_ID,
  });
} else {
  console.warn('[Kotiz] EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID non défini - Google Sign-In désactivé');
}

function RootLayoutNav() {
  const router = useRouter();
  const segments = useSegments();

  // Détection du referrer après installation fraîche (Android uniquement)
  useEffect(() => {
    const checkInstallReferrer = async () => {
      // Uniquement sur Android
      if (Platform.OS !== 'android') return;

      try {
        // Vérifier si on a déjà traité le referrer
        const processed = await AsyncStorage.getItem(REFERRER_PROCESSED_KEY);
        if (processed) return;

        // Marquer comme traité pour ne pas refaire
        await AsyncStorage.setItem(REFERRER_PROCESSED_KEY, 'true');

        // Récupérer le referrer
        const referrer = await Application.getInstallReferrerAsync();
        
        if (referrer && referrer.includes('assoc_code=')) {
          // Extraire le code d'association
          const match = referrer.match(/assoc_code=([A-Z0-9-]+)/i);
          if (match && match[1]) {
            const code = match[1].toUpperCase();
            console.log('[Kotiz] Install referrer detected:', code);
            
            // Stocker le code pour le pré-sélectionner au login
            await AsyncStorage.setItem(PRESELECTED_ASSOC_KEY, code);
          }
        }
      } catch (error) {
        console.log('[Kotiz] Referrer check error (non-bloquant):', error);
      }
    };

    checkInstallReferrer();
  }, []);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="login" />
      <Stack.Screen name="register-association" />
      <Stack.Screen name="join/[code]" />
      <Stack.Screen name="activity-log" />
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}

export default function RootLayout() {
  useEffect(() => {
    // Initialize Sentry for native builds only (not web preview)
    // The @sentry/react-native package is installed and ready for native builds
    // Configure DSN in EAS secrets: EXPO_PUBLIC_SENTRY_DSN
    
    if (__DEV__) {
      console.log('[Kotiz] App initialized');
    }
  }, []);

  return (
    <ErrorBoundary>
      <OfflineProvider>
        <AuthProvider>
          <RootLayoutNav />
        </AuthProvider>
      </OfflineProvider>
    </ErrorBoundary>
  );
}

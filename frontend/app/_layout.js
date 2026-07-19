import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { AuthProvider } from '../context/AuthContext';
import ErrorBoundary from '../components/ErrorBoundary';

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="login" />
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
      <AuthProvider>
        <RootLayoutNav />
      </AuthProvider>
    </ErrorBoundary>
  );
}

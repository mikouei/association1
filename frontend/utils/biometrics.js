import { Platform } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';

const isWeb = Platform.OS === 'web';

// L'appareil possède-t-il un capteur biométrique ET une biométrie enrôlée ?
export const isBiometricAvailable = async () => {
  if (isWeb) return false;
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (!hasHardware) return false;
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    return isEnrolled;
  } catch (e) {
    console.log('isBiometricAvailable error:', e?.message);
    return false;
  }
};

// Renvoie un libellé lisible du type de biométrie disponible (Face ID / Empreinte)
export const getBiometricLabel = async () => {
  if (isWeb) return 'Biométrie';
  try {
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
      return Platform.OS === 'ios' ? 'Face ID' : 'Reconnaissance faciale';
    }
    if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
      return Platform.OS === 'ios' ? 'Touch ID' : 'Empreinte digitale';
    }
    return 'Biométrie';
  } catch {
    return 'Biométrie';
  }
};

// Lance l'invite biométrique. Renvoie { success, error }
export const authenticateBiometric = async (promptMessage = 'Déverrouiller Kotiz') => {
  if (isWeb) return { success: false, error: 'not_available' };
  try {
    const available = await isBiometricAvailable();
    if (!available) return { success: false, error: 'not_available' };

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      cancelLabel: 'Annuler',
      fallbackLabel: '',
      disableDeviceFallback: true,
    });
    return { success: result.success, error: result.success ? null : (result.error || 'failed') };
  } catch (e) {
    return { success: false, error: e?.message || 'failed' };
  }
};

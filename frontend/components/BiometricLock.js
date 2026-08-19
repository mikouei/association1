import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { LockKey, FingerprintSimple } from 'phosphor-react-native';
import { useAuth } from '../context/AuthContext';
import { getBiometricLabel } from '../utils/biometrics';
import { colors, spacing, borderRadius, typography } from '../utils/theme';

export default function BiometricLock() {
  const { unlockApp, logout } = useAuth();
  const router = useRouter();
  const [authenticating, setAuthenticating] = useState(false);
  const [failed, setFailed] = useState(false);
  const [label, setLabel] = useState('Biométrie');

  const attemptUnlock = useCallback(async () => {
    setAuthenticating(true);
    setFailed(false);
    const res = await unlockApp();
    setAuthenticating(false);
    if (!res?.success) {
      setFailed(true);
    }
  }, [unlockApp]);

  useEffect(() => {
    let mounted = true;
    getBiometricLabel().then((l) => { if (mounted) setLabel(l); });
    // Lancer automatiquement l'invite biométrique au montage
    attemptUnlock();
    return () => { mounted = false; };
  }, [attemptUnlock]);

  const handlePasswordFallback = async () => {
    // Repli : reconnexion classique par mot de passe
    await logout();
    router.replace('/login');
  };

  return (
    <View style={styles.container} testID="biometric-lock-screen">
      <View style={styles.iconWrap}>
        <LockKey size={56} color={colors.primary} weight="fill" />
      </View>
      <Text style={styles.title}>Kotiz est verrouillé</Text>
      <Text style={styles.subtitle}>
        Pour votre sécurité, déverrouillez avec {label} pour continuer.
      </Text>

      <TouchableOpacity
        style={styles.unlockButton}
        onPress={attemptUnlock}
        disabled={authenticating}
        testID="biometric-unlock-button"
      >
        {authenticating ? (
          <ActivityIndicator color={colors.textOnPrimary} />
        ) : (
          <>
            <FingerprintSimple size={22} color={colors.textOnPrimary} weight="bold" />
            <Text style={styles.unlockButtonText}>
              {failed ? 'Réessayer' : `Déverrouiller avec ${label}`}
            </Text>
          </>
        )}
      </TouchableOpacity>

      {failed && (
        <Text style={styles.failedText} testID="biometric-failed-text">
          Échec du déverrouillage. Réessayez ou utilisez votre mot de passe.
        </Text>
      )}

      <TouchableOpacity
        style={styles.fallbackButton}
        onPress={handlePasswordFallback}
        testID="biometric-password-fallback-button"
      >
        <Text style={styles.fallbackButtonText}>Se reconnecter par mot de passe</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    zIndex: 9999,
  },
  iconWrap: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: colors.backgroundWhite,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: typography.h2 ? typography.h2.fontSize : 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: typography.body.fontSize,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.xxl,
    lineHeight: 22,
  },
  unlockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.button,
    minHeight: 52,
    width: '100%',
  },
  unlockButtonText: {
    color: colors.textOnPrimary,
    fontSize: typography.body.fontSize,
    fontWeight: '700',
  },
  failedText: {
    color: colors.error,
    fontSize: typography.caption.fontSize,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  fallbackButton: {
    marginTop: spacing.xl,
    paddingVertical: spacing.md,
  },
  fallbackButtonText: {
    color: colors.primary,
    fontSize: typography.body.fontSize,
    fontWeight: '600',
  },
});

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Linking,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Buildings, WarningCircle, CaretLeft, WhatsappLogo } from 'phosphor-react-native';
import api from '../../utils/api';
import { colors, spacing, borderRadius, typography } from '../../utils/theme';
import { useAuth } from '../../context/AuthContext';
import GoogleSignInButton from '../../components/GoogleSignInButton';

const LAST_ASSOCIATION_KEY = '@kotiz_last_association';

export default function JoinScreen() {
  const { code } = useLocalSearchParams();
  const router = useRouter();
  const { loginWithToken } = useAuth();
  const normalizedCode = (code || '').toString().toUpperCase();

  const [association, setAssociation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [joinError, setJoinError] = useState(null);
  const [showLoginHighlight, setShowLoginHighlight] = useState(false);

  useEffect(() => {
    const fetchAssociationInfo = async () => {
      if (!normalizedCode) {
        setError(true);
        setLoading(false);
        return;
      }

      try {
        const response = await api.get(`/public/associations/${normalizedCode}/info`);
        setAssociation(response.data);
      } catch (err) {
        console.error('Error fetching association:', err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchAssociationInfo();
  }, [normalizedCode]);

  const handleLogin = () => {
    // Naviguer vers login avec le code pré-rempli
    router.replace({ pathname: '/login', params: { code: normalizedCode } });
  };

  // Rejoindre via Google
  const handleGoogleCredential = async (idToken) => {
    setJoinError(null);
    setGoogleLoading(true);
    setShowLoginHighlight(false);

    try {
      const response = await api.post(`/public/associations/${normalizedCode}/join-google`, {
        idToken
      });

      const { token, user, association: assoc } = response.data;

      // Sauvegarder la dernière association utilisée
      await AsyncStorage.setItem(LAST_ASSOCIATION_KEY, assoc.id);

      // Connecter l'utilisateur
      loginWithToken(token, user, assoc);
      
      router.replace('/(tabs)');
    } catch (err) {
      const errorData = err.response?.data;
      
      if (errorData?.code === 'ALREADY_MEMBER') {
        setJoinError(`Vous avez déjà un compte pour ${association.name}.`);
        setShowLoginHighlight(true);
        Alert.alert(
          'Compte existant',
          `Vous avez déjà un compte pour ${association.name}.`,
          [{ text: 'Se connecter', onPress: handleLogin }]
        );
      } else {
        setJoinError(errorData?.error || 'Erreur lors de l\'inscription');
        Alert.alert('Erreur', errorData?.error || 'Erreur lors de l\'inscription');
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleGoogleError = (message) => {
    Alert.alert('Erreur Google', message);
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  if (error || !association) {
    return (
      <View style={styles.container}>
        <View style={styles.errorCard}>
          <WarningCircle size={48} weight="duotone" color={colors.error} />
          <Text style={styles.errorTitle}>Lien invalide ou expiré</Text>
          <Text style={styles.errorSubtitle}>
            Ce lien d'invitation ne correspond à aucune association active.
          </Text>
          <TouchableOpacity style={styles.errorButton} onPress={() => router.replace('/login')}>
            <Text style={styles.errorButtonText}>Aller à la connexion</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.whatsappLink}
            onPress={() => Linking.openURL('https://wa.me/2250104833352')}
          >
            <WhatsappLogo size={18} weight="fill" color="#25D366" />
            <Text style={styles.whatsappText}>Besoin d'aide ?</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <CaretLeft size={24} color={colors.text} />
      </TouchableOpacity>

      <View style={styles.card}>
        <View style={styles.iconContainer}>
          <Buildings size={48} weight="duotone" color={colors.textOnPrimary} />
        </View>

        <Text style={styles.title}>{association.name}</Text>
        <Text style={styles.type}>
          {association.type === 'syndicat' ? 'Syndicat / Copropriété' :
           association.type === 'amicale' ? 'Amicale' : 'Association'}
        </Text>

        <View style={styles.codeBox}>
          <Text style={styles.codeLabel}>Code d'accès</Text>
          <Text style={styles.codeValue}>{association.code}</Text>
        </View>

        {/* Bouton Google pour créer un compte membre */}
        <View style={styles.googleSection}>
          <Text style={styles.googleLabel}>Nouveau ? Rejoignez en un clic</Text>
          <GoogleSignInButton
            onCredential={handleGoogleCredential}
            onError={handleGoogleError}
            disabled={googleLoading}
          />
        </View>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>ou</Text>
          <View style={styles.dividerLine} />
        </View>

        {joinError && (
          <Text style={styles.errorText}>{joinError}</Text>
        )}

        <TouchableOpacity 
          style={[styles.loginButton, showLoginHighlight && styles.loginButtonHighlight]} 
          onPress={handleLogin}
        >
          <Text style={styles.loginButtonText}>
            {showLoginHighlight ? '→ ' : ''}Se connecter à {association.name}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.changeLink}
          onPress={() => router.replace('/login')}
        >
          <Text style={styles.changeLinkText}>Pas votre association ? Changer</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.whatsappLink}
          onPress={() => Linking.openURL('https://wa.me/2250104833352')}
        >
          <WhatsappLogo size={18} weight="fill" color="#25D366" />
          <Text style={styles.whatsappText}>Besoin d'aide ? Contactez-nous</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  backButton: {
    position: 'absolute',
    top: spacing.xxl + 20,
    left: spacing.lg,
    padding: spacing.sm,
  },
  loadingText: {
    marginTop: spacing.md,
    color: colors.textOnSecondary,
    fontSize: typography.body.fontSize,
  },
  card: {
    backgroundColor: colors.backgroundWhite,
    borderRadius: borderRadius.card,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.card,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: typography.h2.fontSize,
    fontWeight: typography.h2.fontWeight,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  type: {
    fontSize: typography.body.fontSize,
    color: colors.textMuted,
    marginBottom: spacing.lg,
  },
  codeBox: {
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.button,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  codeLabel: {
    fontSize: typography.caption.fontSize,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  codeValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.primary,
    fontFamily: 'monospace',
  },
  googleSection: {
    width: '100%',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  googleLabel: {
    fontSize: typography.body.fontSize,
    color: colors.textMuted,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    paddingHorizontal: spacing.md,
    fontSize: typography.caption.fontSize,
    color: colors.textMuted,
  },
  errorText: {
    fontSize: typography.caption.fontSize,
    color: colors.error,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  loginButton: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.button,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    width: '100%',
    alignItems: 'center',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  loginButtonHighlight: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  loginButtonText: {
    fontSize: typography.body.fontSize,
    fontWeight: '600',
    color: colors.text,
  },
  changeLink: {
    paddingVertical: spacing.sm,
  },
  changeLinkText: {
    fontSize: typography.caption.fontSize + 1,
    color: colors.textMuted,
  },
  whatsappLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  whatsappText: {
    fontSize: typography.caption.fontSize + 1,
    color: '#25D366',
  },
  // Error styles
  errorCard: {
    backgroundColor: colors.backgroundWhite,
    borderRadius: borderRadius.card,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  errorTitle: {
    fontSize: typography.h3.fontSize,
    fontWeight: '600',
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  errorSubtitle: {
    fontSize: typography.body.fontSize,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  errorButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.button,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    width: '100%',
    alignItems: 'center',
  },
  errorButtonText: {
    fontSize: typography.body.fontSize,
    fontWeight: '600',
    color: colors.textOnPrimary,
  },
});

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Dimensions,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useRouter } from 'expo-router';
import { ArrowLeft, User, IdentificationCard } from 'phosphor-react-native';
import QRCode from 'react-native-qrcode-svg';
import api from '../utils/api';
import { colors, spacing, borderRadius, typography } from '../utils/theme';

const { width } = Dimensions.get('window');
const QR_SIZE = Math.min(width - 80, 280);

export default function MaCarte() {
  const { user, association } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [cardData, setCardData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadMyQR();
  }, []);

  const loadMyQR = async () => {
    try {
      const response = await api.get('/members/my-qr');
      setCardData(response.data);
      setError(null);
    } catch (err) {
      console.error('Erreur chargement QR:', err);
      setError(err.response?.data?.error || 'Impossible de charger votre carte');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Chargement de votre carte...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <IdentificationCard size={80} color={colors.error} weight="duotone" />
        <Text style={styles.errorTitle}>Carte non disponible</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadMyQR}>
          <Text style={styles.retryButtonText}>Réessayer</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBackButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={colors.textOnPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ma carte membre</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Carte */}
      <View style={styles.cardContainer}>
        <View style={styles.card}>
          {/* En-tête de la carte */}
          <View style={styles.cardHeader}>
            <Text style={styles.associationName}>{association?.name || 'Association'}</Text>
            <Text style={styles.cardType}>CARTE MEMBRE</Text>
          </View>

          {/* Avatar et nom */}
          <View style={styles.memberInfo}>
            <View style={styles.avatar}>
              <User size={48} color={colors.primary} weight="duotone" />
            </View>
            <Text style={styles.memberName}>{cardData?.name || 'Membre'}</Text>
            {cardData?.customFieldValue && (
              <Text style={styles.memberField}>{cardData.customFieldValue}</Text>
            )}
          </View>

          {/* QR Code */}
          <View style={styles.qrContainer}>
            <View style={styles.qrBackground}>
              <QRCode
                value={cardData?.qrCode || 'INVALID'}
                size={QR_SIZE}
                backgroundColor="white"
                color={colors.secondary}
              />
            </View>
          </View>

          {/* Instructions */}
          <Text style={styles.instructions}>
            Présentez ce QR code pour vérification
          </Text>
        </View>
      </View>

      {/* Info bas de page */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Ce QR code est unique et lié à votre compte membre.{'\n'}
          Il permet de vérifier votre identité et votre statut de cotisation.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.secondary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    marginTop: spacing.lg,
    fontSize: typography.body.fontSize,
    color: colors.textMuted,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: spacing.xl,
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: spacing.lg,
    padding: spacing.sm,
  },
  errorTitle: {
    fontSize: typography.h2.fontSize,
    fontWeight: '600',
    color: colors.text,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  errorText: {
    fontSize: typography.body.fontSize,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  retryButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.button,
  },
  retryButtonText: {
    color: colors.textOnPrimary,
    fontSize: typography.body.fontSize,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  headerBackButton: {
    padding: spacing.xs,
  },
  headerTitle: {
    fontSize: typography.h2.fontSize,
    fontWeight: '600',
    color: colors.textOnPrimary,
  },
  cardContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  card: {
    backgroundColor: colors.backgroundWhite,
    borderRadius: 24,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  cardHeader: {
    alignItems: 'center',
    marginBottom: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    width: '100%',
  },
  associationName: {
    fontSize: typography.h3.fontSize,
    fontWeight: '700',
    color: colors.secondary,
    textAlign: 'center',
  },
  cardType: {
    fontSize: typography.caption.fontSize,
    fontWeight: '600',
    color: colors.primary,
    letterSpacing: 2,
    marginTop: spacing.xs,
  },
  memberInfo: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  memberName: {
    fontSize: typography.h2.fontSize,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  memberField: {
    fontSize: typography.body.fontSize,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  qrContainer: {
    marginVertical: spacing.lg,
  },
  qrBackground: {
    backgroundColor: 'white',
    padding: spacing.md,
    borderRadius: borderRadius.card,
    borderWidth: 2,
    borderColor: colors.border,
  },
  instructions: {
    fontSize: typography.caption.fontSize,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  footer: {
    padding: spacing.xl,
    paddingBottom: 40,
  },
  footerText: {
    fontSize: typography.caption.fontSize,
    color: colors.textOnSecondary + '80',
    textAlign: 'center',
    lineHeight: 18,
  },
});

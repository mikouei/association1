import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  Dimensions,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useAuth } from '../context/AuthContext';
import { useRouter } from 'expo-router';
import { 
  QrCode, ArrowLeft, CheckCircle, XCircle, Warning, User, Phone 
} from 'phosphor-react-native';
import api from '../utils/api';
import { formatNumber } from '../utils/format';
import { colors, spacing, borderRadius, typography } from '../utils/theme';

const { width, height } = Dimensions.get('window');
const SCAN_SIZE = width * 0.7;

export default function ScannerQR() {
  const { user } = useAuth();
  const router = useRouter();
  const isAdmin = user?.role === 'ADMIN';
  
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [resultModalVisible, setResultModalVisible] = useState(false);

  // Vérification admin
  useEffect(() => {
    if (!isAdmin) {
      Alert.alert('Accès refusé', 'Cette fonctionnalité est réservée aux administrateurs');
      router.back();
    }
  }, [isAdmin]);

  if (!permission) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <View style={styles.permissionContainer}>
          <QrCode size={80} color={colors.primary} weight="duotone" />
          <Text style={styles.permissionTitle}>Accès à la caméra requis</Text>
          <Text style={styles.permissionText}>
            Pour scanner les cartes membres, autorisez l'accès à la caméra
          </Text>
          <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
            <Text style={styles.permissionButtonText}>Autoriser la caméra</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft size={20} color={colors.text} />
            <Text style={styles.backButtonText}>Retour</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const handleBarCodeScanned = async ({ type, data }) => {
    if (scanned || loading) return;
    
    setScanned(true);
    setLoading(true);

    try {
      const response = await api.post('/members/verify-qr', { qrCode: data });
      setResult(response.data);
      setResultModalVisible(true);
    } catch (error) {
      console.error('Scan error:', error);
      setResult({
        error: true,
        message: error.response?.data?.error || 'Code QR invalide ou membre non trouvé'
      });
      setResultModalVisible(true);
    } finally {
      setLoading(false);
    }
  };

  const handleCloseResult = () => {
    setResultModalVisible(false);
    setResult(null);
    setScanned(false);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'paid': return colors.success;
      case 'partial': return colors.warning;
      case 'unpaid': return colors.error;
      default: return colors.textMuted;
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'paid': return <CheckCircle size={32} color={colors.success} weight="fill" />;
      case 'partial': return <Warning size={32} color={colors.warning} weight="fill" />;
      case 'unpaid': return <XCircle size={32} color={colors.error} weight="fill" />;
      default: return <Warning size={32} color={colors.textMuted} weight="fill" />;
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBackButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={colors.textOnPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Scanner un membre</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Camera */}
      <View style={styles.cameraContainer}>
        <CameraView
          style={styles.camera}
          facing="back"
          barcodeScannerSettings={{
            barcodeTypes: ['qr'],
          }}
          onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        >
          {/* Overlay */}
          <View style={styles.overlay}>
            <View style={styles.overlayTop} />
            <View style={styles.overlayMiddle}>
              <View style={styles.overlaySide} />
              <View style={styles.scanArea}>
                <View style={[styles.corner, styles.cornerTL]} />
                <View style={[styles.corner, styles.cornerTR]} />
                <View style={[styles.corner, styles.cornerBL]} />
                <View style={[styles.corner, styles.cornerBR]} />
              </View>
              <View style={styles.overlaySide} />
            </View>
            <View style={styles.overlayBottom}>
              <Text style={styles.scanText}>
                {loading ? 'Vérification en cours...' : 'Placez le QR code dans le cadre'}
              </Text>
            </View>
          </View>
        </CameraView>
      </View>

      {/* Loading indicator */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      )}

      {/* Result Modal */}
      <Modal
        visible={resultModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={handleCloseResult}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            {result?.error ? (
              <>
                <View style={styles.errorIcon}>
                  <XCircle size={64} color={colors.error} weight="fill" />
                </View>
                <Text style={styles.errorTitle}>Membre non trouvé</Text>
                <Text style={styles.errorMessage}>{result.message}</Text>
              </>
            ) : result ? (
              <>
                {/* Member info */}
                <View style={styles.memberInfo}>
                  <View style={styles.memberAvatar}>
                    <User size={48} color={colors.primary} weight="duotone" />
                  </View>
                  <Text style={styles.memberName}>{result.name}</Text>
                  {result.customFieldValue && (
                    <Text style={styles.memberField}>{result.customFieldValue}</Text>
                  )}
                  {result.phone && (
                    <View style={styles.memberPhone}>
                      <Phone size={16} color={colors.textMuted} />
                      <Text style={styles.memberPhoneText}>{result.phone}</Text>
                    </View>
                  )}
                </View>

                {/* Status */}
                <View style={[styles.statusCard, { backgroundColor: getStatusColor(result.cotisation?.status) + '15' }]}>
                  {getStatusIcon(result.cotisation?.status)}
                  <View style={styles.statusInfo}>
                    <Text style={[styles.statusTitle, { color: getStatusColor(result.cotisation?.status) }]}>
                      {result.cotisation?.status === 'paid' ? 'À jour' : 
                       result.cotisation?.status === 'partial' ? 'Paiement partiel' : 
                       result.cotisation?.status === 'unpaid' ? 'En retard' : 'Inconnu'}
                    </Text>
                    <Text style={styles.statusMessage}>{result.cotisation?.message}</Text>
                  </View>
                </View>

                {/* Payment details */}
                {result.cotisation?.monthlyAmount > 0 && (
                  <View style={styles.paymentDetails}>
                    <View style={styles.paymentRow}>
                      <Text style={styles.paymentLabel}>Cotisation mensuelle</Text>
                      <Text style={styles.paymentValue}>{formatNumber(result.cotisation.monthlyAmount)} FCFA</Text>
                    </View>
                    <View style={styles.paymentRow}>
                      <Text style={styles.paymentLabel}>Payé ce mois</Text>
                      <Text style={[styles.paymentValue, { color: getStatusColor(result.cotisation.status) }]}>
                        {formatNumber(result.cotisation.paidAmount)} FCFA
                      </Text>
                    </View>
                  </View>
                )}

                {/* Member status badge */}
                {!result.active && (
                  <View style={styles.inactiveWarning}>
                    <Warning size={20} color={colors.error} />
                    <Text style={styles.inactiveText}>Membre inactif</Text>
                  </View>
                )}
              </>
            ) : null}

            <TouchableOpacity style={styles.closeButton} onPress={handleCloseResult}>
              <Text style={styles.closeButtonText}>Scanner un autre membre</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.primary,
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
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  permissionTitle: {
    fontSize: typography.h2.fontSize,
    fontWeight: '600',
    color: colors.text,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  permissionText: {
    fontSize: typography.body.fontSize,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  permissionButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.button,
    marginBottom: spacing.lg,
  },
  permissionButtonText: {
    color: colors.textOnPrimary,
    fontSize: typography.body.fontSize,
    fontWeight: '600',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  backButtonText: {
    color: colors.text,
    fontSize: typography.body.fontSize,
  },
  cameraContainer: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  overlayTop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  overlayMiddle: {
    flexDirection: 'row',
  },
  overlaySide: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  scanArea: {
    width: SCAN_SIZE,
    height: SCAN_SIZE,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: colors.primary,
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 8,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 8,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 8,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 8,
  },
  overlayBottom: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: spacing.xl,
  },
  scanText: {
    color: '#fff',
    fontSize: typography.body.fontSize,
    textAlign: 'center',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: colors.backgroundWhite,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.xl,
    paddingBottom: 40,
    alignItems: 'center',
  },
  errorIcon: {
    marginBottom: spacing.lg,
  },
  errorTitle: {
    fontSize: typography.h2.fontSize,
    fontWeight: '600',
    color: colors.error,
    marginBottom: spacing.sm,
  },
  errorMessage: {
    fontSize: typography.body.fontSize,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  memberInfo: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  memberAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  memberName: {
    fontSize: typography.h1.fontSize,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  memberField: {
    fontSize: typography.body.fontSize,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  memberPhone: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  memberPhoneText: {
    fontSize: typography.caption.fontSize,
    color: colors.textMuted,
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    borderRadius: borderRadius.card,
    width: '100%',
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  statusInfo: {
    flex: 1,
  },
  statusTitle: {
    fontSize: typography.body.fontSize,
    fontWeight: '700',
  },
  statusMessage: {
    fontSize: typography.caption.fontSize,
    color: colors.textMuted,
    marginTop: 2,
  },
  paymentDetails: {
    width: '100%',
    backgroundColor: colors.background,
    borderRadius: borderRadius.card,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  paymentLabel: {
    fontSize: typography.caption.fontSize,
    color: colors.textMuted,
  },
  paymentValue: {
    fontSize: typography.caption.fontSize,
    fontWeight: '600',
    color: colors.text,
  },
  inactiveWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.error + '15',
    padding: spacing.md,
    borderRadius: borderRadius.card,
    width: '100%',
    marginBottom: spacing.md,
  },
  inactiveText: {
    fontSize: typography.body.fontSize,
    color: colors.error,
    fontWeight: '500',
  },
  closeButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.button,
    width: '100%',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  closeButtonText: {
    color: colors.textOnPrimary,
    fontSize: typography.body.fontSize,
    fontWeight: '600',
  },
});

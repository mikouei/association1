import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Linking,
  Modal,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { 
  Buildings, 
  User, 
  Envelope, 
  Phone, 
  Lock, 
  Eye, 
  EyeSlash, 
  CheckCircle,
  XCircle,
  CircleNotch,
  CaretLeft,
  WhatsappLogo,
  Copy,
} from 'phosphor-react-native';
import api from '../utils/api';
import { colors, spacing, borderRadius, typography } from '../utils/theme';
import * as Clipboard from 'expo-clipboard';
import GoogleSignInButton from '../components/GoogleSignInButton';

const LAST_ASSOCIATION_KEY = '@kotiz_last_association';

export default function RegisterAssociation() {
  const router = useRouter();
  const { loginWithToken } = useAuth();
  
  // Form state
  const [name, setName] = useState('');
  const [type, setType] = useState('association');
  const [code, setCode] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPhone, setAdminPhone] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // UI state
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [codeStatus, setCodeStatus] = useState('idle'); // 'idle' | 'checking' | 'available' | 'taken' | 'format'
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [success, setSuccess] = useState(null);
  const [showTypeModal, setShowTypeModal] = useState(false);

  const types = [
    { value: 'association', label: 'Association' },
    { value: 'amicale', label: 'Amicale' },
    { value: 'syndicat', label: 'Syndicat / Copropriété' },
  ];

  // Debounced code check
  useEffect(() => {
    if (!code || code.length < 3) {
      setCodeStatus('idle');
      return;
    }
    
    setCodeStatus('checking');
    
    const timer = setTimeout(async () => {
      try {
        const response = await api.get(`/public/associations/check-code/${code.toUpperCase()}`);
        if (response.data.available) {
          setCodeStatus('available');
        } else if (response.data.reason === 'format') {
          setCodeStatus('format');
        } else {
          setCodeStatus('taken');
        }
      } catch (error) {
        setCodeStatus('idle');
      }
    }, 500);
    
    return () => clearTimeout(timer);
  }, [code]);

  // Création via Google
  const handleGoogleCredential = async (idToken) => {
    // Validations minimales
    if (!name.trim()) {
      Alert.alert('Erreur', 'Veuillez d\'abord saisir le nom de l\'association');
      return;
    }
    if (!code.trim() || codeStatus !== 'available') {
      Alert.alert('Erreur', 'Veuillez choisir un code valide et disponible');
      return;
    }

    setGoogleLoading(true);

    try {
      const response = await api.post('/public/associations/register-google', {
        idToken,
        name: name.trim(),
        type,
        code: code.toUpperCase().trim(),
      });

      const { token, association, admin } = response.data;

      // Afficher le succès avec le code
      setSuccess({
        code: association.code,
        name: association.name,
        token,
        admin,
        association,
      });
    } catch (error) {
      const message = error.response?.data?.error || 'Erreur lors de la création';
      Alert.alert('Erreur', message);
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleGoogleError = (message) => {
    Alert.alert('Erreur Google', message);
  };

  const handleSubmit = async () => {
    // Validations
    if (!name.trim()) {
      Alert.alert('Erreur', 'Nom de l\'association requis');
      return;
    }
    if (!code.trim() || codeStatus !== 'available') {
      Alert.alert('Erreur', 'Veuillez choisir un code valide et disponible');
      return;
    }
    if (!adminName.trim()) {
      Alert.alert('Erreur', 'Votre nom est requis');
      return;
    }
    if (!adminEmail && !adminPhone) {
      Alert.alert('Erreur', 'Email ou téléphone requis');
      return;
    }
    if (!adminPassword) {
      Alert.alert('Erreur', 'Mot de passe requis');
      return;
    }
    if (adminPassword.length < 6) {
      Alert.alert('Erreur', 'Le mot de passe doit contenir au moins 6 caractères');
      return;
    }
    if (adminPassword !== confirmPassword) {
      Alert.alert('Erreur', 'Les mots de passe ne correspondent pas');
      return;
    }

    setLoading(true);

    try {
      const response = await api.post('/public/associations/register', {
        name: name.trim(),
        type,
        code: code.toUpperCase().trim(),
        adminName: adminName.trim(),
        adminEmail: adminEmail.trim() || undefined,
        adminPhone: adminPhone.trim() || undefined,
        adminPassword,
      });

      const { token, association, admin } = response.data;

      // Afficher le succès avec le code
      setSuccess({
        code: association.code,
        name: association.name,
        token,
        admin,
        association,
      });

    } catch (error) {
      Alert.alert('Erreur', error.response?.data?.error || 'Erreur lors de la création');
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = async () => {
    if (!success) return;

    try {
      // Connecter l'utilisateur avec le token
      await loginWithToken(success.token, {
        id: success.admin.id,
        email: success.admin.email,
        phone: success.admin.phone,
        role: 'ADMIN',
        member: null,
      }, success.association);

      // Sauvegarder l'association dans AsyncStorage
      await AsyncStorage.setItem(LAST_ASSOCIATION_KEY, success.association.id);

      // Naviguer vers l'accueil
      router.replace('/(tabs)');
    } catch (error) {
      Alert.alert('Erreur', 'Erreur lors de la connexion');
    }
  };

  const copyCode = async () => {
    if (success?.code) {
      await Clipboard.setStringAsync(success.code);
      Alert.alert('Copié !', 'Le code a été copié dans le presse-papier');
    }
  };

  const openWhatsApp = () => {
    Linking.openURL('https://wa.me/2250104833352');
  };

  // Écran de succès
  if (success) {
    return (
      <View style={styles.container}>
        <View style={styles.successContainer}>
          <View style={styles.successIcon}>
            <CheckCircle size={48} weight="fill" color={colors.success} />
          </View>
          
          <Text style={styles.successTitle}>Association créée avec succès !</Text>
          
          <View style={styles.codeCard}>
            <Text style={styles.codeLabel}>Votre code association :</Text>
            <TouchableOpacity onPress={copyCode} style={styles.codeRow}>
              <Text style={styles.codeValue}>{success.code}</Text>
              <Copy size={20} color={colors.primary} />
            </TouchableOpacity>
            <Text style={styles.codeHint}>
              Notez-le bien ! C'est ce qui permet à vous et vos futurs membres de vous connecter.
            </Text>
          </View>

          <TouchableOpacity style={styles.continueButton} onPress={handleContinue}>
            <Text style={styles.continueButtonText}>Continuer vers mon tableau de bord</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <CaretLeft size={24} color={colors.text} />
        </TouchableOpacity>

        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Buildings size={32} weight="duotone" color={colors.textOnPrimary} />
          </View>
          <Text style={styles.title}>Créer mon association</Text>
          <Text style={styles.subtitle}>Commencez à gérer vos cotisations</Text>
        </View>

        {/* Formulaire */}
        <View style={styles.form}>
          {/* Nom de l'association */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Nom de l'association *</Text>
            <View style={styles.inputContainer}>
              <Buildings size={20} color={colors.textMuted} />
              <TextInput
                style={styles.input}
                placeholder="Ex: Amicale des Cadres de Bouaké"
                value={name}
                onChangeText={setName}
                placeholderTextColor={colors.textMuted}
              />
            </View>
          </View>

          {/* Type */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Type d'organisation</Text>
            <TouchableOpacity 
              style={styles.selectContainer}
              onPress={() => setShowTypeModal(true)}
            >
              <Text style={styles.selectText}>
                {types.find(t => t.value === type)?.label || 'Sélectionner'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Code */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Code souhaité * <Text style={styles.hint}>(3-20 caractères)</Text></Text>
            <View style={[
              styles.inputContainer,
              codeStatus === 'available' && styles.inputSuccess,
              (codeStatus === 'taken' || codeStatus === 'format') && styles.inputError,
            ]}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Ex: ASCB ou MON-ASSO"
                value={code}
                onChangeText={(text) => setCode(text.toUpperCase())}
                autoCapitalize="characters"
                placeholderTextColor={colors.textMuted}
              />
              {codeStatus === 'checking' && <CircleNotch size={20} color={colors.textMuted} />}
              {codeStatus === 'available' && <CheckCircle size={20} weight="fill" color={colors.success} />}
              {(codeStatus === 'taken' || codeStatus === 'format') && <XCircle size={20} weight="fill" color={colors.error} />}
            </View>
            {codeStatus === 'taken' && <Text style={styles.errorText}>Ce code est déjà utilisé</Text>}
            {codeStatus === 'format' && <Text style={styles.errorText}>Format invalide</Text>}
            {codeStatus === 'available' && <Text style={styles.successText}>Code disponible !</Text>}
          </View>

          <View style={styles.separator} />

          {/* Section Google - Création rapide */}
          <Text style={styles.sectionTitle}>Créer rapidement avec Google</Text>
          <View style={styles.googleSection}>
            <GoogleSignInButton
              onCredential={handleGoogleCredential}
              onError={handleGoogleError}
              disabled={googleLoading || codeStatus !== 'available' || !name.trim()}
            />
            {(codeStatus !== 'available' || !name.trim()) && (
              <Text style={styles.googleHint}>
                Remplissez le nom et le code ci-dessus
              </Text>
            )}
          </View>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>ou créer avec email/mot de passe</Text>
            <View style={styles.dividerLine} />
          </View>

          <Text style={styles.sectionTitle}>Votre compte administrateur</Text>

          {/* Nom admin */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Votre nom complet *</Text>
            <View style={styles.inputContainer}>
              <User size={20} color={colors.textMuted} />
              <TextInput
                style={styles.input}
                placeholder="Ex: Kouadio Jean-Marc"
                value={adminName}
                onChangeText={setAdminName}
                placeholderTextColor={colors.textMuted}
              />
            </View>
          </View>

          {/* Email */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <View style={styles.inputContainer}>
              <Envelope size={20} color={colors.textMuted} />
              <TextInput
                style={styles.input}
                placeholder="email@exemple.com"
                value={adminEmail}
                onChangeText={setAdminEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholderTextColor={colors.textMuted}
              />
            </View>
          </View>

          {/* Téléphone */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Téléphone</Text>
            <View style={styles.inputContainer}>
              <Phone size={20} color={colors.textMuted} />
              <TextInput
                style={styles.input}
                placeholder="07 00 00 00 00"
                value={adminPhone}
                onChangeText={setAdminPhone}
                keyboardType="phone-pad"
                placeholderTextColor={colors.textMuted}
              />
            </View>
          </View>
          <Text style={styles.hint}>Email ou téléphone requis</Text>

          {/* Mot de passe */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Mot de passe * <Text style={styles.hint}>(min. 6 caractères)</Text></Text>
            <View style={styles.inputContainer}>
              <Lock size={20} color={colors.textMuted} />
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                value={adminPassword}
                onChangeText={setAdminPassword}
                secureTextEntry={!showPassword}
                placeholderTextColor={colors.textMuted}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                {showPassword ? (
                  <EyeSlash size={20} color={colors.textMuted} />
                ) : (
                  <Eye size={20} color={colors.textMuted} />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Confirmation */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Confirmation *</Text>
            <View style={[
              styles.inputContainer,
              confirmPassword && adminPassword !== confirmPassword && styles.inputError,
            ]}>
              <Lock size={20} color={colors.textMuted} />
              <TextInput
                style={styles.input}
                placeholder="Confirmez le mot de passe"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPassword}
                placeholderTextColor={colors.textMuted}
              />
              <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                {showConfirmPassword ? (
                  <EyeSlash size={20} color={colors.textMuted} />
                ) : (
                  <Eye size={20} color={colors.textMuted} />
                )}
              </TouchableOpacity>
            </View>
            {confirmPassword && adminPassword !== confirmPassword && (
              <Text style={styles.errorText}>Les mots de passe ne correspondent pas</Text>
            )}
          </View>

          {/* Bouton créer */}
          <TouchableOpacity
            style={[styles.createButton, (loading || codeStatus !== 'available') && styles.createButtonDisabled]}
            onPress={handleSubmit}
            disabled={loading || codeStatus !== 'available'}
          >
            {loading ? (
              <ActivityIndicator color={colors.textOnPrimary} />
            ) : (
              <Text style={styles.createButtonText}>Créer mon association</Text>
            )}
          </TouchableOpacity>

          {/* Lien WhatsApp */}
          <TouchableOpacity style={styles.whatsappLink} onPress={openWhatsApp}>
            <WhatsappLogo size={18} weight="fill" color="#25D366" />
            <Text style={styles.whatsappText}>Besoin d'aide ? Contactez-nous sur WhatsApp</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Modal sélection type */}
      <Modal
        visible={showTypeModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTypeModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setShowTypeModal(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Type d'organisation</Text>
            {types.map((t) => (
              <TouchableOpacity
                key={t.value}
                style={[styles.modalOption, type === t.value && styles.modalOptionSelected]}
                onPress={() => {
                  setType(t.value);
                  setShowTypeModal(false);
                }}
              >
                <Text style={[styles.modalOptionText, type === t.value && styles.modalOptionTextSelected]}>
                  {t.label}
                </Text>
                {type === t.value && <CheckCircle size={20} weight="fill" color={colors.primary} />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xxl * 2,
  },
  backButton: {
    marginBottom: spacing.md,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: borderRadius.card,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: typography.h2.fontSize,
    fontWeight: typography.h2.fontWeight,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.body.fontSize,
    color: colors.textMuted,
  },
  form: {
    gap: spacing.md,
  },
  inputGroup: {
    gap: spacing.xs,
  },
  label: {
    fontSize: typography.caption.fontSize + 1,
    fontWeight: '500',
    color: colors.text,
  },
  hint: {
    fontSize: typography.caption.fontSize,
    color: colors.textMuted,
    fontWeight: 'normal',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.input,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    height: 52,
    gap: spacing.sm,
  },
  inputSuccess: {
    borderColor: colors.success,
  },
  inputError: {
    borderColor: colors.error,
  },
  input: {
    flex: 1,
    fontSize: typography.body.fontSize,
    color: colors.text,
  },
  selectContainer: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.input,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    height: 52,
    justifyContent: 'center',
  },
  selectText: {
    fontSize: typography.body.fontSize,
    color: colors.text,
  },
  errorText: {
    fontSize: typography.caption.fontSize,
    color: colors.error,
  },
  successText: {
    fontSize: typography.caption.fontSize,
    color: colors.success,
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  googleSection: {
    alignItems: 'center',
    marginVertical: spacing.md,
  },
  googleHint: {
    fontSize: typography.caption.fontSize,
    color: colors.textMuted,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.lg,
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
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: typography.body.fontSize,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  createButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.button,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
  createButtonDisabled: {
    opacity: 0.5,
  },
  createButtonText: {
    fontSize: typography.body.fontSize,
    fontWeight: '600',
    color: colors.textOnPrimary,
  },
  whatsappLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  whatsappText: {
    fontSize: typography.caption.fontSize + 1,
    color: '#25D366',
  },
  // Success screen
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  successIcon: {
    marginBottom: spacing.lg,
  },
  successTitle: {
    fontSize: typography.h2.fontSize,
    fontWeight: typography.h2.fontWeight,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  codeCard: {
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.card,
    borderWidth: 2,
    borderColor: colors.primary,
    padding: spacing.lg,
    alignItems: 'center',
    width: '100%',
    marginBottom: spacing.xl,
  },
  codeLabel: {
    fontSize: typography.caption.fontSize + 1,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  codeValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.primary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  codeHint: {
    fontSize: typography.caption.fontSize,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  continueButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.button,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  continueButtonText: {
    fontSize: typography.body.fontSize,
    fontWeight: '600',
    color: colors.textOnPrimary,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.card,
    width: '100%',
    maxWidth: 320,
    padding: spacing.lg,
  },
  modalTitle: {
    fontSize: typography.body.fontSize,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  modalOptionSelected: {
    backgroundColor: colors.primaryLight,
    marginHorizontal: -spacing.lg,
    paddingHorizontal: spacing.lg,
    borderBottomColor: 'transparent',
  },
  modalOptionText: {
    fontSize: typography.body.fontSize,
    color: colors.text,
  },
  modalOptionTextSelected: {
    fontWeight: '600',
    color: colors.primary,
  },
});

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Linking,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Buildings, WarningCircle, CaretLeft, WhatsappLogo, UserPlus, Eye, EyeSlash, CheckCircle } from 'phosphor-react-native';
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

  // Demande d'inscription manuelle
  const [showForm, setShowForm] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [form, setForm] = useState({ name: '', phone: '', password: '', confirmPassword: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const updateForm = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleJoinRequest = async () => {
    setFormError(null);

    const name = form.name.trim();
    const phone = form.phone.trim();

    if (!name) {
      setFormError('Veuillez renseigner votre nom');
      return;
    }
    if (!phone) {
      setFormError('Veuillez renseigner votre numéro de téléphone');
      return;
    }
    if (form.password.length < 8) {
      setFormError('Le mot de passe doit contenir au moins 8 caractères');
      return;
    }
    if (form.password !== form.confirmPassword) {
      setFormError('Les mots de passe ne correspondent pas');
      return;
    }

    setSubmitting(true);
    try {
      await api.post(`/public/associations/${normalizedCode}/join-request`, {
        name,
        phone,
        password: form.password,
      });
      setSubmitted(true);
    } catch (err) {
      const errorData = err.response?.data;
      setFormError(errorData?.error || "Erreur lors de l'envoi de la demande");
    } finally {
      setSubmitting(false);
    }
  };

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

  if (submitted) {
    return (
      <View style={styles.container} testID="join-request-success">
        <View style={styles.card}>
          <View style={[styles.iconContainer, { backgroundColor: colors.success }]}>
            <CheckCircle size={48} weight="fill" color={colors.textOnPrimary} />
          </View>
          <Text style={styles.title}>Demande envoyée !</Text>
          <Text style={styles.successSubtitle}>
            Votre demande d'inscription à {association?.name} a bien été enregistrée.
            Elle est en attente de validation par un administrateur. Vous pourrez vous
            connecter une fois votre compte approuvé.
          </Text>
          <TouchableOpacity
            style={styles.errorButton}
            onPress={handleLogin}
            testID="join-success-login-button"
          >
            <Text style={styles.errorButtonText}>Aller à la connexion</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <CaretLeft size={24} color={colors.text} />
      </TouchableOpacity>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
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

        {!showForm ? (
          <TouchableOpacity
            style={styles.manualButton}
            onPress={() => { setShowForm(true); setFormError(null); }}
            testID="join-manual-request-button"
          >
            <UserPlus size={18} color={colors.primary} weight="bold" />
            <Text style={styles.manualButtonText}>Demander à rejoindre manuellement</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.form} testID="join-request-form">
            <Text style={styles.formTitle}>Demande d'inscription</Text>
            <Text style={styles.formHint}>
              Votre compte sera activé après validation par un administrateur.
            </Text>

            <Text style={styles.inputLabel}>Nom complet</Text>
            <TextInput
              style={styles.input}
              value={form.name}
              onChangeText={(t) => updateForm('name', t)}
              placeholder="Ex: Jean Kouassi"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="words"
              testID="join-input-name"
            />

            <Text style={styles.inputLabel}>Téléphone</Text>
            <TextInput
              style={styles.input}
              value={form.phone}
              onChangeText={(t) => updateForm('phone', t)}
              placeholder="Ex: +225 07 00 00 00 00"
              placeholderTextColor={colors.textMuted}
              keyboardType="phone-pad"
              testID="join-input-phone"
            />

            <Text style={styles.inputLabel}>Mot de passe</Text>
            <View style={styles.passwordRow}>
              <TextInput
                style={styles.passwordInput}
                value={form.password}
                onChangeText={(t) => updateForm('password', t)}
                placeholder="Au moins 8 caractères"
                placeholderTextColor={colors.textMuted}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                testID="join-input-password"
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowPassword((v) => !v)}
                testID="join-toggle-password"
              >
                {showPassword ? (
                  <EyeSlash size={20} color={colors.textMuted} />
                ) : (
                  <Eye size={20} color={colors.textMuted} />
                )}
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Confirmer le mot de passe</Text>
            <View style={styles.passwordRow}>
              <TextInput
                style={styles.passwordInput}
                value={form.confirmPassword}
                onChangeText={(t) => updateForm('confirmPassword', t)}
                placeholder="Retapez le mot de passe"
                placeholderTextColor={colors.textMuted}
                secureTextEntry={!showConfirm}
                autoCapitalize="none"
                testID="join-input-confirm-password"
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowConfirm((v) => !v)}
                testID="join-toggle-confirm-password"
              >
                {showConfirm ? (
                  <EyeSlash size={20} color={colors.textMuted} />
                ) : (
                  <Eye size={20} color={colors.textMuted} />
                )}
              </TouchableOpacity>
            </View>

            {formError && (
              <Text style={styles.errorText} testID="join-form-error">{formError}</Text>
            )}

            <TouchableOpacity
              style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
              onPress={handleJoinRequest}
              disabled={submitting}
              testID="join-submit-button"
            >
              {submitting ? (
                <ActivityIndicator color={colors.textOnPrimary} />
              ) : (
                <Text style={styles.submitButtonText}>Envoyer ma demande</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.changeLink}
              onPress={() => { setShowForm(false); setFormError(null); }}
              testID="join-form-cancel"
            >
              <Text style={styles.changeLinkText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        )}

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
      </ScrollView>
    </KeyboardAvoidingView>
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
  flex: {
    flex: 1,
    backgroundColor: colors.secondary,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
    paddingTop: spacing.xxl + 40,
    paddingBottom: spacing.xxl,
  },
  successSubtitle: {
    fontSize: typography.body.fontSize,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
    lineHeight: 22,
  },
  manualButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.button,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
    width: '100%',
    marginBottom: spacing.md,
  },
  manualButtonText: {
    fontSize: typography.body.fontSize,
    fontWeight: '600',
    color: colors.primary,
  },
  form: {
    width: '100%',
    marginBottom: spacing.sm,
  },
  formTitle: {
    fontSize: typography.h3.fontSize,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  formHint: {
    fontSize: typography.caption.fontSize,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  inputLabel: {
    fontSize: typography.caption.fontSize + 1,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.button,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: typography.body.fontSize,
    color: colors.text,
    backgroundColor: colors.backgroundWhite,
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.button,
    backgroundColor: colors.backgroundWhite,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: typography.body.fontSize,
    color: colors.text,
  },
  eyeButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.button,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
    minHeight: 50,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: typography.body.fontSize,
    fontWeight: '700',
    color: colors.textOnPrimary,
  },
});

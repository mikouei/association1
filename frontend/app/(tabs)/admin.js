import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { 
  ShieldCheck, 
  CheckCircle, 
  XCircle, 
  Plus, 
  X, 
  Key, 
  Prohibit,
  QrCode,
  Eye,
  EyeSlash,
  Trash,
} from 'phosphor-react-native';
import api from '../../utils/api';
import { colors, spacing, borderRadius, typography } from '../../utils/theme';

// Configuration des rôles
const ROLE_CONFIG = {
  ADMIN: {
    label: 'Administrateur',
    description: 'Accès complet',
    color: colors.primary,
    bgColor: colors.warningBg,
    Icon: ShieldCheck,
  },
  SCANNER: {
    label: 'Scanner',
    description: 'Vérification QR uniquement',
    color: '#8B5CF6',
    bgColor: '#EDE9FE',
    Icon: QrCode,
  },
  AUDITEUR: {
    label: 'Auditeur',
    description: 'Consultation lecture seule',
    color: colors.success,
    bgColor: colors.successBg,
    Icon: Eye,
  },
};

export default function Admin() {
  const [staffUsers, setStaffUsers] = useState([]);
  const [quotas, setQuotas] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [resetModalVisible, setResetModalVisible] = useState(false);
  const [resetUser, setResetUser] = useState(null);
  const [resetPassword, setResetPassword] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [newUser, setNewUser] = useState({
    email: '',
    phone: '',
    password: '',
    role: 'ADMIN',
  });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [usersRes, quotasRes] = await Promise.all([
        api.get('/admin/list'),
        api.get('/admin/quotas'),
      ]);
      setStaffUsers(usersRes.data);
      setQuotas(quotasRes.data);
    } catch (error) {
      console.error('Erreur chargement:', error);
      Alert.alert('Erreur', 'Impossible de charger les données');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleCreateUser = async () => {
    if (!newUser.email || !newUser.password) {
      Alert.alert('Erreur', 'Email et mot de passe requis');
      return;
    }

    setCreating(true);
    try {
      await api.post('/admin/create', newUser);
      Alert.alert('Succès', `${ROLE_CONFIG[newUser.role].label} créé avec succès`);
      setModalVisible(false);
      setNewUser({ email: '', phone: '', password: '', role: 'ADMIN' });
      loadData();
    } catch (error) {
      console.error('Erreur création:', error);
      Alert.alert('Erreur', error.response?.data?.error || 'Erreur lors de la création');
    } finally {
      setCreating(false);
    }
  };

  const handleToggleActive = async (user) => {
    const roleLabel = ROLE_CONFIG[user.role]?.label || user.role;
    const action = user.active ? 'désactiver' : 'réactiver';
    Alert.alert(
      'Confirmation',
      `Voulez-vous ${action} ce ${roleLabel.toLowerCase()} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          onPress: async () => {
            try {
              const endpoint = user.active ? 'deactivate' : 'activate';
              await api.put(`/admin/${user.id}/${endpoint}`);
              Alert.alert('Succès', `Compte ${action} avec succès`);
              loadData();
            } catch (error) {
              console.error('Erreur toggle active:', error);
              Alert.alert('Erreur', error.response?.data?.error || 'Une erreur est survenue');
            }
          },
        },
      ]
    );
  };

  const handleResetPassword = (user) => {
    setResetUser(user);
    setResetPassword('');
    setShowResetPassword(false);
    setResetModalVisible(true);
  };

  const handleDeleteStaff = (user) => {
    Alert.alert(
      'Supprimer le compte',
      `Êtes-vous sûr de vouloir supprimer le compte de ${user.email || user.phone} ? Cette action est irréversible.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/admin/${user.id}`);
              Alert.alert('Succès', 'Compte supprimé');
              loadData();
            } catch (error) {
              console.error('Erreur suppression compte:', error);
              Alert.alert('Erreur', error.response?.data?.error || 'Erreur lors de la suppression');
            }
          },
        },
      ]
    );
  };

  const handleConfirmResetPassword = async () => {
    if (!resetPassword || resetPassword.length < 8) {
      Alert.alert('Erreur', 'Mot de passe trop court (minimum 8 caractères)');
      return;
    }
    setResettingPassword(true);
    try {
      await api.post(`/admin/${resetUser.id}/reset-password`, { newPassword: resetPassword });
      setResetModalVisible(false);
      setResetUser(null);
      setResetPassword('');
      Alert.alert('Succès', 'Mot de passe réinitialisé');
    } catch (error) {
      console.error('Erreur reset password:', error);
      Alert.alert('Erreur', error.response?.data?.error || 'Erreur lors de la réinitialisation');
    } finally {
      setResettingPassword(false);
    }
  };

  const renderQuotaCard = (role) => {
    if (!quotas || !quotas[role]) return null;
    const config = ROLE_CONFIG[role];
    const quota = quotas[role];
    const percentage = (quota.current / quota.max) * 100;
    const Icon = config.Icon;

    return (
      <View style={[styles.quotaCard, { borderLeftColor: config.color }]} key={role}>
        <View style={[styles.quotaIcon, { backgroundColor: config.bgColor }]}>
          <Icon size={20} color={config.color} weight="fill" />
        </View>
        <View style={styles.quotaInfo}>
          <Text style={styles.quotaLabel}>{config.label}s</Text>
          <View style={styles.quotaBar}>
            <View 
              style={[
                styles.quotaBarFill, 
                { 
                  width: `${Math.min(percentage, 100)}%`,
                  backgroundColor: percentage >= 100 ? colors.error : percentage >= 80 ? colors.warning : colors.success
                }
              ]} 
            />
          </View>
        </View>
        <Text style={styles.quotaCount}>{quota.current}/{quota.max}</Text>
      </View>
    );
  };

  const renderUser = ({ item }) => {
    const config = ROLE_CONFIG[item.role] || ROLE_CONFIG.ADMIN;
    const Icon = config.Icon;

    return (
      <View style={styles.userCard}>
        <View style={styles.userHeader}>
          <View style={[styles.userIcon, { backgroundColor: config.bgColor }]}>
            <Icon size={24} color={config.color} weight="fill" />
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userEmail}>{item.email}</Text>
            {item.phone && <Text style={styles.userPhone}>{item.phone}</Text>}
            <View style={styles.userMeta}>
              <View style={[styles.roleBadge, { backgroundColor: config.bgColor }]}>
                <Text style={[styles.roleBadgeText, { color: config.color }]}>{config.label}</Text>
              </View>
              <Text style={styles.userDate}>
                {new Date(item.createdAt).toLocaleDateString('fr-FR')}
              </Text>
            </View>
          </View>
          <View style={styles.userStatus}>
            {item.active ? (
              <CheckCircle size={24} color={colors.success} weight="fill" />
            ) : (
              <XCircle size={24} color={colors.error} weight="fill" />
            )}
          </View>
        </View>

        <View style={styles.userActions}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: item.active ? colors.warning : colors.success }]}
            onPress={() => handleToggleActive(item)}
          >
            {item.active ? (
              <Prohibit size={16} color={colors.textOnSecondary} />
            ) : (
              <CheckCircle size={16} color={colors.textOnSecondary} weight="fill" />
            )}
            <Text style={styles.actionButtonText}>
              {item.active ? 'Désactiver' : 'Activer'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.secondary }]}
            onPress={() => handleResetPassword(item)}
          >
            <Key size={16} color={colors.textOnSecondary} weight="fill" />
            <Text style={styles.actionButtonText}>Reset MDP</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.error }]}
            onPress={() => handleDeleteStaff(item)}
            testID={`delete-staff-${item.id}`}
          >
            <Trash size={16} color={colors.textOnSecondary} weight="fill" />
            <Text style={styles.actionButtonText}>Supprimer</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderRoleSelector = () => (
    <View style={styles.roleSelectorContainer}>
      <Text style={styles.label}>Type de compte *</Text>
      {['ADMIN', 'SCANNER', 'AUDITEUR'].map((role) => {
        const config = ROLE_CONFIG[role];
        const quota = quotas?.[role];
        const isDisabled = quota && quota.current >= quota.max;
        const isSelected = newUser.role === role;
        const Icon = config.Icon;

        return (
          <TouchableOpacity
            key={role}
            style={[
              styles.roleOption,
              isSelected && styles.roleOptionSelected,
              isDisabled && styles.roleOptionDisabled,
            ]}
            onPress={() => !isDisabled && setNewUser({ ...newUser, role })}
            disabled={isDisabled}
          >
            <View style={[styles.roleOptionIcon, { backgroundColor: config.bgColor }]}>
              <Icon size={20} color={config.color} weight={isSelected ? 'fill' : 'regular'} />
            </View>
            <View style={styles.roleOptionInfo}>
              <Text style={[styles.roleOptionLabel, isDisabled && { color: colors.textMuted }]}>
                {config.label}
              </Text>
              <Text style={styles.roleOptionDesc}>{config.description}</Text>
            </View>
            {quota && (
              <Text style={[styles.roleOptionQuota, isDisabled && { color: colors.error }]}>
                {quota.current}/{quota.max}
              </Text>
            )}
            {isSelected && (
              <View style={styles.roleOptionCheck}>
                <CheckCircle size={20} color={colors.primary} weight="fill" />
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Quotas */}
      <View style={styles.quotasContainer}>
        {['ADMIN', 'SCANNER', 'AUDITEUR'].map(renderQuotaCard)}
      </View>

      <FlatList
        data={staffUsers}
        renderItem={renderUser}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <ShieldCheck size={64} color={colors.border} />
            <Text style={styles.emptyText}>Aucun compte</Text>
          </View>
        )}
      />

      <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
        <Plus size={28} color={colors.textOnPrimary} weight="bold" />
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContainer}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nouveau compte</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X size={28} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {renderRoleSelector()}

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Email *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="email@exemple.com"
                  placeholderTextColor={colors.textMuted}
                  value={newUser.email}
                  onChangeText={(text) => setNewUser({ ...newUser, email: text })}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Téléphone</Text>
                <TextInput
                  style={styles.input}
                  placeholder="+237 6XX XX XX XX"
                  placeholderTextColor={colors.textMuted}
                  value={newUser.phone}
                  onChangeText={(text) => setNewUser({ ...newUser, phone: text })}
                  keyboardType="phone-pad"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Mot de passe *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Minimum 8 caractères"
                  placeholderTextColor={colors.textMuted}
                  value={newUser.password}
                  onChangeText={(text) => setNewUser({ ...newUser, password: text })}
                  secureTextEntry
                />
              </View>

              <TouchableOpacity
                style={[styles.submitButton, creating && styles.submitButtonDisabled]}
                onPress={handleCreateUser}
                disabled={creating}
              >
                {creating ? (
                  <ActivityIndicator color={colors.textOnPrimary} />
                ) : (
                  <Text style={styles.submitButtonText}>Créer le compte</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal Réinitialisation mot de passe */}
      <Modal
        visible={resetModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setResetModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContainer}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Réinitialiser le mot de passe</Text>
              <TouchableOpacity onPress={() => setResetModalVisible(false)} testID="reset-password-close">
                <X size={28} color={colors.text} />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>
              Nouveau mot de passe pour {resetUser?.email || resetUser?.phone || 'ce compte'}
            </Text>
            <View style={styles.passwordRow}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Au moins 8 caractères"
                placeholderTextColor={colors.textMuted}
                value={resetPassword}
                onChangeText={setResetPassword}
                secureTextEntry={!showResetPassword}
                autoCapitalize="none"
                testID="reset-password-input"
              />
              <TouchableOpacity
                onPress={() => setShowResetPassword((v) => !v)}
                style={styles.eyeButton}
                testID="reset-password-toggle"
              >
                {showResetPassword ? (
                  <EyeSlash size={22} color={colors.textMuted} />
                ) : (
                  <Eye size={22} color={colors.textMuted} />
                )}
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.submitButton, resettingPassword && styles.submitButtonDisabled]}
              onPress={handleConfirmResetPassword}
              disabled={resettingPassword}
              testID="reset-password-confirm"
            >
              {resettingPassword ? (
                <ActivityIndicator color={colors.textOnPrimary} />
              ) : (
                <Text style={styles.submitButtonText}>Confirmer</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.button,
    backgroundColor: colors.backgroundWhite,
    marginTop: spacing.xs,
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  quotasContainer: {
    padding: spacing.lg,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  quotaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundWhite,
    borderRadius: borderRadius.card,
    padding: spacing.md,
    borderLeftWidth: 4,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  quotaIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  quotaInfo: {
    flex: 1,
  },
  quotaLabel: {
    fontSize: typography.caption.fontSize + 1,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  quotaBar: {
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  quotaBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  quotaCount: {
    fontSize: typography.body.fontSize,
    fontWeight: '700',
    color: colors.text,
    marginLeft: spacing.md,
  },
  listContent: {
    padding: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: 80,
  },
  userCard: {
    backgroundColor: colors.backgroundWhite,
    borderRadius: borderRadius.card,
    padding: spacing.lg,
    marginBottom: spacing.md,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  userIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  userInfo: {
    flex: 1,
  },
  userEmail: {
    fontSize: typography.body.fontSize,
    fontWeight: '600',
    color: colors.text,
  },
  userPhone: {
    fontSize: typography.caption.fontSize + 1,
    color: colors.textMuted,
    marginTop: 2,
  },
  userMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
    gap: spacing.sm,
  },
  roleBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.button,
  },
  roleBadgeText: {
    fontSize: typography.caption.fontSize,
    fontWeight: '600',
  },
  userDate: {
    fontSize: typography.caption.fontSize,
    color: colors.textMuted,
  },
  userStatus: {
    marginLeft: spacing.sm,
  },
  userActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.button,
    gap: spacing.xs,
  },
  actionButtonText: {
    color: colors.textOnSecondary,
    fontSize: typography.caption.fontSize,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl * 2,
  },
  emptyText: {
    fontSize: typography.body.fontSize,
    color: colors.textMuted,
    marginTop: spacing.lg,
  },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: colors.backgroundWhite,
    borderTopLeftRadius: borderRadius.card,
    borderTopRightRadius: borderRadius.card,
    padding: spacing.xl,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  modalTitle: {
    fontSize: typography.h2.fontSize,
    fontWeight: typography.h2.fontWeight,
    color: colors.text,
    fontFamily: typography.fontFamilyHeading,
  },
  roleSelectorContainer: {
    marginBottom: spacing.lg,
  },
  roleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.card,
    marginBottom: spacing.sm,
  },
  roleOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryBg || '#FFF9E6',
  },
  roleOptionDisabled: {
    opacity: 0.5,
  },
  roleOptionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  roleOptionInfo: {
    flex: 1,
  },
  roleOptionLabel: {
    fontSize: typography.body.fontSize,
    fontWeight: '600',
    color: colors.text,
  },
  roleOptionDesc: {
    fontSize: typography.caption.fontSize,
    color: colors.textMuted,
  },
  roleOptionQuota: {
    fontSize: typography.caption.fontSize,
    fontWeight: '600',
    color: colors.textMuted,
    marginRight: spacing.sm,
  },
  roleOptionCheck: {
    marginLeft: spacing.xs,
  },
  inputContainer: {
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: typography.caption.fontSize + 1,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.borderLight,
    borderRadius: borderRadius.input,
    padding: spacing.md,
    fontSize: typography.body.fontSize,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
  },
  submitButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.button,
    alignItems: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: colors.textOnPrimary,
    fontSize: typography.button.fontSize,
    fontWeight: typography.button.fontWeight,
  },
});

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
  Prohibit 
} from 'phosphor-react-native';
import api from '../../utils/api';
import { colors, spacing, borderRadius, typography } from '../../utils/theme';

export default function Admin() {
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [newAdmin, setNewAdmin] = useState({
    email: '',
    phone: '',
    password: '',
  });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadAdmins();
  }, []);

  const loadAdmins = async () => {
    try {
      const response = await api.get('/admin/list');
      setAdmins(response.data);
    } catch (error) {
      console.error('Erreur chargement admins:', error);
      Alert.alert('Erreur', 'Impossible de charger les administrateurs');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadAdmins();
  };

  const handleCreateAdmin = async () => {
    if (!newAdmin.email || !newAdmin.password) {
      Alert.alert('Erreur', 'Email et mot de passe requis');
      return;
    }

    setCreating(true);
    try {
      await api.post('/admin/create', newAdmin);
      Alert.alert('Succès', 'Administrateur créé avec succès');
      setModalVisible(false);
      setNewAdmin({ email: '', phone: '', password: '' });
      loadAdmins();
    } catch (error) {
      console.error('Erreur création admin:', error);
      Alert.alert('Erreur', error.response?.data?.error || 'Erreur lors de la création');
    } finally {
      setCreating(false);
    }
  };

  const handleToggleActive = async (admin) => {
    const action = admin.active ? 'désactiver' : 'réactiver';
    Alert.alert(
      'Confirmation',
      `Voulez-vous ${action} cet administrateur ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          onPress: async () => {
            try {
              const endpoint = admin.active ? 'deactivate' : 'activate';
              await api.put(`/admin/${admin.id}/${endpoint}`);
              Alert.alert('Succès', `Administrateur ${action} avec succès`);
              loadAdmins();
            } catch (error) {
              console.error('Erreur toggle active:', error);
              Alert.alert('Erreur', error.response?.data?.error || 'Une erreur est survenue');
            }
          },
        },
      ]
    );
  };

  const handleResetPassword = (admin) => {
    Alert.prompt(
      'Réinitialiser le mot de passe',
      `Nouveau mot de passe pour ${admin.email}:`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          onPress: async (newPassword) => {
            if (!newPassword || newPassword.length < 4) {
              Alert.alert('Erreur', 'Mot de passe trop court (minimum 4 caractères)');
              return;
            }
            try {
              await api.post(`/admin/${admin.id}/reset-password`, { newPassword });
              Alert.alert('Succès', 'Mot de passe réinitialisé');
            } catch (error) {
              console.error('Erreur reset password:', error);
              Alert.alert('Erreur', 'Erreur lors de la réinitialisation');
            }
          },
        },
      ],
      'plain-text'
    );
  };

  const renderAdmin = ({ item }) => (
    <View style={styles.adminCard}>
      <View style={styles.adminHeader}>
        <View style={styles.adminIcon}>
          <ShieldCheck size={24} color={colors.primary} weight="fill" />
        </View>
        <View style={styles.adminInfo}>
          <Text style={styles.adminEmail}>{item.email}</Text>
          {item.phone && <Text style={styles.adminPhone}>{item.phone}</Text>}
          <Text style={styles.adminDate}>
            Créé le {new Date(item.createdAt).toLocaleDateString('fr-FR')}
          </Text>
        </View>
        <View style={styles.adminStatus}>
          {item.active ? (
            <CheckCircle size={24} color={colors.success} weight="fill" />
          ) : (
            <XCircle size={24} color={colors.error} weight="fill" />
          )}
        </View>
      </View>

      <View style={styles.adminActions}>
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
          <Text style={styles.actionButtonText}>Reset mot de passe</Text>
        </TouchableOpacity>
      </View>
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
      <FlatList
        data={admins}
        renderItem={renderAdmin}
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
            <Text style={styles.emptyText}>Aucun administrateur</Text>
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
              <Text style={styles.modalTitle}>Nouvel administrateur</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X size={28} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView>
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Email *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="email@exemple.com"
                  placeholderTextColor={colors.textMuted}
                  value={newAdmin.email}
                  onChangeText={(text) => setNewAdmin({ ...newAdmin, email: text })}
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
                  value={newAdmin.phone}
                  onChangeText={(text) => setNewAdmin({ ...newAdmin, phone: text })}
                  keyboardType="phone-pad"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Mot de passe *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Minimum 4 caractères"
                  placeholderTextColor={colors.textMuted}
                  value={newAdmin.password}
                  onChangeText={(text) => setNewAdmin({ ...newAdmin, password: text })}
                  secureTextEntry
                />
              </View>

              <TouchableOpacity
                style={[styles.submitButton, creating && styles.submitButtonDisabled]}
                onPress={handleCreateAdmin}
                disabled={creating}
              >
                {creating ? (
                  <ActivityIndicator color={colors.textOnPrimary} />
                ) : (
                  <Text style={styles.submitButtonText}>Créer l'administrateur</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  listContent: {
    padding: spacing.lg,
    paddingBottom: 80,
  },
  adminCard: {
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
  adminHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  adminIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.warningBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  adminInfo: {
    flex: 1,
  },
  adminEmail: {
    fontSize: typography.body.fontSize,
    fontWeight: '600',
    color: colors.text,
  },
  adminPhone: {
    fontSize: typography.caption.fontSize + 1,
    color: colors.textMuted,
    marginTop: 2,
  },
  adminDate: {
    fontSize: typography.caption.fontSize,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  adminStatus: {
    marginLeft: spacing.sm,
  },
  adminActions: {
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
    maxHeight: '80%',
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

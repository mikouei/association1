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
import { Ionicons } from '@expo/vector-icons';
import api from '../../utils/api';

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
          <Ionicons name="shield" size={24} color="#2196F3" />
        </View>
        <View style={styles.adminInfo}>
          <Text style={styles.adminEmail}>{item.email}</Text>
          {item.phone && <Text style={styles.adminPhone}>{item.phone}</Text>}
          <Text style={styles.adminDate}>
            Créé le {new Date(item.createdAt).toLocaleDateString('fr-FR')}
          </Text>
        </View>
        <View style={styles.adminStatus}>
          <Ionicons
            name={item.active ? 'checkmark-circle' : 'close-circle'}
            size={24}
            color={item.active ? '#4CAF50' : '#FF5252'}
          />
        </View>
      </View>

      <View style={styles.adminActions}>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: item.active ? '#FF9800' : '#4CAF50' }]}
          onPress={() => handleToggleActive(item)}
        >
          <Ionicons name={item.active ? 'ban' : 'checkmark'} size={16} color="#fff" />
          <Text style={styles.actionButtonText}>
            {item.active ? 'Désactiver' : 'Activer'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: '#2196F3' }]}
          onPress={() => handleResetPassword(item)}
        >
          <Ionicons name="key" size={16} color="#fff" />
          <Text style={styles.actionButtonText}>Reset mot de passe</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
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
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <Ionicons name="shield-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>Aucun administrateur</Text>
          </View>
        )}
      />

      <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
        <Ionicons name="add" size={28} color="#fff" />
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
                <Ionicons name="close" size={28} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView>
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Email *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="email@exemple.com"
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
                  <ActivityIndicator color="#fff" />
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
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
    paddingBottom: 80,
  },
  adminCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  adminHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  adminIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  adminInfo: {
    flex: 1,
  },
  adminEmail: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  adminPhone: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  adminDate: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  adminStatus: {
    marginLeft: 8,
  },
  adminActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 6,
    gap: 4,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 16,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
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
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  submitButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

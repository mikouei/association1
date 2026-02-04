import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { usePlatformAuth } from '../../context/PlatformAuthContext';
import api from '../../utils/api';

export default function PlatformDashboard() {
  const router = useRouter();
  const { superAdmin, logout } = usePlatformAuth();
  
  const [associations, setAssociations] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Modal création
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingAssociation, setEditingAssociation] = useState(null);
  const [creating, setCreating] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    type: 'association',
    code: '',
    adminEmail: '',
    adminPassword: '',
    adminName: ''
  });
  const [editFormData, setEditFormData] = useState({
    name: '',
    type: ''
  });

  useEffect(() => {
    if (!superAdmin) {
      router.replace('/platform');
      return;
    }
    loadData();
  }, [superAdmin]);

  const loadData = async () => {
    try {
      const [assocRes, statsRes] = await Promise.all([
        api.get('/platform/associations'),
        api.get('/platform/stats')
      ]);
      setAssociations(assocRes.data);
      setStats(statsRes.data);
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

  const handleToggleAssociation = async (association) => {
    try {
      await api.put(`/platform/associations/${association.id}/toggle`);
      loadData();
      Alert.alert('Succès', `Association ${association.active ? 'désactivée' : 'activée'}`);
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de modifier l\'association');
    }
  };

  const handleCreateAssociation = async () => {
    if (!formData.name || !formData.code || !formData.adminEmail || !formData.adminPassword) {
      Alert.alert('Erreur', 'Tous les champs obligatoires doivent être remplis');
      return;
    }

    setCreating(true);
    try {
      const response = await api.post('/platform/associations', formData);
      Alert.alert(
        'Association créée !',
        `Identifiants admin:\nEmail: ${formData.adminEmail}\nMot de passe: ${formData.adminPassword}`,
        [{ text: 'OK' }]
      );
      setCreateModalVisible(false);
      setFormData({
        name: '',
        type: 'association',
        code: '',
        adminEmail: '',
        adminPassword: '',
        adminName: ''
      });
      loadData();
    } catch (error) {
      console.error('Erreur création:', error);
      Alert.alert('Erreur', error.response?.data?.error || 'Erreur lors de la création');
    } finally {
      setCreating(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/platform');
  };

  const handleEditAssociation = (association) => {
    setEditingAssociation(association);
    setEditFormData({
      name: association.name,
      type: association.type
    });
    setEditModalVisible(true);
  };

  const handleSaveEdit = async () => {
    if (!editFormData.name) {
      Alert.alert('Erreur', 'Le nom est requis');
      return;
    }

    try {
      await api.put(`/platform/associations/${editingAssociation.id}`, editFormData);
      Alert.alert('Succès', 'Association modifiée');
      setEditModalVisible(false);
      setEditingAssociation(null);
      loadData();
    } catch (error) {
      console.error('Erreur modification:', error);
      Alert.alert('Erreur', error.response?.data?.error || 'Erreur lors de la modification');
    }
  };

  const handleDeleteAssociation = (association) => {
    if (association.code === 'V1-DEFAULT') {
      Alert.alert('Erreur', 'Impossible de supprimer l\'association par défaut');
      return;
    }
    
    Alert.alert(
      'Supprimer l\'association',
      `Êtes-vous sûr de vouloir supprimer "${association.name}" ?\n\nCette action est irréversible et supprimera toutes les données de l'association.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/platform/associations/${association.id}`);
              Alert.alert('Succès', 'Association supprimée');
              loadData();
            } catch (error) {
              Alert.alert('Erreur', error.response?.data?.error || 'Erreur lors de la suppression');
            }
          }
        }
      ]
    );
  };

  const renderAssociation = ({ item }) => (
    <View style={styles.associationCard}>
      <View style={styles.associationHeader}>
        <View style={[styles.statusDot, { backgroundColor: item.active ? '#4CAF50' : '#F44336' }]} />
        <Text style={styles.associationName}>{item.name}</Text>
      </View>
      
      <View style={styles.associationInfo}>
        <Text style={styles.associationCode}>Code: {item.code}</Text>
        <Text style={styles.associationType}>{item.type}</Text>
      </View>
      
      <View style={styles.associationAdmin}>
        <Ionicons name="person" size={14} color="#666" />
        <Text style={styles.adminEmail}>{item.adminEmail || 'Pas d\'admin'}</Text>
      </View>

      <View style={styles.associationActions}>
        <TouchableOpacity
          style={styles.editButton}
          onPress={() => handleEditAssociation(item)}
        >
          <Ionicons name="pencil" size={16} color="#fff" />
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.actionButton, item.active ? styles.deactivateButton : styles.activateButton]}
          onPress={() => handleToggleAssociation(item)}
        >
          <Ionicons name={item.active ? 'close-circle' : 'checkmark-circle'} size={16} color="#fff" />
          <Text style={styles.actionButtonText}>
            {item.active ? 'Désactiver' : 'Activer'}
          </Text>
        </TouchableOpacity>

        {item.code !== 'V1-DEFAULT' && (
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => handleDeleteAssociation(item)}
          >
            <Ionicons name="trash" size={16} color="#fff" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#9C27B0" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.headerTitle}>Platform Admin</Text>
            <Text style={styles.headerSubtitle}>{superAdmin?.email}</Text>
          </View>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
            <Ionicons name="log-out" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Stats */}
      {stats && (
        <View style={styles.statsContainer}>
          <View style={[styles.statCard, { backgroundColor: '#9C27B0' }]}>
            <Text style={styles.statNumber}>{stats.totalAssociations}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#4CAF50' }]}>
            <Text style={styles.statNumber}>{stats.activeAssociations}</Text>
            <Text style={styles.statLabel}>Actives</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#F44336' }]}>
            <Text style={styles.statNumber}>{stats.inactiveAssociations}</Text>
            <Text style={styles.statLabel}>Inactives</Text>
          </View>
        </View>
      )}

      {/* Liste des associations */}
      <View style={styles.listHeader}>
        <Text style={styles.listTitle}>Associations</Text>
        <TouchableOpacity 
          style={styles.addButton}
          onPress={() => setCreateModalVisible(true)}
        >
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.addButtonText}>Nouvelle</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={associations}
        renderItem={renderAssociation}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <Ionicons name="business-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>Aucune association</Text>
          </View>
        )}
      />

      {/* Modal Création */}
      <Modal
        visible={createModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setCreateModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContainer}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nouvelle Association</Text>
              <TouchableOpacity onPress={() => setCreateModalVisible(false)}>
                <Ionicons name="close" size={28} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Nom de l'association *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ex: Syndicat BNI"
                  value={formData.name}
                  onChangeText={(text) => setFormData({ ...formData, name: text })}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Code unique *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ex: SYNDIC-BNI"
                  value={formData.code}
                  onChangeText={(text) => setFormData({ ...formData, code: text.toUpperCase() })}
                  autoCapitalize="characters"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Type</Text>
                <View style={styles.typeButtons}>
                  {['association', 'syndicat', 'amicale'].map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.typeButton,
                        formData.type === type && styles.typeButtonActive
                      ]}
                      onPress={() => setFormData({ ...formData, type })}
                    >
                      <Text style={[
                        styles.typeButtonText,
                        formData.type === type && styles.typeButtonTextActive
                      ]}>
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.divider}>
                <Text style={styles.dividerText}>Administrateur initial</Text>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Nom de l'admin</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ex: Jean Dupont"
                  value={formData.adminName}
                  onChangeText={(text) => setFormData({ ...formData, adminName: text })}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Email admin *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="admin@association.com"
                  value={formData.adminEmail}
                  onChangeText={(text) => setFormData({ ...formData, adminEmail: text })}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Mot de passe admin *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Mot de passe initial"
                  value={formData.adminPassword}
                  onChangeText={(text) => setFormData({ ...formData, adminPassword: text })}
                />
              </View>

              <TouchableOpacity
                style={[styles.createButton, creating && styles.createButtonDisabled]}
                onPress={handleCreateAssociation}
                disabled={creating}
              >
                {creating ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="add-circle" size={20} color="#fff" />
                    <Text style={styles.createButtonText}>Créer l'association</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal Modification */}
      <Modal
        visible={editModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setEditModalVisible(false);
          setEditingAssociation(null);
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContainer}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Modifier l'association</Text>
              <TouchableOpacity onPress={() => {
                setEditModalVisible(false);
                setEditingAssociation(null);
              }}>
                <Ionicons name="close" size={28} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView>
              {editingAssociation && (
                <>
                  <View style={styles.codeInfoBox}>
                    <Ionicons name="key" size={18} color="#9C27B0" />
                    <Text style={styles.codeInfoText}>
                      Code: <Text style={styles.codeInfoValue}>{editingAssociation.code}</Text>
                    </Text>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Nom de l'association *</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Nom de l'association"
                      value={editFormData.name}
                      onChangeText={(text) => setEditFormData({ ...editFormData, name: text })}
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Type</Text>
                    <View style={styles.typeButtons}>
                      {['association', 'syndicat', 'amicale'].map((type) => (
                        <TouchableOpacity
                          key={type}
                          style={[
                            styles.typeButton,
                            editFormData.type === type && styles.typeButtonActive
                          ]}
                          onPress={() => setEditFormData({ ...editFormData, type })}
                        >
                          <Text style={[
                            styles.typeButtonText,
                            editFormData.type === type && styles.typeButtonTextActive
                          ]}>
                            {type.charAt(0).toUpperCase() + type.slice(1)}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  <View style={styles.adminInfoBox}>
                    <Ionicons name="person" size={18} color="#666" />
                    <Text style={styles.adminInfoText}>
                      Admin: {editingAssociation.adminEmail || 'Non défini'}
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={styles.saveButton}
                    onPress={handleSaveEdit}
                  >
                    <Ionicons name="checkmark-circle" size={20} color="#fff" />
                    <Text style={styles.saveButtonText}>Enregistrer les modifications</Text>
                  </TouchableOpacity>
                </>
              )}
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
  header: {
    backgroundColor: '#9C27B0',
    paddingTop: 48,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#E1BEE7',
    marginTop: 4,
  },
  logoutButton: {
    padding: 8,
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  statLabel: {
    fontSize: 12,
    color: '#fff',
    marginTop: 4,
    opacity: 0.9,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  listTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#9C27B0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 4,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
    paddingTop: 8,
  },
  associationCard: {
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
  associationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  associationName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  associationInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  associationCode: {
    fontSize: 14,
    color: '#9C27B0',
    fontWeight: '500',
  },
  associationType: {
    fontSize: 14,
    color: '#666',
    textTransform: 'capitalize',
  },
  associationAdmin: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 12,
  },
  adminEmail: {
    fontSize: 12,
    color: '#666',
  },
  associationActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  activateButton: {
    backgroundColor: '#4CAF50',
  },
  deactivateButton: {
    backgroundColor: '#F44336',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 16,
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
    maxHeight: '90%',
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
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  typeButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  typeButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
  },
  typeButtonActive: {
    backgroundColor: '#9C27B0',
  },
  typeButtonText: {
    fontSize: 14,
    color: '#666',
  },
  typeButtonTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  divider: {
    marginVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingBottom: 8,
  },
  dividerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9C27B0',
  },
  createButton: {
    flexDirection: 'row',
    backgroundColor: '#9C27B0',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
    marginBottom: 32,
  },
  createButtonDisabled: {
    opacity: 0.6,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

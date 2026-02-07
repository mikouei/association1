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
  
  // Modals
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingAssociation, setEditingAssociation] = useState(null);
  const [creating, setCreating] = useState(false);
  
  // Form data pour création
  const [formData, setFormData] = useState({
    name: '',
    type: 'association',
    code: '',
    adminEmail: '',
    adminPassword: '',
    adminName: ''
  });
  
  // Form data pour édition
  const [editFormData, setEditFormData] = useState({
    name: '',
    type: '',
    adminEmail: ''
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

  // Toggle actif/inactif
  const handleToggleAssociation = async (association) => {
    try {
      await api.put(`/platform/associations/${association.id}/toggle`);
      loadData();
    } catch (error) {
      console.error('Erreur toggle:', error);
      Alert.alert('Erreur', 'Impossible de modifier le statut');
    }
  };

  // Création d'association
  const handleCreateAssociation = async () => {
    if (!formData.name || !formData.code || !formData.adminEmail || !formData.adminPassword) {
      Alert.alert('Erreur', 'Tous les champs marqués * sont requis');
      return;
    }

    setCreating(true);
    try {
      await api.post('/platform/associations', formData);
      Alert.alert('Succès', 'Association créée avec succès');
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

  // Ouvrir modal édition
  const openEditModal = (association) => {
    console.log('Opening edit modal for:', association.name);
    setEditingAssociation(association);
    setEditFormData({
      name: association.name,
      type: association.type || 'association',
      adminEmail: association.adminEmail || ''
    });
    setEditModalVisible(true);
  };

  // Sauvegarder modification
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

  // Supprimer association
  const handleDeleteAssociation = (association) => {
    if (association.code === 'V1-DEFAULT') {
      Alert.alert('Erreur', 'Impossible de supprimer l\'association par défaut');
      return;
    }
    
    Alert.alert(
      'Supprimer l\'association',
      `Êtes-vous sûr de vouloir supprimer "${association.name}" ?`,
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

  // Déconnexion
  const handleLogout = () => {
    Alert.alert(
      'Déconnexion',
      'Voulez-vous vous déconnecter ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Déconnexion',
          onPress: async () => {
            await logout();
            router.replace('/platform');
          }
        }
      ]
    );
  };

  // Rendu d'une association
  const renderAssociation = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={[styles.statusDot, { backgroundColor: item.active ? '#4CAF50' : '#F44336' }]} />
        <Text style={styles.cardTitle}>{item.name}</Text>
      </View>
      
      <View style={styles.cardInfo}>
        <Text style={styles.cardCode}>Code: {item.code}</Text>
        <Text style={styles.cardType}>{item.type || 'association'}</Text>
      </View>
      
      <View style={styles.cardAdmin}>
        <Ionicons name="person" size={14} color="#666" />
        <Text style={styles.adminText}>{item.adminEmail || 'Pas d\'admin'}</Text>
      </View>

      <View style={styles.cardActions}>
        {/* Bouton Modifier */}
        <TouchableOpacity
          style={[styles.actionBtn, styles.editBtn]}
          onPress={() => openEditModal(item)}
          activeOpacity={0.7}
        >
          <Ionicons name="pencil" size={18} color="#fff" />
          <Text style={styles.actionBtnText}>Modifier</Text>
        </TouchableOpacity>

        {/* Bouton Activer/Désactiver */}
        <TouchableOpacity
          style={[styles.actionBtn, item.active ? styles.deactivateBtn : styles.activateBtn]}
          onPress={() => handleToggleAssociation(item)}
          activeOpacity={0.7}
        >
          <Ionicons name={item.active ? "pause" : "play"} size={18} color="#fff" />
          <Text style={styles.actionBtnText}>{item.active ? 'Désactiver' : 'Activer'}</Text>
        </TouchableOpacity>

        {/* Bouton Supprimer (pas pour V1-DEFAULT) */}
        {item.code !== 'V1-DEFAULT' && (
          <TouchableOpacity
            style={[styles.actionBtn, styles.deleteBtn]}
            onPress={() => handleDeleteAssociation(item)}
            activeOpacity={0.7}
          >
            <Ionicons name="trash" size={18} color="#fff" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#9C27B0" />
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Platform Admin</Text>
          <Text style={styles.headerSubtitle}>{superAdmin?.name || superAdmin?.email}</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
          <Ionicons name="log-out" size={24} color="#F44336" />
        </TouchableOpacity>
      </View>

      {/* Stats */}
      {stats && (
        <View style={styles.statsContainer}>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{stats.totalAssociations}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: '#E8F5E9' }]}>
            <Text style={[styles.statNumber, { color: '#4CAF50' }]}>{stats.activeAssociations}</Text>
            <Text style={styles.statLabel}>Actives</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: '#FFEBEE' }]}>
            <Text style={[styles.statNumber, { color: '#F44336' }]}>{stats.inactiveAssociations}</Text>
            <Text style={styles.statLabel}>Inactives</Text>
          </View>
        </View>
      )}

      {/* Bouton Nouvelle Association */}
      <TouchableOpacity
        style={styles.createBtn}
        onPress={() => setCreateModalVisible(true)}
        activeOpacity={0.7}
      >
        <Ionicons name="add-circle" size={24} color="#fff" />
        <Text style={styles.createBtnText}>Nouvelle Association</Text>
      </TouchableOpacity>

      {/* Liste des associations */}
      <FlatList
        data={associations}
        renderItem={renderAssociation}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#9C27B0']} />
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

            <ScrollView style={styles.modalBody}>
              <Text style={styles.inputLabel}>Nom de l'association *</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: Mon Association"
                value={formData.name}
                onChangeText={(text) => setFormData({ ...formData, name: text })}
              />

              <Text style={styles.inputLabel}>Code unique *</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: MON-ASSOC"
                value={formData.code}
                onChangeText={(text) => setFormData({ ...formData, code: text.toUpperCase() })}
                autoCapitalize="characters"
              />

              <Text style={styles.inputLabel}>Type</Text>
              <View style={styles.typeRow}>
                {['association', 'syndicat', 'amicale'].map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[styles.typeBtn, formData.type === type && styles.typeBtnActive]}
                    onPress={() => setFormData({ ...formData, type })}
                  >
                    <Text style={[styles.typeBtnText, formData.type === type && styles.typeBtnTextActive]}>
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.divider}>
                <Text style={styles.dividerText}>Administrateur</Text>
              </View>

              <Text style={styles.inputLabel}>Nom de l'admin</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: Jean Dupont"
                value={formData.adminName}
                onChangeText={(text) => setFormData({ ...formData, adminName: text })}
              />

              <Text style={styles.inputLabel}>Email admin *</Text>
              <TextInput
                style={styles.input}
                placeholder="admin@exemple.com"
                value={formData.adminEmail}
                onChangeText={(text) => setFormData({ ...formData, adminEmail: text })}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <Text style={styles.inputLabel}>Mot de passe *</Text>
              <TextInput
                style={styles.input}
                placeholder="Mot de passe"
                value={formData.adminPassword}
                onChangeText={(text) => setFormData({ ...formData, adminPassword: text })}
              />

              <TouchableOpacity
                style={[styles.submitBtn, creating && styles.submitBtnDisabled]}
                onPress={handleCreateAssociation}
                disabled={creating}
              >
                {creating ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="add-circle" size={20} color="#fff" />
                    <Text style={styles.submitBtnText}>Créer</Text>
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
              <Text style={styles.modalTitle}>Modifier Association</Text>
              <TouchableOpacity onPress={() => {
                setEditModalVisible(false);
                setEditingAssociation(null);
              }}>
                <Ionicons name="close" size={28} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {editingAssociation && (
                <>
                  <View style={styles.codeBox}>
                    <Ionicons name="key" size={18} color="#9C27B0" />
                    <Text style={styles.codeBoxText}>Code: {editingAssociation.code}</Text>
                  </View>

                  <Text style={styles.inputLabel}>Nom de l'association *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Nom"
                    value={editFormData.name}
                    onChangeText={(text) => setEditFormData({ ...editFormData, name: text })}
                  />

                  <Text style={styles.inputLabel}>Type</Text>
                  <View style={styles.typeRow}>
                    {['association', 'syndicat', 'amicale'].map((type) => (
                      <TouchableOpacity
                        key={type}
                        style={[styles.typeBtn, editFormData.type === type && styles.typeBtnActive]}
                        onPress={() => setEditFormData({ ...editFormData, type })}
                      >
                        <Text style={[styles.typeBtnText, editFormData.type === type && styles.typeBtnTextActive]}>
                          {type.charAt(0).toUpperCase() + type.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={styles.inputLabel}>Email admin</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Email admin"
                    value={editFormData.adminEmail}
                    onChangeText={(text) => setEditFormData({ ...editFormData, adminEmail: text })}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />

                  <TouchableOpacity
                    style={styles.saveBtn}
                    onPress={handleSaveEdit}
                  >
                    <Ionicons name="checkmark-circle" size={20} color="#fff" />
                    <Text style={styles.saveBtnText}>Enregistrer</Text>
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
  loadingText: {
    marginTop: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#9C27B0',
    padding: 20,
    paddingTop: 50,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  logoutBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    padding: 10,
    borderRadius: 8,
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  createBtn: {
    flexDirection: 'row',
    backgroundColor: '#9C27B0',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  createBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 10,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  cardInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  cardCode: {
    fontSize: 14,
    color: '#9C27B0',
    fontWeight: '500',
  },
  cardType: {
    fontSize: 14,
    color: '#666',
    textTransform: 'capitalize',
  },
  cardAdmin: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  adminText: {
    fontSize: 13,
    color: '#666',
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 12,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 6,
  },
  actionBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
  },
  editBtn: {
    backgroundColor: '#2196F3',
  },
  activateBtn: {
    backgroundColor: '#4CAF50',
  },
  deactivateBtn: {
    backgroundColor: '#FF9800',
  },
  deleteBtn: {
    backgroundColor: '#F44336',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: '#999',
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  modalBody: {
    padding: 20,
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
    padding: 14,
    fontSize: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  typeRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  typeBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  typeBtnActive: {
    backgroundColor: '#F3E5F5',
    borderColor: '#9C27B0',
  },
  typeBtnText: {
    color: '#666',
    fontWeight: '500',
  },
  typeBtnTextActive: {
    color: '#9C27B0',
  },
  divider: {
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 16,
    marginTop: 8,
    marginBottom: 16,
  },
  dividerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  submitBtn: {
    flexDirection: 'row',
    backgroundColor: '#9C27B0',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
    marginBottom: 30,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  codeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3E5F5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
  },
  codeBoxText: {
    fontSize: 14,
    color: '#9C27B0',
    fontWeight: '500',
  },
  saveBtn: {
    flexDirection: 'row',
    backgroundColor: '#4CAF50',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
    marginBottom: 30,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

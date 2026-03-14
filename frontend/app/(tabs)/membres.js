import React, { useEffect, useState, useCallback } from 'react';
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
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import api from '../../utils/api';
import { useFocusEffect } from '@react-navigation/native';

export default function Membres() {
  const { user, association } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  
  const [members, setMembers] = useState([]);
  const [filteredMembers, setFilteredMembers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [config, setConfig] = useState(null);
  const [associationSettings, setAssociationSettings] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    customFieldValue: '',
    email: '',
    phone: '',
    password: ''
  });
  const [saving, setSaving] = useState(false);
  
  // Reset password modal
  const [resetPasswordModal, setResetPasswordModal] = useState(false);
  const [resetPasswordMember, setResetPasswordMember] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [resettingPassword, setResettingPassword] = useState(false);

  // Vehicle plates modal
  const [vehicleModalVisible, setVehicleModalVisible] = useState(false);
  const [selectedMemberForVehicle, setSelectedMemberForVehicle] = useState(null);
  const [memberVehicles, setMemberVehicles] = useState([]);
  const [newPlateNumber, setNewPlateNumber] = useState('');
  const [newPlateDescription, setNewPlateDescription] = useState('');
  const [loadingVehicles, setLoadingVehicles] = useState(false);
  const [savingVehicle, setSavingVehicle] = useState(false);

  // Recharger les données à chaque fois que l'onglet Membres est affiché
  useFocusEffect(
    useCallback(() => {
      loadMembers();
      loadConfig();
      loadAssociationSettings();
    }, [])
  );

  useEffect(() => {
    filterMembers();
  }, [search, members]);

  const loadConfig = async () => {
    try {
      const response = await api.get('/config');
      setConfig(response.data);
    } catch (error) {
      console.error('Erreur chargement config:', error);
    }
  };

  const loadAssociationSettings = async () => {
    try {
      // Charger les paramètres de l'association depuis la plateforme
      if (association?.id) {
        const response = await api.get(`/auth/association-settings`);
        setAssociationSettings(response.data);
      }
    } catch (error) {
      console.error('Erreur chargement paramètres association:', error);
    }
  };

  const loadMembers = async () => {
    try {
      const response = await api.get('/members');
      setMembers(response.data);
      setFilteredMembers(response.data);
    } catch (error) {
      console.error('Erreur chargement membres:', error);
      Alert.alert('Erreur', 'Impossible de charger les membres');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const filterMembers = () => {
    if (!search.trim()) {
      setFilteredMembers(members);
      return;
    }

    const filtered = members.filter(
      (member) =>
        member.name?.toLowerCase().includes(search.toLowerCase()) ||
        member.customFieldValue?.toLowerCase().includes(search.toLowerCase())
    );
    setFilteredMembers(filtered);
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadMembers();
  };

  const handleAddMember = () => {
    setEditingMember(null);
    setFormData({
      name: '',
      customFieldValue: '',
      email: '',
      phone: '',
      password: ''
    });
    setModalVisible(true);
  };

  const handleEditMember = (member) => {
    setEditingMember(member);
    setFormData({
      name: member.name,
      customFieldValue: member.customFieldValue,
      email: member.email || '',
      phone: member.phone || '',
      password: ''
    });
    setModalVisible(true);
  };

  const handleSaveMember = async () => {
    if (!formData.name || !formData.customFieldValue) {
      Alert.alert('Erreur', 'Nom et champ personnalisé requis');
      return;
    }

    if (!editingMember && !formData.email && !formData.phone) {
      Alert.alert('Erreur', 'Email ou téléphone requis');
      return;
    }

    setSaving(true);
    try {
      if (editingMember) {
        // Modification
        await api.put(`/members/${editingMember.id}`, {
          name: formData.name,
          customFieldValue: formData.customFieldValue,
          email: formData.email,
          phone: formData.phone
        });
        Alert.alert('Succès', 'Membre modifié avec succès');
      } else {
        // Création
        const response = await api.post('/members', formData);
        Alert.alert(
          'Membre créé!',
          `Nom: ${response.data.name}\nEmail: ${response.data.email}\nMot de passe: ${response.data.password}\nToken: ${response.data.token}`,
          [{ text: 'OK' }]
        );
      }
      setModalVisible(false);
      loadMembers();
    } catch (error) {
      console.error('Erreur sauvegarde:', error);
      Alert.alert('Erreur', error.response?.data?.error || 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = (member) => {
    const action = member.active ? 'désactiver' : 'réactiver';
    Alert.alert(
      'Confirmation',
      `Voulez-vous ${action} ce membre ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          onPress: async () => {
            try {
              const endpoint = member.active ? 'deactivate' : 'activate';
              await api.put(`/members/${member.id}/${endpoint}`);
              loadMembers();
            } catch (error) {
              Alert.alert('Erreur', 'Impossible de modifier le statut');
            }
          }
        }
      ]
    );
  };

  const handleResetPassword = (member) => {
    setResetPasswordMember(member);
    setNewPassword('');
    setResetPasswordModal(true);
  };

  const confirmResetPassword = async () => {
    if (!newPassword || newPassword.length < 4) {
      Alert.alert('Erreur', 'Mot de passe trop court (minimum 4 caractères)');
      return;
    }
    
    setResettingPassword(true);
    try {
      await api.post(`/members/${resetPasswordMember.id}/reset-password`, { newPassword });
      Alert.alert('Succès', `Nouveau mot de passe: ${newPassword}`);
      setResetPasswordModal(false);
      setNewPassword('');
      setResetPasswordMember(null);
    } catch (error) {
      console.error('Erreur reset password:', error);
      Alert.alert('Erreur', error.response?.data?.error || 'Erreur lors de la réinitialisation');
    } finally {
      setResettingPassword(false);
    }
  };

  const handleDeleteMember = (member) => {
    Alert.alert(
      'Supprimer le membre',
      `Voulez-vous vraiment supprimer "${member.name}" ?\n\nCette action supprimera aussi tous ses paiements et ne peut pas être annulée.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/members/${member.id}`);
              Alert.alert('Succès', 'Membre supprimé avec succès');
              loadMembers();
            } catch (error) {
              console.error('Erreur suppression:', error);
              Alert.alert('Erreur', error.response?.data?.error || 'Impossible de supprimer le membre');
            }
          }
        }
      ]
    );
  };

  // ========== GESTION DES MATRICULES ==========
  const openVehicleModal = async (member) => {
    setSelectedMemberForVehicle(member);
    setVehicleModalVisible(true);
    setLoadingVehicles(true);
    try {
      const response = await api.get(`/vehicles/member/${member.id}`);
      setMemberVehicles(response.data);
    } catch (error) {
      console.error('Erreur chargement véhicules:', error);
      setMemberVehicles([]);
    } finally {
      setLoadingVehicles(false);
    }
  };

  const handleAddVehicle = async () => {
    if (!newPlateNumber.trim()) {
      Alert.alert('Erreur', 'Numéro de plaque requis');
      return;
    }
    
    setSavingVehicle(true);
    try {
      await api.post('/vehicles', {
        memberId: selectedMemberForVehicle.id,
        plateNumber: newPlateNumber.trim(),
        description: newPlateDescription.trim() || null
      });
      
      // Recharger les véhicules
      const response = await api.get(`/vehicles/member/${selectedMemberForVehicle.id}`);
      setMemberVehicles(response.data);
      setNewPlateNumber('');
      setNewPlateDescription('');
      Alert.alert('Succès', 'Matricule ajouté');
    } catch (error) {
      console.error('Erreur ajout véhicule:', error);
      Alert.alert('Erreur', error.response?.data?.error || 'Erreur lors de l\'ajout');
    } finally {
      setSavingVehicle(false);
    }
  };

  const handleDeleteVehicle = (vehicle) => {
    Alert.alert(
      'Supprimer le matricule',
      `Supprimer "${vehicle.plateNumber}" ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/vehicles/${vehicle.id}`);
              const response = await api.get(`/vehicles/member/${selectedMemberForVehicle.id}`);
              setMemberVehicles(response.data);
            } catch (error) {
              Alert.alert('Erreur', 'Impossible de supprimer');
            }
          }
        }
      ]
    );
  };
  // ========== FIN GESTION DES MATRICULES ==========

  const renderMember = ({ item }) => (
    <TouchableOpacity
      style={styles.memberCard}
      onPress={() => isAdmin && handleEditMember(item)}
      onLongPress={() => isAdmin && handleToggleActive(item)}
    >
      <View style={styles.memberHeader}>
        <View style={styles.memberIcon}>
          <Ionicons name="person" size={24} color="#2196F3" />
        </View>
        <View style={styles.memberInfo}>
          <Text style={styles.memberName}>{item.name}</Text>
          <Text style={styles.memberField}>
            {config?.memberFieldLabel || associationSettings?.customFieldLabel || 'Villa'}: {item.customFieldValue}
          </Text>
          {item.phone && <Text style={styles.memberPhone}>{item.phone}</Text>}
        </View>
        {/* Bouton Matricules (visible si activé) */}
        {isAdmin && associationSettings?.enableVehiclePlates && (
          <TouchableOpacity
            style={styles.vehicleButton}
            onPress={() => openVehicleModal(item)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="car" size={20} color="#9C27B0" />
          </TouchableOpacity>
        )}
        {isAdmin && (
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => handleDeleteMember(item)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="trash-outline" size={20} color="#FF5252" />
          </TouchableOpacity>
        )}
        <View style={styles.memberStatus}>
          <Ionicons
            name={item.active ? 'checkmark-circle' : 'close-circle'}
            size={24}
            color={item.active ? '#4CAF50' : '#FF5252'}
          />
        </View>
        </View>
      </View>
    </TouchableOpacity>
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
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Rechercher un membre..."
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      <FlatList
        data={filteredMembers}
        renderItem={renderMember}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>Aucun membre trouvé</Text>
          </View>
        )}
      />

      {isAdmin && (
        <TouchableOpacity style={styles.fab} onPress={handleAddMember}>
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
      )}

      {/* Modal Ajout/Modification */}
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
              <Text style={styles.modalTitle}>
                {editingMember ? 'Modifier membre' : 'Nouveau membre'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={28} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView>
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Nom complet *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ex: Jean Dupont"
                  value={formData.name}
                  onChangeText={(text) => setFormData({ ...formData, name: text })}
                  autoCapitalize="words"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>{config?.memberFieldLabel || 'Villa'} *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ex: Villa 12"
                  value={formData.customFieldValue}
                  onChangeText={(text) => setFormData({ ...formData, customFieldValue: text })}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  style={styles.input}
                  placeholder="email@exemple.com"
                  value={formData.email}
                  onChangeText={(text) => setFormData({ ...formData, email: text })}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Téléphone</Text>
                <TextInput
                  style={styles.input}
                  placeholder="+237 6XX XX XX XX"
                  value={formData.phone}
                  onChangeText={(text) => setFormData({ ...formData, phone: text })}
                  keyboardType="phone-pad"
                />
              </View>

              {!editingMember && (
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Mot de passe (optionnel)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Laisser vide pour auto-génération"
                    value={formData.password}
                    onChangeText={(text) => setFormData({ ...formData, password: text })}
                    secureTextEntry
                  />
                </View>
              )}

              {editingMember && (
                <TouchableOpacity
                  style={styles.resetPasswordButton}
                  onPress={() => {
                    setModalVisible(false);
                    setTimeout(() => handleResetPassword(editingMember), 300);
                  }}
                >
                  <Ionicons name="key" size={20} color="#FF9800" />
                  <Text style={styles.resetPasswordText}>Réinitialiser le mot de passe</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.submitButton, saving && styles.submitButtonDisabled]}
                onPress={handleSaveMember}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitButtonText}>
                    {editingMember ? 'Modifier' : 'Créer'}
                  </Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal Reset Password */}
      <Modal
        visible={resetPasswordModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setResetPasswordModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.resetModalContainer}
        >
          <View style={styles.resetModalContent}>
            <View style={styles.resetModalHeader}>
              <Ionicons name="key" size={40} color="#FF9800" />
              <Text style={styles.resetModalTitle}>Réinitialiser le mot de passe</Text>
              {resetPasswordMember && (
                <Text style={styles.resetModalSubtitle}>{resetPasswordMember.name}</Text>
              )}
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Nouveau mot de passe</Text>
              <TextInput
                style={styles.input}
                placeholder="Minimum 4 caractères"
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
                autoFocus
              />
            </View>

            <View style={styles.resetModalButtons}>
              <TouchableOpacity
                style={styles.resetCancelButton}
                onPress={() => {
                  setResetPasswordModal(false);
                  setNewPassword('');
                }}
              >
                <Text style={styles.resetCancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.resetConfirmButton, resettingPassword && styles.submitButtonDisabled]}
                onPress={confirmResetPassword}
                disabled={resettingPassword}
              >
                {resettingPassword ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.resetConfirmText}>Confirmer</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal Gestion des Matricules */}
      <Modal
        visible={vehicleModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setVehicleModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContainer}
        >
          <View style={styles.vehicleModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                <Ionicons name="car" size={24} color="#9C27B0" /> Matricules
              </Text>
              <TouchableOpacity onPress={() => setVehicleModalVisible(false)}>
                <Ionicons name="close" size={28} color="#666" />
              </TouchableOpacity>
            </View>

            {selectedMemberForVehicle && (
              <Text style={styles.vehicleMemberName}>{selectedMemberForVehicle.name}</Text>
            )}

            {loadingVehicles ? (
              <ActivityIndicator size="large" color="#9C27B0" style={{ marginVertical: 30 }} />
            ) : (
              <>
                {/* Liste des matricules existants */}
                <ScrollView style={styles.vehicleList}>
                  {memberVehicles.length === 0 ? (
                    <View style={styles.noVehicles}>
                      <Ionicons name="car-outline" size={48} color="#ccc" />
                      <Text style={styles.noVehiclesText}>Aucun matricule enregistré</Text>
                    </View>
                  ) : (
                    memberVehicles.map((vehicle) => (
                      <View key={vehicle.id} style={styles.vehicleItem}>
                        <View style={styles.vehicleInfo}>
                          <Text style={styles.vehiclePlate}>{vehicle.plateNumber}</Text>
                          {vehicle.description && (
                            <Text style={styles.vehicleDesc}>{vehicle.description}</Text>
                          )}
                        </View>
                        <TouchableOpacity
                          onPress={() => handleDeleteVehicle(vehicle)}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                          <Ionicons name="trash-outline" size={20} color="#FF5252" />
                        </TouchableOpacity>
                      </View>
                    ))
                  )}
                </ScrollView>

                {/* Formulaire d'ajout */}
                <View style={styles.addVehicleForm}>
                  <Text style={styles.addVehicleTitle}>Ajouter un matricule</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Numéro de plaque (ex: AB-1234-CD)"
                    value={newPlateNumber}
                    onChangeText={setNewPlateNumber}
                    autoCapitalize="characters"
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Description (optionnel)"
                    value={newPlateDescription}
                    onChangeText={setNewPlateDescription}
                  />
                  <TouchableOpacity
                    style={[styles.addVehicleButton, savingVehicle && styles.submitButtonDisabled]}
                    onPress={handleAddVehicle}
                    disabled={savingVehicle}
                  >
                    {savingVehicle ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <>
                        <Ionicons name="add" size={20} color="#fff" />
                        <Text style={styles.addVehicleButtonText}>Ajouter</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    margin: 16,
    paddingHorizontal: 16,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 80,
  },
  memberCard: {
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
  memberHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  memberField: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  memberPhone: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  memberStatus: {
    marginLeft: 8,
  },
  deleteButton: {
    padding: 8,
    marginLeft: 4,
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
  resetPasswordButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF3E0',
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FF9800',
  },
  resetPasswordText: {
    color: '#FF9800',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
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
  resetModalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  resetModalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '85%',
    maxWidth: 340,
  },
  resetModalHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  resetModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 12,
  },
  resetModalSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  resetModalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  resetCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
  },
  resetCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  resetConfirmButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#FF9800',
    alignItems: 'center',
  },
  resetConfirmText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  // Styles pour les matricules
  vehicleButton: {
    padding: 8,
    marginRight: 8,
  },
  vehicleModalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  vehicleMemberName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginBottom: 16,
  },
  vehicleList: {
    maxHeight: 200,
    marginBottom: 16,
  },
  noVehicles: {
    alignItems: 'center',
    padding: 30,
  },
  noVehiclesText: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
  },
  vehicleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  vehicleInfo: {
    flex: 1,
  },
  vehiclePlate: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    letterSpacing: 1,
  },
  vehicleDesc: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  addVehicleForm: {
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingTop: 16,
  },
  addVehicleTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  addVehicleButton: {
    flexDirection: 'row',
    backgroundColor: '#9C27B0',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  addVehicleButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});

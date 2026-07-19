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
import { 
  User, 
  MagnifyingGlass, 
  Plus, 
  Trash, 
  Car,
  CheckCircle,
  XCircle,
  X,
  CheckSquare,
  Square,
  Key,
  UsersThree
} from 'phosphor-react-native';
import api from '../../utils/api';
import { useFocusEffect } from '@react-navigation/native';
import { formatNumber, formatCurrency } from '../../utils/format';
import { colors, spacing, borderRadius, typography } from '../../utils/theme';

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
  
  // Selection mode for bulk delete
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [deletingBulk, setDeletingBulk] = useState(false);
  
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

  // Charger les données au montage initial
  useEffect(() => {
    loadMembers();
    loadConfig();
    loadAssociationSettings();
  }, []);

  // Recharger les données à chaque fois que l'onglet Membres est affiché
  useFocusEffect(
    useCallback(() => {
      refreshMembers();
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

  // Fonction pour charger les membres (premier chargement)
  const loadMembers = async () => {
    try {
      setLoading(true);
      const response = await api.get('/members');
      setMembers(response.data || []);
      setFilteredMembers(response.data || []);
    } catch (error) {
      console.error('Erreur chargement membres:', error);
      setMembers([]);
      setFilteredMembers([]);
      Alert.alert('Erreur', 'Impossible de charger les membres');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Fonction pour rafraîchir les membres (après create/update/delete)
  const refreshMembers = async () => {
    try {
      const response = await api.get('/members');
      setMembers(response.data || []);
      setFilteredMembers(response.data || []);
    } catch (error) {
      console.error('Erreur rafraîchissement membres:', error);
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
      await refreshMembers();
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
              await refreshMembers();
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
              await refreshMembers();
            } catch (error) {
              console.error('Erreur suppression:', error);
              Alert.alert('Erreur', error.response?.data?.error || 'Impossible de supprimer le membre');
            }
          }
        }
      ]
    );
  };

  // ========== GESTION SÉLECTION MULTIPLE ==========
  const toggleSelectionMode = () => {
    if (selectionMode) {
      // Quitter le mode sélection
      setSelectionMode(false);
      setSelectedMembers([]);
    } else {
      // Activer le mode sélection
      setSelectionMode(true);
      setSelectedMembers([]);
    }
  };

  const toggleMemberSelection = (memberId) => {
    setSelectedMembers(prev => {
      if (prev.includes(memberId)) {
        return prev.filter(id => id !== memberId);
      } else {
        return [...prev, memberId];
      }
    });
  };

  const selectAllMembers = () => {
    if (selectedMembers.length === filteredMembers.length) {
      // Désélectionner tout
      setSelectedMembers([]);
    } else {
      // Sélectionner tout
      setSelectedMembers(filteredMembers.map(m => m.id));
    }
  };

  const handleBulkDelete = () => {
    if (selectedMembers.length === 0) {
      Alert.alert('Info', 'Aucun membre sélectionné');
      return;
    }

    Alert.alert(
      'Supprimer les membres sélectionnés',
      `Voulez-vous vraiment supprimer ${selectedMembers.length} membre(s) ?\n\nCette action supprimera aussi tous leurs paiements et ne peut pas être annulée.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            setDeletingBulk(true);
            try {
              await api.delete('/members/bulk-delete', { 
                data: { ids: selectedMembers } 
              });
              Alert.alert('Succès', `${selectedMembers.length} membre(s) supprimé(s)`);
              setSelectionMode(false);
              setSelectedMembers([]);
              await refreshMembers();
            } catch (error) {
              console.error('Erreur suppression multiple:', error);
              Alert.alert('Erreur', error.response?.data?.error || 'Impossible de supprimer les membres');
            } finally {
              setDeletingBulk(false);
            }
          }
        }
      ]
    );
  };
  // ========== FIN GESTION SÉLECTION MULTIPLE ==========

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

  const renderMember = ({ item }) => {
    const isSelected = selectedMembers.includes(item.id);
    
    return (
      <TouchableOpacity
        style={[styles.memberCard, isSelected && styles.memberCardSelected]}
        onPress={() => {
          if (selectionMode) {
            toggleMemberSelection(item.id);
          } else if (isAdmin) {
            handleEditMember(item);
          }
        }}
        onLongPress={() => {
          if (!selectionMode && isAdmin) {
            setSelectionMode(true);
            setSelectedMembers([item.id]);
          }
        }}
      >
        <View style={styles.memberHeader}>
          {/* Checkbox en mode sélection */}
          {selectionMode && (
            <TouchableOpacity
              style={styles.checkboxContainer}
              onPress={() => toggleMemberSelection(item.id)}
            >
              {isSelected ? (
                <CheckSquare size={24} color={colors.primary} weight="fill" />
              ) : (
                <Square size={24} color={colors.textMuted} />
              )}
            </TouchableOpacity>
          )}
          
          <View style={styles.memberIcon}>
            <User size={24} color={colors.primary} weight="fill" />
          </View>
          <View style={styles.memberInfo}>
            <Text style={styles.memberName}>{item.name}</Text>
            <Text style={styles.memberField}>
              {config?.memberFieldLabel || associationSettings?.customFieldLabel || 'Villa'}: {item.customFieldValue}
            </Text>
            {item.phone && <Text style={styles.memberPhone}>{item.phone}</Text>}
          </View>
          
          {/* Actions (cachées en mode sélection) */}
          {!selectionMode && (
            <>
              {/* Bouton Matricules (visible si activé) */}
              {isAdmin && associationSettings?.enableVehiclePlates && (
                <TouchableOpacity
                  style={styles.vehicleButton}
                  onPress={() => openVehicleModal(item)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Car size={22} color={colors.accentTerracotta} weight="fill" />
                </TouchableOpacity>
              )}
              {isAdmin && (
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => handleDeleteMember(item)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Trash size={20} color={colors.error} />
                </TouchableOpacity>
              )}
            </>
          )}
          
          <View style={styles.memberStatus}>
            {item.active ? (
              <CheckCircle size={24} color={colors.success} weight="fill" />
            ) : (
              <XCircle size={24} color={colors.error} weight="fill" />
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Barre de sélection (visible en mode sélection) */}
      {selectionMode && (
        <View style={styles.selectionBar}>
          <TouchableOpacity style={styles.selectionButton} onPress={toggleSelectionMode}>
            <X size={24} color={colors.textMuted} />
          </TouchableOpacity>
          <Text style={styles.selectionText}>
            {selectedMembers.length} sélectionné(s)
          </Text>
          <TouchableOpacity style={styles.selectionButton} onPress={selectAllMembers}>
            {selectedMembers.length === filteredMembers.length ? (
              <CheckSquare size={24} color={colors.primary} weight="fill" />
            ) : (
              <Square size={24} color={colors.primary} />
            )}
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.deleteSelectionButton, selectedMembers.length === 0 && styles.deleteSelectionButtonDisabled]}
            onPress={handleBulkDelete}
            disabled={selectedMembers.length === 0 || deletingBulk}
          >
            {deletingBulk ? (
              <ActivityIndicator size="small" color={colors.textOnSecondary} />
            ) : (
              <>
                <Trash size={18} color={colors.textOnSecondary} />
                <Text style={styles.deleteSelectionText}>Supprimer</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Bouton pour activer le mode sélection (Admin uniquement) */}
      {isAdmin && !selectionMode && (
        <View style={styles.actionBar}>
          <TouchableOpacity style={styles.selectModeButton} onPress={toggleSelectionMode}>
            <CheckSquare size={20} color={colors.primary} />
            <Text style={styles.selectModeText}>Sélection multiple</Text>
          </TouchableOpacity>
          <Text style={styles.memberCount}>{filteredMembers.length} membre(s)</Text>
        </View>
      )}

      <View style={styles.searchContainer}>
        <MagnifyingGlass size={20} color={colors.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Rechercher un membre..."
          placeholderTextColor={colors.textMuted}
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
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <UsersThree size={64} color={colors.border} />
            <Text style={styles.emptyText}>Aucun membre trouvé</Text>
          </View>
        )}
      />

      {isAdmin && !selectionMode && (
        <TouchableOpacity style={styles.fab} onPress={handleAddMember}>
          <Plus size={28} color={colors.textOnPrimary} weight="bold" />
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
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingMember ? 'Modifier membre' : 'Nouveau membre'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X size={28} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView 
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={true}
              contentContainerStyle={styles.modalScrollContent}
            >
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Nom complet *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ex: Jean Dupont"
                  placeholderTextColor={colors.textMuted}
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
                  placeholderTextColor={colors.textMuted}
                  value={formData.customFieldValue}
                  onChangeText={(text) => setFormData({ ...formData, customFieldValue: text })}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Téléphone</Text>
                <TextInput
                  style={styles.input}
                  placeholder="+237 6XX XX XX XX"
                  placeholderTextColor={colors.textMuted}
                  value={formData.phone}
                  onChangeText={(text) => setFormData({ ...formData, phone: text })}
                  keyboardType="phone-pad"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  style={styles.input}
                  placeholder="email@exemple.com"
                  placeholderTextColor={colors.textMuted}
                  value={formData.email}
                  onChangeText={(text) => setFormData({ ...formData, email: text })}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              {!editingMember && (
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Mot de passe (optionnel)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Laisser vide pour auto-génération"
                    placeholderTextColor={colors.textMuted}
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
                  <Key size={20} color={colors.warning} weight="fill" />
                  <Text style={styles.resetPasswordText}>Réinitialiser le mot de passe</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.submitButton, saving && styles.submitButtonDisabled]}
                onPress={handleSaveMember}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color={colors.textOnPrimary} />
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
              <Key size={40} color={colors.warning} weight="fill" />
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
                placeholderTextColor={colors.textMuted}
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
                  <ActivityIndicator color={colors.textOnSecondary} size="small" />
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
              <View style={styles.modalTitleRow}>
                <Car size={24} color={colors.accentTerracotta} weight="fill" />
                <Text style={styles.modalTitle}> Matricules</Text>
              </View>
              <TouchableOpacity onPress={() => setVehicleModalVisible(false)}>
                <X size={28} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {selectedMemberForVehicle && (
              <Text style={styles.vehicleMemberName}>{selectedMemberForVehicle.name}</Text>
            )}

            {loadingVehicles ? (
              <ActivityIndicator size="large" color={colors.accentTerracotta} style={{ marginVertical: 30 }} />
            ) : (
              <>
                {/* Liste des matricules existants */}
                <ScrollView style={styles.vehicleList}>
                  {memberVehicles.length === 0 ? (
                    <View style={styles.noVehicles}>
                      <Car size={48} color={colors.border} />
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
                          <Trash size={20} color={colors.error} />
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
                    placeholderTextColor={colors.textMuted}
                    value={newPlateNumber}
                    onChangeText={setNewPlateNumber}
                    autoCapitalize="characters"
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Description (optionnel)"
                    placeholderTextColor={colors.textMuted}
                    value={newPlateDescription}
                    onChangeText={setNewPlateDescription}
                  />
                  <TouchableOpacity
                    style={[styles.addVehicleButton, savingVehicle && styles.submitButtonDisabled]}
                    onPress={handleAddVehicle}
                    disabled={savingVehicle}
                  >
                    {savingVehicle ? (
                      <ActivityIndicator color={colors.textOnSecondary} />
                    ) : (
                      <>
                        <Plus size={20} color={colors.textOnSecondary} weight="bold" />
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
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundWhite,
    margin: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.button,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.md,
    fontSize: typography.body.fontSize,
    color: colors.text,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 80,
  },
  memberCard: {
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
  memberHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.warningBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: typography.body.fontSize,
    fontWeight: '600',
    color: colors.text,
  },
  memberField: {
    fontSize: typography.caption.fontSize + 1,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  memberPhone: {
    fontSize: typography.caption.fontSize,
    color: colors.textMuted,
    marginTop: 2,
  },
  memberStatus: {
    marginLeft: spacing.sm,
  },
  deleteButton: {
    padding: spacing.sm,
    marginLeft: spacing.xs,
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
  modalScrollContent: {
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
  resetPasswordButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.warningBg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.button,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.warning,
    gap: spacing.sm,
  },
  resetPasswordText: {
    color: colors.warning,
    fontSize: typography.caption.fontSize + 1,
    fontWeight: '600',
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
  resetModalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  resetModalContent: {
    backgroundColor: colors.backgroundWhite,
    borderRadius: borderRadius.card,
    padding: spacing.xl,
    width: '85%',
    maxWidth: 340,
  },
  resetModalHeader: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  resetModalTitle: {
    fontSize: typography.h3.fontSize + 2,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: spacing.md,
  },
  resetModalSubtitle: {
    fontSize: typography.caption.fontSize + 1,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  resetModalButtons: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  resetCancelButton: {
    flex: 1,
    paddingVertical: spacing.md + 2,
    borderRadius: borderRadius.button,
    backgroundColor: colors.borderLight,
    alignItems: 'center',
  },
  resetCancelText: {
    fontSize: typography.body.fontSize,
    fontWeight: '600',
    color: colors.textMuted,
  },
  resetConfirmButton: {
    flex: 1,
    paddingVertical: spacing.md + 2,
    borderRadius: borderRadius.button,
    backgroundColor: colors.warning,
    alignItems: 'center',
  },
  resetConfirmText: {
    fontSize: typography.body.fontSize,
    fontWeight: '600',
    color: colors.textOnSecondary,
  },
  // Styles pour les matricules
  vehicleButton: {
    padding: spacing.sm,
    marginRight: spacing.sm,
  },
  vehicleModalContent: {
    backgroundColor: colors.backgroundWhite,
    borderTopLeftRadius: borderRadius.card,
    borderTopRightRadius: borderRadius.card,
    padding: spacing.xl,
    maxHeight: '80%',
  },
  vehicleMemberName: {
    fontSize: typography.body.fontSize,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  vehicleList: {
    maxHeight: 200,
    marginBottom: spacing.lg,
  },
  noVehicles: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  noVehiclesText: {
    fontSize: typography.caption.fontSize + 1,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  vehicleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.borderLight,
    padding: spacing.md,
    borderRadius: borderRadius.button,
    marginBottom: spacing.sm,
  },
  vehicleInfo: {
    flex: 1,
  },
  vehiclePlate: {
    fontSize: typography.body.fontSize,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: 1,
  },
  vehicleDesc: {
    fontSize: typography.caption.fontSize,
    color: colors.textMuted,
    marginTop: 2,
  },
  addVehicleForm: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.lg,
  },
  addVehicleTitle: {
    fontSize: typography.caption.fontSize + 1,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.md,
  },
  addVehicleButton: {
    flexDirection: 'row',
    backgroundColor: colors.accentTerracotta,
    paddingVertical: spacing.md + 2,
    borderRadius: borderRadius.button,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  addVehicleButtonText: {
    fontSize: typography.body.fontSize,
    fontWeight: '600',
    color: colors.textOnSecondary,
  },
  // Styles pour la sélection multiple
  selectionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warningBg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  selectionButton: {
    padding: spacing.sm,
  },
  selectionText: {
    flex: 1,
    fontSize: typography.body.fontSize,
    fontWeight: '600',
    color: colors.secondary,
    marginLeft: spacing.sm,
  },
  deleteSelectionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.error,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.badge,
    gap: spacing.xs,
  },
  deleteSelectionButtonDisabled: {
    opacity: 0.5,
  },
  deleteSelectionText: {
    color: colors.textOnSecondary,
    fontSize: typography.caption.fontSize + 1,
    fontWeight: '600',
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  selectModeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  selectModeText: {
    fontSize: typography.caption.fontSize + 1,
    color: colors.primary,
    fontWeight: '500',
  },
  memberCount: {
    fontSize: typography.caption.fontSize + 1,
    color: colors.textMuted,
  },
  memberCardSelected: {
    backgroundColor: colors.warningBg,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  checkboxContainer: {
    marginRight: spacing.md,
  },
});

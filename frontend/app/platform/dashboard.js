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
import { 
  User, Pencil, Trash, Buildings, Plus, Play, Pause, X, Key, UserCircle,
  UsersThree, SignOut, ShieldCheck, PlusCircle, CheckCircle, Car
} from 'phosphor-react-native';
import { usePlatformAuth } from '../../context/PlatformAuthContext';
import api from '../../utils/api';
import { colors, spacing, borderRadius, typography } from '../../utils/theme';

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
    adminEmail: '',
    enableVehiclePlates: false,
    customFieldLabel: 'Villa'
  });
  
  // Gestion des admins
  const [adminsModalVisible, setAdminsModalVisible] = useState(false);
  const [selectedAssociationForAdmins, setSelectedAssociationForAdmins] = useState(null);
  const [admins, setAdmins] = useState([]);
  const [loadingAdmins, setLoadingAdmins] = useState(false);
  const [newAdminData, setNewAdminData] = useState({ email: '', password: '', phone: '' });
  const [changePasswordData, setChangePasswordData] = useState({ adminId: null, password: '' });

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
      adminEmail: association.adminEmail || '',
      enableVehiclePlates: association.enableVehiclePlates || false,
      customFieldLabel: association.customFieldLabel || 'Villa'
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

  // ============ GESTION DES ADMINS ============
  
  // Ouvrir modal admins
  const openAdminsModal = async (association) => {
    setSelectedAssociationForAdmins(association);
    setAdminsModalVisible(true);
    setLoadingAdmins(true);
    
    try {
      const response = await api.get(`/platform/associations/${association.id}/admins`);
      setAdmins(response.data);
    } catch (error) {
      console.error('Erreur chargement admins:', error);
      Alert.alert('Erreur', 'Impossible de charger les admins');
    } finally {
      setLoadingAdmins(false);
    }
  };

  // Ajouter un admin
  const handleAddAdmin = async () => {
    if (!newAdminData.email || !newAdminData.password) {
      Alert.alert('Erreur', 'Email et mot de passe requis');
      return;
    }
    
    try {
      await api.post(`/platform/associations/${selectedAssociationForAdmins.id}/admins`, newAdminData);
      Alert.alert('Succès', 'Admin ajouté');
      setNewAdminData({ email: '', password: '', phone: '' });
      // Recharger la liste
      const response = await api.get(`/platform/associations/${selectedAssociationForAdmins.id}/admins`);
      setAdmins(response.data);
    } catch (error) {
      Alert.alert('Erreur', error.response?.data?.error || 'Erreur ajout admin');
    }
  };

  // Changer mot de passe admin
  const handleChangePassword = async (adminId) => {
    if (!changePasswordData.password || changePasswordData.password.length < 4) {
      Alert.alert('Erreur', 'Mot de passe requis (minimum 4 caractères)');
      return;
    }
    
    try {
      await api.put(
        `/platform/associations/${selectedAssociationForAdmins.id}/admins/${adminId}/password`,
        { password: changePasswordData.password }
      );
      Alert.alert('Succès', 'Mot de passe modifié');
      setChangePasswordData({ adminId: null, password: '' });
    } catch (error) {
      Alert.alert('Erreur', error.response?.data?.error || 'Erreur modification mot de passe');
    }
  };

  // Supprimer admin
  const handleDeleteAdmin = (admin) => {
    Alert.alert(
      'Supprimer l\'admin',
      `Supprimer ${admin.email} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/platform/associations/${selectedAssociationForAdmins.id}/admins/${admin.id}`);
              Alert.alert('Succès', 'Admin supprimé');
              const response = await api.get(`/platform/associations/${selectedAssociationForAdmins.id}/admins`);
              setAdmins(response.data);
            } catch (error) {
              Alert.alert('Erreur', error.response?.data?.error || 'Erreur suppression');
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
        <View style={[styles.statusDot, { backgroundColor: item.active ? colors.success : colors.error }]} />
        <Text style={styles.cardTitle}>{item.name}</Text>
      </View>
      
      <View style={styles.cardInfo}>
        <Text style={styles.cardCode}>Code: {item.code}</Text>
        <Text style={styles.cardType}>{item.type || 'association'}</Text>
      </View>
      
      <View style={styles.cardAdmin}>
        <User size={14} color={colors.textMuted} />
        <Text style={styles.adminText}>{item.adminEmail || 'Pas d\'admin'}</Text>
      </View>

      <View style={styles.cardActions}>
        {/* Bouton Modifier */}
        <TouchableOpacity
          style={[styles.actionBtn, styles.editBtn]}
          onPress={() => openEditModal(item)}
          activeOpacity={0.7}
        >
          <Pencil size={18} color={colors.textOnSecondary} />
        </TouchableOpacity>

        {/* Bouton Gérer Admins */}
        <TouchableOpacity
          style={[styles.actionBtn, styles.adminsBtn]}
          onPress={() => openAdminsModal(item)}
          activeOpacity={0.7}
        >
          <UsersThree size={18} color={colors.textOnSecondary} />
        </TouchableOpacity>

        {/* Bouton Activer/Désactiver */}
        <TouchableOpacity
          style={[styles.actionBtn, item.active ? styles.deactivateBtn : styles.activateBtn]}
          onPress={() => handleToggleAssociation(item)}
          activeOpacity={0.7}
        >
          {item.active ? (
            <Pause size={18} color={colors.textOnSecondary} />
          ) : (
            <Play size={18} color={colors.textOnSecondary} />
          )}
        </TouchableOpacity>

        {/* Bouton Supprimer (pas pour V1-DEFAULT) */}
        {item.code !== 'V1-DEFAULT' && (
          <TouchableOpacity
            style={[styles.actionBtn, styles.deleteBtn]}
            onPress={() => handleDeleteAssociation(item)}
            activeOpacity={0.7}
          >
            <Trash size={18} color={colors.textOnSecondary} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.secondary} />
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
          <SignOut size={24} color={colors.error} />
        </TouchableOpacity>
      </View>

      {/* Stats */}
      {stats && (
        <View style={styles.statsContainer}>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{stats.totalAssociations}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: colors.successBg }]}>
            <Text style={[styles.statNumber, { color: colors.success }]}>{stats.activeAssociations}</Text>
            <Text style={styles.statLabel}>Actives</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: colors.errorBg }]}>
            <Text style={[styles.statNumber, { color: colors.error }]}>{stats.inactiveAssociations}</Text>
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
        <PlusCircle size={24} color={colors.textOnPrimary} weight="fill" />
        <Text style={styles.createBtnText}>Nouvelle Association</Text>
      </TouchableOpacity>

      {/* Liste des associations */}
      <FlatList
        data={associations}
        renderItem={renderAssociation}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.secondary]} />
        }
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <Buildings size={64} color={colors.border} weight="duotone" />
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
                <X size={28} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.inputLabel}>Nom de l'association *</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: Mon Association"
                placeholderTextColor={colors.textMuted}
                value={formData.name}
                onChangeText={(text) => setFormData({ ...formData, name: text })}
                autoCapitalize="words"
              />

              <Text style={styles.inputLabel}>Code unique *</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: MON-ASSOC"
                placeholderTextColor={colors.textMuted}
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
                placeholderTextColor={colors.textMuted}
                value={formData.adminName}
                onChangeText={(text) => setFormData({ ...formData, adminName: text })}
                autoCapitalize="words"
              />

              <Text style={styles.inputLabel}>Email admin *</Text>
              <TextInput
                style={styles.input}
                placeholder="admin@exemple.com"
                placeholderTextColor={colors.textMuted}
                value={formData.adminEmail}
                onChangeText={(text) => setFormData({ ...formData, adminEmail: text })}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <Text style={styles.inputLabel}>Mot de passe *</Text>
              <TextInput
                style={styles.input}
                placeholder="Mot de passe"
                placeholderTextColor={colors.textMuted}
                value={formData.adminPassword}
                onChangeText={(text) => setFormData({ ...formData, adminPassword: text })}
                secureTextEntry
                autoCapitalize="none"
              />

              <TouchableOpacity
                style={[styles.submitBtn, creating && styles.submitBtnDisabled]}
                onPress={handleCreateAssociation}
                disabled={creating}
              >
                {creating ? (
                  <ActivityIndicator color={colors.textOnPrimary} />
                ) : (
                  <>
                    <PlusCircle size={20} color={colors.textOnPrimary} weight="fill" />
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
                <X size={28} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {editingAssociation && (
                <>
                  <View style={styles.codeBox}>
                    <Key size={18} color={colors.secondary} />
                    <Text style={styles.codeBoxText}>Code: {editingAssociation.code}</Text>
                  </View>

                  <Text style={styles.inputLabel}>Nom de l'association *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Nom"
                    placeholderTextColor={colors.textMuted}
                    value={editFormData.name}
                    onChangeText={(text) => setEditFormData({ ...editFormData, name: text })}
                    autoCapitalize="words"
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
                    placeholderTextColor={colors.textMuted}
                    value={editFormData.adminEmail}
                    onChangeText={(text) => setEditFormData({ ...editFormData, adminEmail: text })}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />

                  {/* Section Options personnalisées */}
                  <View style={styles.sectionDivider}>
                    <Text style={styles.sectionTitle}>Options personnalisées</Text>
                  </View>

                  <Text style={styles.inputLabel}>Libellé du champ membre (Villa, Désignation, etc.)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Ex: Villa, Désignation, Groupe..."
                    placeholderTextColor={colors.textMuted}
                    value={editFormData.customFieldLabel}
                    onChangeText={(text) => setEditFormData({ ...editFormData, customFieldLabel: text })}
                    autoCapitalize="words"
                  />

                  <TouchableOpacity
                    style={styles.toggleOption}
                    onPress={() => setEditFormData({ ...editFormData, enableVehiclePlates: !editFormData.enableVehiclePlates })}
                  >
                    <View style={styles.toggleOptionLeft}>
                      <Car size={24} color={editFormData.enableVehiclePlates ? colors.success : colors.textMuted} />
                      <View style={styles.toggleOptionText}>
                        <Text style={styles.toggleOptionTitle}>Matricules de véhicules</Text>
                        <Text style={styles.toggleOptionDesc}>
                          Permet aux membres d'ajouter plusieurs matricules de véhicules
                        </Text>
                      </View>
                    </View>
                    <View style={[styles.toggleSwitch, editFormData.enableVehiclePlates && styles.toggleSwitchOn]}>
                      <View style={[styles.toggleKnob, editFormData.enableVehiclePlates && styles.toggleKnobOn]} />
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.saveBtn}
                    onPress={handleSaveEdit}
                  >
                    <CheckCircle size={20} color={colors.textOnSecondary} weight="fill" />
                    <Text style={styles.saveBtnText}>Enregistrer</Text>
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal Gestion des Admins */}
      <Modal
        visible={adminsModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setAdminsModalVisible(false);
          setSelectedAssociationForAdmins(null);
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContainer}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Gérer les Admins</Text>
              <TouchableOpacity onPress={() => {
                setAdminsModalVisible(false);
                setSelectedAssociationForAdmins(null);
              }}>
                <X size={28} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {selectedAssociationForAdmins && (
                <>
                  <View style={styles.codeBox}>
                    <Buildings size={18} color={colors.secondary} />
                    <Text style={styles.codeBoxText}>{selectedAssociationForAdmins.name}</Text>
                  </View>

                  {/* Liste des admins existants */}
                  <Text style={styles.sectionTitle}>Administrateurs ({admins.length})</Text>
                  
                  {loadingAdmins ? (
                    <ActivityIndicator size="small" color={colors.secondary} style={{ marginVertical: 20 }} />
                  ) : (
                    admins.map((admin) => (
                      <View key={admin.id} style={styles.adminCard}>
                        <View style={styles.adminInfo}>
                          <UserCircle size={36} color={colors.secondary} weight="fill" />
                          <View style={{ marginLeft: 12, flex: 1 }}>
                            <Text style={styles.adminEmail}>{admin.email}</Text>
                            {admin.phone && <Text style={styles.adminPhone}>{admin.phone}</Text>}
                          </View>
                        </View>
                        
                        {/* Changer mot de passe */}
                        {changePasswordData.adminId === admin.id ? (
                          <View style={styles.passwordRow}>
                            <TextInput
                              style={[styles.input, { flex: 1, marginBottom: 0, marginRight: 8 }]}
                              placeholder="Nouveau mot de passe"
                              placeholderTextColor={colors.textMuted}
                              value={changePasswordData.password}
                              onChangeText={(text) => setChangePasswordData({ ...changePasswordData, password: text })}
                              secureTextEntry
                            />
                            <TouchableOpacity
                              style={styles.miniBtn}
                              onPress={() => handleChangePassword(admin.id)}
                            >
                              <CheckCircle size={20} color={colors.textOnSecondary} weight="fill" />
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.miniBtn, { backgroundColor: colors.textMuted, marginLeft: 4 }]}
                              onPress={() => setChangePasswordData({ adminId: null, password: '' })}
                            >
                              <X size={20} color={colors.textOnSecondary} />
                            </TouchableOpacity>
                          </View>
                        ) : (
                          <View style={styles.adminActions}>
                            <TouchableOpacity
                              style={[styles.adminActionBtn, { backgroundColor: colors.warning }]}
                              onPress={() => setChangePasswordData({ adminId: admin.id, password: '' })}
                            >
                              <Key size={16} color={colors.textOnSecondary} />
                              <Text style={styles.adminActionText}>Mot de passe</Text>
                            </TouchableOpacity>
                            {admins.length > 1 && (
                              <TouchableOpacity
                                style={[styles.adminActionBtn, { backgroundColor: colors.error }]}
                                onPress={() => handleDeleteAdmin(admin)}
                              >
                                <Trash size={16} color={colors.textOnSecondary} />
                              </TouchableOpacity>
                            )}
                          </View>
                        )}
                      </View>
                    ))
                  )}

                  {/* Ajouter un nouvel admin */}
                  <View style={styles.divider}>
                    <Text style={styles.dividerText}>Ajouter un Admin</Text>
                  </View>

                  <Text style={styles.inputLabel}>Email *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="admin@exemple.com"
                    placeholderTextColor={colors.textMuted}
                    value={newAdminData.email}
                    onChangeText={(text) => setNewAdminData({ ...newAdminData, email: text })}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />

                  <Text style={styles.inputLabel}>Mot de passe *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Mot de passe"
                    placeholderTextColor={colors.textMuted}
                    value={newAdminData.password}
                    onChangeText={(text) => setNewAdminData({ ...newAdminData, password: text })}
                    secureTextEntry
                    autoCapitalize="none"
                  />

                  <Text style={styles.inputLabel}>Téléphone (optionnel)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="+237 6XX XX XX XX"
                    placeholderTextColor={colors.textMuted}
                    value={newAdminData.phone}
                    onChangeText={(text) => setNewAdminData({ ...newAdminData, phone: text })}
                    keyboardType="phone-pad"
                  />

                  <TouchableOpacity
                    style={styles.submitBtn}
                    onPress={handleAddAdmin}
                  >
                    <Plus size={20} color={colors.textOnPrimary} weight="bold" />
                    <Text style={styles.submitBtnText}>Ajouter l'Admin</Text>
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
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.lg,
    color: colors.textMuted,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.secondary,
    padding: 20,
    paddingTop: 50,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.textOnSecondary,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: spacing.xs,
  },
  logoutBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    padding: 10,
    borderRadius: borderRadius.button,
  },
  statsContainer: {
    flexDirection: 'row',
    padding: spacing.lg,
    gap: spacing.md,
  },
  statBox: {
    flex: 1,
    backgroundColor: colors.backgroundWhite,
    padding: spacing.lg,
    borderRadius: borderRadius.card,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
  },
  statLabel: {
    fontSize: typography.caption.fontSize,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  createBtn: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    padding: spacing.lg,
    borderRadius: borderRadius.card,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  createBtnText: {
    color: colors.textOnPrimary,
    fontSize: typography.body.fontSize,
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 20,
  },
  card: {
    backgroundColor: colors.backgroundWhite,
    borderRadius: borderRadius.card,
    padding: spacing.lg,
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
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
    color: colors.text,
    flex: 1,
  },
  cardInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  cardCode: {
    fontSize: typography.body.fontSize,
    color: colors.secondary,
    fontWeight: '500',
  },
  cardType: {
    fontSize: typography.body.fontSize,
    color: colors.textMuted,
    textTransform: 'capitalize',
  },
  cardAdmin: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.md,
  },
  adminText: {
    fontSize: typography.caption.fontSize,
    color: colors.textMuted,
  },
  cardActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingTop: spacing.md,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.button,
    gap: 6,
  },
  editBtn: {
    backgroundColor: colors.secondary,
  },
  adminsBtn: {
    backgroundColor: colors.accentTeal,
  },
  activateBtn: {
    backgroundColor: colors.success,
  },
  deactivateBtn: {
    backgroundColor: colors.warning,
  },
  deleteBtn: {
    backgroundColor: colors.error,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    marginTop: spacing.lg,
    fontSize: typography.body.fontSize,
    color: colors.textMuted,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.backgroundWhite,
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
    borderBottomColor: colors.borderLight,
  },
  modalTitle: {
    fontSize: typography.h2.fontSize,
    fontWeight: typography.h2.fontWeight,
    color: colors.text,
  },
  modalBody: {
    padding: 20,
  },
  inputLabel: {
    fontSize: typography.body.fontSize,
    fontWeight: '500',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.input,
    padding: 14,
    fontSize: typography.body.fontSize,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
  },
  typeRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: spacing.lg,
  },
  typeBtn: {
    flex: 1,
    padding: spacing.md,
    borderRadius: borderRadius.button,
    backgroundColor: colors.background,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  typeBtnActive: {
    backgroundColor: colors.warningBg,
    borderColor: colors.primary,
  },
  typeBtnText: {
    color: colors.textMuted,
    fontWeight: '500',
  },
  typeBtnTextActive: {
    color: colors.primary,
  },
  divider: {
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingTop: spacing.lg,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  dividerText: {
    fontSize: typography.body.fontSize,
    fontWeight: '600',
    color: colors.textMuted,
  },
  submitBtn: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    padding: spacing.lg,
    borderRadius: borderRadius.card,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
    marginBottom: 30,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    color: colors.textOnPrimary,
    fontSize: typography.body.fontSize,
    fontWeight: '600',
  },
  codeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: spacing.md,
    borderRadius: borderRadius.input,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  codeBoxText: {
    fontSize: typography.body.fontSize,
    color: colors.secondary,
    fontWeight: '500',
  },
  saveBtn: {
    flexDirection: 'row',
    backgroundColor: colors.success,
    padding: spacing.lg,
    borderRadius: borderRadius.card,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
    marginBottom: 30,
  },
  saveBtnText: {
    color: colors.textOnSecondary,
    fontSize: typography.body.fontSize,
    fontWeight: '600',
  },
  // Admin management styles
  sectionTitle: {
    fontSize: typography.h3.fontSize,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.md,
    marginTop: spacing.sm,
  },
  adminCard: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.card,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  adminInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  adminEmail: {
    fontSize: typography.body.fontSize,
    fontWeight: '500',
    color: colors.text,
  },
  adminPhone: {
    fontSize: typography.caption.fontSize,
    color: colors.textMuted,
    marginTop: 2,
  },
  adminActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  adminActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 6,
    gap: 6,
  },
  adminActionText: {
    color: colors.textOnSecondary,
    fontSize: typography.caption.fontSize,
    fontWeight: '500',
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  miniBtn: {
    backgroundColor: colors.success,
    padding: 10,
    borderRadius: borderRadius.button,
  },
  // Options personnalisées styles
  sectionDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 20,
    paddingTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  toggleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background,
    padding: spacing.lg,
    borderRadius: borderRadius.card,
    marginBottom: spacing.lg,
  },
  toggleOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.md,
  },
  toggleOptionText: {
    flex: 1,
  },
  toggleOptionTitle: {
    fontSize: typography.body.fontSize,
    fontWeight: '600',
    color: colors.text,
  },
  toggleOptionDesc: {
    fontSize: typography.caption.fontSize,
    color: colors.textMuted,
    marginTop: 2,
  },
  toggleSwitch: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.border,
    justifyContent: 'center',
    padding: 2,
  },
  toggleSwitchOn: {
    backgroundColor: colors.success,
  },
  toggleKnob: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.backgroundWhite,
  },
  toggleKnobOn: {
    alignSelf: 'flex-end',
  },
});

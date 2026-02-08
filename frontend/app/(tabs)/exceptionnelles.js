import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import api from '../../utils/api';
import { useFocusEffect } from '@react-navigation/native';

const TYPES = ['décès', 'mariage', 'anniversaire', 'solidarité', 'autre'];

export default function Exceptionnelles() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [contributions, setContributions] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Modals
  const [modalVisible, setModalVisible] = useState(false);
  const [detailModal, setDetailModal] = useState(false);
  const [paymentModal, setPaymentModal] = useState(false);
  const [memberSelectModal, setMemberSelectModal] = useState(false);
  
  // State
  const [selectedContribution, setSelectedContribution] = useState(null);
  const [editingContribution, setEditingContribution] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    type: 'décès',
    description: ''
  });
  const [paymentData, setPaymentData] = useState({
    memberId: '',
    memberName: '',
    amount: ''
  });
  const [saving, setSaving] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');

  // Recharger les données à chaque fois que l'onglet est affiché
  useFocusEffect(
    useCallback(() => {
      loadContributions();
      loadMembers();
    }, [])
  );

  const loadContributions = async () => {
    try {
      const response = await api.get('/exceptional');
      setContributions(response.data);
    } catch (error) {
      console.error('Erreur chargement:', error);
      Alert.alert('Erreur', 'Impossible de charger les cotisations');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadMembers = async () => {
    try {
      const response = await api.get('/members');
      setMembers(response.data.filter(m => m.active));
    } catch (error) {
      console.error('Erreur chargement membres:', error);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadContributions();
  };

  // Créer ou modifier
  const handleOpenCreateModal = () => {
    setEditingContribution(null);
    setFormData({ title: '', type: 'décès', description: '' });
    setModalVisible(true);
  };

  const handleOpenEditModal = (contribution) => {
    setEditingContribution(contribution);
    setFormData({
      title: contribution.title,
      type: contribution.type,
      description: contribution.description || ''
    });
    setDetailModal(false);
    setTimeout(() => setModalVisible(true), 300);
  };

  const handleSave = async () => {
    if (!formData.title) {
      Alert.alert('Erreur', 'Titre requis');
      return;
    }

    setSaving(true);
    try {
      if (editingContribution) {
        await api.put(`/exceptional/${editingContribution.id}`, formData);
        Alert.alert('Succès', 'Cotisation modifiée');
      } else {
        await api.post('/exceptional', formData);
        Alert.alert('Succès', 'Cotisation créée');
      }
      setModalVisible(false);
      setFormData({ title: '', type: 'décès', description: '' });
      setEditingContribution(null);
      loadContributions();
    } catch (error) {
      console.error('Erreur sauvegarde:', error);
      Alert.alert('Erreur', error.response?.data?.error || 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  // Supprimer
  const handleDelete = (contribution) => {
    Alert.alert(
      'Supprimer',
      `Êtes-vous sûr de vouloir supprimer "${contribution.title}" ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/exceptional/${contribution.id}`);
              Alert.alert('Succès', 'Cotisation supprimée');
              setDetailModal(false);
              loadContributions();
            } catch (error) {
              console.error('Erreur suppression:', error);
              Alert.alert('Erreur', 'Impossible de supprimer');
            }
          }
        }
      ]
    );
  };

  // Détails
  const handleShowDetail = async (contribution) => {
    try {
      const response = await api.get(`/exceptional/${contribution.id}`);
      setSelectedContribution(response.data);
      setDetailModal(true);
    } catch (error) {
      console.error('Erreur détail:', error);
      Alert.alert('Erreur', 'Impossible de charger les détails');
    }
  };

  const refreshDetail = async () => {
    if (selectedContribution) {
      try {
        const response = await api.get(`/exceptional/${selectedContribution.id}`);
        setSelectedContribution(response.data);
      } catch (error) {
        console.error('Erreur refresh:', error);
      }
    }
  };

  // Paiements
  const handleOpenPaymentModal = () => {
    setPaymentData({ memberId: '', memberName: '', amount: '' });
    setPaymentModal(true);
  };

  const handleSelectMember = (member) => {
    setPaymentData({
      ...paymentData,
      memberId: member.id,
      memberName: member.name
    });
    setMemberSelectModal(false);
  };

  const handleSavePayment = async () => {
    if (!paymentData.memberId || !paymentData.amount) {
      Alert.alert('Erreur', 'Membre et montant requis');
      return;
    }

    const amount = parseFloat(paymentData.amount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Erreur', 'Montant invalide');
      return;
    }

    setSaving(true);
    try {
      await api.post(`/exceptional/${selectedContribution.id}/payments`, {
        memberId: paymentData.memberId,
        amount: amount
      });
      Alert.alert('Succès', 'Paiement enregistré');
      setPaymentModal(false);
      setPaymentData({ memberId: '', memberName: '', amount: '' });
      refreshDetail();
      loadContributions();
    } catch (error) {
      console.error('Erreur paiement:', error);
      Alert.alert('Erreur', error.response?.data?.error || 'Erreur lors de l\'enregistrement');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePayment = (payment) => {
    Alert.alert(
      'Supprimer le paiement',
      `Supprimer le paiement de ${payment.member.name} (${Math.round(payment.amount)} FCFA) ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/exceptional/payments/${payment.id}`);
              Alert.alert('Succès', 'Paiement supprimé');
              refreshDetail();
              loadContributions();
            } catch (error) {
              console.error('Erreur suppression paiement:', error);
              Alert.alert('Erreur', 'Impossible de supprimer le paiement');
            }
          }
        }
      ]
    );
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'décès': return 'sad-outline';
      case 'mariage': return 'heart';
      case 'anniversaire': return 'gift';
      case 'solidarité': return 'hand-left';
      default: return 'star';
    }
  };

  const filteredMembers = members.filter(m =>
    m.name.toLowerCase().includes(memberSearch.toLowerCase()) ||
    m.customFieldValue?.toLowerCase().includes(memberSearch.toLowerCase())
  );

  const renderContribution = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => handleShowDetail(item)}
    >
      <View style={styles.cardHeader}>
        <View style={styles.iconContainer}>
          <Ionicons name={getTypeIcon(item.type)} size={32} color="#2196F3" />
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle}>{item.title}</Text>
          <Text style={styles.cardType}>{item.type}</Text>
        </View>
      </View>

      <View style={styles.cardStats}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{Math.round(item.totalCollected)} FCFA</Text>
          <Text style={styles.statLabel}>Collecté</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{item.participantsCount}</Text>
          <Text style={styles.statLabel}>Participants</Text>
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
      <FlatList
        data={contributions}
        renderItem={renderContribution}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <Ionicons name="gift-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>Aucune cotisation exceptionnelle</Text>
          </View>
        )}
      />

      {isAdmin && (
        <TouchableOpacity
          style={styles.fab}
          onPress={handleOpenCreateModal}
        >
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
      )}

      {/* Modal Création/Modification */}
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
                {editingContribution ? 'Modifier cotisation' : 'Nouvelle cotisation'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={28} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView>
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Titre *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ex: Décès M. Kamga"
                  value={formData.title}
                  onChangeText={(text) => setFormData({ ...formData, title: text })}
                  autoCapitalize="sentences"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Type *</Text>
                <View style={styles.typeContainer}>
                  {TYPES.map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.typeButton,
                        formData.type === type && styles.typeButtonActive
                      ]}
                      onPress={() => setFormData({ ...formData, type })}
                    >
                      <Text
                        style={[
                          styles.typeText,
                          formData.type === type && styles.typeTextActive
                        ]}
                      >
                        {type}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Description</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Description..."
                  value={formData.description}
                  onChangeText={(text) => setFormData({ ...formData, description: text })}
                  multiline
                  numberOfLines={4}
                />
              </View>

              <TouchableOpacity
                style={[styles.submitButton, saving && styles.submitButtonDisabled]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitButtonText}>
                    {editingContribution ? 'Modifier' : 'Créer'}
                  </Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal Détail */}
      <Modal
        visible={detailModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setDetailModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, { maxHeight: '90%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Détails</Text>
              <TouchableOpacity onPress={() => setDetailModal(false)}>
                <Ionicons name="close" size={28} color="#333" />
              </TouchableOpacity>
            </View>

            {selectedContribution && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.detailHeader}>
                  <View style={styles.detailIconContainer}>
                    <Ionicons name={getTypeIcon(selectedContribution.type)} size={40} color="#2196F3" />
                  </View>
                  <View style={styles.detailInfo}>
                    <Text style={styles.detailTitle}>{selectedContribution.title}</Text>
                    <Text style={styles.detailType}>{selectedContribution.type}</Text>
                  </View>
                </View>

                {selectedContribution.description && (
                  <Text style={styles.detailDescription}>{selectedContribution.description}</Text>
                )}

                <View style={styles.statsRow}>
                  <View style={styles.statBox}>
                    <Text style={styles.statBoxValue}>{Math.round(selectedContribution.totalCollected)}</Text>
                    <Text style={styles.statBoxLabel}>FCFA collectés</Text>
                  </View>
                  <View style={styles.statBox}>
                    <Text style={styles.statBoxValue}>{selectedContribution.participantsCount}</Text>
                    <Text style={styles.statBoxLabel}>Participants</Text>
                  </View>
                </View>

                {/* Actions Admin */}
                {isAdmin && (
                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => handleOpenEditModal(selectedContribution)}
                    >
                      <Ionicons name="pencil" size={20} color="#2196F3" />
                      <Text style={styles.actionButtonText}>Modifier</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.actionButton, styles.deleteButton]}
                      onPress={() => handleDelete(selectedContribution)}
                    >
                      <Ionicons name="trash" size={20} color="#F44336" />
                      <Text style={[styles.actionButtonText, { color: '#F44336' }]}>Supprimer</Text>
                    </TouchableOpacity>
                  </View>
                )}

                <View style={styles.paymentsSection}>
                  <View style={styles.paymentsSectionHeader}>
                    <Text style={styles.sectionTitle}>Paiements</Text>
                    {isAdmin && (
                      <TouchableOpacity
                        style={styles.addPaymentButton}
                        onPress={handleOpenPaymentModal}
                      >
                        <Ionicons name="add" size={20} color="#fff" />
                        <Text style={styles.addPaymentText}>Ajouter</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {selectedContribution.payments && selectedContribution.payments.length > 0 ? (
                    selectedContribution.payments.map((payment) => (
                      <View key={payment.id} style={styles.paymentItem}>
                        <View style={styles.paymentInfo}>
                          <Text style={styles.paymentName}>{payment.member.name}</Text>
                          <Text style={styles.paymentDate}>
                            {new Date(payment.paymentDate).toLocaleDateString('fr-FR')}
                          </Text>
                        </View>
                        <View style={styles.paymentRight}>
                          <Text style={styles.paymentAmount}>{Math.round(payment.amount)} FCFA</Text>
                          {isAdmin && (
                            <TouchableOpacity
                              onPress={() => handleDeletePayment(payment)}
                              style={styles.paymentDeleteButton}
                            >
                              <Ionicons name="trash-outline" size={18} color="#F44336" />
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.noPayments}>Aucun paiement enregistré</Text>
                  )}
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Modal Paiement */}
      <Modal
        visible={paymentModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setPaymentModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContainer}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nouveau paiement</Text>
              <TouchableOpacity onPress={() => setPaymentModal(false)}>
                <Ionicons name="close" size={28} color="#333" />
              </TouchableOpacity>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Membre *</Text>
              <TouchableOpacity
                style={styles.memberSelector}
                onPress={() => setMemberSelectModal(true)}
              >
                <Text style={paymentData.memberName ? styles.memberSelectorText : styles.memberSelectorPlaceholder}>
                  {paymentData.memberName || 'Sélectionner un membre'}
                </Text>
                <Ionicons name="chevron-down" size={20} color="#666" />
              </TouchableOpacity>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Montant (FCFA) *</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: 5000"
                value={paymentData.amount}
                onChangeText={(text) => setPaymentData({ ...paymentData, amount: text })}
                keyboardType="numeric"
              />
            </View>

            <TouchableOpacity
              style={[styles.submitButton, saving && styles.submitButtonDisabled]}
              onPress={handleSavePayment}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>Enregistrer</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal Sélection Membre */}
      <Modal
        visible={memberSelectModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setMemberSelectModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, { maxHeight: '80%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Sélectionner un membre</Text>
              <TouchableOpacity onPress={() => setMemberSelectModal(false)}>
                <Ionicons name="close" size={28} color="#333" />
              </TouchableOpacity>
            </View>

            <View style={styles.searchContainer}>
              <Ionicons name="search" size={20} color="#666" />
              <TextInput
                style={styles.searchInput}
                placeholder="Rechercher..."
                value={memberSearch}
                onChangeText={setMemberSearch}
              />
            </View>

            <FlatList
              data={filteredMembers}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.memberItem}
                  onPress={() => handleSelectMember(item)}
                >
                  <View style={styles.memberItemIcon}>
                    <Ionicons name="person" size={20} color="#2196F3" />
                  </View>
                  <View style={styles.memberItemInfo}>
                    <Text style={styles.memberItemName}>{item.name}</Text>
                    <Text style={styles.memberItemField}>{item.customFieldValue}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#ccc" />
                </TouchableOpacity>
              )}
              ListEmptyComponent={() => (
                <Text style={styles.noMembers}>Aucun membre trouvé</Text>
              )}
            />
          </View>
        </View>
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
  card: {
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
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  cardInfo: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  cardType: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
    textTransform: 'capitalize',
  },
  cardStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
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
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  typeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  typeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginRight: 8,
    marginBottom: 8,
  },
  typeButtonActive: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  typeText: {
    fontSize: 14,
    color: '#666',
    textTransform: 'capitalize',
  },
  typeTextActive: {
    color: '#fff',
    fontWeight: '600',
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
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  detailIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  detailInfo: {
    flex: 1,
  },
  detailTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  detailType: {
    fontSize: 16,
    color: '#2196F3',
    textTransform: 'capitalize',
    marginTop: 4,
  },
  detailDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    lineHeight: 20,
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#E3F2FD',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  statBoxValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  statBoxLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#E3F2FD',
    gap: 8,
  },
  deleteButton: {
    backgroundColor: '#FFEBEE',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2196F3',
  },
  paymentsSection: {
    marginTop: 8,
  },
  paymentsSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  addPaymentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 4,
  },
  addPaymentText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  paymentItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  paymentInfo: {
    flex: 1,
  },
  paymentName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  paymentDate: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  paymentRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  paymentAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2196F3',
  },
  paymentDeleteButton: {
    padding: 4,
  },
  noPayments: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    paddingVertical: 24,
  },
  memberSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  memberSelectorText: {
    fontSize: 16,
    color: '#333',
  },
  memberSelectorPlaceholder: {
    fontSize: 16,
    color: '#999',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    fontSize: 16,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  memberItemIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  memberItemInfo: {
    flex: 1,
  },
  memberItemName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  memberItemField: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  noMembers: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    paddingVertical: 24,
  },
});

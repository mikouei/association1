import React, { useEffect, useState } from 'react';
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

const TYPES = ['décès', 'mariage', 'anniversaire', 'solidarité', 'autre'];

export default function Exceptionnelles() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [contributions, setContributions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [detailModal, setDetailModal] = useState(false);
  const [selectedContribution, setSelectedContribution] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    type: 'décès',
    description: ''
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadContributions();
  }, []);

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

  const onRefresh = () => {
    setRefreshing(true);
    loadContributions();
  };

  const handleCreate = async () => {
    if (!formData.title) {
      Alert.alert('Erreur', 'Titre requis');
      return;
    }

    setSaving(true);
    try {
      await api.post('/exceptional', formData);
      Alert.alert('Succès', 'Cotisation créée');
      setModalVisible(false);
      setFormData({ title: '', type: 'décès', description: '' });
      loadContributions();
    } catch (error) {
      console.error('Erreur création:', error);
      Alert.alert('Erreur', error.response?.data?.error || 'Erreur lors de la création');
    } finally {
      setSaving(false);
    }
  };

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

  const getTypeIcon = (type) => {
    switch (type) {
      case 'décès': return 'sad-outline';
      case 'mariage': return 'heart';
      case 'anniversaire': return 'gift';
      case 'solidarité': return 'hand-left';
      default: return 'star';
    }
  };

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
          onPress={() => setModalVisible(true)}
        >
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
      )}

      {/* Modal Création */}
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
              <Text style={styles.modalTitle}>Nouvelle cotisation</Text>
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
                onPress={handleCreate}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitButtonText}>Créer</Text>
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
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Détails</Text>
              <TouchableOpacity onPress={() => setDetailModal(false)}>
                <Ionicons name="close" size={28} color="#333" />
              </TouchableOpacity>
            </View>

            {selectedContribution && (
              <ScrollView>
                <Text style={styles.detailTitle}>{selectedContribution.title}</Text>
                <Text style={styles.detailType}>{selectedContribution.type}</Text>
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

                <Text style={styles.sectionTitle}>Paiements</Text>
                {selectedContribution.payments && selectedContribution.payments.length > 0 ? (
                  selectedContribution.payments.map((payment) => (
                    <View key={payment.id} style={styles.paymentItem}>
                      <Text style={styles.paymentName}>{payment.member.name}</Text>
                      <Text style={styles.paymentAmount}>{Math.round(payment.amount)} FCFA</Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.noPayments}>Aucun paiement enregistré</Text>
                )}
              </ScrollView>
            )}
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
    gap: 8,
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
  detailTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  detailType: {
    fontSize: 16,
    color: '#2196F3',
    textTransform: 'capitalize',
    marginBottom: 16,
  },
  detailDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 24,
    lineHeight: 20,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  paymentItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  paymentName: {
    fontSize: 14,
    color: '#333',
  },
  paymentAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2196F3',
  },
  noPayments: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    paddingVertical: 24,
  },
});

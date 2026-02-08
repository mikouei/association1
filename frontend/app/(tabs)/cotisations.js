import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
  Platform,
  FlatList,
  KeyboardAvoidingView,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import api from '../../utils/api';
import { useFocusEffect } from '@react-navigation/native';

const MONTHS = [
  'J', 'F', 'M', 'A', 'M', 'J',
  'J', 'A', 'S', 'O', 'N', 'D'
];

const MONTHS_FULL = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

export default function Cotisations() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [years, setYears] = useState([]);
  const [selectedYear, setSelectedYear] = useState(null);
  const [membersData, setMembersData] = useState([]);
  const [filteredMembers, setFilteredMembers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCell, setSelectedCell] = useState(null);
  const [paymentModal, setPaymentModal] = useState(false);
  const [yearSelectorModal, setYearSelectorModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Recharger les données à chaque fois que l'onglet Cotisations est affiché
  useFocusEffect(
    useCallback(() => {
      if (selectedYear) {
        loadPayments(selectedYear.id);
      } else {
        loadYears();
      }
    }, [selectedYear?.id])
  );

  // Filtrer les membres quand la recherche change
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredMembers(membersData);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = membersData.filter(member => 
        member.name?.toLowerCase().includes(query) ||
        member.customFieldValue?.toLowerCase().includes(query) ||
        member.phone?.toLowerCase().includes(query)
      );
      setFilteredMembers(filtered);
    }
  }, [searchQuery, membersData]);

  const loadYears = async () => {
    try {
      const yearsRes = await api.get('/years');
      setYears(yearsRes.data);
      
      // Sélectionner l'année active par défaut
      const activeYear = yearsRes.data.find(y => y.active);
      if (activeYear) {
        setSelectedYear(activeYear);
        await loadPayments(activeYear.id);
      } else if (yearsRes.data.length > 0) {
        // Si pas d'année active, prendre la première
        setSelectedYear(yearsRes.data[0]);
        await loadPayments(yearsRes.data[0].id);
      }
    } catch (error) {
      console.error('Erreur chargement années:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPayments = async (yearId) => {
    try {
      const paymentsRes = await api.get(`/payments/year/${yearId}`);
      let members = paymentsRes.data.members;
      
      // Si l'utilisateur n'est pas admin, filtrer pour ne montrer que sa propre ligne
      if (user?.role !== 'ADMIN' && user?.member) {
        members = members.filter(m => m.id === user.member.id || m.userId === user.id);
      }
      
      setMembersData(members);
    } catch (error) {
      console.error('Erreur chargement paiements:', error);
      setMembersData([]);
    } finally {
      setRefreshing(false);
    }
  };

  const handleSelectYear = async (year) => {
    setSelectedYear(year);
    setYearSelectorModal(false);
    setRefreshing(true);
    await loadPayments(year.id);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    if (selectedYear) {
      await loadPayments(selectedYear.id);
    }
  };

  const handleCellPress = (member, month) => {
    if (!isAdmin) return;
    
    setSelectedCell({ member, month });
    const monthData = member.paymentsByMonth[month];
    setPaymentAmount(monthData.amountPaid > 0 ? monthData.amountPaid.toString() : selectedYear.monthlyAmount.toString());
    setPaymentNotes('');
    setPaymentModal(true);
  };

  const handleAddMember = () => {
    Alert.alert(
      'Ajouter un membre',
      'Utilisez l\'onglet "Membres" puis cliquez sur le bouton + en bas à droite pour ajouter un nouveau membre.'
    );
  };

  const handleSavePayment = async () => {
    if (!paymentAmount || parseFloat(paymentAmount) <= 0) {
      Alert.alert('Erreur', 'Montant invalide');
      return;
    }

    setSaving(true);
    try {
      await api.post('/payments', {
        memberId: selectedCell.member.userId,
        yearId: selectedYear.id,
        month: selectedCell.month,
        amountPaid: parseFloat(paymentAmount),
        notes: paymentNotes
      });

      Alert.alert('Succès', 'Paiement enregistré');
      setPaymentModal(false);
      loadPayments(selectedYear.id);
    } catch (error) {
      console.error('Erreur sauvegarde paiement:', error);
      Alert.alert('Erreur', error.response?.data?.error || 'Erreur lors de l\'enregistrement');
    } finally {
      setSaving(false);
    }
  };

  const getCellColor = (monthData, monthlyAmount) => {
    if (monthData.amountPaid >= monthlyAmount) {
      return '#4CAF50'; // Vert: payé
    } else if (monthData.amountPaid > 0) {
      return '#FF9800'; // Orange: partiel
    }
    return '#F44336'; // Rouge: non payé
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
      </View>
    );
  }

  if (!selectedYear) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="calendar-outline" size={64} color="#ccc" />
        <Text style={styles.emptyText}>Aucune année disponible</Text>
        <Text style={styles.emptySubtext}>Créez une année dans les paramètres</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity 
        style={styles.header}
        onPress={() => setYearSelectorModal(true)}
      >
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.headerTitle}>Année {selectedYear.year}</Text>
            <Text style={styles.headerSubtitle}>Montant mensuel: {selectedYear.monthlyAmount} FCFA</Text>
          </View>
          <View style={styles.yearSelectorButton}>
            <Ionicons name="chevron-down" size={24} color="#fff" />
          </View>
        </View>
        {selectedYear.active && (
          <View style={styles.activeBadge}>
            <Text style={styles.activeBadgeText}>Active</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Barre de recherche */}
      {isAdmin && (
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#666" />
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher par nom, villa, téléphone..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#999"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color="#999" />
            </TouchableOpacity>
          )}
        </View>
      )}

      <ScrollView
        style={styles.scrollContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Cartes membres avec 3 lignes de 4 mois */}
        {filteredMembers.map((member, idx) => (
          <View key={member.id} style={styles.memberCard}>
            {/* En-tête membre */}
            <View style={styles.memberCardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.memberCardName}>{member.name}</Text>
                <Text style={styles.memberCardField}>{member.customFieldValue}</Text>
              </View>
              <View style={styles.memberCardTotal}>
                <Text style={styles.memberCardTotalLabel}>Total</Text>
                <Text style={styles.memberCardTotalValue}>{Math.round(member.totalPaid / 1000)}k</Text>
              </View>
            </View>

            {/* Grille 3x4 mois */}
            {[[1,2,3,4],[5,6,7,8],[9,10,11,12]].map((row, rowIdx) => (
              <View key={rowIdx} style={styles.monthRow}>
                {row.map((month) => {
                  const monthData = member.paymentsByMonth[month];
                  return (
                    <TouchableOpacity
                      key={month}
                      style={[
                        styles.monthCard,
                        { backgroundColor: getCellColor(monthData, selectedYear.monthlyAmount) }
                      ]}
                      onPress={() => handleCellPress(member, month)}
                      disabled={!isAdmin}
                    >
                      <Text style={styles.monthCardLabel}>{MONTHS[month - 1]}</Text>
                      <Text style={styles.monthCardValue}>
                        {monthData.amountPaid > 0 ? Math.round(monthData.amountPaid / 1000) + 'k' : '-'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </View>
        ))}

        {filteredMembers.length === 0 && (
          <View style={styles.noResults}>
            <Text style={styles.noResultsText}>
              {searchQuery ? 'Aucun résultat trouvé' : 'Aucun membre'}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Légende */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: '#4CAF50' }]} />
          <Text style={styles.legendText}>Payé</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: '#FF9800' }]} />
          <Text style={styles.legendText}>Partiel</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: '#F44336' }]} />
          <Text style={styles.legendText}>Non payé</Text>
        </View>
      </View>

      {/* Modal paiement */}
      <Modal
        visible={paymentModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setPaymentModal(false)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <ScrollView bounces={false} keyboardShouldPersistTaps="handled">
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Enregistrer un paiement</Text>
                  <TouchableOpacity onPress={() => setPaymentModal(false)}>
                    <Ionicons name="close" size={28} color="#333" />
                  </TouchableOpacity>
                </View>

                {selectedCell && (
                  <>
                    <Text style={styles.modalInfo}>
                      {selectedCell.member.name} - {MONTHS_FULL[selectedCell.month - 1]}
                    </Text>

                    <View style={styles.inputContainer}>
                      <Text style={styles.label}>Montant (FCFA)</Text>
                      <TextInput
                        style={styles.input}
                        placeholder={`${selectedYear.monthlyAmount}`}
                        value={paymentAmount}
                        onChangeText={setPaymentAmount}
                        keyboardType="numeric"
                      />
                    </View>

                    <View style={styles.inputContainer}>
                      <Text style={styles.label}>Notes (optionnel)</Text>
                      <TextInput
                        style={[styles.input, styles.textArea]}
                        placeholder="Ajouter une note..."
                        value={paymentNotes}
                        onChangeText={setPaymentNotes}
                        multiline
                        numberOfLines={3}
                      />
                    </View>

                    <TouchableOpacity
                      style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                      onPress={handleSavePayment}
                      disabled={saving}
                    >
                      {saving ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={styles.saveButtonText}>Enregistrer</Text>
                      )}
                    </TouchableOpacity>
                    <View style={{ height: Platform.OS === 'android' ? 40 : 0 }} />
                  </>
                )}
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal Sélection d'année */}
      <Modal
        visible={yearSelectorModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setYearSelectorModal(false)}
      >
        <View style={styles.yearModalContainer}>
          <View style={styles.yearModalContent}>
            <View style={styles.yearModalHeader}>
              <Text style={styles.yearModalTitle}>Sélectionner une année</Text>
              <TouchableOpacity onPress={() => setYearSelectorModal(false)}>
                <Ionicons name="close" size={28} color="#333" />
              </TouchableOpacity>
            </View>
            
            <FlatList
              data={years}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.yearItem,
                    selectedYear?.id === item.id && styles.yearItemSelected
                  ]}
                  onPress={() => handleSelectYear(item)}
                >
                  <View style={styles.yearItemInfo}>
                    <Text style={[
                      styles.yearItemYear,
                      selectedYear?.id === item.id && styles.yearItemYearSelected
                    ]}>
                      {item.year}
                    </Text>
                    <Text style={styles.yearItemAmount}>
                      {item.monthlyAmount} FCFA/mois
                    </Text>
                  </View>
                  {item.active && (
                    <View style={styles.yearActiveBadge}>
                      <Text style={styles.yearActiveBadgeText}>Active</Text>
                    </View>
                  )}
                  {selectedYear?.id === item.id && (
                    <Ionicons name="checkmark-circle" size={24} color="#2196F3" />
                  )}
                </TouchableOpacity>
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
  },
  header: {
    backgroundColor: '#2196F3',
    padding: 16,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#fff',
    marginTop: 4,
    opacity: 0.9,
  },
  yearSelectorButton: {
    padding: 4,
  },
  activeBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  activeBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    margin: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    color: '#333',
  },
  memberCard: {
    backgroundColor: '#fff',
    marginHorizontal: 12,
    marginBottom: 10,
    borderRadius: 10,
    padding: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  memberCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  memberCardName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#222',
  },
  memberCardField: {
    fontSize: 12,
    color: '#777',
    marginTop: 1,
  },
  memberCardTotal: {
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'center',
  },
  memberCardTotalLabel: {
    fontSize: 9,
    color: '#1565C0',
    fontWeight: '600',
  },
  memberCardTotalValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1565C0',
  },
  monthRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 6,
  },
  monthCard: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  monthCardLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
  },
  monthCardValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 2,
  },
  percentageText: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
  },
  legendColor: {
    width: 16,
    height: 16,
    borderRadius: 4,
    marginRight: 6,
  },
  legendText: {
    fontSize: 12,
    color: '#666',
  },
  noResults: {
    padding: 32,
    alignItems: 'center',
  },
  noResultsText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
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
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  modalInfo: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
    textAlign: 'center',
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
    height: 80,
    textAlignVertical: 'top',
  },
  saveButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  yearModalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  yearModalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    maxHeight: '60%',
  },
  yearModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  yearModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  yearItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
    marginBottom: 8,
  },
  yearItemSelected: {
    backgroundColor: '#E3F2FD',
    borderWidth: 2,
    borderColor: '#2196F3',
  },
  yearItemInfo: {
    flex: 1,
  },
  yearItemYear: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  yearItemYearSelected: {
    color: '#2196F3',
  },
  yearItemAmount: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  yearActiveBadge: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 12,
  },
  yearActiveBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});

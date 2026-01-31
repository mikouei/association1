import React, { useEffect, useState } from 'react';
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
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import api from '../../utils/api';

const MONTHS = [
  'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin',
  'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'
];

export default function Cotisations() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeYear, setActiveYear] = useState(null);
  const [membersData, setMembersData] = useState([]);
  const [selectedCell, setSelectedCell] = useState(null);
  const [paymentModal, setPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Récupérer l'année active
      const yearRes = await api.get('/years/active');
      setActiveYear(yearRes.data);

      // Récupérer les paiements de l'année
      const paymentsRes = await api.get(`/payments/year/${yearRes.data.id}`);
      setMembersData(paymentsRes.data.members);
    } catch (error) {
      console.error('Erreur chargement données:', error);
      if (error.response?.status === 404) {
        Alert.alert('Info', 'Aucune année active. Créez une année dans les paramètres.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleCellPress = (member, month) => {
    if (!isAdmin) return;
    
    setSelectedCell({ member, month });
    const monthData = member.paymentsByMonth[month];
    setPaymentAmount(monthData.amountPaid > 0 ? monthData.amountPaid.toString() : activeYear.monthlyAmount.toString());
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
        yearId: activeYear.id,
        month: selectedCell.month,
        amountPaid: parseFloat(paymentAmount),
        notes: paymentNotes
      });

      Alert.alert('Succès', 'Paiement enregistré');
      setPaymentModal(false);
      loadData();
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

  if (!activeYear) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="calendar-outline" size={64} color="#ccc" />
        <Text style={styles.emptyText}>Aucune année active</Text>
        <Text style={styles.emptySubtext}>Créez une année dans les paramètres</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Année {activeYear.year}</Text>
        <Text style={styles.headerSubtitle}>Montant mensuel: {activeYear.monthlyAmount} FCFA</Text>
      </View>

      <ScrollView
        horizontal
        style={styles.scrollContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View>
          {/* Header row */}
          <View style={styles.tableHeader}>
            <View style={[styles.cell, styles.nameCell, styles.headerCell]}>
              <Text style={styles.headerText}>Membre</Text>
            </View>
            {MONTHS.map((month, index) => (
              <View key={index} style={[styles.cell, styles.monthCell, styles.headerCell]}>
                <Text style={styles.headerText}>{month}</Text>
              </View>
            ))}
            <View style={[styles.cell, styles.totalCell, styles.headerCell]}>
              <Text style={styles.headerText}>Total</Text>
            </View>
          </View>

          {/* Member rows */}
          <ScrollView style={styles.tableBody}>
            {membersData.map((member) => (
              <View key={member.id} style={styles.row}>
                <View style={[styles.cell, styles.nameCell]}>
                  <Text style={styles.memberName} numberOfLines={1}>
                    {member.name}
                  </Text>
                  <Text style={styles.memberField} numberOfLines={1}>
                    {member.customFieldValue}
                  </Text>
                </View>

                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((month) => {
                  const monthData = member.paymentsByMonth[month];
                  return (
                    <TouchableOpacity
                      key={month}
                      style={[
                        styles.cell,
                        styles.monthCell,
                        { backgroundColor: getCellColor(monthData, activeYear.monthlyAmount) }
                      ]}
                      onPress={() => handleCellPress(member, month)}
                      disabled={!isAdmin}
                    >
                      <Text style={styles.cellText}>
                        {monthData.amountPaid > 0 ? Math.round(monthData.amountPaid) : '-'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}

                <View style={[styles.cell, styles.totalCell, styles.totalCellBg]}>
                  <Text style={styles.totalText}>{Math.round(member.totalPaid)}</Text>
                  <Text style={styles.percentageText}>{member.percentage}%</Text>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
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
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Enregistrer un paiement</Text>
              <TouchableOpacity onPress={() => setPaymentModal(false)}>
                <Ionicons name="close" size={28} color="#333" />
              </TouchableOpacity>
            </View>

            {selectedCell && (
              <>
                <Text style={styles.modalInfo}>
                  {selectedCell.member.name} - {MONTHS[selectedCell.month - 1]}
                </Text>

                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Montant (FCFA)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder={`${activeYear.monthlyAmount}`}
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
              </>
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
  scrollContainer: {
    flex: 1,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#1976D2',
  },
  tableBody: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  cell: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: '#e0e0e0',
  },
  headerCell: {
    backgroundColor: '#1976D2',
  },
  nameCell: {
    width: 140,
    alignItems: 'flex-start',
    backgroundColor: '#fff',
  },
  monthCell: {
    width: 60,
    minHeight: 50,
  },
  totalCell: {
    width: 80,
  },
  totalCellBg: {
    backgroundColor: '#E3F2FD',
  },
  headerText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  memberName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  memberField: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  cellText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  totalText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1976D2',
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
});

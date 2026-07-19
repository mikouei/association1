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
import { 
  Calendar, 
  CaretDown, 
  MagnifyingGlass, 
  XCircle, 
  X, 
  CheckCircle 
} from 'phosphor-react-native';
import api from '../../utils/api';
import { useFocusEffect } from '@react-navigation/native';
import { formatNumber, formatCurrency } from '../../utils/format';
import { colors, spacing, borderRadius, typography } from '../../utils/theme';

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

  useFocusEffect(
    useCallback(() => {
      if (selectedYear) {
        loadPayments(selectedYear.id);
      } else {
        loadYears();
      }
    }, [selectedYear?.id])
  );

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
      
      const activeYear = yearsRes.data.find(y => y.active);
      if (activeYear) {
        setSelectedYear(activeYear);
        await loadPayments(activeYear.id);
      } else if (yearsRes.data.length > 0) {
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
      return colors.success;
    } else if (monthData.amountPaid > 0) {
      return colors.warning;
    }
    return colors.error;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!selectedYear) {
    return (
      <View style={styles.emptyContainer}>
        <Calendar size={64} color={colors.border} />
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
            <Text style={styles.headerSubtitle}>Montant mensuel: {formatNumber(selectedYear.monthlyAmount)} FCFA</Text>
          </View>
          <View style={styles.yearSelectorButton}>
            <CaretDown size={24} color={colors.textOnSecondary} weight="bold" />
          </View>
        </View>
        {selectedYear.active && (
          <View style={styles.activeBadge}>
            <Text style={styles.activeBadgeText}>Active</Text>
          </View>
        )}
      </TouchableOpacity>

      {isAdmin && (
        <View style={styles.searchContainer}>
          <MagnifyingGlass size={20} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher par nom, villa, téléphone..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <XCircle size={20} color={colors.textMuted} weight="fill" />
            </TouchableOpacity>
          )}
        </View>
      )}

      <ScrollView
        style={styles.scrollContainer}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        {filteredMembers.map((member, idx) => (
          <View key={member.id} style={styles.memberCard}>
            <View style={styles.memberCardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.memberCardName}>{member.name}</Text>
                <Text style={styles.memberCardField}>{member.customFieldValue}</Text>
              </View>
              <View style={styles.memberCardTotal}>
                <Text style={styles.memberCardTotalLabel}>Total</Text>
                <Text style={styles.memberCardTotalValue}>
                  {member.totalPaid >= 1000 
                    ? (member.totalPaid / 1000).toFixed(1).replace('.0', '') + 'k'
                    : member.totalPaid}
                </Text>
              </View>
            </View>

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
                        {monthData.amountPaid > 0 
                          ? (monthData.amountPaid >= 1000 
                              ? (monthData.amountPaid / 1000).toFixed(1).replace('.0', '') + 'k'
                              : monthData.amountPaid)
                          : '-'}
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

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: colors.success }]} />
          <Text style={styles.legendText}>Payé</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: colors.warning }]} />
          <Text style={styles.legendText}>Partiel</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: colors.error }]} />
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
                    <X size={28} color={colors.text} />
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
                        placeholder={`${formatNumber(selectedYear.monthlyAmount)}`}
                        placeholderTextColor={colors.textMuted}
                        value={paymentAmount}
                        onChangeText={(text) => {
                          const cleanedText = text.replace(/[^0-9]/g, '');
                          setPaymentAmount(cleanedText);
                        }}
                        keyboardType="numeric"
                        selectTextOnFocus={true}
                      />
                    </View>

                    <View style={styles.inputContainer}>
                      <Text style={styles.label}>Notes (optionnel)</Text>
                      <TextInput
                        style={[styles.input, styles.textArea]}
                        placeholder="Ajouter une note..."
                        placeholderTextColor={colors.textMuted}
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
                        <ActivityIndicator color={colors.textOnPrimary} />
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
                <X size={28} color={colors.text} />
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
                      {formatNumber(item.monthlyAmount)} FCFA/mois
                    </Text>
                  </View>
                  {item.active && (
                    <View style={styles.yearActiveBadge}>
                      <Text style={styles.yearActiveBadgeText}>Active</Text>
                    </View>
                  )}
                  {selectedYear?.id === item.id && (
                    <CheckCircle size={24} color={colors.primary} weight="fill" />
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
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: colors.background,
  },
  emptyText: {
    fontSize: typography.h3.fontSize + 2,
    fontWeight: '600',
    color: colors.textMuted,
    marginTop: spacing.lg,
  },
  emptySubtext: {
    fontSize: typography.caption.fontSize + 1,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  header: {
    backgroundColor: colors.secondary,
    padding: spacing.lg,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: typography.h2.fontSize,
    fontWeight: typography.h2.fontWeight,
    color: colors.textOnSecondary,
    fontFamily: typography.fontFamilyHeading,
  },
  headerSubtitle: {
    fontSize: typography.caption.fontSize + 1,
    color: colors.textOnSecondary,
    marginTop: spacing.xs,
    opacity: 0.9,
  },
  yearSelectorButton: {
    padding: spacing.xs,
  },
  activeBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.badge,
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
  },
  activeBadgeText: {
    color: colors.textOnSecondary,
    fontSize: typography.caption.fontSize,
    fontWeight: '600',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundWhite,
    margin: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.input,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    marginLeft: spacing.sm,
    fontSize: typography.body.fontSize,
    color: colors.text,
  },
  memberCard: {
    backgroundColor: colors.backgroundWhite,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    borderRadius: borderRadius.card,
    padding: spacing.md,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  memberCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  memberCardName: {
    fontSize: typography.body.fontSize,
    fontWeight: '700',
    color: colors.text,
  },
  memberCardField: {
    fontSize: typography.caption.fontSize,
    color: colors.textMuted,
    marginTop: 2,
  },
  memberCardTotal: {
    backgroundColor: colors.warningBg,
    borderRadius: borderRadius.button,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  memberCardTotalLabel: {
    fontSize: 9,
    color: colors.primary,
    fontWeight: '600',
  },
  memberCardTotalValue: {
    fontSize: typography.body.fontSize + 1,
    fontWeight: 'bold',
    color: colors.primary,
  },
  monthRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  monthCard: {
    flex: 1,
    borderRadius: borderRadius.button,
    paddingVertical: spacing.sm,
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
    fontSize: typography.caption.fontSize + 2,
    fontWeight: 'bold',
    color: colors.textOnSecondary,
    marginTop: 2,
  },
  scrollContainer: {
    flex: 1,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    padding: spacing.md,
    backgroundColor: colors.backgroundWhite,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.md,
  },
  legendColor: {
    width: 16,
    height: 16,
    borderRadius: 4,
    marginRight: spacing.sm,
  },
  legendText: {
    fontSize: typography.caption.fontSize,
    color: colors.textMuted,
  },
  noResults: {
    padding: spacing.xxl,
    alignItems: 'center',
  },
  noResultsText: {
    fontSize: typography.body.fontSize,
    color: colors.textMuted,
    textAlign: 'center',
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
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  modalTitle: {
    fontSize: typography.h2.fontSize,
    fontWeight: typography.h2.fontWeight,
    color: colors.text,
    fontFamily: typography.fontFamilyHeading,
  },
  modalInfo: {
    fontSize: typography.body.fontSize,
    color: colors.textMuted,
    marginBottom: spacing.xl,
    textAlign: 'center',
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
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  saveButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.button,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: colors.textOnPrimary,
    fontSize: typography.button.fontSize,
    fontWeight: typography.button.fontWeight,
  },
  yearModalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  yearModalContent: {
    backgroundColor: colors.backgroundWhite,
    borderTopLeftRadius: borderRadius.card,
    borderTopRightRadius: borderRadius.card,
    padding: spacing.xl,
    maxHeight: '60%',
  },
  yearModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  yearModalTitle: {
    fontSize: typography.h2.fontSize,
    fontWeight: typography.h2.fontWeight,
    color: colors.text,
    fontFamily: typography.fontFamilyHeading,
  },
  yearItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    borderRadius: borderRadius.card,
    backgroundColor: colors.borderLight,
    marginBottom: spacing.sm,
  },
  yearItemSelected: {
    backgroundColor: colors.warningBg,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  yearItemInfo: {
    flex: 1,
  },
  yearItemYear: {
    fontSize: typography.h3.fontSize + 2,
    fontWeight: 'bold',
    color: colors.text,
  },
  yearItemYearSelected: {
    color: colors.primary,
  },
  yearItemAmount: {
    fontSize: typography.caption.fontSize + 1,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  yearActiveBadge: {
    backgroundColor: colors.success,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.button,
    marginRight: spacing.md,
  },
  yearActiveBadgeText: {
    color: colors.textOnSecondary,
    fontSize: typography.caption.fontSize,
    fontWeight: '600',
  },
});

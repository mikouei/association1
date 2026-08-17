import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Modal,
  Alert,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { 
  Eye, 
  MagnifyingGlass, 
  XCircle, 
  CaretDown, 
  User,
  CheckCircle,
  Warning,
  X,
  Calendar,
  Wallet,
  SignOut,
} from 'phosphor-react-native';
import api from '../utils/api';
import { formatNumber } from '../utils/format';
import { colors, spacing, borderRadius, typography } from '../utils/theme';

const MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
const MONTHS_FULL = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

export default function AuditScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();
  
  // Vérifier que l'utilisateur est bien AUDITEUR ou ADMIN
  const isAuthorized = user?.role === 'AUDITEUR' || user?.role === 'ADMIN';
  const isAuditeurOnly = user?.role === 'AUDITEUR';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedYearId, setSelectedYearId] = useState('');
  const [yearSelectorVisible, setYearSelectorVisible] = useState(false);
  const [memberDetailModal, setMemberDetailModal] = useState({ visible: false, member: null });
  const [page, setPage] = useState(1);

  // Fonction de déconnexion pour le rôle AUDITEUR
  const handleLogout = () => {
    Alert.alert(
      'Déconnexion',
      'Voulez-vous vraiment vous déconnecter ?',
      [
        { text: 'Annuler', style: 'cancel' },
        { 
          text: 'Déconnecter', 
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/login');
          }
        }
      ]
    );
  };

  useFocusEffect(
    useCallback(() => {
      if (isAuthorized) {
        loadAuditData();
      }
    }, [selectedYearId, page])
  );

  const loadAuditData = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedYearId) params.append('yearId', selectedYearId);
      if (searchQuery.trim()) params.append('search', searchQuery.trim());
      params.append('page', page.toString());
      params.append('limit', '30');

      const response = await api.get(`/payments/audit-view?${params.toString()}`);
      setData(response.data);
    } catch (error) {
      console.error('Erreur chargement audit:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    setPage(1);
    loadAuditData();
  };

  const handleSearch = () => {
    setPage(1);
    loadAuditData();
  };

  if (!isAuthorized) {
    return (
      <View style={styles.unauthorizedContainer}>
        <Eye size={64} color={colors.error} weight="duotone" />
        <Text style={styles.unauthorizedTitle}>Accès non autorisé</Text>
        <Text style={styles.unauthorizedText}>
          Cette section est réservée aux auditeurs et administrateurs.
        </Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const getPaymentStatus = (member) => {
    if (!data?.selectedYear) return { color: colors.textMuted, icon: 'unknown' };
    const percentage = member.monthly.totalDue > 0 
      ? (member.monthly.totalPaid / member.monthly.totalDue) * 100 
      : 0;
    if (percentage >= 100) return { color: colors.success, icon: 'paid' };
    if (percentage >= 50) return { color: colors.warning, icon: 'partial' };
    return { color: colors.error, icon: 'unpaid' };
  };

  const renderMemberItem = ({ item }) => {
    const status = getPaymentStatus(item);
    
    return (
      <TouchableOpacity 
        style={styles.memberCard}
        onPress={() => setMemberDetailModal({ visible: true, member: item })}
        activeOpacity={0.7}
      >
        <View style={styles.memberHeader}>
          <View style={[styles.memberAvatar, { backgroundColor: status.color + '20' }]}>
            <User size={24} color={status.color} weight="duotone" />
          </View>
          <View style={styles.memberInfo}>
            <Text style={styles.memberName}>{item.name}</Text>
            <Text style={styles.memberField}>{item.customFieldValue}</Text>
          </View>
          <View style={styles.memberStatus}>
            {status.icon === 'paid' ? (
              <CheckCircle size={24} color={colors.success} weight="fill" />
            ) : status.icon === 'partial' ? (
              <Warning size={24} color={colors.warning} weight="fill" />
            ) : (
              <XCircle size={24} color={colors.error} weight="fill" />
            )}
          </View>
        </View>

        {/* Mini grille des mois */}
        <View style={styles.monthsGrid}>
          {MONTHS.map((month, idx) => {
            const monthData = item.monthly.paymentsByMonth[idx + 1];
            let bgColor = colors.border;
            if (monthData) {
              if (monthData.paid) bgColor = colors.success;
              else if (monthData.amountPaid > 0) bgColor = colors.warning;
              else bgColor = colors.error + '40';
            }
            return (
              <View key={idx} style={[styles.monthDot, { backgroundColor: bgColor }]}>
                <Text style={styles.monthDotText}>{month}</Text>
              </View>
            );
          })}
        </View>

        {/* Total */}
        <View style={styles.memberTotal}>
          <Text style={styles.memberTotalLabel}>Total payé</Text>
          <Text style={[styles.memberTotalValue, { color: status.color }]}>
            {formatNumber(item.monthly.totalPaid)} / {formatNumber(item.monthly.totalDue)} FCFA
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderHeader = () => (
    <View style={styles.headerSection}>
      {/* Stats */}
      {data?.stats && (
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{data.stats.membersCount}</Text>
            <Text style={styles.statLabel}>Membres</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: colors.success }]}>
              {formatNumber(data.stats.totalPaid)}
            </Text>
            <Text style={styles.statLabel}>Collecté (FCFA)</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: colors.warning }]}>
              {data.stats.percentage}%
            </Text>
            <Text style={styles.statLabel}>Taux</Text>
          </View>
        </View>
      )}

      {/* Filtres */}
      <View style={styles.filtersRow}>
        {/* Sélecteur d'année */}
        <TouchableOpacity 
          style={styles.yearSelector}
          onPress={() => setYearSelectorVisible(true)}
        >
          <Calendar size={18} color={colors.textMuted} />
          <Text style={styles.yearSelectorText}>
            {data?.selectedYear ? data.selectedYear.year : 'Année'}
          </Text>
          <CaretDown size={16} color={colors.textMuted} />
        </TouchableOpacity>

        {/* Recherche */}
        <View style={styles.searchContainer}>
          <MagnifyingGlass size={18} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => { setSearchQuery(''); handleSearch(); }}>
              <XCircle size={18} color={colors.textMuted} weight="fill" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Chargement des données...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header fixe */}
      <View style={styles.header}>
        {isAuditeurOnly ? (
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <SignOut size={24} color={colors.textOnPrimary} />
          </TouchableOpacity>
        ) : (
          <View style={styles.headerIcon}>
            <Eye size={24} color={colors.primary} weight="fill" />
          </View>
        )}
        <Text style={styles.headerTitle}>Consultation</Text>
        {isAuditeurOnly ? (
          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText}>Auditeur</Text>
          </View>
        ) : (
          <Text style={styles.headerSubtitle}>Lecture seule</Text>
        )}
      </View>

      <FlatList
        data={data?.members || []}
        renderItem={renderMemberItem}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
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
            <Wallet size={64} color={colors.border} />
            <Text style={styles.emptyText}>Aucun membre trouvé</Text>
          </View>
        )}
      />

      {/* Modal sélecteur d'année */}
      <Modal
        visible={yearSelectorVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setYearSelectorVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Sélectionner une année</Text>
              <TouchableOpacity onPress={() => setYearSelectorVisible(false)}>
                <X size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            {data?.years?.map((year) => (
              <TouchableOpacity
                key={year.id}
                style={[
                  styles.yearOption,
                  selectedYearId === year.id && styles.yearOptionSelected
                ]}
                onPress={() => {
                  setSelectedYearId(year.id);
                  setYearSelectorVisible(false);
                  setPage(1);
                }}
              >
                <Text style={styles.yearOptionText}>{year.year}</Text>
                {year.active && (
                  <View style={styles.activeBadge}>
                    <Text style={styles.activeBadgeText}>Active</Text>
                  </View>
                )}
                {selectedYearId === year.id && (
                  <CheckCircle size={20} color={colors.primary} weight="fill" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      {/* Modal détail membre */}
      <Modal
        visible={memberDetailModal.visible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setMemberDetailModal({ visible: false, member: null })}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '80%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Détail membre</Text>
              <TouchableOpacity onPress={() => setMemberDetailModal({ visible: false, member: null })}>
                <X size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            {memberDetailModal.member && (
              <View style={styles.memberDetailContent}>
                <View style={styles.memberDetailHeader}>
                  <View style={styles.memberDetailAvatar}>
                    <User size={32} color={colors.primary} weight="duotone" />
                  </View>
                  <View>
                    <Text style={styles.memberDetailName}>{memberDetailModal.member.name}</Text>
                    <Text style={styles.memberDetailField}>{memberDetailModal.member.customFieldValue}</Text>
                    {memberDetailModal.member.phone && (
                      <Text style={styles.memberDetailPhone}>{memberDetailModal.member.phone}</Text>
                    )}
                  </View>
                </View>

                {/* Grille des mois détaillée */}
                <Text style={styles.sectionTitle}>Cotisations mensuelles</Text>
                <View style={styles.monthsDetailGrid}>
                  {MONTHS_FULL.map((month, idx) => {
                    const monthData = memberDetailModal.member.monthly.paymentsByMonth[idx + 1];
                    const isPaid = monthData?.paid;
                    const isPartial = monthData?.amountPaid > 0 && !isPaid;
                    return (
                      <View key={idx} style={styles.monthDetailItem}>
                        <Text style={styles.monthDetailLabel}>{month.substring(0, 3)}</Text>
                        <View style={[
                          styles.monthDetailStatus,
                          { backgroundColor: isPaid ? colors.success : isPartial ? colors.warning : colors.border }
                        ]}>
                          <Text style={styles.monthDetailAmount}>
                            {monthData ? formatNumber(monthData.amountPaid) : '0'}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>

                {/* Paiements exceptionnels */}
                {memberDetailModal.member.exceptional.recentPayments.length > 0 && (
                  <>
                    <Text style={styles.sectionTitle}>Paiements exceptionnels récents</Text>
                    {memberDetailModal.member.exceptional.recentPayments.map((payment) => (
                      <View key={payment.id} style={styles.exceptionalItem}>
                        <View>
                          <Text style={styles.exceptionalTitle}>{payment.contributionTitle}</Text>
                          <Text style={styles.exceptionalDate}>
                            {new Date(payment.paymentDate).toLocaleDateString('fr-FR')}
                          </Text>
                        </View>
                        <Text style={styles.exceptionalAmount}>
                          {formatNumber(payment.amount)} FCFA
                        </Text>
                      </View>
                    ))}
                  </>
                )}

                {/* Total */}
                <View style={styles.totalSection}>
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Total mensuel</Text>
                    <Text style={styles.totalValue}>
                      {formatNumber(memberDetailModal.member.monthly.totalPaid)} / {formatNumber(memberDetailModal.member.monthly.totalDue)} FCFA
                    </Text>
                  </View>
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Total exceptionnel</Text>
                    <Text style={styles.totalValue}>
                      {formatNumber(memberDetailModal.member.exceptional.totalPaid)} FCFA
                    </Text>
                  </View>
                </View>
              </View>
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
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    marginTop: spacing.lg,
    fontSize: typography.body.fontSize,
    color: colors.textMuted,
  },
  unauthorizedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: spacing.xl,
  },
  unauthorizedTitle: {
    fontSize: typography.h2.fontSize,
    fontWeight: '600',
    color: colors.text,
    marginTop: spacing.lg,
  },
  unauthorizedText: {
    fontSize: typography.body.fontSize,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  backButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.button,
  },
  backButtonText: {
    color: colors.textOnPrimary,
    fontSize: typography.body.fontSize,
    fontWeight: '600',
  },
  header: {
    backgroundColor: colors.secondary,
    paddingTop: 50,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  headerTitle: {
    fontSize: typography.h2.fontSize,
    fontWeight: '700',
    color: colors.textOnPrimary,
    flex: 1,
  },
  headerSubtitle: {
    fontSize: typography.caption.fontSize,
    color: colors.textOnPrimary + '80',
    backgroundColor: colors.textOnPrimary + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.badge,
  },
  listContent: {
    padding: spacing.lg,
    paddingBottom: 100,
  },
  headerSection: {
    marginBottom: spacing.lg,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.backgroundWhite,
    borderRadius: borderRadius.card,
    padding: spacing.md,
    alignItems: 'center',
  },
  statValue: {
    fontSize: typography.h3.fontSize,
    fontWeight: '700',
    color: colors.text,
  },
  statLabel: {
    fontSize: typography.caption.fontSize,
    color: colors.textMuted,
    marginTop: 2,
  },
  filtersRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  yearSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundWhite,
    borderRadius: borderRadius.input,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  yearSelectorText: {
    fontSize: typography.body.fontSize,
    color: colors.text,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundWhite,
    borderRadius: borderRadius.input,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.sm,
    fontSize: typography.body.fontSize,
    color: colors.text,
  },
  memberCard: {
    backgroundColor: colors.backgroundWhite,
    borderRadius: borderRadius.card,
    padding: spacing.md,
    marginBottom: spacing.md,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  memberHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  memberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
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
    fontSize: typography.caption.fontSize,
    color: colors.textMuted,
  },
  memberStatus: {
    marginLeft: spacing.sm,
  },
  monthsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  monthDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  monthDotText: {
    fontSize: 9,
    fontWeight: '600',
    color: colors.backgroundWhite,
  },
  memberTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  memberTotalLabel: {
    fontSize: typography.caption.fontSize,
    color: colors.textMuted,
  },
  memberTotalValue: {
    fontSize: typography.body.fontSize,
    fontWeight: '600',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.backgroundWhite,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.xl,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  modalTitle: {
    fontSize: typography.h2.fontSize,
    fontWeight: '700',
    color: colors.text,
  },
  yearOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  yearOptionSelected: {
    backgroundColor: colors.primary + '10',
  },
  yearOptionText: {
    flex: 1,
    fontSize: typography.body.fontSize,
    fontWeight: '500',
    color: colors.text,
  },
  activeBadge: {
    backgroundColor: colors.success + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.badge,
    marginRight: spacing.sm,
  },
  activeBadgeText: {
    fontSize: typography.caption.fontSize,
    color: colors.success,
    fontWeight: '500',
  },
  memberDetailContent: {
    maxHeight: '100%',
  },
  memberDetailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  memberDetailAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  memberDetailName: {
    fontSize: typography.h3.fontSize,
    fontWeight: '700',
    color: colors.text,
  },
  memberDetailField: {
    fontSize: typography.body.fontSize,
    color: colors.textMuted,
  },
  memberDetailPhone: {
    fontSize: typography.caption.fontSize,
    color: colors.textMuted,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: typography.body.fontSize,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.md,
    marginTop: spacing.md,
  },
  monthsDetailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  monthDetailItem: {
    width: '23%',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  monthDetailLabel: {
    fontSize: typography.caption.fontSize,
    color: colors.textMuted,
    marginBottom: 2,
  },
  monthDetailStatus: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.badge,
    minWidth: 50,
    alignItems: 'center',
  },
  monthDetailAmount: {
    fontSize: typography.caption.fontSize,
    fontWeight: '600',
    color: colors.backgroundWhite,
  },
  exceptionalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  exceptionalTitle: {
    fontSize: typography.body.fontSize,
    fontWeight: '500',
    color: colors.text,
  },
  exceptionalDate: {
    fontSize: typography.caption.fontSize,
    color: colors.textMuted,
  },
  exceptionalAmount: {
    fontSize: typography.body.fontSize,
    fontWeight: '600',
    color: colors.success,
  },
  totalSection: {
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 2,
    borderTopColor: colors.border,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  totalLabel: {
    fontSize: typography.body.fontSize,
    color: colors.textMuted,
  },
  totalValue: {
    fontSize: typography.body.fontSize,
    fontWeight: '600',
    color: colors.text,
  },
  logoutButton: {
    padding: spacing.xs,
  },
  roleBadge: {
    backgroundColor: colors.textOnPrimary + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.badge,
  },
  roleBadgeText: {
    fontSize: typography.caption.fontSize,
    fontWeight: '600',
    color: colors.textOnPrimary,
  },
});

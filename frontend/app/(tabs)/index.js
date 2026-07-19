import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { 
  UserCircle, 
  Users, 
  CheckCircle, 
  XCircle, 
  ArrowsClockwise,
  Calendar,
  WarningCircle,
  Clock
} from 'phosphor-react-native';
import api from '../../utils/api';
import { useFocusEffect } from '@react-navigation/native';
import { formatNumber, formatCurrency } from '../../utils/format';
import { colors, spacing, borderRadius, typography } from '../../utils/theme';

export default function Dashboard() {
  const { user, association } = useAuth();
  const [config, setConfig] = useState(null);
  const [memberStats, setMemberStats] = useState(null);
  const [paymentStats, setPaymentStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const loadData = async () => {
    try {
      const [configRes, membersRes, yearsRes] = await Promise.all([
        api.get('/config'),
        api.get('/members'),
        api.get('/years'),
      ]);

      setConfig(configRes.data);
      
      const members = membersRes.data;
      setMemberStats({
        totalMembers: members.length,
        activeMembers: members.filter(m => m.active).length,
        inactiveMembers: members.filter(m => !m.active).length,
      });

      // Charger les stats de paiement pour l'année active
      const years = yearsRes.data;
      const activeYear = years.find(y => y.active);
      if (activeYear) {
        try {
          const paymentsRes = await api.get(`/payments/year/${activeYear.id}`);
          const paymentMembers = paymentsRes.data.members || paymentsRes.data;
          
          const totalMembers = paymentMembers.length;
          const monthlyAmount = activeYear.monthlyAmount;
          const totalExpected = totalMembers * monthlyAmount * 12;
          
          let totalCollected = 0;
          let membersFullyPaid = 0;
          
          paymentMembers.forEach(member => {
            const memberTotal = member.totalPaid || 0;
            totalCollected += memberTotal;
            if (memberTotal >= monthlyAmount * 12) {
              membersFullyPaid++;
            }
          });
          
          const remaining = totalExpected - totalCollected;
          const rate = totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 100) : 0;
          
          setPaymentStats({
            year: activeYear.year,
            monthlyAmount,
            totalExpected,
            totalCollected,
            remaining,
            rate,
            membersFullyPaid,
            membersPending: totalMembers - membersFullyPaid,
          });
        } catch (e) {
          console.log('Pas de stats paiement:', e.message);
          setPaymentStats({ noYear: false, error: true });
        }
      } else {
        setPaymentStats({ noYear: true, yearCount: years.length });
      }
    } catch (error) {
      console.error('Erreur chargement données:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // Utiliser formatNumber pour les grands nombres
  const formatAmount = (amount) => {
    return formatNumber(amount);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl 
          refreshing={refreshing} 
          onRefresh={onRefresh} 
          colors={[colors.primary]}
          tintColor={colors.primary}
        />
      }
    >
      <View style={styles.header}>
        <Text style={styles.title}>{association?.name || config?.name || 'Mon Association'}</Text>
        <Text style={styles.subtitle}>{config?.type || association?.type || 'Association'}</Text>
      </View>

      <View style={styles.welcomeCard}>
        <View style={styles.welcomeRow}>
          <UserCircle size={40} color={colors.primary} weight="fill" />
          <View style={styles.welcomeInfo}>
            <Text style={styles.welcomeText}>{user?.member?.name || 'Administrateur'}</Text>
            <Text style={styles.roleText}>
              {user?.role === 'ADMIN' ? 'Administrateur' : 'Membre'}
              {association ? ` · ${association.code}` : ''}
            </Text>
          </View>
        </View>
      </View>

      {/* Statistiques membres */}
      {user?.role === 'ADMIN' && memberStats && (
        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>Membres</Text>
          <View style={styles.statsGrid}>
            <View style={[styles.statCard, { backgroundColor: colors.accentTeal }]}>
              <Users size={28} color={colors.textOnSecondary} weight="fill" />
              <Text style={styles.statNumber}>{memberStats.totalMembers}</Text>
              <Text style={styles.statLabel}>Total</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: colors.success }]}>
              <CheckCircle size={28} color={colors.textOnSecondary} weight="fill" />
              <Text style={styles.statNumber}>{memberStats.activeMembers}</Text>
              <Text style={styles.statLabel}>Actifs</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: colors.warning }]}>
              <XCircle size={28} color={colors.textOnSecondary} weight="fill" />
              <Text style={styles.statNumber}>{memberStats.inactiveMembers}</Text>
              <Text style={styles.statLabel}>Inactifs</Text>
            </View>
          </View>
        </View>
      )}

      {/* Statistiques cotisations */}
      {user?.role === 'ADMIN' && paymentStats && (
        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>
            Cotisations {paymentStats.year || ''}
          </Text>
          
          {paymentStats.noYear ? (
            <View style={styles.noDataContainer}>
              <Calendar size={32} color={colors.textMuted} />
              <Text style={styles.noDataText}>
                {paymentStats.yearCount > 0
                  ? 'Aucune année active. Activez une année dans Paramètres.'
                  : 'Créez une année dans Paramètres pour voir les statistiques.'}
              </Text>
            </View>
          ) : paymentStats.error ? (
            <View style={styles.noDataContainer}>
              <WarningCircle size={32} color={colors.warning} />
              <Text style={styles.noDataText}>Erreur de chargement des statistiques</Text>
            </View>
          ) : (
            <>
              <View style={styles.paymentStatsGrid}>
                <View style={styles.paymentStatRow}>
                  <View style={[styles.paymentStatCard, { borderLeftColor: colors.secondary }]}>
                    <Text style={styles.paymentStatLabel}>Attendu</Text>
                    <Text style={[styles.paymentStatValue, { color: colors.secondary }]}>{formatAmount(paymentStats.totalExpected)} FCFA</Text>
                  </View>
                  <View style={[styles.paymentStatCard, { borderLeftColor: colors.success }]}>
                    <Text style={styles.paymentStatLabel}>Collecté</Text>
                    <Text style={[styles.paymentStatValue, { color: colors.success }]}>{formatAmount(paymentStats.totalCollected)} FCFA</Text>
                  </View>
                </View>
                <View style={styles.paymentStatRow}>
                  <View style={[styles.paymentStatCard, { borderLeftColor: colors.warning }]}>
                    <Text style={styles.paymentStatLabel}>Reste</Text>
                    <Text style={[styles.paymentStatValue, { color: colors.warning }]}>{formatAmount(paymentStats.remaining)} FCFA</Text>
                  </View>
                  <View style={[styles.paymentStatCard, { borderLeftColor: paymentStats.rate >= 70 ? colors.success : paymentStats.rate >= 40 ? colors.warning : colors.error }]}>
                    <Text style={styles.paymentStatLabel}>Taux recouvrement</Text>
                    <Text style={[styles.paymentStatValue, { color: paymentStats.rate >= 70 ? colors.success : paymentStats.rate >= 40 ? colors.warning : colors.error }]}>{paymentStats.rate}%</Text>
                  </View>
                </View>
              </View>

              <View style={styles.paymentMembersRow}>
                <View style={styles.paymentMemberItem}>
                  <CheckCircle size={18} color={colors.success} weight="fill" />
                  <Text style={styles.paymentMemberText}>{paymentStats.membersFullyPaid} à jour</Text>
                </View>
                <View style={styles.paymentMemberItem}>
                  <Clock size={18} color={colors.warning} weight="fill" />
                  <Text style={styles.paymentMemberText}>{paymentStats.membersPending} en retard</Text>
                </View>
              </View>
            </>
          )}
        </View>
      )}

      <TouchableOpacity style={styles.syncButton} onPress={onRefresh}>
        <ArrowsClockwise size={20} color={colors.textOnPrimary} weight="bold" />
        <Text style={styles.syncButtonText}>Synchroniser</Text>
      </TouchableOpacity>
    </ScrollView>
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
  header: {
    backgroundColor: colors.secondary,
    padding: spacing.md,
    paddingTop: spacing.lg,
    alignItems: 'center',
  },
  title: {
    fontSize: typography.h2.fontSize,
    fontWeight: typography.h2.fontWeight,
    color: colors.textOnSecondary,
    fontFamily: typography.fontFamilyHeading,
  },
  subtitle: {
    fontSize: typography.caption.fontSize,
    color: colors.textOnSecondary,
    marginTop: spacing.xs,
    opacity: 0.9,
  },
  welcomeCard: {
    backgroundColor: colors.backgroundWhite,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    padding: spacing.lg,
    borderRadius: borderRadius.card,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  welcomeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  welcomeInfo: {
    flex: 1,
  },
  welcomeText: {
    fontSize: typography.body.fontSize + 1,
    fontWeight: '600',
    color: colors.text,
  },
  roleText: {
    fontSize: typography.caption.fontSize,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  statsSection: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.backgroundWhite,
    borderRadius: borderRadius.card,
    padding: spacing.md,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  sectionTitle: {
    fontSize: typography.h3.fontSize,
    fontWeight: typography.h3.fontWeight,
    color: colors.text,
    fontFamily: typography.fontFamilyHeading,
    marginBottom: spacing.sm,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statCard: {
    flex: 1,
    padding: spacing.md,
    borderRadius: borderRadius.card,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: typography.h2.fontSize,
    fontWeight: 'bold',
    color: colors.textOnSecondary,
    marginTop: spacing.xs,
  },
  statLabel: {
    fontSize: typography.tabLabel.fontSize,
    color: colors.textOnSecondary,
    marginTop: 2,
    textAlign: 'center',
    opacity: 0.9,
  },
  paymentStatsGrid: {
    gap: spacing.sm,
  },
  paymentStatRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  paymentStatCard: {
    flex: 1,
    backgroundColor: colors.borderLight,
    borderRadius: borderRadius.button,
    padding: spacing.md,
    borderLeftWidth: 3,
  },
  paymentStatLabel: {
    fontSize: typography.tabLabel.fontSize,
    color: colors.textMuted,
    fontWeight: '500',
  },
  paymentStatValue: {
    fontSize: typography.body.fontSize,
    fontWeight: 'bold',
    marginTop: spacing.xs,
  },
  paymentMembersRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  paymentMemberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  paymentMemberText: {
    fontSize: typography.caption.fontSize + 1,
    color: colors.textMuted,
    fontWeight: '500',
  },
  noDataContainer: {
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
  },
  noDataText: {
    fontSize: typography.caption.fontSize + 1,
    color: colors.textMuted,
    textAlign: 'center',
  },
  syncButton: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
    padding: spacing.md,
    borderRadius: borderRadius.button,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  syncButtonText: {
    color: colors.textOnPrimary,
    fontSize: typography.button.fontSize,
    fontWeight: typography.button.fontWeight,
  },
});

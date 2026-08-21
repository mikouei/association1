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
import { useRouter } from 'expo-router';
import { 
  UserCircle, 
  Users, 
  CheckCircle, 
  XCircle, 
  ArrowsClockwise,
  Calendar,
  WarningCircle,
  Clock,
  Rocket,
  CurrencyCircleDollar,
  UsersThree,
} from 'phosphor-react-native';
import api from '../../utils/api';
import { useFocusEffect } from '@react-navigation/native';
import { formatNumber, formatCurrency, formatAmount } from '../../utils/format';
import { colors, spacing, borderRadius, typography } from '../../utils/theme';

export default function Dashboard() {
  const { user, association } = useAuth();
  const router = useRouter();
  const isAdmin = user?.role === 'ADMIN';
  const [config, setConfig] = useState(null);
  const [memberStats, setMemberStats] = useState(null);
  const [paymentStats, setPaymentStats] = useState(null);
  const [yearsCount, setYearsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // État pour les données membre (non-admin)
  const [myPaymentData, setMyPaymentData] = useState(null);
  const [myExceptionalData, setMyExceptionalData] = useState(null);
  const [myTontinesData, setMyTontinesData] = useState(null);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const loadData = async () => {
    try {
      // Requêtes communes à tous les rôles
      const commonRequests = [
        api.get('/config'),
        api.get('/years'),
      ];
      
      // Requêtes réservées aux admins
      if (isAdmin) {
        commonRequests.push(api.get('/members'));
      }
      
      const results = await Promise.all(commonRequests);
      
      const configRes = results[0];
      const yearsRes = results[1];
      const membersRes = isAdmin ? results[2] : null;

      setConfig(configRes.data);
      
      // Stats membres uniquement pour les admins
      if (isAdmin && membersRes) {
        const members = membersRes.data;
        setMemberStats({
          totalMembers: members.length,
          activeMembers: members.filter(m => m.active).length,
          inactiveMembers: members.filter(m => !m.active).length,
        });
      }

      // Stocker le nombre d'années
      const years = yearsRes.data;
      setYearsCount(years.length);

      // Charger les stats de paiement pour l'année active
      const activeYear = years.find(y => y.active);
      if (activeYear) {
        if (isAdmin) {
          // Stats admin - tous les membres
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
          // Stats membre - ses propres données
          try {
            const myPaymentsRes = await api.get(`/payments/my/year/${activeYear.id}`);
            const myData = myPaymentsRes.data.members?.[0];
            
            if (myData) {
              const monthlyAmount = activeYear.monthlyAmount;
              const totalDue = monthlyAmount * 12;
              const paidMonths = Object.values(myData.paymentsByMonth || {}).filter(m => m.paid).length;
              
              setMyPaymentData({
                year: activeYear.year,
                monthlyAmount,
                totalPaid: myData.totalPaid || 0,
                totalDue,
                paidMonths,
                percentage: myData.percentage || 0,
              });
            }
          } catch (e) {
            console.log('Pas de données paiement membre:', e.message);
          }
          
          // Charger les cotisations exceptionnelles
          try {
            const exceptionalRes = await api.get('/exceptional/mine');
            const pendingExceptional = exceptionalRes.data.filter(c => c.active && c.myAmountPaid === 0);
            setMyExceptionalData(pendingExceptional);
          } catch (e) {
            console.log('Pas de cotisations exceptionnelles:', e.message);
          }
          
          // Charger mes tontines
          try {
            const tontinesRes = await api.get('/tontines/mine');
            setMyTontinesData(tontinesRes.data);
          } catch (e) {
            console.log('Pas de tontines:', e.message);
          }
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

      {/* Carte Mes Cotisations - visible uniquement pour les MEMBRES */}
      {!isAdmin && user?.member && myPaymentData && (
        <View style={styles.myPaymentCard}>
          <View style={styles.myPaymentHeader}>
            <CurrencyCircleDollar size={24} color={colors.primary} weight="duotone" />
            <Text style={styles.myPaymentTitle}>Mes cotisations {myPaymentData.year}</Text>
          </View>
          
          <View style={styles.myPaymentProgress}>
            <View style={styles.progressBarContainer}>
              <View 
                style={[
                  styles.progressBar, 
                  { width: `${Math.min(myPaymentData.percentage, 100)}%` }
                ]} 
              />
            </View>
            <Text style={styles.progressText}>
              {myPaymentData.paidMonths}/12 mois payés
            </Text>
          </View>
          
          <View style={styles.myPaymentStats}>
            <View style={styles.myPaymentStat}>
              <Text style={styles.myPaymentStatLabel}>Payé</Text>
              <Text style={styles.myPaymentStatValue}>{formatAmount(myPaymentData.totalPaid)} FCFA</Text>
            </View>
            <View style={styles.myPaymentStatDivider} />
            <View style={styles.myPaymentStat}>
              <Text style={styles.myPaymentStatLabel}>Restant</Text>
              <Text style={[styles.myPaymentStatValue, { color: myPaymentData.totalDue - myPaymentData.totalPaid > 0 ? colors.warning : colors.success }]}>
                {formatAmount(myPaymentData.totalDue - myPaymentData.totalPaid)} FCFA
              </Text>
            </View>
          </View>
          
          <TouchableOpacity 
            style={styles.myPaymentButton}
            onPress={() => router.push('/(tabs)/cotisations')}
          >
            <Text style={styles.myPaymentButtonText}>Voir le détail</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Alerte cotisation exceptionnelle en attente */}
      {!isAdmin && user?.member && myExceptionalData && myExceptionalData.length > 0 && (
        <TouchableOpacity 
          style={styles.exceptionalAlert}
          onPress={() => router.push('/(tabs)/exceptionnelles')}
        >
          <WarningCircle size={20} color={colors.warning} weight="fill" />
          <Text style={styles.exceptionalAlertText}>
            Cotisation exceptionnelle en attente : {myExceptionalData[0].title}
          </Text>
        </TouchableOpacity>
      )}

      {/* Cartes Mes Tontines - visible uniquement pour les MEMBRES */}
      {!isAdmin && user?.member && myTontinesData && myTontinesData.length > 0 && myTontinesData.map((t) => (
        <View key={t.tontineId} style={styles.myTontineCard}>
          <View style={styles.myTontineHeader}>
            <UsersThree size={24} color={colors.primary} weight="duotone" />
            <Text style={styles.myTontineTitle}>{t.name}</Text>
          </View>

          {t.status === 'completed' ? (
            <Text style={styles.myTontineStatusText}>Cycle terminé — tout le monde a reçu.</Text>
          ) : (
            <>
              <Text style={styles.myTontineRound}>Tour {t.currentRound}</Text>
              {t.isMyTurnNow ? (
                <Text style={styles.myTontineTurnText}>C{"'"}est votre tour de recevoir ce cycle !</Text>
              ) : (
                <Text style={styles.myTontineAmountText}>
                  À verser ce tour : {formatAmount(t.amount)} FCFA
                </Text>
              )}
              <View style={[
                styles.myTontineBadge,
                t.isMyTurnNow
                  ? styles.myTontineBadgeTurn
                  : (t.currentRoundPaid ? styles.myTontineBadgePaid : styles.myTontineBadgePending)
              ]}>
                <Text style={styles.myTontineBadgeText}>
                  {t.isMyTurnNow ? 'Bénéficiaire ce tour' : (t.currentRoundPaid ? 'Payé' : 'À payer')}
                </Text>
              </View>
            </>
          )}

          {t.hasReceived && (
            <Text style={styles.myTontineReceivedText}>
              Vous avez déjà reçu au tour {t.receivedRound}.
            </Text>
          )}
        </View>
      ))}

      {/* Carte Premiers pas - visible uniquement si association vide */}
      {isAdmin && (yearsCount === 0 || (memberStats && memberStats.totalMembers === 0)) && (
        <View style={styles.onboardingCard}>
          <View style={styles.onboardingHeader}>
            <Rocket size={24} color={colors.primary} weight="duotone" />
            <Text style={styles.onboardingTitle}>Bienvenue ! Encore quelques étapes</Text>
          </View>
          
          <TouchableOpacity
            style={styles.onboardingItem}
            onPress={() => router.push('/(tabs)/parametres')}
          >
            <View style={[styles.onboardingCheck, yearsCount > 0 && styles.onboardingCheckDone]}>
              {yearsCount > 0 ? (
                <CheckCircle size={20} weight="fill" color={colors.success} />
              ) : (
                <CurrencyCircleDollar size={20} color={colors.textMuted} />
              )}
            </View>
            <View style={styles.onboardingItemContent}>
              <Text style={[styles.onboardingItemTitle, yearsCount > 0 && styles.onboardingItemDone]}>
                Créer votre première année de cotisation
              </Text>
              {yearsCount === 0 && (
                <Text style={styles.onboardingItemHint}>Définir le montant mensuel à collecter</Text>
              )}
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.onboardingItem}
            onPress={() => router.push('/(tabs)/membres')}
          >
            <View style={[styles.onboardingCheck, memberStats?.totalMembers > 0 && styles.onboardingCheckDone]}>
              {memberStats?.totalMembers > 0 ? (
                <CheckCircle size={20} weight="fill" color={colors.success} />
              ) : (
                <UsersThree size={20} color={colors.textMuted} />
              )}
            </View>
            <View style={styles.onboardingItemContent}>
              <Text style={[styles.onboardingItemTitle, memberStats?.totalMembers > 0 && styles.onboardingItemDone]}>
                Ajouter vos premiers membres
              </Text>
              {memberStats?.totalMembers === 0 && (
                <Text style={styles.onboardingItemHint}>Ajout manuel ou import depuis un fichier</Text>
              )}
            </View>
          </TouchableOpacity>
        </View>
      )}

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
  // Onboarding card styles
  onboardingCard: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.card,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  onboardingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  onboardingTitle: {
    fontSize: typography.body.fontSize,
    fontWeight: '600',
    color: colors.primary,
    flex: 1,
  },
  onboardingItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  onboardingCheck: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  onboardingCheckDone: {
    backgroundColor: colors.successBackground,
  },
  onboardingItemContent: {
    flex: 1,
  },
  onboardingItemTitle: {
    fontSize: typography.body.fontSize,
    fontWeight: '500',
    color: colors.text,
  },
  onboardingItemDone: {
    textDecorationLine: 'line-through',
    color: colors.textMuted,
  },
  onboardingItemHint: {
    fontSize: typography.caption.fontSize,
    color: colors.textMuted,
    marginTop: 2,
  },
  // Carte "Mes cotisations" pour les membres
  myPaymentCard: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    backgroundColor: colors.backgroundWhite,
    borderRadius: borderRadius.card,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  myPaymentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  myPaymentTitle: {
    fontSize: typography.body.fontSize,
    fontWeight: 'bold',
    color: colors.text,
  },
  myPaymentProgress: {
    marginBottom: spacing.md,
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: colors.borderLight,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: spacing.xs,
  },
  progressBar: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
  progressText: {
    fontSize: typography.caption.fontSize,
    color: colors.textMuted,
    textAlign: 'right',
  },
  myPaymentStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  myPaymentStat: {
    flex: 1,
    alignItems: 'center',
  },
  myPaymentStatDivider: {
    width: 1,
    height: 30,
    backgroundColor: colors.border,
  },
  myPaymentStatLabel: {
    fontSize: typography.caption.fontSize,
    color: colors.textMuted,
    marginBottom: 2,
  },
  myPaymentStatValue: {
    fontSize: typography.body.fontSize,
    fontWeight: 'bold',
    color: colors.text,
  },
  myPaymentButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.button,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  myPaymentButtonText: {
    color: colors.textOnPrimary,
    fontSize: typography.button.fontSize,
    fontWeight: '600',
  },
  // Alerte cotisation exceptionnelle
  exceptionalAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    backgroundColor: colors.warningBg,
    borderRadius: borderRadius.button,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.warning,
  },
  exceptionalAlertText: {
    flex: 1,
    fontSize: typography.caption.fontSize + 1,
    color: colors.warning,
    fontWeight: '500',
  },
  // Carte "Mes Tontines" pour les membres
  myTontineCard: {
    backgroundColor: colors.backgroundWhite,
    borderRadius: borderRadius.card,
    padding: spacing.lg,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  myTontineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  myTontineTitle: {
    fontSize: typography.h3.fontSize,
    fontWeight: '600',
    color: colors.text,
    marginLeft: spacing.sm,
  },
  myTontineRound: {
    fontSize: typography.body.fontSize,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  myTontineTurnText: {
    fontSize: typography.body.fontSize,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: spacing.sm,
  },
  myTontineAmountText: {
    fontSize: typography.body.fontSize,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  myTontineStatusText: {
    fontSize: typography.body.fontSize,
    color: colors.textMuted,
  },
  myTontineBadge: {
    alignSelf: 'flex-start',
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  myTontineBadgeTurn: {
    backgroundColor: colors.primary,
  },
  myTontineBadgePaid: {
    backgroundColor: colors.success,
  },
  myTontineBadgePending: {
    backgroundColor: colors.warning,
  },
  myTontineBadgeText: {
    fontSize: typography.caption.fontSize,
    fontWeight: '600',
    color: colors.textOnPrimary,
  },
  myTontineReceivedText: {
    fontSize: typography.caption.fontSize,
    color: colors.success,
    marginTop: spacing.sm,
  },
});
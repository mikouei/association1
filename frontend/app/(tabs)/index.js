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
import { Ionicons } from '@expo/vector-icons';
import api from '../../utils/api';
import { useFocusEffect } from '@react-navigation/native';

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

  const formatAmount = (amount) => {
    if (amount >= 1000000) return (amount / 1000000).toFixed(1) + 'M';
    if (amount >= 1000) return Math.round(amount / 1000) + 'k';
    return amount.toString();
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.header}>
        <Text style={styles.title}>{association?.name || config?.name || 'Mon Association'}</Text>
        <Text style={styles.subtitle}>{config?.type || association?.type || 'Association'}</Text>
      </View>

      <View style={styles.welcomeCard}>
        <View style={styles.welcomeRow}>
          <Ionicons name="person-circle" size={36} color="#2196F3" />
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
            <View style={[styles.statCard, { backgroundColor: '#4CAF50' }]}>
              <Ionicons name="people" size={28} color="#fff" />
              <Text style={styles.statNumber}>{memberStats.totalMembers}</Text>
              <Text style={styles.statLabel}>Total</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: '#2196F3' }]}>
              <Ionicons name="checkmark-circle" size={28} color="#fff" />
              <Text style={styles.statNumber}>{memberStats.activeMembers}</Text>
              <Text style={styles.statLabel}>Actifs</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: '#FF9800' }]}>
              <Ionicons name="close-circle" size={28} color="#fff" />
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
              <Ionicons name="calendar-outline" size={32} color="#999" />
              <Text style={styles.noDataText}>
                {paymentStats.yearCount > 0
                  ? 'Aucune année active. Activez une année dans Paramètres.'
                  : 'Créez une année dans Paramètres pour voir les statistiques.'}
              </Text>
            </View>
          ) : paymentStats.error ? (
            <View style={styles.noDataContainer}>
              <Ionicons name="alert-circle-outline" size={32} color="#FF9800" />
              <Text style={styles.noDataText}>Erreur de chargement des statistiques</Text>
            </View>
          ) : (
            <>
              <View style={styles.paymentStatsGrid}>
                <View style={styles.paymentStatRow}>
                  <View style={[styles.paymentStatCard, { borderLeftColor: '#2196F3' }]}>
                    <Text style={styles.paymentStatLabel}>Attendu</Text>
                    <Text style={[styles.paymentStatValue, { color: '#2196F3' }]}>{formatAmount(paymentStats.totalExpected)} FCFA</Text>
                  </View>
                  <View style={[styles.paymentStatCard, { borderLeftColor: '#4CAF50' }]}>
                    <Text style={styles.paymentStatLabel}>Collecté</Text>
                    <Text style={[styles.paymentStatValue, { color: '#4CAF50' }]}>{formatAmount(paymentStats.totalCollected)} FCFA</Text>
                  </View>
                </View>
                <View style={styles.paymentStatRow}>
                  <View style={[styles.paymentStatCard, { borderLeftColor: '#FF9800' }]}>
                    <Text style={styles.paymentStatLabel}>Reste</Text>
                    <Text style={[styles.paymentStatValue, { color: '#FF9800' }]}>{formatAmount(paymentStats.remaining)} FCFA</Text>
                  </View>
                  <View style={[styles.paymentStatCard, { borderLeftColor: paymentStats.rate >= 70 ? '#4CAF50' : paymentStats.rate >= 40 ? '#FF9800' : '#F44336' }]}>
                    <Text style={styles.paymentStatLabel}>Taux recouvrement</Text>
                    <Text style={[styles.paymentStatValue, { color: paymentStats.rate >= 70 ? '#4CAF50' : paymentStats.rate >= 40 ? '#FF9800' : '#F44336' }]}>{paymentStats.rate}%</Text>
                  </View>
                </View>
              </View>

              <View style={styles.paymentMembersRow}>
                <View style={styles.paymentMemberItem}>
                  <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
                  <Text style={styles.paymentMemberText}>{paymentStats.membersFullyPaid} à jour</Text>
                </View>
                <View style={styles.paymentMemberItem}>
                  <Ionicons name="time" size={16} color="#FF9800" />
                  <Text style={styles.paymentMemberText}>{paymentStats.membersPending} en retard</Text>
                </View>
              </View>
            </>
          )}
        </View>
      )}

      <TouchableOpacity style={styles.syncButton} onPress={onRefresh}>
        <Ionicons name="sync" size={20} color="#fff" />
        <Text style={styles.syncButtonText}>Synchroniser</Text>
      </TouchableOpacity>
    </ScrollView>
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
  header: {
    backgroundColor: '#2196F3',
    padding: 12,
    paddingTop: 16,
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  subtitle: {
    fontSize: 13,
    color: '#fff',
    marginTop: 2,
    opacity: 0.9,
  },
  welcomeCard: {
    backgroundColor: '#fff',
    marginHorizontal: 12,
    marginTop: 10,
    marginBottom: 6,
    padding: 12,
    borderRadius: 10,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  welcomeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  welcomeInfo: {
    flex: 1,
  },
  welcomeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  roleText: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  statsSection: {
    marginHorizontal: 12,
    marginBottom: 6,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 10,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 6,
  },
  statCard: {
    flex: 1,
    padding: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 4,
  },
  statLabel: {
    fontSize: 10,
    color: '#fff',
    marginTop: 1,
    textAlign: 'center',
    opacity: 0.9,
  },
  paymentStatsGrid: {
    gap: 6,
  },
  paymentStatRow: {
    flexDirection: 'row',
    gap: 6,
  },
  paymentStatCard: {
    flex: 1,
    backgroundColor: '#FAFAFA',
    borderRadius: 8,
    padding: 8,
    borderLeftWidth: 3,
  },
  paymentStatLabel: {
    fontSize: 10,
    color: '#888',
    fontWeight: '500',
  },
  paymentStatValue: {
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 2,
  },
  paymentMembersRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  paymentMemberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  paymentMemberText: {
    fontSize: 13,
    color: '#555',
    fontWeight: '500',
  },
  noDataContainer: {
    alignItems: 'center',
    padding: 20,
    gap: 8,
  },
  noDataText: {
    fontSize: 13,
    color: '#999',
    textAlign: 'center',
  },
  syncButton: {
    flexDirection: 'row',
    backgroundColor: '#2196F3',
    marginHorizontal: 12,
    marginTop: 6,
    marginBottom: 12,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  syncButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});

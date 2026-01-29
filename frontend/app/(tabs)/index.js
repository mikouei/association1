import React, { useEffect, useState } from 'react';
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

export default function Dashboard() {
  const { user } = useAuth();
  const [config, setConfig] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [configRes, membersRes] = await Promise.all([
        api.get('/config'),
        api.get('/members'),
      ]);

      setConfig(configRes.data);
      
      // Calculer des stats basiques
      const members = membersRes.data;
      setStats({
        totalMembers: members.length,
        activeMembers: members.filter(m => m.active).length,
        inactiveMembers: members.filter(m => !m.active).length,
      });
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
        <Text style={styles.title}>{config?.name || 'Mon Association'}</Text>
        <Text style={styles.subtitle}>{config?.type || 'Association'}</Text>
      </View>

      <View style={styles.welcomeCard}>
        <Ionicons name="person-circle" size={60} color="#2196F3" />
        <Text style={styles.welcomeText}>Bienvenue, {user?.member?.name || 'Administrateur'}</Text>
        <Text style={styles.roleText}>
          {user?.role === 'ADMIN' ? 'Administrateur' : 'Membre'}
        </Text>
      </View>

      {user?.role === 'ADMIN' && stats && (
        <View style={styles.statsContainer}>
          <Text style={styles.sectionTitle}>Statistiques</Text>
          
          <View style={styles.statsGrid}>
            <View style={[styles.statCard, { backgroundColor: '#4CAF50' }]}>
              <Ionicons name="people" size={32} color="#fff" />
              <Text style={styles.statNumber}>{stats.totalMembers}</Text>
              <Text style={styles.statLabel}>Total membres</Text>
            </View>

            <View style={[styles.statCard, { backgroundColor: '#2196F3' }]}>
              <Ionicons name="checkmark-circle" size={32} color="#fff" />
              <Text style={styles.statNumber}>{stats.activeMembers}</Text>
              <Text style={styles.statLabel}>Actifs</Text>
            </View>

            <View style={[styles.statCard, { backgroundColor: '#FF9800' }]}>
              <Ionicons name="close-circle" size={32} color="#fff" />
              <Text style={styles.statNumber}>{stats.inactiveMembers}</Text>
              <Text style={styles.statLabel}>Inactifs</Text>
            </View>
          </View>
        </View>
      )}

      <View style={styles.infoSection}>
        <Text style={styles.sectionTitle}>Configuration</Text>
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Libellé champ membre:</Text>
            <Text style={styles.infoValue}>{config?.memberFieldLabel || 'Villa'}</Text>
          </View>
        </View>
      </View>

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
    padding: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  subtitle: {
    fontSize: 16,
    color: '#fff',
    marginTop: 4,
    opacity: 0.9,
  },
  welcomeCard: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  welcomeText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 12,
  },
  roleText: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  statsContainer: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#fff',
    marginTop: 4,
    textAlign: 'center',
  },
  infoSection: {
    padding: 16,
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  syncButton: {
    flexDirection: 'row',
    backgroundColor: '#2196F3',
    margin: 16,
    padding: 16,
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

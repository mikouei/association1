import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'expo-router';
import { 
  ClockCounterClockwise, 
  User, 
  CaretLeft,
  UserPlus,
  Pencil,
  Trash,
  CurrencyCircleDollar,
  Calendar,
  ShieldCheck,
  WarningCircle,
} from 'phosphor-react-native';
import api from '../../utils/api';
import { colors, spacing, borderRadius, typography } from '../../utils/theme';

const ACTION_CONFIG = {
  'member.create': { label: 'Membre créé', icon: UserPlus, color: colors.success },
  'member.update': { label: 'Membre modifié', icon: Pencil, color: colors.primary },
  'member.deactivate': { label: 'Membre désactivé', icon: WarningCircle, color: colors.warning },
  'member.activate': { label: 'Membre réactivé', icon: UserPlus, color: colors.success },
  'member.reset_password': { label: 'MDP réinitialisé', icon: ShieldCheck, color: colors.warning },
  'payment.create': { label: 'Paiement créé', icon: CurrencyCircleDollar, color: colors.success },
  'payment.update': { label: 'Paiement modifié', icon: Pencil, color: colors.primary },
  'payment.delete': { label: 'Paiement supprimé', icon: Trash, color: colors.error },
  'year.create': { label: 'Année créée', icon: Calendar, color: colors.success },
  'year.update': { label: 'Année modifiée', icon: Pencil, color: colors.primary },
  'year.activate': { label: 'Année activée', icon: Calendar, color: colors.accentTeal },
  'year.delete': { label: 'Année supprimée', icon: Trash, color: colors.error },
  'admin.create': { label: 'Admin créé', icon: ShieldCheck, color: colors.success },
  'admin.deactivate': { label: 'Admin désactivé', icon: WarningCircle, color: colors.warning },
  'admin.activate': { label: 'Admin réactivé', icon: ShieldCheck, color: colors.success },
  'admin.reset_password': { label: 'MDP admin réinitialisé', icon: ShieldCheck, color: colors.warning },
  'exceptional.create': { label: 'Cotis. except. créée', icon: CurrencyCircleDollar, color: colors.success },
  'exceptional.update': { label: 'Cotis. except. modifiée', icon: Pencil, color: colors.primary },
  'exceptional.delete': { label: 'Cotis. except. supprimée', icon: Trash, color: colors.error },
  'exceptional_payment.create': { label: 'Paiement except. créé', icon: CurrencyCircleDollar, color: colors.success },
  'exceptional_payment.update': { label: 'Paiement except. modifié', icon: Pencil, color: colors.primary },
  'exceptional_payment.delete': { label: 'Paiement except. supprimé', icon: Trash, color: colors.error },
};

export default function ActivityLogScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);

  const loadLogs = useCallback(async (cursor = null, refresh = false) => {
    if (cursor) {
      setLoadingMore(true);
    } else if (refresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      let url = '/activity-log?limit=30';
      if (cursor) url += `&before=${cursor}`;

      const response = await api.get(url);
      const data = response.data;

      if (cursor) {
        setLogs(prev => [...prev, ...data.logs]);
      } else {
        setLogs(data.logs);
      }
      setHasMore(data.hasMore);
      setNextCursor(data.nextCursor);
    } catch (error) {
      console.error('Error loading activity log:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getActionConfig = (action) => {
    return ACTION_CONFIG[action] || { 
      label: action, 
      icon: ClockCounterClockwise, 
      color: colors.textMuted 
    };
  };

  const renderItem = ({ item }) => {
    const config = getActionConfig(item.action);
    const IconComponent = config.icon;

    return (
      <View style={styles.logItem}>
        <View style={[styles.iconContainer, { backgroundColor: config.color + '20' }]}>
          <IconComponent size={20} color={config.color} weight="fill" />
        </View>
        <View style={styles.logContent}>
          <View style={styles.logHeader}>
            <Text style={styles.userName}>{item.userName}</Text>
            <Text style={[styles.actionLabel, { color: config.color }]}>
              {config.label}
            </Text>
          </View>
          {item.details && (
            <Text style={styles.details} numberOfLines={2}>
              {item.details}
            </Text>
          )}
          <Text style={styles.timestamp}>{formatDate(item.createdAt)}</Text>
        </View>
      </View>
    );
  };

  const renderFooter = () => {
    if (!hasMore) return null;
    return (
      <TouchableOpacity
        style={styles.loadMoreButton}
        onPress={() => nextCursor && loadLogs(nextCursor)}
        disabled={loadingMore}
      >
        {loadingMore ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <Text style={styles.loadMoreText}>Charger plus</Text>
        )}
      </TouchableOpacity>
    );
  };

  if (user?.role !== 'ADMIN') {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <CaretLeft size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Journal d'activité</Text>
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Accès réservé aux administrateurs</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <CaretLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <ClockCounterClockwise size={24} color={colors.primary} weight="duotone" />
        <Text style={styles.title}>Journal d'activité</Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : logs.length === 0 ? (
        <View style={styles.emptyContainer}>
          <ClockCounterClockwise size={48} color={colors.textMuted} />
          <Text style={styles.emptyText}>Aucune activité enregistrée</Text>
        </View>
      ) : (
        <FlatList
          data={logs}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadLogs(null, true)}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
          ListFooterComponent={renderFooter}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xxl + 10,
    paddingBottom: spacing.md,
    backgroundColor: colors.backgroundWhite,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  backButton: {
    padding: spacing.xs,
    marginRight: spacing.xs,
  },
  title: {
    fontSize: typography.h3.fontSize,
    fontWeight: typography.h3.fontWeight,
    color: colors.text,
    flex: 1,
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
    padding: spacing.xl,
  },
  emptyText: {
    fontSize: typography.body.fontSize,
    color: colors.textMuted,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  listContent: {
    padding: spacing.md,
  },
  logItem: {
    flexDirection: 'row',
    backgroundColor: colors.backgroundWhite,
    borderRadius: borderRadius.card,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  logContent: {
    flex: 1,
  },
  logHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  userName: {
    fontSize: typography.body.fontSize,
    fontWeight: '600',
    color: colors.text,
  },
  actionLabel: {
    fontSize: typography.caption.fontSize,
    fontWeight: '500',
  },
  details: {
    fontSize: typography.caption.fontSize + 1,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  timestamp: {
    fontSize: typography.caption.fontSize,
    color: colors.textMuted,
  },
  loadMoreButton: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  loadMoreText: {
    fontSize: typography.body.fontSize,
    color: colors.primary,
    fontWeight: '500',
  },
});

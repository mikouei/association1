import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Bell,
  PaperPlaneTilt,
  Users,
  UserCircle,
  CheckCircle,
  Clock,
  X,
  Megaphone,
  CalendarBlank,
} from 'phosphor-react-native';
import { colors, spacing, typography, borderRadius } from '../../utils/theme';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';

export default function AnnoncesScreen() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [announcements, setAnnouncements] = useState([]);
  const [stats, setStats] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [reminderModal, setReminderModal] = useState(false);
  const [members, setMembers] = useState([]);
  const [sending, setSending] = useState(false);

  // État du formulaire
  const [formTitle, setFormTitle] = useState('');
  const [formBody, setFormBody] = useState('');
  const [targetType, setTargetType] = useState('all'); // 'all' ou 'selected'
  const [selectedMemberIds, setSelectedMemberIds] = useState([]);

  // État rappel cotisation
  const [reminderMonth, setReminderMonth] = useState(new Date().getMonth() + 1);
  const [reminderYear, setReminderYear] = useState(new Date().getFullYear());

  const loadData = async () => {
    try {
      // Charger l'historique des annonces
      const announcementsRes = await api.get('/notifications/announcements?limit=50');
      setAnnouncements(announcementsRes.data.announcements || []);

      // Charger les stats
      const statsRes = await api.get('/notifications/stats');
      setStats(statsRes.data);

      // Charger les membres pour la sélection
      const membersRes = await api.get('/members');
      setMembers(membersRes.data.filter(m => m.active));
    } catch (error) {
      console.error('Erreur chargement annonces:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (isAdmin) {
        loadData();
      }
    }, [isAdmin])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const resetForm = () => {
    setFormTitle('');
    setFormBody('');
    setTargetType('all');
    setSelectedMemberIds([]);
  };

  const toggleMember = (memberId) => {
    setSelectedMemberIds(prev => {
      if (prev.includes(memberId)) {
        return prev.filter(id => id !== memberId);
      } else {
        return [...prev, memberId];
      }
    });
  };

  const handleSendAnnouncement = async () => {
    if (!formTitle.trim() || !formBody.trim()) {
      Alert.alert('Erreur', 'Titre et message requis');
      return;
    }

    if (targetType === 'selected' && selectedMemberIds.length === 0) {
      Alert.alert('Erreur', 'Sélectionnez au moins un membre');
      return;
    }

    setSending(true);
    try {
      const payload = {
        title: formTitle.trim(),
        body: formBody.trim(),
        targetType,
        targetIds: targetType === 'selected' ? selectedMemberIds : [],
      };

      const res = await api.post('/notifications/announcements', payload);

      Alert.alert(
        'Succès',
        `Annonce envoyée à ${res.data.pushResult?.success || 0} appareil(s)`,
        [{ text: 'OK' }]
      );

      setModalVisible(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error('Erreur envoi annonce:', error);
      Alert.alert('Erreur', error.response?.data?.error || 'Erreur lors de l\'envoi');
    } finally {
      setSending(false);
    }
  };

  const handleSendReminder = async () => {
    setSending(true);
    try {
      const res = await api.post('/notifications/reminder', {
        month: reminderMonth,
        year: reminderYear,
      });

      Alert.alert(
        'Succès',
        `Rappel envoyé à ${res.data.targetedMembers || 0} membre(s) en retard`,
        [{ text: 'OK' }]
      );

      setReminderModal(false);
      loadData();
    } catch (error) {
      console.error('Erreur envoi rappel:', error);
      Alert.alert('Erreur', error.response?.data?.error || 'Erreur lors de l\'envoi');
    } finally {
      setSending(false);
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'reminder':
        return <Clock size={20} color={colors.warning} weight="fill" />;
      case 'event':
        return <CalendarBlank size={20} color={colors.primary} weight="fill" />;
      default:
        return <Megaphone size={20} color={colors.secondary} weight="fill" />;
    }
  };

  const getTypeLabel = (type) => {
    switch (type) {
      case 'reminder':
        return 'Rappel';
      case 'event':
        return 'Événement';
      default:
        return 'Annonce';
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const monthNames = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];

  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyState}>
          <Bell size={48} color={colors.textMuted} />
          <Text style={styles.emptyText}>Accès réservé aux administrateurs</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Annonces</Text>
          <Text style={styles.subtitle}>
            Envoyez des notifications à vos membres
          </Text>
        </View>

        {/* Statistiques */}
        {stats && (
          <View style={styles.statsCard}>
            <View style={styles.statRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{stats.usersWithTokens}</Text>
                <Text style={styles.statLabel}>Appareils connectés</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{stats.coverage}%</Text>
                <Text style={styles.statLabel}>Couverture</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{stats.recentAnnouncements}</Text>
                <Text style={styles.statLabel}>30 derniers jours</Text>
              </View>
            </View>
          </View>
        )}

        {/* Boutons d'action */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => setModalVisible(true)}
            data-testid="new-announcement-btn"
          >
            <PaperPlaneTilt size={24} color={colors.textOnPrimary} weight="fill" />
            <Text style={styles.actionButtonText}>Nouvelle annonce</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.reminderButton]}
            onPress={() => setReminderModal(true)}
            data-testid="send-reminder-btn"
          >
            <Clock size={24} color={colors.textOnPrimary} weight="fill" />
            <Text style={styles.actionButtonText}>Rappel cotisation</Text>
          </TouchableOpacity>
        </View>

        {/* Historique des annonces */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Historique</Text>
          
          {announcements.length === 0 ? (
            <View style={styles.emptyHistory}>
              <Bell size={40} color={colors.textMuted} />
              <Text style={styles.emptyHistoryText}>Aucune annonce envoyée</Text>
            </View>
          ) : (
            announcements.map((announcement) => (
              <View key={announcement.id} style={styles.announcementCard}>
                <View style={styles.announcementHeader}>
                  {getTypeIcon(announcement.type)}
                  <Text style={styles.announcementType}>
                    {getTypeLabel(announcement.type)}
                  </Text>
                  <Text style={styles.announcementDate}>
                    {formatDate(announcement.createdAt)}
                  </Text>
                </View>
                <Text style={styles.announcementTitle}>{announcement.title}</Text>
                <Text style={styles.announcementBody} numberOfLines={2}>
                  {announcement.body}
                </Text>
                <View style={styles.announcementFooter}>
                  <Text style={styles.announcementSent}>
                    {announcement.sentCount} envoyé(s)
                  </Text>
                  {announcement.targetType === 'selected' && (
                    <Text style={styles.announcementTarget}>
                      • {announcement.targetCount} membre(s) ciblé(s)
                    </Text>
                  )}
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Modal Nouvelle Annonce */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nouvelle annonce</Text>
              <TouchableOpacity onPress={() => { setModalVisible(false); resetForm(); }}>
                <X size={28} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Titre *</Text>
                <TextInput
                  style={styles.input}
                  value={formTitle}
                  onChangeText={setFormTitle}
                  placeholder="Ex: Réunion générale"
                  placeholderTextColor={colors.textMuted}
                  maxLength={100}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Message *</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={formBody}
                  onChangeText={setFormBody}
                  placeholder="Contenu de votre annonce..."
                  placeholderTextColor={colors.textMuted}
                  multiline
                  numberOfLines={4}
                  maxLength={500}
                />
                <Text style={styles.charCount}>{formBody.length}/500</Text>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Destinataires</Text>
                <View style={styles.targetToggle}>
                  <TouchableOpacity
                    style={[
                      styles.targetOption,
                      targetType === 'all' && styles.targetOptionActive,
                    ]}
                    onPress={() => setTargetType('all')}
                  >
                    <Users size={20} color={targetType === 'all' ? colors.textOnPrimary : colors.text} />
                    <Text style={[
                      styles.targetOptionText,
                      targetType === 'all' && styles.targetOptionTextActive,
                    ]}>
                      Tous
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.targetOption,
                      targetType === 'selected' && styles.targetOptionActive,
                    ]}
                    onPress={() => setTargetType('selected')}
                  >
                    <UserCircle size={20} color={targetType === 'selected' ? colors.textOnPrimary : colors.text} />
                    <Text style={[
                      styles.targetOptionText,
                      targetType === 'selected' && styles.targetOptionTextActive,
                    ]}>
                      Sélection
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {targetType === 'selected' && (
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>
                    Membres sélectionnés ({selectedMemberIds.length})
                  </Text>
                  <View style={styles.memberList}>
                    {members.map((member) => (
                      <TouchableOpacity
                        key={member.id}
                        style={[
                          styles.memberItem,
                          selectedMemberIds.includes(member.id) && styles.memberItemSelected,
                        ]}
                        onPress={() => toggleMember(member.id)}
                      >
                        {selectedMemberIds.includes(member.id) && (
                          <CheckCircle size={18} color={colors.success} weight="fill" />
                        )}
                        <Text style={styles.memberName}>{member.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              <TouchableOpacity
                style={[styles.submitButton, sending && styles.submitButtonDisabled]}
                onPress={handleSendAnnouncement}
                disabled={sending}
              >
                {sending ? (
                  <ActivityIndicator color={colors.textOnPrimary} />
                ) : (
                  <>
                    <PaperPlaneTilt size={20} color={colors.textOnPrimary} weight="fill" />
                    <Text style={styles.submitButtonText}>Envoyer</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal Rappel Cotisation */}
      <Modal
        visible={reminderModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setReminderModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, { maxHeight: '50%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Rappel de cotisation</Text>
              <TouchableOpacity onPress={() => setReminderModal(false)}>
                <X size={28} color={colors.text} />
              </TouchableOpacity>
            </View>

            <Text style={styles.reminderInfo}>
              Envoyer un rappel aux membres qui n{"'"}ont pas encore payé leur cotisation du mois sélectionné.
            </Text>

            <View style={styles.reminderSelectors}>
              <View style={styles.selectorGroup}>
                <Text style={styles.label}>Mois</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.monthsRow}>
                    {monthNames.map((name, index) => (
                      <TouchableOpacity
                        key={index}
                        style={[
                          styles.monthButton,
                          reminderMonth === index + 1 && styles.monthButtonActive,
                        ]}
                        onPress={() => setReminderMonth(index + 1)}
                      >
                        <Text style={[
                          styles.monthButtonText,
                          reminderMonth === index + 1 && styles.monthButtonTextActive,
                        ]}>
                          {name.substring(0, 3)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>

              <View style={styles.selectorGroup}>
                <Text style={styles.label}>Année</Text>
                <View style={styles.yearsRow}>
                  {[2024, 2025, 2026].map((y) => (
                    <TouchableOpacity
                      key={y}
                      style={[
                        styles.yearButton,
                        reminderYear === y && styles.yearButtonActive,
                      ]}
                      onPress={() => setReminderYear(y)}
                    >
                      <Text style={[
                        styles.yearButtonText,
                        reminderYear === y && styles.yearButtonTextActive,
                      ]}>
                        {y}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.submitButton, sending && styles.submitButtonDisabled]}
              onPress={handleSendReminder}
              disabled={sending}
            >
              {sending ? (
                <ActivityIndicator color={colors.textOnPrimary} />
              ) : (
                <>
                  <Clock size={20} color={colors.textOnPrimary} weight="fill" />
                  <Text style={styles.submitButtonText}>
                    Envoyer le rappel
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
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
  },
  header: {
    padding: spacing.lg,
  },
  title: {
    fontSize: typography.h1.fontSize,
    fontWeight: '700',
    color: colors.text,
  },
  subtitle: {
    fontSize: typography.body.fontSize,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  statsCard: {
    backgroundColor: colors.backgroundWhite,
    marginHorizontal: spacing.lg,
    borderRadius: borderRadius.card,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: typography.h2.fontSize,
    fontWeight: '700',
    color: colors.primary,
  },
  statLabel: {
    fontSize: typography.caption.fontSize,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  actionsRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.button,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  reminderButton: {
    backgroundColor: colors.warning,
  },
  actionButtonText: {
    color: colors.textOnPrimary,
    fontSize: typography.body.fontSize,
    fontWeight: '600',
  },
  section: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: typography.h3.fontSize,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.md,
  },
  emptyState: {
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
  emptyHistory: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyHistoryText: {
    fontSize: typography.body.fontSize,
    color: colors.textMuted,
    marginTop: spacing.md,
  },
  announcementCard: {
    backgroundColor: colors.backgroundWhite,
    borderRadius: borderRadius.card,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  announcementHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  announcementType: {
    fontSize: typography.caption.fontSize,
    color: colors.textMuted,
    marginLeft: spacing.sm,
    flex: 1,
  },
  announcementDate: {
    fontSize: typography.caption.fontSize,
    color: colors.textMuted,
  },
  announcementTitle: {
    fontSize: typography.body.fontSize,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  announcementBody: {
    fontSize: typography.caption.fontSize,
    color: colors.textMuted,
    lineHeight: 18,
  },
  announcementFooter: {
    flexDirection: 'row',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  announcementSent: {
    fontSize: typography.caption.fontSize,
    color: colors.success,
    fontWeight: '500',
  },
  announcementTarget: {
    fontSize: typography.caption.fontSize,
    color: colors.textMuted,
    marginLeft: spacing.sm,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.backgroundWhite,
    borderTopLeftRadius: borderRadius.large,
    borderTopRightRadius: borderRadius.large,
    padding: spacing.lg,
    maxHeight: '85%',
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
  inputGroup: {
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: typography.body.fontSize,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.input,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: typography.body.fontSize,
    color: colors.text,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: typography.caption.fontSize,
    color: colors.textMuted,
    textAlign: 'right',
    marginTop: spacing.xs,
  },
  targetToggle: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  targetOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.button,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  targetOptionActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  targetOptionText: {
    fontSize: typography.body.fontSize,
    fontWeight: '600',
    color: colors.text,
  },
  targetOptionTextActive: {
    color: colors.textOnPrimary,
  },
  memberList: {
    maxHeight: 200,
    borderRadius: borderRadius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: borderRadius.small,
  },
  memberItemSelected: {
    backgroundColor: colors.successBg || '#e8f5e9',
  },
  memberName: {
    fontSize: typography.body.fontSize,
    color: colors.text,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.button,
    paddingVertical: spacing.md,
    marginTop: spacing.lg,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: colors.textOnPrimary,
    fontSize: typography.body.fontSize,
    fontWeight: '600',
  },
  reminderInfo: {
    fontSize: typography.body.fontSize,
    color: colors.textMuted,
    marginBottom: spacing.lg,
    lineHeight: 22,
  },
  reminderSelectors: {
    marginBottom: spacing.md,
  },
  selectorGroup: {
    marginBottom: spacing.lg,
  },
  monthsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  monthButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.button,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  monthButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  monthButtonText: {
    fontSize: typography.caption.fontSize,
    color: colors.text,
    fontWeight: '500',
  },
  monthButtonTextActive: {
    color: colors.textOnPrimary,
  },
  yearsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  yearButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.button,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  yearButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  yearButtonText: {
    fontSize: typography.body.fontSize,
    color: colors.text,
    fontWeight: '600',
  },
  yearButtonTextActive: {
    color: colors.textOnPrimary,
  },
});

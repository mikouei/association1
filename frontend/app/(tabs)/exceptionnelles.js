import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { Heart, Gift, HandHeart, Star, SmileyMeh, Plus, X, Pencil, Trash, Download, CaretDown, CaretRight, MagnifyingGlass, User } from 'phosphor-react-native';
import api from '../../utils/api';
import { useFocusEffect } from '@react-navigation/native';
import { formatNumber } from '../../utils/format';
import * as FileSystemLegacy from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import { colors, spacing, borderRadius, typography } from '../../utils/theme';

const TYPES = ['décès', 'mariage', 'anniversaire', 'solidarité', 'autre'];

export default function Exceptionnelles() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [contributions, setContributions] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Modals
  const [modalVisible, setModalVisible] = useState(false);
  const [detailModal, setDetailModal] = useState(false);
  const [paymentModal, setPaymentModal] = useState(false);
  const [memberSelectModal, setMemberSelectModal] = useState(false);
  
  // State
  const [selectedContribution, setSelectedContribution] = useState(null);
  const [editingContribution, setEditingContribution] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    type: 'décès',
    description: ''
  });
  const [paymentData, setPaymentData] = useState({
    memberId: '',
    memberName: '',
    amount: ''
  });
  const [saving, setSaving] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  // Recharger les données à chaque fois que l'onglet est affiché
  useFocusEffect(
    useCallback(() => {
      loadContributions();
      loadMembers();
    }, [])
  );

  const loadContributions = async () => {
    try {
      const response = await api.get('/exceptional');
      setContributions(response.data);
    } catch (error) {
      console.error('Erreur chargement:', error);
      Alert.alert('Erreur', 'Impossible de charger les cotisations');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadMembers = async () => {
    try {
      const response = await api.get('/members');
      setMembers(response.data.filter(m => m.active));
    } catch (error) {
      console.error('Erreur chargement membres:', error);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadContributions();
  };

  // Créer ou modifier
  const handleOpenCreateModal = () => {
    setEditingContribution(null);
    setFormData({ title: '', type: 'décès', description: '' });
    setModalVisible(true);
  };

  const handleOpenEditModal = (contribution) => {
    setEditingContribution(contribution);
    setFormData({
      title: contribution.title,
      type: contribution.type,
      description: contribution.description || ''
    });
    setDetailModal(false);
    setTimeout(() => setModalVisible(true), 300);
  };

  const handleSave = async () => {
    if (!formData.title) {
      Alert.alert('Erreur', 'Titre requis');
      return;
    }

    setSaving(true);
    try {
      if (editingContribution) {
        await api.put(`/exceptional/${editingContribution.id}`, formData);
        Alert.alert('Succès', 'Cotisation modifiée');
      } else {
        await api.post('/exceptional', formData);
        Alert.alert('Succès', 'Cotisation créée');
      }
      setModalVisible(false);
      setFormData({ title: '', type: 'décès', description: '' });
      setEditingContribution(null);
      loadContributions();
    } catch (error) {
      console.error('Erreur sauvegarde:', error);
      Alert.alert('Erreur', error.response?.data?.error || 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  // Supprimer
  const handleDelete = (contribution) => {
    Alert.alert(
      'Supprimer',
      `Êtes-vous sûr de vouloir supprimer "${contribution.title}" ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/exceptional/${contribution.id}`);
              Alert.alert('Succès', 'Cotisation supprimée');
              setDetailModal(false);
              loadContributions();
            } catch (error) {
              console.error('Erreur suppression:', error);
              Alert.alert('Erreur', 'Impossible de supprimer');
            }
          }
        }
      ]
    );
  };

  // Détails
  const handleShowDetail = async (contribution) => {
    try {
      const response = await api.get(`/exceptional/${contribution.id}`);
      setSelectedContribution(response.data);
      setDetailModal(true);
    } catch (error) {
      console.error('Erreur détail:', error);
      Alert.alert('Erreur', 'Impossible de charger les détails');
    }
  };

  const refreshDetail = async () => {
    if (selectedContribution) {
      try {
        const response = await api.get(`/exceptional/${selectedContribution.id}`);
        setSelectedContribution(response.data);
      } catch (error) {
        console.error('Erreur refresh:', error);
      }
    }
  };

  // Paiements
  const handleOpenPaymentModal = () => {
    setPaymentData({ memberId: '', memberName: '', amount: '' });
    setPaymentModal(true);
  };

  const handleSelectMember = (member) => {
    setPaymentData({
      ...paymentData,
      memberId: member.id,
      memberName: member.name
    });
    setMemberSelectModal(false);
  };

  const handleSavePayment = async () => {
    if (!paymentData.memberId || !paymentData.amount) {
      Alert.alert('Erreur', 'Membre et montant requis');
      return;
    }

    const amount = parseFloat(paymentData.amount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Erreur', 'Montant invalide');
      return;
    }

    setSaving(true);
    try {
      await api.post(`/exceptional/${selectedContribution.id}/payments`, {
        memberId: paymentData.memberId,
        amount: amount
      });
      Alert.alert('Succès', 'Paiement enregistré');
      setPaymentModal(false);
      setPaymentData({ memberId: '', memberName: '', amount: '' });
      refreshDetail();
      loadContributions();
    } catch (error) {
      console.error('Erreur paiement:', error);
      Alert.alert('Erreur', error.response?.data?.error || 'Erreur lors de l\'enregistrement');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePayment = (payment) => {
    Alert.alert(
      'Supprimer le paiement',
      `Supprimer le paiement de ${payment.member.name} (${formatNumber(payment.amount)} FCFA) ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/exceptional/payments/${payment.id}`);
              Alert.alert('Succès', 'Paiement supprimé');
              refreshDetail();
              loadContributions();
            } catch (error) {
              console.error('Erreur suppression paiement:', error);
              Alert.alert('Erreur', 'Impossible de supprimer le paiement');
            }
          }
        }
      ]
    );
  };

  // Fonction pour partager le PDF
  const savePdfToDownloads = async (pdfUri, filename) => {
    try {
      // Vérifier si le partage est disponible
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert('Erreur', 'Le partage de fichiers n\'est pas disponible sur cet appareil');
        return false;
      }
      
      // Partager le fichier PDF
      await Sharing.shareAsync(pdfUri, {
        mimeType: 'application/pdf',
        dialogTitle: `Enregistrer ${filename}`,
        UTI: 'com.adobe.pdf'
      });
      
      return true;
    } catch (error) {
      console.error('Erreur savePdfToDownloads:', error);
      Alert.alert('Erreur', `Impossible de partager le fichier: ${error.message}`);
      return false;
    }
  };

  // Télécharger les statistiques PDF de l'événement
  const handleDownloadPdf = async () => {
    if (!selectedContribution) return;
    
    setDownloadingPdf(true);
    try {
      // Récupérer le HTML depuis l'API
      const response = await api.get(`/exceptional/${selectedContribution.id}/stats/pdf`, { 
        responseType: 'text' 
      });
      const html = response.data;
      
      // Générer le nom du fichier
      const safeTitle = selectedContribution.title.replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `statistiques_${safeTitle}.pdf`;

      // Sur le web, ouvrir dans une nouvelle fenêtre
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(html);
          printWindow.document.close();
          printWindow.print();
        }
        Alert.alert('Succès', 'Document ouvert pour impression');
      } else {
        // Sur mobile, générer le PDF et le télécharger
        const { uri } = await Print.printToFileAsync({ 
          html,
          base64: false
        });
        
        await savePdfToDownloads(uri, filename);
      }
    } catch (error) {
      console.error('Erreur téléchargement PDF:', error);
      Alert.alert('Erreur', 'Impossible de générer le PDF');
    } finally {
      setDownloadingPdf(false);
    }
  };

  const getTypeIcon = (type) => {
    const iconProps = { size: 32, color: colors.primary, weight: 'duotone' };
    switch (type) {
      case 'décès': return <SmileyMeh {...iconProps} />;
      case 'mariage': return <Heart {...iconProps} />;
      case 'anniversaire': return <Gift {...iconProps} />;
      case 'solidarité': return <HandHeart {...iconProps} />;
      default: return <Star {...iconProps} />;
    }
  };

  const filteredMembers = members.filter(m =>
    m.name.toLowerCase().includes(memberSearch.toLowerCase()) ||
    m.customFieldValue?.toLowerCase().includes(memberSearch.toLowerCase())
  );

  const renderContribution = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => handleShowDetail(item)}
      data-testid={`exceptional-card-${item.id}`}
    >
      <View style={styles.cardHeader}>
        <View style={styles.iconContainer}>
          {getTypeIcon(item.type)}
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle}>{item.title}</Text>
          <Text style={styles.cardType}>{item.type}</Text>
        </View>
      </View>

      <View style={styles.cardStats}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{formatNumber(item.totalCollected)} FCFA</Text>
          <Text style={styles.statLabel}>Collecté</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{item.participantsCount}</Text>
          <Text style={styles.statLabel}>Participants</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={contributions}
        renderItem={renderContribution}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
        }
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <Gift size={64} color={colors.border} weight="duotone" />
            <Text style={styles.emptyText}>Aucune cotisation exceptionnelle</Text>
          </View>
        )}
      />

      {isAdmin && (
        <TouchableOpacity
          style={styles.fab}
          onPress={handleOpenCreateModal}
          data-testid="add-exceptional-btn"
        >
          <Plus size={28} color={colors.textOnPrimary} weight="bold" />
        </TouchableOpacity>
      )}

      {/* Modal Création/Modification */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContainer}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingContribution ? 'Modifier cotisation' : 'Nouvelle cotisation'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X size={28} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView>
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Titre *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ex: Décès M. Kamga"
                  placeholderTextColor={colors.textMuted}
                  value={formData.title}
                  onChangeText={(text) => setFormData({ ...formData, title: text })}
                  autoCapitalize="sentences"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Type *</Text>
                <View style={styles.typeContainer}>
                  {TYPES.map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.typeButton,
                        formData.type === type && styles.typeButtonActive
                      ]}
                      onPress={() => setFormData({ ...formData, type })}
                    >
                      <Text
                        style={[
                          styles.typeText,
                          formData.type === type && styles.typeTextActive
                        ]}
                      >
                        {type}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Description</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Description..."
                  placeholderTextColor={colors.textMuted}
                  value={formData.description}
                  onChangeText={(text) => setFormData({ ...formData, description: text })}
                  multiline
                  numberOfLines={4}
                />
              </View>

              <TouchableOpacity
                style={[styles.submitButton, saving && styles.submitButtonDisabled]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color={colors.textOnPrimary} />
                ) : (
                  <Text style={styles.submitButtonText}>
                    {editingContribution ? 'Modifier' : 'Créer'}
                  </Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal Détail */}
      <Modal
        visible={detailModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setDetailModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, { maxHeight: '90%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Détails</Text>
              <TouchableOpacity onPress={() => setDetailModal(false)}>
                <X size={28} color={colors.text} />
              </TouchableOpacity>
            </View>

            {selectedContribution && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.detailHeader}>
                  <View style={styles.detailIconContainer}>
                    {React.cloneElement(getTypeIcon(selectedContribution.type), { size: 40 })}
                  </View>
                  <View style={styles.detailInfo}>
                    <Text style={styles.detailTitle}>{selectedContribution.title}</Text>
                    <Text style={styles.detailType}>{selectedContribution.type}</Text>
                  </View>
                </View>

                {selectedContribution.description && (
                  <Text style={styles.detailDescription}>{selectedContribution.description}</Text>
                )}

                <View style={styles.statsRow}>
                  <View style={styles.statBox}>
                    <Text style={styles.statBoxValue}>{formatNumber(selectedContribution.totalCollected)}</Text>
                    <Text style={styles.statBoxLabel}>FCFA collectés</Text>
                  </View>
                  <View style={styles.statBox}>
                    <Text style={styles.statBoxValue}>{selectedContribution.participantsCount}</Text>
                    <Text style={styles.statBoxLabel}>Participants</Text>
                  </View>
                </View>

                {/* Actions Admin */}
                {isAdmin && (
                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => handleOpenEditModal(selectedContribution)}
                    >
                      <Pencil size={20} color={colors.secondary} />
                      <Text style={styles.actionButtonText}>Modifier</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.actionButton, styles.deleteButton]}
                      onPress={() => handleDelete(selectedContribution)}
                    >
                      <Trash size={20} color={colors.error} />
                      <Text style={[styles.actionButtonText, { color: colors.error }]}>Supprimer</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Bouton Télécharger PDF (visible pour tous) */}
                <TouchableOpacity
                  style={[styles.downloadPdfButton, downloadingPdf && styles.downloadPdfButtonDisabled]}
                  onPress={handleDownloadPdf}
                  disabled={downloadingPdf}
                >
                  {downloadingPdf ? (
                    <ActivityIndicator size="small" color={colors.textOnSecondary} />
                  ) : (
                    <>
                      <Download size={20} color={colors.textOnSecondary} />
                      <Text style={styles.downloadPdfText}>Télécharger statistiques (PDF)</Text>
                    </>
                  )}
                </TouchableOpacity>

                <View style={styles.paymentsSection}>
                  <View style={styles.paymentsSectionHeader}>
                    <Text style={styles.sectionTitle}>Paiements</Text>
                    {isAdmin && (
                      <TouchableOpacity
                        style={styles.addPaymentButton}
                        onPress={handleOpenPaymentModal}
                      >
                        <Plus size={20} color={colors.textOnSecondary} />
                        <Text style={styles.addPaymentText}>Ajouter</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {selectedContribution.payments && selectedContribution.payments.length > 0 ? (
                    selectedContribution.payments.map((payment) => (
                      <View key={payment.id} style={styles.paymentItem}>
                        <View style={styles.paymentInfo}>
                          <Text style={styles.paymentName}>{payment.member.name}</Text>
                          <Text style={styles.paymentDate}>
                            {new Date(payment.paymentDate).toLocaleDateString('fr-FR')}
                          </Text>
                        </View>
                        <View style={styles.paymentRight}>
                          <Text style={styles.paymentAmount}>{formatNumber(payment.amount)} FCFA</Text>
                          {isAdmin && (
                            <TouchableOpacity
                              onPress={() => handleDeletePayment(payment)}
                              style={styles.paymentDeleteButton}
                            >
                              <Trash size={18} color={colors.error} />
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.noPayments}>Aucun paiement enregistré</Text>
                  )}
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Modal Paiement */}
      <Modal
        visible={paymentModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setPaymentModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContainer}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nouveau paiement</Text>
              <TouchableOpacity onPress={() => setPaymentModal(false)}>
                <X size={28} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Membre *</Text>
              <TouchableOpacity
                style={styles.memberSelector}
                onPress={() => setMemberSelectModal(true)}
              >
                <Text style={paymentData.memberName ? styles.memberSelectorText : styles.memberSelectorPlaceholder}>
                  {paymentData.memberName || 'Sélectionner un membre'}
                </Text>
                <CaretDown size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Montant (FCFA) *</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: 5000"
                placeholderTextColor={colors.textMuted}
                value={paymentData.amount}
                onChangeText={(text) => setPaymentData({ ...paymentData, amount: text })}
                keyboardType="numeric"
              />
            </View>

            <TouchableOpacity
              style={[styles.submitButton, saving && styles.submitButtonDisabled]}
              onPress={handleSavePayment}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color={colors.textOnPrimary} />
              ) : (
                <Text style={styles.submitButtonText}>Enregistrer</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal Sélection Membre */}
      <Modal
        visible={memberSelectModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setMemberSelectModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, { maxHeight: '80%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Sélectionner un membre</Text>
              <TouchableOpacity onPress={() => setMemberSelectModal(false)}>
                <X size={28} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.searchContainer}>
              <MagnifyingGlass size={20} color={colors.textMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder="Rechercher..."
                placeholderTextColor={colors.textMuted}
                value={memberSearch}
                onChangeText={setMemberSearch}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <FlatList
              data={filteredMembers}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.memberItem}
                  onPress={() => handleSelectMember(item)}
                >
                  <View style={styles.memberItemIcon}>
                    <User size={20} color={colors.primary} />
                  </View>
                  <View style={styles.memberItemInfo}>
                    <Text style={styles.memberItemName}>{item.name}</Text>
                    <Text style={styles.memberItemField}>{item.customFieldValue}</Text>
                  </View>
                  <CaretRight size={20} color={colors.border} />
                </TouchableOpacity>
              )}
              ListEmptyComponent={() => (
                <Text style={styles.noMembers}>Aucun membre trouvé</Text>
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
  },
  listContent: {
    padding: spacing.lg,
    paddingBottom: 80,
  },
  card: {
    backgroundColor: colors.backgroundWhite,
    borderRadius: borderRadius.card,
    padding: spacing.lg,
    marginBottom: spacing.md,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.warningBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  cardInfo: {
    flex: 1,
  },
  cardTitle: {
    fontSize: typography.h3.fontSize,
    fontWeight: typography.h3.fontWeight,
    color: colors.text,
  },
  cardType: {
    fontSize: typography.body.fontSize,
    color: colors.textMuted,
    marginTop: spacing.xs,
    textTransform: 'capitalize',
  },
  cardStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.primary,
  },
  statLabel: {
    fontSize: typography.caption.fontSize,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: typography.body.fontSize,
    color: colors.textMuted,
    marginTop: spacing.lg,
  },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: colors.backgroundWhite,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.xl,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  modalTitle: {
    fontSize: typography.h2.fontSize,
    fontWeight: typography.h2.fontWeight,
    color: colors.text,
  },
  inputContainer: {
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
    padding: spacing.md,
    fontSize: typography.body.fontSize,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  typeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  typeButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
  },
  typeButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  typeText: {
    fontSize: typography.body.fontSize,
    color: colors.textMuted,
    textTransform: 'capitalize',
  },
  typeTextActive: {
    color: colors.textOnPrimary,
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.button,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: colors.textOnPrimary,
    fontSize: typography.button.fontSize,
    fontWeight: typography.button.fontWeight,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  detailIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.warningBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.lg,
  },
  detailInfo: {
    flex: 1,
  },
  detailTitle: {
    fontSize: typography.h2.fontSize,
    fontWeight: typography.h2.fontWeight,
    color: colors.text,
  },
  detailType: {
    fontSize: typography.body.fontSize,
    color: colors.primary,
    textTransform: 'capitalize',
    marginTop: spacing.xs,
  },
  detailDescription: {
    fontSize: typography.body.fontSize,
    color: colors.textMuted,
    marginBottom: spacing.lg,
    lineHeight: 20,
    backgroundColor: colors.background,
    padding: spacing.md,
    borderRadius: borderRadius.input,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  statBox: {
    flex: 1,
    backgroundColor: colors.warningBg,
    padding: spacing.lg,
    borderRadius: borderRadius.card,
    alignItems: 'center',
  },
  statBoxValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.primary,
  },
  statBoxLabel: {
    fontSize: typography.caption.fontSize,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.button,
    backgroundColor: colors.background,
    gap: spacing.sm,
  },
  deleteButton: {
    backgroundColor: colors.errorBg,
  },
  actionButtonText: {
    fontSize: typography.body.fontSize,
    fontWeight: '600',
    color: colors.secondary,
  },
  paymentsSection: {
    marginTop: spacing.sm,
  },
  paymentsSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  addPaymentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.success,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    gap: spacing.xs,
  },
  addPaymentText: {
    color: colors.textOnSecondary,
    fontSize: typography.body.fontSize,
    fontWeight: '600',
  },
  paymentItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  paymentInfo: {
    flex: 1,
  },
  paymentName: {
    fontSize: typography.body.fontSize,
    fontWeight: '500',
    color: colors.text,
  },
  paymentDate: {
    fontSize: typography.caption.fontSize,
    color: colors.textMuted,
    marginTop: 2,
  },
  paymentRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  paymentAmount: {
    fontSize: typography.body.fontSize,
    fontWeight: '600',
    color: colors.primary,
  },
  paymentDeleteButton: {
    padding: spacing.xs,
  },
  noPayments: {
    fontSize: typography.body.fontSize,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: spacing.xl,
  },
  memberSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: borderRadius.input,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  memberSelectorText: {
    fontSize: typography.body.fontSize,
    color: colors.text,
  },
  memberSelectorPlaceholder: {
    fontSize: typography.body.fontSize,
    color: colors.textMuted,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: borderRadius.input,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    fontSize: typography.body.fontSize,
    color: colors.text,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  memberItemIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.warningBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  memberItemInfo: {
    flex: 1,
  },
  memberItemName: {
    fontSize: typography.body.fontSize,
    fontWeight: '500',
    color: colors.text,
  },
  memberItemField: {
    fontSize: typography.caption.fontSize,
    color: colors.textMuted,
    marginTop: 2,
  },
  noMembers: {
    fontSize: typography.body.fontSize,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: spacing.xl,
  },
  // Styles pour le bouton télécharger PDF
  downloadPdfButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.secondary,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: borderRadius.card,
    marginVertical: spacing.lg,
    gap: 10,
  },
  downloadPdfButtonDisabled: {
    opacity: 0.6,
  },
  downloadPdfText: {
    color: colors.textOnSecondary,
    fontSize: typography.body.fontSize,
    fontWeight: '600',
  },
});

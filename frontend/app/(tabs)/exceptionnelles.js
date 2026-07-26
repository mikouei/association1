import React, { useState, useCallback } from 'react';
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
import { Heart, Gift, HandHeart, Star, SmileyMeh, Plus, X, Pencil, Trash, Download, CaretDown, CaretRight, MagnifyingGlass, User, UsersThree, CurrencyCircleDollar, Check, ArrowRight } from 'phosphor-react-native';
import api from '../../utils/api';
import { useFocusEffect } from '@react-navigation/native';
import { formatNumber } from '../../utils/format';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import { colors, spacing, borderRadius, typography } from '../../utils/theme';

const TYPES = ['décès', 'mariage', 'anniversaire', 'solidarité', 'réunion', 'autre'];

export default function Exceptionnelles() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  // Segment actif: 'events' ou 'tontines'
  const [activeSegment, setActiveSegment] = useState('events');
  const [tontinesEnabled, setTontinesEnabled] = useState(false);

  const [contributions, setContributions] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Modals Événements
  const [modalVisible, setModalVisible] = useState(false);
  const [detailModal, setDetailModal] = useState(false);
  const [paymentModal, setPaymentModal] = useState(false);
  const [memberSelectModal, setMemberSelectModal] = useState(false);
  
  // State Événements
  const [selectedContribution, setSelectedContribution] = useState(null);
  const [editingContribution, setEditingContribution] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    type: 'décès',
    description: '',
    hasCollection: true,
    eventDate: '',
    recurrence: 'once'
  });
  const [paymentData, setPaymentData] = useState({
    memberId: '',
    memberName: '',
    amount: ''
  });
  const [saving, setSaving] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  // State Tontines
  const [tontines, setTontines] = useState([]);
  const [loadingTontines, setLoadingTontines] = useState(false);
  const [tontineModalVisible, setTontineModalVisible] = useState(false);
  const [tontineDetailModal, setTontineDetailModal] = useState(false);
  const [selectedTontine, setSelectedTontine] = useState(null);
  const [tontineDetail, setTontineDetail] = useState(null);
  const [tontineFormData, setTontineFormData] = useState({
    name: '',
    amount: '',
    frequency: 'monthly',
    memberIds: []
  });
  const [tontinePaymentModal, setTontinePaymentModal] = useState(false);
  const [tontinePaymentData, setTontinePaymentData] = useState({
    memberId: '',
    memberName: '',
    amount: ''
  });
  const [tontineMemberSelectModal, setTontineMemberSelectModal] = useState(false);
  const [savingTontine, setSavingTontine] = useState(false);

  // Recharger les données et le statut tontinesEnabled à chaque fois que l'onglet est affiché
  useFocusEffect(
    useCallback(() => {
      loadContributions();
      // loadMembers et tontinesEnabled uniquement pour les admins
      if (isAdmin) {
        loadMembers();
        // Rafraîchir le statut tontinesEnabled à chaque focus
        api.get('/auth/association-settings')
          .then(res => {
            const enabled = res.data.tontinesEnabled || false;
            setTontinesEnabled(enabled);
            if (enabled) {
              loadTontines();
            }
          })
          .catch(() => setTontinesEnabled(false));
      }
    }, [isAdmin])
  );

  // Charger les tontines
  const loadTontines = async () => {
    setLoadingTontines(true);
    try {
      const response = await api.get('/tontines');
      setTontines(response.data);
    } catch (error) {
      console.error('Erreur chargement tontines:', error);
    } finally {
      setLoadingTontines(false);
    }
  };

  // Charger le détail d'une tontine
  const loadTontineDetail = async (id) => {
    try {
      const response = await api.get(`/tontines/${id}`);
      setTontineDetail(response.data);
    } catch (error) {
      console.error('Erreur chargement détail tontine:', error);
      Alert.alert('Erreur', 'Impossible de charger les détails');
    }
  };

  const loadContributions = async () => {
    try {
      // Appeler l'URL selon le rôle
      const url = isAdmin ? '/exceptional' : '/exceptional/mine';
      const response = await api.get(url);
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
    setFormData({ title: '', type: 'décès', description: '', hasCollection: true, eventDate: '', recurrence: 'once' });
    setModalVisible(true);
  };

  const handleOpenEditModal = (contribution) => {
    setEditingContribution(contribution);
    // Formater la date pour l'affichage (JJ/MM/AAAA)
    let formattedDate = '';
    if (contribution.eventDate) {
      const date = new Date(contribution.eventDate);
      formattedDate = `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
    }
    setFormData({
      title: contribution.title,
      type: contribution.type,
      description: contribution.description || '',
      hasCollection: contribution.hasCollection !== false, // Par défaut true
      eventDate: formattedDate,
      recurrence: contribution.recurrence || 'once'
    });
    setDetailModal(false);
    setTimeout(() => setModalVisible(true), 300);
  };

  // Formater automatiquement la date au format JJ/MM/AAAA pendant la saisie
  const formatDateInput = (text) => {
    // Ne garder que les chiffres
    const digits = text.replace(/\D/g, '');
    // Insérer les / aux bons endroits
    if (digits.length <= 2) return digits;
    if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
  };

  const handleSave = async () => {
    if (!formData.title) {
      Alert.alert('Erreur', 'Titre requis');
      return;
    }

    // Valider le format de la date si fournie
    if (formData.eventDate) {
      const dateRegex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
      const match = formData.eventDate.match(dateRegex);
      if (!match) {
        Alert.alert('Erreur', 'Format de date invalide (JJ/MM/AAAA)');
        return;
      }
      const [, day, month, year] = match;
      const date = new Date(year, month - 1, day);
      if (isNaN(date.getTime())) {
        Alert.alert('Erreur', 'Date invalide');
        return;
      }
    }

    setSaving(true);
    try {
      // Préparer les données avec la date au format ISO
      const payload = {
        ...formData,
        eventDate: formData.eventDate 
          ? (() => {
              const [day, month, year] = formData.eventDate.split('/');
              return new Date(year, month - 1, day).toISOString();
            })()
          : null
      };

      if (editingContribution) {
        await api.put(`/exceptional/${editingContribution.id}`, payload);
        Alert.alert('Succès', formData.hasCollection ? 'Cotisation modifiée' : 'Événement modifié');
      } else {
        await api.post('/exceptional', payload);
        Alert.alert('Succès', formData.hasCollection ? 'Cotisation créée' : 'Événement créé');
      }
      setModalVisible(false);
      setFormData({ title: '', type: 'décès', description: '', hasCollection: true, eventDate: '', recurrence: 'once' });
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
      case 'réunion': return <UsersThree {...iconProps} />;
      default: return <Star {...iconProps} />;
    }
  };

  const filteredMembers = members.filter(m =>
    m.name.toLowerCase().includes(memberSearch.toLowerCase()) ||
    m.customFieldValue?.toLowerCase().includes(memberSearch.toLowerCase())
  );

  // Formater la date pour l'affichage
  const formatEventDate = (dateString) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
  };

  // =====================
  // FONCTIONS TONTINES
  // =====================

  const handleCreateTontine = async () => {
    if (!tontineFormData.name.trim()) {
      Alert.alert('Erreur', 'Nom de la tontine requis');
      return;
    }
    if (!tontineFormData.amount || parseFloat(tontineFormData.amount) <= 0) {
      Alert.alert('Erreur', 'Montant invalide');
      return;
    }
    if (tontineFormData.memberIds.length < 2) {
      Alert.alert('Erreur', 'Au moins 2 participants requis');
      return;
    }

    setSavingTontine(true);
    try {
      await api.post('/tontines', {
        name: tontineFormData.name.trim(),
        amount: parseFloat(tontineFormData.amount),
        frequency: tontineFormData.frequency,
        memberIds: tontineFormData.memberIds
      });
      Alert.alert('Succès', 'Tontine créée');
      setTontineModalVisible(false);
      setTontineFormData({ name: '', amount: '', frequency: 'monthly', memberIds: [] });
      loadTontines();
    } catch (error) {
      console.error('Erreur création tontine:', error);
      Alert.alert('Erreur', error.response?.data?.error || 'Impossible de créer la tontine');
    } finally {
      setSavingTontine(false);
    }
  };

  const handleDeleteTontine = (tontine) => {
    Alert.alert(
      'Supprimer la tontine',
      `Supprimer "${tontine.name}" ? Cette action est irréversible.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/tontines/${tontine.id}`);
              Alert.alert('Succès', 'Tontine supprimée');
              loadTontines();
              if (tontineDetailModal && selectedTontine?.id === tontine.id) {
                setTontineDetailModal(false);
                setSelectedTontine(null);
                setTontineDetail(null);
              }
            } catch (error) {
              console.error('Erreur suppression tontine:', error);
              Alert.alert('Erreur', error.response?.data?.error || 'Impossible de supprimer (des paiements existent peut-être)');
            }
          }
        }
      ]
    );
  };

  const handleOpenTontineDetail = async (tontine) => {
    setSelectedTontine(tontine);
    setTontineDetailModal(true);
    await loadTontineDetail(tontine.id);
  };

  const handleTontinePayment = async () => {
    if (!tontinePaymentData.memberId || !tontinePaymentData.amount) {
      Alert.alert('Erreur', 'Membre et montant requis');
      return;
    }

    setSavingTontine(true);
    try {
      await api.post(`/tontines/${selectedTontine.id}/payments`, {
        memberId: tontinePaymentData.memberId,
        amount: parseFloat(tontinePaymentData.amount)
      });
      Alert.alert('Succès', 'Paiement enregistré');
      setTontinePaymentModal(false);
      setTontinePaymentData({ memberId: '', memberName: '', amount: '' });
      await loadTontineDetail(selectedTontine.id);
      loadTontines();
    } catch (error) {
      console.error('Erreur paiement tontine:', error);
      Alert.alert('Erreur', error.response?.data?.error || 'Impossible d\'enregistrer le paiement');
    } finally {
      setSavingTontine(false);
    }
  };

  const handleCloseRound = () => {
    Alert.alert(
      'Clôturer le tour',
      'Êtes-vous sûr de vouloir clôturer ce tour et passer au suivant ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Clôturer',
          onPress: async () => {
            setSavingTontine(true);
            try {
              await api.post(`/tontines/${selectedTontine.id}/close-round`);
              Alert.alert('Succès', 'Tour clôturé, passage au suivant');
              await loadTontineDetail(selectedTontine.id);
              loadTontines();
            } catch (error) {
              console.error('Erreur clôture tour:', error);
              Alert.alert('Erreur', error.response?.data?.error || 'Impossible de clôturer le tour');
            } finally {
              setSavingTontine(false);
            }
          }
        }
      ]
    );
  };

  const toggleTontineMember = (member) => {
    const oderId = member.id;
    setTontineFormData(prev => {
      const exists = prev.memberIds.includes(oderId);
      return {
        ...prev,
        memberIds: exists 
          ? prev.memberIds.filter(id => id !== oderId)
          : [...prev.memberIds, oderId]
      };
    });
  };

  const getFrequencyLabel = (freq) => {
    return freq === 'weekly' ? 'Hebdomadaire' : 'Mensuelle';
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'active': return 'En cours';
      case 'completed': return 'Terminée';
      case 'cancelled': return 'Annulée';
      default: return status;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return colors.success;
      case 'completed': return colors.primary;
      case 'cancelled': return colors.error;
      default: return colors.textMuted;
    }
  };

  // Render d'une tontine dans la liste
  const renderTontine = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => handleOpenTontineDetail(item)}
      data-testid={`tontine-card-${item.id}`}
    >
      <View style={styles.cardHeader}>
        <View style={[styles.iconContainer, { backgroundColor: colors.secondary + '20' }]}>
          <CurrencyCircleDollar size={32} color={colors.secondary} weight="duotone" />
        </View>
        <View style={styles.cardInfo}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardTitle}>{item.name}</Text>
            <View style={[styles.monthlyBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
              <Text style={[styles.monthlyBadgeText, { color: getStatusColor(item.status) }]}>{getStatusLabel(item.status)}</Text>
            </View>
          </View>
          <Text style={styles.cardType}>{getFrequencyLabel(item.frequency)} • {formatNumber(item.amount)} FCFA/tour</Text>
        </View>
      </View>

      <View style={styles.cardStats}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>Tour {item.currentRound}</Text>
          <Text style={styles.statLabel}>En cours</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{item.participantsCount || 0}</Text>
          <Text style={styles.statLabel}>Participants</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  // =====================
  // FIN FONCTIONS TONTINES
  // =====================

  const renderContribution = ({ item }) => {
    const showCollection = item.hasCollection !== false; // Par défaut true (données existantes)
    const eventDateFormatted = formatEventDate(item.eventDate);
    
    return (
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
            <View style={styles.cardTitleRow}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              {item.recurrence === 'monthly' && (
                <View style={styles.monthlyBadge}>
                  <Text style={styles.monthlyBadgeText}>Mensuel</Text>
                </View>
              )}
            </View>
            <Text style={styles.cardType}>{item.type}</Text>
          </View>
        </View>

        {showCollection ? (
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
        ) : (
          <View style={styles.cardEventInfo}>
            {eventDateFormatted && (
              <Text style={styles.eventDateText}>📅 {eventDateFormatted}</Text>
            )}
            <Text style={styles.noCollectionText}>Événement informatif</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Segment Selector - Visible uniquement si admin ET tontines activées */}
      {isAdmin && tontinesEnabled && (
        <View style={styles.segmentContainer}>
          <TouchableOpacity
            style={[styles.segmentButton, activeSegment === 'events' && styles.segmentButtonActive]}
            onPress={() => setActiveSegment('events')}
          >
            <Text style={[styles.segmentText, activeSegment === 'events' && styles.segmentTextActive]}>
              Événements
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segmentButton, activeSegment === 'tontines' && styles.segmentButtonActive]}
            onPress={() => setActiveSegment('tontines')}
          >
            <Text style={[styles.segmentText, activeSegment === 'tontines' && styles.segmentTextActive]}>
              Tontines
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Contenu selon le segment actif */}
      {activeSegment === 'events' ? (
        <>
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
        </>
      ) : (
        <>
          {loadingTontines ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <FlatList
              data={tontines}
              renderItem={renderTontine}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadTontines().finally(() => setRefreshing(false)); }} colors={[colors.primary]} />
              }
              ListEmptyComponent={() => (
                <View style={styles.emptyContainer}>
                  <CurrencyCircleDollar size={64} color={colors.border} weight="duotone" />
                  <Text style={styles.emptyText}>Aucune tontine créée</Text>
                  <Text style={styles.emptySubtext}>Créez une tontine pour démarrer l&apos;épargne rotative</Text>
                </View>
              )}
            />
          )}

          <TouchableOpacity
            style={styles.fab}
            onPress={() => setTontineModalVisible(true)}
            data-testid="add-tontine-btn"
          >
            <Plus size={28} color={colors.textOnPrimary} weight="bold" />
          </TouchableOpacity>
        </>
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

              {/* Date de l'événement */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Date de l{"'"}événement (optionnel)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="JJ/MM/AAAA"
                  placeholderTextColor={colors.textMuted}
                  value={formData.eventDate}
                  onChangeText={(text) => setFormData({ ...formData, eventDate: formatDateInput(text) })}
                  keyboardType="number-pad"
                  maxLength={10}
                />
              </View>

              {/* Collecte d'argent Oui/Non */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Cette annonce implique-t-elle une collecte d{"'"}argent ?</Text>
                <View style={styles.toggleRow}>
                  <TouchableOpacity
                    style={[
                      styles.toggleButton,
                      formData.hasCollection && styles.toggleButtonActive
                    ]}
                    onPress={() => setFormData({ ...formData, hasCollection: true })}
                  >
                    <Text style={[
                      styles.toggleButtonText,
                      formData.hasCollection && styles.toggleButtonTextActive
                    ]}>Oui</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.toggleButton,
                      !formData.hasCollection && styles.toggleButtonActive
                    ]}
                    onPress={() => setFormData({ ...formData, hasCollection: false })}
                  >
                    <Text style={[
                      styles.toggleButtonText,
                      !formData.hasCollection && styles.toggleButtonTextActive
                    ]}>Non</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Périodicité */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Périodicité</Text>
                <View style={styles.toggleRow}>
                  <TouchableOpacity
                    style={[
                      styles.toggleButton,
                      formData.recurrence === 'once' && styles.toggleButtonActive
                    ]}
                    onPress={() => setFormData({ ...formData, recurrence: 'once' })}
                  >
                    <Text style={[
                      styles.toggleButtonText,
                      formData.recurrence === 'once' && styles.toggleButtonTextActive
                    ]}>Ponctuel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.toggleButton,
                      formData.recurrence === 'monthly' && styles.toggleButtonActive
                    ]}
                    onPress={() => setFormData({ ...formData, recurrence: 'monthly' })}
                  >
                    <Text style={[
                      styles.toggleButtonText,
                      formData.recurrence === 'monthly' && styles.toggleButtonTextActive
                    ]}>Mensuel</Text>
                  </TouchableOpacity>
                </View>
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

                {selectedContribution.hasCollection === false ? (
                  <View style={styles.eventDetailSection}>
                    <Text style={styles.eventDetailDate}>
                      {selectedContribution.eventDate
                        ? new Date(selectedContribution.eventDate).toLocaleDateString('fr-FR')
                        : 'Pas de date renseignée'}
                    </Text>
                    {selectedContribution.recurrence === 'monthly' && (
                      <Text style={styles.eventDetailRecurrence}>Se répète tous les mois</Text>
                    )}
                  </View>
                ) : (
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
                )}

                {/* Actions Admin (Modifier / Supprimer) — toujours disponibles, même sans collecte */}
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

                {selectedContribution.hasCollection !== false && (
                  <>
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
                  </>
                )}
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

      {/* ===================== */}
      {/* MODALES TONTINES */}
      {/* ===================== */}

      {/* Modal Création Tontine */}
      <Modal
        visible={tontineModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setTontineModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContainer}
        >
          <View style={[styles.modalContent, { maxHeight: '90%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nouvelle tontine</Text>
              <TouchableOpacity onPress={() => { setTontineModalVisible(false); setTontineFormData({ name: '', amount: '', frequency: 'monthly', memberIds: [] }); }}>
                <X size={28} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Nom de la tontine *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ex: Tontine Mensuelle"
                  placeholderTextColor={colors.textMuted}
                  value={tontineFormData.name}
                  onChangeText={(text) => setTontineFormData({ ...tontineFormData, name: text })}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Montant par tour (FCFA) *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ex: 50000"
                  placeholderTextColor={colors.textMuted}
                  value={tontineFormData.amount}
                  onChangeText={(text) => setTontineFormData({ ...tontineFormData, amount: text })}
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Fréquence</Text>
                <View style={styles.toggleRow}>
                  <TouchableOpacity
                    style={[styles.toggleButton, tontineFormData.frequency === 'monthly' && styles.toggleButtonActive]}
                    onPress={() => setTontineFormData({ ...tontineFormData, frequency: 'monthly' })}
                  >
                    <Text style={[styles.toggleButtonText, tontineFormData.frequency === 'monthly' && styles.toggleButtonTextActive]}>
                      Mensuelle
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.toggleButton, tontineFormData.frequency === 'weekly' && styles.toggleButtonActive]}
                    onPress={() => setTontineFormData({ ...tontineFormData, frequency: 'weekly' })}
                  >
                    <Text style={[styles.toggleButtonText, tontineFormData.frequency === 'weekly' && styles.toggleButtonTextActive]}>
                      Hebdomadaire
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Participants ({tontineFormData.memberIds.length} sélectionnés) *</Text>
                <TouchableOpacity
                  style={styles.memberSelector}
                  onPress={() => setTontineMemberSelectModal(true)}
                >
                  <Text style={tontineFormData.memberIds.length > 0 ? styles.memberSelectorText : styles.memberSelectorPlaceholder}>
                    {tontineFormData.memberIds.length > 0 
                      ? `${tontineFormData.memberIds.length} membre(s) sélectionné(s)` 
                      : 'Sélectionner les participants'}
                  </Text>
                  <CaretDown size={20} color={colors.textMuted} />
                </TouchableOpacity>
                <Text style={styles.helpText}>L&apos;ordre de sélection détermine l&apos;ordre de passage</Text>
              </View>

              <TouchableOpacity
                style={[styles.submitButton, savingTontine && styles.submitButtonDisabled]}
                onPress={handleCreateTontine}
                disabled={savingTontine}
              >
                {savingTontine ? (
                  <ActivityIndicator color={colors.textOnPrimary} />
                ) : (
                  <Text style={styles.submitButtonText}>Créer la tontine</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal Sélection Membres Tontine (multi-select) */}
      <Modal
        visible={tontineMemberSelectModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setTontineMemberSelectModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, { maxHeight: '80%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Sélectionner les participants</Text>
              <TouchableOpacity onPress={() => setTontineMemberSelectModal(false)}>
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
              renderItem={({ item }) => {
                const isSelected = tontineFormData.memberIds.includes(item.id);
                const orderIndex = tontineFormData.memberIds.indexOf(item.id);
                return (
                  <TouchableOpacity
                    style={[styles.memberItem, isSelected && styles.memberItemSelected]}
                    onPress={() => toggleTontineMember(item)}
                  >
                    <View style={[styles.memberItemIcon, isSelected && { backgroundColor: colors.primary }]}>
                      {isSelected ? (
                        <Text style={{ color: colors.textOnPrimary, fontWeight: 'bold' }}>{orderIndex + 1}</Text>
                      ) : (
                        <User size={20} color={colors.primary} />
                      )}
                    </View>
                    <View style={styles.memberItemInfo}>
                      <Text style={styles.memberItemName}>{item.name}</Text>
                      <Text style={styles.memberItemField}>{item.customFieldValue}</Text>
                    </View>
                    {isSelected && <Check size={24} color={colors.primary} weight="bold" />}
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={() => (
                <Text style={styles.noMembers}>Aucun membre trouvé</Text>
              )}
            />

            <TouchableOpacity
              style={styles.submitButton}
              onPress={() => setTontineMemberSelectModal(false)}
            >
              <Text style={styles.submitButtonText}>Valider ({tontineFormData.memberIds.length})</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal Détail Tontine */}
      <Modal
        visible={tontineDetailModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => { setTontineDetailModal(false); setSelectedTontine(null); setTontineDetail(null); }}
      >
        <View style={styles.modalContainer}>
          <View style={[styles.detailModalContent, { maxHeight: '95%' }]}>
            <View style={styles.detailModalHeader}>
              <TouchableOpacity 
                onPress={() => { setTontineDetailModal(false); setSelectedTontine(null); setTontineDetail(null); }}
                style={styles.backButton}
              >
                <X size={24} color={colors.text} />
              </TouchableOpacity>
              <Text style={styles.detailModalTitle} numberOfLines={1}>
                {selectedTontine?.name}
              </Text>
              <TouchableOpacity onPress={() => handleDeleteTontine(selectedTontine)}>
                <Trash size={24} color={colors.error} />
              </TouchableOpacity>
            </View>

            {!tontineDetail ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : (
              <ScrollView style={styles.detailScrollView}>
                {/* Info Tontine */}
                <View style={styles.detailSection}>
                  <View style={styles.detailInfoRow}>
                    <Text style={styles.detailInfoLabel}>Montant par tour:</Text>
                    <Text style={styles.detailInfoValue}>{formatNumber(tontineDetail.amount)} FCFA</Text>
                  </View>
                  <View style={styles.detailInfoRow}>
                    <Text style={styles.detailInfoLabel}>Fréquence:</Text>
                    <Text style={styles.detailInfoValue}>{getFrequencyLabel(tontineDetail.frequency)}</Text>
                  </View>
                  <View style={styles.detailInfoRow}>
                    <Text style={styles.detailInfoLabel}>Statut:</Text>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(tontineDetail.status) + '20' }]}>
                      <Text style={[styles.statusBadgeText, { color: getStatusColor(tontineDetail.status) }]}>
                        {getStatusLabel(tontineDetail.status)}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.detailInfoRow}>
                    <Text style={styles.detailInfoLabel}>Tour actuel:</Text>
                    <Text style={styles.detailInfoValue}>{tontineDetail.currentRound} / {tontineDetail.participants?.length || 0}</Text>
                  </View>
                </View>

                {/* Tour en cours */}
                {tontineDetail.status === 'active' && tontineDetail.rounds?.length > 0 && (
                  <View style={styles.detailSection}>
                    <Text style={styles.sectionTitle}>Tour en cours</Text>
                    {(() => {
                      const openRound = tontineDetail.rounds.find(r => r.status === 'open');
                      if (!openRound) return <Text style={styles.noPayments}>Aucun tour ouvert</Text>;
                      
                      const beneficiary = tontineDetail.participants?.find(p => p.memberId === openRound.beneficiaryMemberId);
                      
                      return (
                        <>
                          <View style={styles.beneficiaryCard}>
                            <CurrencyCircleDollar size={32} color={colors.primary} weight="fill" />
                            <View style={{ marginLeft: 12, flex: 1 }}>
                              <Text style={styles.beneficiaryLabel}>Bénéficiaire</Text>
                              <Text style={styles.beneficiaryName}>{beneficiary?.member?.name || 'Inconnu'}</Text>
                            </View>
                          </View>

                          <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Paiements du tour</Text>
                          {openRound.payments?.map(payment => (
                            <View key={payment.id} style={styles.paymentRow}>
                              <View style={styles.paymentInfo}>
                                <Text style={styles.paymentName}>{payment.member?.name}</Text>
                                <Text style={styles.paymentAmount}>{formatNumber(payment.amount)} FCFA</Text>
                              </View>
                              {payment.isPaid ? (
                                <View style={[styles.paymentStatus, { backgroundColor: colors.success + '20' }]}>
                                  <Check size={16} color={colors.success} weight="bold" />
                                  <Text style={[styles.paymentStatusText, { color: colors.success }]}>Payé</Text>
                                </View>
                              ) : (
                                <TouchableOpacity
                                  style={[styles.paymentStatus, { backgroundColor: colors.primary + '20' }]}
                                  onPress={() => {
                                    setTontinePaymentData({
                                      memberId: payment.memberId,
                                      memberName: payment.member?.name,
                                      amount: tontineDetail.amount.toString()
                                    });
                                    setTontinePaymentModal(true);
                                  }}
                                >
                                  <Text style={[styles.paymentStatusText, { color: colors.primary }]}>Marquer payé</Text>
                                </TouchableOpacity>
                              )}
                            </View>
                          ))}

                          {/* Bouton clôturer le tour */}
                          <TouchableOpacity
                            style={[styles.closeRoundButton, savingTontine && styles.submitButtonDisabled]}
                            onPress={handleCloseRound}
                            disabled={savingTontine}
                          >
                            {savingTontine ? (
                              <ActivityIndicator color={colors.textOnPrimary} />
                            ) : (
                              <>
                                <ArrowRight size={20} color={colors.textOnPrimary} weight="bold" />
                                <Text style={styles.closeRoundButtonText}>Clôturer et passer au tour suivant</Text>
                              </>
                            )}
                          </TouchableOpacity>
                        </>
                      );
                    })()}
                  </View>
                )}

                {/* Liste des participants */}
                <View style={styles.detailSection}>
                  <Text style={styles.sectionTitle}>Participants ({tontineDetail.participants?.length || 0})</Text>
                  {tontineDetail.participants?.map((participant, index) => (
                    <View key={participant.id} style={styles.participantRow}>
                      <View style={styles.participantOrder}>
                        <Text style={styles.participantOrderText}>{participant.order}</Text>
                      </View>
                      <View style={styles.participantInfo}>
                        <Text style={styles.participantName}>{participant.member?.name}</Text>
                        {participant.hasReceived && (
                          <Text style={styles.participantReceived}>A reçu au tour {participant.receivedRound}</Text>
                        )}
                      </View>
                      {participant.hasReceived ? (
                        <Check size={20} color={colors.success} weight="bold" />
                      ) : (
                        <Text style={styles.participantPending}>En attente</Text>
                      )}
                    </View>
                  ))}
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Modal Paiement Tontine */}
      <Modal
        visible={tontinePaymentModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setTontinePaymentModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContainer}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Confirmer le paiement</Text>
              <TouchableOpacity onPress={() => setTontinePaymentModal(false)}>
                <X size={28} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Membre</Text>
              <View style={styles.readOnlyField}>
                <Text style={styles.readOnlyText}>{tontinePaymentData.memberName}</Text>
              </View>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Montant (FCFA)</Text>
              <TextInput
                style={styles.input}
                value={tontinePaymentData.amount}
                onChangeText={(text) => setTontinePaymentData({ ...tontinePaymentData, amount: text })}
                keyboardType="numeric"
              />
            </View>

            <TouchableOpacity
              style={[styles.submitButton, savingTontine && styles.submitButtonDisabled]}
              onPress={handleTontinePayment}
              disabled={savingTontine}
            >
              {savingTontine ? (
                <ActivityIndicator color={colors.textOnPrimary} />
              ) : (
                <Text style={styles.submitButtonText}>Confirmer le paiement</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: colors.backgroundWhite,
    padding: spacing.sm,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    borderRadius: borderRadius.lg,
    gap: spacing.sm,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  segmentButtonActive: {
    backgroundColor: colors.primary,
  },
  segmentText: {
    fontSize: typography.body.fontSize,
    fontWeight: '600',
    color: colors.textMuted,
  },
  segmentTextActive: {
    color: colors.textOnPrimary,
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
  // Styles pour les événements sans collecte
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recurrenceBadge: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    marginLeft: spacing.sm,
  },
  recurrenceBadgeText: {
    fontSize: typography.caption.fontSize,
    color: colors.textOnPrimary,
    fontWeight: '600',
  },
  eventInfoRow: {
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  eventInfoText: {
    fontSize: typography.body.fontSize,
    color: colors.textMuted,
  },
  collectionToggleRow: {
    flexDirection: 'row',
  },
  collectionToggleButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.sm,
  },
  collectionToggleButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  collectionToggleText: {
    fontSize: typography.body.fontSize,
    color: colors.textMuted,
    fontWeight: '600',
  },
  collectionToggleTextActive: {
    color: colors.textOnPrimary,
  },
  eventDetailSection: {
    paddingVertical: spacing.md,
  },
  eventDetailDate: {
    fontSize: typography.h3.fontSize,
    fontWeight: '600',
    color: colors.text,
  },
  eventDetailRecurrence: {
    fontSize: typography.body.fontSize,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  // Styles existants pour cartes événements (reprise)
  cardEventInfo: {
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  eventDateText: {
    fontSize: typography.body.fontSize,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  noCollectionText: {
    fontSize: typography.caption.fontSize,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  monthlyBadge: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    marginLeft: spacing.sm,
  },
  monthlyBadgeText: {
    fontSize: typography.caption.fontSize,
    color: colors.textOnPrimary,
    fontWeight: '600',
  },
  monthlyBadgeLarge: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    marginLeft: spacing.sm,
  },
  detailTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  eventInfoBox: {
    backgroundColor: colors.background,
    padding: spacing.lg,
    borderRadius: borderRadius.card,
    marginBottom: spacing.lg,
  },
  eventInfoNote: {
    fontSize: typography.caption.fontSize,
    color: colors.textMuted,
    fontStyle: 'italic',
    marginTop: spacing.sm,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  toggleButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  toggleButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  toggleButtonText: {
    fontSize: typography.body.fontSize,
    color: colors.textMuted,
    fontWeight: '600',
  },
  toggleButtonTextActive: {
    color: colors.textOnPrimary,
  },
  // Styles Tontines
  emptySubtext: {
    fontSize: typography.caption.fontSize,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  memberItemSelected: {
    backgroundColor: colors.primary + '10',
    borderColor: colors.primary,
    borderWidth: 1,
  },
  helpText: {
    fontSize: typography.caption.fontSize,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  beneficiaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary + '15',
    padding: spacing.md,
    borderRadius: borderRadius.card,
    marginBottom: spacing.md,
  },
  beneficiaryLabel: {
    fontSize: typography.caption.fontSize,
    color: colors.textMuted,
  },
  beneficiaryName: {
    fontSize: typography.body.fontSize,
    fontWeight: '700',
    color: colors.text,
  },
  tontinePaymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  paymentStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    gap: 4,
  },
  paymentStatusText: {
    fontSize: typography.caption.fontSize,
    fontWeight: '600',
  },
  closeRoundButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.secondary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.button,
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  closeRoundButtonText: {
    color: colors.textOnSecondary,
    fontSize: typography.body.fontSize,
    fontWeight: '600',
  },
  participantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  participantOrder: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  participantOrderText: {
    color: colors.textOnSecondary,
    fontSize: typography.caption.fontSize,
    fontWeight: 'bold',
  },
  participantInfo: {
    flex: 1,
  },
  participantName: {
    fontSize: typography.body.fontSize,
    fontWeight: '500',
    color: colors.text,
  },
  participantReceived: {
    fontSize: typography.caption.fontSize,
    color: colors.success,
  },
  participantPending: {
    fontSize: typography.caption.fontSize,
    color: colors.textMuted,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  statusBadgeText: {
    fontSize: typography.caption.fontSize,
    fontWeight: '600',
  },
  readOnlyField: {
    backgroundColor: colors.background,
    padding: spacing.md,
    borderRadius: borderRadius.input,
    borderWidth: 1,
    borderColor: colors.border,
  },
  readOnlyText: {
    fontSize: typography.body.fontSize,
    color: colors.text,
  },
});

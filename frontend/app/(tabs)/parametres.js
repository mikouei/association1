import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Modal,
  FlatList,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { 
  User, Envelope, Phone, UserCircle, Pencil, CheckCircle, Plus, X, 
  ArrowLeft, FolderOpen, Eye, CloudArrowUp, Download, File, FileText,
  SignOut, Trash, Warning, CaretForward
} from 'phosphor-react-native';
import api from '../../utils/api';
import { useRouter } from 'expo-router';
import * as FileSystemLegacy from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import * as DocumentPicker from 'expo-document-picker';
import { formatNumber, formatCurrency } from '../../utils/format';
import { colors, spacing, borderRadius, typography } from '../../utils/theme';

export default function Parametres() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const isAdmin = user?.role === 'ADMIN';

  const [config, setConfig] = useState(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    type: '',
    memberFieldLabel: '',
  });

  // Années
  const [years, setYears] = useState([]);
  const [yearModalVisible, setYearModalVisible] = useState(false);
  const [editingYear, setEditingYear] = useState(null);
  const [yearFormData, setYearFormData] = useState({
    year: '',
    monthlyAmount: ''
  });

  // Import
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [importContent, setImportContent] = useState('');
  const [importPreview, setImportPreview] = useState(null);
  const [importing, setImporting] = useState(false);

  // Suppression de compte
  const [deleteAccountModalVisible, setDeleteAccountModalVisible] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadConfig();
    loadYears();
  }, []);

  const loadConfig = async () => {
    try {
      const response = await api.get('/config');
      setConfig(response.data);
      setFormData({
        name: response.data.name || '',
        type: response.data.type || '',
        memberFieldLabel: response.data.memberFieldLabel || '',
      });
    } catch (error) {
      console.error('Erreur chargement config:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadYears = async () => {
    try {
      const response = await api.get('/years');
      setYears(response.data);
    } catch (error) {
      console.error('Erreur chargement années:', error);
    }
  };

  // Suppression de compte
  const handleDeleteAccount = async () => {
    if (!deletePassword) {
      Alert.alert('Erreur', 'Veuillez entrer votre mot de passe pour confirmer');
      return;
    }

    setDeleting(true);
    try {
      await api.delete('/auth/me', {
        data: { password: deletePassword }
      });
      
      Alert.alert(
        'Compte supprimé',
        'Votre compte a été supprimé. L\'historique des cotisations est conservé pour la comptabilité de l\'association.',
        [{ text: 'OK', onPress: () => {
          setDeleteAccountModalVisible(false);
          setDeletePassword('');
          logout();
        }}]
      );
    } catch (error) {
      console.error('Erreur suppression compte:', error);
      const errorMessage = error.response?.data?.error || 'Erreur lors de la suppression du compte';
      Alert.alert('Erreur', errorMessage);
    } finally {
      setDeleting(false);
    }
  };

  const handleSaveConfig = async () => {
    if (!formData.name || !formData.memberFieldLabel) {
      Alert.alert('Erreur', 'Nom et libellé du champ requis');
      return;
    }

    setSaving(true);
    try {
      // Sauvegarder le libellé du champ personnalisé via la nouvelle route
      await api.put('/auth/association-settings', {
        memberFieldLabel: formData.memberFieldLabel
      });
      Alert.alert('Succès', 'Paramètres enregistrés');
      setEditing(false);
      loadConfig();
    } catch (error) {
      console.error('Erreur sauvegarde config:', error);
      const errorMessage = error.response?.data?.error || 'Erreur lors de la sauvegarde';
      Alert.alert('Erreur', errorMessage);
    } finally {
      setSaving(false);
    }
  };

  // Gestion Années
  const handleAddYear = () => {
    setEditingYear(null);
    setYearFormData({ year: '', monthlyAmount: '' });
    setYearModalVisible(true);
  };

  const handleEditYear = (year) => {
    setEditingYear(year);
    setYearFormData({ year: year.year.toString(), monthlyAmount: year.monthlyAmount.toString() });
    setYearModalVisible(true);
  };

  const handleSaveYear = async () => {
    if (!yearFormData.year || !yearFormData.monthlyAmount) {
      Alert.alert('Erreur', 'Année et montant requis');
      return;
    }

    setSaving(true);
    try {
      if (editingYear) {
        // Modification : envoyer l'année ET le montant
        await api.put(`/years/${editingYear.id}`, {
          year: parseInt(yearFormData.year),
          monthlyAmount: parseFloat(yearFormData.monthlyAmount)
        });
        Alert.alert('Succès', 'Année modifiée');
      } else {
        await api.post('/years', {
          year: parseInt(yearFormData.year),
          monthlyAmount: parseFloat(yearFormData.monthlyAmount),
          active: false
        });
        Alert.alert('Succès', 'Année créée');
      }
      setYearModalVisible(false);
      loadYears();
    } catch (error) {
      console.error('Erreur sauvegarde année:', error);
      Alert.alert('Erreur', error.response?.data?.error || 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const handleActivateYear = async (year) => {
    try {
      await api.put(`/years/${year.id}/activate`);
      Alert.alert('Succès', `Année ${year.year} activée`);
      loadYears();
    } catch (error) {
      console.error('Erreur activation:', error);
      Alert.alert('Erreur', 'Impossible d\'activer l\'année');
    }
  };

  // Import Membres via fichier
  const handlePickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/plain', 'text/csv', 'text/comma-separated-values', '*/*'],
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        return;
      }

      const file = result.assets[0];
      
      // Sur web, lire le fichier différemment
      if (Platform.OS === 'web') {
        // Pour le web, on peut utiliser fetch pour lire le blob
        const response = await fetch(file.uri);
        const text = await response.text();
        setImportContent(text);
        Alert.alert('Succès', `Fichier "${file.name}" chargé`);
      } else {
        // Sur mobile, utiliser FileSystem
        const content = await FileSystemLegacy.readAsStringAsync(file.uri);
        setImportContent(content);
        Alert.alert('Succès', `Fichier "${file.name}" chargé`);
      }
    } catch (error) {
      console.error('Erreur lecture fichier:', error);
      Alert.alert('Erreur', 'Impossible de lire le fichier');
    }
  };

  // Import Membres
  const handlePreviewImport = async () => {
    if (!importContent.trim()) {
      Alert.alert('Erreur', 'Veuillez coller le contenu à importer');
      return;
    }

    setImporting(true);
    try {
      const response = await api.post('/import/members/preview', {
        content: importContent
      });
      setImportPreview(response.data);
      
      if (response.data.errors > 0 || response.data.duplicates > 0) {
        Alert.alert(
          'Attention',
          `Lignes valides: ${response.data.valid}\nDoublons: ${response.data.duplicates}\nErreurs: ${response.data.errors}`
        );
      }
    } catch (error) {
      console.error('Erreur preview:', error);
      Alert.alert('Erreur', 'Erreur lors de la prévisualisation');
    } finally {
      setImporting(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!importPreview || importPreview.valid === 0) {
      Alert.alert('Erreur', 'Aucun membre valide à importer');
      return;
    }

    setImporting(true);
    try {
      const response = await api.post('/import/members', {
        members: importPreview.preview
      });
      
      Alert.alert(
        'Import terminé',
        `Succès: ${response.data.success}\nÉchecs: ${response.data.failed}`
      );
      
      // Reset et fermer
      setImportModalVisible(false);
      setImportContent('');
      setImportPreview(null);
    } catch (error) {
      console.error('Erreur import:', error);
      Alert.alert('Erreur', error.response?.data?.error || 'Erreur lors de l\'import');
    } finally {
      setImporting(false);
    }
  };

  // Export Membres
  const handleExportMembers = async () => {
    try {
      const response = await api.get('/export/members', {
        responseType: 'text'
      });
      
      // Sur le web, on télécharge directement
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'membres.csv';
        link.click();
        Alert.alert('Succès', 'Fichier téléchargé');
      } else {
        // Sur mobile, utiliser cacheDirectory et partage
        const filename = FileSystemLegacy.cacheDirectory + 'membres.csv';
        await FileSystemLegacy.writeAsStringAsync(filename, response.data);
        
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(filename, {
            mimeType: 'text/csv',
            dialogTitle: 'Enregistrer membres.csv',
            UTI: 'public.comma-separated-values-text'
          });
        } else {
          Alert.alert('Info', 'Partage non disponible sur cet appareil');
        }
      }
    } catch (error) {
      console.error('Erreur export:', error);
      Alert.alert('Erreur', `Impossible d'exporter les membres: ${error.message || 'Erreur inconnue'}`);
    }
  };

  // Fonction helper pour sauvegarder un fichier texte et le partager
  const saveToDownloads = async (content, filename, mimeType) => {
    try {
      // Écrire le fichier dans le cache de l'app (sans encodage explicite, UTF8 est par défaut)
      const tempUri = FileSystemLegacy.cacheDirectory + filename;
      await FileSystemLegacy.writeAsStringAsync(tempUri, content);
      
      // Vérifier si le partage est disponible
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert('Erreur', 'Le partage de fichiers n\'est pas disponible sur cet appareil');
        return false;
      }
      
      // Partager le fichier
      await Sharing.shareAsync(tempUri, {
        mimeType: mimeType || 'text/plain',
        dialogTitle: `Enregistrer ${filename}`,
        UTI: mimeType === 'application/pdf' ? 'com.adobe.pdf' : 'public.plain-text'
      });
      
      return true;
    } catch (error) {
      console.error('Erreur saveToDownloads:', error);
      Alert.alert('Erreur', `Impossible de créer le fichier: ${error.message || 'Erreur inconnue'}`);
      return false;
    }
  };

  // Fonction helper pour sauvegarder un PDF et le partager
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

  // Export Stats CSV - Utilise la nouvelle API backend
  const handleExportStats = async () => {
    try {
      const activeYear = years.find(y => y.active);
      if (!activeYear) {
        Alert.alert('Erreur', 'Aucune année active');
        return;
      }

      // Récupérer le fichier TXT depuis l'API
      const response = await api.get('/export/stats/csv', { responseType: 'text' });
      const content = response.data;
      const filename = `statistiques_${activeYear.year}.txt`;

      // Sur le web, on télécharge directement
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
        Alert.alert('Succès', 'Fichier téléchargé');
      } else {
        // Sur mobile, sauvegarder directement dans Téléchargements
        await saveToDownloads(content, filename, 'text/plain');
      }
    } catch (error) {
      console.error('Erreur export stats:', error);
      Alert.alert('Erreur', 'Impossible d\'exporter les statistiques');
    }
  };

  // Export Stats PDF - Utilise la nouvelle API backend
  const handleExportStatsPDF = async () => {
    try {
      const activeYear = years.find(y => y.active);
      if (!activeYear) {
        Alert.alert('Erreur', 'Aucune année active');
        return;
      }

      // Récupérer le HTML depuis l'API backend
      const response = await api.get('/export/stats/pdf', { responseType: 'text' });
      const html = response.data;
      const filename = `statistiques_${activeYear.year}.pdf`;

      // Sur le web, ouvrir dans une nouvelle fenêtre pour impression/téléchargement
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(html);
          printWindow.document.close();
          printWindow.print();
          Alert.alert('Succès', 'Document PDF ouvert pour impression');
        }
      } else {
        // Sur mobile, générer le PDF et le télécharger directement
        try {
          const { uri } = await Print.printToFileAsync({ 
            html,
            base64: false
          });
          
          // Sauvegarder directement dans le dossier Téléchargements
          await savePdfToDownloads(uri, filename);
        } catch (e) {
          console.error('Erreur Print.printToFileAsync:', e);
          Alert.alert('Erreur', 'Impossible de générer le PDF');
        }
      }
    } catch (error) {
      console.error('Erreur export PDF:', error);
      Alert.alert('Erreur', 'Impossible de générer le PDF');
    }
  };

  const handleLogout = () => {
    setLogoutModalVisible(true);
  };

  const confirmLogout = async () => {
    setLogoutModalVisible(false);
    try {
      await logout();
      // Forcer la navigation vers login après un court délai pour s'assurer que le state est mis à jour
      setTimeout(() => {
        router.replace('/login');
      }, 100);
    } catch (error) {
      console.error('Erreur déconnexion:', error);
      router.replace('/login');
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.content}>
        {/* Profil */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profil</Text>
          <View style={styles.card}>
            <View style={styles.profileRow}>
              <User size={20} color={colors.textMuted} />
              <View style={styles.profileInfo}>
                <Text style={styles.profileLabel}>Rôle</Text>
                <Text style={styles.profileValue}>
                  {user?.role === 'ADMIN' ? 'Administrateur' : 'Membre'}
                </Text>
              </View>
            </View>

            <View style={styles.profileRow}>
              <Envelope size={20} color={colors.textMuted} />
              <View style={styles.profileInfo}>
                <Text style={styles.profileLabel}>Email</Text>
                <Text style={styles.profileValue}>{user?.email}</Text>
              </View>
            </View>

            {user?.phone && (
              <View style={styles.profileRow}>
                <Phone size={20} color={colors.textMuted} />
                <View style={styles.profileInfo}>
                  <Text style={styles.profileLabel}>Téléphone</Text>
                  <Text style={styles.profileValue}>{user.phone}</Text>
                </View>
              </View>
            )}

            {user?.member && (
              <View style={styles.profileRow}>
                <UserCircle size={20} color={colors.textMuted} />
                <View style={styles.profileInfo}>
                  <Text style={styles.profileLabel}>Nom</Text>
                  <Text style={styles.profileValue}>{user.member.name}</Text>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Configuration Association */}
        {isAdmin && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Configuration de l'association</Text>
              {!editing && (
                <TouchableOpacity onPress={() => setEditing(true)}>
                  <Pencil size={20} color={colors.primary} />
                </TouchableOpacity>
              )}
            </View>

            {editing ? (
              <View style={styles.card}>
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Nom de l'association *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Ex: Association des Villas"
                    placeholderTextColor={colors.textMuted}
                    value={formData.name}
                    onChangeText={(text) => setFormData({ ...formData, name: text })}
                  />
                </View>

                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Type d'association</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Ex: Syndic, Tontine, ONG..."
                    placeholderTextColor={colors.textMuted}
                    value={formData.type}
                    onChangeText={(text) => setFormData({ ...formData, type: text })}
                  />
                </View>

                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Libellé du champ membre *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Ex: Villa, Groupe, Section..."
                    placeholderTextColor={colors.textMuted}
                    value={formData.memberFieldLabel}
                    onChangeText={(text) => setFormData({ ...formData, memberFieldLabel: text })}
                  />
                </View>

                <View style={styles.buttonRow}>
                  <TouchableOpacity
                    style={[styles.button, styles.cancelButton]}
                    onPress={() => {
                      setEditing(false);
                      setFormData({
                        name: config?.name || '',
                        type: config?.type || '',
                        memberFieldLabel: config?.memberFieldLabel || '',
                      });
                    }}
                  >
                    <Text style={styles.cancelButtonText}>Annuler</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.button, styles.saveButton, saving && styles.buttonDisabled]}
                    onPress={handleSaveConfig}
                    disabled={saving}
                  >
                    {saving ? (
                      <ActivityIndicator color={colors.textOnPrimary} size="small" />
                    ) : (
                      <Text style={styles.saveButtonText}>Enregistrer</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.card}>
                <View style={styles.configRow}>
                  <Text style={styles.configLabel}>Nom:</Text>
                  <Text style={styles.configValue}>{config?.name}</Text>
                </View>
                {config?.type && (
                  <View style={styles.configRow}>
                    <Text style={styles.configLabel}>Type:</Text>
                    <Text style={styles.configValue}>{config.type}</Text>
                  </View>
                )}
                <View style={styles.configRow}>
                  <Text style={styles.configLabel}>Libellé champ:</Text>
                  <Text style={styles.configValue}>{config?.memberFieldLabel}</Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Gestion des Années */}
        {isAdmin && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Gestion des Années</Text>
            <View style={styles.card}>
              {years.map((year) => (
                <View key={year.id} style={styles.yearItem}>
                  <View style={styles.yearInfo}>
                    <Text style={styles.yearText}>Année {year.year}</Text>
                    <Text style={styles.yearAmount}>{formatNumber(year.monthlyAmount)} FCFA/mois</Text>
                  </View>
                  <View style={styles.yearActions}>
                    {year.active ? (
                      <View style={styles.activeBadge}>
                        <CheckCircle size={16} color={colors.success} weight="fill" />
                        <Text style={styles.activeBadgeText}>Active</Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.activateButton}
                        onPress={() => handleActivateYear(year)}
                      >
                        <Text style={styles.activateButtonText}>Activer</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity onPress={() => handleEditYear(year)}>
                      <Pencil size={20} color={colors.primary} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
              
              <TouchableOpacity style={styles.addButton} onPress={handleAddYear}>
                <Plus size={20} color={colors.textOnPrimary} />
                <Text style={styles.addButtonText}>Créer une année</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Import/Export */}
        {isAdmin && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Import / Export</Text>
            <View style={styles.card}>
              <TouchableOpacity
                style={styles.optionButton}
                onPress={() => setImportModalVisible(true)}
              >
                <CloudArrowUp size={24} color={colors.primary} />
                <Text style={styles.optionText}>Importer membres (TXT/CSV)</Text>
                <CaretForward size={20} color={colors.textMuted} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.optionButton}
                onPress={handleExportMembers}
              >
                <Download size={24} color={colors.success} />
                <Text style={styles.optionText}>Exporter membres (CSV)</Text>
                <CaretForward size={20} color={colors.textMuted} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.optionButton}
                onPress={handleExportStats}
              >
                <File size={24} color={colors.warning} />
                <Text style={styles.optionText}>Exporter statistiques (CSV)</Text>
                <CaretForward size={20} color={colors.textMuted} />
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.optionButton} 
                onPress={handleExportStatsPDF}
              >
                <FileText size={24} color={colors.error} />
                <Text style={styles.optionText}>Exporter statistiques (PDF)</Text>
                <CaretForward size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Déconnexion */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Actions</Text>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <SignOut size={20} color={colors.textOnSecondary} />
            <Text style={styles.logoutButtonText}>Déconnexion</Text>
          </TouchableOpacity>
        </View>

        {/* Suppression de compte */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Zone dangereuse</Text>
          <TouchableOpacity 
            style={styles.deleteAccountButton} 
            onPress={() => setDeleteAccountModalVisible(true)}
          >
            <Trash size={20} color={colors.textOnSecondary} />
            <Text style={styles.deleteAccountButtonText}>Supprimer mon compte</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>AssocManager v1.0.0</Text>
          <Text style={styles.footerText}>Toutes phases implémentées</Text>
        </View>
      </ScrollView>

      {/* Modal Année */}
      <Modal
        visible={yearModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setYearModalVisible(false)}
      >
        <TouchableOpacity 
          style={styles.yearModalOverlay} 
          activeOpacity={1} 
          onPress={() => setYearModalVisible(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.yearModalKeyboardView}
          >
            <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
              <View style={styles.yearModalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>
                    {editingYear ? 'Modifier l\'année' : 'Nouvelle année'}
                  </Text>
                  <TouchableOpacity onPress={() => setYearModalVisible(false)}>
                    <X size={28} color={colors.text} />
                  </TouchableOpacity>
                </View>

                <ScrollView 
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ paddingBottom: 40 }}
                  bounces={false}
                >
                  <View style={styles.inputContainer}>
                    <Text style={styles.label}>Année *</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Ex: 2026"
                      placeholderTextColor={colors.textMuted}
                      value={yearFormData.year}
                      onChangeText={(text) => {
                        // Nettoyer le texte pour n'accepter que les chiffres
                        const cleanedText = text.replace(/[^0-9]/g, '');
                        setYearFormData(prev => ({ ...prev, year: cleanedText }));
                      }}
                      keyboardType="numeric"
                      selectTextOnFocus={true}
                    />
                    {editingYear && (
                      <Text style={styles.helperText}>
                        Vous pouvez corriger le numéro d'année si nécessaire
                      </Text>
                    )}
                  </View>

                  <View style={styles.inputContainer}>
                    <Text style={styles.label}>Montant mensuel (FCFA) *</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Ex: 5000"
                      placeholderTextColor={colors.textMuted}
                      value={yearFormData.monthlyAmount}
                      onChangeText={(text) => {
                        // Nettoyer le texte pour n'accepter que les chiffres
                        const cleanedText = text.replace(/[^0-9]/g, '');
                        setYearFormData(prev => ({ ...prev, monthlyAmount: cleanedText }));
                      }}
                      keyboardType="numeric"
                      selectTextOnFocus={true}
                    />
                  </View>

                  <TouchableOpacity
                    style={[styles.submitButton, saving && styles.submitButtonDisabled]}
                    onPress={handleSaveYear}
                    disabled={saving}
                  >
                    {saving ? (
                      <ActivityIndicator color={colors.textOnPrimary} />
                    ) : (
                      <Text style={styles.submitButtonText}>
                        {editingYear ? 'Modifier' : 'Créer'}
                      </Text>
                    )}
                  </TouchableOpacity>
                </ScrollView>
              </View>
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </TouchableOpacity>
      </Modal>

      {/* Modal Import */}
      <Modal
        visible={importModalVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setImportModalVisible(false)}
      >
        <View style={styles.fullModalContainer}>
          <View style={styles.fullModalHeader}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => {
                setImportModalVisible(false);
                setImportContent('');
                setImportPreview(null);
              }}
            >
              <ArrowLeft size={24} color={colors.textOnSecondary} />
              <Text style={styles.backButtonText}>Retour</Text>
            </TouchableOpacity>
            <Text style={styles.fullModalTitle}>Importer membres</Text>
            <View style={{ width: 80 }} />
          </View>

          <ScrollView style={styles.fullModalContent}>
            <Text style={styles.importInfo}>
              Format: nom;villa;téléphone (un par ligne)
            </Text>
            <Text style={styles.importExample}>
              Exemple:{'\n'}Jean Dupont;Villa 12;+237 6XX XX XX XX{'\n'}Marie Martin;Villa 7;+237 677 77 77 77
            </Text>

            {/* Bouton pour charger un fichier */}
            <TouchableOpacity
              style={styles.filePickerButton}
              onPress={handlePickFile}
            >
              <FolderOpen size={20} color={colors.primary} />
              <Text style={styles.filePickerText}>Charger un fichier (TXT/CSV)</Text>
            </TouchableOpacity>

            <Text style={styles.orText}>ou coller directement :</Text>

            <TextInput
              style={styles.importTextArea}
              placeholder="Coller le contenu ici..."
              placeholderTextColor={colors.textMuted}
              value={importContent}
              onChangeText={setImportContent}
              multiline
              numberOfLines={10}
              textAlignVertical="top"
            />

            <TouchableOpacity
              style={[styles.previewButton, importing && styles.buttonDisabled]}
              onPress={handlePreviewImport}
              disabled={importing}
            >
              {importing ? (
                <ActivityIndicator color={colors.textOnSecondary} />
              ) : (
                <>
                  <Eye size={20} color={colors.textOnSecondary} />
                  <Text style={styles.previewButtonText}>Prévisualiser</Text>
                </>
              )}
            </TouchableOpacity>

            {importPreview && (
              <View style={styles.previewContainer}>
                <Text style={styles.previewTitle}>Résultat de la prévisualisation</Text>
                <View style={styles.previewStats}>
                  <View style={styles.previewStat}>
                    <Text style={styles.previewStatValue}>{importPreview.valid || 0}</Text>
                    <Text style={styles.previewStatLabel}>Valides</Text>
                  </View>
                  <View style={styles.previewStat}>
                    <Text style={[styles.previewStatValue, { color: colors.warning }]}>
                      {typeof importPreview.duplicates === 'number' ? importPreview.duplicates : (importPreview.duplicates?.length || 0)}
                    </Text>
                    <Text style={styles.previewStatLabel}>Doublons</Text>
                  </View>
                  <View style={styles.previewStat}>
                    <Text style={[styles.previewStatValue, { color: colors.error }]}>
                      {typeof importPreview.errors === 'number' ? importPreview.errors : (importPreview.errors?.length || 0)}
                    </Text>
                    <Text style={styles.previewStatLabel}>Erreurs</Text>
                  </View>
                </View>

                {(importPreview.valid > 0 || (importPreview.preview && importPreview.preview.length > 0)) && (
                  <TouchableOpacity
                    style={[styles.confirmButton, importing && styles.buttonDisabled]}
                    onPress={handleConfirmImport}
                    disabled={importing}
                  >
                    {importing ? (
                      <ActivityIndicator color={colors.textOnSecondary} />
                    ) : (
                      <Text style={styles.confirmButtonText}>Confirmer l'import</Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* Modal Déconnexion */}
      <Modal
        visible={logoutModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setLogoutModalVisible(false)}
      >
        <View style={styles.logoutModalOverlay}>
          <View style={styles.logoutModalContent}>
            <SignOut size={48} color={colors.error} style={{ marginBottom: spacing.lg }} />
            <Text style={styles.logoutModalTitle}>Déconnexion</Text>
            <Text style={styles.logoutModalText}>
              Êtes-vous sûr de vouloir vous déconnecter ?
            </Text>
            <View style={styles.logoutModalButtons}>
              <TouchableOpacity
                style={styles.logoutCancelButton}
                onPress={() => setLogoutModalVisible(false)}
              >
                <Text style={styles.logoutCancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.logoutConfirmButton}
                onPress={confirmLogout}
              >
                <Text style={styles.logoutConfirmText}>Déconnexion</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Suppression de compte */}
      <Modal
        visible={deleteAccountModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setDeleteAccountModalVisible(false)}
      >
        <View style={styles.deleteAccountModalOverlay}>
          <View style={styles.deleteAccountModalContent}>
            <View style={styles.deleteAccountModalHeader}>
              <Warning size={48} color={colors.error} weight="fill" />
              <Text style={styles.deleteAccountModalTitle}>Supprimer mon compte</Text>
            </View>
            
            <View style={styles.deleteAccountModalBody}>
              <Text style={styles.deleteAccountWarningText}>
                Attention : cette action est irréversible.
              </Text>
              <Text style={styles.deleteAccountInfoText}>
                • Votre email, téléphone et mot de passe seront supprimés{'\n'}
                • Vous ne pourrez plus vous connecter{'\n'}
                • L'historique de vos cotisations et paiements sera conservé pour la comptabilité de l'association
              </Text>
              
              <Text style={styles.deleteAccountPasswordLabel}>
                Pour confirmer, entrez votre mot de passe :
              </Text>
              <TextInput
                style={styles.deleteAccountPasswordInput}
                placeholder="Mot de passe"
                placeholderTextColor={colors.textMuted}
                secureTextEntry
                value={deletePassword}
                onChangeText={setDeletePassword}
              />
            </View>

            <View style={styles.deleteAccountModalButtons}>
              <TouchableOpacity
                style={styles.deleteAccountCancelButton}
                onPress={() => {
                  setDeleteAccountModalVisible(false);
                  setDeletePassword('');
                }}
              >
                <Text style={styles.deleteAccountCancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.deleteAccountConfirmButton, deleting && styles.deleteAccountConfirmButtonDisabled]}
                onPress={handleDeleteAccount}
                disabled={deleting}
              >
                {deleting ? (
                  <ActivityIndicator color={colors.textOnSecondary} size="small" />
                ) : (
                  <Text style={styles.deleteAccountConfirmText}>Supprimer</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
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
  content: {
    padding: spacing.lg,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.md,
  },
  card: {
    backgroundColor: colors.backgroundWhite,
    borderRadius: borderRadius.card,
    padding: spacing.lg,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  profileInfo: {
    marginLeft: spacing.md,
    flex: 1,
  },
  profileLabel: {
    fontSize: typography.caption.fontSize,
    color: colors.textMuted,
  },
  profileValue: {
    fontSize: typography.body.fontSize,
    color: colors.text,
    fontWeight: '500',
    marginTop: 2,
  },
  configRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  configLabel: {
    fontSize: typography.body.fontSize,
    color: colors.textMuted,
  },
  configValue: {
    fontSize: typography.body.fontSize,
    fontWeight: '600',
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
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  button: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.button,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: colors.background,
  },
  cancelButtonText: {
    color: colors.textMuted,
    fontSize: typography.body.fontSize,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: colors.primary,
  },
  saveButtonText: {
    color: colors.textOnPrimary,
    fontSize: typography.body.fontSize,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  yearItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  yearInfo: {
    flex: 1,
  },
  yearText: {
    fontSize: typography.body.fontSize,
    fontWeight: '600',
    color: colors.text,
  },
  yearAmount: {
    fontSize: typography.body.fontSize,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  yearActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.successBg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.badge,
    gap: spacing.xs,
  },
  activeBadgeText: {
    fontSize: typography.caption.fontSize,
    fontWeight: '600',
    color: colors.success,
  },
  activateButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.badge,
  },
  activateButtonText: {
    fontSize: typography.caption.fontSize,
    fontWeight: '600',
    color: colors.textOnPrimary,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.button,
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  addButtonText: {
    color: colors.textOnPrimary,
    fontSize: typography.body.fontSize,
    fontWeight: '600',
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    gap: spacing.md,
  },
  optionText: {
    flex: 1,
    fontSize: typography.body.fontSize,
    color: colors.text,
    fontWeight: '500',
  },
  logoutButton: {
    flexDirection: 'row',
    backgroundColor: colors.error,
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutButtonText: {
    color: colors.textOnSecondary,
    fontSize: typography.body.fontSize,
    fontWeight: '600',
    marginLeft: spacing.sm,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  footerText: {
    fontSize: typography.caption.fontSize,
    color: colors.textMuted,
    marginTop: spacing.xs,
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
    maxHeight: '70%',
  },
  yearModalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  yearModalKeyboardView: {
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  yearModalContent: {
    backgroundColor: colors.backgroundWhite,
    borderRadius: borderRadius.card,
    padding: spacing.xl,
    width: '90%',
    maxWidth: 400,
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
  submitButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.button,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  submitButtonText: {
    color: colors.textOnPrimary,
    fontSize: typography.button.fontSize,
    fontWeight: typography.button.fontWeight,
  },
  fullModalContainer: {
    flex: 1,
    backgroundColor: colors.backgroundWhite,
  },
  fullModalHeader: {
    backgroundColor: colors.secondary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    paddingTop: 48,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    gap: spacing.xs,
  },
  backButtonText: {
    color: colors.textOnSecondary,
    fontSize: typography.body.fontSize,
    fontWeight: '500',
  },
  fullModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textOnSecondary,
  },
  fullModalContent: {
    flex: 1,
    padding: spacing.lg,
  },
  importInfo: {
    fontSize: typography.body.fontSize,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  importExample: {
    fontSize: typography.caption.fontSize,
    color: colors.textMuted,
    backgroundColor: colors.background,
    padding: spacing.md,
    borderRadius: borderRadius.input,
    marginBottom: spacing.lg,
  },
  filePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.warningBg,
    paddingVertical: spacing.lg,
    paddingHorizontal: 20,
    borderRadius: borderRadius.button,
    borderWidth: 2,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    gap: 10,
    marginBottom: spacing.md,
  },
  filePickerText: {
    color: colors.primary,
    fontSize: typography.body.fontSize,
    fontWeight: '600',
  },
  orText: {
    textAlign: 'center',
    color: colors.textMuted,
    fontSize: typography.body.fontSize,
    marginBottom: spacing.md,
  },
  importTextArea: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.input,
    padding: spacing.md,
    fontSize: typography.body.fontSize,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 200,
    marginBottom: spacing.lg,
    color: colors.text,
  },
  previewButton: {
    flexDirection: 'row',
    backgroundColor: colors.secondary,
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.button,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  previewButtonText: {
    color: colors.textOnSecondary,
    fontSize: typography.body.fontSize,
    fontWeight: '600',
  },
  previewContainer: {
    marginTop: spacing.xl,
    backgroundColor: colors.background,
    borderRadius: borderRadius.card,
    padding: spacing.lg,
  },
  previewTitle: {
    fontSize: typography.h3.fontSize,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.lg,
  },
  previewStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: spacing.lg,
  },
  previewStat: {
    alignItems: 'center',
  },
  previewStatValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.success,
  },
  previewStatLabel: {
    fontSize: typography.caption.fontSize,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  confirmButton: {
    backgroundColor: colors.success,
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.button,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: colors.textOnSecondary,
    fontSize: typography.body.fontSize,
    fontWeight: '600',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  logoutModalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  logoutModalContent: {
    backgroundColor: colors.backgroundWhite,
    borderRadius: borderRadius.card,
    padding: spacing.xl,
    width: '85%',
    maxWidth: 340,
    alignItems: 'center',
  },
  logoutModalTitle: {
    fontSize: typography.h2.fontSize,
    fontWeight: typography.h2.fontWeight,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  logoutModalText: {
    fontSize: typography.body.fontSize,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  logoutModalButtons: {
    flexDirection: 'row',
    gap: spacing.md,
    width: '100%',
  },
  logoutCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: borderRadius.button,
    backgroundColor: colors.background,
    alignItems: 'center',
  },
  logoutCancelText: {
    fontSize: typography.body.fontSize,
    fontWeight: '600',
    color: colors.textMuted,
  },
  logoutConfirmButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: borderRadius.button,
    backgroundColor: colors.error,
    alignItems: 'center',
  },
  logoutConfirmText: {
    fontSize: typography.body.fontSize,
    fontWeight: '600',
    color: colors.textOnSecondary,
  },
  helperText: {
    fontSize: typography.caption.fontSize,
    color: colors.textMuted,
    marginTop: spacing.xs,
    fontStyle: 'italic',
  },
  // Styles suppression de compte
  deleteAccountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: colors.error,
    borderRadius: borderRadius.card,
    gap: spacing.sm,
  },
  deleteAccountButtonText: {
    color: colors.textOnSecondary,
    fontSize: typography.body.fontSize,
    fontWeight: '600',
  },
  deleteAccountModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  deleteAccountModalContent: {
    backgroundColor: colors.backgroundWhite,
    borderRadius: borderRadius.card,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 400,
  },
  deleteAccountModalHeader: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  deleteAccountModalTitle: {
    fontSize: typography.h2.fontSize,
    fontWeight: '700',
    color: colors.error,
    marginTop: spacing.md,
  },
  deleteAccountModalBody: {
    marginBottom: spacing.xl,
  },
  deleteAccountWarningText: {
    fontSize: typography.body.fontSize,
    fontWeight: '600',
    color: colors.error,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  deleteAccountInfoText: {
    fontSize: typography.body.fontSize,
    color: colors.textMuted,
    lineHeight: 22,
    marginBottom: 20,
  },
  deleteAccountPasswordLabel: {
    fontSize: typography.body.fontSize,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  deleteAccountPasswordInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.input,
    padding: spacing.md,
    fontSize: typography.body.fontSize,
    color: colors.text,
  },
  deleteAccountModalButtons: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  deleteAccountCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: borderRadius.button,
    backgroundColor: colors.background,
    alignItems: 'center',
  },
  deleteAccountCancelText: {
    fontSize: typography.body.fontSize,
    fontWeight: '600',
    color: colors.textMuted,
  },
  deleteAccountConfirmButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: borderRadius.button,
    backgroundColor: colors.error,
    alignItems: 'center',
  },
  deleteAccountConfirmButtonDisabled: {
    opacity: 0.7,
  },
  deleteAccountConfirmText: {
    fontSize: typography.body.fontSize,
    fontWeight: '600',
    color: colors.textOnSecondary,
  },
});

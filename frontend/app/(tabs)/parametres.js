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
import { Ionicons } from '@expo/vector-icons';
import api from '../../utils/api';
import { useRouter } from 'expo-router';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

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

  const handleSaveConfig = async () => {
    if (!formData.name || !formData.memberFieldLabel) {
      Alert.alert('Erreur', 'Nom et libellé du champ requis');
      return;
    }

    setSaving(true);
    try {
      await api.post('/config', formData);
      Alert.alert('Succès', 'Configuration enregistrée');
      setEditing(false);
      loadConfig();
    } catch (error) {
      console.error('Erreur sauvegarde config:', error);
      Alert.alert('Erreur', 'Erreur lors de la sauvegarde');
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
        await api.put(`/years/${editingYear.id}`, {
          monthlyAmount: parseFloat(yearFormData.monthlyAmount)
        });
        Alert.alert('Succès', 'Montant modifié');
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
      if (Platform.OS === 'web') {
        const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'membres.csv';
        link.click();
        Alert.alert('Succès', 'Fichier téléchargé');
      } else {
        const filename = FileSystem.documentDirectory + 'membres.csv';
        await FileSystem.writeAsStringAsync(filename, response.data);
        
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(filename);
        } else {
          Alert.alert('Succès', 'Fichier enregistré: ' + filename);
        }
      }
    } catch (error) {
      console.error('Erreur export:', error);
      Alert.alert('Erreur', 'Impossible d\'exporter les membres');
    }
  };

  // Export Stats CSV
  const handleExportStats = async () => {
    try {
      const activeYear = years.find(y => y.active);
      if (!activeYear) {
        Alert.alert('Erreur', 'Aucune année active');
        return;
      }

      const response = await api.get(`/export/statistics/${activeYear.id}`, {
        responseType: 'text'
      });
      
      // Sur le web, on télécharge directement
      if (Platform.OS === 'web') {
        const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `statistiques_${activeYear.year}.csv`;
        link.click();
        Alert.alert('Succès', 'Fichier téléchargé');
      } else {
        const filename = FileSystem.documentDirectory + `statistiques_${activeYear.year}.csv`;
        await FileSystem.writeAsStringAsync(filename, response.data);
        
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(filename);
        } else {
          Alert.alert('Succès', 'Fichier enregistré: ' + filename);
        }
      }
    } catch (error) {
      console.error('Erreur export stats:', error);
      Alert.alert('Erreur', 'Impossible d\'exporter les statistiques');
    }
  };

  // Export Stats PDF
  const handleExportStatsPDF = async () => {
    try {
      const activeYear = years.find(y => y.active);
      if (!activeYear) {
        Alert.alert('Erreur', 'Aucune année active');
        return;
      }

      // Récupérer les données de paiement
      const response = await api.get(`/payments/year/${activeYear.id}`);
      const members = response.data.members;

      // Générer le contenu HTML pour le PDF
      let html = `
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; padding: 20px; }
              h1 { color: #2196F3; text-align: center; }
              h2 { color: #666; text-align: center; margin-bottom: 20px; }
              table { width: 100%; border-collapse: collapse; margin-top: 20px; }
              th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
              th { background-color: #2196F3; color: white; }
              tr:nth-child(even) { background-color: #f2f2f2; }
              .paid { color: #4CAF50; font-weight: bold; }
              .partial { color: #FF9800; font-weight: bold; }
              .unpaid { color: #F44336; font-weight: bold; }
              .total { font-weight: bold; background-color: #E3F2FD; }
            </style>
          </head>
          <body>
            <h1>${config?.name || 'Association'}</h1>
            <h2>Statistiques des cotisations - Année ${activeYear.year}</h2>
            <p><strong>Montant mensuel:</strong> ${activeYear.monthlyAmount} FCFA</p>
            <table>
              <tr>
                <th>Membre</th>
                <th>Identifiant</th>
                <th>Dû (FCFA)</th>
                <th>Payé (FCFA)</th>
                <th>Reste (FCFA)</th>
                <th>%</th>
              </tr>
      `;

      let totalDue = 0;
      let totalPaid = 0;

      members.forEach(member => {
        const due = activeYear.monthlyAmount * 12;
        const paid = member.totalPaid;
        const remaining = due - paid;
        const percentage = Math.round((paid / due) * 100);
        
        totalDue += due;
        totalPaid += paid;

        const statusClass = percentage >= 100 ? 'paid' : percentage > 0 ? 'partial' : 'unpaid';
        
        html += `
          <tr>
            <td>${member.name}</td>
            <td>${member.customFieldValue}</td>
            <td>${due}</td>
            <td class="${statusClass}">${Math.round(paid)}</td>
            <td>${Math.round(remaining)}</td>
            <td class="${statusClass}">${percentage}%</td>
          </tr>
        `;
      });

      // Ligne total
      const totalPercentage = totalDue > 0 ? Math.round((totalPaid / totalDue) * 100) : 0;
      html += `
          <tr class="total">
            <td colspan="2">TOTAL</td>
            <td>${totalDue}</td>
            <td>${Math.round(totalPaid)}</td>
            <td>${Math.round(totalDue - totalPaid)}</td>
            <td>${totalPercentage}%</td>
          </tr>
        </table>
        <p style="margin-top: 20px; text-align: center; color: #666;">
          Généré le ${new Date().toLocaleDateString('fr-FR')}
        </p>
      </body>
      </html>
      `;

      // Sur le web, ouvrir dans une nouvelle fenêtre pour impression
      if (Platform.OS === 'web') {
        const printWindow = window.open('', '_blank');
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.print();
        Alert.alert('Succès', 'Document PDF ouvert pour impression');
      } else {
        // Sur mobile, utiliser expo-print si disponible
        Alert.alert('Info', 'Export PDF disponible sur l\'application mobile uniquement via impression');
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
        <ActivityIndicator size="large" color="#2196F3" />
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
              <Ionicons name="person" size={20} color="#666" />
              <View style={styles.profileInfo}>
                <Text style={styles.profileLabel}>Rôle</Text>
                <Text style={styles.profileValue}>
                  {user?.role === 'ADMIN' ? 'Administrateur' : 'Membre'}
                </Text>
              </View>
            </View>

            <View style={styles.profileRow}>
              <Ionicons name="mail" size={20} color="#666" />
              <View style={styles.profileInfo}>
                <Text style={styles.profileLabel}>Email</Text>
                <Text style={styles.profileValue}>{user?.email}</Text>
              </View>
            </View>

            {user?.phone && (
              <View style={styles.profileRow}>
                <Ionicons name="call" size={20} color="#666" />
                <View style={styles.profileInfo}>
                  <Text style={styles.profileLabel}>Téléphone</Text>
                  <Text style={styles.profileValue}>{user.phone}</Text>
                </View>
              </View>
            )}

            {user?.member && (
              <View style={styles.profileRow}>
                <Ionicons name="person-circle" size={20} color="#666" />
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
                  <Ionicons name="pencil" size={20} color="#2196F3" />
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
                    value={formData.name}
                    onChangeText={(text) => setFormData({ ...formData, name: text })}
                  />
                </View>

                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Type d'association</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Ex: Syndic, Tontine, ONG..."
                    value={formData.type}
                    onChangeText={(text) => setFormData({ ...formData, type: text })}
                  />
                </View>

                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Libellé du champ membre *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Ex: Villa, Groupe, Section..."
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
                      <ActivityIndicator color="#fff" size="small" />
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
                    <Text style={styles.yearAmount}>{year.monthlyAmount} FCFA/mois</Text>
                  </View>
                  <View style={styles.yearActions}>
                    {year.active ? (
                      <View style={styles.activeBadge}>
                        <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
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
                      <Ionicons name="pencil" size={20} color="#2196F3" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
              
              <TouchableOpacity style={styles.addButton} onPress={handleAddYear}>
                <Ionicons name="add" size={20} color="#fff" />
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
                <Ionicons name="cloud-upload" size={24} color="#2196F3" />
                <Text style={styles.optionText}>Importer membres (TXT/CSV)</Text>
                <Ionicons name="chevron-forward" size={20} color="#999" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.optionButton}
                onPress={handleExportMembers}
              >
                <Ionicons name="download" size={24} color="#4CAF50" />
                <Text style={styles.optionText}>Exporter membres (CSV)</Text>
                <Ionicons name="chevron-forward" size={20} color="#999" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.optionButton}
                onPress={handleExportStats}
              >
                <Ionicons name="document" size={24} color="#FF9800" />
                <Text style={styles.optionText}>Exporter statistiques (CSV)</Text>
                <Ionicons name="chevron-forward" size={20} color="#999" />
              </TouchableOpacity>

              <TouchableOpacity style={styles.option} onPress={handleExportStatsPDF}>
                <Ionicons name="document-text" size={24} color="#F44336" />
                <Text style={styles.optionText}>Exporter statistiques (PDF)</Text>
                <Ionicons name="chevron-forward" size={20} color="#999" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Déconnexion */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Actions</Text>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Ionicons name="log-out" size={20} color="#fff" />
            <Text style={styles.logoutButtonText}>Déconnexion</Text>
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
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingYear ? 'Modifier montant' : 'Nouvelle année'}
              </Text>
              <TouchableOpacity onPress={() => setYearModalVisible(false)}>
                <Ionicons name="close" size={28} color="#333" />
              </TouchableOpacity>
            </View>

            {!editingYear && (
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Année *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ex: 2026"
                  value={yearFormData.year}
                  onChangeText={(text) => setYearFormData({ ...yearFormData, year: text })}
                  keyboardType="numeric"
                />
              </View>
            )}

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Montant mensuel (FCFA) *</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: 5000"
                value={yearFormData.monthlyAmount}
                onChangeText={(text) => setYearFormData({ ...yearFormData, monthlyAmount: text })}
                keyboardType="numeric"
              />
            </View>

            <TouchableOpacity
              style={[styles.submitButton, saving && styles.submitButtonDisabled]}
              onPress={handleSaveYear}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>
                  {editingYear ? 'Modifier' : 'Créer'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
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
            <TouchableOpacity onPress={() => setImportModalVisible(false)}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.fullModalTitle}>Importer membres</Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView style={styles.fullModalContent}>
            <Text style={styles.importInfo}>
              Format: nom;villa;téléphone (un par ligne)
            </Text>
            <Text style={styles.importExample}>
              Exemple:{'\n'}Jean Dupont;Villa 12;+237 6XX XX XX XX{'\n'}Marie Martin;Villa 7;+237 677 77 77 77
            </Text>

            <TextInput
              style={styles.importTextArea}
              placeholder="Coller le contenu ici..."
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
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="eye" size={20} color="#fff" />
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
                    <Text style={[styles.previewStatValue, { color: '#FF9800' }]}>
                      {typeof importPreview.duplicates === 'number' ? importPreview.duplicates : (importPreview.duplicates?.length || 0)}
                    </Text>
                    <Text style={styles.previewStatLabel}>Doublons</Text>
                  </View>
                  <View style={styles.previewStat}>
                    <Text style={[styles.previewStatValue, { color: '#F44336' }]}>
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
                      <ActivityIndicator color="#fff" />
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
            <Ionicons name="log-out" size={48} color="#F44336" style={{ marginBottom: 16 }} />
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
    </KeyboardAvoidingView>
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
  content: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  profileInfo: {
    marginLeft: 12,
    flex: 1,
  },
  profileLabel: {
    fontSize: 12,
    color: '#999',
  },
  profileValue: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
    marginTop: 2,
  },
  configRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  configLabel: {
    fontSize: 14,
    color: '#666',
  },
  configValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#2196F3',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  yearItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  yearInfo: {
    flex: 1,
  },
  yearText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  yearAmount: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  yearActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  activeBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4CAF50',
  },
  activateButton: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  activateButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2196F3',
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 12,
    gap: 8,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    gap: 12,
  },
  optionText: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  logoutButton: {
    flexDirection: 'row',
    backgroundColor: '#F44336',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  footerText: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  submitButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  fullModalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  fullModalHeader: {
    backgroundColor: '#2196F3',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingTop: 48,
  },
  fullModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  fullModalContent: {
    flex: 1,
    padding: 16,
  },
  importInfo: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  importExample: {
    fontSize: 12,
    color: '#999',
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  importTextArea: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    minHeight: 200,
    marginBottom: 16,
  },
  previewButton: {
    flexDirection: 'row',
    backgroundColor: '#2196F3',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  previewButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  previewContainer: {
    marginTop: 24,
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 16,
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  previewStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  previewStat: {
    alignItems: 'center',
  },
  previewStatValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  previewStatLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  confirmButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
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
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '85%',
    maxWidth: 340,
    alignItems: 'center',
  },
  logoutModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  logoutModalText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  logoutModalButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  logoutCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
  },
  logoutCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  logoutConfirmButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#F44336',
    alignItems: 'center',
  },
  logoutConfirmText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});

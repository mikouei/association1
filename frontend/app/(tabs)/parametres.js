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
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import api from '../../utils/api';
import { useRouter } from 'expo-router';

export default function Parametres() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const isAdmin = user?.role === 'ADMIN';

  const [config, setConfig] = useState(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    type: '',
    memberFieldLabel: '',
  });

  useEffect(() => {
    loadConfig();
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

  const handleLogout = async () => {
    Alert.alert(
      'Déconnexion',
      'Êtes-vous sûr de vouloir vous déconnecter ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Déconnexion',
          style: 'destructive',
          onPress: async () => {
            try {
              await logout();
              // Petite pause pour s'assurer que le logout est terminé
              setTimeout(() => {
                router.replace('/login');
              }, 100);
            } catch (error) {
              console.error('Erreur déconnexion:', error);
              // Rediriger quand même
              router.replace('/login');
            }
          },
        },
      ]
    );
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

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Actions</Text>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Ionicons name="log-out" size={20} color="#fff" />
            <Text style={styles.logoutButtonText}>Déconnexion</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>AssocManager v1.0.0</Text>
          <Text style={styles.footerText}>Phase 1 - Authentification & Membres</Text>
        </View>
      </ScrollView>
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
});

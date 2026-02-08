import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Modal,
  FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import api from '../utils/api';

export default function Login() {
  const [mode, setMode] = useState('password'); // 'password' ou 'token'
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  // Association selection
  const [associations, setAssociations] = useState([]);
  const [selectedAssociation, setSelectedAssociation] = useState(null);
  const [showAssociationPicker, setShowAssociationPicker] = useState(false);
  const [loadingAssociations, setLoadingAssociations] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  const { login } = useAuth();
  const router = useRouter();

  // Charger la liste des associations au démarrage
  useEffect(() => {
    loadAssociations();
  }, []);

  const loadAssociations = async () => {
    try {
      const response = await api.get('/auth/associations');
      setAssociations(response.data);
    } catch (error) {
      console.error('Erreur chargement associations:', error);
      // En cas d'erreur, permettre quand même le login V1 classique
    } finally {
      setLoadingAssociations(false);
    }
  };

  const filteredAssociations = associations.filter(assoc => 
    assoc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    assoc.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleLogin = async () => {
    if (!selectedAssociation) {
      Alert.alert('Erreur', 'Veuillez sélectionner une association');
      return;
    }

    if (mode === 'password' && (!phone || !password)) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs');
      return;
    }

    if (mode === 'token' && !accessToken) {
      Alert.alert('Erreur', 'Veuillez entrer votre token d\'accès');
      return;
    }

    setLoading(true);
    const result = await login(
      mode === 'password' ? phone : null,
      mode === 'password' ? password : null,
      mode === 'token' ? accessToken : null,
      selectedAssociation.code
    );
    setLoading(false);

    if (result.success) {
      router.replace('/(tabs)');
    } else {
      Alert.alert('Erreur', result.error);
    }
  };

  const renderAssociationItem = ({ item }) => (
    <TouchableOpacity
      style={styles.associationItem}
      onPress={() => {
        setSelectedAssociation(item);
        setShowAssociationPicker(false);
        setSearchQuery('');
      }}
    >
      <View style={styles.associationItemContent}>
        <View style={[styles.associationIcon, { backgroundColor: getAssociationColor(item.type) }]}>
          <Ionicons name={getAssociationIcon(item.type)} size={20} color="#fff" />
        </View>
        <View style={styles.associationInfo}>
          <Text style={styles.associationName}>{item.name}</Text>
          <Text style={styles.associationCode}>{item.code}</Text>
        </View>
      </View>
      {selectedAssociation?.id === item.id && (
        <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
      )}
    </TouchableOpacity>
  );

  const getAssociationColor = (type) => {
    switch (type) {
      case 'syndicat': return '#FF9800';
      case 'amicale': return '#9C27B0';
      default: return '#2196F3';
    }
  };

  const getAssociationIcon = (type) => {
    switch (type) {
      case 'syndicat': return 'business';
      case 'amicale': return 'people';
      default: return 'home';
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Ionicons name="people-circle" size={80} color="#2196F3" />
          <Text style={styles.title}>AssocManager</Text>
          <Text style={styles.subtitle}>Gestion de cotisations</Text>
        </View>

        {/* Sélection d'association */}
        <TouchableOpacity
          style={styles.associationSelector}
          onPress={() => setShowAssociationPicker(true)}
          disabled={loadingAssociations}
        >
          {loadingAssociations ? (
            <ActivityIndicator size="small" color="#2196F3" />
          ) : selectedAssociation ? (
            <View style={styles.selectedAssociation}>
              <View style={[styles.associationIcon, { backgroundColor: getAssociationColor(selectedAssociation.type) }]}>
                <Ionicons name={getAssociationIcon(selectedAssociation.type)} size={20} color="#fff" />
              </View>
              <View style={styles.selectedAssociationText}>
                <Text style={styles.selectedAssociationName}>{selectedAssociation.name}</Text>
                <Text style={styles.selectedAssociationCode}>{selectedAssociation.code}</Text>
              </View>
              <Ionicons name="chevron-down" size={24} color="#666" />
            </View>
          ) : (
            <View style={styles.placeholderContainer}>
              <Ionicons name="business" size={20} color="#999" />
              <Text style={styles.placeholderText}>Sélectionner une association</Text>
              <Ionicons name="chevron-down" size={24} color="#666" />
            </View>
          )}
        </TouchableOpacity>

        {/* Tabs pour le mode de connexion */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, mode === 'password' && styles.activeTab]}
            onPress={() => setMode('password')}
          >
            <Text style={[styles.tabText, mode === 'password' && styles.activeTabText]}>
              Téléphone
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, mode === 'token' && styles.activeTab]}
            onPress={() => setMode('token')}
          >
            <Text style={[styles.tabText, mode === 'token' && styles.activeTabText]}>
              Token d'accès
            </Text>
          </TouchableOpacity>
        </View>

        {mode === 'password' ? (
          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Ionicons name="call" size={20} color="#666" style={styles.icon} />
              <TextInput
                style={styles.input}
                placeholder="Téléphone ou email"
                value={phone}
                onChangeText={setPhone}
                keyboardType="default"
                autoCapitalize="none"
                autoCorrect={false}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed" size={20} color="#666" style={styles.icon} />
              <TextInput
                style={styles.input}
                placeholder="Mot de passe"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Ionicons 
                  name={showPassword ? "eye-off" : "eye"} 
                  size={20} 
                  color="#666" 
                />
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Ionicons name="key" size={20} color="#666" style={styles.icon} />
              <TextInput
                style={styles.input}
                placeholder="Entrez votre token d'accès"
                value={accessToken}
                onChangeText={setAccessToken}
                autoCapitalize="none"
              />
            </View>
          </View>
        )}

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Connexion</Text>
          )}
        </TouchableOpacity>

        {/* Lien vers Platform Admin */}
        <TouchableOpacity
          style={styles.platformLink}
          onPress={() => router.push('/platform')}
        >
          <Ionicons name="shield" size={16} color="#9C27B0" />
          <Text style={styles.platformLinkText}>Accès Platform Admin</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Modal de sélection d'association */}
      <Modal
        visible={showAssociationPicker}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAssociationPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Choisir une association</Text>
              <TouchableOpacity onPress={() => setShowAssociationPicker(false)}>
                <Ionicons name="close" size={28} color="#333" />
              </TouchableOpacity>
            </View>

            <View style={styles.searchContainer}>
              <Ionicons name="search" size={20} color="#999" />
              <TextInput
                style={styles.searchInput}
                placeholder="Rechercher..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {searchQuery ? (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={20} color="#999" />
                </TouchableOpacity>
              ) : null}
            </View>

            <FlatList
              data={filteredAssociations}
              renderItem={renderAssociationItem}
              keyExtractor={(item) => item.id}
              style={styles.associationList}
              ListEmptyComponent={() => (
                <View style={styles.emptyContainer}>
                  <Ionicons name="business-outline" size={48} color="#ccc" />
                  <Text style={styles.emptyText}>
                    {searchQuery ? 'Aucune association trouvée' : 'Aucune association disponible'}
                  </Text>
                </View>
              )}
            />
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
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 8,
  },
  associationSelector: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#2196F3',
    minHeight: 60,
    justifyContent: 'center',
  },
  selectedAssociation: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  associationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedAssociationText: {
    flex: 1,
    marginLeft: 12,
  },
  selectedAssociationName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  selectedAssociationCode: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  placeholderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  placeholderText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: '#999',
  },
  tabContainer: {
    flexDirection: 'row',
    marginBottom: 24,
    backgroundColor: '#e0e0e0',
    borderRadius: 8,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 6,
  },
  activeTab: {
    backgroundColor: '#fff',
  },
  tabText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#2196F3',
    fontWeight: '600',
  },
  form: {
    marginBottom: 24,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  icon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 16,
    color: '#333',
  },
  button: {
    backgroundColor: '#2196F3',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  platformLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    gap: 8,
  },
  platformLinkText: {
    color: '#9C27B0',
    fontSize: 14,
  },
  // Captcha styles
  captchaContainer: {
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  captchaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  captchaTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2E7D32',
  },
  captchaQuestion: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  captchaQuestionText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  refreshBtn: {
    padding: 8,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    fontSize: 16,
  },
  associationList: {
    paddingHorizontal: 16,
  },
  associationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  associationItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  associationInfo: {
    marginLeft: 12,
  },
  associationName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  associationCode: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    marginTop: 12,
  },
});

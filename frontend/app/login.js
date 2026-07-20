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
  Linking,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { 
  UsersThree, 
  Phone, 
  Lock, 
  Eye, 
  EyeSlash, 
  Key, 
  Buildings, 
  CaretDown,
  MagnifyingGlass,
  XCircle,
  CheckCircle,
  House,
  Users,
  Shield,
  X,
  Plus,
  WhatsappLogo,
} from 'phosphor-react-native';
import api from '../utils/api';
import { colors, spacing, borderRadius, typography } from '../utils/theme';
import { useLocalSearchParams } from 'expo-router';

const LAST_ASSOCIATION_KEY = '@kotiz_last_association';
const PRESELECTED_ASSOC_KEY = '@kotiz_preselected_association';

export default function Login() {
  const { code: preselectedCode } = useLocalSearchParams();
  
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
  const [lastUsedAssociationId, setLastUsedAssociationId] = useState(null);
  const [isPreselected, setIsPreselected] = useState(false);
  
  const { login } = useAuth();
  const router = useRouter();

  // Charger la liste des associations au démarrage
  useEffect(() => {
    loadAssociations();
  }, []);

  const loadAssociations = async () => {
    try {
      // Récupérer la dernière association utilisée
      const lastAssocId = await AsyncStorage.getItem(LAST_ASSOCIATION_KEY);
      if (lastAssocId) {
        setLastUsedAssociationId(lastAssocId);
      }

      const response = await api.get('/auth/associations');
      let assocList = response.data;

      // Priorité 1: Si un code est passé en paramètre (deep link)
      if (preselectedCode) {
        const matchingAssoc = assocList.find(
          a => a.code.toUpperCase() === preselectedCode.toString().toUpperCase() && a.active !== false
        );
        if (matchingAssoc) {
          setSelectedAssociation(matchingAssoc);
          setIsPreselected(true);
          setAssociations(assocList);
          setLoadingAssociations(false);
          return;
        }
      }

      // Priorité 2: Vérifier si un code a été stocké via le referrer d'installation
      const referrerCode = await AsyncStorage.getItem(PRESELECTED_ASSOC_KEY);
      if (referrerCode) {
        // Supprimer le code après utilisation
        await AsyncStorage.removeItem(PRESELECTED_ASSOC_KEY);
        
        const matchingAssoc = assocList.find(
          a => a.code.toUpperCase() === referrerCode.toUpperCase() && a.active !== false
        );
        if (matchingAssoc) {
          setSelectedAssociation(matchingAssoc);
          setIsPreselected(true);
          setAssociations(assocList);
          setLoadingAssociations(false);
          return;
        }
      }

      // Si une seule association, la sélectionner automatiquement
      if (assocList.length === 1) {
        setSelectedAssociation(assocList[0]);
        setAssociations(assocList);
        setLoadingAssociations(false);
        return;
      }

      // Trier par dernière utilisée en premier
      if (lastAssocId) {
        assocList = assocList.sort((a, b) => {
          if (a.id === lastAssocId) return -1;
          if (b.id === lastAssocId) return 1;
          return a.name.localeCompare(b.name);
        });
      }

      setAssociations(assocList);
    } catch (error) {
      console.error('Erreur chargement associations:', error);
      // En cas d'erreur, permettre quand même le login V1 classique
    } finally {
      setLoadingAssociations(false);
    }
  };

  // Filtrer par nom ET code (recherche en direct)
  const filteredAssociations = associations.filter(assoc => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    return (
      assoc.name.toLowerCase().includes(query) ||
      assoc.code.toLowerCase().includes(query)
    );
  });

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
      // Sauvegarder la dernière association utilisée
      try {
        await AsyncStorage.setItem(LAST_ASSOCIATION_KEY, selectedAssociation.id);
      } catch (e) {
        console.warn('Could not save last association:', e);
      }
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
          {item.type === 'syndicat' ? (
            <Buildings size={20} color={colors.textOnSecondary} weight="fill" />
          ) : item.type === 'amicale' ? (
            <Users size={20} color={colors.textOnSecondary} weight="fill" />
          ) : (
            <House size={20} color={colors.textOnSecondary} weight="fill" />
          )}
        </View>
        <View style={styles.associationInfo}>
          <Text style={styles.associationName}>{item.name}</Text>
          <Text style={styles.associationCode}>{item.code}</Text>
        </View>
      </View>
      {selectedAssociation?.id === item.id && (
        <CheckCircle size={24} color={colors.success} weight="fill" />
      )}
    </TouchableOpacity>
  );

  const getAssociationColor = (type) => {
    switch (type) {
      case 'syndicat': return colors.warning;
      case 'amicale': return colors.accentTerracotta;
      default: return colors.primary;
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <UsersThree size={80} color={colors.primary} weight="fill" />
          <Text style={styles.title}>Kotiz</Text>
          <Text style={styles.subtitle}>Gestion de cotisations</Text>
        </View>

        {/* Sélection d'association */}
        <TouchableOpacity
          style={styles.associationSelector}
          onPress={() => {
            if (!isPreselected) {
              setShowAssociationPicker(true);
            }
          }}
          disabled={loadingAssociations}
        >
          {loadingAssociations ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : selectedAssociation ? (
            <View style={styles.selectedAssociation}>
              <View style={[styles.associationIcon, { backgroundColor: getAssociationColor(selectedAssociation.type) }]}>
                {selectedAssociation.type === 'syndicat' ? (
                  <Buildings size={20} color={colors.textOnSecondary} weight="fill" />
                ) : selectedAssociation.type === 'amicale' ? (
                  <Users size={20} color={colors.textOnSecondary} weight="fill" />
                ) : (
                  <House size={20} color={colors.textOnSecondary} weight="fill" />
                )}
              </View>
              <View style={styles.selectedAssociationText}>
                <Text style={styles.selectedAssociationName}>{selectedAssociation.name}</Text>
                <Text style={styles.selectedAssociationCode}>{selectedAssociation.code}</Text>
              </View>
              <CaretDown size={24} color={colors.textMuted} />
            </View>
          ) : (
            <View style={styles.placeholderContainer}>
              <Buildings size={20} color={colors.textMuted} />
              <Text style={styles.placeholderText}>Sélectionner une association</Text>
              <CaretDown size={24} color={colors.textMuted} />
            </View>
          )}
        </TouchableOpacity>

        {/* Lien pour changer d'association si présélectionnée */}
        {isPreselected && (
          <TouchableOpacity 
            style={styles.changeAssocLink}
            onPress={() => {
              setIsPreselected(false);
              setShowAssociationPicker(true);
            }}
          >
            <Text style={styles.changeAssocText}>Pas votre association ? Changer</Text>
          </TouchableOpacity>
        )}

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
              <Phone size={20} color={colors.textMuted} style={styles.icon} />
              <TextInput
                style={styles.input}
                placeholder="Téléphone ou email"
                placeholderTextColor={colors.textMuted}
                value={phone}
                onChangeText={setPhone}
                keyboardType="default"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.inputContainer}>
              <Lock size={20} color={colors.textMuted} style={styles.icon} />
              <TextInput
                style={styles.input}
                placeholder="Mot de passe"
                placeholderTextColor={colors.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                {showPassword ? (
                  <EyeSlash size={20} color={colors.textMuted} />
                ) : (
                  <Eye size={20} color={colors.textMuted} />
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Key size={20} color={colors.textMuted} style={styles.icon} />
              <TextInput
                style={styles.input}
                placeholder="Entrez votre token d'accès"
                placeholderTextColor={colors.textMuted}
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
            <ActivityIndicator color={colors.textOnPrimary} />
          ) : (
            <Text style={styles.buttonText}>Connexion</Text>
          )}
        </TouchableOpacity>

        {/* Lien pour créer une association */}
        <TouchableOpacity
          style={styles.createAssocLink}
          onPress={() => router.push('/register-association')}
        >
          <Plus size={16} color={colors.primary} weight="bold" />
          <Text style={styles.createAssocLinkText}>Créer mon association</Text>
        </TouchableOpacity>

        {/* Lien vers Platform Admin */}
        <TouchableOpacity
          style={styles.platformLink}
          onPress={() => router.push('/platform')}
        >
          <Shield size={16} color={colors.accentTerracotta} weight="fill" />
          <Text style={styles.platformLinkText}>Accès Platform Admin</Text>
        </TouchableOpacity>

        {/* Lien WhatsApp */}
        <TouchableOpacity
          style={styles.whatsappLink}
          onPress={() => Linking.openURL('https://wa.me/2250104833352')}
        >
          <WhatsappLogo size={18} weight="fill" color="#25D366" />
          <Text style={styles.whatsappLinkText}>Besoin d'aide ?</Text>
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
                <X size={28} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.searchContainer}>
              <MagnifyingGlass size={20} color={colors.textMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder="Rechercher..."
                placeholderTextColor={colors.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {searchQuery ? (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <XCircle size={20} color={colors.textMuted} weight="fill" />
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
                  <Buildings size={48} color={colors.border} />
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
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: typography.h1.fontSize,
    fontWeight: typography.h1.fontWeight,
    color: colors.text,
    marginTop: spacing.lg,
    fontFamily: typography.fontFamilyHeading,
  },
  subtitle: {
    fontSize: typography.body.fontSize,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  associationSelector: {
    backgroundColor: colors.backgroundWhite,
    borderRadius: borderRadius.card,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    borderWidth: 2,
    borderColor: colors.primary,
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
    marginLeft: spacing.md,
  },
  selectedAssociationName: {
    fontSize: typography.body.fontSize,
    fontWeight: '600',
    color: colors.text,
  },
  selectedAssociationCode: {
    fontSize: typography.caption.fontSize,
    color: colors.textMuted,
    marginTop: 2,
  },
  placeholderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  placeholderText: {
    flex: 1,
    marginLeft: spacing.md,
    fontSize: typography.body.fontSize,
    color: colors.textMuted,
  },
  tabContainer: {
    flexDirection: 'row',
    marginBottom: spacing.xl,
    backgroundColor: colors.border,
    borderRadius: borderRadius.button,
    padding: spacing.xs,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderRadius: borderRadius.button - 2,
  },
  activeTab: {
    backgroundColor: colors.backgroundWhite,
  },
  tabText: {
    fontSize: typography.caption.fontSize + 1,
    color: colors.textMuted,
    fontWeight: '500',
  },
  activeTabText: {
    color: colors.primary,
    fontWeight: '600',
  },
  form: {
    marginBottom: spacing.xl,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundWhite,
    borderRadius: borderRadius.input,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  icon: {
    marginRight: spacing.md,
  },
  input: {
    flex: 1,
    paddingVertical: spacing.lg,
    fontSize: typography.body.fontSize,
    color: colors.text,
  },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.button,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: colors.textOnPrimary,
    fontSize: typography.button.fontSize,
    fontWeight: typography.button.fontWeight,
  },
  platformLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  platformLinkText: {
    color: colors.accentTerracotta,
    fontSize: typography.caption.fontSize + 1,
    fontWeight: '500',
  },
  createAssocLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  createAssocLinkText: {
    color: colors.primary,
    fontSize: typography.caption.fontSize + 1,
    fontWeight: '600',
  },
  whatsappLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  whatsappLinkText: {
    color: '#25D366',
    fontSize: typography.caption.fontSize + 1,
  },
  changeAssocLink: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  changeAssocText: {
    fontSize: typography.caption.fontSize + 1,
    color: colors.textMuted,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.backgroundWhite,
    borderTopLeftRadius: borderRadius.card,
    borderTopRightRadius: borderRadius.card,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: typography.h3.fontSize + 2,
    fontWeight: '600',
    color: colors.text,
    fontFamily: typography.fontFamilyHeading,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.borderLight,
    marginHorizontal: spacing.lg,
    marginVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.input,
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    fontSize: typography.body.fontSize,
    color: colors.text,
  },
  associationList: {
    paddingHorizontal: spacing.lg,
  },
  associationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  associationItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  associationInfo: {
    marginLeft: spacing.md,
  },
  associationName: {
    fontSize: typography.body.fontSize,
    fontWeight: '500',
    color: colors.text,
  },
  associationCode: {
    fontSize: typography.caption.fontSize,
    color: colors.textMuted,
    marginTop: 2,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xxl * 1.5,
  },
  emptyText: {
    fontSize: typography.caption.fontSize + 1,
    color: colors.textMuted,
    marginTop: spacing.md,
  },
});

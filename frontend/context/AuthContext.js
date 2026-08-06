import React, { createContext, useState, useEffect, useContext, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, AppState } from 'react-native';
import api from '../utils/api';
import { useOffline } from './OfflineContext';
import { 
  registerForPushNotifications, 
  unregisterPushNotifications,
  clearBadge,
  addNotificationResponseListener
} from '../utils/notifications';

const AuthContext = createContext();

// Helper pour vérifier si on est sur le web
const isWeb = Platform.OS === 'web';

// Helper pour stocker une valeur (AsyncStorage + localStorage sur web)
const setStorageItem = async (key, value) => {
  try {
    await AsyncStorage.setItem(key, value);
  } catch (e) {
    console.log('AsyncStorage setItem failed:', e);
  }
  
  // Aussi stocker dans localStorage sur web
  if (isWeb && typeof window !== "undefined" && window.localStorage) {
    try {
      window.localStorage.setItem(key, value);
    } catch (e) {
      console.log('localStorage setItem failed:', e);
    }
  }
};

// Helper pour récupérer une valeur (AsyncStorage ou localStorage sur web)
const getStorageItem = async (key) => {
  let value = null;
  
  try {
    value = await AsyncStorage.getItem(key);
  } catch (e) {
    console.log('AsyncStorage getItem failed:', e);
  }
  
  // Fallback sur localStorage pour le web
  if (!value && isWeb && typeof window !== "undefined" && window.localStorage) {
    try {
      value = window.localStorage.getItem(key);
    } catch (e) {
      console.log('localStorage getItem failed:', e);
    }
  }
  
  return value;
};

// Helper pour supprimer une valeur (AsyncStorage + localStorage sur web)
const removeStorageItem = async (key) => {
  try {
    await AsyncStorage.removeItem(key);
  } catch (e) {
    console.log('AsyncStorage removeItem failed:', e);
  }
  
  // Aussi supprimer de localStorage sur web
  if (isWeb && typeof window !== "undefined" && window.localStorage) {
    try {
      window.localStorage.removeItem(key);
    } catch (e) {
      console.log('localStorage removeItem failed:', e);
    }
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [association, setAssociation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(null);
  const [linkedAccounts, setLinkedAccounts] = useState([]);
  
  // Récupérer clearCache depuis OfflineContext
  const { clearCache } = useOffline();

  // Charger l'utilisateur depuis le cache au démarrage
  useEffect(() => {
    loadUser();
  }, []);

  // Gestion des notifications et badges
  useEffect(() => {
    if (isWeb || !token) return;

    // Ref pour tracker si l'effet est toujours actif (évite les appels après cleanup)
    let isEffectActive = true;
    // Ref pour tracker l'état actuel de l'app
    let currentAppState = AppState.currentState;

    // Enregistrer (ou ré-enregistrer) le token push à chaque fois qu'une session devient active
    // Couvre : démarrage avec session existante, login classique, login Google, login par token membre, changement de compte
    registerForPushNotifications().catch(err => {
      console.log('Push registration failed (non-blocking):', err.message);
    });

    // Effacer le badge quand l'app revient au premier plan
    const handleAppStateChange = (nextAppState) => {
      // Ne rien faire si l'effet a été nettoyé ou si on passe en background/inactive
      if (!isEffectActive) return;
      
      // Seulement quand on REVIENT au premier plan (pas quand on le quitte)
      if (currentAppState.match(/inactive|background/) && nextAppState === 'active') {
        // Utiliser setTimeout pour éviter les appels pendant la transition
        setTimeout(() => {
          if (isEffectActive) {
            clearBadge().catch(() => {});
          }
        }, 100);
      }
      currentAppState = nextAppState;
    };

    const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);

    // Listener pour les notifications cliquées (efface le badge)
    const responseUnsubscribe = addNotificationResponseListener((response) => {
      console.log('Notification cliquée:', response.notification.request.content.title);
      if (isEffectActive) {
        clearBadge().catch(() => {});
      }
    });

    // Effacer le badge au démarrage si l'app est active
    clearBadge().catch(() => {});

    return () => {
      // Marquer l'effet comme inactif AVANT de supprimer les listeners
      isEffectActive = false;
      appStateSubscription.remove();
      responseUnsubscribe();
    };
  }, [token]);

  // Fonction interne : ajouter ou mettre à jour un compte lié
  const upsertLinkedAccount = async (newToken, newUser, newAssociation) => {
    try {
      const storedAccounts = await getStorageItem('linkedAccounts');
      let accounts = storedAccounts ? JSON.parse(storedAccounts) : [];
      
      // Chercher si ce compte existe déjà (même association.id)
      const existingIndex = accounts.findIndex(
        acc => acc.association?.id === newAssociation?.id
      );
      
      const accountData = { token: newToken, user: newUser, association: newAssociation };
      
      if (existingIndex >= 0) {
        // Mettre à jour le compte existant
        accounts[existingIndex] = accountData;
      } else {
        // Ajouter le nouveau compte
        accounts.push(accountData);
      }
      
      await setStorageItem('linkedAccounts', JSON.stringify(accounts));
      setLinkedAccounts(accounts);
    } catch (error) {
      console.error('Erreur upsertLinkedAccount:', error);
    }
  };

  const loadUser = async () => {
    try {
      const storedToken = await getStorageItem('authToken');
      const storedUser = await getStorageItem('user');
      const storedAssociation = await getStorageItem('association');
      const storedLinkedAccounts = await getStorageItem('linkedAccounts');

      if (storedToken && storedUser) {
        setToken(storedToken);
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
        
        let parsedAssociation = null;
        if (storedAssociation) {
          parsedAssociation = JSON.parse(storedAssociation);
          setAssociation(parsedAssociation);
        }

        // Compatibilité ascendante : si linkedAccounts n'existe pas, l'initialiser
        if (!storedLinkedAccounts) {
          const initialAccount = { 
            token: storedToken, 
            user: parsedUser, 
            association: parsedAssociation 
          };
          await setStorageItem('linkedAccounts', JSON.stringify([initialAccount]));
          setLinkedAccounts([initialAccount]);
        } else {
          setLinkedAccounts(JSON.parse(storedLinkedAccounts));
        }
      } else if (storedLinkedAccounts) {
        // Charger les comptes liés même sans session active
        setLinkedAccounts(JSON.parse(storedLinkedAccounts));
      }
    } catch (error) {
      console.error('Erreur chargement utilisateur:', error);
    } finally {
      setLoading(false);
    }
  };

  const login = async (identifier, password, accessToken = null, associationCode = null) => {
    try {
      const payload = accessToken 
        ? { accessToken, associationCode }
        : { phone: identifier, password, associationCode };

      const response = await api.post('/auth/login', payload);
      const { token: newToken, user: newUser, association: newAssociation } = response.data;

      // Nettoyer le token SUPER_ADMIN pour éviter les conflits
      await removeStorageItem('platformToken');
      
      // Stocker le nouveau token et les données utilisateur
      await setStorageItem('authToken', newToken);
      await setStorageItem('user', JSON.stringify(newUser));
      if (newAssociation) {
        await setStorageItem('association', JSON.stringify(newAssociation));
      }

      // Ajouter/mettre à jour ce compte dans linkedAccounts
      await upsertLinkedAccount(newToken, newUser, newAssociation);

      setToken(newToken);
      setUser(newUser);
      setAssociation(newAssociation);

      // Note: L'enregistrement des notifications push est maintenant géré automatiquement
      // par le useEffect qui dépend de [token] - plus besoin de le faire ici

      return { success: true };
    } catch (error) {
      console.error('Erreur login:', error);
      return { 
        success: false, 
        error: error.response?.data?.error || 'Erreur de connexion' 
      };
    }
  };

  const logout = async () => {
    try {
      // Désenregistrer les notifications push (non-bloquant)
      if (!isWeb) {
        unregisterPushNotifications().catch(err => {
          console.log('Push unregister failed (non-blocking):', err.message);
        });
      }
      
      await removeStorageItem('authToken');
      await removeStorageItem('user');
      await removeStorageItem('association');
      await removeStorageItem('linkedAccounts'); // Vider tous les comptes liés
      
      // Vider le cache des données hors-ligne pour éviter les fuites entre associations
      await clearCache();
      
      setToken(null);
      setUser(null);
      setAssociation(null);
      setLinkedAccounts([]);
    } catch (error) {
      console.error('Erreur logout:', error);
    }
  };

  // Connexion directe avec un token (après création d'association en libre-service)
  const loginWithToken = async (newToken, userData, assocData) => {
    try {
      // Nettoyer le token SUPER_ADMIN pour éviter les conflits
      await removeStorageItem('platformToken');
      
      // Stocker le nouveau token et les données utilisateur
      await setStorageItem('authToken', newToken);
      await setStorageItem('user', JSON.stringify(userData));
      if (assocData) {
        await setStorageItem('association', JSON.stringify(assocData));
      }

      // Ajouter/mettre à jour ce compte dans linkedAccounts
      await upsertLinkedAccount(newToken, userData, assocData);

      setToken(newToken);
      setUser(userData);
      setAssociation(assocData);

      return { success: true };
    } catch (error) {
      console.error('Erreur loginWithToken:', error);
      return { success: false, error: 'Erreur de connexion' };
    }
  };

  // Basculer vers un autre compte lié
  const switchAccount = async (associationId) => {
    try {
      const storedAccounts = await getStorageItem('linkedAccounts');
      if (!storedAccounts) return;
      
      const accounts = JSON.parse(storedAccounts);
      const targetAccount = accounts.find(acc => acc.association?.id === associationId);
      
      if (targetAccount) {
        // Réécrire les clés de session active
        await setStorageItem('authToken', targetAccount.token);
        await setStorageItem('user', JSON.stringify(targetAccount.user));
        if (targetAccount.association) {
          await setStorageItem('association', JSON.stringify(targetAccount.association));
        }
        
        // Vider le cache des données hors-ligne pour éviter les fuites entre associations
        await clearCache();
        
        // Mettre à jour les états
        setToken(targetAccount.token);
        setUser(targetAccount.user);
        setAssociation(targetAccount.association);
      }
    } catch (error) {
      console.error('Erreur switchAccount:', error);
    }
  };

  // Retirer un compte lié
  const removeLinkedAccount = async (associationId) => {
    try {
      const storedAccounts = await getStorageItem('linkedAccounts');
      if (!storedAccounts) return;
      
      let accounts = JSON.parse(storedAccounts);
      const wasActive = association?.id === associationId;
      
      // Retirer le compte
      accounts = accounts.filter(acc => acc.association?.id !== associationId);
      
      await setStorageItem('linkedAccounts', JSON.stringify(accounts));
      setLinkedAccounts(accounts);
      
      // Si le compte retiré était actif
      if (wasActive) {
        if (accounts.length > 0) {
          // Basculer sur le premier compte restant (clearCache sera appelé dans switchAccount)
          await switchAccount(accounts[0].association?.id);
        } else {
          // Plus aucun compte, déconnexion complète
          await logout();
        }
      }
    } catch (error) {
      console.error('Erreur removeLinkedAccount:', error);
    }
  };

  const refreshUser = async () => {
    try {
      const response = await api.get('/auth/me');
      const { association: updatedAssociation, ...updatedUser } = response.data;
      await setStorageItem('user', JSON.stringify(updatedUser));
      setUser(updatedUser);
      if (updatedAssociation) {
        await setStorageItem('association', JSON.stringify(updatedAssociation));
        setAssociation(updatedAssociation);
      }
    } catch (error) {
      console.error('Erreur refresh user:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      association, 
      loading, 
      token, 
      login, 
      loginWithToken, 
      logout, 
      refreshUser,
      linkedAccounts,
      switchAccount,
      removeLinkedAccount
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

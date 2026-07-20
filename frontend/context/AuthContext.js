import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import api from '../utils/api';

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

  // Charger l'utilisateur depuis le cache au démarrage
  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const storedToken = await getStorageItem('authToken');
      const storedUser = await getStorageItem('user');
      const storedAssociation = await getStorageItem('association');

      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
        if (storedAssociation) {
          setAssociation(JSON.parse(storedAssociation));
        }
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

      setToken(newToken);
      setUser(newUser);
      setAssociation(newAssociation);

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
      await removeStorageItem('authToken');
      await removeStorageItem('user');
      await removeStorageItem('association');
      setToken(null);
      setUser(null);
      setAssociation(null);
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

      setToken(newToken);
      setUser(userData);
      setAssociation(assocData);

      return { success: true };
    } catch (error) {
      console.error('Erreur loginWithToken:', error);
      return { success: false, error: 'Erreur de connexion' };
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
    <AuthContext.Provider value={{ user, association, loading, token, login, loginWithToken, logout, refreshUser }}>
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

import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import api from '../utils/api';

const PlatformAuthContext = createContext(null);

// Helper pour vérifier si on est sur le web
const isWeb = Platform.OS === 'web';

// Helper pour stocker un token (AsyncStorage + localStorage sur web)
const setToken = async (key, value) => {
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

// Helper pour récupérer un token (AsyncStorage ou localStorage sur web)
const getToken = async (key) => {
  let token = null;
  
  try {
    token = await AsyncStorage.getItem(key);
  } catch (e) {
    console.log('AsyncStorage getItem failed:', e);
  }
  
  // Fallback sur localStorage pour le web
  if (!token && isWeb && typeof window !== "undefined" && window.localStorage) {
    try {
      token = window.localStorage.getItem(key);
    } catch (e) {
      console.log('localStorage getItem failed:', e);
    }
  }
  
  return token;
};

// Helper pour supprimer un token (AsyncStorage + localStorage sur web)
const removeToken = async (key) => {
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

export function PlatformAuthProvider({ children }) {
  const [superAdmin, setSuperAdmin] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const token = await getToken('platformToken');
      if (token) {
        // Utiliser le token directement dans la requête
        const response = await api.get('/platform/me', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setSuperAdmin(response.data);
      }
    } catch (error) {
      console.log('Platform auth check failed:', error);
      await removeToken('platformToken');
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    const response = await api.post('/platform/login', { email, password });
    const { token, user } = response.data;
    
    // Nettoyer les tokens utilisateur normal pour éviter les conflits
    await removeToken('authToken');
    await removeToken('user');
    await removeToken('association');
    
    // Stocker le token platform (AsyncStorage + localStorage sur web)
    await setToken('platformToken', token);
    
    setSuperAdmin(user);
    
    return user;
  };

  const logout = async () => {
    // Supprimer le token (AsyncStorage + localStorage sur web)
    await removeToken('platformToken');
    
    // Nettoyer aussi les defaults au cas où
    if (api.defaults?.headers?.common) {
      delete api.defaults.headers.common['Authorization'];
    }
    
    setSuperAdmin(null);
  };

  return (
    <PlatformAuthContext.Provider value={{ superAdmin, loading, login, logout }}>
      {children}
    </PlatformAuthContext.Provider>
  );
}

export function usePlatformAuth() {
  const context = useContext(PlatformAuthContext);
  if (!context) {
    throw new Error('usePlatformAuth must be used within a PlatformAuthProvider');
  }
  return context;
}

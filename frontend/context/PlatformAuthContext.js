import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../utils/api';

const PlatformAuthContext = createContext(null);

export function PlatformAuthProvider({ children }) {
  const [superAdmin, setSuperAdmin] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const token = await AsyncStorage.getItem('platformToken');
      if (token) {
        // Utiliser le token directement dans la requête, pas dans les defaults
        const response = await api.get('/platform/me', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setSuperAdmin(response.data);
      }
    } catch (error) {
      console.log('Platform auth check failed:', error);
      await AsyncStorage.removeItem('platformToken');
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    const response = await api.post('/platform/login', { email, password });
    const { token, user } = response.data;
    
    // Nettoyer le token utilisateur normal pour éviter les conflits
    await AsyncStorage.removeItem('authToken');
    await AsyncStorage.removeItem('user');
    await AsyncStorage.removeItem('association');
    
    await AsyncStorage.setItem('platformToken', token);
    // NE PAS utiliser api.defaults.headers - l'intercepteur gère les tokens via AsyncStorage
    setSuperAdmin(user);
    
    return user;
  };

  const logout = async () => {
    await AsyncStorage.removeItem('platformToken');
    // Nettoyer aussi les defaults au cas où
    delete api.defaults.headers.common['Authorization'];
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

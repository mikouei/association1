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
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        const response = await api.get('/platform/me');
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
    
    await AsyncStorage.setItem('platformToken', token);
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    setSuperAdmin(user);
    
    return user;
  };

  const logout = async () => {
    await AsyncStorage.removeItem('platformToken');
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

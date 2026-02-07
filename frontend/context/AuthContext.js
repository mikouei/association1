import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../utils/api';

const AuthContext = createContext();

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
      const storedToken = await AsyncStorage.getItem('authToken');
      const storedUser = await AsyncStorage.getItem('user');
      const storedAssociation = await AsyncStorage.getItem('association');

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
      await AsyncStorage.removeItem('platformToken');
      
      await AsyncStorage.setItem('authToken', newToken);
      await AsyncStorage.setItem('user', JSON.stringify(newUser));
      if (newAssociation) {
        await AsyncStorage.setItem('association', JSON.stringify(newAssociation));
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
      await AsyncStorage.removeItem('authToken');
      await AsyncStorage.removeItem('user');
      await AsyncStorage.removeItem('association');
      setToken(null);
      setUser(null);
      setAssociation(null);
    } catch (error) {
      console.error('Erreur logout:', error);
    }
  };

  const refreshUser = async () => {
    try {
      const response = await api.get('/auth/me');
      const { association: updatedAssociation, ...updatedUser } = response.data;
      await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
      setUser(updatedUser);
      if (updatedAssociation) {
        await AsyncStorage.setItem('association', JSON.stringify(updatedAssociation));
        setAssociation(updatedAssociation);
      }
    } catch (error) {
      console.error('Erreur refresh user:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, association, loading, token, login, logout, refreshUser }}>
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

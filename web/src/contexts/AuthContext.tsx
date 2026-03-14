'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { platformApi, api } from '@/services/api';
import { User, Association, LoginResponse, PlatformLoginResponse } from '@/types';

interface AuthContextType {
  user: User | null;
  association: Association | null;
  loading: boolean;
  isPlatformAuth: boolean;
  
  // Platform auth (SUPER_ADMIN)
  platformLogin: (email: string, password: string) => Promise<void>;
  platformLogout: () => void;
  
  // Association auth (ADMIN)
  login: (identifier: string, password: string, associationCode: string) => Promise<void>;
  logout: () => void;
  
  // Association selection
  selectAssociation: (association: Association) => void;
  selectedAssociation: Association | null;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [association, setAssociation] = useState<Association | null>(null);
  const [selectedAssociation, setSelectedAssociation] = useState<Association | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPlatformAuth, setIsPlatformAuth] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      // Vérifier d'abord le token platform
      const platformToken = localStorage.getItem('platformToken');
      if (platformToken) {
        const response = await platformApi.get('/platform/me');
        setUser(response.data);
        setIsPlatformAuth(true);
        setLoading(false);
        return;
      }

      // Sinon vérifier le token association
      const authToken = localStorage.getItem('authToken');
      const storedAssociation = localStorage.getItem('selectedAssociation');
      
      if (authToken) {
        const response = await api.get('/auth/me');
        setUser(response.data);
        setIsPlatformAuth(false);
        
        if (storedAssociation) {
          setSelectedAssociation(JSON.parse(storedAssociation));
        }
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      localStorage.removeItem('platformToken');
      localStorage.removeItem('authToken');
    } finally {
      setLoading(false);
    }
  };

  const platformLogin = async (email: string, password: string) => {
    const response = await platformApi.post<PlatformLoginResponse>('/platform/login', { email, password });
    const { token, user } = response.data;
    
    localStorage.setItem('platformToken', token);
    localStorage.removeItem('authToken');
    localStorage.removeItem('selectedAssociation');
    
    setUser(user);
    setIsPlatformAuth(true);
    setSelectedAssociation(null);
  };

  const platformLogout = () => {
    localStorage.removeItem('platformToken');
    setUser(null);
    setIsPlatformAuth(false);
  };

  const login = async (identifier: string, password: string, associationCode: string) => {
    const response = await api.post<LoginResponse>('/auth/login', {
      phone: identifier,
      password,
      associationCode
    });
    
    const { token, user, association } = response.data;
    
    localStorage.setItem('authToken', token);
    localStorage.removeItem('platformToken');
    
    if (association) {
      localStorage.setItem('selectedAssociation', JSON.stringify(association));
      setSelectedAssociation(association);
      setAssociation(association);
    }
    
    setUser(user);
    setIsPlatformAuth(false);
  };

  const logout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('selectedAssociation');
    setUser(null);
    setAssociation(null);
    setSelectedAssociation(null);
    setIsPlatformAuth(false);
  };

  const selectAssociation = (assoc: Association) => {
    localStorage.setItem('selectedAssociation', JSON.stringify(assoc));
    setSelectedAssociation(assoc);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        association,
        loading,
        isPlatformAuth,
        platformLogin,
        platformLogout,
        login,
        logout,
        selectAssociation,
        selectedAssociation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

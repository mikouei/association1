'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { platformApi, api } from '@/services/api';
import { User, Association, LoginResponse, PlatformLoginResponse } from '@/types';

interface LinkedAccount {
  token: string;
  user: User;
  association: Association;
}

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
  loginWithToken: (token: string, user: User, association: Association) => void;
  logout: () => void;
  
  // Association selection
  selectAssociation: (association: Association) => void;
  selectedAssociation: Association | null;

  // Comptes liés
  linkedAccounts: LinkedAccount[];
  switchAccount: (associationId: string) => void;
  removeLinkedAccount: (associationId: string) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [association, setAssociation] = useState<Association | null>(null);
  const [selectedAssociation, setSelectedAssociation] = useState<Association | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPlatformAuth, setIsPlatformAuth] = useState(false);
  const [linkedAccounts, setLinkedAccounts] = useState<LinkedAccount[]>([]);
  const queryClient = useQueryClient();

  useEffect(() => {
    checkAuth();
  }, []);

  // Fonction interne : ajouter ou mettre à jour un compte lié
  const upsertLinkedAccount = (token: string, userData: User, assoc: Association) => {
    const storedAccounts = localStorage.getItem('linkedAccounts');
    let accounts: LinkedAccount[] = storedAccounts ? JSON.parse(storedAccounts) : [];
    
    // Chercher si ce compte existe déjà
    const existingIndex = accounts.findIndex(
      acc => acc.association?.id === assoc?.id
    );
    
    const accountData: LinkedAccount = { token, user: userData, association: assoc };
    
    if (existingIndex >= 0) {
      accounts[existingIndex] = accountData;
    } else {
      accounts.push(accountData);
    }
    
    localStorage.setItem('linkedAccounts', JSON.stringify(accounts));
    setLinkedAccounts(accounts);
  };

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
      const storedLinkedAccounts = localStorage.getItem('linkedAccounts');
      
      if (authToken) {
        const response = await api.get('/auth/me');
        setUser(response.data);
        setIsPlatformAuth(false);
        
        let parsedAssociation: Association | null = null;
        if (storedAssociation) {
          parsedAssociation = JSON.parse(storedAssociation);
          setSelectedAssociation(parsedAssociation);
        }

        // Compatibilité ascendante : si linkedAccounts n'existe pas, l'initialiser
        if (!storedLinkedAccounts && parsedAssociation) {
          const initialAccount: LinkedAccount = { 
            token: authToken, 
            user: response.data, 
            association: parsedAssociation 
          };
          localStorage.setItem('linkedAccounts', JSON.stringify([initialAccount]));
          setLinkedAccounts([initialAccount]);
        } else if (storedLinkedAccounts) {
          setLinkedAccounts(JSON.parse(storedLinkedAccounts));
        }
      } else if (storedLinkedAccounts) {
        // Charger les comptes liés même sans session active
        setLinkedAccounts(JSON.parse(storedLinkedAccounts));
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
      
      // Ajouter/mettre à jour ce compte dans linkedAccounts
      upsertLinkedAccount(token, user, association);
    }
    
    // Vider le cache des queries pour éviter les fuites de données
    queryClient.clear();
    
    setUser(user);
    setIsPlatformAuth(false);
  };

  // Connexion directe avec un token (après création d'association en libre-service)
  const loginWithToken = (token: string, userData: User, assoc: Association) => {
    localStorage.setItem('authToken', token);
    localStorage.removeItem('platformToken');
    localStorage.setItem('selectedAssociation', JSON.stringify(assoc));
    
    // Ajouter/mettre à jour ce compte dans linkedAccounts
    upsertLinkedAccount(token, userData, assoc);
    
    // Vider le cache des queries pour éviter les fuites de données
    queryClient.clear();
    
    setUser(userData);
    setAssociation(assoc);
    setSelectedAssociation(assoc);
    setIsPlatformAuth(false);
  };

  const logout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('selectedAssociation');
    localStorage.removeItem('linkedAccounts'); // Vider tous les comptes liés
    
    // Vider le cache des queries pour éviter les fuites de données
    queryClient.clear();
    
    setUser(null);
    setAssociation(null);
    setSelectedAssociation(null);
    setIsPlatformAuth(false);
    setLinkedAccounts([]);
  };

  const selectAssociation = (assoc: Association) => {
    localStorage.setItem('selectedAssociation', JSON.stringify(assoc));
    setSelectedAssociation(assoc);
  };

  // Basculer vers un autre compte lié
  const switchAccount = (associationId: string) => {
    const targetAccount = linkedAccounts.find(acc => acc.association?.id === associationId);
    
    if (targetAccount) {
      // Réécrire les clés de session active
      localStorage.setItem('authToken', targetAccount.token);
      localStorage.setItem('selectedAssociation', JSON.stringify(targetAccount.association));
      
      // Vider le cache des queries pour éviter les fuites de données
      queryClient.clear();
      
      // Mettre à jour les états
      setUser(targetAccount.user);
      setAssociation(targetAccount.association);
      setSelectedAssociation(targetAccount.association);
    }
  };

  // Retirer un compte lié
  const removeLinkedAccount = (associationId: string) => {
    const wasActive = selectedAssociation?.id === associationId;
    
    // Retirer le compte
    const updatedAccounts = linkedAccounts.filter(acc => acc.association?.id !== associationId);
    
    localStorage.setItem('linkedAccounts', JSON.stringify(updatedAccounts));
    setLinkedAccounts(updatedAccounts);
    
    // Si le compte retiré était actif
    if (wasActive) {
      if (updatedAccounts.length > 0) {
        // Basculer sur le premier compte restant
        switchAccount(updatedAccounts[0].association?.id);
      } else {
        // Plus aucun compte, déconnexion complète
        logout();
      }
    }
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
        loginWithToken,
        logout,
        selectAssociation,
        selectedAssociation,
        linkedAccounts,
        switchAccount,
        removeLinkedAccount,
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

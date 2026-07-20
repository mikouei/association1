// Contexte pour la gestion du mode hors-ligne
// Cache local des données de paiements avec synchronisation

import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

const CACHE_KEYS = {
  PAYMENTS: '@kotiz_cached_payments',
  MEMBER_DATA: '@kotiz_cached_member',
  YEARS: '@kotiz_cached_years',
  EXCEPTIONAL: '@kotiz_cached_exceptional',
  LAST_SYNC: '@kotiz_last_sync',
};

const OfflineContext = createContext();

export const OfflineProvider = ({ children }) => {
  const [isOnline, setIsOnline] = useState(true);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [cachedData, setCachedData] = useState({
    payments: null,
    memberData: null,
    years: null,
    exceptional: null,
  });

  // Surveiller la connexion réseau
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOnline(state.isConnected && state.isInternetReachable);
    });

    // Charger les données du cache au démarrage
    loadCachedData();

    return () => unsubscribe();
  }, []);

  // Charger les données du cache local
  const loadCachedData = async () => {
    try {
      const [payments, memberData, years, exceptional, lastSync] = await Promise.all([
        AsyncStorage.getItem(CACHE_KEYS.PAYMENTS),
        AsyncStorage.getItem(CACHE_KEYS.MEMBER_DATA),
        AsyncStorage.getItem(CACHE_KEYS.YEARS),
        AsyncStorage.getItem(CACHE_KEYS.EXCEPTIONAL),
        AsyncStorage.getItem(CACHE_KEYS.LAST_SYNC),
      ]);

      setCachedData({
        payments: payments ? JSON.parse(payments) : null,
        memberData: memberData ? JSON.parse(memberData) : null,
        years: years ? JSON.parse(years) : null,
        exceptional: exceptional ? JSON.parse(exceptional) : null,
      });

      if (lastSync) {
        setLastSyncTime(new Date(lastSync));
      }
    } catch (error) {
      console.error('Erreur chargement cache:', error);
    }
  };

  // Sauvegarder les paiements dans le cache
  const cachePayments = useCallback(async (payments, memberId) => {
    try {
      const key = `${CACHE_KEYS.PAYMENTS}_${memberId}`;
      await AsyncStorage.setItem(key, JSON.stringify(payments));
      await AsyncStorage.setItem(CACHE_KEYS.LAST_SYNC, new Date().toISOString());
      setLastSyncTime(new Date());
      setCachedData(prev => ({ ...prev, payments }));
    } catch (error) {
      console.error('Erreur sauvegarde cache paiements:', error);
    }
  }, []);

  // Sauvegarder les données membre
  const cacheMemberData = useCallback(async (memberData) => {
    try {
      await AsyncStorage.setItem(CACHE_KEYS.MEMBER_DATA, JSON.stringify(memberData));
      setCachedData(prev => ({ ...prev, memberData }));
    } catch (error) {
      console.error('Erreur sauvegarde cache membre:', error);
    }
  }, []);

  // Sauvegarder les années
  const cacheYears = useCallback(async (years) => {
    try {
      await AsyncStorage.setItem(CACHE_KEYS.YEARS, JSON.stringify(years));
      setCachedData(prev => ({ ...prev, years }));
    } catch (error) {
      console.error('Erreur sauvegarde cache années:', error);
    }
  }, []);

  // Sauvegarder les cotisations exceptionnelles
  const cacheExceptional = useCallback(async (exceptional) => {
    try {
      await AsyncStorage.setItem(CACHE_KEYS.EXCEPTIONAL, JSON.stringify(exceptional));
      setCachedData(prev => ({ ...prev, exceptional }));
    } catch (error) {
      console.error('Erreur sauvegarde cache exceptionnelles:', error);
    }
  }, []);

  // Récupérer les paiements du cache
  const getCachedPayments = useCallback(async (memberId) => {
    try {
      const key = `${CACHE_KEYS.PAYMENTS}_${memberId}`;
      const data = await AsyncStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Erreur lecture cache paiements:', error);
      return null;
    }
  }, []);

  // Effacer tout le cache
  const clearCache = useCallback(async () => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const kotizKeys = keys.filter(k => k.startsWith('@kotiz_cached'));
      await AsyncStorage.multiRemove(kotizKeys);
      setCachedData({
        payments: null,
        memberData: null,
        years: null,
        exceptional: null,
      });
      setLastSyncTime(null);
    } catch (error) {
      console.error('Erreur suppression cache:', error);
    }
  }, []);

  // Formater le temps de dernière sync
  const getLastSyncText = useCallback(() => {
    if (!lastSyncTime) return null;
    
    const now = new Date();
    const diffMs = now - lastSyncTime;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'À l\'instant';
    if (diffMins < 60) return `Il y a ${diffMins} min`;
    if (diffHours < 24) return `Il y a ${diffHours}h`;
    return `Il y a ${diffDays} jour(s)`;
  }, [lastSyncTime]);

  return (
    <OfflineContext.Provider value={{
      isOnline,
      lastSyncTime,
      cachedData,
      cachePayments,
      cacheMemberData,
      cacheYears,
      cacheExceptional,
      getCachedPayments,
      clearCache,
      getLastSyncText,
      loadCachedData,
    }}>
      {children}
    </OfflineContext.Provider>
  );
};

export const useOffline = () => {
  const context = useContext(OfflineContext);
  if (!context) {
    throw new Error('useOffline must be used within an OfflineProvider');
  }
  return context;
};

export default OfflineContext;

import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

import axios from "axios";

const API_BASE_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL ||
  "https://association1.onrender.com";

const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Intercepteur pour ajouter le token automatiquement
api.interceptors.request.use(
  async (config) => {
    // Toujours déterminer le bon token depuis AsyncStorage
    // Ne JAMAIS faire confiance à api.defaults.headers.common['Authorization']
    const authToken = await AsyncStorage.getItem('authToken');
    const platformToken = await AsyncStorage.getItem('platformToken');
    
    // Déterminer quel token utiliser selon la route
    const isPlatformRoute = config.url?.includes('/platform');
    
    if (isPlatformRoute && platformToken) {
      config.headers.Authorization = `Bearer ${platformToken}`;
    } else if (authToken) {
      config.headers.Authorization = `Bearer ${authToken}`;
    } else if (platformToken) {
      config.headers.Authorization = `Bearer ${platformToken}`;
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Intercepteur pour gérer les erreurs globalement
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Ne pas effacer les tokens automatiquement pour éviter les problèmes de conflit
      console.log('401 error - token might be invalid');
    }
    return Promise.reject(error);
  }
);

export default api;

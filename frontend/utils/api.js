import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL ||
  "https://association1.onrender.com";

const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Intercepteur pour ajouter le token automatiquement
api.interceptors.request.use(
  async (config) => {
    // Vérifier d'abord si un header Authorization est déjà défini (par PlatformAuthContext)
    if (config.headers.Authorization) {
      return config;
    }
    
    // Sinon, essayer d'utiliser platformToken (SUPER_ADMIN) ou authToken (utilisateur normal)
    const platformToken = await AsyncStorage.getItem('platformToken');
    const authToken = await AsyncStorage.getItem('authToken');
    
    const token = platformToken || authToken;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
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

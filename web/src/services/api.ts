import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001/api';

// Client API pour les routes platform (SUPER_ADMIN)
export const platformApi: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Client API pour les routes association (ADMIN)
export const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Intercepteur pour les routes platform
platformApi.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('platformToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  // Ajouter timestamp pour éviter le cache
  config.params = { ...config.params, _t: Date.now() };
  return config;
});

// Intercepteur pour les routes association
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Ajouter le code de l'association sélectionnée
    const association = localStorage.getItem('selectedAssociation');
    if (association) {
      try {
        const assocData = JSON.parse(association);
        config.headers['X-Association-Code'] = assocData.code;
      } catch (e) {
        // Ignore
      }
    }
  }
  // Ajouter timestamp pour éviter le cache
  config.params = { ...config.params, _t: Date.now() };
  return config;
});

export default api;

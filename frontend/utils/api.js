import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

const API_BASE_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL ||
  "https://association1.onrender.com";

if (__DEV__) {
  console.log('[API] base URL:', API_BASE_URL);
}

const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Désactiver le cache HTTP pour les requêtes GET
api.defaults.headers.get = {
  ...api.defaults.headers.get,
  "Cache-Control": "no-cache, no-store, must-revalidate",
  "Pragma": "no-cache",
  "Expires": "0"
};

// Helper pour vérifier si on est sur le web
const isWeb = Platform.OS === 'web';

// Helper pour récupérer un token depuis AsyncStorage ou localStorage
const getToken = async (key) => {
  let token = null;
  
  // Essayer AsyncStorage d'abord (fonctionne sur mobile et parfois web)
  try {
    token = await AsyncStorage.getItem(key);
  } catch (e) {
    // AsyncStorage peut échouer sur web dans certains cas
  }
  
  // Fallback sur localStorage pour le web
  if (!token && isWeb && typeof window !== "undefined" && window.localStorage) {
    try {
      token = window.localStorage.getItem(key);
    } catch (e) {
      // localStorage peut être désactivé
    }
  }
  
  return token;
};

// Interceptor pour ajouter le token d'authentification et désactiver le cache
api.interceptors.request.use(async (config) => {
  // Ajouter un timestamp pour éviter le cache sur toutes les requêtes GET
  if (config.method === 'get') {
    config.params = {
      ...config.params,
      _t: Date.now()
    };
  }
  
  // Vérifier si c'est une route platform (SUPER_ADMIN)
  const isPlatformRoute = config.url?.startsWith('/platform');
  
  let token = null;
  
  if (isPlatformRoute) {
    // Utiliser le token platform pour les routes platform
    token = await getToken("platformToken");
    console.log('[API] Platform route detected:', config.url, 'Token found:', !!token);
  } else {
    // Utiliser le token normal pour les autres routes
    token = await getToken("authToken");
    console.log('[API] Normal route:', config.url, 'Token found:', !!token);
  }
  
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  } else {
    console.warn('[API] No token found for route:', config.url);
  }
  
  return config;
});

// ── Gestion centralisée des 401 (jeton expiré) ──
// Pour éviter l'import circulaire avec les contextes d'auth, ceux-ci enregistrent
// un callback via setOnUnauthorized(). L'intercepteur se contente de l'appeler.
const unauthorizedHandlers = { user: null, platform: null };

// scope = 'user' (AuthProvider) ou 'platform' (PlatformAuthProvider)
export const setOnUnauthorized = (callback, scope = 'user') => {
  unauthorizedHandlers[scope] = callback;
};

// Anti-rebond : si plusieurs requêtes échouent en même temps, on n'affiche
// le message et on ne déclenche la déconnexion qu'une seule fois.
let lastUnauthorizedAt = 0;

// Déclenche le traitement « session expirée » (déconnexion + message + redirection).
// Exposé pour les flux hors axios (ex: téléchargements via FileSystem.downloadAsync).
export const triggerUnauthorized = (scope = 'user') => {
  const now = Date.now();
  const showMessage = now - lastUnauthorizedAt > 1500;
  lastUnauthorizedAt = now;
  const handler = unauthorizedHandlers[scope] || unauthorizedHandlers.user;
  if (handler) {
    Promise.resolve(handler({ showMessage })).catch(() => {});
  }
};

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const url = error.config?.url || '';

    // Routes d'entrée d'authentification : un 401 y est une erreur de connexion
    // normale (mauvais identifiants), pas une session expirée.
    const isAuthEntry =
      url.startsWith('/auth/login') ||
      url.startsWith('/auth/google') ||
      url.startsWith('/platform/login') ||
      url.startsWith('/public/');

    if (status === 401 && !isAuthEntry) {
      const isPlatformRoute = url.startsWith('/platform');

      // Marqueur pour que les écrans n'affichent pas leur propre alerte d'erreur
      error.isSessionExpired = true;

      triggerUnauthorized(isPlatformRoute ? 'platform' : 'user');
    }

    // On rejette toujours l'erreur : les 500 / erreurs réseau continuent
    // d'afficher l'alerte habituelle des écrans, sans déconnexion.
    return Promise.reject(error);
  }
);

export default api;

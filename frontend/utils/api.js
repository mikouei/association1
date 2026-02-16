import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

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

// Interceptor optionnel (si tu l’avais avant)
api.interceptors.request.use(async (config) => {
  // Vérifier si c'est une route platform (SUPER_ADMIN)
  const isPlatformRoute = config.url?.startsWith('/platform');
  
  if (isPlatformRoute) {
    // Utiliser le token platform pour les routes platform
    const platformToken = await AsyncStorage.getItem("platformToken");
    if (platformToken) {
      config.headers.Authorization = `Bearer ${platformToken}`;
    }
  } else {
    // Utiliser le token normal pour les autres routes
    const token = await AsyncStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  
  return config;
});

export default api;

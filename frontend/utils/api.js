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

api.interceptors.request.use(async (config) => {

  let token = null;

  // MOBILE
  try {
    const platformToken = await AsyncStorage.getItem("platformToken");
    const authToken = await AsyncStorage.getItem("authToken");
    token = platformToken || authToken;
  } catch (e) {}

  // WEB fallback
  if (!token && typeof window !== "undefined") {
    const platformToken = localStorage.getItem("platformToken");
    const authToken = localStorage.getItem("authToken");
    token = platformToken || authToken;
  }

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

export default api;
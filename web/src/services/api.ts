import axios, { AxiosInstance, InternalAxiosRequestConfig } from "axios";

/*
CONFIG API
*/

const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";

const API_URL = `${BASE_URL}/api`;

/*
API ASSOCIATION
(utilisée par les admins d'association)
*/

export const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

/*
API PLATFORM
(utilisée par le SUPER ADMIN)
*/

export const platformApi: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

/*
INTERCEPTOR ASSOCIATION
*/

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("authToken");

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    const association = localStorage.getItem("selectedAssociation");

    if (association) {
      try {
        const assoc = JSON.parse(association);
        config.headers["X-Association-Code"] = assoc.code;
      } catch (e) {
        console.warn("Association parse error");
      }
    }
  }

  config.params = {
    ...config.params,
    _t: Date.now(),
  };

  return config;
});

/*
INTERCEPTOR PLATFORM
*/

platformApi.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("platformToken");

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }

  config.params = {
    ...config.params,
    _t: Date.now(),
  };

  return config;
});

/*
GESTION ERREURS
*/

const handleError = (error: any) => {
  if (error.response?.status === 401) {
    console.warn("Unauthorized request");

    if (typeof window !== "undefined") {
      const failedToken = localStorage.getItem("authToken");
      
      // Retirer le compte mort de linkedAccounts si c'est une erreur association
      if (failedToken && error.config?.baseURL?.includes('/api')) {
        try {
          const storedAccounts = localStorage.getItem("linkedAccounts");
          if (storedAccounts) {
            const accounts = JSON.parse(storedAccounts);
            const filteredAccounts = accounts.filter(
              (acc: { token: string }) => acc.token !== failedToken
            );
            localStorage.setItem("linkedAccounts", JSON.stringify(filteredAccounts));
          }
        } catch (e) {
          console.warn("Failed to update linkedAccounts after 401");
        }
      }
      
      localStorage.removeItem("authToken");
      localStorage.removeItem("platformToken");
    }
  }

  return Promise.reject(error);
};

api.interceptors.response.use((res) => res, handleError);
platformApi.interceptors.response.use((res) => res, handleError);

/*
EXPORT
*/

export default api;
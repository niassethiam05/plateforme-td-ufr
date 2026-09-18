import axios from "axios";
import { useAuthStore } from "../store/useAuthStore";

// Le proxy Vite (voir vite.config.ts) redirige /api vers le backend en dev.
export const api = axios.create({
  baseURL: "/api",
  withCredentials: true, // necessaire pour envoyer le cookie de refresh token
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().clearAuth();
    }
    return Promise.reject(error);
  }
);

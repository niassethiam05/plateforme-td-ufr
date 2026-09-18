import { create } from "zustand";
import type { AuthUser } from "../types";

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  setAuth: (user: AuthUser, accessToken: string) => void;
  clearAuth: () => void;
}

// Etat d'authentification garde en memoire (pas de localStorage).
// Le refresh token vit dans un cookie httpOnly gere par le backend ;
// une route /auth/refresh (Phase 1 suite) permettra de restaurer la
// session au chargement de la page.
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  setAuth: (user, accessToken) => set({ user, accessToken, isAuthenticated: true }),
  clearAuth: () => set({ user: null, accessToken: null, isAuthenticated: false }),
}));

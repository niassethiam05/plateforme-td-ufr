import axios from "axios";
import type { InternalAxiosRequestConfig } from "axios";
import { useAuthStore } from "../store/useAuthStore";
import type { AuthUser } from "../types";

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

let refreshInFlight: Promise<string> | null = null;

/**
 * Restaure la session a partir du cookie de refresh token et renvoie le
 * nouvel access token.
 *
 * Un seul appel reseau a la fois : le backend fait tourner le refresh token a
 * chaque appel et traite un jeton deja consomme comme un vol (toute la famille
 * est revoquee). Deux appels paralleles avec le meme cookie deconnecteraient
 * donc l'utilisateur — c'est le cas de plusieurs requetes qui recoivent un 401
 * en meme temps, ou du double montage de AuthBootstrap en StrictMode. Tous les
 * appelants partagent la meme promesse.
 *
 * Passe par axios directement, pas par `api` : l'intercepteur de reponse
 * ci-dessous ne doit pas se declencher sur son propre appel de refresh.
 */
export function refreshSession(): Promise<string> {
  if (!refreshInFlight) {
    refreshInFlight = axios
      .post<{ user: AuthUser; accessToken: string }>("/api/auth/refresh", undefined, {
        withCredentials: true,
      })
      .then(({ data }) => {
        useAuthStore.getState().setAuth(data.user, data.accessToken);
        return data.accessToken;
      })
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

/**
 * Deconnexion : demande au backend de revoquer la session et d'effacer le
 * cookie de refresh, puis vide l'etat local. Vider le store seul ne suffit
 * pas : le cookie httpOnly resterait en place et AuthBootstrap restaurerait la
 * session au prochain chargement de page.
 *
 * L'etat local est vide meme si l'appel echoue (reseau coupe, par exemple),
 * pour que le bouton ait toujours un effet visible.
 */
export async function logoutSession(): Promise<void> {
  try {
    await api.post("/auth/logout");
  } catch {
    // Voir ci-dessus : on deconnecte localement dans tous les cas.
  } finally {
    useAuthStore.getState().clearAuth();
  }
}

type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean };

/**
 * Sur un 401, tente une fois de renouveler l'access token (15 min de duree de
 * vie) puis rejoue la requete. Sans cela, un utilisateur actif etait renvoye a
 * la page de connexion toutes les 15 minutes alors que son cookie de refresh
 * est valable 7 jours.
 *
 * Trois cas ou le 401 est rendu tel quel a l'appelant :
 * - la requete n'etait pas authentifiee (visiteur) : il n'y a rien a renouveler ;
 * - la route est sous /auth (identifiants incorrects au login, par exemple) ;
 * - la requete a deja ete rejouee avec un token neuf : le 401 ne vient pas de
 *   l'expiration (ex: "mot de passe actuel incorrect") et la session reste
 *   valide, donc on ne deconnecte pas.
 */
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config as RetriableConfig | undefined;
    const wasAuthenticated = !!config?.headers?.Authorization;

    if (
      error.response?.status !== 401 ||
      !config ||
      !wasAuthenticated ||
      config._retried ||
      config.url?.startsWith("/auth/")
    ) {
      return Promise.reject(error);
    }

    let accessToken: string;
    try {
      accessToken = await refreshSession();
    } catch {
      // Refresh refuse : la session est reellement terminee (cookie expire,
      // compte desactive, sessions revoquees).
      useAuthStore.getState().clearAuth();
      return Promise.reject(error);
    }

    config._retried = true;
    config.headers.Authorization = `Bearer ${accessToken}`;
    return api(config);
  }
);

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { api } from "../services/api";
import { useAuthStore } from "../store/useAuthStore";
import type { AuthUser } from "../types";
import { Spinner } from "../components/Spinner";

/**
 * Au chargement de l'app, tente de restaurer la session a partir du
 * cookie de refresh token httpOnly (l'access token n'est jamais persiste
 * cote client). Evite un flash de redirection vers /connexion pendant
 * que la verification est en cours.
 */
export function AuthBootstrap({ children }: { children: ReactNode }) {
  const setAuth = useAuthStore((s) => s.setAuth);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;

    api
      .post<{ user: AuthUser; accessToken: string }>("/auth/refresh")
      .then(({ data }) => {
        if (!cancelled) setAuth(data.user, data.accessToken);
      })
      .catch(() => {
        // Pas de session active : c'est un cas normal (visiteur non connecte).
      })
      .finally(() => {
        if (!cancelled) setChecked(true);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!checked) {
    return <Spinner label="Chargement de la session..." />;
  }

  return <>{children}</>;
}

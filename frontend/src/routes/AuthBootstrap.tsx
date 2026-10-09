import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { refreshSession } from "../services/api";
import { Spinner } from "../components/Spinner";

/**
 * Au chargement de l'app, tente de restaurer la session a partir du
 * cookie de refresh token httpOnly (l'access token n'est jamais persiste
 * cote client). Evite un flash de redirection vers /connexion pendant
 * que la verification est en cours.
 */
export function AuthBootstrap({ children }: { children: ReactNode }) {
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;

    // refreshSession met lui-meme le store a jour et mutualise les appels
    // concurrents (voir services/api.ts).
    refreshSession()
      .catch(() => {
        // Pas de session active : c'est un cas normal (visiteur non connecte).
      })
      .finally(() => {
        if (!cancelled) setChecked(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!checked) {
    return <Spinner label="Chargement de la session..." />;
  }

  return <>{children}</>;
}

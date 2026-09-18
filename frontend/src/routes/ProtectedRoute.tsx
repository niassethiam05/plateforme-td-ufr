import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "../store/useAuthStore";
import type { Role } from "../types";

interface ProtectedRouteProps {
  allowedRoles?: Role[];
}

/**
 * Garde de route cote frontend : ameliore l'UX (redirection immediate)
 * mais NE remplace jamais la verification de role faite par le backend
 * (voir backend/src/middleware/auth.ts). Un etudiant qui modifie l'URL
 * ne doit jamais recevoir de donnees admin, car l'API les refusera.
 */
export function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated || !user) {
    return <Navigate to="/connexion" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

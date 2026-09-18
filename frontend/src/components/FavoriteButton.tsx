import { useNavigate } from "react-router-dom";
import { useAddFavorite, useRemoveFavorite } from "../services/favorites";
import { useAuthStore } from "../store/useAuthStore";
import { toastError } from "../store/useToastStore";

interface FavoriteButtonProps {
  tdFileId: string;
  isFavorite: boolean;
  className?: string;
}

/** Bouton etoile pour ajouter/retirer une fiche des favoris. */
export function FavoriteButton({ tdFileId, isFavorite, className = "" }: FavoriteButtonProps) {
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const addFavorite = useAddFavorite();
  const removeFavorite = useRemoveFavorite();
  const isPending = addFavorite.isPending || removeFavorite.isPending;

  async function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (!isAuthenticated) {
      toastError("Connectez-vous pour ajouter une fiche à vos favoris.");
      navigate("/connexion");
      return;
    }

    try {
      if (isFavorite) {
        await removeFavorite.mutateAsync(tdFileId);
      } else {
        await addFavorite.mutateAsync(tdFileId);
      }
    } catch {
      toastError("Une erreur est survenue, veuillez réessayer.");
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      aria-pressed={isFavorite}
      aria-label={isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}
      title={isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}
      className={`inline-flex items-center justify-center rounded-lg border p-2 transition disabled:opacity-50 ${
        isFavorite
          ? "border-amber-300 bg-amber-50 text-amber-500 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
          : "border-slate-300 text-slate-400 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
      } ${className}`}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill={isFavorite ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={1.75}
        className="h-4 w-4"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385c.117.487-.415.87-.842.61l-4.725-2.885a.562.562 0 0 0-.586 0l-4.725 2.885c-.427.26-.96-.123-.842-.61l1.285-5.385a.563.563 0 0 0-.182-.557l-4.204-3.602c-.38-.325-.178-.948.321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z"
        />
      </svg>
    </button>
  );
}

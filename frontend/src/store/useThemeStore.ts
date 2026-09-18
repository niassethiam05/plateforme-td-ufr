import { create } from "zustand";

type Theme = "light" | "dark";

interface ThemeState {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

function applyThemeClass(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
}

function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  return prefersDark ? "dark" : "light";
}

const initialTheme = getInitialTheme();
if (typeof document !== "undefined") {
  applyThemeClass(initialTheme);
}

// Etat en memoire uniquement (pas de localStorage), reinitialise a chaque
// chargement de page en fonction de la preference systeme de l'utilisateur.
export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: initialTheme,
  toggleTheme: () => {
    const next: Theme = get().theme === "light" ? "dark" : "light";
    applyThemeClass(next);
    set({ theme: next });
  },
  setTheme: (theme: Theme) => {
    applyThemeClass(theme);
    set({ theme });
  },
}));

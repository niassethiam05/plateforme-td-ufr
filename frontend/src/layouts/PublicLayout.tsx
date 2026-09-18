import { Outlet } from "react-router-dom";
import { Navbar } from "../components/Navbar";

export function PublicLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t border-slate-200 py-6 text-center text-sm text-slate-400 dark:border-slate-800">
        © {new Date().getFullYear()} Plateforme de fiches de TD — UFR
      </footer>
    </div>
  );
}

import { NavLink } from "react-router-dom";
import { useState } from "react";

export interface SidebarLink {
  to: string;
  label: string;
}

interface SidebarProps {
  title: string;
  links: SidebarLink[];
}

/**
 * Sidebar de tableau de bord (etudiant/enseignant/admin).
 * Se transforme en menu deroulant sur mobile (voir bouton "Menu").
 */
export function Sidebar({ title, links }: SidebarProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="border-b border-slate-200 bg-white px-4 py-3 md:hidden dark:border-slate-800 dark:bg-slate-950">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4">
            <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          Menu — {title}
        </button>
      </div>

      <aside
        className={`${
          open ? "block" : "hidden"
        } w-full shrink-0 border-r border-slate-200 bg-white px-4 py-6 md:block md:w-64 dark:border-slate-800 dark:bg-slate-950`}
      >
        <p className="mb-4 px-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          {title}
        </p>
        <nav className="flex flex-col gap-1">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `rounded-lg px-3 py-2 text-sm font-medium transition ${
                  isActive
                    ? "bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  );
}

import { Outlet } from "react-router-dom";
import { Navbar } from "../components/Navbar";
import { Sidebar } from "../components/Sidebar";
import type { SidebarLink } from "../components/Sidebar";

interface DashboardLayoutProps {
  title: string;
  links: SidebarLink[];
}

export function DashboardLayout({ title, links }: DashboardLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <div className="flex flex-1 flex-col md:flex-row">
        <Sidebar title={title} links={links} />
        <main className="flex-1 bg-slate-50 p-4 sm:p-6 lg:p-8 dark:bg-slate-950">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

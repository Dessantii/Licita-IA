import { Link, useLocation } from "wouter";
import { FolderKanban, BarChart3, Settings, LogOut, Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { clearAuth, getUser } from "@/hooks/use-auth";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location, navigate] = useLocation();
  const user = getUser();

  const initials = user?.name
    ? user.name
        .split(" ")
        .slice(0, 2)
        .map((w) => w[0])
        .join("")
        .toUpperCase()
    : "?";

  const navItems = [
    { href: "/processes", icon: FolderKanban, label: "Processos" },
    { href: "/reports", icon: BarChart3, label: "Relatórios" },
    { href: "/settings", icon: Settings, label: "Configurações" },
  ];

  function handleLogout() {
    clearAuth();
    navigate("/login");
  }

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-sidebar border-r border-sidebar-border flex-shrink-0 flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-sidebar-border">
          <div className="flex items-center gap-2">
            <img
              src={`${import.meta.env.BASE_URL}images/logo-mark.png`}
              alt="LicitaIA Logo"
              className="w-8 h-8 rounded-md bg-white p-1"
            />
            <span className="text-sidebar-foreground font-display font-bold text-xl tracking-tight">LicitaIA</span>
          </div>
        </div>

        <nav className="flex-1 py-6 px-3 space-y-1">
          {navItems.map((item) => {
            const isActive =
              location.startsWith(item.href) || (location === "/" && item.href === "/processes");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-active text-white"
                    : "text-slate-400 hover:bg-slate-800 hover:text-white",
                )}
              >
                <item.icon
                  className={cn("w-5 h-5", isActive ? "text-primary-foreground" : "text-slate-400")}
                />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-sidebar-border">
          {user && (
            <div className="flex items-center gap-3 px-3 py-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs flex-shrink-0">
                {initials}
              </div>
              <div className="min-w-0">
                <p className="text-white text-sm font-medium truncate">{user.name}</p>
                <p className="text-slate-500 text-xs truncate">{user.email}</p>
              </div>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <LogOut className="w-5 h-5" />
            Sair
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 bg-white border-b flex items-center justify-between px-8 flex-shrink-0">
          <div className="flex-1" />
          <div className="flex items-center gap-4">
            <button className="p-2 text-slate-400 hover:text-slate-700 transition-colors relative">
              <Bell className="w-5 h-5" />
            </button>
            <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-sm">
              {initials}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 md:p-8">
          <div className="max-w-6xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}

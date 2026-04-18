import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { FolderKanban, BarChart3, Settings, LogOut, Bell, Activity, ExternalLink, CheckCheck, FilePlus, Users, BookOpen, Building2, ChevronDown, Check, UserCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { clearAuth, getUser, getToken } from "@/hooks/use-auth";
import { LicitaIALogo } from "@/components/brand/LicitaIALogo";
import { useActiveCompany } from "@/contexts/CompanyContext";

interface Alert {
  id: number;
  titulo: string;
  modalidade: string | null;
  orgao: string | null;
  municipio: string | null;
  uf: string | null;
  dataPublicacao: string | null;
  urlPncp: string | null;
  isRead: boolean;
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location, navigate] = useLocation();
  const user = getUser();
  const token = getToken();
  const { companies, activeCompany, setActiveCompanyId } = useActiveCompany();
  const [companySwitcherOpen, setCompanySwitcherOpen] = useState(false);
  const companySwitcherRef = useRef<HTMLDivElement>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [bellOpen, setBellOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);
  const [notifEnabled, setNotifEnabled] = useState(true);
  const [notifKeywords, setNotifKeywords] = useState<string[]>([]);

  const initials = user?.name
    ? user.name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase()
    : "?";

  const navItems = [
    { href: "/companies", icon: Building2, label: "Empresas" },
    { href: "/processes", icon: FolderKanban, label: "Licitações" },
    { href: "/chamamentos", icon: BookOpen, label: "Chamamentos" },
    { href: "/monitors", icon: Activity, label: "Monitoramentos" },
    { href: "/reports", icon: BarChart3, label: "Relatórios" },
    ...(user?.role === "admin" ? [{ href: "/admin/users", icon: Users, label: "Usuários" }] : []),
    { href: "/settings", icon: Settings, label: "Configurações" },
  ];

  async function loadNotifSettings() {
    if (!token) return;
    try {
      const res = await fetch("/api/monitors/notification-settings", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setNotifEnabled(data.enabled ?? true);
      setNotifKeywords(data.palavrasChave ?? []);
    } catch {}
  }

  function applyNotifFilter(data: Alert[], enabled: boolean, keywords: string[]) {
    if (!enabled) return [];
    if (!keywords.length) return data.slice(0, 10);
    return data.filter(a => {
      const text = `${a.titulo} ${a.orgao ?? ""}`.toLowerCase();
      return keywords.some(k => text.includes(k.toLowerCase()));
    }).slice(0, 10);
  }

  async function loadAlerts() {
    if (!token) return;
    try {
      const res = await fetch("/api/monitors/alerts?limit=50", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data: Alert[] = await res.json();
      setAlerts(data);
    } catch {}
  }

  useEffect(() => {
    loadNotifSettings();
    loadAlerts();
    const interval = setInterval(loadAlerts, 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setBellOpen(false);
      }
      if (companySwitcherRef.current && !companySwitcherRef.current.contains(e.target as Node)) {
        setCompanySwitcherOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function markAllRead() {
    await fetch("/api/monitors/alerts/read-all", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    setAlerts((prev) => prev.map((a) => ({ ...a, isRead: true })));
    setUnreadCount(0);
  }

  async function markRead(id: number) {
    await fetch(`/api/monitors/alerts/${id}/read`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    setAlerts((prev) => prev.map((a) => a.id === id ? { ...a, isRead: true } : a));
    setUnreadCount((prev) => Math.max(0, prev - 1));
  }

  function handleLogout() {
    clearAuth();
    navigate("/login");
  }

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-sidebar border-r border-sidebar-border flex-shrink-0 flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-sidebar-border">
          <LicitaIALogo variant="full" size="sm" theme="white" />
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
                <item.icon className={cn("w-5 h-5", isActive ? "text-primary-foreground" : "text-slate-400")} />
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
            {/* Company switcher */}
            {companies.length > 0 && (
              <div className="relative" ref={companySwitcherRef}>
                <button
                  onClick={() => setCompanySwitcherOpen(v => !v)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors text-sm font-medium text-slate-700 max-w-[200px]"
                >
                  <Building2 className="w-4 h-4 text-primary flex-shrink-0" />
                  <span className="truncate">
                    {activeCompany
                      ? (activeCompany.nomeFantasia ?? activeCompany.razaoSocial ?? "Empresa")
                      : "Selecione uma empresa"}
                  </span>
                  <ChevronDown className={cn("w-3.5 h-3.5 text-slate-400 flex-shrink-0 transition-transform", companySwitcherOpen && "rotate-180")} />
                </button>

                {companySwitcherOpen && (
                  <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-border rounded-xl shadow-xl z-50 overflow-hidden">
                    <div className="px-4 py-2.5 border-b border-border">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Trocar empresa</p>
                    </div>
                    <div className="max-h-64 overflow-y-auto py-1">
                      {companies.map(company => {
                        const isActive = company.id === activeCompany?.id;
                        const name = company.nomeFantasia ?? company.razaoSocial ?? "Sem nome";
                        const sub = company.nomeFantasia && company.razaoSocial ? company.razaoSocial : company.cnpj;
                        return (
                          <button
                            key={company.id}
                            onClick={() => {
                              setActiveCompanyId(company.id);
                              setCompanySwitcherOpen(false);
                            }}
                            className={cn(
                              "w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50 transition-colors",
                              isActive && "bg-primary/5",
                            )}
                          >
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <Building2 className="w-4 h-4 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={cn("text-sm font-medium truncate", isActive ? "text-primary" : "text-slate-800")}>{name}</p>
                              {sub && <p className="text-xs text-slate-400 truncate">{sub}</p>}
                            </div>
                            {isActive && <Check className="w-4 h-4 text-primary flex-shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                    <div className="border-t border-border px-4 py-2">
                      <Link
                        href="/companies"
                        onClick={() => setCompanySwitcherOpen(false)}
                        className="text-xs text-primary hover:underline"
                      >
                        Gerenciar empresas →
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            )}
            {/* Bell notification */}
            <div className="relative" ref={bellRef}>
              {(() => {
                const filtered = applyNotifFilter(alerts, notifEnabled, notifKeywords);
                const filteredUnread = filtered.filter(a => !a.isRead).length;
                return (
                  <>
                    <button
                      onClick={() => setBellOpen((v) => !v)}
                      className="p-2 text-slate-400 hover:text-slate-700 transition-colors relative"
                    >
                      <Bell className="w-5 h-5" />
                      {filteredUnread > 0 && (
                        <span className="absolute top-1 right-1 min-w-[16px] h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5 border-2 border-white">
                          {filteredUnread > 9 ? "9+" : filteredUnread}
                        </span>
                      )}
                    </button>

                    {bellOpen && (
                      <div className="absolute right-0 top-full mt-2 w-96 bg-white border border-border rounded-xl shadow-xl z-50 overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                          <span className="font-semibold text-sm text-foreground">Novos editais encontrados</span>
                          {filteredUnread > 0 && (
                            <button
                              onClick={markAllRead}
                              className="flex items-center gap-1.5 text-xs text-primary hover:underline"
                            >
                              <CheckCheck className="w-3.5 h-3.5" />
                              Marcar todos como lidos
                            </button>
                          )}
                        </div>

                        {!notifEnabled ? (
                          <div className="py-8 text-center text-muted-foreground text-sm px-4">
                            <Bell className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                            Notificações desativadas.{" "}
                            <Link href="/monitors" onClick={() => setBellOpen(false)} className="text-primary hover:underline">
                              Configurar
                            </Link>
                          </div>
                        ) : filtered.length === 0 ? (
                          <div className="py-8 text-center text-muted-foreground text-sm">
                            Nenhuma notificação ainda.
                          </div>
                        ) : (
                          <div className="max-h-96 overflow-y-auto divide-y divide-border">
                            {filtered.map((alert) => (
                        <div
                          key={alert.id}
                          className={cn(
                            "px-4 py-3 transition-colors",
                            alert.isRead ? "bg-white" : "bg-blue-50",
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              {!alert.isRead && (
                                <span className="inline-block w-2 h-2 bg-blue-500 rounded-full mr-1.5 mb-0.5 align-middle" />
                              )}
                              <p className="text-sm font-medium text-foreground line-clamp-2">
                                {alert.titulo}
                              </p>
                              <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                                {alert.modalidade && (
                                  <span className="text-xs text-muted-foreground">{alert.modalidade}</span>
                                )}
                                {(alert.municipio || alert.uf) && (
                                  <span className="text-xs text-muted-foreground">
                                    {[alert.municipio, alert.uf].filter(Boolean).join(" — ")}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <Link
                                href="/processes"
                                onClick={() => {
                                  sessionStorage.setItem("licitaia_alert_prefill", JSON.stringify({
                                    title: alert.titulo,
                                    agency: alert.orgao ?? "",
                                    modality: alert.modalidade ?? "",
                                    source: alert.urlPncp ?? "",
                                  }));
                                  if (!alert.isRead) markRead(alert.id);
                                  setBellOpen(false);
                                }}
                                className="p-1 text-slate-400 hover:text-green-600 transition"
                                title="Criar processo a partir deste edital"
                              >
                                <FilePlus className="w-3.5 h-3.5" />
                              </Link>
                              {alert.urlPncp && (
                                <a
                                  href={alert.urlPncp}
                                  target="_blank"
                                  rel="noopener"
                                  onClick={() => !alert.isRead && markRead(alert.id)}
                                  className="p-1 text-slate-400 hover:text-primary transition"
                                  title="Ver no PNCP"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              )}
                              {!alert.isRead && (
                                <button
                                  onClick={() => markRead(alert.id)}
                                  className="p-1 text-slate-400 hover:text-primary transition"
                                  title="Marcar como lido"
                                >
                                  <CheckCheck className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                        <div className="px-4 py-2 border-t border-border">
                          <Link
                            href="/monitors"
                            onClick={() => setBellOpen(false)}
                            className="text-xs text-primary hover:underline"
                          >
                            Gerenciar monitoramentos →
                          </Link>
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>

            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setUserMenuOpen((v) => !v)}
                className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-sm hover:bg-primary/20 transition-colors"
                title="Menu do usuário"
              >
                {initials}
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-border rounded-xl shadow-xl z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-border">
                    <p className="text-sm font-semibold text-slate-800 truncate">{user?.name}</p>
                    <p className="text-xs text-slate-500 truncate">{user?.email}</p>
                  </div>
                  <div className="py-1">
                    <Link
                      href="/profile"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      <UserCircle className="w-4 h-4 text-slate-400" />
                      Meu Perfil
                    </Link>
                    <button
                      onClick={() => {
                        setUserMenuOpen(false);
                        handleLogout();
                      }}
                      className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      <LogOut className="w-4 h-4 text-slate-400" />
                      Sair
                    </button>
                  </div>
                </div>
              )}
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

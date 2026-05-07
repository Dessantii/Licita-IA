import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import {
  FolderKanban, BarChart3, Settings, LogOut, Bell, Activity,
  ExternalLink, CheckCheck, FilePlus, Users, BookOpen, Building2,
  ChevronDown, Check, UserCircle, Target, LayoutGrid, ArrowLeft, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { clearAuth, getUser, getToken } from "@/hooks/use-auth";
import { LicitaIALogo } from "@/components/brand/LicitaIALogo";
import { useActiveCompany } from "@/contexts/CompanyContext";

// ── Module definitions ─────────────────────────────────────────────────────
type ModuleId = "licitacoes" | "chamamentos" | "captacao" | "relatorios" | "empresas";

interface ModuleDef {
  id: ModuleId;
  name: string;
  shortName: string;
  sidebarBg: string;
  activeBg: string;
  activeText: string;
  dotColor: string;
  navItems: { href: string; icon: React.ElementType; label: string; adminOnly?: boolean }[];
}

const MODULES: Record<ModuleId, ModuleDef> = {
  licitacoes: {
    id: "licitacoes",
    name: "Licitações",
    shortName: "Licitações",
    sidebarBg: "bg-slate-900",
    activeBg: "bg-blue-600",
    activeText: "text-white",
    dotColor: "bg-blue-400",
    navItems: [
      { href: "/processes", icon: FolderKanban, label: "Processos" },
      { href: "/monitors", icon: Activity, label: "Monitoramentos" },
      { href: "/companies", icon: Building2, label: "Empresas" },
    ],
  },
  chamamentos: {
    id: "chamamentos",
    name: "Chamamentos",
    shortName: "Chamamentos",
    sidebarBg: "bg-slate-900",
    activeBg: "bg-emerald-600",
    activeText: "text-white",
    dotColor: "bg-emerald-400",
    navItems: [
      { href: "/chamamentos", icon: BookOpen, label: "Editais" },
      { href: "/companies", icon: Building2, label: "Documentos da OSC" },
    ],
  },
  captacao: {
    id: "captacao",
    name: "Captação de Recursos",
    shortName: "Captação",
    sidebarBg: "bg-slate-900",
    activeBg: "bg-violet-600",
    activeText: "text-white",
    dotColor: "bg-violet-400",
    navItems: [
      { href: "/oportunidades", icon: Sparkles, label: "Oportunidades" },
      { href: "/funding-notices", icon: Target, label: "Editais" },
      { href: "/funding-projects", icon: FilePlus, label: "Projetos" },
    ],
  },
  relatorios: {
    id: "relatorios",
    name: "Relatórios",
    shortName: "Relatórios",
    sidebarBg: "bg-slate-900",
    activeBg: "bg-amber-500",
    activeText: "text-white",
    dotColor: "bg-amber-400",
    navItems: [
      { href: "/reports", icon: BarChart3, label: "Relatórios" },
      { href: "/settings", icon: Settings, label: "Configurações" },
      { href: "/admin/users", icon: Users, label: "Usuários", adminOnly: true },
    ],
  },
  empresas: {
    id: "empresas",
    name: "Empresas",
    shortName: "Empresas",
    sidebarBg: "bg-slate-900",
    activeBg: "bg-slate-600",
    activeText: "text-white",
    dotColor: "bg-slate-400",
    navItems: [
      { href: "/companies", icon: Building2, label: "Portfólio" },
    ],
  },
};

function detectModule(path: string): ModuleId {
  if (path.startsWith("/funding") || path.startsWith("/oportunidades")) return "captacao";
  if (path.startsWith("/chamamentos")) return "chamamentos";
  if (path.startsWith("/reports") || path.startsWith("/settings") || path.startsWith("/admin")) return "relatorios";
  if (path === "/companies" || path.startsWith("/companies/")) {
    // Inherit from localStorage or default to licitacoes
    try {
      const saved = localStorage.getItem("licitaia_module") as ModuleId | null;
      if (saved && saved in MODULES) return saved;
    } catch {}
    return "licitacoes";
  }
  return "licitacoes";
}

// ── Alert types ────────────────────────────────────────────────────────────
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

// ── AppLayout ──────────────────────────────────────────────────────────────
export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location, navigate] = useLocation();
  const user = getUser();
  const token = getToken();
  const { companies, activeCompany, setActiveCompanyId } = useActiveCompany();

  const moduleId = detectModule(location);
  const module = MODULES[moduleId];

  // Persist module choice
  useEffect(() => {
    if (moduleId !== "empresas") {
      try { localStorage.setItem("licitaia_module", moduleId); } catch {}
    }
  }, [moduleId]);

  const [companySwitcherOpen, setCompanySwitcherOpen] = useState(false);
  const companySwitcherRef = useRef<HTMLDivElement>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [bellOpen, setBellOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);
  const [notifEnabled, setNotifEnabled] = useState(true);
  const [notifKeywords, setNotifKeywords] = useState<string[]>([]);

  const initials = user?.name
    ? user.name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase()
    : "?";

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
    return data.filter((a) => {
      const text = `${a.titulo} ${a.orgao ?? ""}`.toLowerCase();
      return keywords.some((k) => text.includes(k.toLowerCase()));
    }).slice(0, 10);
  }

  async function loadAlerts() {
    if (!token) return;
    try {
      const res = await fetch("/api/monitors/alerts?limit=50", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      setAlerts(await res.json());
    } catch {}
  }

  useEffect(() => {
    loadNotifSettings();
    loadAlerts();
    const iv = setInterval(loadAlerts, 60_000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBellOpen(false);
      if (companySwitcherRef.current && !companySwitcherRef.current.contains(e.target as Node)) setCompanySwitcherOpen(false);
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setUserMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function markAllRead() {
    await fetch("/api/monitors/alerts/read-all", {
      method: "POST", headers: { Authorization: `Bearer ${token}` },
    });
    setAlerts((prev) => prev.map((a) => ({ ...a, isRead: true })));
  }

  async function markRead(id: number) {
    await fetch(`/api/monitors/alerts/${id}/read`, {
      method: "POST", headers: { Authorization: `Bearer ${token}` },
    });
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, isRead: true } : a)));
  }

  function handleLogout() {
    clearAuth();
    navigate("/login");
  }

  const filtered = applyNotifFilter(alerts, notifEnabled, notifKeywords);
  const filteredUnread = filtered.filter((a) => !a.isRead).length;

  // Module color accent for header indicator
  const dotColors: Record<ModuleId, string> = {
    licitacoes: "#3b82f6",
    chamamentos: "#10b981",
    captacao: "#7c3aed",
    relatorios: "#f59e0b",
    empresas: "#64748b",
  };
  const accentColor = dotColors[moduleId];

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      <aside className={cn("w-full md:w-56 flex-shrink-0 flex flex-col", module.sidebarBg)}>
        {/* Logo + module indicator */}
        <div className="h-14 flex items-center gap-3 px-5 border-b border-white/10">
          <LicitaIALogo variant="mark" size="sm" theme="white" />
          <div className="min-w-0">
            <p className="text-white text-xs font-semibold leading-tight truncate">{module.name}</p>
            <div className="flex items-center gap-1 mt-0.5">
              <span
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: accentColor }}
              />
              <p className="text-slate-500 text-[10px]">módulo ativo</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-3 space-y-0.5">
          {module.navItems
            .filter((item) => !item.adminOnly || user?.role === "admin")
            .map((item) => {
              const isActive =
                location === item.href ||
                (location.startsWith(item.href + "/") && item.href !== "/companies");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                    isActive
                      ? cn(module.activeBg, module.activeText)
                      : "text-slate-400 hover:bg-white/5 hover:text-white",
                  )}
                >
                  <item.icon className="w-4 h-4 flex-shrink-0" />
                  {item.label}
                </Link>
              );
            })}
        </nav>

        {/* Bottom */}
        <div className="px-3 pb-4 space-y-0.5 border-t border-white/10 pt-3">
          {/* Trocar módulo */}
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-sm font-medium text-slate-400 hover:bg-white/5 hover:text-white transition-colors"
          >
            <LayoutGrid className="w-4 h-4" />
            Trocar módulo
          </button>

          {/* User */}
          {user && (
            <div className="flex items-center gap-2.5 px-3 py-2 mt-1">
              <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-white text-xs font-medium truncate">{user.name}</p>
              </div>
              <button
                onClick={handleLogout}
                className="text-slate-500 hover:text-white transition-colors flex-shrink-0"
                title="Sair"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ── Main ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-14 bg-white border-b flex items-center justify-between px-6 flex-shrink-0">
          {/* Back to hub */}
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-700 transition-colors mr-4"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:block">Módulos</span>
          </button>

          {/* Module breadcrumb */}
          <div className="flex items-center gap-2 flex-1">
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: accentColor }}
            />
            <span className="text-sm font-semibold text-slate-700">{module.name}</span>
          </div>

          <div className="flex items-center gap-3">
            {/* Company switcher */}
            {companies.length > 0 && (
              <div className="relative" ref={companySwitcherRef}>
                <button
                  onClick={() => setCompanySwitcherOpen((v) => !v)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors text-xs font-medium text-slate-700 max-w-[180px]"
                >
                  <Building2 className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                  <span className="truncate">
                    {activeCompany
                      ? (activeCompany.nomeFantasia ?? activeCompany.razaoSocial ?? "Empresa")
                      : "Todas as empresas"}
                  </span>
                  <ChevronDown className={cn("w-3 h-3 text-slate-400 flex-shrink-0 transition-transform", companySwitcherOpen && "rotate-180")} />
                </button>

                {companySwitcherOpen && (
                  <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-border rounded-xl shadow-xl z-50 overflow-hidden">
                    <div className="px-4 py-2.5 border-b border-border">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Trocar empresa</p>
                    </div>
                    <div className="max-h-64 overflow-y-auto py-1">
                      {/* Todas as empresas option */}
                      <button
                        onClick={() => { setActiveCompanyId(null); setCompanySwitcherOpen(false); }}
                        className={cn(
                          "w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50 transition-colors",
                          activeCompany === null && "bg-primary/5",
                        )}
                      >
                        <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                          <LayoutGrid className="w-3.5 h-3.5 text-slate-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={cn("text-sm font-medium", activeCompany === null ? "text-primary" : "text-slate-800")}>Todas as empresas</p>
                          <p className="text-xs text-slate-400">Ver processos de todas</p>
                        </div>
                        {activeCompany === null && <Check className="w-4 h-4 text-primary flex-shrink-0" />}
                      </button>
                      {companies.map((company) => {
                        const isActive = company.id === activeCompany?.id;
                        const name = company.nomeFantasia ?? company.razaoSocial ?? "Sem nome";
                        const sub = company.nomeFantasia && company.razaoSocial ? company.razaoSocial : company.cnpj;
                        return (
                          <button
                            key={company.id}
                            onClick={() => { setActiveCompanyId(company.id); setCompanySwitcherOpen(false); }}
                            className={cn(
                              "w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50 transition-colors",
                              isActive && "bg-primary/5",
                            )}
                          >
                            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <Building2 className="w-3.5 h-3.5 text-primary" />
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
                      <Link href="/companies" onClick={() => setCompanySwitcherOpen(false)} className="text-xs text-primary hover:underline">
                        Gerenciar empresas →
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Bell */}
            <div className="relative" ref={bellRef}>
              <button
                onClick={() => setBellOpen((v) => !v)}
                className="p-2 text-slate-400 hover:text-slate-700 transition-colors relative"
              >
                <Bell className="w-4 h-4" />
                {filteredUnread > 0 && (
                  <span className="absolute top-1 right-1 min-w-[14px] h-3.5 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5 border-2 border-white">
                    {filteredUnread > 9 ? "9+" : filteredUnread}
                  </span>
                )}
              </button>

              {bellOpen && (
                <div className="absolute right-0 top-full mt-2 w-96 bg-white border border-border rounded-xl shadow-xl z-50 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                    <span className="font-semibold text-sm">Novos editais encontrados</span>
                    {filteredUnread > 0 && (
                      <button onClick={markAllRead} className="flex items-center gap-1 text-xs text-primary hover:underline">
                        <CheckCheck className="w-3 h-3" /> Marcar todos
                      </button>
                    )}
                  </div>

                  {!notifEnabled ? (
                    <div className="py-8 text-center text-muted-foreground text-sm px-4">
                      <Bell className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                      Notificações desativadas.{" "}
                      <Link href="/monitors" onClick={() => setBellOpen(false)} className="text-primary hover:underline">Configurar</Link>
                    </div>
                  ) : filtered.length === 0 ? (
                    <div className="py-8 text-center text-muted-foreground text-sm">Nenhuma notificação.</div>
                  ) : (
                    <div className="max-h-80 overflow-y-auto divide-y divide-border">
                      {filtered.map((alert) => (
                        <div key={alert.id} className={cn("px-4 py-3 transition-colors", alert.isRead ? "bg-white" : "bg-blue-50")}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              {!alert.isRead && <span className="inline-block w-2 h-2 bg-blue-500 rounded-full mr-1.5 mb-0.5 align-middle" />}
                              <p className="text-sm font-medium line-clamp-2">{alert.titulo}</p>
                              <div className="flex flex-wrap gap-x-3 mt-1">
                                {alert.modalidade && <span className="text-xs text-muted-foreground">{alert.modalidade}</span>}
                                {(alert.municipio || alert.uf) && (
                                  <span className="text-xs text-muted-foreground">{[alert.municipio, alert.uf].filter(Boolean).join(" — ")}</span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <Link
                                href="/processes"
                                onClick={() => {
                                  sessionStorage.setItem("licitaia_alert_prefill", JSON.stringify({
                                    title: alert.titulo, agency: alert.orgao ?? "",
                                    modality: alert.modalidade ?? "", source: alert.urlPncp ?? "",
                                  }));
                                  if (!alert.isRead) markRead(alert.id);
                                  setBellOpen(false);
                                }}
                                className="p-1 text-slate-400 hover:text-green-600 transition" title="Criar processo"
                              >
                                <FilePlus className="w-3.5 h-3.5" />
                              </Link>
                              {alert.urlPncp && (
                                <a href={alert.urlPncp} target="_blank" rel="noopener"
                                  onClick={() => !alert.isRead && markRead(alert.id)}
                                  className="p-1 text-slate-400 hover:text-primary transition"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              )}
                              {!alert.isRead && (
                                <button onClick={() => markRead(alert.id)} className="p-1 text-slate-400 hover:text-primary transition">
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
                    <Link href="/monitors" onClick={() => setBellOpen(false)} className="text-xs text-primary hover:underline">
                      Gerenciar monitoramentos →
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* User menu */}
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setUserMenuOpen((v) => !v)}
                className="w-7 h-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-xs hover:bg-primary/20 transition-colors"
              >
                {initials}
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-52 bg-white border border-border rounded-xl shadow-xl z-50 overflow-hidden">
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
                      <UserCircle className="w-4 h-4 text-slate-400" /> Meu Perfil
                    </Link>
                    <button
                      onClick={() => { setUserMenuOpen(false); navigate("/"); }}
                      className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      <LayoutGrid className="w-4 h-4 text-slate-400" /> Trocar módulo
                    </button>
                    <button
                      onClick={() => { setUserMenuOpen(false); handleLogout(); }}
                      className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      <LogOut className="w-4 h-4 text-slate-400" /> Sair
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

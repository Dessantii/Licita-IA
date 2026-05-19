import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import {
  Home, Compass, Search, Building2, BookOpen, MessageSquare,
  Bell, LogOut, CheckCheck, ExternalLink, FilePlus, ChevronDown,
  Check, Settings, Users, BarChart3, LayoutGrid, UserCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { clearAuth, getUser, getToken } from "@/hooks/use-auth";
import { LicitaIALogo } from "@/components/brand/LicitaIALogo";
import { useActiveCompany } from "@/contexts/CompanyContext";

// ── Nav items ──────────────────────────────────────────────────────────────

type NavId = "inicio" | "comecar" | "oportunidades" | "empresa" | "guias" | "ajuda" | "outros";

interface NavItem {
  id: NavId;
  href: string;
  icon: React.ElementType;
  label: string;
  description: string;
}

const NAV: NavItem[] = [
  {
    id: "inicio",
    href: "/",
    icon: Home,
    label: "Início",
    description: "Visão geral e próximos passos",
  },
  {
    id: "comecar",
    href: "/comecar",
    icon: Compass,
    label: "Começar",
    description: "Guia de primeiros passos",
  },
  {
    id: "oportunidades",
    href: "/oportunidades",
    icon: Search,
    label: "Oportunidades",
    description: "Editais e processos disponíveis",
  },
  {
    id: "empresa",
    href: "/companies",
    icon: Building2,
    label: "Minha Empresa",
    description: "Documentos e situação cadastral",
  },
  {
    id: "guias",
    href: "/guias",
    icon: BookOpen,
    label: "Guias",
    description: "Tutoriais e explicações simples",
  },
  {
    id: "ajuda",
    href: "/ajuda",
    icon: MessageSquare,
    label: "Ajuda",
    description: "Tire dúvidas com a IA",
  },
];

function detectNav(path: string): NavId {
  if (path === "/" || path === "") return "inicio";
  if (path.startsWith("/comecar")) return "comecar";
  if (
    path.startsWith("/oportunidades") ||
    path.startsWith("/processes") ||
    path.startsWith("/chamamentos") ||
    path.startsWith("/monitors") ||
    path.startsWith("/funding")
  )
    return "oportunidades";
  if (path.startsWith("/companies") || path.startsWith("/empresa")) return "empresa";
  if (path.startsWith("/guias")) return "guias";
  if (path.startsWith("/ajuda")) return "ajuda";
  return "outros";
}

// ── Alerts ─────────────────────────────────────────────────────────────────

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

  const activeNav = detectNav(location);

  const initials = user?.name
    ? user.name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase()
    : "?";

  // Alerts
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [bellOpen, setBellOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);
  const [notifEnabled, setNotifEnabled] = useState(true);
  const [notifKeywords, setNotifKeywords] = useState<string[]>([]);

  // Company switcher
  const [companySwitcherOpen, setCompanySwitcherOpen] = useState(false);
  const companySwitcherRef = useRef<HTMLDivElement>(null);

  // User menu
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

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

  function applyFilter(data: Alert[], enabled: boolean, keywords: string[]) {
    if (!enabled) return [];
    if (!keywords.length) return data.slice(0, 10);
    return data
      .filter((a) => {
        const text = `${a.titulo} ${a.orgao ?? ""}`.toLowerCase();
        return keywords.some((k) => text.includes(k.toLowerCase()));
      })
      .slice(0, 10);
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
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    setAlerts((prev) => prev.map((a) => ({ ...a, isRead: true })));
  }

  async function markRead(id: number) {
    await fetch(`/api/monitors/alerts/${id}/read`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, isRead: true } : a)));
  }

  function handleLogout() {
    clearAuth();
    navigate("/login");
  }

  const filtered = applyFilter(alerts, notifEnabled, notifKeywords);
  const unreadCount = filtered.filter((a) => !a.isRead).length;

  return (
    <div className="min-h-screen flex flex-row" style={{ backgroundColor: '#F6F9FC' }}>

      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      <aside
        className="hidden md:flex w-[256px] flex-shrink-0 flex-col"
        style={{ backgroundColor: '#0A2540' }}
      >
        {/* Logo */}
        <div className="h-16 flex items-center px-6" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <button onClick={() => navigate("/")} className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: 'rgba(255,255,255,0.10)' }}
            >
              <Building2 className="w-[18px] h-[18px] text-white" />
            </div>
            <span className="font-semibold text-[17px] tracking-tight text-white">LicitaIA</span>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-5 space-y-0.5">
          {NAV.map(({ id, href, icon: Icon, label }) => {
            const isActive = activeNav === id;
            return (
              <Link
                key={id}
                href={href}
                className="relative flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-all duration-150"
                style={{
                  backgroundColor: isActive ? '#1A3A5C' : 'transparent',
                  color: isActive ? '#ffffff' : 'rgba(255,255,255,0.65)',
                  fontWeight: isActive ? 500 : 400,
                }}
              >
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-white rounded-r-full" />
                )}
                <Icon
                  className="w-[18px] h-[18px] flex-shrink-0"
                  style={{ opacity: isActive ? 1 : 0.7 }}
                />
                {label}
              </Link>
            );
          })}

          {/* Extra items */}
          <div className="pt-6 mt-2">
            <p className="px-4 mb-2 text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.30)' }}>
              Configurações
            </p>
            {[
              { href: "/reports", icon: BarChart3, label: "Relatórios" },
              { href: "/settings", icon: Settings, label: "Configurações" },
            ].map(({ href, icon: Icon, label }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-all duration-150"
                style={{
                  backgroundColor: location.startsWith(href) ? '#1A3A5C' : 'transparent',
                  color: location.startsWith(href) ? '#ffffff' : 'rgba(255,255,255,0.50)',
                  fontWeight: location.startsWith(href) ? 500 : 400,
                }}
              >
                <Icon className="w-4 h-4 flex-shrink-0" style={{ opacity: location.startsWith(href) ? 1 : 0.6 }} />
                {label}
              </Link>
            ))}
            {user?.role === "admin" && (
              <Link
                href="/admin/users"
                className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-all duration-150"
                style={{
                  backgroundColor: location.startsWith('/admin') ? '#1A3A5C' : 'transparent',
                  color: location.startsWith('/admin') ? '#ffffff' : 'rgba(255,255,255,0.50)',
                }}
              >
                <Users className="w-4 h-4 flex-shrink-0" style={{ opacity: 0.6 }} />
                Usuários
              </Link>
            )}
          </div>
        </nav>

        {/* User */}
        <div className="px-3 py-3" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors cursor-pointer" onClick={() => setUserMenuOpen((v) => !v)}>
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
              style={{ background: '#0066FF' }}
            >
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.name}</p>
              <p className="text-[11px] truncate" style={{ color: 'rgba(255,255,255,0.50)' }}>{user?.email}</p>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); handleLogout(); }}
              className="p-1 rounded transition-colors flex-shrink-0"
              title="Sair"
              style={{ color: 'rgba(255,255,255,0.40)' }}
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Content ──────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Top bar */}
        <header
          className="h-14 bg-white flex items-center justify-between px-6 flex-shrink-0"
          style={{ borderBottom: "1px solid #f1f5f9" }}
        >
          {/* Mobile logo */}
          <div className="md:hidden">
            <LicitaIALogo variant="full" size="sm" theme="dark" />
          </div>

          {/* Desktop: page context */}
          <div className="hidden md:flex items-center gap-2 text-sm text-slate-400">
            {NAV.find((n) => n.id === activeNav)?.label ?? ""}
          </div>

          <div className="flex items-center gap-2">
            {/* Company switcher */}
            {companies.length > 0 && (
              <div className="relative" ref={companySwitcherRef}>
                <button
                  onClick={() => setCompanySwitcherOpen((v) => !v)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors border border-slate-200 max-w-[160px]"
                >
                  <Building2 className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                  <span className="truncate">
                    {activeCompany
                      ? (activeCompany.nomeFantasia ?? activeCompany.razaoSocial ?? "Empresa")
                      : "Todas"}
                  </span>
                  <ChevronDown className={cn("w-3 h-3 text-slate-400 flex-shrink-0 transition-transform", companySwitcherOpen && "rotate-180")} />
                </button>

                {companySwitcherOpen && (
                  <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden">
                    <div className="px-4 py-2.5" style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <p className="text-xs font-semibold text-slate-500">Trocar empresa</p>
                    </div>
                    <div className="max-h-60 overflow-y-auto py-1">
                      <button
                        onClick={() => { setActiveCompanyId(null); setCompanySwitcherOpen(false); }}
                        className={cn("w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50 transition-colors", !activeCompany && "bg-blue-50")}
                      >
                        <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                          <LayoutGrid className="w-3.5 h-3.5 text-slate-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={cn("text-sm font-medium", !activeCompany ? "text-blue-600" : "text-slate-800")}>Todas as empresas</p>
                        </div>
                        {!activeCompany && <Check className="w-4 h-4 text-blue-600 flex-shrink-0" />}
                      </button>
                      {companies.map((company) => {
                        const isActive = company.id === activeCompany?.id;
                        const name = company.nomeFantasia ?? company.razaoSocial ?? "Sem nome";
                        const sub = company.cnpj;
                        return (
                          <button
                            key={company.id}
                            onClick={() => { setActiveCompanyId(company.id); setCompanySwitcherOpen(false); }}
                            className={cn("w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50 transition-colors", isActive && "bg-blue-50")}
                          >
                            <div className="w-7 h-7 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                              <Building2 className="w-3.5 h-3.5 text-blue-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={cn("text-sm font-medium truncate", isActive ? "text-blue-600" : "text-slate-800")}>{name}</p>
                              {sub && <p className="text-xs text-slate-400 truncate">{sub}</p>}
                            </div>
                            {isActive && <Check className="w-4 h-4 text-blue-600 flex-shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                    <div style={{ borderTop: "1px solid #f1f5f9" }} className="px-4 py-2">
                      <Link href="/companies" onClick={() => setCompanySwitcherOpen(false)} className="text-xs text-blue-600 hover:underline">
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
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors relative"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 min-w-[8px] h-2 bg-red-500 rounded-full" />
                )}
              </button>

              {bellOpen && (
                <div className="absolute right-0 top-full mt-2 w-[360px] bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <span className="font-semibold text-sm text-slate-800">Novos editais</span>
                    {unreadCount > 0 && (
                      <button onClick={markAllRead} className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
                        <CheckCheck className="w-3 h-3" /> Marcar todos como lidos
                      </button>
                    )}
                  </div>

                  {!notifEnabled ? (
                    <div className="py-8 text-center text-slate-400 text-sm px-4">
                      <Bell className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                      Alertas desativados.{" "}
                      <Link href="/monitors" onClick={() => setBellOpen(false)} className="text-blue-600 hover:underline">Configurar</Link>
                    </div>
                  ) : filtered.length === 0 ? (
                    <div className="py-8 text-center text-slate-400 text-sm">Nenhum alerta ainda.</div>
                  ) : (
                    <div className="max-h-72 overflow-y-auto divide-y divide-slate-50">
                      {filtered.map((alert) => (
                        <div key={alert.id} className={cn("px-4 py-3 transition-colors", alert.isRead ? "bg-white" : "bg-blue-50/60")}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              {!alert.isRead && <span className="inline-block w-1.5 h-1.5 bg-blue-500 rounded-full mr-1.5 mb-0.5 align-middle" />}
                              <p className="text-sm font-medium text-slate-800 line-clamp-2 leading-snug">{alert.titulo}</p>
                              <div className="flex flex-wrap gap-x-2 mt-1">
                                {alert.modalidade && <span className="text-xs text-slate-400">{alert.modalidade}</span>}
                                {(alert.municipio || alert.uf) && (
                                  <span className="text-xs text-slate-400">{[alert.municipio, alert.uf].filter(Boolean).join(" · ")}</span>
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
                                className="p-1 text-slate-300 hover:text-blue-600 transition rounded"
                                title="Criar processo"
                              >
                                <FilePlus className="w-3.5 h-3.5" />
                              </Link>
                              {alert.urlPncp && (
                                <a href={alert.urlPncp} target="_blank" rel="noopener"
                                  onClick={() => !alert.isRead && markRead(alert.id)}
                                  className="p-1 text-slate-300 hover:text-blue-600 transition rounded"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              )}
                              {!alert.isRead && (
                                <button onClick={() => markRead(alert.id)} className="p-1 text-slate-300 hover:text-blue-600 transition rounded">
                                  <CheckCheck className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="px-4 py-2.5" style={{ borderTop: "1px solid #f1f5f9" }}>
                    <Link href="/monitors" onClick={() => setBellOpen(false)} className="text-xs text-blue-600 hover:underline">
                      Ver todos os alertas →
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* User menu */}
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setUserMenuOpen((v) => !v)}
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white hover:opacity-90 transition-opacity"
                style={{ background: "#2563eb" }}
              >
                {initials}
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden">
                  <div className="px-4 py-3" style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <p className="text-sm font-medium text-slate-800 truncate">{user?.name}</p>
                    <p className="text-xs text-slate-400 truncate">{user?.email}</p>
                  </div>
                  <div className="py-1">
                    <button
                      onClick={() => { navigate("/profile"); setUserMenuOpen(false); }}
                      className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors text-left"
                    >
                      <UserCircle className="w-4 h-4" />
                      Meu perfil
                    </button>
                    <button
                      onClick={() => { navigate("/settings"); setUserMenuOpen(false); }}
                      className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors text-left"
                    >
                      <Settings className="w-4 h-4" />
                      Configurações
                    </button>
                    <div style={{ borderTop: "1px solid #f1f5f9" }} className="mt-1 pt-1">
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors text-left"
                      >
                        <LogOut className="w-4 h-4" />
                        Sair
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Mobile bottom nav */}
        <nav
          className="md:hidden fixed bottom-0 left-0 right-0 bg-white flex items-center justify-around px-2 py-2 z-40"
          style={{ borderTop: "1px solid #f1f5f9" }}
        >
          {NAV.map(({ id, href, icon: Icon, label }) => {
            const isActive = activeNav === id;
            return (
              <Link
                key={id}
                href={href}
                className="flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg"
              >
                <Icon
                  className="w-5 h-5"
                  style={{ color: isActive ? "#2563eb" : "#94a3b8" }}
                />
                <span
                  className="text-[10px] font-medium"
                  style={{ color: isActive ? "#2563eb" : "#94a3b8" }}
                >
                  {label}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* Page content */}
        <main className="flex-1 overflow-auto pb-20 md:pb-0">
          {children}
        </main>
      </div>
    </div>
  );
}

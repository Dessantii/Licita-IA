import { useLocation } from "wouter";
import { LogOut, Building2, Gavel, Users, TrendingUp, ChevronRight, Bell, Lock } from "lucide-react";
import { clearAuth, getUser, getUserModules } from "@/hooks/use-auth";
import { LicitaIALogo } from "@/components/brand/LicitaIALogo";

function getGreeting(name: string) {
  const hour = new Date().getHours();
  const first = name.split(" ")[0] ?? name;
  if (hour < 12) return `Bom dia, ${first}`;
  if (hour < 18) return `Boa tarde, ${first}`;
  return `Boa noite, ${first}`;
}

const MODULES = [
  {
    id: "licitacoes",
    href: "/processes",
    icon: Gavel,
    iconBg: "#E5F0FF",
    iconColor: "#0066FF",
    label: "Licitações",
    description:
      "Acompanhe processos licitatórios, organize documentos e confira tudo antes de enviar a proposta.",
    tag: "Pregão · Concorrência · Dispensa",
  },
  {
    id: "chamamentos",
    href: "/chamamentos",
    icon: Users,
    iconBg: "#E5F6F3",
    iconColor: "#059669",
    label: "Chamamentos Públicos",
    description:
      "Parcerias e convênios com órgãos públicos — ideal para associações e organizações sociais.",
    tag: "OSC · Convênio · Parceria",
  },
  {
    id: "captacao",
    href: "/funding-notices",
    icon: TrendingUp,
    iconBg: "#EFEFFF",
    iconColor: "#6366F1",
    label: "Captação de Recursos",
    description:
      "Encontre editais de fomento, escreva projetos com apoio da IA e submeta com mais segurança.",
    tag: "Fomento · Financiamento · Projetos",
  },
];

export function ModuleHubPage() {
  const [, navigate] = useLocation();
  const user = getUser();
  const allowedModules = getUserModules();

  const initials = user?.name
    ? user.name
        .split(" ")
        .slice(0, 2)
        .map((w: string) => w[0])
        .join("")
        .toUpperCase()
    : "?";

  function handleLogout() {
    clearAuth();
    navigate("/login");
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#F6F9FC" }}>

      {/* ── Top bar ── */}
      <header
        className="h-14 flex items-center justify-between px-6 flex-shrink-0 bg-white"
        style={{ borderBottom: "1px solid #E8EFF6" }}
      >
        <LicitaIALogo variant="full" size="sm" theme="dark" />

        <div className="flex items-center gap-1">
          <button
            onClick={() => navigate("/monitors")}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
            title="Alertas de editais"
          >
            <Bell className="w-4 h-4" />
          </button>
          <button
            onClick={() => navigate("/profile")}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors"
            title="Meu perfil"
          >
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
              style={{ background: "#0066FF" }}
            >
              {initials}
            </div>
            <span className="hidden sm:block font-medium text-slate-700 text-sm">{user?.name}</span>
          </button>
          <button
            onClick={handleLogout}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
            title="Sair"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* ── Main ── */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-16">
        <div className="w-full max-w-xl">

          {/* Greeting */}
          <div className="mb-10">
            <p className="text-xs font-semibold tracking-widest uppercase mb-2" style={{ color: '#0066FF' }}>
              LicitaIA
            </p>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight mb-2">
              {user?.name ? getGreeting(user.name) + "." : "Olá!"}
            </h1>
            <p className="text-slate-500">
              O que você quer fazer hoje?
            </p>
          </div>

          {/* Module cards */}
          <div className="space-y-3 mb-6">
            {MODULES.map(({ id, href, icon: Icon, iconBg, iconColor, label, description, tag }) => {
              const hasAccess = allowedModules.includes(id as any);
              return hasAccess ? (
                <button
                  key={id}
                  onClick={() => navigate(href)}
                  className="group w-full text-left bg-white rounded-2xl flex items-center gap-4 p-5 transition-all duration-150"
                  style={{
                    border: "1px solid #E8EFF6",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                  }}
                  onMouseEnter={(e) => {
                    const el = e.currentTarget as HTMLButtonElement;
                    el.style.borderColor = "#0066FF30";
                    el.style.boxShadow = "0 4px 16px rgba(0,102,255,0.08)";
                  }}
                  onMouseLeave={(e) => {
                    const el = e.currentTarget as HTMLButtonElement;
                    el.style.borderColor = "#E8EFF6";
                    el.style.boxShadow = "0 2px 8px rgba(0,0,0,0.04)";
                  }}
                >
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: iconBg }}
                  >
                    <Icon className="w-5 h-5" style={{ color: iconColor }} />
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-semibold text-slate-900 mb-0.5">{label}</p>
                    <p className="text-xs text-slate-500 leading-relaxed">{description}</p>
                    <p className="text-[10px] text-slate-400 mt-1.5 font-medium">{tag}</p>
                  </div>
                  <ChevronRight
                    className="w-4 h-4 flex-shrink-0 transition-transform duration-150 group-hover:translate-x-0.5"
                    style={{ color: "#94a3b8" }}
                  />
                </button>
              ) : (
                <div
                  key={id}
                  className="w-full text-left rounded-2xl flex items-center gap-4 p-5 cursor-not-allowed"
                  style={{
                    border: "1px solid #E8EFF6",
                    background: "#FAFAFA",
                    opacity: 0.6,
                  }}
                  title="Módulo não disponível no seu plano"
                >
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: "#F1F5F9" }}
                  >
                    <Icon className="w-5 h-5 text-slate-300" />
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-semibold text-slate-400">{label}</p>
                      <span className="flex items-center gap-1 text-[10px] font-semibold bg-slate-100 text-slate-400 px-2 py-0.5 rounded-full">
                        <Lock className="w-2.5 h-2.5" /> Sem acesso
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">{description}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px" style={{ background: "#E8EFF6" }} />
            <span className="text-[11px] text-slate-400 font-medium tracking-wide uppercase">Gestão</span>
            <div className="flex-1 h-px" style={{ background: "#E8EFF6" }} />
          </div>

          {/* Company access */}
          <button
            onClick={() => navigate("/companies")}
            className="group w-full text-left bg-white rounded-2xl flex items-center gap-4 px-5 py-4 transition-all duration-150"
            style={{ border: "1px solid #E8EFF6", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLButtonElement;
              el.style.borderColor = "#CBD5E1";
              el.style.boxShadow = "0 4px 12px rgba(0,0,0,0.06)";
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLButtonElement;
              el.style.borderColor = "#E8EFF6";
              el.style.boxShadow = "0 2px 8px rgba(0,0,0,0.04)";
            }}
          >
            <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "#F1F5F9" }}>
              <Building2 className="w-4 h-4 text-slate-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-800">Empresa</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Cadastros, certidões, habilitação e documentos de regularidade
              </p>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0 transition-transform duration-150 group-hover:translate-x-0.5" />
          </button>

        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="pb-8 text-center">
        <p className="text-xs text-slate-400">
          LicitaIA · O jeito mais simples de vender para o governo
        </p>
      </footer>

    </div>
  );
}

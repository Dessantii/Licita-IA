import { useLocation } from "wouter";
import { ArrowRight, LogOut, UserCircle, Building2, Gavel, Users, TrendingUp, ChevronRight } from "lucide-react";
import { clearAuth, getUser } from "@/hooks/use-auth";
import { LicitaIALogo } from "@/components/brand/LicitaIALogo";

function getGreeting(name: string) {
  const hour = new Date().getHours();
  const first = name.split(" ")[0] ?? name;
  if (hour < 12) return `Bom dia, ${first}.`;
  if (hour < 18) return `Boa tarde, ${first}.`;
  return `Boa noite, ${first}.`;
}

const ACTIONS = [
  {
    id: "licitacoes",
    href: "/processes",
    icon: Gavel,
    color: "#2563eb",
    lightBg: "#eff6ff",
    label: "Participar de licitações",
    description:
      "Acompanhe processos licitatórios, organize documentos e confira tudo antes de enviar a proposta.",
    cta: "Acessar processos",
  },
  {
    id: "chamamentos",
    href: "/chamamentos",
    icon: Users,
    color: "#059669",
    lightBg: "#f0fdf4",
    label: "Responder chamamentos públicos",
    description:
      "Parcerias e convênios com órgãos públicos — ideal para associações e organizações sociais.",
    cta: "Ver chamamentos",
  },
  {
    id: "captacao",
    href: "/funding-notices",
    icon: TrendingUp,
    color: "#7c3aed",
    lightBg: "#f5f3ff",
    label: "Buscar recursos e financiamentos",
    description:
      "Encontre editais de fomento, escreva projetos com apoio da IA e submeta com mais segurança.",
    cta: "Explorar oportunidades",
  },
];

export function ModuleHubPage() {
  const [, navigate] = useLocation();
  const user = getUser();

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
    <div className="min-h-screen flex flex-col" style={{ background: "#f8fafc" }}>
      {/* ── Top bar ── */}
      <header
        className="h-14 flex items-center justify-between px-6 flex-shrink-0 bg-white"
        style={{ borderBottom: "1px solid #f1f5f9" }}
      >
        <LicitaIALogo variant="full" size="sm" theme="dark" />

        <div className="flex items-center gap-1">
          <button
            onClick={() => navigate("/profile")}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-slate-600 hover:bg-slate-100 transition-colors"
            title="Meu perfil"
          >
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
              style={{ background: "#2563eb" }}
            >
              {initials}
            </div>
            <span className="hidden sm:block font-medium text-slate-700">{user?.name}</span>
          </button>
          <button
            onClick={handleLogout}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            title="Sair"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* ── Main ── */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-2xl">

          {/* Greeting */}
          <div className="mb-10">
            <h1
              className="text-3xl sm:text-4xl font-bold text-slate-900 mb-2"
              style={{ fontFamily: "'Manrope', sans-serif", letterSpacing: "-0.02em" }}
            >
              {user?.name ? getGreeting(user.name) : "Olá!"}
            </h1>
            <p className="text-base text-slate-500">
              O que você quer fazer hoje?
            </p>
          </div>

          {/* Main actions */}
          <div className="space-y-3">
            {ACTIONS.map(({ id, href, icon: Icon, color, lightBg, label, description, cta }) => (
              <button
                key={id}
                onClick={() => navigate(href)}
                className="group w-full text-left bg-white rounded-2xl flex items-center gap-5 p-5 transition-all duration-150 hover:shadow-md"
                style={{
                  border: "1px solid #e2e8f0",
                  outline: "none",
                }}
                onFocus={(e) => (e.currentTarget.style.boxShadow = `0 0 0 2px ${color}33`)}
                onBlur={(e) => (e.currentTarget.style.boxShadow = "")}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = `${color}50`;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = "#e2e8f0";
                }}
              >
                {/* Icon */}
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors"
                  style={{ background: lightBg }}
                >
                  <Icon className="w-5 h-5" style={{ color }} />
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-semibold text-slate-900 mb-0.5">{label}</p>
                  <p className="text-sm text-slate-500 leading-relaxed">{description}</p>
                </div>

                {/* Arrow */}
                <ChevronRight
                  className="w-4 h-4 flex-shrink-0 transition-transform duration-150 group-hover:translate-x-0.5"
                  style={{ color: "#94a3b8" }}
                />
              </button>
            ))}
          </div>

          {/* Divider */}
          <div className="flex items-center gap-4 my-6">
            <div className="flex-1 h-px bg-slate-100" />
            <span className="text-xs text-slate-400 font-medium">Dados da empresa</span>
            <div className="flex-1 h-px bg-slate-100" />
          </div>

          {/* Company access */}
          <button
            onClick={() => navigate("/companies")}
            className="group w-full text-left bg-white rounded-2xl flex items-center gap-4 px-5 py-4 transition-all duration-150 hover:shadow-sm"
            style={{ border: "1px solid #e2e8f0" }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = "#cbd5e1";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = "#e2e8f0";
            }}
          >
            <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-slate-100">
              <Building2 className="w-4 h-4 text-slate-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-800">Minhas empresas e documentos</p>
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

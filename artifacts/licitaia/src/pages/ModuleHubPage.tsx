import { useLocation } from "wouter";
import { FolderKanban, BookOpen, Target, BarChart3, Building2, ArrowRight, LogOut, UserCircle } from "lucide-react";
import { clearAuth, getUser } from "@/hooks/use-auth";
import { LicitaIALogo } from "@/components/brand/LicitaIALogo";

const MODULES = [
  {
    id: "licitacoes",
    name: "Licitações",
    description: "Gerencie processos licitatórios, confira documentos e monitore editais do PNCP em tempo real.",
    icon: FolderKanban,
    href: "/processes",
    gradient: "from-blue-600 to-blue-700",
    bg: "bg-blue-50",
    border: "border-blue-100",
    iconBg: "bg-blue-600",
    tag: "text-blue-600",
    badge: "Conferência documental",
  },
  {
    id: "chamamentos",
    name: "Chamamentos",
    description: "Parcerias com OSCs, chamamentos públicos e conferência de documentos para organizações da sociedade civil.",
    icon: BookOpen,
    href: "/chamamentos",
    gradient: "from-emerald-600 to-emerald-700",
    bg: "bg-emerald-50",
    border: "border-emerald-100",
    iconBg: "bg-emerald-600",
    tag: "text-emerald-600",
    badge: "Parcerias OSC",
  },
  {
    id: "captacao",
    name: "Captação de Recursos",
    description: "Encontre editais de fomento, escreva projetos com IA, valide a aderência e exporte PDFs profissionais.",
    icon: Target,
    href: "/funding-notices",
    gradient: "from-violet-600 to-violet-700",
    bg: "bg-violet-50",
    border: "border-violet-100",
    iconBg: "bg-violet-600",
    tag: "text-violet-600",
    badge: "Redação com IA",
  },
  {
    id: "relatorios",
    name: "Relatórios",
    description: "Visão consolidada de processos, indicadores de desempenho, exportações e configurações do sistema.",
    icon: BarChart3,
    href: "/reports",
    gradient: "from-amber-500 to-amber-600",
    bg: "bg-amber-50",
    border: "border-amber-100",
    iconBg: "bg-amber-500",
    tag: "text-amber-600",
    badge: "Indicadores",
  },
];

export function ModuleHubPage() {
  const [, navigate] = useLocation();
  const user = getUser();

  const initials = user?.name
    ? user.name.split(" ").slice(0, 2).map((w: string) => w[0]).join("").toUpperCase()
    : "?";

  function handleLogout() {
    clearAuth();
    navigate("/login");
  }

  function handleSelect(href: string) {
    navigate(href);
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top bar */}
      <header className="h-14 bg-white border-b border-slate-100 flex items-center justify-between px-6 flex-shrink-0">
        <LicitaIALogo variant="full" size="sm" theme="dark" />
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-xs">
              {initials}
            </div>
            <span className="font-medium hidden sm:block">{user?.name}</span>
          </div>
          <button
            onClick={() => navigate("/profile")}
            className="p-1.5 text-slate-400 hover:text-slate-700 transition-colors rounded-md hover:bg-slate-100"
            title="Meu perfil"
          >
            <UserCircle className="w-4 h-4" />
          </button>
          <button
            onClick={handleLogout}
            className="p-1.5 text-slate-400 hover:text-slate-700 transition-colors rounded-md hover:bg-slate-100"
            title="Sair"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-4xl">
          {/* Heading */}
          <div className="text-center mb-10">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">
              Bem-vindo, {user?.name?.split(" ")[0] ?? "usuário"}
            </p>
            <h1 className="text-2xl font-bold text-slate-800">
              Qual módulo deseja acessar?
            </h1>
            <p className="text-slate-500 mt-1.5 text-sm">
              Selecione um módulo para entrar no seu ambiente dedicado.
            </p>
          </div>

          {/* Module cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {MODULES.map((mod) => {
              const Icon = mod.icon;
              return (
                <button
                  key={mod.id}
                  onClick={() => handleSelect(mod.href)}
                  className={`group text-left rounded-2xl border ${mod.border} ${mod.bg} p-6 hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-300`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`${mod.iconBg} w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm`}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <h2 className="text-base font-semibold text-slate-800">{mod.name}</h2>
                        <ArrowRight className={`w-4 h-4 ${mod.tag} opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0`} />
                      </div>
                      <p className="text-sm text-slate-500 leading-relaxed">{mod.description}</p>
                      <span className={`inline-block mt-3 text-xs font-medium ${mod.tag} bg-white border ${mod.border} px-2.5 py-0.5 rounded-full`}>
                        {mod.badge}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Companies quick access */}
          <div className="mt-4">
            <button
              onClick={() => navigate("/companies")}
              className="group w-full text-left rounded-2xl border border-slate-200 bg-white p-5 hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 flex items-center gap-4"
            >
              <div className="bg-slate-700 w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
                <Building2 className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800">Portfólio de Empresas</p>
                <p className="text-xs text-slate-500 mt-0.5">Gerencie empresas e seus documentos habilitatórios</p>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
            </button>
          </div>
        </div>
      </main>

      <footer className="pb-6 text-center">
        <p className="text-xs text-slate-400">LicitaIA · Conferência documental assistida por IA</p>
      </footer>
    </div>
  );
}

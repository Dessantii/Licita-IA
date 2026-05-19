import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { getUser, getToken } from "@/hooks/use-auth";
import {
  ArrowRight, Gavel, Users, TrendingUp, Bell, AlertTriangle,
  ChevronRight, CheckCircle2, Clock,
} from "lucide-react";

function getGreeting(name: string) {
  const hour = new Date().getHours();
  const first = name.split(" ")[0] ?? name;
  if (hour < 12) return `Bom dia, ${first} 👋`;
  if (hour < 18) return `Boa tarde, ${first} 👋`;
  return `Boa noite, ${first} 👋`;
}

interface RecentAlert {
  id: number;
  titulo: string;
  modalidade: string | null;
  orgao: string | null;
  municipio: string | null;
  uf: string | null;
  urlPncp: string | null;
  isRead: boolean;
}

interface Stats {
  processes: number;
  unreadAlerts: number;
  companies: number;
}

const QUICK_ACTIONS = [
  {
    icon: Gavel,
    color: "#2563eb",
    bg: "#eff6ff",
    label: "Ver licitações disponíveis",
    description: "Editais abertos que combinam com o seu negócio",
    href: "/oportunidades",
  },
  {
    icon: Users,
    color: "#059669",
    bg: "#f0fdf4",
    label: "Chamamentos públicos",
    description: "Parcerias com órgãos públicos para organizações sociais",
    href: "/chamamentos",
  },
  {
    icon: TrendingUp,
    color: "#7c3aed",
    bg: "#f5f3ff",
    label: "Buscar financiamentos",
    description: "Recursos e editais de fomento disponíveis",
    href: "/funding-notices",
  },
];

export function InicioPage() {
  const [, navigate] = useLocation();
  const user = getUser();
  const token = getToken();
  const [stats, setStats] = useState<Stats>({ processes: 0, unreadAlerts: 0, companies: 0 });
  const [recentAlerts, setRecentAlerts] = useState<RecentAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      if (!token) return;
      const headers = { Authorization: `Bearer ${token}` };
      try {
        const [processesRes, alertsRes, companiesRes] = await Promise.all([
          fetch("/api/processes?limit=1", { headers }),
          fetch("/api/monitors/alerts?limit=5", { headers }),
          fetch("/api/companies", { headers }),
        ]);

        let processCount = 0;
        if (processesRes.ok) {
          const data = await processesRes.json();
          processCount = Array.isArray(data) ? data.length : (data.total ?? 0);
        }

        let alertsData: RecentAlert[] = [];
        if (alertsRes.ok) {
          alertsData = await alertsRes.json();
          setRecentAlerts(alertsData.slice(0, 4));
        }

        let companyCount = 0;
        if (companiesRes.ok) {
          const data = await companiesRes.json();
          companyCount = Array.isArray(data) ? data.length : 0;
        }

        setStats({
          processes: processCount,
          unreadAlerts: alertsData.filter((a) => !a.isRead).length,
          companies: companyCount,
        });
      } catch {}
      setLoading(false);
    }
    loadData();
  }, [token]);

  const firstName = user?.name?.split(" ")[0] ?? "você";

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto px-5 sm:px-8 py-8 sm:py-10">

        {/* Greeting */}
        <div className="mb-8">
          <h1
            className="text-2xl sm:text-3xl font-bold text-slate-900 mb-1"
            style={{ fontFamily: "'Manrope', sans-serif", letterSpacing: "-0.02em" }}
          >
            {user?.name ? getGreeting(user.name) : "Olá!"}
          </h1>
          <p className="text-slate-500 text-sm sm:text-base">
            Veja o que está acontecendo e o que você pode fazer agora.
          </p>
        </div>

        {/* Status cards */}
        {!loading && (
          <div className="grid grid-cols-3 gap-3 mb-8">
            <div
              className="bg-white rounded-2xl p-4 text-center"
              style={{ border: "1px solid #f1f5f9" }}
            >
              <p className="text-2xl font-bold text-slate-900">{stats.processes}</p>
              <p className="text-xs text-slate-400 mt-0.5 leading-tight">processos<br />ativos</p>
            </div>
            <div
              className="bg-white rounded-2xl p-4 text-center"
              style={{ border: "1px solid #f1f5f9" }}
            >
              <p className="text-2xl font-bold" style={{ color: stats.unreadAlerts > 0 ? "#2563eb" : "#0f172a" }}>
                {stats.unreadAlerts}
              </p>
              <p className="text-xs text-slate-400 mt-0.5 leading-tight">novos<br />editais</p>
            </div>
            <div
              className="bg-white rounded-2xl p-4 text-center"
              style={{ border: "1px solid #f1f5f9" }}
            >
              <p className="text-2xl font-bold text-slate-900">{stats.companies}</p>
              <p className="text-xs text-slate-400 mt-0.5 leading-tight">empresa{stats.companies !== 1 ? "s" : ""}<br />cadastrada{stats.companies !== 1 ? "s" : ""}</p>
            </div>
          </div>
        )}

        {/* Next step banner — shown only if no company registered */}
        {!loading && stats.companies === 0 && (
          <div
            className="mb-8 rounded-2xl p-5 flex items-start gap-4"
            style={{ background: "#fffbeb", border: "1px solid #fde68a" }}
          >
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#fef3c7" }}>
              <AlertTriangle className="w-4 h-4" style={{ color: "#d97706" }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber-900 mb-0.5">Comece cadastrando sua empresa</p>
              <p className="text-sm text-amber-700">
                Para participar de licitações, você precisa ter os dados e documentos da empresa cadastrados.
              </p>
            </div>
            <button
              onClick={() => navigate("/comecar")}
              className="flex items-center gap-1 text-sm font-medium text-amber-700 hover:text-amber-900 transition-colors flex-shrink-0 mt-0.5"
            >
              Ver como <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Quick actions */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-700">O que você quer fazer?</h2>
          </div>
          <div className="space-y-2">
            {QUICK_ACTIONS.map(({ icon: Icon, color, bg, label, description, href }) => (
              <button
                key={href}
                onClick={() => navigate(href)}
                className="group w-full bg-white flex items-center gap-4 px-4 py-3.5 rounded-2xl text-left transition-all duration-150 hover:shadow-sm"
                style={{ border: "1px solid #f1f5f9" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = `${color}30`; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#f1f5f9"; }}
              >
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: bg }}>
                  <Icon className="w-4 h-4" style={{ color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800">{label}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{description}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0 transition-transform duration-150 group-hover:translate-x-0.5" />
              </button>
            ))}
          </div>
        </div>

        {/* Recent alerts */}
        {recentAlerts.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-slate-700">Editais encontrados recentemente</h2>
              <button
                onClick={() => navigate("/monitors")}
                className="text-xs text-blue-600 hover:underline"
              >
                Ver todos →
              </button>
            </div>
            <div className="bg-white rounded-2xl overflow-hidden" style={{ border: "1px solid #f1f5f9" }}>
              {recentAlerts.map((alert, i) => (
                <div
                  key={alert.id}
                  className={cn(
                    "flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-slate-50 cursor-pointer",
                    i > 0 && "border-t border-slate-50"
                  )}
                  onClick={() => alert.urlPncp && window.open(alert.urlPncp, "_blank")}
                >
                  <div className="flex-shrink-0 mt-0.5">
                    {alert.isRead
                      ? <CheckCircle2 className="w-4 h-4 text-slate-200" />
                      : <Bell className="w-4 h-4 text-blue-500" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-800 font-medium line-clamp-1">{alert.titulo}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {alert.modalidade && (
                        <span className="text-xs text-slate-400">{alert.modalidade}</span>
                      )}
                      {(alert.municipio || alert.uf) && (
                        <>
                          <span className="text-slate-200">·</span>
                          <span className="text-xs text-slate-400">
                            {[alert.municipio, alert.uf].filter(Boolean).join(", ")}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-300 flex-shrink-0 mt-0.5" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty state for alerts */}
        {!loading && recentAlerts.length === 0 && (
          <div
            className="bg-white rounded-2xl p-8 text-center"
            style={{ border: "1px solid #f1f5f9" }}
          >
            <Bell className="w-8 h-8 text-slate-200 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-600 mb-1">Nenhum edital encontrado ainda</p>
            <p className="text-xs text-slate-400 mb-4">
              Configure alertas para receber editais que combinam com o seu negócio.
            </p>
            <button
              onClick={() => navigate("/monitors")}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:underline"
            >
              Configurar alertas <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

      </div>
    </AppLayout>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

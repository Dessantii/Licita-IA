import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { getToken } from "@/hooks/use-auth";
import { CheckCircle2, Circle, Building2, FileText, Bell, Search, FolderPlus, ArrowRight, ChevronRight } from "lucide-react";

interface Step {
  id: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  title: string;
  description: string;
  detail: string;
  cta: string;
  href: string;
  check: (data: CheckData) => boolean;
}

interface CheckData {
  hasCompany: boolean;
  hasProcesses: boolean;
  hasMonitors: boolean;
}

const STEPS: Step[] = [
  {
    id: "empresa",
    icon: Building2,
    color: "#2563eb",
    bg: "#eff6ff",
    title: "Cadastre sua empresa",
    description: "Coloque os dados básicos da sua empresa: CNPJ, razão social e endereço.",
    detail: "Leva menos de 5 minutos. Com o CNPJ, já preenchemos bastante coisa automaticamente.",
    cta: "Cadastrar empresa",
    href: "/companies",
    check: (d) => d.hasCompany,
  },
  {
    id: "documentos",
    icon: FileText,
    color: "#059669",
    bg: "#f0fdf4",
    title: "Envie os documentos básicos",
    description: "Documentos que toda empresa precisa para participar: Contrato Social, Cartão CNPJ, certidões.",
    detail: "Você não precisa enviar tudo de uma vez. Comece com os documentos que você já tem.",
    cta: "Ver documentos necessários",
    href: "/companies",
    check: (d) => d.hasCompany,
  },
  {
    id: "alertas",
    icon: Bell,
    color: "#d97706",
    bg: "#fffbeb",
    title: "Ative alertas de editais",
    description: "Diga o que sua empresa faz e o sistema vai te avisar quando surgir uma oportunidade.",
    detail: "Exemplo: se você é de TI, coloque palavras como 'software', 'sistema', 'tecnologia'.",
    cta: "Configurar alertas",
    href: "/monitors",
    check: (d) => d.hasMonitors,
  },
  {
    id: "oportunidades",
    icon: Search,
    color: "#7c3aed",
    bg: "#f5f3ff",
    title: "Explore as oportunidades",
    description: "Veja os editais disponíveis e encontre uma licitação que faça sentido para o seu negócio.",
    detail: "Você pode filtrar por cidade, estado e tipo de licitação.",
    cta: "Ver oportunidades",
    href: "/oportunidades",
    check: () => false,
  },
  {
    id: "processo",
    icon: FolderPlus,
    color: "#0891b2",
    bg: "#ecfeff",
    title: "Crie seu primeiro processo",
    description: "Quando encontrar um edital interessante, crie um processo para organizar tudo em um lugar.",
    detail: "A IA lê o edital e te diz exatamente quais documentos você precisa para participar.",
    cta: "Criar processo",
    href: "/processes",
    check: (d) => d.hasProcesses,
  },
];

export function ComecarPage() {
  const [, navigate] = useLocation();
  const token = getToken();
  const [checkData, setCheckData] = useState<CheckData>({ hasCompany: false, hasProcesses: false, hasMonitors: false });
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>("empresa");

  useEffect(() => {
    async function load() {
      if (!token) return;
      const headers = { Authorization: `Bearer ${token}` };
      try {
        const [companiesRes, processesRes, monitorsRes] = await Promise.all([
          fetch("/api/companies", { headers }),
          fetch("/api/processes?limit=1", { headers }),
          fetch("/api/monitors", { headers }),
        ]);
        const companies = companiesRes.ok ? await companiesRes.json() : [];
        const processes = processesRes.ok ? await processesRes.json() : [];
        const monitors = monitorsRes.ok ? await monitorsRes.json() : [];
        setCheckData({
          hasCompany: Array.isArray(companies) && companies.length > 0,
          hasProcesses: Array.isArray(processes) && processes.length > 0,
          hasMonitors: Array.isArray(monitors) && monitors.length > 0,
        });
        // Auto-expand first incomplete step
        const firstIncomplete = STEPS.find((s) => !s.check({ hasCompany: Array.isArray(companies) && companies.length > 0, hasProcesses: Array.isArray(processes) && processes.length > 0, hasMonitors: Array.isArray(monitors) && monitors.length > 0 }));
        if (firstIncomplete) setExpanded(firstIncomplete.id);
      } catch {}
      setLoading(false);
    }
    load();
  }, [token]);

  const completedCount = STEPS.filter((s) => s.check(checkData)).length;

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto px-5 sm:px-8 py-8 sm:py-10">

        {/* Header */}
        <div className="mb-8">
          <h1
            className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2"
            style={{ fontFamily: "'Manrope', sans-serif", letterSpacing: "-0.02em" }}
          >
            Por onde começar
          </h1>
          <p className="text-slate-500 text-sm sm:text-base">
            Siga estes passos para estar pronto para participar de licitações.
          </p>

          {/* Progress */}
          {!loading && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-slate-400">{completedCount} de {STEPS.length} concluídos</span>
                <span className="text-xs font-medium text-slate-600">{Math.round((completedCount / STEPS.length) * 100)}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${(completedCount / STEPS.length) * 100}%`,
                    background: "linear-gradient(90deg, #2563eb, #3b82f6)",
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Steps */}
        <div className="space-y-3">
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            const done = step.check(checkData);
            const isExpanded = expanded === step.id;

            return (
              <div
                key={step.id}
                className="bg-white rounded-2xl overflow-hidden transition-all duration-200"
                style={{
                  border: `1px solid ${isExpanded ? `${step.color}30` : "#f1f5f9"}`,
                }}
              >
                <button
                  className="w-full flex items-center gap-4 px-5 py-4 text-left"
                  onClick={() => setExpanded(isExpanded ? null : step.id)}
                >
                  {/* Step indicator */}
                  <div className="flex-shrink-0">
                    {done ? (
                      <CheckCircle2 className="w-5 h-5" style={{ color: step.color }} />
                    ) : (
                      <div
                        className="w-5 h-5 rounded-full border-2 flex items-center justify-center"
                        style={{ borderColor: isExpanded ? step.color : "#e2e8f0" }}
                      >
                        <span className="text-[9px] font-bold" style={{ color: isExpanded ? step.color : "#94a3b8" }}>
                          {i + 1}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold ${done ? "text-slate-400 line-through" : "text-slate-900"}`}>
                      {step.title}
                    </p>
                    {!isExpanded && (
                      <p className="text-xs text-slate-400 mt-0.5 truncate">{step.description}</p>
                    )}
                  </div>

                  <ChevronRight
                    className="w-4 h-4 text-slate-300 flex-shrink-0 transition-transform duration-200"
                    style={{ transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)" }}
                  />
                </button>

                {isExpanded && (
                  <div className="px-5 pb-5">
                    <div
                      className="flex gap-3 p-4 rounded-xl mb-4"
                      style={{ background: step.bg }}
                    >
                      <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: step.color }} />
                      <div>
                        <p className="text-sm font-medium text-slate-800 mb-1">{step.description}</p>
                        <p className="text-xs text-slate-500 leading-relaxed">{step.detail}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => navigate(step.href)}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-150 hover:opacity-90"
                      style={{ background: step.color }}
                    >
                      {step.cta}
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* All done */}
        {!loading && completedCount === STEPS.length && (
          <div className="mt-6 bg-white rounded-2xl p-6 text-center" style={{ border: "1px solid #f1f5f9" }}>
            <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto mb-3" />
            <p className="font-semibold text-slate-800 mb-1">Tudo pronto!</p>
            <p className="text-sm text-slate-500 mb-4">
              Sua empresa está configurada e você já pode participar de licitações.
            </p>
            <button
              onClick={() => navigate("/oportunidades")}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
              style={{ background: "#2563eb" }}
            >
              Ver oportunidades <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

      </div>
    </AppLayout>
  );
}

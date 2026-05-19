import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { getUser, getToken } from "@/hooks/use-auth";
import {
  Building2, FileText, Bell, ArrowRight, ChevronRight,
  CheckCircle2, AlertCircle, Circle, Sparkles, BookOpen,
  Compass, MapPin, ExternalLink, Zap,
} from "lucide-react";

// ── Types ───────────────────────────────────────────────────────────────────

interface Company {
  id: number;
  razaoSocial: string | null;
  nomeFantasia: string | null;
  cnpj: string | null;
}

interface CompanyDoc {
  id: number;
  tipo: string;
  validade: string | null;
}

interface MonitorAlert {
  id: number;
  titulo: string;
  modalidade: string | null;
  orgao: string | null;
  municipio: string | null;
  uf: string | null;
  urlPncp: string | null;
  isRead: boolean;
}

interface HomeData {
  companies: Company[];
  documents: CompanyDoc[];
  hasMonitor: boolean;
  alerts: MonitorAlert[];
}

// ── Readiness ────────────────────────────────────────────────────────────────

function computeReadiness(data: HomeData): number {
  let score = 0;
  if (data.companies.length > 0) score += 34;
  if (data.documents.length >= 1) score += 33;
  if (data.hasMonitor) score += 33;
  return Math.min(score, 100);
}

function readinessLabel(score: number): string {
  if (score === 0) return "Ainda não começou";
  if (score < 34) return "Dando os primeiros passos";
  if (score < 68) return "Em andamento";
  if (score < 100) return "Quase pronto";
  return "Pronto para participar";
}

function readinessColor(score: number): string {
  if (score === 0) return "#cbd5e1";
  if (score < 34) return "#f59e0b";
  if (score < 68) return "#f59e0b";
  if (score < 100) return "#2563eb";
  return "#059669";
}

// ── Next action ──────────────────────────────────────────────────────────────

interface NextAction {
  icon: React.ElementType;
  color: string;
  bg: string;
  title: string;
  reason: string;
  cta: string;
  href: string;
}

function computeNextAction(data: HomeData): NextAction {
  if (data.companies.length === 0) {
    return {
      icon: Building2,
      color: "#2563eb",
      bg: "#eff6ff",
      title: "Cadastre sua empresa",
      reason: "Sem o cadastro da empresa, você não pode participar de nenhuma licitação. É o primeiro passo e leva menos de 5 minutos.",
      cta: "Cadastrar agora",
      href: "/companies",
    };
  }
  if (data.documents.length === 0) {
    return {
      icon: FileText,
      color: "#d97706",
      bg: "#fffbeb",
      title: "Envie seus documentos básicos",
      reason: "Para participar de uma licitação, você precisa comprovar que a empresa está em dia. Comece pelo que você já tem em mãos.",
      cta: "Ver documentos necessários",
      href: `/companies/${data.companies[0].id}`,
    };
  }
  if (!data.hasMonitor) {
    return {
      icon: Bell,
      color: "#7c3aed",
      bg: "#f5f3ff",
      title: "Configure seus alertas de editais",
      reason: "Diga ao sistema o que sua empresa faz e ele vai te avisar automaticamente quando aparecer um edital que combina com você.",
      cta: "Configurar alertas",
      href: "/monitors",
    };
  }
  return {
    icon: Sparkles,
    color: "#059669",
    bg: "#f0fdf4",
    title: "Explore as oportunidades disponíveis",
    reason: "Você está bem encaminhado! Agora é hora de olhar os editais disponíveis e encontrar uma oportunidade para participar.",
    cta: "Ver oportunidades",
    href: "/oportunidades",
  };
}

// ── Human-readable modalidade ────────────────────────────────────────────────

function simplifyModalidade(m: string | null): string {
  if (!m) return "Licitação";
  const map: Record<string, string> = {
    "Pregão Eletrônico": "Pregão eletrônico",
    "Pregão Presencial": "Pregão presencial",
    "Concorrência": "Concorrência",
    "Tomada de Preços": "Tomada de preços",
    "Convite": "Convite",
    "Dispensa de Licitação": "Dispensa",
    "Inexigibilidade": "Inexigibilidade",
    "Concurso": "Concurso",
    "Leilão": "Leilão",
  };
  return map[m] ?? m;
}

// ── Progress ring SVG ────────────────────────────────────────────────────────

function ProgressRing({ score, size = 96 }: { score: number; size?: number }) {
  const radius = (size - 12) / 2;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (score / 100) * circ;
  const color = readinessColor(score);

  return (
    <svg width={size} height={size} className="flex-shrink-0 -rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="#f1f5f9"
        strokeWidth={8}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={8}
        strokeLinecap="round"
        strokeDasharray={`${circ} ${circ}`}
        strokeDashoffset={offset}
        style={{ transition: "stroke-dashoffset 0.8s ease, stroke 0.4s ease" }}
      />
    </svg>
  );
}

// ── Status item ──────────────────────────────────────────────────────────────

function StatusItem({
  label,
  sublabel,
  status,
}: {
  label: string;
  sublabel: string;
  status: "ok" | "partial" | "missing";
}) {
  const configs = {
    ok: { icon: CheckCircle2, color: "#059669", bg: "#f0fdf4", border: "#bbf7d0" },
    partial: { icon: AlertCircle, color: "#d97706", bg: "#fffbeb", border: "#fde68a" },
    missing: { icon: Circle, color: "#94a3b8", bg: "#f8fafc", border: "#f1f5f9" },
  };
  const { icon: Icon, color, bg, border } = configs[status];

  return (
    <div
      className="flex-1 min-w-0 rounded-2xl p-4"
      style={{ background: bg, border: `1px solid ${border}` }}
    >
      <Icon className="w-5 h-5 mb-2" style={{ color }} />
      <p className="text-sm font-semibold text-slate-800 leading-tight">{label}</p>
      <p className="text-xs mt-0.5 leading-snug" style={{ color: status === "ok" ? "#059669" : status === "partial" ? "#d97706" : "#94a3b8" }}>
        {sublabel}
      </p>
    </div>
  );
}

// ── InicioPage ───────────────────────────────────────────────────────────────

export function InicioPage() {
  const [, navigate] = useLocation();
  const user = getUser();
  const token = getToken();
  const [data, setData] = useState<HomeData>({ companies: [], documents: [], hasMonitor: false, alerts: [] });
  const [loading, setLoading] = useState(true);

  const firstName = user?.name?.split(" ")[0] ?? "você";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";

  useEffect(() => {
    async function load() {
      if (!token) return;
      const h = { Authorization: `Bearer ${token}` };

      try {
        const [companiesRes, monitorsRes, alertsRes] = await Promise.all([
          fetch("/api/companies", { headers: h }),
          fetch("/api/monitors", { headers: h }),
          fetch("/api/monitors/alerts?limit=6", { headers: h }),
        ]);

        const companies: Company[] = companiesRes.ok ? await companiesRes.json() : [];
        const monitors: unknown[] = monitorsRes.ok ? await monitorsRes.json() : [];
        const alerts: MonitorAlert[] = alertsRes.ok ? await alertsRes.json() : [];

        let documents: CompanyDoc[] = [];
        if (companies.length > 0) {
          const detailRes = await fetch(`/api/companies/${companies[0].id}`, { headers: h });
          if (detailRes.ok) {
            const detail = await detailRes.json();
            documents = Array.isArray(detail.documents) ? detail.documents : [];
          }
        }

        setData({ companies, documents, hasMonitor: monitors.length > 0, alerts });
      } catch {}

      setLoading(false);
    }
    load();
  }, [token]);

  const readiness = loading ? 0 : computeReadiness(data);
  const nextAction = computeNextAction(data);
  const recentAlerts = data.alerts.slice(0, 4);

  // Company status items
  const hasCompany = data.companies.length > 0;
  const docsCount = data.documents.length;

  return (
    <AppLayout>
      <div className="max-w-[680px] mx-auto px-5 sm:px-8 py-8 sm:py-12">

        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <div
          className="bg-white rounded-3xl p-6 sm:p-8 mb-6"
          style={{ border: "1px solid #f1f5f9" }}
        >
          <div className="flex items-start gap-6">
            {/* Progress ring */}
            <div className="relative flex-shrink-0">
              <ProgressRing score={readiness} size={88} />
              <div className="absolute inset-0 flex items-center justify-center">
                <span
                  className="text-base font-bold"
                  style={{ color: readinessColor(readiness) }}
                >
                  {readiness}%
                </span>
              </div>
            </div>

            {/* Text */}
            <div className="flex-1 min-w-0 pt-1">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">
                {greeting}, {firstName}
              </p>
              <h1
                className="text-xl sm:text-2xl font-bold text-slate-900 mb-1.5 leading-tight"
                style={{ fontFamily: "'Manrope', sans-serif", letterSpacing: "-0.02em" }}
              >
                Seu caminho para vender ao governo começa aqui.
              </h1>
              <div className="flex items-center gap-2">
                <span
                  className="text-xs font-semibold px-2.5 py-1 rounded-full"
                  style={{
                    background: `${readinessColor(readiness)}18`,
                    color: readinessColor(readiness),
                  }}
                >
                  {readinessLabel(readiness)}
                </span>
                {readiness < 100 && (
                  <button
                    onClick={() => navigate("/comecar")}
                    className="text-xs text-slate-400 hover:text-slate-700 transition-colors flex items-center gap-0.5"
                  >
                    Ver passo a passo <ChevronRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Próxima ação ──────────────────────────────────────────────── */}
        {!loading && (
          <div className="mb-6">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">
              Próximo passo
            </p>
            <div
              className="bg-white rounded-3xl p-6 sm:p-7"
              style={{ border: "1px solid #f1f5f9", borderLeft: `4px solid ${nextAction.color}` }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                style={{ background: nextAction.bg }}
              >
                <nextAction.icon className="w-5 h-5" style={{ color: nextAction.color }} />
              </div>

              <h2
                className="text-lg sm:text-xl font-bold text-slate-900 mb-2"
                style={{ fontFamily: "'Manrope', sans-serif", letterSpacing: "-0.01em" }}
              >
                {nextAction.title}
              </h2>

              <p className="text-sm text-slate-500 leading-relaxed mb-5">
                {nextAction.reason}
              </p>

              <button
                onClick={() => navigate(nextAction.href)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-150 hover:opacity-90 active:scale-95"
                style={{ background: nextAction.color }}
              >
                {nextAction.cta}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ── Situação da empresa ───────────────────────────────────────── */}
        {!loading && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
                Situação da empresa
              </p>
              {hasCompany && (
                <button
                  onClick={() => navigate(`/companies/${data.companies[0].id}`)}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Ver detalhes →
                </button>
              )}
            </div>
            <div className="flex gap-3">
              <StatusItem
                label="Cadastro"
                sublabel={hasCompany ? `${data.companies[0].nomeFantasia ?? data.companies[0].razaoSocial ?? "Empresa cadastrada"}` : "Empresa não cadastrada"}
                status={hasCompany ? "ok" : "missing"}
              />
              <StatusItem
                label="Documentos"
                sublabel={
                  docsCount === 0
                    ? "Nenhum enviado ainda"
                    : docsCount === 1
                    ? "1 documento enviado"
                    : `${docsCount} documentos enviados`
                }
                status={docsCount >= 3 ? "ok" : docsCount >= 1 ? "partial" : "missing"}
              />
              <StatusItem
                label="Alertas"
                sublabel={data.hasMonitor ? "Monitorando editais" : "Alertas não configurados"}
                status={data.hasMonitor ? "ok" : "missing"}
              />
            </div>
          </div>
        )}

        {/* ── Oportunidades recomendadas ────────────────────────────────── */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
              Oportunidades recentes
            </p>
            {recentAlerts.length > 0 && (
              <button
                onClick={() => navigate("/monitors")}
                className="text-xs text-blue-600 hover:underline"
              >
                Ver todos →
              </button>
            )}
          </div>

          {loading ? (
            <div className="bg-white rounded-3xl p-6 animate-pulse" style={{ border: "1px solid #f1f5f9" }}>
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-4 rounded bg-slate-100" style={{ width: i === 1 ? "80%" : i === 2 ? "65%" : "72%" }} />
                ))}
              </div>
            </div>
          ) : recentAlerts.length === 0 ? (
            <div
              className="bg-white rounded-3xl p-8 text-center"
              style={{ border: "1px solid #f1f5f9" }}
            >
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{ background: "#eff6ff" }}
              >
                <Bell className="w-5 h-5 text-blue-400" />
              </div>
              <p className="text-sm font-semibold text-slate-700 mb-1">
                Nenhuma oportunidade ainda
              </p>
              <p className="text-xs text-slate-400 leading-relaxed mb-4 max-w-xs mx-auto">
                Configure alertas com palavras-chave do seu negócio e o sistema vai encontrar editais para você automaticamente.
              </p>
              <button
                onClick={() => navigate("/monitors")}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:underline"
              >
                Configurar alertas <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-3xl overflow-hidden" style={{ border: "1px solid #f1f5f9" }}>
              {recentAlerts.map((alert, i) => {
                const place = [alert.municipio, alert.uf].filter(Boolean).join(", ");
                const modality = simplifyModalidade(alert.modalidade);

                return (
                  <div
                    key={alert.id}
                    className="group flex items-start gap-4 px-5 py-4 cursor-pointer transition-colors hover:bg-slate-50/80"
                    style={{ borderTop: i > 0 ? "1px solid #f8fafc" : undefined }}
                    onClick={() => alert.urlPncp && window.open(alert.urlPncp, "_blank")}
                  >
                    {/* Unread dot */}
                    <div className="flex-shrink-0 mt-1.5">
                      {!alert.isRead ? (
                        <span className="w-2 h-2 rounded-full bg-blue-500 block" />
                      ) : (
                        <span className="w-2 h-2 rounded-full bg-slate-200 block" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 leading-snug line-clamp-2">
                        {alert.titulo}
                      </p>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1">
                        <span
                          className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                          style={{ background: "#f1f5f9", color: "#64748b" }}
                        >
                          {modality}
                        </span>
                        {place && (
                          <span className="text-[11px] text-slate-400 flex items-center gap-0.5">
                            <MapPin className="w-2.5 h-2.5" />
                            {place}
                          </span>
                        )}
                      </div>
                    </div>

                    <ExternalLink className="w-3.5 h-3.5 text-slate-300 flex-shrink-0 mt-1 group-hover:text-slate-500 transition-colors" />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Guias rápidos ─────────────────────────────────────────────── */}
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">
            Aprenda como funciona
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              {
                icon: FileText,
                color: "#2563eb",
                bg: "#eff6ff",
                title: "Como emitir certidões",
                sub: "Quais são, onde tirar e por quanto tempo valem",
                href: "/guias",
              },
              {
                icon: Zap,
                color: "#d97706",
                bg: "#fffbeb",
                title: "Como funciona o pregão",
                sub: "O tipo mais comum de licitação explicado passo a passo",
                href: "/guias",
              },
              {
                icon: Compass,
                color: "#7c3aed",
                bg: "#f5f3ff",
                title: "Participar pela primeira vez",
                sub: "Um guia completo para quem nunca participou",
                href: "/comecar",
              },
            ].map(({ icon: Icon, color, bg, title, sub, href }) => (
              <button
                key={title}
                onClick={() => navigate(href)}
                className="group text-left bg-white rounded-2xl p-4 transition-all duration-150 hover:shadow-sm"
                style={{ border: "1px solid #f1f5f9" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = `${color}30`; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#f1f5f9"; }}
              >
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center mb-3"
                  style={{ background: bg }}
                >
                  <Icon className="w-4 h-4" style={{ color }} />
                </div>
                <p className="text-xs font-semibold text-slate-800 leading-snug mb-1">{title}</p>
                <p className="text-[11px] text-slate-400 leading-snug">{sub}</p>
              </button>
            ))}
          </div>
        </div>

      </div>
    </AppLayout>
  );
}

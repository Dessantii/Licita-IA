import React, { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { getUser, getToken } from "@/hooks/use-auth";
import {
  Building2, FileText, Bell, ArrowRight, ChevronRight,
  CheckCircle2, AlertCircle, Circle, Sparkles,
  Compass, Zap, Clock,
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
  titulo: string;
  dataValidade: string | null;
  validade?: string | null;
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

// ── Expiry helpers ───────────────────────────────────────────────────────────

function daysUntilExpiry(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(dateStr);
  return Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function expiryColor(days: number): { color: string; bg: string; border: string } {
  if (days <= 0) return { color: "#DC2626", bg: "#FEF2F2", border: "#FECACA" };
  if (days <= 3) return { color: "#DC2626", bg: "#FEF2F2", border: "#FECACA" };
  if (days <= 7) return { color: "#EA580C", bg: "#FFF7ED", border: "#FED7AA" };
  if (days <= 15) return { color: "#D97706", bg: "#FFFBEB", border: "#FDE68A" };
  return { color: "#0891B2", bg: "#F0F9FF", border: "#BAE6FD" };
}

function expiryLabel(days: number): string {
  if (days <= 0) return "Vencida";
  if (days === 1) return "Vence amanhã";
  return `Vence em ${days} dias`;
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

// ── Doc expiry widget ─────────────────────────────────────────────────────────

function DocExpiryWidget({
  docs,
  companyId,
  onNavigate,
}: {
  docs: CompanyDoc[];
  companyId: number;
  onNavigate: (href: string) => void;
}) {
  const expiring = docs
    .filter(d => d.dataValidade)
    .map(d => ({ ...d, days: daysUntilExpiry(d.dataValidade!) }))
    .filter(d => d.days <= 30)
    .sort((a, b) => a.days - b.days);

  if (expiring.length === 0) return null;

  return (
    <div className="mb-7">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4" style={{ color: "#EA580C" }} />
          <h2 className="text-base font-bold text-slate-900">Documentos vencendo em breve</h2>
        </div>
        <button
          onClick={() => onNavigate(`/companies/${companyId}`)}
          className="text-sm font-medium flex items-center gap-1.5"
          style={{ color: "#0066FF" }}
        >
          Ver todos <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      <div
        className="bg-white rounded-xl overflow-hidden"
        style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.07)" }}
      >
        {expiring.map((doc, i) => {
          const { color, bg, border } = expiryColor(doc.days);
          return (
            <div
              key={doc.id}
              className="flex items-center gap-4 px-5 py-4"
              style={{
                borderBottom: i < expiring.length - 1 ? "1px solid #F1F5F9" : undefined,
              }}
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: bg, border: `1px solid ${border}` }}
              >
                <Clock className="w-4 h-4" style={{ color }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate">
                  {doc.titulo || doc.tipo}
                </p>
              </div>
              <span
                className="text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0"
                style={{ color, background: bg }}
              >
                {expiryLabel(doc.days)}
              </span>
              <button
                onClick={() => onNavigate(`/companies/${companyId}`)}
                className="text-xs font-semibold flex-shrink-0"
                style={{ color: "#0066FF" }}
              >
                Renovar →
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
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

// ── HomeStatCard ─────────────────────────────────────────────────────────────

function HomeStatCard({
  title, value, icon: Icon, iconColor, iconBg,
}: {
  title: string; value: string; icon: React.ElementType; iconColor: string; iconBg: string;
}) {
  return (
    <div className="bg-white p-6 rounded-xl flex items-center justify-between" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.07)' }}>
      <div>
        <p className="text-sm font-medium text-slate-500 mb-1">{title}</p>
        <p className="text-2xl font-bold text-slate-900 tracking-tight leading-none">{value}</p>
      </div>
      <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0" style={{ backgroundColor: iconBg }}>
        <Icon className="w-6 h-6" style={{ color: iconColor }} />
      </div>
    </div>
  );
}

// ── HomeStepItem ──────────────────────────────────────────────────────────────

function HomeStepItem({
  label, sub, done, partial,
}: {
  label: string; sub: string; done: boolean; partial?: boolean;
}) {
  return (
    <div className="flex items-center gap-4" style={{ opacity: done || partial ? 1 : 0.5 }}>
      {done ? (
        <CheckCircle2 className="w-5 h-5 shrink-0" style={{ color: '#10b981' }} />
      ) : partial ? (
        <AlertCircle className="w-5 h-5 shrink-0" style={{ color: '#f59e0b' }} />
      ) : (
        <Circle className="w-5 h-5 shrink-0 text-slate-300" />
      )}
      <div>
        <p className="text-sm font-semibold text-slate-900">{label}</p>
        <p className="text-xs text-slate-500">{sub}</p>
      </div>
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

  const hasCompany = data.companies.length > 0;
  const docsCount = data.documents.length;

  return (
    <AppLayout>
      <div className="px-8 py-8">

        {/* ── Page Header ──────────────────────────────────────────────── */}
        <div className="mb-8">
          <div className="flex items-center gap-1 text-sm mb-2" style={{ color: '#94a3b8' }}>
            LicitaIA <ChevronRight className="w-3.5 h-3.5" /> Início
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            {greeting}, {firstName}
          </h1>
        </div>

        {/* ── Stat Cards ───────────────────────────────────────────────── */}
        {!loading && (
          <div className="grid grid-cols-3 gap-5 mb-7">
            <HomeStatCard
              title="Empresa"
              value={hasCompany ? (data.companies[0].nomeFantasia ?? data.companies[0].razaoSocial ?? "Cadastrada") : "Não cadastrada"}
              icon={Building2}
              iconColor="#0066FF"
              iconBg="#E5F0FF"
            />
            <HomeStatCard
              title="Documentos enviados"
              value={String(docsCount)}
              icon={FileText}
              iconColor="#635BFF"
              iconBg="#EFEFFF"
            />
            <HomeStatCard
              title="Editais novos"
              value={String(data.alerts.filter((a) => !a.isRead).length)}
              icon={Bell}
              iconColor="#00A389"
              iconBg="#E5F6F3"
            />
          </div>
        )}

        {/* ── Main Grid: Progress + Next Action ────────────────────────── */}
        <div className="grid grid-cols-12 gap-6 mb-7">

          {/* Progress Card */}
          <div className="col-span-7 bg-white rounded-xl p-7" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.07)' }}>
            <div className="flex items-end justify-between mb-5">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Situação da empresa</h2>
                <p className="text-sm text-slate-500 mt-1">Seu nível de prontidão para licitar</p>
              </div>
              <div className="text-3xl font-bold tracking-tight" style={{ color: '#0066FF' }}>
                {loading ? "—" : `${readiness}%`}
              </div>
            </div>

            <div className="w-full bg-slate-100 h-2 rounded-full mb-7 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-1000"
                style={{ width: loading ? '0%' : `${readiness}%`, backgroundColor: '#0066FF' }}
              />
            </div>

            <div className="flex flex-col gap-4">
              <HomeStepItem
                label="Cadastro da empresa"
                sub={hasCompany ? `${data.companies[0].nomeFantasia ?? data.companies[0].razaoSocial ?? "Empresa cadastrada"}` : "Empresa ainda não cadastrada"}
                done={hasCompany}
              />
              <HomeStepItem
                label="Documentos enviados"
                sub={docsCount === 0 ? "Nenhum enviado ainda" : docsCount === 1 ? "1 documento enviado" : `${docsCount} documentos enviados`}
                done={docsCount >= 3}
                partial={docsCount > 0 && docsCount < 3}
              />
              <HomeStepItem
                label="Alertas configurados"
                sub={data.hasMonitor ? "Monitorando editais automaticamente" : "Configure para receber alertas"}
                done={data.hasMonitor}
              />
            </div>
          </div>

          {/* Next Action Card */}
          <div className="col-span-5">
            <div className="bg-white rounded-xl h-full" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.07)' }}>
              <div className="p-6 h-full flex flex-col rounded-xl" style={{ background: 'linear-gradient(180deg, #F8FAFF 0%, #FFFFFF 60%)' }}>
                <div className="text-xs font-semibold uppercase tracking-widest mb-5 flex items-center gap-2" style={{ color: '#94a3b8' }}>
                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#0066FF' }} />
                  Próximo passo
                </div>

                {loading ? (
                  <div className="flex-1 animate-pulse space-y-4">
                    <div className="h-11 w-11 rounded-full bg-slate-100" />
                    <div className="h-5 rounded bg-slate-100 w-3/4" />
                    <div className="h-4 rounded bg-slate-100 w-full" />
                    <div className="h-4 rounded bg-slate-100 w-5/6" />
                  </div>
                ) : (
                  <>
                    <div
                      className="w-11 h-11 rounded-full mb-4 flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: nextAction.bg }}
                    >
                      <nextAction.icon className="w-5 h-5" style={{ color: nextAction.color }} />
                    </div>

                    <h3 className="text-lg font-bold text-slate-900 mb-2">{nextAction.title}</h3>
                    <p className="text-sm text-slate-600 leading-relaxed flex-1 mb-6">{nextAction.reason}</p>

                    <button
                      onClick={() => navigate(nextAction.href)}
                      className="w-full py-3 rounded-xl text-white font-semibold flex items-center justify-center gap-2 text-sm transition-all hover:opacity-90 active:scale-95"
                      style={{ backgroundColor: '#0066FF', boxShadow: '0 4px 12px rgba(0,102,255,0.25)' }}
                    >
                      {nextAction.cta}
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Documentos vencendo ──────────────────────────────────────── */}
        {!loading && data.companies.length > 0 && (
          <DocExpiryWidget
            docs={data.documents}
            companyId={data.companies[0].id}
            onNavigate={navigate}
          />
        )}

        {/* ── Oportunidades recentes ────────────────────────────────────── */}
        <div className="mb-7">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-slate-900">Oportunidades recentes</h2>
            {recentAlerts.length > 0 && (
              <button
                onClick={() => navigate("/monitors")}
                className="text-sm font-medium flex items-center gap-1.5"
                style={{ color: '#0066FF' }}
              >
                Ver todas <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {loading ? (
            <div className="grid gap-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white rounded-xl h-[72px] animate-pulse" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }} />
              ))}
            </div>
          ) : recentAlerts.length === 0 ? (
            <div className="bg-white rounded-xl p-10 text-center" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: '#E5F0FF' }}>
                <Bell className="w-5 h-5" style={{ color: '#0066FF' }} />
              </div>
              <p className="text-sm font-semibold text-slate-700 mb-1">Nenhuma oportunidade ainda</p>
              <p className="text-xs text-slate-400 leading-relaxed mb-4 max-w-xs mx-auto">
                Configure alertas com palavras-chave do seu negócio e o sistema vai encontrar editais para você automaticamente.
              </p>
              <button
                onClick={() => navigate("/monitors")}
                className="inline-flex items-center gap-1.5 text-sm font-semibold"
                style={{ color: '#0066FF' }}
              >
                Configurar alertas <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="grid gap-3">
              {recentAlerts.map((alert) => {
                const place = [alert.municipio, alert.uf].filter(Boolean).join(", ");
                const modality = simplifyModalidade(alert.modalidade);
                const isPregao = alert.modalidade?.toLowerCase().includes("pregão");
                const accentColor = isPregao ? '#635BFF' : '#00A389';
                return (
                  <div
                    key={alert.id}
                    className="bg-white rounded-xl overflow-hidden flex cursor-pointer transition-shadow hover:shadow-md"
                    style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
                    onClick={() => alert.urlPncp && window.open(alert.urlPncp, "_blank")}
                  >
                    <div className="w-1.5 shrink-0" style={{ backgroundColor: accentColor }} />
                    <div className="p-5 flex-1 min-w-0">
                      <div className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: accentColor }}>
                        {modality}
                      </div>
                      <p className="text-sm text-slate-500 mb-0.5 truncate">{alert.orgao}</p>
                      <p className="text-base font-bold text-slate-900 leading-snug line-clamp-1">{alert.titulo}</p>
                    </div>
                    <div
                      className="px-5 border-l border-slate-100 flex flex-col items-end justify-center gap-1 shrink-0"
                      style={{ minWidth: '140px', backgroundColor: '#FAFBFC' }}
                    >
                      {place && <p className="text-xs text-slate-400">{place}</p>}
                      <span className="text-xs font-semibold" style={{ color: '#0066FF' }}>Ver edital →</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Aprenda como funciona ─────────────────────────────────────── */}
        <div>
          <h2 className="text-lg font-bold text-slate-900 mb-5">Aprenda como funciona</h2>
          <div className="grid grid-cols-3 gap-4">
            {[
              {
                icon: FileText,
                color: "#0066FF",
                bg: "#E5F0FF",
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
                className="group text-left bg-white rounded-xl p-5 transition-all hover:shadow-md"
                style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: bg }}>
                  <Icon className="w-5 h-5" style={{ color }} />
                </div>
                <p className="text-sm font-bold text-slate-800 leading-snug mb-1">{title}</p>
                <p className="text-xs text-slate-400 leading-snug">{sub}</p>
              </button>
            ))}
          </div>
        </div>

      </div>
    </AppLayout>
  );
}

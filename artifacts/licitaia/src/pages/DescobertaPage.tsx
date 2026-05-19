import { useState, useMemo, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useLocation } from "wouter";
import { useActiveCompany } from "@/contexts/CompanyContext";
import { getToken } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { format, differenceInDays, parseISO, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Search, ExternalLink, Gavel, Timer, Building2, Star, ChevronRight,
  Loader2, RefreshCw, SlidersHorizontal, TrendingUp, Clock, Sparkles,
  Target, AlertTriangle, ArrowRight, MapPin, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const API = import.meta.env.VITE_API_URL ?? "";

// ── Category detection ───────────────────────────────────────────────────────

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  transporte: ["seguro", "veículo", "veiculo", "combustível", "combustivel", "frete", "frota", "veicular", "automóvel", "automovel"],
  escritorio: ["escritório", "escritorio", "papel", "caneta", "impressora", "toner", "mobiliário", "mobiliario", "cadeira", "copos descartáveis"],
  limpeza: ["limpeza", "higiene", "conservação", "conservacao", "zeladoria", "dedetização", "varrição"],
  alimentacao: ["alimento", "alimentação", "alimentacao", "refeição", "refeicao", "coffee break", "merenda", "gênero alimentício", "genero alimenticio", "café", "lanches"],
  saude: ["saúde", "saude", "médico", "medico", "farmácia", "farmacia", "medicamento", "hospital", "clínica", "clinica", "odontológico", "odontologico"],
  ti: ["software", " ti ", "tecnologia da informação", "computador", "internet", "sistema", "informática", "informatica", "rede", "servidor", "hardware"],
  construcao: ["obra", "construção", "construcao", "reforma", "pavimentação", "pavimentacao", "instalação elétrica", "instalacao eletrica"],
  seguranca: ["vigilância", "vigilancia", "segurança patrimonial", "portaria", "epi", "monitoramento eletrônico"],
  educacao: ["treinamento", "capacitação", "capacitacao", "curso", "educação", "educacao", "material didático"],
};

const CATEGORY_LABELS: Record<string, string> = {
  transporte: "Transporte",
  escritorio: "Escritório",
  limpeza: "Limpeza",
  alimentacao: "Alimentação",
  saude: "Saúde",
  ti: "Tecnologia",
  construcao: "Construção",
  seguranca: "Segurança",
  educacao: "Educação",
  outros: "Outros",
};

export const SUPPLY_CATEGORIES = [
  { value: "ti", label: "Tecnologia (TI)" },
  { value: "alimentacao", label: "Alimentação" },
  { value: "limpeza", label: "Limpeza e Conservação" },
  { value: "saude", label: "Saúde" },
  { value: "construcao", label: "Construção e Obras" },
  { value: "transporte", label: "Transporte" },
  { value: "educacao", label: "Educação e Treinamento" },
  { value: "escritorio", label: "Material de Escritório" },
  { value: "seguranca", label: "Segurança" },
  { value: "outros", label: "Outros" },
];

function detectCategory(titulo: string): string {
  const t = titulo.toLowerCase();
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(k => t.includes(k))) return cat;
  }
  return "outros";
}

function isMepppTitle(titulo: string): boolean {
  const t = titulo.toLowerCase();
  return /(exclusivo me|reservado me|exclusivo epp|me\/epp|microempresa|exclusivo para|cota reservada)/.test(t);
}

// ── Scoring ──────────────────────────────────────────────────────────────────

interface ScoredAlert {
  id: number;
  titulo: string;
  modalidade?: string;
  orgao?: string;
  municipio?: string;
  uf?: string;
  dataPublicacao?: string;
  urlPncp?: string;
  pncpId?: string;
  isRead: boolean;
  valorEstimado?: string;
  createdAt: string;
  // computed
  score: number;
  scoreLabel: string;
  scoreColor: string;
  scoreBg: string;
  category: string;
  isMepppExclusive: boolean;
  isNew: boolean;
}

interface BiddingProfile {
  categories?: string[];
  operationRadius?: "municipio" | "estado" | "nacional";
  maxContractValue?: number;
  hasPriorExperience?: boolean;
}

interface Company {
  id: number;
  porte?: string;
  municipio?: string;
  uf?: string;
  biddingProfile?: BiddingProfile;
}

function calcScore(
  alert: Omit<ScoredAlert, "score" | "scoreLabel" | "scoreColor" | "scoreBg" | "category" | "isMepppExclusive" | "isNew">,
  company: Company | null,
  profile: BiddingProfile
): number {
  let total = 0;

  const category = detectCategory(alert.titulo);

  // Category match: 35pts
  const userCats = profile.categories ?? [];
  if (userCats.length > 0) {
    if (userCats.includes(category)) total += 35;
    else if (category === "outros") total += 5;
  } else {
    total += 15; // neutral when no profile
  }

  // Location: 20pts
  if (company?.municipio && alert.municipio && company.municipio.toLowerCase() === alert.municipio.toLowerCase()) {
    total += 20;
  } else if (company?.uf && alert.uf && company.uf === alert.uf) {
    total += 12;
  } else {
    total += 5;
  }

  // Contract value: 20pts
  const maxVal = profile.maxContractValue;
  const alertVal = alert.valorEstimado ? parseFloat(alert.valorEstimado) : null;
  if (alertVal !== null && maxVal) {
    if (alertVal <= maxVal) total += 20;
    else if (alertVal <= maxVal * 2) total += 10;
    else total += 0;
  } else {
    total += 10; // neutral when no data
  }

  // Recency (proxy for deadline since we don't store prazo): 15pts
  const daysSince = differenceInDays(new Date(), new Date(alert.createdAt));
  if (daysSince <= 2) total += 15;
  else if (daysSince <= 5) total += 10;
  else if (daysSince <= 10) total += 6;
  else total += 2;

  // ME/EPP experience: 10pts
  if (profile.hasPriorExperience) total += 5;
  const isMeppp = ["ME", "EPP", "MEI"].some(p => company?.porte?.toUpperCase().includes(p) ?? false);
  if (isMeppp && isMepppTitle(alert.titulo)) total += 5;

  return Math.min(100, total);
}

function getScoreInfo(score: number): { label: string; color: string; bg: string; dot: string } {
  if (score >= 75) return { label: "Excelente", color: "#059669", bg: "#F0FDF4", dot: "bg-green-500" };
  if (score >= 50) return { label: "Bom", color: "#D97706", bg: "#FFFBEB", dot: "bg-yellow-500" };
  if (score >= 25) return { label: "Baixo", color: "#EA580C", bg: "#FFF7ED", dot: "bg-orange-500" };
  return { label: "Descartável", color: "#DC2626", bg: "#FEF2F2", dot: "bg-red-400" };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function deadlineBadge(createdAt: string) {
  const daysSince = differenceInDays(new Date(), new Date(createdAt));
  if (daysSince <= 2) return { label: "Recente", color: "bg-blue-50 text-blue-700" };
  if (daysSince <= 7) return { label: `${daysSince}d atrás`, color: "bg-slate-100 text-slate-500" };
  return { label: `${daysSince}d atrás`, color: "bg-slate-100 text-slate-400" };
}

// ── Main Component ────────────────────────────────────────────────────────────

type Filter = "todas" | "excelentes" | "boas" | "baixo";

export function DescobertaPage() {
  const [, navigate] = useLocation();
  const { activeCompany } = useActiveCompany();
  const token = getToken();

  const [alerts, setAlerts] = useState<any[]>([]);
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("todas");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const LIMIT = 50;

  const loadAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: String(LIMIT), page: String(page) });
      const res = await fetch(`${API}/api/monitors/portal?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setAlerts(data.data ?? []);
      setTotal(data.total ?? 0);
    } catch {
    } finally {
      setLoading(false);
    }
  }, [token, page]);

  const loadCompany = useCallback(async () => {
    if (!activeCompany?.id) return;
    try {
      const res = await fetch(`${API}/api/companies/${activeCompany.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setCompany(data);
    } catch {}
  }, [activeCompany?.id, token]);

  useEffect(() => { loadAlerts(); }, [loadAlerts]);
  useEffect(() => { loadCompany(); }, [loadCompany]);

  const profile: BiddingProfile = (company?.biddingProfile as BiddingProfile) ?? {};
  const hasProfile = (profile.categories?.length ?? 0) > 0 || !!profile.operationRadius;
  const isMepppCompany = ["ME", "EPP", "MEI"].some(p => company?.porte?.toUpperCase().includes(p) ?? false);

  const scored: ScoredAlert[] = useMemo(() => {
    return alerts.map(a => {
      const score = calcScore(a, company, profile);
      const info = getScoreInfo(score);
      const daysSince = differenceInDays(new Date(), new Date(a.createdAt));
      return {
        ...a,
        score,
        scoreLabel: info.label,
        scoreColor: info.color,
        scoreBg: info.bg,
        category: detectCategory(a.titulo),
        isMepppExclusive: isMepppTitle(a.titulo) || (isMepppCompany && parseFloat(a.valorEstimado ?? "999999") <= 80000),
        isNew: daysSince <= 2,
      };
    }).sort((a, b) => b.score - a.score);
  }, [alerts, company, profile]);

  const filtered = useMemo(() => {
    let result = scored;
    if (filter === "excelentes") result = result.filter(a => a.score >= 75);
    else if (filter === "boas") result = result.filter(a => a.score >= 50 && a.score < 75);
    else if (filter === "baixo") result = result.filter(a => a.score < 50);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(a =>
        a.titulo.toLowerCase().includes(q) ||
        (a.orgao?.toLowerCase().includes(q) ?? false) ||
        (a.municipio?.toLowerCase().includes(q) ?? false)
      );
    }
    return result;
  }, [scored, filter, search]);

  const stats = useMemo(() => ({
    total: scored.length,
    excelentes: scored.filter(a => a.score >= 75).length,
    boas: scored.filter(a => a.score >= 50).length,
    novas: scored.filter(a => a.isNew).length,
    meppp: scored.filter(a => a.isMepppExclusive).length,
  }), [scored]);

  function handleIniciarProcesso(alert: ScoredAlert) {
    sessionStorage.setItem("licitaia_alert_prefill", JSON.stringify({
      title: alert.titulo,
      agency: alert.orgao ?? "",
      modality: alert.modalidade ?? "",
      source: alert.urlPncp ?? "",
    }));
    navigate("/processes");
  }

  return (
    <AppLayout>
      <div className="px-6 lg:px-8 py-8 max-w-5xl">

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-1 text-xs mb-2 font-medium" style={{ color: '#94a3b8' }}>
            LicitaIA <ChevronRight className="w-3 h-3" /> Oportunidades
          </div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Oportunidades para você</h1>
              <p className="text-sm text-slate-500 mt-1">
                Editais do PNCP ranqueados pelo quanto combinam com sua empresa.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={loadAlerts}
              className="gap-2"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Atualizar
            </Button>
          </div>
        </div>

        {/* Onboarding banner */}
        {!loading && !hasProfile && (
          <div
            className="rounded-2xl p-5 mb-6 flex items-start gap-4"
            style={{ background: 'linear-gradient(135deg, #EFF6FF 0%, #F0F4FF 100%)', border: '1px solid #DBEAFE' }}
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#E5F0FF' }}>
              <Target className="w-5 h-5" style={{ color: '#0066FF' }} />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-slate-800 text-sm mb-1">Receba só o que é relevante para você</p>
              <p className="text-xs text-slate-600 leading-relaxed">
                Configure o perfil licitatório da sua empresa e o LicitaIA filtra automaticamente as melhores oportunidades. Sem spam, sem ruído.
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => navigate("/companies")}
              style={{ background: '#0066FF' }}
              className="text-white hover:opacity-90 flex-shrink-0 gap-1.5"
            >
              Configurar agora
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}

        {/* Stats row */}
        {!loading && scored.length > 0 && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            {[
              { label: "Total encontrado", value: stats.total, icon: Gavel, color: "#64748b", bg: "#F8FAFC" },
              { label: "Novas hoje", value: stats.novas, icon: Sparkles, color: "#0066FF", bg: "#EFF6FF" },
              { label: "Excelentes para você", value: stats.excelentes, icon: TrendingUp, color: "#059669", bg: "#F0FDF4" },
              { label: "Exclusivas ME/EPP", value: stats.meppp, icon: Star, color: "#D97706", bg: "#FFFBEB" },
            ].map(s => (
              <div key={s.label} className="rounded-xl p-4 flex items-center gap-3" style={{ background: s.bg, border: '1px solid #E8EFF6' }}>
                <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,255,255,0.8)' }}>
                  <s.icon className="w-4 h-4" style={{ color: s.color }} />
                </div>
                <div>
                  <p className="text-xl font-bold text-slate-900">{s.value}</p>
                  <p className="text-[11px] text-slate-500 font-medium leading-tight">{s.label}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Filter pills + search */}
        {!loading && scored.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mb-5">
            {([
              { key: "todas", label: "Todas" },
              { key: "excelentes", label: "🟢 Excelentes" },
              { key: "boas", label: "🟡 Boas" },
              { key: "baixo", label: "🟠 Baixo match" },
            ] as { key: Filter; label: string }[]).map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-semibold transition-all",
                  filter === f.key
                    ? "bg-slate-900 text-white"
                    : "bg-white border border-slate-200 text-slate-600 hover:border-slate-400"
                )}
              >
                {f.label}
              </button>
            ))}

            <div className="relative ml-auto">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar oportunidade..."
                className="pl-8 pr-8 py-1.5 text-xs border border-slate-200 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 bg-white w-52"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-20">
            <Loader2 className="w-7 h-7 animate-spin text-blue-500" />
          </div>
        )}

        {/* Empty state */}
        {!loading && scored.length === 0 && (
          <div className="text-center py-20 bg-white rounded-2xl border-2 border-dashed border-slate-200">
            <Gavel className="w-12 h-12 text-slate-200 mx-auto mb-3" />
            <p className="font-semibold text-slate-700">Nenhum edital encontrado</p>
            <p className="text-sm text-slate-500 mt-1 max-w-xs mx-auto">
              Configure um monitor de alertas para o LicitaIA buscar editais novos a cada 2 horas.
            </p>
            <Button
              onClick={() => navigate("/monitors")}
              className="mt-4 gap-2"
              style={{ background: '#0066FF' }}
            >
              Configurar monitores
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}

        {/* No filter results */}
        {!loading && scored.length > 0 && filtered.length === 0 && (
          <div className="text-center py-12 bg-white rounded-2xl border border-slate-200">
            <Search className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="font-semibold text-slate-700">Nenhuma oportunidade para esse filtro</p>
            <button onClick={() => { setFilter("todas"); setSearch(""); }} className="mt-2 text-sm text-blue-600 hover:underline font-semibold">
              Ver todas
            </button>
          </div>
        )}

        {/* Cards */}
        {!loading && filtered.length > 0 && (
          <div className="space-y-3">
            {filtered.map(alert => (
              <OpportunityCard
                key={alert.id}
                alert={alert}
                onIniciar={() => handleIniciarProcesso(alert)}
              />
            ))}
          </div>
        )}

      </div>
    </AppLayout>
  );
}

// ── Opportunity Card ──────────────────────────────────────────────────────────

function OpportunityCard({ alert, onIniciar }: { alert: ScoredAlert; onIniciar: () => void }) {
  const catLabel = CATEGORY_LABELS[alert.category] ?? alert.category;
  const db = deadlineBadge(alert.createdAt);

  return (
    <div
      className="bg-white rounded-2xl overflow-hidden transition-all hover:shadow-md"
      style={{ border: '1px solid #E8EFF6', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}
    >
      <div className="p-5">
        <div className="flex items-start gap-4">
          {/* Score badge */}
          <div
            className="flex-shrink-0 w-16 h-16 rounded-xl flex flex-col items-center justify-center"
            style={{ background: alert.scoreBg, border: `2px solid ${alert.scoreColor}20` }}
          >
            <span className="text-xl font-bold" style={{ color: alert.scoreColor }}>{alert.score}</span>
            <span className="text-[10px] font-semibold" style={{ color: alert.scoreColor }}>{alert.scoreLabel}</span>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Tags row */}
            <div className="flex flex-wrap items-center gap-1.5 mb-2">
              <span className="text-[11px] font-semibold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                {alert.modalidade ?? "Licitação"}
              </span>
              <span className="text-[11px] font-semibold bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">
                {catLabel}
              </span>
              {alert.isMepppExclusive && (
                <span className="text-[11px] font-bold bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Star className="w-2.5 h-2.5" /> Exclusivo ME/EPP
                </span>
              )}
              {alert.isNew && (
                <span className="text-[11px] font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                  Novo
                </span>
              )}
              <span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-full ml-auto", db.color)}>
                {db.label}
              </span>
            </div>

            {/* Title */}
            <p className="text-sm font-bold text-slate-900 leading-snug mb-2 line-clamp-2">
              {alert.titulo}
            </p>

            {/* Meta */}
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
              {alert.orgao && (
                <span className="flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-slate-400" />
                  {alert.orgao}
                </span>
              )}
              {(alert.municipio || alert.uf) && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  {[alert.municipio, alert.uf].filter(Boolean).join("/")}
                </span>
              )}
              {alert.dataPublicacao && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  Publicado em {alert.dataPublicacao}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Footer actions */}
      <div
        className="px-5 py-3 flex items-center justify-between gap-3"
        style={{ background: '#F8FAFC', borderTop: '1px solid #E8EFF6' }}
      >
        <p className="text-[11px] text-slate-400">
          {alert.score >= 75
            ? "Muito alinhado com seu perfil"
            : alert.score >= 50
            ? "Vale avaliar"
            : alert.score >= 25
            ? "Fora do seu perfil habitual"
            : "Pouco relevante para você"}
        </p>
        <div className="flex items-center gap-2">
          {alert.urlPncp && (
            <a
              href={alert.urlPncp}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Ver edital
            </a>
          )}
          <button
            onClick={onIniciar}
            className="text-xs font-semibold text-white flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all hover:opacity-90"
            style={{ background: '#0066FF' }}
          >
            <Gavel className="w-3.5 h-3.5" />
            Iniciar processo
          </button>
        </div>
      </div>
    </div>
  );
}

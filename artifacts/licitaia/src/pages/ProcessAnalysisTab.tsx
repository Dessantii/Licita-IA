import { useState, useEffect, useCallback, useRef } from "react";
import { getToken } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { format, differenceInDays, isPast, parseISO, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CheckCircle2, AlertTriangle, XCircle, Loader2, Star, Lock, Package,
  FileText, TrendingDown, Calculator, Calendar, BarChart2, ArrowRight,
  ChevronDown, ChevronUp, RefreshCw, Sparkles, Info, Shield,
  Clock, Download, Building2,
  ShieldCheck, Lightbulb, FileWarning, Copy, Check, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const API = import.meta.env.VITE_API_URL ?? "";

// ── Types ────────────────────────────────────────────────────────────────────

interface TechReq {
  description: string;
  difficulty: "easy" | "medium" | "hard";
  how_to_solve: string;
}

interface TimelineEvent {
  label: string;
  date: string;
  type: "deadline" | "session" | "visit" | "contract" | "other";
}

interface SimilarProcess {
  number?: string;
  winner?: string;
  winning_bid?: number;
  estimated?: number;
}

interface Analysis {
  id: number;
  processId: number;
  viabilityStatus: "recommended" | "caution" | "not_recommended";
  viabilityReasons: string[];
  hasFictitiousTie: boolean;
  isMepppExclusive: boolean;
  hasReservedQuota: boolean;
  reservedQuotaItems: string[];
  mepppExclusiveValue?: string;
  technicalRequirements: TechReq[];
  timelineEvents: TimelineEvent[];
  similarProcesses: SimilarProcess[];
  pricePatternInsight?: string;
  suggestedBidMin?: string;
  suggestedBidMax?: string;
  estimatedValue?: string;
  estimatedTaxesPercent?: string;
}

interface Props {
  processId: number;
  process: any;
  companyData: any;
  onGoToDocuments: () => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtBRL(value: number | string | null | undefined): string {
  const n = typeof value === "string" ? parseFloat(value) : (value ?? 0);
  if (!n || isNaN(n)) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
}

function fmtPct(value: number): string {
  return `${value.toFixed(1)}%`;
}

// ── Viability Banner ─────────────────────────────────────────────────────────

function ViabilityBanner({ status, reasons }: { status: string; reasons: string[] }) {
  const configs = {
    recommended: {
      bg: "linear-gradient(135deg, #F0FDF4 0%, #DCFCE7 100%)",
      border: "#BBF7D0",
      icon: <CheckCircle2 className="w-6 h-6" style={{ color: "#059669" }} />,
      title: "Este edital é compatível com o perfil da sua empresa",
      color: "#059669",
    },
    caution: {
      bg: "linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)",
      border: "#FDE68A",
      icon: <AlertTriangle className="w-6 h-6" style={{ color: "#D97706" }} />,
      title: "Há pontos que merecem atenção antes de decidir",
      color: "#D97706",
    },
    not_recommended: {
      bg: "linear-gradient(135deg, #FFF5F5 0%, #FEE2E2 100%)",
      border: "#FECACA",
      icon: <XCircle className="w-6 h-6" style={{ color: "#DC2626" }} />,
      title: "Este edital provavelmente não é adequado para sua empresa agora",
      color: "#DC2626",
    },
  };
  const cfg = configs[status as keyof typeof configs] ?? configs.caution;

  return (
    <div className="rounded-2xl p-6" style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}>
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 mt-0.5">{cfg.icon}</div>
        <div className="flex-1">
          <p className="font-bold text-slate-900 text-base mb-2">{cfg.title}</p>
          {reasons.length > 0 && (
            <ul className="space-y-1">
              {reasons.map((r, i) => (
                <li key={i} className="text-sm text-slate-700 flex items-start gap-1.5">
                  <span style={{ color: cfg.color }} className="mt-0.5 flex-shrink-0">•</span>
                  {r}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

// ── ME/EPP Section ───────────────────────────────────────────────────────────

function MepppSection({ analysis }: { analysis: Analysis }) {
  const estimatedNum = parseFloat(analysis.estimatedValue ?? "0");

  const cards = [
    {
      show: analysis.hasFictitiousTie,
      icon: <Star className="w-5 h-5 text-amber-500" />,
      bg: "#FFFBEB",
      border: "#FDE68A",
      title: "Empate ficto (Lei Complementar 123, Art. 44)",
      body: `Você pode cobrir qualquer proposta até 5% acima do menor lance.${estimatedNum > 0 ? ` Se o menor lance for ${fmtBRL(estimatedNum * 0.9)}, você pode cobrir até ${fmtBRL(estimatedNum * 0.9 * 1.05)}.` : ""}`,
    },
    {
      show: analysis.isMepppExclusive,
      icon: <Lock className="w-5 h-5 text-violet-500" />,
      bg: "#F5F3FF",
      border: "#DDD6FE",
      title: "Item exclusivo para ME/EPP",
      body: `O valor estimado deste edital é ${fmtBRL(analysis.mepppExclusiveValue ?? analysis.estimatedValue)}, abaixo do limite de R$ 80.000. Somente empresas ME/EPP podem participar.`,
    },
    {
      show: analysis.hasReservedQuota,
      icon: <Package className="w-5 h-5 text-blue-500" />,
      bg: "#EFF6FF",
      border: "#BFDBFE",
      title: "Cota de 25% reservada",
      body: `O edital reserva 25% dos itens exclusivamente para ME/EPP.${(analysis.reservedQuotaItems?.length ?? 0) > 0 ? ` Itens reservados: ${analysis.reservedQuotaItems.join(", ")}.` : ""}`,
    },
    {
      show: true,
      icon: <FileText className="w-5 h-5 text-green-500" />,
      bg: "#F0FDF4",
      border: "#BBF7D0",
      title: "Prazo para regularização fiscal",
      body: "Mesmo com certidões vencidas, você tem 5 dias úteis após ser declarada vencedora para regularizar sua situação fiscal antes da assinatura do contrato.",
    },
  ].filter(c => c.show);

  if (cards.length === 0) return null;

  return (
    <div>
      <h3 className="font-bold text-slate-900 text-base mb-3 flex items-center gap-2">
        <Star className="w-4 h-4 text-amber-500" />
        Benefícios ME/EPP neste edital
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {cards.map((card, i) => (
          <div key={i} className="rounded-xl p-4" style={{ background: card.bg, border: `1px solid ${card.border}` }}>
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">{card.icon}</div>
              <div>
                <p className="font-semibold text-slate-800 text-sm mb-1">{card.title}</p>
                <p className="text-xs text-slate-600 leading-relaxed">{card.body}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Technical Requirements ────────────────────────────────────────────────────

function TechRequirements({ reqs }: { reqs: TechReq[] }) {
  const [expanded, setExpanded] = useState<number | null>(null);

  const diffConfig = {
    easy: { label: "Fácil de atender", dot: "bg-green-500", bg: "#F0FDF4", text: "#059669" },
    medium: { label: "Requer atenção", dot: "bg-yellow-500", bg: "#FFFBEB", text: "#D97706" },
    hard: { label: "Pode inviabilizar", dot: "bg-red-500", bg: "#FEF2F2", text: "#DC2626" },
  };

  const grouped = {
    easy: reqs.filter(r => r.difficulty === "easy"),
    medium: reqs.filter(r => r.difficulty === "medium"),
    hard: reqs.filter(r => r.difficulty === "hard"),
  };

  return (
    <div>
      <h3 className="font-bold text-slate-900 text-base mb-3 flex items-center gap-2">
        <Shield className="w-4 h-4 text-blue-500" />
        Requisitos técnicos identificados
      </h3>
      <div className="space-y-4">
        {(["hard", "medium", "easy"] as const).map(diff => {
          const items = grouped[diff];
          if (items.length === 0) return null;
          const cfg = diffConfig[diff];
          return (
            <div key={diff}>
              <div className="flex items-center gap-2 mb-2">
                <span className={cn("w-2.5 h-2.5 rounded-full", cfg.dot)} />
                <span className="text-xs font-bold uppercase tracking-wide" style={{ color: cfg.text }}>{cfg.label}</span>
              </div>
              <div className="space-y-2">
                {items.map((req, i) => {
                  const key = `${diff}-${i}`;
                  const isOpen = expanded === i + (diff === "easy" ? 100 : diff === "medium" ? 200 : 300);
                  return (
                    <div
                      key={key}
                      className="rounded-xl overflow-hidden"
                      style={{ background: cfg.bg, border: `1px solid ${cfg.text}20` }}
                    >
                      <button
                        className="w-full px-4 py-3 flex items-start gap-3 text-left"
                        onClick={() => setExpanded(isOpen ? null : i + (diff === "easy" ? 100 : diff === "medium" ? 200 : 300))}
                      >
                        <span className="flex-1 text-sm font-semibold text-slate-800">{req.description}</span>
                        {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" /> : <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />}
                      </button>
                      {isOpen && (
                        <div className="px-4 pb-4 pt-0">
                          <div className="rounded-lg p-3 bg-white/70">
                            <p className="text-xs font-semibold text-slate-500 mb-1">Como resolver:</p>
                            <p className="text-sm text-slate-700 leading-relaxed">{req.how_to_solve}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Financial Calculator ──────────────────────────────────────────────────────

function FinancialCalculator({ estimatedValue, estimatedTaxes, isMeppp }: {
  estimatedValue?: string;
  estimatedTaxes?: string;
  isMeppp: boolean;
}) {
  const estNum = parseFloat(estimatedValue ?? "0");
  const [margin, setMargin] = useState(15);
  const [taxPct, setTaxPct] = useState(parseFloat(estimatedTaxes ?? "6") || 6);
  const [costInput, setCostInput] = useState("");
  const [fictoEnabled, setFictoEnabled] = useState(false);

  const cost = parseFloat(costInput.replace(/\./g, "").replace(",", ".") || "0");
  const combined = margin / 100 + taxPct / 100;
  const maxCostForViability = estNum > 0 ? estNum * (1 - combined) : null;
  const suggestedPrice = cost > 0 ? cost / (1 - combined) : null;
  const guaranteeAmount = estNum > 0 ? estNum * 0.05 : null;
  const fictoMax = suggestedPrice ? suggestedPrice * 1.05 : null;
  const pctBelowEstimated = suggestedPrice && estNum > 0 ? ((estNum - suggestedPrice) / estNum * 100) : null;

  return (
    <div>
      <h3 className="font-bold text-slate-900 text-base mb-3 flex items-center gap-2">
        <Calculator className="w-4 h-4 text-indigo-500" />
        Calculadora de viabilidade financeira
      </h3>
      <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #E8EFF6' }}>
        <div className="bg-white p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-slate-500 block mb-1.5">Valor estimado pelo órgão</label>
            <div className="flex items-center border border-slate-200 rounded-lg px-3 py-2 bg-slate-50">
              <span className="text-xs text-slate-400 mr-1">R$</span>
              <input
                type="number"
                className="flex-1 text-sm font-semibold text-slate-800 bg-transparent focus:outline-none"
                value={estNum || ""}
                readOnly
                placeholder="Não identificado"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 block mb-1.5">Margem mínima desejada (%)</label>
            <div className="flex items-center border border-slate-200 rounded-lg px-3 py-2 bg-white focus-within:border-blue-300 focus-within:ring-2 focus-within:ring-blue-50">
              <input
                type="number"
                className="flex-1 text-sm font-semibold text-slate-800 focus:outline-none"
                value={margin}
                onChange={e => setMargin(Math.max(0, Math.min(60, Number(e.target.value))))}
              />
              <span className="text-xs text-slate-400">%</span>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 block mb-1.5">Impostos estimados (%)</label>
            <div className="flex items-center border border-slate-200 rounded-lg px-3 py-2 bg-white focus-within:border-blue-300 focus-within:ring-2 focus-within:ring-blue-50">
              <input
                type="number"
                className="flex-1 text-sm font-semibold text-slate-800 focus:outline-none"
                value={taxPct}
                onChange={e => setTaxPct(Math.max(0, Math.min(30, Number(e.target.value))))}
              />
              <span className="text-xs text-slate-400">%</span>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 block mb-1.5">Seu custo estimado</label>
            <div className="flex items-center border border-slate-200 rounded-lg px-3 py-2 bg-white focus-within:border-blue-300 focus-within:ring-2 focus-within:ring-blue-50">
              <span className="text-xs text-slate-400 mr-1">R$</span>
              <input
                type="number"
                className="flex-1 text-sm font-semibold text-slate-800 focus:outline-none"
                value={costInput}
                onChange={e => setCostInput(e.target.value)}
                placeholder="Preencha para calcular"
              />
            </div>
          </div>
        </div>

        {/* Output */}
        {estNum > 0 && (
          <div className="p-5 space-y-3" style={{ background: 'linear-gradient(135deg, #F8FAFC 0%, #EFF6FF 100%)', borderTop: '1px solid #E8EFF6' }}>
            {maxCostForViability && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Para ser viável com {margin}% de margem, seu custo máximo deve ser:</span>
                <span className="text-sm font-bold text-slate-900">{fmtBRL(maxCostForViability)}</span>
              </div>
            )}
            {suggestedPrice && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Preço sugerido para proposta:</span>
                <div className="text-right">
                  <span className="text-base font-bold" style={{ color: '#0066FF' }}>{fmtBRL(suggestedPrice)}</span>
                  {pctBelowEstimated !== null && pctBelowEstimated > 0 && (
                    <p className="text-xs text-green-600 font-medium">{fmtPct(pctBelowEstimated)} abaixo do estimado (competitivo)</p>
                  )}
                  {pctBelowEstimated !== null && pctBelowEstimated < 0 && (
                    <p className="text-xs text-red-600 font-medium">Acima do valor estimado pelo órgão</p>
                  )}
                </div>
              </div>
            )}
            {guaranteeAmount && (
              <div className="rounded-lg p-3" style={{ background: '#FFF7ED', border: '1px solid #FED7AA' }}>
                <p className="text-xs font-semibold text-amber-800">
                  ⚠️ Atenção: garantia contratual (5%) = {fmtBRL(guaranteeAmount)}. Você precisa ter este valor disponível como reserva financeira.
                </p>
              </div>
            )}
            {isMeppp && fictoMax && suggestedPrice && (
              <div>
                <button
                  onClick={() => setFictoEnabled(f => !f)}
                  className={cn(
                    "text-xs font-semibold px-3 py-1.5 rounded-full transition-all",
                    fictoEnabled ? "text-white" : "border border-amber-300 text-amber-700 hover:bg-amber-50"
                  )}
                  style={fictoEnabled ? { background: '#D97706' } : {}}
                >
                  {fictoEnabled ? "✓" : "+"} Simular com empate ficto (ME/EPP)
                </button>
                {fictoEnabled && (
                  <div className="mt-2 rounded-lg p-3" style={{ background: '#FFFBEB', border: '1px solid #FDE68A' }}>
                    <p className="text-sm text-amber-800">
                      Com empate ficto: você pode cobrir lances até <strong>{fmtBRL(fictoMax)}</strong> (5% acima da sua proposta de {fmtBRL(suggestedPrice)}).
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Timeline ──────────────────────────────────────────────────────────────────

function Timeline({ events }: { events: TimelineEvent[] }) {
  if (!events || events.length === 0) return null;

  const today = new Date();

  const parsed = events
    .map(e => {
      const d = parseISO(e.date);
      return { ...e, parsed: isValid(d) ? d : null };
    })
    .filter(e => e.parsed !== null)
    .sort((a, b) => a.parsed!.getTime() - b.parsed!.getTime());

  if (parsed.length === 0) return null;

  const typeConfig: Record<string, { icon: React.ReactNode; color: string }> = {
    deadline: { icon: <Clock className="w-3.5 h-3.5" />, color: "#DC2626" },
    session: { icon: <Building2 className="w-3.5 h-3.5" />, color: "#0066FF" },
    visit: { icon: <Calendar className="w-3.5 h-3.5" />, color: "#7C3AED" },
    contract: { icon: <FileText className="w-3.5 h-3.5" />, color: "#059669" },
    other: { icon: <Info className="w-3.5 h-3.5" />, color: "#64748b" },
  };

  return (
    <div>
      <h3 className="font-bold text-slate-900 text-base mb-3 flex items-center gap-2">
        <Calendar className="w-4 h-4 text-violet-500" />
        Linha do tempo do processo
      </h3>
      <div className="bg-white rounded-2xl p-5 overflow-x-auto" style={{ border: '1px solid #E8EFF6' }}>
        <div className="flex items-start gap-0 min-w-max">
          {parsed.map((event, i) => {
            const isPastDate = isPast(event.parsed!);
            const daysUntil = differenceInDays(event.parsed!, today);
            const isUrgent = daysUntil >= 0 && daysUntil <= 5;
            const typeCfg = typeConfig[event.type] ?? typeConfig.other;
            const isLast = i === parsed.length - 1;

            return (
              <div key={i} className="flex items-start">
                <div className="flex flex-col items-center">
                  {/* Date label */}
                  <p className={cn("text-xs font-semibold mb-2", isPastDate ? "text-slate-400" : isUrgent ? "text-red-600" : "text-slate-700")}>
                    {format(event.parsed!, "dd MMM", { locale: ptBR })}
                  </p>
                  {/* Node */}
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center border-2 z-10 relative"
                    style={{
                      background: isPastDate ? "#F1F5F9" : isUrgent ? "#FEF2F2" : "white",
                      borderColor: isPastDate ? "#CBD5E1" : isUrgent ? "#FECACA" : typeCfg.color,
                      color: isPastDate ? "#94A3B8" : isUrgent ? "#DC2626" : typeCfg.color,
                    }}
                  >
                    {typeCfg.icon}
                  </div>
                  {/* Label */}
                  <p className={cn("text-[11px] font-medium mt-2 max-w-[80px] text-center leading-tight", isPastDate ? "text-slate-400" : isUrgent ? "text-red-600 font-semibold" : "text-slate-600")}>
                    {event.label}
                  </p>
                  {!isPastDate && (
                    <p className={cn("text-[10px] mt-1", isUrgent ? "text-red-500 font-bold" : "text-slate-400")}>
                      {daysUntil === 0 ? "hoje" : `${daysUntil}d`}
                    </p>
                  )}
                </div>
                {!isLast && (
                  <div
                    className="w-16 h-[2px] mt-[22px] mx-1 flex-shrink-0"
                    style={{ background: isPastDate ? "#CBD5E1" : "#E2E8F0" }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Competition Analysis ──────────────────────────────────────────────────────

function CompetitionSection({ similarProcesses, pricePatternInsight, suggestedBidMin, suggestedBidMax }: {
  similarProcesses?: SimilarProcess[];
  pricePatternInsight?: string;
  suggestedBidMin?: string;
  suggestedBidMax?: string;
}) {
  const hasData = (similarProcesses?.length ?? 0) > 0;

  return (
    <div>
      <h3 className="font-bold text-slate-900 text-base mb-3 flex items-center gap-2">
        <BarChart2 className="w-4 h-4 text-slate-500" />
        Análise de concorrência
      </h3>
      {!hasData ? (
        <div className="rounded-xl p-5 text-center" style={{ background: '#F8FAFC', border: '1px solid #E8EFF6' }}>
          <BarChart2 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500 font-medium">Não encontramos histórico de licitações similares neste órgão.</p>
          <p className="text-xs text-slate-400 mt-1">Recomendamos pesquisar preços no painel de pesquisa de mercado do governo federal.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="space-y-2">
            {(similarProcesses ?? []).slice(0, 4).map((sp, i) => {
              const discount = sp.estimated && sp.winning_bid ? ((sp.estimated - sp.winning_bid) / sp.estimated * 100) : null;
              return (
                <div key={i} className="bg-white rounded-xl p-4 flex items-center gap-4" style={{ border: '1px solid #E8EFF6' }}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{sp.number ?? `Processo ${i + 1}`}</p>
                    {sp.winner && <p className="text-xs text-slate-500">Vencedor: {sp.winner}</p>}
                  </div>
                  {sp.winning_bid && (
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-slate-900">{fmtBRL(sp.winning_bid)}</p>
                      {discount !== null && (
                        <p className="text-xs text-green-600 font-medium">{discount.toFixed(0)}% abaixo estimado</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {pricePatternInsight && (
            <div className="rounded-xl p-4" style={{ background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
              <p className="text-sm text-green-800">💡 {pricePatternInsight}</p>
              {suggestedBidMin && suggestedBidMax && (
                <p className="text-xs text-green-700 mt-1 font-semibold">
                  Sugestão de lance: {fmtBRL(suggestedBidMin)} – {fmtBRL(suggestedBidMax)}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Risk Analysis Types ───────────────────────────────────────────────────────

interface ElegibilidadeItem {
  status: string;
  justificativa: string;
  valor_estimado?: string | null;
  valor?: string | null;
  percentual?: string | null;
}

interface RiscoItem {
  categoria: string;
  nivel: "alto" | "medio" | "baixo";
  descricao: string;
  trecho_edital: string;
  recomendacao: string;
}

interface RiskAnalysisResult {
  elegibilidade: {
    exclusividade_me_epp: ElegibilidadeItem;
    empate_ficto: ElegibilidadeItem;
    prazo_regularizacao: ElegibilidadeItem;
    capital_social: ElegibilidadeItem;
    subcontratacao: ElegibilidadeItem;
  };
  riscos: RiscoItem[];
  score_risco_geral: "baixo" | "medio" | "alto";
  resumo: string;
  recomendacao_geral: {
    veredicto: string;
    pontos_positivos: string[];
    pontos_atencao: string[];
  };
  has_illegal_clauses: boolean;
  illegal_clause_details?: string | null;
}

// ── Risk Analysis Component ───────────────────────────────────────────────────

function RiskBadge({ level }: { level: "alto" | "medio" | "baixo" }) {
  const cfg = {
    alto: { label: "Risco Alto", color: "#DC2626", bg: "#FEF2F2", border: "#FECACA" },
    medio: { label: "Risco Médio", color: "#D97706", bg: "#FFFBEB", border: "#FDE68A" },
    baixo: { label: "Risco Baixo", color: "#059669", bg: "#F0FDF4", border: "#BBF7D0" },
  }[level];
  return (
    <span className="text-xs font-semibold px-2 py-0.5 rounded-full border" style={{ color: cfg.color, background: cfg.bg, borderColor: cfg.border }}>
      {cfg.label}
    </span>
  );
}

function ElegibilidadeBadge({ status, type }: { status: string; type: string }) {
  type BadgeCfg = { label: string; color: string; bg: string; border: string };
  const cfgMap: Record<string, BadgeCfg> = {
    sim_excl:       { label: "Exclusivo ME/EPP — você tem prioridade", color: "#059669", bg: "#F0FDF4", border: "#BBF7D0" },
    nao_excl:       { label: "Disputa aberta", color: "#64748b", bg: "#F8FAFC", border: "#E2E8F0" },
    nao_id_excl:    { label: "Não identificado", color: "#64748b", bg: "#F8FAFC", border: "#E2E8F0" },
    previsto_emp:   { label: "Empate ficto previsto", color: "#059669", bg: "#F0FDF4", border: "#BBF7D0" },
    ausente_emp:    { label: "Empate ficto ausente — questione via impugnação", color: "#D97706", bg: "#FFFBEB", border: "#FDE68A" },
    na_emp:         { label: "Não aplicável", color: "#64748b", bg: "#F8FAFC", border: "#E2E8F0" },
    previsto_praz:  { label: "Prazo de regularização previsto", color: "#059669", bg: "#F0FDF4", border: "#BBF7D0" },
    ausente_praz:   { label: "Prazo de regularização não mencionado", color: "#D97706", bg: "#FFFBEB", border: "#FDE68A" },
    sem_cap:        { label: "Sem exigência de capital social", color: "#059669", bg: "#F0FDF4", border: "#BBF7D0" },
    raz_cap:        { label: "Exigência de capital razoável", color: "#D97706", bg: "#FFFBEB", border: "#FDE68A" },
    rest_cap:       { label: "Exigência restritiva de capital social", color: "#DC2626", bg: "#FEF2F2", border: "#FECACA" },
    exig_sub:       { label: "Subcontratação ME/EPP exigida", color: "#1D4ED8", bg: "#EFF6FF", border: "#BFDBFE" },
    nao_sub:        { label: "Subcontratação não exigida", color: "#64748b", bg: "#F8FAFC", border: "#E2E8F0" },
  };
  const key = (() => {
    if (type === "excl") return status === "sim" ? "sim_excl" : status === "nao" ? "nao_excl" : "nao_id_excl";
    if (type === "emp") return status === "previsto" ? "previsto_emp" : status === "ausente" ? "ausente_emp" : "na_emp";
    if (type === "praz") return status === "previsto" ? "previsto_praz" : "ausente_praz";
    if (type === "cap") return status === "sem_exigencia" ? "sem_cap" : status === "exigencia_razoavel" ? "raz_cap" : "rest_cap";
    if (type === "sub") return status === "exigida" ? "exig_sub" : "nao_sub";
    return "nao_id_excl";
  })();
  const cfg = cfgMap[key]!;
  return (
    <span className="text-xs font-semibold px-2.5 py-1 rounded-full border inline-block" style={{ color: cfg.color, background: cfg.bg, borderColor: cfg.border }}>
      {cfg.label}
    </span>
  );
}

function ScoreIndicator({ score }: { score: "baixo" | "medio" | "alto" }) {
  const cfg = {
    baixo: { label: "Risco Geral: Baixo", color: "#059669", bg: "#F0FDF4", border: "#BBF7D0", dot: "#22C55E" },
    medio: { label: "Risco Geral: Médio", color: "#D97706", bg: "#FFFBEB", border: "#FDE68A", dot: "#F59E0B" },
    alto:  { label: "Risco Geral: Alto",  color: "#DC2626", bg: "#FEF2F2", border: "#FECACA", dot: "#EF4444" },
  }[score];
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-semibold" style={{ color: cfg.color, background: cfg.bg, borderColor: cfg.border }}>
      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: cfg.dot }} />
      {cfg.label}
    </div>
  );
}

function RiskAnalysisSection({ processId, token, hasEdital, process: processData }: { processId: number; token: string | null; hasEdital: boolean; process: any }) {
  const [data, setData] = useState<RiskAnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [openRisks, setOpenRisks] = useState<Record<number, boolean>>({});
  const [impugnacaoOpen, setImpugnacaoOpen] = useState(false);
  const [impugnacaoText, setImpugnacaoText] = useState("");
  const [impugnacaoLoading, setImpugnacaoLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!hasEdital) { setLoading(false); return; }
    fetch(`${API}/api/processes/${processId}/analysis`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(a => { if (a?.riskAnalysis) setData(a.riskAnalysis as RiskAnalysisResult); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [processId, token, hasEdital]);

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`${API}/api/processes/${processId}/risk-analysis`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setData(await res.json());
      } else {
        const err = await res.json().catch(() => ({}));
        setErrorMsg((err as any).error ?? "Erro ao gerar análise");
      }
    } catch {
      setErrorMsg("Falha na conexão. Tente novamente.");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleImpugnacao = async () => {
    setImpugnacaoOpen(true);
    setImpugnacaoLoading(true);
    setImpugnacaoText("");
    try {
      const res = await fetch(`${API}/api/processes/${processId}/generate-impugnacao`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ illegalClauseDetails: data?.illegal_clause_details }),
      });
      if (res.ok) {
        const json = await res.json();
        setImpugnacaoText((json as any).text ?? "");
      } else {
        setImpugnacaoText("Erro ao gerar minuta. Tente novamente.");
      }
    } catch {
      setImpugnacaoText("Falha na conexão. Tente novamente.");
    } finally {
      setImpugnacaoLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(impugnacaoText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleDownloadTxt = () => {
    const blob = new Blob([impugnacaoText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `impugnacao-processo-${processId}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const sortedRiscos = [...(data?.riscos ?? [])].sort((a, b) => {
    const order = { alto: 0, medio: 1, baixo: 2 };
    return order[a.nivel] - order[b.nivel];
  });

  const veredictoConfig = (() => {
    const v = data?.recomendacao_geral?.veredicto ?? "";
    if (v.includes("Vale a pena")) return { bg: "#F0FDF4", border: "#BBF7D0", color: "#059669", icon: <CheckCircle2 className="w-5 h-5" /> };
    if (v.includes("atenção")) return { bg: "#FFFBEB", border: "#FDE68A", color: "#D97706", icon: <AlertTriangle className="w-5 h-5" /> };
    return { bg: "#FEF2F2", border: "#FECACA", color: "#DC2626", icon: <XCircle className="w-5 h-5" /> };
  })();

  if (!hasEdital) return null;

  return (
    <div className="space-y-6 pb-2">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#EFF6FF' }}>
            <ShieldCheck className="w-4 h-4" style={{ color: '#0066FF' }} />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-base">Análise de risco e elegibilidade</h3>
            <p className="text-xs text-slate-500">Verificação legal LC 123/2006 e cláusulas do edital</p>
          </div>
        </div>
        {data && !analyzing && (
          <Button variant="outline" size="sm" onClick={handleAnalyze} className="gap-1.5 text-xs">
            <RefreshCw className="w-3.5 h-3.5" /> Reanalisar
          </Button>
        )}
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center gap-3 p-4 rounded-xl" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
          <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
          <span className="text-sm text-slate-500">Carregando análise...</span>
        </div>
      )}

      {/* Analyzing state */}
      {analyzing && (
        <div className="flex flex-col items-center justify-center py-12 gap-3 rounded-xl" style={{ background: '#EFF6FF', border: '1px solid #DBEAFE' }}>
          <div className="relative">
            <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: '#DBEAFE' }}>
              <ShieldCheck className="w-6 h-6 animate-pulse" style={{ color: '#0066FF' }} />
            </div>
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-white flex items-center justify-center">
              <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: '#0066FF' }} />
            </div>
          </div>
          <div className="text-center">
            <p className="font-semibold text-blue-900 text-sm">Analisando risco e elegibilidade com GPT-4o...</p>
            <p className="text-xs text-blue-600 mt-1">Verificando cláusulas, elegibilidade ME/EPP e riscos jurídicos</p>
          </div>
        </div>
      )}

      {/* Error */}
      {!analyzing && errorMsg && (
        <div className="rounded-xl p-4 flex items-start gap-3" style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}>
          <XCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-red-800 font-medium">{errorMsg}</p>
            <Button size="sm" variant="outline" onClick={handleAnalyze} className="mt-2 text-xs">Tentar novamente</Button>
          </div>
        </div>
      )}

      {/* Prompt button — no data yet */}
      {!loading && !analyzing && !data && !errorMsg && (
        <div className="rounded-xl p-6 flex flex-col items-center gap-4 text-center" style={{ background: '#FAFBFC', border: '2px dashed #E2E8F0' }}>
          <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: '#EFF6FF' }}>
            <ShieldCheck className="w-6 h-6" style={{ color: '#0066FF' }} />
          </div>
          <div>
            <p className="font-semibold text-slate-800 mb-1">Análise de risco ainda não realizada</p>
            <p className="text-sm text-slate-500">O GPT-4o vai verificar elegibilidade ME/EPP, cláusulas problemáticas e classificar os riscos do edital.</p>
          </div>
          <Button onClick={handleAnalyze} style={{ background: '#0066FF' }} className="text-white hover:opacity-90 gap-2">
            <ShieldCheck className="w-4 h-4" /> Analisar edital
          </Button>
        </div>
      )}

      {/* Results */}
      {!analyzing && data && (
        <div className="space-y-6">
          {/* Bloco C: Veredicto (topo) */}
          <div className="rounded-2xl p-5" style={{ background: veredictoConfig.bg, border: `1px solid ${veredictoConfig.border}` }}>
            <div className="flex items-start gap-3 mb-3">
              <div style={{ color: veredictoConfig.color }}>{veredictoConfig.icon}</div>
              <div>
                <p className="font-bold text-slate-900">{data.recomendacao_geral?.veredicto}</p>
                <p className="text-sm text-slate-600 mt-1">{data.resumo}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4">
              {(data.recomendacao_geral?.pontos_positivos?.length ?? 0) > 0 && (
                <div>
                  <p className="text-xs font-semibold text-green-700 mb-2 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Pontos positivos
                  </p>
                  <ul className="space-y-1">
                    {data.recomendacao_geral.pontos_positivos.map((p, i) => (
                      <li key={i} className="text-xs text-slate-700 flex items-start gap-1.5">
                        <span className="text-green-500 mt-0.5 flex-shrink-0">•</span>{p}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {(data.recomendacao_geral?.pontos_atencao?.length ?? 0) > 0 && (
                <div>
                  <p className="text-xs font-semibold text-amber-700 mb-2 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> Pontos de atenção
                  </p>
                  <ul className="space-y-1">
                    {data.recomendacao_geral.pontos_atencao.map((p, i) => (
                      <li key={i} className="text-xs text-slate-700 flex items-start gap-1.5">
                        <span className="text-amber-500 mt-0.5 flex-shrink-0">•</span>{p}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* Bloco A: Elegibilidade ME/EPP */}
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #E8EFF6' }}>
            <div className="px-5 py-3.5 flex items-center gap-2" style={{ background: '#F8FAFC', borderBottom: '1px solid #E8EFF6' }}>
              <ShieldCheck className="w-4 h-4 text-blue-500" />
              <h4 className="font-semibold text-slate-800 text-sm">Elegibilidade ME/EPP — Lei Complementar 123/2006</h4>
            </div>
            <div className="divide-y" style={{ divideColor: '#F1F5F9' }}>
              {[
                { label: "Exclusividade ME/EPP", item: data.elegibilidade?.exclusividade_me_epp, type: "excl" },
                { label: "Direito de preferência (empate ficto)", item: data.elegibilidade?.empate_ficto, type: "emp" },
                { label: "Prazo de regularização fiscal", item: data.elegibilidade?.prazo_regularizacao, type: "praz" },
                { label: "Exigência de capital social", item: data.elegibilidade?.capital_social, type: "cap" },
                { label: "Subcontratação ME/EPP", item: data.elegibilidade?.subcontratacao, type: "sub" },
              ].filter(r => r.item).map(({ label, item, type }) => (
                <div key={type} className="px-5 py-3.5 flex flex-col gap-1.5" style={{ borderColor: '#F1F5F9' }}>
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-xs font-medium text-slate-600">{label}</span>
                    <ElegibilidadeBadge status={item!.status} type={type} />
                  </div>
                  {item!.justificativa && (
                    <p className="text-xs text-slate-500">{item!.justificativa}
                      {(item!.valor_estimado || item!.valor || item!.percentual) && (
                        <span className="font-medium text-slate-700"> — {item!.valor_estimado ?? item!.valor ?? item!.percentual}</span>
                      )}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Bloco B: Riscos */}
          {sortedRiscos.length > 0 && (
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #E8EFF6' }}>
              <div className="px-5 py-3.5 flex items-center justify-between" style={{ background: '#F8FAFC', borderBottom: '1px solid #E8EFF6' }}>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <h4 className="font-semibold text-slate-800 text-sm">Análise de risco do edital</h4>
                </div>
                <ScoreIndicator score={data.score_risco_geral} />
              </div>
              <div className="divide-y" style={{ divideColor: '#F1F5F9' }}>
                {sortedRiscos.map((risco, i) => (
                  <div key={i}>
                    <button
                      className="w-full px-5 py-3.5 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
                      onClick={() => setOpenRisks(prev => ({ ...prev, [i]: !prev[i] }))}
                    >
                      <div className="flex items-center gap-3">
                        <RiskBadge level={risco.nivel} />
                        <span className="text-sm font-medium text-slate-700">{risco.categoria}</span>
                      </div>
                      {openRisks[i] ? <ChevronUp className="w-4 h-4 text-slate-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />}
                    </button>
                    {openRisks[i] && (
                      <div className="px-5 pb-4 space-y-3" style={{ background: '#FAFBFC', borderTop: '1px solid #F1F5F9' }}>
                        <p className="text-sm text-slate-700">{risco.descricao}</p>
                        {risco.trecho_edital && (
                          <blockquote className="border-l-2 pl-3 text-xs text-slate-500 italic" style={{ borderColor: '#CBD5E1' }}>
                            "{risco.trecho_edital}"
                          </blockquote>
                        )}
                        {risco.recomendacao && (
                          <div className="flex items-start gap-2 rounded-lg p-3" style={{ background: '#EFF6FF' }}>
                            <Lightbulb className="w-3.5 h-3.5 text-blue-500 flex-shrink-0 mt-0.5" />
                            <p className="text-xs text-blue-800">{risco.recomendacao}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Botão impugnação */}
          {data.has_illegal_clauses && (
            <div className="flex items-start gap-3 rounded-xl p-4" style={{ background: '#FFF7ED', border: '1px solid #FED7AA' }}>
              <FileWarning className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-orange-900 mb-1">Cláusulas potencialmente ilegais identificadas</p>
                <p className="text-xs text-orange-700 mb-3">{data.illegal_clause_details}</p>
                <Button size="sm" onClick={handleImpugnacao} className="gap-1.5 text-xs" style={{ background: '#EA580C' }}>
                  <FileWarning className="w-3.5 h-3.5" /> Gerar minuta de impugnação
                </Button>
              </div>
            </div>
          )}

          {/* Disclaimer */}
          <p className="text-xs text-slate-400 text-center border-t pt-4" style={{ borderColor: '#E8EFF6' }}>
            Esta análise é gerada por IA com fins informativos e não substitui orientação jurídica especializada.
          </p>
        </div>
      )}

      {/* Modal de impugnação */}
      {impugnacaoOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: '#E8EFF6' }}>
              <div className="flex items-center gap-2">
                <FileWarning className="w-5 h-5 text-orange-500" />
                <h3 className="font-bold text-slate-900">Minuta de Impugnação</h3>
              </div>
              <button onClick={() => setImpugnacaoOpen(false)} className="p-1 rounded-lg hover:bg-slate-100 transition-colors">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {impugnacaoLoading ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                  <p className="text-sm text-slate-500">Gerando minuta de impugnação...</p>
                </div>
              ) : (
                <pre className="text-sm text-slate-700 whitespace-pre-wrap font-sans leading-relaxed">{impugnacaoText}</pre>
              )}
            </div>
            {!impugnacaoLoading && impugnacaoText && (
              <div className="flex items-center justify-end gap-2 px-6 py-4 border-t" style={{ borderColor: '#E8EFF6' }}>
                <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1.5">
                  {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? "Copiado!" : "Copiar"}
                </Button>
                <Button size="sm" onClick={handleDownloadTxt} className="gap-1.5" style={{ background: '#0066FF' }}>
                  <Download className="w-3.5 h-3.5" /> Baixar .txt
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function ProcessAnalysisTab({ processId, process, companyData, onGoToDocuments }: Props) {
  const token = getToken();
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(false);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const hasEdital = !!process?.editalFile;
  const isMeppp = ["ME", "EPP", "MEI"].some(p => companyData?.porte?.toUpperCase?.()?.includes(p) ?? false);

  const fetchAnalysis = useCallback(async (): Promise<Analysis | null> => {
    const res = await fetch(`${API}/api/processes/${processId}/analysis`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) return res.json();
    return null;
  }, [processId, token]);

  const generateAnalysis = useCallback(async () => {
    setGenerating(true);
    try {
      const res = await fetch(`${API}/api/processes/${processId}/generate-analysis`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAnalysis(data);
        setError(false);
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setGenerating(false);
      setLoading(false);
    }
  }, [processId, token]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);

    (async () => {
      const existing = await fetchAnalysis();
      if (cancelled) return;

      if (existing) {
        setAnalysis(existing);
        setLoading(false);
        return;
      }

      if (hasEdital) {
        await generateAnalysis();
      } else {
        setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [processId, hasEdital]);

  if (!hasEdital) {
    return (
      <div className="text-center py-16 rounded-2xl" style={{ border: '2px dashed #E2E8F0', background: '#FAFBFC' }}>
        <Sparkles className="w-10 h-10 text-slate-200 mx-auto mb-3" />
        <p className="font-semibold text-slate-600 mb-1">Envie o edital primeiro</p>
        <p className="text-sm text-slate-400">A análise será gerada automaticamente após o upload do PDF.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* ── Análise de risco e elegibilidade (nova seção) ─────────────────── */}
      <RiskAnalysisSection processId={processId} token={token} hasEdital={hasEdital} process={process} />

      {/* ── Separador ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3" style={{ borderTop: '1px solid #E8EFF6' }}>
        <div className="flex items-center gap-2 -mt-4 bg-white pr-3">
          <Sparkles className="w-4 h-4 text-blue-400" />
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Análise de viabilidade</span>
        </div>
      </div>

      {/* ── Análise de viabilidade existente ──────────────────────────────── */}
      {(loading || generating) ? (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <div className="relative">
            <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: '#EFF6FF' }}>
              <Sparkles className="w-6 h-6 animate-pulse" style={{ color: '#0066FF' }} />
            </div>
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center bg-white">
              <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: '#0066FF' }} />
            </div>
          </div>
          <div className="text-center">
            <p className="font-semibold text-slate-800 mb-1">Analisando viabilidade do processo...</p>
            <p className="text-sm text-slate-500">Identificando requisitos, prazos e perfil financeiro.</p>
          </div>
        </div>
      ) : (error || !analysis) ? (
        <div className="text-center py-12 rounded-2xl" style={{ border: '1px solid #FECACA', background: '#FFF5F5' }}>
          <XCircle className="w-10 h-10 text-red-300 mx-auto mb-3" />
          <p className="font-semibold text-slate-700 mb-1">Não foi possível gerar a análise de viabilidade</p>
          <p className="text-sm text-slate-500 mb-4">Verifique se o edital está legível e tente novamente.</p>
          <Button onClick={generateAnalysis} disabled={generating} style={{ background: '#0066FF' }} className="text-white hover:opacity-90 gap-2">
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Tentar novamente
          </Button>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Bloco 1: Diagnóstico */}
          <ViabilityBanner status={analysis.viabilityStatus} reasons={analysis.viabilityReasons ?? []} />

          {/* Bloco 2: ME/EPP */}
          {isMeppp && <MepppSection analysis={analysis} />}

          {/* Bloco 3: Requisitos técnicos */}
          {(analysis.technicalRequirements?.length ?? 0) > 0 && (
            <TechRequirements reqs={analysis.technicalRequirements!} />
          )}

          {/* Bloco 4: Calculadora */}
          <FinancialCalculator
            estimatedValue={analysis.estimatedValue}
            estimatedTaxes={analysis.estimatedTaxesPercent}
            isMeppp={isMeppp}
          />

          {/* Bloco 5: Linha do tempo */}
          {(analysis.timelineEvents?.length ?? 0) > 0 && (
            <Timeline events={analysis.timelineEvents!} />
          )}

          {/* Bloco 6: Concorrência */}
          <CompetitionSection
            similarProcesses={analysis.similarProcesses as SimilarProcess[] | undefined}
            pricePatternInsight={analysis.pricePatternInsight ?? undefined}
            suggestedBidMin={analysis.suggestedBidMin ?? undefined}
            suggestedBidMax={analysis.suggestedBidMax ?? undefined}
          />
        </div>
      )}

      {/* CTA to documents */}
      <div className="flex justify-end pt-4" style={{ borderTop: '1px solid #E8EFF6' }}>
        <Button onClick={onGoToDocuments} style={{ background: '#0066FF' }} className="text-white hover:opacity-90 gap-2">
          Ir para documentos
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

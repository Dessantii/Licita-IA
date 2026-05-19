import { useState, useEffect, useRef, useCallback } from "react";
import { getToken } from "@/hooks/use-auth";
import {
  Search,
  ChevronDown,
  ChevronUp,
  TrendingDown,
  TrendingUp,
  Minus,
  AlertTriangle,
  CheckCircle2,
  FileDown,
  ExternalLink,
  Loader2,
  Sparkles,
  Upload,
  Lock,
  CalendarDays,
  Info,
  ArrowRight,
  BarChart3,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ProposalItem {
  itemNumber: number;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  total: number;
}

interface MarketResult {
  objetoCompra?: string;
  descricao?: string;
  valorTotalEstimado?: number;
  valorTotalHomologado?: number;
  orgaoEntidade?: { razaoSocial?: string };
  dataPublicacaoEdital?: string;
  [key: string]: unknown;
}

interface PriceResearch {
  keywords: string[];
  results: MarketResult[];
  insight: string;
  avgPrice: number | null;
  minPrice: number | null;
  maxPrice: number | null;
  suggestedMin: number | null;
  suggestedMax: number | null;
  aiSource?: boolean;
}

interface ProposalDraft {
  id?: number;
  totalValue?: string;
  validityDays?: number;
  deliveryTerm?: string;
  brandManufacturer?: string;
  observations?: string;
  declaredCost?: string;
  estimatedTaxesPercent?: string;
  docxPath?: string;
  signedDocxPath?: string;
  status?: string;
}

interface ProcessData {
  id: number;
  title: string;
  agency: string;
  modality?: string;
  editalNumber?: string;
  deadline?: string;
  estimatedValue?: string | number | null;
  sourceUrl?: string;
  requirements?: Array<{
    id: number;
    title: string;
    category: string;
    mandatory: boolean;
    description?: string;
  }>;
  validationItems?: Array<{ status: string }>;
}

interface CompanyData {
  razaoSocial?: string;
  cnpj?: string;
  porte?: string;
  municipio?: string;
  uf?: string;
  representanteLegal?: string;
}

interface PropostaTabProps {
  process: ProcessData;
  companyData: CompanyData | null;
}

// ── Formatters ────────────────────────────────────────────────────────────────

function fmt(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtPct(v: number): string {
  return `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
}

// ── Tax rate ──────────────────────────────────────────────────────────────────

function taxRateFromPorte(porte: string | undefined): number {
  if (!porte) return 0.06;
  const p = porte.toLowerCase();
  if (p.includes("mei")) return 0.05;
  if (p.includes("simples") || p.includes("me ") || p.includes("epp")) return 0.06;
  if (p.includes("presumido")) return 0.1175;
  if (p.includes("real")) return 0.135;
  return 0.06;
}

function taxLabel(porte: string | undefined): string {
  if (!porte) return "Simples Nacional (estimado 6%)";
  const p = porte.toLowerCase();
  if (p.includes("mei")) return "MEI (DAS estimado 5%)";
  if (p.includes("simples") || p.includes("me") || p.includes("epp")) return "Simples Nacional (DAS estimado 6%)";
  if (p.includes("presumido")) return "Lucro Presumido (11,75%)";
  if (p.includes("real")) return "Lucro Real (13,5%)";
  return "Simples Nacional (estimado 6%)";
}

// ── Section anchor nav ────────────────────────────────────────────────────────

function SectionNav({ active, onSelect }: { active: string; onSelect: (s: string) => void }) {
  const sections = [
    { id: "pesquisa", label: "1. Pesquisa de preço" },
    { id: "proposta", label: "2. Monte sua proposta" },
    { id: "gerar", label: "3. Gerar documento" },
  ];
  return (
    <div className="flex gap-1 p-1 rounded-xl mb-7" style={{ background: "#EFF6FF", border: "1px solid #BFDBFE" }}>
      {sections.map(s => (
        <button
          key={s.id}
          onClick={() => onSelect(s.id)}
          className={cn(
            "flex-1 px-3 py-2 rounded-lg text-sm font-semibold transition-all",
            active === s.id
              ? "bg-white text-blue-700 shadow-sm"
              : "text-blue-500 hover:text-blue-700 hover:bg-white/60"
          )}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}

// ── Price positioning indicator ───────────────────────────────────────────────

function PriceIndicator({ unitPrice, avgPrice }: { unitPrice: number; avgPrice: number | null }) {
  if (!avgPrice || unitPrice === 0) return null;
  const diff = ((unitPrice - avgPrice) / avgPrice) * 100;
  if (diff < -5) return <span className="text-xs font-semibold text-green-600 flex items-center gap-0.5"><TrendingDown className="w-3 h-3" /> Competitivo</span>;
  if (diff > 5) return <span className="text-xs font-semibold text-red-600 flex items-center gap-0.5"><TrendingUp className="w-3 h-3" /> Acima</span>;
  return <span className="text-xs font-semibold text-amber-600 flex items-center gap-0.5"><Minus className="w-3 h-3" /> Na média</span>;
}

// ── Main component ────────────────────────────────────────────────────────────

export function PropostaTab({ process, companyData }: PropostaTabProps) {
  const { toast } = useToast();
  const token = getToken();
  const apiBase = import.meta.env.VITE_API_URL ?? "";

  const [section, setSection] = useState<"pesquisa" | "proposta" | "gerar">("pesquisa");
  const [searchLoading, setSearchLoading] = useState(false);
  const [research, setResearch] = useState<PriceResearch | null>(null);
  const [customKeywords, setCustomKeywords] = useState("");
  const [draft, setDraft] = useState<ProposalDraft>({});
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [generatedFilename, setGeneratedFilename] = useState<string | null>(null);
  const [signedUploading, setSignedUploading] = useState(false);
  const [signedDone, setSignedDone] = useState(false);
  const [showChecklist, setShowChecklist] = useState(false);
  const [includeDeclaration, setIncludeDeclaration] = useState(false);
  const signedInputRef = useRef<HTMLInputElement>(null);

  // Items table state
  const [items, setItems] = useState<ProposalItem[]>([]);
  const [declaredCost, setDeclaredCost] = useState<string>("");
  const [validityDays, setValidityDays] = useState(60);
  const [deliveryTerm, setDeliveryTerm] = useState("");
  const [brandManufacturer, setBrandManufacturer] = useState("");
  const [observations, setObservations] = useState("");
  const [showResearchExpanded, setShowResearchExpanded] = useState(true);

  const taxRate = taxRateFromPorte(companyData?.porte);
  const totalValue = items.reduce((s, i) => s + i.total, 0);
  const estimatedValue = parseFloat(String(process.estimatedValue ?? 0)) || 0;
  const taxesEstimated = totalValue * taxRate;
  const costNum = parseFloat(declaredCost.replace(/\./g, "").replace(",", ".")) || 0;
  const margin = costNum > 0 && totalValue > 0 ? ((totalValue - taxesEstimated - costNum) / totalValue) * 100 : null;
  const empteFicto = totalValue * 1.05;
  const garantia = totalValue * 0.05;
  const aboveEstimate = estimatedValue > 0 && totalValue > estimatedValue;
  const diffPct = estimatedValue > 0 ? ((totalValue - estimatedValue) / estimatedValue) * 100 : 0;

  // Load existing draft on mount
  useEffect(() => {
    fetch(`${apiBase}/api/processes/${process.id}/proposal`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then((data: { proposal?: ProposalDraft; research?: PriceResearch } | null) => {
        if (data?.proposal) {
          setDraft(data.proposal);
          setValidityDays(data.proposal.validityDays ?? 60);
          setDeliveryTerm(data.proposal.deliveryTerm ?? "");
          setBrandManufacturer(data.proposal.brandManufacturer ?? "");
          setObservations(data.proposal.observations ?? "");
          if (data.proposal.declaredCost) setDeclaredCost(String(data.proposal.declaredCost));
          if (data.proposal.docxPath) {
            setGeneratedUrl(`${apiBase}/uploads/${data.proposal.docxPath}`);
            setGeneratedFilename(data.proposal.docxPath);
          }
          if (data.proposal.signedDocxPath) setSignedDone(true);
        }
        if (data?.research) setResearch(data.research as unknown as PriceResearch);
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [process.id]);

  // Build default items from process requirements or single item
  useEffect(() => {
    if (items.length > 0) return;
    const loteReqs = (process.requirements ?? []).filter(r =>
      r.category === "item" || r.category === "lote" || r.title.toLowerCase().includes("item") || r.title.toLowerCase().includes("lote")
    );
    if (loteReqs.length > 0) {
      setItems(loteReqs.map((r, i) => ({
        itemNumber: i + 1,
        description: r.description ?? r.title,
        quantity: 1,
        unit: "un",
        unitPrice: 0,
        total: 0,
      })));
    } else {
      setItems([{
        itemNumber: 1,
        description: process.title,
        quantity: 1,
        unit: "un",
        unitPrice: 0,
        total: 0,
      }]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [process.id]);

  const handleSearchPrices = useCallback(async () => {
    setSearchLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/processes/${process.id}/proposal/search-prices`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ customKeywords: customKeywords.trim() || undefined }),
      });
      if (res.ok) {
        const data = await res.json() as PriceResearch;
        setResearch(data);
      } else {
        toast({ title: "Erro ao buscar preços", description: "Tente novamente em instantes.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Erro de conexão", variant: "destructive" });
    } finally {
      setSearchLoading(false);
    }
  }, [apiBase, process.id, token, customKeywords, toast]);

  const handleSaveDraft = useCallback(async () => {
    setSaving(true);
    try {
      await fetch(`${apiBase}/api/processes/${process.id}/proposal`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          items,
          totalValue,
          validityDays,
          deliveryTerm,
          brandManufacturer,
          observations,
          declaredCost: costNum || undefined,
        }),
      });
      toast({ title: "Rascunho salvo" });
    } catch {
      toast({ title: "Erro ao salvar", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }, [apiBase, process.id, token, items, totalValue, validityDays, deliveryTerm, brandManufacturer, observations, costNum, toast]);

  const handleGenerateDocx = useCallback(async () => {
    if (items.some(i => i.unitPrice === 0)) {
      toast({ title: "Preencha os preços", description: "Informe o preço unitário de todos os itens.", variant: "destructive" });
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch(`${apiBase}/api/processes/${process.id}/proposal/generate-docx`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ items, totalValue, validityDays, deliveryTerm, observations, includeDeclaration }),
      });
      if (res.ok) {
        const data = await res.json() as { downloadUrl: string; filename: string };
        setGeneratedUrl(`${apiBase}${data.downloadUrl}`);
        setGeneratedFilename(data.filename);
        setShowChecklist(true);
        toast({ title: "Proposta gerada com sucesso!" });
      } else {
        toast({ title: "Erro ao gerar proposta", variant: "destructive" });
      }
    } catch {
      toast({ title: "Erro de conexão", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  }, [apiBase, process.id, token, items, totalValue, validityDays, deliveryTerm, observations, includeDeclaration, toast]);

  const handleUploadSigned = useCallback(async (file: File) => {
    setSignedUploading(true);
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await fetch(`${apiBase}/api/processes/${process.id}/proposal/upload-signed`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      if (res.ok) {
        setSignedDone(true);
        toast({ title: "Proposta assinada enviada!" });
      } else {
        toast({ title: "Erro no upload", variant: "destructive" });
      }
    } catch {
      toast({ title: "Erro de conexão", variant: "destructive" });
    } finally {
      setSignedUploading(false);
    }
  }, [apiBase, process.id, token, toast]);

  function updateItem(index: number, field: keyof ProposalItem, value: string | number) {
    setItems(prev => {
      const next = [...prev];
      const item = { ...next[index]! };
      (item as Record<string, unknown>)[field] = typeof value === "number" ? value : field === "unitPrice" ? parseFloat(value) || 0 : value;
      if (field === "unitPrice" || field === "quantity") {
        item.total = (field === "unitPrice" ? (parseFloat(String(value)) || 0) : item.unitPrice) *
          (field === "quantity" ? (parseFloat(String(value)) || 0) : item.quantity);
      }
      next[index] = item;
      return next;
    });
  }

  function addItem() {
    setItems(prev => [...prev, { itemNumber: prev.length + 1, description: "", quantity: 1, unit: "un", unitPrice: 0, total: 0 }]);
  }

  function removeItem(index: number) {
    setItems(prev => prev.filter((_, i) => i !== index).map((item, i) => ({ ...item, itemNumber: i + 1 })));
  }

  // Validation stats for checklist
  const valOk = (process.validationItems ?? []).filter(v => v.status === "ok").length;
  const valTotal = (process.validationItems ?? []).length;
  const docsReady = valTotal > 0 && valOk === valTotal;

  return (
    <div>
      <SectionNav active={section} onSelect={s => setSection(s as typeof section)} />

      {/* ── SECTION 1: Pesquisa de preço ──────────────────────────────────── */}
      {section === "pesquisa" && (
        <div className="space-y-5">
          <div className="bg-white rounded-2xl overflow-hidden" style={{ border: "1px solid #E8EFF6", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid #E8EFF6" }}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#EFF6FF" }}>
                  <BarChart3 className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Referências de preço — PNCP</h3>
                  {research?.keywords && (
                    <p className="text-xs text-slate-500 mt-0.5">Buscando por: "{research.keywords.join('" · "')}"</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {research && (
                  <button
                    onClick={() => setShowResearchExpanded(v => !v)}
                    className="text-slate-400 hover:text-slate-600 p-1"
                  >
                    {showResearchExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                )}
              </div>
            </div>

            {/* Keyword input — always visible */}
            <div className="px-5 py-4" style={{ borderBottom: "1px solid #E8EFF6" }}>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">
                Termos de busca <span className="font-normal text-slate-400">(opcional — IA extrai automaticamente do título)</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customKeywords}
                  onChange={e => setCustomKeywords(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !searchLoading) handleSearchPrices(); }}
                  placeholder='Ex: "caneta esferográfica", "notebook i5", "vigilância armada"'
                  className="flex-1 rounded-lg border px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  style={{ borderColor: "#D1E3F6", background: "#F8FAFD" }}
                />
                <Button
                  onClick={handleSearchPrices}
                  disabled={searchLoading}
                  size="sm"
                  className="gap-2 text-white shrink-0"
                  style={{ background: "#0066FF" }}
                >
                  {searchLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                  Buscar
                </Button>
              </div>
              <p className="text-xs text-slate-400 mt-1.5">Separe múltiplos termos com vírgula. Deixe vazio para deixar a IA decidir.</p>
            </div>

            {!research && !searchLoading && (
              <div className="px-5 py-10 text-center">
                <Search className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                <p className="text-sm font-semibold text-slate-500 mb-1">Pesquise referências de preço no PNCP</p>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  O sistema busca contratos similares dos últimos 12 meses para você ter uma referência antes de definir seu preço.
                </p>
              </div>
            )}

            {searchLoading && (
              <div className="px-5 py-10 text-center">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-3" />
                <p className="text-sm font-semibold text-slate-500">Consultando PNCP e analisando com IA...</p>
                <p className="text-xs text-slate-400 mt-1">Isso pode levar alguns segundos</p>
              </div>
            )}

            {research && showResearchExpanded && (
              <div className="p-5">
                {/* Results list */}
                {research.results.length > 0 ? (
                  <div className="space-y-3 mb-5">
                    {research.results.slice(0, 5).map((r, i) => {
                      const value = r.valorTotalHomologado ?? r.valorTotalEstimado;
                      const organ = r.orgaoEntidade?.razaoSocial ?? "Órgão público";
                      const desc = r.objetoCompra ?? r.descricao ?? "Contratação pública";
                      return (
                        <div key={i} className="rounded-xl p-4" style={{ background: "#F8FAFC", border: "1px solid #E8EFF6" }}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">{organ}</p>
                              <p className="text-sm text-slate-800 line-clamp-2">{desc}</p>
                            </div>
                            {value != null && (
                              <div className="flex-shrink-0 text-right">
                                <p className="text-sm font-bold text-slate-900">{fmt(value)}</p>
                                <p className="text-xs text-slate-400">valor contratado</p>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-xl p-5 mb-5" style={{ background: "#FFFBEB", border: "1px solid #FDE68A" }}>
                    <div className="flex items-start gap-3">
                      <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-amber-900">Nenhum contrato similar encontrado no PNCP</p>
                        <p className="text-xs text-amber-700 mt-1">
                          Consulte o{" "}
                          <a href="https://paineldeprecos.planejamento.gov.br" target="_blank" rel="noopener noreferrer" className="underline font-semibold">
                            Painel de Preços do governo federal
                          </a>{" "}
                          para referências de mercado adicionais.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Stats card */}
                <div className="rounded-xl p-5" style={{ background: "#F0F9FF", border: "1px solid #BAE6FD" }}>
                  <div className="flex items-center gap-2 mb-3">
                    <BarChart3 className="w-4 h-4 text-blue-600" />
                    <p className="text-sm font-bold text-blue-900">
                      {research.aiSource !== false && research.results.length === 0
                        ? "Estimativa IA — dados históricos de compras públicas"
                        : "Análise — contratos dos últimos 12 meses (PNCP)"}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    {[
                      { label: "Menor valor", value: research.minPrice },
                      { label: "Valor médio", value: research.avgPrice },
                      { label: "Maior valor", value: research.maxPrice },
                      { label: "Estimativa do edital", value: estimatedValue || null },
                    ].map(({ label, value }) => (
                      <div key={label} className="bg-white rounded-lg p-3" style={{ border: "1px solid #BAE6FD" }}>
                        <p className="text-xs text-slate-500 mb-0.5">{label}</p>
                        <p className="text-sm font-bold text-slate-800">
                          {value != null ? fmt(value) : "—"}
                        </p>
                      </div>
                    ))}
                  </div>
                  {research.insight && (
                    <div className="flex items-start gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-blue-500 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-blue-800">{research.insight}</p>
                    </div>
                  )}
                  {research.suggestedMin != null && (
                    <Button
                      onClick={() => {
                        const mid = ((research.suggestedMin ?? 0) + (research.suggestedMax ?? research.suggestedMin ?? 0)) / 2;
                        if (items.length === 1) {
                          updateItem(0, "unitPrice", mid / (items[0]!.quantity || 1));
                          updateItem(0, "total", mid);
                        }
                        setSection("proposta");
                      }}
                      size="sm"
                      variant="outline"
                      className="mt-3 gap-1.5 text-blue-700 border-blue-200 hover:bg-blue-50"
                    >
                      Usar valor sugerido como referência <ArrowRight className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Painel de preços link */}
          <div className="flex items-center gap-3 px-5 py-4 rounded-xl" style={{ background: "#F8FAFC", border: "1px solid #E8EFF6" }}>
            <ExternalLink className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-700">Painel de Preços — Governo Federal</p>
              <p className="text-xs text-slate-500">Base de dados de preços praticados em compras públicas</p>
            </div>
            <a href="https://paineldeprecos.planejamento.gov.br" target="_blank" rel="noopener noreferrer">
              <Button size="sm" variant="outline" className="gap-1.5 border-slate-200">
                Acessar <ExternalLink className="w-3 h-3" />
              </Button>
            </a>
          </div>

          <div className="flex justify-end">
            <Button onClick={() => setSection("proposta")} className="gap-2 text-white" style={{ background: "#0066FF" }}>
              Montar proposta <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ── SECTION 2: Monte sua proposta ─────────────────────────────────── */}
      {section === "proposta" && (
        <div className="space-y-6">
          {/* Overestimate alert */}
          {aboveEstimate && totalValue > 0 && (
            <div className="flex items-start gap-3 p-4 rounded-xl" style={{ background: "#FEF2F2", border: "1px solid #FECACA" }}>
              <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-red-800">Proposta acima do estimado</p>
                <p className="text-xs text-red-700 mt-0.5">
                  Seu valor ({fmt(totalValue)}) está {Math.abs(diffPct).toFixed(1)}% acima da estimativa do órgão ({fmt(estimatedValue)}).
                  Propostas acima do estimado são geralmente desclassificadas em pregões.
                </p>
              </div>
            </div>
          )}

          <div className="flex flex-col xl:flex-row gap-6">
            {/* Items table */}
            <div className="flex-1 min-w-0">
              <div className="bg-white rounded-2xl overflow-hidden" style={{ border: "1px solid #E8EFF6", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
                <div className="px-5 py-4" style={{ borderBottom: "1px solid #E8EFF6", background: "#FAFBFC" }}>
                  <h3 className="text-sm font-bold text-slate-900">Tabela de itens</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Preencha o preço unitário de cada item</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ borderBottom: "1px solid #E8EFF6", background: "#F8FAFC" }}>
                        {["#", "Descrição", "Qtd", "Unid.", "Preço unit.", "Total", ""].map(h => (
                          <th key={h} className="text-xs font-semibold text-slate-400 uppercase tracking-wide px-4 py-3 text-left">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item, i) => (
                        <tr key={i} style={{ borderBottom: "1px solid #F1F5F9" }}>
                          <td className="px-4 py-3 text-slate-400 text-xs font-mono">{item.itemNumber}</td>
                          <td className="px-4 py-3 min-w-[200px]">
                            <input
                              value={item.description}
                              onChange={e => updateItem(i, "description", e.target.value)}
                              className="w-full text-sm text-slate-800 bg-transparent border-0 outline-none focus:bg-slate-50 rounded px-1 py-0.5"
                              placeholder="Descrição do item"
                            />
                          </td>
                          <td className="px-4 py-3 w-16">
                            <input
                              type="number"
                              value={item.quantity}
                              min={1}
                              onChange={e => updateItem(i, "quantity", parseFloat(e.target.value) || 1)}
                              className="w-16 text-sm text-slate-800 bg-transparent border-0 outline-none focus:bg-slate-50 rounded px-1 py-0.5 text-center"
                            />
                          </td>
                          <td className="px-4 py-3 w-20">
                            <input
                              value={item.unit}
                              onChange={e => updateItem(i, "unit", e.target.value)}
                              className="w-20 text-sm text-slate-800 bg-transparent border-0 outline-none focus:bg-slate-50 rounded px-1 py-0.5"
                            />
                          </td>
                          <td className="px-4 py-3 w-40">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1">
                                <span className="text-xs text-slate-400">R$</span>
                                <input
                                  type="number"
                                  value={item.unitPrice || ""}
                                  step="0.01"
                                  min={0}
                                  onChange={e => updateItem(i, "unitPrice", parseFloat(e.target.value) || 0)}
                                  className="w-28 text-sm font-semibold text-slate-900 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 outline-none focus:border-blue-400"
                                  placeholder="0,00"
                                />
                              </div>
                              <PriceIndicator unitPrice={item.unitPrice} avgPrice={research?.avgPrice ?? null} />
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm font-semibold text-slate-800 w-32">
                            {item.total > 0 ? fmt(item.total) : "—"}
                          </td>
                          <td className="px-4 py-3">
                            {items.length > 1 && (
                              <button onClick={() => removeItem(i)} className="text-slate-300 hover:text-red-500 transition-colors text-xs">✕</button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: "#EFF6FF" }}>
                        <td colSpan={4} className="px-4 py-3" />
                        <td className="px-4 py-3 text-xs font-bold text-blue-800 uppercase">TOTAL GERAL</td>
                        <td className="px-4 py-3 text-base font-bold text-blue-700">{totalValue > 0 ? fmt(totalValue) : "—"}</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <div className="px-5 py-3" style={{ borderTop: "1px solid #E8EFF6" }}>
                  <button onClick={addItem} className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1">
                    + Adicionar item
                  </button>
                </div>
              </div>

              {/* Complementary fields */}
              <div className="bg-white rounded-2xl p-5 mt-5" style={{ border: "1px solid #E8EFF6", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
                <h3 className="text-sm font-bold text-slate-900 mb-4">Complementos da proposta</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5">Validade da proposta (dias)</label>
                    <input
                      type="number"
                      value={validityDays}
                      min={1}
                      onChange={e => setValidityDays(parseInt(e.target.value) || 60)}
                      className="w-full text-sm text-slate-800 border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-blue-400"
                    />
                    <p className="text-xs text-slate-400 mt-1">Mínimo exigido: 60 dias</p>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5">Prazo de entrega/execução</label>
                    <input
                      value={deliveryTerm}
                      onChange={e => setDeliveryTerm(e.target.value)}
                      placeholder="Ex.: 30 dias corridos"
                      className="w-full text-sm text-slate-800 border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-blue-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5">Marca / Fabricante</label>
                    <input
                      value={brandManufacturer}
                      onChange={e => setBrandManufacturer(e.target.value)}
                      placeholder="Se aplicável ao edital"
                      className="w-full text-sm text-slate-800 border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-blue-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5">Observações</label>
                    <input
                      value={observations}
                      onChange={e => setObservations(e.target.value)}
                      placeholder="Campo livre, opcional"
                      className="w-full text-sm text-slate-800 border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-blue-400"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Financial panel */}
            <div className="xl:w-80 flex-shrink-0">
              <div className="bg-white rounded-2xl overflow-hidden sticky top-4" style={{ border: "1px solid #E8EFF6", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
                <div className="px-5 py-4" style={{ borderBottom: "1px solid #E8EFF6", background: "#FAFBFC" }}>
                  <h3 className="text-sm font-bold text-slate-900">Análise da proposta</h3>
                </div>
                <div className="p-5 space-y-4">
                  {/* Total & estimate */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-slate-500">Valor da proposta</span>
                      <span className="text-base font-bold text-slate-900">{totalValue > 0 ? fmt(totalValue) : "—"}</span>
                    </div>
                    {estimatedValue > 0 && (
                      <>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-slate-500">Estimativa do órgão</span>
                          <span className="text-sm text-slate-600">{fmt(estimatedValue)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-500">Diferença</span>
                          <span className={cn("text-sm font-semibold", diffPct > 0 ? "text-red-600" : "text-green-600")}>
                            {totalValue > 0 ? fmtPct(diffPct) : "—"}
                          </span>
                        </div>
                      </>
                    )}
                  </div>

                  <div style={{ borderTop: "1px solid #E8EFF6", paddingTop: "1rem" }}>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Regime tributário</p>
                    <p className="text-xs text-slate-700 mb-3">{taxLabel(companyData?.porte)}</p>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-slate-500">(-) Impostos estimados</span>
                      <span className="text-sm text-slate-700">
                        {totalValue > 0 ? fmt(taxesEstimated) : "—"}
                        {totalValue > 0 && <span className="text-xs text-slate-400 ml-1">({(taxRate * 100).toFixed(1)}%)</span>}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-slate-500">(-) Custo do serviço</span>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-slate-400">R$</span>
                        <input
                          type="number"
                          value={declaredCost}
                          onChange={e => setDeclaredCost(e.target.value)}
                          placeholder="0,00"
                          className="w-24 text-xs text-slate-700 border border-slate-200 rounded px-2 py-1 outline-none focus:border-blue-400"
                        />
                      </div>
                    </div>
                    {!declaredCost && (
                      <p className="text-xs text-slate-400 mt-1">↑ informe seu custo para ver a margem</p>
                    )}
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs font-semibold text-slate-600">Margem estimada</span>
                      <span className={cn("text-sm font-bold", margin !== null ? (margin >= 0 ? "text-green-600" : "text-red-600") : "text-slate-400")}>
                        {margin !== null ? `${margin.toFixed(1)}%` : "—"}
                      </span>
                    </div>
                  </div>

                  <div style={{ borderTop: "1px solid #E8EFF6", paddingTop: "1rem" }}>
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className="text-base">🏆</span>
                      <p className="text-xs font-bold text-slate-800">Empate ficto (Benefício ME/EPP)</p>
                    </div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-slate-500">Teto para cobrir lances</span>
                      <span className="text-sm font-semibold text-blue-600">{totalValue > 0 ? fmt(empteFicto) : "—"}</span>
                    </div>
                    <p className="text-xs text-slate-400">5% acima do seu valor de proposta</p>
                  </div>

                  <div style={{ borderTop: "1px solid #E8EFF6", paddingTop: "1rem" }}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-slate-500">Garantia contratual (5%)</span>
                      <span className="text-sm font-semibold text-amber-600">{totalValue > 0 ? fmt(garantia) : "—"}</span>
                    </div>
                    {totalValue > 0 && (
                      <div className="flex items-start gap-1.5 mt-2 p-2 rounded-lg" style={{ background: "#FFFBEB" }}>
                        <AlertTriangle className="w-3 h-3 text-amber-500 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-700">Reserve este valor antes de enviar a proposta.</p>
                      </div>
                    )}
                  </div>

                  <Button
                    onClick={handleSaveDraft}
                    disabled={saving || totalValue === 0}
                    variant="outline"
                    size="sm"
                    className="w-full gap-2 border-slate-200"
                  >
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                    Salvar rascunho
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-between">
            <Button onClick={() => setSection("pesquisa")} variant="outline" size="sm" className="border-slate-200">
              ← Pesquisa de preço
            </Button>
            <Button
              onClick={() => { handleSaveDraft(); setSection("gerar"); }}
              disabled={saving || totalValue === 0}
              className="gap-2 text-white"
              style={{ background: "#0066FF" }}
            >
              Gerar documento <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ── SECTION 3: Gerar documento ────────────────────────────────────── */}
      {section === "gerar" && (
        <div className="space-y-5">
          {/* Summary */}
          <div className="bg-white rounded-2xl p-5" style={{ border: "1px solid #E8EFF6", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
            <h3 className="text-sm font-bold text-slate-900 mb-4">Gerar proposta comercial</h3>

            {totalValue === 0 && (
              <div className="flex items-start gap-3 p-3 rounded-xl mb-4" style={{ background: "#FFFBEB", border: "1px solid #FDE68A" }}>
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800">
                  Você ainda não preencheu os preços da proposta.{" "}
                  <button onClick={() => setSection("proposta")} className="font-semibold underline">Volte e preencha</button>{" "}
                  antes de gerar o documento.
                </p>
              </div>
            )}

            {/* Checkboxes */}
            <div className="space-y-2 mb-5">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Incluir no documento:</p>
              {[
                "Dados da empresa (razão social, CNPJ, endereço)",
                "Tabela de itens com preços",
                "Validade da proposta",
                "Prazo de entrega",
                "Local e data",
                "Campo de assinatura do representante legal",
              ].map(item => (
                <label key={item} className="flex items-center gap-2.5 cursor-default">
                  <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span className="text-sm text-slate-700">{item}</span>
                </label>
              ))}
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeDeclaration}
                  onChange={e => setIncludeDeclaration(e.target.checked)}
                  className="rounded border-slate-300"
                />
                <span className="text-sm text-slate-700">Declaração de ME/EPP (se já gerada, incluir aqui)</span>
              </label>
            </div>

            {/* Summary stats */}
            {totalValue > 0 && (
              <div className="grid grid-cols-3 gap-3 mb-5">
                {[
                  { label: "Valor total", value: fmt(totalValue), color: "#0066FF" },
                  { label: "Itens", value: String(items.length), color: "#0891B2" },
                  { label: "Validade", value: `${validityDays} dias`, color: "#059669" },
                ].map(s => (
                  <div key={s.label} className="rounded-xl p-3 text-center" style={{ background: "#F8FAFC", border: "1px solid #E8EFF6" }}>
                    <p className="text-base font-bold" style={{ color: s.color }}>{s.value}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>
            )}

            <Button
              onClick={handleGenerateDocx}
              disabled={generating || totalValue === 0}
              className="w-full gap-2 text-white"
              style={{ background: "#0066FF" }}
              size="lg"
            >
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {generating ? "Gerando..." : "✨ Gerar proposta (.docx)"}
            </Button>
          </div>

          {/* Generated doc */}
          {generatedUrl && (
            <div className="bg-white rounded-2xl p-5" style={{ border: "1px solid #BBF7D0", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#DCFCE7" }}>
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-bold text-green-900">Proposta gerada com sucesso</p>
                  <p className="text-xs text-green-700 mt-0.5 font-mono truncate max-w-xs">{generatedFilename}</p>
                </div>
              </div>

              <a href={generatedUrl} download className="block mb-4">
                <Button className="w-full gap-2 text-white" style={{ background: "#0066FF" }}>
                  <FileDown className="w-4 h-4" /> Baixar proposta
                </Button>
              </a>

              <div className="rounded-xl p-4" style={{ background: "#FFFBEB", border: "1px solid #FDE68A" }}>
                <p className="text-xs font-bold text-amber-900 mb-2">⚠️ Antes de enviar:</p>
                <ol className="text-xs text-amber-800 space-y-1 list-decimal list-inside">
                  <li>Revise todos os valores com calma</li>
                  <li>Assine o documento (física ou digitalmente)</li>
                  {process.sourceUrl && <li>Acesse o portal para envio: <a href={process.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline font-semibold">{process.agency} ↗</a></li>}
                </ol>
              </div>

              {/* Upload signed */}
              <div className="mt-4">
                <p className="text-xs font-semibold text-slate-500 mb-2">Enviar proposta assinada:</p>
                {signedDone ? (
                  <div className="flex items-center gap-2 p-3 rounded-xl" style={{ background: "#F0FDF4" }}>
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    <p className="text-sm font-semibold text-green-700">Proposta assinada enviada ✓</p>
                  </div>
                ) : (
                  <>
                    <input
                      type="file"
                      ref={signedInputRef}
                      className="hidden"
                      accept=".pdf,.docx,.doc"
                      onChange={e => { if (e.target.files?.[0]) handleUploadSigned(e.target.files[0]); }}
                    />
                    <Button
                      onClick={() => signedInputRef.current?.click()}
                      disabled={signedUploading}
                      variant="outline"
                      className="w-full gap-2 border-slate-200"
                    >
                      {signedUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                      Upload da proposta assinada
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Final checklist */}
          {showChecklist && (
            <div className="bg-white rounded-2xl overflow-hidden" style={{ border: "1px solid #E8EFF6", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
              <div className="px-5 py-4" style={{ borderBottom: "1px solid #E8EFF6", background: "#FAFBFC" }}>
                <h3 className="text-sm font-bold text-slate-900">Checklist final — pronto para enviar?</h3>
              </div>
              <div className="p-5 space-y-4">
                {/* Habilitação */}
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Habilitação</p>
                  <CheckItem
                    ok={docsReady}
                    label={docsReady ? "Todos os documentos de habilitação estão prontos" : `${valOk}/${valTotal} documentos conferidos`}
                  />
                </div>
                {/* Proposta */}
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Proposta</p>
                  <CheckItem ok={!!generatedUrl} label="Proposta gerada e baixada" />
                  <CheckItem ok={signedDone} label="Proposta assinada (faça upload acima)" />
                  <CheckItem ok={!aboveEstimate && totalValue > 0} label="Valor abaixo da estimativa do órgão" />
                  <CheckItem ok={validityDays >= 60} label={`Validade mínima atendida (${validityDays} dias)`} />
                </div>
                {/* Acesso ao portal */}
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Acesso ao portal</p>
                  <CheckItem ok={!!process.sourceUrl} label={process.sourceUrl ? `Portal identificado: ${process.agency}` : "Portal não identificado"} />
                  {process.editalNumber && (
                    <div className="flex items-center gap-2 mt-1.5">
                      <Info className="w-3.5 h-3.5 text-blue-400" />
                      <span className="text-xs text-slate-600">Número do edital para busca: {process.editalNumber}</span>
                    </div>
                  )}
                  {process.sourceUrl && (
                    <a href={process.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-2 block">
                      <Button size="sm" variant="outline" className="gap-1.5 border-slate-200">
                        Acessar portal <ExternalLink className="w-3 h-3" />
                      </Button>
                    </a>
                  )}
                </div>
                {/* Data da sessão */}
                {process.deadline && (
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Data e hora da sessão</p>
                    <div className="flex items-center gap-2">
                      <CalendarDays className="w-3.5 h-3.5 text-blue-500" />
                      <span className="text-xs text-slate-700">
                        Sessão: {new Date(process.deadline).toLocaleDateString("pt-BR")} às{" "}
                        {new Date(process.deadline).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  </div>
                )}

                {/* Overall status */}
                <div className="pt-2" style={{ borderTop: "1px solid #E8EFF6" }}>
                  {docsReady && signedDone && !aboveEstimate && validityDays >= 60 ? (
                    <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "#F0FDF4" }}>
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                      <p className="text-sm font-bold text-green-800">Pronto para envio! 🎉</p>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "#FFFBEB" }}>
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                      <p className="text-sm font-semibold text-amber-800">Pendente — complete os itens acima</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-start">
            <Button onClick={() => setSection("proposta")} variant="outline" size="sm" className="border-slate-200">
              ← Voltar à proposta
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── CheckItem helper ──────────────────────────────────────────────────────────

function CheckItem({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 py-1">
      {ok
        ? <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
        : <Lock className="w-4 h-4 text-red-400 flex-shrink-0" />}
      <span className={cn("text-xs", ok ? "text-slate-700" : "text-slate-500")}>{label}</span>
    </div>
  );
}

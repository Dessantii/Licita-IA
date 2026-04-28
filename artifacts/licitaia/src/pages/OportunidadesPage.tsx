import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  Search, RefreshCw, ExternalLink, Calendar, Tag, Star,
  Filter, Settings2, Save, X, Sparkles, Building2, Loader2,
  AlertCircle, TrendingUp, Clock, Zap, ChevronLeft, ChevronRight,
  Plus, Radio, CircleDot,
} from "lucide-react";
import { getToken } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { format, parseISO, isValid, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { notify } from "@/lib/feedback";
import { useLocation } from "wouter";

const API = import.meta.env.VITE_API_URL ?? "";

const AREAS: { value: string; label: string; color: string }[] = [
  { value: "todos", label: "Todas as áreas", color: "bg-zinc-100 text-zinc-700" },
  { value: "cultura", label: "Cultura & Arte", color: "bg-purple-100 text-purple-700" },
  { value: "arte", label: "Arte", color: "bg-fuchsia-100 text-fuchsia-700" },
  { value: "saude", label: "Saúde", color: "bg-rose-100 text-rose-700" },
  { value: "educacao", label: "Educação", color: "bg-blue-100 text-blue-700" },
  { value: "inovacao", label: "Inovação", color: "bg-cyan-100 text-cyan-700" },
  { value: "tecnologia", label: "Tecnologia", color: "bg-sky-100 text-sky-700" },
  { value: "social", label: "Social", color: "bg-orange-100 text-orange-700" },
  { value: "meio_ambiente", label: "Meio Ambiente", color: "bg-green-100 text-green-700" },
  { value: "esporte", label: "Esporte", color: "bg-yellow-100 text-yellow-700" },
  { value: "empreendedorismo", label: "Empreendedorismo", color: "bg-amber-100 text-amber-700" },
  { value: "pesquisa", label: "Pesquisa & C&T", color: "bg-indigo-100 text-indigo-700" },
  { value: "outro", label: "Outros", color: "bg-zinc-100 text-zinc-600" },
];

function getAreaInfo(area: string | null) {
  return AREAS.find((a) => a.value === area) ?? { label: area ?? "Outro", color: "bg-zinc-100 text-zinc-600" };
}

function deadlineBadge(deadline: string | null) {
  if (!deadline) return null;
  const d = parseISO(deadline);
  if (!isValid(d)) return null;
  const days = differenceInDays(d, new Date());
  if (days < 0) return { label: "Encerrado", color: "bg-zinc-100 text-zinc-500" };
  if (days === 0) return { label: "Encerra hoje!", color: "bg-red-100 text-red-700" };
  if (days <= 7) return { label: `${days}d restantes`, color: "bg-red-100 text-red-700" };
  if (days <= 30) return { label: `${days}d restantes`, color: "bg-amber-100 text-amber-700" };
  return { label: format(d, "dd/MM/yyyy", { locale: ptBR }), color: "bg-zinc-100 text-zinc-600" };
}

interface Opportunity {
  id: number;
  title: string;
  description: string | null;
  sourceName: string | null;
  area: string | null;
  targetAudience: string | null;
  link: string | null;
  maxValue: string | null;
  publishDate: string | null;
  deadline: string | null;
  isNew: boolean;
  createdAt: string;
}

interface Prefs {
  areas: string[];
  keywords: string[];
}

interface Source {
  id: number;
  name: string;
  url: string;
  type: string;
  fetchMethod: string;
  isActive: boolean;
  lastFetchedAt: string | null;
  lastFetchStatus: string | null;
  areaHint: string | null;
}

interface Stats {
  total: number;
  novas: number;
  fontes: number;
}

export function OportunidadesPage() {
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [collecting, setCollecting] = useState(false);

  const [q, setQ] = useState("");
  const [area, setArea] = useState("todos");
  const [novasSomente, setNovasSomente] = useState(false);

  const [stats, setStats] = useState<Stats | null>(null);
  const [prefs, setPrefs] = useState<Prefs>({ areas: [], keywords: [] });
  const [sources, setSources] = useState<Source[]>([]);

  const [tab, setTab] = useState<"oportunidades" | "fontes" | "preferencias">("oportunidades");
  const [prefAreas, setPrefAreas] = useState<string[]>([]);
  const [prefKeywords, setPrefKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState("");
  const [savingPrefs, setSavingPrefs] = useState(false);

  const authHeaders = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${getToken()}`,
  });

  const fetchStats = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/opportunities/stats`, { headers: authHeaders() });
      if (r.ok) setStats(await r.json());
    } catch {}
  }, []);

  const fetchPrefs = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/opportunities/preferences`, { headers: authHeaders() });
      if (r.ok) {
        const data = await r.json();
        setPrefs(data);
        setPrefAreas(data.areas ?? []);
        setPrefKeywords(data.keywords ?? []);
      }
    } catch {}
  }, []);

  const fetchSources = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/opportunities/sources`, { headers: authHeaders() });
      if (r.ok) setSources(await r.json());
    } catch {}
  }, []);

  const fetchOpportunities = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(p),
        limit: "12",
        ...(q && { q }),
        ...(area !== "todos" && { area }),
        ...(novasSomente && { novasSomente: "true" }),
      });
      const r = await fetch(`${API}/api/opportunities?${params}`, { headers: authHeaders() });
      if (!r.ok) throw new Error("Falha ao carregar oportunidades.");
      const data = await r.json();
      setOpportunities(data.data ?? []);
      setTotal(data.total ?? 0);
      setTotalPages(data.totalPages ?? 1);
    } catch (err: any) {
      notify(toast, "generic_error");
    } finally {
      setLoading(false);
    }
  }, [q, area, novasSomente, toast]);

  useEffect(() => {
    fetchStats();
    fetchPrefs();
    fetchSources();
  }, [fetchStats, fetchPrefs, fetchSources]);

  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1);
      fetchOpportunities(1);
    }, 300);
    return () => clearTimeout(t);
  }, [q, area, novasSomente, fetchOpportunities]);

  useEffect(() => {
    fetchOpportunities(page);
  }, [page]);

  const handleCollect = async () => {
    setCollecting(true);
    try {
      const r = await fetch(`${API}/api/opportunities/collect`, {
        method: "POST",
        headers: authHeaders(),
      });
      if (!r.ok) throw new Error();
      notify(toast, "save_success", { description: "Coleta iniciada. As oportunidades serão atualizadas em breve." });
      setTimeout(() => {
        fetchStats();
        fetchOpportunities(1);
      }, 5000);
    } catch {
      notify(toast, "generic_error");
    } finally {
      setCollecting(false);
    }
  };

  const handleSavePrefs = async () => {
    setSavingPrefs(true);
    try {
      const r = await fetch(`${API}/api/opportunities/preferences`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ areas: prefAreas, keywords: prefKeywords }),
      });
      if (!r.ok) throw new Error();
      notify(toast, "save_success");
      await fetchPrefs();
    } catch {
      notify(toast, "generic_error");
    } finally {
      setSavingPrefs(false);
    }
  };

  const toggleSourceActive = async (sourceId: number, isActive: boolean) => {
    try {
      const r = await fetch(`${API}/api/opportunities/sources/${sourceId}`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ isActive }),
      });
      if (!r.ok) throw new Error();
      setSources((prev) =>
        prev.map((s) => (s.id === sourceId ? { ...s, isActive } : s))
      );
    } catch {
      notify(toast, "generic_error");
    }
  };

  const addKeyword = () => {
    const kw = keywordInput.trim().toLowerCase();
    if (kw && !prefKeywords.includes(kw)) {
      setPrefKeywords((prev) => [...prev, kw]);
    }
    setKeywordInput("");
  };

  const togglePrefArea = (areaVal: string) => {
    setPrefAreas((prev) =>
      prev.includes(areaVal) ? prev.filter((a) => a !== areaVal) : [...prev, areaVal]
    );
  };

  const handleIniciarSubmissao = (opp: Opportunity) => {
    navigate(`/funding-projects/new?oportunidade=${encodeURIComponent(opp.title)}`);
  };

  return (
    <AppLayout title="Oportunidades de Captação">
      <div className="p-6 max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-violet-600" />
              <h1 className="text-2xl font-bold text-zinc-900">Oportunidades de Captação</h1>
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-violet-100 text-violet-700 flex items-center gap-1">
                <Radio className="w-3 h-3" /> Monitoramento Automático
              </span>
            </div>
            <p className="text-sm text-zinc-500 mt-1">
              Editais e chamadas coletados automaticamente de {stats?.fontes ?? "—"} fontes monitoradas
            </p>
          </div>
          <button
            onClick={handleCollect}
            disabled={collecting}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium transition-colors disabled:opacity-60"
          >
            {collecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {collecting ? "Coletando..." : "Executar coleta"}
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { icon: TrendingUp, label: "Total de oportunidades", value: stats?.total ?? 0, color: "text-violet-600" },
            { icon: Zap, label: "Novas (últimos 7 dias)", value: stats?.novas ?? 0, color: "text-amber-600" },
            { icon: CircleDot, label: "Fontes ativas", value: stats?.fontes ?? 0, color: "text-green-600" },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-xl border border-zinc-200 p-4 flex items-center gap-3">
              <div className={cn("p-2 rounded-lg bg-zinc-50", s.color)}>
                <s.icon className="w-5 h-5" />
              </div>
              <div>
                <div className="text-2xl font-bold text-zinc-900">{s.value}</div>
                <div className="text-xs text-zinc-500">{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-zinc-200 gap-1">
          {[
            { id: "oportunidades", label: "Oportunidades", icon: Sparkles },
            { id: "fontes", label: "Fontes monitoradas", icon: Radio },
            { id: "preferencias", label: "Minhas preferências", icon: Settings2 },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as any)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
                tab === t.id
                  ? "border-violet-600 text-violet-700"
                  : "border-transparent text-zinc-500 hover:text-zinc-800"
              )}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
            </button>
          ))}
        </div>

        {/* Oportunidades Tab */}
        {tab === "oportunidades" && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="bg-white rounded-xl border border-zinc-200 p-4 flex flex-wrap gap-3 items-center">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Buscar oportunidades..."
                  className="w-full pl-9 pr-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
                />
              </div>
              <select
                value={area}
                onChange={(e) => setArea(e.target.value)}
                className="border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white"
              >
                {AREAS.map((a) => (
                  <option key={a.value} value={a.value}>{a.label}</option>
                ))}
              </select>
              <label className="flex items-center gap-2 text-sm text-zinc-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={novasSomente}
                  onChange={(e) => setNovasSomente(e.target.checked)}
                  className="rounded border-zinc-300 text-violet-600"
                />
                Apenas novas (7 dias)
              </label>
            </div>

            {/* Results count */}
            <div className="flex items-center justify-between text-sm text-zinc-500">
              <span>{loading ? "Carregando..." : `${total} oportunidade${total !== 1 ? "s" : ""} encontrada${total !== 1 ? "s" : ""}`}</span>
              {totalPages > 1 && (
                <span>Página {page} de {totalPages}</span>
              )}
            </div>

            {/* Cards */}
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-violet-400" />
              </div>
            ) : opportunities.length === 0 ? (
              <div className="bg-white rounded-xl border border-zinc-200 p-12 text-center">
                <Sparkles className="w-10 h-10 text-violet-300 mx-auto mb-4" />
                <p className="text-zinc-700 font-medium mb-2">Nenhuma oportunidade encontrada</p>
                <p className="text-sm text-zinc-400 mb-6">
                  Execute uma coleta para buscar novas oportunidades nas fontes monitoradas,<br />
                  ou ajuste os filtros de busca.
                </p>
                <button
                  onClick={handleCollect}
                  disabled={collecting}
                  className="px-5 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium transition-colors disabled:opacity-60 flex items-center gap-2 mx-auto"
                >
                  {collecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  {collecting ? "Coletando..." : "Executar coleta agora"}
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {opportunities.map((opp) => {
                  const areaInfo = getAreaInfo(opp.area);
                  const deadlineInfo = deadlineBadge(opp.deadline);
                  const isExpired = deadlineInfo?.label === "Encerrado";

                  return (
                    <div
                      key={opp.id}
                      className={cn(
                        "bg-white rounded-xl border border-zinc-200 p-5 flex flex-col gap-3 hover:shadow-md transition-all",
                        isExpired && "opacity-60"
                      )}
                    >
                      {/* Top badges */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex flex-wrap gap-1.5">
                          <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", areaInfo.color)}>
                            {areaInfo.label}
                          </span>
                          {opp.isNew && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-violet-100 text-violet-700 flex items-center gap-1">
                              <Zap className="w-2.5 h-2.5" /> Novo
                            </span>
                          )}
                        </div>
                        {deadlineInfo && (
                          <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap", deadlineInfo.color)}>
                            {deadlineInfo.label}
                          </span>
                        )}
                      </div>

                      {/* Title */}
                      <h3 className="font-semibold text-zinc-900 text-sm leading-snug line-clamp-2">
                        {opp.title}
                      </h3>

                      {/* Description */}
                      {opp.description && (
                        <p className="text-xs text-zinc-500 line-clamp-3 leading-relaxed">
                          {opp.description}
                        </p>
                      )}

                      {/* Meta */}
                      <div className="flex flex-col gap-1 text-xs text-zinc-500">
                        {opp.sourceName && (
                          <div className="flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5 text-zinc-400" />
                            <span className="truncate">{opp.sourceName}</span>
                          </div>
                        )}
                        {opp.maxValue && (
                          <div className="flex items-center gap-1.5">
                            <Tag className="w-3.5 h-3.5 text-zinc-400" />
                            <span className="font-medium text-green-700">{opp.maxValue}</span>
                          </div>
                        )}
                        {opp.targetAudience && (
                          <div className="flex items-center gap-1.5">
                            <Filter className="w-3.5 h-3.5 text-zinc-400" />
                            <span className="truncate">{opp.targetAudience}</span>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 mt-auto pt-1">
                        <button
                          onClick={() => handleIniciarSubmissao(opp)}
                          disabled={isExpired}
                          className="flex-1 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Iniciar submissão
                        </button>
                        {opp.link && (
                          <a
                            href={opp.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 rounded-lg border border-zinc-200 hover:bg-zinc-50 transition-colors text-zinc-500"
                            title="Abrir edital original"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1 || loading}
                  className="p-2 rounded-lg border border-zinc-200 hover:bg-zinc-50 disabled:opacity-40 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm text-zinc-600">Página {page} de {totalPages}</span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages || loading}
                  className="p-2 rounded-lg border border-zinc-200 hover:bg-zinc-50 disabled:opacity-40 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Fontes Tab */}
        {tab === "fontes" && (
          <div className="space-y-4">
            <p className="text-sm text-zinc-500">
              Fontes monitoradas automaticamente para captação de recursos. Coletas ocorrem a cada 6–24 horas dependendo da fonte.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sources.map((source) => (
                <div key={source.id} className="bg-white rounded-xl border border-zinc-200 p-5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-zinc-900 text-sm leading-snug">{source.name}</p>
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-violet-600 hover:underline truncate block mt-0.5"
                      >
                        {source.url.slice(0, 60)}{source.url.length > 60 ? "…" : ""}
                      </a>
                    </div>
                    <button
                      onClick={() => toggleSourceActive(source.id, !source.isActive)}
                      className={cn(
                        "px-3 py-1 rounded-full text-xs font-medium transition-colors",
                        source.isActive
                          ? "bg-green-100 text-green-700 hover:bg-green-200"
                          : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
                      )}
                    >
                      {source.isActive ? "Ativa" : "Pausada"}
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-2 text-xs text-zinc-500">
                    <span className="flex items-center gap-1 px-2 py-0.5 bg-zinc-50 rounded-full">
                      <Tag className="w-3 h-3" />
                      {source.fetchMethod === "rss" ? "RSS" : "Web + IA"}
                    </span>
                    {source.areaHint && (
                      <span className="flex items-center gap-1 px-2 py-0.5 bg-violet-50 text-violet-700 rounded-full">
                        {source.areaHint.split(",").slice(0, 2).join(", ")}
                      </span>
                    )}
                    {source.lastFetchedAt && (
                      <span className="flex items-center gap-1 px-2 py-0.5 bg-zinc-50 rounded-full">
                        <Clock className="w-3 h-3" />
                        {format(parseISO(source.lastFetchedAt), "dd/MM HH:mm", { locale: ptBR })}
                      </span>
                    )}
                    {source.lastFetchStatus === "error" && (
                      <span className="flex items-center gap-1 px-2 py-0.5 bg-red-50 text-red-600 rounded-full">
                        <AlertCircle className="w-3 h-3" /> Erro na última coleta
                      </span>
                    )}
                    {source.lastFetchStatus === "ok" && (
                      <span className="flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-600 rounded-full">
                        <CircleDot className="w-3 h-3" /> OK
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Preferências Tab */}
        {tab === "preferencias" && (
          <div className="bg-white rounded-xl border border-zinc-200 p-6 space-y-6 max-w-2xl">
            <div>
              <h3 className="font-semibold text-zinc-900 mb-1">Áreas de interesse</h3>
              <p className="text-sm text-zinc-500 mb-4">
                Selecione as áreas para ver oportunidades relevantes em destaque.
              </p>
              <div className="flex flex-wrap gap-2">
                {AREAS.filter((a) => a.value !== "todos").map((a) => (
                  <button
                    key={a.value}
                    onClick={() => togglePrefArea(a.value)}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                      prefAreas.includes(a.value)
                        ? "border-violet-400 bg-violet-100 text-violet-800"
                        : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300"
                    )}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-zinc-900 mb-1">Palavras-chave</h3>
              <p className="text-sm text-zinc-500 mb-3">
                Adicione termos para filtrar oportunidades mais relevantes para você.
              </p>
              <div className="flex gap-2 mb-3">
                <input
                  value={keywordInput}
                  onChange={(e) => setKeywordInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addKeyword()}
                  placeholder="Ex: jovens, audiovisual, startup..."
                  className="flex-1 border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
                />
                <button
                  onClick={addKeyword}
                  className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium transition-colors"
                >
                  Adicionar
                </button>
              </div>
              {prefKeywords.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {prefKeywords.map((kw) => (
                    <span key={kw} className="flex items-center gap-1.5 px-3 py-1 bg-violet-50 text-violet-700 rounded-full text-xs font-medium border border-violet-200">
                      {kw}
                      <button onClick={() => setPrefKeywords((prev) => prev.filter((k) => k !== kw))}>
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={handleSavePrefs}
              disabled={savingPrefs}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium transition-colors disabled:opacity-60"
            >
              {savingPrefs ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {savingPrefs ? "Salvando..." : "Salvar preferências"}
            </button>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

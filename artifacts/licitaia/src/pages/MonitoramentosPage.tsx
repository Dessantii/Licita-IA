import { useState, useEffect, useCallback, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  Plus, Trash2, PlayCircle, PauseCircle, RefreshCw, Activity, MapPin, Tag,
  CheckCircle2, Loader2, AlertTriangle, Search, ExternalLink, Calendar,
  Building2, LayoutGrid, Settings2, ChevronLeft, ChevronRight, X, Filter,
  Newspaper, TrendingUp, Clock, FolderPlus, Bell, BellOff, Save,
} from "lucide-react";
import { getToken } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { format, parseISO, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CreateProcessDialog } from "@/components/processes/CreateProcessDialog";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";

const UFS = [
  "AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT",
  "PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO",
];

const MODALIDADES: Record<string, string> = {
  "Pregão Eletrônico": "Pregão Eletrônico",
  "Pregão Presencial": "Pregão Presencial",
  "Concorrência Eletrônica": "Concorrência Eletrônica",
  "Concorrência Presencial": "Concorrência Presencial",
  "Dispensa de Licitação": "Dispensa de Licitação",
  "Inexigibilidade": "Inexigibilidade",
  "Leilão Eletrônico": "Leilão Eletrônico",
  "Concurso": "Concurso",
};

const MODALIDADES_CREATE: Record<number, string> = {
  6: "Pregão Eletrônico",
  7: "Pregão Presencial",
  4: "Concorrência Eletrônica",
  5: "Concorrência Presencial",
  8: "Dispensa de Licitação",
  9: "Inexigibilidade",
  1: "Leilão Eletrônico",
  3: "Concurso",
};

interface Alert {
  id: number;
  titulo: string;
  modalidade: string | null;
  orgao: string | null;
  municipio: string | null;
  uf: string | null;
  dataPublicacao: string | null;
  urlPncp: string | null;
  pncpId: string | null;
  isRead: boolean;
  createdAt: string;
}

interface PortalResponse {
  data: Alert[];
  total: number;
  page: number;
  totalPages: number;
  todayCount: number;
}

interface Monitor {
  id: number;
  name: string;
  uf: string | null;
  municipio: string | null;
  modalidadeId: number | null;
  palavrasChave: string[] | null;
  isActive: boolean;
  lastCheckedAt: string | null;
}

function useApi() {
  const token = getToken();
  const headers = useMemo(() => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  }), [token]);
  return { headers, token };
}

function ModalidadeBadge({ modalidade }: { modalidade: string | null }) {
  if (!modalidade) return null;
  const colors: Record<string, string> = {
    "Pregão Eletrônico": "bg-blue-100 text-blue-700",
    "Pregão Presencial": "bg-indigo-100 text-indigo-700",
    "Concorrência Eletrônica": "bg-violet-100 text-violet-700",
    "Concorrência Presencial": "bg-purple-100 text-purple-700",
    "Dispensa de Licitação": "bg-amber-100 text-amber-700",
    "Inexigibilidade": "bg-orange-100 text-orange-700",
    "Leilão Eletrônico": "bg-red-100 text-red-700",
    "Concurso": "bg-emerald-100 text-emerald-700",
  };
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium", colors[modalidade] ?? "bg-slate-100 text-slate-600")}>
      {modalidade}
    </span>
  );
}

function LicitacaoCard({ alert, onImportFromPncp, isImporting }: {
  alert: Alert;
  onImportFromPncp?: (alert: Alert) => void;
  isImporting?: boolean;
}) {
  const date = alert.dataPublicacao
    ? (() => {
        try {
          const d = parseISO(alert.dataPublicacao);
          return isValid(d) ? format(d, "dd MMM yyyy", { locale: ptBR }) : alert.dataPublicacao;
        } catch { return alert.dataPublicacao; }
      })()
    : null;

  return (
    <div className="bg-white border border-border rounded-xl p-5 hover:border-primary/40 hover:shadow-sm transition-all group flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-800 line-clamp-2 leading-snug group-hover:text-primary transition-colors">
            {alert.titulo}
          </p>
          {alert.orgao && (
            <div className="flex items-center gap-1.5 mt-1.5">
              <Building2 className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
              <p className="text-xs text-slate-500 truncate">{alert.orgao}</p>
            </div>
          )}
        </div>
        {alert.urlPncp && (
          <a
            href={alert.urlPncp}
            target="_blank"
            rel="noopener"
            className="p-1.5 rounded-lg text-slate-400 hover:text-primary hover:bg-primary/5 transition flex-shrink-0"
            title="Ver no PNCP"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <ModalidadeBadge modalidade={alert.modalidade} />
        {(alert.municipio || alert.uf) && (
          <span className="inline-flex items-center gap-1 text-xs text-slate-500">
            <MapPin className="w-3 h-3" />
            {[alert.municipio, alert.uf].filter(Boolean).join(" — ")}
          </span>
        )}
        {date && (
          <span className="inline-flex items-center gap-1 text-xs text-slate-400 ml-auto">
            <Calendar className="w-3 h-3" />
            {date}
          </span>
        )}
      </div>

      {onImportFromPncp && (
        <button
          onClick={() => !isImporting && onImportFromPncp(alert)}
          disabled={isImporting}
          className="w-full flex items-center justify-center gap-2 mt-1 py-2 px-3 rounded-lg border border-dashed border-primary/30 text-primary text-xs font-medium hover:bg-primary/5 hover:border-primary/50 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isImporting ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Importando edital do PNCP...
            </>
          ) : (
            <>
              <FolderPlus className="w-3.5 h-3.5" />
              Criar processo a partir deste edital
            </>
          )}
        </button>
      )}
    </div>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${active ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${active ? "bg-green-500 animate-pulse" : "bg-slate-400"}`} />
      {active ? "Ativo" : "Pausado"}
    </span>
  );
}

interface NotifSettings {
  enabled: boolean;
  palavrasChave: string[];
}

export function MonitoramentosPage() {
  const { headers } = useApi();
  const [tab, setTab] = useState<"portal" | "monitores" | "notificacoes">("portal");

  const [portalData, setPortalData] = useState<PortalResponse | null>(null);
  const [portalLoading, setPortalLoading] = useState(true);
  const [filters, setFilters] = useState({
    search: "", uf: "", municipio: "", modalidade: "",
    dataInicial: "", dataFinal: "",
  });
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);

  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [monitorsLoading, setMonitorsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [checking, setChecking] = useState<number | null>(null);
  const [checkResult, setCheckResult] = useState<Record<number, number>>({});
  const [form, setForm] = useState({ name: "", uf: "", municipio: "", modalidadeId: "", palavrasChave: "" });

  const [notifSettings, setNotifSettings] = useState<NotifSettings>({ enabled: true, palavrasChave: [] });
  const [notifLoading, setNotifLoading] = useState(true);
  const [notifSaving, setNotifSaving] = useState(false);
  const [notifSaved, setNotifSaved] = useState(false);
  const [notifKeywordInput, setNotifKeywordInput] = useState("");

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createDialogPrefill, setCreateDialogPrefill] = useState<{ title?: string; agency?: string; modality?: string } | undefined>();
  const [importingAlertId, setImportingAlertId] = useState<number | null>(null);
  const [, navigate] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(filters.search), 400);
    return () => clearTimeout(t);
  }, [filters.search]);

  useEffect(() => { setPage(1); }, [debouncedSearch, filters.uf, filters.municipio, filters.modalidade, filters.dataInicial, filters.dataFinal]);

  const loadPortal = useCallback(async () => {
    setPortalLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "18" });
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (filters.uf) params.set("uf", filters.uf);
      if (filters.municipio) params.set("municipio", filters.municipio);
      if (filters.modalidade) params.set("modalidade", filters.modalidade);
      if (filters.dataInicial) params.set("dataInicial", filters.dataInicial);
      if (filters.dataFinal) params.set("dataFinal", filters.dataFinal);
      const res = await fetch(`/api/monitors/portal?${params}`, { headers });
      if (res.ok) setPortalData(await res.json());
    } finally {
      setPortalLoading(false);
    }
  }, [page, debouncedSearch, filters.uf, filters.municipio, filters.modalidade, filters.dataInicial, filters.dataFinal, headers]);

  useEffect(() => { loadPortal(); }, [loadPortal]);

  useEffect(() => {
    fetch("/api/monitors", { headers }).then(r => r.json()).then(d => {
      setMonitors(Array.isArray(d) ? d : []);
      setMonitorsLoading(false);
    }).catch(() => setMonitorsLoading(false));
  }, [headers]);

  useEffect(() => {
    setNotifLoading(true);
    fetch("/api/monitors/notification-settings", { headers })
      .then(r => r.json())
      .then(d => {
        setNotifSettings({ enabled: d.enabled ?? true, palavrasChave: d.palavrasChave ?? [] });
        setNotifLoading(false);
      })
      .catch(() => setNotifLoading(false));
  }, [headers]);

  async function handleSaveNotifSettings() {
    setNotifSaving(true);
    try {
      await fetch("/api/monitors/notification-settings", {
        method: "PATCH",
        headers,
        body: JSON.stringify({ enabled: notifSettings.enabled, palavrasChave: notifSettings.palavrasChave }),
      });
      setNotifSaved(true);
      setTimeout(() => setNotifSaved(false), 3000);
    } finally {
      setNotifSaving(false);
    }
  }

  function addNotifKeyword() {
    const trimmed = notifKeywordInput.trim();
    if (!trimmed || notifSettings.palavrasChave.includes(trimmed)) return;
    setNotifSettings(s => ({ ...s, palavrasChave: [...s.palavrasChave, trimmed] }));
    setNotifKeywordInput("");
  }

  function removeNotifKeyword(kw: string) {
    setNotifSettings(s => ({ ...s, palavrasChave: s.palavrasChave.filter(k => k !== kw) }));
  }

  async function handleImportFromPncp(alert: Alert) {
    if (!alert.urlPncp) {
      setCreateDialogPrefill({ title: alert.titulo, agency: alert.orgao ?? "", modality: alert.modalidade ?? "" });
      setCreateDialogOpen(true);
      return;
    }
    setImportingAlertId(alert.id);
    try {
      const res = await fetch("/api/monitors/import-from-pncp", {
        method: "POST",
        headers,
        body: JSON.stringify({
          urlPncp: alert.urlPncp,
          title: alert.titulo,
          agency: alert.orgao ?? "",
          modality: alert.modalidade ?? "",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao importar.");
      if (data.editalDownloaded) {
        toast({ title: "Edital importado com sucesso!", description: "O PDF foi baixado do PNCP e anexado ao processo." });
      } else {
        toast({ title: "Processo criado", description: "O edital não estava disponível para download automático." });
      }
      navigate(`/processes/${data.processId}`);
    } catch {
      toast({ title: "Importação automática indisponível", description: "Preencha o processo manualmente.", variant: "destructive" });
      setCreateDialogPrefill({ title: alert.titulo, agency: alert.orgao ?? "", modality: alert.modalidade ?? "" });
      setCreateDialogOpen(true);
    } finally {
      setImportingAlertId(null);
    }
  }

  const hasActiveFilters = filters.search || filters.uf || filters.municipio || filters.modalidade || filters.dataInicial || filters.dataFinal;

  function clearFilters() {
    setFilters({ search: "", uf: "", municipio: "", modalidade: "", dataInicial: "", dataFinal: "" });
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const palavras = form.palavrasChave ? form.palavrasChave.split(",").map(p => p.trim()).filter(Boolean) : [];
    await fetch("/api/monitors", {
      method: "POST", headers,
      body: JSON.stringify({
        name: form.name,
        uf: form.uf || undefined,
        municipio: form.municipio || undefined,
        modalidadeId: form.modalidadeId ? Number(form.modalidadeId) : undefined,
        palavrasChave: palavras.length > 0 ? palavras : undefined,
      }),
    });
    setForm({ name: "", uf: "", municipio: "", modalidadeId: "", palavrasChave: "" });
    setShowForm(false);
    fetch("/api/monitors", { headers }).then(r => r.json()).then(d => setMonitors(Array.isArray(d) ? d : []));
  }

  async function handleToggle(id: number) {
    await fetch(`/api/monitors/${id}/toggle`, { method: "POST", headers });
    fetch("/api/monitors", { headers }).then(r => r.json()).then(d => setMonitors(Array.isArray(d) ? d : []));
  }

  async function handleDelete(id: number) {
    if (!confirm("Excluir este monitoramento?")) return;
    await fetch(`/api/monitors/${id}`, { method: "DELETE", headers });
    fetch("/api/monitors", { headers }).then(r => r.json()).then(d => setMonitors(Array.isArray(d) ? d : []));
  }

  async function handleCheck(id: number) {
    setChecking(id);
    setCheckResult(prev => ({ ...prev, [id]: -1 }));
    try {
      const res = await fetch(`/api/monitors/${id}/check`, { method: "POST", headers });
      const data = await res.json();
      setCheckResult(prev => ({ ...prev, [id]: data.novosAlertas ?? 0 }));
      loadPortal();
    } catch {
      setCheckResult(prev => ({ ...prev, [id]: -2 }));
    } finally {
      setChecking(null);
    }
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-slate-900">Portal de Licitações</h1>
            <p className="text-slate-500 mt-1 text-sm">Editais monitorados via PNCP · Atualização automática a cada 2h</p>
          </div>
          <div className="flex items-center gap-2">
            {tab === "monitores" && (
              <button
                onClick={() => setShowForm(v => !v)}
                className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition"
              >
                <Plus className="w-4 h-4" />
                Novo monitor
              </button>
            )}
          </div>
        </div>

        <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit flex-wrap">
          <button
            onClick={() => setTab("portal")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
              tab === "portal" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700",
            )}
          >
            <LayoutGrid className="w-4 h-4" />
            Portal
            {portalData && <span className="bg-primary/10 text-primary text-xs font-semibold px-1.5 py-0.5 rounded-full">{portalData.total}</span>}
          </button>
          <button
            onClick={() => setTab("monitores")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
              tab === "monitores" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700",
            )}
          >
            <Settings2 className="w-4 h-4" />
            Monitores
            {monitors.length > 0 && (
              <span className="bg-slate-200 text-slate-600 text-xs font-semibold px-1.5 py-0.5 rounded-full">{monitors.length}</span>
            )}
          </button>
          <button
            onClick={() => setTab("notificacoes")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
              tab === "notificacoes" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700",
            )}
          >
            {notifSettings.enabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
            Notificações
          </button>
        </div>

        {tab === "portal" && (
          <div className="space-y-5">
            {portalData && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="bg-white border border-border rounded-xl p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Newspaper className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-900">{portalData.total.toLocaleString("pt-BR")}</p>
                    <p className="text-xs text-slate-500">Editais encontrados</p>
                  </div>
                </div>
                <div className="bg-white border border-border rounded-xl p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-900">{portalData.todayCount}</p>
                    <p className="text-xs text-slate-500">Novos hoje</p>
                  </div>
                </div>
                <div className="bg-white border border-border rounded-xl p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-violet-50 flex items-center justify-center">
                    <Activity className="w-5 h-5 text-violet-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-900">{monitors.filter(m => m.isActive).length}</p>
                    <p className="text-xs text-slate-500">Monitores ativos</p>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-white border border-border rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative flex-1 min-w-48">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    value={filters.search}
                    onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
                    placeholder="Buscar por título ou órgão..."
                    className="w-full pl-9 pr-3 py-2 text-sm border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <select
                  value={filters.uf}
                  onChange={e => setFilters(f => ({ ...f, uf: e.target.value }))}
                  className="border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white"
                >
                  <option value="">Todos os estados</option>
                  {UFS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                </select>
                <input
                  value={filters.municipio}
                  onChange={e => setFilters(f => ({ ...f, municipio: e.target.value }))}
                  placeholder="Cidade..."
                  className="border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 w-36"
                />
                <select
                  value={filters.modalidade}
                  onChange={e => setFilters(f => ({ ...f, modalidade: e.target.value }))}
                  className="border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white"
                >
                  <option value="">Todas as modalidades</option>
                  {Object.keys(MODALIDADES).map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <input
                    type="date"
                    value={filters.dataInicial}
                    onChange={e => setFilters(f => ({ ...f, dataInicial: e.target.value }))}
                    className="border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  <span className="text-slate-400 text-sm">até</span>
                  <input
                    type="date"
                    value={filters.dataFinal}
                    onChange={e => setFilters(f => ({ ...f, dataFinal: e.target.value }))}
                    className="border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-red-500 transition px-3 py-2 rounded-lg hover:bg-red-50 border border-dashed border-slate-300"
                  >
                    <X className="w-3.5 h-3.5" />
                    Limpar filtros
                  </button>
                )}
              </div>
            </div>

            {portalLoading ? (
              <div className="flex justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : !portalData || portalData.data.length === 0 ? (
              <div className="text-center py-20 bg-white border border-dashed border-border rounded-xl">
                {monitors.length === 0 ? (
                  <>
                    <Activity className="w-14 h-14 text-slate-200 mx-auto mb-4" />
                    <p className="font-semibold text-slate-700 text-lg">Nenhum monitor configurado</p>
                    <p className="text-slate-400 text-sm mt-2 max-w-sm mx-auto">
                      Configure monitores na aba "Monitores" para começar a receber editais do PNCP automaticamente.
                    </p>
                    <button
                      onClick={() => setTab("monitores")}
                      className="mt-4 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition"
                    >
                      Configurar monitores
                    </button>
                  </>
                ) : hasActiveFilters ? (
                  <>
                    <Filter className="w-14 h-14 text-slate-200 mx-auto mb-4" />
                    <p className="font-semibold text-slate-700">Nenhum edital encontrado com esses filtros</p>
                    <button onClick={clearFilters} className="mt-3 text-sm text-primary hover:underline">
                      Limpar filtros
                    </button>
                  </>
                ) : (
                  <>
                    <Clock className="w-14 h-14 text-slate-200 mx-auto mb-4" />
                    <p className="font-semibold text-slate-700">Aguardando editais</p>
                    <p className="text-slate-400 text-sm mt-2">
                      O sistema verifica o PNCP a cada 2h. Clique em "Atualizar" em um monitor para verificar agora.
                    </p>
                    <button
                      onClick={() => setTab("monitores")}
                      className="mt-3 text-sm text-primary hover:underline"
                    >
                      Ir para monitores
                    </button>
                  </>
                )}
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-500">
                    {portalData.total.toLocaleString("pt-BR")} edital(is) encontrado(s)
                    {hasActiveFilters && " com esses filtros"}
                  </p>
                  <p className="text-xs text-slate-400">
                    Página {portalData.page} de {portalData.totalPages}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {portalData.data.map(alert => (
                    <LicitacaoCard key={alert.id} alert={alert} onImportFromPncp={handleImportFromPncp} isImporting={importingAlertId === alert.id} />
                  ))}
                </div>

                {portalData.totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 pt-2">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="p-2 rounded-lg border border-border hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    {Array.from({ length: Math.min(7, portalData.totalPages) }, (_, i) => {
                      let p: number;
                      if (portalData.totalPages <= 7) p = i + 1;
                      else if (page <= 4) p = i + 1;
                      else if (page >= portalData.totalPages - 3) p = portalData.totalPages - 6 + i;
                      else p = page - 3 + i;
                      return (
                        <button
                          key={p}
                          onClick={() => setPage(p)}
                          className={cn(
                            "w-9 h-9 rounded-lg text-sm font-medium transition",
                            page === p ? "bg-primary text-white" : "border border-border hover:bg-slate-50 text-slate-700",
                          )}
                        >
                          {p}
                        </button>
                      );
                    })}
                    <button
                      onClick={() => setPage(p => Math.min(portalData.totalPages, p + 1))}
                      disabled={page === portalData.totalPages}
                      className="p-2 rounded-lg border border-border hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {tab === "monitores" && (
          <div className="space-y-4">
            {showForm && (
              <div className="bg-white border border-border rounded-xl p-6 shadow-sm">
                <h2 className="font-semibold text-foreground mb-4">Configurar monitor</h2>
                <form onSubmit={handleCreate} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">Nome *</label>
                      <input
                        required
                        value={form.name}
                        onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                        placeholder="Ex: Pregões SP — Tecnologia"
                        className="w-full border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">Estado (UF)</label>
                      <select
                        value={form.uf}
                        onChange={e => setForm(f => ({ ...f, uf: e.target.value }))}
                        className="w-full border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                      >
                        <option value="">Todos os estados</option>
                        {UFS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">Cidade</label>
                      <input
                        value={form.municipio}
                        onChange={e => setForm(f => ({ ...f, municipio: e.target.value }))}
                        placeholder="Ex: São Paulo, Campinas..."
                        className="w-full border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">Modalidade</label>
                      <select
                        value={form.modalidadeId}
                        onChange={e => setForm(f => ({ ...f, modalidadeId: e.target.value }))}
                        className="w-full border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                      >
                        <option value="">Todas</option>
                        {Object.entries(MODALIDADES_CREATE).map(([id, nome]) => (
                          <option key={id} value={id}>{nome}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5 md:col-span-2">
                      <label className="text-sm font-medium">Palavras-chave (separadas por vírgula)</label>
                      <input
                        value={form.palavrasChave}
                        onChange={e => setForm(f => ({ ...f, palavrasChave: e.target.value }))}
                        placeholder="Ex: construção, reforma, pavimentação"
                        className="w-full border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    </div>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button type="submit" className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition">
                      Criar monitor
                    </button>
                    <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-sm font-medium border border-border hover:bg-slate-50 transition">
                      Cancelar
                    </button>
                  </div>
                </form>
              </div>
            )}

            {!showForm && (
              <button
                onClick={() => setShowForm(true)}
                className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition w-fit"
              >
                <Plus className="w-4 h-4" />
                Novo monitor
              </button>
            )}

            {monitorsLoading ? (
              <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
            ) : monitors.length === 0 ? (
              <div className="text-center py-16 bg-white border border-dashed border-border rounded-xl">
                <Activity className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="font-semibold text-foreground">Nenhum monitor configurado</p>
                <p className="text-muted-foreground text-sm mt-1 max-w-sm mx-auto">
                  Crie monitores para o sistema verificar automaticamente o PNCP e trazer editais para o portal.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {monitors.map(m => (
                  <div key={m.id} className="bg-white border border-border rounded-xl p-5 flex items-start justify-between gap-4 hover:border-primary/30 transition">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-foreground truncate">{m.name}</h3>
                        <StatusBadge active={m.isActive} />
                      </div>
                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                        {(m.municipio || m.uf) && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5" />
                            {[m.municipio, m.uf].filter(Boolean).join(" — ")}
                          </span>
                        )}
                        {m.modalidadeId && (
                          <span className="flex items-center gap-1">
                            <Tag className="w-3.5 h-3.5" />
                            {MODALIDADES_CREATE[m.modalidadeId] ?? `Modalidade ${m.modalidadeId}`}
                          </span>
                        )}
                        {m.palavrasChave && m.palavrasChave.length > 0 && (
                          <span className="flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {m.palavrasChave.join(", ")}
                          </span>
                        )}
                      </div>
                      {m.lastCheckedAt && (
                        <p className="text-xs text-slate-400 mt-2">
                          Última verificação: {new Date(m.lastCheckedAt).toLocaleString("pt-BR")}
                        </p>
                      )}
                      {checkResult[m.id] !== undefined && checkResult[m.id] !== -1 && (
                        <p className={cn("text-xs mt-1 font-medium", checkResult[m.id] === -2 ? "text-red-500" : checkResult[m.id] > 0 ? "text-green-600" : "text-slate-400")}>
                          {checkResult[m.id] === -2
                            ? "Erro ao verificar o PNCP."
                            : checkResult[m.id] > 0
                            ? `✓ ${checkResult[m.id]} novo(s) edital(is) encontrado(s)!`
                            : "✓ Nenhum edital novo."}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => handleCheck(m.id)}
                        disabled={checking === m.id}
                        title="Verificar agora"
                        className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-primary transition disabled:opacity-40"
                      >
                        {checking === m.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => handleToggle(m.id)}
                        title={m.isActive ? "Pausar" : "Ativar"}
                        className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-primary transition"
                      >
                        {m.isActive ? <PauseCircle className="w-4 h-4" /> : <PlayCircle className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => handleDelete(m.id)}
                        title="Excluir"
                        className="p-2 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
              <AlertTriangle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-blue-700">
                <strong>Como funciona:</strong> Cada monitor acompanha o{" "}
                <a href="https://pncp.gov.br" target="_blank" rel="noopener" className="underline">PNCP</a>
                {" "}com os filtros configurados. O sistema verifica a cada 2h e todos os editais aparecem no portal.
                Use o botão de atualizar <RefreshCw className="inline w-3.5 h-3.5 mx-0.5" /> para verificar imediatamente.
              </p>
            </div>
          </div>
        )}

        {tab === "notificacoes" && (
          <div className="max-w-2xl space-y-6">
            {notifLoading ? (
              <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
            ) : (
              <>
                <div className="bg-white border border-border rounded-xl p-6 space-y-5">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Configurações de Notificação</h2>
                    <p className="text-sm text-slate-500 mt-1">
                      Configure como você quer receber alertas no sino (🔔) sobre novos editais encontrados pelos monitores.
                    </p>
                  </div>

                  <div className="flex items-center justify-between py-4 border-t border-b border-border">
                    <div>
                      <p className="text-sm font-medium text-slate-800">Receber notificações</p>
                      <p className="text-xs text-slate-500 mt-0.5">Ative para receber alertas de novos editais no sino</p>
                    </div>
                    <button
                      onClick={() => setNotifSettings(s => ({ ...s, enabled: !s.enabled }))}
                      className={cn(
                        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none",
                        notifSettings.enabled ? "bg-primary" : "bg-slate-200",
                      )}
                    >
                      <span
                        className={cn(
                          "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
                          notifSettings.enabled ? "translate-x-6" : "translate-x-1",
                        )}
                      />
                    </button>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <p className="text-sm font-medium text-slate-800">Filtrar por palavras-chave</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Se configuradas, você só receberá notificações de editais que contenham estas palavras no título ou órgão.
                        Deixe em branco para receber tudo.
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <input
                        value={notifKeywordInput}
                        onChange={e => setNotifKeywordInput(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addNotifKeyword())}
                        placeholder="Ex: construção, TI, saúde..."
                        disabled={!notifSettings.enabled}
                        className="flex-1 border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                      <button
                        onClick={addNotifKeyword}
                        disabled={!notifSettings.enabled || !notifKeywordInput.trim()}
                        className="px-4 py-2 rounded-lg text-sm font-medium bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition"
                      >
                        Adicionar
                      </button>
                    </div>

                    {notifSettings.palavrasChave.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {notifSettings.palavrasChave.map(kw => (
                          <span
                            key={kw}
                            className={cn(
                              "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium",
                              notifSettings.enabled
                                ? "bg-primary/10 text-primary"
                                : "bg-slate-100 text-slate-400",
                            )}
                          >
                            {kw}
                            <button
                              onClick={() => removeNotifKeyword(kw)}
                              className="hover:text-red-500 transition"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic">
                        Nenhuma palavra-chave configurada — você receberá notificações de todos os editais.
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={handleSaveNotifSettings}
                    disabled={notifSaving}
                    className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 transition disabled:opacity-60"
                  >
                    {notifSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Salvar configurações
                  </button>
                  {notifSaved && (
                    <span className="flex items-center gap-1.5 text-sm text-green-600 font-medium">
                      <CheckCircle2 className="w-4 h-4" />
                      Salvo com sucesso!
                    </span>
                  )}
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-700">
                    As configurações de notificação afetam apenas o sino (🔔) na barra superior.
                    O portal continua exibindo todos os editais encontrados pelos monitores,
                    independente dessas configurações.
                  </p>
                </div>
              </>
            )}
          </div>
        )}

        <CreateProcessDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          prefill={createDialogPrefill}
        />
      </div>
    </AppLayout>
  );
}

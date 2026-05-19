import { useState, useMemo, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useListProcesses } from "@workspace/api-client-react";
import { useActiveCompany } from "@/contexts/CompanyContext";
import { CreateProcessDialog } from "@/components/processes/CreateProcessDialog";
import { Link } from "wouter";
import { format, differenceInDays, differenceInHours } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  FileText, ChevronRight, Building2, Search, X,
  CheckCircle2, Clock, FolderKanban, ChevronLeft,
  AlertTriangle, Gavel, Plus, ArrowRight, Timer,
  Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 12;

interface AlertPrefill {
  title?: string;
  agency?: string;
  modality?: string;
  source?: string;
}

type ProcessStatus =
  | "criado"
  | "edital_enviado"
  | "edital_processando"
  | "exigencias_extraidas"
  | "aguardando_documentos"
  | "documentos_enviados"
  | "em_conferencia"
  | "pendencias_encontradas"
  | "pronto_para_revisao"
  | "concluido";

function getStatusInfo(status: string): {
  label: string;
  sublabel: string;
  step: 1 | 2 | 3;
  readiness: number;
  color: string;
  bg: string;
  urgent: boolean;
} {
  switch (status) {
    case "criado":
      return { label: "Aguardando edital", sublabel: "Envie o PDF do edital para começar", step: 1, readiness: 5, color: "#64748b", bg: "#f8fafc", urgent: false };
    case "edital_enviado":
      return { label: "Edital enviado", sublabel: "Aguardando análise da IA", step: 1, readiness: 20, color: "#0066FF", bg: "#EFF6FF", urgent: false };
    case "edital_processando":
      return { label: "Analisando edital...", sublabel: "A IA está lendo o edital", step: 1, readiness: 30, color: "#0066FF", bg: "#EFF6FF", urgent: false };
    case "exigencias_extraidas":
      return { label: "Edital analisado ✓", sublabel: "Envie seus documentos agora", step: 1, readiness: 40, color: "#059669", bg: "#F0FDF4", urgent: true };
    case "aguardando_documentos":
      return { label: "Envie seus documentos", sublabel: "Edital pronto — faltam os documentos", step: 2, readiness: 45, color: "#D97706", bg: "#FFFBEB", urgent: true };
    case "documentos_enviados":
      return { label: "Documentos enviados", sublabel: "Pronto para conferência", step: 2, readiness: 60, color: "#0066FF", bg: "#EFF6FF", urgent: true };
    case "em_conferencia":
      return { label: "Em conferência", sublabel: "A IA está verificando seus documentos", step: 2, readiness: 70, color: "#0066FF", bg: "#EFF6FF", urgent: false };
    case "pendencias_encontradas":
      return { label: "Pendências encontradas", sublabel: "Confira o que precisa ser corrigido", step: 2, readiness: 55, color: "#DC2626", bg: "#FEF2F2", urgent: true };
    case "pronto_para_revisao":
      return { label: "Quase lá!", sublabel: "Revise e gere o relatório final", step: 3, readiness: 90, color: "#059669", bg: "#F0FDF4", urgent: true };
    case "concluido":
      return { label: "Concluído ✓", sublabel: "Processo finalizado com sucesso", step: 3, readiness: 100, color: "#059669", bg: "#F0FDF4", urgent: false };
    default:
      return { label: status, sublabel: "", step: 1, readiness: 0, color: "#64748b", bg: "#f8fafc", urgent: false };
  }
}

function getDeadlineUrgency(deadline: string | null | undefined): {
  label: string;
  color: string;
  textColor: string;
  daysLeft: number | null;
  closed: boolean;
} | null {
  if (!deadline) return null;
  const now = new Date();
  const d = new Date(deadline);
  const daysLeft = differenceInDays(d, now);
  const hoursLeft = differenceInHours(d, now);

  if (hoursLeft < 0) return { label: "Encerrada", color: "bg-slate-100", textColor: "text-slate-500", daysLeft: null, closed: true };
  if (hoursLeft < 24) return { label: "Hoje!", color: "bg-red-100", textColor: "text-red-700", daysLeft: 0, closed: false };
  if (daysLeft <= 3) return { label: `${daysLeft}d restantes`, color: "bg-red-100", textColor: "text-red-700", daysLeft, closed: false };
  if (daysLeft <= 7) return { label: `${daysLeft}d restantes`, color: "bg-orange-100", textColor: "text-orange-700", daysLeft, closed: false };
  if (daysLeft <= 14) return { label: `${daysLeft}d restantes`, color: "bg-yellow-100", textColor: "text-yellow-700", daysLeft, closed: false };
  return { label: `${daysLeft}d restantes`, color: "bg-green-100", textColor: "text-green-700", daysLeft, closed: false };
}

function ReadinessBar({ value, step }: { value: number; step: 1 | 2 | 3 }) {
  const color = value === 100 ? "#059669" : value >= 70 ? "#0066FF" : value >= 40 ? "#D97706" : "#94a3b8";
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] text-slate-400 font-medium">
          Etapa {step} de 3
        </span>
        <span className="text-[11px] font-semibold" style={{ color }}>
          {value}%
        </span>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${value}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

export function ProcessesPage() {
  const { data: processes, isLoading } = useListProcesses();
  const { activeCompany } = useActiveCompany();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [alertPrefill, setAlertPrefill] = useState<AlertPrefill | undefined>(undefined);

  useEffect(() => {
    const raw = sessionStorage.getItem("licitaia_alert_prefill");
    if (raw) {
      try { setAlertPrefill(JSON.parse(raw)); } catch {}
      sessionStorage.removeItem("licitaia_alert_prefill");
    }
  }, []);

  useEffect(() => { setPage(1); }, [search, activeCompany]);

  const filtered = useMemo(() => {
    if (!processes) return [];
    let result = processes;
    if (activeCompany) {
      result = result.filter(p => (p as any).companyId === activeCompany.id);
    }
    const q = search.toLowerCase().trim();
    if (!q) return result;
    return result.filter(p =>
      p.title.toLowerCase().includes(q) ||
      p.agency.toLowerCase().includes(q) ||
      p.modality.toLowerCase().includes(q) ||
      (p.editalNumber?.toLowerCase().includes(q) ?? false)
    );
  }, [processes, search, activeCompany]);

  const { active, closed } = useMemo(() => {
    const active = filtered.filter(p => p.status !== "concluido" && getDeadlineUrgency(p.deadline)?.closed !== true);
    const closed = filtered.filter(p => p.status === "concluido" || getDeadlineUrgency(p.deadline)?.closed === true);
    return { active, closed };
  }, [filtered]);

  const urgentProcess = useMemo(() => {
    return active
      .filter(p => {
        const d = getDeadlineUrgency(p.deadline);
        return d && !d.closed && d.daysLeft !== null && d.daysLeft <= 7;
      })
      .sort((a, b) => {
        const da = new Date(a.deadline ?? "").getTime();
        const db = new Date(b.deadline ?? "").getTime();
        return da - db;
      })[0];
  }, [active]);

  const totalPages = Math.max(1, Math.ceil(active.length / PAGE_SIZE));
  const paginatedActive = active.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <AppLayout>
      <div className="px-8 py-8 max-w-6xl">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-1 text-xs mb-2 font-medium" style={{ color: '#94a3b8' }}>
            LicitaIA <ChevronRight className="w-3 h-3" /> Licitações
          </div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Suas licitações</h1>
              <p className="text-sm text-slate-500 mt-1">
                Acompanhe cada processo — do edital até a proposta.
              </p>
            </div>
            <CreateProcessDialog prefill={alertPrefill} defaultOpen={!!alertPrefill} />
          </div>
        </div>

        {/* Empty state */}
        {!isLoading && (!processes || processes.length === 0) && (
          <div className="text-center py-24 bg-white rounded-2xl border-2 border-dashed border-slate-200">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: '#E5F0FF' }}>
              <Gavel className="w-8 h-8" style={{ color: '#0066FF' }} />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Nenhuma licitação ainda</h3>
            <p className="text-slate-500 mt-2 max-w-sm mx-auto text-sm leading-relaxed">
              Encontrou um edital que te interessa? Adicione aqui e vamos te ajudar a se preparar.
            </p>
            <div className="mt-6">
              <CreateProcessDialog />
            </div>
          </div>
        )}

        {/* Urgency banner — most urgent active process */}
        {urgentProcess && (() => {
          const info = getStatusInfo(urgentProcess.status);
          const deadline = getDeadlineUrgency(urgentProcess.deadline);
          return (
            <Link href={`/processes/${urgentProcess.id}`} className="block mb-6">
              <div className="rounded-2xl p-5 flex items-center gap-5 cursor-pointer transition-all duration-150 hover:shadow-md"
                style={{ background: 'linear-gradient(135deg, #0A2540 0%, #1A3A5C 100%)', border: '1px solid #1A3A5C' }}>
                <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,255,255,0.10)' }}>
                  <Timer className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-blue-300 mb-0.5 uppercase tracking-wider">
                    {deadline?.daysLeft === 0 ? "⚠️ Prazo hoje!" : `⚠️ Prazo em ${deadline?.daysLeft} dias`}
                  </p>
                  <p className="font-bold text-white truncate text-sm">{urgentProcess.title}</p>
                  <p className="text-xs text-blue-200 mt-0.5">{info.sublabel}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-sm font-semibold text-white hidden sm:block">Ver processo</span>
                  <ArrowRight className="w-5 h-5 text-blue-300" />
                </div>
              </div>
            </Link>
          );
        })()}

        {/* Search */}
        {(processes?.length ?? 0) > 0 && (
          <div className="relative mb-6">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por título, órgão ou número do edital..."
              className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-10 py-2.5 text-sm outline-none transition-shadow focus:ring-2 focus:ring-blue-100 focus:border-blue-300"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
            {[1,2,3].map(i => (
              <div key={i} className="h-44 animate-pulse bg-slate-100 rounded-2xl" />
            ))}
          </div>
        )}

        {/* No search results */}
        {!isLoading && processes && processes.length > 0 && filtered.length === 0 && (
          <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
            <Search className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="font-semibold text-slate-700">Nenhum resultado para "{search}"</p>
            <button onClick={() => setSearch("")} className="mt-3 text-sm font-semibold text-blue-600 hover:underline">
              Limpar busca
            </button>
          </div>
        )}

        {/* Active processes */}
        {!isLoading && active.length > 0 && (
          <>
            {closed.length > 0 && (
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">
                Em andamento ({active.length})
              </p>
            )}
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5 mb-8">
              {paginatedActive.map((process) => {
                const info = getStatusInfo(process.status);
                const deadline = getDeadlineUrgency(process.deadline);
                return (
                  <Link key={process.id} href={`/processes/${process.id}`} className="block group">
                    <div
                      className="bg-white rounded-2xl h-full flex flex-col transition-all duration-150 group-hover:shadow-md"
                      style={{ border: '1px solid #E8EFF6', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
                    >
                      <div className="p-5 flex-1 flex flex-col">

                        {/* Top row: status + deadline */}
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <span
                            className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
                            style={{ background: info.bg, color: info.color }}
                          >
                            {info.label}
                          </span>
                          {deadline && !deadline.closed && (
                            <span className={cn("text-xs font-semibold px-2 py-1 rounded-full flex items-center gap-1", deadline.color, deadline.textColor)}>
                              <Timer className="w-3 h-3" />
                              {deadline.label}
                            </span>
                          )}
                        </div>

                        {/* Title */}
                        <h3 className="font-bold text-slate-900 text-sm leading-snug mb-1 line-clamp-2 group-hover:text-blue-600 transition-colors">
                          {process.title}
                        </h3>

                        {/* Company tag */}
                        {process.companyName && (
                          <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full inline-block mb-2 self-start">
                            {process.companyName}
                          </span>
                        )}

                        {/* Meta */}
                        <div className="mt-auto space-y-1.5">
                          <div className="flex items-center text-xs text-slate-500 gap-1.5">
                            <Building2 className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                            <span className="truncate">{process.agency}</span>
                          </div>
                          {process.deadline && (
                            <div className="flex items-center text-xs text-slate-500 gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                              <span>
                                Fecha em {format(new Date(process.deadline), "dd/MM 'às' HH:mm", { locale: ptBR })}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Readiness bar */}
                        <ReadinessBar value={info.readiness} step={info.step} />
                      </div>

                      {/* Footer */}
                      <div
                        className="px-5 py-3 flex items-center justify-between rounded-b-2xl"
                        style={{ background: '#F8FAFC', borderTop: '1px solid #E8EFF6' }}
                      >
                        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
                          {process.modality}
                          {process.editalNumber ? ` · ${process.editalNumber}` : ""}
                        </span>
                        <span className="text-xs font-semibold text-blue-600 flex items-center gap-1 group-hover:gap-1.5 transition-all">
                          Abrir <ChevronRight className="w-3.5 h-3.5" />
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mb-8">
                <p className="text-sm text-slate-500">
                  {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, active.length)} de {active.length} processos
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-4 h-4" /> Anterior
                  </button>
                  <span className="text-sm text-slate-600 font-medium">{page} / {totalPages}</span>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Próximo <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Closed / Concluded processes */}
        {!isLoading && closed.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">
              Encerrados ({closed.length})
            </p>
            <div className="space-y-2">
              {closed.map((process) => {
                const info = getStatusInfo(process.status);
                return (
                  <Link key={process.id} href={`/processes/${process.id}`} className="block group">
                    <div
                      className="bg-white rounded-xl px-5 py-3.5 flex items-center gap-4 transition-all hover:bg-slate-50"
                      style={{ border: '1px solid #E8EFF6' }}
                    >
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-slate-100">
                        {process.status === "concluido"
                          ? <CheckCircle2 className="w-4 h-4 text-green-500" />
                          : <Lock className="w-4 h-4 text-slate-400" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-600 truncate">{process.title}</p>
                        <p className="text-xs text-slate-400 truncate">{process.agency}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: info.bg, color: info.color }}>
                          {info.label}
                        </span>
                        {process.deadline && (
                          <p className="text-[11px] text-slate-400 mt-1">
                            {format(new Date(process.deadline), "dd/MM/yyyy", { locale: ptBR })}
                          </p>
                        )}
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 flex-shrink-0" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </AppLayout>
  );
}

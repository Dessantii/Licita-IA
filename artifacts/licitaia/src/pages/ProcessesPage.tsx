import { useState, useMemo, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useListProcesses } from "@workspace/api-client-react";
import { ProcessStatusBadge } from "@/components/processes/ProcessStatusBadge";
import { CreateProcessDialog } from "@/components/processes/CreateProcessDialog";
import { Card } from "@/components/ui/card";
import { Link } from "wouter";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  FileText,
  ChevronRight,
  Calendar,
  Building2,
  Search,
  X,
  CheckCircle2,
  AlertCircle,
  Clock,
  FolderKanban,
  ChevronLeft,
  Timer,
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 12;

interface AlertPrefill {
  title?: string;
  agency?: string;
  modality?: string;
  source?: string;
}

function getDeadlineInfo(deadline: string | null | undefined) {
  if (!deadline) return null;
  const now = new Date();
  const d = new Date(deadline);
  const diffMs = d.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return { label: "Prazo encerrado", color: "bg-slate-100 text-slate-500" };
  if (diffDays === 0) return { label: "Hoje!", color: "bg-red-100 text-red-700" };
  if (diffDays <= 3) return { label: `${diffDays}d restante${diffDays !== 1 ? "s" : ""}`, color: "bg-red-100 text-red-700" };
  if (diffDays <= 7) return { label: `${diffDays}d restantes`, color: "bg-orange-100 text-orange-700" };
  if (diffDays <= 14) return { label: `${diffDays}d restantes`, color: "bg-yellow-100 text-yellow-700" };
  return { label: `${diffDays}d restantes`, color: "bg-green-100 text-green-700" };
}

export function ProcessesPage() {
  const { data: processes, isLoading } = useListProcesses();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [alertPrefill, setAlertPrefill] = useState<AlertPrefill | undefined>(undefined);

  useEffect(() => {
    const raw = sessionStorage.getItem("licitaia_alert_prefill");
    if (raw) {
      try {
        setAlertPrefill(JSON.parse(raw));
      } catch {}
      sessionStorage.removeItem("licitaia_alert_prefill");
    }
  }, []);

  useEffect(() => {
    setPage(1);
  }, [search]);

  const filtered = useMemo(() => {
    if (!processes) return [];
    const q = search.toLowerCase().trim();
    if (!q) return processes;
    return processes.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.agency.toLowerCase().includes(q) ||
        p.modality.toLowerCase().includes(q) ||
        (p.editalNumber?.toLowerCase().includes(q) ?? false)
    );
  }, [processes, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const stats = useMemo(() => {
    if (!processes) return null;
    const total = processes.length;
    const concluidos = processes.filter((p) => p.status === "concluido").length;
    const comPendencias = processes.filter((p) => p.status === "pendencias_encontradas").length;
    const emAndamento = processes.filter(
      (p) => !["concluido", "criado"].includes(p.status)
    ).length;
    return { total, concluidos, comPendencias, emAndamento };
  }, [processes]);

  return (
    <AppLayout>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-slate-900">Processos Licitatórios</h1>
          <p className="text-slate-500 mt-1">Gerencie conferências e editais.</p>
        </div>
        <CreateProcessDialog prefill={alertPrefill} defaultOpen={!!alertPrefill} />
      </div>

      {/* Metric cards */}
      {stats && stats.total > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white border rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
              <FolderKanban className="w-5 h-5 text-slate-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
              <p className="text-xs text-slate-500 font-medium">Total</p>
            </div>
          </div>
          <div className="bg-white border rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <Clock className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{stats.emAndamento}</p>
              <p className="text-xs text-slate-500 font-medium">Em Andamento</p>
            </div>
          </div>
          <div className="bg-white border rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{stats.comPendencias}</p>
              <p className="text-xs text-slate-500 font-medium">Com Pendências</p>
            </div>
          </div>
          <div className="bg-white border rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{stats.concluidos}</p>
              <p className="text-xs text-slate-500 font-medium">Concluídos</p>
            </div>
          </div>
        </div>
      )}

      {/* Search bar */}
      {(processes?.length ?? 0) > 0 && (
        <div className="relative mb-6">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por título, órgão, modalidade ou número do edital..."
            className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-10 py-2.5 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary/30 outline-none transition-shadow"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="h-48 animate-pulse bg-slate-100/50" />
          ))}
        </div>
      ) : processes?.length === 0 ? (
        <div className="text-center py-24 bg-white rounded-2xl border border-dashed border-slate-300">
          <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">Nenhum processo encontrado</h3>
          <p className="text-slate-500 mt-1 max-w-sm mx-auto mb-6">
            Comece criando seu primeiro processo para analisar o edital e conferir documentos.
          </p>
          <CreateProcessDialog />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
          <Search className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="font-semibold text-slate-700">Nenhum processo encontrado</p>
          <p className="text-sm text-slate-500 mt-1">
            Nenhum resultado para "<strong>{search}</strong>"
          </p>
          <button
            onClick={() => setSearch("")}
            className="mt-3 text-sm text-primary font-semibold hover:underline"
          >
            Limpar busca
          </button>
        </div>
      ) : (
        <>
          {search && (
            <p className="text-sm text-slate-500 mb-4">
              {filtered.length} resultado{filtered.length !== 1 ? "s" : ""} para "{search}"
            </p>
          )}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {paginated.map((process, idx) => {
              const deadline = getDeadlineInfo(process.deadline);
              return (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.04, duration: 0.3 }}
                  key={process.id}
                >
                  <Link href={`/processes/${process.id}`} className="block group">
                    <Card className="h-full hover:border-primary/40 hover:shadow-md transition-all duration-200 flex flex-col">
                      <div className="p-5 flex-1 flex flex-col">
                        <div className="flex justify-between items-start mb-3">
                          <ProcessStatusBadge status={process.status} />
                          <div className="flex items-center gap-2">
                            {deadline && (
                              <span className={cn("flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full", deadline.color)}>
                                <Timer className="w-3 h-3" />
                                {deadline.label}
                              </span>
                            )}
                            <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-primary transition-colors" />
                          </div>
                        </div>

                        <h3
                          className="font-bold text-lg text-slate-900 leading-tight mb-2 line-clamp-2"
                          title={process.title}
                        >
                          {process.title}
                        </h3>

                        <div className="mt-auto space-y-2.5">
                          <div className="flex items-center text-sm text-slate-600">
                            <Building2 className="w-4 h-4 mr-2 text-slate-400 shrink-0" />
                            <span className="truncate">{process.agency}</span>
                          </div>

                          {process.deadline && (
                            <div className="flex items-center text-sm text-slate-600">
                              <Calendar className="w-4 h-4 mr-2 text-slate-400 shrink-0" />
                              <span>
                                {format(new Date(process.deadline), "dd 'de' MMM, yyyy 'às' HH:mm", {
                                  locale: ptBR,
                                })}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="bg-slate-50 border-t px-5 py-3 rounded-b-xl flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          {process.modality}
                        </span>
                        <span className="text-xs font-medium text-primary group-hover:underline">
                          Acessar
                        </span>
                      </div>
                    </Card>
                  </Link>
                </motion.div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-8">
              <p className="text-sm text-slate-500">
                Mostrando {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} de {filtered.length} processos
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Anterior
                </button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                    let pageNum: number;
                    if (totalPages <= 7) {
                      pageNum = i + 1;
                    } else if (page <= 4) {
                      pageNum = i + 1 <= 5 ? i + 1 : i === 5 ? -1 : totalPages;
                    } else if (page >= totalPages - 3) {
                      pageNum = i === 0 ? 1 : i === 1 ? -1 : totalPages - (6 - i);
                    } else {
                      const map = [1, -1, page - 1, page, page + 1, -2, totalPages];
                      pageNum = map[i]!;
                    }
                    if (pageNum < 0) {
                      return (
                        <span key={`dots-${i}`} className="px-1 text-slate-400 text-sm">…</span>
                      );
                    }
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setPage(pageNum)}
                        className={cn(
                          "w-8 h-8 flex items-center justify-center rounded-lg text-sm font-medium transition",
                          page === pageNum
                            ? "bg-primary text-white"
                            : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                        )}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  Próximo
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </AppLayout>
  );
}

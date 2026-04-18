import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useToast } from "@/hooks/use-toast";
import { getToken } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Bot, RefreshCw, Loader2, Play, XCircle, RotateCcw, CheckCircle2,
  AlertTriangle, Clock, Zap, FileText, ChevronDown, ChevronRight,
  WifiOff, Wifi,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

type JobStatus = "pendente" | "em_execucao" | "concluido" | "erro" | "cancelado";
type LogStatus = "sucesso" | "erro" | "aviso";

interface RpaJob {
  id: number;
  processoId: number | null;
  empresaId: number | null;
  tipo: string;
  prioridade: number;
  status: JobStatus;
  tentativasRealizadas: number;
  maxTentativas: number;
  errorType: string | null;
  errorMessage: string | null;
  criadoEm: string;
  iniciadoEm: string | null;
  finalizadoEm: string | null;
  proximaTentativaEm: string | null;
}

interface RpaLog {
  id: number;
  jobId: number | null;
  processoId: number | null;
  empresaId: number | null;
  acao: string;
  status: LogStatus;
  detalhe: string | null;
  screenshotPath: string | null;
  timestamp: string;
}

const STATUS_CONFIG: Record<JobStatus, { label: string; color: string; icon: any }> = {
  pendente: { label: "Pendente", color: "bg-yellow-50 text-yellow-700 border-yellow-200", icon: Clock },
  em_execucao: { label: "Executando", color: "bg-blue-50 text-blue-700 border-blue-200", icon: Loader2 },
  concluido: { label: "Concluído", color: "bg-green-50 text-green-700 border-green-200", icon: CheckCircle2 },
  erro: { label: "Erro", color: "bg-red-50 text-red-700 border-red-200", icon: AlertTriangle },
  cancelado: { label: "Cancelado", color: "bg-slate-50 text-slate-500 border-slate-200", icon: XCircle },
};

const ERROR_LABELS: Record<string, string> = {
  certificado_invalido: "Certificado inválido",
  timeout_portal: "Timeout do portal",
  sessao_expirada: "Sessão expirada",
  portal_fora_do_ar: "Portal fora do ar",
  proposta_ja_enviada: "Proposta já enviada",
  erro_generico: "Erro genérico",
};

const TIPO_LABELS: Record<string, string> = {
  submeter_proposta: "Submeter Proposta",
  verificar_status: "Verificar Status",
  enviar_habilitacao: "Enviar Habilitação",
};

function StatusBadge({ status }: { status: JobStatus }) {
  const { label, color, icon: Icon } = STATUS_CONFIG[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border", color)}>
      <Icon className={cn("w-3 h-3", status === "em_execucao" && "animate-spin")} />
      {label}
    </span>
  );
}

function LogStatusIcon({ status }: { status: LogStatus }) {
  if (status === "sucesso") return <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />;
  if (status === "erro") return <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />;
  return <Clock className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />;
}

function JobCard({ job, onCancel, onRetry, onExpand, expanded, logs }: {
  job: RpaJob;
  onCancel: (id: number) => void;
  onRetry: (id: number) => void;
  onExpand: (id: number) => void;
  expanded: boolean;
  logs: RpaLog[];
}) {
  const canCancel = job.status === "pendente";
  const canRetry = job.status === "erro" || job.status === "cancelado";

  return (
    <Card className={cn("overflow-hidden transition-shadow", job.status === "em_execucao" && "ring-1 ring-blue-300")}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className={cn(
              "w-9 h-9 rounded-xl flex items-center justify-center shrink-0",
              job.status === "em_execucao" ? "bg-blue-50" : "bg-slate-100"
            )}>
              <Bot className={cn("w-5 h-5", job.status === "em_execucao" ? "text-blue-500" : "text-slate-500")} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-slate-900 text-sm">
                  {TIPO_LABELS[job.tipo] ?? job.tipo}
                </span>
                <StatusBadge status={job.status} />
              </div>
              <div className="flex items-center gap-3 mt-1 flex-wrap text-xs text-slate-400">
                <span>Job #{job.id}</span>
                {job.processoId && <span>Processo #{job.processoId}</span>}
                {job.empresaId && <span>Empresa #{job.empresaId}</span>}
                <span>Prioridade {job.prioridade}</span>
                <span>Criado {formatDistanceToNow(new Date(job.criadoEm), { locale: ptBR, addSuffix: true })}</span>
              </div>
              {job.errorType && (
                <div className="mt-2 text-xs text-red-600 bg-red-50 rounded px-2 py-1 font-medium">
                  {ERROR_LABELS[job.errorType] ?? job.errorType}
                  {job.tentativasRealizadas > 0 && ` — ${job.tentativasRealizadas}/${job.maxTentativas} tentativas`}
                </div>
              )}
              {job.proximaTentativaEm && job.status === "pendente" && job.tentativasRealizadas > 0 && (
                <div className="mt-1.5 text-xs text-amber-600 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Próxima tentativa {formatDistanceToNow(new Date(job.proximaTentativaEm), { locale: ptBR, addSuffix: true })}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {canRetry && (
              <Button size="sm" variant="outline" onClick={() => onRetry(job.id)} className="text-xs h-7">
                <RotateCcw className="w-3 h-3 mr-1" />Retentar
              </Button>
            )}
            {canCancel && (
              <Button size="sm" variant="ghost" onClick={() => onCancel(job.id)} className="text-xs h-7 text-red-500 hover:text-red-700 hover:bg-red-50">
                <XCircle className="w-3 h-3 mr-1" />Cancelar
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => onExpand(job.id)} className="text-xs h-7 text-slate-500">
              {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50 p-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Histórico de ações</p>
          {logs.length === 0 ? (
            <p className="text-sm text-slate-400 italic">Nenhuma ação registrada.</p>
          ) : (
            <div className="space-y-2">
              {logs.map(log => (
                <div key={log.id} className="flex items-start gap-2 text-sm">
                  <LogStatusIcon status={log.status} />
                  <div className="min-w-0">
                    <span className="font-medium text-slate-700">{log.acao}</span>
                    {log.detalhe && <p className="text-xs text-slate-500 mt-0.5">{log.detalhe}</p>}
                    {log.screenshotPath && (
                      <p className="text-xs text-primary mt-0.5 flex items-center gap-1">
                        <FileText className="w-3 h-3" />Screenshot: {log.screenshotPath.split("/").pop()}
                      </p>
                    )}
                    <p className="text-xs text-slate-400 mt-0.5">
                      {format(new Date(log.timestamp), "dd/MM HH:mm:ss", { locale: ptBR })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

export function RpaMonitorPage() {
  const { toast } = useToast();
  const token = getToken();

  const [jobs, setJobs] = useState<RpaJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedJobs, setExpandedJobs] = useState<Set<number>>(new Set());
  const [jobLogs, setJobLogs] = useState<Record<number, RpaLog[]>>({});
  const [testingConn, setTestingConn] = useState(false);
  const [connResult, setConnResult] = useState<{ acessivel: boolean; url?: string; durationMs?: number; error?: string } | null>(null);
  const [filterStatus, setFilterStatus] = useState<JobStatus | "todos">("todos");
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch("/api/rpa/jobs", { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return;
      const data = await res.json();
      setJobs(data);
    } catch {
      // silently ignore
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchJobs();
    if (!autoRefresh) return;
    const t = setInterval(fetchJobs, 5000);
    return () => clearInterval(t);
  }, [fetchJobs, autoRefresh]);

  async function loadLogs(jobId: number) {
    try {
      const res = await fetch(`/api/rpa/jobs/${jobId}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return;
      const { logs } = await res.json();
      setJobLogs(prev => ({ ...prev, [jobId]: logs }));
    } catch { }
  }

  function toggleExpand(jobId: number) {
    setExpandedJobs(prev => {
      const next = new Set(prev);
      if (next.has(jobId)) {
        next.delete(jobId);
      } else {
        next.add(jobId);
        loadLogs(jobId);
      }
      return next;
    });
  }

  async function handleCancel(id: number) {
    try {
      const res = await fetch(`/api/rpa/jobs/${id}/cancelar`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { toast({ title: "Não foi possível cancelar o job", variant: "destructive" }); return; }
      toast({ title: "Job cancelado" });
      fetchJobs();
    } catch {
      toast({ title: "Erro ao cancelar", variant: "destructive" });
    }
  }

  async function handleRetry(id: number) {
    try {
      const res = await fetch(`/api/rpa/jobs/${id}/retentar`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { toast({ title: "Não foi possível retentar", variant: "destructive" }); return; }
      toast({ title: "Job recolocado na fila" });
      fetchJobs();
    } catch {
      toast({ title: "Erro ao retentar", variant: "destructive" });
    }
  }

  async function testarConexao() {
    setTestingConn(true);
    setConnResult(null);
    try {
      const res = await fetch("/api/rpa/testar-conexao", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setConnResult(data);
      if (data.acessivel) {
        toast({ title: "Portal acessível!", description: `Respondeu em ${data.durationMs}ms` });
      } else {
        toast({ title: "Portal inacessível", description: data.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Erro ao testar conexão", variant: "destructive" });
    } finally {
      setTestingConn(false);
    }
  }

  const counts = {
    pendente: jobs.filter(j => j.status === "pendente").length,
    em_execucao: jobs.filter(j => j.status === "em_execucao").length,
    concluido: jobs.filter(j => j.status === "concluido").length,
    erro: jobs.filter(j => j.status === "erro").length,
    cancelado: jobs.filter(j => j.status === "cancelado").length,
  };

  const filtered = filterStatus === "todos" ? jobs : jobs.filter(j => j.status === filterStatus);

  return (
    <AppLayout>
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center">
              <Bot className="w-5 h-5 text-violet-600" />
            </div>
            <h1 className="text-2xl font-display font-bold text-slate-900">Automação RPA</h1>
          </div>
          <p className="text-sm text-slate-500 ml-13">Monitoramento da fila de jobs de submissão automática no Compras.gov.br</p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(a => !a)}
            className={cn(autoRefresh && "border-green-300 text-green-700 bg-green-50")}
          >
            {autoRefresh ? <Zap className="w-4 h-4 mr-1.5" /> : <RefreshCw className="w-4 h-4 mr-1.5" />}
            {autoRefresh ? "Auto" : "Manual"}
          </Button>
          <Button variant="outline" size="sm" onClick={fetchJobs}>
            <RefreshCw className="w-4 h-4 mr-1.5" />Atualizar
          </Button>
          <Button size="sm" onClick={testarConexao} disabled={testingConn} variant="outline">
            {testingConn ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Play className="w-4 h-4 mr-1.5" />}
            Testar Portal
          </Button>
        </div>
      </div>

      {/* Connection test result */}
      {connResult && (
        <Card className={cn(
          "p-4 mb-5 flex items-center gap-3",
          connResult.acessivel ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"
        )}>
          {connResult.acessivel
            ? <Wifi className="w-5 h-5 text-green-600 shrink-0" />
            : <WifiOff className="w-5 h-5 text-red-500 shrink-0" />}
          <div>
            {connResult.acessivel ? (
              <p className="text-sm font-semibold text-green-800">
                Portal acessível — respondeu em {connResult.durationMs}ms
                {connResult.url && <span className="font-normal text-green-600"> ({connResult.url})</span>}
              </p>
            ) : (
              <p className="text-sm font-semibold text-red-800">Portal inacessível — {connResult.error}</p>
            )}
          </div>
          <button onClick={() => setConnResult(null)} className="ml-auto text-slate-400 hover:text-slate-600 text-xs">Fechar</button>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        {(Object.entries(counts) as [JobStatus, number][]).map(([status, count]) => {
          const { label, color } = STATUS_CONFIG[status];
          return (
            <button
              key={status}
              onClick={() => setFilterStatus(s => s === status ? "todos" : status)}
              className={cn(
                "text-center p-3 rounded-xl border transition-all",
                filterStatus === status ? color + " font-bold" : "bg-white border-slate-200 hover:border-slate-300"
              )}
            >
              <p className="text-2xl font-bold">{count}</p>
              <p className="text-xs text-slate-500 mt-0.5">{label}</p>
            </button>
          );
        })}
      </div>

      {/* Jobs list */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-300">
          <Bot className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="font-semibold text-slate-700">
            {filterStatus === "todos" ? "Nenhum job na fila" : `Nenhum job com status "${STATUS_CONFIG[filterStatus as JobStatus].label}"`}
          </p>
          <p className="text-sm text-slate-400 mt-1">Os jobs de submissão automática aparecerão aqui.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(job => (
            <JobCard
              key={job.id}
              job={job}
              onCancel={handleCancel}
              onRetry={handleRetry}
              onExpand={toggleExpand}
              expanded={expandedJobs.has(job.id)}
              logs={jobLogs[job.id] ?? []}
            />
          ))}
        </div>
      )}
    </AppLayout>
  );
}

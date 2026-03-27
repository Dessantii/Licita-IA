import { useMemo, useRef } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useListProcesses } from "@workspace/api-client-react";
import { ProcessStatusBadge } from "@/components/processes/ProcessStatusBadge";
import { Card } from "@/components/ui/card";
import { Link } from "wouter";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  BarChart3,
  CheckCircle2,
  AlertCircle,
  Clock,
  FolderKanban,
  ArrowRight,
  TrendingUp,
  Calendar,
  Building2,
  Download,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const statusLabels: Record<string, string> = {
  criado: "Criado",
  edital_enviado: "Edital Enviado",
  edital_processando: "Processando Edital",
  exigencias_extraidas: "Exigências Extraídas",
  aguardando_documentos: "Aguardando Documentos",
  documentos_enviados: "Documentos Enviados",
  em_conferencia: "Em Conferência",
  pendencias_encontradas: "Com Pendências",
  pronto_para_revisao: "Pronto para Revisão",
  concluido: "Concluído",
};

function exportPDF() {
  const style = document.createElement("style");
  style.id = "__print_override";
  style.textContent = `
    @media print {
      body > * { display: none !important; }
      #relatorio-print-root { display: block !important; }
      nav, aside, header, [data-sidebar], [data-nav] { display: none !important; }
      .no-print { display: none !important; }
      @page { margin: 1.5cm; }
    }
  `;
  document.head.appendChild(style);
  window.print();
  setTimeout(() => document.getElementById("__print_override")?.remove(), 1000);
}

export function RelatóriosPage() {
  const { data: processes, isLoading } = useListProcesses();

  const stats = useMemo(() => {
    if (!processes) return null;
    const total = processes.length;
    const concluidos = processes.filter((p) => p.status === "concluido").length;
    const comPendencias = processes.filter((p) => p.status === "pendencias_encontradas").length;
    const emAndamento = processes.filter(
      (p) => !["concluido", "criado"].includes(p.status)
    ).length;
    const novos = processes.filter((p) => p.status === "criado").length;

    const byModality: Record<string, number> = {};
    processes.forEach((p) => {
      const mod = p.modality || "Outros";
      byModality[mod] = (byModality[mod] || 0) + 1;
    });

    const modalidades = Object.entries(byModality)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    return { total, concluidos, comPendencias, emAndamento, novos, modalidades };
  }, [processes]);

  const praximosProcessos = useMemo(() => {
    if (!processes) return [];
    return processes
      .filter((p) => p.deadline && new Date(p.deadline) > new Date())
      .sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime())
      .slice(0, 5);
  }, [processes]);

  return (
    <AppLayout>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4 no-print">
        <div>
          <h1 className="text-3xl font-display font-bold text-slate-900">Relatórios</h1>
          <p className="text-slate-500 mt-1">Visão geral dos processos licitatórios.</p>
        </div>
        {stats && stats.total > 0 && (
          <Button onClick={exportPDF} variant="outline" className="gap-2 shrink-0">
            <Download className="w-4 h-4" />
            Exportar PDF
          </Button>
        )}
      </div>
      <div className="hidden print:block mb-6">
        <h1 className="text-2xl font-bold">Relatório — LicitaIA</h1>
        <p className="text-sm text-gray-500">Emitido em {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="h-24 animate-pulse bg-slate-100/50" />
          ))}
        </div>
      ) : !stats || stats.total === 0 ? (
        <div className="text-center py-24 bg-white rounded-2xl border border-dashed border-slate-300">
          <BarChart3 className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-900">Sem dados ainda</h3>
          <p className="text-slate-500 mt-1 max-w-sm mx-auto">
            Crie processos e realize conferências para ver os relatórios aqui.
          </p>
          <Link href="/processes" className="mt-4 inline-block text-primary font-semibold text-sm hover:underline">
            Ir para Processos →
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Stats row */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {[
              { label: "Total de Processos", value: stats.total, icon: FolderKanban, color: "bg-slate-100 text-slate-600" },
              { label: "Em Andamento", value: stats.emAndamento, icon: Clock, color: "bg-blue-50 text-blue-600" },
              { label: "Com Pendências", value: stats.comPendencias, icon: AlertCircle, color: "bg-red-50 text-red-600" },
              { label: "Concluídos", value: stats.concluidos, icon: CheckCircle2, color: "bg-green-50 text-green-600" },
              { label: "Aguardando Início", value: stats.novos, icon: TrendingUp, color: "bg-violet-50 text-violet-600" },
            ].map((s) => (
              <div key={s.label} className="bg-white border rounded-xl p-4 flex items-center gap-3">
                <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0", s.color)}>
                  <s.icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{s.value}</p>
                  <p className="text-xs text-slate-500 font-medium leading-tight">{s.label}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Distribuição por modalidade */}
            <Card className="p-5">
              <h3 className="font-bold text-slate-900 mb-4">Por Modalidade</h3>
              <div className="space-y-3">
                {stats.modalidades.map(([modality, count]) => (
                  <div key={modality}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-700 font-medium truncate pr-2">{modality}</span>
                      <span className="text-slate-500 font-semibold shrink-0">{count}</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${(count / stats.total) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Próximos prazos */}
            <Card className="p-5 lg:col-span-2">
              <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-400" />
                Próximos Prazos de Abertura
              </h3>
              {praximosProcessos.length === 0 ? (
                <p className="text-sm text-slate-400 py-4 text-center">Nenhum prazo futuro cadastrado.</p>
              ) : (
                <div className="space-y-3">
                  {praximosProcessos.map((p) => (
                    <Link key={p.id} href={`/processes/${p.id}`} className="block group">
                      <div className="flex items-center justify-between p-3 rounded-lg border hover:border-primary/30 hover:bg-slate-50 transition-all">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-slate-800 text-sm truncate">{p.title}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                            <p className="text-xs text-slate-500 truncate">{p.agency}</p>
                          </div>
                        </div>
                        <div className="text-right ml-4 shrink-0">
                          <p className="text-xs font-bold text-slate-700">
                            {format(new Date(p.deadline!), "dd/MM/yyyy", { locale: ptBR })}
                          </p>
                          <p className="text-xs text-slate-400">
                            {format(new Date(p.deadline!), "HH:mm", { locale: ptBR })}
                          </p>
                        </div>
                        <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-primary ml-3 transition-colors shrink-0" />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* All processes table */}
          <Card className="overflow-hidden">
            <div className="p-4 border-b">
              <h3 className="font-bold text-slate-900">Todos os Processos</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b">
                    <th className="text-left p-3 pl-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Processo</th>
                    <th className="text-left p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Órgão</th>
                    <th className="text-left p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">Modalidade</th>
                    <th className="text-left p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">Prazo</th>
                    <th className="text-left p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                    <th className="p-3 pr-4"></th>
                  </tr>
                </thead>
                <tbody>
                  {processes?.map((p) => (
                    <tr key={p.id} className="border-t hover:bg-slate-50 transition-colors">
                      <td className="p-3 pl-4">
                        <p className="font-semibold text-slate-800 line-clamp-1">{p.title}</p>
                        {p.editalNumber && (
                          <p className="text-xs text-slate-400 mt-0.5">Edital {p.editalNumber}</p>
                        )}
                      </td>
                      <td className="p-3 text-slate-600 max-w-[180px]">
                        <span className="truncate block">{p.agency}</span>
                      </td>
                      <td className="p-3 text-slate-500 hidden md:table-cell">{p.modality}</td>
                      <td className="p-3 text-slate-500 hidden lg:table-cell">
                        {p.deadline
                          ? format(new Date(p.deadline), "dd/MM/yyyy", { locale: ptBR })
                          : "—"}
                      </td>
                      <td className="p-3">
                        <ProcessStatusBadge status={p.status} />
                      </td>
                      <td className="p-3 pr-4 text-right">
                        <Link
                          href={`/processes/${p.id}`}
                          className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1"
                        >
                          Acessar <ArrowRight className="w-3 h-3" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </AppLayout>
  );
}

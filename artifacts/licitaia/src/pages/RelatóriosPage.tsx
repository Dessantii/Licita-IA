import { useMemo, useState } from "react";
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
  ChevronDown,
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

const statusColors: Record<string, string> = {
  criado: "#6366f1",
  edital_enviado: "#3b82f6",
  edital_processando: "#3b82f6",
  exigencias_extraidas: "#8b5cf6",
  aguardando_documentos: "#f59e0b",
  documentos_enviados: "#f59e0b",
  em_conferencia: "#f59e0b",
  pendencias_encontradas: "#ef4444",
  pronto_para_revisao: "#10b981",
  concluido: "#10b981",
};

function buildPrintHTML(
  filtered: any[],
  stats: any,
  companyLabel: string,
  proximosPrazos: any[]
): string {
  const now = format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });

  const statsRows = [
    { label: "Total de Processos", value: stats.total, color: "#64748b" },
    { label: "Em Andamento", value: stats.emAndamento, color: "#3b82f6" },
    { label: "Com Pendências", value: stats.comPendencias, color: "#ef4444" },
    { label: "Concluídos", value: stats.concluidos, color: "#10b981" },
    { label: "Aguardando Início", value: stats.novos, color: "#8b5cf6" },
  ];

  const tableRows = filtered.map((p) => `
    <tr style="border-bottom:1px solid #e2e8f0">
      <td style="padding:8px 12px;font-weight:600;color:#1e293b;max-width:220px">${p.title ?? "—"}</td>
      <td style="padding:8px 12px;color:#64748b">${p.agency ?? "—"}</td>
      <td style="padding:8px 12px;color:#64748b">${p.modality ?? "—"}</td>
      <td style="padding:8px 12px;color:#64748b">${p.companyName ?? "—"}</td>
      <td style="padding:8px 12px;color:#64748b">${p.deadline ? format(new Date(p.deadline), "dd/MM/yyyy", { locale: ptBR }) : "—"}</td>
      <td style="padding:8px 12px">
        <span style="display:inline-block;padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:600;background:${statusColors[p.status] ?? "#94a3b8"}22;color:${statusColors[p.status] ?? "#64748b"}">
          ${statusLabels[p.status] ?? p.status}
        </span>
      </td>
    </tr>
  `).join("");

  const modalidadeRows = stats.modalidades.map(([mod, count]: [string, number]) => `
    <div style="margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;margin-bottom:4px;font-size:13px">
        <span style="color:#334155;font-weight:500">${mod}</span>
        <span style="color:#64748b;font-weight:600">${count}</span>
      </div>
      <div style="height:6px;background:#f1f5f9;border-radius:999px;overflow:hidden">
        <div style="height:100%;background:#6366f1;border-radius:999px;width:${Math.round((count / stats.total) * 100)}%"></div>
      </div>
    </div>
  `).join("");

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<title>Relatório LicitaIA</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 32px; color: #1e293b; }
  h1 { font-size: 24px; font-weight: 800; margin: 0 0 4px; }
  .subtitle { font-size: 13px; color: #94a3b8; margin-bottom: 28px; }
  .stats { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 28px; }
  .stat { border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 18px; min-width: 120px; flex: 1; }
  .stat-value { font-size: 26px; font-weight: 800; }
  .stat-label { font-size: 11px; color: #94a3b8; font-weight: 600; margin-top: 2px; }
  .section { margin-bottom: 28px; }
  .section-title { font-size: 15px; font-weight: 700; color: #0f172a; margin-bottom: 14px; border-bottom: 2px solid #f1f5f9; padding-bottom: 6px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  thead tr { background: #f8fafc; }
  th { padding: 8px 12px; text-align: left; font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: .05em; }
  .two-col { display: grid; grid-template-columns: 1fr 2fr; gap: 24px; margin-bottom: 28px; }
  .card { border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; }
  @media print { body { padding: 0; } @page { margin: 1.5cm; } }
</style>
</head>
<body>
<h1>Relatório — LicitaIA</h1>
<div class="subtitle">Emitido em ${now}${companyLabel !== "Todas as empresas" ? ` · Empresa: ${companyLabel}` : ""}</div>

<div class="stats">
  ${statsRows.map(s => `
    <div class="stat">
      <div class="stat-value" style="color:${s.color}">${s.value}</div>
      <div class="stat-label">${s.label}</div>
    </div>
  `).join("")}
</div>

<div class="two-col">
  <div class="card">
    <div class="section-title">Por Modalidade</div>
    ${modalidadeRows || '<p style="color:#94a3b8;font-size:13px">Nenhum dado.</p>'}
  </div>
  <div class="card">
    <div class="section-title">Próximos Prazos de Abertura</div>
    ${proximosPrazos.length === 0
      ? '<p style="color:#94a3b8;font-size:13px">Nenhum prazo futuro cadastrado.</p>'
      : `<table><thead><tr><th>Processo</th><th>Órgão</th><th>Prazo</th></tr></thead><tbody>
          ${proximosPrazos.map(p => `
            <tr style="border-bottom:1px solid #f1f5f9">
              <td style="padding:6px 8px;font-weight:600;color:#1e293b">${p.title}</td>
              <td style="padding:6px 8px;color:#64748b">${p.agency ?? "—"}</td>
              <td style="padding:6px 8px;color:#64748b;white-space:nowrap">${format(new Date(p.deadline!), "dd/MM/yyyy", { locale: ptBR })}</td>
            </tr>
          `).join("")}
         </tbody></table>`
    }
  </div>
</div>

<div class="section">
  <div class="section-title">Todos os Processos (${filtered.length})</div>
  <table>
    <thead>
      <tr><th>Processo</th><th>Órgão</th><th>Modalidade</th><th>Empresa</th><th>Prazo</th><th>Status</th></tr>
    </thead>
    <tbody>${tableRows}</tbody>
  </table>
</div>
</body>
</html>`;
}

export function RelatóriosPage() {
  const { data: processes, isLoading } = useListProcesses();
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("all");

  const companies = useMemo(() => {
    if (!processes) return [];
    const seen = new Map<number, string>();
    (processes as any[]).forEach((p: any) => {
      if (p.companyId && p.companyName && !seen.has(p.companyId)) {
        seen.set(p.companyId, p.companyName);
      }
    });
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [processes]);

  const filtered = useMemo(() => {
    if (!processes) return [] as any[];
    if (selectedCompanyId === "all") return processes as any[];
    return (processes as any[]).filter((p: any) => String(p.companyId) === selectedCompanyId);
  }, [processes, selectedCompanyId]);

  const companyLabel = useMemo(() => {
    if (selectedCompanyId === "all") return "Todas as empresas";
    return companies.find((c) => String(c.id) === selectedCompanyId)?.name ?? "Empresa";
  }, [selectedCompanyId, companies]);

  const stats = useMemo(() => {
    if (!filtered.length) return null;
    const total = filtered.length;
    const concluidos = filtered.filter((p: any) => p.status === "concluido").length;
    const comPendencias = filtered.filter((p: any) => p.status === "pendencias_encontradas").length;
    const emAndamento = filtered.filter(
      (p: any) => !["concluido", "criado"].includes(p.status)
    ).length;
    const novos = filtered.filter((p: any) => p.status === "criado").length;

    const byModality: Record<string, number> = {};
    filtered.forEach((p: any) => {
      const mod = p.modality || "Outros";
      byModality[mod] = (byModality[mod] || 0) + 1;
    });
    const modalidades = Object.entries(byModality)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    return { total, concluidos, comPendencias, emAndamento, novos, modalidades };
  }, [filtered]);

  const proximosPrazos = useMemo(() => {
    return filtered
      .filter((p: any) => p.deadline && new Date(p.deadline) > new Date())
      .sort((a: any, b: any) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
      .slice(0, 5);
  }, [filtered]);

  function exportPDF() {
    if (!stats) return;
    const html = buildPrintHTML(filtered, stats, companyLabel, proximosPrazos);
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => {
      win.print();
    }, 500);
  }

  const hasProcesses = (processes?.length ?? 0) > 0;

  return (
    <AppLayout>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-slate-900">Relatórios</h1>
          <p className="text-slate-500 mt-1">Visão geral dos processos licitatórios.</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {hasProcesses && companies.length > 0 && (
            <div className="relative">
              <Building2 className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <select
                value={selectedCompanyId}
                onChange={(e) => setSelectedCompanyId(e.target.value)}
                className="pl-9 pr-8 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 appearance-none cursor-pointer"
              >
                <option value="all">Todas as empresas</option>
                {companies.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          )}
          {stats && stats.total > 0 && (
            <Button onClick={exportPDF} variant="outline" className="gap-2">
              <Download className="w-4 h-4" />
              Exportar PDF
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="h-24 animate-pulse bg-slate-100/50" />
          ))}
        </div>
      ) : !hasProcesses ? (
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
      ) : !stats ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
          <Building2 className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="font-semibold text-slate-700">Nenhum processo para esta empresa.</p>
          <button
            onClick={() => setSelectedCompanyId("all")}
            className="mt-2 text-sm text-primary font-semibold hover:underline"
          >
            Ver todas as empresas
          </button>
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
              {proximosPrazos.length === 0 ? (
                <p className="text-sm text-slate-400 py-4 text-center">Nenhum prazo futuro cadastrado.</p>
              ) : (
                <div className="space-y-3">
                  {proximosPrazos.map((p) => (
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
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-bold text-slate-900">
                {selectedCompanyId === "all" ? "Todos os Processos" : `Processos — ${companyLabel}`}
                <span className="ml-2 text-sm font-normal text-slate-400">({filtered.length})</span>
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b">
                    <th className="text-left p-3 pl-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Processo</th>
                    <th className="text-left p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Órgão</th>
                    <th className="text-left p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">Modalidade</th>
                    {selectedCompanyId === "all" && (
                      <th className="text-left p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">Empresa</th>
                    )}
                    <th className="text-left p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">Prazo</th>
                    <th className="text-left p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                    <th className="p-3 pr-4"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => (
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
                      {selectedCompanyId === "all" && (
                        <td className="p-3 text-slate-500 hidden lg:table-cell">
                          {p.companyName ?? <span className="text-slate-300">—</span>}
                        </td>
                      )}
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

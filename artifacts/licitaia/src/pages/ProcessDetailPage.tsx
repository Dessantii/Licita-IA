import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Link, useRoute, useLocation } from "wouter";
import { useGetProcess, useDeleteProcess, ProcessStatus, getListProcessesQueryKey } from "@workspace/api-client-react";
import { useAppActions } from "@/hooks/use-app-actions";
import { ProcessStatusBadge } from "@/components/processes/ProcessStatusBadge";
import { ValidationStatusBadge } from "@/components/processes/ValidationStatusBadge";
import { RequirementsReviewPanel } from "@/components/processes/RequirementsReviewPanel";
import { EditProcessDialog } from "@/components/processes/EditProcessDialog";
import { FileUploadZone, FileListItem } from "@/components/files/FileUploadZone";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  BrainCircuit,
  CheckSquare,
  FileText,
  ArrowRight,
  Loader2,
  Play,
  FolderOpen,
  CalendarDays,
  ChevronRight,
  Upload,
  Lock,
  MoreHorizontal,
  Pencil,
  Trash2,
  FileDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

type Tab = "documentos" | "analise" | "conferencia";

export function ProcessDetailPage() {
  const [, params] = useRoute("/processes/:id");
  const [, navigate] = useLocation();
  const id = Number(params?.id);

  const { data: process, isLoading } = useGetProcess(id);
  const { uploadEdital, uploadDocument, removeFile, analyzeEdital, analyzeDocs } = useAppActions();
  const deleteMutation = useDeleteProcess();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const hasRequirements = (process?.requirements?.length ?? 0) > 0;
  const isInConference =
    process?.status === ProcessStatus.em_conferencia ||
    process?.status === ProcessStatus.pendencias_encontradas ||
    process?.status === ProcessStatus.pronto_para_revisao ||
    process?.status === ProcessStatus.concluido;

  const defaultTab: Tab = isInConference ? "conferencia" : hasRequirements ? "analise" : "documentos";
  const [activeTab, setActiveTab] = useState<Tab>(defaultTab);

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getListProcessesQueryKey() });
      toast({ title: "Processo excluído com sucesso" });
      navigate("/processes");
    } catch {
      toast({ title: "Erro ao excluir processo", variant: "destructive" });
    }
  };

  const handleGenerateReport = () => {
    if (!process) return;

    const stats = {
      ok: process.validationItems.filter(v => v.status === "ok").length,
      faltando: process.validationItems.filter(v => v.status === "faltando").length,
      vencido: process.validationItems.filter(v => v.status === "vencido").length,
      divergente: process.validationItems.filter(v => v.status === "divergente").length,
      revisar: process.validationItems.filter(v => v.status === "revisar").length,
    };

    const rows = process.validationItems.map(item => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0">${item.requirement?.title ?? "—"}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-transform:uppercase;font-size:11px;font-weight:700;color:${
          item.status === "ok" ? "#16a34a" :
          item.status === "faltando" ? "#dc2626" :
          item.status === "vencido" ? "#ea580c" :
          item.status === "divergente" ? "#d97706" : "#6366f1"
        }">${item.status}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:12px;color:#64748b">${item.notes ?? "—"}</td>
      </tr>
    `).join("");

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Relatório de Conferência — ${process.title}</title>
<style>
  body { font-family: Arial, sans-serif; margin: 0; padding: 32px; color: #1e293b; }
  .header { border-bottom: 3px solid #3b82f6; padding-bottom: 16px; margin-bottom: 24px; }
  .header h1 { margin: 0 0 4px; font-size: 20px; }
  .meta { color: #64748b; font-size: 13px; }
  .stats { display: flex; gap: 16px; margin-bottom: 24px; }
  .stat { flex: 1; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; text-align: center; }
  .stat .num { font-size: 24px; font-weight: 700; }
  .stat .lbl { font-size: 11px; text-transform: uppercase; color: #64748b; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  thead { background: #f8fafc; }
  th { padding: 10px 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #64748b; border-bottom: 2px solid #e2e8f0; }
  @media print { .no-print { display: none; } }
</style>
</head>
<body>
<div class="no-print" style="margin-bottom:16px">
  <button onclick="window.print()" style="background:#3b82f6;color:white;border:none;padding:8px 20px;border-radius:6px;cursor:pointer;font-size:14px">Imprimir / Salvar PDF</button>
</div>
<div class="header">
  <div style="color:#3b82f6;font-weight:700;font-size:12px;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">LicitaIA — Relatório de Conferência</div>
  <h1>${process.title}</h1>
  <div class="meta">
    ${process.agency} &nbsp;•&nbsp; ${process.modality}
    ${process.editalNumber ? `&nbsp;•&nbsp; Edital ${process.editalNumber}` : ""}
    ${process.deadline ? `&nbsp;•&nbsp; Abertura: ${format(new Date(process.deadline), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}` : ""}
    &nbsp;•&nbsp; Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
  </div>
</div>
<div class="stats">
  <div class="stat" style="border-color:#bbf7d0"><div class="num" style="color:#16a34a">${stats.ok}</div><div class="lbl">OK</div></div>
  <div class="stat" style="border-color:#fecaca"><div class="num" style="color:#dc2626">${stats.faltando}</div><div class="lbl">Faltando</div></div>
  <div class="stat" style="border-color:#fed7aa"><div class="num" style="color:#ea580c">${stats.vencido}</div><div class="lbl">Vencido</div></div>
  <div class="stat" style="border-color:#fde68a"><div class="num" style="color:#d97706">${stats.divergente}</div><div class="lbl">Divergente</div></div>
  <div class="stat" style="border-color:#c7d2fe"><div class="num" style="color:#6366f1">${stats.revisar}</div><div class="lbl">Revisar</div></div>
</div>
<table>
  <thead>
    <tr>
      <th>Documento / Exigência</th>
      <th>Status</th>
      <th>Observações</th>
    </tr>
  </thead>
  <tbody>${rows}</tbody>
</table>
</body>
</html>`;

    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  };

  if (isLoading)
    return (
      <AppLayout>
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  if (!process)
    return (
      <AppLayout>
        <div className="text-center py-16 text-slate-500">Processo não encontrado</div>
      </AppLayout>
    );

  const handleEditalUpload = async (file: Blob) => {
    await uploadEdital.mutateAsync({ id, data: { file } });
  };
  const handleDocUpload = async (file: Blob) => {
    await uploadDocument.mutateAsync({ id, data: { file } });
  };

  const needsEditalAnalysis =
    process.editalFile &&
    (process.status === ProcessStatus.edital_enviado ||
      process.status === ProcessStatus.edital_processando);

  const needsDocAnalysis =
    process.documentFiles.length > 0 &&
    (process.status === ProcessStatus.documentos_enviados ||
      process.status === ProcessStatus.aguardando_documentos ||
      process.status === ProcessStatus.exigencias_extraidas);

  const docReqCount = process.requirements.filter((r) => r.category !== "informacao_principal").length;

  const tabs: { key: Tab; label: string; icon: React.ElementType; badge?: string | number; locked?: boolean }[] = [
    {
      key: "documentos",
      label: "Documentos",
      icon: Upload,
      badge: process.editalFile ? process.documentFiles.length + 1 : undefined,
    },
    {
      key: "analise",
      label: "Análise do Edital",
      icon: BrainCircuit,
      badge: hasRequirements ? docReqCount : undefined,
      locked: !hasRequirements,
    },
    {
      key: "conferencia",
      label: "Conferência",
      icon: CheckSquare,
      badge: isInConference ? process.validationItems.length : undefined,
      locked: !isInConference,
    },
  ];

  return (
    <AppLayout>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-1.5 text-sm text-slate-500 mb-4 font-medium">
          <Link href="/processes" className="hover:text-primary transition-colors">
            Processos
          </Link>
          <ChevronRight className="w-4 h-4" />
          <span className="text-slate-900 truncate max-w-xs">{process.title}</span>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <ProcessStatusBadge status={process.status} />
              <span className="text-sm font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
                {process.modality}
              </span>
              {process.editalNumber && (
                <span className="text-sm font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
                  Edital: {process.editalNumber}
                </span>
              )}
            </div>
            <h1 className="text-2xl lg:text-3xl font-display font-bold text-slate-900 mb-1 truncate">
              {process.title}
            </h1>
            <div className="flex flex-wrap items-center gap-3 text-slate-500 text-sm">
              <span className="font-medium">{process.agency}</span>
              {process.companyName && (
                <>
                  <span className="text-slate-300">•</span>
                  <span className="flex items-center gap-1.5 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full text-xs font-semibold">
                    {process.companyName}
                  </span>
                </>
              )}
              {process.deadline && (
                <>
                  <span className="text-slate-300">•</span>
                  <span className="flex items-center gap-1.5">
                    <CalendarDays className="w-3.5 h-3.5" />
                    {format(new Date(process.deadline), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isInConference && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerateReport}
                className="gap-2"
              >
                <FileDown className="w-4 h-4" />
                Relatório PDF
              </Button>
            )}
            {isInConference && (
              <Link href={`/processes/${id}/checklist`}>
                <Button size="sm" className="shadow-md shadow-primary/20 gap-2">
                  <CheckSquare className="w-4 h-4" />
                  Checklist
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setEditOpen(true)}>
                  <Pencil className="w-4 h-4 mr-2" />
                  Editar Processo
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setDeleteOpen(true)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Excluir Processo
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 border-b border-slate-200 mb-6">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => !tab.locked && setActiveTab(tab.key)}
              disabled={tab.locked}
              className={cn(
                "relative flex items-center gap-2 px-4 py-3 text-sm font-semibold transition-colors rounded-t-lg -mb-px border-b-2",
                isActive
                  ? "text-primary border-primary bg-white"
                  : tab.locked
                  ? "text-slate-300 border-transparent cursor-not-allowed"
                  : "text-slate-500 border-transparent hover:text-slate-800 hover:border-slate-300"
              )}
            >
              {tab.locked ? (
                <Lock className="w-4 h-4" />
              ) : (
                <Icon className="w-4 h-4" />
              )}
              {tab.label}
              {tab.badge !== undefined && !tab.locked && (
                <span
                  className={cn(
                    "text-xs font-bold px-1.5 py-0.5 rounded-full",
                    isActive ? "bg-primary/10 text-primary" : "bg-slate-100 text-slate-500"
                  )}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab: Documentos */}
      {activeTab === "documentos" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="overflow-hidden">
            <div className="bg-slate-900 text-white p-4">
              <h3 className="font-bold flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-400" />
                1. Edital
              </h3>
            </div>
            <div className="p-5 space-y-4">
              {process.editalFile ? (
                <>
                  <FileListItem
                    file={process.editalFile}
                    onDelete={(fid) => removeFile.mutate({ id: fid })}
                  />
                  {needsEditalAnalysis && (
                    <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg">
                      <p className="text-sm text-blue-800 font-medium mb-3">
                        Edital enviado. Clique para extrair as exigências via IA.
                      </p>
                      <Button
                        onClick={() => analyzeEdital.mutate({ id })}
                        disabled={analyzeEdital.isPending}
                        className="w-full bg-blue-600 hover:bg-blue-700"
                      >
                        {analyzeEdital.isPending ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <BrainCircuit className="w-4 h-4 mr-2" />
                        )}
                        {analyzeEdital.isPending ? "Analisando..." : "Extrair Exigências com IA"}
                      </Button>
                    </div>
                  )}
                  {hasRequirements && (
                    <button
                      onClick={() => setActiveTab("analise")}
                      className="w-full flex items-center justify-between text-sm bg-green-50 border border-green-200 rounded-lg px-3 py-2.5 hover:bg-green-100 transition-colors group"
                    >
                      <span className="font-medium text-green-800">
                        {docReqCount} exigências extraídas ✓
                      </span>
                      <span className="text-xs text-green-600 font-semibold flex items-center gap-1 group-hover:gap-2 transition-all">
                        Ver análise <ArrowRight className="w-3.5 h-3.5" />
                      </span>
                    </button>
                  )}
                </>
              ) : (
                <FileUploadZone
                  onUpload={handleEditalUpload}
                  isUploading={uploadEdital.isPending}
                  label="Anexar Edital (PDF)"
                />
              )}
            </div>
          </Card>

          <Card
            className="overflow-hidden lg:col-span-2 transition-opacity duration-300"
            style={{ opacity: process.editalFile ? 1 : 0.55 }}
          >
            <div className="bg-slate-50 border-b p-4 flex justify-between items-center">
              <h3 className="font-bold flex items-center gap-2 text-slate-900">
                <FolderOpen className="w-5 h-5 text-indigo-500" />
                2. Documentos da Empresa
              </h3>
              <span className="text-sm font-medium text-slate-500">
                {process.documentFiles.length} arquivo(s)
              </span>
            </div>
            <div className="p-5">
              {!process.editalFile ? (
                <div className="text-center py-10 text-slate-400 text-sm">
                  Envie o edital primeiro para liberar o upload de documentos.
                </div>
              ) : (
                <div className="space-y-4">
                  {process.documentFiles.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {process.documentFiles.map((file) => (
                        <FileListItem
                          key={file.id}
                          file={file}
                          onDelete={(fid) => removeFile.mutate({ id: fid })}
                        />
                      ))}
                    </div>
                  )}
                  <FileUploadZone
                    onUpload={handleDocUpload}
                    isUploading={uploadDocument.isPending}
                    label="Adicionar Documentos"
                  />
                  {needsDocAnalysis && (
                    <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-lg flex items-center justify-between flex-wrap gap-4">
                      <div>
                        <h4 className="font-bold text-indigo-900 text-sm">Pronto para conferência</h4>
                        <p className="text-xs text-indigo-700 mt-1">
                          A IA cruzará os documentos enviados com as {docReqCount} exigências do edital.
                        </p>
                      </div>
                      <Button
                        onClick={() => analyzeDocs.mutate({ id })}
                        disabled={analyzeDocs.isPending}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white shrink-0 shadow-md shadow-indigo-200"
                      >
                        {analyzeDocs.isPending ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Play className="w-4 h-4 mr-2" />
                        )}
                        {analyzeDocs.isPending ? "Conferindo..." : "Iniciar Conferência"}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Tab: Análise do Edital */}
      {activeTab === "analise" && hasRequirements && (
        <Card className="overflow-hidden">
          <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BrainCircuit className="w-5 h-5 text-primary" />
              <div>
                <h3 className="font-bold text-base">Análise do Edital</h3>
                <p className="text-slate-400 text-xs mt-0.5">
                  Extraído por IA — revise e confirme antes de prosseguir
                </p>
              </div>
            </div>
            {isInConference && (
              <Button
                size="sm"
                variant="outline"
                className="border-white/20 text-white hover:bg-white/10"
                onClick={() => setActiveTab("conferencia")}
              >
                Ver Conferência
                <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </Button>
            )}
          </div>
          <div className="p-6">
            <RequirementsReviewPanel requirements={process.requirements} />
          </div>
        </Card>
      )}

      {/* Tab: Conferência */}
      {activeTab === "conferencia" && isInConference && (
        <div className="space-y-4">
          {process.validationItems.length > 0 && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {[
                  { label: "OK", status: "ok", color: "text-green-700 bg-green-50 border-green-200" },
                  { label: "Faltando", status: "faltando", color: "text-red-700 bg-red-50 border-red-200" },
                  { label: "Vencido", status: "vencido", color: "text-orange-700 bg-orange-50 border-orange-200" },
                  { label: "Divergente", status: "divergente", color: "text-amber-700 bg-amber-50 border-amber-200" },
                  { label: "Revisar", status: "revisar", color: "text-violet-700 bg-violet-50 border-violet-200" },
                ].map((s) => {
                  const count = process.validationItems.filter((v) => v.status === s.status).length;
                  return (
                    <div key={s.status} className={cn("border rounded-xl p-4 text-center", s.color)}>
                      <p className="text-2xl font-bold">{count}</p>
                      <p className="text-xs font-semibold mt-0.5 uppercase tracking-wide opacity-80">{s.label}</p>
                    </div>
                  );
                })}
              </div>

              <Card>
                <div className="p-4 border-b flex items-center justify-between">
                  <h3 className="font-bold text-slate-900">Todos os itens</h3>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleGenerateReport}
                      className="text-sm font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1"
                    >
                      <FileDown className="w-3.5 h-3.5" />
                      Exportar PDF
                    </button>
                    <Link
                      href={`/processes/${id}/checklist`}
                      className="text-sm font-semibold text-primary hover:underline flex items-center gap-1"
                    >
                      Ver checklist completo <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
                <div>
                  <table className="w-full text-sm text-left">
                    <tbody>
                      {process.validationItems.map((item) => (
                        <tr key={item.id} className={cn("border-t first:border-t-0")}>
                          <td className="p-3 pl-4 font-medium text-slate-800">{item.requirement?.title ?? "—"}</td>
                          <td className="p-3 pr-4 text-right">
                            <ValidationStatusBadge status={item.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          )}
        </div>
      )}

      {/* Edit Dialog */}
      <EditProcessDialog
        process={process}
        open={editOpen}
        onOpenChange={setEditOpen}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir processo?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é irreversível. O processo <strong>"{process.title}"</strong>, junto com todos os documentos, análises e conferências associadas, será permanentemente excluído.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              Excluir permanentemente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}

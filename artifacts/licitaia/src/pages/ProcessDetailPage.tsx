import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Link, useRoute } from "wouter";
import { useGetProcess, ProcessStatus } from "@workspace/api-client-react";
import { useAppActions } from "@/hooks/use-app-actions";
import { ProcessStatusBadge } from "@/components/processes/ProcessStatusBadge";
import { ValidationStatusBadge } from "@/components/processes/ValidationStatusBadge";
import { RequirementsReviewPanel } from "@/components/processes/RequirementsReviewPanel";
import { FileUploadZone, FileListItem } from "@/components/files/FileUploadZone";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type Tab = "documentos" | "analise" | "conferencia";

export function ProcessDetailPage() {
  const [, params] = useRoute("/processes/:id");
  const id = Number(params?.id);

  const { data: process, isLoading } = useGetProcess(id);
  const { uploadEdital, uploadDocument, removeFile, analyzeEdital, analyzeDocs } = useAppActions();

  const hasRequirements = (process?.requirements?.length ?? 0) > 0;
  const isInConference =
    process?.status === ProcessStatus.em_conferencia ||
    process?.status === ProcessStatus.pendencias_encontradas ||
    process?.status === ProcessStatus.pronto_para_revisao ||
    process?.status === ProcessStatus.concluido;

  const defaultTab: Tab = isInConference ? "conferencia" : hasRequirements ? "analise" : "documentos";
  const [activeTab, setActiveTab] = useState<Tab>(defaultTab);

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

          {isInConference && (
            <Link href={`/processes/${id}/checklist`}>
              <Button size="lg" className="w-full lg:w-auto shadow-lg shadow-primary/20 shrink-0">
                <CheckSquare className="w-5 h-5 mr-2" />
                Abrir Checklist
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          )}
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
          {/* Edital Card */}
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

          {/* Docs Card */}
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
          {/* Summary stats */}
          {process.validationItems.length > 0 && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "OK", status: "ok", color: "text-green-700 bg-green-50 border-green-200" },
                  { label: "Faltando", status: "faltando", color: "text-red-700 bg-red-50 border-red-200" },
                  { label: "Vencido", status: "vencido", color: "text-orange-700 bg-orange-50 border-orange-200" },
                  { label: "Divergente", status: "divergente", color: "text-amber-700 bg-amber-50 border-amber-200" },
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
                  <Link
                    href={`/processes/${id}/checklist`}
                    className="text-sm font-semibold text-primary hover:underline flex items-center gap-1"
                  >
                    Ver checklist completo <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
                <div>
                  <table className="w-full text-sm text-left">
                    <tbody>
                      {process.validationItems.map((item, idx) => (
                        <tr key={item.id} className={cn("border-t first:border-t-0")}>
                          <td className="p-3 pl-4 font-medium text-slate-800">{item.requirement.title}</td>
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
    </AppLayout>
  );
}

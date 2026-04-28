import { useState, useRef } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { NextActionBanner } from "@/components/NextActionBanner";
import { computeChamamentoNextAction } from "@/lib/next-action";
import { ReadinessScore } from "@/components/ReadinessScore";
import { computeChamamentoReadiness } from "@/lib/readiness-score";
import { Link, useRoute, useLocation } from "wouter";
import {
  useGetCallNotice,
  useDeleteCallNotice,
  useAnalyzeCallEdital,
  useAnalyzeCallDocuments,
  useUploadNoticeEdital,
  useUploadNoticeDocument,
  useDeleteNoticeFile,
  useUpdateCallNotice,
  getListCallNoticesQueryKey,
  getGetCallNoticeQueryKey,
  CallNoticeDetail,
  NoticeFile,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { notify } from "@/lib/feedback";
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
  BookOpen,
  Upload,
  BrainCircuit,
  CheckSquare,
  Loader2,
  Play,
  ChevronLeft,
  ChevronRight,
  Building2,
  Calendar,
  Hash,
  Tag,
  FileText,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Clock,
  MoreHorizontal,
  Pencil,
  ChevronDown,
  ChevronUp,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  criado: { label: "Criado", color: "text-slate-600", bg: "bg-slate-100" },
  edital_enviado: { label: "Edital Enviado", color: "text-blue-700", bg: "bg-blue-100" },
  edital_processando: { label: "Processando Edital", color: "text-blue-700", bg: "bg-blue-100" },
  requisitos_extraidos: { label: "Requisitos Extraídos", color: "text-indigo-700", bg: "bg-indigo-100" },
  aguardando_documentos: { label: "Aguardando Documentos", color: "text-yellow-700", bg: "bg-yellow-100" },
  documentos_enviados: { label: "Documentos Enviados", color: "text-orange-700", bg: "bg-orange-100" },
  em_conferencia: { label: "Em Conferência", color: "text-purple-700", bg: "bg-purple-100" },
  pendencias_encontradas: { label: "Com Pendências", color: "text-red-700", bg: "bg-red-100" },
  pronto_para_submissao: { label: "Pronto p/ Submissão", color: "text-emerald-700", bg: "bg-emerald-100" },
  concluido: { label: "Concluído", color: "text-green-700", bg: "bg-green-100" },
};

const CATEGORY_LABELS: Record<string, string> = {
  saude: "Saúde",
  educacao: "Educação",
  assistencia_social: "Assistência Social",
  cultura: "Cultura",
  esporte: "Esporte",
  meio_ambiente: "Meio Ambiente",
  habitacao: "Habitação",
  seguranca_publica: "Segurança Pública",
  ciencia_tecnologia: "Ciência e Tecnologia",
  outros: "Outros",
};

const FILE_TYPE_LABELS: Record<string, string> = {
  edital: "Edital",
  anexo: "Anexo",
  documento_osc: "Documento da OSC",
  proposta: "Proposta",
  plano_trabalho: "Plano de Trabalho",
  cronograma: "Cronograma",
};

type Tab = "edital" | "documentos" | "checklist";

function FileUploadCard({
  label,
  accept,
  onUpload,
  isUploading,
  existingFile,
  onDelete,
  fileType,
  multiple,
}: {
  label: string;
  accept?: string;
  onUpload: (file: File, type?: string) => void;
  isUploading: boolean;
  existingFile?: NoticeFile | null;
  onDelete?: (id: number) => void;
  fileType?: string;
  multiple?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div>
      <div
        className={cn(
          "border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all",
          isUploading ? "border-primary/40 bg-primary/5" : "border-slate-200 hover:border-primary/50 hover:bg-primary/5"
        )}
        onClick={() => inputRef.current?.click()}
      >
        {isUploading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <p className="text-sm text-slate-600">Enviando arquivo...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload className="w-8 h-8 text-slate-400" />
            <p className="text-sm font-medium text-slate-700">{label}</p>
            <p className="text-xs text-slate-400">PDF, imagens ou outros documentos (máx. 50MB)</p>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept={accept}
          multiple={multiple}
          onChange={e => {
            const files = Array.from(e.target.files ?? []);
            files.forEach(f => onUpload(f, fileType));
            e.target.value = "";
          }}
        />
      </div>
      {existingFile && (
        <div className="mt-2 flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="text-sm text-slate-700 truncate">{existingFile.name}</span>
          </div>
          {onDelete && (
            <button
              onClick={() => onDelete(existingFile.id)}
              className="p-1 text-slate-400 hover:text-red-500 transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function ChamamentoDetailPage() {
  const [, params] = useRoute("/chamamentos/:id");
  const [, navigate] = useLocation();
  const id = Number(params?.id);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: notice, isLoading } = useGetCallNotice(id);
  const analyzeEditalMutation = useAnalyzeCallEdital();
  const analyzeDocsMutation = useAnalyzeCallDocuments();
  const uploadEditalMutation = useUploadNoticeEdital();
  const uploadDocumentMutation = useUploadNoticeDocument();
  const deleteFileMutation = useDeleteNoticeFile();
  const deleteNoticeMutation = useDeleteCallNotice();

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [showRequirements, setShowRequirements] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("edital");

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetCallNoticeQueryKey(id) });
  };

  const handleUploadEdital = async (file: File) => {
    try {
      await uploadEditalMutation.mutateAsync({ id, data: { file } });
      invalidate();
      notify(toast, "chamamento_edital_uploaded");
    } catch {
      notify(toast, "chamamento_edital_upload_error");
    }
  };

  const handleUploadDocument = async (file: File, fileType?: string) => {
    try {
      await uploadDocumentMutation.mutateAsync({ id, data: { file, fileType } });
      invalidate();
      notify(toast, "chamamento_doc_uploaded");
    } catch {
      notify(toast, "chamamento_doc_upload_error");
    }
  };

  const handleDeleteFile = async (fileId: number) => {
    try {
      await deleteFileMutation.mutateAsync({ id: fileId });
      invalidate();
      notify(toast, "chamamento_file_removed");
    } catch {
      notify(toast, "chamamento_file_remove_error");
    }
  };

  const handleAnalyzeEdital = async () => {
    try {
      await analyzeEditalMutation.mutateAsync({ id });
      invalidate();
      notify(toast, "chamamento_analyzed");
    } catch {
      notify(toast, "chamamento_analyze_error");
    }
  };

  const handleAnalyzeDocs = async () => {
    try {
      const result = await analyzeDocsMutation.mutateAsync({ id });
      invalidate();
      notify(toast, "chamamento_docs_checked");
    } catch {
      notify(toast, "chamamento_docs_check_error");
    }
  };

  const handleDelete = async () => {
    try {
      await deleteNoticeMutation.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getListCallNoticesQueryKey() });
      notify(toast, "chamamento_deleted");
      navigate("/chamamentos");
    } catch {
      notify(toast, "chamamento_delete_error");
    }
  };

  if (isLoading || !notice) {
    return (
      <AppLayout>
        <div className="flex items-center gap-3 py-20 justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <span className="text-slate-500">Carregando chamamento...</span>
        </div>
      </AppLayout>
    );
  }

  const statusInfo = STATUS_LABELS[notice.status] ?? { label: notice.status, color: "text-slate-600", bg: "bg-slate-100" };
  const editalFile = notice.editalFile;
  const documentFiles = notice.documentFiles ?? [];
  const requirements = notice.requirements ?? [];
  const validationItems = notice.validationItems ?? [];

  const okCount = validationItems.filter(v => v.status === "ok").length;
  const pendingCount = validationItems.filter(v => v.status !== "ok").length;
  const totalCount = validationItems.length;

  const hasEdital = !!editalFile;
  const hasRequirements = requirements.length > 0;
  const hasDocuments = documentFiles.length > 0;

  const canAnalyzeEdital = hasEdital && !analyzeEditalMutation.isPending &&
    !["edital_processando"].includes(notice.status);
  const canAnalyzeDocs = hasRequirements && hasDocuments && !analyzeDocsMutation.isPending;

  function getNextStep() {
    switch (notice!.status) {
      case "criado":
        return "Envie o edital do chamamento para extrair os requisitos automaticamente.";
      case "edital_enviado":
        return "Clique em \"Analisar Edital\" para que a IA extraia os requisitos documentais.";
      case "edital_processando":
        return "O edital está sendo processado. Aguarde a conclusão.";
      case "requisitos_extraidos":
        return "Requisitos identificados! Agora envie os documentos da sua OSC para conferência.";
      case "aguardando_documentos":
      case "documentos_enviados":
        return "Envie os documentos da OSC e clique em \"Conferir Documentos\" para iniciar a análise.";
      case "em_conferencia":
        return "Os documentos estão sendo conferidos. Aguarde a conclusão.";
      case "pendencias_encontradas":
        return "Foram encontradas pendências. Revise o checklist e corrija os itens indicados.";
      case "pronto_para_submissao":
        return "Tudo certo! A documentação está completa. Você pode submeter a proposta ao órgão.";
      case "concluido":
        return "Chamamento concluído.";
      default:
        return null;
    }
  }

  const proposta_types = ["proposta", "plano_trabalho", "cronograma"];
  const propostaFiles = documentFiles.filter(f => proposta_types.includes(f.fileType));
  const oscFiles = documentFiles.filter(f => f.fileType === "documento_osc");

  return (
    <AppLayout>
      <div className="mb-6">
        <Link href="/chamamentos" className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-primary mb-4 transition-colors">
          <ChevronLeft className="w-4 h-4 mr-1" /> Chamamentos Públicos
        </Link>

        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                <BookOpen className="w-5 h-5 text-indigo-600" />
              </div>
              <span className={cn("inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold", statusInfo.bg, statusInfo.color)}>
                {statusInfo.label}
              </span>
            </div>
            <h1 className="text-2xl font-display font-bold text-slate-900 leading-tight mb-2">
              {notice.title}
            </h1>
            <div className="flex flex-wrap gap-3 text-sm text-slate-500">
              <span className="flex items-center gap-1.5">
                <Building2 className="w-4 h-4" />
                {notice.agency}
              </span>
              {notice.companyName && (
                <span className="flex items-center gap-1.5 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full text-xs font-semibold">
                  {notice.companyName}
                </span>
              )}
              {notice.referenceNumber && (
                <span className="flex items-center gap-1.5">
                  <Hash className="w-4 h-4" />
                  {notice.referenceNumber}
                </span>
              )}
              {notice.category && (
                <span className="flex items-center gap-1.5">
                  <Tag className="w-4 h-4" />
                  {CATEGORY_LABELS[notice.category] ?? notice.category}
                </span>
              )}
              {notice.deadline && (
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4" />
                  {format(new Date(notice.deadline), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link href={`/chamamentos/${id}/checklist`}>
              <Button variant="outline" size="sm">
                <CheckSquare className="w-4 h-4 mr-2" />
                Ver Checklist
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="sm"
              className="text-red-500 hover:text-red-700 hover:bg-red-50"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Score de Prontidão */}
      <ReadinessScore
        result={computeChamamentoReadiness(notice.status, validationItems)}
        className="mb-3"
      />

      {/* Próxima Ação */}
      {(() => {
        const nextAction = computeChamamentoNextAction({
          status: notice.status,
          requirements,
          validationItems,
        });
        const handleNextAction = () => {
          const dest = nextAction.targetId as Tab | undefined;
          const validTabs: Tab[] = ["edital", "documentos", "checklist"];
          if (dest && validTabs.includes(dest)) {
            setActiveTab(dest);
          }
        };
        return (
          <NextActionBanner
            action={nextAction}
            onAction={handleNextAction}
            className="mb-6"
          />
        );
      })()}

      {hasRequirements && totalCount > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-slate-700">Progresso do Checklist</p>
            <span className="text-sm text-slate-500">{okCount} de {totalCount} itens OK</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2.5">
            <div
              className="bg-emerald-500 h-2.5 rounded-full transition-all"
              style={{ width: totalCount > 0 ? `${(okCount / totalCount) * 100}%` : "0%" }}
            />
          </div>
          {pendingCount > 0 && (
            <div className="mt-2 flex items-center gap-1.5 text-sm text-red-600">
              <AlertCircle className="w-4 h-4" />
              <span>{pendingCount} item{pendingCount !== 1 ? "ns" : ""} pendente{pendingCount !== 1 ? "s" : ""}</span>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-1 mb-6 border-b border-slate-200">
        {(["edital", "documentos", "checklist"] as Tab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px",
              activeTab === tab
                ? "border-primary text-primary"
                : "border-transparent text-slate-500 hover:text-slate-800"
            )}
          >
            {tab === "edital" ? "Edital" : tab === "documentos" ? "Documentos da OSC" : "Proposta e Plano"}
          </button>
        ))}
      </div>

      {activeTab === "edital" && (
        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="text-base font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-slate-400" />
              Edital do Chamamento
            </h2>
            <FileUploadCard
              label="Clique para enviar o edital (PDF)"
              accept="application/pdf"
              onUpload={handleUploadEdital}
              isUploading={uploadEditalMutation.isPending}
              existingFile={editalFile}
              onDelete={handleDeleteFile}
            />

            {hasEdital && (
              <div className="mt-4 flex flex-col sm:flex-row gap-3">
                <Button
                  onClick={handleAnalyzeEdital}
                  disabled={!canAnalyzeEdital}
                  className="flex-1"
                >
                  {analyzeEditalMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <BrainCircuit className="w-4 h-4 mr-2" />
                  )}
                  {analyzeEditalMutation.isPending ? "Analisando..." : "Analisar Edital com IA"}
                </Button>
              </div>
            )}
          </Card>

          {hasRequirements && (
            <Card className="p-6">
              <button
                onClick={() => setShowRequirements(v => !v)}
                className="w-full flex items-center justify-between"
              >
                <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                  <BrainCircuit className="w-5 h-5 text-indigo-500" />
                  Requisitos Identificados pela IA
                  <span className="bg-indigo-100 text-indigo-700 text-xs px-2 py-0.5 rounded-full">
                    {requirements.length}
                  </span>
                </h2>
                {showRequirements ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
              </button>

              {showRequirements && (
                <div className="mt-4 space-y-2">
                  {requirements.map(req => (
                    <div key={req.id} className="flex items-start gap-3 p-3 rounded-lg bg-slate-50">
                      <div className={cn(
                        "mt-0.5 w-2 h-2 rounded-full shrink-0",
                        req.mandatory ? "bg-red-400" : "bg-slate-300"
                      )} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-slate-800">{req.title}</p>
                          {req.requirementType && (
                            <span className="text-xs bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded">
                              {req.requirementType.replace(/_/g, " ")}
                            </span>
                          )}
                          {req.needsReview && (
                            <span className="text-xs bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              Revisar
                            </span>
                          )}
                        </div>
                        {req.description && (
                          <p className="text-xs text-slate-500 mt-0.5">{req.description}</p>
                        )}
                        {req.sourceExcerpt && (
                          <p className="text-xs text-slate-400 italic mt-1 line-clamp-2">
                            &ldquo;{req.sourceExcerpt}&rdquo;
                          </p>
                        )}
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-xs text-slate-400">{Math.round(req.confidence * 100)}%</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}
        </div>
      )}

      {activeTab === "documentos" && (
        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="text-base font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-slate-400" />
              Documentos Institucionais da OSC
            </h2>
            <p className="text-sm text-slate-500 mb-4">
              Envie estatutos, certidões, declarações, comprovantes de experiência e outros documentos exigidos.
            </p>
            <div
              className="border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all hover:border-primary/50 hover:bg-primary/5"
              onClick={() => {
                const input = document.createElement("input");
                input.type = "file";
                input.multiple = true;
                input.onchange = e => {
                  const files = Array.from((e.target as HTMLInputElement).files ?? []);
                  files.forEach(f => handleUploadDocument(f, "documento_osc"));
                };
                input.click();
              }}
            >
              {uploadDocumentMutation.isPending ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="w-8 h-8 text-primary animate-spin" />
                  <p className="text-sm text-slate-600">Enviando...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload className="w-8 h-8 text-slate-400" />
                  <p className="text-sm font-medium text-slate-700">Clique para enviar documentos (múltiplos)</p>
                  <p className="text-xs text-slate-400">PDF, imagens ou outros (máx. 50MB cada)</p>
                </div>
              )}
            </div>

            {oscFiles.length > 0 && (
              <div className="mt-4 space-y-2">
                {oscFiles.map(file => (
                  <div key={file.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm text-slate-700 truncate">{file.name}</p>
                        <p className="text-xs text-slate-400">{FILE_TYPE_LABELS[file.fileType] ?? file.fileType}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteFile(file.id)}
                      className="p-1 text-slate-400 hover:text-red-500 transition-colors shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {hasRequirements && hasDocuments && (
              <div className="mt-4">
                <Button
                  onClick={handleAnalyzeDocs}
                  disabled={!canAnalyzeDocs}
                  className="w-full"
                >
                  {analyzeDocsMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <BrainCircuit className="w-4 h-4 mr-2" />
                  )}
                  {analyzeDocsMutation.isPending ? "Conferindo documentos..." : "Conferir Documentos com IA"}
                </Button>
              </div>
            )}
          </Card>
        </div>
      )}

      {activeTab === "checklist" && (
        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="text-base font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-slate-400" />
              Proposta Técnica e Plano de Trabalho
            </h2>
            <p className="text-sm text-slate-500 mb-4">
              Envie a proposta técnica, plano de trabalho, cronograma e outros anexos específicos do projeto.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { type: "proposta", label: "Proposta Técnica" },
                { type: "plano_trabalho", label: "Plano de Trabalho" },
                { type: "cronograma", label: "Cronograma" },
                { type: "anexo", label: "Outros Anexos" },
              ].map(({ type, label }) => {
                const existingFiles = documentFiles.filter(f => f.fileType === type);
                return (
                  <div key={type} className="border border-slate-200 rounded-xl p-4">
                    <p className="text-sm font-semibold text-slate-800 mb-3">{label}</p>
                    <div
                      className="border border-dashed border-slate-200 rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all"
                      onClick={() => {
                        const input = document.createElement("input");
                        input.type = "file";
                        input.onchange = e => {
                          const file = (e.target as HTMLInputElement).files?.[0];
                          if (file) handleUploadDocument(file, type);
                        };
                        input.click();
                      }}
                    >
                      <Upload className="w-5 h-5 text-slate-400 mx-auto mb-1" />
                      <p className="text-xs text-slate-500">Enviar {label}</p>
                    </div>
                    {existingFiles.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {existingFiles.map(file => (
                          <div key={file.id} className="flex items-center justify-between text-xs p-2 bg-slate-50 rounded">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="text-slate-700 truncate">{file.name}</span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0 ml-2">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                              <button
                                onClick={() => handleDeleteFile(file.id)}
                                className="text-slate-400 hover:text-red-500 transition-colors"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {hasRequirements && hasDocuments && (
              <div className="mt-6">
                <Button
                  onClick={handleAnalyzeDocs}
                  disabled={!canAnalyzeDocs}
                  className="w-full"
                >
                  {analyzeDocsMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <BrainCircuit className="w-4 h-4 mr-2" />
                  )}
                  {analyzeDocsMutation.isPending ? "Conferindo..." : "Conferir Todos os Documentos com IA"}
                </Button>
              </div>
            )}
          </Card>
        </div>
      )}

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Chamamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Todos os arquivos e requisitos associados serão excluídos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}

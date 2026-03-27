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
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export function ProcessDetailPage() {
  const [, params] = useRoute("/processes/:id");
  const id = Number(params?.id);

  const { data: process, isLoading } = useGetProcess(id);
  const { uploadEdital, uploadDocument, removeFile, analyzeEdital, analyzeDocs } = useAppActions();

  if (isLoading)
    return (
      <AppLayout>
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  if (!process)
    return (
      <AppLayout>
        <div className="text-center py-12 text-slate-500">Processo não encontrado</div>
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
  const hasRequirements = process.requirements.length > 0;
  const isInConference =
    process.status === ProcessStatus.em_conferencia ||
    process.status === ProcessStatus.pendencias_encontradas ||
    process.status === ProcessStatus.pronto_para_revisao ||
    process.status === ProcessStatus.concluido;

  return (
    <AppLayout>
      {/* Breadcrumb + Header */}
      <div className="mb-6">
        <div className="flex items-center gap-1.5 text-sm text-slate-500 mb-4 font-medium">
          <Link href="/processes" className="hover:text-primary transition-colors">
            Processos
          </Link>
          <ChevronRight className="w-4 h-4" />
          <span className="text-slate-900 truncate max-w-xs">{process.title}</span>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div className="flex-1">
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
            <h1 className="text-2xl lg:text-3xl font-display font-bold text-slate-900 mb-1">
              {process.title}
            </h1>
            <p className="text-slate-600 font-medium text-base">{process.agency}</p>
            {process.deadline && (
              <p className="text-slate-500 mt-1.5 flex items-center gap-1.5 text-sm">
                <CalendarDays className="w-4 h-4" />
                Abertura:{" "}
                {format(new Date(process.deadline), "dd 'de' MMMM, yyyy 'às' HH:mm", {
                  locale: ptBR,
                })}
              </p>
            )}
          </div>

          {isInConference && (
            <Link href={`/processes/${id}/checklist`}>
              <Button size="lg" className="w-full lg:w-auto shadow-lg shadow-primary/20">
                <CheckSquare className="w-5 h-5 mr-2" />
                Acessar Checklist
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Upload + Docs row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Edital Column */}
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
                  <div className="flex items-center justify-between text-sm text-slate-600 bg-green-50 border border-green-200 rounded-lg px-3 py-2.5">
                    <span className="font-medium text-green-800">
                      {process.requirements.filter((r) => r.category !== "informacao_principal").length} exigências extraídas
                    </span>
                    <span className="text-xs text-green-600 font-semibold">✓ Concluído</span>
                  </div>
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

        {/* Documents Column */}
        <Card
          className="overflow-hidden lg:col-span-2 transition-opacity duration-300"
          style={{ opacity: process.editalFile ? 1 : 0.6 }}
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
              <div className="text-center py-8 text-slate-500 text-sm">
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
                      <h4 className="font-bold text-indigo-900 text-sm">
                        Pronto para conferência
                      </h4>
                      <p className="text-xs text-indigo-700 mt-1">
                        A IA cruzará os documentos enviados com as{" "}
                        {process.requirements.filter((r) => r.category !== "informacao_principal").length} exigências do edital.
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

      {/* Requirements Review Panel — shown after AI extraction */}
      {hasRequirements && (
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
              <Link href={`/processes/${id}/checklist`}>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-white/20 text-white hover:bg-white/10"
                >
                  Ver Checklist
                  <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                </Button>
              </Link>
            )}
          </div>

          <div className="p-6">
            <RequirementsReviewPanel requirements={process.requirements} />
          </div>
        </Card>
      )}

      {/* Checklist preview — shown after conference */}
      {process.validationItems.length > 0 && (
        <Card className="mt-6">
          <div className="p-5 border-b flex justify-between items-center">
            <h3 className="font-bold text-slate-900">Prévia do Checklist de Conferência</h3>
            <Link
              href={`/processes/${id}/checklist`}
              className="text-sm font-semibold text-primary hover:underline"
            >
              Ver completo
            </Link>
          </div>
          <div>
            <table className="w-full text-sm text-left">
              <tbody>
                {process.validationItems.slice(0, 5).map((item, idx) => (
                  <tr key={item.id} className={idx !== 0 ? "border-t" : ""}>
                    <td className="p-4 py-3 font-medium text-slate-800 w-2/3">
                      {item.requirement.title}
                    </td>
                    <td className="p-4 py-3 text-right">
                      <ValidationStatusBadge status={item.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </AppLayout>
  );
}

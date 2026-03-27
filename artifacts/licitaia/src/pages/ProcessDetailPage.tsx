import { AppLayout } from "@/components/layout/AppLayout";
import { Link, useRoute } from "wouter";
import { useGetProcess, ProcessStatus } from "@workspace/api-client-react";
import { useAppActions } from "@/hooks/use-app-actions";
import { ProcessStatusBadge } from "@/components/processes/ProcessStatusBadge";
import { ValidationStatusBadge } from "@/components/processes/ValidationStatusBadge";
import { FileUploadZone, FileListItem } from "@/components/files/FileUploadZone";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BrainCircuit, CheckSquare, FileText, ArrowRight, Loader2, Play } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export function ProcessDetailPage() {
  const [, params] = useRoute("/processes/:id");
  const id = Number(params?.id);
  
  const { data: process, isLoading } = useGetProcess(id);
  const { uploadEdital, uploadDocument, removeFile, analyzeEdital, analyzeDocs } = useAppActions();

  if (isLoading) return <AppLayout><div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div></AppLayout>;
  if (!process) return <AppLayout><div className="text-center py-12 text-slate-500">Processo não encontrado</div></AppLayout>;

  const handleEditalUpload = async (file: Blob) => {
    await uploadEdital.mutateAsync({ id, data: { file } });
  };

  const handleDocUpload = async (file: Blob) => {
    await uploadDocument.mutateAsync({ id, data: { file } });
  };

  // Logic to determine active section and next action
  const needsEdital = !process.editalFile;
  const needsEditalAnalysis = process.editalFile && process.status === ProcessStatus.edital_enviado;
  const needsDocs = process.status === ProcessStatus.exigencias_extraidas || process.status === ProcessStatus.aguardando_documentos;
  const needsDocAnalysis = process.documentFiles.length > 0 && (process.status === ProcessStatus.documentos_enviados || process.status === ProcessStatus.aguardando_documentos);

  return (
    <AppLayout>
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-4 font-medium">
          <Link href="/processes" className="hover:text-primary transition-colors">Processos</Link>
          <ChevronRightIcon className="w-4 h-4" />
          <span className="text-slate-900 truncate max-w-[200px]">{process.title}</span>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <ProcessStatusBadge status={process.status} />
              <span className="text-sm font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">{process.modality}</span>
              {process.editalNumber && <span className="text-sm font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">Edital: {process.editalNumber}</span>}
            </div>
            <h1 className="text-3xl font-display font-bold text-slate-900 mb-2">{process.title}</h1>
            <p className="text-slate-600 font-medium text-lg">{process.agency}</p>
            
            {process.deadline && (
              <p className="text-slate-500 mt-2 flex items-center">
                <CalendarIcon className="w-4 h-4 mr-2" />
                Abertura: {format(new Date(process.deadline), "dd 'de' MMMM, yyyy 'às' HH:mm", { locale: ptBR })}
              </p>
            )}
          </div>

          {(process.status === ProcessStatus.em_conferencia || process.status === ProcessStatus.pendencias_encontradas || process.status === ProcessStatus.pronto_para_revisao || process.status === ProcessStatus.concluido) && (
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Edital & Requirements */}
        <div className="lg:col-span-1 space-y-6">
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
                  <FileListItem file={process.editalFile} onDelete={(fid) => removeFile.mutate({ id: fid })} />
                  
                  {needsEditalAnalysis && (
                    <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg mt-4">
                      <p className="text-sm text-blue-800 font-medium mb-3">Edital enviado. A IA precisa ler e extrair as exigências para montar o checklist.</p>
                      <Button 
                        onClick={() => analyzeEdital.mutate({ id })} 
                        disabled={analyzeEdital.isPending}
                        className="w-full bg-blue-600 hover:bg-blue-700"
                      >
                        {analyzeEdital.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <BrainCircuit className="w-4 h-4 mr-2" />}
                        {analyzeEdital.isPending ? "Analisando..." : "Extrair Exigências"}
                      </Button>
                    </div>
                  )}

                  {process.requirements.length > 0 && (
                    <div className="mt-4 pt-4 border-t">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-bold text-slate-700">Exigências Extraídas</span>
                        <span className="bg-slate-100 text-slate-600 text-xs font-bold px-2 py-1 rounded-full">{process.requirements.length}</span>
                      </div>
                      <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
                        {process.requirements.slice(0, 5).map(req => (
                          <div key={req.id} className="text-sm p-2 bg-slate-50 rounded border text-slate-700 line-clamp-2">
                            {req.title}
                          </div>
                        ))}
                        {process.requirements.length > 5 && (
                          <p className="text-xs text-center text-slate-500 font-medium pt-1">+ {process.requirements.length - 5} itens</p>
                        )}
                      </div>
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
        </div>

        {/* Right Column: Documents & Checklist */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="overflow-hidden opacity-100 transition-opacity duration-300" style={{ opacity: process.requirements.length > 0 ? 1 : 0.6 }}>
            <div className="bg-slate-50 border-b p-4 flex justify-between items-center">
              <h3 className="font-bold flex items-center gap-2 text-slate-900">
                <FolderIcon className="w-5 h-5 text-indigo-500" />
                2. Documentos da Empresa
              </h3>
              <span className="text-sm font-medium text-slate-500">{process.documentFiles.length} arquivos</span>
            </div>
            
            <div className="p-5">
              {!process.editalFile ? (
                <div className="text-center py-8 text-slate-500 text-sm">
                  Envie o edital primeiro para extrair as exigências.
                </div>
              ) : (
                <div className="space-y-6">
                  {process.documentFiles.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {process.documentFiles.map(file => (
                        <FileListItem key={file.id} file={file} onDelete={(fid) => removeFile.mutate({ id: fid })} />
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
                         <p className="text-xs text-indigo-700 mt-1">A IA cruzará os documentos enviados com as {process.requirements.length} exigências do edital.</p>
                       </div>
                       <Button 
                         onClick={() => analyzeDocs.mutate({ id })} 
                         disabled={analyzeDocs.isPending}
                         className="bg-indigo-600 hover:bg-indigo-700 text-white shrink-0 shadow-md shadow-indigo-200"
                       >
                         {analyzeDocs.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
                         {analyzeDocs.isPending ? "Conferindo..." : "Iniciar Conferência"}
                       </Button>
                     </div>
                  )}
                </div>
              )}
            </div>
          </Card>

          {process.validationItems.length > 0 && (
            <Card>
              <div className="p-5 border-b flex justify-between items-center">
                <h3 className="font-bold text-slate-900">Prévia do Checklist</h3>
                <Link href={`/processes/${id}/checklist`} className="text-sm font-semibold text-primary hover:underline">
                  Ver completo
                </Link>
              </div>
              <div className="p-0">
                <table className="w-full text-sm text-left">
                  <tbody>
                    {process.validationItems.slice(0, 4).map((item, idx) => (
                      <tr key={item.id} className={idx !== 0 ? "border-t" : ""}>
                        <td className="p-4 py-3 font-medium text-slate-800 w-2/3">{item.requirement.title}</td>
                        <td className="p-4 py-3 text-right"><ValidationStatusBadge status={item.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

function ChevronRightIcon(props: React.SVGProps<SVGSVGElement>) {
  return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="m9 18 6-6-6-6"/></svg>
}
function CalendarIcon(props: React.SVGProps<SVGSVGElement>) {
  return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
}
function FolderIcon(props: React.SVGProps<SVGSVGElement>) {
  return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>
}

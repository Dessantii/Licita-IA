import { useState, useEffect } from "react";
import { ProcessAnalysisTab } from "./ProcessAnalysisTab";
import { DocumentosTab } from "./DocumentosTab";
import { PropostaTab } from "./PropostaTab";
import { SessionTab } from "./SessionTab";
import { getToken } from "@/hooks/use-auth";
import { AppLayout } from "@/components/layout/AppLayout";
import { Link, useRoute, useLocation } from "wouter";
import { useGetProcess, useDeleteProcess, ProcessStatus, getListProcessesQueryKey } from "@workspace/api-client-react";
import { useAppActions } from "@/hooks/use-app-actions";
import { RequirementsReviewPanel } from "@/components/processes/RequirementsReviewPanel";
import { EditProcessDialog } from "@/components/processes/EditProcessDialog";
import { FileUploadZone, FileListItem } from "@/components/files/FileUploadZone";
import { ValidationStatusBadge } from "@/components/processes/ValidationStatusBadge";
import { Button } from "@/components/ui/button";
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
  CalendarDays,
  ChevronRight,
  Upload,
  MoreHorizontal,
  Pencil,
  Trash2,
  FileDown,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Sparkles,
  Building2,
  Lock,
  FolderOpen,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { notify } from "@/lib/feedback";

// ── Wizard step detection ─────────────────────────────────────────────────

function getWizardStep(status: string): 1 | 2 | 3 {
  if (
    status === ProcessStatus.concluido ||
    status === ProcessStatus.pronto_para_revisao
  ) return 3;
  if (
    status === ProcessStatus.em_conferencia ||
    status === ProcessStatus.pendencias_encontradas ||
    status === ProcessStatus.documentos_enviados ||
    status === ProcessStatus.aguardando_documentos
  ) return 2;
  return 1;
}

function getReadinessPercent(status: string): number {
  switch (status) {
    case ProcessStatus.criado: return 5;
    case ProcessStatus.edital_enviado: return 20;
    case ProcessStatus.edital_processando: return 30;
    case ProcessStatus.exigencias_extraidas: return 40;
    case ProcessStatus.aguardando_documentos: return 45;
    case ProcessStatus.documentos_enviados: return 60;
    case ProcessStatus.em_conferencia: return 70;
    case ProcessStatus.pendencias_encontradas: return 55;
    case ProcessStatus.pronto_para_revisao: return 90;
    case ProcessStatus.concluido: return 100;
    default: return 0;
  }
}

function getReadinessMessage(percent: number): { msg: string; color: string } {
  if (percent === 100) return { msg: "Processo concluído! ✓", color: "#059669" };
  if (percent >= 85) return { msg: "Falta pouco! Você está quase pronto.", color: "#059669" };
  if (percent >= 60) return { msg: "Bom progresso! Continue assim.", color: "#0066FF" };
  if (percent >= 30) return { msg: "Você já começou! Vamos continuar.", color: "#D97706" };
  return { msg: "Vamos começar! Siga as etapas abaixo.", color: "#64748b" };
}

// ── Validation icon helper ───────────────────────────────────────────────

function ValidationIcon({ status }: { status: string }) {
  if (status === "ok") return <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />;
  if (status === "vencido") return <Clock className="w-4 h-4 text-orange-500 flex-shrink-0" />;
  if (status === "faltando") return <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />;
  if (status === "divergente") return <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />;
  return <AlertTriangle className="w-4 h-4 text-violet-400 flex-shrink-0" />;
}

function ValidationLabel({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    ok: { label: "Tudo certo", color: "#059669", bg: "#F0FDF4" },
    faltando: { label: "Não enviado", color: "#DC2626", bg: "#FEF2F2" },
    vencido: { label: "Vencendo", color: "#EA580C", bg: "#FFF7ED" },
    divergente: { label: "Conferir", color: "#D97706", bg: "#FFFBEB" },
    revisar: { label: "Revisar", color: "#7C3AED", bg: "#F5F3FF" },
  };
  const s = map[status] ?? { label: status, color: "#64748b", bg: "#f8fafc" };
  return (
    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ color: s.color, background: s.bg }}>
      {s.label}
    </span>
  );
}

// ── Step indicator ───────────────────────────────────────────────────────

function WizardSteps({ current, step2Locked, step3Locked }: {
  current: 1 | 2 | 3;
  step2Locked: boolean;
  step3Locked: boolean;
}) {
  const steps = [
    { n: 1, label: "Entenda o edital", locked: false },
    { n: 2, label: "Prepare os documentos", locked: step2Locked },
    { n: 3, label: "Envie a proposta", locked: step3Locked },
  ];

  return (
    <div className="flex items-center gap-0 mb-8">
      {steps.map((s, i) => {
        const isDone = s.n < current;
        const isActive = s.n === current;
        const isLocked = s.locked && !isDone;
        return (
          <div key={s.n} className="flex items-center flex-1 min-w-0">
            <div className={cn("flex items-center gap-2 flex-shrink-0", isLocked && "opacity-40")}>
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all"
                style={{
                  background: isDone ? '#059669' : isActive ? '#0066FF' : '#E2E8F0',
                  color: isDone || isActive ? 'white' : '#94a3b8',
                }}
              >
                {isDone ? <CheckCircle2 className="w-3.5 h-3.5" /> : s.n}
              </div>
              <div className="hidden sm:block">
                <p className={cn("text-xs font-semibold whitespace-nowrap", isActive ? "text-slate-900" : "text-slate-400")}>
                  {s.label}
                </p>
              </div>
            </div>
            {i < steps.length - 1 && (
              <div
                className="flex-1 h-[2px] mx-3"
                style={{ background: s.n < current ? '#059669' : '#E2E8F0' }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────

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
  const [activeTab, setActiveTab] = useState<"resumo" | "analise" | "documentos" | "proposta" | "verificacao" | "sessao">("resumo");
  const [companyData, setCompanyData] = useState<any>(null);

  const token = getToken();

  useEffect(() => {
    if (!process?.companyId || !token) return;
    fetch(`${import.meta.env.VITE_API_URL ?? ""}/api/companies/${process.companyId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setCompanyData(data); })
      .catch(() => {});
  }, [process?.companyId, token]);

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getListProcessesQueryKey() });
      notify(toast, "process_deleted");
      navigate("/processes");
    } catch {
      notify(toast, "process_delete_error");
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
          item.status === "ok" ? "#16a34a" : item.status === "faltando" ? "#dc2626" :
          item.status === "vencido" ? "#ea580c" : item.status === "divergente" ? "#d97706" : "#6366f1"
        }">${item.status}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:12px;color:#64748b">${item.notes ?? "—"}</td>
      </tr>
    `).join("");

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><title>Relatório — ${process.title}</title>
<style>
  body{font-family:Arial,sans-serif;margin:0;padding:32px;color:#1e293b}
  .header{border-bottom:3px solid #0066FF;padding-bottom:16px;margin-bottom:24px}
  .header h1{margin:0 0 4px;font-size:20px}.meta{color:#64748b;font-size:13px}
  .stats{display:flex;gap:16px;margin-bottom:24px}
  .stat{flex:1;border:1px solid #e2e8f0;border-radius:8px;padding:12px;text-align:center}
  .stat .num{font-size:24px;font-weight:700}.stat .lbl{font-size:11px;text-transform:uppercase;color:#64748b;margin-top:2px}
  table{width:100%;border-collapse:collapse;font-size:13px}
  thead{background:#f8fafc}
  th{padding:10px 12px;text-align:left;font-size:12px;text-transform:uppercase;color:#64748b;border-bottom:2px solid #e2e8f0}
  @media print{.no-print{display:none}}
</style></head>
<body>
<div class="no-print" style="margin-bottom:16px">
  <button onclick="window.print()" style="background:#0066FF;color:white;border:none;padding:8px 20px;border-radius:6px;cursor:pointer;font-size:14px">Imprimir / Salvar PDF</button>
</div>
<div class="header">
  <div style="color:#0066FF;font-weight:700;font-size:12px;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">LicitaIA — Relatório de Prontidão</div>
  <h1>${process.title}</h1>
  <div class="meta">
    ${process.agency} &nbsp;•&nbsp; ${process.modality}
    ${process.editalNumber ? `&nbsp;•&nbsp; Edital ${process.editalNumber}` : ""}
    ${process.deadline ? `&nbsp;•&nbsp; Prazo: ${format(new Date(process.deadline), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}` : ""}
    &nbsp;•&nbsp; Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
  </div>
</div>
<div class="stats">
  <div class="stat" style="border-color:#bbf7d0"><div class="num" style="color:#16a34a">${stats.ok}</div><div class="lbl">Tudo certo</div></div>
  <div class="stat" style="border-color:#fecaca"><div class="num" style="color:#dc2626">${stats.faltando}</div><div class="lbl">Faltando</div></div>
  <div class="stat" style="border-color:#fed7aa"><div class="num" style="color:#ea580c">${stats.vencido}</div><div class="lbl">Prazo vencido</div></div>
  <div class="stat" style="border-color:#fde68a"><div class="num" style="color:#d97706">${stats.divergente}</div><div class="lbl">Conferir</div></div>
  <div class="stat" style="border-color:#c7d2fe"><div class="num" style="color:#6366f1">${stats.revisar}</div><div class="lbl">Revisar</div></div>
</div>
<table>
  <thead><tr><th>Documento / Exigência</th><th>Status</th><th>Observações</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
</body></html>`;

    const blob = new Blob([html], { type: "text/html" });
    window.open(URL.createObjectURL(blob), "_blank");
  };

  if (isLoading)
    return (
      <AppLayout>
        <div className="flex justify-center py-20">
          <Loader2 className="w-7 h-7 animate-spin text-blue-500" />
        </div>
      </AppLayout>
    );

  if (!process)
    return (
      <AppLayout>
        <div className="text-center py-20 text-slate-500">Processo não encontrado.</div>
      </AppLayout>
    );

  const hasRequirements = (process.requirements?.length ?? 0) > 0;
  const isInConference =
    process.status === ProcessStatus.em_conferencia ||
    process.status === ProcessStatus.pendencias_encontradas ||
    process.status === ProcessStatus.pronto_para_revisao ||
    process.status === ProcessStatus.concluido;

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

  const docReqCount = process.requirements.filter(r => r.category !== "informacao_principal").length;
  const infoReqs = process.requirements.filter(r => r.category === "informacao_principal");

  const wizardStep = getWizardStep(process.status);
  const readiness = getReadinessPercent(process.status);
  const readinessMsg = getReadinessMessage(readiness);

  const step2Locked = !hasRequirements && !isInConference;
  const step3Locked = !isInConference;

  // Validation stats
  const valStats = {
    ok: process.validationItems.filter(v => v.status === "ok").length,
    faltando: process.validationItems.filter(v => v.status === "faltando").length,
    vencido: process.validationItems.filter(v => v.status === "vencido").length,
    divergente: process.validationItems.filter(v => v.status === "divergente").length,
    revisar: process.validationItems.filter(v => v.status === "revisar").length,
    total: process.validationItems.length,
  };

  return (
    <AppLayout>
      <div className="px-6 lg:px-8 py-8 max-w-5xl">

        {/* Breadcrumb */}
        <div className="flex items-center gap-1 text-xs text-slate-400 mb-6 font-medium">
          <Link href="/processes" className="hover:text-blue-600 transition-colors">Licitações</Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-slate-600 truncate max-w-xs">{process.title}</span>
        </div>

        {/* Process header */}
        <div className="bg-white rounded-2xl p-6 mb-6" style={{ border: '1px solid #E8EFF6', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              {/* Tags */}
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <span className="text-xs font-semibold bg-slate-100 text-slate-500 px-2.5 py-0.5 rounded-md">
                  {process.modality}
                </span>
                {process.editalNumber && (
                  <span className="text-xs font-semibold bg-slate-100 text-slate-500 px-2.5 py-0.5 rounded-md">
                    Edital {process.editalNumber}
                  </span>
                )}
                {process.companyName && (
                  <span className="text-xs font-semibold bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-md">
                    {process.companyName}
                  </span>
                )}
              </div>

              <h1 className="text-xl font-bold text-slate-900 leading-tight mb-3">
                {process.title}
              </h1>

              <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
                <span className="flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-slate-400" />
                  {process.agency}
                </span>
                {process.deadline && (
                  <span className="flex items-center gap-1.5">
                    <CalendarDays className="w-4 h-4 text-slate-400" />
                    Fecha em {format(new Date(process.deadline), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                  </span>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon">
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setEditOpen(true)}>
                    <Pencil className="w-4 h-4 mr-2" /> Editar processo
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setDeleteOpen(true)} className="text-destructive focus:text-destructive">
                    <Trash2 className="w-4 h-4 mr-2" /> Excluir processo
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-5 pt-5" style={{ borderTop: '1px solid #E8EFF6' }}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium" style={{ color: readinessMsg.color }}>
                {readinessMsg.msg}
              </p>
              <span className="text-sm font-bold" style={{ color: readinessMsg.color }}>
                {readiness}%
              </span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${readiness}%`, background: readinessMsg.color }}
              />
            </div>
          </div>
        </div>

        {/* ── Tab navigation ─────────────────────────────────────────────── */}
        {(() => {
          const isPregao = /pregão/i.test(process.modality ?? "");
          const tabs: { id: "resumo" | "analise" | "documentos" | "proposta" | "verificacao" | "sessao"; label: string; locked: boolean }[] = [
            { id: "resumo", label: "Resumo", locked: false },
            { id: "analise", label: "Análise IA", locked: !process.editalFile },
            { id: "documentos", label: "Documentos", locked: !hasRequirements && !isInConference },
            { id: "proposta", label: "Proposta", locked: false },
            { id: "verificacao", label: "Verificação", locked: !isInConference },
            ...(isPregao ? [{ id: "sessao" as const, label: "Sessão", locked: false }] : []),
          ];
          return (
            <div className="flex gap-1 mb-6 p-1 rounded-xl" style={{ background: '#F1F5F9' }}>
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => { if (!tab.locked) setActiveTab(tab.id); }}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-all",
                    activeTab === tab.id
                      ? "bg-white text-slate-900 shadow-sm"
                      : tab.locked
                        ? "text-slate-300 cursor-not-allowed"
                        : "text-slate-500 hover:text-slate-700 hover:bg-white/60"
                  )}
                >
                  {tab.locked && <Lock className="w-3 h-3" />}
                  {tab.label}
                </button>
              ))}
            </div>
          );
        })()}

        {/* ── ETAPA 1: Entenda o edital (Resumo) ─────────────────────────── */}
        {activeTab === "resumo" && <div className="mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
              style={{ background: wizardStep > 1 ? '#059669' : '#0066FF', color: 'white' }}
            >
              {wizardStep > 1 ? <CheckCircle2 className="w-4 h-4" /> : "1"}
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Entenda o edital</h2>
              <p className="text-xs text-slate-500">Envie o PDF do edital para a IA ler e explicar o que você precisa.</p>
            </div>
          </div>

          <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #E8EFF6' }}>
            {/* Edital upload */}
            <div className="bg-white p-5">
              <div className="flex items-center gap-2 mb-4">
                <FileText className="w-4 h-4 text-blue-500" />
                <p className="text-sm font-semibold text-slate-800">O edital da licitação</p>
                <span className="text-xs text-slate-400 ml-auto">Passo 1 de 2</span>
              </div>

              {process.editalFile ? (
                <div className="space-y-3">
                  <FileListItem file={process.editalFile} onDelete={(fid) => removeFile.mutate({ id: fid })} />

                  {needsEditalAnalysis && (
                    <div className="rounded-xl p-4 flex items-start gap-4" style={{ background: '#EFF6FF', border: '1px solid #DBEAFE' }}>
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#E5F0FF' }}>
                        <Sparkles className="w-4 h-4 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-blue-900 mb-1">
                          Edital enviado! Agora deixa a IA ler para você.
                        </p>
                        <p className="text-xs text-blue-700 mb-3">
                          Em segundos, a IA vai identificar todos os documentos que você precisa apresentar.
                        </p>
                        <Button
                          onClick={() => analyzeEdital.mutate({ id })}
                          disabled={analyzeEdital.isPending}
                          style={{ background: '#0066FF' }}
                          className="hover:opacity-90 text-white"
                        >
                          {analyzeEdital.isPending
                            ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analisando...</>
                            : <><BrainCircuit className="w-4 h-4 mr-2" /> Analisar edital com IA</>}
                        </Button>
                      </div>
                    </div>
                  )}

                  {hasRequirements && (
                    <div className="rounded-xl p-4 flex items-center gap-4" style={{ background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                      <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-green-900">
                          Edital analisado! {docReqCount} documentos identificados.
                        </p>
                        <p className="text-xs text-green-700 mt-0.5">
                          A IA leu o edital e listou tudo o que você precisa apresentar.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <FileUploadZone
                  onUpload={handleEditalUpload}
                  isUploading={uploadEdital.isPending}
                  label="Enviar PDF do edital"
                />
              )}
            </div>

            {/* Requirements list */}
            {hasRequirements && (
              <div className="border-t p-5" style={{ borderColor: '#E8EFF6', background: '#FAFBFC' }}>
                <div className="flex items-center gap-2 mb-3">
                  <BrainCircuit className="w-4 h-4 text-blue-500" />
                  <p className="text-sm font-semibold text-slate-800">O que o edital pede</p>
                </div>
                <RequirementsReviewPanel requirements={process.requirements} />
              </div>
            )}
          </div>
        </div>}

        {/* ── ETAPA: Análise IA ──────────────────────────────────────────── */}
        {activeTab === "analise" && (
          <ProcessAnalysisTab
            processId={id}
            process={process}
            companyData={companyData}
            onGoToDocuments={() => setActiveTab("documentos")}
          />
        )}

        {/* ── ETAPA 2: Documentos ───────────────────────────────────────── */}
        {activeTab === "documentos" && (
          <DocumentosTab
            id={id}
            process={process}
            companyData={companyData}
            step2Locked={step2Locked}
            isInConference={isInConference}
            needsDocAnalysis={needsDocAnalysis}
            valStats={valStats}
            docReqCount={docReqCount}
            uploadDocument={uploadDocument}
            handleDocUpload={handleDocUpload}
            removeFile={removeFile}
            analyzeDocs={analyzeDocs}
          />
        )}

        {/* ── ETAPA 4: Proposta Comercial ───────────────────────────────── */}
        {activeTab === "proposta" && (
          <PropostaTab process={process} companyData={companyData} />
        )}

        {/* ── ETAPA 5: Sessão de Disputa ────────────────────────────────── */}
        {activeTab === "sessao" && (
          <SessionTab
            processId={id}
            process={process as any}
            companyData={companyData}
          />
        )}

        {/* ── ETAPA 3: Verificação ──────────────────────────────────────── */}
        {activeTab === "verificacao" && <div>
          <div className="flex items-center gap-3 mb-4">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 transition-all"
              style={{
                background: step3Locked ? '#E2E8F0' : wizardStep === 3 ? '#0066FF' : '#E2E8F0',
                color: step3Locked ? '#94a3b8' : 'white',
              }}
            >
              {step3Locked ? <Lock className="w-3.5 h-3.5" /> : "3"}
            </div>
            <div>
              <h2 className={cn("text-base font-bold", step3Locked ? "text-slate-400" : "text-slate-900")}>
                Envie sua proposta
              </h2>
              <p className="text-xs text-slate-500">
                {step3Locked
                  ? "Disponível quando todos os documentos estiverem conferidos."
                  : "Você está quase lá! Gere o relatório e envie sua proposta."}
              </p>
            </div>
          </div>

          {!step3Locked ? (
            <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #E8EFF6' }}>

              {/* Ready state */}
              {valStats.faltando === 0 && valStats.vencido === 0 ? (
                <div className="p-6" style={{ background: 'linear-gradient(135deg, #F0FDF4 0%, #DCFCE7 100%)' }}>
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#BBF7D0' }}>
                      <CheckCircle2 className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <p className="text-lg font-bold text-green-900 mb-1">
                        Você está pronto para participar! 🎉
                      </p>
                      <p className="text-sm text-green-700">
                        Todos os documentos foram verificados. Gere o relatório de prontidão e envie sua proposta no portal da licitação.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-5" style={{ background: '#FFFBEB', borderBottom: '1px solid #FDE68A' }}>
                  <p className="text-sm font-semibold text-amber-900">
                    Ainda há {valStats.faltando + valStats.vencido} pendência(s) — mas você pode prosseguir com cautela.
                  </p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    Revise os documentos faltando antes de enviar a proposta.
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="bg-white p-5 flex flex-wrap items-center gap-3">
                <Button
                  onClick={handleGenerateReport}
                  variant="outline"
                  className="gap-2 border-slate-200"
                >
                  <FileDown className="w-4 h-4" />
                  Gerar relatório PDF
                </Button>

                <Link href={`/processes/${id}/checklist`}>
                  <Button className="gap-2" style={{ background: '#0066FF' }}>
                    <CheckSquare className="w-4 h-4" />
                    Ver checklist completo
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </Link>

                {process.sourceUrl && (
                  <a href={process.sourceUrl} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" className="gap-2 border-slate-200">
                      <ExternalLink className="w-4 h-4" />
                      Ir para o portal
                    </Button>
                  </a>
                )}
              </div>

              {/* Checklist confirmation */}
              <div className="border-t p-5" style={{ borderColor: '#E8EFF6', background: '#FAFBFC' }}>
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">Antes de enviar, confirme:</p>
                <div className="space-y-2">
                  {[
                    "Revisei todos os documentos verificados pela IA",
                    "Conferi o prazo de abertura das propostas",
                    "Tenho acesso ao portal onde a proposta deve ser enviada",
                    "Meu representante legal está disponível para assinar",
                  ].map((item, i) => (
                    <label key={i} className="flex items-start gap-3 cursor-pointer group">
                      <input type="checkbox" className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                      <span className="text-sm text-slate-600">{item}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl p-6 text-center" style={{ border: '2px dashed #E2E8F0', background: '#FAFBFC' }}>
              <Lock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-400">Complete as etapas anteriores primeiro.</p>
            </div>
          )}
        </div>}

      </div>

      {/* Dialogs */}
      <EditProcessDialog process={process} open={editOpen} onOpenChange={setEditOpen} />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir processo?</AlertDialogTitle>
            <AlertDialogDescription>
              Todos os arquivos e análises deste processo serão removidos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}

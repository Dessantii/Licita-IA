import { useState, useEffect, useCallback } from "react";
import { getToken } from "@/hooks/use-auth";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  GitCommitHorizontal, CheckCircle2, Clock, AlertTriangle,
  Scale, FileText, FolderCheck, FileBadge, Lock,
  Loader2, Copy, Download, Check, X, Sparkles,
  ChevronDown, ChevronUp, ExternalLink, Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";

const API = import.meta.env.VITE_API_URL ?? "";

// ── Types ─────────────────────────────────────────────────────────────────────

interface StepState {
  status: "pending" | "done" | "skipped" | "error";
  completedAt?: string;
  data?: Record<string, any>;
}

interface PostSessionTimeline {
  steps: Record<string, StepState>;
  hasRecurso?: boolean;
  recursoData?: { recorrente?: string; motivo?: string; status?: string };
  userWantsRecurso?: boolean;
  userRecursoData?: { motivo?: string; lanceVencedor?: string; lanceUsuario?: string };
}

interface HabilitacaoDoc {
  id: number;
  title: string;
  description?: string | null;
  mandatory: boolean;
  matchedDocument: { id: number; titulo: string; tipo: string; dataValidade?: string | null } | null;
  status: "available" | "expired" | "absent";
}

export interface PostSessionProcess {
  id: number;
  title: string;
  agency: string;
  modality: string;
  editalNumber?: string | null;
  companyId?: number | null;
  sessionDate?: string | null;
  sessionResult?: { resultado: string; valorAdjudicado?: string } | null;
  postSessionTimeline?: PostSessionTimeline | null;
  postSessionHabilitacaoDeadline?: string | null;
  adjudicatedAt?: string | null;
  adjudicationNumber?: string | null;
  homologatedAt?: string | null;
  homologationNumber?: string | null;
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function addWorkingDays(date: Date, days: number): Date {
  const result = new Date(date);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const day = result.getDay();
    if (day !== 0 && day !== 6) added++;
  }
  return result;
}

function fmtDate(d: Date): string {
  return format(d, "dd/MM/yyyy", { locale: ptBR });
}

function fmtDatetime(d: Date): string {
  return format(d, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
}

function isAlmostDue(date: Date): boolean {
  const diff = date.getTime() - Date.now();
  return diff > 0 && diff < 2 * 24 * 60 * 60 * 1000;
}

function isOverdue(date: Date): boolean {
  return date.getTime() < Date.now();
}

function toDateInputValue(iso: string | null | undefined): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

// ── Timeline step definitions ─────────────────────────────────────────────────

type StepId =
  | "sessao_encerrada"
  | "intencao_recurso"
  | "razoes_recurso"
  | "contrarrazoes"
  | "decisao_recurso"
  | "habilitacao"
  | "adjudicacao"
  | "homologacao";

interface StepDef {
  id: StepId;
  label: string;
  getDeadline?: (sessionDate: Date) => Date;
  conditionalOn?: "hasRecurso";
  userAction?: boolean;
}

const STEP_DEFS: StepDef[] = [
  { id: "sessao_encerrada", label: "Sessão de disputa encerrada" },
  { id: "intencao_recurso", label: "Prazo de intenção de recurso", getDeadline: (d) => addWorkingDays(d, 1), userAction: true },
  { id: "razoes_recurso", label: "Prazo de razões de recurso", getDeadline: (d) => addWorkingDays(d, 4), conditionalOn: "hasRecurso" },
  { id: "contrarrazoes", label: "Prazo de contrarrazões", getDeadline: (d) => addWorkingDays(d, 7), conditionalOn: "hasRecurso" },
  { id: "decisao_recurso", label: "Decisão do recurso", conditionalOn: "hasRecurso", userAction: true },
  { id: "habilitacao", label: "Habilitação", userAction: true },
  { id: "adjudicacao", label: "Adjudicação", userAction: true },
  { id: "homologacao", label: "Homologação", userAction: true },
];

const EMPTY_TIMELINE: PostSessionTimeline = {
  steps: Object.fromEntries(
    STEP_DEFS.map((s) => [s.id, { status: s.id === "sessao_encerrada" ? "done" : "pending" }])
  ),
  hasRecurso: false,
  userWantsRecurso: false,
};

// ── Step circle component ─────────────────────────────────────────────────────

function StepCircle({ status, isLast }: { status: StepState["status"]; isLast: boolean }) {
  const colors: Record<string, string> = {
    done: "#22C55E", pending: "#CBD5E1", error: "#EF4444", skipped: "#94A3B8",
  };
  const color = colors[status] ?? "#CBD5E1";
  return (
    <div className="flex flex-col items-center flex-shrink-0 w-8">
      <div className="w-8 h-8 rounded-full flex items-center justify-center shadow-sm border-2 border-white"
        style={{ background: color }}>
        {status === "done" && <Check className="w-4 h-4 text-white" strokeWidth={3} />}
        {status === "pending" && <div className="w-2.5 h-2.5 rounded-full bg-white opacity-70" />}
        {status === "error" && <X className="w-4 h-4 text-white" strokeWidth={3} />}
        {status === "skipped" && <div className="w-2.5 h-2.5 rounded-full bg-white opacity-40" />}
      </div>
      {!isLast && <div className="flex-1 w-0.5 mt-1 min-h-[32px]" style={{ background: '#E2E8F0' }} />}
    </div>
  );
}

// ── Minuta Display ────────────────────────────────────────────────────────────

function MinutaDisplay({ minuta, title }: { minuta: string; title: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(minuta);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([minuta], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${title.replace(/\s+/g, "_")}.txt`;
    a.click();
  };

  return (
    <div className="space-y-2 mt-3">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-slate-600">Minuta gerada</span>
        <button onClick={handleCopy} className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
          {copied ? <><Check className="w-3 h-3" /> Copiado!</> : <><Copy className="w-3 h-3" /> Copiar</>}
        </button>
        <button onClick={handleDownload} className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
          <Download className="w-3 h-3" /> Baixar .txt
        </button>
      </div>
      <textarea
        value={minuta}
        onChange={() => {}}
        rows={14}
        className="w-full px-3 py-3 rounded-xl border text-xs font-mono resize-y"
        style={{ borderColor: '#E2E8F0', background: '#F8FAFC', lineHeight: '1.7' }}
        readOnly={false}
      />
    </div>
  );
}

// ── Section B: Recursos ───────────────────────────────────────────────────────

function SectionRecursos({
  processId, process, timeline, token, onTimelineChange,
}: {
  processId: number;
  process: PostSessionProcess;
  timeline: PostSessionTimeline;
  token: string | null;
  onTimelineChange: (t: PostSessionTimeline) => void;
}) {
  const [loadingMinuta, setLoadingMinuta] = useState(false);
  const [minuta, setMinuta] = useState<string | null>(null);
  const [showAiForm, setShowAiForm] = useState(false);
  const [aiFormData, setAiFormData] = useState({ pontosContestacao: "" });

  const [loadingUserMinuta, setLoadingUserMinuta] = useState(false);
  const [userMinuta, setUserMinuta] = useState<string | null>(null);

  const isWinner = process.sessionResult?.resultado === "vencedor";
  const hasRecurso = timeline.hasRecurso ?? false;
  const userWantsRecurso = timeline.userWantsRecurso ?? false;
  const recursoData = timeline.recursoData ?? {};
  const userRecursoData = timeline.userRecursoData ?? {};

  const save = useCallback((patch: Partial<PostSessionTimeline>) => {
    const updated = { ...timeline, ...patch };
    onTimelineChange(updated);
    fetch(`${API}/api/processes/${processId}/post-session-timeline`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ timeline: updated }),
    }).catch(() => {});
  }, [timeline, processId, token, onTimelineChange]);

  const handleGenerateContrarrazoes = async () => {
    setLoadingMinuta(true);
    try {
      const res = await fetch(`${API}/api/processes/${processId}/generate-recurso`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "contrarrazoes",
          motivoRecurso: recursoData.motivo,
          pontosContestacao: aiFormData.pontosContestacao,
        }),
      });
      if (res.ok) { const d = await res.json(); setMinuta(d.minuta); setShowAiForm(false); }
    } finally { setLoadingMinuta(false); }
  };

  const handleGenerateRecurso = async () => {
    setLoadingUserMinuta(true);
    try {
      const res = await fetch(`${API}/api/processes/${processId}/generate-recurso`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "recurso",
          motivoRecurso: userRecursoData.motivo,
          lanceVencedor: process.sessionResult?.valorAdjudicado,
          lanceUsuario: userRecursoData.lanceUsuario,
        }),
      });
      if (res.ok) { const d = await res.json(); setUserMinuta(d.minuta); }
    } finally { setLoadingUserMinuta(false); }
  };

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #E8EFF6' }}>
      <div className="px-5 py-4 flex items-center gap-2" style={{ background: '#F8FAFC', borderBottom: '1px solid #E8EFF6' }}>
        <Scale className="w-4 h-4 text-blue-500" />
        <h4 className="font-semibold text-slate-800 text-sm">Gestão de recursos</h4>
      </div>
      <div className="p-5 space-y-6">

        {/* Has competitor recurso? */}
        <div className="rounded-xl p-4" style={{ background: '#F8FAFC', border: '1px solid #E8EFF6' }}>
          <p className="text-sm font-semibold text-slate-700 mb-3">Houve intenção de recurso de algum concorrente?</p>
          <div className="flex gap-3">
            <button onClick={() => save({ hasRecurso: true, steps: { ...timeline.steps, intencao_recurso: { status: "done" } } })}
              className={cn("px-4 py-2 rounded-lg text-sm font-semibold border transition-all",
                hasRecurso ? "bg-red-50 text-red-700 border-red-200" : "bg-white text-slate-600 border-slate-200 hover:border-red-200")}>
              Sim, houve recurso
            </button>
            <button onClick={() => save({ hasRecurso: false, steps: { ...timeline.steps, intencao_recurso: { status: "done" }, razoes_recurso: { status: "skipped" }, contrarrazoes: { status: "skipped" }, decisao_recurso: { status: "skipped" } } })}
              className={cn("px-4 py-2 rounded-lg text-sm font-semibold border transition-all",
                !hasRecurso && timeline.steps.intencao_recurso?.status === "done" ? "bg-green-50 text-green-700 border-green-200" : "bg-white text-slate-600 border-slate-200 hover:border-green-200")}>
              Não, sem recurso
            </button>
          </div>
        </div>

        {/* Recurso form */}
        {hasRecurso && (
          <div className="space-y-4">
            <h5 className="text-sm font-semibold text-slate-700">Dados do recurso</h5>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Recorrente (concorrente)</label>
                <input type="text" value={recursoData.recorrente ?? ""} onChange={e => save({ recursoData: { ...recursoData, recorrente: e.target.value } })}
                  className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: '#E2E8F0' }} placeholder="Nome do concorrente..." />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Status do recurso</label>
                <select value={recursoData.status ?? ""} onChange={e => save({ recursoData: { ...recursoData, status: e.target.value } })}
                  className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: '#E2E8F0', background: 'white' }}>
                  <option value="">Selecione...</option>
                  <option value="em_razoes">Em prazo de razões</option>
                  <option value="em_contrarrazoes">Em prazo de contrarrazões</option>
                  <option value="aguardando_decisao">Aguardando decisão</option>
                  <option value="decidido_mantido">Decidido — mantida a decisão</option>
                  <option value="decidido_provido">Decidido — recurso provido</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Motivo alegado pelo recorrente</label>
              <textarea value={recursoData.motivo ?? ""} onChange={e => save({ recursoData: { ...recursoData, motivo: e.target.value } })}
                rows={3} className="w-full px-3 py-2 rounded-lg border text-sm resize-none"
                style={{ borderColor: '#E2E8F0' }} placeholder="Descreva o argumento principal do recurso..." />
            </div>

            {/* AI contrarrazões */}
            <div className="rounded-xl p-4" style={{ background: '#EFF6FF', border: '1px solid #DBEAFE' }}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-blue-500" />
                  <span className="text-sm font-semibold text-blue-800">Gerar minuta de contrarrazões</span>
                </div>
                {!showAiForm && !minuta && (
                  <Button size="sm" onClick={() => setShowAiForm(true)} className="gap-1.5 text-xs" style={{ background: '#0066FF' }} >
                    <Sparkles className="w-3.5 h-3.5 text-white" />
                    <span className="text-white">Gerar com IA</span>
                  </Button>
                )}
              </div>
              {showAiForm && (
                <div className="space-y-3 mt-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-600 mb-1 block">Pontos que você quer contestar</label>
                    <textarea value={aiFormData.pontosContestacao} onChange={e => setAiFormData(p => ({ ...p, pontosContestacao: e.target.value }))}
                      rows={3} className="w-full px-3 py-2 rounded-lg border text-sm resize-none bg-white"
                      style={{ borderColor: '#BFDBFE' }} placeholder="Ex: a proposta vencedora estava dentro dos requisitos do edital, a habilitação foi regular..." />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleGenerateContrarrazoes} disabled={loadingMinuta} style={{ background: '#0066FF' }} className="gap-1.5">
                      {loadingMinuta ? <Loader2 className="w-3.5 h-3.5 animate-spin text-white" /> : <Sparkles className="w-3.5 h-3.5 text-white" />}
                      <span className="text-white">Gerar minuta</span>
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setShowAiForm(false)}>Cancelar</Button>
                  </div>
                </div>
              )}
              {minuta && <MinutaDisplay minuta={minuta} title="Contrarrazoes" />}
            </div>
          </div>
        )}

        {/* User wants to appeal (non-winner) */}
        {!isWinner && (
          <div className="border-t pt-5" style={{ borderColor: '#F1F5F9' }}>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={userWantsRecurso} onChange={e => save({ userWantsRecurso: e.target.checked })}
                className="w-4 h-4 rounded accent-blue-500" />
              <span className="text-sm font-semibold text-slate-700">Quero entrar com recurso</span>
            </label>
            {userWantsRecurso && (
              <div className="mt-4 space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Motivo do recurso</label>
                  <textarea value={userRecursoData.motivo ?? ""} onChange={e => save({ userRecursoData: { ...userRecursoData, motivo: e.target.value } })}
                    rows={3} className="w-full px-3 py-2 rounded-lg border text-sm resize-none"
                    style={{ borderColor: '#E2E8F0' }} placeholder="Descreva o motivo do recurso..." />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Lance vencedor (R$)</label>
                    <input type="number" value={userRecursoData.lanceVencedor ?? ""} onChange={e => save({ userRecursoData: { ...userRecursoData, lanceVencedor: e.target.value } })}
                      className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: '#E2E8F0' }} placeholder="0,00" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Lance que você ofertou (R$)</label>
                    <input type="number" value={userRecursoData.lanceUsuario ?? ""} onChange={e => save({ userRecursoData: { ...userRecursoData, lanceUsuario: e.target.value } })}
                      className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: '#E2E8F0' }} placeholder="0,00" />
                  </div>
                </div>
                <Button size="sm" onClick={handleGenerateRecurso} disabled={loadingUserMinuta} style={{ background: '#0066FF' }} className="gap-1.5">
                  {loadingUserMinuta ? <Loader2 className="w-3.5 h-3.5 animate-spin text-white" /> : <Sparkles className="w-3.5 h-3.5 text-white" />}
                  <span className="text-white">Gerar minuta de recurso com IA</span>
                </Button>
                {userMinuta && <MinutaDisplay minuta={userMinuta} title="Recurso_Administrativo" />}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Section C: Habilitação ────────────────────────────────────────────────────

const TIPO_LABELS: Record<string, string> = {
  cnpj: "CNPJ",
  certidao_federal: "Certidão Federal",
  certidao_estadual: "Certidão Estadual",
  certidao_municipal: "Certidão Municipal",
  certidao_trabalhista: "Certidão Trabalhista",
  certidao_fgts: "Certidão FGTS",
  estatuto_social: "Estatuto/Contrato Social",
  balanco_patrimonial: "Balanço Patrimonial",
  declaracao: "Declaração",
  outros: "Outros",
};

const PORTAL_LINKS: Record<string, string> = {
  certidao_federal: "https://solucoes.receita.fazenda.gov.br/Servicos/certidaointernet/PJ/Emitir",
  certidao_trabalhista: "https://www.tst.jus.br/certidao",
  certidao_fgts: "https://consulta-crf.caixa.gov.br/",
};

function SectionHabilitacao({ processId, process, token }: {
  processId: number; process: PostSessionProcess; token: string | null;
}) {
  const [docs, setDocs] = useState<HabilitacaoDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [deadline, setDeadline] = useState(toDateInputValue(process.postSessionHabilitacaoDeadline));
  const [savedDeadline, setSavedDeadline] = useState(false);

  useEffect(() => {
    fetch(`${API}/api/processes/${processId}/habilitacao-docs`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(r => r.ok ? r.json() : []).then(setDocs).catch(() => {}).finally(() => setLoading(false));
  }, [processId, token]);

  const saveDeadline = async () => {
    await fetch(`${API}/api/processes/${processId}/habilitacao-deadline`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ deadline: deadline ? new Date(deadline).toISOString() : null }),
    });
    setSavedDeadline(true);
    setTimeout(() => setSavedDeadline(false), 2000);
  };

  const deadlineDate = deadline ? new Date(deadline) : null;
  const deadlineWarning = deadlineDate && isAlmostDue(deadlineDate);
  const deadlineOverdue = deadlineDate && isOverdue(deadlineDate);

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #E8EFF6' }}>
      <div className="px-5 py-4 flex items-center gap-2" style={{ background: '#F8FAFC', borderBottom: '1px solid #E8EFF6' }}>
        <FolderCheck className="w-4 h-4 text-blue-500" />
        <h4 className="font-semibold text-slate-800 text-sm">Checklist de habilitação pós-sessão</h4>
        {docs.length > 0 && (
          <span className="ml-auto text-xs text-slate-500">
            {docs.filter(d => d.status === "available").length}/{docs.length} documentos disponíveis
          </span>
        )}
      </div>
      <div className="p-5 space-y-4">
        {/* Deadline input */}
        <div className={cn("rounded-xl p-4 flex flex-wrap items-center gap-3",
          deadlineOverdue ? "bg-red-50 border border-red-200" : deadlineWarning ? "bg-amber-50 border border-amber-200" : "bg-slate-50 border border-slate-200")}>
          <FileBadge className={cn("w-4 h-4 flex-shrink-0",
            deadlineOverdue ? "text-red-500" : deadlineWarning ? "text-amber-500" : "text-slate-400")} />
          <label className="text-sm font-semibold text-slate-700">Prazo para entrega dos documentos de habilitação</label>
          <div className="flex items-center gap-2 ml-auto">
            <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)}
              className="px-3 py-1.5 rounded-lg border text-sm" style={{ borderColor: '#E2E8F0', background: 'white' }} />
            <Button size="sm" onClick={saveDeadline} style={{ background: '#0066FF' }} className="text-white gap-1">
              {savedDeadline ? <Check className="w-3.5 h-3.5" /> : null} Salvar
            </Button>
          </div>
          {(deadlineWarning || deadlineOverdue) && (
            <div className={cn("w-full flex items-center gap-1.5 text-xs font-medium",
              deadlineOverdue ? "text-red-600" : "text-amber-600")}>
              <AlertTriangle className="w-3.5 h-3.5" />
              {deadlineOverdue ? "Prazo vencido!" : "Prazo vencendo em menos de 2 dias!"}
            </div>
          )}
        </div>

        {/* Docs table */}
        {loading ? (
          <div className="py-8 flex items-center justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
          </div>
        ) : docs.length === 0 ? (
          <div className="rounded-xl p-6 text-center" style={{ background: '#F8FAFC', border: '1px dashed #E2E8F0' }}>
            <FolderCheck className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500">Nenhuma exigência de habilitação extraída do edital.</p>
            <p className="text-xs text-slate-400 mt-1">Processe o edital na aba Análise IA para extrair os requisitos.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid #E8EFF6' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E8EFF6' }}>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 w-1/3">Documento exigido</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Documento no sistema</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Validade</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ divideColor: '#F1F5F9' }}>
                {docs.map((doc) => (
                  <tr key={doc.id} className="border-b last:border-0" style={{ borderColor: '#F1F5F9' }}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800 text-xs leading-snug">{doc.title}</p>
                      {doc.mandatory && <span className="text-xs text-red-500">Obrigatório</span>}
                    </td>
                    <td className="px-4 py-3">
                      {doc.status === "available" && (
                        <span className="flex items-center gap-1 text-xs text-green-700 font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Disponível
                        </span>
                      )}
                      {doc.status === "expired" && (
                        <span className="flex items-center gap-1 text-xs text-amber-700 font-semibold">
                          <AlertTriangle className="w-3.5 h-3.5" /> Vencido
                        </span>
                      )}
                      {doc.status === "absent" && (
                        <span className="flex items-center gap-1 text-xs text-red-700 font-semibold">
                          <X className="w-3.5 h-3.5" /> Ausente
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {doc.matchedDocument ? (
                        <span>{TIPO_LABELS[doc.matchedDocument.tipo] ?? doc.matchedDocument.titulo}</span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {doc.matchedDocument?.dataValidade ?? <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {doc.status === "available" && doc.matchedDocument && (
                        <span className="text-xs text-green-600 font-medium">✓ Ok</span>
                      )}
                      {doc.status === "expired" && PORTAL_LINKS[doc.matchedDocument?.tipo ?? ""] && (
                        <a href={PORTAL_LINKS[doc.matchedDocument!.tipo]} target="_blank" rel="noopener"
                          className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
                          <ExternalLink className="w-3 h-3" /> Emitir novamente
                        </a>
                      )}
                      {doc.status === "absent" && (
                        <span className="text-xs text-red-600 font-medium">Providenciar</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Section D: Adjudicação + Homologação ─────────────────────────────────────

function SectionRecords({ processId, process, token }: {
  processId: number; process: PostSessionProcess; token: string | null;
}) {
  const [adjDate, setAdjDate] = useState(toDateInputValue(process.adjudicatedAt));
  const [adjNumber, setAdjNumber] = useState(process.adjudicationNumber ?? "");
  const [adjSaving, setAdjSaving] = useState(false);
  const [adjSaved, setAdjSaved] = useState(false);
  const [adjudicatedAt, setAdjudicatedAt] = useState(process.adjudicatedAt);

  const [homDate, setHomDate] = useState(toDateInputValue(process.homologatedAt));
  const [homNumber, setHomNumber] = useState(process.homologationNumber ?? "");
  const [homSaving, setHomSaving] = useState(false);
  const [homSaved, setHomSaved] = useState(false);
  const [homologatedAt, setHomologatedAt] = useState(process.homologatedAt);

  const [, navigate] = useLocation();

  const saveAdjudication = async () => {
    setAdjSaving(true);
    await fetch(`${API}/api/processes/${processId}/adjudication`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ adjudicatedAt: adjDate ? new Date(adjDate).toISOString() : null, adjudicationNumber: adjNumber }),
    });
    setAdjudicatedAt(adjDate ? new Date(adjDate).toISOString() : null);
    setAdjSaving(false);
    setAdjSaved(true);
    setTimeout(() => setAdjSaved(false), 2500);
  };

  const saveHomologation = async () => {
    setHomSaving(true);
    await fetch(`${API}/api/processes/${processId}/homologation`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ homologatedAt: homDate ? new Date(homDate).toISOString() : null, homologationNumber: homNumber }),
    });
    setHomologatedAt(homDate ? new Date(homDate).toISOString() : null);
    setHomSaving(false);
    setHomSaved(true);
    setTimeout(() => setHomSaved(false), 2500);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Adjudicação */}
        <div className="rounded-2xl overflow-hidden" style={{ border: adjudicatedAt ? '2px solid #86EFAC' : '1px solid #E8EFF6' }}>
          <div className="px-5 py-4 flex items-center justify-between" style={{ background: adjudicatedAt ? '#F0FDF4' : '#F8FAFC', borderBottom: '1px solid #E8EFF6' }}>
            <div className="flex items-center gap-2">
              <CheckCircle2 className={cn("w-4 h-4", adjudicatedAt ? "text-green-500" : "text-slate-400")} />
              <h4 className="font-semibold text-slate-800 text-sm">Adjudicação</h4>
            </div>
            <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full",
              adjudicatedAt ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500")}>
              {adjudicatedAt ? "Adjudicado" : "Pendente"}
            </span>
          </div>
          <div className="p-5 space-y-3">
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Data de adjudicação</label>
              <input type="date" value={adjDate} onChange={e => setAdjDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: '#E2E8F0' }} />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Número do ato</label>
              <input type="text" value={adjNumber} onChange={e => setAdjNumber(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: '#E2E8F0' }} placeholder="Ex: 001/2025..." />
            </div>
            <Button onClick={saveAdjudication} disabled={adjSaving || !adjDate} size="sm" style={{ background: '#0066FF' }} className="text-white gap-1.5 w-full">
              {adjSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : adjSaved ? <Check className="w-3.5 h-3.5" /> : null}
              {adjSaved ? "Salvo!" : "Registrar adjudicação"}
            </Button>
          </div>
        </div>

        {/* Homologação */}
        <div className="rounded-2xl overflow-hidden" style={{ border: homologatedAt ? '2px solid #86EFAC' : '1px solid #E8EFF6' }}>
          <div className="px-5 py-4 flex items-center justify-between" style={{ background: homologatedAt ? '#F0FDF4' : '#F8FAFC', borderBottom: '1px solid #E8EFF6' }}>
            <div className="flex items-center gap-2">
              <CheckCircle2 className={cn("w-4 h-4", homologatedAt ? "text-green-500" : "text-slate-400")} />
              <h4 className="font-semibold text-slate-800 text-sm">Homologação</h4>
            </div>
            <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full",
              homologatedAt ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500")}>
              {homologatedAt ? "Homologado" : "Pendente"}
            </span>
          </div>
          <div className="p-5 space-y-3">
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Data de homologação</label>
              <input type="date" value={homDate} onChange={e => setHomDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: '#E2E8F0' }} />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Número do ato</label>
              <input type="text" value={homNumber} onChange={e => setHomNumber(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: '#E2E8F0' }} placeholder="Ex: 001/2025..." />
            </div>
            <Button onClick={saveHomologation} disabled={homSaving || !homDate} size="sm" style={{ background: '#0066FF' }} className="text-white gap-1.5 w-full">
              {homSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : homSaved ? <Check className="w-3.5 h-3.5" /> : null}
              {homSaved ? "Salvo!" : "Registrar homologação"}
            </Button>
          </div>
        </div>
      </div>

      {/* Homologado banner */}
      {homologatedAt && (
        <div className="rounded-2xl p-5" style={{ background: '#F0FDF4', border: '2px solid #86EFAC' }}>
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl">🎉</span>
            <div>
              <h3 className="font-bold text-green-900">Licitação homologada!</h3>
              <p className="text-sm text-green-700">Próximo passo: assinatura do contrato.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function PostSessionTab({ processId, process }: {
  processId: number;
  process: PostSessionProcess;
}) {
  const token = getToken();
  const sessionResult = process.sessionResult;

  const [timeline, setTimeline] = useState<PostSessionTimeline>(
    (process.postSessionTimeline as PostSessionTimeline | null) ?? EMPTY_TIMELINE
  );

  const sessionDate = process.sessionDate ? new Date(process.sessionDate) : null;
  const isWinner = sessionResult?.resultado === "vencedor" || sessionResult?.resultado === "aguardando";

  // Compute deadlines
  const deadlines: Partial<Record<StepId, Date>> = {};
  if (sessionDate) {
    STEP_DEFS.forEach((s) => {
      if (s.getDeadline) deadlines[s.id] = s.getDeadline(sessionDate);
    });
  }

  const saveTimeline = useCallback((updated: PostSessionTimeline) => {
    setTimeline(updated);
    fetch(`${API}/api/processes/${processId}/post-session-timeline`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ timeline: updated }),
    }).catch(() => {});
  }, [processId, token]);

  const markStep = (stepId: StepId, status: StepState["status"]) => {
    saveTimeline({
      ...timeline,
      steps: {
        ...timeline.steps,
        [stepId]: { status, completedAt: status === "done" ? new Date().toISOString() : undefined },
      },
    });
  };

  // Locked state
  if (!sessionResult?.resultado) {
    return (
      <div className="rounded-2xl p-10 text-center" style={{ background: '#F8FAFC', border: '2px dashed #E2E8F0' }}>
        <Lock className="w-8 h-8 text-slate-300 mx-auto mb-3" />
        <p className="font-semibold text-slate-700 mb-1">Aba ainda não disponível</p>
        <p className="text-sm text-slate-500">Esta aba ficará disponível após o registro do resultado da sessão.</p>
        <p className="text-xs text-slate-400 mt-1">Acesse a aba <strong>Sessão</strong> e registre o resultado da disputa.</p>
      </div>
    );
  }

  // Visible steps (filter conditional ones)
  const visibleSteps = STEP_DEFS.filter((s) => {
    if (s.conditionalOn === "hasRecurso") return timeline.hasRecurso;
    return true;
  });

  // Habilitação deadline warning
  const habDeadline = process.postSessionHabilitacaoDeadline
    ? new Date(process.postSessionHabilitacaoDeadline)
    : null;
  const habWarning = habDeadline && (isAlmostDue(habDeadline) || isOverdue(habDeadline));

  return (
    <div className="space-y-6">
      {/* Habilitação urgent banner */}
      {habWarning && (
        <div className="rounded-xl px-4 py-3 flex items-center gap-3" style={{ background: '#FFFBEB', border: '1px solid #FDE68A' }}>
          <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
          <p className="text-sm font-semibold text-amber-800">
            Atenção: prazo de habilitação {isOverdue(habDeadline!) ? "vencido" : "vencendo em breve"} — {fmtDate(habDeadline!)}
          </p>
        </div>
      )}

      {/* ── Section A: Timeline ─────────────────────────────────────────── */}
      <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #E8EFF6' }}>
        <div className="px-5 py-4 flex items-center gap-2" style={{ background: '#F8FAFC', borderBottom: '1px solid #E8EFF6' }}>
          <GitCommitHorizontal className="w-4 h-4 text-blue-500" />
          <h4 className="font-semibold text-slate-800 text-sm">Linha do tempo pós-sessão</h4>
          <div className="ml-auto flex items-center gap-1 text-xs text-slate-400">
            <Info className="w-3 h-3" /> Prazos em dias úteis (seg–sex), sem feriados locais
          </div>
        </div>
        <div className="p-5">
          <div className="space-y-0">
            {visibleSteps.map((stepDef, idx) => {
              const step = timeline.steps[stepDef.id] ?? { status: "pending" as const };
              const deadline = deadlines[stepDef.id];
              const almostDue = deadline && step.status === "pending" && isAlmostDue(deadline);
              const overdue = deadline && step.status === "pending" && isOverdue(deadline);
              const isLast = idx === visibleSteps.length - 1;

              return (
                <div key={stepDef.id} className="flex gap-4">
                  <StepCircle status={step.status} isLast={isLast} />
                  <div className={cn("flex-1 pb-6", isLast && "pb-0")}>
                    <div className={cn("rounded-xl p-4 transition-all",
                      overdue ? "border-red-300 bg-red-50" : almostDue ? "border-amber-300 bg-amber-50" : "border-slate-100 bg-slate-50",
                      step.status === "done" ? "opacity-70" : ""
                    )} style={{ border: '1px solid' }}>
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="flex-1 min-w-0">
                          <p className={cn("text-sm font-semibold", step.status === "done" ? "text-slate-500" : "text-slate-800")}>
                            {stepDef.label}
                          </p>
                          {deadline && (
                            <p className={cn("text-xs mt-0.5", overdue ? "text-red-600 font-semibold" : almostDue ? "text-amber-600 font-semibold" : "text-slate-500")}>
                              {overdue && <AlertTriangle className="w-3 h-3 inline mr-1" />}
                              Prazo: {fmtDate(deadline)}
                              {almostDue && !overdue && " ⚠️"}
                              {overdue && " — Vencido"}
                            </p>
                          )}
                          {step.completedAt && (
                            <p className="text-xs text-green-600 mt-0.5">Concluído em {fmtDatetime(new Date(step.completedAt))}</p>
                          )}
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          {/* Status badge */}
                          <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full",
                            step.status === "done" ? "bg-green-100 text-green-700" :
                            step.status === "skipped" ? "bg-slate-100 text-slate-500" :
                            step.status === "error" ? "bg-red-100 text-red-700" :
                            overdue ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-500")}>
                            {step.status === "done" ? "Concluído" :
                             step.status === "skipped" ? "N/A" :
                             step.status === "error" ? "Com problema" :
                             overdue ? "Vencido" : "Pendente"}
                          </span>

                          {/* Action buttons */}
                          {stepDef.userAction && step.status !== "done" && step.status !== "skipped" && stepDef.id !== "intencao_recurso" && (
                            <Button size="sm" variant="outline" onClick={() => markStep(stepDef.id, "done")}
                              className="text-xs h-7 px-2 gap-1">
                              <Check className="w-3 h-3" /> Marcar concluído
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Step-specific: intencao_recurso handled in Section B */}
                      {stepDef.id === "intencao_recurso" && step.status === "pending" && (
                        <p className="text-xs text-slate-500 mt-2">
                          Informe abaixo se houve recurso de concorrentes.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Section B: Recursos ─────────────────────────────────────────── */}
      <SectionRecursos
        processId={processId}
        process={process}
        timeline={timeline}
        token={token}
        onTimelineChange={saveTimeline}
      />

      {/* ── Section C: Habilitação (only for winners) ────────────────────── */}
      {isWinner && (
        <SectionHabilitacao processId={processId} process={process} token={token} />
      )}

      {/* ── Section D: Adjudicação + Homologação ─────────────────────────── */}
      <SectionRecords processId={processId} process={process} token={token} />
    </div>
  );
}

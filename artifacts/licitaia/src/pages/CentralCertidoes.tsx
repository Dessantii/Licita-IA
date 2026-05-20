import { useState, useCallback, useEffect } from "react";
import { getToken } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  Building2, Briefcase, Scale, MapPin, Map,
  RefreshCw, History, CheckCircle2, AlertCircle, FileText,
  Loader2, Upload, ExternalLink, ChevronDown, ChevronUp, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const API = import.meta.env.VITE_API_URL ?? "";

// ── Types ─────────────────────────────────────────────────────────────────────

export type CertidaoStatus = "valida" | "vencendo" | "vencida" | "nao_cadastrada";

export interface CertidaoData {
  tipo: string;
  label: string;
  emissor: string;
  portalUrl: string;
  status: CertidaoStatus;
  dataEmissao: string | null;
  dataValidade: string | null;
  resultado: string | null;
  codigoVerificacao: string | null;
  fileUrl: string | null;
  documentId?: number;
  metadata?: Record<string, any> | null;
}

export type CertidoesMap = Record<string, CertidaoData>;

interface HistoryEntry {
  id: number;
  certidaoType: string;
  resultado: string;
  issuedAt: string;
  expiresAt: string | null;
  fileUrl: string | null;
  emissionMethod: string;
}

// ── Config ───────────────────────────────────────────────────────────────────

const CERTIDAO_ICONS: Record<string, React.ElementType> = {
  cnd_federal: Building2,
  crf_fgts: Briefcase,
  cndt: Scale,
  certidao_estadual: MapPin,
  certidao_municipal: Map,
};

const STATUS_CONFIG: Record<CertidaoStatus, { label: string; color: string; bg: string; border: string; barColor: string }> = {
  valida: { label: "Válida", color: "#059669", bg: "#f0fdf4", border: "#bbf7d0", barColor: "#10b981" },
  vencendo: { label: "Vencendo", color: "#d97706", bg: "#fffbeb", border: "#fde68a", barColor: "#f59e0b" },
  vencida: { label: "Vencida", color: "#dc2626", bg: "#fef2f2", border: "#fecaca", barColor: "#ef4444" },
  nao_cadastrada: { label: "Não cadastrada", color: "#64748b", bg: "#f8fafc", border: "#e2e8f0", barColor: "#cbd5e1" },
};

const RESULTADO_LABELS: Record<string, { label: string; color: string }> = {
  negativa: { label: "Negativa (regular)", color: "#059669" },
  positiva: { label: "Positiva (irregular)", color: "#dc2626" },
  positiva_efeito_negativa: { label: "Positiva c/ efeito negativa", color: "#d97706" },
  nao_identificado: { label: "Não identificado", color: "#64748b" },
};

const METHOD_LABELS: Record<string, string> = {
  automatic: "Emissão automática",
  manual_upload: "Upload manual",
  manual: "Manual",
  code: "Por código",
};

function daysLeft(dataValidade: string | null): number | null {
  if (!dataValidade) return null;
  const d = new Date(dataValidade + "T12:00:00");
  const now = new Date();
  return Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try { return format(new Date(iso + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR }); } catch { return iso; }
}

// ── ValidityBar ───────────────────────────────────────────────────────────────

function ValidityBar({ status, dataValidade }: { status: CertidaoStatus; dataValidade: string | null }) {
  const days = daysLeft(dataValidade);
  const cfg = STATUS_CONFIG[status];
  if (status === "nao_cadastrada" || days === null) return null;

  const maxDays = 180;
  const pct = Math.max(0, Math.min(100, (days / maxDays) * 100));

  return (
    <div className="mt-3">
      <div className="flex justify-between text-xs mb-1" style={{ color: cfg.color }}>
        <span>{days <= 0 ? "Vencida" : `${days} dias restantes`}</span>
        <span>{fmtDate(dataValidade)}</span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: cfg.barColor }}
        />
      </div>
    </div>
  );
}

// ── HistoryPanel ──────────────────────────────────────────────────────────────

function HistoryPanel({ companyId, tipo, token }: { companyId: number; tipo: string; token: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  async function load() {
    if (history.length > 0) { setOpen(o => !o); return; }
    setOpen(true);
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/companies/${companyId}/certidoes/${tipo}/history`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setHistory(await res.json());
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-3 border-t border-slate-100 pt-3">
      <button
        onClick={load}
        className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors"
      >
        <History className="w-3.5 h-3.5" />
        Histórico de emissões
        {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>

      {open && (
        <div className="mt-2">
          {loading ? (
            <div className="text-xs text-slate-400 py-2">Carregando...</div>
          ) : history.length === 0 ? (
            <div className="text-xs text-slate-400 py-2">Nenhum histórico encontrado.</div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-400 border-b border-slate-100">
                  <th className="text-left pb-1 font-medium">Emissão</th>
                  <th className="text-left pb-1 font-medium">Validade</th>
                  <th className="text-left pb-1 font-medium">Resultado</th>
                  <th className="text-left pb-1 font-medium">Método</th>
                  <th className="text-left pb-1 font-medium">PDF</th>
                </tr>
              </thead>
              <tbody>
                {history.map(h => {
                  const res = RESULTADO_LABELS[h.resultado];
                  return (
                    <tr key={h.id} className="border-b border-slate-50 last:border-0">
                      <td className="py-1.5 pr-2">{fmtDate(h.issuedAt.split("T")[0]!)}</td>
                      <td className="py-1.5 pr-2">{h.expiresAt ? fmtDate(h.expiresAt.split("T")[0]!) : "—"}</td>
                      <td className="py-1.5 pr-2" style={{ color: res?.color ?? "#64748b" }}>{res?.label ?? h.resultado}</td>
                      <td className="py-1.5 pr-2 text-slate-500">{METHOD_LABELS[h.emissionMethod] ?? h.emissionMethod}</td>
                      <td className="py-1.5">
                        {h.fileUrl ? (
                          <a href={`${API}${h.fileUrl}`} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline flex items-center gap-0.5">
                            <FileText className="w-3 h-3" /> Ver
                          </a>
                        ) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

// ── EmitirModal ───────────────────────────────────────────────────────────────

type ModalStep = "confirm" | "processing" | "success" | "failure";

function EmitirModal({
  certidao,
  company,
  token,
  onClose,
  onSuccess,
}: {
  certidao: CertidaoData;
  company: { id: number; cnpj: string; razaoSocial: string };
  token: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [step, setStep] = useState<ModalStep>("confirm");
  const [failureData, setFailureData] = useState<{ portalUrl: string; instructions: string; message: string } | null>(null);
  const [successData, setSuccessData] = useState<{ dataValidade: string | null; resultado: string | null } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  async function handleEmitir() {
    setStep("processing");
    try {
      const res = await fetch(`${API}/api/companies/${company.id}/certidoes/${certidao.tipo}/emitir`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      const data = await res.json();

      if (data.success) {
        setSuccessData({ dataValidade: data.dataValidade, resultado: data.resultado });
        setStep("success");
        onSuccess();
      } else {
        setFailureData({ portalUrl: data.portalUrl, instructions: data.instructions, message: data.message });
        setStep("failure");
      }
    } catch {
      setFailureData({
        portalUrl: certidao.portalUrl,
        instructions: "Emita a certidão manualmente no portal e faça o upload do PDF.",
        message: "Erro de conexão. Emita manualmente e faça o upload.",
      });
      setStep("failure");
    }
  }

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`${API}/api/companies/${company.id}/certidoes/${certidao.tipo}/extract`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (res.ok) {
        setUploadSuccess(true);
        onSuccess();
      }
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="font-bold text-slate-900 text-base">Emitir {certidao.label}</h2>
          {step !== "processing" && (
            <button onClick={onClose} className="text-slate-400 hover:text-slate-700 transition-colors">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Stepper */}
        <div className="flex items-center gap-2 px-6 py-3 bg-slate-50 border-b border-slate-100">
          {["confirm", "processing", "result"].map((s, i) => {
            const active = (s === "confirm" && step === "confirm") ||
              (s === "processing" && step === "processing") ||
              (s === "result" && (step === "success" || step === "failure"));
            const done = (s === "confirm" && step !== "confirm") ||
              (s === "processing" && (step === "success" || step === "failure"));
            return (
              <div key={s} className="flex items-center gap-2">
                {i > 0 && <div className="w-8 h-px bg-slate-200" />}
                <div className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                  done ? "bg-green-500 text-white" : active ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-500"
                )}>
                  {done ? "✓" : i + 1}
                </div>
                <span className={cn("text-xs font-medium", active ? "text-slate-800" : "text-slate-400")}>
                  {s === "confirm" ? "Confirmar" : s === "processing" ? "Processando" : "Resultado"}
                </span>
              </div>
            );
          })}
        </div>

        {/* Content */}
        <div className="px-6 py-6">
          {step === "confirm" && (
            <div className="space-y-4">
              <div className="bg-slate-50 rounded-xl p-4 space-y-2">
                <div>
                  <p className="text-xs text-slate-500">CNPJ</p>
                  <p className="font-mono font-semibold text-slate-900 text-sm">{company.cnpj}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Razão Social</p>
                  <p className="font-semibold text-slate-900 text-sm">{company.razaoSocial}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Emissor</p>
                  <p className="text-sm text-slate-700">{certidao.emissor}</p>
                </div>
              </div>
              <Button className="w-full" onClick={handleEmitir}>
                Confirmar e emitir
              </Button>
            </div>
          )}

          {step === "processing" && (
            <div className="flex flex-col items-center py-6 text-center gap-4">
              <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              </div>
              <div>
                <p className="font-semibold text-slate-900 mb-1">Acessando o portal da {certidao.emissor}...</p>
                <p className="text-sm text-slate-500">Isso pode levar até 30 segundos</p>
              </div>
            </div>
          )}

          {step === "success" && successData && (
            <div className="flex flex-col items-center py-4 text-center gap-4">
              <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center">
                <CheckCircle2 className="w-9 h-9 text-green-500" />
              </div>
              <div>
                <p className="font-bold text-slate-900 text-lg mb-1">Certidão emitida!</p>
                {successData.resultado && (
                  <p className="text-sm" style={{ color: RESULTADO_LABELS[successData.resultado]?.color ?? "#64748b" }}>
                    {RESULTADO_LABELS[successData.resultado]?.label ?? successData.resultado}
                  </p>
                )}
                {successData.dataValidade && (
                  <p className="text-xs text-slate-500 mt-1">Válida até {fmtDate(successData.dataValidade)}</p>
                )}
              </div>
              <Button className="w-full" onClick={onClose}>Fechar</Button>
            </div>
          )}

          {step === "failure" && failureData && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-100">
                <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-amber-800 mb-0.5">Emissão automática indisponível</p>
                  <p className="text-xs text-amber-700">{failureData.message}</p>
                </div>
              </div>

              <a
                href={failureData.portalUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <ExternalLink className="w-4 h-4" /> Emitir manualmente no portal
              </a>

              {uploadSuccess ? (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-green-50 border border-green-100 text-sm text-green-800">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  PDF recebido! Dados extraídos automaticamente.
                </div>
              ) : (
                <label className={cn(
                  "flex flex-col items-center gap-2 w-full py-5 rounded-xl border-2 border-dashed cursor-pointer transition-colors",
                  uploading ? "border-blue-200 bg-blue-50" : "border-slate-200 hover:border-blue-300 hover:bg-blue-50/40"
                )}>
                  {uploading ? (
                    <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                  ) : (
                    <Upload className="w-6 h-6 text-slate-400" />
                  )}
                  <p className="text-sm font-medium text-slate-700">
                    {uploading ? "Enviando e extraindo dados..." : "Após baixar, faça o upload aqui"}
                  </p>
                  <p className="text-xs text-slate-400">Apenas PDF — a IA extrai os dados automaticamente</p>
                  <input
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    disabled={uploading}
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); }}
                  />
                </label>
              )}

              <button
                onClick={onClose}
                className="w-full text-sm text-slate-500 hover:text-slate-800 transition-colors py-1"
              >
                Fechar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── RenovarLoteModal ──────────────────────────────────────────────────────────

function RenovarLoteModal({
  certidoes,
  companyId,
  token,
  onClose,
  onComplete,
}: {
  certidoes: CertidoesMap;
  companyId: number;
  token: string;
  onClose: () => void;
  onComplete: () => void;
}) {
  const urgentTipos = Object.values(certidoes)
    .filter(c => c.status === "vencida" || c.status === "vencendo")
    .map(c => c.tipo);

  const [selected, setSelected] = useState<Set<string>>(new Set(urgentTipos));
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<Record<string, "pending" | "ok" | "manual">>({});
  const [current, setCurrent] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function toggle(tipo: string) {
    setSelected(s => {
      const n = new Set(s);
      n.has(tipo) ? n.delete(tipo) : n.add(tipo);
      return n;
    });
  }

  async function start() {
    const tipos = Array.from(selected);
    if (tipos.length === 0) return;
    setRunning(true);
    const prog: Record<string, "pending" | "ok" | "manual"> = {};
    for (const t of tipos) prog[t] = "pending";
    setProgress(prog);

    for (const tipo of tipos) {
      setCurrent(tipo);
      try {
        const res = await fetch(`${API}/api/companies/${companyId}/certidoes/${tipo}/emitir`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        });
        const data = await res.json();
        setProgress(p => ({ ...p, [tipo]: data.success ? "ok" : "manual" }));
      } catch {
        setProgress(p => ({ ...p, [tipo]: "manual" }));
      }
    }
    setCurrent(null);
    setRunning(false);
    setDone(true);
    onComplete();
  }

  const total = selected.size;
  const completed = Object.values(progress).filter(v => v !== "pending").length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="font-bold text-slate-900 text-base">Renovar certidões em lote</h2>
          {!running && (
            <button onClick={onClose} className="text-slate-400 hover:text-slate-700 transition-colors">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="px-6 py-5 space-y-4">
          {!running && !done && (
            <>
              <p className="text-sm text-slate-600">Selecione as certidões que deseja renovar:</p>
              <div className="space-y-2">
                {Object.values(certidoes).map(c => {
                  const cfg = STATUS_CONFIG[c.status];
                  const isSelected = selected.has(c.tipo);
                  return (
                    <label
                      key={c.tipo}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all",
                        isSelected ? "border-blue-300 bg-blue-50" : "border-slate-200 hover:border-slate-300"
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggle(c.tipo)}
                        className="w-4 h-4 accent-blue-600"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">{c.label}</p>
                        <p className="text-xs" style={{ color: cfg.color }}>{cfg.label}</p>
                      </div>
                    </label>
                  );
                })}
              </div>

              <Button
                className="w-full"
                disabled={selected.size === 0}
                onClick={start}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Iniciar renovação ({selected.size} certidão{selected.size !== 1 ? "ões" : ""})
              </Button>
            </>
          )}

          {running && (
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-600">Renovando {completed} de {total} certidões...</span>
                  <span className="font-semibold text-slate-800">{Math.round((completed / total) * 100)}%</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all duration-500"
                    style={{ width: `${(completed / total) * 100}%` }}
                  />
                </div>
              </div>

              <div className="space-y-2">
                {Array.from(selected).map(tipo => {
                  const c = certidoes[tipo]!;
                  const st = progress[tipo];
                  return (
                    <div key={tipo} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100">
                      {st === "ok" ? <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                        : st === "manual" ? <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                        : current === tipo ? <Loader2 className="w-4 h-4 animate-spin text-blue-500 shrink-0" />
                        : <div className="w-4 h-4 rounded-full border-2 border-slate-200 shrink-0" />}
                      <span className="text-sm text-slate-700">{c.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {done && (
            <div className="space-y-4">
              <div className="text-center py-2">
                <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto mb-2" />
                <p className="font-bold text-slate-900">Renovação concluída</p>
              </div>

              <div className="space-y-2">
                {Array.from(selected).map(tipo => {
                  const c = certidoes[tipo]!;
                  const st = progress[tipo];
                  return (
                    <div key={tipo} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100">
                      {st === "ok"
                        ? <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                        : <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800">{c.label}</p>
                        <p className="text-xs text-slate-500">
                          {st === "ok" ? "Renovada com sucesso" : "Emissão manual necessária"}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <Button className="w-full" onClick={onClose}>Fechar</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── CertidaoCard ──────────────────────────────────────────────────────────────

function CertidaoCard({
  data,
  companyId,
  company,
  token,
  onRefresh,
}: {
  data: CertidaoData;
  companyId: number;
  company: { id: number; cnpj: string; razaoSocial: string };
  token: string;
  onRefresh: () => void;
}) {
  const [emitirOpen, setEmitirOpen] = useState(false);
  const cfg = STATUS_CONFIG[data.status];
  const Icon = CERTIDAO_ICONS[data.tipo] ?? FileText;
  const res = data.resultado ? RESULTADO_LABELS[data.resultado] : null;
  const isPositiva = data.resultado === "positiva";

  return (
    <>
      <div
        className="bg-white rounded-xl border overflow-hidden flex flex-col"
        style={{
          borderColor: cfg.border,
          boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
          borderLeftWidth: "3px",
          borderLeftColor: cfg.barColor,
        }}
      >
        {/* Card header */}
        <div className="px-4 pt-4 pb-3 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: cfg.bg }}
            >
              <Icon className="w-4.5 h-4.5" style={{ color: cfg.color, width: 18, height: 18 }} />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-slate-900 text-sm leading-tight truncate">{data.label}</p>
              <p className="text-xs text-slate-400 mt-0.5 truncate">{data.emissor}</p>
            </div>
          </div>
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 whitespace-nowrap"
            style={{ color: cfg.color, background: cfg.bg }}
          >
            {cfg.label}
          </span>
        </div>

        {/* Card body */}
        <div className="px-4 pb-3 flex-1">
          {data.status !== "nao_cadastrada" ? (
            <div className="space-y-1.5">
              <div className="grid grid-cols-2 gap-x-4 text-xs">
                <div>
                  <span className="text-slate-400">Emissão</span>
                  <p className="font-medium text-slate-700">{fmtDate(data.dataEmissao)}</p>
                </div>
                <div>
                  <span className="text-slate-400">Validade</span>
                  <p className="font-medium text-slate-700">{fmtDate(data.dataValidade)}</p>
                </div>
              </div>

              {res && (
                <p className="text-xs font-semibold" style={{ color: res.color }}>{res.label}</p>
              )}

              {data.codigoVerificacao && (
                <p className="text-xs text-slate-500 font-mono truncate">Cód: {data.codigoVerificacao}</p>
              )}

              {isPositiva && (
                <div className="mt-2 p-2 rounded-lg bg-red-50 border border-red-100 flex items-start gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-700 font-medium">Empresa com pendências — certidão positiva</p>
                </div>
              )}

              <ValidityBar status={data.status} dataValidade={data.dataValidade} />
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic">Nenhuma certidão cadastrada para este tipo.</p>
          )}
        </div>

        {/* Card footer */}
        <div className="px-4 pb-4 flex flex-wrap gap-2">
          {isPositiva ? (
            <a
              href={data.portalUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 border border-slate-200 rounded-lg px-3 py-1.5 hover:bg-slate-50 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Ver no portal
            </a>
          ) : (
            <>
              <Button
                size="sm"
                variant={data.status === "nao_cadastrada" || data.status === "vencida" ? "default" : "outline"}
                className="text-xs h-7 px-3"
                onClick={() => setEmitirOpen(true)}
              >
                {data.status === "nao_cadastrada" || data.status === "vencida" ? "Emitir certidão" : (
                  <><RefreshCw className="w-3.5 h-3.5 mr-1" />Renovar</>
                )}
              </Button>

              {data.fileUrl && (
                <a
                  href={`${API}${data.fileUrl}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 border border-slate-200 rounded-lg px-3 py-1.5 hover:bg-slate-50 transition-colors"
                >
                  <FileText className="w-3.5 h-3.5" /> Ver PDF
                </a>
              )}

              {data.status === "nao_cadastrada" && (
                <a
                  href={data.portalUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-medium text-slate-500 hover:text-slate-800 underline underline-offset-2 flex items-center gap-1"
                >
                  <ExternalLink className="w-3 h-3" /> Emitir manualmente
                </a>
              )}
            </>
          )}
        </div>

        {/* History */}
        <div className="px-4 pb-4">
          <HistoryPanel companyId={companyId} tipo={data.tipo} token={token} />
        </div>
      </div>

      {emitirOpen && (
        <EmitirModal
          certidao={data}
          company={company}
          token={token}
          onClose={() => setEmitirOpen(false)}
          onSuccess={() => { setEmitirOpen(false); onRefresh(); }}
        />
      )}
    </>
  );
}

// ── CentralCertidoes (main section) ──────────────────────────────────────────

const TIPO_ORDER = ["cnd_federal", "crf_fgts", "cndt", "certidao_estadual", "certidao_municipal"];

export function CentralCertidoes({
  companyId,
  company,
}: {
  companyId: number;
  company: { id: number; cnpj: string; razaoSocial: string };
}) {
  const token = getToken();
  const [certidoes, setCertidoes] = useState<CertidoesMap | null>(null);
  const [loading, setLoading] = useState(true);
  const [loteOpen, setLoteOpen] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/companies/${companyId}/certidoes`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setCertidoes(await res.json());
    } finally {
      setLoading(false);
    }
  }, [companyId, token]);

  useEffect(() => { load(); }, [load]);

  const urgentCount = certidoes
    ? Object.values(certidoes).filter(c => c.status === "vencida" || c.status === "vencendo").length
    : 0;

  return (
    <div>
      {/* Section header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
            <Scale className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-base">Central de Certidões</h3>
            {urgentCount > 0 && (
              <p className="text-xs text-amber-600 font-medium">
                {urgentCount} certidão{urgentCount > 1 ? "ões" : ""} precisam de atenção
              </p>
            )}
          </div>
        </div>
        {certidoes && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setLoteOpen(true)}
            className="gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Renovar todas
          </Button>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {TIPO_ORDER.map(t => (
            <div key={t} className="h-48 bg-slate-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : certidoes ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {TIPO_ORDER.map(tipo => {
            const data = certidoes[tipo];
            if (!data) return null;
            return (
              <CertidaoCard
                key={tipo}
                data={data}
                companyId={companyId}
                company={company}
                token={token!}
                onRefresh={load}
              />
            );
          })}
        </div>
      ) : (
        <div className="text-center py-8 text-slate-400 text-sm">
          Não foi possível carregar as certidões.
          <button onClick={load} className="ml-2 text-blue-600 hover:underline">Tentar novamente</button>
        </div>
      )}

      {loteOpen && certidoes && (
        <RenovarLoteModal
          certidoes={certidoes}
          companyId={companyId}
          token={token!}
          onClose={() => setLoteOpen(false)}
          onComplete={load}
        />
      )}
    </div>
  );
}

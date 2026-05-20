import { useState, useMemo } from "react";
import { Link } from "wouter";
import { getToken } from "@/hooks/use-auth";
import { FileUploadZone, FileListItem } from "@/components/files/FileUploadZone";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2, XCircle, Clock, AlertTriangle, Lock, Sparkles,
  FolderOpen, Play, Loader2, ExternalLink, Download, X, Globe,
  ArrowRight, FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ValidationItem {
  id: number;
  status: string;
  requirementId: number;
  notes?: string | null;
  requirement?: {
    id: number;
    title: string;
    description?: string;
    category: string;
    mandatory: boolean;
  };
}

interface DocGroup {
  key: string;
  label: string;
  color: string;
  bg: string;
  borderColor: string;
  kind: "empresa" | "fiscal" | "trabalhista" | "tecnica" | "financeira" | "declaracoes" | "outros";
  items: { id: number; title: string; mandatory: boolean; status: string }[];
}

export interface DocumentosTabProps {
  id: number;
  process: {
    requirements?: { id: number; title: string; category: string; mandatory: boolean }[];
    validationItems: ValidationItem[];
    documentFiles: { id: number; name: string; mimeType?: string; path?: string }[];
  };
  companyData: {
    razaoSocial?: string;
    cnpj?: string;
    uf?: string;
    municipio?: string;
    logradouro?: string;
    numero?: string;
    bairro?: string;
    representanteLegal?: string;
    nomeResponsavel?: string;
    cpfResponsavel?: string;
    porte?: string;
  } | null;
  step2Locked: boolean;
  isInConference: boolean;
  needsDocAnalysis: boolean;
  valStats: { ok: number; faltando: number; vencido: number; divergente: number; revisar: number; total: number };
  docReqCount: number;
  uploadDocument: { isPending: boolean };
  handleDocUpload: (file: Blob) => void;
  removeFile: { mutate: (args: { id: number }) => void };
  analyzeDocs: { mutate: (args: { id: number }) => void; isPending: boolean };
}

// ── Category config ───────────────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<string, Omit<DocGroup, "key" | "items">> = {
  habilitacao_juridica: {
    label: "Documentos da empresa",
    color: "#0066FF", bg: "#EFF6FF", borderColor: "#BFDBFE",
    kind: "empresa",
  },
  habilitacao_fiscal: {
    label: "Certidões fiscais",
    color: "#059669", bg: "#F0FDF4", borderColor: "#BBF7D0",
    kind: "fiscal",
  },
  habilitacao_trabalhista: {
    label: "Certidões trabalhistas",
    color: "#0891B2", bg: "#F0F9FF", borderColor: "#BAE6FD",
    kind: "trabalhista",
  },
  qualificacao_tecnica: {
    label: "Qualificação técnica",
    color: "#D97706", bg: "#FFFBEB", borderColor: "#FDE68A",
    kind: "tecnica",
  },
  habilitacao_financeira: {
    label: "Qualificação econômico-financeira",
    color: "#7C3AED", bg: "#F5F3FF", borderColor: "#DDD6FE",
    kind: "financeira",
  },
  documentacao_complementar: {
    label: "Declarações obrigatórias",
    color: "#6366F1", bg: "#EEF2FF", borderColor: "#C7D2FE",
    kind: "declaracoes",
  },
};

const FALLBACK_CONFIG = {
  label: "Outros documentos",
  color: "#64748B", bg: "#F8FAFC", borderColor: "#E2E8F0",
  kind: "outros" as const,
};

// ── Portal data ───────────────────────────────────────────────────────────────

const FEDERAL_PORTALS = [
  {
    name: "Certidão Negativa Federal (PGFN + RFB)",
    desc: "Certidão conjunta da Receita Federal e Procuradoria",
    url: "https://solucoes.receita.fazenda.gov.br/Servicos/certidaointernet/PJ/Emitir",
  },
  {
    name: "Certidão de Débitos Trabalhistas (TST)",
    desc: "Certidão Negativa de Débitos Trabalhistas",
    url: "https://www.tst.jus.br/certidao",
  },
  {
    name: "Certificado de Regularidade do FGTS (CEF)",
    desc: "CRF emitido pela Caixa Econômica Federal",
    url: "https://consulta-crf.caixa.gov.br",
  },
  {
    name: "SICAF — Situação do fornecedor",
    desc: "Sistema de Cadastramento Unificado de Fornecedores",
    url: "https://www.comprasgovernamentais.gov.br/index.php/sicaf",
  },
];

const SEFAZ_PORTALS: Record<string, { url: string; nome: string }> = {
  AC: { url: "https://www.sefaz.ac.gov.br", nome: "SEFAZ-AC" },
  AL: { url: "https://www.sefaz.al.gov.br", nome: "SEFAZ-AL" },
  AM: { url: "https://www.sefaz.am.gov.br", nome: "SEFAZ-AM" },
  AP: { url: "https://www.sefaz.ap.gov.br", nome: "SEFAZ-AP" },
  BA: { url: "https://www.sefaz.ba.gov.br", nome: "SEFAZ-BA" },
  CE: { url: "https://www.sefaz.ce.gov.br", nome: "SEFAZ-CE" },
  DF: { url: "https://www.economia.df.gov.br", nome: "SEF-DF" },
  ES: { url: "https://www.sefaz.es.gov.br", nome: "SEFAZ-ES" },
  GO: { url: "https://www.economia.go.gov.br", nome: "SEFAZ-GO" },
  MA: { url: "https://www.sefaz.ma.gov.br", nome: "SEFAZ-MA" },
  MG: { url: "https://www.fazenda.mg.gov.br", nome: "SEFAZ-MG" },
  MS: { url: "https://www.fazenda.ms.gov.br", nome: "SEFAZ-MS" },
  MT: { url: "https://www.sefaz.mt.gov.br", nome: "SEFAZ-MT" },
  PA: { url: "https://www.sefa.pa.gov.br", nome: "SEFA-PA" },
  PB: { url: "https://www.sefaz.pb.gov.br", nome: "SEFAZ-PB" },
  PE: { url: "https://www.sefaz.pe.gov.br", nome: "SEFAZ-PE" },
  PI: { url: "https://www.sefaz.pi.gov.br", nome: "SEFAZ-PI" },
  PR: { url: "https://www.fazenda.pr.gov.br", nome: "SEFAZ-PR" },
  RJ: { url: "https://www.fazenda.rj.gov.br", nome: "SEFAZ-RJ" },
  RN: { url: "https://www.set.rn.gov.br", nome: "SET-RN" },
  RO: { url: "https://www.sefin.ro.gov.br", nome: "SEFIN-RO" },
  RR: { url: "https://www.sefaz.rr.gov.br", nome: "SEFAZ-RR" },
  RS: { url: "https://www.sefaz.rs.gov.br", nome: "SEFAZ-RS" },
  SC: { url: "https://www.sef.sc.gov.br", nome: "SEF-SC" },
  SE: { url: "https://www.sefaz.se.gov.br", nome: "SEFAZ-SE" },
  SP: { url: "https://www.fazenda.sp.gov.br", nome: "SEFAZ-SP" },
  TO: { url: "https://www.sefaz.to.gov.br", nome: "SEFAZ-TO" },
};

const DEFAULT_DECL_TYPES = [
  { type: "declaracao_meppp", label: "Declaração de ME/EPP (Lei Complementar 123)" },
  { type: "declaracao_fato_impeditivo", label: "Declaração de inexistência de fato impeditivo" },
  { type: "declaracao_menor", label: "Declaração de não-empregar menor (Lei 9.854/99)" },
  { type: "declaracao_proposta_independente", label: "Declaração de elaboração independente de proposta" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildGroups(process: DocumentosTabProps["process"]): DocGroup[] {
  const requirements = process.requirements ?? [];
  const validationItems = process.validationItems ?? [];

  const validationByReqId = new Map<number, string>();
  for (const vi of validationItems) {
    if (vi.requirementId) validationByReqId.set(vi.requirementId, vi.status);
  }

  const groupMap = new Map<string, DocGroup>();

  for (const req of requirements) {
    const cat = req.category ?? "outros";
    const cfg = CATEGORY_CONFIG[cat] ?? { ...FALLBACK_CONFIG };
    const key = cat in CATEGORY_CONFIG ? cat : "outros";

    if (!groupMap.has(key)) {
      groupMap.set(key, {
        key,
        label: cfg.label,
        color: cfg.color,
        bg: cfg.bg,
        borderColor: cfg.borderColor,
        kind: cfg.kind,
        items: [],
      });
    }

    const status = validationByReqId.get(req.id) ?? "pendente";
    groupMap.get(key)!.items.push({
      id: req.id,
      title: req.title,
      mandatory: req.mandatory,
      status,
    });
  }

  const ORDER = [
    "habilitacao_juridica",
    "habilitacao_fiscal",
    "habilitacao_trabalhista",
    "documentacao_complementar",
    "qualificacao_tecnica",
    "habilitacao_financeira",
    "outros",
  ];
  return ORDER.filter(k => groupMap.has(k))
    .map(k => groupMap.get(k)!)
    .concat([...groupMap.values()].filter(g => !ORDER.includes(g.key)));
}

function itemStatusIcon(status: string) {
  if (status === "ok") return <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: "#059669" }} />;
  if (status === "vencido") return <Clock className="w-4 h-4 flex-shrink-0" style={{ color: "#EA580C" }} />;
  if (status === "faltando") return <XCircle className="w-4 h-4 flex-shrink-0" style={{ color: "#DC2626" }} />;
  if (status === "divergente") return <AlertTriangle className="w-4 h-4 flex-shrink-0" style={{ color: "#D97706" }} />;
  if (status === "revisar") return <AlertTriangle className="w-4 h-4 flex-shrink-0" style={{ color: "#7C3AED" }} />;
  return <XCircle className="w-4 h-4 flex-shrink-0" style={{ color: "#CBD5E1" }} />;
}

const STATUS_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  ok: { label: "Tudo certo", color: "#059669", bg: "#F0FDF4" },
  faltando: { label: "Não enviado", color: "#DC2626", bg: "#FEF2F2" },
  vencido: { label: "Vencendo", color: "#EA580C", bg: "#FFF7ED" },
  divergente: { label: "Conferir", color: "#D97706", bg: "#FFFBEB" },
  revisar: { label: "Revisar", color: "#7C3AED", bg: "#F5F3FF" },
  pendente: { label: "Pendente", color: "#94A3B8", bg: "#F8FAFC" },
};

function ItemBadge({ status }: { status: string }) {
  const s = STATUS_BADGE[status] ?? STATUS_BADGE.pendente;
  return (
    <span
      className="text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{ color: s.color, background: s.bg }}
    >
      {s.label}
    </span>
  );
}

// ── Completeness header ───────────────────────────────────────────────────────

function CompletenessHeader({ groups }: { groups: DocGroup[] }) {
  const allItems = groups.flatMap(g => g.items);
  const mandatory = allItems.filter(i => i.mandatory);
  const readyCount = mandatory.filter(i => i.status === "ok").length;
  const total = mandatory.length;

  if (total === 0) return null;

  const pct = total > 0 ? Math.round((readyCount / total) * 100) : 0;
  const barColor = pct === 100 ? "#059669" : pct >= 60 ? "#0066FF" : pct >= 30 ? "#D97706" : "#DC2626";

  return (
    <div
      className="rounded-2xl p-5 mb-5"
      style={{ background: "white", border: "1px solid #E8EFF6", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}
    >
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm font-bold text-slate-900">Prontidão documental</p>
          <p className="text-xs text-slate-500 mt-0.5">
            {readyCount < total
              ? `Faltam ${total - readyCount} documento${total - readyCount !== 1 ? "s" : ""} para liberar o envio da proposta.`
              : "Todos os documentos obrigatórios estão ok!"}
          </p>
        </div>
        <span className="text-2xl font-bold" style={{ color: barColor }}>
          {readyCount}/{total}
        </span>
      </div>

      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mb-4">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, backgroundColor: barColor }}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {groups.map(g => {
          const gmand = g.items.filter(i => i.mandatory);
          const gok = gmand.filter(i => i.status === "ok").length;
          const gTotal = gmand.length;
          if (gTotal === 0) return null;
          const allOk = gok === gTotal;
          const someOk = gok > 0;
          return (
            <span
              key={g.key}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg"
              style={{
                background: allOk ? "#F0FDF4" : someOk ? "#FFFBEB" : "#FEF2F2",
                color: allOk ? "#059669" : someOk ? "#D97706" : "#DC2626",
              }}
            >
              {allOk ? "✓" : someOk ? "~" : "✕"} {g.label.split(" ")[0]}
            </span>
          );
        })}
      </div>
    </div>
  );
}

// ── Group card ────────────────────────────────────────────────────────────────

function GroupCard({
  group,
  onShowPortals,
  onShowDeclGen,
}: {
  group: DocGroup;
  onShowPortals: () => void;
  onShowDeclGen: () => void;
}) {
  const okCount = group.items.filter(i => i.status === "ok").length;
  const total = group.items.length;

  const actionBtn =
    group.kind === "fiscal" || group.kind === "trabalhista" ? (
      <button
        onClick={onShowPortals}
        className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all hover:opacity-80"
        style={{ background: group.bg, color: group.color, border: `1px solid ${group.borderColor}` }}
      >
        <Globe className="w-3.5 h-3.5" />
        Ver portais
      </button>
    ) : group.kind === "declaracoes" ? (
      <button
        onClick={onShowDeclGen}
        className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all hover:opacity-80"
        style={{ background: group.bg, color: group.color, border: `1px solid ${group.borderColor}` }}
      >
        <Sparkles className="w-3.5 h-3.5" />
        Gerar com IA
      </button>
    ) : null;

  return (
    <div
      className="rounded-2xl overflow-hidden mb-4"
      style={{ border: `1px solid ${group.borderColor}` }}
    >
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ background: group.bg }}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold" style={{ color: group.color }}>
            {group.label}
          </span>
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{
              background: okCount === total && total > 0 ? "#D1FAE5" : "rgba(0,0,0,0.08)",
              color: okCount === total && total > 0 ? "#059669" : group.color,
            }}
          >
            {okCount} de {total}
          </span>
        </div>
        {actionBtn}
      </div>

      <div className="bg-white divide-y" style={{ borderColor: "#F1F5F9" }}>
        {group.items.map(item => (
          <div key={item.id} className="flex items-center gap-3 px-4 py-3">
            {itemStatusIcon(item.status)}
            <p className="flex-1 text-sm text-slate-700 leading-snug">{item.title}</p>
            {!item.mandatory && (
              <span className="text-[10px] font-medium text-slate-400 border border-slate-200 px-1.5 py-0.5 rounded mr-1">
                opcional
              </span>
            )}
            <ItemBadge status={item.status} />
          </div>
        ))}

        {group.kind === "tecnica" && group.items.some(i => i.status !== "ok") && (
          <div className="px-4 py-3 flex items-start gap-2" style={{ background: "#FFFBEB" }}>
            <span className="text-amber-600 mt-0.5">💡</span>
            <p className="text-xs text-amber-700 leading-relaxed">
              Solicite ao seu cliente um atestado das prestações de serviço realizadas, em papel timbrado com assinatura do responsável.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Portal links modal ────────────────────────────────────────────────────────

function PortalLinksModal({
  cnpj,
  uf,
  municipio,
  onClose,
}: {
  cnpj?: string | null;
  uf?: string | null;
  municipio?: string | null;
  onClose: () => void;
}) {
  const sefaz = uf ? SEFAZ_PORTALS[uf] : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }}>
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: "#E8EFF6" }}>
          <div>
            <h3 className="text-base font-bold text-slate-900">Portais de certidões</h3>
            {cnpj && (
              <p className="text-xs text-slate-500 mt-0.5">
                CNPJ: <span className="font-semibold text-slate-700">{cnpj}</span>
              </p>
            )}
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          {FEDERAL_PORTALS.map(p => (
            <a
              key={p.url}
              href={p.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-4 rounded-xl border hover:shadow-sm transition-all group"
              style={{ borderColor: "#E8EFF6" }}
            >
              <div>
                <p className="text-sm font-semibold text-slate-800 group-hover:text-blue-600 transition-colors">
                  {p.name}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">{p.desc}</p>
              </div>
              <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-blue-500 flex-shrink-0 ml-3" />
            </a>
          ))}

          {sefaz ? (
            <a
              href={sefaz.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-4 rounded-xl border hover:shadow-sm transition-all group"
              style={{ borderColor: "#E8EFF6" }}
            >
              <div>
                <p className="text-sm font-semibold text-slate-800 group-hover:text-blue-600 transition-colors">
                  Certidão Estadual ({sefaz.nome})
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {municipio ? `Portal da Fazenda estadual — ${municipio}-${uf}` : `Portal da Fazenda de ${uf}`}
                </p>
              </div>
              <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-blue-500 flex-shrink-0 ml-3" />
            </a>
          ) : uf ? (
            <div
              className="p-4 rounded-xl border"
              style={{ borderColor: "#E8EFF6", background: "#F8FAFC" }}
            >
              <p className="text-sm text-slate-500">
                A certidão estadual de <strong>{uf}</strong> deve ser obtida no portal da Fazenda do seu estado.
              </p>
            </div>
          ) : null}

          <div
            className="rounded-xl p-4 flex items-start gap-2 mt-2"
            style={{ background: "#F0F9FF", border: "1px solid #BAE6FD" }}
          >
            <span className="text-blue-500 mt-0.5">ℹ️</span>
            <p className="text-xs text-blue-700 leading-relaxed">
              Após baixar cada certidão, volte aqui e faça o upload na seção de documentos abaixo. O sistema extrai a validade automaticamente.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Declaration generator modal ───────────────────────────────────────────────

interface GeneratedDecl {
  id: number;
  declarationType: string;
  declarationText?: string;
  filePath?: string;
  downloadUrl: string;
  label: string;
}

function DeclarationModal({
  processId,
  declTypes,
  company,
  onClose,
}: {
  processId: number;
  declTypes: { type: string; label: string }[];
  company: DocumentosTabProps["companyData"];
  onClose: () => void;
}) {
  const token = getToken();
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState<GeneratedDecl[]>([]);
  const [error, setError] = useState<string | null>(null);

  const companyName = company?.razaoSocial ?? "sua empresa";
  const apiBase = (import.meta as any).env?.VITE_API_URL ?? "";

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/api/processes/${processId}/generate-declarations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ declarationTypes: declTypes.map(d => d.type) }),
      });
      if (!res.ok) throw new Error("Erro ao gerar declarações");
      const data = await res.json();
      const genList: GeneratedDecl[] = (data.generated ?? []).map((d: any) => ({
        ...d,
        downloadUrl: `${apiBase}/uploads/${d.filePath}`,
        label: declTypes.find(dt => dt.type === d.declarationType)?.label ?? d.declarationType,
      }));
      setGenerated(genList);
    } catch (e: any) {
      setError(e.message ?? "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }}>
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: "#E8EFF6" }}>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-500" />
            <h3 className="text-base font-bold text-slate-900">Gerador de declarações</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <div className="p-5">
          {generated.length === 0 ? (
            <>
              <p className="text-sm text-slate-600 mb-4">
                A IA vai gerar as declarações abaixo com os dados de{" "}
                <strong>{companyName}</strong> já preenchidos. Você revisa, assina e faz o upload.
              </p>

              <div className="space-y-2 mb-5">
                {declTypes.map(d => (
                  <div
                    key={d.type}
                    className="flex items-center gap-2 p-3 rounded-xl"
                    style={{ background: "#F8FAFC", border: "1px solid #E8EFF6" }}
                  >
                    <FileText className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                    <p className="text-sm text-slate-700">{d.label}</p>
                  </div>
                ))}
              </div>

              {error && (
                <div className="mb-4 p-3 rounded-xl text-sm text-red-700" style={{ background: "#FEF2F2" }}>
                  {error}
                </div>
              )}

              <button
                onClick={handleGenerate}
                disabled={loading}
                className="w-full py-3 rounded-xl text-white font-semibold flex items-center justify-center gap-2 text-sm transition-all hover:opacity-90 disabled:opacity-60"
                style={{ background: "#6366F1" }}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Gerando com IA...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Gerar {declTypes.length} declarações com IA
                  </>
                )}
              </button>
            </>
          ) : (
            <>
              <div
                className="flex items-center gap-2 p-3 rounded-xl mb-4"
                style={{ background: "#F0FDF4", border: "1px solid #BBF7D0" }}
              >
                <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                <p className="text-sm font-semibold text-green-800">
                  {generated.length} declarações geradas com sucesso!
                </p>
              </div>

              <div className="space-y-2 mb-5">
                {generated.map(d => (
                  <div
                    key={d.id}
                    className="flex items-center gap-3 p-3 rounded-xl"
                    style={{ border: "1px solid #E8EFF6" }}
                  >
                    <FileText className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                    <p className="text-sm text-slate-700 flex-1 leading-snug">{d.label}</p>
                    <a
                      href={d.downloadUrl}
                      download
                      className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-all hover:opacity-80"
                      style={{ background: "#EEF2FF", color: "#6366F1" }}
                    >
                      <Download className="w-3.5 h-3.5" />
                      Baixar
                    </a>
                  </div>
                ))}
              </div>

              <div
                className="rounded-xl p-4 flex items-start gap-2 mb-4"
                style={{ background: "#FFFBEB", border: "1px solid #FDE68A" }}
              >
                <span className="text-amber-600 mt-0.5">⚠️</span>
                <p className="text-xs text-amber-700 leading-relaxed">
                  Revise cada declaração, assine (pode ser assinatura digital) e faça o upload da versão assinada abaixo.
                </p>
              </div>

              <button
                onClick={onClose}
                className="w-full py-2.5 rounded-xl font-semibold text-sm border transition-all hover:bg-slate-50"
                style={{ borderColor: "#E2E8F0", color: "#64748B" }}
              >
                Fechar e fazer upload das assinadas
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Validation results ────────────────────────────────────────────────────────

function ValidationResults({
  valStats,
  process,
  id,
}: {
  valStats: DocumentosTabProps["valStats"];
  process: DocumentosTabProps["process"];
  id: number;
}) {
  return (
    <div className="rounded-2xl overflow-hidden mt-4" style={{ border: "1px solid #E8EFF6" }}>
      <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0" style={{ borderColor: "#E8EFF6" }}>
        {[
          { label: "Tudo certo", count: valStats.ok, color: "#059669", bg: "#F0FDF4" },
          { label: "Faltando", count: valStats.faltando, color: "#DC2626", bg: "#FEF2F2" },
          { label: "Vencendo", count: valStats.vencido, color: "#EA580C", bg: "#FFF7ED" },
          { label: "Conferir", count: valStats.divergente + valStats.revisar, color: "#D97706", bg: "#FFFBEB" },
        ].map(s => (
          <div key={s.label} className="p-4 text-center" style={{ background: s.bg }}>
            <p className="text-2xl font-bold" style={{ color: s.color }}>{s.count}</p>
            <p className="text-[11px] font-semibold text-slate-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-white divide-y" style={{ borderColor: "#E8EFF6" }}>
        {process.validationItems.slice(0, 8).map(item => (
          <div key={item.id} className="px-5 py-3 flex items-center gap-3">
            {itemStatusIcon(item.status)}
            <p className="flex-1 text-sm text-slate-700 truncate">{item.requirement?.title ?? "—"}</p>
            <ItemBadge status={item.status} />
          </div>
        ))}
        {process.validationItems.length > 8 && (
          <div className="px-5 py-3">
            <Link
              href={`/processes/${id}/checklist`}
              className="text-sm font-semibold text-blue-600 hover:underline flex items-center gap-1"
            >
              Ver todos os {process.validationItems.length} itens
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}
      </div>

      {valStats.faltando > 0 && (
        <div className="p-4" style={{ background: "#FEF2F2", borderTop: "1px solid #FECACA" }}>
          <p className="text-sm font-semibold text-red-800">
            Você precisa enviar mais {valStats.faltando} documento{valStats.faltando !== 1 ? "s" : ""} para participar desta licitação.
          </p>
          <p className="text-xs text-red-600 mt-0.5">Adicione os documentos acima e refaça a conferência.</p>
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function DocumentosTab({
  id,
  process,
  companyData,
  step2Locked,
  isInConference,
  needsDocAnalysis,
  valStats,
  docReqCount,
  uploadDocument,
  handleDocUpload,
  removeFile,
  analyzeDocs,
}: DocumentosTabProps) {
  const [showPortals, setShowPortals] = useState(false);
  const [showDeclGen, setShowDeclGen] = useState(false);

  const groups = useMemo(() => buildGroups(process), [process]);

  const declRequirements = useMemo(() => {
    const fromReqs = (process.requirements ?? [])
      .filter(r => r.category === "documentacao_complementar")
      .map(r => ({ type: r.title.toLowerCase().replace(/\s+/g, "_").slice(0, 40), label: r.title }));

    return fromReqs.length > 0 ? fromReqs : DEFAULT_DECL_TYPES;
  }, [process.requirements]);

  if (step2Locked) {
    return (
      <div
        className="rounded-2xl p-8 text-center mb-6"
        style={{ border: "2px dashed #E2E8F0", background: "#FAFBFC" }}
      >
        <Lock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
        <p className="text-sm font-medium text-slate-500">Complete a análise do edital primeiro.</p>
        <p className="text-xs text-slate-400 mt-1">A aba "Análise IA" vai identificar os documentos necessários.</p>
      </div>
    );
  }

  const hasGroups = groups.length > 0;

  return (
    <div className="mb-6">
      {hasGroups && <CompletenessHeader groups={groups} />}

      {hasGroups && groups.map(group => (
        <GroupCard
          key={group.key}
          group={group}
          onShowPortals={() => setShowPortals(true)}
          onShowDeclGen={() => setShowDeclGen(true)}
        />
      ))}

      <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid #E8EFF6" }}>
        <div className="bg-white p-5">
          <div className="flex items-center gap-2 mb-4">
            <FolderOpen className="w-4 h-4 text-indigo-500" />
            <p className="text-sm font-semibold text-slate-800">Seus arquivos enviados</p>
            <span className="text-xs text-slate-400 ml-auto">
              {process.documentFiles.length} arquivo(s)
            </span>
          </div>

          <div className="space-y-3">
            {process.documentFiles.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {process.documentFiles.map(file => (
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
              multiple={true}
              isUploading={uploadDocument.isPending}
              label="Adicionar documento"
            />

            {needsDocAnalysis && (
              <div
                className="rounded-xl p-4 flex items-start gap-4"
                style={{ background: "#F5F3FF", border: "1px solid #DDD6FE" }}
              >
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: "#EDE9FE" }}
                >
                  <Sparkles className="w-4 h-4 text-violet-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-violet-900 mb-1">
                    Documentos enviados! Vamos conferir tudo.
                  </p>
                  <p className="text-xs text-violet-700 mb-3">
                    A IA vai comparar seus documentos com as {docReqCount} exigências do edital.
                  </p>
                  <Button
                    onClick={() => analyzeDocs.mutate({ id })}
                    disabled={analyzeDocs.isPending}
                    className="bg-violet-600 hover:bg-violet-700 text-white"
                  >
                    {analyzeDocs.isPending ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Conferindo...</>
                    ) : (
                      <><Play className="w-4 h-4 mr-2" /> Conferir documentos com IA</>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {isInConference && valStats.total > 0 && (
        <ValidationResults valStats={valStats} process={process} id={id} />
      )}

      {showPortals && (
        <PortalLinksModal
          cnpj={companyData?.cnpj}
          uf={companyData?.uf}
          municipio={companyData?.municipio}
          onClose={() => setShowPortals(false)}
        />
      )}

      {showDeclGen && (
        <DeclarationModal
          processId={id}
          declTypes={declRequirements}
          company={companyData}
          onClose={() => setShowDeclGen(false)}
        />
      )}
    </div>
  );
}

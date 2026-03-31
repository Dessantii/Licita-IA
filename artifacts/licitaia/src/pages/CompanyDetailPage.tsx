import { useState, useRef } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Link, useRoute, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
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
  Building2,
  ChevronLeft,
  Loader2,
  Trash2,
  Upload,
  FileText,
  X,
  AlertTriangle,
  CheckCircle2,
  FileX,
  FileWarning,
  Mail,
  Phone,
  MapPin,
  User,
  Hash,
  FileCheck,
  Calendar,
  FolderOpen,
  Sparkles,
  ScanLine,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getToken } from "@/hooks/use-auth";

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");

const DOC_TYPE_LABELS: Record<string, string> = {
  cnpj: "Cartão CNPJ",
  estatuto_social: "Estatuto Social",
  ata_eleicao: "Ata de Eleição",
  certidao_federal: "Certidão Federal",
  certidao_estadual: "Certidão Estadual",
  certidao_municipal: "Certidão Municipal",
  certidao_trabalhista: "Certidão Trabalhista",
  certidao_fgts: "Certidão FGTS",
  balanco_patrimonial: "Balanço Patrimonial",
  declaracao: "Declaração",
  procuracao: "Procuração",
  outros: "Outros",
};

const DOC_TYPES = Object.entries(DOC_TYPE_LABELS).map(([value, label]) => ({ value, label }));

interface CompanyDocument {
  id: number;
  companyId: number;
  titulo: string;
  tipo: string;
  dataEmissao: string | null;
  dataValidade: string | null;
  name: string;
  path: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
}

interface CompanyDetail {
  id: number;
  razaoSocial: string;
  nomeFantasia: string | null;
  cnpj: string;
  email: string | null;
  telefone: string | null;
  endereco: string | null;
  inscricaoEstadual: string | null;
  inscricaoMunicipal: string | null;
  representanteLegal: string | null;
  observacoes: string | null;
  documentStatus: "regular" | "vencendo" | "vencido" | "sem_documentos";
  documents: CompanyDocument[];
  createdAt: string;
  updatedAt: string;
}

type Tab = "visao_geral" | "documentos" | "processos";

function getDocValidity(doc: CompanyDocument): { label: string; color: string; icon: React.ElementType } | null {
  if (!doc.dataValidade) return null;
  const today = new Date().toISOString().split("T")[0]!;
  const in30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]!;

  if (doc.dataValidade < today) {
    return { label: "Vencido", color: "bg-red-100 text-red-700", icon: FileX };
  }
  if (doc.dataValidade <= in30Days) {
    return { label: "Vencendo em breve", color: "bg-yellow-100 text-yellow-700", icon: AlertTriangle };
  }
  return { label: "Regular", color: "bg-green-100 text-green-700", icon: CheckCircle2 };
}

interface UploadDocForm {
  titulo: string;
  tipo: string;
  dataEmissao: string;
  dataValidade: string;
  file: File | null;
}

export function CompanyDetailPage() {
  const [, params] = useRoute("/companies/:id");
  const [, navigate] = useLocation();
  const id = Number(params?.id);
  const token = getToken();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<Tab>("visao_geral");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [uploadForm, setUploadForm] = useState<UploadDocForm>({
    titulo: "",
    tipo: "outros",
    dataEmissao: "",
    dataValidade: "",
    file: null,
  });
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [autoFilledFields, setAutoFilledFields] = useState<Set<keyof UploadDocForm>>(new Set());
  const [aiUsed, setAiUsed] = useState(false);

  const { data: company, isLoading } = useQuery<CompanyDetail>({
    queryKey: ["company", id],
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}/api/companies/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Empresa não encontrada");
      return res.json();
    },
    enabled: !isNaN(id),
  });

  const deleteCompanyMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${BASE_URL}/api/companies/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Erro ao excluir empresa");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      toast({ title: "Empresa excluída" });
      navigate("/companies");
    },
    onError: () => {
      toast({ title: "Erro ao excluir empresa", variant: "destructive" });
    },
  });

  const deleteDocMutation = useMutation({
    mutationFn: async (docId: number) => {
      const res = await fetch(`${BASE_URL}/api/companies/${id}/documents/${docId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Erro ao excluir documento");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company", id] });
      toast({ title: "Documento removido" });
    },
    onError: () => {
      toast({ title: "Erro ao remover documento", variant: "destructive" });
    },
  });

  async function analyzeFile(file: File) {
    setIsAnalyzing(true);
    setAutoFilledFields(new Set());
    setAiUsed(false);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`${BASE_URL}/api/companies/analyze-doc`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      const filled = new Set<keyof UploadDocForm>();
      setUploadForm(f => {
        const next = { ...f, file };
        if (data.titulo) { next.titulo = data.titulo; filled.add("titulo"); }
        if (data.tipo && data.tipo !== "outros") { next.tipo = data.tipo; filled.add("tipo"); }
        if (data.dataEmissao) { next.dataEmissao = data.dataEmissao; filled.add("dataEmissao"); }
        if (data.dataValidade) { next.dataValidade = data.dataValidade; filled.add("dataValidade"); }
        return next;
      });
      setAutoFilledFields(filled);
      setAiUsed(!!data.aiUsed);
    } catch {
      // Analysis failed — just set the file, let user fill manually
      setUploadForm(f => ({ ...f, file, titulo: f.titulo || file.name.replace(/\.[^.]+$/, "") }));
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!uploadForm.file || !uploadForm.titulo.trim()) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", uploadForm.file);
      formData.append("titulo", uploadForm.titulo.trim());
      formData.append("tipo", uploadForm.tipo);
      if (uploadForm.dataEmissao) formData.append("dataEmissao", uploadForm.dataEmissao);
      if (uploadForm.dataValidade) formData.append("dataValidade", uploadForm.dataValidade);

      const res = await fetch(`${BASE_URL}/api/companies/${id}/documents`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) throw new Error("Erro ao enviar documento");

      queryClient.invalidateQueries({ queryKey: ["company", id] });
      toast({ title: "Documento enviado com sucesso" });
      setUploadForm({ titulo: "", tipo: "outros", dataEmissao: "", dataValidade: "", file: null });
      setAutoFilledFields(new Set());
      setAiUsed(false);
    } catch {
      toast({ title: "Erro ao enviar documento", variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  }

  if (isLoading || !company) {
    return (
      <AppLayout>
        <div className="flex items-center gap-3 py-20 justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <span className="text-slate-500">Carregando empresa...</span>
        </div>
      </AppLayout>
    );
  }

  const expiredDocs = company.documents.filter(d => {
    if (!d.dataValidade) return false;
    return d.dataValidade < new Date().toISOString().split("T")[0]!;
  });

  const expiringSoonDocs = company.documents.filter(d => {
    if (!d.dataValidade) return false;
    const today = new Date().toISOString().split("T")[0]!;
    const in30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]!;
    return d.dataValidade >= today && d.dataValidade <= in30Days;
  });

  const tabs: { id: Tab; label: string }[] = [
    { id: "visao_geral", label: "Visão Geral" },
    { id: "documentos", label: `Documentos (${company.documents.length})` },
    { id: "processos", label: "Processos" },
  ];

  return (
    <AppLayout>
      <div className="mb-6">
        <Link
          href="/companies"
          className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-primary mb-4 transition-colors"
        >
          <ChevronLeft className="w-4 h-4 mr-1" /> Empresas
        </Link>

        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                <Building2 className="w-6 h-6 text-blue-600" />
              </div>
            </div>
            <h1 className="text-2xl font-display font-bold text-slate-900 leading-tight mb-1">
              {company.razaoSocial}
            </h1>
            {company.nomeFantasia && (
              <p className="text-slate-500 text-sm mb-1">{company.nomeFantasia}</p>
            )}
            <p className="text-slate-400 font-mono text-sm">{company.cnpj}</p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
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

      {(expiredDocs.length > 0 || expiringSoonDocs.length > 0) && (
        <div className="mb-6 space-y-2">
          {expiredDocs.length > 0 && (
            <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
              <FileX className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-900">Documentos vencidos</p>
                <p className="text-sm text-red-700 mt-0.5">
                  {expiredDocs.map(d => d.titulo).join(", ")}
                </p>
              </div>
            </div>
          )}
          {expiringSoonDocs.length > 0 && (
            <div className="flex items-start gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
              <AlertTriangle className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-yellow-900">Documentos vencendo em breve</p>
                <p className="text-sm text-yellow-700 mt-0.5">
                  {expiringSoonDocs.map(d => d.titulo).join(", ")}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-1 mb-6 border-b border-slate-200">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px",
              activeTab === tab.id
                ? "border-primary text-primary"
                : "border-transparent text-slate-500 hover:text-slate-800"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "visao_geral" && (
        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="text-base font-semibold text-slate-900 mb-4">Dados da Empresa</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {company.email && (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>{company.email}</span>
                </div>
              )}
              {company.telefone && (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>{company.telefone}</span>
                </div>
              )}
              {company.endereco && (
                <div className="flex items-start gap-2 text-sm text-slate-600 md:col-span-2">
                  <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <span>{company.endereco}</span>
                </div>
              )}
              {company.representanteLegal && (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <User className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>{company.representanteLegal}</span>
                </div>
              )}
              {company.inscricaoEstadual && (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Hash className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>IE: {company.inscricaoEstadual}</span>
                </div>
              )}
              {company.inscricaoMunicipal && (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Hash className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>IM: {company.inscricaoMunicipal}</span>
                </div>
              )}
            </div>
            {!company.email && !company.telefone && !company.endereco && !company.representanteLegal && !company.inscricaoEstadual && !company.inscricaoMunicipal && (
              <p className="text-sm text-slate-400 italic">Nenhum dado de contato cadastrado.</p>
            )}
            {company.observacoes && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Observações</p>
                <p className="text-sm text-slate-600 whitespace-pre-wrap">{company.observacoes}</p>
              </div>
            )}
          </Card>

          {company.documents.length > 0 && (
            <Card className="p-6">
              <h2 className="text-base font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-slate-400" />
                Resumo Documental
              </h2>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-3 bg-slate-50 rounded-lg">
                  <p className="text-2xl font-bold text-slate-900">{company.documents.length}</p>
                  <p className="text-xs text-slate-500 mt-0.5">Total</p>
                </div>
                <div className="text-center p-3 bg-red-50 rounded-lg">
                  <p className="text-2xl font-bold text-red-600">{expiredDocs.length}</p>
                  <p className="text-xs text-slate-500 mt-0.5">Vencidos</p>
                </div>
                <div className="text-center p-3 bg-yellow-50 rounded-lg">
                  <p className="text-2xl font-bold text-yellow-600">{expiringSoonDocs.length}</p>
                  <p className="text-xs text-slate-500 mt-0.5">Vencendo</p>
                </div>
              </div>
            </Card>
          )}
        </div>
      )}

      {activeTab === "documentos" && (
        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="text-base font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Upload className="w-5 h-5 text-slate-400" />
              Enviar Documento
            </h2>

            {/* Step 1: file drop zone (shown when no file selected) */}
            {!uploadForm.file && !isAnalyzing && (
              <div
                className="border-2 border-dashed rounded-xl p-10 flex flex-col items-center gap-3 cursor-pointer transition-all border-slate-200 hover:border-primary/50 hover:bg-primary/5"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-10 h-10 text-slate-300" />
                <div className="text-center">
                  <p className="text-sm font-medium text-slate-700">Clique ou arraste o documento aqui</p>
                  <p className="text-xs text-slate-400 mt-1">PDF, imagens ou outros (máx. 50MB)</p>
                </div>
                <p className="text-xs text-teal-600 flex items-center gap-1">
                  <ScanLine className="w-3.5 h-3.5" />
                  Metadados extraídos automaticamente para PDFs
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) analyzeFile(file);
                    e.target.value = "";
                  }}
                />
              </div>
            )}

            {/* Analyzing state */}
            {isAnalyzing && (
              <div className="border-2 border-dashed border-teal-200 rounded-xl p-10 flex flex-col items-center gap-3 bg-teal-50/30">
                <div className="w-12 h-12 rounded-xl bg-teal-100 flex items-center justify-center">
                  <ScanLine className="w-6 h-6 text-teal-500 animate-pulse" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-slate-700">Lendo documento…</p>
                  <p className="text-xs text-slate-400 mt-0.5">Extraindo título, tipo e datas automaticamente</p>
                </div>
                <Loader2 className="w-4 h-4 animate-spin text-teal-400" />
              </div>
            )}

            {/* Step 2: review form (shown after file selected and analysis done) */}
            {uploadForm.file && !isAnalyzing && (
              <form onSubmit={handleUpload} className="space-y-4">
                {/* Selected file indicator */}
                <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg border border-slate-200">
                  <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="text-sm text-slate-700 truncate flex-1">{uploadForm.file.name}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setUploadForm({ titulo: "", tipo: "outros", dataEmissao: "", dataValidade: "", file: null });
                      setAutoFilledFields(new Set());
                      setAiUsed(false);
                    }}
                    className="text-slate-400 hover:text-red-500 shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Auto-fill notice */}
                {autoFilledFields.size > 0 && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-teal-50 border border-teal-200 rounded-lg text-xs text-teal-700">
                    <Sparkles className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      {autoFilledFields.size} campo{autoFilledFields.size > 1 ? "s" : ""} preenchido{autoFilledFields.size > 1 ? "s" : ""} automaticamente
                      {aiUsed ? " (IA usada para imagem)" : " (leitura direta do PDF)"}
                      . Revise antes de enviar.
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Título */}
                  <div className="md:col-span-2">
                    <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700 mb-1">
                      Título *
                      {autoFilledFields.has("titulo") && (
                        <span className="text-xs text-teal-600 font-normal flex items-center gap-0.5">
                          <Sparkles className="w-3 h-3" /> auto
                        </span>
                      )}
                    </label>
                    <input
                      type="text"
                      className={cn(
                        "w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition-colors",
                        autoFilledFields.has("titulo") ? "border-teal-300 bg-teal-50/40" : "border-slate-200"
                      )}
                      placeholder="Ex: Certidão Negativa de Débitos Federais"
                      value={uploadForm.titulo}
                      onChange={e => setUploadForm(f => ({ ...f, titulo: e.target.value }))}
                      required
                    />
                  </div>

                  {/* Tipo */}
                  <div>
                    <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700 mb-1">
                      Tipo
                      {autoFilledFields.has("tipo") && (
                        <span className="text-xs text-teal-600 font-normal flex items-center gap-0.5">
                          <Sparkles className="w-3 h-3" /> auto
                        </span>
                      )}
                    </label>
                    <select
                      className={cn(
                        "w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition-colors",
                        autoFilledFields.has("tipo") ? "border-teal-300 bg-teal-50/40" : "border-slate-200"
                      )}
                      value={uploadForm.tipo}
                      onChange={e => setUploadForm(f => ({ ...f, tipo: e.target.value }))}
                    >
                      {DOC_TYPES.map(({ value, label }) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Data Emissão */}
                  <div>
                    <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700 mb-1">
                      Data de Emissão
                      {autoFilledFields.has("dataEmissao") && (
                        <span className="text-xs text-teal-600 font-normal flex items-center gap-0.5">
                          <Sparkles className="w-3 h-3" /> auto
                        </span>
                      )}
                    </label>
                    <input
                      type="date"
                      className={cn(
                        "w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition-colors",
                        autoFilledFields.has("dataEmissao") ? "border-teal-300 bg-teal-50/40" : "border-slate-200"
                      )}
                      value={uploadForm.dataEmissao}
                      onChange={e => setUploadForm(f => ({ ...f, dataEmissao: e.target.value }))}
                    />
                  </div>

                  {/* Data Validade */}
                  <div>
                    <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700 mb-1">
                      Data de Validade
                      {autoFilledFields.has("dataValidade") && (
                        <span className="text-xs text-teal-600 font-normal flex items-center gap-0.5">
                          <Sparkles className="w-3 h-3" /> auto
                        </span>
                      )}
                    </label>
                    <input
                      type="date"
                      className={cn(
                        "w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition-colors",
                        autoFilledFields.has("dataValidade") ? "border-teal-300 bg-teal-50/40" : "border-slate-200"
                      )}
                      value={uploadForm.dataValidade}
                      onChange={e => setUploadForm(f => ({ ...f, dataValidade: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    className="text-sm text-slate-400 hover:text-slate-600 underline underline-offset-2"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Trocar arquivo
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) analyzeFile(file);
                      e.target.value = "";
                    }}
                  />
                  <Button type="submit" disabled={isUploading || !uploadForm.titulo.trim()}>
                    {isUploading ? (
                      <><Loader2 className="w-4 h-4 animate-spin mr-2" />Enviando...</>
                    ) : (
                      <><Upload className="w-4 h-4 mr-2" />Enviar Documento</>
                    )}
                  </Button>
                </div>
              </form>
            )}
          </Card>

          {company.documents.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-300">
              <FileWarning className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="font-semibold text-slate-700">Nenhum documento cadastrado</p>
              <p className="text-sm text-slate-500 mt-1">Envie documentos usando o formulário acima.</p>
            </div>
          ) : (
            <Card className="p-6">
              <h2 className="text-base font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-slate-400" />
                Documentos ({company.documents.length})
              </h2>
              <div className="space-y-3">
                {company.documents.map(doc => {
                  const validity = getDocValidity(doc);
                  const ValidIcon = validity?.icon;
                  const typeLabel = DOC_TYPE_LABELS[doc.tipo] ?? doc.tipo;

                  return (
                    <div key={doc.id} className="flex items-start justify-between gap-3 p-4 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <FileText className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium text-slate-800 truncate">{doc.titulo}</p>
                            {validity && ValidIcon && (
                              <span className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium", validity.color)}>
                                <ValidIcon className="w-3 h-3" />
                                {validity.label}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                            <span className="text-xs text-slate-400">{typeLabel}</span>
                            {doc.dataEmissao && (
                              <span className="flex items-center gap-1 text-xs text-slate-400">
                                <Calendar className="w-3 h-3" />
                                Emissão: {format(new Date(doc.dataEmissao + "T00:00:00"), "dd/MM/yyyy", { locale: ptBR })}
                              </span>
                            )}
                            {doc.dataValidade && (
                              <span className={cn("flex items-center gap-1 text-xs", validity?.color?.includes("red") ? "text-red-600" : validity?.color?.includes("yellow") ? "text-yellow-600" : "text-slate-400")}>
                                <Calendar className="w-3 h-3" />
                                Validade: {format(new Date(doc.dataValidade + "T00:00:00"), "dd/MM/yyyy", { locale: ptBR })}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => deleteDocMutation.mutate(doc.id)}
                        disabled={deleteDocMutation.isPending}
                        className="p-1.5 text-slate-400 hover:text-red-500 transition-colors shrink-0"
                        title="Excluir documento"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </div>
      )}

      {activeTab === "processos" && (
        <div className="text-center py-20">
          <FolderOpen className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-700 mb-2">Processos da Empresa</h3>
          <p className="text-slate-500 text-sm max-w-sm mx-auto">
            A vinculação de processos e chamamentos a empresas será disponibilizada em breve.
          </p>
        </div>
      )}

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir empresa?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação excluirá permanentemente "{company.razaoSocial}" e todos os seus documentos. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteCompanyMutation.mutate()}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}

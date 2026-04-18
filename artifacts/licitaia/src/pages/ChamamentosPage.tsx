import { useState, useMemo, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useActiveCompany } from "@/contexts/CompanyContext";
import {
  useListCallNotices,
  useCreateCallNotice,
  useListCompanies,
  CallNotice,
  CallNoticeStatus,
  getListCallNoticesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { getToken } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Link } from "wouter";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  BookOpen,
  Plus,
  Search,
  X,
  ChevronRight,
  Calendar,
  Building2,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Upload,
  FileText,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

const PAGE_SIZE = 12;

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  criado: { label: "Criado", color: "bg-slate-100 text-slate-600" },
  edital_enviado: { label: "Edital Enviado", color: "bg-blue-100 text-blue-700" },
  edital_processando: { label: "Processando", color: "bg-blue-100 text-blue-700" },
  requisitos_extraidos: { label: "Requisitos Extraídos", color: "bg-indigo-100 text-indigo-700" },
  aguardando_documentos: { label: "Aguardando Docs", color: "bg-yellow-100 text-yellow-700" },
  documentos_enviados: { label: "Docs Enviados", color: "bg-orange-100 text-orange-700" },
  em_conferencia: { label: "Em Conferência", color: "bg-purple-100 text-purple-700" },
  pendencias_encontradas: { label: "Com Pendências", color: "bg-red-100 text-red-700" },
  pronto_para_submissao: { label: "Pronto p/ Submissão", color: "bg-emerald-100 text-emerald-700" },
  concluido: { label: "Concluído", color: "bg-green-100 text-green-700" },
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

function getDeadlineInfo(deadline: string | null | undefined) {
  if (!deadline) return null;
  const now = new Date();
  const d = new Date(deadline);
  const diffMs = d.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return { label: "Prazo encerrado", color: "bg-slate-100 text-slate-500" };
  if (diffDays === 0) return { label: "Hoje!", color: "bg-red-100 text-red-700" };
  if (diffDays <= 3) return { label: `${diffDays}d restante${diffDays !== 1 ? "s" : ""}`, color: "bg-red-100 text-red-700" };
  if (diffDays <= 7) return { label: `${diffDays}d restantes`, color: "bg-orange-100 text-orange-700" };
  if (diffDays <= 14) return { label: `${diffDays}d restantes`, color: "bg-yellow-100 text-yellow-700" };
  return { label: `${diffDays}d restantes`, color: "bg-green-100 text-green-700" };
}

function CallNoticeStatusBadge({ status }: { status: string }) {
  const info = STATUS_LABELS[status] ?? { label: status, color: "bg-slate-100 text-slate-600" };
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium", info.color)}>
      {info.label}
    </span>
  );
}

interface CreateCallNoticeForm {
  title: string;
  agency: string;
  referenceNumber: string;
  category: string;
  deadline: string;
  companyId: string;
}

type CreateMode = "manual" | "edital";

function CreateCallNoticeDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createMutation = useCreateCallNotice();
  const { data: companies } = useListCompanies();
  const { activeCompany } = useActiveCompany();
  const token = getToken();

  const [mode, setMode] = useState<CreateMode>("manual");
  const [editalFile, setEditalFile] = useState<File | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extracted, setExtracted] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const defaultCompanyId = activeCompany ? String(activeCompany.id) : "";

  const [form, setForm] = useState<CreateCallNoticeForm>({
    title: "",
    agency: "",
    referenceNumber: "",
    category: "",
    deadline: "",
    companyId: defaultCompanyId,
  });

  useEffect(() => {
    if (open) {
      setForm(f => ({ ...f, companyId: activeCompany ? String(activeCompany.id) : f.companyId }));
    }
  }, [open, activeCompany]);

  const resetAll = () => {
    setMode("manual");
    setEditalFile(null);
    setExtracting(false);
    setExtracted(false);
    setDragOver(false);
    setSubmitting(false);
    setForm({ title: "", agency: "", referenceNumber: "", category: "", deadline: "", companyId: activeCompany ? String(activeCompany.id) : "" });
  };

  const handleClose = () => {
    resetAll();
    onClose();
  };

  const handleFileSelect = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      toast({ title: "Apenas arquivos PDF são aceitos", variant: "destructive" });
      return;
    }
    setEditalFile(file);
    setExtracting(true);
    setExtracted(false);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/chamamentos/ai/extract-meta", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) throw new Error("Falha na extração");
      const data = await res.json();
      setForm(f => ({
        ...f,
        title: data.title ?? f.title,
        agency: data.agency ?? f.agency,
        referenceNumber: data.referenceNumber ?? f.referenceNumber,
        category: data.category ?? f.category,
        deadline: data.deadline ?? f.deadline,
      }));
      setExtracted(true);
    } catch {
      toast({ title: "Não foi possível extrair dados do edital", description: "Preencha os campos manualmente", variant: "destructive" });
      setExtracted(false);
    } finally {
      setExtracting(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.agency.trim()) return;
    setSubmitting(true);
    try {
      const notice = await createMutation.mutateAsync({
        data: {
          title: form.title.trim(),
          agency: form.agency.trim(),
          referenceNumber: form.referenceNumber.trim() || null,
          category: form.category || null,
          deadline: form.deadline || null,
          companyId: form.companyId ? parseInt(form.companyId) : null,
        },
      });

      if (editalFile && notice?.id) {
        const fd = new FormData();
        fd.append("file", editalFile);
        await fetch(`/api/chamamentos/${notice.id}/upload-edital`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        });
      }

      queryClient.invalidateQueries({ queryKey: getListCallNoticesQueryKey() });
      toast({ title: "Chamamento criado com sucesso" });
      handleClose();
    } catch {
      toast({ title: "Erro ao criar chamamento", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const isLoading = submitting || createMutation.isPending;
  const showForm = mode === "manual" || (mode === "edital" && (extracted || (editalFile && !extracting)));

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Chamamento Público</DialogTitle>
        </DialogHeader>

        <div className="flex gap-2 p-1 bg-slate-100 rounded-lg mb-2">
          <button
            type="button"
            onClick={() => { setMode("manual"); setEditalFile(null); setExtracted(false); }}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-all",
              mode === "manual" ? "bg-white shadow text-slate-900" : "text-slate-500 hover:text-slate-700"
            )}
          >
            Preencher manualmente
          </button>
          <button
            type="button"
            onClick={() => setMode("edital")}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-all",
              mode === "edital" ? "bg-white shadow text-slate-900" : "text-slate-500 hover:text-slate-700"
            )}
          >
            <Sparkles className="w-4 h-4" />
            Importar do Edital
          </button>
        </div>

        {mode === "edital" && (
          <div className="mb-3">
            {!editalFile ? (
              <label
                className={cn(
                  "flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-xl p-8 cursor-pointer transition-all",
                  dragOver ? "border-primary bg-primary/5" : "border-slate-200 hover:border-primary/50 hover:bg-slate-50"
                )}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
              >
                <input type="file" accept=".pdf" className="hidden" onChange={handleInputChange} />
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Upload className="w-6 h-6 text-primary" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-slate-700">Arraste o edital aqui ou clique para selecionar</p>
                  <p className="text-xs text-slate-400 mt-1">Somente arquivos PDF (máx. 50 MB)</p>
                </div>
              </label>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                {extracting ? (
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Loader2 className="w-5 h-5 text-primary animate-spin" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-700">Analisando edital com IA...</p>
                      <p className="text-xs text-slate-400">{editalFile.name}</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0", extracted ? "bg-green-100" : "bg-slate-100")}>
                      {extracted ? <CheckCircle2 className="w-5 h-5 text-green-600" /> : <FileText className="w-5 h-5 text-slate-500" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700 truncate">{editalFile.name}</p>
                      {extracted && <p className="text-xs text-green-600 font-medium">Dados extraídos com sucesso — revise abaixo</p>}
                    </div>
                    <button
                      type="button"
                      onClick={() => { setEditalFile(null); setExtracted(false); }}
                      className="text-slate-400 hover:text-slate-600 shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {(mode === "manual" || showForm) && !extracting && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {extracted && (
              <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <Sparkles className="w-3.5 h-3.5 shrink-0" />
                Campos pré-preenchidos pela IA — confira e corrija se necessário
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Objeto/Título *</label>
              <input
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Ex: Fomento a projetos culturais - 2026"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Órgão Promotor *</label>
              <input
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Ex: Secretaria Municipal de Cultura"
                value={form.agency}
                onChange={e => setForm(f => ({ ...f, agency: e.target.value }))}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Número de Referência</label>
                <input
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Ex: Chamamento 001/2026"
                  value={form.referenceNumber}
                  onChange={e => setForm(f => ({ ...f, referenceNumber: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Prazo de Inscrição</label>
                <input
                  type="datetime-local"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  value={form.deadline}
                  onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Área Temática</label>
              <select
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
              >
                <option value="">Selecione...</option>
                {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Empresa</label>
              <select
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white"
                value={form.companyId}
                onChange={e => setForm(f => ({ ...f, companyId: e.target.value }))}
              >
                <option value="">Sem empresa vinculada</option>
                {(companies ?? []).map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>Cancelar</Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {editalFile ? "Criar e Anexar Edital" : "Criar Chamamento"}
              </Button>
            </DialogFooter>
          </form>
        )}

        {mode === "edital" && !editalFile && (
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>Cancelar</Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

type StatusFilter = "all" | "com_pendencias" | "pronto" | "concluido";
type PrazoFilter = "all" | "vencidos" | "urgente" | "proximos" | "sem_prazo";

export function ChamamentosPage() {
  const { data: notices, isLoading } = useListCallNotices();
  const { activeCompany } = useActiveCompany();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [prazoFilter, setPrazoFilter] = useState<PrazoFilter>("all");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [activeCompany]);

  const filtered = useMemo(() => {
    if (!notices) return [];
    let result = notices;
    if (activeCompany) {
      result = result.filter(n => n.companyId === activeCompany.id);
    }

    if (statusFilter === "com_pendencias") {
      result = result.filter(n => n.status === "pendencias_encontradas");
    } else if (statusFilter === "pronto") {
      result = result.filter(n => n.status === "pronto_para_submissao");
    } else if (statusFilter === "concluido") {
      result = result.filter(n => n.status === "concluido");
    }

    if (prazoFilter !== "all") {
      const now = new Date();
      result = result.filter(n => {
        if (prazoFilter === "sem_prazo") return !n.deadline;
        if (!n.deadline) return false;
        const d = new Date(n.deadline);
        const diffDays = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (prazoFilter === "vencidos") return diffDays < 0;
        if (prazoFilter === "urgente") return diffDays >= 0 && diffDays <= 7;
        if (prazoFilter === "proximos") return diffDays > 7 && diffDays <= 30;
        return false;
      });
    }

    const q = search.toLowerCase().trim();
    if (q) {
      result = result.filter(
        n =>
          n.title.toLowerCase().includes(q) ||
          n.agency.toLowerCase().includes(q) ||
          (n.referenceNumber?.toLowerCase().includes(q) ?? false) ||
          (n.category?.toLowerCase().includes(q) ?? false)
      );
    }

    return result;
  }, [notices, search, statusFilter, prazoFilter, activeCompany]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const companyNotices = useMemo(() => {
    if (!notices) return [];
    if (activeCompany) return notices.filter(n => n.companyId === activeCompany.id);
    return notices;
  }, [notices, activeCompany]);

  const stats = useMemo(() => {
    return {
      total: companyNotices.length,
      comPendencias: companyNotices.filter(n => n.status === "pendencias_encontradas").length,
      prontos: companyNotices.filter(n => n.status === "pronto_para_submissao").length,
      concluidos: companyNotices.filter(n => n.status === "concluido").length,
    };
  }, [companyNotices]);

  return (
    <AppLayout>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-slate-900">Chamamentos Públicos</h1>
          <p className="text-slate-600 mt-1">Gerencie a participação da sua OSC em chamamentos públicos</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} className="shrink-0">
          <Plus className="w-4 h-4 mr-2" />
          Novo Chamamento
        </Button>
      </div>

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <button
            onClick={() => { setStatusFilter("all"); setPage(1); }}
            className={cn(
              "rounded-xl border p-4 text-left transition-all",
              statusFilter === "all" ? "border-primary bg-primary/5" : "bg-white hover:bg-slate-50"
            )}
          >
            <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
            <p className="text-sm text-slate-500">Total</p>
          </button>
          <button
            onClick={() => { setStatusFilter("com_pendencias"); setPage(1); }}
            className={cn(
              "rounded-xl border p-4 text-left transition-all",
              statusFilter === "com_pendencias" ? "border-red-400 bg-red-50" : "bg-white hover:bg-slate-50"
            )}
          >
            <p className="text-2xl font-bold text-red-600">{stats.comPendencias}</p>
            <p className="text-sm text-slate-500">Com Pendências</p>
          </button>
          <button
            onClick={() => { setStatusFilter("pronto"); setPage(1); }}
            className={cn(
              "rounded-xl border p-4 text-left transition-all",
              statusFilter === "pronto" ? "border-emerald-400 bg-emerald-50" : "bg-white hover:bg-slate-50"
            )}
          >
            <p className="text-2xl font-bold text-emerald-600">{stats.prontos}</p>
            <p className="text-sm text-slate-500">Prontos p/ Submissão</p>
          </button>
          <button
            onClick={() => { setStatusFilter("concluido"); setPage(1); }}
            className={cn(
              "rounded-xl border p-4 text-left transition-all",
              statusFilter === "concluido" ? "border-green-400 bg-green-50" : "bg-white hover:bg-slate-50"
            )}
          >
            <p className="text-2xl font-bold text-green-600">{stats.concluidos}</p>
            <p className="text-sm text-slate-500">Concluídos</p>
          </button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por título, órgão, referência..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-8 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="w-3.5 h-3.5 text-slate-400" />
            </button>
          )}
        </div>
        <select
          value={prazoFilter}
          onChange={e => { setPrazoFilter(e.target.value as PrazoFilter); setPage(1); }}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary bg-white"
        >
          <option value="all">Todos os prazos</option>
          <option value="urgente">Urgente (até 7 dias)</option>
          <option value="proximos">Próximos (8–30 dias)</option>
          <option value="vencidos">Prazo vencido</option>
          <option value="sem_prazo">Sem prazo definido</option>
        </select>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-100 p-5 animate-pulse h-40" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-700 mb-2">
            {notices?.length === 0 ? "Nenhum chamamento cadastrado" : "Nenhum resultado encontrado"}
          </h3>
          <p className="text-slate-500 text-sm mb-6">
            {notices?.length === 0
              ? "Clique em \"Novo Chamamento\" para começar"
              : "Tente ajustar os filtros ou a busca"}
          </p>
          {notices?.length === 0 && (
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Novo Chamamento
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {paginated.map((notice, i) => {
              const deadlineInfo = getDeadlineInfo(notice.deadline);
              const statusInfo = STATUS_LABELS[notice.status] ?? { label: notice.status, color: "bg-slate-100 text-slate-600" };
              const categoryLabel = notice.category ? CATEGORY_LABELS[notice.category] : null;

              return (
                <motion.div
                  key={notice.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <Link href={`/chamamentos/${notice.id}`}>
                    <Card className="p-5 hover:shadow-md hover:border-primary/30 transition-all cursor-pointer group h-full flex flex-col">
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                          <BookOpen className="w-4 h-4 text-indigo-600" />
                        </div>
                        <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium", statusInfo.color)}>
                          {statusInfo.label}
                        </span>
                      </div>

                      <h3 className="font-semibold text-slate-900 text-sm leading-snug mb-1 line-clamp-2 flex-1">
                        {notice.title}
                      </h3>

                      {notice.companyName && (
                        <p className="text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full inline-block mb-1">
                          {notice.companyName}
                        </p>
                      )}

                      <div className="space-y-1.5 mt-2">
                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                          <Building2 className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{notice.agency}</span>
                        </div>
                        {notice.referenceNumber && (
                          <div className="flex items-center gap-1.5 text-xs text-slate-500">
                            <span className="font-mono">{notice.referenceNumber}</span>
                          </div>
                        )}
                        {categoryLabel && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">{categoryLabel}</span>
                          </div>
                        )}
                        {notice.deadline && (
                          <div className="flex items-center gap-1.5 text-xs text-slate-500">
                            <Calendar className="w-3.5 h-3.5 shrink-0" />
                            <span>
                              {format(new Date(notice.deadline), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                            </span>
                            {deadlineInfo && (
                              <span className={cn("px-1.5 py-0.5 rounded-full text-[10px] font-medium", deadlineInfo.color)}>
                                {deadlineInfo.label}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-xs text-slate-400">
                          {format(new Date(notice.createdAt), "dd/MM/yyyy", { locale: ptBR })}
                        </span>
                        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-primary transition-colors" />
                      </div>
                    </Card>
                  </Link>
                </motion.div>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Anterior
              </Button>
              <span className="text-sm text-slate-600">
                Página {page} de {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Próxima
              </Button>
            </div>
          )}
        </>
      )}

      <CreateCallNoticeDialog open={showCreateDialog} onClose={() => setShowCreateDialog(false)} />
    </AppLayout>
  );
}

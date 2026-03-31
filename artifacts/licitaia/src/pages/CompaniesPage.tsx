import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
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
import {
  Building2,
  Plus,
  Search,
  X,
  ChevronRight,
  Loader2,
  FileWarning,
  CheckCircle2,
  AlertTriangle,
  FileX,
  FileCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { getToken } from "@/hooks/use-auth";

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");

interface CompanyListItem {
  id: number;
  razaoSocial: string;
  nomeFantasia: string | null;
  cnpj: string;
  email: string | null;
  telefone: string | null;
  documentStatus: "regular" | "vencendo" | "vencido" | "sem_documentos";
  documentCount: number;
  createdAt: string;
  updatedAt: string;
}

type DocStatusFilter = "all" | "regular" | "vencendo" | "vencido" | "sem_documentos";

const DOC_STATUS_INFO: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  regular: { label: "Regular", color: "bg-green-100 text-green-700", icon: CheckCircle2 },
  vencendo: { label: "Vencendo em breve", color: "bg-yellow-100 text-yellow-700", icon: AlertTriangle },
  vencido: { label: "Doc. vencido", color: "bg-red-100 text-red-700", icon: FileX },
  sem_documentos: { label: "Sem documentos", color: "bg-slate-100 text-slate-500", icon: FileWarning },
};

interface CreateCompanyForm {
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  email: string;
  telefone: string;
  endereco: string;
  inscricaoEstadual: string;
  inscricaoMunicipal: string;
  representanteLegal: string;
  observacoes: string;
}

const emptyForm: CreateCompanyForm = {
  razaoSocial: "",
  nomeFantasia: "",
  cnpj: "",
  email: "",
  telefone: "",
  endereco: "",
  inscricaoEstadual: "",
  inscricaoMunicipal: "",
  representanteLegal: "",
  observacoes: "",
};

function CreateCompanyDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const token = getToken();
  const [form, setForm] = useState<CreateCompanyForm>(emptyForm);

  const createMutation = useMutation({
    mutationFn: async (data: CreateCompanyForm) => {
      const res = await fetch(`${BASE_URL}/api/companies`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          razaoSocial: data.razaoSocial.trim(),
          nomeFantasia: data.nomeFantasia.trim() || null,
          cnpj: data.cnpj.trim(),
          email: data.email.trim() || null,
          telefone: data.telefone.trim() || null,
          endereco: data.endereco.trim() || null,
          inscricaoEstadual: data.inscricaoEstadual.trim() || null,
          inscricaoMunicipal: data.inscricaoMunicipal.trim() || null,
          representanteLegal: data.representanteLegal.trim() || null,
          observacoes: data.observacoes.trim() || null,
        }),
      });
      if (!res.ok) throw new Error("Erro ao criar empresa");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      toast({ title: "Empresa criada com sucesso" });
      setForm(emptyForm);
      onClose();
    },
    onError: () => {
      toast({ title: "Erro ao criar empresa", variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.razaoSocial.trim() || !form.cnpj.trim()) return;
    createMutation.mutate(form);
  };

  const field = (
    label: string,
    key: keyof CreateCompanyForm,
    opts?: { required?: boolean; placeholder?: string; type?: string }
  ) => (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">
        {label}{opts?.required && " *"}
      </label>
      <input
        type={opts?.type ?? "text"}
        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        placeholder={opts?.placeholder ?? ""}
        value={form[key]}
        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        required={opts?.required}
      />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Empresa</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          {field("Razão Social", "razaoSocial", { required: true, placeholder: "Nome Ltda." })}
          {field("Nome Fantasia", "nomeFantasia", { placeholder: "Nome comercial" })}
          {field("CNPJ", "cnpj", { required: true, placeholder: "00.000.000/0000-00" })}
          <div className="grid grid-cols-2 gap-3">
            {field("E-mail", "email", { placeholder: "contato@empresa.com.br" })}
            {field("Telefone", "telefone", { placeholder: "(11) 99999-9999" })}
          </div>
          {field("Endereço", "endereco", { placeholder: "Rua, número, bairro, cidade - UF" })}
          <div className="grid grid-cols-2 gap-3">
            {field("Inscrição Estadual", "inscricaoEstadual", { placeholder: "IE" })}
            {field("Inscrição Municipal", "inscricaoMunicipal", { placeholder: "IM" })}
          </div>
          {field("Representante Legal", "representanteLegal", { placeholder: "Nome completo" })}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Observações</label>
            <textarea
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              rows={3}
              placeholder="Notas internas..."
              value={form.observacoes}
              onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Criar Empresa
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CompaniesPage() {
  const token = getToken();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<DocStatusFilter>("all");
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const { data: companies, isLoading } = useQuery<CompanyListItem[]>({
    queryKey: ["companies"],
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}/api/companies`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Erro ao carregar empresas");
      return res.json();
    },
  });

  const stats = useMemo(() => {
    if (!companies) return null;
    return {
      total: companies.length,
      regular: companies.filter(c => c.documentStatus === "regular").length,
      vencendo: companies.filter(c => c.documentStatus === "vencendo").length,
      vencido: companies.filter(c => c.documentStatus === "vencido").length,
      semDocumentos: companies.filter(c => c.documentStatus === "sem_documentos").length,
    };
  }, [companies]);

  const filtered = useMemo(() => {
    if (!companies) return [];
    let result = companies;

    if (statusFilter !== "all") {
      result = result.filter(c => c.documentStatus === statusFilter);
    }

    const q = search.toLowerCase().trim();
    if (q) {
      result = result.filter(
        c =>
          c.razaoSocial.toLowerCase().includes(q) ||
          c.cnpj.replace(/\D/g, "").includes(q.replace(/\D/g, "")) ||
          (c.nomeFantasia?.toLowerCase().includes(q) ?? false)
      );
    }

    return result;
  }, [companies, search, statusFilter]);

  return (
    <AppLayout>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-slate-900">Empresas</h1>
          <p className="text-slate-500 mt-1">Gerencie a carteira de empresas e seus documentos.</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} className="shrink-0">
          <Plus className="w-4 h-4 mr-2" />
          Nova Empresa
        </Button>
      </div>

      {stats && stats.total > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <button
            onClick={() => setStatusFilter("all")}
            className={cn(
              "rounded-xl border p-4 text-left transition-all",
              statusFilter === "all" ? "border-primary bg-primary/5" : "bg-white hover:bg-slate-50"
            )}
          >
            <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
            <p className="text-sm text-slate-500">Total</p>
          </button>
          <button
            onClick={() => setStatusFilter("vencido")}
            className={cn(
              "rounded-xl border p-4 text-left transition-all",
              statusFilter === "vencido" ? "border-red-400 bg-red-50" : "bg-white hover:bg-slate-50"
            )}
          >
            <p className="text-2xl font-bold text-red-600">{stats.vencido}</p>
            <p className="text-sm text-slate-500">Doc. Vencido</p>
          </button>
          <button
            onClick={() => setStatusFilter("vencendo")}
            className={cn(
              "rounded-xl border p-4 text-left transition-all",
              statusFilter === "vencendo" ? "border-yellow-400 bg-yellow-50" : "bg-white hover:bg-slate-50"
            )}
          >
            <p className="text-2xl font-bold text-yellow-600">{stats.vencendo}</p>
            <p className="text-sm text-slate-500">Vencendo em Breve</p>
          </button>
          <button
            onClick={() => setStatusFilter("regular")}
            className={cn(
              "rounded-xl border p-4 text-left transition-all",
              statusFilter === "regular" ? "border-green-400 bg-green-50" : "bg-white hover:bg-slate-50"
            )}
          >
            <p className="text-2xl font-bold text-green-600">{stats.regular}</p>
            <p className="text-sm text-slate-500">Regular</p>
          </button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por razão social ou CNPJ..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-8 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="w-3.5 h-3.5 text-slate-400" />
            </button>
          )}
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as DocStatusFilter)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary bg-white"
        >
          <option value="all">Todos os status</option>
          <option value="regular">Regular</option>
          <option value="vencendo">Vencendo em breve</option>
          <option value="vencido">Doc. vencido</option>
          <option value="sem_documentos">Sem documentos</option>
        </select>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-100 p-5 animate-pulse h-36" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-700 mb-2">
            {companies?.length === 0 ? "Nenhuma empresa cadastrada" : "Nenhum resultado encontrado"}
          </h3>
          <p className="text-slate-500 text-sm mb-6">
            {companies?.length === 0
              ? "Clique em \"Nova Empresa\" para começar"
              : "Tente ajustar os filtros ou a busca"}
          </p>
          {companies?.length === 0 && (
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Nova Empresa
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((company, i) => {
            const statusInfo = DOC_STATUS_INFO[company.documentStatus] ?? DOC_STATUS_INFO.sem_documentos!;
            const StatusIcon = statusInfo.icon;

            return (
              <motion.div
                key={company.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
              >
                <Link href={`/companies/${company.id}`}>
                  <Card className="p-5 hover:shadow-md hover:border-primary/30 transition-all cursor-pointer group h-full flex flex-col">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                        <Building2 className="w-5 h-5 text-blue-600" />
                      </div>
                      <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium", statusInfo.color)}>
                        <StatusIcon className="w-3 h-3" />
                        {statusInfo.label}
                      </span>
                    </div>

                    <h3 className="font-semibold text-slate-900 text-sm leading-snug mb-0.5 line-clamp-2">
                      {company.razaoSocial}
                    </h3>
                    {company.nomeFantasia && (
                      <p className="text-xs text-slate-400 mb-1">{company.nomeFantasia}</p>
                    )}

                    <p className="text-xs font-mono text-slate-500 mb-3">{company.cnpj}</p>

                    <div className="mt-auto pt-3 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-xs text-slate-400">
                        {company.documentCount} doc{company.documentCount !== 1 ? "s" : ""}
                      </span>
                      <div className="flex items-center gap-1 text-xs text-primary font-medium group-hover:underline">
                        Acessar
                        <ChevronRight className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </Card>
                </Link>
              </motion.div>
            );
          })}
        </div>
      )}

      <CreateCompanyDialog open={showCreateDialog} onClose={() => setShowCreateDialog(false)} />
    </AppLayout>
  );
}

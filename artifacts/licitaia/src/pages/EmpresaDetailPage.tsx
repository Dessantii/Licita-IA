import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Link, useRoute, useLocation } from "wouter";
import {
  useGetCompany,
  useUpdateCompany,
  useDeleteCompany,
  getListCompaniesQueryKey,
  getGetCompanyQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  Mail,
  Phone,
  MapPin,
  FileText,
  BookOpen,
  Pencil,
  Trash2,
  Loader2,
  Hash,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

const PROCESS_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  criado: { label: "Criado", color: "bg-slate-100 text-slate-600" },
  edital_enviado: { label: "Edital Enviado", color: "bg-blue-100 text-blue-700" },
  edital_processando: { label: "Processando", color: "bg-blue-100 text-blue-700" },
  exigencias_extraidas: { label: "Exigências Extraídas", color: "bg-indigo-100 text-indigo-700" },
  aguardando_documentos: { label: "Aguardando Docs", color: "bg-yellow-100 text-yellow-700" },
  documentos_enviados: { label: "Docs Enviados", color: "bg-orange-100 text-orange-700" },
  em_conferencia: { label: "Em Conferência", color: "bg-purple-100 text-purple-700" },
  pendencias_encontradas: { label: "Com Pendências", color: "bg-red-100 text-red-700" },
  pronto_para_revisao: { label: "Pronto p/ Revisão", color: "bg-emerald-100 text-emerald-700" },
  concluido: { label: "Concluído", color: "bg-green-100 text-green-700" },
};

const CALL_STATUS_LABELS: Record<string, { label: string; color: string }> = {
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

type Tab = "processos" | "chamamentos";

export function EmpresaDetailPage() {
  const [, params] = useRoute("/empresas/:id");
  const [, navigate] = useLocation();
  const id = Number(params?.id);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: company, isLoading } = useGetCompany(id);
  const updateMutation = useUpdateCompany();
  const deleteMutation = useDeleteCompany();

  const [activeTab, setActiveTab] = useState<Tab>("processos");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    cnpj: "",
    email: "",
    phone: "",
    address: "",
    notes: "",
  });

  const openEdit = () => {
    if (!company) return;
    setEditForm({
      name: company.name,
      cnpj: company.cnpj ?? "",
      email: company.email ?? "",
      phone: company.phone ?? "",
      address: company.address ?? "",
      notes: company.notes ?? "",
    });
    setEditOpen(true);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateMutation.mutateAsync({
        id,
        data: {
          name: editForm.name.trim(),
          cnpj: editForm.cnpj.trim() || null,
          email: editForm.email.trim() || null,
          phone: editForm.phone.trim() || null,
          address: editForm.address.trim() || null,
          notes: editForm.notes.trim() || null,
        },
      });
      queryClient.invalidateQueries({ queryKey: getGetCompanyQueryKey(id) });
      queryClient.invalidateQueries({ queryKey: getListCompaniesQueryKey() });
      toast({ title: "Empresa atualizada" });
      setEditOpen(false);
    } catch {
      toast({ title: "Erro ao atualizar empresa", variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getListCompaniesQueryKey() });
      toast({ title: "Empresa excluída" });
      navigate("/empresas");
    } catch {
      toast({ title: "Erro ao excluir empresa", variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!company) {
    return (
      <AppLayout>
        <div className="text-center py-16 text-slate-500">Empresa não encontrada</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mb-6">
        <div className="flex items-center gap-1.5 text-sm text-slate-500 mb-4 font-medium">
          <Link href="/empresas" className="hover:text-primary transition-colors">
            Empresas
          </Link>
          <ChevronRight className="w-4 h-4" />
          <span className="text-slate-900 truncate max-w-xs">{company.name}</span>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center shrink-0">
              <Building2 className="w-7 h-7 text-emerald-600" />
            </div>
            <div>
              <h1 className="text-2xl lg:text-3xl font-display font-bold text-slate-900 mb-1">
                {company.name}
              </h1>
              <div className="flex flex-wrap gap-3 text-sm text-slate-500">
                {company.cnpj && (
                  <span className="flex items-center gap-1.5">
                    <Hash className="w-4 h-4" />
                    {company.cnpj}
                  </span>
                )}
                {company.email && (
                  <span className="flex items-center gap-1.5">
                    <Mail className="w-4 h-4" />
                    {company.email}
                  </span>
                )}
                {company.phone && (
                  <span className="flex items-center gap-1.5">
                    <Phone className="w-4 h-4" />
                    {company.phone}
                  </span>
                )}
                {company.address && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-4 h-4" />
                    {company.address}
                  </span>
                )}
              </div>
              {company.notes && (
                <p className="text-sm text-slate-500 mt-2 italic">{company.notes}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={openEdit}>
              <Pencil className="w-4 h-4 mr-2" />
              Editar
            </Button>
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

      <div className="flex gap-1 border-b border-slate-200 mb-6">
        <button
          onClick={() => setActiveTab("processos")}
          className={cn(
            "px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px flex items-center gap-2",
            activeTab === "processos"
              ? "border-primary text-primary"
              : "border-transparent text-slate-500 hover:text-slate-800"
          )}
        >
          <FileText className="w-4 h-4" />
          Licitações
          <span className="bg-slate-100 text-slate-600 text-xs px-1.5 py-0.5 rounded-full">
            {company.processes.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab("chamamentos")}
          className={cn(
            "px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px flex items-center gap-2",
            activeTab === "chamamentos"
              ? "border-primary text-primary"
              : "border-transparent text-slate-500 hover:text-slate-800"
          )}
        >
          <BookOpen className="w-4 h-4" />
          Chamamentos
          <span className="bg-slate-100 text-slate-600 text-xs px-1.5 py-0.5 rounded-full">
            {company.callNotices.length}
          </span>
        </button>
      </div>

      {activeTab === "processos" && (
        <>
          {company.processes.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-300">
              <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="font-semibold text-slate-700">Nenhuma licitação vinculada</p>
              <p className="text-sm text-slate-500 mt-1">
                Vincule esta empresa ao criar ou editar um processo.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {company.processes.map(process => {
                const statusInfo = PROCESS_STATUS_LABELS[process.status] ?? { label: process.status, color: "bg-slate-100 text-slate-600" };
                return (
                  <Link key={process.id} href={`/processes/${process.id}`}>
                    <Card className="p-4 hover:shadow-md hover:border-primary/30 transition-all group cursor-pointer">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                            <FileText className="w-4 h-4 text-slate-500" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900 text-sm truncate group-hover:text-primary transition-colors">
                              {process.title}
                            </p>
                            <p className="text-xs text-slate-500 truncate">
                              {process.agency} • {process.modality}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium", statusInfo.color)}>
                            {statusInfo.label}
                          </span>
                          <span className="text-xs text-slate-400">
                            {format(new Date(process.createdAt), "dd/MM/yyyy", { locale: ptBR })}
                          </span>
                          <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-primary transition-colors" />
                        </div>
                      </div>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </>
      )}

      {activeTab === "chamamentos" && (
        <>
          {company.callNotices.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-300">
              <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="font-semibold text-slate-700">Nenhum chamamento vinculado</p>
              <p className="text-sm text-slate-500 mt-1">
                Vincule esta empresa ao criar ou editar um chamamento.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {company.callNotices.map(notice => {
                const statusInfo = CALL_STATUS_LABELS[notice.status] ?? { label: notice.status, color: "bg-slate-100 text-slate-600" };
                return (
                  <Link key={notice.id} href={`/chamamentos/${notice.id}`}>
                    <Card className="p-4 hover:shadow-md hover:border-primary/30 transition-all group cursor-pointer">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                            <BookOpen className="w-4 h-4 text-indigo-500" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900 text-sm truncate group-hover:text-primary transition-colors">
                              {notice.title}
                            </p>
                            <p className="text-xs text-slate-500 truncate">
                              {notice.agency}
                              {notice.referenceNumber ? ` • ${notice.referenceNumber}` : ""}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium", statusInfo.color)}>
                            {statusInfo.label}
                          </span>
                          <span className="text-xs text-slate-400">
                            {format(new Date(notice.createdAt), "dd/MM/yyyy", { locale: ptBR })}
                          </span>
                          <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-primary transition-colors" />
                        </div>
                      </div>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </>
      )}

      <Dialog open={editOpen} onOpenChange={v => !v && setEditOpen(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Empresa</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nome / Razão Social *</label>
              <input
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                value={editForm.name}
                onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">CNPJ</label>
                <input
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="00.000.000/0000-00"
                  value={editForm.cnpj}
                  onChange={e => setEditForm(f => ({ ...f, cnpj: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Telefone</label>
                <input
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  value={editForm.phone}
                  onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">E-mail</label>
              <input
                type="email"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                value={editForm.email}
                onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Endereço</label>
              <input
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                value={editForm.address}
                onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Observações</label>
              <textarea
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                rows={2}
                value={editForm.notes}
                onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir empresa?</AlertDialogTitle>
            <AlertDialogDescription>
              A empresa "{company.name}" será excluída permanentemente. Os processos e chamamentos vinculados perderão o vínculo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}

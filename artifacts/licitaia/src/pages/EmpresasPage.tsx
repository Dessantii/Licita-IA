import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  useListCompanies,
  useCreateCompany,
  useDeleteCompany,
  getListCompaniesQueryKey,
  Company,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
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
import { Link } from "wouter";
import {
  Building2,
  Plus,
  Search,
  X,
  ChevronRight,
  Loader2,
  Trash2,
  Phone,
  Mail,
  FileText,
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface CreateCompanyForm {
  name: string;
  cnpj: string;
  email: string;
  phone: string;
  address: string;
  notes: string;
}

function CreateCompanyDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createMutation = useCreateCompany();
  const [form, setForm] = useState<CreateCompanyForm>({
    name: "",
    cnpj: "",
    email: "",
    phone: "",
    address: "",
    notes: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    try {
      await createMutation.mutateAsync({
        data: {
          name: form.name.trim(),
          cnpj: form.cnpj.trim() || null,
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          address: form.address.trim() || null,
          notes: form.notes.trim() || null,
        },
      });
      queryClient.invalidateQueries({ queryKey: getListCompaniesQueryKey() });
      toast({ title: "Empresa cadastrada com sucesso" });
      onClose();
      setForm({ name: "", cnpj: "", email: "", phone: "", address: "", notes: "" });
    } catch {
      toast({ title: "Erro ao cadastrar empresa", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova Empresa</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nome / Razão Social *</label>
            <input
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Ex: Associação Cultural ABC"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">CNPJ</label>
              <input
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="00.000.000/0000-00"
                value={form.cnpj}
                onChange={e => setForm(f => ({ ...f, cnpj: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Telefone</label>
              <input
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="(00) 00000-0000"
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">E-mail</label>
            <input
              type="email"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="contato@empresa.org"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Endereço</label>
            <input
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Rua, número, bairro, cidade"
              value={form.address}
              onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Observações</label>
            <textarea
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              placeholder="Notas internas sobre a empresa..."
              rows={2}
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Cadastrar Empresa
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function EmpresasPage() {
  const { data: companies, isLoading } = useListCompanies();
  const deleteMutation = useDeleteCompany();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Company | null>(null);

  const filtered = (companies ?? []).filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.cnpj?.includes(search) ?? false)
  );

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync({ id: deleteTarget.id });
      queryClient.invalidateQueries({ queryKey: getListCompaniesQueryKey() });
      toast({ title: "Empresa excluída" });
    } catch {
      toast({ title: "Erro ao excluir empresa", variant: "destructive" });
    }
    setDeleteTarget(null);
  };

  return (
    <AppLayout>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-slate-900">Empresas</h1>
          <p className="text-slate-500 mt-1">Gerencie as empresas vinculadas aos processos e chamamentos.</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} className="shrink-0">
          <Plus className="w-4 h-4 mr-2" />
          Nova Empresa
        </Button>
      </div>

      {(companies?.length ?? 0) > 0 && (
        <div className="relative mb-6">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nome ou CNPJ..."
            className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-10 py-2.5 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary/30 outline-none"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Card key={i} className="h-36 animate-pulse bg-slate-100/50" />
          ))}
        </div>
      ) : companies?.length === 0 ? (
        <div className="text-center py-24 bg-white rounded-2xl border border-dashed border-slate-300">
          <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">Nenhuma empresa cadastrada</h3>
          <p className="text-slate-500 mt-1 max-w-sm mx-auto mb-6">
            Cadastre uma empresa para vinculá-la a processos e chamamentos.
          </p>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Nova Empresa
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
          <Search className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="font-semibold text-slate-700">Nenhuma empresa encontrada</p>
          <button onClick={() => setSearch("")} className="mt-2 text-sm text-primary font-semibold hover:underline">
            Limpar busca
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((company, i) => (
            <motion.div
              key={company.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              <Card className="p-5 hover:shadow-md hover:border-primary/30 transition-all group flex flex-col">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                    <Building2 className="w-5 h-5 text-emerald-600" />
                  </div>
                  <button
                    onClick={() => setDeleteTarget(company)}
                    className="p-1 text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <Link href={`/empresas/${company.id}`} className="flex-1">
                  <h3 className="font-bold text-slate-900 text-sm leading-snug mb-1 group-hover:text-primary transition-colors">
                    {company.name}
                  </h3>
                  {company.cnpj && (
                    <p className="text-xs text-slate-500 font-mono mb-2">{company.cnpj}</p>
                  )}

                  <div className="space-y-1 mt-2">
                    {company.email && (
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <Mail className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{company.email}</span>
                      </div>
                    )}
                    {company.phone && (
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <Phone className="w-3.5 h-3.5 shrink-0" />
                        <span>{company.phone}</span>
                      </div>
                    )}
                  </div>
                </Link>

                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <Link
                    href={`/empresas/${company.id}`}
                    className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Ver processos
                    <ChevronRight className="w-3 h-3" />
                  </Link>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      <CreateCompanyDialog open={showCreateDialog} onClose={() => setShowCreateDialog(false)} />

      <AlertDialog open={!!deleteTarget} onOpenChange={v => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir empresa?</AlertDialogTitle>
            <AlertDialogDescription>
              A empresa "{deleteTarget?.name}" será excluída. Os processos e chamamentos vinculados a ela não serão afetados, mas perderão o vínculo.
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

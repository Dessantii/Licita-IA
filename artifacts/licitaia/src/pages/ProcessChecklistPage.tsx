import { AppLayout } from "@/components/layout/AppLayout";
import { Link, useRoute } from "wouter";
import { useGetProcess, ValidationItemStatus, ValidationItem } from "@workspace/api-client-react";
import { useAppActions } from "@/hooks/use-app-actions";
import { ValidationStatusBadge } from "@/components/processes/ValidationStatusBadge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger 
} from "@/components/ui/dialog";
import { 
  CheckCircle2, XCircle, AlertCircle, Clock, Info, ChevronLeft, Filter, Search, FileText, Download 
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export function ProcessChecklistPage() {
  const [, params] = useRoute("/processes/:id/checklist");
  const id = Number(params?.id);
  const { data: process, isLoading } = useGetProcess(id);
  
  const [filter, setFilter] = useState<ValidationItemStatus | 'all'>('all');
  const [search, setSearch] = useState('');

  if (isLoading || !process) return <AppLayout><div className="p-8">Carregando checklist...</div></AppLayout>;

  const filteredItems = process.validationItems.filter(item => {
    if (filter !== 'all' && item.status !== filter) return false;
    if (search && !item.requirement.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const stats = {
    ok: process.validationItems.filter(i => i.status === ValidationItemStatus.ok).length,
    faltando: process.validationItems.filter(i => i.status === ValidationItemStatus.faltando).length,
    vencido: process.validationItems.filter(i => i.status === ValidationItemStatus.vencido).length,
    divergente: process.validationItems.filter(i => i.status === ValidationItemStatus.divergente).length,
    revisar: process.validationItems.filter(i => i.status === ValidationItemStatus.revisar).length,
    total: process.validationItems.length
  };

  return (
    <AppLayout>
      <div className="mb-6">
        <Link href={`/processes/${id}`} className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-primary mb-4 transition-colors">
          <ChevronLeft className="w-4 h-4 mr-1" /> Voltar ao Processo
        </Link>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-slate-900">Lista de documentos</h1>
            <p className="text-slate-600 mt-1 font-medium">{process.title}</p>
          </div>
          {process.report && (
            <Button variant="outline" className="shrink-0 bg-white">
              <Download className="w-4 h-4 mr-2" />
              Baixar Relatório Final
            </Button>
          )}
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2 mb-6">
        <StatCard label="Todos" count={stats.total} color="bg-slate-100 text-slate-800" onClick={() => setFilter('all')} active={filter === 'all'} />
        <StatCard label="Tudo certo" count={stats.ok} color="bg-emerald-100 text-emerald-800 border-emerald-200" onClick={() => setFilter(ValidationItemStatus.ok)} active={filter === ValidationItemStatus.ok} icon={CheckCircle2} />
        <StatCard label="Falta enviar" count={stats.faltando} color="bg-red-100 text-red-800 border-red-200" onClick={() => setFilter(ValidationItemStatus.faltando)} active={filter === ValidationItemStatus.faltando} icon={XCircle} />
        <StatCard label="Prazo vencido" count={stats.vencido} color="bg-orange-100 text-orange-800 border-orange-200" onClick={() => setFilter(ValidationItemStatus.vencido)} active={filter === ValidationItemStatus.vencido} icon={Clock} />
        <StatCard label="Parece diferente" count={stats.divergente} color="bg-amber-100 text-amber-800 border-amber-200" onClick={() => setFilter(ValidationItemStatus.divergente)} active={filter === ValidationItemStatus.divergente} icon={AlertCircle} />
        <StatCard label="Conferir" count={stats.revisar} color="bg-blue-100 text-blue-800 border-blue-200" onClick={() => setFilter(ValidationItemStatus.revisar)} active={filter === ValidationItemStatus.revisar} icon={Info} />
      </div>

      <Card className="overflow-hidden">
        <div className="p-4 border-b bg-slate-50 flex flex-col sm:flex-row gap-4 justify-between items-center">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Buscar documento..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white"
            />
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-500 font-medium">
            <Filter className="w-4 h-4" />
            Filtrando {filteredItems.length} de {stats.total}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-slate-100 text-slate-600 font-bold uppercase tracking-wider text-xs border-b">
              <tr>
                <th className="p-4">Situação</th>
                <th className="p-4 w-1/2">O que o edital pede</th>
                <th className="p-4">Documento enviado</th>
                <th className="p-4 text-center">Ajustar</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredItems.length === 0 ? (
                <tr><td colSpan={4} className="p-8 text-center text-slate-500">Nenhum item corresponde ao filtro.</td></tr>
              ) : (
                filteredItems.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-4 align-top pt-5">
                      <ValidationStatusBadge status={item.status} />
                    </td>
                    <td className="p-4 align-top">
                      <div className="flex items-start gap-2">
                        {item.requirement.mandatory && <span className="shrink-0 bg-red-100 text-red-700 text-[10px] font-bold px-1.5 py-0.5 rounded">NECESSÁRIO</span>}
                        <div>
                          <p className="font-bold text-slate-900 leading-snug">{item.requirement.title}</p>
                          {item.requirement.description && <p className="text-slate-600 mt-1 text-xs leading-relaxed">{item.requirement.description}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="p-4 align-top">
                      {item.submittedDocument ? (
                        <div className="bg-white border rounded p-3 shadow-sm">
                          <p className="font-medium text-slate-900 flex items-center gap-2">
                            <FileText className="w-3.5 h-3.5 text-blue-500" />
                            {process.documentFiles.find(f => f.id === item.submittedDocument?.fileId)?.name || 'Arquivo'}
                          </p>
                          <div className="mt-2 space-y-1">
                            {item.submittedDocument.detectedType && <p className="text-xs text-slate-500"><span className="font-semibold text-slate-700">Tipo:</span> {item.submittedDocument.detectedType}</p>}
                            {item.submittedDocument.detectedValidity && <p className="text-xs text-slate-500"><span className="font-semibold text-slate-700">Validade:</span> {item.submittedDocument.detectedValidity}</p>}
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">Nenhum documento associado.</span>
                      )}
                      {item.notes && (
                        <div className="mt-2 p-2 bg-amber-50 border border-amber-100 rounded text-amber-800 text-xs">
                          <span className="font-bold">Nota da IA:</span> {item.notes}
                        </div>
                      )}
                    </td>
                    <td className="p-4 align-top text-center pt-5">
                      <EditValidationDialog item={item} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
      
      {process.report && (
        <div className="mt-8 mb-12">
          <h2 className="text-xl font-display font-bold text-slate-900 mb-4">Parecer Final</h2>
          <Card className="p-6 bg-slate-900 text-white shadow-xl">
            <p className="text-lg font-medium leading-relaxed opacity-90">{process.report.summary}</p>
            {process.report.nextSteps && (
              <div className="mt-6 pt-4 border-t border-slate-700">
                <p className="text-sm font-bold text-blue-400 uppercase tracking-wider mb-2">Próximos Passos</p>
                <p className="text-slate-300">{process.report.nextSteps}</p>
              </div>
            )}
            <p className="mt-6 text-xs text-slate-500">Gerado em: {format(new Date(process.report.generatedAt), "dd/MM/yyyy HH:mm")}</p>
          </Card>
        </div>
      )}
    </AppLayout>
  );
}

function StatCard({ label, count, color, onClick, active, icon: Icon }: any) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "p-3 rounded-lg border text-left transition-all",
        color,
        active ? "ring-2 ring-primary ring-offset-2 scale-105 shadow-md" : "opacity-70 hover:opacity-100 cursor-pointer"
      )}
    >
      <div className="flex justify-between items-start">
        <span className="text-2xl font-black font-display leading-none">{count}</span>
        {Icon && <Icon className="w-5 h-5 opacity-50" />}
      </div>
      <span className="text-xs font-bold uppercase tracking-wider mt-1 block">{label}</span>
    </button>
  );
}

function EditValidationDialog({ item }: { item: ValidationItem }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<ValidationItemStatus>(item.status);
  const [notes, setNotes] = useState(item.notes || '');
  const { updateValidation } = useAppActions();

  const handleSave = async () => {
    await updateValidation.mutateAsync({
      id: item.id,
      data: { status, notes }
    });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="font-semibold text-xs h-8">Avaliar</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajuste Manual</DialogTitle>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div className="bg-slate-50 p-3 rounded border text-sm">
            <span className="font-bold block mb-1">Exigência:</span>
            {item.requirement.title}
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-bold">Novo Status</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {Object.values(ValidationItemStatus).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={cn(
                    "px-3 py-2 text-xs font-bold rounded border text-center transition-all capitalize",
                    status === s ? "ring-2 ring-primary border-primary bg-primary/5 text-primary" : "bg-white hover:bg-slate-50 text-slate-600"
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-bold">Anotações do Analista</label>
            <Textarea 
              value={notes} 
              onChange={e => setNotes(e.target.value)} 
              placeholder="Justificativa para a mudança de status..."
              className="resize-none"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={updateValidation.isPending}>Salvar Alteração</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

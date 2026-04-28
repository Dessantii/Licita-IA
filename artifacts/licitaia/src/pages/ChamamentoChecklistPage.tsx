import { AppLayout } from "@/components/layout/AppLayout";
import { Link, useRoute } from "wouter";
import {
  useGetCallNotice,
  useUpdateCallValidationItem,
  getGetCallNoticeQueryKey,
  CallValidationItem,
  CallValidationItemStatus,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { notify } from "@/lib/feedback";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  Info,
  ChevronLeft,
  Search,
  FileText,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Loader2,
  Download,
  Package,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { getToken } from "@/hooks/use-auth";

const STATUS_CONFIG: Record<string, {
  label: string;
  color: string;
  bg: string;
  border: string;
  icon: React.ElementType;
}> = {
  ok: {
    label: "Conforme",
    color: "text-emerald-700",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    icon: CheckCircle2,
  },
  pendente: {
    label: "Pendente",
    color: "text-red-700",
    bg: "bg-red-50",
    border: "border-red-200",
    icon: XCircle,
  },
  divergente: {
    label: "Divergente",
    color: "text-amber-700",
    bg: "bg-amber-50",
    border: "border-amber-200",
    icon: AlertCircle,
  },
  vencido: {
    label: "Vencido",
    color: "text-orange-700",
    bg: "bg-orange-50",
    border: "border-orange-200",
    icon: Clock,
  },
  incompleto: {
    label: "Incompleto",
    color: "text-yellow-700",
    bg: "bg-yellow-50",
    border: "border-yellow-200",
    icon: AlertCircle,
  },
  revisar_manualmente: {
    label: "Revisar",
    color: "text-blue-700",
    bg: "bg-blue-50",
    border: "border-blue-200",
    icon: Info,
  },
};

const REQUIREMENT_TYPE_LABELS: Record<string, string> = {
  documento_institucional: "Institucional",
  certidao_regularidade: "Certidão",
  comprovacao_experiencia: "Experiência",
  declaracao: "Declaração",
  anexo_obrigatorio: "Anexo",
  proposta_tecnica: "Proposta",
  plano_trabalho: "Plano de Trabalho",
  cronograma: "Cronograma",
  requisito_elegibilidade: "Elegibilidade",
  documento_parceria: "Parceria",
};

type FilterStatus = CallValidationItemStatus | "all";
type FilterType = string;

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] ?? { label: status, color: "text-slate-600", bg: "bg-slate-50", border: "border-slate-200", icon: Info };
  const Icon = config.icon;
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border",
      config.bg, config.color, config.border
    )}>
      <Icon className="w-3.5 h-3.5" />
      {config.label}
    </span>
  );
}

function StatCard({
  label,
  count,
  color,
  onClick,
  active,
  icon: Icon,
}: {
  label: string;
  count: number;
  color: string;
  onClick: () => void;
  active: boolean;
  icon?: React.ElementType;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-xl border p-3 text-left transition-all",
        active ? "ring-2 ring-primary border-primary/30" : "hover:bg-slate-50",
        color
      )}
    >
      <div className="flex items-center gap-1.5 mb-0.5">
        {Icon && <Icon className="w-3.5 h-3.5" />}
        <span className="text-lg font-bold">{count}</span>
      </div>
      <p className="text-xs font-medium">{label}</p>
    </button>
  );
}

interface EditNoteDialogProps {
  item: CallValidationItem;
  onClose: () => void;
  onSave: (status: string, notes: string) => Promise<void>;
}

function EditNoteDialog({ item, onClose, onSave }: EditNoteDialogProps) {
  const [status, setStatus] = useState(item.status);
  const [notes, setNotes] = useState(item.notes ?? "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(status, notes);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Editar Item do Checklist</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <p className="text-sm font-semibold text-slate-900 mb-1">{item.requirement.title}</p>
            {item.requirement.description && (
              <p className="text-sm text-slate-500">{item.requirement.description}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Status</label>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(STATUS_CONFIG).map(([value, config]) => {
                const Icon = config.icon;
                return (
                  <button
                    key={value}
                    onClick={() => setStatus(value as CallValidationItemStatus)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all",
                      status === value
                        ? `${config.bg} ${config.color} ${config.border} ring-2 ring-offset-1 ring-primary`
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {config.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Observação</label>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Adicione uma observação sobre este item..."
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ChecklistRow({
  item,
  onEdit,
}: {
  item: CallValidationItem;
  onEdit: (item: CallValidationItem) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const config = STATUS_CONFIG[item.status] ?? { label: item.status, color: "text-slate-600", bg: "bg-slate-50", border: "border-slate-200", icon: Info };

  return (
    <div className={cn(
      "border rounded-xl mb-2 overflow-hidden transition-all",
      item.status === "revisar_manualmente"
        ? "border-blue-200 bg-blue-50/30"
        : item.status === "pendente" || item.status === "vencido"
          ? "border-red-100"
          : "border-slate-100"
    )}>
      <div className="flex items-start gap-3 p-4">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <p className="text-sm font-semibold text-slate-900">{item.requirement.title}</p>
            {item.requirement.requirementType && (
              <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                {REQUIREMENT_TYPE_LABELS[item.requirement.requirementType] ?? item.requirement.requirementType}
              </span>
            )}
            {item.requirement.mandatory && (
              <span className="text-xs bg-red-50 text-red-600 px-1.5 py-0.5 rounded border border-red-100">
                Obrigatório
              </span>
            )}
            {item.requirement.needsReview && (
              <span className="text-xs bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded border border-amber-100 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Revisar manualmente
              </span>
            )}
          </div>
          {item.requirement.description && (
            <p className="text-xs text-slate-500 mb-2">{item.requirement.description}</p>
          )}
          {item.notes && (
            <p className="text-xs text-slate-600 bg-white border border-slate-100 rounded px-2 py-1 mb-2">
              {item.notes}
            </p>
          )}
          {item.submittedDocument && (
            <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-2">
              <FileText className="w-3.5 h-3.5" />
              <span>{item.submittedDocument.detectedType}</span>
              {item.submittedDocument.needsReview && (
                <span className="text-blue-600">(verificação manual recomendada)</span>
              )}
            </div>
          )}
          <div className="flex items-center gap-3 mt-1">
            {item.requirement.confidence !== null && item.requirement.confidence !== undefined && (
              <span className={cn(
                "text-xs px-1.5 py-0.5 rounded",
                item.requirement.confidence >= 0.9
                  ? "bg-emerald-50 text-emerald-700"
                  : item.requirement.confidence >= 0.7
                    ? "bg-amber-50 text-amber-700"
                    : "bg-red-50 text-red-700"
              )}>
                conf. {Math.round(item.requirement.confidence * 100)}%
              </span>
            )}
            {item.requirement.sourceExcerpt && (
              <button
                onClick={() => setExpanded(v => !v)}
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition-colors"
              >
                {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                Trecho do edital
              </button>
            )}
          </div>
          {expanded && item.requirement.sourceExcerpt && (
            <div className="mt-2 p-2 bg-white rounded border border-slate-100 text-xs text-slate-600 italic">
              &ldquo;{item.requirement.sourceExcerpt}&rdquo;
            </div>
          )}
        </div>

        <div className="flex flex-col items-end gap-2 shrink-0">
          <StatusBadge status={item.status} />
          <button
            onClick={() => onEdit(item)}
            className="text-xs text-primary hover:underline"
          >
            Editar
          </button>
        </div>
      </div>
    </div>
  );
}

export function ChamamentoChecklistPage() {
  const [, params] = useRoute("/chamamentos/:id/checklist");
  const id = Number(params?.id);
  const { data: notice, isLoading } = useGetCallNotice(id);
  const updateMutation = useUpdateCallValidationItem();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [search, setSearch] = useState("");
  const [editingItem, setEditingItem] = useState<CallValidationItem | null>(null);
  const [isGeneratingKit, setIsGeneratingKit] = useState(false);

  async function handleGenerateKit() {
    setIsGeneratingKit(true);
    try {
      const token = getToken();
      const res = await fetch(`/api/chamamentos/${id}/generate-kit`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Erro ao gerar kit");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const safeTitle = notice.title.replace(/[^a-zA-Z0-9_\- ]/g, "_").slice(0, 40);
      a.href = url;
      a.download = `kit_${safeTitle}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      notify(toast, "kit_generated", { description: `${stats.ok} documento(s) incluído(s).` });
    } catch {
      notify(toast, "kit_generate_error");
    } finally {
      setIsGeneratingKit(false);
    }
  }

  if (isLoading || !notice) {
    return (
      <AppLayout>
        <div className="flex items-center gap-3 py-20 justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <span className="text-slate-500">Carregando checklist...</span>
        </div>
      </AppLayout>
    );
  }

  const validationItems = notice.validationItems ?? [];

  const stats = {
    all: validationItems.length,
    ok: validationItems.filter(i => i.status === "ok").length,
    pendente: validationItems.filter(i => i.status === "pendente").length,
    divergente: validationItems.filter(i => i.status === "divergente").length,
    vencido: validationItems.filter(i => i.status === "vencido").length,
    incompleto: validationItems.filter(i => i.status === "incompleto").length,
    revisar_manualmente: validationItems.filter(i => i.status === "revisar_manualmente").length,
  };

  const requirementTypes = Array.from(
    new Set(validationItems.map(i => i.requirement.requirementType).filter(Boolean))
  ) as string[];

  const filteredItems = validationItems.filter(item => {
    if (filterStatus !== "all" && item.status !== filterStatus) return false;
    if (filterType !== "all" && item.requirement.requirementType !== filterType) return false;
    if (search && !item.requirement.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleSave = async (status: string, notes: string) => {
    if (!editingItem) return;
    try {
      await updateMutation.mutateAsync({
        id: editingItem.id,
        data: {
          status: status as CallValidationItemStatus,
          notes: notes || null,
        },
      });
      queryClient.invalidateQueries({ queryKey: getGetCallNoticeQueryKey(id) });
      notify(toast, "checklist_item_updated");
    } catch {
      notify(toast, "checklist_item_update_error");
    }
  };

  return (
    <AppLayout>
      <div className="mb-6">
        <Link
          href={`/chamamentos/${id}`}
          className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-primary mb-4 transition-colors"
        >
          <ChevronLeft className="w-4 h-4 mr-1" /> Voltar ao Chamamento
        </Link>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-slate-900">Checklist de Conferência</h1>
            <p className="text-slate-600 mt-1 font-medium">{notice.title}</p>
          </div>
          <Button
            onClick={handleGenerateKit}
            disabled={isGeneratingKit || stats.ok === 0}
            className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
            title={stats.ok === 0 ? "Nenhum item conforme ainda" : `Baixar ZIP com ${stats.ok} documento(s) conforme(s)`}
          >
            {isGeneratingKit ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Package className="w-4 h-4" />
            )}
            {isGeneratingKit ? "Gerando..." : `Gerar Kit${stats.ok > 0 ? ` (${stats.ok})` : ""}`}
            {!isGeneratingKit && stats.ok > 0 && <Download className="w-3.5 h-3.5 opacity-70" />}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-2 mb-6">
        <StatCard
          label="Total"
          count={stats.all}
          color="bg-white border-slate-200 text-slate-700"
          onClick={() => setFilterStatus("all")}
          active={filterStatus === "all"}
        />
        <StatCard
          label="Conforme"
          count={stats.ok}
          color="bg-emerald-50 border-emerald-200 text-emerald-700"
          onClick={() => setFilterStatus(CallValidationItemStatus.ok)}
          active={filterStatus === CallValidationItemStatus.ok}
          icon={CheckCircle2}
        />
        <StatCard
          label="Pendente"
          count={stats.pendente}
          color="bg-red-50 border-red-200 text-red-700"
          onClick={() => setFilterStatus(CallValidationItemStatus.pendente)}
          active={filterStatus === CallValidationItemStatus.pendente}
          icon={XCircle}
        />
        <StatCard
          label="Divergente"
          count={stats.divergente}
          color="bg-amber-50 border-amber-200 text-amber-700"
          onClick={() => setFilterStatus(CallValidationItemStatus.divergente)}
          active={filterStatus === CallValidationItemStatus.divergente}
          icon={AlertCircle}
        />
        <StatCard
          label="Vencido"
          count={stats.vencido}
          color="bg-orange-50 border-orange-200 text-orange-700"
          onClick={() => setFilterStatus(CallValidationItemStatus.vencido)}
          active={filterStatus === CallValidationItemStatus.vencido}
          icon={Clock}
        />
        <StatCard
          label="Incompleto"
          count={stats.incompleto}
          color="bg-yellow-50 border-yellow-200 text-yellow-700"
          onClick={() => setFilterStatus(CallValidationItemStatus.incompleto)}
          active={filterStatus === CallValidationItemStatus.incompleto}
          icon={AlertCircle}
        />
        <StatCard
          label="Revisar"
          count={stats.revisar_manualmente}
          color="bg-blue-50 border-blue-200 text-blue-700"
          onClick={() => setFilterStatus(CallValidationItemStatus.revisar_manualmente)}
          active={filterStatus === CallValidationItemStatus.revisar_manualmente}
          icon={Info}
        />
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar requisito..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        {requirementTypes.length > 0 && (
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white"
          >
            <option value="all">Todos os tipos</option>
            {requirementTypes.map(t => (
              <option key={t} value={t}>
                {REQUIREMENT_TYPE_LABELS[t] ?? t}
              </option>
            ))}
          </select>
        )}
      </div>

      {validationItems.length === 0 ? (
        <div className="text-center py-20">
          <CheckCircle2 className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-700 mb-2">Checklist vazio</h3>
          <p className="text-slate-500 text-sm">
            Analise o edital para extrair os requisitos e gerar o checklist.
          </p>
          <Link href={`/chamamentos/${id}`}>
            <Button className="mt-4" variant="outline">
              <ChevronLeft className="w-4 h-4 mr-1" />
              Voltar ao Chamamento
            </Button>
          </Link>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="text-center py-12 text-slate-500 text-sm">
          Nenhum item encontrado com estes filtros.
        </div>
      ) : (
        <div>
          <p className="text-sm text-slate-500 mb-3">{filteredItems.length} item{filteredItems.length !== 1 ? "ns" : ""} encontrado{filteredItems.length !== 1 ? "s" : ""}</p>
          {filteredItems.map(item => (
            <ChecklistRow
              key={item.id}
              item={item}
              onEdit={setEditingItem}
            />
          ))}
        </div>
      )}

      {editingItem && (
        <EditNoteDialog
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onSave={handleSave}
        />
      )}
    </AppLayout>
  );
}

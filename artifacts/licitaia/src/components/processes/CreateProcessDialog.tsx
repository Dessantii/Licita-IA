import { useState, useRef, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  useCreateProcess,
  useUploadEdital,
  useListCompanies,
  getListProcessesQueryKey,
  getGetProcessQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { notify } from "@/lib/feedback";
import {
  FolderPlus,
  Loader2,
  BrainCircuit,
  FileText,
  UploadCloud,
  PenLine,
  CheckCircle2,
  X,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getToken } from "@/hooks/use-auth";

const formSchema = z.object({
  title: z.string().min(3, "Título muito curto"),
  agency: z.string().min(2, "Órgão muito curto"),
  modality: z.string().min(2, "Modalidade necessária"),
  editalNumber: z.string().optional(),
  deadline: z.string().optional(),
  notes: z.string().optional(),
  companyId: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;
type Mode = "choose" | "manual" | "import";
type ImportStep = "upload" | "extracting" | "review";

interface Prefill {
  title?: string;
  agency?: string;
  modality?: string;
  source?: string;
}

interface CreateProcessDialogProps {
  prefill?: Prefill;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function CreateProcessDialog({ prefill, defaultOpen, open: controlledOpen, onOpenChange }: CreateProcessDialogProps) {
  const isControlled = controlledOpen !== undefined;
  const [internalOpen, setInternalOpen] = useState(defaultOpen ?? false);
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? (onOpenChange ?? (() => {})) : setInternalOpen;
  const [mode, setMode] = useState<Mode>("choose");
  const [importStep, setImportStep] = useState<ImportStep>("upload");
  const [isDragging, setIsDragging] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [extractError, setExtractError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createProcessMutation = useCreateProcess();
  const uploadEditalMutation = useUploadEdital();
  const { data: companies } = useListCompanies();

  const { register, handleSubmit, formState: { errors }, reset, setValue } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
  });

  useEffect(() => {
    if (open && prefill) {
      setMode("manual");
      if (prefill.title) setValue("title", prefill.title);
      if (prefill.agency) setValue("agency", prefill.agency);
      if (prefill.modality) setValue("modality", prefill.modality);
    }
  }, [open, prefill]);

  const handleClose = () => {
    setOpen(false);
    setMode("choose");
    setImportStep("upload");
    setPendingFile(null);
    setExtractError(null);
    reset();
  };

  const handleExtractFromFile = async (file: File) => {
    setPendingFile(file);
    setImportStep("extracting");
    setExtractError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const token = getToken();
      const response = await fetch("/api/processes/extract-meta", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!response.ok) throw new Error("Falha na extração");

      const data = await response.json() as {
        title: string | null;
        agency: string | null;
        modality: string | null;
        editalNumber: string | null;
        deadline: string | null;
      };

      if (data.title) setValue("title", data.title);
      if (data.agency) setValue("agency", data.agency);
      if (data.modality) setValue("modality", data.modality);
      if (data.editalNumber) setValue("editalNumber", data.editalNumber);
      if (data.deadline) setValue("deadline", data.deadline);

      setImportStep("review");
    } catch {
      setExtractError("Não foi possível extrair as informações do edital. Tente novamente ou preencha manualmente.");
      setImportStep("upload");
      setPendingFile(null);
    }
  };

  const handleFileDrop = (file: File) => {
    if (!file.type.includes("pdf") && !file.name.endsWith(".pdf")) {
      setExtractError("Por favor, envie um arquivo PDF.");
      return;
    }
    handleExtractFromFile(file);
  };

  const onSubmit = async (data: FormValues) => {
    try {
      const companyId = data.companyId ? parseInt(data.companyId) : null;
      const newProcess = await createProcessMutation.mutateAsync({
        data: {
          ...data,
          companyId: companyId || null,
        },
      });

      if (mode === "import" && pendingFile) {
        await uploadEditalMutation.mutateAsync({
          id: newProcess.id,
          data: { file: pendingFile },
        });
      }

      queryClient.invalidateQueries({ queryKey: getListProcessesQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetProcessQueryKey(newProcess.id) });

      notify(toast, "process_created", mode === "import"
        ? { title: "Processo criado com edital anexado" }
        : undefined);

      handleClose();
      navigate(`/processes/${newProcess.id}`);
    } catch {
      notify(toast, "process_create_error");
    }
  };

  const isSubmitting = createProcessMutation.isPending || uploadEditalMutation.isPending;

  return (
    <>
      {!isControlled && (
        <Button onClick={() => setOpen(true)}>
          <FolderPlus className="w-4 h-4 mr-2" />
          Novo Processo
        </Button>
      )}

      <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
        <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Processo Licitatório</DialogTitle>
          </DialogHeader>

          {/* Mode: Choose */}
          {mode === "choose" && (
            <div className="py-2 space-y-3">
              <p className="text-sm text-slate-500">Como deseja cadastrar o processo?</p>
              <button
                onClick={() => setMode("import")}
                className="w-full flex items-start gap-4 p-4 rounded-xl border-2 border-primary/20 bg-primary/5 hover:border-primary/50 hover:bg-primary/10 transition-all text-left group"
              >
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                  <BrainCircuit className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-bold text-slate-900 text-sm">Importar do Edital</p>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                    Faça o upload do PDF. A IA lê o edital e preenche os campos automaticamente.
                  </p>
                </div>
              </button>

              <button
                onClick={() => setMode("manual")}
                className="w-full flex items-start gap-4 p-4 rounded-xl border-2 border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 transition-all text-left group"
              >
                <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0 group-hover:bg-slate-200 transition-colors">
                  <PenLine className="w-5 h-5 text-slate-500" />
                </div>
                <div>
                  <p className="font-bold text-slate-900 text-sm">Preencher Manualmente</p>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                    Digite as informações do processo diretamente nos campos do formulário.
                  </p>
                </div>
              </button>
            </div>
          )}

          {/* Mode: Import — Upload Step */}
          {mode === "import" && importStep === "upload" && (
            <div className="py-2 space-y-4">
              <button
                onClick={() => setMode("choose")}
                className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors"
              >
                ← Voltar
              </button>

              {extractError && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{extractError}</span>
                </div>
              )}

              <div
                className={cn(
                  "border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 cursor-pointer flex flex-col items-center justify-center min-h-[200px]",
                  isDragging
                    ? "border-primary bg-primary/5"
                    : "border-slate-200 hover:border-primary/50 hover:bg-slate-50"
                )}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  const f = e.dataTransfer.files[0];
                  if (f) handleFileDrop(f);
                }}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFileDrop(f);
                  }}
                />
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <UploadCloud className="w-7 h-7 text-primary" />
                </div>
                <p className="font-semibold text-slate-800 text-sm">
                  Arraste o PDF do edital aqui
                </p>
                <p className="text-xs text-slate-500 mt-1">ou clique para selecionar</p>
                <p className="text-xs text-slate-400 mt-3">PDF até 50MB</p>
              </div>

              <p className="text-xs text-center text-slate-400">
                A IA extrairá título, órgão, modalidade, número do edital e data de abertura
              </p>
            </div>
          )}

          {/* Mode: Import — Extracting Step */}
          {mode === "import" && importStep === "extracting" && (
            <div className="py-8 flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <BrainCircuit className="w-8 h-8 text-primary animate-pulse" />
              </div>
              <div className="text-center">
                <p className="font-bold text-slate-900">Analisando o edital...</p>
                <p className="text-sm text-slate-500 mt-1">
                  A IA está extraindo as informações do processo
                </p>
              </div>
              {pendingFile && (
                <div className="flex items-center gap-2 bg-slate-50 border rounded-lg px-3 py-2 text-sm text-slate-600">
                  <FileText className="w-4 h-4 text-slate-400" />
                  <span className="truncate max-w-[240px]">{pendingFile.name}</span>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-primary ml-1 flex-shrink-0" />
                </div>
              )}
            </div>
          )}

          {/* Form — shown for manual mode OR import review step */}
          {(mode === "manual" || (mode === "import" && importStep === "review")) && (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-1">
              {/* Back link */}
              {mode === "manual" && (
                <button
                  type="button"
                  onClick={() => setMode("choose")}
                  className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors"
                >
                  ← Voltar
                </button>
              )}

              {/* AI extracted banner */}
              {mode === "import" && importStep === "review" && pendingFile && (
                <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-green-800">Informações extraídas pelo edital</p>
                    <p className="text-xs text-green-700 mt-0.5 truncate">{pendingFile.name}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setImportStep("upload"); setPendingFile(null); reset(); }}
                    className="text-green-600 hover:text-green-800 flex-shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="title">Objeto/Título *</Label>
                <Input id="title" placeholder="Ex: Aquisição de equipamentos TI" {...register("title")} />
                {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="agency">Órgão Promotor *</Label>
                  <Input id="agency" placeholder="Ex: Prefeitura Municipal" {...register("agency")} />
                  {errors.agency && <p className="text-xs text-destructive">{errors.agency.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="modality">Modalidade *</Label>
                  <Input id="modality" placeholder="Ex: Pregão Eletrônico" {...register("modality")} />
                  {errors.modality && <p className="text-xs text-destructive">{errors.modality.message}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="editalNumber">Nº do Edital</Label>
                  <Input id="editalNumber" placeholder="Ex: 015/2024" {...register("editalNumber")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="deadline">Data/Hora Abertura</Label>
                  <Input id="deadline" type="datetime-local" {...register("deadline")} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="companyId">Empresa</Label>
                <select
                  id="companyId"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white"
                  {...register("companyId")}
                >
                  <option value="">Sem empresa vinculada</option>
                  {(companies ?? []).map((c: any) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Observações Iniciais</Label>
                <Textarea id="notes" placeholder="Detalhes importantes..." {...register("notes")} rows={2} />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={handleClose}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {mode === "import" ? "Salvar e Abrir Processo" : "Salvar Processo"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
  useUpdateProcess,
  getGetProcessQueryKey,
  getListProcessesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

const formSchema = z.object({
  title: z.string().min(3, "Título muito curto"),
  agency: z.string().min(2, "Órgão muito curto"),
  modality: z.string().min(2, "Modalidade necessária"),
  editalNumber: z.string().optional(),
  deadline: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface EditProcessDialogProps {
  process: {
    id: number;
    title: string;
    agency: string;
    modality: string;
    editalNumber?: string | null;
    deadline?: string | null;
    notes?: string | null;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditProcessDialog({ process, open, onOpenChange }: EditProcessDialogProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const updateMutation = useUpdateProcess();

  const { register, handleSubmit, formState: { errors }, reset } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
  });

  useEffect(() => {
    if (open) {
      reset({
        title: process.title,
        agency: process.agency,
        modality: process.modality,
        editalNumber: process.editalNumber ?? "",
        deadline: process.deadline ? process.deadline.slice(0, 16) : "",
        notes: process.notes ?? "",
      });
    }
  }, [open, process, reset]);

  const onSubmit = async (data: FormValues) => {
    try {
      await updateMutation.mutateAsync({
        id: process.id,
        data: {
          title: data.title,
          agency: data.agency,
          modality: data.modality,
          editalNumber: data.editalNumber || null,
          deadline: data.deadline || null,
          notes: data.notes || null,
        },
      });
      queryClient.invalidateQueries({ queryKey: getGetProcessQueryKey(process.id) });
      queryClient.invalidateQueries({ queryKey: getListProcessesQueryKey() });
      toast({ title: "Processo atualizado com sucesso" });
      onOpenChange(false);
    } catch {
      toast({ title: "Erro ao atualizar processo", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar Processo</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-1">
          <div className="space-y-2">
            <Label htmlFor="edit-title">Objeto/Título *</Label>
            <Input id="edit-title" {...register("title")} />
            {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-agency">Órgão Promotor *</Label>
              <Input id="edit-agency" {...register("agency")} />
              {errors.agency && <p className="text-xs text-destructive">{errors.agency.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-modality">Modalidade *</Label>
              <Input id="edit-modality" {...register("modality")} />
              {errors.modality && <p className="text-xs text-destructive">{errors.modality.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-editalNumber">Nº do Edital</Label>
              <Input id="edit-editalNumber" placeholder="Ex: 015/2024" {...register("editalNumber")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-deadline">Data/Hora Abertura</Label>
              <Input id="edit-deadline" type="datetime-local" {...register("deadline")} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-notes">Observações</Label>
            <Textarea id="edit-notes" rows={2} {...register("notes")} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Salvar Alterações
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAppActions } from "@/hooks/use-app-actions";
import { FolderPlus, Loader2 } from "lucide-react";

const formSchema = z.object({
  title: z.string().min(3, "Título muito curto"),
  agency: z.string().min(2, "Órgão muito curto"),
  modality: z.string().min(2, "Modalidade necessária"),
  editalNumber: z.string().optional(),
  deadline: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export function CreateProcessDialog() {
  const [open, setOpen] = useState(false);
  const { createProcess } = useAppActions();

  const { register, handleSubmit, formState: { errors }, reset } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
  });

  const onSubmit = (data: FormValues) => {
    createProcess.mutate(
      { data },
      {
        onSuccess: () => {
          setOpen(false);
          reset();
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <FolderPlus className="w-4 h-4 mr-2" />
          Novo Processo
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Processo Licitatório</DialogTitle>
          <DialogDescription>
            Crie um novo processo para gerenciar a conferência de documentos.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-4">
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
            <Label htmlFor="notes">Observações Iniciais</Label>
            <Textarea id="notes" placeholder="Detalhes importantes..." {...register("notes")} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createProcess.isPending}>
              {createProcess.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Salvar Processo
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

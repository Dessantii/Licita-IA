import { useQueryClient } from "@tanstack/react-query";
import { 
  useCreateProcess, 
  useUpdateProcess, 
  useDeleteProcess,
  useUploadEdital,
  useUploadDocument,
  useAnalyzeEdital,
  useAnalyzeDocuments,
  useUpdateValidationItem,
  useDeleteFile,
  getListProcessesQueryKey,
  getGetProcessQueryKey,
  getListRequirementsQueryKey,
  getListValidationItemsQueryKey,
  getListFilesQueryKey,
  getGetReportQueryKey
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

// Wrappers around generated hooks to handle cache invalidation and toasts
export function useAppActions() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createProcess = useCreateProcess({
    mutation: {
      onSuccess: () => {
        toast({ title: "Processo criado com sucesso", variant: "default" });
        queryClient.invalidateQueries({ queryKey: getListProcessesQueryKey() });
      },
      onError: (error) => {
        toast({ title: "Erro ao criar processo", description: error.message, variant: "destructive" });
      }
    }
  });

  const updateProcess = useUpdateProcess({
    mutation: {
      onSuccess: (data) => {
        toast({ title: "Processo atualizado", variant: "default" });
        queryClient.invalidateQueries({ queryKey: getListProcessesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetProcessQueryKey(data.id) });
      },
      onError: (error) => {
        toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
      }
    }
  });

  const deleteProcess = useDeleteProcess({
    mutation: {
      onSuccess: () => {
        toast({ title: "Processo excluído", variant: "default" });
        queryClient.invalidateQueries({ queryKey: getListProcessesQueryKey() });
      }
    }
  });

  const uploadEdital = useUploadEdital({
    mutation: {
      onSuccess: (data) => {
        toast({ title: "Edital enviado", variant: "default" });
        queryClient.invalidateQueries({ queryKey: getGetProcessQueryKey(data.processId) });
        queryClient.invalidateQueries({ queryKey: getListFilesQueryKey(data.processId) });
      },
      onError: () => toast({ title: "Erro no upload", variant: "destructive" })
    }
  });

  const uploadDocument = useUploadDocument({
    mutation: {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getGetProcessQueryKey(data.processId) });
        queryClient.invalidateQueries({ queryKey: getListFilesQueryKey(data.processId) });
      },
      onError: () => toast({ title: "Erro no upload", variant: "destructive" })
    }
  });

  const removeFile = useDeleteFile({
    mutation: {
      onSuccess: (_, variables) => {
        toast({ title: "Arquivo removido", variant: "default" });
        // Since we don't know the processId easily here without passing it, 
        // we invalidate all files and processes to be safe
        queryClient.invalidateQueries({ queryKey: ["/api/processes"] });
      }
    }
  });

  const analyzeEdital = useAnalyzeEdital({
    mutation: {
      onSuccess: (_, variables) => {
        toast({ title: "Análise concluída", description: "As exigências foram extraídas.", variant: "default" });
        queryClient.invalidateQueries({ queryKey: getGetProcessQueryKey(variables.id) });
        queryClient.invalidateQueries({ queryKey: getListRequirementsQueryKey(variables.id) });
        queryClient.invalidateQueries({ queryKey: getListValidationItemsQueryKey(variables.id) });
      },
      onError: () => toast({ title: "Erro na análise", variant: "destructive" })
    }
  });

  const analyzeDocs = useAnalyzeDocuments({
    mutation: {
      onSuccess: (_, variables) => {
        toast({ title: "Conferência concluída", description: "Os documentos foram analisados.", variant: "default" });
        queryClient.invalidateQueries({ queryKey: getGetProcessQueryKey(variables.id) });
        queryClient.invalidateQueries({ queryKey: getListValidationItemsQueryKey(variables.id) });
        queryClient.invalidateQueries({ queryKey: getGetReportQueryKey(variables.id) });
      },
      onError: () => toast({ title: "Erro na conferência", variant: "destructive" })
    }
  });

  const updateValidation = useUpdateValidationItem({
    mutation: {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getListValidationItemsQueryKey(data.processId) });
        queryClient.invalidateQueries({ queryKey: getGetReportQueryKey(data.processId) });
      }
    }
  });

  return {
    createProcess,
    updateProcess,
    deleteProcess,
    uploadEdital,
    uploadDocument,
    removeFile,
    analyzeEdital,
    analyzeDocs,
    updateValidation
  };
}

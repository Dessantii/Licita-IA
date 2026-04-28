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
import { notify } from "@/lib/feedback";

export function useAppActions() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createProcess = useCreateProcess({
    mutation: {
      onSuccess: () => {
        notify(toast, "process_created");
        queryClient.invalidateQueries({ queryKey: getListProcessesQueryKey() });
      },
      onError: () => {
        notify(toast, "process_create_error");
      }
    }
  });

  const updateProcess = useUpdateProcess({
    mutation: {
      onSuccess: (data) => {
        notify(toast, "process_updated");
        queryClient.invalidateQueries({ queryKey: getListProcessesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetProcessQueryKey(data.id) });
      },
      onError: () => {
        notify(toast, "process_update_error");
      }
    }
  });

  const deleteProcess = useDeleteProcess({
    mutation: {
      onSuccess: () => {
        notify(toast, "process_deleted");
        queryClient.invalidateQueries({ queryKey: getListProcessesQueryKey() });
      }
    }
  });

  const uploadEdital = useUploadEdital({
    mutation: {
      onSuccess: (data) => {
        notify(toast, "edital_uploaded");
        queryClient.invalidateQueries({ queryKey: getGetProcessQueryKey(data.processId) });
        queryClient.invalidateQueries({ queryKey: getListFilesQueryKey(data.processId) });
      },
      onError: () => notify(toast, "edital_upload_error")
    }
  });

  const uploadDocument = useUploadDocument({
    mutation: {
      onSuccess: (data) => {
        notify(toast, "doc_uploaded");
        queryClient.invalidateQueries({ queryKey: getGetProcessQueryKey(data.processId) });
        queryClient.invalidateQueries({ queryKey: getListFilesQueryKey(data.processId) });
      },
      onError: () => notify(toast, "doc_upload_error")
    }
  });

  const removeFile = useDeleteFile({
    mutation: {
      onSuccess: () => {
        notify(toast, "file_removed");
        queryClient.invalidateQueries({ queryKey: ["/api/processes"] });
      }
    }
  });

  const analyzeEdital = useAnalyzeEdital({
    mutation: {
      onSuccess: (_, variables) => {
        notify(toast, "edital_analyzed");
        queryClient.invalidateQueries({ queryKey: getGetProcessQueryKey(variables.id) });
        queryClient.invalidateQueries({ queryKey: getListRequirementsQueryKey(variables.id) });
        queryClient.invalidateQueries({ queryKey: getListValidationItemsQueryKey(variables.id) });
      },
      onError: () => notify(toast, "edital_analyze_error")
    }
  });

  const analyzeDocs = useAnalyzeDocuments({
    mutation: {
      onSuccess: (_, variables) => {
        notify(toast, "docs_checked");
        queryClient.invalidateQueries({ queryKey: getGetProcessQueryKey(variables.id) });
        queryClient.invalidateQueries({ queryKey: getListValidationItemsQueryKey(variables.id) });
        queryClient.invalidateQueries({ queryKey: getGetReportQueryKey(variables.id) });
      },
      onError: () => notify(toast, "docs_check_error")
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

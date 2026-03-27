import { Badge } from "@/components/ui/badge";
import { ProcessStatus } from "@workspace/api-client-react";

const statusLabels: Record<ProcessStatus, string> = {
  [ProcessStatus.criado]: "Criado",
  [ProcessStatus.edital_enviado]: "Edital Enviado",
  [ProcessStatus.edital_processando]: "Processando Edital",
  [ProcessStatus.exigencias_extraidas]: "Exigências Extraídas",
  [ProcessStatus.aguardando_documentos]: "Aguardando Docs",
  [ProcessStatus.documentos_enviados]: "Documentos Enviados",
  [ProcessStatus.em_conferencia]: "Em Conferência",
  [ProcessStatus.pendencias_encontradas]: "Pendências",
  [ProcessStatus.pronto_para_revisao]: "Pronto para Revisão",
  [ProcessStatus.concluido]: "Concluído",
};

export function ProcessStatusBadge({ status }: { status: ProcessStatus }) {
  // Use the exact enum value as the badge variant, as defined in badge.tsx
  return (
    <Badge variant={status as any}>
      {statusLabels[status]}
    </Badge>
  );
}

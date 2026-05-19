import { Badge } from "@/components/ui/badge";
import { ProcessStatus } from "@workspace/api-client-react";

const statusLabels: Record<ProcessStatus, string> = {
  [ProcessStatus.criado]: "Iniciado",
  [ProcessStatus.edital_enviado]: "Edital recebido",
  [ProcessStatus.edital_processando]: "Lendo o edital...",
  [ProcessStatus.exigencias_extraidas]: "Documentos identificados",
  [ProcessStatus.aguardando_documentos]: "Aguardando documentos",
  [ProcessStatus.documentos_enviados]: "Documentos enviados",
  [ProcessStatus.em_conferencia]: "Verificando documentos",
  [ProcessStatus.pendencias_encontradas]: "Tem algo para resolver",
  [ProcessStatus.pronto_para_revisao]: "Pronto para revisar",
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

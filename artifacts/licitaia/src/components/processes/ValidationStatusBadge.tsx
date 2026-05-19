import { Badge } from "@/components/ui/badge";
import { ValidationItemStatus } from "@workspace/api-client-react";
import { CheckCircle2, XCircle, AlertCircle, Clock, Info } from "lucide-react";

const config: Record<ValidationItemStatus, { label: string, icon: any }> = {
  [ValidationItemStatus.ok]: { label: "Tudo certo", icon: CheckCircle2 },
  [ValidationItemStatus.faltando]: { label: "Falta este documento", icon: XCircle },
  [ValidationItemStatus.vencido]: { label: "Prazo vencido", icon: Clock },
  [ValidationItemStatus.divergente]: { label: "Parece diferente", icon: AlertCircle },
  [ValidationItemStatus.revisar]: { label: "Conferir", icon: Info },
};

export function ValidationStatusBadge({ status }: { status: ValidationItemStatus }) {
  const { label, icon: Icon } = config[status];
  
  return (
    <Badge variant={status as any} className="flex items-center gap-1 pl-1.5">
      <Icon className="w-3.5 h-3.5" />
      {label}
    </Badge>
  );
}

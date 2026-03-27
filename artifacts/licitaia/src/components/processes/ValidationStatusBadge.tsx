import { Badge } from "@/components/ui/badge";
import { ValidationItemStatus } from "@workspace/api-client-react";
import { CheckCircle2, XCircle, AlertCircle, Clock, Info } from "lucide-react";

const config: Record<ValidationItemStatus, { label: string, icon: any }> = {
  [ValidationItemStatus.ok]: { label: "Conforme", icon: CheckCircle2 },
  [ValidationItemStatus.faltando]: { label: "Faltando", icon: XCircle },
  [ValidationItemStatus.vencido]: { label: "Vencido", icon: Clock },
  [ValidationItemStatus.divergente]: { label: "Divergente", icon: AlertCircle },
  [ValidationItemStatus.revisar]: { label: "Revisar", icon: Info },
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

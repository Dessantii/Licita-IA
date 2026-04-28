import { ArrowRight, AlertTriangle, Info, CheckCircle2, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NextAction, Urgency } from "@/lib/next-action";

const CONFIG: Record<Urgency, {
  bar: string;
  bg: string;
  border: string;
  badge: string;
  badgeText: string;
  icon: React.ElementType;
  label: string;
  btn: string;
}> = {
  alta: {
    bar: "bg-red-500",
    bg: "bg-red-50",
    border: "border-red-100",
    badge: "bg-red-100 text-red-700",
    badgeText: "Urgência Alta",
    icon: AlertTriangle,
    label: "text-red-700",
    btn: "bg-red-600 hover:bg-red-700 text-white",
  },
  media: {
    bar: "bg-amber-400",
    bg: "bg-amber-50",
    border: "border-amber-100",
    badge: "bg-amber-100 text-amber-700",
    badgeText: "Urgência Média",
    icon: Zap,
    label: "text-amber-700",
    btn: "bg-amber-500 hover:bg-amber-600 text-white",
  },
  baixa: {
    bar: "bg-blue-400",
    bg: "bg-blue-50",
    border: "border-blue-100",
    badge: "bg-blue-100 text-blue-700",
    badgeText: "Urgência Baixa",
    icon: Info,
    label: "text-blue-700",
    btn: "bg-blue-500 hover:bg-blue-600 text-white",
  },
  concluido: {
    bar: "bg-green-500",
    bg: "bg-green-50",
    border: "border-green-100",
    badge: "bg-green-100 text-green-700",
    badgeText: "Pronto",
    icon: CheckCircle2,
    label: "text-green-700",
    btn: "bg-green-600 hover:bg-green-700 text-white",
  },
};

interface NextActionBannerProps {
  action: NextAction;
  onAction: () => void;
  className?: string;
}

export function NextActionBanner({ action, onAction, className }: NextActionBannerProps) {
  const cfg = CONFIG[action.urgency];
  const Icon = cfg.icon;

  return (
    <div
      className={cn(
        "flex rounded-xl border overflow-hidden",
        cfg.bg, cfg.border, className,
      )}
    >
      {/* Left accent bar */}
      <div className={cn("w-1 flex-shrink-0", cfg.bar)} />

      {/* Content */}
      <div className="flex flex-1 items-center gap-4 px-4 py-3 min-w-0 flex-wrap sm:flex-nowrap">
        {/* Icon */}
        <Icon className={cn("w-5 h-5 flex-shrink-0", cfg.label)} />

        {/* Text */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-0.5">
            <span className={cn("text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full flex-shrink-0", cfg.badge)}>
              {cfg.badgeText}
            </span>
            <p className="text-sm font-semibold text-slate-800 leading-tight">{action.title}</p>
          </div>
          <p className="text-xs text-slate-500 leading-snug">{action.description}</p>
        </div>

        {/* Action button */}
        <button
          onClick={onAction}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex-shrink-0 whitespace-nowrap",
            cfg.btn,
          )}
        >
          {action.actionLabel}
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

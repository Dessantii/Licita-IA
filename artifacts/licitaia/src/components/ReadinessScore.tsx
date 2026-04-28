import { cn } from "@/lib/utils";
import type { ReadinessResult, ReadinessCategory } from "@/lib/readiness-score";

// ── Config visual por categoria ───────────────────────────────────────────────

const CATEGORY_CONFIG: Record<ReadinessCategory, {
  bar: string;
  barBg: string;
  scoreColor: string;
  badgeBg: string;
  badgeText: string;
  border: string;
}> = {
  incompleto: {
    bar: "bg-red-500",
    barBg: "bg-red-100",
    scoreColor: "text-red-600",
    badgeBg: "bg-red-100",
    badgeText: "text-red-700",
    border: "border-red-100",
  },
  em_andamento: {
    bar: "bg-amber-400",
    barBg: "bg-amber-100",
    scoreColor: "text-amber-600",
    badgeBg: "bg-amber-100",
    badgeText: "text-amber-700",
    border: "border-amber-100",
  },
  quase_pronto: {
    bar: "bg-blue-500",
    barBg: "bg-blue-100",
    scoreColor: "text-blue-600",
    badgeBg: "bg-blue-100",
    badgeText: "text-blue-700",
    border: "border-blue-100",
  },
  pronto: {
    bar: "bg-emerald-500",
    barBg: "bg-emerald-100",
    scoreColor: "text-emerald-600",
    badgeBg: "bg-emerald-100",
    badgeText: "text-emerald-700",
    border: "border-emerald-100",
  },
};

// ── Componente ────────────────────────────────────────────────────────────────

interface ReadinessScoreProps {
  result: ReadinessResult;
  className?: string;
}

export function ReadinessScore({ result, className }: ReadinessScoreProps) {
  const cfg = CATEGORY_CONFIG[result.category];
  const { score, label, ok, faltando, vencido, outros, total } = result;

  const pendentes = faltando + vencido + outros;

  return (
    <div className={cn("rounded-xl border bg-white px-4 py-3", cfg.border, className)}>
      <div className="flex items-center gap-4">
        {/* Score number */}
        <div className="flex-shrink-0 text-center w-16">
          <span className={cn("text-3xl font-extrabold leading-none tabular-nums", cfg.scoreColor)}>
            {score}
          </span>
          <span className={cn("text-sm font-bold leading-none", cfg.scoreColor)}>%</span>
        </div>

        {/* Bar + info */}
        <div className="flex-1 min-w-0">
          {/* Top: label + badge */}
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
              Score de Prontidão
            </span>
            <span className={cn("text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full", cfg.badgeBg, cfg.badgeText)}>
              {label}
            </span>
          </div>

          {/* Progress bar */}
          <div className={cn("w-full h-2.5 rounded-full overflow-hidden", cfg.barBg)}>
            <div
              className={cn("h-full rounded-full transition-all duration-700 ease-out", cfg.bar)}
              style={{ width: `${score}%` }}
            />
          </div>

          {/* Summary pills */}
          {total > 0 && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
              {ok > 0 && (
                <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                  {ok} {ok === 1 ? "item ok" : "itens ok"}
                </span>
              )}
              {faltando > 0 && (
                <span className="text-xs text-red-600 font-medium flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
                  {faltando} {faltando === 1 ? "pendência" : "pendências"}
                </span>
              )}
              {vencido > 0 && (
                <span className="text-xs text-orange-600 font-medium flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-500 inline-block" />
                  {vencido} {vencido === 1 ? "doc. vencido" : "docs. vencidos"}
                </span>
              )}
              {outros > 0 && (
                <span className="text-xs text-purple-600 font-medium flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400 inline-block" />
                  {outros} {outros === 1 ? "para revisar" : "para revisar"}
                </span>
              )}
              {pendentes === 0 && ok > 0 && (
                <span className="text-xs text-emerald-600 font-semibold">
                  Todos os itens conferidos ✓
                </span>
              )}
            </div>
          )}

          {/* When no validation items yet */}
          {total === 0 && (
            <p className="text-xs text-slate-400 mt-1">
              Score atualiza após a conferência de documentos
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

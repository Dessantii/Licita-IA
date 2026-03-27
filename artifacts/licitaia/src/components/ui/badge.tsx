import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground",
        outline: "text-foreground",
        // Custom process statuses
        criado: "border-transparent bg-slate-100 text-slate-700",
        edital_enviado: "border-transparent bg-blue-100 text-blue-700",
        edital_processando: "border-transparent bg-yellow-100 text-yellow-800 animate-pulse-subtle",
        exigencias_extraidas: "border-transparent bg-indigo-100 text-indigo-700",
        aguardando_documentos: "border-transparent bg-orange-100 text-orange-700",
        documentos_enviados: "border-transparent bg-cyan-100 text-cyan-700",
        em_conferencia: "border-transparent bg-amber-100 text-amber-800 animate-pulse-subtle",
        pendencias_encontradas: "border-transparent bg-red-100 text-red-700",
        pronto_para_revisao: "border-transparent bg-purple-100 text-purple-700",
        concluido: "border-transparent bg-emerald-100 text-emerald-800",
        
        // Custom validation statuses
        ok: "border-transparent bg-emerald-100 text-emerald-800",
        faltando: "border-transparent bg-red-100 text-red-800",
        vencido: "border-transparent bg-orange-100 text-orange-800",
        divergente: "border-transparent bg-amber-100 text-amber-800",
        revisar: "border-transparent bg-blue-100 text-blue-800",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }

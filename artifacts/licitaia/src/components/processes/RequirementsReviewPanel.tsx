import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle2,
  Building2,
  Receipt,
  TrendingUp,
  Wrench,
  Paperclip,
  FileText,
  Info,
  DollarSign,
  Clock,
  MapPin,
  Scale,
  CreditCard,
  CalendarDays,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Requirement = {
  id: number;
  title: string;
  description?: string | null;
  category?: string | null;
  mandatory: boolean;
  sourceExcerpt?: string | null;
  confidence: number;
  needsReview: boolean;
};

const CATEGORY_CONFIG: Record<
  string,
  { label: string; icon: React.ElementType; color: string; bgColor: string; borderColor: string }
> = {
  habilitacao_juridica: {
    label: "Habilitação Jurídica",
    icon: Building2,
    color: "text-blue-700",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
  },
  habilitacao_fiscal: {
    label: "Habilitação Fiscal e Trabalhista",
    icon: Receipt,
    color: "text-orange-700",
    bgColor: "bg-orange-50",
    borderColor: "border-orange-200",
  },
  habilitacao_financeira: {
    label: "Habilitação Econômico-Financeira",
    icon: TrendingUp,
    color: "text-green-700",
    bgColor: "bg-green-50",
    borderColor: "border-green-200",
  },
  qualificacao_tecnica: {
    label: "Qualificação Técnica",
    icon: Wrench,
    color: "text-purple-700",
    bgColor: "bg-purple-50",
    borderColor: "border-purple-200",
  },
  documentacao_complementar: {
    label: "Documentação Complementar",
    icon: Paperclip,
    color: "text-slate-700",
    bgColor: "bg-slate-50",
    borderColor: "border-slate-200",
  },
  proposta: {
    label: "Proposta Comercial",
    icon: FileText,
    color: "text-indigo-700",
    bgColor: "bg-indigo-50",
    borderColor: "border-indigo-200",
  },
};

const KEY_INFO_ICONS: Record<string, React.ElementType> = {
  "Objeto / Escopo": ShieldCheck,
  "Valor Estimado": DollarSign,
  "Prazo de Entrega / Execução": Clock,
  "Critério de Julgamento": Scale,
  "Forma de Pagamento": CreditCard,
  "Vigência do Contrato": CalendarDays,
  "Local de Entrega / Execução": MapPin,
  "Validade da Proposta": CalendarDays,
};

function KeyInfoCard({ item }: { item: Requirement }) {
  const Icon = KEY_INFO_ICONS[item.title] ?? Info;
  return (
    <div className="flex gap-3 p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide leading-none mb-1">
          {item.title}
        </p>
        <p className="text-sm font-medium text-slate-800 leading-snug">
          {item.description ?? "Não informado no edital"}
        </p>
        {item.needsReview && (
          <span className="inline-flex items-center gap-1 mt-1 text-xs text-amber-700 font-medium">
            <AlertTriangle className="w-3 h-3" /> Verificar manualmente
          </span>
        )}
      </div>
    </div>
  );
}

function RequirementItem({ req }: { req: Requirement }) {
  const [expanded, setExpanded] = useState(false);
  const showExpand = !!(req.description || req.sourceExcerpt);

  return (
    <div
      className={cn(
        "border rounded-lg overflow-hidden transition-shadow",
        req.needsReview ? "border-amber-200 bg-amber-50/30" : "border-slate-200 bg-white"
      )}
    >
      <div
        className={cn(
          "flex items-start gap-3 p-3.5",
          showExpand && "cursor-pointer hover:bg-slate-50/80"
        )}
        onClick={() => showExpand && setExpanded(!expanded)}
      >
        <div className="mt-0.5">
          {req.needsReview ? (
            <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-slate-300 flex-shrink-0" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-slate-800">{req.title}</span>
            {!req.mandatory && (
              <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-md">
                Opcional
              </span>
            )}
            {req.needsReview && (
              <span className="text-[10px] font-semibold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-md">
                Revisar
              </span>
            )}
            {req.confidence < 0.8 && (
              <span className="text-[10px] font-semibold text-slate-400 bg-slate-50 border px-1.5 py-0.5 rounded-md">
                {Math.round(req.confidence * 100)}% confiança
              </span>
            )}
          </div>
        </div>
        {showExpand && (
          <div className="flex-shrink-0 text-slate-400 mt-0.5">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        )}
      </div>

      {expanded && showExpand && (
        <div className="px-3.5 pb-3.5 pt-0 space-y-2.5 border-t border-slate-100 mt-0 bg-slate-50/50">
          {req.description && (
            <div className="pt-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                Descrição
              </p>
              <p className="text-sm text-slate-700 leading-relaxed">{req.description}</p>
            </div>
          )}
          {req.sourceExcerpt && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                Trecho do edital
              </p>
              <blockquote className="border-l-2 border-primary/40 pl-3 text-xs text-slate-600 italic leading-relaxed">
                "{req.sourceExcerpt}"
              </blockquote>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CategorySection({ categoryKey, requirements }: { categoryKey: string; requirements: Requirement[] }) {
  const [open, setOpen] = useState(true);
  const config = CATEGORY_CONFIG[categoryKey] ?? {
    label: categoryKey,
    icon: FileText,
    color: "text-slate-700",
    bgColor: "bg-slate-50",
    borderColor: "border-slate-200",
  };
  const Icon = config.icon;
  const reviewCount = requirements.filter((r) => r.needsReview).length;

  return (
    <div className={cn("rounded-xl border overflow-hidden", config.borderColor)}>
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors",
          config.bgColor,
          "hover:brightness-95"
        )}
      >
        <Icon className={cn("w-5 h-5 flex-shrink-0", config.color)} />
        <span className={cn("font-bold text-sm flex-1", config.color)}>{config.label}</span>
        <div className="flex items-center gap-2">
          {reviewCount > 0 && (
            <span className="text-xs font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
              {reviewCount} revisar
            </span>
          )}
          <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full", config.bgColor, config.color, "border", config.borderColor)}>
            {requirements.length}
          </span>
          {open ? (
            <ChevronUp className={cn("w-4 h-4", config.color)} />
          ) : (
            <ChevronDown className={cn("w-4 h-4", config.color)} />
          )}
        </div>
      </button>

      {open && (
        <div className="p-3 space-y-2 bg-white">
          {requirements.map((req) => (
            <RequirementItem key={req.id} req={req} />
          ))}
        </div>
      )}
    </div>
  );
}

export function RequirementsReviewPanel({ requirements }: { requirements: Requirement[] }) {
  const keyInfo = requirements.filter((r) => r.category === "informacao_principal");
  const docRequirements = requirements.filter((r) => r.category !== "informacao_principal");

  const grouped = docRequirements.reduce<Record<string, Requirement[]>>((acc, req) => {
    const cat = req.category ?? "documentacao_complementar";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(req);
    return acc;
  }, {});

  const categoryOrder = [
    "habilitacao_juridica",
    "habilitacao_fiscal",
    "habilitacao_financeira",
    "qualificacao_tecnica",
    "proposta",
    "documentacao_complementar",
  ];

  const sortedCategories = [
    ...categoryOrder.filter((c) => grouped[c]),
    ...Object.keys(grouped).filter((c) => !categoryOrder.includes(c)),
  ];

  const totalReview = docRequirements.filter((r) => r.needsReview).length;

  return (
    <div className="space-y-6">
      {keyInfo.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Info className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">
              Informações Principais
            </h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {keyInfo.map((item) => (
              <KeyInfoCard key={item.id} item={item} />
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">
              Exigências Documentais
            </h3>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <span className="bg-slate-100 px-2 py-0.5 rounded-full">{docRequirements.length} exigências</span>
            {totalReview > 0 && (
              <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                {totalReview} para revisar
              </span>
            )}
          </div>
        </div>
        <div className="space-y-3">
          {sortedCategories.map((cat) => (
            <CategorySection key={cat} categoryKey={cat} requirements={grouped[cat]!} />
          ))}
        </div>
      </div>
    </div>
  );
}

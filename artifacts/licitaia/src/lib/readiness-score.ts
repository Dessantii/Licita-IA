// ── Tipos ─────────────────────────────────────────────────────────────────────

export type ReadinessCategory = "incompleto" | "em_andamento" | "quase_pronto" | "pronto";

export interface ReadinessResult {
  score: number; // 0–100 (inteiro)
  category: ReadinessCategory;
  label: string;
  /** itens com status "ok" */
  ok: number;
  /** itens bloqueantes (faltando / pendente) */
  faltando: number;
  /** itens com prazo expirado */
  vencido: number;
  /** itens com divergência ou incompletos */
  outros: number;
  /** total de itens na conferência */
  total: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<ReadinessCategory, string> = {
  incompleto: "Incompleto",
  em_andamento: "Em andamento",
  quase_pronto: "Quase pronto",
  pronto: "Pronto para envio",
};

function getCategory(score: number): ReadinessCategory {
  if (score >= 100) return "pronto";
  if (score >= 80) return "quase_pronto";
  if (score >= 50) return "em_andamento";
  return "incompleto";
}

// ── Licitações ────────────────────────────────────────────────────────────────

/** Scores de fluxo (antes da conferência) */
const LICITACAO_STATUS_SCORES: Record<string, number> = {
  criado: 5,
  edital_enviado: 15,
  edital_processando: 20,
  exigencias_extraidas: 30,
  aguardando_documentos: 35,
  documentos_enviados: 45,
};

interface ValidationItemForScore {
  status: string;
  requirement?: { mandatory?: boolean | null } | null;
}

/**
 * Calcula o Score de Prontidão para um processo de Licitação.
 *
 * Fórmula:
 * - Sem itens de conferência: usa score de fluxo (5–45%)
 * - Com itens: 50% base + 50% qualidade ponderada
 *   · Itens obrigatórios valem 70% do bloco de qualidade
 *   · Itens opcionais  valem 30% do bloco de qualidade
 */
export function computeLicitacaoReadiness(
  status: string,
  validationItems: ValidationItemForScore[],
): ReadinessResult {
  const total = validationItems.length;

  // Antes da conferência — score baseado no status
  if (total === 0) {
    const score = LICITACAO_STATUS_SCORES[status] ?? 5;
    const category = getCategory(score);
    return { score, category, label: CATEGORY_LABELS[category], ok: 0, faltando: 0, vencido: 0, outros: 0, total: 0 };
  }

  // Durante / após conferência
  const mandatory = validationItems.filter((v) => v.requirement?.mandatory !== false);
  const optional = validationItems.filter((v) => v.requirement?.mandatory === false);

  const mandatoryOk = mandatory.filter((v) => v.status === "ok").length;
  const optionalOk = optional.filter((v) => v.status === "ok").length;

  const mandatoryRate = mandatory.length > 0 ? mandatoryOk / mandatory.length : 1;
  const optionalRate = optional.length > 0 ? optionalOk / optional.length : 1;

  // Qualidade ponderada: 70% mandatory + 30% optional
  const quality = mandatoryRate * 0.7 + optionalRate * 0.3;
  const score = Math.min(100, Math.round(50 + quality * 50));

  const ok = validationItems.filter((v) => v.status === "ok").length;
  const faltando = validationItems.filter((v) => v.status === "faltando").length;
  const vencido = validationItems.filter((v) => v.status === "vencido").length;
  const outros = validationItems.filter((v) => !["ok", "faltando", "vencido"].includes(v.status)).length;

  const category = getCategory(score);
  return { score, category, label: CATEGORY_LABELS[category], ok, faltando, vencido, outros, total };
}

// ── Chamamentos ───────────────────────────────────────────────────────────────

const CHAMAMENTO_STATUS_SCORES: Record<string, number> = {
  criado: 5,
  edital_enviado: 15,
  edital_processando: 20,
  requisitos_extraidos: 30,
  aguardando_documentos: 35,
  documentos_enviados: 45,
};

/**
 * Calcula o Score de Prontidão para um Chamamento.
 * Status "ok" = atendido. Qualquer outro = pendente.
 */
export function computeChamamentoReadiness(
  status: string,
  validationItems: ValidationItemForScore[],
): ReadinessResult {
  const total = validationItems.length;

  if (total === 0) {
    const score = CHAMAMENTO_STATUS_SCORES[status] ?? 5;
    const category = getCategory(score);
    return { score, category, label: CATEGORY_LABELS[category], ok: 0, faltando: 0, vencido: 0, outros: 0, total: 0 };
  }

  const mandatory = validationItems.filter((v) => v.requirement?.mandatory !== false);
  const optional = validationItems.filter((v) => v.requirement?.mandatory === false);

  const mandatoryOk = mandatory.filter((v) => v.status === "ok").length;
  const optionalOk = optional.filter((v) => v.status === "ok").length;

  const mandatoryRate = mandatory.length > 0 ? mandatoryOk / mandatory.length : 1;
  const optionalRate = optional.length > 0 ? optionalOk / optional.length : 1;

  const quality = mandatoryRate * 0.7 + optionalRate * 0.3;
  const score = Math.min(100, Math.round(50 + quality * 50));

  const ok = validationItems.filter((v) => v.status === "ok").length;
  const faltando = validationItems.filter((v) => ["pendente", "faltando"].includes(v.status)).length;
  const vencido = validationItems.filter((v) => v.status === "vencido").length;
  const outros = validationItems.filter((v) => !["ok", "pendente", "faltando", "vencido"].includes(v.status)).length;

  const category = getCategory(score);
  return { score, category, label: CATEGORY_LABELS[category], ok, faltando, vencido, outros, total };
}

// ── Captação de Recursos ──────────────────────────────────────────────────────

const CAPTACAO_TOTAL_SECTIONS = 8;

/**
 * Calcula o Score de Prontidão para um Projeto de Captação.
 *
 * Fórmula:
 * - Seções preenchidas:  (filledCount / 8) * 60 pts  → máx 60
 * - Validação IA:        (nivel_aderencia / 100) * 40 pts  → máx 40
 * - Total: 0–100%
 */
export function computeCaptacaoReadiness(
  filledSections: number,
  validationScore: number | null,
): ReadinessResult {
  const sectionPts = (filledSections / CAPTACAO_TOTAL_SECTIONS) * 60;
  const validationPts = validationScore != null ? (validationScore / 100) * 40 : 0;
  const score = Math.min(100, Math.round(sectionPts + validationPts));

  const faltando = CAPTACAO_TOTAL_SECTIONS - filledSections;
  const category = getCategory(score);

  return {
    score,
    category,
    label: CATEGORY_LABELS[category],
    ok: filledSections,
    faltando,
    vencido: 0,
    outros: 0,
    total: CAPTACAO_TOTAL_SECTIONS,
  };
}

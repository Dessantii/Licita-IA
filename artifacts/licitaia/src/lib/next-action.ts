// ── Tipos ────────────────────────────────────────────────────────────────────

export type Urgency = "alta" | "media" | "baixa" | "concluido";

export interface NextAction {
  title: string;
  description: string;
  urgency: Urgency;
  actionLabel: string;
  /** Identificador de destino (tab, seção, etc.) que o chamador usa */
  targetId?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function plural(n: number, singular: string, plural: string) {
  return n === 1 ? `${n} ${singular}` : `${n} ${plural}`;
}

// ── Licitações ────────────────────────────────────────────────────────────────

interface ValidationItem {
  status: string;
  requirement?: { title: string; mandatory?: boolean } | null;
}

interface ProcessForAction {
  status: string;
  requirements: unknown[];
  validationItems: ValidationItem[];
  editalFiles?: unknown[];
  documentFiles?: unknown[];
}

export function computeProcessNextAction(process: ProcessForAction): NextAction {
  const { status, requirements, validationItems } = process;

  // 1. Processo sem edital
  if (status === "criado") {
    return {
      title: "Enviar o edital do processo",
      description: "Faça o upload do PDF do edital para que a IA extraia os requisitos automaticamente.",
      urgency: "alta",
      actionLabel: "Ir para Documentos",
      targetId: "documentos",
    };
  }

  // 2. Edital enviado — aguardando análise
  if (status === "edital_enviado") {
    return {
      title: "Analisar edital com IA",
      description: "O edital foi recebido. Clique em \"Analisar Edital\" para extrair os requisitos documentais.",
      urgency: "alta",
      actionLabel: "Analisar edital",
      targetId: "analise",
    };
  }

  if (status === "edital_processando") {
    return {
      title: "Processando edital…",
      description: "A IA está extraindo os requisitos. Aguarde alguns instantes.",
      urgency: "baixa",
      actionLabel: "Ver análise",
      targetId: "analise",
    };
  }

  // 3. Exigências extraídas — enviar documentos
  if (status === "exigencias_extraidas" || status === "aguardando_documentos") {
    return {
      title: "Enviar documentos da empresa",
      description: `${requirements.length} ${requirements.length === 1 ? "exigência identificada" : "exigências identificadas"}. Envie os documentos para iniciar a conferência.`,
      urgency: "alta",
      actionLabel: "Enviar documentos",
      targetId: "documentos",
    };
  }

  // 4. Documentos enviados — iniciar conferência
  if (status === "documentos_enviados") {
    return {
      title: "Iniciar conferência documental",
      description: "Documentos recebidos. Execute a conferência automática para verificar pendências.",
      urgency: "alta",
      actionLabel: "Conferir documentos",
      targetId: "documentos",
    };
  }

  // 5. Em conferência ou com pendências — priorizar por tipo
  if (
    status === "em_conferencia" ||
    status === "pendencias_encontradas" ||
    status === "pronto_para_revisao" ||
    status === "concluido"
  ) {
    const faltando = validationItems.filter((v) => v.status === "faltando");
    const vencido = validationItems.filter((v) => v.status === "vencido");
    const divergente = validationItems.filter((v) => v.status === "divergente");
    const revisar = validationItems.filter((v) => v.status === "revisar");

    // Prioridade 1 — itens faltando (bloqueantes)
    if (faltando.length > 0) {
      const first = faltando.find((v) => v.requirement?.mandatory) ?? faltando[0];
      return {
        title: `Documento ausente: ${first.requirement?.title ?? "item obrigatório"}`,
        description: `${plural(faltando.length, "documento faltando", "documentos faltando")}. Resolva antes do protocolo.`,
        urgency: "alta",
        actionLabel: "Ver checklist",
        targetId: "conferencia",
      };
    }

    // Prioridade 2 — documentos vencidos
    if (vencido.length > 0) {
      const first = vencido[0];
      return {
        title: `Documento vencido: ${first.requirement?.title ?? "certidão"}`,
        description: `${plural(vencido.length, "documento vencido", "documentos vencidos")}. Renove e reenvie antes do protocolo.`,
        urgency: "alta",
        actionLabel: "Ver checklist",
        targetId: "conferencia",
      };
    }

    // Prioridade 3 — divergências
    if (divergente.length > 0) {
      return {
        title: "Verificar divergência documental",
        description: `${plural(divergente.length, "documento com dados inconsistentes", "documentos com dados inconsistentes")}.`,
        urgency: "media",
        actionLabel: "Ver checklist",
        targetId: "conferencia",
      };
    }

    // Prioridade 4 — revisão manual
    if (revisar.length > 0) {
      return {
        title: `Revisão manual necessária`,
        description: `${plural(revisar.length, "item marcado para revisão humana", "itens marcados para revisão humana")}.`,
        urgency: "baixa",
        actionLabel: "Revisar itens",
        targetId: "conferencia",
      };
    }

    // Prioridade 5 — tudo ok
    return {
      title: "Processo pronto para protocolo",
      description: "Todos os documentos foram conferidos. Gere o relatório e protocole.",
      urgency: "concluido",
      actionLabel: "Gerar relatório",
      targetId: "conferencia",
    };
  }

  // Fallback
  return {
    title: "Continuar o processo",
    description: "Verifique o estado atual e siga o fluxo de conferência.",
    urgency: "baixa",
    actionLabel: "Ver detalhes",
    targetId: "documentos",
  };
}

// ── Chamamentos ───────────────────────────────────────────────────────────────

interface ChamamentoValidationItem {
  status: string;
  requirement?: { title: string; mandatory?: boolean } | null;
}

interface ChamamentoForAction {
  status: string;
  requirements: unknown[];
  validationItems: ChamamentoValidationItem[];
}

export function computeChamamentoNextAction(notice: ChamamentoForAction): NextAction {
  const { status, requirements, validationItems } = notice;

  if (status === "criado") {
    return {
      title: "Enviar edital do chamamento",
      description: "Faça o upload do edital para extrair os requisitos automaticamente.",
      urgency: "alta",
      actionLabel: "Enviar edital",
      targetId: "edital",
    };
  }

  if (status === "edital_enviado") {
    return {
      title: "Analisar edital com IA",
      description: "O edital foi recebido. Clique em \"Analisar Edital\" para extrair os requisitos da OSC.",
      urgency: "alta",
      actionLabel: "Analisar edital",
      targetId: "requisitos",
    };
  }

  if (status === "edital_processando") {
    return {
      title: "Processando edital…",
      description: "A IA está extraindo os requisitos do chamamento. Aguarde.",
      urgency: "baixa",
      actionLabel: "Aguardar",
      targetId: "requisitos",
    };
  }

  if (status === "requisitos_extraidos" || status === "aguardando_documentos") {
    return {
      title: "Enviar documentos da OSC",
      description: `${requirements.length} ${requirements.length === 1 ? "requisito identificado" : "requisitos identificados"}. Envie os documentos para conferência.`,
      urgency: "alta",
      actionLabel: "Enviar documentos",
      targetId: "documentos",
    };
  }

  if (status === "documentos_enviados") {
    return {
      title: "Conferir documentos da OSC",
      description: "Documentos recebidos. Execute a conferência automática.",
      urgency: "alta",
      actionLabel: "Conferir agora",
      targetId: "documentos",
    };
  }

  if (
    status === "em_conferencia" ||
    status === "pendencias_encontradas" ||
    status === "pronto_para_submissao" ||
    status === "concluido"
  ) {
    const pendente = validationItems.filter((v) => v.status === "pendente");
    const vencido = validationItems.filter((v) => v.status === "vencido");
    const incompleto = validationItems.filter((v) => v.status === "incompleto");
    const divergente = validationItems.filter((v) => v.status === "divergente");
    const revisar = validationItems.filter((v) => v.status === "revisar_manualmente");

    if (pendente.length > 0) {
      const first = pendente[0];
      return {
        title: `Documento pendente: ${first.requirement?.title ?? "item obrigatório"}`,
        description: `${plural(pendente.length, "requisito sem documento", "requisitos sem documento")}.`,
        urgency: "alta",
        actionLabel: "Ver checklist",
        targetId: "checklist",
      };
    }
    if (vencido.length > 0) {
      const first = vencido[0];
      return {
        title: `Documento vencido: ${first.requirement?.title ?? "certidão"}`,
        description: `${plural(vencido.length, "documento com prazo expirado", "documentos com prazo expirado")}.`,
        urgency: "alta",
        actionLabel: "Ver checklist",
        targetId: "checklist",
      };
    }
    if (incompleto.length > 0) {
      return {
        title: "Completar documentação parcial",
        description: `${plural(incompleto.length, "documento enviado incompleto", "documentos enviados incompletos")}.`,
        urgency: "media",
        actionLabel: "Ver checklist",
        targetId: "checklist",
      };
    }
    if (divergente.length > 0) {
      return {
        title: "Verificar divergência nos documentos",
        description: `${plural(divergente.length, "documento com dados inconsistentes", "documentos com dados inconsistentes")}.`,
        urgency: "media",
        actionLabel: "Ver checklist",
        targetId: "checklist",
      };
    }
    if (revisar.length > 0) {
      return {
        title: "Revisão manual necessária",
        description: `${plural(revisar.length, "item requer verificação humana", "itens requerem verificação humana")}.`,
        urgency: "baixa",
        actionLabel: "Revisar itens",
        targetId: "checklist",
      };
    }

    return {
      title: "Documentação completa — pronta para submissão",
      description: "Todos os requisitos foram atendidos. Submeta a proposta ao órgão.",
      urgency: "concluido",
      actionLabel: "Ver conferência",
      targetId: "checklist",
    };
  }

  return {
    title: "Continuar o chamamento",
    description: "Verifique o estado atual e siga o fluxo.",
    urgency: "baixa",
    actionLabel: "Ver detalhes",
    targetId: "edital",
  };
}

// ── Captação de Recursos ──────────────────────────────────────────────────────

const TOTAL_SECTIONS = 8;

interface ProjectSection {
  content: string | null;
}

interface ValidationResult {
  nivel_aderencia: number;
}

export function computeProjectNextAction(
  sections: Map<string, ProjectSection>,
  validation: ValidationResult | null,
): NextAction {
  const filledCount = [...sections.values()].filter((s) => s.content?.trim()).length;

  // Nenhuma seção preenchida
  if (filledCount === 0) {
    return {
      title: "Escrever a primeira seção do projeto",
      description: "Comece pela seção \"Problema\" para estruturar sua proposta de forma estratégica.",
      urgency: "alta",
      actionLabel: "Começar a escrever",
      targetId: "problema",
    };
  }

  // Menos da metade preenchida
  if (filledCount < Math.ceil(TOTAL_SECTIONS / 2)) {
    const missing = TOTAL_SECTIONS - filledCount;
    return {
      title: `Completar seções restantes`,
      description: `${plural(filledCount, "seção preenchida", "seções preenchidas")} de ${TOTAL_SECTIONS}. ${missing} ainda pendentes.`,
      urgency: "alta",
      actionLabel: "Continuar editando",
      targetId: "editor",
    };
  }

  // Mais da metade, mas não tudo
  if (filledCount < TOTAL_SECTIONS) {
    const missing = TOTAL_SECTIONS - filledCount;
    return {
      title: `${plural(missing, "seção incompleta", "seções incompletas")}`,
      description: `Finalize todas as ${TOTAL_SECTIONS} seções antes de validar e exportar.`,
      urgency: "media",
      actionLabel: "Completar seções",
      targetId: "editor",
    };
  }

  // Todas preenchidas — sem validação
  if (!validation) {
    return {
      title: "Validar projeto contra o edital",
      description: "Todas as seções estão preenchidas. Valide a aderência ao edital antes de exportar.",
      urgency: "media",
      actionLabel: "Validar agora",
      targetId: "validacao",
    };
  }

  const score = validation.nivel_aderencia;

  // Score crítico
  if (score < 50) {
    return {
      title: "Aderência crítica — revisar pontos levantados pela IA",
      description: `Score ${score}%. A IA identificou problemas importantes que podem comprometer a aprovação.`,
      urgency: "alta",
      actionLabel: "Ver análise",
      targetId: "validacao",
    };
  }

  // Score moderado
  if (score < 75) {
    return {
      title: "Melhorar aderência ao edital",
      description: `Score ${score}%. Há pontos de melhoria identificados pela IA. Aplique as sugestões e revalide.`,
      urgency: "media",
      actionLabel: "Ver sugestões",
      targetId: "validacao",
    };
  }

  // Score alto — pronto
  return {
    title: "Projeto pronto para submissão",
    description: `Score de aderência ${score}%. Exporte o PDF profissional e submeta ao edital.`,
    urgency: "concluido",
    actionLabel: "Exportar PDF",
    targetId: "export",
  };
}

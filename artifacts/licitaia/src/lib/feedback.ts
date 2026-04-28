/**
 * Catálogo centralizado de mensagens de feedback.
 *
 * Cada mensagem responde:
 *   1. O que aconteceu
 *   2. Por que importa / consequência
 *   3. O que fazer a seguir
 *
 * Uso:
 *   const { toast } = useToast();
 *   notify(toast, "edital_uploaded");
 *   notify(toast, "doc_upload_error", { description: "Arquivo muito grande." });
 */

export type FeedbackType = "success" | "error" | "warning" | "info";

export interface FeedbackMessage {
  title: string;
  description?: string;
  type: FeedbackType;
}

// ─────────────────────────────────────────────────────────────────────────────
// Catálogo de mensagens
// ─────────────────────────────────────────────────────────────────────────────

export const MESSAGES = {

  // ── Licitações — Edital ──────────────────────────────────────────────────
  edital_uploaded: {
    type: "success",
    title: "Edital recebido",
    description: "Clique em \"Analisar Edital\" para extrair os requisitos automaticamente.",
  },
  edital_upload_error: {
    type: "error",
    title: "Falha no envio do edital",
    description: "Verifique se o arquivo é um PDF válido e tente novamente.",
  },
  edital_analyzed: {
    type: "success",
    title: "Exigências extraídas",
    description: "Envie os documentos da empresa para iniciar a conferência.",
  },
  edital_analyze_error: {
    type: "error",
    title: "Não foi possível analisar o edital",
    description: "Verifique se o arquivo está legível e tente novamente.",
  },

  // ── Licitações — Documentos & Conferência ────────────────────────────────
  doc_uploaded: {
    type: "success",
    title: "Documento enviado",
    description: "Quando todos estiverem prontos, clique em \"Conferir Documentos\".",
  },
  doc_upload_error: {
    type: "error",
    title: "Falha no envio do documento",
    description: "Verifique o formato e o tamanho do arquivo e tente novamente.",
  },
  file_removed: {
    type: "success",
    title: "Arquivo removido",
  },
  file_remove_error: {
    type: "error",
    title: "Não foi possível remover o arquivo",
    description: "Tente novamente. Se o problema persistir, recarregue a página.",
  },
  docs_checked: {
    type: "success",
    title: "Conferência concluída",
    description: "Verifique as pendências no checklist e resolva antes do protocolo.",
  },
  docs_check_error: {
    type: "error",
    title: "Falha na conferência de documentos",
    description: "Verifique se os documentos estão legíveis e tente novamente.",
  },

  // ── Licitações — Processo CRUD ───────────────────────────────────────────
  process_created: {
    type: "success",
    title: "Processo criado",
    description: "Envie o edital para começar a extração de exigências.",
  },
  process_create_error: {
    type: "error",
    title: "Não foi possível criar o processo",
    description: "Verifique os dados e tente novamente.",
  },
  process_updated: {
    type: "success",
    title: "Processo atualizado",
  },
  process_update_error: {
    type: "error",
    title: "Não foi possível salvar as alterações",
    description: "Tente novamente. Se o problema persistir, recarregue a página.",
  },
  process_deleted: {
    type: "success",
    title: "Processo excluído",
  },
  process_delete_error: {
    type: "error",
    title: "Não foi possível excluir o processo",
    description: "Tente novamente.",
  },

  // ── Chamamentos ──────────────────────────────────────────────────────────
  chamamento_edital_uploaded: {
    type: "success",
    title: "Edital do chamamento recebido",
    description: "Clique em \"Analisar Edital\" para extrair os requisitos da OSC.",
  },
  chamamento_edital_upload_error: {
    type: "error",
    title: "Falha no envio do edital",
    description: "Verifique se o arquivo é um PDF válido e tente novamente.",
  },
  chamamento_doc_uploaded: {
    type: "success",
    title: "Documento da OSC enviado",
    description: "Quando todos estiverem prontos, clique em \"Conferir Documentos\".",
  },
  chamamento_doc_upload_error: {
    type: "error",
    title: "Falha no envio do documento",
    description: "Verifique o formato e o tamanho do arquivo.",
  },
  chamamento_file_removed: {
    type: "success",
    title: "Arquivo removido",
  },
  chamamento_file_remove_error: {
    type: "error",
    title: "Não foi possível remover o arquivo",
    description: "Tente novamente.",
  },
  chamamento_analyzed: {
    type: "success",
    title: "Requisitos extraídos",
    description: "Envie os documentos da OSC para iniciar a conferência.",
  },
  chamamento_analyze_error: {
    type: "error",
    title: "Não foi possível analisar o edital",
    description: "Verifique se o arquivo está legível e tente novamente.",
  },
  chamamento_docs_checked: {
    type: "success",
    title: "Conferência da OSC concluída",
    description: "Acesse o checklist para ver pendências e preparar a submissão.",
  },
  chamamento_docs_check_error: {
    type: "error",
    title: "Falha na conferência de documentos",
    description: "Verifique os documentos enviados e tente novamente.",
  },
  chamamento_deleted: {
    type: "success",
    title: "Chamamento excluído",
  },
  chamamento_delete_error: {
    type: "error",
    title: "Não foi possível excluir o chamamento",
    description: "Tente novamente.",
  },

  // ── Captação de Recursos ─────────────────────────────────────────────────
  project_load_error: {
    type: "error",
    title: "Não foi possível carregar o projeto",
    description: "Verifique sua conexão e recarregue a página.",
  },
  section_context_missing: {
    type: "warning",
    title: "Contexto do projeto obrigatório",
    description: "Descreva a empresa, experiência e localização antes de gerar conteúdo.",
  },
  section_generated: {
    type: "success",
    title: "Seção gerada pela IA",
    description: "Revise o conteúdo e clique em Salvar quando estiver satisfeito.",
  },
  section_generate_error: {
    type: "error",
    title: "Não foi possível gerar a seção",
    description: "Verifique sua conexão e tente novamente.",
  },
  section_rewrite_short: {
    type: "warning",
    title: "Texto insuficiente para reescrita",
    description: "Escreva pelo menos um parágrafo completo antes de usar esta função.",
  },
  section_rewritten: {
    type: "success",
    title: "Texto reescrito pela IA",
    description: "Compare com a versão anterior e salve se preferir.",
  },
  section_rewrite_error: {
    type: "error",
    title: "Não foi possível reescrever a seção",
    description: "Verifique sua conexão e tente novamente.",
  },
  project_export_error: {
    type: "error",
    title: "Falha ao gerar o PDF",
    description: "Verifique se todas as seções têm conteúdo e tente novamente.",
  },
  project_validate_error: {
    type: "error",
    title: "Não foi possível validar o projeto",
    description: "Verifique se há seções preenchidas e tente novamente.",
  },

  // ── Checklist ────────────────────────────────────────────────────────────
  checklist_item_updated: {
    type: "success",
    title: "Item atualizado no checklist",
  },
  checklist_item_update_error: {
    type: "error",
    title: "Não foi possível atualizar o item",
    description: "Tente novamente.",
  },
  kit_generated: {
    type: "success",
    title: "Kit de documentos gerado",
    description: "O arquivo está pronto para download e envio ao órgão.",
  },
  kit_generate_error: {
    type: "error",
    title: "Não foi possível gerar o kit",
    description: "Verifique os documentos do checklist e tente novamente.",
  },

  // ── Empresa ──────────────────────────────────────────────────────────────
  company_created: {
    type: "success",
    title: "Empresa cadastrada",
    description: "Adicione os documentos da empresa para usá-la nas conferências.",
  },
  company_create_error: {
    type: "error",
    title: "Não foi possível cadastrar a empresa",
    description: "Verifique os dados e tente novamente.",
  },
  company_updated: {
    type: "success",
    title: "Dados da empresa atualizados",
  },
  company_update_error: {
    type: "error",
    title: "Não foi possível salvar os dados da empresa",
    description: "Tente novamente.",
  },
  company_deleted: {
    type: "success",
    title: "Empresa excluída",
  },
  company_delete_error: {
    type: "error",
    title: "Não foi possível excluir a empresa",
    description: "Tente novamente.",
  },
  company_doc_uploaded: {
    type: "success",
    title: "Documento enviado",
    description: "O documento já está disponível para conferências.",
  },
  company_doc_upload_error: {
    type: "error",
    title: "Falha no envio do documento",
    description: "Verifique o formato e o tamanho do arquivo.",
  },
  company_doc_removed: {
    type: "success",
    title: "Documento removido",
  },
  company_doc_remove_error: {
    type: "error",
    title: "Não foi possível remover o documento",
    description: "Tente novamente.",
  },

  // ── Usuários ─────────────────────────────────────────────────────────────
  user_created: {
    type: "success",
    title: "Usuário criado com sucesso",
    description: "O acesso já está disponível para o novo usuário.",
  },
  user_create_error: {
    type: "error",
    title: "Não foi possível criar o usuário",
    description: "Verifique se o e-mail já está em uso e tente novamente.",
  },
  user_removed: {
    type: "success",
    title: "Usuário removido",
  },
  user_remove_error: {
    type: "error",
    title: "Não foi possível remover o usuário",
    description: "Tente novamente.",
  },
  user_load_error: {
    type: "error",
    title: "Não foi possível carregar os usuários",
    description: "Verifique sua conexão e recarregue a página.",
  },
  user_role_changed: {
    type: "success",
    title: "Função do usuário alterada",
  },
  user_role_change_error: {
    type: "error",
    title: "Não foi possível alterar a função",
    description: "Tente novamente.",
  },
  user_password_reset: {
    type: "success",
    title: "Senha redefinida com sucesso",
  },
  user_password_reset_error: {
    type: "error",
    title: "Não foi possível redefinir a senha",
    description: "Tente novamente.",
  },

  // ── Perfil & Configurações ────────────────────────────────────────────────
  profile_updated: {
    type: "success",
    title: "Perfil atualizado",
  },
  profile_update_error: {
    type: "error",
    title: "Não foi possível atualizar o perfil",
    description: "Tente novamente.",
  },
  password_changed: {
    type: "success",
    title: "Senha alterada com sucesso",
    description: "Use a nova senha no próximo login.",
  },
  password_change_error: {
    type: "error",
    title: "Não foi possível alterar a senha",
    description: "Tente novamente.",
  },
  password_mismatch: {
    type: "error",
    title: "As senhas não coincidem",
    description: "Verifique os campos \"Nova senha\" e \"Confirmar senha\".",
  },
  password_too_short: {
    type: "error",
    title: "Senha muito curta",
    description: "A senha deve ter pelo menos 6 caracteres.",
  },
  settings_saved: {
    type: "success",
    title: "Configurações salvas",
  },
  settings_save_error: {
    type: "error",
    title: "Não foi possível salvar as configurações",
    description: "Tente novamente.",
  },
  connection_error: {
    type: "error",
    title: "Erro de conexão",
    description: "Verifique sua internet e tente novamente.",
  },
  load_error: {
    type: "error",
    title: "Não foi possível carregar os dados",
    description: "Verifique sua conexão e recarregue a página.",
  },
  pdf_only: {
    type: "warning",
    title: "Formato inválido — somente PDF é aceito",
    description: "Selecione um arquivo PDF e tente novamente.",
  },

  // ── Chamamentos — Criação ────────────────────────────────────────────────
  chamamento_created: {
    type: "success",
    title: "Chamamento criado",
    description: "Envie o edital para extrair os requisitos da OSC automaticamente.",
  },
  chamamento_create_error: {
    type: "error",
    title: "Não foi possível criar o chamamento",
    description: "Verifique os dados e tente novamente.",
  },
  chamamento_extract_error: {
    type: "error",
    title: "Não foi possível extrair dados do edital",
    description: "Preencha os campos manualmente e continue.",
  },

  // ── Captação — Projetos ──────────────────────────────────────────────────
  project_created: {
    type: "success",
    title: "Projeto criado",
    description: "Preencha as seções e use a IA para gerar o conteúdo.",
  },
  project_create_error: {
    type: "error",
    title: "Não foi possível criar o projeto",
    description: "Verifique os dados e tente novamente.",
  },
  project_title_missing: {
    type: "warning",
    title: "Título obrigatório",
    description: "Informe o título do projeto antes de continuar.",
  },
  project_deleted: {
    type: "success",
    title: "Projeto excluído",
  },
  project_delete_error: {
    type: "error",
    title: "Não foi possível excluir o projeto",
    description: "Tente novamente.",
  },

  // ── Captação — Editais ───────────────────────────────────────────────────
  funding_notice_deleted: {
    type: "success",
    title: "Edital excluído",
  },
  funding_notice_delete_error: {
    type: "error",
    title: "Não foi possível excluir o edital",
    description: "Tente novamente.",
  },
  funding_notice_processed: {
    type: "success",
    title: "Edital processado com sucesso",
    description: "Os requisitos foram extraídos e estão disponíveis para conferência.",
  },
  funding_notice_process_error: {
    type: "error",
    title: "Não foi possível processar o edital",
    description: "Verifique se o arquivo está legível e tente novamente.",
  },
  funding_notice_load_error: {
    type: "error",
    title: "Não foi possível carregar os editais",
    description: "Verifique sua conexão e recarregue a página.",
  },

  // ── CNPJ ─────────────────────────────────────────────────────────────────
  cnpj_invalid: {
    type: "warning",
    title: "CNPJ inválido",
    description: "Informe os 14 dígitos do CNPJ sem pontuação.",
  },
  cnpj_not_found: {
    type: "error",
    title: "CNPJ não encontrado na Receita Federal",
    description: "Verifique o número e tente novamente, ou preencha os dados manualmente.",
  },
  cnpj_loaded: {
    type: "success",
    title: "Dados preenchidos automaticamente",
    description: "Confirme as informações e salve a empresa.",
  },

  // ── SICAF ─────────────────────────────────────────────────────────────────
  sicaf_found: {
    type: "success",
    title: "Empresa encontrada no SICAF",
    description: "Os dados de regularidade foram atualizados.",
  },
  sicaf_not_found: {
    type: "warning",
    title: "CNPJ não localizado no SICAF",
    description: "Verifique o CNPJ ou consulte diretamente em comprasnet.gov.br.",
  },
  sicaf_error: {
    type: "error",
    title: "Não foi possível verificar o SICAF",
    description: "Tente novamente ou acesse o SICAF diretamente.",
  },

} as const satisfies Record<string, FeedbackMessage>;

export type MessageKey = keyof typeof MESSAGES;

// ─────────────────────────────────────────────────────────────────────────────
// Helper principal
// ─────────────────────────────────────────────────────────────────────────────

type ToastFn = (opts: {
  title: string;
  description?: string;
  variant?: "default" | "destructive";
}) => void;

/**
 * Chama toast com a mensagem do catálogo.
 *
 * @param toast  função retornada por useToast()
 * @param key    chave do catálogo de mensagens
 * @param override  campos para sobrescrever (title, description)
 */
export function notify(
  toast: ToastFn,
  key: MessageKey,
  override?: Partial<{ title: string; description: string }>,
): void {
  const base = MESSAGES[key];
  const msg = { ...base, ...override };
  toast({
    title: msg.title,
    description: (msg as FeedbackMessage).description,
    variant: msg.type === "error" ? "destructive" : "default",
  });
}

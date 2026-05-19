import { Router, type IRouter } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

const router: IRouter = Router();

const SYSTEM_PROMPT = `Você é um assistente amigável do LicitaIA, uma plataforma para pequenas e médias empresas brasileiras aprenderem a participar de licitações públicas.

Seu objetivo é responder perguntas sobre licitações em linguagem simples, acessível e sem juridiquês. Você está falando com donos de pequenas empresas, MEIs e microempresas que muitas vezes não têm experiência com o processo de compras públicas.

Regras importantes:
- Use linguagem simples e direta, como se estivesse explicando para um amigo
- Evite termos jurídicos. Se precisar usá-los, explique imediatamente o que significam
- Seja empático e encorajador — muitas pessoas têm medo de participar de licitações
- Dê exemplos práticos sempre que possível
- Respostas curtas e objetivas são preferíveis a textos longos
- Foque no contexto brasileiro (legislação federal, PNCP, pregão eletrônico etc.)

Exemplos de troca de linguagem:
- "habilitação" → "documentos que provam que sua empresa está apta"
- "conformidade documental" → "documentos em dia"
- "regularidade fiscal" → "impostos e contribuições em dia"
- "edital" → "anúncio da licitação com todas as regras"
- "certidão negativa" → "documento que comprova que você não tem dívidas"`;

router.post("/ajuda/chat", async (req, res) => {
  const { messages } = req.body;

  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: "Mensagens inválidas" });
    return;
  }

  const validMessages = messages
    .filter((m: { role: string; content: string }) =>
      (m.role === "user" || m.role === "assistant") && typeof m.content === "string"
    )
    .slice(-20);

  if (validMessages.length === 0) {
    res.status(400).json({ error: "Nenhuma mensagem válida" });
    return;
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...validMessages,
      ],
      max_tokens: 600,
      temperature: 0.7,
    });

    const reply = completion.choices[0]?.message?.content ?? "Desculpe, não consegui responder. Tente novamente.";
    res.json({ reply });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("API key") || message.includes("401")) {
      res.status(503).json({ error: "Serviço de IA temporariamente indisponível. Configure a chave de API OpenAI." });
    } else {
      res.status(500).json({ error: "Erro ao processar sua pergunta. Tente novamente." });
    }
  }
});

export default router;

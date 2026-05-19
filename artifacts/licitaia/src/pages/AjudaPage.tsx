import { useState, useRef, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { getToken } from "@/hooks/use-auth";
import { Send, Bot, User, Sparkles } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const QUICK_QUESTIONS = [
  "O que é habilitação em uma licitação?",
  "Quais documentos preciso para participar?",
  "Como sei se minha empresa está regular?",
  "O que é o PNCP?",
  "Como funciona o pregão eletrônico?",
  "Posso participar como MEI?",
];

const WELCOME_MESSAGE: Message = {
  role: "assistant",
  content: "Olá! Sou o assistente do LicitaIA. Pode me perguntar qualquer coisa sobre licitações — vou responder em linguagem simples, sem complicar. O que você quer saber?",
};

export function AjudaPage() {
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const token = getToken();
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return;

    const userMsg: Message = { role: "user", content: text.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/ajuda/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ messages: [...messages, userMsg] }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "Desculpe, não consegui responder agora. Tente novamente em instantes.",
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Desculpe, houve um erro de conexão. Verifique sua internet e tente novamente.",
        },
      ]);
    }

    setLoading(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  return (
    <AppLayout>
      <div className="flex flex-col h-[calc(100vh-56px)]">

        {/* Header */}
        <div
          className="px-5 sm:px-8 py-5 bg-white flex-shrink-0"
          style={{ borderBottom: "1px solid #f1f5f9" }}
        >
          <div className="max-w-2xl mx-auto flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "#eff6ff" }}
            >
              <Bot className="w-4 h-4" style={{ color: "#2563eb" }} />
            </div>
            <div>
              <h1
                className="text-base font-bold text-slate-900"
                style={{ fontFamily: "'Manrope', sans-serif" }}
              >
                Assistente LicitaIA
              </h1>
              <p className="text-xs text-slate-400 flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                Tire dúvidas sobre licitações em linguagem simples
              </p>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-8 py-6">
          <div className="max-w-2xl mx-auto space-y-5">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
              >
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{
                    background: msg.role === "assistant" ? "#eff6ff" : "#f1f5f9",
                  }}
                >
                  {msg.role === "assistant"
                    ? <Bot className="w-3.5 h-3.5" style={{ color: "#2563eb" }} />
                    : <User className="w-3.5 h-3.5 text-slate-500" />
                  }
                </div>
                <div
                  className="max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed"
                  style={{
                    background: msg.role === "assistant" ? "#ffffff" : "#2563eb",
                    color: msg.role === "assistant" ? "#334155" : "#ffffff",
                    border: msg.role === "assistant" ? "1px solid #f1f5f9" : "none",
                    borderRadius: msg.role === "user" ? "18px 4px 18px 18px" : "4px 18px 18px 18px",
                  }}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex gap-3">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: "#eff6ff" }}
                >
                  <Bot className="w-3.5 h-3.5" style={{ color: "#2563eb" }} />
                </div>
                <div
                  className="px-4 py-3 rounded-2xl flex items-center gap-1"
                  style={{ background: "#ffffff", border: "1px solid #f1f5f9", borderRadius: "4px 18px 18px 18px" }}
                >
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="w-1.5 h-1.5 rounded-full bg-slate-300"
                      style={{ animation: `bounce 1s ease-in-out ${i * 0.15}s infinite` }}
                    />
                  ))}
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        </div>

        {/* Quick questions — only show on first message */}
        {messages.length === 1 && (
          <div
            className="px-5 sm:px-8 py-3 bg-white flex-shrink-0"
            style={{ borderTop: "1px solid #f1f5f9" }}
          >
            <div className="max-w-2xl mx-auto">
              <p className="text-xs text-slate-400 mb-2">Perguntas frequentes:</p>
              <div className="flex flex-wrap gap-2">
                {QUICK_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => sendMessage(q)}
                    className="text-xs px-3 py-1.5 rounded-full border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Input */}
        <div
          className="px-5 sm:px-8 py-4 bg-white flex-shrink-0"
          style={{ borderTop: "1px solid #f1f5f9" }}
        >
          <div className="max-w-2xl mx-auto flex items-end gap-3">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Escreva sua dúvida aqui..."
              rows={1}
              className="flex-1 resize-none px-4 py-2.5 rounded-xl text-sm text-slate-800 placeholder-slate-400 outline-none transition-all"
              style={{
                border: "1px solid #e2e8f0",
                maxHeight: "120px",
                lineHeight: "1.5",
              }}
              onFocus={(e) => (e.target.style.borderColor = "#2563eb")}
              onBlur={(e) => (e.target.style.borderColor = "#e2e8f0")}
              onInput={(e) => {
                const t = e.currentTarget;
                t.style.height = "auto";
                t.style.height = `${Math.min(t.scrollHeight, 120)}px`;
              }}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || loading}
              className="w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-150 flex-shrink-0"
              style={{
                background: input.trim() && !loading ? "#2563eb" : "#e2e8f0",
                color: input.trim() && !loading ? "#ffffff" : "#94a3b8",
              }}
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <p className="text-center text-[10px] text-slate-300 mt-2 max-w-2xl mx-auto">
            Enter para enviar · Shift+Enter para nova linha
          </p>
        </div>

      </div>

      <style>{`
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
      `}</style>
    </AppLayout>
  );
}

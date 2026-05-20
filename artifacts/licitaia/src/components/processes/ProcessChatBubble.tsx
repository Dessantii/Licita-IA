import { useState, useRef, useEffect, useCallback } from "react";
import { getToken } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import {
  X, Send, Sparkles, Loader2, ChevronDown, RotateCcw,
  MessageCircle,
} from "lucide-react";

const API = import.meta.env.VITE_API_URL ?? "";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ProcessChatBubbleProps {
  processId: number;
  processTitle: string;
}

const SUGGESTIONS = [
  "Quais documentos ainda estão faltando?",
  "Qual é o prazo de envio da proposta?",
  "O que significa este processo estar em análise?",
  "Como aumentar minhas chances de ganhar?",
  "Quais são as principais exigências do edital?",
];

function TypingIndicator() {
  return (
    <div className="flex items-end gap-2 mb-3">
      <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ background: "linear-gradient(135deg, #0066FF, #0044CC)" }}>
        <Sparkles className="w-3.5 h-3.5 text-white" />
      </div>
      <div className="px-3.5 py-2.5 rounded-2xl rounded-bl-sm bg-white border border-slate-100 shadow-sm">
        <div className="flex gap-1 items-center h-4">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-slate-400"
              style={{
                animation: "bounce 1.2s ease-in-out infinite",
                animationDelay: `${i * 0.2}s`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === "user";
  return (
    <div className={cn("flex items-end gap-2 mb-3", isUser && "flex-row-reverse")}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 self-end"
          style={{ background: "linear-gradient(135deg, #0066FF, #0044CC)" }}>
          <Sparkles className="w-3.5 h-3.5 text-white" />
        </div>
      )}
      <div
        className={cn(
          "max-w-[82%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap",
          isUser
            ? "rounded-br-sm text-white"
            : "rounded-bl-sm bg-white border border-slate-100 text-slate-800 shadow-sm"
        )}
        style={isUser ? { background: "linear-gradient(135deg, #0066FF, #0044CC)" } : {}}
      >
        {msg.content}
      </div>
    </div>
  );
}

export function ProcessChatBubble({ processId, processTitle }: ProcessChatBubbleProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const token = getToken();

  const scrollToBottom = useCallback((smooth = true) => {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => { inputRef.current?.focus(); scrollToBottom(false); }, 100);
    }
  }, [open, scrollToBottom]);

  useEffect(() => {
    if (messages.length > 0) scrollToBottom();
  }, [messages, loading, scrollToBottom]);

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    setShowScrollBtn(el.scrollHeight - el.scrollTop - el.clientHeight > 80);
  }

  async function sendMessage(text?: string) {
    const content = (text ?? input).trim();
    if (!content || loading) return;

    setInput("");
    const newMessages: Message[] = [...messages, { role: "user", content }];
    setMessages(newMessages);
    setLoading(true);

    try {
      const res = await fetch(`${API}/api/licitaia/ai/processes/${processId}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ messages: newMessages }),
      });

      const data = await res.json();
      const reply = data.reply ?? "Desculpe, não consegui responder. Tente novamente.";
      setMessages(m => [...m, { role: "assistant", content: reply }]);
    } catch {
      setMessages(m => [...m, { role: "assistant", content: "Erro de conexão. Verifique sua internet e tente novamente." }]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function reset() {
    setMessages([]);
    setInput("");
  }

  const shortTitle = processTitle.length > 38 ? processTitle.slice(0, 38) + "…" : processTitle;

  return (
    <>
      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-4px); }
        }
        @keyframes chat-in {
          from { opacity: 0; transform: translateY(16px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .chat-panel-in { animation: chat-in 0.22s cubic-bezier(0.16,1,0.3,1) both; }
        @keyframes bubble-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(0,102,255,0.35); }
          50% { box-shadow: 0 0 0 8px rgba(0,102,255,0); }
        }
        .bubble-pulse { animation: bubble-pulse 2.4s ease-in-out infinite; }
      `}</style>

      {/* Floating chat panel */}
      {open && (
        <div
          className="chat-panel-in fixed z-50 flex flex-col bg-white rounded-2xl overflow-hidden"
          style={{
            bottom: 96,
            right: 24,
            width: 360,
            height: 520,
            boxShadow: "0 8px 40px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.08)",
            border: "1px solid rgba(0,102,255,0.12)",
          }}
        >
          {/* Header */}
          <div
            className="flex items-center gap-2.5 px-4 py-3 flex-shrink-0"
            style={{ background: "linear-gradient(135deg, #0066FF 0%, #0044CC 100%)" }}
          >
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-bold text-sm leading-tight">Assistente LicitaIA</p>
              <p className="text-blue-100 text-xs truncate">{shortTitle}</p>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button
                  onClick={reset}
                  title="Nova conversa"
                  className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/25 transition-colors flex items-center justify-center"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-white" />
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/25 transition-colors flex items-center justify-center"
              >
                <X className="w-3.5 h-3.5 text-white" />
              </button>
            </div>
          </div>

          {/* Messages area */}
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto px-4 py-4"
            style={{ background: "#F6F9FC" }}
          >
            {messages.length === 0 ? (
              <div className="flex flex-col items-center text-center pt-4 pb-2 gap-3">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center"
                  style={{ background: "linear-gradient(135deg, #EFF6FF, #DBEAFE)" }}
                >
                  <Sparkles className="w-7 h-7" style={{ color: "#0066FF" }} />
                </div>
                <div>
                  <p className="font-bold text-slate-900 text-sm mb-1">Como posso ajudar?</p>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Faça perguntas sobre este processo licitatório. Conheço os documentos, prazos e exigências.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 justify-center mt-2">
                  {SUGGESTIONS.map(s => (
                    <button
                      key={s}
                      onClick={() => sendMessage(s)}
                      className="text-xs px-3 py-1.5 rounded-full border font-medium transition-all hover:border-blue-400 hover:text-blue-700 hover:bg-blue-50"
                      style={{ borderColor: "#CBD5E1", color: "#475569", background: "#fff" }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {messages.map((m, i) => <MessageBubble key={i} msg={m} />)}
                {loading && <TypingIndicator />}
              </>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Scroll to bottom */}
          {showScrollBtn && (
            <button
              onClick={() => scrollToBottom()}
              className="absolute left-1/2 -translate-x-1/2 bottom-20 bg-white border border-slate-200 rounded-full p-1 shadow-md hover:shadow-lg transition-all z-10"
            >
              <ChevronDown className="w-4 h-4 text-slate-500" />
            </button>
          )}

          {/* Input area */}
          <div className="flex-shrink-0 px-3 py-3 border-t border-slate-100 bg-white">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Pergunte sobre este processo..."
                rows={1}
                disabled={loading}
                className="flex-1 resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:border-transparent transition-all"
                style={{
                  maxHeight: 100,
                  lineHeight: "1.4",
                  focusRingColor: "#0066FF",
                }}
                onInput={e => {
                  const el = e.currentTarget;
                  el.style.height = "auto";
                  el.style.height = Math.min(el.scrollHeight, 100) + "px";
                }}
              />
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim() || loading}
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all"
                style={{
                  background: input.trim() && !loading ? "linear-gradient(135deg, #0066FF, #0044CC)" : "#E2E8F0",
                  cursor: input.trim() && !loading ? "pointer" : "not-allowed",
                }}
              >
                {loading
                  ? <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                  : <Send className="w-4 h-4" style={{ color: input.trim() ? "#fff" : "#94A3B8" }} />}
              </button>
            </div>
            <p className="text-center text-[10px] text-slate-400 mt-2">
              Responde sobre este processo · Enter para enviar
            </p>
          </div>
        </div>
      )}

      {/* Floating button */}
      <button
        onClick={() => setOpen(o => !o)}
        title="Assistente IA — dúvidas sobre este processo"
        className={cn(
          "fixed z-50 w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300",
          open ? "rotate-0" : "bubble-pulse"
        )}
        style={{
          bottom: 24,
          right: 24,
          background: open
            ? "linear-gradient(135deg, #334155, #1E293B)"
            : "linear-gradient(135deg, #0066FF, #0044CC)",
          boxShadow: open ? "0 4px 16px rgba(0,0,0,0.25)" : "0 4px 20px rgba(0,102,255,0.45)",
        }}
      >
        {open ? (
          <X className="w-5 h-5 text-white" />
        ) : (
          <MessageCircle className="w-6 h-6 text-white" />
        )}
        {!open && messages.length > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-green-500 border-2 border-white text-[9px] font-bold text-white flex items-center justify-center">
            {messages.filter(m => m.role === "assistant").length}
          </span>
        )}
      </button>
    </>
  );
}

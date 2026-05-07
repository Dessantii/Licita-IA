import { useState } from "react";
import { Mail, Clock, MessageSquare, CheckCircle2 } from "lucide-react";

export function ContactSection() {
  const [form, setForm] = useState({ nome: "", email: "", mensagem: "" });
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    await new Promise((r) => setTimeout(r, 900));
    setSent(true);
    setSending(false);
  }

  return (
    <section id="suporte" style={{ background: "#08101e", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
      <div className="py-16 sm:py-24">
        <div className="max-w-7xl mx-auto px-5 sm:px-6">
          <div className="text-center mb-10 sm:mb-14">
            <div
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium mb-5 sm:mb-6"
              style={{ background: "rgba(6,182,212,0.1)", border: "1px solid rgba(6,182,212,0.2)", color: "#22d3ee" }}
            >
              Suporte
            </div>
            <h2
              className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4"
              style={{ fontFamily: "'Manrope', sans-serif", color: "#ffffff" }}
            >
              Fale com a gente
            </h2>
            <p className="text-sm sm:text-base max-w-lg mx-auto" style={{ color: "rgba(255,255,255,0.45)" }}>
              Tire suas dúvidas, solicite suporte ou envie uma mensagem. Respondemos rapidamente.
            </p>
          </div>

          <div className="max-w-5xl mx-auto grid md:grid-cols-5 gap-6 md:gap-10">
            {/* Info */}
            <div className="md:col-span-2 space-y-4 sm:space-y-6">
              <div
                className="rounded-2xl p-5 sm:p-6"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
              >
                <div className="space-y-5">
                  <div className="flex items-start gap-3 sm:gap-4">
                    <div
                      className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: "rgba(13,148,136,0.15)" }}
                    >
                      <Mail className="w-4 h-4 text-teal-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium mb-0.5" style={{ color: "#ffffff" }}>E-mail de suporte</p>
                      <a
                        href="mailto:suporte@licitaia.com.br"
                        className="text-xs sm:text-sm transition-colors hover:text-teal-400 break-all"
                        style={{ color: "rgba(255,255,255,0.5)" }}
                      >
                        suporte@licitaia.com.br
                      </a>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 sm:gap-4">
                    <div
                      className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: "rgba(6,182,212,0.15)" }}
                    >
                      <Clock className="w-4 h-4 text-cyan-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium mb-0.5" style={{ color: "#ffffff" }}>Horário de atendimento</p>
                      <p className="text-xs sm:text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
                        Segunda a sexta<br />das 9h às 18h (BRT)
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 sm:gap-4">
                    <div
                      className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: "rgba(139,92,246,0.15)" }}
                    >
                      <MessageSquare className="w-4 h-4 text-violet-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium mb-0.5" style={{ color: "#ffffff" }}>Resposta garantida</p>
                      <p className="text-xs sm:text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
                        Respondemos em até<br />1 dia útil
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div
                className="rounded-2xl p-5 sm:p-6"
                style={{ background: "rgba(13,148,136,0.06)", border: "1px solid rgba(13,148,136,0.15)" }}
              >
                <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.55)" }}>
                  O LicitaIA é desenvolvido para simplificar a participação em processos
                  públicos. Nosso time está pronto para auxiliar na configuração, dúvidas
                  operacionais e customizações.
                </p>
              </div>
            </div>

            {/* Form */}
            <div className="md:col-span-3">
              <div
                className="rounded-2xl p-5 sm:p-8"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
              >
                {sent ? (
                  <div className="flex flex-col items-center justify-center py-10 sm:py-12 text-center">
                    <div
                      className="w-14 h-14 rounded-full flex items-center justify-center mb-4"
                      style={{ background: "rgba(13,148,136,0.15)" }}
                    >
                      <CheckCircle2 className="w-7 h-7 text-teal-400" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2" style={{ color: "#ffffff" }}>Mensagem enviada!</h3>
                    <p className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
                      Retornaremos em até 1 dia útil no e-mail informado.
                    </p>
                    <button
                      onClick={() => { setSent(false); setForm({ nome: "", email: "", mensagem: "" }); }}
                      className="mt-6 text-sm underline transition-colors hover:text-teal-400"
                      style={{ color: "rgba(255,255,255,0.4)" }}
                    >
                      Enviar outra mensagem
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium mb-1.5" style={{ color: "rgba(255,255,255,0.5)" }}>
                          Nome
                        </label>
                        <input
                          type="text"
                          required
                          value={form.nome}
                          onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                          placeholder="Seu nome"
                          className="w-full px-4 py-2.5 rounded-xl text-sm outline-none transition-all"
                          style={{
                            background: "rgba(255,255,255,0.05)",
                            border: "1px solid rgba(255,255,255,0.1)",
                            color: "#ffffff",
                          }}
                          onFocus={(e) => (e.target.style.borderColor = "rgba(13,148,136,0.6)")}
                          onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1.5" style={{ color: "rgba(255,255,255,0.5)" }}>
                          E-mail
                        </label>
                        <input
                          type="email"
                          required
                          value={form.email}
                          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                          placeholder="seu@email.com"
                          className="w-full px-4 py-2.5 rounded-xl text-sm outline-none transition-all"
                          style={{
                            background: "rgba(255,255,255,0.05)",
                            border: "1px solid rgba(255,255,255,0.1)",
                            color: "#ffffff",
                          }}
                          onFocus={(e) => (e.target.style.borderColor = "rgba(13,148,136,0.6)")}
                          onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={{ color: "rgba(255,255,255,0.5)" }}>
                        Mensagem
                      </label>
                      <textarea
                        required
                        rows={5}
                        value={form.mensagem}
                        onChange={(e) => setForm((f) => ({ ...f, mensagem: e.target.value }))}
                        placeholder="Descreva sua dúvida ou solicitação..."
                        className="w-full px-4 py-2.5 rounded-xl text-sm outline-none transition-all resize-none"
                        style={{
                          background: "rgba(255,255,255,0.05)",
                          border: "1px solid rgba(255,255,255,0.1)",
                          color: "#ffffff",
                        }}
                        onFocus={(e) => (e.target.style.borderColor = "rgba(13,148,136,0.6)")}
                        onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={sending}
                      className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-all duration-200 hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
                      style={{ background: "linear-gradient(135deg, #0d9488 0%, #06b6d4 100%)" }}
                    >
                      {sending ? "Enviando..." : "Enviar mensagem"}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

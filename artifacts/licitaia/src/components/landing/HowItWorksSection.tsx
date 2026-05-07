import { Search, PlusCircle, Brain, Upload, CheckCircle2, Send } from "lucide-react";

const STEPS = [
  {
    icon: Search,
    title: "Monitoramento",
    desc: "Sistema verifica o PNCP e portais automaticamente, 24 horas por dia.",
    color: "#06b6d4",
  },
  {
    icon: PlusCircle,
    title: "Início do processo",
    desc: "Usuário cria o processo vinculando a empresa e o edital identificado.",
    color: "#8b5cf6",
  },
  {
    icon: Brain,
    title: "IA interpreta o edital",
    desc: "Extração automática de exigências, prazos e critérios do documento.",
    color: "#0d9488",
  },
  {
    icon: Upload,
    title: "Envio de documentos",
    desc: "Empresa faz upload dos documentos de habilitação e qualificação.",
    color: "#f59e0b",
  },
  {
    icon: CheckCircle2,
    title: "Validação automática",
    desc: "Sistema compara documentos com exigências e gera relatório de conformidade.",
    color: "#10b981",
  },
  {
    icon: Send,
    title: "Pronto para submissão",
    desc: "Processo completo com checklist aprovado e relatório final gerado.",
    color: "#06b6d4",
  },
];

export function HowItWorksSection() {
  return (
    <section id="como-funciona" style={{ background: "#08101e", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
      <div className="py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <div
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium mb-6"
              style={{ background: "rgba(13,148,136,0.1)", border: "1px solid rgba(13,148,136,0.2)", color: "#2dd4bf" }}
            >
              Processo
            </div>
            <h2
              className="text-3xl md:text-4xl font-bold mb-4"
              style={{ fontFamily: "'Manrope', sans-serif", color: "#ffffff" }}
            >
              Do edital à submissão
            </h2>
            <p className="text-base max-w-xl mx-auto" style={{ color: "rgba(255,255,255,0.45)" }}>
              Um fluxo linear e inteligente que elimina etapas repetitivas e centraliza
              toda a gestão documental em um único lugar.
            </p>
          </div>

          {/* Desktop: horizontal timeline */}
          <div className="hidden lg:block relative">
            {/* Connector line */}
            <div
              className="absolute top-11 left-[calc(100%/12)] right-[calc(100%/12)] h-px"
              style={{ background: "linear-gradient(90deg, transparent 0%, rgba(13,148,136,0.3) 10%, rgba(6,182,212,0.3) 50%, rgba(13,148,136,0.3) 90%, transparent 100%)" }}
            />

            <div className="grid grid-cols-6 gap-4">
              {STEPS.map(({ icon: Icon, title, desc, color }, i) => (
                <div key={title} className="flex flex-col items-center text-center">
                  <div className="relative mb-5 z-10">
                    <div
                      className="w-[52px] h-[52px] rounded-2xl flex items-center justify-center"
                      style={{ background: "#08101e", border: `2px solid ${color}50` }}
                    >
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{ background: `${color}18` }}
                      >
                        <Icon className="w-5 h-5" style={{ color }} />
                      </div>
                    </div>
                    <div
                      className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                      style={{ background: color, color: "#060c18" }}
                    >
                      {i + 1}
                    </div>
                  </div>
                  <h3 className="text-sm font-semibold mb-1.5" style={{ color: "#ffffff" }}>{title}</h3>
                  <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.45)" }}>{desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Mobile: vertical list */}
          <div className="lg:hidden space-y-4">
            {STEPS.map(({ icon: Icon, title, desc, color }, i) => (
              <div
                key={title}
                className="flex gap-4 rounded-2xl p-5"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
              >
                <div className="relative flex-shrink-0">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center"
                    style={{ background: `${color}18` }}
                  >
                    <Icon className="w-5 h-5" style={{ color }} />
                  </div>
                  <div
                    className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold"
                    style={{ background: color, color: "#060c18" }}
                  >
                    {i + 1}
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-semibold mb-1" style={{ color: "#ffffff" }}>{title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.45)" }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

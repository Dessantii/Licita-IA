import { X, Check } from "lucide-react";

const OTHERS = [
  "Lista oportunidades sem contexto",
  "Sem gestão documental integrada",
  "Não faz conferência automática",
  "Sem rastreamento de validade",
  "Relatórios genéricos",
  "Processos isolados por módulo",
];

const OURS = [
  "Monitora e organiza todo o ciclo operacional",
  "Biblioteca documental centralizada por empresa",
  "Conferência com IA e score de prontidão",
  "Alertas automáticos de vencimento",
  "Relatório final estruturado por processo",
  "Fluxo integrado do edital à submissão",
];

export function DifferentiatorSection() {
  return (
    <section id="diferencial" style={{ background: "#060c18", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
      <div className="py-16 sm:py-24">
        <div className="max-w-7xl mx-auto px-5 sm:px-6">
          <div className="text-center mb-10 sm:mb-14">
            <div
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium mb-5 sm:mb-6"
              style={{ background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.2)", color: "#a78bfa" }}
            >
              Diferencial
            </div>
            <h2
              className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4"
              style={{ fontFamily: "'Manrope', sans-serif", color: "#ffffff" }}
            >
              Mais do que monitoramento
            </h2>
            <p className="text-sm sm:text-base max-w-2xl mx-auto" style={{ color: "rgba(255,255,255,0.45)" }}>
              A maioria das soluções apenas lista oportunidades. O LicitaIA organiza todo o processo
              operacional: monitoramento, interpretação, documentação, validação e submissão.
            </p>
          </div>

          <div className="max-w-3xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
            {/* Others */}
            <div
              className="rounded-2xl p-5 sm:p-7"
              style={{ background: "rgba(239,68,68,0.04)", border: "1px solid rgba(239,68,68,0.12)" }}
            >
              <div className="flex items-center gap-2.5 mb-5">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: "rgba(239,68,68,0.15)" }}
                >
                  <X className="w-4 h-4 text-red-400" />
                </div>
                <span className="text-sm font-semibold" style={{ color: "rgba(255,255,255,0.6)" }}>
                  Outras soluções
                </span>
              </div>
              <ul className="space-y-3">
                {OTHERS.map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <X className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-red-500/70" />
                    <span className="text-xs sm:text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* LicitaIA */}
            <div
              className="rounded-2xl p-5 sm:p-7 relative overflow-hidden"
              style={{ background: "rgba(13,148,136,0.06)", border: "1px solid rgba(13,148,136,0.2)" }}
            >
              <div
                className="absolute top-0 right-0 w-32 h-32 rounded-full pointer-events-none"
                style={{ background: "radial-gradient(circle, rgba(6,182,212,0.1) 0%, transparent 70%)", transform: "translate(30%, -30%)" }}
              />
              <div className="flex items-center gap-2.5 mb-5">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: "rgba(13,148,136,0.2)" }}
                >
                  <Check className="w-4 h-4 text-teal-400" />
                </div>
                <span className="text-sm font-semibold" style={{ color: "#2dd4bf" }}>
                  LicitaIA
                </span>
              </div>
              <ul className="space-y-3">
                {OURS.map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <Check className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-teal-500" />
                    <span className="text-xs sm:text-sm" style={{ color: "rgba(255,255,255,0.75)" }}>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

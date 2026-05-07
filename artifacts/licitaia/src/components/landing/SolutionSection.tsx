import { Gavel, Users, TrendingUp, Building2 } from "lucide-react";

const MODULES = [
  {
    icon: Gavel,
    name: "Licitações",
    tagline: "Do edital à submissão com IA",
    color: "#06b6d4",
    features: [
      "Monitoramento automático no PNCP",
      "Importação e leitura de editais",
      "Extração automática de exigências",
      "Conferência documental com IA",
      "Score de prontidão em tempo real",
    ],
    glow: "rgba(6,182,212,0.12)",
    border: "rgba(6,182,212,0.2)",
  },
  {
    icon: Users,
    name: "Chamamentos Públicos",
    tagline: "Gestão para OSCs e entidades",
    color: "#8b5cf6",
    features: [
      "Gestão de chamamentos para OSCs",
      "Validação de requisitos e critérios",
      "Organização de submissões",
      "Controle de prazos e etapas",
      "Relatórios de conformidade",
    ],
    glow: "rgba(139,92,246,0.12)",
    border: "rgba(139,92,246,0.2)",
  },
  {
    icon: TrendingUp,
    name: "Captação de Recursos",
    tagline: "Oportunidades monitoradas 24h",
    color: "#f59e0b",
    features: [
      "Monitoramento automático de editais",
      "Alertas de novas oportunidades",
      "Organização de projetos por edital",
      "Gestão de submissões",
      "Controle de contrapartidas",
    ],
    glow: "rgba(245,158,11,0.12)",
    border: "rgba(245,158,11,0.2)",
  },
  {
    icon: Building2,
    name: "Empresas",
    tagline: "Biblioteca documental centralizada",
    color: "#0d9488",
    features: [
      "Cadastro e perfil completo da empresa",
      "Biblioteca de documentos de habilitação",
      "Controle de validade de certidões",
      "Regularidade fiscal e trabalhista",
      "Centralização operacional",
    ],
    glow: "rgba(13,148,136,0.12)",
    border: "rgba(13,148,136,0.2)",
  },
];

export function SolutionSection() {
  return (
    <section id="modulos" style={{ background: "#08101e" }}>
      <div className="py-24" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <div
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium mb-6"
              style={{ background: "rgba(13,148,136,0.1)", border: "1px solid rgba(13,148,136,0.2)", color: "#2dd4bf" }}
            >
              A solução
            </div>
            <h2
              className="text-3xl md:text-4xl font-bold mb-4"
              style={{ fontFamily: "'Manrope', sans-serif", color: "#ffffff" }}
            >
              Uma plataforma para todo o ciclo operacional
            </h2>
            <p className="text-base max-w-xl mx-auto" style={{ color: "rgba(255,255,255,0.45)" }}>
              Quatro módulos integrados que cobrem do monitoramento de oportunidades à entrega dos documentos.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            {MODULES.map(({ icon: Icon, name, tagline, color, features, glow, border }) => (
              <div
                key={name}
                className="group relative rounded-2xl p-7 transition-all duration-300 hover:scale-[1.01]"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: `1px solid rgba(255,255,255,0.07)`,
                }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget as HTMLDivElement;
                  el.style.background = glow;
                  el.style.borderColor = border;
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget as HTMLDivElement;
                  el.style.background = "rgba(255,255,255,0.03)";
                  el.style.borderColor = "rgba(255,255,255,0.07)";
                }}
              >
                <div className="flex items-start gap-4 mb-5">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: `${color}20` }}
                  >
                    <Icon className="w-5 h-5" style={{ color }} />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold" style={{ color: "#ffffff", fontFamily: "'Manrope', sans-serif" }}>{name}</h3>
                    <p className="text-sm" style={{ color: "rgba(255,255,255,0.45)" }}>{tagline}</p>
                  </div>
                </div>
                <ul className="space-y-2.5">
                  {features.map((f) => (
                    <li key={f} className="flex items-center gap-2.5">
                      <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color }} />
                      <span className="text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

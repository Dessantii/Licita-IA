import {
  ScanText, ListChecks, ShieldCheck, BarChart3, Zap, Bell,
  FileSearch, FileBarChart, FolderKanban,
} from "lucide-react";

const FEATURES = [
  {
    icon: ScanText,
    title: "Leitura automática de editais",
    desc: "Importa e interpreta PDFs do PNCP automaticamente, sem digitação manual.",
    color: "#06b6d4",
  },
  {
    icon: ListChecks,
    title: "Extração de exigências",
    desc: "IA identifica todos os documentos e critérios exigidos no edital com alta precisão.",
    color: "#8b5cf6",
  },
  {
    icon: ShieldCheck,
    title: "Validação de documentos",
    desc: "Cruza documentos da empresa com exigências do edital e aponta lacunas.",
    color: "#0d9488",
  },
  {
    icon: BarChart3,
    title: "Score de prontidão",
    desc: "Indicador em tempo real de quantos por cento do processo está completo.",
    color: "#f59e0b",
  },
  {
    icon: Zap,
    title: "Próxima ação inteligente",
    desc: "Sugere o próximo passo baseado no estado atual do processo.",
    color: "#f97316",
  },
  {
    icon: Bell,
    title: "Monitoramento automático",
    desc: "Verifica o PNCP a cada 2h e cria alertas de oportunidades relevantes.",
    color: "#ec4899",
  },
  {
    icon: FileSearch,
    title: "Alertas de oportunidades",
    desc: "Notifica quando há novos editais que correspondem ao perfil da empresa.",
    color: "#3b82f6",
  },
  {
    icon: FileBarChart,
    title: "Relatórios finais",
    desc: "Gera sumário completo da conferência com itens OK, pendentes e divergentes.",
    color: "#10b981",
  },
  {
    icon: FolderKanban,
    title: "Organização documental",
    desc: "Biblioteca centralizada de documentos reutilizáveis por processo.",
    color: "#a78bfa",
  },
];

export function FeaturesSection() {
  return (
    <section id="funcionalidades" style={{ background: "#060c18", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
      <div className="py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <div
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium mb-6"
              style={{ background: "rgba(6,182,212,0.1)", border: "1px solid rgba(6,182,212,0.2)", color: "#22d3ee" }}
            >
              Funcionalidades
            </div>
            <h2
              className="text-3xl md:text-4xl font-bold mb-4"
              style={{ fontFamily: "'Manrope', sans-serif", color: "#ffffff" }}
            >
              Automação operacional com IA
            </h2>
            <p className="text-base max-w-xl mx-auto" style={{ color: "rgba(255,255,255,0.45)" }}>
              Cada funcionalidade foi desenhada para eliminar etapas manuais e reduzir o risco
              de desclassificação em processos públicos.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map(({ icon: Icon, title, desc, color }) => (
              <div
                key={title}
                className="group rounded-2xl p-6 transition-all duration-300 hover:scale-[1.02] cursor-default"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget as HTMLDivElement;
                  el.style.background = `${color}0d`;
                  el.style.borderColor = `${color}30`;
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget as HTMLDivElement;
                  el.style.background = "rgba(255,255,255,0.03)";
                  el.style.borderColor = "rgba(255,255,255,0.06)";
                }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110"
                  style={{ background: `${color}18` }}
                >
                  <Icon className="w-5 h-5" style={{ color }} />
                </div>
                <h3 className="text-sm font-semibold mb-1.5" style={{ color: "#ffffff" }}>{title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.45)" }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

import {
  FileX, Clock, Bell, MousePointerClick, FolderOpen, AlertTriangle,
} from "lucide-react";

const PROBLEMS = [
  {
    icon: FolderOpen,
    title: "Editais espalhados",
    desc: "Informações distribuídas entre PNCP, portais estaduais e municipais sem centralização.",
  },
  {
    icon: FileX,
    title: "Documentos vencidos",
    desc: "Certidões e habilitações expiram silenciosamente e só são descobertas na hora da entrega.",
  },
  {
    icon: Clock,
    title: "Prazos perdidos",
    desc: "Sem controle automatizado, prazos de entrega e sessões passam sem aviso prévio.",
  },
  {
    icon: MousePointerClick,
    title: "Conferência manual",
    desc: "Checagem item a item feita à mão, sujeita a erros humanos e omissões.",
  },
  {
    icon: AlertTriangle,
    title: "Risco de desclassificação",
    desc: "Um documento faltando ou desatualizado pode invalidar todo o esforço da empresa.",
  },
  {
    icon: Bell,
    title: "Muitas plataformas",
    desc: "Cada edital exige acesso a um portal diferente, sem visão consolidada do pipeline.",
  },
];

export function ProblemSection() {
  return (
    <section id="problema" style={{ background: "#060c18" }}>
      <div
        className="py-24"
        style={{
          background: "linear-gradient(180deg, #060c18 0%, #08101e 100%)",
          borderTop: "1px solid rgba(255,255,255,0.04)",
        }}
      >
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <div
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium mb-6"
              style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171" }}
            >
              O problema
            </div>
            <h2
              className="text-3xl md:text-4xl font-bold mb-4"
              style={{ fontFamily: "'Manrope', sans-serif", color: "#ffffff" }}
            >
              O processo ainda é manual e fragmentado
            </h2>
            <p className="text-base max-w-xl mx-auto" style={{ color: "rgba(255,255,255,0.45)" }}>
              Empresas e organizações perdem oportunidades todos os dias por falta de visibilidade,
              organização e automação no ciclo de participação pública.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {PROBLEMS.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="group rounded-2xl p-6 transition-all duration-300 hover:scale-[1.02]"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.07)",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.background = "rgba(239,68,68,0.06)";
                  (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(239,68,68,0.2)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.03)";
                  (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,255,255,0.07)";
                }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                  style={{ background: "rgba(239,68,68,0.12)" }}
                >
                  <Icon className="w-5 h-5" style={{ color: "#f87171" }} />
                </div>
                <h3 className="text-sm font-semibold mb-2" style={{ color: "#ffffff" }}>{title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.45)" }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

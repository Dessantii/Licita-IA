import { Link } from "wouter";
import { ArrowRight, ChevronDown } from "lucide-react";

function DashboardMockup() {
  const statCards = [
    { label: "Processos Ativos", value: "12" },
    { label: "Documentos OK", value: "89%" },
    { label: "Prazos Próximos", value: "3" },
    { label: "Score Médio", value: "94%" },
  ];
  const processes = [
    { name: "Pregão Eletrônico 042/2026 — Material de Escritório", status: "ok", color: "#0d9488" },
    { name: "Chamamento Público 003/2026 — Serviços de TI", status: "revisar", color: "#f59e0b" },
    { name: "Concorrência 011/2026 — Obras Civis", status: "ok", color: "#0d9488" },
  ];

  return (
    <div
      className="relative rounded-2xl overflow-hidden shadow-[0_32px_80px_rgba(0,0,0,0.6)]"
      style={{ border: "1px solid rgba(255,255,255,0.08)" }}
    >
      {/* Browser chrome */}
      <div
        className="flex items-center gap-2 px-4 py-3"
        style={{ background: "rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
        <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/50" />
        <div className="w-2.5 h-2.5 rounded-full bg-green-500/50" />
        <div
          className="flex-1 mx-3 h-5 rounded-md flex items-center px-3"
          style={{ background: "rgba(255,255,255,0.06)" }}
        >
          <span className="text-white/30 text-[10px] font-mono">app.licitaia.com.br/processes</span>
        </div>
      </div>

      {/* Dashboard content */}
      <div className="p-5 space-y-4" style={{ background: "#0a1628" }}>
        {/* Header bar */}
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="text-white font-semibold text-sm">Licitações</div>
            <div className="text-white/40 text-xs">12 processos ativos</div>
          </div>
          <div
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-teal-400"
            style={{ background: "rgba(13,148,136,0.15)" }}
          >
            + Novo processo
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-4 gap-2.5">
          {statCards.map((s, i) => (
            <div
              key={i}
              className="rounded-xl p-3"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
            >
              <div className="text-white/40 text-[10px] mb-1 leading-tight">{s.label}</div>
              <div className="text-white font-bold text-base">{s.value}</div>
            </div>
          ))}
        </div>

        {/* Process list */}
        <div className="space-y-2">
          {processes.map((p, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <div
                className="w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center text-[10px] font-bold"
                style={{ background: `${p.color}22`, color: p.color }}
              >
                {String.fromCharCode(65 + i)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-white/80 text-xs truncate">{p.name}</div>
              </div>
              <div
                className="text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0"
                style={{
                  background: p.status === "ok" ? "rgba(13,148,136,0.2)" : "rgba(245,158,11,0.2)",
                  color: p.status === "ok" ? "#2dd4bf" : "#fbbf24",
                }}
              >
                {p.status === "ok" ? "OK" : "Revisar"}
              </div>
            </div>
          ))}
        </div>

        {/* Progress bars */}
        <div
          className="rounded-xl p-4"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div className="text-white/50 text-xs mb-3">Prontidão Documental</div>
          {[
            { label: "Habilitação Jurídica", pct: 100 },
            { label: "Regularidade Fiscal", pct: 83 },
            { label: "Qualificação Técnica", pct: 67 },
          ].map((bar, i) => (
            <div key={i} className="mb-2 last:mb-0">
              <div className="flex justify-between text-[10px] mb-1">
                <span className="text-white/40">{bar.label}</span>
                <span className="text-white/60">{bar.pct}%</span>
              </div>
              <div className="h-1 rounded-full" style={{ background: "rgba(255,255,255,0.08)" }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${bar.pct}%`,
                    background: bar.pct === 100
                      ? "linear-gradient(90deg, #0d9488, #06b6d4)"
                      : bar.pct >= 80
                      ? "linear-gradient(90deg, #3b82f6, #6366f1)"
                      : "linear-gradient(90deg, #f59e0b, #f97316)",
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function HeroSection() {
  function scrollToFeatures() {
    document.querySelector("#modulos")?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <section className="relative min-h-screen flex flex-col" style={{ background: "#060c18" }}>
      {/* Grid background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)
          `,
          backgroundSize: "64px 64px",
        }}
      />

      {/* Radial glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(13,148,136,0.15) 0%, transparent 70%)",
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse 60% 40% at 70% 60%, rgba(6,182,212,0.06) 0%, transparent 60%)",
        }}
      />

      {/* Content */}
      <div className="relative flex-1 flex items-center pt-24 pb-16">
        <div className="max-w-7xl mx-auto px-6 w-full">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left */}
            <div className="space-y-8">
              <div
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium"
                style={{
                  background: "rgba(13,148,136,0.12)",
                  border: "1px solid rgba(13,148,136,0.25)",
                  color: "#2dd4bf",
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
                Plataforma operacional de licitações
              </div>

              <div className="space-y-4">
                <h1
                  className="text-5xl xl:text-6xl font-bold leading-[1.05] tracking-tight"
                  style={{ fontFamily: "'Manrope', sans-serif", color: "#ffffff" }}
                >
                  Menos burocracia.
                  <br />
                  <span
                    style={{
                      background: "linear-gradient(135deg, #0d9488 0%, #06b6d4 60%, #38bdf8 100%)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                    }}
                  >
                    Mais execução.
                  </span>
                </h1>
                <p className="text-lg leading-relaxed" style={{ color: "rgba(255,255,255,0.55)" }}>
                  Centralize licitações, chamamentos públicos e captação de recursos em uma única
                  plataforma com automação e inteligência artificial.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white transition-all duration-200 hover:opacity-90 hover:scale-[1.02] shadow-lg"
                  style={{ background: "linear-gradient(135deg, #0d9488 0%, #06b6d4 100%)", boxShadow: "0 8px 32px rgba(13,148,136,0.35)" }}
                >
                  Entrar na plataforma
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <button
                  onClick={scrollToFeatures}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-medium transition-all duration-200 hover:bg-white/[0.08]"
                  style={{ color: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.12)" }}
                >
                  Conhecer funcionalidades
                </button>
              </div>

              {/* Trust indicators */}
              <div className="flex items-center gap-6 pt-2">
                {[
                  { num: "4", label: "módulos integrados" },
                  { num: "100%", label: "web, sem instalação" },
                  { num: "IA", label: "análise automática" },
                ].map((item, i) => (
                  <div key={i} className="text-center">
                    <div className="text-lg font-bold" style={{ color: "#06b6d4" }}>{item.num}</div>
                    <div className="text-[11px]" style={{ color: "rgba(255,255,255,0.35)" }}>{item.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right — Dashboard mockup */}
            <div className="relative">
              <div
                className="absolute -inset-8 rounded-3xl pointer-events-none"
                style={{ background: "radial-gradient(ellipse at center, rgba(13,148,136,0.1) 0%, transparent 70%)" }}
              />
              <DashboardMockup />
            </div>
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="flex justify-center pb-10">
        <button
          onClick={() => document.querySelector("#problema")?.scrollIntoView({ behavior: "smooth" })}
          className="flex flex-col items-center gap-2 opacity-40 hover:opacity-70 transition-opacity"
        >
          <span className="text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>Conhecer mais</span>
          <ChevronDown className="w-4 h-4 text-white animate-bounce" />
        </button>
      </div>
    </section>
  );
}

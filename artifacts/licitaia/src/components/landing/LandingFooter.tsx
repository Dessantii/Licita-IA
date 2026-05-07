import { LicitaIALogo } from "@/components/brand/LicitaIALogo";
import { Link } from "wouter";

const LINKS = {
  Plataforma: [
    { label: "Licitações", href: "#modulos" },
    { label: "Chamamentos", href: "#modulos" },
    { label: "Captação de Recursos", href: "#modulos" },
    { label: "Empresas", href: "#modulos" },
  ],
  Produto: [
    { label: "Funcionalidades", href: "#funcionalidades" },
    { label: "Como funciona", href: "#como-funciona" },
    { label: "Diferencial", href: "#diferencial" },
  ],
  Suporte: [
    { label: "Fale conosco", href: "#suporte" },
    { label: "suporte@licitaia.com.br", href: "mailto:suporte@licitaia.com.br" },
  ],
  Legal: [
    { label: "Política de Privacidade", href: "#" },
    { label: "Termos de Uso", href: "#" },
  ],
};

export function LandingFooter() {
  function scrollTo(href: string) {
    if (href.startsWith("#")) {
      document.querySelector(href)?.scrollIntoView({ behavior: "smooth" });
    }
  }

  return (
    <footer
      style={{
        background: "#060c18",
        borderTop: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div className="max-w-7xl mx-auto px-5 sm:px-6 py-12 sm:py-16">
        {/* Brand + links */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-8 md:gap-10">
          {/* Brand — full width on smallest, 2 cols on sm+ */}
          <div className="col-span-2 sm:col-span-3 md:col-span-1">
            <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="mb-4 block">
              <LicitaIALogo size="sm" theme="white" />
            </button>
            <p className="text-xs leading-relaxed max-w-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
              Plataforma de gestão operacional para participação em processos públicos brasileiros.
            </p>
          </div>

          {/* Link columns */}
          {Object.entries(LINKS).map(([section, items]) => (
            <div key={section}>
              <p className="text-xs font-semibold uppercase tracking-wider mb-3 sm:mb-4" style={{ color: "rgba(255,255,255,0.3)" }}>
                {section}
              </p>
              <ul className="space-y-2 sm:space-y-2.5">
                {items.map((item) => (
                  <li key={item.label}>
                    {item.href.startsWith("#") ? (
                      <button
                        onClick={() => scrollTo(item.href)}
                        className="text-xs transition-colors hover:text-white text-left"
                        style={{ color: "rgba(255,255,255,0.45)" }}
                      >
                        {item.label}
                      </button>
                    ) : (
                      <a
                        href={item.href}
                        className="text-xs transition-colors hover:text-white break-all"
                        style={{ color: "rgba(255,255,255,0.45)" }}
                      >
                        {item.label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div
          className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-8 mt-10"
          style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
        >
          <p className="text-xs text-center sm:text-left" style={{ color: "rgba(255,255,255,0.25)" }}>
            © {new Date().getFullYear()} LicitaIA. Todos os direitos reservados.
          </p>
          <Link
            href="/login"
            className="text-xs font-medium transition-colors hover:text-white"
            style={{ color: "rgba(255,255,255,0.4)" }}
          >
            Entrar na plataforma →
          </Link>
        </div>
      </div>
    </footer>
  );
}

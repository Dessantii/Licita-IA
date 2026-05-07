import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { LicitaIALogo } from "@/components/brand/LicitaIALogo";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { label: "Funcionalidades", href: "#funcionalidades" },
  { label: "Módulos", href: "#modulos" },
  { label: "Como funciona", href: "#como-funciona" },
  { label: "Suporte", href: "#suporte" },
];

export function LandingHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [, navigate] = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function scrollTo(href: string) {
    setMenuOpen(false);
    const el = document.querySelector(href);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        scrolled
          ? "bg-[#060c18]/95 backdrop-blur-xl border-b border-white/[0.06] shadow-2xl"
          : "bg-transparent"
      )}
    >
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
          <LicitaIALogo size="sm" theme="white" />
        </button>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV.map((item) => (
            <button
              key={item.href}
              onClick={() => scrollTo(item.href)}
              className="px-4 py-2 text-sm text-white/60 hover:text-white transition-colors rounded-lg hover:bg-white/[0.06]"
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          <Link
            href="/login"
            className="px-5 py-2 text-sm font-medium text-white/70 hover:text-white transition-colors"
          >
            Entrar
          </Link>
          <Link
            href="/login"
            className="px-5 py-2 text-sm font-semibold rounded-xl transition-all duration-200 text-white"
            style={{ background: "linear-gradient(135deg, #0d9488 0%, #06b6d4 100%)" }}
          >
            Começar agora
          </Link>
        </div>

        {/* Mobile */}
        <button
          className="md:hidden text-white/70 hover:text-white"
          onClick={() => setMenuOpen((v) => !v)}
        >
          {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {menuOpen && (
        <div className="md:hidden bg-[#060c18]/98 border-b border-white/[0.06] px-6 pb-6 space-y-1">
          {NAV.map((item) => (
            <button
              key={item.href}
              onClick={() => scrollTo(item.href)}
              className="block w-full text-left px-4 py-3 text-sm text-white/60 hover:text-white transition-colors rounded-lg hover:bg-white/[0.06]"
            >
              {item.label}
            </button>
          ))}
          <div className="pt-3 border-t border-white/[0.06] mt-3 space-y-2">
            <Link href="/login" className="block w-full text-center px-5 py-2.5 text-sm font-medium text-white/70 border border-white/10 rounded-xl hover:bg-white/5 transition-colors">
              Entrar
            </Link>
            <Link href="/login" className="block w-full text-center px-5 py-2.5 text-sm font-semibold rounded-xl text-white" style={{ background: "linear-gradient(135deg, #0d9488 0%, #06b6d4 100%)" }}>
              Começar agora
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

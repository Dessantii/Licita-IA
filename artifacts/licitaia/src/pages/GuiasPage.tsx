import { AppLayout } from "@/components/layout/AppLayout";
import { ChevronRight } from "lucide-react";

interface Guide {
  emoji: string;
  category: string;
  title: string;
  description: string;
  readTime: string;
}

const GUIDES: Guide[] = [
  {
    emoji: "🏛️",
    category: "Para começar",
    title: "O que é uma licitação?",
    description: "Entenda de forma simples como o governo compra produtos e serviços — e como sua empresa pode vender.",
    readTime: "3 min",
  },
  {
    emoji: "📋",
    category: "Para começar",
    title: "Quem pode participar de uma licitação?",
    description: "MEI, microempresa ou pequena empresa? Veja quais são as regras e as vantagens para quem tem porte menor.",
    readTime: "4 min",
  },
  {
    emoji: "📁",
    category: "Documentos necessários",
    title: "Quais documentos sua empresa precisa ter?",
    description: "A lista completa dos documentos básicos: o que é cada um, onde conseguir e por quanto tempo valem.",
    readTime: "6 min",
  },
  {
    emoji: "🔍",
    category: "Documentos necessários",
    title: "O que é regularidade fiscal?",
    description: "Entenda o que significa estar em dia com a Receita Federal, FGTS e INSS — e como consultar a situação da sua empresa.",
    readTime: "4 min",
  },
  {
    emoji: "📢",
    category: "Como funciona uma licitação",
    title: "O que é um edital e como lê-lo?",
    description: "O edital é o documento mais importante da licitação. Aprenda a identificar o que importa e o que pode eliminar sua empresa.",
    readTime: "7 min",
  },
  {
    emoji: "💰",
    category: "Como funciona uma licitação",
    title: "Como montar uma proposta de preço?",
    description: "Dicas práticas para calcular seu preço, evitar erros comuns e aumentar suas chances de ganhar.",
    readTime: "8 min",
  },
  {
    emoji: "⚠️",
    category: "Dicas práticas",
    title: "5 erros que eliminam empresas nas licitações",
    description: "Os erros mais comuns que fazem empresas perderem oportunidades — e como evitá-los.",
    readTime: "5 min",
  },
  {
    emoji: "🤝",
    category: "Dicas práticas",
    title: "Vantagens das microempresas nas licitações",
    description: "A lei dá benefícios especiais para MEI, ME e EPP. Conheça seus direitos e como usá-los a seu favor.",
    readTime: "5 min",
  },
];

const CATEGORIES = ["Para começar", "Documentos necessários", "Como funciona uma licitação", "Dicas práticas"];

export function GuiasPage() {
  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto px-5 sm:px-8 py-8 sm:py-10">

        {/* Header */}
        <div className="mb-8">
          <h1
            className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2"
            style={{ fontFamily: "'Manrope', sans-serif", letterSpacing: "-0.02em" }}
          >
            Guias e tutoriais
          </h1>
          <p className="text-slate-500 text-sm sm:text-base">
            Aprenda como funciona o mercado público em linguagem simples, sem juridiquês.
          </p>
        </div>

        {/* Coming soon banner */}
        <div
          className="mb-8 rounded-2xl p-5 flex items-center gap-4"
          style={{ background: "#f0fdf4", border: "1px solid #bbf7d0" }}
        >
          <span className="text-2xl flex-shrink-0">✍️</span>
          <div>
            <p className="text-sm font-semibold text-green-900">Guias chegando em breve</p>
            <p className="text-xs text-green-700 mt-0.5">
              Estamos preparando conteúdos práticos e diretos ao ponto. Abaixo você já pode ver o que vem por aí.
            </p>
          </div>
        </div>

        {/* Guides by category */}
        {CATEGORIES.map((category) => {
          const guides = GUIDES.filter((g) => g.category === category);
          return (
            <div key={category} className="mb-8">
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                {category}
              </h2>
              <div className="bg-white rounded-2xl overflow-hidden" style={{ border: "1px solid #f1f5f9" }}>
                {guides.map((guide, i) => (
                  <div
                    key={guide.title}
                    className="flex items-start gap-4 px-5 py-4 opacity-70 cursor-not-allowed"
                    style={{ borderTop: i > 0 ? "1px solid #f8fafc" : undefined }}
                  >
                    <span className="text-xl flex-shrink-0 mt-0.5">{guide.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 mb-0.5">{guide.title}</p>
                      <p className="text-xs text-slate-400 leading-relaxed">{guide.description}</p>
                      <span className="inline-block mt-2 text-[10px] text-slate-300 font-medium">
                        {guide.readTime} de leitura · Em breve
                      </span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-200 flex-shrink-0 mt-1" />
                  </div>
                ))}
              </div>
            </div>
          );
        })}

      </div>
    </AppLayout>
  );
}

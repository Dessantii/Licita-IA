import React from "react";
import { 
  Home, 
  Play, 
  Target, 
  Building2, 
  BookOpen, 
  LifeBuoy, 
  ArrowRight,
  CheckCircle2,
  Circle,
  FileText,
  AlertCircle,
  ChevronRight
} from "lucide-react";

export default function DirectionA() {
  return (
    <div className="flex h-screen w-full bg-white overflow-hidden font-sans text-gray-900">
      {/* Sidebar */}
      <aside className="w-[240px] bg-[#FAFAFA] border-r border-[#E5E7EB] flex flex-col flex-shrink-0">
        <div className="h-16 flex items-center px-6 border-b border-transparent">
          <div className="flex items-center gap-2 font-semibold text-[16px] tracking-tight text-gray-900">
            <div className="w-2 h-2 rounded-full bg-blue-600"></div>
            LicitaIA
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          <NavItem icon={<Home size={16} />} label="Início" active />
          <NavItem icon={<Play size={16} />} label="Começar" />
          <NavItem icon={<Target size={16} />} label="Oportunidades" />
          <NavItem icon={<Building2 size={16} />} label="Minha Empresa" />
          <NavItem icon={<BookOpen size={16} />} label="Guias" />
          <NavItem icon={<LifeBuoy size={16} />} label="Ajuda" />
        </nav>
        
        <div className="p-4 border-t border-[#E5E7EB] m-3 mt-auto rounded-lg">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-600">
              PS
            </div>
            <div className="flex flex-col">
              <span className="text-[13px] font-medium text-gray-900">Pedro Silva</span>
              <span className="text-[11px] text-gray-500">TechCorp MEI</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto p-8 lg:p-12">
          {/* Header */}
          <header className="mb-8">
            <h1 className="text-[28px] font-bold tracking-tight text-gray-900 mb-2">Olá, Pedro 👋</h1>
            <p className="text-[14px] text-gray-500">Aqui está o que acontece com a sua empresa hoje.</p>
          </header>

          {/* Stat Chips */}
          <div className="flex gap-3 mb-10">
            <StatChip icon={<Building2 size={14} />} text="1 empresa cadastrada" />
            <StatChip icon={<FileText size={14} />} text="3 documentos pendentes" />
            <StatChip icon={<AlertCircle size={14} />} text="2 alertas novos" />
          </div>

          {/* Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
            {/* Progress Card */}
            <div className="bg-white border border-[#E5E7EB] rounded-lg p-6 flex flex-col">
              <h2 className="text-[12px] font-semibold uppercase tracking-wide text-gray-500 mb-6">Prontidão da Empresa</h2>
              <div className="flex items-center gap-8 mb-8">
                <div className="relative w-24 h-24 flex-shrink-0">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="46" fill="transparent" stroke="#F3F4F6" strokeWidth="3" />
                    <circle cx="50" cy="50" r="46" fill="transparent" stroke="#2563EB" strokeWidth="3" strokeDasharray="289" strokeDashoffset="95" className="transition-all duration-1000 ease-out" />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold tracking-tighter text-gray-900">67%</span>
                  </div>
                </div>
                <div>
                  <div className="text-[15px] font-medium text-gray-900 mb-1">Em andamento</div>
                  <div className="text-[13px] text-gray-500 leading-relaxed">Sua empresa está quase pronta para participar de licitações. Complete os passos abaixo.</div>
                </div>
              </div>
              
              <div className="space-y-3 mt-auto">
                <ChecklistItem completed text="Dados básicos da empresa" />
                <ChecklistItem completed text="Certidões Federais e FGTS" />
                <ChecklistItem text="Certidão Negativa Municipal" active />
              </div>
            </div>

            {/* Next Action Card */}
            <div className="bg-white border border-[#E5E7EB] rounded-lg p-6 relative overflow-hidden flex flex-col">
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-600"></div>
              <h2 className="text-[12px] font-semibold uppercase tracking-wide text-blue-600 mb-2">O que fazer agora</h2>
              <h3 className="text-[18px] font-semibold tracking-tight text-gray-900 mb-3 mt-2">Atualizar Certidão Municipal</h3>
              <p className="text-[14px] text-gray-500 leading-relaxed mb-8">
                Sua CND Municipal venceu ontem. Sem ela, você não poderá participar dos pregões agendados para a próxima semana.
              </p>
              <button className="mt-auto inline-flex items-center justify-center gap-2 bg-gray-900 text-white text-[13px] font-medium px-4 py-2.5 rounded-md hover:bg-gray-800 transition-colors self-start">
                Fazer upload da certidão
                <ArrowRight size={14} />
              </button>
            </div>
          </div>

          {/* Alerts Section */}
          <section>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-[16px] font-semibold tracking-tight text-gray-900">Novos editais para você</h2>
              <button className="text-[13px] text-gray-500 hover:text-gray-900 font-medium flex items-center gap-1">
                Ver todos <ChevronRight size={14} />
              </button>
            </div>
            
            <div className="border-t border-[#E5E7EB]">
              <AlertRow 
                organ="Ministério da Saúde"
                modal="Pregão Eletrônico 045/2024"
                location="Brasília, DF"
                date="15 Out 2024"
                description="Aquisição de equipamentos de proteção individual (EPI) para rede pública."
              />
              <AlertRow 
                organ="Câmara Municipal de São Paulo"
                modal="Concorrência 012/2024"
                location="São Paulo, SP"
                date="18 Out 2024"
                description="Contratação de serviços de manutenção preventiva de ar condicionado."
              />
              <AlertRow 
                organ="Prefeitura de Campinas"
                modal="Dispensa Eletrônica 089/2024"
                location="Campinas, SP"
                date="22 Out 2024"
                description="Fornecimento de material de expediente para secretarias."
              />
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

// Subcomponents

function NavItem({ icon, label, active = false }: { icon: React.ReactNode, label: string, active?: boolean }) {
  return (
    <a 
      href="#" 
      className={`flex items-center gap-3 px-3 py-2 rounded-md text-[13px] font-medium transition-colors relative ${
        active 
          ? "text-blue-600 bg-blue-50" 
          : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
      }`}
    >
      {active && <div className="absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-blue-600 rounded-r-full"></div>}
      <span className={active ? "text-blue-600" : "text-gray-500"}>{icon}</span>
      {label}
    </a>
  );
}

function StatChip({ icon, text }: { icon: React.ReactNode, text: string }) {
  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-full text-[12px] font-medium text-gray-700">
      <span className="text-gray-400">{icon}</span>
      {text}
    </div>
  );
}

function ChecklistItem({ completed, text, active }: { completed?: boolean, text: string, active?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      {completed ? (
        <CheckCircle2 size={16} className="text-gray-900" />
      ) : active ? (
        <div className="relative flex items-center justify-center w-4 h-4">
          <Circle size={16} className="text-blue-600 absolute" />
          <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
        </div>
      ) : (
        <Circle size={16} className="text-gray-300" />
      )}
      <span className={`text-[13px] ${completed ? 'text-gray-500 line-through' : active ? 'text-gray-900 font-medium' : 'text-gray-600'}`}>
        {text}
      </span>
    </div>
  );
}

function AlertRow({ organ, modal, location, date, description }: { organ: string, modal: string, location: string, date: string, description: string }) {
  return (
    <div className="py-4 border-b border-[#E5E7EB] group flex items-start gap-4">
      <div className="w-10 h-10 rounded bg-gray-50 border border-gray-100 flex items-center justify-center flex-shrink-0 text-gray-400 mt-1">
        <Building2 size={18} />
      </div>
      <div className="flex-1">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span className="text-[14px] font-medium text-gray-900 tracking-tight">{organ}</span>
            <span className="text-gray-300">&bull;</span>
            <span className="text-[13px] text-gray-500">{location}</span>
          </div>
          <span className="text-[12px] font-medium text-gray-400">{date}</span>
        </div>
        <div className="text-[13px] font-medium text-gray-700 mb-1">{modal}</div>
        <div className="text-[13px] text-gray-500 line-clamp-1">{description}</div>
      </div>
      <div className="pt-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button className="text-[13px] font-medium text-blue-600 flex items-center gap-1 hover:text-blue-700">
          Detalhes
        </button>
      </div>
    </div>
  );
}

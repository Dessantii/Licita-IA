import React from 'react';
import { 
  Home, 
  Search, 
  FileText, 
  Settings, 
  Building2, 
  ArrowRight, 
  CheckCircle2, 
  Circle,
  AlertCircle,
  FileWarning
} from 'lucide-react';

export default function DirectionC() {
  return (
    <div className="flex h-screen w-full overflow-hidden" style={{ fontFamily: 'Inter, sans-serif', background: '#FAFAF9' }}>
      
      {/* Sidebar */}
      <div 
        className="flex flex-col w-[220px] flex-shrink-0" 
        style={{ background: '#F7F6F3', borderRight: '1px solid #E8E6E1' }}
      >
        <div className="p-6 flex items-center gap-2">
          <div className="w-5 h-5 rounded-sm flex items-center justify-center" style={{ background: '#18181B' }}>
            <Building2 size={12} color="#FFFFFF" />
          </div>
          <span className="font-semibold text-[14px]" style={{ color: '#18181B' }}>LicitaIA</span>
        </div>

        <div className="px-6 py-2">
          <span className="text-[10px] font-semibold tracking-widest" style={{ color: '#9CA3AF' }}>MENU</span>
        </div>

        <nav className="flex-1 flex flex-col gap-1 px-3">
          <a href="#" className="flex items-center gap-3 px-3 py-2 rounded-sm" style={{ background: '#FFFFFF', borderLeft: '2px solid #18181B' }}>
            <Home size={16} color="#18181B" />
            <span className="text-[14px] font-medium" style={{ color: '#18181B' }}>Início</span>
          </a>
          <a href="#" className="flex items-center gap-3 px-3 py-2 rounded-sm hover:bg-black/5">
            <Search size={16} color="#6B7280" />
            <span className="text-[14px]" style={{ color: '#6B7280' }}>Oportunidades</span>
          </a>
          <a href="#" className="flex items-center gap-3 px-3 py-2 rounded-sm hover:bg-black/5">
            <FileText size={16} color="#6B7280" />
            <span className="text-[14px]" style={{ color: '#6B7280' }}>Processos</span>
          </a>
          <a href="#" className="flex items-center gap-3 px-3 py-2 rounded-sm hover:bg-black/5">
            <Settings size={16} color="#6B7280" />
            <span className="text-[14px]" style={{ color: '#6B7280' }}>Configurações</span>
          </a>
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-10">
        <div className="max-w-4xl mx-auto space-y-10">
          
          {/* Header */}
          <div>
            <h1 className="text-[32px] font-bold tracking-tight mb-2" style={{ color: '#18181B' }}>Início</h1>
            <p className="text-[14px]" style={{ color: '#6B7280' }}>Segunda-feira, 19 de maio de 2026</p>
          </div>

          <div style={{ height: '1px', background: '#E8E6E1', width: '100%' }}></div>

          {/* Sua Situação */}
          <section>
            <h2 className="text-[14px] font-medium mb-6" style={{ color: '#18181B' }}>Sua situação</h2>
            
            <div className="flex items-center w-full max-w-2xl">
              <div className="flex flex-col items-center gap-2 relative">
                <CheckCircle2 size={20} color="#18181B" fill="#E8E6E1" />
                <span className="text-[13px] font-medium" style={{ color: '#18181B' }}>Cadastro Base</span>
              </div>
              <div className="flex-1 h-[1px] mx-4" style={{ background: '#18181B' }}></div>
              
              <div className="flex flex-col items-center gap-2 relative">
                <div className="w-5 h-5 rounded-full border-2 border-black flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full" style={{ background: '#18181B' }}></div>
                </div>
                <span className="text-[13px] font-medium" style={{ color: '#18181B' }}>Documentação</span>
              </div>
              <div className="flex-1 h-[1px] mx-4" style={{ background: '#E8E6E1' }}></div>
              
              <div className="flex flex-col items-center gap-2 relative opacity-50">
                <Circle size={20} color="#6B7280" />
                <span className="text-[13px]" style={{ color: '#6B7280' }}>Primeiro Edital</span>
              </div>
            </div>
          </section>

          {/* O que fazer agora */}
          <section>
            <h2 className="text-[14px] font-medium mb-4" style={{ color: '#18181B' }}>O que fazer agora</h2>
            
            <div className="flex items-start gap-3">
              <AlertCircle size={18} color="#2563EB" className="mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-[14px] leading-relaxed" style={{ color: '#18181B' }}>
                  <span className="font-semibold">Faltam 3 certidões essenciais</span> para que sua empresa esteja pronta para participar de licitações federais. Recomendamos emitir a Certidão Negativa Municipal primeiro.
                </p>
                <a href="#" className="inline-flex items-center gap-1 mt-2 text-[14px] font-medium hover:opacity-80 transition-opacity" style={{ color: '#2563EB', textDecoration: 'underline' }}>
                  Acessar portal da prefeitura <ArrowRight size={14} />
                </a>
              </div>
            </div>
          </section>

          {/* Editais encontrados */}
          <section>
            <h2 className="text-[14px] font-medium mb-4" style={{ color: '#18181B' }}>Editais encontrados para você</h2>
            
            <div className="flex flex-col border rounded-[6px] overflow-hidden" style={{ borderColor: '#E5E7EB', background: '#FFFFFF', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
              {/* Row 1 */}
              <div className="flex items-center p-4 border-b hover:bg-gray-50/50 transition-colors" style={{ borderColor: '#E5E7EB' }}>
                <div className="flex-1 pr-4">
                  <h3 className="text-[14px] font-medium mb-1" style={{ color: '#18181B' }}>Aquisição de Material de Expediente</h3>
                  <p className="text-[13px]" style={{ color: '#6B7280' }}>Prefeitura de São Paulo • SP</p>
                </div>
                <div className="w-32 text-right">
                  <p className="text-[13px]" style={{ color: '#6B7280' }}>Abre em 4 dias</p>
                </div>
                <div className="pl-6">
                  <a href="#" className="text-[14px] font-medium hover:opacity-80 transition-opacity" style={{ color: '#18181B' }}>Ver detalhes</a>
                </div>
              </div>
              
              {/* Row 2 */}
              <div className="flex items-center p-4 border-b hover:bg-gray-50/50 transition-colors" style={{ borderColor: '#E5E7EB' }}>
                <div className="flex-1 pr-4">
                  <h3 className="text-[14px] font-medium mb-1" style={{ color: '#18181B' }}>Serviços de Manutenção Predial</h3>
                  <p className="text-[13px]" style={{ color: '#6B7280' }}>Tribunal de Justiça • PR</p>
                </div>
                <div className="w-32 text-right">
                  <p className="text-[13px]" style={{ color: '#6B7280' }}>Abre em 7 dias</p>
                </div>
                <div className="pl-6">
                  <a href="#" className="text-[14px] font-medium hover:opacity-80 transition-opacity" style={{ color: '#18181B' }}>Ver detalhes</a>
                </div>
              </div>

              {/* Row 3 */}
              <div className="flex items-center p-4 hover:bg-gray-50/50 transition-colors">
                <div className="flex-1 pr-4">
                  <h3 className="text-[14px] font-medium mb-1" style={{ color: '#18181B' }}>Fornecimento de Copos Ecológicos</h3>
                  <p className="text-[13px]" style={{ color: '#6B7280' }}>Universidade Federal • MG</p>
                </div>
                <div className="w-32 text-right">
                  <p className="text-[13px]" style={{ color: '#6B7280' }}>Abre em 12 dias</p>
                </div>
                <div className="pl-6">
                  <a href="#" className="text-[14px] font-medium hover:opacity-80 transition-opacity" style={{ color: '#18181B' }}>Ver detalhes</a>
                </div>
              </div>
            </div>
          </section>

          {/* Warning */}
          <section>
            <h2 className="text-[14px] font-medium mb-4" style={{ color: '#18181B' }}>Documentos próximos do vencimento</h2>
            
            <div className="flex items-center p-4 rounded-[6px] border border-red-100 bg-red-50/30 gap-4">
              <FileWarning size={20} className="text-red-600 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-[14px] font-medium text-red-900">Certidão Negativa de Débitos Estaduais</p>
                <p className="text-[13px] text-red-700/80">Vence em 2 dias (21/05/2026)</p>
              </div>
              <div>
                <button className="px-3 py-1.5 bg-white border border-red-200 rounded-[4px] text-[13px] font-medium text-red-700 hover:bg-red-50 transition-colors shadow-sm">
                  Atualizar
                </button>
              </div>
            </div>
          </section>

        </div>
      </div>

    </div>
  );
}

import React, { useState } from 'react';
import { 
  Building2, 
  Home, 
  Search, 
  FileText, 
  Settings, 
  Bell, 
  CheckCircle2, 
  ChevronRight, 
  AlertCircle, 
  Clock, 
  ChevronDown,
  ArrowRight,
  UploadCloud,
  FileCheck2,
  BookOpen
} from 'lucide-react';

export default function DirectionB() {
  const [activeNav, setActiveNav] = useState('inicio');

  return (
    <div className="flex h-screen w-full overflow-hidden text-slate-800" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      
      {/* Sidebar */}
      <div className="w-[256px] flex flex-col justify-between" style={{ backgroundColor: '#0A2540', color: 'white' }}>
        <div>
          <div className="p-6 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/10">
              <Building2 size={20} className="text-white" />
            </div>
            <span className="font-semibold text-[18px] tracking-tight text-white">LicitaIA</span>
          </div>

          <div className="mt-2 px-3 flex flex-col gap-1">
            <NavItem 
              icon={<Home size={18} />} 
              label="Início" 
              isActive={activeNav === 'inicio'}
              onClick={() => setActiveNav('inicio')}
            />
            <NavItem 
              icon={<Search size={18} />} 
              label="Oportunidades" 
              isActive={activeNav === 'oportunidades'}
              badge="12"
              onClick={() => setActiveNav('oportunidades')}
            />
            <NavItem 
              icon={<FileText size={18} />} 
              label="Meus Processos" 
              isActive={activeNav === 'processos'}
              onClick={() => setActiveNav('processos')}
            />
            <NavItem 
              icon={<Bell size={18} />} 
              label="Alertas" 
              isActive={activeNav === 'alertas'}
              onClick={() => setActiveNav('alertas')}
            />
            <div className="mt-6 mb-2 px-4 text-xs font-semibold text-white/50 uppercase tracking-wider">
              Configurações
            </div>
            <NavItem 
              icon={<Settings size={18} />} 
              label="Minha Empresa" 
              isActive={activeNav === 'empresa'}
              onClick={() => setActiveNav('empresa')}
            />
          </div>
        </div>

        <div className="p-4 border-t border-white/10">
          <button className="flex items-center gap-3 w-full p-2 rounded-lg hover:bg-white/5 transition-colors text-left">
            <div className="w-9 h-9 rounded-full bg-blue-500 flex items-center justify-center text-sm font-bold shadow-inner">
              PD
            </div>
            <div className="flex-1 overflow-hidden">
              <div className="text-sm font-medium text-white truncate">Pedro Dessanti</div>
              <div className="text-xs text-white/60 truncate">Minha conta</div>
            </div>
            <Settings size={14} className="text-white/40" />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-y-auto" style={{ backgroundColor: '#F6F9FC' }}>
        
        {/* Header */}
        <div className="px-8 py-8">
          <div className="flex items-center text-sm font-medium text-slate-500 mb-2">
            LicitaIA <ChevronRight size={14} className="mx-1" /> Início
          </div>
          <div className="flex justify-between items-center">
            <h1 className="text-[24px] font-bold text-slate-900 tracking-tight">Início</h1>
            <div className="flex items-center gap-4">
              <button className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-slate-500 hover:text-slate-800" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                <Bell size={20} />
              </button>
              <button className="px-4 py-2 bg-white text-sm font-medium rounded-lg text-slate-700 hover:bg-slate-50 border border-slate-200" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                Ajuda
              </button>
            </div>
          </div>
        </div>

        <div className="px-8 pb-12">
          
          {/* Stat Cards */}
          <div className="grid grid-cols-3 gap-6 mb-8">
            <StatCard 
              title="Status da Empresa" 
              value="Cadastrada" 
              icon={<Building2 size={24} style={{ color: '#0066FF' }} />}
              iconBg="#E5F0FF"
            />
            <StatCard 
              title="Documentos Enviados" 
              value="3 / 8" 
              icon={<FileCheck2 size={24} style={{ color: '#635BFF' }} />}
              iconBg="#EFEFFF"
            />
            <StatCard 
              title="Editais Novos (Hoje)" 
              value="2" 
              icon={<Search size={24} style={{ color: '#00A389' }} />}
              iconBg="#E5F6F3"
            />
          </div>

          <div className="grid grid-cols-12 gap-8 mb-8">
            {/* Progress Section */}
            <div className="col-span-7">
              <div className="bg-white rounded-xl p-6 h-full flex flex-col" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                <div className="flex justify-between items-end mb-6">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">Situação da Empresa</h2>
                    <p className="text-sm text-slate-500 mt-1">Seu nível de prontidão para licitar</p>
                  </div>
                  <div className="text-[32px] font-bold tracking-tight" style={{ color: '#0066FF' }}>67%</div>
                </div>

                <div className="w-full bg-slate-100 h-2 rounded-full mb-8 overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-1000" style={{ width: '67%', backgroundColor: '#0066FF' }} />
                </div>

                <div className="flex-1 flex flex-col justify-center gap-4">
                  <div className="flex items-center gap-4">
                    <CheckCircle2 size={20} className="text-green-500 shrink-0" />
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Dados cadastrais básicos</div>
                      <div className="text-xs text-slate-500">CNPJ e informações preenchidos</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <CheckCircle2 size={20} className="text-green-500 shrink-0" />
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Certidões Federais e Estaduais</div>
                      <div className="text-xs text-slate-500">Válidas até 15/11/2026</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 opacity-50">
                    <div className="w-5 h-5 rounded-full border-2 border-slate-300 shrink-0" />
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Certidões Municipais</div>
                      <div className="text-xs text-slate-500">Pendente de envio</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Next Action */}
            <div className="col-span-5">
              <div className="bg-white rounded-xl p-1 h-full" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                <div className="h-full rounded-lg p-6 flex flex-col border border-blue-50" style={{ background: 'linear-gradient(180deg, #F8FAFC 0%, #FFFFFF 100%)' }}>
                  <div className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-6 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: '#0066FF' }} />
                    Próximo Passo
                  </div>
                  
                  <div className="w-12 h-12 rounded-full mb-4 flex items-center justify-center" style={{ backgroundColor: '#E5F0FF', color: '#0066FF' }}>
                    <UploadCloud size={24} />
                  </div>
                  
                  <h3 className="text-lg font-bold text-slate-900 mb-2">Envie sua Certidão Municipal</h3>
                  <p className="text-sm text-slate-600 mb-8 flex-1">
                    Para participar dos 2 novos editais encontrados, você precisa estar com a certidão municipal em dia.
                  </p>
                  
                  <button className="w-full py-3 rounded-lg text-white font-medium flex items-center justify-center gap-2 transition-transform hover:-translate-y-0.5" style={{ backgroundColor: '#0066FF', boxShadow: '0 4px 12px rgba(0, 102, 255, 0.25)' }}>
                    Fazer Upload <ArrowRight size={18} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Alerts / Oportunidades */}
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-bold text-slate-900">Oportunidades Recomendadas</h2>
              <button className="text-sm font-medium flex items-center gap-1" style={{ color: '#0066FF' }}>
                Ver todas <ArrowRight size={14} />
              </button>
            </div>

            <div className="grid gap-4">
              <AlertCard 
                type="pregão"
                organ="Prefeitura Municipal de Curitiba"
                title="Aquisição de materiais de escritório e papelaria"
                date="Abertura: Amanhã, 09:00"
                value="R$ 45.000,00"
                color="#635BFF"
              />
              <AlertCard 
                type="dispensa"
                organ="Ministério da Saúde - PR"
                title="Serviços de manutenção preventiva em ar condicionado"
                date="Encerra em 2 dias"
                value="R$ 17.500,00"
                color="#00A389"
              />
              <AlertCard 
                type="pregão"
                organ="Universidade Federal do Paraná"
                title="Fornecimento de copos descartáveis e produtos de limpeza"
                date="Abertura: 15/10/2026"
                value="R$ 120.000,00"
                color="#635BFF"
              />
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

function NavItem({ icon, label, isActive, badge, onClick }: { icon: React.ReactNode, label: string, isActive?: boolean, badge?: string, onClick?: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`relative flex items-center justify-between w-full px-4 py-2.5 rounded-lg transition-colors text-sm ${
        isActive ? 'text-white font-medium' : 'text-white/70 hover:text-white hover:bg-white/5 font-normal'
      }`}
      style={isActive ? { backgroundColor: '#1A3A5C' } : {}}
    >
      {isActive && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-white rounded-r-full" />
      )}
      <div className="flex items-center gap-3">
        <span className={isActive ? 'opacity-100' : 'opacity-70'}>{icon}</span>
        {label}
      </div>
      {badge && (
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
          isActive ? 'bg-white text-[#0A2540]' : 'bg-white/10 text-white'
        }`}>
          {badge}
        </span>
      )}
    </button>
  );
}

function StatCard({ title, value, icon, iconBg }: { title: string, value: string, icon: React.ReactNode, iconBg: string }) {
  return (
    <div className="bg-white p-6 rounded-xl flex items-center justify-between" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
      <div>
        <div className="text-sm font-medium text-slate-500 mb-1">{title}</div>
        <div className="text-[32px] font-bold text-slate-900 tracking-tight leading-none">{value}</div>
      </div>
      <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0" style={{ backgroundColor: iconBg }}>
        {icon}
      </div>
    </div>
  );
}

function AlertCard({ type, organ, title, date, value, color }: { type: string, organ: string, title: string, date: string, value: string, color: string }) {
  return (
    <div className="bg-white rounded-xl overflow-hidden flex" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
      <div className="w-1.5 shrink-0" style={{ backgroundColor: color }} />
      <div className="p-5 flex-1 flex flex-col justify-center">
        <div className="flex justify-between items-start mb-1">
          <div className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color }}>{type}</div>
          <div className="flex items-center text-xs text-slate-500 font-medium bg-slate-100 px-2 py-1 rounded-md">
            <Clock size={12} className="mr-1" /> {date}
          </div>
        </div>
        <div className="text-sm text-slate-500 mb-0.5">{organ}</div>
        <div className="text-base font-bold text-slate-900 leading-snug">{title}</div>
      </div>
      <div className="p-5 border-l border-slate-100 flex flex-col items-end justify-center gap-2 min-w-[160px] bg-slate-50/50">
        <div className="text-sm text-slate-500">Valor estimado</div>
        <div className="text-lg font-bold text-slate-900">{value}</div>
        <button className="text-sm font-semibold mt-1 hover:underline" style={{ color: '#0066FF' }}>
          Ver detalhes
        </button>
      </div>
    </div>
  );
}

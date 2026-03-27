import { AppLayout } from "@/components/layout/AppLayout";
import { useListProcesses } from "@workspace/api-client-react";
import { ProcessStatusBadge } from "@/components/processes/ProcessStatusBadge";
import { CreateProcessDialog } from "@/components/processes/CreateProcessDialog";
import { Card } from "@/components/ui/card";
import { Link } from "wouter";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { FileText, ChevronRight, Calendar, Building2 } from "lucide-react";
import { motion } from "framer-motion";

export function ProcessesPage() {
  const { data: processes, isLoading } = useListProcesses();

  return (
    <AppLayout>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-slate-900">Processos Licitatórios</h1>
          <p className="text-slate-500 mt-1">Gerencie conferências e editais.</p>
        </div>
        <CreateProcessDialog />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <Card key={i} className="h-48 animate-pulse bg-slate-100/50" />
          ))}
        </div>
      ) : processes?.length === 0 ? (
        <div className="text-center py-24 bg-white rounded-2xl border border-dashed border-slate-300">
          <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">Nenhum processo encontrado</h3>
          <p className="text-slate-500 mt-1 max-w-sm mx-auto mb-6">
            Comece criando seu primeiro processo para analisar o edital e conferir documentos.
          </p>
          <CreateProcessDialog />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {processes?.map((process, idx) => (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05, duration: 0.3 }}
              key={process.id}
            >
              <Link href={`/processes/${process.id}`} className="block group">
                <Card className="h-full hover:border-primary/40 hover:shadow-md transition-all duration-200 flex flex-col">
                  <div className="p-5 flex-1 flex flex-col">
                    <div className="flex justify-between items-start mb-3">
                      <ProcessStatusBadge status={process.status} />
                      <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-primary transition-colors" />
                    </div>
                    
                    <h3 className="font-bold text-lg text-slate-900 leading-tight mb-2 line-clamp-2" title={process.title}>
                      {process.title}
                    </h3>
                    
                    <div className="mt-auto space-y-2.5">
                      <div className="flex items-center text-sm text-slate-600">
                        <Building2 className="w-4 h-4 mr-2 text-slate-400 shrink-0" />
                        <span className="truncate">{process.agency}</span>
                      </div>
                      
                      {process.deadline && (
                        <div className="flex items-center text-sm text-slate-600">
                          <Calendar className="w-4 h-4 mr-2 text-slate-400 shrink-0" />
                          <span>{format(new Date(process.deadline), "dd 'de' MMM, yyyy 'às' HH:mm", { locale: ptBR })}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="bg-slate-50 border-t px-5 py-3 rounded-b-xl flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{process.modality}</span>
                    <span className="text-xs font-medium text-primary group-hover:underline">Acessar</span>
                  </div>
                </Card>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </AppLayout>
  );
}

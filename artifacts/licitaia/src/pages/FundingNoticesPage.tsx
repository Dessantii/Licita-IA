import { useState, useEffect, useRef } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { getToken } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Link } from "wouter";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Upload,
  FileText,
  Loader2,
  Plus,
  Calendar,
  Building2,
  CircleDollarSign,
  ChevronRight,
  Folder,
} from "lucide-react";

interface FundingNotice {
  id: number;
  title: string | null;
  source: string | null;
  deadline: string | null;
  maxValue: string | null;
  aiParsingSuccess: boolean;
  createdAt: string;
}

function formatBRL(value: string | null) {
  if (!value) return null;
  const n = parseFloat(value);
  if (isNaN(n)) return null;
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function FundingNoticesPage() {
  const token = getToken();
  const { toast } = useToast();
  const [notices, setNotices] = useState<FundingNotice[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [source, setSource] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  async function loadNotices() {
    try {
      const res = await fetch("/api/funding-notices", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      setNotices(await res.json());
    } catch {
      toast({ title: "Erro ao carregar editais", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadNotices(); }, []);

  async function handleUpload() {
    if (!file) { toast({ title: "Selecione um arquivo PDF", variant: "destructive" }); return; }
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      if (source.trim()) form.append("source", source.trim());
      const res = await fetch("/api/funding-notices/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro no upload");
      toast({ title: "Edital processado com sucesso!" });
      setUploadOpen(false);
      setFile(null);
      setSource("");
      loadNotices();
    } catch (e: any) {
      toast({ title: e.message ?? "Erro ao processar edital", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f?.type === "application/pdf") setFile(f);
  }

  return (
    <AppLayout>
      <div className="p-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Editais de Captação</h1>
            <p className="text-sm text-slate-500 mt-1">
              Suba editais em PDF e a IA extrai os dados automaticamente
            </p>
          </div>
          <Button onClick={() => setUploadOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Novo Edital
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : notices.length === 0 ? (
          <div className="text-center py-20 text-slate-400">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-lg font-medium">Nenhum edital cadastrado</p>
            <p className="text-sm mt-1">Clique em "Novo Edital" para começar</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {notices.map((n) => (
              <Card key={n.id} className="p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900 text-sm leading-tight line-clamp-2">
                      {n.title ?? "Título não extraído"}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
                      {n.source && (
                        <span className="flex items-center gap-1 text-xs text-slate-500">
                          <Building2 className="w-3 h-3" />
                          {n.source}
                        </span>
                      )}
                      {n.deadline && (
                        <span className="flex items-center gap-1 text-xs text-slate-500">
                          <Calendar className="w-3 h-3" />
                          {format(new Date(n.deadline), "dd/MM/yyyy", { locale: ptBR })}
                        </span>
                      )}
                      {n.maxValue && (
                        <span className="flex items-center gap-1 text-xs text-slate-500">
                          <CircleDollarSign className="w-3 h-3" />
                          {formatBRL(n.maxValue)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        n.aiParsingSuccess
                          ? "bg-green-100 text-green-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {n.aiParsingSuccess ? "IA extraiu dados" : "Sem dados IA"}
                    </span>
                    <Link href={`/funding-projects?noticeId=${n.id}`}>
                      <Button size="sm" variant="outline" className="gap-1">
                        <Folder className="w-3 h-3" />
                        Projetos
                        <ChevronRight className="w-3 h-3" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Upload de Edital</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div
              ref={dropRef}
              onDragOver={(e) => e.preventDefault()}
              onDrop={onDrop}
              onClick={() => fileRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                file ? "border-primary bg-primary/5" : "border-slate-300 hover:border-slate-400"
              }`}
            >
              <Upload className="w-8 h-8 mx-auto mb-2 text-slate-400" />
              {file ? (
                <p className="text-sm font-medium text-primary">{file.name}</p>
              ) : (
                <>
                  <p className="text-sm font-medium text-slate-700">Arraste o PDF ou clique</p>
                  <p className="text-xs text-slate-400 mt-1">Apenas arquivos .pdf</p>
                </>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">
                Fonte / Órgão <span className="text-slate-400 font-normal">(opcional)</span>
              </label>
              <input
                className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="Ex: Ministério da Educação"
                value={source}
                onChange={(e) => setSource(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadOpen(false)} disabled={uploading}>
              Cancelar
            </Button>
            <Button onClick={handleUpload} disabled={!file || uploading}>
              {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
              {uploading ? "Processando..." : "Enviar e Analisar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

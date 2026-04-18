import { useState, useEffect } from "react";
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
  DialogDescription,
} from "@/components/ui/dialog";
import { Link, useLocation } from "wouter";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Loader2,
  Plus,
  FolderOpen,
  FileText,
  ChevronRight,
  BookOpen,
  Trash2,
  ShieldCheck,
} from "lucide-react";

interface Project {
  id: number;
  title: string;
  status: string;
  fundingNoticeId: number | null;
  noticeTitle: string | null;
  noticeSource: string | null;
  validatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface FundingNotice {
  id: number;
  title: string | null;
  source: string | null;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft: { label: "Rascunho", color: "bg-slate-100 text-slate-600" },
  in_progress: { label: "Em andamento", color: "bg-blue-100 text-blue-700" },
  completed: { label: "Concluído", color: "bg-green-100 text-green-700" },
};

export function FundingProjectsPage() {
  const token = getToken();
  const { toast } = useToast();
  const [location] = useLocation();
  const [projects, setProjects] = useState<Project[]>([]);
  const [notices, setNotices] = useState<FundingNotice[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [noticeId, setNoticeId] = useState<string>("");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  const preselectedNoticeId = new URLSearchParams(location.split("?")[1] ?? "").get("noticeId");

  useEffect(() => {
    if (preselectedNoticeId) setNoticeId(preselectedNoticeId);
    loadAll();
  }, []);

  async function loadAll() {
    try {
      const [pRes, nRes] = await Promise.all([
        fetch("/api/projects", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/funding-notices", { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (pRes.ok) setProjects(await pRes.json());
      if (nRes.ok) setNotices(await nRes.json());
    } catch {
      toast({ title: "Erro ao carregar dados", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    if (!title.trim()) { toast({ title: "Informe o título do projeto", variant: "destructive" }); return; }
    setCreating(true);
    try {
      const body: Record<string, unknown> = { title: title.trim() };
      if (noticeId) body.fundingNoticeId = parseInt(noticeId);
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao criar projeto");
      toast({ title: "Projeto criado!" });
      setCreateOpen(false);
      setTitle("");
      setNoticeId(preselectedNoticeId ?? "");
      loadAll();
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/projects/${deleteId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao excluir");
      toast({ title: "Projeto excluído" });
      setDeleteId(null);
      setProjects((prev) => prev.filter((p) => p.id !== deleteId));
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <AppLayout>
      <div className="p-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Projetos de Captação</h1>
            <p className="text-sm text-slate-500 mt-1">
              Escreva projetos com auxílio de IA baseados nos editais
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/funding-notices">
              <Button variant="outline">
                <BookOpen className="w-4 h-4 mr-2" />
                Ver Editais
              </Button>
            </Link>
            <Button onClick={() => { setCreateOpen(true); if (preselectedNoticeId) setNoticeId(preselectedNoticeId); }}>
              <Plus className="w-4 h-4 mr-2" />
              Novo Projeto
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-20 text-slate-400">
            <FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-lg font-medium">Nenhum projeto ainda</p>
            <p className="text-sm mt-1">Crie um projeto e comece a escrever com IA</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {projects.map((p) => {
              const status = STATUS_LABELS[p.status] ?? { label: p.status, color: "bg-slate-100 text-slate-600" };
              return (
                <Card key={p.id} className="p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-slate-900">{p.title}</p>
                        {p.validatedAt && (
                          <span className="text-xs px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3" />
                            Validado
                          </span>
                        )}
                      </div>
                      {p.noticeTitle && (
                        <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                          <FileText className="w-3 h-3" />
                          {p.noticeTitle}
                          {p.noticeSource && ` · ${p.noticeSource}`}
                        </p>
                      )}
                      <p className="text-xs text-slate-400 mt-1">
                        Atualizado em {format(new Date(p.updatedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${status.color}`}>
                        {status.label}
                      </span>
                      <Link href={`/funding-projects/${p.id}`}>
                        <Button size="sm" variant="outline" className="gap-1">
                          Editar
                          <ChevronRight className="w-3 h-3" />
                        </Button>
                      </Link>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 px-2"
                        onClick={() => setDeleteId(p.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Delete confirmation */}
      <Dialog open={deleteId !== null} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Excluir projeto?</DialogTitle>
            <DialogDescription>
              Esta ação é irreversível. O projeto e todas as suas seções serão excluídos permanentemente.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)} disabled={deleting}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Projeto</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">Título do projeto *</label>
              <input
                className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="Ex: Projeto de Alimentação Escolar 2026"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">
                Edital vinculado <span className="text-slate-400 font-normal">(opcional)</span>
              </label>
              <select
                className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white"
                value={noticeId}
                onChange={(e) => setNoticeId(e.target.value)}
              >
                <option value="">Nenhum</option>
                {notices.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.title ? `${n.title.slice(0, 60)}...` : `Edital #${n.id}`}
                    {n.source ? ` (${n.source})` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={!title.trim() || creating}>
              {creating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
              Criar Projeto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

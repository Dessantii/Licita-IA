import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getToken, getUser } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Users,
  UserPlus,
  Trash2,
  Loader2,
  ShieldCheck,
  User,
  X,
  ChevronDown,
  KeyRound,
} from "lucide-react";

interface UserData {
  id: number;
  name: string;
  email: string;
  role: "admin" | "user";
  createdAt: string;
}

async function apiFetch(path: string, options?: RequestInit) {
  const token = getToken();
  const res = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? `Erro ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export function UsuáriosPage() {
  const me = getUser();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "user" as "user" | "admin" });
  const [resetTarget, setResetTarget] = useState<UserData | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    setLoading(true);
    try {
      const data = await apiFetch("/api/admin/users");
      setUsers(data);
    } catch (e: any) {
      toast({ title: "Erro ao carregar usuários", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const newUser = await apiFetch("/api/admin/users", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setUsers((prev) => [...prev, newUser]);
      setForm({ name: "", email: "", password: "", role: "user" });
      setShowForm(false);
      toast({ title: "Usuário criado com sucesso!" });
    } catch (e: any) {
      toast({ title: "Erro ao criar usuário", description: e.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: number) {
    setDeleting(id);
    try {
      await apiFetch(`/api/admin/users/${id}`, { method: "DELETE" });
      setUsers((prev) => prev.filter((u) => u.id !== id));
      toast({ title: "Usuário removido." });
    } catch (e: any) {
      toast({ title: "Erro ao remover", description: e.message, variant: "destructive" });
    } finally {
      setDeleting(null);
    }
  }

  async function handleRoleToggle(user: UserData) {
    const newRole = user.role === "admin" ? "user" : "admin";
    try {
      const updated = await apiFetch(`/api/admin/users/${user.id}/role`, {
        method: "PATCH",
        body: JSON.stringify({ role: newRole }),
      });
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      toast({ title: `Função de ${user.name} alterada para ${newRole === "admin" ? "Administrador" : "Usuário"}.` });
    } catch (e: any) {
      toast({ title: "Erro ao alterar função", description: e.message, variant: "destructive" });
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!resetTarget) return;
    setResetting(true);
    try {
      await apiFetch(`/api/admin/users/${resetTarget.id}/password`, {
        method: "PATCH",
        body: JSON.stringify({ password: resetPassword }),
      });
      toast({ title: `Senha de ${resetTarget.name} redefinida com sucesso!` });
      setResetTarget(null);
      setResetPassword("");
    } catch (e: any) {
      toast({ title: "Erro ao redefinir senha", description: e.message, variant: "destructive" });
    } finally {
      setResetting(false);
    }
  }

  if (me?.role !== "admin") {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center py-32 text-center">
          <ShieldCheck className="w-12 h-12 text-slate-300 mb-4" />
          <h2 className="text-xl font-bold text-slate-700">Acesso restrito</h2>
          <p className="text-slate-500 mt-2">Apenas administradores podem acessar esta página.</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-slate-900">Gerenciar Usuários</h1>
          <p className="text-slate-500 mt-1">{users.length} usuário{users.length !== 1 ? "s" : ""} cadastrado{users.length !== 1 ? "s" : ""}.</p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)} className="gap-2">
          {showForm ? <X className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
          {showForm ? "Cancelar" : "Novo Usuário"}
        </Button>
      </div>

      {showForm && (
        <Card className="p-5 mb-6 border-primary/30 bg-primary/5">
          <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-primary" />
            Criar Novo Usuário
          </h3>
          <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="newName">Nome completo</Label>
              <Input
                id="newName"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="João da Silva"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newEmail">E-mail</Label>
              <Input
                id="newEmail"
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="joao@empresa.com.br"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">Senha inicial</Label>
              <Input
                id="newPassword"
                type="password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="Mínimo 6 caracteres"
                required
                minLength={6}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newRole">Função</Label>
              <div className="relative">
                <select
                  id="newRole"
                  value={form.role}
                  onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as "user" | "admin" }))}
                  className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background appearance-none focus:outline-none focus:ring-2 focus:ring-primary/20 pr-8"
                >
                  <option value="user">Usuário</option>
                  <option value="admin">Administrador</option>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>
            <div className="md:col-span-2 flex justify-end">
              <Button type="submit" disabled={creating} className="gap-2">
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                {creating ? "Criando..." : "Criar Usuário"}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {resetTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-sm p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-amber-600" />
                <h3 className="font-bold text-slate-900">Redefinir Senha</h3>
              </div>
              <button onClick={() => setResetTarget(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm text-slate-500 mb-4">
              Definir nova senha para <span className="font-semibold text-slate-700">{resetTarget.name}</span>.
            </p>
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="resetPw">Nova senha</Label>
                <Input
                  id="resetPw"
                  type="password"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  required
                  minLength={6}
                  autoFocus
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="ghost" onClick={() => setResetTarget(null)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={resetting} className="gap-2 bg-amber-600 hover:bg-amber-700 text-white">
                  {resetting ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                  {resetting ? "Redefinindo..." : "Redefinir"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      <Card className="overflow-hidden">
        <div className="p-4 border-b flex items-center gap-2">
          <Users className="w-5 h-5 text-slate-500" />
          <h3 className="font-bold text-slate-900">Usuários do Sistema</h3>
        </div>
        {loading ? (
          <div className="p-8 text-center">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-400" />
          </div>
        ) : (
          <div className="divide-y">
            {users.map((user) => (
              <div key={user.id} className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold ${
                    user.role === "admin" ? "bg-primary/10 text-primary" : "bg-slate-100 text-slate-600"
                  }`}>
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-slate-900 text-sm">{user.name}</p>
                      {user.id === me?.id && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">Você</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">{user.email}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Desde {format(new Date(user.createdAt), "dd/MM/yyyy", { locale: ptBR })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleRoleToggle(user)}
                    disabled={user.id === me?.id}
                    title={user.id === me?.id ? "Você não pode alterar sua própria função" : "Alterar função"}
                    className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${
                      user.role === "admin"
                        ? "bg-primary/10 text-primary hover:bg-primary/20"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {user.role === "admin" ? (
                      <ShieldCheck className="w-3.5 h-3.5" />
                    ) : (
                      <User className="w-3.5 h-3.5" />
                    )}
                    {user.role === "admin" ? "Admin" : "Usuário"}
                  </button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => { setResetTarget(user); setResetPassword(""); }}
                    title="Redefinir senha"
                    className="text-slate-400 hover:text-amber-600 h-8 w-8"
                  >
                    <KeyRound className="w-4 h-4" />
                  </Button>
                  {user.id !== me?.id && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(user.id)}
                      disabled={deleting === user.id}
                      className="text-slate-400 hover:text-destructive h-8 w-8"
                    >
                      {deleting === user.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </AppLayout>
  );
}

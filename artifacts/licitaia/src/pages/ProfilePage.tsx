import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { getUser, getToken, saveAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

export function ProfilePage() {
  const user = getUser();
  const token = getToken();
  const { toast } = useToast();

  const [name, setName] = useState(user?.name ?? "");
  const [nameLoading, setNameLoading] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);

  async function handleNameSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setNameLoading(true);
    try {
      const res = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Erro", description: data.error ?? "Não foi possível atualizar o nome.", variant: "destructive" });
        return;
      }
      if (user) {
        saveAuth(token!, { ...user, name: data.name });
      }
      toast({ title: "Nome atualizado", description: "Seu nome foi atualizado com sucesso." });
    } catch {
      toast({ title: "Erro", description: "Erro de conexão.", variant: "destructive" });
    } finally {
      setNameLoading(false);
    }
  }

  async function handlePasswordSave(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast({ title: "Erro", description: "A nova senha e a confirmação não coincidem.", variant: "destructive" });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: "Erro", description: "A nova senha deve ter pelo menos 6 caracteres.", variant: "destructive" });
      return;
    }
    setPasswordLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Erro", description: data.error ?? "Não foi possível alterar a senha.", variant: "destructive" });
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast({ title: "Senha alterada", description: "Sua senha foi alterada com sucesso." });
    } catch {
      toast({ title: "Erro", description: "Erro de conexão.", variant: "destructive" });
    } finally {
      setPasswordLoading(false);
    }
  }

  return (
    <AppLayout>
      <div className="max-w-lg">
        <h1 className="text-2xl font-bold text-foreground mb-1">Meu Perfil</h1>
        <p className="text-muted-foreground text-sm mb-8">Atualize suas informações pessoais e senha de acesso.</p>

        <div className="bg-white border border-border rounded-xl p-6 mb-6">
          <h2 className="text-base font-semibold text-foreground mb-4">Informações pessoais</h2>
          <form onSubmit={handleNameSave} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Nome</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                placeholder="Seu nome completo"
                required
                minLength={2}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">E-mail</label>
              <input
                type="email"
                value={user?.email ?? ""}
                disabled
                className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-slate-50 text-muted-foreground cursor-not-allowed"
              />
              <p className="text-xs text-muted-foreground mt-1">O e-mail não pode ser alterado.</p>
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={nameLoading || !name.trim()}
                className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {nameLoading ? "Salvando..." : "Salvar nome"}
              </button>
            </div>
          </form>
        </div>

        <div className="bg-white border border-border rounded-xl p-6">
          <h2 className="text-base font-semibold text-foreground mb-4">Alterar senha</h2>
          <form onSubmit={handlePasswordSave} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Senha atual</label>
              <input
                type="password"
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                placeholder="••••••••"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Nova senha</label>
              <input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Confirmar nova senha</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={passwordLoading || !currentPassword || !newPassword || !confirmPassword}
                className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {passwordLoading ? "Alterando..." : "Alterar senha"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </AppLayout>
  );
}

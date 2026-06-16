const TOKEN_KEY = "licitaia_token";
const USER_KEY = "licitaia_user";

export type ModuleKey = "licitacoes" | "chamamentos" | "captacao";
export const ALL_MODULES: ModuleKey[] = ["licitacoes", "chamamentos", "captacao"];

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: string;
  modules?: ModuleKey[];
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function getUserModules(): ModuleKey[] {
  const user = getUser();
  if (!user) return [];
  if (user.role === "admin") return ALL_MODULES;
  return user.modules ?? ALL_MODULES;
}

export function hasModule(moduleId: ModuleKey): boolean {
  return getUserModules().includes(moduleId);
}

export function saveAuth(token: string, user: AuthUser) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

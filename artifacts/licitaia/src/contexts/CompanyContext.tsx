import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { getToken } from "@/hooks/use-auth";

interface Company {
  id: number;
  razaoSocial: string | null;
  nomeFantasia: string | null;
  cnpj: string | null;
}

interface CompanyContextValue {
  companies: Company[];
  activeCompany: Company | null;
  setActiveCompanyId: (id: number | null) => void;
  isLoading: boolean;
  reload: () => void;
}

const CompanyContext = createContext<CompanyContextValue>({
  companies: [],
  activeCompany: null,
  setActiveCompanyId: () => {},
  isLoading: false,
  reload: () => {},
});

const STORAGE_KEY = "licitaia_active_company_id";
const ALL_VALUE = "all";

export function CompanyProvider({ children }: { children: ReactNode }) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [activeCompanyId, setActiveCompanyIdState] = useState<number | null>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === ALL_VALUE) return null;
    return stored ? parseInt(stored, 10) : null;
  });
  const [userChoseAll, setUserChoseAll] = useState<boolean>(() => {
    return localStorage.getItem(STORAGE_KEY) === ALL_VALUE;
  });
  const [isLoading, setIsLoading] = useState(false);

  const load = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    setIsLoading(true);
    try {
      const res = await fetch("/api/companies", { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return;
      const data: Company[] = await res.json();
      setCompanies(data);
      setActiveCompanyIdState(prev => {
        // If user explicitly chose "all", keep it
        if (localStorage.getItem(STORAGE_KEY) === ALL_VALUE) return null;
        if (prev !== null && data.some(c => c.id === prev)) return prev;
        if (data.length > 0) {
          localStorage.setItem(STORAGE_KEY, String(data[0]!.id));
          return data[0]!.id;
        }
        return null;
      });
    } catch {}
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  function setActiveCompanyId(id: number | null) {
    setActiveCompanyIdState(id);
    if (id === null) {
      localStorage.setItem(STORAGE_KEY, ALL_VALUE);
      setUserChoseAll(true);
    } else {
      localStorage.setItem(STORAGE_KEY, String(id));
      setUserChoseAll(false);
    }
  }

  const activeCompany = companies.find(c => c.id === activeCompanyId) ?? null;

  return (
    <CompanyContext.Provider value={{ companies, activeCompany, setActiveCompanyId, isLoading, reload: load }}>
      {children}
    </CompanyContext.Provider>
  );
}

export function useActiveCompany() {
  return useContext(CompanyContext);
}

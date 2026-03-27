import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import { LoginPage } from "@/pages/LoginPage";
import { ProcessesPage } from "@/pages/ProcessesPage";
import { ProcessDetailPage } from "@/pages/ProcessDetailPage";
import { ProcessChecklistPage } from "@/pages/ProcessChecklistPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
      staleTime: 1000 * 60 * 5,
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="/">
        {() => <Redirect to="/login" />}
      </Route>
      <Route path="/processes" component={ProcessesPage} />
      <Route path="/processes/:id" component={ProcessDetailPage} />
      <Route path="/processes/:id/checklist" component={ProcessChecklistPage} />

      <Route path="/reports">
        {() => (
          <div className="p-8 text-center">
            <h2 className="text-2xl font-bold">Relatórios</h2>
            <p className="text-slate-500">Módulo em desenvolvimento.</p>
          </div>
        )}
      </Route>
      <Route path="/settings">
        {() => (
          <div className="p-8 text-center">
            <h2 className="text-2xl font-bold">Configurações</h2>
            <p className="text-slate-500">Módulo em desenvolvimento.</p>
          </div>
        )}
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

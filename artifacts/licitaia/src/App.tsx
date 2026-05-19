import React from "react";
import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { getToken, isAuthenticated } from "@/hooks/use-auth";

import { CompanyProvider } from "@/contexts/CompanyContext";
import { LoginPage } from "@/pages/LoginPage";
import { LandingPage } from "@/pages/LandingPage";
import { ModuleHubPage } from "@/pages/ModuleHubPage";
import { InicioPage } from "@/pages/InicioPage";
import { ComecarPage } from "@/pages/ComecarPage";
import { GuiasPage } from "@/pages/GuiasPage";
import { AjudaPage } from "@/pages/AjudaPage";
import { ProfilePage } from "@/pages/ProfilePage";
import { ProcessesPage } from "@/pages/ProcessesPage";
import { ProcessDetailPage } from "@/pages/ProcessDetailPage";
import { ProcessChecklistPage } from "@/pages/ProcessChecklistPage";
import { RelatóriosPage } from "@/pages/RelatóriosPage";
import { ConfiguraçõesPage } from "@/pages/ConfiguraçõesPage";
import { MonitoramentosPage } from "@/pages/MonitoramentosPage";
import { UsuáriosPage } from "@/pages/UsuáriosPage";
import { ChamamentosPage } from "@/pages/ChamamentosPage";
import { ChamamentoDetailPage } from "@/pages/ChamamentoDetailPage";
import { ChamamentoChecklistPage } from "@/pages/ChamamentoChecklistPage";
import { CompaniesPage } from "@/pages/CompaniesPage";
import { EmpresaDetailPage } from "@/pages/EmpresaDetailPage";
import { FundingNoticesPage } from "@/pages/FundingNoticesPage";
import { FundingProjectsPage } from "@/pages/FundingProjectsPage";
import { FundingProjectEditorPage } from "@/pages/FundingProjectEditorPage";
import { OportunidadesPage } from "@/pages/OportunidadesPage";
import { DescobertaPage } from "@/pages/DescobertaPage";

setAuthTokenGetter(() => getToken());

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
      staleTime: 1000 * 60 * 5,
    },
  },
});

function ProtectedRoute({ component: Component }: { component: () => React.ReactElement }) {
  if (!isAuthenticated()) return <Redirect to="/login" />;
  return <Component />;
}

function Router() {
  return (
    <Switch>
      {/* Public */}
      <Route path="/">
        {() => isAuthenticated() ? <ModuleHubPage /> : <LandingPage />}
      </Route>
      <Route path="/inicio">
        {() => <ProtectedRoute component={InicioPage} />}
      </Route>
      <Route path="/landing" component={LandingPage} />
      <Route path="/login" component={LoginPage} />

      {/* New journey-based navigation */}
      <Route path="/comecar">
        {() => <ProtectedRoute component={ComecarPage} />}
      </Route>
      <Route path="/guias">
        {() => <ProtectedRoute component={GuiasPage} />}
      </Route>
      <Route path="/ajuda">
        {() => <ProtectedRoute component={AjudaPage} />}
      </Route>

      {/* Processes (Licitações) */}
      <Route path="/processes">
        {() => <ProtectedRoute component={ProcessesPage} />}
      </Route>
      <Route path="/processes/:id/checklist">
        {() => <ProtectedRoute component={ProcessChecklistPage} />}
      </Route>
      <Route path="/processes/:id">
        {() => <ProtectedRoute component={ProcessDetailPage} />}
      </Route>

      {/* Chamamentos */}
      <Route path="/chamamentos">
        {() => <ProtectedRoute component={ChamamentosPage} />}
      </Route>
      <Route path="/chamamentos/:id/checklist">
        {() => <ProtectedRoute component={ChamamentoChecklistPage} />}
      </Route>
      <Route path="/chamamentos/:id">
        {() => <ProtectedRoute component={ChamamentoDetailPage} />}
      </Route>

      {/* Monitoring */}
      <Route path="/monitors">
        {() => <ProtectedRoute component={MonitoramentosPage} />}
      </Route>

      {/* Opportunities & Funding */}
      <Route path="/oportunidades">
        {() => <ProtectedRoute component={DescobertaPage} />}
      </Route>
      <Route path="/captacao">
        {() => <ProtectedRoute component={OportunidadesPage} />}
      </Route>
      <Route path="/funding-notices">
        {() => <ProtectedRoute component={FundingNoticesPage} />}
      </Route>
      <Route path="/funding-projects">
        {() => <ProtectedRoute component={FundingProjectsPage} />}
      </Route>
      <Route path="/funding-projects/:id">
        {() => <ProtectedRoute component={FundingProjectEditorPage} />}
      </Route>

      {/* Companies */}
      <Route path="/empresas">
        {() => <Redirect to="/companies" />}
      </Route>
      <Route path="/companies">
        {() => <ProtectedRoute component={CompaniesPage} />}
      </Route>
      <Route path="/companies/:id">
        {() => <ProtectedRoute component={EmpresaDetailPage} />}
      </Route>

      {/* Settings & Admin */}
      <Route path="/reports">
        {() => <ProtectedRoute component={RelatóriosPage} />}
      </Route>
      <Route path="/profile">
        {() => <ProtectedRoute component={ProfilePage} />}
      </Route>
      <Route path="/settings">
        {() => <ProtectedRoute component={ConfiguraçõesPage} />}
      </Route>
      <Route path="/admin/users">
        {() => <ProtectedRoute component={UsuáriosPage} />}
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
          <CompanyProvider>
            <Router />
          </CompanyProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

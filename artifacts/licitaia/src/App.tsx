import React from "react";
import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { getToken, isAuthenticated } from "@/hooks/use-auth";

import { LoginPage } from "@/pages/LoginPage";
import { ProcessesPage } from "@/pages/ProcessesPage";
import { ProcessDetailPage } from "@/pages/ProcessDetailPage";
import { ProcessChecklistPage } from "@/pages/ProcessChecklistPage";
import { RelatóriosPage } from "@/pages/RelatóriosPage";
import { ConfiguraçõesPage } from "@/pages/ConfiguraçõesPage";
import { MonitoramentosPage } from "@/pages/MonitoramentosPage";

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
      <Route path="/">
        {() => <Redirect to="/processes" />}
      </Route>
      <Route path="/login" component={LoginPage} />
      <Route path="/processes">
        {() => <ProtectedRoute component={ProcessesPage} />}
      </Route>
      <Route path="/processes/:id/checklist">
        {() => <ProtectedRoute component={ProcessChecklistPage} />}
      </Route>
      <Route path="/processes/:id">
        {() => <ProtectedRoute component={ProcessDetailPage} />}
      </Route>
      <Route path="/monitors">
        {() => <ProtectedRoute component={MonitoramentosPage} />}
      </Route>
      <Route path="/reports">
        {() => <ProtectedRoute component={RelatóriosPage} />}
      </Route>
      <Route path="/settings">
        {() => <ProtectedRoute component={ConfiguraçõesPage} />}
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

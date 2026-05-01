import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { Layout } from "@/components/layout";
import { setAuthTokenGetter } from "@workspace/api-client-react";

// Pages
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Tasks from "@/pages/tasks";
import TaskDetail from "@/pages/task-detail";
import TaskForm from "@/pages/task-form";
import Reports from "@/pages/reports";
import Categories from "@/pages/categories";
import UserManagement from "@/pages/users";
import NotFound from "@/pages/not-found";

// Initialize auth token getter
setAuthTokenGetter(() => localStorage.getItem("auth_token"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 60 * 1000,
    },
  },
});

function AppRouter() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/">
        {() => {
          window.location.replace("/dashboard");
          return null;
        }}
      </Route>
      <Route path="/dashboard">
        <Layout><Dashboard /></Layout>
      </Route>
      <Route path="/tasks/new">
        <Layout><TaskForm /></Layout>
      </Route>
      <Route path="/tasks/:id/edit">
        {(params) => <Layout><TaskForm taskId={params.id} /></Layout>}
      </Route>
      <Route path="/tasks/:id">
        {(params) => <Layout><TaskDetail taskId={params.id} /></Layout>}
      </Route>
      <Route path="/tasks">
        <Layout><Tasks /></Layout>
      </Route>
      <Route path="/reports">
        <Layout><Reports /></Layout>
      </Route>
      <Route path="/categories">
        <Layout><Categories /></Layout>
      </Route>
      <Route path="/users">
        <Layout><UserManagement /></Layout>
      </Route>
      <Route>
        <Layout><NotFound /></Layout>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="system" storageKey="office-task-theme">
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <AppRouter />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;

import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { AuthProvider, useAuth } from "./auth";
import { Shell } from "./components/Shell";
import { LoginPage, RegisterPage, BannedScreen } from "./pages/AuthPages";
import { HomePage } from "./pages/Home";
import { EditorPage } from "./pages/Editor";
import { ProfilePage } from "./pages/Profile";
import { AdminPanel } from "./pages/Admin";
import { ChatList, ChatRoom } from "./pages/Chat";
import { ProjectView, ProjectsListPage } from "./pages/Project";
import { MapPage } from "./pages/Map";
import { CourtPage } from "./pages/Court";
import { Intro } from "./components/Intro";

const queryClient = new QueryClient();

function Routed() {
  const { banned, loading } = useAuth();
  if (loading) return <div className="p-12 text-center">Cargando reino...</div>;
  if (banned) return <BannedScreen reason={banned.reason} />;
  return (
    <Shell>
      <Switch>
        <Route path="/" component={HomePage} />
        <Route path="/entrar" component={LoginPage} />
        <Route path="/unirse" component={RegisterPage} />
        <Route path="/proyectos" component={ProjectsListPage} />
        <Route path="/proyecto/:id" component={ProjectView} />
        <Route path="/editor/:id" component={EditorPage} />
        <Route path="/u/:username" component={ProfilePage} />
        <Route path="/panel" component={AdminPanel} />
        <Route path="/mapa" component={MapPage} />
        <Route path="/corte" component={CourtPage} />
        <Route path="/chat" component={ChatList} />
        <Route path="/chat/:id" component={ChatRoom} />
        <Route component={NotFound} />
      </Switch>
    </Shell>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <Intro />
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Routed />
          </WouterRouter>
          <Toaster />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

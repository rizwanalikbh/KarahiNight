import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Home } from "./pages/Home";
import { AdminLogin } from "./pages/AdminLogin";
import { Login } from "./pages/Login";
import { Order } from "./pages/Order";
import { AdminDashboard } from "./pages/AdminDashboard";
import { Kitchen } from "./pages/Kitchen";
import { Receipt } from "./pages/Receipt";
import { Recipes } from "./pages/Recipes";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/admin" component={AdminLogin} />
      <Route path="/login" component={Login} />
      <Route path="/order" component={Order} />
      <Route path="/admin/dashboard" component={AdminDashboard} />
      <Route path="/kitchen" component={Kitchen} />
      <Route path="/receipt/:id" component={Receipt} />
      <Route path="/recipes" component={Recipes} />
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

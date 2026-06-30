import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Recommend from "./pages/Recommend";
import Daily from "./pages/Daily";
import Points from "./pages/Points";
import Subscribe from "./pages/Subscribe";
import More from "./pages/More";
import Story from "./pages/Story";
import Admin from "./pages/Admin";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/recommend"} component={Recommend} />
      <Route path={"/daily"} component={Daily} />
      <Route path={"/points"} component={Points} />
      <Route path={"/subscribe"} component={Subscribe} />
      <Route path={"/more"} component={More} />
      <Route path={"/story"} component={Story} />
      <Route path={"/admin"} component={Admin} />
      <Route path={"/privacy"} component={Privacy} />
      <Route path={"/terms"} component={Terms} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;

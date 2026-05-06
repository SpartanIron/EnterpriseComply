import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ui/theme-provider";
import { Layout } from "@/components/layout/Layout";
import Dashboard from "@/pages/Dashboard";
import Controls from "@/pages/Controls";
import Risks from "@/pages/Risks";
import Frameworks from "@/pages/Frameworks";
import Assets from "@/pages/Assets";
import Findings from "@/pages/Findings";
import Telemetry from "@/pages/Telemetry";
import Graph from "@/pages/Graph";
import GapAnalysis from "@/pages/GapAnalysis";
import POAM from "@/pages/POAM";
import ComplianceJourney from "@/pages/ComplianceJourney";
import ExecutiveBrief from "@/pages/ExecutiveBrief";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,
      retry: 1,
    },
  },
});

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/controls" component={Controls} />
        <Route path="/risks" component={Risks} />
        <Route path="/frameworks" component={Frameworks} />
        <Route path="/assets" component={Assets} />
        <Route path="/findings" component={Findings} />
        <Route path="/telemetry" component={Telemetry} />
        <Route path="/graph" component={Graph} />
        <Route path="/gap-analysis" component={GapAnalysis} />
        <Route path="/poam" component={POAM} />
        <Route path="/journey" component={ComplianceJourney} />
        <Route path="/brief" component={ExecutiveBrief} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="light" storageKey="c2s-ciop-theme-v2">
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;

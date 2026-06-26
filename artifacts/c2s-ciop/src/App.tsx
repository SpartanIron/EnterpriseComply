import { Switch, Route, useLocation, Router as WouterRouter } from "wouter";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { useEffect } from "react";
import { authClient } from "./lib/auth-client";
import AppShell from "./components/layout/AppShell";
import Landing from "./pages/Landing";
import SignIn from "./pages/SignIn";
import SignUp from "./pages/SignUp";
import Dashboard from "./pages/Dashboard";
import Onboarding from "./pages/Onboarding";
import Frameworks from "./pages/Frameworks";
import Controls from "./pages/Controls";
import Integrations from "./pages/Integrations";
import Evidence from "./pages/Evidence";
import Policies from "./pages/Policies";
import People from "./pages/People";
import Vendors from "./pages/Vendors";
import POAM from "./pages/POAM";
import Settings from "./pages/Settings";
import RiskRegister from "./pages/RiskRegister";
import Audits from "./pages/Audits";
import SPRS from "./pages/SPRS";
import SSP from "./pages/SSP";
import Monitoring from "./pages/Monitoring";
import Questionnaires from "./pages/Questionnaires";
import Assessments from "./pages/Assessments";
import ZeroTrustAssessmentReport from "./pages/ZeroTrustAssessmentReport";
import AccessReviews from "./pages/AccessReviews";
import CustomFrameworks from "./pages/CustomFrameworks";
import TrustCenter from "./pages/TrustCenter";
import AuditLog from "./pages/AuditLog";
import ComplianceReport from "./pages/ComplianceReport";
import GapAnalysis from "./pages/GapAnalysis";
import Remediation from "./pages/Remediation";
import TestRunHistory from "./pages/TestRunHistory";
import Pricing from "./pages/Pricing";
import Stigs from "./pages/Stigs";
import NotFound from "./pages/not-found";
import AssetInventory from "./pages/AssetInventory";
import Documentation from "./pages/Documentation";
import ZeroTrustAssessment from "./pages/ZeroTrustAssessment";
import SystemBoundary from "./pages/SystemBoundary";
import ControlCrosswalk from "./pages/ControlCrosswalk";
import VulnManagement from "./pages/VulnManagement";
import NIST800171 from "./pages/NIST800171";
import ConMonProgram from "./pages/ConMonProgram";
import FISMAReporting from "./pages/FISMAReporting";
import SuperAdmin from "./pages/SuperAdmin";
import RoleManagement from "./pages/RoleManagement";
import PublicTrustCenter from "./pages/PublicTrustCenter";
import { RoleProvider } from "./context/RoleContext";

const BASE_PATH = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

function HomeRedirect() {
  const session = authClient.useSession();
  const isSignedIn = !!session.data?.user;
  const isLoaded = !session.isPending;
  const [, navigate] = useLocation();

  const { data, isLoading } = useQuery<{ org: any | null }>({
    queryKey: ["orgs", "me"],
    queryFn: async () => {
      const res = await fetch(`/api/orgs/me`, { credentials: "include" });
      return res.json();
    },
    enabled: isSignedIn && isLoaded,
    retry: false,
  });

  useEffect(() => {
    if (!isLoaded || isLoading) return;
    if (!isSignedIn) return;
    if (data?.org == null) {
      navigate("/onboarding");
    } else if (!data.org.onboardingComplete) {
      navigate("/onboarding");
    } else {
      navigate("/dashboard");
    }
  }, [isLoaded, isLoading, isSignedIn, data, navigate]);

  if (!isLoaded || (isSignedIn && isLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-3">
          <img src={`${BASE_PATH}/logo.svg`} className="h-10 w-10 animate-pulse" />
          <p className="text-slate-500 text-sm">Loading EnterpriseComply...</p>
        </div>
      </div>
    );
  }
  if (!isSignedIn) return <Landing />;
  return null;
}

function RedirectTo({ to }: { to: string }) {
  const [, navigate] = useLocation();
  useEffect(() => { navigate(to); }, [to, navigate]);
  return null;
}

function AppRoutes() {
  return (
    <RoleProvider>
      <Switch>
        <Route path="/" component={HomeRedirect} />
        <Route path="/sign-in/*?" component={SignIn} />
        <Route path="/sign-up/*?" component={SignUp} />
        <Route path="/trust" component={PublicTrustCenter} />
        <Route path="/landing" component={Landing} />
        <Route path="/demo" component={() => (
          <div>
            <div className="fixed top-0 left-0 right-0 z-50 bg-blue-600 px-4 py-2 flex items-center justify-between text-white text-sm">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold bg-white/20 px-2 py-0.5 rounded">DEMO</span>
                <span>You are viewing a demonstration workspace. Data is sample only.</span>
              </div>
              <a href="/sign-up" className="flex-shrink-0 px-3 py-1 bg-white text-blue-700 font-bold rounded-full text-xs hover:bg-blue-50 transition-colors">
                Start free trial
              </a>
            </div>
            <div className="pt-9">
              <AppShell><Dashboard /></AppShell>
            </div>
          </div>
        )} />
        <Route path="/pricing" component={Pricing} />
        <Route path="/onboarding" component={Onboarding} />
        <Route path="/dashboard" component={() => <AppShell><Dashboard /></AppShell>} />
        <Route path="/frameworks" component={() => <AppShell><Frameworks /></AppShell>} />
        <Route path="/controls" component={() => <AppShell><Controls /></AppShell>} />
        <Route path="/integrations" component={() => <AppShell><Integrations /></AppShell>} />
        <Route path="/evidence" component={() => <AppShell><Evidence /></AppShell>} />
        <Route path="/monitoring" component={() => <AppShell><Monitoring /></AppShell>} />
        <Route path="/policies" component={() => <AppShell><Policies /></AppShell>} />
        <Route path="/people" component={() => <AppShell><People /></AppShell>} />
        <Route path="/access-reviews" component={() => <AppShell><AccessReviews /></AppShell>} />
        <Route path="/vendors" component={() => <AppShell><Vendors /></AppShell>} />
        <Route path="/risks" component={() => <AppShell><RiskRegister /></AppShell>} />
        <Route path="/risk-register" component={() => <RedirectTo to="/risks" />} />
        <Route path="/compliance" component={() => <RedirectTo to="/frameworks" />} />
        <Route path="/questionnaires" component={() => <AppShell><Questionnaires /></AppShell>} />
        <Route path="/audits" component={() => <AppShell><Audits /></AppShell>} />
        <Route path="/trust-center" component={() => <AppShell><TrustCenter /></AppShell>} />
        <Route path="/custom-frameworks" component={() => <AppShell><CustomFrameworks /></AppShell>} />
        <Route path="/assessments" component={() => <AppShell><Assessments /></AppShell>} />
        <Route path="/assessments/:id/report" component={() => <ZeroTrustAssessmentReport />} />
        <Route path="/poam" component={() => <AppShell><POAM /></AppShell>} />
        <Route path="/sprs" component={() => <AppShell><SPRS /></AppShell>} />
        <Route path="/ssp" component={() => <AppShell><SSP /></AppShell>} />
        <Route path="/stigs" component={() => <AppShell><Stigs /></AppShell>} />
        <Route path="/settings" component={() => <AppShell><Settings /></AppShell>} />
        <Route path="/audit-log" component={() => <AppShell><AuditLog /></AppShell>} />
        <Route path="/report" component={ComplianceReport} />
        <Route path="/gap-analysis" component={() => <AppShell><GapAnalysis /></AppShell>} />
        <Route path="/remediation" component={() => <AppShell><Remediation /></AppShell>} />
        <Route path="/test-runs" component={() => <AppShell><TestRunHistory /></AppShell>} />
        <Route path="/assets" component={() => <AppShell><AssetInventory /></AppShell>} />
        <Route path="/docs" component={() => <AppShell><Documentation /></AppShell>} />
        <Route path="/zero-trust" component={() => <AppShell><ZeroTrustAssessment /></AppShell>} />
        <Route path="/system-boundary" component={() => <AppShell><SystemBoundary /></AppShell>} />
        <Route path="/control-crosswalk" component={() => <AppShell><ControlCrosswalk /></AppShell>} />
        <Route path="/vuln-management" component={() => <AppShell><VulnManagement /></AppShell>} />
        <Route path="/nist-800-171" component={() => <AppShell><NIST800171 /></AppShell>} />
        <Route path="/conmon" component={() => <AppShell><ConMonProgram /></AppShell>} />
        <Route path="/fisma-reporting" component={() => <AppShell><FISMAReporting /></AppShell>} />
        <Route path="/super-admin" component={() => <AppShell><SuperAdmin /></AppShell>} />
        <Route path="/role-management" component={() => <AppShell><RoleManagement /></AppShell>} />
        <Route component={NotFound} />
      </Switch>
    </RoleProvider>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={BASE_PATH}>
        <AppRoutes />
      </WouterRouter>
    </QueryClientProvider>
  );
}

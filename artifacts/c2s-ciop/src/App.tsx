import { Switch, Route, useLocation, Router as WouterRouter } from "wouter";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { useEffect, type ReactNode } from "react";
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
import OrgTrustCenter from "./pages/OrgTrustCenter";
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

/**
 * P1-UB: Route guard — redirects to /sign-in if there is no active session.
 * Shows a loading spinner while the session check is in flight so the page
 * never partially renders for an unauthenticated visitor.
 * Applied to every authenticated route; public routes (sign-in, trust, landing,
 * pricing, demo) are NOT wrapped.
 */
function RequireAuth({ children }: { children: ReactNode }) {
  const session = authClient.useSession();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!session.isPending && !session.data?.user) {
      navigate("/sign-in");
    }
  }, [session.isPending, session.data?.user, navigate]);

  if (session.isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-3">
          <img src={`${BASE_PATH}/logo.svg`} className="h-10 w-10 animate-pulse" alt="" />
          <p className="text-slate-500 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  // If no user, the useEffect redirect is in flight — render nothing rather
  // than the protected page content.
  if (!session.data?.user) return null;

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <RoleProvider>
      <Switch>
        <Route path="/" component={HomeRedirect} />
        <Route path="/sign-in/*?" component={SignIn} />
        <Route path="/sign-up/*?" component={SignUp} />
        <Route path="/trust" component={PublicTrustCenter} />
        <Route path="/trust/:slug" component={OrgTrustCenter} />
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
        {/* ── Authenticated routes — RequireAuth redirects to /sign-in if no session ── */}
        <Route path="/onboarding" component={() => <RequireAuth><Onboarding /></RequireAuth>} />
        <Route path="/dashboard" component={() => <RequireAuth><AppShell><Dashboard /></AppShell></RequireAuth>} />
        <Route path="/frameworks" component={() => <RequireAuth><AppShell><Frameworks /></AppShell></RequireAuth>} />
        <Route path="/controls" component={() => <RequireAuth><AppShell><Controls /></AppShell></RequireAuth>} />
        <Route path="/integrations" component={() => <RequireAuth><AppShell><Integrations /></AppShell></RequireAuth>} />
        <Route path="/evidence" component={() => <RequireAuth><AppShell><Evidence /></AppShell></RequireAuth>} />
        <Route path="/monitoring" component={() => <RequireAuth><AppShell><Monitoring /></AppShell></RequireAuth>} />
        <Route path="/policies" component={() => <RequireAuth><AppShell><Policies /></AppShell></RequireAuth>} />
        <Route path="/people" component={() => <RequireAuth><AppShell><People /></AppShell></RequireAuth>} />
        <Route path="/access-reviews" component={() => <RequireAuth><AppShell><AccessReviews /></AppShell></RequireAuth>} />
        <Route path="/vendors" component={() => <RequireAuth><AppShell><Vendors /></AppShell></RequireAuth>} />
        <Route path="/risks" component={() => <RequireAuth><AppShell><RiskRegister /></AppShell></RequireAuth>} />
        <Route path="/risk-register" component={() => <RedirectTo to="/risks" />} />
        <Route path="/compliance" component={() => <RedirectTo to="/frameworks" />} />
        <Route path="/questionnaires" component={() => <RequireAuth><AppShell><Questionnaires /></AppShell></RequireAuth>} />
        <Route path="/audits" component={() => <RequireAuth><AppShell><Audits /></AppShell></RequireAuth>} />
        <Route path="/trust-center" component={() => <RequireAuth><AppShell><TrustCenter /></AppShell></RequireAuth>} />
        <Route path="/custom-frameworks" component={() => <RequireAuth><AppShell><CustomFrameworks /></AppShell></RequireAuth>} />
        <Route path="/assessments" component={() => <RequireAuth><AppShell><Assessments /></AppShell></RequireAuth>} />
        <Route path="/assessments/:id/report" component={() => <RequireAuth><ZeroTrustAssessmentReport /></RequireAuth>} />
        <Route path="/poam" component={() => <RequireAuth><AppShell><POAM /></AppShell></RequireAuth>} />
        <Route path="/sprs" component={() => <RequireAuth><AppShell><SPRS /></AppShell></RequireAuth>} />
        <Route path="/ssp" component={() => <RequireAuth><AppShell><SSP /></AppShell></RequireAuth>} />
        <Route path="/stigs" component={() => <RequireAuth><AppShell><Stigs /></AppShell></RequireAuth>} />
        <Route path="/settings" component={() => <RequireAuth><AppShell><Settings /></AppShell></RequireAuth>} />
        <Route path="/audit-log" component={() => <RequireAuth><AppShell><AuditLog /></AppShell></RequireAuth>} />
        <Route path="/report" component={() => <RequireAuth><ComplianceReport /></RequireAuth>} />
        <Route path="/gap-analysis" component={() => <RequireAuth><AppShell><GapAnalysis /></AppShell></RequireAuth>} />
        <Route path="/remediation" component={() => <RequireAuth><AppShell><Remediation /></AppShell></RequireAuth>} />
        <Route path="/test-runs" component={() => <RequireAuth><AppShell><TestRunHistory /></AppShell></RequireAuth>} />
        <Route path="/assets" component={() => <RequireAuth><AppShell><AssetInventory /></AppShell></RequireAuth>} />
        <Route path="/docs" component={() => <RequireAuth><AppShell><Documentation /></AppShell></RequireAuth>} />
        <Route path="/zero-trust" component={() => <RequireAuth><AppShell><ZeroTrustAssessment /></AppShell></RequireAuth>} />
        <Route path="/system-boundary" component={() => <RequireAuth><AppShell><SystemBoundary /></AppShell></RequireAuth>} />
        <Route path="/control-crosswalk" component={() => <RequireAuth><AppShell><ControlCrosswalk /></AppShell></RequireAuth>} />
        <Route path="/vuln-management" component={() => <RequireAuth><AppShell><VulnManagement /></AppShell></RequireAuth>} />
        <Route path="/nist-800-171" component={() => <RequireAuth><AppShell><NIST800171 /></AppShell></RequireAuth>} />
        <Route path="/conmon" component={() => <RequireAuth><AppShell><ConMonProgram /></AppShell></RequireAuth>} />
        <Route path="/fisma-reporting" component={() => <RequireAuth><AppShell><FISMAReporting /></AppShell></RequireAuth>} />
        <Route path="/super-admin" component={() => <RequireAuth><AppShell><SuperAdmin /></AppShell></RequireAuth>} />
        <Route path="/role-management" component={() => <RequireAuth><AppShell><RoleManagement /></AppShell></RequireAuth>} />
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

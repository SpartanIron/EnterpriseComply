import { ClerkProvider, SignIn, SignUp, useAuth } from "@clerk/react";
import { Switch, Route, useLocation, Router as WouterRouter } from "wouter";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { useEffect } from "react";
import AppShell from "./components/layout/AppShell";
import Landing from "./pages/Landing";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
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

const BASE_PATH = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

const clerkAppearance = {
  variables: {
    colorPrimary: "#2563eb",
    colorText: "#0f172a",
    colorBackground: "#ffffff",
    colorInputBackground: "#f8fafc",
    colorInputText: "#0f172a",
    borderRadius: "8px",
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
  },
  elements: {
    card: "shadow-lg border border-slate-200",
    headerTitle: "text-slate-900 font-semibold",
    formButtonPrimary: "bg-blue-600 hover:bg-blue-700 text-white",
    footerActionLink: "text-blue-600 hover:text-blue-700",
    logoBox: "flex items-center justify-center",
  },
};

function HomeRedirect() {
  const { isSignedIn, isLoaded } = useAuth();
  const [, navigate] = useLocation();
  const { data, isLoading } = useQuery<{ org: any | null }>({
    queryKey: ["orgs", "me"],
    queryFn: async () => {
      const res = await fetch(`/api/orgs/me`, { credentials: "include" });
      return res.json();
    },
    enabled: !!isSignedIn && isLoaded,
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

function AppRoutes() {
  return (
    <Switch>
      <Route path="/" component={HomeRedirect} />
      <Route path="/sign-in/*?" component={() => (
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <SignIn routing="path" path={`${BASE_PATH}/sign-in`} signUpUrl={`${BASE_PATH}/sign-up`} forceRedirectUrl={`${BASE_PATH}/`} appearance={clerkAppearance} />
        </div>
      )} />
      <Route path="/sign-up/*?" component={() => (
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <SignUp routing="path" path={`${BASE_PATH}/sign-up`} signInUrl={`${BASE_PATH}/sign-in`} forceRedirectUrl={`${BASE_PATH}/`} appearance={clerkAppearance} />
        </div>
      )} />
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
      {/* Core */}
      <Route path="/dashboard" component={() => <AppShell><Dashboard /></AppShell>} />
      <Route path="/frameworks" component={() => <AppShell><Frameworks /></AppShell>} />
      <Route path="/controls" component={() => <AppShell><Controls /></AppShell>} />
      {/* Evidence */}
      <Route path="/integrations" component={() => <AppShell><Integrations /></AppShell>} />
      <Route path="/evidence" component={() => <AppShell><Evidence /></AppShell>} />
      <Route path="/monitoring" component={() => <AppShell><Monitoring /></AppShell>} />
      {/* Workforce */}
      <Route path="/policies" component={() => <AppShell><Policies /></AppShell>} />
      <Route path="/people" component={() => <AppShell><People /></AppShell>} />
      <Route path="/access-reviews" component={() => <AppShell><AccessReviews /></AppShell>} />
      <Route path="/vendors" component={() => <AppShell><Vendors /></AppShell>} />
      {/* Risk & Compliance */}
      <Route path="/risks" component={() => <AppShell><RiskRegister /></AppShell>} />
      <Route path="/questionnaires" component={() => <AppShell><Questionnaires /></AppShell>} />
      <Route path="/audits" component={() => <AppShell><Audits /></AppShell>} />
      <Route path="/trust-center" component={() => <AppShell><TrustCenter /></AppShell>} />
      <Route path="/custom-frameworks" component={() => <AppShell><CustomFrameworks /></AppShell>} />
      {/* Client Assessments — Sprint 3 */}
      <Route path="/assessments" component={() => <AppShell><Assessments /></AppShell>} />
      <Route path="/assessments/:id/report" component={() => <ZeroTrustAssessmentReport />} />
      {/* Federal */}
      <Route path="/poam" component={() => <AppShell><POAM /></AppShell>} />
      <Route path="/sprs" component={() => <AppShell><SPRS /></AppShell>} />
      <Route path="/ssp" component={() => <AppShell><SSP /></AppShell>} />
      <Route path="/stigs" component={() => <AppShell><Stigs /></AppShell>} />
      {/* Settings */}
      <Route path="/settings" component={() => <AppShell><Settings /></AppShell>} />
      <Route path="/audit-log" component={() => <AppShell><AuditLog /></AppShell>} />
      <Route path="/report" component={ComplianceReport} />
      <Route path="/gap-analysis" component={() => <AppShell><GapAnalysis /></AppShell>} />
      <Route path="/remediation" component={() => <AppShell><Remediation /></AppShell>} />
      <Route path="/test-runs" component={() => <AppShell><TestRunHistory /></AppShell>} />
        <Route path="/assets" component={() => <AppShell><AssetInventory /></AppShell>} />
        <Route path="/docs" component={() => <AppShell><Documentation /></AppShell>} />
      <Route path="/zero-trust" component={() => <AppShell><ZeroTrustAssessment /></AppShell>} />
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  if (!PUBLISHABLE_KEY) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <p className="text-red-500">Missing VITE_CLERK_PUBLISHABLE_KEY environment variable</p>
      </div>
    );
  }
  return (
    <ClerkProvider publishableKey={PUBLISHABLE_KEY} appearance={clerkAppearance}>
      <QueryClientProvider client={queryClient}>
        <WouterRouter base={BASE_PATH}>
          <AppRoutes />
        </WouterRouter>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

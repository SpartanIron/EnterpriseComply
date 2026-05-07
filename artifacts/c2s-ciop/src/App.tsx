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
import AccessReviews from "./pages/AccessReviews";
import CustomFrameworks from "./pages/CustomFrameworks";
import TrustCenter from "./pages/TrustCenter";
import AuditLog from "./pages/AuditLog";
import ComplianceReport from "./pages/ComplianceReport";
import NotFound from "./pages/not-found";

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
      const res = await fetch(`${BASE_PATH}/api/orgs/me`, { credentials: "include" });
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

      {/* Federal */}
      <Route path="/poam" component={() => <AppShell><POAM /></AppShell>} />
      <Route path="/sprs" component={() => <AppShell><SPRS /></AppShell>} />
      <Route path="/ssp" component={() => <AppShell><SSP /></AppShell>} />

      {/* Settings */}
      <Route path="/settings" component={() => <AppShell><Settings /></AppShell>} />
      <Route path="/audit-log" component={() => <AppShell><AuditLog /></AppShell>} />

      <Route path="/report" component={ComplianceReport} />
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

  const isProd = import.meta.env.PROD;

  return (
    <ClerkProvider
      publishableKey={PUBLISHABLE_KEY}
      {...(isProd ? { proxyUrl: `${BASE_PATH}/api/__clerk` } : {})}
      appearance={clerkAppearance}
    >
      <QueryClientProvider client={queryClient}>
        <WouterRouter base={BASE_PATH}>
          <AppRoutes />
        </WouterRouter>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

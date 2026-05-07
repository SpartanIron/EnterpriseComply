import { useLocation } from "wouter";
import { Bell, User, Activity, ChevronRight } from "lucide-react";

const pageMeta: Record<string, { title: string; crumb: string; sub: string }> = {
  "/": { title: "Dashboard", crumb: "Dashboard", sub: "Live compliance posture" },
  "/controls": { title: "Controls", crumb: "Controls", sub: "Universal Control Objectives: continuous assessment" },
  "/frameworks": { title: "Frameworks", crumb: "Frameworks", sub: "Multi-framework compliance mapping" },
  "/integrations": { title: "Integrations", crumb: "Integrations", sub: "Connected data sources and evidence collectors" },
  "/evidence": { title: "Evidence Vault", crumb: "Evidence", sub: "Collected and manual compliance evidence" },
  "/policies": { title: "Policies", crumb: "Policies", sub: "Policy library and publication status" },
  "/people": { title: "People", crumb: "People", sub: "Workforce compliance: MFA, training, and access reviews" },
  "/vendors": { title: "Vendors", crumb: "Vendors", sub: "Third-party vendor risk management" },
  "/poam": { title: "Plan of Action & Milestones", crumb: "POA&M", sub: "FedRAMP-compliant weakness tracking and milestone management" },
  "/settings": { title: "Settings", crumb: "Settings", sub: "Organization settings and plan management" },
};

export function Header() {
  const [location] = useLocation();
  const page = pageMeta[location] ?? { title: "EnterpriseComply", crumb: "Home", sub: "Compliance automation platform" };
  const now = new Date();

  return (
    <header className="h-14 border-b border-border bg-card flex items-center px-5 gap-4 sticky top-0 z-20 shadow-2xs">
      <div className="flex-1 overflow-hidden">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-0.5">
          <span>EnterpriseComply</span>
          <ChevronRight className="w-3 h-3" />
          <span className="text-foreground font-medium">{page.crumb}</span>
        </div>
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold text-foreground whitespace-nowrap">{page.title}</h1>
          <span className="hidden md:block text-xs text-muted-foreground truncate">{page.sub}</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="hidden md:flex items-center gap-1.5 bg-green-50 border border-green-200 text-green-700 rounded-md px-2.5 py-1 mr-1">
          <Activity className="w-3 h-3" />
          <span className="text-[11px] font-semibold">Live</span>
          <span className="text-[11px] font-mono text-green-600">
            {now.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>

        <button data-testid="header-alerts" className="p-2 rounded-md hover:bg-muted transition-colors relative text-muted-foreground hover:text-foreground">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full ring-1 ring-white" />
        </button>

        <button data-testid="header-user" className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-border hover:bg-muted transition-colors text-sm font-medium text-foreground">
          <User className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="hidden md:block">Account</span>
        </button>
      </div>
    </header>
  );
}

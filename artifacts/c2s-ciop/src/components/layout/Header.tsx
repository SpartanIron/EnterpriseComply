import { useLocation } from "wouter";
import { Bell, User, Activity, ChevronRight } from "lucide-react";

const pageMeta: Record<string, { title: string; crumb: string; sub: string }> = {
  "/": { title: "Dashboard", crumb: "Command", sub: "Executive cyber posture — real-time" },
  "/controls": { title: "Control Validation", crumb: "Controls", sub: "Universal Control Ontology — continuous assessment" },
  "/risks": { title: "Risk & Attack Paths", crumb: "Risk", sub: "Exposure-centric risk intelligence" },
  "/frameworks": { title: "Compliance Frameworks", crumb: "Frameworks", sub: "Multi-framework compliance mapping" },
  "/assets": { title: "Asset Intelligence", crumb: "Assets", sub: "Asset discovery & risk classification" },
  "/findings": { title: "Security Findings", crumb: "Findings", sub: "Alert feed — prioritized by impact" },
  "/telemetry": { title: "Telemetry & Evidence", crumb: "Telemetry", sub: "Ingestion fabric — live data sources" },
  "/graph": { title: "Cyber Graph", crumb: "Graph", sub: "Attack path & relationship visualization" },
  "/gap-analysis": { title: "Gap Analysis", crumb: "Achievement", sub: "Control coverage — one UCO control, all framework outputs" },
  "/poam": { title: "Plan of Action & Milestones", crumb: "POA&M", sub: "FedRAMP-compliant weakness tracking and milestone management" },
  "/journey": { title: "Compliance Journey", crumb: "Journey", sub: "Framework authorization — Scope → Gap → Roadmap → ATO" },
  "/brief": { title: "Executive Intelligence Brief", crumb: "Intel", sub: "AI-derived situational analysis — board-ready risk narrative" },
};

export function Header() {
  const [location] = useLocation();
  const page = pageMeta[location] ?? { title: "C2S-CIOP", crumb: "Home", sub: "Cyber Assurance Operating System" };
  const now = new Date();

  return (
    <header className="h-14 border-b border-border bg-card flex items-center px-5 gap-4 sticky top-0 z-20 shadow-2xs">
      {/* Breadcrumb + title */}
      <div className="flex-1 overflow-hidden">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-0.5">
          <span>C2S-CIOP</span>
          <ChevronRight className="w-3 h-3" />
          <span className="text-foreground font-medium">{page.crumb}</span>
        </div>
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold text-foreground whitespace-nowrap">{page.title}</h1>
          <span className="hidden md:block text-xs text-muted-foreground truncate">{page.sub}</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Live indicator */}
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
          <span className="hidden md:block">CISO</span>
        </button>
      </div>
    </header>
  );
}

import { useLocation } from "wouter";
import { Bell, User, Activity } from "lucide-react";

const pageTitles: Record<string, { title: string; sub: string }> = {
  "/": { title: "COMMAND DASHBOARD", sub: "Executive Cyber Posture — Real-Time" },
  "/controls": { title: "CONTROL VALIDATION", sub: "Universal Control Ontology — Continuous Assessment" },
  "/risks": { title: "RISK & ATTACK PATHS", sub: "Exposure-Centric Risk Intelligence" },
  "/frameworks": { title: "COMPLIANCE FRAMEWORKS", sub: "Framework Mapping Engine — Multi-Framework" },
  "/assets": { title: "ASSET INTELLIGENCE", sub: "Asset Discovery & Risk Classification" },
  "/findings": { title: "SECURITY FINDINGS", sub: "Alert Feed — Prioritized by Impact" },
  "/telemetry": { title: "TELEMETRY & EVIDENCE", sub: "Ingestion Fabric — Live Data Sources" },
  "/graph": { title: "CYBER GRAPH INTELLIGENCE", sub: "Attack Path & Relationship Visualization" },
};

export function Header() {
  const [location] = useLocation();
  const page = pageTitles[location] ?? { title: "C2S-CIOP", sub: "Cyber Assurance Operating System" };
  const now = new Date();

  return (
    <header className="h-14 border-b border-border bg-background flex items-center px-4 gap-4 sticky top-0 z-20">
      <div className="flex-1 overflow-hidden">
        <div className="flex items-baseline gap-3">
          <h1 className="text-[11px] font-mono font-bold tracking-widest uppercase text-foreground whitespace-nowrap">{page.title}</h1>
          <span className="hidden sm:block text-[10px] font-mono text-muted-foreground tracking-wider truncate">{page.sub}</span>
        </div>
      </div>

      <div className="flex items-center gap-1">
        {/* Live indicator */}
        <div className="hidden md:flex items-center gap-1.5 border border-border px-2 py-1 mr-2">
          <Activity className="w-3 h-3 text-green-500" />
          <span className="text-[10px] font-mono text-green-500 uppercase tracking-widest">Live</span>
          <span className="text-[10px] font-mono text-muted-foreground">
            {now.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>

        <button data-testid="header-alerts" className="p-2 border border-border hover:bg-muted transition-colors relative">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-red-500 rounded-full" />
        </button>

        <button data-testid="header-user" className="flex items-center gap-2 p-2 border border-border hover:bg-muted transition-colors">
          <User className="w-4 h-4" />
          <span className="hidden md:block text-[10px] font-mono uppercase tracking-wider">CISO</span>
        </button>
      </div>
    </header>
  );
}

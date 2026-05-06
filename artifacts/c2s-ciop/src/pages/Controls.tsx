import { useState } from "react";
import { useListControls, useGetControlsSummary } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { CheckCircle, AlertCircle, XCircle, HelpCircle, Zap, GitBranch, AlertTriangle } from "lucide-react";

const STATUS_ICONS: Record<string, React.ReactNode> = {
  effective: <CheckCircle className="w-3 h-3 text-green-500" />,
  degraded: <AlertCircle className="w-3 h-3 text-amber-500" />,
  failed: <XCircle className="w-3 h-3 text-red-500" />,
  unknown: <HelpCircle className="w-3 h-3 text-muted-foreground" />,
  inherited: <GitBranch className="w-3 h-3 text-blue-400" />,
  compensating: <Zap className="w-3 h-3 text-purple-400" />,
};

const STATUS_COLORS: Record<string, string> = {
  effective: "text-green-500",
  degraded: "text-amber-500",
  failed: "text-red-500",
  unknown: "text-muted-foreground",
  inherited: "text-blue-400",
  compensating: "text-purple-400",
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: "text-red-500 bg-red-500/5 border-red-500/30",
  high: "text-amber-500 bg-amber-500/5 border-amber-500/30",
  medium: "text-yellow-500 bg-yellow-500/5 border-yellow-500/30",
  low: "text-blue-400 bg-blue-400/5 border-blue-400/30",
};

const AUTO_COLORS: Record<string, string> = {
  full: "text-green-500",
  partial: "text-amber-500",
  manual: "text-muted-foreground",
};

const STATUSES = ["", "effective", "degraded", "failed", "unknown", "inherited", "compensating"];

export default function Controls() {
  const [filterStatus, setFilterStatus] = useState("");
  const summary = useGetControlsSummary();
  const list = useListControls(filterStatus ? { status: filterStatus as any } : {});
  const s = summary.data;

  return (
    <div data-testid="controls-page">
      {/* Summary strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-px bg-border mb-px">
        {[
          { label: "Effective", value: s?.effective ?? 0, color: "text-green-500" },
          { label: "Degraded", value: s?.degraded ?? 0, color: "text-amber-500" },
          { label: "Failed", value: s?.failed ?? 0, color: "text-red-500" },
          { label: "Unknown", value: s?.unknown ?? 0, color: "text-muted-foreground" },
          { label: "Inherited", value: s?.inherited ?? 0, color: "text-blue-400" },
          { label: "Compensating", value: s?.compensating ?? 0, color: "text-purple-400" },
          { label: "Drift Detected", value: s?.driftCount ?? 0, color: "text-orange-500" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-background p-3">
            <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground">{label}</div>
            <div className={cn("text-2xl font-mono font-bold mt-1", color)}>{summary.isLoading ? <Skeleton className="h-7 w-8" /> : value}</div>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="bg-background border-b border-border flex items-center gap-0 mb-px overflow-x-auto" data-testid="filter-bar">
        {STATUSES.map((s) => (
          <button
            key={s || "all"}
            data-testid={`filter-${s || "all"}`}
            onClick={() => setFilterStatus(s)}
            className={cn(
              "px-4 py-2 text-[10px] font-mono uppercase tracking-widest whitespace-nowrap border-r border-border transition-colors",
              filterStatus === s ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            {s || "All Controls"}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-background overflow-x-auto">
        {list.isLoading ? (
          <div className="p-4 space-y-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : (
          <table className="w-full text-[10px] font-mono">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {["ID", "Control Name", "Status", "Effectiveness", "Severity", "Frameworks", "Automation", "Maturity", "Drift", "Evidence"].map((h) => (
                  <th key={h} className="text-left text-muted-foreground uppercase tracking-widest py-2.5 px-3 font-normal whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(list.data?.controls ?? []).map((c) => (
                <tr key={c.id} className="border-b border-border/40 hover:bg-muted/20 transition-colors" data-testid={`control-row-${c.id}`}>
                  <td className="py-2.5 px-3 font-bold text-muted-foreground whitespace-nowrap">{c.controlId}</td>
                  <td className="py-2.5 px-3">
                    <div className="text-foreground max-w-[200px] truncate">{c.name}</div>
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-1.5">
                      {STATUS_ICONS[c.status]}
                      <span className={cn("uppercase tracking-wider", STATUS_COLORS[c.status])}>{c.status}</span>
                    </div>
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1 bg-muted">
                        <div
                          className={cn("h-full", c.effectiveness >= 80 ? "bg-green-500" : c.effectiveness >= 60 ? "bg-amber-500" : "bg-red-500")}
                          style={{ width: `${c.effectiveness}%` }}
                        />
                      </div>
                      <span className={cn("font-bold", c.effectiveness >= 80 ? "text-green-500" : c.effectiveness >= 60 ? "text-amber-500" : "text-red-500")}>
                        {c.effectiveness.toFixed(0)}%
                      </span>
                    </div>
                  </td>
                  <td className="py-2.5 px-3">
                    <span className={cn("border px-1.5 py-0.5 text-[9px] uppercase tracking-widest", SEVERITY_COLORS[c.severity] ?? "")}>
                      {c.severity}
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="flex flex-wrap gap-1 max-w-[160px]">
                      {c.frameworks.slice(0, 3).map((f) => (
                        <span key={f} className="border border-border px-1 py-0.5 text-[8px] uppercase tracking-wider text-muted-foreground whitespace-nowrap">{f}</span>
                      ))}
                      {c.frameworks.length > 3 && <span className="text-muted-foreground">+{c.frameworks.length - 3}</span>}
                    </div>
                  </td>
                  <td className="py-2.5 px-3">
                    <span className={cn("uppercase tracking-wider", AUTO_COLORS[c.automationCapability])}>{c.automationCapability}</span>
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="flex gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className={cn("w-2 h-2", i < c.maturityLevel ? "bg-foreground" : "bg-muted")} />
                      ))}
                    </div>
                  </td>
                  <td className="py-2.5 px-3">
                    {c.driftDetected ? (
                      <div className="flex items-center gap-1 text-orange-500">
                        <AlertTriangle className="w-3 h-3" />
                        <span>Drift</span>
                      </div>
                    ) : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="py-2.5 px-3">
                    <span className={c.evidenceFresh ? "text-green-500" : "text-red-500"}>{c.evidenceFresh ? "Fresh" : "Stale"}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

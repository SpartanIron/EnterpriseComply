import { useState } from "react";
import { useListControls, useGetControlsSummary } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { CheckCircle, AlertCircle, XCircle, HelpCircle, GitBranch, Zap, AlertTriangle } from "lucide-react";

const STATUS_ICONS: Record<string, React.ReactNode> = {
  effective:    <CheckCircle className="w-3.5 h-3.5 text-green-600" />,
  degraded:     <AlertCircle className="w-3.5 h-3.5 text-amber-600" />,
  failed:       <XCircle className="w-3.5 h-3.5 text-red-600" />,
  unknown:      <HelpCircle className="w-3.5 h-3.5 text-slate-400" />,
  inherited:    <GitBranch className="w-3.5 h-3.5 text-blue-500" />,
  compensating: <Zap className="w-3.5 h-3.5 text-purple-600" />,
};

const STATUS_BADGE: Record<string, string> = {
  effective:    "bg-green-100 text-green-700 ring-1 ring-inset ring-green-200",
  degraded:     "bg-amber-100 text-amber-700 ring-1 ring-inset ring-amber-200",
  failed:       "bg-red-100 text-red-700 ring-1 ring-inset ring-red-200",
  unknown:      "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200",
  inherited:    "bg-blue-100 text-blue-700 ring-1 ring-inset ring-blue-200",
  compensating: "bg-purple-100 text-purple-700 ring-1 ring-inset ring-purple-200",
};

const SEV_BADGE: Record<string, string> = {
  critical: "bg-red-100 text-red-700 ring-1 ring-inset ring-red-200",
  high:     "bg-amber-100 text-amber-700 ring-1 ring-inset ring-amber-200",
  medium:   "bg-yellow-100 text-yellow-700 ring-1 ring-inset ring-yellow-200",
  low:      "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200",
};

// Left-border accent colors by severity
const SEV_ACCENT: Record<string, string> = {
  critical: "#ef4444",
  high:     "#f59e0b",
  medium:   "#eab308",
  low:      "#cbd5e1",
};

const AUTO_COLORS: Record<string, string> = {
  full:    "text-green-600 font-semibold",
  partial: "text-amber-600 font-semibold",
  manual:  "text-slate-500",
};

const STATUSES = ["", "effective", "degraded", "failed", "unknown", "inherited", "compensating"];

function SummaryTile({ label, value, color, loading }: { label: string; value: number; color: string; loading: boolean }) {
  return (
    <div className="bg-card border border-border rounded-lg p-4 shadow-xs">
      <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">{label}</div>
      {loading ? <Skeleton className="h-8 w-10" /> : <div className={cn("text-3xl font-mono font-bold", color)}>{value}</div>}
    </div>
  );
}

export default function Controls() {
  const [filterStatus, setFilterStatus] = useState("");
  const summary = useGetControlsSummary();
  const list = useListControls(filterStatus ? { status: filterStatus as any } : {});
  const s = summary.data;

  return (
    <div data-testid="controls-page" className="space-y-4">
      <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {[
          { label: "Effective",      value: s?.effective ?? 0,   color: "text-green-600" },
          { label: "Degraded",       value: s?.degraded ?? 0,    color: "text-amber-600" },
          { label: "Failed",         value: s?.failed ?? 0,      color: "text-red-600" },
          { label: "Unknown",        value: s?.unknown ?? 0,     color: "text-slate-500" },
          { label: "Inherited",      value: s?.inherited ?? 0,   color: "text-blue-600" },
          { label: "Compensating",   value: s?.compensating ?? 0, color: "text-purple-600" },
          { label: "Drift Detected", value: s?.driftCount ?? 0,  color: "text-orange-600" },
        ].map((t) => <SummaryTile key={t.label} {...t} loading={summary.isLoading} />)}
      </div>

      <div className="bg-card border border-border rounded-lg shadow-xs overflow-hidden">
        {/* Filter tabs */}
        <div className="flex items-center border-b border-border overflow-x-auto" data-testid="filter-bar">
          {STATUSES.map((s) => (
            <button
              key={s || "all"}
              data-testid={`filter-${s || "all"}`}
              onClick={() => setFilterStatus(s)}
              className={cn(
                "px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide whitespace-nowrap border-r border-border transition-colors",
                filterStatus === s ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >{s || "All Controls"}</button>
          ))}
        </div>

        <div className="overflow-x-auto">
          {list.isLoading ? (
            <div className="p-5 space-y-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/40 border-b border-border">
                  <th className="w-[3px] p-0" aria-hidden />
                  {["ID", "Control Name", "Status", "Effectiveness", "Severity", "Frameworks", "Automation", "Maturity", "Drift", "Evidence"].map((h) => (
                    <th key={h} className="text-left text-muted-foreground font-bold uppercase tracking-wide py-2.5 px-4 whitespace-nowrap text-[10px]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(list.data?.controls ?? []).map((c) => (
                  <tr key={c.id} className="hover:bg-muted/20 transition-colors" data-testid={`control-row-${c.id}`}>
                    <td className="p-0 w-[3px]" style={{ backgroundColor: SEV_ACCENT[c.severity] ?? "#cbd5e1" }} aria-hidden />
                    <td className="py-3 px-4">
                      <span className="font-mono font-semibold text-[11px] text-muted-foreground">{c.controlId}</span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-foreground max-w-[180px] truncate">{c.name}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        {STATUS_ICONS[c.status]}
                        <span className={cn("inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide", STATUS_BADGE[c.status] ?? "")}>
                          {c.status}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-14 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className={cn("h-full rounded-full", c.effectiveness >= 80 ? "bg-green-500" : c.effectiveness >= 60 ? "bg-amber-500" : "bg-red-500")}
                            style={{ width: `${c.effectiveness}%` }} />
                        </div>
                        <span className={cn("font-mono font-bold text-xs", c.effectiveness >= 80 ? "text-green-600" : c.effectiveness >= 60 ? "text-amber-600" : "text-red-600")}>
                          {c.effectiveness.toFixed(0)}%
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className={cn("inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide", SEV_BADGE[c.severity] ?? "")}>
                        {c.severity}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1 max-w-[160px]">
                        {c.frameworks.slice(0, 3).map((f) => (
                          <span key={f} className="rounded bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide whitespace-nowrap">{f}</span>
                        ))}
                        {c.frameworks.length > 3 && <span className="text-[10px] text-muted-foreground font-semibold">+{c.frameworks.length - 3}</span>}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className={cn("text-[11px]", AUTO_COLORS[c.automationCapability])}>{c.automationCapability}</span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex gap-0.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <div key={i} className={cn("w-2 h-2 rounded-sm", i < c.maturityLevel ? "bg-blue-500" : "bg-slate-200")} />
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {c.driftDetected
                        ? <div className="flex items-center gap-1 text-orange-600 font-semibold text-[11px]"><AlertTriangle className="w-3 h-3" />Drift</div>
                        : <span className="text-muted-foreground text-sm">—</span>}
                    </td>
                    <td className="py-3 px-4">
                      <span className={cn("text-[11px] font-bold", c.evidenceFresh ? "text-green-600" : "text-red-600")}>
                        {c.evidenceFresh ? "Fresh" : "Stale"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

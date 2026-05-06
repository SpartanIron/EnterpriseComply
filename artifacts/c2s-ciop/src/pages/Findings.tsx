import { useState } from "react";
import { useListFindings } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { AlertTriangle } from "lucide-react";

const SEV_BADGE: Record<string, string> = {
  critical: "bg-red-100 text-red-700 ring-1 ring-inset ring-red-200",
  high:     "bg-amber-100 text-amber-700 ring-1 ring-inset ring-amber-200",
  medium:   "bg-yellow-100 text-yellow-700 ring-1 ring-inset ring-yellow-200",
  low:      "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200",
  info:     "bg-slate-100 text-slate-500 ring-1 ring-inset ring-slate-200",
};

const STATUS_BADGE: Record<string, string> = {
  open:        "bg-red-100 text-red-700 ring-1 ring-inset ring-red-200",
  in_progress: "bg-blue-100 text-blue-700 ring-1 ring-inset ring-blue-200",
  resolved:    "bg-green-100 text-green-700 ring-1 ring-inset ring-green-200",
  accepted:    "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200",
};

const SEV_ACCENT: Record<string, string> = {
  critical: "#ef4444",
  high:     "#f59e0b",
  medium:   "#eab308",
  low:      "#cbd5e1",
  info:     "#94a3b8",
};

const SEVERITIES = ["", "critical", "high", "medium", "low"];
const STATUSES   = ["", "open", "in_progress", "resolved", "accepted"];

export default function Findings() {
  const [filterStatus,   setFilterStatus]   = useState("");
  const [filterSeverity, setFilterSeverity] = useState("");

  const findings = useListFindings({
    ...(filterStatus   ? { status:   filterStatus   as any } : {}),
    ...(filterSeverity ? { severity: filterSeverity as any } : {}),
  });

  return (
    <div data-testid="findings-page" className="space-y-4">
      <div className="bg-card border border-border rounded-lg shadow-xs overflow-hidden">
        {/* Dual filter bar */}
        <div className="flex items-stretch border-b border-border overflow-x-auto" data-testid="findings-severity-filter">
          <div className="flex items-center px-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest border-r border-border shrink-0 bg-muted/30">Severity</div>
          {SEVERITIES.map((s) => (
            <button key={s || "all-sev"} data-testid={`sev-filter-${s || "all"}`}
              onClick={() => setFilterSeverity(s)}
              className={cn(
                "px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide whitespace-nowrap border-r border-border transition-colors",
                filterSeverity === s ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >{s || "All"}</button>
          ))}
          <div className="flex items-center px-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest border-r border-border shrink-0 bg-muted/30 ml-0">Status</div>
          {STATUSES.map((s) => (
            <button key={s || "all-stat"} data-testid={`stat-filter-${s || "all"}`}
              onClick={() => setFilterStatus(s)}
              className={cn(
                "px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide whitespace-nowrap border-r border-border transition-colors",
                filterStatus === s ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >{s ? s.replace("_", " ") : "All"}</button>
          ))}
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          {findings.isLoading ? (
            <div className="p-5 space-y-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/40 border-b border-border">
                  <th className="w-[3px] p-0" aria-hidden />
                  {["Severity", "Finding", "CVE", "Asset", "Source", "Control", "SLA", "Days Open", "Status"].map((h) => (
                    <th key={h} className="text-left text-muted-foreground font-bold uppercase tracking-wide py-2.5 px-4 whitespace-nowrap text-[10px]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(findings.data?.findings ?? []).map((f) => {
                  const slaBreached = f.daysOpen > (f.remediationSla ?? 999);
                  return (
                    <tr key={f.id}
                      className={cn("hover:bg-muted/20 transition-colors", slaBreached && "bg-red-50/50")}
                      data-testid={`finding-${f.id}`}
                    >
                      {/* Left-border accent */}
                      <td className="p-0 w-[3px]" style={{ backgroundColor: SEV_ACCENT[f.severity] ?? "#94a3b8" }} aria-hidden />
                      <td className="py-3 px-4">
                        <span className={cn("inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide", SEV_BADGE[f.severity] ?? "")}>
                          {f.severity}
                        </span>
                      </td>
                      <td className="py-3 px-4 max-w-[220px]">
                        <div className="font-semibold text-foreground truncate">{f.title}</div>
                        <div className="text-muted-foreground text-[10px] truncate mt-0.5">{f.description}</div>
                      </td>
                      <td className="py-3 px-4">
                        {f.cveId
                          ? <span className="font-mono text-[10px] font-bold text-blue-600 bg-blue-50 ring-1 ring-inset ring-blue-200 rounded px-1.5 py-0.5">{f.cveId}</span>
                          : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="py-3 px-4 font-mono text-[10px] text-muted-foreground max-w-[120px] truncate">{f.affectedAsset}</td>
                      <td className="py-3 px-4 text-muted-foreground font-medium">{f.source}</td>
                      <td className="py-3 px-4">
                        {f.controlId
                          ? <span className="font-mono text-[10px] font-semibold text-muted-foreground">{f.controlId}</span>
                          : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="py-3 px-4 font-mono text-muted-foreground">{f.remediationSla ? `${f.remediationSla}d` : "—"}</td>
                      <td className="py-3 px-4">
                        <div className={cn("flex items-center gap-1 font-mono font-bold text-sm", slaBreached ? "text-red-600" : f.daysOpen > 7 ? "text-amber-600" : "text-foreground")}>
                          {slaBreached && <AlertTriangle className="w-3 h-3 shrink-0" />}
                          {f.daysOpen}d
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={cn("inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide", STATUS_BADGE[f.status] ?? "")}>
                          {f.status.replace("_", " ")}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {findings.data?.total === 0 && (
            <div className="p-12 text-center text-sm text-muted-foreground">No findings match the current filters.</div>
          )}
        </div>
      </div>
    </div>
  );
}

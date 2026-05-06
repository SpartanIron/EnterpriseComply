import { useState } from "react";
import { useListFindings, useGetRecentFindings } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Clock, AlertTriangle } from "lucide-react";

const SEV_COLORS: Record<string, string> = {
  critical: "text-red-500 border-red-500/40 bg-red-500/5",
  high: "text-amber-500 border-amber-500/40 bg-amber-500/5",
  medium: "text-yellow-500 border-yellow-500/40 bg-yellow-500/5",
  low: "text-blue-400 border-blue-400/40 bg-blue-400/5",
  info: "text-muted-foreground border-border",
};

const STATUS_COLORS: Record<string, string> = {
  open: "text-red-500",
  in_progress: "text-amber-500",
  resolved: "text-green-500",
  accepted: "text-muted-foreground",
};

const STATUSES = ["", "open", "in_progress", "resolved", "accepted"];
const SEVERITIES = ["", "critical", "high", "medium", "low"];

export default function Findings() {
  const [filterStatus, setFilterStatus] = useState("");
  const [filterSeverity, setFilterSeverity] = useState("");
  const findings = useListFindings({
    ...(filterStatus ? { status: filterStatus as any } : {}),
    ...(filterSeverity ? { severity: filterSeverity as any } : {}),
  });

  return (
    <div data-testid="findings-page">
      {/* Filter bars */}
      <div className="bg-background border-b border-border flex items-center overflow-x-auto" data-testid="findings-severity-filter">
        {SEVERITIES.map((s) => (
          <button
            key={s || "all-sev"}
            data-testid={`sev-filter-${s || "all"}`}
            onClick={() => setFilterSeverity(s)}
            className={cn(
              "px-4 py-2 text-[10px] font-mono uppercase tracking-widest whitespace-nowrap border-r border-border transition-colors",
              filterSeverity === s ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            {s || "All Severities"}
          </button>
        ))}
        <div className="w-px h-6 bg-border mx-2" />
        {STATUSES.map((s) => (
          <button
            key={s || "all-stat"}
            data-testid={`stat-filter-${s || "all"}`}
            onClick={() => setFilterStatus(s)}
            className={cn(
              "px-4 py-2 text-[10px] font-mono uppercase tracking-widest whitespace-nowrap border-r border-border transition-colors",
              filterStatus === s ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            {s ? s.replace("_", " ") : "All Status"}
          </button>
        ))}
      </div>

      {/* Findings list */}
      <div className="bg-background overflow-x-auto">
        {findings.isLoading ? (
          <div className="p-4 space-y-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
        ) : (
          <table className="w-full text-[10px] font-mono">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {["Severity", "Finding", "CVE", "Asset", "Source", "Control", "SLA", "Days Open", "Status"].map((h) => (
                  <th key={h} className="text-left text-muted-foreground uppercase tracking-widest py-2.5 px-3 font-normal whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(findings.data?.findings ?? []).map((f) => {
                const slaBreached = f.daysOpen > (f.remediationSla ?? 99);
                return (
                  <tr key={f.id} className="border-b border-border/40 hover:bg-muted/20 transition-colors" data-testid={`finding-${f.id}`}>
                    <td className="py-2.5 px-3">
                      <span className={cn("border text-[9px] uppercase tracking-widest px-1.5 py-0.5", SEV_COLORS[f.severity] ?? "")}>{f.severity}</span>
                    </td>
                    <td className="py-2.5 px-3 max-w-[220px]">
                      <div className="text-foreground font-bold truncate">{f.title}</div>
                      <div className="text-muted-foreground text-[9px] truncate mt-0.5">{f.description}</div>
                    </td>
                    <td className="py-2.5 px-3 text-muted-foreground">{f.cveId ?? "—"}</td>
                    <td className="py-2.5 px-3 text-muted-foreground max-w-[120px] truncate">{f.affectedAsset}</td>
                    <td className="py-2.5 px-3 text-muted-foreground whitespace-nowrap">{f.source}</td>
                    <td className="py-2.5 px-3 text-muted-foreground">{f.controlId ?? "—"}</td>
                    <td className="py-2.5 px-3 text-muted-foreground">{f.remediationSla ? `${f.remediationSla}d` : "—"}</td>
                    <td className="py-2.5 px-3">
                      <div className={cn("flex items-center gap-1 font-bold", slaBreached ? "text-red-500" : f.daysOpen > 7 ? "text-amber-500" : "text-foreground")}>
                        {slaBreached && <AlertTriangle className="w-3 h-3" />}
                        {f.daysOpen}d
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={cn("uppercase tracking-wider", STATUS_COLORS[f.status] ?? "text-muted-foreground")}>
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
          <div className="p-8 text-center text-[10px] font-mono text-muted-foreground uppercase tracking-widest">No findings matching current filters</div>
        )}
      </div>
    </div>
  );
}

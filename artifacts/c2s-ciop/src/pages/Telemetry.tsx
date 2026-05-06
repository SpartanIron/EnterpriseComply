import { useGetTelemetrySources, useListTelemetryEvents, useListEvidence } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Activity, AlertCircle, WifiOff, Wifi } from "lucide-react";

const SEV_COLORS: Record<string, string> = {
  critical: "text-red-600 font-semibold",
  high: "text-amber-600 font-semibold",
  medium: "text-yellow-600",
  low: "text-slate-500",
  info: "text-blue-500",
};

const SEV_ROW_BG: Record<string, string> = {
  critical: "bg-red-50/60 hover:bg-red-50",
  high: "bg-amber-50/40 hover:bg-amber-50",
  medium: "",
  low: "",
  info: "",
};

const FRESH_BADGE: Record<string, string> = {
  fresh: "bg-green-100 text-green-700 ring-1 ring-inset ring-green-200",
  stale: "bg-amber-100 text-amber-700 ring-1 ring-inset ring-amber-200",
  expired: "bg-red-100 text-red-700 ring-1 ring-inset ring-red-200",
};

export default function Telemetry() {
  const sources = useGetTelemetrySources();
  const events = useListTelemetryEvents({ limit: 50 });
  const evidence = useListEvidence();

  const totalEventsPerMin = (sources.data ?? []).reduce((s, t) => s + t.eventsPerMinute, 0);

  return (
    <div data-testid="telemetry-page" className="space-y-4">
      {/* Source grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3" data-testid="sources-grid">
        {sources.isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-card border border-border rounded-lg p-5 shadow-xs"><Skeleton className="h-20 w-full" /></div>
            ))
          : (sources.data ?? []).map((s) => (
              <div key={s.id} className="bg-card border border-border rounded-lg p-5 shadow-xs" data-testid={`source-${s.id}`}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="text-sm font-semibold text-foreground leading-tight">{s.name}</div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mt-0.5">{s.type.replace("_", " ")}</div>
                  </div>
                  <span className={cn(
                    "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold",
                    s.status === "active" ? "bg-green-100 text-green-700 ring-1 ring-inset ring-green-200"
                    : s.status === "degraded" ? "bg-amber-100 text-amber-700 ring-1 ring-inset ring-amber-200"
                    : "bg-red-100 text-red-700 ring-1 ring-inset ring-red-200"
                  )}>
                    {s.status === "active" ? <Wifi className="w-2.5 h-2.5" /> : s.status === "degraded" ? <AlertCircle className="w-2.5 h-2.5" /> : <WifiOff className="w-2.5 h-2.5" />}
                    {s.status}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border">
                  <div>
                    <div className="text-[10px] text-muted-foreground font-medium">Events/min</div>
                    <div className="font-mono font-bold text-foreground text-sm">{s.eventsPerMinute.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-muted-foreground font-medium">Latency</div>
                    <div className={cn("font-mono font-bold text-sm", s.latencyMs > 1000 ? "text-red-600" : s.latencyMs > 500 ? "text-amber-600" : "text-green-600")}>{s.latencyMs}ms</div>
                  </div>
                </div>
              </div>
            ))}
      </div>

      {/* Total throughput banner */}
      <div className="bg-card border border-border rounded-lg px-5 py-3 shadow-xs flex items-center gap-3">
        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Ingestion Rate</span>
        <span className="font-mono font-bold text-foreground">{totalEventsPerMin.toLocaleString()}</span>
        <span className="text-xs font-medium text-muted-foreground">events / minute</span>
        <div className="ml-auto flex items-center gap-1.5 text-xs font-medium text-green-600">
          <Activity className="w-3.5 h-3.5" />Live
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* Live event stream */}
        <div className="col-span-12 lg:col-span-8 bg-card border border-border rounded-lg shadow-xs overflow-hidden" data-testid="event-stream">
          <div className="px-5 py-4 border-b border-border">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Live Telemetry Stream</div>
          </div>
          {events.isLoading ? (
            <div className="p-4 space-y-1.5">{Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
          ) : (
            <div className="max-h-[480px] overflow-y-auto divide-y divide-border">
              {(events.data ?? []).map((ev) => (
                <div key={ev.id} className={cn("flex items-start gap-3 py-2.5 px-4 hover:bg-muted/20 transition-colors text-xs", SEV_ROW_BG[ev.severity])} data-testid={`event-${ev.id}`}>
                  <span className={cn("shrink-0 w-14 font-semibold uppercase tracking-wide text-right text-[10px] mt-0.5", SEV_COLORS[ev.severity])}>{ev.severity}</span>
                  <span className="shrink-0 text-muted-foreground w-28 truncate font-medium text-[10px] mt-0.5">{ev.source.split(" ").slice(-2).join(" ")}</span>
                  <span className="flex-1 text-foreground leading-relaxed">{ev.message}</span>
                  <div className="shrink-0 text-right space-y-0.5">
                    {ev.asset && <div className="text-muted-foreground font-mono text-[10px] truncate max-w-[100px]">{ev.asset}</div>}
                    <div className="flex items-center gap-1.5 justify-end">
                      {!ev.processed && (
                        <span className="inline-flex items-center rounded bg-amber-100 text-amber-700 ring-1 ring-inset ring-amber-200 px-1 py-0.5 text-[8px] font-bold uppercase tracking-wider">Unproc</span>
                      )}
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {new Date(ev.timestamp).toLocaleTimeString("en-US", { hour12: false })}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Evidence Registry */}
        <div className="col-span-12 lg:col-span-4 bg-card border border-border rounded-lg shadow-xs overflow-hidden" data-testid="evidence-panel">
          <div className="px-5 py-4 border-b border-border">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Evidence Registry</div>
          </div>
          {evidence.isLoading ? (
            <div className="p-4 space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
          ) : (
            <div className="divide-y divide-border">
              {(evidence.data ?? []).map((e) => (
                <div key={e.id} className="px-4 py-3 hover:bg-muted/20 transition-colors" data-testid={`evidence-${e.id}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono font-bold text-xs text-foreground">{e.controlId}</span>
                    <span className={cn("inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide", FRESH_BADGE[e.freshness])}>
                      {e.freshness}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="text-muted-foreground font-medium">{e.source}</span>
                    <span className={cn("font-semibold uppercase tracking-wide", e.type === "automated" ? "text-green-600" : e.type === "api_response" ? "text-blue-600" : "text-muted-foreground")}>
                      {e.type.replace("_", " ")}
                    </span>
                  </div>
                  <div className="text-[9px] font-mono text-muted-foreground mt-1 truncate">{e.hash}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

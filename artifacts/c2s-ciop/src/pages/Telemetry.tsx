import { useGetTelemetrySources, useListTelemetryEvents, useListEvidence } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Activity, Wifi, WifiOff, AlertCircle } from "lucide-react";

const SEV_COLORS: Record<string, string> = {
  critical: "text-red-500",
  high: "text-amber-500",
  medium: "text-yellow-500",
  low: "text-muted-foreground",
  info: "text-blue-400",
};

const SOURCE_STATUS: Record<string, React.ReactNode> = {
  active: <div className="flex items-center gap-1 text-green-500"><div className="w-1.5 h-1.5 bg-green-500" /><span>Active</span></div>,
  degraded: <div className="flex items-center gap-1 text-amber-500"><AlertCircle className="w-3 h-3" /><span>Degraded</span></div>,
  offline: <div className="flex items-center gap-1 text-red-500"><WifiOff className="w-3 h-3" /><span>Offline</span></div>,
  configuring: <div className="flex items-center gap-1 text-blue-400"><Activity className="w-3 h-3" /><span>Configuring</span></div>,
};

const FRESHNESS_COLORS: Record<string, string> = {
  fresh: "text-green-500",
  stale: "text-amber-500",
  expired: "text-red-500",
};

export default function Telemetry() {
  const sources = useGetTelemetrySources();
  const events = useListTelemetryEvents({ limit: 50 });
  const evidence = useListEvidence();

  const totalEventsPerMin = (sources.data ?? []).reduce((s, t) => s + t.eventsPerMinute, 0);

  return (
    <div data-testid="telemetry-page">
      {/* Source Status Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-px bg-border mb-px" data-testid="sources-grid">
        {sources.isLoading
          ? Array.from({ length: 4 }).map((_, i) => <div key={i} className="bg-background p-4"><Skeleton className="h-20 w-full" /></div>)
          : (sources.data ?? []).map((s) => (
              <div key={s.id} className="bg-background p-4" data-testid={`source-${s.id}`}>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="text-[10px] font-mono font-bold text-foreground leading-tight">{s.name}</div>
                    <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider mt-0.5">{s.type.replace("_", " ")}</div>
                  </div>
                  <div className="text-[9px] font-mono">{SOURCE_STATUS[s.status]}</div>
                </div>
                <div className="flex justify-between text-[9px] font-mono mt-3">
                  <span className="text-muted-foreground">Events/min</span>
                  <span className={cn("font-bold", s.status === "active" ? "text-foreground" : "text-amber-500")}>{s.eventsPerMinute.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-[9px] font-mono mt-1">
                  <span className="text-muted-foreground">Latency</span>
                  <span className={cn("font-bold", s.latencyMs > 1000 ? "text-red-500" : s.latencyMs > 500 ? "text-amber-500" : "text-green-500")}>{s.latencyMs.toFixed(0)}ms</span>
                </div>
              </div>
            ))}
      </div>

      {/* Total throughput */}
      <div className="bg-background px-4 py-2 border-b border-border flex items-center gap-4">
        <Activity className="w-3 h-3 text-green-500" />
        <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Total Ingestion Rate</span>
        <span className="text-[11px] font-mono font-bold text-foreground">{totalEventsPerMin.toLocaleString()} events/min</span>
      </div>

      <div className="grid grid-cols-12 gap-px bg-border">
        {/* Live event stream */}
        <div className="col-span-12 lg:col-span-8 bg-background p-4" data-testid="event-stream">
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-3">Live Telemetry Stream</div>
          {events.isLoading ? (
            <div className="space-y-1">{Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
          ) : (
            <div className="space-y-px max-h-[520px] overflow-y-auto font-mono text-[9px]">
              {(events.data ?? []).map((ev) => (
                <div key={ev.id} className={cn("flex items-start gap-3 py-1.5 px-2 border-b border-border/30 hover:bg-muted/20", !ev.processed && "bg-amber-500/5")} data-testid={`event-${ev.id}`}>
                  <span className={cn("shrink-0 uppercase tracking-widest w-12 text-right", SEV_COLORS[ev.severity])}>{ev.severity}</span>
                  <span className="shrink-0 text-muted-foreground w-32 truncate">{ev.source.split(" ").slice(-2).join(" ")}</span>
                  <span className="flex-1 text-foreground">{ev.message}</span>
                  {ev.asset && <span className="shrink-0 text-muted-foreground truncate max-w-[100px]">{ev.asset}</span>}
                  <span className="shrink-0 text-muted-foreground">{!ev.processed && <span className="text-amber-500 mr-1">UNPROC</span>}{new Date(ev.timestamp).toLocaleTimeString("en-US", { hour12: false })}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Evidence Table */}
        <div className="col-span-12 lg:col-span-4 bg-background p-4" data-testid="evidence-panel">
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-3">Evidence Registry</div>
          {evidence.isLoading ? (
            <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : (
            <div className="space-y-px">
              {(evidence.data ?? []).map((e) => (
                <div key={e.id} className="border border-border p-2.5 hover:bg-muted/20 transition-colors" data-testid={`evidence-${e.id}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-mono font-bold text-foreground">{e.controlId}</span>
                    <span className={cn("text-[9px] font-mono uppercase tracking-widest", FRESHNESS_COLORS[e.freshness])}>{e.freshness}</span>
                  </div>
                  <div className="flex justify-between text-[9px] font-mono text-muted-foreground">
                    <span>{e.source}</span>
                    <span className={cn("uppercase", e.type === "automated" ? "text-green-500" : "text-muted-foreground")}>{e.type}</span>
                  </div>
                  <div className="text-[9px] font-mono text-muted-foreground/60 mt-0.5 truncate">{e.hash}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

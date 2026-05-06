import {
  useGetPostureSummary, useGetControlsSummary, useGetRecentFindings,
  useGetComplianceOverview, useGetPostureTrend, useGetExposureSummary,
  useGetTelemetrySources,
} from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, Minus, Activity, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from "recharts";
import { cn } from "@/lib/utils";

function SevBadge({ sev }: { sev: string }) {
  const cls: Record<string, string> = {
    critical: "bg-red-100 text-red-700 ring-1 ring-inset ring-red-200",
    high: "bg-amber-100 text-amber-700 ring-1 ring-inset ring-amber-200",
    medium: "bg-yellow-100 text-yellow-700 ring-1 ring-inset ring-yellow-200",
    low: "bg-blue-100 text-blue-700 ring-1 ring-inset ring-blue-200",
    open: "bg-red-100 text-red-700 ring-1 ring-inset ring-red-200",
    in_progress: "bg-blue-100 text-blue-700 ring-1 ring-inset ring-blue-200",
    resolved: "bg-green-100 text-green-700 ring-1 ring-inset ring-green-200",
    accepted: "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200",
  };
  return (
    <span className={cn("inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide", cls[sev] ?? "bg-slate-100 text-slate-600")}>
      {sev.replace("_", " ")}
    </span>
  );
}

function MetricCard({
  label, value, unit, sub, accent, delta, loading,
}: {
  label: string; value: string | number; unit?: string; sub?: string;
  accent?: string; delta?: number; loading?: boolean;
}) {
  return (
    <div className="bg-card border border-border rounded-lg p-5 shadow-xs flex flex-col justify-between min-h-[120px]">
      <div className="flex items-start justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>
        {delta !== undefined && (
          <span className={cn("flex items-center gap-0.5 text-xs font-medium", delta >= 0 ? "text-green-600" : "text-red-600")}>
            {delta >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {Math.abs(delta)}
          </span>
        )}
      </div>
      {loading ? (
        <Skeleton className="h-12 w-24 mt-2" />
      ) : (
        <div className="mt-1">
          <span className={cn("font-mono font-bold leading-none text-5xl xl:text-6xl", accent ?? "text-foreground")}>{value}</span>
          {unit && <span className="text-base font-mono text-muted-foreground ml-1">{unit}</span>}
          {sub && <div className="text-xs text-muted-foreground mt-1.5 font-medium">{sub}</div>}
        </div>
      )}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{children}</div>;
}

const TOOLTIP_STYLE = {
  contentStyle: {
    background: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "6px",
    fontSize: 11,
    fontFamily: "Inter, sans-serif",
    boxShadow: "0 4px 6px -1px rgba(0,0,0,0.07)",
  },
  labelStyle: { color: "hsl(var(--muted-foreground))", fontWeight: 500 },
};

const AXIS_TICK = { fontSize: 10, fontFamily: "Inter, sans-serif", fill: "hsl(var(--muted-foreground))" };

export default function Dashboard() {
  const posture = useGetPostureSummary();
  const controls = useGetControlsSummary();
  const findings = useGetRecentFindings();
  const compliance = useGetComplianceOverview();
  const trend = useGetPostureTrend();
  const exposure = useGetExposureSummary();
  const sources = useGetTelemetrySources();

  const p = posture.data;
  const c = controls.data;
  const e = exposure.data;

  const scoreColor = !p ? "text-foreground"
    : p.overallScore >= 80 ? "text-green-600"
    : p.overallScore >= 60 ? "text-amber-600"
    : "text-red-600";

  return (
    <div className="space-y-4" data-testid="dashboard">
      {/* Hero metric row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <MetricCard
          label="Cyber Posture Score"
          value={p?.overallScore ?? 0}
          unit="/100"
          sub="vs. prior period"
          accent={scoreColor}
          delta={p?.scoreChange}
          loading={posture.isLoading}
        />
        <MetricCard
          label="Critical Findings"
          value={p?.criticalFindings ?? 0}
          sub="open / unresolved"
          accent="text-red-600"
          loading={posture.isLoading}
        />
        <MetricCard
          label="Active Attack Paths"
          value={p?.activeAttackPaths ?? 0}
          sub="validated & live"
          accent="text-red-600"
          loading={posture.isLoading}
        />
        <MetricCard
          label="Assets at Risk"
          value={p?.assetsAtRisk ?? 0}
          sub="critical + high"
          accent="text-amber-600"
          loading={posture.isLoading}
        />
        <MetricCard
          label="Evidence Freshness"
          value={p?.evidenceFreshness ?? 0}
          unit="%"
          sub="automated collection"
          accent={(p?.evidenceFreshness ?? 0) >= 80 ? "text-green-600" : "text-amber-600"}
          loading={posture.isLoading}
        />
      </div>

      {/* Middle row: trend + control status */}
      <div className="grid grid-cols-12 gap-4">
        {/* Posture trend */}
        <div className="col-span-12 md:col-span-7 bg-card border border-border rounded-lg p-5 shadow-xs" data-testid="tile-trend-chart">
          <SectionLabel>Posture Score Trend — 7 Month</SectionLabel>
          {trend.isLoading ? (
            <Skeleton className="h-44 w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={176}>
              <AreaChart data={trend.data ?? []}>
                <defs>
                  <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.12} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={AXIS_TICK} tickLine={false} axisLine={false} />
                <YAxis domain={[50, 100]} tick={AXIS_TICK} tickLine={false} axisLine={false} width={28} />
                <Tooltip {...TOOLTIP_STYLE} />
                <Area type="monotone" dataKey="score" stroke="#3b82f6" strokeWidth={2.5} fill="url(#scoreGrad)" dot={false} activeDot={{ r: 4, fill: "#3b82f6" }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Control effectiveness */}
        <div className="col-span-12 md:col-span-5 bg-card border border-border rounded-lg p-5 shadow-xs" data-testid="tile-control-status">
          <SectionLabel>Control Effectiveness</SectionLabel>
          {controls.isLoading ? (
            <Skeleton className="h-44 w-full" />
          ) : (
            <div className="space-y-3">
              {[
                { label: "Effective", value: c?.effective ?? 0, total: c?.totalControls ?? 1, color: "bg-green-500" },
                { label: "Degraded", value: c?.degraded ?? 0, total: c?.totalControls ?? 1, color: "bg-amber-500" },
                { label: "Failed", value: c?.failed ?? 0, total: c?.totalControls ?? 1, color: "bg-red-500" },
                { label: "Drift Detected", value: c?.driftCount ?? 0, total: c?.totalControls ?? 1, color: "bg-orange-400" },
                { label: "Automated", value: c?.automatedControls ?? 0, total: c?.totalControls ?? 1, color: "bg-blue-500" },
              ].map(({ label, value, total, color }) => (
                <div key={label} className="flex items-center gap-3">
                  <div className="text-xs font-medium text-muted-foreground w-28 shrink-0">{label}</div>
                  <div className="flex-1 h-1.5 bg-muted rounded-full">
                    <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${Math.round((value / total) * 100)}%` }} />
                  </div>
                  <div className="text-xs font-mono font-semibold text-foreground w-5 text-right">{value}</div>
                </div>
              ))}
              <div className="pt-2 border-t border-border flex justify-between text-xs">
                <span className="text-muted-foreground font-medium">Total Controls</span>
                <span className="font-mono font-semibold text-foreground">{c?.totalControls ?? 0}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom row: frameworks + exposure + telemetry */}
      <div className="grid grid-cols-12 gap-4">
        {/* Framework compliance */}
        <div className="col-span-12 md:col-span-5 bg-card border border-border rounded-lg p-5 shadow-xs" data-testid="tile-frameworks">
          <SectionLabel>Framework Compliance</SectionLabel>
          {compliance.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <div className="space-y-2.5 max-h-52 overflow-y-auto pr-1">
              {(compliance.data ?? []).slice(0, 8).map((f) => (
                <div key={f.frameworkId} className="flex items-center gap-2">
                  <div className="text-xs font-semibold text-foreground w-24 shrink-0 truncate">{f.shortName}</div>
                  <div className="flex-1 h-1.5 bg-muted rounded-full">
                    <div
                      className={cn("h-full rounded-full", f.score >= 85 ? "bg-green-500" : f.score >= 70 ? "bg-amber-500" : "bg-red-500")}
                      style={{ width: `${f.score}%` }}
                    />
                  </div>
                  <div className="text-xs font-mono font-semibold w-10 text-right text-foreground">{f.score.toFixed(0)}%</div>
                  <div className="w-3.5">
                    {f.trend === "up" ? <TrendingUp className="w-3 h-3 text-green-500" /> : f.trend === "down" ? <TrendingDown className="w-3 h-3 text-red-500" /> : <Minus className="w-3 h-3 text-muted-foreground" />}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Risk exposure */}
        <div className="col-span-12 md:col-span-4 bg-card border border-border rounded-lg p-5 shadow-xs" data-testid="tile-exposure">
          <SectionLabel>Risk Exposure Breakdown</SectionLabel>
          {exposure.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <div className="space-y-2">
              {[
                { label: "Critical Risks", value: e?.criticalRisks ?? 0, accent: "text-red-600" },
                { label: "High Risks", value: e?.highRisks ?? 0, accent: "text-amber-600" },
                { label: "Priv. Escalation Paths", value: e?.privilegeEscalationPaths ?? 0, accent: "text-orange-600" },
                { label: "Lateral Movement Paths", value: e?.lateralMovementPaths ?? 0, accent: "text-yellow-600" },
                { label: "Identity Risk Score", value: `${e?.identityRisk?.toFixed(1) ?? 0}%`, accent: "text-red-600" },
                { label: "Network Exposure", value: `${e?.networkExposure?.toFixed(1) ?? 0}%`, accent: "text-amber-600" },
              ].map(({ label, value, accent }) => (
                <div key={label} className="flex items-center justify-between py-1 border-b border-border last:border-0">
                  <span className="text-xs font-medium text-muted-foreground">{label}</span>
                  <span className={cn("text-sm font-mono font-bold", accent)}>{value}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Telemetry sources */}
        <div className="col-span-12 md:col-span-3 bg-card border border-border rounded-lg p-5 shadow-xs" data-testid="tile-telemetry">
          <SectionLabel>Telemetry Sources</SectionLabel>
          {sources.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <div className="space-y-2.5 max-h-52 overflow-y-auto pr-1">
              {(sources.data ?? []).map((s) => (
                <div key={s.id} className="flex items-center gap-2.5">
                  <div className={cn("w-2 h-2 rounded-full shrink-0", s.status === "active" ? "bg-green-500" : s.status === "degraded" ? "bg-amber-500" : "bg-red-500")} />
                  <div className="flex-1 overflow-hidden min-w-0">
                    <div className="text-xs font-medium text-foreground truncate">{s.name.split(" ").slice(-2).join(" ")}</div>
                    <div className="text-[10px] font-mono text-muted-foreground">{s.eventsPerMinute.toLocaleString()} ev/min</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent critical findings */}
      <div className="bg-card border border-border rounded-lg shadow-xs overflow-hidden" data-testid="tile-recent-findings">
        <div className="px-5 py-4 border-b border-border">
          <SectionLabel>Recent Critical Findings — Immediate Attention Required</SectionLabel>
        </div>
        {findings.isLoading ? (
          <div className="p-5 space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  {["Severity", "Finding", "Asset", "Source", "Days Open", "Status"].map((h) => (
                    <th key={h} className="text-left text-muted-foreground font-semibold uppercase tracking-wide py-2.5 px-4 whitespace-nowrap text-[10px]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(findings.data ?? []).slice(0, 5).map((f) => (
                  <tr key={f.id} className="hover:bg-muted/30 transition-colors" data-testid={`finding-row-${f.id}`}>
                    <td className="py-3 px-4"><SevBadge sev={f.severity} /></td>
                    <td className="py-3 px-4 max-w-xs">
                      <div className="font-medium text-foreground truncate">{f.title}</div>
                      {f.cveId && <div className="text-[10px] font-mono text-muted-foreground">{f.cveId}</div>}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground font-mono text-[10px] truncate max-w-[120px]">{f.affectedAsset}</td>
                    <td className="py-3 px-4 text-muted-foreground">{f.source}</td>
                    <td className={cn("py-3 px-4 font-mono font-semibold text-sm", f.daysOpen > 14 ? "text-red-600" : f.daysOpen > 7 ? "text-amber-600" : "text-foreground")}>{f.daysOpen}d</td>
                    <td className="py-3 px-4"><SevBadge sev={f.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

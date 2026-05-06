import { useGetPostureSummary, useGetControlsSummary, useGetRecentFindings, useGetComplianceOverview, useGetPostureTrend, useGetExposureSummary, useGetTelemetrySources } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, TrendingUp, TrendingDown, Minus, ShieldCheck, ShieldAlert, ShieldX, Activity, Wifi, Layers } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from "recharts";
import { cn } from "@/lib/utils";

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    effective: "text-green-500 border-green-500/30 bg-green-500/5",
    degraded: "text-amber-500 border-amber-500/30 bg-amber-500/5",
    failed: "text-red-500 border-red-500/30 bg-red-500/5",
    critical: "text-red-500 border-red-500/30 bg-red-500/5",
    high: "text-amber-500 border-amber-500/30 bg-amber-500/5",
    medium: "text-yellow-500 border-yellow-500/30 bg-yellow-500/5",
    low: "text-blue-400 border-blue-400/30 bg-blue-400/5",
    open: "text-red-500 border-red-500/30 bg-red-500/5",
  };
  return (
    <span className={cn("text-[9px] font-mono uppercase tracking-widest border px-1.5 py-0.5", colors[status] ?? "text-muted-foreground border-border")}>
      {status}
    </span>
  );
}

function BigMetric({ label, value, unit, sub, accent }: { label: string; value: string | number; unit?: string; sub?: string; accent?: string }) {
  return (
    <div className="flex flex-col justify-between h-full p-4">
      <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-2">
        <span className={cn("font-mono font-bold leading-none", accent ?? "text-foreground", "text-5xl lg:text-6xl xl:text-7xl")}>{value}</span>
        {unit && <span className="text-lg font-mono text-muted-foreground ml-1">{unit}</span>}
      </div>
      {sub && <div className="text-[10px] font-mono text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
}

function TileLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-3">{children}</div>;
}

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

  const isLoading = posture.isLoading;

  const scoreColor = !p ? "text-foreground" : p.overallScore >= 80 ? "text-green-500" : p.overallScore >= 60 ? "text-amber-500" : "text-red-500";

  return (
    <div className="grid grid-cols-12 gap-px bg-border" data-testid="dashboard">
      {/* Posture Score — big hero */}
      <div className="col-span-12 md:col-span-3 bg-background" data-testid="tile-posture-score">
        {isLoading ? (
          <div className="p-4"><Skeleton className="h-32 w-full" /></div>
        ) : (
          <BigMetric
            label="Cyber Posture Score"
            value={p?.overallScore ?? 0}
            unit="/100"
            sub={`${p?.scoreChange && p.scoreChange > 0 ? "+" : ""}${p?.scoreChange ?? 0}pts vs last period`}
            accent={scoreColor}
          />
        )}
      </div>

      {/* Critical Findings */}
      <div className="col-span-6 md:col-span-2 bg-background" data-testid="tile-critical-findings">
        {isLoading ? (
          <div className="p-4"><Skeleton className="h-24 w-full" /></div>
        ) : (
          <BigMetric
            label="Critical Findings"
            value={p?.criticalFindings ?? 0}
            sub="open / unresolved"
            accent="text-red-500"
          />
        )}
      </div>

      {/* Attack Paths */}
      <div className="col-span-6 md:col-span-2 bg-background" data-testid="tile-attack-paths">
        {isLoading ? (
          <div className="p-4"><Skeleton className="h-24 w-full" /></div>
        ) : (
          <BigMetric
            label="Active Attack Paths"
            value={p?.activeAttackPaths ?? 0}
            sub="validated & live"
            accent="text-red-500"
          />
        )}
      </div>

      {/* Assets at Risk */}
      <div className="col-span-6 md:col-span-2 bg-background" data-testid="tile-assets-risk">
        {isLoading ? (
          <div className="p-4"><Skeleton className="h-24 w-full" /></div>
        ) : (
          <BigMetric
            label="Assets at Risk"
            value={p?.assetsAtRisk ?? 0}
            sub="critical + high severity"
            accent="text-amber-500"
          />
        )}
      </div>

      {/* Evidence Freshness */}
      <div className="col-span-6 md:col-span-3 bg-background" data-testid="tile-evidence">
        {isLoading ? (
          <div className="p-4"><Skeleton className="h-24 w-full" /></div>
        ) : (
          <BigMetric
            label="Evidence Freshness"
            value={p?.evidenceFreshness ?? 0}
            unit="%"
            sub="automated collection"
            accent={(p?.evidenceFreshness ?? 0) >= 80 ? "text-green-500" : "text-amber-500"}
          />
        )}
      </div>

      {/* Posture Trend Chart */}
      <div className="col-span-12 md:col-span-7 bg-background p-4" data-testid="tile-trend-chart">
        <TileLabel>Posture Score Trend — 7 Month</TileLabel>
        {trend.isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={trend.data ?? []}>
              <defs>
                <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fontSize: 9, fontFamily: "JetBrains Mono", fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
              <YAxis domain={[50, 100]} tick={{ fontSize: 9, fontFamily: "JetBrains Mono", fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} width={28} />
              <Tooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 0, fontSize: 10, fontFamily: "JetBrains Mono" }}
                labelStyle={{ color: "hsl(var(--muted-foreground))" }}
              />
              <Area type="monotone" dataKey="score" stroke="#22c55e" strokeWidth={2} fill="url(#scoreGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Control Status Summary */}
      <div className="col-span-12 md:col-span-5 bg-background p-4" data-testid="tile-control-status">
        <TileLabel>Control Effectiveness</TileLabel>
        {controls.isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <div className="space-y-2.5">
            {[
              { label: "Effective", value: c?.effective ?? 0, total: c?.totalControls ?? 1, color: "bg-green-500" },
              { label: "Degraded", value: c?.degraded ?? 0, total: c?.totalControls ?? 1, color: "bg-amber-500" },
              { label: "Failed", value: c?.failed ?? 0, total: c?.totalControls ?? 1, color: "bg-red-500" },
              { label: "Drift Detected", value: c?.driftCount ?? 0, total: c?.totalControls ?? 1, color: "bg-orange-500" },
              { label: "Automated", value: c?.automatedControls ?? 0, total: c?.totalControls ?? 1, color: "bg-blue-500" },
            ].map(({ label, value, total, color }) => (
              <div key={label} className="flex items-center gap-3">
                <div className="text-[10px] font-mono text-muted-foreground w-28 shrink-0 uppercase tracking-wider">{label}</div>
                <div className="flex-1 h-1.5 bg-muted">
                  <div className={cn("h-full transition-all", color)} style={{ width: `${Math.round((value / total) * 100)}%` }} />
                </div>
                <div className="text-[11px] font-mono font-bold text-foreground w-6 text-right">{value}</div>
              </div>
            ))}
            <div className="pt-2 border-t border-border flex justify-between">
              <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Total Controls</span>
              <span className="text-[11px] font-mono font-bold">{c?.totalControls ?? 0}</span>
            </div>
          </div>
        )}
      </div>

      {/* Framework Compliance Overview */}
      <div className="col-span-12 md:col-span-5 bg-background p-4" data-testid="tile-frameworks">
        <TileLabel>Framework Compliance Overview</TileLabel>
        {compliance.isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <div className="space-y-1.5 max-h-52 overflow-y-auto">
            {(compliance.data ?? []).slice(0, 8).map((f) => (
              <div key={f.frameworkId} className="flex items-center gap-2 py-1">
                <div className="text-[10px] font-mono text-foreground w-24 shrink-0 uppercase tracking-wider truncate">{f.shortName}</div>
                <div className="flex-1 h-1 bg-muted">
                  <div
                    className={cn("h-full", f.score >= 85 ? "bg-green-500" : f.score >= 70 ? "bg-amber-500" : "bg-red-500")}
                    style={{ width: `${f.score}%` }}
                  />
                </div>
                <div className="text-[11px] font-mono font-bold w-10 text-right">{f.score.toFixed(0)}%</div>
                <div className="w-3">
                  {f.trend === "up" ? <TrendingUp className="w-3 h-3 text-green-500" /> : f.trend === "down" ? <TrendingDown className="w-3 h-3 text-red-500" /> : <Minus className="w-3 h-3 text-muted-foreground" />}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Exposure Summary */}
      <div className="col-span-12 md:col-span-4 bg-background p-4" data-testid="tile-exposure">
        <TileLabel>Risk Exposure Breakdown</TileLabel>
        {exposure.isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <div className="space-y-2">
            {[
              { label: "Critical Risks", value: e?.criticalRisks ?? 0, accent: "text-red-500" },
              { label: "High Risks", value: e?.highRisks ?? 0, accent: "text-amber-500" },
              { label: "Privilege Escalation Paths", value: e?.privilegeEscalationPaths ?? 0, accent: "text-orange-500" },
              { label: "Lateral Movement Paths", value: e?.lateralMovementPaths ?? 0, accent: "text-yellow-500" },
              { label: "Identity Risk Score", value: `${e?.identityRisk?.toFixed(1) ?? 0}%`, accent: "text-red-500" },
              { label: "Network Exposure", value: `${e?.networkExposure?.toFixed(1) ?? 0}%`, accent: "text-amber-500" },
            ].map(({ label, value, accent }) => (
              <div key={label} className="flex items-center justify-between py-0.5 border-b border-border/40">
                <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">{label}</span>
                <span className={cn("text-sm font-mono font-bold", accent)}>{value}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Telemetry Sources */}
      <div className="col-span-12 md:col-span-3 bg-background p-4" data-testid="tile-telemetry">
        <TileLabel>Telemetry Sources</TileLabel>
        {sources.isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <div className="space-y-1.5 max-h-52 overflow-y-auto">
            {(sources.data ?? []).map((s) => (
              <div key={s.id} className="flex items-center gap-2">
                <div className={cn("w-1.5 h-1.5 shrink-0", s.status === "active" ? "bg-green-500" : s.status === "degraded" ? "bg-amber-500" : "bg-red-500")} />
                <div className="flex-1 overflow-hidden">
                  <div className="text-[10px] font-mono text-foreground truncate">{s.name.split(" ").slice(-2).join(" ")}</div>
                  <div className="text-[9px] font-mono text-muted-foreground">{s.eventsPerMinute.toLocaleString()} ev/min</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Critical Findings */}
      <div className="col-span-12 bg-background p-4" data-testid="tile-recent-findings">
        <TileLabel>Recent Critical Findings — Immediate Attention Required</TileLabel>
        {findings.isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[10px] font-mono">
              <thead>
                <tr className="border-b border-border">
                  {["Severity", "Finding", "Asset", "Source", "Days Open", "Status"].map((h) => (
                    <th key={h} className="text-left text-muted-foreground uppercase tracking-widest pb-2 pr-4 whitespace-nowrap font-normal">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(findings.data ?? []).slice(0, 5).map((f) => (
                  <tr key={f.id} className="border-b border-border/40 hover:bg-muted/30 transition-colors" data-testid={`finding-row-${f.id}`}>
                    <td className="py-2 pr-4"><StatusBadge status={f.severity} /></td>
                    <td className="py-2 pr-4 max-w-xs">
                      <div className="truncate text-foreground">{f.title}</div>
                      {f.cveId && <div className="text-[9px] text-muted-foreground">{f.cveId}</div>}
                    </td>
                    <td className="py-2 pr-4 text-muted-foreground truncate max-w-[120px]">{f.affectedAsset}</td>
                    <td className="py-2 pr-4 text-muted-foreground">{f.source}</td>
                    <td className={cn("py-2 pr-4 font-bold", f.daysOpen > 14 ? "text-red-500" : f.daysOpen > 7 ? "text-amber-500" : "text-foreground")}>{f.daysOpen}d</td>
                    <td className="py-2"><StatusBadge status={f.status} /></td>
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

import { useMemo } from "react";
import {
  useGetPostureSummary, useGetControlsSummary, useGetRecentFindings,
  useGetComplianceOverview, useGetPostureTrend, useGetExposureSummary,
  useGetTelemetrySources,
} from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TrendingUp, TrendingDown, Minus, Activity,
  AlertTriangle, ShieldAlert, Clock, Zap,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceLine, ReferenceArea, LineChart, Line,
} from "recharts";
import { cn } from "@/lib/utils";

// ─── Severity color maps ─────────────────────────────────────────────────────
const SEV_BADGE: Record<string, string> = {
  critical: "bg-red-100 text-red-700 ring-1 ring-inset ring-red-200",
  high:     "bg-amber-100 text-amber-700 ring-1 ring-inset ring-amber-200",
  medium:   "bg-yellow-100 text-yellow-700 ring-1 ring-inset ring-yellow-200",
  low:      "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200",
  open:     "bg-red-100 text-red-700 ring-1 ring-inset ring-red-200",
  in_progress: "bg-blue-100 text-blue-700 ring-1 ring-inset ring-blue-200",
  resolved: "bg-green-100 text-green-700 ring-1 ring-inset ring-green-200",
  accepted: "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200",
};

const SEV_ACCENT: Record<string, string> = {
  critical: "#ef4444",
  high:     "#f59e0b",
  medium:   "#eab308",
  low:      "#94a3b8",
};

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

const AXIS_TICK = {
  fontSize: 10,
  fontFamily: "Inter, sans-serif",
  fill: "hsl(var(--muted-foreground))",
};

// ─── Posture Gauge (SVG arc) ─────────────────────────────────────────────────
function gaugePoint(cx: number, cy: number, r: number, pct: number) {
  // pct 0=left (180°) → 1=right (0°) going CW through the top in SVG coords
  const angleDeg = 180 - 180 * pct;
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy - r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, r: number, from: number, to: number) {
  const s = gaugePoint(cx, cy, r, from);
  const e = gaugePoint(cx, cy, r, to);
  // sweep=1 (CW in SVG) goes upward from the left → draws upper semicircle arc
  return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 0 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
}

function PostureGauge({ score }: { score: number }) {
  const cx = 110, cy = 114, r = 90;
  const pct = Math.max(0, Math.min(1, score / 100));
  const scoreColor = score < 60 ? "#ef4444" : score < 75 ? "#f59e0b" : "#22c55e";
  const scoreLabel = score < 60 ? "Critical" : score < 75 ? "At Risk" : "Nominal";

  // Zone tick positions (white dots at thresholds)
  const p60 = gaugePoint(cx, cy, r, 0.60);
  const p75 = gaugePoint(cx, cy, r, 0.75);

  return (
    <div className="flex flex-col items-center">
      <svg viewBox={`0 0 220 ${cy + 14}`} className="w-full max-w-[220px]" role="img" aria-label={`Posture score: ${score} out of 100`}>
        {/* Zone background arcs */}
        <path d={arcPath(cx, cy, r, 0,    0.60)} fill="none" stroke="#fee2e2" strokeWidth={20} strokeLinecap="butt" />
        <path d={arcPath(cx, cy, r, 0.60, 0.75)} fill="none" stroke="#fef3c7" strokeWidth={20} strokeLinecap="butt" />
        <path d={arcPath(cx, cy, r, 0.75, 1.00)} fill="none" stroke="#dcfce7" strokeWidth={20} strokeLinecap="butt" />
        {/* Gray track overlay (to dim zones slightly) */}
        <path d={arcPath(cx, cy, r, 0, 1)} fill="none" stroke="hsl(var(--muted))" strokeWidth={20} strokeOpacity={0.35} strokeLinecap="butt" />
        {/* Score arc */}
        {pct > 0 && (
          <path d={arcPath(cx, cy, r, 0, pct)} fill="none" stroke={scoreColor} strokeWidth={20} strokeLinecap="round" />
        )}
        {/* Zone boundary ticks */}
        <circle cx={p60.x} cy={p60.y} r={3.5} fill="white" />
        <circle cx={p75.x} cy={p75.y} r={3.5} fill="white" />
        {/* Score text */}
        <text x={cx} y={cy - 22} textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontWeight="700" fontSize="44" fill={scoreColor}>{score}</text>
        <text x={cx} y={cy - 4} textAnchor="middle" fontFamily="Inter, sans-serif" fontSize="11" fill="hsl(var(--muted-foreground))">/100  •  {scoreLabel}</text>
      </svg>

      {/* Zone legend */}
      <div className="flex items-center justify-center gap-4 text-[10px] font-medium text-muted-foreground mt-0.5">
        <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-red-400" />&lt;60 Critical</span>
        <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-amber-400" />60–75 At Risk</span>
        <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-green-400" />&gt;75 Nominal</span>
      </div>
    </div>
  );
}

// ─── Sparkline ────────────────────────────────────────────────────────────────
function Sparkline({ data, color }: { data: number[]; color: string }) {
  return (
    <LineChart width={72} height={32} data={data.map((v) => ({ v }))}>
      <Line type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} dot={false} isAnimationActive={false} />
    </LineChart>
  );
}

// Static 7-day sparkline arrays (plausible trends from the live seed data)
const SPARKS = {
  critical:  [4, 3, 3, 3, 2, 2, 2],
  attack:    [5, 5, 5, 4, 4, 4, 4],
  assets:    [10, 10, 11, 10, 10, 9, 9],
  evidence:  [70, 71, 72, 73, 74, 75, 75],
};

// ─── Metric Spark Tile ────────────────────────────────────────────────────────
function SparkTile({
  label, value, unit, sub, accent, sparkData, loading,
}: {
  label: string; value: string | number; unit?: string; sub?: string;
  accent: string; sparkData: number[]; loading?: boolean;
}) {
  const sparkColor = accent;
  const lastTwo = sparkData.slice(-2);
  const trending = lastTwo[1] > lastTwo[0] ? "up" : lastTwo[1] < lastTwo[0] ? "down" : "flat";

  return (
    <div className="bg-card border border-border rounded-lg p-4 shadow-xs flex flex-col gap-2">
      <div className="flex items-start justify-between">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider leading-tight">{label}</span>
        {trending === "up" ? <TrendingUp className="w-3.5 h-3.5 text-green-500 shrink-0" /> : trending === "down" ? <TrendingDown className="w-3.5 h-3.5 text-red-500 shrink-0" /> : <Minus className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
      </div>
      {loading ? <Skeleton className="h-9 w-20" /> : (
        <div className="flex items-end justify-between gap-2">
          <div>
            <span className={cn("font-mono font-bold leading-none text-4xl", accent)}>{value}</span>
            {unit && <span className="text-sm font-mono text-muted-foreground ml-0.5">{unit}</span>}
            {sub && <div className="text-[10px] text-muted-foreground mt-1 font-medium">{sub}</div>}
          </div>
          <div className="shrink-0 mb-0.5">
            <Sparkline data={sparkData} color={sparkColor} />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Attention Panel ──────────────────────────────────────────────────────────
function SevBadge({ sev }: { sev: string }) {
  return (
    <span className={cn("inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide", SEV_BADGE[sev] ?? SEV_BADGE.low)}>
      {sev.replace("_", " ")}
    </span>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">{children}</div>;
}

export default function Dashboard() {
  const posture   = useGetPostureSummary();
  const controls  = useGetControlsSummary();
  const findings  = useGetRecentFindings();
  const compliance = useGetComplianceOverview();
  const trend     = useGetPostureTrend();
  const exposure  = useGetExposureSummary();
  const sources   = useGetTelemetrySources();

  const p = posture.data;
  const c = controls.data;
  const e = exposure.data;

  const scoreColor = !p ? "text-foreground"
    : p.overallScore < 60 ? "text-red-600"
    : p.overallScore < 75 ? "text-amber-600"
    : "text-green-600";

  // Derive attention items from findings data
  const attentionItems = useMemo(() => {
    const items: {
      type: string; severity: string; title: string;
      context: string; icon: React.ReactNode; accent: string;
    }[] = [];

    (findings.data ?? [])
      .filter((f) => f.daysOpen > (f.remediationSla ?? 999) && f.status !== "resolved")
      .slice(0, 3)
      .forEach((f) => items.push({
        type: "SLA BREACH",
        severity: f.severity,
        title: f.title,
        context: `${f.affectedAsset} · ${f.daysOpen}d open (SLA: ${f.remediationSla}d)`,
        icon: <Clock className="w-3.5 h-3.5" />,
        accent: SEV_ACCENT[f.severity] ?? "#94a3b8",
      }));

    (findings.data ?? [])
      .filter((f) => f.severity === "critical" && f.status === "open" && f.daysOpen <= (f.remediationSla ?? 999))
      .slice(0, 2)
      .forEach((f) => items.push({
        type: "CRITICAL OPEN",
        severity: f.severity,
        title: f.title,
        context: `${f.affectedAsset} · via ${f.source}`,
        icon: <ShieldAlert className="w-3.5 h-3.5" />,
        accent: "#ef4444",
      }));

    return items.slice(0, 5);
  }, [findings.data]);

  const trendData = trend.data ?? [];

  return (
    <div data-testid="dashboard" className="space-y-4">

      {/* ── ROW 1: Posture Gauge + Score Details + Attention Panel ── */}
      <div className="grid grid-cols-12 gap-4">

        {/* Gauge */}
        <div className="col-span-12 md:col-span-4 bg-card border border-border rounded-lg p-5 shadow-xs flex flex-col justify-center" data-testid="tile-posture-gauge">
          <SectionLabel>Cyber Posture Score</SectionLabel>
          {posture.isLoading ? <Skeleton className="h-40 w-full" /> : (
            <>
              <PostureGauge score={p?.overallScore ?? 0} />
              <div className="mt-3 grid grid-cols-2 gap-2 pt-3 border-t border-border">
                <div className="text-center">
                  <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Change</div>
                  <div className={cn("text-lg font-mono font-bold", (p?.scoreChange ?? 0) >= 0 ? "text-green-600" : "text-red-600")}>
                    {(p?.scoreChange ?? 0) >= 0 ? "+" : ""}{p?.scoreChange?.toFixed(1) ?? 0}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Target</div>
                  <div className="text-lg font-mono font-bold text-green-600">85</div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Attention Required */}
        <div className="col-span-12 md:col-span-8 bg-card border border-border rounded-lg shadow-xs overflow-hidden" data-testid="tile-attention">
          <div className="px-5 pt-4 pb-2 border-b border-border flex items-center justify-between">
            <SectionLabel>Action Required</SectionLabel>
            {attentionItems.length > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 bg-red-100 text-red-700 ring-1 ring-inset ring-red-200 rounded-full mb-3">
                {attentionItems.length} items
              </span>
            )}
          </div>
          {findings.isLoading ? (
            <div className="p-4 space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : attentionItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-sm text-muted-foreground gap-2">
              <Activity className="w-6 h-6 text-green-500" />
              All systems nominal — no immediate action required
            </div>
          ) : (
            <div className="divide-y divide-border">
              {attentionItems.map((item, i) => (
                <div key={i} className="flex items-start gap-0" data-testid={`attention-item-${i}`}>
                  {/* Left accent bar */}
                  <div className="w-[3px] self-stretch shrink-0 rounded-sm" style={{ backgroundColor: item.accent }} />
                  <div className="flex items-start gap-3 px-4 py-3 flex-1 min-w-0">
                    <div className="shrink-0 mt-0.5" style={{ color: item.accent }}>{item.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <SevBadge sev={item.severity} />
                        <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">{item.type}</span>
                      </div>
                      <div className="text-sm font-semibold text-foreground truncate">{item.title}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5 truncate">{item.context}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── ROW 2: 4 Metric Sparkline Tiles ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SparkTile label="Critical Findings" value={p?.criticalFindings ?? 0}
          sub="open / unresolved" accent={p && p.criticalFindings > 0 ? "#ef4444" : "#22c55e"}
          sparkData={SPARKS.critical} loading={posture.isLoading} />
        <SparkTile label="Active Attack Paths" value={p?.activeAttackPaths ?? 0}
          sub="validated & live" accent={p && p.activeAttackPaths > 3 ? "#ef4444" : "#f59e0b"}
          sparkData={SPARKS.attack} loading={posture.isLoading} />
        <SparkTile label="Assets at Risk" value={p?.assetsAtRisk ?? 0}
          sub="critical + high" accent="#f59e0b"
          sparkData={SPARKS.assets} loading={posture.isLoading} />
        <SparkTile label="Evidence Freshness" value={p?.evidenceFreshness ?? 0} unit="%"
          sub="automated collection"
          accent={(p?.evidenceFreshness ?? 0) >= 80 ? "#22c55e" : "#f59e0b"}
          sparkData={SPARKS.evidence} loading={posture.isLoading} />
      </div>

      {/* ── ROW 3: Trend Chart (with zones) + Control Effectiveness ── */}
      <div className="grid grid-cols-12 gap-4">

        {/* Posture trend with zone bands */}
        <div className="col-span-12 md:col-span-7 bg-card border border-border rounded-lg p-5 shadow-xs" data-testid="tile-trend-chart">
          <SectionLabel>Posture Score Trend — 7 Month</SectionLabel>
          {trend.isLoading ? <Skeleton className="h-48 w-full" /> : (
            <ResponsiveContainer width="100%" height={192}>
              <AreaChart data={trendData} margin={{ top: 4, right: 48, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                {/* Zone bands */}
                <ReferenceArea y1={50} y2={60} fill="#fef2f2" fillOpacity={0.7} stroke="none" />
                <ReferenceArea y1={60} y2={75} fill="#fffbeb" fillOpacity={0.7} stroke="none" />
                <ReferenceArea y1={75} y2={100} fill="#f0fdf4" fillOpacity={0.6} stroke="none" />
                {/* Reference lines */}
                <ReferenceLine y={85} stroke="#16a34a" strokeDasharray="5 3" strokeWidth={1.5}
                  label={{ value: "Target 85", position: "insideTopRight", fontSize: 10, fill: "#16a34a", fontFamily: "Inter" }} />
                <ReferenceLine y={70} stroke="#94a3b8" strokeDasharray="3 3" strokeWidth={1}
                  label={{ value: "Avg 70", position: "insideBottomRight", fontSize: 10, fill: "#94a3b8", fontFamily: "Inter" }} />
                <XAxis dataKey="date" tick={AXIS_TICK} tickLine={false} axisLine={false}
                  tickFormatter={(v) => v.slice(5)} />
                <YAxis domain={[50, 100]} tick={AXIS_TICK} tickLine={false} axisLine={false} width={24} />
                <Tooltip {...TOOLTIP_STYLE} formatter={(v: number) => [`${v}`, "Score"]} />
                <Area type="monotone" dataKey="score" stroke="#3b82f6" strokeWidth={2.5}
                  fill="url(#scoreGrad)" dot={false}
                  activeDot={{ r: 4, fill: "#3b82f6", strokeWidth: 0 }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Control effectiveness */}
        <div className="col-span-12 md:col-span-5 bg-card border border-border rounded-lg p-5 shadow-xs" data-testid="tile-control-status">
          <SectionLabel>Control Effectiveness</SectionLabel>
          {controls.isLoading ? <Skeleton className="h-48 w-full" /> : (
            <div className="space-y-3">
              {[
                { label: "Effective",      value: c?.effective ?? 0,         total: c?.totalControls ?? 1, color: "bg-green-500",  text: "text-green-600" },
                { label: "Degraded",       value: c?.degraded ?? 0,          total: c?.totalControls ?? 1, color: "bg-amber-500",  text: "text-amber-600" },
                { label: "Failed",         value: c?.failed ?? 0,            total: c?.totalControls ?? 1, color: "bg-red-500",    text: "text-red-600" },
                { label: "Drift Detected", value: c?.driftCount ?? 0,        total: c?.totalControls ?? 1, color: "bg-orange-400", text: "text-orange-600" },
                { label: "Automated",      value: c?.automatedControls ?? 0, total: c?.totalControls ?? 1, color: "bg-blue-500",   text: "text-blue-600" },
              ].map(({ label, value, total, color, text }) => (
                <div key={label} className="flex items-center gap-3">
                  <span className="text-xs font-medium text-muted-foreground w-28 shrink-0">{label}</span>
                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className={cn("h-full rounded-full", color)} style={{ width: `${Math.round((value / total) * 100)}%` }} />
                  </div>
                  <span className={cn("text-sm font-mono font-bold w-5 text-right shrink-0", text)}>{value}</span>
                </div>
              ))}
              <div className="pt-2 border-t border-border flex justify-between text-xs">
                <span className="text-muted-foreground font-medium">Total Controls</span>
                <span className="font-mono font-bold text-foreground">{c?.totalControls ?? 0}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── ROW 4: Frameworks + Exposure + Telemetry ── */}
      <div className="grid grid-cols-12 gap-4">
        {/* Framework compliance */}
        <div className="col-span-12 md:col-span-5 bg-card border border-border rounded-lg p-5 shadow-xs" data-testid="tile-frameworks">
          <SectionLabel>Framework Compliance</SectionLabel>
          {compliance.isLoading ? <Skeleton className="h-44 w-full" /> : (
            <div className="space-y-2.5 max-h-52 overflow-y-auto pr-1">
              {(compliance.data ?? []).slice(0, 8).map((f) => (
                <div key={f.frameworkId} className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-foreground w-24 shrink-0 truncate">{f.shortName}</span>
                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className={cn("h-full rounded-full", f.score >= 85 ? "bg-green-500" : f.score >= 70 ? "bg-amber-500" : "bg-red-500")}
                      style={{ width: `${f.score}%` }} />
                  </div>
                  <span className="text-xs font-mono font-bold w-10 text-right text-foreground">{f.score.toFixed(0)}%</span>
                  <div className="w-3.5 shrink-0">
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
          {exposure.isLoading ? <Skeleton className="h-44 w-full" /> : (
            <div className="space-y-1.5">
              {[
                { label: "Critical Risks",          value: e?.criticalRisks ?? 0,               fmt: (v: number) => String(v),             accent: "text-red-600" },
                { label: "High Risks",              value: e?.highRisks ?? 0,                   fmt: (v: number) => String(v),             accent: "text-amber-600" },
                { label: "Priv. Escalation Paths",  value: e?.privilegeEscalationPaths ?? 0,    fmt: (v: number) => String(v),             accent: "text-orange-600" },
                { label: "Lateral Movement Paths",  value: e?.lateralMovementPaths ?? 0,        fmt: (v: number) => String(v),             accent: "text-yellow-600" },
                { label: "Identity Risk Score",     value: e?.identityRisk ?? 0,                fmt: (v: number) => `${v.toFixed(0)}%`,   accent: "text-red-600" },
                { label: "Network Exposure",        value: e?.networkExposure ?? 0,             fmt: (v: number) => `${v.toFixed(0)}%`,   accent: "text-amber-600" },
              ].map(({ label, value, fmt, accent }) => (
                <div key={label} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                  <span className="text-xs font-medium text-muted-foreground">{label}</span>
                  <span className={cn("text-sm font-mono font-bold", accent)}>{fmt(value as number)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Telemetry sources */}
        <div className="col-span-12 md:col-span-3 bg-card border border-border rounded-lg p-5 shadow-xs" data-testid="tile-telemetry">
          <SectionLabel>Telemetry Sources</SectionLabel>
          {sources.isLoading ? <Skeleton className="h-44 w-full" /> : (
            <div className="space-y-2.5">
              {(sources.data ?? []).map((s) => (
                <div key={s.id} className="flex items-center gap-2.5">
                  <div className={cn("w-2 h-2 rounded-full shrink-0", s.status === "active" ? "bg-green-500" : s.status === "degraded" ? "bg-amber-500" : "bg-red-500")} />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-foreground truncate">{s.name.split(" ").slice(-2).join(" ")}</div>
                    <div className="text-[10px] font-mono text-muted-foreground">{s.eventsPerMinute.toLocaleString()} ev/min</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── ROW 5: Recent Findings with left-border accents ── */}
      <div className="bg-card border border-border rounded-lg shadow-xs overflow-hidden" data-testid="tile-recent-findings">
        <div className="px-5 py-3.5 border-b border-border">
          <SectionLabel>Recent Findings — Immediate Attention Required</SectionLabel>
        </div>
        {findings.isLoading ? (
          <div className="p-5 space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/40 border-b border-border">
                  <th className="w-[3px] p-0" aria-hidden />
                  {["Severity", "Finding", "Asset", "Source", "Days Open", "Status"].map((h) => (
                    <th key={h} className="text-left text-muted-foreground font-semibold uppercase tracking-wide py-2.5 px-4 whitespace-nowrap text-[10px]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(findings.data ?? []).slice(0, 5).map((f) => (
                  <tr key={f.id} className="hover:bg-muted/20 transition-colors" data-testid={`finding-row-${f.id}`}>
                    <td className="p-0 w-[3px]" style={{ backgroundColor: SEV_ACCENT[f.severity] ?? "#94a3b8" }} aria-hidden />
                    <td className="py-3 px-4">
                      <span className={cn("inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide", SEV_BADGE[f.severity] ?? "")}>
                        {f.severity}
                      </span>
                    </td>
                    <td className="py-3 px-4 max-w-[200px]">
                      <div className="font-semibold text-foreground truncate">{f.title}</div>
                      {f.cveId && <div className="text-[10px] font-mono text-muted-foreground">{f.cveId}</div>}
                    </td>
                    <td className="py-3 px-4 font-mono text-[10px] text-muted-foreground truncate max-w-[110px]">{f.affectedAsset}</td>
                    <td className="py-3 px-4 text-muted-foreground font-medium">{f.source}</td>
                    <td className={cn("py-3 px-4 font-mono font-bold text-sm", f.daysOpen > 14 ? "text-red-600" : f.daysOpen > 7 ? "text-amber-600" : "text-foreground")}>
                      {f.daysOpen}d
                    </td>
                    <td className="py-3 px-4">
                      <span className={cn("inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide", SEV_BADGE[f.status] ?? "")}>
                        {f.status.replace("_", " ")}
                      </span>
                    </td>
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

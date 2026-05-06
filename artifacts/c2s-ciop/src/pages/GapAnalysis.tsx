import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { AlertTriangle, CheckCircle2, MinusCircle, Shield, ChevronRight, RefreshCw, Building2 } from "lucide-react";

const FRAMEWORKS = [
  { key: "fedramp",      label: "FedRAMP Moderate",   short: "FedRAMP" },
  { key: "cmmc",         label: "CMMC Level 2",        short: "CMMC" },
  { key: "nist-800-53",  label: "NIST 800-53 Rev 5",  short: "NIST" },
  { key: "soc2",         label: "SOC 2 Type II",       short: "SOC 2" },
  { key: "iso-27001",    label: "ISO 27001:2022",      short: "ISO" },
  { key: "pci-dss",      label: "PCI DSS v4.0",        short: "PCI" },
  { key: "cis-controls", label: "CIS Controls v8",     short: "CIS" },
];

type GapStatus = "covered" | "partial" | "gap" | "inherited";

interface GapItem {
  frameworkControlId: string;
  frameworkControlName: string;
  canonicalControlId: string;
  canonicalControlName: string;
  gapStatus: GapStatus;
  controlStatus: string;
  evidenceFresh: boolean;
  effectiveness: number;
  inherited: boolean;
  inheritedFrom: string | null;
  customerResponsibility: string;
  mappingRationale: string | null;
}

interface GapData {
  frameworkKey: string;
  total: number;
  covered: number;
  partial: number;
  gap: number;
  inherited: number;
  readinessScore: number;
  items: GapItem[];
}

const STATUS_CONFIG: Record<GapStatus, { label: string; color: string; bg: string; border: string; icon: typeof CheckCircle2 }> = {
  covered:   { label: "Covered",   color: "text-emerald-700", bg: "bg-emerald-50",  border: "border-emerald-200", icon: CheckCircle2 },
  partial:   { label: "Partial",   color: "text-amber-700",   bg: "bg-amber-50",    border: "border-amber-200",   icon: MinusCircle  },
  gap:       { label: "Gap",       color: "text-red-700",     bg: "bg-red-50",      border: "border-red-200",     icon: AlertTriangle },
  inherited: { label: "Inherited", color: "text-blue-700",    bg: "bg-blue-50",     border: "border-blue-200",    icon: Building2    },
};

const SEVERITY_ACCENT: Record<string, string> = {
  covered:   "bg-emerald-500",
  partial:   "bg-amber-400",
  gap:       "bg-red-500",
  inherited: "bg-blue-500",
};

function GaugeArc({ score }: { score: number }) {
  const pct = Math.min(Math.max(score, 0), 100) / 100;
  const cx = 80, cy = 80, r = 60;
  const startAngle = Math.PI;
  const endAngle = 0;
  const angle = startAngle - (startAngle - endAngle) * pct;
  const ex = cx + r * Math.cos(angle);
  const ey = cy - r * Math.sin(angle);
  const largeArc = pct > 0.5 ? 0 : 0;
  const trackD = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;
  const fillD  = pct > 0
    ? `M ${cx - r} ${cy} A ${r} ${r} 0 ${pct > 0.5 ? 1 : 0} 1 ${ex} ${ey}`
    : "";
  const scoreColor = score >= 80 ? "#10b981" : score >= 60 ? "#f59e0b" : "#ef4444";
  return (
    <svg width={160} height={100} className="overflow-visible">
      <path d={trackD} fill="none" stroke="currentColor" strokeWidth={10} strokeLinecap="round" className="text-muted/30" />
      {fillD && <path d={fillD} fill="none" stroke={scoreColor} strokeWidth={10} strokeLinecap="round" />}
      <text x={cx} y={cy + 8} textAnchor="middle" className="font-mono font-bold" fontSize={28} fill={scoreColor}>{score}</text>
      <text x={cx} y={cy + 24} textAnchor="middle" fontSize={10} fill="currentColor" opacity={0.5} className="text-muted-foreground">READINESS</text>
    </svg>
  );
}

function StatPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className={cn("text-xl font-mono font-bold", color)}>{value}</div>
      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</div>
    </div>
  );
}

export default function GapAnalysis() {
  const [selectedFramework, setSelectedFramework] = useState("fedramp");
  const [filterStatus, setFilterStatus] = useState<GapStatus | "all">("all");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery<GapData>({
    queryKey: ["gap-analysis", selectedFramework],
    queryFn: async () => {
      const r = await fetch(`/api/frameworks/${selectedFramework}/gap-analysis`);
      return r.json();
    },
  });

  const { data: readiness } = useQuery({
    queryKey: ["audit-readiness", selectedFramework],
    queryFn: async () => {
      const r = await fetch(`/api/frameworks/${selectedFramework}/audit-readiness`);
      return r.json();
    },
  });

  const filtered = data?.items.filter(i => filterStatus === "all" || i.gapStatus === filterStatus) ?? [];
  const frameworkLabel = FRAMEWORKS.find(f => f.key === selectedFramework)?.label ?? selectedFramework;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-foreground">Gap Analysis</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Control coverage across compliance frameworks — one canonical control, all framework outputs</p>
        </div>
        <button onClick={() => refetch()} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border px-3 py-1.5 hover:bg-muted transition-colors">
          <RefreshCw className="w-3 h-3" />
          Refresh
        </button>
      </div>

      {/* Framework selector */}
      <div className="flex gap-1 flex-wrap">
        {FRAMEWORKS.map(f => (
          <button
            key={f.key}
            onClick={() => { setSelectedFramework(f.key); setFilterStatus("all"); }}
            className={cn(
              "px-3 py-1.5 text-xs font-semibold border transition-colors",
              selectedFramework === f.key
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card border-border text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            {f.short}
          </button>
        ))}
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-12 gap-4">
        {/* Gauge */}
        <div className="col-span-12 md:col-span-4 bg-card border border-border p-5 flex flex-col items-center justify-center gap-3">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{frameworkLabel}</div>
          <GaugeArc score={data?.readinessScore ?? 0} />
          <div className="flex gap-6">
            <StatPill label="Covered" value={data?.covered ?? 0} color="text-emerald-600" />
            <StatPill label="Partial" value={data?.partial ?? 0} color="text-amber-600" />
            <StatPill label="Gap" value={data?.gap ?? 0} color="text-red-600" />
            <StatPill label="Inherited" value={data?.inherited ?? 0} color="text-blue-600" />
          </div>
        </div>

        {/* Blockers */}
        <div className="col-span-12 md:col-span-8 bg-card border border-border p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <span className="text-sm font-bold text-foreground">Authorization Blockers</span>
            {readiness?.blockerCount > 0 && (
              <span className="ml-auto text-xs bg-red-100 text-red-700 border border-red-200 px-2 py-0.5 font-semibold">
                {readiness.blockerCount} blocker{readiness.blockerCount !== 1 ? "s" : ""}
              </span>
            )}
          </div>
          {readiness?.blockers?.length > 0 ? (
            <div className="space-y-2">
              {readiness.blockers.map((b: { frameworkControlId: string; frameworkControlName: string; canonicalControlId: string; reason: string }, i: number) => (
                <div key={i} className="flex items-start gap-3 p-3 bg-red-50 border border-red-200">
                  <div className="w-[3px] self-stretch bg-red-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-bold text-red-700">{b.frameworkControlId}</span>
                      <span className="text-xs text-red-800 font-medium">{b.frameworkControlName}</span>
                    </div>
                    <div className="text-xs text-red-700 mt-0.5">→ UCO: {b.canonicalControlId} — {b.reason}</div>
                  </div>
                </div>
              ))}
              <div className="pt-2 text-xs text-muted-foreground border-t border-border">
                Projected days to authorization: <span className="font-mono font-bold text-foreground">{readiness.projectedAtoDays}</span> days at current remediation velocity
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-emerald-700 text-sm">
              <CheckCircle2 className="w-4 h-4" />
              No hard blockers — all framework controls are mapped and covered
            </div>
          )}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <span className="text-xs text-muted-foreground mr-2">Filter:</span>
        {(["all", "gap", "partial", "covered", "inherited"] as const).map(s => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={cn(
              "px-3 py-1 text-xs font-semibold border transition-colors capitalize",
              filterStatus === s
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            {s === "all" ? `All (${data?.total ?? 0})` : `${s.charAt(0).toUpperCase() + s.slice(1)} (${data?.[s as keyof GapData] as number ?? 0})`}
          </button>
        ))}
      </div>

      {/* Control mapping table */}
      <div className="border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="w-[3px] p-0" />
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Framework Control</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">UCO Control</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Responsibility</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Evidence</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-b border-border">
                  <td className="p-0 w-[3px]"><div className="w-[3px] h-12 bg-muted animate-pulse" /></td>
                  <td colSpan={6} className="px-4 py-3"><div className="h-4 bg-muted animate-pulse rounded w-3/4" /></td>
                </tr>
              ))
            ) : filtered.map((item) => {
              const cfg = STATUS_CONFIG[item.gapStatus];
              const Icon = cfg.icon;
              const isExpanded = expandedRow === item.frameworkControlId;
              return (
                <React.Fragment key={item.frameworkControlId}>
                  <tr
                    className={cn("border-b border-border cursor-pointer hover:bg-muted/30 transition-colors", item.gapStatus === "gap" && "bg-red-50/30")}
                    onClick={() => setExpandedRow(isExpanded ? null : item.frameworkControlId)}
                  >
                    <td className="p-0 w-[3px]"><div className={cn("w-[3px] h-full min-h-[48px]", SEVERITY_ACCENT[item.gapStatus])} /></td>
                    <td className="px-4 py-3">
                      <div className="font-mono text-xs font-bold text-foreground">{item.frameworkControlId}</div>
                      <div className="text-xs text-muted-foreground mt-0.5 max-w-xs truncate">{item.frameworkControlName}</div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <div className="font-mono text-xs font-semibold text-primary">{item.canonicalControlId}</div>
                      <div className="text-xs text-muted-foreground mt-0.5 max-w-xs truncate">{item.canonicalControlName}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("inline-flex items-center gap-1.5 px-2 py-1 text-xs font-semibold border", cfg.color, cfg.bg, cfg.border)}>
                        <Icon className="w-3 h-3" />
                        {cfg.label}
                      </span>
                      {item.inherited && item.inheritedFrom && (
                        <div className="text-[10px] text-blue-600 mt-1">↳ {item.inheritedFrom}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className={cn("text-xs font-medium capitalize",
                        item.customerResponsibility === "full" ? "text-foreground" :
                        item.customerResponsibility === "partial" ? "text-amber-600" : "text-muted-foreground"
                      )}>
                        {item.customerResponsibility}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className={cn("text-xs font-medium",
                        item.evidenceFresh ? "text-emerald-600" : "text-amber-600"
                      )}>
                        {item.evidenceFresh ? "Fresh" : "Stale"}
                      </span>
                      {item.effectiveness > 0 && (
                        <div className="text-[10px] text-muted-foreground">{Math.round(item.effectiveness)}% effective</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <ChevronRight className={cn("w-3 h-3 text-muted-foreground transition-transform", isExpanded && "rotate-90")} />
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className="border-b border-border bg-muted/20">
                      <td className="p-0 w-[3px]"><div className={cn("w-[3px] h-full min-h-[60px]", SEVERITY_ACCENT[item.gapStatus])} /></td>
                      <td colSpan={6} className="px-4 py-3">
                        <div className="text-xs text-muted-foreground space-y-1.5">
                          {item.mappingRationale && (
                            <div>
                              <span className="font-semibold text-foreground">Mapping rationale: </span>
                              {item.mappingRationale}
                            </div>
                          )}
                          <div className="flex gap-6 mt-2">
                            <div><span className="font-semibold text-foreground">Control status:</span> <span className="capitalize">{item.controlStatus}</span></div>
                            <div><span className="font-semibold text-foreground">Customer responsibility:</span> <span className="capitalize">{item.customerResponsibility}</span></div>
                            {item.inheritedFrom && <div><span className="font-semibold text-foreground">Inherited from:</span> {item.inheritedFrom}</div>}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
            {!isLoading && filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  No mappings found for this filter. Select a different framework or status.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

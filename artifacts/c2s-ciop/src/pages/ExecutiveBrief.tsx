import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { AlertTriangle, TrendingUp, TrendingDown, RefreshCw, Shield, DollarSign, CheckCircle2, Zap, Clock } from "lucide-react";

interface Briefing {
  id: string;
  headline: string;
  postureDelta: string;
  situationSummary: string;
  financialExposureLow: number;
  financialExposureHigh: number;
  topThreats: { title: string; severity: string; context: string }[];
  recommendedActions: string[];
  frameworksAtRisk: string[];
  confidenceScore: number;
  dataFreshnessScore: number;
  generatedAt: string;
}

interface Exposure {
  exposureLow: number;
  exposureHigh: number;
  methodology: string;
  computedAt: string;
}

const SEV_COLOR: Record<string, string> = {
  critical: "text-red-600",
  high:     "text-amber-600",
  medium:   "text-yellow-600",
  low:      "text-slate-500",
};

const SEV_BG: Record<string, string> = {
  critical: "bg-red-50 border-red-200",
  high:     "bg-amber-50 border-amber-200",
  medium:   "bg-yellow-50 border-yellow-200",
  low:      "bg-slate-50 border-slate-200",
};

const SEV_ACCENT: Record<string, string> = {
  critical: "bg-red-500",
  high:     "bg-amber-400",
  medium:   "bg-yellow-400",
  low:      "bg-slate-300",
};

function formatM(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

function timeAgo(s: string): string {
  const diff = Date.now() - new Date(s).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return "just now";
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

export default function ExecutiveBrief() {
  const qc = useQueryClient();

  const { data: briefing, isLoading } = useQuery<Briefing>({
    queryKey: ["executive-briefing"],
    queryFn: async () => { const r = await fetch("/api/intelligence/briefing"); return r.json(); },
  });

  const { data: exposure } = useQuery<Exposure>({
    queryKey: ["financial-exposure"],
    queryFn: async () => { const r = await fetch("/api/intelligence/financial-exposure"); return r.json(); },
  });

  const refresh = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/intelligence/briefing/refresh", { method: "POST" });
      return r.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["executive-briefing"] }),
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 bg-muted animate-pulse rounded" />
        ))}
      </div>
    );
  }

  if (!briefing) return null;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-lg font-bold text-foreground">Executive Intelligence Brief</h1>
            <span className="text-xs text-muted-foreground border border-border px-2 py-0.5">
              Generated {timeAgo(briefing.generatedAt)}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">AI-derived situational analysis — computed from live control state, telemetry, and risk data</p>
        </div>
        <button
          onClick={() => refresh.mutate()}
          disabled={refresh.isPending}
          className="flex items-center gap-1.5 text-xs border border-border px-3 py-1.5 hover:bg-muted transition-colors text-muted-foreground hover:text-foreground shrink-0"
        >
          <RefreshCw className={cn("w-3 h-3", refresh.isPending && "animate-spin")} />
          {refresh.isPending ? "Generating..." : "Refresh"}
        </button>
      </div>

      {/* Headline card */}
      <div className="bg-card border border-border p-5 border-l-4 border-l-red-500">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-bold text-foreground leading-tight">{briefing.headline}</div>
            <div className="text-xs text-muted-foreground mt-2 leading-relaxed">{briefing.postureDelta}</div>
          </div>
        </div>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-12 gap-4">
        {/* Situation summary */}
        <div className="col-span-12 lg:col-span-8 space-y-4">

          {/* Situation */}
          <div className="bg-card border border-border p-5">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="w-4 h-4 text-primary" />
              <span className="text-sm font-bold text-foreground">Situation Summary</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">{briefing.situationSummary}</p>

            {briefing.frameworksAtRisk.length > 0 && (
              <div className="mt-3 pt-3 border-t border-border">
                <div className="text-xs font-semibold text-foreground mb-2">Frameworks at Risk</div>
                <div className="flex flex-wrap gap-1.5">
                  {briefing.frameworksAtRisk.map(f => (
                    <span key={f} className="text-xs font-semibold px-2 py-1 bg-amber-50 border border-amber-200 text-amber-700">{f}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Active threats */}
          <div className="bg-card border border-border p-5">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="w-4 h-4 text-red-500" />
              <span className="text-sm font-bold text-foreground">Active Threat Vectors</span>
              <span className="ml-auto text-xs text-muted-foreground">{briefing.topThreats.length} identified</span>
            </div>
            <div className="space-y-2">
              {briefing.topThreats.map((threat, i) => (
                <div key={i} className={cn("flex items-start gap-3 p-3 border", SEV_BG[threat.severity])}>
                  <div className={cn("w-[3px] self-stretch shrink-0", SEV_ACCENT[threat.severity])} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn("text-xs font-bold uppercase tracking-wide", SEV_COLOR[threat.severity])}>{threat.severity}</span>
                      <span className="text-sm font-semibold text-foreground">{threat.title}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">{threat.context}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recommended actions */}
          <div className="bg-card border border-border p-5">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle2 className="w-4 h-4 text-primary" />
              <span className="text-sm font-bold text-foreground">Recommended Board Actions</span>
            </div>
            <div className="space-y-2">
              {briefing.recommendedActions.map((action, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center text-[10px] font-bold text-primary shrink-0 mt-0.5">
                    {i + 1}
                  </div>
                  <div className="text-sm text-foreground">{action}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right column — financial + confidence */}
        <div className="col-span-12 lg:col-span-4 space-y-4">

          {/* Financial exposure */}
          <div className="bg-card border border-border p-5">
            <div className="flex items-center gap-2 mb-4">
              <DollarSign className="w-4 h-4 text-red-500" />
              <span className="text-sm font-bold text-foreground">Financial Exposure</span>
            </div>
            <div className="text-center py-2">
              <div className="text-xs text-muted-foreground mb-1">Estimated Range</div>
              <div className="font-mono text-2xl font-bold text-red-600">
                {formatM(exposure?.exposureLow ?? briefing.financialExposureLow)}
              </div>
              <div className="text-xs text-muted-foreground my-1">to</div>
              <div className="font-mono text-3xl font-bold text-red-700">
                {formatM(exposure?.exposureHigh ?? briefing.financialExposureHigh)}
              </div>
              <div className="text-[10px] text-muted-foreground mt-2 uppercase tracking-wider">{exposure?.methodology ?? "FAIR-lite"} methodology</div>
            </div>
            <div className="border-t border-border pt-3 mt-3 text-xs text-muted-foreground text-center leading-relaxed">
              Based on open risk severity × exploitability × asset blast radius. Excludes regulatory fines and reputational impact.
            </div>
          </div>

          {/* Data confidence */}
          <div className="bg-card border border-border p-5">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              <span className="text-sm font-bold text-foreground">Briefing Confidence</span>
            </div>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-muted-foreground">Analysis confidence</span>
                  <span className="font-mono font-bold text-foreground">{Math.round(briefing.confidenceScore * 100)}%</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.round(briefing.confidenceScore * 100)}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-muted-foreground">Data freshness</span>
                  <span className="font-mono font-bold text-foreground">{Math.round(briefing.dataFreshnessScore * 100)}%</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.round(briefing.dataFreshnessScore * 100)}%` }} />
                </div>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-border">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" />
                Last computed: {timeAgo(briefing.generatedAt)}
              </div>
              <div className="text-xs text-muted-foreground mt-1">Auto-refreshes every 5 minutes when data changes</div>
            </div>
          </div>

          {/* Quick stats */}
          <div className="bg-card border border-border p-5">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Signal Sources</div>
            <div className="space-y-2 text-xs">
              {[
                { label: "Control states",    note: "UCO validation engine" },
                { label: "Open findings",     note: "SLA breach detection"  },
                { label: "Risk scores",       note: "Attack-path engine"    },
                { label: "Framework status",  note: "Compliance mapping"    },
                { label: "Evidence freshness",note: "Telemetry fabric"      },
              ].map(s => (
                <div key={s.label} className="flex items-center justify-between">
                  <span className="text-foreground font-medium">{s.label}</span>
                  <span className="text-muted-foreground">{s.note}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

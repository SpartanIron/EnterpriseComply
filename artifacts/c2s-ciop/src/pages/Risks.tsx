import { useListRisks, useListAttackPaths, useGetExposureSummary } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { AlertTriangle, Target, Zap, ArrowRight } from "lucide-react";

const SEV_COLORS: Record<string, string> = {
  critical: "text-red-500 border-red-500/40 bg-red-500/5",
  high: "text-amber-500 border-amber-500/40 bg-amber-500/5",
  medium: "text-yellow-500 border-yellow-500/40 bg-yellow-500/5",
  low: "text-blue-400 border-blue-400/40 bg-blue-400/5",
};

const SEV_BAR_COLORS: Record<string, string> = {
  critical: "bg-red-500",
  high: "bg-amber-500",
  medium: "bg-yellow-500",
  low: "bg-blue-400",
};

export default function Risks() {
  const risks = useListRisks();
  const attackPaths = useListAttackPaths();
  const exposure = useGetExposureSummary();
  const e = exposure.data;

  return (
    <div data-testid="risks-page">
      {/* Exposure strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-px bg-border mb-px">
        {[
          { label: "Total Risk Score", value: e?.totalRiskScore?.toFixed(0) ?? "—", color: "text-red-500" },
          { label: "Critical Risks", value: e?.criticalRisks ?? "—", color: "text-red-500" },
          { label: "High Risks", value: e?.highRisks ?? "—", color: "text-amber-500" },
          { label: "Priv Escalation Paths", value: e?.privilegeEscalationPaths ?? "—", color: "text-orange-500" },
          { label: "Lateral Move Paths", value: e?.lateralMovementPaths ?? "—", color: "text-yellow-500" },
          { label: "Identity Risk", value: e ? `${e.identityRisk.toFixed(0)}%` : "—", color: "text-red-500" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-background p-3">
            <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground">{label}</div>
            <div className={cn("text-2xl font-mono font-bold mt-1", color)}>{exposure.isLoading ? <Skeleton className="h-7 w-12" /> : value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-12 gap-px bg-border">
        {/* Risk Registry */}
        <div className="col-span-12 lg:col-span-7 bg-background p-4" data-testid="risk-registry">
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-3">Risk Registry — Ordered by Score</div>
          {risks.isLoading ? (
            <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
          ) : (
            <div className="space-y-px">
              {(risks.data?.risks ?? []).map((r) => (
                <div key={r.id} className="border border-border p-3 hover:bg-muted/20 transition-colors" data-testid={`risk-item-${r.id}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 overflow-hidden">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={cn("text-[9px] font-mono uppercase tracking-widest border px-1.5 py-0.5 shrink-0", SEV_COLORS[r.severity])}>
                          {r.severity}
                        </span>
                        <span className="text-[10px] font-mono font-bold text-foreground truncate">{r.title}</span>
                      </div>
                      <div className="text-[9px] font-mono text-muted-foreground mb-2 line-clamp-2">{r.description}</div>
                      <div className="flex flex-wrap gap-1">
                        {r.attackVectors.map((v) => (
                          <span key={v} className="text-[8px] font-mono border border-orange-500/30 text-orange-500 px-1 py-0.5 uppercase tracking-wider">{v}</span>
                        ))}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-[9px] font-mono text-muted-foreground">Score</div>
                      <div className={cn("text-xl font-mono font-bold", SEV_COLORS[r.severity]?.split(" ")[0])}>{r.score.toFixed(0)}</div>
                      <div className="text-[9px] font-mono text-muted-foreground mt-1">Blast: {r.blastRadius}</div>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1 h-0.5 bg-muted">
                      <div className={cn("h-full", SEV_BAR_COLORS[r.severity])} style={{ width: `${r.exploitability * 100}%` }} />
                    </div>
                    <span className="text-[9px] font-mono text-muted-foreground">Exploitability {(r.exploitability * 100).toFixed(0)}%</span>
                  </div>
                  {r.threatIntelligence && (
                    <div className="mt-1.5 flex items-center gap-1.5 text-[9px] font-mono text-red-400">
                      <Zap className="w-3 h-3" />
                      {r.threatIntelligence}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Attack Paths */}
        <div className="col-span-12 lg:col-span-5 bg-background p-4" data-testid="attack-paths">
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-3">Active Attack Paths</div>
          {attackPaths.isLoading ? (
            <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}</div>
          ) : (
            <div className="space-y-px">
              {(attackPaths.data ?? []).map((ap) => (
                <div key={ap.id} className="border border-border p-3 hover:bg-muted/20 transition-colors" data-testid={`attack-path-${ap.id}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className={cn("text-[9px] font-mono uppercase tracking-widest border px-1.5 py-0.5", SEV_COLORS[ap.severity])}>
                      {ap.severity}
                    </span>
                    <div className="flex gap-3 text-[9px] font-mono">
                      <span className="text-muted-foreground">Likelihood <span className="text-foreground font-bold">{(ap.likelihood * 100).toFixed(0)}%</span></span>
                      <span className="text-muted-foreground">Impact <span className="text-red-500 font-bold">{(ap.impact * 100).toFixed(0)}%</span></span>
                    </div>
                  </div>
                  <div className="text-[11px] font-mono font-bold text-foreground mb-2">{ap.name}</div>
                  <div className="flex flex-col gap-1">
                    {ap.steps.map((step, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <div className="text-[9px] font-mono text-muted-foreground w-3 shrink-0 mt-0.5">{i + 1}.</div>
                        <div className="text-[9px] font-mono text-muted-foreground">{step}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 pt-2 border-t border-border/40 flex items-center justify-between text-[9px] font-mono">
                    <span className="text-muted-foreground flex items-center gap-1"><Target className="w-3 h-3" />{ap.entryPoint}</span>
                    <ArrowRight className="w-3 h-3 text-muted-foreground" />
                    <span className="text-red-500 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{ap.targetAsset}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

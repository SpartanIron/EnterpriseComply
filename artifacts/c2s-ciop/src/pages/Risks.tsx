import { useListRisks, useListAttackPaths, useGetExposureSummary } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { AlertTriangle, Target, Zap, ArrowRight, TrendingUp } from "lucide-react";

const SEV_BADGE: Record<string, string> = {
  critical: "bg-red-100 text-red-700 ring-1 ring-inset ring-red-200",
  high: "bg-amber-100 text-amber-700 ring-1 ring-inset ring-amber-200",
  medium: "bg-yellow-100 text-yellow-700 ring-1 ring-inset ring-yellow-200",
  low: "bg-blue-100 text-blue-700 ring-1 ring-inset ring-blue-200",
};

const SEV_SCORE: Record<string, string> = {
  critical: "text-red-600",
  high: "text-amber-600",
  medium: "text-yellow-600",
  low: "text-blue-600",
};

const SEV_BAR: Record<string, string> = {
  critical: "bg-red-500",
  high: "bg-amber-500",
  medium: "bg-yellow-500",
  low: "bg-blue-500",
};

function SevBadge({ sev }: { sev: string }) {
  return (
    <span className={cn("inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide", SEV_BADGE[sev] ?? "bg-slate-100 text-slate-600")}>
      {sev}
    </span>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{children}</div>;
}

export default function Risks() {
  const risks = useListRisks();
  const attackPaths = useListAttackPaths();
  const exposure = useGetExposureSummary();
  const e = exposure.data;

  return (
    <div data-testid="risks-page" className="space-y-4">
      {/* Exposure strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "Total Risk Score", value: e?.totalRiskScore?.toFixed(0) ?? "—", color: "text-red-600" },
          { label: "Critical Risks", value: e?.criticalRisks ?? "—", color: "text-red-600" },
          { label: "High Risks", value: e?.highRisks ?? "—", color: "text-amber-600" },
          { label: "Priv. Escalation", value: e?.privilegeEscalationPaths ?? "—", color: "text-orange-600" },
          { label: "Lateral Movement", value: e?.lateralMovementPaths ?? "—", color: "text-yellow-600" },
          { label: "Identity Risk", value: e ? `${e.identityRisk.toFixed(0)}%` : "—", color: "text-red-600" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-card border border-border rounded-lg p-4 shadow-xs">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">{label}</div>
            {exposure.isLoading ? <Skeleton className="h-8 w-12" /> : <div className={cn("text-3xl font-mono font-bold", color)}>{value}</div>}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* Risk Registry */}
        <div className="col-span-12 lg:col-span-7 bg-card border border-border rounded-lg shadow-xs overflow-hidden" data-testid="risk-registry">
          <div className="px-5 py-4 border-b border-border">
            <SectionLabel>Risk Registry — Ordered by Score</SectionLabel>
          </div>
          {risks.isLoading ? (
            <div className="p-5 space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
          ) : (
            <div className="divide-y divide-border">
              {(risks.data?.risks ?? []).map((r) => (
                <div key={r.id} className="p-4 hover:bg-muted/20 transition-colors" data-testid={`risk-item-${r.id}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 overflow-hidden">
                      <div className="flex items-center gap-2 mb-1.5">
                        <SevBadge sev={r.severity} />
                        <span className="text-sm font-semibold text-foreground truncate">{r.title}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mb-2 line-clamp-2 leading-relaxed">{r.description}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {r.attackVectors.map((v) => (
                          <span key={v} className="rounded bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-200 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide">{v}</span>
                        ))}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-0.5">Score</div>
                      <div className={cn("text-2xl font-mono font-bold", SEV_SCORE[r.severity])}>{r.score.toFixed(0)}</div>
                      <div className="text-[10px] text-muted-foreground mt-1 font-medium">Blast radius: <span className="font-mono font-semibold text-foreground">{r.blastRadius}</span></div>
                    </div>
                  </div>
                  <div className="mt-2.5 flex items-center gap-2">
                    <div className="flex-1 h-1 bg-muted rounded-full">
                      <div className={cn("h-full rounded-full", SEV_BAR[r.severity])} style={{ width: `${r.exploitability * 100}%` }} />
                    </div>
                    <span className="text-[10px] font-medium text-muted-foreground">Exploitability <span className="font-mono font-semibold text-foreground">{(r.exploitability * 100).toFixed(0)}%</span></span>
                  </div>
                  {r.threatIntelligence && (
                    <div className="mt-2 inline-flex items-center gap-1.5 rounded bg-red-50 text-red-700 ring-1 ring-inset ring-red-200 px-2 py-1 text-[10px] font-semibold">
                      <Zap className="w-3 h-3" />{r.threatIntelligence}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Attack Paths */}
        <div className="col-span-12 lg:col-span-5 bg-card border border-border rounded-lg shadow-xs overflow-hidden" data-testid="attack-paths">
          <div className="px-5 py-4 border-b border-border">
            <SectionLabel>Active Attack Paths</SectionLabel>
          </div>
          {attackPaths.isLoading ? (
            <div className="p-5 space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}</div>
          ) : (
            <div className="divide-y divide-border">
              {(attackPaths.data ?? []).map((ap) => (
                <div key={ap.id} className="p-4 hover:bg-muted/20 transition-colors" data-testid={`attack-path-${ap.id}`}>
                  <div className="flex items-center justify-between mb-2">
                    <SevBadge sev={ap.severity} />
                    <div className="flex gap-4 text-[11px] font-medium text-muted-foreground">
                      <span>Likelihood <span className="font-mono font-semibold text-foreground">{(ap.likelihood * 100).toFixed(0)}%</span></span>
                      <span>Impact <span className={cn("font-mono font-semibold", ap.impact >= 0.9 ? "text-red-600" : "text-amber-600")}>{(ap.impact * 100).toFixed(0)}%</span></span>
                    </div>
                  </div>
                  <div className="text-sm font-semibold text-foreground mb-2">{ap.name}</div>
                  <ol className="space-y-1 mb-3">
                    {ap.steps.map((step, i) => (
                      <li key={i} className="flex items-start gap-2 text-[11px] text-muted-foreground">
                        <span className="shrink-0 w-4 h-4 rounded-full bg-slate-100 flex items-center justify-center text-[9px] font-bold text-slate-500 mt-0.5">{i + 1}</span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                  <div className="flex items-center gap-2 pt-2 border-t border-border text-[11px]">
                    <div className="flex items-center gap-1 text-muted-foreground"><Target className="w-3 h-3" /><span className="font-medium">{ap.entryPoint}</span></div>
                    <ArrowRight className="w-3 h-3 text-muted-foreground mx-1" />
                    <div className="flex items-center gap-1 text-red-600"><AlertTriangle className="w-3 h-3" /><span className="font-semibold">{ap.targetAsset}</span></div>
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

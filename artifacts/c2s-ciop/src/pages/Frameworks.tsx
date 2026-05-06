import { useListFrameworks, useGetComplianceOverview } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus, CheckCircle, AlertCircle, XCircle, HelpCircle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

const STATUS_CONFIG: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  compliant: { icon: <CheckCircle className="w-3 h-3" />, color: "text-green-500", label: "Compliant" },
  partial: { icon: <AlertCircle className="w-3 h-3" />, color: "text-amber-500", label: "Partial" },
  non_compliant: { icon: <XCircle className="w-3 h-3" />, color: "text-red-500", label: "Non-Compliant" },
  not_assessed: { icon: <HelpCircle className="w-3 h-3" />, color: "text-muted-foreground", label: "Not Assessed" },
};

const TYPE_COLORS: Record<string, string> = {
  federal: "text-blue-400 border-blue-400/30 bg-blue-400/5",
  commercial: "text-green-500 border-green-500/30 bg-green-500/5",
  international: "text-purple-400 border-purple-400/30 bg-purple-400/5",
  industry: "text-amber-500 border-amber-500/30 bg-amber-500/5",
};

export default function Frameworks() {
  const frameworks = useListFrameworks();
  const overview = useGetComplianceOverview();

  const chartData = (overview.data ?? [])
    .filter((f) => f.score > 0)
    .sort((a, b) => b.score - a.score);

  return (
    <div data-testid="frameworks-page">
      {/* Chart */}
      <div className="bg-background p-4 mb-px border-b border-border">
        <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-3">Compliance Score — Active Frameworks</div>
        {overview.isLoading ? (
          <Skeleton className="h-36 w-full" />
        ) : (
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={chartData} barSize={28}>
              <XAxis dataKey="shortName" tick={{ fontSize: 9, fontFamily: "JetBrains Mono", fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 9, fontFamily: "JetBrains Mono", fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} width={24} />
              <Tooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 0, fontSize: 10, fontFamily: "JetBrains Mono" }}
                formatter={(val: number) => [`${val.toFixed(1)}%`, "Score"]}
              />
              <Bar dataKey="score" radius={0}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry.score >= 85 ? "#22c55e" : entry.score >= 70 ? "#f59e0b" : "#ef4444"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Framework cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-px bg-border" data-testid="framework-grid">
        {frameworks.isLoading
          ? Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="bg-background p-4"><Skeleton className="h-24 w-full" /></div>
            ))
          : (frameworks.data ?? []).map((f) => {
              const sc = STATUS_CONFIG[f.status] ?? STATUS_CONFIG.not_assessed;
              const ov = overview.data?.find((o) => o.frameworkId === f.id);
              const passing = Math.round(f.controlCount * (f.complianceScore / 100));
              return (
                <div
                  key={f.id}
                  className={cn("bg-background p-4 border hover:bg-muted/10 transition-colors", f.active ? "border-border" : "border-border/40 opacity-60")}
                  data-testid={`framework-card-${f.id}`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="text-[11px] font-mono font-bold text-foreground">{f.shortName}</div>
                      <div className="text-[9px] font-mono text-muted-foreground mt-0.5">{f.version}</div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {ov?.trend === "up" ? <TrendingUp className="w-3 h-3 text-green-500" /> : ov?.trend === "down" ? <TrendingDown className="w-3 h-3 text-red-500" /> : <Minus className="w-3 h-3 text-muted-foreground" />}
                      <span className={cn("text-[9px] font-mono uppercase tracking-wider border px-1.5 py-0.5", TYPE_COLORS[f.type] ?? "")}>
                        {f.type}
                      </span>
                    </div>
                  </div>
                  <div className="text-[9px] font-mono text-muted-foreground mb-3 truncate" title={f.name}>{f.name}</div>

                  {f.active && f.complianceScore > 0 ? (
                    <>
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className="flex-1 h-1 bg-muted">
                          <div
                            className={cn("h-full", f.complianceScore >= 85 ? "bg-green-500" : f.complianceScore >= 70 ? "bg-amber-500" : "bg-red-500")}
                            style={{ width: `${f.complianceScore}%` }}
                          />
                        </div>
                        <span className={cn("text-sm font-mono font-bold w-10 text-right", f.complianceScore >= 85 ? "text-green-500" : f.complianceScore >= 70 ? "text-amber-500" : "text-red-500")}>
                          {f.complianceScore.toFixed(0)}%
                        </span>
                      </div>
                      <div className="flex justify-between text-[9px] font-mono text-muted-foreground">
                        <span>{passing} / {f.controlCount} controls passing</span>
                        <span className={cn("flex items-center gap-1", sc.color)}>{sc.icon}{sc.label}</span>
                      </div>
                    </>
                  ) : (
                    <div className={cn("text-[9px] font-mono flex items-center gap-1", sc.color)}>
                      {sc.icon}<span>{f.active ? "Initializing..." : "Inactive — Not Assessed"}</span>
                    </div>
                  )}
                </div>
              );
            })}
      </div>
    </div>
  );
}

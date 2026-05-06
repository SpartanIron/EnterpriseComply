import { useListFrameworks, useGetComplianceOverview } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus, CheckCircle, AlertCircle, XCircle, HelpCircle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

const STATUS_CONFIG: Record<string, { icon: React.ReactNode; badge: string; label: string }> = {
  compliant: { icon: <CheckCircle className="w-3.5 h-3.5" />, badge: "bg-green-100 text-green-700 ring-1 ring-inset ring-green-200", label: "Compliant" },
  partial: { icon: <AlertCircle className="w-3.5 h-3.5" />, badge: "bg-amber-100 text-amber-700 ring-1 ring-inset ring-amber-200", label: "Partial" },
  non_compliant: { icon: <XCircle className="w-3.5 h-3.5" />, badge: "bg-red-100 text-red-700 ring-1 ring-inset ring-red-200", label: "Non-Compliant" },
  not_assessed: { icon: <HelpCircle className="w-3.5 h-3.5" />, badge: "bg-slate-100 text-slate-500 ring-1 ring-inset ring-slate-200", label: "Not Assessed" },
};

const TYPE_BADGE: Record<string, string> = {
  federal: "bg-blue-100 text-blue-700 ring-1 ring-inset ring-blue-200",
  commercial: "bg-green-100 text-green-700 ring-1 ring-inset ring-green-200",
  international: "bg-purple-100 text-purple-700 ring-1 ring-inset ring-purple-200",
  industry: "bg-amber-100 text-amber-700 ring-1 ring-inset ring-amber-200",
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

export default function Frameworks() {
  const frameworks = useListFrameworks();
  const overview = useGetComplianceOverview();

  const chartData = (overview.data ?? [])
    .filter((f) => f.score > 0)
    .sort((a, b) => b.score - a.score);

  return (
    <div data-testid="frameworks-page" className="space-y-4">
      {/* Chart card */}
      <div className="bg-card border border-border rounded-lg p-5 shadow-xs">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Compliance Score — Active Frameworks</div>
        {overview.isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={chartData} barSize={32}>
              <XAxis dataKey="shortName" tick={{ fontSize: 10, fontFamily: "Inter, sans-serif", fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10, fontFamily: "Inter, sans-serif", fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} width={24} />
              <Tooltip {...TOOLTIP_STYLE} formatter={(val: number) => [`${val.toFixed(1)}%`, "Score"]} />
              <Bar dataKey="score" radius={[3, 3, 0, 0]}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry.score >= 85 ? "#22c55e" : entry.score >= 70 ? "#f59e0b" : "#ef4444"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Framework cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3" data-testid="framework-grid">
        {frameworks.isLoading
          ? Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="bg-card border border-border rounded-lg p-5 shadow-xs"><Skeleton className="h-24 w-full" /></div>
            ))
          : (frameworks.data ?? []).map((f) => {
              const sc = STATUS_CONFIG[f.status] ?? STATUS_CONFIG.not_assessed;
              const ov = overview.data?.find((o) => o.frameworkId === f.id);
              const passing = Math.round(f.controlCount * (f.complianceScore / 100));
              return (
                <div
                  key={f.id}
                  className={cn("bg-card border rounded-lg p-5 shadow-xs hover:shadow-sm transition-shadow", f.active ? "border-border" : "border-border opacity-55")}
                  data-testid={`framework-card-${f.id}`}
                >
                  <div className="flex items-start justify-between mb-1">
                    <div>
                      <div className="text-sm font-bold text-foreground">{f.shortName}</div>
                      <div className="text-[10px] text-muted-foreground font-medium mt-0.5">v{f.version}</div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {ov?.trend === "up" ? <TrendingUp className="w-3.5 h-3.5 text-green-500" /> : ov?.trend === "down" ? <TrendingDown className="w-3.5 h-3.5 text-red-500" /> : <Minus className="w-3.5 h-3.5 text-muted-foreground" />}
                      <span className={cn("inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide", TYPE_BADGE[f.type] ?? "")}>
                        {f.type}
                      </span>
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground mb-3 truncate" title={f.name}>{f.name}</p>

                  {f.active && f.complianceScore > 0 ? (
                    <>
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className="flex-1 h-1.5 bg-muted rounded-full">
                          <div
                            className={cn("h-full rounded-full", f.complianceScore >= 85 ? "bg-green-500" : f.complianceScore >= 70 ? "bg-amber-500" : "bg-red-500")}
                            style={{ width: `${f.complianceScore}%` }}
                          />
                        </div>
                        <span className={cn("text-sm font-mono font-bold w-10 text-right", f.complianceScore >= 85 ? "text-green-600" : f.complianceScore >= 70 ? "text-amber-600" : "text-red-600")}>
                          {f.complianceScore.toFixed(0)}%
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-muted-foreground font-medium"><span className="font-mono font-semibold text-foreground">{passing}</span> / <span className="font-mono">{f.controlCount}</span> controls passing</span>
                        <span className={cn("inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide", sc.badge)}>
                          {sc.icon}{sc.label}
                        </span>
                      </div>
                    </>
                  ) : (
                    <span className={cn("inline-flex items-center gap-1.5 rounded px-2 py-1 text-[10px] font-semibold", sc.badge)}>
                      {sc.icon}{f.active ? "Initializing..." : "Inactive — Not Assessed"}
                    </span>
                  )}
                </div>
              );
            })}
      </div>
    </div>
  );
}

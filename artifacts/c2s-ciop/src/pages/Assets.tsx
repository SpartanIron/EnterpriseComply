import { useState } from "react";
import { useListAssets, useGetAssetsSummary } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Crown, Globe, Server, Cloud, Monitor, User, Network, Package, Database } from "lucide-react";

const RISK_BADGE: Record<string, string> = {
  critical: "bg-red-100 text-red-700 ring-1 ring-inset ring-red-200",
  high:     "bg-amber-100 text-amber-700 ring-1 ring-inset ring-amber-200",
  medium:   "bg-yellow-100 text-yellow-700 ring-1 ring-inset ring-yellow-200",
  low:      "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200",
};

const RISK_ACCENT: Record<string, string> = {
  critical: "#ef4444",
  high:     "#f59e0b",
  medium:   "#eab308",
  low:      "#cbd5e1",
};

const TYPE_ICONS: Record<string, React.ReactNode> = {
  server:    <Server className="w-3.5 h-3.5" />,
  cloud:     <Cloud className="w-3.5 h-3.5" />,
  endpoint:  <Monitor className="w-3.5 h-3.5" />,
  identity:  <User className="w-3.5 h-3.5" />,
  network:   <Network className="w-3.5 h-3.5" />,
  container: <Package className="w-3.5 h-3.5" />,
  database:  <Database className="w-3.5 h-3.5" />,
};

const ENV_COLORS: Record<string, string> = {
  production:  "text-foreground font-semibold",
  staging:     "text-amber-600 font-medium",
  development: "text-muted-foreground",
  air_gapped:  "text-blue-600 font-medium",
};

function SummaryTile({ label, value, color, loading }: { label: string; value: number; color: string; loading: boolean }) {
  return (
    <div className="bg-card border border-border rounded-lg p-4 shadow-xs">
      <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">{label}</div>
      {loading ? <Skeleton className="h-8 w-10" /> : <div className={cn("text-3xl font-mono font-bold", color)}>{value}</div>}
    </div>
  );
}

export default function Assets() {
  const [filterRisk, setFilterRisk] = useState("");
  const summary = useGetAssetsSummary();
  const assets  = useListAssets(filterRisk ? { risk_level: filterRisk as any } : {});
  const s = summary.data;

  return (
    <div data-testid="assets-page" className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {[
          { label: "Total Assets",     value: s?.total ?? 0,              color: "text-foreground" },
          { label: "Critical Risk",    value: s?.byRisk?.critical ?? 0,   color: "text-red-600" },
          { label: "High Risk",        value: s?.byRisk?.high ?? 0,       color: "text-amber-600" },
          { label: "Crown Jewels",     value: s?.crownJewels ?? 0,        color: "text-yellow-500" },
          { label: "Internet Exposed", value: s?.internetExposed ?? 0,    color: "text-orange-600" },
          { label: "Cloud Assets",     value: s?.byType?.cloud ?? 0,      color: "text-blue-600" },
          { label: "Unmanaged",        value: s?.unmanaged ?? 0,          color: "text-slate-500" },
        ].map((t) => <SummaryTile key={t.label} {...t} loading={summary.isLoading} />)}
      </div>

      <div className="bg-card border border-border rounded-lg shadow-xs overflow-hidden">
        {/* Filter tabs */}
        <div className="flex items-center border-b border-border overflow-x-auto" data-testid="asset-filter-bar">
          {["", "critical", "high", "medium", "low"].map((r) => (
            <button key={r || "all"} data-testid={`asset-filter-${r || "all"}`}
              onClick={() => setFilterRisk(r)}
              className={cn(
                "px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide whitespace-nowrap border-r border-border transition-colors",
                filterRisk === r ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >{r || "All Assets"}</button>
          ))}
        </div>

        <div className="overflow-x-auto">
          {assets.isLoading ? (
            <div className="p-5 space-y-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-11 w-full" />)}</div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/40 border-b border-border">
                  <th className="w-[3px] p-0" aria-hidden />
                  {["Asset", "Type", "Risk Level", "Risk Score", "Exposure", "CVEs", "Control Cov.", "Environment", "Flags"].map((h) => (
                    <th key={h} className="text-left text-muted-foreground font-bold uppercase tracking-wide py-2.5 px-4 whitespace-nowrap text-[10px]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(assets.data?.assets ?? []).map((a) => (
                  <tr key={a.id} className="hover:bg-muted/20 transition-colors" data-testid={`asset-row-${a.id}`}>
                    <td className="p-0 w-[3px]" style={{ backgroundColor: RISK_ACCENT[a.riskLevel] ?? "#cbd5e1" }} aria-hidden />
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">{TYPE_ICONS[a.type]}</span>
                        <div>
                          <div className="font-semibold text-foreground">{a.name}</div>
                          <div className="text-[10px] text-muted-foreground">{a.owner}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground font-medium capitalize">{a.type}</td>
                    <td className="py-3 px-4">
                      <span className={cn("inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide", RISK_BADGE[a.riskLevel] ?? "")}>
                        {a.riskLevel}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className={cn("h-full rounded-full", a.riskScore >= 80 ? "bg-red-500" : a.riskScore >= 60 ? "bg-amber-500" : a.riskScore >= 40 ? "bg-yellow-500" : "bg-green-500")}
                            style={{ width: `${a.riskScore}%` }} />
                        </div>
                        <span className="font-mono font-bold text-foreground">{a.riskScore.toFixed(0)}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className={cn("font-mono font-bold", a.exposureScore >= 70 ? "text-red-600" : a.exposureScore >= 50 ? "text-amber-600" : "text-foreground")}>
                        {a.exposureScore.toFixed(0)}%
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={cn("font-mono font-bold", a.vulnerabilityCount > 15 ? "text-red-600" : a.vulnerabilityCount > 5 ? "text-amber-600" : "text-foreground")}>
                        {a.vulnerabilityCount}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className={cn("h-full rounded-full", a.controlCoverage >= 80 ? "bg-green-500" : a.controlCoverage >= 60 ? "bg-amber-500" : "bg-red-500")}
                            style={{ width: `${a.controlCoverage}%` }} />
                        </div>
                        <span className="font-mono font-bold text-foreground">{a.controlCoverage.toFixed(0)}%</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className={ENV_COLORS[a.environment] ?? "text-muted-foreground"}>
                        {a.environment.replace("_", " ")}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        {a.crownJewel && (
                          <span className="inline-flex items-center gap-1 rounded bg-yellow-100 text-yellow-700 ring-1 ring-inset ring-yellow-200 px-1.5 py-0.5 text-[9px] font-bold">
                            <Crown className="w-2.5 h-2.5" />CJ
                          </span>
                        )}
                        {a.internetExposed && (
                          <span className="inline-flex items-center gap-1 rounded bg-orange-100 text-orange-700 ring-1 ring-inset ring-orange-200 px-1.5 py-0.5 text-[9px] font-bold">
                            <Globe className="w-2.5 h-2.5" />Exp
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

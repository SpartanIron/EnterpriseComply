import { useState } from "react";
import { useListAssets, useGetAssetsSummary } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Crown, Globe, Server, Cloud, Monitor, User, Network, Package, Database } from "lucide-react";

const RISK_COLORS: Record<string, string> = {
  critical: "text-red-500 border-red-500/40 bg-red-500/5",
  high: "text-amber-500 border-amber-500/40 bg-amber-500/5",
  medium: "text-yellow-500 border-yellow-500/40 bg-yellow-500/5",
  low: "text-blue-400 border-blue-400/40 bg-blue-400/5",
};

const TYPE_ICONS: Record<string, React.ReactNode> = {
  server: <Server className="w-3 h-3" />,
  cloud: <Cloud className="w-3 h-3" />,
  endpoint: <Monitor className="w-3 h-3" />,
  identity: <User className="w-3 h-3" />,
  network: <Network className="w-3 h-3" />,
  container: <Package className="w-3 h-3" />,
  database: <Database className="w-3 h-3" />,
};

const ENV_COLORS: Record<string, string> = {
  production: "text-foreground",
  staging: "text-amber-500",
  development: "text-muted-foreground",
  air_gapped: "text-blue-400",
};

export default function Assets() {
  const [filterRisk, setFilterRisk] = useState("");
  const summary = useGetAssetsSummary();
  const assets = useListAssets(filterRisk ? { risk_level: filterRisk as any } : {});
  const s = summary.data;

  return (
    <div data-testid="assets-page">
      {/* Summary strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-px bg-border mb-px">
        {[
          { label: "Total Assets", value: s?.total ?? 0, color: "text-foreground" },
          { label: "Critical Risk", value: s?.byRisk?.critical ?? 0, color: "text-red-500" },
          { label: "High Risk", value: s?.byRisk?.high ?? 0, color: "text-amber-500" },
          { label: "Crown Jewels", value: s?.crownJewels ?? 0, color: "text-yellow-400" },
          { label: "Internet Exposed", value: s?.internetExposed ?? 0, color: "text-orange-500" },
          { label: "Cloud Assets", value: s?.byType?.cloud ?? 0, color: "text-blue-400" },
          { label: "Unmanaged", value: s?.unmanaged ?? 0, color: "text-muted-foreground" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-background p-3">
            <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground">{label}</div>
            <div className={cn("text-2xl font-mono font-bold mt-1", color)}>{summary.isLoading ? <Skeleton className="h-7 w-8" /> : value}</div>
          </div>
        ))}
      </div>

      {/* Risk filter */}
      <div className="bg-background border-b border-border flex items-center overflow-x-auto mb-px" data-testid="asset-filter-bar">
        {["", "critical", "high", "medium", "low"].map((r) => (
          <button
            key={r || "all"}
            data-testid={`asset-filter-${r || "all"}`}
            onClick={() => setFilterRisk(r)}
            className={cn(
              "px-4 py-2 text-[10px] font-mono uppercase tracking-widest whitespace-nowrap border-r border-border transition-colors",
              filterRisk === r ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            {r || "All Assets"}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-background overflow-x-auto">
        {assets.isLoading ? (
          <div className="p-4 space-y-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : (
          <table className="w-full text-[10px] font-mono">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {["Asset", "Type", "Risk Level", "Risk Score", "Exposure", "CVEs", "Control Cov.", "Environment", "Flags"].map((h) => (
                  <th key={h} className="text-left text-muted-foreground uppercase tracking-widest py-2.5 px-3 font-normal whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(assets.data?.assets ?? []).map((a) => (
                <tr key={a.id} className="border-b border-border/40 hover:bg-muted/20 transition-colors" data-testid={`asset-row-${a.id}`}>
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-1.5">
                      <span className="text-muted-foreground">{TYPE_ICONS[a.type]}</span>
                      <span className="text-foreground font-bold">{a.name}</span>
                    </div>
                    <div className="text-[9px] text-muted-foreground mt-0.5">{a.owner}</div>
                  </td>
                  <td className="py-2.5 px-3 text-muted-foreground capitalize">{a.type}</td>
                  <td className="py-2.5 px-3">
                    <span className={cn("border text-[9px] uppercase tracking-widest px-1.5 py-0.5", RISK_COLORS[a.riskLevel] ?? "")}>
                      {a.riskLevel}
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-2">
                      <div className="w-12 h-1 bg-muted">
                        <div
                          className={cn("h-full", a.riskScore >= 80 ? "bg-red-500" : a.riskScore >= 60 ? "bg-amber-500" : a.riskScore >= 40 ? "bg-yellow-500" : "bg-green-500")}
                          style={{ width: `${a.riskScore}%` }}
                        />
                      </div>
                      <span className="font-bold">{a.riskScore.toFixed(0)}</span>
                    </div>
                  </td>
                  <td className="py-2.5 px-3">
                    <span className={cn("font-bold", a.exposureScore >= 70 ? "text-red-500" : a.exposureScore >= 50 ? "text-amber-500" : "text-foreground")}>
                      {a.exposureScore.toFixed(0)}%
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    <span className={cn("font-bold", a.vulnerabilityCount > 15 ? "text-red-500" : a.vulnerabilityCount > 5 ? "text-amber-500" : "text-foreground")}>
                      {a.vulnerabilityCount}
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-2">
                      <div className="w-12 h-1 bg-muted">
                        <div
                          className={cn("h-full", a.controlCoverage >= 80 ? "bg-green-500" : a.controlCoverage >= 60 ? "bg-amber-500" : "bg-red-500")}
                          style={{ width: `${a.controlCoverage}%` }}
                        />
                      </div>
                      <span>{a.controlCoverage.toFixed(0)}%</span>
                    </div>
                  </td>
                  <td className="py-2.5 px-3">
                    <span className={ENV_COLORS[a.environment] ?? "text-muted-foreground"}>{a.environment.replace("_", " ")}</span>
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-1.5">
                      {a.crownJewel && <Crown className="w-3 h-3 text-yellow-400" title="Crown Jewel" />}
                      {a.internetExposed && <Globe className="w-3 h-3 text-orange-500" title="Internet Exposed" />}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

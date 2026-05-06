import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { AlertTriangle, Clock, CheckCircle2, XCircle, MinusCircle, PlusCircle, ChevronDown, ChevronRight } from "lucide-react";

const FRAMEWORKS = [
  { key: "all",         label: "All Frameworks" },
  { key: "fedramp",     label: "FedRAMP"        },
  { key: "cmmc",        label: "CMMC"           },
  { key: "nist-800-53", label: "NIST 800-53"    },
];

const STATUS_OPTIONS = [
  { value: "all",       label: "All Status"  },
  { value: "open",      label: "Open"        },
  { value: "on_track",  label: "On Track"    },
  { value: "delayed",   label: "Delayed"     },
  { value: "closed",    label: "Closed"      },
  { value: "accepted",  label: "Accepted"    },
];

type PoamStatus = "open" | "on_track" | "delayed" | "closed" | "accepted";

interface PoamItem {
  id: string;
  frameworkKey: string;
  controlId: string;
  title: string;
  weakness: string;
  description: string;
  severity: string;
  status: PoamStatus;
  ownerName: string;
  ownerTeam: string;
  scheduledCompletionDate: string | null;
  milestones: string[];
  originalRisk: string;
  residualRisk: string;
  estimatedCost: number | null;
  createdAt: string;
  closedAt: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; icon: typeof CheckCircle2 }> = {
  open:     { label: "Open",     color: "text-red-700",     bg: "bg-red-50",     border: "border-red-200",   icon: AlertTriangle  },
  on_track: { label: "On Track", color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200", icon: CheckCircle2 },
  delayed:  { label: "Delayed",  color: "text-amber-700",   bg: "bg-amber-50",   border: "border-amber-200",   icon: Clock        },
  closed:   { label: "Closed",   color: "text-slate-600",   bg: "bg-slate-50",   border: "border-slate-200",   icon: CheckCircle2 },
  accepted: { label: "Accepted", color: "text-blue-700",    bg: "bg-blue-50",    border: "border-blue-200",    icon: MinusCircle  },
};

const SEV_ACCENT: Record<string, string> = {
  critical: "bg-red-500",
  high:     "bg-amber-400",
  medium:   "bg-yellow-400",
  low:      "bg-slate-300",
};

const SEV_COLOR: Record<string, string> = {
  critical: "text-red-700",
  high:     "text-amber-700",
  medium:   "text-yellow-700",
  low:      "text-slate-600",
};

function formatDate(s: string | null): string {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function daysUntil(s: string | null): number | null {
  if (!s) return null;
  return Math.ceil((new Date(s).getTime() - Date.now()) / 86400000);
}

export default function POAM() {
  const qc = useQueryClient();
  const [frameworkFilter, setFrameworkFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: items = [], isLoading } = useQuery<PoamItem[]>({
    queryKey: ["poam", frameworkFilter, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (frameworkFilter !== "all") params.set("frameworkKey", frameworkFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);
      const r = await fetch(`/api/poam?${params}`);
      return r.json();
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const r = await fetch(`/api/poam/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      return r.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["poam"] }),
  });

  const openCount    = items.filter(i => i.status === "open").length;
  const delayedCount = items.filter(i => i.status === "delayed").length;
  const onTrackCount = items.filter(i => i.status === "on_track").length;
  const closedCount  = items.filter(i => i.status === "closed" || i.status === "accepted").length;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-foreground">Plan of Action & Milestones</h1>
          <p className="text-xs text-muted-foreground mt-0.5">FedRAMP-compliant POA&amp;M — weakness tracking, milestone management, and residual risk</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden md:flex items-center gap-1.5 text-xs text-muted-foreground border border-border px-3 py-1.5 bg-card">
            <span className="w-2 h-2 bg-red-500 rounded-full inline-block" /> {openCount} Open
            <span className="mx-1 text-border">|</span>
            <span className="w-2 h-2 bg-amber-400 rounded-full inline-block" /> {delayedCount} Delayed
            <span className="mx-1 text-border">|</span>
            <span className="w-2 h-2 bg-emerald-500 rounded-full inline-block" /> {onTrackCount} On Track
            <span className="mx-1 text-border">|</span>
            <span className="w-2 h-2 bg-slate-300 rounded-full inline-block" /> {closedCount} Closed
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-6 items-center flex-wrap">
        <div className="flex gap-1">
          {FRAMEWORKS.map(f => (
            <button
              key={f.key}
              onClick={() => setFrameworkFilter(f.key)}
              className={cn(
                "px-3 py-1.5 text-xs font-semibold border transition-colors",
                frameworkFilter === f.key
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card border-border text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {STATUS_OPTIONS.map(s => (
            <button
              key={s.value}
              onClick={() => setStatusFilter(s.value)}
              className={cn(
                "px-3 py-1.5 text-xs font-semibold border transition-colors",
                statusFilter === s.value
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card border-border text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* POA&M Table */}
      <div className="border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="w-[3px] p-0" />
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Weakness / Control</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Framework</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Scheduled Completion</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden xl:table-cell">Owner</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden xl:table-cell">Risk</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-border">
                  <td className="p-0 w-[3px]"><div className="w-[3px] h-14 bg-muted animate-pulse" /></td>
                  <td colSpan={7} className="px-4 py-4"><div className="h-4 bg-muted animate-pulse rounded w-3/4" /></td>
                </tr>
              ))
            ) : items.map(item => {
              const cfg = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.open;
              const Icon = cfg.icon;
              const isExpanded = expandedId === item.id;
              const daysLeft = daysUntil(item.scheduledCompletionDate);
              const isOverdue = daysLeft !== null && daysLeft < 0;

              return (
                <React.Fragment key={item.id}>
                  <tr
                    className={cn(
                      "border-b border-border cursor-pointer hover:bg-muted/30 transition-colors",
                      item.status === "delayed" && "bg-amber-50/30",
                      item.status === "open" && isOverdue && "bg-red-50/30",
                    )}
                    onClick={() => setExpandedId(isExpanded ? null : item.id)}
                  >
                    <td className="p-0 w-[3px]">
                      <div className={cn("w-[3px] min-h-[56px] h-full", SEV_ACCENT[item.severity] ?? "bg-slate-300")} />
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-foreground text-sm leading-tight">{item.title}</div>
                      <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                        <span className={cn("font-semibold capitalize", SEV_COLOR[item.severity])}>{item.severity}</span>
                        <span className="text-border">·</span>
                        <span className="font-mono">{item.controlId}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 hidden md:table-cell">
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{item.frameworkKey.replace(/-/g, " ")}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={cn("inline-flex items-center gap-1.5 px-2 py-1 text-xs font-semibold border", cfg.color, cfg.bg, cfg.border)}>
                        <Icon className="w-3 h-3" />
                        {cfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 hidden lg:table-cell">
                      <div className={cn("text-xs font-mono font-semibold", isOverdue ? "text-red-600" : "text-foreground")}>
                        {formatDate(item.scheduledCompletionDate)}
                      </div>
                      {daysLeft !== null && (
                        <div className={cn("text-[10px] mt-0.5", isOverdue ? "text-red-600 font-semibold" : "text-muted-foreground")}>
                          {isOverdue ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d remaining`}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3.5 hidden xl:table-cell">
                      <div className="text-xs font-semibold text-foreground">{item.ownerName}</div>
                      <div className="text-[10px] text-muted-foreground">{item.ownerTeam}</div>
                    </td>
                    <td className="px-4 py-3.5 hidden xl:table-cell">
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1.5 text-[10px]">
                          <span className="text-muted-foreground">Orig:</span>
                          <span className={cn("font-semibold capitalize", SEV_COLOR[item.originalRisk])}>{item.originalRisk}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px]">
                          <span className="text-muted-foreground">Resid:</span>
                          <span className={cn("font-semibold capitalize", SEV_COLOR[item.residualRisk])}>{item.residualRisk}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3.5">
                      <ChevronRight className={cn("w-3 h-3 text-muted-foreground transition-transform", isExpanded && "rotate-90")} />
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className="border-b border-border bg-muted/20">
                      <td className="p-0 w-[3px]">
                        <div className={cn("w-[3px] h-full min-h-[100px]", SEV_ACCENT[item.severity] ?? "bg-slate-300")} />
                      </td>
                      <td colSpan={7} className="px-4 py-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <div className="md:col-span-2 space-y-3">
                            <div>
                              <div className="text-xs font-semibold text-foreground mb-1">Weakness Description</div>
                              <div className="text-xs text-muted-foreground">{item.weakness}</div>
                            </div>
                            <div>
                              <div className="text-xs font-semibold text-foreground mb-1">Remediation Detail</div>
                              <div className="text-xs text-muted-foreground">{item.description}</div>
                            </div>
                            {item.milestones.length > 0 && (
                              <div>
                                <div className="text-xs font-semibold text-foreground mb-1.5">Milestones</div>
                                <div className="space-y-1">
                                  {item.milestones.map((m, i) => (
                                    <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                                      <span className="text-primary font-mono shrink-0">{String(i + 1).padStart(2, "0")}.</span>
                                      <span>{m}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="space-y-4">
                            <div>
                              <div className="text-xs font-semibold text-foreground mb-2">Update Status</div>
                              <div className="flex flex-col gap-1">
                                {["open", "on_track", "delayed", "closed", "accepted"].map(s => (
                                  <button
                                    key={s}
                                    disabled={item.status === s}
                                    onClick={e => { e.stopPropagation(); updateStatus.mutate({ id: item.id, status: s }); }}
                                    className={cn(
                                      "text-left px-3 py-1.5 text-xs font-medium border transition-colors capitalize",
                                      item.status === s
                                        ? "bg-primary text-primary-foreground border-primary"
                                        : "border-border text-muted-foreground hover:text-foreground hover:bg-muted"
                                    )}
                                  >
                                    {s.replace("_", " ")}
                                  </button>
                                ))}
                              </div>
                            </div>
                            {item.estimatedCost && (
                              <div>
                                <div className="text-xs font-semibold text-foreground mb-1">Estimated Cost</div>
                                <div className="font-mono text-sm font-bold text-foreground">${item.estimatedCost.toLocaleString()}</div>
                              </div>
                            )}
                            {item.closedAt && (
                              <div>
                                <div className="text-xs font-semibold text-foreground mb-1">Closed</div>
                                <div className="text-xs text-muted-foreground">{formatDate(item.closedAt)}</div>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
            {!isLoading && items.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  No POA&amp;M items found. Change the filter or add a new item.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

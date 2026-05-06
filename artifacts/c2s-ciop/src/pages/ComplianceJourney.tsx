import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { CheckCircle2, Circle, Clock, AlertTriangle, Shield, ChevronRight, Target } from "lucide-react";

const PHASES = [
  { key: "scope",      label: "Scope",      sublabel: "Define boundary"      },
  { key: "gap",        label: "Gap",         sublabel: "Identify gaps"        },
  { key: "roadmap",    label: "Roadmap",     sublabel: "Prioritize work"      },
  { key: "validation", label: "Validate",    sublabel: "Verify controls"      },
  { key: "packaging",  label: "Package",     sublabel: "Build audit package"  },
  { key: "authorized", label: "Authorized",  sublabel: "ATO granted"          },
];

interface Journey {
  id: string;
  frameworkKey: string;
  targetLevel: string;
  phase: string;
  systemName: string;
  systemDescription: string;
  systemType: string;
  dataClassification: string;
  boundaryDescription: string | null;
  leveragedAto: string | null;
  targetAtoDate: string | null;
  startedAt: string;
}

interface Task {
  id: string;
  journeyId: string;
  controlId: string;
  frameworkKey: string;
  title: string;
  description: string;
  effort: string;
  priority: number;
  estimatedDays: number;
  assignee: string | null;
  team: string | null;
  status: string;
  dueDate: string | null;
  completedAt: string | null;
}

interface Readiness {
  journeyId: number;
  frameworkKey: string;
  readinessScore: number;
  totalTasks: number;
  completedTasks: number;
  blockers: Task[];
}

const FRAMEWORK_LABELS: Record<string, string> = {
  "fedramp":     "FedRAMP Moderate",
  "cmmc":        "CMMC Level 2",
  "nist-800-53": "NIST 800-53 Rev 5",
  "soc2":        "SOC 2 Type II",
  "iso-27001":   "ISO 27001:2022",
};

const EFFORT_COLOR: Record<string, string> = {
  low:    "text-emerald-600",
  medium: "text-amber-600",
  high:   "text-red-600",
};

const TASK_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  not_started: { label: "Not Started", color: "text-slate-600",   bg: "bg-slate-50",   border: "border-slate-200"   },
  in_progress: { label: "In Progress", color: "text-blue-700",    bg: "bg-blue-50",    border: "border-blue-200"    },
  complete:    { label: "Complete",    color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200" },
  blocked:     { label: "Blocked",     color: "text-red-700",     bg: "bg-red-50",     border: "border-red-200"     },
};

const SEV_ACCENT: Record<string, string> = {
  not_started: "bg-slate-300",
  in_progress: "bg-blue-500",
  complete:    "bg-emerald-500",
  blocked:     "bg-red-500",
};

function GaugeArc({ score }: { score: number }) {
  const pct = Math.min(Math.max(score, 0), 100) / 100;
  const cx = 90, cy = 90, r = 72;
  const angle = Math.PI - Math.PI * pct;
  const ex = cx + r * Math.cos(angle);
  const ey = cy - r * Math.sin(angle);
  const trackD = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;
  const fillD  = pct > 0 ? `M ${cx - r} ${cy} A ${r} ${r} 0 ${pct > 0.5 ? 1 : 0} 1 ${ex} ${ey}` : "";
  const scoreColor = score >= 80 ? "#10b981" : score >= 60 ? "#f59e0b" : "#ef4444";
  return (
    <svg width={180} height={110} className="overflow-visible">
      <path d={trackD} fill="none" stroke="currentColor" strokeWidth={12} strokeLinecap="round" className="text-muted/30" />
      {fillD && <path d={fillD} fill="none" stroke={scoreColor} strokeWidth={12} strokeLinecap="round" />}
      <text x={cx} y={cy + 8} textAnchor="middle" className="font-mono font-bold" fontSize={32} fill={scoreColor}>{score}</text>
      <text x={cx} y={cy + 26} textAnchor="middle" fontSize={10} fill="currentColor" opacity={0.5}>ATO READINESS</text>
    </svg>
  );
}

function PhaseStep({ phase, currentPhase, index }: { phase: typeof PHASES[0]; currentPhase: string; index: number }) {
  const phaseIndex = PHASES.findIndex(p => p.key === currentPhase);
  const isDone = index < phaseIndex;
  const isActive = phase.key === currentPhase;
  const isFuture = index > phaseIndex;

  return (
    <div className={cn("flex flex-col items-center gap-1.5 flex-1")}>
      <div className={cn(
        "w-8 h-8 rounded-full flex items-center justify-center border-2 text-xs font-bold transition-colors",
        isDone    ? "bg-emerald-500 border-emerald-500 text-white"   :
        isActive  ? "bg-primary border-primary text-primary-foreground" :
                    "bg-card border-border text-muted-foreground"
      )}>
        {isDone ? <CheckCircle2 className="w-4 h-4" /> : <span>{index + 1}</span>}
      </div>
      <div className={cn("text-xs font-semibold", isActive ? "text-foreground" : isFuture ? "text-muted-foreground" : "text-emerald-600")}>{phase.label}</div>
      <div className="text-[10px] text-muted-foreground hidden md:block">{phase.sublabel}</div>
    </div>
  );
}

export default function ComplianceJourney() {
  const qc = useQueryClient();
  const [selectedJourneyId, setSelectedJourneyId] = useState<string | null>(null);

  const { data: journeys = [] } = useQuery<Journey[]>({
    queryKey: ["journeys"],
    queryFn: async () => { const r = await fetch("/api/journeys"); return r.json(); },
    onSuccess: (data) => { if (data.length > 0 && !selectedJourneyId) setSelectedJourneyId(data[0].id); },
  } as any);

  const journey = journeys.find(j => j.id === selectedJourneyId) ?? journeys[0] ?? null;

  const { data: tasks = [] } = useQuery<Task[]>({
    queryKey: ["journey-roadmap", journey?.id],
    queryFn: async () => { const r = await fetch(`/api/journeys/${journey!.id}/roadmap`); return r.json(); },
    enabled: !!journey,
  });

  const { data: readiness } = useQuery<Readiness>({
    queryKey: ["journey-readiness", journey?.id],
    queryFn: async () => { const r = await fetch(`/api/journeys/${journey!.id}/readiness`); return r.json(); },
    enabled: !!journey,
  });

  const updateTask = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const r = await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["journey-roadmap"] });
      qc.invalidateQueries({ queryKey: ["journey-readiness"] });
    },
  });

  const completed = tasks.filter(t => t.status === "complete").length;
  const inProgress = tasks.filter(t => t.status === "in_progress").length;
  const notStarted = tasks.filter(t => t.status === "not_started").length;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-bold text-foreground">Compliance Journey</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Framework authorization workflow — from gap to ATO in six phases</p>
        </div>
        {journeys.length > 1 && (
          <div className="flex gap-1">
            {journeys.map(j => (
              <button
                key={j.id}
                onClick={() => setSelectedJourneyId(j.id)}
                className={cn(
                  "px-3 py-1.5 text-xs font-semibold border transition-colors",
                  selectedJourneyId === j.id || (!selectedJourneyId && j === journeys[0])
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card border-border text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                {FRAMEWORK_LABELS[j.frameworkKey] ?? j.frameworkKey}
              </button>
            ))}
          </div>
        )}
      </div>

      {journey && (
        <>
          {/* Phase stepper */}
          <div className="bg-card border border-border p-5">
            <div className="flex items-start gap-0">
              {PHASES.map((phase, i) => (
                <div key={phase.key} className="flex items-center flex-1">
                  <PhaseStep phase={phase} currentPhase={journey.phase} index={i} />
                  {i < PHASES.length - 1 && (
                    <div className={cn(
                      "flex-1 h-0.5 mb-6",
                      i < PHASES.findIndex(p => p.key === journey.phase) ? "bg-emerald-400" : "bg-border"
                    )} />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Summary row */}
          <div className="grid grid-cols-12 gap-4">
            {/* Gauge + system info */}
            <div className="col-span-12 md:col-span-4 bg-card border border-border p-5 flex flex-col items-center gap-3">
              <GaugeArc score={readiness?.readinessScore ?? 0} />
              <div className="w-full space-y-2 text-xs border-t border-border pt-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">System</span>
                  <span className="font-semibold text-foreground text-right max-w-[160px] truncate">{journey.systemName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Framework</span>
                  <span className="font-semibold text-foreground">{FRAMEWORK_LABELS[journey.frameworkKey] ?? journey.frameworkKey}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Data Class</span>
                  <span className="font-semibold text-foreground uppercase">{journey.dataClassification}</span>
                </div>
                {journey.leveragedAto && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Leveraged ATO</span>
                    <span className="font-semibold text-blue-600 text-right max-w-[160px] truncate">{journey.leveragedAto}</span>
                  </div>
                )}
                {journey.targetAtoDate && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Target ATO</span>
                    <span className="font-mono font-bold text-foreground">{new Date(journey.targetAtoDate).toLocaleDateString("en-US", { month: "short", year: "numeric" })}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Progress summary */}
            <div className="col-span-12 md:col-span-8 bg-card border border-border p-5">
              <div className="flex items-center gap-2 mb-4">
                <Target className="w-4 h-4 text-primary" />
                <span className="text-sm font-bold text-foreground">Remediation Roadmap</span>
                <div className="ml-auto flex gap-3 text-xs">
                  <span className="text-emerald-600 font-semibold">{completed} complete</span>
                  <span className="text-blue-600 font-semibold">{inProgress} in progress</span>
                  <span className="text-muted-foreground">{notStarted} not started</span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="h-2 bg-muted rounded-full overflow-hidden mb-5">
                <div
                  className="h-full bg-emerald-500 transition-all duration-500"
                  style={{ width: `${tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0}%` }}
                />
              </div>

              {/* System description */}
              <div className="text-xs text-muted-foreground mb-4 leading-relaxed">
                {journey.systemDescription}
              </div>
              {journey.boundaryDescription && (
                <div className="text-xs text-muted-foreground border-t border-border pt-3">
                  <span className="font-semibold text-foreground">Authorization boundary: </span>
                  {journey.boundaryDescription}
                </div>
              )}
            </div>
          </div>

          {/* Tasks table */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-sm font-bold text-foreground">Remediation Tasks</h2>
              <span className="text-xs text-muted-foreground">Priority-ordered</span>
            </div>
            <div className="border border-border bg-card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="w-[3px] p-0" />
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider w-8">#</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Task</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Control</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Effort</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden xl:table-cell">Owner</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden xl:table-cell">Due</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Days</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((task, idx) => {
                    const scfg = TASK_STATUS_CONFIG[task.status] ?? TASK_STATUS_CONFIG.not_started;
                    const daysLeft = task.dueDate ? Math.ceil((new Date(task.dueDate).getTime() - Date.now()) / 86400000) : null;
                    return (
                      <tr key={task.id} className={cn(
                        "border-b border-border hover:bg-muted/20 transition-colors",
                        task.status === "complete" && "opacity-60"
                      )}>
                        <td className="p-0 w-[3px]">
                          <div className={cn("w-[3px] min-h-[52px] h-full", SEV_ACCENT[task.status] ?? "bg-slate-300")} />
                        </td>
                        <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{String(idx + 1).padStart(2, "0")}</td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-foreground text-sm leading-tight">{task.title}</div>
                          <div className="text-xs text-muted-foreground mt-0.5 truncate max-w-xs hidden md:block">{task.description}</div>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <span className="font-mono text-xs font-bold text-primary">{task.controlId}</span>
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={task.status}
                            onClick={e => e.stopPropagation()}
                            onChange={e => updateTask.mutate({ id: task.id, status: e.target.value })}
                            className={cn(
                              "text-xs font-semibold border px-2 py-1 bg-transparent cursor-pointer",
                              scfg.color, scfg.border
                            )}
                          >
                            {Object.entries(TASK_STATUS_CONFIG).map(([k, v]) => (
                              <option key={k} value={k}>{v.label}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell">
                          <span className={cn("text-xs font-semibold capitalize", EFFORT_COLOR[task.effort])}>{task.effort}</span>
                        </td>
                        <td className="px-4 py-3 hidden xl:table-cell">
                          <div className="text-xs text-foreground font-semibold">{task.assignee ?? "—"}</div>
                          {task.team && <div className="text-[10px] text-muted-foreground">{task.team}</div>}
                        </td>
                        <td className="px-4 py-3 hidden xl:table-cell">
                          <div className={cn("text-xs font-mono", daysLeft !== null && daysLeft < 0 ? "text-red-600 font-bold" : "text-foreground")}>
                            {task.dueDate ? new Date(task.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}
                          </div>
                          {daysLeft !== null && (
                            <div className={cn("text-[10px]", daysLeft < 0 ? "text-red-600 font-semibold" : "text-muted-foreground")}>
                              {daysLeft < 0 ? `${Math.abs(daysLeft)}d late` : `${daysLeft}d left`}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell">
                          <span className="font-mono text-xs text-muted-foreground">{task.estimatedDays}d</span>
                        </td>
                      </tr>
                    );
                  })}
                  {tasks.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-4 py-12 text-center text-sm text-muted-foreground">No tasks in this roadmap yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {journeys.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-3">
          <Shield className="w-10 h-10 opacity-30" />
          <div className="text-sm font-medium">No compliance journeys started</div>
          <div className="text-xs">Create a journey to begin framework authorization tracking</div>
        </div>
      )}
    </div>
  );
}

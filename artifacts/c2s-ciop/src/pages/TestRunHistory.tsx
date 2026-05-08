import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiUrl } from "@/lib/queryClient";

const STATUS_CONFIG: Record<string, { label: string; cls: string; dot: string }> = {
  pass:    { label: "Passed", cls: "bg-green-50 text-green-700 ring-1 ring-green-200", dot: "bg-green-500" },
  fail:    { label: "Failed", cls: "bg-red-50 text-red-700 ring-1 ring-red-200",       dot: "bg-red-500" },
  warning: { label: "Warning", cls: "bg-amber-50 text-amber-700 ring-1 ring-amber-200", dot: "bg-amber-400" },
  skip:    { label: "Skipped", cls: "bg-slate-100 text-slate-500 ring-1 ring-slate-200", dot: "bg-slate-300" },
};

function RelativeTime({ date }: { date: string }) {
  const now = Date.now();
  const ms = now - new Date(date).getTime();
  const mins = Math.floor(ms / 60000);
  const hrs = Math.floor(ms / 3600000);
  const days = Math.floor(ms / 86400000);
  if (mins < 1) return <span>Just now</span>;
  if (hrs < 1) return <span>{mins}m ago</span>;
  if (days < 1) return <span>{hrs}h ago</span>;
  return <span>{days}d ago</span>;
}

export default function TestRunHistory() {
  const [filterStatus, setFilterStatus] = useState("all");
  const [searchQ, setSearchQ] = useState("");

  const { data: orgData } = useQuery<{ org: any }>({
    queryKey: ["orgs", "me"],
    queryFn: async () => (await fetch(apiUrl("/orgs/me"), { credentials: "include" })).json(),
  });
  const orgId = orgData?.org?.id;

  const { data, isLoading } = useQuery<{ runs: any[]; totalRuns: number; passing: number; failing: number }>({
    queryKey: ["test-runs", orgId],
    queryFn: async () => (await fetch(apiUrl(`/orgs/${orgId}/test-runs`), { credentials: "include" })).json(),
    enabled: !!orgId,
  });

  const runs: any[] = data?.runs ?? [];
  const totalRuns = data?.totalRuns ?? 0;
  const passing = data?.passing ?? 0;
  const failing = data?.failing ?? 0;
  const passRate = totalRuns > 0 ? Math.round((passing / totalRuns) * 100) : 0;

  const filtered = runs.filter(r => {
    if (filterStatus !== "all" && r.status !== filterStatus) return false;
    if (searchQ && !r.testName.toLowerCase().includes(searchQ.toLowerCase()) && !r.controlId?.toLowerCase().includes(searchQ.toLowerCase())) return false;
    return true;
  });

  // Group by date
  const grouped: Record<string, any[]> = {};
  for (const run of filtered) {
    const d = new Date(run.runAt).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    grouped[d] = grouped[d] ?? [];
    grouped[d].push(run);
  }

  return (
    <div className="p-6 max-w-5xl space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Automated Test Run History</h1>
          <p className="text-sm text-slate-500 mt-1">30-day history of automated control tests and their pass/fail results.</p>
        </div>
        <a href="/controls" className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-blue-600 border border-blue-200 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
          Manage Controls
        </a>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Runs", value: totalRuns, color: "text-slate-900" },
          { label: "Passed", value: passing, color: "text-green-600" },
          { label: "Failed", value: failing, color: "text-red-600" },
          { label: "Pass Rate", value: `${passRate}%`, color: passRate >= 80 ? "text-green-600" : passRate >= 60 ? "text-amber-600" : "text-red-600" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3.5">
            <div className={`text-2xl font-extrabold ${color} leading-tight`}>{value}</div>
            <div className="text-xs font-medium text-slate-500 mt-1">{label}</div>
          </div>
        ))}
      </div>

      {/* Pass rate bar */}
      {totalRuns > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-700">Overall Pass Rate - Last 30 days</span>
            <span className={`text-sm font-bold ${passRate >= 80 ? "text-green-600" : passRate >= 60 ? "text-amber-600" : "text-red-600"}`}>{passRate}%</span>
          </div>
          <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden flex gap-0.5">
            <div className="bg-green-500 rounded-full transition-all duration-700" style={{ width: `${passRate}%` }} />
            <div className="bg-red-400 rounded-full" style={{ width: `${100 - passRate}%` }} />
          </div>
          <div className="flex items-center gap-4 mt-2">
            <div className="flex items-center gap-1.5 text-xs text-slate-500"><div className="h-2 w-2 rounded-full bg-green-500" />{passing} passed</div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500"><div className="h-2 w-2 rounded-full bg-red-400" />{failing} failed</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input
            type="text"
            placeholder="Search test name or control..."
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex gap-1.5">
          {[["all", "All"], ["pass", "Passed"], ["fail", "Failed"]].map(([v, l]) => (
            <button key={v} onClick={() => setFilterStatus(v)}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${filterStatus === v ? "bg-blue-600 text-white" : "bg-white border border-slate-200 text-slate-600 hover:border-slate-300"}`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Run list */}
      {isLoading ? (
        <div className="space-y-2">{[...Array(8)].map((_, i) => <div key={i} className="h-14 bg-slate-100 rounded-xl animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-14 text-center">
          <svg className="h-10 w-10 text-slate-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
          <p className="text-sm font-bold text-slate-700">No test runs yet</p>
          <p className="text-xs text-slate-400 mt-1">Connect an integration to start collecting automated test results.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {Object.entries(grouped).map(([date, dayRuns]) => (
            <div key={date}>
              <div className="flex items-center gap-3 mb-2.5">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">{date}</span>
                <div className="flex-1 h-px bg-slate-100" />
                <span className="text-xs text-slate-400">{dayRuns.length} run{dayRuns.length !== 1 ? "s" : ""}</span>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                {dayRuns.map((run: any, idx: number) => {
                  const sc = STATUS_CONFIG[run.status] ?? STATUS_CONFIG.skip;
                  return (
                    <div key={run.id} className={`flex items-center gap-4 px-5 py-3.5 ${idx > 0 ? "border-t border-slate-50" : ""} hover:bg-slate-50/50 transition-colors`}>
                      <div className={`h-2 w-2 rounded-full flex-shrink-0 ${sc.dot}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2.5">
                          <span className="font-semibold text-sm text-slate-800 truncate">{run.testName}</span>
                          {run.controlId && (
                            <span className="font-mono text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded flex-shrink-0">{run.controlId}</span>
                          )}
                        </div>
                        {run.errorMessage && (
                          <p className="text-xs text-red-600 mt-0.5 truncate">{run.errorMessage}</p>
                        )}
                        {run.details && !run.errorMessage && (
                          <p className="text-xs text-slate-400 mt-0.5 truncate">{run.details}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${sc.cls}`}>{sc.label}</span>
                        {run.durationMs && (
                          <span className="text-xs text-slate-400 font-mono">{run.durationMs}ms</span>
                        )}
                        <span className="text-xs text-slate-400">
                          <RelativeTime date={run.runAt} />
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

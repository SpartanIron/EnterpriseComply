import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/queryClient";
import { useOrg } from "@/hooks/useOrg";

function timeAgo(date: string) {
  if (!date) return "Never";
  const diff = Date.now() - new Date(date).getTime();
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (d > 0) return `${d}d ago`;
  if (h > 0) return `${h}h ago`;
  return "Just now";
}

const SEVERITY_CONFIG: Record<string, { dot: string; text: string; bg: string }> = {
  critical: { dot: "bg-red-500", text: "text-red-700", bg: "bg-red-50 border-red-200" },
  high: { dot: "bg-orange-500", text: "text-orange-700", bg: "bg-orange-50 border-orange-200" },
  warning: { dot: "bg-yellow-500", text: "text-yellow-700", bg: "bg-yellow-50 border-yellow-200" },
  info: { dot: "bg-blue-400", text: "text-blue-700", bg: "bg-blue-50 border-blue-200" },
};

export default function Monitoring() {
  const { orgId } = useOrg();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState("overview");

  const { data: notifData, isLoading: notifLoading } = useQuery<{ notifications: any[]; unreadCount: number }>({
    queryKey: ["notifications", orgId],
    queryFn: () => apiFetch(`/orgs/${orgId}/notifications`),
    enabled: !!orgId,
    refetchInterval: 30000,
  });

  const { data: monitorData } = useQuery<{ monitoringJobs: any[] }>({
    queryKey: ["monitoring", orgId],
    queryFn: () => apiFetch(`/orgs/${orgId}/monitoring`),
    enabled: !!orgId,
  });

  const { data: settingsData } = useQuery<{ settings: any }>({
    queryKey: ["monitoring-settings", orgId],
    queryFn: () => apiFetch(`/orgs/${orgId}/monitoring/settings`),
    enabled: !!orgId,
  });

  const { data: controlData } = useQuery<{ passing: number; failing: number; notTested: number; total: number; lastRunAt: string }>({
    queryKey: ["control-summary", orgId],
    queryFn: () => apiFetch(`/orgs/${orgId}/controls/summary`),
    enabled: !!orgId,
  });

  const { data: testRunData } = useQuery<{ runs: any[] }>({
    queryKey: ["test-runs-recent", orgId],
    queryFn: () => apiFetch(`/orgs/${orgId}/test-runs?limit=30`),
    enabled: !!orgId,
  });

  const markReadMutation = useMutation({
    mutationFn: () => apiFetch(`/orgs/${orgId}/notifications/read`, { method: "POST", body: JSON.stringify({}) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const notifications = notifData?.notifications ?? [];
  const jobs = monitorData?.monitoringJobs ?? [];
  const settings = settingsData?.settings;
  const cs = controlData ?? { passing: 0, failing: 0, notTested: 0, total: 0, lastRunAt: "" };
  const unread = notifData?.unreadCount ?? 0;

  // Build 30-day pass rate trend from test runs
  const runs = testRunData?.runs ?? [];
  const trendBuckets: Record<string, { pass: number; fail: number }> = {};
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    trendBuckets[key] = { pass: 0, fail: 0 };
  }
  for (const run of runs) {
    const key = new Date(run.runAt ?? run.run_at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    if (trendBuckets[key]) {
      if ((run.status ?? "pass") === "pass") trendBuckets[key].pass++;
      else trendBuckets[key].fail++;
    }
  }
  const trendData = Object.entries(trendBuckets).map(([date, { pass, fail }]) => ({
    date,
    total: pass + fail,
    passRate: (pass + fail) > 0 ? Math.round((pass / (pass + fail)) * 100) : null,
  }));
  const maxTotal = Math.max(1, ...trendData.map(d => d.total));
  const passRateNow = cs.total > 0 ? Math.round((cs.passing / cs.total) * 100) : 0;

  const TABS = [
    { id: "overview", label: "Live Overview" },
    { id: "notifications", label: `Alerts ${unread > 0 ? `(${unread})` : ""}` },
    { id: "jobs", label: "Monitoring Jobs" },
    { id: "settings", label: "Alert Settings" },
  ];

  return (
    <div className="p-6 max-w-6xl">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Continuous Monitoring</h1>
          <p className="text-sm text-slate-500 mt-0.5">Real-time security posture, drift detection, and immutable audit trail</p>
        </div>
        {unread > 0 && (
          <button
            onClick={() => markReadMutation.mutate()}
            className="px-3 py-1.5 text-xs font-semibold text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
          >
            Mark all read
          </button>
        )}
      </div>

      {/* Live Status KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm overflow-hidden relative">
          <div className="absolute top-0 left-0 right-0 h-[3px] bg-green-500" />
          <p className="text-2xl font-bold text-green-700 mt-1">{cs.passing}</p>
          <p className="text-xs font-semibold text-slate-500 mt-0.5">Controls Passing</p>
          <div className="mt-2 h-1 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-green-500 rounded-full transition-all duration-700"
              style={{ width: cs.total > 0 ? `${Math.round((cs.passing / cs.total) * 100)}%` : "0%" }} />
          </div>
          <p className="text-xs text-slate-400 mt-1">{cs.total > 0 ? `${Math.round((cs.passing / cs.total) * 100)}% pass rate` : "No controls tested"}</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm overflow-hidden relative">
          <div className={"absolute top-0 left-0 right-0 h-[3px] " + (cs.failing > 0 ? "bg-red-500" : "bg-slate-200")} />
          <p className={"text-2xl font-bold mt-1 " + (cs.failing > 0 ? "text-red-600" : "text-slate-400")}>{cs.failing}</p>
          <p className="text-xs font-semibold text-slate-500 mt-0.5">Controls Failing</p>
          <div className="mt-2 h-1 bg-slate-100 rounded-full overflow-hidden">
            <div className={"h-full rounded-full transition-all duration-700 " + (cs.failing > 0 ? "bg-red-500" : "bg-slate-200")}
              style={{ width: cs.total > 0 ? `${Math.round((cs.failing / cs.total) * 100)}%` : "0%" }} />
          </div>
          <p className="text-xs text-slate-400 mt-1">{cs.failing > 0 ? "Requires remediation" : "All controls healthy"}</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm overflow-hidden relative">
          <div className="absolute top-0 left-0 right-0 h-[3px] bg-amber-400" />
          <p className="text-2xl font-bold text-slate-700 mt-1">{cs.notTested}</p>
          <p className="text-xs font-semibold text-slate-500 mt-0.5">Not Tested</p>
          <div className="mt-2 h-1 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-amber-400 rounded-full transition-all duration-700"
              style={{ width: cs.total > 0 ? `${Math.round((cs.notTested / cs.total) * 100)}%` : "0%" }} />
          </div>
          <p className="text-xs text-slate-400 mt-1">Pending evaluation</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm overflow-hidden relative">
          <div className="absolute top-0 left-0 right-0 h-[3px] bg-blue-500" />
          <p className="text-2xl font-bold text-blue-700 mt-1">{passRateNow}%</p>
          <p className="text-xs font-semibold text-slate-500 mt-0.5">Overall Pass Rate</p>
          <div className="mt-2 h-1 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full transition-all duration-700"
              style={{ width: `${passRateNow}%` }} />
          </div>
          <p className="text-xs text-slate-400 mt-1">{cs.lastRunAt ? `Last run ${timeAgo(cs.lastRunAt)}` : "No runs yet"}</p>
        </div>
      </div>

      {/* Tab Nav */}
      <div className="flex gap-1 mb-5 border-b border-slate-200">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={"px-4 py-2 text-sm font-semibold transition-colors border-b-2 -mb-px " +
              (activeTab === tab.id
                ? "text-blue-600 border-blue-500"
                : "text-slate-500 border-transparent hover:text-slate-700")}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* OVERVIEW TAB */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* 30-Day Pass Rate Trend */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900">30-Day Control Pass Rate Trend</h2>
                <p className="text-xs text-slate-400 mt-0.5">Daily test run outcomes</p>
              </div>
              <a href="/test-runs" className="text-xs font-semibold text-blue-600 hover:text-blue-700">View all runs →</a>
            </div>
            <div className="p-5">
              {runs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-slate-400">
                  <svg className="h-8 w-8 mb-2 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                  </svg>
                  <p className="text-sm font-medium text-slate-500">No test runs yet</p>
                  <p className="text-xs text-slate-400 mt-1">Connect integrations to begin automated testing</p>
                </div>
              ) : (
                <div className="flex items-end gap-0.5 h-32">
                  {trendData.map((d, i) => {
                    const height = d.total > 0 ? Math.max(8, Math.round((d.total / maxTotal) * 100)) : 4;
                    const isPass = d.passRate !== null && d.passRate >= 80;
                    const isWarn = d.passRate !== null && d.passRate >= 50 && d.passRate < 80;
                    const isFail = d.passRate !== null && d.passRate < 50;
                    const barColor = d.total === 0 ? "bg-slate-100" : isPass ? "bg-green-400" : isWarn ? "bg-amber-400" : "bg-red-400";
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center justify-end gap-0.5 group relative">
                        <div
                          className={"rounded-sm transition-all " + barColor}
                          style={{ height: `${height}%`, minHeight: "4px" }}
                        />
                        {i % 7 === 0 && (
                          <span className="text-[8px] text-slate-400 mt-1 hidden sm:block truncate w-full text-center">
                            {d.date.split(" ")[0]}
                          </span>
                        )}
                        {d.total > 0 && (
                          <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                            {d.date}: {d.passRate}% ({d.total} runs)
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-100">
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-green-400 rounded-sm" /><span className="text-xs text-slate-500">≥80% pass</span></div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-amber-400 rounded-sm" /><span className="text-xs text-slate-500">50-79% pass</span></div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-red-400 rounded-sm" /><span className="text-xs text-slate-500">&lt;50% pass</span></div>
              </div>
            </div>
          </div>

          {/* Alert Thresholds */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-900">Alert Thresholds</h2>
              <p className="text-xs text-slate-400 mt-0.5">Current trigger conditions for automated alerts</p>
            </div>
            <div className="p-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[
                  { label: "Control Failure Alert", desc: "Alert when pass rate drops below 80%", threshold: "80%", status: passRateNow >= 80 ? "ok" : passRateNow >= 60 ? "warn" : "alert", metric: `Current: ${passRateNow}%` },
                  { label: "Evidence Expiry Warning", desc: "Alert when evidence expires within 30 days", threshold: "30 days", status: "ok", metric: "Monitoring active" },
                  { label: "Vendor Assessment Overdue", desc: "Alert when assessment is 14+ days overdue", threshold: "14 days", status: "ok", metric: "Monitoring active" },
                  { label: "Policy Review Overdue", desc: "Alert when policy review is past due date", threshold: "0 days", status: "ok", metric: "Monitoring active" },
                ].map((item, i) => (
                  <div key={i} className={"flex items-center gap-4 p-4 rounded-xl border " + (item.status === "alert" ? "bg-red-50 border-red-200" : item.status === "warn" ? "bg-amber-50 border-amber-200" : "bg-green-50 border-green-200")}>
                    <div className={"flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center " + (item.status === "alert" ? "bg-red-100" : item.status === "warn" ? "bg-amber-100" : "bg-green-100")}>
                      {item.status === "ok" ? (
                        <svg className="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      ) : item.status === "warn" ? (
                        <svg className="h-4 w-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" /></svg>
                      ) : (
                        <svg className="h-4 w-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800">{item.label}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{item.desc}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs font-bold text-slate-700">Threshold: {item.threshold}</p>
                      <p className={"text-xs font-semibold mt-0.5 " + (item.status === "alert" ? "text-red-600" : item.status === "warn" ? "text-amber-600" : "text-green-600")}>{item.metric}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Integration Health Grid */}
          {jobs.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
              <div className="px-5 py-4 border-b border-slate-100">
                <h2 className="text-sm font-bold text-slate-900">Integration Health</h2>
                <p className="text-xs text-slate-400 mt-0.5">Status of all monitored integrations</p>
              </div>
              <div className="p-5">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {jobs.map((job: any) => (
                    <div key={job.id} className="flex items-center gap-3 p-3 border border-slate-100 rounded-xl hover:bg-slate-50 transition-colors">
                      <div className={"h-2.5 w-2.5 rounded-full flex-shrink-0 " + (job.status === "healthy" ? "bg-green-500" : job.status === "error" ? "bg-red-500" : "bg-amber-400")} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">{job.integrationKey ?? job.integration_key}</p>
                        <p className="text-xs text-slate-400">{timeAgo(job.lastRunAt ?? job.last_run_at)}</p>
                      </div>
                      <span className={"text-xs font-bold px-2 py-0.5 rounded-full " + (job.status === "healthy" ? "bg-green-100 text-green-700" : job.status === "error" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700")}>
                        {job.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* NOTIFICATIONS TAB */}
      {activeTab === "notifications" && (
        <div className="space-y-3">
          {notifLoading ? (
            <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />)}</div>
          ) : notifications.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
              <div className="h-12 w-12 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-3 ring-1 ring-green-200">
                <svg className="h-6 w-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="font-bold text-slate-800 text-sm">All clear</p>
              <p className="text-slate-400 text-xs mt-1">No notifications. Connect integrations to start monitoring.</p>
            </div>
          ) : (
            notifications.map((n: any) => {
              const sev = SEVERITY_CONFIG[n.severity] ?? SEVERITY_CONFIG.info;
              return (
                <div key={n.id} className={"flex items-start gap-4 p-4 rounded-xl border transition-all " + sev.bg + (n.read ? " opacity-60" : "")}>
                  <div className={"mt-1 h-2.5 w-2.5 rounded-full flex-shrink-0 " + sev.dot} />
                  <div className="flex-1 min-w-0">
                    <p className={"text-sm font-bold " + sev.text}>{n.title}</p>
                    <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{n.message}</p>
                    <p className="text-xs text-slate-400 mt-1">{timeAgo(n.createdAt ?? n.created_at)}</p>
                  </div>
                  {n.resource_url && (
                    <a href={n.resource_url} className="flex-shrink-0 text-xs font-semibold text-blue-600 hover:text-blue-700 whitespace-nowrap">
                      View →
                    </a>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* MONITORING JOBS TAB */}
      {activeTab === "jobs" && (
        <div className="space-y-3">
          {jobs.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
              <p className="font-bold text-slate-800 text-sm">No monitoring jobs</p>
              <p className="text-slate-400 text-xs mt-1">Connect integrations to create automated monitoring jobs.</p>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-800">Automated Monitoring Jobs</h2>
                <span className="text-xs text-slate-400">{jobs.length} jobs</span>
              </div>
              <div className="divide-y divide-slate-100">
                {jobs.map((job: any) => (
                  <div key={job.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 transition-colors">
                    <div className={"h-2.5 w-2.5 rounded-full flex-shrink-0 " + (job.status === "healthy" ? "bg-green-500" : job.status === "error" ? "bg-red-500" : "bg-amber-400")} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800">{job.integrationKey ?? job.integration_key}</p>
                      <p className="text-xs text-slate-400">Runs every {job.intervalHours ?? job.interval_hours ?? 24}h · Last: {timeAgo(job.lastRunAt ?? job.last_run_at)}</p>
                    </div>
                    <div className="text-right">
                      <span className={"text-xs font-bold px-2 py-0.5 rounded-full " + (job.status === "healthy" ? "bg-green-100 text-green-700" : job.status === "error" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700")}>
                        {job.status}
                      </span>
                      {(job.driftDetected ?? job.drift_detected) && (
                        <span className="ml-2 text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">Drift</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ALERT SETTINGS TAB */}
      {activeTab === "settings" && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-800">Alert Settings</h2>
            <p className="text-xs text-slate-400 mt-0.5">Configure notification thresholds and delivery channels</p>
          </div>
          <div className="p-5 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Slack Webhook URL</label>
                <input
                  type="url"
                  defaultValue={settings?.slackWebhookUrl ?? ""}
                  placeholder="https://hooks.slack.com/services/..."
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Pass Rate Alert Threshold</label>
                <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none">
                  <option value="90">Alert below 90%</option>
                  <option value="80" selected>Alert below 80%</option>
                  <option value="70">Alert below 70%</option>
                  <option value="60">Alert below 60%</option>
                </select>
              </div>
            </div>
            <div className="space-y-3">
              {[
                { key: "email_enabled", label: "Email notifications", desc: "Receive critical alerts via email", val: settings?.emailEnabled ?? true },
                { key: "slack_enabled", label: "Slack notifications", desc: "Post alerts to a Slack channel", val: settings?.slackEnabled ?? false },
                { key: "notify_on_drift", label: "Configuration drift", desc: "Alert when integration state changes unexpectedly", val: settings?.notifyOnDrift ?? true },
                { key: "notify_on_evidence_expiry", label: "Evidence expiry", desc: "Alert 30 days before evidence expires", val: settings?.notifyOnEvidenceExpiry ?? true },
                { key: "notify_on_poam_overdue", label: "POA&M overdue", desc: "Alert when POA&M items are past their scheduled completion date", val: settings?.notifyOnPoamOverdue ?? true },
                { key: "notify_on_new_findings", label: "New findings", desc: "Alert when new failing controls are detected", val: settings?.notifyOnNewFindings ?? true },
              ].map(item => (
                <div key={item.key} className="flex items-center justify-between py-3 border-b border-slate-50 last:border-0">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{item.label}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{item.desc}</p>
                  </div>
                  <input type="checkbox" defaultChecked={item.val} className="h-4 w-4 text-blue-600 rounded" />
                </div>
              ))}
            </div>
            <button className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors">
              Save Alert Settings
            </button>
          </div>
        </div>
      )}

      {/* Audit Log */}
      <div className="mt-6 bg-white border border-slate-200 rounded-xl shadow-sm">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-800">Audit Log</h2>
            <p className="text-xs text-slate-400 mt-0.5">Immutable record of all compliance activities</p>
          </div>
          <a href="/audit-log" className="text-xs font-semibold text-blue-600 hover:text-blue-700">View full log →</a>
        </div>
        <AuditLog orgId={orgId} />
      </div>
    </div>
  );
}

function AuditLog({ orgId }: { orgId: string }) {
  const { data } = useQuery<{ logs: any[] }>({
    queryKey: ["audit-log", orgId],
    queryFn: () => apiFetch(`/orgs/${orgId}/audit-log`),
    enabled: !!orgId,
  });
  const logs = data?.logs ?? [];
  if (logs.length === 0) {
    return (
      <div className="p-8 text-center text-slate-400 text-sm">
        No audit log entries yet.
      </div>
    );
  }
  return (
    <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
      {logs.map((log: any) => (
        <div key={log.id} className="flex items-center gap-4 px-5 py-3 hover:bg-slate-50 transition-colors">
          <div className="h-2 w-2 rounded-full bg-blue-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-slate-700">
              <span className="font-semibold">{log.actorEmail ?? log.actor_email ?? "System"}</span>
              {" "}{log.action}{" "}
              <span className="text-slate-500">{log.resource}</span>
            </p>
          </div>
          <p className="text-xs text-slate-400 flex-shrink-0">{new Date(log.createdAt ?? log.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
        </div>
      ))}
    </div>
  );
}

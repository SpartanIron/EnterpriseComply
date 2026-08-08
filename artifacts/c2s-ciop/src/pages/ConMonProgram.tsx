import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/queryClient";
import { useOrg } from "@/hooks/useOrg";

// MONITORING_STRATEGY is NIST SP 800-137A reference data, not org-specific metrics.
// It describes standard monitoring frequencies per control family — keep as reference.
const MONITORING_STRATEGY = [
  { category: "Ongoing", frequency: "Continuous (Real-time)", controls: ["AC-2", "AC-11", "AU-2", "AU-6", "IR-4", "SI-4", "SI-4(1)"], method: "Automated", riskLevel: "High/Critical" },
  { category: "Weekly", frequency: "Every 7 days", controls: ["RA-5", "SI-2", "CM-7", "CM-8(1)", "AU-11"], method: "Automated", riskLevel: "High" },
  { category: "Monthly", frequency: "Every 30 days", controls: ["CA-7", "CM-3", "CM-6(1)", "RA-3", "IR-3(2)"], method: "Automated + Manual Review", riskLevel: "Moderate" },
  { category: "Quarterly", frequency: "Every 90 days", controls: ["CA-2", "PL-2", "SA-9", "AT-3", "AU-9(4)"], method: "Automated + Manual Assessment", riskLevel: "Moderate/Low" },
  { category: "Annual", frequency: "Yearly", controls: ["CA-2(1)", "CA-5", "PL-2(3)", "PS-4", "SA-12"], method: "Manual Assessment", riskLevel: "Low" },
];

// P0-08: MOCK_METRICS and DRIFT_EVENTS removed — they showed fake security posture
// numbers (alerts, thresholds, drift events) to every org regardless of actual data.
// Metrics now come from the real /monitoring API (integration monitoring jobs).
// Drift history has no backend API yet — shows honest empty state.

function StatusIndicator({ status }: { status: string }) {
  const cfg: Record<string, { label: string; color: string }> = {
    success: { label: "Normal", color: "#22c55e" },
    running: { label: "Running", color: "#3b82f6" },
    failure: { label: "Alert", color: "#ef4444" },
    pending: { label: "Pending", color: "#f59e0b" },
  };
  const c = cfg[status] ?? { label: status, color: "#94a3b8" };
  return (
    <span className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: c.color }}>
      <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />
      {c.label}
    </span>
  );
}

interface MonJob {
  integrationKey: string;
  status: string;
  lastRunAt: string | null;
  nextRunAt: string | null;
  intervalHours: number;
  driftDetected: boolean;
  driftDetails: unknown;
  lastResult: string | null;
}

export default function ConMonProgram() {
  const { orgId } = useOrg();
  const [activeTab, setActiveTab] = useState<"dashboard" | "strategy" | "metrics" | "drift" | "reports">("dashboard");

  const { data: monData, isLoading } = useQuery<{ jobs: MonJob[] }>({
    queryKey: ["monitoring", orgId],
    queryFn: () => apiFetch(`/orgs/${orgId}/monitoring`),
    enabled: !!orgId,
  });

  const jobs: MonJob[] = monData?.jobs ?? [];
  const alertJobs = jobs.filter(j => j.lastResult === "failure" || j.driftDetected);
  const normalJobs = jobs.filter(j => j.lastResult !== "failure" && !j.driftDetected);

  const tabs = [
    { id: "dashboard" as const, label: "ISCM Dashboard" },
    { id: "strategy" as const, label: "Monitoring Strategy" },
    { id: "metrics" as const, label: "Automated Metrics" },
    { id: "drift" as const, label: "Score Drift Detection" },
    { id: "reports" as const, label: "ConMon Reports" },
  ];

  const EmptyState = ({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) => (
    <div className="bg-white rounded-xl border border-slate-200 p-16 flex flex-col items-center text-center">
      <div className="h-14 w-14 rounded-full bg-slate-50 flex items-center justify-center mb-4">{icon}</div>
      <h3 className="text-sm font-bold text-slate-800 mb-2">{title}</h3>
      <p className="text-xs text-slate-500 max-w-sm leading-relaxed">{body}</p>
    </div>
  );

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Continuous Monitoring Program</h1>
          <p className="text-sm text-slate-500 mt-1">ISCM program per NIST SP 800-137A, FISMA ISCM requirements, FedRAMP ConMon, and OMB A-130</p>
        </div>
        {alertJobs.length > 0 && (
          <span className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-white" style={{ background: "#ef4444" }}>
            <span className="h-1.5 w-1.5 rounded-full bg-white" />
            {alertJobs.length} Alert{alertJobs.length > 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Stats from real monitoring jobs */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: "Integrations Monitored", value: jobs.length, color: "#2563eb" },
          { label: "Normal", value: normalJobs.length, color: "#22c55e" },
          { label: "Drift Detected", value: jobs.filter(j => j.driftDetected).length, color: "#f59e0b" },
          { label: "Active Alerts", value: alertJobs.length, color: "#ef4444" },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl p-4 border border-slate-200">
            <p className="text-xs text-slate-500 font-medium">{s.label}</p>
            <p className="text-3xl font-bold mt-1" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-1 mb-6">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors" style={{ background: activeTab === t.id ? "#2563eb" : "#fff", color: activeTab === t.id ? "#fff" : "#64748b", border: "1px solid", borderColor: activeTab === t.id ? "#2563eb" : "#e2e8f0" }}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "dashboard" && (
        <div className="space-y-4">
          {isLoading ? (
            <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-sm text-slate-400">Loading monitoring status…</div>
          ) : jobs.length === 0 ? (
            <EmptyState
              icon={<svg className="h-7 w-7 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
              title="No integrations being monitored"
              body="Connect integrations from the Integrations page. Once connected, automated monitoring jobs will track drift and alert on changes."
            />
          ) : (
            <>
              {alertJobs.map(j => (
                <div key={j.integrationKey} className="bg-white rounded-xl border border-red-200 bg-red-50 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <StatusIndicator status="failure" />
                      <div>
                        <p className="text-sm font-bold text-slate-900">{j.integrationKey}</p>
                        <p className="text-xs text-slate-500">Last check: {j.lastRunAt ? new Date(j.lastRunAt).toLocaleString() : "Never"}</p>
                      </div>
                    </div>
                    {j.driftDetected && <span className="text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">Drift detected</span>}
                  </div>
                </div>
              ))}
              {normalJobs.length > 0 && (
                <div className="bg-white rounded-xl border border-slate-200 p-6">
                  <h3 className="text-sm font-bold text-slate-800 mb-3">All Clear ({normalJobs.length} integration{normalJobs.length !== 1 ? "s" : ""})</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {normalJobs.map(j => (
                      <div key={j.integrationKey} className="flex items-center gap-2 p-2 rounded-lg bg-green-50">
                        <span className="h-2 w-2 rounded-full bg-green-500 flex-shrink-0" />
                        <span className="text-xs text-slate-700 flex-1">{j.integrationKey}</span>
                        <span className="text-xs text-slate-400">{j.lastRunAt ? new Date(j.lastRunAt).toLocaleDateString() : "—"}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {activeTab === "strategy" && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-800">ISCM Monitoring Strategy (NIST SP 800-137A)</h3>
            <p className="text-xs text-slate-500 mt-1">Standard monitoring frequencies per control family — this is a reference table, not org-specific data</p>
          </div>
          <table className="w-full text-sm">
            <thead><tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Category</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Frequency</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Controls</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Method</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Risk Level</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {MONITORING_STRATEGY.map(s => (
                <tr key={s.category} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-bold text-slate-800">{s.category}</td>
                  <td className="px-4 py-3 text-xs text-slate-600">{s.frequency}</td>
                  <td className="px-4 py-3"><div className="flex flex-wrap gap-1">{s.controls.map(c => <span key={c} className="text-xs font-mono px-1 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100">{c}</span>)}</div></td>
                  <td className="px-4 py-3 text-xs text-slate-600">{s.method}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{s.riskLevel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === "metrics" && (
        <div>
          {isLoading ? (
            <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-sm text-slate-400">Loading…</div>
          ) : jobs.length === 0 ? (
            <EmptyState
              icon={<svg className="h-7 w-7 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5" /></svg>}
              title="No automated metrics yet"
              body="Connect integrations to enable automated metric collection. Each integration runs periodic checks and reports status here."
            />
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead><tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Integration</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Last Run</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Next Run</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Interval</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Drift</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {jobs.map(j => (
                    <tr key={j.integrationKey} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-800">{j.integrationKey}</td>
                      <td className="px-4 py-3"><StatusIndicator status={j.lastResult ?? "pending"} /></td>
                      <td className="px-4 py-3 text-xs text-slate-500">{j.lastRunAt ? new Date(j.lastRunAt).toLocaleString() : "—"}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{j.nextRunAt ? new Date(j.nextRunAt).toLocaleString() : "—"}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">Every {j.intervalHours}h</td>
                      <td className="px-4 py-3">{j.driftDetected ? <span className="text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">Detected</span> : <span className="text-xs text-slate-400">None</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === "drift" && (
        <EmptyState
          icon={<svg className="h-7 w-7 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" /></svg>}
          title="No drift events recorded"
          body="Score drift detection will record events when a connected integration's security posture regresses by more than the configured threshold. No events have been detected yet."
        />
      )}

      {activeTab === "reports" && (
        <EmptyState
          icon={<svg className="h-7 w-7 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>}
          title="No ConMon reports generated yet"
          body="Monthly and quarterly ConMon reports will appear here once your monitoring program has collected enough data. Connect integrations to start the clock."
        />
      )}
    </div>
  );
}

import { useState } from "react";

const MONITORING_STRATEGY = [
  { category: "Ongoing", frequency: "Continuous (Real-time)", controls: ["AC-2", "AC-11", "AU-2", "AU-6", "IR-4", "SI-4", "SI-4(1)"], method: "Automated", tools: ["Splunk SIEM", "CrowdStrike Falcon", "PagerDuty"], riskLevel: "High/Critical" },
  { category: "Weekly", frequency: "Every 7 days", controls: ["RA-5", "SI-2", "CM-7", "CM-8(1)", "AU-11"], method: "Automated", tools: ["Tenable.io", "Qualys", "Wiz", "CrowdStrike Falcon"], riskLevel: "High" },
  { category: "Monthly", frequency: "Every 30 days", controls: ["CA-7", "CM-3", "CM-6(1)", "RA-3", "IR-3(2)"], method: "Automated + Manual Review", tools: ["Dashboard Reports", "SIEM Analysis", "Vulnerability Trending"], riskLevel: "Moderate" },
  { category: "Quarterly", frequency: "Every 90 days", controls: ["CA-2", "PL-2", "SA-9", "AT-3", "AU-9(4)"], method: "Automated + Manual Assessment", tools: ["Assessment Reports", "Control Testing", "Configuration Audits"], riskLevel: "Moderate/Low" },
  { category: "Annual", frequency: "Yearly", controls: ["CA-2(1)", "CA-5", "PL-2(3)", "PS-4", "SA-12"], method: "Manual Assessment", tools: ["3PAO/C3PAO Assessment", "Penetration Testing", "Tabletop Exercises"], riskLevel: "Low" },
];

const METRIC_EVENTS = [
  { id: "M-001", name: "Unauthorized Access Attempts", type: "security", lastValue: 23, threshold: 50, status: "normal", frequency: "real_time", integration: "Okta", lastRun: "2026-05-13T10:32:00Z" },
  { id: "M-002", name: "Failed MFA Authentications (>3/user/day)", type: "identity", lastValue: 8, threshold: 15, status: "normal", frequency: "real_time", integration: "Cisco Duo", lastRun: "2026-05-13T10:30:00Z" },
  { id: "M-003", name: "Critical Vulnerabilities Unpatched (>30d)", type: "vulnerability", lastValue: 2, threshold: 0, status: "alert", frequency: "weekly", integration: "Tenable.io", lastRun: "2026-05-13T02:00:00Z" },
  { id: "M-004", name: "Endpoint Compliance Rate (MDM-enrolled)", type: "configuration", lastValue: 94, threshold: 95, status: "warning", frequency: "daily", integration: "Intune", lastRun: "2026-05-13T06:00:00Z" },
  { id: "M-005", name: "Privileged Account Activity (off-hours)", type: "audit", lastValue: 0, threshold: 5, status: "normal", frequency: "real_time", integration: "Splunk SIEM", lastRun: "2026-05-13T10:28:00Z" },
  { id: "M-006", name: "Data Exfiltration Anomalies", type: "dlp", lastValue: 0, threshold: 1, status: "normal", frequency: "real_time", integration: "Zscaler", lastRun: "2026-05-13T10:31:00Z" },
  { id: "M-007", name: "Certificate Expiration (within 30 days)", type: "pki", lastValue: 3, threshold: 5, status: "warning", frequency: "daily", integration: "AWS Certificate Manager", lastRun: "2026-05-13T07:00:00Z" },
  { id: "M-008", name: "Malware Detection Events", type: "malware", lastValue: 1, threshold: 3, status: "normal", frequency: "real_time", integration: "CrowdStrike Falcon", lastRun: "2026-05-13T10:25:00Z" },
  { id: "M-009", name: "Container Image Vulnerabilities (Critical)", type: "container", lastValue: 4, threshold: 0, status: "alert", frequency: "weekly", integration: "Wiz", lastRun: "2026-05-13T02:30:00Z" },
  { id: "M-010", name: "Audit Log Coverage (% of systems)", type: "audit", lastValue: 98, threshold: 100, status: "warning", frequency: "daily", integration: "Splunk SIEM", lastRun: "2026-05-13T08:00:00Z" },
];

const DRIFT_EVENTS = [
  { date: "2026-05-10", metric: "Endpoint Compliance Rate", previousValue: 97, currentValue: 94, changePercent: -3.1, trigger: "15 new endpoints added without Intune enrollment" },
  { date: "2026-05-07", metric: "Certificate Coverage", previousValue: 100, currentValue: 97, changePercent: -3.0, trigger: "3 legacy certificates approaching expiry in staging environment" },
  { date: "2026-05-05", metric: "Critical Vuln Unpatched", previousValue: 0, currentValue: 2, changePercent: 200, trigger: "CVE-2024-1234 (OpenSSL) and CVE-2024-3322 (Docker) detected" },
];

function StatusIndicator({ status }: { status: string }) {
  const cfg: Record<string, { label: string; color: string }> = {
    normal: { label: "Normal", color: "#22c55e" },
    warning: { label: "Warning", color: "#f59e0b" },
    alert: { label: "Alert", color: "#ef4444" },
  };
  const c = cfg[status] ?? cfg.normal;
  return (
    <span className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: c.color }}>
      <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />
      {c.label}
    </span>
  );
}

function downloadConMonReport() {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const reportLines: string[] = [];
  reportLines.push("CONTINUOUS MONITORING PROGRAM REPORT");
  reportLines.push("Generated: " + now.toLocaleString());
  reportLines.push("Framework: NIST SP 800-137A | FISMA ISCM | FedRAMP ConMon | OMB A-130");
  reportLines.push("");
  reportLines.push("=== EXECUTIVE SUMMARY ===");
  reportLines.push("Metrics Monitored: " + METRIC_EVENTS.length);
  reportLines.push("Normal: " + METRIC_EVENTS.filter(m => m.status === "normal").length);
  reportLines.push("Warnings: " + METRIC_EVENTS.filter(m => m.status === "warning").length);
  reportLines.push("Active Alerts: " + METRIC_EVENTS.filter(m => m.status === "alert").length);
  reportLines.push("");
  reportLines.push("=== METRIC STATUS ===");
  METRIC_EVENTS.forEach(m => {
    reportLines.push("[" + m.status.toUpperCase() + "] " + m.id + " - " + m.name);
    reportLines.push("  Source: " + m.integration + " | Current: " + m.lastValue + " | Threshold: " + m.threshold);
    reportLines.push("  Last Run: " + new Date(m.lastRun).toLocaleString());
    reportLines.push("");
  });
  reportLines.push("=== SCORE DRIFT EVENTS ===");
  DRIFT_EVENTS.forEach(d => {
    reportLines.push(d.date + " | " + d.metric + ": " + d.previousValue + " -> " + d.currentValue + " (" + d.changePercent + "%)");
    reportLines.push("  Trigger: " + d.trigger);
    reportLines.push("");
  });
  const blob = new Blob([reportLines.join("\n")], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "conmon-report-" + dateStr + ".txt"; a.click();
  URL.revokeObjectURL(url);
}

export default function ConMonProgram() {
  const [activeTab, setActiveTab] = useState<"dashboard"|"strategy"|"metrics"|"drift"|"reports">("dashboard");
  const [filterType, setFilterType] = useState("all");
  const [exporting, setExporting] = useState(false);

  const alertCount = METRIC_EVENTS.filter(m => m.status === "alert").length;
  const warningCount = METRIC_EVENTS.filter(m => m.status === "warning").length;
  const normalCount = METRIC_EVENTS.filter(m => m.status === "normal").length;
  const filteredMetrics = filterType === "all" ? METRIC_EVENTS : METRIC_EVENTS.filter(m => m.type === filterType);

  function handleExport() {
    setExporting(true);
    setTimeout(() => { downloadConMonReport(); setExporting(false); }, 400);
  }

  const tabs = [
    { id: "dashboard" as const, label: "ISCM Dashboard" },
    { id: "strategy" as const, label: "Monitoring Strategy" },
    { id: "metrics" as const, label: "Automated Metrics" },
    { id: "drift" as const, label: "Score Drift Detection" },
    { id: "reports" as const, label: "ConMon Reports" },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Continuous Monitoring Program</h1>
          <p className="text-sm text-slate-500 mt-1">ISCM program per NIST SP 800-137A, FISMA ISCM requirements, FedRAMP ConMon, and OMB A-130</p>
        </div>
        <div className="flex items-center gap-2">
          {alertCount > 0 && <span className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-white" style={{ background: "#ef4444" }}><span className="h-1.5 w-1.5 rounded-full bg-white" />{alertCount} Active Alert{alertCount > 1 ? "s" : ""}</span>}
          <button onClick={handleExport} disabled={exporting} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60" style={{ background: "#2563eb" }}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            {exporting ? "Exporting..." : "Export ConMon Report"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: "Metrics Monitored", value: METRIC_EVENTS.length, color: "#2563eb" },
          { label: "Normal", value: normalCount, color: "#22c55e" },
          { label: "Warnings", value: warningCount, color: "#f59e0b" },
          { label: "Active Alerts", value: alertCount, color: "#ef4444" },
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
          {METRIC_EVENTS.filter(m => m.status !== "normal").map(m => (
            <div key={m.id} className="bg-white rounded-xl border p-4" style={{ borderColor: m.status === "alert" ? "#fca5a5" : "#fde68a", background: m.status === "alert" ? "#fef2f2" : "#fffbeb" }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <StatusIndicator status={m.status} />
                  <div>
                    <p className="text-sm font-bold text-slate-900">{m.name}</p>
                    <p className="text-xs text-slate-500">Source: {m.integration} -- Last check: {new Date(m.lastRun).toLocaleString()}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-slate-800">{m.lastValue} <span className="text-xs font-normal text-slate-400">/ threshold {m.threshold}</span></p>
                  <p className="text-xs text-slate-400 capitalize">{m.frequency.replace("_", " ")} monitoring</p>
                </div>
              </div>
            </div>
          ))}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-sm font-bold text-slate-800 mb-3">All Systems Normal ({normalCount} metrics)</h3>
            <div className="grid grid-cols-2 gap-2">
              {METRIC_EVENTS.filter(m => m.status === "normal").map(m => (
                <div key={m.id} className="flex items-center gap-2 p-2 rounded-lg bg-green-50">
                  <span className="h-2 w-2 rounded-full bg-green-500 flex-shrink-0" />
                  <span className="text-xs text-slate-700 flex-1">{m.name}</span>
                  <span className="text-xs font-mono text-slate-500">{m.integration}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === "strategy" && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-800">ISCM Monitoring Strategy (NIST SP 800-137A)</h3>
            <p className="text-xs text-slate-500 mt-1">Monitoring frequency per control family based on risk level and automation capability</p>
          </div>
          <table className="w-full text-sm">
            <thead><tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Category</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Frequency</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Controls</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Method</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Tools</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {MONITORING_STRATEGY.map(s => (
                <tr key={s.category} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-bold text-slate-800">{s.category}</td>
                  <td className="px-4 py-3 text-xs text-slate-600">{s.frequency}</td>
                  <td className="px-4 py-3"><div className="flex flex-wrap gap-1">{s.controls.map(c => <span key={c} className="text-xs font-mono px-1 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100">{c}</span>)}</div></td>
                  <td className="px-4 py-3 text-xs text-slate-600">{s.method}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{s.tools.join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === "metrics" && (
        <div>
          <div className="flex gap-2 mb-4">
            {["all", "security", "identity", "vulnerability", "configuration", "audit", "dlp"].map(t => (
              <button key={t} onClick={() => setFilterType(t)} className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors capitalize" style={{ background: filterType === t ? "#2563eb" : "#fff", color: filterType === t ? "#fff" : "#64748b", border: "1px solid", borderColor: filterType === t ? "#2563eb" : "#e2e8f0" }}>
                {t}
              </button>
            ))}
          </div>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Metric</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Current</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Threshold</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Frequency</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Source</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {filteredMetrics.map(m => (
                  <tr key={m.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3"><p className="text-sm font-medium text-slate-800">{m.name}</p><p className="text-xs text-slate-400 capitalize">{m.type}</p></td>
                    <td className="px-4 py-3 font-bold text-slate-800">{m.lastValue}</td>
                    <td className="px-4 py-3 text-slate-500">{m.threshold}</td>
                    <td className="px-4 py-3"><StatusIndicator status={m.status} /></td>
                    <td className="px-4 py-3 text-xs text-slate-500 capitalize">{m.frequency.replace("_", " ")}</td>
                    <td className="px-4 py-3 text-xs font-medium text-slate-700">{m.integration}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "drift" && (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-sm font-semibold text-amber-800 mb-1">Regression Detection</p>
            <p className="text-xs text-amber-700">Score drift detection monitors changes in security posture metrics. Any regression of more than 2% triggers automated notification and POA&M consideration.</p>
          </div>
          {DRIFT_EVENTS.map((d, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-bold text-slate-800">{d.metric}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{new Date(d.date).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</p>
                  <p className="text-xs text-slate-600 mt-2 leading-relaxed">Trigger: {d.trigger}</p>
                </div>
                <div className="text-right flex-shrink-0 ml-4">
                  <p className="text-xs text-slate-500">Before: <span className="font-bold text-slate-800">{d.previousValue}</span></p>
                  <p className="text-xs text-slate-500">After: <span className="font-bold" style={{ color: d.changePercent < 0 ? "#ef4444" : "#22c55e" }}>{d.currentValue}</span></p>
                  <p className="text-sm font-bold mt-1" style={{ color: d.changePercent < 0 ? "#ef4444" : "#22c55e" }}>{d.changePercent > 0 ? "+" : ""}{d.changePercent}%</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === "reports" && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-sm font-bold text-slate-800 mb-4">ConMon Report Schedule</h3>
          <div className="space-y-3">
            {[
              { name: "Monthly Vulnerability Scan Summary", due: "15th of each month", status: "overdue", lastGenerated: "Apr 15, 2026" },
              { name: "Quarterly Control Assessment Report", due: "Jan 15, Apr 15, Jul 15, Oct 15", status: "completed", lastGenerated: "Apr 15, 2026" },
              { name: "Annual ISCM Program Review", due: "September 30, 2026", status: "upcoming", lastGenerated: "Sep 30, 2025" },
              { name: "FedRAMP Monthly ConMon Report", due: "1st business day of each month", status: "completed", lastGenerated: "May 1, 2026" },
              { name: "CDM Dashboard Data Feed", due: "Weekly (Mondays)", status: "completed", lastGenerated: "May 12, 2026" },
            ].map(r => (
              <div key={r.name} className="flex items-center justify-between p-4 rounded-xl border border-slate-200">
                <div>
                  <p className="text-sm font-medium text-slate-800">{r.name}</p>
                  <p className="text-xs text-slate-500">Due: {r.due} -- Last: {r.lastGenerated}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: r.status === "completed" ? "#22c55e22" : r.status === "overdue" ? "#ef444422" : "#f59e0b22", color: r.status === "completed" ? "#22c55e" : r.status === "overdue" ? "#ef4444" : "#f59e0b" }}>{r.status.charAt(0).toUpperCase() + r.status.slice(1)}</span>
                  <button onClick={handleExport} className="text-xs font-semibold text-blue-600 hover:text-blue-700">Generate</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

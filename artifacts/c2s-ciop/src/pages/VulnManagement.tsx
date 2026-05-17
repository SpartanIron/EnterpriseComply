import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiUrl } from "@/lib/queryClient";

// Normalized vulnerability register from multiple scanner sources
const MOCK_VULNS = [
  { id: "V-001", cveId: "CVE-2024-1234", title: "Critical Remote Code Execution in OpenSSL", severity: "Critical", cvss: 9.8, source: "Tenable.io", sourceId: "TNS-2024-1234", affectedAsset: "prod-web-01, prod-web-02", component: "OpenSSL 3.1.2", status: "open", slaDeadline: "2024-12-01", assignee: "Alice Johnson", discoveredAt: "2024-11-01", dueDate: "2024-12-01", daysRemaining: -5, framework: "FedRAMP High RA-5", duplicateOf: null, poamRef: "POA-2024-047" },
  { id: "V-002", cveId: "CVE-2024-5678", title: "Privilege Escalation in Linux Kernel", severity: "High", cvss: 8.1, source: "Qualys", sourceId: "QID-198732", affectedAsset: "k8s-node-01, k8s-node-02, k8s-node-03", component: "Linux Kernel 5.15", status: "in_remediation", slaDeadline: "2024-12-15", assignee: "Bob Williams", discoveredAt: "2024-11-05", dueDate: "2024-12-15", daysRemaining: 10, framework: "CMMC RM.L2-3.11.2", duplicateOf: null, poamRef: null },
  { id: "V-003", cveId: "CVE-2024-9012", title: "Authentication Bypass in Apache HTTP Server", severity: "High", cvss: 7.5, source: "Wiz", sourceId: "WIZ-2024-9012", affectedAsset: "api-gateway-prod", component: "Apache httpd 2.4.51", status: "open", slaDeadline: "2024-12-15", assignee: "Carol Davis", discoveredAt: "2024-11-10", dueDate: "2024-12-15", daysRemaining: 10, framework: "FedRAMP Moderate RA-5", duplicateOf: null, poamRef: null },
  { id: "V-004", cveId: "CVE-2024-3456", title: "SQL Injection in Customer API Endpoint", severity: "High", cvss: 7.2, source: "Veracode", sourceId: "VRC-4892-A", affectedAsset: "api-server-prod", component: "customer-api v2.3.1", status: "open", slaDeadline: "2024-12-15", assignee: "David Lee", discoveredAt: "2024-11-12", dueDate: "2024-12-15", daysRemaining: 10, framework: "CMMC SA.L3-3.12.1", duplicateOf: null, poamRef: "POA-2024-048" },
  { id: "V-005", cveId: "CVE-2024-7890", title: "Cross-Site Scripting in Dashboard UI", severity: "Medium", cvss: 5.4, source: "Snyk", sourceId: "SNYK-JS-4521", affectedAsset: "app.enterprisecomply.com", component: "react-dom 18.2.0", status: "in_remediation", slaDeadline: "2025-01-14", assignee: "Eve Martinez", discoveredAt: "2024-11-15", dueDate: "2025-01-14", daysRemaining: 40, framework: "SOC 2 CC7.2", duplicateOf: null, poamRef: null },
  { id: "V-006", cveId: "CVE-2024-1122", title: "Information Disclosure in Error Responses", severity: "Medium", cvss: 4.3, source: "Checkmarx", sourceId: "CXF-2024-1122", affectedAsset: "api-server-prod", component: "nestjs 10.x", status: "open", slaDeadline: "2025-01-14", assignee: null, discoveredAt: "2024-11-18", dueDate: "2025-01-14", daysRemaining: 40, framework: "NIST 800-53 SI-10", duplicateOf: null, poamRef: null },
  { id: "V-007", cveId: "CVE-2024-4433", title: "Insecure Direct Object Reference in File API", severity: "Medium", cvss: 6.5, source: "Orca Security", sourceId: "ORC-2024-4433", affectedAsset: "file-service-prod", component: "express 4.18.1", status: "accepted_risk", slaDeadline: "2025-01-14", assignee: "Alice Johnson", discoveredAt: "2024-11-08", dueDate: "2025-01-14", daysRemaining: 40, framework: "FedRAMP Moderate", duplicateOf: null, poamRef: null },
  { id: "V-008", cveId: "CVE-2024-2211", title: "Dependency Confusion Attack Surface", severity: "Low", cvss: 3.1, source: "Snyk", sourceId: "SNYK-JS-8811", affectedAsset: "build-pipeline", component: "npm registry", status: "closed", slaDeadline: "2025-03-14", assignee: "Frank Thompson", discoveredAt: "2024-10-20", dueDate: "2025-03-14", daysRemaining: 99, framework: "CMMC CM.L2-3.4.9", duplicateOf: null, poamRef: null },
  { id: "V-009", cveId: "CVE-2024-3322", title: "Container Escape via Privileged Container", severity: "Critical", cvss: 9.1, source: "CrowdStrike Falcon", sourceId: "CS-2024-3322", affectedAsset: "k8s-prod-cluster", component: "Docker runtime", status: "open", slaDeadline: "2024-12-01", assignee: "Bob Williams", discoveredAt: "2024-11-20", dueDate: "2024-12-01", daysRemaining: -5, framework: "FedRAMP High CM-6", duplicateOf: null, poamRef: "POA-2024-049" },
];

const SOURCES = ["All Sources", "Tenable.io", "Qualys", "Wiz", "Orca Security", "Snyk", "Veracode", "Checkmarx", "CrowdStrike Falcon", "SentinelOne"];
const SEVERITIES = ["all", "Critical", "High", "Medium", "Low"];
const STATUSES = ["all", "open", "in_remediation", "accepted_risk", "closed"];

const SLA_THRESHOLDS: Record<string, number> = {
  Critical: 30,
  High: 90,
  Medium: 180,
  Low: 365,
};

function SeverityBadge({ sev }: { sev: string }) {
  const cfg: Record<string, string> = { Critical: "#dc2626", High: "#ea580c", Medium: "#d97706", Low: "#65a30d" };
  const c = cfg[sev] ?? "#94a3b8";
  return <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: c + "22", color: c }}>{sev}</span>;
}
function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { label: string; color: string }> = {
    open: { label: "Open", color: "#ef4444" },
    in_remediation: { label: "In Remediation", color: "#f59e0b" },
    accepted_risk: { label: "Accepted Risk", color: "#8b5cf6" },
    closed: { label: "Closed", color: "#22c55e" },
  };
  const c = cfg[status] ?? { label: status, color: "#94a3b8" };
  return <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: c.color + "22", color: c.color }}>{c.label}</span>;
}

export default function VulnManagement() {
  const [search, setSearch] = useState("");
  const [filterSev, setFilterSev] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterSource, setFilterSource] = useState("All Sources");
  const [activeTab, setActiveTab] = useState<"register"|"sla"|"sources"|"trend">("register");

  const filtered = MOCK_VULNS.filter(v => {
    if (search && !v.cveId.toLowerCase().includes(search.toLowerCase()) && !v.title.toLowerCase().includes(search.toLowerCase()) && !v.affectedAsset.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterSev !== "all" && v.severity !== filterSev) return false;
    if (filterStatus !== "all" && v.status !== filterStatus) return false;
    if (filterSource !== "All Sources" && v.source !== filterSource) return false;
    return true;
  });

  const stats = {
    total: MOCK_VULNS.length,
    critical: MOCK_VULNS.filter(v => v.severity === "Critical" && v.status !== "closed").length,
    high: MOCK_VULNS.filter(v => v.severity === "High" && v.status !== "closed").length,
    overdue: MOCK_VULNS.filter(v => v.status !== "closed" && v.daysRemaining < 0).length,
    withPoam: MOCK_VULNS.filter(v => !!v.poamRef).length,
  };

  const sourceCounts = MOCK_VULNS.reduce((acc, v) => { acc[v.source] = (acc[v.source] || 0) + 1; return acc; }, {} as Record<string, number>);

  const tabs = [
    { id: "register" as const, label: "Vulnerability Register" },
    { id: "sla" as const, label: "SLA Compliance" },
    { id: "sources" as const, label: "Source Deduplication" },
    { id: "trend" as const, label: "Risk Trend" },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Vulnerability Management</h1>
          <p className="text-sm text-slate-500 mt-1">Normalized findings from Tenable, Qualys, Wiz, CrowdStrike, Snyk, Veracode, Checkmarx, Orca, and SentinelOne</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border border-slate-200 text-slate-700 hover:bg-slate-50">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            Export to POA&M
          </button>
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: "#2563eb" }}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            Sync Scanners
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        {[
          { label: "Total Findings", value: stats.total, color: "#2563eb" },
          { label: "Critical (Open)", value: stats.critical, color: "#dc2626" },
          { label: "High (Open)", value: stats.high, color: "#ea580c" },
          { label: "SLA Overdue", value: stats.overdue, color: "#ef4444" },
          { label: "Linked to POA&M", value: stats.withPoam, color: "#7c3aed" },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl p-4 border border-slate-200">
            <p className="text-xs text-slate-500 font-medium">{s.label}</p>
            <p className="text-3xl font-bold mt-1" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* SLA Reference */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
        <div className="flex items-center gap-2 mb-2">
          <svg className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <span className="text-xs font-semibold text-blue-700 uppercase tracking-wider">FedRAMP / CMMC Remediation SLAs</span>
        </div>
        <div className="flex gap-6">
          {Object.entries(SLA_THRESHOLDS).map(([sev, days]) => (
            <div key={sev} className="flex items-center gap-2">
              <SeverityBadge sev={sev} />
              <span className="text-xs text-blue-700 font-medium">{days} days</span>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors" style={{ background: activeTab === t.id ? "#2563eb" : "#fff", color: activeTab === t.id ? "#fff" : "#64748b", border: "1px solid", borderColor: activeTab === t.id ? "#2563eb" : "#e2e8f0" }}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "register" && (
        <>
          <div className="flex gap-3 mb-4">
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search CVE, title, asset..." className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <select value={filterSev} onChange={e => setFilterSev(e.target.value)} className="px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none">
              {SEVERITIES.map(s => <option key={s} value={s}>{s === "all" ? "All Severities" : s}</option>)}
            </select>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none">
              {STATUSES.map(s => <option key={s} value={s}>{s === "all" ? "All Statuses" : s.replace("_", " ").replace(/\b\w/g, l => l.toUpperCase())}</option>)}
            </select>
            <select value={filterSource} onChange={e => setFilterSource(e.target.value)} className="px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none">
              {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">CVE / Finding</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Severity</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Affected Asset</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Source</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">SLA</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">POA&M</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(v => (
                  <tr key={v.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800 text-xs">{v.title}</div>
                      <div className="text-xs text-blue-600 font-mono">{v.cveId}</div>
                      <div className="text-xs text-slate-400">CVSS {v.cvss}</div>
                    </td>
                    <td className="px-4 py-3"><SeverityBadge sev={v.severity} /></td>
                    <td className="px-4 py-3 text-xs text-slate-600">{v.affectedAsset}</td>
                    <td className="px-4 py-3 text-xs font-medium text-slate-700">{v.source}</td>
                    <td className="px-4 py-3"><StatusBadge status={v.status} /></td>
                    <td className="px-4 py-3">
                      {v.status !== "closed" ? (
                        <div>
                          <div className="text-xs font-semibold" style={{ color: v.daysRemaining < 0 ? "#ef4444" : v.daysRemaining < 14 ? "#f59e0b" : "#22c55e" }}>{v.daysRemaining < 0 ? `${Math.abs(v.daysRemaining)}d overdue` : `${v.daysRemaining}d remaining`}</div>
                          <div className="text-xs text-slate-400">Due {new Date(v.dueDate).toLocaleDateString()}</div>
                        </div>
                      ) : <span className="text-xs text-slate-400">Closed</span>}
                    </td>
                    <td className="px-4 py-3">{v.poamRef ? <span className="text-xs font-mono text-purple-600 bg-purple-50 px-2 py-0.5 rounded">{v.poamRef}</span> : <span className="text-xs text-slate-400">--</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {activeTab === "sla" && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-sm font-bold text-slate-800 mb-4">SLA Compliance by Severity</h3>
          {Object.entries(SLA_THRESHOLDS).map(([sev, days]) => {
            const sevVulns = MOCK_VULNS.filter(v => v.severity === sev && v.status !== "closed");
            const onTime = sevVulns.filter(v => v.daysRemaining >= 0).length;
            const overdue = sevVulns.filter(v => v.daysRemaining < 0).length;
            const pct = sevVulns.length > 0 ? Math.round((onTime / sevVulns.length) * 100) : 100;
            return (
              <div key={sev} className="mb-5">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2"><SeverityBadge sev={sev} /><span className="text-sm text-slate-600">{days}-day SLA -- {sevVulns.length} open findings</span></div>
                  <span className="text-sm font-bold" style={{ color: pct === 100 ? "#22c55e" : pct >= 80 ? "#f59e0b" : "#ef4444" }}>{pct}% on-time</span>
                </div>
                <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: pct + "%", background: pct === 100 ? "#22c55e" : pct >= 80 ? "#f59e0b" : "#ef4444" }} />
                </div>
                {overdue > 0 && <p className="text-xs text-red-500 mt-1">{overdue} finding{overdue > 1 ? "s" : ""} overdue -- requires POA&M escalation</p>}
              </div>
            );
          })}
        </div>
      )}

      {activeTab === "sources" && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-sm font-bold text-slate-800 mb-4">Scanner Source Distribution & Deduplication</h3>
          <div className="grid grid-cols-3 gap-4 mb-6">
            {Object.entries(sourceCounts).map(([source, count]) => (
              <div key={source} className="p-4 rounded-xl border border-slate-200 bg-slate-50">
                <p className="text-sm font-bold text-slate-800">{source}</p>
                <p className="text-2xl font-bold text-blue-600 mt-1">{count}</p>
                <p className="text-xs text-slate-500 mt-0.5">findings</p>
              </div>
            ))}
          </div>
          <div className="p-4 rounded-xl bg-green-50 border border-green-200">
            <p className="text-sm font-semibold text-green-800 mb-1">Deduplication Status</p>
            <p className="text-xs text-green-700 leading-relaxed">All {MOCK_VULNS.length} findings have been normalized and deduplicated across {Object.keys(sourceCounts).length} scanner sources using CVE ID matching and asset fingerprinting. No duplicate findings detected in current scan cycle.</p>
          </div>
        </div>
      )}

      {activeTab === "trend" && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-sm font-bold text-slate-800 mb-4">30-Day Vulnerability Risk Trend</h3>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Open Findings by Severity Over Time</p>
              <div className="space-y-3">
                {[
                  { week: "Week 1 (Nov 1-7)", critical: 3, high: 5, medium: 8, low: 2 },
                  { week: "Week 2 (Nov 8-14)", critical: 3, high: 6, medium: 7, low: 2 },
                  { week: "Week 3 (Nov 15-21)", critical: 2, high: 5, medium: 6, low: 1 },
                  { week: "Week 4 (Nov 22-28)", critical: 2, high: 4, medium: 5, low: 1 },
                ].map(w => (
                  <div key={w.week}>
                    <p className="text-xs text-slate-500 mb-1">{w.week}</p>
                    <div className="flex gap-1 h-6">
                      {[{v: w.critical, c: "#dc2626"}, {v: w.high, c: "#ea580c"}, {v: w.medium, c: "#d97706"}, {v: w.low, c: "#65a30d"}].map((s, i) => (
                        <div key={i} className="h-full rounded" style={{ width: (s.v * 20) + "px", background: s.c, opacity: 0.8 }} title={`${s.v} findings`} />
                      ))}
                      <span className="text-xs text-slate-500 ml-2 self-center">{w.critical + w.high + w.medium + w.low} total</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Remediation Velocity</p>
              <div className="space-y-2">
                {[
                  { metric: "Avg time to remediate Critical", value: "18 days", target: "30 days", ok: true },
                  { metric: "Avg time to remediate High", value: "67 days", target: "90 days", ok: true },
                  { metric: "Avg time to remediate Medium", value: "142 days", target: "180 days", ok: true },
                  { metric: "Findings opened this month", value: "9", target: "< 15", ok: true },
                  { metric: "Findings closed this month", value: "4", target: "> 5", ok: false },
                  { metric: "MTTR (Mean Time to Remediate)", value: "42 days", target: "< 45 days", ok: true },
                ].map(m => (
                  <div key={m.metric} className="flex items-center justify-between p-2 rounded-lg bg-slate-50">
                    <div>
                      <p className="text-xs font-medium text-slate-700">{m.metric}</p>
                      <p className="text-xs text-slate-400">Target: {m.target}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold" style={{ color: m.ok ? "#22c55e" : "#ef4444" }}>{m.value}</span>
                      <span className="text-xs">{m.ok ? "green_ok" : "red_x"}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

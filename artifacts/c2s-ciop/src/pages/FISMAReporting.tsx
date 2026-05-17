import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiUrl } from "@/lib/queryClient";

// FISMA Annual & Quarterly Reporting - CIO Metrics for FITARA Scorecard

const FISMA_METRICS = {
  fy2026q3: {
    quarter: "Q3 FY2026",
    reportingPeriod: "Apr 1 - Jun 30, 2026",
    dueDate: "August 14, 2026",
    overallScore: "B+",
    domains: [
      { id: "id_mgmt", name: "Identity Management", score: 92, weight: 11, grade: "A", trend: "up", nistControls: ["IA-2", "IA-5", "IA-8"], status: "green", details: "MFA enforced for 98% of users. ICAM program active. PIV-compatible authentication deployed." },
      { id: "dev_mgmt", name: "Device Management", score: 78, weight: 11, grade: "B", trend: "stable", nistControls: ["CM-6", "CM-7", "CM-8"], status: "yellow", details: "Asset inventory 94% complete. MDM coverage 89%. Missing certificate-based device auth on 12% of endpoints." },
      { id: "data_mgmt", name: "Data Management", score: 85, weight: 11, grade: "B+", trend: "up", nistControls: ["SC-28", "MP-2", "MP-3"], status: "green", details: "Data classification applied to 92% of repositories. DLP policies active." },
      { id: "network_apps", name: "Network & Application Security", score: 80, weight: 11, grade: "B", trend: "stable", nistControls: ["SC-7", "AC-4", "SI-3"], status: "yellow", details: "Zero trust network access deployed. Micro-segmentation in progress." },
      { id: "vuln_mgmt", name: "Vulnerability Management", score: 71, weight: 11, grade: "C+", trend: "down", nistControls: ["RA-5", "SI-2", "CM-6"], status: "yellow", details: "Critical vulns remediated within SLA: 67%. High vulns within SLA: 81%." },
      { id: "training", name: "Security Awareness & Training", score: 94, weight: 11, grade: "A", trend: "up", nistControls: ["AT-2", "AT-3"], status: "green", details: "100% annual training completion. Phishing simulation pass rate 94%." },
      { id: "conmon", name: "Continuous Monitoring", score: 88, weight: 11, grade: "B+", trend: "up", nistControls: ["CA-7", "SI-4", "AU-6"], status: "green", details: "ISCM program established. Automated evidence collection active." },
      { id: "incident_resp", name: "Incident Response", score: 82, weight: 11, grade: "B", trend: "stable", nistControls: ["IR-4", "IR-5", "IR-6"], status: "green", details: "IR plan tested Q3. CISA reporting within 1-hour threshold met." },
      { id: "contracts", name: "Contractor Systems", score: 76, weight: 11, grade: "B", trend: "stable", nistControls: ["SA-9", "SA-12"], status: "yellow", details: "93% of contractor systems with ATO. DFARS compliance for all 800-171 contracts verified." },
    ],
  }
};

const POAM_SUMMARY = { totalOpen: 47, criticalHigh: 8, scheduled30Days: 12, operationalRequirements: 3, riskAcceptances: 5, closedThisQuarter: 14 };
const INCIDENT_SUMMARY = { total: 6, category1: 0, category2: 1, category3: 2, category4: 3, cisaReported: 1, avgTimeToDetect: "4.2 hours", avgTimeToContain: "18.6 hours", avgTimeToRecover: "31.4 hours" };
const ATO_SUMMARY = { totalSystems: 24, authorized: 19, iatt: 2, inProgress: 3, expiring90Days: 3, highCategorized: 6, moderateCategorized: 14, lowCategorized: 4 };

function GradeBadge({ grade }: { grade: string }) {
  const cfg: Record<string, string> = { "A": "#22c55e", "B+": "#4ade80", "B": "#84cc16", "C+": "#f59e0b", "C": "#f97316", "D": "#ef4444" };
  const c = cfg[grade] ?? "#94a3b8";
  return <span className="text-lg font-black px-2.5 py-0.5 rounded-lg" style={{ background: c + "22", color: c }}>{grade}</span>;
}
function StatusDot({ status }: { status: string }) {
  const c = status === "green" ? "#22c55e" : status === "yellow" ? "#f59e0b" : "#ef4444";
  return <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ background: c }} />;
}


function downloadFISMAReport(quarter: string, reportingPeriod: string, domains: any[], title: string) {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const rLines: string[] = [];
  rLines.push("FISMA REPORTING PACKAGE - " + title);
  rLines.push("Quarter: " + quarter);
  rLines.push("Reporting Period: " + reportingPeriod);
  rLines.push("Generated: " + now.toLocaleString());
  rLines.push("Framework: OMB M-21-02 | CISA FISMA Metrics | FITARA");
  rLines.push("");
  rLines.push("=== CIO METRICS SCORECARD ===");
  domains.forEach((d: any) => {
    rLines.push(d.name + ": " + d.score + "% [" + d.grade + "] - " + d.status.toUpperCase());
    rLines.push("  NIST: " + d.nistControls.join(", "));
    rLines.push("  " + d.details);
    rLines.push("");
  });
  const blob = new Blob([rLines.join("\n")], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "fisma-report-" + dateStr + ".txt"; a.click();
  URL.revokeObjectURL(url);
}

export default function FISMAReporting() {
  const [activeTab, setActiveTab] = useState<"scorecard"|"poam"|"incidents"|"ato"|"export">("scorecard");
  const [activeQuarter, setActiveQuarter] = useState("fy2026q3");
  const [exporting, setExporting] = useState(false);
  function handleReport(t = "FISMA") { setExporting(true); setTimeout(() => { downloadFISMAReport(metrics.quarter, metrics.reportingPeriod, metrics.domains, t); setExporting(false); }, 400); }
  const metrics = FISMA_METRICS[activeQuarter as keyof typeof FISMA_METRICS] ?? FISMA_METRICS.fy2026q3;
  const tabs = [
    { id: "scorecard" as const, label: "FISMA Scorecard" },
    { id: "poam" as const, label: "POA&M Summary" },
    { id: "incidents" as const, label: "Incident Summary" },
    { id: "ato" as const, label: "ATO Inventory" },
    { id: "export" as const, label: "Export Packages" },
  ];
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">FISMA Reporting</h1>
          <p className="text-sm text-slate-500 mt-1">Federal Information Security Modernization Act reporting, CIO metrics, and FITARA scorecard preparation</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={activeQuarter} onChange={e => setActiveQuarter(e.target.value)} className="px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="fy2026q3">Q3 FY2026 (Apr-Jun 2026)</option>
            <option value="fy2026q2">Q2 FY2026 (Jan-Mar 2026)</option>
            <option value="fy2026q1">Q1 FY2026 (Oct-Dec 2025)</option>
            <option value="fy2025">Q4 FY2025 (Jul-Sep 2025)</option>
            <option value="fy2024q4">Q4 FY2024 (Jul-Sep 2024)</option>
          </select>
          <button onClick={() => handleReport()} disabled={exporting} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60" style={{ background: "#2563eb" }}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            {exporting ? "Generating..." : "Generate Report"}
          </button>
        </div>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Reporting Period</p>
            <p className="text-lg font-bold text-slate-900 mt-1">{metrics.quarter} -- {metrics.reportingPeriod}</p>
            <p className="text-sm text-slate-500">Due: {metrics.dueDate}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">Overall Grade</p>
            <GradeBadge grade={metrics.overallScore} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Metrics Green", value: metrics.domains.filter(d => d.status === "green").length },
              { label: "Metrics Yellow", value: metrics.domains.filter(d => d.status === "yellow").length },
              { label: "Metrics Red", value: metrics.domains.filter(d => d.status === "red").length },
            ].map(s => (
              <div key={s.label} className="text-center">
                <p className="text-2xl font-bold text-slate-800">{s.value}</p>
                <p className="text-xs text-slate-400">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="flex gap-1 mb-6">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors" style={{ background: activeTab === t.id ? "#2563eb" : "#fff", color: activeTab === t.id ? "#fff" : "#64748b", border: "1px solid", borderColor: activeTab === t.id ? "#2563eb" : "#e2e8f0" }}>
            {t.label}
          </button>
        ))}
      </div>
      {activeTab === "scorecard" && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800">FISMA CIO Metrics -- {metrics.quarter}</h3>
            <p className="text-xs text-slate-500">Per OMB M-21-02 and CISA FISMA Metrics guidance</p>
          </div>
          <table className="w-full text-sm">
            <thead><tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Domain</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Score</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Grade</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Status</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">NIST Controls</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Summary</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {metrics.domains.map(d => (
                <tr key={d.id} className="hover:bg-slate-50">
                  <td className="px-4 py-4 font-medium text-slate-800">{d.name}</td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden" style={{ minWidth: 60 }}>
                        <div className="h-full rounded-full" style={{ width: d.score + "%", background: d.score >= 90 ? "#22c55e" : d.score >= 75 ? "#84cc16" : d.score >= 60 ? "#f59e0b" : "#ef4444" }} />
                      </div>
                      <span className="text-sm font-bold text-slate-700">{d.score}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-4"><GradeBadge grade={d.grade} /></td>
                  <td className="px-4 py-4"><div className="flex items-center gap-2"><StatusDot status={d.status} /><span className="text-xs font-medium capitalize" style={{ color: d.status === "green" ? "#22c55e" : d.status === "yellow" ? "#f59e0b" : "#ef4444" }}>{d.status}</span></div></td>
                  <td className="px-4 py-4"><div className="flex flex-wrap gap-1">{d.nistControls.map(c => <span key={c} className="text-xs font-mono px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100">{c}</span>)}</div></td>
                  <td className="px-4 py-4 text-xs text-slate-500 max-w-xs">{d.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {activeTab === "poam" && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-sm font-bold text-slate-800 mb-4">POA&M Summary for FISMA Submission</h3>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Total Open POA&Ms", value: POAM_SUMMARY.totalOpen, color: "#2563eb" },
              { label: "Critical / High Risk", value: POAM_SUMMARY.criticalHigh, color: "#ef4444" },
              { label: "Due Within 30 Days", value: POAM_SUMMARY.scheduled30Days, color: "#f59e0b" },
              { label: "Operational Requirements", value: POAM_SUMMARY.operationalRequirements, color: "#8b5cf6" },
              { label: "Risk Acceptances", value: POAM_SUMMARY.riskAcceptances, color: "#6366f1" },
              { label: "Closed This Quarter", value: POAM_SUMMARY.closedThisQuarter, color: "#22c55e" },
            ].map(s => (
              <div key={s.label} className="p-4 rounded-xl border border-slate-200 bg-slate-50">
                <p className="text-xs text-slate-500 font-medium">{s.label}</p>
                <p className="text-3xl font-bold mt-1" style={{ color: s.color }}>{s.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      {activeTab === "incidents" && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-sm font-bold text-slate-800 mb-4">US-CERT Incident Summary</h3>
          <div className="grid grid-cols-4 gap-4 mb-6">
            {[
              { label: "Total Incidents", value: INCIDENT_SUMMARY.total, color: "#2563eb" },
              { label: "CISA-Reported", value: INCIDENT_SUMMARY.cisaReported, color: "#ef4444" },
              { label: "Avg Time to Detect", value: INCIDENT_SUMMARY.avgTimeToDetect, color: "#f59e0b" },
              { label: "Avg Time to Recover", value: INCIDENT_SUMMARY.avgTimeToRecover, color: "#8b5cf6" },
            ].map(s => (
              <div key={s.label} className="p-4 rounded-xl border border-slate-200 bg-slate-50">
                <p className="text-xs text-slate-500 font-medium">{s.label}</p>
                <p className="text-2xl font-bold mt-1" style={{ color: s.color }}>{s.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      {activeTab === "ato" && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-sm font-bold text-slate-800 mb-4">ATO Inventory (FISMA System Count)</h3>
          <div className="grid grid-cols-4 gap-4 mb-6">
            {[
              { label: "Total Systems", value: ATO_SUMMARY.totalSystems, color: "#2563eb" },
              { label: "Authorized (ATO)", value: ATO_SUMMARY.authorized, color: "#22c55e" },
              { label: "IATT", value: ATO_SUMMARY.iatt, color: "#f59e0b" },
              { label: "Expiring in 90 Days", value: ATO_SUMMARY.expiring90Days, color: "#ef4444" },
            ].map(s => (
              <div key={s.label} className="p-4 rounded-xl border border-slate-200 bg-slate-50">
                <p className="text-xs text-slate-500 font-medium">{s.label}</p>
                <p className="text-3xl font-bold mt-1" style={{ color: s.color }}>{s.value}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "High Impact (FIPS 199)", value: ATO_SUMMARY.highCategorized, color: "#ef4444", desc: "Requires FedRAMP High or equivalent authorization" },
              { label: "Moderate Impact (FIPS 199)", value: ATO_SUMMARY.moderateCategorized, color: "#f59e0b", desc: "Requires FedRAMP Moderate or equivalent authorization" },
              { label: "Low Impact (FIPS 199)", value: ATO_SUMMARY.lowCategorized, color: "#22c55e", desc: "Minimum baseline controls per NIST 800-53B Low" },
            ].map(s => (
              <div key={s.label} className="p-4 rounded-xl border border-slate-200">
                <p className="text-xs text-slate-500 font-medium">{s.label}</p>
                <p className="text-3xl font-bold mt-1" style={{ color: s.color }}>{s.value}</p>
                <p className="text-xs text-slate-400 mt-1">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      {activeTab === "export" && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-sm font-bold text-slate-800 mb-4">Export Report Packages</h3>
          <div className="grid grid-cols-2 gap-4">
            {[
              { title: "FISMA Annual Report", desc: "Complete FY annual submission per OMB M-21-02. Includes all 9 CIO metrics domains, POA&M summary, incident counts, and ATO inventory.", format: "PDF + Excel" },
              { title: "FISMA Quarterly CIO Report", desc: "Quarterly metrics update for CIO dashboard submission. Formatted per CISA FISMA Metrics template.", format: "Excel (.xlsx)" },
              { title: "FITARA Scorecard Data", desc: "Data export for FITARA scorecard contribution. Maps cybersecurity metrics to FITARA evaluation criteria.", format: "Excel + JSON" },
              { title: "CDM Dashboard Export", desc: "DEFEND/MANAGE/PROTECT/CONNECT data package for submission to CISA CDM Dashboard.", format: "STIX 2.1 / JSON" },
              { title: "eMASS Data Package", desc: "Authorization package data formatted for import into eMASS system of record.", format: "XML (eMASS)" },
              { title: "OSCAL System Security Plan", desc: "Machine-readable SSP in NIST OSCAL JSON format. Compatible with FedRAMP OSCAL validation tooling.", format: "OSCAL JSON" },
            ].map(p => (
              <div key={p.title} className="p-5 rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50/30 transition-all cursor-pointer">
                <div className="flex items-start justify-between mb-3">
                  <h4 className="text-sm font-bold text-slate-800">{p.title}</h4>
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600">{p.format}</span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed mb-3">{p.desc}</p>
                <button onClick={() => handleReport(p.title)} className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                Generate & Download
              </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

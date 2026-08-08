import { useState } from "react";
import { Link } from "wouter";

// SLA thresholds are standards config (FedRAMP/CMMC), not org data — keep as reference.
const SLA_THRESHOLDS: Record<string, number> = { Critical: 30, High: 90, Medium: 180, Low: 365 };

function SeverityBadge({ sev }: { sev: string }) {
  const cfg: Record<string, string> = { Critical: "#dc2626", High: "#ea580c", Medium: "#d97706", Low: "#65a30d" };
  const c = cfg[sev] ?? "#94a3b8";
  return <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: c + "22", color: c }}>{sev}</span>;
}

// P0-07: No vulnerability scanner API endpoint exists yet.
// When GET /orgs/:orgId/vulnerabilities is implemented, wire useQuery here and
// replace the ConnectPrompt with the real register/SLA/sources/trend tabs.
// MOCK_VULNS removed — it showed fake CVEs to every org regardless of real data.

export default function VulnManagement() {
  const [activeTab, setActiveTab] = useState<"register" | "sla" | "sources" | "trend">("register");

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
          <p className="text-sm text-slate-500 mt-1">Normalized findings from connected scanner integrations</p>
        </div>
        <Link href="/integrations">
          <a className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: "#2563eb" }}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
            Connect Scanners
          </a>
        </Link>
      </div>

      {/* Stats — all zero until a scanner is connected and synced */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        {[
          { label: "Total Findings", value: 0, color: "#2563eb" },
          { label: "Critical (Open)", value: 0, color: "#dc2626" },
          { label: "High (Open)", value: 0, color: "#ea580c" },
          { label: "SLA Overdue", value: 0, color: "#ef4444" },
          { label: "Linked to POA&M", value: 0, color: "#7c3aed" },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl p-4 border border-slate-200">
            <p className="text-xs text-slate-500 font-medium">{s.label}</p>
            <p className="text-3xl font-bold mt-1" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* SLA reference — standards config, not org data */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
        <div className="flex items-center gap-2 mb-2">
          <svg className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <span className="text-xs font-semibold text-blue-700 uppercase tracking-wider">FedRAMP / CMMC Remediation SLA Targets</span>
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

      {/* Empty state — honest "no scanner connected" for all tabs */}
      <div className="bg-white rounded-xl border border-slate-200 p-16 flex flex-col items-center text-center">
        <div className="h-16 w-16 rounded-full bg-blue-50 flex items-center justify-center mb-5">
          <svg className="h-8 w-8 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.955 11.955 0 01.06 9.684 11.955 11.955 0 003.598 18 11.959 11.959 0 0012 21.75 11.959 11.959 0 0020.402 18a11.955 11.955 0 003.538-8.316 11.955 11.955 0 00-3.538-8.316A11.959 11.959 0 0012 2.714z" />
          </svg>
        </div>
        <h3 className="text-base font-bold text-slate-800 mb-2">No vulnerability scanner connected</h3>
        <p className="text-sm text-slate-500 max-w-md leading-relaxed mb-6">
          Connect a scanner from the Integrations page to import real findings. Supported scanners: Tenable.io, Qualys, Wiz, CrowdStrike Falcon, Snyk, Veracode, Checkmarx, and Orca Security.
        </p>
        <p className="text-xs text-slate-400 mb-6">
          Once connected, this page will show your normalized vulnerability register, SLA compliance by severity, source deduplication, and risk trend over time.
        </p>
        <Link href="/integrations">
          <a className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
            Go to Integrations
          </a>
        </Link>
      </div>
    </div>
  );
}

import { useState } from "react";

// Cross-framework control mapping: UCO -> NIST 800-53 Rev 5 -> CMMC 2.0 -> NIST 800-171 Rev 3 -> SOC 2 TSC -> ISO 27001:2022
const CROSSWALK_DATA = [
  { ucoId: "UCO-AC-001", ucoName: "Multi-Factor Authentication", family: "Access Control",
    nist53: ["IA-2", "IA-2(1)", "IA-2(2)", "IA-2(6)", "IA-2(8)"],
    cmmc: ["AC.L2-3.5.3", "AC.L2-3.5.4"],
    nist171: ["3.5.3", "3.5.4"],
    soc2: ["CC6.1", "CC6.3"],
    iso27001: ["A.9.4.2", "A.9.4.3"],
    integrations: ["Okta", "Entra ID", "Cisco Duo"],
    status: "passing", coverage: 100 },
  { ucoId: "UCO-AC-002", ucoName: "Privileged Access Management", family: "Access Control",
    nist53: ["AC-2", "AC-3", "AC-6", "AC-6(5)", "AC-6(9)"],
    cmmc: ["AC.L2-3.1.5", "AC.L2-3.1.6"],
    nist171: ["3.1.5", "3.1.6"],
    soc2: ["CC6.1", "CC6.2"],
    iso27001: ["A.9.2.3", "A.9.4.4"],
    integrations: ["Okta", "HashiCorp Vault", "Entra ID"],
    status: "passing", coverage: 87 },
  { ucoId: "UCO-AC-003", ucoName: "Session Management & Timeout", family: "Access Control",
    nist53: ["AC-11", "AC-11(1)", "AC-12"],
    cmmc: ["AC.L2-3.1.10"],
    nist171: ["3.1.10"],
    soc2: ["CC6.1"],
    iso27001: ["A.9.4.2"],
    integrations: ["Okta", "Entra ID"],
    status: "passing", coverage: 100 },
  { ucoId: "UCO-CM-001", ucoName: "Endpoint Configuration Baseline", family: "Configuration Management",
    nist53: ["CM-2", "CM-6", "CM-6(1)", "CM-7"],
    cmmc: ["CM.L2-3.4.1", "CM.L2-3.4.2"],
    nist171: ["3.4.1", "3.4.2"],
    soc2: ["CC7.1"],
    iso27001: ["A.12.1.2", "A.12.6.1"],
    integrations: ["CrowdStrike Falcon", "Intune", "Jamf Pro"],
    status: "passing", coverage: 92 },
  { ucoId: "UCO-CM-002", ucoName: "Software Inventory & Allowlisting", family: "Configuration Management",
    nist53: ["CM-7(2)", "CM-7(4)", "CM-8", "CM-8(1)"],
    cmmc: ["CM.L2-3.4.6", "CM.L2-3.4.7", "CM.L2-3.4.9"],
    nist171: ["3.4.6", "3.4.7"],
    soc2: ["CC6.8"],
    iso27001: ["A.12.5.1", "A.12.6.2"],
    integrations: ["Intune", "Jamf Pro", "SentinelOne"],
    status: "failing", coverage: 64 },
  { ucoId: "UCO-VM-001", ucoName: "Vulnerability Scanning", family: "Vulnerability Management",
    nist53: ["RA-5", "RA-5(1)", "RA-5(2)", "RA-5(5)"],
    cmmc: ["RM.L2-3.11.2", "RM.L2-3.11.3"],
    nist171: ["3.11.2", "3.11.3"],
    soc2: ["CC7.1", "CC7.2"],
    iso27001: ["A.12.6.1"],
    integrations: ["Tenable.io", "Qualys", "Wiz", "Orca Security"],
    status: "passing", coverage: 98 },
  { ucoId: "UCO-VM-002", ucoName: "Patch Management & Remediation", family: "Vulnerability Management",
    nist53: ["SI-2", "SI-2(2)", "SI-2(3)", "CM-8(7)"],
    cmmc: ["SI.L2-3.14.1", "SI.L2-3.14.4"],
    nist171: ["3.14.1", "3.14.4"],
    soc2: ["CC7.2"],
    iso27001: ["A.12.6.1"],
    integrations: ["Intune", "CrowdStrike Falcon", "Qualys"],
    status: "partial", coverage: 71 },
  { ucoId: "UCO-IR-001", ucoName: "Security Incident Detection & Alerting", family: "Incident Response",
    nist53: ["IR-4", "IR-5", "IR-6", "SI-4", "SI-4(1)"],
    cmmc: ["IR.L2-3.6.1", "IR.L2-3.6.2"],
    nist171: ["3.6.1", "3.6.2"],
    soc2: ["CC7.3", "CC7.4"],
    iso27001: ["A.16.1.2", "A.16.1.4"],
    integrations: ["CrowdStrike Falcon", "Splunk SIEM", "PagerDuty"],
    status: "passing", coverage: 95 },
  { ucoId: "UCO-AU-001", ucoName: "Audit Log Collection & Retention", family: "Audit & Accountability",
    nist53: ["AU-2", "AU-3", "AU-9", "AU-11", "AU-12"],
    cmmc: ["AU.L2-3.3.1", "AU.L2-3.3.2"],
    nist171: ["3.3.1", "3.3.2"],
    soc2: ["CC7.2", "CC9.1"],
    iso27001: ["A.12.4.1", "A.12.4.3"],
    integrations: ["Splunk SIEM", "AWS CloudTrail", "Datadog"],
    status: "passing", coverage: 100 },
  { ucoId: "UCO-AU-002", ucoName: "Privileged User Activity Monitoring", family: "Audit & Accountability",
    nist53: ["AU-9(4)", "AU-12(3)", "AC-6(9)"],
    cmmc: ["AU.L2-3.3.5"],
    nist171: ["3.3.5"],
    soc2: ["CC6.2", "CC7.2"],
    iso27001: ["A.12.4.3"],
    integrations: ["Okta", "Splunk SIEM", "HashiCorp Vault"],
    status: "partial", coverage: 78 },
  { ucoId: "UCO-SC-001", ucoName: "Data-in-Transit Encryption", family: "System & Comm Protection",
    nist53: ["SC-8", "SC-8(1)", "SC-28"],
    cmmc: ["SC.L2-3.13.8"],
    nist171: ["3.13.8"],
    soc2: ["CC6.7"],
    iso27001: ["A.10.1.1"],
    integrations: ["AWS GovCloud", "Cloudflare", "Zscaler"],
    status: "passing", coverage: 100 },
  { ucoId: "UCO-SC-002", ucoName: "Data-at-Rest Encryption", family: "System & Comm Protection",
    nist53: ["SC-28", "SC-28(1)"],
    cmmc: ["SC.L2-3.13.16"],
    nist171: ["3.13.16"],
    soc2: ["CC6.7"],
    iso27001: ["A.10.1.1"],
    integrations: ["AWS GovCloud", "HashiCorp Vault"],
    status: "passing", coverage: 100 },
  { ucoId: "UCO-SA-001", ucoName: "SAST/DAST Application Security Testing", family: "System & Software Integrity",
    nist53: ["SA-11", "SA-11(1)", "SA-15"],
    cmmc: ["SA.L3-3.12.1"],
    nist171: ["N/A (L3)"],
    soc2: ["CC8.1"],
    iso27001: ["A.14.2.3", "A.14.2.8"],
    integrations: ["Snyk", "Veracode", "Checkmarx", "SonarQube"],
    status: "passing", coverage: 96 },
  { ucoId: "UCO-PE-001", ucoName: "Identity Governance & Lifecycle", family: "Personnel & Access Lifecycle",
    nist53: ["PS-4", "PS-5", "PS-7", "IA-4"],
    cmmc: ["PS.L2-3.9.1", "PS.L2-3.9.2"],
    nist171: ["3.9.1", "3.9.2"],
    soc2: ["CC6.2", "CC6.3"],
    iso27001: ["A.7.1.1", "A.7.1.2", "A.7.3.1"],
    integrations: ["Workday", "Okta", "Entra ID"],
    status: "partial", coverage: 83 },
];

const FRAMEWORKS = [
  { key: "nist53", label: "NIST 800-53 Rev 5", color: "#1d4ed8" },
  { key: "cmmc", label: "CMMC 2.0 (L2)", color: "#7c3aed" },
  { key: "nist171", label: "NIST 800-171 Rev 3", color: "#0891b2" },
  { key: "soc2", label: "SOC 2 TSC", color: "#059669" },
  { key: "iso27001", label: "ISO 27001:2022", color: "#d97706" },
];

const FAMILIES = ["All", ...Array.from(new Set(CROSSWALK_DATA.map(c => c.family)))];

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { label: string; color: string }> = {
    passing: { label: "Passing", color: "#22c55e" },
    partial: { label: "Partial", color: "#f59e0b" },
    failing: { label: "Failing", color: "#ef4444" },
    not_tested: { label: "Not Tested", color: "#94a3b8" },
  };
  const c = cfg[status] ?? cfg.not_tested;
  return <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: c.color + "22", color: c.color }}>{c.label}</span>;
}

export default function ControlCrosswalk() {
  const [search, setSearch] = useState("");
  const [filterFamily, setFilterFamily] = useState("All");
  const [filterStatus, setFilterStatus] = useState("all");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [activeFrameworks, setActiveFrameworks] = useState<string[]>(["nist53", "cmmc", "nist171", "soc2", "iso27001"]);

  const toggleFramework = (key: string) => {
    setActiveFrameworks(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  const filtered = CROSSWALK_DATA.filter(c => {
    if (search && !c.ucoId.toLowerCase().includes(search.toLowerCase()) && !c.ucoName.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterFamily !== "All" && c.family !== filterFamily) return false;
    if (filterStatus !== "all" && c.status !== filterStatus) return false;
    return true;
  });

  const stats = {
    total: CROSSWALK_DATA.length,
    passing: CROSSWALK_DATA.filter(c => c.status === "passing").length,
    partial: CROSSWALK_DATA.filter(c => c.status === "partial").length,
    failing: CROSSWALK_DATA.filter(c => c.status === "failing").length,
    avgCoverage: Math.round(CROSSWALK_DATA.reduce((s, c) => s + c.coverage, 0) / CROSSWALK_DATA.length),
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Control Crosswalk Engine</h1>
          <p className="text-sm text-slate-500 mt-1">Single-pane multi-framework mapping: UCO controls to NIST 800-53, CMMC, NIST 800-171, SOC 2, and ISO 27001</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: "#2563eb" }}>
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
          Export Crosswalk
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        {[
          { label: "UCO Controls Mapped", value: stats.total, color: "#2563eb" },
          { label: "Passing", value: stats.passing, color: "#22c55e" },
          { label: "Partial Coverage", value: stats.partial, color: "#f59e0b" },
          { label: "Failing / Gaps", value: stats.failing, color: "#ef4444" },
          { label: "Avg Coverage %", value: stats.avgCoverage + "%", color: "#7c3aed" },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl p-4 border border-slate-200">
            <p className="text-xs text-slate-500 font-medium">{s.label}</p>
            <p className="text-3xl font-bold mt-1" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Framework Toggles */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-3">Active Frameworks</p>
        <div className="flex flex-wrap gap-2">
          {FRAMEWORKS.map(fw => {
            const active = activeFrameworks.includes(fw.key);
            return (
              <button key={fw.key} onClick={() => toggleFramework(fw.key)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all border" style={{ background: active ? fw.color + "18" : "#f8fafc", borderColor: active ? fw.color : "#e2e8f0", color: active ? fw.color : "#94a3b8" }}>
                <div className="h-2 w-2 rounded-full" style={{ background: active ? fw.color : "#e2e8f0" }} />
                {fw.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search UCO ID or control name..." className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <select value={filterFamily} onChange={e => setFilterFamily(e.target.value)} className="px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          {FAMILIES.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="all">All Statuses</option>
          <option value="passing">Passing</option>
          <option value="partial">Partial</option>
          <option value="failing">Failing</option>
        </select>
      </div>

      {/* Crosswalk Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider w-36">UCO Control</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Control Name</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Status</th>
                {activeFrameworks.map(fk => {
                  const fw = FRAMEWORKS.find(f => f.key === fk);
                  return fw ? <th key={fk} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: fw.color }}>{fw.label}</th> : null;
                })}
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Coverage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(ctrl => {
                const expanded = expandedRow === ctrl.ucoId;
                return (
                  <>
                    <tr key={ctrl.ucoId} className="hover:bg-slate-50 cursor-pointer" onClick={() => setExpandedRow(expanded ? null : ctrl.ucoId)}>
                      <td className="px-4 py-3 font-mono text-xs font-bold text-blue-700">{ctrl.ucoId}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800">{ctrl.ucoName}</div>
                        <div className="text-xs text-slate-400">{ctrl.family}</div>
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={ctrl.status} /></td>
                      {activeFrameworks.map(fk => {
                        const fw = FRAMEWORKS.find(f => f.key === fk);
                        const vals = (ctrl as any)[fk] as string[];
                        return fw ? (
                          <td key={fk} className="px-4 py-3">
                            <div className="flex flex-wrap gap-1">
                              {vals.slice(0, 2).map(v => <span key={v} className="text-xs font-mono px-1.5 py-0.5 rounded border" style={{ background: fw.color + "10", color: fw.color, borderColor: fw.color + "30" }}>{v}</span>)}
                              {vals.length > 2 && <span className="text-xs text-slate-400">+{vals.length - 2}</span>}
                            </div>
                          </td>
                        ) : null;
                      })}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden" style={{ minWidth: 60 }}>
                            <div className="h-full rounded-full" style={{ width: ctrl.coverage + "%", background: ctrl.coverage >= 90 ? "#22c55e" : ctrl.coverage >= 70 ? "#f59e0b" : "#ef4444" }} />
                          </div>
                          <span className="text-xs font-semibold text-slate-600">{ctrl.coverage}%</span>
                        </div>
                      </td>
                    </tr>
                    {expanded && (
                      <tr key={ctrl.ucoId + "-exp"} className="bg-blue-50/50">
                        <td colSpan={3 + activeFrameworks.length + 1} className="px-6 py-4">
                          <div className="grid grid-cols-2 gap-6">
                            <div>
                              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Connected Integrations</p>
                              <div className="flex flex-wrap gap-2">
                                {ctrl.integrations.map(i => <span key={i} className="text-xs px-2 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 font-medium">{i}</span>)}
                              </div>
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Full Framework Mappings</p>
                              <div className="space-y-1">
                                {FRAMEWORKS.map(fw => {
                                  const vals = (ctrl as any)[fw.key] as string[];
                                  return (
                                    <div key={fw.key} className="flex items-center gap-2">
                                      <span className="text-xs font-medium w-36" style={{ color: fw.color }}>{fw.label}:</span>
                                      <span className="text-xs text-slate-600 font-mono">{vals.join(", ")}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="py-12 text-center text-slate-400">
            <p className="text-sm">No controls match your current filters</p>
          </div>
        )}
      </div>
    </div>
  );
}

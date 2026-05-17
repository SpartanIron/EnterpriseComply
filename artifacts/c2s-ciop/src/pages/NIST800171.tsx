import { useState } from "react";

// NIST SP 800-171 Rev 3 Readiness Assessment - DFARS/CMMC alignment

const NIST171_FAMILIES = [
  { id: "AC", name: "Access Control", rev3Controls: 25, rev2Controls: 22, newInRev3: 3, score: 88, status: "compliant" },
  { id: "AT", name: "Awareness and Training", rev3Controls: 5, rev2Controls: 3, newInRev3: 2, score: 100, status: "compliant" },
  { id: "AU", name: "Audit and Accountability", rev3Controls: 12, rev2Controls: 9, newInRev3: 3, score: 75, status: "partial" },
  { id: "CA", name: "Assessment, Authorization & Monitoring", rev3Controls: 9, rev2Controls: 0, newInRev3: 9, score: 56, status: "gap" },
  { id: "CM", name: "Configuration Management", rev3Controls: 14, rev2Controls: 9, newInRev3: 5, score: 79, status: "partial" },
  { id: "IA", name: "Identification and Authentication", rev3Controls: 12, rev2Controls: 11, newInRev3: 1, score: 92, status: "compliant" },
  { id: "IR", name: "Incident Response", rev3Controls: 8, rev2Controls: 3, newInRev3: 5, score: 62, status: "partial" },
  { id: "MA", name: "Maintenance", rev3Controls: 6, rev2Controls: 6, newInRev3: 0, score: 100, status: "compliant" },
  { id: "MP", name: "Media Protection", rev3Controls: 9, rev2Controls: 9, newInRev3: 0, score: 89, status: "compliant" },
  { id: "PE", name: "Physical and Environmental Protection", rev3Controls: 5, rev2Controls: 6, newInRev3: 0, score: 100, status: "compliant" },
  { id: "PL", name: "Planning", rev3Controls: 4, rev2Controls: 2, newInRev3: 2, score: 50, status: "gap" },
  { id: "PS", name: "Personnel Security", rev3Controls: 8, rev2Controls: 2, newInRev3: 6, score: 75, status: "partial" },
  { id: "PT", name: "PII Processing and Transparency", rev3Controls: 8, rev2Controls: 0, newInRev3: 8, score: 25, status: "gap" },
  { id: "RA", name: "Risk Assessment", rev3Controls: 10, rev2Controls: 3, newInRev3: 7, score: 60, status: "partial" },
  { id: "SA", name: "System and Services Acquisition", rev3Controls: 11, rev2Controls: 1, newInRev3: 10, score: 55, status: "partial" },
  { id: "SC", name: "System and Communications Protection", rev3Controls: 20, rev2Controls: 16, newInRev3: 4, score: 85, status: "compliant" },
  { id: "SI", name: "System and Information Integrity", rev3Controls: 13, rev2Controls: 7, newInRev3: 6, score: 77, status: "partial" },
  { id: "SR", name: "Supply Chain Risk Management", rev3Controls: 12, rev2Controls: 0, newInRev3: 12, score: 17, status: "gap" },
];

const KEY_CHANGES_REV3 = [
  { id: "CA", title: "New Family: Assessment, Authorization & Monitoring (CA)", impact: "critical", description: "Rev 3 introduces CA as a new family (was not in Rev 2). Requires formal assessment methodology, authorization decisions, and continuous monitoring program per NIST RMF." },
  { id: "PT", title: "New Family: PII Processing and Transparency (PT)", impact: "critical", description: "Introduces privacy controls aligned with OMB Circular A-130 and the Privacy Act. All contractors processing CUI with PII must implement PT family controls." },
  { id: "SR", title: "New Family: Supply Chain Risk Management (SR)", impact: "critical", description: "12 new controls covering software supply chain risk, C-SCRM programs, tamper resistance, and component authenticity per EO 14028." },
  { id: "IR-2", title: "Expanded Incident Response Requirements", impact: "high", description: "IR family grew from 3 to 8 controls. New requirements cover incident handling procedures, testing, and threat-informed response." },
  { id: "RA-2", title: "Expanded Risk Assessment Requirements", impact: "high", description: "RA grew from 3 to 10 controls. New requirements include supply chain risk assessments, criticality analysis, and vulnerability monitoring." },
  { id: "AC-3", title: "Stronger Access Control Requirements", impact: "medium", description: "3 new AC controls covering dynamic access control, protected processing environments, and enhanced remote access restrictions." },
  { id: "CM-2", title: "Configuration Management Expansion", impact: "medium", description: "5 new CM controls including software usage restrictions, system boot protection, and user-installed software controls." },
];

const CMMC_MAPPING = [
  { nist171: "03.01.01", cmmc: "AC.L1-3.1.1", title: "Authorized Access Control", level: "L1", status: "passing" },
  { nist171: "03.01.02", cmmc: "AC.L1-3.1.2", title: "Transaction & Function Control", level: "L1", status: "passing" },
  { nist171: "03.01.03", cmmc: "AC.L2-3.1.3", title: "Control CUI Flow", level: "L2", status: "partial" },
  { nist171: "03.05.03", cmmc: "AC.L2-3.5.3", title: "Multi-Factor Authentication", level: "L2", status: "passing" },
  { nist171: "03.05.10", cmmc: "AC.L2-3.5.10", title: "Cryptographically Protected Passwords", level: "L2", status: "passing" },
  { nist171: "03.11.01", cmmc: "RM.L2-3.11.1", title: "Risk Assessments", level: "L2", status: "partial" },
  { nist171: "03.11.02", cmmc: "RM.L2-3.11.2", title: "Vulnerability Scan", level: "L2", status: "passing" },
  { nist171: "03.13.05", cmmc: "SC.L2-3.13.5", title: "Public-Access System Separation", level: "L2", status: "passing" },
  { nist171: "03.13.11", cmmc: "SC.L2-3.13.11", title: "FIPS-Validated Cryptography", level: "L2", status: "partial" },
  { nist171: "03.14.06", cmmc: "SI.L2-3.14.6", title: "Monitor Organizational Systems", level: "L2", status: "passing" },
  { nist171: "03.04.01", cmmc: "CM.L2-3.4.1", title: "System Baseline Configurations", level: "L2", status: "passing" },
  { nist171: "03.04.09", cmmc: "CM.L2-3.4.9", title: "User-Installed Software", level: "L2", status: "partial" },
];

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { label: string; color: string }> = {
    compliant: { label: "Compliant", color: "#22c55e" },
    partial: { label: "Partial", color: "#f59e0b" },
    gap: { label: "Gap", color: "#ef4444" },
    passing: { label: "Passing", color: "#22c55e" },
    failing: { label: "Failing", color: "#ef4444" },
  };
  const c = cfg[status] ?? { label: status, color: "#94a3b8" };
  return <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: c.color + "22", color: c.color }}>{c.label}</span>;
}

function ImpactBadge({ impact }: { impact: string }) {
  const cfg: Record<string, { label: string; color: string }> = {
    critical: { label: "Critical Change", color: "#ef4444" },
    high: { label: "High Impact", color: "#ea580c" },
    medium: { label: "Medium Impact", color: "#f59e0b" },
  };
  const c = cfg[impact] ?? { label: impact, color: "#94a3b8" };
  return <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: c.color + "22", color: c.color }}>{c.label}</span>;
}

export default function NIST800171() {
  const [activeTab, setActiveTab] = useState<"overview"|"families"|"rev3changes"|"cmmc">("overview");
  const [filterStatus, setFilterStatus] = useState("all");

  const totalControls = NIST171_FAMILIES.reduce((s, f) => s + f.rev3Controls, 0);
  const compliantFamilies = NIST171_FAMILIES.filter(f => f.status === "compliant").length;
  const gapFamilies = NIST171_FAMILIES.filter(f => f.status === "gap").length;
  const overallScore = Math.round(NIST171_FAMILIES.reduce((s, f) => s + f.score, 0) / NIST171_FAMILIES.length);
  const newRev3Controls = NIST171_FAMILIES.reduce((s, f) => s + f.newInRev3, 0);

  const tabs = [
    { id: "overview" as const, label: "Rev 3 Overview" },
    { id: "families" as const, label: "Control Families" },
    { id: "rev3changes" as const, label: "Rev 2 vs Rev 3 Changes" },
    { id: "cmmc" as const, label: "CMMC 2.0 Crosswalk" },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">NIST SP 800-171 Rev 3 Readiness</h1>
          <p className="text-sm text-slate-500 mt-1">DFARS 252.204-7012 and CMMC 2.0 compliance readiness against NIST 800-171 Revision 3 (May 2024)</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">Rev 3 (May 2024)</div>
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: "#2563eb" }}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            Export Gap Report
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        {[
          { label: "Total Rev 3 Controls", value: totalControls, color: "#2563eb" },
          { label: "New in Rev 3 (vs Rev 2)", value: newRev3Controls, color: "#7c3aed" },
          { label: "Overall Readiness", value: overallScore + "%", color: overallScore >= 80 ? "#22c55e" : overallScore >= 60 ? "#f59e0b" : "#ef4444" },
          { label: "Compliant Families", value: compliantFamilies + "/18", color: "#22c55e" },
          { label: "Gap Families (Red)", value: gapFamilies, color: "#ef4444" },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl p-4 border border-slate-200">
            <p className="text-xs text-slate-500 font-medium">{s.label}</p>
            <p className="text-3xl font-bold mt-1" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors" style={{ background: activeTab === t.id ? "#2563eb" : "#fff", color: activeTab === t.id ? "#fff" : "#64748b", border: "1px solid", borderColor: activeTab === t.id ? "#2563eb" : "#e2e8f0" }}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "overview" && (
        <div className="grid grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-sm font-bold text-slate-800 mb-4">Readiness by Family (Top & Bottom)</h3>
            <div className="space-y-3">
              {[...NIST171_FAMILIES].sort((a, b) => a.score - b.score).map(f => (
                <div key={f.id}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-slate-700">{f.id} - {f.name}</span>
                    <span className="text-xs font-bold" style={{ color: f.score >= 80 ? "#22c55e" : f.score >= 60 ? "#f59e0b" : "#ef4444" }}>{f.score}%</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: f.score + "%", background: f.score >= 80 ? "#22c55e" : f.score >= 60 ? "#f59e0b" : "#ef4444" }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-xl p-5">
              <h3 className="text-sm font-bold text-red-800 mb-2">Critical Gaps for DFARS Compliance</h3>
              <ul className="space-y-1.5">
                {KEY_CHANGES_REV3.filter(c => c.impact === "critical").map(c => (
                  <li key={c.id} className="flex items-start gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-red-500 mt-1.5 flex-shrink-0" />
                    <span className="text-xs text-red-700">{c.title}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
              <h3 className="text-sm font-bold text-amber-800 mb-2">CMMC 2.0 Timeline</h3>
              <div className="space-y-2 text-xs text-amber-700">
                <p>CMMC Level 2 assessments required for all DoD contracts handling CUI after November 2025 enforcement date.</p>
                <p>NIST 800-171 Rev 3 aligns with CMMC 2.0 Level 2 (110 practices) and Level 3 (additional 24 practices from NIST 800-172).</p>
                <p>Contractors must achieve 80+ SPRS score and submit SSA to DAAPM/DCSA before contract award.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "families" && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Family</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Rev 3 Controls</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">New in Rev 3</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Readiness</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Status</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {NIST171_FAMILIES.map(f => (
                <tr key={f.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <span className="font-mono font-bold text-blue-700 text-xs mr-2">{f.id}</span>
                    <span className="font-medium text-slate-800">{f.name}</span>
                  </td>
                  <td className="px-4 py-3 font-bold text-slate-700">{f.rev3Controls}</td>
                  <td className="px-4 py-3">{f.newInRev3 > 0 ? <span className="text-xs font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full">+{f.newInRev3} new</span> : <span className="text-xs text-slate-400">none</span>}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden" style={{ minWidth: 80 }}>
                        <div className="h-full rounded-full" style={{ width: f.score + "%", background: f.score >= 80 ? "#22c55e" : f.score >= 60 ? "#f59e0b" : "#ef4444" }} />
                      </div>
                      <span className="text-xs font-semibold text-slate-600 w-8">{f.score}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={f.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === "rev3changes" && (
        <div className="space-y-4">
          {KEY_CHANGES_REV3.map(change => (
            <div key={change.id} className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-start justify-between mb-2">
                <h3 className="text-sm font-bold text-slate-800">{change.title}</h3>
                <ImpactBadge impact={change.impact} />
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">{change.description}</p>
            </div>
          ))}
        </div>
      )}

      {activeTab === "cmmc" && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-800">NIST 800-171 Rev 3 to CMMC 2.0 Practice Mapping</h3>
            <p className="text-xs text-slate-500 mt-1">CMMC Level 1 = 17 practices (FAR 52.204-21) | Level 2 = 110 practices (NIST 800-171) | Level 3 = 134 practices (adds NIST 800-172)</p>
          </div>
          <table className="w-full text-sm">
            <thead><tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">NIST 800-171 Rev 3</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">CMMC Practice</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Title</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">CMMC Level</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Status</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {CMMC_MAPPING.map(m => (
                <tr key={m.nist171} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs font-bold text-blue-700">{m.nist171}</td>
                  <td className="px-4 py-3 font-mono text-xs text-purple-700">{m.cmmc}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{m.title}</td>
                  <td className="px-4 py-3"><span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: m.level === "L1" ? "#22c55e22" : "#7c3aed22", color: m.level === "L1" ? "#22c55e" : "#7c3aed" }}>{m.level}</span></td>
                  <td className="px-4 py-3"><StatusBadge status={m.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

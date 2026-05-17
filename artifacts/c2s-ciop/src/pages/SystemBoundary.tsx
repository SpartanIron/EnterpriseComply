import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiUrl } from "@/lib/queryClient";

const FIPS_CATEGORIES = ["Low", "Moderate", "High"];
const INFO_TYPES = [
  { id: "C.2.1.1", name: "Facility Access Records", category: "Physical Security" },
  { id: "C.2.8.3", name: "Authentication & Identity Management", category: "Access Control" },
  { id: "C.3.2.1", name: "Vulnerability Management Data", category: "Cybersecurity" },
  { id: "C.3.3.1", name: "Incident Response Records", category: "Cybersecurity" },
  { id: "C.3.5.1", name: "Configuration Management Data", category: "IT Operations" },
  { id: "D.9.1.1", name: "Personnel Security Files", category: "HR & Personnel" },
  { id: "D.17.1", name: "Controlled Unclassified Information (CUI)", category: "CUI" },
];

const ATO_STATUSES = [
  { value: "not_started", label: "Not Started", color: "#94a3b8" },
  { value: "in_progress", label: "In Progress", color: "#f59e0b" },
  { value: "authorized", label: "Authorized (ATO)", color: "#22c55e" },
  { value: "ato_expired", label: "ATO Expired", color: "#ef4444" },
  { value: "iatt", label: "IATT", color: "#3b82f6" },
  { value: "denied", label: "Denied", color: "#dc2626" },
];

const CONTROL_INHERITANCE = [
  { type: "common", label: "Common (Inherited)", description: "Controls fully implemented by org-level program; system inherits" },
  { type: "hybrid", label: "Hybrid (Shared)", description: "Controls partially org-level, partially system-specific" },
  { type: "system", label: "System-Specific", description: "Controls implemented entirely by this system" },
];

const MOCK_SYSTEMS = [
  { id: 1, name: "Core Identity Platform", systemId: "EC-SYS-001", fipsConfidentiality: "Moderate", fipsIntegrity: "Moderate", fipsAvailability: "Moderate", overallCategory: "Moderate", atoStatus: "authorized", atoExpires: "2026-11-15", authorizingOfficial: "John Smith, AO", systemOwner: "Alice Johnson", issm: "Bob Williams", description: "Primary identity & access management infrastructure including Okta, Entra ID, and supporting SSO services.", infoTypes: ["C.2.8.3", "D.9.1.1"], components: ["Okta Identity Cloud", "Microsoft Entra ID", "Cisco Duo MFA", "HashiCorp Vault"], interconnections: ["EC-SYS-002 (read)", "EC-SYS-004 (bidirectional)"], commonControls: ["AC-2", "IA-2", "SC-7", "AU-2"] },
  { id: 2, name: "Endpoint Security Platform", systemId: "EC-SYS-002", fipsConfidentiality: "Moderate", fipsIntegrity: "High", fipsAvailability: "Low", overallCategory: "High", atoStatus: "in_progress", atoExpires: null, authorizingOfficial: "TBD", systemOwner: "Carol Davis", issm: "David Lee", description: "Endpoint detection, response, and device management including CrowdStrike Falcon, Intune, and Jamf.", infoTypes: ["C.3.2.1", "C.3.5.1"], components: ["CrowdStrike Falcon", "Microsoft Intune", "Jamf Pro", "SentinelOne"], interconnections: ["EC-SYS-001 (read)", "EC-SYS-003 (write)"], commonControls: ["CM-6", "SI-3", "SC-8", "AU-2"] },
  { id: 3, name: "DevSecOps Pipeline", systemId: "EC-SYS-003", fipsConfidentiality: "Low", fipsIntegrity: "Moderate", fipsAvailability: "Low", overallCategory: "Moderate", atoStatus: "authorized", atoExpires: "2027-08-30", authorizingOfficial: "Jane Miller, AO", systemOwner: "Eve Martinez", issm: "Frank Thompson", description: "CI/CD pipeline, application security scanning, and code repository services.", infoTypes: ["C.3.2.1", "C.3.5.1", "D.17.1"], components: ["GitHub Enterprise", "Snyk", "Veracode", "Checkmarx", "SonarQube"], interconnections: ["EC-SYS-002 (read)", "EC-SYS-004 (write)"], commonControls: ["SA-11", "CM-3", "AU-12", "SI-7"] },
  { id: 4, name: "Cloud Infrastructure", systemId: "EC-SYS-004", fipsConfidentiality: "High", fipsIntegrity: "High", fipsAvailability: "High", overallCategory: "High", atoStatus: "authorized", atoExpires: "2027-03-22", authorizingOfficial: "Jane Miller, AO", systemOwner: "George Brown", issm: "Helen Clark", description: "AWS GovCloud workloads, containerized services, and network security infrastructure.", infoTypes: ["C.2.8.3", "C.3.2.1", "C.3.3.1", "D.17.1"], components: ["AWS GovCloud", "Wiz", "Orca Security", "Lacework", "Cisco Umbrella"], interconnections: ["EC-SYS-001 (bidirectional)", "EC-SYS-003 (read)"], commonControls: ["SC-7", "SC-8", "AC-17", "CA-3", "AU-6"] },
];

function getStatusMeta(status: string, atoExpires?: string | null) {
  if (status === "authorized" && atoExpires && new Date(atoExpires) < new Date()) {
    return ATO_STATUSES.find(s => s.value === "ato_expired") ?? ATO_STATUSES[0];
  }
  return ATO_STATUSES.find(s => s.value === status) ?? ATO_STATUSES[0];
}

function FipsBadge({ level }: { level: string }) {
  const colors: Record<string, string> = { Low: "#22c55e", Moderate: "#f59e0b", High: "#ef4444" };
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold" style={{ background: (colors[level] ?? "#94a3b8") + "22", color: colors[level] ?? "#94a3b8" }}>{level}</span>
  );
}

export default function SystemBoundary() {
  const [activeSystem, setActiveSystem] = useState<typeof MOCK_SYSTEMS[0] | null>(null);
  const [activeTab, setActiveTab] = useState<"overview"|"categorization"|"inheritance"|"interconnections">("overview");

  const systems = MOCK_SYSTEMS;
  const overallStats = {
    total: systems.length,
    authorized: systems.filter(s => s.atoStatus === "authorized").length,
    inProgress: systems.filter(s => s.atoStatus === "in_progress").length,
    highCategory: systems.filter(s => s.overallCategory === "High").length,
    expiringSoon: systems.filter(s => { if (!s.atoExpires) return false; const d = new Date(s.atoExpires); const now = new Date(); const diff = (d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24); return diff > 0 && diff < 90; }).length,
  };
  const tabs = [
    { id: "overview" as const, label: "System Overview" },
    { id: "categorization" as const, label: "FIPS 199 Categorization" },
    { id: "inheritance" as const, label: "Control Inheritance" },
    { id: "interconnections" as const, label: "Interconnections" },
  ];
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">System Boundary Registry</h1>
          <p className="text-sm text-slate-500 mt-1">NIST RMF system categorization, boundary definition, and ATO status tracking</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: "#2563eb" }}>
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
          Register System
        </button>
      </div>
      <div className="grid grid-cols-5 gap-4 mb-6">
        {[
          { label: "Total Systems", value: overallStats.total, color: "#2563eb" },
          { label: "Authorized (ATO)", value: overallStats.authorized, color: "#22c55e" },
          { label: "Authorization In Progress", value: overallStats.inProgress, color: "#f59e0b" },
          { label: "High Categorization", value: overallStats.highCategory, color: "#ef4444" },
          { label: "ATO Expiring <90 Days", value: overallStats.expiringSoon, color: "#f97316" },
        ].map(stat => (
          <div key={stat.label} className="bg-white rounded-xl p-4 border border-slate-200">
            <p className="text-xs text-slate-500 font-medium">{stat.label}</p>
            <p className="text-3xl font-bold mt-1" style={{ color: stat.color }}>{stat.value}</p>
          </div>
        ))}
      </div>
      <div className="flex gap-4">
        <div className="w-72 flex-shrink-0 space-y-2">
          {systems.map(sys => {
            const sm = getStatusMeta(sys.atoStatus, sys.atoExpires);
            const active = activeSystem?.id === sys.id;
            return (
              <button key={sys.id} onClick={() => { setActiveSystem(sys); setActiveTab("overview"); }} className="w-full text-left p-4 rounded-xl border transition-all" style={{ background: active ? "#eff6ff" : "#fff", borderColor: active ? "#2563eb" : "#e2e8f0" }}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-mono text-slate-400">{sys.systemId}</span>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: sm.color + "22", color: sm.color }}>{sm.label}</span>
                </div>
                <p className="text-sm font-semibold text-slate-800">{sys.name}</p>
                <div className="flex items-center gap-1 mt-1.5">
                  <span className="text-xs text-slate-500">Category:</span>
                  <FipsBadge level={sys.overallCategory} />
                </div>
                {sys.atoExpires && <p className="text-xs text-slate-400 mt-1">ATO expires {new Date(sys.atoExpires).toLocaleDateString()}</p>}
              </button>
            );
          })}
        </div>
        <div className="flex-1 bg-white rounded-xl border border-slate-200 overflow-hidden">
          {!activeSystem ? (
            <div className="flex flex-col items-center justify-center h-80 text-slate-400">
              <svg className="h-12 w-12 mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" /></svg>
              <p className="text-sm font-medium">Select a system to view details</p>
            </div>
          ) : (
            <>
              <div className="px-6 pt-5 pb-4 border-b border-slate-100">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-slate-400">{activeSystem.systemId}</span>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: getStatusMeta(activeSystem.atoStatus, activeSystem.atoExpires).color + "22", color: getStatusMeta(activeSystem.atoStatus, activeSystem.atoExpires).color }}>{getStatusMeta(activeSystem.atoStatus, activeSystem.atoExpires).label}</span>
                    </div>
                    <h2 className="text-lg font-bold text-slate-900">{activeSystem.name}</h2>
                    <p className="text-sm text-slate-500 mt-1 max-w-xl">{activeSystem.description}</p>
                  </div>
                  <FipsBadge level={activeSystem.overallCategory} />
                </div>
                <div className="flex gap-1 mt-4">
                  {tabs.map(t => (
                    <button key={t.id} onClick={() => setActiveTab(t.id)} className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors" style={{ background: activeTab === t.id ? "#2563eb" : "transparent", color: activeTab === t.id ? "#fff" : "#64748b" }}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="p-6">
                {activeTab === "overview" && (
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-700 mb-3">Authorization Details</h3>
                      <dl className="space-y-2">
                        {[
                          { label: "Authorizing Official", value: activeSystem.authorizingOfficial || "Not assigned" },
                          { label: "System Owner", value: activeSystem.systemOwner },
                          { label: "ISSM", value: activeSystem.issm },
                          { label: "ATO Status", value: getStatusMeta(activeSystem.atoStatus, activeSystem.atoExpires).label },
                          { label: "ATO Expiration", value: activeSystem.atoExpires ? new Date(activeSystem.atoExpires).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "Not authorized" },
                        ].map(({ label, value }) => (
                          <div key={label} className="flex items-start gap-2">
                            <dt className="text-xs text-slate-500 w-40 flex-shrink-0 pt-0.5">{label}</dt>
                            <dd className="text-sm font-medium text-slate-800">{value}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-slate-700 mb-3">System Components</h3>
                      <ul className="space-y-1">
                        {activeSystem.components.map(c => (
                          <li key={c} className="flex items-center gap-2 text-sm text-slate-700">
                            <div className="h-1.5 w-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                            {c}
                          </li>
                        ))}
                      </ul>
                      <h3 className="text-sm font-semibold text-slate-700 mt-5 mb-3">Common Controls (Inherited)</h3>
                      <div className="flex flex-wrap gap-1.5">
                        {activeSystem.commonControls.map(c => (
                          <span key={c} className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs font-mono rounded border border-blue-100">{c}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                {activeTab === "categorization" && (
                  <div>
                    <h3 className="text-sm font-semibold text-slate-700 mb-4">FIPS 199 Security Categorization</h3>
                    <div className="overflow-hidden rounded-xl border border-slate-200">
                      <table className="w-full text-sm">
                        <thead><tr className="bg-slate-50 border-b border-slate-200">
                          <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Security Objective</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Impact Level</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Rationale</th>
                        </tr></thead>
                        <tbody className="divide-y divide-slate-100">
                          {[
                            { objective: "Confidentiality", level: activeSystem.fipsConfidentiality, rationale: "Based on data sensitivity and impact of unauthorized disclosure" },
                            { objective: "Integrity", level: activeSystem.fipsIntegrity, rationale: "Based on mission criticality and impact of data modification" },
                            { objective: "Availability", level: activeSystem.fipsAvailability, rationale: "Based on operational dependency and acceptable downtime" },
                          ].map(row => (
                            <tr key={row.objective} className="hover:bg-slate-50">
                              <td className="px-4 py-3 font-medium text-slate-800">{row.objective}</td>
                              <td className="px-4 py-3"><FipsBadge level={row.level} /></td>
                              <td className="px-4 py-3 text-slate-600 text-xs">{row.rationale}</td>
                            </tr>
                          ))}
                          <tr className="bg-slate-50"><td className="px-4 py-3 font-bold text-slate-900">Overall Categorization</td>
                          <td className="px-4 py-3"><FipsBadge level={activeSystem.overallCategory} /></td>
                          <td className="px-4 py-3 text-xs text-slate-600">SC = (Confidentiality, {activeSystem.fipsConfidentiality}), (Integrity, {activeSystem.fipsIntegrity}), (Availability, {activeSystem.fipsAvailability})</td></tr>
                        </tbody>
                      </table>
                    </div>
                    <h3 className="text-sm font-semibold text-slate-700 mt-6 mb-3">Information Types (NIST SP 800-60)</h3>
                    <div className="space-y-2">
                      {activeSystem.infoTypes.map(id => {
                        const it = INFO_TYPES.find(t => t.id === id);
                        return it ? (<div key={id} className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100">
                          <span className="text-xs font-mono text-slate-500">{it.id}</span>
                          <span className="text-sm font-medium text-slate-800 flex-1">{it.name}</span>
                          <span className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-100">{it.category}</span>
                        </div>) : null;
                      })}
                    </div>
                  </div>
                )}
                {activeTab === "inheritance" && (
                  <div>
                    <h3 className="text-sm font-semibold text-slate-700 mb-4">Control Inheritance Model</h3>
                    <div className="grid grid-cols-3 gap-4 mb-6">
                      {CONTROL_INHERITANCE.map(ci => (
                        <div key={ci.type} className="p-4 rounded-xl border border-slate-200 bg-slate-50">
                          <p className="text-sm font-bold text-slate-800">{ci.label}</p>
                          <p className="text-xs text-slate-500 mt-1 leading-relaxed">{ci.description}</p>
                        </div>
                      ))}
                    </div>
                    <div className="overflow-hidden rounded-xl border border-slate-200">
                      <table className="w-full text-sm">
                        <thead><tr className="bg-slate-50 border-b border-slate-200">
                          <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Control Family</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Controls</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Inheritance</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Provider</th>
                        </tr></thead>
                        <tbody className="divide-y divide-slate-100">
                          {[
                            { family: "Access Control", controls: "AC-1, AC-2, AC-3, AC-6", type: "common", provider: "Org Security Program" },
                            { family: "Identification & Authentication", controls: "IA-1, IA-2, IA-5, IA-8", type: "common", provider: "Org Security Program" },
                            { family: "Audit & Accountability", controls: "AU-2, AU-6, AU-9, AU-12", type: "hybrid", provider: "Shared: Org + System" },
                            { family: "System & Comm Protection", controls: "SC-7, SC-8, SC-12", type: "hybrid", provider: "Shared: Cloud Provider + Org" },
                            { family: "Configuration Management", controls: "CM-6, CM-7, CM-8", type: "system", provider: "This System" },
                            { family: "Incident Response", controls: "IR-1, IR-4, IR-5, IR-6", type: "system", provider: "This System" },
                          ].map(row => {
                            const typeColors: Record<string, string> = { common: "#22c55e", hybrid: "#f59e0b", system: "#2563eb" };
                            return (<tr key={row.family} className="hover:bg-slate-50">
                              <td className="px-4 py-3 font-medium text-slate-800">{row.family}</td>
                              <td className="px-4 py-3 text-xs font-mono text-slate-600">{row.controls}</td>
                              <td className="px-4 py-3"><span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: typeColors[row.type] + "22", color: typeColors[row.type] }}>{row.type.charAt(0).toUpperCase() + row.type.slice(1)}</span></td>
                              <td className="px-4 py-3 text-xs text-slate-500">{row.provider}</td>
                            </tr>);
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                {activeTab === "interconnections" && (
                  <div>
                    <h3 className="text-sm font-semibold text-slate-700 mb-4">System Interconnections (ISA/MOU)</h3>
                    <div className="space-y-3 mb-6">
                      {activeSystem.interconnections.map(ic => (
                        <div key={ic} className="flex items-center gap-3 p-4 rounded-xl border border-slate-200 bg-white">
                          <div className="h-8 w-8 rounded-full bg-purple-50 flex items-center justify-center flex-shrink-0">
                            <svg className="h-4 w-4 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-slate-800">{ic.split(" ")[0]}</p>
                            <p className="text-xs text-slate-500">Data flow: {ic.includes("bidirectional") ? "Bidirectional" : ic.includes("read") ? "Read-only" : "Write"} -- Authorized under ISA</p>
                          </div>
                          <span className="text-xs px-2 py-0.5 rounded bg-green-50 text-green-700 border border-green-100 font-medium">ISA Active</span>
                        </div>
                      ))}
                    </div>
                    <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
                      <div className="flex items-start gap-3">
                        <svg className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                        <div>
                          <p className="text-sm font-semibold text-amber-800">Authorization Boundary Note</p>
                          <p className="text-xs text-amber-700 mt-1 leading-relaxed">All system interconnections require a signed ISA and MOU per NIST SP 800-47. Ensure all interconnections are documented in the SSP before submitting for authorization.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

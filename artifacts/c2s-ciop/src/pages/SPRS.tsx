import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/queryClient";
import { useOrg } from "@/hooks/useOrg";

const READINESS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  high: { label: "High Readiness", color: "text-green-700", bg: "bg-green-50", border: "border-green-200" },
  medium: { label: "Medium Readiness", color: "text-yellow-700", bg: "bg-yellow-50", border: "border-yellow-200" },
  low: { label: "Low Readiness", color: "text-orange-700", bg: "bg-orange-50", border: "border-orange-200" },
  critical: { label: "Critical - Immediate Action Required", color: "text-red-700", bg: "bg-red-50", border: "border-red-200" },
};

const NIST_DOMAINS = [
  {
    id: "3.1", name: "Access Control", abbr: "AC",
    practices: [
      { id: "3.1.1", pts: 5, desc: "Limit system access to authorized users, processes, and devices" },
      { id: "3.1.2", pts: 5, desc: "Limit system access to transactions and functions authorized users are permitted to execute" },
      { id: "3.1.3", pts: 3, desc: "Control the flow of CUI in accordance with approved authorizations" },
      { id: "3.1.4", pts: 3, desc: "Separate duties of individuals to reduce risk of malevolent activity" },
      { id: "3.1.5", pts: 3, desc: "Employ the principle of least privilege" },
      { id: "3.1.6", pts: 1, desc: "Use non-privileged accounts when accessing non-security functions" },
      { id: "3.1.7", pts: 3, desc: "Prevent non-privileged users from executing privileged functions" },
      { id: "3.1.8", pts: 1, desc: "Limit unsuccessful logon attempts" },
      { id: "3.1.9", pts: 1, desc: "Provide privacy and security notices" },
      { id: "3.1.10", pts: 1, desc: "Use session lock with pattern-hiding displays after period of inactivity" },
      { id: "3.1.11", pts: 1, desc: "Terminate sessions after defined conditions" },
      { id: "3.1.12", pts: 3, desc: "Monitor and control remote access sessions" },
      { id: "3.1.13", pts: 3, desc: "Employ cryptographic mechanisms to protect confidentiality of remote access sessions" },
      { id: "3.1.14", pts: 3, desc: "Route remote access via managed access control points" },
      { id: "3.1.15", pts: 1, desc: "Authorize remote execution of privileged commands via remote access only for documented operational needs" },
      { id: "3.1.16", pts: 1, desc: "Authorize wireless access prior to allowing connections" },
      { id: "3.1.17", pts: 1, desc: "Protect wireless access using authentication and encryption" },
      { id: "3.1.18", pts: 1, desc: "Control connection of mobile devices" },
      { id: "3.1.19", pts: 1, desc: "Encrypt CUI on mobile devices and mobile computing platforms" },
      { id: "3.1.20", pts: 1, desc: "Verify and control all connections to external systems" },
      { id: "3.1.21", pts: 1, desc: "Limit use of portable storage devices on external systems" },
      { id: "3.1.22", pts: 1, desc: "Control CUI posted or processed on publicly accessible systems" },
    ],
  },
  {
    id: "3.2", name: "Awareness & Training", abbr: "AT",
    practices: [
      { id: "3.2.1", pts: 5, desc: "Ensure personnel are aware of security risks associated with their activities" },
      { id: "3.2.2", pts: 5, desc: "Ensure personnel are trained to carry out assigned security responsibilities" },
      { id: "3.2.3", pts: 1, desc: "Provide security awareness training on recognizing and reporting threats" },
    ],
  },
  {
    id: "3.3", name: "Audit & Accountability", abbr: "AU",
    practices: [
      { id: "3.3.1", pts: 5, desc: "Create and retain system audit logs to enable monitoring, analysis, investigation, and reporting" },
      { id: "3.3.2", pts: 5, desc: "Ensure actions of individual users can be traced to those users" },
      { id: "3.3.3", pts: 1, desc: "Review and update logged events" },
      { id: "3.3.4", pts: 1, desc: "Alert in event of audit logging process failure" },
      { id: "3.3.5", pts: 1, desc: "Correlate audit record review, analysis, and reporting processes" },
      { id: "3.3.6", pts: 1, desc: "Provide audit record reduction and report generation to support analysis" },
      { id: "3.3.7", pts: 1, desc: "Provide system capability that compares and synchronizes internal clocks" },
      { id: "3.3.8", pts: 1, desc: "Protect audit information and tools from unauthorized access, modification, and deletion" },
      { id: "3.3.9", pts: 1, desc: "Limit management of audit logging to a subset of privileged users" },
    ],
  },
  {
    id: "3.4", name: "Configuration Management", abbr: "CM",
    practices: [
      { id: "3.4.1", pts: 3, desc: "Establish and maintain baseline configurations and inventories of organizational systems" },
      { id: "3.4.2", pts: 3, desc: "Establish and enforce security configuration settings" },
      { id: "3.4.3", pts: 1, desc: "Track, review, approve, and log changes to organizational systems" },
      { id: "3.4.4", pts: 1, desc: "Analyze security impact of changes prior to implementation" },
      { id: "3.4.5", pts: 1, desc: "Define, document, approve, and enforce physical and logical access restrictions" },
      { id: "3.4.6", pts: 3, desc: "Employ the principle of least functionality" },
      { id: "3.4.7", pts: 3, desc: "Restrict, disable, or prevent use of nonessential programs, functions, ports, protocols, and services" },
      { id: "3.4.8", pts: 1, desc: "Apply deny-by-exception policy to prevent use of unauthorized software" },
      { id: "3.4.9", pts: 1, desc: "Control and monitor user-installed software" },
    ],
  },
  {
    id: "3.5", name: "Identification & Authentication", abbr: "IA",
    practices: [
      { id: "3.5.1", pts: 5, desc: "Identify system users, processes, and devices" },
      { id: "3.5.2", pts: 5, desc: "Authenticate identities of users, processes, and devices" },
      { id: "3.5.3", pts: 5, desc: "Use multifactor authentication for local and network access" },
      { id: "3.5.4", pts: 1, desc: "Employ replay-resistant authentication mechanisms" },
      { id: "3.5.5", pts: 1, desc: "Employ identifier management" },
      { id: "3.5.6", pts: 1, desc: "Disable identifiers after defined period of inactivity" },
      { id: "3.5.7", pts: 1, desc: "Enforce minimum password complexity and change requirements" },
      { id: "3.5.8", pts: 1, desc: "Prohibit password reuse for specified number of generations" },
      { id: "3.5.9", pts: 1, desc: "Allow temporary password use with immediate change requirement" },
      { id: "3.5.10", pts: 1, desc: "Store and transmit only cryptographically protected passwords" },
      { id: "3.5.11", pts: 1, desc: "Obscure feedback of authentication information" },
    ],
  },
  {
    id: "3.6", name: "Incident Response", abbr: "IR",
    practices: [
      { id: "3.6.1", pts: 5, desc: "Establish incident handling capability including preparation, detection, analysis, containment, recovery, and user activities" },
      { id: "3.6.2", pts: 3, desc: "Track, document, and report incidents to appropriate officials and/or authorities" },
      { id: "3.6.3", pts: 1, desc: "Test incident response capability" },
    ],
  },
  {
    id: "3.7", name: "Maintenance", abbr: "MA",
    practices: [
      { id: "3.7.1", pts: 5, desc: "Perform maintenance on organizational systems" },
      { id: "3.7.2", pts: 5, desc: "Provide controls on tools, techniques, mechanisms, and personnel for maintenance" },
      { id: "3.7.3", pts: 1, desc: "Ensure equipment removed for maintenance is sanitized" },
      { id: "3.7.4", pts: 1, desc: "Check media containing diagnostic programs for malicious code" },
      { id: "3.7.5", pts: 1, desc: "Require MFA to establish nonlocal maintenance sessions" },
      { id: "3.7.6", pts: 1, desc: "Supervise maintenance activities of personnel without required access authorization" },
    ],
  },
  {
    id: "3.8", name: "Media Protection", abbr: "MP",
    practices: [
      { id: "3.8.1", pts: 1, desc: "Protect system media containing CUI" },
      { id: "3.8.2", pts: 1, desc: "Limit access to CUI on system media to authorized users" },
      { id: "3.8.3", pts: 1, desc: "Sanitize or destroy system media before disposal or reuse" },
      { id: "3.8.4", pts: 1, desc: "Mark media with necessary CUI markings and distribution limitations" },
      { id: "3.8.5", pts: 1, desc: "Control access to media containing CUI" },
      { id: "3.8.6", pts: 1, desc: "Implement cryptographic mechanisms to protect CUI during transport unless protected by alternative physical safeguards" },
      { id: "3.8.7", pts: 1, desc: "Control use of removable media on system components" },
      { id: "3.8.8", pts: 1, desc: "Prohibit use of portable storage without identifiable owner" },
      { id: "3.8.9", pts: 1, desc: "Protect backups of CUI" },
    ],
  },
  {
    id: "3.9", name: "Personnel Security", abbr: "PS",
    practices: [
      { id: "3.9.1", pts: 3, desc: "Screen individuals prior to authorizing access to organizational systems containing CUI" },
      { id: "3.9.2", pts: 5, desc: "Ensure CUI is protected during and after personnel actions such as terminations and transfers" },
    ],
  },
  {
    id: "3.10", name: "Physical Protection", abbr: "PE",
    practices: [
      { id: "3.10.1", pts: 5, desc: "Limit physical access to organizational systems to authorized individuals" },
      { id: "3.10.2", pts: 3, desc: "Protect and monitor the physical facility and support infrastructure" },
      { id: "3.10.3", pts: 1, desc: "Escort visitors and monitor visitor activity" },
      { id: "3.10.4", pts: 1, desc: "Maintain audit logs of physical access" },
      { id: "3.10.5", pts: 1, desc: "Control and manage physical access devices" },
      { id: "3.10.6", pts: 1, desc: "Enforce safeguarding measures for CUI at alternate work sites" },
    ],
  },
  {
    id: "3.11", name: "Risk Assessment", abbr: "RA",
    practices: [
      { id: "3.11.1", pts: 5, desc: "Periodically assess risk to operations, assets, and individuals" },
      { id: "3.11.2", pts: 3, desc: "Scan for vulnerabilities periodically and when new vulnerabilities are identified" },
      { id: "3.11.3", pts: 3, desc: "Remediate vulnerabilities in accordance with risk assessments" },
    ],
  },
  {
    id: "3.12", name: "Security Assessment", abbr: "CA",
    practices: [
      { id: "3.12.1", pts: 5, desc: "Periodically assess security controls to determine effectiveness" },
      { id: "3.12.2", pts: 3, desc: "Develop and implement plans of action to correct deficiencies and reduce vulnerabilities" },
      { id: "3.12.3", pts: 3, desc: "Monitor security controls on an ongoing basis" },
      { id: "3.12.4", pts: 1, desc: "Develop, document, and periodically update system security plans" },
    ],
  },
  {
    id: "3.13", name: "System & Communications Protection", abbr: "SC",
    practices: [
      { id: "3.13.1", pts: 5, desc: "Monitor, control, and protect communications at external boundaries and key internal boundaries" },
      { id: "3.13.2", pts: 3, desc: "Employ architectural designs, software development techniques, and systems engineering that promote security" },
      { id: "3.13.3", pts: 1, desc: "Separate user functionality from system management functionality" },
      { id: "3.13.4", pts: 1, desc: "Prevent unauthorized and unintended information transfer via shared system resources" },
      { id: "3.13.5", pts: 3, desc: "Implement subnetworks for publicly accessible system components that are physically or logically separated" },
      { id: "3.13.6", pts: 3, desc: "Deny network communications traffic by default; allow by exception" },
      { id: "3.13.7", pts: 1, desc: "Prevent remote devices from simultaneously connecting to the system and other resources (split tunneling)" },
      { id: "3.13.8", pts: 5, desc: "Implement cryptographic mechanisms to prevent unauthorized disclosure of CUI during transmission" },
      { id: "3.13.9", pts: 1, desc: "Terminate network connections after defined period of inactivity" },
      { id: "3.13.10", pts: 1, desc: "Establish and manage cryptographic keys" },
      { id: "3.13.11", pts: 5, desc: "Employ FIPS-validated cryptography" },
      { id: "3.13.12", pts: 1, desc: "Prohibit remote activation of collaborative computing devices and provide indication to users" },
      { id: "3.13.13", pts: 1, desc: "Control and monitor use of mobile code" },
      { id: "3.13.14", pts: 1, desc: "Control and monitor use of VoIP technologies" },
      { id: "3.13.15", pts: 1, desc: "Protect authenticity of communications sessions" },
      { id: "3.13.16", pts: 1, desc: "Protect CUI at rest" },
    ],
  },
  {
    id: "3.14", name: "System & Information Integrity", abbr: "SI",
    practices: [
      { id: "3.14.1", pts: 5, desc: "Identify, report, and correct information and system flaws in a timely manner" },
      { id: "3.14.2", pts: 5, desc: "Provide protection from malicious code at appropriate locations" },
      { id: "3.14.3", pts: 5, desc: "Monitor system security alerts and advisories and take action in response" },
      { id: "3.14.4", pts: 3, desc: "Update malicious code protection mechanisms" },
      { id: "3.14.5", pts: 3, desc: "Perform periodic scans and real-time scans of files from external sources" },
      { id: "3.14.6", pts: 5, desc: "Monitor organizational systems to detect attacks and indicators of potential attacks" },
      { id: "3.14.7", pts: 5, desc: "Identify unauthorized use of organizational systems" },
    ],
  },
];

export default function SPRS() {
  const { orgId } = useOrg();
  const [showTable, setShowTable] = useState(false);
  const [expandedDomain, setExpandedDomain] = useState<string | null>(null);

  const { data, isLoading } = useQuery<any>({
    queryKey: ["sprs", orgId],
    queryFn: () => apiFetch(`/orgs/${orgId}/sprs`),
    enabled: !!orgId,
  });

  if (isLoading) {
    return (
      <div className="p-6 max-w-screen-xl">
        <div className="h-8 w-64 bg-slate-100 rounded animate-pulse mb-6" />
        <div className="grid grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="h-32 bg-slate-100 rounded-xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  const score = data?.score ?? -203;
  const readiness = data?.readinessLevel ?? "critical";
  const rc = READINESS_CONFIG[readiness];
  const scorePercent = Math.max(0, Math.min(100, ((score + 203) / 313) * 100));
  const nistScores: Record<string, { weight: number; status: string }> = data?.nistScores ?? {};

  return (
    <div className="p-6 max-w-screen-xl">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">SPRS Score Calculator</h1>
          <p className="text-sm text-slate-500 mt-0.5">Supplier Performance Risk System - NIST SP 800-171 / CMMC Level 2 DoD Assessment Methodology v1.2.1</p>
        </div>
        <a href="https://www.acq.osd.mil/asda/dpc/cp/cyber/docs/safeguarding/NIST-SP-800-171-Assessment-Methodology-Version-1.2.1-6.24.2020.pdf"
          target="_blank" rel="noopener noreferrer"
          className="text-xs text-blue-600 hover:underline">DoD Methodology PDF</a>
      </div>

      <div className={`border rounded-xl p-6 mb-6 ${rc.bg} ${rc.border}`}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm font-medium text-slate-600">Your SPRS Score</p>
            <p className={`text-6xl font-bold mt-1 ${rc.color}`}>{score > 0 ? `+${score}` : score}</p>
            <p className={`text-sm font-medium mt-1 ${rc.color}`}>{rc.label}</p>
          </div>
          <div className="text-right text-sm text-slate-500 space-y-1">
            <p>Target: <span className="font-bold text-green-700">+110</span></p>
            <p>Industry avg: <span className="font-bold text-red-600">-12</span></p>
            <p>Minimum: <span className="font-bold text-slate-700">-203</span></p>
          </div>
        </div>
        <div className="w-full bg-white rounded-full h-4 border border-slate-200 overflow-hidden">
          <div
            className={`h-4 rounded-full transition-all ${readiness === "high" ? "bg-green-500" : readiness === "medium" ? "bg-yellow-500" : readiness === "low" ? "bg-orange-500" : "bg-red-500"}`}
            style={{ width: `${scorePercent}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-slate-400 mt-1">
          <span>-203 (Min)</span><span>0</span><span>+110 (Max)</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Controls Met</p>
          <p className="text-3xl font-bold text-green-600 mt-1">{data?.met ?? 0}</p>
          <p className="text-sm text-slate-400 mt-0.5">of {data?.totalControls ?? 110} total</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Controls Not Met</p>
          <p className="text-3xl font-bold text-red-600 mt-1">{data?.notMet ?? 0}</p>
          <p className="text-sm text-slate-400 mt-0.5">need remediation</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Not Yet Assessed</p>
          <p className="text-3xl font-bold text-slate-400 mt-1">{data?.notReviewed ?? 0}</p>
          <p className="text-sm text-slate-400 mt-0.5">need testing</p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden mb-6">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">Top Gaps by Point Value</h2>
          <p className="text-xs text-slate-400 mt-0.5">Fixing these controls has the highest impact on your SPRS score</p>
        </div>
        <div className="divide-y divide-slate-100">
          {(data?.topGaps ?? []).map((gap: any, idx: number) => (
            <div key={gap.nistId} className="flex items-center px-5 py-3 hover:bg-slate-50">
              <span className="w-6 text-xs text-slate-400 font-medium">#{idx + 1}</span>
              <span className="w-28 text-sm font-mono font-medium text-slate-700">{gap.nistId}</span>
              <div className="flex-1 h-2 bg-slate-100 rounded-full mx-4">
                <div className="h-2 bg-red-400 rounded-full" style={{ width: `${(gap.weight / 5) * 100}%` }} />
              </div>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-md mr-3 ${gap.weight === 5 ? "bg-red-100 text-red-700" : gap.weight === 3 ? "bg-orange-100 text-orange-700" : "bg-slate-100 text-slate-600"}`}>
                {gap.weight === 5 ? "High" : gap.weight === 3 ? "Medium" : "Low"}
              </span>
              <span className="text-sm font-bold text-red-600 w-16 text-right">-{gap.weight} pts</span>
            </div>
          ))}
          {(data?.topGaps ?? []).length === 0 && (
            <div className="px-5 py-8 text-center text-sm text-slate-400">
              {data?.notMet === 0 ? "All tested controls are passing. Excellent CMMC readiness!" : "No gap data available yet. Run control tests first."}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden mb-6">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-slate-800">DoD Assessment Methodology - Weighting Table</h2>
            <p className="text-xs text-slate-400 mt-0.5">All 110 NIST SP 800-171 practices with DoD-assigned point values (1/3/5 per practice)</p>
          </div>
          <button
            onClick={() => setShowTable(!showTable)}
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            {showTable ? "Collapse" : "Expand all domains"}
            <svg className={`h-3.5 w-3.5 transition-transform ${showTable ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
        <div className="divide-y divide-slate-100">
          {NIST_DOMAINS.map((domain) => {
            const expanded = showTable || expandedDomain === domain.id;
            const domainMet = domain.practices.filter(p => nistScores[p.id]?.status === "met").length;
            const domainNotMet = domain.practices.filter(p => nistScores[p.id]?.status === "not_met").length;
            const domainPts5 = domain.practices.filter(p => p.pts === 5).length;
            const domainPts3 = domain.practices.filter(p => p.pts === 3).length;
            const domainPts1 = domain.practices.filter(p => p.pts === 1).length;

            return (
              <div key={domain.id}>
                <button
                  className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 text-left transition-colors"
                  onClick={() => setExpandedDomain(expanded && !showTable ? null : domain.id)}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono font-bold text-slate-400 w-8">{domain.id}</span>
                    <span className="text-sm font-semibold text-slate-800">{domain.name}</span>
                    <span className="text-xs text-slate-400">({domain.practices.length} practices)</span>
                    <div className="flex gap-1">
                      {domainPts5 > 0 && <span className="px-1.5 py-0.5 bg-red-100 text-red-700 text-xs font-bold rounded">{domainPts5}x5pt</span>}
                      {domainPts3 > 0 && <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 text-xs font-bold rounded">{domainPts3}x3pt</span>}
                      {domainPts1 > 0 && <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 text-xs font-bold rounded">{domainPts1}x1pt</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {Object.keys(nistScores).length > 0 && (
                      <div className="flex items-center gap-2 text-xs">
                        {domainMet > 0 && <span className="text-green-600 font-medium">{domainMet} met</span>}
                        {domainNotMet > 0 && <span className="text-red-600 font-medium">{domainNotMet} not met</span>}
                      </div>
                    )}
                    <svg className={`h-3.5 w-3.5 text-slate-400 transition-transform ${expanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>
                {expanded && (
                  <div className="border-t border-slate-100">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-slate-50">
                          <th className="px-5 py-2 text-left font-semibold text-slate-500 w-20">Practice</th>
                          <th className="px-5 py-2 text-left font-semibold text-slate-500">Description</th>
                          <th className="px-5 py-2 text-center font-semibold text-slate-500 w-20">Points</th>
                          <th className="px-5 py-2 text-center font-semibold text-slate-500 w-24">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {domain.practices.map((p) => {
                          const ns = nistScores[p.id];
                          return (
                            <tr key={p.id} className="hover:bg-slate-50/50">
                              <td className="px-5 py-2.5 font-mono font-medium text-slate-600">{p.id}</td>
                              <td className="px-5 py-2.5 text-slate-600">{p.desc}</td>
                              <td className="px-5 py-2.5 text-center">
                                <span className={`inline-block px-2 py-0.5 rounded font-bold ${p.pts === 5 ? "bg-red-50 text-red-700" : p.pts === 3 ? "bg-orange-50 text-orange-700" : "bg-slate-100 text-slate-600"}`}>
                                  {p.pts}
                                </span>
                              </td>
                              <td className="px-5 py-2.5 text-center">
                                {!ns || ns.status === "not_reviewed" ? (
                                  <span className="text-slate-300 text-xs">Not tested</span>
                                ) : ns.status === "met" ? (
                                  <span className="inline-flex items-center gap-1 text-green-600 font-semibold">
                                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                    Met
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-red-600 font-semibold">
                                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                    Not Met
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-500">
        <p className="font-semibold text-slate-700 mb-1">How SPRS Scoring Works (DoD Methodology v1.2.1)</p>
        <p className="mb-2">The SPRS score starts at <strong>-203</strong> (the negative sum of all practice weights). Each implemented practice adds back its weighted point value. A perfect score of <strong>+110</strong> means all 110 NIST SP 800-171 practices are fully implemented.</p>
        <p>Practices are weighted based on criticality: <strong className="text-red-700">5 points</strong> (highest - foundational security like MFA, audit logging, encryption, identity management), <strong className="text-orange-700">3 points</strong> (important - access control, configuration, risk assessment), and <strong className="text-slate-600">1 point</strong> (standard practices). CMMC Level 2 requires demonstrating all 110 practices during a C3PAO assessment.</p>
      </div>
    </div>
  );
}

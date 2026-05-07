import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/queryClient";
import { useOrg } from "@/hooks/useOrg";

const FRAMEWORK_LABELS: Record<string, string> = {
  soc2: "SOC 2", iso27001: "ISO 27001", fedramp: "FedRAMP", hipaa: "HIPAA",
  "pci-dss": "PCI DSS", "cmmc-l2": "CMMC L2", "nist-800-53": "NIST 800-53",
  "nist-800-171": "NIST 800-171", gdpr: "GDPR", sox: "SOX",
};

const EVIDENCE_TEMPLATES: Record<string, Array<{ title: string; description: string; ucoControlId: string }>> = {
  soc2: [
    { title: "User access list as of audit date", description: "Complete list of all users with access to in-scope systems, including roles and access levels.", ucoControlId: "UCO-AC-001" },
    { title: "MFA enforcement evidence", description: "Screenshots or configuration exports showing MFA is required for all production system access.", ucoControlId: "UCO-AI-001" },
    { title: "Vendor risk assessment", description: "Documentation of the vendor risk assessment process and completed assessments for critical vendors.", ucoControlId: "UCO-TP-001" },
    { title: "Incident response plan", description: "Current version of the incident response plan, including escalation procedures and contact lists.", ucoControlId: "UCO-IR-001" },
    { title: "Change management policy and logs", description: "Change management policy document and CAB approval records for changes made during the audit period.", ucoControlId: "UCO-CM-003" },
    { title: "Employee security training completion", description: "Training completion report showing all employees completed annual security awareness training.", ucoControlId: "UCO-ST-002" },
    { title: "Vulnerability scan results", description: "Most recent vulnerability scan results with remediation status for critical and high findings.", ucoControlId: "UCO-VM-001" },
    { title: "Business continuity and DR plan", description: "BCP/DR plan document with last test date, test results, and any identified gaps.", ucoControlId: "UCO-BC-001" },
    { title: "Background check completion report", description: "HR report confirming all employees and contractors underwent background screening prior to access.", ucoControlId: "UCO-ST-001" },
    { title: "Encryption configuration evidence", description: "Configuration exports showing encryption at rest and in transit for all in-scope data stores.", ucoControlId: "UCO-DP-001" },
  ],
  iso27001: [
    { title: "Information security policy", description: "Current approved information security policy signed by senior management.", ucoControlId: "UCO-GV-001" },
    { title: "Risk assessment and treatment plan", description: "Formal risk assessment methodology, most recent risk register, and risk treatment plan.", ucoControlId: "UCO-RM-001" },
    { title: "Statement of applicability (SoA)", description: "ISO 27001 Annex A SoA showing all 93 controls with applicability justification and implementation status.", ucoControlId: "UCO-GV-001" },
    { title: "Internal audit report", description: "Most recent internal audit report covering ISMS effectiveness.", ucoControlId: "UCO-GV-002" },
    { title: "Asset inventory", description: "Information asset inventory including asset owners, classification, and handling requirements.", ucoControlId: "UCO-AC-004" },
    { title: "Access control matrix", description: "Role-based access control documentation for all in-scope systems.", ucoControlId: "UCO-AC-001" },
    { title: "Supplier agreements", description: "Information security clauses in supplier contracts and supplier assessment records.", ucoControlId: "UCO-TP-001" },
    { title: "Physical security evidence", description: "Documentation of physical access controls, CCTV logs, and visitor registers for data center/office.", ucoControlId: "UCO-PS-001" },
  ],
  fedramp: [
    { title: "System Security Plan (SSP)", description: "Complete SSP document describing the authorization boundary, system components, and control implementation.", ucoControlId: "UCO-GV-001" },
    { title: "Plan of Action and Milestones (POA&M)", description: "Current POA&M with all open findings, risk scores, remediation owners, and milestone dates.", ucoControlId: "UCO-VM-001" },
    { title: "Continuous monitoring report", description: "ConMon report including vulnerability scan results, configuration scans, and incident summary.", ucoControlId: "UCO-AL-001" },
    { title: "Incident response procedures", description: "FedRAMP-compliant IR procedures including US-CERT reporting timelines and escalation matrix.", ucoControlId: "UCO-IR-001" },
    { title: "Supply chain risk management plan", description: "SCRM plan covering software and hardware supply chain risk assessment and controls.", ucoControlId: "UCO-TP-001" },
    { title: "FIPS 140-2/3 cryptography evidence", description: "Documentation of FIPS-validated cryptographic modules used in the authorization boundary.", ucoControlId: "UCO-DP-001" },
    { title: "Personnel security background checks", description: "Evidence of personnel background screening meeting NIST SP 800-53 PS control requirements.", ucoControlId: "UCO-ST-001" },
    { title: "Configuration management plan", description: "CM plan, baseline configurations, and change control procedures for in-scope components.", ucoControlId: "UCO-CM-003" },
  ],
  hipaa: [
    { title: "HIPAA risk analysis", description: "Formal risk analysis identifying potential vulnerabilities to ePHI confidentiality, integrity, and availability.", ucoControlId: "UCO-RM-001" },
    { title: "Business Associate Agreements", description: "Executed BAAs with all vendors and business associates who access, create, or maintain ePHI.", ucoControlId: "UCO-TP-001" },
    { title: "Access control policies for ePHI", description: "Policies and configuration evidence showing minimum-necessary access to ePHI systems.", ucoControlId: "UCO-AC-001" },
    { title: "Audit log configuration for ePHI systems", description: "Audit log settings and sample logs demonstrating tracking of ePHI access and modifications.", ucoControlId: "UCO-AL-001" },
    { title: "Security awareness training records", description: "Training completion records for all workforce members with ePHI access.", ucoControlId: "UCO-ST-002" },
    { title: "Breach notification procedures", description: "Documented breach notification procedures including 60-day HHS reporting requirement.", ucoControlId: "UCO-IR-002" },
  ],
  "pci-dss": [
    { title: "Network segmentation diagram", description: "Network diagram showing CDE isolation, firewall rules, and segmentation controls.", ucoControlId: "UCO-VM-003" },
    { title: "Firewall configuration review", description: "Quarterly firewall and router configuration reviews with documented approvals.", ucoControlId: "UCO-AC-002" },
    { title: "PAN masking and encryption evidence", description: "Evidence that PANs are masked in display and encrypted at rest and in transit.", ucoControlId: "UCO-DP-001" },
    { title: "ASV scan results (quarterly)", description: "Most recent quarterly ASV external vulnerability scan results showing passing status.", ucoControlId: "UCO-VM-001" },
    { title: "Penetration test results", description: "Annual penetration test report covering the CDE perimeter and internal segmentation.", ucoControlId: "UCO-VM-001" },
    { title: "Log monitoring evidence", description: "Evidence of daily log review procedures and SIEM alert configuration for CDE events.", ucoControlId: "UCO-AL-001" },
  ],
  "cmmc-l2": [
    { title: "System Security Plan (SSP)", description: "SSP documenting implementation of all 110 NIST SP 800-171 practices for the assessment scope.", ucoControlId: "UCO-GV-001" },
    { title: "SPRS score documentation", description: "Current SPRS score report with evidence supporting the self-assessment score.", ucoControlId: "UCO-VM-001" },
    { title: "CUI identification and marking", description: "Evidence of CUI identification, marking, and handling procedures across all relevant systems.", ucoControlId: "UCO-DP-002" },
    { title: "Multi-factor authentication evidence", description: "Evidence of MFA enforcement for all accounts with access to CUI.", ucoControlId: "UCO-AI-001" },
    { title: "Incident response plan", description: "IR plan meeting CMMC domain IR.2.092 and IR.2.093 requirements.", ucoControlId: "UCO-IR-001" },
    { title: "Media protection policy and evidence", description: "Media protection policy and evidence of secure disposal procedures for CUI media.", ucoControlId: "UCO-DP-003" },
  ],
  "nist-800-53": [
    { title: "Security categorization (FIPS 199)", description: "FIPS 199 categorization document with impact ratings for confidentiality, integrity, and availability.", ucoControlId: "UCO-GV-001" },
    { title: "Control implementation summary", description: "Summary of all implemented NIST 800-53 controls with implementation status and responsible parties.", ucoControlId: "UCO-GV-001" },
    { title: "Continuous monitoring strategy", description: "Continuous monitoring strategy document and monthly status reporting.", ucoControlId: "UCO-AL-001" },
    { title: "Authorization to operate (ATO) package", description: "Complete ATO package including risk assessment, security assessment report, and AO decision.", ucoControlId: "UCO-GV-001" },
  ],
};

const READINESS_CHECKLIST: Record<string, Array<{ label: string; category: string }>> = {
  soc2: [
    { label: "Information security policy approved and published", category: "Policies" },
    { label: "All employees completed security awareness training", category: "Training" },
    { label: "MFA enforced for all production system access", category: "Access Control" },
    { label: "Vendor risk assessments completed for critical vendors", category: "Vendor Management" },
    { label: "Incident response plan tested in past 12 months", category: "Incident Response" },
    { label: "Vulnerability scans completed with findings remediated", category: "Vulnerability Mgmt" },
    { label: "Change management process documented with approval records", category: "Change Mgmt" },
    { label: "Access reviews completed quarterly", category: "Access Control" },
    { label: "Business continuity plan tested", category: "Business Continuity" },
    { label: "Encryption configured at rest and in transit", category: "Data Protection" },
    { label: "Background checks completed for all employees", category: "HR Security" },
    { label: "Audit logs configured and retained per policy", category: "Audit Logging" },
  ],
  fedramp: [
    { label: "System Security Plan (SSP) complete and approved", category: "Documentation" },
    { label: "Authorization boundary fully defined and documented", category: "Documentation" },
    { label: "POA&M maintained and up to date", category: "POA&M" },
    { label: "FIPS 140-2/3 cryptography in use throughout boundary", category: "Cryptography" },
    { label: "Continuous monitoring plan implemented", category: "ConMon" },
    { label: "Personnel background screening completed", category: "HR Security" },
    { label: "Configuration management plan documented", category: "Config Mgmt" },
    { label: "Incident response procedures US-CERT compliant", category: "Incident Response" },
    { label: "Supply chain risk management plan in place", category: "SCRM" },
    { label: "Monthly vulnerability scans completed and reviewed", category: "Vulnerability Mgmt" },
  ],
};

export default function Audits() {
  const { orgId } = useOrg();
  const qc = useQueryClient();
  const [showNew, setShowNew] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [showRequest, setShowRequest] = useState(false);
  const [showBulkTemplate, setShowBulkTemplate] = useState(false);
  const [showReadiness, setShowReadiness] = useState(false);
  const [tokenModal, setTokenModal] = useState<{ token: string; name: string } | null>(null);
  const [tokenCopied, setTokenCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"requests" | "readiness">("requests");
  const [form, setForm] = useState({ name: "", frameworkKey: "soc2", auditorFirm: "", auditorName: "", auditorEmail: "", startDate: "", endDate: "", notes: "" });
  const [reqForm, setReqForm] = useState({ title: "", description: "", ucoControlId: "", dueDate: "" });
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkDone, setBulkDone] = useState(false);

  const { data } = useQuery<{ engagements: any[] }>({
    queryKey: ["audits", orgId],
    queryFn: () => apiFetch(`/orgs/${orgId}/audits`),
    enabled: !!orgId,
  });

  const { data: requestsData } = useQuery<{ requests: any[] }>({
    queryKey: ["audit-requests", orgId, selected?.id],
    queryFn: () => apiFetch(`/orgs/${orgId}/audits/${selected.id}/requests`),
    enabled: !!orgId && !!selected,
  });

  const createMutation = useMutation({
    mutationFn: (body: typeof form) => apiFetch(`/orgs/${orgId}/audits`, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ["audits"] });
      setShowNew(false);
      const token = d.engagement?.accessToken;
      const name = d.engagement?.name ?? form.name;
      if (token) setTokenModal({ token, name });
    },
  });

  const closeMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/orgs/${orgId}/audits/${id}/close`, { method: "PATCH" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["audits"] }); setSelected(null); },
  });

  const createRequestMutation = useMutation({
    mutationFn: (body: typeof reqForm) => apiFetch(`/orgs/${orgId}/audits/${selected.id}/requests`, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["audit-requests"] }); setShowRequest(false); setReqForm({ title: "", description: "", ucoControlId: "", dueDate: "" }); },
  });

  const updateRequestMutation = useMutation({
    mutationFn: ({ id, ...body }: any) => apiFetch(`/orgs/${orgId}/audits/requests/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["audit-requests"] }),
  });

  const engagements = data?.engagements ?? [];
  const requests = requestsData?.requests ?? [];
  const frameworkTemplates = selected ? (EVIDENCE_TEMPLATES[selected.frameworkKey] ?? EVIDENCE_TEMPLATES["soc2"]) : [];
  const readinessItems = selected ? (READINESS_CHECKLIST[selected.frameworkKey] ?? READINESS_CHECKLIST["soc2"]) : [];

  const copyToken = () => {
    if (!tokenModal) return;
    navigator.clipboard.writeText(tokenModal.token).then(() => {
      setTokenCopied(true);
      setTimeout(() => setTokenCopied(false), 2000);
    });
  };

  const handleBulkCreate = async () => {
    if (!selected) return;
    setBulkLoading(true);
    for (const tmpl of frameworkTemplates) {
      try {
        await apiFetch(`/orgs/${orgId}/audits/${selected.id}/requests`, {
          method: "POST",
          body: JSON.stringify({ title: tmpl.title, description: tmpl.description, ucoControlId: tmpl.ucoControlId, dueDate: "" }),
        });
      } catch {}
    }
    await qc.invalidateQueries({ queryKey: ["audit-requests"] });
    setBulkLoading(false);
    setBulkDone(true);
    setShowBulkTemplate(false);
    setTimeout(() => setBulkDone(false), 3000);
  };

  const resolvedCount = requests.filter((r) => r.status === "resolved").length;
  const pendingCount = requests.filter((r) => r.status === "pending").length;
  const readinessPct = requests.length > 0 ? Math.round((resolvedCount / requests.length) * 100) : 0;

  return (
    <div className="p-6 max-w-screen-xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Auditor Portal</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage audit engagements, evidence requests, and auditor access</p>
        </div>
        <button onClick={() => setShowNew(true)} className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700">
          + New Engagement
        </button>
      </div>

      {!selected ? (
        <>
          {engagements.length === 0 ? (
            <div className="space-y-4">
              <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
                <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center mx-auto mb-3">
                  <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                </div>
                <p className="text-slate-700 font-semibold">No audit engagements yet</p>
                <p className="text-sm text-slate-400 mt-1 mb-5">Create an engagement to invite auditors and manage evidence requests in one place.</p>
                <button onClick={() => setShowNew(true)} className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700">Create first engagement</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white border border-slate-200 rounded-xl p-5">
                  <p className="font-semibold text-slate-800 text-sm mb-2">How it works</p>
                  <ol className="space-y-2">
                    {["Create an engagement and assign a framework (SOC 2, ISO 27001, FedRAMP, etc.)", "An auditor access token is generated - share it securely with your auditor firm", "Use bulk evidence request templates to pre-populate all required requests per framework", "Track and resolve requests as you provide documents, then close when audit completes"].map((step, i) => (
                      <li key={i} className="flex gap-3 text-xs text-slate-500">
                        <span className="flex-shrink-0 h-5 w-5 rounded-full bg-blue-50 text-blue-600 font-bold text-xs flex items-center justify-center">{i + 1}</span>
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-5">
                  <p className="font-semibold text-slate-800 text-sm mb-2">Supported frameworks</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.values(FRAMEWORK_LABELS).map(f => (
                      <span key={f} className="px-2.5 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-lg">{f}</span>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-3 leading-relaxed">Each engagement generates an auditor access token. Revoked automatically when the engagement closes.</p>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-5">
                  <p className="font-semibold text-slate-800 text-sm mb-2">Framework evidence templates</p>
                  <p className="text-xs text-slate-500 leading-relaxed mb-3">Pre-built evidence checklists for SOC 2, ISO 27001, FedRAMP, HIPAA, PCI DSS, CMMC, and NIST 800-53. Load all standard requests with one click after creating an engagement.</p>
                  <div className="flex gap-2">
                    {["SOC 2: 10 items", "FedRAMP: 10 items", "CMMC: 6 items"].map((t) => (
                      <span key={t} className="px-2 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded">{t}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {engagements.map((e) => {
                const total = e.requestSummary?.total ?? 0;
                const resolved = e.requestSummary?.resolved ?? 0;
                const pct = total > 0 ? Math.round((resolved / total) * 100) : 0;
                return (
                  <div key={e.id} className="bg-white border border-slate-200 rounded-xl p-5 hover:border-blue-300 cursor-pointer transition-colors" onClick={() => setSelected(e)}>
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${e.status === "active" ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-500"}`}>{e.status}</span>
                          <span className="text-xs text-slate-400">{FRAMEWORK_LABELS[e.frameworkKey] ?? e.frameworkKey}</span>
                        </div>
                        <h3 className="font-medium text-slate-800">{e.name}</h3>
                        <p className="text-sm text-slate-500 mt-0.5">{e.auditorFirm ? `${e.auditorFirm} - ` : ""}{e.auditorName} ({e.auditorEmail})</p>
                      </div>
                      <div className="text-right">
                        <div className="flex gap-4 mb-2">
                          <div className="text-center"><p className="text-lg font-bold text-slate-800">{total}</p><p className="text-xs text-slate-400">Total</p></div>
                          <div className="text-center"><p className="text-lg font-bold text-orange-600">{e.requestSummary?.pending ?? 0}</p><p className="text-xs text-slate-400">Pending</p></div>
                          <div className="text-center"><p className="text-lg font-bold text-green-600">{resolved}</p><p className="text-xs text-slate-400">Resolved</p></div>
                        </div>
                        {total > 0 && (
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-24 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-xs text-slate-400">{pct}%</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <div>
          <div className="flex items-center gap-3 mb-5">
            <button onClick={() => { setSelected(null); setActiveTab("requests"); setBulkDone(false); }} className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              Back
            </button>
            <h2 className="text-lg font-semibold text-slate-900">{selected.name}</h2>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${selected.status === "active" ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-500"}`}>{selected.status}</span>
          </div>

          <div className="grid grid-cols-4 gap-4 mb-5">
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-2xl font-bold text-slate-900">{requests.length}</p>
              <p className="text-xs text-slate-400 mt-0.5">Total requests</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-2xl font-bold text-orange-600">{pendingCount}</p>
              <p className="text-xs text-slate-400 mt-0.5">Pending</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-2xl font-bold text-green-600">{resolvedCount}</p>
              <p className="text-xs text-slate-400 mt-0.5">Resolved</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-1">
                <p className="text-2xl font-bold text-blue-600">{readinessPct}%</p>
              </div>
              <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${readinessPct}%` }} />
              </div>
              <p className="text-xs text-slate-400 mt-1">Readiness</p>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-5 text-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <p className="font-medium text-blue-800">Auditor: {selected.auditorName} ({selected.auditorEmail})</p>
              <p className="text-blue-600 mt-0.5">Framework: {FRAMEWORK_LABELS[selected.frameworkKey] ?? selected.frameworkKey}</p>
            </div>
            {selected.accessToken && (
              <button
                onClick={() => setTokenModal({ token: selected.accessToken, name: selected.name })}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 text-blue-700 text-xs font-semibold rounded-lg hover:bg-blue-200 transition-colors flex-shrink-0"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
                View access token
              </button>
            )}
          </div>

          <div className="flex gap-1 mb-4 bg-slate-100 rounded-xl p-1 w-fit">
            {(["requests", "readiness"] as const).map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors capitalize ${activeTab === tab ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                {tab === "requests" ? `Evidence Requests (${requests.length})` : "Readiness Checklist"}
              </button>
            ))}
          </div>

          {activeTab === "requests" && (
            <>
              <div className="flex items-center justify-between mb-4">
                <div className="flex gap-2">
                  {bulkDone && <span className="text-sm text-green-600 font-medium flex items-center gap-1"><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> Template loaded</span>}
                </div>
                <div className="flex gap-2">
                  {frameworkTemplates.length > 0 && requests.length === 0 && (
                    <button onClick={() => setShowBulkTemplate(true)} className="px-3 py-1.5 text-sm border border-blue-200 text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 flex items-center gap-1.5">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                      Load {FRAMEWORK_LABELS[selected.frameworkKey] ?? selected.frameworkKey} template ({frameworkTemplates.length} items)
                    </button>
                  )}
                  <button onClick={() => setShowRequest(true)} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">+ Request Evidence</button>
                  {selected.status === "active" && (
                    <button onClick={() => closeMutation.mutate(selected.id)} className="px-3 py-1.5 text-sm border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50">Close Engagement</button>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                {requests.map((req) => (
                  <div key={req.id} className="bg-white border border-slate-200 rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            req.status === "resolved" ? "bg-green-50 text-green-700" :
                            req.status === "rejected" ? "bg-red-50 text-red-600" :
                            "bg-orange-50 text-orange-600"
                          }`}>{req.status}</span>
                          {req.ucoControlId && <span className="text-xs text-slate-400 font-mono">{req.ucoControlId}</span>}
                        </div>
                        <p className="text-sm font-medium text-slate-800">{req.title}</p>
                        {req.description && <p className="text-xs text-slate-500 mt-0.5">{req.description}</p>}
                        {req.responseNotes && <p className="text-xs text-blue-600 mt-1">Response: {req.responseNotes}</p>}
                      </div>
                      {req.status === "pending" && (
                        <div className="flex gap-2 ml-3">
                          <button onClick={() => updateRequestMutation.mutate({ id: req.id, status: "resolved" })}
                            className="text-xs px-2 py-1 bg-green-50 text-green-700 border border-green-200 rounded hover:bg-green-100">Resolve</button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {requests.length === 0 && (
                  <div className="text-center py-12">
                    <p className="text-sm text-slate-400">No evidence requests yet.</p>
                    {frameworkTemplates.length > 0 && (
                      <p className="text-xs text-slate-400 mt-1">Use the template button above to load all standard {FRAMEWORK_LABELS[selected.frameworkKey] ?? selected.frameworkKey} evidence requests.</p>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          {activeTab === "readiness" && (
            <div className="space-y-3">
              <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-800 text-sm">{FRAMEWORK_LABELS[selected.frameworkKey] ?? selected.frameworkKey} Audit Readiness</p>
                  <p className="text-xs text-slate-500 mt-0.5">Pre-audit preparation checklist. Check off items as you verify they are in place.</p>
                </div>
                <div className="text-right">
                  <p className={`text-2xl font-bold ${readinessPct >= 80 ? "text-green-600" : readinessPct >= 50 ? "text-amber-600" : "text-red-600"}`}>{readinessPct >= 80 ? "Ready" : readinessPct >= 50 ? "In Progress" : "Not Ready"}</p>
                  <p className="text-xs text-slate-400">{resolvedCount}/{requests.length} complete</p>
                </div>
              </div>

              {readinessItems.length > 0 ? (
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                  {readinessItems.map((item, i) => (
                    <div key={i} className={`flex items-start gap-3 px-5 py-3.5 ${i < readinessItems.length - 1 ? "border-b border-slate-100" : ""}`}>
                      <div className="h-5 w-5 rounded border-2 border-slate-200 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 flex items-start justify-between gap-4">
                        <p className="text-sm text-slate-700">{item.label}</p>
                        <span className="text-xs text-slate-400 bg-slate-50 px-2 py-0.5 rounded flex-shrink-0">{item.category}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
                  <p className="text-sm text-slate-500">No readiness checklist available for this framework yet.</p>
                  <p className="text-xs text-slate-400 mt-1">Use the Evidence Requests tab to track your audit preparation.</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {showNew && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-5 border-b border-slate-100"><h2 className="font-semibold text-slate-900">New Audit Engagement</h2></div>
            <div className="p-5 space-y-3">
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Engagement Name *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. SOC 2 Type II Audit 2025" /></div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Framework</label>
                <select value={form.frameworkKey} onChange={(e) => setForm({ ...form, frameworkKey: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
                  {Object.entries(FRAMEWORK_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-slate-600 mb-1">Auditor Firm</label>
                  <input value={form.auditorFirm} onChange={(e) => setForm({ ...form, auditorFirm: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none" placeholder="Firm name" /></div>
                <div><label className="block text-xs font-medium text-slate-600 mb-1">Auditor Name</label>
                  <input value={form.auditorName} onChange={(e) => setForm({ ...form, auditorName: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none" placeholder="Lead auditor" /></div>
              </div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Auditor Email *</label>
                <input type="email" value={form.auditorEmail} onChange={(e) => setForm({ ...form, auditorEmail: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-slate-600 mb-1">Start Date</label>
                  <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none" /></div>
                <div><label className="block text-xs font-medium text-slate-600 mb-1">End Date</label>
                  <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none" /></div>
              </div>
            </div>
            <div className="p-5 border-t border-slate-100 flex gap-3 justify-end">
              <button onClick={() => setShowNew(false)} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
              <button onClick={() => createMutation.mutate(form)} disabled={!form.name || !form.auditorEmail || createMutation.isPending}
                className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {createMutation.isPending ? "Creating..." : "Create Engagement"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showBulkTemplate && selected && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="p-5 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900">Load {FRAMEWORK_LABELS[selected.frameworkKey] ?? selected.frameworkKey} Evidence Template</h2>
              <p className="text-xs text-slate-500 mt-0.5">This will create {frameworkTemplates.length} evidence requests pre-configured for {FRAMEWORK_LABELS[selected.frameworkKey] ?? selected.frameworkKey} audits.</p>
            </div>
            <div className="p-5 max-h-80 overflow-y-auto space-y-2">
              {frameworkTemplates.map((tmpl, i) => (
                <div key={i} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                  <span className="text-xs font-bold text-blue-600 mt-0.5 flex-shrink-0 font-mono">{tmpl.ucoControlId}</span>
                  <div>
                    <p className="text-sm font-medium text-slate-800">{tmpl.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{tmpl.description}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-5 border-t border-slate-100 flex gap-3 justify-end">
              <button onClick={() => setShowBulkTemplate(false)} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
              <button onClick={handleBulkCreate} disabled={bulkLoading}
                className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {bulkLoading ? "Creating requests..." : `Create ${frameworkTemplates.length} requests`}
              </button>
            </div>
          </div>
        </div>
      )}

      {showRequest && selected && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-5 border-b border-slate-100"><h2 className="font-semibold text-slate-900">New Evidence Request</h2></div>
            <div className="p-5 space-y-3">
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Request Title *</label>
                <input value={reqForm.title} onChange={(e) => setReqForm({ ...reqForm, title: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. User access list Q4 2024" /></div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
                <textarea value={reqForm.description} onChange={(e) => setReqForm({ ...reqForm, description: e.target.value })} rows={2} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-slate-600 mb-1">UCO Control</label>
                  <input value={reqForm.ucoControlId} onChange={(e) => setReqForm({ ...reqForm, ucoControlId: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none" placeholder="UCO-AC-001" /></div>
                <div><label className="block text-xs font-medium text-slate-600 mb-1">Due Date</label>
                  <input type="date" value={reqForm.dueDate} onChange={(e) => setReqForm({ ...reqForm, dueDate: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none" /></div>
              </div>
            </div>
            <div className="p-5 border-t border-slate-100 flex gap-3 justify-end">
              <button onClick={() => setShowRequest(false)} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
              <button onClick={() => createRequestMutation.mutate(reqForm)} disabled={!reqForm.title || createRequestMutation.isPending}
                className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {createRequestMutation.isPending ? "Sending..." : "Send Request"}
              </button>
            </div>
          </div>
        </div>
      )}

      {tokenModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">Auditor Access Token</h2>
                <p className="text-xs text-slate-400 mt-0.5">{tokenModal.name}</p>
              </div>
              <button onClick={() => setTokenModal(null)} className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="text-sm font-semibold text-blue-900 mb-1">What auditors can access</p>
                <ul className="space-y-1">
                  {[
                    "Read-only view of all evidence requests for this engagement",
                    "Submitted evidence artifacts and response notes",
                    "Control status for the selected framework",
                    "No write access - cannot modify your data",
                  ].map((item, i) => (
                    <li key={i} className="flex gap-2 text-xs text-blue-700">
                      <svg className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Access Token</p>
                <div className="flex gap-2 items-stretch">
                  <div className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 font-mono text-xs text-slate-700 break-all select-all">
                    {tokenModal.token}
                  </div>
                  <button onClick={copyToken}
                    className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors flex-shrink-0 ${tokenCopied ? "bg-green-600 text-white" : "bg-blue-600 text-white hover:bg-blue-700"}`}>
                    {tokenCopied ? "Copied!" : "Copy token"}
                  </button>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Instructions for Auditor</p>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-600 space-y-2">
                  <p>Send the auditor the following message:</p>
                  <div className="bg-white border border-slate-200 rounded-lg p-3 font-mono text-xs text-slate-700 leading-relaxed select-all whitespace-pre-wrap">{`To access evidence for "${tokenModal.name}":
1. Navigate to: ${window.location.origin}/auditor-portal
2. Enter token: ${tokenModal.token}
3. You will have read-only access to all evidence requests and artifacts for this engagement.`}</div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(
                        `To access evidence for "${tokenModal.name}":\n1. Navigate to: ${window.location.origin}/auditor-portal\n2. Enter token: ${tokenModal.token}\n3. You will have read-only access to all evidence requests and artifacts for this engagement.`
                      );
                    }}
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Copy full instructions
                  </button>
                </div>
              </div>

              <p className="text-xs text-slate-400">Keep this token confidential. Access can be revoked by closing the engagement.</p>
            </div>
            <div className="p-5 border-t border-slate-100">
              <button onClick={() => setTokenModal(null)} className="w-full py-2 border border-slate-200 text-slate-600 text-sm font-semibold rounded-lg hover:bg-slate-50">Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

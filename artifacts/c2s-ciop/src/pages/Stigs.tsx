import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/queryClient";
import { useOrg } from "@/hooks/useOrg";

type StigStatus = "open" | "not_a_finding" | "not_applicable" | "not_reviewed";
type StigSeverity = "high" | "medium" | "low";

const STATUS_LABELS: Record<StigStatus, string> = {
  open: "Open",
  not_a_finding: "Not a Finding",
  not_applicable: "Not Applicable",
  not_reviewed: "Not Reviewed",
};

const STATUS_COLORS: Record<StigStatus, string> = {
  open: "bg-red-50 text-red-700 border-red-200",
  not_a_finding: "bg-green-50 text-green-700 border-green-200",
  not_applicable: "bg-slate-100 text-slate-500 border-slate-200",
  not_reviewed: "bg-amber-50 text-amber-700 border-amber-200",
};

const SEV_LABELS: Record<StigSeverity, string> = { high: "CAT I", medium: "CAT II", low: "CAT III" };
const SEV_COLORS: Record<StigSeverity, string> = {
  high: "bg-red-100 text-red-700",
  medium: "bg-orange-100 text-orange-700",
  low: "bg-slate-100 text-slate-600",
};

const UCO_STIG_MAP: Record<string, string> = {
  "V-": "UCO-AC-001",
};

function parseCklXml(xmlText: string): { meta: Record<string, string>; findings: Record<string, unknown>[] } {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, "application/xml");

  const getText = (parent: Element | Document, tag: string) =>
    parent.querySelector(tag)?.textContent?.trim() ?? "";

  const getStigData = (vuln: Element, attr: string): string => {
    const nodes = vuln.querySelectorAll("STIG_DATA");
    for (const node of Array.from(nodes)) {
      const name = node.querySelector("VULN_ATTRIBUTE")?.textContent?.trim();
      if (name === attr) return node.querySelector("ATTRIBUTE_DATA")?.textContent?.trim() ?? "";
    }
    return "";
  };

  const siData: Record<string, string> = {};
  const siNodes = doc.querySelectorAll("STIG_INFO SI_DATA");
  for (const node of Array.from(siNodes)) {
    const name = node.querySelector("SID_NAME")?.textContent?.trim() ?? "";
    const val = node.querySelector("SID_DATA")?.textContent?.trim() ?? "";
    if (name) siData[name] = val;
  }

  const hostname = getText(doc, "HOST_NAME") || getText(doc, "ASSET HOST_NAME") || "";
  const targetComment = getText(doc, "TARGET_COMMENT") || "";

  const findings: Record<string, unknown>[] = [];
  const vulns = doc.querySelectorAll("VULN");

  for (const vuln of Array.from(vulns)) {
    const vulnId = getStigData(vuln, "Vuln_Num");
    const ruleId = getStigData(vuln, "Rule_ID");
    const ruleVer = getStigData(vuln, "Rule_Ver");
    const rawSev = getStigData(vuln, "Severity").toLowerCase();
    const title = getStigData(vuln, "Rule_Title") || getStigData(vuln, "Vuln_Discuss").slice(0, 120);
    const description = getStigData(vuln, "Vuln_Discuss");
    const fixText = getStigData(vuln, "Fix_Text");
    const checkContent = getStigData(vuln, "Check_Content");
    const rawStatus = vuln.querySelector("STATUS")?.textContent?.trim() ?? "Not_Reviewed";
    const findingDetails = vuln.querySelector("FINDING_DETAILS")?.textContent?.trim() ?? "";
    const comments = vuln.querySelector("COMMENTS")?.textContent?.trim() ?? "";

    const severity: StigSeverity = rawSev === "high" ? "high" : rawSev === "low" ? "low" : "medium";
    const statusMap: Record<string, StigStatus> = {
      Open: "open",
      NotAFinding: "not_a_finding",
      Not_Reviewed: "not_reviewed",
      Not_Applicable: "not_applicable",
    };
    const status: StigStatus = statusMap[rawStatus] ?? "not_reviewed";

    if (!vulnId) continue;
    findings.push({ vulnId, ruleId, ruleVer, title, severity, status, description, fixText, checkContent, findingDetails, comments });
  }

  return {
    meta: {
      benchmarkId: siData["title"] ?? siData["benchmarkid"] ?? "",
      version: siData["version"] ?? "",
      release: siData["releaseinfo"] ?? "",
      hostname,
      targetComment,
    },
    findings,
  };
}

export default function Stigs() {
  const { orgId } = useOrg();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [selected, setSelected] = useState<any>(null);
  const [selectedFinding, setSelectedFinding] = useState<any>(null);
  const [showNew, setShowNew] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const [statusFilter, setStatusFilter] = useState<StigStatus | "all">("all");
  const [sevFilter, setSevFilter] = useState<StigSeverity | "all">("all");
  const [search, setSearch] = useState("");
  const [nameForm, setNameForm] = useState({ name: "", hostname: "" });

  const { data } = useQuery<{ checklists: any[] }>({
    queryKey: ["stigs", orgId],
    queryFn: () => apiFetch(`/orgs/${orgId}/stigs`),
    enabled: !!orgId,
  });

  const { data: findingsData } = useQuery<{ findings: any[] }>({
    queryKey: ["stig-findings", orgId, selected?.id],
    queryFn: () => apiFetch(`/orgs/${orgId}/stigs/${selected.id}/findings`),
    enabled: !!orgId && !!selected,
  });

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => apiFetch(`/orgs/${orgId}/stigs`, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: (d) => { qc.invalidateQueries({ queryKey: ["stigs"] }); setShowNew(false); setSelected(d.checklist); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/orgs/${orgId}/stigs/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["stigs"] }); setSelected(null); },
  });

  const bulkCreateMutation = useMutation({
    mutationFn: ({ id, findings }: { id: number; findings: Record<string, unknown>[] }) =>
      apiFetch(`/orgs/${orgId}/stigs/${id}/findings/bulk`, { method: "POST", body: JSON.stringify({ findings }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["stig-findings"] }); qc.invalidateQueries({ queryKey: ["stigs"] }); setImporting(false); },
    onError: () => { setImportError("Import failed - check that the file is a valid CKL or XCCDF file."); setImporting(false); },
  });

  const updateFindingMutation = useMutation({
    mutationFn: ({ id, ...body }: any) => apiFetch(`/orgs/${orgId}/stigs/findings/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["stig-findings"] }); qc.invalidateQueries({ queryKey: ["stigs"] }); },
  });

  const checklists = data?.checklists ?? [];
  const findings = findingsData?.findings ?? [];

  const filtered = findings.filter((f) => {
    if (statusFilter !== "all" && f.status !== statusFilter) return false;
    if (sevFilter !== "all" && f.severity !== sevFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return f.vulnId?.toLowerCase().includes(q) || f.title?.toLowerCase().includes(q) || f.ruleVer?.toLowerCase().includes(q);
    }
    return true;
  });

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selected) return;
    setImporting(true);
    setImportError("");
    try {
      const text = await file.text();
      const { findings: parsed } = parseCklXml(text);
      if (parsed.length === 0) {
        setImportError("No STIG findings found in this file. Make sure it is a valid STIG Viewer CKL file.");
        setImporting(false);
        return;
      }
      bulkCreateMutation.mutate({ id: selected.id, findings: parsed });
    } catch {
      setImportError("Could not parse the file. Make sure it is a valid CKL XML file.");
      setImporting(false);
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleCklImport = async (xmlText: string) => {
    if (!selected) return;
    setImporting(true);
    setImportError("");
    try {
      const { findings: parsed, meta } = parseCklXml(xmlText);
      if (meta.benchmarkId || meta.hostname) {
        await apiFetch(`/orgs/${orgId}/stigs/${selected.id}`, {
          method: "PATCH",
          body: JSON.stringify({ benchmarkId: meta.benchmarkId, hostname: meta.hostname, version: meta.version, release: meta.release }),
        }).catch(() => {});
      }
      if (parsed.length === 0) {
        setImportError("No findings found in this CKL.");
        setImporting(false);
        return;
      }
      bulkCreateMutation.mutate({ id: selected.id, findings: parsed });
    } catch {
      setImportError("Parse error.");
      setImporting(false);
    }
  };

  const openSummary = findings.filter((f) => f.status === "open");
  const cat1Open = openSummary.filter((f) => f.severity === "high").length;
  const cat2Open = openSummary.filter((f) => f.severity === "medium").length;
  const cat3Open = openSummary.filter((f) => f.severity === "low").length;

  const SAMPLE_CKL = `<?xml version="1.0" encoding="UTF-8"?>
<CHECKLIST>
  <ASSET>
    <HOST_NAME>web-server-01</HOST_NAME>
  </ASSET>
  <STIGS>
    <iSTIG>
      <STIG_INFO>
        <SI_DATA><SID_NAME>title</SID_NAME><SID_DATA>Windows Server 2022 STIG</SID_DATA></SI_DATA>
        <SI_DATA><SID_NAME>version</SID_NAME><SID_DATA>1</SID_DATA></SI_DATA>
        <SI_DATA><SID_NAME>releaseinfo</SID_NAME><SID_DATA>Release 2</SID_DATA></SI_DATA>
      </STIG_INFO>
      <VULN>
        <STIG_DATA><VULN_ATTRIBUTE>Vuln_Num</VULN_ATTRIBUTE><ATTRIBUTE_DATA>V-254238</ATTRIBUTE_DATA></STIG_DATA>
        <STIG_DATA><VULN_ATTRIBUTE>Severity</VULN_ATTRIBUTE><ATTRIBUTE_DATA>high</ATTRIBUTE_DATA></STIG_DATA>
        <STIG_DATA><VULN_ATTRIBUTE>Rule_Ver</VULN_ATTRIBUTE><ATTRIBUTE_DATA>WN22-DC-000010</ATTRIBUTE_DATA></STIG_DATA>
        <STIG_DATA><VULN_ATTRIBUTE>Rule_Title</VULN_ATTRIBUTE><ATTRIBUTE_DATA>Windows Server 2022 must be configured to audit Account Logon - Credential Validation successes.</ATTRIBUTE_DATA></STIG_DATA>
        <STIG_DATA><VULN_ATTRIBUTE>Vuln_Discuss</VULN_ATTRIBUTE><ATTRIBUTE_DATA>Maintaining an audit trail of system activity logs can help identify configuration errors, troubleshoot service disruptions, and analyze compromises that have occurred, as well as detect attacks.</ATTRIBUTE_DATA></STIG_DATA>
        <STIG_DATA><VULN_ATTRIBUTE>Fix_Text</VULN_ATTRIBUTE><ATTRIBUTE_DATA>Configure the policy value for Computer Configuration > Windows Settings > Security Settings > Advanced Audit Policy Configuration > System Audit Policies > Account Logon > "Audit Credential Validation" with "Success" selected.</ATTRIBUTE_DATA></STIG_DATA>
        <STIG_DATA><VULN_ATTRIBUTE>Check_Content</VULN_ATTRIBUTE><ATTRIBUTE_DATA>Security Option "Audit: Force audit policy subcategory settings (Windows Vista or later) to override audit policy category settings" must be set to "Enabled" (WN22-SO-000030) for the detailed auditing subcategories to be effective. Use the AuditPol tool to review the current Audit Policy configuration.</ATTRIBUTE_DATA></STIG_DATA>
        <STATUS>Open</STATUS>
        <FINDING_DETAILS>Audit policy not configured.</FINDING_DETAILS>
        <COMMENTS></COMMENTS>
      </VULN>
      <VULN>
        <STIG_DATA><VULN_ATTRIBUTE>Vuln_Num</VULN_ATTRIBUTE><ATTRIBUTE_DATA>V-254239</ATTRIBUTE_DATA></STIG_DATA>
        <STIG_DATA><VULN_ATTRIBUTE>Severity</VULN_ATTRIBUTE><ATTRIBUTE_DATA>medium</ATTRIBUTE_DATA></STIG_DATA>
        <STIG_DATA><VULN_ATTRIBUTE>Rule_Ver</VULN_ATTRIBUTE><ATTRIBUTE_DATA>WN22-DC-000020</ATTRIBUTE_DATA></STIG_DATA>
        <STIG_DATA><VULN_ATTRIBUTE>Rule_Title</VULN_ATTRIBUTE><ATTRIBUTE_DATA>Windows Server 2022 must be configured to audit Account Logon - Credential Validation failures.</ATTRIBUTE_DATA></STIG_DATA>
        <STIG_DATA><VULN_ATTRIBUTE>Vuln_Discuss</VULN_ATTRIBUTE><ATTRIBUTE_DATA>Monitoring failed authentication attempts can help detect brute-force attacks and compromised credentials.</ATTRIBUTE_DATA></STIG_DATA>
        <STIG_DATA><VULN_ATTRIBUTE>Fix_Text</VULN_ATTRIBUTE><ATTRIBUTE_DATA>Configure the policy value for Computer Configuration > Windows Settings > Security Settings > Advanced Audit Policy Configuration > Account Logon > "Audit Credential Validation" with "Failure" selected.</ATTRIBUTE_DATA></STIG_DATA>
        <STIG_DATA><VULN_ATTRIBUTE>Check_Content</VULN_ATTRIBUTE><ATTRIBUTE_DATA>Use the AuditPol tool to review the current Audit Policy configuration: Open a command prompt with elevated privileges. Enter "AuditPol /get /category:*".</ATTRIBUTE_DATA></STIG_DATA>
        <STATUS>NotAFinding</STATUS>
        <FINDING_DETAILS>Failure auditing confirmed via AuditPol output.</FINDING_DETAILS>
        <COMMENTS>Verified 2025-01-15.</COMMENTS>
      </VULN>
      <VULN>
        <STIG_DATA><VULN_ATTRIBUTE>Vuln_Num</VULN_ATTRIBUTE><ATTRIBUTE_DATA>V-254240</ATTRIBUTE_DATA></STIG_DATA>
        <STIG_DATA><VULN_ATTRIBUTE>Severity</VULN_ATTRIBUTE><ATTRIBUTE_DATA>low</ATTRIBUTE_DATA></STIG_DATA>
        <STIG_DATA><VULN_ATTRIBUTE>Rule_Ver</VULN_ATTRIBUTE><ATTRIBUTE_DATA>WN22-DC-000030</ATTRIBUTE_DATA></STIG_DATA>
        <STIG_DATA><VULN_ATTRIBUTE>Rule_Title</VULN_ATTRIBUTE><ATTRIBUTE_DATA>Windows Server 2022 must have the built-in Windows password complexity policy enabled.</ATTRIBUTE_DATA></STIG_DATA>
        <STIG_DATA><VULN_ATTRIBUTE>Vuln_Discuss</VULN_ATTRIBUTE><ATTRIBUTE_DATA>Password complexity minimizes the ability of unauthorized users to gain access to systems by requiring passwords that meet minimum length and complexity requirements.</ATTRIBUTE_DATA></STIG_DATA>
        <STIG_DATA><VULN_ATTRIBUTE>Fix_Text</VULN_ATTRIBUTE><ATTRIBUTE_DATA>Configure the policy value for Computer Configuration > Windows Settings > Security Settings > Account Policies > Password Policy > "Password must meet complexity requirements" to "Enabled".</ATTRIBUTE_DATA></STIG_DATA>
        <STIG_DATA><VULN_ATTRIBUTE>Check_Content</VULN_ATTRIBUTE><ATTRIBUTE_DATA>Verify the effective setting in Local Group Policy Editor. Run "gpedit.msc". Navigate to Local Computer Policy > Computer Configuration > Windows Settings > Security Settings > Account Policies > Password Policy.</ATTRIBUTE_DATA></STIG_DATA>
        <STATUS>Not_Reviewed</STATUS>
        <FINDING_DETAILS></FINDING_DETAILS>
        <COMMENTS></COMMENTS>
      </VULN>
    </iSTIG>
  </STIGS>
</CHECKLIST>`;

  return (
    <div className="p-6 max-w-screen-xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">STIG Findings</h1>
          <p className="text-sm text-slate-500 mt-0.5">Import and track DISA STIG checklists. CAT I/II/III findings mapped to UCO controls.</p>
        </div>
        <button onClick={() => setShowNew(true)} className="px-4 py-2 bg-green-800 text-white text-sm font-semibold rounded-lg hover:bg-green-900">
          + New Checklist
        </button>
      </div>

      {!selected ? (
        <>
          {checklists.length === 0 ? (
            <div className="space-y-4">
              <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
                <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center mx-auto mb-3">
                  <svg className="h-6 w-6 text-green-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M20.618 5.984A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016zM12 9v2m0 4h.01" />
                  </svg>
                </div>
                <p className="text-slate-700 font-semibold">No STIG checklists yet</p>
                <p className="text-sm text-slate-400 mt-1 mb-5">Create a checklist then import a STIG Viewer CKL file to track findings.</p>
                <button onClick={() => setShowNew(true)} className="px-4 py-2 bg-green-800 text-white text-sm font-semibold rounded-lg hover:bg-green-900">Create first checklist</button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white border border-slate-200 rounded-xl p-5">
                  <p className="font-semibold text-slate-800 text-sm mb-2">What are STIGs?</p>
                  <p className="text-xs text-slate-500 leading-relaxed">DISA Security Technical Implementation Guides define hardening configuration baselines for specific technologies. Required for DoD systems and strongly recommended for FedRAMP and CMMC.</p>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-5">
                  <p className="font-semibold text-slate-800 text-sm mb-2">Severity categories</p>
                  <div className="space-y-2">
                    {[
                      { cat: "CAT I", sev: "high", desc: "Immediate risk if not corrected - direct access or privilege escalation" },
                      { cat: "CAT II", sev: "medium", desc: "Increased risk if not corrected - requires mitigation" },
                      { cat: "CAT III", sev: "low", desc: "Degraded confidence in assurance of CIA triad" },
                    ].map((item) => (
                      <div key={item.cat} className="flex items-start gap-2">
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded flex-shrink-0 ${item.sev === "high" ? "bg-red-100 text-red-700" : item.sev === "medium" ? "bg-orange-100 text-orange-700" : "bg-slate-100 text-slate-600"}`}>{item.cat}</span>
                        <p className="text-xs text-slate-500">{item.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-5">
                  <p className="font-semibold text-slate-800 text-sm mb-2">Supported formats</p>
                  <div className="flex gap-2 mb-3">
                    <span className="px-2.5 py-1 bg-green-50 text-green-700 text-xs font-medium rounded">STIG Viewer CKL</span>
                    <span className="px-2.5 py-1 bg-slate-100 text-slate-500 text-xs font-medium rounded">XCCDF (soon)</span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">Export your checklist from DISA STIG Viewer as a CKL file, then import it here. Findings are automatically parsed and categorized.</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {checklists.map((c) => {
                const s = c.summary ?? {};
                const total = s.total ?? 0;
                const openCount = s.open ?? 0;
                const nafCount = s.notAFinding ?? 0;
                const naPct = total > 0 ? Math.round(((nafCount) / total) * 100) : 0;
                return (
                  <div key={c.id} className="bg-white border border-slate-200 rounded-xl p-5 hover:border-green-300 cursor-pointer transition-colors" onClick={() => setSelected(c)}>
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700 font-medium">{c.status}</span>
                          {c.benchmarkId && <span className="text-xs text-slate-400">{c.benchmarkId}</span>}
                          {c.version && <span className="text-xs text-slate-400">v{c.version} {c.release}</span>}
                        </div>
                        <h3 className="font-medium text-slate-800">{c.name}</h3>
                        {c.hostname && <p className="text-xs text-slate-400 mt-0.5">Target: {c.hostname}</p>}
                      </div>
                      <div className="text-right">
                        <div className="flex gap-4 mb-2">
                          <div className="text-center"><p className="text-lg font-bold text-red-600">{s.cat1 ?? 0}</p><p className="text-xs text-slate-400">CAT I</p></div>
                          <div className="text-center"><p className="text-lg font-bold text-orange-600">{s.cat2 ?? 0}</p><p className="text-xs text-slate-400">CAT II</p></div>
                          <div className="text-center"><p className="text-lg font-bold text-slate-600">{s.cat3 ?? 0}</p><p className="text-xs text-slate-400">CAT III</p></div>
                          <div className="text-center"><p className="text-lg font-bold text-red-700">{openCount}</p><p className="text-xs text-slate-400">Open</p></div>
                          <div className="text-center"><p className="text-lg font-bold text-green-600">{nafCount}</p><p className="text-xs text-slate-400">NaF</p></div>
                        </div>
                        {total > 0 && (
                          <div className="flex items-center justify-end gap-2">
                            <div className="h-1.5 w-24 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full bg-green-500 rounded-full" style={{ width: `${naPct}%` }} />
                            </div>
                            <span className="text-xs text-slate-400">{naPct}% compliant</span>
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
            <button onClick={() => { setSelected(null); setSelectedFinding(null); }} className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              Back
            </button>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-slate-900">{selected.name}</h2>
              {selected.benchmarkId && <p className="text-xs text-slate-400">{selected.benchmarkId} {selected.version ? `v${selected.version}` : ""} {selected.release}</p>}
            </div>
            <div className="flex gap-2">
              <input ref={fileRef} type="file" accept=".ckl,.xml" className="hidden" onChange={handleFileImport} />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={importing}
                className="px-3 py-1.5 text-sm border border-green-200 text-green-700 bg-green-50 rounded-lg hover:bg-green-100 flex items-center gap-1.5 disabled:opacity-50"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                {importing ? "Importing..." : "Import CKL"}
              </button>
              {findings.length === 0 && (
                <button
                  onClick={() => handleCklImport(SAMPLE_CKL)}
                  disabled={importing}
                  className="px-3 py-1.5 text-sm border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 disabled:opacity-50"
                >
                  Load sample (3 findings)
                </button>
              )}
              <button
                onClick={() => { if (confirm("Delete this checklist and all findings?")) deleteMutation.mutate(selected.id); }}
                className="px-3 py-1.5 text-sm border border-red-200 text-red-600 rounded-lg hover:bg-red-50"
              >
                Delete
              </button>
            </div>
          </div>

          {importError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center justify-between">
              {importError}
              <button onClick={() => setImportError("")} className="text-red-400 hover:text-red-600">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
            {[
              { label: "CAT I Open", value: cat1Open, color: "text-red-700" },
              { label: "CAT II Open", value: cat2Open, color: "text-orange-600" },
              { label: "CAT III Open", value: cat3Open, color: "text-slate-600" },
              { label: "Total Findings", value: findings.length, color: "text-slate-900" },
            ].map((s) => (
              <div key={s.label} className="bg-white border border-slate-200 rounded-xl p-4">
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-slate-400 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {findings.length > 0 && (
            <div className="flex flex-wrap gap-3 mb-4">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by vuln ID, rule, or title..."
                className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-700 w-64"
              />
              <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
                {(["all", "open", "not_a_finding", "not_applicable", "not_reviewed"] as const).map((s) => (
                  <button key={s} onClick={() => setStatusFilter(s)}
                    className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${statusFilter === s ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                    {s === "all" ? "All" : STATUS_LABELS[s]}
                    {s !== "all" && <span className="ml-1 text-slate-400">({findings.filter(f => f.status === s).length})</span>}
                  </button>
                ))}
              </div>
              <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
                {(["all", "high", "medium", "low"] as const).map((s) => (
                  <button key={s} onClick={() => setSevFilter(s)}
                    className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${sevFilter === s ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                    {s === "all" ? "All severity" : SEV_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {findings.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
              <p className="text-sm text-slate-500">No findings yet.</p>
              <p className="text-xs text-slate-400 mt-1">Import a CKL file from DISA STIG Viewer, or load the sample data to see how findings look.</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
              <p className="text-sm text-slate-500">No findings match the current filters.</p>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 w-24">Vuln ID</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 w-28">Rule</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Title</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 w-20">Severity</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 w-36">Status</th>
                    <th className="px-4 py-3 w-20" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((f, i) => (
                    <tr key={f.id} className={`border-b border-slate-50 hover:bg-slate-50 cursor-pointer transition-colors ${i === filtered.length - 1 ? "border-b-0" : ""}`}
                      onClick={() => setSelectedFinding(f)}>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">{f.vulnId}</td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">{f.ruleVer}</td>
                      <td className="px-4 py-3 text-xs text-slate-700 max-w-xs">
                        <span className="line-clamp-2">{f.title}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${SEV_COLORS[f.severity as StigSeverity] ?? SEV_COLORS.medium}`}>
                          {SEV_LABELS[f.severity as StigSeverity] ?? f.severity}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={f.status}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            e.stopPropagation();
                            updateFindingMutation.mutate({ id: f.id, status: e.target.value });
                          }}
                          className={`text-xs px-2 py-1 rounded border font-medium focus:outline-none cursor-pointer ${STATUS_COLORS[f.status as StigStatus] ?? STATUS_COLORS.not_reviewed}`}
                        >
                          {(Object.entries(STATUS_LABELS) as [StigStatus, string][]).map(([k, v]) => (
                            <option key={k} value={k}>{v}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={(e) => { e.stopPropagation(); setSelectedFinding(f); }} className="text-xs text-green-800 hover:text-green-800">Details</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {showNew && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-5 border-b border-slate-100"><h2 className="font-semibold text-slate-900">New STIG Checklist</h2></div>
            <div className="p-5 space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Checklist Name *</label>
                <input value={nameForm.name} onChange={(e) => setNameForm({ ...nameForm, name: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-700"
                  placeholder="e.g. Windows Server 2022 STIG - web-server-01" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Target Hostname</label>
                <input value={nameForm.hostname} onChange={(e) => setNameForm({ ...nameForm, hostname: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                  placeholder="e.g. web-server-01.company.internal" />
              </div>
              <p className="text-xs text-slate-400">After creating the checklist, import a CKL file from DISA STIG Viewer to load findings.</p>
            </div>
            <div className="p-5 border-t border-slate-100 flex gap-3 justify-end">
              <button onClick={() => setShowNew(false)} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
              <button onClick={() => createMutation.mutate({ name: nameForm.name, hostname: nameForm.hostname })}
                disabled={!nameForm.name || createMutation.isPending}
                className="px-4 py-2 text-sm font-medium bg-green-800 text-white rounded-lg hover:bg-green-900 disabled:opacity-50">
                {createMutation.isPending ? "Creating..." : "Create Checklist"}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedFinding && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="p-5 border-b border-slate-100 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-xs text-slate-500">{selectedFinding.vulnId}</span>
                  {selectedFinding.ruleVer && <span className="font-mono text-xs text-slate-400">{selectedFinding.ruleVer}</span>}
                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${SEV_COLORS[selectedFinding.severity as StigSeverity] ?? SEV_COLORS.medium}`}>
                    {SEV_LABELS[selectedFinding.severity as StigSeverity] ?? selectedFinding.severity}
                  </span>
                </div>
                <h2 className="text-base font-semibold text-slate-900 leading-tight">{selectedFinding.title}</h2>
              </div>
              <button onClick={() => setSelectedFinding(null)} className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 flex-shrink-0 ml-3">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-5 overflow-y-auto space-y-5 flex-1">
              <div className="flex items-center gap-3">
                <label className="text-xs font-medium text-slate-600">Status:</label>
                <select
                  value={selectedFinding.status}
                  onChange={(e) => {
                    updateFindingMutation.mutate({ id: selectedFinding.id, status: e.target.value });
                    setSelectedFinding({ ...selectedFinding, status: e.target.value });
                  }}
                  className={`text-xs px-2.5 py-1.5 rounded border font-medium focus:outline-none ${STATUS_COLORS[selectedFinding.status as StigStatus] ?? STATUS_COLORS.not_reviewed}`}
                >
                  {(Object.entries(STATUS_LABELS) as [StigStatus, string][]).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>

              {selectedFinding.description && (
                <div>
                  <p className="text-xs font-semibold text-slate-700 mb-1.5">Discussion</p>
                  <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 rounded-lg p-3">{selectedFinding.description}</p>
                </div>
              )}
              {selectedFinding.fixText && (
                <div>
                  <p className="text-xs font-semibold text-slate-700 mb-1.5">Fix</p>
                  <p className="text-xs text-slate-600 leading-relaxed bg-green-50 rounded-lg p-3 border border-green-100">{selectedFinding.fixText}</p>
                </div>
              )}
              {selectedFinding.checkContent && (
                <div>
                  <p className="text-xs font-semibold text-slate-700 mb-1.5">Check Procedure</p>
                  <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 rounded-lg p-3 font-mono whitespace-pre-wrap">{selectedFinding.checkContent}</p>
                </div>
              )}
              {selectedFinding.findingDetails && (
                <div>
                  <p className="text-xs font-semibold text-slate-700 mb-1.5">Finding Details</p>
                  <p className="text-xs text-slate-600 leading-relaxed bg-amber-50 rounded-lg p-3 border border-amber-100">{selectedFinding.findingDetails}</p>
                </div>
              )}
              {selectedFinding.comments && (
                <div>
                  <p className="text-xs font-semibold text-slate-700 mb-1.5">Comments</p>
                  <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 rounded-lg p-3">{selectedFinding.comments}</p>
                </div>
              )}
            </div>
            <div className="p-5 border-t border-slate-100 flex justify-end">
              <button onClick={() => setSelectedFinding(null)} className="px-4 py-2 text-sm border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

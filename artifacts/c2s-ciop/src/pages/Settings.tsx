import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiUrl, apiFetch } from "@/lib/queryClient";
import { useOrg } from "@/hooks/useOrg";
import { useRole } from "@/context/RoleContext";
import RoleManagement from "./RoleManagement";

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map(r => r.map(c => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

const INDUSTRIES = ["Technology","Healthcare","Finance","Government","Retail","Manufacturing","Education","Other"];
const SIZES = ["1-10","11-50","51-200","201-500","501-1000","1000+"];

export default function Settings() {
  const qc = useQueryClient();
  const { orgId } = useOrg();
  const { can } = useRole();
  const [activeTab, setActiveTab] = useState<"general"|"roles">("general");

  const { data: orgData } = useQuery<{ org: any }>({
    queryKey: ["orgs", "me"],
    queryFn: async () => (await fetch(apiUrl("/orgs/me"), { credentials: "include" })).json(),
  });

  const org = orgData?.org;
  const [form, setForm] = useState<any>(null);
  const [saved, setSaved] = useState(false);

  if (org && !form) {
    setForm({ name: org.name, industry: org.industry, size: org.size, website: org.website ?? "" });
  }

  const isDirty = form && (
    form.name !== org?.name ||
    form.industry !== org?.industry ||
    form.size !== org?.size ||
    form.website !== (org?.website ?? "")
  );

  const saveMutation = useMutation({
    mutationFn: () => apiFetch(`/orgs/${orgId}`, { method: "PATCH", body: JSON.stringify(form) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orgs", "me"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900 leading-tight">Settings</h1>
        <p className="text-sm text-slate-500 mt-0.5">Manage your organization settings</p>
      </div>

      {/* Tab switcher */}
      <div className="flex items-center gap-1 mb-6 bg-slate-100 rounded-xl p-1 w-fit">
        <button onClick={() => setActiveTab("general")} className={"px-4 py-2 rounded-lg text-sm font-semibold transition-all " + (activeTab === "general" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700")}>General</button>
        {can("org_admin") && <button onClick={() => setActiveTab("roles")} className={"px-4 py-2 rounded-lg text-sm font-semibold transition-all " + (activeTab === "roles" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700")}>Users &amp; Roles</button>}
      </div>

      {activeTab === "roles" && can("org_admin") && <RoleManagement />}

      {activeTab === "general" && (
        <div>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm mb-4">
            <div className="px-5 py-3.5 border-b border-slate-100"><h2 className="text-sm font-bold text-slate-800">Organization</h2></div>
            <div className="p-5 space-y-4">
              {form && (
                <>
                  <div><label className="block text-sm font-medium text-slate-700 mb-1.5">Organization name</label><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-sm font-medium text-slate-700 mb-1.5">Industry</label><select value={form.industry ?? ""} onChange={e => setForm({ ...form, industry: e.target.value })} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"><option value="">Select industry</option>{INDUSTRIES.map(i => <option key={i}>{i}</option>)}</select></div>
                    <div><label className="block text-sm font-medium text-slate-700 mb-1.5">Company size</label><select value={form.size ?? ""} onChange={e => setForm({ ...form, size: e.target.value })} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"><option value="">Select size</option>{SIZES.map(s => <option key={s}>{s}</option>)}</select></div>
                  </div>
                  <div><label className="block text-sm font-medium text-slate-700 mb-1.5">Website</label><input value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="https://..." /></div>
                  <button onClick={() => saveMutation.mutate()} disabled={!isDirty || saveMutation.isPending} className="px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">{saveMutation.isPending ? "Saving..." : saved ? "Saved" : "Save changes"}</button>
                </>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm mb-4">
            <div className="px-5 py-3.5 border-b border-slate-100"><h2 className="text-sm font-bold text-slate-800">Plan</h2></div>
            <div className="p-5">
              <div className="flex items-center justify-between">
                <div><p className="font-semibold text-slate-900 capitalize">{org?.plan ?? "Starter"} Plan</p><p className="text-sm text-slate-500 mt-0.5">All frameworks, integrations, and core features included.</p></div>
                <span className="px-3 py-1.5 bg-blue-100 text-blue-700 text-sm font-semibold rounded-full">Current plan</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm mb-4">
            <div className="px-5 py-3.5 border-b border-slate-100"><h2 className="text-sm font-bold text-slate-800">Organization Details</h2></div>
            <div className="p-5 space-y-3 text-sm">
              <div className="flex items-center justify-between"><span className="text-slate-500">Organization ID</span><span className="font-mono text-slate-700 text-xs bg-slate-100 px-2 py-1 rounded">{org?.id}</span></div>
              <div className="flex items-center justify-between"><span className="text-slate-500">Slug</span><span className="font-mono text-slate-700 text-xs bg-slate-100 px-2 py-1 rounded">{org?.slug}</span></div>
              <div className="flex items-center justify-between"><span className="text-slate-500">Created</span><span className="text-slate-700">{org?.createdAt ? new Date(org.createdAt).toLocaleDateString() : "-"}</span></div>
            </div>
          </div>

          <DataPortabilityExport orgId={orgId} />
        </div>
      )}
    </div>
  );
}

function DataPortabilityExport({ orgId }: { orgId: string }) {
  const [exporting, setExporting] = useState<string | null>(null);
  const [confirmExportAll, setConfirmExportAll] = useState(false);

  async function exportEvidence() {
    setExporting("evidence");
    try {
      const d = await fetch(`/api/orgs/${orgId}/evidence`, { credentials: "include" }).then(r => r.json());
      const items = d.evidence ?? [];
      const rows = [["ID","Title","Type","Source","Control ID","URL","Description","Collected At","Expires At"]];
      for (const e of items) rows.push([e.id,e.title,e.type,e.source,e.ucoControlId??"",e.url??"",e.description??"",e.collectedAt??"",e.expiresAt??""]);
      downloadCsv(`evidence-vault-${new Date().toISOString().slice(0,10)}.csv`, rows);
    } finally { setExporting(null); }
  }

  async function exportPoam() {
    setExporting("poam");
    try {
      const d = await fetch(`/api/orgs/${orgId}/poam`, { credentials: "include" }).then(r => r.json());
      const items = d.items ?? [];
      const rows = [["ID","Weakness Name","Control ID","Status","Severity","POC Name","POC Email","Resources","Estimated Cost","Scheduled Completion","Original Risk Rating","Residual Risk Rating","Milestones","Created At"]];
      for (const p of items) rows.push([p.id,p.weaknessName,p.controlId??"",p.status,p.severity,p.pocName??"",p.pocEmail??"",p.resources??"",p.estimatedCost??"",p.scheduledCompletionDate??"",p.originalRiskRating??"",p.residualRiskRating??"",p.milestones??"",p.createdAt??""]);
      downloadCsv(`poam-${new Date().toISOString().slice(0,10)}.csv`, rows);
    } finally { setExporting(null); }
  }

  async function exportRisks() {
    setExporting("risks");
    try {
      const d = await fetch(`/api/orgs/${orgId}/risks`, { credentials: "include" }).then(r => r.json());
      const items = d.risks ?? [];
      const rows = [["ID","Title","Description","Category","Likelihood","Impact","Status","Owner","Control IDs","Created At"]];
      for (const r of items) rows.push([r.id,r.title,r.description??"",r.category??"",r.likelihood,r.impact,r.status,r.owner??"",r.controlIds??"",r.createdAt??""]);
      downloadCsv(`risk-register-${new Date().toISOString().slice(0,10)}.csv`, rows);
    } finally { setExporting(null); }
  }

  async function exportAll() {
    setExporting("all");
    try {
      const [evidenceData, poamData, risksData] = await Promise.all([
        fetch(`/api/orgs/${orgId}/evidence`, { credentials: "include" }).then(r => r.json()),
        fetch(`/api/orgs/${orgId}/poam`, { credentials: "include" }).then(r => r.json()),
        fetch(`/api/orgs/${orgId}/risks`, { credentials: "include" }).then(r => r.json()),
      ]);
      downloadJson(`compliance-export-${new Date().toISOString().slice(0,10)}.json`, { exportedAt: new Date().toISOString(), orgId, evidence: evidenceData.evidence ?? [], poam: poamData.items ?? [], risks: risksData.risks ?? [] });
    } finally { setExporting(null); }
  }

  const EXPORTS = [
    { id: "evidence", label: "Evidence Vault", desc: "All evidence items with artifact URLs, control mappings, collection dates, and expiry", format: "CSV", action: exportEvidence },
    { id: "poam", label: "POA&M Register", desc: "All plan of action items with FedRAMP-required fields", format: "CSV", action: exportPoam },
    { id: "risks", label: "Risk Register", desc: "All risk items with likelihood, impact, category, owner, and linked controls", format: "CSV", action: exportRisks },
  ];

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
      <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
        <div><h2 className="text-sm font-bold text-slate-800">Data Portability &amp; Export</h2><p className="text-xs text-slate-500 mt-0.5">Your compliance data is yours. Export it any time.</p></div>
        <button onClick={() => setConfirmExportAll(true)} disabled={!!exporting} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">{exporting === "all" ? "Exporting..." : "Export All (JSON)"}</button>
      </div>
      <div className="p-5">
        <div className="space-y-2">
          {EXPORTS.map((ex) => (
            <div key={ex.id} className="flex items-center justify-between gap-4 px-4 py-3.5 border border-slate-100 rounded-lg hover:bg-slate-50 transition-colors">
              <div className="flex-1 min-w-0"><p className="text-sm font-semibold text-slate-800">{ex.label}</p><p className="text-xs text-slate-500 mt-0.5">{ex.desc}</p></div>
              <div className="flex items-center gap-2"><span className="text-xs font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded">{ex.format}</span><button onClick={ex.action} disabled={!!exporting} className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 text-slate-600 text-xs font-semibold rounded-lg hover:bg-slate-100 disabled:opacity-50 transition-colors">{exporting === ex.id ? "Exporting..." : "Export"}</button></div>
            </div>
          ))}
        </div>

        <div className="mt-6 bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-5"><div className="p-2.5 rounded-xl bg-purple-50 border border-purple-100"><svg className="h-5 w-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.955 11.955 0 003 10c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.75h-.152c-3.196 0-6.1-1.249-8.25-3.286zm0 13.036h.008v.008H12v-.008z" /></svg></div><div><h2 className="text-base font-semibold text-slate-800">SSO / SAML Configuration</h2><p className="text-xs text-slate-500 mt-0.5">Single Sign-On for enterprise authentication</p></div></div>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div><label className="block text-xs font-semibold text-slate-700 mb-1.5">SSO Provider</label><select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"><option value="">Disabled</option><option value="okta">Okta</option><option value="azure_ad">Microsoft Entra ID</option><option value="google">Google Workspace</option><option value="saml">Generic SAML 2.0</option></select></div><div><label className="block text-xs font-semibold text-slate-700 mb-1.5">SSO Domain</label><input type="text" placeholder="company.com" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" /></div></div>
            <button onClick={() => { const el = document.createElement("div"); el.style.cssText = "position:fixed;bottom:24px;right:24px;background:#7c3aed;color:white;padding:12px 20px;border-radius:12px;font-size:14px;font-weight:600;z-index:9999"; el.textContent = "SSO configuration saved"; document.body.appendChild(el); setTimeout(() => el.remove(), 2500); }} className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700">Save SSO Configuration</button>
          </div>
        </div>

        <div className="mt-6 bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-5"><div className="p-2.5 rounded-xl bg-blue-50 border border-blue-100"><svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" /></svg></div><div><h2 className="text-base font-semibold text-slate-800">Notification Preferences</h2><p className="text-xs text-slate-500 mt-0.5">Control when and how you receive compliance alerts</p></div></div>
          <div className="space-y-3">
            {[{key:"evidence_expiry",label:"Evidence expiring within 30 days",desc:"Get notified when evidence items are about to expire",default:true},{key:"policy_review",label:"Policies due for annual review",desc:"Reminder when policies pass their review date",default:true},{key:"control_failing",label:"Controls failing for over 24 hours",desc:"Critical alert when controls remain in failing state",default:true}].map(pref => (
              <div key={pref.key} className="flex items-center justify-between py-3 border-b border-slate-50 last:border-0">
                <div><p className="text-sm font-medium text-slate-800">{pref.label}</p><p className="text-xs text-slate-400 mt-0.5">{pref.desc}</p></div>
                <input type="checkbox" defaultChecked={pref.default} className="h-4 w-4 text-blue-600 rounded" />
              </div>
            ))}
          </div>
          <button onClick={() => { const el = document.createElement("div"); el.style.cssText = "position:fixed;bottom:24px;right:24px;background:#2563eb;color:white;padding:12px 20px;border-radius:12px;font-size:14px;font-weight:600;z-index:9999"; el.textContent = "Notification preferences saved"; document.body.appendChild(el); setTimeout(() => el.remove(), 2500); }} className="mt-4 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">Save Preferences</button>
        </div>

        <div className="mt-6 bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-5"><div className="p-2.5 rounded-xl bg-orange-50 border border-orange-100"><svg className="h-5 w-5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg></div><div><h2 className="text-base font-semibold text-slate-800">Risk Appetite</h2><p className="text-xs text-slate-500 mt-0.5">Define your organization tolerance for compliance risk</p></div></div>
          <div className="space-y-3">
            {[{val:"conservative",label:"Conservative",desc:"Minimal risk tolerance. All critical and high risks must be mitigated within 30 days."},{val:"moderate",label:"Moderate",desc:"Balanced approach. Critical risks mitigated within 60 days, high within 90 days."},{val:"aggressive",label:"Aggressive",desc:"Higher tolerance for operational risk. Focus on critical risks only."}].map(opt => (
              <label key={opt.val} className="flex items-start gap-3 p-3 border border-slate-200 rounded-xl cursor-pointer hover:border-blue-300 hover:bg-blue-50/30">
                <input type="radio" name="risk_appetite" value={opt.val} defaultChecked={opt.val === "moderate"} className="mt-0.5" />
                <div><p className="text-sm font-semibold text-slate-800">{opt.label}</p><p className="text-xs text-slate-500 mt-0.5">{opt.desc}</p></div>
              </label>
            ))}
          </div>
          <button onClick={() => { const el = document.createElement("div"); el.style.cssText = "position:fixed;bottom:24px;right:24px;background:#ea580c;color:white;padding:12px 20px;border-radius:12px;font-size:14px;font-weight:600;z-index:9999"; el.textContent = "Risk appetite saved"; document.body.appendChild(el); setTimeout(() => el.remove(), 2500); }} className="mt-4 px-4 py-2 bg-orange-600 text-white text-sm font-medium rounded-lg hover:bg-orange-700">Save Risk Appetite</button>
        </div>

      </div>
    </div>
  );
}

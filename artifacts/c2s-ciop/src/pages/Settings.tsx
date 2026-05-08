import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiUrl, apiFetch } from "@/lib/queryClient";
import { useOrg } from "@/hooks/useOrg";

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

const INDUSTRIES = ["Technology", "Healthcare", "Finance", "Government", "Retail", "Manufacturing", "Education", "Other"];
const SIZES = ["1-10", "11-50", "51-200", "201-500", "501-1000", "1000+"];

export default function Settings() {
  const qc = useQueryClient();
  const { orgId } = useOrg();

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
    <div className="p-6 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900 leading-tight">Settings</h1>
        <p className="text-sm text-slate-500 mt-0.5">Manage your organization settings</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm mb-4">
        <div className="px-5 py-3.5 border-b border-slate-100">
          <h2 className="text-sm font-bold text-slate-800">Organization</h2>
        </div>
        <div className="p-5 space-y-4">
          {form && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Organization name</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Industry</label>
                  <select value={form.industry ?? ""} onChange={e => setForm({ ...form, industry: e.target.value })} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Select industry</option>
                    {INDUSTRIES.map(i => <option key={i}>{i}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Company size</label>
                  <select value={form.size ?? ""} onChange={e => setForm({ ...form, size: e.target.value })} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Select size</option>
                    {SIZES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Website</label>
                <input value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="https://..." />
              </div>
              <button
                onClick={() => saveMutation.mutate()}
                disabled={!isDirty || saveMutation.isPending}
                className="px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {saveMutation.isPending ? "Saving..." : saved ? "Saved" : "Save changes"}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm mb-4">
        <div className="px-5 py-3.5 border-b border-slate-100">
          <h2 className="text-sm font-bold text-slate-800">Plan</h2>
        </div>
        <div className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-slate-900 capitalize">{org?.plan ?? "Starter"} Plan</p>
              <p className="text-sm text-slate-500 mt-0.5">All frameworks, integrations, and core features included.</p>
            </div>
            <span className="px-3 py-1.5 bg-blue-100 text-blue-700 text-sm font-semibold rounded-full">Current plan</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm mb-4">
        <div className="px-5 py-3.5 border-b border-slate-100">
          <h2 className="text-sm font-bold text-slate-800">Organization Details</h2>
        </div>
        <div className="p-5 space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Organization ID</span>
            <span className="font-mono text-slate-700 text-xs bg-slate-100 px-2 py-1 rounded">{org?.id}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Slug</span>
            <span className="font-mono text-slate-700 text-xs bg-slate-100 px-2 py-1 rounded">{org?.slug}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Created</span>
            <span className="text-slate-700">{org?.createdAt ? new Date(org.createdAt).toLocaleDateString() : "-"}</span>
          </div>
        </div>
      </div>

      <DataPortabilityExport orgId={orgId} />
    </div>
  );
}

function DataPortabilityExport({ orgId }: { orgId: string }) {
  const [exporting, setExporting] = useState<string | null>(null);

  async function exportEvidence() {
    setExporting("evidence");
    try {
      const d = await apiFetch(`/orgs/${orgId}/evidence`);
      const items = d.evidence ?? [];
      const rows = [["ID","Title","Type","Source","Control ID","URL","Description","Collected At","Expires At"]];
      for (const e of items) rows.push([e.id,e.title,e.type,e.source,e.ucoControlId??"",e.url??"",e.description??"",e.collectedAt??"",e.expiresAt??""]);
      downloadCsv(`evidence-vault-${new Date().toISOString().slice(0,10)}.csv`, rows);
    } finally { setExporting(null); }
  }

  async function exportPoam() {
    setExporting("poam");
    try {
      const d = await apiFetch(`/orgs/${orgId}/poam`);
      const items = d.items ?? [];
      const rows = [["ID","Weakness Name","Control ID","Status","Severity","POC Name","POC Email","Resources","Estimated Cost","Scheduled Completion","Original Risk Rating","Residual Risk Rating","Milestones","Created At"]];
      for (const p of items) rows.push([p.id,p.weaknessName,p.controlId??"",p.status,p.severity,p.pocName??"",p.pocEmail??"",p.resources??"",p.estimatedCost??"",p.scheduledCompletionDate??"",p.originalRiskRating??"",p.residualRiskRating??"",p.milestones??"",p.createdAt??""]);
      downloadCsv(`poam-${new Date().toISOString().slice(0,10)}.csv`, rows);
    } finally { setExporting(null); }
  }

  async function exportRisks() {
    setExporting("risks");
    try {
      const d = await apiFetch(`/orgs/${orgId}/risks`);
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
        apiFetch(`/orgs/${orgId}/evidence`),
        apiFetch(`/orgs/${orgId}/poam`),
        apiFetch(`/orgs/${orgId}/risks`),
      ]);
      const exportPackage = {
        exportedAt: new Date().toISOString(),
        exportedBy: "EnterpriseComply",
        version: "1.0",
        orgId,
        evidence: evidenceData.evidence ?? [],
        poam: poamData.items ?? [],
        risks: risksData.risks ?? [],
      };
      downloadJson(`compliance-export-${new Date().toISOString().slice(0,10)}.json`, exportPackage);
    } finally { setExporting(null); }
  }

  const EXPORTS = [
    { id: "evidence", label: "Evidence Vault", desc: "All evidence items with artifact URLs, control mappings, collection dates, and expiry", format: "CSV", action: exportEvidence },
    { id: "poam", label: "POA&M Register", desc: "All plan of action items with FedRAMP-required fields - eMASS-compatible column format", format: "CSV", action: exportPoam },
    { id: "risks", label: "Risk Register", desc: "All risk items with likelihood, impact, category, owner, and linked controls", format: "CSV", action: exportRisks },
  ];

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
      <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-slate-800">Data Portability &amp; Export</h2>
          <p className="text-xs text-slate-500 mt-0.5">Your compliance data is yours. Export it any time, no questions asked.</p>
        </div>
        <button
          onClick={exportAll}
          disabled={!!exporting}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          {exporting === "all" ? "Exporting..." : "Export All (JSON)"}
        </button>
      </div>

      <div className="p-5">
        <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 mb-4 flex items-start gap-3">
          <svg className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
          </svg>
          <p className="text-xs text-blue-700 leading-relaxed">
            Exports are available on-demand, 24/7. Evidence artifact URLs point to the external locations you provided - your artifacts live at those URLs, not inside our system. "Export All" produces a single JSON file containing all data sets. Use the individual exports for CSV format.
          </p>
        </div>

        <div className="space-y-2">
          {EXPORTS.map((ex) => (
            <div key={ex.id} className="flex items-center justify-between gap-4 px-4 py-3.5 border border-slate-100 rounded-lg hover:bg-slate-50 transition-colors">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800">{ex.label}</p>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{ex.desc}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-xs font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded">{ex.format}</span>
                <button
                  onClick={ex.action}
                  disabled={!!exporting}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 text-slate-600 text-xs font-semibold rounded-lg hover:bg-slate-100 disabled:opacity-50 transition-colors"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  {exporting === ex.id ? "Exporting..." : "Export"}
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>SSP and board reports are available from their respective pages in the Federal and Dashboard sections.</span>
          <a href="/trust-center" className="text-blue-600 hover:underline font-medium flex-shrink-0 ml-3">View portability policy</a>
        </div>
      </div>
    </div>
  );
}

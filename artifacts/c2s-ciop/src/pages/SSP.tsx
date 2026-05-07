import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/lib/queryClient";
import { useOrg } from "@/hooks/useOrg";

const FRAMEWORKS = ["fedramp", "cmmc-l2", "nist-800-53", "soc2", "iso27001", "hipaa"];
const FRAMEWORK_LABELS: Record<string, string> = { fedramp: "FedRAMP", "cmmc-l2": "CMMC L2", "nist-800-53": "NIST 800-53", soc2: "SOC 2", iso27001: "ISO 27001", hipaa: "HIPAA" };

export default function SSP() {
  const { orgId } = useOrg();
  const [step, setStep] = useState(1);
  const [generated, setGenerated] = useState<any>(null);
  const [form, setForm] = useState({
    systemName: "", systemDescription: "", systemOwner: "", systemOwnerEmail: "",
    dataClassification: "Controlled Unclassified Information (CUI)", operationalStatus: "Operational",
    systemType: "Cloud-Based", cloudProvider: "Amazon Web Services (AWS)", frameworkKey: "fedramp",
    authorizationBoundary: "", networkDescription: "",
  });

  const generateMutation = useMutation({
    mutationFn: (body: typeof form) => apiFetch(`/orgs/${orgId}/ssp/generate`, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: (d) => { setGenerated(d.ssp); setStep(3); },
  });

  const exportMutation = useMutation({
    mutationFn: () => apiFetch(`/orgs/${orgId}/ssp/export-text`, { method: "POST", body: JSON.stringify({ ssp: generated }) }),
    onSuccess: (d: any) => {
      const blob = new Blob([d.text], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = d.filename; a.click();
    },
  });

  const f = (field: string, val: string) => setForm({ ...form, [field]: val });

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">SSP Generator</h1>
          <p className="text-sm text-slate-500 mt-0.5">Generate a System Security Plan for FedRAMP, CMMC, or NIST 800-53</p>
        </div>
      </div>

      <div className="flex gap-3 mb-8">
        {["System Info", "Details", "Review & Export"].map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${step > i + 1 ? "bg-green-500 text-white" : step === i + 1 ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-400"}`}>
              {step > i + 1 ? "✓" : i + 1}
            </div>
            <span className={`text-sm font-medium ${step === i + 1 ? "text-blue-600" : "text-slate-400"}`}>{label}</span>
            {i < 2 && <div className="w-8 h-px bg-slate-200" />}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">System Name *</label>
              <input value={form.systemName} onChange={(e) => f("systemName", e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. Acme SaaS Platform" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">System Description *</label>
              <textarea value={form.systemDescription} onChange={(e) => f("systemDescription", e.target.value)} rows={3} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Brief description of the system's purpose and capabilities..." />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">System Owner *</label>
              <input value={form.systemOwner} onChange={(e) => f("systemOwner", e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Full name" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Owner Email *</label>
              <input type="email" value={form.systemOwnerEmail} onChange={(e) => f("systemOwnerEmail", e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Framework</label>
              <select value={form.frameworkKey} onChange={(e) => f("frameworkKey", e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
                {FRAMEWORKS.map((fw) => <option key={fw} value={fw}>{FRAMEWORK_LABELS[fw] ?? fw}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Data Classification</label>
              <select value={form.dataClassification} onChange={(e) => f("dataClassification", e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
                {["Controlled Unclassified Information (CUI)", "Federal Contract Information (FCI)", "Public", "Sensitive PII", "PHI"].map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="flex justify-end">
            <button onClick={() => setStep(2)} disabled={!form.systemName || !form.systemOwner || !form.systemOwnerEmail}
              className="px-5 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">Next</button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Operational Status</label>
              <select value={form.operationalStatus} onChange={(e) => f("operationalStatus", e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
                {["Operational", "Under Development", "Major Modification", "Planned"].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">System Type</label>
              <select value={form.systemType} onChange={(e) => f("systemType", e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
                {["Cloud-Based", "On-Premise", "Hybrid", "Mobile"].map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Cloud Provider (if applicable)</label>
              <select value={form.cloudProvider} onChange={(e) => f("cloudProvider", e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
                {["Amazon Web Services (AWS)", "Microsoft Azure", "Google Cloud Platform (GCP)", "N/A - On-Premise"].map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Authorization Boundary Description</label>
              <textarea value={form.authorizationBoundary} onChange={(e) => f("authorizationBoundary", e.target.value)} rows={2} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none" placeholder="Describe the logical and physical boundaries of the system..." />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Network Architecture Description</label>
              <textarea value={form.networkDescription} onChange={(e) => f("networkDescription", e.target.value)} rows={2} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none" placeholder="Describe network topology, data flows, and external connections..." />
            </div>
          </div>
          <div className="flex justify-between">
            <button onClick={() => setStep(1)} className="px-5 py-2 text-sm border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50">Back</button>
            <button onClick={() => generateMutation.mutate(form)} disabled={generateMutation.isPending}
              className="px-5 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {generateMutation.isPending ? "Generating SSP..." : "Generate SSP"}
            </button>
          </div>
        </div>
      )}

      {step === 3 && generated && (
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-xl p-5 flex items-center justify-between">
            <div>
              <p className="font-semibold text-green-800">SSP Generated Successfully</p>
              <p className="text-sm text-green-600 mt-0.5">
                {generated.complianceSummary?.implemented}/{generated.complianceSummary?.totalControls} controls implemented
                ({Math.round((generated.complianceSummary?.implemented / generated.complianceSummary?.totalControls) * 100)}%)
              </p>
            </div>
            <button onClick={() => exportMutation.mutate()} disabled={exportMutation.isPending}
              className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {exportMutation.isPending ? "Exporting..." : "Export as Text"}
            </button>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50">
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                <div><span className="text-slate-500">System:</span> <span className="font-medium text-slate-800">{generated.system?.name}</span></div>
                <div><span className="text-slate-500">Framework:</span> <span className="font-medium text-slate-800">{generated.framework}</span></div>
                <div><span className="text-slate-500">Owner:</span> <span className="font-medium text-slate-800">{generated.system?.owner}</span></div>
                <div><span className="text-slate-500">Classification:</span> <span className="font-medium text-slate-800">{generated.system?.dataClassification}</span></div>
              </div>
            </div>
            <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
              {(generated.controlSections ?? []).map((c: any) => (
                <div key={c.controlId} className="px-5 py-3 flex items-start gap-4">
                  <span className="text-xs font-mono font-semibold text-slate-500 w-24 flex-shrink-0 pt-0.5">{c.controlId}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-800">{c.title}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${c.implementationStatus === "Implemented" ? "bg-green-50 text-green-700" : c.implementationStatus === "Planned" ? "bg-yellow-50 text-yellow-700" : "bg-slate-100 text-slate-500"}`}>
                        {c.implementationStatus}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{c.implementationStatement}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={() => { setStep(1); setGenerated(null); }} className="px-4 py-2 text-sm border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50">New SSP</button>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/queryClient";
import { useOrg } from "@/hooks/useOrg";

const FRAMEWORK_LABELS: Record<string, string> = {
  soc2: "SOC 2", iso27001: "ISO 27001", fedramp: "FedRAMP", hipaa: "HIPAA",
  "pci-dss": "PCI DSS", "cmmc-l2": "CMMC L2", "nist-800-53": "NIST 800-53",
};

export default function Audits() {
  const { orgId } = useOrg();
  const qc = useQueryClient();
  const [showNew, setShowNew] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [showRequest, setShowRequest] = useState(false);
  const [tokenModal, setTokenModal] = useState<{ token: string; name: string } | null>(null);
  const [tokenCopied, setTokenCopied] = useState(false);
  const [form, setForm] = useState({ name: "", frameworkKey: "soc2", auditorFirm: "", auditorName: "", auditorEmail: "", startDate: "", endDate: "", notes: "" });
  const [reqForm, setReqForm] = useState({ title: "", description: "", ucoControlId: "", dueDate: "" });

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

  const copyToken = () => {
    if (!tokenModal) return;
    navigator.clipboard.writeText(tokenModal.token).then(() => {
      setTokenCopied(true);
      setTimeout(() => setTokenCopied(false), 2000);
    });
  };

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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white border border-slate-200 rounded-xl p-5">
                  <p className="font-semibold text-slate-800 text-sm mb-2">How it works</p>
                  <ol className="space-y-2">
                    {["Create an engagement and assign a framework (SOC 2, ISO 27001, FedRAMP, etc.)", "An auditor access token is generated - share it securely with your auditor firm", "Track evidence requests from the auditor and mark them resolved as you provide documents", "Close the engagement when the audit is complete to archive evidence"].map((step, i) => (
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
                    {["SOC 2", "ISO 27001", "FedRAMP", "HIPAA", "PCI DSS", "CMMC L2", "NIST 800-53"].map(f => (
                      <span key={f} className="px-2.5 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-lg">{f}</span>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-3 leading-relaxed">Each engagement generates an auditor access token providing read-only access to evidence you explicitly share. Revoked automatically when the engagement closes.</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {engagements.map((e) => (
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
                    <div className="text-right text-sm">
                      <div className="flex gap-4">
                        <div className="text-center"><p className="text-lg font-bold text-slate-800">{e.requestSummary?.total}</p><p className="text-xs text-slate-400">Total</p></div>
                        <div className="text-center"><p className="text-lg font-bold text-orange-600">{e.requestSummary?.pending}</p><p className="text-xs text-slate-400">Pending</p></div>
                        <div className="text-center"><p className="text-lg font-bold text-green-600">{e.requestSummary?.resolved}</p><p className="text-xs text-slate-400">Resolved</p></div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <div>
          <div className="flex items-center gap-3 mb-5">
            <button onClick={() => setSelected(null)} className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              Back
            </button>
            <h2 className="text-lg font-semibold text-slate-900">{selected.name}</h2>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${selected.status === "active" ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-500"}`}>{selected.status}</span>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-5 text-sm flex items-center justify-between">
            <div>
              <p className="font-medium text-blue-800">Auditor: {selected.auditorName} ({selected.auditorEmail})</p>
              <p className="text-blue-600 mt-0.5">Framework: {FRAMEWORK_LABELS[selected.frameworkKey] ?? selected.frameworkKey}</p>
            </div>
            {selected.accessToken && (
              <button
                onClick={() => setTokenModal({ token: selected.accessToken, name: selected.name })}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 text-blue-700 text-xs font-semibold rounded-lg hover:bg-blue-200 transition-colors"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
                View access token
              </button>
            )}
          </div>

          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-slate-700">Evidence Requests ({requests.length})</h3>
            <div className="flex gap-2">
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
                      {req.ucoControlId && <span className="text-xs text-slate-400">{req.ucoControlId}</span>}
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
            {requests.length === 0 && <p className="text-sm text-slate-400 text-center py-8">No evidence requests yet.</p>}
          </div>
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
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">Auditor Access Token</h2>
              <button onClick={() => setTokenModal(null)} className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-5">
              <p className="text-sm text-slate-600 mb-3">Share this token with the auditor for <span className="font-semibold">{tokenModal.name}</span>. It provides read-only access to requested evidence.</p>
              <div className="flex gap-2 items-stretch">
                <div className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 font-mono text-sm text-slate-700 break-all select-all">
                  {tokenModal.token}
                </div>
                <button onClick={copyToken}
                  className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors flex-shrink-0 ${tokenCopied ? "bg-green-600 text-white" : "bg-blue-600 text-white hover:bg-blue-700"}`}>
                  {tokenCopied ? "Copied!" : "Copy"}
                </button>
              </div>
              <p className="text-xs text-slate-400 mt-3">Keep this token confidential. It can be revoked by closing the engagement.</p>
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

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/queryClient";
import { useOrg } from "@/hooks/useOrg";

const TEMPLATE_QUESTIONS: Record<string, string[]> = {
  "sig-lite": [
    "Do you enforce multi-factor authentication (MFA) for all users?",
    "Is data encrypted at rest using AES-256 or equivalent?",
    "Is data encrypted in transit using TLS 1.2 or higher?",
    "Do you conduct annual penetration testing?",
    "Do you have a documented incident response plan?",
    "How quickly do you respond to critical security incidents?",
    "Do you conduct regular vulnerability scans?",
    "What is your patching SLA for critical vulnerabilities?",
    "Do you maintain audit logs for all administrative actions?",
    "How long are audit logs retained?",
    "Do you perform annual security awareness training?",
    "Do you have a formal access review process?",
    "Do you have SOC 2, ISO 27001, or equivalent certification?",
    "Do you conduct background checks on employees with data access?",
    "Do you have a Business Continuity Plan (BCP)?",
    "Do you maintain a formal vendor risk management program?",
    "Is privileged access managed and monitored using PAM tools?",
    "Do you enforce least privilege across all systems?",
    "Do you have a written information security policy?",
    "Do you have a documented data classification policy?",
  ],
  "caiq": [
    "Do you provide tenants with documentation detailing your data residency options?",
    "Do you enforce role-based access control (RBAC)?",
    "Is privileged access managed and monitored?",
    "Do you implement DMARC, SPF, and DKIM for email security?",
    "Do you have a formal change management process?",
    "Are security patches tested before deployment?",
    "Do you support SSO via SAML or OIDC?",
    "Do you have a documented data breach notification procedure?",
    "Do you undergo annual third-party security audits?",
    "Do you maintain an asset inventory?",
    "Do you use a SIEM or centralized log management system?",
    "Is data wiped or destroyed securely when decommissioning hardware?",
    "Do you have a formal software development lifecycle (SDLC) security process?",
    "Do you perform code reviews and/or static analysis before releases?",
    "Do you maintain a bug bounty or responsible disclosure program?",
  ],
  "vsaq": [
    "What certifications does your organization hold (SOC 2, ISO 27001, FedRAMP, etc.)?",
    "Do you have a dedicated security team or CISO?",
    "How are security incidents escalated and communicated to customers?",
    "Do you have cyber liability insurance?",
    "What is your mean time to detect (MTTD) and mean time to respond (MTTR) for security incidents?",
    "Do you perform regular tabletop exercises or incident response drills?",
    "Are employees required to sign NDAs and acceptable use policies?",
    "Do you have a formal offboarding process that revokes all access?",
    "Do you use a password manager or enforce password complexity requirements?",
    "How do you handle subprocessors and fourth-party risk?",
  ],
};

export default function Questionnaires() {
  const { orgId } = useOrg();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"incoming" | "vendor">("incoming");
  const [showNew, setShowNew] = useState(false);
  const [selectedQ, setSelectedQ] = useState<any>(null);
  const [form, setForm] = useState({ title: "", requesterName: "", requesterCompany: "", requesterEmail: "", type: "sig-lite", dueDate: "", questions: TEMPLATE_QUESTIONS["sig-lite"] });

  const { data } = useQuery<{ questionnaires: any[] }>({
    queryKey: ["questionnaires", orgId],
    queryFn: () => apiFetch(`/orgs/${orgId}/questionnaires`),
    enabled: !!orgId,
  });

  const { data: itemsData } = useQuery<{ items: any[] }>({
    queryKey: ["questionnaire-items", orgId, selectedQ?.id],
    queryFn: () => apiFetch(`/orgs/${orgId}/questionnaires/${selectedQ.id}/items`),
    enabled: !!orgId && !!selectedQ,
  });

  const { data: vendorData } = useQuery<{ assessments: any[] }>({
    queryKey: ["vendor-assessments", orgId],
    queryFn: () => apiFetch(`/orgs/${orgId}/vendor-assessments`),
    enabled: !!orgId,
  });

  const { data: vendorsData } = useQuery<{ vendors: any[] }>({
    queryKey: ["vendors", orgId],
    queryFn: () => apiFetch(`/orgs/${orgId}/vendors`),
    enabled: !!orgId,
  });

  const createMutation = useMutation({
    mutationFn: (body: typeof form) => apiFetch(`/orgs/${orgId}/questionnaires`, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: (d) => { qc.invalidateQueries({ queryKey: ["questionnaires"] }); setShowNew(false); setSelectedQ(d.questionnaire); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/orgs/${orgId}/questionnaires/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["questionnaires"] }),
  });

  const updateItemMutation = useMutation({
    mutationFn: ({ id, answer }: { id: number; answer: string }) =>
      apiFetch(`/orgs/${orgId}/questionnaires/items/${id}`, { method: "PATCH", body: JSON.stringify({ answer }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["questionnaire-items"] }),
  });

  const sendVendorMutation = useMutation({
    mutationFn: (body: any) => apiFetch(`/orgs/${orgId}/vendor-assessments`, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vendor-assessments"] }),
  });

  const questionnaires = data?.questionnaires ?? [];
  const items = itemsData?.items ?? [];
  const vendorAssessments = vendorData?.assessments ?? [];
  const vendors = vendorsData?.vendors ?? [];
  const answeredCount = items.filter((i) => i.answer).length;
  const autoAnsweredCount = items.filter((i) => i.answer && i.matchedControlId).length;

  return (
    <div className="p-6 max-w-screen-xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Security Questionnaires</h1>
          <p className="text-sm text-slate-500 mt-0.5">Questionnaire response management and vendor risk assessments</p>
        </div>
        <button onClick={() => setShowNew(true)} className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700">
          + New Questionnaire
        </button>
      </div>

      <div className="flex gap-1 border-b border-slate-200 mb-6">
        {[["incoming", "Incoming (SQA)"], ["vendor", "Vendor Assessments"]].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id as typeof tab)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === id ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === "incoming" && !selectedQ && (
        <div className="space-y-3">
          {questionnaires.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
              <div className="h-12 w-12 bg-slate-100 rounded-xl flex items-center justify-center mx-auto mb-3 text-slate-400">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
              <p className="text-slate-600 font-medium">No questionnaires yet</p>
              <p className="text-slate-400 text-sm mt-1 mb-4">Create one to auto-fill responses from your compliance controls and evidence.</p>
              <button onClick={() => setShowNew(true)} className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700">Create questionnaire</button>
            </div>
          ) : questionnaires.map((q) => (
            <div key={q.id} className="bg-white border border-slate-200 rounded-xl p-5 flex items-center justify-between hover:border-slate-300 transition-colors group">
              <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setSelectedQ(q)}>
                <p className="font-medium text-slate-800">{q.title}</p>
                <p className="text-sm text-slate-500 mt-0.5">{q.requesterCompany} {q.requesterEmail && `(${q.requesterEmail})`}</p>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <div className="text-center cursor-pointer" onClick={() => setSelectedQ(q)}>
                  <p className="font-bold text-blue-600">{q.answeredItems}/{q.totalItems}</p>
                  <p className="text-xs text-slate-400">Answered</p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${q.status === "completed" ? "bg-green-50 text-green-700" : "bg-orange-50 text-orange-600"}`}>{q.status}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(q.id); }}
                  disabled={deleteMutation.isPending}
                  className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors opacity-0 group-hover:opacity-100">
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "incoming" && selectedQ && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <button onClick={() => setSelectedQ(null)} className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg> Back
            </button>
            <h2 className="font-semibold text-slate-900">{selectedQ.title}</h2>
          </div>

          {autoAnsweredCount > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-sm flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg className="h-4 w-4 text-blue-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                <span className="text-blue-700">
                  {autoAnsweredCount} of {items.length} questions pre-filled by keyword matching against your compliance data.
                  <span className="text-blue-500 ml-1">Review and edit all answers before sending.</span>
                </span>
              </div>
              <span className="text-xs font-medium text-blue-600 flex-shrink-0">{items.length > 0 ? Math.round((answeredCount / items.length) * 100) : 0}% complete</span>
            </div>
          )}

          <div className="space-y-3">
            {items.map((item, idx) => (
              <div key={item.id} className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <span className="text-xs font-mono font-semibold text-slate-400 pt-0.5 flex-shrink-0">Q{idx + 1}</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-800 mb-2">{item.question}</p>
                    {item.matchedControlId && (
                      <div className="flex items-center gap-1.5 mb-2">
                        <span className="inline-flex items-center gap-1 text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full border border-slate-200">
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                          Matched: {item.matchedControlId}
                        </span>
                        <span className="text-xs text-slate-400">keyword match - verify accuracy</span>
                      </div>
                    )}
                    <textarea
                      defaultValue={item.answer ?? ""}
                      onBlur={(e) => { if (e.target.value !== item.answer) updateItemMutation.mutate({ id: item.id, answer: e.target.value }); }}
                      rows={3}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter your answer..."
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "vendor" && (
        <div>
          <div className="flex justify-end mb-4">
            {vendors.length > 0 && (
              <select defaultValue="" onChange={(e) => { if (e.target.value) sendVendorMutation.mutate({ vendorId: Number(e.target.value), templateType: "sig-lite" }); }}
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none bg-white">
                <option value="">Send assessment to vendor...</option>
                {vendors.map((v: any) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            )}
          </div>
          {vendorAssessments.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
              <p className="text-slate-500 text-sm">No vendor assessments sent. Select a vendor above to send a SIG-Lite or CAIQ assessment.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {vendorAssessments.map((a) => (
                <div key={a.id} className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-slate-800">{a.vendor?.name ?? `Vendor #${a.vendorId}`}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{a.templateType.toUpperCase()} assessment sent {new Date(a.sentAt).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-center text-sm"><p className="font-bold text-slate-700">{a.answeredItems}/{a.totalItems}</p><p className="text-xs text-slate-400">Answered</p></div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${a.status === "responded" ? "bg-green-50 text-green-700" : "bg-orange-50 text-orange-600"}`}>{a.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showNew && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="p-5 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900">New Security Questionnaire</h2>
              <p className="text-xs text-slate-400 mt-0.5">Responses will be pre-filled using keyword matching against your controls and evidence.</p>
            </div>
            <div className="p-5 space-y-3">
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Title *</label>
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. Acme Corp SIG-Lite 2025" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-slate-600 mb-1">Requester Name</label>
                  <input value={form.requesterName} onChange={(e) => setForm({ ...form, requesterName: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none" /></div>
                <div><label className="block text-xs font-medium text-slate-600 mb-1">Requester Company</label>
                  <input value={form.requesterCompany} onChange={(e) => setForm({ ...form, requesterCompany: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none" /></div>
              </div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Template</label>
                <select value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value, questions: TEMPLATE_QUESTIONS[e.target.value] ?? TEMPLATE_QUESTIONS["sig-lite"] })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none bg-white">
                  <option value="sig-lite">SIG-Lite ({TEMPLATE_QUESTIONS["sig-lite"].length} questions)</option>
                  <option value="caiq">CAIQ ({TEMPLATE_QUESTIONS["caiq"].length} questions)</option>
                  <option value="vsaq">VSAQ ({TEMPLATE_QUESTIONS["vsaq"].length} questions)</option>
                </select>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-500">
                <p className="font-semibold text-slate-700 mb-1">How pre-filling works</p>
                <p>Answers are generated by matching question keywords against your compliance controls and evidence. All answers are editable - review each one before sending.</p>
              </div>
            </div>
            <div className="p-5 border-t border-slate-100 flex gap-3 justify-end">
              <button onClick={() => setShowNew(false)} className="px-4 py-2 text-sm border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50">Cancel</button>
              <button onClick={() => createMutation.mutate(form)} disabled={!form.title || createMutation.isPending}
                className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {createMutation.isPending ? "Processing..." : "Create & Pre-fill"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

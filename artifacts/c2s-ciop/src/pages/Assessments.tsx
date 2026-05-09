import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/queryClient";
import { useOrg } from "@/hooks/useOrg";
import { useLocation } from "wouter";

const FRAMEWORK_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  "zero-trust":     { label: "Zero Trust Posture", color: "#2563eb", bg: "#eff6ff" },
  "nist-800-171":   { label: "NIST 800-171",       color: "#16a34a", bg: "#f0fdf4" },
  "cmmc-l2":        { label: "CMMC Level 2",        color: "#9333ea", bg: "#faf5ff" },
  "soc2":           { label: "SOC 2 Type II",       color: "#d97706", bg: "#fffbeb" },
  "fedramp-moderate": { label: "FedRAMP Moderate",  color: "#dc2626", bg: "#fef2f2" },
};

const STATUS_STYLES: Record<string, { label: string; dot: string; text: string; bg: string }> = {
  in_progress: { label: "In Progress", dot: "bg-blue-500",   text: "text-blue-700",   bg: "bg-blue-50"  },
  complete:    { label: "Complete",    dot: "bg-green-500",  text: "text-green-700",  bg: "bg-green-50" },
  draft:       { label: "Draft",       dot: "bg-slate-400",  text: "text-slate-600",  bg: "bg-slate-100"},
  archived:    { label: "Archived",    dot: "bg-slate-300",  text: "text-slate-500",  bg: "bg-slate-50" },
};

const RAG_CONFIG = {
  green: { label: "Strong",   color: "#16a34a", bg: "#f0fdf4", icon: "✓" },
  amber: { label: "Moderate", color: "#d97706", bg: "#fffbeb", icon: "⚠" },
  red:   { label: "At Risk",  color: "#dc2626", bg: "#fef2f2", icon: "✕" },
};

export default function Assessments() {
  const { orgId } = useOrg();
  const qc = useQueryClient();
  const [, navigate] = useLocation();
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({
    clientName: "",
    clientEmail: "",
    clientCompany: "",
    clientIndustry: "",
    clientSize: "",
    frameworkTarget: "zero-trust",
    deliveryModel: "guided",
    consultantName: "",
    dueDate: "",
    notes: "",
  });

  const { data: templatesData } = useQuery<{ templates: any[] }>({
    queryKey: ["assessment-templates"],
    queryFn: () => apiFetch(`/orgs/${orgId}/assessments/templates`),
    enabled: !!orgId,
  });

  const { data } = useQuery<{ assessments: any[] }>({
    queryKey: ["assessments", orgId],
    queryFn: () => apiFetch(`/orgs/${orgId}/assessments`),
    enabled: !!orgId,
  });

  const createMutation = useMutation({
    mutationFn: (body: typeof form) => apiFetch(`/orgs/${orgId}/assessments`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ["assessments"] });
      setShowNew(false);
      setForm({ clientName: "", clientEmail: "", clientCompany: "", clientIndustry: "", clientSize: "", frameworkTarget: "zero-trust", deliveryModel: "guided", consultantName: "", dueDate: "", notes: "" });
      navigate(`/assessments/${d.assessment.id}/report`);
    },
  });

  const scoreMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/orgs/${orgId}/assessments/${id}/score`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["assessments"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/orgs/${orgId}/assessments/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["assessments"] }),
  });

  const assessments = data?.assessments ?? [];
  const templates = templatesData?.templates ?? [];
  const selectedTemplate = templates.find((t) => t.key === form.frameworkTarget);

  return (
    <div className="p-6 max-w-screen-xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Client Assessments</h1>
          <p className="text-sm text-slate-500 mt-0.5">Zero Trust + Compliance assessment engagements — generate branded PDF reports for clients</p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          New Assessment
        </button>
      </div>

      {/* Template cards */}
      {assessments.length === 0 && (
        <div className="space-y-5 mb-8">
          <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
            <div className="h-14 w-14 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="h-7 w-7 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <p className="text-slate-700 font-semibold text-base mb-1">No assessments yet</p>
            <p className="text-slate-400 text-sm mb-5 max-w-md mx-auto">Run a Zero Trust Posture Assessment, NIST 800-171, CMMC Level 2, or SOC 2 readiness assessment for a client. Questions are pre-filled from your compliance data.</p>
            <button onClick={() => setShowNew(true)} className="px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700">Start your first assessment</button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(FRAMEWORK_LABELS).slice(0, 4).map(([key, fw]) => (
              <div key={key} className="bg-white border border-slate-200 rounded-xl p-4 cursor-pointer hover:border-blue-300 hover:shadow-sm transition-all" onClick={() => { setForm(f => ({ ...f, frameworkTarget: key })); setShowNew(true); }}>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold mb-3" style={{ color: fw.color, background: fw.bg }}>
                  {fw.label}
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {key === "zero-trust" && "56-question posture assessment across 8 ZT domains. Ideal for enterprise prospects and DoD suppliers."}
                  {key === "nist-800-171" && "14-question intake covering all 14 NIST 800-171 control families. Required for DoD contract eligibility."}
                  {key === "cmmc-l2" && "15-question CMMC Level 2 readiness check for organizations handling CUI under DoD contracts."}
                  {key === "soc2" && "15-question SOC 2 Type II readiness assessment covering Trust Services Criteria CC1–CC9 + A1."}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Assessment list */}
      {assessments.length > 0 && (
        <div className="space-y-3">
          {assessments.map((a) => {
            const fw = FRAMEWORK_LABELS[a.frameworkTarget] ?? { label: a.frameworkTarget, color: "#64748b", bg: "#f1f5f9" };
            const status = STATUS_STYLES[a.status] ?? STATUS_STYLES.draft;
            const rag = a.ragStatus ? RAG_CONFIG[a.ragStatus as keyof typeof RAG_CONFIG] : null;
            return (
              <div key={a.id} className="bg-white border border-slate-200 rounded-xl p-5 hover:border-slate-300 hover:shadow-sm transition-all group">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => navigate(`/assessments/${a.id}/report`)}>
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold" style={{ color: fw.color, background: fw.bg }}>
                        {fw.label}
                      </span>
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${status.bg} ${status.text}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
                        {status.label}
                      </span>
                      {rag && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold" style={{ color: rag.color, background: rag.bg }}>
                          {rag.icon} {rag.label} — {a.overallScore ? `${Math.round(a.overallScore)}%` : "Pending"}
                        </span>
                      )}
                    </div>
                    <p className="font-semibold text-slate-900">{a.clientName}</p>
                    {a.clientCompany && <p className="text-sm text-slate-500">{a.clientCompany}</p>}
                    {a.executiveSummary && <p className="text-xs text-slate-400 mt-1 line-clamp-2">{a.executiveSummary}</p>}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {a.status !== "complete" && !a.overallScore && (
                      <button
                        onClick={() => scoreMutation.mutate(a.id)}
                        disabled={scoreMutation.isPending}
                        className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                      >
                        Score
                      </button>
                    )}
                    <button
                      onClick={() => navigate(`/assessments/${a.id}/report`)}
                      className="px-3 py-1.5 text-xs font-medium border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50"
                    >
                      View Report
                    </button>
                    <button
                      onClick={() => deleteMutation.mutate(a.id)}
                      disabled={deleteMutation.isPending}
                      className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                </div>
                {a.domainScores && Object.keys(a.domainScores).length > 0 && (
                  <div className="mt-4 grid grid-cols-4 gap-2">
                    {Object.entries(a.domainScores as Record<string, number>).slice(0, 8).map(([domain, score]) => (
                      <div key={domain} className="bg-slate-50 rounded-lg p-2.5">
                        <p className="text-xs text-slate-400 capitalize mb-1">{domain}</p>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{ width: `${score}%`, background: score >= 70 ? "#16a34a" : score >= 45 ? "#d97706" : "#dc2626" }}
                            />
                          </div>
                          <span className="text-xs font-semibold text-slate-700 flex-shrink-0">{score}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* New Assessment Modal */}
      {showNew && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-100">
              <h2 className="font-bold text-slate-900 text-lg">New Client Assessment</h2>
              <p className="text-sm text-slate-500 mt-1">Questions will be pre-filled from your compliance data. Review and edit all answers before generating the report.</p>
            </div>
            <div className="p-6 space-y-4">
              {/* Framework Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wide">Assessment Framework *</label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(FRAMEWORK_LABELS).slice(0, 4).map(([key, fw]) => (
                    <button
                      key={key}
                      onClick={() => setForm(f => ({ ...f, frameworkTarget: key }))}
                      className={`text-left p-3 rounded-xl border-2 transition-all ${form.frameworkTarget === key ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:border-slate-300"}`}
                    >
                      <div className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold mb-1" style={{ color: fw.color, background: fw.bg }}>
                        {fw.label}
                      </div>
                      <p className="text-xs text-slate-500">{selectedTemplate?.questionCount ?? "—"} questions</p>
                    </button>
                  ))}
                </div>
              </div>

              {selectedTemplate && (
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700">
                  <strong>{selectedTemplate.label}</strong> — {selectedTemplate.description}
                </div>
              )}

              {/* Client Info */}
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-600 mb-1">Client / Contact Name *</label>
                  <input value={form.clientName} onChange={(e) => setForm(f => ({ ...f, clientName: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Jane Smith" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Company</label>
                  <input value={form.clientCompany} onChange={(e) => setForm(f => ({ ...f, clientCompany: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Acme Defense LLC" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
                  <input value={form.clientEmail} onChange={(e) => setForm(f => ({ ...f, clientEmail: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="jane@acme.com" type="email" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Industry</label>
                  <select value={form.clientIndustry} onChange={(e) => setForm(f => ({ ...f, clientIndustry: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none bg-white">
                    <option value="">Select...</option>
                    <option>Defense / Government</option>
                    <option>Federal Contractor</option>
                    <option>Technology / SaaS</option>
                    <option>Healthcare</option>
                    <option>Finance / Fintech</option>
                    <option>Manufacturing</option>
                    <option>Professional Services</option>
                    <option>Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Company Size</label>
                  <select value={form.clientSize} onChange={(e) => setForm(f => ({ ...f, clientSize: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none bg-white">
                    <option value="">Select...</option>
                    <option>1–50 employees</option>
                    <option>51–200 employees</option>
                    <option>201–1,000 employees</option>
                    <option>1,000+ employees</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Delivery Model</label>
                  <select value={form.deliveryModel} onChange={(e) => setForm(f => ({ ...f, deliveryModel: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none bg-white">
                    <option value="self-service">Self-Service (client fills independently)</option>
                    <option value="guided">Guided (consultant-led, 2–3 sessions)</option>
                    <option value="managed">Managed (full evidence collection + interviews)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Due Date</label>
                  <input type="date" value={form.dueDate} onChange={(e) => setForm(f => ({ ...f, dueDate: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-600 mb-1">Internal Notes</label>
                  <textarea value={form.notes} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none resize-none" placeholder="Engagement context, scope limitations, special requirements..." />
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-500 flex items-start gap-2">
                <svg className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                <span>Questions will be <strong>auto-filled</strong> using keyword matching against your live compliance controls and evidence. You review and edit all answers before generating the final PDF report.</span>
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 flex gap-3 justify-end">
              <button onClick={() => setShowNew(false)} className="px-4 py-2 text-sm border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50">Cancel</button>
              <button
                onClick={() => createMutation.mutate(form)}
                disabled={!form.clientName || createMutation.isPending}
                className="px-5 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {createMutation.isPending ? (
                  <><span className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Creating...</>
                ) : (
                  <>Create & Pre-fill Questions</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/queryClient";
import { useOrg } from "@/hooks/useOrg";

const LIKELIHOOD_LABELS = ["", "Rare", "Unlikely", "Possible", "Likely", "Almost Certain"];
const IMPACT_LABELS = ["", "Negligible", "Minor", "Moderate", "Major", "Critical"];
const RISK_COLORS: Record<string, string> = {
  critical: "bg-red-100 text-red-700 border-red-200",
  high: "bg-orange-100 text-orange-700 border-orange-200",
  medium: "bg-yellow-100 text-yellow-700 border-yellow-200",
  low: "bg-green-100 text-green-700 border-green-200",
};

function riskLevel(score: number) {
  if (score >= 15) return "critical";
  if (score >= 9) return "high";
  if (score >= 4) return "medium";
  return "low";
}

function RiskMatrix({ risks }: { risks: any[] }) {
  const cells: Record<string, number> = {};
  risks.forEach((r) => {
    const key = `${r.likelihood}-${r.impact}`;
    cells[key] = (cells[key] ?? 0) + 1;
  });
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4">
      <p className="text-sm font-semibold text-slate-700 mb-3">Risk Heat Map</p>
      <div className="flex gap-1 items-end">
        <div className="flex flex-col gap-1 mr-1">
          {[5, 4, 3, 2, 1].map((l) => (
            <div key={l} className="h-10 w-16 flex items-center justify-end pr-2 text-xs text-slate-400">{LIKELIHOOD_LABELS[l]}</div>
          ))}
          <div className="h-6" />
        </div>
        <div>
          <div className="flex flex-col gap-1">
            {[5, 4, 3, 2, 1].map((l) => (
              <div key={l} className="flex gap-1">
                {[1, 2, 3, 4, 5].map((i) => {
                  const score = l * i;
                  const count = cells[`${l}-${i}`] ?? 0;
                  const level = riskLevel(score);
                  return (
                    <div key={i} className={`h-10 w-10 rounded flex items-center justify-center text-sm font-bold border ${
                      level === "critical" ? "bg-red-100 border-red-300 text-red-700" :
                      level === "high" ? "bg-orange-100 border-orange-300 text-orange-700" :
                      level === "medium" ? "bg-yellow-100 border-yellow-300 text-yellow-600" :
                      "bg-green-50 border-green-200 text-green-700"
                    }`}>
                      {count > 0 ? count : ""}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="flex gap-1 mt-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-6 w-10 flex items-center justify-center text-xs text-slate-400">{IMPACT_LABELS[i]?.slice(0, 3)}</div>
            ))}
          </div>
          <div className="text-xs text-slate-400 text-center mt-1">Impact</div>
        </div>
      </div>
    </div>
  );
}

const BLANK_FORM = {
  title: "", description: "", category: "operational", asset: "",
  threat: "", likelihood: 3, impact: 3, treatment: "mitigate",
  treatmentPlan: "", ownerName: "", ownerEmail: "", dueDate: "", ucoControlId: "",
};

export default function RiskRegister() {
  const { orgId } = useOrg();
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [form, setForm] = useState({ ...BLANK_FORM });
  const [showSuggest, setShowSuggest] = useState(false);
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<string>>(new Set());

  const { data, isLoading } = useQuery<{ risks: any[]; summary: any }>({
    queryKey: ["risks", orgId],
    queryFn: () => apiFetch(`/orgs/${orgId}/risks`),
    enabled: !!orgId,
  });

  const createMutation = useMutation({
    mutationFn: (body: typeof form) => apiFetch(`/orgs/${orgId}/risks`, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["risks"] }); setShowAdd(false); setForm({ ...BLANK_FORM }); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...body }: any) => apiFetch(`/orgs/${orgId}/risks/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["risks"] }); setEditing(null); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/orgs/${orgId}/risks/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["risks"] }),
  });

  const { data: suggestData, isLoading: suggestLoading, refetch: fetchSuggestions } = useQuery<{ suggestions: any[] }>({
    queryKey: ["risk-suggestions", orgId],
    queryFn: () => apiFetch(`/orgs/${orgId}/risks/suggestions`),
    enabled: false,
  });

  const importMutation = useMutation({
    mutationFn: (controlIds: string[]) => apiFetch(`/orgs/${orgId}/risks/import-suggestions`, { method: "POST", body: JSON.stringify({ controlIds }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["risks"] }); setShowSuggest(false); setSelectedSuggestions(new Set()); },
  });

  useEffect(() => {
    if (showSuggest) fetchSuggestions();
  }, [showSuggest]);

  const suggestions = suggestData?.suggestions ?? [];

  const risks = data?.risks ?? [];
  const summary = data?.summary ?? {};
  const filtered = filter === "all" ? risks : risks.filter((r) => r.status === filter || riskLevel(r.inherentScore) === filter);
  const inherentScore = form.likelihood * form.impact;

  const openEdit = (risk: any) => {
    setEditing(risk);
    setForm({
      title: risk.title ?? "",
      description: risk.description ?? "",
      category: risk.category ?? "operational",
      asset: risk.asset ?? "",
      threat: risk.threat ?? "",
      likelihood: risk.likelihood ?? 3,
      impact: risk.impact ?? 3,
      treatment: risk.treatment ?? "mitigate",
      treatmentPlan: risk.treatmentPlan ?? "",
      ownerName: risk.ownerName ?? "",
      ownerEmail: risk.ownerEmail ?? "",
      dueDate: risk.dueDate ? new Date(risk.dueDate).toISOString().slice(0, 10) : "",
      ucoControlId: risk.ucoControlId ?? "",
    });
  };

  const showModal = showAdd || !!editing;
  const closeModal = () => { setShowAdd(false); setEditing(null); setForm({ ...BLANK_FORM }); };

  return (
    <div className="p-6 max-w-screen-xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Risk Register</h1>
          <p className="text-sm text-slate-500 mt-0.5">Identify, assess, and track organizational risks</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSuggest(true)}
            className="flex items-center gap-2 px-3.5 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-colors"
          >
            <svg className="h-4 w-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            Suggest from controls
          </button>
          <button onClick={() => { setForm({ ...BLANK_FORM }); setShowAdd(true); }} className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors">
            + Add Risk
          </button>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-4 mb-6">
        {[
          { label: "Total Risks", value: summary.total ?? 0, color: "text-slate-700" },
          { label: "Critical", value: summary.critical ?? 0, color: "text-red-600" },
          { label: "High", value: summary.high ?? 0, color: "text-orange-600" },
          { label: "Medium", value: summary.medium ?? 0, color: "text-yellow-600" },
          { label: "Open", value: summary.open ?? 0, color: "text-blue-600" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white border border-slate-200 rounded-lg p-4">
            <p className="text-xs text-slate-500 font-medium">{label}</p>
            <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-6 mb-6">
        <div className="col-span-2">
          <div className="flex gap-2 mb-4">
            {["all", "open", "mitigated", "critical", "high"].map((f) => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors capitalize ${filter === f ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"}`}>
                {f === "all" ? "All Risks" : f}
              </button>
            ))}
          </div>
          {isLoading ? (
            <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-16 bg-slate-100 rounded-lg animate-pulse" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-lg p-12 text-center">
              <p className="text-slate-400 text-sm">No risks found. Add your first risk to get started.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((risk) => {
                const level = riskLevel(risk.inherentScore);
                return (
                  <div key={risk.id} className="bg-white border border-slate-200 rounded-lg p-4 hover:border-slate-300 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${RISK_COLORS[level]}`}>
                            {level.toUpperCase()}
                          </span>
                          <span className="text-xs text-slate-400 capitalize">{risk.category}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${risk.status === "open" ? "bg-blue-50 text-blue-600" : risk.status === "mitigated" ? "bg-green-50 text-green-600" : "bg-slate-100 text-slate-500"}`}>
                            {risk.status}
                          </span>
                        </div>
                        <p className="text-sm font-medium text-slate-800">{risk.title}</p>
                        {risk.description && <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{risk.description}</p>}
                        <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                          <span>Likelihood: {LIKELIHOOD_LABELS[risk.likelihood]}</span>
                          <span>Impact: {IMPACT_LABELS[risk.impact]}</span>
                          <span>Score: {risk.inherentScore}</span>
                          {risk.ownerName && <span>Owner: {risk.ownerName}</span>}
                          {risk.ucoControlId && <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">{risk.ucoControlId}</span>}
                        </div>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <button onClick={() => openEdit(risk)}
                          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors">
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </button>
                        {risk.status === "open" && (
                          <button onClick={() => updateMutation.mutate({ id: risk.id, status: "mitigated" })}
                            className="text-xs px-2 py-1 bg-green-50 text-green-700 rounded border border-green-200 hover:bg-green-100">
                            Mitigate
                          </button>
                        )}
                        <button onClick={() => deleteMutation.mutate(risk.id)}
                          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors">
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <RiskMatrix risks={risks} />
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">{editing ? "Edit Risk" : "Add Risk"}</h2>
              <button onClick={closeModal} className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Title *</label>
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Risk title" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Category</label>
                  <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {["operational", "technical", "legal", "financial", "reputational", "compliance"].map((c) => (
                      <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Treatment</label>
                  <select value={form.treatment} onChange={(e) => setForm({ ...form, treatment: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {["mitigate", "accept", "transfer", "avoid"].map((t) => (
                      <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Likelihood (1-5): {LIKELIHOOD_LABELS[form.likelihood]}</label>
                  <input type="range" min={1} max={5} value={form.likelihood} onChange={(e) => setForm({ ...form, likelihood: Number(e.target.value) })} className="w-full" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Impact (1-5): {IMPACT_LABELS[form.impact]}</label>
                  <input type="range" min={1} max={5} value={form.impact} onChange={(e) => setForm({ ...form, impact: Number(e.target.value) })} className="w-full" />
                </div>
              </div>
              <div className={`p-3 rounded-lg text-center border ${RISK_COLORS[riskLevel(inherentScore)]}`}>
                <p className="text-sm font-bold">Inherent Risk Score: {inherentScore} ({riskLevel(inherentScore).toUpperCase()})</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Owner Name</label>
                  <input value={form.ownerName} onChange={(e) => setForm({ ...form, ownerName: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none" placeholder="Owner" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Due Date</label>
                  <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Related UCO Control</label>
                  <input value={form.ucoControlId} onChange={(e) => setForm({ ...form, ucoControlId: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none font-mono" placeholder="UCO-AC-001" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Asset</label>
                  <input value={form.asset} onChange={(e) => setForm({ ...form, asset: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none" placeholder="e.g. Customer DB" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Treatment Plan</label>
                <textarea value={form.treatmentPlan} onChange={(e) => setForm({ ...form, treatmentPlan: e.target.value })}
                  rows={2} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none" placeholder="Describe mitigation steps..." />
              </div>
            </div>
            <div className="p-5 border-t border-slate-100 flex gap-3 justify-end">
              <button onClick={closeModal} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
              <button
                onClick={() => editing ? updateMutation.mutate({ id: editing.id, ...form }) : createMutation.mutate(form)}
                disabled={!form.title || (editing ? updateMutation.isPending : createMutation.isPending)}
                className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {(editing ? updateMutation.isPending : createMutation.isPending) ? "Saving..." : editing ? "Save Changes" : "Add Risk"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Auto-suggest from failing controls modal */}
      {showSuggest && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Risk Suggestions from Failing Controls</h2>
                <p className="text-xs text-slate-500 mt-0.5">Select risks to automatically create based on your currently failing controls</p>
              </div>
              <button onClick={() => { setShowSuggest(false); setSelectedSuggestions(new Set()); }}
                className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              {suggestLoading ? (
                <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-16 bg-slate-100 rounded-lg animate-pulse" />)}</div>
              ) : suggestions.length === 0 ? (
                <div className="text-center py-10">
                  <svg className="h-10 w-10 text-green-400 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm font-medium text-slate-700">No new suggestions</p>
                  <p className="text-xs text-slate-500 mt-1">Either no controls are currently failing, or all suggested risks have already been created.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs text-slate-500">{suggestions.length} suggestion{suggestions.length !== 1 ? "s" : ""} based on failing controls</p>
                    <button
                      onClick={() => {
                        if (selectedSuggestions.size === suggestions.length) {
                          setSelectedSuggestions(new Set());
                        } else {
                          setSelectedSuggestions(new Set(suggestions.map((s: any) => s.relatedControlId)));
                        }
                      }}
                      className="text-xs font-medium text-blue-600 hover:text-blue-700"
                    >
                      {selectedSuggestions.size === suggestions.length ? "Deselect all" : "Select all"}
                    </button>
                  </div>
                  {suggestions.map((s: any) => {
                    const level = riskLevel(s.inherentScore);
                    const isSelected = selectedSuggestions.has(s.relatedControlId);
                    return (
                      <div
                        key={s.relatedControlId}
                        onClick={() => {
                          const next = new Set(selectedSuggestions);
                          if (isSelected) next.delete(s.relatedControlId); else next.add(s.relatedControlId);
                          setSelectedSuggestions(next);
                        }}
                        className={`p-4 rounded-lg border cursor-pointer transition-all ${isSelected ? "border-blue-400 bg-blue-50" : "border-slate-200 bg-white hover:border-slate-300"}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`mt-0.5 h-4 w-4 rounded border flex-shrink-0 flex items-center justify-center ${isSelected ? "bg-blue-600 border-blue-600" : "border-slate-300"}`}>
                            {isSelected && <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${RISK_COLORS[level]}`}>
                                {level.toUpperCase()}
                              </span>
                              <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">{s.relatedControlId}</span>
                              <span className="text-xs text-slate-400 capitalize">{s.category}</span>
                            </div>
                            <p className="text-sm font-medium text-slate-800">{s.title}</p>
                            <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{s.description}</p>
                            <p className="text-xs text-slate-400 mt-1">Failing control: {s.controlName}</p>
                          </div>
                          <div className="text-right flex-shrink-0 text-xs text-slate-500">
                            <div className="font-bold text-slate-700 text-sm">{s.inherentScore}</div>
                            <div>score</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            {suggestions.length > 0 && (
              <div className="p-5 border-t border-slate-100 flex items-center justify-between flex-shrink-0">
                <p className="text-xs text-slate-500">{selectedSuggestions.size} selected</p>
                <div className="flex gap-3">
                  <button onClick={() => { setShowSuggest(false); setSelectedSuggestions(new Set()); }}
                    className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
                    Cancel
                  </button>
                  <button
                    onClick={() => importMutation.mutate(Array.from(selectedSuggestions))}
                    disabled={selectedSuggestions.size === 0 || importMutation.isPending}
                    className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                    {importMutation.isPending ? "Creating..." : `Create ${selectedSuggestions.size} risk${selectedSuggestions.size !== 1 ? "s" : ""}`}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch, apiUrl } from "@/lib/queryClient";
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

export default function RiskRegister() {
  const { orgId } = useOrg();
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const [form, setForm] = useState({
    title: "", description: "", category: "operational", asset: "",
    threat: "", likelihood: 3, impact: 3, treatment: "mitigate",
    treatmentPlan: "", ownerName: "", ownerEmail: "", dueDate: "",
  });

  const { data, isLoading } = useQuery<{ risks: any[]; summary: any }>({
    queryKey: ["risks", orgId],
    queryFn: () => apiFetch(`/orgs/${orgId}/risks`),
    enabled: !!orgId,
  });

  const createMutation = useMutation({
    mutationFn: (body: typeof form) => apiFetch(`/orgs/${orgId}/risks`, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["risks"] }); setShowAdd(false); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...body }: any) => apiFetch(`/orgs/${orgId}/risks/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["risks"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/orgs/${orgId}/risks/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["risks"] }),
  });

  const risks = data?.risks ?? [];
  const summary = data?.summary ?? {};
  const filtered = filter === "all" ? risks : risks.filter((r) => r.status === filter || riskLevel(r.inherentScore) === filter);
  const inherentScore = form.likelihood * form.impact;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Risk Register</h1>
          <p className="text-sm text-slate-500 mt-0.5">Identify, assess, and track organizational risks</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
          + Add Risk
        </button>
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
                        </div>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        {risk.status === "open" && (
                          <button onClick={() => updateMutation.mutate({ id: risk.id, status: "mitigated" })}
                            className="text-xs px-2 py-1 bg-green-50 text-green-700 rounded border border-green-200 hover:bg-green-100">
                            Mitigate
                          </button>
                        )}
                        <button onClick={() => deleteMutation.mutate(risk.id)}
                          className="text-xs px-2 py-1 text-slate-400 hover:text-red-500 transition-colors">
                          Remove
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

      {showAdd && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-900">Add Risk</h2>
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
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Treatment Plan</label>
                <textarea value={form.treatmentPlan} onChange={(e) => setForm({ ...form, treatmentPlan: e.target.value })}
                  rows={2} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none" placeholder="Describe mitigation steps..." />
              </div>
            </div>
            <div className="p-5 border-t border-slate-100 flex gap-3 justify-end">
              <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
              <button onClick={() => createMutation.mutate(form)} disabled={!form.title || createMutation.isPending}
                className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {createMutation.isPending ? "Adding..." : "Add Risk"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

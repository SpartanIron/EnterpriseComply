import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/queryClient";
import { useOrg } from "@/hooks/useOrg";

export default function AccessReviews() {
  const { orgId } = useOrg();
  const qc = useQueryClient();
  const [showNew, setShowNew] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [form, setForm] = useState({ name: "", description: "", dueDate: "" });

  const { data } = useQuery<{ reviews: any[] }>({
    queryKey: ["access-reviews", orgId],
    queryFn: () => apiFetch(`/orgs/${orgId}/access-reviews`),
    enabled: !!orgId,
  });

  const { data: itemsData } = useQuery<{ items: any[] }>({
    queryKey: ["access-review-items", orgId, selected?.id],
    queryFn: () => apiFetch(`/orgs/${orgId}/access-reviews/${selected.id}/items`),
    enabled: !!orgId && !!selected,
  });

  const createMutation = useMutation({
    mutationFn: (body: typeof form) => apiFetch(`/orgs/${orgId}/access-reviews`, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ["access-reviews"] });
      setShowNew(false);
      setSelected(d.review);
    },
  });

  const decisionMutation = useMutation({
    mutationFn: ({ itemId, decision }: { itemId: number; decision: "approved" | "revoked" }) =>
      apiFetch(`/orgs/${orgId}/access-reviews/${selected.id}/items/${itemId}`, {
        method: "PATCH",
        body: JSON.stringify({ decision, reviewerName: "Current User", reviewerEmail: "" }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["access-review-items"] });
      qc.invalidateQueries({ queryKey: ["access-reviews"] });
    },
  });

  const completeMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/orgs/${orgId}/access-reviews/${id}/complete`, { method: "PATCH" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["access-reviews"] }); setSelected(null); },
  });

  const reviews = data?.reviews ?? [];
  const items = itemsData?.items ?? [];
  const pendingItems = items.filter((i) => !i.decision);
  const approvedItems = items.filter((i) => i.decision === "approved");
  const revokedItems = items.filter((i) => i.decision === "revoked");

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Access Reviews</h1>
          <p className="text-sm text-slate-500 mt-0.5">SOC 2 CC6.2 / ISO 27001 A.9 - Periodic user access attestation</p>
        </div>
        <button onClick={() => setShowNew(true)} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
          + New Review Campaign
        </button>
      </div>

      {!selected ? (
        reviews.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-16 text-center">
            <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center mx-auto mb-3">
              <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
            </div>
            <p className="text-slate-600 font-medium">No access reviews yet</p>
            <p className="text-sm text-slate-400 mt-1">Create a review campaign to attest user access across your organization.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {reviews.map((r) => {
              const pct = r.totalPeople > 0 ? Math.round(((r.approvedCount + r.revokedCount) / r.totalPeople) * 100) : 0;
              return (
                <div key={r.id} className="bg-white border border-slate-200 rounded-xl p-5 hover:border-blue-300 cursor-pointer" onClick={() => setSelected(r)}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${r.status === "completed" ? "bg-green-50 text-green-700" : "bg-blue-50 text-blue-600"}`}>{r.status === "completed" ? "Completed" : "In Progress"}</span>
                        {r.dueDate && <span className="text-xs text-slate-400">Due {new Date(r.dueDate).toLocaleDateString()}</span>}
                      </div>
                      <h3 className="font-medium text-slate-800">{r.name}</h3>
                      {r.description && <p className="text-xs text-slate-500 mt-0.5">{r.description}</p>}
                      <div className="mt-3">
                        <div className="flex justify-between text-xs text-slate-500 mb-1">
                          <span>Review progress</span><span>{pct}%</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2">
                          <div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    </div>
                    <div className="ml-6 flex gap-4 text-center text-sm">
                      <div><p className="text-lg font-bold text-green-600">{r.approvedCount}</p><p className="text-xs text-slate-400">Approved</p></div>
                      <div><p className="text-lg font-bold text-red-500">{r.revokedCount}</p><p className="text-xs text-slate-400">Revoked</p></div>
                      <div><p className="text-lg font-bold text-slate-400">{r.pendingCount}</p><p className="text-xs text-slate-400">Pending</p></div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        <div>
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <button onClick={() => setSelected(null)} className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg> Back
              </button>
              <h2 className="text-lg font-semibold text-slate-900">{selected.name}</h2>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${selected.status === "completed" ? "bg-green-50 text-green-700" : "bg-blue-50 text-blue-600"}`}>{selected.status}</span>
            </div>
            <div className="flex gap-2">
              {pendingItems.length > 0 && (
                <button onClick={() => completeMutation.mutate(selected.id)} className="px-3 py-1.5 text-sm border border-green-200 text-green-700 rounded-lg hover:bg-green-50">
                  Complete Review
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-5">
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-green-600">{approvedItems.length}</p>
              <p className="text-xs text-green-600 font-medium">Access Approved</p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-red-600">{revokedItems.length}</p>
              <p className="text-xs text-red-600 font-medium">Access Revoked</p>
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-orange-600">{pendingItems.length}</p>
              <p className="text-xs text-orange-600 font-medium">Pending Review</p>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Employee</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Title / Dept</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Systems</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">{item.personName || item.personEmail}</p>
                      <p className="text-xs text-slate-400">{item.personEmail}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">
                      <p>{item.personTitle ?? "-"}</p>
                      <p>{item.personDepartment ?? "-"}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(item.systems ?? []).map((s: string) => (
                          <span key={s} className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">{s}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {item.decision ? (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${item.decision === "approved" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
                          {item.decision === "approved" ? "Approved" : "Revoked"}
                        </span>
                      ) : (
                        <span className="text-xs bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full">Pending</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {!item.decision && (
                        <div className="flex gap-2 justify-center">
                          <button onClick={() => decisionMutation.mutate({ itemId: item.id, decision: "approved" })}
                            className="text-xs px-2.5 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700">Approve</button>
                          <button onClick={() => decisionMutation.mutate({ itemId: item.id, decision: "revoked" })}
                            className="text-xs px-2.5 py-1 bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100">Revoke</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showNew && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-5 border-b border-slate-100"><h2 className="font-semibold text-slate-900">New Access Review Campaign</h2></div>
            <div className="p-5 space-y-3">
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Campaign Name *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. Q1 2025 Quarterly Access Review" /></div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none" /></div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Due Date</label>
                <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none" /></div>
              <p className="text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded-lg p-2">All active employees will be added to this review campaign automatically.</p>
            </div>
            <div className="p-5 border-t border-slate-100 flex gap-3 justify-end">
              <button onClick={() => setShowNew(false)} className="px-4 py-2 text-sm border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50">Cancel</button>
              <button onClick={() => createMutation.mutate(form)} disabled={!form.name || createMutation.isPending}
                className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {createMutation.isPending ? "Creating..." : "Launch Campaign"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

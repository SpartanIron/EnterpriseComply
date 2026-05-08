import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/queryClient";
import { useOrg } from "@/hooks/useOrg";

export default function CustomFrameworks() {
  const { orgId } = useOrg();
  const qc = useQueryClient();
  const [showNew, setShowNew] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [showControl, setShowControl] = useState(false);
  const [fwForm, setFwForm] = useState({ name: "", shortName: "", description: "", category: "custom" });
  const [ctrlForm, setCtrlForm] = useState({ controlId: "", title: "", description: "", domain: "General", guidance: "", ownerName: "" });

  const { data } = useQuery<{ frameworks: any[] }>({
    queryKey: ["custom-frameworks", orgId],
    queryFn: () => apiFetch(`/orgs/${orgId}/custom-frameworks`),
    enabled: !!orgId,
  });

  const { data: controlsData } = useQuery<{ controls: any[] }>({
    queryKey: ["custom-controls", orgId, selected?.id],
    queryFn: () => apiFetch(`/orgs/${orgId}/custom-frameworks/${selected.id}/controls`),
    enabled: !!orgId && !!selected,
  });

  const createFwMutation = useMutation({
    mutationFn: (body: typeof fwForm) => apiFetch(`/orgs/${orgId}/custom-frameworks`, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["custom-frameworks"] }); setShowNew(false); setFwForm({ name: "", shortName: "", description: "", category: "custom" }); },
  });

  const deleteFwMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/orgs/${orgId}/custom-frameworks/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["custom-frameworks"] }); setSelected(null); },
  });

  const createCtrlMutation = useMutation({
    mutationFn: (body: typeof ctrlForm) => apiFetch(`/orgs/${orgId}/custom-frameworks/${selected.id}/controls`, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["custom-controls"] }); setShowControl(false); setCtrlForm({ controlId: "", title: "", description: "", domain: "General", guidance: "", ownerName: "" }); },
  });

  const updateCtrlMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      apiFetch(`/orgs/${orgId}/custom-frameworks/controls/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["custom-controls"] }),
  });

  const deleteCtrlMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/orgs/${orgId}/custom-frameworks/controls/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["custom-controls"] }),
  });

  const frameworks = data?.frameworks ?? [];
  const controls = controlsData?.controls ?? [];

  return (
    <div className="p-6 max-w-screen-xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Custom Frameworks</h1>
          <p className="text-sm text-slate-500 mt-0.5">Build internal control frameworks, HITRUST overlays, or custom compliance programs</p>
        </div>
        <button onClick={() => setShowNew(true)} className="px-4 py-2 bg-green-800 text-white text-sm font-semibold rounded-lg hover:bg-green-900">
          + New Framework
        </button>
      </div>

      {!selected ? (
        frameworks.length === 0 ? (
          <div className="space-y-4">
            <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
              <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center mx-auto mb-3">
                <svg className="h-6 w-6 text-green-800" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
              </div>
              <p className="text-slate-700 font-semibold">No custom frameworks yet</p>
              <p className="text-sm text-slate-400 mt-1 mb-5">Build your own control framework for internal programs, overlays, or emerging regulations.</p>
              <button onClick={() => setShowNew(true)} className="px-4 py-2 bg-green-800 text-white text-sm font-semibold rounded-lg hover:bg-green-900">Create first framework</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { tag: "Internal Policy", title: "Internal Security Program", body: "Define your own security controls beyond what standard frameworks require." },
                { tag: "Overlay", title: "HITRUST / NERC CIP", body: "Map controls to niche frameworks that overlay on top of NIST, ISO, or SOC 2." },
                { tag: "Contractual", title: "Customer Requirements", body: "Track controls required by specific enterprise customers or contract clauses." },
                { tag: "Regulatory", title: "Emerging Regulations", body: "Stay ahead of new requirements like EU AI Act, DORA, or state-level privacy laws." },
              ].map(({ tag, title, body }) => (
                <div key={title} className="bg-white border border-slate-200 rounded-xl p-4">
                  <span className="inline-block px-2 py-0.5 bg-purple-50 text-purple-700 text-xs font-semibold rounded-md mb-2">{tag}</span>
                  <p className="font-semibold text-slate-800 text-sm mb-1">{title}</p>
                  <p className="text-xs text-slate-500 leading-relaxed">{body}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {frameworks.map((fw) => (
              <div key={fw.id} className="bg-white border border-slate-200 rounded-xl p-5 hover:border-green-300 cursor-pointer transition-colors" onClick={() => setSelected(fw)}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full border border-purple-200">{fw.category}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${fw.active ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-500"}`}>{fw.active ? "Active" : "Inactive"}</span>
                    </div>
                    <h3 className="font-semibold text-slate-800">{fw.name}</h3>
                    <p className="text-sm text-slate-400 mt-0.5">{fw.shortName}</p>
                    {fw.description && <p className="text-xs text-slate-500 mt-1">{fw.description}</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-slate-800">{fw.totalControls}</p>
                    <p className="text-xs text-slate-400">controls</p>
                  </div>
                </div>
              </div>
            ))}
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
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowControl(true)} className="px-3 py-1.5 text-sm bg-green-800 text-white rounded-lg hover:bg-green-900">+ Add Control</button>
              <button onClick={() => deleteFwMutation.mutate(selected.id)} className="px-3 py-1.5 text-sm border border-red-200 text-red-600 rounded-lg hover:bg-red-50">Delete Framework</button>
            </div>
          </div>

          {controls.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
              <p className="text-slate-400 text-sm">No controls yet. Add controls to define your compliance program.</p>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Control ID</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Title</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Domain</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Owner</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {controls.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono text-xs font-medium text-slate-600">{c.controlId}</td>
                      <td className="px-4 py-3 font-medium text-slate-800">{c.title}</td>
                      <td className="px-4 py-3 text-slate-500">{c.domain}</td>
                      <td className="px-4 py-3 text-slate-500">{c.ownerName ?? "-"}</td>
                      <td className="px-4 py-3">
                        <select value={c.status} onChange={(e) => updateCtrlMutation.mutate({ id: c.id, status: e.target.value })}
                          className={`text-xs px-2 py-1 rounded-full border font-medium focus:outline-none ${
                            c.status === "passing" ? "bg-green-50 text-green-700 border-green-200" :
                            c.status === "failing" ? "bg-red-50 text-red-600 border-red-200" :
                            "bg-slate-100 text-slate-500 border-slate-200"
                          }`}>
                          <option value="not_tested">Not Tested</option>
                          <option value="passing">Passing</option>
                          <option value="failing">Failing</option>
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => deleteCtrlMutation.mutate(c.id)} className="text-xs text-slate-400 hover:text-red-500">Remove</button>
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
            <div className="p-5 border-b border-slate-100"><h2 className="font-semibold text-slate-900">New Custom Framework</h2></div>
            <div className="p-5 space-y-3">
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Framework Name *</label>
                <input value={fwForm.name} onChange={(e) => setFwForm({ ...fwForm, name: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-700" placeholder="e.g. Internal Security Policy" /></div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Short Name *</label>
                <input value={fwForm.shortName} onChange={(e) => setFwForm({ ...fwForm, shortName: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none" placeholder="e.g. ISP-2025" /></div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
                <textarea value={fwForm.description} onChange={(e) => setFwForm({ ...fwForm, description: e.target.value })} rows={2} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none" /></div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Category</label>
                <select value={fwForm.category} onChange={(e) => setFwForm({ ...fwForm, category: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
                  {["custom", "internal", "industry", "contractual", "regulatory"].map((c) => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                </select></div>
            </div>
            <div className="p-5 border-t border-slate-100 flex gap-3 justify-end">
              <button onClick={() => setShowNew(false)} className="px-4 py-2 text-sm border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50">Cancel</button>
              <button onClick={() => createFwMutation.mutate(fwForm)} disabled={!fwForm.name || !fwForm.shortName || createFwMutation.isPending}
                className="px-4 py-2 text-sm font-medium bg-green-800 text-white rounded-lg hover:bg-green-900 disabled:opacity-50">
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {showControl && selected && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-5 border-b border-slate-100"><h2 className="font-semibold text-slate-900">Add Control to {selected.shortName}</h2></div>
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-slate-600 mb-1">Control ID *</label>
                  <input value={ctrlForm.controlId} onChange={(e) => setCtrlForm({ ...ctrlForm, controlId: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-700" placeholder="e.g. AC-1.1" /></div>
                <div><label className="block text-xs font-medium text-slate-600 mb-1">Domain</label>
                  <input value={ctrlForm.domain} onChange={(e) => setCtrlForm({ ...ctrlForm, domain: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none" /></div>
              </div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Title *</label>
                <input value={ctrlForm.title} onChange={(e) => setCtrlForm({ ...ctrlForm, title: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-700" /></div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
                <textarea value={ctrlForm.description} onChange={(e) => setCtrlForm({ ...ctrlForm, description: e.target.value })} rows={2} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none" /></div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Owner</label>
                <input value={ctrlForm.ownerName} onChange={(e) => setCtrlForm({ ...ctrlForm, ownerName: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none" /></div>
            </div>
            <div className="p-5 border-t border-slate-100 flex gap-3 justify-end">
              <button onClick={() => setShowControl(false)} className="px-4 py-2 text-sm border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50">Cancel</button>
              <button onClick={() => createCtrlMutation.mutate(ctrlForm)} disabled={!ctrlForm.controlId || !ctrlForm.title || createCtrlMutation.isPending}
                className="px-4 py-2 text-sm font-medium bg-green-800 text-white rounded-lg hover:bg-green-900 disabled:opacity-50">Add Control</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

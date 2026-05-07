import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiUrl } from "@/lib/queryClient";

const SEVERITY_BADGE: Record<string, string> = {
  critical: "bg-red-100 text-red-800",
  high: "bg-orange-100 text-orange-700",
  medium: "bg-amber-100 text-amber-700",
  low: "bg-slate-100 text-slate-600",
};
const STATUS_BADGE: Record<string, string> = {
  open: "bg-red-100 text-red-700",
  in_progress: "bg-blue-100 text-blue-700",
  risk_accepted: "bg-amber-100 text-amber-700",
  resolved: "bg-green-100 text-green-700",
  closed: "bg-slate-100 text-slate-500",
};

export default function POAM() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: "", weakness: "", description: "", severity: "high", frameworkKey: "fedramp", ownerName: "", ownerTeam: "", originalRisk: "high", residualRisk: "medium" });
  const [editStatus, setEditStatus] = useState<{ id: number; status: string } | null>(null);

  const { data: orgData } = useQuery<{ org: any }>({
    queryKey: ["orgs", "me"],
    queryFn: async () => (await fetch(apiUrl("/orgs/me"), { credentials: "include" })).json(),
  });
  const orgId = orgData?.org?.id;

  const { data, isLoading } = useQuery<{ items: any[] }>({
    queryKey: ["org-poam", orgId],
    queryFn: async () => (await fetch(apiUrl(`/orgs/${orgId}/poam`), { credentials: "include" })).json(),
    enabled: !!orgId,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(apiUrl(`/orgs/${orgId}/poam`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["org-poam"] });
      setShowCreate(false);
      setForm({ title: "", weakness: "", description: "", severity: "high", frameworkKey: "fedramp", ownerName: "", ownerTeam: "", originalRisk: "high", residualRisk: "medium" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await fetch(apiUrl(`/orgs/${orgId}/poam/${id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status }),
      });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["org-poam"] });
      setEditStatus(null);
    },
  });

  const items = data?.items ?? [];
  const open = items.filter(i => i.status === "open" || i.status === "in_progress");
  const closed = items.filter(i => i.status === "resolved" || i.status === "closed" || i.status === "risk_accepted");

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Plan of Action & Milestones</h1>
          <p className="text-slate-500 mt-1">FedRAMP-compliant POA&M tracking — {open.length} open items</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          <span className="text-lg leading-none">+</span>
          New Item
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-slate-100 rounded-xl animate-pulse" />)}</div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-16 text-center">
          <p className="text-4xl mb-4">📋</p>
          <p className="font-semibold text-slate-900 mb-2">No POA&M items yet</p>
          <p className="text-slate-500 text-sm mb-5">Create POA&M items to track remediation of security weaknesses.</p>
          <button onClick={() => setShowCreate(true)} className="px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors">Create first item</button>
        </div>
      ) : (
        <div className="space-y-6">
          {open.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Open ({open.length})</h2>
              <div className="space-y-3">
                {open.map((item: any) => <POAMCard key={item.id} item={item} onStatusChange={(id, s) => setEditStatus({ id, status: s })} editStatus={editStatus} onStatusSave={() => updateMutation.mutate({ id: editStatus!.id, status: editStatus!.status })} onStatusCancel={() => setEditStatus(null)} saving={updateMutation.isPending} onStatusSet={s => setEditStatus(prev => prev ? { ...prev, status: s } : null)} />)}
              </div>
            </div>
          )}
          {closed.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Resolved / Closed ({closed.length})</h2>
              <div className="space-y-3 opacity-70">
                {closed.map((item: any) => <POAMCard key={item.id} item={item} onStatusChange={(id, s) => setEditStatus({ id, status: s })} editStatus={editStatus} onStatusSave={() => updateMutation.mutate({ id: editStatus!.id, status: editStatus!.status })} onStatusCancel={() => setEditStatus(null)} saving={updateMutation.isPending} onStatusSet={s => setEditStatus(prev => prev ? { ...prev, status: s } : null)} />)}
              </div>
            </div>
          )}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl my-8">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">New POA&M Item</h2>
              <button onClick={() => setShowCreate(false)} className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400">✕</button>
            </div>
            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              {[
                { label: "Title *", field: "title", type: "text", placeholder: "MFA not enforced for admin accounts" },
                { label: "Weakness *", field: "weakness", type: "text", placeholder: "Authentication weakness" },
                { label: "Description *", field: "description", type: "textarea", placeholder: "Describe the security weakness and its impact..." },
                { label: "Owner Name *", field: "ownerName", type: "text", placeholder: "Jane Smith" },
                { label: "Owner Team *", field: "ownerTeam", type: "text", placeholder: "Security" },
              ].map(f => (
                <div key={f.field}>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">{f.label}</label>
                  {f.type === "textarea" ? (
                    <textarea value={(form as any)[f.field]} onChange={e => setForm({ ...form, [f.field]: e.target.value })} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" rows={3} placeholder={f.placeholder} />
                  ) : (
                    <input type="text" value={(form as any)[f.field]} onChange={e => setForm({ ...form, [f.field]: e.target.value })} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder={f.placeholder} />
                  )}
                </div>
              ))}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Severity", field: "severity", options: ["critical", "high", "medium", "low"] },
                  { label: "Original Risk", field: "originalRisk", options: ["critical", "high", "medium", "low"] },
                  { label: "Residual Risk", field: "residualRisk", options: ["high", "medium", "low", "minimal"] },
                ].map(s => (
                  <div key={s.field}>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">{s.label}</label>
                    <select value={(form as any)[s.field]} onChange={e => setForm({ ...form, [s.field]: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                      {s.options.map(o => <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-6 border-t border-slate-100 flex gap-3">
              <button onClick={() => setShowCreate(false)} className="flex-1 py-2.5 border border-slate-200 text-slate-600 text-sm font-semibold rounded-lg hover:bg-slate-50">Cancel</button>
              <button onClick={() => createMutation.mutate()} disabled={!form.title || !form.weakness || !form.ownerName || createMutation.isPending} className="flex-1 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {createMutation.isPending ? "Creating..." : "Create Item"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function POAMCard({ item, onStatusChange, editStatus, onStatusSave, onStatusCancel, saving, onStatusSet }: any) {
  const isEditing = editStatus?.id === item.id;
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold ${SEVERITY_BADGE[item.severity] ?? SEVERITY_BADGE.low}`}>{item.severity}</span>
            {!isEditing ? (
              <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold cursor-pointer hover:opacity-80 ${STATUS_BADGE[item.status] ?? STATUS_BADGE.open}`} onClick={() => onStatusChange(item.id, item.status)}>
                {item.status.replace("_", " ")} ✏
              </span>
            ) : (
              <div className="flex items-center gap-1.5">
                <select value={editStatus.status} onChange={e => onStatusSet(e.target.value)} className="px-2 py-0.5 border border-slate-300 rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-500">
                  {["open", "in_progress", "risk_accepted", "resolved", "closed"].map(s => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
                </select>
                <button onClick={onStatusSave} disabled={saving} className="px-2 py-0.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:opacity-50">{saving ? "…" : "Save"}</button>
                <button onClick={onStatusCancel} className="px-2 py-0.5 border border-slate-200 text-slate-600 text-xs rounded hover:bg-slate-50">Cancel</button>
              </div>
            )}
            {item.frameworkKey && <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-semibold rounded-md">{item.frameworkKey}</span>}
          </div>
          <p className="font-semibold text-slate-900 text-sm mb-0.5">{item.title}</p>
          <p className="text-xs text-slate-500">{item.weakness}</p>
          {item.description && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{item.description}</p>}
        </div>
        <div className="text-right flex-shrink-0 text-xs text-slate-500">
          <p className="font-medium text-slate-700">{item.ownerName}</p>
          <p>{item.ownerTeam}</p>
          {item.scheduledCompletionDate && (
            <p className="mt-1 text-amber-600 font-medium">Due {new Date(item.scheduledCompletionDate).toLocaleDateString()}</p>
          )}
        </div>
      </div>
    </div>
  );
}

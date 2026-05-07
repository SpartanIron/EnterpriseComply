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
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [importResult, setImportResult] = useState<{ added: number } | null>(null);

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

  const importFromFailingMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(apiUrl(`/orgs/${orgId}/poam/bulk-from-failing`), {
        method: "POST",
        credentials: "include",
      });
      return res.json();
    },
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ["org-poam"] });
      setImportResult({ added: d.added ?? 0 });
      setTimeout(() => setImportResult(null), 4000);
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

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(apiUrl(`/orgs/${orgId}/poam/${id}`), {
        method: "DELETE",
        credentials: "include",
      });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["org-poam"] });
      setConfirmDelete(null);
    },
  });

  const items = data?.items ?? [];
  const open = items.filter(i => i.status === "open" || i.status === "in_progress");
  const closed = items.filter(i => i.status === "resolved" || i.status === "closed" || i.status === "risk_accepted");

  return (
    <div className="p-6 max-w-screen-xl">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900 leading-tight">Plan of Action &amp; Milestones</h1>
          <p className="text-sm text-slate-500 mt-0.5">FedRAMP-compliant POA&amp;M tracking &middot; {open.length} open item{open.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => importFromFailingMutation.mutate()}
            disabled={importFromFailingMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-600 text-sm font-semibold rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            {importFromFailingMutation.isPending ? "Importing..." : "Import from failing controls"}
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            New Item
          </button>
        </div>
      </div>

      {importResult !== null && (
        <div className="mb-5 bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
          <svg className="h-5 w-5 text-green-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <p className="text-sm font-semibold text-green-800">
            {importResult.added === 0 ? "No new failing controls to import - all are already tracked." : `Imported ${importResult.added} new POA&M item${importResult.added !== 1 ? "s" : ""} from failing controls.`}
          </p>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-slate-100 rounded-xl animate-pulse" />)}</div>
      ) : items.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-xl p-12 text-center">
          <div className="h-12 w-12 bg-slate-100 rounded-xl flex items-center justify-center mx-auto mb-3 text-slate-400">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
          </div>
          <p className="font-semibold text-slate-700 text-sm">No POA&amp;M items yet</p>
          <p className="text-slate-400 text-xs mt-1 mb-5">Create POA&amp;M items to track remediation of security weaknesses, or import from failing controls.</p>
          <div className="flex items-center justify-center gap-2">
            <button onClick={() => importFromFailingMutation.mutate()} disabled={importFromFailingMutation.isPending}
              className="px-4 py-2 border border-slate-200 text-slate-600 text-sm font-semibold rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors">
              Import from failing controls
            </button>
            <button onClick={() => setShowCreate(true)} className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors">Create first item</button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {open.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Open ({open.length})</h2>
              <div className="space-y-3">
                {open.map((item: any) => (
                  <POAMCard key={item.id} item={item}
                    onStatusChange={(id: number, s: string) => setEditStatus({ id, status: s })}
                    editStatus={editStatus} onStatusSave={() => updateMutation.mutate({ id: editStatus!.id, status: editStatus!.status })}
                    onStatusCancel={() => setEditStatus(null)} saving={updateMutation.isPending}
                    onStatusSet={(s: string) => setEditStatus(prev => prev ? { ...prev, status: s } : null)}
                    onDelete={() => setConfirmDelete(item.id)}
                  />
                ))}
              </div>
            </div>
          )}
          {closed.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Resolved / Closed ({closed.length})</h2>
              <div className="space-y-3 opacity-70">
                {closed.map((item: any) => (
                  <POAMCard key={item.id} item={item}
                    onStatusChange={(id: number, s: string) => setEditStatus({ id, status: s })}
                    editStatus={editStatus} onStatusSave={() => updateMutation.mutate({ id: editStatus!.id, status: editStatus!.status })}
                    onStatusCancel={() => setEditStatus(null)} saving={updateMutation.isPending}
                    onStatusSet={(s: string) => setEditStatus(prev => prev ? { ...prev, status: s } : null)}
                    onDelete={() => setConfirmDelete(item.id)}
                  />
                ))}
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
              <button onClick={() => setShowCreate(false)} className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto" style={{ maxHeight: "calc(90vh - 160px)" }}>
              {[
                { label: "Title *", field: "title", type: "text", placeholder: "MFA not enforced for admin accounts" },
                { label: "Weakness *", field: "weakness", type: "text", placeholder: "Authentication weakness" },
                { label: "Description", field: "description", type: "textarea", placeholder: "Describe the security weakness and its impact..." },
                { label: "Owner Name *", field: "ownerName", type: "text", placeholder: "Jane Smith" },
                { label: "Owner Team", field: "ownerTeam", type: "text", placeholder: "Security" },
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
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Framework</label>
                  <select value={form.frameworkKey} onChange={e => setForm({ ...form, frameworkKey: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="fedramp">FedRAMP</option>
                    <option value="cmmc-l2">CMMC Level 2</option>
                    <option value="nist-800-53">NIST 800-53</option>
                    <option value="nist-800-171">NIST 800-171</option>
                    <option value="soc2">SOC 2</option>
                    <option value="iso27001">ISO 27001</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Severity</label>
                  <select value={form.severity} onChange={e => setForm({ ...form, severity: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {["critical", "high", "medium", "low"].map(o => <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
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

      {confirmDelete !== null && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="font-bold text-slate-900 mb-2">Delete POA&M item?</h3>
            <p className="text-sm text-slate-500 mb-5">This will permanently remove this item from your POA&M.</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 py-2 border border-slate-200 text-slate-600 text-sm font-semibold rounded-lg hover:bg-slate-50">Cancel</button>
              <button onClick={() => deleteMutation.mutate(confirmDelete!)} disabled={deleteMutation.isPending}
                className="flex-1 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 disabled:opacity-50">
                {deleteMutation.isPending ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function POAMCard({ item, onStatusChange, editStatus, onStatusSave, onStatusCancel, saving, onStatusSet, onDelete }: any) {
  const isEditing = editStatus?.id === item.id;
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold ${SEVERITY_BADGE[item.severity] ?? SEVERITY_BADGE.low}`}>{item.severity}</span>
            {!isEditing ? (
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold cursor-pointer hover:opacity-80 ${STATUS_BADGE[item.status] ?? STATUS_BADGE.open}`} onClick={() => onStatusChange(item.id, item.status)}>
                {item.status.replace("_", " ")}
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
              </span>
            ) : (
              <div className="flex items-center gap-1.5">
                <select value={editStatus.status} onChange={e => onStatusSet(e.target.value)} className="px-2 py-0.5 border border-slate-300 rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-500">
                  {["open", "in_progress", "risk_accepted", "resolved", "closed"].map(s => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
                </select>
                <button onClick={onStatusSave} disabled={saving} className="px-2 py-0.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:opacity-50">{saving ? "..." : "Save"}</button>
                <button onClick={onStatusCancel} className="px-2 py-0.5 border border-slate-200 text-slate-600 text-xs rounded hover:bg-slate-50">Cancel</button>
              </div>
            )}
            {item.frameworkKey && <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-semibold rounded-md">{item.frameworkKey}</span>}
          </div>
          <p className="font-semibold text-slate-900 text-sm mb-0.5">{item.title}</p>
          <p className="text-xs text-slate-500">{item.weakness}</p>
          {item.description && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{item.description}</p>}
        </div>
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <div className="text-right text-xs text-slate-500">
            <p className="font-medium text-slate-700">{item.ownerName}</p>
            <p>{item.ownerTeam}</p>
            {item.scheduledCompletionDate && (
              <p className="mt-1 text-amber-600 font-medium">Due {new Date(item.scheduledCompletionDate).toLocaleDateString()}</p>
            )}
          </div>
          <button onClick={onDelete} className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
          </button>
        </div>
      </div>
    </div>
  );
}

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiUrl } from "@/lib/queryClient";

const SOURCE_BADGE: Record<string, string> = {
  auto: "bg-blue-100 text-blue-700",
  manual: "bg-slate-100 text-slate-600",
  github: "bg-gray-100 text-gray-700",
};

const TYPE_ICON: Record<string, string> = {
  document: "📄",
  screenshot: "🖼",
  log: "📋",
  auto: "⚡",
  report: "📊",
};

export default function Evidence() {
  const qc = useQueryClient();
  const [showUpload, setShowUpload] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", type: "document", url: "", ucoControlId: "" });

  const { data: orgData } = useQuery<{ org: any }>({
    queryKey: ["orgs", "me"],
    queryFn: async () => (await fetch(apiUrl("/orgs/me"), { credentials: "include" })).json(),
  });
  const orgId = orgData?.org?.id;

  const { data, isLoading } = useQuery<{ evidence: any[] }>({
    queryKey: ["org-evidence", orgId],
    queryFn: async () => (await fetch(apiUrl(`/orgs/${orgId}/evidence`), { credentials: "include" })).json(),
    enabled: !!orgId,
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(apiUrl(`/orgs/${orgId}/evidence`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["org-evidence"] });
      setShowUpload(false);
      setForm({ title: "", description: "", type: "document", url: "", ucoControlId: "" });
    },
  });

  const items = data?.evidence ?? [];
  const autoItems = items.filter(e => e.source !== "manual");
  const manualItems = items.filter(e => e.source === "manual");

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Evidence Vault</h1>
          <p className="text-slate-500 mt-1">{items.length} evidence items collected</p>
        </div>
        <button
          onClick={() => setShowUpload(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          <span className="text-lg leading-none">+</span>
          Add Evidence
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />)}</div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-16 text-center">
          <p className="text-4xl mb-4">📁</p>
          <p className="font-semibold text-slate-900 mb-2">No evidence collected yet</p>
          <p className="text-slate-500 text-sm mb-5">Connect an integration to start collecting evidence automatically, or add evidence manually.</p>
          <button onClick={() => setShowUpload(true)} className="px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors">Add evidence manually</button>
        </div>
      ) : (
        <div className="space-y-6">
          {autoItems.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Automatically Collected ({autoItems.length})</h2>
              <div className="space-y-2">
                {autoItems.map((e: any) => <EvidenceRow key={e.id} item={e} />)}
              </div>
            </div>
          )}
          {manualItems.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Manually Added ({manualItems.length})</h2>
              <div className="space-y-2">
                {manualItems.map((e: any) => <EvidenceRow key={e.id} item={e} />)}
              </div>
            </div>
          )}
        </div>
      )}

      {showUpload && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">Add Evidence</h2>
              <button onClick={() => setShowUpload(false)} className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Title *</label>
                <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="MFA Policy Screenshot" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Description</label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" rows={3} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Type</label>
                  <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="document">Document</option>
                    <option value="screenshot">Screenshot</option>
                    <option value="log">Log</option>
                    <option value="report">Report</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Control ID (optional)</label>
                  <input value={form.ucoControlId} onChange={e => setForm({ ...form, ucoControlId: e.target.value })} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="UCO-AI-001" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">URL (optional)</label>
                <input value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="https://..." />
              </div>
            </div>
            <div className="p-6 border-t border-slate-100 flex gap-3">
              <button onClick={() => setShowUpload(false)} className="flex-1 py-2.5 border border-slate-200 text-slate-600 text-sm font-semibold rounded-lg hover:bg-slate-50">Cancel</button>
              <button onClick={() => addMutation.mutate()} disabled={!form.title || addMutation.isPending} className="flex-1 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {addMutation.isPending ? "Saving..." : "Add Evidence"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EvidenceRow({ item }: { item: any }) {
  const date = new Date(item.collectedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-4 shadow-sm">
      <div className="h-10 w-10 bg-slate-50 rounded-lg flex items-center justify-center text-xl flex-shrink-0">
        {TYPE_ICON[item.type] ?? "📄"}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-medium text-slate-900 text-sm">{item.title}</p>
          {item.ucoControlId && (
            <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 text-xs font-mono rounded">{item.ucoControlId}</span>
          )}
          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${SOURCE_BADGE[item.source] ?? SOURCE_BADGE.manual}`}>
            {item.source === "auto" ? "⚡ auto" : item.source}
          </span>
        </div>
        {item.description && <p className="text-xs text-slate-500 mt-0.5 truncate">{item.description}</p>}
      </div>
      <p className="text-xs text-slate-400 flex-shrink-0">{date}</p>
    </div>
  );
}

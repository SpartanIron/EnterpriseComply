import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiUrl } from "@/lib/queryClient";
import { PageHeader, EmptyState, PrimaryButton, SectionLabel } from "@/components/ui/PageHeader";

const SOURCE_LABEL: Record<string, { label: string; cls: string }> = {
  auto: { label: "Automated", cls: "bg-blue-50 text-blue-700 ring-1 ring-blue-200" },
  manual: { label: "Manual", cls: "bg-slate-100 text-slate-600 ring-1 ring-slate-200" },
  github: { label: "GitHub", cls: "bg-slate-900 text-white" },
};

const TYPE_ICON: Record<string, React.ReactNode> = {
  document: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  screenshot: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  log: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  auto: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  ),
  report: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
};

const BLANK_FORM = { title: "", description: "", type: "document", url: "", ucoControlId: "", expiresAt: "" };

export default function Evidence() {
  const qc = useQueryClient();
  const [showUpload, setShowUpload] = useState(false);
  const [form, setForm] = useState({ ...BLANK_FORM });
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

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
      const body: Record<string, string> = {
        title: form.title,
        description: form.description,
        type: form.type,
        url: form.url,
        ucoControlId: form.ucoControlId,
      };
      if (form.expiresAt) body.expiresAt = new Date(form.expiresAt).toISOString();
      const res = await fetch(apiUrl(`/orgs/${orgId}/evidence`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["org-evidence"] });
      setShowUpload(false);
      setForm({ ...BLANK_FORM });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(apiUrl(`/orgs/${orgId}/evidence/${id}`), {
        method: "DELETE",
        credentials: "include",
      });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["org-evidence"] });
      setConfirmDelete(null);
    },
  });

  const items = data?.evidence ?? [];
  const now = new Date();
  const staleItems = items.filter(e => e.expiresAt && new Date(e.expiresAt) < now);
  const autoItems = items.filter(e => e.source !== "manual");
  const manualItems = items.filter(e => e.source === "manual");

  const FolderIcon = (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
  );

  return (
    <div className="p-6 max-w-screen-xl">
      <PageHeader
        title="Evidence Vault"
        subtitle={items.length > 0 ? `${items.length} evidence item${items.length !== 1 ? "s" : ""} collected` : "Collect and manage compliance evidence"}
        actions={
          <PrimaryButton onClick={() => setShowUpload(true)}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add Evidence
          </PrimaryButton>
        }
      />

      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <p className={`text-2xl font-bold leading-none ${items.length > 0 ? "text-slate-900" : "text-slate-300"}`}>{items.length}</p>
          <p className="text-xs font-semibold text-slate-500 mt-1">Total Items</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <p className={`text-2xl font-bold leading-none ${autoItems.length > 0 ? "text-blue-600" : "text-slate-300"}`}>{autoItems.length}</p>
          <p className="text-xs font-semibold text-slate-500 mt-1">Automated</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <p className={`text-2xl font-bold leading-none ${staleItems.length > 0 ? "text-amber-500" : items.length > 0 ? "text-green-600" : "text-slate-300"}`}>{staleItems.length}</p>
          <p className="text-xs font-semibold text-slate-500 mt-1">Expired</p>
        </div>
      </div>

      {staleItems.length > 0 && (
        <div className="mb-5 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <svg className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <p className="text-sm font-semibold text-amber-800">{staleItems.length} evidence item{staleItems.length !== 1 ? "s" : ""} expired</p>
            <p className="text-xs text-amber-600 mt-0.5">Review and refresh expired evidence to maintain audit readiness.</p>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-14 bg-slate-100 rounded-xl animate-pulse" />)}</div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={FolderIcon}
          title="No evidence collected yet"
          body="Connect an integration to start collecting evidence automatically, or add evidence manually to map it to your controls."
          action={<PrimaryButton onClick={() => setShowUpload(true)}>Add evidence manually</PrimaryButton>}
        />
      ) : (
        <div className="space-y-6">
          {autoItems.length > 0 && (
            <div>
              <SectionLabel>Automated Evidence ({autoItems.length})</SectionLabel>
              <EvidenceTable items={autoItems} onDelete={setConfirmDelete} />
            </div>
          )}
          {manualItems.length > 0 && (
            <div>
              <SectionLabel>Manual Evidence ({manualItems.length})</SectionLabel>
              <EvidenceTable items={manualItems} onDelete={setConfirmDelete} />
            </div>
          )}
        </div>
      )}

      {showUpload && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">Add Evidence</h2>
              <button onClick={() => setShowUpload(false)} className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Title *</label>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="MFA configuration screenshot" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Type</label>
                  <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                    {["document", "screenshot", "log", "report"].map(t => (
                      <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Control ID</label>
                  <input value={form.ucoControlId} onChange={e => setForm(f => ({ ...f, ucoControlId: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="UCO-AI-001" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Description</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" rows={3} placeholder="Describe this evidence item..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">URL (optional)</label>
                  <input value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="https://..." />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Expiry Date</label>
                  <input type="date" value={form.expiresAt} onChange={e => setForm(f => ({ ...f, expiresAt: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
            </div>
            <div className="p-5 border-t border-slate-100 flex justify-end gap-2">
              <button onClick={() => setShowUpload(false)} className="px-4 py-2 border border-slate-200 text-slate-600 text-sm font-semibold rounded-lg hover:bg-slate-50 transition-colors">Cancel</button>
              <button onClick={() => addMutation.mutate()} disabled={!form.title || addMutation.isPending}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {addMutation.isPending ? "Adding..." : "Add Evidence"}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete !== null && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="font-bold text-slate-900 mb-2">Delete evidence?</h3>
            <p className="text-sm text-slate-500 mb-5">This will permanently remove this evidence item from your vault.</p>
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

function EvidenceTable({ items, onDelete }: { items: any[]; onDelete: (id: number) => void }) {
  const now = new Date();
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50">
            <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Evidence</th>
            <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">Control</th>
            <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Source</th>
            <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">Collected</th>
            <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">Expires</th>
            <th className="px-5 py-3" />
          </tr>
        </thead>
        <tbody>
          {items.map((e: any, idx: number) => {
            const src = SOURCE_LABEL[e.source] ?? SOURCE_LABEL.manual;
            const icon = TYPE_ICON[e.type] ?? TYPE_ICON.document;
            const expired = e.expiresAt && new Date(e.expiresAt) < now;
            const expiringSoon = e.expiresAt && !expired && new Date(e.expiresAt) < new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
            return (
              <tr key={e.id} className={`${idx > 0 ? "border-t border-slate-100" : ""} hover:bg-slate-50 transition-colors group ${expired ? "bg-amber-50/30" : ""}`}>
                <td className="px-5 py-3.5">
                  <div className="flex items-start gap-3">
                    <div className="h-8 w-8 bg-slate-100 rounded-lg flex items-center justify-center text-slate-500 flex-shrink-0 mt-0.5">
                      {icon}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-slate-900 text-sm leading-snug">{e.title}</p>
                        {e.url && (
                          <a href={e.url} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded transition-colors flex-shrink-0"
                            title={e.url}>
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                            View artifact
                          </a>
                        )}
                      </div>
                      {e.description && <p className="text-xs text-slate-400 mt-0.5 truncate max-w-xs">{e.description}</p>}
                      {expired && <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 mt-0.5"><span className="h-1.5 w-1.5 rounded-full bg-amber-500" />Expired</span>}
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3.5 hidden md:table-cell">
                  {e.ucoControlId
                    ? <span className="font-mono text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded">{e.ucoControlId}</span>
                    : <span className="text-slate-300 text-xs">-</span>
                  }
                </td>
                <td className="px-5 py-3.5">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold ${src.cls}`}>{src.label}</span>
                </td>
                <td className="px-5 py-3.5 hidden lg:table-cell">
                  <span className="text-xs text-slate-400">{e.collectedAt ? new Date(e.collectedAt).toLocaleDateString() : "-"}</span>
                </td>
                <td className="px-5 py-3.5 hidden lg:table-cell">
                  {e.expiresAt ? (
                    <span className={`text-xs font-medium ${expired ? "text-amber-600" : expiringSoon ? "text-orange-500" : "text-slate-400"}`}>
                      {new Date(e.expiresAt).toLocaleDateString()}
                    </span>
                  ) : <span className="text-slate-300 text-xs">-</span>}
                </td>
                <td className="px-5 py-3.5">
                  <button onClick={() => onDelete(e.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors">
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

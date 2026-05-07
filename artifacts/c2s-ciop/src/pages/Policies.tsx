import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiUrl } from "@/lib/queryClient";
import { PageHeader, EmptyState, PrimaryButton, SectionLabel } from "@/components/ui/PageHeader";

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  published: { label: "Published", cls: "bg-green-50 text-green-700 ring-1 ring-green-200" },
  draft: { label: "Draft", cls: "bg-slate-100 text-slate-500 ring-1 ring-slate-200" },
  review_required: { label: "Review Required", cls: "bg-amber-50 text-amber-700 ring-1 ring-amber-200" },
  archived: { label: "Archived", cls: "bg-slate-100 text-slate-400 ring-1 ring-slate-200" },
};

const DocIcon = (
  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

export default function Policies() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [ackModal, setAckModal] = useState<any | null>(null);
  const [ackPersonId, setAckPersonId] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  const { data: orgData } = useQuery<{ org: any }>({
    queryKey: ["orgs", "me"],
    queryFn: async () => (await fetch(apiUrl("/orgs/me"), { credentials: "include" })).json(),
  });
  const orgId = orgData?.org?.id;

  const { data: templatesData } = useQuery<{ templates: any[] }>({
    queryKey: ["policy-templates"],
    queryFn: async () => (await fetch(apiUrl("/policies/templates"), { credentials: "include" })).json(),
    enabled: showCreate,
  });

  const { data, isLoading } = useQuery<{ policies: any[] }>({
    queryKey: ["org-policies", orgId],
    queryFn: async () => (await fetch(apiUrl(`/orgs/${orgId}/policies`), { credentials: "include" })).json(),
    enabled: !!orgId,
  });

  const { data: acksData } = useQuery<{ acknowledgments: any[] }>({
    queryKey: ["policy-acks", orgId, ackModal?.id],
    queryFn: async () => (await fetch(apiUrl(`/orgs/${orgId}/policies/${ackModal.id}/acknowledgments`), { credentials: "include" })).json(),
    enabled: !!orgId && !!ackModal,
  });

  const { data: peopleData } = useQuery<{ people: any[] }>({
    queryKey: ["org-people", orgId],
    queryFn: async () => (await fetch(apiUrl(`/orgs/${orgId}/people`), { credentials: "include" })).json(),
    enabled: !!orgId && !!ackModal,
  });

  const createMutation = useMutation({
    mutationFn: async (template: any) => {
      const res = await fetch(apiUrl(`/orgs/${orgId}/policies`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          templateKey: template.key,
          title: template.title,
          description: template.description,
          category: template.category,
          status: "draft",
        }),
      });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["org-policies"] });
      setShowCreate(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Record<string, unknown> }) => {
      const res = await fetch(apiUrl(`/orgs/${orgId}/policies/${id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["org-policies"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(apiUrl(`/orgs/${orgId}/policies/${id}`), {
        method: "DELETE",
        credentials: "include",
      });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["org-policies"] });
      setConfirmDelete(null);
    },
  });

  const acknowledgeMutation = useMutation({
    mutationFn: async ({ policyId, personId }: { policyId: number; personId: number }) => {
      const res = await fetch(apiUrl(`/orgs/${orgId}/policies/${policyId}/acknowledge`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ personId }),
      });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["policy-acks"] });
      setAckPersonId("");
    },
  });

  const bulkRequestMutation = useMutation({
    mutationFn: async (policyId: number) => {
      const res = await fetch(apiUrl(`/orgs/${orgId}/policies/${policyId}/request-acknowledgment`), {
        method: "POST",
        credentials: "include",
      });
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["policy-acks"] }),
  });

  const policies = data?.policies ?? [];
  const templates = templatesData?.templates ?? [];
  const existingKeys = new Set(policies.map((p: any) => p.templateKey));
  const acks = acksData?.acknowledgments ?? [];
  const people = peopleData?.people ?? [];

  const byStatus = {
    published: policies.filter(p => p.status === "published"),
    review_required: policies.filter(p => p.status === "review_required"),
    draft: policies.filter(p => p.status === "draft"),
  };

  const CATS: Record<string, string> = {
    security: "Security",
    privacy: "Privacy",
    hr: "Human Resources",
    operations: "Operations",
    compliance: "Compliance",
    federal: "Federal / Government",
  };

  return (
    <div className="p-6 max-w-screen-xl">
      <PageHeader
        title="Policies"
        subtitle="Manage your security policies and track acknowledgments"
        actions={
          <PrimaryButton onClick={() => setShowCreate(true)}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add Policy
          </PrimaryButton>
        }
      />

      {policies.length > 0 && (
        <div className="grid grid-cols-4 gap-3 mb-5">
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <p className="text-2xl font-bold text-slate-900 leading-none">{policies.length}</p>
            <p className="text-xs font-semibold text-slate-500 mt-1">Total Policies</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <p className={`text-2xl font-bold leading-none ${byStatus.published.length > 0 ? "text-green-600" : "text-slate-400"}`}>{byStatus.published.length}</p>
            <p className="text-xs font-semibold text-slate-500 mt-1">Published</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <p className={`text-2xl font-bold leading-none ${byStatus.review_required.length > 0 ? "text-amber-500" : "text-slate-400"}`}>{byStatus.review_required.length}</p>
            <p className="text-xs font-semibold text-slate-500 mt-1">Needs Review</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <p className={`text-2xl font-bold leading-none ${byStatus.draft.length > 0 ? "text-slate-600" : "text-slate-400"}`}>{byStatus.draft.length}</p>
            <p className="text-xs font-semibold text-slate-500 mt-1">Drafts</p>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-14 bg-slate-100 rounded-xl animate-pulse" />)}</div>
      ) : policies.length === 0 ? (
        <EmptyState
          icon={DocIcon}
          title="No policies yet"
          body="Add policies from our template library to satisfy framework requirements and demonstrate compliance."
          action={<PrimaryButton onClick={() => setShowCreate(true)}>Browse templates</PrimaryButton>}
        />
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Policy</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">Category</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">Version</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">Updated</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {policies.map((p: any, idx: number) => {
                const st = STATUS_CONFIG[p.status] ?? STATUS_CONFIG.draft;
                return (
                  <tr key={p.id} className={`${idx > 0 ? "border-t border-slate-100" : ""} hover:bg-slate-50 transition-colors group`}>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 bg-slate-100 rounded-lg flex items-center justify-center text-slate-500 flex-shrink-0">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">{p.title}</p>
                          {p.acknowledgedCount !== undefined && p.status === "published" && (
                            <button onClick={() => setAckModal(p)} className="text-xs text-blue-600 hover:underline mt-0.5">
                              {p.acknowledgedCount ?? 0} acknowledgment{(p.acknowledgedCount ?? 0) !== 1 ? "s" : ""}
                            </button>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 hidden md:table-cell">
                      <span className="text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md font-medium capitalize">{p.category}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold ${st.cls}`}>{st.label}</span>
                    </td>
                    <td className="px-5 py-3.5 hidden lg:table-cell">
                      <span className="text-xs font-mono text-slate-500">v{p.version ?? "1.0"}</span>
                    </td>
                    <td className="px-5 py-3.5 hidden lg:table-cell">
                      <span className="text-xs text-slate-400">
                        {p.publishedAt ? new Date(p.publishedAt).toLocaleDateString() : p.updatedAt ? new Date(p.updatedAt).toLocaleDateString() : "-"}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {p.status === "draft" && (
                          <button onClick={() => updateMutation.mutate({ id: p.id, data: { status: "published" } })}
                            className="px-2 py-1 text-xs font-semibold bg-green-50 text-green-700 border border-green-200 rounded hover:bg-green-100 transition-colors whitespace-nowrap">
                            Publish
                          </button>
                        )}
                        {p.status === "published" && (
                          <>
                            <button onClick={() => setAckModal(p)}
                              className="px-2 py-1 text-xs font-semibold bg-blue-50 text-blue-600 border border-blue-200 rounded hover:bg-blue-100 transition-colors whitespace-nowrap">
                              Acks
                            </button>
                            <button onClick={() => updateMutation.mutate({ id: p.id, data: { status: "review_required" } })}
                              className="px-2 py-1 text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 rounded hover:bg-amber-100 transition-colors whitespace-nowrap">
                              Review
                            </button>
                          </>
                        )}
                        <button onClick={() => setConfirmDelete(p.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors">
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[82vh] flex flex-col">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">Policy Templates</h2>
                <p className="text-xs text-slate-400 mt-0.5">Select a template to add to your policy library ({templates.length} available)</p>
              </div>
              <button onClick={() => setShowCreate(false)} className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="overflow-y-auto p-5 flex-1">
              {Object.entries(CATS).map(([cat, catLabel]) => {
                const catTemplates = templates.filter(t => t.category === cat && !existingKeys.has(t.key));
                if (catTemplates.length === 0) return null;
                return (
                  <div key={cat} className="mb-4">
                    <SectionLabel>{catLabel}</SectionLabel>
                    <div className="space-y-1.5">
                      {catTemplates.map((t: any) => (
                        <button
                          key={t.key}
                          onClick={() => createMutation.mutate(t)}
                          disabled={createMutation.isPending}
                          className="w-full flex items-center gap-4 p-4 border border-slate-200 rounded-xl hover:border-blue-300 hover:bg-blue-50/50 transition-all text-left group disabled:opacity-60"
                        >
                          <div className="h-9 w-9 bg-slate-100 rounded-lg flex items-center justify-center text-slate-500 flex-shrink-0 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-slate-900 text-sm group-hover:text-blue-700 transition-colors">{t.title}</p>
                            {t.description && <p className="text-xs text-slate-400 mt-0.5 truncate">{t.description}</p>}
                            {t.frameworks?.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {t.frameworks.slice(0, 3).map((f: string) => (
                                  <span key={f} className="px-1.5 py-0.5 bg-blue-50 text-blue-600 text-xs font-mono rounded">{f}</span>
                                ))}
                              </div>
                            )}
                          </div>
                          <svg className="h-4 w-4 text-slate-300 group-hover:text-blue-400 transition-colors flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
              {templates.length > 0 && templates.every(t => existingKeys.has(t.key)) && (
                <p className="text-center text-slate-500 text-sm py-8">All templates have been added to your policy library.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {ackModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">Acknowledgments</h2>
                <p className="text-xs text-slate-400 mt-0.5">{ackModal.title}</p>
              </div>
              <button onClick={() => setAckModal(null)} className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-5 border-b border-slate-100 flex gap-2">
              <select value={ackPersonId} onChange={e => setAckPersonId(e.target.value)}
                className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                <option value="">Select person to acknowledge...</option>
                {people.map((p: any) => <option key={p.id} value={p.id}>{p.name ?? p.login} {p.email ? `(${p.email})` : ""}</option>)}
              </select>
              <button onClick={() => acknowledgeMutation.mutate({ policyId: ackModal.id, personId: Number(ackPersonId) })}
                disabled={!ackPersonId || acknowledgeMutation.isPending}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50">
                Record
              </button>
              <button onClick={() => bulkRequestMutation.mutate(ackModal.id)} disabled={bulkRequestMutation.isPending}
                className="px-3 py-2 border border-slate-200 text-slate-600 text-sm font-semibold rounded-lg hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap">
                {bulkRequestMutation.isPending ? "Sending..." : "Request All"}
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-5">
              {acks.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-8">No acknowledgments recorded yet.</p>
              ) : (
                <div className="space-y-2">
                  {acks.map((a: any) => (
                    <div key={a.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                      <div>
                        <p className="text-sm font-medium text-slate-800">{a.person?.name ?? `Person #${a.personId}`}</p>
                        {a.person?.email && <p className="text-xs text-slate-400">{a.person.email}</p>}
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-400">{a.acknowledgedAt ? new Date(a.acknowledgedAt).toLocaleDateString() : "-"}</p>
                        {a.ipAddress && <p className="text-xs text-slate-300 font-mono">{a.ipAddress}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {confirmDelete !== null && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="font-bold text-slate-900 mb-2">Delete policy?</h3>
            <p className="text-sm text-slate-500 mb-5">This will permanently remove this policy and its acknowledgment records.</p>
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

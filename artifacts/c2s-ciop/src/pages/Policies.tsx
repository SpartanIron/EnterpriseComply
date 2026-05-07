import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiUrl } from "@/lib/queryClient";
import { PageHeader, EmptyState, PrimaryButton, SectionLabel } from "@/components/ui/PageHeader";

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  published: { label: "Published", cls: "bg-green-50 text-green-700 ring-1 ring-green-200" },
  draft: { label: "Draft", cls: "bg-slate-100 text-slate-500 ring-1 ring-slate-200" },
  review_required: { label: "Review Required", cls: "bg-amber-50 text-amber-700 ring-1 ring-amber-200" },
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

  const policies = data?.policies ?? [];
  const templates = templatesData?.templates ?? [];
  const existingKeys = new Set(policies.map((p: any) => p.templateKey));

  const byStatus = {
    published: policies.filter(p => p.status === "published"),
    review_required: policies.filter(p => p.status === "review_required"),
    draft: policies.filter(p => p.status === "draft"),
  };

  const CATS: Record<string, string> = {
    "security": "Security",
    "privacy": "Privacy",
    "hr": "Human Resources",
    "operations": "Operations",
    "compliance": "Compliance",
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
        <div className="grid grid-cols-3 gap-3 mb-5">
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
              </tr>
            </thead>
            <tbody>
              {policies.map((p: any, idx: number) => {
                const st = STATUS_CONFIG[p.status] ?? STATUS_CONFIG.draft;
                return (
                  <tr key={p.id} className={`${idx > 0 ? "border-t border-slate-100" : ""} hover:bg-slate-50 transition-colors`}>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 bg-slate-100 rounded-lg flex items-center justify-center text-slate-500 flex-shrink-0">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <p className="font-semibold text-slate-900">{p.title}</p>
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
                <p className="text-xs text-slate-400 mt-0.5">Select a template to add to your policy library</p>
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
    </div>
  );
}

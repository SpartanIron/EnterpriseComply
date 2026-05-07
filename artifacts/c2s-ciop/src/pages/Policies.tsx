import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiUrl } from "@/lib/queryClient";

const STATUS_BADGE: Record<string, string> = {
  published: "bg-green-100 text-green-700",
  draft: "bg-slate-100 text-slate-600",
  review_required: "bg-amber-100 text-amber-700",
};

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

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Policies</h1>
          <p className="text-slate-500 mt-1">Manage your security policies and track acknowledgments</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          <span className="text-lg leading-none">+</span>
          Add Policy
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />)}</div>
      ) : policies.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-16 text-center">
          <p className="text-4xl mb-4">📝</p>
          <p className="font-semibold text-slate-900 mb-2">No policies yet</p>
          <p className="text-slate-500 text-sm mb-5">Add policies from our template library to satisfy framework requirements.</p>
          <button onClick={() => setShowCreate(true)} className="px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors">Browse templates</button>
        </div>
      ) : (
        <div className="space-y-3">
          {policies.map((p: any) => (
            <div key={p.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex items-center gap-4">
              <div className="h-10 w-10 bg-slate-100 rounded-lg flex items-center justify-center text-xl flex-shrink-0">📄</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-slate-900 text-sm">{p.title}</p>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_BADGE[p.status] ?? STATUS_BADGE.draft}`}>{p.status.replace("_", " ")}</span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">{p.category} · v{p.version}</p>
              </div>
              <div className="text-xs text-slate-400 flex-shrink-0">
                {p.publishedAt ? `Published ${new Date(p.publishedAt).toLocaleDateString()}` : "Draft"}
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">Policy Templates</h2>
              <button onClick={() => setShowCreate(false)} className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400">✕</button>
            </div>
            <div className="overflow-y-auto p-6 flex-1 space-y-3">
              {templates.filter(t => !existingKeys.has(t.key)).map((t: any) => (
                <button
                  key={t.key}
                  onClick={() => createMutation.mutate(t)}
                  disabled={createMutation.isPending}
                  className="w-full flex items-center gap-4 p-4 border border-slate-200 rounded-xl hover:border-blue-300 hover:bg-blue-50 transition-colors text-left group"
                >
                  <div className="h-10 w-10 bg-slate-100 rounded-lg flex items-center justify-center text-xl flex-shrink-0 group-hover:bg-blue-100 transition-colors">📄</div>
                  <div className="flex-1">
                    <p className="font-semibold text-slate-900 text-sm group-hover:text-blue-700 transition-colors">{t.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{t.description}</p>
                  </div>
                  <span className="text-blue-600 font-semibold text-sm">+ Add →</span>
                </button>
              ))}
              {templates.filter(t => existingKeys.has(t.key)).length === templates.length && (
                <p className="text-center text-slate-500 text-sm py-4">All templates are already added.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

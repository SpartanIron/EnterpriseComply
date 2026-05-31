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
  const [viewPolicy, setViewPolicy] = useState<any | null>(null);
  const [reviewModal, setReviewModal] = useState<any | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [reviewBumpVersion, setReviewBumpVersion] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");

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

  const { data: reviewHistoryData } = useQuery<{ reviews: any[] }>({
    queryKey: ["policy-reviews", orgId, viewPolicy?.id],
    queryFn: async () => (await fetch(apiUrl(`/orgs/${orgId}/policies/${viewPolicy.id}/reviews`), { credentials: "include" })).json(),
    enabled: !!orgId && !!viewPolicy,
  });

  const { data: peopleData } = useQuery<{ people: any[] }>({
    queryKey: ["org-people", orgId],
    queryFn: async () => (await fetch(apiUrl(`/orgs/${orgId}/people`), { credentials: "include" })).json(),
    enabled: !!orgId && (!!ackModal || !!reviewModal),
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
          content: template.content ?? null,
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

  const reviewMutation = useMutation({
    mutationFn: async ({ id, notes, bumpVersion }: { id: number; notes: string; bumpVersion: boolean }) => {
      const res = await fetch(apiUrl(`/orgs/${orgId}/policies/${id}/review`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ notes, bumpVersion }),
      });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["org-policies"] });
      qc.invalidateQueries({ queryKey: ["policy-reviews"] });
      setReviewModal(null);
      setReviewNotes("");
      setReviewBumpVersion(false);
    },
  });

  const policies = data?.policies ?? [];
  const templates = (templatesData?.templates ?? []).filter((t: any): t is NonNullable<any> => t != null);
  const existingKeys = new Set(policies.map((p: any) => p.templateKey));
  const acks = acksData?.acknowledgments ?? [];
  const people = peopleData?.people ?? [];
  const reviewHistory = reviewHistoryData?.reviews ?? [];

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

  const filteredPolicies = policies.filter((p: any) => {
    const matchSearch = !searchQuery || p.title?.toLowerCase().includes(searchQuery.toLowerCase()) || p.category?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchStatus = filterStatus === "all" || p.status === filterStatus;
    const matchCat = filterCategory === "all" || p.category === filterCategory;
    return matchSearch && matchStatus && matchCat;
  });

  function bumpVersionStr(current: string | null | undefined): string {
    if (!current) return "1.1";
    const parts = String(current).split(".");
    const minor = parseInt(parts[1] ?? "0", 10) + 1;
    return `${parts[0]}.${minor}`;
  }

  return (
    <div className="p-6 max-w-screen-xl">
      <PageHeader
        title="Policies"
        subtitle="Manage your security policies, track acknowledgments, and maintain review cycles"
        actions={
          <PrimaryButton onClick={() => setShowCreate(true)}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add Policy
          </PrimaryButton>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <p className={`text-2xl font-bold leading-none ${policies.length > 0 ? "text-slate-900" : "text-slate-300"}`}>{policies.length}</p>
          <p className="text-xs font-semibold text-slate-500 mt-1">Total Policies</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <p className={`text-2xl font-bold leading-none ${byStatus.published.length > 0 ? "text-green-600" : "text-slate-300"}`}>{byStatus.published.length}</p>
          <p className="text-xs font-semibold text-slate-500 mt-1">Published</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <p className={`text-2xl font-bold leading-none ${byStatus.review_required.length > 0 ? "text-amber-500" : "text-slate-300"}`}>{byStatus.review_required.length}</p>
          <p className="text-xs font-semibold text-slate-500 mt-1">Needs Review</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <p className={`text-2xl font-bold leading-none ${byStatus.draft.length > 0 ? "text-slate-600" : "text-slate-300"}`}>{byStatus.draft.length}</p>
          <p className="text-xs font-semibold text-slate-500 mt-1">Drafts</p>
        </div>
      </div>

      {/* Filter bar */}
      {policies.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search policies..."
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white w-48"
          />
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="all">All Statuses</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
            <option value="review_required">Needs Review</option>
          </select>
          <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="all">All Categories</option>
            {Object.entries(CATS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          {(searchQuery || filterStatus !== "all" || filterCategory !== "all") && (
            <button onClick={() => { setSearchQuery(""); setFilterStatus("all"); setFilterCategory("all"); }}
              className="px-3 py-2 text-sm text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50">
              Clear filters
            </button>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-14 bg-slate-100 rounded-xl animate-pulse" />)}</div>
      ) : policies.length === 0 ? (
        <div className="space-y-4">
          <EmptyState
            icon={DocIcon}
            title="No policies yet"
            body="Add policies from our 50-template library to satisfy framework requirements and demonstrate compliance."
            action={<PrimaryButton onClick={() => setShowCreate(true)}>Browse templates</PrimaryButton>}
          />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { cat: "Security", count: 18, examples: "Information Security, Acceptable Use, Access Control, Encryption, MFA", color: "bg-blue-50 text-blue-700" },
              { cat: "Privacy & Data", count: 8, examples: "Data Classification, Privacy Policy, Data Retention, Cookie Consent", color: "bg-green-50 text-green-700" },
              { cat: "Operations", count: 10, examples: "Change Management, Incident Response, Business Continuity, Backup", color: "bg-amber-50 text-amber-700" },
              { cat: "Human Resources", count: 6, examples: "Background Check, Security Awareness, Onboarding/Offboarding", color: "bg-purple-50 text-purple-700" },
              { cat: "Compliance & Risk", count: 5, examples: "Risk Management, Vendor Risk, Supply Chain, Third-Party Access", color: "bg-slate-100 text-slate-600" },
              { cat: "Federal / Gov", count: 3, examples: "System Security Plan, CMMC Compliance, FedRAMP Controls", color: "bg-violet-50 text-violet-700" },
            ].map(({ cat, count, examples, color }) => (
              <div key={cat} className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded-md ${color}`}>{cat}</span>
                  <span className="text-xs text-slate-400 font-medium">{count} templates</span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">{examples}</p>
              </div>
            ))}
          </div>
        </div>
      ) : filteredPolicies.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
          <p className="text-slate-500 text-sm">No policies match your filters.</p>
          <button onClick={() => { setSearchQuery(""); setFilterStatus("all"); setFilterCategory("all"); }}
            className="mt-3 text-blue-600 text-sm hover:underline">Clear filters</button>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Policy</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">Category</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">Version</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">Last Reviewed</th>
                <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPolicies.map((p: any, idx: number) => {
                const st = STATUS_CONFIG[p.status] ?? STATUS_CONFIG.draft;
                const nextReview = p.lastReviewedAt
                  ? new Date(new Date(p.lastReviewedAt).getTime() + 365 * 24 * 60 * 60 * 1000)
                  : null;
                const isOverdue = nextReview && nextReview < new Date();
                return (
                  <tr key={p.id} className={`${idx > 0 ? "border-t border-slate-100" : ""} hover:bg-slate-50/70 transition-colors group`}>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 bg-slate-100 rounded-lg flex items-center justify-center text-slate-500 flex-shrink-0">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <div>
                          <button onClick={() => setViewPolicy(p)} className="font-semibold text-slate-900 hover:text-blue-600 transition-colors text-left">
                            {p.title}
                          </button>
                          {p.status === "published" && p.acknowledgedCount !== undefined && (
                            <button onClick={() => setAckModal(p)} className="text-xs text-blue-600 hover:underline mt-0.5 block">
                              {p.acknowledgedCount ?? 0} acknowledgment{(p.acknowledgedCount ?? 0) !== 1 ? "s" : ""}
                            </button>
                          )}
                          {isOverdue && (
                            <span className="text-xs text-red-500 font-medium block mt-0.5">Annual review overdue</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 hidden md:table-cell">
                      <span className="text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md font-medium capitalize">{CATS[p.category] ?? p.category}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold ${st.cls}`}>{st.label}</span>
                    </td>
                    <td className="px-5 py-3.5 hidden lg:table-cell">
                      <span className="text-xs font-mono text-slate-500">v{p.version ?? "1.0"}</span>
                    </td>
                    <td className="px-5 py-3.5 hidden lg:table-cell">
                      <span className={`text-xs ${isOverdue ? "text-red-500 font-medium" : "text-slate-400"}`}>
                        {p.lastReviewedAt ? new Date(p.lastReviewedAt).toLocaleDateString() : "Never reviewed"}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => setViewPolicy(p)}
                          title="Open policy"
                          className="px-2 py-1 text-xs font-semibold bg-slate-50 text-slate-600 border border-slate-200 rounded hover:bg-slate-100 transition-colors whitespace-nowrap">
                          Open
                        </button>
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
                            <button onClick={() => { setReviewModal(p); setReviewNotes(""); setReviewBumpVersion(false); }}
                              className="px-2 py-1 text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 rounded hover:bg-amber-100 transition-colors whitespace-nowrap">
                              Review
                            </button>
                          </>
                        )}
                        {p.status === "review_required" && (
                          <button onClick={() => { setReviewModal(p); setReviewNotes(""); setReviewBumpVersion(false); }}
                            className="px-2 py-1 text-xs font-semibold bg-amber-500 text-white border border-amber-500 rounded hover:bg-amber-600 transition-colors whitespace-nowrap">
                            Review Now
                          </button>
                        )}
                        <button onClick={() => setConfirmDelete(p.id)} title="Remove policy" className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors">
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

      {/* ===== POLICY VIEW MODAL ===== */}
      {viewPolicy && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            <div className="p-5 border-b border-slate-100 flex items-start justify-between flex-shrink-0">
              <div className="flex-1 min-w-0 pr-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold ${(STATUS_CONFIG[viewPolicy.status] ?? STATUS_CONFIG.draft).cls}`}>
                    {(STATUS_CONFIG[viewPolicy.status] ?? STATUS_CONFIG.draft).label}
                  </span>
                  <span className="text-xs font-mono text-slate-400">v{viewPolicy.version ?? "1.0"}</span>
                  <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded capitalize">{CATS[viewPolicy.category] ?? viewPolicy.category}</span>
                </div>
                <h2 className="text-lg font-bold text-slate-900">{viewPolicy.title}</h2>
                {viewPolicy.description && <p className="text-xs text-slate-400 mt-0.5">{viewPolicy.description}</p>}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {viewPolicy.status === "published" && (
                  <button onClick={() => { setAckModal(viewPolicy); setViewPolicy(null); }}
                    className="px-3 py-1.5 text-xs font-semibold bg-blue-50 text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-100">
                    Acknowledgments
                  </button>
                )}
                {(viewPolicy.status === "published" || viewPolicy.status === "review_required") && (
                  <button onClick={() => { setReviewModal(viewPolicy); setViewPolicy(null); setReviewNotes(""); setReviewBumpVersion(false); }}
                    className="px-3 py-1.5 text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 rounded-lg hover:bg-amber-100">
                    Start Review
                  </button>
                )}
                <button onClick={() => setViewPolicy(null)} className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>
            {/* Policy metadata bar */}
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center gap-6 text-xs text-slate-500 flex-shrink-0 flex-wrap">
              <span>
                <span className="font-semibold text-slate-600">Last Reviewed:</span>{" "}
                {viewPolicy.lastReviewedAt ? new Date(viewPolicy.lastReviewedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "Never reviewed"}
              </span>
              <span>
                <span className="font-semibold text-slate-600">Next Review Due:</span>{" "}
                {viewPolicy.lastReviewedAt
                  ? new Date(new Date(viewPolicy.lastReviewedAt).getTime() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
                  : "Immediately"}
              </span>
              <span>
                <span className="font-semibold text-slate-600">Acknowledgments:</span>{" "}
                {viewPolicy.acknowledgedCount ?? 0}
              </span>
              {viewPolicy.publishedAt && (
                <span>
                  <span className="font-semibold text-slate-600">Published:</span>{" "}
                  {new Date(viewPolicy.publishedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                </span>
              )}
            </div>
            {/* Policy content */}
            <div className="overflow-y-auto flex-1 p-5">
              {viewPolicy.content ? (
                <pre className="whitespace-pre-wrap font-sans text-sm text-slate-700 leading-relaxed">{viewPolicy.content}</pre>
              ) : (
                <div className="text-center py-12 text-slate-400">
                  <svg className="h-10 w-10 mx-auto mb-3 text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-sm font-medium text-slate-400">No policy content written yet</p>
                  <p className="text-xs text-slate-300 mt-1">Policy content can be added via the edit workflow</p>
                </div>
              )}

              {/* Review History */}
              {reviewHistory.length > 0 && (
                <div className="mt-8 pt-6 border-t border-slate-100">
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Review History</h4>
                  <div className="space-y-3">
                    {reviewHistory.map((r: any) => (
                      <div key={r.id} className="flex items-start gap-3 text-sm">
                        <div className="h-6 w-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                          <svg className="h-3 w-3 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-800">Reviewed</span>
                            {r.versionAfter && <span className="font-mono text-xs text-slate-400">v{r.versionAfter}</span>}
                          </div>
                          {r.notes && <p className="text-xs text-slate-500 mt-0.5">{r.notes}</p>}
                          <p className="text-xs text-slate-400 mt-0.5">{r.reviewedAt ? new Date(r.reviewedAt).toLocaleString() : ""}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="p-4 border-t border-slate-100 flex items-center justify-between flex-shrink-0">
              <div className="flex gap-2">
                {viewPolicy.status === "draft" && (
                  <button onClick={() => { updateMutation.mutate({ id: viewPolicy.id, data: { status: "published" } }); setViewPolicy(null); }}
                    className="px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700">
                    Publish Policy
                  </button>
                )}
              </div>
              <button onClick={() => setViewPolicy(null)}
                className="px-4 py-2 border border-slate-200 text-slate-600 text-sm font-semibold rounded-lg hover:bg-slate-50">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== REVIEW MODAL ===== */}
      {reviewModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">Annual Policy Review</h2>
                <p className="text-xs text-slate-400 mt-0.5">{reviewModal.title}</p>
              </div>
              <button onClick={() => setReviewModal(null)} className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-5 space-y-4">
              {/* Review checklist */}
              <div className="bg-blue-50 rounded-xl p-4 text-sm text-blue-800 space-y-2">
                <p className="font-semibold text-blue-900 mb-2">Review Checklist</p>
                {[
                  "Policy content is current and accurate",
                  "Scope and applicability remain correct",
                  "Roles and responsibilities are up to date",
                  "Regulatory references are current",
                  "No new risks or gaps identified",
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <svg className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Review Notes <span className="text-slate-400 font-normal">(optional)</span></label>
                <textarea
                  value={reviewNotes}
                  onChange={e => setReviewNotes(e.target.value)}
                  rows={3}
                  placeholder="Enter any observations, changes made, or notes for the audit trail..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
              <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl">
                <input
                  type="checkbox"
                  id="bump-version"
                  checked={reviewBumpVersion}
                  onChange={e => setReviewBumpVersion(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="bump-version" className="text-sm text-slate-700">
                  <span className="font-medium">Bump version number</span>
                  <span className="text-xs text-slate-400 block mt-0.5">
                    Current: v{reviewModal.version ?? "1.0"} - New: v{bumpVersionStr(reviewModal.version ?? "1.0")}
                  </span>
                </label>
              </div>
              <div className="p-3 bg-amber-50 rounded-xl text-xs text-amber-700">
                <p className="font-semibold mb-0.5">Audit Trail</p>
                <p>This review will be logged with a timestamp and set the next annual review date to {new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString()}. The policy status will be updated to Published.</p>
              </div>
            </div>
            <div className="p-5 border-t border-slate-100 flex gap-2">
              <button onClick={() => setReviewModal(null)}
                className="flex-1 py-2 border border-slate-200 text-slate-600 text-sm font-semibold rounded-lg hover:bg-slate-50">
                Cancel
              </button>
              <button
                onClick={() => reviewMutation.mutate({ id: reviewModal.id, notes: reviewNotes, bumpVersion: reviewBumpVersion })}
                disabled={reviewMutation.isPending}
                className="flex-1 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {reviewMutation.isPending ? "Completing review..." : "Complete Review"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== ACK MODAL ===== */}
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

      {/* ===== ADD POLICY MODAL ===== */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[82vh] flex flex-col">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">Policy Templates</h2>
                <p className="text-xs text-slate-400 mt-0.5">50 industry-standard templates covering CMMC, FedRAMP, SOC 2, and ISO 27001 ({templates.length} available)</p>
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
                                {t.frameworks.slice(0, 4).map((f: string) => (
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

      {/* ===== DELETE CONFIRM ===== */}
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

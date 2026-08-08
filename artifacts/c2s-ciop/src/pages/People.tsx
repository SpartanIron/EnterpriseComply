import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiUrl } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { PageHeader, EmptyState, PrimaryButton, SecondaryButton } from "@/components/ui/PageHeader";

const PeopleIcon = (
  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>
);

const BLANK_FORM = { name: "", email: "", title: "", department: "", mfaEnabled: false, trainingComplete: false };

function toApiBody(form: typeof BLANK_FORM) {
  const parts = form.name.trim().split(/\s+/);
  const firstName = parts[0] ?? "";
  const lastName = parts.slice(1).join(" ") || undefined;
  return {
    firstName,
    lastName,
    email: form.email,
    title: form.title || undefined,
    department: form.department || undefined,
    mfaEnabled: form.mfaEnabled,
    trainingStatus: form.trainingComplete ? "completed" : "not_started",
  };
}

function displayName(p: any): string {
  const full = [p.firstName, p.lastName].filter(Boolean).join(" ");
  return full || p.login || "";
}

export default function People() {
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<any | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ ...BLANK_FORM });
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  const { data: orgData } = useQuery<{ org: any }>({
    queryKey: ["orgs", "me"],
    queryFn: async () => (await fetch(apiUrl("/orgs/me"), { credentials: "include" })).json(),
  });
  const orgId = orgData?.org?.id;

  const { data, isLoading } = useQuery<{ people: any[] }>({
    queryKey: ["org-people", orgId],
    queryFn: async () => (await fetch(apiUrl(`/orgs/${orgId}/people`), { credentials: "include" })).json(),
    enabled: !!orgId,
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(apiUrl(`/orgs/${orgId}/people`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(toApiBody(form)),
      });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["org-people"] });
      setShowAdd(false);
      setForm({ ...BLANK_FORM });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: typeof form }) => {
      const res = await fetch(apiUrl(`/orgs/${orgId}/people/${id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(toApiBody(data)),
      });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["org-people"] });
      setEditing(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(apiUrl(`/orgs/${orgId}/people/${id}`), {
        method: "DELETE",
        credentials: "include",
      });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["org-people"] });
      setConfirmDelete(null);
    },
  });

  const people = data?.people ?? [];
  const mfaEnabled = people.filter(p => p.mfaEnabled).length;
  const trainingDone = people.filter(p => p.trainingStatus === "completed").length;

  const openEdit = (p: any) => {
    setEditing(p);
    setForm({
      name: displayName(p),
      email: p.email ?? "",
      title: p.title ?? "",
      department: p.department ?? "",
      mfaEnabled: p.mfaEnabled ?? false,
      trainingComplete: p.trainingStatus === "completed",
    });
  };

  return (
    <div className="p-6 max-w-screen-xl">
      <PageHeader
        title="People"
        subtitle="Track workforce compliance: MFA, training, and access reviews"
        actions={
          <>
            <SecondaryButton onClick={() => navigate("/integrations")}>Import from integration</SecondaryButton>
            <PrimaryButton onClick={() => { setForm({ ...BLANK_FORM }); setShowAdd(true); }}>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Add Person
            </PrimaryButton>
          </>
        }
      />

      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <p className={`text-2xl font-bold leading-none ${people.length > 0 ? "text-slate-900" : "text-slate-300"}`}>{people.length}</p>
          <p className="text-xs font-semibold text-slate-500 mt-1">Total People</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <p className={`text-2xl font-bold leading-none ${mfaEnabled === people.length && people.length > 0 ? "text-green-600" : mfaEnabled > 0 ? "text-amber-500" : "text-slate-300"}`}>{mfaEnabled}</p>
          <p className="text-xs font-semibold text-slate-500 mt-1">MFA Enabled</p>
          <div className="mt-2 h-1 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-green-500 rounded-full" style={{ width: `${people.length > 0 ? (mfaEnabled / people.length) * 100 : 0}%` }} />
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <p className={`text-2xl font-bold leading-none ${trainingDone === people.length && people.length > 0 ? "text-green-600" : trainingDone > 0 ? "text-amber-500" : "text-slate-300"}`}>{trainingDone}</p>
          <p className="text-xs font-semibold text-slate-500 mt-1">Training Complete</p>
          <div className="mt-2 h-1 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-green-500 rounded-full" style={{ width: `${people.length > 0 ? (trainingDone / people.length) * 100 : 0}%` }} />
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-slate-100 rounded-xl animate-pulse" />)}</div>
      ) : people.length === 0 ? (
        <div className="space-y-4">
          <EmptyState
            icon={PeopleIcon}
            title="No people added yet"
            body="Connect an HR or identity integration to automatically sync your team, or add members manually."
            action={<PrimaryButton onClick={() => navigate("/integrations")}>Connect integration</PrimaryButton>}
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: "Identity integrations", body: "Connect Okta, Azure AD, or Google Workspace to sync your team automatically, including MFA status and group memberships." },
              { label: "GitHub sync", body: "Import developers from your GitHub organization. MFA enforcement status is read directly from the GitHub API." },
              { label: "SOC 2 CC6.1", body: "Frameworks require tracking who has access to your systems. People records feed directly into access review campaigns." },
            ].map(({ label, body }) => (
              <div key={label} className="bg-white border border-slate-200 rounded-xl p-4">
                <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-600 text-xs font-semibold rounded-md mb-2">{label}</span>
                <p className="text-xs text-slate-500 leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Person</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Title</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">MFA</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Training</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">Access Review</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">Source</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {people.map((p: any, idx: number) => {
                const name = displayName(p);
                return (
                  <tr key={p.id} className={`${idx > 0 ? "border-t border-slate-100" : ""} hover:bg-slate-50 transition-colors group`}>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700 flex-shrink-0">
                          {(name || "?").charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 leading-snug">{name || <span className="text-slate-400 italic">No name</span>}</p>
                          {p.email && <p className="text-xs text-slate-400 truncate">{p.email}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-slate-600">
                      {p.title ? <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-medium">{p.title}</span> : <span className="text-slate-300">-</span>}
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusPill value={p.mfaEnabled} trueLabel="Enabled" falseLabel="Disabled" />
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusPill value={p.trainingStatus === "completed"} trueLabel="Complete" falseLabel="Pending" />
                    </td>
                    <td className="px-5 py-3.5 hidden md:table-cell">
                      <StatusPill value={p.accessReviewStatus === "approved"} trueLabel="Reviewed" falseLabel="Pending" neutral />
                    </td>
                    <td className="px-5 py-3.5 hidden lg:table-cell">
                      {p.integrationKey ? (
                        <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md font-mono">{p.integrationKey}</span>
                      ) : <span className="text-slate-300 text-xs">manual</span>}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(p)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors">
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </button>
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

      {(showAdd || editing) && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">{editing ? "Edit Person" : "Add Person"}</h2>
              <button onClick={() => { setShowAdd(false); setEditing(null); }} className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Full Name *</label>
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Jane Smith" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Email</label>
                  <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="jane@company.com" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Title</label>
                  <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Software Engineer" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Department</label>
                  <input value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Engineering" />
                </div>
              </div>
              <div className="flex gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.mfaEnabled} onChange={e => setForm(f => ({ ...f, mfaEnabled: e.target.checked }))} className="h-4 w-4 rounded border-slate-300 text-blue-600" />
                  <span className="text-sm text-slate-700">MFA Enabled</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.trainingComplete} onChange={e => setForm(f => ({ ...f, trainingComplete: e.target.checked }))} className="h-4 w-4 rounded border-slate-300 text-blue-600" />
                  <span className="text-sm text-slate-700">Training Complete</span>
                </label>
              </div>
            </div>
            <div className="p-5 border-t border-slate-100 flex gap-2">
              <button onClick={() => { setShowAdd(false); setEditing(null); }} className="flex-1 py-2 border border-slate-200 text-slate-600 text-sm font-semibold rounded-lg hover:bg-slate-50 transition-colors">Cancel</button>
              <button
                onClick={() => editing ? updateMutation.mutate({ id: editing.id, data: form }) : addMutation.mutate()}
                disabled={!form.name || (editing ? updateMutation.isPending : addMutation.isPending)}
                className="flex-1 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {(editing ? updateMutation.isPending : addMutation.isPending) ? "Saving..." : editing ? "Save Changes" : "Add Person"}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete !== null && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="font-bold text-slate-900 mb-2">Remove person?</h3>
            <p className="text-sm text-slate-500 mb-5">This will permanently remove this person from your workforce roster.</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 py-2 border border-slate-200 text-slate-600 text-sm font-semibold rounded-lg hover:bg-slate-50">Cancel</button>
              <button onClick={() => deleteMutation.mutate(confirmDelete!)} disabled={deleteMutation.isPending}
                className="flex-1 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 disabled:opacity-50">
                {deleteMutation.isPending ? "Removing..." : "Remove"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Segregation of Duties (SoD) Alert Section */}
      {/* P0-11: Hardcoded SoD conflicts removed — they showed fake access violations
          (Finance Approver + Submitter, etc.) to every org regardless of actual roles.
          Real SoD detection requires HRIS integration; no SoD API endpoint exists yet. */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Segregation of Duties (SoD)</h2>
            <p className="text-xs text-slate-500 mt-0.5">Detect access conflicts that violate separation of duties controls</p>
          </div>
          <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">Requires HRIS</span>
        </div>
        <div className="flex flex-col items-center py-8 text-center">
          <div className="h-12 w-12 rounded-full bg-slate-50 flex items-center justify-center mb-3">
            <svg className="h-6 w-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>
          </div>
          <p className="text-sm font-semibold text-slate-700 mb-1">No SoD analysis available</p>
          <p className="text-xs text-slate-500 max-w-sm leading-relaxed">
            Automated SoD conflict detection requires an HRIS integration to map role assignments. Connect Gusto, ADP, or BambooHR from the Integrations page to enable real-time access conflict analysis.
          </p>
        </div>
      </div>

      {/* Training Campaigns */}
      {/* P0-11: Hardcoded training campaigns removed — they showed fake campaign names,
          completion rates (82%, 36/48, etc.) to every org with no real data behind them.
          No training campaigns API endpoint exists yet (org_training_campaigns table exists
          in the DB but has no controller/service). */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Security Training Campaigns</h2>
            <p className="text-xs text-slate-500 mt-0.5">Track completion rates and manage mandatory training assignments</p>
          </div>
          <button className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 opacity-50 cursor-not-allowed" disabled>+ New Campaign</button>
        </div>
        <div className="flex flex-col items-center py-8 text-center">
          <div className="h-12 w-12 rounded-full bg-blue-50 flex items-center justify-center mb-3">
            <svg className="h-6 w-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.606 50.606 0 00-2.658-.813A59.906 59.906 0 0112 3.493a59.903 59.903 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" /></svg>
          </div>
          <p className="text-sm font-semibold text-slate-700 mb-1">No training campaigns yet</p>
          <p className="text-xs text-slate-500 max-w-sm leading-relaxed">
            Training campaign management is coming soon. You will be able to assign mandatory security awareness, compliance, and phishing simulation campaigns to your team and track completion rates here.
          </p>
        </div>
      </div>

      {/* Bulk Policy Acknowledgment Campaign */}
      {/* P0-11: Hardcoded policy campaigns removed — they showed fake campaign names
          (Annual Policy Acknowledgment 2026, 35/48 completed, etc.) to every org.
          No policy campaign API endpoint exists yet. */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Bulk Policy Acknowledgment Campaigns</h2>
            <p className="text-xs text-slate-500 mt-0.5">Assign multiple policies to groups of people and track completion</p>
          </div>
          <button className="text-xs bg-purple-600 text-white px-3 py-1.5 rounded-lg hover:bg-purple-700 opacity-50 cursor-not-allowed" disabled>+ New Campaign</button>
        </div>
        <div className="flex flex-col items-center py-8 text-center">
          <div className="h-12 w-12 rounded-full bg-purple-50 flex items-center justify-center mb-3">
            <svg className="h-6 w-6 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" /></svg>
          </div>
          <p className="text-sm font-semibold text-slate-700 mb-1">No policy campaigns yet</p>
          <p className="text-xs text-slate-500 max-w-sm leading-relaxed">
            Bulk policy acknowledgment campaigns let you assign multiple policies to your team at once and track sign-offs. This feature is coming soon.
          </p>
        </div>
      </div>
    </div>
  );
}

function StatusPill({ value, trueLabel, falseLabel, neutral }: {
  value: boolean; trueLabel: string; falseLabel: string; neutral?: boolean;
}) {
  if (value) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-50 ring-1 ring-green-200 px-2 py-0.5 rounded-full">
        <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
        {trueLabel}
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${neutral ? "text-slate-400 bg-slate-50 ring-1 ring-slate-200" : "text-slate-500 bg-slate-50 ring-1 ring-slate-200"}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
      {falseLabel}
    </span>
  );
}

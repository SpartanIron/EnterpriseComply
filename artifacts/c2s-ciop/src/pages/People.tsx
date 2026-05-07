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

const BLANK_FORM = { name: "", email: "", role: "", department: "", mfaEnabled: false, trainingComplete: false };

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
        body: JSON.stringify(form),
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
        body: JSON.stringify(data),
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
  const trainingDone = people.filter(p => p.trainingComplete || p.trainingStatus === "completed").length;

  const openEdit = (p: any) => {
    setEditing(p);
    setForm({
      name: p.name ?? "",
      email: p.email ?? "",
      role: p.role ?? "",
      department: p.department ?? "",
      mfaEnabled: p.mfaEnabled ?? false,
      trainingComplete: p.trainingComplete ?? false,
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

      {people.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <p className="text-2xl font-bold text-slate-900 leading-none">{people.length}</p>
            <p className="text-xs font-semibold text-slate-500 mt-1">Total People</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <p className={`text-2xl font-bold leading-none ${mfaEnabled === people.length ? "text-green-600" : mfaEnabled > 0 ? "text-amber-500" : "text-slate-400"}`}>{mfaEnabled}</p>
            <p className="text-xs font-semibold text-slate-500 mt-1">MFA Enabled</p>
            <div className="mt-2 h-1 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-green-500 rounded-full" style={{ width: `${people.length > 0 ? (mfaEnabled / people.length) * 100 : 0}%` }} />
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <p className={`text-2xl font-bold leading-none ${trainingDone === people.length ? "text-green-600" : trainingDone > 0 ? "text-amber-500" : "text-slate-400"}`}>{trainingDone}</p>
            <p className="text-xs font-semibold text-slate-500 mt-1">Training Complete</p>
            <div className="mt-2 h-1 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-green-500 rounded-full" style={{ width: `${people.length > 0 ? (trainingDone / people.length) * 100 : 0}%` }} />
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-slate-100 rounded-xl animate-pulse" />)}</div>
      ) : people.length === 0 ? (
        <EmptyState
          icon={PeopleIcon}
          title="No people added yet"
          body="Connect an HR or identity integration to automatically sync your team, or add members manually."
          action={<PrimaryButton onClick={() => navigate("/integrations")}>Connect integration</PrimaryButton>}
        />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Person</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Role</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">MFA</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Training</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">Access Review</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">Source</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {people.map((p: any, idx: number) => (
                <tr key={p.id} className={`${idx > 0 ? "border-t border-slate-100" : ""} hover:bg-slate-50 transition-colors group`}>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700 flex-shrink-0">
                        {(p.name ?? p.login ?? "?").charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 leading-snug">{p.name ?? p.login}</p>
                        {p.email && <p className="text-xs text-slate-400 truncate">{p.email}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-slate-600">
                    {p.role ? <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-medium">{p.role}</span> : <span className="text-slate-300">-</span>}
                  </td>
                  <td className="px-5 py-3.5">
                    <StatusPill value={p.mfaEnabled} trueLabel="Enabled" falseLabel="Disabled" />
                  </td>
                  <td className="px-5 py-3.5">
                    <StatusPill value={p.trainingComplete || p.trainingStatus === "completed"} trueLabel="Complete" falseLabel="Pending" />
                  </td>
                  <td className="px-5 py-3.5 hidden md:table-cell">
                    <StatusPill value={p.accessReviewComplete} trueLabel="Reviewed" falseLabel="Pending" neutral />
                  </td>
                  <td className="px-5 py-3.5 hidden lg:table-cell">
                    {p.source ? (
                      <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md font-mono">{p.source}</span>
                    ) : <span className="text-slate-300 text-xs">-</span>}
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
              ))}
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
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Role</label>
                  <input value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Engineer" />
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

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
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Segregation of Duties (SoD)</h2>
            <p className="text-xs text-slate-500 mt-0.5">Detect access conflicts that violate separation of duties controls</p>
          </div>
          <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">Auto-detected</span>
        </div>
        <div className="space-y-2">
          {[
            {conflict:'Finance Approver + Finance Submitter', users:'2 users', risk:'critical', desc:'Users can both create and approve financial transactions - violates COSO and SOX controls'},
            {conflict:'System Admin + Audit Log Access', users:'1 user', risk:'high', desc:'Admin users can modify systems and also control audit logs, creating potential for evidence manipulation'},
            {conflict:'Developer + Production Deploy', users:'3 users', risk:'medium', desc:'Developers with direct production access bypass change management controls'},
          ].map((s,i)=>(
            <div key={i} className={`flex items-start justify-between p-3 rounded-lg border ${s.risk==='critical'?'border-red-200 bg-red-50':s.risk==='high'?'border-orange-200 bg-orange-50':'border-yellow-200 bg-yellow-50'}`}>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs font-semibold ${s.risk==='critical'?'text-red-700':s.risk==='high'?'text-orange-700':'text-yellow-700'}`}>{s.conflict}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${s.risk==='critical'?'bg-red-100 text-red-600':s.risk==='high'?'bg-orange-100 text-orange-600':'bg-yellow-100 text-yellow-600'}`}>{s.risk}</span>
                </div>
                <p className="text-xs text-slate-600">{s.desc}</p>
              </div>
              <div className="flex-shrink-0 ml-4 text-right">
                <p className="text-xs font-medium text-slate-700">{s.users}</p>
                <button className="text-xs text-blue-600 hover:underline mt-1">Review →</button>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 p-3 bg-slate-50 rounded-lg text-xs text-slate-500">
          SoD conflicts are automatically detected based on role assignments. Connect HRIS integrations (Gusto, ADP, BambooHR) for real-time access mapping.
        </div>
      </div>

      {/* Training Campaigns */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Security Training Campaigns</h2>
            <p className="text-xs text-slate-500 mt-0.5">Track completion rates and manage mandatory training assignments</p>
          </div>
          <button className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700">+ New Campaign</button>
        </div>
        <div className="space-y-3">
          {[
            {name:'Annual Security Awareness Training 2026', type:'security_awareness', assigned:48, completed:36, due:'2026-06-30', status:'active'},
            {name:'CMMC Level 2 Compliance Training', type:'compliance', assigned:48, completed:12, due:'2026-05-31', status:'active'},
            {name:'Phishing Simulation Q2 2026', type:'phishing_sim', assigned:48, completed:48, due:'2026-04-30', status:'completed'},
            {name:'Data Handling & CUI Protection', type:'security_awareness', assigned:25, completed:25, due:'2026-03-15', status:'completed'},
          ].map((c,i)=>{
            const pct = c.assigned > 0 ? Math.round(c.completed/c.assigned*100) : 0;
            const overdue = new Date(c.due) < new Date() && c.status === 'active';
            return (
              <div key={i} className={`border rounded-xl p-4 ${overdue?'border-red-200 bg-red-50':c.status==='completed'?'border-green-200 bg-green-50':'border-slate-200'}`}>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{c.name}</p>
                    <p className="text-xs text-slate-400 capitalize">{c.type.replace(/_/g,' ')} · Due {new Date(c.due).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {overdue&&<span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">Overdue</span>}
                    <span className={`text-xs px-2 py-0.5 rounded-full ${c.status==='completed'?'bg-green-100 text-green-700':'bg-blue-100 text-blue-700'}`}>{c.status==='completed'?'Completed':'Active'}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 bg-slate-200 rounded-full h-2">
                    <div className={`h-2 rounded-full ${pct===100?'bg-green-500':pct>=50?'bg-blue-500':'bg-orange-500'}`} style={{width:pct+'%'}}/>
                  </div>
                  <span className="text-xs font-semibold text-slate-700 flex-shrink-0">{c.completed}/{c.assigned} ({pct}%)</span>
                  {c.status==='active'&&<button className="text-xs text-blue-600 hover:underline flex-shrink-0">Send Reminder</button>}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3 text-center">
          {[
            {label:'Overall Completion', val:'82%', color:'text-blue-700'},
            {label:'Overdue Completions', val:'12', color:'text-red-700'},
            {label:'Certificates Issued', val:'73', color:'text-green-700'},
          ].map(m=>(
            <div key={m.label} className="bg-slate-50 rounded-lg p-3 border border-slate-200">
              <p className="text-xs text-slate-500">{m.label}</p>
              <p className={`text-xl font-bold mt-1 ${m.color}`}>{m.val}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Bulk Policy Acknowledgment Campaign */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Bulk Policy Acknowledgment Campaigns</h2>
            <p className="text-xs text-slate-500 mt-0.5">Assign multiple policies to groups of people and track completion</p>
          </div>
          <button className="text-xs bg-purple-600 text-white px-3 py-1.5 rounded-lg hover:bg-purple-700">+ New Campaign</button>
        </div>
        <div className="space-y-3">
          {[
            {name:'Annual Policy Acknowledgment 2026', policies:['Acceptable Use', 'Security Awareness', 'Data Classification', '+7 more'], assigned:48, completed:35, due:'2026-06-15'},
            {name:'New Employee Onboarding Acks', policies:['Code of Conduct', 'IT Acceptable Use', 'Privacy Policy'], assigned:8, completed:6, due:'2026-05-20'},
          ].map((c,i)=>{
            const pct = c.assigned > 0 ? Math.round(c.completed/c.assigned*100) : 0;
            return (
              <div key={i} className="border border-slate-200 rounded-xl p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{c.name}</p>
                    <p className="text-xs text-slate-400">Policies: {c.policies.join(' · ')} · Due {new Date(c.due).toLocaleDateString()}</p>
                  </div>
                  <button className="text-xs text-blue-600 hover:underline flex-shrink-0 ml-4">Send Reminder</button>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 bg-slate-200 rounded-full h-2">
                    <div className={`h-2 rounded-full ${pct===100?'bg-green-500':pct>=50?'bg-purple-500':'bg-orange-500'}`} style={{width:pct+'%'}}/>
                  </div>
                  <span className="text-xs font-semibold text-slate-700">{c.completed}/{c.assigned} ({pct}%)</span>
                </div>
              </div>
            );
          })}
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

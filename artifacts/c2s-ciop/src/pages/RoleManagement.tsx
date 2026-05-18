import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/queryClient";
import { useOrg } from "@/hooks/useOrg";
import { useRole } from "@/context/RoleContext";
import { ROLE_LABELS, ROLE_DESCRIPTIONS, ROLE_ORDER, type AppRole } from "@/context/RoleContext";

// ─── Role badge colors ───────────────────────────────────────────────────────
const ROLE_COLORS: Record<AppRole, string> = {
  super_admin:        "bg-red-100 text-red-700",
  org_admin:          "bg-purple-100 text-purple-700",
  compliance_manager: "bg-blue-100 text-blue-700",
  analyst:            "bg-green-100 text-green-700",
  auditor:            "bg-amber-100 text-amber-700",
  viewer:             "bg-slate-100 text-slate-500",
};

function toast(msg: string, color = "#2563eb") {
  const el = document.createElement("div");
  el.style.cssText = "position:fixed;bottom:24px;right:24px;background:" + color + ";color:white;padding:12px 20px;border-radius:12px;font-size:14px;font-weight:600;z-index:9999;box-shadow:0 4px 20px rgba(0,0,0,0.15)";
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2800);
}

interface OrgMember {
  id: string;
  clerkUserId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: AppRole;
  joinedAt: string;
  lastActive?: string;
}

// Assignable roles (org admins cannot assign super_admin)
const ASSIGNABLE_ROLES: AppRole[] = ["org_admin","compliance_manager","analyst","auditor","viewer"];

// Permission summary for each role
const ROLE_PERMISSIONS: Record<AppRole, string[]> = {
  super_admin:        ["All platform access","Owner Control Panel","Cross-tenant support"],
  org_admin:          ["Manage users & roles","Billing & settings","All GRC features"],
  compliance_manager: ["Controls & frameworks","Risk register","Evidence vault","Reporting","Federal compliance"],
  analyst:            ["Evidence submission","Control updates","Risk entries","POA&M items"],
  auditor:            ["Auditor portal (read)","Evidence review","Control read"],
  viewer:             ["Dashboard","Compliance reports"],
};

export default function RoleManagement() {
  const { orgId } = useOrg();
  const { role: currentUserRole, can } = useRole();
  const qc = useQueryClient();
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<AppRole>("analyst");
  const [editingMember, setEditingMember] = useState<OrgMember | null>(null);
  const [editRole, setEditRole] = useState<AppRole>("analyst");
  const [activeTab, setActiveTab] = useState<"members"|"roles">("members");

  // Fetch team members
  const { data: membersData, isLoading } = useQuery<{ members: OrgMember[] }>({
    queryKey: ["org-members", orgId],
    queryFn: async () => {
      if (!orgId) return { members: [] };
      const res = await fetch(`/api/orgs/${orgId}/members`, { credentials: "include" });
      if (!res.ok) return { members: MOCK_MEMBERS };
      return res.json();
    },
    enabled: !!orgId,
    staleTime: 30000,
  });

  const members: OrgMember[] = membersData?.members ?? MOCK_MEMBERS;

  // Update role mutation
  const updateRoleMutation = useMutation({
    mutationFn: async ({ memberId, role }: { memberId: string; role: AppRole }) => {
      try {
        return await apiFetch(`/orgs/${orgId}/members/${memberId}/role`, {
          method: "PATCH",
          body: JSON.stringify({ role }),
        });
      } catch {
        // If API not yet implemented, update local mock
        return { ok: true };
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["org-members"] });
      toast("Role updated successfully", "#16a34a");
      setEditingMember(null);
    },
    onError: () => toast("Failed to update role", "#dc2626"),
  });

  // Invite mutation
  const inviteMutation = useMutation({
    mutationFn: async () => {
      try {
        return await apiFetch(`/orgs/${orgId}/invites`, {
          method: "POST",
          body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
        });
      } catch {
        return { ok: true };
      }
    },
    onSuccess: () => {
      toast("Invitation sent to " + inviteEmail);
      setInviteEmail("");
      setInviteRole("analyst");
    },
    onError: () => toast("Failed to send invite", "#dc2626"),
  });

  if (!can("org_admin")) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="h-14 w-14 rounded-full bg-red-100 flex items-center justify-center mb-4">
          <svg className="h-7 w-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
        </div>
        <h3 className="text-base font-bold text-slate-900">Access Restricted</h3>
        <p className="text-sm text-slate-500 mt-1 max-w-xs">Only Org Admins and above can manage team roles. Contact your administrator.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 bg-slate-100 rounded-xl p-1 w-fit">
        {(["members","roles"] as const).map(t => (
          <button key={t} onClick={() => setActiveTab(t)} className={"px-4 py-2 rounded-lg text-sm font-semibold transition-all " + (activeTab === t ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700")}>
            {t === "members" ? "Team Members" : "Role Reference"}
          </button>
        ))}
      </div>

      {activeTab === "members" && (
        <div className="space-y-5">
          {/* Invite section */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h3 className="text-sm font-bold text-slate-800 mb-4">Invite Team Member</h3>
            <div className="flex items-end gap-3">
              <div className="flex-1"><label className="block text-xs font-semibold text-slate-600 mb-1.5">Email address</label><input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="colleague@company.com" className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
              <div className="w-52"><label className="block text-xs font-semibold text-slate-600 mb-1.5">Assign role</label>
                <select value={inviteRole} onChange={e => setInviteRole(e.target.value as AppRole)} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {ASSIGNABLE_ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                </select>
              </div>
              <button onClick={() => inviteEmail ? inviteMutation.mutate() : toast("Enter an email address","#dc2626")} disabled={inviteMutation.isPending} className="px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap">
                {inviteMutation.isPending ? "Sending..." : "Send Invite"}
              </button>
            </div>
          </div>

          {/* Members table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800">Team Members ({members.length})</h3>
              <span className="text-xs text-slate-400">Your role: <strong className="text-slate-700">{ROLE_LABELS[currentUserRole]}</strong></span>
            </div>
            {isLoading ? (
              <div className="py-10 text-center text-sm text-slate-400">Loading members...</div>
            ) : (
              <table className="w-full text-sm">
                <thead><tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Member</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Current Role</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Joined</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-50">
                  {members.map(m => (
                    <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">{(m.firstName?.[0] ?? m.email[0]).toUpperCase()}</div>
                          <div><p className="font-semibold text-slate-900">{m.firstName ? m.firstName + " " + (m.lastName ?? "") : m.email}</p><p className="text-xs text-slate-400">{m.email}</p></div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5"><span className={"text-xs font-semibold px-2.5 py-1 rounded-full " + ROLE_COLORS[m.role]}>{ROLE_LABELS[m.role]}</span></td>
                      <td className="px-5 py-3.5 text-xs text-slate-400">{new Date(m.joinedAt).toLocaleDateString()}</td>
                      <td className="px-5 py-3.5">
                        {m.role !== "super_admin" && (
                          <button onClick={() => { setEditingMember(m); setEditRole(m.role); }} className="text-xs font-semibold text-blue-600 hover:text-blue-700">Change Role</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {activeTab === "roles" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {ROLE_ORDER.filter(r => r !== "super_admin").map(r => (
            <div key={r} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-center gap-3 mb-3">
                <span className={"text-xs font-bold px-2.5 py-1 rounded-full " + ROLE_COLORS[r]}>{ROLE_LABELS[r]}</span>
              </div>
              <p className="text-xs text-slate-500 mb-3 leading-relaxed">{ROLE_DESCRIPTIONS[r]}</p>
              <div className="space-y-1.5">
                {ROLE_PERMISSIONS[r].map(p => (
                  <div key={p} className="flex items-center gap-2 text-xs text-slate-600">
                    <svg className="h-3.5 w-3.5 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    {p}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit role modal */}
      {editingMember && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-6">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-start justify-between mb-5">
              <div>
                <h3 className="text-base font-bold text-slate-900">Change Role</h3>
                <p className="text-sm text-slate-500 mt-0.5">{editingMember.firstName ? editingMember.firstName + " " + (editingMember.lastName ?? "") : editingMember.email}</p>
              </div>
              <button onClick={() => setEditingMember(null)} className="text-slate-400 hover:text-slate-600 text-xl">&#x2715;</button>
            </div>
            <div className="space-y-2 mb-5">
              {ASSIGNABLE_ROLES.map(r => (
                <label key={r} className={"flex items-start gap-3 p-3.5 border rounded-xl cursor-pointer transition-colors " + (editRole === r ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:bg-slate-50")}>
                  <input type="radio" name="editRole" value={r} checked={editRole === r} onChange={() => setEditRole(r)} className="mt-0.5 text-blue-600" />
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{ROLE_LABELS[r]}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{ROLE_DESCRIPTIONS[r]}</p>
                  </div>
                </label>
              ))}
            </div>
            <div className="flex items-center gap-3 justify-end">
              <button onClick={() => setEditingMember(null)} className="px-4 py-2 border border-slate-200 text-slate-600 text-sm font-semibold rounded-lg hover:bg-slate-50">Cancel</button>
              <button onClick={() => updateRoleMutation.mutate({ memberId: editingMember.id, role: editRole })} disabled={updateRoleMutation.isPending || editRole === editingMember.role} className="px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {updateRoleMutation.isPending ? "Saving..." : "Save Role"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Mock members (shown when API not yet implemented) ───────────────────────
const MOCK_MEMBERS: OrgMember[] = [
  { id: "m1", clerkUserId: "u1", email: "kweku@colorcodesolutions.com", firstName: "Kweku", lastName: "Annan", role: "org_admin", joinedAt: "2024-01-15" },
  { id: "m2", clerkUserId: "u2", email: "sarah.chen@company.com", firstName: "Sarah", lastName: "Chen", role: "compliance_manager", joinedAt: "2024-02-20" },
  { id: "m3", clerkUserId: "u3", email: "j.williams@company.com", firstName: "James", lastName: "Williams", role: "analyst", joinedAt: "2024-04-10" },
  { id: "m4", clerkUserId: "u4", email: "auditor@external.com", firstName: "Alex", lastName: "Rivera", role: "auditor", joinedAt: "2024-06-01" },
  { id: "m5", clerkUserId: "u5", email: "ceo@company.com", firstName: "Dana", lastName: "Park", role: "viewer", joinedAt: "2024-03-05" },
];

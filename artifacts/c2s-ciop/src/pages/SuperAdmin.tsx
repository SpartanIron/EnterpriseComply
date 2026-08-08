import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/queryClient";
import { useRole } from "@/context/RoleContext";

// P0-13: MOCK_TENANTS removed — it showed 6 fake organizations (Apex Defense Systems,
// HealthBridge Analytics, etc.) with made-up emails, plans, user counts, and last-active
// dates to every user who opened this panel, regardless of actual platform tenants.
// ADMIN_EMAILS removed — it was a hardcoded allow-list that could be bypassed by
// any user who saw the source code; auth now uses the session role from the DB.
//
// Real data: GET /api/orgs/admin — requires super_admin role in org_members.
// Only users with that DB role in any org can view this panel.

interface AdminOrg {
  id: number;
  name: string;
  slug: string;
  industry: string | null;
  size: string | null;
  website: string | null;
  onboardingComplete: boolean;
  memberCount: number;
  createdAt: string;
}

function toast(msg: string, color = "#2563eb") {
  const el = document.createElement("div");
  el.style.cssText = `position:fixed;bottom:24px;right:24px;background:${color};color:white;padding:12px 20px;border-radius:12px;font-size:14px;font-weight:600;z-index:9999;box-shadow:0 4px 20px rgba(0,0,0,0.15)`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2800);
}

const EmptyState = ({ title, body }: { title: string; body: string }) => (
  <div className="bg-white rounded-xl border border-slate-200 p-16 flex flex-col items-center text-center">
    <div className="h-12 w-12 rounded-full bg-slate-50 flex items-center justify-center mb-4">
      <svg className="h-6 w-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
    </div>
    <p className="text-sm font-bold text-slate-800 mb-2">{title}</p>
    <p className="text-xs text-slate-500 max-w-sm leading-relaxed">{body}</p>
  </div>
);

type Tab = "tenants" | "onboard" | "billing" | "platform" | "support";
const TABS: { id: Tab; label: string }[] = [
  { id: "tenants", label: "Tenant Management" },
  { id: "onboard", label: "Onboard New Client" },
  { id: "billing", label: "Billing & Licenses" },
  { id: "platform", label: "Platform Health" },
  { id: "support", label: "Support Access" },
];

export default function SuperAdmin() {
  const { role, can } = useRole();
  const [activeTab, setActiveTab] = useState<Tab>("tenants");
  const [search, setSearch] = useState("");
  const [onboardForm, setOnboardForm] = useState({ name: "", industry: "", size: "", website: "" });

  // Access control: must have super_admin role (verified server-side at the API level too)
  if (!can("super_admin")) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="h-14 w-14 rounded-full bg-red-100 flex items-center justify-center mb-4">
          <svg className="h-7 w-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
        </div>
        <h3 className="text-base font-bold text-slate-900">Super Admin Access Required</h3>
        <p className="text-sm text-slate-500 mt-1 max-w-xs">Only platform super admins can access the Owner Control Panel. Your current role: <strong>{role}</strong>.</p>
      </div>
    );
  }

  const { data, isLoading, isError, refetch } = useQuery<{ orgs: AdminOrg[] }>({
    queryKey: ["admin-orgs"],
    queryFn: () => apiFetch("/orgs/admin"),
    staleTime: 30_000,
  });

  const orgs = data?.orgs ?? [];
  const filtered = orgs.filter(o =>
    o.name.toLowerCase().includes(search.toLowerCase()) ||
    (o.industry ?? "").toLowerCase().includes(search.toLowerCase()) ||
    o.slug.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-xs font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">SUPER ADMIN</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Owner Control Panel</h1>
          <p className="text-sm text-slate-500 mt-1">Platform-level tenant management and operational oversight</p>
        </div>
        <button onClick={() => refetch()} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border border-slate-200 text-slate-600 bg-white hover:bg-slate-50">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "Total Tenants", value: isLoading ? "—" : orgs.length, color: "#2563eb" },
          { label: "Total Members", value: isLoading ? "—" : orgs.reduce((s, o) => s + o.memberCount, 0), color: "#22c55e" },
          { label: "Onboarded", value: isLoading ? "—" : orgs.filter(o => o.onboardingComplete).length, color: "#7c3aed" },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl p-5 border border-slate-200">
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">{s.label}</p>
            <p className="text-3xl font-extrabold mt-1" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-slate-200">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} className="px-4 py-2.5 text-sm font-semibold transition-colors border-b-2 -mb-px" style={{ borderColor: activeTab === t.id ? "#2563eb" : "transparent", color: activeTab === t.id ? "#2563eb" : "#64748b" }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tenant Management */}
      {activeTab === "tenants" && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="relative flex-1">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, industry, or slug…" className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          {isLoading ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-sm text-slate-400">Loading tenants…</div>
          ) : isError ? (
            <div className="bg-white rounded-xl border border-red-200 p-12 text-center text-sm text-red-500">Failed to load tenants. Confirm your session has super_admin role.</div>
          ) : orgs.length === 0 ? (
            <EmptyState title="No tenants found" body="No organizations are registered in the database yet." />
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead><tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Organization</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Industry</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Size</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Members</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Status</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Created</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map(org => (
                    <tr key={org.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3.5">
                        <div>
                          <p className="font-semibold text-slate-900">{org.name}</p>
                          <p className="text-xs text-slate-400 font-mono">{org.slug}</p>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-slate-600">{org.industry ?? <span className="text-slate-300">—</span>}</td>
                      <td className="px-5 py-3.5 text-sm text-slate-600">{org.size ?? <span className="text-slate-300">—</span>}</td>
                      <td className="px-5 py-3.5 text-sm text-slate-600 text-right font-mono">{org.memberCount}</td>
                      <td className="px-5 py-3.5">
                        {org.onboardingComplete
                          ? <span className="text-xs font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">Active</span>
                          : <span className="text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">Onboarding</span>
                        }
                      </td>
                      <td className="px-5 py-3.5 text-xs text-slate-400">{new Date(org.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length === 0 && search && (
                <div className="py-8 text-center text-sm text-slate-400">No tenants match "{search}"</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Onboard New Client */}
      {activeTab === "onboard" && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 max-w-2xl">
          <h3 className="text-base font-bold text-slate-900 mb-1">Onboard New Client Organization</h3>
          <p className="text-sm text-slate-500 mb-5">Creates a new organization in the platform. The client's admin user must sign up separately and will be linked on first login.</p>
          <div className="space-y-4">
            {[
              { label: "Organization Name *", field: "name", type: "text", placeholder: "e.g. Acme Federal" },
              { label: "Website", field: "website", type: "url", placeholder: "https://acme.gov" },
            ].map(({ label, field, type, placeholder }) => (
              <div key={field}>
                <label className="block text-xs font-semibold text-slate-600 mb-1">{label}</label>
                <input type={type} value={(onboardForm as any)[field]} onChange={e => setOnboardForm(p => ({ ...p, [field]: e.target.value }))} placeholder={placeholder} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            ))}
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: "Industry", field: "industry", options: ["Technology", "Defense", "Healthcare", "Finance", "Government", "Manufacturing", "Energy", "Education", "Other"] },
                { label: "Organization Size", field: "size", options: ["1–10", "11–50", "51–200", "201–500", "501–1000", "1000+"] },
              ].map(({ label, field, options }) => (
                <div key={field}>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">{label}</label>
                  <select value={(onboardForm as any)[field]} onChange={e => setOnboardForm(p => ({ ...p, [field]: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Select…</option>
                    {options.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              ))}
            </div>
            <div className="flex justify-end pt-2">
              <button
                onClick={() => {
                  if (!onboardForm.name.trim()) { toast("Organization name is required", "#dc2626"); return; }
                  toast("Creating organization…");
                  apiFetch("/orgs", { method: "POST", body: JSON.stringify(onboardForm) })
                    .then(() => { toast("Organization created successfully", "#16a34a"); refetch(); setActiveTab("tenants"); setOnboardForm({ name: "", industry: "", size: "", website: "" }); })
                    .catch(() => toast("Failed to create organization", "#dc2626"));
                }}
                className="px-6 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
              >
                Create Organization
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === "billing" && (
        <EmptyState title="Billing data not available" body="Subscription plans, license counts, and contract data are managed externally. No billing API is connected to this panel." />
      )}

      {activeTab === "platform" && (
        <EmptyState title="Platform metrics not available" body="Uptime, API latency, and infrastructure health metrics require a monitoring integration (Datadog, PagerDuty, etc.). No monitoring API is connected to this panel." />
      )}

      {activeTab === "support" && (
        <EmptyState title="Support access not available" body="User impersonation for support requires a dedicated audit-safe access mechanism. This feature is not yet implemented. Use direct database access (read-only) for support investigations." />
      )}
    </div>
  );
}

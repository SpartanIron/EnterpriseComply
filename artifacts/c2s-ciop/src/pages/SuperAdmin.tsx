import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/queryClient";
import { useRole } from "@/context/RoleContext";

// P0-13: MOCK_TENANTS removed — it showed 6 fake organizations (Apex Defense Systems,
// HealthBridge Analytics, etc.) with made-up emails, plans, user counts, and last-active
// dates to every user who opened this panel, regardless of actual platform tenants.
// ADMIN_EMAILS removed — it was a hardcoded allow-list that could be bypassed by
// any user who saw the source code; auth now uses the session role from the DB.
//
// Real data: GET /api/orgs/admin. Access is decided by GET /api/platform/me:
// a row in platform_admins plus a live, time-boxed elevation. The tenant role is
// deliberately not consulted, because platform staff are not org members.

interface BlockedIp {
  ip: string;
  failureCount: number;
  blockedUntil: string;
  secondsRemaining: number;
}

interface MagicLinkThrottle {
  ip: string;
  requestCount: number;
  windowStart: string;
  blockedUntil: string | null;
  secondsRemaining: number;
}

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
  plan: string;
}

interface CrosswalkRow {
  id: number;
  ucoControlId: string;
  title: string;
  domain: string | null;
  nist80053: string | null;
  cmmc: string | null;
  nist800171: string | null;
  soc2: string | null;
  iso27001: string | null;
  fedramp: string | null;
  hipaa: string | null;
  remediationSteps: string | null;
  updatedAt: string;
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

type Tab = "tenants" | "onboard" | "billing" | "platform" | "security" | "support" | "crosswalk";
const TABS: { id: Tab; label: string }[] = [
  { id: "tenants", label: "Tenant Management" },
  { id: "onboard", label: "Onboard New Client" },
  { id: "billing", label: "Billing & Licenses" },
  { id: "platform", label: "Platform Health" },
  { id: "security", label: "Security" },
  { id: "support", label: "Support Access" },
  { id: "crosswalk", label: "Crosswalk Mappings" },
];


interface PlatformMe {
  isPlatformAdmin: boolean;
  elevation: {
    id: number;
    reason: string;
    requestedAt: string;
    expiresAt: string;
  } | null;
  maxElevationMs?: number;
  minReasonLength?: number;
}

/**
 * Break-glass prompt.
 *
 * Deliberately not a silent auto-elevate. The reason box and the authenticator
 * code are the control: they make privileged access a decision somebody made and
 * recorded, rather than an ambient property of being on a list.
 */
function ElevationPrompt({ onElevated }: { onElevated: () => void }) {
  const [reason, setReason] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch("/api/platform/elevate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason, code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.message ?? "Elevation was refused.");
        return;
      }
      onElevated();
    } catch {
      setError("Elevation could not be requested. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto py-16">
      <div className="bg-white rounded-xl border border-amber-300 shadow-sm">
        <div className="px-5 py-3.5 border-b border-amber-200 bg-amber-50 rounded-t-xl">
          <h2 className="text-sm font-bold text-amber-900">Break-glass access required</h2>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-sm text-slate-600">
            Platform access is not standing. Give a reason and a code from your
            authenticator app to open a one-hour elevation. Both are written to the
            audit log, and every action you take while elevated is recorded.
          </p>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="elevation-reason">
              Reason
            </label>
            <textarea
              id="elevation-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="e.g. investigating ticket 4471, customer reports missing evidence"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="elevation-code">
              Authenticator code
            </label>
            <input
              id="elevation-code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/[^0-9A-Za-z-]/g, ""))}
              inputMode="text"
              autoComplete="one-time-code"
              placeholder="000000 or a backup code"
              className="w-40 rounded-lg border border-slate-300 px-3 py-2 text-sm tracking-widest"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="button"
            onClick={submit}
            disabled={busy || reason.trim().length < 12 || code.trim().length < 6}
            className="px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-semibold disabled:opacity-50"
          >
            {busy ? "Opening..." : "Open a one-hour elevation"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SuperAdmin() {
  const { role } = useRole();
  // Platform status comes from the API, never from the tenant role. Polled on a
  // short interval so an elevation that expires while the panel is open takes the
  // UI back to the break-glass prompt instead of leaving a dead screen.
  const {
    data: platform,
    isLoading: platformLoading,
    refetch: refetchPlatform,
  } = useQuery<PlatformMe>({
    queryKey: ["platform-me"],
    queryFn: async () => (await apiFetch("/api/platform/me")).json(),
    refetchInterval: 60_000,
  });

  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>("tenants");
  const [search, setSearch] = useState("");
  const [onboardForm, setOnboardForm] = useState({ name: "", industry: "", size: "", website: "" });

  const { data, isLoading, isError, refetch } = useQuery<{ orgs: AdminOrg[] }>({
    queryKey: ["admin-orgs"],
    queryFn: () => apiFetch("/orgs/admin"),
    staleTime: 30_000,
  });

  const blockedLastFetchedRef = useRef<number | null>(null);
  const [blockedSecAgo, setBlockedSecAgo] = useState<number | null>(null);

  const { data: blockedData, isLoading: blockedLoading, isError: blockedError, refetch: refetchBlocked, dataUpdatedAt: blockedDataUpdatedAt } = useQuery<{ blocked: BlockedIp[]; magicLinkThrottles: MagicLinkThrottle[] }>({
    queryKey: ["admin-rate-limits"],
    queryFn: () => apiFetch("/admin/rate-limits"),
    staleTime: 15_000,
    refetchInterval: activeTab === "security" ? 30_000 : false,
  });

  // Track last successful fetch time and update "X sec ago" every second
  useEffect(() => {
    if (blockedDataUpdatedAt && blockedDataUpdatedAt > 0) {
      blockedLastFetchedRef.current = blockedDataUpdatedAt;
      setBlockedSecAgo(0);
    }
  }, [blockedDataUpdatedAt]);

  useEffect(() => {
    if (blockedLastFetchedRef.current === null) return;
    const id = setInterval(() => {
      if (blockedLastFetchedRef.current !== null) {
        setBlockedSecAgo(Math.floor((Date.now() - blockedLastFetchedRef.current) / 1000));
      }
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // Access control. Platform staff are no longer org members, so the tenant role
  // can no longer answer this question - it is asked of the API instead, and the
  // API is authoritative regardless of what this component renders.
  //
  // Two distinct states, because they need two different answers: not staff at
  // all, or staff without a live elevation.
  if (platformLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  if (!platform?.isPlatformAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="h-14 w-14 rounded-full bg-red-100 flex items-center justify-center mb-4">
          <svg className="h-7 w-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
        </div>
        <h3 className="text-base font-bold text-slate-900">Platform Administrator Access Required</h3>
        <p className="text-sm text-slate-500 mt-1 max-w-sm">
          The Owner Control Panel is restricted to platform administrators. This is
          separate from your role in this organisation, which is <strong>{role}</strong>.
        </p>
      </div>
    );
  }

  if (!platform.elevation) {
    return <ElevationPrompt onElevated={() => refetchPlatform()} />;
  }


  const unblockMutation = useMutation({
    mutationFn: (ip: string) =>
      apiFetch(`/admin/rate-limits/${encodeURIComponent(ip)}`, { method: "DELETE" }),
    onSuccess: (_data, ip) => {
      toast(`Unblocked ${ip}`, "#16a34a");
      qc.invalidateQueries({ queryKey: ["admin-rate-limits"] });
    },
    onError: (_err, ip) => {
      toast(`Failed to unblock ${ip}`, "#dc2626");
    },
  });

  const clearThrottleMutation = useMutation({
    mutationFn: (ip: string) =>
      apiFetch(`/admin/magic-link-rate/${encodeURIComponent(ip)}`, { method: "DELETE" }),
    onSuccess: (_data, ip) => {
      toast(`Cleared throttle window for ${ip}`, "#16a34a");
      qc.invalidateQueries({ queryKey: ["admin-rate-limits"] });
    },
    onError: (_err, ip) => {
      toast(`Failed to clear throttle for ${ip}`, "#dc2626");
    },
  });

  const planMutation = useMutation({
    mutationFn: ({ orgId, plan }: { orgId: number; plan: string }) =>
      apiFetch(`/admin/orgs/${orgId}/plan`, { method: "PATCH", body: JSON.stringify({ plan }) }),
    onSuccess: (_data, { plan }) => {
      toast(`Plan updated to ${plan}`, "#16a34a");
      qc.invalidateQueries({ queryKey: ["admin-orgs"] });
    },
    onError: () => toast("Failed to update plan", "#dc2626"),
  });

  // ── Crosswalk Mappings ────────────────────────────────────────────────────────
  const [editingCrosswalk, setEditingCrosswalk] = useState<CrosswalkRow | null>(null);
  const [crosswalkForm, setCrosswalkForm] = useState<Partial<CrosswalkRow>>({});
  const [cwSearch, setCwSearch] = useState("");

  const { data: crosswalkData, isLoading: cwLoading, isError: cwError, refetch: refetchCrosswalk } = useQuery<{ crosswalk: CrosswalkRow[] }>({
    queryKey: ["admin-crosswalk"],
    queryFn: () => apiFetch("/admin/crosswalk"),
    staleTime: 30_000,
    enabled: activeTab === "crosswalk",
  });

  const crosswalkMutation = useMutation({
    mutationFn: ({ ucoControlId, body }: { ucoControlId: string; body: Partial<CrosswalkRow> }) =>
      apiFetch(`/admin/crosswalk/${encodeURIComponent(ucoControlId)}`, {
        method: "PUT",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      toast("Crosswalk mapping saved", "#16a34a");
      setEditingCrosswalk(null);
      setCrosswalkForm({});
      qc.invalidateQueries({ queryKey: ["admin-crosswalk"] });
      qc.invalidateQueries({ queryKey: ["crosswalk-controls"] });
    },
    onError: () => toast("Failed to save crosswalk mapping", "#dc2626"),
  });

  const crosswalkRows = crosswalkData?.crosswalk ?? [];
  const filteredCrosswalk = crosswalkRows.filter(r =>
    r.ucoControlId.toLowerCase().includes(cwSearch.toLowerCase()) ||
    r.title.toLowerCase().includes(cwSearch.toLowerCase()) ||
    (r.domain ?? "").toLowerCase().includes(cwSearch.toLowerCase())
  );

  const orgs = data?.orgs ?? [];
  const blocked = blockedData?.blocked ?? [];
  const magicLinkThrottles = blockedData?.magicLinkThrottles ?? [];
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
            <div className="bg-white rounded-xl border border-red-200 p-12 text-center text-sm text-red-500">Failed to load tenants. Confirm your elevation is still live.</div>
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
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Plan</th>
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
                      <td className="px-5 py-3.5">
                        <select
                          value={org.plan ?? "starter"}
                          onChange={e => planMutation.mutate({ orgId: org.id, plan: e.target.value })}
                          className="text-xs font-semibold px-2 py-1 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          {["starter","professional","enterprise","federal"].map(p => (
                            <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                          ))}
                        </select>
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
        <div className="space-y-6">
          {/* Plan Distribution Summary */}
          <div>
            <h3 className="text-base font-bold text-slate-900 mb-4">Plan Distribution</h3>
            <div className="grid grid-cols-4 gap-4">
              {[
                { tier: "federal", label: "Federal", bg: "bg-purple-50", border: "border-purple-200", text: "text-purple-700", badge: "bg-purple-100 text-purple-700" },
                { tier: "enterprise", label: "Enterprise", bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700", badge: "bg-blue-100 text-blue-700" },
                { tier: "professional", label: "Professional", bg: "bg-green-50", border: "border-green-200", text: "text-green-700", badge: "bg-green-100 text-green-700" },
                { tier: "starter", label: "Starter", bg: "bg-slate-50", border: "border-slate-200", text: "text-slate-700", badge: "bg-slate-100 text-slate-600" },
              ].map(({ tier, label, bg, border, text, badge }) => {
                const count = orgs.filter(o => (o.plan ?? "starter") === tier).length;
                return (
                  <div key={tier} className={`rounded-xl p-5 border ${bg} ${border}`}>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${badge}`}>{label}</span>
                    <p className={`text-3xl font-extrabold mt-3 ${text}`}>{isLoading ? "—" : count}</p>
                    <p className="text-xs text-slate-500 mt-0.5 font-medium">
                      {isLoading || orgs.length === 0 ? "" : `${Math.round((count / orgs.length) * 100)}% of tenants`}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Plan-by-Org Table */}
          <div>
            <h3 className="text-base font-bold text-slate-900 mb-4">Tenant Plan Management</h3>
            {isLoading ? (
              <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-sm text-slate-400">Loading tenants…</div>
            ) : isError ? (
              <div className="bg-white rounded-xl border border-red-200 p-12 text-center text-sm text-red-500">Failed to load tenant data.</div>
            ) : orgs.length === 0 ? (
              <EmptyState title="No tenants found" body="No organizations are registered in the database yet." />
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-left px-5 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Organization</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Current Plan</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Change Plan</th>
                      <th className="text-right px-5 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Members</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {orgs.map(org => {
                      const plan = org.plan ?? "starter";
                      const planBadge: Record<string, string> = {
                        federal: "bg-purple-100 text-purple-700",
                        enterprise: "bg-blue-100 text-blue-700",
                        professional: "bg-green-100 text-green-700",
                        starter: "bg-slate-100 text-slate-600",
                      };
                      return (
                        <tr key={org.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-5 py-3.5">
                            <div>
                              <p className="font-semibold text-slate-900">{org.name}</p>
                              <p className="text-xs text-slate-400 font-mono">{org.slug}</p>
                            </div>
                          </td>
                          <td className="px-5 py-3.5">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${planBadge[plan] ?? planBadge.starter}`}>
                              {plan.charAt(0).toUpperCase() + plan.slice(1)}
                            </span>
                          </td>
                          <td className="px-5 py-3.5">
                            <select
                              value={plan}
                              onChange={e => planMutation.mutate({ orgId: org.id, plan: e.target.value })}
                              className="text-xs font-semibold px-2 py-1 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              {["starter","professional","enterprise","federal"].map(p => (
                                <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-5 py-3.5 text-sm text-slate-600 text-right font-mono">{org.memberCount}</td>
                          <td className="px-5 py-3.5">
                            {org.onboardingComplete
                              ? <span className="text-xs font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">Active</span>
                              : <span className="text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">Onboarding</span>
                            }
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "platform" && (
        <EmptyState title="Platform metrics not available" body="Uptime, API latency, and infrastructure health metrics require a monitoring integration (Datadog, PagerDuty, etc.). No monitoring API is connected to this panel." />
      )}

      {activeTab === "security" && (
        <div className="space-y-8">
          {/* ── Auth-failure blocked IPs ─────────────────────────────────── */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Blocked IPs — Auth Failures</h3>
                <p className="text-sm text-slate-500 mt-0.5">IPs blocked after repeated login failures (NIST AC-7). Click Unblock to clear immediately.</p>
              </div>
              <button onClick={() => refetchBlocked()} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold border border-slate-200 text-slate-600 bg-white hover:bg-slate-50">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                Refresh
              </button>
            </div>

            {blockedLoading ? (
              <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-sm text-slate-400">Loading…</div>
            ) : blockedError ? (
              <div className="bg-white rounded-xl border border-red-200 p-12 text-center text-sm text-red-500">Failed to load blocked IPs.</div>
            ) : blocked.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 p-10 flex flex-col items-center text-center">
                <div className="h-10 w-10 rounded-full bg-green-50 flex items-center justify-center mb-3">
                  <svg className="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>
                </div>
                <p className="text-sm font-bold text-slate-800 mb-1">No IPs blocked</p>
                <p className="text-xs text-slate-500">The auth-failure tracker has no active blocks.</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-left px-5 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">IP Address</th>
                      <th className="text-right px-5 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Failures</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Block Expires</th>
                      <th className="text-right px-5 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Remaining</th>
                      <th className="px-5 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {blocked.map(entry => (
                      <tr key={entry.ip} className="hover:bg-slate-50 transition-colors">
                        <td className="px-5 py-3.5 font-mono text-sm text-slate-900">{entry.ip}</td>
                        <td className="px-5 py-3.5 text-right">
                          <span className="text-xs font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded-full">{entry.failureCount}</span>
                        </td>
                        <td className="px-5 py-3.5 text-sm text-slate-600">{new Date(entry.blockedUntil).toLocaleString()}</td>
                        <td className="px-5 py-3.5 text-right text-sm text-slate-600 font-mono">
                          {entry.secondsRemaining >= 60 ? `${Math.ceil(entry.secondsRemaining / 60)}m` : `${entry.secondsRemaining}s`}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <button
                            disabled={unblockMutation.isPending}
                            onClick={() => unblockMutation.mutate(entry.ip)}
                            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors disabled:opacity-50"
                          >
                            Unblock
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {blockedData && blockedSecAgo !== null && (
              <p data-testid="blocked-ips-last-updated" className="mt-2 text-xs text-slate-400">
                Updated {blockedSecAgo} sec ago
              </p>
            )}
          </div>

          {/* ── Magic-link active throttle windows ───────────────────────── */}
          <div>
            <div className="mb-4">
              <h3 className="text-base font-bold text-slate-900">Active Throttle Windows — Magic Link</h3>
              <p className="text-sm text-slate-500 mt-0.5">IPs in an active magic-link send window (5 req/min limit). Blocked rows are highlighted.</p>
            </div>

            {blockedLoading ? (
              <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-sm text-slate-400">Loading…</div>
            ) : blockedError ? (
              <div className="bg-white rounded-xl border border-red-200 p-12 text-center text-sm text-red-500">Failed to load throttle windows.</div>
            ) : magicLinkThrottles.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 p-10 flex flex-col items-center text-center">
                <div className="h-10 w-10 rounded-full bg-green-50 flex items-center justify-center mb-3">
                  <svg className="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>
                </div>
                <p className="text-sm font-bold text-slate-800 mb-1">No active throttle windows</p>
                <p className="text-xs text-slate-500">No IPs are in an active magic-link rate-limit window right now.</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-left px-5 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">IP Address</th>
                      <th className="text-right px-5 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Requests</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Window Start</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Status</th>
                      <th className="text-right px-5 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Block Remaining</th>
                      <th className="px-5 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {magicLinkThrottles.map(entry => (
                      <tr key={entry.ip} className={`transition-colors ${entry.blockedUntil ? "bg-red-50 hover:bg-red-100" : "hover:bg-slate-50"}`}>
                        <td className="px-5 py-3.5 font-mono text-sm text-slate-900">{entry.ip}</td>
                        <td className="px-5 py-3.5 text-right">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${entry.requestCount >= 5 ? "text-red-700 bg-red-100" : "text-amber-700 bg-amber-100"}`}>
                            {entry.requestCount}/5
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-sm text-slate-600">{new Date(entry.windowStart).toLocaleString()}</td>
                        <td className="px-5 py-3.5">
                          {entry.blockedUntil
                            ? <span className="text-xs font-semibold text-red-700 bg-red-100 px-2 py-0.5 rounded-full">Blocked until {new Date(entry.blockedUntil).toLocaleTimeString()}</span>
                            : <span className="text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">Active window</span>
                          }
                        </td>
                        <td className="px-5 py-3.5 text-right text-sm text-slate-600 font-mono">
                          {entry.secondsRemaining > 0
                            ? (entry.secondsRemaining >= 60 ? `${Math.ceil(entry.secondsRemaining / 60)}m` : `${entry.secondsRemaining}s`)
                            : "—"}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <button
                            disabled={clearThrottleMutation.isPending}
                            onClick={() => clearThrottleMutation.mutate(entry.ip)}
                            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors disabled:opacity-50"
                          >
                            Clear Window
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "support" && (
        <EmptyState title="Support access not available" body="User impersonation for support requires a dedicated audit-safe access mechanism. This feature is not yet implemented. Use direct database access (read-only) for support investigations." />
      )}

      {/* ── Crosswalk Mappings ──────────────────────────────────────────── */}
      {activeTab === "crosswalk" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">Crosswalk Mappings</h3>
              <p className="text-sm text-slate-500 mt-0.5">
                Edit framework mapping overrides for UCO controls. Changes take effect immediately without a code deploy.
                Leave fields empty to fall back to the built-in static data.
              </p>
            </div>
            <button onClick={() => refetchCrosswalk()} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold border border-slate-200 text-slate-600 bg-white hover:bg-slate-50">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              Refresh
            </button>
          </div>

          <div className="flex items-center gap-3">
            <input
              value={cwSearch}
              onChange={e => setCwSearch(e.target.value)}
              placeholder="Search by UCO ID, title, or domain…"
              className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {cwLoading ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-sm text-slate-400">Loading crosswalk data…</div>
          ) : cwError ? (
            <div className="bg-white rounded-xl border border-red-200 p-12 text-center text-sm text-red-500">Failed to load crosswalk mappings.</div>
          ) : crosswalkRows.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
              <p className="text-sm font-bold text-slate-800 mb-2">No DB overrides yet</p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                The crosswalk table is empty. The page uses built-in static data.
                To override a mapping, enter the UCO Control ID below and save.
              </p>
              <div className="mt-6 max-w-sm mx-auto text-left space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">UCO Control ID (e.g. UCO-AC-001)</label>
                  <input
                    value={crosswalkForm.ucoControlId ?? ""}
                    onChange={e => setCrosswalkForm(p => ({ ...p, ucoControlId: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="UCO-AC-001"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Title</label>
                  <input
                    value={crosswalkForm.title ?? ""}
                    onChange={e => setCrosswalkForm(p => ({ ...p, title: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Multi-Factor Authentication"
                  />
                </div>
                <button
                  disabled={!crosswalkForm.ucoControlId || !crosswalkForm.title || crosswalkMutation.isPending}
                  onClick={() => {
                    if (!crosswalkForm.ucoControlId || !crosswalkForm.title) return;
                    crosswalkMutation.mutate({ ucoControlId: crosswalkForm.ucoControlId, body: crosswalkForm });
                  }}
                  className="w-full px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {crosswalkMutation.isPending ? "Saving…" : "Create Override"}
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[800px]">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">UCO Control ID</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Title</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Domain</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">NIST 800-53</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">CMMC</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Updated</th>
                        <th className="px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredCrosswalk.map(row => (
                        <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 font-mono text-xs font-bold text-blue-700">{row.ucoControlId}</td>
                          <td className="px-4 py-3 text-sm text-slate-800">{row.title}</td>
                          <td className="px-4 py-3 text-xs text-slate-500">{row.domain ?? <span className="text-slate-300">—</span>}</td>
                          <td className="px-4 py-3 text-xs font-mono text-slate-600">{row.nist80053 ?? <span className="text-slate-300">—</span>}</td>
                          <td className="px-4 py-3 text-xs font-mono text-slate-600">{row.cmmc ?? <span className="text-slate-300">—</span>}</td>
                          <td className="px-4 py-3 text-xs text-slate-400">{new Date(row.updatedAt).toLocaleDateString()}</td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => { setEditingCrosswalk(row); setCrosswalkForm({ ...row }); }}
                              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors"
                            >
                              Edit
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {filteredCrosswalk.length === 0 && cwSearch && (
                  <div className="py-8 text-center text-sm text-slate-400">No crosswalk rows match "{cwSearch}"</div>
                )}
              </div>

              {/* Inline editor */}
              {editingCrosswalk && (
                <div className="bg-white rounded-xl border border-blue-200 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">Edit: <span className="font-mono text-blue-700">{editingCrosswalk.ucoControlId}</span></h4>
                      <p className="text-xs text-slate-500 mt-0.5">Enter comma-separated values for framework mappings (e.g. "IA-2, IA-2(1)")</p>
                    </div>
                    <button onClick={() => { setEditingCrosswalk(null); setCrosswalkForm({}); }} className="text-xs text-slate-400 hover:text-slate-600">✕ Cancel</button>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { label: "Title", field: "title" as keyof CrosswalkRow },
                      { label: "Domain / Family", field: "domain" as keyof CrosswalkRow },
                      { label: "NIST 800-53 (comma-separated)", field: "nist80053" as keyof CrosswalkRow },
                      { label: "CMMC 2.0 (comma-separated)", field: "cmmc" as keyof CrosswalkRow },
                      { label: "NIST 800-171 (comma-separated)", field: "nist800171" as keyof CrosswalkRow },
                      { label: "SOC 2 TSC (comma-separated)", field: "soc2" as keyof CrosswalkRow },
                      { label: "ISO 27001:2022 (comma-separated)", field: "iso27001" as keyof CrosswalkRow },
                      { label: "FedRAMP High (comma-separated)", field: "fedramp" as keyof CrosswalkRow },
                      { label: "HIPAA §164 (comma-separated)", field: "hipaa" as keyof CrosswalkRow },
                    ].map(({ label, field }) => (
                      <div key={field}>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">{label}</label>
                        <input
                          type="text"
                          value={(crosswalkForm[field] as string) ?? ""}
                          onChange={e => setCrosswalkForm(p => ({ ...p, [field]: e.target.value }))}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    ))}
                    <div className="col-span-2">
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Remediation Steps</label>
                      <textarea
                        rows={3}
                        value={crosswalkForm.remediationSteps ?? ""}
                        onChange={e => setCrosswalkForm(p => ({ ...p, remediationSteps: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                        placeholder="Describe remediation steps for this control…"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-3 mt-4">
                    <button
                      onClick={() => { setEditingCrosswalk(null); setCrosswalkForm({}); }}
                      className="px-4 py-2 text-sm font-semibold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                    <button
                      disabled={crosswalkMutation.isPending}
                      onClick={() => {
                        crosswalkMutation.mutate({
                          ucoControlId: editingCrosswalk.ucoControlId,
                          body: crosswalkForm,
                        });
                      }}
                      className="px-6 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                      {crosswalkMutation.isPending ? "Saving…" : "Save Changes"}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

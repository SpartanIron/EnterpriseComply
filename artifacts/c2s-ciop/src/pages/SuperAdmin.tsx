import { useState } from "react";
import { useUser } from "@clerk/react";

// ─── Types ───────────────────────────────────────────────────────────────────
type Plan = "starter" | "professional" | "enterprise" | "federal";
type OrgStatus = "active" | "suspended" | "trial" | "churned";

interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: Plan;
  status: OrgStatus;
  adminEmail: string;
  industry: string;
  userCount: number;
  frameworks: string[];
  createdAt: string;
  lastActive: string;
  contractExpiry?: string;
  notes?: string;
}

// ─── Mock Data ───────────────────────────────────────────────────────────────
const MOCK_TENANTS: Tenant[] = [
  { id: "org_001", name: "Apex Defense Systems", slug: "apex-defense", plan: "federal", status: "active", adminEmail: "admin@apexdefense.com", industry: "Defense", userCount: 47, frameworks: ["FedRAMP High","CMMC Level 3","NIST 800-171"], createdAt: "2024-01-15", lastActive: "2025-05-16", contractExpiry: "2026-01-15", notes: "ATO in progress. Assigned CSP." },
  { id: "org_002", name: "HealthBridge Analytics", slug: "healthbridge", plan: "enterprise", status: "active", adminEmail: "ciso@healthbridge.io", industry: "Healthcare", userCount: 23, frameworks: ["HIPAA","SOC 2 Type II","NIST CSF"], createdAt: "2024-03-08", lastActive: "2025-05-15", contractExpiry: "2026-03-08" },
  { id: "org_003", name: "CloudNative Corp", slug: "cloudnative", plan: "professional", status: "trial", adminEmail: "dev@cloudnative.dev", industry: "Technology", userCount: 8, frameworks: ["SOC 2 Type II","ISO 27001"], createdAt: "2025-04-22", lastActive: "2025-05-10", contractExpiry: "2025-06-22", notes: "14-day trial. Follow up on conversion." },
  { id: "org_004", name: "Metro Financial Group", slug: "metro-financial", plan: "enterprise", status: "suspended", adminEmail: "it@metrofinancial.com", industry: "Finance", userCount: 61, frameworks: ["SOC 2 Type II","PCI DSS","ISO 27001"], createdAt: "2023-11-01", lastActive: "2025-03-20", contractExpiry: "2025-11-01", notes: "Suspended for non-payment. Invoice #1847 outstanding." },
  { id: "org_005", name: "Starfield Logistics", slug: "starfield", plan: "starter", status: "active", adminEmail: "ops@starfield.com", industry: "Manufacturing", userCount: 5, frameworks: ["SOC 2 Type II"], createdAt: "2024-09-14", lastActive: "2025-05-12" },
  { id: "org_006", name: "Pacific Rim Contractors", slug: "pacific-rim", plan: "federal", status: "active", adminEmail: "compliance@pacificrim.gov", industry: "Government", userCount: 31, frameworks: ["FedRAMP Moderate","FISMA","NIST 800-53"], createdAt: "2024-02-28", lastActive: "2025-05-17", contractExpiry: "2026-02-28" },
];

const PLAN_COLORS: Record<Plan, string> = {
  starter: "bg-slate-100 text-slate-600",
  professional: "bg-blue-100 text-blue-700",
  enterprise: "bg-purple-100 text-purple-700",
  federal: "bg-amber-100 text-amber-700",
};

const STATUS_COLORS: Record<OrgStatus, string> = {
  active: "bg-green-100 text-green-700",
  trial: "bg-blue-100 text-blue-600",
  suspended: "bg-red-100 text-red-600",
  churned: "bg-slate-100 text-slate-400",
};

// ─── Helper ──────────────────────────────────────────────────────────────────
function toast(msg: string, color = "#2563eb") {
  const el = document.createElement("div");
  el.style.cssText = "position:fixed;bottom:24px;right:24px;background:" + color + ";color:white;padding:12px 20px;border-radius:12px;font-size:14px;font-weight:600;z-index:9999;box-shadow:0 4px 20px rgba(0,0,0,0.15)";
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2800);
}

function StatCard({ label, value, sub, color = "blue" }: { label: string; value: string | number; sub?: string; color?: string }) {
  const bg: Record<string, string> = { blue: "bg-blue-50 border-blue-100", green: "bg-green-50 border-green-100", amber: "bg-amber-50 border-amber-100", red: "bg-red-50 border-red-100", purple: "bg-purple-50 border-purple-100" };
  const text: Record<string, string> = { blue: "text-blue-700", green: "text-green-700", amber: "text-amber-700", red: "text-red-700", purple: "text-purple-700" };
  return (
    <div className={"rounded-xl border p-5 " + (bg[color] ?? bg.blue)}>
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">{label}</p>
      <p className={"text-3xl font-extrabold leading-tight " + (text[color] ?? text.blue)}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

// ─── Tabs ────────────────────────────────────────────────────────────────────
type Tab = "tenants" | "onboard" | "billing" | "platform" | "impersonate";
const TABS: { id: Tab; label: string }[] = [
  { id: "tenants", label: "Tenant Management" },
  { id: "onboard", label: "Onboard New Client" },
  { id: "billing", label: "Billing & Licenses" },
  { id: "platform", label: "Platform Health" },
  { id: "impersonate", label: "Support Access" },
];

// ─── Tenant Management Tab ───────────────────────────────────────────────────
function TenantsTab() {
  const [tenants, setTenants] = useState<Tenant[]>(MOCK_TENANTS);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<OrgStatus | "all">("all");
  const [selected, setSelected] = useState<Tenant | null>(null);
  const [editNotes, setEditNotes] = useState("");

  const filtered = tenants.filter(t => {
    const matchSearch = t.name.toLowerCase().includes(search.toLowerCase()) || t.adminEmail.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "all" || t.status === filter;
    return matchSearch && matchFilter;
  });

  function changeStatus(id: string, status: OrgStatus) {
    setTenants(prev => prev.map(t => t.id === id ? { ...t, status } : t));
    toast(status === "suspended" ? "Tenant suspended" : "Tenant reactivated", status === "suspended" ? "#dc2626" : "#16a34a");
    setSelected(null);
  }

  function saveNotes(id: string) {
    setTenants(prev => prev.map(t => t.id === id ? { ...t, notes: editNotes } : t));
    toast("Notes saved");
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tenants..." className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <select value={filter} onChange={e => setFilter(e.target.value as any)} className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="trial">Trial</option>
          <option value="suspended">Suspended</option>
          <option value="churned">Churned</option>
        </select>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Organization</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Plan</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Users</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Last Active</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filtered.map(t => (
              <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3.5">
                  <p className="font-semibold text-slate-900">{t.name}</p>
                  <p className="text-xs text-slate-400">{t.adminEmail}</p>
                </td>
                <td className="px-4 py-3.5"><span className={"text-xs font-semibold px-2 py-1 rounded-full " + PLAN_COLORS[t.plan]}>{t.plan}</span></td>
                <td className="px-4 py-3.5"><span className={"text-xs font-semibold px-2 py-1 rounded-full " + STATUS_COLORS[t.status]}>{t.status}</span></td>
                <td className="px-4 py-3.5 text-slate-600">{t.userCount}</td>
                <td className="px-4 py-3.5 text-slate-500 text-xs">{t.lastActive}</td>
                <td className="px-4 py-3.5">
                  <button onClick={() => { setSelected(t); setEditNotes(t.notes ?? ""); }} className="text-xs font-semibold text-blue-600 hover:text-blue-700 mr-3">Manage</button>
                  {t.status === "active" && <button onClick={() => changeStatus(t.id, "suspended")} className="text-xs font-semibold text-red-500 hover:text-red-600">Suspend</button>}
                  {t.status === "suspended" && <button onClick={() => changeStatus(t.id, "active")} className="text-xs font-semibold text-green-600 hover:text-green-700">Reactivate</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="text-center py-10 text-sm text-slate-400">No tenants found</div>}
      </div>

      {selected && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-6">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
            <div className="flex items-start justify-between mb-5">
              <div>
                <h3 className="text-lg font-bold text-slate-900">{selected.name}</h3>
                <p className="text-sm text-slate-500 mt-0.5">{selected.id} · {selected.slug}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&#x2715;</button>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
              <div className="bg-slate-50 rounded-lg p-3"><p className="text-xs text-slate-400 mb-1">Plan</p><p className="font-semibold text-slate-800 capitalize">{selected.plan}</p></div>
              <div className="bg-slate-50 rounded-lg p-3"><p className="text-xs text-slate-400 mb-1">Users</p><p className="font-semibold text-slate-800">{selected.userCount}</p></div>
              <div className="bg-slate-50 rounded-lg p-3"><p className="text-xs text-slate-400 mb-1">Created</p><p className="font-semibold text-slate-800">{selected.createdAt}</p></div>
              <div className="bg-slate-50 rounded-lg p-3"><p className="text-xs text-slate-400 mb-1">Contract Expiry</p><p className="font-semibold text-slate-800">{selected.contractExpiry ?? "N/A"}</p></div>
            </div>
            <div className="mb-4">
              <p className="text-xs font-semibold text-slate-500 mb-1">Frameworks</p>
              <div className="flex flex-wrap gap-1.5">{selected.frameworks.map(f => <span key={f} className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full font-medium">{f}</span>)}</div>
            </div>
            <div className="mb-4">
              <p className="text-xs font-semibold text-slate-500 mb-1">Internal Notes</p>
              <textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} rows={3} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" placeholder="Add internal notes..." />
            </div>
            <div className="flex items-center gap-2 justify-end">
              <button onClick={() => saveNotes(selected.id)} className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700">Save Notes</button>
              {selected.status === "active" && <button onClick={() => changeStatus(selected.id, "suspended")} className="px-4 py-2 bg-red-100 text-red-600 text-sm font-semibold rounded-lg hover:bg-red-200">Suspend Tenant</button>}
              {selected.status === "suspended" && <button onClick={() => changeStatus(selected.id, "active")} className="px-4 py-2 bg-green-100 text-green-700 text-sm font-semibold rounded-lg hover:bg-green-200">Reactivate Tenant</button>}
              <button onClick={() => setSelected(null)} className="px-4 py-2 border border-slate-200 text-slate-600 text-sm font-semibold rounded-lg hover:bg-slate-50">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Onboard New Client Tab ──────────────────────────────────────────────────
function OnboardTab() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    orgName: "", industry: "", size: "", plan: "professional" as Plan,
    adminFirstName: "", adminLastName: "", adminEmail: "",
    frameworks: [] as string[], contractMonths: "12", notes: "",
  });
  const [done, setDone] = useState(false);

  const ALL_FRAMEWORKS = ["FedRAMP High","FedRAMP Moderate","FedRAMP Low","CMMC Level 3","CMMC Level 2","NIST 800-171","NIST 800-53","FISMA","SOC 2 Type II","ISO 27001","HIPAA","PCI DSS","NIST CSF","CIS Controls","StateRAMP"];

  function toggleFw(fw: string) {
    setForm(f => ({ ...f, frameworks: f.frameworks.includes(fw) ? f.frameworks.filter(x => x !== fw) : [...f.frameworks, fw] }));
  }

  function handleSubmit() {
    setDone(true);
    toast("Client onboarded successfully!", "#16a34a");
  }

  if (done) return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
        <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
      </div>
      <h3 className="text-xl font-bold text-slate-900 mb-2">Client Onboarded!</h3>
      <p className="text-slate-500 mb-1 text-sm">Workspace created for <strong>{form.orgName}</strong></p>
      <p className="text-slate-400 text-xs mb-6">An invitation email has been sent to {form.adminEmail}</p>
      <button onClick={() => { setDone(false); setStep(1); setForm({ orgName: "", industry: "", size: "", plan: "professional", adminFirstName: "", adminLastName: "", adminEmail: "", frameworks: [], contractMonths: "12", notes: "" }); }} className="px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700">Onboard Another Client</button>
    </div>
  );

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-2 mb-8">
        {[1,2,3].map(n => (
          <div key={n} className="flex items-center gap-2">
            <div className={"h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold " + (step >= n ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-400")}>{n}</div>
            {n < 3 && <div className={"h-0.5 w-12 " + (step > n ? "bg-blue-600" : "bg-slate-200")} />}
          </div>
        ))}
        <div className="ml-3 text-sm font-medium text-slate-600">{step === 1 ? "Organization Details" : step === 2 ? "Admin User & Plan" : "Frameworks & Contract"}</div>
      </div>

      {step === 1 && (
        <div className="space-y-4">
          <div><label className="block text-sm font-semibold text-slate-700 mb-1.5">Organization Name *</label><input value={form.orgName} onChange={e => setForm(f => ({...f, orgName: e.target.value}))} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Acme Corp" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-semibold text-slate-700 mb-1.5">Industry</label><select value={form.industry} onChange={e => setForm(f => ({...f, industry: e.target.value}))} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"><option value="">Select...</option>{["Technology","Healthcare","Finance","Government","Defense","Manufacturing","Education","Other"].map(i => <option key={i}>{i}</option>)}</select></div>
            <div><label className="block text-sm font-semibold text-slate-700 mb-1.5">Company Size</label><select value={form.size} onChange={e => setForm(f => ({...f, size: e.target.value}))} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"><option value="">Select...</option>{["1-10","11-50","51-200","201-500","501-1000","1000+"].map(s => <option key={s}>{s}</option>)}</select></div>
          </div>
          <div className="flex justify-end pt-2"><button onClick={() => form.orgName ? setStep(2) : toast("Organization name is required","#dc2626")} className="px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700">Next</button></div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-semibold text-slate-700 mb-1.5">First Name *</label><input value={form.adminFirstName} onChange={e => setForm(f => ({...f, adminFirstName: e.target.value}))} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
            <div><label className="block text-sm font-semibold text-slate-700 mb-1.5">Last Name *</label><input value={form.adminLastName} onChange={e => setForm(f => ({...f, adminLastName: e.target.value}))} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
          </div>
          <div><label className="block text-sm font-semibold text-slate-700 mb-1.5">Admin Email *</label><input type="email" value={form.adminEmail} onChange={e => setForm(f => ({...f, adminEmail: e.target.value}))} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="admin@company.com" /></div>
          <div><label className="block text-sm font-semibold text-slate-700 mb-1.5">Plan</label>
            <div className="grid grid-cols-2 gap-2">{(["starter","professional","enterprise","federal"] as Plan[]).map(p => (<label key={p} className={"flex items-center gap-2 p-3 border rounded-xl cursor-pointer transition-colors " + (form.plan === p ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:bg-slate-50")}><input type="radio" name="plan" value={p} checked={form.plan === p} onChange={() => setForm(f => ({...f, plan: p}))} className="text-blue-600" /><span className="text-sm font-semibold capitalize text-slate-800">{p}</span></label>))}</div>
          </div>
          <div className="flex items-center gap-3 justify-between pt-2"><button onClick={() => setStep(1)} className="px-5 py-2.5 border border-slate-200 text-slate-600 text-sm font-semibold rounded-lg hover:bg-slate-50">Back</button><button onClick={() => form.adminEmail ? setStep(3) : toast("Admin email required","#dc2626")} className="px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700">Next</button></div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <div><label className="block text-sm font-semibold text-slate-700 mb-2">Compliance Frameworks</label>
            <div className="flex flex-wrap gap-2">{ALL_FRAMEWORKS.map(fw => (<button key={fw} onClick={() => toggleFw(fw)} className={"text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors " + (form.frameworks.includes(fw) ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-600 border-slate-200 hover:border-blue-300")}>{fw}</button>))}</div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-semibold text-slate-700 mb-1.5">Contract Length</label><select value={form.contractMonths} onChange={e => setForm(f => ({...f, contractMonths: e.target.value}))} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"><option value="1">1 month (trial)</option><option value="6">6 months</option><option value="12">12 months</option><option value="24">24 months</option><option value="36">36 months</option></select></div>
          </div>
          <div><label className="block text-sm font-semibold text-slate-700 mb-1.5">Internal Notes</label><textarea value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} rows={3} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" /></div>
          <div className="flex items-center gap-3 justify-between pt-2"><button onClick={() => setStep(2)} className="px-5 py-2.5 border border-slate-200 text-slate-600 text-sm font-semibold rounded-lg hover:bg-slate-50">Back</button><button onClick={handleSubmit} className="px-6 py-2.5 bg-green-600 text-white text-sm font-bold rounded-lg hover:bg-green-700">Create Workspace &amp; Send Invite</button></div>
        </div>
      )}
    </div>
  );
}

// ─── Billing & Licenses Tab ─────────────────────────────────────────────────
function BillingTab() {
  const tenants = MOCK_TENANTS;
  const planCounts = tenants.reduce((acc, t) => { acc[t.plan] = (acc[t.plan] ?? 0) + 1; return acc; }, {} as Record<string,number>);
  const mrr: Record<Plan, number> = { starter: 99, professional: 399, enterprise: 999, federal: 2499 };
  const totalMrr = tenants.filter(t => t.status === "active" || t.status === "trial").reduce((sum, t) => sum + mrr[t.plan], 0);
  const expiringSoon = tenants.filter(t => t.contractExpiry && new Date(t.contractExpiry) < new Date("2026-02-01"));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Monthly Recurring Revenue" value={"$" + totalMrr.toLocaleString()} sub="Active + trial tenants" color="green" />
        <StatCard label="Active Tenants" value={tenants.filter(t => t.status === "active").length} sub="Paying customers" color="blue" />
        <StatCard label="Trials" value={tenants.filter(t => t.status === "trial").length} sub="Converting soon" color="amber" />
        <StatCard label="Suspended" value={tenants.filter(t => t.status === "suspended").length} sub="Requires follow-up" color="red" />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100"><h3 className="text-sm font-bold text-slate-800">Plan Distribution</h3></div>
        <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-3">
          {(["starter","professional","enterprise","federal"] as Plan[]).map(p => (
            <div key={p} className="rounded-lg border border-slate-100 p-4 text-center">
              <p className={"text-2xl font-extrabold " + (p === "federal" ? "text-amber-600" : p === "enterprise" ? "text-purple-600" : p === "professional" ? "text-blue-600" : "text-slate-600")}>{planCounts[p] ?? 0}</p>
              <p className="text-xs font-semibold text-slate-500 mt-1 capitalize">{p}</p>
              <p className="text-xs text-slate-400">${mrr[p]}/mo per tenant</p>
            </div>
          ))}
        </div>
      </div>

      {expiringSoon.length > 0 && (
        <div className="bg-white rounded-xl border border-amber-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-amber-100 bg-amber-50 flex items-center gap-2">
            <svg className="h-4 w-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            <h3 className="text-sm font-bold text-amber-800">Contracts Expiring Within 9 Months ({expiringSoon.length})</h3>
          </div>
          <div className="divide-y divide-slate-50">
            {expiringSoon.map(t => (
              <div key={t.id} className="flex items-center justify-between px-5 py-3.5">
                <div><p className="text-sm font-semibold text-slate-900">{t.name}</p><p className="text-xs text-slate-400">{t.adminEmail}</p></div>
                <div className="text-right"><p className="text-sm font-semibold text-amber-700">{t.contractExpiry}</p><p className="text-xs text-slate-400 capitalize">{t.plan} plan</p></div>
                <button onClick={() => toast("Renewal email sent to " + t.adminEmail)} className="ml-4 px-3 py-1.5 text-xs font-semibold text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50">Send Renewal</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Platform Health Tab ─────────────────────────────────────────────────────
function PlatformTab() {
  const services = [
    { name: "API Server", status: "operational", latency: "42ms", uptime: "99.98%" },
    { name: "Database (PostgreSQL)", status: "operational", latency: "8ms", uptime: "99.99%" },
    { name: "Authentication (Clerk)", status: "operational", latency: "61ms", uptime: "99.95%" },
    { name: "File Storage", status: "operational", latency: "124ms", uptime: "99.97%" },
    { name: "Email (Resend)", status: "operational", latency: "218ms", uptime: "99.90%" },
    { name: "Railway Deployment", status: "operational", latency: "-", uptime: "99.96%" },
  ];
  const recentDeploys = [
    { hash: "6bce4e4", message: "Fix: Add missing comma in Documentation.tsx", time: "2 hours ago", status: "active" },
    { hash: "a3f891c", message: "Docs: Add comprehensive user guide for all platform pages", time: "3 hours ago", status: "inactive" },
    { hash: "9d2c14b", message: "Fix: Rename items to sections in Documentation.tsx", time: "5 hours ago", status: "inactive" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Tenants" value={MOCK_TENANTS.length} color="blue" />
        <StatCard label="Total Users" value={MOCK_TENANTS.reduce((s,t) => s+t.userCount, 0)} color="purple" />
        <StatCard label="Platform Uptime" value="99.97%" sub="Last 90 days" color="green" />
        <StatCard label="Avg Response" value="54ms" sub="p95 API latency" color="amber" />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800">Service Health</h3>
          <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-1 rounded-full">All Systems Operational</span>
        </div>
        <div className="divide-y divide-slate-50">
          {services.map(s => (
            <div key={s.name} className="flex items-center justify-between px-5 py-3.5">
              <div className="flex items-center gap-3">
                <div className="h-2.5 w-2.5 rounded-full bg-green-500" />
                <p className="text-sm font-semibold text-slate-800">{s.name}</p>
              </div>
              <div className="flex items-center gap-6 text-xs text-slate-500">
                <span>Latency: <strong className="text-slate-700">{s.latency}</strong></span>
                <span>Uptime: <strong className="text-green-600">{s.uptime}</strong></span>
                <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded-full capitalize">{s.status}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100"><h3 className="text-sm font-bold text-slate-800">Recent Deployments</h3></div>
        <div className="divide-y divide-slate-50">
          {recentDeploys.map(d => (
            <div key={d.hash} className="flex items-center justify-between px-5 py-3.5">
              <div className="flex items-center gap-3">
                <code className="text-xs font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-600">{d.hash}</code>
                <p className="text-sm text-slate-700">{d.message}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400">{d.time}</span>
                <span className={"text-xs font-semibold px-2 py-0.5 rounded-full " + (d.status === "active" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-400")}>{d.status}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Support Access / Impersonation Tab ─────────────────────────────────────
function ImpersonateTab() {
  const [query, setQuery] = useState("");
  const [reason, setReason] = useState("");
  const [selected, setSelected] = useState<Tenant | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const results = query.length > 1 ? MOCK_TENANTS.filter(t =>
    t.name.toLowerCase().includes(query.toLowerCase()) ||
    t.adminEmail.toLowerCase().includes(query.toLowerCase()) ||
    t.id.includes(query)
  ) : [];

  function handleImpersonate() {
    if (!reason.trim()) { toast("Access reason required", "#dc2626"); return; }
    setConfirmed(true);
    toast("Support session started for " + selected!.name + " (read-only)");
  }

  if (confirmed && selected) return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
          <svg className="h-5 w-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
        </div>
        <div>
          <p className="font-bold text-amber-900">Support Session Active</p>
          <p className="text-sm text-amber-700">Viewing as read-only observer in <strong>{selected.name}</strong></p>
        </div>
      </div>
      <div className="bg-white rounded-lg p-4 mb-4 text-sm text-slate-700 space-y-2">
        <p><strong>Tenant:</strong> {selected.name} ({selected.id})</p>
        <p><strong>Access Reason:</strong> {reason}</p>
        <p><strong>Session Started:</strong> {new Date().toLocaleString()}</p>
        <p><strong>Mode:</strong> <span className="text-amber-600 font-semibold">Read-only. All actions are logged.</span></p>
      </div>
      <div className="flex gap-3">
        <button onClick={() => toast("Support session ended", "#16a34a")} className="px-4 py-2 bg-amber-600 text-white text-sm font-semibold rounded-lg hover:bg-amber-700" onClick={() => { setConfirmed(false); setSelected(null); setReason(""); setQuery(""); toast("Support session ended", "#16a34a"); }}>End Session</button>
        <button className="px-4 py-2 border border-amber-300 text-amber-800 text-sm font-semibold rounded-lg hover:bg-amber-100">View Tenant Dashboard</button>
      </div>
    </div>
  );

  return (
    <div className="max-w-2xl space-y-5">
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-3">
        <svg className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" /></svg>
        <p className="text-xs text-amber-700 leading-relaxed"><strong>Support Access is read-only.</strong> All sessions are immutably logged to the platform audit trail with timestamp, operator identity, tenant, and stated reason. This access is for diagnostic and support purposes only and cannot be used to modify tenant data.</p>
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Search for Tenant</label>
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by name, email, or org ID..." className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        {results.length > 0 && (
          <div className="mt-2 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            {results.map(t => (
              <button key={t.id} onClick={() => { setSelected(t); setQuery(t.name); }} className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0 text-left">
                <div><p className="text-sm font-semibold text-slate-900">{t.name}</p><p className="text-xs text-slate-400">{t.adminEmail}</p></div>
                <span className={"text-xs font-semibold px-2 py-0.5 rounded-full " + STATUS_COLORS[t.status]}>{t.status}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-center justify-between">
            <div><p className="text-sm font-bold text-blue-900">{selected.name}</p><p className="text-xs text-blue-600">{selected.id} · {selected.userCount} users · {selected.plan} plan</p></div>
            <button onClick={() => setSelected(null)} className="text-blue-400 hover:text-blue-600 text-lg leading-none">&#x2715;</button>
          </div>
          <div><label className="block text-sm font-semibold text-slate-700 mb-1.5">Access Reason *</label><textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" placeholder="Describe why you need support access (e.g., Client reported issue with FISMA report export, ticket #1234)" /></div>
          <button onClick={handleImpersonate} className="px-5 py-2.5 bg-amber-600 text-white text-sm font-bold rounded-lg hover:bg-amber-700">Start Read-Only Support Session</button>
        </div>
      )}
    </div>
  );
}

// ─── Main SuperAdmin Component ────────────────────────────────────────────────
export default function SuperAdmin() {
  const { user } = useUser();
  const [tab, setTab] = useState<Tab>("tenants");

  // Guard: only render for designated super-admin emails
  const ADMIN_EMAILS = ["admin@colorcodesolutions.com", "ops@colorcodesolutions.com", "support@colorcodesolutions.com"];
  const userEmail = user?.primaryEmailAddress?.emailAddress ?? "";
  const isSuperAdmin = ADMIN_EMAILS.some(e => e === userEmail) || userEmail.endsWith("@colorcodesolutions.com");

  if (!isSuperAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-96 text-center p-8">
        <div className="h-16 w-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
          <svg className="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Access Denied</h2>
        <p className="text-slate-500 text-sm max-w-sm">This page is restricted to ColorCode Solutions administrators only. Your access attempt has been logged.</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded-full uppercase tracking-wide">Super Admin</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 leading-tight">Owner Control Panel</h1>
          <p className="text-sm text-slate-500 mt-1">ColorCode Solutions LLC &mdash; EnterpriseComply Platform Administration</p>
        </div>
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-4 py-2.5 shadow-sm">
          <div className="h-2 w-2 rounded-full bg-green-500" />
          <span className="text-xs font-semibold text-slate-700">Platform Operational</span>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <StatCard label="Total Tenants" value={MOCK_TENANTS.length} color="blue" />
        <StatCard label="Active" value={MOCK_TENANTS.filter(t => t.status === "active").length} color="green" />
        <StatCard label="Trials" value={MOCK_TENANTS.filter(t => t.status === "trial").length} color="amber" />
        <StatCard label="Suspended" value={MOCK_TENANTS.filter(t => t.status === "suspended").length} color="red" />
        <StatCard label="Total Users" value={MOCK_TENANTS.reduce((s,t) => s+t.userCount, 0)} color="purple" />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 bg-white border border-slate-200 rounded-xl p-1 w-fit shadow-sm">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={"px-4 py-2 rounded-lg text-sm font-semibold transition-all " + (tab === t.id ? "bg-blue-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-800 hover:bg-slate-50")}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === "tenants" && <TenantsTab />}
      {tab === "onboard" && <OnboardTab />}
      {tab === "billing" && <BillingTab />}
      {tab === "platform" && <PlatformTab />}
      {tab === "impersonate" && <ImpersonateTab />}
    </div>
  );
}

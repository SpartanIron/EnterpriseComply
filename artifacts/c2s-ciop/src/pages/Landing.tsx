import { useAuth, useClerk } from "@clerk/react";
import { useState, useEffect } from "react";

const BASE_PATH = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

const FEATURES = [
  {
    icon: (
      <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 2C6.48 2 2 3.79 2 6v2c0 2.21 4.48 4 10 4s10-1.79 10-4V6c0-2.21-4.48-4-10-4z" opacity="0.4" />
        <path d="M2 10v2c0 2.21 4.48 4 10 4s10-1.79 10-4v-2c-2.09 1.26-5.76 2-10 2S4.09 11.26 2 10z" opacity="0.7" />
        <path d="M2 14v2c0 2.21 4.48 4 10 4s10-1.79 10-4v-2c-2.09 1.26-5.76 2-10 2S4.09 15.26 2 14z" />
      </svg>
    ),
    title: "Unify & Standardize",
    desc: "One canonical control set drives every framework simultaneously. Update it once and all 12 frameworks reflect it instantly.",
    page: "/controls",
  },
  {
    icon: (
      <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
        <path fillRule="evenodd" d="M11.484 2.172a.75.75 0 011.032 0 11.209 11.209 0 007.877 3.08.75.75 0 01.722.515 12.74 12.74 0 01.635 3.985c0 5.942-4.064 10.933-9.563 12.348a.749.749 0 01-.374 0C6.314 20.683 2.25 15.692 2.25 9.75c0-1.39.188-2.738.533-4.018a.75.75 0 01.722-.515 11.21 11.21 0 007.879-3.045zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zM12 15a.75.75 0 00-.75.75v.008c0 .414.336.75.75.75h.008a.75.75 0 00.75-.75v-.008a.75.75 0 00-.75-.75H12z" clipRule="evenodd" />
      </svg>
    ),
    title: "Identify & Mitigate Risk",
    desc: "Surface risks by severity, owner, and framework impact before they appear in your audit findings.",
    page: "/risks",
  },
  {
    icon: (
      <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
        <path fillRule="evenodd" d="M11.078 2.25c-.917 0-1.699.663-1.85 1.567L9.05 4.889c-.02.12-.115.26-.297.348a7.493 7.493 0 00-.986.57c-.166.115-.334.126-.45.083L6.3 5.508a1.875 1.875 0 00-2.282.819l-.922 1.597a1.875 1.875 0 00.432 2.385l.84.692c.095.078.17.229.154.43a7.598 7.598 0 000 1.139c.015.2-.059.352-.153.43l-.841.692a1.875 1.875 0 00-.432 2.385l.922 1.597a1.875 1.875 0 002.282.818l1.019-.382c.115-.043.283-.031.45.082.312.214.641.405.985.57.182.088.277.228.297.35l.178 1.071c.151.904.933 1.567 1.85 1.567h1.844c.916 0 1.699-.663 1.85-1.567l.178-1.072c.02-.12.114-.26.297-.349.344-.165.673-.356.985-.57.167-.114.335-.125.45-.082l1.02.382a1.875 1.875 0 002.28-.819l.923-1.597a1.875 1.875 0 00-.432-2.385l-.84-.692c-.095-.078-.17-.229-.154-.43a7.614 7.614 0 000-1.139c-.016-.2.059-.352.153-.43l.84-.692c.708-.582.891-1.59.433-2.385l-.922-1.597a1.875 1.875 0 00-2.282-.818l-1.02.382c-.114.043-.282.031-.449-.083a7.49 7.49 0 00-.985-.57c-.183-.087-.277-.227-.297-.348l-.179-1.072a1.875 1.875 0 00-1.85-1.567h-1.843zM12 15.75a3.75 3.75 0 100-7.5 3.75 3.75 0 000 7.5z" clipRule="evenodd" />
      </svg>
    ),
    title: "Automate & Streamline",
    desc: "Automate evidence collection, control testing, and workflow routing. Your team handles exceptions, not administration.",
    page: "/integrations",
  },
  {
    icon: (
      <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
        <path fillRule="evenodd" d="M2.25 2.25a.75.75 0 000 1.5H3v10.5a3 3 0 003 3h1.21l-1.172 3.513a.75.75 0 001.424.474l.329-.987h8.418l.33.987a.75.75 0 001.422-.474l-1.17-3.513H18a3 3 0 003-3V3.75h.75a.75.75 0 000-1.5H2.25zm6.04 16.5l.5-1.5h6.42l.5 1.5H8.29zm7.46-12a.75.75 0 00-1.5 0v6a.75.75 0 001.5 0v-6zm-3 2.25a.75.75 0 00-1.5 0v3.75a.75.75 0 001.5 0V9zm-3 2.25a.75.75 0 00-1.5 0v1.5a.75.75 0 001.5 0v-1.5z" clipRule="evenodd" />
      </svg>
    ),
    title: "Monitor & Measure",
    desc: "Live posture scoring across every active framework. Walk into any audit with a defensible, timestamped evidence trail.",
    page: "/monitoring",
  },
  {
    icon: (
      <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
        <path d="M4.5 6.375a4.125 4.125 0 118.25 0 4.125 4.125 0 01-8.25 0zM14.25 8.625a3.375 3.375 0 116.75 0 3.375 3.375 0 01-6.75 0zM1.5 19.125a7.125 7.125 0 0114.25 0v.003l-.001.119a.75.75 0 01-.363.63 13.067 13.067 0 01-6.761 1.873c-2.472 0-4.786-.684-6.76-1.873a.75.75 0 01-.364-.63l-.001-.122zM17.25 19.128l-.001.144a2.25 2.25 0 01-.233.96 10.088 10.088 0 005.06-1.01.75.75 0 00.42-.643 4.875 4.875 0 00-6.957-4.611 8.586 8.586 0 011.71 5.157v.003z" />
      </svg>
    ),
    title: "Collaborate & Assign",
    desc: "Assign controls, tasks, and approvals across teams. Every action is timestamped, attributed, and audit-logged.",
    page: "/audits",
  },
  {
    icon: (
      <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
        <path fillRule="evenodd" d="M12.516 2.17a.75.75 0 00-1.032 0 11.209 11.209 0 01-7.877 3.08.75.75 0 00-.722.515A12.74 12.74 0 002.25 9.75c0 5.942 4.064 10.933 9.563 12.348a.749.749 0 00.374 0c5.499-1.415 9.563-6.406 9.563-12.348 0-1.39-.188-2.738-.533-4.018a.75.75 0 00-.722-.515 11.21 11.21 0 01-7.879-3.045zM10.5 12.97l-1.72-1.72a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.06 0l4.5-4.5a.75.75 0 10-1.06-1.06l-3.97 3.97z" clipRule="evenodd" />
      </svg>
    ),
    title: "Adapt & Stay Ahead",
    desc: "New frameworks and requirement changes propagate automatically. Your posture updates before your auditors ask.",
    page: "/frameworks",
  },
];

const INDUSTRIES = [
  {
    name: "Defense & Government",
    desc: "FedRAMP Moderate/High, CMMC L2, NIST 800-53, NIST 800-171, and StateRAMP, all native, not add-ons.",
    photo: "https://images.unsplash.com/photo-1587131110607-07f5be87b5ba?w=600&h=400&fit=crop&q=80",
  },
  {
    name: "Aerospace & Defense Contractors",
    desc: "CMMC, ITAR, DFARS 7012, and supply chain risk management in one platform. SPRS score tracking built in.",
    photo: "https://images.unsplash.com/photo-1565793298595-6a879b1d9492?w=600&h=400&fit=crop&q=80",
  },
  {
    name: "Financial Services",
    desc: "SOC 2, PCI DSS, and GLBA compliance built in from day one.",
    photo: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=600&h=400&fit=crop&q=80",
  },
  {
    name: "Healthcare",
    desc: "HIPAA, HITRUST CSF, and FDA 21 CFR Part 11 support.",
    photo: "https://images.unsplash.com/photo-1538108149393-fbbd81895907?w=600&h=400&fit=crop&q=80",
  },
  {
    name: "Technology",
    desc: "SOC 2 Type II, ISO 27001, and GDPR from a single platform.",
    photo: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&h=400&fit=crop&q=80",
  },
];

const TRUST_NAMES = ["Apex Defense Systems", "NorthBridge Federal", "HealthPlus Network", "TechNova", "Vertex Systems", "BlueStone Group"];

const FOOTER_LINKS = {
  Platform: ["Overview", "Features", "Integrations", "Security", "Pricing"],
  Solutions: ["Risk Management", "Policy Management", "Incident Management", "Vendor Management", "Audit Management"],
  Resources: ["Blog", "Whitepapers", "Webinars", "Case Studies", "Help Center"],
  Company: ["About Us", "Careers", "Partners", "Newsroom", "Contact Us"],
};

function NavBar() {
  const { isSignedIn } = useAuth();
  const { signOut } = useClerk();
  return (
    <nav className="sticky top-0 z-50 border-b" style={{ background: "rgba(255,255,255,0.96)", borderColor: "rgba(0,0,0,0.08)", backdropFilter: "blur(12px)" }}>
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-14">
        <a href={BASE_PATH + "/"} className="flex items-center gap-3">
          <div className="h-7 w-7 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0 shadow-sm shadow-blue-600/30">
            <img src={`${BASE_PATH}/logo.svg`} className="h-4 w-4" alt="" />
          </div>
          <div>
            <span className="font-bold text-sm tracking-tight" style={{ color: "#0f172a" }}>EnterpriseComply</span>
            <span className="hidden sm:inline text-xs ml-2" style={{ color: "#94a3b8" }}>by ColorCode Solutions</span>
          </div>
        </a>

        <div className="flex items-center gap-3">
          {isSignedIn ? (
            <>
              <button
                onClick={() => signOut({ redirectUrl: BASE_PATH + "/" })}
                className="text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors"
                style={{ color: "#64748b", borderColor: "rgba(255,255,255,0.08)", background: "transparent" }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#94a3b8"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "#64748b"; }}>
                Sign out
              </button>
              <a href={BASE_PATH + "/dashboard"}
                className="px-4 py-1.5 text-white text-xs font-semibold rounded-lg transition-all"
                style={{ background: "linear-gradient(135deg, #2563eb 0%, #0ea5e9 100%)", boxShadow: "0 0 16px rgba(37,99,235,0.3)" }}>
                Go to App
              </a>
            </>
          ) : (
            <>
              <a href={BASE_PATH + "/sign-in"} className="text-xs font-medium px-3 py-1.5 transition-colors" style={{ color: "#64748b" }}
                onMouseEnter={e => (e.currentTarget.style.color = "#94a3b8")}
                onMouseLeave={e => (e.currentTarget.style.color = "#64748b")}>
                Log In
              </a>
              <a href={BASE_PATH + "/pricing"} className="text-xs font-medium px-3 py-1.5 transition-colors" style={{ color: "#64748b" }}
                onMouseEnter={e => (e.currentTarget.style.color = "#94a3b8")}
                onMouseLeave={e => (e.currentTarget.style.color = "#64748b")}>
                Pricing
              </a>
              <a href={BASE_PATH + "/sign-up"}
                className="px-4 py-1.5 text-white text-xs font-semibold rounded-lg transition-all"
                style={{ background: "linear-gradient(135deg, #2563eb 0%, #0ea5e9 100%)", boxShadow: "0 0 16px rgba(37,99,235,0.3)" }}>
                Request a Demo
              </a>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

const MOCKUP_TABS = [
  { id: "dashboard", label: "Dashboard", url: "app.enterprisecomply.com/dashboard" },
  { id: "controls", label: "Controls", url: "app.enterprisecomply.com/controls" },
  { id: "integrations", label: "Integrations", url: "app.enterprisecomply.com/integrations" },
];

const SIDEBAR_NAV = [
  { section: "OVERVIEW", items: [{ label: "Dashboard" }] },
  { section: "COMPLIANCE", items: [{ label: "Frameworks" }, { label: "Controls" }, { label: "Risk Register" }] },
  { section: "EVIDENCE", items: [{ label: "Integrations" }, { label: "Monitoring" }] },
  { section: "FEDERAL", items: [{ label: "POA&M" }, { label: "SPRS Score" }] },
];

function MockupSidebar({ activeItem }: { activeItem: string }) {
  return (
    <div className="flex flex-col flex-shrink-0" style={{ width: 130, background: "#0f172a", borderRight: "1px solid rgba(255,255,255,0.06)" }}>
      <div className="flex items-center gap-2 px-3 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="h-5 w-5 rounded bg-blue-600 flex items-center justify-center flex-shrink-0">
          <img src={`${BASE_PATH}/logo.svg`} className="h-3 w-3" alt="" />
        </div>
        <div>
          <p className="font-bold text-white leading-none" style={{ fontSize: 9 }}>EnterpriseComply</p>
          <p style={{ fontSize: 7, color: "#475569", marginTop: 1 }}>Acme Corp</p>
        </div>
      </div>
      <div className="px-2 py-2 flex-1">
        {SIDEBAR_NAV.map(({ section, items }) => (
          <div key={section} className="mb-1">
            <p className="font-bold uppercase" style={{ fontSize: 6.5, letterSpacing: "0.1em", padding: "5px 6px 2px", color: "#334155" }}>{section}</p>
            {items.map(({ label }) => {
              const active = label === activeItem;
              return (
                <div key={label} className="flex items-center gap-1.5 rounded-md" style={{ padding: "3px 6px", background: active ? "rgba(37,99,235,0.15)" : "transparent" }}>
                  <div className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ background: active ? "#3b82f6" : "#334155" }} />
                  <span style={{ fontSize: 8.5, color: active ? "#93c5fd" : "#64748b", fontWeight: active ? 600 : 400 }}>{label}</span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function DashboardScreen() {
  return (
    <div className="flex-1 overflow-hidden" style={{ background: "#f8fafc" }}>
      <div className="px-4 py-3" style={{ background: "linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)" }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg width="36" height="36" className="flex-shrink-0">
              <circle cx="18" cy="18" r="13" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="3" />
              <circle cx="18" cy="18" r="13" fill="none" stroke="#34d399" strokeWidth="3"
                strokeDasharray={`${0.92 * 2 * Math.PI * 13} ${2 * Math.PI * 13}`}
                strokeLinecap="round" transform="rotate(-90 18 18)" />
              <text x="18" y="22" textAnchor="middle" fontSize="8" fontWeight="bold" fill="white">92%</text>
            </svg>
            <div>
              <p style={{ fontSize: 7, color: "rgba(147,197,253,0.85)", fontWeight: 600, letterSpacing: "0.06em" }}>ACME CORP - LIVE POSTURE</p>
              <p style={{ fontSize: 10, color: "white", fontWeight: 700, marginTop: 1 }}>Compliance Score</p>
              <p style={{ fontSize: 7, color: "rgba(147,197,253,0.75)", marginTop: 1 }}>5 frameworks active</p>
            </div>
          </div>
          <div className="flex gap-1.5">
            {[
              { label: "Open Tasks", val: "128", color: "#fbbf24" },
              { label: "High Risk", val: "23", color: "#f87171" },
              { label: "Upcoming", val: "15", color: "#34d399" },
            ].map(s => (
              <div key={s.label} className="text-center px-2 py-1 rounded" style={{ background: "rgba(255,255,255,0.1)" }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: s.color }}>{s.val}</p>
                <p style={{ fontSize: 6, color: "rgba(147,197,253,0.7)", marginTop: 1 }}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="grid gap-2 p-3" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
        {[
          { name: "SOC 2 Type II", score: 92, accent: "#2563eb", tag: "Commercial", pass: 28, fail: 1 },
          { name: "FedRAMP Moderate", score: 71, accent: "#7c3aed", tag: "Federal", pass: 19, fail: 4 },
          { name: "ISO 27001", score: 85, accent: "#0891b2", tag: "International", pass: 24, fail: 2 },
          { name: "CMMC Level 2", score: 68, accent: "#059669", tag: "Federal", pass: 17, fail: 5 },
        ].map((fw) => (
          <div key={fw.name} className="rounded-lg bg-white border border-slate-200 overflow-hidden">
            <div className="h-0.5" style={{ background: fw.accent }} />
            <div className="p-2">
              <div className="flex items-start justify-between mb-1.5">
                <div>
                  <p className="font-bold text-slate-900" style={{ fontSize: 8.5, lineHeight: 1.2 }}>{fw.name}</p>
                  <span style={{ fontSize: 6.5, padding: "1px 5px", borderRadius: 999, background: `${fw.accent}18`, color: fw.accent, fontWeight: 600, display: "inline-block", marginTop: 2 }}>{fw.tag}</span>
                </div>
                <svg width="28" height="28" className="flex-shrink-0">
                  <circle cx="14" cy="14" r="9" fill="none" stroke="#f1f5f9" strokeWidth="2.5" />
                  <circle cx="14" cy="14" r="9" fill="none"
                    stroke={fw.score >= 80 ? "#16a34a" : "#f59e0b"} strokeWidth="2.5"
                    strokeDasharray={`${(fw.score / 100) * 2 * Math.PI * 9} ${2 * Math.PI * 9}`}
                    strokeLinecap="round" transform="rotate(-90 14 14)" />
                  <text x="14" y="17.5" textAnchor="middle" fontSize="5.5" fontWeight="bold" fill={fw.score >= 80 ? "#16a34a" : "#d97706"}>{fw.score}%</text>
                </svg>
              </div>
              <div className="flex gap-1">
                <div className="flex-1 rounded text-center py-0.5" style={{ background: "#f0fdf4" }}>
                  <p style={{ fontSize: 9, fontWeight: 700, color: "#15803d" }}>{fw.pass}</p>
                  <p style={{ fontSize: 6, color: "#15803d" }}>Pass</p>
                </div>
                <div className="flex-1 rounded text-center py-0.5" style={{ background: "#fef2f2" }}>
                  <p style={{ fontSize: 9, fontWeight: 700, color: "#dc2626" }}>{fw.fail}</p>
                  <p style={{ fontSize: 6, color: "#dc2626" }}>Fail</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ControlsScreen() {
  const domains = [
    { name: "Identity & Access Management", controls: 9, pass: 8, fail: 1, pct: 89 },
    { name: "Configuration Management", controls: 7, pass: 7, fail: 0, pct: 100 },
    { name: "Incident Response", controls: 6, pass: 4, fail: 2, pct: 67 },
    { name: "Data Protection", controls: 8, pass: 6, fail: 2, pct: 75 },
    { name: "System & Comms Protection", controls: 5, pass: 5, fail: 0, pct: 100 },
    { name: "Risk Assessment", controls: 6, pass: 3, fail: 3, pct: 50 },
  ];
  return (
    <div className="flex-1 overflow-hidden" style={{ background: "#f8fafc" }}>
      <div className="px-4 py-2.5 border-b" style={{ background: "white", borderColor: "#e2e8f0" }}>
        <div className="flex items-center justify-between">
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, color: "#0f172a" }}>Universal Control Objectives</p>
            <p style={{ fontSize: 7, color: "#64748b", marginTop: 1 }}>71 controls across 12 domains, mapped to all active frameworks</p>
          </div>
          <div className="flex gap-2">
            {[{ label: "52 Passing", color: "#15803d", bg: "#f0fdf4" }, { label: "19 Failing", color: "#dc2626", bg: "#fef2f2" }].map(b => (
              <div key={b.label} className="px-2 py-0.5 rounded" style={{ background: b.bg }}>
                <span style={{ fontSize: 7.5, fontWeight: 700, color: b.color }}>{b.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="p-3 space-y-1.5">
        {domains.map((d) => (
          <div key={d.name} className="bg-white rounded-lg border border-slate-200 px-3 py-2">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 rounded flex items-center justify-center flex-shrink-0" style={{ background: d.fail === 0 ? "#f0fdf4" : d.fail >= 2 ? "#fef2f2" : "#fffbeb" }}>
                  <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke={d.fail === 0 ? "#16a34a" : d.fail >= 2 ? "#dc2626" : "#d97706"} strokeWidth={2.5}>
                    {d.fail === 0
                      ? <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      : <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01" />}
                  </svg>
                </div>
                <span style={{ fontSize: 8.5, fontWeight: 600, color: "#1e293b" }}>{d.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <span style={{ fontSize: 7, color: "#64748b" }}>{d.controls} controls</span>
                <span style={{ fontSize: 8, fontWeight: 700, color: d.pct === 100 ? "#16a34a" : d.pct >= 75 ? "#d97706" : "#dc2626" }}>{d.pct}%</span>
              </div>
            </div>
            <div className="w-full rounded-full overflow-hidden" style={{ height: 3, background: "#f1f5f9" }}>
              <div className="h-full rounded-full" style={{ width: `${d.pct}%`, background: d.pct === 100 ? "#16a34a" : d.pct >= 75 ? "#f59e0b" : "#ef4444" }} />
            </div>
            <div className="flex gap-2 mt-1">
              <span style={{ fontSize: 6.5, color: "#15803d" }}>{d.pass} passing</span>
              {d.fail > 0 && <span style={{ fontSize: 6.5, color: "#dc2626" }}>{d.fail} failing</span>}
              <span style={{ fontSize: 6.5, color: "#94a3b8", marginLeft: "auto" }}>SOC 2 - FedRAMP - ISO 27001 +3</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function IntegrationsScreen() {
  const integrations = [
    { name: "GitHub", logo: "GH", connected: true, synced: "2m ago", evidence: 47, color: "#1f2937" },
    { name: "AWS", logo: "AWS", connected: true, synced: "5m ago", evidence: 112, color: "#f59e0b" },
    { name: "Google Workspace", logo: "GWS", connected: true, synced: "12m ago", evidence: 38, color: "#3b82f6" },
    { name: "Okta", logo: "OK", connected: false, synced: null, evidence: 0, color: "#0ea5e9" },
    { name: "Slack", logo: "SL", connected: true, synced: "1h ago", evidence: 22, color: "#7c3aed" },
    { name: "Azure AD", logo: "AZ", connected: false, synced: null, evidence: 0, color: "#1d4ed8" },
  ];
  return (
    <div className="flex-1 overflow-hidden" style={{ background: "#f8fafc" }}>
      <div className="px-4 py-2.5 border-b" style={{ background: "white", borderColor: "#e2e8f0" }}>
        <div className="flex items-center justify-between">
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, color: "#0f172a" }}>Evidence Integrations</p>
            <p style={{ fontSize: 7, color: "#64748b", marginTop: 1 }}>4 of 6 connected, collecting evidence automatically</p>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded" style={{ background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
            <div className="h-1.5 w-1.5 rounded-full bg-green-500" style={{ boxShadow: "0 0 4px #22c55e" }} />
            <span style={{ fontSize: 7, fontWeight: 600, color: "#15803d" }}>Live sync</span>
          </div>
        </div>
      </div>
      <div className="grid gap-2 p-3" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
        {integrations.map((intg) => (
          <div key={intg.name} className="bg-white rounded-lg border overflow-hidden" style={{ borderColor: intg.connected ? "#e2e8f0" : "#e2e8f0" }}>
            <div className="flex items-center gap-2 px-2.5 py-2">
              <div className="h-6 w-6 rounded flex items-center justify-center flex-shrink-0 text-white font-bold" style={{ background: intg.color, fontSize: 5.5 }}>{intg.logo}</div>
              <div className="flex-1 min-w-0">
                <p style={{ fontSize: 8.5, fontWeight: 600, color: "#1e293b" }}>{intg.name}</p>
                {intg.connected
                  ? <p style={{ fontSize: 6.5, color: "#64748b", marginTop: 1 }}>Synced {intg.synced}</p>
                  : <p style={{ fontSize: 6.5, color: "#94a3b8", marginTop: 1 }}>Not connected</p>}
              </div>
              <div className="flex-shrink-0">
                {intg.connected
                  ? <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full" style={{ background: "#f0fdf4" }}>
                      <div className="h-1 w-1 rounded-full bg-green-500" />
                      <span style={{ fontSize: 6, fontWeight: 600, color: "#15803d" }}>Active</span>
                    </div>
                  : <div className="px-1.5 py-0.5 rounded-full" style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                      <span style={{ fontSize: 6, color: "#94a3b8" }}>Connect</span>
                    </div>}
              </div>
            </div>
            {intg.connected && (
              <div className="px-2.5 pb-2">
                <div className="flex items-center justify-between rounded" style={{ background: "#f8fafc", padding: "2px 6px" }}>
                  <span style={{ fontSize: 6.5, color: "#64748b" }}>Evidence collected</span>
                  <span style={{ fontSize: 7.5, fontWeight: 700, color: "#2563eb" }}>{intg.evidence}</span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ProductMockup() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActive((prev) => (prev + 1) % MOCKUP_TABS.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  const tab = MOCKUP_TABS[active];
  const sidebarActive = active === 0 ? "Dashboard" : active === 1 ? "Controls" : "Integrations";

  return (
    <div>
      {/* Tab pills above the mockup */}
      <div className="flex items-center gap-1 mb-3 justify-center">
        {MOCKUP_TABS.map((t, i) => (
          <button
            key={t.id}
            onClick={() => setActive(i)}
            className="px-3 py-1 rounded-full text-xs font-semibold transition-all duration-200"
            style={{
              fontSize: 11,
              background: active === i ? "#2563eb" : "rgba(255,255,255,0.08)",
              color: active === i ? "white" : "rgba(255,255,255,0.45)",
              border: active === i ? "1px solid #2563eb" : "1px solid rgba(255,255,255,0.08)",
              cursor: "pointer",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Progress bar */}
      <div className="flex gap-1 mb-3">
        {MOCKUP_TABS.map((_, i) => (
          <div key={i} className="flex-1 rounded-full overflow-hidden" style={{ height: 2, background: "rgba(255,255,255,0.1)" }}>
            <div className="h-full rounded-full" style={{
              background: "#3b82f6",
              width: i < active ? "100%" : i === active ? "100%" : "0%",
              transition: i === active ? "none" : "none",
              opacity: i === active ? 1 : i < active ? 0.4 : 0,
            }} />
          </div>
        ))}
      </div>

      {/* Browser mockup */}
      <div className="rounded-2xl overflow-hidden bg-white" style={{ boxShadow: "0 0 0 1px rgba(255,255,255,0.1)" }}>
        <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ background: "#f8fafc", borderColor: "#e2e8f0" }}>
          <div className="h-2.5 w-2.5 rounded-full bg-red-400" />
          <div className="h-2.5 w-2.5 rounded-full bg-amber-400" />
          <div className="h-2.5 w-2.5 rounded-full bg-green-400" />
          <div className="flex-1 mx-3 h-5 rounded-md bg-white border border-slate-200 flex items-center px-3 gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-green-500 flex-shrink-0" />
            <span className="font-medium" style={{ color: "#94a3b8", fontSize: 10 }}>{tab.url}</span>
          </div>
        </div>

        <div className="flex" style={{ minHeight: 340 }}>
          <MockupSidebar activeItem={sidebarActive} />
          {active === 0 && <DashboardScreen />}
          {active === 1 && <ControlsScreen />}
          {active === 2 && <IntegrationsScreen />}
        </div>
      </div>
    </div>
  );
}

export default function Landing() {
  const { isSignedIn } = useAuth();

  const FEATURE_ACCENTS = ["#7c3aed", "#f59e0b", "#2563eb", "#0891b2", "#059669", "#3b82f6"];

  return (
    <div style={{ fontFamily: "Inter, -apple-system, sans-serif" }}>
      <NavBar />

      {/* ── HERO ── dark */}
      <section className="relative overflow-hidden" style={{ background: "linear-gradient(135deg, #0a0f1e 0%, #0d1b3e 60%, #0a1628 100%)" }}>
        {/* Subtle dot grid */}
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.03) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }} />
        {/* Three-stripe diagonal - indigo / blue / cyan — bottom-RIGHT */}
        <div className="absolute pointer-events-none" style={{ bottom: 0, left: 0, right: 0, height: "52%", zIndex: 0 }}>
          <div style={{
            position: "absolute",
            inset: 0,
            background: [
              "linear-gradient(158deg,",
              "  transparent 51%,",
              "  #06b6d4 51%, #06b6d4 67%,",
              "  #2563eb 67%, #2563eb 83%,",
              "  #4f46e5 83%",
              ")"
            ].join(""),
          }} />
        </div>
        <div className="relative max-w-7xl mx-auto px-6 py-20 lg:py-28" style={{ zIndex: 1 }}>
          <div className="grid lg:grid-cols-2 gap-14 items-center">
            {/* Left */}
            <div>
              <div className="flex flex-col gap-2 mb-7">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border self-start"
                  style={{ background: "rgba(59,130,246,0.12)", borderColor: "rgba(59,130,246,0.3)", color: "#93c5fd" }}>
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
                  Federal-First GRC Platform
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {["FedRAMP", "CMMC L2", "NIST 800-171", "SOC 2", "ISO 27001"].map((fw) => (
                    <span key={fw} className="text-xs font-semibold px-2 py-0.5 rounded"
                      style={{ background: "rgba(255,255,255,0.06)", color: "#94a3b8", border: "1px solid rgba(255,255,255,0.1)" }}>
                      {fw}
                    </span>
                  ))}
                </div>
              </div>
              <h1 className="font-extrabold leading-tight tracking-tight mb-6" style={{ fontSize: "clamp(2.4rem, 4.5vw, 3.5rem)", color: "white" }}>
                Federal Compliance.<br />
                <span style={{ background: "linear-gradient(135deg, #60a5fa 0%, #38bdf8 50%, #34d399 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                  One Control. Every Framework.
                </span>
              </h1>
              <p className="text-lg leading-relaxed mb-9 max-w-lg" style={{ color: "#94a3b8" }}>
                The only GRC platform built federal-first. Native POA&amp;M, SPRS score tracking, and SSP generation for FedRAMP, CMMC, and NIST 800-171, with full commercial framework coverage for SOC 2, ISO 27001, HIPAA, and 19 more. One control. Every obligation.
              </p>
              <div className="flex items-center gap-3 flex-wrap mb-10">
                <a href={isSignedIn ? BASE_PATH + "/dashboard" : BASE_PATH + "/sign-up"}
                  className="inline-flex items-center gap-2 px-6 py-3 text-white font-semibold rounded-lg text-sm transition-all hover:scale-105"
                  style={{ background: "linear-gradient(135deg, #2563eb 0%, #0ea5e9 100%)", boxShadow: "0 4px 20px rgba(37,99,235,0.45)" }}>
                  Request a Demo
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </a>
                <a href="#features"
                  className="inline-flex items-center gap-2 px-6 py-3 font-semibold rounded-lg text-sm transition-all border"
                  style={{ color: "#e2e8f0", borderColor: "rgba(255,255,255,0.18)", background: "rgba(255,255,255,0.05)" }}>
                  Explore Platform
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </a>
              </div>
              {/* 4 icon badges */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { icon: "M20.618 5.984A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z", label: "Enterprise Grade Security" },
                  { icon: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z", label: "AI-Powered Insights" },
                  { icon: "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15", label: "Automate & Scale" },
                  { icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z", label: "Audit Ready Always" },
                ].map(({ icon, label }) => (
                  <div key={label} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <div className="h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "rgba(37,99,235,0.2)" }}>
                      <svg className="h-4 w-4" style={{ color: "#60a5fa" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                        <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
                      </svg>
                    </div>
                    <span className="text-xs font-semibold" style={{ color: "#cbd5e1" }}>{label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right - mockup */}
            <div className="relative">
              <div className="relative rounded-2xl overflow-hidden" style={{
                boxShadow: "0 32px 80px rgba(0,0,0,0.5), 0 8px 32px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.06)",
              }}>
                <ProductMockup />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── TRUST BAR ── white */}
      <section style={{ background: "#ffffff", borderBottom: "1px solid #e2e8f0" }}>
        <div className="max-w-7xl mx-auto px-6 py-10">
          <p className="text-center text-xs font-bold uppercase tracking-widest mb-8" style={{ color: "#94a3b8" }}>
            Trusted by leading organizations worldwide
          </p>
          <div className="flex items-center justify-center flex-wrap gap-10">
            {TRUST_NAMES.map((name) => (
              <span key={name} className="text-sm font-bold tracking-wide" style={{ color: "#cbd5e1" }}>{name}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ── white, 2-col */}
      <section id="features" className="relative overflow-hidden" style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
        {/* Small stripe accent — top-right corner */}
        <div className="absolute top-0 right-0 pointer-events-none" style={{ width: 120, height: 120, zIndex: 0 }}>
          <div style={{
            position: "absolute", inset: 0,
            background: "linear-gradient(225deg, transparent 51%, #06b6d4 51%, #06b6d4 67%, #2563eb 67%, #2563eb 83%, #4f46e5 83%)",
          }} />
        </div>
        <div className="relative max-w-7xl mx-auto px-6 py-24" style={{ zIndex: 1 }}>
          <div className="grid lg:grid-cols-3 gap-16 items-start">
            {/* Left sticky text */}
            <div className="lg:col-span-1 lg:sticky lg:top-24">
              <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "#2563eb" }}>One platform. Complete control.</p>
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4 leading-tight" style={{ color: "#0f172a" }}>
                Everything You Need to{" "}
                <span style={{ color: "#2563eb" }}>Operationalize Compliance</span>
              </h2>
              <p className="text-base leading-relaxed mb-6" style={{ color: "#64748b" }}>
                From policy to evidence to audit, every workflow runs in one system. No spreadsheets, no siloed tools, no gaps between what you've done and what you can prove.
              </p>
              <a href={isSignedIn ? BASE_PATH + "/dashboard" : BASE_PATH + "/sign-up"} className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors">
                Explore all capabilities
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
              </a>
            </div>
            {/* Right: 2x3 grid */}
            <div className="lg:col-span-2 grid sm:grid-cols-2 gap-5">
              {FEATURES.map((f, i) => {
                const accent = FEATURE_ACCENTS[i % FEATURE_ACCENTS.length];
                return (
                  <div key={f.title} className="p-5 rounded-2xl border border-slate-200 bg-white hover:shadow-md hover:border-slate-300 transition-all">
                    <div className="h-11 w-11 rounded-xl flex items-center justify-center mb-4" style={{ background: `${accent}14`, color: accent }}>
                      {f.icon}
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 mb-2">{f.title}</h3>
                    <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ── INDUSTRIES ── white, left text + right cards */}
      <section className="relative overflow-hidden" style={{ background: "#ffffff", borderBottom: "1px solid #e2e8f0" }}>
        {/* Small stripe accent — bottom-right corner */}
        <div className="absolute bottom-0 right-0 pointer-events-none" style={{ width: 100, height: 100, zIndex: 0 }}>
          <div style={{
            position: "absolute", inset: 0,
            background: "linear-gradient(135deg, transparent 51%, #06b6d4 51%, #06b6d4 67%, #2563eb 67%, #2563eb 83%, #4f46e5 83%)",
          }} />
        </div>
        <div className="relative max-w-7xl mx-auto px-6 py-20" style={{ zIndex: 1 }}>
          <div className="grid lg:grid-cols-3 gap-12 items-start">
            {/* Left text */}
            <div>
              <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "#2563eb" }}>Built for highly regulated industries</p>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight leading-tight mb-4">
                Purpose-Built.<br />Industry-Ready.
              </h2>
              <p className="text-base leading-relaxed mb-6" style={{ color: "#64748b" }}>
                From the Pentagon to Wall Street. The only GRC platform with a native federal layer alongside full commercial framework coverage, one system for every obligation.
              </p>
              <a href="#" className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors">
                View all industries
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
              </a>
            </div>
            {/* Right: photo card grid */}
            <div className="lg:col-span-2 grid grid-cols-2 md:grid-cols-3 gap-3">
              {INDUSTRIES.map((ind) => (
                <div key={ind.name} className="relative rounded-2xl overflow-hidden group cursor-pointer" style={{ minHeight: 180 }}>
                  <img src={ind.photo} alt={ind.name} className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(3,7,18,0.82) 0%, rgba(3,7,18,0.18) 55%, transparent 75%)" }} />
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ background: "rgba(37,99,235,0.15)" }} />
                  <div className="relative flex flex-col justify-end h-full p-4" style={{ minHeight: 180 }}>
                    <h3 className="font-bold text-white text-xs mb-1.5 leading-tight">{ind.name}</h3>
                    <div className="flex items-center gap-1 text-xs font-semibold" style={{ color: "#60a5fa" }}>
                      Learn more
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ── dark, 2-col */}
      <section className="relative overflow-hidden" style={{ background: "linear-gradient(135deg, #0a0f1e 0%, #0d1b3e 60%, #0a1628 100%)" }}>
        {/* Three-stripe diagonal - orange / amber / indigo — bottom-RIGHT */}
        <div className="absolute pointer-events-none" style={{ bottom: 0, left: 0, right: 0, height: "65%", zIndex: 0 }}>
          <div style={{
            position: "absolute",
            inset: 0,
            background: [
              "linear-gradient(158deg,",
              "  transparent 51%,",
              "  #f59e0b 51%, #f59e0b 67%,",
              "  #ea580c 67%, #ea580c 83%,",
              "  #4f46e5 83%",
              ")"
            ].join(""),
          }} />
        </div>
        <div className="relative max-w-7xl mx-auto px-6 py-24" style={{ zIndex: 1 }}>
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: "#3b82f6" }}>Turn compliance into competitive advantage</p>
              <h2 className="font-extrabold tracking-tight leading-tight" style={{ fontSize: "clamp(2rem, 4vw, 3.25rem)" }}>
                <span className="text-white">Stop Managing Compliance.</span>
                <br />
                <span style={{ background: "linear-gradient(135deg, #60a5fa 0%, #38bdf8 60%, #06b6d4 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                  Start Owning It.
                </span>
              </h2>
            </div>
            <div>
              <p className="text-base leading-relaxed mb-8" style={{ color: "#94a3b8" }}>
                The organizations that win on compliance treat it as a system, not a project. EnterpriseComply gives your team that system, and the time to use it.
              </p>
              <a href={isSignedIn ? BASE_PATH + "/dashboard" : BASE_PATH + "/sign-up"}
                className="inline-flex items-center gap-2 px-7 py-3.5 text-white font-semibold rounded-xl text-sm transition-all hover:scale-105"
                style={{ background: "linear-gradient(135deg, #2563eb 0%, #0ea5e9 100%)", boxShadow: "0 0 32px rgba(37,99,235,0.4)" }}>
                Request a Demo
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── BOTTOM BADGES ── white */}
      <section style={{ background: "#ffffff", borderTop: "1px solid #e2e8f0" }}>
        <div className="max-w-7xl mx-auto px-6 py-16">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-10">
            {[
              { icon: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z", title: "Secure by Design", desc: "Zero-trust architecture, AES-256 encryption, and SOC 2-compliant infrastructure from day one." },
              { icon: "M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z", title: "Scalable by Nature", desc: "From Series A to Fortune 500. Multi-tenant architecture built for the volume enterprise compliance demands." },
              { icon: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z", title: "AI-Powered Insights", desc: "Control gap analysis, framework delta alerts, and risk prioritization surfaced automatically, not after the audit." },
              { icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z", title: "Always Audit Ready", desc: "Continuous evidence collection means your audit package is always current. No scramble. No gaps." },
            ].map(({ icon, title, desc }) => (
              <div key={title} className="flex flex-col gap-4">
                <div className="h-11 w-11 rounded-xl flex items-center justify-center" style={{ background: "#eff6ff" }}>
                  <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
                  </svg>
                </div>
                <div>
                  <p className="font-bold text-slate-900 text-sm mb-1">{title}</p>
                  <p className="text-xs leading-relaxed text-slate-500">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOOTER ── dark */}
      <footer style={{ background: "#030712", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        <div className="max-w-7xl mx-auto px-6 py-16">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-10 mb-14">
            {/* Brand */}
            <div className="col-span-2">
              <a href={BASE_PATH + "/"} className="flex items-center gap-2.5 mb-4">
                <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
                  <img src={`${BASE_PATH}/logo.svg`} className="h-5 w-5" alt="" />
                </div>
                <span className="font-bold text-white">ColorCodeSolutions</span>
              </a>
              <p className="text-sm leading-relaxed mb-5" style={{ color: "#475569" }}>
                The only GRC platform built federal-first. FedRAMP, CMMC, NIST 800-53, and NIST 800-171 are native, not add-ons. One control satisfies every federal and commercial obligation simultaneously.
              </p>
              <div className="flex gap-3">
                {[
                  "M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z",
                  "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z",
                  "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z",
                ].map((d, i) => (
                  <a key={i} href="#" className="h-8 w-8 rounded-lg flex items-center justify-center transition-all hover:bg-white/10" style={{ background: "rgba(255,255,255,0.05)", color: "#64748b" }}>
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d={d} /></svg>
                  </a>
                ))}
              </div>
            </div>

            {/* Link groups */}
            {Object.entries(FOOTER_LINKS).map(([group, links]) => (
              <div key={group}>
                <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: "#475569" }}>{group}</p>
                <ul className="space-y-2.5">
                  {links.map((link) => (
                    <li key={link}>
                      <a href="#" className="text-sm transition-colors" style={{ color: "#64748b" }}
                        onMouseEnter={e => (e.currentTarget.style.color = "#94a3b8")}
                        onMouseLeave={e => (e.currentTarget.style.color = "#64748b")}>
                        {link}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            {/* Newsletter */}
            <div className="col-span-2 md:col-span-1">
              <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: "#475569" }}>Stay Updated</p>
              <p className="text-sm mb-3" style={{ color: "#64748b" }}>Get the latest compliance insights and industry updates.</p>
              <div className="flex gap-2">
                <input type="email" placeholder="Enter your email" className="flex-1 min-w-0 px-3 py-2 text-sm rounded-lg outline-none"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "white" }} />
                <button className="px-3 py-2 rounded-lg text-sm font-semibold text-white flex-shrink-0 transition-colors hover:bg-blue-700"
                  style={{ background: "#2563eb" }}>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                </button>
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-8" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
            <p className="text-xs" style={{ color: "#475569" }}>
              &copy; 2026 ColorCode Solutions. All rights reserved.
            </p>
            <div className="flex items-center gap-6">
              {["Privacy Policy", "Terms of Service", "Cookie Policy"].map((link) => (
                <a key={link} href="#" className="text-xs transition-colors" style={{ color: "#475569" }}
                  onMouseEnter={e => (e.currentTarget.style.color = "#64748b")}
                  onMouseLeave={e => (e.currentTarget.style.color = "#475569")}>
                  {link}
                </a>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

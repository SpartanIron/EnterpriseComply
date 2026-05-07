import { useAuth, useClerk } from "@clerk/react";

const BASE_PATH = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

const FEATURES = [
  {
    icon: (
      <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
        {/* Circle Stack - centralized source of truth */}
        <path d="M12 2C6.48 2 2 3.79 2 6v2c0 2.21 4.48 4 10 4s10-1.79 10-4V6c0-2.21-4.48-4-10-4z" opacity="0.4" />
        <path d="M2 10v2c0 2.21 4.48 4 10 4s10-1.79 10-4v-2c-2.09 1.26-5.76 2-10 2S4.09 11.26 2 10z" opacity="0.7" />
        <path d="M2 14v2c0 2.21 4.48 4 10 4s10-1.79 10-4v-2c-2.09 1.26-5.76 2-10 2S4.09 15.26 2 14z" />
      </svg>
    ),
    title: "Unify & Standardize",
    desc: "One canonical control set drives every framework simultaneously. Update it once - all 23 frameworks reflect it instantly.",
  },
  {
    icon: (
      <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
        {/* Shield with exclamation - risk */}
        <path fillRule="evenodd" d="M11.484 2.172a.75.75 0 011.032 0 11.209 11.209 0 007.877 3.08.75.75 0 01.722.515 12.74 12.74 0 01.635 3.985c0 5.942-4.064 10.933-9.563 12.348a.749.749 0 01-.374 0C6.314 20.683 2.25 15.692 2.25 9.75c0-1.39.188-2.738.533-4.018a.75.75 0 01.722-.515 11.21 11.21 0 007.879-3.045zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zM12 15a.75.75 0 00-.75.75v.008c0 .414.336.75.75.75h.008a.75.75 0 00.75-.75v-.008a.75.75 0 00-.75-.75H12z" clipRule="evenodd" />
      </svg>
    ),
    title: "Identify & Mitigate Risk",
    desc: "Surface risks by severity, owner, and framework impact before they appear in your audit findings.",
  },
  {
    icon: (
      <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
        {/* Cog 6 tooth - automation */}
        <path fillRule="evenodd" d="M11.078 2.25c-.917 0-1.699.663-1.85 1.567L9.05 4.889c-.02.12-.115.26-.297.348a7.493 7.493 0 00-.986.57c-.166.115-.334.126-.45.083L6.3 5.508a1.875 1.875 0 00-2.282.819l-.922 1.597a1.875 1.875 0 00.432 2.385l.84.692c.095.078.17.229.154.43a7.598 7.598 0 000 1.139c.015.2-.059.352-.153.43l-.841.692a1.875 1.875 0 00-.432 2.385l.922 1.597a1.875 1.875 0 002.282.818l1.019-.382c.115-.043.283-.031.45.082.312.214.641.405.985.57.182.088.277.228.297.35l.178 1.071c.151.904.933 1.567 1.85 1.567h1.844c.916 0 1.699-.663 1.85-1.567l.178-1.072c.02-.12.114-.26.297-.349.344-.165.673-.356.985-.57.167-.114.335-.125.45-.082l1.02.382a1.875 1.875 0 002.28-.819l.923-1.597a1.875 1.875 0 00-.432-2.385l-.84-.692c-.095-.078-.17-.229-.154-.43a7.614 7.614 0 000-1.139c-.016-.2.059-.352.153-.43l.84-.692c.708-.582.891-1.59.433-2.385l-.922-1.597a1.875 1.875 0 00-2.282-.818l-1.02.382c-.114.043-.282.031-.449-.083a7.49 7.49 0 00-.985-.57c-.183-.087-.277-.227-.297-.348l-.179-1.072a1.875 1.875 0 00-1.85-1.567h-1.843zM12 15.75a3.75 3.75 0 100-7.5 3.75 3.75 0 000 7.5z" clipRule="evenodd" />
      </svg>
    ),
    title: "Automate & Streamline",
    desc: "Automate evidence collection, control testing, and workflow routing. Your team handles exceptions, not administration.",
  },
  {
    icon: (
      <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
        {/* Presentation chart line - monitor & measure */}
        <path fillRule="evenodd" d="M2.25 2.25a.75.75 0 000 1.5H3v10.5a3 3 0 003 3h1.21l-1.172 3.513a.75.75 0 001.424.474l.329-.987h8.418l.33.987a.75.75 0 001.422-.474l-1.17-3.513H18a3 3 0 003-3V3.75h.75a.75.75 0 000-1.5H2.25zm6.04 16.5l.5-1.5h6.42l.5 1.5H8.29zm7.46-12a.75.75 0 00-1.5 0v6a.75.75 0 001.5 0v-6zm-3 2.25a.75.75 0 00-1.5 0v3.75a.75.75 0 001.5 0V9zm-3 2.25a.75.75 0 00-1.5 0v1.5a.75.75 0 001.5 0v-1.5z" clipRule="evenodd" />
      </svg>
    ),
    title: "Monitor & Measure",
    desc: "Live posture scoring across every active framework. Walk into any audit with a defensible, timestamped evidence trail.",
  },
  {
    icon: (
      <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
        {/* User group - collaborate */}
        <path d="M4.5 6.375a4.125 4.125 0 118.25 0 4.125 4.125 0 01-8.25 0zM14.25 8.625a3.375 3.375 0 116.75 0 3.375 3.375 0 01-6.75 0zM1.5 19.125a7.125 7.125 0 0114.25 0v.003l-.001.119a.75.75 0 01-.363.63 13.067 13.067 0 01-6.761 1.873c-2.472 0-4.786-.684-6.76-1.873a.75.75 0 01-.364-.63l-.001-.122zM17.25 19.128l-.001.144a2.25 2.25 0 01-.233.96 10.088 10.088 0 005.06-1.01.75.75 0 00.42-.643 4.875 4.875 0 00-6.957-4.611 8.586 8.586 0 011.71 5.157v.003z" />
      </svg>
    ),
    title: "Collaborate & Assign",
    desc: "Assign controls, tasks, and approvals across teams. Every action is timestamped, attributed, and audit-logged.",
  },
  {
    icon: (
      <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
        {/* Shield check - adapt & stay ahead */}
        <path fillRule="evenodd" d="M12.516 2.17a.75.75 0 00-1.032 0 11.209 11.209 0 01-7.877 3.08.75.75 0 00-.722.515A12.74 12.74 0 002.25 9.75c0 5.942 4.064 10.933 9.563 12.348a.749.749 0 00.374 0c5.499-1.415 9.563-6.406 9.563-12.348 0-1.39-.188-2.738-.533-4.018a.75.75 0 00-.722-.515 11.21 11.21 0 01-7.879-3.045zM10.5 12.97l-1.72-1.72a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.06 0l4.5-4.5a.75.75 0 10-1.06-1.06l-3.97 3.97z" clipRule="evenodd" />
      </svg>
    ),
    title: "Adapt & Stay Ahead",
    desc: "New frameworks and requirement changes propagate automatically. Your posture updates before your auditors ask.",
  },
];

const INDUSTRIES = [
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
    name: "Government",
    desc: "FedRAMP, CMMC, NIST 800-53, and StateRAMP - all native.",
    photo: "https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=600&h=400&fit=crop&q=80",
  },
  {
    name: "Technology",
    desc: "SOC 2 Type II, ISO 27001, and GDPR from a single platform.",
    photo: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&h=400&fit=crop&q=80",
  },
  {
    name: "Manufacturing",
    desc: "CMMC, ITAR, and supply chain risk management, unified.",
    photo: "https://images.unsplash.com/photo-1565793298595-6a879b1d9492?w=600&h=400&fit=crop&q=80",
  },
];

const TRUST_NAMES = ["TechNova", "FinEdge Capital", "HealthPlus Network", "Vertex Systems", "BlueStone Group", "NorthBridge"];

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

function ProductMockup() {
  return (
    <div className="rounded-2xl overflow-hidden bg-white" style={{ boxShadow: "0 0 0 1px rgba(255,255,255,0.1)" }}>
      {/* Browser chrome */}
      <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ background: "#f8fafc", borderColor: "#e2e8f0" }}>
        <div className="h-2.5 w-2.5 rounded-full bg-red-400" />
        <div className="h-2.5 w-2.5 rounded-full bg-amber-400" />
        <div className="h-2.5 w-2.5 rounded-full bg-green-400" />
        <div className="flex-1 mx-3 h-5 rounded-md bg-white border border-slate-200 flex items-center px-3 gap-2">
          <div className="h-1.5 w-1.5 rounded-full bg-green-500 flex-shrink-0" />
          <span className="text-xs font-medium" style={{ color: "#94a3b8", fontSize: 10 }}>app.enterprisecomply.com/dashboard</span>
        </div>
      </div>

      <div className="flex" style={{ minHeight: 340 }}>
        {/* Sidebar */}
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
            {[
              { section: "OVERVIEW", items: [{ label: "Dashboard", active: true }] },
              { section: "COMPLIANCE", items: [{ label: "Frameworks" }, { label: "Controls" }, { label: "Risk Register" }] },
              { section: "EVIDENCE", items: [{ label: "Integrations" }, { label: "Monitoring" }] },
              { section: "FEDERAL", items: [{ label: "POA&M" }, { label: "SPRS Score" }] },
            ].map(({ section, items }) => (
              <div key={section} className="mb-1">
                <p className="font-bold uppercase" style={{ fontSize: 6.5, letterSpacing: "0.1em", padding: "5px 6px 2px", color: "#334155" }}>{section}</p>
                {items.map(({ label, active }: { label: string; active?: boolean }) => (
                  <div key={label} className="flex items-center gap-1.5 px-2 rounded-md" style={{ padding: "3px 6px", background: active ? "rgba(37,99,235,0.15)" : "transparent" }}>
                    <div className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ background: active ? "#3b82f6" : "#334155" }} />
                    <span style={{ fontSize: 8.5, color: active ? "#93c5fd" : "#64748b", fontWeight: active ? 600 : 400 }}>{label}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 overflow-hidden" style={{ background: "#f8fafc" }}>
          {/* Top bar */}
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

          {/* Framework grid */}
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
                      <span style={{ fontSize: 6.5, padding: "1px 5px", borderRadius: 999, background: `${fw.accent}18`, color: fw.accent, fontWeight: 600, display: "inline-block", marginTop: 2 }}>
                        {fw.tag}
                      </span>
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
      </div>
    </div>
  );
}

export default function Landing() {
  const { isSignedIn } = useAuth();

  return (
    <div style={{ fontFamily: "Inter, -apple-system, sans-serif", background: "#030712", color: "white" }}>
      <NavBar />

      {/* ── HERO ── */}
      <section className="relative overflow-hidden" style={{ background: "#ffffff", minHeight: 680 }}>
        {/* Subtle dot grid */}
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: "radial-gradient(circle, rgba(15,23,42,0.06) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }} />
        {/* Three-stripe diagonal - indigo / blue / cyan - solid, no fade */}
        <div className="absolute pointer-events-none" style={{ bottom: 0, left: 0, right: 0, height: "52%", zIndex: 0 }}>
          <div style={{
            position: "absolute",
            inset: 0,
            background: [
              "linear-gradient(22deg,",
              "  #4f46e5 0%,   #4f46e5 17%,",
              "  #2563eb 17%,  #2563eb 33%,",
              "  #06b6d4 33%,  #06b6d4 49%,",
              "  transparent 49%",
              ")"
            ].join(""),
          }} />
        </div>

        <div className="relative max-w-7xl mx-auto px-6 py-20 lg:py-28" style={{ zIndex: 2 }}>
          <div className="grid lg:grid-cols-2 gap-14 items-center">
            {/* Left */}
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-7 border"
                style={{ background: "rgba(37,99,235,0.06)", borderColor: "rgba(37,99,235,0.2)", color: "#1d4ed8" }}>
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
                by ColorCode Solutions
              </div>
              <h1 className="font-extrabold leading-tight tracking-tight mb-6" style={{ fontSize: "clamp(2.4rem, 4.5vw, 3.5rem)", color: "#0f172a" }}>
                Compliance<br />Intelligence.
                <br />
                <span style={{ background: "linear-gradient(135deg, #2563eb 0%, #0ea5e9 50%, #06b6d4 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                  One Control. Every Framework.
                </span>
              </h1>
              <p className="text-lg leading-relaxed mb-9 max-w-lg" style={{ color: "#475569" }}>
                Implement security controls that satisfy 23 compliance frameworks simultaneously. Because real compliance is proof of real security - not a substitute for it.
              </p>
              <div className="flex items-center gap-3 flex-wrap mb-10">
                <a href={isSignedIn ? BASE_PATH + "/dashboard" : BASE_PATH + "/sign-up"}
                  className="inline-flex items-center gap-2 px-6 py-3 text-white font-semibold rounded-lg text-sm transition-all hover:scale-105"
                  style={{ background: "linear-gradient(135deg, #2563eb 0%, #0ea5e9 100%)", boxShadow: "0 4px 20px rgba(37,99,235,0.35)" }}>
                  Request a Demo
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </a>
                <a href="#features"
                  className="inline-flex items-center gap-2 px-6 py-3 font-semibold rounded-lg text-sm transition-all border"
                  style={{ color: "#374151", borderColor: "rgba(15,23,42,0.18)", background: "rgba(15,23,42,0.03)" }}>
                  Explore Platform
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </a>
              </div>
              <div className="flex items-center gap-6 flex-wrap">
                {[
                  { icon: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z", label: "Bank-Grade Encryption" },
                  { icon: "M13 10V3L4 14h7v7l9-11h-7z", label: "Live in 10 Minutes" },
                  { icon: "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15", label: "No Professional Services" },
                  { icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z", label: "Continuous Monitoring" },
                ].map(({ icon, label }) => (
                  <div key={label} className="flex items-center gap-1.5 text-sm" style={{ color: "#64748b" }}>
                    <svg className="h-4 w-4 flex-shrink-0" style={{ color: "#2563eb" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
                    </svg>
                    {label}
                  </div>
                ))}
              </div>
            </div>

            {/* Right - mockup with clean elevation shadow */}
            <div className="relative">
              <div className="relative rounded-2xl overflow-hidden" style={{
                boxShadow: "0 32px 80px rgba(15,23,42,0.14), 0 8px 24px rgba(15,23,42,0.08), 0 0 0 1px rgba(15,23,42,0.06)",
              }}>
                <ProductMockup />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── TRUST BAR ── */}
      <section style={{ background: "#050d1a", borderTop: "1px solid rgba(255,255,255,0.05)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <div className="max-w-7xl mx-auto px-6 py-10">
          <p className="text-center text-xs font-semibold uppercase tracking-widest mb-8" style={{ color: "#334155" }}>
            Trusted by leading organizations worldwide
          </p>
          <div className="flex items-center justify-center flex-wrap gap-10">
            {TRUST_NAMES.map((name) => (
              <span key={name} className="text-sm font-bold tracking-wide" style={{ color: "#334155" }}>{name}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ── STATS ── */}
      <section style={{ background: "#030712", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
        <div className="max-w-7xl mx-auto px-6 py-16">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { value: "23", label: "Compliance Frameworks", sub: "SOC 2 to FedRAMP High" },
              { value: "71", label: "Universal Controls", sub: "Across 12 control domains" },
              { value: "388+", label: "Framework Mappings", sub: "Curated and kept current" },
              { value: "10 min", label: "Setup to First Score", sub: "No professional services" },
            ].map(({ value, label, sub }) => (
              <div key={label}>
                <div className="text-4xl font-extrabold tracking-tight mb-1.5" style={{ background: "linear-gradient(135deg, #3b82f6, #0ea5e9)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>{value}</div>
                <div className="text-sm font-bold text-white mb-0.5">{label}</div>
                <div className="text-xs" style={{ color: "#475569" }}>{sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── UCO SECTION ── */}
      <section style={{ background: "#050d1a", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
        <div className="max-w-7xl mx-auto px-6 py-20">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "#3b82f6" }}>Universal Control Objectives</p>
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-tight mb-5">
                <span className="text-white">Implement once.</span>
                <br />
                <span style={{ background: "linear-gradient(135deg, #3b82f6 0%, #0ea5e9 60%, #06b6d4 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                  Satisfy every framework simultaneously.
                </span>
              </h2>
              <p className="text-base leading-relaxed mb-6" style={{ color: "#64748b" }}>
                EnterpriseComply's 71 UCO controls are security controls first - not compliance checklists. When you enforce MFA, you're reducing actual risk. The fact that it simultaneously satisfies SOC 2, FedRAMP, CMMC, ISO 27001, HIPAA, and more is a consequence of implementing genuine security - not the goal of it. No duplicated work. No gaps.
              </p>
              <div className="space-y-3">
                {[
                  { label: "Security controls first.", detail: "Framework satisfaction is a consequence, not the objective." },
                  { label: "388+ authoritative mappings", detail: "maintained and kept current by our compliance team" },
                  { label: "12 control domains", detail: "from Identity to Federal - every security obligation covered" },
                ].map(({ label, detail }) => (
                  <div key={label} className="flex items-start gap-3">
                    <div className="flex-shrink-0 h-5 w-5 rounded-full flex items-center justify-center mt-0.5" style={{ background: "rgba(37,99,235,0.15)", border: "1px solid rgba(37,99,235,0.3)" }}>
                      <svg className="h-2.5 w-2.5" style={{ color: "#60a5fa" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <p className="text-sm" style={{ color: "#94a3b8" }}>
                      <span className="font-semibold text-white">{label}</span> {detail}
                    </p>
                  </div>
                ))}
              </div>
            </div>
            {/* Framework grid visual */}
            <div className="relative">
              <div className="grid grid-cols-4 gap-2">
                {[
                  { name: "SOC 2", cat: "commercial", color: "#2563eb" },
                  { name: "ISO 27001", cat: "commercial", color: "#0891b2" },
                  { name: "HIPAA", cat: "commercial", color: "#7c3aed" },
                  { name: "PCI DSS", cat: "commercial", color: "#0d9488" },
                  { name: "FedRAMP", cat: "federal", color: "#1d4ed8" },
                  { name: "CMMC L2", cat: "federal", color: "#4338ca" },
                  { name: "NIST 800-53", cat: "federal", color: "#1e40af" },
                  { name: "NIST CSF", cat: "best-practice", color: "#0369a1" },
                  { name: "GDPR", cat: "commercial", color: "#6d28d9" },
                  { name: "HITRUST", cat: "commercial", color: "#0f766e" },
                  { name: "CIS Controls", cat: "best-practice", color: "#1d4ed8" },
                  { name: "ISO 27701", cat: "commercial", color: "#5b21b6" },
                  { name: "NIST 800-171", cat: "federal", color: "#1e3a8a" },
                  { name: "StateRAMP", cat: "federal", color: "#312e81" },
                  { name: "NYCRR 500", cat: "commercial", color: "#164e63" },
                  { name: "SOX ITGC", cat: "commercial", color: "#1e3a5f" },
                  { name: "CCPA", cat: "commercial", color: "#3b0764" },
                  { name: "FedRAMP High", cat: "federal", color: "#1e3a8a" },
                  { name: "FedRAMP Low", cat: "federal", color: "#1e40af" },
                  { name: "NIST AI RMF", cat: "best-practice", color: "#065f46" },
                  { name: "CMMC L1", cat: "federal", color: "#3730a3" },
                  { name: "Cyber Essentials", cat: "commercial", color: "#0c4a6e" },
                  { name: "HITRUST CSF", cat: "commercial", color: "#134e4a" },
                ].map((fw) => (
                  <div key={fw.name} className="rounded-lg px-2 py-2 text-center" style={{ background: `${fw.color}22`, border: `1px solid ${fw.color}44` }}>
                    <p className="text-white font-semibold leading-tight" style={{ fontSize: 9 }}>{fw.name}</p>
                  </div>
                ))}
              </div>
              {/* Glow behind the grid */}
              <div className="absolute -inset-4 -z-10 rounded-3xl pointer-events-none" style={{ background: "radial-gradient(ellipse at center, rgba(37,99,235,0.08) 0%, transparent 70%)" }} />
            </div>
          </div>
        </div>
      </section>

      {/* ── SECURITY + COMPLIANCE BRIDGE ── */}
      <section style={{ background: "#ffffff", borderTop: "1px solid #f1f5f9", borderBottom: "1px solid #f1f5f9" }}>
        <div className="max-w-7xl mx-auto px-6 py-20">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "#2563eb" }}>Beyond the audit checklist</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight mb-4">
              Compliance and security<br />
              <span style={{ color: "#2563eb" }}>are not the same thing.</span>
            </h2>
            <p className="text-base text-slate-500 leading-relaxed">
              Passing an audit doesn't mean you're protected. A passed control with no implementation behind it is a liability, not an asset. EnterpriseComply is built on a different premise: start with security that actually works, then prove it to anyone who asks.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: (
                  <svg className="h-7 w-7" fill="currentColor" viewBox="0 0 24 24">
                    <path fillRule="evenodd" d="M12.516 2.17a.75.75 0 00-1.032 0 11.209 11.209 0 01-7.877 3.08.75.75 0 00-.722.515A12.74 12.74 0 002.25 9.75c0 5.942 4.064 10.933 9.563 12.348a.749.749 0 00.374 0c5.499-1.415 9.563-6.406 9.563-12.348 0-1.39-.188-2.738-.533-4.018a.75.75 0 00-.722-.515 11.21 11.21 0 01-7.879-3.045zM10.5 12.97l-1.72-1.72a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.06 0l4.5-4.5a.75.75 0 10-1.06-1.06l-3.97 3.97z" clipRule="evenodd" />
                  </svg>
                ),
                accent: "#4f46e5",
                title: "Security Controls, Not Audit Artifacts",
                body: "Every UCO control is a real security objective - MFA enforcement, access reviews, encryption at rest, incident response. The compliance framework mappings are a byproduct of implementing genuine security, not the starting point.",
              },
              {
                icon: (
                  <svg className="h-7 w-7" fill="currentColor" viewBox="0 0 24 24">
                    <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
                  </svg>
                ),
                accent: "#2563eb",
                title: "Drift Detection, Not Point-in-Time Snapshots",
                body: "Compliance status changes the moment a configuration drifts. Continuous monitoring tracks every integrated system in real time - alerting you when a passing control starts to fail, before your next audit reveals it.",
              },
              {
                icon: (
                  <svg className="h-7 w-7" fill="currentColor" viewBox="0 0 24 24">
                    <path fillRule="evenodd" d="M11.078 2.25c-.917 0-1.699.663-1.85 1.567L9.05 4.889c-.02.12-.115.26-.297.348a7.493 7.493 0 00-.986.57c-.166.115-.334.126-.45.083L6.3 5.508a1.875 1.875 0 00-2.282.819l-.922 1.597a1.875 1.875 0 00.432 2.385l.84.692c.095.078.17.229.154.43a7.598 7.598 0 000 1.139c.015.2-.059.352-.153.43l-.841.692a1.875 1.875 0 00-.432 2.385l.922 1.597a1.875 1.875 0 002.282.818l1.019-.382c.115-.043.283-.031.45.082.312.214.641.405.985.57.182.088.277.228.297.35l.178 1.071c.151.904.933 1.567 1.85 1.567h1.844c.916 0 1.699-.663 1.85-1.567l.178-1.072c.02-.12.114-.26.297-.349.344-.165.673-.356.985-.57.167-.114.335-.125.45-.082l1.02.382a1.875 1.875 0 002.28-.819l.923-1.597a1.875 1.875 0 00-.432-2.385l-.84-.692c-.095-.078-.17-.229-.154-.43a7.614 7.614 0 000-1.139c-.016-.2.059-.352.153-.43l.84-.692c.708-.582.891-1.59.433-2.385l-.922-1.597a1.875 1.875 0 00-2.282-.818l-1.02.382c-.114.043-.282.031-.449-.083a7.49 7.49 0 00-.985-.57c-.183-.087-.277-.227-.297-.348l-.179-1.072a1.875 1.875 0 00-1.85-1.567h-1.843zM12 15.75a3.75 3.75 0 100-7.5 3.75 3.75 0 000 7.5z" clipRule="evenodd" />
                  </svg>
                ),
                accent: "#0891b2",
                title: "Remediation Workflows, Not Finding Documentation",
                body: "When a gap is identified - through a risk assessment, a failing control test, or a drift alert - it becomes a tracked remediation item with an owner, a due date, and a POA&M entry. Gaps close. They don't sit in a spreadsheet.",
              },
            ].map((col) => (
              <div key={col.title} className="relative p-7 rounded-2xl border border-slate-100 bg-white">
                <div className="h-13 w-13 rounded-xl flex items-center justify-center mb-5" style={{ background: `${col.accent}12`, color: col.accent }}>
                  {col.icon}
                </div>
                <div className="absolute top-0 left-7 right-7 h-0.5 rounded-full" style={{ background: col.accent }} />
                <h3 className="text-base font-bold text-slate-900 mb-3">{col.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{col.body}</p>
              </div>
            ))}
          </div>
          <div className="mt-12 p-6 rounded-2xl border border-slate-200 bg-slate-50 text-center">
            <p className="text-sm font-semibold text-slate-700 mb-1">
              We don't help you pass audits.
            </p>
            <p className="text-sm text-slate-500">
              We help you deserve to pass them - then make the audit itself effortless.
            </p>
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" style={{ background: "#ffffff" }}>
        <div className="max-w-7xl mx-auto px-6 py-24">
          <div className="max-w-xl mb-14">
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "#2563eb" }}>Precision-built for enterprise GRC.</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-4 leading-tight">
              The Operating System<br />
              <span style={{ color: "#2563eb" }}>for Compliance.</span>
            </h2>
            <p className="text-base text-slate-500 leading-relaxed">
              From policy to evidence to audit, every workflow runs in one system. No spreadsheets, no siloed tools, no gaps between what you've done and what you can prove.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f) => (
              <div key={f.title} className="p-6 rounded-2xl border border-slate-100 bg-white hover:border-blue-200 hover:shadow-lg transition-all group">
                <div className="h-12 w-12 rounded-xl flex items-center justify-center mb-5 transition-colors group-hover:bg-blue-600"
                  style={{ background: "#eff6ff", color: "#2563eb" }}>
                  <div className="group-hover:text-white transition-colors" style={{ color: "inherit" }}>{f.icon}</div>
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-2">{f.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
                <a href="#" className="inline-flex items-center gap-1 text-sm font-semibold mt-4 text-blue-600 hover:text-blue-700 transition-colors">
                  Explore capabilities
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── INDUSTRIES ── */}
      <section style={{ background: "#050d1a" }}>
        <div className="max-w-7xl mx-auto px-6 py-24">
          <div className="text-center mb-14">
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "#3b82f6" }}>Built for highly regulated industries</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight" style={{ color: "white" }}>
              Purpose-Built. Industry-Ready.
            </h2>
            <p className="mt-3 text-base max-w-xl mx-auto" style={{ color: "#64748b" }}>
              From Wall Street to the Pentagon. The only GRC platform with a native federal layer alongside full commercial framework coverage - one system for every obligation.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {INDUSTRIES.map((ind) => (
              <div key={ind.name} className="relative rounded-2xl overflow-hidden group cursor-pointer" style={{ minHeight: 240 }}>
                {/* Real photo background */}
                <img
                  src={ind.photo}
                  alt={ind.name}
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                {/* Dark gradient overlay */}
                <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(3,7,18,0.95) 0%, rgba(3,7,18,0.7) 50%, rgba(3,7,18,0.35) 100%)" }} />
                {/* Blue tint on hover */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ background: "rgba(37,99,235,0.18)" }} />
                {/* Content */}
                <div className="relative flex flex-col justify-end h-full p-5" style={{ minHeight: 240 }}>
                  <h3 className="font-bold text-white text-sm mb-1.5">{ind.name}</h3>
                  <p className="text-xs leading-relaxed mb-3" style={{ color: "rgba(148,163,184,0.85)" }}>{ind.desc}</p>
                  <div className="flex items-center gap-1 text-xs font-semibold" style={{ color: "#60a5fa" }}>
                    Learn more
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 text-center">
            <a href="#" className="inline-flex items-center gap-2 text-sm font-semibold transition-colors" style={{ color: "#3b82f6" }}>
              View all industries
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
            </a>
          </div>
        </div>
      </section>

      {/* ── BOLD CTA ── */}
      <section style={{ background: "#030712", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
        <div className="max-w-7xl mx-auto px-6 py-24">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: "#3b82f6" }}>Stop treating compliance as overhead.</p>
              <h2 className="font-extrabold tracking-tight leading-tight" style={{ fontSize: "clamp(2rem, 4vw, 3rem)" }}>
                <span className="text-white">Stop Managing Compliance.</span>
                <br />
                <span style={{ background: "linear-gradient(135deg, #3b82f6 0%, #0ea5e9 60%, #06b6d4 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                  Start Owning It.
                </span>
              </h2>
            </div>
            <div>
              <p className="text-base leading-relaxed mb-8" style={{ color: "#64748b" }}>
                The organizations that win on compliance treat it as a system, not a project. EnterpriseComply gives your team that system - and the time to use it.
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

      {/* ── BOTTOM FEATURE BADGES ── */}
      <section style={{ background: "#050d1a", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
        <div className="max-w-7xl mx-auto px-6 py-14">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { icon: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z", title: "Secure by Design", desc: "Zero-trust architecture, AES-256 encryption, and SOC 2-compliant infrastructure from day one." },
              { icon: "M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z", title: "Scalable by Nature", desc: "From Series A to Fortune 500. Multi-tenant architecture built for the volume enterprise compliance demands." },
              { icon: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z", title: "AI-Powered Insights", desc: "Control gap analysis, framework delta alerts, and risk prioritization - surfaced automatically, not after the audit." },
              { icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z", title: "Always Audit Ready", desc: "Continuous evidence collection means your audit package is always current. No scramble. No gaps." },
            ].map(({ icon, title, desc }) => (
              <div key={title} className="flex flex-col gap-3">
                <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(37,99,235,0.12)", border: "1px solid rgba(37,99,235,0.2)" }}>
                  <svg className="h-5 w-5" style={{ color: "#60a5fa" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
                  </svg>
                </div>
                <div>
                  <p className="font-bold text-white text-sm mb-1">{title}</p>
                  <p className="text-xs leading-relaxed" style={{ color: "#475569" }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ background: "#030712", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        <div className="max-w-7xl mx-auto px-6 py-16">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-10 mb-14">
            {/* Brand */}
            <div className="col-span-2">
              <a href={BASE_PATH + "/"} className="flex items-center gap-2.5 mb-4">
                <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
                  <img src={`${BASE_PATH}/logo.svg`} className="h-5 w-5" alt="" />
                </div>
                <span className="font-bold text-white">EnterpriseComply</span>
              </a>
              <p className="text-sm leading-relaxed mb-5" style={{ color: "#475569" }}>
                EnterpriseComply maps one control to 23 compliance frameworks simultaneously - giving security and compliance teams the leverage to do more with less.
              </p>
              <div className="flex gap-3">
                {["M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"].map((d, i) => (
                  <a key={i} href="#" className="h-8 w-8 rounded-lg flex items-center justify-center transition-colors" style={{ background: "rgba(255,255,255,0.05)", color: "#475569" }}>
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d={d} /></svg>
                  </a>
                ))}
              </div>
            </div>

            {/* Link groups */}
            {Object.entries(FOOTER_LINKS).map(([group, links]) => (
              <div key={group}>
                <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: "#334155" }}>{group}</p>
                <ul className="space-y-2.5">
                  {links.map((link) => (
                    <li key={link}>
                      <a href="#" className="text-sm transition-colors" style={{ color: "#475569" }}
                        onMouseEnter={e => (e.currentTarget.style.color = "#94a3b8")}
                        onMouseLeave={e => (e.currentTarget.style.color = "#475569")}>
                        {link}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            {/* Newsletter */}
            <div className="col-span-2 md:col-span-1 lg:col-span-1">
              <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: "#334155" }}>Stay Updated</p>
              <p className="text-sm mb-3" style={{ color: "#475569" }}>Get the latest compliance insights and industry updates.</p>
              <div className="flex gap-2">
                <input type="email" placeholder="Your email" className="flex-1 min-w-0 px-3 py-2 text-sm rounded-lg outline-none"
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
            <p className="text-xs" style={{ color: "#334155" }}>
              &copy; 2026 ColorCode Solutions. All rights reserved.
            </p>
            <div className="flex items-center gap-6">
              {["Privacy Policy", "Terms of Service", "Cookie Policy"].map((link) => (
                <a key={link} href="#" className="text-xs transition-colors" style={{ color: "#334155" }}
                  onMouseEnter={e => (e.currentTarget.style.color = "#64748b")}
                  onMouseLeave={e => (e.currentTarget.style.color = "#334155")}>
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

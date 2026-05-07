import { useAuth } from "@clerk/react";

const BASE_PATH = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

const FRAMEWORKS = [
  "SOC 2 Type II", "FedRAMP Moderate", "CMMC Level 2", "ISO 27001",
  "HIPAA", "PCI DSS 4.0", "NIST 800-53", "GDPR", "StateRAMP",
  "NIST CSF 2.0", "NIST 800-171", "HITRUST CSF", "ISO 27701", "CMMC Level 1",
];

const FEATURES = [
  {
    icon: (
      <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    title: "Implement once, satisfy all",
    desc: "Our Universal Control Objectives (UCO) map one security control to every framework it applies to. Connect GitHub and watch SOC 2, FedRAMP, and ISO 27001 controls update simultaneously.",
  },
  {
    icon: (
      <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    title: "Federal-grade, built in",
    desc: "FedRAMP Moderate, CMMC Level 2, and NIST 800-53 are first-class citizens. POA&M tracking, SPRS scoring, and System Security Plan generation are included, not sold separately.",
  },
  {
    icon: (
      <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    title: "Live compliance posture",
    desc: "Real-time scores across every active framework. See exactly which controls are passing, which are failing, and what evidence is going stale before your auditor notices.",
  },
  {
    icon: (
      <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
      </svg>
    ),
    title: "Automated evidence collection",
    desc: "Integrations with GitHub, AWS, Okta, Azure AD, and 50+ more collect evidence continuously. Staleness alerts notify your team when evidence needs refreshing.",
  },
  {
    icon: (
      <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
    title: "Sales enablement, built in",
    desc: "A public Trust Center, AI-assisted security questionnaire responses, and a dedicated auditor portal to turn your compliance program into a competitive sales asset.",
  },
  {
    icon: (
      <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    title: "Policy and workforce management",
    desc: "44 policy templates, employee acknowledgment tracking, security training records, access reviews, and vendor risk management. Your entire compliance program, unified.",
  },
];

const COMPARE_ROWS = [
  { feature: "FedRAMP Moderate / High support", cc: true, vanta: false, drata: false },
  { feature: "CMMC Level 1 & 2 support", cc: true, vanta: false, drata: false },
  { feature: "POA&M tracking", cc: true, vanta: false, drata: false },
  { feature: "SPRS score calculation", cc: true, vanta: false, drata: false },
  { feature: "System Security Plan (SSP) generator", cc: true, vanta: false, drata: false },
  { feature: "UCO cross-framework control mapping", cc: true, vanta: false, drata: false },
  { feature: "775+ framework control mappings", cc: true, vanta: "partial", drata: "partial" },
  { feature: "Automated questionnaire pre-fill", cc: true, vanta: true, drata: true },
  { feature: "SOC 2 / ISO 27001 / HIPAA / GDPR", cc: true, vanta: true, drata: true },
  { feature: "Continuous evidence collection", cc: true, vanta: true, drata: true },
  { feature: "Risk register with heat map", cc: true, vanta: true, drata: true },
  { feature: "Auditor portal", cc: true, vanta: true, drata: true },
];

const STEPS = [
  {
    num: "1",
    title: "Connect your tools",
    desc: "Connect GitHub, AWS, Okta, Azure AD, and 50+ integrations in minutes. No engineering work required.",
  },
  {
    num: "2",
    title: "See your compliance score",
    desc: "EnterpriseComply instantly maps your controls across all active frameworks and shows exactly where you stand.",
  },
  {
    num: "3",
    title: "Close gaps and get certified",
    desc: "Guided remediation, automated evidence packages, and auditor portal access get you to certification faster.",
  },
];

function NavBar() {
  const { isSignedIn } = useAuth();
  return (
    <nav className="sticky top-0 z-50 bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-16">
        <a href={BASE_PATH + "/"} className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
            <img src={`${BASE_PATH}/logo.svg`} className="h-5 w-5" alt="" />
          </div>
          <span className="text-slate-900 font-bold text-base tracking-tight">EnterpriseComply</span>
        </a>

        <div className="hidden md:flex items-center gap-8">
          {["Features", "Frameworks", "Federal"].map((label) => (
            <a key={label} href="#" className="text-sm text-slate-600 hover:text-slate-900 font-medium transition-colors">
              {label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <a
            href={BASE_PATH + "/sign-in"}
            className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors px-3 py-2"
          >
            Sign in
          </a>
          <a
            href={isSignedIn ? BASE_PATH + "/dashboard" : BASE_PATH + "/sign-up"}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
          >
            {isSignedIn ? "Go to app" : "Get started free"}
          </a>
        </div>
      </div>
    </nav>
  );
}

function ProductMockup() {
  return (
    <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-2xl shadow-slate-200/80 bg-white">
      {/* Browser chrome */}
      <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 border-b border-slate-200">
        <div className="h-3 w-3 rounded-full bg-slate-300" />
        <div className="h-3 w-3 rounded-full bg-slate-300" />
        <div className="h-3 w-3 rounded-full bg-slate-300" />
        <div className="flex-1 mx-3 h-6 rounded-md bg-white border border-slate-200 flex items-center px-3 gap-2">
          <div className="h-1.5 w-1.5 rounded-full bg-green-500 flex-shrink-0" />
          <span className="text-xs text-slate-400 font-medium">app.enterprisecomply.com/dashboard</span>
        </div>
      </div>

      {/* App shell */}
      <div className="flex" style={{ minHeight: 360 }}>
        {/* Sidebar */}
        <div className="w-36 bg-white border-r border-slate-100 flex flex-col flex-shrink-0">
          <div className="flex items-center gap-2 px-3 py-3 border-b border-slate-100">
            <div className="h-6 w-6 rounded-md bg-blue-600 flex items-center justify-center flex-shrink-0">
              <img src={`${BASE_PATH}/logo.svg`} className="h-3.5 w-3.5" alt="" />
            </div>
            <div>
              <p className="text-slate-900 font-bold leading-none" style={{ fontSize: 10 }}>EnterpriseComply</p>
              <p className="text-slate-400" style={{ fontSize: 8, marginTop: 1 }}>Acme Corp</p>
            </div>
          </div>
          <div className="px-2 py-2 space-y-0.5 flex-1">
            {[
              { section: "OVERVIEW", items: ["Dashboard"] },
              { section: "COMPLIANCE", items: ["Frameworks", "Controls"] },
              { section: "EVIDENCE", items: ["Integrations", "Monitoring"] },
              { section: "FEDERAL", items: ["POA&M", "SPRS Score"] },
            ].map(({ section, items }) => (
              <div key={section}>
                <p className="text-slate-400 font-bold uppercase" style={{ fontSize: 7, letterSpacing: "0.08em", padding: "6px 8px 3px" }}>{section}</p>
                {items.map((item) => (
                  <div key={item} className={`flex items-center gap-1.5 px-2 py-1 rounded-md ${item === "Dashboard" ? "bg-blue-50" : ""}`}>
                    <div className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${item === "Dashboard" ? "bg-blue-600" : "bg-slate-300"}`} />
                    <span className={`${item === "Dashboard" ? "text-blue-700 font-semibold" : "text-slate-500"}`} style={{ fontSize: 9 }}>{item}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Main */}
        <div className="flex-1 bg-slate-50 overflow-hidden">
          {/* Hero banner */}
          <div className="px-4 py-3" style={{ background: "linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)" }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <svg width="40" height="40" className="flex-shrink-0">
                  <circle cx="20" cy="20" r="15" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="3.5" />
                  <circle cx="20" cy="20" r="15" fill="none" stroke="#4ade80" strokeWidth="3.5"
                    strokeDasharray={`${0.78 * 2 * Math.PI * 15} ${2 * Math.PI * 15}`}
                    strokeLinecap="round" transform="rotate(-90 20 20)" />
                  <text x="20" y="24" textAnchor="middle" fontSize="9" fontWeight="bold" fill="white">78</text>
                </svg>
                <div>
                  <p style={{ fontSize: 8, color: "rgba(147,197,253,0.9)", fontWeight: 600 }}>ACME CORP - LIVE POSTURE</p>
                  <p style={{ fontSize: 11, color: "white", fontWeight: 700, marginTop: 1 }}>Good morning, Sarah</p>
                  <p style={{ fontSize: 8, color: "rgba(147,197,253,0.8)", marginTop: 1 }}>4 frameworks active - 78% compliant</p>
                </div>
              </div>
              <div className="px-2 py-1 rounded bg-white">
                <span style={{ fontSize: 8, color: "#1d4ed8", fontWeight: 700 }}>+ Framework</span>
              </div>
            </div>
          </div>

          {/* KPI row */}
          <div className="grid gap-2 p-3" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
            {[
              { label: "Passing Controls", value: "31", color: "#22c55e" },
              { label: "Failing Controls", value: "3", color: "#ef4444" },
              { label: "Not Tested", value: "7", color: "#f59e0b" },
            ].map((card) => (
              <div key={card.label} className="rounded-lg bg-white border border-slate-200 overflow-hidden">
                <div className="h-0.5" style={{ background: card.color }} />
                <div className="p-2">
                  <p className="font-bold text-slate-900" style={{ fontSize: 14 }}>{card.value}</p>
                  <p className="text-slate-500" style={{ fontSize: 8, marginTop: 1 }}>{card.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Framework cards */}
          <div className="grid gap-2 px-3 pb-3" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
            {[
              { name: "SOC 2 Type II", score: 84, accent: "#2563eb", tag: "Commercial", pass: 22, fail: 2 },
              { name: "FedRAMP Moderate", score: 61, accent: "#7c3aed", tag: "Federal", pass: 16, fail: 4 },
            ].map((fw) => (
              <div key={fw.name} className="rounded-lg bg-white border border-slate-200 overflow-hidden">
                <div className="h-0.5" style={{ background: fw.accent }} />
                <div className="p-2">
                  <div className="flex items-start justify-between mb-1.5">
                    <div>
                      <p className="font-bold text-slate-900" style={{ fontSize: 9, lineHeight: 1.2 }}>{fw.name}</p>
                      <span className="inline-block mt-1 font-semibold" style={{ fontSize: 7, padding: "1px 5px", borderRadius: 999, background: fw.accent === "#2563eb" ? "#eff6ff" : "#f5f3ff", color: fw.accent }}>
                        {fw.tag}
                      </span>
                    </div>
                    <svg width="30" height="30" className="flex-shrink-0">
                      <circle cx="15" cy="15" r="10" fill="none" stroke="#f1f5f9" strokeWidth="3" />
                      <circle cx="15" cy="15" r="10" fill="none"
                        stroke={fw.score >= 75 ? "#16a34a" : "#f59e0b"} strokeWidth="3"
                        strokeDasharray={`${(fw.score / 100) * 2 * Math.PI * 10} ${2 * Math.PI * 10}`}
                        strokeLinecap="round" transform="rotate(-90 15 15)" />
                      <text x="15" y="18" textAnchor="middle" fontSize="6" fontWeight="bold" fill={fw.score >= 75 ? "#16a34a" : "#d97706"}>{fw.score}%</text>
                    </svg>
                  </div>
                  <div className="flex gap-1">
                    {[{ v: fw.pass, l: "Pass", bg: "#f0fdf4", t: "#15803d" }, { v: fw.fail, l: "Fail", bg: "#fef2f2", t: "#dc2626" }].map((x) => (
                      <div key={x.l} className="flex-1 rounded text-center py-0.5" style={{ background: x.bg }}>
                        <p className="font-bold" style={{ fontSize: 10, color: x.t }}>{x.v}</p>
                        <p style={{ fontSize: 7, color: x.t }}>{x.l}</p>
                      </div>
                    ))}
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
    <div className="bg-white text-slate-900" style={{ fontFamily: "Inter, -apple-system, sans-serif" }}>
      <NavBar />

      {/* ── HERO ── */}
      <section className="relative overflow-hidden" style={{ background: "linear-gradient(180deg, #f8faff 0%, #ffffff 100%)" }}>
        <div className="max-w-7xl mx-auto px-6 py-20 lg:py-28">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left copy */}
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-100 text-blue-700 text-xs font-semibold mb-6">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                The only GRC platform with a built-in federal layer
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-[52px] font-extrabold text-slate-900 leading-tight tracking-tight mb-6">
                One platform.<br />
                <span className="text-blue-600">Every framework.</span>
              </h1>
              <p className="text-lg text-slate-600 leading-relaxed mb-8 max-w-lg">
                EnterpriseComply automates SOC 2, FedRAMP, CMMC, ISO 27001, HIPAA, and 18 more frameworks. Implement one control and satisfy every framework it maps to, simultaneously.
              </p>
              <div className="flex items-center gap-3 flex-wrap mb-8">
                <a
                  href={isSignedIn ? BASE_PATH + "/dashboard" : BASE_PATH + "/sign-up"}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors text-sm shadow-sm shadow-blue-200"
                >
                  Start for free
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </a>
                <a
                  href={BASE_PATH + "/sign-in"}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-white text-slate-700 font-semibold rounded-lg hover:bg-slate-50 transition-colors text-sm border border-slate-200"
                >
                  Sign in to your account
                </a>
              </div>
              <div className="flex items-center gap-5 flex-wrap">
                {[
                  { icon: "M5 13l4 4L19 7", label: "No credit card required" },
                  { icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z", label: "10-minute setup" },
                  { icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z", label: "23 frameworks included" },
                ].map(({ icon, label }) => (
                  <div key={label} className="flex items-center gap-1.5 text-sm text-slate-500">
                    <svg className="h-4 w-4 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
                    </svg>
                    {label}
                  </div>
                ))}
              </div>
            </div>

            {/* Right product screenshot */}
            <div className="relative">
              <div className="absolute -inset-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-3xl" />
              <div className="relative">
                <ProductMockup />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FRAMEWORK TICKER ── */}
      <section className="border-t border-b border-slate-100 bg-slate-50 py-5 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <p className="text-center text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">
            23 compliance frameworks supported
          </p>
          <div className="flex flex-wrap gap-2 justify-center">
            {FRAMEWORKS.map((fw) => (
              <span key={fw} className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold bg-white border border-slate-200 text-slate-600 shadow-sm">
                {fw}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── STATS ── */}
      <section className="py-16 bg-white border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { value: "23", label: "Compliance frameworks" },
              { value: "71", label: "Universal controls" },
              { value: "775+", label: "Framework mappings" },
              { value: "10 min", label: "Setup to first score" },
            ].map(({ value, label }) => (
              <div key={label}>
                <div className="text-4xl font-extrabold text-slate-900 tracking-tight">{value}</div>
                <div className="text-sm text-slate-500 mt-2 font-medium">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES GRID ── */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-4">
              Everything your compliance program needs
            </h2>
            <p className="text-lg text-slate-500 max-w-2xl mx-auto">
              From evidence collection to auditor portals, every capability is included. No modules, no add-ons.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f) => (
              <div key={f.title} className="p-6 rounded-xl border border-slate-200 bg-white hover:border-blue-200 hover:shadow-md transition-all">
                <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center mb-4">
                  {f.icon}
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-2">{f.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── UCO EXPLAINER ── */}
      <section className="py-20 bg-slate-50 border-t border-slate-100">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-14 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-100 text-blue-700 text-xs font-semibold mb-5">
                Universal Control Objectives (UCO)
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-5">
                One control.<br />Every framework it covers.
              </h2>
              <p className="text-slate-600 leading-relaxed mb-6 text-base">
                Traditional GRC tools make you map the same control to every framework manually. EnterpriseComply's UCO system does this automatically: implement MFA once and it satisfies IA-2 in FedRAMP, CC6.1 in SOC 2, 3.5.3 in CMMC, and A.9.4.2 in ISO 27001 at the same time.
              </p>
              <ul className="space-y-3">
                {[
                  "71 universal controls across 16 security domains",
                  "775+ authoritative framework mappings included",
                  "New frameworks inherit your existing control work instantly",
                ].map((point) => (
                  <li key={point} className="flex items-start gap-3 text-sm text-slate-600">
                    <svg className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {point}
                  </li>
                ))}
              </ul>
            </div>

            {/* UCO mapping visual */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <div className="text-center mb-5">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Example: MFA Enforcement Control</p>
              </div>
              {/* Center node */}
              <div className="flex justify-center mb-6">
                <div className="flex items-center gap-3 px-5 py-3 rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-100">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <div>
                    <div className="text-xs font-bold opacity-75 uppercase tracking-wide">UCO-AI-001</div>
                    <div className="text-sm font-bold">Multi-Factor Authentication</div>
                  </div>
                </div>
              </div>
              {/* Framework mapping pills */}
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { fw: "FedRAMP Moderate", ctrl: "IA-2(1)", color: "bg-violet-50 border-violet-200 text-violet-700" },
                  { fw: "SOC 2 Type II", ctrl: "CC6.1", color: "bg-blue-50 border-blue-200 text-blue-700" },
                  { fw: "CMMC Level 2", ctrl: "IA.L2-3.5.3", color: "bg-indigo-50 border-indigo-200 text-indigo-700" },
                  { fw: "ISO 27001", ctrl: "A.9.4.2", color: "bg-cyan-50 border-cyan-200 text-cyan-700" },
                  { fw: "NIST 800-53", ctrl: "IA-2", color: "bg-slate-50 border-slate-200 text-slate-700" },
                  { fw: "HIPAA", ctrl: "164.312(d)", color: "bg-green-50 border-green-200 text-green-700" },
                  { fw: "PCI DSS 4.0", ctrl: "8.4.2", color: "bg-orange-50 border-orange-200 text-orange-700" },
                  { fw: "NIST CSF 2.0", ctrl: "PR.AA-01", color: "bg-teal-50 border-teal-200 text-teal-700" },
                ].map(({ fw, ctrl, color }) => (
                  <div key={fw} className={`flex items-center justify-between px-3 py-2 rounded-lg border ${color} text-xs`}>
                    <span className="font-semibold truncate mr-2">{fw}</span>
                    <span className="font-mono font-bold flex-shrink-0 opacity-80">{ctrl}</span>
                  </div>
                ))}
              </div>
              <p className="text-center text-xs text-slate-400 mt-4">Implement once - all 8 frameworks updated automatically</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="py-20 bg-white border-t border-slate-100">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-4">
              Up and running in under 10 minutes
            </h2>
            <p className="text-lg text-slate-500">No professional services. No six-month implementations.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 relative">
            <div className="hidden md:block absolute top-8 left-1/3 right-1/3 h-px bg-slate-200" style={{ left: "calc(16.5% + 28px)", right: "calc(16.5% + 28px)" }} />
            {STEPS.map((step, i) => (
              <div key={step.num} className="text-center relative">
                <div className="w-14 h-14 rounded-full bg-blue-600 text-white flex items-center justify-center text-lg font-extrabold mx-auto mb-5 shadow-md shadow-blue-100 relative z-10">
                  {step.num}
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-3">{step.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed max-w-xs mx-auto">{step.desc}</p>
                {i < STEPS.length - 1 && (
                  <div className="hidden md:block absolute top-7 left-1/2 w-full h-px bg-slate-200 z-0" style={{ left: "calc(50% + 28px)", right: "auto", width: "calc(100% - 28px)" }} />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEDERAL CALLOUT ── */}
      <section className="py-20 border-t border-slate-100" style={{ background: "linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 60%, #2563eb 100%)" }}>
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 text-blue-100 text-xs font-semibold mb-5 border border-white/20">
                Built for government contractors
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-5">
                The federal compliance platform competitors can't match
              </h2>
              <p className="text-blue-100 leading-relaxed mb-6 text-base">
                Vanta and Drata don't support FedRAMP, CMMC, or NIST 800-171 at the control level. EnterpriseComply was purpose-built for organizations that sell to the federal government.
              </p>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { title: "POA&M Tracking", desc: "Create and manage Plans of Action and Milestones" },
                  { title: "SPRS Score", desc: "Real-time CMMC/NIST 800-171 score calculation" },
                  { title: "SSP Generator", desc: "Automated System Security Plan document creation" },
                  { title: "FedRAMP High/Low/Mod", desc: "All three FedRAMP baselines supported natively" },
                ].map(({ title, desc }) => (
                  <div key={title} className="p-4 rounded-xl bg-white/10 border border-white/15">
                    <div className="flex items-center gap-2 mb-1.5">
                      <svg className="h-4 w-4 text-green-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-white font-bold text-sm">{title}</span>
                    </div>
                    <p className="text-blue-200 text-xs leading-relaxed">{desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* SPRS score card */}
            <div className="bg-white rounded-2xl overflow-hidden shadow-2xl shadow-blue-900/30">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">SPRS Score</p>
                  <p className="text-base font-bold text-slate-900 mt-0.5">CMMC / NIST 800-171</p>
                </div>
                <span className="px-2.5 py-1 bg-violet-50 text-violet-700 text-xs font-semibold rounded-lg border border-violet-100">Federal</span>
              </div>
              <div className="p-5">
                <div className="flex items-center gap-5 mb-5">
                  <div className="text-5xl font-extrabold text-slate-900">-43</div>
                  <div>
                    <div className="text-sm font-semibold text-amber-600 mb-0.5">Needs improvement</div>
                    <div className="text-xs text-slate-500">Target score: -15 or higher for contracts</div>
                    <div className="h-1.5 w-40 bg-slate-100 rounded-full mt-2">
                      <div className="h-1.5 bg-amber-400 rounded-full" style={{ width: "57%" }} />
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  {[
                    { ctrl: "3.5.3 MFA", status: "passing", pts: "+5" },
                    { ctrl: "3.1.1 Access Control", status: "passing", pts: "+5" },
                    { ctrl: "3.14.1 Patch Mgmt", status: "failing", pts: "-5" },
                    { ctrl: "3.13.8 Encryption", status: "failing", pts: "-5" },
                  ].map(({ ctrl, status, pts }) => (
                    <div key={ctrl} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                      <div className="flex items-center gap-2">
                        <div className={`h-2 w-2 rounded-full flex-shrink-0 ${status === "passing" ? "bg-green-500" : "bg-red-400"}`} />
                        <span className="text-xs font-medium text-slate-700">{ctrl}</span>
                      </div>
                      <span className={`text-xs font-bold ${status === "passing" ? "text-green-600" : "text-red-500"}`}>{pts}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
                  <p className="text-xs font-semibold text-blue-700">3 controls failing - remediate to reach -28</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── COMPARISON TABLE ── */}
      <section className="py-20 bg-white border-t border-slate-100">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-4">
              How we compare
            </h2>
            <p className="text-slate-500 text-lg">Especially for organizations with federal requirements.</p>
          </div>
          <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left text-sm font-semibold text-slate-700 px-5 py-4">Feature</th>
                  <th className="text-center px-5 py-4">
                    <div className="flex flex-col items-center gap-1">
                      <div className="h-7 w-7 rounded-lg bg-blue-600 flex items-center justify-center">
                        <img src={`${BASE_PATH}/logo.svg`} className="h-4 w-4" alt="" />
                      </div>
                      <span className="text-sm font-bold text-blue-600">EnterpriseComply</span>
                    </div>
                  </th>
                  <th className="text-center px-5 py-4">
                    <div className="flex flex-col items-center gap-1">
                      <div className="h-7 w-7 rounded-lg bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-500">V</div>
                      <span className="text-sm font-semibold text-slate-500">Vanta</span>
                    </div>
                  </th>
                  <th className="text-center px-5 py-4">
                    <div className="flex flex-col items-center gap-1">
                      <div className="h-7 w-7 rounded-lg bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-500">D</div>
                      <span className="text-sm font-semibold text-slate-500">Drata</span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {COMPARE_ROWS.map((row, i) => (
                  <tr key={row.feature} className={i % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                    <td className="text-sm text-slate-700 px-5 py-3.5 font-medium">{row.feature}</td>
                    {[row.cc, row.vanta, row.drata].map((val, j) => (
                      <td key={j} className="text-center px-5 py-3.5">
                        {val === true ? (
                          <svg className="h-5 w-5 text-green-500 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        ) : val === false ? (
                          <svg className="h-4 w-4 text-slate-300 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        ) : (
                          <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">Partial</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section className="py-24 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <p className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-3">Pricing</p>
            <h2 className="text-3xl font-extrabold text-slate-900 mb-4">Simple, transparent pricing</h2>
            <p className="text-slate-500 text-base max-w-xl mx-auto">Start free, scale as you grow. Every plan includes unlimited frameworks, automated evidence collection, and continuous monitoring.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6 items-stretch">
            {/* Startup */}
            <div className="bg-white border border-slate-200 rounded-2xl p-8 flex flex-col shadow-sm hover:shadow-md transition-shadow">
              <div className="mb-6">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Startup</p>
                <div className="flex items-end gap-1 mb-3">
                  <span className="text-4xl font-extrabold text-slate-900">$299</span>
                  <span className="text-slate-400 text-sm mb-1.5">/month</span>
                </div>
                <p className="text-sm text-slate-500">For early-stage companies starting their compliance journey.</p>
              </div>
              <ul className="space-y-3 flex-1 mb-8">
                {[
                  "Up to 3 compliance frameworks",
                  "41 Universal Controls",
                  "6 integration connectors",
                  "Automated evidence collection",
                  "Policy templates library",
                  "Trust Center page",
                  "Email support",
                ].map(f => (
                  <li key={f} className="flex items-center gap-2.5 text-sm text-slate-600">
                    <svg className="h-4 w-4 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
              <a href={BASE_PATH + "/sign-up"} className="block text-center px-6 py-3 border border-blue-600 text-blue-600 font-semibold rounded-lg hover:bg-blue-50 transition-colors text-sm">
                Start free trial
              </a>
            </div>

            {/* Business - highlighted */}
            <div className="bg-blue-600 rounded-2xl p-8 flex flex-col shadow-xl ring-2 ring-blue-500 relative">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                <span className="px-4 py-1 bg-amber-400 text-amber-900 text-xs font-extrabold rounded-full shadow-sm uppercase tracking-wide">Most popular</span>
              </div>
              <div className="mb-6">
                <p className="text-xs font-bold text-blue-200 uppercase tracking-widest mb-2">Business</p>
                <div className="flex items-end gap-1 mb-3">
                  <span className="text-4xl font-extrabold text-white">$799</span>
                  <span className="text-blue-200 text-sm mb-1.5">/month</span>
                </div>
                <p className="text-sm text-blue-100">For growth-stage companies across commercial and federal markets.</p>
              </div>
              <ul className="space-y-3 flex-1 mb-8">
                {[
                  "Unlimited frameworks",
                  "All 12 frameworks incl. FedRAMP",
                  "25 integration connectors",
                  "AI Gap Analysis + roadmap",
                  "Risk Register + heat map",
                  "Auditor Portal access",
                  "POA&M + SPRS scoring",
                  "SSP Generator",
                  "Priority support + Slack",
                ].map(f => (
                  <li key={f} className="flex items-center gap-2.5 text-sm text-blue-50">
                    <svg className="h-4 w-4 text-blue-200 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
              <a href={BASE_PATH + "/sign-up"} className="block text-center px-6 py-3 bg-white text-blue-600 font-bold rounded-lg hover:bg-blue-50 transition-colors text-sm shadow-sm">
                Start free trial
              </a>
            </div>

            {/* Enterprise */}
            <div className="bg-slate-900 rounded-2xl p-8 flex flex-col shadow-sm hover:shadow-md transition-shadow">
              <div className="mb-6">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Enterprise</p>
                <div className="flex items-end gap-1 mb-3">
                  <span className="text-4xl font-extrabold text-white">Custom</span>
                </div>
                <p className="text-sm text-slate-400">For large organizations with complex multi-framework requirements.</p>
              </div>
              <ul className="space-y-3 flex-1 mb-8">
                {[
                  "Everything in Business",
                  "Unlimited users and orgs",
                  "Custom framework builder",
                  "SSO / SAML integration",
                  "Dedicated CSM",
                  "SLA guarantees",
                  "Custom evidence workflows",
                  "On-prem deployment option",
                  "FedRAMP High support",
                ].map(f => (
                  <li key={f} className="flex items-center gap-2.5 text-sm text-slate-300">
                    <svg className="h-4 w-4 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
              <a href="mailto:sales@enterprisecomply.com" className="block text-center px-6 py-3 bg-slate-700 text-white font-semibold rounded-lg hover:bg-slate-600 transition-colors text-sm">
                Talk to sales
              </a>
            </div>
          </div>
          <p className="text-center text-xs text-slate-400 mt-8">All plans include 14-day free trial. No credit card required to start.</p>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="py-20 bg-slate-900 border-t border-slate-200">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-5">
            Your compliance program starts today.
          </h2>
          <p className="text-slate-400 text-lg mb-8">
            Connect your tools, get your score, and start closing gaps in under 10 minutes. No credit card required.
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <a
              href={isSignedIn ? BASE_PATH + "/dashboard" : BASE_PATH + "/sign-up"}
              className="inline-flex items-center gap-2 px-8 py-3.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-500 transition-colors text-sm"
            >
              {isSignedIn ? "Go to dashboard" : "Start for free"}
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </a>
            <a
              href={BASE_PATH + "/sign-in"}
              className="inline-flex items-center px-8 py-3.5 text-slate-300 font-semibold rounded-lg hover:text-white transition-colors text-sm border border-slate-700 hover:border-slate-500"
            >
              Sign in
            </a>
          </div>
          <p className="text-slate-500 text-sm mt-6">No credit card required. Free tier available. Enterprise pricing on request.</p>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-slate-950 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
            <div>
              <div className="flex items-center gap-2.5 mb-3">
                <div className="h-7 w-7 rounded-lg bg-blue-600 flex items-center justify-center">
                  <img src={`${BASE_PATH}/logo.svg`} className="h-4 w-4" alt="" />
                </div>
                <span className="text-white font-bold text-sm">EnterpriseComply</span>
              </div>
              <p className="text-slate-500 text-xs max-w-xs">GRC automation for organizations that can't afford compliance failures.</p>
              <a href="https://colorcodesolutions.com" target="_blank" rel="noopener noreferrer" className="text-xs text-slate-600 hover:text-slate-400 transition-colors mt-1 inline-block">by ColorCode Solutions</a>
            </div>
            <div className="flex items-center gap-6 flex-wrap">
              <a href="https://colorcodesolutions.com/privacy" target="_blank" rel="noopener noreferrer" className="text-sm text-slate-500 hover:text-slate-300 transition-colors">Privacy Policy</a>
              <a href="https://colorcodesolutions.com/terms" target="_blank" rel="noopener noreferrer" className="text-sm text-slate-500 hover:text-slate-300 transition-colors">Terms of Service</a>
              <a href="https://colorcodesolutions.com/security" target="_blank" rel="noopener noreferrer" className="text-sm text-slate-500 hover:text-slate-300 transition-colors">Security</a>
              <a href="mailto:support@colorcodesolutions.com" className="text-sm text-slate-500 hover:text-slate-300 transition-colors">Contact</a>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-slate-600">
              &copy; {new Date().getFullYear()}{" "}
              <a href="https://colorcodesolutions.com" target="_blank" rel="noopener noreferrer" className="hover:text-slate-400 transition-colors">
                ColorCode Solutions, Inc.
              </a>{" "}
              All rights reserved.
            </p>
            <p className="text-xs text-slate-600">
              SOC 2 Type II certified &bull; FedRAMP In Progress &bull; ISO 27001 certified
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

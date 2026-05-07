import { useEffect, useRef, useState } from "react";

const BASE_PATH = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

const FRAMEWORKS = [
  "SOC 2 Type II", "FedRAMP Moderate", "CMMC Level 2", "ISO 27001",
  "HIPAA", "PCI DSS 4.0", "NIST 800-53", "GDPR", "DORA",
  "CIS Controls v8", "NIST 800-171", "StateRAMP",
];

const INTEGRATIONS = [
  {
    name: "GitHub", color: "#24292e",
    icon: <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>,
  },
  {
    name: "AWS", color: "#FF9900",
    icon: <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M6.763 10.036c0 .296.032.535.088.71.064.176.144.368.256.576.04.063.056.127.056.183 0 .08-.048.16-.152.24l-.503.335a.383.383 0 0 1-.208.072c-.08 0-.16-.04-.239-.112a2.47 2.47 0 0 1-.287-.375 6.18 6.18 0 0 1-.248-.471c-.622.734-1.405 1.101-2.347 1.101-.67 0-1.205-.191-1.596-.574-.391-.383-.59-.894-.59-1.533 0-.678.239-1.23.726-1.644.487-.415 1.133-.623 1.955-.623.272 0 .551.024.846.064.296.04.6.104.918.176v-.583c0-.607-.127-1.030-.375-1.277-.255-.248-.686-.367-1.3-.367-.28 0-.568.031-.863.103-.295.072-.583.16-.862.272a2.287 2.287 0 0 1-.28.104.488.488 0 0 1-.127.023c-.112 0-.168-.08-.168-.247v-.391c0-.128.016-.224.056-.28a.597.597 0 0 1 .224-.167c.279-.144.614-.264 1.005-.36a4.84 4.84 0 0 1 1.246-.151c.95 0 1.644.216 2.091.647.439.43.662 1.085.662 1.963v2.586zm-3.24 1.214c.263 0 .534-.048.822-.144.287-.096.543-.271.758-.51.128-.152.224-.32.272-.512.047-.191.08-.423.08-.694v-.335a6.66 6.66 0 0 0-.735-.136 6.02 6.02 0 0 0-.75-.048c-.535 0-.926.104-1.19.32-.263.215-.39.518-.39.917 0 .375.095.655.295.846.191.2.47.296.838.296zm6.41.862c-.144 0-.24-.024-.304-.08-.063-.048-.12-.16-.168-.311L7.586 5.55a1.398 1.398 0 0 1-.072-.32c0-.128.064-.2.191-.2h.783c.151 0 .255.025.31.08.065.048.113.16.16.312l1.342 5.284 1.245-5.284c.04-.16.088-.264.151-.312a.549.549 0 0 1 .32-.08h.638c.152 0 .256.025.32.08.063.048.12.16.151.312l1.261 5.348 1.381-5.348c.048-.16.104-.264.16-.312a.52.52 0 0 1 .311-.08h.743c.127 0 .2.065.2.2 0 .04-.009.08-.017.128a1.137 1.137 0 0 1-.056.2l-1.923 6.17c-.048.16-.104.263-.168.311a.51.51 0 0 1-.303.08h-.687c-.151 0-.255-.024-.32-.08-.063-.056-.119-.16-.15-.32l-1.238-5.148-1.23 5.14c-.04.16-.087.264-.15.32-.065.056-.177.08-.32.08zm10.256.215c-.415 0-.83-.048-1.229-.143-.399-.096-.71-.2-.918-.32-.128-.071-.215-.151-.247-.223a.563.563 0 0 1-.048-.224v-.407c0-.167.064-.247.183-.247.048 0 .096.008.144.024.048.016.12.048.2.08.271.12.566.215.878.279.319.064.63.096.95.096.503 0 .894-.088 1.165-.264a.86.86 0 0 0 .415-.758.777.777 0 0 0-.215-.559c-.144-.151-.415-.287-.807-.415l-1.157-.36c-.583-.183-1.014-.454-1.277-.813a1.902 1.902 0 0 1-.4-1.158c0-.335.073-.63.216-.886.144-.255.335-.479.575-.662.24-.184.51-.32.83-.415.32-.096.655-.136 1.006-.136.175 0 .359.008.535.032.183.024.35.056.518.088.16.04.312.08.455.127.144.048.256.096.336.144a.69.69 0 0 1 .24.2.43.43 0 0 1 .071.263v.375c0 .168-.064.256-.184.256a.83.83 0 0 1-.303-.096 3.652 3.652 0 0 0-1.532-.311c-.455 0-.815.071-1.062.223-.248.152-.375.383-.375.71 0 .224.08.416.24.567.159.152.454.304.877.44l1.134.358c.574.184.99.44 1.237.767.247.327.367.702.367 1.117 0 .343-.072.655-.207.926-.144.272-.336.511-.583.703-.248.2-.543.343-.886.447-.36.111-.734.167-1.142.167z"/></svg>,
  },
  {
    name: "Okta", color: "#007DC1",
    icon: <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.376 0 0 5.376 0 12s5.376 12 12 12 12-5.376 12-12S18.624 0 12 0zm0 18c-3.315 0-6-2.685-6-6s2.685-6 6-6 6 2.685 6 6-2.685 6-6 6z"/></svg>,
  },
  {
    name: "Azure AD", color: "#0089D6",
    icon: <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M0 0h11.377v11.372H0zm12.623 0H24v11.372H12.623zM0 12.623h11.377V24H0zm12.623 0H24V24H12.623z"/></svg>,
  },
  {
    name: "Slack", color: "#4A154B",
    icon: <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/></svg>,
  },
  {
    name: "Google WS", color: "#4285F4",
    icon: <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>,
  },
];

const FEATURES = [
  {
    gradient: "from-blue-500 to-blue-600",
    iconPath: "M13 10V3L4 14h7v7l9-11h-7z",
    title: "Connect once, comply everywhere",
    desc: "One security control satisfies every framework it maps to. Connect GitHub and watch SOC 2, FedRAMP, and ISO 27001 controls update simultaneously.",
  },
  {
    gradient: "from-violet-500 to-purple-600",
    iconPath: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
    title: "Federal-grade, built in",
    desc: "FedRAMP Moderate, CMMC Level 2, and NIST 800-53 are first-class citizens - not afterthoughts. POA&M tracking, SPRS scoring, and SSP generation included.",
  },
  {
    gradient: "from-cyan-500 to-blue-600",
    iconPath: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
    title: "Live compliance posture",
    desc: "Real-time scores per framework. See exactly which controls are failing, why, and what to fix next. Board-ready compliance reports in one click.",
  },
  {
    gradient: "from-green-500 to-emerald-600",
    iconPath: "M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z",
    title: "Automated evidence collection",
    desc: "Evidence is collected continuously via integrations. Staleness monitoring alerts you when evidence expires before your auditor does.",
  },
  {
    gradient: "from-orange-500 to-amber-600",
    iconPath: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z",
    title: "Sales enablement built in",
    desc: "A public Trust Center, automated security questionnaire responses, and auditor portal - turn compliance work into new revenue.",
  },
  {
    gradient: "from-rose-500 to-pink-600",
    iconPath: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
    title: "Policy + workforce management",
    desc: "30+ policy templates, employee acknowledgment tracking, training completion, access reviews, and vendor risk management - all in one place.",
  },
];

const STEPS = [
  {
    num: "01",
    title: "Connect your tools",
    desc: "Connect GitHub, AWS, Okta, Azure AD, Slack, and Google Workspace in minutes. No code required.",
    color: "text-blue-400",
    iconPath: "M13 10V3L4 14h7v7l9-11h-7z",
  },
  {
    num: "02",
    title: "Get your compliance score",
    desc: "ColorComply maps your controls across all 12 supported frameworks and shows you exactly where you stand - instantly.",
    color: "text-green-400",
    iconPath: "M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z",
  },
  {
    num: "03",
    title: "Close gaps and get certified",
    desc: "Guided remediation, auditor portal access, and automated evidence packages get you to certification faster.",
    color: "text-violet-400",
    iconPath: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
  },
];

const STATS = [
  { value: 12, suffix: "", label: "Compliance frameworks" },
  { value: 41, suffix: "", label: "Universal controls" },
  { value: 10, suffix: " min", label: "Setup to first score" },
  { value: 147, suffix: "+", label: "Framework mappings" },
];

function useCountUp(target: number, duration = 1400, start = false) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!start) return;
    let startTime: number | null = null;
    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration, start]);
  return count;
}

function StatCounter({ value, suffix, label, start }: { value: number; suffix: string; label: string; start: boolean }) {
  const count = useCountUp(value, 1400, start);
  return (
    <div className="text-center">
      <div className="text-4xl sm:text-5xl font-bold text-white tabular-nums tracking-tight">
        {count}{suffix}
      </div>
      <div className="text-sm text-slate-400 mt-2 font-medium">{label}</div>
    </div>
  );
}

function ProductMockup() {
  const circ18 = 2 * Math.PI * 18;
  const circ10 = 2 * Math.PI * 10;
  return (
    <div className="rounded-2xl overflow-hidden shadow-2xl" style={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)" }}>
      {/* Browser chrome */}
      <div className="flex items-center gap-2 px-4 py-2.5" style={{ background: "#1e293b", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="h-3 w-3 rounded-full bg-red-400/70" />
        <div className="h-3 w-3 rounded-full bg-yellow-400/70" />
        <div className="h-3 w-3 rounded-full bg-green-400/70" />
        <div className="flex-1 mx-3 h-5 rounded-full flex items-center px-3" style={{ background: "rgba(255,255,255,0.07)" }}>
          <div className="h-1.5 w-1.5 rounded-full bg-green-400 mr-2 flex-shrink-0" />
          <span className="text-xs" style={{ color: "rgba(148,163,184,0.8)" }}>app.colorcomply.com</span>
        </div>
      </div>

      {/* App UI */}
      <div className="flex" style={{ minHeight: 340 }}>
        {/* Sidebar */}
        <div className="flex flex-col flex-shrink-0" style={{ width: 144, background: "#0f172a", borderRight: "1px solid rgba(255,255,255,0.07)" }}>
          {/* Logo zone */}
          <div className="flex items-center gap-2 px-3 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
            <div className="h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "#2563eb" }}>
              <img src={`${BASE_PATH}/logo.svg`} className="h-4 w-4" />
            </div>
            <div>
              <p className="text-white font-bold leading-none" style={{ fontSize: 11 }}>ColorComply</p>
              <p style={{ fontSize: 9, color: "#64748b", marginTop: 1 }}>Acme Corp</p>
            </div>
          </div>
          {/* Nav groups */}
          <div className="px-2 py-2 space-y-0.5 flex-1">
            <p style={{ fontSize: 8, color: "#475569", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", padding: "4px 8px 2px" }}>Overview</p>
            <NavItem label="Dashboard" active />
            <p style={{ fontSize: 8, color: "#475569", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", padding: "6px 8px 2px" }}>Compliance</p>
            <NavItem label="Frameworks" />
            <NavItem label="Controls" />
            <p style={{ fontSize: 8, color: "#475569", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", padding: "6px 8px 2px" }}>Evidence</p>
            <NavItem label="Integrations" />
            <NavItem label="Monitoring" />
            <p style={{ fontSize: 8, color: "#475569", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", padding: "6px 8px 2px" }}>Federal</p>
            <NavItem label="POA&M" />
            <NavItem label="SPRS Score" />
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 overflow-hidden" style={{ background: "#f8fafc" }}>
          {/* Topbar */}
          <div className="flex items-center justify-between px-4" style={{ height: 36, background: "white", borderBottom: "1px solid #e2e8f0" }}>
            <div className="flex items-center gap-1.5">
              <span style={{ fontSize: 9, color: "#94a3b8", fontWeight: 600 }}>Overview</span>
              <span style={{ fontSize: 8, color: "#cbd5e1" }}>›</span>
              <span style={{ fontSize: 9, color: "#334155", fontWeight: 700 }}>Dashboard</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-5 w-5 rounded-full flex items-center justify-center text-white font-bold" style={{ background: "#2563eb", fontSize: 8 }}>A</div>
            </div>
          </div>

          {/* Hero banner */}
          <div className="px-4 py-3 relative overflow-hidden" style={{ background: "linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 50%, #2563eb 100%)" }}>
            <div className="absolute -top-4 -right-4 h-20 w-20 rounded-full opacity-10" style={{ background: "white" }} />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <svg width="44" height="44" className="flex-shrink-0">
                  <circle cx="22" cy="22" r="16" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="4" />
                  <circle cx="22" cy="22" r="16" fill="none" stroke="#4ade80" strokeWidth="4"
                    strokeDasharray={`${0.72 * 2 * Math.PI * 16} ${2 * Math.PI * 16}`}
                    strokeLinecap="round" transform="rotate(-90 22 22)" />
                  <text x="22" y="25" textAnchor="middle" fontSize="9" fontWeight="bold" fill="white">72</text>
                </svg>
                <div>
                  <p style={{ fontSize: 8, color: "rgba(147,197,253,0.9)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Acme Corp - Live Posture</p>
                  <p style={{ fontSize: 11, color: "white", fontWeight: 700, marginTop: 1 }}>Good morning, Sarah</p>
                  <p style={{ fontSize: 8, color: "rgba(147,197,253,0.8)", marginTop: 1 }}>3 frameworks active - 72% compliant</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="px-2 py-1 rounded flex items-center gap-1" style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.2)" }}>
                  <span style={{ fontSize: 8, color: "white", fontWeight: 600 }}>+ Connect</span>
                </div>
                <div className="px-2 py-1 rounded" style={{ background: "white" }}>
                  <span style={{ fontSize: 8, color: "#1d4ed8", fontWeight: 700 }}>+ Framework</span>
                </div>
              </div>
            </div>
          </div>

          {/* KPI cards */}
          <div className="grid gap-2 p-3" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
            {[
              { label: "Passing Controls", value: "28", bar: "#22c55e" },
              { label: "Failing Controls", value: "4", bar: "#ef4444" },
              { label: "Not Tested", value: "9", bar: "#f59e0b" },
            ].map(card => (
              <div key={card.label} className="rounded-lg overflow-hidden" style={{ background: "white", border: "1px solid #e2e8f0" }}>
                <div className="h-0.5" style={{ background: card.bar }} />
                <div className="p-2">
                  <p className="font-bold" style={{ fontSize: 14, color: "#0f172a" }}>{card.value}</p>
                  <p style={{ fontSize: 8, color: "#64748b", marginTop: 1 }}>{card.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Framework cards */}
          <div className="grid gap-2 px-3 pb-3" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
            {[
              { name: "SOC 2 Type II", score: 84, accent: "#2563eb", passing: 22, failing: 2, untested: 17 },
              { name: "FedRAMP Moderate", score: 61, accent: "#7c3aed", passing: 16, failing: 4, untested: 21 },
            ].map(fw => (
              <div key={fw.name} className="rounded-lg overflow-hidden" style={{ background: "white", border: "1px solid #e2e8f0" }}>
                <div className="h-0.5" style={{ background: fw.accent }} />
                <div className="p-2">
                  <div className="flex items-start justify-between mb-1.5">
                    <div>
                      <p style={{ fontSize: 9, fontWeight: 700, color: "#0f172a", lineHeight: 1.2 }}>{fw.name}</p>
                      <span style={{ fontSize: 7, fontWeight: 600, padding: "1px 5px", borderRadius: 999, background: fw.accent === "#2563eb" ? "#eff6ff" : "#f5f3ff", color: fw.accent, marginTop: 3, display: "inline-block" }}>
                        {fw.accent === "#2563eb" ? "Commercial" : "Federal"}
                      </span>
                    </div>
                    <svg width="32" height="32" className="flex-shrink-0">
                      <circle cx="16" cy="16" r="11" fill="none" stroke="#f1f5f9" strokeWidth="3.5" />
                      <circle cx="16" cy="16" r="11" fill="none"
                        stroke={fw.score >= 75 ? "#16a34a" : "#f59e0b"} strokeWidth="3.5"
                        strokeDasharray={`${(fw.score / 100) * 2 * Math.PI * 11} ${2 * Math.PI * 11}`}
                        strokeLinecap="round" transform="rotate(-90 16 16)" />
                      <text x="16" y="19" textAnchor="middle" fontSize="7" fontWeight="bold" fill={fw.score >= 75 ? "#16a34a" : "#d97706"}>{fw.score}%</text>
                    </svg>
                  </div>
                  <div className="flex gap-1">
                    <div className="flex-1 rounded text-center py-0.5" style={{ background: "#f0fdf4" }}>
                      <p style={{ fontSize: 9, fontWeight: 700, color: "#15803d" }}>{fw.passing}</p>
                      <p style={{ fontSize: 7, color: "#16a34a" }}>Pass</p>
                    </div>
                    <div className="flex-1 rounded text-center py-0.5" style={{ background: "#fef2f2" }}>
                      <p style={{ fontSize: 9, fontWeight: 700, color: "#dc2626" }}>{fw.failing}</p>
                      <p style={{ fontSize: 7, color: "#ef4444" }}>Fail</p>
                    </div>
                    <div className="flex-1 rounded text-center py-0.5" style={{ background: "#f8fafc" }}>
                      <p style={{ fontSize: 9, fontWeight: 700, color: "#475569" }}>{fw.untested}</p>
                      <p style={{ fontSize: 7, color: "#94a3b8" }}>New</p>
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

function NavItem({ label, active }: { label: string; active?: boolean }) {
  return (
    <div className="flex items-center gap-1.5 rounded px-2 py-1.5" style={{
      background: active ? "#2563eb" : "transparent",
    }}>
      <div className="h-2.5 w-2.5 rounded-sm flex-shrink-0" style={{ background: active ? "rgba(255,255,255,0.7)" : "rgba(71,85,105,0.6)" }} />
      <span style={{ fontSize: 10, fontWeight: active ? 600 : 400, color: active ? "white" : "rgba(148,163,184,0.8)" }}>{label}</span>
    </div>
  );
}

export default function Landing() {
  const statsRef = useRef<HTMLDivElement>(null);
  const [statsVisible, setStatsVisible] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setStatsVisible(true); },
      { threshold: 0.3 },
    );
    if (statsRef.current) observer.observe(statsRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden" style={{ background: "#020817" }}>
      <style>{`
        @keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        @keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-12px); } }
        @keyframes blob1 { 0%, 100% { transform: translate(0, 0) scale(1); } 33% { transform: translate(60px, -40px) scale(1.08); } 66% { transform: translate(-30px, 30px) scale(0.94); } }
        @keyframes blob2 { 0%, 100% { transform: translate(0, 0) scale(1); } 33% { transform: translate(-50px, 30px) scale(1.05); } 66% { transform: translate(40px, -20px) scale(0.96); } }
        .animate-marquee { animation: marquee 32s linear infinite; }
        .animate-float { animation: float 6s ease-in-out infinite; }
        .animate-blob1 { animation: blob1 12s ease-in-out infinite; }
        .animate-blob2 { animation: blob2 15s ease-in-out infinite; }
        .gradient-text {
          background: linear-gradient(135deg, #60a5fa 0%, #a78bfa 50%, #34d399 100%);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
        }
        .hero-grid {
          background-image: linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
          background-size: 48px 48px;
        }
      `}</style>

      {/* ── Sticky Nav ── */}
      <header
        className="sticky top-0 z-30 transition-all duration-300"
        style={{
          background: scrolled ? "rgba(2,8,23,0.95)" : "transparent",
          backdropFilter: scrolled ? "blur(16px)" : "none",
          borderBottom: scrolled ? "1px solid rgba(255,255,255,0.08)" : "none",
        }}
      >
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
              <img src={`${BASE_PATH}/logo.svg`} className="h-5 w-5" alt="ColorComply" />
            </div>
            <span className="font-bold text-white text-lg tracking-tight">ColorComply</span>
          </div>
          <div className="hidden md:flex items-center gap-1">
            {["Features", "Frameworks", "Federal"].map(link => (
              <a key={link} href="#" className="text-sm font-medium px-4 py-2 rounded-full transition-colors" style={{ color: "rgba(148,163,184,0.8)" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "white"; (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "rgba(148,163,184,0.8)"; (e.currentTarget as HTMLElement).style.background = "transparent"; }}
              >
                {link}
              </a>
            ))}
          </div>
          <div className="flex items-center gap-2.5">
            <a href={`${BASE_PATH}/sign-in`}
              className="text-sm font-medium px-4 py-2 rounded-full transition-colors hidden sm:block"
              style={{ color: "rgba(148,163,184,0.9)" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "white"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "rgba(148,163,184,0.9)"; }}
            >
              Sign in
            </a>
            <a href={`${BASE_PATH}/sign-up`}
              className="text-sm font-semibold px-5 py-2 rounded-full text-white transition-all"
              style={{ background: "#2563eb", boxShadow: "0 0 0 1px rgba(37,99,235,0.5), 0 4px 16px rgba(37,99,235,0.4)" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#1d4ed8"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "#2563eb"; }}
            >
              Get started free
            </a>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative flex flex-col items-center pt-20 pb-24 px-6 hero-grid overflow-hidden">
        {/* Blobs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
          <div className="animate-blob1 absolute -top-40 -right-40 w-[700px] h-[700px] rounded-full blur-[120px]" style={{ background: "radial-gradient(circle, rgba(37,99,235,0.2) 0%, rgba(124,58,237,0.1) 60%, transparent 80%)" }} />
          <div className="animate-blob2 absolute -bottom-40 -left-20 w-[600px] h-[600px] rounded-full blur-[120px]" style={{ background: "radial-gradient(circle, rgba(6,182,212,0.15) 0%, rgba(37,99,235,0.1) 60%, transparent 80%)" }} />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto w-full">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left: text */}
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-8 text-xs font-semibold" style={{ background: "rgba(37,99,235,0.15)", border: "1px solid rgba(37,99,235,0.3)", color: "#93c5fd" }}>
                <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
                Vanta-compatible - now with FedRAMP and CMMC
              </div>

              <h1 className="text-5xl sm:text-6xl font-bold leading-[1.04] tracking-tight mb-6" style={{ color: "white" }}>
                One platform.{" "}
                <span className="gradient-text">Every</span>{" "}
                framework.
              </h1>

              <p className="text-lg leading-relaxed mb-8" style={{ color: "rgba(148,163,184,0.9)", maxWidth: 500 }}>
                ColorComply automates security compliance across SOC 2, FedRAMP, CMMC, ISO 27001, HIPAA, and 8 more frameworks. Connect once, satisfy all.
              </p>

              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-10">
                <a href={`${BASE_PATH}/sign-up`}
                  className="flex items-center gap-2 text-sm font-semibold px-6 py-3 rounded-full text-white transition-all"
                  style={{ background: "#2563eb", boxShadow: "0 0 0 1px rgba(37,99,235,0.5), 0 8px 24px rgba(37,99,235,0.4)" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 0 0 1px rgba(37,99,235,0.5), 0 12px 32px rgba(37,99,235,0.5)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ""; (e.currentTarget as HTMLElement).style.boxShadow = "0 0 0 1px rgba(37,99,235,0.5), 0 8px 24px rgba(37,99,235,0.4)"; }}
                >
                  Start for free
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                </a>
                <a href={`${BASE_PATH}/sign-in`}
                  className="flex items-center gap-2 text-sm font-medium px-6 py-3 rounded-full transition-all"
                  style={{ border: "1px solid rgba(255,255,255,0.15)", color: "rgba(203,213,225,0.9)" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.07)"; (e.currentTarget as HTMLElement).style.color = "white"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ""; (e.currentTarget as HTMLElement).style.color = "rgba(203,213,225,0.9)"; }}
                >
                  Sign in to your account
                </a>
              </div>

              {/* Trust signals */}
              <div className="flex flex-wrap gap-4">
                {[
                  { icon: "M5 13l4 4L19 7", label: "No credit card required" },
                  { icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z", label: "10-minute setup" },
                  { icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z", label: "12 frameworks included" },
                ].map(t => (
                  <div key={t.label} className="flex items-center gap-1.5">
                    <svg className="h-3.5 w-3.5" style={{ color: "#4ade80" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={t.icon} />
                    </svg>
                    <span className="text-xs font-medium" style={{ color: "rgba(148,163,184,0.8)" }}>{t.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: product mockup */}
            <div className="hidden lg:block animate-float" style={{ filter: "drop-shadow(0 32px 64px rgba(37,99,235,0.25))" }}>
              <ProductMockup />
            </div>
          </div>
        </div>
      </section>

      {/* ── Framework ticker ── */}
      <div className="overflow-hidden py-5" style={{ background: "rgba(255,255,255,0.03)", borderTop: "1px solid rgba(255,255,255,0.06)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <p className="text-center text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: "rgba(100,116,139,0.8)" }}>
          12 compliance frameworks supported
        </p>
        <div className="relative">
          <div className="flex animate-marquee whitespace-nowrap gap-2.5">
            {[...FRAMEWORKS, ...FRAMEWORKS].map((fw, i) => {
              const isFed = ["FedRAMP Moderate", "CMMC Level 2", "NIST 800-53", "NIST 800-171", "StateRAMP"].includes(fw);
              return (
                <span key={i} className="inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold shrink-0 transition-all"
                  style={{
                    background: isFed ? "rgba(124,58,237,0.15)" : "rgba(37,99,235,0.12)",
                    border: `1px solid ${isFed ? "rgba(124,58,237,0.3)" : "rgba(37,99,235,0.25)"}`,
                    color: isFed ? "#c4b5fd" : "#93c5fd",
                  }}
                >
                  {fw}
                </span>
              );
            })}
          </div>
          <div className="pointer-events-none absolute inset-y-0 left-0 w-20" style={{ background: "linear-gradient(to right, #020817, transparent)" }} />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-20" style={{ background: "linear-gradient(to left, #020817, transparent)" }} />
        </div>
      </div>

      {/* ── Stats ── */}
      <div ref={statsRef} className="py-20 px-6" style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="max-w-4xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-8">
          {STATS.map(s => (
            <StatCounter key={s.label} value={s.value} suffix={s.suffix} label={s.label} start={statsVisible} />
          ))}
        </div>
      </div>

      {/* ── How it works ── */}
      <section className="py-24 px-6" style={{ background: "#0a0f1a" }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: "#60a5fa" }}>How it works</p>
            <h2 className="text-4xl font-bold tracking-tight text-white mb-4">
              Compliance in three steps
            </h2>
            <p className="text-lg" style={{ color: "rgba(148,163,184,0.8)" }}>
              From zero to audit-ready faster than any other platform on the market.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {STEPS.map((step, i) => (
              <div key={step.num} className="relative p-7 rounded-2xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                {i < STEPS.length - 1 && (
                  <div className="hidden md:block absolute top-10 -right-3 z-10">
                    <svg className="h-5 w-5" style={{ color: "rgba(100,116,139,0.4)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                )}
                <div className="text-5xl font-bold mb-5 tracking-tight" style={{ color: "rgba(37,99,235,0.2)" }}>{step.num}</div>
                <div className="h-10 w-10 rounded-xl flex items-center justify-center mb-4" style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)" }}>
                  <svg className={`h-5 w-5 ${step.color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={step.iconPath} />
                  </svg>
                </div>
                <h3 className="font-bold text-white text-lg mb-2.5">{step.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "rgba(148,163,184,0.8)" }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="py-24 px-6" style={{ background: "#020817" }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: "#60a5fa" }}>Everything included</p>
            <h2 className="text-4xl font-bold text-white tracking-tight mb-4">
              Built for security teams who ship fast
            </h2>
            <p className="text-lg" style={{ color: "rgba(148,163,184,0.8)" }}>
              Stop maintaining spreadsheets. Start proving compliance.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map(f => (
              <div key={f.title} className="group p-7 rounded-2xl transition-all duration-300 cursor-default"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.07)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(37,99,235,0.4)"; (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.08)"; (e.currentTarget as HTMLElement).style.transform = ""; }}
              >
                <div className={`inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br ${f.gradient} shadow-lg mb-5`}>
                  <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={f.iconPath} />
                  </svg>
                </div>
                <h3 className="font-bold text-white mb-2.5 text-base leading-snug">{f.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "rgba(148,163,184,0.75)" }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Federal spotlight ── */}
      <section className="py-24 px-6 relative overflow-hidden" style={{ background: "linear-gradient(135deg, #1e1b4b 0%, #2e1065 50%, #1e1b4b 100%)" }}>
        <div className="absolute inset-0 pointer-events-none" aria-hidden>
          <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full blur-[120px]" style={{ background: "rgba(124,58,237,0.2)" }} />
          <div className="absolute bottom-0 right-1/4 w-80 h-80 rounded-full blur-[120px]" style={{ background: "rgba(37,99,235,0.15)" }} />
        </div>
        <div className="relative max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-6 text-xs font-semibold" style={{ background: "rgba(124,58,237,0.2)", border: "1px solid rgba(124,58,237,0.4)", color: "#c4b5fd" }}>
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                Federal layer - exclusive
              </div>
              <h2 className="text-4xl font-bold text-white tracking-tight mb-5">
                The only GRC platform with a native federal layer
              </h2>
              <p className="text-lg leading-relaxed mb-8" style={{ color: "rgba(196,181,253,0.8)" }}>
                Vanta and Drata don't do FedRAMP. ColorComply was designed from day one to support defense contractors, federal agencies, and cloud service providers pursuing ATO.
              </p>
              <div className="space-y-3">
                {[
                  "FedRAMP Moderate, Low, and StateRAMP",
                  "CMMC Level 1 and Level 2 with SPRS scoring",
                  "NIST 800-53 and NIST 800-171 full control sets",
                  "POA&M tracking with automated status updates",
                  "System Security Plan (SSP) generation",
                ].map(item => (
                  <div key={item} className="flex items-center gap-3">
                    <div className="h-5 w-5 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "rgba(124,58,237,0.3)", border: "1px solid rgba(124,58,237,0.5)" }}>
                      <svg className="h-3 w-3" style={{ color: "#c4b5fd" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span className="text-sm font-medium" style={{ color: "rgba(221,214,254,0.9)" }}>{item}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="hidden md:block">
              {/* Federal framework badges grid */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { name: "FedRAMP", sub: "Moderate / Low", color: "#7c3aed", score: 61 },
                  { name: "CMMC", sub: "Level 2", color: "#7c3aed", score: 74 },
                  { name: "NIST 800-53", sub: "Rev 5", color: "#7c3aed", score: 55 },
                  { name: "NIST 800-171", sub: "DoD CMMC basis", color: "#7c3aed", score: 68 },
                  { name: "StateRAMP", sub: "Moderate", color: "#6d28d9", score: 72 },
                  { name: "POA&M", sub: "Automated tracking", color: "#6d28d9", score: null },
                ].map(fw => (
                  <div key={fw.name} className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(124,58,237,0.3)" }}>
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-bold text-white text-sm">{fw.name}</p>
                        <p className="text-xs mt-0.5" style={{ color: "rgba(196,181,253,0.7)" }}>{fw.sub}</p>
                      </div>
                      {fw.score !== null && (
                        <svg width="32" height="32" className="flex-shrink-0">
                          <circle cx="16" cy="16" r="11" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3" />
                          <circle cx="16" cy="16" r="11" fill="none"
                            stroke={fw.score >= 70 ? "#4ade80" : "#fbbf24"} strokeWidth="3"
                            strokeDasharray={`${(fw.score / 100) * 2 * Math.PI * 11} ${2 * Math.PI * 11}`}
                            strokeLinecap="round" transform="rotate(-90 16 16)" />
                          <text x="16" y="19" textAnchor="middle" fontSize="7" fontWeight="bold" fill="white">{fw.score}%</text>
                        </svg>
                      )}
                      {fw.score === null && (
                        <div className="h-7 w-7 rounded-full flex items-center justify-center" style={{ background: "rgba(124,58,237,0.3)" }}>
                          <svg className="h-4 w-4" style={{ color: "#c4b5fd" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.1)" }}>
                      {fw.score !== null && <div className="h-full rounded-full" style={{ width: `${fw.score}%`, background: fw.score >= 70 ? "#4ade80" : "#fbbf24", transition: "width 0.8s ease" }} />}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Integrations ── */}
      <section className="py-20 px-6" style={{ background: "#0a0f1a", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: "rgba(100,116,139,0.8)" }}>Works with your existing tools</p>
          <h2 className="text-3xl font-bold text-white tracking-tight mb-10">Connect in minutes, not months</h2>
          <div className="flex flex-wrap items-center justify-center gap-4">
            {INTEGRATIONS.map(intg => (
              <div key={intg.name} className="flex items-center gap-2.5 px-5 py-3 rounded-xl transition-all"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.09)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.16)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.09)"; }}
              >
                <span style={{ color: intg.color }}>{intg.icon}</span>
                <span className="text-sm font-semibold" style={{ color: "rgba(203,213,225,0.9)" }}>{intg.name}</span>
              </div>
            ))}
            <div className="flex items-center gap-2.5 px-5 py-3 rounded-xl"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px dashed rgba(255,255,255,0.12)" }}>
              <span className="text-sm font-medium" style={{ color: "rgba(100,116,139,0.8)" }}>+ more coming</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="py-28 px-6 relative overflow-hidden" style={{ background: "linear-gradient(135deg, #020817 0%, #0c1a3a 50%, #020817 100%)" }}>
        <div className="absolute inset-0 pointer-events-none" aria-hidden>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-[120px]" style={{ background: "rgba(37,99,235,0.15)" }} />
        </div>
        <div className="relative max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-8 text-xs font-semibold" style={{ background: "rgba(37,99,235,0.15)", border: "1px solid rgba(37,99,235,0.3)", color: "#93c5fd" }}>
            <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
            Free to get started - no credit card required
          </div>
          <h2 className="text-5xl font-bold text-white tracking-tight mb-5">
            Ready to get compliant?
          </h2>
          <p className="text-xl leading-relaxed mb-10" style={{ color: "rgba(148,163,184,0.8)" }}>
            Set up in 10 minutes. Connect GitHub and see your first compliance score today. Scale to 12 frameworks without adding headcount.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a href={`${BASE_PATH}/sign-up`}
              className="flex items-center gap-2 text-base font-semibold px-8 py-4 rounded-full text-white transition-all"
              style={{ background: "#2563eb", boxShadow: "0 0 0 1px rgba(37,99,235,0.5), 0 8px 32px rgba(37,99,235,0.5)" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 0 0 1px rgba(37,99,235,0.5), 0 16px 40px rgba(37,99,235,0.6)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ""; (e.currentTarget as HTMLElement).style.boxShadow = "0 0 0 1px rgba(37,99,235,0.5), 0 8px 32px rgba(37,99,235,0.5)"; }}
            >
              Start for free
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
            </a>
            <a href={`${BASE_PATH}/sign-in`}
              className="text-base font-medium px-8 py-4 rounded-full transition-all"
              style={{ color: "rgba(148,163,184,0.8)", border: "1px solid rgba(255,255,255,0.1)" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "white"; (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "rgba(148,163,184,0.8)"; (e.currentTarget as HTMLElement).style.background = ""; }}
            >
              Sign in
            </a>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="py-12 px-6" style={{ borderTop: "1px solid rgba(255,255,255,0.08)", background: "#020817" }}>
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2.5 mb-2">
                <div className="h-7 w-7 rounded-lg bg-blue-600 flex items-center justify-center">
                  <img src={`${BASE_PATH}/logo.svg`} className="h-4 w-4" alt="ColorComply" />
                </div>
                <span className="font-bold text-white">ColorComply</span>
                <span className="text-sm" style={{ color: "rgba(100,116,139,0.7)" }}>by ColorCode Solutions</span>
              </div>
              <p className="text-xs" style={{ color: "rgba(100,116,139,0.6)" }}>Compliance automation for the modern security team.</p>
            </div>
            <div className="flex items-center gap-6">
              {["SOC 2", "FedRAMP", "CMMC", "ISO 27001"].map(fw => (
                <span key={fw} className="text-xs font-semibold" style={{ color: "rgba(100,116,139,0.6)" }}>{fw}</span>
              ))}
            </div>
          </div>
          <div className="mt-8 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <p className="text-xs" style={{ color: "rgba(71,85,105,0.8)" }}>2025 ColorCode Solutions. All rights reserved.</p>
            <div className="flex gap-4">
              {["Privacy Policy", "Terms of Service", "Security"].map(link => (
                <a key={link} href="#" className="text-xs transition-colors" style={{ color: "rgba(71,85,105,0.8)" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "rgba(148,163,184,0.8)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "rgba(71,85,105,0.8)"; }}
                >
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

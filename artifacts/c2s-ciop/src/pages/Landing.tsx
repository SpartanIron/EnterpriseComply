import { useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/react";

const BASE_PATH = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

const FRAMEWORKS = [
  "SOC 2 Type II", "FedRAMP Moderate", "CMMC Level 2", "ISO 27001",
  "HIPAA", "PCI DSS 4.0", "NIST 800-53", "GDPR", "DORA",
  "CIS Controls v8", "NIST 800-171", "StateRAMP",
];

const INTEGRATIONS = [
  {
    name: "GitHub", color: "#24292e",
    icon: <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" /></svg>,
  },
  {
    name: "AWS", color: "#FF9900",
    icon: <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M6.763 10.036c0 .296.032.535.088.71.064.176.144.368.256.576.04.063.056.127.056.183 0 .08-.048.16-.152.24l-.503.335a.383.383 0 01-.208.072c-.08 0-.16-.04-.239-.112a2.47 2.47 0 01-.287-.375 6.18 6.18 0 01-.248-.471c-.622.734-1.405 1.101-2.347 1.101-.67 0-1.205-.191-1.596-.574-.391-.383-.59-.894-.59-1.533 0-.678.239-1.23.726-1.644.487-.415 1.133-.623 1.955-.623.272 0 .551.024.846.064.296.04.6.104.918.176v-.583c0-.607-.127-1.03-.375-1.277-.255-.248-.686-.367-1.3-.367-.28 0-.568.031-.863.103-.295.072-.583.16-.862.272a2.287 2.287 0 01-.28.104.488.488 0 01-.127.023c-.112 0-.168-.08-.168-.247v-.391c0-.128.016-.224.056-.28a.597.597 0 01.224-.167c.279-.144.614-.264 1.005-.36a4.84 4.84 0 011.246-.151c.95 0 1.644.216 2.091.647.439.43.662 1.085.662 1.963zm16.836 4.794c-.096.128-.344.224-.743.287l-.375.056-.335.04c-.383.04-.71.048-.98.024a2.257 2.257 0 01-.782-.264 1.687 1.687 0 01-.575-.575c-.152-.255-.224-.567-.224-.934 0-.383.08-.71.239-1.006a2.12 2.12 0 01.655-.726c.279-.191.607-.335.98-.423.375-.088.782-.128 1.221-.128.12 0 .295.008.527.024.231.016.471.04.718.072v-.455c0-.4-.08-.678-.247-.83-.168-.152-.455-.224-.862-.224-.295 0-.599.032-.91.096-.312.064-.615.152-.91.264a2.353 2.353 0 01-.279.096.385.385 0 01-.12.024c-.104 0-.16-.072-.16-.224v-.375c0-.112.016-.2.056-.255a.502.502 0 01.224-.16c.295-.144.63-.264 1.005-.36a4.743 4.743 0 011.205-.151c.455 0 .854.048 1.19.144.335.096.615.247.838.455.224.208.383.471.479.79.096.32.144.686.144 1.094v2.882c0 .128-.016.224-.056.28zm-3.239-1.19c.255 0 .519-.048.79-.143.271-.096.512-.264.718-.503.12-.152.208-.32.256-.52.048-.199.072-.423.072-.686v-.327a6.554 6.554 0 00-.726-.136 5.85 5.85 0 00-.742-.048c-.527 0-.91.104-1.165.312-.255.208-.383.511-.383.91 0 .375.096.655.287.838.191.184.463.303.893.303zm-8.32.766c-.136 0-.232-.024-.296-.08-.064-.048-.12-.16-.168-.312L9.25 7.626a1.39 1.39 0 01-.072-.32c0-.128.064-.2.191-.2h.782c.152 0 .255.025.312.08.064.048.112.16.16.312l1.334 5.277 1.237-5.277c.04-.16.088-.264.152-.312a.549.549 0 01.319-.08h.638c.152 0 .256.025.32.08.064.048.12.16.152.312l1.253 5.342 1.373-5.342c.048-.16.104-.264.16-.312a.52.52 0 01.311-.08h.742c.128 0 .2.065.2.2 0 .04-.008.08-.016.128a1.127 1.127 0 01-.056.2l-1.914 6.154c-.048.16-.104.264-.168.312a.51.51 0 01-.303.08h-.686c-.152 0-.256-.024-.32-.08-.064-.056-.12-.16-.152-.32l-1.23-5.126-1.221 5.118c-.04.16-.088.264-.152.32-.064.056-.176.08-.319.08z" /></svg>,
  },
  {
    name: "Okta", color: "#007DC1",
    icon: <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.376 0 0 5.376 0 12s5.376 12 12 12 12-5.376 12-12S18.624 0 12 0zm0 18c-3.315 0-6-2.685-6-6s2.685-6 6-6 6 2.685 6 6-2.685 6-6 6z" /></svg>,
  },
  {
    name: "Azure AD", color: "#0089D6",
    icon: <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M0 0h11.377v11.372H0zm12.623 0H24v11.372H12.623zM0 12.623h11.377V24H0zm12.623 0H24V24H12.623z" /></svg>,
  },
  {
    name: "Slack", color: "#4A154B",
    icon: <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M5.042 15.165a2.528 2.528 0 01-2.52 2.523A2.528 2.528 0 010 15.165a2.527 2.527 0 012.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 012.521-2.52 2.527 2.527 0 012.521 2.52v6.313A2.528 2.528 0 018.834 24a2.528 2.528 0 01-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 01-2.521-2.52A2.528 2.528 0 018.834 0a2.528 2.528 0 012.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 012.521 2.521 2.528 2.528 0 01-2.521 2.521H2.522A2.528 2.528 0 010 8.834a2.528 2.528 0 012.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 012.522-2.521A2.528 2.528 0 0124 8.834a2.528 2.528 0 01-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 01-2.523 2.521 2.527 2.527 0 01-2.52-2.521V2.522A2.527 2.527 0 0115.165 0a2.528 2.528 0 012.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 012.523 2.522A2.528 2.528 0 0115.165 24a2.527 2.527 0 01-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 01-2.52-2.523 2.526 2.526 0 012.52-2.52h6.313A2.527 2.527 0 0124 15.165a2.528 2.528 0 01-2.522 2.523h-6.313z" /></svg>,
  },
  {
    name: "Google WS", color: "#4285F4",
    icon: <svg className="h-5 w-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /></svg>,
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
    desc: "EnterpriseComply maps your controls across all 12 supported frameworks and shows you exactly where you stand - instantly.",
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
  { value: 193, suffix: "+", label: "Framework mappings" },
];

const UCO_FRAMEWORKS = [
  { name: "SOC 2", color: "#2563eb", bg: "rgba(37,99,235,0.15)", border: "rgba(37,99,235,0.4)", angle: -90 },
  { name: "FedRAMP", color: "#7c3aed", bg: "rgba(124,58,237,0.15)", border: "rgba(124,58,237,0.4)", angle: -45 },
  { name: "CMMC", color: "#7c3aed", bg: "rgba(124,58,237,0.12)", border: "rgba(124,58,237,0.35)", angle: 0 },
  { name: "ISO 27001", color: "#0891b2", bg: "rgba(8,145,178,0.15)", border: "rgba(8,145,178,0.4)", angle: 45 },
  { name: "HIPAA", color: "#059669", bg: "rgba(5,150,105,0.15)", border: "rgba(5,150,105,0.4)", angle: 90 },
  { name: "PCI DSS", color: "#d97706", bg: "rgba(217,119,6,0.15)", border: "rgba(217,119,6,0.4)", angle: 135 },
  { name: "NIST 800-53", color: "#dc2626", bg: "rgba(220,38,38,0.12)", border: "rgba(220,38,38,0.35)", angle: 180 },
  { name: "GDPR", color: "#0369a1", bg: "rgba(3,105,161,0.15)", border: "rgba(3,105,161,0.4)", angle: -135 },
];

const COMPARE_ROWS = [
  { feature: "FedRAMP Moderate support", cc: true, vanta: false, drata: false },
  { feature: "CMMC Level 2 support", cc: true, vanta: false, drata: false },
  { feature: "POA&M tracking", cc: true, vanta: false, drata: false },
  { feature: "SPRS score calculation", cc: true, vanta: false, drata: false },
  { feature: "SSP generator", cc: true, vanta: false, drata: false },
  { feature: "UCO cross-framework mapping", cc: true, vanta: false, drata: false },
  { feature: "193+ framework control mappings", cc: true, vanta: "partial", drata: "partial" },
  { feature: "Automated questionnaire pre-fill", cc: true, vanta: true, drata: true },
  { feature: "SOC 2 / ISO 27001 / HIPAA", cc: true, vanta: true, drata: true },
  { feature: "Evidence vault with staleness alerts", cc: true, vanta: true, drata: true },
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

function UcoNode() {
  const [pulse, setPulse] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setPulse(true), 400);
    return () => clearTimeout(t);
  }, []);

  const cx = 200, cy = 200, r = 130;

  return (
    <div className="relative flex items-center justify-center" style={{ height: 440 }}>
      <svg width="400" height="400" viewBox="0 0 400 400" className="absolute inset-0">
        <defs>
          <radialGradient id="centerGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(37,99,235,0.4)" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        <circle cx={cx} cy={cy} r="120" fill="url(#centerGlow)" />

        {UCO_FRAMEWORKS.map((fw, i) => {
          const rad = (fw.angle * Math.PI) / 180;
          const x2 = cx + r * Math.cos(rad);
          const y2 = cy + r * Math.sin(rad);
          const mx = cx + (r * 0.45) * Math.cos(rad);
          const my = cy + (r * 0.45) * Math.sin(rad);
          return (
            <g key={fw.name}>
              <line
                x1={cx} y1={cy} x2={x2} y2={y2}
                stroke={fw.color}
                strokeWidth="1.5"
                strokeOpacity={pulse ? 0.5 : 0}
                strokeDasharray="4 3"
                style={{ transition: `stroke-opacity 0.8s ease ${i * 80}ms` }}
              />
              <circle
                cx={mx} cy={my} r="2.5"
                fill={fw.color}
                opacity={pulse ? 0.9 : 0}
                filter="url(#glow)"
                style={{ transition: `opacity 0.6s ease ${i * 80 + 200}ms` }}
              />
            </g>
          );
        })}

        <circle
          cx={cx} cy={cy} r="42"
          fill="rgba(15,23,42,0.95)"
          stroke="rgba(37,99,235,0.6)"
          strokeWidth="1.5"
          filter="url(#glow)"
        />
        <circle
          cx={cx} cy={cy} r="42"
          fill="none"
          stroke="rgba(37,99,235,0.2)"
          strokeWidth="8"
          className={pulse ? "animate-ping-slow" : ""}
        />
      </svg>

      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className="rounded-full flex flex-col items-center justify-center text-center"
          style={{
            width: 88, height: 88, zIndex: 10,
            background: "radial-gradient(circle, #1e3a8a 0%, #1e293b 100%)",
            border: "1.5px solid rgba(37,99,235,0.7)",
            boxShadow: "0 0 32px rgba(37,99,235,0.4), 0 0 64px rgba(37,99,235,0.15)",
          }}
        >
          <div className="text-white font-black text-xs leading-none">UCO</div>
          <div style={{ color: "#93c5fd", fontSize: 9, fontWeight: 700, marginTop: 2, lineHeight: 1.2 }}>MFA<br />Control</div>
        </div>
      </div>

      {UCO_FRAMEWORKS.map((fw, i) => {
        const rad = (fw.angle * Math.PI) / 180;
        const x = cx + r * Math.cos(rad);
        const y = cy + r * Math.sin(rad);
        const left = ((x - 36) / 400) * 100 + "%";
        const top = ((y - 14) / 400) * 100 + "%";
        return (
          <div
            key={fw.name}
            className="absolute flex items-center justify-center text-center"
            style={{
              left, top,
              width: 72, height: 28,
              fontSize: 9.5,
              fontWeight: 700,
              borderRadius: 99,
              background: fw.bg,
              border: `1px solid ${fw.border}`,
              color: fw.color,
              opacity: pulse ? 1 : 0,
              transform: pulse ? "scale(1)" : "scale(0.7)",
              transition: `opacity 0.5s ease ${i * 80 + 400}ms, transform 0.5s cubic-bezier(0.34,1.56,0.64,1) ${i * 80 + 400}ms`,
              whiteSpace: "nowrap",
            }}
          >
            {fw.name}
          </div>
        );
      })}
    </div>
  );
}

function ProductMockup() {
  return (
    <div className="rounded-2xl overflow-hidden shadow-2xl" style={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)" }}>
      <div className="flex items-center gap-2 px-4 py-2.5" style={{ background: "#1e293b", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="h-3 w-3 rounded-full bg-red-400/70" />
        <div className="h-3 w-3 rounded-full bg-yellow-400/70" />
        <div className="h-3 w-3 rounded-full bg-green-400/70" />
        <div className="flex-1 mx-3 h-5 rounded-full flex items-center px-3" style={{ background: "rgba(255,255,255,0.07)" }}>
          <div className="h-1.5 w-1.5 rounded-full bg-green-400 mr-2 flex-shrink-0" />
          <span className="text-xs" style={{ color: "rgba(148,163,184,0.8)" }}>app.enterprisecomply.com</span>
        </div>
      </div>

      <div className="flex" style={{ minHeight: 340 }}>
        <div className="flex flex-col flex-shrink-0" style={{ width: 144, background: "#0f172a", borderRight: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="flex items-center gap-2 px-3 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
            <div className="h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "#2563eb" }}>
              <img src={`${BASE_PATH}/logo.svg`} className="h-4 w-4" />
            </div>
            <div>
              <p className="text-white font-bold leading-none" style={{ fontSize: 11 }}>EnterpriseComply</p>
              <p style={{ fontSize: 9, color: "#64748b", marginTop: 1 }}>Acme Corp</p>
            </div>
          </div>
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

        <div className="flex-1 overflow-hidden" style={{ background: "#f8fafc" }}>
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

          <div className="grid gap-2 px-3 pb-3" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
            {[
              { name: "SOC 2 Type II", score: 84, accent: "#2563eb", passing: 22, failing: 2, untested: 17, tag: "Commercial" },
              { name: "FedRAMP Moderate", score: 61, accent: "#7c3aed", passing: 16, failing: 4, untested: 21, tag: "Federal" },
            ].map(fw => (
              <div key={fw.name} className="rounded-lg overflow-hidden" style={{ background: "white", border: "1px solid #e2e8f0" }}>
                <div className="h-0.5" style={{ background: fw.accent }} />
                <div className="p-2">
                  <div className="flex items-start justify-between mb-1.5">
                    <div>
                      <p style={{ fontSize: 9, fontWeight: 700, color: "#0f172a", lineHeight: 1.2 }}>{fw.name}</p>
                      <span style={{ fontSize: 7, fontWeight: 600, padding: "1px 5px", borderRadius: 999, background: fw.accent === "#2563eb" ? "#eff6ff" : "#f5f3ff", color: fw.accent, marginTop: 3, display: "inline-block" }}>
                        {fw.tag}
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
                    {[{ v: fw.passing, l: "Pass", c: "#f0fdf4", t: "#15803d", s: "#16a34a" }, { v: fw.failing, l: "Fail", c: "#fef2f2", t: "#dc2626", s: "#ef4444" }, { v: fw.untested, l: "New", c: "#f8fafc", t: "#475569", s: "#94a3b8" }].map(x => (
                      <div key={x.l} className="flex-1 rounded text-center py-0.5" style={{ background: x.c }}>
                        <p style={{ fontSize: 9, fontWeight: 700, color: x.t }}>{x.v}</p>
                        <p style={{ fontSize: 7, color: x.s }}>{x.l}</p>
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

function NavItem({ label, active }: { label: string; active?: boolean }) {
  return (
    <div className="flex items-center gap-1.5 rounded px-2 py-1.5" style={{ background: active ? "#2563eb" : "transparent" }}>
      <div className="h-2.5 w-2.5 rounded-sm flex-shrink-0" style={{ background: active ? "rgba(255,255,255,0.7)" : "rgba(71,85,105,0.6)" }} />
      <span style={{ fontSize: 10, fontWeight: active ? 600 : 400, color: active ? "white" : "rgba(148,163,184,0.8)" }}>{label}</span>
    </div>
  );
}

function CheckIcon({ ok }: { ok: boolean | string }) {
  if (ok === "partial") return (
    <div className="flex items-center justify-center">
      <div className="h-5 w-5 rounded-full flex items-center justify-center" style={{ background: "rgba(245,158,11,0.15)" }}>
        <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
        </svg>
      </div>
    </div>
  );
  if (ok) return (
    <div className="flex items-center justify-center">
      <div className="h-5 w-5 rounded-full flex items-center justify-center" style={{ background: "rgba(34,197,94,0.15)" }}>
        <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
    </div>
  );
  return (
    <div className="flex items-center justify-center">
      <div className="h-5 w-5 rounded-full flex items-center justify-center" style={{ background: "rgba(239,68,68,0.1)" }}>
        <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </div>
    </div>
  );
}

export default function Landing() {
  const { isSignedIn, isLoaded } = useAuth();
  const statsRef = useRef<HTMLDivElement>(null);
  const ucoRef = useRef<HTMLDivElement>(null);
  const [statsVisible, setStatsVisible] = useState(false);
  const [ucoVisible, setUcoVisible] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const obs1 = new IntersectionObserver(([e]) => { if (e.isIntersecting) setStatsVisible(true); }, { threshold: 0.3 });
    const obs2 = new IntersectionObserver(([e]) => { if (e.isIntersecting) setUcoVisible(true); }, { threshold: 0.2 });
    if (statsRef.current) obs1.observe(statsRef.current);
    if (ucoRef.current) obs2.observe(ucoRef.current);
    return () => { obs1.disconnect(); obs2.disconnect(); };
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
        @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes shimmer { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }
        .animate-marquee { animation: marquee 32s linear infinite; }
        .animate-float { animation: float 6s ease-in-out infinite; }
        .animate-blob1 { animation: blob1 12s ease-in-out infinite; }
        .animate-blob2 { animation: blob2 15s ease-in-out infinite; }
        .animate-fade-up { animation: fadeUp 0.7s ease forwards; }
        .gradient-text {
          background: linear-gradient(135deg, #60a5fa 0%, #a78bfa 50%, #34d399 100%);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
        }
        .gradient-text-gold {
          background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 50%, #fcd34d 100%);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
        }
        .hero-grid {
          background-image: linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
          background-size: 48px 48px;
        }
        .card-glow:hover { box-shadow: 0 0 0 1px rgba(37,99,235,0.4), 0 8px 32px rgba(37,99,235,0.15); }
        .animate-ping-slow { animation: ping 2.5s cubic-bezier(0, 0, 0.2, 1) infinite; }
        @keyframes ping { 75%, 100% { transform: scale(1.8); opacity: 0; } }
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
          <a href={`${BASE_PATH}/`} className="flex items-center gap-2.5 no-underline">
            <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
              <img src={`${BASE_PATH}/logo.svg`} className="h-5 w-5" alt="EnterpriseComply" />
            </div>
            <span className="font-bold text-white text-lg tracking-tight">EnterpriseComply</span>
          </a>
          <div className="hidden md:flex items-center gap-1">
            {["Features", "Frameworks", "Federal"].map(link => (
              <a key={link} href="#" className="text-sm font-medium px-4 py-2 rounded-full transition-colors" style={{ color: "rgba(148,163,184,0.8)" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "white"; (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "rgba(148,163,184,0.8)"; (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
                {link}
              </a>
            ))}
          </div>
          <div className="flex items-center gap-2.5">
            {isLoaded && isSignedIn ? (
              <a href={`${BASE_PATH}/dashboard`}
                className="flex items-center gap-2 text-sm font-semibold px-5 py-2 rounded-full text-white transition-all"
                style={{ background: "#2563eb", boxShadow: "0 0 0 1px rgba(37,99,235,0.5), 0 4px 16px rgba(37,99,235,0.4)" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#1d4ed8"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "#2563eb"; }}>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                Back to dashboard
              </a>
            ) : (
              <>
                <a href={`${BASE_PATH}/sign-in`}
                  className="text-sm font-medium px-4 py-2 rounded-full transition-colors hidden sm:block"
                  style={{ color: "rgba(148,163,184,0.9)" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "white"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "rgba(148,163,184,0.9)"; }}>
                  Sign in
                </a>
                <a href={`${BASE_PATH}/sign-up`}
                  className="text-sm font-semibold px-5 py-2 rounded-full text-white transition-all"
                  style={{ background: "#2563eb", boxShadow: "0 0 0 1px rgba(37,99,235,0.5), 0 4px 16px rgba(37,99,235,0.4)" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#1d4ed8"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "#2563eb"; }}>
                  Get started free
                </a>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative flex flex-col items-center pt-20 pb-24 px-6 hero-grid overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
          <div className="animate-blob1 absolute -top-40 -right-40 w-[700px] h-[700px] rounded-full blur-[120px]" style={{ background: "radial-gradient(circle, rgba(37,99,235,0.2) 0%, rgba(124,58,237,0.1) 60%, transparent 80%)" }} />
          <div className="animate-blob2 absolute -bottom-40 -left-20 w-[600px] h-[600px] rounded-full blur-[120px]" style={{ background: "radial-gradient(circle, rgba(6,182,212,0.15) 0%, rgba(37,99,235,0.1) 60%, transparent 80%)" }} />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto w-full">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-8 text-xs font-semibold" style={{ background: "rgba(37,99,235,0.15)", border: "1px solid rgba(37,99,235,0.3)", color: "#93c5fd" }}>
                <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
                The only GRC platform with a built-in federal layer
              </div>

              <h1 className="text-5xl sm:text-6xl font-bold leading-[1.04] tracking-tight mb-6" style={{ color: "white" }}>
                One platform.{" "}
                <span className="gradient-text">Every</span>{" "}
                framework.
              </h1>

              <p className="text-lg leading-relaxed mb-8" style={{ color: "rgba(148,163,184,0.9)", maxWidth: 500 }}>
                EnterpriseComply automates SOC 2, FedRAMP, CMMC, ISO 27001, HIPAA, and 8 more frameworks. Implement one control - satisfy all frameworks it maps to. Simultaneously.
              </p>

              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-10">
                <a href={`${BASE_PATH}/sign-up`}
                  className="flex items-center gap-2 text-sm font-semibold px-6 py-3 rounded-full text-white transition-all"
                  style={{ background: "#2563eb", boxShadow: "0 0 0 1px rgba(37,99,235,0.5), 0 8px 24px rgba(37,99,235,0.4)" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 0 0 1px rgba(37,99,235,0.5), 0 12px 32px rgba(37,99,235,0.5)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ""; (e.currentTarget as HTMLElement).style.boxShadow = "0 0 0 1px rgba(37,99,235,0.5), 0 8px 24px rgba(37,99,235,0.4)"; }}>
                  Start for free
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                </a>
                <a href={`${BASE_PATH}/sign-in`}
                  className="flex items-center gap-2 text-sm font-medium px-6 py-3 rounded-full transition-all"
                  style={{ border: "1px solid rgba(255,255,255,0.15)", color: "rgba(203,213,225,0.9)" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.07)"; (e.currentTarget as HTMLElement).style.color = "white"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ""; (e.currentTarget as HTMLElement).style.color = "rgba(203,213,225,0.9)"; }}>
                  Sign in to your account
                </a>
              </div>

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
                <span key={i} className="inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold shrink-0"
                  style={{
                    background: isFed ? "rgba(124,58,237,0.15)" : "rgba(37,99,235,0.12)",
                    border: `1px solid ${isFed ? "rgba(124,58,237,0.3)" : "rgba(37,99,235,0.25)"}`,
                    color: isFed ? "#c4b5fd" : "#93c5fd",
                  }}>
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

      {/* ── UCO Differentiator ── */}
      <section ref={ucoRef} className="py-24 px-6 relative overflow-hidden" style={{ background: "#020817" }}>
        <div className="absolute inset-0 pointer-events-none" aria-hidden>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full blur-[140px]" style={{ background: "radial-gradient(circle, rgba(37,99,235,0.08) 0%, transparent 70%)" }} />
        </div>
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full mb-6 text-xs font-semibold" style={{ background: "rgba(37,99,235,0.12)", border: "1px solid rgba(37,99,235,0.25)", color: "#93c5fd" }}>
                Universal Control Objectives
              </div>
              <h2 className="text-4xl sm:text-5xl font-bold text-white leading-tight mb-6">
                Implement once.<br />
                <span className="gradient-text">Satisfy them all.</span>
              </h2>
              <p className="text-lg leading-relaxed mb-8" style={{ color: "rgba(148,163,184,0.85)" }}>
                EnterpriseComply's UCO system maps each security control to every framework it satisfies. Enable MFA once and it automatically counts toward SOC 2, FedRAMP, CMMC, HIPAA, ISO 27001, and more - simultaneously.
              </p>
              <div className="space-y-3 mb-8">
                {[
                  { n: "41", d: "Universal Controls covering every major security domain" },
                  { n: "193+", d: "Framework mappings - every control traced to its requirement" },
                  { n: "12", d: "Frameworks satisfied from a single control implementation" },
                ].map(s => (
                  <div key={s.n} className="flex items-center gap-4 p-3.5 rounded-xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                    <span className="text-2xl font-black" style={{ color: "#60a5fa", minWidth: 48 }}>{s.n}</span>
                    <span className="text-sm" style={{ color: "rgba(148,163,184,0.85)" }}>{s.d}</span>
                  </div>
                ))}
              </div>
              <a href={`${BASE_PATH}/sign-up`}
                className="inline-flex items-center gap-2 text-sm font-semibold px-6 py-3 rounded-full text-white transition-all"
                style={{ background: "#2563eb", boxShadow: "0 0 0 1px rgba(37,99,235,0.4), 0 4px 16px rgba(37,99,235,0.3)" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#1d4ed8"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "#2563eb"; }}>
                See your control map free
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
              </a>
            </div>

            <div className="flex items-center justify-center">
              {ucoVisible && <UcoNode />}
              {!ucoVisible && <div style={{ height: 440 }} />}
            </div>
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <div className="py-20 px-6" style={{ background: "rgba(255,255,255,0.015)", borderTop: "1px solid rgba(255,255,255,0.06)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">Get compliant in weeks, not years</h2>
            <p className="text-slate-400 text-lg">The fastest path from zero to certified, for any framework.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {STEPS.map((step) => (
              <div key={step.num} className="relative p-6 rounded-2xl transition-all card-glow" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div className="text-5xl font-black mb-4 tabular-nums" style={{ color: "rgba(255,255,255,0.06)", lineHeight: 1 }}>{step.num}</div>
                <div className={`flex items-center gap-2 mb-3 ${step.color}`}>
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={step.iconPath} />
                  </svg>
                  <h3 className="font-bold text-white text-lg">{step.title}</h3>
                </div>
                <p className="text-sm leading-relaxed" style={{ color: "rgba(148,163,184,0.8)" }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Comparison table ── */}
      <section className="py-24 px-6" style={{ background: "#020817" }}>
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full mb-6 text-xs font-semibold" style={{ background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.25)", color: "#fbbf24" }}>
              Why teams switch to EnterpriseComply
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              The only platform that goes{" "}
              <span className="gradient-text-gold">beyond commercial compliance</span>
            </h2>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto">
              Vanta and Drata are great for SOC 2. EnterpriseComply does that - and covers the federal layer they don't touch.
            </p>
          </div>

          <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.1)" }}>
            <div className="grid" style={{ gridTemplateColumns: "1fr 1fr 1fr 1fr", background: "rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
              <div className="px-5 py-4">
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "rgba(100,116,139,0.7)" }}>Feature</span>
              </div>
              {[
                { name: "EnterpriseComply", highlight: true },
                { name: "Vanta", highlight: false },
                { name: "Drata", highlight: false },
              ].map(col => (
                <div key={col.name} className="px-5 py-4 text-center">
                  <span className={`text-sm font-bold ${col.highlight ? "text-blue-400" : "text-slate-400"}`}>{col.name}</span>
                  {col.highlight && <div className="mt-1 inline-block ml-2 text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: "rgba(37,99,235,0.2)", color: "#93c5fd" }}>You</div>}
                </div>
              ))}
            </div>
            {COMPARE_ROWS.map((row, i) => (
              <div
                key={row.feature}
                className="grid items-center"
                style={{
                  gridTemplateColumns: "1fr 1fr 1fr 1fr",
                  background: i % 2 === 0 ? "rgba(255,255,255,0.015)" : "transparent",
                  borderBottom: i < COMPARE_ROWS.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
                }}
              >
                <div className="px-5 py-3.5">
                  <span className="text-sm" style={{ color: "rgba(203,213,225,0.85)" }}>{row.feature}</span>
                </div>
                <div className="px-5 py-3.5 flex justify-center">
                  <CheckIcon ok={row.cc} />
                </div>
                <div className="px-5 py-3.5 flex justify-center">
                  <CheckIcon ok={row.vanta} />
                </div>
                <div className="px-5 py-3.5 flex justify-center">
                  <CheckIcon ok={row.drata} />
                </div>
              </div>
            ))}
          </div>
          <p className="text-center text-xs mt-4" style={{ color: "rgba(100,116,139,0.6)" }}>
            Based on publicly available feature documentation. Updated May 2026.
          </p>
        </div>
      </section>

      {/* ── Features grid ── */}
      <div className="py-24 px-6" style={{ background: "rgba(255,255,255,0.015)", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">Everything compliance needs. Nothing it doesn't.</h2>
            <p className="text-slate-400 text-lg">Built for security teams that need depth, not just dashboards.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f) => (
              <div key={f.title} className="group p-6 rounded-2xl transition-all card-glow cursor-default" style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${f.gradient} flex items-center justify-center mb-4 shadow-lg`}>
                  <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={f.iconPath} />
                  </svg>
                </div>
                <h3 className="font-bold text-white text-base mb-2">{f.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "rgba(148,163,184,0.8)" }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Federal spotlight ── */}
      <section className="py-24 px-6 relative overflow-hidden" style={{ background: "linear-gradient(135deg, #0a0a1a 0%, #1a0a3a 40%, #0a1a2a 100%)" }}>
        <div className="absolute inset-0 pointer-events-none" aria-hidden>
          <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full blur-[120px]" style={{ background: "radial-gradient(circle, rgba(124,58,237,0.12) 0%, transparent 70%)" }} />
          <div className="absolute bottom-0 left-0 w-[500px] h-[500px] rounded-full blur-[100px]" style={{ background: "radial-gradient(circle, rgba(37,99,235,0.1) 0%, transparent 70%)" }} />
        </div>
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full mb-6 text-xs font-semibold" style={{ background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.35)", color: "#c4b5fd" }}>
                Federal compliance layer
              </div>
              <h2 className="text-4xl sm:text-5xl font-bold text-white leading-tight mb-6">
                FedRAMP. CMMC.<br />
                <span style={{ background: "linear-gradient(135deg, #c4b5fd 0%, #a78bfa 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                  Built in, not bolted on.
                </span>
              </h2>
              <p className="text-lg leading-relaxed mb-8" style={{ color: "rgba(148,163,184,0.85)" }}>
                The only GRC platform purpose-built for companies selling to the US federal government. Full POA&M lifecycle, SPRS scoring for DFARS 252.204-7019, and SSP generation - everything your prime contractor requires.
              </p>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: "FedRAMP Moderate", desc: "Full control set with continuous monitoring", color: "#7c3aed" },
                  { label: "CMMC Level 2", desc: "110 NIST 800-171 practices + evidence collection", color: "#7c3aed" },
                  { label: "POA&M Tracking", desc: "Create, assign, and remediate findings", color: "#2563eb" },
                  { label: "SPRS Score", desc: "Real-time DoD score with gap analysis", color: "#2563eb" },
                  { label: "SSP Generator", desc: "Auto-generate System Security Plans", color: "#0891b2" },
                  { label: "NIST 800-53", desc: "Rev 5 control catalog with UCO mapping", color: "#0891b2" },
                ].map(item => (
                  <div key={item.label} className="p-4 rounded-xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ background: item.color }} />
                      <span className="text-sm font-bold text-white">{item.label}</span>
                    </div>
                    <p className="text-xs" style={{ color: "rgba(148,163,184,0.7)" }}>{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="hidden lg:flex flex-col gap-4">
              {[
                { fw: "FedRAMP Moderate", score: 61, controls: 325, passing: 198, failing: 42, color: "#7c3aed" },
                { fw: "CMMC Level 2", score: 74, controls: 110, passing: 81, failing: 12, color: "#6d28d9" },
                { fw: "NIST 800-53", score: 55, controls: 180, passing: 99, failing: 31, color: "#2563eb" },
              ].map(item => (
                <div key={item.fw} className="p-5 rounded-2xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" }}>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="font-bold text-white text-sm">{item.fw}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgba(124,58,237,0.15)", color: "#c4b5fd" }}>Federal</span>
                        <span className="text-xs" style={{ color: "rgba(100,116,139,0.8)" }}>{item.controls} controls</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-black" style={{ color: item.score >= 70 ? "#22c55e" : item.score >= 50 ? "#f59e0b" : "#ef4444" }}>{item.score}%</div>
                      <div className="text-xs" style={{ color: "rgba(100,116,139,0.8)" }}>compliant</div>
                    </div>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${item.score}%`, background: `linear-gradient(to right, ${item.color}, ${item.color}aa)` }} />
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs" style={{ color: "#22c55e" }}>{item.passing} passing</span>
                    <span className="text-xs" style={{ color: "#ef4444" }}>{item.failing} failing</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Integrations strip ── */}
      <div className="py-16 px-6" style={{ background: "#020817", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="max-w-4xl mx-auto">
          <p className="text-center text-sm font-semibold uppercase tracking-widest mb-8" style={{ color: "rgba(100,116,139,0.7)" }}>
            Connect your stack in minutes
          </p>
          <div className="flex items-center justify-center gap-6 flex-wrap">
            {INTEGRATIONS.map(int => (
              <div key={int.name} className="flex flex-col items-center gap-2 group cursor-default">
                <div
                  className="h-12 w-12 rounded-2xl flex items-center justify-center transition-all"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: int.color }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)"; (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLElement).style.boxShadow = `0 8px 24px ${int.color}33`; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"; (e.currentTarget as HTMLElement).style.transform = ""; (e.currentTarget as HTMLElement).style.boxShadow = ""; }}
                >
                  {int.icon}
                </div>
                <span className="text-xs font-medium" style={{ color: "rgba(100,116,139,0.8)" }}>{int.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Final CTA ── */}
      <section className="py-28 px-6 relative overflow-hidden" style={{ background: "linear-gradient(135deg, #020817 0%, #0f172a 50%, #020817 100%)" }}>
        <div className="absolute inset-0 hero-grid opacity-40 pointer-events-none" aria-hidden />
        <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] rounded-full blur-[100px]" style={{ background: "radial-gradient(ellipse, rgba(37,99,235,0.15) 0%, transparent 70%)" }} />
        </div>
        <div className="max-w-3xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-8 text-xs font-semibold" style={{ background: "rgba(37,99,235,0.15)", border: "1px solid rgba(37,99,235,0.3)", color: "#93c5fd" }}>
            <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
            Start your compliance journey today
          </div>
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-6 leading-tight">
            Ready to pass your audit<br />
            <span className="gradient-text">in record time?</span>
          </h2>
          <p className="text-xl mb-10" style={{ color: "rgba(148,163,184,0.85)" }}>
            Join teams using EnterpriseComply to satisfy multiple compliance frameworks from a single platform. Free to start, scales with your compliance program.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a href={`${BASE_PATH}/sign-up`}
              className="flex items-center gap-2 text-base font-semibold px-8 py-4 rounded-full text-white transition-all"
              style={{ background: "#2563eb", boxShadow: "0 0 0 1px rgba(37,99,235,0.5), 0 8px 32px rgba(37,99,235,0.5)" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 0 0 1px rgba(37,99,235,0.5), 0 16px 40px rgba(37,99,235,0.6)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ""; (e.currentTarget as HTMLElement).style.boxShadow = "0 0 0 1px rgba(37,99,235,0.5), 0 8px 32px rgba(37,99,235,0.5)"; }}>
              Get started for free
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
            </a>
            <div className="flex items-center gap-1.5" style={{ color: "rgba(100,116,139,0.8)" }}>
              <svg className="h-4 w-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
              <span className="text-sm font-medium">No credit card required</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="py-12 px-6" style={{ background: "#020817", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="max-w-7xl mx-auto">
          <div className="grid sm:grid-cols-4 gap-8 mb-10">
            <div>
              <div className="flex items-center gap-2.5 mb-4">
                <div className="h-7 w-7 rounded-lg bg-blue-600 flex items-center justify-center">
                  <img src={`${BASE_PATH}/logo.svg`} className="h-4 w-4" />
                </div>
                <span className="font-bold text-white">EnterpriseComply</span>
              </div>
              <p className="text-sm leading-relaxed" style={{ color: "rgba(100,116,139,0.8)" }}>
                The compliance platform for teams that need more than just SOC 2.
              </p>
            </div>
            {[
              { title: "Product", links: ["Features", "Frameworks", "Integrations", "Pricing"] },
              { title: "Federal", links: ["FedRAMP", "CMMC Level 2", "NIST 800-53", "StateRAMP"] },
              { title: "Company", links: ["About", "Security", "Privacy Policy", "Terms"] },
            ].map(col => (
              <div key={col.title}>
                <h4 className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: "rgba(100,116,139,0.7)" }}>{col.title}</h4>
                <ul className="space-y-2.5">
                  {col.links.map(link => (
                    <li key={link}>
                      <a href="#" className="text-sm transition-colors" style={{ color: "rgba(100,116,139,0.8)" }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "rgba(203,213,225,0.9)"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "rgba(100,116,139,0.8)"; }}>
                        {link}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <p className="text-xs" style={{ color: "rgba(100,116,139,0.6)" }}>
              {new Date().getFullYear()} ColorCode Solutions, Inc. All rights reserved.
            </p>
            <p className="text-xs" style={{ color: "rgba(100,116,139,0.5)" }}>
              SOC 2 - FedRAMP - CMMC - ISO 27001 - HIPAA - PCI DSS - GDPR - NIST
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

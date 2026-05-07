import { useEffect, useRef, useState } from "react";

const BASE_PATH = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

const FRAMEWORKS = [
  "SOC 2 Type II", "FedRAMP Moderate", "CMMC Level 2", "ISO 27001",
  "HIPAA", "PCI DSS 4.0", "NIST 800-53", "GDPR", "DORA",
  "CIS Controls v8", "NIST 800-171", "StateRAMP",
];

const FEATURES = [
  {
    gradient: "from-blue-500 to-indigo-600",
    icon: (
      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    title: "Connect Once, Comply Everywhere",
    desc: "Connect GitHub, AWS, Okta, and more. ColorComply maps one security control to every framework it satisfies - SOC 2, FedRAMP, ISO 27001, and beyond - automatically.",
  },
  {
    gradient: "from-violet-500 to-purple-600",
    icon: (
      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    title: "Federal-Grade, Built-in",
    desc: "FedRAMP Moderate, CMMC Level 2, and NIST 800-53 are first-class citizens. Automated evidence collection, POA&M tracking, and ATO journey management.",
  },
  {
    gradient: "from-cyan-500 to-blue-600",
    icon: (
      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    title: "Live Compliance Posture",
    desc: "Real-time scores per framework. See exactly which controls are failing, why, and what to do next. Board-ready reports generated in one click.",
  },
];

const STATS = [
  { value: 12, suffix: "", label: "Compliance frameworks" },
  { value: 41, suffix: "", label: "Universal controls" },
  { value: 10, suffix: " min", label: "Time to first score" },
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
  const count = useCountUp(value, 1200, start);
  return (
    <div className="text-center">
      <div className="text-4xl font-bold text-white tabular-nums">
        {count}{suffix}
      </div>
      <div className="text-sm text-slate-400 mt-1">{label}</div>
    </div>
  );
}

export default function Landing() {
  const statsRef = useRef<HTMLDivElement>(null);
  const [statsVisible, setStatsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setStatsVisible(true); },
      { threshold: 0.3 },
    );
    if (statsRef.current) observer.observe(statsRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-white flex flex-col overflow-x-hidden">

      {/* ── Animated gradient blobs (injected as style) ── */}
      <style>{`
        @keyframes blob1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(60px, -40px) scale(1.08); }
          66% { transform: translate(-30px, 30px) scale(0.94); }
        }
        @keyframes blob2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(-50px, 30px) scale(1.05); }
          66% { transform: translate(40px, -20px) scale(0.96); }
        }
        @keyframes blob3 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(30px, 50px) scale(1.06); }
        }
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-blob1 { animation: blob1 9s ease-in-out infinite; }
        .animate-blob2 { animation: blob2 11s ease-in-out infinite; }
        .animate-blob3 { animation: blob3 13s ease-in-out infinite; }
        .animate-marquee { animation: marquee 28s linear infinite; }
        .gradient-text {
          background: linear-gradient(135deg, #2563eb 0%, #7c3aed 50%, #06b6d4 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
      `}</style>

      {/* Nav */}
      <header className="border-b border-slate-100 sticky top-0 bg-white/90 backdrop-blur-md z-20">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src={`${BASE_PATH}/logo.svg`} className="h-8 w-8" alt="ColorComply" />
            <span className="font-semibold text-slate-900 text-lg tracking-tight">ColorComply</span>
          </div>
          <div className="flex items-center gap-3">
            <a href={`${BASE_PATH}/sign-in`} className="text-sm font-medium text-slate-600 hover:text-slate-900 px-4 py-2 rounded-full hover:bg-slate-100 transition-colors">
              Sign in
            </a>
            <a href={`${BASE_PATH}/sign-up`} className="text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 px-5 py-2 rounded-full transition-all shadow-sm shadow-blue-200 hover:shadow-blue-300">
              Get started free
            </a>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative flex flex-col items-center justify-center text-center px-6 pt-28 pb-32 overflow-hidden">

        {/* Gradient mesh blobs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
          <div className="animate-blob1 absolute -top-32 -right-32 w-[600px] h-[600px] rounded-full bg-gradient-to-br from-blue-400/25 via-indigo-400/20 to-violet-500/20 blur-[80px]" />
          <div className="animate-blob2 absolute top-16 -left-24 w-[500px] h-[500px] rounded-full bg-gradient-to-tr from-cyan-300/20 via-blue-300/15 to-indigo-400/20 blur-[80px]" />
          <div className="animate-blob3 absolute -bottom-20 right-1/4 w-[400px] h-[400px] rounded-full bg-gradient-to-tl from-violet-400/15 via-purple-300/10 to-pink-300/10 blur-[80px]" />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-100 text-blue-700 text-xs font-semibold px-4 py-1.5 rounded-full mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            Compliance automation for modern security teams
          </div>

          <h1 className="text-6xl sm:text-7xl font-bold text-slate-900 leading-[1.05] tracking-tight mb-6">
            From first signup to{" "}
            <span className="gradient-text">authorized</span>
            <br />in every framework
          </h1>

          <p className="text-xl text-slate-500 max-w-2xl mx-auto mb-10 leading-relaxed">
            Connect your tools once. ColorComply maps your security controls to SOC 2, FedRAMP, CMMC, ISO 27001, HIPAA, and 8 more frameworks - automatically.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href={`${BASE_PATH}/sign-up`}
              className="text-base font-semibold text-white bg-blue-600 hover:bg-blue-700 px-8 py-3.5 rounded-full transition-all shadow-lg shadow-blue-200 hover:shadow-blue-300 hover:-translate-y-0.5"
            >
              Start for free
              <span className="ml-2">→</span>
            </a>
            <a
              href={`${BASE_PATH}/sign-in`}
              className="text-base font-medium text-slate-700 hover:text-slate-900 px-8 py-3.5 rounded-full border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all"
            >
              Sign in
            </a>
          </div>
        </div>
      </section>

      {/* Framework ticker */}
      <div className="border-y border-slate-100 bg-slate-50/60 py-5 overflow-hidden">
        <p className="text-center text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">
          Supported frameworks
        </p>
        <div className="relative">
          <div className="flex animate-marquee whitespace-nowrap gap-3">
            {[...FRAMEWORKS, ...FRAMEWORKS].map((fw, i) => (
              <span
                key={i}
                className="inline-flex items-center px-4 py-2 bg-white border border-slate-200 rounded-full text-sm font-medium text-slate-700 shadow-sm shrink-0"
              >
                {fw}
              </span>
            ))}
          </div>
          <div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-slate-50/60 to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-slate-50/60 to-transparent" />
        </div>
      </div>

      {/* Stats */}
      <div ref={statsRef} className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 py-14 px-6">
        <div className="max-w-3xl mx-auto grid grid-cols-3 gap-8">
          {STATS.map((s) => (
            <StatCounter key={s.label} value={s.value} suffix={s.suffix} label={s.label} start={statsVisible} />
          ))}
        </div>
      </div>

      {/* Features */}
      <section className="py-28 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-4xl font-bold text-slate-900 tracking-tight mb-4">
              Built for security teams who ship fast
            </h2>
            <p className="text-lg text-slate-500 max-w-xl mx-auto">
              Stop maintaining spreadsheets. Start proving compliance.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="group p-7 rounded-2xl border border-slate-200 bg-white hover:shadow-xl hover:shadow-slate-100 hover:-translate-y-1 transition-all duration-300"
              >
                <div className={`inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br ${f.gradient} shadow-md mb-5`}>
                  {f.icon}
                </div>
                <h3 className="font-semibold text-slate-900 mb-3 text-lg leading-snug">{f.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative py-24 px-6 overflow-hidden bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900">
        <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
          <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full bg-blue-600/10 blur-[100px]" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 rounded-full bg-violet-600/10 blur-[100px]" />
        </div>
        <div className="relative max-w-3xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-white tracking-tight mb-4">Ready to get compliant?</h2>
          <p className="text-slate-300 mb-10 text-lg leading-relaxed max-w-xl mx-auto">
            Set up in 10 minutes. Connect GitHub and see your first compliance score today.
          </p>
          <a
            href={`${BASE_PATH}/sign-up`}
            className="inline-flex items-center gap-2 text-base font-semibold text-slate-900 bg-white hover:bg-blue-50 px-8 py-3.5 rounded-full transition-all shadow-xl shadow-black/20 hover:-translate-y-0.5"
          >
            Get started free
            <span>→</span>
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-100 py-8 px-6 bg-white">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={`${BASE_PATH}/logo.svg`} className="h-6 w-6" alt="ColorComply" />
            <span className="text-sm font-medium text-slate-700">ColorComply</span>
            <span className="text-slate-300 text-sm">by ColorCode Solutions</span>
          </div>
          <p className="text-sm text-slate-400">2025 ColorCode Solutions. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

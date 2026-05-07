import { useNavigate } from "@/lib/hooks";

const BASE_PATH = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

const FRAMEWORKS = [
  "SOC 2", "FedRAMP", "CMMC L2", "ISO 27001", "HIPAA",
  "PCI DSS", "NIST 800-53", "GDPR", "DORA", "CIS Controls",
];

const FEATURES = [
  {
    icon: "⚡",
    title: "Connect Once, Comply Everywhere",
    desc: "Connect GitHub, AWS, Okta, and more. ColorComply maps one security control to every framework it satisfies — SOC 2, FedRAMP, ISO 27001, and beyond.",
  },
  {
    icon: "🛡",
    title: "Federal-Grade, Built-in",
    desc: "FedRAMP Moderate, CMMC Level 2, and NIST 800-53 are first-class citizens. Automated evidence collection, POA&M tracking, and ATO journey management.",
  },
  {
    icon: "📊",
    title: "Live Compliance Posture",
    desc: "Real-time scores per framework. See exactly which controls are failing, why, and what to do next. Board-ready reports in one click.",
  },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Nav */}
      <header className="border-b border-slate-200 sticky top-0 bg-white/95 backdrop-blur z-10">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src={`${BASE_PATH}/logo.svg`} className="h-8 w-8" />
            <span className="font-semibold text-slate-900 text-lg">ColorComply</span>
          </div>
          <div className="flex items-center gap-3">
            <a href={`${BASE_PATH}/sign-in`} className="text-sm font-medium text-slate-600 hover:text-slate-900 px-4 py-2 rounded-lg hover:bg-slate-100 transition-colors">
              Sign in
            </a>
            <a href={`${BASE_PATH}/sign-up`} className="text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors">
              Get started free
            </a>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-6 py-24 bg-gradient-to-b from-blue-50/50 to-white">
        <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
          Compliance automation for modern security teams
        </div>
        <h1 className="text-5xl font-bold text-slate-900 leading-tight max-w-3xl mb-6">
          From first signup to <span className="text-blue-600">authorized</span> — in every framework
        </h1>
        <p className="text-xl text-slate-500 max-w-2xl mb-10">
          Connect your tools once. ColorComply maps your security controls to SOC 2, FedRAMP, CMMC, ISO 27001, HIPAA, and 8 more frameworks — automatically.
        </p>
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <a href={`${BASE_PATH}/sign-up`} className="text-base font-semibold text-white bg-blue-600 hover:bg-blue-700 px-8 py-3.5 rounded-lg transition-colors shadow-sm">
            Start for free →
          </a>
          <a href={`${BASE_PATH}/sign-in`} className="text-base font-medium text-slate-600 hover:text-slate-900 px-8 py-3.5 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors">
            Sign in
          </a>
        </div>
      </section>

      {/* Frameworks */}
      <section className="border-t border-slate-100 py-12 px-6 bg-slate-50">
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-6">Supported frameworks</p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {FRAMEWORKS.map(fw => (
              <span key={fw} className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 shadow-sm">
                {fw}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">Built for security teams who ship fast</h2>
            <p className="text-lg text-slate-500">Stop maintaining spreadsheets. Start proving compliance.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {FEATURES.map(f => (
              <div key={f.title} className="p-6 rounded-xl border border-slate-200 bg-white hover:shadow-md transition-shadow">
                <div className="text-3xl mb-4">{f.icon}</div>
                <h3 className="font-semibold text-slate-900 mb-3 text-lg">{f.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 bg-blue-600">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Ready to get compliant?</h2>
          <p className="text-blue-100 mb-8 text-lg">Set up in 10 minutes. Connect GitHub and see your first compliance score today.</p>
          <a href={`${BASE_PATH}/sign-up`} className="inline-block text-base font-semibold text-blue-600 bg-white hover:bg-blue-50 px-8 py-3.5 rounded-lg transition-colors shadow-sm">
            Get started free →
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-8 px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={`${BASE_PATH}/logo.svg`} className="h-6 w-6" />
            <span className="text-sm font-medium text-slate-700">ColorComply</span>
            <span className="text-slate-300">by ColorCode Solutions</span>
          </div>
          <p className="text-sm text-slate-400">© 2025 ColorCode Solutions. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

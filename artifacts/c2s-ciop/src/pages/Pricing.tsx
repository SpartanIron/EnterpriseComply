import { useAuth } from "@clerk/react";

const BASE_PATH = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

const TIERS = [
  {
    name: "Starter",
    price: "$4,500",
    period: "/year",
    description: "For startups and growing teams pursuing their first certification.",
    highlight: false,
    cta: "Start free trial",
    ctaHref: "/sign-up",
    features: [
      { label: "Up to 50 employees" },
      { label: "3 active frameworks" },
      { label: "10 integrations" },
      { label: "Evidence vault (unlimited documents)" },
      { label: "Policy library (30 templates)" },
      { label: "Automated control testing" },
      { label: "UCO universal control mapping" },
      { label: "Vendor questionnaire management" },
      { label: "Trust Center (public page)" },
      { label: "Email support (48h SLA)" },
    ],
    notIncluded: [
      "Federal frameworks (FedRAMP, CMMC, NIST 800-53)",
      "POA&M + SPRS + SSP Generator",
      "Auditor Portal",
      "Access reviews",
      "Custom frameworks",
      "Dedicated CSM",
    ],
  },
  {
    name: "Professional",
    price: "$12,000",
    period: "/year",
    description: "For scaling companies with multiple frameworks and audit engagements.",
    highlight: true,
    badge: "Most popular",
    cta: "Start free trial",
    ctaHref: "/sign-up",
    features: [
      { label: "Up to 500 employees" },
      { label: "Unlimited active frameworks" },
      { label: "30+ integrations" },
      { label: "Evidence vault (unlimited)" },
      { label: "Policy library + custom templates" },
      { label: "Automated control testing + drift detection" },
      { label: "UCO universal control mapping" },
      { label: "Auditor Portal with access tokens" },
      { label: "Access reviews and attestation campaigns" },
      { label: "Risk register with heat map" },
      { label: "Security questionnaire AI assist" },
      { label: "Custom frameworks builder" },
      { label: "Trust Center (branded)" },
      { label: "Priority support (8h SLA)" },
    ],
    notIncluded: [
      "Federal frameworks (FedRAMP, CMMC, NIST 800-53)",
      "POA&M + SPRS + SSP Generator",
      "Dedicated CSM",
      "SLA guarantees",
    ],
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    description: "For enterprises, defense contractors, and federal agencies requiring the full platform including native federal layer.",
    highlight: false,
    cta: "Talk to sales",
    ctaHref: "/sign-up",
    features: [
      { label: "Unlimited employees" },
      { label: "Unlimited frameworks including FedRAMP, CMMC L2, NIST 800-53, NIST 800-171" },
      { label: "All 30+ integrations + custom connectors" },
      { label: "Native POA&M management" },
      { label: "SPRS score tracking (CMMC/NIST 800-171)" },
      { label: "SSP Generator (NIST SP 800-18 compliant)" },
      { label: "Everything in Professional" },
      { label: "Dedicated Customer Success Manager" },
      { label: "SLA guarantees (99.9% uptime)" },
      { label: "SSO / SAML integration" },
      { label: "Custom data retention policies" },
      { label: "On-premise deployment option" },
      { label: "White-glove onboarding" },
      { label: "24/7 phone + Slack support" },
    ],
    notIncluded: [],
  },
];

const COMPARISON = [
  { feature: "Frameworks", starter: "3", professional: "Unlimited", enterprise: "Unlimited + Federal" },
  { feature: "Integrations", starter: "10", professional: "30+", enterprise: "30+ + custom" },
  { feature: "Employees", starter: "Up to 50", professional: "Up to 500", enterprise: "Unlimited" },
  { feature: "UCO universal controls", starter: true, professional: true, enterprise: true },
  { feature: "Automated evidence collection", starter: true, professional: true, enterprise: true },
  { feature: "Policy library (30 templates)", starter: true, professional: true, enterprise: true },
  { feature: "Trust Center", starter: true, professional: true, enterprise: true },
  { feature: "Auditor Portal", starter: false, professional: true, enterprise: true },
  { feature: "Access reviews", starter: false, professional: true, enterprise: true },
  { feature: "Custom frameworks", starter: false, professional: true, enterprise: true },
  { feature: "Risk register + heat map", starter: false, professional: true, enterprise: true },
  { feature: "AI questionnaire assist", starter: false, professional: true, enterprise: true },
  { feature: "POA&M management", starter: false, professional: false, enterprise: true },
  { feature: "SPRS score (CMMC/NIST 800-171)", starter: false, professional: false, enterprise: true },
  { feature: "SSP Generator", starter: false, professional: false, enterprise: true },
  { feature: "FedRAMP / CMMC / NIST 800-53", starter: false, professional: false, enterprise: true },
  { feature: "Dedicated CSM", starter: false, professional: false, enterprise: true },
  { feature: "SLA guarantees", starter: false, professional: false, enterprise: true },
  { feature: "SSO / SAML", starter: false, professional: false, enterprise: true },
];

const FAQS = [
  {
    q: "Is there a free trial?",
    a: "Yes. All plans include a 14-day free trial with no credit card required. You get full access to the features in your selected tier so you can evaluate the platform before committing.",
  },
  {
    q: "What counts as an 'employee' for seat limits?",
    a: "Any person in your organization who has a user account in EnterpriseComply. Auditors using the Auditor Portal with a read-only access token do not count toward your seat limit.",
  },
  {
    q: "Can I upgrade or downgrade mid-year?",
    a: "Yes. You can upgrade at any time and we will prorate the difference. Downgrades take effect at the next renewal date.",
  },
  {
    q: "Do you offer nonprofit or startup discounts?",
    a: "We offer 30% discounts for nonprofits and 20% for pre-Series A startups. Contact sales with verification and we will apply the discount to your account.",
  },
  {
    q: "How is the FedRAMP/CMMC layer different from competitors?",
    a: "Unlike competitors who bolt on federal as an add-on module, our federal layer is native to the platform. POA&M, SPRS score, and SSP generation are built directly into the app and share the same evidence and control data as your commercial frameworks - no duplicate data entry.",
  },
  {
    q: "What happens to my data if I cancel?",
    a: "You have 90 days after cancellation to export all your evidence, policies, and audit records. We provide a full JSON and PDF export. After 90 days, data is permanently deleted per our data retention policy.",
  },
];

function CheckIcon() {
  return (
    <svg className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg className="h-4 w-4 text-slate-300 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function CompareCell({ value }: { value: boolean | string }) {
  if (typeof value === "boolean") {
    return value ? <CheckIcon /> : <XIcon />;
  }
  return <span className="text-sm font-medium text-slate-700">{value}</span>;
}

export default function Pricing() {
  const { isSignedIn } = useAuth();

  return (
    <div className="min-h-screen bg-white font-inter">
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <a href={BASE_PATH + "/"} className="flex items-center gap-2.5">
            <img src={`${BASE_PATH}/logo.svg`} className="h-8 w-8" />
            <span className="font-bold text-slate-900 text-sm tracking-tight">EnterpriseComply</span>
          </a>
          <div className="flex items-center gap-4">
            <a href={BASE_PATH + "/"} className="text-sm text-slate-500 hover:text-slate-900">Home</a>
            {isSignedIn ? (
              <a href={BASE_PATH + "/dashboard"} className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700">
                Dashboard
              </a>
            ) : (
              <>
                <a href={BASE_PATH + "/sign-in"} className="text-sm text-slate-600 hover:text-slate-900">Sign in</a>
                <a href={BASE_PATH + "/sign-up"} className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700">
                  Start free trial
                </a>
              </>
            )}
          </div>
        </div>
      </nav>

      <div className="pt-24 pb-8 px-6 text-center max-w-3xl mx-auto">
        <p className="text-xs font-bold uppercase tracking-widest text-blue-600 mb-3">Transparent pricing</p>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight mb-4">
          Compliance infrastructure,<br />not compliance overhead.
        </h1>
        <p className="text-lg text-slate-500 leading-relaxed">
          One platform for every obligation. SOC 2, ISO 27001, HIPAA, FedRAMP, CMMC, and 8 more - all on the same evidence and control foundation. No per-framework add-ons.
        </p>
      </div>

      <div className="max-w-7xl mx-auto px-6 pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-16">
          {TIERS.map((tier) => (
            <div
              key={tier.name}
              className={`relative rounded-2xl flex flex-col ${tier.highlight
                ? "bg-blue-600 text-white shadow-2xl shadow-blue-200 scale-[1.02]"
                : "bg-white border border-slate-200"
              }`}
            >
              {tier.badge && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <span className="bg-amber-400 text-amber-900 text-xs font-bold px-3 py-1 rounded-full shadow">{tier.badge}</span>
                </div>
              )}
              <div className="p-7 flex-1">
                <div className="mb-5">
                  <p className={`text-xs font-bold uppercase tracking-widest mb-2 ${tier.highlight ? "text-blue-200" : "text-slate-400"}`}>{tier.name}</p>
                  <div className="flex items-end gap-1 mb-2">
                    <span className={`text-4xl font-extrabold tracking-tight ${tier.highlight ? "text-white" : "text-slate-900"}`}>{tier.price}</span>
                    {tier.period && <span className={`text-sm mb-1.5 ${tier.highlight ? "text-blue-200" : "text-slate-400"}`}>{tier.period}</span>}
                  </div>
                  <p className={`text-sm leading-relaxed ${tier.highlight ? "text-blue-100" : "text-slate-500"}`}>{tier.description}</p>
                </div>

                <a
                  href={BASE_PATH + tier.ctaHref}
                  className={`block w-full text-center py-3 rounded-xl font-semibold text-sm transition-all mb-6 ${tier.highlight
                    ? "bg-white text-blue-600 hover:bg-blue-50"
                    : "bg-blue-600 text-white hover:bg-blue-700"
                  }`}
                >
                  {tier.cta}
                </a>

                <div className="space-y-2.5">
                  {tier.features.map((f) => (
                    <div key={f.label} className="flex items-start gap-2.5">
                      <div className={`h-4 w-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${tier.highlight ? "bg-blue-500" : "bg-blue-50"}`}>
                        <svg className={`h-2.5 w-2.5 ${tier.highlight ? "text-white" : "text-blue-600"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <span className={`text-sm ${tier.highlight ? "text-blue-50" : "text-slate-600"}`}>{f.label}</span>
                    </div>
                  ))}
                  {tier.notIncluded.map((f) => (
                    <div key={f} className="flex items-start gap-2.5 opacity-50">
                      <div className={`h-4 w-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${tier.highlight ? "bg-blue-700" : "bg-slate-100"}`}>
                        <svg className={`h-2.5 w-2.5 ${tier.highlight ? "text-blue-300" : "text-slate-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </div>
                      <span className={`text-sm line-through ${tier.highlight ? "text-blue-200" : "text-slate-400"}`}>{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-slate-50 rounded-2xl border border-slate-200 p-6 mb-16">
          <h2 className="text-xl font-bold text-slate-900 mb-1">Full feature comparison</h2>
          <p className="text-sm text-slate-500 mb-6">See exactly what is included in each plan.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-3 pr-6 font-semibold text-slate-700 w-1/2">Feature</th>
                  <th className="text-center py-3 px-4 font-semibold text-slate-700">Starter</th>
                  <th className="text-center py-3 px-4 font-semibold text-blue-600">Professional</th>
                  <th className="text-center py-3 px-4 font-semibold text-slate-700">Enterprise</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((row, i) => (
                  <tr key={row.feature} className={i % 2 === 0 ? "bg-white" : ""}>
                    <td className="py-3 pr-6 text-slate-600 rounded-l-lg pl-3">{row.feature}</td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex justify-center"><CompareCell value={row.starter} /></div>
                    </td>
                    <td className="py-3 px-4 text-center bg-blue-50/50">
                      <div className="flex justify-center"><CompareCell value={row.professional} /></div>
                    </td>
                    <td className="py-3 px-4 text-center rounded-r-lg">
                      <div className="flex justify-center"><CompareCell value={row.enterprise} /></div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-16">
          {[
            { icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z", label: "Federal-native", desc: "POA&M, SPRS, SSP built in - not bolted on. The only GRC platform with a complete federal layer." },
            { icon: "M13 10V3L4 14h7v7l9-11h-7z", label: "No per-framework fees", desc: "Activate SOC 2, ISO 27001, FedRAMP, CMMC, and 8 more simultaneously. One price, all frameworks in your tier." },
            { icon: "M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z", label: "UCO architecture", desc: "41 universal controls map across all 12 frameworks. Implement once, satisfy all simultaneously." },
          ].map((item) => (
            <div key={item.label} className="bg-white border border-slate-200 rounded-xl p-5 flex gap-4">
              <div className="h-10 w-10 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
                <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-slate-900 text-sm mb-1">{item.label}</p>
                <p className="text-xs text-slate-500 leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mb-16">
          <h2 className="text-2xl font-bold text-slate-900 mb-6 text-center">Frequently asked questions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {FAQS.map((faq) => (
              <div key={faq.q} className="bg-white border border-slate-200 rounded-xl p-5">
                <p className="font-semibold text-slate-900 text-sm mb-2">{faq.q}</p>
                <p className="text-sm text-slate-500 leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gradient-to-br from-slate-900 to-blue-900 rounded-2xl p-10 text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-blue-300 mb-3">14-day free trial</p>
          <h2 className="text-3xl font-extrabold text-white mb-3">Ready to see it in action?</h2>
          <p className="text-slate-300 text-base mb-8 max-w-xl mx-auto">
            Start your free trial today. No credit card required. Full access to your selected tier for 14 days. Most teams achieve their first automated evidence collection in under 30 minutes.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a href={BASE_PATH + "/sign-up"} className="px-8 py-3.5 bg-blue-600 text-white font-semibold rounded-xl text-sm hover:bg-blue-500 transition-all hover:scale-105">
              Start free trial
            </a>
            <a href="mailto:sales@colorcodesolutions.com" className="px-8 py-3.5 border border-white/20 text-white font-semibold rounded-xl text-sm hover:bg-white/10 transition-all">
              Talk to sales
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

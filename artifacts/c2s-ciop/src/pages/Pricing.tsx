import { useAuth } from "@clerk/react";
import { useState } from "react";

const BASE_PATH = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

const TIERS = [
  {
    name: "Essentials",
    monthlyPrice: 500,
    annualPrice: 6000,
    annualMonthly: 500,
    description: "For startups and growing teams pursuing their first certification.",
    highlight: false,
    cta: "Start free trial",
    ctaHref: "/sign-up",
    features: [
      { label: "Up to 5 users" },
      { label: "3 active frameworks" },
      { label: "Evidence vault (unlimited documents)" },
      { label: "Policy library (30 templates)" },
      { label: "Automated control testing" },
      { label: "UCO universal control mapping" },
      { label: "Trust Center (public page)" },
      { label: "10 integrations" },
      { label: "Email support (48h SLA)" },
    ],
    notIncluded: [
      "Federal frameworks (FedRAMP, CMMC, NIST 800-53)",
      "POA&M + SPRS + SSP Generator",
      "Auditor Portal",
      "Risk register + heat map",
      "Access reviews",
      "Custom frameworks",
      "Dedicated CSM",
    ],
  },
  {
    name: "Professional",
    monthlyPrice: 1500,
    annualPrice: 15000,
    annualMonthly: 1250,
    description: "For scaling companies managing multiple frameworks and audit engagements.",
    highlight: false,
    cta: "Start free trial",
    ctaHref: "/sign-up",
    features: [
      { label: "Up to 25 users" },
      { label: "Unlimited commercial frameworks" },
      { label: "Evidence vault (unlimited)" },
      { label: "Policy library + custom templates" },
      { label: "Automated control testing + drift detection" },
      { label: "UCO universal control mapping" },
      { label: "Auditor Portal with access tokens" },
      { label: "Access reviews and attestation campaigns" },
      { label: "Risk register with heat map" },
      { label: "AI questionnaire assist" },
      { label: "Custom frameworks builder" },
      { label: "Trust Center (branded)" },
      { label: "30+ integrations" },
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
    name: "Federal",
    monthlyPrice: 2400,
    annualPrice: 24000,
    annualMonthly: 2000,
    description: "For DoD contractors and defense suppliers requiring CMMC, NIST 800-171, and POA&M compliance.",
    highlight: true,
    badge: "Federal-native",
    mspCallout: "CMMC MSPs charge $5k-15k/mo. EnterpriseComply Federal: $2,000/mo. Same outcome: your data, your program.",
    cta: "Start free trial",
    ctaHref: "/sign-up",
    features: [
      { label: "Up to 50 users" },
      { label: "Everything in Professional" },
      { label: "CMMC Level 2 (NIST SP 800-171)" },
      { label: "NIST 800-53 Rev 5" },
      { label: "FedRAMP Moderate preparation" },
      { label: "Native POA&M management" },
      { label: "SPRS score tracking (DoD required)" },
      { label: "SSP Generator (NIST SP 800-18)" },
      { label: "Dedicated Customer Success Manager" },
      { label: "Priority support (4h SLA)" },
    ],
    notIncluded: [
      "FedRAMP High ATO",
      "CMMC Level 3",
      "On-premise deployment",
      "Custom SLA guarantees",
    ],
  },
  {
    name: "Enterprise",
    monthlyPrice: null,
    annualPrice: null,
    annualMonthly: null,
    description: "For large primes, government agencies, and contractors requiring FedRAMP authorization or CMMC Level 3.",
    highlight: false,
    cta: "Talk to sales",
    ctaHref: "/sign-up",
    features: [
      { label: "Unlimited users" },
      { label: "Everything in Federal" },
      { label: "FedRAMP High ATO support" },
      { label: "CMMC Level 3 (NIST SP 800-172)" },
      { label: "Custom integrations + connectors" },
      { label: "SLA guarantees (99.9% uptime)" },
      { label: "SSO / SAML integration" },
      { label: "On-premise deployment option" },
      { label: "Custom data retention policies" },
      { label: "White-glove onboarding" },
      { label: "24/7 phone + Slack support" },
    ],
    notIncluded: [],
  },
];

const COMPARISON = [
  { feature: "Users", essentials: "5", professional: "25", federal: "50", enterprise: "Unlimited" },
  { feature: "Commercial frameworks", essentials: "3", professional: "Unlimited", federal: "Unlimited", enterprise: "Unlimited" },
  { feature: "Integrations", essentials: "10", professional: "30+", federal: "30+", enterprise: "30+ custom" },
  { feature: "UCO universal controls", essentials: true, professional: true, federal: true, enterprise: true },
  { feature: "Evidence vault", essentials: true, professional: true, federal: true, enterprise: true },
  { feature: "Automated control testing", essentials: true, professional: true, federal: true, enterprise: true },
  { feature: "Policy library (30 templates)", essentials: true, professional: true, federal: true, enterprise: true },
  { feature: "Trust Center", essentials: true, professional: true, federal: true, enterprise: true },
  { feature: "Auditor Portal", essentials: false, professional: true, federal: true, enterprise: true },
  { feature: "Access reviews", essentials: false, professional: true, federal: true, enterprise: true },
  { feature: "Risk register + heat map", essentials: false, professional: true, federal: true, enterprise: true },
  { feature: "AI questionnaire assist", essentials: false, professional: true, federal: true, enterprise: true },
  { feature: "Custom frameworks", essentials: false, professional: true, federal: true, enterprise: true },
  { feature: "Drift detection + monitoring", essentials: false, professional: true, federal: true, enterprise: true },
  { feature: "CMMC L2 / NIST 800-171", essentials: false, professional: false, federal: true, enterprise: true },
  { feature: "NIST 800-53 Rev 5", essentials: false, professional: false, federal: true, enterprise: true },
  { feature: "FedRAMP Moderate prep", essentials: false, professional: false, federal: true, enterprise: true },
  { feature: "POA&M management", essentials: false, professional: false, federal: true, enterprise: true },
  { feature: "SPRS score tracking", essentials: false, professional: false, federal: true, enterprise: true },
  { feature: "SSP Generator", essentials: false, professional: false, federal: true, enterprise: true },
  { feature: "Dedicated CSM", essentials: false, professional: false, federal: true, enterprise: true },
  { feature: "FedRAMP High / CMMC L3", essentials: false, professional: false, federal: false, enterprise: true },
  { feature: "SLA guarantees", essentials: false, professional: false, federal: false, enterprise: true },
  { feature: "SSO / SAML", essentials: false, professional: false, federal: false, enterprise: true },
  { feature: "On-premise deployment", essentials: false, professional: false, federal: false, enterprise: true },
];

const COMPETITORS = [
  {
    name: "Vanta",
    price: "$7,500-45,000/yr",
    frameworks: "Commercial only",
    federal: false,
    poam: false,
    sprs: false,
    ssp: false,
    note: "No federal layer",
  },
  {
    name: "Drata",
    price: "$10,000-50,000/yr",
    frameworks: "Commercial only",
    federal: false,
    poam: false,
    sprs: false,
    ssp: false,
    note: "No federal layer",
  },
  {
    name: "Secureframe",
    price: "$10,000-35,000/yr",
    frameworks: "Commercial only",
    federal: false,
    poam: false,
    sprs: false,
    ssp: false,
    note: "No federal layer",
  },
  {
    name: "CMMC MSP",
    price: "$30,000-180,000/yr",
    frameworks: "Federal only",
    federal: true,
    poam: true,
    sprs: true,
    ssp: true,
    note: "No software. You own nothing.",
  },
  {
    name: "EnterpriseComply",
    price: "$6,000-24,000/yr",
    frameworks: "Commercial + Federal",
    federal: true,
    poam: true,
    sprs: true,
    ssp: true,
    note: "Only platform with both",
    highlight: true,
  },
];

const FAQS = [
  {
    q: "Is there a free trial?",
    a: "Yes. All plans include a 14-day free trial with no credit card required. You get full access to the features in your selected tier so you can evaluate the platform before committing.",
  },
  {
    q: "What counts as a 'user'?",
    a: "Any person in your organization with a login to EnterpriseComply. Auditors accessing your Auditor Portal via a read-only access token do not count toward your user limit.",
  },
  {
    q: "Why do I need the Federal tier for CMMC?",
    a: "CMMC Level 2 requires NIST SP 800-171 controls, a System Security Plan (SSP), a Plan of Action and Milestones (POA&M), and a SPRS score in the DoD portal. These are native to the Federal tier, not available as add-ons in Essentials or Professional.",
  },
  {
    q: "How does EnterpriseComply compare to hiring a CMMC MSP?",
    a: "A CMMC MSP typically charges $5,000-15,000 per month to manage your compliance program. When they close or you change providers, you may have to rebuild from scratch. EnterpriseComply Federal at $2,000/month gives you the same capability with full data ownership and portability. Export everything at any time.",
  },
  {
    q: "Can I upgrade or downgrade mid-year?",
    a: "Yes. You can upgrade at any time and we will prorate the difference. Downgrades take effect at your next renewal date.",
  },
  {
    q: "Do you offer monthly billing?",
    a: "Yes. Monthly billing is available on all tiers at a 20% premium over the annual rate. Annual billing is the best value and includes a locked-in rate for the full year.",
  },
  {
    q: "What frameworks are included in the Federal tier?",
    a: "CMMC Level 2, NIST SP 800-171, NIST 800-53 Rev 5, NIST CSF 2.0, FedRAMP Moderate preparation, and DFARS 252.204-7012. FedRAMP High and CMMC Level 3 are available in the Enterprise tier.",
  },
  {
    q: "What happens to my data if I cancel?",
    a: "You have 90 days after cancellation to export all your evidence, policies, POA&Ms, and audit records in JSON and CSV format. After 90 days, data is permanently deleted per our retention policy. See our Trust Center for full portability commitments.",
  },
  {
    q: "Do you offer nonprofit or startup discounts?",
    a: "Yes. 30% for verified nonprofits and 20% for pre-Series A startups. Contact sales with documentation and we will apply the discount immediately.",
  },
];

function CheckIcon({ colored = false }: { colored?: boolean }) {
  return (
    <svg className={`h-4 w-4 flex-shrink-0 mt-0.5 ${colored ? "text-green-800" : "text-emerald-500"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
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
  const [annual, setAnnual] = useState(true);

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
              <a href={BASE_PATH + "/dashboard"} className="px-4 py-2 bg-green-800 text-white text-sm font-semibold rounded-lg hover:bg-green-900">
                Dashboard
              </a>
            ) : (
              <>
                <a href={BASE_PATH + "/sign-in"} className="text-sm text-slate-600 hover:text-slate-900">Sign in</a>
                <a href={BASE_PATH + "/sign-up"} className="px-4 py-2 bg-green-800 text-white text-sm font-semibold rounded-lg hover:bg-green-900">
                  Start free trial
                </a>
              </>
            )}
          </div>
        </div>
      </nav>

      <div className="pt-24 pb-8 px-6 text-center max-w-3xl mx-auto">
        <p className="text-xs font-bold uppercase tracking-widest text-green-800 mb-3">Transparent pricing</p>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight mb-4">
          Compliance infrastructure,<br />not compliance overhead.
        </h1>
        <p className="text-lg text-slate-500 leading-relaxed mb-8">
          The only GRC platform with a native federal layer. SOC 2, ISO 27001, HIPAA, CMMC, FedRAMP, and 8 more, all on the same evidence and control foundation. No per-framework fees.
        </p>

        <div className="inline-flex items-center gap-1 bg-slate-100 rounded-xl p-1">
          <button
            onClick={() => setAnnual(true)}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${annual ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          >
            Annual
            <span className="ml-1.5 text-xs font-bold text-emerald-600">Save 17%</span>
          </button>
          <button
            onClick={() => setAnnual(false)}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${!annual ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          >
            Monthly
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-5 mb-6">
          {TIERS.map((tier) => {
            const price = tier.annualPrice === null
              ? "Custom"
              : annual
                ? `$${(tier.annualMonthly!).toLocaleString()}`
                : `$${(tier.monthlyPrice!).toLocaleString()}`;
            const priceNote = tier.annualPrice === null
              ? ""
              : annual
                ? `$${tier.annualPrice!.toLocaleString()}/year billed annually`
                : "per month, billed monthly";

            return (
              <div
                key={tier.name}
                className={`relative rounded-2xl flex flex-col ${tier.highlight
                  ? "bg-green-800 text-white shadow-2xl shadow-blue-200 ring-2 ring-green-800"
                  : "bg-white border border-slate-200"
                }`}
              >
                {tier.badge && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <span className="bg-amber-400 text-amber-900 text-xs font-bold px-3 py-1 rounded-full shadow whitespace-nowrap">{tier.badge}</span>
                  </div>
                )}
                <div className="p-6 flex-1 flex flex-col">
                  <div className="mb-4">
                    <p className={`text-xs font-bold uppercase tracking-widest mb-2 ${tier.highlight ? "text-green-200" : "text-slate-400"}`}>{tier.name}</p>
                    <div className="flex items-end gap-1 mb-1">
                      <span className={`text-3xl font-extrabold tracking-tight ${tier.highlight ? "text-white" : "text-slate-900"}`}>{price}</span>
                      {tier.annualPrice !== null && <span className={`text-sm mb-1 ${tier.highlight ? "text-green-200" : "text-slate-400"}`}>/mo</span>}
                    </div>
                    {priceNote && (
                      <p className={`text-xs mb-2 ${tier.highlight ? "text-green-200" : "text-slate-400"}`}>{priceNote}</p>
                    )}
                    <p className={`text-sm leading-relaxed ${tier.highlight ? "text-green-100" : "text-slate-500"}`}>{tier.description}</p>
                  </div>

                  {tier.mspCallout && (
                    <div className="bg-green-700/40 border border-green-400/50 rounded-xl p-3 mb-4">
                      <p className="text-xs text-green-100 leading-relaxed">{tier.mspCallout}</p>
                    </div>
                  )}

                  <a
                    href={BASE_PATH + tier.ctaHref}
                    className={`block w-full text-center py-2.5 rounded-xl font-semibold text-sm transition-all mb-5 ${tier.highlight
                      ? "bg-white text-green-800 hover:bg-green-50"
                      : "bg-green-800 text-white hover:bg-green-900"
                    }`}
                  >
                    {tier.cta}
                  </a>

                  <div className="space-y-2 flex-1">
                    {tier.features.map((f) => (
                      <div key={f.label} className="flex items-start gap-2">
                        <div className={`h-4 w-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${tier.highlight ? "bg-green-700" : "bg-green-50"}`}>
                          <svg className={`h-2.5 w-2.5 ${tier.highlight ? "text-white" : "text-green-800"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <span className={`text-xs leading-relaxed ${tier.highlight ? "text-green-50" : "text-slate-600"}`}>{f.label}</span>
                      </div>
                    ))}
                    {tier.notIncluded.map((f) => (
                      <div key={f} className="flex items-start gap-2 opacity-40">
                        <div className={`h-4 w-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${tier.highlight ? "bg-green-900" : "bg-slate-100"}`}>
                          <svg className={`h-2.5 w-2.5 ${tier.highlight ? "text-green-500" : "text-slate-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </div>
                        <span className={`text-xs line-through leading-relaxed ${tier.highlight ? "text-green-200" : "text-slate-400"}`}>{f}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-center text-xs text-slate-400 mb-16">All plans include a 14-day free trial. No credit card required.</p>

        {/* Competitive comparison */}
        <div className="mb-16">
          <div className="text-center mb-8">
            <p className="text-xs font-bold uppercase tracking-widest text-green-800 mb-2">Competitive landscape</p>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">The only platform with commercial and federal in one place</h2>
            <p className="text-slate-500 text-sm max-w-xl mx-auto">Vanta and Drata cover commercial frameworks. CMMC MSPs cover federal. Only EnterpriseComply does both, at a fraction of the MSP cost.</p>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left py-3 px-5 font-semibold text-slate-700">Provider</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">Annual cost</th>
                  <th className="text-center py-3 px-4 font-semibold text-slate-700">Federal frameworks</th>
                  <th className="text-center py-3 px-4 font-semibold text-slate-700">POA&M</th>
                  <th className="text-center py-3 px-4 font-semibold text-slate-700">SPRS score</th>
                  <th className="text-center py-3 px-4 font-semibold text-slate-700">SSP generator</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">Note</th>
                </tr>
              </thead>
              <tbody>
                {COMPETITORS.map((c, i) => (
                  <tr key={c.name} className={`border-b border-slate-100 last:border-0 ${c.highlight ? "bg-green-50" : i % 2 === 0 ? "bg-white" : "bg-slate-50/50"}`}>
                    <td className="py-3 px-5">
                      <span className={`font-semibold ${c.highlight ? "text-green-700" : "text-slate-900"}`}>{c.name}</span>
                      {c.highlight && <span className="ml-2 text-xs bg-green-800 text-white px-1.5 py-0.5 rounded font-bold">YOU</span>}
                    </td>
                    <td className="py-3 px-4 text-slate-600">{c.price}</td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex justify-center">{c.federal ? <CheckIcon /> : <XIcon />}</div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex justify-center">{c.poam ? <CheckIcon /> : <XIcon />}</div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex justify-center">{c.sprs ? <CheckIcon /> : <XIcon />}</div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex justify-center">{c.ssp ? <CheckIcon /> : <XIcon />}</div>
                    </td>
                    <td className={`py-3 px-4 text-xs ${c.highlight ? "text-green-700 font-semibold" : "text-slate-400"}`}>{c.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Full feature comparison */}
        <div className="bg-slate-50 rounded-2xl border border-slate-200 p-6 mb-16">
          <h2 className="text-xl font-bold text-slate-900 mb-1">Full feature comparison</h2>
          <p className="text-sm text-slate-500 mb-6">See exactly what is included in each plan.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-3 pr-6 font-semibold text-slate-700 w-[40%]">Feature</th>
                  <th className="text-center py-3 px-3 font-semibold text-slate-700">Essentials</th>
                  <th className="text-center py-3 px-3 font-semibold text-slate-700">Professional</th>
                  <th className="text-center py-3 px-3 font-semibold text-green-800">Federal</th>
                  <th className="text-center py-3 px-3 font-semibold text-slate-700">Enterprise</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((row, i) => (
                  <tr key={row.feature} className={i % 2 === 0 ? "bg-white" : ""}>
                    <td className="py-2.5 pr-6 text-slate-600 rounded-l-lg pl-3 text-sm">{row.feature}</td>
                    <td className="py-2.5 px-3 text-center">
                      <div className="flex justify-center"><CompareCell value={row.essentials} /></div>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <div className="flex justify-center"><CompareCell value={row.professional} /></div>
                    </td>
                    <td className="py-2.5 px-3 text-center bg-green-50/50">
                      <div className="flex justify-center"><CompareCell value={row.federal} /></div>
                    </td>
                    <td className="py-2.5 px-3 text-center rounded-r-lg">
                      <div className="flex justify-center"><CompareCell value={row.enterprise} /></div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Value props */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-16">
          {[
            {
              icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
              label: "Federal-native, not bolted on",
              desc: "POA&M, SPRS, and SSP generation are built into the core platform, not third-party modules. The same evidence powering your SOC 2 satisfies your CMMC controls.",
            },
            {
              icon: "M13 10V3L4 14h7v7l9-11h-7z",
              label: "No per-framework fees",
              desc: "Activate SOC 2, CMMC L2, ISO 27001, FedRAMP Moderate prep, and more simultaneously. One price covers every framework in your tier.",
            },
            {
              icon: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z",
              label: "You own your compliance data",
              desc: "Export everything (evidence, POA&Ms, risk register) at any time in standard formats. No lock-in, no MSP dependency, no starting over if you change providers.",
            },
          ].map((item) => (
            <div key={item.label} className="bg-white border border-slate-200 rounded-xl p-5 flex gap-4">
              <div className="h-10 w-10 bg-green-50 rounded-xl flex items-center justify-center flex-shrink-0">
                <svg className="h-5 w-5 text-green-800" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
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

        {/* FAQ */}
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

        {/* CTA */}
        <div className="bg-gradient-to-br from-green-950 to-green-800 rounded-2xl p-10 text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-green-500 mb-3">14-day free trial</p>
          <h2 className="text-3xl font-extrabold text-white mb-3">Ready to see it in action?</h2>
          <p className="text-slate-300 text-base mb-8 max-w-xl mx-auto">
            Start your free trial today. No credit card required. Full access to your selected tier for 14 days. Most teams complete their first automated evidence collection in under 30 minutes.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a href={BASE_PATH + "/sign-up"} className="px-8 py-3.5 bg-green-800 text-white font-semibold rounded-xl text-sm hover:bg-green-700 transition-all hover:scale-105">
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

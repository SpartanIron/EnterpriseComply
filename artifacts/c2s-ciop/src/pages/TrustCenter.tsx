import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/queryClient";
import { useOrg } from "@/hooks/useOrg";

function ScoreRing({ score, size = 64 }: { score: number; size?: number }) {
  const r = size * 0.38;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(Math.max(score, 0), 100);
  const offset = circ - (pct / 100) * circ;
  const color = pct >= 80 ? "#16a34a" : pct >= 60 ? "#d97706" : "#dc2626";
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rotate-[-90deg]">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={size * 0.08} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={size * 0.08}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" />
      <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle"
        fill={color} fontSize={size * 0.24} fontWeight="700" style={{ transform: "rotate(90deg)", transformOrigin: "center" }}>
        {Math.round(pct)}%
      </text>
    </svg>
  );
}

const SUBPROCESSORS = [
  { name: "Amazon Web Services", purpose: "Cloud infrastructure and data hosting", region: "US (us-east-1, us-west-2)", link: "https://aws.amazon.com/compliance/data-privacy-faq/" },
  { name: "Clerk", purpose: "User authentication and identity management", region: "US", link: "https://clerk.com/legal/privacy" },
  { name: "Neon (PostgreSQL)", purpose: "Database hosting and storage", region: "US (us-east-2)", link: "https://neon.tech/privacy-policy" },
  { name: "Railway", purpose: "Application deployment and hosting", region: "US (us-west-2)", link: "https://railway.app/legal/privacy" },
  { name: "OpenAI", purpose: "AI-assisted questionnaire responses (opt-in)", region: "US", link: "https://openai.com/policies/privacy-policy" },
  { name: "GitHub", purpose: "Source code repository and CI/CD", region: "US", link: "https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement" },
];

const SECURITY_PRACTICES = [
  { title: "Encryption at rest", desc: "All customer data encrypted at rest using AES-256. Database and backups use server-side encryption.", icon: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" },
  { title: "Encryption in transit", desc: "TLS 1.2+ enforced for all API and web traffic. HSTS enabled. Certificate pinning on mobile.", icon: "M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" },
  { title: "Multi-tenant isolation", desc: "Each organization's data is logically isolated by org_id. Cross-tenant data access is architecturally impossible.", icon: "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" },
  { title: "Zero-trust access", desc: "Employee access to production systems requires MFA, device trust, and just-in-time credential issuance.", icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" },
  { title: "Penetration testing", desc: "Annual third-party penetration tests conducted by certified security firms. Findings remediated within SLA.", icon: "M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" },
  { title: "Vulnerability management", desc: "Continuous dependency scanning via Snyk. Critical CVEs patched within 24 hours of disclosure.", icon: "M20.618 5.984A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016zM9 10h.01M15 10h.01M12 14h.01" },
  { title: "Audit logging", desc: "All administrative actions, data access, and configuration changes are logged with immutable audit trails.", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" },
  { title: "Backup and recovery", desc: "Continuous database replication with point-in-time recovery. RTO < 4h, RPO < 1h. Backups tested quarterly.", icon: "M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582 4-8 4s8 1.79 8 4" },
];

const CERTIFICATIONS = [
  { name: "SOC 2 Type II", status: "In progress", color: "blue", desc: "Audit period Jan - Jun 2025" },
  { name: "ISO 27001", status: "Planned Q4 2025", color: "slate", desc: "Gap assessment complete" },
];

export default function TrustCenter() {
  const { orgId } = useOrg();
  const [activeTab, setActiveTab] = useState<"overview" | "security" | "subprocessors" | "certifications">("overview");
  const [showSetup, setShowSetup] = useState(false);

  const { data: preview, isLoading } = useQuery<any>({
    queryKey: ["trust-center-preview", orgId],
    queryFn: () => apiFetch(`/orgs/${orgId}/trust-center`),
    enabled: !!orgId,
  });

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "security", label: "Security Practices" },
    { id: "subprocessors", label: "Sub-processors" },
    { id: "certifications", label: "Certifications" },
  ] as const;

  return (
    <div className="p-6 max-w-screen-xl">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Trust Center</h1>
          <p className="text-sm text-slate-500 mt-0.5">Your public-facing security and compliance page</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowSetup(!showSetup)} className="px-4 py-2 border border-slate-200 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50">
            Setup guide
          </button>
          <button
            className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 flex items-center gap-2"
            onClick={() => { if (navigator.clipboard) navigator.clipboard.writeText(window.location.href.replace("trust-center", "trust") || ""); }}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
            Share Trust Center
          </button>
        </div>
      </div>

      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-1 mb-6">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-xl px-6 py-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <svg className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <p className="text-white font-bold text-lg">{preview?.org?.name ?? "Your Organization"}</p>
              <p className="text-blue-100 text-sm">Security and compliance overview - updated automatically</p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <ScoreRing score={preview?.overallScore ?? 0} size={76} />
            <div className="text-right">
              <p className="text-white font-bold text-2xl">{(preview?.frameworks ?? []).length}</p>
              <p className="text-blue-200 text-xs">Active frameworks</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-1 mb-6 bg-slate-100 rounded-xl p-1 w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTab === tab.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "overview" && (
        <div className="space-y-5">
          {showSetup && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
              <p className="font-semibold text-blue-900 text-sm mb-3">How to set up your Trust Center</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[
                  { step: "1", title: "Activate frameworks", body: "Go to Frameworks and activate SOC 2, ISO 27001, or any compliance standard to show your certifications.", link: "/frameworks" },
                  { step: "2", title: "Publish policies", body: "Go to Policies, create policies from templates, and publish them to surface them on your trust page.", link: "/policies" },
                  { step: "3", title: "Share the URL", body: "Share your Trust Center URL with customers, prospects, and auditors - it updates automatically.", link: null },
                ].map(({ step, title, body, link }) => (
                  <div key={step} className="bg-white border border-blue-100 rounded-xl p-4">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-white text-xs font-bold mb-2">{step}</span>
                    <p className="font-semibold text-slate-800 text-sm mb-1">{title}</p>
                    <p className="text-xs text-slate-500 leading-relaxed mb-2">{body}</p>
                    {link && <a href={link} className="text-xs text-blue-600 font-semibold hover:underline">Go to {title.split(" ")[1]} &rarr;</a>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {preview && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <p className="font-semibold text-slate-800 text-sm">Framework compliance scores</p>
                <span className="text-xs text-slate-400">Live data - updates as evidence is collected</span>
              </div>
              <div className="p-6 grid grid-cols-2 lg:grid-cols-4 gap-3">
                {(preview.frameworks ?? []).map((f: any) => (
                  <div key={f.key} className="border border-slate-200 rounded-xl p-4 text-center">
                    <p className="text-sm font-semibold text-slate-800 mb-1">{f.shortName}</p>
                    <p className={`text-2xl font-extrabold mb-1 ${f.complianceScore >= 80 ? "text-green-600" : f.complianceScore >= 60 ? "text-amber-600" : "text-red-600"}`}>
                      {Math.round(f.complianceScore)}%
                    </p>
                    <p className="text-xs text-slate-400">{f.passingControls}/{f.totalControls} controls</p>
                  </div>
                ))}
                {(preview.frameworks ?? []).length === 0 && (
                  <div className="col-span-4 text-center py-8 text-slate-400 text-sm">
                    No active frameworks yet. <a href="/frameworks" className="text-blue-600 hover:underline">Activate frameworks</a> to show compliance scores.
                  </div>
                )}
              </div>
            </div>
          )}

          {preview?.securityHighlights?.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <p className="font-semibold text-slate-800 text-sm mb-3">Security highlights</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {preview.securityHighlights.map((h: any) => (
                  <div key={h.label} className="flex items-center gap-2 text-sm text-slate-700 bg-green-50 rounded-lg px-3 py-2">
                    <div className="w-4 h-4 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                      <svg className="h-2.5 w-2.5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                    </div>
                    {h.label}
                  </div>
                ))}
              </div>
            </div>
          )}

          {preview?.publishedPolicies?.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <p className="font-semibold text-slate-800 text-sm mb-3">Published policies ({preview.publishedPolicies.length})</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {preview.publishedPolicies.map((p: any) => (
                  <div key={p.title} className="flex items-center justify-between text-sm p-3 border border-slate-100 rounded-lg">
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 bg-blue-50 rounded flex items-center justify-center">
                        <svg className="h-3.5 w-3.5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                      </div>
                      <span className="text-slate-700 font-medium">{p.title}</span>
                    </div>
                    <span className="text-xs text-slate-400 bg-slate-50 px-2 py-0.5 rounded">v{p.version}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-500">
            <p className="font-semibold text-slate-700 mb-1">How to use your Trust Center</p>
            <p>Share your Trust Center URL with prospects, customers, and auditors instead of filling out manual security questionnaires. The page updates automatically as your compliance posture changes. You can also link it in your privacy policy, security page, or vendor portal.</p>
          </div>
        </div>
      )}

      {activeTab === "security" && (
        <div className="space-y-5">
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3">
            <svg className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
            <div>
              <p className="font-semibold text-green-800 text-sm">Security is bundled, not an add-on</p>
              <p className="text-green-700 text-xs mt-0.5 leading-relaxed">All security practices below are included in every plan. We do not charge extra for encryption, audit logs, or MFA enforcement. This is the baseline, not a premium feature.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {SECURITY_PRACTICES.map((practice) => (
              <div key={practice.title} className="bg-white border border-slate-200 rounded-xl p-5 flex gap-4">
                <div className="h-10 w-10 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
                  <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={practice.icon} />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-slate-900 text-sm mb-1">{practice.title}</p>
                  <p className="text-xs text-slate-500 leading-relaxed">{practice.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <p className="font-semibold text-slate-800 text-sm mb-3">Responsible disclosure</p>
            <p className="text-sm text-slate-500 leading-relaxed mb-3">
              We take security vulnerabilities seriously. If you discover a security issue, please report it to <a href="mailto:security@colorcodesolutions.com" className="text-blue-600 hover:underline font-medium">security@colorcodesolutions.com</a>. We commit to responding within 24 hours and providing a fix timeline within 72 hours for critical issues.
            </p>
            <div className="flex gap-2">
              <span className="px-2.5 py-1 bg-green-50 text-green-700 text-xs font-medium rounded-lg">24h response SLA</span>
              <span className="px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded-lg">No legal action for good-faith research</span>
            </div>
          </div>
        </div>
      )}

      {activeTab === "subprocessors" && (
        <div className="space-y-5">
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <p className="font-semibold text-slate-800 text-sm">Sub-processors</p>
              <p className="text-xs text-slate-500 mt-0.5">Third-party services that process customer data on our behalf. All sub-processors are bound by DPA agreements.</p>
            </div>
            <div className="divide-y divide-slate-100">
              {SUBPROCESSORS.map((sp) => (
                <div key={sp.name} className="px-5 py-4 flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-semibold text-slate-800">{sp.name}</p>
                      <a href={sp.link} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-600">
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                      </a>
                    </div>
                    <p className="text-xs text-slate-500">{sp.purpose}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-500 bg-slate-50 px-2.5 py-1 rounded-lg">{sp.region}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-500 leading-relaxed">
            <p className="font-semibold text-slate-700 mb-1">Data Processing Agreements</p>
            <p>All sub-processors listed above have executed Data Processing Agreements (DPAs) with ColorCode Solutions. Customer data is not sold or shared with third parties for advertising or marketing purposes. To request our DPA or a list of updated sub-processors, contact <a href="mailto:privacy@colorcodesolutions.com" className="text-blue-600 hover:underline">privacy@colorcodesolutions.com</a>.</p>
          </div>
        </div>
      )}

      {activeTab === "certifications" && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {CERTIFICATIONS.map((cert) => (
              <div key={cert.name} className="bg-white border border-slate-200 rounded-xl p-5 flex items-start gap-4">
                <div className={`h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0 ${cert.color === "blue" ? "bg-blue-50" : "bg-slate-50"}`}>
                  <svg className={`h-6 w-6 ${cert.color === "blue" ? "text-blue-600" : "text-slate-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-slate-900 text-sm mb-1">{cert.name}</p>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cert.color === "blue" ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-500"}`}>{cert.status}</span>
                  </div>
                  <p className="text-xs text-slate-500">{cert.desc}</p>
                </div>
              </div>
            ))}
            <div className="bg-white border border-dashed border-slate-300 rounded-xl p-5 flex items-start gap-4">
              <div className="h-12 w-12 rounded-xl bg-slate-50 flex items-center justify-center flex-shrink-0">
                <svg className="h-6 w-6 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-slate-400 text-sm mb-1">More certifications in progress</p>
                <p className="text-xs text-slate-400 leading-relaxed">We are actively working toward additional certifications. Activate a framework to begin tracking your progress.</p>
                <a href="/frameworks" className="text-xs text-blue-600 font-semibold hover:underline mt-2 inline-block">View frameworks &rarr;</a>
              </div>
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <p className="font-semibold text-slate-800 text-sm mb-3">Your compliance frameworks as trust signals</p>
            <p className="text-xs text-slate-500 leading-relaxed mb-4">Every framework you activate in EnterpriseComply contributes to your Trust Center score and is visible to customers. The more frameworks you maintain, the stronger your signal to enterprise buyers and government agencies.</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {["SOC 2", "ISO 27001", "HIPAA", "PCI DSS", "FedRAMP", "CMMC L2", "NIST 800-53", "NIST 800-171"].map((fw) => (
                <div key={fw} className="text-xs px-3 py-2 bg-slate-50 text-slate-600 rounded-lg text-center font-medium">{fw}</div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

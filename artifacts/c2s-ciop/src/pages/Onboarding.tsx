import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiUrl } from "@/lib/queryClient";

const BASE_PATH = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

const INDUSTRIES = ["Technology", "Healthcare", "Finance", "Retail", "Manufacturing", "Government", "Education", "Other"];
const SIZES = ["1-10", "11-50", "51-200", "201-500", "501-1000", "1000+"];

const FRAMEWORKS = [
  { key: "soc2", name: "SOC 2 Type II", category: "commercial" },
  { key: "iso27001", name: "ISO 27001", category: "commercial" },
  { key: "pci", name: "PCI DSS 4.0", category: "commercial" },
  { key: "hipaa", name: "HIPAA", category: "commercial" },
  { key: "gdpr", name: "GDPR", category: "commercial" },
  { key: "ccpa", name: "CCPA", category: "commercial" },
  { key: "fedramp", name: "FedRAMP Moderate", category: "federal" },
  { key: "nist-800-53", name: "NIST SP 800-53", category: "federal" },
  { key: "nist-800-171", name: "NIST SP 800-171", category: "federal" },
  { key: "cmmc", name: "CMMC Level 2", category: "federal" },
  { key: "nist-csf", name: "NIST CSF 2.0", category: "best-practice" },
  { key: "cis", name: "CIS Controls v8", category: "best-practice" },
];

const FRAMEWORK_COLORS: Record<string, string> = {
  soc2: "from-blue-500 to-blue-600",
  iso27001: "from-purple-500 to-purple-600",
  "nist-csf": "from-indigo-500 to-indigo-600",
  "nist-800-53": "from-violet-500 to-violet-600",
  "nist-800-171": "from-blue-600 to-blue-700",
  hipaa: "from-teal-500 to-teal-600",
  pci: "from-orange-500 to-orange-600",
  gdpr: "from-rose-500 to-rose-600",
  fedramp: "from-slate-500 to-slate-600",
  cmmc: "from-green-500 to-green-600",
  ccpa: "from-amber-500 to-amber-600",
  cis: "from-cyan-500 to-cyan-600",
};

function ScoreRing({ score, size = 80 }: { score: number; size?: number }) {
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color = score >= 70 ? "#22c55e" : score >= 40 ? "#f59e0b" : "#ef4444";
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={8} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={8}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dasharray 1s ease" }}
      />
      <text x={size / 2} y={size / 2 + 1} textAnchor="middle" dominantBaseline="middle" fontSize={size * 0.22} fontWeight="700" fill="#0f172a">
        {score}%
      </text>
    </svg>
  );
}

export default function Onboarding() {
  const [, navigate] = useLocation();
  const [step, setStep] = useState(1);
  const [orgData, setOrgData] = useState({ name: "", industry: INDUSTRIES[0], size: SIZES[1], website: "" });
  const [selectedFrameworks, setSelectedFrameworks] = useState<string[]>([]);
  const [createdOrgId, setCreatedOrgId] = useState<number | null>(null);

  const { data: existingOrg } = useQuery<{ org: any }>({
    queryKey: ["orgs", "me"],
    queryFn: async () => (await fetch(apiUrl("/orgs/me"), { credentials: "include" })).json(),
  });

  const orgId = createdOrgId ?? existingOrg?.org?.id;

  const createOrg = useMutation({
    mutationFn: async () => {
      const res = await fetch(apiUrl("/orgs"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(orgData),
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      if (data?.org?.id) setCreatedOrgId(data.org.id);
      setStep(2);
    },
  });

  const activateFrameworks = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(apiUrl(`/orgs/${id}/frameworks`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ frameworkKeys: selectedFrameworks }),
      });
      return res.json();
    },
    onSuccess: () => setStep(3),
  });

  const completeOnboarding = useMutation({
    mutationFn: async (id: number) => {
      await fetch(apiUrl(`/orgs/${id}/onboarding`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ step: 4, complete: true }),
      });
    },
    onSuccess: () => setStep(4),
  });

  const toggleFramework = (key: string) => {
    setSelectedFrameworks(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 h-16 flex items-center px-8">
        <div className="flex items-center gap-2">
          <img src={`${BASE_PATH}/logo.svg`} className="h-7 w-7" />
          <span className="font-semibold text-slate-900">EnterpriseComply</span>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-2xl">
          {/* Progress */}
          <div className="flex items-center gap-2 mb-8">
            {[1, 2, 3, 4].map((s) => (
              <div key={s} className="flex items-center gap-2">
                <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${s < step ? "bg-blue-600 text-white" : s === step ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-400"}`}>
                  {s < step ? (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                  ) : s}
                </div>
                {s < 4 && <div className={`h-0.5 w-12 transition-colors ${s < step ? "bg-blue-600" : "bg-slate-200"}`} />}
              </div>
            ))}
            <div className="ml-4 text-sm text-slate-500">
              {step === 1 && "Company info"}
              {step === 2 && "Choose frameworks"}
              {step === 3 && "Connect integrations"}
              {step === 4 && "Your baseline score"}
            </div>
          </div>

          {/* Step 1: Company Info */}
          {step === 1 && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8">
              <h1 className="text-2xl font-bold text-slate-900 mb-1">Tell us about your company</h1>
              <p className="text-slate-500 mb-6">This helps us customize your compliance program.</p>
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Company name *</label>
                  <input
                    type="text"
                    value={orgData.name}
                    onChange={e => setOrgData({ ...orgData, name: e.target.value })}
                    placeholder="Acme Corp"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Industry</label>
                    <select
                      value={orgData.industry}
                      onChange={e => setOrgData({ ...orgData, industry: e.target.value })}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      {INDUSTRIES.map(i => <option key={i}>{i}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Company size</label>
                    <select
                      value={orgData.size}
                      onChange={e => setOrgData({ ...orgData, size: e.target.value })}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      {SIZES.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Website (optional)</label>
                  <input
                    type="url"
                    value={orgData.website}
                    onChange={e => setOrgData({ ...orgData, website: e.target.value })}
                    placeholder="https://acme.com"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              <button
                onClick={() => createOrg.mutate()}
                disabled={!orgData.name.trim() || createOrg.isPending}
                className="mt-6 w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-lg transition-colors text-sm"
              >
                {createOrg.isPending ? "Creating..." : "Continue"}
              </button>
            </div>
          )}

          {/* Step 2: Frameworks */}
          {step === 2 && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8">
              <h1 className="text-2xl font-bold text-slate-900 mb-1">Choose your frameworks</h1>
              <p className="text-slate-500 mb-6">Select the compliance frameworks you need. Each control you pass satisfies requirements across all selected frameworks simultaneously.</p>
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {["commercial", "federal", "best-practice"].map(cat => (
                  <div key={cat} className="mb-3">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                      {cat === "commercial" ? "Commercial" : cat === "federal" ? "Federal (US Government)" : "Best Practice"}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {FRAMEWORKS.filter(f => f.category === cat).map(fw => {
                        const selected = selectedFrameworks.includes(fw.key);
                        return (
                          <button
                            key={fw.key}
                            onClick={() => toggleFramework(fw.key)}
                            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border text-sm text-left transition-colors ${
                              selected
                                ? "border-blue-600 bg-blue-50 text-blue-700"
                                : "border-slate-200 hover:border-slate-300 text-slate-700"
                            }`}
                          >
                            <div className={`h-4 w-4 rounded border flex-shrink-0 flex items-center justify-center ${selected ? "bg-blue-600 border-blue-600" : "border-slate-300"}`}>
                              {selected && <svg className="h-2.5 w-2.5 text-white" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
                            </div>
                            <span className="font-medium">{fw.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Federal framework quick-start guidance */}
              {selectedFrameworks.some(fw => ["fedramp", "cmmc", "nist-800-171", "dfars"].includes(fw)) && (
                <div className="mb-4 p-4 rounded-xl border border-blue-200 bg-blue-50">
                  <div className="flex items-start gap-3">
                    <span className="text-lg mt-0.5">🏛</span>
                    <div>
                      <p className="font-semibold text-blue-900 text-sm mb-1">Federal framework quick-start</p>
                      <p className="text-xs text-blue-700 mb-3">
                        {selectedFrameworks.includes("cmmc") && "CMMC Level 2 requires 110 NIST SP 800-171 practices. "}
                        {selectedFrameworks.includes("fedramp") && "FedRAMP Moderate requires continuous monitoring and a SSP. "}
                        {selectedFrameworks.includes("nist-800-171") && "NIST 800-171 maps directly to DFARS 252.204-7012 requirements. "}
                        The highest-priority controls to address first are Access Control (AC), Identification and Authentication (IA), and Incident Response (IR).
                      </p>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {[
                          { label: "First 30 days", text: "Complete gap assessment, assign control owners" },
                          { label: "Days 31-90", text: "Remediate critical gaps, connect evidence sources" },
                          { label: "Days 91-180", text: "Full implementation, prepare assessment package" },
                          { label: "Ongoing", text: "Continuous monitoring, annual review cycle" },
                        ].map((item) => (
                          <div key={item.label} className="bg-white rounded-lg p-2.5 border border-blue-100">
                            <p className="font-semibold text-blue-800 mb-0.5">{item.label}</p>
                            <p className="text-blue-600">{item.text}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

<div className="flex gap-3 mt-6">
                <button onClick={() => setStep(1)} className="flex-1 py-3 border border-slate-200 text-slate-600 font-semibold rounded-lg text-sm hover:bg-slate-50 transition-colors">
                  Back
                </button>
                <button
                  onClick={() => activateFrameworks.mutate(orgId!)}
                  disabled={selectedFrameworks.length === 0 || activateFrameworks.isPending}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-lg transition-colors text-sm"
                >
                  {activateFrameworks.isPending ? "Saving..." : `Continue with ${selectedFrameworks.length} framework${selectedFrameworks.length !== 1 ? "s" : ""}`}
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Integrations */}
          {step === 3 && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8">
              <h1 className="text-2xl font-bold text-slate-900 mb-1">Connect your first integration</h1>
              <p className="text-slate-500 mb-6">Connect GitHub to automatically collect evidence for code security controls.</p>
              <a
                href={apiUrl(`/integrations/github/connect?orgId=${orgId}`)}
                className="w-full flex items-center gap-4 p-4 border-2 border-slate-200 hover:border-blue-300 rounded-xl transition-colors group"
              >
                <div className="h-12 w-12 bg-slate-900 rounded-xl flex items-center justify-center flex-shrink-0">
                  <svg className="h-7 w-7 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-slate-900 group-hover:text-blue-700 transition-colors">Connect GitHub</p>
                  <p className="text-sm text-slate-500">MFA status, branch protection, code review policies</p>
                </div>
                <svg className="h-5 w-5 text-slate-400 group-hover:text-blue-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </a>
              <div className="flex gap-3 mt-6">
                <button onClick={() => setStep(2)} className="flex-1 py-3 border border-slate-200 text-slate-600 font-semibold rounded-lg text-sm hover:bg-slate-50 transition-colors">
                  Back
                </button>
                <button
                  onClick={() => completeOnboarding.mutate(orgId!)}
                  disabled={completeOnboarding.isPending}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-lg transition-colors text-sm"
                >
                  {completeOnboarding.isPending ? "One moment..." : "Skip for now"}
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Aha Moment - Initial compliance score */}
          {step === 4 && orgId && (
            <ScoreReveal orgId={orgId} selectedFrameworks={selectedFrameworks} onDone={() => navigate("/dashboard")} />
          )}
        </div>
      </div>
    </div>
  );
}

function ScoreReveal({ orgId, selectedFrameworks, onDone }: { orgId: number; selectedFrameworks: string[]; onDone: () => void }) {
  const { data, isLoading } = useQuery<{ frameworks: any[] }>({
    queryKey: ["onboarding-score", orgId],
    queryFn: async () => (await fetch(apiUrl(`/orgs/${orgId}/frameworks`), { credentials: "include" })).json(),
    refetchOnWindowFocus: false,
  });

  const frameworks = data?.frameworks ?? [];
  const totalControls = frameworks.reduce((sum, f) => sum + (f.totalControls ?? 0), 0);
  const passingControls = frameworks.reduce((sum, f) => sum + (f.passingControls ?? 0), 0);
  const overallScore = totalControls > 0 ? Math.round((passingControls / totalControls) * 100) : 0;

  const FRAMEWORK_BADGE_COLORS: Record<string, string> = {
    soc2: "bg-blue-100 text-blue-700",
    iso27001: "bg-purple-100 text-purple-700",
    "nist-csf": "bg-indigo-100 text-indigo-700",
    "nist-800-53": "bg-violet-100 text-violet-700",
    "nist-800-171": "bg-blue-100 text-blue-700",
    hipaa: "bg-teal-100 text-teal-700",
    pci: "bg-orange-100 text-orange-700",
    gdpr: "bg-rose-100 text-rose-700",
    fedramp: "bg-slate-100 text-slate-700",
    cmmc: "bg-green-100 text-green-700",
    ccpa: "bg-amber-100 text-amber-700",
    cis: "bg-cyan-100 text-cyan-700",
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-10 text-center">
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="h-8 w-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
          <p className="text-slate-700 font-semibold">Calculating your baseline compliance score...</p>
        </div>
        <p className="text-sm text-slate-400">Mapping {selectedFrameworks.length} framework{selectedFrameworks.length !== 1 ? "s" : ""} against your controls</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Hero */}
      <div className="bg-gradient-to-br from-blue-600 to-blue-700 p-8 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 rounded-full text-white text-xs font-semibold mb-4">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
          Compliance program created
        </div>
        <div className="flex justify-center mb-3">
          <div className="relative">
            <ScoreRing score={overallScore} size={100} />
          </div>
        </div>
        <p className="text-white text-2xl font-bold mb-1">Your baseline is ready</p>
        <p className="text-blue-100 text-sm">
          {passingControls} of {totalControls > 0 ? totalControls : "all"} controls passing across {frameworks.length} framework{frameworks.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Framework breakdown */}
      <div className="p-6">
        {frameworks.length > 0 ? (
          <>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Framework breakdown</p>
            <div className="space-y-2.5 mb-6">
              {frameworks.map((fw: any) => {
                const score = fw.complianceScore ?? 0;
                const passing = fw.passingControls ?? 0;
                const total = fw.totalControls ?? 0;
                return (
                  <div key={fw.frameworkKey} className="flex items-center gap-3">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded flex-shrink-0 w-28 text-center truncate ${FRAMEWORK_BADGE_COLORS[fw.frameworkKey] ?? "bg-slate-100 text-slate-600"}`}>
                      {fw.shortName ?? fw.frameworkKey.toUpperCase()}
                    </span>
                    <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${score >= 70 ? "bg-green-500" : score >= 40 ? "bg-amber-400" : "bg-red-400"}`}
                        style={{ width: `${score}%` }}
                      />
                    </div>
                    <span className="text-xs font-bold text-slate-600 w-10 text-right">{score}%</span>
                    <span className="text-xs text-slate-400 w-16 text-right">{passing}/{total} passing</span>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="mb-6">
            <p className="text-sm text-slate-500 text-center py-4">Your compliance score will update as you connect integrations and run checks.</p>
          </div>
        )}

        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-5">
          <p className="text-sm font-semibold text-blue-900 mb-1">What happens next?</p>
          <ul className="space-y-1">
            {[
              "Connect AWS, Okta, and other integrations to auto-collect evidence",
              "Review failing controls and assign owners for remediation",
              "Invite your auditor to the Auditor Portal for evidence review",
            ].map(item => (
              <li key={item} className="flex items-start gap-2 text-xs text-blue-800">
                <svg className="h-3.5 w-3.5 text-blue-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <button
          onClick={onDone}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm transition-colors"
        >
          Go to your dashboard
        </button>
      </div>
    </div>
  );
}

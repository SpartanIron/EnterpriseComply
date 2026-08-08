import { useState } from "react";
import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";

const BASE_PATH = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

function apiUrl(path: string) {
  return BASE_PATH + path;
}

// ─── API shape ────────────────────────────────────────────────────────────────

interface Framework {
  key: string;
  name: string;
  shortName: string;
  complianceScore: number;
  passingControls: number;
  totalControls: number;
}

interface Integration {
  key: string;
  name: string;
  lastSyncAt: string | null;
  status: string;
}

interface Policy {
  title: string;
  category: string;
  version: string;
  publishedAt: string | null;
}

interface SecurityHighlight {
  label: string;
  active: boolean;
}

interface OrgTrustProfile {
  org: { name: string; slug: string; industry: string | null; website: string | null };
  overallScore: number;
  controlSummary: { passing: number; failing: number; total: number };
  frameworks: Framework[];
  integrations: Integration[];
  publishedPolicies: Policy[];
  securityHighlights: SecurityHighlight[];
  lastUpdated: string;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const r = 36;
  const circ = 2 * Math.PI * r;
  const fill = circ * (score / 100);
  const color = score >= 80 ? "#22c55e" : score >= 60 ? "#f59e0b" : "#ef4444";
  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="96" height="96" viewBox="0 0 96 96">
        <circle cx="48" cy="48" r={r} fill="none" stroke="#e2e8f0" strokeWidth="8" />
        <circle
          cx="48" cy="48" r={r} fill="none"
          stroke={color} strokeWidth="8"
          strokeDasharray={`${fill} ${circ}`}
          strokeLinecap="round"
          transform="rotate(-90 48 48)"
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-2xl font-bold text-slate-900">{score}%</span>
        <span className="text-xs text-slate-400 -mt-0.5">score</span>
      </div>
    </div>
  );
}

function FrameworkBar({ fw }: { fw: Framework }) {
  const pct = fw.totalControls > 0
    ? Math.round((fw.passingControls / fw.totalControls) * 100)
    : fw.complianceScore ?? 0;
  const color = pct >= 80 ? "bg-green-500" : pct >= 60 ? "bg-amber-400" : "bg-red-400";
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="font-bold text-slate-900 text-sm">{fw.name}</p>
          <p className="text-xs text-slate-400 mt-0.5">{fw.shortName}</p>
        </div>
        <span className={`text-sm font-bold ${pct >= 80 ? "text-green-600" : pct >= 60 ? "text-amber-600" : "text-red-500"}`}>
          {pct}%
        </span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      {fw.totalControls > 0 && (
        <p className="text-xs text-slate-400 mt-2">
          {fw.passingControls} / {fw.totalControls} controls passing
        </p>
      )}
    </div>
  );
}

type Tab = "overview" | "frameworks" | "controls" | "policies";

// ─── Component ────────────────────────────────────────────────────────────────

export default function OrgTrustCenter() {
  const [, params] = useRoute("/trust/:slug");
  const slug = params?.slug ?? "";
  const [tab, setTab] = useState<Tab>("overview");
  const [copied, setCopied] = useState(false);

  const { data, isLoading, isError, error } = useQuery<OrgTrustProfile>({
    queryKey: ["org-trust", slug],
    queryFn: async () => {
      const r = await fetch(apiUrl(`/api/trust/${slug}`));
      if (r.status === 404) throw new Error("notfound");
      if (!r.ok) throw new Error("fetch_failed");
      return r.json();
    },
    enabled: !!slug,
    retry: false,
  });

  function copyLink() {
    navigator.clipboard?.writeText(window.location.href).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "frameworks", label: "Frameworks" },
    { id: "controls", label: "Controls" },
    { id: "policies", label: "Policies" },
  ];

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="h-10 w-10 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-500">Loading trust center…</p>
        </div>
      </div>
    );
  }

  // ── Error / not found ────────────────────────────────────────────────────────
  if (isError || !data) {
    const isNotFound = (error as Error)?.message === "notfound";
    return (
      <div className="min-h-screen bg-slate-50">
        <header className="bg-white border-b border-slate-200">
          <div className="max-w-6xl mx-auto px-6 py-3.5 flex items-center gap-2.5">
            <a href={BASE_PATH + "/"}>
              <img src={`${BASE_PATH}/logo.svg`} className="h-8 w-8" alt="" />
            </a>
            <div>
              <span className="font-bold text-slate-900 text-sm leading-tight block">EnterpriseComply</span>
              <span className="text-xs text-slate-400 leading-tight block">Trust Center</span>
            </div>
          </div>
        </header>
        <div className="max-w-6xl mx-auto px-6 py-24 text-center">
          <div className="h-16 w-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <svg className="h-8 w-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">
            {isNotFound ? "Trust center not found" : "Unable to load trust center"}
          </h1>
          <p className="text-slate-500 text-sm max-w-md mx-auto">
            {isNotFound
              ? "This organization's trust center hasn't been published yet, or the link may be incorrect."
              : "Something went wrong loading this trust center. Please try again in a moment."}
          </p>
          <a href={BASE_PATH + "/"} className="inline-block mt-6 px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors">
            Back to home
          </a>
        </div>
      </div>
    );
  }

  const { org, overallScore, controlSummary, frameworks, integrations, publishedPolicies, securityHighlights } = data;
  const scoreColor = overallScore >= 80 ? "text-green-600" : overallScore >= 60 ? "text-amber-600" : "text-red-500";

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-6 py-3.5 flex items-center justify-between">
          <a href={BASE_PATH + "/"} className="flex items-center gap-2.5">
            <img src={`${BASE_PATH}/logo.svg`} className="h-8 w-8" alt="" />
            <div>
              <span className="font-bold text-slate-900 text-sm leading-tight block">EnterpriseComply</span>
              <span className="text-xs text-slate-400 leading-tight block">Trust Center</span>
            </div>
          </a>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500 font-medium hidden sm:block">{org.name}</span>
            <button
              onClick={copyLink}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              {copied ? (
                <>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Copied
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                  Share
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 py-10">
          <div className="flex flex-col lg:flex-row lg:items-center gap-8">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-xs font-semibold text-green-700 uppercase tracking-wide">Published trust profile</span>
              </div>
              <h1 className="text-3xl font-bold text-slate-900 leading-tight mb-2">
                {org.name}
              </h1>
              {org.industry && (
                <p className="text-slate-500 text-sm mb-3">{org.industry}</p>
              )}
              <p className="text-slate-500 text-sm leading-relaxed max-w-xl">
                This page shows {org.name}'s live compliance posture — active frameworks, control status,
                published policies, and security integrations — updated in real time.
              </p>
              {securityHighlights.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 mt-4">
                  {securityHighlights.map((h) => (
                    <span key={h.label} className="px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded-full">
                      {h.label}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Score + quick stats */}
            <div className="flex flex-col sm:flex-row lg:flex-col items-center gap-6 flex-shrink-0">
              <div className="text-center">
                <ScoreRing score={overallScore} />
                <p className="text-xs text-slate-400 mt-1">Overall compliance</p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-center">
                  <p className="text-lg font-bold text-green-600">{controlSummary.passing}</p>
                  <p className="text-xs text-slate-400">Passing</p>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-center">
                  <p className="text-lg font-bold text-red-500">{controlSummary.failing}</p>
                  <p className="text-xs text-slate-400">Failing</p>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-center">
                  <p className="text-lg font-bold text-slate-700">{frameworks.length}</p>
                  <p className="text-xs text-slate-400">Frameworks</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Tabs ───────────────────────────────────────────────────────────── */}
      <div className="sticky top-[57px] z-10 bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex gap-0 overflow-x-auto">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-4 py-3.5 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors ${
                  tab === t.id
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Content ────────────────────────────────────────────────────────── */}
      <main className="max-w-6xl mx-auto px-6 py-8">

        {/* OVERVIEW */}
        {tab === "overview" && (
          <div className="space-y-6">

            {/* Security highlights */}
            {securityHighlights.length > 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100">
                  <p className="font-bold text-slate-800 text-sm">Active security controls</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Security controls that are actively enabled for {org.name}.
                  </p>
                </div>
                <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {securityHighlights.map((h) => (
                    <div key={h.label} className="flex items-center gap-3 bg-green-50 border border-green-100 rounded-xl px-4 py-3">
                      <div className="h-6 w-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <svg className="h-3.5 w-3.5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <span className="text-sm font-medium text-green-800">{h.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 text-center text-slate-400 text-sm">
                No security highlights published yet.
              </div>
            )}

            {/* Frameworks quick view */}
            {frameworks.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                  <p className="font-bold text-slate-800 text-sm">Active compliance frameworks</p>
                  <button onClick={() => setTab("frameworks")} className="text-xs text-blue-600 hover:text-blue-700 font-medium">
                    View all →
                  </button>
                </div>
                <div className="divide-y divide-slate-100">
                  {frameworks.map((fw) => {
                    const pct = fw.totalControls > 0
                      ? Math.round((fw.passingControls / fw.totalControls) * 100)
                      : fw.complianceScore ?? 0;
                    return (
                      <div key={fw.key} className="px-6 py-4 flex items-center gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-800">{fw.name}</p>
                          {fw.totalControls > 0 && (
                            <p className="text-xs text-slate-400 mt-0.5">{fw.passingControls}/{fw.totalControls} controls passing</p>
                          )}
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${pct >= 80 ? "bg-green-500" : pct >= 60 ? "bg-amber-400" : "bg-red-400"}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className={`text-sm font-bold w-10 text-right ${pct >= 80 ? "text-green-600" : pct >= 60 ? "text-amber-600" : "text-red-500"}`}>
                            {pct}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Integrations */}
            {integrations.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100">
                  <p className="font-bold text-slate-800 text-sm">Connected security integrations</p>
                  <p className="text-xs text-slate-500 mt-0.5">Systems actively feeding compliance evidence.</p>
                </div>
                <div className="p-5 flex flex-wrap gap-2">
                  {integrations.map((i) => (
                    <span key={i.key} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                      {i.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Published policies quick view */}
            {publishedPolicies.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                  <p className="font-bold text-slate-800 text-sm">Published policies</p>
                  <button onClick={() => setTab("policies")} className="text-xs text-blue-600 hover:text-blue-700 font-medium">
                    View all →
                  </button>
                </div>
                <div className="p-5 flex flex-wrap gap-2">
                  {publishedPolicies.slice(0, 6).map((p) => (
                    <span key={p.title} className="px-3 py-1.5 bg-blue-50 border border-blue-100 text-blue-700 text-xs font-medium rounded-lg">
                      {p.title}
                    </span>
                  ))}
                  {publishedPolicies.length > 6 && (
                    <button onClick={() => setTab("policies")} className="px-3 py-1.5 bg-slate-50 border border-slate-200 text-slate-500 text-xs font-medium rounded-lg hover:bg-slate-100">
                      +{publishedPolicies.length - 6} more
                    </button>
                  )}
                </div>
              </div>
            )}

            <p className="text-xs text-slate-400 text-center">
              Last updated {new Date(data.lastUpdated).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}.
              Powered by <a href={BASE_PATH + "/"} className="underline">EnterpriseComply</a>.
            </p>
          </div>
        )}

        {/* FRAMEWORKS */}
        {tab === "frameworks" && (
          <div className="space-y-4">
            {frameworks.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-400 text-sm">
                No active compliance frameworks published yet.
              </div>
            ) : (
              <>
                <p className="text-sm text-slate-500">
                  {org.name} is actively working toward compliance with {frameworks.length} framework{frameworks.length !== 1 ? "s" : ""}.
                  Scores are computed from control implementation status in real time.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {frameworks.map((fw) => <FrameworkBar key={fw.key} fw={fw} />)}
                </div>
              </>
            )}
          </div>
        )}

        {/* CONTROLS */}
        {tab === "controls" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white border border-slate-200 rounded-xl p-6 text-center">
                <p className="text-4xl font-bold text-green-600 mb-1">{controlSummary.passing}</p>
                <p className="text-sm font-semibold text-slate-700">Passing</p>
                <p className="text-xs text-slate-400 mt-0.5">Controls fully implemented</p>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-6 text-center">
                <p className="text-4xl font-bold text-red-500 mb-1">{controlSummary.failing}</p>
                <p className="text-sm font-semibold text-slate-700">Failing</p>
                <p className="text-xs text-slate-400 mt-0.5">Controls with gaps identified</p>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-6 text-center">
                <p className="text-4xl font-bold text-slate-700 mb-1">{controlSummary.total}</p>
                <p className="text-sm font-semibold text-slate-700">Total</p>
                <p className="text-xs text-slate-400 mt-0.5">Controls across all frameworks</p>
              </div>
            </div>

            {controlSummary.total > 0 && (
              <div className="bg-white border border-slate-200 rounded-xl p-6">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-bold text-slate-800">Overall pass rate</p>
                  <span className={`text-sm font-bold ${scoreColor}`}>{overallScore}%</span>
                </div>
                <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${overallScore >= 80 ? "bg-green-500" : overallScore >= 60 ? "bg-amber-400" : "bg-red-400"}`}
                    style={{ width: `${overallScore}%` }}
                  />
                </div>
                <div className="flex justify-between mt-2">
                  <span className="text-xs text-slate-400">{controlSummary.passing} passing</span>
                  <span className="text-xs text-slate-400">{controlSummary.failing} failing</span>
                </div>
              </div>
            )}

            {controlSummary.total === 0 && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-12 text-center text-slate-400 text-sm">
                No control results published yet.
              </div>
            )}
          </div>
        )}

        {/* POLICIES */}
        {tab === "policies" && (
          <div className="space-y-4">
            {publishedPolicies.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-400 text-sm">
                No published policies yet.
              </div>
            ) : (
              <>
                <p className="text-sm text-slate-500">
                  {publishedPolicies.length} published polic{publishedPolicies.length !== 1 ? "ies" : "y"} governing {org.name}'s information security program.
                </p>
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                  <div className="px-5 py-3 border-b border-slate-100 grid grid-cols-12 gap-4 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    <div className="col-span-5">Policy</div>
                    <div className="col-span-3">Category</div>
                    <div className="col-span-2">Version</div>
                    <div className="col-span-2 text-right">Published</div>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {publishedPolicies.map((p) => (
                      <div key={p.title} className="px-5 py-4 grid grid-cols-12 gap-4 hover:bg-slate-50 transition-colors">
                        <div className="col-span-5">
                          <p className="text-sm font-semibold text-slate-800">{p.title}</p>
                        </div>
                        <div className="col-span-3">
                          <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-medium">{p.category}</span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-xs text-slate-500">v{p.version}</span>
                        </div>
                        <div className="col-span-2 text-right">
                          <span className="text-xs text-slate-400">
                            {p.publishedAt
                              ? new Date(p.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                              : "—"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </main>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="border-t border-slate-200 bg-white mt-12">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <img src={`${BASE_PATH}/logo.svg`} className="h-6 w-6" alt="" />
            <span className="text-sm font-semibold text-slate-700">Powered by EnterpriseComply</span>
          </div>
          <div className="flex items-center gap-5 text-xs text-slate-400">
            {org.website && (
              <a href={org.website} target="_blank" rel="noopener noreferrer" className="hover:text-slate-600">{org.name}</a>
            )}
            <a href={BASE_PATH + "/"} className="hover:text-slate-600">EnterpriseComply</a>
            <span>Updated {new Date(data.lastUpdated).toLocaleDateString("en-US", { month: "long", year: "numeric" })}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

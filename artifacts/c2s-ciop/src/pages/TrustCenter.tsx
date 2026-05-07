import { useQuery } from "@tanstack/react-query";
import { apiFetch, apiUrl } from "@/lib/queryClient";
import { useOrg } from "@/hooks/useOrg";

const BASE_PATH = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

function ScoreRing({ score, size = 80 }: { score: number; size?: number }) {
  const r = size * 0.38;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = score >= 80 ? "#16a34a" : score >= 60 ? "#ca8a04" : "#dc2626";
  return (
    <svg width={size} height={size}>
      <circle cx={size / 2} cy={size / 2} r={r} stroke="#e2e8f0" strokeWidth={size * 0.1} fill="none" />
      <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={size * 0.1} fill="none"
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="50%" textAnchor="middle" dy="0.35em" fontSize={size * 0.22} fontWeight="700" fill={color}>{score}%</text>
    </svg>
  );
}

export default function TrustCenter() {
  const { orgId, org } = useOrg();

  const { data: settings } = useQuery<{ trustCenterUrl: string; slug: string }>({
    queryKey: ["trust-center-settings", orgId],
    queryFn: () => apiFetch(`/orgs/${orgId}/trust-center`),
    enabled: !!orgId,
  });

  const { data: preview } = useQuery<any>({
    queryKey: ["trust-center-preview", settings?.slug],
    queryFn: async () => {
      const res = await fetch(apiUrl(`/trust/${settings!.slug}`), { credentials: "include" });
      return res.json();
    },
    enabled: !!settings?.slug,
  });

  const trustUrl = settings ? `${window.location.origin}${settings.trustCenterUrl}` : null;

  return (
    <div className="p-6 max-w-screen-xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Trust Center</h1>
          <p className="text-sm text-slate-500 mt-0.5">Your public-facing security and compliance page</p>
        </div>
        {trustUrl && (
          <a href={trustUrl} target="_blank" rel="noopener noreferrer"
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 flex items-center gap-2">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
            View Public Page
          </a>
        )}
      </div>

      {trustUrl && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-blue-800">Your Trust Center URL</p>
            <p className="text-blue-600 font-mono text-sm mt-0.5">{trustUrl}</p>
          </div>
          <button onClick={() => navigator.clipboard.writeText(trustUrl)}
            className="px-3 py-1.5 text-sm border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-100">
            Copy URL
          </button>
        </div>
      )}

      {!preview && !settings && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
            <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center mx-auto mb-3">
              <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <p className="text-slate-700 font-semibold">Setting up your Trust Center</p>
            <p className="text-sm text-slate-400 mt-1">Your public trust page is created automatically. Add frameworks and published policies to populate it.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { step: "1", title: "Activate frameworks", body: "Go to Frameworks and activate SOC 2, ISO 27001, or any compliance standard to show your certifications.", link: "/frameworks" },
              { step: "2", title: "Publish policies", body: "Go to Policies, create policies from templates, and publish them to surface them on your trust page.", link: "/policies" },
              { step: "3", title: "Share the URL", body: "Share your Trust Center URL with customers, prospects, and auditors - it updates automatically.", link: null },
            ].map(({ step, title, body, link }) => (
              <div key={step} className="bg-white border border-slate-200 rounded-xl p-4">
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
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="bg-gradient-to-r from-slate-900 to-blue-900 px-6 py-8 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold">{preview.org?.name}</h2>
                  <p className="text-slate-300 text-sm mt-1 capitalize">{preview.org?.industry} company</p>
                  {preview.org?.website && <a href={preview.org.website} className="text-blue-300 text-xs hover:underline mt-0.5 block">{preview.org.website}</a>}
                </div>
                <ScoreRing score={preview.overallScore} size={90} />
              </div>
            </div>
            <div className="p-6">
              <h3 className="font-semibold text-slate-800 mb-3">Active Frameworks</h3>
              <div className="grid grid-cols-2 gap-3 mb-5">
                {(preview.frameworks ?? []).map((f: any) => (
                  <div key={f.key} className="border border-slate-200 rounded-lg p-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{f.shortName}</p>
                      <p className="text-xs text-slate-400">{f.passingControls}/{f.totalControls} controls</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-lg font-bold ${f.complianceScore >= 80 ? "text-green-600" : f.complianceScore >= 60 ? "text-yellow-600" : "text-red-600"}`}>{Math.round(f.complianceScore)}%</p>
                    </div>
                  </div>
                ))}
              </div>

              {preview.securityHighlights?.length > 0 && (
                <>
                  <h3 className="font-semibold text-slate-800 mb-3">Security Highlights</h3>
                  <div className="grid grid-cols-2 gap-2 mb-5">
                    {preview.securityHighlights.map((h: any) => (
                      <div key={h.label} className="flex items-center gap-2 text-sm text-slate-700">
                        <div className="w-4 h-4 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                          <svg className="h-2.5 w-2.5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                        </div>
                        {h.label}
                      </div>
                    ))}
                  </div>
                </>
              )}

              {preview.publishedPolicies?.length > 0 && (
                <>
                  <h3 className="font-semibold text-slate-800 mb-3">Published Policies</h3>
                  <div className="space-y-1.5">
                    {preview.publishedPolicies.map((p: any) => (
                      <div key={p.title} className="flex items-center justify-between text-sm p-2 border border-slate-100 rounded-lg">
                        <span className="text-slate-700">{p.title}</span>
                        <span className="text-xs text-slate-400">v{p.version}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-500">
            <p className="font-semibold text-slate-700 mb-1">How to use your Trust Center</p>
            <p>Share your Trust Center URL with prospects, customers, and auditors instead of filling out manual security questionnaires. The page updates automatically as your compliance posture changes. You can also link it in your privacy policy, security page, or vendor portal.</p>
          </div>
        </div>
      )}
    </div>
  );
}

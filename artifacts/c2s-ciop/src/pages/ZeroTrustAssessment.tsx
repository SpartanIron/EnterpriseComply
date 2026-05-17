import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/queryClient";
import { useOrg } from "@/hooks/useOrg";

// ─── Pillar metadata (mirrors ZTMM_PILLARS in backend) ────────────────────────
const PILLAR_META = {
  identity: { label: "Identity", icon: "userIcon", color: "#2563eb", bg: "#eff6ff", functions: ["identity_governance","user_authentication","mfa_phishing_resistant","least_privilege","privileged_access","visibility_analytics"] },
  devices: { label: "Devices", icon: "devicesIcon", color: "#7c3aed", bg: "#f5f3ff", functions: ["device_inventory","device_compliance","endpoint_detection","patch_management","device_authorization","visibility_analytics"] },
  networks: { label: "Networks", icon: "networkIcon", color: "#0891b2", bg: "#ecfeff", functions: ["network_segmentation","encrypted_traffic","dns_http_filtering","ztna","network_visibility"] },
  applications: { label: "Applications & Workloads", icon: "appsIcon", color: "#059669", bg: "#ecfdf5", functions: ["application_inventory","sast_dast","api_security","workload_isolation","secure_sdlc","app_visibility"] },
  data: { label: "Data", icon: "dataIcon", color: "#dc2626", bg: "#fef2f2", functions: ["data_inventory","data_encryption","secrets_management","data_access_control","data_visibility"] },
} as const;

const STAGE_COLORS = {
  traditional: { bg: "#fef2f2", border: "#fca5a5", text: "#991b1b", label: "Traditional" },
  initial: { bg: "#fffbeb", border: "#fcd34d", text: "#92400e", label: "Initial" },
  advanced: { bg: "#eff6ff", border: "#93c5fd", text: "#1e40af", label: "Advanced" },
  optimal: { bg: "#f0fdf4", border: "#86efac", text: "#15803d", label: "Optimal" },
};

function stageColor(stage) {
  return STAGE_COLORS[stage] ?? STAGE_COLORS.traditional;
}

function scoreColor(score) {
  if (score >= 75) return "#16a34a";
  if (score >= 50) return "#2563eb";
  if (score >= 25) return "#d97706";
  return "#dc2626";
}

function MaturityBar({ score, stage }: { score: number; stage: string }) {
  const stages = ["traditional", "initial", "advanced", "optimal"];
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden relative">
        {/* Stage markers */}
        {[25, 50, 75].map(m => (
          <div key={m} className="absolute top-0 bottom-0 w-px bg-slate-300" style={{ left: m + "%" }} />
        ))}
        <div className="h-full rounded-full transition-all" style={{ width: score + "%", background: scoreColor(score) }} />
      </div>
      <span className="text-xs font-bold w-8 text-right" style={{ color: scoreColor(score) }}>{Math.round(score)}%</span>
    </div>
  );
}

function StageBadge({ stage }: { stage: string }) {
  const c = stageColor(stage);
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ color: c.text, background: c.bg, border: "1px solid " + c.border }}>
      {c.label}
    </span>
  );
}

function PillarCard({ pillar, data, functionScores, violations, onClick, isSelected }) {
  const meta = PILLAR_META[pillar] ?? { label: pillar, color: "#64748b", bg: "#f8fafc" };
  const score = data?.cappedScore ?? data?.rawScore ?? 0;
  const stage = data?.maturityStage ?? "traditional";
  const hasViolation = violations?.length > 0;
  return (
    <button
      onClick={onClick}
      className="bg-white rounded-xl border-2 p-5 text-left w-full hover:shadow-md transition-all"
      style={{ borderColor: isSelected ? meta.color : hasViolation ? "#fca5a5" : "#e2e8f0" }}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-sm font-bold text-slate-900">{meta.label}</p>
          <StageBadge stage={stage} />
        </div>
        <div className="text-right">
          <p className="text-2xl font-extrabold" style={{ color: scoreColor(score) }}>{Math.round(score)}%</p>
          {hasViolation && <p className="text-xs text-red-500">⚠ Dep. cap active</p>}
        </div>
      </div>
      <MaturityBar score={score} stage={stage} />
      {functionScores && (
        <div className="mt-3 space-y-1">
          {Object.entries(functionScores).slice(0, 3).map(([fk, fs]) => (
            <div key={fk} className="flex items-center gap-2">
              <span className="text-xs text-slate-400 truncate flex-1">{fk.replace(/_/g, " ")}</span>
              <div className="w-16 h-1 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: (fs as number) + "%", background: scoreColor(fs as number) }} />
              </div>
              <span className="text-xs text-slate-500 w-6 text-right">{Math.round(fs as number)}</span>
            </div>
          ))}
        </div>
      )}
    </button>
  );
}

export default function ZeroTrustAssessment() {
  const { orgId } = useOrg();
  const qc = useQueryClient();
  const [selectedPillar, setSelectedPillar] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview"|"crosswalk"|"gaps"|"trend">("overview");

  const { data, isLoading } = useQuery({
    queryKey: ["zta", orgId],
    queryFn: () => apiFetch(`/orgs/${orgId}/zero-trust`),
    enabled: !!orgId,
  });

  const { data: trendData } = useQuery({
    queryKey: ["zta-trend", orgId],
    queryFn: () => apiFetch(`/orgs/${orgId}/zero-trust/trend?days=90`),
    enabled: !!orgId && activeTab === "trend",
  });

  const { data: crosswalkData } = useQuery({
    queryKey: ["zta-crosswalk", orgId],
    queryFn: () => apiFetch(`/orgs/${orgId}/zero-trust/crosswalk`),
    enabled: !!orgId && activeTab === "crosswalk",
  });

  const scoreMutation = useMutation({
    mutationFn: () => apiFetch(`/orgs/${orgId}/zero-trust/score`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["zta", orgId] });
      qc.invalidateQueries({ queryKey: ["zta-trend", orgId] });
    },
  });

  const assessment = data?.assessment;
  const pillarScores = data?.pillarScores ?? [];
  const gapFindings = data?.gapFindings ?? [];
  const violations = assessment?.dependencyViolations ?? [];
  const overallScore = assessment?.overallScore ?? 0;
  const overallStage = assessment?.overallMaturityLevel ?? "traditional";
  const ragStatus = assessment?.ragStatus ?? "red";
  const pillarScoresObj = assessment?.pillarScores ?? {};

  const ragConfig = {
    green: { label: "Strong ZT Posture", color: "#16a34a", bg: "#f0fdf4" },
    amber: { label: "Moderate ZT Posture", color: "#d97706", bg: "#fffbeb" },
    red: { label: "ZT Posture At Risk", color: "#dc2626", bg: "#fef2f2" },
  };
  const rag = ragConfig[ragStatus] ?? ragConfig.red;

  const selectedPillarData = selectedPillar
    ? pillarScores.find((p) => p.pillar === selectedPillar)
    : null;

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-slate-500 text-sm">Loading Zero Trust Assessment...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-screen-xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <span className="text-2xl">🛡️</span> Zero Trust Assessment
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">CISA ZTMM v2.0 — 5 Pillars · NIST SP 800-53 Rev 5 mapped · UCO control evidence</p>
        </div>
        <div className="flex items-center gap-3">
          {assessment?.scoredAt && (
            <span className="text-xs text-slate-400">Last scored: {new Date(assessment.scoredAt).toLocaleDateString()}</span>
          )}
          <button
            onClick={() => scoreMutation.mutate()}
            disabled={scoreMutation.isPending}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            {scoreMutation.isPending
              ? <><span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Scoring...</>
              : "⚡ Run ZTA Score"}
          </button>
        </div>
      </div>

      {/* Summary Banner */}
      {assessment && (
        <div className="rounded-xl p-5 border flex items-center gap-6" style={{ background: rag.bg, borderColor: rag.color + "40" }}>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-3xl font-extrabold" style={{ color: rag.color }}>{Math.round(overallScore)}%</span>
              <div>
                <p className="font-bold text-slate-900">{rag.label}</p>
                <StageBadge stage={overallStage} />
              </div>
            </div>
            <div className="w-full h-3 bg-white/60 rounded-full overflow-hidden relative">
              {[25, 50, 75].map(m => <div key={m} className="absolute top-0 bottom-0 w-px bg-white/50" style={{ left: m + "%" }} />)}
              <div className="h-full rounded-full transition-all" style={{ width: overallScore + "%", background: rag.color }} />
            </div>
            <div className="flex gap-4 mt-2 text-xs text-slate-500">
              <span>0% Traditional</span><span className="ml-6">25% Initial</span><span className="ml-6">50% Advanced</span><span className="ml-6">75% Optimal</span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center flex-shrink-0">
            <div className="bg-white/70 rounded-lg px-4 py-3">
              <p className="text-lg font-bold text-slate-900">{Object.keys(pillarScoresObj).length}</p>
              <p className="text-xs text-slate-500">Pillars</p>
            </div>
            <div className="bg-white/70 rounded-lg px-4 py-3">
              <p className="text-lg font-bold text-red-600">{gapFindings.length}</p>
              <p className="text-xs text-slate-500">Open Gaps</p>
            </div>
            <div className="bg-white/70 rounded-lg px-4 py-3">
              <p className="text-lg font-bold text-amber-600">{violations.length}</p>
              <p className="text-xs text-slate-500">Dep. Rules</p>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
        {(["overview","crosswalk","gaps","trend"] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className="px-4 py-2 text-sm font-medium rounded-md transition-all capitalize"
            style={{ background: activeTab === tab ? "white" : "transparent", color: activeTab === tab ? "#0f172a" : "#64748b", boxShadow: activeTab === tab ? "0 1px 3px rgba(0,0,0,0.1)" : "none" }}>
            {tab === "overview" ? "Pillar Scores" : tab === "crosswalk" ? "ZTMM Crosswalk" : tab === "gaps" ? "Gap Analysis" : "Score Trend"}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Pillar Cards */}
          <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Object.keys(PILLAR_META).map((pillar) => {
              const pd = pillarScores.find(p => p.pillar === pillar);
              const viol = violations.filter(v => v.targetPillar === pillar);
              return (
                <PillarCard
                  key={pillar}
                  pillar={pillar}
                  data={pd}
                  functionScores={pd?.functionScores}
                  violations={viol}
                  isSelected={selectedPillar === pillar}
                  onClick={() => setSelectedPillar(selectedPillar === pillar ? null : pillar)}
                />
              );
            })}
          </div>

          {/* Detail Panel */}
          <div className="space-y-4">
            {/* Dependency Violations */}
            {violations.length > 0 && (
              <div className="bg-white rounded-xl border border-red-200 p-4">
                <h3 className="text-sm font-bold text-red-800 mb-3 flex items-center gap-2">
                  <span>⚠️</span> Dependency Cap Violations ({violations.length})
                </h3>
                <div className="space-y-2">
                  {violations.map((v) => (
                    <div key={v.ruleId} className="bg-red-50 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-red-600">{v.ruleId}</span>
                        <span className="text-xs text-slate-500">{v.sourcePillar} → {v.targetPillar}</span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed line-clamp-3">{v.explanation}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Selected Pillar Detail */}
            {selectedPillarData && (
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <h3 className="text-sm font-bold text-slate-900 mb-3">
                  {PILLAR_META[selectedPillar as keyof typeof PILLAR_META]?.label} — Function Breakdown
                </h3>
                <div className="space-y-3">
                  {Object.entries(selectedPillarData.functionScores ?? {}).map(([fk, fs]) => (
                    <div key={fk}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-slate-600 capitalize">{fk.replace(/_/g, " ")}</span>
                        <StageBadge stage={fs >= 75 ? "optimal" : fs >= 50 ? "advanced" : fs >= 25 ? "initial" : "traditional"} />
                      </div>
                      <MaturityBar score={fs as number} stage="" />
                    </div>
                  ))}
                </div>
                {selectedPillarData.violations?.length > 0 && (
                  <div className="mt-3 p-2 bg-amber-50 rounded-lg">
                    <p className="text-xs text-amber-800 font-medium">Dependency rules capping this pillar: {selectedPillarData.violations.join(", ")}</p>
                    <p className="text-xs text-amber-600 mt-1">Raw score: {Math.round(selectedPillarData.rawScore)}% → Capped at: {Math.round(selectedPillarData.cappedScore)}%</p>
                  </div>
                )}
              </div>
            )}

            {/* No assessment yet */}
            {!assessment && (
              <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
                <div className="text-4xl mb-3">🛡️</div>
                <p className="font-semibold text-slate-700 mb-2">No ZTA Score Yet</p>
                <p className="text-sm text-slate-400 mb-4">Run a ZTA Score to see your CISA ZTMM v2.0 maturity levels across all 5 pillars.</p>
                <button onClick={() => scoreMutation.mutate()} disabled={scoreMutation.isPending} className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700">
                  Run First Score
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Gap Analysis Tab */}
      {activeTab === "gaps" && (
        <div className="space-y-3">
          {gapFindings.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
              <p className="text-3xl mb-3">✅</p>
              <p className="font-semibold text-slate-700">No open gap findings</p>
              <p className="text-sm text-slate-400 mt-1">Run a ZTA Score first to generate gap findings.</p>
            </div>
          ) : gapFindings.map((gap) => {
            const sevColors = { critical: "#dc2626", high: "#ea580c", medium: "#d97706", low: "#16a34a" };
            const sevColor = sevColors[gap.severity] ?? "#64748b";
            const pillarMeta = PILLAR_META[gap.pillar] ?? { label: gap.pillar, color: "#64748b" };
            return (
              <div key={gap.id} className="bg-white rounded-xl border border-slate-200 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ color: pillarMeta.color, background: pillarMeta.bg ?? "#f8fafc" }}>{pillarMeta.label}</span>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100" style={{ color: sevColor }}>{gap.severity.toUpperCase()}</span>
                      {gap.causesDependencyViolation && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">Dep. Violation</span>}
                      <StageBadge stage={gap.currentStage} />
                      <span className="text-xs text-slate-400">→</span>
                      <StageBadge stage={gap.targetStage} />
                    </div>
                    <p className="font-semibold text-slate-900 text-sm">{gap.gapTitle}</p>
                    {gap.gapDescription && <p className="text-xs text-slate-500 mt-1 leading-relaxed">{gap.gapDescription}</p>}
                  </div>
                </div>
                {(gap.failingNistControls?.length > 0 || gap.failingUcoControls?.length > 0) && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {gap.failingNistControls?.slice(0, 6).map((ctrl) => (
                      <span key={ctrl} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">{ctrl}</span>
                    ))}
                    {gap.failingUcoControls?.map((ctrl) => (
                      <span key={ctrl} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-mono">{ctrl}</span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ZTMM Crosswalk Tab */}
      {activeTab === "crosswalk" && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {!crosswalkData ? (
            <div className="p-8 text-center text-slate-400">Loading crosswalk...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-900 text-white">
                    <th className="px-4 py-3 text-left text-xs font-semibold">Pillar</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold">Function</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold">NIST 800-53 Rev 5</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold">UCO Controls</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold">Evidence Artifact</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {crosswalkData.crosswalk?.map((row, i) => {
                    const meta = PILLAR_META[row.pillar] ?? { color: "#64748b", bg: "#f8fafc" };
                    return (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ color: meta.color, background: meta.bg ?? "#f8fafc" }}>{row.pillarLabel}</span>
                        </td>
                        <td className="px-4 py-3 text-xs font-medium text-slate-700">{row.functionLabel}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {row.nistControls?.slice(0, 4).map((c) => <span key={c} className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono">{c}</span>)}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {row.ucoControls?.map((c) => <span key={c} className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-mono">{c}</span>)}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500 max-w-xs">{row.evidenceArtifact}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Score Trend Tab */}
      {activeTab === "trend" && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-sm font-bold text-slate-900 mb-4">Score History — Last 90 Days</h3>
          {!trendData?.history?.length ? (
            <div className="text-center py-10 text-slate-400">
              <p className="text-3xl mb-2">📈</p>
              <p>No history yet. Run multiple ZTA scores over time to see trends.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {trendData.history.map((snap, i) => {
                const prev = trendData.history[i + 1];
                const delta = prev ? snap.overallScore - prev.overallScore : 0;
                return (
                  <div key={snap.id} className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg">
                    <div className="w-24 text-xs text-slate-500">{new Date(snap.snapshotDate).toLocaleDateString()}</div>
                    <div className="flex-1">
                      <MaturityBar score={snap.overallScore} stage={snap.maturityLevel} />
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <StageBadge stage={snap.maturityLevel} />
                      {delta !== 0 && (
                        <span className="text-xs font-bold" style={{ color: delta > 0 ? "#16a34a" : "#dc2626" }}>
                          {delta > 0 ? "+" : ""}{Math.round(delta)}%
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch, apiUrl } from "@/lib/queryClient";
import { useOrg } from "@/hooks/useOrg";
import { useLocation, useParams } from "wouter";
import { useEffect } from "react";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DOMAIN_META: Record<string, { label: string; icon: string; description: string }> = {
  identity:     { label: "Identity",     icon: "👤", description: "Authentication, MFA, IAM, PAM, SSO, access reviews" },
  devices:      { label: "Devices",      icon: "💻", description: "MDM, endpoint encryption, EDR, patch management" },
  network:      { label: "Network",      icon: "🌐", description: "Segmentation, WAF, TLS, DNS filtering, ZTNA" },
  applications: { label: "Applications", icon: "⚙️", description: "SAST, DAST, SDLC, dependency scanning, API security" },
  data:         { label: "Data",         icon: "🗄️", description: "Classification, encryption, DLP, retention, backups" },
  governance:   { label: "Governance",   icon: "📋", description: "Policies, training, IRP, BCP, risk assessments, vendor risk" },
  compliance:   { label: "Compliance",   icon: "✅", description: "Framework certifications, GRC, audits, POA&M, logging" },
  operations:   { label: "Operations",   icon: "🔍", description: "SIEM, RTO/RPO, tabletop exercises, vulnerability management" },
  // NIST / CMMC / SOC2 fallbacks
  "nist-171":   { label: "NIST 800-171", icon: "🏛️", description: "14 control families across DoD CUI handling requirements" },
  "cmmc-l2":    { label: "CMMC L2",      icon: "🛡️", description: "CMMC Level 2 practices for CUI handling" },
  "soc2":       { label: "SOC 2",        icon: "🔐", description: "Trust Services Criteria CC1–CC9 + Availability" },
};

function ragColor(rag: string | null) {
  if (rag === "green") return { bg: "#f0fdf4", border: "#86efac", text: "#15803d" };
  if (rag === "amber") return { bg: "#fffbeb", border: "#fcd34d", text: "#92400e" };
  return { bg: "#fef2f2", border: "#fca5a5", text: "#991b1b" };
}

function scoreColor(score: number) {
  if (score >= 70) return "#16a34a";
  if (score >= 45) return "#d97706";
  return "#dc2626";
}

function ragLabel(rag: string | null) {
  if (rag === "green") return "Strong Posture";
  if (rag === "amber") return "Moderate Posture";
  return "Posture At Risk";
}

const FRAMEWORK_META: Record<string, { label: string; subtitle: string }> = {
  "zero-trust":   { label: "Zero Trust Posture Assessment", subtitle: "8-Domain Zero Trust Architecture Evaluation" },
  "nist-800-171": { label: "NIST 800-171 Readiness Assessment", subtitle: "14 Control Families — CUI Handling Evaluation" },
  "cmmc-l2":      { label: "CMMC Level 2 Readiness Assessment", subtitle: "DoD Contract Eligibility Evaluation" },
  "soc2":         { label: "SOC 2 Type II Readiness Assessment", subtitle: "Trust Services Criteria Evaluation" },
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ZeroTrustAssessmentReport() {
  const { orgId } = useOrg();
  const params = useParams<{ id: string }>();
  const assessmentId = Number(params.id);
  const qc = useQueryClient();
  const [, navigate] = useLocation();

  const { data, isLoading } = useQuery<{ assessment: any; items: any[] }>({
    queryKey: ["assessment", orgId, assessmentId],
    queryFn: () => apiFetch(`/orgs/${orgId}/assessments/${assessmentId}`),
    enabled: !!orgId && !!assessmentId,
  });

  const updateItemMutation = useMutation({
    mutationFn: ({ id, answer }: { id: number; answer: string }) =>
      apiFetch(`/orgs/${orgId}/questionnaires/items/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ answer }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["assessment", orgId, assessmentId] }),
  });

  const scoreMutation = useMutation({
    mutationFn: () => apiFetch(`/orgs/${orgId}/assessments/${assessmentId}/score`, { method: "POST" }),
    onSuccess: (d) => {
      qc.setQueryData(["assessment", orgId, assessmentId], (old: any) => ({
        ...old,
        assessment: { ...old?.assessment, ...d.assessment },
      }));
    },
  });

  const assessment = data?.assessment;
  const items = data?.items ?? [];
  const fwMeta = FRAMEWORK_META[assessment?.frameworkTarget] ?? { label: "Compliance Assessment", subtitle: "" };
  const rag = assessment?.ragStatus;
  const ragColors = ragColor(rag);
  const overall = assessment?.overallScore ? Math.round(assessment.overallScore) : null;
  const domainScores: Record<string, number> = assessment?.domainScores ?? {};
  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const reportId = `EC-ZTA-${new Date().getFullYear()}-${String(assessmentId).padStart(4, "0")}`;

  // Group items by domain/category
  const itemsByDomain: Record<string, any[]> = {};
  for (const item of items) {
    const d = item.category || "general";
    if (!itemsByDomain[d]) itemsByDomain[d] = [];
    itemsByDomain[d].push(item);
  }

  // Set document title for PDF filename
  useEffect(() => {
    if (assessment) {
      document.title = `${assessment.clientName ?? "Assessment"} — ${fwMeta.label} — ${today}`;
    }
  }, [assessment, today, fwMeta.label]);

  function savePDF() {
    const btns = document.querySelector('.no-print-bar') as HTMLElement;
    if (btns) btns.style.display = 'none';
    window.print();
    setTimeout(() => { if (btns) btns.style.display = ''; }, 1000);
  }

  if (isLoading || !assessment) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-slate-500 text-sm">Loading assessment report...</p>
        </div>
      </div>
    );
  }

  const unansweredCount = items.filter(i => !i.answer).length;
  const answeredCount = items.filter(i => i.answer).length;
  const autoAnsweredCount = items.filter(i => i.answer && i.matchedControlId).length;

  return (
    <>
      <style>{`
        @media print {
          .no-print-bar { display: none !important; }
          body { margin: 0; background: white; }
          .report-container { padding: 0 !important; max-width: none !important; }
          .page-break { page-break-before: always; }
          .avoid-break { page-break-inside: avoid; }
          @page { size: A4; margin: 12mm 12mm 12mm 12mm; }
          * { print-color-adjust: exact !important; -webkit-print-color-adjust: exact !important; }
        }
        .domain-bar-fill { transition: width 0.6s ease; }
      `}</style>

      {/* Action Bar */}
      <div className="no-print-bar fixed top-0 left-0 right-0 z-50 bg-white border-b border-slate-200 h-14 flex items-center justify-between px-6 shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/assessments")} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            All Assessments
          </button>
          <span className="text-slate-200">|</span>
          <span className="text-sm font-semibold text-slate-800 truncate max-w-xs">{assessment.clientName}</span>
          {rag && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold" style={{ color: ragColors.text, background: ragColors.bg, border: `1px solid ${ragColors.border}` }}>
              {ragLabel(rag)} {overall !== null ? `— ${overall}%` : ""}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!assessment.overallScore && (
            <button
              onClick={() => scoreMutation.mutate()}
              disabled={scoreMutation.isPending || unansweredCount > 0}
              className="px-4 py-1.5 text-sm font-medium bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 disabled:opacity-50 flex items-center gap-1.5"
              title={unansweredCount > 0 ? "Answer all questions before scoring" : "Calculate domain scores"}
            >
              {scoreMutation.isPending ? <><span className="h-3.5 w-3.5 border-2 border-slate-400 border-t-slate-600 rounded-full animate-spin" />Scoring...</> : "📊 Score Assessment"}
            </button>
          )}
          <button onClick={() => savePDF()} className="px-4 py-1.5 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1.5">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            Save as PDF
          </button>
        </div>
      </div>

      {/* Report */}
      <div className="report-container mt-14 max-w-5xl mx-auto px-6 py-10 bg-slate-50 min-h-screen">

        {/* ── Cover ── */}
        <div className="avoid-break bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-200 mb-8">
          <div style={{ background: "linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 60%, #3b82f6 100%)", padding: "48px 48px 40px" }}>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/15 text-white/80 text-xs font-semibold mb-6 tracking-wide uppercase">
              CONTROLLED — AUTHORIZED PERSONNEL ONLY
            </div>
            <h1 className="text-3xl font-extrabold text-white mb-2 leading-tight">{fwMeta.label}</h1>
            <p className="text-blue-200 text-sm">{fwMeta.subtitle}</p>

            <div className="grid grid-cols-3 gap-6 mt-8 pt-8 border-t border-white/20">
              <div>
                <p className="text-blue-300 text-xs font-semibold uppercase tracking-wide mb-1">Client</p>
                <p className="text-white font-semibold">{assessment.clientName}</p>
                {assessment.clientCompany && <p className="text-blue-200 text-xs">{assessment.clientCompany}</p>}
              </div>
              <div>
                <p className="text-blue-300 text-xs font-semibold uppercase tracking-wide mb-1">Assessment Date</p>
                <p className="text-white font-semibold">{today}</p>
                <p className="text-blue-200 text-xs">{assessment.deliveryModel?.charAt(0).toUpperCase() + assessment.deliveryModel?.slice(1)} Assessment</p>
              </div>
              <div>
                <p className="text-blue-300 text-xs font-semibold uppercase tracking-wide mb-1">Report ID</p>
                <p className="text-white font-semibold font-mono text-sm">{reportId}</p>
                {overall !== null && (
                  <div className="inline-flex items-center gap-2 mt-1 px-3 py-1 rounded-full bg-white/15">
                    <span className="text-white font-bold text-sm">{overall}%</span>
                    <span className="text-white/80 text-xs">Overall Score</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Completion progress */}
          <div className="px-8 py-5 bg-slate-50 border-t border-slate-100 flex items-center gap-6">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-slate-600">Questions Answered</span>
                <span className="text-xs font-semibold text-slate-700">{answeredCount} / {items.length}</span>
              </div>
              <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                <div className="h-full bg-blue-600 rounded-full domain-bar-fill" style={{ width: items.length > 0 ? `${(answeredCount / items.length) * 100}%` : "0%" }} />
              </div>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-500 flex-shrink-0">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-blue-500" />{autoAnsweredCount} auto-filled</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-green-500" />{answeredCount - autoAnsweredCount} manual</span>
              {unansweredCount > 0 && <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-red-400" />{unansweredCount} unanswered</span>}
            </div>
          </div>
        </div>

        {/* ── Executive Summary ── */}
        {assessment.executiveSummary && (
          <div className="avoid-break bg-white rounded-xl border border-slate-200 shadow-sm mb-6 overflow-hidden">
            <div className="px-6 py-4 bg-slate-900 flex items-center gap-3">
              <span className="text-white font-bold text-sm uppercase tracking-wide">Executive Summary</span>
              {rag && (
                <span className="ml-auto inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold" style={{ color: ragColors.text, background: ragColors.bg }}>
                  {ragLabel(rag)}
                </span>
              )}
            </div>
            <div className="p-6">
              <p className="text-slate-700 leading-relaxed text-sm">{assessment.executiveSummary}</p>
            </div>
          </div>
        )}

        {/* ── Domain Score Summary ── */}
        {Object.keys(domainScores).length > 0 && (
          <div className="avoid-break bg-white rounded-xl border border-slate-200 shadow-sm mb-6 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-bold text-slate-900">Domain Maturity Scores</h2>
              {overall !== null && (
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-extrabold" style={{ color: scoreColor(overall) }}>{overall}%</span>
                  <span className="text-xs text-slate-400">Overall</span>
                </div>
              )}
            </div>
            <div className="p-6 grid grid-cols-2 gap-4">
              {Object.entries(domainScores).map(([domain, score]) => {
                const meta = DOMAIN_META[domain] ?? { label: domain, icon: "📌", description: "" };
                const sc = Math.round(score);
                return (
                  <div key={domain} className="avoid-break">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{meta.icon}</span>
                        <span className="text-sm font-semibold text-slate-800">{meta.label}</span>
                      </div>
                      <span className="text-sm font-bold" style={{ color: scoreColor(sc) }}>{sc}%</span>
                    </div>
                    <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full domain-bar-fill"
                        style={{ width: `${sc}%`, background: sc >= 70 ? "#16a34a" : sc >= 45 ? "#f59e0b" : "#ef4444" }}
                      />
                    </div>
                    {meta.description && <p className="text-xs text-slate-400 mt-1">{meta.description}</p>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Question & Answer Sections ── */}
        {Object.entries(itemsByDomain).map(([domain, domainItems]) => {
          const meta = DOMAIN_META[domain] ?? { label: domain.charAt(0).toUpperCase() + domain.slice(1), icon: "📌", description: "" };
          const domainScore = domainScores[domain];
          const answeredInDomain = domainItems.filter(i => i.answer).length;
          return (
            <div key={domain} className="avoid-break bg-white rounded-xl border border-slate-200 shadow-sm mb-5 overflow-hidden page-break">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{meta.icon}</span>
                  <div>
                    <h3 className="font-bold text-slate-900">{meta.label}</h3>
                    {meta.description && <p className="text-xs text-slate-400">{meta.description}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-xs text-slate-400">{answeredInDomain}/{domainItems.length} answered</span>
                  {domainScore !== undefined && (
                    <span className="text-sm font-bold" style={{ color: scoreColor(Math.round(domainScore)) }}>{Math.round(domainScore)}%</span>
                  )}
                </div>
              </div>
              <div className="divide-y divide-slate-50">
                {domainItems.map((item, idx) => (
                  <div key={item.id} className="px-6 py-4 avoid-break">
                    <div className="flex gap-3">
                      <span className="text-xs font-mono font-bold text-slate-300 pt-0.5 flex-shrink-0 w-8">Q{idx + 1}</span>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-slate-800 mb-2 leading-relaxed">{item.question}</p>
                        {item.matchedControlId && (
                          <div className="flex items-center gap-1.5 mb-2">
                            <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full border border-blue-100">
                              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                              {item.matchedControlId}
                            </span>
                            <span className="text-xs text-slate-300">auto-filled · verify accuracy</span>
                          </div>
                        )}
                        <textarea
                          defaultValue={item.answer ?? ""}
                          onBlur={(e) => {
                            if (e.target.value !== item.answer) {
                              updateItemMutation.mutate({ id: item.id, answer: e.target.value });
                            }
                          }}
                          rows={3}
                          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none bg-slate-50 no-print-bar"
                          placeholder="Enter your answer... (Yes/No + explanation recommended)"
                        />
                        {item.answer && (
                          <p className="mt-1.5 text-sm text-slate-700 bg-green-50 border border-green-100 rounded-lg px-3 py-2 hidden print:block leading-relaxed">{item.answer}</p>
                        )}
                        {!item.answer && (
                          <p className="mt-1.5 text-sm text-slate-400 italic hidden print:block">— No answer provided —</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {/* ── Recommendations ── */}
        {Object.keys(domainScores).length > 0 && (
          <div className="avoid-break bg-white rounded-xl border border-slate-200 shadow-sm mb-6 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="font-bold text-slate-900">Priority Recommendations</h2>
              <p className="text-xs text-slate-400 mt-0.5">Domains scoring below 50% require immediate attention</p>
            </div>
            <div className="p-6 space-y-3">
              {Object.entries(domainScores)
                .filter(([, score]) => score < 70)
                .sort(([, a], [, b]) => a - b)
                .map(([domain, score]) => {
                  const meta = DOMAIN_META[domain] ?? { label: domain, icon: "📌", description: "" };
                  const sc = Math.round(score);
                  const priority = sc < 30 ? "Critical" : sc < 50 ? "High" : "Medium";
                  const priorityColors = sc < 30
                    ? { text: "#dc2626", bg: "#fef2f2" }
                    : sc < 50
                    ? { text: "#c2410c", bg: "#fff7ed" }
                    : { text: "#92400e", bg: "#fffbeb" };
                  return (
                    <div key={domain} className="flex items-start gap-4 p-4 rounded-lg" style={{ background: priorityColors.bg }}>
                      <span className="text-xl flex-shrink-0">{meta.icon}</span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-sm text-slate-900">{meta.label}</span>
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ color: priorityColors.text, background: "white" }}>
                            {priority} — {sc}%
                          </span>
                        </div>
                        <p className="text-xs text-slate-600">
                          {domain === "identity" && "Implement MFA enforcement, review privileged access, and establish formal access review cadence."}
                          {domain === "devices" && "Deploy MDM solution, enforce device encryption, and implement EDR on all corporate endpoints."}
                          {domain === "network" && "Upgrade WAF to managed rules tier, implement micro-segmentation, and establish network monitoring."}
                          {domain === "applications" && "Integrate SAST into CI/CD pipeline, conduct annual penetration test, and implement dependency scanning."}
                          {domain === "data" && "Formalize data classification policy, implement DLP controls, and conduct data inventory audit."}
                          {domain === "governance" && "Document and publish information security policy, establish annual training program, complete IRP."}
                          {domain === "compliance" && "Select SOC 2 readiness CPA firm, implement GRC platform, and establish compliance program owner."}
                          {domain === "operations" && "Deploy centralized SIEM for log aggregation, conduct tabletop exercise, establish escalation runbooks."}
                          {!DOMAIN_META[domain] && `Address identified gaps in the ${meta.label} domain to improve overall security posture.`}
                        </p>
                      </div>
                    </div>
                  );
                })}
              {Object.values(domainScores).every(s => s >= 70) && (
                <div className="text-center py-8 text-green-700">
                  <p className="text-2xl mb-2">✅</p>
                  <p className="font-semibold">All domains meet the 70% threshold.</p>
                  <p className="text-sm text-slate-500 mt-1">Continue monitoring and maintaining controls. Consider pursuing formal certification.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Footer ── */}
        <div className="text-center py-8 text-xs text-slate-400 border-t border-slate-200 mt-4">
          <p className="font-semibold text-slate-600 mb-1">EnterpriseComply — Assessment Report</p>
          <p>Report ID: {reportId} · Generated: {today} · {assessment.clientName} · Confidential</p>
          <p className="mt-1">Prepared by ColorCode Solutions — Security Architecture | SDVOSB | Federal Compliant</p>
        </div>
      </div>
    </>
  );
}

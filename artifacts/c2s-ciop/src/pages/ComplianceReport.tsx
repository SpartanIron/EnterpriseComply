import { useQuery } from "@tanstack/react-query";
import { apiUrl } from "@/lib/queryClient";
import { useEffect } from "react";

const LIKELIHOOD_LABELS = ["", "Rare", "Unlikely", "Possible", "Likely", "Almost Certain"];
const IMPACT_LABELS = ["", "Negligible", "Minor", "Moderate", "Major", "Critical"];

function riskLevel(score: number) {
  if (score >= 15) return "Critical";
  if (score >= 9) return "High";
  if (score >= 4) return "Medium";
  return "Low";
}

function riskBadgeClass(score: number) {
  if (score >= 15) return "risk-critical";
  if (score >= 9) return "risk-high";
  if (score >= 4) return "risk-medium";
  return "risk-low";
}

export default function ComplianceReport() {
  const { data: orgData } = useQuery<{ org: any }>({
    queryKey: ["orgs", "me"],
    queryFn: async () => (await fetch(apiUrl("/orgs/me"), { credentials: "include" })).json(),
  });
  const orgId = orgData?.org?.id;

  const { data: dashData } = useQuery<any>({
    queryKey: ["dashboard", orgId],
    queryFn: async () => (await fetch(apiUrl(`/orgs/${orgId}/dashboard`), { credentials: "include" })).json(),
    enabled: !!orgId,
  });

  const { data: controlsData } = useQuery<{ controls: any[] }>({
    queryKey: ["org-controls", orgId],
    queryFn: async () => (await fetch(apiUrl(`/orgs/${orgId}/controls`), { credentials: "include" })).json(),
    enabled: !!orgId,
  });

  const { data: risksData } = useQuery<{ risks: any[]; summary: any }>({
    queryKey: ["risks", orgId],
    queryFn: async () => (await fetch(apiUrl(`/orgs/${orgId}/risks`), { credentials: "include" })).json(),
    enabled: !!orgId,
  });

  const { data: policiesData } = useQuery<{ policies: any[] }>({
    queryKey: ["org-policies", orgId],
    queryFn: async () => (await fetch(apiUrl(`/orgs/${orgId}/policies`), { credentials: "include" })).json(),
    enabled: !!orgId,
  });

  const org = dashData?.org ?? orgData?.org;
  const frameworks: any[] = dashData?.frameworks ?? [];
  const cs = dashData?.controlSummary ?? { passing: 0, failing: 0, notTested: 0, total: 0 };
  const overall = dashData?.overallScore ?? 0;
  const controls: any[] = controlsData?.controls ?? [];
  const risks: any[] = risksData?.risks ?? [];
  const policies: any[] = policiesData?.policies ?? [];

  const failingControls = controls.filter((c) => c.result?.status === "failing");
  const passingControls = controls.filter((c) => c.result?.status === "passing");
  const criticalRisks = risks.filter((r) => (r.inherentScore ?? 0) >= 15);
  const highRisks = risks.filter((r) => (r.inherentScore ?? 0) >= 9 && (r.inherentScore ?? 0) < 15);

  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const reportId = `EC-${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;

  const isLoading = !dashData;

  useEffect(() => {
    document.title = `${org?.name ?? "EnterpriseComply"} - Compliance Report ${today}`;
  }, [org, today]);

  if (isLoading) {
    return (
      <div className="report-page">
        <div style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>
          <p>Loading report data...</p>
        </div>
      </div>
    );
  }

  const scoreLabel = overall === 0 ? "Not Started" : overall >= 75 ? "On Track" : overall >= 50 ? "Needs Attention" : "At Risk";

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; }
          .report-page { padding: 0; }
          .page-break { page-break-before: always; }
          .avoid-break { page-break-inside: avoid; }
        }
        .report-page {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          color: #0f172a;
          background: white;
          max-width: 900px;
          margin: 0 auto;
          padding: 40px;
          line-height: 1.5;
        }
        .report-header {
          background: linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 60%, #2563eb 100%);
          color: white;
          padding: 40px;
          border-radius: 12px;
          margin-bottom: 32px;
        }
        .report-title { font-size: 28px; font-weight: 800; margin: 0 0 4px 0; }
        .report-subtitle { font-size: 14px; opacity: 0.8; margin: 0; }
        .report-meta { margin-top: 20px; font-size: 13px; opacity: 0.7; }
        .score-badge {
          display: inline-flex; align-items: center; gap: 8px;
          background: rgba(255,255,255,0.15); border-radius: 100px;
          padding: 8px 16px; font-size: 14px; font-weight: 700; margin-top: 12px;
        }
        .score-circle {
          width: 32px; height: 32px; border-radius: 50%; background: rgba(255,255,255,0.2);
          display: flex; align-items: center; justify-content: center;
          font-size: 13px; font-weight: 800;
        }
        .section-title { font-size: 18px; font-weight: 700; color: #1e293b; margin: 32px 0 16px 0; padding-bottom: 8px; border-bottom: 2px solid #e2e8f0; }
        .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
        .kpi-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; text-align: center; }
        .kpi-value { font-size: 28px; font-weight: 800; color: #1e293b; margin: 4px 0; }
        .kpi-label { font-size: 12px; color: #64748b; font-weight: 500; }
        .kpi-value.green { color: #16a34a; }
        .kpi-value.red { color: #dc2626; }
        .kpi-value.amber { color: #d97706; }
        .framework-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .framework-table th { background: #f8fafc; padding: 10px 12px; text-align: left; font-weight: 600; color: #475569; border-bottom: 2px solid #e2e8f0; }
        .framework-table td { padding: 10px 12px; border-bottom: 1px solid #f1f5f9; color: #334155; }
        .framework-table tr:last-child td { border-bottom: none; }
        .status-pill { display: inline-block; padding: 2px 10px; border-radius: 100px; font-size: 11px; font-weight: 600; }
        .status-on-track { background: #dcfce7; color: #15803d; }
        .status-attention { background: #fef9c3; color: #854d0e; }
        .status-risk { background: #fee2e2; color: #b91c1c; }
        .status-not-started { background: #f1f5f9; color: #64748b; }
        .progress-bar-bg { background: #e2e8f0; border-radius: 100px; height: 6px; }
        .progress-bar-fill { height: 6px; border-radius: 100px; }
        .control-row { display: flex; gap: 12px; align-items: flex-start; padding: 10px 0; border-bottom: 1px solid #f1f5f9; }
        .control-id { font-family: monospace; font-size: 11px; background: #f1f5f9; padding: 2px 6px; border-radius: 4px; color: #475569; flex-shrink: 0; }
        .control-name { font-size: 13px; color: #334155; font-weight: 500; flex: 1; }
        .control-domain { font-size: 11px; color: #94a3b8; }
        .status-dot-fail { width: 8px; height: 8px; border-radius: 50%; background: #ef4444; flex-shrink: 0; margin-top: 5px; }
        .status-dot-pass { width: 8px; height: 8px; border-radius: 50%; background: #22c55e; flex-shrink: 0; margin-top: 5px; }
        .risk-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .risk-table th { background: #f8fafc; padding: 10px 12px; text-align: left; font-weight: 600; color: #475569; border-bottom: 2px solid #e2e8f0; }
        .risk-table td { padding: 10px 12px; border-bottom: 1px solid #f1f5f9; color: #334155; }
        .risk-critical { background: #fee2e2; color: #b91c1c; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; }
        .risk-high { background: #ffedd5; color: #c2410c; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; }
        .risk-medium { background: #fef9c3; color: #854d0e; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; }
        .risk-low { background: #dcfce7; color: #15803d; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; }
        .policy-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .policy-item { display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: #f8fafc; border-radius: 6px; font-size: 13px; }
        .policy-active { border-left: 3px solid #22c55e; }
        .policy-draft { border-left: 3px solid #94a3b8; }
        .footer { margin-top: 48px; padding-top: 24px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 12px; color: #94a3b8; }
        .print-btn {
          position: fixed; top: 20px; right: 20px; z-index: 100;
          background: #2563eb; color: white; border: none; border-radius: 8px;
          padding: 10px 20px; font-size: 14px; font-weight: 600; cursor: pointer;
          display: flex; align-items: center; gap: 8px; box-shadow: 0 4px 12px rgba(37,99,235,0.3);
        }
        .print-btn:hover { background: #1d4ed8; }
        .info-box { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 12px 16px; margin-bottom: 16px; font-size: 13px; color: #1d4ed8; }
      `}</style>

      <button className="no-print print-btn" onClick={() => window.print()}>
        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
        </svg>
        Print / Save as PDF
      </button>

      <div className="report-page">
        {/* Header */}
        <div className="report-header">
          <p className="report-subtitle">EXECUTIVE COMPLIANCE REPORT</p>
          <h1 className="report-title">{org?.name ?? "EnterpriseComply"}</h1>
          <div className="report-meta">
            Report ID: {reportId} &bull; Generated: {today} &bull; Prepared by: EnterpriseComply Platform
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 16 }}>
            <div className="score-badge">
              <div className="score-circle">{overall}</div>
              Overall Score &bull; {scoreLabel}
            </div>
            <div style={{ fontSize: 13, opacity: 0.7 }}>
              {frameworks.length} framework{frameworks.length !== 1 ? "s" : ""} active &bull; {cs.passing}/{cs.total} controls passing
            </div>
          </div>
        </div>

        {/* Executive Summary */}
        <h2 className="section-title">Executive Summary</h2>
        <div className="info-box no-print" style={{ display: "none" }}></div>
        <p style={{ fontSize: 14, color: "#475569", marginBottom: 16 }}>
          This report summarizes the current compliance posture of {org?.name ?? "your organization"} as of {today}.
          The organization is actively managing compliance across {frameworks.length} regulatory framework{frameworks.length !== 1 ? "s" : ""}.
          {cs.total > 0 ? ` Out of ${cs.total} total UCO controls, ${cs.passing} are passing (${overall}%), ${cs.failing} are failing, and ${cs.notTested ?? 0} have not yet been tested.` : " No controls have been tested yet."}
          {criticalRisks.length > 0 ? ` There are currently ${criticalRisks.length} critical risk${criticalRisks.length !== 1 ? "s" : ""} requiring immediate attention.` : ""}
        </p>

        {/* KPI Strip */}
        <div className="kpi-grid">
          <div className="kpi-card">
            <div className="kpi-label">Overall Score</div>
            <div className={`kpi-value ${overall >= 75 ? "green" : overall >= 50 ? "amber" : overall > 0 ? "red" : ""}`}>{overall}%</div>
            <div className="kpi-label">{scoreLabel}</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Passing Controls</div>
            <div className="kpi-value green">{cs.passing}</div>
            <div className="kpi-label">of {cs.total} total</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Failing Controls</div>
            <div className={`kpi-value ${cs.failing > 0 ? "red" : ""}`}>{cs.failing}</div>
            <div className="kpi-label">require remediation</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Open Risks</div>
            <div className={`kpi-value ${(risksData?.summary?.open ?? 0) > 0 ? "amber" : ""}`}>{risksData?.summary?.open ?? 0}</div>
            <div className="kpi-label">of {risks.length} total</div>
          </div>
        </div>

        {/* Frameworks */}
        <h2 className="section-title">Framework Compliance Status</h2>
        {frameworks.length === 0 ? (
          <p style={{ color: "#94a3b8", fontSize: 13 }}>No frameworks have been added to this organization yet.</p>
        ) : (
          <table className="framework-table">
            <thead>
              <tr>
                <th>Framework</th>
                <th>Category</th>
                <th>Controls</th>
                <th>Score</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {frameworks.map((fw: any) => {
                const score = fw.score ?? 0;
                const statusLabel = score === 0 ? "Not Started" : score >= 75 ? "On Track" : score >= 50 ? "Needs Attention" : "At Risk";
                const statusClass = score === 0 ? "status-not-started" : score >= 75 ? "status-on-track" : score >= 50 ? "status-attention" : "status-risk";
                return (
                  <tr key={fw.frameworkKey}>
                    <td style={{ fontWeight: 600 }}>{fw.name}</td>
                    <td style={{ textTransform: "capitalize" }}>{fw.category ?? "commercial"}</td>
                    <td>{fw.passingControls ?? 0} / {fw.totalControls ?? 0}</td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div className="progress-bar-bg" style={{ width: 60 }}>
                          <div className="progress-bar-fill" style={{ width: `${score}%`, background: score >= 75 ? "#22c55e" : score >= 50 ? "#f59e0b" : "#ef4444" }} />
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 600 }}>{score}%</span>
                      </div>
                    </td>
                    <td><span className={`status-pill ${statusClass}`}>{statusLabel}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {/* Failing Controls */}
        {failingControls.length > 0 && (
          <div className="page-break avoid-break">
            <h2 className="section-title">Failing Controls Requiring Remediation ({failingControls.length})</h2>
            {failingControls.slice(0, 25).map((c: any) => (
              <div key={c.controlId ?? c.ucoControlId} className="control-row avoid-break">
                <div className="status-dot-fail" />
                <span className="control-id">{c.controlId ?? c.ucoControlId}</span>
                <div>
                  <div className="control-name">{c.name}</div>
                  <div className="control-domain">{c.domain}</div>
                  {c.result?.result && <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>{c.result.result}</div>}
                </div>
              </div>
            ))}
            {failingControls.length > 25 && (
              <p style={{ fontSize: 13, color: "#94a3b8", marginTop: 8 }}>...and {failingControls.length - 25} more failing controls.</p>
            )}
          </div>
        )}

        {/* Passing Controls Summary */}
        {passingControls.length > 0 && (
          <div className="avoid-break">
            <h2 className="section-title">Passing Controls ({passingControls.length})</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
              {passingControls.slice(0, 20).map((c: any) => (
                <div key={c.controlId ?? c.ucoControlId} className="control-row" style={{ paddingTop: 6, paddingBottom: 6 }}>
                  <div className="status-dot-pass" />
                  <span className="control-id">{c.controlId ?? c.ucoControlId}</span>
                  <div className="control-name" style={{ fontSize: 12 }}>{c.name}</div>
                </div>
              ))}
            </div>
            {passingControls.length > 20 && (
              <p style={{ fontSize: 13, color: "#94a3b8", marginTop: 8 }}>...and {passingControls.length - 20} more passing controls.</p>
            )}
          </div>
        )}

        {/* Risk Register */}
        {risks.length > 0 && (
          <div className="page-break avoid-break">
            <h2 className="section-title">Risk Register Summary</h2>
            <div className="kpi-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)", marginBottom: 20 }}>
              {[
                { label: "Critical", value: risksData?.summary?.critical ?? 0, cls: "red" },
                { label: "High", value: risksData?.summary?.high ?? 0, cls: "amber" },
                { label: "Medium", value: risksData?.summary?.medium ?? 0, cls: "" },
                { label: "Open", value: risksData?.summary?.open ?? 0, cls: "" },
              ].map(({ label, value, cls }) => (
                <div key={label} className="kpi-card">
                  <div className="kpi-label">{label}</div>
                  <div className={`kpi-value ${cls}`}>{value}</div>
                </div>
              ))}
            </div>
            {(criticalRisks.length > 0 || highRisks.length > 0) && (
              <>
                <p style={{ fontSize: 13, fontWeight: 600, color: "#475569", marginBottom: 8 }}>Critical and High Risks:</p>
                <table className="risk-table">
                  <thead>
                    <tr>
                      <th>Risk Title</th>
                      <th>Category</th>
                      <th>Score</th>
                      <th>Level</th>
                      <th>Treatment</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...criticalRisks, ...highRisks].slice(0, 15).map((r: any) => (
                      <tr key={r.id}>
                        <td style={{ fontWeight: 500 }}>{r.title}</td>
                        <td style={{ textTransform: "capitalize" }}>{r.category}</td>
                        <td style={{ fontWeight: 700 }}>{r.inherentScore}</td>
                        <td><span className={riskBadgeClass(r.inherentScore)}>{riskLevel(r.inherentScore)}</span></td>
                        <td style={{ textTransform: "capitalize" }}>{r.treatment}</td>
                        <td style={{ textTransform: "capitalize" }}>{r.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        )}

        {/* Policies */}
        {policies.length > 0 && (
          <div className="avoid-break">
            <h2 className="section-title">Policy Coverage ({policies.length} policies)</h2>
            <div className="policy-grid">
              {policies.slice(0, 24).map((p: any) => (
                <div key={p.id} className={`policy-item ${p.status === "active" || p.status === "published" ? "policy-active" : "policy-draft"}`}>
                  <span style={{ fontSize: 12, color: p.status === "active" || p.status === "published" ? "#15803d" : "#94a3b8" }}>
                    {p.status === "active" || p.status === "published" ? "Active" : "Draft"}
                  </span>
                  <span style={{ fontSize: 13 }}>{p.title}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="footer">
          <p>
            This report was automatically generated by <strong>EnterpriseComply</strong> on {today}.
            Report ID: {reportId} &bull; {org?.name ?? "EnterpriseComply"} &bull; Confidential
          </p>
          <p style={{ marginTop: 4 }}>
            For questions about this report, contact your compliance team or EnterpriseComply support.
          </p>
        </div>
      </div>
    </>
  );
}

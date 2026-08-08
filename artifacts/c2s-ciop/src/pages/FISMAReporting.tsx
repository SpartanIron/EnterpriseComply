import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/queryClient";
import { useOrg } from "@/hooks/useOrg";

// P0-09: FISMA_METRICS, POAM_SUMMARY, INCIDENT_SUMMARY, ATO_SUMMARY removed.
// They were hardcoded constants (Q3 FY2026 scores, ATO counts, etc.) shown to
// every org regardless of actual data.
//
// What IS real: the POA&M tab is wired to GET /orgs/:orgId/poam (real endpoint).
// What has no backend yet: FISMA Scorecard, Incident Summary, ATO Inventory —
// honest empty states shown until those APIs are built.

interface PoamItem {
  id: number;
  title: string;
  severity: string;
  status: string;
  scheduledCompletionDate: string | null;
  ownerName: string;
  frameworkKey: string;
  originalRisk: string;
  residualRisk: string;
}

function SeverityBadge({ sev }: { sev: string }) {
  const cfg: Record<string, string> = { critical: "#dc2626", high: "#ea580c", medium: "#d97706", low: "#65a30d" };
  const c = cfg[sev.toLowerCase()] ?? "#94a3b8";
  return <span className="text-xs font-bold px-2 py-0.5 rounded-full capitalize" style={{ background: c + "22", color: c }}>{sev}</span>;
}
function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { label: string; color: string }> = {
    open: { label: "Open", color: "#ef4444" },
    in_progress: { label: "In Progress", color: "#f59e0b" },
    closed: { label: "Closed", color: "#22c55e" },
    delayed: { label: "Delayed", color: "#8b5cf6" },
  };
  const c = cfg[status] ?? { label: status, color: "#94a3b8" };
  return <span className="text-xs font-semibold px-2 py-0.5 rounded-full capitalize" style={{ background: c.color + "22", color: c.color }}>{c.label}</span>;
}

const EmptyState = ({ title, body }: { title: string; body: string }) => (
  <div className="bg-white rounded-xl border border-slate-200 p-16 flex flex-col items-center text-center">
    <div className="h-14 w-14 rounded-full bg-slate-50 flex items-center justify-center mb-4">
      <svg className="h-7 w-7 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
    </div>
    <h3 className="text-sm font-bold text-slate-800 mb-2">{title}</h3>
    <p className="text-xs text-slate-500 max-w-sm leading-relaxed">{body}</p>
  </div>
);

export default function FISMAReporting() {
  const { orgId } = useOrg();
  const [activeTab, setActiveTab] = useState<"scorecard" | "poam" | "incidents" | "ato" | "export">("scorecard");

  const { data: poamData, isLoading: poamLoading } = useQuery<{ items: PoamItem[] }>({
    queryKey: ["poam", orgId],
    queryFn: () => apiFetch(`/orgs/${orgId}/poam`),
    enabled: !!orgId && activeTab === "poam",
  });

  const poamItems = poamData?.items ?? [];
  const openItems = poamItems.filter(i => i.status === "open" || i.status === "in_progress");
  const critHighItems = poamItems.filter(i => ["critical", "high"].includes(i.severity.toLowerCase()));

  const tabs = [
    { id: "scorecard" as const, label: "FISMA Scorecard" },
    { id: "poam" as const, label: "POA&M Summary" },
    { id: "incidents" as const, label: "Incident Summary" },
    { id: "ato" as const, label: "ATO Inventory" },
    { id: "export" as const, label: "Export Packages" },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">FISMA Reporting</h1>
          <p className="text-sm text-slate-500 mt-1">Federal Information Security Modernization Act reporting, CIO metrics, and FITARA scorecard preparation</p>
        </div>
      </div>

      <div className="flex gap-1 mb-6">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors" style={{ background: activeTab === t.id ? "#2563eb" : "#fff", color: activeTab === t.id ? "#fff" : "#64748b", border: "1px solid", borderColor: activeTab === t.id ? "#2563eb" : "#e2e8f0" }}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "scorecard" && (
        <EmptyState
          title="FISMA scorecard data not yet available"
          body="The FISMA CIO metrics scorecard (OMB M-21-02) requires data from completed control assessments, incident records, and ATO documentation. Build out your frameworks and complete assessments to generate this report."
        />
      )}

      {activeTab === "poam" && (
        <div>
          {/* Real POA&M summary from actual org data */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            {[
              { label: "Total Open POA&Ms", value: openItems.length, color: "#2563eb" },
              { label: "Critical / High Risk", value: critHighItems.filter(i => i.status !== "closed").length, color: "#ef4444" },
              { label: "Closed Items", value: poamItems.filter(i => i.status === "closed").length, color: "#22c55e" },
            ].map(s => (
              <div key={s.label} className="p-4 rounded-xl border border-slate-200 bg-white">
                <p className="text-xs text-slate-500 font-medium">{s.label}</p>
                <p className="text-3xl font-bold mt-1" style={{ color: s.color }}>{poamLoading ? "—" : s.value}</p>
              </div>
            ))}
          </div>
          {poamLoading ? (
            <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-sm text-slate-400">Loading POA&M items…</div>
          ) : poamItems.length === 0 ? (
            <EmptyState
              title="No POA&M items recorded"
              body="Plan of Action & Milestones items will appear here once created. Use the Remediation module to track open findings."
            />
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead><tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Title</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Severity</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Owner</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Due</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Framework</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {poamItems.map(item => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-800 max-w-xs">{item.title}</td>
                      <td className="px-4 py-3"><SeverityBadge sev={item.severity} /></td>
                      <td className="px-4 py-3"><StatusBadge status={item.status} /></td>
                      <td className="px-4 py-3 text-xs text-slate-600">{item.ownerName}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{item.scheduledCompletionDate ? new Date(item.scheduledCompletionDate).toLocaleDateString() : "—"}</td>
                      <td className="px-4 py-3 text-xs font-mono text-blue-600">{item.frameworkKey}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === "incidents" && (
        <EmptyState
          title="Incident summary not yet available"
          body="US-CERT incident reporting data will appear here once incident records are captured. Log incidents through the Audit Log and document them here for FISMA submission."
        />
      )}

      {activeTab === "ato" && (
        <EmptyState
          title="ATO inventory not yet available"
          body="Authorization to Operate records (ATO, IATT, FedRAMP) will appear here once system boundary records are created. Use the System Boundary Registry to register each system and its authorization status."
        />
      )}

      {activeTab === "export" && (
        <EmptyState
          title="No report packages ready to export"
          body="Report packages (FISMA Annual Report, FITARA Scorecard, CDM Dashboard Export, eMASS Data Package, OSCAL SSP) require completed assessment data. Activate frameworks and complete control assessments first."
        />
      )}
    </div>
  );
}

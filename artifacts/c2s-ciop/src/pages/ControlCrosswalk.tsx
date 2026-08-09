import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CROSSWALK_DATA } from "./crosswalk-data";
import { useOrg } from "@/hooks/useOrg";
import { apiUrl } from "@/lib/queryClient";

const FRAMEWORKS = [
  { key: "nist53",   label: "NIST 800-53 Rev 5",   color: "#1d4ed8" },
  { key: "cmmc",     label: "CMMC 2.0 (L2)",        color: "#7c3aed" },
  { key: "nist171",  label: "NIST 800-171 Rev 2",   color: "#0891b2" },
  { key: "soc2",     label: "SOC 2 TSC",            color: "#059669" },
  { key: "iso27001", label: "ISO 27001:2022",       color: "#d97706" },
  { key: "fedramp",  label: "FedRAMP High",         color: "#dc2626" },
  { key: "hipaa",    label: "HIPAA §164",           color: "#7e22ce" },
];

const FAMILIES = ["All", ...Array.from(new Set(CROSSWALK_DATA.map(c => c.family)))];

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { label: string; color: string }> = {
    passing:    { label: "Passing",    color: "#22c55e" },
    partial:    { label: "Partial",    color: "#f59e0b" },
    failing:    { label: "Failing",    color: "#ef4444" },
    not_tested: { label: "Not Tested", color: "#94a3b8" },
  };
  const c = cfg[status] ?? cfg.not_tested;
  return (
    <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
      style={{ background: c.color + "22", color: c.color }}>
      {c.label}
    </span>
  );
}

// ── CSV export ─────────────────────────────────────────────────────────────────
function exportCrosswalkCsv(data: typeof CROSSWALK_DATA, activeFrameworks: string[], frameworks: typeof FRAMEWORKS) {
  const dateStr = new Date().toISOString().slice(0, 10);
  const activeList = frameworks.filter(f => activeFrameworks.includes(f.key));
  const headers = ["UCO ID", "Control Name", "Family", "Status", "Coverage %"];
  activeList.forEach(fw => headers.push(fw.label));
  headers.push("Integrations");
  const rows: string[][] = [headers];
  data.forEach(ctrl => {
    const row = [ctrl.ucoId, ctrl.ucoName, ctrl.family, ctrl.status, String(ctrl.coverage)];
    activeList.forEach(fw => row.push((ctrl as any)[fw.key]?.join("; ") || ""));
    row.push(ctrl.integrations.join("; "));
    rows.push(row);
  });
  const csv = rows.map(r => r.map(c => JSON.stringify(c)).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "control-crosswalk-" + dateStr + ".csv"; a.click();
  URL.revokeObjectURL(url);
}

// ── PDF export — browser print-to-PDF ──────────────────────────────────────────
function exportCrosswalkPdf(
  data: typeof CROSSWALK_DATA,
  activeFrameworks: string[],
  frameworks: typeof FRAMEWORKS,
  stats: { total: number; passing: number; partial: number; failing: number; avgCoverage: number },
  orgName?: string,
) {
  const dateStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const activeList = frameworks.filter(f => activeFrameworks.includes(f.key));

  const statusBadge = (s: string) => {
    const map: Record<string, [string, string]> = {
      passing:    ["#15803d", "#dcfce7"],
      partial:    ["#b45309", "#fef3c7"],
      failing:    ["#dc2626", "#fee2e2"],
      not_tested: ["#64748b", "#f1f5f9"],
    };
    const [color, bg] = map[s] ?? map.not_tested;
    const label = s === "not_tested" ? "Not Tested" : s.charAt(0).toUpperCase() + s.slice(1);
    return `<span style="color:${color};background:${bg};padding:2px 7px;border-radius:999px;font-size:9px;font-weight:700;white-space:nowrap">${label}</span>`;
  };

  const coverageBar = (pct: number) => {
    const bg = pct >= 90 ? "#22c55e" : pct >= 70 ? "#f59e0b" : "#ef4444";
    return `<div style="display:flex;align-items:center;gap:5px"><div style="flex:1;height:5px;background:#e2e8f0;border-radius:3px"><div style="width:${pct}%;height:5px;background:${bg};border-radius:3px"></div></div><span style="font-size:10px;font-weight:600;color:#475569">${pct}%</span></div>`;
  };

  const frameworkCols = activeList.map(fw =>
    `<th style="text-align:left;padding:7px 8px;font-size:9px;font-weight:700;text-transform:uppercase;color:${fw.color};border-bottom:2px solid #e2e8f0;white-space:nowrap">${fw.label}</th>`
  ).join("");

  const rows = data.map((ctrl, i) => {
    const bg = i % 2 === 0 ? "#fff" : "#f8fafc";
    const fwCells = activeList.map(fw => {
      const vals = (ctrl as any)[fw.key] as string[];
      return `<td style="padding:7px 8px;font-size:9px;font-family:monospace;color:${fw.color}">${vals.slice(0, 3).join(", ")}${vals.length > 3 ? ` +${vals.length - 3}` : ""}</td>`;
    }).join("");
    return `
      <tr style="background:${bg}">
        <td style="padding:7px 8px;font-family:monospace;font-size:9px;font-weight:700;color:#1d4ed8;white-space:nowrap">${ctrl.ucoId}</td>
        <td style="padding:7px 8px;font-size:10px;font-weight:500;color:#1e293b">${ctrl.ucoName}<div style="font-size:9px;color:#94a3b8">${ctrl.family}</div></td>
        <td style="padding:7px 8px">${statusBadge(ctrl.status)}</td>
        ${fwCells}
        <td style="padding:7px 8px;min-width:90px">${coverageBar(ctrl.coverage)}</td>
      </tr>`;
  }).join("");

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Control Crosswalk Report — ${dateStr}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #1e293b; padding: 32px; }
    @media print {
      body { padding: 0; }
      .no-print { display: none !important; }
      @page { size: landscape; margin: 15mm 12mm; }
    }
    h1 { font-size: 20px; font-weight: 800; color: #0f172a; }
    .sub { font-size: 12px; color: #64748b; margin-top: 3px; }
    .header { border-bottom: 2px solid #2563eb; padding-bottom: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-end; }
    .stats { display: grid; grid-template-columns: repeat(5,1fr); gap: 10px; margin-bottom: 20px; }
    .stat { border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 12px; }
    .stat-val { font-size: 22px; font-weight: 800; }
    .stat-lbl { font-size: 10px; color: #64748b; margin-top: 2px; font-weight: 500; }
    table { width: 100%; border-collapse: collapse; }
    thead { position: sticky; top: 0; }
    th:first-child, th:nth-child(2) { min-width: 90px; }
    .fws { font-size: 10px; color: #475569; margin-bottom: 12px; }
    .print-btn { position: fixed; bottom: 20px; right: 20px; background: #2563eb; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; box-shadow: 0 4px 12px rgba(37,99,235,0.4); }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>Control Crosswalk Report</h1>
      <div class="sub">${orgName ? orgName + " &mdash; " : ""}Generated ${dateStr}</div>
    </div>
    <div style="text-align:right;font-size:10px;color:#64748b">
      <div style="font-weight:700;color:#1e293b;margin-bottom:2px">Frameworks included</div>
      ${activeList.map(fw => `<span style="color:${fw.color};font-weight:600">${fw.label}</span>`).join(" &bull; ")}
    </div>
  </div>

  <div class="stats">
    <div class="stat"><div class="stat-val" style="color:#2563eb">${stats.total}</div><div class="stat-lbl">UCO Controls</div></div>
    <div class="stat"><div class="stat-val" style="color:#22c55e">${stats.passing}</div><div class="stat-lbl">Passing</div></div>
    <div class="stat"><div class="stat-val" style="color:#f59e0b">${stats.partial}</div><div class="stat-lbl">Partial Coverage</div></div>
    <div class="stat"><div class="stat-val" style="color:#ef4444">${stats.failing}</div><div class="stat-lbl">Failing / Gaps</div></div>
    <div class="stat"><div class="stat-val" style="color:#7c3aed">${stats.avgCoverage}%</div><div class="stat-lbl">Avg Coverage</div></div>
  </div>

  <div class="fws">Showing ${data.length} controls</div>

  <table>
    <thead>
      <tr style="background:#f1f5f9;border-bottom:2px solid #e2e8f0">
        <th style="text-align:left;padding:7px 8px;font-size:9px;font-weight:700;text-transform:uppercase;color:#64748b">UCO Control</th>
        <th style="text-align:left;padding:7px 8px;font-size:9px;font-weight:700;text-transform:uppercase;color:#64748b">Control Name</th>
        <th style="text-align:left;padding:7px 8px;font-size:9px;font-weight:700;text-transform:uppercase;color:#64748b">Status</th>
        ${frameworkCols}
        <th style="text-align:left;padding:7px 8px;font-size:9px;font-weight:700;text-transform:uppercase;color:#64748b">Coverage</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <button class="print-btn no-print" onclick="window.print()">Print / Save PDF</button>
</body>
</html>`;

  const win = window.open("", "_blank");
  if (!win) { alert("Allow pop-ups to download the PDF report."); return; }
  win.document.write(html);
  win.document.close();
  win.focus();
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function ControlCrosswalk() {
  const { org, orgId } = useOrg();

  // Fetch live control data to overlay remediation guidance and failure reasons
  const { data: controlsData } = useQuery<{ controls: any[] }>({
    queryKey: ["controls", orgId],
    queryFn: async () => {
      const res = await fetch(apiUrl(`/orgs/${orgId}/controls`), { credentials: "include" });
      return res.json();
    },
    enabled: !!orgId,
    staleTime: 60000,
  });

  // Map UCO control ID → live control data
  const controlMap = useMemo(() => {
    const map = new Map<string, any>();
    if (controlsData?.controls) {
      for (const c of controlsData.controls) {
        map.set(c.controlId, c);
      }
    }
    return map;
  }, [controlsData]);

  const [search, setSearch] = useState("");
  const [exporting, setExporting] = useState<"csv" | "pdf" | null>(null);
  const [filterFamily, setFilterFamily] = useState("All");
  const [filterStatus, setFilterStatus] = useState("all");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [activeFrameworks, setActiveFrameworks] = useState<string[]>(
    ["nist53", "cmmc", "nist171", "soc2", "iso27001", "fedramp", "hipaa"]
  );

  const toggleFramework = (key: string) => {
    setActiveFrameworks(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  const filtered = useMemo(() => CROSSWALK_DATA.filter(c => {
    if (search && !c.ucoId.toLowerCase().includes(search.toLowerCase()) && !c.ucoName.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterFamily !== "All" && c.family !== filterFamily) return false;
    if (filterStatus !== "all" && c.status !== filterStatus) return false;
    return true;
  }), [search, filterFamily, filterStatus]);

  const stats = {
    total: CROSSWALK_DATA.length,
    passing: CROSSWALK_DATA.filter(c => c.status === "passing").length,
    partial: CROSSWALK_DATA.filter(c => c.status === "partial").length,
    failing: CROSSWALK_DATA.filter(c => c.status === "failing").length,
    avgCoverage: Math.round(CROSSWALK_DATA.reduce((s, c) => s + c.coverage, 0) / CROSSWALK_DATA.length),
  };

  function handleCsvExport() {
    setExporting("csv");
    setTimeout(() => { exportCrosswalkCsv(filtered, activeFrameworks, FRAMEWORKS); setExporting(null); }, 400);
  }

  function handlePdfExport() {
    setExporting("pdf");
    setTimeout(() => {
      exportCrosswalkPdf(filtered, activeFrameworks, FRAMEWORKS, stats, org?.name);
      setExporting(null);
    }, 400);
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Control Crosswalk Engine</h1>
          <p className="text-sm text-slate-500 mt-1">
            Single-pane multi-framework mapping: 71 UCO controls across NIST 800-53, CMMC 2.0, NIST 800-171, SOC 2, ISO 27001, FedRAMP High, and HIPAA §164
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePdfExport}
            disabled={!!exporting}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-60 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            {exporting === "pdf" ? "Preparing..." : "Download PDF"}
          </button>
          <button
            onClick={handleCsvExport}
            disabled={!!exporting}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
            style={{ background: "#2563eb" }}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            {exporting === "csv" ? "Exporting..." : "Export CSV"}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        {[
          { label: "UCO Controls Mapped", value: stats.total, color: "#2563eb" },
          { label: "Passing", value: stats.passing, color: "#22c55e" },
          { label: "Partial Coverage", value: stats.partial, color: "#f59e0b" },
          { label: "Failing / Gaps", value: stats.failing, color: "#ef4444" },
          { label: "Avg Coverage %", value: stats.avgCoverage + "%", color: "#7c3aed" },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl p-4 border border-slate-200">
            <p className="text-xs text-slate-500 font-medium">{s.label}</p>
            <p className="text-3xl font-bold mt-1" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Framework Toggles */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-3">Active Frameworks</p>
        <div className="flex flex-wrap gap-2">
          {FRAMEWORKS.map(fw => {
            const active = activeFrameworks.includes(fw.key);
            return (
              <button
                key={fw.key}
                onClick={() => toggleFramework(fw.key)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all border"
                style={{
                  background: active ? fw.color + "18" : "#f8fafc",
                  borderColor: active ? fw.color : "#e2e8f0",
                  color: active ? fw.color : "#94a3b8",
                }}
              >
                <div className="h-2 w-2 rounded-full" style={{ background: active ? fw.color : "#e2e8f0" }} />
                {fw.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search UCO ID or control name..."
          className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={filterFamily}
          onChange={e => setFilterFamily(e.target.value)}
          className="px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {FAMILIES.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Statuses</option>
          <option value="passing">Passing</option>
          <option value="partial">Partial</option>
          <option value="failing">Failing</option>
          <option value="not_tested">Not Tested</option>
        </select>
      </div>

      {/* Crosswalk Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider w-36">UCO Control</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Control Name</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Status</th>
                {activeFrameworks.map(fk => {
                  const fw = FRAMEWORKS.find(f => f.key === fk);
                  return fw ? (
                    <th key={fk} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: fw.color }}>
                      {fw.label}
                    </th>
                  ) : null;
                })}
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Coverage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(ctrl => {
                const expanded = expandedRow === ctrl.ucoId;
                const liveControl = controlMap.get(ctrl.ucoId);
                const remediationGuidance = liveControl?.remediationGuidance as string | undefined;
                const failureReason      = liveControl?.result?.failureReason as string | undefined;
                const remediationNotes   = liveControl?.result?.remediationNotes as string | undefined;
                const liveStatus         = liveControl?.result?.status ?? ctrl.status;
                const isGap = liveStatus === "failing" || liveStatus === "partial" || ctrl.status === "failing" || ctrl.status === "partial";

                return (
                  <>
                    <tr
                      key={ctrl.ucoId}
                      className="hover:bg-slate-50 cursor-pointer"
                      onClick={() => setExpandedRow(expanded ? null : ctrl.ucoId)}
                    >
                      <td className="px-4 py-3 font-mono text-xs font-bold text-blue-700">{ctrl.ucoId}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800">{ctrl.ucoName}</div>
                        <div className="text-xs text-slate-400">{ctrl.family}</div>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={ctrl.status} />
                      </td>
                      {activeFrameworks.map(fk => {
                        const fw = FRAMEWORKS.find(f => f.key === fk);
                        const vals = (ctrl as any)[fk] as string[];
                        return fw ? (
                          <td key={fk} className="px-4 py-3">
                            <div className="flex flex-wrap gap-1">
                              {vals.slice(0, 2).map(v => (
                                <span key={v} className="text-xs font-mono px-1.5 py-0.5 rounded border"
                                  style={{ background: fw.color + "10", color: fw.color, borderColor: fw.color + "30" }}>
                                  {v}
                                </span>
                              ))}
                              {vals.length > 2 && <span className="text-xs text-slate-400">+{vals.length - 2}</span>}
                            </div>
                          </td>
                        ) : null;
                      })}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden" style={{ minWidth: 60 }}>
                            <div className="h-full rounded-full" style={{
                              width: ctrl.coverage + "%",
                              background: ctrl.coverage >= 90 ? "#22c55e" : ctrl.coverage >= 70 ? "#f59e0b" : "#ef4444",
                            }} />
                          </div>
                          <span className="text-xs font-semibold text-slate-600">{ctrl.coverage}%</span>
                        </div>
                      </td>
                    </tr>

                    {expanded && (
                      <tr key={ctrl.ucoId + "-exp"} className="bg-blue-50/50">
                        <td colSpan={3 + activeFrameworks.length + 1} className="px-6 py-4">
                          <div className="grid grid-cols-2 gap-6">
                            {/* Left column — integrations + framework mappings */}
                            <div className="space-y-4">
                              <div>
                                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Connected Integrations</p>
                                <div className="flex flex-wrap gap-2">
                                  {ctrl.integrations.map(i => (
                                    <span key={i} className="text-xs px-2 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 font-medium">{i}</span>
                                  ))}
                                </div>
                              </div>
                              <div>
                                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Full Framework Mappings</p>
                                <div className="space-y-1">
                                  {FRAMEWORKS.map(fw => {
                                    const vals = (ctrl as any)[fw.key] as string[];
                                    return (
                                      <div key={fw.key} className="flex items-center gap-2">
                                        <span className="text-xs font-medium w-36" style={{ color: fw.color }}>{fw.label}:</span>
                                        <span className="text-xs text-slate-600 font-mono">{vals.join(", ")}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>

                            {/* Right column — remediation guidance */}
                            <div className="space-y-3">
                              {/* Failure reason */}
                              {failureReason && (
                                <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                                  <p className="text-xs font-semibold text-red-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                    Failure Reason
                                  </p>
                                  <p className="text-xs text-red-800 leading-relaxed">{failureReason}</p>
                                </div>
                              )}

                              {/* Remediation guidance */}
                              {remediationGuidance ? (
                                <div className={`rounded-lg border p-3 ${isGap ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-white"}`}>
                                  <p className={`text-xs font-semibold uppercase tracking-wider mb-1.5 flex items-center gap-1.5 ${isGap ? "text-amber-700" : "text-slate-600"}`}>
                                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                    </svg>
                                    Remediation Guidance
                                  </p>
                                  <p className={`text-xs leading-relaxed ${isGap ? "text-amber-800" : "text-slate-600"}`}>{remediationGuidance}</p>
                                </div>
                              ) : isGap ? (
                                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                                  <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    Remediation Guidance
                                  </p>
                                  <p className="text-xs text-amber-700 leading-relaxed">
                                    Review this control gap in the{" "}
                                    <a href="/remediation" className="underline font-semibold">Remediation Board</a>
                                    {" "}or run{" "}
                                    <a href="/gap-analysis" className="underline font-semibold">AI Gap Analysis</a>
                                    {" "}for tailored action steps.
                                  </p>
                                </div>
                              ) : null}

                              {/* User remediation notes */}
                              {remediationNotes && (
                                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                                  <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                    Team Notes
                                  </p>
                                  <p className="text-xs text-blue-800 leading-relaxed">{remediationNotes}</p>
                                </div>
                              )}

                              {/* No issues state */}
                              {!isGap && !remediationGuidance && !remediationNotes && !failureReason && (
                                <div className="rounded-lg border border-green-200 bg-green-50 p-3 flex items-center gap-2">
                                  <svg className="h-4 w-4 text-green-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                  </svg>
                                  <p className="text-xs text-green-800 font-medium">This control is passing — no remediation action required.</p>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="py-12 text-center text-slate-400">
            <p className="text-sm">No controls match your current filters</p>
          </div>
        )}
      </div>
    </div>
  );
}

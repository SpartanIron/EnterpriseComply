import { useMemo, useState } from "react";
import { CROSSWALK_DATA } from "./crosswalk-data";

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
    passing: { label: "Passing", color: "#22c55e" },
    partial: { label: "Partial", color: "#f59e0b" },
    failing: { label: "Failing", color: "#ef4444" },
    not_tested: { label: "Not Tested", color: "#94a3b8" },
  };
  const c = cfg[status] ?? cfg.not_tested;
  return <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: c.color + "22", color: c.color }}>{c.label}</span>;
}


function exportCrosswalkCsv(data: typeof CROSSWALK_DATA, activeFrameworks: string[], frameworks: typeof FRAMEWORKS) {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const activeFrameworkList = frameworks.filter(f => activeFrameworks.includes(f.key));
  const headers = ["UCO ID", "Control Name", "Family", "Status", "Coverage %"];
  activeFrameworkList.forEach(fw => headers.push(fw.label));
  headers.push("Integrations");
  const rows: string[][] = [headers];
  data.forEach(ctrl => {
    const row = [ctrl.ucoId, ctrl.ucoName, ctrl.family, ctrl.status, String(ctrl.coverage)];
    activeFrameworkList.forEach(fw => row.push((ctrl as any)[fw.key]?.join("; ") || ""));
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

export default function ControlCrosswalk() {
  const [search, setSearch] = useState("");
  const [exporting, setExporting] = useState(false);

  function handleExport() {
    setExporting(true);
    setTimeout(() => { exportCrosswalkCsv(filtered, activeFrameworks, FRAMEWORKS); setExporting(false); }, 400);
  }
  const [filterFamily, setFilterFamily] = useState("All");
  const [filterStatus, setFilterStatus] = useState("all");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [activeFrameworks, setActiveFrameworks] = useState<string[]>(["nist53", "cmmc", "nist171", "soc2", "iso27001", "fedramp", "hipaa"]);

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

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Control Crosswalk Engine</h1>
          <p className="text-sm text-slate-500 mt-1">Single-pane multi-framework mapping: 71 UCO controls across NIST 800-53, CMMC 2.0, NIST 800-171, SOC 2, ISO 27001, FedRAMP High, and HIPAA §164</p>
        </div>
        <button onClick={handleExport} disabled={exporting} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60" style={{ background: "#2563eb" }}>
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
          {exporting ? "Exporting..." : "Export Crosswalk"}
        </button>
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
              <button key={fw.key} onClick={() => toggleFramework(fw.key)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all border" style={{ background: active ? fw.color + "18" : "#f8fafc", borderColor: active ? fw.color : "#e2e8f0", color: active ? fw.color : "#94a3b8" }}>
                <div className="h-2 w-2 rounded-full" style={{ background: active ? fw.color : "#e2e8f0" }} />
                {fw.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search UCO ID or control name..." className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <select value={filterFamily} onChange={e => setFilterFamily(e.target.value)} className="px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          {FAMILIES.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
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
                  return fw ? <th key={fk} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: fw.color }}>{fw.label}</th> : null;
                })}
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Coverage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(ctrl => {
                const expanded = expandedRow === ctrl.ucoId;
                return (
                  <>
                    <tr key={ctrl.ucoId} className="hover:bg-slate-50 cursor-pointer" onClick={() => setExpandedRow(expanded ? null : ctrl.ucoId)}>
                      <td className="px-4 py-3 font-mono text-xs font-bold text-blue-700">{ctrl.ucoId}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800">{ctrl.ucoName}</div>
                        <div className="text-xs text-slate-400">{ctrl.family}</div>
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={ctrl.status} /></td>
                      {activeFrameworks.map(fk => {
                        const fw = FRAMEWORKS.find(f => f.key === fk);
                        const vals = (ctrl as any)[fk] as string[];
                        return fw ? (
                          <td key={fk} className="px-4 py-3">
                            <div className="flex flex-wrap gap-1">
                              {vals.slice(0, 2).map(v => <span key={v} className="text-xs font-mono px-1.5 py-0.5 rounded border" style={{ background: fw.color + "10", color: fw.color, borderColor: fw.color + "30" }}>{v}</span>)}
                              {vals.length > 2 && <span className="text-xs text-slate-400">+{vals.length - 2}</span>}
                            </div>
                          </td>
                        ) : null;
                      })}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden" style={{ minWidth: 60 }}>
                            <div className="h-full rounded-full" style={{ width: ctrl.coverage + "%", background: ctrl.coverage >= 90 ? "#22c55e" : ctrl.coverage >= 70 ? "#f59e0b" : "#ef4444" }} />
                          </div>
                          <span className="text-xs font-semibold text-slate-600">{ctrl.coverage}%</span>
                        </div>
                      </td>
                    </tr>
                    {expanded && (
                      <tr key={ctrl.ucoId + "-exp"} className="bg-blue-50/50">
                        <td colSpan={3 + activeFrameworks.length + 1} className="px-6 py-4">
                          <div className="grid grid-cols-2 gap-6">
                            <div>
                              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Connected Integrations</p>
                              <div className="flex flex-wrap gap-2">
                                {ctrl.integrations.map(i => <span key={i} className="text-xs px-2 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 font-medium">{i}</span>)}
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

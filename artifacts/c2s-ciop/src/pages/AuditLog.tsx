import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/queryClient";
import { useOrg } from "@/hooks/useOrg";

const ACTION_COLORS: Record<string, string> = {
  CREATE: "bg-green-100 text-green-700",
  UPDATE: "bg-blue-100 text-blue-700",
  DELETE: "bg-red-100 text-red-700",
  PATCH: "bg-yellow-100 text-yellow-700",
  LOGIN: "bg-purple-100 text-purple-700",
  CONNECT: "bg-emerald-100 text-emerald-700",
  SYNC: "bg-sky-100 text-sky-700",
  PUBLISH: "bg-violet-100 text-violet-700",
  IMPORT: "bg-amber-100 text-amber-700",
  EXPORT: "bg-orange-100 text-orange-700",
};

function getActionColor(action: string) {
  const key = Object.keys(ACTION_COLORS).find((k) => action.toUpperCase().includes(k));
  return key ? ACTION_COLORS[key] : "bg-slate-100 text-slate-600";
}

export default function AuditLog() {
  const { orgId } = useOrg();
  const [filter, setFilter] = useState("");

  const { data, isLoading } = useQuery<{ logs: any[] }>({
    queryKey: ["audit-log", orgId],
    queryFn: () => apiFetch(`/orgs/${orgId}/audit-log?limit=200`),
    enabled: !!orgId,
    refetchInterval: 30000,
  });

  const logs = data?.logs ?? [];
  const filtered = filter
    ? logs.filter((l) => l.action.toLowerCase().includes(filter.toLowerCase()) ||
        l.resource.toLowerCase().includes(filter.toLowerCase()) ||
        (l.actorEmail ?? "").toLowerCase().includes(filter.toLowerCase()))
    : logs;

  const uniqueActors = new Set(logs.map(l => l.actorEmail).filter(Boolean)).size;
  const today = logs.filter(l => new Date(l.createdAt).toDateString() === new Date().toDateString()).length;
  const deletions = logs.filter(l => l.action.toLowerCase().includes("delete")).length;

  return (
    <div className="p-6 max-w-screen-xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Audit Log</h1>
          <p className="text-sm text-slate-500 mt-0.5">Complete record of changes and actions across your organization</p>
        </div>
        <div className="flex items-center gap-2">
          <input value={filter} onChange={(e) => setFilter(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Filter logs..." />
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-5">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <p className={`text-2xl font-bold leading-none ${logs.length > 0 ? "text-slate-900" : "text-slate-300"}`}>{logs.length}</p>
          <p className="text-xs font-semibold text-slate-500 mt-1">Total Entries</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <p className={`text-2xl font-bold leading-none ${today > 0 ? "text-blue-600" : "text-slate-300"}`}>{today}</p>
          <p className="text-xs font-semibold text-slate-500 mt-1">Today</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <p className={`text-2xl font-bold leading-none ${uniqueActors > 0 ? "text-slate-900" : "text-slate-300"}`}>{uniqueActors}</p>
          <p className="text-xs font-semibold text-slate-500 mt-1">Unique Actors</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <p className={`text-2xl font-bold leading-none ${deletions > 0 ? "text-red-500" : "text-slate-300"}`}>{deletions}</p>
          <p className="text-xs font-semibold text-slate-500 mt-1">Deletions</p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex gap-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">
          <span className="w-36">Timestamp</span>
          <span className="w-40">Actor</span>
          <span className="w-28">Action</span>
          <span className="flex-1">Resource</span>
        </div>

        {isLoading ? (
          <div className="divide-y divide-slate-100">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="px-5 py-3 flex gap-6">
                <div className="h-4 bg-slate-100 rounded w-32 animate-pulse" />
                <div className="h-4 bg-slate-100 rounded w-36 animate-pulse" />
                <div className="h-4 bg-slate-100 rounded w-20 animate-pulse" />
                <div className="h-4 bg-slate-100 rounded w-48 animate-pulse" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <p className="text-slate-400 text-sm">
              {filter ? "No log entries match your filter." : "No audit log entries yet. Actions will appear here as your team uses ColorComply."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 max-h-[60vh] overflow-y-auto">
            {filtered.map((log) => (
              <div key={log.id} className="flex items-start gap-6 px-5 py-3 hover:bg-slate-50 text-sm">
                <span className="w-36 text-xs text-slate-400 font-mono flex-shrink-0 pt-0.5">
                  {new Date(log.createdAt).toLocaleDateString()}{" "}
                  <span className="text-slate-300">{new Date(log.createdAt).toLocaleTimeString()}</span>
                </span>
                <span className="w-40 text-slate-600 text-xs truncate flex-shrink-0">
                  {log.actorEmail ?? <span className="text-slate-300 italic">system</span>}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded font-mono font-medium w-28 flex-shrink-0 text-center ${getActionColor(log.action)}`}>
                  {log.action}
                </span>
                <div className="flex-1 min-w-0">
                  <span className="text-slate-700">{log.resource}</span>
                  {log.resourceId && <span className="text-slate-400 ml-1 text-xs">#{log.resourceId}</span>}
                  {log.details && (
                    <p className="text-xs text-slate-400 mt-0.5 truncate">{typeof log.details === "string" ? log.details : JSON.stringify(log.details).slice(0, 80)}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="text-xs text-slate-400 mt-3">Showing last {filtered.length} of {logs.length} entries. Audit log is retained for 12 months.</p>
    </div>
  );
}

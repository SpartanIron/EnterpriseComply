import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/queryClient";
import { useOrg } from "@/hooks/useOrg";

function timeAgo(date: string) {
  if (!date) return "Never";
  const diff = Date.now() - new Date(date).getTime();
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (d > 0) return `${d}d ago`;
  if (h > 0) return `${h}h ago`;
  return "Just now";
}

const SEVERITY_CONFIG: Record<string, { dot: string; text: string }> = {
  critical: { dot: "bg-red-500", text: "text-red-700" },
  high: { dot: "bg-orange-500", text: "text-orange-700" },
  warning: { dot: "bg-yellow-500", text: "text-yellow-700" },
  info: { dot: "bg-blue-400", text: "text-blue-700" },
};

export default function Monitoring() {
  const { orgId } = useOrg();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"notifications" | "monitoring" | "settings">("notifications");

  const { data: notifData } = useQuery<{ notifications: any[]; unreadCount: number }>({
    queryKey: ["notifications", orgId],
    queryFn: () => apiFetch(`/orgs/${orgId}/notifications`),
    enabled: !!orgId,
    refetchInterval: 30000,
  });

  const { data: monitorData } = useQuery<{ monitoringJobs: any[] }>({
    queryKey: ["monitoring", orgId],
    queryFn: () => apiFetch(`/orgs/${orgId}/monitoring`),
    enabled: !!orgId,
  });

  const { data: settingsData } = useQuery<{ settings: any }>({
    queryKey: ["monitoring-settings", orgId],
    queryFn: () => apiFetch(`/orgs/${orgId}/monitoring/settings`),
    enabled: !!orgId,
  });

  const { data: logData } = useQuery<{ logs: any[] }>({
    queryKey: ["audit-log", orgId],
    queryFn: () => apiFetch(`/orgs/${orgId}/audit-log`),
    enabled: !!orgId,
  });

  const markReadMutation = useMutation({
    mutationFn: () => apiFetch(`/orgs/${orgId}/notifications/read`, { method: "POST", body: JSON.stringify({}) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const triggerMutation = useMutation({
    mutationFn: (integrationKey: string) => apiFetch(`/orgs/${orgId}/monitoring/check`, { method: "POST", body: JSON.stringify({ integrationKey }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["monitoring"] }); qc.invalidateQueries({ queryKey: ["notifications"] }); },
  });

  const updateSettingsMutation = useMutation({
    mutationFn: (body: any) => apiFetch(`/orgs/${orgId}/monitoring/settings`, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["monitoring-settings"] }),
  });

  const notifications = notifData?.notifications ?? [];
  const jobs = monitorData?.monitoringJobs ?? [];
  const settings = settingsData?.settings;
  const logs = logData?.logs ?? [];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Continuous Monitoring</h1>
          <p className="text-sm text-slate-500 mt-0.5">Real-time compliance monitoring, drift alerts, and audit trail</p>
        </div>
        {(notifData?.unreadCount ?? 0) > 0 && (
          <span className="px-3 py-1 bg-blue-600 text-white text-xs font-medium rounded-full">{notifData?.unreadCount} unread</span>
        )}
      </div>

      <div className="flex gap-1 border-b border-slate-200 mb-6">
        {([["notifications", "Notifications"], ["monitoring", "Monitoring Jobs"], ["settings", "Alert Settings"]] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === id ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
            {label}
            {id === "notifications" && (notifData?.unreadCount ?? 0) > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">{notifData?.unreadCount}</span>
            )}
          </button>
        ))}
      </div>

      {tab === "notifications" && (
        <div>
          {notifications.length > 0 && (
            <div className="flex justify-end mb-3">
              <button onClick={() => markReadMutation.mutate()} className="text-xs text-blue-600 hover:underline">Mark all read</button>
            </div>
          )}
          {notifications.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
              <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center mx-auto mb-3">
                <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              </div>
              <p className="text-slate-600 font-medium">All clear</p>
              <p className="text-sm text-slate-400 mt-1">No notifications. Connect integrations to start monitoring.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {notifications.map((n) => {
                const sc = SEVERITY_CONFIG[n.severity] ?? SEVERITY_CONFIG.info;
                return (
                  <div key={n.id} className={`bg-white border rounded-lg p-4 flex items-start gap-3 ${n.read ? "border-slate-100 opacity-70" : "border-slate-200"}`}>
                    <div className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${n.read ? "bg-slate-300" : sc.dot}`} />
                    <div className="flex-1">
                      <p className={`text-sm font-medium ${n.read ? "text-slate-500" : "text-slate-800"}`}>{n.title}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{n.message}</p>
                    </div>
                    <span className="text-xs text-slate-400 flex-shrink-0">{timeAgo(n.createdAt)}</span>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-8">
            <h2 className="font-semibold text-slate-800 mb-3">Audit Log</h2>
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
                {logs.length === 0 ? (
                  <p className="text-center text-sm text-slate-400 py-8">No audit log entries yet.</p>
                ) : logs.map((log) => (
                  <div key={log.id} className="flex items-center px-4 py-2.5 text-xs gap-4">
                    <span className="text-slate-400 font-mono w-32 flex-shrink-0">{new Date(log.createdAt).toLocaleString()}</span>
                    <span className="text-slate-600 font-medium w-40 truncate">{log.actorEmail ?? "system"}</span>
                    <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">{log.action}</span>
                    <span className="text-slate-500">{log.resource}{log.resourceId ? ` #${log.resourceId}` : ""}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "monitoring" && (
        <div>
          {jobs.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
              <p className="text-slate-500 text-sm">No connected integrations to monitor. Connect an integration to enable continuous monitoring.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {jobs.map((j) => (
                <div key={j.id} className="bg-white border border-slate-200 rounded-xl p-5 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="font-medium text-slate-800 capitalize">{j.integrationKey}</p>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700">{j.status ?? "connected"}</span>
                    </div>
                    <p className="text-xs text-slate-400">Last check: {timeAgo(j.lastSyncAt)} · Next check: {j.job?.nextRunAt ? timeAgo(j.job.nextRunAt) : "24h"}</p>
                    {j.job?.driftDetected && <p className="text-xs text-orange-600 mt-0.5">Drift detected in last check</p>}
                  </div>
                  <button onClick={() => triggerMutation.mutate(j.integrationKey)} disabled={triggerMutation.isPending}
                    className="px-3 py-1.5 text-sm border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 disabled:opacity-50">
                    Run Check Now
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "settings" && settings && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div>
            <h2 className="font-semibold text-slate-800 mb-4">Notification Channels</h2>
            <div className="space-y-3">
              <label className="flex items-center justify-between p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
                <div>
                  <p className="text-sm font-medium text-slate-700">Email Notifications</p>
                  <p className="text-xs text-slate-400">Receive alerts via email</p>
                </div>
                <input type="checkbox" checked={settings.emailEnabled} onChange={(e) => updateSettingsMutation.mutate({ emailEnabled: e.target.checked })} className="h-4 w-4 text-blue-600" />
              </label>
              <label className="flex items-center justify-between p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
                <div>
                  <p className="text-sm font-medium text-slate-700">Slack Notifications</p>
                  <p className="text-xs text-slate-400">Send alerts to a Slack channel</p>
                </div>
                <input type="checkbox" checked={settings.slackEnabled} onChange={(e) => updateSettingsMutation.mutate({ slackEnabled: e.target.checked })} className="h-4 w-4 text-blue-600" />
              </label>
              {settings.slackEnabled && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Slack Webhook URL</label>
                  <input defaultValue={settings.slackWebhookUrl ?? ""} onBlur={(e) => updateSettingsMutation.mutate({ slackWebhookUrl: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="https://hooks.slack.com/services/..." />
                </div>
              )}
            </div>
          </div>
          <div>
            <h2 className="font-semibold text-slate-800 mb-4">Alert Triggers</h2>
            <div className="space-y-2">
              {([["notifyOnDrift", "Compliance Drift Detected"], ["notifyOnEvidenceExpiry", "Evidence Expiring (30 days)"], ["notifyOnPoamOverdue", "POA&M Items Overdue"], ["notifyOnNewFindings", "New Findings"]] as const).map(([key, label]) => (
                <label key={key} className="flex items-center justify-between p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
                  <p className="text-sm font-medium text-slate-700">{label}</p>
                  <input type="checkbox" checked={settings[key]} onChange={(e) => updateSettingsMutation.mutate({ [key]: e.target.checked })} className="h-4 w-4 text-blue-600" />
                </label>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

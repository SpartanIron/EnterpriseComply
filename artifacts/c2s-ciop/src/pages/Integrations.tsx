import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiUrl, apiFetch } from "@/lib/queryClient";
import { useOrg } from "@/hooks/useOrg";

export default function Integrations() {
  const [location] = useLocation();
  const { orgId } = useOrg();
  const qc = useQueryClient();
  const connected = new URLSearchParams(location.split("?")[1] ?? "").get("connected");

  const { data, isLoading } = useQuery<{ integrations: any[] }>({
    queryKey: ["org-integrations", orgId],
    queryFn: () => apiFetch(`/orgs/${orgId}/integrations`),
    enabled: !!orgId,
  });

  const syncMutation = useMutation({
    mutationFn: (integrationKey: string) =>
      apiFetch(`/orgs/${orgId}/integrations/${integrationKey}/sync`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["org-integrations"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["org-controls"] });
    },
  });

  const demoConnectMutation = useMutation({
    mutationFn: (integrationKey: string) =>
      apiFetch(`/orgs/${orgId}/integrations/${integrationKey}/demo-connect`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["org-integrations"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["org-controls"] });
      qc.invalidateQueries({ queryKey: ["evidence"] });
    },
  });

  const [demoConnecting, setDemoConnecting] = useState<string | null>(null);

  const handleDemoConnect = async (key: string) => {
    if (key === "github") {
      const res = await fetch(apiUrl(`/orgs/${orgId}/integrations/${key}/demo-connect`), {
        method: "POST", credentials: "include",
      });
      if (res.ok) {
        qc.invalidateQueries({ queryKey: ["org-integrations"] });
        qc.invalidateQueries({ queryKey: ["dashboard"] });
      }
      return;
    }
    setDemoConnecting(key);
    try {
      await demoConnectMutation.mutateAsync(key);
    } finally {
      setDemoConnecting(null);
    }
  };

  const integrations = data?.integrations ?? [];
  const connectedList = integrations.filter((i) => i.connection?.status === "connected");
  const availableList = integrations.filter((i) => !i.connection && i.available);
  const comingSoon = integrations.filter((i) => !i.connection && !i.available);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Integrations</h1>
        <p className="text-sm text-slate-500 mt-0.5">Connect your tools to collect compliance evidence automatically</p>
      </div>

      {connected && (
        <div className="mb-5 bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
          <svg className="h-5 w-5 text-green-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <p className="text-green-800 text-sm font-semibold capitalize">{connected} connected! Evidence collection has started.</p>
        </div>
      )}

      {isLoading && (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-slate-100 rounded-xl animate-pulse" />)}</div>
      )}

      {connectedList.length > 0 && (
        <div className="mb-7">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Connected ({connectedList.length})</h2>
          <div className="space-y-3">
            {connectedList.map((i: any) => (
              <ConnectedCard key={i.key} integration={i}
                onSync={() => syncMutation.mutate(i.key)}
                syncing={syncMutation.isPending && syncMutation.variables === i.key} />
            ))}
          </div>
        </div>
      )}

      {availableList.length > 0 && (
        <div className="mb-7">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Available to Connect ({availableList.length})</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {availableList.map((i: any) => (
              <AvailableCard key={i.key} integration={i} orgId={orgId}
                onDemoConnect={() => handleDemoConnect(i.key)}
                connecting={demoConnecting === i.key} />
            ))}
          </div>
        </div>
      )}

      {comingSoon.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Coming Soon</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {comingSoon.map((i: any) => (
              <div key={i.key} className="bg-white rounded-xl border border-slate-200 p-4 opacity-60">
                <div className="flex items-center gap-3">
                  <IntegrationLogo name={i.key} size="sm" />
                  <div>
                    <p className="font-medium text-slate-700 text-sm">{i.name}</p>
                    <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-400 text-xs rounded-full mt-0.5">Coming soon</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ConnectedCard({ integration, onSync, syncing }: { integration: any; onSync: () => void; syncing: boolean }) {
  const conn = integration.connection;
  const lastSync = conn?.lastSyncAt ? new Date(conn.lastSyncAt).toLocaleString() : "Never";
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center gap-4">
        <IntegrationLogo name={integration.key} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="font-semibold text-slate-900">{integration.name}</p>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
              Connected
            </span>
          </div>
          {conn?.accountLogin && <p className="text-xs text-slate-500">@{conn.accountLogin}</p>}
          <p className="text-xs text-slate-400 mt-0.5">Last sync: {lastSync} &middot; {conn?.evidenceCollected ?? 0} evidence items</p>
        </div>
        <button onClick={onSync} disabled={syncing}
          className="flex-shrink-0 px-3 py-1.5 border border-slate-200 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50 disabled:opacity-50">
          {syncing ? "Syncing..." : "Sync now"}
        </button>
      </div>
      {integration.controls?.length > 0 && (
        <div className="mt-4 pt-3 border-t border-slate-100">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Controls tested</p>
          <div className="flex flex-wrap gap-1.5">
            {integration.controls.map((c: string) => (
              <span key={c} className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs font-mono rounded">{c}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AvailableCard({ integration, orgId, onDemoConnect, connecting }: {
  integration: any; orgId: number; onDemoConnect: () => void; connecting: boolean;
}) {
  const BASE_PATH = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
  const isGitHub = integration.key === "github";

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 hover:border-blue-200 hover:shadow-sm transition-all">
      <div className="flex items-center gap-3 mb-2">
        <IntegrationLogo name={integration.key} />
        <p className="font-semibold text-slate-900">{integration.name}</p>
      </div>
      <p className="text-sm text-slate-500 mb-4 leading-relaxed">{integration.description}</p>
      {integration.controls?.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-4">
          {integration.controls.slice(0, 4).map((c: string) => (
            <span key={c} className="px-1.5 py-0.5 bg-blue-50 text-blue-600 text-xs font-mono rounded">{c}</span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        {isGitHub ? (
          <a href={`${BASE_PATH}/api/integrations/github/connect?orgId=${orgId}`}
            className="flex-1 text-center px-3 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800">
            Connect with GitHub
          </a>
        ) : (
          <button onClick={onDemoConnect} disabled={connecting}
            className="flex-1 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-60">
            {connecting ? "Connecting..." : "Connect (Demo)"}
          </button>
        )}
      </div>
    </div>
  );
}

function IntegrationLogo({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  const sz = size === "sm" ? "h-8 w-8 text-base" : "h-10 w-10 text-xl";
  if (name === "github") {
    return (
      <div className={`${sz} bg-slate-900 rounded-xl flex items-center justify-center flex-shrink-0`}>
        <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
        </svg>
      </div>
    );
  }
  const labels: Record<string, string> = {
    aws: "AWS", okta: "Ok", jira: "Ji", slack: "Sl", crowdstrike: "CS", jamf: "Jm",
    workday: "Wd", "google-workspace": "GW", "azure-ad": "Az", datadog: "DD", pagerduty: "PD",
  };
  const colors: Record<string, string> = {
    aws: "bg-orange-100 text-orange-700", okta: "bg-blue-100 text-blue-700",
    jira: "bg-blue-100 text-blue-700", slack: "bg-purple-100 text-purple-700",
    crowdstrike: "bg-red-100 text-red-700", jamf: "bg-slate-100 text-slate-600",
    workday: "bg-yellow-100 text-yellow-700", "google-workspace": "bg-blue-100 text-blue-700",
    "azure-ad": "bg-blue-100 text-blue-700", datadog: "bg-purple-100 text-purple-700",
    pagerduty: "bg-green-100 text-green-700",
  };
  const textSz = size === "sm" ? "text-xs" : "text-xs";
  return (
    <div className={`${sz} ${colors[name] ?? "bg-slate-100 text-slate-600"} rounded-xl flex items-center justify-center font-bold flex-shrink-0 ${textSz}`}>
      {labels[name] ?? name.slice(0, 2).toUpperCase()}
    </div>
  );
}

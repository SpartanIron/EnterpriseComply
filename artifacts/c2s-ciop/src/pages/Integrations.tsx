import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiUrl } from "@/lib/queryClient";

const BASE_PATH = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

export default function Integrations() {
  const [location] = useLocation();
  const qc = useQueryClient();
  const connected = new URLSearchParams(location.split("?")[1] ?? "").get("connected");

  const { data: orgData } = useQuery<{ org: any }>({
    queryKey: ["orgs", "me"],
    queryFn: async () => (await fetch(apiUrl("/orgs/me"), { credentials: "include" })).json(),
  });
  const orgId = orgData?.org?.id;

  const { data, isLoading, refetch } = useQuery<{ integrations: any[] }>({
    queryKey: ["org-integrations", orgId],
    queryFn: async () => (await fetch(apiUrl(`/orgs/${orgId}/integrations`), { credentials: "include" })).json(),
    enabled: !!orgId,
  });

  const syncMutation = useMutation({
    mutationFn: async (integrationKey: string) => {
      const res = await fetch(apiUrl(`/orgs/${orgId}/integrations/${integrationKey}/sync`), {
        method: "POST",
        credentials: "include",
      });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["org-integrations"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["org-controls"] });
    },
  });

  const integrations = data?.integrations ?? [];
  const connectedIntegrations = integrations.filter(i => i.connection?.status === "connected");
  const availableIntegrations = integrations.filter(i => !i.connection && i.available);
  const comingSoon = integrations.filter(i => !i.connection && !i.available);

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Integrations</h1>
        <p className="text-slate-500 mt-1">Connect your tools to collect compliance evidence automatically</p>
      </div>

      {connected && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
          <svg className="h-5 w-5 text-green-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <p className="text-green-800 text-sm font-semibold">{connected.charAt(0).toUpperCase() + connected.slice(1)} connected successfully! Evidence collection has started.</p>
        </div>
      )}

      {connectedIntegrations.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">Connected</h2>
          <div className="space-y-3">
            {connectedIntegrations.map((i: any) => (
              <ConnectedCard key={i.key} integration={i} onSync={() => syncMutation.mutate(i.key)} syncing={syncMutation.isPending} />
            ))}
          </div>
        </div>
      )}

      {availableIntegrations.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">Available to Connect</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {availableIntegrations.map((i: any) => (
              <AvailableCard key={i.key} integration={i} orgId={orgId} />
            ))}
          </div>
        </div>
      )}

      {comingSoon.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">Coming Soon</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {comingSoon.map((i: any) => (
              <div key={i.key} className="bg-white rounded-xl border border-slate-200 p-4 opacity-60">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-slate-100 rounded-xl flex items-center justify-center text-lg flex-shrink-0">
                    {i.key === "aws" ? "☁️" : i.key === "okta" ? "🔐" : i.key === "jira" ? "📋" : i.key === "slack" ? "💬" : i.key === "crowdstrike" ? "🦅" : i.key === "jamf" ? "📱" : i.key === "workday" ? "👥" : "🔌"}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-700 text-sm">{i.name}</p>
                    <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-500 text-xs rounded-full mt-0.5">Coming soon</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {isLoading && (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-slate-100 rounded-xl animate-pulse" />)}</div>
      )}
    </div>
  );
}

function ConnectedCard({ integration, onSync, syncing }: { integration: any; onSync: () => void; syncing: boolean }) {
  const conn = integration.connection;
  const lastSync = conn?.lastSyncAt ? new Date(conn.lastSyncAt).toLocaleString() : "Never";

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      <div className="flex items-center gap-4">
        <IntegrationLogo name={integration.key} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-slate-900">{integration.name}</p>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
              Connected
            </span>
          </div>
          {conn?.accountLogin && <p className="text-sm text-slate-500 mt-0.5">@{conn.accountLogin}</p>}
          <p className="text-xs text-slate-400 mt-1">Last sync: {lastSync} · {conn?.evidenceCollected ?? 0} evidence items</p>
        </div>
        <button
          onClick={onSync}
          disabled={syncing}
          className="flex-shrink-0 px-4 py-2 border border-slate-200 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
        >
          {syncing ? "Syncing…" : "Sync now"}
        </button>
      </div>
      {integration.controls?.length > 0 && (
        <div className="mt-4 pt-4 border-t border-slate-100">
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

function AvailableCard({ integration, orgId }: { integration: any; orgId: number }) {
  const BASE_PATH = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
  return (
    <a
      href={`${BASE_PATH}/api/integrations/${integration.key}/connect?orgId=${orgId}`}
      className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md hover:border-blue-200 transition-all group block"
    >
      <div className="flex items-center gap-3 mb-3">
        <IntegrationLogo name={integration.key} />
        <p className="font-semibold text-slate-900 group-hover:text-blue-700 transition-colors">{integration.name}</p>
      </div>
      <p className="text-sm text-slate-500 mb-4">{integration.description}</p>
      <div className="flex items-center justify-between">
        <div className="flex flex-wrap gap-1">
          {(integration.controls ?? []).slice(0, 3).map((c: string) => (
            <span key={c} className="px-1.5 py-0.5 bg-blue-50 text-blue-600 text-xs font-mono rounded">{c}</span>
          ))}
        </div>
        <span className="text-blue-600 font-semibold text-sm group-hover:translate-x-0.5 transition-transform">Connect →</span>
      </div>
    </a>
  );
}

function IntegrationLogo({ name }: { name: string }) {
  if (name === "github") {
    return (
      <div className="h-10 w-10 bg-slate-900 rounded-xl flex items-center justify-center flex-shrink-0">
        <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
        </svg>
      </div>
    );
  }
  const emojis: Record<string, string> = { aws: "☁️", okta: "🔐", jira: "📋", slack: "💬", crowdstrike: "🦅", jamf: "📱", workday: "👥", "google-workspace": "🔵", "microsoft-365": "🟦" };
  return (
    <div className="h-10 w-10 bg-slate-100 rounded-xl flex items-center justify-center text-xl flex-shrink-0">
      {emojis[name] ?? "🔌"}
    </div>
  );
}

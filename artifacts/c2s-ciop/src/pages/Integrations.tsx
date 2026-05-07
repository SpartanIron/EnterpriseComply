import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiUrl, apiFetch } from "@/lib/queryClient";
import { useOrg } from "@/hooks/useOrg";

const COMING_SOON_CATALOG = [
  { key: "aws-config", name: "AWS Config", category: "Cloud Security" },
  { key: "aws-guardduty", name: "AWS GuardDuty", category: "Cloud Security" },
  { key: "azure-defender", name: "Microsoft Defender for Cloud", category: "Cloud Security" },
  { key: "gcp-scc", name: "GCP Security Command Center", category: "Cloud Security" },
  { key: "prisma-cloud", name: "Prisma Cloud", category: "CSPM" },
  { key: "orca", name: "Orca Security", category: "CSPM" },
  { key: "lacework", name: "Lacework", category: "CSPM" },
  { key: "github-actions", name: "GitHub Actions", category: "CI/CD" },
  { key: "circleci", name: "CircleCI", category: "CI/CD" },
  { key: "jenkins", name: "Jenkins", category: "CI/CD" },
  { key: "amazon-ecr", name: "Amazon ECR", category: "Container Registry" },
  { key: "google-gcr", name: "Google Container Registry", category: "Container Registry" },
  { key: "kubernetes", name: "Kubernetes", category: "Container Orchestration" },
  { key: "ping", name: "PingIdentity", category: "Identity" },
  { key: "auth0", name: "Auth0", category: "Identity" },
  { key: "sailpoint", name: "SailPoint", category: "IGA" },
  { key: "cyberark", name: "CyberArk", category: "PAM" },
  { key: "beyondtrust", name: "BeyondTrust", category: "PAM" },
  { key: "aws-secrets-manager", name: "AWS Secrets Manager", category: "Secrets Management" },
  { key: "azure-key-vault", name: "Azure Key Vault", category: "Secrets Management" },
  { key: "elastic-siem", name: "Elastic SIEM", category: "SIEM" },
  { key: "veracode", name: "Veracode", category: "Application Security" },
  { key: "checkmarx", name: "Checkmarx", category: "Application Security" },
  { key: "adp", name: "ADP Workforce Now", category: "HRIS" },
  { key: "gusto", name: "Gusto", category: "HRIS" },
  { key: "greenhouse", name: "Greenhouse", category: "Recruiting" },
  { key: "microsoft-teams", name: "Microsoft Teams", category: "Collaboration" },
  { key: "zoom", name: "Zoom", category: "Collaboration" },
  { key: "netsuite", name: "NetSuite", category: "ERP" },
  { key: "zendesk", name: "Zendesk", category: "Customer Support" },
];

const AWS_REGIONS = [
  "us-east-1", "us-east-2", "us-west-1", "us-west-2",
  "eu-west-1", "eu-west-2", "eu-west-3", "eu-central-1",
  "ap-southeast-1", "ap-southeast-2", "ap-northeast-1", "ca-central-1",
];

function AWSConnectModal({ orgId, onClose, onSuccess }: { orgId: number; onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({ accessKeyId: "", secretAccessKey: "", region: "us-east-1" });
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(apiUrl(`/orgs/${orgId}/integrations/aws/connect`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Connection failed");
      return data;
    },
    onSuccess: (data) => {
      onSuccess();
      onClose();
    },
    onError: (err: Error) => setError(err.message),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <span className="text-white text-sm font-bold">AWS</span>
              </div>
              <div>
                <p className="text-white font-bold text-lg">Connect Amazon Web Services</p>
                <p className="text-orange-100 text-sm">Real-time IAM, CloudTrail, S3, and GuardDuty checks</p>
              </div>
            </div>
            <button onClick={onClose} className="text-white/70 hover:text-white">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-sm text-amber-800">
            <p className="font-semibold mb-1">Required IAM permissions</p>
            <p className="text-xs text-amber-700">Create an IAM user with read-only access: <span className="font-mono">iam:GetAccountSummary, iam:GetAccountPasswordPolicy, iam:ListUsers, iam:ListMFADevices, cloudtrail:DescribeTrails, s3:ListBuckets, s3:GetBucketPublicAccessBlock, guardduty:ListDetectors, guardduty:GetDetector</span></p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Access Key ID</label>
            <input
              type="text"
              value={form.accessKeyId}
              onChange={e => setForm(f => ({ ...f, accessKeyId: e.target.value }))}
              placeholder="AKIAIOSFODNN7EXAMPLE"
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Secret Access Key</label>
            <input
              type="password"
              value={form.secretAccessKey}
              onChange={e => setForm(f => ({ ...f, secretAccessKey: e.target.value }))}
              placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Primary Region</label>
            <select
              value={form.region}
              onChange={e => setForm(f => ({ ...f, region: e.target.value }))}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
            >
              {AWS_REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>
          )}
          {mutation.isSuccess && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
              Connected! {(mutation.data as any)?.checksPassed ?? 0} of {(mutation.data as any)?.checksRun ?? 0} checks passed.
            </div>
          )}
          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="flex-1 py-2.5 border border-slate-200 text-slate-600 text-sm font-semibold rounded-xl hover:bg-slate-50">
              Cancel
            </button>
            <button
              onClick={() => mutation.mutate()}
              disabled={!form.accessKeyId || !form.secretAccessKey || mutation.isPending}
              className="flex-1 py-2.5 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              {mutation.isPending ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  Running checks...
                </span>
              ) : "Connect and run checks"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function OktaConnectModal({ orgId, onClose, onSuccess }: { orgId: number; onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({ domain: "", apiToken: "" });
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(apiUrl(`/orgs/${orgId}/integrations/okta/connect`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Connection failed");
      return data;
    },
    onSuccess: () => {
      onSuccess();
      onClose();
    },
    onError: (err: Error) => setError(err.message),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <span className="text-white text-sm font-bold">Ok</span>
              </div>
              <div>
                <p className="text-white font-bold text-lg">Connect Okta</p>
                <p className="text-blue-100 text-sm">MFA enrollment, password policy, and inactive users</p>
              </div>
            </div>
            <button onClick={onClose} className="text-white/70 hover:text-white">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3.5 text-sm text-blue-800">
            <p className="font-semibold mb-1">Create a read-only API token</p>
            <p className="text-xs text-blue-700">In Okta: Security &rarr; API &rarr; Tokens &rarr; Create Token. The token needs read access to users, factors, and policies.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Okta Domain</label>
            <div className="flex">
              <span className="flex items-center px-3 bg-slate-50 border border-r-0 border-slate-200 rounded-l-lg text-sm text-slate-500">https://</span>
              <input
                type="text"
                value={form.domain}
                onChange={e => setForm(f => ({ ...f, domain: e.target.value }))}
                placeholder="yourcompany.okta.com"
                className="flex-1 px-3 py-2.5 border border-slate-200 rounded-r-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">API Token</label>
            <input
              type="password"
              value={form.apiToken}
              onChange={e => setForm(f => ({ ...f, apiToken: e.target.value }))}
              placeholder="SSWS xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>
          )}
          {mutation.isSuccess && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
              Connected! {(mutation.data as any)?.checksPassed ?? 0} of {(mutation.data as any)?.checksRun ?? 0} checks passed.
            </div>
          )}
          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="flex-1 py-2.5 border border-slate-200 text-slate-600 text-sm font-semibold rounded-xl hover:bg-slate-50">
              Cancel
            </button>
            <button
              onClick={() => mutation.mutate()}
              disabled={!form.domain || !form.apiToken || mutation.isPending}
              className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              {mutation.isPending ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  Running checks...
                </span>
              ) : "Connect and run checks"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Integrations() {
  const [location] = useLocation();
  const { orgId } = useOrg();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"catalog" | "health">("catalog");
  const connected = new URLSearchParams(location.split("?")[1] ?? "").get("connected");
  const [showAWSModal, setShowAWSModal] = useState(false);
  const [showOktaModal, setShowOktaModal] = useState(false);

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

  const handleConnect = async (key: string) => {
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
    if (key === "aws") { setShowAWSModal(true); return; }
    if (key === "okta") { setShowOktaModal(true); return; }
    setDemoConnecting(key);
    try {
      await demoConnectMutation.mutateAsync(key);
    } finally {
      setDemoConnecting(null);
    }
  };

  const handleCredentialConnectSuccess = () => {
    qc.invalidateQueries({ queryKey: ["org-integrations"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
    qc.invalidateQueries({ queryKey: ["org-controls"] });
    qc.invalidateQueries({ queryKey: ["evidence"] });
  };

  const integrations = data?.integrations ?? [];
  const connectedList = integrations.filter((i) => i.connection?.status === "connected");
  const availableList = integrations.filter((i) => !i.connection && i.available);
  const apiComingSoon = integrations.filter((i) => !i.connection && !i.available);

  const connectedKeys = new Set(integrations.map(i => i.key));
  const extraComingSoon = COMING_SOON_CATALOG.filter(c => !connectedKeys.has(c.key));
  const comingSoon = [
    ...apiComingSoon,
    ...extraComingSoon.filter(e => !apiComingSoon.some(a => a.key === e.key)),
  ];

  const { data: healthData, isLoading: healthLoading } = useQuery<{ health: any[] }>({
    queryKey: ["integration-health", orgId],
    queryFn: async () => (await fetch(apiUrl(`/orgs/${orgId}/integration-health`), { credentials: "include" })).json(),
    enabled: !!orgId && tab === "health",
  });
  const health = healthData?.health ?? [];

  return (
    <div className="p-6 max-w-screen-xl">
      {showAWSModal && orgId && (
        <AWSConnectModal orgId={orgId} onClose={() => setShowAWSModal(false)} onSuccess={handleCredentialConnectSuccess} />
      )}
      {showOktaModal && orgId && (
        <OktaConnectModal orgId={orgId} onClose={() => setShowOktaModal(false)} onSuccess={handleCredentialConnectSuccess} />
      )}

      <div className="mb-5 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Integrations</h1>
          <p className="text-sm text-slate-500 mt-0.5">Connect your tools to collect compliance evidence automatically</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 mb-6 p-1 bg-slate-100 rounded-xl w-fit">
        {([["catalog", "Integration Catalog"], ["health", "Health Dashboard"]] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${tab === id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          >
            {id === "health" && (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
            )}
            {label}
          </button>
        ))}
      </div>

      {/* Health dashboard tab */}
      {tab === "health" && (
        <div className="space-y-4">
          {healthLoading && (
            <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-32 bg-slate-100 rounded-xl animate-pulse" />)}</div>
          )}
          {!healthLoading && health.length === 0 && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-14 text-center">
              <svg className="h-10 w-10 text-slate-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              <p className="text-sm font-bold text-slate-700">No connected integrations</p>
              <p className="text-xs text-slate-400 mt-1 mb-4">Connect an integration to see health metrics here.</p>
              <button onClick={() => setTab("catalog")} className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700">Browse catalog</button>
            </div>
          )}
          {!healthLoading && health.length > 0 && (
            <>
              <div className="grid grid-cols-3 gap-3 mb-2">
                {[
                  { label: "Connected", value: health.length, color: "text-slate-900" },
                  { label: "Healthy", value: health.filter(h => h.lastSyncStatus === "healthy").length, color: "text-green-600" },
                  { label: "Needs attention", value: health.filter(h => h.lastSyncStatus !== "healthy").length, color: "text-amber-600" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3">
                    <div className={`text-2xl font-extrabold ${color}`}>{value}</div>
                    <div className="text-xs text-slate-500 font-medium mt-0.5">{label}</div>
                  </div>
                ))}
              </div>
              {health.map((h: any) => {
                const statusMap: Record<string, { cls: string; dot: string; label: string }> = {
                  healthy: { cls: "bg-green-50 text-green-700 ring-1 ring-green-200", dot: "bg-green-500", label: "Healthy" },
                  stale:   { cls: "bg-amber-50 text-amber-700 ring-1 ring-amber-200", dot: "bg-amber-400", label: "Stale" },
                  error:   { cls: "bg-red-50 text-red-700 ring-1 ring-red-200", dot: "bg-red-500", label: "Error" },
                  never:   { cls: "bg-slate-100 text-slate-500 ring-1 ring-slate-200", dot: "bg-slate-300", label: "Never synced" },
                };
                const sc = statusMap[h.lastSyncStatus] ?? statusMap.never;
                return (
                  <div key={h.key} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div className="flex items-center gap-3">
                        <IntegrationLogo name={h.key} />
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-slate-900 text-sm">{h.name}</p>
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${sc.cls}`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${sc.dot}`} />
                              {sc.label}
                            </span>
                          </div>
                          {h.accountLogin && <p className="text-xs text-slate-400 mt-0.5">@{h.accountLogin}</p>}
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {[
                        { label: "Evidence Collected", value: h.evidenceCollected ?? 0, color: "text-blue-600" },
                        { label: "Last Sync", value: h.lastSyncAt ? new Date(h.lastSyncAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "Never", color: "text-slate-700" },
                        { label: "Sync Status", value: sc.label, color: h.lastSyncStatus === "healthy" ? "text-green-600" : "text-amber-600" },
                        { label: "Next Sync", value: h.nextSyncAt ? new Date(h.nextSyncAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "Scheduled", color: "text-slate-500" },
                      ].map(({ label, value, color }) => (
                        <div key={label} className="bg-slate-50 rounded-lg px-3 py-2.5">
                          <div className={`text-sm font-bold ${color} leading-tight`}>{value}</div>
                          <div className="text-xs text-slate-400 mt-0.5">{label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}

      {tab === "catalog" && connected && (
        <div className="mb-5 bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
          <svg className="h-5 w-5 text-green-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <p className="text-green-800 text-sm font-semibold capitalize">{connected} connected! Evidence collection has started.</p>
        </div>
      )}

      {tab === "catalog" && isLoading && (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-slate-100 rounded-xl animate-pulse" />)}</div>
      )}

      {tab === "catalog" && connectedList.length > 0 && (
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

      {tab === "catalog" && availableList.length > 0 && (
        <div className="mb-7">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Available to Connect ({availableList.length})</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {availableList.map((i: any) => (
              <AvailableCard key={i.key} integration={i} orgId={orgId}
                onConnect={() => handleConnect(i.key)}
                connecting={demoConnecting === i.key} />
            ))}
          </div>
        </div>
      )}

      {tab === "catalog" && comingSoon.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Coming Soon ({comingSoon.length})</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {comingSoon.map((i: any) => (
              <div key={i.key} className="bg-white rounded-xl border border-slate-200 p-4 opacity-60">
                <div className="flex items-center gap-3">
                  <IntegrationLogo name={i.key} size="sm" />
                  <div className="min-w-0">
                    <p className="font-medium text-slate-700 text-sm truncate">{i.name}</p>
                    <p className="text-xs text-slate-400 mt-0.5 truncate">{i.category}</p>
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
  const isRealIntegration = ["github", "aws", "okta"].includes(integration.key);

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
            {isRealIntegration && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 text-xs font-semibold rounded-full ring-1 ring-blue-200">
                Live
              </span>
            )}
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

function AvailableCard({ integration, orgId, onConnect, connecting }: {
  integration: any; orgId: number; onConnect: () => void; connecting: boolean;
}) {
  const BASE_PATH = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
  const isGitHub = integration.key === "github";
  const isCredentials = integration.connectType === "credentials";

  const btnLabel = isCredentials
    ? `Connect ${integration.key === "aws" ? "AWS" : "Okta"}`
    : connecting ? "Connecting..." : "Connect (Demo)";

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 hover:border-blue-200 hover:shadow-sm transition-all">
      <div className="flex items-center gap-3 mb-2">
        <IntegrationLogo name={integration.key} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-slate-900">{integration.name}</p>
            {isCredentials && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-50 text-blue-700 text-xs font-semibold rounded ring-1 ring-blue-200">Live checks</span>
            )}
          </div>
        </div>
      </div>
      <p className="text-sm text-slate-500 mb-4 leading-relaxed">{integration.description}</p>
      {integration.controls?.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-4">
          {integration.controls.slice(0, 4).map((c: string) => (
            <span key={c} className="px-1.5 py-0.5 bg-blue-50 text-blue-600 text-xs font-mono rounded">{c}</span>
          ))}
          {integration.controls.length > 4 && (
            <span className="px-1.5 py-0.5 bg-slate-100 text-slate-400 text-xs rounded">+{integration.controls.length - 4} more</span>
          )}
        </div>
      )}
      <div className="flex gap-2">
        {isGitHub ? (
          <a href={`${BASE_PATH}/api/integrations/github/connect?orgId=${orgId}`}
            className="flex-1 text-center px-3 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800">
            Connect with GitHub
          </a>
        ) : (
          <button onClick={onConnect} disabled={connecting}
            className={`flex-1 px-3 py-2 text-white text-sm font-medium rounded-lg disabled:opacity-60 transition-colors ${
              isCredentials
                ? "bg-blue-600 hover:bg-blue-700"
                : "bg-blue-600 hover:bg-blue-700"
            }`}>
            {btnLabel}
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
    servicenow: "SN", qualys: "Ql", tenable: "Tn", splunk: "Sp", sentinelone: "S1",
    duo: "Duo", ping: "PI", sailpoint: "SP", cyberark: "CA", "hashicorp-vault": "HV",
    snyk: "Sk", veracode: "Ve", knowbe4: "KB", proofpoint: "PP", "microsoft-365": "M365",
    zendesk: "Zd", bamboohr: "BH", greenhouse: "GH", netsuite: "NS",
  };
  const colors: Record<string, string> = {
    aws: "bg-orange-100 text-orange-700", okta: "bg-blue-100 text-blue-700",
    jira: "bg-blue-100 text-blue-700", slack: "bg-purple-100 text-purple-700",
    crowdstrike: "bg-red-100 text-red-700", jamf: "bg-slate-100 text-slate-600",
    workday: "bg-yellow-100 text-yellow-700", "google-workspace": "bg-blue-100 text-blue-700",
    "azure-ad": "bg-blue-100 text-blue-700", datadog: "bg-purple-100 text-purple-700",
    pagerduty: "bg-green-100 text-green-700", servicenow: "bg-green-100 text-green-700",
    qualys: "bg-red-100 text-red-700", tenable: "bg-blue-100 text-blue-700",
    splunk: "bg-orange-100 text-orange-700", sentinelone: "bg-indigo-100 text-indigo-700",
    duo: "bg-green-100 text-green-700", sailpoint: "bg-blue-100 text-blue-700",
    cyberark: "bg-red-100 text-red-700", snyk: "bg-violet-100 text-violet-700",
    knowbe4: "bg-orange-100 text-orange-700", "microsoft-365": "bg-blue-100 text-blue-700",
  };
  const textSz = size === "sm" ? "text-xs" : "text-xs";
  return (
    <div className={`${sz} ${colors[name] ?? "bg-slate-100 text-slate-600"} rounded-xl flex items-center justify-center font-bold flex-shrink-0 ${textSz}`}>
      {labels[name] ?? name.slice(0, 2).toUpperCase()}
    </div>
  );
}

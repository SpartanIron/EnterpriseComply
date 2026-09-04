import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiUrl, apiFetch } from "@/lib/queryClient";
import { useOrg } from "@/hooks/useOrg";
import { useRole } from "@/context/RoleContext";
import { authClient } from "@/lib/auth-client";
import { QRCodeSVG } from "qrcode.react";
import RoleManagement from "./RoleManagement";
import MemberMfaAdmin from "@/components/MemberMfaAdmin";
import PlanGate, {
  PLAN_LABELS,
  PLAN_DESCRIPTIONS,
  PLAN_HIERARCHY,
  type PlanTier,
} from "@/components/PlanGate";

const PLAN_BASE_PATH = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

interface MfaStatus {
  enrolled: boolean;
  enrolledAt: string | null;
  backupCodesTotal: number;
  backupCodesRemaining: number;
  setupExpiresAt: string | null;
}

interface MfaPolicy {
  enforced: boolean;
  enforcedAt: string | null;
  graceDays: number;
  graceEndsAt: string | null;
  members: number;
  enrolled: number;
  coveragePct: number;
  control: string;
}

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map(r => r.map(c => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

const INDUSTRIES = ["Technology","Healthcare","Finance","Government","Retail","Manufacturing","Education","Other"];
const SIZES = ["1-10","11-50","51-200","201-500","501-1000","1000+"];

export default function Settings() {
  const qc = useQueryClient();
  const { orgId } = useOrg();
  const { can } = useRole();
  const [activeTab, setActiveTab] = useState<"general"|"security"|"roles">("general");

  const { data: orgData } = useQuery<{ org: any }>({
    queryKey: ["orgs", "me"],
    queryFn: async () => (await fetch(apiUrl("/orgs/me"), { credentials: "include" })).json(),
  });

  const org = orgData?.org;

  // Tier shown in the Plan panel. Falls back to starter for the same reason
  // PlanGate does: an org row that predates the column reads as the free tier
  // rather than accidentally unlocking everything.
  const currentPlan = ((org?.plan as PlanTier) ?? "starter") as PlanTier;
  const lockedTiers = (Object.keys(PLAN_HIERARCHY) as PlanTier[])
    .filter((tier) => PLAN_HIERARCHY[tier] > (PLAN_HIERARCHY[currentPlan] ?? 0))
    .sort((a, b) => PLAN_HIERARCHY[a] - PLAN_HIERARCHY[b]);
  const [form, setForm] = useState<any>(null);
  const [saved, setSaved] = useState(false);

  if (org && !form) {
    setForm({ name: org.name, industry: org.industry, size: org.size, website: org.website ?? "" });
  }

  const isDirty = form && (
    form.name !== org?.name ||
    form.industry !== org?.industry ||
    form.size !== org?.size ||
    form.website !== (org?.website ?? "")
  );

  const saveMutation = useMutation({
    mutationFn: () => apiFetch(`/orgs/${orgId}`, { method: "PATCH", body: JSON.stringify(form) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orgs", "me"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900 leading-tight">Settings</h1>
        <p className="text-sm text-slate-500 mt-0.5">Manage your organization settings</p>
      </div>

      <div className="flex items-center gap-1 mb-6 bg-slate-100 rounded-xl p-1 w-fit">
        <button onClick={() => setActiveTab("general")} className={"px-4 py-2 rounded-lg text-sm font-semibold transition-all " + (activeTab === "general" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700")}>General</button>
        <button onClick={() => setActiveTab("security")} className={"px-4 py-2 rounded-lg text-sm font-semibold transition-all " + (activeTab === "security" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700")}>Security</button>
        {can("admin") && <button onClick={() => setActiveTab("roles")} className={"px-4 py-2 rounded-lg text-sm font-semibold transition-all " + (activeTab === "roles" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700")}>Users &amp; Roles</button>}
      </div>

      {activeTab === "roles" && can("admin") && <RoleManagement />}
      {activeTab === "security" && <SecurityTab />}

      {activeTab === "general" && (
        <div>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm mb-4">
            <div className="px-5 py-3.5 border-b border-slate-100"><h2 className="text-sm font-bold text-slate-800">Organization</h2></div>
            <div className="p-5 space-y-4">
              {form && (
                <>
                  <div><label className="block text-sm font-medium text-slate-700 mb-1.5">Organization name</label><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-sm font-medium text-slate-700 mb-1.5">Industry</label><select value={form.industry ?? ""} onChange={e => setForm({ ...form, industry: e.target.value })} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"><option value="">Select industry</option>{INDUSTRIES.map(i => <option key={i}>{i}</option>)}</select></div>
                    <div><label className="block text-sm font-medium text-slate-700 mb-1.5">Company size</label><select value={form.size ?? ""} onChange={e => setForm({ ...form, size: e.target.value })} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"><option value="">Select size</option>{SIZES.map(s => <option key={s}>{s}</option>)}</select></div>
                  </div>
                  <div><label className="block text-sm font-medium text-slate-700 mb-1.5">Website</label><input value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="https://..." /></div>
                  <button onClick={() => saveMutation.mutate()} disabled={!isDirty || saveMutation.isPending} className="px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">{saveMutation.isPending ? "Saving..." : saved ? "Saved" : "Save changes"}</button>
                </>
              )}
            </div>
          </div>

          {/* Plan. Both the label and the copy come from the shared vocabulary in
              PlanGate, so this panel cannot claim a tier includes something the
              guards actually withhold. The previous copy asserted that every tier
              included "all frameworks, integrations, and core features" while the
              Federal and Enterprise sections sat behind padlocks. */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm mb-4">
            <div className="px-5 py-3.5 border-b border-slate-100"><h2 className="text-sm font-bold text-slate-800">Plan</h2></div>
            <div className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold text-slate-900">{PLAN_LABELS[currentPlan]} Plan</p>
                  <p className="text-sm text-slate-500 mt-0.5">{PLAN_DESCRIPTIONS[currentPlan]}</p>
                </div>
                <span className="shrink-0 px-3 py-1.5 bg-blue-100 text-blue-700 text-sm font-semibold rounded-full">Current plan</span>
              </div>
              {lockedTiers.length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <p className="text-sm text-slate-600">
                    Not included on {PLAN_LABELS[currentPlan]}:{" "}
                    {lockedTiers.map((tier) => PLAN_LABELS[tier]).join(", ")}.
                  </p>
                  <ul className="mt-2 space-y-1">
                    {lockedTiers.map((tier) => (
                      <li key={tier} className="text-sm text-slate-500">
                        <span className="font-medium text-slate-700">{PLAN_LABELS[tier]}</span>{" "}
                        {PLAN_DESCRIPTIONS[tier]}
                      </li>
                    ))}
                  </ul>
                  <a
                    href={`${PLAN_BASE_PATH}/pricing`}
                    className="inline-block mt-3 text-sm font-semibold text-blue-600 hover:text-blue-700"
                  >
                    Compare plans
                  </a>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm mb-4">
            <div className="px-5 py-3.5 border-b border-slate-100"><h2 className="text-sm font-bold text-slate-800">Organization Details</h2></div>
            <div className="p-5 space-y-3 text-sm">
              <div className="flex items-center justify-between"><span className="text-slate-500">Organization ID</span><span className="font-mono text-slate-700 text-xs bg-slate-100 px-2 py-1 rounded">{org?.id}</span></div>
              <div className="flex items-center justify-between"><span className="text-slate-500">Slug</span><span className="font-mono text-slate-700 text-xs bg-slate-100 px-2 py-1 rounded">{org?.slug}</span></div>
              <div className="flex items-center justify-between"><span className="text-slate-500">Created</span><span className="text-slate-700">{org?.createdAt ? new Date(org.createdAt).toLocaleDateString() : "-"}</span></div>
            </div>
          </div>

          <DataPortabilityExport orgId={orgId} />
        </div>
      )}
    </div>
  );
}

function SecurityTab() {
  const session = authClient.useSession();
  const user = session.data?.user as any;
  const mfaEnrolledFromSession = !!user?.twoFactorEnabled;
  const { orgId } = useOrg();
  const qc = useQueryClient();
  const { can } = useRole();

  // Enrolment state comes from the API, not from the session object. The session copy
  // of twoFactorEnabled is cached for minutes at a time, so it lags behind reality
  // right after somebody enrols or removes their authenticator app.
  const mfaStatus = useQuery<MfaStatus>({
    queryKey: ["mfa", "status"],
    queryFn: () => apiFetch("/mfa/status"),
  });

  // The org policy has its own endpoint. The general org PATCH whitelists only
  // name/industry/size/website, so the old toggle dropped mfaEnforced on the floor
  // and still reported success.
  const mfaPolicy = useQuery<MfaPolicy>({
    queryKey: ["mfa", "policy", orgId],
    queryFn: () => apiFetch(`/orgs/${orgId}/mfa-policy`),
    enabled: !!orgId,
  });

  const mfaPolicyMutation = useMutation({
    mutationFn: (enforced: boolean) =>
      apiFetch(`/orgs/${orgId}/mfa-policy`, {
        method: "PATCH",
        body: JSON.stringify({ enforced }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mfa", "policy", orgId] });
      qc.invalidateQueries({ queryKey: ["orgs", "me"] });
      setSecSaved(true);
      setTimeout(() => setSecSaved(false), 2500);
    },
  });

  const { data: orgData } = useQuery<{ org: any }>({
    queryKey: ["orgs", "me"],
    queryFn: async () => (await fetch(apiUrl("/orgs/me"), { credentials: "include" })).json(),
  });
  const org = orgData?.org;

  const twoFactorEnabled = mfaStatus.data ? mfaStatus.data.enrolled : mfaEnrolledFromSession;
  const mfaEnforcedNow = mfaPolicy.data ? mfaPolicy.data.enforced : !!(org as any)?.mfaEnforced;

  const [secSaved, setSecSaved] = useState(false);
  const [retentionSaved, setRetentionSaved] = useState(false);

  // Audit log retention — dedicated enterprise-gated endpoint (P1-07).
  // PATCH /orgs/:orgId/audit-retention requires enterprise+ plan.
  const retentionMutation = useMutation({
    mutationFn: (auditRetentionDays: number) =>
      apiFetch(`/orgs/${orgId}/audit-retention`, {
        method: "PATCH",
        body: JSON.stringify({ auditRetentionDays }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orgs", "me"] });
      setRetentionSaved(true);
      setTimeout(() => setRetentionSaved(false), 2500);
    },
  });

  const [setupStep, setSetupStep] = useState<"idle" | "scanning" | "verifying" | "done" | "disabling">("idle");
  const [totpUri, setTotpUri] = useState<string>("");
  const [verifyCode, setVerifyCode] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [codesCopied, setCodesCopied] = useState(false);

  // ── SSO / SAML form state ────────────────────────────────────────────────────
  const [ssoProvider,       setSsoProvider]       = useState("");
  const [ssoDomain,         setSsoDomain]         = useState("");
  const [idpEntityId,       setIdpEntityId]       = useState("");
  const [idpSsoUrl,         setIdpSsoUrl]         = useState("");
  const [idpCertificate,    setIdpCertificate]    = useState("");
    // Configuration method (Enterprise SSO upgrade)
    const [configMethod, setConfigMethod] = useState<"manual" | "upload" | "url">("manual");
    const [metadataUrl, setMetadataUrl] = useState("");
    const [metadataFetching, setMetadataFetching] = useState(false);
    const [metadataError, setMetadataError] = useState("");
    const [metadataNote, setMetadataNote] = useState("");
    // SAML settings additions
    const [idpSloUrl, setIdpSloUrl] = useState("");
    const [nameIdFormat, setNameIdFormat] = useState("urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress");
    const [requestedAuthnContext, setRequestedAuthnContext] = useState("");
    const [wantAssertionsSigned, setWantAssertionsSigned] = useState(true);
    const [wantAuthnResponseSigned, setWantAuthnResponseSigned] = useState(false);
    // User provisioning
    const [jitProvisioningEnabled, setJitProvisioningEnabled] = useState(true);
    const [scimEnabled, setScimEnabled] = useState(false);
    const [disableLocalPasswordLogin, setDisableLocalPasswordLogin] = useState(false);
    // Attribute mapping
    const [attrEmail, setAttrEmail] = useState("");
    const [attrFirstName, setAttrFirstName] = useState("");
    const [attrLastName, setAttrLastName] = useState("");
    const [attrDisplayName, setAttrDisplayName] = useState("");
    const [attrGroups, setAttrGroups] = useState("");
    const [attrDepartment, setAttrDepartment] = useState("");
    // Security
    const [clockSkewToleranceMs, setClockSkewToleranceMs] = useState(5000);
    const [sessionLifetimeMinutes, setSessionLifetimeMinutes] = useState(480);
    const [certNotAfter, setCertNotAfter] = useState<string | null>(null);
    const [certExpiresInDays, setCertExpiresInDays] = useState<number | null>(null);
  const [ssoSaved,          setSsoSaved]          = useState(false);
  const [ssoError,          setSsoError]          = useState("");
  const [ssoInitialized,    setSsoInitialized]    = useState(false);
  const [groupMappings,     setGroupMappings]     = useState<{ group: string; role: string }[]>([]);
  const [ssoTestNote,       setSsoTestNote]       = useState(false);
  const [ssoTestBanner,     setSsoTestBanner]     = useState<{ type: "success" | "error"; message: string } | null>(null);

  const { data: ssoConfigData } = useQuery<{ configured: boolean; config: any; sp: { entityId: string; acsUrl: string } } | null>({
    queryKey: ["orgs", orgId, "sso-config"],
    queryFn: async () => {
      if (!orgId) return null;
      const res = await fetch(apiUrl(`/orgs/${orgId}/sso/config`), { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!orgId,
  });

  useEffect(() => {
    if (ssoConfigData?.config && !ssoInitialized) {
      setSsoProvider(ssoConfigData.config.provider ?? "");
      setSsoDomain(ssoConfigData.config.domain ?? "");
      setIdpEntityId(ssoConfigData.config.idpEntityId ?? "");
      setIdpSsoUrl(ssoConfigData.config.idpSsoUrl ?? "");
      setIdpCertificate(ssoConfigData.config.idpCertificate ?? "");
            const c: any = ssoConfigData.config;
            setConfigMethod((c.configMethod as "manual" | "upload" | "url") ?? "manual");
            setMetadataUrl(c.metadataUrl ?? "");
            setIdpSloUrl(c.idpSloUrl ?? "");
            setNameIdFormat(c.nameIdFormat ?? "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress");
            setRequestedAuthnContext(c.requestedAuthnContext ?? "");
            setWantAssertionsSigned(c.wantAssertionsSigned ?? true);
            setWantAuthnResponseSigned(c.wantAuthnResponseSigned ?? false);
            setJitProvisioningEnabled(c.jitProvisioningEnabled ?? true);
            setScimEnabled(c.scimEnabled ?? false);
            setDisableLocalPasswordLogin(c.disableLocalPasswordLogin ?? false);
            const am = c.attributeMapping ?? {};
            setAttrEmail(am.email ?? "");
            setAttrFirstName(am.firstName ?? "");
            setAttrLastName(am.lastName ?? "");
            setAttrDisplayName(am.displayName ?? "");
            setAttrGroups(am.groups ?? "");
            setAttrDepartment(am.department ?? "");
            setClockSkewToleranceMs(c.clockSkewToleranceMs ?? 5000);
            setSessionLifetimeMinutes(c.sessionLifetimeMinutes ?? 480);
            setCertNotAfter(c.certNotAfter ?? null);
            setCertExpiresInDays(typeof c.certExpiresInDays === "number" ? c.certExpiresInDays : null);
      const mappings = ssoConfigData.config.samlGroupMappings ?? {};
      setGroupMappings(
        Object.entries(mappings).map(([group, role]) => ({ group, role: role as string }))
      );
      setSsoInitialized(true);
    }
  }, [ssoConfigData, ssoInitialized]);

  const ssoMutation = useMutation({
    mutationFn: () => {
      const samlGroupMappings = groupMappings.reduce<Record<string, string>>((acc, { group, role }) => {
        if (group.trim()) acc[group.trim()] = role;
        return acc;
      }, {});
      return apiFetch(`/orgs/${orgId}/sso/config`, {
        method: "POST",
                body: JSON.stringify({
                            provider: ssoProvider, domain: ssoDomain, idpEntityId, idpSsoUrl, idpCertificate, samlGroupMappings,
                            configMethod, metadataUrl: metadataUrl || undefined,
                            idpSloUrl: idpSloUrl || undefined, nameIdFormat, requestedAuthnContext: requestedAuthnContext || undefined,
                            wantAssertionsSigned, wantAuthnResponseSigned,
                            jitProvisioningEnabled, scimEnabled, disableLocalPasswordLogin,
                            attributeMapping: {
                                          ...(attrEmail.trim() ? { email: attrEmail.trim() } : {}),
                                          ...(attrFirstName.trim() ? { firstName: attrFirstName.trim() } : {}),
                                          ...(attrLastName.trim() ? { lastName: attrLastName.trim() } : {}),
                                          ...(attrDisplayName.trim() ? { displayName: attrDisplayName.trim() } : {}),
                                          ...(attrGroups.trim() ? { groups: attrGroups.trim() } : {}),
                                          ...(attrDepartment.trim() ? { department: attrDepartment.trim() } : {}),
                            },
                            clockSkewToleranceMs, sessionLifetimeMinutes,
                }),
      });
    },
    onSuccess: () => {
      setSsoSaved(true);
      setSsoError("");
      qc.invalidateQueries({ queryKey: ["orgs", orgId, "sso-config"] });
      setTimeout(() => setSsoSaved(false), 3000);
    },
    onError: (err: any) => {
      setSsoError(err?.message ?? "Failed to save SSO configuration");
    },
  });

    // -- Configuration Method: "Upload IdP Metadata XML" / "Metadata URL" ------
    // Calls the parse-metadata endpoint and pre-fills the manual SAML fields.
    // Does not save anything by itself -- the admin still reviews and clicks
    // "Save SSO Configuration".
    const parseMetadataMutation = useMutation({
          mutationFn: (input: { xml?: string; url?: string }) =>
                  apiFetch(`/orgs/${orgId}/sso/parse-metadata`, {
                            method: "POST",
                            body: JSON.stringify(input),
                  }),
          onSuccess: (data: { idpEntityId: string | null; idpSsoUrl: string | null; idpSloUrl: string | null; idpCertificate: string | null }) => {
                  if (data.idpEntityId) setIdpEntityId(data.idpEntityId);
                  if (data.idpSsoUrl) setIdpSsoUrl(data.idpSsoUrl);
                  if (data.idpSloUrl) setIdpSloUrl(data.idpSloUrl);
                  if (data.idpCertificate) setIdpCertificate(data.idpCertificate);
                  setMetadataError("");
                  setMetadataNote("Metadata parsed -- review the fields below, then save.");
          },
          onError: (err: any) => {
                  setMetadataError(err?.message ?? "Could not parse that metadata");
                  setMetadataNote("");
          },
    });

      function handleMetadataFileUpload(e: { target: { files: FileList | null } }) {
          const file = e.target.files?.[0];
          if (!file) return;
          setMetadataFetching(true);
          const reader = new FileReader();
          reader.onload = () => {
                  setMetadataFetching(false);
                  parseMetadataMutation.mutate({ xml: String(reader.result ?? "") });
          };
          reader.onerror = () => {
                  setMetadataFetching(false);
                  setMetadataError("Could not read that file");
          };
          reader.readAsText(file);
    }

    function handleMetadataUrlFetch() {
          if (!metadataUrl.trim()) return;
          setMetadataFetching(true);
          parseMetadataMutation.mutate(
            { url: metadataUrl.trim() },
            { onSettled: () => setMetadataFetching(false) },
                );
    }

  // ── SSO test: check query params on mount ───────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ssoVerified = params.get("sso_verified");
    const ssoErrParam = params.get("error");
    if (sessionStorage.getItem("ssoTestPending")) {
      sessionStorage.removeItem("ssoTestPending");
      if (ssoVerified !== null) {
        setSsoTestBanner({ type: "success", message: "SSO connection verified ✓" });
      } else if (ssoErrParam) {
        setSsoTestBanner({ type: "error", message: `SSO test failed: ${ssoErrParam}` });
      }
      // Clean up URL params
      if (ssoVerified !== null || ssoErrParam) {
        const url = new URL(window.location.href);
        url.searchParams.delete("sso_verified");
        url.searchParams.delete("error");
        window.history.replaceState({}, "", url.toString());
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (twoFactorEnabled) setSetupStep("idle");
  }, [twoFactorEnabled]);

  async function startSetup() {
    setError("");
    setLoading(true);
    try {
      const data = await apiFetch("/mfa/totp/start", { method: "POST" });
      setTotpUri(data.otpauthUri);
      setBackupCodes([]);
      setCodesCopied(false);
      setSetupStep("scanning");
    } catch (err: any) {
      setError(err?.message || "Could not start setup. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function verifyAndEnable() {
    setError("");
    setLoading(true);
    try {
      const data = await apiFetch("/mfa/totp/confirm", {
        method: "POST",
        body: JSON.stringify({ code: verifyCode }),
      });
      setBackupCodes(Array.isArray(data?.backupCodes) ? data.backupCodes : []);
      setVerifyCode("");
      setTotpUri("");
      setSetupStep("done");
      await mfaStatus.refetch();
      await session.refetch();
      qc.invalidateQueries({ queryKey: ["mfa", "policy", orgId] });
    } catch (err: any) {
      setError(err?.message || "That code did not match. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function disableTotp() {
    setError("");
    setLoading(true);
    try {
      await apiFetch("/mfa/totp/disable", {
        method: "POST",
        body: JSON.stringify({ code: disableCode }),
      });
      setDisableCode("");
      setBackupCodes([]);
      setSetupStep("idle");
      await mfaStatus.refetch();
      await session.refetch();
      qc.invalidateQueries({ queryKey: ["mfa", "policy", orgId] });
    } catch (err: any) {
      setError(err?.message || "That code is not valid, so nothing was changed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Authenticator App Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <svg className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800">Authenticator App (2FA)</h2>
              <p className="text-xs text-slate-500 mt-0.5">Google Authenticator, Authy, 1Password, or any TOTP app</p>
            </div>
          </div>
          <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${twoFactorEnabled ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-500"}`}>
            {twoFactorEnabled ? "Enabled" : "Not enabled"}
          </span>
        </div>

        <div className="p-5">
          {/* Idle - not enabled */}
          {setupStep === "idle" && !twoFactorEnabled && (
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <p className="text-sm text-slate-600 leading-relaxed">
                  Add an extra layer of security. After signing in with a magic link, you'll also be asked for a time-based one-time code from your authenticator app.
                </p>
                <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <svg className="h-3.5 w-3.5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    Works offline
                  </span>
                  <span className="flex items-center gap-1.5">
                    <svg className="h-3.5 w-3.5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    FedRAMP recommended
                  </span>
                  <span className="flex items-center gap-1.5">
                    <svg className="h-3.5 w-3.5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    Phishing resistant
                  </span>
                </div>
              </div>
              <button
                onClick={startSetup}
                disabled={loading}
                className="flex-shrink-0 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {loading ? "Loading..." : "Set up"}
              </button>
            </div>
          )}

          {/* Enabled - show disable option */}
          {twoFactorEnabled && setupStep !== "disabling" && (
            <div>
              <div className="flex items-center gap-3 mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                <svg className="h-5 w-5 text-green-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <div>
                  <p className="text-sm font-semibold text-green-800">Authenticator app is active</p>
                  <p className="text-xs text-green-700 mt-0.5">Your account is protected by two-factor authentication.</p>
                </div>
              </div>
              <button
                onClick={() => { setSetupStep("disabling"); setError(""); }}
                className="text-sm text-red-600 hover:text-red-700 font-medium"
              >
                Remove authenticator app
              </button>
            </div>
          )}

          {/* Disable flow */}
          {setupStep === "disabling" && (
            <div className="space-y-3">
              <p className="text-sm text-slate-600">Enter the current 6-digit code from your authenticator app to remove it.</p>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={disableCode}
                onChange={e => setDisableCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="w-40 px-3.5 py-2.5 rounded-lg border border-slate-300 text-center text-xl font-mono tracking-widest text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                placeholder="000000"
                autoFocus
              />
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex items-center gap-3">
                <button
                  onClick={disableTotp}
                  disabled={loading || disableCode.length !== 6}
                  className="px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  {loading ? "Removing..." : "Remove 2FA"}
                </button>
                <button
                  onClick={() => { setSetupStep("idle"); setDisableCode(""); setError(""); }}
                  className="px-4 py-2 border border-slate-200 text-sm font-medium text-slate-600 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {error && setupStep === "idle" && (
            <p className="mt-3 text-sm text-red-600">{error}</p>
          )}

          {/* Step 1 - Scan QR */}
          {setupStep === "scanning" && totpUri && (
            <div className="space-y-5">
              <div>
                <p className="text-sm font-semibold text-slate-800 mb-1">Step 1 - Scan this QR code</p>
                <p className="text-xs text-slate-500 mb-4">Open your authenticator app (Google Authenticator, Authy, 1Password, etc.) and scan the code below.</p>
                <div className="flex justify-center">
                  <div className="p-4 bg-white border-2 border-slate-200 rounded-xl inline-block">
                    <QRCodeSVG value={totpUri} size={180} level="M" />
                  </div>
                </div>
                <div className="mt-3">
                  <p className="text-xs text-slate-500 mb-1 font-medium">Or enter this code manually:</p>
                  <code className="block text-xs font-mono bg-slate-100 text-slate-700 px-3 py-2 rounded-lg break-all">
                    {totpUri.match(/secret=([^&]+)/)?.[1] ?? ""}
                  </code>
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800 mb-1">Step 2 - Enter the 6-digit code</p>
                <p className="text-xs text-slate-500 mb-3">After scanning, your app will show a 6-digit code. Enter it below to confirm setup.</p>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={verifyCode}
                  onChange={e => setVerifyCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="w-44 px-3.5 py-3 rounded-lg border border-slate-300 text-center text-2xl font-mono tracking-[0.4em] text-slate-900 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                  placeholder="000000"
                  autoComplete="one-time-code"
                />
                {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
                <div className="flex items-center gap-3 mt-3">
                  <button
                    onClick={verifyAndEnable}
                    disabled={loading || verifyCode.length !== 6}
                    className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {loading ? "Verifying..." : "Activate"}
                  </button>
                  <button
                    onClick={() => { setSetupStep("idle"); setTotpUri(""); setVerifyCode(""); setError(""); }}
                    className="px-4 py-2 border border-slate-200 text-sm font-medium text-slate-600 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Done */}
          {setupStep === "done" && (
            <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
              <svg className="h-5 w-5 text-green-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <p className="text-sm font-semibold text-green-800">Authenticator app enabled successfully! Your account is now protected.</p>
            </div>
          )}

          {/* Backup codes. Shown once, immediately after enrolment. */}
          {backupCodes.length > 0 && (
            <div className="mt-4 p-4 border border-amber-200 bg-amber-50 rounded-lg">
              <p className="text-sm font-bold text-amber-900">Save your backup codes now</p>
              <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                These are shown once and never again. Each one works a single time, in place of a code from your app. Keep them somewhere you can reach without your phone, because they are how you get back in if you lose it.
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {backupCodes.map((c) => (
                  <code key={c} className="text-xs font-mono bg-white border border-amber-200 rounded px-2 py-1.5 text-slate-800 text-center">
                    {c}
                  </code>
                ))}
              </div>
              <button
                onClick={() => { navigator.clipboard.writeText(backupCodes.join("\n")); setCodesCopied(true); }}
                className="mt-3 px-3 py-1.5 text-xs font-semibold text-amber-900 border border-amber-300 rounded-lg hover:bg-amber-100 transition-colors"
              >
                {codesCopied ? "Copied" : "Copy all"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Sign-in methods */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="px-5 py-3.5 border-b border-slate-100">
          <h2 className="text-sm font-bold text-slate-800">Sign-in Methods</h2>
          <p className="text-xs text-slate-500 mt-0.5">How you currently access your account</p>
        </div>
        <div className="p-5 space-y-3">
          <div className="flex items-center justify-between py-2.5 border-b border-slate-50">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center">
                <svg className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">Magic link</p>
                <p className="text-xs text-slate-500">Passwordless email sign-in</p>
              </div>
            </div>
            <span className="px-2.5 py-1 bg-green-50 text-green-700 text-xs font-bold rounded-full">Active</span>
          </div>
          <div className="flex items-center justify-between py-2.5">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center">
                <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">Authenticator app (TOTP)</p>
                <p className="text-xs text-slate-500">Second factor on sign-in</p>
              </div>
            </div>
            <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${twoFactorEnabled ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-400"}`}>
              {twoFactorEnabled ? "Active" : "Inactive"}
            </span>
          </div>
        </div>
      </div>

      {/* Session info */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="px-5 py-3.5 border-b border-slate-100">
          <h2 className="text-sm font-bold text-slate-800">Account</h2>
        </div>
        <div className="p-5 space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Email</span>
            <span className="text-slate-800 font-medium">{(session.data?.user as any)?.email ?? "-"}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Name</span>
            <span className="text-slate-800 font-medium">{(session.data?.user as any)?.name ?? "-"}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Two-factor auth</span>
            <span className={`font-semibold ${twoFactorEnabled ? "text-green-700" : "text-slate-400"}`}>
              {twoFactorEnabled ? "Enabled" : "Disabled"}
            </span>
          </div>
        </div>
      </div>

      {/* Org-wide MFA Enforcement */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="px-5 py-3.5 border-b border-slate-100">
          <h2 className="text-sm font-bold text-slate-800">Organization-wide MFA Enforcement</h2>
          <p className="text-xs text-slate-500 mt-0.5">Require all org members to set up TOTP before accessing the platform. Satisfies CMMC IA.3.083, FedRAMP IA-2(1), SOC 2 CC6.1.</p>
        </div>
        <div className="p-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-800 mb-1">Require MFA for all members</p>
              <p className="text-xs text-slate-500 leading-relaxed">
                When enabled, any member who has not set up an authenticator app will be blocked from accessing the platform until they do. Applies to all roles.
              </p>
              {mfaEnforcedNow && (
                <div className="mt-2 flex items-center gap-1.5 text-xs text-green-700 font-semibold">
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                  Enforcement active - all members must have MFA
                </div>
              )}
              {mfaPolicy.data && (
                <p className="mt-2 text-xs text-slate-500">
                  Coverage: {mfaPolicy.data.enrolled} of {mfaPolicy.data.members} members enrolled ({mfaPolicy.data.coveragePct}%)
                  {mfaPolicy.data.graceEndsAt ? ` - enrolment deadline ${new Date(mfaPolicy.data.graceEndsAt).toLocaleDateString()}` : ""}
                </p>
              )}
            </div>
            <button
              onClick={() => mfaPolicyMutation.mutate(!mfaEnforcedNow)}
              disabled={mfaPolicyMutation.isPending || !orgId}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${mfaEnforcedNow ? "bg-blue-600" : "bg-slate-200"}`}
              role="switch"
              aria-checked={!!mfaEnforcedNow}
            >
              <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${mfaEnforcedNow ? "translate-x-5" : "translate-x-0"}`} />
            </button>
          </div>
          {secSaved && (
            <div className="mt-3 text-xs text-green-700 font-semibold flex items-center gap-1.5">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
              Security settings saved
            </div>
          )}
        </div>
      </div>

      {/* Recovery for a member who has lost their authenticator. Placed directly below
          the policy toggle on purpose: turning enforcement on is what creates the
          lockout this panel answers, so the two belong next to each other. Hidden from
          anyone below admin - the API refuses them anyway, but offering a button that
          always fails is its own kind of bug. */}
      {can("admin") && <MemberMfaAdmin />}

      {/* Audit Log Retention — enterprise+ plan required (P1-07) */}
      <PlanGate requiredPlan="enterprise" featureName="Custom Audit Log Retention">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="px-5 py-3.5 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-800">Audit Log Retention</h2>
            <p className="text-xs text-slate-500 mt-0.5">CMMC AU.3.045 requires 3 years. FedRAMP follows NARA schedules (typically 3 years). SOC 2 requires documented, enforced retention.</p>
          </div>
          <div className="p-5">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Retention period</label>
                <select
                  value={org?.auditRetentionDays ?? 1095}
                  onChange={e => retentionMutation.mutate(Number(e.target.value))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={!orgId || retentionMutation.isPending}
                >
                  <option value={90}>90 days</option>
                  <option value={365}>1 year</option>
                  <option value={730}>2 years</option>
                  <option value={1095}>3 years (CMMC / FedRAMP minimum)</option>
                  <option value={1825}>5 years</option>
                  <option value={2555}>7 years</option>
                </select>
              </div>
              <div className="flex-shrink-0 text-center">
                <p className="text-2xl font-bold text-slate-900">{Math.round((org?.auditRetentionDays ?? 1095) / 365 * 10) / 10}</p>
                <p className="text-xs text-slate-400">years</p>
              </div>
            </div>
            {retentionSaved && (
              <div className="mt-3 text-xs text-green-700 font-semibold flex items-center gap-1.5">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                Retention period saved
              </div>
            )}
            {(org?.auditRetentionDays ?? 1095) < 1095 && (
              <div className="mt-3 flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                <svg className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                <span><strong>Below minimum:</strong> CMMC AU.3.045 and FedRAMP AU-11 require a minimum of 3 years (1,095 days) for federal environments. Increase to 3 years before your assessment.</span>
              </div>
            )}
          </div>
        </div>
      </PlanGate>

      {/* SSO / SAML — enterprise+ plan required (P1-07) */}
      <PlanGate requiredPlan="enterprise" featureName="SSO / SAML Configuration">
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2.5 rounded-xl bg-purple-50 border border-purple-100">
              <svg className="h-5 w-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.955 11.955 0 003 10c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.75h-.152c-3.196 0-6.1-1.249-8.25-3.286zm0 13.036h.008v.008H12v-.008z" /></svg>
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-800">SSO / SAML 2.0 Configuration</h2>
              <p className="text-xs text-slate-500 mt-0.5">Configure SP-initiated SAML 2.0 for enterprise single sign-on</p>
            </div>
          </div>

          {/* ── SP metadata — copy into IdP ── */}
          {ssoConfigData?.sp && (
            <div className="mb-5 rounded-xl border border-slate-100 bg-slate-50 p-4 space-y-3">
              <p className="text-xs font-semibold text-slate-700">Service Provider (SP) Details — paste these into your IdP</p>
              <div>
                <label className="block text-xs text-slate-500 mb-0.5">Entity ID / Audience URI</label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-slate-800 font-mono truncate">{ssoConfigData.sp.entityId}</code>
                  <button onClick={() => navigator.clipboard.writeText(ssoConfigData.sp.entityId)} className="text-xs px-2 py-1 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-100">Copy</button>
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-0.5">ACS URL (Assertion Consumer Service)</label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-slate-800 font-mono truncate">{ssoConfigData.sp.acsUrl}</code>
                  <button onClick={() => navigator.clipboard.writeText(ssoConfigData.sp.acsUrl)} className="text-xs px-2 py-1 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-100">Copy</button>
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-0.5">SP Metadata XML</label>
                <a href={`/api/orgs/${orgId}/sso/metadata`} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">Download metadata.xml</a>
              </div>
            </div>
          )}

          {/* ── IdP configuration form ── */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5"Identity Provider (IdP)label>
                <select value={ssoProvider} onChange={e => setSsoProvider(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white">
                              <option value="azure_ad">Microsoft Entra ID</option>
                            <option value="okta">Okta</option>
                            <option value="ping">Ping Identity</option>
                            <option value="google">Google Workspace</option>
                            <option value="authentik">Authentik</option>
                            <option value="keycloak">Keycloak</option>
                            <option value="saml">Generic SSAML 2.0</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">SSO Domain</label>
                <input type="text" value={ssoDomain} onChange={e => setSsoDomain(e.target.value)} placeholder="company.com" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </div>

                        <div className="mb-2 rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                                    <p className="text-xs font-semibold text-slate-700">Configuration Method</p>
                                    <div className="flex flex-wrap gap-2">
                                                  <button type="button" onClick={() => setConfigMethod("upload")} className={"px-3 py-1.5 rounded-lg text-xs font-semibold border " + (configMethod === "upload" ? "bg-purple-600 text-white border-purple-600" : "bg-white text-slate-600 border-slate-200")}>Upload IdP Metadata XML</button>
                                                  <button type="button" onClick={() => setConfigMethod("url")} className={"px-3 py-1.5 rounded-lg text-xs font-semibold border " + (configMethod === "url" ? "bg-purple-600 text-white border-purple-600" : "bg-white text-slate-600 border-slate-200")}>Metadata URL</button>
                                                  <button type="button" onClick={() => setConfigMethod("manual")} className={"px-3 py-1.5 rounded-lg text-xs font-semibold border " + (configMethod === "manual" ? "bg-purple-600 text-white border-purple-600" : "bg-white text-slate-600 border-slate-200")}>Manual Configuration</button>
                                    </div>
                          {configMethod === "upload" && (
                      <div>
                                      <input type="file" accept=".xml,text/xml,application/xml" onChange={handleMetadataFileUpload} className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white" /></div>
        {metadataFetching && <p className="text-xs text-slate-400 mt-1">Parsing metadata...</p>
                        </div>
                      )}
                          {configMethod === "url" && (
                      <div className="flex items-center gap-2"></div>
                        <input type="url" value={metadataUrl} onChange={e => setMetadataUrl(e.target.value)} placeholder="https://your-idp.com/metadata.xml" className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono" />
                                          <button type="button" onClick={handleMetadataUrlFetch} disabled={metadataFetching || !metadataUrl.trim()} className="px-3 py-2 bg-purple-600 text-white text-xs font-semibold rounded-lg disabled:opacity-50">{metadataFetching ? "Fetching..." : "Fetch metadata"}</button>
            </div>
                          )}
              {metadataError && <p className="text-xs text-red-600">{metadataError}</p>}
              {metadataNote && <p className="text-xs text-green-700">{metadataNote}</p>}
                          <p className="text-xs text-slate-400">Uploading or fetching metadata pre-fills the Entity ID, SSO URL, and certificate fields below -- review before saving.</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">IdP Entity ID</label>
              <input type="text" value={idpEntityId} onChange={e => setIdpEntityId(e.target.value)} placeholder="https://your-idp.com/saml/entity-id" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">IdP SSO URL (Single Sign-On endpoint)</label>
              <input type="url" value={idpSsoUrl} onChange={e => setIdpSsoUrl(e.target.value)} placeholder="https://your-idp.com/saml2/sso" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">IdP Signing Certificate (PEM)</label>
              <textarea
                value={idpCertificate}
                onChange={e => setIdpCertificate(e.target.value)}
                placeholder={"-----BEGIN CERTIFICATE-----\nMIIC...\n-----END CERTIFICATE-----"}
                rows={5}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono resize-none"
              />
              <p className="text-xs text-slate-400 mt-1">Paste the X.509 certificate from your IdP's metadata (with or without PEM headers)</p>
            </div>

                      <div>
                                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">IdP SLO URL (Single Logout, optional)</label>
                                    <input type="url" value={idpSloUrl} onChange={e => setIdpSloUrl(e.target.value)} placeholder="https://your-idp.com/saml2/slo" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono" />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div>
                                                <label className="block text-xs font-semibold text-slate-700 mb-1.5">NameID Format</label>
                                                  <select value={nameIdFormat} onChange={e => setNameIdFormat(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white">
                                                                  <option value="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress">Email address</option>
                                                                    <option value="urn:oasis:names:tc:SAML:2.0:nameid-format:persistent">Persistent</option>
                                                                    <option value="urn:oasis:names:tc:SAML:2.0:nameid-format:transient">Transient</option>
                                                                    <option value="urn:oasis:names:tc:SAML:1.1:nameid-format:unspecified">Unspecified</option>
                                                  </select>
                                  </div>
                                    <div>
                                                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">RequestedAuthnContext (optional)</label>
                                                    <input type="text" value={requestedAuthnContext} onChange={e => setRequestedAuthnContext(e.target.value)} placeholder="urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono" />
                                    </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-6">
                                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                                                <input type="checkbox" checked={wantAssertionsSigned} onChange={e => setWantAssertionsSigned(e.target.checked)} />
                                                Signed Assertions Required
                                  </label>
                                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                                                  <input type="checkbox" checked={wantAuthnResponseSigned} onChange={e => setWantAuthnResponseSigned(e.target.checked)} />
                                                  Signed Responses Required</label>
                      </div>

            {/* ── Group-to-Role Mapping ── */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-700">Group-to-Role Mapping</p>
                  <p className="text-xs text-slate-500 mt-0.5">Map IdP group names to platform roles. Members in multiple groups receive the highest mapped role.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setGroupMappings(prev => [...prev, { group: "", role: "member" }])}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-600 text-xs font-semibold rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                  Add Mapping
                </button>
              </div>
              {groupMappings.length === 0 && (
                <p className="text-xs text-slate-400 italic">No group mappings configured. Users will be assigned the member role by default.</p>
              )}
              {groupMappings.map((mapping, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={mapping.group}
                    onChange={e => {
                      const updated = [...groupMappings];
                      updated[idx] = { ...updated[idx], group: e.target.value };
                      setGroupMappings(updated);
                    }}
                    placeholder="IdP group name (e.g. GRC-Admins)"
                    className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <svg className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
                  <select
                    value={mapping.role}
                    onChange={e => {
                      const updated = [...groupMappings];
                      updated[idx] = { ...updated[idx], role: e.target.value };
                      setGroupMappings(updated);
                    }}
                    className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="member">Member</option>
                    <option value="compliance_manager">Compliance Manager</option>
                    <option value="admin">Admin</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => setGroupMappings(prev => prev.filter((_, i) => i !== idx))}
                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="Remove mapping"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              ))}
            </div>

                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                                  <div>
                                                <p className="text-xs font-semibold text-slate-700">User Provisioning</p>
                                  </div>
                                    <label className="flex items-center justify-between gap-4 text-xs text-slate-700">
                                                  <span>JIT Provisioning -- create a platform account automatically on first SSO login</span>s
                                                    <input type="checkbox" checked={jitProvisioningEnabled} onChange={e => setJitProvisioningEnabled(e.target.checked)} />
                                    </label>
                                    <label className="flex items-center justify-between gap-4 text-xs text-slate-700">
                                                  <span>SCIM 2.0 -- stored for admin intent; automated sync is not yet implemented</span>s
                                                    <input type="checkbox" checked={scimEnabled} onChange={e => setScimEnabled(e.target.checked)} />
                                    </label>
                                    <label className="flex items-center justify-between gap-4 text-xs text-slate-700">
                                                  <span>Disable Local Password Login -- stored for admin intent; sign-in enforcement is not yet wired up</span>s
                                                    <input type="checkbox" checked={disableLocalPasswordLogin} onChange={e => setDisableLocalPasswordLogin(e.target.checked)} />
                                    </label>
                      </div>

                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                                  <div>
                                                <p className="text-xs font-semibold text-slate-700">Attribute Mapping</p>
                                                  <p className="text-xs text-slate-500 mt-0.5">Map each field to the SAML attribute name your IdP sends it under. Leave blank to use the built-in defaults.</p>
                                  </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                  <div>
                                                                  <label className="block text-xs text-slate-600 mb-1">Email</label>
                                                                    <input type="text" value={attrEmail} onChange={e => setAttrEmail(e.target.value)} placeholder="email" className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-mono" />
                                                  </div>
                                                    <div>
                                                                    <label className="block text-xs text-slate-600 mb-1">First Name</label>
                                                                      <input type="text" value={attrFirstName} onChange={e => setAttrFirstName(e.target.value)} placeholder="givenName" className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-mono" />
                                                    </div>
                                                    <div>
                                                                    <label className="block text-xs text-slate-600 mb-1">Last Name</label>
                                                                    <input type="text" value={attrLastName} onChange={e => setAttrLastName(e.target.value)} placeholder="surname" className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-mono" />
                                                    </div>
                                                  <div>
                                                                  <label className="block text-xs text-slate-600 mb-1">Display Name</label>
                                                                  <input type="text" value={attrDisplayName} onChange={e => setAttrDisplayName(e.target.value)} placeholder="displayName" className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-mono" />
                                                  </div>
                                                  <div>
                                                                  <label className="block text-xs text-slate-600 mb-1">Groups</label>
                                                                  <input type="text" value={attrGroups} onChange={e => setAttrGroups(e.target.value)} placeholder="groups" className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-mono" />
                                                  </div>
                                                  <div>
                                                                  <label className="block text-xs text-slate-600 mb-1">Department</label>
                                                                  <input type="text" value={attrDepartment} onChange={e => setAttrDepartment(e.target.value)} placeholder="department" className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-mono" />
                                                  </div>
                                    </div>
                      </div></div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                                <p className="text-xs font-semibold text-slate-700">Security</p>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div>
                                                                <label className="block text-xs text-slate-600 mb-1">Clock Skew Tolerance (ms)</label>
                                                                  <input type="number" value={clockSkewToleranceMs} onChange={e => setClockSkewToleranceMs(Number(e.target.value) || 0)} className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs" />
                                                </div>
                                                  <div>
                                                                  <label className="block text-xs text-slate-600 mb-1">Session Lifetime (minutes)</label>
                                                                  <input type="number" value={sessionLifetimeMinutes} onChange={e => setSessionLifetimeMinutes(Number(e.target.value) || 0)} className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs" />
                                                  </div>
                                  </div>
                                <p className="text-xs text-slate-600 pt-2 border-t border-slate-200">Certificate Expiration Monitoring: {certNotAfter ? `expires ${new Date(certNotAfter).toLocaleDateString()}` : "save a certificate to see its expiration date"}{certExpiresInDays !== null ? ` (${certExpiresInDays} days)` : ""}</p>
                                <p className="text-xs text-slate-400">Certificate Rotation: re-upload or re-fetch IdP metadata above to rotate the signing certificate.</p>
                                <p className="text-xs text-slate-400">Replay Protection: not enabled -- SAML InResponseTo validation is currently disabled at the SP.</p>
                    </div></div>

            {ssoError && (
              <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">{ssoError}</div>
            )}

            {ssoTestBanner && (
              <div className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 ${ssoTestBanner.type === "success" ? "bg-green-50 border border-green-200 text-green-700" : "bg-amber-50 border border-amber-200 text-amber-700"}`}>
                {ssoTestBanner.type === "success"
                  ? <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                  : <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                }
                {ssoTestBanner.message}
                <button onClick={() => setSsoTestBanner(null)} className="ml-auto text-current opacity-60 hover:opacity-100">✕</button>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => ssoMutation.mutate()}
                disabled={!orgId || !idpEntityId || !idpSsoUrl || !idpCertificate || ssoMutation.isPending}
                className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                {ssoMutation.isPending ? "Saving…" : "Save SSO Configuration"}
              </button>
              <button
                data-testid="test-sso-btn"
                onClick={() => {
                  const orgSlug = org?.slug || orgId;
                  sessionStorage.setItem("ssoTestPending", "1");
                  setSsoTestNote(true);
                  window.open(`/api/saml/${orgSlug}/login`, "_blank");
                }}
                disabled={!orgId || !idpEntityId || !idpSsoUrl || !idpCertificate}
                className="px-4 py-2 bg-white border border-purple-300 text-purple-700 text-sm font-medium rounded-lg hover:bg-purple-50 disabled:opacity-50 transition-colors"
              >
                Test SSO Connection
              </button>
              {ssoSaved && (
                <div className="flex items-center gap-1.5 text-xs text-green-700 font-semibold">
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                  SSO configuration saved
                </div>
              )}
            </div>
            {ssoTestNote && (
              <p className="text-xs text-slate-500 mt-1">A login window opened. If successful, you'll see a green SSO Verified banner on return.</p>
            )}
          </div>
        </div>
      </PlanGate>
    </div>
  );
}

function DataPortabilityExport({ orgId }: { orgId: string }) {
  const [exporting, setExporting] = useState<string | null>(null);
  const [confirmExportAll, setConfirmExportAll] = useState(false);

  async function exportEvidence() {
    setExporting("evidence");
    try {
      const d = await fetch(`/api/orgs/${orgId}/evidence`, { credentials: "include" }).then(r => r.json());
      const items = d.evidence ?? [];
      const rows = [["ID","Title","Type","Source","Control ID","URL","Description","Collected At","Expires At"]];
      for (const e of items) rows.push([e.id,e.title,e.type,e.source,e.ucoControlId??"",e.url??"",e.description??"",e.collectedAt??"",e.expiresAt??""]);
      downloadCsv(`evidence-vault-${new Date().toISOString().slice(0,10)}.csv`, rows);
    } finally { setExporting(null); }
  }

  async function exportPoam() {
    setExporting("poam");
    try {
      const d = await fetch(`/api/orgs/${orgId}/poam`, { credentials: "include" }).then(r => r.json());
      const items = d.items ?? [];
      const rows = [["ID","Weakness Name","Control ID","Status","Severity","POC Name","POC Email","Resources","Estimated Cost","Scheduled Completion","Original Risk Rating","Residual Risk Rating","Milestones","Created At"]];
      for (const p of items) rows.push([p.id,p.weaknessName,p.controlId??"",p.status,p.severity,p.pocName??"",p.pocEmail??"",p.resources??"",p.estimatedCost??"",p.scheduledCompletionDate??"",p.originalRiskRating??"",p.residualRiskRating??"",p.milestones??"",p.createdAt??""]);
      downloadCsv(`poam-${new Date().toISOString().slice(0,10)}.csv`, rows);
    } finally { setExporting(null); }
  }

  async function exportRisks() {
    setExporting("risks");
    try {
      const d = await fetch(`/api/orgs/${orgId}/risks`, { credentials: "include" }).then(r => r.json());
      const items = d.risks ?? [];
      const rows = [["ID","Title","Description","Category","Likelihood","Impact","Status","Owner","Control IDs","Created At"]];
      for (const r of items) rows.push([r.id,r.title,r.description??"",r.category??"",r.likelihood,r.impact,r.status,r.owner??"",r.controlIds??"",r.createdAt??""]);
      downloadCsv(`risk-register-${new Date().toISOString().slice(0,10)}.csv`, rows);
    } finally { setExporting(null); }
  }

  async function exportAll() {
    setExporting("all");
    try {
      const [evidenceData, poamData, risksData] = await Promise.all([
        fetch(`/api/orgs/${orgId}/evidence`, { credentials: "include" }).then(r => r.json()),
        fetch(`/api/orgs/${orgId}/poam`, { credentials: "include" }).then(r => r.json()),
        fetch(`/api/orgs/${orgId}/risks`, { credentials: "include" }).then(r => r.json()),
      ]);
      downloadJson(`compliance-export-${new Date().toISOString().slice(0,10)}.json`, { exportedAt: new Date().toISOString(), orgId, evidence: evidenceData.evidence ?? [], poam: poamData.items ?? [], risks: risksData.risks ?? [] });
    } finally { setExporting(null); }
  }

  const EXPORTS = [
    { id: "evidence", label: "Evidence Vault", desc: "All evidence items with artifact URLs, control mappings, collection dates, and expiry", format: "CSV", action: exportEvidence },
    { id: "poam", label: "POA&M Register", desc: "All plan of action items with FedRAMP-required fields", format: "CSV", action: exportPoam },
    { id: "risks", label: "Risk Register", desc: "All risk items with likelihood, impact, category, owner, and linked controls", format: "CSV", action: exportRisks },
  ];

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
      <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
        <div><h2 className="text-sm font-bold text-slate-800">Data Portability &amp; Export</h2><p className="text-xs text-slate-500 mt-0.5">Your compliance data is yours. Export it any time.</p></div>
        <button onClick={() => setConfirmExportAll(true)} disabled={!!exporting} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">{exporting === "all" ? "Exporting..." : "Export All (JSON)"}</button>
      </div>
      <div className="p-5">
        <div className="space-y-2">
          {EXPORTS.map((ex) => (
            <div key={ex.id} className="flex items-center justify-between gap-4 px-4 py-3.5 border border-slate-100 rounded-lg hover:bg-slate-50 transition-colors">
              <div className="flex-1 min-w-0"><p className="text-sm font-semibold text-slate-800">{ex.label}</p><p className="text-xs text-slate-500 mt-0.5">{ex.desc}</p></div>
              <div className="flex items-center gap-2"><span className="text-xs font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded">{ex.format}</span><button onClick={ex.action} disabled={!!exporting} className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 text-slate-600 text-xs font-semibold rounded-lg hover:bg-slate-100 disabled:opacity-50 transition-colors">{exporting === ex.id ? "Exporting..." : "Export"}</button></div>
            </div>
          ))}
        </div>

        <div className="mt-6 bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-5"><div className="p-2.5 rounded-xl bg-blue-50 border border-blue-100"><svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" /></svg></div><div><h2 className="text-base font-semibold text-slate-800">Notification Preferences</h2><p className="text-xs text-slate-500 mt-0.5">Control when and how you receive compliance alerts</p></div></div>
          <div className="space-y-3">
            {[{key:"evidence_expiry",label:"Evidence expiring within 30 days",desc:"Get notified when evidence items are about to expire",default:true},{key:"policy_review",label:"Policies due for annual review",desc:"Reminder when policies pass their review date",default:true},{key:"control_failing",label:"Controls failing for over 24 hours",desc:"Critical alert when controls remain in failing state",default:true}].map(pref => (
              <div key={pref.key} className="flex items-center justify-between py-3 border-b border-slate-50 last:border-0">
                <div><p className="text-sm font-medium text-slate-800">{pref.label}</p><p className="text-xs text-slate-400 mt-0.5">{pref.desc}</p></div>
                <input type="checkbox" defaultChecked={pref.default} className="h-4 w-4 text-blue-600 rounded" />
              </div>
            ))}
          </div>
          <button onClick={() => { const el = document.createElement("div"); el.style.cssText = "position:fixed;bottom:24px;right:24px;background:#2563eb;color:white;padding:12px 20px;border-radius:12px;font-size:14px;font-weight:600;z-index:9999"; el.textContent = "Notification preferences saved"; document.body.appendChild(el); setTimeout(() => el.remove(), 2500); }} className="mt-4 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">Save Preferences</button>
        </div>

        <div className="mt-6 bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-5"><div className="p-2.5 rounded-xl bg-orange-50 border border-orange-100"><svg className="h-5 w-5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg></div><div><h2 className="text-base font-semibold text-slate-800">Risk Appetite</h2><p className="text-xs text-slate-500 mt-0.5">Define your organization tolerance for compliance risk</p></div></div>
          <div className="space-y-3">
            {[{val:"conservative",label:"Conservative",desc:"Minimal risk tolerance. All critical and high risks must be mitigated within 30 days."},{val:"moderate",label:"Moderate",desc:"Balanced approach. Critical risks mitigated within 60 days, high within 90 days."},{val:"aggressive",label:"Aggressive",desc:"Higher tolerance for operational risk. Focus on critical risks only."}].map(opt => (
              <label key={opt.val} className="flex items-start gap-3 p-3 border border-slate-200 rounded-xl cursor-pointer hover:border-blue-300 hover:bg-blue-50/30">
                <input type="radio" name="risk_appetite" value={opt.val} defaultChecked={opt.val === "moderate"} className="mt-0.5" />
                <div><p className="text-sm font-semibold text-slate-800">{opt.label}</p><p className="text-xs text-slate-500 mt-0.5">{opt.desc}</p></div>
              </label>
            ))}
          </div>
          <button onClick={() => { const el = document.createElement("div"); el.style.cssText = "position:fixed;bottom:24px;right:24px;background:#ea580c;color:white;padding:12px 20px;border-radius:12px;font-size:14px;font-weight:600;z-index:9999"; el.textContent = "Risk appetite saved"; document.body.appendChild(el); setTimeout(() => el.remove(), 2500); }} className="mt-4 px-4 py-2 bg-orange-600 text-white text-sm font-medium rounded-lg hover:bg-orange-700">Save Risk Appetite</button>
        </div>
      </div>
    </div>
  );
}

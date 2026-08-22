// SSRF: outbound URLs are tenant-configurable, so `fetch` here is the guarded client.
import { guardedFetch as fetch } from "../../../lib/guarded-fetch.js";

export interface SlackCheckResult {
    ucoControlId: string;
    status: "passing" | "failing" | "warning";
    result: string;
    integrationKey: "slack";
}

export interface SlackEvidenceItem {
    ucoControlId: string;
    title: string;
    description: string;
    type: "auto";
    source: "slack";
}

export interface SlackSyncResult {
    controlResults: SlackCheckResult[];
    evidenceItems: SlackEvidenceItem[];
    checksRun: number;
    checksPassed: number;
}

export async function runSlackChecks(botToken: string): Promise<SlackSyncResult> {
    const headers = { Authorization: `Bearer ${botToken}` };
    const controlResults: SlackCheckResult[] = [];
    const evidenceItems: SlackEvidenceItem[] = [];

  // --- Check 1: SSO and message retention (UCO-DP-003) ---
  try {
        const teamResp = await fetch("https://slack.com/api/team.info", { headers });
        if (!teamResp.ok) throw new Error(`Slack API team.info: ${teamResp.status} ${teamResp.statusText}`);
        const teamData = (await teamResp.json()) as any;
        if (!teamData.ok) throw new Error(`Slack API error on team.info: ${teamData.error ?? "unknown"}`);
        const ssoEnabled = !!teamData.team?.sso_provider;
        const retentionEnabled = !!teamData.team?.retention_enabled;
        const passing = ssoEnabled && retentionEnabled;
        controlResults.push({
                ucoControlId: "UCO-DP-003",
                status: passing ? "passing" : ssoEnabled || retentionEnabled ? "warning" : "failing",
                result: `Slack SSO: ${ssoEnabled ? "enabled" : "NOT configured"}. Message retention: ${retentionEnabled ? "enabled" : "not set"}.`,
                integrationKey: "slack",
        });
        evidenceItems.push({
                ucoControlId: "UCO-DP-003",
                title: "Slack SSO and Retention",
                description: `Slack workspace SSO is ${ssoEnabled ? "enabled" : "not configured"}. Message retention is ${retentionEnabled ? "enabled" : "not set"}.`,
                type: "auto",
                source: "slack",
        });
  } catch (err) {
        controlResults.push({
                ucoControlId: "UCO-DP-003",
                status: "warning",
                result: `Slack SSO/retention check failed: ${String(err)}`,
                integrationKey: "slack",
        });
  }

  // --- Check 2: External sharing exposure on public channels (UCO-AC-001) ---
  try {
        const channelsResp = await fetch("https://slack.com/api/conversations.list?limit=200&types=public_channel", { headers });
        if (!channelsResp.ok) throw new Error(`Slack API conversations.list: ${channelsResp.status} ${channelsResp.statusText}`);
        const channelsData = (await channelsResp.json()) as any;
        if (!channelsData.ok) throw new Error(`Slack API error on conversations.list: ${channelsData.error ?? "unknown"}`);
        const channels = channelsData.channels ?? [];
        const external = channels.filter((c: any) => c.is_ext_shared).length;
        const passing = external === 0;
        controlResults.push({
                ucoControlId: "UCO-AC-001",
                status: passing ? "passing" : "warning",
                result: `Slack channel inventory: ${channels.length} public channels, ${external} with external sharing enabled.${passing ? "" : " Review externally shared channels for unintended data exposure."}`,
                integrationKey: "slack",
        });
        evidenceItems.push({
                ucoControlId: "UCO-AC-001",
                title: "Slack Channel Inventory",
                description: `${channels.length} public channels found. ${external} have external sharing enabled.`,
                type: "auto",
                source: "slack",
        });
  } catch (err) {
        controlResults.push({
                ucoControlId: "UCO-AC-001",
                status: "warning",
                result: `Slack channel inventory check failed: ${String(err)}`,
                integrationKey: "slack",
        });
  }

  const checksPassed = controlResults.filter((r) => r.status === "passing").length;
    return { controlResults, evidenceItems, checksRun: controlResults.length, checksPassed };
}

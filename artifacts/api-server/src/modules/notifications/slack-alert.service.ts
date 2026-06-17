import { Injectable, Logger } from "@nestjs/common";

export interface SlackControlFailurePayload {
  orgName: string;
  orgId: number;
  integrationKey: string;
  failingControls: Array<{ id: string; name: string }>;
  passingControls: Array<{ id: string; name: string }>;
  complianceScore?: number;
}

export interface SlackEvidenceExpiryPayload {
  orgName: string;
  orgId: number;
  expiringItems: Array<{ title: string; controlId?: string; daysUntilExpiry: number }>;
}

export interface SlackPostureChangePayload {
  orgName: string;
  orgId: number;
  previousScore: number;
  currentScore: number;
  delta: number;
  topFailingControls: string[];
}

const APP_URL = process.env["APP_URL"] ?? "https://grc.colorcodesolutions.com";

@Injectable()
export class SlackAlertService {
  private readonly logger = new Logger(SlackAlertService.name);

  /** Resolve the Slack webhook URL for a given org, falling back to the global env var. */
  private resolveWebhookUrl(orgWebhookUrl?: string | null): string | null {
    return orgWebhookUrl || process.env["SLACK_WEBHOOK_URL"] || null;
  }

  private async postToSlack(webhookUrl: string, payload: Record<string, unknown>): Promise<void> {
    try {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        this.logger.warn(`[slack] POST failed ${res.status}: ${body}`);
      } else {
        this.logger.log("[slack] message delivered");
      }
    } catch (err) {
      this.logger.error({ err }, "[slack] fetch error");
    }
  }

  /** Alert: one or more controls flipped to failing after an integration sync. */
  async alertControlFailure(
    payload: SlackControlFailurePayload,
    orgWebhookUrl?: string | null,
  ): Promise<void> {
    const webhookUrl = this.resolveWebhookUrl(orgWebhookUrl);
    if (!webhookUrl) return;

    const failingList = payload.failingControls
      .map(c => `• ${c.id} — ${c.name}`)
      .join("\n");
    const passingList = payload.passingControls.length > 0
      ? "\n*Newly passing:*\n" + payload.passingControls.map(c => `• ${c.id} — ${c.name}`).join("\n")
      : "";
    const scoreText = payload.complianceScore !== undefined
      ? `\nCurrent score: *${payload.complianceScore}%*`
      : "";

    await this.postToSlack(webhookUrl, {
      blocks: [
        {
          type: "header",
          text: { type: "plain_text", text: `🔴 Compliance Controls Failed — ${payload.orgName}`, emoji: true },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `The *${payload.integrationKey}* integration sync detected *${payload.failingControls.length} failing control${payload.failingControls.length === 1 ? "" : "s"}*.${scoreText}`,
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Failing controls:*\n${failingList}${passingList}`,
          },
        },
        {
          type: "actions",
          elements: [
            {
              type: "button",
              text: { type: "plain_text", text: "View Controls", emoji: true },
              url: `${APP_URL}/controls`,
              style: "danger",
            },
            {
              type: "button",
              text: { type: "plain_text", text: "Remediation Board", emoji: true },
              url: `${APP_URL}/remediation`,
            },
          ],
        },
        {
          type: "context",
          elements: [
            { type: "mrkdwn", text: `Org ID: ${payload.orgId} • EnterpriseComply` },
          ],
        },
      ],
    });
  }

  /** Alert: evidence items expiring within 7 days. */
  async alertEvidenceExpiry(
    payload: SlackEvidenceExpiryPayload,
    orgWebhookUrl?: string | null,
  ): Promise<void> {
    const webhookUrl = this.resolveWebhookUrl(orgWebhookUrl);
    if (!webhookUrl) return;

    const itemList = payload.expiringItems
      .map(e => `• ${e.title}${e.controlId ? ` (${e.controlId})` : ""} — ${e.daysUntilExpiry}d`)
      .join("\n");

    await this.postToSlack(webhookUrl, {
      blocks: [
        {
          type: "header",
          text: { type: "plain_text", text: `⚠️ Evidence Expiring — ${payload.orgName}`, emoji: true },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*${payload.expiringItems.length} evidence item${payload.expiringItems.length === 1 ? "" : "s"}* will expire within 7 days. Refresh to prevent controls from failing.`,
          },
        },
        {
          type: "section",
          text: { type: "mrkdwn", text: itemList },
        },
        {
          type: "actions",
          elements: [
            {
              type: "button",
              text: { type: "plain_text", text: "Manage Evidence", emoji: true },
              url: `${APP_URL}/evidence`,
            },
          ],
        },
      ],
    });
  }

  /** Alert: compliance posture score changed significantly (±5 pts or more). */
  async alertPostureChange(
    payload: SlackPostureChangePayload,
    orgWebhookUrl?: string | null,
  ): Promise<void> {
    const webhookUrl = this.resolveWebhookUrl(orgWebhookUrl);
    if (!webhookUrl || Math.abs(payload.delta) < 1) return;

    const direction = payload.delta >= 0 ? "improved" : "dropped";
    const icon = payload.delta >= 0 ? "✅" : "🔴";
    const controlText = payload.topFailingControls.length > 0
      ? "\n*Top failing controls:*\n" + payload.topFailingControls.map(c => `• ${c}`).join("\n")
      : "";

    await this.postToSlack(webhookUrl, {
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: `${icon} Compliance Score ${direction.charAt(0).toUpperCase() + direction.slice(1)} — ${payload.orgName}`,
            emoji: true,
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `Score has *${direction} by ${Math.abs(payload.delta)} pts*: *${payload.previousScore}%* → *${payload.currentScore}%*${controlText}`,
          },
        },
        {
          type: "actions",
          elements: [
            {
              type: "button",
              text: { type: "plain_text", text: "View Dashboard", emoji: true },
              url: `${APP_URL}/dashboard`,
            },
          ],
        },
        {
          type: "context",
          elements: [{ type: "mrkdwn", text: `Org ID: ${payload.orgId} • EnterpriseComply` }],
        },
      ],
    });
  }

  /** Generic: send a raw text message (for testing and custom alerts). */
  async sendRawMessage(text: string, orgWebhookUrl?: string | null): Promise<void> {
    const webhookUrl = this.resolveWebhookUrl(orgWebhookUrl);
    if (!webhookUrl) return;
    await this.postToSlack(webhookUrl, { text });
  }
}

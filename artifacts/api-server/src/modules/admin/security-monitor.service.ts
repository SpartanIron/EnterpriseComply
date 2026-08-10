import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { writeSecurityEvent } from "../../lib/audit-log.js";

/**
 * Security detection over the immutable audit trail.
 *
 * Collecting audit records is necessary but not sufficient: a trail nobody
 * reads detects nothing. This service turns the trail into detections by
 * running a small set of high-signal rules on a schedule and raising an alert
 * when one fires (NIST SI-4, AU-6; SOC 2 CC7.2/CC7.3).
 *
 * Design choices worth stating:
 *  - Rules run against the append-only log rather than in the request path,
 *    so a detection can never slow down or break a customer request.
 *  - Every alert is itself written back to the audit log as a
 *    "security.alert_*" event. That makes the detection auditable and gives
 *    de-duplication somewhere durable to live, so a persistent condition
 *    pages once rather than every five minutes forever.
 *  - Thresholds are deliberately conservative. A noisy detector gets muted,
 *    and a muted detector is worse than no detector.
 */

export interface SecurityRule {
  key: string;
  title: string;
  /** NIST / SOC 2 control this detection supports. */
  control: string;
  windowMinutes: number;
  threshold: number;
  /** How long to stay quiet after firing, so one condition pages once. */
  cooldownMinutes: number;
  severity: "critical" | "high" | "medium";
}

export const SECURITY_RULES: SecurityRule[] = [
  {
    key: "cross_tenant_probing",
    title: "Repeated authorisation denials from one actor",
    control: "NIST AC-3 / SI-4(4), SOC 2 CC6.1",
    windowMinutes: 15,
    threshold: 5,
    cooldownMinutes: 60,
    severity: "critical",
  },
  {
    key: "auth_failure_spike",
    title: "Burst of unauthenticated requests from one source",
    control: "NIST AC-7 / SI-4, SOC 2 CC6.1",
    windowMinutes: 15,
    threshold: 25,
    cooldownMinutes: 60,
    severity: "high",
  },
  {
    key: "privilege_change_burst",
    title: "Unusual number of role or plan changes",
    control: "NIST AC-2(4), SOC 2 CC6.2",
    windowMinutes: 60,
    threshold: 3,
    cooldownMinutes: 120,
    severity: "high",
  },
  {
    key: "mass_evidence_retirement",
    title: "Large volume of evidence retired at once",
    control: "NIST AU-9, SOC 2 CC7.2",
    windowMinutes: 60,
    threshold: 25,
    cooldownMinutes: 120,
    severity: "high",
  },
  {
    key: "mfa_enforcement_disabled",
    title: "Multi-factor enforcement was switched off",
    control: "NIST IA-2(1), SOC 2 CC6.1",
    windowMinutes: 60,
    threshold: 1,
    cooldownMinutes: 240,
    severity: "high",
  },
];

@Injectable()
export class SecurityMonitorService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SecurityMonitorService.name);
  private timer: ReturnType<typeof setInterval> | null = null;

  onApplicationBootstrap() {
    // First pass after a short delay so it never competes with boot-time
    // migrations, then every five minutes.
    setTimeout(() => void this.sweep(), 60_000).unref?.();
    this.timer = setInterval(() => void this.sweep(), 5 * 60_000);
    this.timer.unref?.();
  }

  /** Runs every rule. Never throws: a broken detector must not crash the app. */
  async sweep(): Promise<{ evaluated: number; fired: string[] }> {
    const fired: string[] = [];
    for (const rule of SECURITY_RULES) {
      try {
        const hits = await this.evaluate(rule);
        for (const hit of hits) {
          if (await this.inCooldown(rule, hit.orgId, hit.subject)) continue;
          await this.raise(rule, hit);
          fired.push(rule.key + ":" + hit.subject);
        }
      } catch (err) {
        this.logger.warn(
          "security rule " + rule.key + " failed: " +
            ((err as any)?.message ?? String(err)),
        );
      }
    }
    return { evaluated: SECURITY_RULES.length, fired };
  }

  private async evaluate(
    rule: SecurityRule,
  ): Promise<Array<{ orgId: number; subject: string; count: number }>> {
    const since = sql.raw("NOW() - INTERVAL '" + rule.windowMinutes + " minutes'");

    let rows: any;
    switch (rule.key) {
      case "cross_tenant_probing":
        rows = await db.execute(sql`
          SELECT org_id,
                 COALESCE(actor_id, ip_address, 'unknown') AS subject,
                 COUNT(*)::int AS count
            FROM org_audit_log
           WHERE created_at >= ${since}
             AND action = 'security.authorization_denied'
           GROUP BY 1, 2
          HAVING COUNT(*) >= ${rule.threshold}
        `);
        break;

      case "auth_failure_spike":
        rows = await db.execute(sql`
          SELECT org_id,
                 COALESCE(ip_address, 'unknown') AS subject,
                 COUNT(*)::int AS count
            FROM org_audit_log
           WHERE created_at >= ${since}
             AND action = 'security.unauthenticated_request'
           GROUP BY 1, 2
          HAVING COUNT(*) >= ${rule.threshold}
        `);
        break;

      case "privilege_change_burst":
        rows = await db.execute(sql`
          SELECT org_id,
                 COALESCE(actor_id, 'unknown') AS subject,
                 COUNT(*)::int AS count
            FROM org_audit_log
           WHERE created_at >= ${since}
             AND (action LIKE '%role%' OR action LIKE '%plan%')
             AND action NOT LIKE 'security.%'
           GROUP BY 1, 2
          HAVING COUNT(*) >= ${rule.threshold}
        `);
        break;

      case "mass_evidence_retirement":
        rows = await db.execute(sql`
          SELECT org_id,
                 COALESCE(actor_id, 'unknown') AS subject,
                 COUNT(*)::int AS count
            FROM org_audit_log
           WHERE created_at >= ${since}
             AND action = 'evidence.retired'
           GROUP BY 1, 2
          HAVING COUNT(*) >= ${rule.threshold}
        `);
        break;

      case "mfa_enforcement_disabled":
        rows = await db.execute(sql`
          SELECT org_id,
                 COALESCE(actor_id, 'unknown') AS subject,
                 COUNT(*)::int AS count
            FROM org_audit_log
           WHERE created_at >= ${since}
             AND action = 'org.mfa_enforcement_disabled'
           GROUP BY 1, 2
          HAVING COUNT(*) >= ${rule.threshold}
        `);
        break;

      default:
        return [];
    }

    return (rows.rows as any[]).map((r) => ({
      orgId: Number(r.org_id),
      subject: String(r.subject),
      count: Number(r.count),
    }));
  }

  /** Has this exact condition already alerted inside its cooldown? */
  private async inCooldown(
    rule: SecurityRule,
    orgId: number,
    subject: string,
  ): Promise<boolean> {
    const since = sql.raw("NOW() - INTERVAL '" + rule.cooldownMinutes + " minutes'");
    const r = await db.execute(sql`
      SELECT 1 FROM org_audit_log
       WHERE org_id = ${orgId}
         AND action = ${"security.alert_" + rule.key}
         AND details->>'subject' = ${subject}
         AND created_at >= ${since}
       LIMIT 1
    `);
    return (r.rows?.length ?? 0) > 0;
  }

  private async raise(
    rule: SecurityRule,
    hit: { orgId: number; subject: string; count: number },
  ): Promise<void> {
    await writeSecurityEvent(
      hit.orgId,
      "alert_" + rule.key,
      "security_monitor",
      {
        title: rule.title,
        control: rule.control,
        severity: rule.severity,
        subject: hit.subject,
        count: hit.count,
        threshold: rule.threshold,
        windowMinutes: rule.windowMinutes,
      },
    );

    this.logger.warn(
      "[SECURITY ALERT] " + rule.severity.toUpperCase() + " " + rule.title +
        " — org " + hit.orgId + ", subject " + hit.subject +
        ", " + hit.count + " events in " + rule.windowMinutes + " minutes",
    );

    // Slack is best effort. A failed notification must never suppress the
    // durable audit record above, which is the real system of record.
    const webhook = process.env.SLACK_WEBHOOK_URL;
    if (!webhook) return;
    try {
      const res = await fetch(webhook, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          text:
            ":rotating_light: *" + rule.severity.toUpperCase() + " — " +
            rule.title + "*\n" +
            "Org: " + hit.orgId + "\nSubject: " + hit.subject + "\n" +
            "Events: " + hit.count + " in " + rule.windowMinutes + " min " +
            "(threshold " + rule.threshold + ")\nControl: " + rule.control,
        }),
      });
      if (!res.ok) {
        this.logger.warn("Slack alert rejected with status " + res.status);
      }
    } catch (err) {
      this.logger.warn(
        "Slack alert failed: " + ((err as any)?.message ?? String(err)),
      );
    }
  }
}

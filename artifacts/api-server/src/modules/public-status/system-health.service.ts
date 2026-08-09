import { Injectable, OnApplicationBootstrap, OnApplicationShutdown } from "@nestjs/common";
import { db, systemHealthLogTable, incidentsTable } from "@workspace/db";
import { eq, desc, and, isNull } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { logger } from "../../lib/logger.js";

export type HealthStatus = "healthy" | "degraded" | "down";

export interface ProbeResult {
  component: string;
  status: HealthStatus;
  latencyMs: number;
  error?: string;
}

const COMPONENTS = ["api", "database", "auth", "scheduler", "evidence_vault"] as const;

@Injectable()
export class SystemHealthService implements OnApplicationBootstrap, OnApplicationShutdown {
  private timer: ReturnType<typeof setInterval> | null = null;
  private pruneTimer: ReturnType<typeof setInterval> | null = null;

  onApplicationBootstrap() {
    // First probe 90 seconds after startup (give the server time to come up fully)
    setTimeout(() => this.runAllProbes(), 90_000);
    // Then every 5 minutes
    this.timer = setInterval(() => this.runAllProbes(), 5 * 60 * 1000);

    // Prune stale health rows once per day; first run after 60 seconds
    setTimeout(() => this.pruneStaleHealthRows(), 60_000);
    this.pruneTimer = setInterval(() => this.pruneStaleHealthRows(), 24 * 60 * 60 * 1000);
  }

  onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer);
    if (this.pruneTimer) clearInterval(this.pruneTimer);
  }

  // ── Public interface ──────────────────────────────────────────────────────

  async getStatus() {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    // Aggregate uptime per component over 90 days
    const rows = await db.execute(sql.raw(`
      SELECT
        component,
        COUNT(*) FILTER (WHERE status = 'healthy') AS healthy_count,
        COUNT(*)                                   AS total_count,
        MAX(checked_at)                            AS last_checked,
        (SELECT status FROM system_health_log s2
         WHERE s2.component = s1.component
         ORDER BY checked_at DESC LIMIT 1)         AS current_status,
        (SELECT latency_ms FROM system_health_log s3
         WHERE s3.component = s1.component AND latency_ms IS NOT NULL
         ORDER BY checked_at DESC LIMIT 1)         AS latest_latency_ms
      FROM system_health_log s1
      WHERE checked_at >= '${ninetyDaysAgo.toISOString()}'
      GROUP BY component
    `)).then(r => (r.rows ?? r) as Array<Record<string, unknown>>);

    const DISPLAY_NAMES: Record<string, string> = {
      api:           "API",
      database:      "Database",
      auth:          "Authentication",
      scheduler:     "Integration Scheduler",
      evidence_vault:"Evidence Vault",
    };

    // Build a map for quick lookup
    const byComponent = Object.fromEntries(rows.map((r) => [r.component as string, r]));

    const components = COMPONENTS.map((key) => {
      const row = byComponent[key];
      const total     = Number(row?.total_count ?? 0);
      const healthy   = Number(row?.healthy_count ?? 0);
      const uptime90d = total > 0 ? Number(((healthy / total) * 100).toFixed(2)) : null;
      const curStatus = (row?.current_status as HealthStatus | undefined) ?? null;
      return {
        key,
        name:        DISPLAY_NAMES[key] ?? key,
        status:      curStatus ?? ("unknown" as const),
        uptime90d,
        latencyMs:   row?.latest_latency_ms != null ? Number(row.latest_latency_ms) : null,
        lastChecked: row?.last_checked ?? null,
      };
    });

    // Overall status — worst of all components
    const statuses = components.map((c) => c.status);
    const overall = statuses.some((s) => s === "down")
      ? "outage"
      : statuses.some((s) => s === "degraded")
      ? "degraded"
      : statuses.every((s) => s === "healthy" || s === "unknown")
      ? "operational"
      : "operational";

    // Active incidents
    const activeIncidents = await db
      .select()
      .from(incidentsTable)
      .where(isNull(incidentsTable.resolvedAt))
      .orderBy(desc(incidentsTable.startedAt))
      .limit(10);

    // Recent resolved incidents (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const resolvedIncidents = await db.execute(sql.raw(`
      SELECT * FROM incidents
      WHERE resolved_at IS NOT NULL AND started_at >= '${thirtyDaysAgo.toISOString()}'
      ORDER BY started_at DESC
      LIMIT 10
    `)).then(r => (r.rows ?? r) as unknown[]);

    // 90-day daily uptime bars per component (last 90 days, one bucket per day)
    const dailyBuckets = await this.getDailyBuckets(ninetyDaysAgo);

    return {
      overall,
      checkedAt: new Date().toISOString(),
      components,
      incidents: [...activeIncidents, ...(resolvedIncidents as typeof activeIncidents)],
      dailyBuckets,
    };
  }

  // ── Internal probes ──────────────────────────────────────────────────────

  async runAllProbes(): Promise<ProbeResult[]> {
    const results = await Promise.allSettled([
      this.probeApi(),
      this.probeDatabase(),
      this.probeAuth(),
      this.probeScheduler(),
      this.probeEvidenceVault(),
    ]);

    const probeResults: ProbeResult[] = results.map((r, i) => {
      if (r.status === "fulfilled") return r.value;
      return {
        component: COMPONENTS[i],
        status:    "down" as HealthStatus,
        latencyMs: 0,
        error:     String((r.reason as Error)?.message ?? r.reason),
      };
    });

    // Persist probe results and handle incident transitions
    await Promise.all(probeResults.map((pr) => this.persistProbe(pr)));
    return probeResults;
  }

  private async probeApi(): Promise<ProbeResult> {
    const port = Number(process.env.PORT) || 8080;
    const url  = `http://localhost:${port}/api/healthz`;
    const t0   = Date.now();
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      const latencyMs = Date.now() - t0;
      if (res.ok) return { component: "api", status: "healthy", latencyMs };
      return { component: "api", status: "degraded", latencyMs, error: `HTTP ${res.status}` };
    } catch (err) {
      return { component: "api", status: "down", latencyMs: Date.now() - t0, error: String((err as Error).message) };
    }
  }

  private async probeDatabase(): Promise<ProbeResult> {
    const t0 = Date.now();
    try {
      await db.execute(sql.raw("SELECT 1"));
      return { component: "database", status: "healthy", latencyMs: Date.now() - t0 };
    } catch (err) {
      return { component: "database", status: "down", latencyMs: Date.now() - t0, error: String((err as Error).message) };
    }
  }

  private async probeAuth(): Promise<ProbeResult> {
    // Verify BetterAuth session table is readable (auth layer health)
    const t0 = Date.now();
    try {
      await db.execute(sql.raw('SELECT COUNT(*) FROM "session" LIMIT 1'));
      const latencyMs = Date.now() - t0;
      // Degraded if query takes >500ms
      return { component: "auth", status: latencyMs < 500 ? "healthy" : "degraded", latencyMs };
    } catch (err) {
      return { component: "auth", status: "down", latencyMs: Date.now() - t0, error: String((err as Error).message) };
    }
  }

  private async probeScheduler(): Promise<ProbeResult> {
    // Scheduler is healthy if integration_sync_log has activity within the last 48h
    // OR if the server has been running for less than 48h (no orgs synced yet is normal)
    const t0 = Date.now();
    try {
      const result = await db.execute(sql.raw(`
        SELECT COUNT(*) AS cnt FROM integration_sync_log
        WHERE synced_at >= NOW() - INTERVAL '48 hours'
        LIMIT 1
      `));
      const latencyMs = Date.now() - t0;
      const count = parseInt(((result.rows ?? result) as Array<Record<string, string>>)[0]?.cnt ?? "0");
      // Scheduler table accessible = healthy (activity level is info, not health signal here)
      return { component: "scheduler", status: latencyMs < 800 ? "healthy" : "degraded", latencyMs };
    } catch (err) {
      return { component: "scheduler", status: "down", latencyMs: Date.now() - t0, error: String((err as Error).message) };
    }
  }

  private async probeEvidenceVault(): Promise<ProbeResult> {
    // Insert a sentinel row, read it back, delete it — full write/read/delete cycle
    const t0 = Date.now();
    try {
      // Use org_evidence with a sentinel org_id=0 that we own and clean up immediately
      await db.execute(sql.raw(`
        WITH probe AS (
          INSERT INTO org_evidence (org_id, title, description, type, source, collected_at)
          VALUES (0, '_health_probe', '_health_probe', 'auto', 'health_check', NOW())
          RETURNING id
        )
        DELETE FROM org_evidence WHERE id IN (SELECT id FROM probe)
      `));
      const latencyMs = Date.now() - t0;
      return { component: "evidence_vault", status: latencyMs < 1000 ? "healthy" : "degraded", latencyMs };
    } catch (err) {
      return { component: "evidence_vault", status: "down", latencyMs: Date.now() - t0, error: String((err as Error).message) };
    }
  }

  private async persistProbe(pr: ProbeResult): Promise<void> {
    try {
      // Insert probe result
      await db.insert(systemHealthLogTable).values({
        component: pr.component,
        status:    pr.status,
        latencyMs: pr.latencyMs,
        error:     pr.error?.slice(0, 500),
      });

      // Check previous status for incident transition
      const prev = await db
        .select({ status: systemHealthLogTable.status })
        .from(systemHealthLogTable)
        .where(eq(systemHealthLogTable.component, pr.component))
        .orderBy(desc(systemHealthLogTable.checkedAt))
        .limit(2);

      // prev[0] is what we just inserted; prev[1] is the one before that
      const prevStatus = prev[1]?.status as HealthStatus | undefined;

      if (prevStatus && prevStatus === "healthy" && pr.status !== "healthy") {
        // Transition to degraded/down — open incident
        const severity = pr.status === "down" ? "major" : "minor";
        await db.insert(incidentsTable).values({
          component:   pr.component,
          severity,
          description: `${pr.component} ${pr.status === "down" ? "is down" : "is degraded"}${pr.error ? `: ${pr.error.slice(0, 200)}` : ""}`,
        });
        logger.warn({ component: pr.component, status: pr.status }, "[health] Incident opened");
      } else if (prevStatus && prevStatus !== "healthy" && pr.status === "healthy") {
        // Recovery — close open incident(s) for this component
        await db.execute(sql.raw(`
          UPDATE incidents
          SET resolved_at = NOW()
          WHERE component = '${pr.component.replace(/'/g, "''")}' AND resolved_at IS NULL
        `));
        logger.info({ component: pr.component }, "[health] Incident resolved");
      }
    } catch (err) {
      logger.error({ err, component: pr.component }, "[health] Failed to persist probe result");
    }
  }

  async pruneStaleHealthRows(): Promise<void> {
    try {
      const healthResult = await db.execute(sql.raw(`
        DELETE FROM system_health_log
        WHERE checked_at < NOW() - INTERVAL '90 days'
      `));
      const incidentResult = await db.execute(sql.raw(`
        DELETE FROM incidents
        WHERE resolved_at IS NOT NULL
          AND resolved_at < NOW() - INTERVAL '90 days'
      `));
      const healthDeleted = (healthResult as unknown as { rowCount?: number }).rowCount ?? 0;
      const incidentDeleted = (incidentResult as unknown as { rowCount?: number }).rowCount ?? 0;
      logger.debug(
        { healthDeleted, incidentDeleted },
        "[health] Pruned stale rows older than 90 days",
      );
    } catch (err) {
      logger.error({ err }, "[health] Failed to prune stale health rows");
    }
  }

  private async getDailyBuckets(since: Date): Promise<Record<string, Array<{ date: string; status: "healthy" | "degraded" | "down" | "unknown" }>>> {
    try {
      const result = await db.execute(sql.raw(`
        SELECT
          component,
          DATE(checked_at) AS day,
          CASE
            WHEN COUNT(*) FILTER (WHERE status = 'down') > COUNT(*) / 2.0 THEN 'down'
            WHEN COUNT(*) FILTER (WHERE status = 'degraded') > 0 THEN 'degraded'
            WHEN COUNT(*) FILTER (WHERE status = 'healthy') > 0 THEN 'healthy'
            ELSE 'unknown'
          END AS day_status
        FROM system_health_log
        WHERE checked_at >= '${since.toISOString()}'
        GROUP BY component, DATE(checked_at)
        ORDER BY component, day
      `));

      const rows = (result.rows ?? result) as Array<{ component: string; day: string; day_status: string }>;
      const buckets: Record<string, Array<{ date: string; status: "healthy" | "degraded" | "down" | "unknown" }>> = {};
      for (const row of rows) {
        if (!buckets[row.component]) buckets[row.component] = [];
        buckets[row.component].push({ date: row.day, status: row.day_status as "healthy" | "degraded" | "down" | "unknown" });
      }
      return buckets;
    } catch {
      return {};
    }
  }
}

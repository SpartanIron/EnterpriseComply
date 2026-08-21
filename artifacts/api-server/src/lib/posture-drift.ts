import { Logger } from "@nestjs/common";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import type { Posture, PostureDivergence } from "./posture";
import { diffPosture } from "./posture";

/**
 * Phase 1 - shadow-mode drift detection for the posture SSOT.
 *
 * The Phase 1 exit criterion is a dashboard, not a memory. Verifying once by
 * hand that the new computation agrees with the old one proves nothing about
 * tomorrow, so this module keeps the comparison running and makes the answer
 * something a person can pull up on demand.
 *
 * Two independent channels, because they fail differently:
 *
 *   1. A log line at warn, prefixed POSTURE_DRIFT, emitted at most once per
 *      cooldown per org. Railway log alerting can key off that literal string,
 *      which is what makes this a standing alert rather than an endpoint nobody
 *      opens. The cooldown exists because the dashboard is polled and an
 *      unthrottled warn per request would bury the signal in its own volume.
 *
 *   2. An in-process ring of recent observations, exposed by
 *      GET /orgs/:orgId/posture/drift.
 *
 * KNOWN LIMITATION, stated rather than discovered later: the ring and the
 * counters are per process. With more than one replica the endpoint reports the
 * replica that answered, not the fleet. That is acceptable for shadow mode,
 * where the question is "do old and new disagree at all", and it is why the log
 * channel exists as well - logs aggregate across replicas, memory does not.
 * Moving the counters into Postgres is the follow-up if drift ever needs to be
 * measured per replica.
 *
 * Recording never throws. Shadow-mode instrumentation that can break the
 * request it is observing is worse than no instrumentation.
 */

const logger = new Logger("PostureDrift");

/** Literal alert key. Do not change without updating the log-based alert. */
export const POSTURE_DRIFT_LOG_KEY = "POSTURE_DRIFT";

const RING_CAPACITY = 50;
const LOG_COOLDOWN_MS = 60_000;

/**
 * How often a clean observation is written to the durable ledger. Drift is
 * always written; clean state is sampled.
 *
 * Without this the ledger would take one row per dashboard poll and measure
 * traffic rather than posture. With it, the ledger's observation count is a
 * heartbeat count, and the in-memory report remains the place to look for
 * per-process request volume. Both are reported, each labelled.
 */
const CLEAN_HEARTBEAT_MS = 15 * 60_000;

export interface PostureDriftSample {
  at: string;
  orgId: number;
  divergenceCount: number;
  divergences: PostureDivergence[];
}

export interface PostureDriftReport {
  /** True when the most recent observation for this org found no divergence. */
  clean: boolean;
  observations: number;
  observationsWithDrift: number;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  lastCleanAt: string | null;
  recent: PostureDriftSample[];
  note: string;
}

interface OrgDriftState {
  observations: number;
  observationsWithDrift: number;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  lastCleanAt: string | null;
  lastLoggedAtMs: number;
  lastPersistedCleanAtMs: number;
  ring: PostureDriftSample[];
}

const stateByOrg = new Map<number, OrgDriftState>();

function stateFor(orgId: number): OrgDriftState {
  let state = stateByOrg.get(orgId);
  if (!state) {
    state = {
      observations: 0,
      observationsWithDrift: 0,
      firstSeenAt: null,
      lastSeenAt: null,
      lastCleanAt: null,
      lastLoggedAtMs: 0,
      lastPersistedCleanAtMs: 0,
      ring: [],
    };
    stateByOrg.set(orgId, state);
  }
  return state;
}

/**
 * Compare a freshly computed posture against the legacy figures and record the
 * result. Returns the divergences so a caller can attach them to a response,
 * and swallows its own failures so it cannot affect the request it observes.
 */
export function recordPostureDrift(posture: Posture): PostureDivergence[] {
  try {
    const divergences = diffPosture(posture);
    const state = stateFor(posture.orgId);
    const now = new Date();
    const nowIso = now.toISOString();

    state.observations += 1;

    if (divergences.length === 0) {
      state.lastCleanAt = nowIso;
      // Clean state is sampled rather than recorded per request. See
      // CLEAN_HEARTBEAT_MS: a row per poll would measure traffic.
      if (now.getTime() - state.lastPersistedCleanAtMs >= CLEAN_HEARTBEAT_MS) {
        state.lastPersistedCleanAtMs = now.getTime();
        void persistObservation(posture, divergences);
      }
      return divergences;
    }

    // Drift is always written. This is the row that has to survive a restart,
    // because a restart is when a computation is most likely to start
    // disagreeing with the one it replaced.
    void persistObservation(posture, divergences);

    state.observationsWithDrift += 1;
    if (!state.firstSeenAt) state.firstSeenAt = nowIso;
    state.lastSeenAt = nowIso;

    state.ring.push({
      at: nowIso,
      orgId: posture.orgId,
      divergenceCount: divergences.length,
      divergences,
    });
    if (state.ring.length > RING_CAPACITY) state.ring.shift();

    const nowMs = now.getTime();
    if (nowMs - state.lastLoggedAtMs >= LOG_COOLDOWN_MS) {
      state.lastLoggedAtMs = nowMs;
      // One line, one JSON payload, stable key. Greppable and alertable.
      logger.warn(
        `${POSTURE_DRIFT_LOG_KEY} ` +
          JSON.stringify({
            orgId: posture.orgId,
            schema: posture.schema,
            divergences: divergences.length,
            fields: divergences.map((d) => `${d.surface}.${d.field}`),
            unrecognisedStatuses: posture.unrecognisedStatuses,
            orphanedResults: posture.orphanedResults,
          }),
      );
    }

    return divergences;
  } catch (err) {
    logger.error(
      "posture drift recording failed; request unaffected",
      (err as { message?: string })?.message ?? String(err),
    );
    return [];
  }
}

/**
 * Write one observation to the durable ledger.
 *
 * Fire and forget, and it swallows its own failures for the same reason the rest
 * of this module does: shadow-mode instrumentation that can break the request it
 * observes is worse than no instrumentation. A failure here loses a row, not a
 * response.
 *
 * Raw SQL rather than a drizzle table object, deliberately: the ledger is
 * written by the observer and read by one endpoint, and keeping it out of the
 * shared schema means a table that only exists for diagnostics cannot be
 * accidentally joined into a tenant query.
 */
async function persistObservation(
  posture: Posture,
  divergences: PostureDivergence[],
): Promise<void> {
  try {
    await db.execute(sql`
      INSERT INTO posture_drift_observations
        (org_id, schema, divergence_count, divergences, unrecognised_statuses, orphaned_results)
      VALUES (
        ${posture.orgId},
        ${posture.schema},
        ${divergences.length},
        ${JSON.stringify(divergences)}::jsonb,
        ${JSON.stringify(posture.unrecognisedStatuses)}::jsonb,
        ${posture.orphanedResults}
      )
    `);
  } catch (err) {
    logger.warn(
      "POSTURE_DRIFT_LEDGER_WRITE_FAILED " +
        ((err as { message?: string })?.message ?? String(err)) +
        ". The observation was logged and held in memory but not persisted.",
    );
  }
}

export interface PersistedDriftLedger {
  source: "posture_drift_observations";
  available: boolean;
  /** Rows in the ledger for this org. Heartbeats plus every drift observation. */
  observations: number;
  observationsWithDrift: number;
  firstObservedAt: string | null;
  lastObservedAt: string | null;
  lastDriftAt: string | null;
  recent: Array<{
    at: string;
    divergenceCount: number;
    divergences: PostureDivergence[];
  }>;
  note: string;
}

/**
 * Read the durable ledger. Separate from getPostureDriftReport because the two
 * answer different questions: that one is what this process has seen since it
 * started, this one is what has ever been seen.
 */
export async function getPersistedDriftLedger(orgId: number): Promise<PersistedDriftLedger> {
  const empty: PersistedDriftLedger = {
    source: "posture_drift_observations",
    available: false,
    observations: 0,
    observationsWithDrift: 0,
    firstObservedAt: null,
    lastObservedAt: null,
    lastDriftAt: null,
    recent: [],
    note:
      "The durable ledger could not be read. The in-memory report above still " +
      "covers this process, but nothing here survives a restart.",
  };

  try {
    const summary: any = await db.execute(sql`
      SELECT
        count(*)::int AS observations,
        count(*) FILTER (WHERE divergence_count > 0)::int AS with_drift,
        min(observed_at) AS first_observed_at,
        max(observed_at) AS last_observed_at,
        max(observed_at) FILTER (WHERE divergence_count > 0) AS last_drift_at
      FROM posture_drift_observations
      WHERE org_id = ${orgId}
    `);
    const rows = (summary?.rows ?? summary) as Array<Record<string, unknown>>;
    const row = Array.isArray(rows) ? rows[0] : undefined;
    if (!row) return empty;

    const recentResult: any = await db.execute(sql`
      SELECT observed_at, divergence_count, divergences
      FROM posture_drift_observations
      WHERE org_id = ${orgId} AND divergence_count > 0
      ORDER BY observed_at DESC
      LIMIT 20
    `);
    const recentRows = (recentResult?.rows ?? recentResult) as Array<Record<string, unknown>>;

    const iso = (value: unknown): string | null =>
      value ? new Date(value as string).toISOString() : null;

    return {
      source: "posture_drift_observations",
      available: true,
      observations: Number(row.observations ?? 0),
      observationsWithDrift: Number(row.with_drift ?? 0),
      firstObservedAt: iso(row.first_observed_at),
      lastObservedAt: iso(row.last_observed_at),
      lastDriftAt: iso(row.last_drift_at),
      recent: (Array.isArray(recentRows) ? recentRows : []).map((r) => ({
        at: new Date(r.observed_at as string).toISOString(),
        divergenceCount: Number(r.divergence_count ?? 0),
        divergences: (r.divergences ?? []) as PostureDivergence[],
      })),
      note:
        "Every observation with drift is recorded. Clean observations are " +
        "sampled at most once per fifteen minutes per organisation, so the " +
        "observation count is a heartbeat count rather than a request count.",
    };
  } catch (err) {
    logger.warn(
      "POSTURE_DRIFT_LEDGER_READ_FAILED " +
        ((err as { message?: string })?.message ?? String(err)),
    );
    return empty;
  }
}

export function getPostureDriftReport(orgId: number): PostureDriftReport {
  const state = stateByOrg.get(orgId);

  if (!state) {
    return {
      clean: true,
      observations: 0,
      observationsWithDrift: 0,
      firstSeenAt: null,
      lastSeenAt: null,
      lastCleanAt: null,
      recent: [],
      note:
        "No observations recorded in this process yet. The counters are per replica; " +
        "see the POSTURE_DRIFT log key for the fleet-wide view.",
    };
  }

  return {
    // Clean means the newest observation was clean, not that drift never happened.
    clean:
      state.lastCleanAt !== null &&
      (state.lastSeenAt === null || state.lastCleanAt >= state.lastSeenAt),
    observations: state.observations,
    observationsWithDrift: state.observationsWithDrift,
    firstSeenAt: state.firstSeenAt,
    lastSeenAt: state.lastSeenAt,
    lastCleanAt: state.lastCleanAt,
    recent: [...state.ring].reverse(),
    note:
      "Counters are per process. With multiple replicas this is the replica that " +
      "answered, not the fleet; the POSTURE_DRIFT log key aggregates across all of them.",
  };
}

/** Test hook. Not called by application code. */
export function resetPostureDriftState(): void {
  stateByOrg.clear();
}

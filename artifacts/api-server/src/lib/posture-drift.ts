import { Logger } from "@nestjs/common";
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
      return divergences;
    }

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

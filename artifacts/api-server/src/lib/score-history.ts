/**
 * Compliance score history.
 *
 * What this replaces. getHistory() used to return a fabricated ninety-day
 * series whenever the table was empty. It eased a curve from
 * Math.max(currentScore - 35, 20) up to a score it computed itself, added
 * Math.random() noise, and gave every point a negative id. On the live
 * organisation that produced a trend line running 17 to 23 with today's point
 * at 22, while the posture single source of truth said 3.
 *
 * Two things were wrong with it. The numbers were invented, and they were
 * invented using the same derive-by-percentage arithmetic Phase 1 removed
 * everywhere else, so the trend was the last surface still disagreeing with the
 * SSOT. Invented compliance trend data is worse than absent compliance trend
 * data in a tool whose output is meant to support a CMMC or FedRAMP assessment,
 * so the generator is deleted rather than corrected.
 *
 * What replaces it. Recorded points only, written from the SSOT, at most one per
 * organisation per UTC day, and a basis block that says what the number means.
 */

import { db, complianceScoreHistoryTable } from "@workspace/db";
import { and, asc, eq, gte, lt } from "drizzle-orm";
import { POSTURE_SCHEMA_VERSION, computePosture } from "./posture";

export type ScoreHistoryRow = typeof complianceScoreHistoryTable.$inferSelect;

export interface ScoreHistoryBasis {
  source: "compliance_score_history";
  schema: string;
  /** What the stored number means, spelled out for whoever reads the chart. */
  metric: string;
  points: number;
  earliest: string | null;
  latest: string | null;
  /**
   * Always false. Present because it used to be true without saying so, and a
   * consumer that cannot tell measured data from generated data will eventually
   * put generated data in front of an assessor.
   */
  synthetic: false;
  /** Which columns a historical row carries, and which it does not. */
  storedCounts: string;
  note: string;
}

export interface ScoreHistoryResult {
  history: ScoreHistoryRow[];
  basis: ScoreHistoryBasis;
}

const METRIC =
  "passing objectives / total assigned objectives, rounded - the same figure " +
  "the dashboard header shows, from the same computation";

const STORED_COUNTS =
  "Each row carries overallScore, passingControls and failingControls. Warning " +
  "and not-tested counts are not stored historically; read /orgs/:orgId/posture " +
  "for the current full breakdown.";

const NOTE_WITH_POINTS =
  "Every point was recorded from the posture single source of truth at the time " +
  "shown. Nothing here is interpolated, smoothed, back-filled or generated.";

const NOTE_EMPTY =
  "No score has been recorded for this organisation yet. A point is written per " +
  "UTC day, so a trend appears from the second day of use. An empty series means " +
  "there is no history, not that the score is zero.";

/** Start of the UTC day containing `when`, and the start of the next one. */
export function utcDayBounds(when: Date): { start: Date; next: Date } {
  const start = new Date(
    Date.UTC(when.getUTCFullYear(), when.getUTCMonth(), when.getUTCDate()),
  );
  return { start, next: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
}

export async function readScoreHistory(orgId: number): Promise<ScoreHistoryResult> {
  const history = await db
    .select()
    .from(complianceScoreHistoryTable)
    .where(eq(complianceScoreHistoryTable.orgId, orgId))
    .orderBy(asc(complianceScoreHistoryTable.recordedAt));

  const first = history[0];
  const last = history[history.length - 1];

  return {
    history,
    basis: {
      source: "compliance_score_history",
      schema: POSTURE_SCHEMA_VERSION,
      metric: METRIC,
      points: history.length,
      earliest: first ? new Date(first.recordedAt).toISOString() : null,
      latest: last ? new Date(last.recordedAt).toISOString() : null,
      synthetic: false,
      storedCounts: STORED_COUNTS,
      note: history.length > 0 ? NOTE_WITH_POINTS : NOTE_EMPTY,
    },
  };
}

export interface SnapshotOutcome {
  orgId: number;
  /** The score written, taken straight from the SSOT. */
  score: number;
  created: boolean;
  updated: boolean;
  recordedAt: string;
}

/**
 * Write today's point for one organisation.
 *
 * Idempotent per UTC day by design rather than by accident. The snapshot runs at
 * boot, and a restart loop would otherwise write a point per boot until the
 * chart showed deployment frequency instead of score movement. When a point for
 * today already exists it is updated in place, so the day's value tracks the
 * most recent measurement instead of freezing at whatever the first boot saw.
 *
 * The score is posture.scorePercent, not a locally recomputed percentage. That
 * is the whole point: the header and the trend cannot disagree if neither one
 * does its own arithmetic.
 */
export async function recordScoreSnapshot(
  orgId: number,
  now: Date = new Date(),
): Promise<SnapshotOutcome> {
  const posture = await computePosture(orgId);
  const { start, next } = utcDayBounds(now);

  const today = await db
    .select()
    .from(complianceScoreHistoryTable)
    .where(
      and(
        eq(complianceScoreHistoryTable.orgId, orgId),
        gte(complianceScoreHistoryTable.recordedAt, start),
        lt(complianceScoreHistoryTable.recordedAt, next),
      ),
    )
    .orderBy(asc(complianceScoreHistoryTable.recordedAt));

  const values = {
    orgId,
    overallScore: posture.scorePercent,
    frameworkKey: null,
    frameworkScore: null,
    passingControls: posture.counts.passing,
    failingControls: posture.counts.failing,
    recordedAt: now,
  };

  if (today.length > 0) {
    const target = today[today.length - 1];
    await db
      .update(complianceScoreHistoryTable)
      .set(values)
      .where(eq(complianceScoreHistoryTable.id, target.id));
    return {
      orgId,
      score: posture.scorePercent,
      created: false,
      updated: true,
      recordedAt: now.toISOString(),
    };
  }

  await db.insert(complianceScoreHistoryTable).values(values);
  return {
    orgId,
    score: posture.scorePercent,
    created: true,
    updated: false,
    recordedAt: now.toISOString(),
  };
}

export interface SnapshotSweep {
  orgs: number;
  created: number;
  updated: number;
  failed: number;
}

/**
 * Snapshot every organisation. One organisation failing must not stop the rest,
 * because a missing point is a gap in a chart while a thrown error at boot is an
 * outage.
 */
export async function recordScoreSnapshots(
  orgIds: number[],
  onError?: (orgId: number, err: unknown) => void,
  now: Date = new Date(),
): Promise<SnapshotSweep> {
  const sweep: SnapshotSweep = { orgs: orgIds.length, created: 0, updated: 0, failed: 0 };
  for (const orgId of orgIds) {
    try {
      const outcome = await recordScoreSnapshot(orgId, now);
      if (outcome.created) sweep.created += 1;
      if (outcome.updated) sweep.updated += 1;
    } catch (err) {
      sweep.failed += 1;
      onError?.(orgId, err);
    }
  }
  return sweep;
}

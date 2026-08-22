/**
 * Retracting a control result that an integration wrote.
 *
 * WHY THIS EXISTS
 *
 * On 2026-08-22 a probe against the live tenant reached the old route
 * POST /orgs/:orgId/integrations/:key/demo-connect while the previous build
 * was still serving traffic. That route fabricated compliance data: it wrote
 * status "passing" and the sentence "Slack: control verified via automated
 * scan" into the org_control_results rows for UCO-AC-001 and UCO-DP-003, and
 * inserted two evidence records describing scans that had never run. The
 * route is gone. The rows it had already written stayed.
 *
 * Disconnecting the integration removed the connection and left the results
 * standing, because nothing in this codebase could retract an automated
 * result. The two paths that did exist were both wrong:
 *
 *   - PATCH /orgs/:orgId/controls/:controlId/result forces manualOverride to
 *     true and stamps manualOverrideBy. Using it would have replaced a
 *     fabricated machine assertion with a fabricated human one, and an
 *     assessor reading the row would conclude that a named officer had
 *     attested to the control.
 *
 *   - A direct UPDATE against the database would have left no audit record,
 *     which is precisely the question an assessor asks about a status that
 *     changed.
 *
 * So retraction is a first-class operation with its own audit action, and the
 * decision about whether a row may be retracted lives here, as a pure
 * function, so it can be tested without a database and cannot drift away from
 * the endpoint that applies it.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO
 *
 * It does not restore a previous status. The status these two rows held
 * before the probe overwrote them is not recoverable from the database: the
 * connector updated the existing rows in place and the audit log of the day
 * recorded the HTTP call, not the values it replaced. Guessing would be a
 * second fabrication. Retraction therefore lands on not_tested, which is the
 * honest statement - nothing has tested this control - and the previous
 * values are snapshotted into the audit log so a future retraction is
 * reversible even though this one is not.
 */

/** The only status a retraction may produce. */
export const CLEARED_STATUS = "not_tested";

/** The subset of an org_control_results row this decision reads. */
export interface ClearableResultRow {
  status: string | null;
  result: string | null;
  evidence: string | null;
  evidenceUrl: string | null;
  integrationKey: string | null;
  failureReason: string | null;
  lastTestedAt: Date | string | null;
  manualOverride: boolean | null;
}

/** What the row asserted before retraction. Written to the audit log. */
export interface ClearedPrevious {
  status: string | null;
  result: string | null;
  evidence: string | null;
  evidenceUrl: string | null;
  integrationKey: string | null;
  failureReason: string | null;
  lastTestedAt: string | null;
}

/**
 * The write. Note what is absent: manualOverride and manualOverrideBy are not
 * fields of this object and must never become fields of it. A retraction is
 * the removal of an assertion, not the making of a new one.
 */
export interface ClearedUpdates {
  status: string;
  result: null;
  evidence: null;
  evidenceUrl: null;
  integrationKey: null;
  failureReason: null;
  lastTestedAt: null;
  nextTestAt: null;
}

export type ClearRefusalReason = "no_result" | "manual_override" | "not_automated";

export interface ClearRefused {
  ok: false;
  reason: ClearRefusalReason;
  message: string;
}

export interface ClearAllowed {
  ok: true;
  previous: ClearedPrevious;
  updates: ClearedUpdates;
}

export type ClearPlan = ClearRefused | ClearAllowed;

function isoOrNull(value: Date | string | null | undefined): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString();
}

/**
 * Decide whether a stored result may be retracted, and if so, exactly what to
 * write and what to record as having been there before.
 */
export function planAutomatedResultClear(
  row: ClearableResultRow | null | undefined,
): ClearPlan {
  if (!row) {
    return {
      ok: false,
      reason: "no_result",
      message:
        "This control has no stored result, so there is no assertion to retract.",
    };
  }

  if (row.manualOverride === true) {
    return {
      ok: false,
      reason: "manual_override",
      message:
        "This result was set by a person, not by an integration. A human " +
        "attestation is not this endpoint's to erase - change it through the " +
        "control result update instead.",
    };
  }

  if (!row.integrationKey) {
    return {
      ok: false,
      reason: "not_automated",
      message:
        "No integration is recorded against this result, so there is no " +
        "automated assertion to retract.",
    };
  }

  return {
    ok: true,
    previous: {
      status: row.status ?? null,
      result: row.result ?? null,
      evidence: row.evidence ?? null,
      evidenceUrl: row.evidenceUrl ?? null,
      integrationKey: row.integrationKey,
      failureReason: row.failureReason ?? null,
      lastTestedAt: isoOrNull(row.lastTestedAt),
    },
    updates: {
      status: CLEARED_STATUS,
      result: null,
      evidence: null,
      evidenceUrl: null,
      integrationKey: null,
      failureReason: null,
      lastTestedAt: null,
      nextTestAt: null,
    },
  };
}

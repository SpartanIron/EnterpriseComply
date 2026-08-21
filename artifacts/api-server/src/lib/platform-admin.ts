import { ForbiddenException, Logger } from "@nestjs/common";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

/**
 * platform-admin.ts - the one and only place that decides platform access.
 *
 * There used to be three copies of this check, in admin.controller.ts,
 * crosswalk.controller.ts and orgs.service.ts, each independently querying
 * org_members for a super_admin row. Three copies means three places to get it
 * wrong and no single place to add a control. This is that single place.
 *
 * The model is break-glass, not standing privilege:
 *
 *   1. A row in platform_admins says a person MAY elevate. On its own it grants
 *      nothing at all - every privileged endpoint still refuses them.
 *   2. To actually get access they must open an elevation: give a reason, prove a
 *      second factor, and accept a hard expiry. Sixty minutes, no renewal.
 *   3. Every privileged request served under an elevation is recorded against it,
 *      so "what did staff look at, and when" has an answer.
 *
 * Controls: NIST AC-2(7) privileged account management, AC-6(1) least privilege,
 * AC-6(9) auditing use of privileged functions, AU-2 audit events, IA-2(1) MFA
 * for privileged access.
 */

const logger = new Logger("PlatformAdmin");

/** Hard ceiling on a single elevation. Deliberately short and not renewable. */
export const MAX_ELEVATION_MS = 60 * 60 * 1000;

/** A reason short enough to be useless is worse than none, because it looks like process. */
export const MIN_REASON_LENGTH = 12;
export const MAX_REASON_LENGTH = 500;

export interface Elevation {
  id: number;
  userId: string;
  reason: string;
  requestedAt: string;
  expiresAt: string;
  endedAt: string | null;
  endedReason: string | null;
}

function rowsOf(result: any): any[] {
  if (!result) return [];
  if (Array.isArray(result)) return result;
  if (Array.isArray(result.rows)) return result.rows;
  return [];
}

/** True when the user holds a platform_admins row. Grants nothing by itself. */
export async function isPlatformAdmin(userId: string): Promise<boolean> {
  if (!userId) return false;
  const rows = rowsOf(
    await db.execute(sql`SELECT 1 FROM platform_admins WHERE user_id = ${userId} LIMIT 1`),
  );
  return rows.length > 0;
}

/**
 * The email recorded for a platform administrator, or null.
 *
 * Read from platform_admins rather than from the tenant membership that used to
 * carry it, so audit writes keep an actor email now that platform staff are no
 * longer org members.
 */
export async function platformAdminEmail(userId: string): Promise<string | null> {
  if (!userId) return null;
  const rows = rowsOf(
    await db.execute(sql`SELECT email FROM platform_admins WHERE user_id = ${userId} LIMIT 1`),
  );
  const email = rows[0]?.email;
  return email ? String(email) : null;
}

/**
 * The live elevation for a user, or null.
 *
 * Expiry is evaluated in SQL against NOW() rather than in JavaScript against
 * Date.now(), so a wrong clock on the API container cannot extend somebody
 * access. The database is the single clock.
 */
export async function getActiveElevation(userId: string): Promise<Elevation | null> {
  if (!userId) return null;
  const rows = rowsOf(
    await db.execute(sql`
      SELECT id, user_id, reason, requested_at, expires_at, ended_at, ended_reason
      FROM platform_elevations
      WHERE user_id = ${userId}
        AND ended_at IS NULL
        AND expires_at > NOW()
      ORDER BY requested_at DESC
      LIMIT 1
    `),
  );
  const r = rows[0];
  if (!r) return null;
  return {
    id: Number(r.id),
    userId: String(r.user_id),
    reason: String(r.reason),
    requestedAt: new Date(r.requested_at).toISOString(),
    expiresAt: new Date(r.expires_at).toISOString(),
    endedAt: r.ended_at ? new Date(r.ended_at).toISOString() : null,
    endedReason: r.ended_reason ? String(r.ended_reason) : null,
  };
}

/**
 * The gate every privileged endpoint calls.
 *
 * Two distinct refusals, deliberately distinguishable so the UI can tell a person
 * who simply is not staff from a member of staff who needs to break glass:
 *
 *   403 platform_admin_required - you are not on the list at all
 *   403 elevation_required      - you are, but you hold no live elevation
 *
 * `operation` is a short stable label such as "orgs.plan.change". It is recorded
 * against the elevation so the access log says what was actually done, not merely
 * that somebody was elevated at the time.
 */
export async function assertPlatformAccess(
  userId: string,
  operation: string,
  orgId?: number | null,
): Promise<Elevation> {
  if (!(await isPlatformAdmin(userId))) {
    throw new ForbiddenException({
      error: "platform_admin_required",
      message: "This endpoint is restricted to platform administrators.",
    });
  }

  const elevation = await getActiveElevation(userId);
  if (!elevation) {
    throw new ForbiddenException({
      error: "elevation_required",
      message:
        "Platform access is not standing. Open a time-boxed elevation with a reason and an authenticator code to continue.",
      challengePath: "/api/platform/elevate",
    });
  }

  await recordPlatformAccess(elevation.id, userId, operation, orgId ?? null);
  return elevation;
}

/**
 * Append to the access log.
 *
 * Never throws. A failed log write must not hand somebody access silently, but it
 * also must not break the operation it is recording - so it is loud in the
 * application log instead. The alternative, failing the request, would let a
 * full disk turn into an outage of every privileged endpoint.
 */
export async function recordPlatformAccess(
  elevationId: number | null,
  userId: string,
  operation: string,
  orgId: number | null,
): Promise<void> {
  try {
    await db.execute(sql`
      INSERT INTO platform_access_log (elevation_id, user_id, operation, org_id)
      VALUES (${elevationId}, ${userId}, ${operation}, ${orgId})
    `);
  } catch (err) {
    logger.error(
      `Failed to record platform access "${operation}" by ${userId}: ` +
        ((err as any)?.message ?? String(err)),
    );
  }
}

export interface ElevationRequest {
  userId: string;
  reason: string;
  ttlMs?: number;
  ipAddress?: string | null;
}

/** Validate a reason. Exported so the parser can be unit tested without a database. */
export function validateReason(reason: unknown): string {
  const text = typeof reason === "string" ? reason.trim() : "";
  if (text.length < MIN_REASON_LENGTH) {
    throw new ForbiddenException({
      error: "reason_required",
      message: `Give a reason of at least ${MIN_REASON_LENGTH} characters. It is written to the audit log.`,
    });
  }
  return text.slice(0, MAX_REASON_LENGTH);
}

/** Clamp a requested TTL into (0, MAX_ELEVATION_MS]. Exported for the same reason. */
export function clampTtl(requested: unknown): number {
  const n = Number(requested);
  if (!Number.isFinite(n) || n <= 0) return MAX_ELEVATION_MS;
  return Math.min(Math.floor(n), MAX_ELEVATION_MS);
}

/**
 * Open an elevation. The caller is responsible for having already verified the
 * second factor - this function only records the decision.
 *
 * Any existing live elevation is ended first, so a user always has at most one.
 * That keeps the access log unambiguous about which elevation a request belongs to.
 */
export async function openElevation(req: ElevationRequest): Promise<Elevation> {
  const reason = validateReason(req.reason);
  const ttlMs = clampTtl(req.ttlMs);

  await db.execute(sql`
    UPDATE platform_elevations
    SET ended_at = NOW(), ended_reason = ${"superseded by a new elevation"}
    WHERE user_id = ${req.userId} AND ended_at IS NULL AND expires_at > NOW()
  `);

  const seconds = Math.floor(ttlMs / 1000);
  await db.execute(sql`
    INSERT INTO platform_elevations (user_id, reason, expires_at, ip_address)
    VALUES (
      ${req.userId},
      ${reason},
      NOW() + (${seconds} * INTERVAL '1 second'),
      ${req.ipAddress ?? null}
    )
  `);

  const elevation = await getActiveElevation(req.userId);
  if (!elevation) {
    // Should be unreachable. Failing closed is the only safe response.
    throw new ForbiddenException({
      error: "elevation_failed",
      message: "The elevation could not be recorded, so access was not granted.",
    });
  }

  logger.warn(
    `Platform elevation opened for ${req.userId} until ${elevation.expiresAt}: ${reason}`,
  );
  await recordPlatformAccess(elevation.id, req.userId, "platform.elevation.open", null);
  return elevation;
}

/** End an elevation early. Idempotent: ending nothing is not an error. */
export async function endElevation(userId: string, endedReason: string): Promise<boolean> {
  const result = await db.execute(sql`
    UPDATE platform_elevations
    SET ended_at = NOW(), ended_reason = ${endedReason}
    WHERE user_id = ${userId} AND ended_at IS NULL AND expires_at > NOW()
  `);
  const ended = Number((result as any)?.rowCount ?? 0) > 0;
  if (ended) {
    logger.log(`Platform elevation ended for ${userId}: ${endedReason}`);
    await recordPlatformAccess(null, userId, "platform.elevation.end", null);
  }
  return ended;
}

/** Recent elevation history for a user. Transparency, not debugging. */
export async function listElevations(userId: string, limit = 20): Promise<Elevation[]> {
  const rows = rowsOf(
    await db.execute(sql`
      SELECT id, user_id, reason, requested_at, expires_at, ended_at, ended_reason
      FROM platform_elevations
      WHERE user_id = ${userId}
      ORDER BY requested_at DESC
      LIMIT ${Math.max(1, Math.min(100, limit))}
    `),
  );
  return rows.map((r) => ({
    id: Number(r.id),
    userId: String(r.user_id),
    reason: String(r.reason),
    requestedAt: new Date(r.requested_at).toISOString(),
    expiresAt: new Date(r.expires_at).toISOString(),
    endedAt: r.ended_at ? new Date(r.ended_at).toISOString() : null,
    endedReason: r.ended_reason ? String(r.ended_reason) : null,
  }));
}

/**
 * Parse PLATFORM_ADMIN_EMAILS. Exported so it can be unit tested without a database.
 *
 * Strict by design. A typo that silently grants nobody is recoverable; a typo that
 * silently grants the wrong person is not.
 */
export function parsePlatformAdminEmails(raw: string | undefined | null): {
  emails: string[];
  invalid: string[];
} {
  const emails: string[] = [];
  const invalid: string[] = [];
  if (!raw || !raw.trim()) return { emails, invalid };

  const seen = new Set<string>();
  for (const chunk of raw.split(",")) {
    const item = chunk.trim().toLowerCase();
    if (!item) continue;
    // Deliberately conservative: one @, something either side, a dot in the domain.
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item)) {
      invalid.push(`${item} (not an email address)`);
      continue;
    }
    if (seen.has(item)) continue;
    seen.add(item);
    emails.push(item);
  }
  return { emails, invalid };
}

export interface ReconcileResult {
  granted: string[];
  revoked: string[];
  unchanged: string[];
  unknown: string[];
  invalid: string[];
}

/**
 * Reconcile platform_admins against PLATFORM_ADMIN_EMAILS on every boot.
 *
 * Three properties that the obvious implementation gets wrong:
 *
 *   Reconciled, not additive. Removing an address from the variable revokes the
 *   row. An additive bootstrap leaves a permanent grant behind that outlives the
 *   configuration, which is the drift bug that makes env-var bootstrapping unsafe.
 *
 *   Never creates users. An address is matched against existing rows in "user".
 *   If nobody has signed up with it, nothing is granted and the operator is told.
 *   Email is an identifier, not an authenticator, so this must not be a path by
 *   which registering an address confers platform access.
 *
 *   A grant is not access. Landing in platform_admins only confers the right to
 *   request a time-boxed elevation, which itself demands an authenticator code.
 *   So a platform administrator with no second factor enrolled cannot use the
 *   privilege at all, which is the intended outcome of IA-2(1).
 */
export async function reconcilePlatformAdmins(
  dbHandle: any,
  raw: string | undefined | null,
  log: Logger,
): Promise<ReconcileResult> {
  const result: ReconcileResult = {
    granted: [],
    revoked: [],
    unchanged: [],
    unknown: [],
    invalid: [],
  };

  const { emails, invalid } = parsePlatformAdminEmails(raw);
  result.invalid = invalid;
  for (const bad of invalid) {
    log.warn(`PLATFORM_ADMIN_EMAILS entry skipped: ${bad}`);
  }

  const existing = rowsOf(
    await dbHandle.execute(sql`SELECT user_id, email FROM platform_admins`),
  ).map((r: any) => ({ userId: String(r.user_id), email: String(r.email ?? "").toLowerCase() }));

  const desiredUserIds = new Set<string>();

  for (const email of emails) {
    const found = rowsOf(
      await dbHandle.execute(
        sql`SELECT id, email FROM "user" WHERE LOWER(email) = ${email} LIMIT 1`,
      ),
    );
    if (found.length === 0) {
      result.unknown.push(email);
      log.warn(
        `PLATFORM_ADMIN_EMAILS names "${email}", which has no account yet - nothing granted. ` +
          "Have them sign in once, then restart.",
      );
      continue;
    }

    const userId = String(found[0].id);
    desiredUserIds.add(userId);

    if (existing.some((e) => e.userId === userId)) {
      result.unchanged.push(email);
      continue;
    }

    await dbHandle.execute(sql`
      INSERT INTO platform_admins (user_id, email, granted_by, note)
      VALUES (${userId}, ${email}, ${"config:PLATFORM_ADMIN_EMAILS"}, ${"granted by configuration on boot"})
      ON CONFLICT (user_id) DO NOTHING
    `);
    result.granted.push(email);
    log.warn(`Platform administrator granted to ${email} by configuration`);
  }

  // Revoke anything no longer listed. This is what makes the variable authoritative
  // rather than merely additive.
  for (const row of existing) {
    if (desiredUserIds.has(row.userId)) continue;
    await dbHandle.execute(sql`DELETE FROM platform_admins WHERE user_id = ${row.userId}`);
    // Any live elevation held by a revoked administrator dies with the grant.
    await dbHandle.execute(sql`
      UPDATE platform_elevations
      SET ended_at = NOW(), ended_reason = ${"platform administrator revoked"}
      WHERE user_id = ${row.userId} AND ended_at IS NULL AND expires_at > NOW()
    `);
    result.revoked.push(row.email || row.userId);
    log.warn(`Platform administrator revoked for ${row.email || row.userId} - no longer configured`);
  }

  return result;
}

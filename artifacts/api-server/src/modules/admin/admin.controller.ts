import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ClerkAuthGuard, ClerkUserId } from "../../guards/clerk-auth.guard";
import {
  db,
  organizationsTable,
  orgIntegrationsTable,
  orgAuditLogTable,
} from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { readDbSecurityPosture } from "../../migrations/tenant-rls.migration.js";
import { SECURITY_RULES, SecurityMonitorService } from "./security-monitor.service";
import { writeAuditLog } from "../../lib/audit-log.js";
import { listBlocked, clearBlock } from "../../lib/auth-failure-tracker.js";
import { listActiveThrottles, resetMagicLinkRateForIp } from "../../lib/magic-link-rate-limiter.js";
import {
  reEncryptWithNewKey,
  reEncryptConfigWithNewKey,
  rotateCredentialValue,
  getDerivedKeyBuffer,
  keyFingerprint,
  credentialKeyMode,
  isEncryptedCredential,
  decryptCredential,
} from "../../lib/credential-crypto.js";
import { readOriginTrustPosture } from "../../middleware/origin-trust.middleware.js";
import { assertPlatformAccess, platformAdminEmail } from "../../lib/platform-admin.js";

/**
 * Every privileged endpoint in this controller goes through the one shared gate in
 * lib/platform-admin.ts. This wrapper exists only to carry the actor email that
 * two of the audit writes below want, so the gate stays the single authority on
 * whether access is allowed.
 *
 * `operation` is recorded against the caller's elevation, so the access log says
 * what was actually done rather than merely that somebody was elevated.
 */
async function assertPlatformOperation(userId: string, operation: string, orgId?: number) {
  await assertPlatformAccess(userId, operation, orgId ?? null);
  return { email: await platformAdminEmail(userId) };
}

/**
 * Raw SQL results arrive either as a plain array or as { rows: [...] }
 * depending on the driver, so every raw read in this file goes through here.
 */
function resultRows<T = Record<string, unknown>>(result: unknown): T[] {
  if (!result) return [];
  if (Array.isArray(result)) return result as T[];
  const rows = (result as { rows?: unknown }).rows;
  return Array.isArray(rows) ? (rows as T[]) : [];
}

/** The two places an authenticator secret lives, both sealed with the credential key. */
type MfaStore = "two_factor" | "mfa_enrollment";

/** One sealed authenticator secret, as read by raw SQL. */
type MfaSecretRow = { user_id: string; secret: string | null };

@Controller("admin")
@UseGuards(ClerkAuthGuard)
export class AdminController {
  constructor(private readonly securityMonitor: SecurityMonitorService) {}

  /**
   * GET /api/admin/rate-limits
   * Returns all IPs currently blocked by the auth-failure tracker AND
   * all IPs in an active magic-link throttle window.
   */
  @Get("rate-limits")
  async listRateLimits(@ClerkUserId() userId: string) {
    await assertPlatformOperation(userId, "ratelimits.read");
    const [blocked, magicLinkThrottles] = await Promise.all([
      listBlocked(),
      listActiveThrottles(),
    ]);
    return { blocked, magicLinkThrottles };
  }

  /**
   * DELETE /api/admin/rate-limits/:ip
   * Clears the auth-failure block for a specific IP immediately.
   */
  @Delete("rate-limits/:ip")
  async clearRateLimit(
    @ClerkUserId() userId: string,
    @Param("ip") ip: string,
  ) {
    await assertPlatformOperation(userId, "ratelimits.clear");
    await clearBlock(ip);
    return { ok: true, ip };
  }

  /**
   * DELETE /api/admin/magic-link-rate/:ip
   * Clears the magic-link throttle window for a specific IP immediately.
   */
  @Delete("magic-link-rate/:ip")
  async clearMagicLinkRate(
    @ClerkUserId() userId: string,
    @Param("ip") ip: string,
  ) {
    await assertPlatformOperation(userId, "ratelimits.magiclink.reset");
    await resetMagicLinkRateForIp(ip);
    return { ok: true, ip };
  }

  /**
   * PATCH /api/admin/orgs/:orgId/plan
   * Upgrades or downgrades an org's plan tier. Super-admin only.
   */
  @Patch("orgs/:orgId/plan")
  async changeOrgPlan(
    @ClerkUserId() userId: string,
    @Param("orgId") orgId: string,
    @Body() body: { plan: string },
  ) {
    const planActor = await assertPlatformOperation(userId, "orgs.plan.change", Number(orgId));
    const VALID_PLANS = ["starter", "professional", "enterprise", "federal"];
    if (!VALID_PLANS.includes(body.plan)) {
      throw new BadRequestException("plan must be one of: " + VALID_PLANS.join(", "));
    }
    const numericOrgId = Number(orgId);

    // Capture previous plan for audit log
    const existing = await db.query.organizationsTable.findFirst({
      where: eq(organizationsTable.id, numericOrgId),
    });
    const previousPlan = existing?.plan ?? "starter";

    await db
      .update(organizationsTable)
      .set({ plan: body.plan })
      .where(eq(organizationsTable.id, numericOrgId));

    // Write audit trail — best-effort, never blocks the response
    await writeAuditLog(
      numericOrgId,
      "plan.changed",
      "organization",
      String(numericOrgId),
      { previousPlan, newPlan: body.plan, changedBy: userId },
      userId,
      (planActor as { email?: string | null }).email ?? undefined,
    );

    return { ok: true, orgId: numericOrgId, plan: body.plan };
  }

  /**
   * POST /api/admin/credentials/rotate-key
   * Re-encrypts all integration credentials from an old AES-256-GCM key to a new one,
   * inside a single database transaction.
   * Super-admin only.
   *
   * Body:
   *   newKeyHex  — required. 64-char hex string (32 bytes) for the new key.
   *   oldKeyHex  — optional. 64-char hex string for the old key.
   *               Defaults to the current INTEGRATION_CREDENTIAL_KEY env var.
   *   dryRun     — optional. When true, reports how many rows would be affected
   *               without writing any changes.
   *
   * Idempotency: rows that are already decryptable with newKey are skipped safely.
   *
   * Workflow:
   *   1. Call with dryRun:true to verify counts and confirm oldKey is correct.
   *   2. Call without dryRun to apply re-encryption atomically.
   *   3. Update INTEGRATION_CREDENTIAL_KEY env var to newKeyHex and redeploy.
   */
  @Post("credentials/rotate-key")
  async rotateCredentialKey(
    @ClerkUserId() userId: string,
    @Body() body: { newKeyHex: string; oldKeyHex?: string; dryRun?: boolean },
  ) {
    const rotateLog = new Logger("CredentialRotation");
    const actor = await assertPlatformOperation(userId, "credentials.rotate_key");
    const actorEmail =
      (actor as { email?: string | null }).email ?? undefined;

    if (!body.newKeyHex || !/^[0-9a-fA-F]{64}$/.test(body.newKeyHex)) {
      throw new BadRequestException(
        "newKeyHex must be a 64-character hex string (32 bytes) — generate one with: openssl rand -hex 32",
      );
    }
    if (body.oldKeyHex !== undefined && !/^[0-9a-fA-F]{64}$/.test(body.oldKeyHex)) {
      throw new BadRequestException(
        "oldKeyHex must be a 64-character hex string (32 bytes) when provided",
      );
    }
    if (body.newKeyHex === body.oldKeyHex) {
      throw new BadRequestException("newKeyHex and oldKeyHex must differ");
    }

    const newKeyBuf = Buffer.from(body.newKeyHex, 'hex');
    // Use provided oldKey, or fall back to the current env-derived key
    const oldKeyBuf = body.oldKeyHex
      ? Buffer.from(body.oldKeyHex, 'hex')
      : getDerivedKeyBuffer();

    // Non-reversible fingerprints for the compliance trail. Key material is
    // never logged or persisted anywhere.
    const oldKeyFingerprint = keyFingerprint(oldKeyBuf);
    const newKeyFingerprint = keyFingerprint(newKeyBuf);
    if (oldKeyFingerprint === newKeyFingerprint) {
      throw new BadRequestException(
        "newKeyHex resolves to the key material already in use - nothing to rotate",
      );
    }

    // A key retired by an earlier rotation must never come back into service.
    // The WORM audit log is the source of truth, so a forgotten backup copy of
    // an old key cannot be silently re-adopted by a later operator.
    const priorRotations = await db.query.orgAuditLogTable.findMany({
      where: eq(orgAuditLogTable.action, "credential_key.rotated"),
    });
    const retiredFingerprints = new Set<string>();
    for (const entry of priorRotations) {
      const d = entry.details as { oldKeyFingerprint?: string } | null;
      if (d?.oldKeyFingerprint) retiredFingerprints.add(d.oldKeyFingerprint);
    }
    if (retiredFingerprints.has(newKeyFingerprint)) {
      throw new BadRequestException(
        `newKeyHex (${newKeyFingerprint}) was retired by an earlier rotation and ` +
          "cannot be put back into service. Generate a fresh key with: openssl rand -hex 32",
      );
    }
    if (!body.oldKeyHex && retiredFingerprints.has(oldKeyFingerprint)) {
      rotateLog.warn(
        `INTEGRATION_CREDENTIAL_KEY (${oldKeyFingerprint}) was retired by an earlier ` +
          "rotation - a stale key backup may have been redeployed. Investigate before proceeding.",
      );
    }

    const CRED_KEYS = [
      "personalAccessToken",
      "apiToken",
      "secretAccessKey",
      "clientSecret",
      "apiKey",
    ];

    const rows = await db.select().from(orgIntegrationsTable);

    // Evaluate every row without writing (needed for both dry-run and live run preview)
    type RowOutcome = {
      id: number;
      integrationKey: string;
      status: 'rotated' | 'skipped_already_new_key' | 'skipped_plaintext' | 'no_credentials' | 'failed';
      reason?: string;
      newAccessToken?: string | null;
      newRefreshToken?: string | null;
      newConfig?: Record<string, unknown> | null;
    };

    const orgIdByRow = new Map<number, number>(rows.map((r) => [r.id, r.orgId]));

    const outcomes: RowOutcome[] = [];

    for (const row of rows) {
      const accessResult = row.accessToken
        ? rotateCredentialValue(row.accessToken, oldKeyBuf, newKeyBuf)
        : null;
      const refreshResult = row.refreshToken
        ? rotateCredentialValue(row.refreshToken, oldKeyBuf, newKeyBuf)
        : null;

      // Rotate config credential fields
      let configResult: Record<string, unknown> | null = row.config as Record<string, unknown> | null;
      const configFailures: string[] = [];
      if (configResult) {
        configResult = { ...configResult };
        for (const key of CRED_KEYS) {
          const val = (configResult as Record<string, unknown>)[key];
          if (typeof val === 'string') {
            const r = rotateCredentialValue(val, oldKeyBuf, newKeyBuf);
            if (r === null) continue;
            if (r.status === 'failed') {
              configFailures.push(`config.${key}: ${r.reason}`);
            } else if (r.status === 'rotated' || r.status === 'skipped_plaintext') {
              (configResult as Record<string, unknown>)[key] = r.newValue;
            }
            // skipped_already_new_key — leave value as-is
          }
        }
      }

      // Determine overall row outcome
      const failed =
        (accessResult?.status === 'failed') ||
        (refreshResult?.status === 'failed') ||
        configFailures.length > 0;

      const alreadyDone =
        (accessResult === null || accessResult.status === 'skipped_already_new_key') &&
        (refreshResult === null || refreshResult.status === 'skipped_already_new_key') &&
        configFailures.length === 0;

      const hasCredentials = accessResult !== null || refreshResult !== null || configFailures.length > 0 ||
        CRED_KEYS.some(k => typeof (row.config as Record<string, unknown> | null)?.[k] === 'string');

      if (!hasCredentials) {
        outcomes.push({ id: row.id, integrationKey: row.integrationKey, status: 'no_credentials' });
      } else if (failed) {
        outcomes.push({
          id: row.id,
          integrationKey: row.integrationKey,
          status: 'failed',
          reason: [
            accessResult?.status === 'failed' ? `access_token: ${accessResult.reason}` : '',
            refreshResult?.status === 'failed' ? `refresh_token: ${refreshResult.reason}` : '',
            ...configFailures,
          ].filter(Boolean).join('; '),
        });
      } else if (alreadyDone) {
        outcomes.push({ id: row.id, integrationKey: row.integrationKey, status: 'skipped_already_new_key' });
      } else {
        outcomes.push({
          id: row.id,
          integrationKey: row.integrationKey,
          status: accessResult?.status === 'skipped_plaintext' ? 'skipped_plaintext' : 'rotated',
          newAccessToken: accessResult && 'newValue' in accessResult ? accessResult.newValue : row.accessToken,
          newRefreshToken: refreshResult && 'newValue' in refreshResult ? refreshResult.newValue : row.refreshToken,
          newConfig: configResult,
        });
      }
    }

    const toRotate = outcomes.filter(o => o.status === 'rotated' || o.status === 'skipped_plaintext');
    const alreadyDone = outcomes.filter(o => o.status === 'skipped_already_new_key');
    const noCredentials = outcomes.filter(o => o.status === 'no_credentials');
    const failures = outcomes.filter(o => o.status === 'failed');

    for (const f of failures) {
      rotateLog.error(`Row id=${f.id} (${f.integrationKey}): ${f.reason}`);
    }

    // MFA secrets are sealed with this same key.
    //
    // mfa.service.ts calls encryptCredential() for TOTP secrets, so the
    // authenticator secrets in two_factor and the pending setups in
    // mfa_enrollment are encrypted with exactly the key being rotated here.
    // A rotation that stopped at org_integrations would leave every enrolled
    // member unable to pass second-factor verification the moment the new key
    // went live, and where org-wide MFA is enforced, unable to sign in at all.
    // Backup codes are hashed rather than encrypted, so they are untouched.
    type MfaOutcome = { store: MfaStore; userId: string; next: string };
    const mfaRotations: MfaOutcome[] = [];
    const mfaFailures: { store: MfaStore; userId: string; reason: string }[] = [];
    let mfaAlreadyOnNewKey = 0;
    let mfaRotated = 0;

    const mfaSources: Array<{ store: MfaStore; rows: MfaSecretRow[] }> = [
      {
        store: "two_factor",
        rows: resultRows<MfaSecretRow>(
          await db.execute(
            sql`SELECT "userId" AS user_id, secret FROM two_factor WHERE secret IS NOT NULL`,
          ),
        ),
      },
      {
        store: "mfa_enrollment",
        rows: resultRows<MfaSecretRow>(
          await db.execute(
            sql`SELECT user_id, secret FROM mfa_enrollment WHERE secret IS NOT NULL`,
          ),
        ),
      },
    ];

    for (const source of mfaSources) {
      for (const row of source.rows) {
        const result = rotateCredentialValue(row.secret, oldKeyBuf, newKeyBuf);
        if (result === null) continue;
        if (result.status === "failed") {
          mfaFailures.push({
            store: source.store,
            userId: String(row.user_id),
            reason: result.reason,
          });
        } else if (result.status === "skipped_already_new_key") {
          mfaAlreadyOnNewKey++;
        } else {
          mfaRotations.push({
            store: source.store,
            userId: String(row.user_id),
            next: result.newValue,
          });
        }
      }
    }

    for (const f of mfaFailures) {
      rotateLog.error(`MFA secret for user ${f.userId} in ${f.store}: ${f.reason}`);
    }

    if (body.dryRun) {
      return {
        ok: true,
        dryRun: true,
        summary: {
          wouldRotate: toRotate.length,
          alreadyOnNewKey: alreadyDone.length,
          noCredentials: noCredentials.length,
          failures: failures.length,
        mfaSecretsWouldRotate: mfaRotations.length,
        mfaSecretsAlreadyOnNewKey: mfaAlreadyOnNewKey,
        mfaFailures: mfaFailures.length,
        },
        failureDetails: failures.map(f => ({ id: f.id, integrationKey: f.integrationKey, reason: f.reason })),
      mfaFailureDetails: mfaFailures,
        message:
          `Dry run complete. ${toRotate.length} row(s) would be re-encrypted, ` +
          `${alreadyDone.length} already on new key (skipped), ` +
          `${failures.length} failure(s). ` +
          (failures.length + mfaFailures.length > 0
            ? 'Resolve failures before applying. '
            : '') +
          `${mfaRotations.length} authenticator secret(s) would be re-keyed, ` +
          `${mfaFailures.length} of them failing. ` +
          'Run without dryRun:true to apply.',
      };
    }

    // Apply inside a single transaction for atomicity
    let rotated = 0;
    await db.transaction(async (tx) => {
      for (const outcome of toRotate) {
        await tx
          .update(orgIntegrationsTable)
          .set({
            accessToken: outcome.newAccessToken ?? undefined,
            refreshToken: outcome.newRefreshToken ?? undefined,
            config: outcome.newConfig ?? undefined,
          })
          .where(eq(orgIntegrationsTable.id, outcome.id));
        rotated++;
      }
      for (const m of mfaRotations) {
        if (m.store === "two_factor") {
          await tx.execute(
            sql`UPDATE two_factor SET secret = ${m.next} WHERE "userId" = ${m.userId}`,
          );
        } else {
          await tx.execute(
            sql`UPDATE mfa_enrollment SET secret = ${m.next} WHERE user_id = ${m.userId}`,
          );
        }
        mfaRotated++;
      }
    });

    // Immutable compliance trail: one audit row per affected org so tenant
    // auditors can see exactly when their integration credentials were
    // re-encrypted, by whom, and between which key fingerprints.
    const rotatedByOrg = new Map<number, string[]>();
    for (const outcome of toRotate) {
      const oid = orgIdByRow.get(outcome.id);
      if (oid === undefined) continue;
      const list = rotatedByOrg.get(oid) ?? [];
      list.push(outcome.integrationKey);
      rotatedByOrg.set(oid, list);
    }
    for (const [oid, integrationKeys] of rotatedByOrg) {
      await writeAuditLog(
        oid,
        "credential_key.rotated",
        "integration_credentials",
        null,
        {
          oldKeyFingerprint,
          newKeyFingerprint,
          integrationKeys,
          rowsRotated: integrationKeys.length,
        },
        userId,
        actorEmail,
      );
    }
    for (const f of failures) {
      const oid = orgIdByRow.get(f.id);
      if (oid === undefined) continue;
      await writeAuditLog(
        oid,
        "credential_key.rotation_failed",
        "integration_credentials",
        String(f.id),
        {
          oldKeyFingerprint,
          newKeyFingerprint,
          integrationKey: f.integrationKey,
          reason: f.reason,
        },
        userId,
        actorEmail,
      );
    }

    // MFA secrets carry no org column, so their trail is written against each
    // affected member organisation, found through org_members.
    if (mfaRotated > 0) {
      const mfaByOrg = new Map<number, number>();
      for (const m of mfaRotations) {
        const row = resultRows<{ org_id: number }>(
          await db.execute(
            sql`SELECT org_id FROM org_members WHERE clerk_user_id = ${m.userId} LIMIT 1`,
          ),
        )[0];
        if (!row) continue;
        const oid = Number(row.org_id);
        mfaByOrg.set(oid, (mfaByOrg.get(oid) ?? 0) + 1);
      }
      for (const [oid, count] of mfaByOrg) {
        await writeAuditLog(
          oid,
          "credential_key.rotated",
          "mfa_secrets",
          null,
          { oldKeyFingerprint, newKeyFingerprint, secretsRotated: count },
          userId,
          actorEmail,
        );
      }
    }

    rotateLog.log(
      `Key rotation complete: ${rotated} rotated, ` +
      `${alreadyDone.length} skipped (already new key), ` +
      `${failures.length} failed.`,
    );

    return {
      ok: failures.length === 0 && mfaFailures.length === 0,
      dryRun: false,
      summary: {
        rotated,
        alreadyOnNewKey: alreadyDone.length,
        noCredentials: noCredentials.length,
        failures: failures.length,
        mfaSecretsRotated: mfaRotated,
        mfaSecretsAlreadyOnNewKey: mfaAlreadyOnNewKey,
        mfaFailures: mfaFailures.length,
      },
      failureDetails: failures.map(f => ({ id: f.id, integrationKey: f.integrationKey, reason: f.reason })),
      mfaFailureDetails: mfaFailures,
      message:
        `Re-encryption complete. ${rotated} row(s) rotated, ` +
        `${alreadyDone.length} already on new key (skipped), ` +
        `${failures.length} failure(s). ` +
        (failures.length === 0 && mfaFailures.length === 0
          ? 'Now update INTEGRATION_CREDENTIAL_KEY env var to your new key and redeploy.'
          : `${failures.length} row(s) could not be decrypted with the old key — check failureDetails. Do NOT update the env var until all rows are rotated.`),
    };
  }

  /**
   * GET /api/admin/credentials/key-status
   *
   * Proves which credential key is actually live, and whether every stored
   * secret can still be opened with it, without exposing key material. This is
   * what makes the move from a derived key to a dedicated
   * INTEGRATION_CREDENTIAL_KEY verifiable after a deploy instead of assumed: if
   * the variable is set without running the rotation first, undecryptable will
   * be non-zero and healthy will be false.
   *
   * Super-admin only. Read-only. Returns no plaintext and no key bytes.
   */
  @Get("credentials/key-status")
  async getCredentialKeyStatus(@ClerkUserId() userId: string) {
    await assertPlatformOperation(userId, "credentials.key_status");

    let sealed = 0;
    let plaintext = 0;
    let undecryptable = 0;

    /** Counts a column that is always a credential. */
    const countCredential = (value: unknown) => {
      if (typeof value !== "string" || value.length === 0) return;
      if (!isEncryptedCredential(value)) {
        plaintext++;
        return;
      }
      sealed++;
      if (decryptCredential(value) === null) undecryptable++;
    };

    /**
     * Counts a JSONB member only when it is already sealed, so an ordinary
     * config string such as a hostname is not reported as a bare credential.
     */
    const countIfSealed = (value: unknown) => {
      if (typeof value !== "string" || !isEncryptedCredential(value)) return;
      sealed++;
      if (decryptCredential(value) === null) undecryptable++;
    };

    const integrationRows = await db.select().from(orgIntegrationsTable);
    for (const row of integrationRows) {
      countCredential(row.accessToken);
      countCredential(row.refreshToken);
      const config = (row.config ?? null) as Record<string, unknown> | null;
      if (config) for (const value of Object.values(config)) countIfSealed(value);
    }

    const mfaRows = [
      ...resultRows<MfaSecretRow>(
        await db.execute(sql`SELECT secret FROM two_factor WHERE secret IS NOT NULL`),
      ),
      ...resultRows<MfaSecretRow>(
        await db.execute(sql`SELECT secret FROM mfa_enrollment WHERE secret IS NOT NULL`),
      ),
    ];
    for (const row of mfaRows) countCredential(row.secret);

    const mode = credentialKeyMode();
    return {
      mode,
      dedicated: mode === "dedicated",
      keyFingerprint: keyFingerprint(getDerivedKeyBuffer()),
      secrets: { sealed, plaintext, undecryptable },
      healthy: undecryptable === 0,
      message:
        undecryptable === 0
          ? `${sealed} stored secret(s) open with the live key (mode: ${mode}).`
          : `${undecryptable} of ${sealed} stored secret(s) cannot be opened with the live key. ` +
            `The key was changed without running POST /api/admin/credentials/rotate-key first.`,
      control: "NIST SP 800-53 SC-12 / SC-28, CMMC SC.L2-3.13.16",
    };
  }

  /**
   * Live database security posture for the super-admin console and for
   * security questionnaires: connected role, whether RLS is actually being
   * enforced, tenant policy coverage, WORM triggers, TLS and server version.
   *
   * Read-only. Returns no credentials and no connection strings.
   */
  @Get("db-security")
  async getDbSecurity(@ClerkUserId() userId: string) {
    await assertPlatformOperation(userId, "dbsecurity.read");
    const posture = await readDbSecurityPosture(db);
    const coverage =
      posture.tenantTables === 0
        ? 0
        : Math.round((posture.tablesWithPolicy / posture.tenantTables) * 100);
    return {
      ...posture,
      tenantPolicyCoveragePct: coverage,
      findings: [
        posture.bypassesRls
          ? {
              severity: "high",
              control: "AC-3 / SC-4",
              finding:
                "The application connects as a role that bypasses row level security. " +
                "Tenant isolation is enforced by the application layer only.",
              remediation:
                "Run scripts/provision-app-role.cjs, then point DATABASE_URL at the " +
                "least-privilege role and redeploy.",
            }
          : null,
        posture.tablesMissingPolicy.length
          ? {
              severity: "medium",
              control: "AC-3",
              finding:
                posture.tablesMissingPolicy.length +
                " tenant table(s) have no tenant_isolation policy.",
              remediation: "Restart the API; the RLS migration installs them idempotently.",
            }
          : null,
        !posture.sslInUse
          ? {
              severity: "medium",
              control: "SC-8",
              finding: "The database server does not report TLS enabled.",
              remediation: "Enable TLS on the Postgres service and require sslmode=require.",
            }
          : null,
      ].filter(Boolean),
    };
  }

  /** Row counts for the audit trail, used to prove retention on questionnaires. */
  /**
   * Which hostnames are actually reaching the origin, and whether anything is
   * being refused. Read-only. Never returns the edge shared secret - only
   * whether one is configured.
   */
  @Get("origin-trust")
  async getOriginTrust(@ClerkUserId() userId: string) {
    await assertPlatformOperation(userId, "origintrust.read");
    return readOriginTrustPosture();
  }

  @Get("audit-retention")
  async getAuditRetention(@ClerkUserId() userId: string) {
    await assertPlatformOperation(userId, "auditretention.read");
    const rows = await db.execute(sql`
      SELECT COUNT(*)::int AS total,
             MIN(created_at) AS oldest,
             MAX(created_at) AS newest,
             COUNT(DISTINCT org_id)::int AS orgs
        FROM org_audit_log
    `);
    const r = (rows.rows as any[])[0] ?? {};
    const oldest = r.oldest ? new Date(r.oldest) : null;
    const retainedDays = oldest
      ? Math.floor((Date.now() - oldest.getTime()) / 86400000)
      : 0;
    return {
      totalEntries: r.total ?? 0,
      organizations: r.orgs ?? 0,
      oldestEntry: oldest ? oldest.toISOString() : null,
      newestEntry: r.newest ? new Date(r.newest).toISOString() : null,
      retainedDays,
      // FedRAMP AU-11 / CMMC AU.L2-3.3.1
      requiredDays: 365,
      onlineRequiredDays: 90,
      meetsOnlineRequirement: retainedDays >= 90 || (r.total ?? 0) === 0,
      immutable: true,
      immutabilityMechanism: "PostgreSQL trigger audit_log_worm (UPDATE/DELETE denied)",
    };
  }


  /**
   * The security event feed: authorisation denials, unauthenticated bursts
   * and every detection the monitor has raised. Read-only, super-admin only,
   * and served from the append-only audit table so it cannot have been
   * edited after the fact.
   */
  @Get("security-events")
  async getSecurityEvents(
    @ClerkUserId() userId: string,
    @Query("hours") hours?: string,
    @Query("limit") limit?: string,
  ) {
    await assertPlatformOperation(userId, "securityevents.read");
    const windowHours = Math.min(Math.max(parseInt(hours ?? "24", 10) || 24, 1), 720);
    const max = Math.min(Math.max(parseInt(limit ?? "200", 10) || 200, 1), 1000);

    const rows = await db.execute(sql`
      SELECT id, org_id, action, resource, resource_id, details,
             actor_id, actor_email, ip_address, created_at
        FROM org_audit_log
       WHERE action LIKE 'security.%'
         AND created_at >= NOW() - (${windowHours} || ' hours')::interval
       ORDER BY id DESC
       LIMIT ${max}
    `);

    const summary = await db.execute(sql`
      SELECT action, COUNT(*)::int AS count
        FROM org_audit_log
       WHERE action LIKE 'security.%'
         AND created_at >= NOW() - (${windowHours} || ' hours')::interval
       GROUP BY 1
       ORDER BY 2 DESC
    `);

    return {
      windowHours,
      rules: SECURITY_RULES,
      summary: summary.rows,
      events: rows.rows,
      immutable: true,
      note:
        "Served from the append-only audit table. Entries cannot be edited " +
        "or deleted; the database rejects UPDATE and DELETE on this table.",
    };
  }

  /**
   * Run the detection rules immediately instead of waiting for the next
   * five-minute sweep. Used during incident response and to demonstrate the
   * control to an auditor.
   */
  @Post("security-events/sweep")
  async runSecuritySweep(@ClerkUserId() userId: string) {
    await assertPlatformOperation(userId, "securityevents.sweep");
    const result = await this.securityMonitor.sweep();
    return { ...result, ranAt: new Date().toISOString() };
  }

}

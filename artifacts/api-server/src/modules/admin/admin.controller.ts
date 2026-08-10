import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Logger,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ClerkAuthGuard, ClerkUserId } from "../../guards/clerk-auth.guard";
import {
  db,
  orgMembersTable,
  organizationsTable,
  orgIntegrationsTable,
  orgAuditLogTable,
} from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";
import { readDbSecurityPosture } from "../../migrations/tenant-rls.migration.js";
import { writeAuditLog } from "../../lib/audit-log.js";
import { listBlocked, clearBlock } from "../../lib/auth-failure-tracker.js";
import { listActiveThrottles, resetMagicLinkRateForIp } from "../../lib/magic-link-rate-limiter.js";
import {
  reEncryptWithNewKey,
  reEncryptConfigWithNewKey,
  rotateCredentialValue,
  getDerivedKeyBuffer,
  keyFingerprint,
} from "../../lib/credential-crypto.js";

/** Verify the caller has super_admin in at least one org. Throws 403 otherwise. */
async function assertSuperAdmin(userId: string) {
  const membership = await db.query.orgMembersTable.findFirst({
    where: and(
      eq(orgMembersTable.clerkUserId, userId),
      eq(orgMembersTable.role, "super_admin"),
    ),
  });
  if (!membership) {
    throw new ForbiddenException("Requires super_admin role");
  }
  return membership;
}

@Controller("admin")
@UseGuards(ClerkAuthGuard)
export class AdminController {
  /**
   * GET /api/admin/rate-limits
   * Returns all IPs currently blocked by the auth-failure tracker AND
   * all IPs in an active magic-link throttle window.
   */
  @Get("rate-limits")
  async listRateLimits(@ClerkUserId() userId: string) {
    await assertSuperAdmin(userId);
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
    await assertSuperAdmin(userId);
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
    await assertSuperAdmin(userId);
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
    const planActor = await assertSuperAdmin(userId);
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
    const actor = await assertSuperAdmin(userId);
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

    if (body.dryRun) {
      return {
        ok: true,
        dryRun: true,
        summary: {
          wouldRotate: toRotate.length,
          alreadyOnNewKey: alreadyDone.length,
          noCredentials: noCredentials.length,
          failures: failures.length,
        },
        failureDetails: failures.map(f => ({ id: f.id, integrationKey: f.integrationKey, reason: f.reason })),
        message:
          `Dry run complete. ${toRotate.length} row(s) would be re-encrypted, ` +
          `${alreadyDone.length} already on new key (skipped), ` +
          `${failures.length} failure(s). ` +
          (failures.length > 0 ? 'Resolve failures before applying. ' : '') +
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

    rotateLog.log(
      `Key rotation complete: ${rotated} rotated, ` +
      `${alreadyDone.length} skipped (already new key), ` +
      `${failures.length} failed.`,
    );

    return {
      ok: failures.length === 0,
      dryRun: false,
      summary: {
        rotated,
        alreadyOnNewKey: alreadyDone.length,
        noCredentials: noCredentials.length,
        failures: failures.length,
      },
      failureDetails: failures.map(f => ({ id: f.id, integrationKey: f.integrationKey, reason: f.reason })),
      message:
        `Re-encryption complete. ${rotated} row(s) rotated, ` +
        `${alreadyDone.length} already on new key (skipped), ` +
        `${failures.length} failure(s). ` +
        (failures.length === 0
          ? 'Now update INTEGRATION_CREDENTIAL_KEY env var to your new key and redeploy.'
          : `${failures.length} row(s) could not be decrypted with the old key — check failureDetails. Do NOT update the env var until all rows are rotated.`),
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
    await assertSuperAdmin(userId);
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
  @Get("audit-retention")
  async getAuditRetention(@ClerkUserId() userId: string) {
    await assertSuperAdmin(userId);
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

}

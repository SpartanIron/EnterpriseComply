import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ClerkAuthGuard, ClerkUserId } from "../../guards/clerk-auth.guard";
import { db, orgMembersTable, organizationsTable, orgIntegrationsTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { listBlocked, clearBlock } from "../../lib/auth-failure-tracker.js";
import { listActiveThrottles, resetMagicLinkRateForIp } from "../../lib/magic-link-rate-limiter.js";
import { reEncryptWithNewKey, reEncryptConfigWithNewKey } from "../../lib/credential-crypto.js";

/** Verify the caller has super_admin in at least one org. Throws 403 otherwise. */
async function assertSuperAdmin(userId: string): Promise<void> {
  const membership = await db.query.orgMembersTable.findFirst({
    where: and(
      eq(orgMembersTable.clerkUserId, userId),
      eq(orgMembersTable.role, "super_admin"),
    ),
  });
  if (!membership) {
    throw new ForbiddenException("Requires super_admin role");
  }
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
    await assertSuperAdmin(userId);
    const VALID_PLANS = ["starter", "professional", "enterprise", "federal"];
    if (!VALID_PLANS.includes(body.plan)) {
      throw new BadRequestException("plan must be one of: " + VALID_PLANS.join(", "));
    }
    await db.update(organizationsTable).set({ plan: body.plan }).where(eq(organizationsTable.id, Number(orgId)));
    return { ok: true, orgId: Number(orgId), plan: body.plan };
  }

  /**
   * POST /api/admin/credentials/rotate-key
   * Re-encrypts all integration credentials with a new AES-256-GCM key.
   * Super-admin only. Use dryRun:true to preview without committing changes.
   *
   * Workflow:
   *   1. Call with dryRun:true to verify the count of affected rows.
   *   2. Call without dryRun to apply the re-encryption.
   *   3. Update the INTEGRATION_CREDENTIAL_KEY env var to newKeyHex and redeploy.
   */
  @Post("credentials/rotate-key")
  async rotateCredentialKey(
    @ClerkUserId() userId: string,
    @Body() body: { newKeyHex: string; dryRun?: boolean },
  ) {
    await assertSuperAdmin(userId);
    if (!body.newKeyHex || !/^[0-9a-fA-F]{64}$/.test(body.newKeyHex)) {
      throw new BadRequestException(
        "newKeyHex must be a 64-character hex string (32 bytes)",
      );
    }

    const rows = await db.select().from(orgIntegrationsTable);
    const CRED_KEYS = [
      "personalAccessToken",
      "apiToken",
      "secretAccessKey",
      "clientSecret",
      "apiKey",
    ];
    let rowsAffected = 0;

    if (!body.dryRun) {
      for (const row of rows) {
        const newAccessToken = reEncryptWithNewKey(row.accessToken, body.newKeyHex);
        const newRefreshToken = reEncryptWithNewKey(row.refreshToken ?? null, body.newKeyHex);
        const newConfig = reEncryptConfigWithNewKey(
          row.config as Record<string, unknown> | null,
          CRED_KEYS,
          body.newKeyHex,
        );
        await db
          .update(orgIntegrationsTable)
          .set({
            accessToken: newAccessToken ?? "",
            refreshToken: newRefreshToken,
            config: newConfig,
          })
          .where(eq(orgIntegrationsTable.id, row.id));
        rowsAffected++;
      }
    }

    return {
      ok: !body.dryRun,
      dryRun: body.dryRun ?? false,
      rowsAffected: body.dryRun ? rows.length : rowsAffected,
      message: body.dryRun
        ? `Dry run: ${rows.length} credential rows would be re-encrypted. Run without dryRun:true to apply. Then update INTEGRATION_CREDENTIAL_KEY env var to the new key.`
        : `Re-encrypted ${rowsAffected} credential rows. Update INTEGRATION_CREDENTIAL_KEY env var to your new key and redeploy.`,
    };
  }
}

import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { ClerkAuthGuard, ClerkUserId } from "../../guards/clerk-auth.guard";
import { MfaService } from "./mfa.service";

/** One round trip for the caller details these endpoints need. */
async function loadCallerContext(userId: string) {
  const result: any = await db.execute(sql`
    SELECT u.email AS email, m.org_id AS org_id, o.mfa_enforced AS mfa_enforced
    FROM "user" u
    LEFT JOIN org_members m ON m.clerk_user_id = u.id
    LEFT JOIN organizations o ON o.id = m.org_id
    WHERE u.id = ${userId}
    LIMIT 1
  `);
  const rows = Array.isArray(result) ? result : result && result.rows ? result.rows : [];
  const row = rows.length > 0 ? rows[0] : null;
  return {
    email: row && row.email ? String(row.email) : "",
    orgId: row && row.org_id != null ? Number(row.org_id) : null,
    mfaEnforced: !!(row && row.mfa_enforced === true),
  };
}

function readCode(body: { code?: string } | undefined): string {
  return body && body.code ? String(body.code) : "";
}

/**
 * Multi-factor endpoints.
 *
 * These sit behind ClerkAuthGuard rather than OrgContextGuard deliberately.
 * OrgContextGuard is where MFA enforcement is applied, and routing enrolment through it
 * would be circular: the member who has to enrol would be blocked from reaching the
 * endpoint that lets them. The guard allow-lists /api/mfa for the same reason, which is
 * also what makes a locked-out user able to recover with a backup code.
 *
 * Every route that checks a code runs on the "auth" throttler profile (5 requests per
 * minute per IP). That is what stops a six digit code being brute forced.
 */
@Controller("mfa")
@UseGuards(ClerkAuthGuard)
export class MfaController {
  constructor(private readonly mfa: MfaService) {}

  @Get("status")
  status(@ClerkUserId() userId: string) {
    return this.mfa.status(userId);
  }

  @Post("totp/start")
  async start(@ClerkUserId() userId: string) {
    const ctx = await loadCallerContext(userId);
    return this.mfa.start(userId, ctx.email);
  }

  @Post("totp/confirm")
  @Throttle({ auth: { limit: 5, ttl: 60000 } })
  async confirm(@ClerkUserId() userId: string, @Body() body: { code?: string }) {
    const ctx = await loadCallerContext(userId);
    return this.mfa.confirm(userId, ctx.orgId, readCode(body));
  }

  @Post("verify")
  @Throttle({ auth: { limit: 5, ttl: 60000 } })
  async verify(
    @ClerkUserId() userId: string,
    @Req() req: any,
    @Body() body: { code?: string },
  ) {
    const ctx = await loadCallerContext(userId);
    return this.mfa.verify(userId, req.sessionId || null, ctx.orgId, readCode(body));
  }

  @Post("totp/disable")
  @Throttle({ auth: { limit: 5, ttl: 60000 } })
  async disable(@ClerkUserId() userId: string, @Body() body: { code?: string }) {
    const ctx = await loadCallerContext(userId);
    return this.mfa.disable(userId, ctx.orgId, ctx.mfaEnforced, readCode(body));
  }

  @Post("backup-codes")
  @Throttle({ auth: { limit: 5, ttl: 60000 } })
  async backupCodes(@ClerkUserId() userId: string, @Body() body: { code?: string }) {
    const ctx = await loadCallerContext(userId);
    return this.mfa.regenerateBackupCodes(userId, ctx.orgId, readCode(body));
  }
}

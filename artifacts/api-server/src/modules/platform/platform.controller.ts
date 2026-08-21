// platform.controller.ts — the break-glass surface for platform staff
//
// Nothing here grants standing power. Being listed in PLATFORM_ADMIN_EMAILS
// puts a row in platform_admins, and that row on its own opens no door: every
// privileged endpoint in the product calls assertPlatformAccess(), which also
// demands a live, time-boxed elevation. These four routes are how such an
// elevation is opened, inspected and closed — and until they existed, the gate the
// rest of the API had already adopted could be satisfied by nobody, which is why
// /api/admin/* answered 403 elevation_required with no way to clear it.
//
// Mounted on ClerkAuthGuard rather than OrgContextGuard, deliberately. The step-up
// check that answers mfa_challenge_required runs only on org-scoped routes, so
// mounting /elevate here avoids a deadlock where the endpoint that accepts a code
// cannot be reached without having already presented one. The code is still
// required: this controller verifies it itself, before opening anything.

import { Body, Controller, ForbiddenException, Get, Post, Req, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { db, orgMembersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { ClerkAuthGuard, ClerkUserId } from "../../guards/clerk-auth.guard";
import { MfaService } from "../mfa/mfa.service";
import {
  MAX_ELEVATION_MS,
  MAX_REASON_LENGTH,
  MIN_REASON_LENGTH,
  clampTtl,
  endElevation,
  getActiveElevation,
  isPlatformAdmin,
  listElevations,
  openElevation,
  platformAdminEmail,
  validateReason,
} from "../../lib/platform-admin";

/** Sent with every response so the client never hard-codes the ceiling. */
const LIMITS = {
  maxElevationMs: MAX_ELEVATION_MS,
  minReasonLength: MIN_REASON_LENGTH,
  maxReasonLength: MAX_REASON_LENGTH,
};

/** The org the caller belongs to, used only to file the MFA audit entry. */
async function orgIdOf(userId: string): Promise<number | null> {
  const row = await db.query.orgMembersTable.findFirst({
    where: eq(orgMembersTable.clerkUserId, userId),
  });
  return row ? Number(row.orgId) : null;
}

/**
 * Caller address for the elevation record.
 *
 * Reads req.ip, which Express derives according to the app's own trust-proxy
 * setting, rather than picking X-Forwarded-For apart here. A spoofable header
 * written straight into a security audit record is worse than a null.
 */
function clientIp(req: any): string | null {
  const ip = req?.ip ?? req?.socket?.remoteAddress ?? null;
  return typeof ip === "string" && ip.length > 0 ? ip : null;
}

@Controller("platform")
@UseGuards(ClerkAuthGuard)
export class PlatformController {
  constructor(private readonly mfa: MfaService) {}

  /**
   * Answered for every signed-in user, not only platform staff.
   *
   * A 403 here would be wrong: this is the question the client asks on load to
   * decide whether the panel should exist at all, and a 403 on every page load
   * for every ordinary user is noise that teaches people to ignore 403s.
   */
  @Get("me")
  async me(@ClerkUserId() userId: string) {
    if (!(await isPlatformAdmin(userId))) {
      return { isPlatformAdmin: false, email: null, elevation: null, ...LIMITS };
    }
    return {
      isPlatformAdmin: true,
      email: await platformAdminEmail(userId),
      elevation: await getActiveElevation(userId),
      ...LIMITS,
    };
  }

  /**
   * Open an elevation.
   *
   * Three things are required and all three are recorded: membership of the
   * platform_admins list, a reason long enough to be meaningful to whoever reads
   * the audit log later, and a second factor presented now rather than at some
   * point earlier in the session.
   *
   * The reason is validated before the code is spent, so a caller who mistypes
   * the reason does not burn a backup code learning that.
   */
  @Post("elevate")
  @Throttle({ auth: { limit: 5, ttl: 60000 } })
  async elevate(
    @ClerkUserId() userId: string,
    @Req() req: any,
    @Body() body: { reason?: string; ttlMs?: number; code?: string },
  ) {
    await this.assertAdmin(userId);
    const reason = validateReason(body?.reason);
    const ttlMs = clampTtl(body?.ttlMs);

    // Throws not_enrolled or invalid_code, and audits the failure itself.
    await this.mfa.verify(userId, req?.sessionId ?? null, await orgIdOf(userId), String(body?.code ?? ""));

    const elevation = await openElevation({ userId, reason, ttlMs, ipAddress: clientIp(req) });
    return { elevation, ...LIMITS };
  }

  /**
   * Close the current elevation early.
   *
   * No code required. Giving up privilege should never be harder than keeping it,
   * and an attacker gains nothing by ending an elevation.
   */
  @Post("end-elevation")
  async endCurrent(@ClerkUserId() userId: string) {
    await this.assertAdmin(userId);
    const ended = await endElevation(userId, "ended by the holder");
    return { ended, elevation: null };
  }

  /** Recent elevations for this user, so the holder can see their own history. */
  @Get("elevations")
  async history(@ClerkUserId() userId: string) {
    await this.assertAdmin(userId);
    return { elevations: await listElevations(userId, 20) };
  }

  private async assertAdmin(userId: string): Promise<void> {
    if (await isPlatformAdmin(userId)) return;
    throw new ForbiddenException({
      error: "platform_admin_required",
      message: "This endpoint is restricted to platform administrators.",
    });
  }
}

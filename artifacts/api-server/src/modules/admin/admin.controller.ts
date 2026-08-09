import {
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  UseGuards,
} from "@nestjs/common";
import { ClerkAuthGuard, ClerkUserId } from "../../guards/clerk-auth.guard";
import { db, orgMembersTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { listBlocked, clearBlock } from "../../lib/auth-failure-tracker.js";
import { listActiveThrottles } from "../../lib/magic-link-rate-limiter.js";

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
   * Clears the block for a specific IP immediately.
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
}

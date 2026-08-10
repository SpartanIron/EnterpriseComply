// clerk-auth.guard.ts — BetterAuth-compatible auth guard (replaces @clerk/express)
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
  createParamDecorator,
} from "@nestjs/common";
import { auth } from "../lib/better-auth";
import { db, orgMembersTable, organizationsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { sql } from "drizzle-orm";

async function getSessionUserId(req: any): Promise<string | null> {
  try {
    // Pass all request headers so BetterAuth has host, origin, cookie etc.
    // Passing only cookie + authorization was causing getSession to return null
    // because BetterAuth v1.6 validates the host against trustedOrigins.
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers as Record<string, string | string[] | undefined>)) {
      if (value === undefined) continue;
      if (Array.isArray(value)) {
        for (const v of value) headers.append(key, v);
      } else {
        headers.set(key, value);
      }
    }
    const session = await auth.api.getSession({ headers });
    return session?.user?.id ?? null;
  } catch {
    return null;
  }
}

@Injectable()
export class ClerkAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const userId = await getSessionUserId(req);
    if (!userId) throw new UnauthorizedException("Unauthorized");
    req.clerkUserId = userId;
    return true;
  }
}

@Injectable()
export class OrgContextGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const userId = await getSessionUserId(req);
    if (!userId) throw new UnauthorizedException("Unauthorized");
    req.clerkUserId = userId;
    const member = await db.query.orgMembersTable.findFirst({
      where: eq(orgMembersTable.clerkUserId, userId),
    });
    if (!member) throw new NotFoundException({ error: "no_org", message: "No organization found. Complete onboarding." });
    const org = await db.query.organizationsTable.findFirst({
      where: eq(organizationsTable.id, member.orgId),
    });
    if (!org) throw new NotFoundException({ error: "no_org" });
    req.orgId = member.orgId;
    req.org = org;
    req.member = member;

    // Validate that the URL :orgId param matches the authenticated user's org.
    // Prevents a user from calling /api/orgs/99/... to target another org's data.
    const urlOrgId = req.params?.orgId;
    if (urlOrgId !== undefined) {
      const parsed = parseInt(urlOrgId, 10);
      if (!isNaN(parsed) && parsed !== member.orgId) {
        throw new ForbiddenException("Access to this organization is not allowed");
      }
    }

    await assertMfaPolicySatisfied(req, org, userId);

    return true;
  }
}

/**
 * Multi-factor enforcement (NIST IA-2(1)/(2), CMMC IA.L2-3.5.3, SOC 2 CC6.1).
 *
 * The organisation carries the policy; this is where it actually bites. The
 * rules are deliberately conservative because getting this wrong locks a
 * paying customer out of their own compliance evidence:
 *
 *  - policy off  -> no effect at all
 *  - policy on   -> members without an enrolled authenticator keep working
 *                   until the grace window closes, so they have time to enrol
 *  - after grace -> refused with a machine-readable code the UI can act on
 *
 * A small allow-list stays open even after the grace window so the user can
 * still load the shell, read the policy, and reach the enrolment flow.
 * Enrolment itself lives on /api/auth/two-factor/* which never passes through
 * this guard, so a locked-out member always has a way back in.
 */
const MFA_EXEMPT_SUFFIXES = [
  "/me",
  "/me/role",
  "/mfa-policy",
  "/dashboard",
];

export async function assertMfaPolicySatisfied(
  req: any,
  org: any,
  userId: string,
): Promise<void> {
  if (!org?.mfaEnforced) return;

  const path: string = String(req?.originalUrl ?? req?.url ?? "").split("?")[0];
  if (MFA_EXEMPT_SUFFIXES.some((s) => path.endsWith(s))) return;

  const enrolled = await db.execute(
    sql`SELECT 1 FROM two_factor WHERE "userId" = ${userId} LIMIT 1`,
  );
  if ((enrolled.rows?.length ?? 0) > 0) return;

  const enforcedAt: Date | null = org.mfaEnforcedAt ? new Date(org.mfaEnforcedAt) : null;
  const graceDays: number = Number.isInteger(org.mfaGraceDays) ? org.mfaGraceDays : 14;
  const graceEnds = enforcedAt
    ? new Date(enforcedAt.getTime() + graceDays * 86400000)
    : null;

  if (graceEnds && Date.now() < graceEnds.getTime()) {
    // Still inside the enrolment window - let them through but make the
    // deadline visible to the client on every response.
    req.res?.setHeader?.("X-MFA-Enrollment-Deadline", graceEnds.toISOString());
    return;
  }

  throw new ForbiddenException({
    error: "mfa_enrollment_required",
    message:
      "Your organization requires multi-factor authentication. " +
      "Enroll an authenticator app to continue.",
    enrollmentPath: "/settings/security",
    graceEndedAt: graceEnds ? graceEnds.toISOString() : null,
  });
}

export const ClerkUserId = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  return ctx.switchToHttp().getRequest().clerkUserId;
});

export const OrgContext = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest();
  return { orgId: req.orgId, org: req.org, member: req.member };
});

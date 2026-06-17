// clerk-auth.guard.ts — BetterAuth-compatible auth guard (replaces @clerk/express)
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  NotFoundException,
  createParamDecorator,
} from "@nestjs/common";
import { auth } from "../lib/better-auth";
import { db, orgMembersTable, organizationsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

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
    return true;
  }
}

export const ClerkUserId = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  return ctx.switchToHttp().getRequest().clerkUserId;
});

export const OrgContext = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest();
  return { orgId: req.orgId, org: req.org, member: req.member };
});

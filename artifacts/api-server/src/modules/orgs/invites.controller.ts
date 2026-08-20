// invites.controller.ts — routes for team invitations and member role changes
//
// Mounted on the same "orgs" prefix as OrgsController; Nest merges the two.
// Every authenticated route runs OrgContextGuard first, which is what binds
// :orgId to the caller's own organisation and blocks cross-tenant access.

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { ClerkUserId, OrgContext, OrgContextGuard } from "../../guards/clerk-auth.guard";
import { RequireRole } from "../../guards/roles.guard";
import { InvitesService, type InviteActor } from "./invites.service";

interface OrgCtx {
  orgId: number;
  org: Record<string, unknown>;
  member: Record<string, unknown>;
}

/**
 * The actor's role comes from req.member, which OrgContextGuard populated from
 * the database — never from the request body. Trusting a client-supplied role is
 * exactly how privilege-escalation bugs happen.
 */
function actorOf(ctx: OrgCtx, userId: string): InviteActor {
  return {
    id: userId,
    email: (ctx.member?.email as string | undefined) ?? undefined,
    role: (ctx.member?.role as string | undefined) ?? undefined,
  };
}

@Controller("orgs")
export class InvitesController {
  constructor(private readonly invites: InvitesService) {}

  @Get(":orgId/invites")
  @UseGuards(OrgContextGuard, RequireRole("admin"))
  list(@OrgContext() ctx: OrgCtx) {
    return this.invites.list(ctx.orgId);
  }

  @Post(":orgId/invites")
  @UseGuards(OrgContextGuard, RequireRole("admin"))
  @Throttle({ default: { ttl: 60000, limit: 20 } })
  create(
    @OrgContext() ctx: OrgCtx,
    @ClerkUserId() userId: string,
    @Body() body: { email?: string; role?: string },
  ) {
    return this.invites.create(ctx.orgId, body ?? {}, actorOf(ctx, userId));
  }

  @Post(":orgId/invites/:inviteId/resend")
  @UseGuards(OrgContextGuard, RequireRole("admin"))
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  resend(
    @OrgContext() ctx: OrgCtx,
    @ClerkUserId() userId: string,
    @Param("inviteId", ParseIntPipe) inviteId: number,
  ) {
    return this.invites.resend(ctx.orgId, inviteId, actorOf(ctx, userId));
  }

  @Delete(":orgId/invites/:inviteId")
  @UseGuards(OrgContextGuard, RequireRole("admin"))
  revoke(
    @OrgContext() ctx: OrgCtx,
    @ClerkUserId() userId: string,
    @Param("inviteId", ParseIntPipe) inviteId: number,
  ) {
    return this.invites.revoke(ctx.orgId, inviteId, actorOf(ctx, userId));
  }

  /**
   * Redeeming an invitation cannot require a session — the invitee has no
   * account yet, which is the entire point. The token in the body is the
   * credential, so the route is rate limited to keep it from being usable as a
   * token-guessing oracle.
   */
  @Post(":orgId/invites/accept")
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  accept(
    @Param("orgId", ParseIntPipe) orgId: number,
    @Body() body: { token?: string },
  ) {
    return this.invites.accept(orgId, body?.token ?? "");
  }

  @Patch(":orgId/members/:memberId/role")
  @UseGuards(OrgContextGuard, RequireRole("admin"))
  updateMemberRole(
    @OrgContext() ctx: OrgCtx,
    @ClerkUserId() userId: string,
    @Param("memberId", ParseIntPipe) memberId: number,
    @Body() body: { role?: string },
  ) {
    return this.invites.updateMemberRole(
      ctx.orgId,
      memberId,
      (body?.role ?? "").trim(),
      actorOf(ctx, userId),
    );
  }
}
